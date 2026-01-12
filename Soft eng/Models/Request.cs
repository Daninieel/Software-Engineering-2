using System;
using System.ComponentModel.DataAnnotations;

namespace Soft_eng.Models
{
    public class Request
    {
        [Key]
        public int RequestID { get; set; }

        [Required]
        public string RequesterName { get; set; } = string.Empty;

        [Required]
        public string RequestedTitle { get; set; } = string.Empty;

        [Required]
        public DateTime DateRequested { get; set; }

        [Required]
        public string Status { get; set; } = "Pending";

        public string? Remarks { get; set; }
    }
}
