# Tích hợp LMS ↔ CRM MCNA

Tài liệu này là hợp đồng kỹ thuật giữa LMS và CRM của MCNA. LMS đặt chuẩn, CRM làm theo. Mọi thay đổi hợp đồng cần cập nhật tài liệu này trước.

Có hai chiều:

| Chiều | Cơ chế | Dùng cho |
|---|---|---|
| LMS → CRM | Webhook `POST` tới URL của CRM, ký HMAC, tự thử lại | Người học tự tạo tài khoản; ghi danh; chuyên cần; hoàn thành khóa; cấp chứng chỉ |
| CRM → LMS | API `/api/integrations/crm/*`, API key + chữ ký HMAC | Tra cứu khóa/lớp; tạo tài khoản học viên; ghi danh/xếp lớp; xác nhận thanh toán |

> **Mô hình direct sale (`SALES_MODE=direct`, mặc định).** LMS không còn mở tự đăng ký: `POST /api/auth/register` và các API tự ghi danh trả `403`. Khi CRM chưa gọi được API, Quản lý lớp nhập bảng "khách đã thanh toán" (xem [direct-sale-van-hanh.md](direct-sale-van-hanh.md)); tài khoản và ghi danh mang nguồn `crm`. Các API tích hợp dùng ở cả hai chế độ. **Trong direct sale, `payments/confirm` không tự xếp/kích hoạt lớp, kể cả gửi `sectionId`**: ghi danh chuyển sang `pending`, `placedSectionId=null`; Quản lý lớp quyết định xếp và gửi email sau. Trong `self_service` mới giữ hành vi tự xếp lớp sau xác nhận có lớp hợp lệ. Tài khoản CRM mới trong direct sale dùng `DEFAULT_STUDENT_PASSWORD` nếu có, nếu không dùng mật khẩu ngẫu nhiên; đều buộc đổi lần đầu.

> **Bổ sung vận hành (migration 040):** các sự kiện `consultation.requested`, `upsell.requested`, `upsell.payment_confirmed` dùng cùng vỏ sự kiện/header/chữ ký ở mục 3. Request tư vấn gồm `requestId,lmsUserId,courseId,message`; yêu cầu upsell gồm `orderId,lmsUserId,courseId,amount,source,policy`; xác nhận gồm `orderId,enrollmentId,lmsUserId,amount,reference`. CRM phải xử lý theo `X-LMS-Event-Id` để chống trùng. QR hiển thị không phải bằng chứng đã nhận tiền; xác nhận upsell hiện là thủ công. Chưa kích hoạt/kiểm chứng tích hợp CRM thật.

## 1. Cấu hình

Biến môi trường phía LMS:

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `CRM_WEBHOOK_URL` | Có (chiều LMS → CRM) | URL CRM nhận webhook. Chưa đặt thì sự kiện nằm chờ trong hàng đợi, không mất. |
| `CRM_WEBHOOK_SECRET` | Có (chiều LMS → CRM) | Khóa bí mật LMS dùng ký webhook. CRM dùng cùng khóa để kiểm chữ ký. |
| `CRM_API_KEY` | Có (chiều CRM → LMS) | API key CRM gửi trong header `Authorization`. |
| `CRM_INBOUND_SECRET` | Có (chiều CRM → LMS) | Khóa bí mật CRM dùng ký request gọi vào LMS. |
| `SUPABASE_REVENUE_WEBHOOK_SECRET` | Có nếu dùng Supabase Database Webhook | Khóa riêng cho webhook doanh thu; Supabase gửi `Authorization: Bearer <khóa>`. |
| `CRM_SIGNATURE_TOLERANCE_SECONDS` | Không | Độ lệch thời gian cho phép, mặc định `300` giây. |
| `CRON_SECRET` | Có khi dùng Vercel Cron | Secret cho các job `/api/internal/jobs/*` (outbox CRM và cảnh báo chuyên cần). |
| `ATTENDANCE_QR_SECRET` | Khuyến nghị | Khóa HMAC riêng để ký QR động; nếu bỏ trống hệ thống dùng `JWT_SECRET`. |

Chưa đặt `CRM_API_KEY` hoặc `CRM_INBOUND_SECRET` thì mọi endpoint `/api/integrations/crm/*` trả `503`.

