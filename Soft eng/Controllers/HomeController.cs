using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;
using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using DinkToPdf;
using DinkToPdf.Contracts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;

namespace Soft_eng.Controllers
{

    public class HomeController : Controller
    {
        private readonly MySqlConnection _connection;
        private readonly IConfiguration _configuration;
        private readonly IConverter _pdfConverter;

        public HomeController(MySqlConnection connection, IConfiguration configuration, IConverter pdfConverter)
        {
            _connection = connection;
            _configuration = configuration;
            _pdfConverter = pdfConverter;
        }

        public IActionResult Login() => View();
        public IActionResult Register() => View();

     

        private async Task<dynamic> GetDashboardViewModel()
        {
            int totalBooks = 0, totalBorrowed = 0, totalReturned = 0, totalOverdue = 0, totalMissing = 0, totalDamaged = 0;
            decimal totalFineSum = 0;
            var overdueList = new List<dynamic>();
            var recentList = new List<dynamic>();

            try
            {
                if (_connection.State != ConnectionState.Open)  await _connection.OpenAsync();

                string updateOverdueSql = "UPDATE Loan SET OverdueStatus = 1 WHERE DateDue < CURDATE() AND ReturnStatus = 'Not Returned'";
                using (var updateCmd = new MySqlCommand(updateOverdueSql, _connection))
                {
                    await updateCmd.ExecuteNonQueryAsync();
                }

                using (var cmd = new MySqlCommand("SELECT IFNULL(SUM(TotalCopies), 0) FROM LogBook", _connection))
                    totalBooks = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Not Returned'", _connection))
                    totalBorrowed = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Returned'", _connection))
                    totalReturned = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE OverdueStatus = 1 AND ReturnStatus = 'Not Returned'", _connection))
                    totalOverdue = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT IFNULL(SUM(FineAmount), 0) FROM Fine WHERE PaymentStatus = 'Unpaid'", _connection))
                    totalFineSum = Convert.ToDecimal(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM LogBook WHERE BookStatus = 'Missing'", _connection))
                    totalMissing = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM LogBook WHERE BookStatus = 'Damaged'", _connection))
                    totalDamaged = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                string overdueSql = @"SELECT l.BorrowerID, b.BorrowerName, l.DateBorrowed, IFNULL(f.FineAmount, 0) as FineAmount 
                                      FROM Loan l 
                                      JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                                      LEFT JOIN Fine f ON l.LoanID = f.LoanID
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
                            DateBorrowed = reader.GetDateTime("DateBorrowed").ToString("MM/dd/yyyy"),
                            Fine = reader.GetDecimal("FineAmount").ToString("N2")
                        });
                    }
                }

                string recentSql = @"SELECT lb.BookTitle FROM Loan l JOIN LogBook lb ON l.BookID = lb.BookID 
                                     WHERE l.ReturnStatus = 'Not Returned' ORDER BY l.DateBorrowed DESC LIMIT 5";

