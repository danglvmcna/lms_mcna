# E16 LMS - Hệ Thống Quản Lý Đào Tạo Học Viện Cao Cấp

Hệ thống Quản lý Học tập (LMS) và Quản lý Học sinh (SIS) cao cấp dành cho Học viện E16. Hệ thống được tích hợp đầy đủ các phân hệ bảo mật, phân quyền nghiêm ngặt và giao diện người dùng trực quan, tối ưu trải nghiệm học tập và giảng dạy trực tuyến chuyên nghiệp.

---

## 👥 Phân Hệ Vai Trò & Chức Năng Chi Tiết (Consolidated System Roles)

Hệ thống E16 LMS sử dụng cơ chế kiểm soát truy cập dựa trên vai trò (RBAC - Role-Based Access Control) chặt chẽ. Để tối ưu hóa và đơn giản hóa việc phân quyền trong cơ sở dữ liệu, các vai trò nghiệp vụ cũ được chuẩn hóa (normalized) thành **6 vai trò hệ thống chính** như sau:

### 1. Ban Quản Trị Tối Cao (`super_admin`)
* **Toàn quyền hệ thống**: Quản lý cấu hình hệ thống, quản lý tài khoản người dùng, xem toàn bộ nhật ký hệ thống (`Audit Logs`).

### 2. Ban Quản Lý (`manager`)
* **Vận hành hệ thống**: Khởi tạo tài khoản (đơn lẻ hoặc nhập CSV hàng loạt), phê duyệt khóa học, quản lý các ngành học và khoa chuyên môn.

### 3. Quản Trị Viên / Nhân Viên Học Đường (`admin`)
Đây là vai trò tổng hợp trong cơ sở dữ liệu (tương ứng với các vai trò nghiệp vụ cũ: `academic_admin`, `finance`, `receptionist`):
* **Nghiệp vụ Học vụ (Academic Admin)**: Thiết lập học kỳ, năm học, quản lý hồ sơ sinh viên, phát hành Cảnh báo Học thuật (`Academic Warnings`) khi điểm trung bình GPA tích lũy của sinh viên sa sút (GPA < 2.0).
* **Nghiệp vụ Thanh toán học phí**: Thiết lập biểu phí học phần, hiển thị khoản phải đóng, ghi nhận trạng thái thanh toán được xác nhận từ bên xử lý thanh toán và theo dõi công nợ học vụ.
* **Nghiệp vụ Tiếp tân (Receptionist)**: Hỗ trợ sinh viên reset mật khẩu khẩn cấp, tra cứu nhanh thông tin liên lạc và hỗ trợ tuyển sinh cơ bản.

### 4. Giảng Viên & Cố Vấn (`teacher`)
Vai trò này trong cơ sở dữ liệu đại diện cho cả Giảng viên đứng lớp và Cố vấn học tập (tương ứng với vai trò nghiệp vụ cũ: `teacher`, `advisor`):
* **Nghiệp vụ Giảng dạy (Teacher)**: Soạn giáo án bài học, quản lý đề thi trắc nghiệm (`Quizzes`), bài tập lớn (`Assignments`), điểm danh chuyên cần và chấm điểm sổ điểm (`Gradebook`).
* **Nghiệp vụ Cố vấn học tập (Advisor)**: Theo dõi tiến trình học tập của nhóm sinh viên được phân công, ghi nhật ký tư vấn (học tập, kỷ luật, tài chính), lập và phê duyệt lộ trình đăng ký lớp học cho học kỳ tiếp theo của sinh viên.

### 5. Sinh Viên (`student`)
* **Học tập & Đăng ký**: Xem thời khóa biểu, tham gia học và làm bài trắc nghiệm/tự luận, đăng ký lớp học phần trong kỳ đăng ký, theo dõi hóa đơn và nộp học phí trực tuyến, tra cứu học bạ cá nhân.

### 6. Phụ Huynh (`parent`)
* **Giám sát**: Đăng nhập tài khoản liên kết để theo dõi bảng điểm, chuyên cần (đi muộn, vắng mặt), hóa đơn học phí của con em mình và đóng học phí trực tuyến thay con.

