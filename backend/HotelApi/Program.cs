using System.Diagnostics;
using System.Text;
using System.Text.Json.Serialization;
using HotelApi.Data;
using HotelApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Khi chạy bản đã publish (có thư mục wwwroot cạnh file .exe) thì lấy thư mục của .exe làm gốc,
// để bấm đúp .exe từ đâu cũng tìm thấy appsettings.json và giao diện web.
var baseDir = AppContext.BaseDirectory;
var hasWebRoot = Directory.Exists(Path.Combine(baseDir, "wwwroot"));
var builder = WebApplication.CreateBuilder(hasWebRoot
    ? new WebApplicationOptions { Args = args, ContentRootPath = baseDir }
    : new WebApplicationOptions { Args = args });

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

var issuer = builder.Configuration["Jwt:Issuer"]!;
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = issuer,
        ValidateAudience = true, ValidAudience = issuer,
        ValidateIssuerSigningKey = true, IssuerSigningKey = key,
        ClockSkew = TimeSpan.FromMinutes(1)
    };
});
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Phát giao diện React đã build (wwwroot) ngay từ backend: chỉ cần chạy một chương trình.
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (args.Contains("--reset-db"))
    {
        db.Database.EnsureDeleted();
        Console.WriteLine("Đã xóa database. Đang tạo lại...");
    }
    // Có migration (sinh bằng "dotnet ef migrations add") thì dùng migration, chưa có thì tạo bảng trực tiếp.
    if (db.Database.GetMigrations().Any()) db.Database.Migrate(); else db.Database.EnsureCreated();
    db.CreateConstraints();
    Seeder.Run(db);
}

if (hasWebRoot)
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        try
        {
            var url = (app.Urls.FirstOrDefault() ?? "http://localhost:5000").Replace("0.0.0.0", "localhost").Replace("[::]", "localhost");
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { /* không mở được trình duyệt thì thôi, người dùng tự mở */ }
    });
}

app.Run();
