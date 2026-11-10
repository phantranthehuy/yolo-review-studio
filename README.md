## v5.0 — Nạp thư mục G11 và gộp theo thành viên (cập nhật giao diện)

- Tại mục 01 chỉ dùng **Chọn tệp** hoặc **Chọn thư mục**. Có thể chọn toàn bộ `G11/` hoặc ZIP `G11.zip` chứa `assignment_manifest.csv` và nhiều thư mục `G11_SV01/labels/`, `G11_SV02/labels/`...
- Phần mềm **đọc assignment_manifest.csv nằm bên trong lần nạp trước khi phân loại TXT**, không bắt người dùng nạp manifest riêng trước. Khi có TXT, hộp thoại xuất hiện để người dùng gán **Nhãn B**, **Nhãn A** hoặc **Nhãn thành viên** (Ground Truth và kiểm giữa nhóm ở lựa chọn nâng cao).
- Chọn **Nhãn thành viên**: tên/đường dẫn và `image_id` được đối chiếu `assigned_reviewer_id`; nếu tên người sai, trùng ID hoặc nhãn hỏng, chương trình báo lỗi và không ghi đè. Dữ liệu nằm riêng tại mục 06, **không tự thay nhãn A** và không ép chuyển trang sau nạp.
- Nếu thiếu manifest, vẫn được nạp B/A bình thường; chỉ thao tác nạp nhãn thành viên phải có manifest hợp lệ. Thiếu manifest, nhãn thành viên không được gộp.
- Nếu đã có A, chỉ nút **Rà soát QC** ở mục 06 mới yêu cầu xác nhận thay A bằng nhãn gộp; nút tải bộ gộp chỉ hoạt động khi đủ theo phân công.
- Thanh điều hướng 01–06 tự chuyển thành menu thu gọn ở màn hình dưới hoặc bằng 1320px, không để các tab/nút chủ đề đè nhau.

# YOLO Review Studio — v5.0

Ứng dụng chạy offline trong trình duyệt, không cần backend. QC nhãn A tại mục 02, gộp nhãn từng thành viên tại mục 06.

## v5.0 — Tinh chỉnh bố cục nạp dữ liệu và đối chiếu
- Mục 01 chỉ còn **hai nút Chọn tệp / Chọn thư mục**. Không còn nút ZIP thành viên và Thư mục thành viên riêng; dữ liệu thành viên được tự phân loại theo assignment manifest và chuyển vào kho mục 06.
- Không có manifest hợp lệ thì ZIP/thư mục có tên thành viên bị từ chối, không bị ghi nhầm vào nhãn A/B.
- Thông báo "Chọn hai bộ nhãn để bắt đầu" và bảng kết quả theo ảnh được gom vào phạm vi **04 – Đối chiếu B–A**; không còn thanh thông báo rời giữa các chức năng.
- Giữ nguyên nhãn phiên bản **v5.0** và cơ chế thay thế A cũ bằng hộp xác nhận khi chuyển từ mục 06 sang QC.

## v5.0 — Kho gộp nhãn độc lập theo thành viên
- Giao diện được căn lại theo một khung nội dung; hướng dẫn đầu trang nằm gọn trong một hàng ở desktop, mục 06 không còn nằm ngoài main. Thư viện ZIP và giấy phép được chuyển xuống cuối trang; Feedback nằm trong footer.
- Nhãn `NEW` ở lịch sử cập nhật chỉ dành cho **v5.0**; các phiên bản cũ giữ lại thông tin nhưng không có nhãn này.
- Mục 06 bắt buộc assignment_manifest.csv có image_id và assigned_reviewer_id; **nạp ZIP/thư mục nhãn từng người ở khu nhập dữ liệu mục 01**. Kho mục 06 giữ riêng nhãn nguồn, tự xác định chủ sở hữu qua tên thư mục hoặc image_id được giao.
- Thanh tiến độ đủ/thiếu theo từng thành viên, chặn tên trùng, sai phân công và thiếu TXT. Khi đủ mới cho tải ZIP gộp.
- Nút Rà soát QC chuyển bộ gộp sang nhãn A sau khi xác nhận thay thế A cũ, giữ dữ liệu mục 06 và nhãn B nguyên vẹn.
- Mục 02 có bộ lọc cảnh báo theo thành viên; thao tác nhanh theo nhóm tôn trọng phạm vi bộ lọc.


