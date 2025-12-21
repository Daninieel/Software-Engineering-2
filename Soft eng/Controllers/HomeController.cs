using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using Microsoft.AspNetCore.Mvc;
using Soft_eng.Models;
using MySql.Data.MySqlClient;             
using Microsoft.Extensions.Configuration; 

namespace Soft_eng.Controllers
{
    public class HomeController : Controller
    {
        private readonly IConfiguration _configuration;

        public HomeController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public IActionResult Addbooks()
        {
            return View();
        }

        public IActionResult Index()
        {
            return View();
        }


        public IActionResult Register()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Register(string fullname, string email, string password, string confirmPassword)
        {
            if (password != confirmPassword)
            {
                ViewBag.Message = "Passwords do not match!";
                return View();
            }

            string connStr = _configuration.GetConnectionString("MySqlConn");

            try
            {
                using (MySqlConnection conn = new MySqlConnection(connStr))
                {
                    conn.Open();
                    string query = "INSERT INTO Register (FullName, Email, Password) VALUES (@FullName, @Email, @Password)";

                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@FullName", fullname);
                        cmd.Parameters.AddWithValue("@Email", email);
                        cmd.Parameters.AddWithValue("@Password", password);

                        cmd.ExecuteNonQuery();
                    }
                }

                // Success!
                return RedirectToAction("Login");
            }
            catch (MySqlException ex)
            {
                ViewBag.Message = "Error: " + ex.Message; 
                return View();
            }
        }

        public IActionResult Login()
        {
            return View();
        }
        public IActionResult ForgotPassword()
        {
            return View();
        }

        [HttpPost]
        public IActionResult ForgotPassword(string email)
        {
            string connStr = _configuration.GetConnectionString("MySqlConn");
            bool emailExists = false;

            using (MySqlConnection conn = new MySqlConnection(connStr))
            {
                conn.Open();
                string query = "SELECT Count(*) FROM Register WHERE Email = @Email";
                using (MySqlCommand cmd = new MySqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@Email", email);
                    int count = Convert.ToInt32(cmd.ExecuteScalar());
                    if (count > 0) emailExists = true;
                }
            }

            if (emailExists)
            {

                string token = Guid.NewGuid().ToString();

                string resetLink = Url.Action("ResetPassword", "Home", new { token = token, email = email }, Request.Scheme);

                SendEmail(email, resetLink);
                ViewBag.Message = "Reset link sent to your email.";
            }
            else
            {
                ViewBag.Message = "Email not found.";
            }

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
            if (newPassword != confirmPassword)
            {
                ViewBag.Message = "Passwords do not match.";
                return View();
            }
            string connStr = _configuration.GetConnectionString("MySqlConn");

            using (MySqlConnection conn = new MySqlConnection(connStr))
            {
                conn.Open();
                string query = "UPDATE Register SET Password = @Password WHERE Email = @Email";

                using (MySqlCommand cmd = new MySqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@Password", newPassword);
                    cmd.Parameters.AddWithValue("@Email", email);
                    cmd.ExecuteNonQuery();
                }
            }

            ViewBag.Message = "Password successfully changed. You can now login.";
            return RedirectToAction("Login");
        }


        private void SendEmail(string userEmail, string link)
        {
            var senderEmail = "markdanielc0502@gmail.com";
            var appPassword = "yfco kddx caaz ulob";

            var smtpClient = new SmtpClient("smtp.gmail.com")
            {
                Port = 587,
                Credentials = new NetworkCredential(senderEmail, appPassword),
                EnableSsl = true,
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail),
                Subject = "Password Reset - Saint Isidore Academy",
                Body = $"<h3>Password Reset Request</h3>" +
                       $"<p>Please click the link below to reset your password:</p>" +
                       $"<br>" +
                       $"<a href='{link}'>Click to Reset Password</a>",
                IsBodyHtml = true,
            };

            mailMessage.To.Add(userEmail);
            smtpClient.Send(mailMessage);
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}