using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using HotelApi.Data;
using HotelApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HotelApi.Services;

/// <summary>Giờ Việt Nam (UTC+7), Kind = Unspecified để khớp cột "timestamp without time zone".</summary>
public static class Clock
{
    public static DateTime Now => DateTime.SpecifyKind(DateTime.UtcNow.AddHours(7), DateTimeKind.Unspecified);
    public static DateOnly Today => DateOnly.FromDateTime(Now);
}

/// <summary>Chính sách GIẢ ĐỊNH của khách sạn (ghi vào SRS mục Business Rules).</summary>
public static class Policy
{
    public const int CheckInHour = 14;        // nhận phòng từ 14:00
    public const int CheckOutHour = 12;       // trả phòng trước 12:00
    public const int FreeCancelHours = 24;    // hủy miễn phí nếu trước 14:00 ngày đến ít nhất 24 giờ
    public const int MaxNights = 30;
    public static readonly string[] PaymentMethods = { "Cash", "Card", "Transfer" };
}

public static class Rules
{
    public static string? ValidateStay(DateOnly checkIn, DateOnly checkOut, int guests, DateOnly today)
    {
        if (checkOut <= checkIn) return "Ngày đi phải sau ngày đến.";
        if (checkIn < today) return "Ngày đến không được ở quá khứ.";
        if (checkOut.DayNumber - checkIn.DayNumber > Policy.MaxNights) return $"Tối đa {Policy.MaxNights} đêm cho mỗi lần đặt.";
        if (guests < 1) return "Số khách tối thiểu là 1.";
        return null;
    }

    /// <summary>Hủy sớm hơn 24h so với 14:00 ngày đến: miễn phí. Muộn hơn: phí 1 đêm.</summary>
    public static decimal CancellationFee(Booking b, DateTime now)
    {
        var deadline = b.CheckIn.ToDateTime(new TimeOnly(Policy.CheckInHour, 0)).AddHours(-Policy.FreeCancelHours);
        return now <= deadline ? 0 : b.NightlyRate;
    }

    public static string Vi(RoomStatus s) => s switch
    {
        RoomStatus.Ready => "Sẵn sàng",
        RoomStatus.Occupied => "Đang có khách",
        RoomStatus.Cleaning => "Đang dọn",
        RoomStatus.Maintenance => "Bảo trì",
        _ => s.ToString()
    };
}

/// <summary>Tính giá từng đêm theo quy tắc giá (mùa, ngày trong tuần). Giá làm tròn đến nghìn đồng.</summary>
public static class Pricing
{
    public static decimal NightPrice(RoomType t, IEnumerable<RateRule> rules, DateOnly d)
    {
        var r = rules
            .Where(x => x.IsActive
                        && (x.RoomTypeId == null || x.RoomTypeId == t.Id)
                        && (x.StartDate == null || d >= x.StartDate)
                        && (x.EndDate == null || d <= x.EndDate)
                        && DayMatches(x.DaysOfWeek, d))
            .OrderByDescending(x => x.Priority)
            .ThenByDescending(x => x.RoomTypeId != null)
            .ThenByDescending(x => x.Id)
            .FirstOrDefault();
        if (r == null) return t.BasePrice;
        var p = r.Mode == "Fixed" ? r.Value : t.BasePrice * (1 + r.Value / 100m);
        return Math.Round(Math.Max(0, p) / 1000m, MidpointRounding.AwayFromZero) * 1000m;
    }

    public static List<(DateOnly Date, decimal Price)> Nights(RoomType t, IEnumerable<RateRule> rules, DateOnly from, DateOnly to)
    {
        var list = new List<(DateOnly, decimal)>();
        var rs = rules.ToList();
        for (var d = from; d < to; d = d.AddDays(1)) list.Add((d, NightPrice(t, rs, d)));
        return list;
    }

    public static bool DayMatches(string? days, DateOnly d)
    {
        if (string.IsNullOrWhiteSpace(days)) return true;
        var key = d.DayOfWeek.ToString()[..3];
        return days.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Any(x => string.Equals(x, key, StringComparison.OrdinalIgnoreCase));
    }
}

