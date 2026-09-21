# Tài liệu Yêu cầu Nghiệp vụ MCNA LMS (BRD v3.0)

**Học viện Công nghệ MCNA**  
**Phiên bản:** 3.0 · **Ngày phát hành:** 21/09/2026 · **Trạng thái:** Hiện hành chính thức  
**Tài liệu tham chiếu:** [`docs/bao-cao-phan-tich-repo.md`](./bao-cao-phan-tich-repo.md), [`docs/crm-integration.md`](./crm-integration.md), [`docs/SIS-TABLES-RETENTION.md`](./SIS-TABLES-RETENTION.md)

---

## 1. Tổng quan & Tầm nhìn Sản phẩm

MCNA LMS là nền tảng quản trị và đào tạo trực tuyến chính thức của Học viện Công nghệ MCNA (mcna.vn). Hệ thống được tối ưu hóa cho mô hình đào tạo thực chiến kết hợp trực tuyến qua Zoom, kiểm tra đánh giá tự động và cấp chứng chỉ số độc bản.

### Vòng đời nghiệp vụ cốt lõi:
```
Danh mục khóa học công khai → Đăng ký tài khoản / Ghi danh → Thanh toán tự động (VietQR / SePay)
  → Duyệt & Xếp lớp học phần → Học trực tuyến qua Zoom → Tài liệu buổi học đa định dạng
  → Quiz trắc nghiệm tự động → Nộp bài tập đa tệp → Giảng viên chấm điểm (Trình xem trước tài liệu)
  → Đạt yêu cầu → Cấp Chứng chỉ số có trang xác thực công khai
  → Đồng bộ hai chiều sang CRM MCNA (Transactional Outbox + Ký HMAC)
```

---

## 2. Các Vai trò Người dùng (3 Vai trò Chuẩn hóa)

Hệ thống đã chuẩn hóa toàn bộ về **3 vai trò duy nhất** (ràng buộc toàn vẹn bởi database constraint `users_role_check`):

| Vai trò | Mã hệ thống | Trách nhiệm chính |
|---|---|---|
| **Quản trị viên** | `admin` | Quản lý người dùng, duyệt/xuất bản khóa học, quản lý lớp học phần (`course_sections`), xếp lớp cho học viên, phê duyệt thanh toán thủ công (nếu cần), xem báo cáo xuất Excel/CSV, cấu hình danh mục và theo dõi audit log. |
| **Giảng viên** | `teacher` | Xây dựng đề cương khóa học, bài học, tải tài liệu buổi học, cấu hình link phòng học Zoom, tạo bài tập thực hành, soạn ngân hàng câu hỏi/quiz trắc nghiệm, chấm bài nộp của học viên qua Trình xem trước đa tệp và gửi nhận xét. |
| **Học viên** | `student` | Khám phá khóa học công khai, đăng ký tài khoản, quét mã VietQR tự động kích hoạt học phí, vào không gian học tập lớp học phần, tham gia buổi học Zoom, tải tài liệu, làm bài trắc nghiệm, nộp bài tập đa tệp, theo dõi sổ điểm và nhận chứng chỉ số. |

---

## 3. Chi tiết Phân hệ Nghiệp vụ

### 3.1. Trang Công khai & Tuyển sinh
- **Danh mục khóa học (`#catalog`)**: Hiển thị danh sách khóa học thực chiến từ MCNA với giá học phí, cấp độ, số lượng buổi học và giảng viên phụ trách.
- **Lưu ý định ghi danh (`enrollIntent`)**: Khách vãng lai bấm "Đăng ký khóa học" sẽ được ghi nhớ lựa chọn qua `sessionStorage`. Sau khi đăng ký tài khoản hoặc đăng nhập thành công, hệ thống tự động gửi yêu cầu ghi danh mà không cần chọn lại.
- **Tự đăng ký & Quên mật khẩu (`#register`, `#forgot`, `#login`)**:
  - Gửi mật khẩu tạm qua email; bắt buộc đổi mật khẩu mới ở lần đầu đăng nhập (`must_change_password`).
  - Phản hồi trung tính khi email đã tồn tại để chống lộ dữ liệu học viên.
  - Hỗ trợ đầy đủ phím Back/Forward trình duyệt qua đồng bộ URL Hash.

### 3.2. Cổng Thanh toán VietQR & SePay Webhook
- **Thanh toán VietQR chuẩn MB Bank**:
  - Số tài khoản thụ hưởng: `099162438104` (MB Bank).
  - Chủ tài khoản: `HOC VIEN CONG NGHE MCNA`.
  - Cú pháp nội dung chuẩn hóa: `MCNA [MãHọcViên] [MãĐơnHàng]` (ví dụ: `MCNA E2F4A1 98A7B6`).
- **Modal Thanh toán Tức thì (`PaymentQrModal`)**:
  - Đồng hồ đếm ngược **15 phút** trực quan với thanh tiến trình.
  - Nút sao chép 1-chạm cho Số tài khoản, Số tiền và Nội dung chuyển khoản.
  - Polling trạng thái ngầm mỗi 3 giây: khi webhook SePay xác nhận giao dịch thành công, màn hình tự động hiển thị chúc mừng và kích hoạt lớp học cho học viên ngay lập tức.
  - Nút hỗ trợ nhanh kết nối trực tiếp với Zalo tư vấn học viện.

### 3.3. Lớp học phần, Thời khóa biểu & Zoom
- **Lớp học phần (`course_sections`)**: Mỗi khóa học có thể mở nhiều lớp (Lớp tối 2-4-6, Lớp tối 3-5-7, Lớp cuối tuần), quản lý sĩ số tối đa, ngày khai giảng và lịch học cố định.
- **Sinh lịch buổi học tự động**: Tự động tính toán các buổi học theo thời khóa biểu, xử lý chuẩn xác bước nhảy ngày vắt qua tháng và năm mới.
- **Phòng học Zoom**: Link Zoom hiển thị nổi bật ở đầu mỗi buổi học, thay thế hoàn toàn việc rải link thủ công qua mạng xã hội.

