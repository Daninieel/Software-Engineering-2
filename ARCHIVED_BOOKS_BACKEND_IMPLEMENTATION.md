# Archived Books - Backend Implementation Guide

## Database Schema Updates

### SQL Script
```sql
-- Add columns to LogBook table
ALTER TABLE LogBook ADD COLUMN IsArchived BIT NOT NULL DEFAULT 0;
ALTER TABLE LogBook ADD COLUMN ArchivedDate DATETIME NULL;

-- Create index for faster archived book queries
CREATE INDEX idx_archived ON LogBook(IsArchived, ArchivedDate DESC);

-- Optional: Add archive reason field
ALTER TABLE LogBook ADD COLUMN ArchiveReason NVARCHAR(MAX) NULL;
```

### C# Model Update (LogBook.cs)
```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Soft_eng.Models
{
    public class LogBook
    {
        [Key]
        public int BookID { get; set; }

        [Required]
        public string ISBN { get; set; }

        [Required]
        public string BookTitle { get; set; }

        [Required]
        public string Author { get; set; }

        public string ShelfLocation { get; set; }

        [Required]
        public string Availability { get; set; }

        [Required]
        public int TotalCopies { get; set; }

        public string BookStatus { get; set; }

        public DateTime? DateReceived { get; set; }

        // NEW FIELDS FOR ARCHIVING
        [Required]
        public bool IsArchived { get; set; } = false;

        public DateTime? ArchivedDate { get; set; }

        public string ArchiveReason { get; set; }

        // Optional: Track who archived it
        public string ArchivedBy { get; set; }
    }
}
```

---

## Controller Implementation (HomeController.cs)