## v4.2.8 — Xuất nhãn A theo thành viên và gộp không xung đột

- `calibration_ready.zip` tạo từ trạng thái A hiện có **lúc bấm tải**, bao gồm chỉnh sửa QC/mục 05 đã áp dụng vào A trong phiên. **Kiểm tra lại QC chỉ quét, không tự sửa**; ZIP đã tải trước không tự thay đổi.
- Mục 02 → Chuẩn bị gói nhãn: chọn một thành viên và tải `labels_<reviewer_id>_ready.zip`, chứa `labels/`, `calibration_ids.csv`, `filename_mapping.csv`, `boundary_changes.csv`. Không cần đủ nhãn của những người khác để tải một người, nhưng người đó phải đủ và đúng.
- Nút **Tải toàn nhóm + bộ gộp** tạo `labels_all_members_merge_ready.zip`: các thư mục `members/<reviewer_id>/labels/` và một bộ `merged/labels/` để dùng thẳng, cùng `merge_map.csv` ghi chủ sở hữu từng `image_id`.
- Bắt buộc `assignment_manifest.csv` có cột `assigned_reviewer_id`. Trùng `image_id` trong manifest, nhãn trùng sau chuẩn hóa, thiếu TXT được giao, sai chủ sở hữu, QC ERROR thuộc phạm vi xuất, hoặc nhãn thừa khi xuất toàn nhóm đều chặn xuất. Không tự ghi đè hay tạo TXT rỗng thay cho nhãn thiếu.
- Dữ liệu A trên máy không bị sửa tự động; tải lại khi có thay đổi.

## v4.2.7 — đồng bộ tên TXT A với bộ labels và sửa “Kiểm tra lại QC”

- Mục 02: nút **Kiểm tra lại** phản hồi khi bấm, hiện giờ hoàn tất, số TXT/box, số lỗi/cảnh báo và tình trạng kiểm pixel; xử lý lỗi kiểm tra mà không để trạng thái “Đang kiểm” mãi.
- Mục 05: tên nhãn A hiển thị là **tên sau chuẩn hóa** (`image_id.txt`) để khớp tên file trong ZIP **Tải nhãn A đổi tên** (mục 01).
- Nút **Tải TXT A** tải nhãn đã sửa với tên chuẩn hóa; không dùng lại tên `.rf.<hash>.txt` của file nguồn Roboflow. Tên nguồn xem được bằng rê chuột lên chú thích.
- Giữ nguyên nội dung YOLO TXT; chỉ thay tên file xuất và chú thích. Không ghi đè trực tiếp lên ổ đĩa.
- Khi tắt chuẩn hóa tên ở mục 01, tên tải ở mục 05 cũng theo tùy chọn này để hai chức năng xuất thống nhất.

## v4.2.5 — Kéo box gọn hơn, QC nhanh và tương phản tối

- Mục 05: **“Xóa box A” nằm cạnh “Chép tọa độ”** trên thanh thao tác cạnh box và nằm sau lệnh sao chép trong menu `⋯`. Bỏ nút xóa A thừa ở thanh nguồn dữ liệu. Box B không có nút xóa; vùng tạm có “Xóa vùng tạm”. Mọi thao tác xóa đều xác nhận và chỉ cập nhật nhãn A trong bộ nhớ.
- Khi kéo/chỉnh box, chỉ cập nhật phần tử SVG đang sửa theo `requestAnimationFrame`, không dựng lại toàn bộ overlay cho mỗi sự kiện con trỏ. Dùng tọa độ con trỏ làm điểm neo để tránh lệch vị trí khi thanh công cụ nổi hoặc vùng cuộn thay đổi. Nhãn và đường khung vẫn sắc nét khi zoom lớn.
- Mục 02: tăng tương phản nút **Chỉnh sửa / Cắt biên / Xóa** trong chế độ tối, dàn lại nút theo cột để không tràn.
- Thêm khối thu gọn **Xử lý nhanh theo nhóm** cho box cao <12 px, box rộng <1 px, box trùng hoàn toàn và box vượt biên rất nhỏ. Tất cả đều xác nhận trước khi thao tác. Không tự xử lý box gần trùng hoặc sai lớp chỉ dựa vào thuật toán.
- Tối ưu QC: so box gần trùng bằng sweep-line thay vì kiểm mọi cặp không liên quan, giảm dựng lại bảng khi quét ảnh, giới hạn số dòng hiển thị ban đầu và ngăn xử lý hàng loạt khi kết quả QC đã cũ.
- Đã thử trên dữ liệu tổng hợp với 100 box, 50 bước kéo, QC và xóa nhanh theo nhóm; kiểm tra không có lỗi JavaScript. Cần kiểm thử thêm trên dữ liệu thực tế của bạn.


