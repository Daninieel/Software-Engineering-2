using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;

namespace Soft_eng.Controllers
{
    public class InventoryController : BaseController
    {
        public InventoryController(MySqlConnection connection) : base(connection) { }

        public async Task<IActionResult> Inventory(bool fromAdmin = false)
        {
            List<LogBook> books = new List<LogBook>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using var cmd = new MySqlCommand(@"
                    SELECT BookID, BookTitle, Author, ShelfLocation, Availability, DateReceived, BookStatus
                    FROM Logbook 
                    WHERE (BookStatus NOT IN ('Damaged', 'Missing') OR BookStatus IS NULL)
                      AND TotalCopies > 0
                    ORDER BY BookID DESC", _connection);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    books.Add(new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability"),
                        DateReceived = SafeGetDateTime(reader, "DateReceived")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.FromAdmin = fromAdmin;
            return fromAdmin ? View("InventoryAdmin", books) : View(books);
        }

        public IActionResult InventoryAdmin() => RedirectToAction("Inventory", new { fromAdmin = true });

        public IActionResult Addbooks() => View();
        public IActionResult AddBooksAdmin() => View();

        [HttpPost]
        public async Task<IActionResult> AddBooks(LogBook book, bool fromAdmin = false)
        {
            ModelState.Remove("Edition");

            if (!ModelState.IsValid)
            {
                var errors = string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
                TempData["ErrorMessage"] = $"Validation failed: {errors}";
                return View("Addbooks", book);
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                book.BookStatus = book.BookStatus ?? "Good";
                book.DateReceived = book.DateReceived ?? DateTime.Now;
                book.Availability = (book.BookStatus == "Damaged" || book.BookStatus == "Missing") ? "Not Available" : "Available";

                int numberOfCopies = book.TotalCopies;

                for (int i = 0; i < numberOfCopies; i++)
                {
                    string query = @"INSERT INTO Logbook 
                        (ISBN, SourceType, BookTitle, DateReceived, Author, Pages, Edition, 
                         Publisher, Year, Remarks, ShelfLocation, TotalCopies, BookStatus, Availability)
                        VALUES 
                        (@isbn, @source, @title, @received, @author, @pages, @edition, 
                         @publisher, @year, @remarks, @shelf, 1, @status, @avail)";

                    using var cmd = new MySqlCommand(query, _connection);
                    cmd.Parameters.AddWithValue("@isbn", book.ISBN ?? "");
                    cmd.Parameters.AddWithValue("@source", book.SourceType ?? "");
                    cmd.Parameters.AddWithValue("@title", book.BookTitle ?? "");
                    cmd.Parameters.AddWithValue("@received", book.DateReceived);
                    cmd.Parameters.AddWithValue("@author", book.Author ?? "");
                    cmd.Parameters.AddWithValue("@pages", book.Pages ?? 0);
                    cmd.Parameters.AddWithValue("@edition", book.Edition ?? "");
                    cmd.Parameters.AddWithValue("@publisher", book.Publisher ?? "");
                    cmd.Parameters.AddWithValue("@year", book.Year);
                    cmd.Parameters.AddWithValue("@remarks", book.Remarks ?? "");
                    cmd.Parameters.AddWithValue("@shelf", book.ShelfLocation ?? "");
                    cmd.Parameters.AddWithValue("@status", book.BookStatus);
                    cmd.Parameters.AddWithValue("@avail", book.Availability);
                    await cmd.ExecuteNonQueryAsync();

                    if (book.BookStatus == "Damaged" || book.BookStatus == "Missing")
                    {
                        long newBookId = cmd.LastInsertedId;

                        using var updateCopyCmd = new MySqlCommand("UPDATE Logbook SET TotalCopies = 0 WHERE BookID = @id", _connection);
                        updateCopyCmd.Parameters.AddWithValue("@id", newBookId);
                        await updateCopyCmd.ExecuteNonQueryAsync();

                        using var archiveCmd = new MySqlCommand(@"INSERT INTO ArchivedBooks
                            (BookID, BookTitle, Author, ISBN, Publisher, ShelfLocation, TotalCopies, DateArchived, ArchiveReason)
                            VALUES (@bookId, @title, @author, @isbn, @publisher, @shelf, 1, NOW(), @reason)", _connection);
                        archiveCmd.Parameters.AddWithValue("@bookId", newBookId);
                        archiveCmd.Parameters.AddWithValue("@title", book.BookTitle ?? "");
                        archiveCmd.Parameters.AddWithValue("@author", book.Author ?? "");
                        archiveCmd.Parameters.AddWithValue("@isbn", book.ISBN ?? "");
                        archiveCmd.Parameters.AddWithValue("@publisher", book.Publisher ?? "");
                        archiveCmd.Parameters.AddWithValue("@shelf", book.ShelfLocation ?? "");
                        archiveCmd.Parameters.AddWithValue("@reason", book.BookStatus);
                        await archiveCmd.ExecuteNonQueryAsync();
                    }
                }

                TempData["SuccessMessage"] = $"{numberOfCopies} cop{(numberOfCopies > 1 ? "ies" : "y")} added successfully!";
                return RedirectToAction("Inventory", new { fromAdmin });
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = $"Error adding book: {ex.Message}";
                return View("Addbooks", book);
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> SearchBooks(string query, bool fromAdmin = false)
        {
            List<LogBook> results = new List<LogBook>();
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                    return RedirectToAction("Inventory", new { fromAdmin });

                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string sqlQuery = @"
                    SELECT BookID, BookTitle, Author, ShelfLocation, Availability, DateReceived 
                    FROM Logbook 
                    WHERE (BookID LIKE @q OR BookTitle LIKE @q OR Author LIKE @q OR ShelfLocation LIKE @q OR ISBN LIKE @q OR Publisher LIKE @q)
                      AND (BookStatus NOT IN ('Damaged', 'Missing') OR BookStatus IS NULL)
                      AND TotalCopies > 0
                    ORDER BY BookID DESC";

                using var cmd = new MySqlCommand(sqlQuery, _connection);
                cmd.Parameters.AddWithValue("@q", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability"),
                        DateReceived = SafeGetDateTime(reader, "DateReceived")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.SearchQuery = query;
            ViewBag.FromAdmin = fromAdmin;
            return fromAdmin ? View("InventoryAdmin", results) : View("Inventory", results);
        }

        public async Task<IActionResult> EditBook(int id, bool fromAdmin = false)
        {
            LogBook? book = null;
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT * FROM Logbook WHERE BookID = @id", _connection);
                cmd.Parameters.AddWithValue("@id", id);
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    book = new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        ISBN = reader.GetString("ISBN"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        Pages = reader.IsDBNull("Pages") ? 0 : reader.GetInt32("Pages"),
                        Edition = reader.IsDBNull("Edition") ? "" : reader.GetString("Edition"),
                        Year = SafeGetDateTime(reader, "Year"),
                        Publisher = reader.IsDBNull("Publisher") ? "" : reader.GetString("Publisher"),
                        Remarks = reader.IsDBNull("Remarks") ? "" : reader.GetString("Remarks"),
                        SourceType = reader.IsDBNull("SourceType") ? "" : reader.GetString("SourceType"),
                        DateReceived = SafeGetDateTime(reader, "DateReceived"),
                        BookStatus = reader.IsDBNull("BookStatus") ? "" : reader.GetString("BookStatus"),
                        TotalCopies = reader.GetInt32("TotalCopies"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability")
                    };
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.FromAdmin = fromAdmin;
            return View(book);
        }

        [HttpPost]
        public async Task<IActionResult> EditBook(LogBook book, bool isAdmin = false)
        {
            if (!book.IsDateValid())
                ModelState.AddModelError("DateReceived", "-");

            if (!ModelState.IsValid)
            {
                ViewBag.FromAdmin = isAdmin;
                return View(book);
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string finalBookStatus = book.BookStatus ?? "Good";

                if (finalBookStatus == "Damaged" || finalBookStatus == "Missing")
                {
                    string archiveTitle = "", archiveAuthor = "", archiveIsbn = "", archivePublisher = "", archiveShelf = "";
                    int currentTotalCopies = 0;

                    using (var getBookCmd = new MySqlCommand(
                        "SELECT BookTitle, Author, ISBN, Publisher, ShelfLocation, TotalCopies FROM Logbook WHERE BookID = @bk",
                        _connection))
                    {
                        getBookCmd.Parameters.AddWithValue("@bk", book.BookID);
                        using var bookReader = await getBookCmd.ExecuteReaderAsync();
                        if (await bookReader.ReadAsync())
                        {
                            archiveTitle = bookReader.IsDBNull(0) ? "" : bookReader.GetString("BookTitle");
                            archiveAuthor = bookReader.IsDBNull(1) ? "" : bookReader.GetString("Author");
                            archiveIsbn = bookReader.IsDBNull(2) ? "" : bookReader.GetString("ISBN");
                            archivePublisher = bookReader.IsDBNull(3) ? "" : bookReader.GetString("Publisher");
                            archiveShelf = bookReader.IsDBNull(4) ? "" : bookReader.GetString("ShelfLocation");
                            currentTotalCopies = bookReader.GetInt32("TotalCopies");
                        }
                    }

                    using (var archiveCmd = new MySqlCommand(@"
                        INSERT INTO ArchivedBooks (BookID, BookTitle, Author, ISBN, Publisher, ShelfLocation, TotalCopies, DateArchived, ArchiveReason)
                        VALUES (@bookId, @title, @author, @isbn, @publisher, @shelf, @copies, NOW(), @reason)
                        ON DUPLICATE KEY UPDATE TotalCopies = @copies, DateArchived = NOW(), ArchiveReason = @reason",
                        _connection))
                    {
                        archiveCmd.Parameters.AddWithValue("@bookId", book.BookID);
                        archiveCmd.Parameters.AddWithValue("@title", archiveTitle);
                        archiveCmd.Parameters.AddWithValue("@author", archiveAuthor);
                        archiveCmd.Parameters.AddWithValue("@isbn", archiveIsbn);
                        archiveCmd.Parameters.AddWithValue("@publisher", archivePublisher);
                        archiveCmd.Parameters.AddWithValue("@shelf", archiveShelf);
                        archiveCmd.Parameters.AddWithValue("@copies", currentTotalCopies);
                        archiveCmd.Parameters.AddWithValue("@reason", finalBookStatus);
                        await archiveCmd.ExecuteNonQueryAsync();
                    }

                    using (var updateCmd = new MySqlCommand(@"
                        UPDATE Logbook SET BookStatus = @status, Availability = 'Not Available', TotalCopies = 0
                        WHERE BookID = @id", _connection))
                    {
                        updateCmd.Parameters.AddWithValue("@status", finalBookStatus);
                        updateCmd.Parameters.AddWithValue("@id", book.BookID);
                        await updateCmd.ExecuteNonQueryAsync();
                    }

                    return isAdmin ? RedirectToAction("InventoryAdmin") : RedirectToAction("Inventory");
                }

                // Normal Good/Available update
                int currentBorrowedCount = 0;
                using (var countCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM loan WHERE BookID = @bookId AND (ReturnStatus IS NULL OR ReturnStatus != 'Returned')",
                    _connection))
                {
                    countCmd.Parameters.AddWithValue("@bookId", book.BookID);
                    var result = await countCmd.ExecuteScalarAsync();
                    currentBorrowedCount = result != null ? Convert.ToInt32(result) : 0;
                }

                if (book.TotalCopies <= 0) book.TotalCopies = 1;
                string finalAvailability = (book.TotalCopies > currentBorrowedCount) ? "Available" : "Not Available";
                finalBookStatus = "Good";

                using (var cmd = new MySqlCommand(@"
                    UPDATE Logbook 
                    SET ISBN=@isbn, SourceType=@source, BookTitle=@title, DateReceived=@received, Author=@author, 
                        Pages=@pages, Edition=@edition, Publisher=@pub, Year=@year, Remarks=@rem, 
                        ShelfLocation=@shelf, TotalCopies=@total, BookStatus=@status, Availability=@avail 
                    WHERE BookID=@id", _connection))
                {
                    cmd.Parameters.AddWithValue("@id", book.BookID);
                    cmd.Parameters.AddWithValue("@isbn", book.ISBN ?? "");
                    cmd.Parameters.AddWithValue("@source", book.SourceType ?? "");
                    cmd.Parameters.AddWithValue("@title", book.BookTitle ?? "");
                    cmd.Parameters.AddWithValue("@received", book.DateReceived ?? DateTime.Now);
                    cmd.Parameters.AddWithValue("@author", book.Author ?? "");
                    cmd.Parameters.AddWithValue("@pages", book.Pages ?? 0);
                    cmd.Parameters.AddWithValue("@edition", book.Edition ?? "");
                    cmd.Parameters.AddWithValue("@pub", book.Publisher ?? "");
                    cmd.Parameters.AddWithValue("@year", book.Year);
                    cmd.Parameters.AddWithValue("@rem", book.Remarks ?? "");
                    cmd.Parameters.AddWithValue("@shelf", book.ShelfLocation ?? "");
                    cmd.Parameters.AddWithValue("@total", book.TotalCopies);
                    cmd.Parameters.AddWithValue("@status", finalBookStatus);
                    cmd.Parameters.AddWithValue("@avail", finalAvailability);
                    await cmd.ExecuteNonQueryAsync();
                }

                using var removeArchiveCmd = new MySqlCommand("DELETE FROM ArchivedBooks WHERE BookID = @bk", _connection);
                removeArchiveCmd.Parameters.AddWithValue("@bk", book.BookID);
                await removeArchiveCmd.ExecuteNonQueryAsync();

                return isAdmin ? RedirectToAction("InventoryAdmin") : RedirectToAction("Inventory");
            }
            finally { await _connection.CloseAsync(); }
        }

        public async Task<IActionResult> BookDetails(int id, bool fromAdmin = false)
        {
            LogBook? book = null;
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand("SELECT * FROM Logbook WHERE BookID = @id", _connection);
                cmd.Parameters.AddWithValue("@id", id);
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    book = new LogBook
                    {
                        BookID = reader.GetInt32("BookID"),
                        ISBN = reader.GetString("ISBN"),
                        BookTitle = reader.GetString("BookTitle"),
                        Author = reader.IsDBNull("Author") ? "" : reader.GetString("Author"),
                        Pages = reader.IsDBNull("Pages") ? 0 : reader.GetInt32("Pages"),
                        Edition = reader.IsDBNull("Edition") ? "" : reader.GetString("Edition"),
                        Year = SafeGetDateTime(reader, "Year"),
                        Publisher = reader.IsDBNull("Publisher") ? "" : reader.GetString("Publisher"),
                        Remarks = reader.IsDBNull("Remarks") ? "" : reader.GetString("Remarks"),
                        SourceType = reader.IsDBNull("SourceType") ? "" : reader.GetString("SourceType"),
                        DateReceived = SafeGetDateTime(reader, "DateReceived"),
                        BookStatus = reader.IsDBNull("BookStatus") ? "" : reader.GetString("BookStatus"),
                        TotalCopies = reader.GetInt32("TotalCopies"),
                        ShelfLocation = reader.IsDBNull("ShelfLocation") ? "" : reader.GetString("ShelfLocation"),
                        Availability = reader.IsDBNull("Availability") ? "" : reader.GetString("Availability")
                    };
                }
            }
            finally { await _connection.CloseAsync(); }

            ViewBag.FromAdmin = fromAdmin;
            return View(book);
        }

        [HttpGet]
        public async Task<IActionResult> GetInventorySuggestions(string query, string field)
        {
            try
            {
                var allowedFields = new Dictionary<string, string>
                {
                    { "author", "Author" },
                    { "isbn", "ISBN" },
                    { "shelf", "ShelfLocation" },
                    { "title", "BookTitle" }
                };

                if (!allowedFields.ContainsKey(field)) return Json(new List<string>());

                string selectField = allowedFields[field];
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                var suggestions = new List<string>();
                using var cmd = new MySqlCommand(
                    $"SELECT DISTINCT {selectField} FROM Logbook WHERE {selectField} LIKE @q AND {selectField} IS NOT NULL AND {selectField} != '' LIMIT 10",
                    _connection);
                cmd.Parameters.AddWithValue("@q", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    string value = reader.GetString(0);
                    if (!string.IsNullOrWhiteSpace(value)) suggestions.Add(value);
                }
                return Json(suggestions);
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetArchivedBooks()
        {
            var archived = new List<object>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand(@"
                    SELECT ArchiveID, BookID, BookTitle, Author, ISBN,
                           Publisher, ShelfLocation, TotalCopies, DateArchived, ArchiveReason
                    FROM ArchivedBooks ORDER BY DateArchived DESC", _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    archived.Add(new
                    {
                        archiveID = reader.GetInt32("ArchiveID"),
                        bookID = reader.GetInt32("BookID"),
                        bookTitle = reader.GetString("BookTitle"),
                        author = reader.IsDBNull(reader.GetOrdinal("Author")) ? "" : reader.GetString("Author"),
                        isbn = reader.IsDBNull(reader.GetOrdinal("ISBN")) ? "" : reader.GetString("ISBN"),
                        publisher = reader.IsDBNull(reader.GetOrdinal("Publisher")) ? "" : reader.GetString("Publisher"),
                        shelfLocation = reader.IsDBNull(reader.GetOrdinal("ShelfLocation")) ? "" : reader.GetString("ShelfLocation"),
                        totalCopies = reader.GetInt32("TotalCopies"),
                        dateArchived = SafeGetDateTime(reader, "DateArchived")?.ToString("MM/dd/yyyy") ?? "-",
                        archiveReason = reader.GetString("ArchiveReason")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }
            return Json(archived);
        }

        public IActionResult ArchivedBooks() => View();
        public IActionResult ArchivedBooksAdmin() => View();

        [HttpPost]
        public async Task<IActionResult> RestoreArchivedBook(int archiveId)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                int bookId = 0, archivedCopies = 0;
                using (var getCmd = new MySqlCommand("SELECT BookID, TotalCopies FROM ArchivedBooks WHERE ArchiveID = @id", _connection))
                {
                    getCmd.Parameters.AddWithValue("@id", archiveId);
                    using var reader = await getCmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync()) return Json(new { success = false, error = "Archive not found." });
                    bookId = reader.GetInt32("BookID");
                    archivedCopies = reader.GetInt32("TotalCopies");
                }

                int borrowedCount = 0;
                using (var countCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM loan WHERE BookID = @bookId AND (ReturnStatus IS NULL OR ReturnStatus != 'Returned')",
                    _connection))
                {
                    countCmd.Parameters.AddWithValue("@bookId", bookId);
                    var result = await countCmd.ExecuteScalarAsync();
                    borrowedCount = result != null ? Convert.ToInt32(result) : 0;
                }

                using (var restoreCmd = new MySqlCommand(@"
                    UPDATE Logbook
                    SET BookStatus = CASE WHEN TotalCopies + @copies > 0 THEN 'Good' ELSE BookStatus END, 
                        Availability = CASE WHEN TotalCopies + @copies > @borrowed THEN 'Available' ELSE 'Not Available' END,
                        TotalCopies = TotalCopies + @copies
                    WHERE BookID = @bk", _connection))
                {
                    restoreCmd.Parameters.AddWithValue("@bk", bookId);
                    restoreCmd.Parameters.AddWithValue("@borrowed", borrowedCount);
                    restoreCmd.Parameters.AddWithValue("@copies", archivedCopies);
                    await restoreCmd.ExecuteNonQueryAsync();
                }

                using (var deleteCmd = new MySqlCommand("DELETE FROM ArchivedBooks WHERE ArchiveID = @id", _connection))
                {
                    deleteCmd.Parameters.AddWithValue("@id", archiveId);
                    await deleteCmd.ExecuteNonQueryAsync();
                }

                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }
    }
}