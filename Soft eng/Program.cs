using DinkToPdf;
using DinkToPdf.Contracts;
using MySql.Data.MySqlClient;

var builder = WebApplication.CreateBuilder(args);

// 1. ADD SERVICES (Before builder.Build())
builder.Services.AddControllersWithViews();

// Register MySQL
builder.Services.AddTransient<MySqlConnection>(_ =>
    new MySqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register DinkToPdf Converter CORRECTLY here
builder.Services.AddSingleton(typeof(IConverter), new SynchronizedConverter(new PdfTools()));

// 2. BUILD THE APP
var app = builder.Build();

// 3. CONFIGURE PIPELINE (After builder.Build())
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Login}/{id?}")
    .WithStaticAssets();

app.Run();