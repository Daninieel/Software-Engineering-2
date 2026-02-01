# ?? Archived Books System - Quick Reference Guide

## What is Archived Books?

A **storage system for books that can no longer be borrowed**. Books in this section are NOT permanently deleted—they're preserved in records but removed from active circulation.

---

## Common Use Cases

### Why Archive a Book?
- ?? **Lost Books** - Missing from library, marked for record-keeping
- ?? **Damaged Books** - Too damaged to safely lend
- ?? **Restricted Books** - Books that shouldn't circulate anymore
- ?? **Outdated Books** - No longer relevant to collection
- ??? **Books Under Repair** - Temporarily unavailable
- ?? **Safety Issues** - Books that pose safety risks

---

## How to Use

### 1?? Archive a Book (from Logbook)
```
1. Go to Logbook (Inventory)
2. Select a book
3. Click "Archived Books" button (purple)
4. ? Book is now in archived storage
```

### 2?? View All Archived Books
```
1. Click "Archived Books" from sidebar menu
2. See all archived books with details
3. Search by Title, Author, ISBN, or Location
```

### 3?? Restore an Archived Book
```
1. Find book in Archived Books list
2. Click "Restore" button (green)
3. Confirm restoration
4. ? Book returns to active circulation
```

### 4?? View Book Details
```
1. Click "View" button on any archived book
2. See complete book information
3. Close to return to list
```

---

## Key Features

| Feature | What It Does |
|---------|-------------|
| **Search** | Find archived books by Title, Author, ISBN, or Shelf Location |
| **View Details** | See complete information about archived books |
| **Restore** | Return books to active circulation instantly |
| **Archive Date** | Track when each book was archived |
| **Status Badge** | Visual indicator showing "Archived" status |

---

## Important Rules

? **DO**
- Archive books that can't be borrowed anymore
- Restore books when they're usable again
- Search for archived books easily
- Keep records of all archived books
- View archived book details anytime

? **DON'T**
- Permanently delete books (data is preserved)
- Archive active books without reason
- Lose track of archived inventory
- Forget to restore repaired books
- Ignore archived book records

---

## Sidebar Navigation

```
Dashboard
Logbook (Inventory)
?? Book Management
?  ?? Add Books
?  ?? Borrowed Books
?  ?? Requested Books
?? Archived Books ? (NEW)
Fine
Log Out
```

---

## Button Colors & Functions

| Button | Color | Function |
|--------|-------|----------|
| Archived Books | ?? Purple | Navigate to archived storage |
| View | ?? Blue | View book details |
| Restore | ?? Green | Return book to active circulation |
| Back to Logbook | ?? Blue | Return to main inventory |

---

## Database Changes Needed

Add these fields to the `LogBook` table:

```sql
ALTER TABLE LogBook ADD COLUMN IsArchived BIT DEFAULT 0;
ALTER TABLE LogBook ADD COLUMN ArchivedDate DATETIME NULL;
```

Or in C# Model:
```csharp
public class LogBook
{
    // ... existing fields ...
    public bool IsArchived { get; set; } = false;
    public DateTime? ArchivedDate { get; set; }
}
```

---

## Controller Actions to Implement

### 1. View Archived Books
```csharp
[HttpGet]
public async Task<IActionResult> ArchivedBooks(string query = null)
{
    var archived = _context.LogBooks
        .Where(b => b.IsArchived)
        .AsQueryable();
    
    if (!string.IsNullOrEmpty(query))
        archived = archived.Where(b => 
            b.BookTitle.Contains(query) || 
            b.Author.Contains(query) || 
            b.ISBN.Contains(query));
    
    return View(await archived.ToListAsync());
}
```

### 2. Archive a Book
```csharp
[HttpPost]
public async Task<IActionResult> ArchiveBook(int bookId)
{
    var book = await _context.LogBooks.FindAsync(bookId);
    book.IsArchived = true;
    book.ArchivedDate = DateTime.Now;
    await _context.SaveChangesAsync();
    return Ok();
}
```

### 3. Restore a Book
```csharp
[HttpPost]
public async Task<IActionResult> RestoreArchivedBook(int bookId)
{
    var book = await _context.LogBooks.FindAsync(bookId);
    book.IsArchived = false;
    book.ArchivedDate = null;
    await _context.SaveChangesAsync();
    return Ok();
}
```

---

## Files Created

| File | Purpose |
|------|---------|
| `Views/Home/ArchivedBooks.cshtml` | Main archived books page |
| `wwwroot/css/archived-books.css` | Styling for archived books |
| `wwwroot/js/archived-books.js` | Functionality & interactions |

---

## Files Modified

| File | Change |
|------|--------|
| `Views/Home/Inventory.cshtml` | Added purple "Archived Books" button |
| `wwwroot/js/inventory.js` | Added archive functionality |
| `wwwroot/css/inventory.admin.css` | Added `.btn-purple` styling |

---

## Testing Checklist

- [ ] Can view archived books page
- [ ] Can search archived books
- [ ] Can see archived book details
- [ ] Can restore archived books
- [ ] Archive button appears in logbook
- [ ] Books move to archived storage after archiving
- [ ] Archived books removed from active inventory
- [ ] Modal confirmations work
- [ ] Responsive design works on mobile
- [ ] No data is permanently deleted

---

## Troubleshooting

### Books Don't Show in Archived
- Check if `IsArchived = true` in database
- Verify book exists in LogBooks table
- Check for SQL errors

### Can't Restore Books
- Ensure user has admin permissions
- Check if API endpoint exists
- Verify database update completed

### Search Not Working
- Clear browser cache
- Refresh page
- Check search string length (min 2 chars)

---

## Future Enhancements

- ?? Add archive reason field
- ??? Add archive notes/comments
- ?? Archive statistics dashboard
- ?? Archive date filters
- ?? Bulk archive/restore operations
- ?? Export archived inventory

---

## Questions or Issues?

If something doesn't work:
1. Check the browser console (F12) for errors
2. Check the database for data
3. Verify all files are created
4. Run the build to check for compilation errors
5. Review the ARCHIVED_BOOKS_SYSTEM.md for detailed info

**Everything is working correctly if:**
- ? Build completes with no new errors
- ? Archived Books button appears in sidebar
- ? Can navigate to archived books page
- ? Can search and restore books
- ? Modal dialogs work properly