## v4.2.3 — chỉnh nhãn A trong mục 05, overlay sắc nét

- **B (ban đầu):** khung xanh lam nét đứt, chỉ xem; không thể di chuyển/đổi lớp/xóa.
- **A (sau sửa):** khung xanh ngọc nét liền; chọn rồi kéo để di chuyển, chọn lần nữa và kéo mép/góc để đổi kích thước, đổi class bằng bộ chọn `Đổi lớp A`, hoặc `Xóa box A` có xác nhận. Những thay đổi cập nhật bộ A đang nạp trong phiên và làm mất hiệu lực thống kê QC/đối chiếu cũ để cần tính lại.
- **Vùng tạm:** màu tím, độc lập TXT A, phục vụ ghi chú ngoại lệ và copy pixel.
- Tên class, số dòng, tọa độ và khung được vẽ bằng SVG vector ở đúng pixel CSS (không dùng canvas bị thu nhỏ bitmap). Sau click không ẩn tên vì thanh công cụ xuất hiện. Ở zoom lớn cỡ chữ hiển thị theo kích thước màn hình, không phóng đại theo box.
- `Tải TXT A` lưu bộ nhãn A đã sửa; **không ghi đè file gốc trên máy**. Đổi lại nhãn B vẫn bảo toàn. Để xem file A cập nhật ở các mục khác, chạy lại QC/đối chiếu.
- Tình huống thử: chỉ đọc B, sửa vị trí A, đổi class A, tải TXT, xóa A cuối cùng, click giữ nhãn, zoom 800% ở Chrome headless với DPI 2. Ảnh gốc zoom vượt độ phân giải thật có thể lộ pixel ảnh — chỉ khung/chữ/tọa độ được đảm bảo sắc nét bằng vector.

## v4.2.1 — sửa lỗi đọc nhãn kiểm giữa nhóm và quản lý dữ liệu đã nạp

- **Sửa lỗi `window.YoloDiff.parseLabels`**: phần kiểm giữa nhóm tự đọc file YOLO TXT và CSV phân công, tự đối chiếu box qua IoU 0,50 mà không phụ thuộc bộ so sánh A–B chính. Khắc phục trường hợp màn hình liên nhóm báo `undefined is not an object` khi mở nhãn nhóm nguồn.
- Hỗ trợ tên ảnh/nhãn dài (kể cả dạng hash), chỉ cần `image_id` khớp. TXT sai định dạng sẽ báo tên tệp và số dòng lỗi; không được lưu kết luận khi chưa đọc nhãn hợp lệ.
- **Quản lý dữ liệu** được tổ chức thành ba khối gọn: (1) nhãn A/B, Ground Truth, ảnh gốc/ảnh sau; (2) nhãn nhóm nguồn, baseline, ảnh liên nhóm, phân công và kết luận; (3) manifest, danh sách ảnh chấm, mẫu log và tải nhãn đổi tên.
- Nút xóa chỉ xóa bộ dữ liệu trong bộ nhớ của trang; có hộp xác nhận, tự hủy kết luận kiểm giữa nhóm phụ thuộc tập vừa xóa. Không xóa tệp trên máy. Dữ liệu của batch chính và kiểm giữa nhóm độc lập.
- Sau khi xóa nhãn A/B, bảng QC và kết quả đối chiếu cũ cũng được làm mới để tránh dùng dữ liệu lỗi thời.

**Đã thử nghiệm:** Chromium, dữ liệu nhãn dạng hash, có/không có `window.YoloDiff`, file lỗi tọa độ, xác nhận/hủy xóa, bảo toàn các bộ dữ liệu không liên quan. Không thay việc nghiệm thu dữ liệu G11 thực tế.

## Chạy local

