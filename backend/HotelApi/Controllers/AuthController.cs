using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Controllers;

public record LoginDto(string Username, string Password);
public record RegisterDto(string Username, string Password, string FullName, string? Phone, string? Email);

[Route("api/auth")]
public class AuthController : ApiBase
{
    private readonly TokenService _tokens;
    public AuthController(AppDbContext db, TokenService tokens) : base(db) { _tokens = tokens; }

    private object Session(AppUser u) => new
    {
        token = _tokens.Create(u),
        user = new { u.Id, u.Username, u.FullName, u.Phone, u.Email, role = u.Role.ToString() }
    };

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var name = (dto.Username ?? "").Trim().ToLower();
        var u = await Db.Users.FirstOrDefaultAsync(x => x.Username == name);
        if (u == null || !BCrypt.Net.BCrypt.Verify(dto.Password ?? "", u.PasswordHash))
            return Msg(401, "Sai tên đăng nhập hoặc mật khẩu.");
        if (!u.IsActive) return Msg(403, "Tài khoản đã bị khóa. Liên hệ quản lý để mở khóa.");
        return Ok(Session(u));
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var name = (dto.Username ?? "").Trim().ToLower();
        if (name.Length < 3) return Msg(400, "Tên đăng nhập tối thiểu 3 ký tự.");
        if ((dto.Password ?? "").Length < 6) return Msg(400, "Mật khẩu tối thiểu 6 ký tự.");
        if (string.IsNullOrWhiteSpace(dto.FullName)) return Msg(400, "Cần nhập họ tên.");
        if (await Db.Users.AnyAsync(x => x.Username == name)) return Msg(409, "Tên đăng nhập đã tồn tại.");

        var u = new AppUser
        {
            Username = name, PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password), FullName = dto.FullName.Trim(),
            Phone = dto.Phone?.Trim(), Email = dto.Email?.Trim(), Role = Role.Guest, CreatedAt = Clock.Now
        };
        Db.Users.Add(u);
        await Db.SaveChangesAsync();
        return Ok(Session(u));
    }

    [Authorize, HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var u = await Db.Users.FindAsync(UserId);
        if (u == null || !u.IsActive) return Unauthorized();
        return Ok(new { u.Id, u.Username, u.FullName, u.Phone, u.Email, role = u.Role.ToString() });
    }
}
