# Archived Books Storage System

## Overview
The Archived Books system is a **storage area for books that can no longer be borrowed**, not a permanent deletion system. It allows librarians to keep records of damaged, lost, or unusable books while removing them from active circulation.

---

## Purpose
- **Preserve Records**: Keep historical records of all books in the system
- **Remove from Circulation**: Mark books that shouldn't be lent to students/faculty
- **Damage/Loss Tracking**: Track books that are damaged, lost, or permanently unusable
- **Easy Retrieval**: Quickly restore books to active status if needed

---

## Key Features

### 1. **View Archived Books**
- Display all archived books with full details
- See ISBN, Title, Author, Shelf Location, and Archive Date
- Status shown as "Archived" badge

### 2. **Search Functionality**
- Real-time search by Title, Author, ISBN, or Shelf Location
- Instantly filter through archived inventory

### 3. **Restore Books**
- One-click restore to active circulation
- Confirmation dialog prevents accidental restoration
- Book immediately becomes available for borrowing again

### 4. **Reasons for Archiving**
Books can be archived for:
- ? **Damaged**: Books too damaged to lend
- ?? **Lost**: Missing from library
- ?? **Outdated**: No longer useful for collection
- ?? **Restricted**: Books restricted from circulation
- ??? **Under Repair**: Temporarily unavailable

---

## User Interface

### Archive View
```
Archived Books
?? Search bar (filter by Title, Author, ISBN)
?? Table showing:
?  ?? Book ID
?  ?? ISBN
?  ?? Title
?  ?? Author
?  ?? Shelf Location
?  ?? Status (Archived Badge)
?  ?? Archive Date
?  ?? Actions (View | Restore)
?? Back to Logbook button
```

---

## Workflow

### 1. **Archiving a Book** (from Logbook)
```
1. Go to Logbook (Inventory)
2. Select a book
3. Click "Archived Books" button
4. Book moves to archived storage
5. Book no longer appears in active inventory
```

### 2. **Viewing Archived Books**
```
1. Click "Archived Books" from sidebar
2. Browse or search for archived books
3. See all details and archive date
4. View book details or restore
```

### 3. **Restoring an Archived Book**
```
1. Find book in Archived Books list
2. Click "Restore" button
3. Confirm restoration
4. Book returns to active circulation
5. Available for borrowing again
```

---

## Database Schema

### Archived Field
```csharp
public class LogBook
{
    public int BookID { get; set; }
    // ... other fields ...
    public bool IsArchived { get; set; }  // New field
    public DateTime? ArchivedDate { get; set; }  // When archived
    public string ArchiveReason { get; set; }  // Why archived (optional)
}
```

### Query Examples
```sql
-- Get all archived books
SELECT * FROM LogBook WHERE IsArchived = 1;

-- Get active books (not archived)
SELECT * FROM LogBook WHERE IsArchived = 0;

-- Get books archived in the last 30 days
SELECT * FROM LogBook 
WHERE IsArchived = 1 
AND ArchivedDate >= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

## Backend Implementation

### Controller Actions Needed

#### 1. ArchivedBooks (GET)
```csharp
[HttpGet]
public async Task<IActionResult> ArchivedBooks(string query = null)
{
    var archivedBooks = await _context.LogBooks
        .Where(b => b.IsArchived)
        .ToListAsync();
    
    if (!string.IsNullOrEmpty(query))
    {
        archivedBooks = archivedBooks
            .Where(b => b.BookTitle.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                       b.Author.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                       b.ISBN.Contains(query))
            .ToList();
    }
    
    return View(archivedBooks);
}
```

#### 2. ArchiveBook (POST)
```csharp
[HttpPost]
public async Task<IActionResult> ArchiveBook(int bookId)
{
    var book = await _context.LogBooks.FindAsync(bookId);
    if (book == null)
        return BadRequest(new { error = "Book not found" });
    
    book.IsArchived = true;
    book.ArchivedDate = DateTime.Now;
    await _context.SaveChangesAsync();
    
    return Ok(new { message = "Book archived successfully" });
}
```

#### 3. RestoreArchivedBook (POST)
```csharp
[HttpPost]
public async Task<IActionResult> RestoreArchivedBook(int bookId)
{
    var book = await _context.LogBooks.FindAsync(bookId);
    if (book == null)
        return BadRequest(new { error = "Book not found" });
    
    book.IsArchived = false;
    book.ArchivedDate = null;
    await _context.SaveChangesAsync();
    
    return Ok(new { message = "Book restored successfully" });
}
```

---

## Important Notes

?? **No Permanent Deletion**
- Archived books are NEVER permanently deleted
- All data is preserved for historical records
- Can always be restored

? **Search Integration**
- Archived books don't appear in regular logbook
- Separate search for archived inventory
- Users can easily find archived books

?? **Restore Anytime**
- Books can be restored at any time
- No waiting period or approval needed
- Instantly returns to active circulation

?? **Reporting**
- Track archive history
- See when books were archived
- Monitor archived inventory trends

---

## Files Created/Modified

### New Files
- ? `Views/Home/ArchivedBooks.cshtml`
- ? `wwwroot/css/archived-books.css`
- ? `wwwroot/js/archived-books.js`

### Modified Files
- ? `Views/Home/Inventory.cshtml` - Added archive button
- ? `wwwroot/js/inventory.js` - Added archive functionality
- ? `wwwroot/css/inventory.admin.css` - Added purple button styling

---

## Future Enhancements

### 1. Archive Reasons
- Dropdown menu to select why book is archived
- Store reason in database
- Filter by archive reason

### 2. Archive Notes
- Add notes field when archiving
- Track condition of book
- Staff comments

### 3. Archive Statistics
- Dashboard showing archived count
- Archive trends over time
- Most archived book reasons

### 4. Batch Operations
- Archive multiple books at once
- Bulk restore archived books
- Export archived inventory

### 5. Archive Schedule
- Auto-archive damaged books after repair period
- Scheduled archive reviews
- Reminder for old archived books

---

## Summary

The Archived Books system provides a **non-destructive storage solution** for books that can no longer be borrowed. It maintains complete records while removing items from active circulation, allowing librarians to manage their inventory more effectively while preserving all historical data.