1. Mở Terminal tại thư mục `yolo-review-studio`.
2. Chạy: `python3 -m http.server 8000`
3. Mở: http://localhost:8000
4. Dừng máy chủ bằng `Control + C`.

## Điểm mới v4.1.7

- **Một trạm nạp dữ liệu chung ở mục 01**: chọn loại dữ liệu (nhãn B, nhãn A, ảnh gốc, ảnh sau riêng, Ground Truth, CSV/YAML hoặc JSON quyết định), sau đó nhấn **Chọn tệp / Chọn thư mục**. Có thể kéo thả tệp theo loại đang chọn. Không còn các nút upload rải rác ở các mục 02–05.
- Các mục 02–05 hiển thị **đã có / còn thiếu** và nút **Đến trạm nạp dữ liệu**. Ảnh gốc tiếp tục dùng chung giữa đối chiếu box và công cụ tọa độ pixel; ở mục 05 nhập `image_id` để mở ảnh đã nạp.
- **QC riêng cho nhãn A sau sửa**: kiểm tra đúng 5 cột YOLO, class 0–3, số không hợp lệ/không hữu hạn, kích thước không dương, tâm box ngoài ảnh, cạnh vượt [0,1], trùng box hoàn toàn, gần trùng, box dưới 12px và chiều rộng dưới 1px khi đã có ảnh gốc. Báo cáo gồm mức độ, image_id, dòng TXT và loại phương tiện; tải `qc_nhan_A_sau_sua.csv` ngay cả khi có lỗi.
- Lỗi QC nghiêm trọng chặn so sánh và chuẩn bị gói nhãn A; cảnh báo nhỏ được hiển thị nhưng không tự xóa dữ liệu. Cắt biên A vẫn chỉ cho phép sai số rất nhỏ theo tùy chọn. Xóa box A dưới 12px ngay trong mục 02 vẫn phải xác nhận bằng popup phủ toàn màn hình.
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

## v4.2.0 — QC rõ ràng và đối chiếu độ đầy đủ theo `image_id`

- Mục **02** tập trung vào **QC nhãn A**: tổng quan số tệp, box, lỗi/cảnh báo; trạng thái cụ thể từng nhóm quy tắc (YOLO, biên ảnh, box trùng, pixel, độ đầy đủ). Nếu không có ảnh gốc, kiểm tra kích thước pixel hiển thị **chưa kiểm được** thay vì báo đạt.
- Tự kiểm tra **thiếu TXT, TXT ngoài danh sách, trùng `image_id` và ảnh gốc thiếu** theo `assignment_manifest.csv`, giữ phạm vi chọn thành viên. **Không còn ô “Số ảnh dự kiến”**; chỉ đếm tệp không thể bảo đảm danh sách ảnh chính xác.
- Nếu chưa nạp manifest, phần mềm ghi rõ chưa thể chứng minh độ đầy đủ; QC cấu trúc vẫn hoạt động. Nếu có lỗi về định dạng hoặc bộ nhãn không khớp manifest, xuất gói bị chặn để tránh nộp nhầm.
- **Chấm F1** dùng Ground Truth ở mục 03. **Đối chiếu B–A** nằm riêng ở mục 04. Box A dưới 12 px được xem và xử lý ngay trong mục 02; nhãn B không cần nạp để chạy QC này.
- **Tải báo cáo QC (.csv)** luôn lấy kết quả quét mới nhất; bộ lọc trong giao diện chỉ để xem, không lược bớt CSV. Các file gốc trên máy không bị thay đổi.
- Chuẩn bị `calibration_ready.zip` nằm trong mục thu gọn ở cuối mục 02 để giảm nhiễu giao diện; giữ nguyên định dạng tệp xuất.