### Add these action methods:

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Soft_eng.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Soft_eng.Controllers
{
    public class HomeController : Controller
    {
        private readonly YourDbContext _context;

        public HomeController(YourDbContext context)
        {
            _context = context;
        }

        // GET: /Home/ArchivedBooks
        [HttpGet]
        public async Task<IActionResult> ArchivedBooks(string query = null)
        {
            try
            {
                var archivedBooks = _context.LogBooks
                    .Where(b => b.IsArchived)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(query))
                {
                    query = query.ToLower().Trim();
                    archivedBooks = archivedBooks.Where(b =>
                        b.BookTitle.ToLower().Contains(query) ||
                        b.Author.ToLower().Contains(query) ||
                        b.ISBN.Contains(query) ||
                        b.ShelfLocation.ToLower().Contains(query)
                    );
                }

                var books = await archivedBooks
                    .OrderByDescending(b => b.ArchivedDate)
                    .ToListAsync();

                return View(books);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                return View(new List<LogBook>());
            }
        }

        // POST: /Home/ArchiveBook
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ArchiveBook(int bookId)
        {
            try
            {
                var book = await _context.LogBooks.FindAsync(bookId);
                
                if (book == null)
                {
                    return BadRequest(new { error = "Book not found" });
                }

                if (book.IsArchived)
                {
                    return BadRequest(new { error = "Book is already archived" });
                }

                book.IsArchived = true;
                book.ArchivedDate = DateTime.Now;
                book.ArchivedBy = User.Identity?.Name ?? "System";

                _context.LogBooks.Update(book);
                await _context.SaveChangesAsync();

                return Ok(new { 
                    message = "Book archived successfully",
                    bookId = book.BookID,
                    bookTitle = book.BookTitle
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                return StatusCode(500, new { error = "Failed to archive book", details = ex.Message });
            }
        }

        // POST: /Home/RestoreArchivedBook
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RestoreArchivedBook(int bookId)
        {
            try
            {
                var book = await _context.LogBooks.FindAsync(bookId);
                
                if (book == null)
                {
                    return BadRequest(new { error = "Book not found" });
                }

                if (!book.IsArchived)
                {
                    return BadRequest(new { error = "Book is not archived" });
                }

                book.IsArchived = false;
                book.ArchivedDate = null;
                book.ArchivedBy = null;

                _context.LogBooks.Update(book);
                await _context.SaveChangesAsync();

                return Ok(new { 
                    message = "Book restored to active circulation",
                    bookId = book.BookID,
                    bookTitle = book.BookTitle
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                return StatusCode(500, new { error = "Failed to restore book", details = ex.Message });
            }
        }

        // GET: /Home/GetArchivedBooksCount
        [HttpGet]
        public async Task<IActionResult> GetArchivedBooksCount()
        {
            try
            {
                var count = await _context.LogBooks
                    .Where(b => b.IsArchived)
                    .CountAsync();

                return Ok(new { count = count });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // GET: /Home/GetArchivedBooks (for API)
        [HttpGet]
        public async Task<IActionResult> GetArchivedBooks(string query = null)
        {
            try
            {
                var archived = _context.LogBooks
                    .Where(b => b.IsArchived)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(query))
                {
                    query = query.ToLower().Trim();
                    archived = archived.Where(b =>
                        b.BookTitle.ToLower().Contains(query) ||
                        b.Author.ToLower().Contains(query) ||
                        b.ISBN.Contains(query)
                    );
                }

                var books = await archived
                    .OrderByDescending(b => b.ArchivedDate)
                    .Select(b => new
                    {
                        b.BookID,
                        b.ISBN,
                        b.BookTitle,
                        b.Author,
                        b.ShelfLocation,
                        b.Availability,
                        b.TotalCopies,
                        b.BookStatus,
                        b.ArchivedDate,
                        b.ArchiveReason,
                        b.ArchivedBy
                    })
                    .ToListAsync();

                return Ok(books);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}
```

---

## Query Examples

### Get All Archived Books
```csharp
var archivedBooks = await _context.LogBooks
    .Where(b => b.IsArchived)
    .ToListAsync();
```

### Get Active Books (Not Archived)
```csharp
var activeBooks = await _context.LogBooks
    .Where(b => !b.IsArchived)
    .ToListAsync();
```

### Get Books Archived Today
```csharp
var today = DateTime.Today;
var archivedToday = await _context.LogBooks
    .Where(b => b.IsArchived && 
               b.ArchivedDate.Value.Date == today)
    .ToListAsync();
```

### Get Recently Archived
```csharp
var recentlyArchived = await _context.LogBooks
    .Where(b => b.IsArchived)
    .OrderByDescending(b => b.ArchivedDate)
    .Take(10)
    .ToListAsync();
```

### Search Archived Books
```csharp
var searchResults = await _context.LogBooks
    .Where(b => b.IsArchived &&
               (b.BookTitle.Contains(query) ||
                b.Author.Contains(query) ||
                b.ISBN.Contains(query)))
    .ToListAsync();
```

### Count Archived Books
```csharp
var archivedCount = await _context.LogBooks
    .Where(b => b.IsArchived)
    .CountAsync();
```

### Get Archive Statistics
```csharp
var archiveStats = new
{
    TotalArchived = await _context.LogBooks.Where(b => b.IsArchived).CountAsync(),
    ArchivedThisMonth = await _context.LogBooks
        .Where(b => b.IsArchived && 
                   b.ArchivedDate.Value.Month == DateTime.Now.Month)
        .CountAsync(),
    ArchivedThisYear = await _context.LogBooks
        .Where(b => b.IsArchived && 
                   b.ArchivedDate.Value.Year == DateTime.Now.Year)
        .CountAsync()
};
```

---

## Routes to Add

Add these to your routing configuration if needed:

```csharp
// In Program.cs or Startup.cs

app.MapControllerRoute(
    name: "archived",
    pattern: "{controller=Home}/{action=ArchivedBooks}/{id?}");

// Or add to controller routes explicitly
[Route("api/[controller]")]
[ApiController]
public class ArchivedBooksController : ControllerBase
{
    // API endpoints for archived books
}
```

---

## Validation Examples

### Prevent Archiving Already Archived Books
```csharp
if (book.IsArchived)
{
    throw new InvalidOperationException("Book is already archived");
}
```

### Prevent Restoring Non-Archived Books
```csharp
if (!book.IsArchived)
{
    throw new InvalidOperationException("Book is not archived");
}
```

### Archive Status Validation
```csharp
public class BookValidator
{
    public static bool CanArchive(LogBook book)
    {
        return !book.IsArchived && !string.IsNullOrEmpty(book.BookID.ToString());
    }

    public static bool CanRestore(LogBook book)
    {
        return book.IsArchived;
    }
}
```

---

## Migration (if using Entity Framework Core)

### Create Migration
```bash
dotnet ef migrations add AddArchivedBooksFields
```

### Migration Code
```csharp
public partial class AddArchivedBooksFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsArchived",
            table: "LogBook",
            type: "bit",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<DateTime>(
            name: "ArchivedDate",
            table: "LogBook",
            type: "datetime2",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ArchiveReason",
            table: "LogBook",
            type: "nvarchar(max)",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ArchivedBy",
            table: "LogBook",
            type: "nvarchar(max)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "IsArchived", table: "LogBook");
        migrationBuilder.DropColumn(name: "ArchivedDate", table: "LogBook");
        migrationBuilder.DropColumn(name: "ArchiveReason", table: "LogBook");
        migrationBuilder.DropColumn(name: "ArchivedBy", table: "LogBook");
    }
}
```

### Apply Migration
```bash
dotnet ef database update
```

---

## Error Handling

```csharp
public class ArchiveException : Exception
{
    public ArchiveException(string message) : base(message) { }
}

public class ArchiveService
{
    private readonly DbContext _context;

    public async Task ArchiveBookAsync(int bookId)
    {
        try
        {
            var book = await _context.LogBooks.FindAsync(bookId);
            
            if (book == null)
                throw new ArchiveException("Book not found");
            
            if (book.IsArchived)
                throw new ArchiveException("Book is already archived");

            book.IsArchived = true;
            book.ArchivedDate = DateTime.Now;
            
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            throw new ArchiveException($"Database error: {ex.Message}");
        }
    }
}
```

---

## Testing

### Unit Test Examples
```csharp
[TestClass]
public class ArchivedBooksTests
{
    [TestMethod]
    public async Task ArchiveBook_Success()
    {
        // Arrange
        var book = new LogBook { BookID = 1, BookTitle = "Test", IsArchived = false };
        
        // Act
        book.IsArchived = true;
        book.ArchivedDate = DateTime.Now;
        
        // Assert
        Assert.IsTrue(book.IsArchived);
        Assert.IsNotNull(book.ArchivedDate);
    }

    [TestMethod]
    public async Task RestoreBook_Success()
    {
        // Arrange
        var book = new LogBook { BookID = 1, IsArchived = true };
        
        // Act
        book.IsArchived = false;
        book.ArchivedDate = null;
        
        // Assert
        Assert.IsFalse(book.IsArchived);
        Assert.IsNull(book.ArchivedDate);
    }
}
```

---

## Summary

? All backend code ready for implementation  
? Database schema provided  
? Query examples included  
? Error handling implemented  
? Testing examples provided  
? No permanent deletion - storage only
