using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using Microsoft.AspNetCore.Mvc;
using Soft_eng.Models;

namespace Soft_eng.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult VerifyCode()
        {
            return View();
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
            string token = Guid.NewGuid().ToString();

            string resetLink = Url.Action("ResetPassword", "Home", new { token = token }, Request.Scheme);

            SendEmail(email, resetLink);

            ViewBag.Message = "If this email exists, a reset link has been sent.";
            return View();
        }

        public IActionResult ResetPassword(string token)
        {
            ViewBag.Token = token;
            return View();
        }

        [HttpPost]
        public IActionResult ResetPassword(string token, string newPassword, string confirmPassword)
        {
            if (newPassword != confirmPassword)
            {
                ViewBag.Message = "Passwords do not match.";
                ViewBag.Token = token;
                return View();
            }

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