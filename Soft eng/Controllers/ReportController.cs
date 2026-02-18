using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Data;
using System.Text;

namespace Soft_eng.Controllers
{
    public class ReportController : BaseController
    {
        public ReportController(MySqlConnection connection) : base(connection) { }

        [HttpGet]
        public async Task<IActionResult> GenerateReport(string reportType, string format)
        {
            try
            {
                var data = await GetReportData(reportType);
                if (format.ToLower() == "csv") return GenerateCSV(data, reportType);
                if (format.ToLower() == "pdf") return GeneratePDF(data, reportType);
                return BadRequest("Invalid format");
            }
            catch (Exception ex)
            {
                return BadRequest($"Report error [{reportType}/{format}]: {ex.Message} | Inner: {ex.InnerException?.Message}");
            }
        }

        private async Task<DataTable> GetReportData(string reportType)
        {
            DataTable dt = new DataTable();
            try
            {
                if (_connection.State != ConnectionState.Open) await _connection.OpenAsync();
                string query = reportType switch
                {
                    "borrowedbooks" => @"SELECT l.LoanID, b.BorrowerName, lb.BookTitle, l.DateDue, l.DateReturned, 
                        CASE WHEN l.OverdueStatus = 1 THEN 'Yes' ELSE 'No' END as OverdueStatus 
                        FROM Loan l 
                        JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                        JOIN Logbook lb ON l.BookID = lb.BookID 
                        ORDER BY l.LoanID DESC",

                    "fine" => @"SELECT f.FineID, l.LoanID, b.BorrowerName, lb.BookTitle, f.PaymentStatus, f.FineAmount 
                        FROM Fine f 
                        JOIN Loan l ON f.LoanID = l.LoanID 
                        JOIN Borrower b ON l.BorrowerID = b.BorrowerID 
                        JOIN Logbook lb ON l.BookID = lb.BookID 
                        ORDER BY f.FineID DESC",

                    "requestedbooks" => "SELECT RequestID, RequesterName, RequestedTitle, DateRequested, Status, Remarks FROM Request ORDER BY RequestID DESC",

                    "archivedbooks" => @"SELECT a.ArchiveID, a.BookID, a.BookTitle, a.Author, a.ISBN, a.Publisher, 
                        a.ShelfLocation, a.TotalCopies, a.DateArchived, a.ArchiveReason 
                        FROM ArchivedBooks a ORDER BY a.DateArchived DESC",

                    _ => throw new ArgumentException("Invalid report type")
                };

                using var cmd = new MySqlCommand(query, _connection);
                using var adapter = new MySqlDataAdapter(cmd);
                adapter.Fill(dt);
            }
            finally { await _connection.CloseAsync(); }
            return dt;
        }

        private IActionResult GeneratePDF(DataTable data, string reportType)
        {
            try
            {
                var pdfBytes = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.Letter);
                        page.Margin(1, Unit.Centimetre);
                        page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                        page.Header().Column(col =>
                        {
                            col.Item().AlignCenter().Text("Saint Isidore Academy Library")
                                .Bold().FontSize(14).FontColor("#c0392b");
                            col.Item().AlignCenter().Text($"{GetReportTitle(reportType)} Report")
                                .Bold().FontSize(11);
                            col.Item().AlignCenter().Text($"Generated on: {DateTime.Now:yyyy-MM-dd HH:mm:ss}")
                                .FontSize(8).FontColor("#666666");
                            col.Item().PaddingTop(4).LineHorizontal(2).LineColor("#c0392b");
                        });

                        page.Content().PaddingTop(10).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                for (int i = 0; i < data.Columns.Count; i++)
                                    columns.RelativeColumn();
                            });

                            table.Header(header =>
                            {
                                foreach (DataColumn col in data.Columns)
                                {
                                    header.Cell().Background("#c0392b").Padding(5)
                                        .Text(col.ColumnName).Bold().FontColor("#ffffff").FontSize(8);
                                }
                            });

                            bool isEven = false;
                            foreach (DataRow row in data.Rows)
                            {
                                string bg = isEven ? "#f9f9f9" : "#ffffff";
                                foreach (var cell in row.ItemArray)
                                {
                                    table.Cell().Background(bg).Border(0.5f).BorderColor("#dddddd")
                                        .Padding(4).Text(cell?.ToString() ?? "").FontSize(8);
                                }
                                isEven = !isEven;
                            }
                        });

                        page.Footer().AlignCenter().Text(x =>
                        {
                            x.Span("Total Records: ").Bold();
                            x.Span(data.Rows.Count.ToString());
                            x.Span("    |    Page ");
                            x.CurrentPageNumber();
                            x.Span(" of ");
                            x.TotalPages();
                        });
                    });
                }).GeneratePdf();

                return File(pdfBytes, "application/pdf", $"{reportType}_{DateTime.Now:yyyyMMdd_HHmmss}.pdf");
            }
            catch (Exception ex)
            {
                return BadRequest($"PDF generation failed: {ex.Message} | Inner: {ex.InnerException?.Message}");
            }
        }

        private IActionResult GenerateCSV(DataTable data, string reportType)
        {
            StringBuilder csv = new StringBuilder();
            csv.Append('\uFEFF');
            csv.AppendLine($"Saint Isidore Academy Library - {GetReportTitle(reportType)} Report");
            csv.AppendLine($"Generated on: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            csv.AppendLine();

            List<string> headers = new List<string>();
            for (int i = 0; i < data.Columns.Count; i++)
                headers.Add(EscapeCSV(data.Columns[i].ColumnName));
            csv.AppendLine(string.Join(",", headers));

            foreach (DataRow row in data.Rows)
            {
                List<string> values = new List<string>();
                for (int i = 0; i < data.Columns.Count; i++)
                    values.Add(EscapeCSV(row[i]?.ToString() ?? ""));
                csv.AppendLine(string.Join(",", values));
            }

            csv.AppendLine();
            csv.AppendLine($"Total Records: {data.Rows.Count}");

            return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8",
                $"{reportType}_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
        }

        private string GetReportTitle(string type) => type switch
        {
            "borrowedbooks" => "Borrowed Books",
            "fine" => "Fine",
            "requestedbooks" => "Requested Books",
            "archivedbooks" => "Archived Books",
            _ => "Report"
        };

        private string EscapeCSV(string v) =>
            (string.IsNullOrEmpty(v) || !v.Any(c => c == ',' || c == '"' || c == '\n' || c == '\r'))
                ? v
                : $"\"{v.Replace("\"", "\"\"")}\"";
    }
}