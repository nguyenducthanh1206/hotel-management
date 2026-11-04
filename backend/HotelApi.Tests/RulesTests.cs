using HotelApi.Models;
using HotelApi.Services;
using Xunit;
using static HotelApi.Tests.T;

namespace HotelApi.Tests;

public class RulesTests
{
    private static readonly DateOnly Today = D("2026-11-01");

    [Fact] public void Stay_CheckOutMustBeAfterCheckIn() => Assert.NotNull(Rules.ValidateStay(D("2026-11-05"), D("2026-11-05"), 2, Today));
    [Fact] public void Stay_CheckOutBeforeCheckIn_Invalid() => Assert.NotNull(Rules.ValidateStay(D("2026-11-05"), D("2026-11-04"), 2, Today));
    [Fact] public void Stay_PastCheckIn_Invalid() => Assert.NotNull(Rules.ValidateStay(D("2026-10-31"), D("2026-11-02"), 2, Today));
    [Fact] public void Stay_Today_IsValid() => Assert.Null(Rules.ValidateStay(Today, D("2026-11-02"), 2, Today));
    [Fact] public void Stay_ZeroGuests_Invalid() => Assert.NotNull(Rules.ValidateStay(Today, D("2026-11-02"), 0, Today));
    [Fact] public void Stay_MaxNightsBoundary()
    {
        Assert.Null(Rules.ValidateStay(Today, Today.AddDays(Policy.MaxNights), 1, Today));
        Assert.NotNull(Rules.ValidateStay(Today, Today.AddDays(Policy.MaxNights + 1), 1, Today));
    }

    [Fact] public void Cancel_FreeBefore24hOfCheckInTime()
    {
        var b = new Booking { CheckIn = D("2026-11-10"), NightlyRate = 600_000 };
        Assert.Equal(0, Rules.CancellationFee(b, new DateTime(2026, 11, 9, 13, 59, 0)));
        Assert.Equal(0, Rules.CancellationFee(b, new DateTime(2026, 11, 9, 14, 0, 0))); // đúng mốc: vẫn miễn phí
    }

    [Fact] public void Cancel_OneNightFeeAfterDeadline()
    {
        var b = new Booking { CheckIn = D("2026-11-10"), NightlyRate = 600_000 };
        Assert.Equal(600_000, Rules.CancellationFee(b, new DateTime(2026, 11, 9, 14, 1, 0)));
    }

    [Theory]
    [InlineData(RoomStatus.Ready, RoomStatus.Cleaning, true)]
    [InlineData(RoomStatus.Ready, RoomStatus.Maintenance, true)]
    [InlineData(RoomStatus.Ready, RoomStatus.Occupied, false)]
    [InlineData(RoomStatus.Cleaning, RoomStatus.Ready, true)]
    [InlineData(RoomStatus.Maintenance, RoomStatus.Ready, false)]   // sửa xong phải dọn trước
    [InlineData(RoomStatus.Maintenance, RoomStatus.Cleaning, true)]
    [InlineData(RoomStatus.Occupied, RoomStatus.Ready, false)]      // đang có khách: không sửa tay
    [InlineData(RoomStatus.Occupied, RoomStatus.Cleaning, false)]
    public void RoomStates_Manual(RoomStatus from, RoomStatus to, bool expected) => Assert.Equal(expected, RoomStates.CanManual(from, to));

    [Theory]
    [InlineData(RoomStatus.Cleaning, RoomStatus.Ready, true)]
    [InlineData(RoomStatus.Cleaning, RoomStatus.Maintenance, true)]
    [InlineData(RoomStatus.Ready, RoomStatus.Cleaning, false)]
    [InlineData(RoomStatus.Maintenance, RoomStatus.Cleaning, false)]
    public void RoomStates_Housekeeping(RoomStatus from, RoomStatus to, bool expected) => Assert.Equal(expected, RoomStates.HousekeepingCan(from, to));
}
