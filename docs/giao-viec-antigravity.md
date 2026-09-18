# Giao việc: dọn nền tảng chất lượng code MCNA LMS

**Người nhận:** agent code (antigravity)
**Gốc đối chiếu:** commit `5c6c052`, nhánh `main`
**Phân tích đầy đủ:** [`docs/bao-cao-phan-tich-repo.md`](./bao-cao-phan-tich-repo.md) — đọc §7 trước khi bắt đầu.

---

## 0. Bối cảnh trong 5 dòng

Repo này là LMS bán khóa học online của MCNA, chuyển dịch từ một hệ SIS đại học cũ (E16). Backend đã chín: transactional outbox cho CRM, idempotency webhook, bảo mật nhiều lớp. **Khoảng trống nằm ở kỷ luật kỹ thuật**: không có test, không có CI, và `npm run build` không typecheck nên code hỏng vẫn deploy được.

Nhiệm vụ của đợt này: **dựng lưới an toàn trước, dọn dẹp sau.** Không thêm tính năng mới.

---

## 1. Quy tắc bắt buộc

| # | Quy tắc | Lý do |
|---|---|---|
| R1 | **Không DROP 17 bảng SIS** (`semesters`, `programs`, `departments`, `tuition_fees`, `student_profiles`, `scholarships`, `advisor_*`, …) | Quyết định có chủ ý của chủ dự án: giữ dữ liệu lịch sử. Code chỉ được ngừng đọc/ghi, không được xóa bảng. |
| R2 | **Mọi thay đổi backend phải chạy `npm run build` rồi commit lại `api/index.js`** | File bundle 478 KB này nằm trong git (`dist/` thì bị ignore). Quên bước này → Vercel chạy code cũ, không có cảnh báo nào. |
| R3 | **Không bật `strict: true` trong `tsconfig.json` ở đợt này** | Hiện đang tắt. Bật lên sẽ phun ra hàng trăm lỗi và nhấn chìm toàn bộ công việc bên dưới. Để thành việc riêng về sau. |
| R4 | **Không đụng vào cơ chế Dev In-Memory Mock Store** | Đang dùng cho người mới clone repo. Xem R6 để không bị nó đánh lừa. |
| R5 | **Không tự quyết các mục ở §4** | Đó là quyết định nghiệp vụ, phải chờ chủ dự án trả lời. |
| R6 | **Trước khi tin bất kỳ kết quả test cục bộ nào: `curl localhost:3000/api/health`** | Nếu trả `{"database":"mock_in_memory"}` thì server đang phục vụ dữ liệu giả một cách im lặng. Kill tiến trình đang giữ cổng 3000 rồi chạy lại. Đây là bẫy đã gây mất thời gian thật. |
| R7 | **Không thêm dòng ghi công AI vào commit message hay mô tả PR** | Quy ước của repo. |

---

## 2. Việc cần làm — theo đúng thứ tự

### T1 — 🔴 Sửa lỗi typecheck đang chặn mọi thứ *(1 phút)*

`npm run lint` hiện fail với **đúng 1 lỗi**:

```
src/components/student/AssignmentSubmit.tsx(319,31): error TS2304: Cannot find name 'setExistingAttachment'.
```

State `existingAttachment` đã bị gỡ trong đợt refactor nộp bài đa tệp (`5c6c052`) nhưng còn sót lại một chỗ gọi setter. Đã kiểm tra: **không còn tham chiếu nào khác** tới `existingAttachment` trong file.

