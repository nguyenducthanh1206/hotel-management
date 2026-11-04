# Hotel – Hệ thống quản lý khách sạn 

React.js · ASP.NET Core 8 (C#) · PostgreSQL 16 · JWT

## 1. Yêu cầu hệ thống

### Máy phát triển / máy build

- Windows 64-bit.
- Git.
- .NET 8 SDK.
- Node.js 18 trở lên và npm.
- Docker Desktop (khuyến nghị) hoặc PostgreSQL 16 cài đặt trực tiếp.
- Kết nối Internet để tải các thư viện khi cài đặt và build.

### Máy chạy bản đã đóng gói

- Windows 64-bit.
- PostgreSQL đang hoạt động.
- Không cần cài .NET Runtime hoặc Node.js.

## 2. Tải mã nguồn

Mở PowerShell và chạy:

```powershell
git clone https://github.com/nguyenducthanh1206/hotel-management.git
cd hotel-management
```

## 3. Cấu hình cơ sở dữ liệu

### Cách 1: Sử dụng Docker (khuyến nghị)

Tại thư mục gốc dự án, chạy:

```powershell
docker compose up -d
```

Docker Compose khởi động PostgreSQL 16 với cấu hình mặc định:

| Thông tin | Giá trị |
|---|---|
| Database | `hoteldb` |
| Username | `postgres` |
| Password | `postgres` |
| Port | `5432` |

Nếu sử dụng Docker Compose mặc định và không thay đổi cấu hình trong `docker-compose.yml`, bạn có thể sử dụng ngay chuỗi kết nối mặc định trong `appsettings.json`.

### Cách 2: Sử dụng PostgreSQL cài đặt trực tiếp

Cài PostgreSQL 16 và tạo database có tên `hoteldb`.

Khi cài đặt PostgreSQL, người dùng có thể tự đặt username và password. Nếu thông tin đăng nhập khác cấu hình mặc định của dự án, cần cập nhật chuỗi kết nối trong `backend/HotelApi/appsettings.json`.

Ví dụ, nếu bạn đặt mật khẩu PostgreSQL là `MyPassword123`, hãy sửa:

```json
"ConnectionStrings": {
  "Default": "Host=localhost;Port=5432;Database=hoteldb;Username=postgres;Password=MyPassword123"
}
```

Thay username, password, port và tên database theo thông tin PostgreSQL thực tế trên máy của bạn.

## 4. Cấu hình backend

File cấu hình backend nằm tại:

```text
backend/HotelApi/appsettings.json
```

Cấu hình mặc định của dự án:

```json
{
  "Urls": "http://localhost:5000",
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=hoteldb;Username=postgres;Password=postgres"
  },
  "Jwt": {
    "Key": "HotelManagement-Local-Development-Key-2026-Do-Not-Use-In-Production",
    "Issuer": "HotelApi"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

### 4.1. Thay đổi mật khẩu PostgreSQL

Nếu sử dụng Docker Compose mặc định, bạn không cần thay đổi chuỗi kết nối.

Nếu sử dụng PostgreSQL cài trực tiếp hoặc mật khẩu khác `postgres`, hãy thay giá trị `Password` trong `ConnectionStrings:Default` bằng mật khẩu PostgreSQL của bạn.

Ví dụ:

```text
Host=localhost;Port=5432;Database=hoteldb;Username=postgres;Password=MyPassword123
```

**Lưu ý:** Mật khẩu trong chuỗi kết nối phải trùng với mật khẩu tài khoản PostgreSQL thực tế. Nếu username, port hoặc tên database khác, hãy thay đổi tương ứng.

### 4.2. Cấu hình JWT Key

`Jwt:Key` là khóa bí mật được sử dụng để tạo và xác thực JWT Token.

Dự án đã có khóa mẫu để thuận tiện chạy thử. Khi triển khai thực tế, hãy thay khóa này bằng một chuỗi ngẫu nhiên đủ dài và không chia sẻ công khai.

Có thể sử dụng biến môi trường để ghi đè cấu hình khi chạy backend bằng PowerShell:

```powershell
$env:ConnectionStrings__Default="Host=localhost;Port=5432;Database=hoteldb;Username=postgres;Password=MyPassword123"
$env:Jwt__Key="Your-Own-Long-Random-Secret-Key"
```

Các biến môi trường này chỉ có hiệu lực trong cửa sổ PowerShell hiện tại.

## 5. Chạy dự án ở chế độ phát triển

Đảm bảo PostgreSQL đang hoạt động và đã cấu hình backend theo mục 3 và mục 4.

### 5.1. Khởi động backend

Mở một cửa sổ PowerShell:

```powershell
cd backend/HotelApi
dotnet restore
dotnet run
```

Backend mặc định chạy tại:

- API: http://localhost:5000
- Swagger: http://localhost:5000/swagger

### 5.2. Khởi động frontend

Mở một cửa sổ PowerShell khác:

```powershell
cd frontend
npm install
npm run dev
```

Frontend chạy tại địa chỉ được Vite hiển thị trong terminal, thông thường là:

http://localhost:5173

Giữ cả hai cửa sổ backend và frontend hoạt động trong quá trình sử dụng.

## 6. Build thành ứng dụng Windows bằng build.bat

Dự án có file `build.bat` để tự động build giao diện React, chép giao diện vào backend và đóng gói backend thành chương trình Windows `HotelApi.exe`.

### 6.1. Yêu cầu trên máy build

- Windows 64-bit.
- .NET 8 SDK.
- Node.js 18 trở lên và npm.
- Kết nối Internet để tải các package cần thiết.

### 6.2. Thực hiện build

Mở PowerShell tại thư mục gốc dự án và chạy:

```powershell
.\build.bat
```

File sẽ tự động thực hiện các bước:

1. Chạy `npm install` và `npm run build` trong thư mục `frontend`.
2. Xóa `backend/HotelApi/wwwroot` cũ (nếu có), sau đó chép nội dung `frontend/dist` vào đó.
3. Chạy `dotnet publish` để đóng gói backend cho Windows 64-bit theo chế độ self-contained và single-file.

Nếu một bước gặp lỗi, quá trình build sẽ dừng và hiển thị thông báo lỗi trong cửa sổ lệnh.

### 6.3. Kết quả build

Sau khi build thành công, các tệp được xuất vào thư mục `release/`, gồm:

```text
release/
├── HotelApi.exe
├── appsettings.json
└── wwwroot/
```

Các tệp và thư mục thực tế khác do quá trình publish tạo ra cũng cần được giữ nguyên. Không tách `HotelApi.exe`, `appsettings.json` và `wwwroot` khỏi thư mục `release`.

### 6.4. Cấu hình và chạy bản đã build

Trước khi chạy `HotelApi.exe`, cần đảm bảo PostgreSQL đang hoạt động.

Mở file:

```text
release/appsettings.json
```

Kiểm tra phần `ConnectionStrings:Default`.

- Nếu sử dụng Docker Compose mặc định của dự án và chưa thay đổi mật khẩu, có thể giữ nguyên cấu hình.
- Nếu sử dụng PostgreSQL cài trực tiếp hoặc đặt mật khẩu khác, hãy thay `Password` bằng mật khẩu PostgreSQL thực tế.
- Nếu username, port hoặc tên database khác, hãy cập nhật các thông tin tương ứng.

Ví dụ:

```json
"ConnectionStrings": {
  "Default": "Host=localhost;Port=5432;Database=hoteldb;Username=postgres;Password=MyPassword123"
}
```

Kiểm tra `Jwt:Key`. Khóa mẫu chỉ dành cho môi trường phát triển/demo. Khi triển khai thực tế, hãy thay bằng khóa bí mật riêng.

Sau khi cấu hình:

1. Lưu file `release/appsettings.json`.
2. Chạy `release/HotelApi.exe`.
3. Truy cập http://localhost:5000.

Bản build phục vụ giao diện React và API chung qua backend, không cần chạy riêng frontend.

Máy chạy bản đóng gói không cần cài .NET Runtime hoặc Node.js, nhưng vẫn cần PostgreSQL đang hoạt động và thông tin kết nối chính xác.

**Lưu ý khi build lại:**

- `build.bat` xóa thư mục `release` cũ trước khi publish bản mới. Vì vậy, nếu đã chỉnh `release/appsettings.json`, hãy sao lưu file trước khi build lại và áp dụng cấu hình lại sau khi build.
- `build.bat` cũng xóa `backend/HotelApi/wwwroot` cũ trước khi chép giao diện mới.
- Bản build hiện tại dành cho Windows 64-bit.

## 7. Dữ liệu khởi tạo và đặt lại database

Khi backend khởi động lần đầu, ứng dụng tự tạo bảng và nạp dữ liệu mẫu nếu database còn trống.

Muốn xóa container và volume PostgreSQL do Docker Compose quản lý để tạo database mới từ đầu:

```powershell
docker compose down -v
docker compose up -d
```

**Cảnh báo:** `docker compose down -v` xóa volume chứa dữ liệu PostgreSQL; toàn bộ dữ liệu trong volume đó sẽ bị xóa.

Ứng dụng cũng hỗ trợ đặt lại database bằng tham số `--reset-db`:

```powershell
cd backend/HotelApi
dotnet run -- --reset-db
```

Với bản đã đóng gói, chạy tại thư mục `release`:

```powershell
.\HotelApi.exe --reset-db
```

**Cảnh báo:** Thao tác reset xóa dữ liệu hiện có. Chỉ sử dụng khi bạn chấp nhận mất dữ liệu trong database được cấu hình.

## 8. Dừng ứng dụng

- Backend hoặc frontend chạy trong PowerShell: nhấn `Ctrl + C` tại cửa sổ tương ứng.
- Bản đóng gói `HotelApi.exe`: đóng cửa sổ chương trình.
- PostgreSQL chạy bằng Docker Compose:

```powershell
docker compose down
```

Lệnh `docker compose down` dừng và xóa container nhưng giữ lại volume dữ liệu. Không thêm `-v` nếu muốn giữ dữ liệu database.