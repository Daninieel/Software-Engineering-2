using System;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Soft_eng.Models
{
    public class Inventory
    {
        [Key]
        public int BookID { get; set; }

        [Required]
        [RegularExpression(@"^\d{13}$", ErrorMessage = "ISBN must be exactly 13 digits.")]
        public string ISBN { get; set; }

        [Required]
        public string? SourceType { get; set; }

        [Required]
        public string BookTitle { get; set; }

        [Required(ErrorMessage = "Date Received is required.")]
        [DataType(DataType.Date)]
        public DateTime? DateReceived { get; set; }

        public string? Author { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Pages must be greater than 0.")]
        public int? Pages { get; set; }

        [Required]
        [RegularExpression(@"^[0-9]+(st|nd|rd|th)\/[0-9]{4}$",
            ErrorMessage = "Edition must follow format like 2nd/2019.")]
        public string? Edition { get; set; }

        public string? Publisher { get; set; }

        [Required(ErrorMessage = "Published year is required.")]
        [DataType(DataType.Date)]
        public DateTime? Year { get; set; }

        public string? Remarks { get; set; }

        public string? ShelfLocation { get; set; }

        public string? Availability { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Total copies must be at least 1.")]
        public int TotalCopies { get; set; } = 1;

        [Required]
        [RegularExpression(@"^(Available|Unavailable|Damaged|Lost)$",
            ErrorMessage = "Invalid book status.")]
        public string? BookStatus { get; set; }

        // ?? Custom validation: DateReceived must not be before Year
        public bool IsDateValid()
        {
            if (Year.HasValue && DateReceived.HasValue)
            {
                return DateReceived.Value.Year >= Year.Value.Year;
            }
            return true;
        }
    }
}
