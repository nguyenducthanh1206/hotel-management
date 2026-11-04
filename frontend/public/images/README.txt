CÁCH THÊM ẢNH THẬT (không cần sửa code)

Hệ thống đã có hình minh họa sẵn. Khi bạn thả ảnh vào đúng tên bên dưới, ảnh thật sẽ tự thay hình minh họa.

1) Ảnh bìa trang chủ:   public/images/hero.jpg      (ngang, nên từ 1920x1080)

2) Ảnh từng hạng phòng: public/images/rooms/<tên-hạng-phòng>-<số>.jpg
   Tên hạng phòng viết thường, bỏ dấu cách bằng dấu gạch ngang. Mỗi hạng phòng có 4 ảnh (tỉ lệ 3:2):
     -1.jpg  phòng ngủ  (cũng là ảnh trên thẻ phòng)
     -2.jpg  phòng tắm
     -3.jpg  tầm nhìn / cửa sổ
     -4.jpg  góc làm việc hoặc phòng khách

   Dữ liệu mẫu có 6 hạng phòng, tức là các file:
     rooms/standard-1.jpg ... standard-4.jpg
     rooms/superior-twin-1.jpg ... superior-twin-4.jpg
     rooms/deluxe-1.jpg ... deluxe-4.jpg
     rooms/family-1.jpg ... family-4.jpg
     rooms/suite-1.jpg ... suite-4.jpg
     rooms/presidential-suite-1.jpg ... presidential-suite-4.jpg
   Không cần đủ 4 ảnh: ảnh nào thiếu thì ô đó dùng hình minh họa.
   Hạng phòng thêm sau trong trang Quản trị cũng theo quy tắc này (ví dụ "Garden Villa" -> garden-villa-1.jpg).

3) Sau khi thả ảnh:
   - Đang chạy "npm run dev": tải lại trang là thấy.
   - Dùng bản HotelApi.exe: chạy lại build.bat để đóng gói ảnh vào.

LƯU Ý: chỉ dùng ảnh bạn tự chụp hoặc ảnh có giấy phép cho phép dùng (ví dụ nguồn ảnh miễn phí bản quyền).
Đừng chép ảnh từ website khách sạn khác. Ảnh nên nén dưới khoảng 300 KB mỗi ảnh để trang tải nhanh.
