using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class Registerdb
    {
        [Key]
        public int UserID { get; set; }

        [Required(ErrorMessage = "Full Name is required")]
        [Display(Name = "Full Name")]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid Email Address")]
        [RegularExpression(@"^[a-zA-Z0-9._%+-]+@gmail\.com$", ErrorMessage = "Only Gmail addresses are allowed")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [DataType(DataType.Password)]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters long")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please confirm your password")]
        [DataType(DataType.Password)]
        [Compare("Password", ErrorMessage = "Passwords do not match")]
        [Display(Name = "Confirm Password")]
        public string ConfirmPassword { get; set; } = string.Empty;

        public string Role { get; set; } = "Librarian";

        public bool IsEmailVerified { get; set; } = false;

        public string? VerificationToken { get; set; }

        public DateTime? TokenExpiry { get; set; }

        public string? PasswordResetToken { get; set; }

        public DateTime? PasswordResetExpiry { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}