# LMS MCNA - Hệ thống học trực tuyến Học viện Công nghệ MCNA

Nền tảng vận hành lớp học trực tuyến của Học viện MCNA theo mô hình **direct sale**: khách thanh toán với bộ phận tư vấn, MCNA tạo tài khoản học viên từ bảng "đã thanh toán", Quản lý lớp xếp học viên vào lớp, giảng viên đưa tài liệu từng buổi, học viên xem slide trực tuyến và tải file data.

---

## 👥 Bốn vai trò

### 1. Quản trị viên hệ thống (`admin`)
* Toàn quyền của Quản lý lớp, cộng thêm: tài khoản hệ thống (admin, Quản lý lớp), đổi vai trò, nhật ký hệ thống, hàng đợi CRM, xóa khóa học.

### 2. Quản lý lớp (`manager`)
* **Học viên & Xếp lớp**: nhập bảng khách đã thanh toán (dán từ Excel/Google Sheets, tải file `.xlsx/.csv`, hoặc nhập tay), chọn học viên và gán vào mã lớp, gửi lại email xếp lớp, chuyển lớp.
* **Khóa học & Lớp học**: nạp khóa học từ mcna.vn (làm một lần), tạo lớp có mã lớp, lịch học, ngày khai giảng, link Zoom, link nhóm Zalo và giảng viên phụ trách.
* **Nội dung lớp học**: tài liệu mở đầu, slide, file data và bài tập về nhà của từng buổi.
* Tài khoản học viên sinh ra từ bảng đã thanh toán. Quản lý lớp không có màn quản lý người dùng: tài khoản giảng viên, Quản lý lớp và admin do admin hệ thống tạo. Không xem được nhật ký hệ thống và hàng đợi CRM, không xóa được khóa học.

### 3. Giảng viên (`teacher`)
* Thấy khóa học mình phụ trách và các lớp được phân công; quản lý tài liệu mở đầu, slide, file data, bài tập về nhà và video của từng buổi; điểm danh.

### 4. Học viên (`student`)
* **Lớp học của tôi**: chỉ hiện lớp sau khi được xếp. Mỗi buổi có slide/tài liệu (chỉ xem trực tuyến), file data (tải về) và bài tập về nhà. Đầu khóa có thư chúc mừng, sách/tài liệu tham khảo và bài luyện tập.

---

## 🧭 Mô hình direct sale (mặc định)

Hướng dẫn vận hành từng bước: [docs/direct-sale-van-hanh.md](docs/direct-sale-van-hanh.md).

* `SALES_MODE=direct` (mặc định) đóng tự đăng ký tài khoản, tự ghi danh, quét QR và màn duyệt đơn. Trang công khai chỉ còn giới thiệu khóa học kèm nút liên hệ tư vấn.
* Bảng "khách đã thanh toán – đăng ký khóa nào" được nhập ở **Học viên & Xếp lớp → Nhập danh sách đã thanh toán**. Mỗi dòng tạo (hoặc dùng lại) một tài khoản học viên đăng nhập bằng email cá nhân với mật khẩu mặc định, bắt đổi ở lần đăng nhập đầu, và một ghi danh "đã thanh toán – chờ xếp lớp". Nhập lại cùng bảng không tạo trùng.
* Tài khoản mới không thấy lớp, tài liệu hay danh mục cho tới khi được xếp lớp. Khi xếp lớp, học viên nhận email gồm tên lớp, lịch học, ngày khai giảng, link nhóm Zalo, giảng viên và số điện thoại hỗ trợ.
* Học viên chỉ tải được **file data**. Slide và tài liệu chỉ xem trong trình xem của LMS và cần bản **PDF**; file PowerPoint/Word gốc chỉ dành cho giảng viên và Quản lý lớp.
* `SALES_MODE=self_service` mở lại luồng cũ (mô tả ở mục dưới): học viên tự đăng ký, quét QR, admin duyệt đơn.

---

## 🎓 Luồng tự đăng ký (`SALES_MODE=self_service`) và kết nối CRM

### Danh mục công khai
* Khách chưa đăng nhập xem được khóa học `published` (`GET /api/public/courses`, `GET /api/public/courses/:id`): lớp đang mở, số chỗ trống, lịch hàng tuần và danh sách buổi.
* Bấm **Đăng ký lớp này** → tạo tài khoản hoặc đăng nhập → hệ thống gửi yêu cầu ghi danh vào đúng lớp đã chọn.
* Khóa có phí: ghi danh `pending_payment`, lớp đã chọn được lưu (`requested_section_id`) và chọn sẵn ở màn xếp lớp. Khóa miễn phí: ghi danh `pending`, học viên vào danh sách chờ.

