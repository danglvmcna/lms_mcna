import { hashPassword } from "../../authHash";
import { EMAIL_PATTERN, matchCourse, PaidImportRow, PaidImportRowResult, PaidImportSummary } from "../../paidImport";
import { Course, User } from "../../types";
import { getSupportPhone } from "../config";
import { enqueueCrmEvent } from "../crm/crmOutbox";
import { pool } from "../db";
import { generateId } from "../ids";
import { courseFromRow, DbUserRow } from "../mappers";
import { auditRepository } from "../repositories/audit";
import { usersRepository } from "../repositories/users";
import { sendStudentAccountEmail } from "./email";
import { lookupCourseSchedules } from "./courseScheduleLookup";
import { confirmCoursePayment, isServiceError, requestEnrollment } from "./enrollmentService";

// Direct-sale intake: each row of the "paid customers" table (from the CRM or typed by hand) becomes a
// learner account (personal email + default password, changed at first sign-in) and a paid enrollment
// waiting for class placement. Re-importing the same table is safe: existing accounts and enrollments are kept.

export type PaidImportInput = {
  rows: PaidImportRow[];
  defaultPassword?: string;
  sendAccountEmail: boolean;
  dryRun: boolean;
  actorId: string;
  actorName: string;
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  pending: "chờ xếp lớp",
  active: "đang học",
  completed: "đã hoàn thành",
  pending_payment: "chờ thanh toán",
  cancelled: "đã hủy"
};

type Plan = {
  result: PaidImportRowResult;
  input: PaidImportRow;
  course?: Course;
  sectionId?: string;
  existingUser?: DbUserRow | null;
  existingEnrollment?: { id: string; status: string } | null;
};

async function planRow(input: PaidImportRow, index: number, courses: Course[]): Promise<Plan> {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const courseText = String(input.course || "").trim();
  const result: PaidImportRowResult = { row: index + 1, name, email, course: courseText, status: "error", accountCreated: false, message: "", warnings: [] };
  const plan: Plan = { result, input: { ...input, name, email, course: courseText } };

  if (!EMAIL_PATTERN.test(email)) return { ...plan, result: { ...result, message: "Email không hợp lệ." } };
  if (name.length < 2) return { ...plan, result: { ...result, message: "Thiếu họ tên." } };

  const match = matchCourse(courseText, courses);
  if (!match.course) {
    const message = "reason" in match && match.reason === "ambiguous"
      ? `Tên khóa học khớp nhiều khóa: ${match.candidates.map(course => course.title).join("; ")}. Hãy ghi rõ hơn.`
      : `Không tìm thấy khóa học "${courseText}" trên LMS.`;
    return { ...plan, result: { ...result, message } };
  }
  const course = match.course;
  if (input.crmRef && input.amount === undefined) result.warnings.push("CRM không phân bổ doanh thu cho từng khóa: khoản ghi nhận LMS dùng giá danh mục, không phải số tiền thực thu từng khóa. Cần đối soát riêng với CRM.");
  result.courseId = course.id;
  result.courseTitle = course.title;
  if (course.status !== "published") return { ...plan, course, result: { ...result, message: `Khóa học "${course.title}" chưa được mở trên LMS.` } };

  let sectionId: string | undefined;
  if (input.sectionCode) {
    const section = (await pool.query(
      "SELECT id, course_id, status FROM course_sections WHERE lower(section_code) = lower($1) LIMIT 1",
      [input.sectionCode.trim()]
    )).rows[0];
    if (!section) result.warnings.push(`Chưa có lớp "${input.sectionCode}" trên LMS; học viên sẽ được xếp lớp sau.`);
    else if (section.course_id !== course.id) result.warnings.push(`Lớp "${input.sectionCode}" không thuộc khóa này; học viên sẽ được xếp lớp sau.`);
    else if (section.status !== "open") result.warnings.push(`Lớp "${input.sectionCode}" hiện không mở; học viên sẽ được xếp lớp sau.`);
    else sectionId = section.id;
  }

  const existingUser = await usersRepository.findAuthByEmail(pool, email) as DbUserRow | null;
  if (existingUser && existingUser.role !== "student") {
    return { ...plan, course, result: { ...result, message: "Email này đang thuộc một tài khoản không phải học viên." } };
  }
  if (existingUser && !existingUser.is_active) {
    return { ...plan, course, result: { ...result, message: "Tài khoản học viên này đang bị khóa." } };
  }

  const existingEnrollment = existingUser
    ? (await pool.query("SELECT id, status FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1", [existingUser.id, course.id])).rows[0] || null
    : null;

  if (existingEnrollment && ["pending", "active", "completed"].includes(existingEnrollment.status)) {
    result.status = "skipped";
    result.enrollmentId = existingEnrollment.id;
    result.message = `Đã ghi danh khóa này (${ENROLLMENT_STATUS_LABEL[existingEnrollment.status]}); bỏ qua.`;
  } else {
    result.status = "ready";
    result.accountCreated = !existingUser;
    result.message = [
      existingUser ? "Đã có tài khoản" : "Tạo tài khoản mới",
      existingEnrollment?.status === "pending_payment" ? "xác nhận đã thanh toán cho đơn đang chờ" : "ghi danh đã thanh toán, chờ xếp lớp"
    ].join(" · ");
  }
  return { result, input: plan.input, course, sectionId, existingUser, existingEnrollment };
}