---

## 📧 Phân Hệ Tự Động Cấp Phát Email (Google Workspace Provisioning)

Hệ thống tích hợp quy trình tự động cấp phát tài khoản email trường học chuyên nghiệp trên nền tảng Google Workspace (`@mcna.edu.vn`) dành riêng cho sinh viên:

### Luồng Nghiệp Vụ Tự Động (Async Provisioning)
1. **Tạo tài khoản học viên**: Khi Admin/Manager khởi tạo học viên mới, một tiến trình chạy ngầm (asynchronous fire-and-forget) sẽ tự động gửi yêu cầu tạo tài khoản Google Workspace lên API của Google.
2. **Sinh Username tự động**: Tên học viên được tự động chuẩn hóa (loại bỏ dấu tiếng Việt, ký tự đặc biệt, chuyển chữ thường và đảo ngược định dạng `ho.ten` thành `ten.van.ho`). Trùng lặp username được giải quyết tự động bằng cách kiểm tra đồng thời trên cơ sở dữ liệu và Directory API của Google để sinh thêm hậu tố số (ví dụ: `dong.van.nguyen1@mcna.edu.vn`).
3. **Gửi Email Chào Mừng**: Hệ thống gửi email kèm thông tin tài khoản email trường và mật khẩu tạm thời vào địa chỉ **email cá nhân** đăng ký của sinh viên.
4. **Điều hướng thông báo**: Mọi thông báo nội bộ sau đó (Điểm thi, Học phí, Lịch học, Cảnh báo học thuật) sẽ được tự động điều hướng gửi trực tiếp vào hòm thư **email trường** mới cấp phát này của học viên.
5. **Hủy/Đình chỉ**: Khi học viên bị vô hiệu hóa (trạng thái `isActive` chuyển sang `false`), tài khoản Google Workspace tương ứng sẽ tự động bị đình chỉ hoặc xóa để bảo vệ an toàn thông tin.
6. **Kích hoạt thủ công (Reprovisioning)**: Hỗ trợ nút/đường dẫn kích hoạt thủ công cho Admin thực hiện lại quy trình tạo tài khoản Google Workspace qua API `POST /api/admin/users/:id/reprovision-email` khi có sự cố.

---

## 🎓 Danh Mục Khóa Học, Lớp – Buổi Học, Tự Đăng Ký & Kết Nối CRM

### Danh mục công khai và đăng ký học
* Khách chưa đăng nhập thấy danh mục khóa học `published` ở trang đầu (`GET /api/public/courses`, `GET /api/public/courses/:id`): lớp đang mở, số chỗ còn trống, lịch hàng tuần và danh sách buổi.
* Bấm **Đăng ký lớp này** → tạo tài khoản hoặc đăng nhập → hệ thống tự gửi yêu cầu ghi danh vào đúng lớp đã chọn.
* Khóa có phí: ghi danh `pending_payment`, lớp đã chọn được lưu (`requested_section_id`) và được chọn sẵn ở màn xếp lớp. Khóa miễn phí: ghi danh `pending`, học viên vào danh sách chờ của lớp.

### Khóa học → Lớp → Buổi → Tài liệu
* Mỗi lớp (`course_sections`) tự sinh các buổi "Buổi N" (`attendance_sessions`) theo số buổi và lịch học.
* Giảng viên/Admin mở một buổi trong màn **Điểm danh** để thêm tài liệu (`session_materials`): slide (`.ppt/.pptx/.pdf`), file Word/PDF (`.doc/.docx/.pdf`), video YouTube hoặc liên kết ngoài.
* File nằm trong bucket **private** của Supabase Storage; học viên chỉ tải được qua `GET /api/materials/:id/download` khi đã được xếp vào lớp (chuyển hướng tới link ký hạn 60 giây). Chưa cấu hình Supabase thì file lưu ở `MATERIALS_DIR` (không public).
* Hệ thống chặn giảm số buổi của lớp nếu các buổi sắp bị xóa đang có tài liệu.

