import { Enrollment } from "../../types";
import { pool } from "../db";
import { generateId } from "../ids";
import { coursesRepository } from "../repositories/courses";
import { enrollmentsRepository } from "../repositories/enrollments";
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
      const creditsRow = (await client.query(
        "SELECT COALESCE(MAX(credits), 3) AS credits FROM program_courses WHERE course_id = $1",
        [course.id]
      )).rows[0];
      registrationId = generateId("reg");
      await client.query(
        `INSERT INTO course_registrations (id, student_id, section_id, semester_id, status, registered_at, credits, is_retake)
         VALUES ($1, $2, $3, $4, 'waitlisted', $5, $6, false)`,
        [registrationId, input.studentId, section.id, section.semester_id, new Date().toISOString(), Number(creditsRow?.credits || 3)]
      );
    }

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