**Sửa:** xóa dòng 319 trong [`src/components/student/AssignmentSubmit.tsx`](../src/components/student/AssignmentSubmit.tsx#L319):

```diff
                               setSubmittingAssignmentId(a.id);
                               setSubmissionCodeText("");
-                              setExistingAttachment(null);
```

**Xong khi:** `npm run lint` in ra 0 lỗi.

---

### T2 — 🔴 Bắt build phải typecheck *(1 phút)*

`npm run build` hiện chỉ gồm `vite build` + `esbuild`. Cả hai đều **chỉ transpile, không kiểm tra kiểu**. Đã xác nhận bằng thực nghiệm: build thành công dù `tsc` fail. Đây là lý do lỗi T1 lọt được vào `main`.

**Sửa:** trong `package.json`, thêm `tsc --noEmit &&` vào đầu script `build`:

```diff
-    "build": "vite build && esbuild server.ts --bundle …",
+    "build": "tsc --noEmit && vite build && esbuild server.ts --bundle …",
```

Giữ nguyên phần còn lại của chuỗi lệnh.

**Xong khi:** `npm run build` chạy qua; và nếu cố tình thêm một lỗi kiểu thì build phải **fail**.

> ⚠️ Làm T1 trước T2. Đảo thứ tự sẽ làm hỏng build ngay lập tức.

---

### T3 — 🔴 Dựng CI *(30 phút)*

Repo **chưa có thư mục `.github/`**. Tạo mới `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - name: Bundle serverless phai khop ma nguon
        run: git diff --exit-code api/index.js
```

Bước cuối chính là hàng rào cho quy tắc **R2**: nếu ai sửa backend mà quên build lại `api/index.js`, CI sẽ bắt được thay vì để Vercel âm thầm chạy code cũ.

**Xong khi:** CI xanh trên một PR thử nghiệm; và khi cố tình sửa `server.ts` mà không build lại thì CI phải đỏ ở bước cuối.

---

### T4 — 🟠 Test cho các luồng chạm tiền và CRM *(3–5 ngày)*

Hiện **không có một bài test tự động nào** — không test runner, không file `*.test.ts*`. Ba script `e2eSignupCrmFlow.ts` / `smokeDeploy.ts` / `testSepayWebhook.ts` là kiểm thử thủ công, phải có người chạy và người đọc kết quả.

Cài Vitest, thêm `"test": "vitest run"` vào scripts, và thêm bước `npm test` vào CI ở T3.

**Bắt đầu từ các hàm thuần, không chạm database** — làm được ngay, không cần dựng fixture:

| Ưu tiên | Hàm | File | Cần khẳng định điều gì |
|---|---|---|---|
| 1 | `signCrmPayload`, `verifyCrmSignature` | `src/server/crm/signature.ts` | Chữ ký đúng thì pass; sai secret, sai timestamp, quá dung sai 300s, thiếu header → đều phải bị từ chối |
| 2 | `extractPaymentCodes` | `src/server/services/sepayService.ts` | Bóc đúng mã đơn từ nội dung chuyển khoản thật; nội dung rác không được khớp nhầm |
| 3 | `normalizeDayText`, `dayOfWeekIndex`, `addDaysIso`, `normalizeDateOnly` | `src/server/services/sectionSchedule.ts` | Sinh lịch buổi học đúng, kể cả khi vắt qua tháng và năm |

Sau đó mới tới các hàm chạm DB (`enqueueCrmEvent`, `findMatchingPendingTransaction`, `deliverPendingCrmEvents`) — dùng transaction rollback hoặc database tạm.

**Xong khi:** `npm test` xanh, CI chạy nó, và mọi hàm ở bảng trên đều có ít nhất một ca thành công và một ca thất bại.

---

### T5 — 🟡 Dọn vai trò `super_admin` không còn tồn tại *(2 giờ)*

Migration `031_consolidate_to_three_roles.sql` đã áp ràng buộc ở tầng database:

```sql
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'student'));
```

Nghĩa là **không tài khoản nào có thể mang role `super_admin` nữa**. Nhưng `server.ts` vẫn còn **54 chỗ** viết `requireRole([..., "super_admin"])`, cộng thêm `src/store.ts:548` và `src/components/ForumDiscussion.tsx:106,121`.

Đây **không phải lỗi** — các nhánh đó đơn giản là không bao giờ chạy tới. Nhưng nó khiến người đọc code tưởng hệ thống có 4 vai trò, trong khi thực tế chỉ có 3.

**Sửa:** bỏ `"super_admin"` khỏi các mảng role. Luôn giữ lại `"admin"` đứng cạnh nó.

> ⚠️ Chỉ làm task này **sau khi T4 đã có test**. Sửa 54 chỗ kiểm tra quyền mà không có lưới an toàn là rủi ro không đáng.

**Xong khi:** `grep -c super_admin server.ts` trả về 0; `npm run lint` và `npm test` vẫn xanh; đăng nhập bằng cả 3 vai trò vẫn vào được đúng khu vực của mình.

---

### T6 — 🟢 Việc nhỏ *(30 phút)*

Trong `package.json`:

```diff
-  "name": "react-example",
+  "name": "mcna-lms",
+  "engines": { "node": ">=20" },
```

Hiện không khai báo `engines` → Vercel/Render tự chọn phiên bản Node và có thể đổi mà không ai biết. Con số `>=20` phải khớp với `node-version` trong CI ở T3.

---

### T7 — 🟢 Đánh dấu tài liệu đã lỗi thời *(15 phút)*

[`docs/BRD.md`](./BRD.md) vẫn là tài liệu của hệ **E16 LMS/SIS cũ**: tiêu đề ghi "Tài liệu yêu cầu nghiệp vụ E16 LMS/SIS", phạm vi ghi "viết lại theo cấu trúc code hiện tại của repo `D:\LMS`", nội dung mô tả khoa/ngành/học kỳ/học bổng — những thứ sản phẩm này không còn làm.

**Chưa viết lại vội** (cần chủ dự án chốt nghiệp vụ trước). Trước mắt chèn ngay dưới tiêu đề:

```markdown
> ⚠️ **TÀI LIỆU LƯU TRỮ — KHÔNG CÒN HIỆU LỰC.** Đây là BRD của hệ thống SIS đại học E16 mà repo này đã rời bỏ.
> Không dùng làm căn cứ khi phát triển. Tham chiếu hiện hành: `docs/bao-cao-phan-tich-repo.md` và `docs/crm-integration.md`.
```

Để so sánh, [`docs/crm-integration.md`](./crm-integration.md) là tài liệu viết chuẩn và đang cập nhật — dùng nó làm khuôn mẫu khi viết lại BRD sau này.

---

## 3. Code chết đã xác định — chờ quyết định ở §4 rồi mới dọn

| Vị trí | Tình trạng |
|---|---|
| `src/server/services/attendanceRisk.ts` | Không còn nơi nào gọi. `runAttendanceRiskJob` trong `scheduler.ts` đã bị vô hiệu, chỉ trả về `"Attendance risk tracking disabled for online courses."` |
| Bộ đếm `attendanceRisks` — `server.ts:1725` | Vẫn `SELECT COUNT(*) FROM attendance_risk_alerts WHERE status='open'`. Vì không còn gì ghi vào bảng đó, dashboard admin **hiển thị một con số đóng băng vĩnh viễn**. |
| 11 route `/api/attendance/*` — `server.ts:4127–4661` | Backend còn nguyên, nhưng giao diện quản lý điểm danh của giảng viên đã bị gỡ ở commit `b3576d9`. API không còn ai gọi. |

**Không tự xóa.** Phụ thuộc câu hỏi Q1 bên dưới.

---

## 4. Chờ chủ dự án quyết — không được tự đoán

**Q1 — Điểm danh: bỏ hẳn hay giữ cho học viên tự check-in?**
Hiện đang nửa vời: backend còn, UI đã gỡ, job đã tắt.
- Nếu **bỏ**: dọn toàn bộ §3.
- Nếu **giữ**: phải dựng lại UI, và **sửa logic cảnh báo trước khi bật lại** — logic cũ coi "không có bản ghi điểm danh" là "vắng mặt", mà 18/18 buổi đã qua đều không có bản ghi nào, nên bật lên là báo động giả cho toàn bộ học viên.

**Q2 — Vercel Hobby hay nâng gói?**
`vercel.json` đặt cron `0 2 * * *` (mỗi ngày một lần, do giới hạn gói Hobby), trong khi bản self-hosted đẩy outbox mỗi 30 giây. Chênh nhau **2.880 lần**. Trên Vercel, học viên đăng ký lúc 02:05 sẽ chỉ vào CRM sau gần 24 tiếng. Nếu tuyển sinh không chấp nhận độ trễ đó: nâng gói Vercel, chuyển sang Render/VPS, hoặc gọi endpoint cron từ scheduler bên ngoài (endpoint đã có `CRON_SECRET` bảo vệ nên an toàn).

**Q3 — Bao giờ có endpoint CRM thật?**
`CRM_WEBHOOK_URL` và `CRM_WEBHOOK_SECRET` đang để trống. Phía LMS đã xong và hợp đồng kỹ thuật (`docs/crm-integration.md`) đã hoàn chỉnh; mới chỉ kiểm thử với `scripts/mockCrmServer.ts`. Việc còn lại nằm ở phía CRM.

---

## 5. Kiểm chứng trước khi báo hoàn thành

```bash
npm run lint                      # 0 lỗi
npm test                          # xanh (sau T4)
npm run build                     # thành công
git status --short                # api/index.js phải đã được commit, không còn dirty
curl localhost:3000/api/health    # KHÔNG được trả "mock_in_memory" khi test thật
```

Commit theo từng task một (T1 riêng, T2 riêng…), đừng gộp — để còn revert được từng phần nếu cần.