### Tự đăng ký tài khoản bằng email cá nhân
* `POST /api/auth/register` (họ tên, email cá nhân, số điện thoại) tạo tài khoản học viên và gửi **mật khẩu tạm** tới email.
* Khi còn mật khẩu tạm, mọi API (trừ `me`, `logout`, `change-password`) trả `PASSWORD_CHANGE_REQUIRED`; giao diện hiện màn đổi mật khẩu bắt buộc.
* Email đã có tài khoản nhận phản hồi giống hệt (không lộ tài khoản) và một email nhắc "bạn đã có tài khoản". `POST /api/auth/forgot-password` gửi liên kết đặt lại mật khẩu một lần.
* Tài khoản tự đăng ký hoặc tạo từ CRM không được cấp email Google Workspace.
* Ngoài môi trường production, phản hồi đăng ký trả thêm `devTemporaryPassword` để kiểm thử.

### Kết nối CRM MCNA
* **LMS → CRM:** sự kiện `contact.registered`, `enrollment.requested`, `enrollment.status_changed` được ghi vào `crm_outbox` cùng transaction nghiệp vụ, gửi mỗi 30 giây tới `CRM_WEBHOOK_URL` kèm chữ ký HMAC, tự thử lại tối đa 10 lần.
* **CRM → LMS:** `/api/integrations/crm/courses`, `/students`, `/enrollments`, `/payments/confirm`, xác thực bằng API key + chữ ký HMAC, chống xử lý trùng theo `X-CRM-Event-Id`.
* Hợp đồng chi tiết cho đội CRM: [docs/crm-integration.md](docs/crm-integration.md).

---

## 🛠️ Hướng Dẫn Kỹ Thuật Chi Tiết (Technical Guidelines)

Lập trình viên và quản trị viên hệ thống cần tuân thủ nghiêm ngặt các chỉ dẫn kỹ thuật dưới đây để cài đặt, vận hành và phát triển dự án.

### 1. Cấu Trúc Mã Nguồn Quan Trọng
* `src/components/`: Chứa các giao diện Panel và Manager riêng biệt cho các vai trò người dùng chính.
* `src/store/`: Quản lý trạng thái Client-side (`AppStore`) và cơ chế đồng bộ dữ liệu.
* `src/server/`: Chứa toàn bộ logic backend bao gồm repositories kết nối PostgreSQL, cache Redis, bộ xác thực JWT, và lập lịch Scheduler tự động.
* `scripts/`: Chứa các kịch bản kiểm thử E2E, Migration cấu trúc database, và Seeding dữ liệu mẫu.
* `server.ts`: Điểm khởi chạy máy chủ Express kết hợp proxy máy chủ phát triển Vite.

### 2. Thiết Lập Môi Trường Cục Bộ (Local Setup)

#### Bước 1: Yêu cầu cài đặt sẵn
* Cài đặt **Node.js** phiên bản v18 trở lên.
* Cài đặt cơ sở dữ liệu **PostgreSQL** và dịch vụ cache **Redis** (khuyên dùng dịch vụ Supabase và Upstash hoặc cài đặt cục bộ).

#### Bước 2: Cài đặt thư viện
```bash
npm install
```

#### Bước 3: Cấu hình biến môi trường
Tạo tệp tin `.env` ở thư mục gốc của dự án dựa trên file `.env.example` và thiết lập các tham số:
```env
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/e16_lms_db
JWT_SECRET=thiet_lap_chuoi_bao_mat_jwt_cuc_ky_dai_va_kho_giai_ma
PAYMENT_WEBHOOK_SECRET=thiet_lap_chuoi_bao_mat_webhook_thanh_toan
PAYMENT_WEBHOOK_TOLERANCE_SECONDS=300
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
DISABLE_RATE_LIMIT=true
```
*Lưu ý: `DATABASE_URL` là bắt buộc để thực hiện các thao tác di chuyển dữ liệu cấu trúc bảng.*

#### Bước 4: Khởi tạo và Đồng bộ Cơ sở Dữ liệu
* **Áp dụng các thay đổi cấu trúc bảng (Migrations)**:
  ```bash
  npm run db:migrate
  ```
