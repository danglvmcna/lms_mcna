import dotenv from "dotenv";
import pg from "pg";
import { parsePaidTable } from "../src/paidImport";

dotenv.config();

// End-to-end check of the direct-sale flow:
//   admin creates a class manager -> manager loads the MCNA catalogue, opens a class, imports the paid list
//   -> learner signs in with the default password and sees an empty account -> manager places learners
//   (placement email) -> learner sees the class, opening materials, view-only slides and downloadable data
//   -> the class teacher manages their own class only.
// Needs a running server (E2E_BASE_URL) in direct-sale mode with the seeded admin account, and DATABASE_URL
// pointing at the same database. It creates its own accounts and class on every run, so use a test database.
// Run only against the disposable test server on 3101 and database on 55433.

type Session = { cookie: string; csrfToken: string; user: any };
type CallResult = { status: number; headers: Headers; data: any; bytes: number };

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3101";
const testBase=new URL(baseUrl),testDatabase=new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if(!['localhost','127.0.0.1'].includes(testBase.hostname) || testBase.port!=='3101' || testDatabase.hostname!=='127.0.0.1' || testDatabase.port!=='55433' || testDatabase.pathname!=='/lms_mcna_codex_test') throw new Error('Refusing to create fixtures outside the disposable local test environment.');
const runId = Date.now().toString(36);
const DEFAULT_PASSWORD = "LocalTestOnly_2026!";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function call(
  path: string,
  options: { method?: string; session?: Session; json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}
): Promise<CallResult> {
  const headers = new Headers(options.headers);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }
  const method = (options.method || (body ? "POST" : "GET")).toUpperCase();
  if (options.session) {
    headers.set("Cookie", options.session.cookie);
    if (method !== "GET") headers.set("X-CSRF-Token", options.session.csrfToken);
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body, redirect: "follow" });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // file downloads keep the raw text
  }
  return { status: response.status, headers: response.headers, data, bytes: buffer.length };
}

function expectStatus(label: string, result: CallResult, expected: number | number[]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert(allowed.includes(result.status), `${label}: expected HTTP ${allowed.join("/")}, got ${result.status} ${JSON.stringify(result.data).slice(0, 400)}`);
  console.log(`  ✓ ${label}`);
  return result.data;
}

async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  assert(response.ok, `Login failed for ${email}: ${JSON.stringify(data)}`);
  const cookie = response.headers.getSetCookie().map(item => item.split(";")[0]).join("; ");
  return { cookie, csrfToken: data.csrfToken, user: data.user };
}

function fileForm(fields: Record<string, string>, fileName: string, content: string | Buffer, mime: string) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", new Blob([content as any], { type: mime }), fileName);
  return form;
}

