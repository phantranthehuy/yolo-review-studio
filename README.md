YOLO Review Studio v4.1.8 — nạp tự động qua một ô duy nhất, xác nhận nhãn B/A theo thư mục khi nạp nhiều bộ, đồng bộ ảnh và các mục 02–05.

# YOLO Review Studio — v4.1.9

Ứng dụng chạy offline bằng trình duyệt, không cần npm hay backend.

## Chạy local

1. Mở Terminal tại thư mục `yolo-review-studio`.
2. Chạy: `python3 -m http.server 8000`
3. Mở: http://localhost:8000
4. Dừng máy chủ bằng `Control + C`.

## Điểm mới v4.1.7

- **Một trạm nạp dữ liệu chung ở mục 01**: chọn loại dữ liệu (nhãn B, nhãn A, ảnh gốc, ảnh sau riêng, Ground Truth, CSV/YAML hoặc JSON quyết định), sau đó nhấn **Chọn tệp / Chọn thư mục**. Có thể kéo thả tệp theo loại đang chọn. Không còn các nút upload rải rác ở các mục 02–05.
- Các mục 02–05 hiển thị **đã có / còn thiếu** và nút **Đến trạm nạp dữ liệu**. Ảnh gốc tiếp tục dùng chung giữa đối chiếu box và công cụ tọa độ pixel; ở mục 05 nhập `image_id` để mở ảnh đã nạp.
- **QC riêng cho nhãn A sau sửa**: kiểm tra đúng 5 cột YOLO, class 0–3, số không hợp lệ/không hữu hạn, kích thước không dương, tâm box ngoài ảnh, cạnh vượt [0,1], trùng box hoàn toàn, gần trùng, box dưới 12px và chiều rộng dưới 1px khi đã có ảnh gốc. Báo cáo gồm mức độ, image_id, dòng TXT và loại phương tiện; tải `qc_nhan_A_sau_sua.csv` ngay cả khi có lỗi.
- Lỗi QC nghiêm trọng chặn so sánh và chuẩn bị gói nhãn A; cảnh báo nhỏ được hiển thị nhưng không tự xóa dữ liệu. Cắt biên A vẫn chỉ cho phép sai số rất nhỏ theo tùy chọn. Xóa box A dưới 12px ở mục 04 vẫn phải xác nhận bằng popup phủ toàn màn hình.
- Tệp trên máy **không bị ghi đè**. Dữ liệu được giữ trong phiên trình duyệt, cần tải lại sau khi reload trang. Nếu thiếu ảnh, QC chưa thể kết luận lỗi chiều cao theo pixel và sẽ thông báo rõ.

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

## v4.1.8.3
- Căn lại hai nút Chọn tệp / Chọn thư mục theo cùng kích thước, icon vector, hỗ trợ màn hình nhỏ và theme tối.
- Thêm CSS quan trọng ngay trong các trang HTML để tránh mất kiểu nút do CSS cũ bị cache.
- Giữ nguyên input file và folder của trình duyệt, không thay đổi chức năng upload.

## v4.1.8.3
- Xóa hẳn nút Chọn thư mục ảnh ở chức năng 05 khỏi HTML (không chỉ ẩn CSS).
- Ô nhập image_id vẫn hoạt động với ảnh từ kho chung mục 01; giữ các input kỹ thuật ẩn để không làm lỗi listener cũ.
- Đồng bộ src, assets, dist và tất cả 5 giao diện.

## v4.1.8.4 — sửa thông báo “Đang nạp dữ liệu”
- Hàng đợi nạp tuần tự thay vì chặn và bỏ qua thao tác nạp thứ hai.
- Khi chờ xác nhận A/B, hiện chỉ dẫn rõ; xác nhận/hủy đều giải phóng lượt xử lý.
- Bộ nạp chống lặp khi nhận cùng một lô; cho phép chọn lại cùng tệp/thư mục sau khi hủy.
- Giữ một ô upload chung ở mục 01; không có nút thư mục ảnh ở mục 05.

- File `.json` (kể cả trong ZIP) được bỏ qua khi nạp, không nhập vào dự án và không chiếm hàng đợi.