### 3.4. Tài liệu buổi học & Nộp bài Đa tệp
- **Tài liệu buổi học (`session_materials`)**: Hỗ trợ đính kèm bài giảng Slide, tài liệu Word/Excel, PDF, video YouTube và liên kết tài nguyên ngoài với logo nhận diện chính hãng.
- **Nộp bài tập đa tệp (`submissionFiles`)**: Học viên có thể kéo thả và đính kèm nhiều tệp trong một bài nộp (báo cáo PDF, mã nguồn Zip, bảng tính Excel, slide PowerPoint...).
- **Lưu trữ 3 tầng bảo vệ**:
  1. Supabase Storage (khi đã cấu hình khóa).
  2. Đĩa cục bộ máy chủ (`MATERIALS_DIR`).
  3. Cơ sở dữ liệu PostgreSQL `BYTEA` (tầng bền vững phòng hộ khi chạy serverless cold-start).

### 3.5. Chấm điểm & Trình xem trước Đa định dạng (`FilePreviewModal`)
- Giảng viên xem trực tiếp toàn bộ tài liệu nộp trong giao diện chấm điểm:
  - Thanh tab strip chuyển đổi qua lại giữa các tệp trong bài nộp nhiều tệp (`Tệp 1/N`).
  - Hỗ trợ phím tắt bàn phím (`←` / `→` để chuyển tệp, `Esc` để đóng).
  - Trình xem ảnh kèm công cụ Zoom in / Zoom out / Reset tỉ lệ.
  - Trình đọc mã nguồn / văn bản inline (`.py`, `.js`, `.ts`, `.html`, `.css`, `.json`, `.sql`, `.java`, `.txt`, `.md`...) hiển thị monospace kèm nút chép mã.
  - Trình nhúng PDF trực tiếp qua iframe.
  - Thẻ nhận diện định dạng Office (Word, Excel, PowerPoint) kèm nút tải nhanh về máy.

### 3.6. Chứng chỉ số Độc bản
- Học viên hoàn thành toàn bộ bài học và đạt điểm bài kiểm tra cuối khóa sẽ được cấp chứng chỉ tốt nghiệp tự động.
- Mỗi chứng chỉ mang một mã kiểm định độc bản dạng mã hex (ví dụ: `MCNA-CERT-XXXXXX`).
- Trang tra cứu và xác thực chứng chỉ công khai tại `/verify/certificate/:code`, hỗ trợ chia sẻ lên hồ sơ LinkedIn với 1-click.

### 3.7. Tinh giản Nghiệp vụ: Bỏ hoàn toàn Điểm danh (Attendance Decommissioned)
- Tính năng **Điểm danh chuyên cần** (học viên nhập mã check-in 6 ký tự, giáo viên cảnh báo vắng mặt, báo cáo tỷ lệ chuyên cần) đã chính thức được **gỡ bỏ hoàn toàn** khỏi hệ thống LMS để tinh gọn trải nghiệm học tập thực chiến.
- Bảng `attendance_sessions` tiếp tục đóng vai trò danh mục **Buổi học (Class Sessions)**: quản lý lịch học, tiêu đề chuyên đề, nội dung bài giảng, link Zoom, video recording xem lại và tài liệu đính kèm (`session_materials`).

---

## 4. Tích hợp CRM MCNA (Transactional Outbox)

Hệ thống tích hợp hai chiều với CRM Học viện MCNA nhằm quản lý dữ liệu tuyển sinh và học phí:
- **Chiều LMS → CRM (Transactional Outbox)**: Mọi sự kiện ghi danh, thanh toán được ghi vào bảng `crm_outbox` trong cùng transaction cơ sở dữ liệu với nghiệp vụ, bảo đảm không bao giờ thất thoát dữ liệu ngay cả khi mạng hoặc CRM gặp sự cố.
- **Bảo mật & Toàn vẹn dữ liệu**:
  - Chữ ký điện tử HMAC-SHA256: `hex(HMAC(secret, "<timestamp>.<rawBody>"))`.
  - Dung sai timestamp chống tấn công phát lại (replay attack): 300 giây.
  - Chống trùng lặp (Idempotency) qua `X-CRM-Event-Id` và bảng lưu vết sự kiện `crm_inbound_events`.

---

## 5. Quyết định Kiến trúc & Kỷ luật Kỹ thuật

1. **Bảo tồn 17 bảng SIS lịch sử (Quy tắc R1)**: Các bảng SIS đại học lịch sử (`semesters`, `programs`, `departments`, `tuition_fees`, `student_profiles`, `scholarships`...) được giữ nguyên vẹn cấu trúc cơ sở dữ liệu để phục vụ lưu trữ lịch sử, không xóa/drop.
2. **Kỷ luật Typecheck & Build (Quy tắc R2 & R3)**:
   - Script `npm run build` bắt buộc chạy qua `tsc --noEmit` trước khi đóng gói bundle.
   - Đồng bộ liên tục bundle serverless `api/index.js` cho Vercel.
3. **Lưới an toàn kiểm thử tự động (CI/CD)**:
   - Pipeline GitHub Actions tự động kiểm tra `npm run lint`, `npm test`, `npm run build`, và kiểm tra lệch bundle `git diff --exit-code api/index.js`.
   - Bộ kiểm thử Vitest bao phủ các hàm thuần chạm tiền, chữ ký HMAC CRM, phân tách mã giao dịch SePay, sinh lịch lớp học và phân giải tệp đính kèm.