/// <summary>Quy tắc chuyển trạng thái phòng THỦ CÔNG. Occupied chỉ do check-in/đổi phòng đặt; Cleaning sau check-out do hệ thống đặt.</summary>
public static class RoomStates
{
    private static readonly Dictionary<RoomStatus, RoomStatus[]> Manual = new()
    {
        [RoomStatus.Ready] = new[] { RoomStatus.Cleaning, RoomStatus.Maintenance },
        [RoomStatus.Cleaning] = new[] { RoomStatus.Ready, RoomStatus.Maintenance },
        [RoomStatus.Maintenance] = new[] { RoomStatus.Cleaning },   // sửa xong phải dọn trước khi dùng
        [RoomStatus.Occupied] = Array.Empty<RoomStatus>()
    };

    public static bool CanManual(RoomStatus from, RoomStatus to) => Manual[from].Contains(to);

    /// <summary>Buồng phòng chỉ được: Đang dọn -> Sẵn sàng, hoặc báo hỏng (Đang dọn -> Bảo trì).</summary>
    public static bool HousekeepingCan(RoomStatus from, RoomStatus to) =>
        from == RoomStatus.Cleaning && (to == RoomStatus.Ready || to == RoomStatus.Maintenance);
}

public static class AvailabilityQuery
{
    /// <summary>
    /// Phòng KHẢ DỤNG theo khoảng ngày [from, to): đang hoạt động, không bảo trì, đủ sức chứa
    /// và không có booking hợp lệ (Confirmed/CheckedIn) chồng lấn. Khác với "trống vật lý" (Room.Status).
    /// </summary>
    public static IQueryable<Room> FreeRooms(AppDbContext db, DateOnly from, DateOnly to, int guests,
        int? roomTypeId = null, int? excludeBookingId = null)
    {
        var busy = db.Bookings
            .Where(b => (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.CheckedIn)
                        && b.CheckIn < to && from < b.CheckOut
                        && (excludeBookingId == null || b.Id != excludeBookingId))
            .Select(b => b.RoomId);

        return db.Rooms.Include(r => r.RoomType)
            .Where(r => r.IsActive && r.RoomType.IsActive
                        && r.Status != RoomStatus.Maintenance
                        && r.RoomType.Capacity >= guests
                        && (roomTypeId == null || r.RoomTypeId == roomTypeId)
                        && !busy.Contains(r.Id));
    }
}

public record BookingDto(int Id, string Code, string Status, DateOnly CheckIn, DateOnly CheckOut, int Guests, int Nights,
    decimal NightlyRate, decimal EstimatedTotal, string GuestName, string? Phone, string? Email, string? IdNumber,
    int RoomId, string RoomNumber, string RoomType, decimal CancellationFee, string? CancelReason,
    DateTime CreatedAt, DateTime? ActualCheckIn, DateTime? ActualCheckOut);

public static class Mapping
{
    public static IQueryable<Booking> WithAll(this IQueryable<Booking> q) =>
        q.Include(b => b.GuestProfile).Include(b => b.Room).ThenInclude(r => r.RoomType);

    public static BookingDto Dto(Booking b)
    {
        var nights = b.CheckOut.DayNumber - b.CheckIn.DayNumber;
        return new BookingDto(b.Id, b.Code, b.Status.ToString(), b.CheckIn, b.CheckOut, b.Guests, nights,
            b.NightlyRate, b.RoomTotal, b.GuestProfile.FullName, b.GuestProfile.Phone, b.GuestProfile.Email,
            b.GuestProfile.IdNumber, b.RoomId, b.Room.Number, b.Room.RoomType.Name, b.CancellationFee, b.CancelReason,
            b.CreatedAt, b.ActualCheckIn, b.ActualCheckOut);
    }
}

public class TokenService
{
    private readonly IConfiguration _cfg;
    public TokenService(IConfiguration cfg) { _cfg = cfg; }

