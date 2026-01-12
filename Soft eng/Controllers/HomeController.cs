using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;
using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;

namespace Soft_eng.Controllers
{
    public class ChatRequest
    {
        public string? Message { get; set; }
        public List<object>? History { get; set; }
    }

    public class HomeController : Controller
    {
        private readonly MySqlConnection _connection;
        private readonly IConfiguration _configuration;

        public HomeController(MySqlConnection connection, IConfiguration configuration)
        {
            _connection = connection;
            _configuration = configuration;
        }

        public IActionResult Login() => View();
        public IActionResult Register() => View();

        // ==================== DASHBOARD DATA HELPER ====================
        private async Task<dynamic> GetDashboardViewModel()
        {
            int totalBooks = 0;
            int totalBorrowed = 0;
            int totalReturned = 0;
            int totalOverdue = 0;
            int totalMissing = 0;
            int totalDamaged = 0;

            var overdueList = new List<dynamic>();
            var recentList = new List<dynamic>();

            try
            {
                if (_connection.State != ConnectionState.Open)
                    await _connection.OpenAsync();

                // 1. Total Books (Copies)
                using (var cmd = new MySqlCommand("SELECT IFNULL(SUM(TotalCopies), 0) FROM LogBook", _connection))
                    totalBooks = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // 2. Total Borrowed (Active Loans)
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Not Returned'", _connection))
                    totalBorrowed = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // 3. Total Returned (History)
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Returned'", _connection))
                    totalReturned = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // 4. Total Overdue (Active)
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE OverdueStatus = 1 AND ReturnStatus = 'Not Returned'", _connection))
                    totalOverdue = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // 5. Total Missing (Based on LogBook Status)
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM LogBook WHERE BookStatus = 'Missing'", _connection))
                    totalMissing = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // 6. Total Damaged (Based on LogBook Status)
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM LogBook WHERE BookStatus = 'Damaged'", _connection))
                    totalDamaged = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // 7. Overdue History List (Top 5)
                string overdueSql = @"SELECT l.BorrowerID, b.BorrowerName, l.DateBorrowed 
                                      FROM Loan l 
                                      JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                                      WHERE l.OverdueStatus = 1 AND l.ReturnStatus = 'Not Returned'
                                      ORDER BY l.DateBorrowed ASC LIMIT 5";

                using (var cmd = new MySqlCommand(overdueSql, _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        overdueList.Add(new
                        {
                            UserID = reader.GetInt32("BorrowerID"),
                            Name = reader.GetString("BorrowerName"),
                            DateBorrowed = reader.GetDateTime("DateBorrowed").ToString("MM/dd/yyyy")
                        });
                    }
                }

                // 8. Recent Borrowed Books List (Top 5)
                string recentSql = @"SELECT lb.BookTitle 
                                     FROM Loan l 
                                     JOIN LogBook lb ON l.BookID = lb.BookID 
                                     WHERE l.ReturnStatus = 'Not Returned' 
                                     ORDER BY l.DateBorrowed DESC LIMIT 5";

                using (var cmd = new MySqlCommand(recentSql, _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        recentList.Add(new { Title = reader.GetString("BookTitle") });
                    }
                }
            }
            finally
            {
                await _connection.CloseAsync();
            }

            return new
            {
                TotalBooks = totalBooks,
                TotalBorrowed = totalBorrowed,
                TotalReturned = totalReturned,
                TotalOverdue = totalOverdue,
                TotalMissing = totalMissing,
                TotalDamaged = totalDamaged,
                OverdueList = overdueList,
                RecentList = recentList
            };
        }

        // ==================== DASHBOARD ACTIONS ====================

        public async Task<IActionResult> AdminDashboard()
        {
            var data = await GetDashboardViewModel();
            ViewBag.TotalBooks = data.TotalBooks;
            ViewBag.TotalBorrowed = data.TotalBorrowed;
            ViewBag.TotalReturned = data.TotalReturned;
            ViewBag.TotalOverdue = data.TotalOverdue;
            ViewBag.TotalMissing = data.TotalMissing;
            ViewBag.TotalDamaged = data.TotalDamaged;
            ViewBag.OverdueList = data.OverdueList;
            ViewBag.RecentList = data.RecentList;

            return View();
        }

        public async Task<IActionResult> Dashboard()
        {
            var data = await GetDashboardViewModel();
            ViewBag.TotalBooks = data.TotalBooks;
            ViewBag.TotalBorrowed = data.TotalBorrowed;
            ViewBag.TotalReturned = data.TotalReturned;
            ViewBag.TotalOverdue = data.TotalOverdue;
            ViewBag.TotalMissing = data.TotalMissing;
            ViewBag.TotalDamaged = data.TotalDamaged;
            ViewBag.OverdueList = data.OverdueList;
            ViewBag.RecentList = data.RecentList;

            return View();
        }

