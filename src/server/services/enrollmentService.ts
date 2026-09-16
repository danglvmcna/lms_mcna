import { Enrollment } from "../../types";
import { enqueueEnrollmentEvent } from "../crm/crmOutbox";
import { pool, Queryable } from "../db";
import { generateId } from "../ids";
import { coursesRepository } from "../repositories/courses";
import { enrollmentsRepository } from "../repositories/enrollments";
import { financeRepository } from "../repositories/finance";

// Classes are not credit-bearing in the LMS; keep a single value for the legacy column.
const DEFAULT_REGISTRATION_CREDITS = 3;
import { sectionsRepository } from "../repositories/sections";

export type ServiceError = { error: string; status: number };
export type EnrollmentOrigin = "lms" | "crm";

export type RequestEnrollmentInput = {
  studentId: string;
  courseId: string;
  sectionId?: string;
  origin: EnrollmentOrigin;
  crmDealId?: string;
};

export type RequestEnrollmentResult = {
  enrollment: Enrollment;
  course: { id: string; title: string; price: number };
  section: { id: string; sectionCode: string } | null;
  transactionId?: string;
  registrationId?: string;
};

export type PlacementResult = { enrollment: any; registration: any | null };

export const isServiceError = (value: unknown): value is ServiceError =>
  Boolean(value && typeof value === "object" && "error" in value && "status" in value);

/**
 * Course registration shared by the student UI and the CRM integration.
 * A free course with a chosen class puts the student on that class's waitlist; a paid course creates a
 * pending payment transaction and remembers the chosen class so placement can be pre-filled.
 * Access is opened later by an admin placement or a CRM payment confirmation.
 */