    public string Create(AppUser u)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Key"]!));
        var claims = new[]
        {
            new Claim("uid", u.Id.ToString()),
            new Claim(ClaimTypes.Name, u.Username),
            new Claim(ClaimTypes.Role, u.Role.ToString())
        };
        var token = new JwtSecurityToken(_cfg["Jwt:Issuer"], _cfg["Jwt:Issuer"], claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record InvoiceLine(string Type, string Description, decimal Quantity, decimal UnitPrice, decimal Amount);
public record InvoiceCalc(List<InvoiceLine> Lines, decimal RoomCharge, decimal ServiceCharge, decimal Surcharge,
    decimal Discount, decimal Total, DateOnly EndDate);

public class BillingService
{
    private readonly AppDbContext _db;
    public BillingService(AppDbContext db) { _db = db; }

    private record NightRow(string RoomNumber, int RoomId, DateOnly Date, decimal Price);

    /// <summary>Gom các đêm liên tiếp cùng phòng, cùng giá thành một dòng hóa đơn.</summary>
    private static decimal AddRoomLines(List<InvoiceLine> lines, IEnumerable<NightRow> rows, string suffix)
    {
        decimal total = 0;
        NightRow? first = null, prev = null;
        var count = 0;

        void Flush()
        {
            if (first == null) return;
            var amt = count * first.Price;
            total += amt;
            lines.Add(new InvoiceLine("Room", $"Phòng {first.RoomNumber} ({first.Date:dd/MM} - {prev!.Date.AddDays(1):dd/MM}){suffix}", count, first.Price, amt));
            first = null; count = 0;
        }

        foreach (var r in rows)
        {
            if (first != null && (r.RoomId != first.RoomId || r.Price != first.Price || r.Date != prev!.Date.AddDays(1))) Flush();
            first ??= r;
            count++;
            prev = r;
        }
        Flush();
        return total;
    }

    /// <summary>
    /// Tiền phòng = tổng giá từng đêm đã chốt khi đặt (BookingNights; đổi phòng được cập nhật theo đêm).
    /// Trả phòng sớm vẫn tính đủ số đêm đã đặt; ở quá hạn tính thêm đêm theo bảng giá hiện hành của phòng đang ở.
    /// Booking phải được nạp kèm Room (và Room.RoomType nếu có thể ở quá hạn).
    /// </summary>
    public async Task<InvoiceCalc> Calculate(Booking b, DateOnly today, decimal surcharge, string? surchargeNote, decimal discount)
    {
        var lines = new List<InvoiceLine>();
        var end = today > b.CheckOut ? today : b.CheckOut;

        var nights = await _db.BookingNights.Include(n => n.Room).Where(n => n.BookingId == b.Id).OrderBy(n => n.Date).ToListAsync();
        var room = AddRoomLines(lines, nights.Select(n => new NightRow(n.Room.Number, n.RoomId, n.Date, n.Price)), "");

        if (today > b.CheckOut)
        {
            var type = b.Room.RoomType ?? await _db.RoomTypes.FirstAsync(t => t.Id == b.Room.RoomTypeId);
            var rules = await _db.RateRules.AsNoTracking().Where(r => r.IsActive).ToListAsync();
            var extra = Pricing.Nights(type, rules, b.CheckOut, today).Select(x => new NightRow(b.Room.Number, b.RoomId, x.Date, x.Price));
            room += AddRoomLines(lines, extra, " - ở quá hạn");
        }

        var usages = await _db.ServiceUsages.Include(u => u.HotelService)
            .Where(u => u.BookingId == b.Id).OrderBy(u => u.UsedAt).ToListAsync();
        decimal svc = 0;
        foreach (var u in usages)
        {
            var amt = u.Quantity * u.UnitPrice; svc += amt;
            lines.Add(new InvoiceLine("Service", $"{u.HotelService.Name} ({u.UsedAt:dd/MM HH:mm})", u.Quantity, u.UnitPrice, amt));
        }

        if (surcharge > 0) lines.Add(new InvoiceLine("Surcharge", string.IsNullOrWhiteSpace(surchargeNote) ? "Phụ thu" : surchargeNote!, 1, surcharge, surcharge));
        var gross = room + svc + surcharge;
        var disc = Math.Min(discount, gross);
        if (disc > 0) lines.Add(new InvoiceLine("Discount", "Giảm trừ", 1, -disc, -disc));

        return new InvoiceCalc(lines, room, svc, surcharge, disc, gross - disc, end);
    }

    public static string Serialize(List<InvoiceLine> lines) => JsonSerializer.Serialize(lines);
    public static List<InvoiceLine> Deserialize(string json) =>
        JsonSerializer.Deserialize<List<InvoiceLine>>(json) ?? new();
}
