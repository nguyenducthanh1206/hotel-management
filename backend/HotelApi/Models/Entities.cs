namespace HotelApi.Models;

public enum Role { Guest, Receptionist, Housekeeping, Admin }
public enum RoomStatus { Ready, Occupied, Cleaning, Maintenance }
public enum BookingStatus { Confirmed, CheckedIn, CheckedOut, Cancelled }

public class AppUser
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public Role Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public class Amenity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<RoomType> RoomTypes { get; set; } = new();
}

public class RoomType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int Capacity { get; set; }
    public decimal BasePrice { get; set; }
    public int AreaM2 { get; set; }
    public string? BedType { get; set; }
    public string? ViewName { get; set; }
    public string? Details { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Amenity> Amenities { get; set; } = new();
    public List<Room> Rooms { get; set; } = new();
}

public class Room
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public int Floor { get; set; }
    public int RoomTypeId { get; set; }
    public RoomType RoomType { get; set; } = null!;
    public RoomStatus Status { get; set; } = RoomStatus.Ready;
    public bool IsActive { get; set; } = true;
}

public class GuestProfile
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? IdNumber { get; set; }
}

/// <summary>Booking đồng thời là "Stay" (có ActualCheckIn/ActualCheckOut khi lưu trú).</summary>
public class Booking
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public int GuestProfileId { get; set; }
    public GuestProfile GuestProfile { get; set; } = null!;
    public int? UserId { get; set; }
    public int RoomId { get; set; }                 // phòng hiện tại
    public Room Room { get; set; } = null!;
    public DateOnly CheckIn { get; set; }           // khoảng [CheckIn, CheckOut)
    public DateOnly CheckOut { get; set; }
    public int Guests { get; set; }
    public decimal NightlyRate { get; set; }        // giá/đêm trung bình (snapshot)
    public decimal RoomTotal { get; set; }          // tổng tiền phòng theo từng đêm (snapshot)
    public BookingStatus Status { get; set; }
    public decimal CancellationFee { get; set; }
    public string? CancelReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ActualCheckIn { get; set; }
    public DateTime? ActualCheckOut { get; set; }
    public List<StaySegment> Segments { get; set; } = new();
    public List<BookingNight> Nights { get; set; } = new();
    public List<ServiceUsage> ServiceUsages { get; set; } = new();
    public Invoice? Invoice { get; set; }
}

/// <summary>Mỗi đoạn lưu trú ở một phòng với giá snapshot. Đổi phòng = đóng đoạn cũ, mở đoạn mới.</summary>
public class StaySegment
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public DateOnly FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
    public decimal NightlyRate { get; set; }
}

public class RoomStatusHistory
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public RoomStatus FromStatus { get; set; }
    public RoomStatus ToStatus { get; set; }
    public DateTime ChangedAt { get; set; }
    public int? ChangedByUserId { get; set; }
    public string? Note { get; set; }
}

public class HotelService
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Unit { get; set; } = "lần";
    public decimal UnitPrice { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ServiceUsage
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public int HotelServiceId { get; set; }
    public HotelService HotelService { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }          // snapshot
    public DateTime UsedAt { get; set; }
    public int? RecordedByUserId { get; set; }
}

public class Invoice
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public decimal RoomCharge { get; set; }
    public decimal ServiceCharge { get; set; }
    public decimal Surcharge { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string LinesJson { get; set; } = "[]";
    public DateTime IssuedAt { get; set; }
    public List<Payment> Payments { get; set; } = new();
}

public class Payment
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;
    public string Method { get; set; } = "Cash";
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; }
}

public class SystemLog
{
    public int Id { get; set; }
    public DateTime At { get; set; }
    public int? UserId { get; set; }
    public string Username { get; set; } = "";
    public string Action { get; set; } = "";
    public string Detail { get; set; } = "";
}

/// <summary>Mỗi đêm của một booking: ở phòng nào, giá bao nhiêu (snapshot theo bảng giá lúc đặt).</summary>
public class BookingNight
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public DateOnly Date { get; set; }
    public decimal Price { get; set; }
}

/// <summary>
/// Quy tắc giá theo mùa / ngày trong tuần. Với mỗi đêm, quy tắc đang bật, khớp ngày và có độ ưu tiên cao nhất được áp dụng
/// (không cộng dồn). Mode = "Percent" (Value là % tăng/giảm so với giá cơ bản) hoặc "Fixed" (Value là giá cố định/đêm).
/// </summary>
public class RateRule
{
    public int Id { get; set; }
    public int? RoomTypeId { get; set; }            // null = áp dụng mọi hạng phòng
    public RoomType? RoomType { get; set; }
    public string Name { get; set; } = "";
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? DaysOfWeek { get; set; }         // ví dụ "Fri,Sat"; trống = mọi ngày
    public string Mode { get; set; } = "Percent";
    public decimal Value { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; } = true;
}
