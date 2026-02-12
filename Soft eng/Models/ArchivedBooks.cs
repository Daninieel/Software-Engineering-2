using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Soft_eng.Models
{
    public class ArchivedBooks
    {
        [Key]
        public int ArchiveID { get; set; }

        [Required]
        [ForeignKey("Logbook")]
        public int BookID { get; set; }

        [StringLength(255)]
        public string BookTitle { get; set; } = "";

        [StringLength(255)]
        public string Author { get; set; } = "";

        [StringLength(20)]
        public string ISBN { get; set; } = "";

        [StringLength(255)]
        public string Publisher { get; set; } = "";

        [StringLength(100)]
        public string ShelfLocation { get; set; } = "";

        public int TotalCopies { get; set; }

        public DateTime DateArchived { get; set; } = DateTime.Now;

        [StringLength(50)]
        public string ArchiveReason { get; set; } = "";

        // Navigation Property
        public virtual LogBook? Logbook { get; set; }
    }
}