## v4.1.8.5 — sửa popup xác nhận xóa box A

- Đưa `#vm_shortModal` ra ngoài `#matchSection`, thành phần tử trực tiếp của `<body>` để overlay cố định đúng viewport kể cả khi section có hiệu ứng CSS.
- Căn giữa và giới hạn chiều cao hộp thoại, cuộn danh sách box dài; kiểm tra trên desktop và mobile.
- Không đổi logic xóa, cảnh báo dưới 12px, thống kê, TXT, hay CSV.

## v4.1.8.6 — giao diện gọn và lọc thành viên
- Mục 01 đổi tiêu đề thành **Nạp dữ liệu đầu vào**, giữ một ô nạp chung.
- Tùy chọn so sánh: `assignment_manifest.csv` đã nạp tự sinh các nút thành viên theo `assigned_reviewer_id` kèm số ảnh, một nút chọn một thành viên; **Dùng tất cả ảnh** bỏ lọc mà không xóa CSV đang nạp. Khi chọn thành viên, ô `reviewer_id` cũng cập nhật để thống nhất nhật ký.
- Các hàng manifest / schema / YAML thu gọn, bỏ nút chọn file phụ, giữ việc tự nhận dữ liệu từ ô chung.
- Mục 04: nhập/dán toàn bộ hay một phần duy nhất `image_id` và Enter/Mở ảnh, đồng thời chọn từ menu ảnh; nếu ID mơ hồ sẽ yêu cầu chọn rõ hơn.
- Căn chỉnh thanh tìm ảnh trong kết quả và khu vực mở ảnh theo ID mục 05.
- Không thay đổi thuật toán IoU, ngưỡng cảnh báo 12px hoặc popup xóa box A.

## v4.1.9 — hướng dẫn trực tiếp trong giao diện và kiểm giữa nhóm

- Trang đầu có lộ trình 4 bước, giải thích thuật ngữ và **Sổ tay sử dụng chi tiết** cho mục 01–05 cùng bàn giao.
- Mục 04 thêm nút chuyển **Batch của nhóm / Kiểm giữa nhóm**, không có thêm điểm upload nào.
- Tự nhận diện và quản lý riêng `intergroup_assignments.csv`, `intergroup_review/images/`, `intergroup_review/baseline_labels/` (hoặc `baseline_label/`). Giữ `assignment_manifest.csv` và A/B của batch chính bất biến.
- Chỉ dùng số ID thực tế trong intergroup assignments; thiếu ảnh/nhãn được cảnh báo, không tự điền thành 30.
- Để kiểm đầy đủ, người dùng nạp bản nhãn đã sửa của **nhóm nguồn** qua ô upload mục 01 và chọn vai trò **Nhãn đã sửa của nhóm nguồn (intergroup)**.
- Dùng lại hàm ghép box/IoU của công cụ chính để đề xuất sai khác, thể hiện baseline và nhãn nhóm nguồn trên ảnh toàn cảnh. Có zoom, tìm ID, chọn ảnh, chuyển ảnh và ghi `agree/disagree`, `error_type`, `resolution`, `checker_id`.
- Tải `crosscheck_log_intergroup_draft.csv` độc lập. Quyết định intergroup không làm đổi nhãn A/B, số liệu báo cáo hoặc quyết định ghép của nhóm sở hữu.
- Chưa kiểm định trên một thư mục Gxx thực tế từ giảng viên; thử nghiệm dùng gói giả lập 30 ID/30 ảnh/30 baseline TXT/30 TXT sau sửa. Cần đối chiếu schema nếu giảng viên sử dụng tên cột khác ví dụ.

### Lưu ý khi nạp ZIP Roboflow
- Tự nhận diện ZIP `TRAFFIC_Gxx_REVIEW...yolov8.zip` và chỉ đọc nhãn TXT/YAML; **không dùng ảnh trong ZIP này để ghi đè ảnh nguyên gốc của Gxx** (tránh ảnh resize/augmentation).
- ZIP trên 1 GB cần giải nén rồi chọn thư mục để tránh vượt bộ nhớ trình duyệt.
