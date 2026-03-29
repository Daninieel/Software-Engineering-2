using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;
using Microsoft.AspNetCore.Authorization;

namespace Soft_eng.Controllers
{
    [AllowAnonymous]
    public class OpacController : BaseController
    {
        public OpacController(MySqlConnection connection) : base(connection) { }

        [HttpGet]
        public async Task<IActionResult> Opac(string query, string availability, string shelfLocation, string sortBy)
        {
            List<LogBook> books = new List<LogBook>();
            List<string> shelfLocations = new List<string>();

            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();

                // ── 1. Load distinct shelf locations for dropdown ──────────────────
                using (var locCmd = new MySqlCommand(
                    @"SELECT DISTINCT ShelfLocation
                      FROM Logbook
                      WHERE ShelfLocation IS NOT NULL AND ShelfLocation != ''
                      ORDER BY ShelfLocation ASC",
                    _connection))
                {
                    using var locReader = await locCmd.ExecuteReaderAsync();
                    while (await locReader.ReadAsync())
                        shelfLocations.Add(locReader.GetString(0));
                }

                // ── 2. Build main book query ───────────────────────────────────────
                string sqlQuery = @"
                    SELECT BookID, BookTitle, Author, ShelfLocation, Availability, ISBN
                    FROM Logbook
                    WHERE (BookStatus NOT IN ('Damaged', 'Missing') OR BookStatus IS NULL)
                      AND TotalCopies > 0";

                if (!string.IsNullOrWhiteSpace(query))
                    sqlQuery += " AND (BookTitle LIKE @q OR Author LIKE @q OR ISBN LIKE @q OR Publisher LIKE @q)";

                if (!string.IsNullOrWhiteSpace(availability))
                    sqlQuery += " AND Availability = @availability";

                if (!string.IsNullOrWhiteSpace(shelfLocation))
                    sqlQuery += " AND ShelfLocation = @shelfLocation";

                sqlQuery += sortBy switch
                {
                    "title_desc" => " ORDER BY BookTitle DESC",
                    "author_asc" => " ORDER BY Author ASC",
                    "author_desc" => " ORDER BY Author DESC",
                    _ => " ORDER BY BookTitle ASC"
                };

                // ── 3. Execute main query ──────────────────────────────────────────
                using (var cmd = new MySqlCommand(sqlQuery, _connection))
                {
                    if (!string.IsNullOrWhiteSpace(query))
                        cmd.Parameters.AddWithValue("@q", $"%{query}%");

                    if (!string.IsNullOrWhiteSpace(availability))
                        cmd.Parameters.AddWithValue("@availability", availability);

                    if (!string.IsNullOrWhiteSpace(shelfLocation))
                        cmd.Parameters.AddWithValue("@shelfLocation", shelfLocation);

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        books.Add(new LogBook
                        {
                            BookID = reader.GetInt32("BookID"),
                            BookTitle = reader.GetString("BookTitle"),
                            Author = reader.IsDBNull("Author") ? "Unknown Author" : reader.GetString("Author"),
                            ShelfLocation = reader.IsDBNull("ShelfLocation") ? "Unassigned" : reader.GetString("ShelfLocation"),
                            Availability = reader.IsDBNull("Availability") ? "Unknown" : reader.GetString("Availability"),
                            ISBN = reader.IsDBNull("ISBN") ? "" : reader.GetString("ISBN")
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                // Ensures ShelfLocations is never null even if DB fails
                ViewBag.Error = ex.Message;
            }
            finally
            {
                await _connection.CloseAsync();
            }

            // ── 4. Always pass filter state to view ────────────────────────────────
            ViewBag.SearchQuery = query ?? "";
            ViewBag.Availability = availability ?? "";
            ViewBag.ShelfLocation = shelfLocation ?? "";
            ViewBag.SortBy = sortBy ?? "title_asc";
            ViewBag.ShelfLocations = shelfLocations; // always a List, never null

            return View("Opac", books);
        }
    }
}