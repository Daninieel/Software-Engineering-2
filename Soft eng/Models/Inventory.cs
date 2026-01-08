using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class Inventory
    {
        [Key]
        public int BookID { get; set; }
        public string ISBN { get; set; }
        public string? SourceType { get; set; }
        public string BookTitle { get; set; }
        public DateTime? DateReceived { get; set; }
        public string? Author { get; set; }
        public int? Pages { get; set; }
        public string? Edition { get; set; }
        public string? Publisher { get; set; }
        public DateTime? Year { get; set; }
        public string? Remarks { get; set; }
        public string? ShelfLocation { get; set; }
        public string? Availability { get; set; }
        public int TotalCopies { get; set; } = 1;
        public string? BookStatus { get; set; }
    }
}