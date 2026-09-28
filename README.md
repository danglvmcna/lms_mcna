# LMS MCNA - Hệ thống học trực tuyến Học viện Công nghệ MCNA

Nền tảng bán và vận hành khóa học trực tuyến của Học viện MCNA: danh mục khóa học công khai, học viên tự đăng ký và thanh toán VietQR, học trực tuyến qua Zoom với tài liệu từng buổi, admin xác nhận học phí và xếp lớp, tích hợp CRM MCNA.

---

## 👥 Ba vai trò

### 1. Quản trị viên (`admin`)
* **Tổng quan**: số liệu, việc cần làm và bảng **Cấu hình hệ thống** (SePay, email, nơi lưu tài liệu, CRM) cho biết máy chủ đang thiếu cài đặt nào.
* **Ghi danh**: xác nhận học phí, kích hoạt và xếp học viên vào lớp; học viên nhận thông báo và email.
* **Khóa học & lớp**: tạo/sửa khóa học và bài học; mở lớp với lịch tuần, sĩ số, link Zoom, nhóm Zalo; cảnh báo trùng lịch; buổi học tự sinh theo lịch; xem và trả lời thảo luận của lớp.
* **Người dùng**: tạo tài khoản lẻ hoặc nhập CSV, đổi vai trò, khóa/mở tài khoản, gửi liên kết đặt lại mật khẩu.
* **Thông báo** gửi hàng loạt và **Nhật ký & CRM** (audit log, hàng đợi đồng bộ CRM).

### 2. Giảng viên (`teacher`)
* **Khóa học của tôi**: các khóa được phân công; nhắc số câu hỏi của học viên đang chờ trả lời.
* **Buổi học & tài liệu**: tạo/sửa buổi học, gắn video ghi hình, đăng slide, file dữ liệu (Excel, CSV, PBIX, Word, PDF), video YouTube.
* **Thảo luận**: xem và trả lời câu hỏi theo từng lớp, tạo chủ đề cho cả lớp; bấm thông báo mở thẳng câu hỏi.

### 3. Học viên (`student`)
* **Khám phá**: xem khóa học, chọn lớp theo lịch, đăng ký và thanh toán VietQR (lớp tự mở khi SePay xác nhận).
* **Lớp học của tôi**: vào Zoom, nhóm lớp, tài liệu và video từng buổi, ghi chú bài học, đánh dấu đã học, thảo luận.
* **Học phí & thông báo**: lịch sử giao dịch; thông báo trong LMS và email cho các việc quan trọng (được xếp lớp, học phí được xác nhận).

> Bài kiểm tra, bài tập và chấm điểm, sổ điểm, chứng chỉ: phần máy chủ vẫn còn nhưng đã ẩn khỏi giao diện từ 23/09/2026. Điểm danh đã gỡ bỏ.

---

## 🎓 Danh mục công khai, tự đăng ký và kết nối CRM

### Danh mục công khai
* Khách chưa đăng nhập xem được khóa học `published` (`GET /api/public/courses`, `GET /api/public/courses/:id`): lớp đang mở, số chỗ trống, lịch hàng tuần và danh sách buổi.
* Bấm **Đăng ký lớp này** → tạo tài khoản hoặc đăng nhập → hệ thống gửi yêu cầu ghi danh vào đúng lớp đã chọn.
* Khóa có phí: ghi danh `pending_payment`, lớp đã chọn được lưu (`requested_section_id`) và chọn sẵn ở màn xếp lớp. Khóa miễn phí: ghi danh `pending`, học viên vào danh sách chờ.

### Khóa học → Lớp → Buổi → Tài liệu
* Mỗi lớp (`course_sections`) tự sinh các buổi "Buổi N" (`attendance_sessions`) theo số buổi và lịch học.
* Giảng viên mở một buổi trong **Khóa học của tôi** để thêm tài liệu (`session_materials`): slide (`.ppt/.pptx/.pdf`), file dữ liệu và văn bản (`.xlsx/.csv/.pbix/.doc/.docx/.pdf/.zip`), video YouTube hoặc liên kết ngoài.
* File nằm trong bucket **private** của Supabase Storage; học viên chỉ tải được qua `GET /api/materials/:id/download` khi đã được xếp vào lớp (link ký hạn 60 giây). Chưa cấu hình Supabase thì file lưu ở `MATERIALS_DIR`.