        public IActionResult Addbooks() => View();
        public IActionResult ForgotPassword() => View();
        public IActionResult RequestedBooks() => View();
        public IActionResult BorrowedBooks() => View();
        public IActionResult Fine() => View();
        public IActionResult LoginAdmin() => View("Login.admin");
        public IActionResult RegisterAdmin() => View("Register.admin");
        public IActionResult InventoryAdmin()
        {
            return RedirectToAction("Inventory", new { fromAdmin = true });
        }
        public IActionResult AddBooksAdmin() => View("AddBooksAdmin");
        public IActionResult ForgotPasswordAdmin() => View("ForgotPasswordAdmin");
        public IActionResult RequestedBooksAdmin() => View("RequestedBooksAdmin");
        public IActionResult BorrowedBooksAdmin() => View("BorrowedBooksAdmin");
        public IActionResult FineAdmin() => View("FineAdmin");

        public IActionResult ResetPasswordAdmin(string? token, string? email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View("ResetPasswordAdmin");
        }

        [HttpPost]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            var apiKey = _configuration["Gemini:ApiKey"];
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";

            var payload = new
            {
                contents = (request.History ?? new List<object>()).Append(new
                {
                    role = "user",
                    parts = new[] { new { text = "Context: You are the Saint Isidore Academy Library Assistant. " + (request.Message ?? "") } }
                })
            };

            using var client = new HttpClient();
            var response = await client.PostAsync(url, new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            var result = await response.Content.ReadAsStringAsync();

            return Content(result, "application/json");
        }

        [HttpPost]
        public async Task<IActionResult> Register(string fullname, string email, string password, string confirmPassword)
        {
            if (password != confirmPassword)
            {
                ViewBag.Message = "Passwords do not match.";
                return View();
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                const string existSql = "SELECT COUNT(1) FROM Register WHERE Email = @e";
                using (var existCmd = new MySqlCommand(existSql, _connection))
                {
                    existCmd.Parameters.AddWithValue("@e", email);
                    var existsObj = await existCmd.ExecuteScalarAsync();
                    if (Convert.ToInt32(existsObj) > 0)
                    {
                        ViewBag.Message = "An account with that email already exists.";
                        return View();
                    }
                }

                string hashedPassword = BCrypt.Net.BCrypt.HashPassword(password);
                const string sql = "INSERT INTO Register (FullName, Email, Password, ConfirmPassword, Role, IsLoggedIn) VALUES (@n, @e, @p, @c, 'Librarian', 0)";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@n", fullname);
                cmd.Parameters.AddWithValue("@e", email);
                cmd.Parameters.AddWithValue("@p", hashedPassword);
                cmd.Parameters.AddWithValue("@c", hashedPassword);
                await cmd.ExecuteNonQueryAsync();
                return RedirectToAction("Login");
            }
            catch
            {
                ViewBag.Message = "A database error occurred.";
                return View();
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        [HttpPost]
        public async Task<IActionResult> Login(string email, string password)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                ViewBag.ErrorMessage = "Email and password are required.";
                return View();
            }

            string normalizedEmail = email.Trim();

            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase)
                && password == "adminsia123")
            {
                return RedirectToAction("AdminDashboard");
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                const string sql = "SELECT Password, Role FROM Register WHERE Email = @e LIMIT 1";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);

