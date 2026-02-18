using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;

namespace Soft_eng.Controllers
{
    public class LoanController : BaseController
    {
        public LoanController(MySqlConnection connection) : base(connection) { }

        public IActionResult BorrowedBooks() => View();
        public IActionResult BorrowedBooksAdmin() => View();
        public IActionResult Fine() => View();
        public IActionResult FineAdmin() => View();

        [HttpGet]
        public async Task<IActionResult> GetBorrowedBooks(bool fromAdmin = false)
        {
            var borrowed = new List<object>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string query = @"
                    SELECT 
                        l.LoanID, l.BookID, l.BorrowerID, b.BorrowerName, b.BorrowerType, lb.BookTitle, 
                        l.DateBorrowed, l.DateDue, l.DateReturned, 
                        CASE WHEN l.OverdueStatus = 1 THEN 'Yes' ELSE 'No' END as OverdueStatus, 
                        l.ReturnStatus, l.BookStatus, lb.BookStatus as CurrentBookStatus 
                    FROM Loan l 
                    JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                    JOIN Logbook lb ON l.BookID = lb.BookID 
                    ORDER BY l.LoanID DESC";

                using var cmd = new MySqlCommand(query, _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    borrowed.Add(new
                    {
                        LoanID = reader.GetInt32("LoanID"),
                        BookID = reader.GetInt32("BookID"),
                        BorrowerID = reader.GetInt32("BorrowerID"),
                        BorrowerName = reader.GetString("BorrowerName"),
                        BorrowerType = reader.GetString("BorrowerType"),
                        BookTitle = reader.GetString("BookTitle"),
                        DateBorrowed = SafeGetDateTime(reader, "DateBorrowed")?.ToString("MM/dd/yyyy") ?? "-",
                        BorrowDate = SafeGetDateTime(reader, "DateBorrowed")?.ToString("MM/dd/yyyy") ?? "-",
                        DueDate = SafeGetDateTime(reader, "DateDue")?.ToString("MM/dd/yyyy") ?? "-",
                        DateReturned = SafeGetDateTime(reader, "DateReturned")?.ToString("MM/dd/yyyy") ?? "-",
                        OverdueStatus = reader.GetString("OverdueStatus"),
                        ReturnStatus = reader.IsDBNull("ReturnStatus") ? "Not Returned" : reader.GetString("ReturnStatus"),
                        BookStatus = reader.IsDBNull("CurrentBookStatus")
                            ? (reader.IsDBNull("BookStatus") ? "Good" : reader.GetString("BookStatus"))
                            : reader.GetString("CurrentBookStatus")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }
            return Json(borrowed);
        }

        [HttpPost]
        public async Task<IActionResult> AddBorrowedBook(string borrowerName, string borrowerType, string bookTitle, DateTime borrowDate)
        {
            try
            {
                int bId = await GetOrCreateBorrower(borrowerName, borrowerType);
                int bkId = await GetBookIdByTitle(bookTitle);

                if (bkId == 0)
                {
                    if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                    using var checkCmd = new MySqlCommand("SELECT COUNT(*) FROM Logbook WHERE BookTitle = @t", _connection);
                    checkCmd.Parameters.AddWithValue("@t", bookTitle);
                    long count = Convert.ToInt64(await checkCmd.ExecuteScalarAsync());
                    return count > 0
                        ? Json(new { success = false, error = "Limit reached. Book is unavailable for borrow." })
                        : Json(new { success = false, error = "Book not found." });
                }

                DateTime due = borrowDate.AddDays(4);
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using (var cmd = new MySqlCommand(
                    "INSERT INTO Loan (BookID, BorrowerID, DateBorrowed, DateDue, ReturnStatus, OverdueStatus, BookStatus) VALUES (@bkId, @bId, @db, @dd, 'Not Returned', FALSE, 'Borrowed')",
                    _connection))
                {
                    cmd.Parameters.AddWithValue("@bkId", bkId);
                    cmd.Parameters.AddWithValue("@bId", bId);
                    cmd.Parameters.AddWithValue("@db", borrowDate);
                    cmd.Parameters.AddWithValue("@dd", due);
                    await cmd.ExecuteNonQueryAsync();
                }

                using (var updateCmd = new MySqlCommand("UPDATE Logbook SET Availability = 'Borrowed' WHERE BookID = @bkId", _connection))
                {
                    updateCmd.Parameters.AddWithValue("@bkId", bkId);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                using var idCmd = new MySqlCommand("SELECT LAST_INSERT_ID()", _connection);
                return Json(new { success = true, loanId = await idCmd.ExecuteScalarAsync(), dueDate = due.ToString("MM/dd/yyyy"), borrowerId = bId, bookId = bkId });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateBorrowedBook(
            int loanId,
            string borrowerName,
            string bookTitle,
            DateTime borrowDate,
            string bookStatus,
            decimal? fineAmount,
            string returnStatus = null,
            DateTime? dateReturned = null)
        {
            try
            {
                int bId = await GetOrCreateBorrower(borrowerName, "Student");
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using var getBorrowerType = new MySqlCommand("SELECT BorrowerType FROM Borrower WHERE BorrowerID = @id", _connection);
                getBorrowerType.Parameters.AddWithValue("@id", bId);
                string borrowerType = (await getBorrowerType.ExecuteScalarAsync())?.ToString() ?? "Student";

                if (borrowerType.Trim().ToLower() == "teacher" && returnStatus == "Returned" && !dateReturned.HasValue)
                    return Json(new { success = false, error = "Please provide date returned for the teacher." });

                using var findBk = new MySqlCommand("SELECT BookID FROM Logbook WHERE BookTitle = @t LIMIT 1", _connection);
                findBk.Parameters.AddWithValue("@t", bookTitle);
                var res = await findBk.ExecuteScalarAsync();
                if (res == null) return Json(new { success = false, error = "Book not found." });

                int bkId = Convert.ToInt32(res);
                DateTime due = borrowDate.AddDays(4);

                string overdueFromModal = Request.Form["overdueStatus"];
                bool isOverdue = overdueFromModal == "Yes";
                if (borrowerType.Trim().ToLower() == "teacher") isOverdue = false;

                decimal actualFine = (fineAmount.HasValue && fineAmount.Value > 0)
                ? fineAmount.Value
                : 5.00m;


                string updateQuery = "UPDATE Loan SET BookID=@bk, BorrowerID=@br, DateBorrowed=@db, DateDue=@dd, BookStatus=@bs, OverdueStatus=@os";
                if (!string.IsNullOrEmpty(returnStatus)) updateQuery += ", ReturnStatus=@rs";
                if (dateReturned.HasValue) updateQuery += ", DateReturned=@dr";
                updateQuery += " WHERE LoanID=@id";

                using (var cmd = new MySqlCommand(updateQuery, _connection))
                {
                    cmd.Parameters.AddWithValue("@bk", bkId);
                    cmd.Parameters.AddWithValue("@br", bId);
                    cmd.Parameters.AddWithValue("@db", borrowDate);
                    cmd.Parameters.AddWithValue("@dd", due);
                    cmd.Parameters.AddWithValue("@bs", bookStatus ?? "Borrowed");
                    cmd.Parameters.AddWithValue("@os", isOverdue);
                    if (!string.IsNullOrEmpty(returnStatus)) cmd.Parameters.AddWithValue("@rs", returnStatus);
                    if (dateReturned.HasValue) cmd.Parameters.AddWithValue("@dr", dateReturned.Value);
                    cmd.Parameters.AddWithValue("@id", loanId);
                    await cmd.ExecuteNonQueryAsync();
                }

                if (!string.IsNullOrEmpty(bookStatus) && bookStatus != "Borrowed")
                {
                    using var lb = new MySqlCommand("UPDATE Logbook SET BookStatus=@s WHERE BookID=@bk", _connection);
                    lb.Parameters.AddWithValue("@s", bookStatus);
                    lb.Parameters.AddWithValue("@bk", bkId);
                    await lb.ExecuteNonQueryAsync();

                    if (bookStatus == "Missing" || bookStatus == "Damaged")
                    {
                        using var archiveCmd = new MySqlCommand(@"
                            INSERT INTO ArchivedBooks (BookID, BookTitle, Author, ISBN, Publisher, ShelfLocation, TotalCopies, DateArchived, ArchiveReason)
                            SELECT BookID, BookTitle, Author, ISBN, Publisher, ShelfLocation, 1, NOW(), @reason
                            FROM Logbook WHERE BookID = @bk
                            ON DUPLICATE KEY UPDATE DateArchived = NOW(), ArchiveReason = @reason", _connection);
                        archiveCmd.Parameters.AddWithValue("@bk", bkId);
                        archiveCmd.Parameters.AddWithValue("@reason", bookStatus);
                        await archiveCmd.ExecuteNonQueryAsync();

                        using var decCmd = new MySqlCommand(@"
                            UPDATE Logbook SET TotalCopies = GREATEST(TotalCopies - 1, 0), Availability = 'Not Available'
                            WHERE BookID = @bk", _connection);
                        decCmd.Parameters.AddWithValue("@bk", bkId);
                        await decCmd.ExecuteNonQueryAsync();
                    }
                }

                if (!string.IsNullOrEmpty(returnStatus) && returnStatus == "Returned")
                {
                    string finalStatus = (!string.IsNullOrEmpty(bookStatus) && bookStatus != "Borrowed") ? bookStatus : "Available";

                    if (finalStatus == "Damaged" || finalStatus == "Missing")
                    {
                        using var archiveCmd = new MySqlCommand(@"
                            INSERT INTO ArchivedBooks (BookID, BookTitle, Author, ISBN, Publisher, ShelfLocation, TotalCopies, DateArchived, ArchiveReason)
                            SELECT BookID, BookTitle, Author, ISBN, Publisher, ShelfLocation, 1, NOW(), @reason
                            FROM Logbook WHERE BookID = @bk", _connection);
                        archiveCmd.Parameters.AddWithValue("@bk", bkId);
                        archiveCmd.Parameters.AddWithValue("@reason", finalStatus);
                        await archiveCmd.ExecuteNonQueryAsync();

                        using var decCmd = new MySqlCommand("UPDATE Logbook SET TotalCopies = GREATEST(TotalCopies - 1, 0) WHERE BookID = @bk", _connection);
                        decCmd.Parameters.AddWithValue("@bk", bkId);
                        await decCmd.ExecuteNonQueryAsync();

                        using var reevalCmd = new MySqlCommand(@"
                            UPDATE Logbook
                            SET Availability = CASE WHEN TotalCopies > (SELECT COUNT(*) FROM Loan WHERE BookID = @bk AND (ReturnStatus IS NULL OR ReturnStatus != 'Returned')) THEN 'Available' ELSE 'Not Available' END,
                                BookStatus = CASE WHEN TotalCopies > 0 THEN 'Good' ELSE @reason END
                            WHERE BookID = @bk", _connection);
                        reevalCmd.Parameters.AddWithValue("@bk", bkId);
                        reevalCmd.Parameters.AddWithValue("@reason", finalStatus);
                        await reevalCmd.ExecuteNonQueryAsync();
                    }
                    else
                    {
                        using var updateAvail = new MySqlCommand(@"
                            UPDATE Logbook 
                            SET Availability = CASE WHEN TotalCopies > (SELECT COUNT(*) FROM Loan WHERE BookID = @bk AND (ReturnStatus IS NULL OR ReturnStatus != 'Returned')) THEN 'Available' ELSE 'Not Available' END, 
                                BookStatus='Good' 
                            WHERE BookID=@bk", _connection);
                        updateAvail.Parameters.AddWithValue("@bk", bkId);
                        await updateAvail.ExecuteNonQueryAsync();
                    }
                }

                if (isOverdue && borrowerType.Trim().ToLower() != "teacher")
                {
                    using var fineCmd = new MySqlCommand(@"
        INSERT INTO Fine (LoanID, PaymentStatus, FineAmount, totalFineAmount)
        VALUES (@id, 'Unpaid', @amt, @amt)
        ON DUPLICATE KEY UPDATE
            FineAmount = CASE WHEN PaymentStatus = 'Unpaid' THEN @amt ELSE FineAmount END,
            totalFineAmount = CASE WHEN PaymentStatus = 'Unpaid' THEN @amt ELSE totalFineAmount END",
                        _connection);

                    fineCmd.Parameters.AddWithValue("@id", loanId);
                    fineCmd.Parameters.AddWithValue("@amt", actualFine);
                    await fineCmd.ExecuteNonQueryAsync();
                }


                await UpdateBorrowerName(bId, borrowerName);
                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateOverdueStatus(int loanId, string status)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                bool isOverdue = (status == "Yes");

                string borrowerType = "Student";
                using (var typeCmd = new MySqlCommand(
                    "SELECT b.BorrowerType FROM Loan l JOIN Borrower b ON l.BorrowerID = b.BorrowerID WHERE l.LoanID = @loanId",
                    _connection))
                {
                    typeCmd.Parameters.AddWithValue("@loanId", loanId);
                    var typeResult = await typeCmd.ExecuteScalarAsync();
                    if (typeResult != null) borrowerType = typeResult.ToString();
                }

                if (borrowerType.Trim().ToLower() == "teacher" && isOverdue)
                    return Json(new { success = false, error = "Teachers cannot be marked as overdue or have fines." });

                using (var cmd = new MySqlCommand("UPDATE Loan SET OverdueStatus = @status WHERE LoanID = @loanId", _connection))
                {
                    cmd.Parameters.AddWithValue("@status", isOverdue);
                    cmd.Parameters.AddWithValue("@loanId", loanId);
                    await cmd.ExecuteNonQueryAsync();
                }

                if (isOverdue)
                {
                    using var insCmd = new MySqlCommand(@"
        INSERT INTO Fine (LoanID, PaymentStatus, FineAmount, totalFineAmount)
        SELECT @loanId, 'Unpaid', FineAmount, totalFineAmount
        FROM Fine
        WHERE LoanID = @loanId AND PaymentStatus = 'Unpaid'
        UNION
        SELECT @loanId, 'Unpaid', 5.00, 5.00
        WHERE NOT EXISTS (
            SELECT 1 FROM Fine WHERE LoanID = @loanId AND PaymentStatus = 'Unpaid'
        )", _connection);

                    insCmd.Parameters.AddWithValue("@loanId", loanId);
                    await insCmd.ExecuteNonQueryAsync();
                }
                else
                {
                    using var delCmd = new MySqlCommand("DELETE FROM Fine WHERE LoanID = @loanId AND PaymentStatus = 'Unpaid'", _connection);
                    delCmd.Parameters.AddWithValue("@loanId", loanId);
                    await delCmd.ExecuteNonQueryAsync();
                }

                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateDateReturned(int loanId, string dateReturned)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var gBk = new MySqlCommand("SELECT BookID FROM Loan WHERE LoanID = @id", _connection);
                gBk.Parameters.AddWithValue("@id", loanId);
                int bkId = Convert.ToInt32(await gBk.ExecuteScalarAsync());
                bool isRet = !string.IsNullOrEmpty(dateReturned);

                using (var cmd = new MySqlCommand(isRet
                    ? "UPDATE Loan SET DateReturned=@dr, ReturnStatus='Returned' WHERE LoanID=@id"
                    : "UPDATE Loan SET DateReturned=NULL, ReturnStatus='Not Returned' WHERE LoanID=@id", _connection))
                {
                    cmd.Parameters.AddWithValue("@id", loanId);
                    if (isRet) cmd.Parameters.AddWithValue("@dr", DateTime.Parse(dateReturned));
                    await cmd.ExecuteNonQueryAsync();
                }

                using (var ub = new MySqlCommand("UPDATE Logbook SET Availability=@s WHERE BookID=@bk", _connection))
                {
                    ub.Parameters.AddWithValue("@s", isRet ? "Available" : "Borrowed");
                    ub.Parameters.AddWithValue("@bk", bkId);
                    await ub.ExecuteNonQueryAsync();
                }
                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> MarkAsReturned(int loanId)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var gBk = new MySqlCommand("SELECT BookID FROM Loan WHERE LoanID = @id", _connection);
                gBk.Parameters.AddWithValue("@id", loanId);
                int bkId = Convert.ToInt32(await gBk.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("UPDATE Loan SET DateReturned=@dr, ReturnStatus='Returned' WHERE LoanID=@id", _connection))
                {
                    cmd.Parameters.AddWithValue("@dr", DateTime.Now);
                    cmd.Parameters.AddWithValue("@id", loanId);
                    await cmd.ExecuteNonQueryAsync();
                }
                using (var ub = new MySqlCommand("UPDATE Logbook SET Availability='Available' WHERE BookID=@bk", _connection))
                {
                    ub.Parameters.AddWithValue("@bk", bkId);
                    await ub.ExecuteNonQueryAsync();
                }
                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteBorrowedBook(int loanId)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var gBk = new MySqlCommand("SELECT BookID FROM Loan WHERE LoanID = @id", _connection);
                gBk.Parameters.AddWithValue("@id", loanId);
                var bkId = await gBk.ExecuteScalarAsync();

                if (bkId != null)
                {
                    using var rb = new MySqlCommand("UPDATE Logbook SET Availability='Available' WHERE BookID=@bk", _connection);
                    rb.Parameters.AddWithValue("@bk", bkId);
                    await rb.ExecuteNonQueryAsync();
                }
                using var cmd = new MySqlCommand("DELETE FROM Loan WHERE LoanID=@id", _connection);
                cmd.Parameters.AddWithValue("@id", loanId);
                return Json(new { success = await cmd.ExecuteNonQueryAsync() > 0 });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetFines()
        {
            var fines = new List<object>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                const string sql = @"SELECT f.FineID, f.LoanID, b.BorrowerName, lb.BookTitle, f.PaymentStatus, f.FineAmount, f.DatePaid
                    FROM Fine f 
                    INNER JOIN Loan l ON f.LoanID = l.LoanID 
                    INNER JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                    INNER JOIN Logbook lb ON l.BookID = lb.BookID 
                    ORDER BY f.FineID DESC";
                using var cmd = new MySqlCommand(sql, _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    fines.Add(new
                    {
                        fineID = reader.GetInt32("FineID"),
                        loanID = reader.GetInt32("LoanID"),
                        borrowerName = reader.GetString("BorrowerName"),
                        bookTitle = reader.GetString("BookTitle"),
                        paymentStatus = reader.GetString("PaymentStatus"),
                        fineAmount = reader.GetDecimal("FineAmount"),
                        datePaid = reader.IsDBNull("DatePaid") ? "-" : SafeGetDateTime(reader, "DatePaid")?.ToString("MM/dd/yyyy") ?? "-"
                    });
                }
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
            return Json(fines);
        }

        [HttpPost]
        public async Task<IActionResult> EditFine(Fine fine)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using var cmd = new MySqlCommand(@"
                    UPDATE Fine 
                    SET PaymentStatus = @status, FineAmount = @amount, totalFineAmount = @total, DatePaid = @date 
                    WHERE FineID = @id", _connection);
                cmd.Parameters.AddWithValue("@id", fine.FineID);
                cmd.Parameters.AddWithValue("@status", fine.PaymentStatus);
                cmd.Parameters.AddWithValue("@amount", fine.FineAmount);
                cmd.Parameters.AddWithValue("@total", fine.totalFineAmount);

                if (fine.DatePaid.HasValue && fine.DatePaid != DateTime.MinValue)
                    cmd.Parameters.AddWithValue("@date", fine.DatePaid.Value);
                else
                    cmd.Parameters.AddWithValue("@date", DBNull.Value);

                await cmd.ExecuteNonQueryAsync();
                return Json(new { success = true });
            }
            catch (Exception ex) { return Json(new { success = false, error = ex.Message }); }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBorrowerSuggestions(string query)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                var sug = new List<string>();
                using var cmd = new MySqlCommand("SELECT BorrowerName FROM Borrower WHERE BorrowerName LIKE @q LIMIT 10", _connection);
                cmd.Parameters.AddWithValue("@q", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) sug.Add(reader.GetString("BorrowerName"));
                return Json(sug);
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBookTitleSuggestions(string query)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                var sug = new List<string>();
                using var cmd = new MySqlCommand("SELECT BookTitle FROM Logbook WHERE BookTitle LIKE @q AND Availability='Available' LIMIT 10", _connection);
                cmd.Parameters.AddWithValue("@q", $"%{query}%");
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) sug.Add(reader.GetString("BookTitle"));
                return Json(sug);
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetBorrowedBooksSuggestions(string query, string field)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                var suggestions = new List<string>();
                string selectField = field == "borrower" ? "b.BorrowerName" : "lb.BookTitle";
                string tablePart = field == "borrower" ? "Borrower b" : "Logbook lb";
                string whereClause = field == "borrower"
                    ? "WHERE b.BorrowerName LIKE @q AND b.BorrowerName IS NOT NULL AND b.BorrowerName != ''"
                    : "WHERE lb.BookTitle LIKE @q AND lb.BookTitle IS NOT NULL AND lb.BookTitle != ''";

                using var cmd = new MySqlCommand($"SELECT DISTINCT {selectField} FROM {tablePart} {whereClause} LIMIT 10", _connection);
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
        public async Task<IActionResult> GetFineSuggestions(string query)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                var suggestions = new List<string>();
                using var cmd = new MySqlCommand(
                    "SELECT DISTINCT lb.BookTitle FROM Fine f JOIN Loan l ON f.LoanID = l.LoanID JOIN Logbook lb ON l.BookID = lb.BookID WHERE lb.BookTitle LIKE @q AND lb.BookTitle IS NOT NULL AND lb.BookTitle != '' LIMIT 10",
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

        private async Task<int> GetOrCreateBorrower(string name, string type)
        {
            bool close = false;
            if (_connection.State != ConnectionState.Open) { await _connection.OpenAsync(); close = true; }
            try
            {
                using var find = new MySqlCommand("SELECT BorrowerID FROM Borrower WHERE BorrowerName = @n", _connection);
                find.Parameters.AddWithValue("@n", name);
                var res = await find.ExecuteScalarAsync();
                if (res != null) return Convert.ToInt32(res);

                using var ins = new MySqlCommand("INSERT INTO Borrower (BorrowerName, BorrowerType) VALUES (@n, @t)", _connection);
                ins.Parameters.AddWithValue("@n", name);
                ins.Parameters.AddWithValue("@t", type);
                await ins.ExecuteNonQueryAsync();
                return (int)ins.LastInsertedId;
            }
            finally { if (close) await _connection.CloseAsync(); }
        }

        private async Task<int> GetBookIdByTitle(string title)
        {
            bool close = false;
            if (_connection.State != ConnectionState.Open) { await _connection.OpenAsync(); close = true; }
            try
            {
                using var cmd = new MySqlCommand("SELECT BookID FROM Logbook WHERE BookTitle = @t AND Availability = 'Available' LIMIT 1", _connection);
                cmd.Parameters.AddWithValue("@t", title);
                var res = await cmd.ExecuteScalarAsync();
                return res != null ? Convert.ToInt32(res) : 0;
            }
            finally { if (close) await _connection.CloseAsync(); }
        }

        private async Task UpdateBorrowerName(int id, string name)
        {
            bool close = false;
            if (_connection.State != ConnectionState.Open) { await _connection.OpenAsync(); close = true; }
            try
            {
                using var cmd = new MySqlCommand("UPDATE Borrower SET BorrowerName=@n WHERE BorrowerID=@id", _connection);
                cmd.Parameters.AddWithValue("@n", name);
                cmd.Parameters.AddWithValue("@id", id);
                await cmd.ExecuteNonQueryAsync();
            }
            finally { if (close) await _connection.CloseAsync(); }
        }
    }
}