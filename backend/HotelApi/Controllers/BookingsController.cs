using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Controllers;

public record CreateBookingDto(int RoomTypeId, DateOnly CheckIn, DateOnly CheckOut, int Guests,
    string? GuestName, string? Phone, string? Email, string? IdNumber);
public record CancelDto(string? Reason);

[Authorize, Route("api/bookings")]
public class BookingsController : ApiBase
{
    public BookingsController(AppDbContext db) : base(db) { }

    private static readonly char[] CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();
    private async Task<string> NewCode()
    {
        while (true)
        {
            var code = "HB" + new string(Enumerable.Range(0, 6).Select(_ => CodeChars[Random.Shared.Next(CodeChars.Length)]).ToArray());
            if (!await Db.Bookings.AnyAsync(b => b.Code == code)) return code;
        }
    }

    [HttpPost, Authorize(Roles = "Guest,Receptionist,Admin")]
    public async Task<IActionResult> Create(CreateBookingDto dto)
    {
        var err = Rules.ValidateStay(dto.CheckIn, dto.CheckOut, dto.Guests, Clock.Today);
        if (err != null) return Msg(400, err);

        var type = await Db.RoomTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == dto.RoomTypeId && t.IsActive);
        if (type == null) return Msg(404, "Loại phòng không tồn tại hoặc đã ngừng hoạt động.");
        if (dto.Guests > type.Capacity) return Msg(400, $"Loại phòng {type.Name} chứa tối đa {type.Capacity} khách.");

