# Báo cáo tiến độ LMS – mô hình direct sale

Chuẩn bị cho buổi họp thứ Bảy với anh Sơn · Lập ngày 01/10/2026 · Người lập: Đăng

## 1. Tóm tắt

* **Các mục độc lập phía LMS của nhóm 🔴 và 🟡 đã có luồng vận hành**: direct sale, xếp lớp, tài liệu, nộp/chấm bài, giáo án, chứng chỉ, giờ dạy, tư vấn, ưu đãi và đơn upsell. Đã kiểm thử bằng dữ liệu giả trên database riêng; không đồng nghĩa đã vận hành với học viên thật.
* **Chưa làm:** đưa bản mới lên `lms.mcna.vn`, chạy thử với lớp thật, gửi recap cho anh Sơn. Ba việc này cần Đăng thực hiện (mục 3).
* **Chưa kiểm chứng được trên môi trường thử:** gửi email thật qua hộp thư `@mcna.vn`, và soạn thư chúc mừng bằng AI với khóa API thật (mục 5).

## 2. Trạng thái từng mục 🔴

| # | Mục trong checklist | Trạng thái | Ghi chú |
|---|---|---|---|
| 0.1 | Có dữ liệu "khách đã thanh toán – đăng ký khóa nào" (bảng test của Triều hoặc nhập tay) | Xong phần LMS | Màn **Nhập danh sách đã thanh toán**: dán bảng từ Excel/Sheets, tải tệp `.xlsx/.csv`, hoặc nhập tay từng người. Chưa nhận bảng test từ Triều. |
| 0.2 | Tự động tạo tài khoản học viên: đăng nhập Gmail, mật khẩu mặc định, tự đổi mật khẩu | Xong | Bắt đổi mật khẩu ở lần đăng nhập đầu. Nhập lại cùng bảng không tạo trùng. Có email gửi thông tin đăng nhập. |
| 0.3 | Tài khoản mới để trống, lớp chỉ hiện khi Quản lý lớp xếp xong | Xong | Chưa xếp lớp: không thấy lớp, tài liệu hay danh mục khóa học. |
| 0.4 | Chuyển sang direct sale: ẩn/tắt tự đăng ký, QR, admin duyệt | Xong | Là chế độ mặc định. Luồng cũ vẫn giữ, bật lại bằng một cấu hình. |
| 1.1 | Tách quyền Quản lý lớp với admin hệ thống | Xong | Vai trò **Quản Lý Lớp**: không thấy tài khoản hệ thống, nhật ký hệ thống, hàng đợi CRM; không xóa được khóa học. |
| 1.2 | Tạo khóa học một lần, lấy từ mcna.vn | Xong | Nút **Nạp khóa học từ mcna.vn**: 14 khóa kèm đề cương từng buổi (bản chụp mcna.vn ngày 14/09/2026). Học phí là giá tạm. |
| 1.3 | Tạo lớp có mã lớp, lịch học, ngày khai giảng, giờ học, link Zalo, giảng viên | Xong | Số buổi tự lấy theo khóa. Lớp online không bị báo trùng phòng. |
| 1.4 | Xếp lớp: chọn học viên từ danh sách rồi gán vào mã lớp | Xong | Chọn nhiều học viên một lần; kiểm tra sĩ số; chuyển lớp được. |
| 1.5 | Tự động gửi email xếp lớp (tên lớp, lịch học, link Zalo, giảng viên, số hỗ trợ) | Xong, **chờ kiểm tra gửi thật** | Có nút gửi lại và trạng thái email của từng học viên. Chưa gửi thử qua máy chủ thư thật. |
| 2.1 | Chặn tải slide và tài liệu, chỉ xem trực tuyến; chỉ tải file data | Xong | Slide/tài liệu cần bản **PDF** để xem trên LMS. Bài tập về nhà đang để chỉ xem, chờ anh Sơn quyết. |
| 2.2 | Tài liệu mở đầu: thư chúc mừng (AI viết), sách/tài liệu tham khảo, bài luyện tập | Xong, **AI chờ khóa API** | Thư tự điền tên học viên, lớp, giảng viên, lịch. Chưa có khóa API thì nút soạn thư trả về thư mẫu. |
| 2.3 | Mỗi buổi có tài liệu, data và bài tập về nhà | Xong | Học viên xem đề bài/hạn, nộp/nộp lại bài, xem nhận xét và lịch sử ngay tại từng buổi. |
| 5.1 | Gửi recap cuộc họp cho anh Sơn | **Có bản nháp, chưa gửi** | [recap-hop-anh-son.md](recap-hop-anh-son.md) |
| 5.2 | Chạy thử với một lớp thật (ví dụ AI Automation) | **Chưa chạy** | Đã có hướng dẫn từng bước và danh sách nghiệm thu: [direct-sale-van-hanh.md](direct-sale-van-hanh.md) |
| 5.3 | Chuẩn bị demo và báo cáo tiến độ | Xong | Tài liệu này, kịch bản demo ở mục 4. |

