using BCrypt.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using Soft_eng.Services;
using System.Data;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;

namespace Soft_eng.Controllers
{
    public class AccountController : BaseController
    {
        private readonly IConfiguration _configuration;
        private readonly SessionService _sessionService;

        public AccountController(MySqlConnection connection, IConfiguration configuration, SessionService sessionService)
            : base(connection)
        {
            _configuration = configuration;
            _sessionService = sessionService;
        }

        public IActionResult Login() => View();
        public IActionResult LoginAdmin() => View();
        public IActionResult Register() => View();
        public IActionResult RegisterAdmin() => View();
        public IActionResult ForgotPassword() => View();
        public IActionResult ForgotPasswordAdmin() => View();
        public IActionResult VerificationResult() => View();

        public IActionResult ResetPassword(string? token, string? email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View();
        }

        public IActionResult ResetPasswordAdmin(string? token, string? email)
        {
            ViewBag.Token = token;
            ViewBag.Email = email;
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Login(string email, string password)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                ViewBag.ErrorMessage = "Email and password are required.";
                return View();
            }

            string normalizedEmail = email.Trim().ToLower();

            if (normalizedEmail == "admin@sia" && password == "adminsia123")
            {
                var sessionToken = _sessionService.CreateSession("admin@sia");
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "Admin"),
                    new Claim(ClaimTypes.Role, "Admin"),
                    new Claim(ClaimTypes.Email, "admin@sia"),
                    new Claim(ClaimTypes.NameIdentifier, "admin@sia"),
                    new Claim("SessionToken", sessionToken)
                };
                var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity));
                return RedirectToAction("AdminDashboard", "Dashboard");
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using var cmd = new MySqlCommand(
                    "SELECT UserID, FullName, Password, Role, IsEmailVerified FROM Register WHERE Email = @e LIMIT 1",
                    _connection);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);

                using var reader = await cmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    ViewBag.ErrorMessage = "Invalid email or password.";
                    return View();
                }

                bool isEmailVerified = Convert.ToInt16(reader["IsEmailVerified"]) == 1;
                if (!isEmailVerified)
                {
                    ViewBag.ErrorMessage = "Please verify your email before logging in. Check your inbox for the verification link.";
                    return View();
                }

                if (!BCrypt.Net.BCrypt.Verify(password, reader.GetString("Password")))
                {
                    ViewBag.ErrorMessage = "Invalid email or password.";
                    return View();
                }

                string userId = reader["UserID"].ToString()!;
                string fullName = reader.GetString("FullName");
                string role = reader.IsDBNull(reader.GetOrdinal("Role")) ? "Librarian" : reader.GetString("Role");

                var sessionToken = _sessionService.CreateSession(userId);

                var userClaims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, fullName),
                    new Claim(ClaimTypes.Role, role),
                    new Claim(ClaimTypes.Email, normalizedEmail),
                    new Claim(ClaimTypes.NameIdentifier, userId),
                    new Claim("SessionToken", sessionToken)
                };
                var userIdentity = new ClaimsIdentity(userClaims, CookieAuthenticationDefaults.AuthenticationScheme);
                await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(userIdentity));

                return role.Equals("School Admin", StringComparison.OrdinalIgnoreCase)
                    ? RedirectToAction("AdminDashboard", "Dashboard")
                    : RedirectToAction("Dashboard", "Dashboard");
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
        public async Task<IActionResult> Register(Registerdb model)
        {
            ModelState.Remove("ConfirmPassword");

            if (!ModelState.IsValid)
                return View(model);

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string normalizedEmail = model.Email.Trim().ToLower();

                using (var existCmd = new MySqlCommand("SELECT COUNT(1) FROM Register WHERE Email = @e", _connection))
                {
                    existCmd.Parameters.AddWithValue("@e", normalizedEmail);
                    if (Convert.ToInt32(await existCmd.ExecuteScalarAsync()) > 0)
                    {
                        ModelState.AddModelError("Email", "An account with that email already exists.");
                        return View(model);
                    }
                }

                string verificationToken = Guid.NewGuid().ToString();
                DateTime tokenExpiry = DateTime.Now.AddHours(24);
                string hashed = BCrypt.Net.BCrypt.HashPassword(model.Password);

                using var cmd = new MySqlCommand(
                    @"INSERT INTO Register 
                      (FullName, Email, Password, ConfirmPassword, Role, IsEmailVerified, VerificationToken, TokenExpiry, CreatedAt) 
                      VALUES (@n, @e, @p, @c, @role, 0, @token, @expiry, @created)",
                    _connection);

                cmd.Parameters.AddWithValue("@n", model.FullName);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);
                cmd.Parameters.AddWithValue("@p", hashed);
                cmd.Parameters.AddWithValue("@c", hashed);
                cmd.Parameters.AddWithValue("@role", model.Role);
                cmd.Parameters.AddWithValue("@token", verificationToken);
                cmd.Parameters.AddWithValue("@expiry", tokenExpiry);
                cmd.Parameters.AddWithValue("@created", DateTime.Now);
                await cmd.ExecuteNonQueryAsync();

                string? verificationLink = Url.Action("VerifyEmail", "Account",
                    new { token = verificationToken, email = normalizedEmail }, Request.Scheme);

                if (!string.IsNullOrEmpty(verificationLink))
                {
                    try
                    {
                        await SendVerificationEmail(normalizedEmail, verificationLink);
                        ViewBag.SuccessMessage = $"Registration successful! We've sent a verification email to {normalizedEmail}. Please check your inbox and click the verification link to activate your account.";
                    }
                    catch
                    {
                        ModelState.AddModelError("", "Failed to send verification email. Please check if your email address is correct.");
                        using var deleteCmd = new MySqlCommand("DELETE FROM Register WHERE Email = @e AND IsEmailVerified = 0", _connection);
                        deleteCmd.Parameters.AddWithValue("@e", normalizedEmail);
                        await deleteCmd.ExecuteNonQueryAsync();
                        return View(model);
                    }
                }

                ModelState.Clear();
                return View(new Registerdb());
            }
            catch (Exception ex)
            {
                ModelState.AddModelError("", "Registration error: " + ex.Message);
                return View(model);
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        [HttpPost]
        public async Task<IActionResult> Logout()
        {
            try { await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); }
            catch { }
            return RedirectToAction("Login", "Account");
        }

        [HttpGet]
        public async Task<IActionResult> VerifyEmail(string? token, string? email)
        {
            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(email))
            {
                ViewBag.Message = "Invalid verification link.";
                ViewBag.IsSuccess = false;
                return View("VerificationResult");
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string normalizedEmail = email.Trim().ToLower();

                using var cmd = new MySqlCommand(
                    "SELECT VerificationToken, TokenExpiry, IsEmailVerified FROM Register WHERE Email = @e LIMIT 1",
                    _connection);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);
                using var reader = await cmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    ViewBag.Message = "Account not found.";
                    ViewBag.IsSuccess = false;
                    return View("VerificationResult");
                }

                bool isAlreadyVerified = Convert.ToInt16(reader["IsEmailVerified"]) == 1;
                if (isAlreadyVerified)
                {
                    ViewBag.Message = "This email has already been verified. You can now log in to your account.";
                    ViewBag.IsSuccess = true;
                    return View("VerificationResult");
                }

                string storedToken = reader.GetString("VerificationToken");
                DateTime tokenExpiry = SafeGetDateTime(reader, "TokenExpiry") ?? DateTime.MinValue;
                await reader.CloseAsync();

                if (storedToken != token)
                {
                    ViewBag.Message = "Invalid verification token. Please check your email and try again.";
                    ViewBag.IsSuccess = false;
                    return View("VerificationResult");
                }

                if (DateTime.Now > tokenExpiry)
                {
                    ViewBag.Message = "Verification link has expired. Please register again or request a new verification email.";
                    ViewBag.IsSuccess = false;
                    return View("VerificationResult");
                }

                using var updateCmd = new MySqlCommand(
                    "UPDATE Register SET IsEmailVerified = 1, VerificationToken = NULL, TokenExpiry = NULL WHERE Email = @e",
                    _connection);
                updateCmd.Parameters.AddWithValue("@e", normalizedEmail);
                await updateCmd.ExecuteNonQueryAsync();

                ViewBag.Message = "Email verified successfully! Your account is now active. You can log in now.";
                ViewBag.IsSuccess = true;
                return View("VerificationResult");
            }
            catch (Exception ex)
            {
                ViewBag.Message = "Verification error: " + ex.Message;
                ViewBag.IsSuccess = false;
                return View("VerificationResult");
            }
            finally
            {
                await _connection.CloseAsync();
            }
        }

        [HttpPost]
        public async Task<IActionResult> ForgotPassword(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                ViewBag.Message = "Email is required.";
                return View();
            }

            string normalizedEmail = email.Trim().ToLower();

            if (string.Equals(normalizedEmail, "admin@sia", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                    using (var existCmd = new MySqlCommand("SELECT UserID FROM Register WHERE Email = @e LIMIT 1", _connection))
                    {
                        existCmd.Parameters.AddWithValue("@e", normalizedEmail);
                        var result = await existCmd.ExecuteScalarAsync();
                        if (result == null)
                        {
                            ViewBag.Message = "Admin account not found.";
                            return View();
                        }
                    }

                    string token = Guid.NewGuid().ToString();
                    DateTime tokenExpiry = DateTime.Now.AddHours(1);

                    using (var updateCmd = new MySqlCommand(
                        "UPDATE Register SET PasswordResetToken = @token, PasswordResetExpiry = @expiry WHERE Email = @e",
                        _connection))
                    {
                        updateCmd.Parameters.AddWithValue("@token", token);
                        updateCmd.Parameters.AddWithValue("@expiry", tokenExpiry);
                        updateCmd.Parameters.AddWithValue("@e", normalizedEmail);
                        await updateCmd.ExecuteNonQueryAsync();
                    }

                    return RedirectToAction("ResetPasswordAdmin", new { token, email = normalizedEmail });
                }
                catch (Exception ex)
                {
                    ViewBag.Message = "Error occurred: " + ex.Message;
                    return View();
                }
                finally { await _connection.CloseAsync(); }
            }

            var gmailPattern = @"^[a-zA-Z0-9._%+-]+@gmail\.com$";
            if (!System.Text.RegularExpressions.Regex.IsMatch(normalizedEmail, gmailPattern))
            {
                ViewBag.Message = "Please use a valid Gmail address (example@gmail.com).";
                return View();
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using (var existCmd = new MySqlCommand("SELECT IsEmailVerified FROM Register WHERE Email = @e LIMIT 1", _connection))
                {
                    existCmd.Parameters.AddWithValue("@e", normalizedEmail);
                    var result = await existCmd.ExecuteScalarAsync();
                    if (result == null)
                    {
                        ViewBag.Message = "No account found with this email address.";
                        return View();
                    }
                    if (!Convert.ToBoolean(result))
                    {
                        ViewBag.Message = "This email address has not been verified. Please verify your email first.";
                        return View();
                    }
                }

                string token = Guid.NewGuid().ToString();
                DateTime tokenExpiry = DateTime.Now.AddHours(1);

                using (var updateCmd = new MySqlCommand(
                    "UPDATE Register SET PasswordResetToken = @token, PasswordResetExpiry = @expiry WHERE Email = @e",
                    _connection))
                {
                    updateCmd.Parameters.AddWithValue("@token", token);
                    updateCmd.Parameters.AddWithValue("@expiry", tokenExpiry);
                    updateCmd.Parameters.AddWithValue("@e", normalizedEmail);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                string? link = Url.Action("ResetPassword", "Account", new { token, email = normalizedEmail }, Request.Scheme);
                if (!string.IsNullOrEmpty(link))
                    await SendPasswordResetEmail(normalizedEmail, link);

                ViewBag.Message = "Password reset link has been sent to your email. Please check your inbox.";
                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Message = "Error occurred: " + ex.Message;
                return View();
            }
            finally { await _connection.CloseAsync(); }
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
                string normalizedEmail = email.Trim().ToLower();

                using (var checkCmd = new MySqlCommand(
                    "SELECT PasswordResetToken, PasswordResetExpiry FROM Register WHERE Email = @e",
                    _connection))
                {
                    checkCmd.Parameters.AddWithValue("@e", normalizedEmail);
                    using var reader = await checkCmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                    {
                        ViewBag.Message = "Invalid email address.";
                        return View();
                    }

                    string storedToken = reader.IsDBNull(0) ? "" : reader.GetString(0);
                    DateTime? expiry = reader.IsDBNull(1) ? null : SafeGetDateTime(reader, "PasswordResetExpiry");
                    await reader.CloseAsync();

                    if (string.IsNullOrEmpty(storedToken) || storedToken != token)
                    {
                        ViewBag.Message = "Invalid or expired reset link.";
                        return View();
                    }
                    if (expiry.HasValue && DateTime.Now > expiry.Value)
                    {
                        ViewBag.Message = "Reset link has expired. Please request a new one.";
                        return View();
                    }
                }

                string hashed = BCrypt.Net.BCrypt.HashPassword(newPassword);
                using var cmd = new MySqlCommand(
                    "UPDATE Register SET Password = @p, ConfirmPassword = @p, PasswordResetToken = NULL, PasswordResetExpiry = NULL WHERE Email = @e",
                    _connection);
                cmd.Parameters.AddWithValue("@p", hashed);
                cmd.Parameters.AddWithValue("@e", normalizedEmail);

                if (await cmd.ExecuteNonQueryAsync() > 0)
                    return RedirectToAction("Login", "Account");

                ViewBag.Message = "Password reset failed.";
                ViewBag.Token = token;
                ViewBag.Email = email;
                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Message = "Database error: " + ex.Message;
                return View();
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> ResetPasswordAdmin(string? email, string? newPassword, string? confirmPassword, string? token)
        {
            return await ResetPassword(email, newPassword, confirmPassword, token);
        }

        private async Task SendVerificationEmail(string email, string link)
        {
            try
            {
                using var smtp = new SmtpClient(_configuration["EmailSettings:SmtpHost"])
                {
                    Port = int.Parse(_configuration["EmailSettings:SmtpPort"]),
                    Credentials = new NetworkCredential(
                        _configuration["EmailSettings:SenderEmail"],
                        _configuration["EmailSettings:SenderPassword"]),
                    EnableSsl = true,
                    Timeout = 10000
                };

                var msg = new MailMessage
                {
                    From = new MailAddress(_configuration["EmailSettings:SenderEmail"], _configuration["EmailSettings:SenderName"]),
                    Subject = "Verify Your Email - Saint Isidore Academy Library",
                    Body = $@"<html><body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                        <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                            <h2 style='color: #c0392b;'>Welcome to Saint Isidore Academy Library!</h2>
                            <p>Hello,</p>
                            <p>Thank you for registering. Please click the link below to verify your email:</p>
                            <p style='margin: 30px 0;'>
                                <a href='{link}' style='color: #c0392b; text-decoration: underline; font-weight: bold;'>Click here to verify your email address</a>
                            </p>
                            <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
                            <p>If you did not create an account, please ignore this email.</p>
                            <hr style='margin: 30px 0; border: none; border-top: 1px solid #ddd;'>
                            <p style='font-size: 12px; color: #666;'>Saint Isidore Academy Library<br>This is an automated message, please do not reply.</p>
                        </div></body></html>",
                    IsBodyHtml = true
                };
                msg.To.Add(email);
                await smtp.SendMailAsync(msg);
            }
            catch (SmtpException smtpEx)
            {
                throw new Exception("Failed to send verification email. The email address may not exist.", smtpEx);
            }
        }

        private async Task SendPasswordResetEmail(string email, string link)
        {
            using var smtp = new SmtpClient(_configuration["EmailSettings:SmtpHost"])
            {
                Port = int.Parse(_configuration["EmailSettings:SmtpPort"]),
                Credentials = new NetworkCredential(
                    _configuration["EmailSettings:SenderEmail"],
                    _configuration["EmailSettings:SenderPassword"]),
                EnableSsl = true
            };

            var msg = new MailMessage
            {
                From = new MailAddress(_configuration["EmailSettings:SenderEmail"], _configuration["EmailSettings:SenderName"]),
                Subject = "Password Reset Request - Saint Isidore Academy Library",
                Body = $@"<html><body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                        <h2 style='color: #c0392b;'>Password Reset Request</h2>
                        <p>Hello,</p>
                        <p>We received a request to reset your password. <a href='{link}' style='color: #c0392b; text-decoration: underline;'>Click here to reset your password</a>.</p>
                        <p><strong>Note:</strong> This link will expire in 1 hour.</p>
                        <p>If you did not request a password reset, please ignore this email or contact the library administrator.</p>
                        <hr style='margin: 30px 0; border: none; border-top: 1px solid #ddd;'>
                        <p style='font-size: 12px; color: #666;'>Saint Isidore Academy Library<br>This is an automated message, please do not reply.</p>
                    </div></body></html>",
                IsBodyHtml = true
            };
            msg.To.Add(email);
            await smtp.SendMailAsync(msg);
        }
    }
}