const TINY_PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required.");
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const emailOf = (name: string) => `e2e.${name}.${runId}@example.com`;

  try {
    console.log("1. Chế độ direct sale: không tự đăng ký");
    const config = expectStatus("GET /api/public/config", await call("/api/public/config"), 200);
    assert(config.salesMode === "direct", `Server must run in direct-sale mode, got ${config.salesMode}.`);
    assert(config.supportPhone, "Support phone missing from public config.");
    const blockedSignup = expectStatus("Tự đăng ký tài khoản bị chặn", await call("/api/auth/register", { json: { name: "Người Lạ", email: emailOf("stranger"), phone: "0900000001" } }), 403);
    assert(blockedSignup.code === "SELF_SIGNUP_DISABLED", "Sign-up should be refused with SELF_SIGNUP_DISABLED.");

    console.log("2. Admin tạo tài khoản Quản lý lớp và giảng viên");
    const admin = await login("admin@mcna.local", "admine16");
    const managerEmail = emailOf("manager");
    const teacherEmail = emailOf("teacher");
    const manager0 = expectStatus("Tạo Quản lý lớp", await call("/api/admin/users", { session: admin, json: { name: "Quản Lý Lớp E2E", email: managerEmail, password: "Manager@12345", role: "manager" } }), 201);
    assert(manager0.role === "manager", `Expected role manager, got ${manager0.role}.`);
    const teacher0 = expectStatus("Tạo giảng viên", await call("/api/admin/users", { session: admin, json: { name: "Trần Giảng Viên", email: teacherEmail, password: "Teacher@12345", role: "teacher" } }), 201);

    console.log("3. Quyền của Quản lý lớp");
    const manager = await login(managerEmail, "Manager@12345");
    assert(manager.user.role === "manager", "Manager session should keep the manager role.");
    const managerStore = expectStatus("Quản lý lớp tải dữ liệu", await call("/api/store", { session: manager }), 200);
    assert(managerStore.auditLogs.length === 0, "Class manager must not see the audit trail.");
    assert(!managerStore.users.some((user: any) => user.role === "admin"), "Class manager must not see admin accounts.");
    assert(managerStore.users.some((user: any) => user.id === teacher0.id), "Class manager should see teachers.");
    expectStatus("Không tạo được tài khoản hệ thống", await call("/api/admin/users", { session: manager, json: { name: "X", email: emailOf("x"), password: "Whatever@123", role: "admin" } }), 403);
    expectStatus("Không khóa được tài khoản admin", await call(`/api/admin/users/${admin.user.id}/status`, { method: "PATCH", session: manager, json: { isActive: false } }), 403);
    expectStatus("Không đặt lại được mật khẩu admin", await call(`/api/admin/users/${admin.user.id}/reset-password`, { method: "POST", session: manager, json: {} }), 403);
    expectStatus("Không đổi được vai trò", await call(`/api/admin/users/${teacher0.id}/role`, { method: "PATCH", session: manager, json: { role: "admin" } }), 403);
    expectStatus("Không đồng bộ được toàn bộ store", await call("/api/store/sync", { session: manager, json: {} }), 403);
    expectStatus("Không xem được hàng đợi CRM", await call("/api/admin/crm/outbox", { session: manager }), 403);

    console.log("4. Khóa học từ mcna.vn và lớp học");
    const catalog = expectStatus("Nạp danh mục MCNA", await call("/api/admin/catalog/import-mcna", { session: manager, json: {} }), 200);
    assert(catalog.coursesCreated + catalog.coursesUpdated >= 1, "Catalogue import should touch at least one course.");
    assert(catalog.classesCreated === 0, "The manager's catalogue import must not create classes.");
    const courses = expectStatus("Danh sách khóa học", await call("/api/courses", { session: manager }), 200);
    const course = courses.find((item: any) => item.id === "course_mcna_ai_automation") || courses.find((item: any) => /automation/i.test(item.title));
    assert(course, "AI Automation course not found after catalogue import.");
    expectStatus("Không xóa được khóa học", await call(`/api/courses/${course.id}`, { method: "DELETE", session: manager }), 403);

    const sectionCode = `AI Automation ${runId}`;
    const section = expectStatus("Tạo lớp có mã, lịch, khai giảng, Zalo, giảng viên", await call("/api/course-sections", {
      session: manager,
      json: {
        courseId: course.id,
        teacherId: teacher0.id,
        sectionCode,
        maxStudents: 2,
        numberOfSessions: 4,
        openingDate: "2026-10-12",
        schedule: [
          { dayOfWeek: "Thứ Hai", startTime: "19:30", endTime: "21:30", room: "Online (Zoom)" },
          { dayOfWeek: "Thứ Năm", startTime: "19:30", endTime: "21:30", room: "Online (Zoom)" }
        ],
        status: "open",
        meetingUrl: "https://zoom.us/j/123456789",
        groupChatUrl: "https://zalo.me/g/e2e-class"
      }
    }), 201);
    assert(section.sectionCode === sectionCode, "Class code should be kept as typed.");

    console.log("5. Nhập bảng khách đã thanh toán");
    const students = ["an", "binh", "chi"].map(name => ({ name: `Học Viên ${name.toUpperCase()}`, email: emailOf(name) }));
    const table = [
      "Họ tên\tEmail\tSĐT\tKhóa học\tSố tiền",
      `${students[0].name}\t${students[0].email}\t0911000001\tAI Automation\t3.500.000`,
      `${students[1].name}\t${students[1].email}\t0911000002\tAI Automation\t3500000`,
      `${students[2].name}\t${students[2].email}\t0911000003\tAI Automation\t`,
      `Người Sai Khóa\t${emailOf("wrong")}\t0911000004\tKhóa Không Tồn Tại\t`,
      `Người Mơ Hồ\t${emailOf("vague")}\t0911000005\tPower BI\t`,
      `Sai Email\tkhong-phai-email\t0911000006\tAI Automation\t`
    ].join("\n");
    const parsed = parsePaidTable(table);
    assert(parsed.headerDetected && parsed.rows.length === 5 && parsed.errors.length === 1, `Unexpected parse result: ${JSON.stringify({ rows: parsed.rows.length, errors: parsed.errors })}`);

    const preview = expectStatus("Xem trước (không ghi dữ liệu)", await call("/api/admin/paid-enrollments/import", { session: manager, json: { rows: parsed.rows, dryRun: true } }), 200);
    assert(preview.summary.accountsCreated === 3 && preview.summary.errors === 2, `Unexpected preview: ${JSON.stringify(preview.summary)}`);
    assert(preview.results[4].message.includes("khớp nhiều khóa"), "An ambiguous course name should be reported.");
    const noUsersYet = (await db.query("SELECT COUNT(*)::int AS count FROM users WHERE email = ANY($1)", [students.map(item => item.email)])).rows[0].count;
    assert(noUsersYet === 0, "A dry run must not create accounts.");

    const imported = expectStatus("Nhập thật: tạo tài khoản + ghi danh đã thanh toán", await call("/api/admin/paid-enrollments/import", { session: manager, json: { rows: parsed.rows, defaultPassword: DEFAULT_PASSWORD, sendAccountEmail: true } }), 200);
    assert(imported.summary.accountsCreated === 3 && imported.summary.enrollmentsCreated === 3 && imported.summary.errors === 2, `Unexpected import: ${JSON.stringify(imported.summary)}`);
    assert(imported.results.slice(0, 3).every((row: any) => row.status === "created" && row.accountEmail), "Each new learner should get the account email.");
    const enrollmentRows = (await db.query(
      `SELECT e.id, e.status, u.email, u.must_change_password, u.signup_source, t.status AS tx_status, t.amount
       FROM enrollments e JOIN users u ON u.id = e.student_id
       LEFT JOIN transactions t ON t.student_id = e.student_id AND t.course_id = e.course_id
       WHERE u.email = ANY($1) ORDER BY u.email`,
      [students.map(item => item.email)]
    )).rows;
    assert(enrollmentRows.length === 3 && enrollmentRows.every(row => row.status === "pending" && row.tx_status === "approved" && row.must_change_password && row.signup_source === "crm"),
      `Imported enrollments should be paid and waiting for placement: ${JSON.stringify(enrollmentRows)}`);
    console.log("  ✓ Ghi danh ở trạng thái chờ xếp lớp, giao dịch đã duyệt, bắt đổi mật khẩu");

    const again = expectStatus("Nhập lại cùng bảng không tạo trùng", await call("/api/admin/paid-enrollments/import", { session: manager, json: { rows: parsed.rows, defaultPassword: DEFAULT_PASSWORD } }), 200);
    assert(again.summary.accountsCreated === 0 && again.summary.enrollmentsCreated === 0 && again.summary.skipped === 3, `Re-import should skip: ${JSON.stringify(again.summary)}`);

    console.log("6. Học viên: tài khoản trống cho tới khi được xếp lớp");
    const firstLogin = await login(students[0].email, DEFAULT_PASSWORD);
    assert(firstLogin.user.mustChangePassword === true, "Imported learner must change the default password.");
    const locked = expectStatus("Chưa đổi mật khẩu thì chưa dùng được", await call("/api/store", { session: firstLogin }), 403);
    assert(locked.code === "PASSWORD_CHANGE_REQUIRED", "Expected PASSWORD_CHANGE_REQUIRED.");
    expectStatus("Tự đổi mật khẩu", await call("/api/users/change-password", { session: firstLogin, json: { currentPassword: DEFAULT_PASSWORD, newPassword: "HocVien@12345" } }), 200);
    const student = await login(students[0].email, "HocVien@12345");
    const emptyStore = expectStatus("Học viên tải dữ liệu", await call("/api/store", { session: student }), 200);
    assert(emptyStore.courseSections.length === 0 && emptyStore.attendanceSessions.length === 0 && emptyStore.sessionMaterials.length === 0, "No class may show before placement.");
    assert(emptyStore.courses.every((item: any) => item.id === course.id), "Direct sale must not expose the catalogue to learners.");
    expectStatus("Không tự ghi danh được", await call("/api/enrollments/register", { session: student, json: { courseId: course.id } }), 403);
    expectStatus("Chưa xếp lớp thì chưa xem tài liệu mở đầu", await call(`/api/courses/${course.id}/intro-materials`, { session: student }), 403);

    console.log("7. Xếp lớp và email xếp lớp");
    const pending = enrollmentRows.map(row => row.id);
    const full = expectStatus("Lớp 2 chỗ không nhận 3 học viên", await call("/api/admin/enrollments/bulk-place", { session: manager, json: { placements: pending.map(enrollmentId => ({ enrollmentId, sectionId: section.id })) } }), 400);
    assert(full.errors?.length === 1, "Exactly one placement should exceed the capacity.");
    const placed = expectStatus("Xếp 2 học viên vào lớp", await call("/api/admin/enrollments/bulk-place", { session: manager, json: { placements: pending.slice(0, 2).map(enrollmentId => ({ enrollmentId, sectionId: section.id })) } }), 200);
    assert(placed.placed === 2 && placed.emails.sent + placed.emails.mock === 2 && placed.emails.failed === 0, `Placement emails should go out: ${JSON.stringify(placed)}`);
    const seats = (await db.query("SELECT placement_email_status, placement_email_at FROM course_registrations WHERE section_id = $1 AND status = 'registered'", [section.id])).rows;
    assert(seats.length === 2 && seats.every(row => row.placement_email_status && row.placement_email_at), "Each seat should record its placement email.");
    const repeat = expectStatus("Xếp lại cùng lớp không gửi email lần nữa", await call("/api/admin/enrollments/bulk-place", { session: manager, json: { placements: pending.slice(0, 2).map(enrollmentId => ({ enrollmentId, sectionId: section.id })) } }), 200);
    assert(repeat.placed === 0 && repeat.unchanged === 2 && repeat.notices.length === 0, `Unchanged placements must not email again: ${JSON.stringify(repeat)}`);
    const resent = expectStatus("Gửi lại email xếp lớp theo yêu cầu", await call("/api/admin/placements/resend-email", { session: manager, json: { items: [{ studentId: student.user.id, sectionId: section.id }] } }), 200);
    assert(resent.emails.sent + resent.emails.mock === 1, "Resend should deliver one email.");

    console.log("8. Nội dung lớp: tài liệu mở đầu, slide, data, bài tập");
    const sessions = (await db.query("SELECT id, topic FROM attendance_sessions WHERE section_id = $1 ORDER BY date", [section.id])).rows;
    assert(sessions.length === 4, `The class should have 4 generated sessions, got ${sessions.length}.`);
    const sessionId = sessions[0].id;
    const upload = (path: string, form: FormData, session = manager) => call(path, { session, body: form });
    const slidePdf = expectStatus("Tải slide PDF", await upload(`/api/sessions/${sessionId}/materials`, fileForm({ type: "slide", title: "Slide buổi 1" }, "buoi-1.pdf", TINY_PDF, "application/pdf")), 201);
    const slidePptx = expectStatus("Tải slide PPTX (cảnh báo cần PDF)", await upload(`/api/sessions/${sessionId}/materials`, fileForm({ type: "slide" }, "buoi-1.pptx", "pptx-bytes", "application/vnd.openxmlformats-officedocument.presentationml.presentation")), 201);
    assert(slidePptx.warning, "A non-PDF slide should come back with a warning.");
    const dataCsv = expectStatus("Tải file data", await upload(`/api/sessions/${sessionId}/materials`, fileForm({ type: "data" }, "don-hang.csv", "id,amount\n1,100\n", "text/csv")), 201);
    assert(dataCsv.type === "data", "CSV should be stored as data.");
    const legacy = expectStatus("File Excel gửi kiểu cũ (document) tự chuyển thành data", await upload(`/api/sessions/${sessionId}/materials`, fileForm({ type: "document" }, "bang-tinh.xlsx", "xlsx-bytes", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")), 201);
    assert(legacy.type === "data", "A spreadsheet uploaded as document should become data.");
    expectStatus("Slide không nhận file Excel", await upload(`/api/sessions/${sessionId}/materials`, fileForm({ type: "slide" }, "sai.xlsx", "x", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")), 400);
    const homework = expectStatus("Tạo bài tập về nhà cho buổi 1", await call("/api/assignments", { session: manager, json: { courseId: course.id, sessionId, title: "Bài tập buổi 1", description: "Dựng workflow đầu tiên.", deadline: "2026-10-15T23:59", maxScore: 10, type: "lesson" } }), 201);
    expectStatus("Lưu thư chúc mừng", await call(`/api/courses/${course.id}/welcome-letter`, { method: "PUT", session: manager, json: { welcomeLetter: "Chào {{ten_hoc_vien}}, mừng bạn vào lớp {{ma_lop}}!" } }), 200);
    const draft = expectStatus("Soạn thư bằng AI (hoặc thư mẫu khi chưa có khóa AI)", await call(`/api/courses/${course.id}/welcome-letter/draft`, { session: manager, json: {} }), 200);
    assert(draft.letter && ["ai", "template"].includes(draft.source), "Draft should return a letter.");
    const reference = expectStatus("Tài liệu tham khảo (PDF)", await upload(`/api/courses/${course.id}/intro-materials`, fileForm({ category: "reference", type: "document", title: "Sách tham khảo" }, "sach.pdf", TINY_PDF, "application/pdf")), 201);
    const practice = expectStatus("Bài luyện tập (liên kết)", await call(`/api/courses/${course.id}/intro-materials`, { session: manager, json: { category: "practice", type: "link", title: "Bài luyện tập 1", url: "https://example.com/practice" } }), 201);

    console.log("9. Học viên đã xếp lớp: xem trực tuyến, chỉ tải file data");
    const classStore = expectStatus("Học viên tải lại dữ liệu", await call("/api/store", { session: student }), 200);
    const mySection = classStore.courseSections.find((item: any) => item.id === section.id);
    assert(mySection?.groupChatUrl === "https://zalo.me/g/e2e-class", "Placed learner should see the class and its Zalo link.");
    assert(classStore.attendanceSessions.length === 4, "Placed learner should see the class sessions.");
    assert(classStore.courses[0].welcomeLetter?.includes("{{ma_lop}}"), "Placed learner should receive the welcome letter template.");
    const openingIds = classStore.sessionMaterials.filter((item: any) => !item.sessionId).map((item: any) => item.id);
    assert(openingIds.includes(reference.id) && openingIds.includes(practice.id), "Opening materials should reach the placed learner.");
    assert(classStore.assignments.some((item: any) => item.id === homework.id), "Homework of the session should reach the learner.");
    assert(classStore.users.some((item: any) => item.id === teacher0.id), "Learner should see their class teacher.");

    const dl = (id: string, query = "", headers?: Record<string, string>) => call(`/api/materials/${id}/download${query}`, { session: student, headers });
    const dataDownload = expectStatus("Tải được file data", await dl(dataCsv.id), 200);
    assert(String(dataDownload).includes("id,amount"), "Data file content mismatch.");
    assert((await dl(slidePdf.id)).status === 403, "Learner must not download a slide.");
    console.log("  ✓ Không tải được slide");
    const directOpen = expectStatus("Mở thẳng địa chỉ slide trên trình duyệt bị chặn", await dl(slidePdf.id, "?inline=true"), 403);
    assert(directOpen.code === "VIEW_ONLY", "Expected VIEW_ONLY.");
    const viewed = await dl(slidePdf.id, "?inline=true", { "X-LMS-Viewer": "1" });
    expectStatus("Xem slide PDF trong trình xem của LMS", viewed, 200);
    assert(String(viewed.headers.get("content-disposition")).startsWith("inline") && viewed.headers.get("cache-control")?.includes("no-store"), "Viewer response should be inline and uncached.");
    const noPreview = expectStatus("Slide PPTX không phục vụ cho học viên", await dl(slidePptx.id, "?inline=true", { "X-LMS-Viewer": "1" }), 403);
    assert(noPreview.code === "VIEW_ONLY_NO_PREVIEW", "Expected VIEW_ONLY_NO_PREVIEW.");
    assert((await dl(reference.id)).status === 403, "Opening reference document must be view-only.");
    expectStatus("Xem tài liệu tham khảo trong trình xem", await dl(reference.id, "?inline=true", { "X-LMS-Viewer": "1" }), 200);
    const zip = await call(`/api/sessions/${sessionId}/materials/download-all`, { session: student });
    expectStatus("Gói ZIP của học viên chỉ gồm file data", zip, 200);
    assert(String(zip.headers.get("content-disposition")).includes("-data.zip"), "Learner bundle should be the data bundle.");
    expectStatus("Xem danh sách tài liệu mở đầu", await call(`/api/courses/${course.id}/intro-materials`, { session: student }), 200);

    // Staff keep full access.
    expectStatus("Quản lý lớp tải được slide gốc", await call(`/api/materials/${slidePptx.id}/download`, { session: manager }), 200);

    console.log("10. Học viên chưa xếp lớp vẫn không thấy gì");
    await login(students[2].email, DEFAULT_PASSWORD).then(async session => {
      expectStatus("Đổi mật khẩu học viên thứ ba", await call("/api/users/change-password", { session, json: { currentPassword: DEFAULT_PASSWORD, newPassword: "HocVien@12345" } }), 200);
    });
    const unplaced = await login(students[2].email, "HocVien@12345");
    const unplacedStore = expectStatus("Học viên chờ xếp lớp tải dữ liệu", await call("/api/store", { session: unplaced }), 200);
    assert(unplacedStore.courseSections.length === 0 && unplacedStore.sessionMaterials.length === 0 && !unplacedStore.courses[0]?.welcomeLetter, "Unplaced learner must not see class content.");
    expectStatus("Không xem được tài liệu buổi học", await call(`/api/sessions/${sessionId}/materials`, { session: unplaced }), 403);
    expectStatus("Không tải được file data của lớp khác", await call(`/api/materials/${dataCsv.id}/download`, { session: unplaced }), 403);

    console.log("11. Giảng viên phụ trách lớp");
    const teacher = await login(teacherEmail, "Teacher@12345");
    const teacherStore = expectStatus("Giảng viên tải dữ liệu", await call("/api/store", { session: teacher }), 200);
    assert(teacherStore.courses.some((item: any) => item.id === course.id), "Class teacher should see the course of their class.");
    assert(teacherStore.courseSections.length === 1 && teacherStore.courseSections[0].id === section.id, "Class teacher should see only their class.");
    assert(teacherStore.attendanceSessions.length === 4, "Class teacher should see only their class sessions.");
    assert(teacherStore.enrollments.length === 2, `Class teacher should see only their learners, got ${teacherStore.enrollments.length}.`);
    expectStatus("Giảng viên tải tài liệu cho lớp mình", await upload(`/api/sessions/${sessions[1].id}/materials`, fileForm({ type: "data" }, "buoi-2.csv", "a,b\n", "text/csv"), teacher), 201);
    expectStatus("Giảng viên giao bài tập cho buổi của lớp mình", await call("/api/assignments", { session: teacher, json: { courseId: course.id, sessionId: sessions[1].id, title: "Bài tập buổi 2", description: "Luyện tập.", deadline: "2026-10-19T23:59", maxScore: 10 } }), 201);
    const otherSession = (await db.query("SELECT id FROM attendance_sessions WHERE section_id <> $1 AND section_id IS NOT NULL LIMIT 1", [section.id])).rows[0];
    if (otherSession) {
      expectStatus("Giảng viên không sửa được lớp khác", await upload(`/api/sessions/${otherSession.id}/materials`, fileForm({ type: "data" }, "x.csv", "a\n", "text/csv"), teacher), 403);
    }

    console.log("\nHoàn tất: luồng direct sale chạy đúng từ nhập bảng tới học viên vào lớp.");
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