* **Nạp cơ sở dữ liệu giả lập ban đầu (Seeding)**:
  ```bash
  npm run db:seed
  ```
  *Lệnh này sẽ khởi tạo các tài khoản mẫu cho 6 vai trò hệ thống hiện tại và một số tài khoản legacy đã được chuẩn hóa về `admin`/`teacher` để phục vụ kiểm thử.*
* **Đối soát độ lệch cấu trúc (Drift Check)**:
  ```bash
  npm run db:drift
  ```

#### Bước 5: Khởi chạy máy chủ phát triển cục bộ (Local Development)
```bash
npm run dev
```
Ứng dụng sẽ khởi động và lắng nghe tại địa chỉ: **http://localhost:3000**

---

### 3. Kiểm Tra Tĩnh & Khắc Phục Lỗi TypeScript (Linting)

Trước khi thực hiện biên dịch hoặc tạo các pull request, bắt buộc phải chạy chương trình kiểm tra lỗi kiểu dữ liệu tĩnh để tránh phát sinh lỗi runtime:
```bash
npm run lint
```
**Lưu ý trên hệ điều hành Windows (PowerShell)**: Nếu PowerShell chặn quyền chạy scripts, vui lòng thực hiện bypass Execution Policy hoặc gọi trực tiếp trình thực thi CMD:
```powershell
npm.cmd run lint
```

---

### 4. Kiểm Thử Tích Hợp Đóng Gói (E2E Integration Testing)

Hệ thống hỗ trợ kiểm thử tự động toàn bộ luồng hoạt động học thuật thông qua script mô phỏng. Đảm bảo máy chủ cục bộ đang chạy ở cổng `3000` trước khi thực hiện lệnh test.

* **Trên Linux / macOS / Git Bash**:
  ```bash
  E2E_BASE_URL=http://localhost:3000 npm run test:e2e
  ```
* **Trên Windows PowerShell**:
  ```powershell
  $env:E2E_BASE_URL="http://localhost:3000"
  npm.cmd run test:e2e
  ```
*Kịch bản E2E sẽ mô phỏng tuần tự các hành động: Khởi tạo sinh viên mới -> Đăng ký môn -> Giảng viên điểm danh và chấm điểm -> Sinh viên gửi/ghi nhận thanh toán học phí -> hệ thống cập nhật trạng thái thanh toán -> Cố vấn học tập giải quyết các cảnh báo phát sinh.*

* **Luồng danh mục → tự đăng ký → CRM → tài liệu buổi học.** Server phải chạy với `NODE_ENV` khác production và có `CRM_API_KEY`/`CRM_INBOUND_SECRET`; script dùng cùng giá trị và `DATABASE_URL` trỏ cùng DB:
  ```bash
  E2E_BASE_URL=http://localhost:3000 CRM_API_KEY=... CRM_INBOUND_SECRET=... npm run test:signup-crm
  ```
* **CRM giả để thử webhook:** `CRM_WEBHOOK_SECRET=dev-secret npm run mock:crm`, rồi khởi động LMS với `CRM_WEBHOOK_URL=http://localhost:4100/webhooks/lms` và cùng `CRM_WEBHOOK_SECRET`.

---

### 5. Biên Dịch & Vận Hành Production (Production Deploy)

Hệ thống hỗ trợ cấu trúc đóng gói độc lập để triển khai trên các dịch vụ đám mây (như Render, Heroku, AWS).

#### Quy trình biên dịch:
```bash
npm run build
```
*Lệnh này sẽ thực hiện song song: Sử dụng `vite build` để đóng gói giao diện React SPA tối ưu tại thư mục `dist/client`, đồng thời sử dụng `esbuild` đóng gói file khởi chạy backend `server.ts` thành tệp tin CJS duy nhất tại `dist/server.cjs`.*

#### Quy trình khởi chạy trên máy chủ sản phẩm thực tế:
```bash
# Khởi động dịch vụ Node.js chạy production từ file đóng gói
npm start
```

