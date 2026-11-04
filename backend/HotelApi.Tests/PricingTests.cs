using HotelApi.Models;
using HotelApi.Services;
using Xunit;
using static HotelApi.Tests.T;

namespace HotelApi.Tests;

public class PricingTests
{
    private static readonly RoomType Std = Type("Standard", 600_000, 2);

    [Fact] public void NoRules_UsesBasePrice() => Assert.Equal(600_000, Pricing.NightPrice(Std, new List<RateRule>(), D("2026-11-03")));

    [Fact] public void WeekendRule_AppliesOnFridayAndSaturdayOnly()
    {
        var rules = new List<RateRule> { new() { Id = 1, DaysOfWeek = "Fri,Sat", Mode = "Percent", Value = 15, Priority = 1 } };
        Assert.Equal(690_000, Pricing.NightPrice(Std, rules, D("2026-11-06")));  // thứ Sáu
        Assert.Equal(690_000, Pricing.NightPrice(Std, rules, D("2026-11-07")));  // thứ Bảy
        Assert.Equal(600_000, Pricing.NightPrice(Std, rules, D("2026-11-08")));  // Chủ nhật
        Assert.Equal(600_000, Pricing.NightPrice(Std, rules, D("2026-11-05")));  // thứ Năm
    }

    [Fact] public void SeasonRule_DateRangeIsInclusive()
    {
        var rules = new List<RateRule> { new() { Id = 1, StartDate = D("2026-12-20"), EndDate = D("2027-01-05"), Mode = "Percent", Value = 25 } };
        Assert.Equal(600_000, Pricing.NightPrice(Std, rules, D("2026-12-19")));
        Assert.Equal(750_000, Pricing.NightPrice(Std, rules, D("2026-12-20")));
        Assert.Equal(750_000, Pricing.NightPrice(Std, rules, D("2027-01-05")));
        Assert.Equal(600_000, Pricing.NightPrice(Std, rules, D("2027-01-06")));
    }

    [Fact] public void HigherPriority_Wins_NoStacking()
    {
        var rules = new List<RateRule>
        {
            new() { Id = 1, StartDate = D("2026-12-20"), EndDate = D("2027-01-05"), Mode = "Percent", Value = 25, Priority = 10 },
            new() { Id = 2, DaysOfWeek = "Fri,Sat", Mode = "Percent", Value = 15, Priority = 5 }
        };
        Assert.Equal(750_000, Pricing.NightPrice(Std, rules, D("2026-12-25")));  // thứ Sáu trong mùa: chỉ mùa áp dụng
    }

    [Fact] public void FixedRule_And_InactiveRule()
    {
        var fixedRule = new RateRule { Id = 1, Mode = "Fixed", Value = 500_000, Priority = 1 };
        Assert.Equal(500_000, Pricing.NightPrice(Std, new[] { fixedRule }, D("2026-11-03")));
        fixedRule.IsActive = false;
        Assert.Equal(600_000, Pricing.NightPrice(Std, new[] { fixedRule }, D("2026-11-03")));
    }

    [Fact] public void RuleForOtherRoomType_IsIgnored()
    {
        var rules = new List<RateRule> { new() { Id = 1, RoomTypeId = 99, Mode = "Percent", Value = 50 } };
        Assert.Equal(600_000, Pricing.NightPrice(Std, rules, D("2026-11-03")));
    }

    [Fact] public void Price_RoundedToThousand()
    {
        var t = Type("X", 650_000, 2);
        var rules = new List<RateRule> { new() { Id = 1, Mode = "Percent", Value = 7 } };   // 695.500 -> 696.000
        Assert.Equal(696_000, Pricing.NightPrice(t, rules, D("2026-11-03")));
    }

    [Fact] public void Nights_ExcludesCheckOutDay()
    {
        var nights = Pricing.Nights(Std, new List<RateRule>(), D("2026-11-01"), D("2026-11-04"));
        Assert.Equal(3, nights.Count);
        Assert.Equal(D("2026-11-03"), nights[^1].Date);
    }
}
