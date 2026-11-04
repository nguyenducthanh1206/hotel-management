using HotelApi.Models;
using Microsoft.EntityFrameworkCore;

namespace HotelApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Amenity> Amenities => Set<Amenity>();
    public DbSet<RoomType> RoomTypes => Set<RoomType>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<GuestProfile> GuestProfiles => Set<GuestProfile>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<StaySegment> StaySegments => Set<StaySegment>();
    public DbSet<RoomStatusHistory> RoomStatusHistories => Set<RoomStatusHistory>();
    public DbSet<HotelService> Services => Set<HotelService>();
    public DbSet<ServiceUsage> ServiceUsages => Set<ServiceUsage>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SystemLog> SystemLogs => Set<SystemLog>();
    public DbSet<BookingNight> BookingNights => Set<BookingNight>();
    public DbSet<RateRule> RateRules => Set<RateRule>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>().HasIndex(x => x.Username).IsUnique();
        b.Entity<AppUser>().Property(x => x.Role).HasConversion<string>().HasMaxLength(20);

        b.Entity<Room>().HasIndex(x => x.Number).IsUnique();
        b.Entity<Room>().Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Entity<Room>().HasOne(r => r.RoomType).WithMany(t => t.Rooms).HasForeignKey(r => r.RoomTypeId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Booking>().HasIndex(x => x.Code).IsUnique();
        b.Entity<Booking>().Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Entity<Booking>().HasOne(x => x.Room).WithMany().HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Booking>().HasOne(x => x.GuestProfile).WithMany().HasForeignKey(x => x.GuestProfileId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Booking>().HasIndex(x => new { x.RoomId, x.CheckIn, x.CheckOut });

        b.Entity<StaySegment>().HasOne(s => s.Room).WithMany().HasForeignKey(s => s.RoomId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StaySegment>().HasOne(s => s.Booking).WithMany(x => x.Segments).HasForeignKey(s => s.BookingId);

        b.Entity<RoomStatusHistory>().Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(20);
        b.Entity<RoomStatusHistory>().Property(x => x.ToStatus).HasConversion<string>().HasMaxLength(20);

        b.Entity<ServiceUsage>().HasOne(u => u.Booking).WithMany(x => x.ServiceUsages).HasForeignKey(u => u.BookingId);
        b.Entity<ServiceUsage>().HasOne(u => u.HotelService).WithMany().HasForeignKey(u => u.HotelServiceId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<BookingNight>().HasOne(n => n.Booking).WithMany(x => x.Nights).HasForeignKey(n => n.BookingId);
        b.Entity<BookingNight>().HasOne(n => n.Room).WithMany().HasForeignKey(n => n.RoomId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<BookingNight>().HasIndex(n => new { n.BookingId, n.Date }).IsUnique();
        b.Entity<RateRule>().HasOne(r => r.RoomType).WithMany().HasForeignKey(r => r.RoomTypeId);

        b.Entity<Invoice>().HasIndex(x => x.Number).IsUnique();
        b.Entity<Invoice>().HasOne(i => i.Booking).WithOne(x => x.Invoice).HasForeignKey<Invoice>(i => i.BookingId);

        // Giờ lưu theo giờ Việt Nam, không kèm múi giờ.
        foreach (var p in b.Model.GetEntityTypes().SelectMany(e => e.GetProperties())
                     .Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?)))
            p.SetColumnType("timestamp without time zone");
    }

    /// <summary>Chống trùng booking ngay ở tầng CSDL (exclusion constraint trên khoảng ngày [CheckIn, CheckOut)).</summary>
    public void CreateConstraints()
    {
        Database.ExecuteSqlRaw("CREATE EXTENSION IF NOT EXISTS btree_gist;");
        Database.ExecuteSqlRaw("""
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_booking_no_overlap') THEN
                ALTER TABLE "Bookings" ADD CONSTRAINT ex_booking_no_overlap
                  EXCLUDE USING gist ("RoomId" WITH =, daterange("CheckIn", "CheckOut", '[)') WITH &&)
                  WHERE ("Status" IN ('Confirmed', 'CheckedIn'));
              END IF;
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_booking_dates') THEN
                ALTER TABLE "Bookings" ADD CONSTRAINT ck_booking_dates CHECK ("CheckOut" > "CheckIn");
              END IF;
            END $$;
            """);
    }
}
