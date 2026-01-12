using System;
using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class Loan
    {
        [Key]
        public int LoanID { get; set; }

        [Required]
        [Display(Name = "Book ID")]
        public int BookID { get; set; }

        [Required]
        [Display(Name = "Borrower ID")]
        public int BorrowerID { get; set; }

        [Display(Name = "Borrower Name")]
        public string? BorrowerName { get; set; }

        [Display(Name = "Book Title")]
        public string? BookTitle { get; set; }

        [Required]
        [DataType(DataType.Date)]
        [Display(Name = "Date Borrowed")]
        public DateTime DateBorrowed { get; set; }

        [Required]
        [DataType(DataType.Date)]
        [Display(Name = "Date Due")]
        public DateTime DateDue { get; set; }

        [DataType(DataType.Date)]
        [Display(Name = "Date Returned")]
        public DateTime? DateReturned { get; set; }

        [Display(Name = "Return Status")]
        public string? ReturnStatus { get; set; }

        [Display(Name = "Overdue Status")]
        public bool OverdueStatus { get; set; }

        [Display(Name = "Fine Amount")]
        public decimal? FineAmount { get; set; }

        // Navigation properties for joins
        public virtual LogBook? Book { get; set; }
        public virtual Borrower? Borrower { get; set; }
    }
}