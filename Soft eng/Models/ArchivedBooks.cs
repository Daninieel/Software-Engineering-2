using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class ArchivedBooks
    {
        public int ArchiveID { get; set; }
        public int BookID { get; set; }
        public string BookTitle { get; set; } = "";
        public string Author { get; set; } = "";
        public string ISBN { get; set; } = "";
        public string Publisher { get; set; } = "";
        public string ShelfLocation { get; set; } = "";
        public int TotalCopies { get; set; }
        public DateTime DateArchived { get; set; }
        public string ArchiveReason { get; set; } = "";
    }
}