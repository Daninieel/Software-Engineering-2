using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class Borrower
    {
        [Key]
        public int BorrowerID { get; set; }

        [Required]
        [StringLength(50)]
        [Display(Name = "Borrower Name")]
        public string BorrowerName { get; set; }

        [Required]
        [StringLength(50)]
        [Display(Name = "Borrower Type")]
        public string BorrowerType { get; set; }
    }
}