### Webhook doanh thu từ Supabase

`POST /api/integrations/supabase/revenue-webhook` chỉ nhận request có header `Authorization: Bearer <SUPABASE_REVENUE_WEBHOOK_SECRET>`. Nếu chưa cấu hình khóa trên LMS, endpoint trả `503`; nếu thiếu hoặc sai header, trả `401`. Nội dung JSON tự khai là `revenue_records` không thay thế xác thực. Endpoint `/api/integrations/crm/payments/confirm` luôn yêu cầu API key và chữ ký HMAC CRM, kể cả khi body giống payload Supabase.

Trước khi triển khai phiên bản này, tạo khóa ngẫu nhiên riêng, đặt cùng giá trị vào biến môi trường của LMS và header `Authorization` trong cấu hình Database Webhook của Supabase, rồi gửi một bản ghi thử từ môi trường kiểm thử. Không lưu giá trị khóa trong Git. Khởi động lại tiến trình LMS với biến môi trường mới sau khi build trên máy local và chuyển `dist/` lên VPS.

## 2. Cách ký (dùng chung hai chiều)

### Nguồn danh sách đã thanh toán: chỉ đọc từ database CRM

Đây là nguồn nhập **theo thao tác của Quản lý lớp**, độc lập với webhook và API hai chiều. Không phải đồng bộ nền, không ghi CRM, không tự xếp lớp. Endpoint `GET /api/admin/paid-enrollments/crm` chỉ cho `admin`/`manager`, yêu cầu đăng nhập, giới hạn tần suất và trả `Cache-Control: no-store`. Nhật ký LMS chỉ ghi số lượng; không ghi tên/email/điện thoại của dữ liệu lấy về.

1. Cấu hình biến máy chủ `CRM_DATABASE_URL` tới database CRM bằng role chuyên dụng chỉ có `CONNECT`, `USAGE` schema và `SELECT` bảng `public.revenue_records`. Đặt `default_transaction_read_only=on` cho role như lớp bảo vệ bổ sung. Không dùng tài khoản chủ database hoặc đặt biến có tiền tố `VITE_`.
2. Bảng cần các cột: `id`, `seq` (số thứ tự duy nhất), `saleDate`, `customerName`, `customerPhone`, `customerEmail`, `customerType`, `courseSold`, `totalRevenue`, `debt`, `paymentMethod`. Các cột camelCase phải giữ nguyên tên. `courseSold` là mảng hoặc danh sách mã phân cách bằng dấu phẩy/chấm phẩy/xuống dòng.
3. Kết nối ngoài localhost bắt buộc TLS xác thực chứng chỉ. Nếu nhà cung cấp dùng CA riêng, đặt `CRM_DATABASE_CA_CERT` bằng PEM của họ; không tắt kiểm tra chứng chỉ. Cần kết nối cho phép IP máy chủ LMS và redeploy/restart sau khi đổi biến. Không cần migration trong CRM.
4. Mỗi truy vấn chạy trong transaction `READ ONLY`, timeout truy vấn 8 giây, pool tối đa 2 kết nối. API trả lỗi chung `502` khi kết nối hoặc schema không phù hợp; không đưa lỗi database/credentials ra giao diện.
5. Chỉ nhận các trạng thái chuẩn `Đã hoàn tất thanh toán - Fully Paid`, `Đã hoàn tất thanh toán`, `Fully Paid` (không phân biệt hoa/thường/dấu) với số nợ hợp lệ đúng bằng 0. Không nhận chuỗi phủ định như `not fully paid`, dữ liệu nợ trống hoặc số không hợp lệ. Email/họ tên không hợp lệ được liệt kê ở phần bỏ qua.
6. Mỗi trang lấy 500 bản ghi mới nhất theo `seq DESC`. Nếu có trang cũ hơn, phản hồi có `nextCursor`; gọi lại với `?cursor=<nextCursor>`. Cột `seq` cần duy nhất và không thay đổi. Giao diện chia dòng phát sinh thành lô tối đa 500; từng lô có bước kiểm tra/nhập riêng. Không cron hoặc tự tạo tài khoản chỉ vì bấm lấy dữ liệu.
7. Mã khóa được đối chiếu qua ID, tag, tên và tên rút gọn; mã gộp không dấu phân cách cũng được nhận (`AIAGENT`, `AIAUTOMATION`); `AI4WORK` ánh xạ `AI_WORK`. Khớp nhiều khóa hoặc không khớp cần xử lý trong bước kiểm tra; không tự chọn khóa doanh nghiệp khác.
8. Đơn nhiều khóa không có tiền phân bổ từng khóa: giữ tổng ở ghi chú và cảnh báo dùng giá danh mục cho khoản ghi nhận LMS. Số tiền này không phải bằng chứng/đối soát doanh thu thực thu. `crmRef` là ID doanh thu và được lưu trong ghi chú giao dịch, **không gán vào `crm_deal_id`**; mã deal thật vẫn chỉ dùng qua hợp đồng API CRM. Nhập lại không tạo thêm ghi danh đã tồn tại.