## 3. Việc còn lại trước thứ Bảy

1. Rà và gửi recap cho anh Sơn.
2. Đưa bản mới lên `lms.mcna.vn`: sao lưu database, cập nhật mã, đặt cấu hình (mật khẩu mặc định, số hỗ trợ, SMTP), khởi động lại.
3. Kiểm tra gửi email thật: nhập một dòng với email của chính mình, xếp vào lớp thử, xác nhận nhận được hai email.
4. Tạo tài khoản Quản lý lớp và giảng viên; nạp khóa học; tạo lớp thật.
5. Chuẩn bị nội dung buổi 1 của lớp chạy thử: slide bản PDF, file data, bài tập, thư chúc mừng.
6. Nhập danh sách học viên thật của lớp (hoặc bảng test của Triều) và xếp lớp.

## 4. Kịch bản demo (khoảng 12 phút)

Chuẩn bị: hai cửa sổ trình duyệt riêng (một cửa sổ thường cho Quản lý lớp, một cửa sổ ẩn danh cho học viên) vì mỗi trình duyệt chỉ giữ một phiên đăng nhập; một bảng 3 học viên trong Excel/Google Sheets; một slide PDF và một file data.

| Phút | Vai | Thao tác | Điều cần thấy |
|---|---|---|---|
| 0–1 | Khách | Mở trang đăng nhập và trang khóa học công khai | Không còn nút đăng ký; khóa học chỉ có "Liên hệ tư vấn". |
| 1–2 | Admin | **Quản lý người dùng → Tạo người dùng** với vai trò Quản Lý Lớp | Admin là người duy nhất tạo được tài khoản vận hành. |
| 2–4 | Quản lý lớp | Đăng nhập → **Khóa học & Lớp học** → **Nạp khóa học từ mcna.vn** → **Thêm Lớp học phần** "AI Automation 01" | Menu gọn (không có người dùng, nhật ký). Lớp có mã, lịch, khai giảng, Zoom, Zalo, giảng viên; số buổi tự điền. |
| 4–6 | Quản lý lớp | **Học viên & Xếp lớp → Nhập danh sách đã thanh toán**: dán bảng → **Kiểm tra** → **Nhập** | Bước kiểm tra chưa ghi dữ liệu. 3 tài khoản mới, 3 học viên chờ xếp lớp. Nhập lại lần nữa: bị bỏ qua, không trùng. |
| 6–7 | Học viên | Đăng nhập bằng email + mật khẩu mặc định | Bị yêu cầu đổi mật khẩu; sau đó màn "Lớp học của tôi" trống. |
| 7–9 | Quản lý lớp | Chọn 3 học viên → chọn lớp → **Xếp lớp & gửi email** | Thông báo số email đã gửi; mở email xếp lớp: tên lớp, lịch, Zalo, giảng viên, số hỗ trợ. |
| 9–10 | Quản lý lớp / giảng viên | **Nội dung lớp học**: thư chúc mừng (**Soạn bằng AI**), tải slide PDF, file data, **Giao bài tập** | Tài liệu mở đầu dùng chung cho mọi lớp của khóa; nội dung theo từng buổi. |
| 10–12 | Học viên | Tải lại trang → vào lớp → **Tài liệu mở đầu** → buổi 1 | Thư mang tên học viên. Slide mở trong trình xem, không có nút tải. File data tải được. Có bài tập và hạn nộp. Mở thêm trên điện thoại. |

