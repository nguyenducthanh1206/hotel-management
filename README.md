# Hotel -- Hệ thống quản lý khách sạn (Nhóm 3)

React.js · ASP.NET Core 8 (C#) · PostgreSQL 16 · JWT

## 1. Yêu cầu hệ thống

### Máy phát triển / máy build

-   Windows 64-bit.
-   Git.
-   .NET 8 SDK.
-   Node.js 18 trở lên và npm.
-   Docker Desktop (khuyến nghị) hoặc PostgreSQL 16 cài đặt trực tiếp.
-   Kết nối Internet để tải các thư viện khi cài đặt và build.

### Máy chạy bản đã đóng gói

-   Windows 64-bit.
-   PostgreSQL đang hoạt động.
-   Không cần cài .NET Runtime hoặc Node.js.

## 2. Tải mã nguồn

Mở PowerShell và chạy:

``` powershell
git clone https://github.com/nguyenducthanh1206/hotel-management.git
cd hotel-management
```

## 3. Cấu hình cơ sở dữ liệu

### Cách 1: Sử dụng Docker (khuyến nghị)

Tại thư mục gốc dự án, chạy:

``` powershell
docker compose up -d
```

Docker Compose khởi động PostgreSQL 16 với cấu hình:

  Thông tin   Giá trị
  ----------- ------------
  Database    `hoteldb`
  Username    `postgres`
  Password    `postgres`
  Port        `5432`

### Cách 2: Sử dụng PostgreSQL cài đặt trực tiếp

Cài PostgreSQL 16, tạo database tên `hoteldb`, sau đó sử dụng thông tin
máy chủ, database, username và password tương ứng trong chuỗi kết nối
backend ở bước tiếp theo.

## 4. Cấu hình backend

Khi chạy backend ở chế độ phát triển, mở PowerShell tại thư mục gốc dự
án và thiết lập các biến môi trường:

``` powershell
$env:ConnectionStrings__Default="Host=localhost;Port=5432;Database=hoteldb;Username=postgres;Password=postgres"
$env:Jwt__Key="Your-Own-Long-Random-Secret-Key"
```

Thay username, password và JWT key cho phù hợp với môi trường của bạn.
Các biến môi trường này chỉ có hiệu lực trong cửa sổ PowerShell hiện
tại.

## 5. Chạy dự án ở chế độ phát triển

Đảm bảo PostgreSQL đang hoạt động và đã cấu hình backend theo mục 4.

### 5.1. Khởi động backend

Mở một cửa sổ PowerShell:

``` powershell
cd backend/HotelApi
dotnet restore
dotnet run
```

Backend mặc định chạy tại:

-   API: http://localhost:5000
-   Swagger: http://localhost:5000/swagger

### 5.2. Khởi động frontend

Mở một cửa sổ PowerShell khác, tại thư mục gốc dự án chạy:

``` powershell
cd frontend
npm install
npm run dev
```

Frontend chạy tại địa chỉ được Vite hiển thị trong terminal, thông
thường là:

http://localhost:5173

Giữ cả hai cửa sổ backend và frontend hoạt động trong quá trình sử dụng.

## 6. Build thành ứng dụng Windows bằng build.bat

Dự án có file `build.bat` để tự động build giao diện React, chép giao
diện vào backend và đóng gói backend thành chương trình Windows
`HotelApi.exe`.

### 6.1. Yêu cầu trên máy build

-   Windows 64-bit.
-   .NET 8 SDK.
-   Node.js 18 trở lên và npm.
-   Kết nối Internet để tải các package cần thiết.

### 6.2. Thực hiện build

Mở PowerShell tại thư mục gốc dự án và chạy:

``` powershell
.\build.bat
```

File sẽ tự động thực hiện các bước:

1.  Chạy `npm install` và `npm run build` trong thư mục `frontend`.
2.  Xóa `backend/HotelApi/wwwroot` cũ (nếu có), sau đó chép nội dung
    `frontend/dist` vào đó.
3.  Chạy `dotnet publish` để đóng gói backend cho Windows 64-bit theo
    chế độ self-contained và single-file.

Nếu một bước gặp lỗi, quá trình build sẽ dừng và hiển thị thông báo lỗi
trong cửa sổ lệnh.

### 6.3. Kết quả build

Sau khi build thành công, các tệp được xuất vào thư mục `release/`, gồm:

``` text
release/
├── HotelApi.exe
├── appsettings.json
└── wwwroot/
```

Các tệp và thư mục thực tế khác do quá trình publish tạo ra cũng cần
được giữ nguyên. Không tách `HotelApi.exe`, `appsettings.json` và
`wwwroot` khỏi thư mục `release`.

### 6.4. Cấu hình và chạy bản đã build

1.  Đảm bảo PostgreSQL đang hoạt động.
2.  Mở `release/appsettings.json`.
3.  Điền chuỗi kết nối PostgreSQL vào `ConnectionStrings:Default`.
4.  Điền một JWT key đủ dài và riêng cho môi trường của bạn vào
    `Jwt:Key`.
5.  Lưu file và chạy `release/HotelApi.exe`.
6.  Truy cập http://localhost:5000.

Bản build phục vụ giao diện React và API chung qua backend, nên không
cần chạy riêng frontend. Máy chạy bản đóng gói không cần cài .NET
Runtime hoặc Node.js, nhưng vẫn cần PostgreSQL đang hoạt động và thông
tin kết nối chính xác.

**Lưu ý khi build lại:**

-   `build.bat` xóa thư mục `release` cũ trước khi publish bản mới.
-   `build.bat` cũng xóa `backend/HotelApi/wwwroot` cũ trước khi chép
    giao diện mới.
-   Bản build hiện tại dành cho Windows 64-bit.

## 7. Dữ liệu khởi tạo và đặt lại database

Khi backend khởi động lần đầu, ứng dụng tự tạo bảng và nạp dữ liệu mẫu
nếu database còn trống.

Muốn xóa container và volume PostgreSQL do Docker Compose quản lý để tạo
database mới từ đầu:

``` powershell
docker compose down -v
docker compose up -d
```

**Cảnh báo:** `docker compose down -v` xóa volume chứa dữ liệu
PostgreSQL; toàn bộ dữ liệu trong volume đó sẽ bị xóa.

Ứng dụng cũng hỗ trợ đặt lại database bằng tham số `--reset-db`:

``` powershell
cd backend/HotelApi
dotnet run -- --reset-db
```

Với bản đã đóng gói, chạy tại thư mục `release`:

``` powershell
.\HotelApi.exe --reset-db
```

**Cảnh báo:** Thao tác reset xóa dữ liệu hiện có. Chỉ sử dụng khi bạn
chấp nhận mất dữ liệu trong database được cấu hình.

## 8. Dừng ứng dụng

-   Backend hoặc frontend chạy trong PowerShell: nhấn `Ctrl + C` tại cửa
    sổ tương ứng.
-   Bản đóng gói `HotelApi.exe`: đóng cửa sổ chương trình.
-   PostgreSQL chạy bằng Docker Compose:

``` powershell
docker compose down
```

Lệnh `docker compose down` dừng và xóa container nhưng giữ lại volume dữ
liệu. Không thêm `-v` nếu muốn giữ dữ liệu database.