Kiểm thử phải dùng CRM giả lập và database LMS thử. Không chạy nhập/ghi danh/email với khách thật để kiểm tra kết nối. Thành công khi chỉ đọc danh sách không chứng minh webhook, email, đối soát thanh toán hoặc tự xếp lớp đã chạy production.

```
signature = hex( HMAC_SHA256( secret, "<timestamp>.<raw body>" ) )
```

- `timestamp`: Unix time **tính bằng giây**, dạng chuỗi, đúng giá trị gửi trong header.
- `raw body`: đúng từng byte của body gửi đi. Request `GET` không có body thì dùng chuỗi rỗng, tức ký `"<timestamp>."`.
- Header chữ ký có dạng `sha256=<hex>`.
- Bên nhận so sánh bằng hàm so sánh an toàn thời gian và từ chối request lệch quá `CRM_SIGNATURE_TOLERANCE_SECONDS`.

Ví dụ Node.js:

```js
import crypto from "crypto";

const timestamp = String(Math.floor(Date.now() / 1000));
const body = JSON.stringify({ crmContactId: "C-1001", name: "Nguyễn Văn A", email: "a@gmail.com", phone: "0912345678" });
const signature = crypto.createHmac("sha256", process.env.CRM_INBOUND_SECRET).update(`${timestamp}.${body}`).digest("hex");

await fetch("https://lms.mcna.edu.vn/api/integrations/crm/students", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CRM_API_KEY}`,
    "X-CRM-Timestamp": timestamp,
    "X-CRM-Signature": `sha256=${signature}`,
    "X-CRM-Event-Id": "crm-evt-000123"
  },
  body
});
```

Ví dụ bash:

```bash
TS=$(date +%s)
BODY='{"crmContactId":"C-1001","name":"Nguyen Van A","email":"a@gmail.com","phone":"0912345678"}'
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$CRM_INBOUND_SECRET" -hex | sed 's/^.* //')
curl -X POST "$LMS_URL/api/integrations/crm/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRM_API_KEY" \
  -H "X-CRM-Timestamp: $TS" \
  -H "X-CRM-Signature: sha256=$SIG" \
  -H "X-CRM-Event-Id: crm-evt-000123" \
  --data "$BODY"
