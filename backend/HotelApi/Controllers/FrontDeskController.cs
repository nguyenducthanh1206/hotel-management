using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Controllers;

public record CheckInDto(string? IdNumber);
public record AddServiceDto(int ServiceId, int Quantity);
public record ChangeRoomDto(int NewRoomId, string? Reason);
public record CheckOutDto(decimal Surcharge, string? SurchargeNote, decimal Discount, string? PaymentMethod);

[Authorize(Roles = "Receptionist,Admin"), Route("api/frontdesk")]
public class FrontDeskController : ApiBase
{
    private readonly BillingService _billing;
    public FrontDeskController(AppDbContext db, BillingService billing) : base(db) { _billing = billing; }

    [HttpGet("services")]
    public async Task<IActionResult> Services() =>
        Ok(await Db.Services.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.Name).ToListAsync());

    // ---- FR05: check-in ----
    [HttpPost("bookings/{id:int}/check-in")]
    public async Task<IActionResult> CheckIn(int id, CheckInDto? dto)
    {
        var b = await Db.Bookings.Include(x => x.Room).Include(x => x.GuestProfile).FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (b.Status != BookingStatus.Confirmed) return Msg(409, "Chỉ check-in được booking ở trạng thái 'Đã xác nhận'. Booking đã hủy, đã check-in hoặc đã trả phòng không thể check-in.");

        var today = Clock.Today;
        if (today < b.CheckIn) return Msg(409, $"Chưa đến ngày nhận phòng ({b.CheckIn:dd/MM/yyyy}).");
        if (today >= b.CheckOut) return Msg(409, "Booking đã quá hạn lưu trú, không thể check-in.");
        if (!b.Room.IsActive) return Msg(409, $"Phòng {b.Room.Number} đã ngừng hoạt động. Hãy đổi phòng.");
        if (b.Room.Status != RoomStatus.Ready)
            return Msg(409, $"Phòng {b.Room.Number} đang ở trạng thái '{Rules.Vi(b.Room.Status)}', chưa thể check-in. Hãy chờ phòng sẵn sàng hoặc đổi phòng.");

        if (!string.IsNullOrWhiteSpace(dto?.IdNumber)) b.GuestProfile.IdNumber = dto!.IdNumber!.Trim();
        b.Status = BookingStatus.CheckedIn;
        b.ActualCheckIn = Clock.Now;
        SetRoomStatus(b.Room, RoomStatus.Occupied, $"Check-in {b.Code}");
        Log("CHECK_IN", $"{b.Code}: phòng {b.Room.Number}");
        await Db.SaveChangesAsync();
        return Ok(new { b.Code, status = b.Status.ToString() });
    }

    // ---- FR07: dịch vụ phát sinh ----
    [HttpPost("bookings/{id:int}/services")]
    public async Task<IActionResult> AddService(int id, AddServiceDto dto)
    {
        var b = await Db.Bookings.FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (b.Status != BookingStatus.CheckedIn) return Msg(409, "Chỉ ghi dịch vụ cho khách đang lưu trú.");
        if (dto.Quantity < 1 || dto.Quantity > 100) return Msg(400, "Số lượng phải từ 1 đến 100.");
        var svc = await Db.Services.FirstOrDefaultAsync(s => s.Id == dto.ServiceId && s.IsActive);
        if (svc == null) return Msg(404, "Dịch vụ không tồn tại hoặc đã ngừng cung cấp.");

        Db.ServiceUsages.Add(new ServiceUsage
        {
            BookingId = b.Id, HotelServiceId = svc.Id, Quantity = dto.Quantity,
            UnitPrice = svc.UnitPrice, UsedAt = Clock.Now, RecordedByUserId = UserId
        });
        Log("SERVICE_ADD", $"{b.Code}: {svc.Name} x{dto.Quantity} @ {svc.UnitPrice:N0}đ");
        await Db.SaveChangesAsync();
        return Ok(new { message = "Đã ghi nhận dịch vụ." });
    }

    // ---- FR09: đổi phòng ----
    [HttpGet("bookings/{id:int}/available-rooms")]
    public async Task<IActionResult> AvailableRooms(int id)
    {
        var b = await Db.Bookings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        var rooms = await AvailabilityQuery.FreeRooms(Db, b.CheckIn, b.CheckOut, b.Guests, null, b.Id)
            .AsNoTracking().Where(r => r.Status == RoomStatus.Ready && r.Id != b.RoomId)
            .OrderBy(r => r.Number).ToListAsync();
        return Ok(rooms.Select(r => new { r.Id, r.Number, type = r.RoomType.Name, price = r.RoomType.BasePrice }));
    }

    [HttpPost("bookings/{id:int}/change-room")]
    public async Task<IActionResult> ChangeRoom(int id, ChangeRoomDto dto)
    {
        var b = await Db.Bookings.Include(x => x.Room).ThenInclude(r => r.RoomType)
            .Include(x => x.Segments).Include(x => x.Nights).FirstOrDefaultAsync(x => x.Id == id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (b.Status != BookingStatus.Confirmed && b.Status != BookingStatus.CheckedIn)
            return Msg(409, "Chỉ đổi phòng cho booking đang giữ chỗ hoặc đang lưu trú.");

        var nr = await Db.Rooms.Include(r => r.RoomType).FirstOrDefaultAsync(r => r.Id == dto.NewRoomId);
        if (nr == null) return Msg(404, "Không tìm thấy phòng mới.");
        if (nr.Id == b.RoomId) return Msg(400, "Phòng mới trùng phòng hiện tại.");

        var ok = await AvailabilityQuery.FreeRooms(Db, b.CheckIn, b.CheckOut, b.Guests, null, b.Id).AnyAsync(r => r.Id == nr.Id);
        if (!ok || nr.Status != RoomStatus.Ready)
            return Msg(409, $"Phòng {nr.Number} không khả dụng (đang bận, bảo trì, chưa sẵn sàng hoặc không đủ sức chứa).");

        var today = Clock.Today;
        var open = b.Segments.OrderBy(s => s.FromDate).Last();
        var oldRoom = b.Room;

        // Các đêm được chuyển sang phòng mới: toàn bộ nếu chưa check-in, từ hôm nay trở đi nếu đang lưu trú.
        var moving = b.Nights.Where(n => b.Status == BookingStatus.Confirmed || n.Date >= today).ToList();
        // Cùng hạng phòng: giữ giá đã chốt. Khác hạng: tính lại theo bảng giá hiện hành của hạng mới.
        if (nr.RoomTypeId != oldRoom.RoomTypeId)
        {
            var rules = await Db.RateRules.AsNoTracking().Where(r => r.IsActive).ToListAsync();
            foreach (var n in moving) n.Price = Pricing.NightPrice(nr.RoomType, rules, n.Date);
        }
        foreach (var n in moving) { n.RoomId = nr.Id; n.Room = nr; }

        var rate = moving.Count == 0 ? nr.RoomType.BasePrice : Math.Round(moving.Average(n => n.Price));
        b.RoomTotal = b.Nights.Sum(n => n.Price);
        b.NightlyRate = b.Nights.Count == 0 ? rate : Math.Round(b.RoomTotal / b.Nights.Count);

        if (b.Status == BookingStatus.Confirmed)
        {
            open.RoomId = nr.Id; open.NightlyRate = rate;
        }
        else
        {
            open.ToDate = today;
            b.Segments.Add(new StaySegment { RoomId = nr.Id, FromDate = today, NightlyRate = rate });
            SetRoomStatus(oldRoom, RoomStatus.Cleaning, $"Đổi phòng {b.Code}");
            SetRoomStatus(nr, RoomStatus.Occupied, $"Đổi phòng {b.Code}");
        }
        b.Room = nr; b.RoomId = nr.Id;
        Log("ROOM_CHANGE", $"{b.Code}: {oldRoom.Number} -> {nr.Number}; giá {rate:N0}đ/đêm; lý do: {(string.IsNullOrWhiteSpace(dto.Reason) ? "không nêu" : dto.Reason)}");
        try { await Db.SaveChangesAsync(); }
        catch (DbUpdateException e) when (IsOverlap(e)) { return Msg(409, "Phòng mới vừa bị đặt trùng khoảng ngày. Hãy chọn phòng khác."); }
        return Ok(new { b.Code, room = nr.Number, rate });
    }

    // ---- FR08: hóa đơn / check-out ----
    private async Task<Booking?> LoadForBilling(int id) =>
        await Db.Bookings.Include(x => x.Room).ThenInclude(r => r.RoomType).Include(x => x.Segments).ThenInclude(s => s.Room)
            .FirstOrDefaultAsync(x => x.Id == id);

    [HttpGet("bookings/{id:int}/invoice-preview")]
    public async Task<IActionResult> Preview(int id, decimal surcharge = 0, string? note = null, decimal discount = 0)
    {
        var b = await LoadForBilling(id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (b.Status != BookingStatus.CheckedIn) return Msg(409, "Chỉ tạm tính hóa đơn cho khách đang lưu trú.");
        if (surcharge < 0 || discount < 0) return Msg(400, "Phụ thu và giảm trừ không được âm.");
        return Ok(await _billing.Calculate(b, Clock.Today, surcharge, note, discount));
    }

    [HttpPost("bookings/{id:int}/check-out")]
    public async Task<IActionResult> CheckOut(int id, CheckOutDto dto)
    {
        var b = await LoadForBilling(id);
        if (b == null) return Msg(404, "Không tìm thấy booking.");
        if (b.Status != BookingStatus.CheckedIn) return Msg(409, "Chỉ check-out được khách đang lưu trú.");
        if (dto.Surcharge < 0 || dto.Discount < 0) return Msg(400, "Phụ thu và giảm trừ không được âm.");
        var method = dto.PaymentMethod ?? "Cash";
        if (!Policy.PaymentMethods.Contains(method)) return Msg(400, "Phương thức thanh toán không hợp lệ.");

        var today = Clock.Today;
        var calc = await _billing.Calculate(b, today, dto.Surcharge, dto.SurchargeNote, dto.Discount);

        var open = b.Segments.OrderBy(s => s.FromDate).Last();
        open.ToDate = calc.EndDate;

        var now = Clock.Now;
        var invoice = new Invoice
        {
            Booking = b, Number = $"INV-{now:yyyyMMdd}-{b.Id:D5}", IssuedAt = now,
            RoomCharge = calc.RoomCharge, ServiceCharge = calc.ServiceCharge,
            Surcharge = calc.Surcharge, Discount = calc.Discount, Total = calc.Total,
            LinesJson = BillingService.Serialize(calc.Lines)
        };
        invoice.Payments.Add(new Payment { Method = method, Amount = calc.Total, PaidAt = now });
        Db.Invoices.Add(invoice);

        b.Status = BookingStatus.CheckedOut;
        b.ActualCheckOut = now;
        SetRoomStatus(b.Room, RoomStatus.Cleaning, $"Check-out {b.Code}");
        Log("CHECK_OUT", $"{b.Code}: hóa đơn {invoice.Number}, tổng {calc.Total:N0}đ ({method})");
        await Db.SaveChangesAsync();
        return Ok(new { invoice.Number, invoice.Total, lines = calc.Lines });
    }

    // ---- Màn hình "Hôm nay" của lễ tân ----
    [HttpGet("today")]
    public async Task<IActionResult> Today()
    {
        var today = Clock.Today;
        var arrivals = await Db.Bookings.WithAll().AsNoTracking()
            .Where(b => b.Status == BookingStatus.Confirmed && b.CheckIn <= today && b.CheckOut > today)
            .OrderBy(b => b.CheckIn).ThenBy(b => b.Id).ToListAsync();
        var inHouse = await Db.Bookings.WithAll().AsNoTracking()
            .Where(b => b.Status == BookingStatus.CheckedIn).OrderBy(b => b.CheckOut).ToListAsync();
        var rooms = await Db.Rooms.Include(r => r.RoomType).AsNoTracking().Where(r => r.IsActive).OrderBy(r => r.Number).ToListAsync();

        return Ok(new
        {
            date = today,
            counts = new
            {
                arrivals = arrivals.Count,
                departures = inHouse.Count(b => b.CheckOut <= today),
                inHouse = inHouse.Count,
                toClean = rooms.Count(r => r.Status == RoomStatus.Cleaning),
                ready = rooms.Count(r => r.Status == RoomStatus.Ready),
                maintenance = rooms.Count(r => r.Status == RoomStatus.Maintenance),
                totalRooms = rooms.Count
            },
            arrivals = arrivals.Select(Mapping.Dto),
            inHouse = inHouse.Select(Mapping.Dto),
            toClean = rooms.Where(r => r.Status == RoomStatus.Cleaning).Select(r => new { r.Id, r.Number, type = r.RoomType.Name })
        });
    }

    // ---- Lịch phòng dạng timeline: mỗi phòng một hàng, mỗi booking (hoặc đoạn ở một phòng) một thanh ----
    [HttpGet("timeline")]
    public async Task<IActionResult> Timeline(DateOnly? from, int days = 14)
    {
        days = Math.Clamp(days, 7, 42);
        var f = from ?? Clock.Today.AddDays(-1);
        var to = f.AddDays(days);

        var rooms = await Db.Rooms.Include(r => r.RoomType).AsNoTracking().Where(r => r.IsActive).OrderBy(r => r.Number).ToListAsync();
        var nights = await Db.BookingNights.AsNoTracking()
            .Where(n => n.Date >= f && n.Date < to && n.Booking.Status != BookingStatus.Cancelled)
            .Select(n => new { n.BookingId, n.RoomId, n.Date, n.Booking.Code, n.Booking.Status, Guest = n.Booking.GuestProfile.FullName })
            .ToListAsync();

        var bars = new List<object>();
        foreach (var g in nights.GroupBy(n => new { n.BookingId, n.RoomId }))
        {
            var list = g.OrderBy(x => x.Date).ToList();
            var start = list[0].Date;
            var prev = start;
            for (var i = 1; i <= list.Count; i++)
            {
                var gap = i < list.Count && list[i].Date != prev.AddDays(1);
                if (i == list.Count || gap)
                {
                    bars.Add(new { bookingId = g.Key.BookingId, roomId = g.Key.RoomId, code = list[0].Code, guest = list[0].Guest, status = list[0].Status.ToString(), start, end = prev.AddDays(1) });
                    if (i < list.Count) start = list[i].Date;
                }
                if (i < list.Count) prev = list[i].Date;
            }
        }

        return Ok(new
        {
            from = f, days,
            rooms = rooms.Select(r => new { r.Id, r.Number, r.Floor, type = r.RoomType.Name, status = r.Status.ToString() }),
            bars
        });
    }
}