async function createStudentAccount(input: PaidImportRow, password: string): Promise<User> {
  const credential = hashPassword(password);
  const user: User = {
    id: generateId("user"),
    email: input.email,
    passwordHash: credential.hash,
    passwordSalt: credential.salt,
    name: input.name,
    role: "student",
    isActive: true,
    phone: input.phone || undefined,
    createdAt: new Date().toISOString()
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await usersRepository.create(client, user);
    // The default password is shared by the whole batch, so the learner must replace it at first sign-in.
    await client.query("UPDATE users SET must_change_password = true, signup_source = 'crm' WHERE id = $1", [user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await enqueueCrmEvent(pool, "contact.registered", {
    lmsUserId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    signupSource: "crm",
    crmContactId: null,
    createdAt: user.createdAt
  }, "crm");
  return user;
}

async function settleEnrollment(plan: Plan, studentId: string, actorName: string): Promise<{ enrollmentId: string; created: boolean } | { error: string }> {
  const course = plan.course!;
  let enrollmentId = plan.existingEnrollment?.id;
  let created = false;

  if (plan.existingEnrollment?.status === "cancelled") {
    // One enrollment row per learner and course: a cancelled one is reopened rather than duplicated.
    await pool.query(
      "UPDATE enrollments SET status = $2, enrolled_at = $3, completed_at = NULL WHERE id = $1",
      [enrollmentId, Number(course.price || 0) > 0 ? "pending_payment" : "pending", new Date().toISOString()]
    );
  } else if (!enrollmentId) {
    let requested = await requestEnrollment({ studentId, courseId: course.id, sectionId: plan.sectionId, origin: "crm" });
    if (isServiceError(requested) && requested.status === 400 && plan.sectionId) {
      plan.result.warnings.push(`Không giữ được chỗ ở lớp "${plan.input.sectionCode}": ${requested.error} Học viên sẽ được xếp lớp sau.`);
      requested = await requestEnrollment({ studentId, courseId: course.id, origin: "crm" });
    }
    if (isServiceError(requested)) return { error: requested.error };
    enrollmentId = requested.enrollment.id;
    created = true;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const alreadyPaid = Boolean((await client.query(
      "SELECT 1 FROM transactions WHERE student_id = $1 AND course_id = $2 AND status = 'approved' LIMIT 1",
      [studentId, course.id]
    )).rowCount);
    const payment = await confirmCoursePayment(
      client,
      enrollmentId!,
      { amount: plan.input.amount, reference: [plan.input.crmRef ? `CRM revenue ${plan.input.crmRef}` : "", plan.input.note, `bảng đã thanh toán, nhập bởi ${actorName}`].filter(Boolean).join(" · ") },
      "crm"
    );
    if (isServiceError(payment)) {
      await client.query("ROLLBACK");
      return { error: payment.error };
    }
    // The pending transaction carries the list price; keep the amount the table says was actually paid.
    if (!alreadyPaid && payment.transactionId && plan.input.amount !== undefined) {
      await client.query("UPDATE transactions SET amount = $1 WHERE id = $2", [plan.input.amount, payment.transactionId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { enrollmentId: enrollmentId!, created };
}

export async function importPaidEnrollments(input: PaidImportInput): Promise<{ results: PaidImportRowResult[]; summary: PaidImportSummary }> {
  const courses = (await pool.query("SELECT * FROM courses")).rows.map(courseFromRow);
  const summary: PaidImportSummary = {
    total: input.rows.length,
    accountsCreated: 0,
    enrollmentsCreated: 0,
    paymentsConfirmed: 0,
    skipped: 0,
    errors: 0,
    accountEmailsSent: 0,
    accountEmailsFailed: 0,
    accountEmailsNotSent: 0
  };
  const results: PaidImportRowResult[] = [];
  // Accounts receiving the notification email (both newly created and existing learners enrolled in courses)
  type AccountNotification = {
    user: { id: string; email: string; name: string; must_change_password?: boolean };
    isNew: boolean;
    courseTitles: string[];
    rows: PaidImportRowResult[];
  };
  const notifiedAccounts = new Map<string, AccountNotification>();
  // Emails that will get a new account earlier in this batch (used by the preview).
  const plannedNewEmails = new Set<string>();

  for (const [index, row] of input.rows.entries()) {
    let plan: Plan;
    try {
      plan = await planRow(row, index, courses);
    } catch (error: any) {
      results.push({ row: index + 1, name: row.name, email: row.email, course: row.course, status: "error", accountCreated: false, message: String(error?.message || error), warnings: [] });
      summary.errors++;
      continue;
    }
    const result = plan.result;
    results.push(result);

    if (result.status === "error") { summary.errors++; continue; }
    if (result.status === "skipped") {
      summary.skipped++;
      if (plan.existingUser && !notifiedAccounts.has(plan.input.email)) {
        notifiedAccounts.set(plan.input.email, {
          user: {
            id: plan.existingUser.id,
            email: plan.existingUser.email,
            name: plan.existingUser.name,
            must_change_password: Boolean(plan.existingUser.must_change_password)
          },
          isNew: false,
          courseTitles: [],
          rows: []
        });
      }
      const account = notifiedAccounts.get(plan.input.email);
      if (account && plan.course?.title) {
        account.courseTitles.push(plan.course.title);
        account.rows.push(result);
      }
      continue;
    }

    if (input.dryRun) {
      if (result.accountCreated) {
        if (plannedNewEmails.has(plan.input.email)) {
          result.accountCreated = false;
          result.message = result.message.replace("Tạo tài khoản mới", "Dùng tài khoản tạo ở dòng trên");
        } else {
          plannedNewEmails.add(plan.input.email);
          summary.accountsCreated++;
        }
      }
      if (plan.existingEnrollment?.status === "pending_payment") summary.paymentsConfirmed++;
      else summary.enrollmentsCreated++;
      continue;
    }

    try {
      let studentId = plan.existingUser?.id;
      if (!studentId) {
        const password = String(input.defaultPassword || "").trim() || "Mcna@2026";
        if (password.length < 8) throw new Error("Chưa có mật khẩu mặc định (tối thiểu 8 ký tự) để tạo tài khoản.");
        const user = await createStudentAccount(plan.input, password);
        studentId = user.id;
        summary.accountsCreated++;
        notifiedAccounts.set(user.email, { user, isNew: true, courseTitles: [], rows: [] });
      } else {
        result.accountCreated = false;
        if (plan.input.phone && !plan.existingUser?.phone) {
          await pool.query("UPDATE users SET phone = $1 WHERE id = $2", [plan.input.phone, studentId]);
        }
        if (!notifiedAccounts.has(plan.input.email) && plan.existingUser) {
          notifiedAccounts.set(plan.input.email, {
            user: {
              id: plan.existingUser.id,
              email: plan.existingUser.email,
              name: plan.existingUser.name,
              must_change_password: Boolean(plan.existingUser.must_change_password)
            },
            isNew: false,
            courseTitles: [],
            rows: []
          });
        }
      }

      const settled = await settleEnrollment(plan, studentId, input.actorName);
      if ("error" in settled) {
        result.status = "error";
        result.message = settled.error;
        summary.errors++;
        continue;
      }
      result.enrollmentId = settled.enrollmentId;
      result.status = result.accountCreated ? "created" : "linked";
      if (settled.created) summary.enrollmentsCreated++;
      else summary.paymentsConfirmed++;
      result.message = [
        result.accountCreated ? "Đã tạo tài khoản" : "Dùng tài khoản có sẵn",
        settled.created ? "đã ghi danh, chờ xếp lớp" : "đã xác nhận thanh toán, chờ xếp lớp"
      ].join(" · ");

      const account = notifiedAccounts.get(plan.input.email);
      if (account) {
        account.courseTitles.push(plan.course!.title);
        account.rows.push(result);
      }
    } catch (error: any) {
      result.status = "error";
      result.message = error?.code === "23505" ? "Email đã được dùng cho một tài khoản khác." : String(error?.message || error);
      summary.errors++;
    }
  }

  if (!input.dryRun && input.sendAccountEmail) {
    for (const account of notifiedAccounts.values()) {
      if (!account.courseTitles.length) continue;
      const courseTitles = Array.from(new Set(account.courseTitles));
      const courseSchedules = await lookupCourseSchedules(pool, courseTitles);
      const status = await sendStudentAccountEmail({
        to: account.user.email,
        name: account.user.name,
        password: account.isNew || account.user.must_change_password ? String(input.defaultPassword) : null,
        courseTitles,
        courseSchedules,
        supportPhone: getSupportPhone()
      });
      for (const row of account.rows) row.accountEmail = status;
      if (status === "failed") summary.accountEmailsFailed++;
      else if (status === "mock") summary.accountEmailsNotSent++;
      else summary.accountEmailsSent++;
      await auditRepository.log(pool, account.user.id, `student_account_email_${status}`, "email", `Gửi thông tin đăng nhập tới ${account.user.email}`);
    }
  }

  if (!input.dryRun) {
    await auditRepository.log(
      pool,
      input.actorId,
      "import_paid_enrollments",
      "enrollments",
      `Dòng: ${summary.total}; tài khoản mới: ${summary.accountsCreated}; ghi danh mới: ${summary.enrollmentsCreated}; xác nhận thanh toán: ${summary.paymentsConfirmed}; bỏ qua: ${summary.skipped}; lỗi: ${summary.errors}.`
    );
  }
  return { results, summary };
}
