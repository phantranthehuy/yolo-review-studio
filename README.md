# YOLO Review Studio G11 — v4.1.3

Ứng dụng chạy offline bằng trình duyệt, không cần npm hay backend.

## Chạy local

1. Mở Terminal tại thư mục `yolo-review-studio`.
2. Chạy: `python3 -m http.server 8000`
3. Mở: http://localhost:8000
4. Dừng máy chủ bằng `Control + C`.

## Điểm mới v4.1.3

- Mục 04: hai nút xuất `review_log_draft.csv` và gói báo cáo ZIP nằm sau toàn bộ phần đối chiếu box. CSV nháp vẫn tải dù một số ô chưa hoàn chỉnh; báo cáo ZIP vẫn kiểm tra dữ liệu đầy đủ.
- Mục 05: chọn thư mục ảnh (`webkitdirectory`) hoặc nhập/dán `image_id` và nhấn Enter / nút “Mở ảnh”; hỗ trợ ID đầy đủ hoặc đoạn duy nhất.
- Mục 04 và 05 dùng chung danh sách ảnh gốc trong cùng trang/trình duyệt, tự khớp ID sau khi chuẩn hóa tên Roboflow. Ảnh nạp ở một mục có thể dùng ở mục còn lại.
- Giữ cảnh báo kích thước box 5 giây và tự xóa box do người dùng tạo nếu cao dưới 12 px sau khoảng 0,5 giây.
- Giữ CSS chế độ tối và các sửa lỗi xuất CSV trước đó.

Lưu ý: do giới hạn bảo mật của trình duyệt, ảnh được giữ trong bộ nhớ tạm **trong trang hiện tại**; sau khi tải lại trang hoặc chuyển trang giao diện, cần chọn thư mục ảnh lại. Tệp nguồn trên máy tính không bị chỉnh sửa.

Các tệp giao diện gồm `index.html`, `default.html`, `forest.html`, `sakura.html`, `flower.html`. Bản phát hành đồng bộ ở `dist/`.