### Điều chỉnh theo phản hồi — xử lý cảnh báo ngay trong QC
- Bảng xử lý box A dưới 12 px **đã chuyển hẳn từ mục 04 về mục 02**. Mục 04 không còn khối QC trùng lặp.
- Tại kết quả QC, nhấn **Xem box** ở dòng `HEIGHT_LT_12PX`; trang mở nhóm thao tác liên quan, hiển thị ảnh toàn cảnh và vùng box phóng to.
- Chọn box, kiểm tra thủ công và bấm **Xóa box A đã chọn…** rồi xác nhận lần nữa. Box nhỏ **không mặc nhiên là lỗi**; ví dụ xe quá xa vẫn có thể là nhãn hợp lệ.
- Chỉ cần nạp **nhãn A + ảnh gốc**, không cần nhãn B để xem/xóa cảnh báo này. Nếu đã có kết quả đối chiếu B–A, số liệu sẽ cập nhật; nếu chưa so, chương trình chỉ cập nhật A trong phiên làm việc.
- Sau thao tác, hiện nút **Tải nhãn A đã cập nhật (.zip)**, tránh bỏ sót việc lưu. Tệp TXT/ảnh gốc trên máy không bị sửa.
- Màn hình mặc định `index.html` dùng **giao diện Default ít trang trí**. Các giao diện Forest/Sakura/Flower vẫn giữ lựa chọn nếu muốn.

### Thử nghiệm
- Kiểm tra giao diện bằng Chromium: không có lỗi JavaScript trong luồng nạp nhãn A và ảnh gốc, phát hiện box cao 6 px, xem ảnh, xác nhận xóa và cập nhật nhãn A.
- Kiểm tra thêm luồng đã chạy so sánh B–A: xóa box có xác nhận, kết quả `boxes_removed` được tính lại.
- Đây là kiểm thử dữ liệu tổng hợp, chưa thay thế nghiệm thu với tập ảnh G11 thực tế hoặc các trình duyệt khác.


## v4.2.2 · Tên tệp thực dưới nút quản lý dữ liệu

Trong **01 → Quản lý dữ liệu đã nạp / tải nhãn đổi tên**, mỗi thao tác xóa hoặc tải có chú thích tên tệp đang được lưu trong phiên. Dữ liệu nhiều tệp hiển thị số lượng, một tên đại diện và **Xem đủ N tên tệp** (có danh sách cuộn và đường dẫn gốc trong ZIP/thư mục). Khi xóa, thay thế, hoặc nạp thêm, chú thích tự cập nhật; chưa nạp thì ghi **Chưa nạp**. Riêng **kết luận liên nhóm** là kết quả tạo trong phiên, nên tên `crosscheck_log_intergroup_draft.csv` được phân biệt là **tệp sẽ xuất**, không bị mô tả sai là tệp đã nạp.


### v4.2.4 – Xử lý trực tiếp từng lỗi QC
- Dòng QC của box A có nút **Chỉnh sửa** mở đúng ảnh và chọn/highlight đúng dòng box A tại mục 05. B không chỉnh được; có nút quay lại mục 02.
- Box cao dưới 12 px và các lỗi hình học có thể **Xóa** sau xác nhận; lỗi trùng/gần trùng không được tự xử lý vì phải nhìn vật thể thật. Xóa ảnh hưởng duy nhất nhãn A trong phiên, cần tải lại ZIP.
- Dòng TXT sai cấu trúc hoặc bộ TXT không parse được có **Sửa TXT** với kiểm tra 5 cột, class 0–3, box nằm trong ảnh. Không suy diễn tọa độ.
- Các kết quả chấm/đối chiếu cũ mất hiệu lực sau khi sửa/xóa A; chạy lại để làm báo cáo mới.
- Với lỗi vượt biên **nhỏ ≤ 0,00001** có nút **Cắt biên** sau xác nhận. Box vượt biên lớn chỉ được sửa thủ công; không auto-clamp mất thông tin.


### Ghi chú v5.0 — nhận diện assignment manifest

- `assignment_manifest.csv` (kể cả bản trình duyệt đổi tên `assignment_manifest(1).csv`) phải có `image_id`, `assigned_reviewer_id`, dữ liệu phân công không rỗng và không trùng ID.
- CSV thành viên như `G11_SV09.csv` là tệp riêng, **không** được tự thay thế `assignment_manifest.csv` chỉ vì có cột `image_id` hoặc `filename`.
- Khi nạp cả thư mục hoặc ZIP `G11`, chương trình đọc manifest bên trong trước rồi cho chọn nhãn B / A / nhãn thành viên; tên tệp manifest thật hiện dưới nút Xóa manifest.
- Nạp nhầm CSV không xóa manifest hợp lệ đã có. Kiểm tra phần thống kê tiến độ mục 06 đối chiếu theo tổng số ảnh được phân công.
