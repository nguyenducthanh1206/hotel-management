using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Controllers;

public record LookupCancelDto(string Code, string Phone, string? Reason);

[Route("api/public")]
public class PublicController : ApiBase
{
    public PublicController(AppDbContext db) : base(db) { }

    /// <summary>Tra cứu công khai: hạng phòng còn khả dụng theo ngày đến, ngày đi, số khách, kèm giá từng đêm theo bảng giá.</summary>
    [HttpGet("availability")]
    public async Task<IActionResult> Availability(DateOnly checkIn, DateOnly checkOut, int guests = 1)
    {
        var err = Rules.ValidateStay(checkIn, checkOut, guests, Clock.Today);
        if (err != null) return Msg(400, err);

        var free = await AvailabilityQuery.FreeRooms(Db, checkIn, checkOut, guests).ToListAsync();
        var rules = await Db.RateRules.AsNoTracking().Where(r => r.IsActive).ToListAsync();
        var nights = checkOut.DayNumber - checkIn.DayNumber;
        var types = await Db.RoomTypes.Include(t => t.Amenities)
            .Where(t => t.IsActive && t.Capacity >= guests).OrderBy(t => t.BasePrice).ToListAsync();

        var result = types.Select(t =>
        {
            var np = Pricing.Nights(t, rules, checkIn, checkOut);
            var total = np.Sum(x => x.Price);
            return new
            {
                t.Id, t.Name, t.Description, t.Details, t.Capacity, t.BasePrice, t.AreaM2, t.BedType, t.ViewName,
                amenities = t.Amenities.Select(a => a.Name).OrderBy(x => x),
                nights,
                total,
                avgNightly = nights == 0 ? t.BasePrice : Math.Round(total / nights),
                nightPrices = np.Select(x => new { date = x.Date, price = x.Price }),
                availableRooms = free.Count(r => r.RoomTypeId == t.Id)
            };
        });
        return Ok(result);
    }

    /// <summary>Số phòng còn trống cho từng đêm trong [from, to), dùng cho lịch chọn ngày.</summary>
    [HttpGet("calendar")]
    public async Task<IActionResult> Calendar(DateOnly from, DateOnly to, int guests = 1)
    {
        if (to <= from || to.DayNumber - from.DayNumber > 100) return Msg(400, "Khoảng ngày không hợp lệ.");
        guests = Math.Max(1, guests);

        var roomIds = await Db.Rooms.AsNoTracking()
            .Where(r => r.IsActive && r.RoomType.IsActive && r.Status != RoomStatus.Maintenance && r.RoomType.Capacity >= guests)
            .Select(r => r.Id).ToListAsync();
        var busy = await Db.Bookings.AsNoTracking()
            .Where(b => (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.CheckedIn) && b.CheckIn < to && from < b.CheckOut)
            .Select(b => new { b.RoomId, b.CheckIn, b.CheckOut }).ToListAsync();

        var days = new List<object>();
        for (var d = from; d < to; d = d.AddDays(1))
        {
            var taken = busy.Where(b => b.CheckIn <= d && d < b.CheckOut && roomIds.Contains(b.RoomId)).Select(b => b.RoomId).Distinct().Count();
            days.Add(new { date = d, available = roomIds.Count - taken });
        }
        return Ok(days);
    }

    /// <summary>Danh sách dịch vụ đang cung cấp (hiển thị công khai trên trang chủ).</summary>
    [HttpGet("services")]
    public async Task<IActionResult> Services() =>
        Ok(await Db.Services.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.UnitPrice)
            .Select(s => new { s.Id, s.Name, s.Unit, s.UnitPrice }).ToListAsync());

    // ---- Tra cứu / hủy bằng mã + số điện thoại (không cần đăng nhập) ----
    private static string Digits(string? s) => new((s ?? "").Where(char.IsDigit).ToArray());

    private async Task<Booking?> FindByCodeAndPhone(string? code, string? phone)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        var d = Digits(phone);
        if (c.Length == 0 || d.Length < 6) return null;
        var b = await Db.Bookings.WithAll().FirstOrDefaultAsync(x => x.Code == c);
        return b != null && Digits(b.GuestProfile.Phone) == d ? b : null;
    }

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup(string? code, string? phone)
    {
        var b = await FindByCodeAndPhone(code, phone);
        if (b == null) return Msg(404, "Không tìm thấy booking với mã và số điện thoại này.");

        var nights = await Db.BookingNights.Include(n => n.Room).AsNoTracking()
            .Where(n => n.BookingId == b.Id).OrderBy(n => n.Date).ToListAsync();
        var inv = await Db.Invoices.Include(i => i.Payments).AsNoTracking().FirstOrDefaultAsync(i => i.BookingId == b.Id);
        return Ok(new
        {
            booking = Mapping.Dto(b),
            nights = nights.Select(n => new { n.Date, room = n.Room.Number, n.Price }),
            invoice = inv == null ? null : new
            {
                inv.Number, inv.RoomCharge, inv.ServiceCharge, inv.Surcharge, inv.Discount, inv.Total, inv.IssuedAt,
                method = inv.Payments.FirstOrDefault()?.Method,
                lines = BillingService.Deserialize(inv.LinesJson)
            }
        });
    }

    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel(LookupCancelDto dto)
    {
        var b = await FindByCodeAndPhone(dto.Code, dto.Phone);
        if (b == null) return Msg(404, "Không tìm thấy booking với mã và số điện thoại này.");
        if (b.Status != BookingStatus.Confirmed)
            return Msg(409, "Chỉ hủy được booking đang ở trạng thái 'Đã xác nhận' (chưa check-in).");

        b.CancellationFee = Rules.CancellationFee(b, Clock.Now);
        b.Status = BookingStatus.Cancelled;
        b.CancelReason = string.IsNullOrWhiteSpace(dto.Reason) ? "Khách hủy qua tra cứu" : dto.Reason!.Trim();
        Log("BOOKING_CANCEL", $"{b.Code}: {b.CancelReason}; phí hủy {b.CancellationFee:N0}đ (tra cứu bằng mã + SĐT)");
        await Db.SaveChangesAsync();
        return Ok(new { b.Code, status = b.Status.ToString(), b.CancellationFee });
    }
}