export async function requestEnrollment(input: RequestEnrollmentInput): Promise<RequestEnrollmentResult | ServiceError> {
  const course = await coursesRepository.findById(pool, input.courseId);
  if (!course || course.status !== "published") return { error: "Published course not found.", status: 404 };
  if (await enrollmentsRepository.existsForCourse(pool, input.studentId, course.id)) {
    return { error: "Enrollment already exists.", status: 409 };
  }

  const price = Number(course.price || 0);
  const isPaid = price > 0;
  let section: any = null;
  if (input.sectionId) {
    section = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [input.sectionId])).rows[0];
    if (!section) return { error: "Selected class section not found.", status: 404 };
    if (section.course_id !== course.id) return { error: "Selected section does not belong to this course.", status: 400 };
    if (section.status !== "open") return { error: "Lớp học này hiện không mở đăng ký.", status: 400 };

    const registered = Number((await pool.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [section.id]
    )).rows[0].count);
    if (registered >= Number(section.max_students)) {
      return { error: "Lớp học phần này đã đạt sĩ số tối đa. Vui lòng chọn lớp khác.", status: 400 };
    }
    if (await sectionsRepository.conflictCheck(pool, input.studentId, section.id)) {
      return { error: "Lớp học phần này bị trùng lịch học với các lớp khác bạn đã đăng ký.", status: 400 };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const enrollment = await enrollmentsRepository.register(client, input.studentId, course.id, isPaid, {
      requestedSectionId: section?.id,
      crmDealId: input.crmDealId
    });

    let transactionId: string | undefined;
    if (isPaid) {
      transactionId = generateId("tx");
      await client.query(
        `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
        [
          transactionId,
          input.studentId,
          course.id,
          price,
          input.origin === "crm" ? "CRM MCNA" : "Chuyển khoản Ngân hàng (QR)",
          new Date().toISOString()
        ]
      );
    }

    let registrationId: string | undefined;
    if (section && !isPaid) {
      registrationId = generateId("reg");
      await client.query(
        `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
         VALUES ($1, $2, $3, 'waitlisted', $4, $5, false)`,
        [registrationId, input.studentId, section.id, new Date().toISOString(), DEFAULT_REGISTRATION_CREDITS]
      );
    }

    await enqueueEnrollmentEvent(client, "enrollment.requested", enrollment.id, input.origin);
    await client.query("COMMIT");
    return {
      enrollment,
      course: { id: course.id, title: course.title, price },
      section: section ? { id: section.id, sectionCode: section.section_code } : null,
      transactionId,
      registrationId
    };
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") return { error: "Enrollment already exists.", status: 409 };
    throw error;
  } finally {
    client.release();
  }
}

export async function hasConfirmedPaymentForCoursePlacement(db: Queryable, studentId: string, courseId: string): Promise<boolean> {
  const course = (await db.query("SELECT price FROM courses WHERE id = $1", [courseId])).rows[0];
  if (!course) return false;
  if (Number(course.price || 0) <= 0) return true;

  const approvedPayment = (await db.query(
    `SELECT id
     FROM transactions
     WHERE student_id = $1
       AND course_id = $2
       AND status = 'approved'
     LIMIT 1`,
    [studentId, courseId]
  )).rows[0];
  return Boolean(approvedPayment);
}

/**
 * Activates an enrollment whose payment is settled and, when a class is given, seats the student in it.
 * Must run inside the caller's transaction; on a ServiceError the caller rolls back.
 */
export async function placeEnrollment(
  client: Queryable,
  enrollmentId: string,
  sectionId: string | undefined,
  origin: EnrollmentOrigin
): Promise<PlacementResult | ServiceError> {
  const enrollmentRow = (await client.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [enrollmentId])).rows[0];
  if (!enrollmentRow) return { error: "Enrollment not found.", status: 404 };
  if (!await hasConfirmedPaymentForCoursePlacement(client, enrollmentRow.student_id, enrollmentRow.course_id)) {
    return { error: "Payment must be confirmed before class placement.", status: 400 };
  }
  const enrollment = (await client.query(
    "UPDATE enrollments SET status = 'active' WHERE id = $1 RETURNING *",
    [enrollmentId]
  )).rows[0];

  let registration = null;
  if (sectionId) {
    const section = (await client.query("SELECT * FROM course_sections WHERE id = $1 FOR UPDATE", [sectionId])).rows[0];
    if (!section) return { error: "Course section not found.", status: 404 };
    if (section.course_id !== enrollment.course_id) return { error: "Selected section does not belong to this course.", status: 400 };

    const count = Number((await client.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    )).rows[0].count);
    if (count >= section.max_students) {
      return { error: "Lớp học phần này đã đạt sĩ số tối đa. Không thể xếp thêm học viên.", status: 400 };
    }

    const existingRegistration = (await client.query(
      `SELECT cr.id, cr.status
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = $1
         AND cs.course_id = $2
         AND cr.status IN ('registered', 'waitlisted')`,
      [enrollment.student_id, enrollment.course_id]
    )).rows[0];

    if (!existingRegistration) {
      registration = (await client.query(
        `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
         VALUES ($1, $2, $3, 'registered', $4, $5, false)
         RETURNING *`,
        [generateId("reg"), enrollment.student_id, sectionId, new Date().toISOString(), DEFAULT_REGISTRATION_CREDITS]
      )).rows[0];
    } else {
      registration = (await client.query(
        "UPDATE course_registrations SET section_id = $1, status = 'registered' WHERE id = $2 RETURNING *",
        [sectionId, existingRegistration.id]
      )).rows[0];
    }
  }

  await enqueueEnrollmentEvent(client, "enrollment.status_changed", enrollmentId, origin);
  return { enrollment, registration };
}

/**
 * Records a settled payment for a course enrollment. Idempotent: approves the pending transaction, or
 * creates an approved one when the payment happened outside the LMS, and does nothing if already paid.
 * Must run inside the caller's transaction.
 */
export async function confirmCoursePayment(
  client: Queryable,
  enrollmentId: string,
  input: { amount?: number; reference?: string; paidAt?: string },
  origin: EnrollmentOrigin
): Promise<{ transactionId: string | null } | ServiceError> {
  const enrollment = (await client.query(
    `SELECT e.*, COALESCE(c.price, 0) AS course_price
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.id = $1
     FOR UPDATE OF e`,
    [enrollmentId]
  )).rows[0];
  if (!enrollment) return { error: "Enrollment not found.", status: 404 };
  if (enrollment.status === "cancelled") return { error: "Enrollment was cancelled.", status: 409 };
  if (Number(enrollment.course_price) <= 0) return { transactionId: null };

  const existing = (await client.query(
    `SELECT id, status
     FROM transactions
     WHERE student_id = $1 AND course_id = $2 AND status IN ('approved', 'pending')
     ORDER BY (status = 'approved') DESC, created_at DESC
     LIMIT 1`,
    [enrollment.student_id, enrollment.course_id]
  )).rows[0];
  if (existing?.status === "approved") return { transactionId: existing.id };

  const note = `Payment confirmed via ${origin === "crm" ? "CRM MCNA" : "LMS"}${input.reference ? ` (ref: ${input.reference})` : ""}.`;
  let transactionId: string;
  if (existing) {
    const reviewed = await financeRepository.reviewTransaction(client, existing.id, "approved", null, note);
    if (!reviewed) return { error: "Transaction not found.", status: 404 };
    if ("error" in reviewed) return { error: reviewed.error, status: reviewed.status };
    transactionId = existing.id;
  } else {
    transactionId = generateId("tx");
    const paidAt = input.paidAt || new Date().toISOString();
    await client.query(
      `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at, processed_at, notes)
       VALUES ($1, $2, $3, $4, 'approved', $5, $6, $6, $7)`,
      [transactionId, enrollment.student_id, enrollment.course_id, input.amount ?? Number(enrollment.course_price), origin === "crm" ? "CRM MCNA" : "LMS", paidAt, note]
    );
    await client.query("UPDATE enrollments SET status = 'pending' WHERE id = $1 AND status = 'pending_payment'", [enrollmentId]);
  }

  await enqueueEnrollmentEvent(client, "enrollment.status_changed", enrollmentId, origin);
  return { transactionId };
}
