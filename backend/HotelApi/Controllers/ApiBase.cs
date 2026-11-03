using HotelApi.Data;
using HotelApi.Models;
using HotelApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HotelApi.Controllers;

[ApiController]
public abstract class ApiBase : ControllerBase
{
    protected readonly AppDbContext Db;
    protected ApiBase(AppDbContext db) { Db = db; }

    protected int? UserId => int.TryParse(User.FindFirst("uid")?.Value, out var id) ? id : null;
    protected bool InRole(Role r) => User.IsInRole(r.ToString());

    protected IActionResult Msg(int code, string message) => StatusCode(code, new { message });

    /// <summary>Ghi nhật ký; được lưu cùng lần SaveChanges với nghiệp vụ (atomic).</summary>
    protected void Log(string action, string detail) =>
        Db.SystemLogs.Add(new SystemLog
        {
            At = Clock.Now, UserId = UserId, Username = User.Identity?.Name ?? "anonymous",
            Action = action, Detail = detail
        });

    protected void SetRoomStatus(Room room, RoomStatus to, string? note)
    {
        Db.RoomStatusHistories.Add(new RoomStatusHistory
        {
            Room = room, FromStatus = room.Status, ToStatus = to,
            ChangedAt = Clock.Now, ChangedByUserId = UserId, Note = note
        });
        room.Status = to;
    }

    /// <summary>Lỗi 23P01 = vi phạm exclusion constraint (trùng booking).</summary>
    protected static bool IsOverlap(DbUpdateException e) =>
        e.InnerException is PostgresException { SqlState: "23P01" };
}