Lưu ý môi trường demo: các bước nhập danh sách và xếp lớp cần database thật, nên demo trên `lms.mcna.vn` sau khi cập nhật (dùng một lớp thử), hoặc trên máy có PostgreSQL.

## 5. Đã kiểm chứng gì, chưa kiểm chứng gì

**Đã kiểm chứng trên môi trường thử nghiệm (máy cá nhân, PostgreSQL riêng):**
* Kịch bản tự động chạy toàn bộ luồng direct sale trên bản build production, 56 bước kiểm tra đều đạt: chặn tự đăng ký, quyền Quản lý lớp, nạp khóa học, tạo lớp, nhập bảng (xem trước, nhập thật, nhập lại), tài khoản trống, xếp lớp và email, quy tắc tải/xem tài liệu, tài liệu mở đầu, quyền giảng viên theo lớp.
* Kịch bản của luồng tự đăng ký cũ vẫn đạt khi bật lại chế độ cũ.
* Bản mở rộng: **153 kiểm thử đơn vị/19 tệp đạt**, kiểm tra kiểu và build đạt. Luồng vận hành **171 kiểm tra** đạt ở bản phát triển và build production local, cùng luồng direct sale 56 bước.
* Migration mới **040** đã kiểm tra trên database mới (000–040), nâng cấp từ 039 và chạy lại không áp dụng trùng. Kiểm tra cấu trúc database không có mục thiếu.
* Đã rà logic hai lượt: quyền theo lớp/tệp/học viên; giao dịch, gửi lại và gửi đồng thời; lịch sử bài nộp, chấm phiên bản cũ, voucher cuối, xác nhận thanh toán lặp, giờ thực dạy khi đổi giảng viên, tháng cần xác nhận lại và chứng chỉ sau buổi cuối kết thúc.
* Job chứng chỉ kiểm tra luân phiên theo từng nhóm 25 lớp, không để các lớp thiếu điều kiện ở đầu danh sách khiến lớp phía sau bị bỏ sót; lỗi giữa lượt không đẩy con trỏ đi tiếp.
* Rà soát tiếp ngày 01/10/2026: chạy lại luồng direct sale trên database thử riêng ở cả chế độ phát triển và bản build production, đều đạt. Đã sửa lỗi `/api/store` trả chi tiết lỗi máy chủ; kiểm tra production, staging và Vercel đều chỉ nhận thông báo chung, còn lỗi đầy đủ được giữ trong log máy chủ.
* Xem trực tiếp trên trình duyệt: màn Quản lý lớp, nhập danh sách, xếp lớp, nội dung lớp, màn học viên, trình xem PDF (máy tính và cỡ màn hình điện thoại), màn giảng viên, hai mẫu email.

**Chưa kiểm chứng:**
* Gửi email thật qua máy chủ thư `@mcna.vn` (ở môi trường thử, email chỉ được ghi ra log).
* Soạn thư chúc mừng bằng AI với khóa API thật.
* Chạy trên `lms.mcna.vn` và tải slide dung lượng lớn qua máy chủ thật.
* Bảng thật từ CRM của Triều (mới thử với bảng mẫu).
* Trên điện thoại thật (mới thử ở cỡ màn hình điện thoại trên máy tính).

## 6. Cần anh Sơn chốt

1. **Bài tập về nhà** có cho học viên tải về không, hay chỉ xem trực tuyến như slide?
2. **Slide chỉ xem trực tuyến cần bản PDF.** Giảng viên tải PowerPoint/Word thì học viên chưa xem được. Chấp nhận quy ước "slide đưa lên dạng PDF" không?
3. **Mật khẩu mặc định** dùng chung cho cả đợt nhập (học viên bị bắt đổi ở lần đăng nhập đầu). Dùng mật khẩu nào, và có gửi qua email cho học viên không hay tư vấn báo riêng?
4. **Lớp chạy thử:** lớp nào, ngày khai giảng, ai là Quản lý lớp và giảng viên.
5. **Số hỗ trợ** in trong email: `0939.866.825` hay số khác.