### Tự đăng ký tài khoản
* `POST /api/auth/register` (họ tên, email cá nhân, số điện thoại) tạo tài khoản học viên và gửi **mật khẩu tạm** tới email.
* Khi còn mật khẩu tạm, mọi API (trừ `me`, `logout`, `change-password`) trả `PASSWORD_CHANGE_REQUIRED`.
* Email đã có tài khoản nhận phản hồi giống hệt (không lộ tài khoản). `POST /api/auth/forgot-password` gửi liên kết đặt lại mật khẩu một lần.
* Ngoài production, phản hồi đăng ký trả thêm `devTemporaryPassword` để kiểm thử.

### Kết nối CRM MCNA
* **LMS → CRM:** `contact.registered`, `enrollment.requested`, `enrollment.status_changed` ghi vào `crm_outbox` cùng transaction nghiệp vụ, gửi mỗi 30 giây tới `CRM_WEBHOOK_URL` kèm chữ ký HMAC, thử lại tối đa 10 lần.
* **CRM → LMS:** `/api/integrations/crm/courses`, `/students`, `/enrollments`, `/payments/confirm`, xác thực bằng API key + chữ ký HMAC, chống trùng theo `X-CRM-Event-Id`.
* Hợp đồng chi tiết: [docs/crm-integration.md](docs/crm-integration.md).

---

## 🛠️ Hướng dẫn kỹ thuật

### 1. Cấu trúc mã nguồn
* `src/components/`: giao diện theo vai trò (`AdminPanel`, `TeacherPanel`, `StudentPanel`) và các màn dùng chung.
* `src/store.ts`: dữ liệu mẫu ban đầu và `AppStore` phía client.
* `src/server/`: backend - repositories PostgreSQL, cache Redis, xác thực JWT, scheduler, tích hợp CRM và email.
* `scripts/`: migration, seed, đối soát schema và kiểm thử E2E.
* `server.ts`: máy chủ Express, kiêm proxy Vite dev server.
* `src/components/ui/`: hệ thống thiết kế dùng chung (nút, hộp thoại dạng sheet, toast, badge, ảnh bìa khóa học, trạng thái trống); token màu và kiểu chữ ở `src/index.css`.
* `src/components/layout/AppShell.tsx`: khung ứng dụng cho cả ba vai trò (thanh bên trên máy tính, thanh tab dưới trên điện thoại).
* `src/assets/illustrations/`: hình minh họa linh vật Bít (SVG), tự hiển thị theo tên file. Sửa nhân vật hoặc cảnh trong `scripts/mascot/build-illustrations.mjs` rồi chạy `node scripts/mascot/build-illustrations.mjs` để tạo lại cả bộ.

### 2. Thiết lập môi trường

#### Yêu cầu
* **Node.js** v18 trở lên.
* **PostgreSQL**. **Redis** là tùy chọn - thiếu Redis hệ thống vẫn chạy, chỉ mất lớp cache.

#### Cài đặt
```bash
npm install
```

#### Cấu hình `.env`
Tạo `.env` ở thư mục gốc dựa trên `.env.example`:
```env
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/lms_mcna
JWT_SECRET=chuoi_bao_mat_jwt_dai_va_kho_doan
PAYMENT_WEBHOOK_SECRET=chuoi_bao_mat_webhook_thanh_toan
PAYMENT_WEBHOOK_TOLERANCE_SECONDS=300
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
DISABLE_RATE_LIMIT=true
```

#### Khởi tạo cơ sở dữ liệu
```bash
npm run db:migrate    # áp dụng migrations
npm run db:seed       # nạp dữ liệu (tùy chọn - server cũng tự seed khi khởi động)
npm run db:drift      # đối soát schema
```

