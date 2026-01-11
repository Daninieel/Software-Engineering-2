using System;
using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class BorrowedBooks
    {
        [Key]
        public int LoanID { get; set; }

        [Required]
        [Display(Name = "Borrower Name")]
        public string BorrowerName { get; set; }

        [Required]
        [Display(Name = "Book Title")]
        public string BookTitle { get; set; }

        [Required]
        [DataType(DataType.Date)]
        public DateTime BorrowDate { get; set; }

        [DataType(DataType.Date)]
        public DateTime DueDate { get; set; }

        [DataType(DataType.Date)]
        public DateTime? DateReturned { get; set; }

        public string OverdueStatus { get; set; }
    }
}