                using (var cmd = new MySqlCommand(recentSql, _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        recentList.Add(new { Title = reader.GetString("BookTitle") });
                    }
                }
            }
            finally { await _connection.CloseAsync(); }

            return new
            {
                TotalBooks = totalBooks,
                TotalBorrowed = totalBorrowed,
                TotalReturned = totalReturned,
                TotalOverdue = totalOverdue,
                TotalMissing = totalMissing,
                TotalDamaged = totalDamaged,
                TotalFine = totalFineSum.ToString("N2"),
                OverdueList = overdueList,
                RecentList = recentList
            };
        }

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
            ViewBag.TotalFine = data.TotalFine;
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
            ViewBag.TotalFine = data.TotalFine;
            return View();
        }

        public IActionResult Addbooks() => View();
        public IActionResult ForgotPassword() => View();

        public async Task<IActionResult> RequestedBooks()
        {
            var requests = new List<Request>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status, Remarks FROM Request ORDER BY DateRequested DESC", _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) requests.Add(new Request { RequestID = reader.GetInt32("RequestID"), RequesterName = reader.GetString("RequesterName"), RequestedTitle = reader.GetString("RequestedTitle"), DateRequested = reader.GetDateTime("DateRequested"), Status = reader.GetString("Status"), Remarks = reader.IsDBNull("Remarks") ? null : reader.GetString("Remarks") });
            }
            finally { await _connection.CloseAsync(); }
            return View(requests);
        }

        public async Task<IActionResult> RequestedBooksAdmin()
        {
            var requests = new List<Request>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status, Remarks FROM Request ORDER BY DateRequested DESC", _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) requests.Add(new Request { RequestID = reader.GetInt32("RequestID"), RequesterName = reader.GetString("RequesterName"), RequestedTitle = reader.GetString("RequestedTitle"), DateRequested = reader.GetDateTime("DateRequested"), Status = reader.GetString("Status"), Remarks = reader.IsDBNull("Remarks") ? null : reader.GetString("Remarks") });
            }
            finally { await _connection.CloseAsync(); }
            return View(requests);
        }

        [HttpPost]
        public async Task<IActionResult> AddRequest(Request request)
        {
            if (!ModelState.IsValid) return RedirectToAction("RequestedBooks");
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("INSERT INTO Request (RequesterName, RequestedTitle, DateRequested, Status, Remarks) VALUES (@name, @title, @date, 'Pending', @remarks)", _connection);
                cmd.Parameters.AddWithValue("@name", request.RequesterName); cmd.Parameters.AddWithValue("@title", request.RequestedTitle); cmd.Parameters.AddWithValue("@date", request.DateRequested); cmd.Parameters.AddWithValue("@remarks", request.Remarks);
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await _connection.CloseAsync(); }
            return RedirectToAction("RequestedBooks");
        }

        [HttpPost]
        public IActionResult EditRequest(Request req)
        {
            if (_connection.State != ConnectionState.Open) _connection.Open();
            using (MySqlCommand cmd = new MySqlCommand("UPDATE request SET RequesterName = @name, RequestedTitle = @title, DateRequested = @date, Remarks = @remarks WHERE RequestID = @id", _connection))
            {
                cmd.Parameters.AddWithValue("@id", req.RequestID); cmd.Parameters.AddWithValue("@name", req.RequesterName); cmd.Parameters.AddWithValue("@title", req.RequestedTitle); cmd.Parameters.AddWithValue("@date", req.DateRequested); cmd.Parameters.AddWithValue("@remarks", req.Remarks);
                cmd.ExecuteNonQuery();
            }
            return RedirectToAction("RequestedBooks");
        }

        [HttpPost]
        public IActionResult EditRequestAdmin(Request req)
        {
            if (_connection.State != ConnectionState.Open) _connection.Open();
            using (MySqlCommand cmd = new MySqlCommand("UPDATE request SET RequesterName = @name, RequestedTitle = @title, DateRequested = @date, Status = @status, Remarks = @remarks WHERE RequestID = @id", _connection))
            {
                cmd.Parameters.AddWithValue("@id", req.RequestID); cmd.Parameters.AddWithValue("@name", req.RequesterName); cmd.Parameters.AddWithValue("@title", req.RequestedTitle); cmd.Parameters.AddWithValue("@date", req.DateRequested); cmd.Parameters.AddWithValue("@status", req.Status); cmd.Parameters.AddWithValue("@remarks", req.Remarks);
                cmd.ExecuteNonQuery();
            }
            return RedirectToAction("RequestedBooksAdmin");
        }

        public IActionResult BorrowedBooks() => View();
        public IActionResult Fine() => View();
        public IActionResult LoginAdmin() => View("Login.admin");
        public IActionResult RegisterAdmin() => View("Register.admin");
        public IActionResult InventoryAdmin() => RedirectToAction("Inventory", new { fromAdmin = true });
        public IActionResult AddBooksAdmin() => View("AddBooksAdmin");
        public IActionResult ForgotPasswordAdmin() => View("ForgotPasswordAdmin");
        public IActionResult BorrowedBooksAdmin() => View("BorrowedBooksAdmin");
        public IActionResult FineAdmin() => View("FineAdmin");

        public IActionResult ResetPasswordAdmin(string? token, string? email)
        {
            ViewBag.Token = token; ViewBag.Email = email;
            return View("ResetPasswordAdmin");
        }

        [HttpPost]
        public async Task<IActionResult> Register(string fullname, string email, string password, string confirmPassword)
        {
            if (password != confirmPassword) { ViewBag.Message = "Passwords do not match."; return View(); }
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using (var existCmd = new MySqlCommand("SELECT COUNT(1) FROM Register WHERE Email = @e", _connection))
                {
                    existCmd.Parameters.AddWithValue("@e", email);
                    if (Convert.ToInt32(await existCmd.ExecuteScalarAsync()) > 0) { ViewBag.Message = "An account with that email already exists."; return View(); }
                }
                string hashed = BCrypt.Net.BCrypt.HashPassword(password);
                using var cmd = new MySqlCommand("INSERT INTO Register (FullName, Email, Password, ConfirmPassword, Role, IsLoggedIn) VALUES (@n, @e, @p, @c, 'Librarian', 0)", _connection);
                cmd.Parameters.AddWithValue("@n", fullname); cmd.Parameters.AddWithValue("@e", email); cmd.Parameters.AddWithValue("@p", hashed); cmd.Parameters.AddWithValue("@c", hashed);
                await cmd.ExecuteNonQueryAsync();
                return RedirectToAction("Login");
            }
            catch { ViewBag.Message = "A database error occurred."; return View(); }
            finally { await _connection.CloseAsync(); }
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

            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase) && password == "adminsia123")
            {
                var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, "Administrator"),
            new Claim(ClaimTypes.Role, "Admin")
        };
                var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity));

                return RedirectToAction("AdminDashboard");
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using var cmd = new MySqlCommand("SELECT FullName, Password, Role FROM Register WHERE Email = @e LIMIT 1", _connection);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);

                using var reader = await cmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync() || !BCrypt.Net.BCrypt.Verify(password, reader.GetString("Password")))
                {
                    ViewBag.ErrorMessage = "Invalid email or password.";
                    return View();
                }

                string fullName = reader.GetString("FullName");
                string role = reader.IsDBNull("Role") ? "Librarian" : reader.GetString("Role");
                reader.Close();

                var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, fullName),
            new Claim(ClaimTypes.Role, role)
        };

                var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity));

                using var updateCmd = new MySqlCommand("UPDATE Register SET IsLoggedIn = 1, LastLoginAt = NOW() WHERE Email = @e", _connection);
                updateCmd.Parameters.AddWithValue("@e", normalizedEmail);
                await updateCmd.ExecuteNonQueryAsync();

                return role.Equals("School Admin", StringComparison.OrdinalIgnoreCase) ? RedirectToAction("AdminDashboard") : RedirectToAction("Dashboard");
            }
            catch (Exception ex)
            {
                ViewBag.ErrorMessage = "Login failed: " + ex.Message;
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
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("UPDATE Register SET IsLoggedIn = 0 WHERE IsLoggedIn = 1", _connection);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
            finally { await _connection.CloseAsync(); }

            return RedirectToAction("Login");
        }

        [HttpPost]
        public async Task<IActionResult> ForgotPassword(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) { ViewBag.Message = "Email is required."; return View(); }
            string normalizedEmail = email.Trim();
            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase)) return RedirectToAction("ResetPasswordAdmin", new { token = "internal-admin-bypass", email = normalizedEmail });
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using (var existCmd = new MySqlCommand("SELECT 1 FROM Register WHERE Email = @e LIMIT 1", _connection))
                {
                    existCmd.Parameters.AddWithValue("@e", normalizedEmail);
                    if (await existCmd.ExecuteScalarAsync() == null) { ViewBag.Message = "No account found."; return View(); }
                }
                string token = Guid.NewGuid().ToString();
                string? link = Url.Action("ResetPassword", "Home", new { token, email = normalizedEmail }, Request.Scheme);
                if (!string.IsNullOrEmpty(link)) await SendEmail(normalizedEmail, link);
                ViewBag.Message = "Reset link sent."; return View();
            }
            catch { ViewBag.Message = "Error occurred."; return View(); }
            finally { await _connection.CloseAsync(); }
        }

        public IActionResult ResetPassword(string? token, string? email) { ViewBag.Token = token; ViewBag.Email = email; return View(); }

        [HttpPost]
        public async Task<IActionResult> ResetPassword(string? email, string? newPassword, string? confirmPassword, string? token)
        {
            if (newPassword != confirmPassword) { ViewBag.Message = "Passwords do not match."; ViewBag.Token = token; ViewBag.Email = email; return View(); }
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(newPassword)) { ViewBag.Message = "Email and new password are required."; ViewBag.Token = token; ViewBag.Email = email; return View(); }
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                string hashed = BCrypt.Net.BCrypt.HashPassword(newPassword);
                using var cmd = new MySqlCommand("UPDATE Register SET Password = @p, ConfirmPassword = @p WHERE Email = @e", _connection);
                cmd.Parameters.AddWithValue("@p", hashed); cmd.Parameters.AddWithValue("@e", email.Trim());
                if (await cmd.ExecuteNonQueryAsync() > 0) return RedirectToAction("Login");
                ViewBag.Message = "User email not found."; ViewBag.Token = token; ViewBag.Email = email; return View();
            }
            catch { ViewBag.Message = "Database error."; return View(); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetFines()
        {
            var fines = new List<object>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = @"SELECT f.FineID, f.LoanID, b.BorrowerName, lb.BookTitle, f.PaymentStatus, f.FineAmount, f.DatePaid
                                    FROM Fine f INNER JOIN Loan l ON f.LoanID = l.LoanID INNER JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                                    INNER JOIN LogBook lb ON l.BookID = lb.BookID ORDER BY f.FineID DESC";
                using var cmd = new MySqlCommand(sql, _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) fines.Add(new { fineID = reader.GetInt32("FineID"), loanID = reader.GetInt32("LoanID"), borrowerName = reader.GetString("BorrowerName"), bookTitle = reader.GetString("BookTitle"), paymentStatus = reader.GetString("PaymentStatus"), fineAmount = reader.GetDecimal("FineAmount"), datePaid = reader.IsDBNull("DatePaid") ? "-" : reader.GetDateTime("DatePaid").ToString("MM/dd/yyyy") });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
            return Json(fines);
        }

        [HttpPost]
        public async Task<IActionResult> EditFine(Fine fine)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string sql = @"UPDATE Fine 
                       SET PaymentStatus = @status, 
                           FineAmount = @amount, 
                           totalFineAmount = @total, 
                           DatePaid = @date 
                       WHERE FineID = @id";

                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@id", fine.FineID);
                cmd.Parameters.AddWithValue("@status", fine.PaymentStatus);
                cmd.Parameters.AddWithValue("@amount", fine.FineAmount);
                cmd.Parameters.AddWithValue("@total", fine.totalFineAmount);

                if (fine.DatePaid.HasValue && fine.DatePaid != DateTime.MinValue)
                    cmd.Parameters.AddWithValue("@date", fine.DatePaid.Value);
                else
                    cmd.Parameters.AddWithValue("@date", DBNull.Value);

                await cmd.ExecuteNonQueryAsync();
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateOverdueStatus(int loanId, string status)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                bool isOverdue = (status == "Yes");

                using (var cmd = new MySqlCommand("UPDATE Loan SET OverdueStatus = @status WHERE LoanID = @loanId", _connection))
                {
                    cmd.Parameters.AddWithValue("@status", isOverdue);
                    cmd.Parameters.AddWithValue("@loanId", loanId);
                    await cmd.ExecuteNonQueryAsync();
                }

                if (isOverdue)
                {
                    const string insertSql = @"INSERT INTO Fine (LoanID, PaymentStatus, FineAmount) 
                                     SELECT @loanId, 'Unpaid', 5.00
                                     FROM DUAL 
                                     WHERE NOT EXISTS (SELECT 1 FROM Fine WHERE LoanID = @loanId AND PaymentStatus = 'Unpaid')";
                    using var insCmd = new MySqlCommand(insertSql, _connection);
                    insCmd.Parameters.AddWithValue("@loanId", loanId);
                    await insCmd.ExecuteNonQueryAsync();
                }
                else
                {
                    const string deleteSql = "DELETE FROM Fine WHERE LoanID = @loanId AND PaymentStatus = 'Unpaid'";
                    using var delCmd = new MySqlCommand(deleteSql, _connection);
                    delCmd.Parameters.AddWithValue("@loanId", loanId);
                    await delCmd.ExecuteNonQueryAsync();
                }

                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GenerateReport(string reportType, string format)
        {
            try
            {
                var data = await GetReportData(reportType);
                if (format.ToLower() == "csv") return GenerateCSV(data, reportType);
                if (format.ToLower() == "pdf") return GeneratePDF(data, reportType);
                return BadRequest("Invalid format");
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        private IActionResult GeneratePDF(DataTable data, string reportType)
        {
            var doc = new HtmlToPdfDocument() { GlobalSettings = { ColorMode = ColorMode.Color, Orientation = Orientation.Portrait, PaperSize = PaperKind.A4 }, Objects = { new ObjectSettings() { HtmlContent = BuildHtmlString(data, reportType), WebSettings = { DefaultEncoding = "utf-8" } } } };
            return File(_pdfConverter.Convert(doc), "application/pdf", $"{reportType}_{DateTime.Now:yyyyMMdd_HHmmss}.pdf");
        }

        private string BuildHtmlString(DataTable data, string reportType)
        {
            StringBuilder html = new StringBuilder();
            html.Append(@"<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{font-family:Arial,sans-serif;margin:20px;color:#333}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #c0392b;padding-bottom:15px}table{width:100%;border-collapse:collapse}th{background-color:#c0392b;color:#fff;padding:12px;text-align:left;border:1px solid #999}td{padding:10px;border:1px solid #ddd}tr:nth-child(even){background-color:#f9f9f9}</style></head><body><div class='header'>");
            html.Append($"<h1>Saint Isidore Academy Library</h1><h2>{GetReportTitle(reportType)} Report</h2><p>Generated on: {DateTime.Now:yyyy-MM-dd HH:mm:ss}</p></div><table><thead><tr>");
            foreach (DataColumn col in data.Columns) html.Append($"<th>{EscapeHTML(col.ColumnName)}</th>");
            html.Append("</tr></thead><tbody>");
            foreach (DataRow row in data.Rows) { html.Append("<tr>"); foreach (var cell in row.ItemArray) html.Append($"<td>{EscapeHTML(cell?.ToString() ?? "")}</td>"); html.Append("</tr>"); }
            html.Append($"</tbody></table><div style='margin-top:20px;'><strong>Total Records:</strong> {data.Rows.Count}</div></body></html>");
            return html.ToString();
        }

        private async Task<DataTable> GetReportData(string reportType)
        {
            DataTable dt = new DataTable();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                string query = reportType switch
                {
                    "borrowedbooks" => "SELECT l.LoanID, b.BorrowerName, lb.BookTitle, l.DateDue, l.DateReturned, CASE WHEN l.OverdueStatus = 1 THEN 'Yes' ELSE 'No' END as OverdueStatus FROM Loan l JOIN Borrower b ON l.BorrowerID = b.BorrowerID JOIN LogBook lb ON l.BookID = lb.BookID ORDER BY l.LoanID DESC",
                    "fine" => "SELECT f.FineID, l.LoanID, b.BorrowerName, lb.BookTitle, f.PaymentStatus, f.FineAmount FROM Fine f JOIN Loan l ON f.LoanID = l.LoanID JOIN Borrower b ON l.BorrowerID = b.BorrowerID JOIN LogBook lb ON l.BookID = lb.BookID ORDER BY f.FineID DESC",
                    "requestedbooks" => "SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status, Remarks FROM Request ORDER BY RequestID DESC",
                    _ => throw new ArgumentException("Invalid report type")
                };
                using var cmd = new MySqlCommand(query, _connection);
                using var adapter = new MySqlDataAdapter(cmd);
                adapter.Fill(dt);
            }
            finally { await _connection.CloseAsync(); }
            return dt;
        }

        private IActionResult GenerateCSV(DataTable data, string reportType)
        {
            StringBuilder csv = new StringBuilder();
            csv.Append('\uFEFF'); csv.AppendLine($"Saint Isidore Academy Library - {GetReportTitle(reportType)} Report"); csv.AppendLine($"Generated on: {DateTime.Now:yyyy-MM-dd HH:mm:ss}"); csv.AppendLine();
            List<string> headers = new List<string>();
            for (int i = 0; i < data.Columns.Count; i++) headers.Add(EscapeCSV(data.Columns[i].ColumnName));
            csv.AppendLine(string.Join(",", headers));
            foreach (DataRow row in data.Rows) { List<string> values = new List<string>(); for (int i = 0; i < data.Columns.Count; i++) values.Add(EscapeCSV(row[i]?.ToString() ?? "")); csv.AppendLine(string.Join(",", values)); }
            csv.AppendLine(); csv.AppendLine($"Total Records: {data.Rows.Count}");
            return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", $"{reportType}_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
        }

        private string GetReportTitle(string type) => type switch { "borrowedbooks" => "Borrowed Books", "fine" => "Fine", "requestedbooks" => "Requested Books", _ => "Report" };
        private string EscapeCSV(string v) => (string.IsNullOrEmpty(v) || !v.Any(c => c == ',' || c == '"' || c == '\n' || c == '\r')) ? v : $"\"{v.Replace("\"", "\"\"")}\"";
        private string EscapeHTML(string v) => string.IsNullOrEmpty(v) ? "" : v.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

        private async Task SendEmail(string email, string link)
        {
            using var smtp = new SmtpClient("smtp.gmail.com") { Port = 587, Credentials = new NetworkCredential("markdanielc0502@gmail.com", "yfco kddx caaz ulob"), EnableSsl = true };
            var msg = new MailMessage { From = new MailAddress("markdanielc0502@gmail.com", "Saint Isidore Academy Library"), Subject = "Saint Isidore Library Password Reset", Body = $"Click to reset: {link}", IsBodyHtml = true };
            msg.To.Add(email); await smtp.SendMailAsync(msg);
        }

        public async Task<IActionResult> Inventory(bool fromAdmin = false)
        {
            List<LogBook> books = new List<LogBook>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT BookID, BookTitle, Author, ShelfLocation, Availability, DateReceived FROM LogBook ORDER BY BookID DESC", _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) books.Add(new LogBook { BookID = reader.GetInt32("BookID"), BookTitle = reader.GetString("BookTitle"), Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"), ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"), Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability"), DateReceived = reader.IsDBNull("DateReceived") ? (DateTime?)null : reader.GetDateTime("DateReceived") });
            }
            finally { await _connection.CloseAsync(); }
            ViewBag.FromAdmin = fromAdmin;
            return fromAdmin ? View("InventoryAdmin", books) : View(books);
        }

        [HttpGet]
        public async Task<IActionResult> SearchBooks(string query, bool fromAdmin = false)
        {
            List<LogBook> results = new List<LogBook>();
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                    return RedirectToAction("Inventory", new { fromAdmin });

                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string sqlQuery = @"SELECT BookID, BookTitle, Author, ShelfLocation, Availability, DateReceived 
                                   FROM LogBook 
                                   WHERE BookID LIKE @q 
                                      OR BookTitle LIKE @q 
                                      OR Author LIKE @q 
                                      OR ShelfLocation LIKE @q 
                                      OR ISBN LIKE @q 
                                      OR Publisher LIKE @q
                                   ORDER BY BookID DESC";

                using var cmd = new MySqlCommand(sqlQuery, _connection);
                cmd.Parameters.AddWithValue("@q", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new LogBook
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

            ViewBag.SearchQuery = query;
            ViewBag.FromAdmin = fromAdmin;
            return fromAdmin ? View("InventoryAdmin", results) : View("Inventory", results);
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
                if (await reader.ReadAsync()) book = new LogBook { BookID = reader.GetInt32("BookID"), ISBN = reader.GetString("ISBN"), BookTitle = reader.GetString("BookTitle"), Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"), Pages = reader.IsDBNull("Pages") ? 0 : reader.GetInt32("Pages"), Edition = reader.IsDBNull("Edition") ? "" : reader.GetString("Edition"), Year = reader.IsDBNull("Year") ? (DateTime?)null : reader.GetDateTime("Year"), Publisher = reader.IsDBNull("Publisher") ? "" : reader.GetString("Publisher"), Remarks = reader.IsDBNull("Remarks") ? "" : reader.GetString("Remarks"), SourceType = reader.IsDBNull("SourceType") ? "" : reader.GetString("SourceType"), DateReceived = reader.IsDBNull("DateReceived") ? (DateTime?)null : reader.GetDateTime("DateReceived"), BookStatus = reader.IsDBNull("BookStatus") ? "" : reader.GetString("BookStatus"), TotalCopies = reader.GetInt32("TotalCopies"), ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"), Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability") };
            }
            finally { await _connection.CloseAsync(); }
            ViewBag.FromAdmin = fromAdmin; return View(book);
        }

        [HttpPost]
        public async Task<IActionResult> EditBook(LogBook book, bool isAdmin = false)
        {
            if (!book.IsDateValid()) ModelState.AddModelError("DateReceived", "-");
            if (!ModelState.IsValid) { ViewBag.FromAdmin = isAdmin; return View(book); }
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

 
                using (var cmd = new MySqlCommand("UPDATE LogBook SET ISBN=@isbn, SourceType=@source, BookTitle=@title, DateReceived=@received, Author=@author, Pages=@pages, Edition=@edition, Publisher=@pub, Year=@year, Remarks=@rem, ShelfLocation=@shelf, TotalCopies=@total, BookStatus=@status, Availability=@avail WHERE BookID=@id", _connection))
                {
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
                    cmd.Parameters.AddWithValue("@total", book.TotalCopies);

                    cmd.Parameters.AddWithValue("@avail", book.BookStatus ?? "Available");
                    cmd.Parameters.AddWithValue("@status", book.BookStatus ?? "");

                    await cmd.ExecuteNonQueryAsync();
                }

                int copiesToAdd = book.TotalCopies - 1;

                if (copiesToAdd > 0)
                {
                    for (int i = 0; i < copiesToAdd; i++)
                    {
                        using var cmd = new MySqlCommand("INSERT INTO LogBook (ISBN, SourceType, BookTitle, DateReceived, Author, Pages, Edition, Publisher, Year, Remarks, ShelfLocation, Availability, TotalCopies, BookStatus) VALUES (@isbn, @source, @title, @received, @author, @pages, @edition, @pub, @year, @rem, @shelf, @avail, @total, @status)", _connection);

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
                        cmd.Parameters.AddWithValue("@total", book.TotalCopies);
                        cmd.Parameters.AddWithValue("@status", book.BookStatus ?? "");

                        await cmd.ExecuteNonQueryAsync();
                    }
                }

                return isAdmin ? RedirectToAction("InventoryAdmin") : RedirectToAction("Inventory");
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> AddBooks(LogBook book, bool isAdmin = false)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                int copies = book.TotalCopies > 0 ? book.TotalCopies : 1;
                for (int i = 0; i < copies; i++)
                {
                    using var cmd = new MySqlCommand("INSERT INTO LogBook (ISBN, SourceType, BookTitle, DateReceived, Author, Pages, Edition, Publisher, Year, Remarks, ShelfLocation, Availability, TotalCopies, BookStatus) VALUES (@isbn, @source, @title, @received, @author, @pages, @edition, @pub, @year, @rem, @shelf, @avail, @copies, @status)", _connection);
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
                    cmd.Parameters.AddWithValue("@copies", copies);
                    cmd.Parameters.AddWithValue("@status", book.BookStatus ?? "");

                    await cmd.ExecuteNonQueryAsync();
                }

                return isAdmin ? RedirectToAction("InventoryAdmin") : RedirectToAction("Inventory");
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
                if (await reader.ReadAsync()) book = new LogBook { BookID = reader.GetInt32("BookID"), ISBN = reader.GetString("ISBN"), BookTitle = reader.GetString("BookTitle"), Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"), Pages = reader.IsDBNull("Pages") ? 0 : reader.GetInt32("Pages"), Edition = reader.IsDBNull("Edition") ? "" : reader.GetString("Edition"), Year = reader.IsDBNull("Year") ? (DateTime?)null : reader.GetDateTime("Year"), Publisher = reader.IsDBNull("Publisher") ? "" : reader.GetString("Publisher"), Remarks = reader.IsDBNull("Remarks") ? "" : reader.GetString("Remarks"), SourceType = reader.IsDBNull("SourceType") ? "" : reader.GetString("SourceType"), DateReceived = reader.IsDBNull("DateReceived") ? (DateTime?)null : reader.GetDateTime("DateReceived"), BookStatus = reader.IsDBNull("BookStatus") ? "" : reader.GetString("BookStatus"), TotalCopies = reader.GetInt32("TotalCopies"), ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"), Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability") };
            }
            finally { await _connection.CloseAsync(); }
            ViewBag.FromAdmin = fromAdmin; return View(book);
        }

        [HttpGet]
        public async Task<IActionResult> GetBorrowedBooks(bool fromAdmin = false)
        {
            var borrowed = new List<object>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT l.LoanID, l.BookID, l.BorrowerID, b.BorrowerName, lb.BookTitle, l.DateBorrowed, l.DateDue, l.DateReturned, CASE WHEN l.OverdueStatus = 1 THEN 'Yes' ELSE 'No' END as OverdueStatus, l.ReturnStatus, l.BookStatus, lb.BookStatus as CurrentBookStatus FROM Loan l JOIN Borrower b ON l.BorrowerID = b.BorrowerID JOIN LogBook lb ON l.BookID = lb.BookID ORDER BY l.LoanID DESC", _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) borrowed.Add(new { LoanID = reader.GetInt32("LoanID"), BookID = reader.GetInt32("BookID"), BorrowerID = reader.GetInt32("BorrowerID"), BorrowerName = reader.GetString("BorrowerName"), BookTitle = reader.GetString("BookTitle"), DateBorrowed = reader.GetDateTime("DateBorrowed").ToString("MM/dd/yyyy"), BorrowDate = reader.GetDateTime("DateBorrowed").ToString("MM/dd/yyyy"), DueDate = reader.GetDateTime("DateDue").ToString("MM/dd/yyyy"), DateReturned = reader.IsDBNull("DateReturned") ? "-" : reader.GetDateTime("DateReturned").ToString("MM/dd/yyyy"), OverdueStatus = reader.GetString("OverdueStatus"), ReturnStatus = reader.IsDBNull("ReturnStatus") ? "Not Returned" : reader.GetString("ReturnStatus"), BookStatus = reader.IsDBNull("CurrentBookStatus") ? (reader.IsDBNull("BookStatus") ? "Good" : reader.GetString("BookStatus")) : reader.GetString("CurrentBookStatus") });
            }
            finally { await _connection.CloseAsync(); }
            return Json(borrowed);
        }

        [HttpPost]


        [HttpPost]
        public async Task<IActionResult> AddBorrowedBook(string borrowerName, string borrowerType, string bookTitle, DateTime borrowDate)
        {
            try
            {
                int bId = await GetOrCreateBorrower(borrowerName, borrowerType);
                int bkId = await GetBookIdByTitle(bookTitle);

                if (bkId == 0)
                {
                    if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                    using var checkCmd = new MySqlCommand("SELECT COUNT(*) FROM LogBook WHERE BookTitle = @t", _connection);
                    checkCmd.Parameters.AddWithValue("@t", bookTitle);
                    long count = Convert.ToInt64(await checkCmd.ExecuteScalarAsync());

                    if (count > 0)
                    {
                        return Json(new { success = false, error = "Limit reached. Book is unavailable for borrow." });
                    }
                    else
                    {
                        return Json(new { success = false, error = "Book not found." });
                    }
                }

                DateTime due = borrowDate.AddDays(4);
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using (var cmd = new MySqlCommand("INSERT INTO Loan (BookID, BorrowerID, DateBorrowed, DateDue, ReturnStatus, OverdueStatus, BookStatus) VALUES (@bkId, @bId, @db, @dd, 'Not Returned', FALSE, 'Borrowed')", _connection))
                {
                    cmd.Parameters.AddWithValue("@bkId", bkId);
                    cmd.Parameters.AddWithValue("@bId", bId);
                    cmd.Parameters.AddWithValue("@db", borrowDate);
                    cmd.Parameters.AddWithValue("@dd", due);
                    await cmd.ExecuteNonQueryAsync();
                }

                using (var updateCmd = new MySqlCommand("UPDATE LogBook SET Availability = 'Borrowed' WHERE BookID = @bkId", _connection))
                {
                    updateCmd.Parameters.AddWithValue("@bkId", bkId);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                using var idCmd = new MySqlCommand("SELECT LAST_INSERT_ID()", _connection);
                return Json(new { success = true, loanId = await idCmd.ExecuteScalarAsync(), dueDate = due.ToString("MM/dd/yyyy"), borrowerId = bId, bookId = bkId });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        private async Task<int> GetOrCreateBorrower(string name, string type)
        {
            bool close = false; if (_connection.State != ConnectionState.Open) { await _connection.OpenAsync(); close = true; }
            try
            {
                using var find = new MySqlCommand("SELECT BorrowerID FROM Borrower WHERE BorrowerName = @n", _connection); find.Parameters.AddWithValue("@n", name);
                var res = await find.ExecuteScalarAsync(); if (res != null) return Convert.ToInt32(res);

                using var ins = new MySqlCommand("INSERT INTO Borrower (BorrowerName, BorrowerType) VALUES (@n, @t)", _connection);
                ins.Parameters.AddWithValue("@n", name);
                ins.Parameters.AddWithValue("@t", type);
                await ins.ExecuteNonQueryAsync();
                return (int)ins.LastInsertedId;
            }
            finally { if (close) await _connection.CloseAsync(); }
        }

        private async Task<int> GetBookIdByTitle(string title)
        {
            bool close = false; if (_connection.State != ConnectionState.Open) { await _connection.OpenAsync(); close = true; }
            try
            {
                using var cmd = new MySqlCommand("SELECT BookID FROM LogBook WHERE BookTitle = @t AND Availability = 'Available' LIMIT 1", _connection); cmd.Parameters.AddWithValue("@t", title);
                var res = await cmd.ExecuteScalarAsync(); return res != null ? Convert.ToInt32(res) : 0;
            }
            finally { if (close) await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateBorrowedBook(int loanId, string borrowerName, string bookTitle, DateTime borrowDate, string bookStatus)
        {
            try
            {
                int bId = await GetOrCreateBorrower(borrowerName, "Student");
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using var findBk = new MySqlCommand("SELECT BookID FROM LogBook WHERE BookTitle = @t LIMIT 1", _connection);
                findBk.Parameters.AddWithValue("@t", bookTitle);
                var res = await findBk.ExecuteScalarAsync();
                if (res == null) return Json(new { success = false, error = "Book not found." });

                int bkId = Convert.ToInt32(res);
                DateTime due = borrowDate.AddDays(4);

                using (var cmd = new MySqlCommand("UPDATE Loan SET BookID=@bk, BorrowerID=@br, DateBorrowed=@db, DateDue=@dd, BookStatus=@bs WHERE LoanID=@id", _connection))
                {
                    cmd.Parameters.AddWithValue("@bk", bkId);
                    cmd.Parameters.AddWithValue("@br", bId);
                    cmd.Parameters.AddWithValue("@db", borrowDate);
                    cmd.Parameters.AddWithValue("@dd", due);
                    cmd.Parameters.AddWithValue("@bs", bookStatus ?? "Borrowed");
                    cmd.Parameters.AddWithValue("@id", loanId);
                    await cmd.ExecuteNonQueryAsync();
                }

                if (!string.IsNullOrEmpty(bookStatus))
                {
                    using var lb = new MySqlCommand("UPDATE LogBook SET BookStatus=@s WHERE BookID=@bk", _connection);
                    lb.Parameters.AddWithValue("@s", bookStatus);
                    lb.Parameters.AddWithValue("@bk", bkId);
                    await lb.ExecuteNonQueryAsync();
                }

                using var checkOverdue = new MySqlCommand("SELECT OverdueStatus FROM Loan WHERE LoanID = @id", _connection);
                checkOverdue.Parameters.AddWithValue("@id", loanId);
                if (Convert.ToBoolean(await checkOverdue.ExecuteScalarAsync()))
                {
                    using var fineCmd = new MySqlCommand("INSERT INTO Fine (LoanID, PaymentStatus, FineAmount) VALUES (@id, 'Unpaid', 5) ON DUPLICATE KEY UPDATE LoanID = LoanID", _connection);
                    fineCmd.Parameters.AddWithValue("@id", loanId);
                    await fineCmd.ExecuteNonQueryAsync();
                }

                await UpdateBorrowerName(bId, borrowerName);
                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        private async Task UpdateBorrowerName(int id, string name)
        {
            bool close = false; if (_connection.State != ConnectionState.Open) { await _connection.OpenAsync(); close = true; }
            try { using var cmd = new MySqlCommand("UPDATE Borrower SET BorrowerName=@n WHERE BorrowerID=@id", _connection); cmd.Parameters.AddWithValue("@n", name); cmd.Parameters.AddWithValue("@id", id); await cmd.ExecuteNonQueryAsync(); }
            finally { if (close) await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateDateReturned(int loanId, string dateReturned)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var gBk = new MySqlCommand("SELECT BookID FROM Loan WHERE LoanID = @id", _connection); gBk.Parameters.AddWithValue("@id", loanId);
                int bkId = Convert.ToInt32(await gBk.ExecuteScalarAsync());
                bool isRet = !string.IsNullOrEmpty(dateReturned);
                using (var cmd = new MySqlCommand(isRet ? "UPDATE Loan SET DateReturned=@dr, ReturnStatus='Returned' WHERE LoanID=@id" : "UPDATE Loan SET DateReturned=NULL, ReturnStatus='Not Returned' WHERE LoanID=@id", _connection))
                { cmd.Parameters.AddWithValue("@id", loanId); if (isRet) cmd.Parameters.AddWithValue("@dr", DateTime.Parse(dateReturned)); await cmd.ExecuteNonQueryAsync(); }
                using (var ub = new MySqlCommand("UPDATE LogBook SET Availability=@s WHERE BookID=@bk", _connection)) { ub.Parameters.AddWithValue("@s", isRet ? "Available" : "Borrowed"); ub.Parameters.AddWithValue("@bk", bkId); await ub.ExecuteNonQueryAsync(); }
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
                using var gBk = new MySqlCommand("SELECT BookID FROM Loan WHERE LoanID = @id", _connection); gBk.Parameters.AddWithValue("@id", loanId);
                int bkId = Convert.ToInt32(await gBk.ExecuteScalarAsync());
                using (var cmd = new MySqlCommand("UPDATE Loan SET DateReturned=@dr, ReturnStatus='Returned' WHERE LoanID=@id", _connection)) { cmd.Parameters.AddWithValue("@dr", DateTime.Now); cmd.Parameters.AddWithValue("@id", loanId); await cmd.ExecuteNonQueryAsync(); }
                using (var ub = new MySqlCommand("UPDATE LogBook SET Availability='Available' WHERE BookID=@bk", _connection)) { ub.Parameters.AddWithValue("@bk", bkId); await ub.ExecuteNonQueryAsync(); }
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
                using var gBk = new MySqlCommand("SELECT BookID FROM Loan WHERE LoanID = @id", _connection); gBk.Parameters.AddWithValue("@id", loanId);
                var bkId = await gBk.ExecuteScalarAsync();
                if (bkId != null) { using var rb = new MySqlCommand("UPDATE LogBook SET Availability='Available' WHERE BookID=@bk", _connection); rb.Parameters.AddWithValue("@bk", bkId); await rb.ExecuteNonQueryAsync(); }
                using var cmd = new MySqlCommand("DELETE FROM Loan WHERE LoanID=@id", _connection); cmd.Parameters.AddWithValue("@id", loanId);
                return Json(new { success = await cmd.ExecuteNonQueryAsync() > 0 });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBorrowerSuggestions(string query)
        {
            try { if (_connection.State != ConnectionState.Open) await _connection.OpenAsync(); var sug = new List<string>(); using var cmd = new MySqlCommand("SELECT BorrowerName FROM Borrower WHERE BorrowerName LIKE @q LIMIT 10", _connection); cmd.Parameters.AddWithValue("@q", $"%{query}%"); using var reader = await cmd.ExecuteReaderAsync(); while (await reader.ReadAsync()) sug.Add(reader.GetString("BorrowerName")); return Json(sug); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBookTitleSuggestions(string query)
        {
            try { if (_connection.State != ConnectionState.Open) await _connection.OpenAsync(); var sug = new List<string>(); using var cmd = new MySqlCommand("SELECT BookTitle FROM LogBook WHERE BookTitle LIKE @q AND Availability='Available' LIMIT 10", _connection); cmd.Parameters.AddWithValue("@q", $"%{query}%"); using var reader = await cmd.ExecuteReaderAsync(); while (await reader.ReadAsync()) sug.Add(reader.GetString("BookTitle")); return Json(sug); }
            finally { await _connection.CloseAsync(); }
        }
    }
}