        int? ownerId = null; string? name = dto.GuestName?.Trim(), phone = dto.Phone?.Trim(), email = dto.Email?.Trim();
        if (InRole(Role.Guest))
        {
            var u = await Db.Users.AsNoTracking().FirstAsync(x => x.Id == UserId);
            ownerId = u.Id;
            if (string.IsNullOrEmpty(name)) name = u.FullName;
            if (string.IsNullOrEmpty(phone)) phone = u.Phone;
            if (string.IsNullOrEmpty(email)) email = u.Email;
        }
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(phone))
            return Msg(400, "Cần họ tên và số điện thoại của khách.");

        var rules = await Db.RateRules.AsNoTracking().Where(r => r.IsActive).ToListAsync();
        var nightPrices = Pricing.Nights(type, rules, dto.CheckIn, dto.CheckOut);
        var roomTotal = nightPrices.Sum(x => x.Price);
        var avgRate = Math.Round(roomTotal / nightPrices.Count);

        var candidates = await AvailabilityQuery.FreeRooms(Db, dto.CheckIn, dto.CheckOut, dto.Guests, type.Id)
            .AsNoTracking().OrderBy(r => r.Number).Select(r => new { r.Id, r.Number }).ToListAsync();
        if (candidates.Count == 0) return Msg(409, "Không còn phòng trống loại này trong khoảng ngày đã chọn.");

        foreach (var room in candidates)
        {
            var booking = new Booking
            {
                Code = await NewCode(), UserId = ownerId, RoomId = room.Id,
                GuestProfile = new GuestProfile { FullName = name!, Phone = phone, Email = email, IdNumber = dto.IdNumber?.Trim() },
                CheckIn = dto.CheckIn, CheckOut = dto.CheckOut, Guests = dto.Guests,
                NightlyRate = avgRate, RoomTotal = roomTotal, Status = BookingStatus.Confirmed, CreatedAt = Clock.Now
            };
            booking.Segments.Add(new StaySegment { RoomId = room.Id, FromDate = dto.CheckIn, NightlyRate = avgRate });
            foreach (var (date, price) in nightPrices)
                booking.Nights.Add(new BookingNight { RoomId = room.Id, Date = date, Price = price });
            Db.Bookings.Add(booking);
            Log("BOOKING_CREATE", $"{booking.Code}: phòng {room.Number}, {dto.CheckIn:dd/MM/yyyy} - {dto.CheckOut:dd/MM/yyyy}");
            try
            {
                await Db.SaveChangesAsync();
                var saved = await Db.Bookings.WithAll().AsNoTracking().FirstAsync(b => b.Id == booking.Id);
                return Ok(Mapping.Dto(saved));
            }
            catch (DbUpdateException e) when (IsOverlap(e))
            {
                Db.ChangeTracker.Clear(); // có người vừa giữ phòng này, thử phòng kế tiếp
            }
        }
        return Msg(409, "Phòng vừa được người khác đặt. Hãy tìm lại.");
    }

    /// <summary>Guest: chỉ thấy booking của mình. Nhân viên: lọc theo trạng thái / từ khóa (mã, tên, SĐT, số phòng).</summary>
    [HttpGet]
    public async Task<IActionResult> List(string? status, string? q)
    {
        var query = Db.Bookings.WithAll().AsNoTracking().AsQueryable();
        if (InRole(Role.Guest)) query = query.Where(b => b.UserId == UserId);
        else if (InRole(Role.Housekeeping)) return Forbid();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<BookingStatus>(status, out var st))
            query = query.Where(b => b.Status == st);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var k = q.Trim().ToLower();
            query = query.Where(b => b.Code.ToLower().Contains(k) || b.GuestProfile.FullName.ToLower().Contains(k)
                                     || (b.GuestProfile.Phone ?? "").Contains(k) || b.Room.Number.Contains(k));
        }
        var list = await query.OrderByDescending(b => b.CheckIn).ThenByDescending(b => b.Id).Take(200).ToListAsync();
        return Ok(list.Select(Mapping.Dto));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id)
    {
        var b = await Db.Bookings.WithAll().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (InRole(Role.Guest) && b.UserId != UserId) return Msg(403, "Bạn không có quyền xem booking này.");
        if (InRole(Role.Housekeeping)) return Forbid();

        var segments = await Db.StaySegments.Include(s => s.Room).AsNoTracking()
            .Where(s => s.BookingId == id).OrderBy(s => s.FromDate).ToListAsync();
        var services = await Db.ServiceUsages.Include(u => u.HotelService).AsNoTracking()
            .Where(u => u.BookingId == id).OrderBy(u => u.UsedAt).ToListAsync();
        var inv = await Db.Invoices.Include(i => i.Payments).AsNoTracking().FirstOrDefaultAsync(i => i.BookingId == id);
        var nights = await Db.BookingNights.Include(n => n.Room).AsNoTracking()
            .Where(n => n.BookingId == id).OrderBy(n => n.Date).ToListAsync();

        return Ok(new
        {
            booking = Mapping.Dto(b),
            nights = nights.Select(n => new { n.Date, room = n.Room.Number, n.Price }),
            segments = segments.Select(s => new { room = s.Room.Number, from = s.FromDate, to = s.ToDate, nightlyRate = s.NightlyRate }),
            services = services.Select(u => new { u.Id, name = u.HotelService.Name, unit = u.HotelService.Unit, u.Quantity, u.UnitPrice, u.UsedAt, amount = u.Quantity * u.UnitPrice }),
            invoice = inv == null ? null : new
            {
                inv.Number, inv.RoomCharge, inv.ServiceCharge, inv.Surcharge, inv.Discount, inv.Total, inv.IssuedAt,
                method = inv.Payments.FirstOrDefault()?.Method,
                lines = BillingService.Deserialize(inv.LinesJson)
            }
        });
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancelDto dto)
    {
        if (InRole(Role.Housekeeping)) return Forbid();
        var b = await Db.Bookings.FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (InRole(Role.Guest) && b.UserId != UserId) return Msg(403, "Bạn không có quyền hủy booking này.");
        if (b.Status != BookingStatus.Confirmed)
            return Msg(409, "Chỉ hủy được booking đang ở trạng thái 'Đã xác nhận' (chưa check-in).");

        b.CancellationFee = Rules.CancellationFee(b, Clock.Now);
        b.Status = BookingStatus.Cancelled;
        b.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason) ? "Không nêu lý do" : dto!.Reason!.Trim();
        Log("BOOKING_CANCEL", $"{b.Code}: {b.CancelReason}; phí hủy {b.CancellationFee:N0}đ");
        await Db.SaveChangesAsync();
        return Ok(new { b.Code, status = b.Status.ToString(), b.CancellationFee });
    }
}
