using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;
using System.Diagnostics;
using System.Net;
using System.Net.Mail;

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
        public IActionResult Dashboard() => View();
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
                ViewBag.ErrorMessage = "Email and password are required.";
                return View();
            }

            string normalizedEmail = email.Trim();

            // Hardcoded admin login
            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase)
                && password == "adminsia123")
            {
                return RedirectToAction("AdminDashboardAdmin");
            }

            try
            {
                await _connection.OpenAsync();

                const string sql = "SELECT Password, Role FROM Register WHERE Email = @e LIMIT 1";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);

                using var reader = await cmd.ExecuteReaderAsync();

                // ? Email not found OR password incorrect
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
                    ? RedirectToAction("AdminDashboardAdmin")
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
            // 1. Validation: Check if passwords match
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

                // 2. Security: Hash the new password before saving
                string hashed = BCrypt.Net.BCrypt.HashPassword(newPassword);

                // 3. Database Update: Use parameterized query to prevent SQL injection
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
    }
}