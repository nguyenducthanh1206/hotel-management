using HotelApi.Data;
using HotelApi.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelApi.Tests;

internal static class T
{
    public static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    public static DateOnly D(string iso) => DateOnly.Parse(iso);

    public static RoomType Type(string name = "Deluxe", decimal price = 900_000, int cap = 3, int id = 1) =>
        new() { Id = id, Name = name, BasePrice = price, Capacity = cap };

    public static Room Room(string no, RoomType t, RoomStatus st = RoomStatus.Ready) =>
        new() { Number = no, RoomType = t, RoomTypeId = t.Id, Status = st, Floor = 1 };

    public static Booking Booking(string code, Room room, string from, string to, BookingStatus st = BookingStatus.Confirmed, decimal rate = 0)
    {
        var f = D(from); var e = D(to);
        var price = rate > 0 ? rate : room.RoomType.BasePrice;
        var b = new Booking
        {
            Code = code, Room = room, Status = st, Guests = 2, CheckIn = f, CheckOut = e, NightlyRate = price,
            GuestProfile = new GuestProfile { FullName = "Khách thử", Phone = "0900000000" }
        };
        for (var d = f; d < e; d = d.AddDays(1)) b.Nights.Add(new BookingNight { Room = room, Date = d, Price = price });
        b.RoomTotal = b.Nights.Sum(n => n.Price);
        return b;
    }
}

/// <summary>Chỉ chạy khi có biến môi trường HOTEL_TEST_PG (chuỗi kết nối tới một CSDL PostgreSQL THỬ NGHIỆM, sẽ bị xóa và tạo lại).</summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("HOTEL_TEST_PG") is null)
            Skip = "Đặt biến môi trường HOTEL_TEST_PG để chạy test dùng PostgreSQL thật.";
    }
}
