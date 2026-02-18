using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using Soft_eng.Models;
using System.Data;

namespace Soft_eng.Controllers
{
    public class RequestController : BaseController
    {
        public RequestController(MySqlConnection connection) : base(connection) { }

        public async Task<IActionResult> RequestedBooks()
        {
            var requests = new List<Request>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand(
                    "SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status, Remarks FROM Request ORDER BY DateRequested DESC",
                    _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    requests.Add(new Request
                    {
                        RequestID = reader.GetInt32("RequestID"),
                        RequesterName = reader.GetString("RequesterName"),
                        RequestedTitle = reader.GetString("RequestedTitle"),
                        DateRequested = SafeGetDateTime(reader, "DateRequested") ?? DateTime.Now,
                        Status = reader.GetString("Status"),
                        Remarks = reader.IsDBNull("Remarks") ? null : reader.GetString("Remarks")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }
            return View(requests);
        }

        public async Task<IActionResult> RequestedBooksAdmin()
        {
            var requests = new List<Request>();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand(
                    "SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status, Remarks FROM Request ORDER BY DateRequested DESC",
                    _connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    requests.Add(new Request
                    {
                        RequestID = reader.GetInt32("RequestID"),
                        RequesterName = reader.GetString("RequesterName"),
                        RequestedTitle = reader.GetString("RequestedTitle"),
                        DateRequested = SafeGetDateTime(reader, "DateRequested") ?? DateTime.Now,
                        Status = reader.GetString("Status"),
                        Remarks = reader.IsDBNull("Remarks") ? null : reader.GetString("Remarks")
                    });
                }
            }
            finally { await _connection.CloseAsync(); }
            return View(requests);
        }

        [HttpPost]
        public async Task<IActionResult> AddRequest(Request request)
        {
            if (!ModelState.IsValid) return RedirectToAction("RequestedBooks");
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand(
                    "INSERT INTO Request (RequesterName, RequestedTitle, DateRequested, Status, Remarks) VALUES (@name, @title, @date, 'Pending', @remarks)",
                    _connection);
                cmd.Parameters.AddWithValue("@name", request.RequesterName);
                cmd.Parameters.AddWithValue("@title", request.RequestedTitle);
                cmd.Parameters.AddWithValue("@date", request.DateRequested);
                cmd.Parameters.AddWithValue("@remarks", request.Remarks);
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await _connection.CloseAsync(); }
            return RedirectToAction("RequestedBooks");
        }

        [HttpPost]
        public async Task<IActionResult> EditRequest(Request req)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand(
                    "UPDATE Request SET RequesterName = @name, RequestedTitle = @title, DateRequested = @date, Remarks = @remarks WHERE RequestID = @id",
                    _connection);
                cmd.Parameters.AddWithValue("@id", req.RequestID);
                cmd.Parameters.AddWithValue("@name", req.RequesterName);
                cmd.Parameters.AddWithValue("@title", req.RequestedTitle);
                cmd.Parameters.AddWithValue("@date", req.DateRequested);
                cmd.Parameters.AddWithValue("@remarks", req.Remarks);
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await _connection.CloseAsync(); }
            return RedirectToAction("RequestedBooks");
        }

        [HttpPost]
        public async Task<IActionResult> EditRequestAdmin(Request req)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                using var cmd = new MySqlCommand(
                    "UPDATE Request SET RequesterName = @name, RequestedTitle = @title, DateRequested = @date, Status = @status, Remarks = @remarks WHERE RequestID = @id",
                    _connection);
                cmd.Parameters.AddWithValue("@id", req.RequestID);
                cmd.Parameters.AddWithValue("@name", req.RequesterName);
                cmd.Parameters.AddWithValue("@title", req.RequestedTitle);
                cmd.Parameters.AddWithValue("@date", req.DateRequested);
                cmd.Parameters.AddWithValue("@status", req.Status);
                cmd.Parameters.AddWithValue("@remarks", req.Remarks);
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await _connection.CloseAsync(); }
            return RedirectToAction("RequestedBooksAdmin");
        }

        [HttpGet]
        public async Task<IActionResult> GetRequestedBooksSuggestions(string query, string field)
        {
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                var suggestions = new List<string>();

                string selectField = field == "borrower" ? "r.RequesterName" : "r.RequestedTitle";
                string whereClause = field == "borrower"
                    ? "WHERE r.RequesterName LIKE @q AND r.RequesterName IS NOT NULL AND r.RequesterName != ''"
                    : "WHERE r.RequestedTitle LIKE @q AND r.RequestedTitle IS NOT NULL AND r.RequestedTitle != ''";

                using var cmd = new MySqlCommand($"SELECT DISTINCT {selectField} FROM Request r {whereClause} LIMIT 10", _connection);
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
    }
}