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

        public IActionResult Index() => View();
        public IActionResult Login() => View();
        public IActionResult Register() => View();
        public IActionResult Inventory() => View();
        public IActionResult Addbooks() => View();
        public IActionResult ForgotPassword() => View();
        public IActionResult AdminDashboard() => View();
        public IActionResult RequestedBooks() => View();
        public IActionResult BorrowedBooks () => View();
        public IActionResult Fine () => View();



        [HttpPost]
        public async Task<IActionResult> Register(string fullname, string email, string password, string confirmPassword)
        {
            if (password != confirmPassword) return View();
            string hashedPassword = BCrypt.Net.BCrypt.HashPassword(password);
            try
            {
                await _connection.OpenAsync();
                const string sql = "INSERT INTO Register (FullName, Email, Password, ConfirmPassword, Role, IsLoggedIn) VALUES (@n, @e, @p, @c, 'Librarian', 0)";
                using var cmd = new MySqlCommand(sql, _connection);
                cmd.Parameters.AddWithValue("@n", fullname);
                cmd.Parameters.AddWithValue("@e", email);
                cmd.Parameters.AddWithValue("@p", hashedPassword);
                cmd.Parameters.AddWithValue("@c", hashedPassword);
                await cmd.ExecuteNonQueryAsync();
                return RedirectToAction("Login");
            }
            catch { return View(); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> Login(string email, string password)
        {
            try
            {
                await _connection.OpenAsync();
                const string selectSql = "SELECT Password, Role FROM Register WHERE Email = @e";
                using var cmd = new MySqlCommand(selectSql, _connection);
                cmd.Parameters.AddWithValue("@e", email);
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    string storedHash = reader.GetString(0);
                    string role = reader.GetString(1);
                    if (BCrypt.Net.BCrypt.Verify(password, storedHash))
                    {
                        reader.Close();
                        const string updateSql = "UPDATE Register SET IsLoggedIn = 1, LastLoginAt = NOW() WHERE Email = @e";
                        using var updateCmd = new MySqlCommand(updateSql, _connection);
                        updateCmd.Parameters.AddWithValue("@e", email);
                        await updateCmd.ExecuteNonQueryAsync();
                        return role == "School Admin" ? RedirectToAction("AdminDashboard") : RedirectToAction("Index");
                    }
                }
                ViewBag.Message = "Invalid Email or Password";
                return View();
            }
            catch { return View(); }
            finally { await _connection.CloseAsync(); }
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
            string token = Guid.NewGuid().ToString();
            string resetLink = Url.Action("ResetPassword", "Home", new { token, email }, Request.Scheme);
            try { await SendEmail(email, resetLink); }
            catch { return View(); }
            return View();
        }

        public IActionResult ResetPassword(string token, string email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View();
        }

        [HttpPost]
        public IActionResult ResetPassword(string email, string newPassword, string confirmPassword)
        {
            return (newPassword == confirmPassword) ? RedirectToAction("Login") : View();
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
                Subject = "Password Reset - Saint Isidore Academy",
                Body = $"<a href='{link}'>Click to Reset Password</a>",
                IsBodyHtml = true,
            };
            mailMessage.To.Add(userEmail);
            await smtpClient.SendMailAsync(mailMessage);
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}