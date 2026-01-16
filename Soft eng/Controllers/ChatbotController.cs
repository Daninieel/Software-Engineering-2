using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data;
using System.Text;
using System.Text.Json;

namespace Soft_eng.Controllers
{
    public class ChatRequest
    {
        public string? Message { get; set; }
        public List<object>? History { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class ChatbotController : ControllerBase
    {
        private readonly MySqlConnection _connection;
        private readonly IConfiguration _configuration;

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

            var contextBuilder = new StringBuilder();
            contextBuilder.AppendLine($"Library Snapshot: {DateTime.Now:yyyy-MM-dd HH:mm:ss} (Cabuyao time)");

            try
            {
                if (_connection.State != ConnectionState.Open)
                {
                    await _connection.OpenAsync();
                    Console.WriteLine("[DEBUG] MySQL connection opened");
                }

                contextBuilder.AppendLine("\n=== DASHBOARD SUMMARY ===");
                using (var cmd = new MySqlCommand(
                    @"SELECT 
                        (SELECT COUNT(*) FROM LogBook) AS TotalBooks,
                        (SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Not Returned') AS CurrentlyBorrowed,
                        (SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Returned') AS TotalReturned,
                        (SELECT COUNT(*) FROM Loan WHERE OverdueStatus = 1 AND ReturnStatus = 'Not Returned') AS OverdueCount,
                        (SELECT IFNULL(SUM(FineAmount), 0) FROM Fine WHERE PaymentStatus = 'Unpaid') AS TotalUnpaidFines,
                        (SELECT COUNT(*) FROM LogBook WHERE BookStatus = 'Missing') AS MissingBooks,
                        (SELECT COUNT(*) FROM LogBook WHERE BookStatus = 'Damaged') AS DamagedBooks", _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        contextBuilder.AppendLine($"Total books in inventory: {reader.GetInt64("TotalBooks")}");
                        contextBuilder.AppendLine($"Currently borrowed: {reader.GetInt64("CurrentlyBorrowed")}");
                        contextBuilder.AppendLine($"Total returned: {reader.GetInt64("TotalReturned")}");
                        contextBuilder.AppendLine($"Overdue items: {reader.GetInt64("OverdueCount")}");
                        contextBuilder.AppendLine($"Total unpaid fines: ₱{reader.GetDecimal("TotalUnpaidFines"):N2}");
                        contextBuilder.AppendLine($"Missing books: {reader.GetInt64("MissingBooks")}");
                        contextBuilder.AppendLine($"Damaged books: {reader.GetInt64("DamagedBooks")}");
                    }
                }

                contextBuilder.AppendLine("\n=== BOOKS (inventory) ===");
                using (var cmd = new MySqlCommand(
                    @"SELECT BookTitle, Author, ShelfLocation, Availability, BookStatus, TotalCopies,
                             COUNT(*) OVER (PARTITION BY BookTitle) AS TotalCopiesOfThisTitle
                      FROM LogBook 
                      ORDER BY BookTitle LIMIT 80", _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    bool hasBooks = false;
                    while (await reader.ReadAsync())
                    {
                        hasBooks = true;
                        var title = reader.GetString("BookTitle");
                        var author = reader.IsDBNull("Author") ? "Unknown" : reader.GetString("Author");
                        var shelf = reader.IsDBNull("ShelfLocation") ? "Front Desk" : reader.GetString("ShelfLocation");
                        var avail = reader.GetString("Availability");
                        var status = reader.GetString("BookStatus");
                        var copies = reader.GetInt32("TotalCopies");
                        var totalOfTitle = reader.GetInt32("TotalCopiesOfThisTitle");

                        contextBuilder.AppendLine(
                            $"- \"{title}\" | {author} | Loc: {shelf} | {avail} | Status: {status} | Copies: {copies} (of {totalOfTitle})");
                    }
                    if (!hasBooks) contextBuilder.AppendLine("(No books found in inventory)");
                }

                contextBuilder.AppendLine("\n=== BORROWED BOOKS (active loans) ===");
                using (var cmd = new MySqlCommand(
                    @"SELECT lb.BookTitle, b.BorrowerName, l.DateBorrowed, l.DateDue, 
                             CASE WHEN l.OverdueStatus = 1 THEN 'Overdue' ELSE 'On time' END AS Status
                      FROM Loan l 
                      JOIN LogBook lb ON l.BookID = lb.BookID 
                      JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                      WHERE l.ReturnStatus = 'Not Returned' 
                      ORDER BY l.DateDue ASC LIMIT 30", _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    bool hasLoans = false;
                    while (await reader.ReadAsync())
                    {
                        hasLoans = true;
                        contextBuilder.AppendLine(
                            $"- \"{reader.GetString("BookTitle")}\" borrowed by {reader.GetString("BorrowerName")} | Borrowed: {reader.GetDateTime("DateBorrowed"):yyyy-MM-dd} | Due: {reader.GetDateTime("DateDue"):yyyy-MM-dd} | {reader.GetString("Status")}");
                    }
                    if (!hasLoans) contextBuilder.AppendLine("(No currently borrowed books)");
                }

                contextBuilder.AppendLine("\n=== OVERDUE BORROWED BOOKS ===");
                using (var cmd = new MySqlCommand(
                    @"SELECT lb.BookTitle, b.BorrowerName, l.DateDue, 
                             IFNULL(f.FineAmount, 0) AS Fine
                      FROM Loan l 
                      JOIN LogBook lb ON l.BookID = lb.BookID 
                      JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                      LEFT JOIN Fine f ON l.LoanID = f.LoanID AND f.PaymentStatus = 'Unpaid'
                      WHERE l.OverdueStatus = 1 AND l.ReturnStatus = 'Not Returned' 
                      ORDER BY l.DateDue ASC LIMIT 20", _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    bool hasOverdue = false;
                    while (await reader.ReadAsync())
                    {
                        hasOverdue = true;
                        var fine = reader.GetDecimal("Fine");
                        contextBuilder.AppendLine(
                            $"- \"{reader.GetString("BookTitle")}\" by {reader.GetString("BorrowerName")} overdue since {reader.GetDateTime("DateDue"):yyyy-MM-dd} | Fine: ₱{fine:N2}");
                    }
                    if (!hasOverdue) contextBuilder.AppendLine("(No overdue books)");
                }

                contextBuilder.AppendLine("\n=== UNPAID FINES ===");
                using (var cmd = new MySqlCommand(
                    @"SELECT b.BorrowerName, lb.BookTitle, f.FineAmount 
                      FROM Fine f 
                      JOIN Loan l ON f.LoanID = l.LoanID 
                      JOIN LogBook lb ON l.BookID = lb.BookID 
                      JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                      WHERE f.PaymentStatus = 'Unpaid' 
                      ORDER BY f.FineAmount DESC LIMIT 20", _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    bool hasFines = false;
                    while (await reader.ReadAsync())
                    {
                        hasFines = true;
                        contextBuilder.AppendLine(
                            $"- {reader.GetString(0)} owes ₱{reader.GetDecimal(2):N2} for \"{reader.GetString(1)}\"");
                    }
                    if (!hasFines) contextBuilder.AppendLine("(No unpaid fines)");
                }

                contextBuilder.AppendLine("\n=== REQUESTED BOOKS ===");
                using (var cmd = new MySqlCommand(
                    @"SELECT RequesterName, RequestedTitle, DateRequested, Status, Remarks 
                      FROM Request 
                      ORDER BY DateRequested DESC LIMIT 20", _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    bool hasRequests = false;
                    while (await reader.ReadAsync())
                    {
                        hasRequests = true;
                        var remarks = reader.IsDBNull("Remarks") ? "" : $" ({reader.GetString("Remarks")})";
                        contextBuilder.AppendLine(
                            $"- {reader.GetString("RequesterName")} requested \"{reader.GetString("RequestedTitle")}\" on {reader.GetDateTime("DateRequested"):yyyy-MM-dd} | Status: {reader.GetString("Status")}{remarks}");
                    }
                    if (!hasRequests) contextBuilder.AppendLine("(No book requests)");
                }
            }
            catch (Exception ex)
            {
                contextBuilder.AppendLine($"[DATABASE ERROR] {ex.Message}");
                Console.WriteLine($"[DB ERROR] {ex}");
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await _connection.CloseAsync();
            }
            if (debug)
            {
                return Ok(new { debug = true, context = contextBuilder.ToString() });
            }

            // Gemini API call
            var apiKey = _configuration["Gemini:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                return StatusCode(500, new { error = "Gemini API key missing" });

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

            var contents = request.History ?? new List<object>();
            contents.Add(new
            {
                role = "user",
                parts = new[] { new { text = $"Context:\n{contextBuilder}\n\nUser: {request.Message}" } }
            });

            var payload = new
            {
                contents,
                generationConfig = new { temperature = 0.7, maxOutputTokens = 800 }
            };

            try
            {
                using var client = new HttpClient();
                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await client.PostAsync(url, content);
                var result = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"Gemini failed: {response.StatusCode} - {result}");
                    return StatusCode((int)response.StatusCode, new { error = "Gemini API failed", details = result });
                }

                return Content(result, "application/json");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Gemini call exception: {ex.Message}");
                return StatusCode(500, new { error = "Failed to reach Gemini", message = ex.Message });
            }
        }
    }
}