## 7. Giới hạn hiện tại

* Chặn tải là chặn ở mức phần mềm; học viên vẫn chụp màn hình được.
* Tệp đề bài/lời giải chặn truy cập trực tiếp ở máy chủ và đúng lớp, không còn chỉ ẩn nút ở giao diện. Người có quyền xem vẫn có thể lấy byte bằng công cụ kỹ thuật; không phải DRM.
* Khi cập nhật, quy tắc mới áp dụng cho cả lớp đang chạy: slide/tài liệu không phải PDF sẽ tạm không xem được với học viên cho tới khi có bản PDF.
* Quản lý lớp có màn tạo giảng viên/chọn môn; vẫn không quản trị admin/manager. Học viên quên mật khẩu dùng "Quên mật khẩu?" hoặc nhờ admin.
* CRM direct sale dùng mật khẩu mặc định nếu cấu hình, nếu không dùng mật khẩu ngẫu nhiên. CRM/SePay/upsell xác nhận tiền không tự xếp lớp.
* Chứng chỉ tải xuống là SVG mẫu trung tính có mã xác minh, chưa phải bộ mẫu Triều/PDF ký số. Giáo án mẫu cần MCNA đưa nội dung thật vào; hệ thống có cơ chế lưu/sao chép, không tự giả lập giáo án đã phê duyệt.
* Chính sách bậc giảng viên, ngân hàng công ty và ngày bắt đầu hoa hồng để trống cho admin nhập; không tự đoán các dữ liệu kinh doanh này.

## 8. Sau khi chạy thử (nhóm 🟡) và việc phụ thuộc (nhóm ⚪)

* 🟡 Đã gắn giao diện: nộp/nộp lại bài theo buổi, lịch sử, chấm điểm/nhận xét, lời giải ẩn/công bố, điểm danh, tự xét chứng chỉ và cấp ngoại lệ có lý do.
* 🟡 Đã làm: tạo giảng viên theo môn, thông báo/email phân lớp, giáo án mẫu/bản riêng theo lớp, giờ thực dạy/xác nhận tháng và bậc cấu hình không hiển thị tiền.
* 🟡 Đã làm: yêu cầu tư vấn lưu bền, voucher/thông báo có người nhận, gợi ý khóa tiếp theo, giá ưu đãi, đơn nguồn self/sale và chụp chính sách 10%/5% trong 12 tháng; xác nhận thủ công rồi chờ xếp lớp. QR chỉ có khi admin cấu hình ngân hàng công ty.
* 🟡 Đổi nguồn dữ liệu sang CRM thật: LMS đã có sẵn API cho CRM gọi (tạo học viên, ghi danh, xác nhận thanh toán); chờ CRM.
* ⚪ Triều: bảng test, sửa CRM, bộ mẫu chứng chỉ. Anh Khang và Triều: cổng xác nhận chuyển khoản tự động.

## 9. Trạng thái bàn giao mã

Bản mở rộng được bàn giao trên nhánh `feature/direct-sale-quan-ly-lop` của repo `cskhmcna247/lms_mcna`, giữ nguyên phần Claude đã viết, bổ sung migration 040 và kịch bản kiểm thử vận hành. Commit cụ thể được ghi trong lịch sử Git. **Chưa merge vào nhánh chính, chưa triển khai production hoặc áp dụng migration vào database thật.** Database/nhà cung cấp thật không được dùng cho các kiểm thử mới. Xem [direct-sale-van-hanh.md](direct-sale-van-hanh.md), mục 11–12, để cấu hình và thao tác các màn mới.

Chưa gửi recap, chưa liên hệ anh Sơn/Triều/Khang thay Đăng. Chưa xác nhận email tới hộp thư thật, CRM nhận webhook thật, chuyển khoản thật hay pilot lớp thật. Các mục này cần quyết định/dữ liệu/cấu hình và người vận hành thực tế.
