using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data;

namespace Soft_eng.Controllers
{
    public class DashboardController : BaseController
    {
        public DashboardController(MySqlConnection connection) : base(connection) { }

        public async Task<IActionResult> Dashboard(int? year, int? month)
        {
            var data = await GetDashboardViewModel(year, month);
            ViewBag.TotalBooks = data.TotalBooks;
            ViewBag.TotalBorrowed = data.TotalBorrowed;
            ViewBag.TotalReturned = data.TotalReturned;
            ViewBag.TotalOverdue = data.TotalOverdue;
            ViewBag.TotalMissing = data.TotalMissing;
            ViewBag.TotalDamaged = data.TotalDamaged;
            ViewBag.OverdueList = data.OverdueList;
            ViewBag.RecentList = data.RecentList;
            ViewBag.TotalFine = data.TotalFine;
            ViewBag.SelectedYear = year.HasValue ? year.Value : (int?)null;
            ViewBag.SelectedMonth = month.HasValue ? month.Value : (int?)null;
            return View();
        }

        public async Task<IActionResult> AdminDashboard(int? year, int? month)
        {
            var data = await GetDashboardViewModel(year, month);
            ViewBag.TotalBooks = data.TotalBooks;
            ViewBag.TotalBorrowed = data.TotalBorrowed;
            ViewBag.TotalReturned = data.TotalReturned;
            ViewBag.TotalOverdue = data.TotalOverdue;
            ViewBag.TotalMissing = data.TotalMissing;
            ViewBag.TotalDamaged = data.TotalDamaged;
            ViewBag.OverdueList = data.OverdueList;
            ViewBag.RecentList = data.RecentList;
            ViewBag.TotalFine = data.TotalFine;
            ViewBag.SelectedYear = year.HasValue ? year.Value : (int?)null;
            ViewBag.SelectedMonth = month.HasValue ? month.Value : (int?)null;
            return View();
        }

