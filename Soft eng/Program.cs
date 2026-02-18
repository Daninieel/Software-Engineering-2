using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using MySql.Data.MySqlClient;
using QuestPDF.Infrastructure;
using Soft_eng.Services;
using System.Security.Claims;

QuestPDF.Settings.License = LicenseType.Community;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.ExpireTimeSpan = TimeSpan.FromMinutes(60);
        options.SlidingExpiration = true;
    });
builder.Services.AddTransient<MySqlConnection>(_ =>
    new MySqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddSingleton<SessionService>();

var app = builder.Build();
app.UseDeveloperExceptionPage();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler(options =>
    {
        options.Run(async context =>
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "text/html";
            var exceptionFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
            if (exceptionFeature != null)
            {
                await context.Response.WriteAsync($"<h1>Error</h1><p>{exceptionFeature.Error.Message}</p>");
            }
        });
    });
    app.UseHsts();
}
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var token = context.User.FindFirst("SessionToken")?.Value;
        var sessionService = context.RequestServices.GetRequiredService<SessionService>();

        if (userId != null && token != null && !sessionService.IsValidSession(userId, token))
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            context.Response.Redirect("/Account/Login");
            return;
        }
    }
    await next();
});

app.MapStaticAssets();
app.MapControllers();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}")
    .WithStaticAssets();
app.Run();