using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Controllers;

public record RoomTypeDto(string Name, string? Description, int Capacity, decimal BasePrice, bool IsActive, List<string>? Amenities,
    int AreaM2 = 0, string? BedType = null, string? ViewName = null, string? Details = null);
public record RoomDto(string Number, int Floor, int RoomTypeId, bool IsActive);
public record ServiceDto(string Name, string? Unit, decimal UnitPrice, bool IsActive);
public record StaffDto(string Username, string Password, string FullName, Role Role, string? Phone, string? Email);
public record ActiveDto(bool IsActive);
public record RateDto(int? RoomTypeId, string Name, DateOnly? StartDate, DateOnly? EndDate, string? DaysOfWeek, string Mode, decimal Value, int Priority, bool IsActive);

[Authorize(Roles = "Admin"), Route("api/admin")]
public class AdminController : ApiBase
{
    public AdminController(AppDbContext db) : base(db) { }

    // ---------- FR02: loại phòng ----------
    [HttpGet("room-types")]
    public async Task<IActionResult> RoomTypes()
    {
        var types = await Db.RoomTypes.Include(t => t.Amenities).Include(t => t.Rooms).AsNoTracking().OrderBy(t => t.BasePrice).ToListAsync();
        return Ok(types.Select(t => new
        {
            t.Id, t.Name, t.Description, t.Details, t.Capacity, t.BasePrice, t.AreaM2, t.BedType, t.ViewName, t.IsActive,
            amenities = t.Amenities.Select(a => a.Name).OrderBy(x => x), roomCount = t.Rooms.Count
        }));
    }