        private async Task<dynamic> GetDashboardViewModel(int? year = null, int? month = null)
        {
            int totalBooks = 0, totalBorrowed = 0, totalReturned = 0,
                totalOverdue = 0, totalMissing = 0, totalDamaged = 0;
            decimal totalFineSum = 0;
            var overdueList = new List<dynamic>();
            var recentList = new List<dynamic>();

            // Build reusable date filter clause (applied to Loan table aliased as l)
            string dateFilter = "";
            if (year.HasValue) dateFilter += " AND YEAR(l.DateBorrowed) = @Year";
            if (month.HasValue) dateFilter += " AND MONTH(l.DateBorrowed) = @Month";

            void AddDateParams(MySqlCommand cmd)
            {
                if (year.HasValue) cmd.Parameters.AddWithValue("@Year", year.Value);
                if (month.HasValue) cmd.Parameters.AddWithValue("@Month", month.Value);
            }

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // Always auto-mark overdue — not filtered
                string updateOverdueSql = @"
                    UPDATE Loan l
                    JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                    SET l.OverdueStatus = 1
                    WHERE l.DateDue < CURDATE()
                      AND l.ReturnStatus = 'Not Returned'
                      AND LOWER(b.BorrowerType) != 'teacher'";
                using (var cmd = new MySqlCommand(updateOverdueSql, _connection))
                    await cmd.ExecuteNonQueryAsync();

                // Total Books — inventory count, never filtered
                using (var cmd = new MySqlCommand(
                    "SELECT IFNULL(SUM(TotalCopies), 0) FROM Logbook", _connection))
                    totalBooks = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // Borrowed Books (filtered by DateBorrowed)
                using (var cmd = new MySqlCommand(
                    $"SELECT COUNT(*) FROM Loan l WHERE l.ReturnStatus = 'Not Returned'{dateFilter}",
                    _connection))
                {
                    AddDateParams(cmd);
                    totalBorrowed = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                }

                // Returned Books (filtered by DateBorrowed)
                using (var cmd = new MySqlCommand(
                    $"SELECT COUNT(*) FROM Loan l WHERE l.ReturnStatus = 'Returned'{dateFilter}",
                    _connection))
                {
                    AddDateParams(cmd);
                    totalReturned = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                }

                // Overdue Books (filtered by DateBorrowed)
                using (var cmd = new MySqlCommand(
                    $"SELECT COUNT(*) FROM Loan l WHERE l.OverdueStatus = 1 AND l.ReturnStatus = 'Not Returned'{dateFilter}",
                    _connection))
                {
                    AddDateParams(cmd);
                    totalOverdue = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                }

                // Total Fine (filtered via Loan join on DateBorrowed)
                string fineDateFilter = "";
                if (year.HasValue) fineDateFilter += " AND YEAR(l.DateBorrowed) = @Year";
                if (month.HasValue) fineDateFilter += " AND MONTH(l.DateBorrowed) = @Month";

                using (var cmd = new MySqlCommand(
                    $@"SELECT IFNULL(SUM(f.FineAmount), 0)
                       FROM Fine f
                       JOIN Loan l ON f.LoanID = l.LoanID
                       WHERE 1=1{fineDateFilter}", _connection))
                {
                    AddDateParams(cmd);
                    totalFineSum = Convert.ToDecimal(await cmd.ExecuteScalarAsync());
                }

                // Missing / Damaged — always current inventory status, never filtered
                using (var cmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM Logbook WHERE BookStatus = 'Missing'", _connection))
                    totalMissing = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM Logbook WHERE BookStatus = 'Damaged'", _connection))
                    totalDamaged = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                // Overdue List (filtered)
                string overdueSql = $@"
                    SELECT l.BorrowerID, b.BorrowerName, l.DateBorrowed,
                           IFNULL(f.FineAmount, 0) AS FineAmount
                    FROM Loan l
                    JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                    LEFT JOIN Fine f ON l.LoanID = f.LoanID
                    WHERE l.OverdueStatus = 1 AND l.ReturnStatus = 'Not Returned'{dateFilter}
                    ORDER BY l.DateBorrowed ASC
                    LIMIT 5";

                using (var cmd = new MySqlCommand(overdueSql, _connection))
                {
                    AddDateParams(cmd);
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        overdueList.Add(new
                        {
                            UserID = reader.GetInt32("BorrowerID"),
                            Name = reader.GetString("BorrowerName"),
                            DateBorrowed = SafeGetDateTime(reader, "DateBorrowed")?.ToString("MM/dd/yyyy") ?? "-",
                            Fine = reader.GetDecimal("FineAmount").ToString("N2")
                        });
                    }
                }

                // Recent Borrowed Books (filtered)
                string recentSql = $@"
                    SELECT lb.BookTitle
                    FROM Loan l
                    JOIN Logbook lb ON l.BookID = lb.BookID
                    WHERE l.ReturnStatus = 'Not Returned'{dateFilter}
                    ORDER BY l.DateBorrowed DESC
                    LIMIT 5";

                using (var cmd = new MySqlCommand(recentSql, _connection))
                {
                    AddDateParams(cmd);
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                        recentList.Add(new { Title = reader.GetString("BookTitle") });
                }
            }
            finally { await _connection.CloseAsync(); }

            return new
            {
                TotalBooks = totalBooks,
                TotalBorrowed = totalBorrowed,
                TotalReturned = totalReturned,
                TotalOverdue = totalOverdue,
                TotalMissing = totalMissing,
                TotalDamaged = totalDamaged,
                TotalFine = totalFineSum.ToString("N2"),
                OverdueList = overdueList,
                RecentList = recentList
            };
        }

        [HttpGet]
        [HttpPost]
        public async Task<IActionResult> GlobalSearch(string query, bool fromAdmin = false)
        {
            if (string.IsNullOrWhiteSpace(query))
                return fromAdmin ? RedirectToAction("AdminDashboard") : RedirectToAction("Dashboard");

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                using (var exactBookCmd = new MySqlCommand(
                    @"SELECT BookID FROM Logbook
                    WHERE BookTitle = @exactQuery
                    AND (BookStatus NOT IN ('Damaged', 'Missing') OR BookStatus IS NULL)
                    AND TotalCopies > 0 LIMIT 1", _connection))
                {
                    exactBookCmd.Parameters.AddWithValue("@exactQuery", query);
                    var exactBook = await exactBookCmd.ExecuteScalarAsync();
                    if (exactBook != null)
                        return RedirectToAction("SearchBooks", "Inventory", new { query, fromAdmin });
                }

                using (var bookCmd = new MySqlCommand(
                    @"SELECT COUNT(*) FROM Logbook
                    WHERE (BookTitle LIKE @q OR Author LIKE @q OR ISBN LIKE @q)
                    AND (BookStatus NOT IN ('Damaged', 'Missing') OR BookStatus IS NULL)
                    AND TotalCopies > 0 LIMIT 1", _connection))
                {
                    bookCmd.Parameters.AddWithValue("@q", $"%{query}%");
                    if (Convert.ToInt32(await bookCmd.ExecuteScalarAsync()) > 0)
                        return RedirectToAction("SearchBooks", "Inventory", new { query, fromAdmin });
                }

                using (var exactBorrowerCmd = new MySqlCommand(
                    "SELECT BorrowerID FROM Borrower WHERE BorrowerName = @exactQuery LIMIT 1", _connection))
                {
                    exactBorrowerCmd.Parameters.AddWithValue("@exactQuery", query);
                    var exactBorrower = await exactBorrowerCmd.ExecuteScalarAsync();
                    if (exactBorrower != null)
                        return fromAdmin
                            ? RedirectToAction("BorrowedBooksAdmin", "Loan")
                            : RedirectToAction("BorrowedBooks", "Loan");
                }

                using (var borrowerCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM Borrower WHERE BorrowerName LIKE @q LIMIT 1", _connection))
                {
                    borrowerCmd.Parameters.AddWithValue("@q", $"%{query}%");
                    if (Convert.ToInt32(await borrowerCmd.ExecuteScalarAsync()) > 0)
                        return fromAdmin
                            ? RedirectToAction("BorrowedBooksAdmin", "Loan")
                            : RedirectToAction("BorrowedBooks", "Loan");
                }

                using (var requestedCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM Request WHERE RequestedTitle LIKE @q OR RequesterName LIKE @q LIMIT 1", _connection))
                {
                    requestedCmd.Parameters.AddWithValue("@q", $"%{query}%");
                    if (Convert.ToInt32(await requestedCmd.ExecuteScalarAsync()) > 0)
                        return fromAdmin
                            ? RedirectToAction("RequestedBooksAdmin", "Request")
                            : RedirectToAction("RequestedBooks", "Request");
                }

                using (var fineCmd = new MySqlCommand(
                    @"SELECT COUNT(*) FROM Fine f
                    JOIN Loan l ON f.LoanID = l.LoanID
                    JOIN Borrower b ON l.BorrowerID = b.BorrowerID
                    JOIN Logbook lb ON l.BookID = lb.BookID
                    WHERE lb.BookTitle LIKE @q OR b.BorrowerName LIKE @q LIMIT 1", _connection))
                {
                    fineCmd.Parameters.AddWithValue("@q", $"%{query}%");
                    if (Convert.ToInt32(await fineCmd.ExecuteScalarAsync()) > 0)
                        return fromAdmin
                            ? RedirectToAction("FineAdmin", "Loan")
                            : RedirectToAction("Fine", "Loan");
                }

                return RedirectToAction("SearchBooks", "Inventory", new { query, fromAdmin });
            }
            finally { await _connection.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetDashboardSuggestions(string query, string field)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                var suggestions = new List<string>();
                string selectField = field switch
                {
                    "author" => "Author",
                    "isbn" => "ISBN",
                    "shelf" => "ShelfLocation",
                    "borrower" => "BorrowerName",
                    _ => "BookTitle"
                };

                if (field == "borrower")
                {
                    using var cmd = new MySqlCommand(
                        "SELECT DISTINCT BorrowerName FROM Borrower WHERE BorrowerName LIKE @q AND BorrowerName IS NOT NULL AND BorrowerName != '' LIMIT 10",
                        _connection);
                    cmd.Parameters.AddWithValue("@q", $"%{query}%");
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        string value = reader.GetString(0);
                        if (!string.IsNullOrWhiteSpace(value)) suggestions.Add(value);
                    }
                }
                else
                {
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
                }

                return Json(suggestions);
            }
            finally { await _connection.CloseAsync(); }
        }
    }
}