using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Soft_eng.Controllers
{
    public class ChatRequest
    {
        public string? Message { get; set; }
        public List<JsonObject>? History { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class ChatbotController : ControllerBase
    {
        private readonly MySqlConnection _connection;
        private readonly IConfiguration _configuration;
        private static readonly HttpClient _httpClient = new HttpClient();

        // RATE LIMIT TRACKER
        private static DateTime _lastApiCall = DateTime.MinValue;
        private static readonly object _rateLimitLock = new object();
        private const int MIN_DELAY_BETWEEN_CALLS_MS = 4000;

        private const string DATABASE_SCHEMA = @"
=== LIBRARY DATABASE SCHEMA ===

TABLE: LogBook (Books Inventory)
- BookID (int, PRIMARY KEY)
- ISBN (string, 13 digits)
- BookTitle (string)
- Author (string, nullable)
- ShelfLocation (string, nullable)
- Availability (string: 'Available', 'Unavailable')
- TotalCopies (int)
- BookStatus (string: 'Available', 'Unavailable', 'Damaged', 'Lost', 'Borrowed', 'Reserved', 'Good', 'Missing')

TABLE: Borrower (Library Members)
- BorrowerID (int, PRIMARY KEY)
- BorrowerName (string)
- BorrowerType (string: 'Student', 'Faculty')
- GradeLevel (string, nullable)

TABLE: Loan (Borrowing Records)
- LoanID (int, PRIMARY KEY)
- BookID (int, FOREIGN KEY -> LogBook.BookID)
- BorrowerID (int, FOREIGN KEY -> Borrower.BorrowerID)
- DateBorrowed (datetime)
- DateDue (datetime)
- DateReturned (datetime, nullable)
- ReturnStatus (string: 'Returned', 'Not Returned')
- OverdueStatus (tinyint: 0=on time, 1=overdue)

TABLE: Fine (Overdue Penalties)
- FineID (int, PRIMARY KEY)
- LoanID (int, FOREIGN KEY -> Loan.LoanID)
- FineAmount (decimal)
- PaymentStatus (string: 'Paid', 'Unpaid')

TABLE: Request (Book Requests)
- RequestID (int, PRIMARY KEY)
- RequesterName (string)
- RequestedTitle (string)
- DateRequested (datetime)
- Status (string: 'Pending', 'Approved', 'Rejected')

CURRENT DATE/TIME: {0} (Cabuyao, Philippines time)
";

        public ChatbotController(MySqlConnection connection, IConfiguration configuration)
        {
            _connection = connection;
            _configuration = configuration;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request, [FromQuery] bool debug = false)
        {
            if (string.IsNullOrWhiteSpace(request?.Message))
                return BadRequest(new { error = "Message is required" });

            var apiKey = _configuration["Gemini:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                return StatusCode(500, new { error = "Gemini API key missing" });

            // ENFORCE RATE LIMITING
            lock (_rateLimitLock)
            {
                var timeSinceLastCall = (DateTime.Now - _lastApiCall).TotalMilliseconds;
                if (timeSinceLastCall < MIN_DELAY_BETWEEN_CALLS_MS)
                {
                    var waitTime = (int)(MIN_DELAY_BETWEEN_CALLS_MS - timeSinceLastCall);
                    return StatusCode(429, new
                    {
                        error = "Please wait before sending another message",
                        message = $"To prevent rate limits, please wait {waitTime / 1000} more seconds.",
                        retryAfter = waitTime / 1000
                    });
                }
            }

            // STRATEGY 1: Try pattern matching first (NO API CALL)
            var quickAnswer = await TryPatternMatch(request.Message);
            if (quickAnswer != null)
            {
                Console.WriteLine("[PATTERN MATCH - NO API CALL]");
                return Ok(new
                {
                    candidates = new[]
                    {
                        new
                        {
                            content = new
                            {
                                parts = new[] { new { text = quickAnswer } },
                                role = "model"
                            }
                        }
                    }
                });
            }

            // STRATEGY 2: Use AI
            try
            {
                var schema = string.Format(DATABASE_SCHEMA, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));

                var singlePrompt = $@"You are a library assistant AI with database access.

{schema}

CRITICAL SQL RULES:
- For counting total: Use COUNT(*) or SUM(TotalCopies)
- For single book details: Use SELECT with LIMIT 1
- For lists: Use SELECT with LIMIT 20
- ALWAYS end your SQL with a semicolon

USER QUESTION: ""{request.Message}""

Respond in this EXACT format (including the markers):

###SQL_QUERY###
[Write ONLY the SQL query here, nothing else. Must end with semicolon.]
###END_SQL###

###RESPONSE###
[Your friendly response to the user]
###END_RESPONSE###

EXAMPLES:

User: ""How many copies of Harry Potter?""
###SQL_QUERY###
SELECT SUM(TotalCopies) AS Total FROM LogBook WHERE BookTitle LIKE '%Harry Potter%';
###END_SQL###
###RESPONSE###
Let me check our inventory for Harry Potter books...
###END_RESPONSE###

User: ""Show book 1013""
###SQL_QUERY###
SELECT * FROM LogBook WHERE BookID = 1013 LIMIT 1;
###END_SQL###
###RESPONSE###
Let me retrieve the details for Book ID 1013...
###END_RESPONSE###

User: ""Hello""
###SQL_QUERY###
NONE
###END_SQL###
###RESPONSE###
Hello! I'm your library assistant. How can I help you today?
###END_RESPONSE###";

                lock (_rateLimitLock)
                {
                    _lastApiCall = DateTime.Now;
                }

                var aiResponse = await CallGeminiSafe(singlePrompt, apiKey);

                if (debug)
                {
                    return Ok(new { debug = true, rawResponse = aiResponse, schema });
                }

                // Parse AI response with improved extraction
                var sqlQuery = ExtractBetweenMarkers(aiResponse, "###SQL_QUERY###", "###END_SQL###");
                var userResponse = ExtractBetweenMarkers(aiResponse, "###RESPONSE###", "###END_RESPONSE###");

                Console.WriteLine($"[EXTRACTED SQL] {sqlQuery}");
                Console.WriteLine($"[EXTRACTED RESPONSE] {userResponse}");

                // If no SQL needed
                if (sqlQuery.Trim().Equals("NONE", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(sqlQuery))
                {
                    return Ok(new
                    {
                        candidates = new[]
                        {
                            new
                            {
                                content = new
                                {
                                    parts = new[] { new { text = userResponse } },
                                    role = "model"
                                }
                            }
                        }
                    });
                }

                // Clean the SQL query
                sqlQuery = CleanSQLQuery(sqlQuery);

                // Execute SQL
                var queryResult = await ExecuteQuerySmart(sqlQuery);
                var finalResponse = $"{userResponse}\n\n{queryResult}";

                return Ok(new
                {
                    candidates = new[]
                    {
                        new
                        {
                            content = new
                            {
                                parts = new[] { new { text = finalResponse } },
                                role = "model"
                            }
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");

                if (ex.Message.Contains("429"))
                {
                    return StatusCode(429, new
                    {
                        error = "Service temporarily unavailable",
                        message = "The chatbot is experiencing high demand. Please wait 1 minute and try again.",
                        retryAfter = 60
                    });
                }

                return StatusCode(500, new { error = "Chatbot error", message = ex.Message });
            }
        }

        private string ExtractBetweenMarkers(string text, string startMarker, string endMarker)
        {
            try
            {
                var startIndex = text.IndexOf(startMarker);
                if (startIndex == -1)
                {
                    Console.WriteLine($"[PARSE WARNING] Start marker not found: {startMarker}");
                    return "";
                }

                startIndex += startMarker.Length;
                var endIndex = text.IndexOf(endMarker, startIndex);

                if (endIndex == -1)
                {
                    Console.WriteLine($"[PARSE WARNING] End marker not found: {endMarker}");
                    // Return everything after start marker
                    return text.Substring(startIndex).Trim();
                }

                var result = text.Substring(startIndex, endIndex - startIndex).Trim();
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PARSE ERROR] {ex.Message}");
                return "";
            }
        }

        private string CleanSQLQuery(string sql)
        {
            // Remove any remaining markers or text after the query
            sql = sql.Trim();

            // Remove common AI additions
            sql = Regex.Replace(sql, @"^(sql|mysql|query):\s*", "", RegexOptions.IgnoreCase);
            sql = Regex.Replace(sql, @"^```sql\s*", "", RegexOptions.IgnoreCase);
            sql = Regex.Replace(sql, @"```\s*$", "", RegexOptions.IgnoreCase);

            // Take only up to the first semicolon (or end if no semicolon)
            var semicolonIndex = sql.IndexOf(';');
            if (semicolonIndex > 0)
            {
                sql = sql.Substring(0, semicolonIndex + 1);
            }

            // Remove any text after common ending patterns
            var patterns = new[] { "EXPECTED_RESULT:", "USER_MESSAGE:", "###", "---" };
            foreach (var pattern in patterns)
            {
                var idx = sql.IndexOf(pattern);
                if (idx > 0)
                {
                    sql = sql.Substring(0, idx);
                }
            }

            return sql.Trim().TrimEnd(';') + ";";
        }

        private async Task<string?> TryPatternMatch(string message)
        {
            var lower = message.ToLower().Trim();

            // Greetings
            if (new[] { "hi", "hello", "hey", "good morning", "good afternoon", "good evening" }
                .Any(g => lower == g || lower == g + "!" || lower == g + "."))
            {
                return "Hello! 👋 I'm your library assistant. I can help you check book availability, see borrowed books, track fines, and more. What would you like to know?";
            }

            // Help
            if (lower.Contains("help") || lower.Contains("what can you do"))
            {
                return @"I can help you with:
📚 Finding books by title or author
📖 Checking how many copies we have
📋 Viewing borrowed and overdue books
💰 Checking fines and payments
📊 Library statistics

Just ask naturally, like:
• ""How many copies of Harry Potter do we have?""
• ""Show overdue books""
• ""Show me book 1013""";
            }

            // Thanks
            if (lower.Contains("thank") || lower == "thanks")
            {
                return "You're welcome! 😊 Let me know if you need anything else.";
            }

            // How many books total
            if (lower == "how many books" || lower == "how many books?" || lower == "total books")
            {
                return await ExecuteSimpleCount(
                    "SELECT COUNT(*) FROM LogBook",
                    "We have **{0} books** in our library inventory."
                );
            }

            // How many available
            if (lower.Contains("how many available") || lower.Contains("available books"))
            {
                return await ExecuteSimpleCount(
                    "SELECT COUNT(*) FROM LogBook WHERE Availability = 'Available'",
                    "**{0} books** are currently available for borrowing."
                );
            }

            // Overdue count
            if (lower.Contains("how many overdue"))
            {
                return await ExecuteSimpleCount(
                    "SELECT COUNT(*) FROM Loan WHERE OverdueStatus = 1 AND ReturnStatus = 'Not Returned'",
                    "There are **{0} overdue books** right now."
                );
            }

            // Check for "how many copies of [book]"
            if (lower.Contains("how many cop") && (lower.Contains(" of ") || lower.Contains(" do we have")))
            {
                var bookTitle = ExtractBookFromCopyQuery(message);
                if (!string.IsNullOrEmpty(bookTitle))
                {
                    return await CheckBookCopies(bookTitle);
                }
            }

            // Show book by ID
            if (Regex.IsMatch(lower, @"(show|display|get|find)\s+(book|bookid|id)\s+\d+"))
            {
                var match = Regex.Match(lower, @"\d+");
                if (match.Success)
                {
                    var bookId = int.Parse(match.Value);
                    return await GetBookDetails(bookId);
                }
            }

            return null;
        }

        private async Task<string> GetBookDetails(int bookId)
        {
            try
            {
                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                var query = "SELECT BookID, BookTitle, Author, ISBN, Availability, TotalCopies, ShelfLocation, BookStatus FROM LogBook WHERE BookID = @id LIMIT 1";

                using var cmd = new MySqlCommand(query, _connection);
                cmd.Parameters.AddWithValue("@id", bookId);
                cmd.CommandTimeout = 5;

                using var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var title = reader.GetString("BookTitle");
                    var author = reader.IsDBNull("Author") ? "Unknown" : reader.GetString("Author");
                    var isbn = reader.GetString("ISBN");
                    var avail = reader.GetString("Availability");
                    var copies = reader.GetInt32("TotalCopies");
                    var shelf = reader.IsDBNull("ShelfLocation") ? "Front Desk" : reader.GetString("ShelfLocation");
                    var status = reader.GetString("BookStatus");

                    return $@"📚 **Book Details (ID: {bookId})**

**Title:** {title}
**Author:** {author}
**ISBN:** {isbn}
**Copies:** {copies}
**Location:** {shelf}
**Availability:** {avail}
**Status:** {status}";
                }
                else
                {
                    return $"❌ No book found with ID {bookId}.";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB ERROR] {ex.Message}");
                return $"Error retrieving book details: {ex.Message}";
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
        }

        private string ExtractBookFromCopyQuery(string message)
        {
            var lower = message.ToLower();

            var ofIndex = lower.IndexOf(" of ");
            if (ofIndex > 0)
            {
                var afterOf = message.Substring(ofIndex + 4).Trim();
                afterOf = Regex.Replace(afterOf, @"(do we have|\?|!|\.).*$", "", RegexOptions.IgnoreCase).Trim();
                return afterOf;
            }

            return "";
        }

        private async Task<string> CheckBookCopies(string bookTitle)
        {
            try
            {
                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                var query = "SELECT BookTitle, SUM(TotalCopies) AS Total FROM LogBook WHERE BookTitle LIKE @title GROUP BY BookTitle LIMIT 1";

                using var cmd = new MySqlCommand(query, _connection);
                cmd.Parameters.AddWithValue("@title", $"%{bookTitle}%");
                cmd.CommandTimeout = 5;

                using var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var actualTitle = reader.GetString("BookTitle");
                    var total = reader.GetInt32("Total");
                    return $"📚 We have **{total} {(total == 1 ? "copy" : "copies")}** of \"{actualTitle}\".";
                }
                else
                {
                    return $"❌ Sorry, I couldn't find any book matching \"{bookTitle}\" in our library.";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB ERROR] {ex.Message}");
                return $"Error checking inventory: {ex.Message}";
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
        }

        private async Task<string> ExecuteSimpleCount(string query, string template)
        {
            try
            {
                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                using var cmd = new MySqlCommand(query, _connection);
                cmd.CommandTimeout = 5;

                var result = await cmd.ExecuteScalarAsync();
                var count = Convert.ToInt64(result ?? 0);

                return string.Format(template, count);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB ERROR] {ex.Message}");
                return $"Error: {ex.Message}";
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
        }

        private async Task<string> ExecuteQuerySmart(string sqlQuery)
        {
            try
            {
                if (ContainsDangerousSQL(sqlQuery))
                {
                    return "⚠️ Query rejected for security reasons.";
                }

                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                using var cmd = new MySqlCommand(sqlQuery, _connection);
                cmd.CommandTimeout = 5;

                using var reader = await cmd.ExecuteReaderAsync();

                // Check if it's a single value result (COUNT, SUM, etc.)
                if (reader.FieldCount == 1 && await reader.ReadAsync())
                {
                    var value = reader.GetValue(0);

                    if (value is decimal dec)
                        return $"**₱{dec:N2}**";
                    else if (value is int || value is long)
                        return $"**{value}**";
                    else if (value is DateTime dt)
                        return $"**{dt:MMM dd, yyyy}**";
                    else
                        return $"**{value}**";
                }

                // Multi-column or multi-row result
                var result = new StringBuilder();
                var rowCount = 0;
                var isFirstRow = true;

                // Reset reader
                await _connection.CloseAsync();
                await _connection.OpenAsync();
                using var cmd2 = new MySqlCommand(sqlQuery, _connection);
                cmd2.CommandTimeout = 5;
                using var reader2 = await cmd2.ExecuteReaderAsync();

                while (await reader2.ReadAsync() && rowCount < 20)
                {
                    if (isFirstRow)
                    {
                        // Format as a nice table
                        var headers = new List<string>();
                        for (int i = 0; i < reader2.FieldCount; i++)
                            headers.Add($"**{reader2.GetName(i)}**");

                        if (reader2.FieldCount <= 3)
                        {
                            result.AppendLine(string.Join(" | ", headers));
                            result.AppendLine(new string('-', 50));
                        }

                        isFirstRow = false;
                    }

                    var rowData = new List<string>();
                    for (int i = 0; i < reader2.FieldCount; i++)
                    {
                        var value = reader2.IsDBNull(i) ? "—" : reader2.GetValue(i).ToString();
                        rowData.Add(value ?? "");
                    }

                    if (reader2.FieldCount == 1)
                        result.AppendLine($"• {rowData[0]}");
                    else
                        result.AppendLine($"• {string.Join(" | ", rowData)}");

                    rowCount++;
                }

                if (rowCount == 0)
                    return "No results found.";

                return result.ToString();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB ERROR] {ex.Message}");
                return $"❌ Database error: {ex.Message}";
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
        }

        private async Task<string> CallGeminiSafe(string prompt, string apiKey)
        {
            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[] { new { text = prompt } }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.3,
                    maxOutputTokens = 500
                }
            };

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);
            var result = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[GEMINI ERROR] {response.StatusCode} - {result}");
                throw new Exception($"429 - Rate limit hit");
            }

            var jsonResult = JsonSerializer.Deserialize<JsonObject>(result);
            return jsonResult?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>() ?? "";
        }

        private bool ContainsDangerousSQL(string sql)
        {
            var dangerous = new[] { "DROP", "DELETE", "TRUNCATE", "ALTER", "INSERT", "UPDATE", "CREATE" };
            var upperSql = sql.ToUpper();
            return dangerous.Any(keyword => upperSql.Contains(keyword));
        }
    }
}