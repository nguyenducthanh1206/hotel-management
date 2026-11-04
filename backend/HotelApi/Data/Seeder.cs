using HotelApi.Models;
using HotelApi.Services;

namespace HotelApi.Data;

/// <summary>Dữ liệu seed: 15 phòng / 6 hạng, 9 booking đủ trạng thái, 6 dịch vụ, 2 quy tắc giá, tài khoản demo theo vai trò.</summary>
public static class Seeder
{
    public static void Run(AppDbContext db)
    {
        if (db.Users.Any()) return;
        var now = Clock.Now;
        var today = Clock.Today;
        string H(string p) => BCrypt.Net.BCrypt.HashPassword(p);

        var admin = new AppUser { Username = "admin", PasswordHash = H("Admin@123"), FullName = "Quản trị viên", Role = Role.Admin, CreatedAt = now };
        var letan = new AppUser { Username = "letan", PasswordHash = H("Letan@123"), FullName = "Nguyễn Lễ Tân", Role = Role.Receptionist, CreatedAt = now };
        var buong = new AppUser { Username = "buongphong", PasswordHash = H("Buong@123"), FullName = "Trần Buồng Phòng", Role = Role.Housekeeping, CreatedAt = now };
        var khach = new AppUser { Username = "khach", PasswordHash = H("Khach@123"), FullName = "Lê Khách Hàng", Phone = "0901234567", Email = "khach@example.com", Role = Role.Guest, CreatedAt = now };
        db.Users.AddRange(admin, letan, buong, khach);

        Amenity A(string n) => new() { Name = n };
        var wifi = A("Wi-Fi"); var ac = A("Điều hòa"); var tv = A("Truyền hình vệ tinh"); var safe = A("Két sắt");
        var hair = A("Máy sấy tóc"); var desk = A("Bàn làm việc"); var coffee = A("Trà & cà phê"); var bath = A("Bồn tắm");
        var balcony = A("Ban công"); var minibar = A("Minibar"); var living = A("Phòng khách riêng");

        RoomType T(string name, string desc, string details, int cap, decimal price, int area, string bed, string view, params Amenity[] am)
        {
            var t = new RoomType { Name = name, Description = desc, Details = details, Capacity = cap, BasePrice = price, AreaM2 = area, BedType = bed, ViewName = view };
            t.Amenities.AddRange(am);
            return t;
        }

        var std = T("Standard", "Phòng tiêu chuẩn gọn gàng cho một hoặc hai khách.",
            "Phòng Standard có giường đôi thoải mái, cửa sổ đón sáng và đầy đủ tiện nghi cơ bản cho một kỳ nghỉ ngắn ngày hoặc chuyến công tác.\nPhòng tắm riêng có máy sấy tóc, két sắt trong phòng giúp bạn yên tâm cất giữ đồ có giá trị.",
            2, 600_000, 24, "1 giường đôi", "Hướng phố", wifi, ac, tv, safe, hair);
        var sup = T("Superior Twin", "Hai giường đơn, phù hợp bạn bè hoặc đồng nghiệp đi cùng nhau.",
            "Phòng Superior Twin mang phong cách hiện đại với hai giường đơn, cửa sổ lớn nhìn ra sân vườn và bàn làm việc rộng rãi.\nPhòng tắm có bồn tắm để thư giãn sau một ngày dài. Trà và cà phê được chuẩn bị sẵn trong phòng.",
            2, 750_000, 30, "2 giường đơn", "Hướng sân vườn", wifi, ac, tv, safe, hair, desk, coffee, bath);
        var dlx = T("Deluxe", "Rộng rãi hơn, có ban công nhìn ra thành phố.",
            "Phòng Deluxe có ban công riêng, giường đôi kèm một giường đơn, thích hợp cho gia đình nhỏ đi cùng một em bé hoặc nhóm ba người.\nMinibar, bàn làm việc và khu vực ngồi thư giãn bên cửa sổ giúp kỳ nghỉ thêm tiện nghi.",
            3, 900_000, 36, "1 giường đôi + 1 giường đơn", "Ban công hướng thành phố", wifi, ac, tv, balcony, minibar, safe, hair, desk, coffee);
        var fam = T("Family", "Hai giường đôi rộng rãi dành cho gia đình bốn người.",
            "Phòng Family có hai giường đôi, không gian thoáng và khu vực sinh hoạt chung, phù hợp gia đình có trẻ nhỏ.\nMinibar, bàn làm việc và bồn tắm giúp cả nhà nghỉ ngơi thoải mái.",
            4, 1_200_000, 42, "2 giường đôi", "Hướng sân vườn", wifi, ac, tv, minibar, safe, hair, desk, coffee, bath);
        var ste = T("Suite", "Phòng khách riêng và bồn tắm, dành cho gia đình hoặc kỳ nghỉ dài ngày.",
            "Phòng Suite gồm phòng ngủ và phòng khách riêng biệt, ban công nhìn toàn cảnh thành phố và bồn tắm lớn.\nSofa giường ở phòng khách cho phép ở thoải mái tới bốn người, kèm minibar, két sắt và bàn làm việc.",
            4, 1_500_000, 55, "1 giường cỡ lớn + sofa giường", "Toàn cảnh thành phố", wifi, ac, tv, bath, balcony, minibar, safe, hair, desk, coffee, living);
        var pre = T("Presidential Suite", "Hạng phòng cao nhất, phòng ngủ phụ và phòng khách rộng.",
            "Presidential Suite nằm ở tầng cao nhất với phòng ngủ chính, phòng ngủ phụ, phòng khách rộng và ban công nhìn bao quát thành phố.\nĐây là lựa chọn dành cho những dịp đặc biệt, kỳ nghỉ gia đình hoặc khách cần không gian riêng tư.",
            4, 2_800_000, 85, "1 giường cỡ lớn + phòng ngủ phụ", "Toàn cảnh thành phố từ tầng cao", wifi, ac, tv, bath, balcony, minibar, safe, hair, desk, coffee, living);

        Room R(string n, int floor, RoomType t, RoomStatus st = RoomStatus.Ready) => new() { Number = n, Floor = floor, RoomType = t, Status = st };
        var r101 = R("101", 1, std); var r102 = R("102", 1, std, RoomStatus.Occupied); var r103 = R("103", 1, std); var r104 = R("104", 1, std);
        var r105 = R("105", 1, sup); var r106 = R("106", 1, sup);
        var r201 = R("201", 2, dlx); var r202 = R("202", 2, dlx, RoomStatus.Occupied); var r203 = R("203", 2, dlx, RoomStatus.Cleaning); var r204 = R("204", 2, dlx, RoomStatus.Maintenance);
        var r205 = R("205", 2, fam); var r206 = R("206", 2, fam);
        var r301 = R("301", 3, ste); var r302 = R("302", 3, ste);
        var r401 = R("401", 4, pre);
        db.Rooms.AddRange(r101, r102, r103, r104, r105, r106, r201, r202, r203, r204, r205, r206, r301, r302, r401);

        var laundry = new HotelService { Name = "Giặt ủi", Unit = "kg", UnitPrice = 30_000 };
        var water = new HotelService { Name = "Nước suối", Unit = "chai", UnitPrice = 15_000 };
        var breakfast = new HotelService { Name = "Ăn sáng", Unit = "suất", UnitPrice = 80_000 };
        var bike = new HotelService { Name = "Thuê xe máy", Unit = "ngày", UnitPrice = 150_000 };
        var airport = new HotelService { Name = "Đưa đón sân bay", Unit = "lượt", UnitPrice = 250_000 };
        var massage = new HotelService { Name = "Massage thư giãn", Unit = "giờ", UnitPrice = 400_000 };
        db.Services.AddRange(laundry, water, breakfast, bike, airport, massage);

        // Quy tắc giá mẫu: mùa lễ cuối năm đang bật; giá cuối tuần để TẮT sẵn (bật trong Quản trị để demo).
        var seasonYear = today <= new DateOnly(today.Year, 1, 5) ? today.Year - 1 : today.Year;
        var rates = new List<RateRule>
        {
            new() { Name = "Mùa lễ cuối năm", StartDate = new DateOnly(seasonYear, 12, 20), EndDate = new DateOnly(seasonYear + 1, 1, 5), Mode = "Percent", Value = 25, Priority = 10, IsActive = true },
            new() { Name = "Giá cuối tuần (đêm thứ Sáu, thứ Bảy)", DaysOfWeek = "Fri,Sat", Mode = "Percent", Value = 15, Priority = 5, IsActive = false }
        };
        db.RateRules.AddRange(rates);
        db.SaveChanges();

        var active = rates.Where(r => r.IsActive).ToList();

        Booking Mk(string code, Room room, int ci, int co, BookingStatus st, string name, string phone, int guests, AppUser? u = null)
        {
            var dFrom = today.AddDays(ci); var dTo = today.AddDays(co);
            var prices = Pricing.Nights(room.RoomType, active, dFrom, dTo);
            var total = prices.Sum(x => x.Price);
            var avg = Math.Round(total / prices.Count);
            var b = new Booking
            {
                Code = code, Room = room, Status = st, Guests = guests, UserId = u?.Id,
                GuestProfile = new GuestProfile { FullName = name, Phone = phone, Email = null },
                CheckIn = dFrom, CheckOut = dTo, NightlyRate = avg, RoomTotal = total, CreatedAt = now.AddDays(-3)
            };
            b.Segments.Add(new StaySegment { Room = room, FromDate = dFrom, NightlyRate = avg });
            foreach (var (date, price) in prices) b.Nights.Add(new BookingNight { Room = room, Date = date, Price = price });
            db.Bookings.Add(b);
            return b;
        }

        void AddInvoice(Booking b, string no)
        {
            var total = b.RoomTotal;
            var lines = b.Nights.GroupBy(n => n.Price).Select(g => new InvoiceLine("Room", $"Phòng {b.Room.Number}", g.Count(), g.Key, g.Sum(n => n.Price))).ToList();
            var inv = new Invoice
            {
                Booking = b, Number = no, RoomCharge = total, Total = total, IssuedAt = b.CheckOut.ToDateTime(new TimeOnly(11, 0)),
                LinesJson = BillingService.Serialize(lines)
            };
            inv.Payments.Add(new Payment { Method = "Cash", Amount = total, PaidAt = inv.IssuedAt });
            db.Invoices.Add(inv);
            b.ActualCheckIn = b.CheckIn.ToDateTime(new TimeOnly(14, 30));
            b.ActualCheckOut = inv.IssuedAt;
        }

        var b1 = Mk("HBDEMO01", r101, -10, -7, BookingStatus.CheckedOut, "Lê Khách Hàng", "0901234567", 2, khach); AddInvoice(b1, "INV-DEMO-001");
        var b2 = Mk("HBDEMO02", r201, -6, -4, BookingStatus.CheckedOut, "Phạm Minh Tuấn", "0912345678", 2); AddInvoice(b2, "INV-DEMO-002");

        var b3 = Mk("HBDEMO03", r102, -1, 2, BookingStatus.CheckedIn, "Hoàng Thu Hà", "0987654321", 2);
        b3.ActualCheckIn = now.AddDays(-1);
        b3.ServiceUsages.Add(new ServiceUsage { HotelService = water, Quantity = 2, UnitPrice = water.UnitPrice, UsedAt = now.AddHours(-20) });
        b3.ServiceUsages.Add(new ServiceUsage { HotelService = laundry, Quantity = 3, UnitPrice = laundry.UnitPrice, UsedAt = now.AddHours(-5) });
        var b4 = Mk("HBDEMO04", r202, 0, 3, BookingStatus.CheckedIn, "Vũ Đức Anh", "0977123456", 3);
        b4.ActualCheckIn = now.AddHours(-2);

        Mk("HBDEMO05", r103, 0, 2, BookingStatus.Confirmed, "Đặng Thị Mai", "0933222111", 2);
        Mk("HBDEMO06", r203, 1, 4, BookingStatus.Confirmed, "Bùi Quang Huy", "0944555666", 2);
        Mk("HBDEMO07", r301, 2, 5, BookingStatus.Confirmed, "Lê Khách Hàng", "0901234567", 4, khach);
        var b8 = Mk("HBDEMO08", r103, 0, 2, BookingStatus.Cancelled, "Ngô Văn Long", "0966777888", 1);
        b8.CancelReason = "Khách đổi kế hoạch";
        Mk("HBDEMO09", r101, 5, 7, BookingStatus.Confirmed, "Trịnh Hải Yến", "0922333444", 2);

        db.SaveChanges();
    }
}
