using HotelApi.Models;
using HotelApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static HotelApi.Tests.T;

namespace HotelApi.Tests;

public class AvailabilityTests
{
    private static async Task<(HotelApi.Data.AppDbContext db, Room r1, Room r2, Room r3)> Seed()
    {
        var db = NewDb();
        var t = Type("Standard", 600_000, 2);
        var r1 = Room("101", t); var r2 = Room("102", t); var r3 = Room("103", t, RoomStatus.Maintenance);
        db.Bookings.Add(Booking("A", r1, "2026-11-01", "2026-11-03"));   // [1, 3)
        db.Bookings.Add(Booking("C", r2, "2026-11-01", "2026-11-05", BookingStatus.Cancelled));
        await db.SaveChangesAsync();
        return (db, r1, r2, r3);
    }

    private static async Task<List<string>> Free(HotelApi.Data.AppDbContext db, string from, string to, int guests = 2) =>
        (await AvailabilityQuery.FreeRooms(db, D(from), D(to), guests).ToListAsync()).Select(r => r.Number).OrderBy(x => x).ToList();

    [Fact] public async Task OverlappingRange_ExcludesBookedRoom()
    {
        var (db, _, _, _) = await Seed();
        Assert.Equal(new[] { "102" }, await Free(db, "2026-11-02", "2026-11-04"));
    }

    [Fact] public async Task BoundaryDay_CheckInOnPreviousCheckOutDay_IsAvailable()
    {
        var (db, _, _, _) = await Seed();
        Assert.Equal(new[] { "101", "102" }, await Free(db, "2026-11-03", "2026-11-05"));   // đến đúng ngày booking kia đi
        Assert.Equal(new[] { "101", "102" }, await Free(db, "2026-10-30", "2026-11-01"));   // đi đúng ngày booking kia đến
    }

    [Fact] public async Task CancelledBooking_DoesNotBlockRoom()
    {
        var (db, _, _, _) = await Seed();
        Assert.Contains("102", await Free(db, "2026-11-01", "2026-11-04"));
    }

    [Fact] public async Task MaintenanceRoom_IsNeverReturned()
    {
        var (db, _, _, _) = await Seed();
        Assert.DoesNotContain("103", await Free(db, "2026-12-01", "2026-12-03"));
    }

    [Fact] public async Task Capacity_FiltersOutSmallRooms()
    {
        var (db, _, _, _) = await Seed();
        Assert.Empty(await Free(db, "2026-12-01", "2026-12-03", guests: 3));
    }

    [Fact] public async Task ExcludeBooking_AllowsMovingWithinOwnDates()
    {
        var (db, r1, _, _) = await Seed();
        var own = await db.Bookings.FirstAsync(b => b.Code == "A");
        var free = await AvailabilityQuery.FreeRooms(db, own.CheckIn, own.CheckOut, 2, null, own.Id).Select(r => r.Number).ToListAsync();
        Assert.Contains("101", free);
        Assert.Contains("102", free);
    }
}
