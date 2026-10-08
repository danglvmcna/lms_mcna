# Tài liệu bàn giao công việc: MCNA LMS (Dành cho Codex / Kỹ sư kế thừa)

**Ngày lập:** 07/10/2026  
**Nhánh Git:** `main` (commit đối chiếu: `2fe232a`)  
**Mục tiêu hệ thống:** Nền tảng LMS đào tạo công nghệ MCNA, vận hành mô hình Bán trực tiếp (Direct-Sale) tích hợp tự động với CRM và cổng thanh toán.

---

## 1. Tổng quan Kiến trúc & Hạ tầng Production

### 1.1. Máy chủ Production (VPS)
* **IP Server:** (lưu trong kho mật khẩu của MCNA, không ghi vào repo)
* **SSH Port:** (lưu trong kho mật khẩu của MCNA, không ghi vào repo)
* **User SSH:** tài khoản riêng của người được giao, đăng nhập bằng SSH key (không dùng mật khẩu root)
* **Đường dẫn ứng dụng:** `/var/www/lms`
* **Web Server:** Nginx reverse proxy (cổng 80/443, SSL Let's Encrypt) trỏ về `http://127.0.0.1:3002`.
* **Process Manager:** PM2 (ID tiến trình: `3`, tên: `lms`, lệnh chạy: `node dist/server.cjs`).
* **Domain chính thức:** [https://lms.mcna.vn](https://lms.mcna.vn)
* **API Health Check:** `https://lms.mcna.vn/api/health` ➡️ HTTP 200 `{"ok":true,"database":"ok"}`.

### 1.2. Cơ sở dữ liệu
* **PostgreSQL cục bộ trên VPS:** `localhost:5432`, Database: `lms_simple`, User: `lms_simple`.
* **Migrations:** Đã áp dụng đầy đủ đến `040_direct_sale_operations.sql` (`039` quản lý lớp, `040` vận hành bán trực tiếp & upsell).
* **CRM Database (Supabase):** Kết nối qua pooler Supabase (`CRM_DATABASE_URL`).

### 1.3. Cấu hình Email & Môi trường (`/var/www/lms/.env`)
* **SMTP:** Đã cấu hình tài khoản chính thức `cskh.mcna.247@gmail.com` qua Gmail SMTP (cổng 465 SSL, App Password: lưu trong kho mật khẩu của MCNA, không ghi vào repo).
* **Người gửi hiển thị:** `"Học Viện Công Nghệ MCNA" <cskh.mcna.247@gmail.com>`.
* **Mật khẩu học viên mặc định:** đặt qua biến môi trường trên máy chủ (lưu trong kho mật khẩu của MCNA, không ghi vào repo). Học viên bị buộc đổi mật khẩu ở lần đăng nhập đầu.
* **LMS Login URL:** `https://lms.mcna.vn`.
* **Supabase Storage Bucket:** `lms-materials` (chứa tài liệu giảng dạy và bài tập lớn).

---

## 2. Các tính năng & Luồng tích hợp đã hoàn thành 100%

### 2.1. Tích hợp tự động CRM ↔ LMS (Realtime Webhook)
* **Trigger:** Trên Database Supabase của CRM, trigger `trg_revenue_records_webhook` tự động kích hoạt khi có bản ghi mới/cập nhật trong bảng `revenue_records` đạt điều kiện đã thanh toán (`debt = 0`).
* **Webhook Endpoint:** `POST https://lms.mcna.vn/api/integrations/supabase/revenue-webhook`.
* **Nhận diện đa khóa học:** Hàm `matchCourse` và từ điển `COURSE_CODE_ALIASES` tại [`src/paidImport.ts`](../src/paidImport.ts) tự động chuẩn hóa và nhận diện chính xác các mã khóa viết tắt từ CRM:
  * `AI4WORK` ➡️ AI for Work
  * `AIAGENT` / `AI_AGENT` ➡️ AI Agent Masterclass
  * `AIAUTOMATION` / `AI_AUTO` ➡️ AI Automation
  * `AI cho lãnh đạo` / `AI for Research`
  * `PBI_LV1`, `PBI_LV2`, `PYT_LV1`, `PYT_LV2`, `SQL_LV1`, `SQL_LV2`.
* **Gửi Email kích hoạt:** Khi đơn hàng thành công, LMS tự động tạo tài khoản và gửi email thông báo kèm link đăng nhập, mật khẩu mặc định, lịch học và hotline hỗ trợ.
* **Cơ chế bảo vệ (Role Guard):** LMS ngăn chặn việc ghi danh đè tài khoản của Admin (`role = 'admin'`). Khách hàng từ CRM bắt buộc phải có email khác với các tài khoản quản trị hệ thống.

### 2.2. Giao diện Quản trị & Quản lý lớp
* **Tài khoản Admin:** `danglv.mcna.247@gmail.com` (mật khẩu lưu trong kho mật khẩu của MCNA, không ghi vào repo) (vai trò: `admin`).
* **Tính năng:**
  * Đồng bộ thủ công từ CRM: Tab "Khách đã thanh toán" có nút "Lấy dữ liệu từ CRM" để kéo đơn về xem trước và duyệt.
  * Xếp lớp & Gửi email thông báo lịch học chính thức: Gửi thông tin Zoom, nhóm Zalo, giảng viên phụ trách.
  * Quản lý tài liệu: Upload trực tiếp file lớn (>50MB) lên private storage Supabase.

### 2.3. Tích hợp thanh toán MB Bank & SePay
* **Tài khoản nhận tiền:** MB Bank `099162438104` (HỌC VIỆN CÔNG NGHỆ MCNA).
* **Webhook ngân hàng:**
  * `POST https://lms.mcna.vn/api/payments/webhook`
  * `POST https://lms.mcna.vn/api/payments/sepay/webhook`

---

## 3. Quy tắc kỹ thuật BẮT BUỘC cho Codex (Rules & Constraints)

| # | Quy tắc | Lý do |
|---|---|---|
| **R1** | **TUYỆT ĐỐI KHÔNG chạy `npm run build` trực tiếp trên VPS** | VPS RAM thấp (1-2GB), lệnh `tsc && vite build` sẽ gây cạn kiệt RAM (OOM Crash), làm rớt kết nối SSH và kích hoạt cơ chế khóa bảo mật `pam_faillock`. |
| **R2** | **Quy trình deploy chuẩn:** Build local ➡️ Nén `dist/` ➡️ Upload SFTP ➡️ Giải nén ➡️ `pm2 restart lms --update-env` | Giữ server luôn ổn định 100%, thời gian downtime dưới 1 giây. |
| **R3** | **Không DROP 17 bảng SIS cũ** (`semesters`, `programs`, `tuition_fees`, `student_profiles`, ...) | Quyết định bảo toàn dữ liệu lịch sử của MCNA. |
| **R4** | **Không bật `strict: true` trong `tsconfig.json`** | Giữ cấu hình hiện tại để đảm bảo tính tương thích codebase. |
| **R5** | **Không thêm dòng co-author AI vào git commit message** | Quy ước chung của repo. |

---

## 4. Hướng dẫn thao tác triển khai (Deployment Workflow)

Khi Codex có code mới cần cập nhật lên VPS:

```bash
# 1. Kiểm tra typecheck và unit test ở local
npm run lint
npm test

# 2. Build production ở máy local
npm run build

# 3. Nén thư mục dist thành file tar.gz
tar -czf scratch/dist.tar.gz dist

# 4. Upload lên VPS qua SFTP (đẩy vào /tmp/dist.tar.gz)
node scratch/upload_dist.cjs

# 5. Giải nén và restart PM2 trên VPS
node scratch/ssh_client.cjs "tar -xzf /tmp/dist.tar.gz -C /var/www/lms && chmod -R 755 /var/www/lms/dist && rm -f /tmp/dist.tar.gz && pm2 restart lms --update-env && pm2 save"

# 6. Kiểm tra sức khỏe hệ thống sau khi deploy
curl -i https://lms.mcna.vn/api/health
```

---

## 5. Danh sách các đầu việc tiếp theo (Backlog / Next Steps)

1. **Giám sát nhật ký gửi mail & Webhook:**
   * Theo dõi file log `/root/.pm2/logs/lms-out.log` và bảng `audit_logs` trên VPS để đảm bảo mọi đơn từ CRM đều gửi mail trơn tru.
2. **Bổ sung mã khóa Level 3 khi MCNA mở lớp mới:**
   * Nếu sắp tới MCNA mở thêm lớp `PBI_LV3` hoặc `PYT_LV3`, thêm alias vào `COURSE_CODE_ALIASES` tại [`src/paidImport.ts`](../src/paidImport.ts) và tạo khóa học tương ứng trong catalogue LMS.
3. **Cấu hình sao lưu Database định kỳ (Auto Backup):**
   * Đặt cronjob trên VPS chạy `pg_dump lms_simple` định kỳ hàng đêm vào `/var/backups/lms`.
4. **Kiểm tra giao diện người dùng trên thiết bị di động (Responsive UI):**
   * Xác nhận trải nghiệm của học viên khi học bài, xem tài liệu PDF và video trên điện thoại di động.