```

## 3. LMS → CRM: webhook

### 3.1. Request

LMS gửi `POST <CRM_WEBHOOK_URL>` với các header:

| Header | Ví dụ |
|---|---|
| `Content-Type` | `application/json` |
| `X-LMS-Event` | `enrollment.requested` |
| `X-LMS-Event-Id` | `crmevt_4f1c2a9b0e7d` (trùng `id` trong body) |
| `X-LMS-Timestamp` | `1789372800` |
| `X-LMS-Signature` | `sha256=5d41402abc4b2a76b9719d911017c592…` (ký bằng `CRM_WEBHOOK_SECRET`) |

Body luôn có cùng một vỏ:

```json
{
  "id": "crmevt_4f1c2a9b0e7d",
  "type": "enrollment.requested",
  "origin": "lms",
  "occurredAt": "2026-09-14T08:30:00.000Z",
  "data": { }
}
```

- `origin`: `lms` nếu hành động xảy ra trong LMS; `crm` nếu do chính CRM gọi API gây ra. CRM có thể bỏ qua sự kiện `origin = "crm"` để tránh vòng lặp.
- Thứ tự giao không được bảo đảm tuyệt đối khi có thử lại; dùng `occurredAt` để sắp xếp.

Với Vercel (đặc biệt gói Hobby miễn phí giới hạn cron 1 lần/ngày), repo đã tích hợp sẵn GitHub Actions workflow tự động (`.github/workflows/crm-outbox-cron.yml`) chạy mỗi 10 phút để ping tới `/api/internal/jobs/crm-outbox` với header `Authorization: Bearer <CRON_SECRET>`. Đồng thời LMS cũng tự động kích hoạt gửi tức thời (opportunistic delivery) ngay khi sự kiện phát sinh.

### 3.2. Phản hồi và thử lại

- CRM trả **bất kỳ mã 2xx** trong vòng 10 giây thì sự kiện được coi là đã giao.
- Mã khác, lỗi mạng hoặc quá thời gian: LMS thử lại sau 1, 2, 4, 8… phút (tối đa 6 giờ giữa hai lần), **tối đa 10 lần**, sau đó đánh dấu `failed` trong bảng `crm_outbox`.
- Có thể nhận **trùng** một sự kiện, ví dụ CRM đã xử lý nhưng phản hồi bị mất. CRM phải chống trùng theo `X-LMS-Event-Id`.

### 3.3. Các sự kiện

#### `contact.registered`

Một tài khoản học viên được tạo bằng email cá nhân: người học tự đăng ký (`signupSource = "self"`) hoặc CRM tạo qua API (`"crm"`).

```json
{
  "lmsUserId": "user_8d2f0c1a9b3e",
  "name": "Nguyễn Văn A",
  "email": "a@gmail.com",
  "phone": "0912345678",
  "signupSource": "self",
  "crmContactId": null,
  "createdAt": "2026-09-14T08:25:11.000Z"
}
```

#### `enrollment.requested`

Người học (hoặc CRM) đăng ký một khóa học, có thể kèm lớp mong muốn.

#### `enrollment.status_changed`

Trạng thái ghi danh đổi: xác nhận thanh toán, xếp lớp, kích hoạt.

#### `attendance.risk_detected` (Đã ngưng sử dụng)

> **Lưu ý**: Đối với mô hình bán khóa học online học qua Zoom, tính năng điểm danh và theo dõi chuyên cần đã được loại bỏ để tinh gọn quy trình học tập. Sự kiện này được giữ lại cho khả năng tương thích ngược.

#### `attendance.recovered` (Đã ngưng sử dụng)

> **Lưu ý**: Đã ngưng sử dụng tương tự `attendance.risk_detected`.

#### `course.completed` và `certificate.issued`

LMS phát hai sự kiện trong cùng giao dịch khi quản trị viên cấp chứng chỉ: một cho vòng đời ghi danh hoàn tất, một chứa mã chứng chỉ để CRM gửi chăm sóc/upsell.

Hai sự kiện ghi danh dùng chung cấu trúc `data`:

```json
{
  "enrollmentId": "enroll_1b2c3d4e5f60",
  "status": "pending_payment",
  "enrolledAt": "2026-09-14T08:30:00.000Z",
  "crmDealId": null,
  "student": {
    "lmsUserId": "user_8d2f0c1a9b3e",
    "name": "Nguyễn Văn A",
    "email": "a@gmail.com",
    "phone": "0912345678",
    "crmContactId": null
  },
  "course": { "id": "course_web01", "title": "Lập trình Web cơ bản", "price": 3500000 },
  "requestedSection": { "id": "section_ab12cd34ef56", "code": "WEB-K12" },
  "placedSection": null,
  "payment": { "transactionId": "tx_9a8b7c6d5e4f", "amount": 3500000, "status": "pending" }
}
```

Giá trị `status`:

| Giá trị | Nghĩa |
|---|---|
| `pending_payment` | Khóa có phí, chưa xác nhận thanh toán |
| `pending` | Đã đủ điều kiện (miễn phí hoặc đã thanh toán), chờ xếp lớp |
| `active` | Đã vào lớp, được học |
| `completed` | Đã hoàn thành khóa |
| `cancelled` | Đã hủy |

## 4. CRM → LMS: API

Mọi request phải có:

| Header | Bắt buộc | Ghi chú |
|---|---|---|
| `Authorization: Bearer <CRM_API_KEY>` | Có | |
| `X-CRM-Timestamp` | Có | Unix time (giây) |
| `X-CRM-Signature: sha256=<hex>` | Có | Ký bằng `CRM_INBOUND_SECRET` (mục 2) |
| `X-CRM-Event-Id` | Có với `POST` | Khóa chống trùng, tối đa 200 ký tự, duy nhất cho mỗi thao tác |

**Chống trùng:** gửi lại cùng `X-CRM-Event-Id` với cùng body thì LMS không xử lý lại. LMS trả đúng phản hồi lần đầu, kèm header `X-Idempotent-Replay: true`. Dùng lại `X-CRM-Event-Id` với body khác thì bị `409`. Nếu lần đầu lỗi `5xx`, được phép gửi lại với cùng `X-CRM-Event-Id`.

### 4.1. `GET /api/integrations/crm/courses`

Danh sách khóa học đang mở và các lớp đang nhận đăng ký.

```json
{
  "courses": [
    {
      "id": "course_web01",
      "title": "Lập trình Web cơ bản",
      "description": "…",
      "category": "Công nghệ",
      "price": 3500000,
      "level": "Cơ bản",
      "openingDate": "2026-10-05",
      "numberOfLessons": 16,
      "teacherName": "Trần B",
      "openSectionCount": 1,
      "sections": [
        {
          "id": "section_ab12cd34ef56",
          "sectionCode": "WEB-K12",
          "teacherName": "Trần B",
          "maxStudents": 30,
          "seatsLeft": 12,
          "schedule": [{ "dayOfWeek": "Thứ 3", "startTime": "18:30", "endTime": "21:00", "room": "P201" }],
          "openingDate": "2026-10-06",
          "numberOfSessions": 16
        }
      ]
    }
  ]
}
```

### 4.2. `POST /api/integrations/crm/students`

Tạo hoặc liên kết tài khoản học viên theo **Số điện thoại (phone)** và **Email** làm khóa định danh (Key).

Request:

```json
{ "name": "Nguyễn Văn A", "email": "a@gmail.com", "phone": "0912345678", "crmContactId": "C-1001" }
```

*Lưu ý: `crmContactId` là tùy chọn (optional). Khóa chính để liên kết và đối soát giữa LMS và CRM là `phone` và `email`.*

Cách xử lý:
1. Đã có tài khoản gắn `crmContactId` này (nếu có truyền): trả tài khoản đó.
2. Tìm kiếm theo `email`: nếu đã có tài khoản học viên, liên kết `crmContactId` và cập nhật `phone` (nếu chưa có), trả về tài khoản đó.
3. Tìm kiếm theo `phone` (đã chuẩn hóa các đầu số `+84` / `0`): nếu đã có tài khoản học viên, liên kết `crmContactId`, trả về tài khoản đó.
4. Chưa có: direct sale dùng `DEFAULT_STUDENT_PASSWORD` nếu đã cấu hình, các trường hợp còn lại dùng mật khẩu ngẫu nhiên tạm thời gửi về email. Bắt buộc đổi mật khẩu lần đầu. Phát sự kiện `contact.registered` với `origin = "crm"`.

Phản hồi `201` (tạo mới) hoặc `200` (đã có):

```json
{ "lmsUserId": "user_8d2f0c1a9b3e", "email": "a@gmail.com", "phone": "0912345678", "created": true }
```

Lỗi riêng:
- `409`: email thuộc tài khoản không phải học viên, hoặc đã gắn với `crmContactId` khác.
- `503`: không gửi được email mật khẩu. Tài khoản chưa được tạo; gửi lại với cùng `X-CRM-Event-Id`.

### 4.3. `POST /api/integrations/crm/enrollments`

Ghi danh học viên vào khóa học, tùy chọn kèm lớp.

Request (cần ít nhất một trong: `email`, `phone`, hoặc `crmContactId`):

```json
{ "phone": "0912345678", "email": "a@gmail.com", "courseId": "course_web01", "sectionId": "section_ab12cd34ef56", "crmDealId": "D-5520" }
```

Kết quả giống khi học viên tự bấm đăng ký trên LMS:
- Khóa có phí: `status = "pending_payment"`, tạo giao dịch chờ. Lớp được ghi nhận là `requestedSection`.
- Khóa miễn phí: `status = "pending"`, học viên vào danh sách chờ của lớp.

Phản hồi `201`:

```json
{ "enrollmentId": "enroll_1b2c3d4e5f60", "status": "pending_payment", "transactionId": "tx_9a8b7c6d5e4f", "requestedSectionId": "section_ab12cd34ef56" }
```

Lỗi riêng:
- `404`: không tìm thấy học viên, khóa học đang mở hoặc lớp.
- `400`: lớp không thuộc khóa, lớp không mở, đã đủ sĩ số hoặc trùng lịch.
- `409`: học viên đã có ghi danh đang hiệu lực cho khóa này. Body có `enrollmentId` của bản ghi hiện có.

### 4.4. `POST /api/integrations/crm/payments/confirm`

CRM báo học viên đã thanh toán. LMS duyệt giao dịch. Trong direct sale chỉ chuyển sang chờ Quản lý lớp xếp; trong self-service mới có thể xếp/mở quyền học theo lớp hợp lệ.

Request (cần một trong `enrollmentId` hoặc `crmDealId`):

```json
{ "crmDealId": "D-5520", "amount": 3500000, "reference": "VCB-20260914-778", "paidAt": "2026-09-14T09:00:00.000Z", "sectionId": "section_ab12cd34ef56" }
```

- `sectionId` không bắt buộc. Direct sale không tự xếp kể cả gửi trường này. Self-service: không gửi thì dùng lớp đã chọn (`requestedSection`), chưa có lớp thì giữ `pending`.
- Gọi lại cho ghi danh đã thanh toán thì không tạo thêm giao dịch.

Phản hồi `200` trong self-service khi đã xếp lớp:

```json
{
  "enrollmentId": "enroll_1b2c3d4e5f60",
  "status": "active",
  "transactionId": "tx_9a8b7c6d5e4f",
  "placedSectionId": "section_ab12cd34ef56",
  "placementError": null
}
```

Direct sale mặc định trả `status = "pending"`, `placedSectionId = null`. Trong self-service, thanh toán thành công nhưng xếp lớp thất bại (ví dụ lớp đã đầy): tiền **vẫn được ghi nhận**, `status = "pending"` và `placementError` mô tả lý do.

## 5. Mã lỗi chung

| Mã | Khi nào |
|---|---|
| `400` | Body sai định dạng (`{ "error": "Invalid request body.", "issues": … }`) hoặc vi phạm quy tắc nghiệp vụ |
| `401` | Sai API key, thiếu hoặc sai chữ ký, timestamp lệch quá cửa sổ |
| `404` | Không tìm thấy đối tượng |
| `409` | Xung đột dữ liệu hoặc `X-CRM-Event-Id` bị dùng lại với body khác / đang xử lý |
| `429` | Vượt giới hạn tần suất (300 request/phút/IP) |
| `503` | Tích hợp chưa cấu hình, hoặc lỗi tạm thời (được phép thử lại cùng `X-CRM-Event-Id`) |

Body lỗi luôn có dạng `{ "error": "<mô tả>" }`.

## 6. Kiểm thử cục bộ

- `scripts/mockCrmServer.ts` dựng một CRM giả: nhận webhook, kiểm chữ ký và in sự kiện ra console.
  - Chạy: `CRM_WEBHOOK_SECRET=dev-secret npx tsx scripts/mockCrmServer.ts` (mặc định cổng 4100).
  - Trỏ LMS vào: `CRM_WEBHOOK_URL=http://localhost:4100/webhooks/lms`, `CRM_WEBHOOK_SECRET=dev-secret`.
- `npm run test:signup-crm` chạy toàn bộ luồng: tự đăng ký → đổi mật khẩu → ghi danh → CRM xác nhận thanh toán → học viên xem tài liệu buổi học.
- Trạng thái giao webhook xem trong bảng `crm_outbox` (`status`, `attempts`, `last_error`).
