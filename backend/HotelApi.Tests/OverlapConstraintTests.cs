using HotelApi.Data;
using HotelApi.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using static HotelApi.Tests.T;

namespace HotelApi.Tests;

/// <summary>
/// Kiểm tra ràng buộc chống trùng booking của PostgreSQL (exclusion constraint). Cần CSDL thật:
///   set HOTEL_TEST_PG=Host=localhost;Port=5432;Database=hotel_test;Username=postgres;Password=...
/// CSDL này sẽ bị XÓA và tạo lại khi chạy test, đừng trỏ vào hoteldb đang dùng.
/// </summary>
public class OverlapConstraintTests
{
    private static AppDbContext Pg()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(Environment.GetEnvironmentVariable("HOTEL_TEST_PG")).Options);
        db.Database.EnsureDeleted(); db.Database.EnsureCreated(); db.CreateConstraints();
        return db;
    }

    [PostgresFact]
    public void OverlappingConfirmedBookings_AreRejectedByDatabase()
    {
        using var db = Pg();
        var room = Room("101", Type("Standard", 600_000, 2));
        db.Bookings.Add(Booking("A", room, "2026-11-01", "2026-11-03"));
        db.SaveChanges();

        db.Bookings.Add(Booking("B", room, "2026-11-02", "2026-11-04"));
        var ex = Assert.Throws<DbUpdateException>(() => db.SaveChanges());
        Assert.Equal("23P01", Assert.IsType<PostgresException>(ex.InnerException).SqlState);
    }

    [PostgresFact]
    public void BackToBackBookings_AndCancelledOnes_AreAllowed()
    {
        using var db = Pg();
        var room = Room("101", Type("Standard", 600_000, 2));
        db.Bookings.Add(Booking("A", room, "2026-11-01", "2026-11-03"));
        db.Bookings.Add(Booking("B", room, "2026-11-03", "2026-11-05"));                              // sát ngày đi: hợp lệ
        db.Bookings.Add(Booking("C", room, "2026-11-01", "2026-11-05", BookingStatus.Cancelled));      // đã hủy: không chiếm phòng
        db.SaveChanges();
        Assert.Equal(3, db.Bookings.Count());
    }
}
