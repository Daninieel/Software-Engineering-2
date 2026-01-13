using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Soft_eng.Models
{
    public class Fine
    {
        [Key]
        public int FineID { get; set; }

        [Required]
        public int LoanID { get; set; } // The Foreign Key

        public string PaymentStatus { get; set; } = "Unpaid";
        public decimal FineAmount { get; set; }
        public DateTime? DatePaid { get; set; }
        public decimal totalFineAmount { get; set; }

        [ForeignKey("LoanID")]
        public virtual Loan? Loan { get; set; }
    }
}