# YOLO Review Studio G11 — v4.1.5

Ứng dụng chạy offline bằng trình duyệt, không cần npm hay backend.

## Chạy local

1. Mở Terminal tại thư mục `yolo-review-studio`.
2. Chạy: `python3 -m http.server 8000`
3. Mở: http://localhost:8000
4. Dừng máy chủ bằng `Control + C`.

## Điểm mới v4.1.5

- Mục 04, vùng **Toàn ảnh**: thay chọn tỷ lệ zoom bằng **một nút Zoom** duy nhất; bấm nút hoặc phím **Z** để bật/tắt chế độ zoom.
- Cuộn bánh xe chuột hoặc hai ngón trackpad trên ảnh để phóng to / thu nhỏ theo vị trí con trỏ; trackpad pinch qua Ctrl/⌘+wheel và Safari gesture; hai ngón chụm/mở trên cảm ứng.
- Phím `+`/`-` (và numpad) để tăng giảm, `0` về vừa khung. Khi zoom, kéo chuột / một ngón để di chuyển, Shift+cuộn để pan. Nút Zoom bấm lại đưa ảnh về vừa khung.
- Zoom toàn cảnh đồng bộ trong chế độ chồng ảnh / tách hai ảnh. Chọn và tự chuyển sang box kế tiếp giữ mức zoom, tự canh box vào giữa ảnh.
- Chỉ thay vùng xem ảnh; tọa độ nhãn, quyết định ghép, CSV/ZIP và các chức năng mục 05 không thay đổi.

## Điểm mới v4.1.4

- Mục 04: sau khi xác nhận ghép cặp B–A, xác nhận box B đã xóa hoặc box A mới thêm, tự chuyển sang box chưa ghép tiếp theo **trong cùng ảnh** (ưu tiên B cho ghép/xóa, A cho thêm).
- Hai ảnh crop, box đang chọn và thống kê cập nhật ngay; nếu không còn box chưa ghép, bỏ chọn và thông báo hoàn tất. Các cặp tự động khác vẫn xem thủ công được.
- Có công tắc **Tự chuyển sang box chưa ghép tiếp theo** (mặc định bật) để người dùng tùy chọn. Nút **Gỡ ghép** vẫn giữ box hiện tại để người dùng chọn ứng viên khác.
- Không thay đổi cách tính IoU, nội dung nhãn hay định dạng CSV/ZIP.

## Điểm mới v4.1.3

- Mục 04: hai nút xuất `review_log_draft.csv` và gói báo cáo ZIP nằm sau toàn bộ phần đối chiếu box. CSV nháp vẫn tải dù một số ô chưa hoàn chỉnh; báo cáo ZIP vẫn kiểm tra dữ liệu đầy đủ.
- Mục 05: chọn thư mục ảnh (`webkitdirectory`) hoặc nhập/dán `image_id` và nhấn Enter / nút “Mở ảnh”; hỗ trợ ID đầy đủ hoặc đoạn duy nhất.
- Mục 04 và 05 dùng chung danh sách ảnh gốc trong cùng trang/trình duyệt, tự khớp ID sau khi chuẩn hóa tên Roboflow. Ảnh nạp ở một mục có thể dùng ở mục còn lại.
- Giữ cảnh báo kích thước box 5 giây và tự xóa box do người dùng tạo nếu cao dưới 12 px sau khoảng 0,5 giây.
- Giữ CSS chế độ tối và các sửa lỗi xuất CSV trước đó.

Lưu ý: do giới hạn bảo mật của trình duyệt, ảnh được giữ trong bộ nhớ tạm **trong trang hiện tại**; sau khi tải lại trang hoặc chuyển trang giao diện, cần chọn thư mục ảnh lại. Tệp nguồn trên máy tính không bị chỉnh sửa.

Các tệp giao diện gồm `index.html`, `default.html`, `forest.html`, `sakura.html`, `flower.html`. Bản phát hành đồng bộ ở `dist/`.
