using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Controllers;

public record RoomStatusDto(RoomStatus Status, string? Note);

[Authorize(Roles = "Receptionist,Housekeeping,Admin"), Route("api/rooms")]
public class RoomsController : ApiBase
{
    public RoomsController(AppDbContext db) : base(db) { }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var today = Clock.Today;
        var rooms = await Db.Rooms.Include(r => r.RoomType).AsNoTracking().OrderBy(r => r.Number).ToListAsync();
        var inHouse = await Db.Bookings.Include(b => b.GuestProfile).AsNoTracking()
            .Where(b => b.Status == BookingStatus.CheckedIn).ToListAsync();
        var arrivals = await Db.Bookings.Include(b => b.GuestProfile).AsNoTracking()
            .Where(b => b.Status == BookingStatus.Confirmed && b.CheckOut > today).OrderBy(b => b.CheckIn).ToListAsync();

        return Ok(rooms.Select(r =>
        {
            var cur = inHouse.FirstOrDefault(b => b.RoomId == r.Id);
            var next = arrivals.FirstOrDefault(b => b.RoomId == r.Id);
            return new
            {
                r.Id, r.Number, r.Floor, r.IsActive, type = r.RoomType.Name, status = r.Status.ToString(),
                statusLabel = Rules.Vi(r.Status),
                guest = cur == null ? null : new { bookingId = cur.Id, cur.Code, name = cur.GuestProfile.FullName, checkOut = cur.CheckOut },
                nextArrival = next == null ? null : new { bookingId = next.Id, next.Code, name = next.GuestProfile.FullName, checkIn = next.CheckIn }
            };
        }));
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, RoomStatusDto dto)
    {
        var room = await Db.Rooms.FirstOrDefaultAsync(r => r.Id == id);
        if (room == null) return Msg(404, "Không tìm thấy phòng.");
        var from = room.Status;
        if (from == dto.Status) return Msg(400, "Phòng đã ở trạng thái này.");

        if (from == RoomStatus.Occupied)
            return Msg(409, "Phòng đang có khách. Hãy check-out hoặc đổi phòng thay vì sửa trạng thái.");
        if (!RoomStates.CanManual(from, dto.Status))
            return Msg(409, $"Không thể chuyển '{Rules.Vi(from)}' sang '{Rules.Vi(dto.Status)}'.");
        // Buồng phòng chỉ được: Đang dọn -> Sẵn sàng, hoặc báo hỏng (Đang dọn -> Bảo trì)
        if (InRole(Role.Housekeeping) && !RoomStates.HousekeepingCan(from, dto.Status))
            return Msg(403, "Buồng phòng chỉ cập nhật được phòng đang ở trạng thái 'Đang dọn'.");

        SetRoomStatus(room, dto.Status, dto.Note);
        Log("ROOM_STATUS", $"Phòng {room.Number}: {Rules.Vi(from)} -> {Rules.Vi(dto.Status)}");
        await Db.SaveChangesAsync();
        return Ok(new { room.Id, status = room.Status.ToString() });
    }

    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> History(int id)
    {
        var rows = await Db.RoomStatusHistories.AsNoTracking().Where(h => h.RoomId == id)
            .OrderByDescending(h => h.ChangedAt).Take(50).ToListAsync();
        return Ok(rows.Select(h => new { from = Rules.Vi(h.FromStatus), to = Rules.Vi(h.ToStatus), h.ChangedAt, h.Note }));
    }
}
