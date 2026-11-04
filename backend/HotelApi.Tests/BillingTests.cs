using HotelApi.Models;
using HotelApi.Services;
using Xunit;
using static HotelApi.Tests.T;

namespace HotelApi.Tests;

public class BillingTests
{
    [Fact] public async Task MultiNight_WithServices_SurchargeAndDiscount()
    {
        using var db = NewDb();
        var t = Type("Deluxe", 900_000);
        var room = Room("201", t);
        var b = Booking("B1", room, "2026-11-01", "2026-11-04", BookingStatus.CheckedIn);
        var svc = new HotelService { Name = "Nước suối", UnitPrice = 15_000 };
        b.ServiceUsages.Add(new ServiceUsage { HotelService = svc, Quantity = 2, UnitPrice = 15_000, UsedAt = new DateTime(2026, 11, 2, 9, 0, 0) });
        db.Bookings.Add(b); await db.SaveChangesAsync();

        var calc = await new BillingService(db).Calculate(b, D("2026-11-04"), 100_000, "Trả muộn", 50_000);

        Assert.Equal(2_700_000, calc.RoomCharge);      // 3 đêm x 900.000
        Assert.Equal(30_000, calc.ServiceCharge);      // 2 x 15.000
        Assert.Equal(2_780_000, calc.Total);           // + phụ thu 100.000 - giảm 50.000
        Assert.Equal(D("2026-11-04"), calc.EndDate);
    }

    [Fact] public async Task EarlyCheckout_StillChargesAllBookedNights()
    {
        using var db = NewDb();
        var room = Room("101", Type("Standard", 600_000));
        var b = Booking("B2", room, "2026-11-01", "2026-11-04", BookingStatus.CheckedIn);
        db.Bookings.Add(b); await db.SaveChangesAsync();

        var calc = await new BillingService(db).Calculate(b, D("2026-11-02"), 0, null, 0);
        Assert.Equal(1_800_000, calc.RoomCharge);
    }

    [Fact] public async Task Overstay_AddsExtraNightsAtCurrentRate()
    {
        using var db = NewDb();
        var room = Room("201", Type("Deluxe", 900_000));
        var b = Booking("B3", room, "2026-11-01", "2026-11-03", BookingStatus.CheckedIn);
        db.Bookings.Add(b); await db.SaveChangesAsync();

        var calc = await new BillingService(db).Calculate(b, D("2026-11-05"), 0, null, 0);
        Assert.Equal(4 * 900_000, calc.RoomCharge);    // 2 đêm đặt + 2 đêm ở quá hạn
        Assert.Contains(calc.Lines, l => l.Description.Contains("quá hạn") && l.Quantity == 2);
        Assert.Equal(D("2026-11-05"), calc.EndDate);
    }

    [Fact] public async Task RoomChange_BillsEachRoomAtItsOwnRate()
    {
        using var db = NewDb();
        var std = Type("Standard", 600_000, 2, 1);
        var dlx = Type("Deluxe", 900_000, 3, 2);
        var r1 = Room("101", std); var r2 = Room("201", dlx);
        var b = Booking("B4", r1, "2026-11-01", "2026-11-04", BookingStatus.CheckedIn);
        var last = b.Nights.OrderBy(n => n.Date).Last();     // đêm thứ 3 chuyển sang phòng Deluxe
        last.Room = r2; last.Price = 900_000;
        b.RoomTotal = b.Nights.Sum(n => n.Price);
        db.Bookings.Add(b); db.Rooms.Add(r2); await db.SaveChangesAsync();

        var calc = await new BillingService(db).Calculate(b, D("2026-11-04"), 0, null, 0);
        Assert.Equal(2 * 600_000 + 900_000, calc.RoomCharge);
        Assert.Equal(2, calc.Lines.Count(l => l.Type == "Room"));
    }

    [Fact] public async Task Discount_NeverExceedsTotal()
    {
        using var db = NewDb();
        var room = Room("101", Type("Standard", 600_000));
        var b = Booking("B5", room, "2026-11-01", "2026-11-02", BookingStatus.CheckedIn);
        db.Bookings.Add(b); await db.SaveChangesAsync();

        var calc = await new BillingService(db).Calculate(b, D("2026-11-02"), 0, null, 9_999_999);
        Assert.Equal(600_000, calc.Discount);
        Assert.Equal(0, calc.Total);
    }

    [Fact] public async Task SeasonalRates_AreSummedPerNight()
    {
        using var db = NewDb();
        var room = Room("101", Type("Standard", 600_000));
        var b = Booking("B6", room, "2026-11-01", "2026-11-03", BookingStatus.CheckedIn);
        var nights = b.Nights.OrderBy(n => n.Date).ToList();
        nights[1].Price = 750_000;                         // đêm thứ 2 giá mùa cao
        b.RoomTotal = nights.Sum(n => n.Price);
        db.Bookings.Add(b); await db.SaveChangesAsync();

        var calc = await new BillingService(db).Calculate(b, D("2026-11-03"), 0, null, 0);
        Assert.Equal(1_350_000, calc.RoomCharge);
        Assert.Equal(2, calc.Lines.Count(l => l.Type == "Room"));   // hai mức giá = hai dòng
    }
}