#### Các biến môi trường bắt buộc trên Production:
* `NODE_ENV=production`
* `DATABASE_URL` (Đường dẫn kết nối CSDL PostgreSQL production an toàn)
* `JWT_SECRET` (Khóa bảo mật mạnh để mã hóa các session cookie phiên làm việc)
* `PAYMENT_WEBHOOK_SECRET` (Khóa HMAC để xác thực callback từ bên xử lý thanh toán)
* `PAYMENT_WEBHOOK_TOLERANCE_SECONDS` (Cửa sổ chấp nhận timestamp webhook, mặc định 300 giây)
* `PASSWORD_RESET_TOKEN_TTL_MINUTES` (Thời hạn token đặt lại mật khẩu một lần, mặc định 30 phút)
* `PORT` (Cổng dịch vụ do đám mây phân phối, mặc định: 3000)

**Cấu hình Google Workspace & Provisioning:**
* `SCHOOL_EMAIL_DOMAIN` (Tên miền email của trường, ví dụ: `mcna.edu.vn`)
* `GOOGLE_ADMIN_EMAIL` (Tài khoản quản trị Admin tối cao, ví dụ: `admin@mcna.edu.vn`)
* `GOOGLE_SERVICE_ACCOUNT_JSON` (Chuỗi JSON chứa thông tin khóa Private Key của Google Service Account có quyền Domain-Wide Delegation)
* `LMS_LOGIN_URL` (Đường dẫn gốc của hệ thống LMS, ví dụ: `https://lms.mcna.edu.vn`)

**Cấu hình SMTP (Gmail OAuth2):**
* `SMTP_HOST` (Mặc định: `smtp.gmail.com`)
* `SMTP_PORT` (Mặc định: `465` hoặc `587`)
* `SMTP_USER` (Hòm thư gửi tự động, ví dụ: `noreply@mcna.edu.vn`)
* `SMTP_FROM` (Tên hiển thị người gửi, ví dụ: `"LMS E16-MCNA" <noreply@mcna.edu.vn>`)

**Cấu hình Tài liệu buổi học (Supabase Storage):**
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (khóa service role, chỉ dùng phía server)
* `SUPABASE_STORAGE_BUCKET` (tên bucket **private**, mặc định `lms-materials`)

**Cấu hình Kết nối CRM MCNA:**
* `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` (LMS gửi sự kiện sang CRM)
* `CRM_API_KEY`, `CRM_INBOUND_SECRET` (CRM gọi vào LMS)
* `CRM_SIGNATURE_TOLERANCE_SECONDS` (độ lệch thời gian cho phép của chữ ký, mặc định `300`)

#### Quy trình triển khai sạch và cấu trúc lệnh đầy đủ trên server:
```bash
npm ci                          # Cài đặt sạch các gói thư viện đúng theo lockfile
npm run db:migrate              # Chạy cập nhật cấu trúc database mới nhất
npm run build                   # Biên dịch tối ưu toàn bộ mã nguồn frontend và backend
npm start                       # Khởi chạy dịch vụ chính thức
```

---

### 6. Smoke Test & Khôi Phục Lỗi Khẩn Cấp (Smoke Test & Rollback)

#### Smoke Test sau khi triển khai:
Để kiểm tra nhanh tính khả dụng của API và hệ thống sau khi quá trình CI/CD hoàn tất trên server production:
```bash
DEPLOY_URL=https://lms-domain-cua-ban.com npm run smoke:deploy
```

#### Quy trình khôi phục lỗi khẩn cấp (Rollback Protocol):
Nếu quá trình triển khai phiên bản mới gặp sự cố runtime nghiêm trọng gây treo ứng dụng:
1. Xác định phiên bản Git commit hoạt động ổn định gần nhất.
2. Thực hiện cấu hình CI/CD để build lại commit ổn định đó hoặc chạy deploy thủ công.
3. Nếu cấu trúc bảng Database bị thay đổi trái phép hoặc lỗi dữ liệu do migration mới, áp dụng quy trình phục hồi sao lưu (Database Snapshot Restore) và thực hiện các bước đối soát cụ thể theo hướng dẫn chi tiết tại [Tài liệu Khôi phục Lỗi khẩn cấp](file:///d:/LMS/docs/rollback-checklist.md).
