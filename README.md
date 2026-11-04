# Hotel – Hệ thống quản lý khách sạn (Nhóm 3)

React.js · ASP.NET Core 8 (C#) · PostgreSQL 16 · JWT

## Chạy dự án

Cần: .NET SDK 8, Node.js 18+, Docker (hoặc PostgreSQL cài sẵn).

```bash
# 1. CSDL
docker compose up -d

# 2. Backend (http://localhost:5000, Swagger tại /swagger)
cd backend/HotelApi
dotnet run

# 3. Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Lần chạy đầu backend tự tạo bảng, ràng buộc chống trùng booking và nạp dữ liệu mẫu.
Muốn nạp lại từ đầu: `docker compose down -v` rồi chạy lại.
Nếu dùng PostgreSQL riêng, sửa `ConnectionStrings:Default` trong `backend/HotelApi/appsettings.json`.

## Tài khoản demo

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Quản lý | admin | Admin@123 |
| Lễ tân | letan | Letan@123 |
| Buồng phòng | buongphong | Buong@123 |
| Khách hàng | khach | Khach@123 |

## Dữ liệu seed

15 phòng / 6 hạng (Standard, Superior Twin, Deluxe, Family, Suite, Presidential Suite), 9 booking đủ trạng thái (Confirmed, CheckedIn, CheckedOut, Cancelled, ngày tính theo hôm nay), 6 dịch vụ, 2 hóa đơn mẫu. Phòng 203 đang dọn, 204 đang bảo trì. Dữ liệu seed chỉ nạp khi database còn trống; muốn nạp lại, xóa database `hoteldb` rồi chạy lại backend.

## Kịch bản demo (theo đề bài mục B.6)

1. **Khách đặt phòng**: đăng nhập `khach` → Tìm & đặt phòng → chọn ngày → đặt → nhận mã `HBxxxxxx`. Thử chọn lại đúng khoảng ngày đó cho đến khi hết phòng để thấy hệ thống không trả phòng trùng.
2. **Lễ tân**: đăng nhập `letan` → Lễ tân → booking `HBDEMO05` (đến hôm nay) → Check-in → "Quản lý lưu trú": đổi phòng, thêm dịch vụ, xem tạm tính, Check-out & xuất hóa đơn. Phòng chuyển sang "Đang dọn".
3. **Buồng phòng**: đăng nhập `buongphong` → Sơ đồ phòng → phòng "Đang dọn" → "Dọn xong, sẵn sàng". Sau đó `admin` → Quản trị → Thống kê để xem doanh thu và công suất.

Các ca lỗi nên thử: check-in phòng đang dọn/bảo trì, check-in booking đã hủy, đổi sang phòng đang có khách, buồng phòng sửa phòng không ở trạng thái "Đang dọn" (bị từ chối).

## Business rules đang cài (GIẢ ĐỊNH – cần đưa vào SRS/khảo sát)

| Mã | Quy tắc |
|---|---|
| BR1 | Ngày đi phải sau ngày đến; ngày đến không ở quá khứ; tối đa 30 đêm/booking. |
| BR2 | Khoảng lưu trú là nửa mở `[ngày đến, ngày đi)`: ngày đi của booking này được trùng ngày đến của booking kế tiếp. Một phòng không có hai booking hợp lệ (Confirmed/CheckedIn) chồng lấn; được chặn ở cả code lẫn exclusion constraint của PostgreSQL. |
| BR3 | "Khả dụng" = phòng hoạt động, không bảo trì, đủ sức chứa, không trùng booking hợp lệ trong khoảng ngày. Khác "trống vật lý" (`Room.Status`). |
| BR4 | Nhận phòng từ 14:00, trả phòng trước 12:00 (chỉ dùng để tính hạn hủy). Check-in chỉ khi hôm nay nằm trong `[ngày đến, ngày đi)`. |
| BR5 | Chỉ check-in booking Confirmed và phòng ở trạng thái Sẵn sàng. |
| BR6 | Hủy miễn phí nếu trước 14:00 ngày đến ít nhất 24 giờ; muộn hơn phí 1 đêm. Chỉ hủy booking chưa check-in. |
| BR7 | Giá từng đêm được chốt (snapshot) vào booking theo bảng giá lúc đặt (giá cơ bản hoặc quy tắc giá theo mùa/ngày trong tuần); đổi giá chỉ áp dụng cho booking mới. Đơn giá dịch vụ snapshot khi ghi nhận. |
| BR8 | Trạng thái phòng: Sẵn sàng → Đang có khách (check-in) → Đang dọn (check-out/đổi phòng) → Sẵn sàng. Bảo trì → Đang dọn (phải dọn sau khi sửa). Phòng đang có khách không sửa trạng thái thủ công. Buồng phòng chỉ xử lý phòng "Đang dọn". |
| BR9 | Đổi phòng cùng hạng giữ giá đã chốt; khác hạng áp giá cơ bản hiện tại của hạng mới. Mỗi đoạn lưu trú ghi lại (lịch sử đổi phòng). |
| BR10 | Hóa đơn = tiền phòng (cộng giá từng đêm đã chốt) + dịch vụ + phụ thu − giảm trừ. Trả sớm vẫn tính đủ số đêm đã đặt; ở quá hạn tính thêm đêm theo giá hiện hành. |

## Phủ yêu cầu → mã nguồn

| Yêu cầu | Nơi cài đặt |
|---|---|
| FR01 Đăng nhập, phân quyền | `AuthController`, `[Authorize(Roles=...)]`, `Login.jsx`, `App.jsx` |
| FR02 Loại phòng, phòng, tiện ích | `AdminController` (room-types, rooms), `Admin.jsx` |
| FR03 Tìm phòng khả dụng | `PublicController.Availability`, `AvailabilityQuery`, `Search.jsx` |
| FR04 Booking, mã xác nhận, hủy | `BookingsController`, `Search.jsx`, `MyBookings.jsx` |
| FR05 Check-in | `FrontDeskController.CheckIn`, `FrontDesk.jsx` |
| FR06 Trạng thái phòng | `RoomsController`, `RoomBoard.jsx`, bảng `RoomStatusHistories` |
| FR07 Dịch vụ phát sinh | `FrontDeskController.AddService`, `StayModal` |
| FR08 Check-out, hóa đơn | `BillingService`, `FrontDeskController.CheckOut` |
| FR09 Đổi phòng + lịch sử | `FrontDeskController.ChangeRoom`, bảng `StaySegments` |
| FR10 Quản lý tài khoản (SHOULD) | `AdminController` (users), `Admin.jsx` |
| FR11 Dashboard (SHOULD) | `AdminController.Dashboard`, `Admin.jsx` |
| FR12 System Log (SHOULD) | `ApiBase.Log`, tab Nhật ký |
| FR13 Thanh toán online/email (COULD) | Chưa làm. Thanh toán hiện chỉ ghi nhận phương thức khi check-out. |

## Giới hạn hiện tại

- Một khách sạn; giá có thể thay đổi theo mùa/ngày trong tuần (tab Giá theo mùa), mỗi đêm áp dụng một quy tắc có ưu tiên cao nhất, không cộng dồn.
- Chưa có đặt cọc, gửi email, đổi mật khẩu bởi chính người dùng, thanh toán online (FR13).
- Nhật ký hệ thống lưu bằng tiếng Việt, hiển thị nguyên văn ở cả hai ngôn ngữ.
- Tiền tệ khác VND chỉ là quy đổi hiển thị với tỷ giá tham khảo cố định trong `frontend/src/format.js` (`VND_PER_UNIT`); giá gốc, hóa đơn và thanh toán luôn bằng VND.
- Tra cứu bằng mã + số điện thoại chưa giới hạn số lần thử; nếu triển khai thật cần thêm rate limit.
- Đổi mật khẩu JWT key trong `appsettings.json` trước khi triển khai thật.

## Đóng gói thành một chương trình (HotelApi.exe)

Chỉ cần làm một lần (máy build cần .NET 8 SDK + Node.js + mạng):

```bat
build.bat
```

Kết quả nằm trong thư mục `release/`: `HotelApi.exe`, `appsettings.json`, `wwwroot/`. Giữ ba thứ này **cùng một thư mục**.
Chạy `HotelApi.exe` (bấm đúp): chương trình tự mở trình duyệt tại http://localhost:5000, giao diện và API cùng một cổng. Đóng cửa sổ đen là tắt chương trình.
Máy chạy chỉ cần PostgreSQL đang chạy và mật khẩu trong `release/appsettings.json` đúng; **không cần** cài .NET hay Node.js.
Chế độ phát triển (`dotnet run` + `npm run dev`) vẫn dùng được như cũ.

## Giao diện

Trang dành cho khách (ảnh bìa, hạng phòng, đặt phòng) và khu vực nhân viên (thanh điều hướng bên trái) dùng chung bảng màu ngà – xanh rêu đậm – đồng thau, chữ tiêu đề Cormorant Garamond, chữ nội dung Be Vietnam Pro (tải từ Google Fonts; mất mạng sẽ dùng Georgia/Segoe UI).
Muốn dùng ảnh thật thay hình minh họa (ảnh bìa, 4 ảnh cho mỗi hạng phòng), xem hướng dẫn trong `frontend/public/images/README.txt`.
Khách bấm vào một hạng phòng để xem chi tiết (thư viện ảnh, diện tích, giường, tầm nhìn, tiện nghi, mô tả) và có thể lọc theo tiện nghi, sắp xếp theo giá hoặc sức chứa.

## Tính năng giao diện

- **Sáng / tối / theo hệ thống**, **Tiếng Việt / English**, **VND / USD / EUR / JPY** (nút ở góc trang, lưu trong trình duyệt).
- Khách: lịch chọn ngày (ngày hết phòng bị làm mờ), đặt phòng 3 bước, trang chi tiết phòng, tra cứu và hủy bằng mã + số điện thoại không cần đăng nhập, in/lưu PDF phiếu xác nhận và hóa đơn (nút "In / Lưu PDF" rồi chọn "Save as PDF").
- Lễ tân: màn **Hôm nay** (khách đến/đi, phòng cần dọn), **Lịch phòng** dạng timeline, booking, sơ đồ phòng. Thao tác xác nhận dùng cửa sổ và thông báo của ứng dụng thay cho hộp thoại trình duyệt.
- Quản lý: biểu đồ doanh thu và công suất, xuất CSV (thống kê, nhật ký), quản lý giá theo mùa kèm xem trước giá 14 đêm.
- Thêm ngôn ngữ/chuỗi mới: sửa `frontend/src/dict.en.js`, rồi `npm run check:i18n` để kiểm tra còn chuỗi nào chưa dịch.

## Kiểm thử tự động

```bash
cd backend/HotelApi.Tests
dotnet test
```

Gồm test cho tính giá theo mùa, hóa đơn (nhiều đêm, dịch vụ, đổi phòng, ở quá hạn, giảm trừ), tìm phòng khả dụng (ngày biên, booking đã hủy, bảo trì), quy tắc hủy, chuyển trạng thái phòng.
Test ràng buộc chống trùng của PostgreSQL chỉ chạy khi đặt biến môi trường trỏ tới một database **thử nghiệm** (database này sẽ bị xóa và tạo lại, đừng dùng `hoteldb`):

```bat
set HOTEL_TEST_PG=Host=localhost;Port=5432;Database=hotel_test;Username=postgres;Password=MAT_KHAU
dotnet test
```

Frontend: `cd frontend && npm run check:i18n` kiểm tra bản dịch.

## Nạp lại dữ liệu / đổi cấu trúc database

- Nạp lại dữ liệu mẫu từ đầu (xóa toàn bộ dữ liệu hiện có): `dotnet run -- --reset-db` (hoặc `HotelApi.exe --reset-db`).
- Mặc định bảng được tạo trực tiếp (`EnsureCreated`). Muốn dùng migration của EF Core (để đổi cấu trúc mà không phải xóa dữ liệu):

```bash
dotnet tool install --global dotnet-ef
cd backend/HotelApi
dotnet ef migrations add Initial
```

Từ lúc có thư mục `Migrations`, ứng dụng tự chạy `Migrate()` khi khởi động. Ràng buộc chống trùng booking vẫn do `CreateConstraints()` tạo (an toàn khi chạy lặp lại).
Khi đổi entity: `dotnet ef migrations add TenThayDoi`.