                using var reader = await cmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync() ||
                    !BCrypt.Net.BCrypt.Verify(password, reader.GetString("Password")))
                {
                    ViewBag.ErrorMessage = "Invalid email or password.";
                    return View();
                }

                string role = reader.IsDBNull("Role") ? "" : reader.GetString("Role");
                reader.Close();

                const string updateSql = "UPDATE Register SET IsLoggedIn = 1, LastLoginAt = NOW() WHERE Email = @e";
                using var updateCmd = new MySqlCommand(updateSql, _connection);
                updateCmd.Parameters.AddWithValue("@e", normalizedEmail);
                await updateCmd.ExecuteNonQueryAsync();

                return role.Equals("School Admin", StringComparison.OrdinalIgnoreCase)
                    ? RedirectToAction("AdminDashboard")
                    : RedirectToAction("Inventory");
            }
            catch
            {
                ViewBag.ErrorMessage = "Something went wrong. Please try again.";
                return View();
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        [HttpPost]
        public async Task<IActionResult> Logout()
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = "UPDATE Register SET IsLoggedIn = 0 WHERE IsLoggedIn = 1";
                using var cmd = new MySqlCommand(sql, _connection);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
            finally { await _connection.CloseAsync(); }
            return RedirectToAction("Login");
        }

        [HttpPost]
        public async Task<IActionResult> ForgotPassword(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                ViewBag.Message = "Email is required.";
                return View();
            }

            string normalizedEmail = email.Trim();

            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase))
            {
                return RedirectToAction("ResetPasswordAdmin", new { token = "internal-admin-bypass", email = normalizedEmail });
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string existSql = "SELECT 1 FROM Register WHERE Email = @e LIMIT 1";
                using (var existCmd = new MySqlCommand(existSql, _connection))
                {
                    existCmd.Parameters.AddWithValue("@e", normalizedEmail);
                    var existsObj = await existCmd.ExecuteScalarAsync();
                    if (existsObj == null)
                    {
                        ViewBag.Message = "No account found.";
                        return View();
                    }
                }

                await _connection.CloseAsync();
                string token = Guid.NewGuid().ToString();
                string? resetLink = Url.Action("ResetPassword", "Home", new { token, email = normalizedEmail }, Request.Scheme);

                if (!string.IsNullOrEmpty(resetLink))
                {
                    await SendEmail(normalizedEmail, resetLink);
                }

                ViewBag.Message = "Reset link sent.";
                return View();
            }
            catch
            {
                ViewBag.Message = "Error occurred.";
                return View();
            }
            finally
            {
                try { await _connection.CloseAsync(); } catch { }
            }
        }

        public IActionResult ResetPassword(string? token, string? email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> ResetPassword(string? email, string? newPassword, string? confirmPassword, string? token)
        {
            if (newPassword != confirmPassword)
            {
                ViewBag.Message = "Passwords do not match.";
                ViewBag.Token = token;
                ViewBag.Email = email;
                return View();
            }

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(newPassword))
            {
                ViewBag.Message = "Email and new password are required.";
                ViewBag.Token = token;
                ViewBag.Email = email;
                return View();
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string hashed = BCrypt.Net.BCrypt.HashPassword(newPassword);

                const string updateSql = "UPDATE Register SET Password = @p, ConfirmPassword = @p WHERE Email = @e";

                using var cmd = new MySqlCommand(updateSql, _connection);
                cmd.Parameters.AddWithValue("@p", hashed);
                cmd.Parameters.AddWithValue("@e", email.Trim());

                int rowsAffected = await cmd.ExecuteNonQueryAsync();

                if (rowsAffected > 0)
                {
                    return RedirectToAction("Login");
                }
                else
                {
                    ViewBag.Message = "User email not found in database.";
                    ViewBag.Token = token;
                    ViewBag.Email = email;
                    return View();
                }
            }
            catch (Exception ex)
            {
                ViewBag.Message = "A database error occurred: " + ex.Message;
                ViewBag.Token = token;
                ViewBag.Email = email;
                return View();
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        [HttpGet]
        public async Task<IActionResult> GenerateReport(string reportType, string format)
        {
            try
            {
                var data = await GetReportData(reportType);

                if (format.ToLower() == "csv")
                {
                    return GenerateCSV(data, reportType);
                }
                else if (format.ToLower() == "pdf")
                {
                    return GeneratePDF(data, reportType);
                }

                return BadRequest("Invalid format");
            }
            catch (Exception ex)
            {
                return BadRequest($"Error generating report: {ex.Message}");
            }
        }

        private async Task<DataTable> GetReportData(string reportType)
        {
            DataTable dt = new DataTable();

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                string query = reportType switch
                {
                    "borrowedbooks" => @"SELECT 
                        l.LoanID, 
                        b.BorrowerName, 
                        lb.BookTitle, 
                        l.DateDue, 
                        l.DateReturned, 
                        CASE WHEN l.OverdueStatus = 1 THEN 'Yes' ELSE 'No' END as OverdueStatus 
                    FROM Loan l
                    JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                    JOIN LogBook lb ON l.BookID = lb.BookID
                    ORDER BY l.LoanID DESC",
                    "fine" => "SELECT FineID, LoanID, BorrowerName, BookTitle, PaymentStatus, FineAmount FROM Fines ORDER BY FineID DESC",
                    "requestedbooks" => "SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status FROM Requests ORDER BY RequestID DESC",
                    _ => throw new ArgumentException("Invalid report type")
                };

                using var cmd = new MySqlCommand(query, _connection);
                using var adapter = new MySqlDataAdapter(cmd);
                adapter.Fill(dt);
            }
            finally
            {
                await _connection.CloseAsync();
            }

            return dt;
        }

        private IActionResult GenerateCSV(DataTable data, string reportType)
        {
            StringBuilder csv = new StringBuilder();
            csv.Append('\uFEFF');
            csv.AppendLine($"Saint Isidore Academy Library - {GetReportTitle(reportType)} Report");
            csv.AppendLine($"Generated on: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            csv.AppendLine();

            List<string> headers = new List<string>();
            for (int i = 0; i < data.Columns.Count; i++)
            {
                headers.Add(EscapeCSV(data.Columns[i].ColumnName));
            }
            csv.AppendLine(string.Join(",", headers));

            foreach (DataRow row in data.Rows)
            {
                List<string> values = new List<string>();
                for (int i = 0; i < data.Columns.Count; i++)
                {
                    var cellValue = row[i];
                    string escapedValue = EscapeCSV(cellValue?.ToString() ?? "");
                    values.Add(escapedValue);
                }
                csv.AppendLine(string.Join(",", values));
            }

            csv.AppendLine();
            csv.AppendLine($"Total Records: {data.Rows.Count}");

            string filename = $"{reportType}_{DateTime.Now:yyyyMMdd_HHmmss}.csv";
            byte[] bytes = Encoding.UTF8.GetBytes(csv.ToString());

            return File(bytes, "text/csv; charset=utf-8", filename);
        }

        private string GetReportTitle(string reportType)
        {
            return reportType switch
            {
                "borrowedbooks" => "Borrowed Books",
                "fine" => "Fine",
                "requestedbooks" => "Requested Books",
                _ => "Report"
            };
        }

        private string EscapeCSV(string value)
        {
            if (string.IsNullOrEmpty(value))
                return string.Empty;

            if (value.Contains(",") || value.Contains("\"") || value.Contains("\n") || value.Contains("\r"))
            {
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            }

            return value;
        }

        private IActionResult GeneratePDF(DataTable data, string reportType)
        {
            StringBuilder html = new StringBuilder();
            html.Append(@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #c0392b; padding-bottom: 15px; }
        .header h1 { color: #c0392b; margin: 5px 0; }
        .header p { margin: 5px 0; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #c0392b; color: white; padding: 12px; text-align: left; border: 1px solid #999; font-weight: bold; }
        td { padding: 10px; border: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
        .summary { margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #c0392b; }
    </style>
</head>
<body>
    <div class='header'>
        <h1>Saint Isidore Academy Library</h1>
        <h2>" + GetReportTitle(reportType) + @" Report</h2>
        <p>Generated on: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + @"</p>
    </div>
    <table>
        <thead>
            <tr>");

            foreach (DataColumn col in data.Columns)
            {
                html.Append($"<th>{EscapeHTML(col.ColumnName)}</th>");
            }
            html.Append(@"</tr>
        </thead>
        <tbody>");

            foreach (DataRow row in data.Rows)
            {
                html.Append("<tr>");
                foreach (var cell in row.ItemArray)
                {
                    html.Append($"<td>{EscapeHTML(cell?.ToString() ?? "")}</td>");
                }
                html.Append("</tr>");
            }

            html.Append(@"</tbody>
    </table>
    <div class='summary'><strong>Summary:</strong><br>Total Records: " + data.Rows.Count + @"</div>
    <div class='footer'><p>&copy; " + DateTime.Now.Year + @" Saint Isidore Academy Library. All rights reserved.</p></div>
</body>
</html>");

            string filename = $"{reportType}_{DateTime.Now:yyyyMMdd_HHmmss}.html";
            byte[] bytes = Encoding.UTF8.GetBytes(html.ToString());

            return File(bytes, "text/html; charset=utf-8", filename);
        }

        private string EscapeHTML(string value)
        {
            if (string.IsNullOrEmpty(value))
                return string.Empty;

            return value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");
        }

        private async Task SendEmail(string userEmail, string link)
        {
            var senderEmail = "markdanielc0502@gmail.com";
            var appPassword = "yfco kddx caaz ulob";

            using var smtpClient = new SmtpClient("smtp.gmail.com")
            {
                Port = 587,
                Credentials = new NetworkCredential(senderEmail, appPassword),
                EnableSsl = true,
            };

            string emailBody = $@"
        <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
            <h2 style='color: #2c3e50;'>Saint Isidore Academy Library</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password for your library account associated with this email address.</p>
            <p>To choose a new password, please click the link below:</p>
            <div style='margin: 25px 0;'>
                <a href='{link}' style='color: #3498db; font-weight: bold; text-decoration: underline;'>Click to Reset Password</a>
            </div>
            <p>If you did not request this change, you can safely ignore this email.</p>
            <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;' />
            <p style='font-size: 0.8em; color: #777;'>&copy; {DateTime.Now.Year} Saint Isidore Academy. All rights reserved.</p>
        </div>";

            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail, "Saint Isidore Academy Library"),
                Subject = "Saint Isidore Library Password Reset",
                Body = emailBody,
                IsBodyHtml = true,
            };

            mailMessage.To.Add(userEmail);
            await smtpClient.SendMailAsync(mailMessage);
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });

        public async Task<IActionResult> Inventory(bool fromAdmin = false)
        {
            List<LogBook> books = new List<LogBook>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = "SELECT BookID, BookTitle, Author, ShelfLocation, Availability, DateReceived FROM LogBook ORDER BY BookID DESC";
                using var cmd = new MySqlCommand(sql, _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    books.Add(new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability"),
                        DateReceived = reader.IsDBNull("DateReceived") ? (DateTime?)null : reader.GetDateTime("DateReceived")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.FromAdmin = fromAdmin;
            return fromAdmin ? View("InventoryAdmin", books) : View(books);
        }

        public async Task<IActionResult> EditBook(int id, bool fromAdmin = false)
        {
            LogBook? book = null;
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT * FROM LogBook WHERE BookID = @id", _connection);
                cmd.Parameters.AddWithValue("@id", id);
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    book = new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        ISBN = reader.GetString("ISBN"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        Pages = reader.IsDBNull("Pages") ? 0 : reader.GetInt32("Pages"),
                        Edition = reader.IsDBNull("Edition") ? "" : reader.GetString("Edition"),
                        Year = reader.IsDBNull("Year") ? (DateTime?)null : reader.GetDateTime("Year"),
                        Publisher = reader.IsDBNull("Publisher") ? "" : reader.GetString("Publisher"),
                        Remarks = reader.IsDBNull("Remarks") ? "" : reader.GetString("Remarks"),
                        SourceType = reader.IsDBNull("SourceType") ? "" : reader.GetString("SourceType"),
                        DateReceived = reader.IsDBNull("DateReceived") ? (DateTime?)null : reader.GetDateTime("DateReceived"),
                        BookStatus = reader.IsDBNull("BookStatus") ? "" : reader.GetString("BookStatus"),
                        TotalCopies = reader.GetInt32("TotalCopies"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability")
                    };
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.FromAdmin = fromAdmin;
            return View(book);
        }

        [HttpPost]
        public async Task<IActionResult> EditBook(LogBook book, bool isAdmin = false)
        {
            if (!book.IsDateValid())
            {
                ModelState.AddModelError("DateReceived",
                    "Date Received cannot be earlier than the published year.");
            }

            if (!ModelState.IsValid)
            {
                ViewBag.FromAdmin = isAdmin;
                return View(book);
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                const string sql = @"UPDATE LogBook SET 
            ISBN=@isbn,
            SourceType=@source,
            BookTitle=@title,
            DateReceived=@received,
            Author=@author,
            Pages=@pages,
            Edition=@edition,
            Publisher=@pub,
            Year=@year,
            Remarks=@rem,
            ShelfLocation=@shelf,
            TotalCopies=@copies,
            BookStatus=@status
            WHERE BookID=@id";

                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@id", book.BookID);
                cmd.Parameters.AddWithValue("@isbn", book.ISBN ?? "");
                cmd.Parameters.AddWithValue("@source", book.SourceType ?? "");
                cmd.Parameters.AddWithValue("@title", book.BookTitle ?? "");
                cmd.Parameters.AddWithValue("@received", book.DateReceived ?? DateTime.Now);
                cmd.Parameters.AddWithValue("@author", book.Author ?? "");
                cmd.Parameters.AddWithValue("@pages", book.Pages ?? 0);
                cmd.Parameters.AddWithValue("@edition", book.Edition ?? "");
                cmd.Parameters.AddWithValue("@pub", book.Publisher ?? "");
                cmd.Parameters.AddWithValue("@year", book.Year);
                cmd.Parameters.AddWithValue("@rem", book.Remarks ?? "");
                cmd.Parameters.AddWithValue("@shelf", book.ShelfLocation ?? "");
                cmd.Parameters.AddWithValue("@copies", book.TotalCopies);
                cmd.Parameters.AddWithValue("@status", book.BookStatus ?? "");

                await cmd.ExecuteNonQueryAsync();

                return isAdmin
                    ? RedirectToAction("InventoryAdmin")
                    : RedirectToAction("Inventory");
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddBooks(LogBook book, bool isAdmin = false)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = @"INSERT INTO LogBook 
                    (ISBN, SourceType, BookTitle, DateReceived, Author, Pages, Edition, Publisher, Year, Remarks, ShelfLocation, Availability, TotalCopies, BookStatus) 
                    VALUES (@isbn, @source, @title, @received, @author, @pages, @edition, @pub, @year, @rem, @shelf, @avail, @copies, @status)";

                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@isbn", book.ISBN ?? "");
                cmd.Parameters.AddWithValue("@source", book.SourceType ?? "");
                cmd.Parameters.AddWithValue("@title", book.BookTitle ?? "");
                cmd.Parameters.AddWithValue("@received", book.DateReceived ?? DateTime.Now);
                cmd.Parameters.AddWithValue("@author", book.Author ?? "");
                cmd.Parameters.AddWithValue("@pages", book.Pages ?? 0);
                cmd.Parameters.AddWithValue("@edition", book.Edition ?? "");
                cmd.Parameters.AddWithValue("@pub", book.Publisher ?? "");
                cmd.Parameters.AddWithValue("@year", book.Year);
                cmd.Parameters.AddWithValue("@rem", book.Remarks ?? "");
                cmd.Parameters.AddWithValue("@shelf", book.ShelfLocation ?? "");
                cmd.Parameters.AddWithValue("@avail", book.BookStatus ?? "Available");
                cmd.Parameters.AddWithValue("@copies", book.TotalCopies);
                cmd.Parameters.AddWithValue("@status", book.BookStatus ?? "");

                await cmd.ExecuteNonQueryAsync();

                if (isAdmin)
                {
                    return RedirectToAction("InventoryAdmin");
                }
                return RedirectToAction("Inventory");
            }
            finally { await _connection.CloseAsync(); }
        }

        public async Task<IActionResult> BookDetails(int id, bool fromAdmin = false)
        {
            LogBook? book = null;
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT * FROM LogBook WHERE BookID = @id", _connection);
                cmd.Parameters.AddWithValue("@id", id);
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    book = new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        ISBN = reader.GetString("ISBN"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        Pages = reader.IsDBNull("Pages") ? 0 : reader.GetInt32("Pages"),
                        Edition = reader.IsDBNull("Edition") ? "" : reader.GetString("Edition"),
                        Year = reader.IsDBNull("Year") ? (DateTime?)null : reader.GetDateTime("Year"),
                        Publisher = reader.IsDBNull("Publisher") ? "" : reader.GetString("Publisher"),
                        Remarks = reader.IsDBNull("Remarks") ? "" : reader.GetString("Remarks"),
                        SourceType = reader.IsDBNull("SourceType") ? "" : reader.GetString("SourceType"),
                        DateReceived = reader.IsDBNull("DateReceived") ? (DateTime?)null : reader.GetDateTime("DateReceived"),
                        BookStatus = reader.IsDBNull("BookStatus") ? "" : reader.GetString("BookStatus"),
                        TotalCopies = reader.GetInt32("TotalCopies"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability")
                    };
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.FromAdmin = fromAdmin;
            return View(book);
        }

        // ==================== BORROWED BOOKS FUNCTIONALITY ====================

        [HttpGet]
        public async Task<IActionResult> GetBorrowedBooks(bool fromAdmin = false)
        {
            List<object> borrowedBooks = new List<object>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // UPDATED: Now fetches BookStatus for display in the mini pop-up
                const string sql = @"SELECT 
                    l.LoanID,
                    l.BookID,
                    l.BorrowerID,
                    b.BorrowerName,
                    lb.BookTitle,
                    l.DateBorrowed,
                    l.DateDue,
                    l.DateReturned,
                    CASE WHEN l.OverdueStatus = 1 THEN 'Yes' ELSE 'No' END as OverdueStatus,
                    l.ReturnStatus,
                    l.BookStatus,
                    lb.BookStatus as CurrentBookStatus
                FROM Loan l
                JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                JOIN LogBook lb ON l.BookID = lb.BookID
                ORDER BY l.LoanID DESC";

                using var cmd = new MySqlCommand(sql, _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    borrowedBooks.Add(new
                    {
                        LoanID = reader.GetInt32("LoanID"),
                        BookID = reader.GetInt32("BookID"),
                        BorrowerID = reader.GetInt32("BorrowerID"),
                        BorrowerName = reader.GetString("BorrowerName"),
                        BookTitle = reader.GetString("BookTitle"),
                        DateBorrowed = reader.GetDateTime("DateBorrowed").ToString("MM/dd/yyyy"),
                        BorrowDate = reader.GetDateTime("DateBorrowed").ToString("MM/dd/yyyy"),
                        DueDate = reader.GetDateTime("DateDue").ToString("MM/dd/yyyy"),
                        DateReturned = reader.IsDBNull("DateReturned") ? "-" : reader.GetDateTime("DateReturned").ToString("MM/dd/yyyy"),
                        OverdueStatus = reader.GetString("OverdueStatus"),
                        ReturnStatus = reader.IsDBNull("ReturnStatus") ? "Not Returned" : reader.GetString("ReturnStatus"),
                        // Prefer LogBook status for current state, otherwise Loan status
                        BookStatus = reader.IsDBNull("CurrentBookStatus") ? (reader.IsDBNull("BookStatus") ? "Good" : reader.GetString("BookStatus")) : reader.GetString("CurrentBookStatus")
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetBorrowedBooks: {ex.Message}");
                return Json(new List<object>());
            }
            finally
            {
                await _connection.CloseAsync();
            }

            return Json(borrowedBooks);
        }

        [HttpPost]
        public async Task<IActionResult> AddBorrowedBook(string borrowerName, string bookTitle, DateTime borrowDate)
        {
            try
            {
                int borrowerId = await GetOrCreateBorrower(borrowerName);
                int bookId = await GetBookIdByTitle(bookTitle);

                if (bookId == 0)
                {
                    return Json(new { success = false, error = "Book not available or not found." });
                }

                DateTime dueDate = borrowDate.AddDays(4);

                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // 1. Insert Loan
                const string sql = @"INSERT INTO Loan (BookID, BorrowerID, DateBorrowed, DateDue, ReturnStatus, OverdueStatus, BookStatus) 
                                   VALUES (@bookId, @borrowerId, @dateBorrowed, @dateDue, 'Not Returned', FALSE, 'Borrowed')";

                using (var cmd = new MySqlCommand(sql, _connection))
                {
                    cmd.Parameters.AddWithValue("@bookId", bookId);
                    cmd.Parameters.AddWithValue("@borrowerId", borrowerId);
                    cmd.Parameters.AddWithValue("@dateBorrowed", borrowDate);
                    cmd.Parameters.AddWithValue("@dateDue", dueDate);
                    await cmd.ExecuteNonQueryAsync();
                }

                // 2. Update LogBook Availability to 'Borrowed'
                const string updateBookSql = "UPDATE LogBook SET Availability = 'Borrowed' WHERE BookID = @bookId";
                using (var updateCmd = new MySqlCommand(updateBookSql, _connection))
                {
                    updateCmd.Parameters.AddWithValue("@bookId", bookId);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                // Get ID
                const string getLastIdSql = "SELECT LAST_INSERT_ID()";
                using var idCmd = new MySqlCommand(getLastIdSql, _connection);
                var loanId = await idCmd.ExecuteScalarAsync();

                return Json(new
                {
                    success = true,
                    loanId = loanId,
                    dueDate = dueDate.ToString("MM/dd/yyyy"),
                    borrowerId = borrowerId,
                    bookId = bookId
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        private async Task<int> GetOrCreateBorrower(string borrowerName)
        {
            bool closeConnection = false;
            try
            {
                if (_connection.State != ConnectionState.Open)
                {
                    await _connection.OpenAsync();
                    closeConnection = true;
                }

                const string findSql = "SELECT BorrowerID FROM Borrower WHERE BorrowerName = @name";
                using var findCmd = new MySqlCommand(findSql, _connection);
                findCmd.Parameters.AddWithValue("@name", borrowerName);
                var result = await findCmd.ExecuteScalarAsync();

                if (result != null) return Convert.ToInt32(result);

                const string insertSql = "INSERT INTO Borrower (BorrowerName, BorrowerType) VALUES (@name, 'Student')";
                using var insertCmd = new MySqlCommand(insertSql, _connection);
                insertCmd.Parameters.AddWithValue("@name", borrowerName);
                await insertCmd.ExecuteNonQueryAsync();

                return (int)insertCmd.LastInsertedId;
            }
            finally
            {
                if (closeConnection) await _connection.CloseAsync();
            }
        }

        private async Task<int> GetBookIdByTitle(string bookTitle)
        {
            bool closeConnection = false;
            try
            {
                if (_connection.State != ConnectionState.Open)
                {
                    await _connection.OpenAsync();
                    closeConnection = true;
                }
                // Only get books that are Available
                const string sql = "SELECT BookID FROM LogBook WHERE BookTitle = @title AND Availability = 'Available' LIMIT 1";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@title", bookTitle);
                var result = await cmd.ExecuteScalarAsync();

                if (result != null) return Convert.ToInt32(result);
                return 0;
            }
            finally
            {
                if (closeConnection) await _connection.CloseAsync();
            }
        }

        // ***** UPDATED METHOD TO HANDLE BOOK STATUS *****
        [HttpPost]
        public async Task<IActionResult> UpdateBorrowedBook(int loanId, string borrowerName, string bookTitle, DateTime borrowDate, string bookStatus)
        {
            try
            {
                // Note: GetOrCreateBorrower properly handles connection state now.
                int borrowerId = await GetOrCreateBorrower(borrowerName);

                // Ensure connection is open for the rest of the method
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // For updates, we just check existence, not availability
                const string getBookSql = "SELECT BookID FROM LogBook WHERE BookTitle = @title LIMIT 1";
                using var bookCmd = new MySqlCommand(getBookSql, _connection);
                bookCmd.Parameters.AddWithValue("@title", bookTitle);
                var result = await bookCmd.ExecuteScalarAsync();

                if (result == null) return Json(new { success = false, error = "Book not found." });
                int bookId = Convert.ToInt32(result);

                DateTime dueDate = borrowDate.AddDays(4);

                // 1. Update Loan Table
                const string sql = @"UPDATE Loan SET 
                                   BookID = @bookId,
                                   BorrowerID = @borrowerId,
                                   DateBorrowed = @dateBorrowed,
                                   DateDue = @dateDue,
                                   BookStatus = @bookStatus
                                   WHERE LoanID = @loanId";

                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@bookId", bookId);
                cmd.Parameters.AddWithValue("@borrowerId", borrowerId);
                cmd.Parameters.AddWithValue("@dateBorrowed", borrowDate);
                cmd.Parameters.AddWithValue("@dateDue", dueDate);
                // Ensure there is a value or default to 'Borrowed'
                cmd.Parameters.AddWithValue("@bookStatus", bookStatus ?? "Borrowed");
                cmd.Parameters.AddWithValue("@loanId", loanId);

                int rowsAffected = await cmd.ExecuteNonQueryAsync();

                // 2. Update LogBook Table so Dashboard reflects counts (Missing/Damaged)
                // This updates the actual book's condition record
                if (!string.IsNullOrEmpty(bookStatus))
                {
                    const string updateLogBookSql = "UPDATE LogBook SET BookStatus = @status WHERE BookID = @bookId";
                    using var lbCmd = new MySqlCommand(updateLogBookSql, _connection);
                    lbCmd.Parameters.AddWithValue("@status", bookStatus);
                    lbCmd.Parameters.AddWithValue("@bookId", bookId);
                    await lbCmd.ExecuteNonQueryAsync();
                }

                // Note: UpdateBorrowerName properly handles connection state now.
                await UpdateBorrowerName(borrowerId, borrowerName);

                return Json(new
                {
                    success = rowsAffected > 0,
                    dueDate = dueDate.ToString("MM/dd/yyyy"),
                    borrowerId = borrowerId,
                    bookId = bookId
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        private async Task UpdateBorrowerName(int borrowerId, string borrowerName)
        {
            bool closeConnection = false;
            try
            {
                if (_connection.State != ConnectionState.Open)
                {
                    await _connection.OpenAsync();
                    closeConnection = true;
                }

                const string sql = "UPDATE Borrower SET BorrowerName = @name WHERE BorrowerID = @id";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@name", borrowerName);
                cmd.Parameters.AddWithValue("@id", borrowerId);
                await cmd.ExecuteNonQueryAsync();
            }
            finally
            {
                if (closeConnection) await _connection.CloseAsync();
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateOverdueStatus(int loanId, string status)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                bool overdueStatus = status == "Yes";
                const string sql = @"UPDATE Loan SET OverdueStatus = @status WHERE LoanID = @loanId";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@status", overdueStatus);
                cmd.Parameters.AddWithValue("@loanId", loanId);
                int rowsAffected = await cmd.ExecuteNonQueryAsync();
                return Json(new { success = rowsAffected > 0 });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateDateReturned(int loanId, string dateReturned)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // Get BookID to update availability
                const string getBookIdSql = "SELECT BookID FROM Loan WHERE LoanID = @loanId";
                using var getCmd = new MySqlCommand(getBookIdSql, _connection);
                getCmd.Parameters.AddWithValue("@loanId", loanId);
                var bookIdObj = await getCmd.ExecuteScalarAsync();
                int bookId = Convert.ToInt32(bookIdObj);

                string sql;
                string availStatus;

                if (string.IsNullOrEmpty(dateReturned))
                {
                    sql = "UPDATE Loan SET DateReturned = NULL, ReturnStatus = 'Not Returned' WHERE LoanID = @loanId";
                    availStatus = "Borrowed";
                }
                else
                {
                    sql = "UPDATE Loan SET DateReturned = @dateReturned, ReturnStatus = 'Returned' WHERE LoanID = @loanId";
                    availStatus = "Available";
                }

                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@loanId", loanId);
                if (!string.IsNullOrEmpty(dateReturned)) cmd.Parameters.AddWithValue("@dateReturned", DateTime.Parse(dateReturned));
                await cmd.ExecuteNonQueryAsync();

                // Update LogBook
                const string updateBookSql = "UPDATE LogBook SET Availability = @status WHERE BookID = @bookId";
                using var upBookCmd = new MySqlCommand(updateBookSql, _connection);
                upBookCmd.Parameters.AddWithValue("@status", availStatus);
                upBookCmd.Parameters.AddWithValue("@bookId", bookId);
                await upBookCmd.ExecuteNonQueryAsync();

                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> MarkAsReturned(int loanId)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // Get BookID
                const string getBookIdSql = "SELECT BookID FROM Loan WHERE LoanID = @loanId";
                using var getCmd = new MySqlCommand(getBookIdSql, _connection);
                getCmd.Parameters.AddWithValue("@loanId", loanId);
                var bookId = Convert.ToInt32(await getCmd.ExecuteScalarAsync());

                // Update Loan
                const string sql = @"UPDATE Loan SET DateReturned = @returnDate, ReturnStatus = 'Returned' WHERE LoanID = @loanId";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@returnDate", DateTime.Now);
                cmd.Parameters.AddWithValue("@loanId", loanId);
                await cmd.ExecuteNonQueryAsync();

                // Update LogBook
                const string updateBookSql = "UPDATE LogBook SET Availability = 'Available' WHERE BookID = @bookId";
                using var upBookCmd = new MySqlCommand(updateBookSql, _connection);
                upBookCmd.Parameters.AddWithValue("@bookId", bookId);
                await upBookCmd.ExecuteNonQueryAsync();

                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteBorrowedBook(int loanId)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // Get BookID first to reset it to 'Available' if deleting an active loan
                const string getBookSql = "SELECT BookID FROM Loan WHERE LoanID = @loanId";
                using var getCmd = new MySqlCommand(getBookSql, _connection);
                getCmd.Parameters.AddWithValue("@loanId", loanId);
                var bookId = await getCmd.ExecuteScalarAsync();

                if (bookId != null)
                {
                    // Reset book availability
                    const string resetBookSql = "UPDATE LogBook SET Availability = 'Available' WHERE BookID = @bookId";
                    using var resetCmd = new MySqlCommand(resetBookSql, _connection);
                    resetCmd.Parameters.AddWithValue("@bookId", bookId);
                    await resetCmd.ExecuteNonQueryAsync();
                }

                // Delete the loan
                const string sql = @"DELETE FROM Loan WHERE LoanID = @loanId";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@loanId", loanId);
                int rowsAffected = await cmd.ExecuteNonQueryAsync();
                return Json(new { success = rowsAffected > 0 });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBorrowerSuggestions(string query)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = "SELECT BorrowerName FROM Borrower WHERE BorrowerName LIKE @query LIMIT 10";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@query", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                var suggestions = new List<string>();
                while (await reader.ReadAsync())
                {
                    suggestions.Add(reader.GetString("BorrowerName"));
                }
                return Json(suggestions);
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBookTitleSuggestions(string query)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = "SELECT BookTitle FROM LogBook WHERE BookTitle LIKE @query AND Availability = 'Available' LIMIT 10";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@query", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                var suggestions = new List<string>();
                while (await reader.ReadAsync())
                {
                    suggestions.Add(reader.GetString("BookTitle"));
                }
                return Json(suggestions);
            }
            finally { await _connection.CloseAsync(); }
        }
    }
}