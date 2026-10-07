# Vận hành LMS theo mô hình direct sale & chạy thử một lớp thật

Tài liệu này dành cho admin hệ thống và Quản lý lớp. Nó mô tả luồng làm việc mới (khách thanh toán với tư vấn → MCNA tạo tài khoản → Quản lý lớp xếp lớp) và các bước chạy thử với một lớp thật, ví dụ **AI Automation**, không cần chờ CRM.

## 1. Luồng tổng quát

```
Bảng "khách đã thanh toán – đăng ký khóa nào" (dán từ Excel/Sheets, tệp .xlsx/.csv, hoặc nhập tay)
        │  Học viên & Xếp lớp → Nhập danh sách đã thanh toán
        ▼
Tài khoản học viên (email cá nhân + mật khẩu mặc định, bắt đổi ở lần đăng nhập đầu)
+ ghi danh "đã thanh toán – chờ xếp lớp"            ← tài khoản còn trống, chưa thấy lớp nào
        │  Quản lý lớp chọn học viên → chọn mã lớp → Xếp lớp & gửi email
        ▼
Học viên thấy lớp trong "Lớp học của tôi" + nhận email xếp lớp
(tên lớp, lịch học, ngày khai giảng, link nhóm Zalo, giảng viên, số điện thoại hỗ trợ)
        ▼
Tài liệu mở đầu (thư chúc mừng, sách/tài liệu tham khảo, bài luyện tập)
Mỗi buổi: slide/tài liệu (chỉ xem trực tuyến) · file data (tải về) · bài tập về nhà
```

## 2. Ai làm được gì

### Nguồn CRM thay cho dán bảng

Khi admin đã cấu hình `CRM_DATABASE_URL`, màn nhập danh sách có nút **Lấy từ CRM**. Bấm nút chỉ đọc dữ liệu doanh thu, chưa tạo tài khoản hoặc ghi danh. Quản lý lớp vẫn bấm **Kiểm tra**, xem các dòng lỗi/không khớp khóa, rồi xác nhận **Nhập**. Xếp lớp là bước riêng sau đó.

Chỉ nhận trạng thái hoàn tất thanh toán được hỗ trợ và số nợ bằng 0; bản ghi thiếu số nợ, email hợp lệ hoặc họ tên bị bỏ qua. Mã `AI4WORK`, `AIAGENT`, `AIAUTOMATION` được đối chiếu với danh mục MCNA; khóa đào tạo doanh nghiệp chưa có trong LMS không được tự đoán hoặc tự tạo.

Mỗi trang đọc tối đa 500 bản ghi doanh thu; nếu còn dữ liệu, dùng **Trang CRM cũ hơn (thay danh sách)** sau khi xử lý trang hiện tại. Một người mua nhiều khóa tạo nhiều dòng: danh sách vượt 500 dòng chia thành các lô, mỗi lô cần kiểm tra và xác nhận riêng. Thêm học viên thủ công không làm mất các dòng đã đọc.