    private async Task SyncAmenities(RoomType t, List<string>? names)
    {
        t.Amenities.Clear();
        foreach (var n in (names ?? new()).Select(x => x.Trim()).Where(x => x.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var a = await Db.Amenities.FirstOrDefaultAsync(x => x.Name == n) ?? new Amenity { Name = n };
            t.Amenities.Add(a);
        }
    }

    private static string? ValidateType(RoomTypeDto d)
    {
        if (string.IsNullOrWhiteSpace(d.Name)) return "Cần nhập tên loại phòng.";
        if (d.Capacity < 1 || d.Capacity > 10) return "Sức chứa phải từ 1 đến 10.";
        if (d.BasePrice <= 0) return "Giá cơ bản phải lớn hơn 0.";
        if (d.AreaM2 < 0 || d.AreaM2 > 1000) return "Diện tích không hợp lệ.";
        return null;
    }

    [HttpPost("room-types")]
    public async Task<IActionResult> CreateType(RoomTypeDto d)
    {
        var err = ValidateType(d); if (err != null) return Msg(400, err);
        var t = new RoomType { Name = d.Name.Trim(), Description = d.Description, Capacity = d.Capacity, BasePrice = d.BasePrice, IsActive = d.IsActive,
            AreaM2 = d.AreaM2, BedType = d.BedType, ViewName = d.ViewName, Details = d.Details };
        await SyncAmenities(t, d.Amenities);
        Db.RoomTypes.Add(t);
        Log("ROOMTYPE_CREATE", $"{t.Name}: {t.BasePrice:N0}đ/đêm");
        await Db.SaveChangesAsync();
        return Ok(new { t.Id });
    }

    [HttpPut("room-types/{id:int}")]
    public async Task<IActionResult> UpdateType(int id, RoomTypeDto d)
    {
        var err = ValidateType(d); if (err != null) return Msg(400, err);
        var t = await Db.RoomTypes.Include(x => x.Amenities).FirstOrDefaultAsync(x => x.Id == id);
        if (t == null) return Msg(404, "Không tìm thấy loại phòng.");
        if (t.BasePrice != d.BasePrice) Log("PRICE_CHANGE", $"Loại phòng {t.Name}: {t.BasePrice:N0}đ -> {d.BasePrice:N0}đ (booking cũ giữ giá đã chốt)");
        t.Name = d.Name.Trim(); t.Description = d.Description; t.Capacity = d.Capacity; t.BasePrice = d.BasePrice; t.IsActive = d.IsActive;
        t.AreaM2 = d.AreaM2; t.BedType = d.BedType; t.ViewName = d.ViewName; t.Details = d.Details;
        await SyncAmenities(t, d.Amenities);
        await Db.SaveChangesAsync();
        return Ok(new { t.Id });
    }

    // ---------- FR02: phòng ----------
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom(RoomDto d)
    {
        if (string.IsNullOrWhiteSpace(d.Number)) return Msg(400, "Cần nhập số phòng.");
        if (await Db.Rooms.AnyAsync(r => r.Number == d.Number.Trim())) return Msg(409, "Số phòng đã tồn tại.");
        if (!await Db.RoomTypes.AnyAsync(t => t.Id == d.RoomTypeId)) return Msg(400, "Loại phòng không hợp lệ.");
        var r = new Room { Number = d.Number.Trim(), Floor = d.Floor, RoomTypeId = d.RoomTypeId, IsActive = d.IsActive, Status = RoomStatus.Ready };
        Db.Rooms.Add(r);
        Log("ROOM_CREATE", $"Phòng {r.Number}");
        await Db.SaveChangesAsync();
        return Ok(new { r.Id });
    }

    [HttpPut("rooms/{id:int}")]
    public async Task<IActionResult> UpdateRoom(int id, RoomDto d)
    {
        var r = await Db.Rooms.FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return Msg(404, "Không tìm thấy phòng.");
        var number = d.Number.Trim();
        if (await Db.Rooms.AnyAsync(x => x.Number == number && x.Id != id)) return Msg(409, "Số phòng đã tồn tại.");
        if (!d.IsActive && r.IsActive)
        {
            if (r.Status == RoomStatus.Occupied) return Msg(409, "Phòng đang có khách, chưa thể ngừng hoạt động.");
            var future = await Db.Bookings.CountAsync(b => b.RoomId == id && b.Status == BookingStatus.Confirmed && b.CheckOut > Clock.Today);
            if (future > 0) return Msg(409, $"Phòng còn {future} booking sắp tới. Hãy đổi phòng cho các booking đó trước.");
        }
        r.Number = number; r.Floor = d.Floor; r.RoomTypeId = d.RoomTypeId; r.IsActive = d.IsActive;
        Log("ROOM_UPDATE", $"Phòng {r.Number}: hoạt động = {r.IsActive}");
        await Db.SaveChangesAsync();
        return Ok(new { r.Id });
    }

    // ---------- Dịch vụ ----------
    [HttpGet("services")]
    public async Task<IActionResult> Services() => Ok(await Db.Services.AsNoTracking().OrderBy(s => s.Name).ToListAsync());

    [HttpPost("services")]
    public async Task<IActionResult> CreateService(ServiceDto d)
    {
        if (string.IsNullOrWhiteSpace(d.Name) || d.UnitPrice < 0) return Msg(400, "Cần tên dịch vụ và đơn giá không âm.");
        var s = new HotelService { Name = d.Name.Trim(), Unit = string.IsNullOrWhiteSpace(d.Unit) ? "lần" : d.Unit.Trim(), UnitPrice = d.UnitPrice, IsActive = d.IsActive };
        Db.Services.Add(s);
        Log("SERVICE_CREATE", $"{s.Name}: {s.UnitPrice:N0}đ/{s.Unit}");
        await Db.SaveChangesAsync();
        return Ok(new { s.Id });
    }

    [HttpPut("services/{id:int}")]
    public async Task<IActionResult> UpdateService(int id, ServiceDto d)
    {
        var s = await Db.Services.FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return Msg(404, "Không tìm thấy dịch vụ.");
        if (string.IsNullOrWhiteSpace(d.Name) || d.UnitPrice < 0) return Msg(400, "Cần tên dịch vụ và đơn giá không âm.");
        if (s.UnitPrice != d.UnitPrice) Log("PRICE_CHANGE", $"Dịch vụ {s.Name}: {s.UnitPrice:N0}đ -> {d.UnitPrice:N0}đ");
        s.Name = d.Name.Trim(); s.Unit = string.IsNullOrWhiteSpace(d.Unit) ? s.Unit : d.Unit.Trim(); s.UnitPrice = d.UnitPrice; s.IsActive = d.IsActive;
        await Db.SaveChangesAsync();
        return Ok(new { s.Id });
    }

    // ---------- FR10: tài khoản ----------
    [HttpGet("users")]
    public async Task<IActionResult> Users() =>
        Ok((await Db.Users.AsNoTracking().OrderBy(u => u.Role).ThenBy(u => u.Username).ToListAsync())
            .Select(u => new { u.Id, u.Username, u.FullName, role = u.Role.ToString(), u.IsActive, u.Phone, u.Email }));

    [HttpPost("users")]
    public async Task<IActionResult> CreateStaff(StaffDto d)
    {
        var name = (d.Username ?? "").Trim().ToLower();
        if (name.Length < 3 || (d.Password ?? "").Length < 6 || string.IsNullOrWhiteSpace(d.FullName))
            return Msg(400, "Cần tên đăng nhập (>=3 ký tự), mật khẩu (>=6 ký tự) và họ tên.");
        if (d.Role == Role.Guest) return Msg(400, "Tài khoản khách hàng tự đăng ký, không tạo tại đây.");
        if (await Db.Users.AnyAsync(u => u.Username == name)) return Msg(409, "Tên đăng nhập đã tồn tại.");
        var u = new AppUser { Username = name, PasswordHash = BCrypt.Net.BCrypt.HashPassword(d.Password), FullName = d.FullName.Trim(), Role = d.Role, Phone = d.Phone, Email = d.Email, CreatedAt = Clock.Now };
        Db.Users.Add(u);
        Log("USER_CREATE", $"{u.Username} ({u.Role})");
        await Db.SaveChangesAsync();
        return Ok(new { u.Id });
    }

    [HttpPut("users/{id:int}/active")]
    public async Task<IActionResult> SetActive(int id, ActiveDto d)
    {
        if (id == UserId) return Msg(409, "Không thể tự khóa tài khoản của chính mình.");
        var u = await Db.Users.FirstOrDefaultAsync(x => x.Id == id);
        if (u == null) return Msg(404, "Không tìm thấy tài khoản.");
        u.IsActive = d.IsActive;
        Log(d.IsActive ? "USER_UNLOCK" : "USER_LOCK", u.Username);
        await Db.SaveChangesAsync();
        return Ok(new { u.Id, u.IsActive });
    }

    [HttpPost("users/{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        var u = await Db.Users.FirstOrDefaultAsync(x => x.Id == id);
        if (u == null) return Msg(404, "Không tìm thấy tài khoản.");
        const string chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var temp = new string(Enumerable.Range(0, 10).Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(temp);
        Log("USER_RESET_PASSWORD", u.Username);
        await Db.SaveChangesAsync();
        return Ok(new { u.Username, tempPassword = temp });
    }

    // ---------- FR11: dashboard ----------
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(DateOnly? from, DateOnly? to)
    {
        var today = Clock.Today;
        var f = from ?? new DateOnly(today.Year, today.Month, 1);
        var t = to ?? today;
        if (t < f) return Msg(400, "Ngày kết thúc phải từ ngày bắt đầu trở đi.");
        if (t.DayNumber - f.DayNumber > 366) return Msg(400, "Khoảng thống kê tối đa 1 năm.");

        var fromDt = f.ToDateTime(TimeOnly.MinValue);
        var toDt = t.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var toEx = t.AddDays(1);

        var invoices = await Db.Invoices.AsNoTracking().Where(i => i.IssuedAt >= fromDt && i.IssuedAt < toDt).ToListAsync();
        var created = await Db.Bookings.CountAsync(b => b.CreatedAt >= fromDt && b.CreatedAt < toDt);
        var cancelled = await Db.Bookings.CountAsync(b => b.CreatedAt >= fromDt && b.CreatedAt < toDt && b.Status == BookingStatus.Cancelled);
        var stays = await Db.Bookings.AsNoTracking()
            .Where(b => (b.Status == BookingStatus.CheckedIn || b.Status == BookingStatus.CheckedOut) && b.CheckIn < toEx && f < b.CheckOut)
            .Select(b => new { b.CheckIn, b.CheckOut }).ToListAsync();
        var activeRooms = await Db.Rooms.CountAsync(r => r.IsActive);

        var days = Enumerable.Range(0, t.DayNumber - f.DayNumber + 1).Select(i => f.AddDays(i)).ToList();
        var byDay = days.Select(d => new
        {
            date = d,
            revenue = invoices.Where(i => DateOnly.FromDateTime(i.IssuedAt) == d).Sum(i => i.Total),
            occupiedRooms = stays.Count(s => s.CheckIn <= d && d < s.CheckOut)
        }).ToList();

        var occupiedNights = byDay.Sum(x => x.occupiedRooms);
        var capacity = activeRooms * days.Count;
        return Ok(new
        {
            from = f, to = t,
            revenue = invoices.Sum(i => i.Total),
            invoiceCount = invoices.Count,
            bookingsCreated = created,
            bookingsCancelled = cancelled,
            activeRooms,
            occupiedNights,
            occupancyPercent = capacity == 0 ? 0 : Math.Round(100.0 * occupiedNights / capacity, 1),
            byDay
        });
    }

    // ---------- FR12: System Log ----------
    [HttpGet("logs")]
    public async Task<IActionResult> Logs(string? q, int take = 200)
    {
        var query = Db.SystemLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var k = q.Trim().ToLower();
            query = query.Where(l => l.Action.ToLower().Contains(k) || l.Detail.ToLower().Contains(k) || l.Username.ToLower().Contains(k));
        }
        return Ok(await query.OrderByDescending(l => l.At).Take(Math.Clamp(take, 1, 500)).ToListAsync());
    }

    // ---------- Bảng giá theo mùa / ngày trong tuần ----------
    private static readonly string[] Days = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };

    private static string? ValidateRate(RateDto d)
    {
        if (string.IsNullOrWhiteSpace(d.Name)) return "Cần đặt tên cho quy tắc giá.";
        if (d.Mode != "Percent" && d.Mode != "Fixed") return "Kiểu giá không hợp lệ.";
        if (d.Mode == "Percent" && (d.Value < -90 || d.Value > 500)) return "Phần trăm điều chỉnh phải từ -90 đến 500.";
        if (d.Mode == "Fixed" && d.Value <= 0) return "Giá cố định phải lớn hơn 0.";
        if (d.StartDate != null && d.EndDate != null && d.EndDate < d.StartDate) return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
        if (!string.IsNullOrWhiteSpace(d.DaysOfWeek) &&
            d.DaysOfWeek.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Any(x => !Days.Contains(x, StringComparer.OrdinalIgnoreCase)))
            return "Ngày trong tuần không hợp lệ (dùng Mon,Tue,Wed,Thu,Fri,Sat,Sun).";
        return null;
    }

    [HttpGet("rates")]
    public async Task<IActionResult> Rates() =>
        Ok((await Db.RateRules.Include(r => r.RoomType).AsNoTracking().OrderByDescending(r => r.Priority).ThenBy(r => r.Id).ToListAsync())
            .Select(r => new
            {
                r.Id, r.RoomTypeId, roomType = r.RoomType?.Name, r.Name, r.StartDate, r.EndDate,
                r.DaysOfWeek, r.Mode, r.Value, r.Priority, r.IsActive
            }));

    [HttpPost("rates")]
    public async Task<IActionResult> CreateRate(RateDto d)
    {
        var err = ValidateRate(d); if (err != null) return Msg(400, err);
        if (d.RoomTypeId != null && !await Db.RoomTypes.AnyAsync(t => t.Id == d.RoomTypeId)) return Msg(400, "Loại phòng không hợp lệ.");
        var r = new RateRule
        {
            RoomTypeId = d.RoomTypeId, Name = d.Name.Trim(), StartDate = d.StartDate, EndDate = d.EndDate,
            DaysOfWeek = string.IsNullOrWhiteSpace(d.DaysOfWeek) ? null : d.DaysOfWeek.Trim(),
            Mode = d.Mode, Value = d.Value, Priority = d.Priority, IsActive = d.IsActive
        };
        Db.RateRules.Add(r);
        Log("RATE_CREATE", $"{r.Name}: {r.Mode} {r.Value:N0}, ưu tiên {r.Priority}");
        await Db.SaveChangesAsync();
        return Ok(new { r.Id });
    }

    [HttpPut("rates/{id:int}")]
    public async Task<IActionResult> UpdateRate(int id, RateDto d)
    {
        var err = ValidateRate(d); if (err != null) return Msg(400, err);
        var r = await Db.RateRules.FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return Msg(404, "Không tìm thấy quy tắc giá.");
        if (d.RoomTypeId != null && !await Db.RoomTypes.AnyAsync(t => t.Id == d.RoomTypeId)) return Msg(400, "Loại phòng không hợp lệ.");
        r.RoomTypeId = d.RoomTypeId; r.Name = d.Name.Trim(); r.StartDate = d.StartDate; r.EndDate = d.EndDate;
        r.DaysOfWeek = string.IsNullOrWhiteSpace(d.DaysOfWeek) ? null : d.DaysOfWeek.Trim();
        r.Mode = d.Mode; r.Value = d.Value; r.Priority = d.Priority; r.IsActive = d.IsActive;
        Log("RATE_UPDATE", $"{r.Name}: {r.Mode} {r.Value:N0}, ưu tiên {r.Priority}, bật = {r.IsActive} (booking cũ giữ giá đã chốt)");
        await Db.SaveChangesAsync();
        return Ok(new { r.Id });
    }

    /// <summary>Xem trước giá từng đêm của một hạng phòng để kiểm tra các quy tắc.</summary>
    [HttpGet("rates/preview")]
    public async Task<IActionResult> RatePreview(int roomTypeId, DateOnly? from, int days = 14)
    {
        var t = await Db.RoomTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == roomTypeId);
        if (t == null) return Msg(404, "Không tìm thấy loại phòng.");
        days = Math.Clamp(days, 1, 62);
        var f = from ?? Clock.Today;
        var rules = await Db.RateRules.AsNoTracking().Where(r => r.IsActive).ToListAsync();
        return Ok(Pricing.Nights(t, rules, f, f.AddDays(days)).Select(x => new { date = x.Date, price = x.Price, isBase = x.Price == t.BasePrice }));
    }
}