Database mới được nạp 3 tài khoản gốc và **catalog thật của mcna.vn** (`src/server/data/mcnaCatalog.json`: 14 khóa học, lịch khai giảng và syllabus từng buổi). Giá trong file chỉ là giá tạm vì web không công bố học phí — sửa lại trong giao diện, lệnh import không ghi đè giá admin đã đặt.

Cần dữ liệu demo để thử tải (20 giảng viên, 40 khóa học, 300 học viên) thì đặt `SEED_DEMO_DATA=true` trong `.env` trước khi seed.

Khi file catalog thay đổi, nạp lại bằng:
```bash
npm run import:mcna -- --hide-other-courses
```

#### Chạy thử
```bash
npm run dev
```
Ứng dụng chạy tại **http://localhost:3000**.

**Tài khoản mẫu:** `admin@mcna.local` / `admine16`, `teacher@mcna.local` / `teachere16`, `student@mcna.local` / `studente16`.

---

### 3. Kiểm tra kiểu dữ liệu
```bash
npm run lint
```
Trên Windows PowerShell, nếu bị chặn script: `npm.cmd run lint`.

---

### 4. Kiểm thử E2E

Luồng danh mục → tự đăng ký → CRM → tài liệu buổi học. Server phải chạy với `NODE_ENV` khác production, có `CRM_API_KEY`/`CRM_INBOUND_SECRET`, và script dùng cùng giá trị đó với `DATABASE_URL` trỏ cùng database:
```bash
E2E_BASE_URL=http://localhost:3000 CRM_API_KEY=... CRM_INBOUND_SECRET=... npm run test:signup-crm
```

CRM giả để thử webhook: `CRM_WEBHOOK_SECRET=dev-secret npm run mock:crm`, rồi khởi động LMS với `CRM_WEBHOOK_URL=http://localhost:4100/webhooks/lms` và cùng `CRM_WEBHOOK_SECRET`.

---

### 5. Biên dịch & triển khai

```bash
npm ci                # cài đúng theo lockfile
npm run db:migrate    # cập nhật schema
npm run build         # đóng gói frontend (dist/client) và backend (dist/server.cjs)
npm start             # chạy production
```

#### Biến môi trường bắt buộc trên production
* `NODE_ENV=production`, `PORT`
* `DATABASE_URL`, `JWT_SECRET`
* `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_WEBHOOK_TOLERANCE_SECONDS`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`

#### Thanh toán
* `SEPAY_API_KEY`: bắt buộc để webhook SePay tự xác nhận chuyển khoản và mở lớp. Thiếu key thì quản trị phải bấm **Kích hoạt** cho từng đơn.

#### Email
* SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (mặc định người gửi là `"MCNA LMS" <SMTP_USER>`).
* `LMS_LOGIN_URL`: địa chỉ LMS, dùng cho nút "Mở MCNA LMS" trong email thông báo.
* Google Workspace (không bắt buộc, cấp email trường cho học viên): `SCHOOL_EMAIL_DOMAIN`, `GOOGLE_ADMIN_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_JSON`. Học viên chưa có email trường vẫn nhận email quan trọng (được xếp lớp, học phí được xác nhận) ở email đã đăng ký.

#### Tài liệu buổi học
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (bucket **private**), hoặc `MATERIALS_DIR` khi chạy không có Supabase.

#### CRM
* `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET`, `CRM_API_KEY`, `CRM_INBOUND_SECRET`, `CRM_SIGNATURE_TOLERANCE_SECONDS`
* `CRON_SECRET`: xác thực lịch gửi lại hàng đợi CRM (Vercel Cron và GitHub Actions).

Sau khi triển khai, quản trị vào **Tổng quan → Cấu hình hệ thống** để xem mục nào còn thiếu (chỉ hiện có hay chưa, không hiện giá trị).

---

### 6. Smoke test & rollback

```bash
DEPLOY_URL=https://ten-mien-cua-ban.com npm run smoke:deploy
```

Nếu bản mới lỗi nặng: xác định commit ổn định gần nhất, build lại commit đó, và nếu dữ liệu bị ảnh hưởng thì phục hồi theo [docs/backup-restore-policy.md](docs/backup-restore-policy.md).
