# LMS MCNA - Hệ thống học trực tuyến Học viện Công nghệ MCNA

Nền tảng bán và vận hành khóa học trực tuyến của Học viện MCNA: danh mục khóa học công khai, học viên tự đăng ký, admin duyệt đơn và xếp lớp, giảng viên dạy - điểm danh - chấm bài, tích hợp CRM MCNA.

---

## 👥 Ba vai trò

### 1. Quản trị viên (`admin`)
* **Đơn hàng & Ghi danh**: duyệt đơn đăng ký, xác nhận thanh toán, xếp học viên vào lớp (lẻ hoặc hàng loạt).
* **Khóa học & Lớp học**: quản lý khóa học, lớp, lịch học hàng tuần, số buổi, ngày khai giảng, link phòng học và nhóm chat.
* **Duyệt khóa học**: phê duyệt hoặc trả về khóa học do giảng viên gửi lên.
* **Người dùng**: tạo tài khoản lẻ hoặc nhập CSV, đổi vai trò, khóa/mở tài khoản, gửi liên kết đặt lại mật khẩu.
* **Nhật ký hệ thống**: tra cứu audit log.

### 2. Giảng viên (`teacher`)
* **Khóa học & Bài giảng**: soạn khóa học, bài học, ngân hàng câu hỏi và đề kiểm tra.
* **Lớp học & Điểm danh**: điểm danh từng buổi, tạo mã điểm danh cho học viên tự check-in, tự chấm công, đính kèm tài liệu buổi học (slide, tài liệu, video YouTube, link ngoài).
* **Bài tập & Chấm điểm**: chấm bài, sổ điểm, thống kê lớp.

### 3. Học viên (`student`)
* **Khám phá khóa học**: duyệt danh mục, xem lịch lớp, đăng ký lớp.
* **Lớp học của tôi**: học bài, đánh dấu hoàn thành, làm bài kiểm tra, nộp bài tập, tải tài liệu buổi học.
* **Đơn hàng & Thanh toán**: theo dõi đơn đăng ký và lịch sử giao dịch.

---

## 🎓 Danh mục công khai, tự đăng ký và kết nối CRM

### Danh mục công khai
* Khách chưa đăng nhập xem được khóa học `published` (`GET /api/public/courses`, `GET /api/public/courses/:id`): lớp đang mở, số chỗ trống, lịch hàng tuần và danh sách buổi.
* Bấm **Đăng ký lớp này** → tạo tài khoản hoặc đăng nhập → hệ thống gửi yêu cầu ghi danh vào đúng lớp đã chọn.
* Khóa có phí: ghi danh `pending_payment`, lớp đã chọn được lưu (`requested_section_id`) và chọn sẵn ở màn xếp lớp. Khóa miễn phí: ghi danh `pending`, học viên vào danh sách chờ.

### Khóa học → Lớp → Buổi → Tài liệu
* Mỗi lớp (`course_sections`) tự sinh các buổi "Buổi N" (`attendance_sessions`) theo số buổi và lịch học.
* Giảng viên/Admin mở một buổi trong màn **Điểm danh** để thêm tài liệu (`session_materials`): slide (`.ppt/.pptx/.pdf`), Word/PDF (`.doc/.docx/.pdf`), video YouTube hoặc liên kết ngoài.
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
npm run db:seed       # nạp dữ liệu mẫu (tùy chọn - server cũng tự seed khi khởi động)
npm run db:drift      # đối soát schema
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

#### Google Workspace & email
* `SCHOOL_EMAIL_DOMAIN`, `GOOGLE_ADMIN_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `LMS_LOGIN_URL`
* SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`

#### Tài liệu buổi học
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (bucket **private**), hoặc `MATERIALS_DIR` khi chạy không có Supabase.

#### CRM
* `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET`, `CRM_API_KEY`, `CRM_INBOUND_SECRET`, `CRM_SIGNATURE_TOLERANCE_SECONDS`

---

### 6. Smoke test & rollback

```bash
DEPLOY_URL=https://ten-mien-cua-ban.com npm run smoke:deploy
```

Nếu bản mới lỗi nặng: xác định commit ổn định gần nhất, build lại commit đó, và nếu dữ liệu bị ảnh hưởng thì phục hồi theo [docs/backup-restore-policy.md](docs/backup-restore-policy.md).
