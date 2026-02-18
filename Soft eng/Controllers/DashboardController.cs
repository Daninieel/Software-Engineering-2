using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data;

namespace Soft_eng.Controllers
{
    public class DashboardController : BaseController
    {
        public DashboardController(MySqlConnection connection) : base(connection) { }

        public async Task<IActionResult> Dashboard()
        {
            var data = await GetDashboardViewModel();
            ViewBag.TotalBooks = data.TotalBooks;
            ViewBag.TotalBorrowed = data.TotalBorrowed;
            ViewBag.TotalReturned = data.TotalReturned;
            ViewBag.TotalOverdue = data.TotalOverdue;
            ViewBag.TotalMissing = data.TotalMissing;
            ViewBag.TotalDamaged = data.TotalDamaged;
            ViewBag.OverdueList = data.OverdueList;
            ViewBag.RecentList = data.RecentList;
            ViewBag.TotalFine = data.TotalFine;
            return View();
        }

        public async Task<IActionResult> AdminDashboard()
        {
            var data = await GetDashboardViewModel();
            ViewBag.TotalBooks = data.TotalBooks;
            ViewBag.TotalBorrowed = data.TotalBorrowed;
            ViewBag.TotalReturned = data.TotalReturned;
            ViewBag.TotalOverdue = data.TotalOverdue;
            ViewBag.TotalMissing = data.TotalMissing;
            ViewBag.TotalDamaged = data.TotalDamaged;
            ViewBag.OverdueList = data.OverdueList;
            ViewBag.RecentList = data.RecentList;
            ViewBag.TotalFine = data.TotalFine;
            return View();
        }

        private async Task<dynamic> GetDashboardViewModel()
        {
            int totalBooks = 0, totalBorrowed = 0, totalReturned = 0, totalOverdue = 0, totalMissing = 0, totalDamaged = 0;
            decimal totalFineSum = 0;
            var overdueList = new List<dynamic>();
            var recentList = new List<dynamic>();

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                string updateOverdueSql = @"UPDATE Loan l JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                    SET l.OverdueStatus = 1 
                    WHERE l.DateDue < CURDATE() AND l.ReturnStatus = 'Not Returned' AND LOWER(b.BorrowerType) != 'teacher'";
                using (var updateCmd = new MySqlCommand(updateOverdueSql, _connection))
                    await updateCmd.ExecuteNonQueryAsync();

                using (var cmd = new MySqlCommand("SELECT IFNULL(SUM(TotalCopies), 0) FROM Logbook", _connection))
                    totalBooks = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Not Returned'", _connection))
                    totalBorrowed = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE ReturnStatus = 'Returned'", _connection))
                    totalReturned = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Loan WHERE OverdueStatus = 1 AND ReturnStatus = 'Not Returned'", _connection))
                    totalOverdue = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT IFNULL(SUM(FineAmount), 0) FROM Fine", _connection))
                    totalFineSum = Convert.ToDecimal(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Logbook WHERE BookStatus = 'Missing'", _connection))
                    totalMissing = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Logbook WHERE BookStatus = 'Damaged'", _connection))
                    totalDamaged = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                string overdueSql = @"SELECT l.BorrowerID, b.BorrowerName, l.DateBorrowed, IFNULL(f.FineAmount, 0) as FineAmount 
                    FROM Loan l 
                    JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                    LEFT JOIN Fine f ON l.LoanID = f.LoanID
                    WHERE l.OverdueStatus = 1 AND l.ReturnStatus = 'Not Returned'
                    ORDER BY l.DateBorrowed ASC LIMIT 5";

                using (var cmd = new MySqlCommand(overdueSql, _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
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

                string recentSql = @"SELECT lb.BookTitle FROM Loan l JOIN Logbook lb ON l.BookID = lb.BookID 
                    WHERE l.ReturnStatus = 'Not Returned' ORDER BY l.DateBorrowed DESC LIMIT 5";

                using (var cmd = new MySqlCommand(recentSql, _connection))
                using (var reader = await cmd.ExecuteReaderAsync())
                {
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
                        return fromAdmin ? RedirectToAction("BorrowedBooksAdmin", "Loan") : RedirectToAction("BorrowedBooks", "Loan");
                }

                using (var borrowerCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM Borrower WHERE BorrowerName LIKE @q LIMIT 1", _connection))
                {
                    borrowerCmd.Parameters.AddWithValue("@q", $"%{query}%");
                    if (Convert.ToInt32(await borrowerCmd.ExecuteScalarAsync()) > 0)
                        return fromAdmin ? RedirectToAction("BorrowedBooksAdmin", "Loan") : RedirectToAction("BorrowedBooks", "Loan");
                }

                using (var requestedCmd = new MySqlCommand(
                    "SELECT COUNT(*) FROM Request WHERE RequestedTitle LIKE @q OR RequesterName LIKE @q LIMIT 1", _connection))
                {
                    requestedCmd.Parameters.AddWithValue("@q", $"%{query}%");
                    if (Convert.ToInt32(await requestedCmd.ExecuteScalarAsync()) > 0)
                        return fromAdmin ? RedirectToAction("RequestedBooksAdmin", "Request") : RedirectToAction("RequestedBooks", "Request");
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
                        return fromAdmin ? RedirectToAction("FineAdmin", "Loan") : RedirectToAction("Fine", "Loan");
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