### Khóa học → Lớp → Buổi → Tài liệu
* Mỗi lớp (`course_sections`) tự sinh các buổi "Buổi N" (`attendance_sessions`) theo số buổi và lịch học.
* Giảng viên/Quản lý lớp mở một buổi để thêm tài liệu (`session_materials`): slide (`.pdf/.ppt/.pptx`), tài liệu (`.pdf/.doc/.docx`), file data (`.xlsx/.xls/.csv/.pbix/.zip/.rar/.json/.txt/.sql/.ipynb/.py/.md`), video YouTube hoặc liên kết ngoài. Tài liệu mở đầu của khóa (sách/tài liệu tham khảo, bài luyện tập) dùng chung bảng này với `session_id` để trống.
* File nằm trong bucket **private** của Supabase Storage; chưa cấu hình Supabase thì file lưu ở `MATERIALS_DIR`.
* Học viên đã được xếp lớp: file data tải qua `GET /api/materials/:id/download`; slide/tài liệu PDF chỉ mở trong trình xem của LMS (máy chủ trả nội dung trực tiếp, không cấp link tải); slide/tài liệu chưa có bản PDF thì học viên chưa xem được. Giảng viên, Quản lý lớp và admin tải được file gốc.

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

Cả hai script cần server đang chạy với `NODE_ENV` khác production và `DATABASE_URL` trỏ cùng database với server.

**Luồng direct sale** (mặc định): chặn tự đăng ký → quyền Quản lý lớp → nạp khóa học → tạo lớp → nhập bảng đã thanh toán → tài khoản trống → xếp lớp và email → tài liệu mở đầu, slide chỉ xem, file data tải được. Script tự tạo tài khoản và lớp riêng cho mỗi lần chạy:
```bash
E2E_BASE_URL=http://localhost:3000 npm run test:direct-sale
```

**Luồng tự đăng ký + CRM**: danh mục → tự đăng ký → CRM → tài liệu buổi học. Server phải chạy với `SALES_MODE=self_service` và có `CRM_API_KEY`/`CRM_INBOUND_SECRET`; script dùng cùng giá trị đó. Script dùng ca học và số điện thoại cố định nên mỗi database chỉ chạy được một lần:
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

Trên máy chủ tự quản (VPS), migration còn thiếu được chạy mỗi khi ứng dụng khởi động. **Vercel không chạy bước khởi động đó**, nên `vercel.json` dùng `npm run vercel-build`: bản build **production** chạy migration còn thiếu trước rồi mới build (`scripts/deployMigrate.ts`); migration lỗi thì build dừng và bản cũ tiếp tục chạy. Bản build preview không đụng tới database. `DATABASE_URL` phải có ở bước build; nếu không, bước này bị bỏ qua (có cảnh báo trong log build) và cần chạy `npm run db:migrate` bằng tay với database đó.

Khi không tải được dữ liệu sau đăng nhập (ví dụ database chưa có migration mới), LMS hiện màn "Chưa tải được dữ liệu" kèm nút thử lại, không hiển thị dữ liệu mẫu.

#### Biến môi trường bắt buộc trên production
* `NODE_ENV=production`, `PORT`
* `DATABASE_URL`, `JWT_SECRET`
* `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_WEBHOOK_TOLERANCE_SECONDS`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`

#### Mô hình bán hàng
* `SALES_MODE` (`direct` mặc định | `self_service`), `DEFAULT_STUDENT_PASSWORD` (mật khẩu mặc định cho tài khoản tạo từ bảng đã thanh toán, tối thiểu 8 ký tự), `SUPPORT_PHONE` (in trong email và trang đăng nhập), `ALLOW_HOMEWORK_DOWNLOAD` (`true` thì học viên tải được tệp đính kèm bài tập về nhà).
* `GEMINI_API_KEY`, `GEMINI_MODEL`: soạn thư chúc mừng bằng AI. Bỏ trống thì nút soạn thư trả về thư mẫu của MCNA.

#### Google Workspace & email
* `SCHOOL_EMAIL_DOMAIN`, `GOOGLE_ADMIN_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `LMS_LOGIN_URL`
* SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Hộp thư `@mcna.vn` nằm trên OneMail (`mail.mcna.vn`, cổng 465). Thiếu cấu hình SMTP thì email tài khoản và email xếp lớp không được gửi mà chỉ ghi vào `scratch/emails.log`; màn **Học viên & Xếp lớp** hiện trạng thái email của từng học viên.

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
