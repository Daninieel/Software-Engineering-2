using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using BCrypt.Net;

namespace Soft_eng.Controllers
{
    public class HomeController : Controller
    {
        private readonly MySqlConnection _connection;

        public HomeController(MySqlConnection connection)
        {
            _connection = connection;
        }

        public IActionResult Login() => View();
        public IActionResult Register() => View();
        public IActionResult Inventory() => View();
        public IActionResult Addbooks() => View();
        public IActionResult ForgotPassword() => View();
        public IActionResult AdminDashboard() => View();
        public IActionResult RequestedBooks() => View();
        public IActionResult BorrowedBooks() => View();
        public IActionResult Fine() => View();

        public IActionResult LoginAdmin() => View("Login.admin");
        public IActionResult RegisterAdmin() => View("Register.admin");
        public IActionResult InventoryAdmin() => View("InventoryAdmin");
        public IActionResult AddBooksAdmin() => View("AddBooksAdmin");
        public IActionResult ForgotPasswordAdmin() => View("ForgotPasswordAdmin");
        public IActionResult ResetPasswordAdmin(string token, string email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View("ResetPasswordAdmin");
        }
        public IActionResult RequestedBooksAdmin() => View("RequestedBooksAdmin");
        public IActionResult BorrowedBooksAdmin() => View("BorrowedBooksAdmin");
        public IActionResult FineAdmin() => View("FineAdmin");
        public IActionResult AdminDashboardAdmin() => View("AdminDashboard");

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
                await _connection.OpenAsync();
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
                ViewBag.Message = "Email and password are required.";
                return View();
            }

            string normalizedEmail = email.Trim();

            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase) && password == "adminsia123")
            {
                return RedirectToAction("AdminDashboardAdmin");
            }

            try
            {
                await _connection.OpenAsync();
                const string selectSql = "SELECT Password, Role FROM Register WHERE Email = @e LIMIT 1";
                using var cmd = new MySqlCommand(selectSql, _connection);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);
                using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    ViewBag.Message = "User not found.";
                    return View();
                }

                string storedHash = reader.GetString(0);
                string role = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);

                if (!BCrypt.Net.BCrypt.Verify(password, storedHash))
                {
                    ViewBag.Message = "Invalid Email or Password.";
                    return View();
                }

                reader.Close();

                const string updateSql = "UPDATE Register SET IsLoggedIn = 1, LastLoginAt = NOW() WHERE Email = @e";
                using var updateCmd = new MySqlCommand(updateSql, _connection);
                updateCmd.Parameters.AddWithValue("@e", normalizedEmail);
                await updateCmd.ExecuteNonQueryAsync();

                if (string.Equals(role, "School Admin", StringComparison.OrdinalIgnoreCase))
                    return RedirectToAction("AdminDashboardAdmin");
                if (string.Equals(role, "Librarian", StringComparison.OrdinalIgnoreCase))
                    return RedirectToAction("Inventory");

                return RedirectToAction("Index");
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
        public async Task<IActionResult> Logout()
        {
            try
            {
                await _connection.OpenAsync();
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

            try
            {
                await _connection.OpenAsync();
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
                string resetLink = Url.Action("ResetPassword", "Home", new { token, email = normalizedEmail }, Request.Scheme);
                await SendEmail(normalizedEmail, resetLink);
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

        public IActionResult ResetPassword(string token, string email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> ResetPassword(string email, string newPassword, string confirmPassword, string token)
        {
            if (newPassword != confirmPassword)
            {
                ViewBag.Message = "Passwords do not match.";
                ViewBag.Token = token;
                ViewBag.Email = email;
                return View();
            }

            try
            {
                await _connection.OpenAsync();
                string hashed = BCrypt.Net.BCrypt.HashPassword(newPassword);
                const string updateSql = "UPDATE Register SET Password = @p, ConfirmPassword = @p WHERE Email = @e";
                using var cmd = new MySqlCommand(updateSql, _connection);
                cmd.Parameters.AddWithValue("@p", hashed);
                cmd.Parameters.AddWithValue("@e", email);
                await cmd.ExecuteNonQueryAsync();
                return RedirectToAction("Login");
            }
            catch
            {
                return View();
            }
            finally
            {
                await _connection.CloseAsync();
            }
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
            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail),
                Subject = "Password Reset",
                Body = $"<a href='{link}'>Reset Password</a>",
                IsBodyHtml = true,
            };
            mailMessage.To.Add(userEmail);
            await smtpClient.SendMailAsync(mailMessage);
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}