import dotenv from "dotenv";
import pg from "pg";
import { signCrmPayload } from "../src/server/crm/signature";

dotenv.config();

// End-to-end check of: public catalog -> self sign-up -> forced password change -> class registration
// -> CRM outbox + CRM API (payment confirmation, student upsert, enrollment) -> session materials.
// Needs a running server (E2E_BASE_URL) started with CRM_API_KEY / CRM_INBOUND_SECRET in a non-production
// NODE_ENV, and DATABASE_URL pointing at the same database (to inspect the CRM outbox).

type Session = { cookie: string; csrfToken: string; user: any };
type CallResult = { status: number; headers: Headers; data: any };

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3100";
const crmApiKey = process.env.CRM_API_KEY || "";
const crmInboundSecret = process.env.CRM_INBOUND_SECRET || "";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function call(
  path: string,
  options: { method?: string; session?: Session; json?: unknown; body?: BodyInit; headers?: Record<string, string>; redirect?: RequestRedirect } = {}
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
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body, redirect: options.redirect || "follow" });
  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // non-JSON responses (file downloads) keep the raw text
  }
  return { status: response.status, headers: response.headers, data };
}

function expectStatus(label: string, result: CallResult, expected: number | number[]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert(allowed.includes(result.status), `${label}: expected HTTP ${allowed.join("/")}, got ${result.status} ${JSON.stringify(result.data)}`);
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

async function crmCall(method: "GET" | "POST", path: string, payload?: unknown, options: { eventId?: string; secret?: string } = {}) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${crmApiKey}`,
    "X-CRM-Timestamp": timestamp,
    "X-CRM-Signature": `sha256=${signCrmPayload(options.secret ?? crmInboundSecret, timestamp, body)}`
  };
  if (body) headers["Content-Type"] = "application/json";
  if (options.eventId) headers["X-CRM-Event-Id"] = options.eventId;
  return call(`/api/integrations/crm${path}`, { method, headers, body: body || undefined });
}

async function main() {
  assert(crmApiKey && crmInboundSecret, "CRM_API_KEY and CRM_INBOUND_SECRET must be set to the values the server uses.");
  assert(process.env.DATABASE_URL, "DATABASE_URL is required to inspect the CRM outbox.");
  const stamp = Date.now();
  expectStatus("health", await call("/health"), 200);

  const academic = await login("academic@mcna.local", "academice16");
  const teacher = await login("teacher@mcna.local", "teachere16");

  console.log("1. Admin opens a paid course with a 3-session class");
  const course = expectStatus("create course", await call("/api/courses", {
    session: academic,
    json: {
      title: `E2E Signup CRM ${stamp}`,
      description: "Course created by the sign-up / CRM end-to-end test.",
      category: "E2E",
      price: 1500000,
      level: "Cơ bản",
      tags: ["e2e"],
      teacherId: teacher.user.id,
      numberOfLessons: 3
    }
  }), [200, 201]);
  if (course.status !== "published") {
    if (course.status === "draft") expectStatus("submit course", await call(`/api/courses/${course.id}/submit`, { method: "POST", session: teacher }), 200);
    expectStatus("publish course", await call(`/api/courses/${course.id}/publish`, { method: "POST", session: academic }), 200);
  }

  const adminStore = expectStatus("admin store", await call("/api/store", { session: academic }), 200);
  const semester = adminStore.semesters.find((item: any) => item.isCurrent) || adminStore.semesters[0];
  assert(semester, "no semester available");
  const openingDate = new Date().toISOString().slice(0, 10);
  const sectionPayload = {
    courseId: course.id,
    semesterId: semester.id,
    teacherId: teacher.user.id,
    sectionCode: `E2E-${stamp}`,
    maxStudents: 5,
    numberOfSessions: 3,
    openingDate,
    schedule: [{ dayOfWeek: "Chủ nhật", startTime: "05:00", endTime: "06:00", room: `E2E-${stamp}` }],
    status: "open"
  };
  const section = expectStatus("create class", await call("/api/course-sections", { session: academic, json: sectionPayload }), [200, 201]);

  console.log("2. Public catalog");
  const publicList = expectStatus("public course list", await call("/api/public/courses"), 200);
  assert(publicList.some((item: any) => item.id === course.id && item.openSectionCount >= 1), "new course missing from the public catalog");
  const publicDetail = expectStatus("public course detail", await call(`/api/public/courses/${course.id}`), 200);
  const publicSection = publicDetail.sections.find((item: any) => item.id === section.id);
  assert(publicSection?.sessions.length === 3 && publicSection.seatsLeft === 5, `public class detail is wrong: ${JSON.stringify(publicSection)}`);

  console.log("3. Self sign-up with a personal email");
  const email = `e2e.signup.${stamp}@example.com`;
  const signup = expectStatus("self register", await call("/api/auth/register", { json: { name: "Học viên E2E", email, phone: "0912345678" } }), 202);
  assert(signup.devTemporaryPassword, "temporary password not returned (server running with NODE_ENV=production?)");
  const again = expectStatus("register the same email again", await call("/api/auth/register", { json: { name: "Người khác", email, phone: "0912345678" } }), 202);
  assert(again.message === signup.message && !again.devTemporaryPassword, "a repeated sign-up must look identical and not leak a password");
  expectStatus("reject invalid phone", await call("/api/auth/register", { json: { name: "Sai số", email: `bad.${stamp}@example.com`, phone: "abc" } }), 400);

  console.log("4. Forced password change");
  const learner = await login(email, signup.devTemporaryPassword);
  assert(learner.user.mustChangePassword === true, "new account should require a password change");
  const blocked = await call("/api/store", { session: learner });
  assert(blocked.status === 403 && blocked.data?.code === "PASSWORD_CHANGE_REQUIRED", `store should be blocked, got ${blocked.status}`);
  console.log("  ✓ data APIs blocked until the password is changed");
  expectStatus("reject short new password", await call("/api/users/change-password", {
    session: learner,
    json: { currentPassword: signup.devTemporaryPassword, newPassword: "short" }
  }), 400);
  expectStatus("change temporary password", await call("/api/users/change-password", {
    session: learner,
    json: { currentPassword: signup.devTemporaryPassword, newPassword: `E2e-pass-${stamp}` }
  }), 200);
  const me = expectStatus("me after change", await call("/api/auth/me", { session: learner }), 200);
  assert(me.user.mustChangePassword === false, "must-change flag was not cleared");
  expectStatus("store unlocked", await call("/api/store", { session: learner }), 200);
  expectStatus("forgot password answers generically", await call("/api/auth/forgot-password", { json: { email } }), 200);

  console.log("5. Register for the class");
  const enrollment = expectStatus("register for class", await call("/api/enrollments/register", {
    session: learner,
    json: { courseId: course.id, sectionId: section.id }
  }), 201);
  assert(enrollment.status === "pending_payment" && enrollment.requestedSectionId === section.id, "paid registration should wait for payment and remember the class");
  expectStatus("duplicate registration rejected", await call("/api/enrollments/register", {
    session: learner,
    json: { courseId: course.id, sectionId: section.id }
  }), 409);

  console.log("6. CRM outbox");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const outbox = (await db.query(
      `SELECT event_type, payload FROM crm_outbox
       WHERE payload->'data'->>'email' = $1 OR payload->'data'->'student'->>'email' = $1
       ORDER BY created_at`,
      [email]
    )).rows;
    assert(outbox.some(row => row.event_type === "contact.registered"), "contact.registered was not queued");
    assert(
      outbox.some(row => row.event_type === "enrollment.requested" && row.payload.data.requestedSection?.id === section.id),
      "enrollment.requested was not queued with the requested class"
    );
    console.log("  ✓ contact.registered and enrollment.requested queued");
  } finally {
    await db.end();
  }

  console.log("7. CRM API");
  const crmCourses = expectStatus("CRM lists courses", await crmCall("GET", "/courses"), 200);
  assert(
    crmCourses.courses.some((item: any) => item.id === course.id && item.sections.some((cls: any) => cls.id === section.id)),
    "CRM course list is missing the class"
  );
  expectStatus("CRM request with wrong signature rejected", await crmCall("GET", "/courses", undefined, { secret: "wrong-secret" }), 401);

  const confirmBody = { enrollmentId: enrollment.id, amount: 1500000, reference: `E2E-${stamp}` };
  const confirmEventId = `e2e-confirm-${stamp}`;
  const confirmed = expectStatus("CRM confirms payment", await crmCall("POST", "/payments/confirm", confirmBody, { eventId: confirmEventId }), 200);
  assert(confirmed.status === "active" && confirmed.placedSectionId === section.id, `payment confirmation should place the requested class: ${JSON.stringify(confirmed)}`);
  const replay = await crmCall("POST", "/payments/confirm", confirmBody, { eventId: confirmEventId });
  assert(replay.status === 200 && replay.headers.get("x-idempotent-replay") === "true", `replay was not idempotent: ${replay.status}`);
  console.log("  ✓ replayed call answered from the idempotency log");
  expectStatus("event id reused with another body", await crmCall("POST", "/payments/confirm", { ...confirmBody, amount: 1 }, { eventId: confirmEventId }), 409);

  const contactId = `E2E-C-${stamp}`;
  const crmEmail = `e2e.crm.${stamp}@example.com`;
  const crmStudent = expectStatus("CRM creates student", await crmCall("POST", "/students", {
    crmContactId: contactId,
    name: "Học viên CRM",
    email: crmEmail,
    phone: "0987654321"
  }, { eventId: `e2e-student-${stamp}` }), 201);
  const crmStudentAgain = expectStatus("CRM student upsert is stable", await crmCall("POST", "/students", {
    crmContactId: contactId,
    name: "Học viên CRM",
    email: crmEmail
  }, { eventId: `e2e-student-again-${stamp}` }), 200);
  assert(crmStudentAgain.lmsUserId === crmStudent.lmsUserId && crmStudentAgain.created === false, "CRM student upsert created a duplicate");
  const crmEnrollment = expectStatus("CRM enrolls student", await crmCall("POST", "/enrollments", {
    crmContactId: contactId,
    courseId: course.id,
    sectionId: section.id,
    crmDealId: `E2E-D-${stamp}`
  }, { eventId: `e2e-enroll-${stamp}` }), 201);
  assert(crmEnrollment.status === "pending_payment" && crmEnrollment.requestedSectionId === section.id, "CRM enrollment has the wrong state");

  console.log("8. Session materials");
  const teacherStore = expectStatus("teacher store", await call("/api/store", { session: teacher }), 200);
  const sessions = teacherStore.attendanceSessions
    .filter((item: any) => item.sectionId === section.id)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  assert(sessions.length === 3, `expected 3 generated sessions, got ${sessions.length}`);
  const [firstSession, secondSession] = sessions;

  const video = expectStatus("teacher adds YouTube video", await call(`/api/sessions/${firstSession.id}/materials`, {
    session: teacher,
    json: { type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", title: "Video buổi 1" }
  }), 201);
  assert(video.url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", `YouTube link not normalized: ${video.url}`);
  expectStatus("reject non-YouTube link", await call(`/api/sessions/${firstSession.id}/materials`, {
    session: teacher,
    json: { type: "youtube", url: "https://example.com/video" }
  }), 400);

  const docForm = new FormData();
  docForm.append("type", "document");
  docForm.append("file", new Blob([Buffer.from("PK e2e docx placeholder")], { type: "application/octet-stream" }), "Bài đọc buổi 1.docx");
  const doc = expectStatus("teacher uploads docx", await call(`/api/sessions/${firstSession.id}/materials`, { session: teacher, body: docForm }), 201);
  assert(doc.fileName === "Bài đọc buổi 1.docx", `file name not preserved: ${doc.fileName}`);

  const badForm = new FormData();
  badForm.append("type", "slide");
  badForm.append("file", new Blob([Buffer.from("MZ")], { type: "application/octet-stream" }), "slides.exe");
  expectStatus("reject disallowed file type", await call(`/api/sessions/${firstSession.id}/materials`, { session: teacher, body: badForm }), 400);

  expectStatus("teacher adds a link to session 2", await call(`/api/sessions/${secondSession.id}/materials`, {
    session: teacher,
    json: { type: "link", url: "https://example.com/tai-lieu", title: "Tài liệu tham khảo" }
  }), 201);

  const learnerStore = expectStatus("learner store", await call("/api/store", { session: learner }), 200);
  const visibleMaterials = (learnerStore.sessionMaterials || []).filter((item: any) => item.sessionId === firstSession.id);
  assert(visibleMaterials.length === 2 && visibleMaterials.every((item: any) => !("storagePath" in item)), "learner should see both session 1 materials, without storage paths");
  const download = await call(`/api/materials/${doc.id}/download`, { session: learner, redirect: "manual" });
  assert([200, 302].includes(download.status), `learner download failed: ${download.status}`);
  console.log("  ✓ placed learner can download");
  const outsider = await login("student@mcna.local", "studente16");
  expectStatus("student outside the class cannot download", await call(`/api/materials/${doc.id}/download`, { session: outsider, redirect: "manual" }), 403);

  console.log("9. Class shrink guard");
  expectStatus("cannot drop sessions that hold materials", await call(`/api/course-sections/${section.id}`, {
    method: "PUT",
    session: academic,
    json: { ...sectionPayload, numberOfSessions: 1 }
  }), 409);

  console.log(JSON.stringify({ ok: true, courseId: course.id, sectionId: section.id, learnerEmail: email, enrollmentId: enrollment.id }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