Lưu ý: CRM chỉ lưu tổng tiền của đơn nhiều khóa, nên LMS không tự chia tiền. Các dòng chưa có số tiền riêng sử dụng giá danh mục trong khoản ghi nhận LMS và hiện cảnh báo; không dùng tổng đó làm báo cáo doanh thu thực thu. Mã doanh thu được giữ trong ghi chú giao dịch, không coi là mã deal. Chi tiết cấu hình: [crm-integration.md](crm-integration.md#nguồn-danh-sách-đã-thanh-toán-chỉ-đọc-từ-database-crm).

| Việc | Admin hệ thống | Quản lý lớp | Giảng viên | Học viên |
|---|---|---|---|---|
| Tạo tài khoản admin / Quản lý lớp, đổi vai trò | ✔ | – | – | – |
| Tạo giảng viên, chọn môn có thể dạy | ✔ | ✔ | – | – |
| Nhật ký hệ thống, hàng đợi CRM, xóa khóa học | ✔ | – | – | – |
| Nạp khóa học từ mcna.vn, tạo/sửa khóa học và lớp | ✔ | ✔ | – | – |
| Nhập danh sách đã thanh toán, xếp lớp, gửi lại email xếp lớp | ✔ | ✔ | – | – |
| Tài liệu mở đầu, slide, file data, bài tập về nhà | ✔ | ✔ | ✔ (khóa mình phụ trách và lớp được phân công) | – |
| Tải file gốc của slide/tài liệu | ✔ | ✔ | ✔ | – |
| Xem slide/tài liệu PDF trực tuyến, tải file data | – | – | – | ✔ (chỉ lớp đã được xếp) |

Quản lý lớp đăng nhập sẽ vào thẳng màn **Học viên & Xếp lớp**. Có thêm **Vận hành lớp học** cho điểm danh, chấm bài, giáo án, chứng chỉ và xác nhận tháng. **Tư vấn & Ưu đãi** chỉ thao tác được khi admin cấp quyền riêng; không tự động cấp quyền thu tiền cho mọi Quản lý lớp.

## 3. Cấu hình máy chủ (admin làm một lần)

Thêm vào `.env` trên máy chủ rồi **khởi động lại ứng dụng** (biến môi trường chỉ được đọc lúc khởi động):

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `SALES_MODE` | `direct` | Mặc định đã là `direct`. Đặt `self_service` để mở lại luồng tự đăng ký cũ. |
| `DEFAULT_STUDENT_PASSWORD` | tùy chọn, tối thiểu 8 ký tự | Điền sẵn mật khẩu chung khi nhập danh sách. Nên để trống để LMS tạo mật khẩu tạm thời riêng cho mỗi học viên mới và gửi qua email. |
| `SUPPORT_PHONE` | `0939.866.825` | In trong email tài khoản, email xếp lớp và trang đăng nhập. |
| `ALLOW_HOMEWORK_DOWNLOAD` | `false` | `true` thì học viên tải được tệp đính kèm bài tập về nhà. Đang chờ anh Sơn quyết. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | khóa API Gemini | Dùng cho nút "Soạn bằng AI" của thư chúc mừng. Bỏ trống thì nút này trả về thư mẫu của MCNA. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `mail.mcna.vn`, `465`, `noreply@mcna.vn`, … | Hộp thư `@mcna.vn` nằm trên OneMail. **Thiếu SMTP thì email không được gửi**, chỉ ghi vào `scratch/emails.log`. |
| `APP_URL` / `LMS_LOGIN_URL` | `https://lms.mcna.vn` | Link "Vào lớp học" trong email. |

Để tải slide, tài liệu mở đầu và file data lớn trên Vercel, cấu hình `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong môi trường Production, rồi Redeploy. Bucket `SUPABASE_STORAGE_BUCKET` (mặc định `lms-materials`) phải là **private**. LMS cấp URL tải lên có chữ ký sau khi kiểm tra quyền; trình duyệt gửi tệp thẳng tới Supabase và LMS chỉ lưu thông tin tệp sau khi xác nhận dung lượng. Không đưa service role key vào trình duyệt. Khi chưa cấu hình Supabase, file nhỏ vẫn đi qua API; trên Vercel file lớn hơn 4 MB sẽ được báo cần cấu hình Storage. PDF lớn được trình xem của LMS đọc theo các phần 2 MB sau khi kiểm tra quyền.

Lưu ý khi cập nhật bản mới:

1. **Sao lưu database trước** (xem [backup-restore-policy.md](backup-restore-policy.md)).
2. `npm ci` → `npm run db:migrate` → `npm run db:drift` → `npm run build` → khởi động lại ứng dụng. Bản này dùng migration **039 và 040**. Database cũng tự nâng cấp khi ứng dụng khởi động; không sửa số phiên bản migration đã áp dụng.
3. Migration này đổi quy tắc tài liệu cho **cả các lớp đang chạy**: file Excel/CSV/ZIP trước đây lưu kiểu "tài liệu" được chuyển thành "file data" (học viên vẫn tải được); slide và tài liệu còn lại chuyển sang chỉ xem trực tuyến. Slide/tài liệu **không phải PDF** (PowerPoint, Word) học viên sẽ không xem được cho tới khi có bản PDF.
4. Không đặt `TEST_RECEIVER_EMAIL` trên production: biến này chuyển mọi email về một hộp thư thử.
5. Kiểm tra email thật: tự nhập một dòng với email của chính bạn, xếp vào một lớp thử, rồi xem cột lớp ở màn **Học viên & Xếp lớp**:
   * **Email đã gửi**: máy chủ thư đã nhận email.
   * **Email chưa gửi (chưa có SMTP)**: máy chủ chưa cấu hình SMTP.
   * **Email gửi lỗi**: máy chủ thư từ chối; xem log ứng dụng (`SMTP dispatch failed`).
6. Nếu tải slide lớn trên Vercel bị lỗi, kiểm tra hai biến Supabase Production và bucket private. Với VPS/nginx, kiểm tra thêm `client_max_body_size`.

## 4. Chạy thử một lớp thật (ví dụ AI Automation)

### Bước 0 — Admin chuẩn bị tài khoản
* **Quản lý người dùng → Tạo người dùng**: tạo tài khoản cho Quản lý lớp (vai trò **Quản Lý Lớp**) và cho giảng viên của lớp (vai trò **Giảng Viên**), dùng email thật của họ.

### Bước 1 — Nạp khóa học từ mcna.vn (chỉ làm một lần)
* **Khóa học & Lớp học → Nạp khóa học từ mcna.vn**. Hệ thống tạo 14 khóa của MCNA kèm đề cương từng buổi (lấy từ bản chụp danh mục mcna.vn ngày 14/09/2026 đi kèm LMS). Bấm lại sẽ cập nhật tên, mô tả, đề cương; học phí đã sửa, lớp và học viên được giữ nguyên.
* Học phí trong danh mục là giá tạm (mcna.vn không công bố học phí). Sửa lại trong từng khóa nếu cần hiển thị.

### Bước 2 — Tạo lớp
* **Khóa học & Lớp học → Thêm Lớp học phần**, điền:
  * **Môn học tương ứng**: AI Automation. **Số buổi học** tự lấy theo khóa (5 buổi).
  * **Mã Lớp học**: ví dụ `AI Automation 01` (giữ nguyên chữ hoa/thường như bạn gõ; đây là tên lớp in trong email).
  * **Giảng viên phụ trách**, **Sĩ số tối đa**, **Ngày khai giảng**.
  * **Thời khóa biểu ca học**: thứ, giờ bắt đầu, giờ kết thúc, phòng. Lớp online để phòng là `Online (Zoom)`; các lớp online không bị báo trùng phòng.
  * **Link phòng học online** (Zoom/Google Meet) và **Link nhóm Zalo của lớp** (được gửi trong email xếp lớp).
* Lưu xong, hệ thống tự sinh các buổi học theo ngày khai giảng và lịch.

### Bước 3 — Đưa nội dung lên (Quản lý lớp hoặc giảng viên)
* **Nội dung lớp học** → chọn khóa → **Quản lý khóa học**.
* **Tài liệu mở đầu** (dùng chung cho mọi lớp của khóa):
  * **Thư chúc mừng**: bấm **Soạn bằng AI** rồi sửa lại, hoặc tự viết, xong bấm **Lưu thư**. Dùng được các chỗ trống: `{{ten_hoc_vien}}`, `{{ten_khoa_hoc}}`, `{{ma_lop}}`, `{{giang_vien}}`, `{{ngay_khai_giang}}`, `{{lich_hoc}}`, `{{so_ho_tro}}`. Mỗi học viên sẽ thấy thư với tên và lớp của mình.
  * **Sách & tài liệu tham khảo**, **Bài luyện tập**: tải file hoặc thêm liên kết.
* **Từng buổi học** (chọn lớp, rồi chọn buổi):
  * **Slide / tài liệu**: tải bản **PDF**. Tải PowerPoint/Word vẫn lưu được nhưng hệ thống cảnh báo: học viên không xem được cho tới khi có bản PDF.
  * **File data**: Excel, CSV, ZIP, PBIX, JSON, SQL, notebook… Học viên tải được.
  * **Bài tập về nhà**: bấm **Giao bài tập**, nhập đề bài, hạn nộp, thang điểm, đính kèm (nếu có), rồi **Lưu bài tập**.
  * Video xem lại: thêm liên kết YouTube.

### Bước 4 — Nhập danh sách khách đã thanh toán
* **Học viên & Xếp lớp → Nhập danh sách đã thanh toán**. Có ba cách, dùng chung một màn:
  * Dán bảng copy từ Excel/Google Sheets (bấm **Dán bảng mẫu** để xem định dạng).
  * **Chọn tệp .xlsx / .csv**.
  * **Hoặc thêm từng học viên** (nhập tay khi chưa có bảng từ CRM).
* Bấm **Kiểm tra … dòng**: hệ thống chỉ kiểm tra, chưa ghi gì. Xem cột Trạng thái/Ghi chú của từng dòng.
* Kiểm tra ô **Mật khẩu mặc định cho tài khoản mới** và ô **Gửi email thông tin đăng nhập**, rồi bấm **Nhập … học viên**.

Định dạng bảng:

| Cột | Bắt buộc | Ghi chú |
|---|---|---|
| Họ tên | ✔ | |
| Email | ✔ | Email cá nhân (Gmail) học viên dùng để đăng nhập. |
| Khóa học | ✔ | Tên khóa (ví dụ `AI Automation`, `AI for Work`) hoặc mã khóa (`AI_AUTO`, `AI_WORK`). Tên chỉ khớp một phần mà trùng nhiều khóa (ví dụ `Power BI`) sẽ bị báo lỗi để bạn ghi rõ hơn. |
| SĐT | – | |
| Số tiền | – | Số tiền đã thu, ví dụ `3.500.000`. Bỏ trống thì lấy học phí của khóa. |
| Mã lớp | – | Lớp khách muốn học; được chọn sẵn khi xếp lớp. |
| Ghi chú | – | |

Dòng tiêu đề nhận cả tiếng Việt lẫn tiếng Anh, thứ tự cột tùy ý. Bảng không có dòng tiêu đề thì đọc theo thứ tự: Họ tên, Email, SĐT, Khóa học, Số tiền, Mã lớp, Ghi chú.

Quy tắc khi nhập:
* Email chưa có tài khoản → tạo tài khoản mới với mật khẩu mặc định, bắt đổi mật khẩu ở lần đăng nhập đầu.
* Email đã có tài khoản học viên → dùng lại tài khoản đó, **không đổi mật khẩu**.
* Một người đăng ký nhiều khóa → mỗi khóa một dòng; chỉ nhận một email tài khoản liệt kê các khóa.
* Nhập lại cùng bảng không tạo trùng: dòng đã có ghi danh được đánh dấu "Bỏ qua".
* Email thuộc tài khoản giảng viên/admin bị báo lỗi và không được nhập.

### Bước 5 — Xếp lớp và gửi email
* Ở tab **Chờ xếp lớp**, tích chọn các học viên cùng một khóa → chọn lớp ở ô **Chọn lớp** → **Xếp lớp & gửi email**.
* Hệ thống kiểm tra sĩ số (lớp đầy sẽ báo lỗi, không xếp nửa chừng), xếp học viên vào lớp và gửi email xếp lớp cho từng người. Giảng viên của lớp nhận thông báo có học viên mới.
* Ở tab **Đã xếp lớp**: **Gửi lại email** khi học viên báo chưa nhận được, **Chuyển lớp** khi cần đổi lớp (học viên nhận email của lớp mới).

### Bước 6 — Học viên vào học
* Học viên đăng nhập `https://lms.mcna.vn` bằng email và mật khẩu mặc định → hệ thống yêu cầu đặt mật khẩu mới.
* Chưa được xếp lớp: màn **Lớp học của tôi** trống, kèm số hỗ trợ.
* Đã xếp lớp: thấy lớp, link Zoom, link nhóm Zalo, **Tài liệu mở đầu** và nội dung từng buổi.
* Quên mật khẩu: bấm **Quên mật khẩu?** ở trang đăng nhập (gửi liên kết qua email), hoặc nhờ admin gửi liên kết đặt lại ở **Quản lý người dùng**.

## 5. Quy tắc tài liệu cho học viên

| Loại | Học viên được làm gì |
|---|---|
| Slide, tài liệu dạng **PDF** | Xem trong trình xem của LMS (có phóng to/thu nhỏ, chạy trên điện thoại). Không có nút tải, không in được từ trang, không mở được bằng đường dẫn trực tiếp. |
| Slide, tài liệu **PowerPoint/Word** | Chưa xem được; hiện ghi chú "chưa có bản PDF". Cần giảng viên tải bản PDF. |
| **File data** | Tải từng file hoặc tải tất cả file data của buổi dưới dạng `.ZIP`. |
| Video YouTube, liên kết | Mở liên kết. |
| Tệp đính kèm **bài tập về nhà** | Xem trực tuyến nếu là PDF hoặc ảnh; chỉ tải được khi máy chủ đặt `ALLOW_HOMEWORK_DOWNLOAD=true`. |

Giới hạn cần biết: tệp đề bài/lời giải được kiểm tra đăng nhập và quyền lớp ở máy chủ, không còn phục vụ bằng thư mục công khai. Khi chỉ xem, trình xem gửi yêu cầu riêng và hiển thị PDF/ảnh không có nút tải. Đây **không phải DRM**: người có quyền xem vẫn có thể chụp màn hình hoặc lấy byte bằng công cụ kỹ thuật. Không thể cam kết chống sao chép tuyệt đối trên trình duyệt.

## 6. Danh sách nghiệm thu cho buổi chạy thử

- [ ] Quản lý lớp đăng nhập, không thấy Quản lý người dùng và Nhật ký hệ thống.
- [ ] Khóa AI Automation có đủ 5 buổi; lớp có mã lớp, lịch, ngày khai giảng, link Zoom, link Zalo, giảng viên.
- [ ] Nhập 2–3 học viên thật: mỗi người nhận email tài khoản.
- [ ] Học viên chưa xếp lớp đăng nhập, đổi mật khẩu, thấy màn hình trống.
- [ ] Xếp lớp: học viên nhận email xếp lớp đủ tên lớp, lịch học, link Zalo, giảng viên, số hỗ trợ.
- [ ] Học viên thấy thư chúc mừng mang tên mình, sách/tài liệu tham khảo, bài luyện tập.
- [ ] Buổi 1 có slide PDF (xem được, không có nút tải), file data (tải được), bài tập về nhà.
- [ ] Mở thử trên điện thoại.
- [ ] Giảng viên của lớp đăng nhập, thấy lớp mình và tải được tài liệu lên.

## 7. Sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Nhập danh sách báo "không tìm thấy khóa học" | Tên khóa trong bảng không khớp. Ghi theo tên khóa trên LMS hoặc mã khóa (`AI_AUTO`…). Chưa nạp khóa học thì làm Bước 1. |
| Cột lớp hiện "Email chưa gửi (chưa có SMTP)" | Máy chủ chưa cấu hình SMTP (mục 3). Cấu hình xong bấm **Gửi lại email**. |
| Học viên không thấy lớp | Chưa được xếp lớp, hoặc đăng nhập bằng email khác với email trong bảng. |
| Học viên báo không xem được slide | Slide là PowerPoint/Word. Tải thêm bản PDF. |
| Tạo lớp báo trùng lịch giảng viên | Giảng viên đã có lớp khác cùng ca. Đổi ca hoặc đổi giảng viên. |
| Nút "Soạn bằng AI" trả về thư mẫu | Máy chủ chưa có `GEMINI_API_KEY`. Thư mẫu vẫn dùng được, sửa rồi lưu. |

## 8. Quay về luồng tự đăng ký

Đặt `SALES_MODE=self_service` và khởi động lại ứng dụng: trang công khai mở lại đăng ký, học viên tự ghi danh, quét QR và admin duyệt đơn ở **Đơn hàng & Ghi danh**. Dữ liệu lớp, học viên và tài liệu không đổi. Quy tắc "slide chỉ xem, file data mới tải được" vẫn áp dụng ở cả hai chế độ.

## 9. Khi CRM sẵn sàng

CRM có thể gọi thẳng API của LMS thay cho việc nhập bảng (hợp đồng: [crm-integration.md](crm-integration.md)): `POST /api/integrations/crm/students` tạo tài khoản, `POST /api/integrations/crm/enrollments` ghi danh, `POST /api/integrations/crm/payments/confirm` xác nhận thanh toán. Trong direct sale, xác nhận thanh toán **luôn chờ Quản lý lớp xếp**, kể cả CRM gửi `sectionId`; CRM và SePay không tự kích hoạt lớp. Tài khoản do CRM tạo dùng mật khẩu mặc định đã cấu hình; nếu chưa cấu hình thì dùng mật khẩu tạm ngẫu nhiên an toàn. Tài khoản mới đều buộc đổi mật khẩu. Đăng nhập bằng địa chỉ Gmail + mật khẩu LMS, không phải Google OAuth.

## 10. Kiểm thử tự động

```bash
npm test                    # kiểm thử đơn vị
E2E_BASE_URL=http://localhost:3101 npm run test:direct-sale   # chỉ server thử riêng, database thử trên 55433
```

Kiểm thử mở rộng: `npm run test:operations` (171 kiểm tra); `npx tsx scripts/verifyOperationsMigrations.ts` (database mới và nâng cấp 039 → 040). Hai kịch bản này **từ chối chạy ngoài database thử riêng** `lms_mcna_codex_test` trên `127.0.0.1:55433`. Không dùng database thật hoặc URL web chính thức làm đích kiểm thử.

## 11. Vận hành lớp, bài tập, giáo án và chứng chỉ

* **Vận hành lớp học → Giảng viên**: Quản lý lớp tạo tài khoản email cá nhân, đặt mật khẩu đầu hoặc dùng cấu hình, tick môn có thể dạy. Không tạo admin/manager tại đây. Tài khoản mới phải đổi mật khẩu.
* Tạo/sửa lớp gửi thông báo trong LMS và email phân lớp gồm lịch, khai giảng, Zalo, phòng học, số hỗ trợ. Sửa không đổi thông tin phân công thì không gửi lại. **Giáo án → Gửi lại email phân lớp** để thử lại; thiếu SMTP không được báo thành đã gửi thật.
* **Giáo án**: Quản lý lớp lưu nội dung một lớp thành bộ mẫu cùng môn. Áp dụng vào lớp trống có cùng số buổi, không ghi đè lớp đã có nội dung. Mỗi lớp có bản sao độc lập; tệp dùng chung được giữ cho đến khi không còn lớp/bộ mẫu tham chiếu. Lời giải sao chép luôn chưa công bố. Chọn **Giáo án riêng** rồi cập nhật nội dung từng buổi trong màn quản lý khóa/lớp.
* **Điểm danh & Chấm bài**: chọn lớp và buổi. Không mặc định học viên có mặt. Chọn từng trạng thái, nhập số phút thực dạy; chỉ xác nhận khi điểm danh đủ. Không xác nhận buổi tương lai. Buổi đã dạy giữ ngày/giảng viên cũ khi thay lịch/phân công cho lớp; không xóa/giảm buổi có lịch sử học tập.
* Học viên **Nộp bài trên LMS/Nộp lại bài** tại từng buổi. Hạn nộp do bài tập quyết định; giảng viên có thể bật cho nộp muộn. Nộp lại lưu phiên bản trước và xóa kết quả cũ để chấm lại. Không áp kết quả chấm của phiên bản cũ lên bài mới. Nhận xét nhanh và lịch sử bài nộp có trong màn chấm. Không có sổ điểm tổng hợp/đề thi đánh giá trong luồng chính.
* **Lời giải**: giảng viên upload PDF/PPT/Word hoặc ảnh, nhập nội dung và chọn công bố. Học viên chỉ thấy khi đã công bố và đúng lớp. Office cần bản PDF để xem trực tuyến; không tự chuyển đổi Office sang PDF.
* **Chứng chỉ**: đủ số buổi đã thực dạy và kết thúc, đủ điểm danh, nghỉ không quá 2 buổi, đã nộp bài đánh dấu **cuối khóa**. Mặc định chỉ `Vắng` tính là nghỉ; admin cấu hình `Muộn/Có phép` nếu MCNA muốn. Không yêu cầu quiz hoặc điểm sổ tổng hợp. Quản lý lớp có thể cấp ngoại lệ với lý do ít nhất 10 ký tự, lưu nhật ký.
* Tự xét sau khi điểm danh/nộp cuối khóa; máy chủ thường xét lại mỗi phút. Trên Vercel, job `/api/internal/jobs/crm-outbox` đồng thời xét lại các lớp đã kết thúc (cần `CRON_SECRET` và lịch gọi job hoạt động). Có nút xét lại theo lớp. Nếu thay đổi điểm danh sau khi cấp, **không tự thu hồi** chứng chỉ; Quản lý lớp rà lại và dùng API thu hồi hiện có khi cần.
* Học viên **Chứng chỉ & Tư vấn**: xem mã xác minh và tải chứng chỉ điện tử **SVG mẫu trung tính**, chưa phải mẫu chính thức của Triều và không phải PDF ký số.
* **Buổi dạy & Bậc giảng viên**: giờ lấy từ buổi đã xác nhận, không lấy từ lịch dự kiến. Giảng viên xác nhận tháng đã kết thúc; Quản lý lớp duyệt/yêu cầu sửa. Thay thời lượng sẽ chuyển tháng về cần xác nhận lại, kể cả đã duyệt. Bậc và mốc số lớp do admin cấu hình, không tự giả định bảng lương. Giảng viên không thấy tiền.

## 12. Tư vấn, ưu đãi và thanh toán thủ công

1. Admin **Vận hành lớp học → Cấu hình vận hành**: cấu hình bậc giảng viên, ngày bắt đầu chính sách hoa hồng, ngân hàng công ty và cấp quyền sales cho tài khoản Quản lý lớp được chỉ định. Mặc định ngày chính sách/ngân hàng/bậc đều trống; chưa cấu hình thì không tạo QR hay tự tính bậc.
2. **Tư vấn & Ưu đãi**: chọn khóa tiếp theo cho từng khóa nguồn, đặt giá khóa thật (giá danh mục nhập sẵn là tạm). Học viên đã hoàn thành khóa nguồn mới được tự tạo đơn từ gợi ý. Tạo voucher số tiền cố định, hạn, số lượt, khóa/học viên tùy chọn; gửi thông báo tới danh sách người nhận chọn rõ.
3. Học viên xem giá gạch/giá sau voucher, tạo đơn; voucher được giữ lượt cho đơn chờ/đã xác nhận, hủy đơn chờ trả lại lượt. Không giảm quá giá khóa. Đơn do học viên tạo ghi `self`, do người có quyền tư vấn tạo ghi `sale`; người dùng không tự gửi tỷ lệ hoa hồng.
4. Chính sách chụp tại lúc tạo đơn: 10% `self`, 5% `sale`, trong 12 tháng từ ngày admin cấu hình. Ngoài thời hạn hoặc chưa đặt ngày: tỷ lệ để trống, cần đánh giá lại; không tự gia hạn. Chỉ ghi nhận dữ liệu hoa hồng, **không thực hiện trả tiền hoa hồng**.
5. QR chỉ xuất hiện khi có ngân hàng/tài khoản công ty được cấu hình. Chưa có thông tin thì yêu cầu liên hệ MCNA, không dùng số tài khoản giả. Học viên gửi mã đơn cho sale/nhóm lớp; người được cấp quyền đối soát thật rồi xác nhận đúng số tiền và mã chuyển khoản. Gửi lại cùng xác nhận không tạo giao dịch thứ hai; thay số tiền/mã đối soát bị chặn.
6. Xác nhận đơn chỉ tạo ghi danh **đã thanh toán – chờ xếp lớp**. Quản lý lớp xếp sau. Nút **Cần tư vấn** lưu yêu cầu cho bộ phận tư vấn và hàng đợi CRM, không chỉ mở một liên kết ngoài.
7. Các sự kiện `consultation.requested`, `upsell.requested`, `upsell.payment_confirmed` đã vào outbox có thử lại. Đây là khả năng phía LMS; chưa chứng minh CRM thật đã tiếp nhận.
