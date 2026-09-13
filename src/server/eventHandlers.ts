import { eventBus } from "./eventBus";
import { recalculateGPA } from "./gpaCalculator";
import { notifyAdvisorOf, notifyParentOf, notifyRole, notifyStudent, notifyUsers } from "./notify";
import { provisioningService } from "./emailProvisioning/provisioningService";
import { auditRepository } from "./repositories/audit";

export function registerEventHandlers() {
  eventBus.on("grade.saved", async ({ studentId, courseRegistrationId, grade }, pool) => {
    const { gpa, credits, attemptedCredits } = await recalculateGPA(pool, studentId);
    const profile = (await pool.query("SELECT program_id FROM student_profiles WHERE user_id = $1", [studentId])).rows[0];
    if (attemptedCredits === 0) {
      await pool.query("UPDATE academic_warnings SET is_resolved = true, resolved_at = $2 WHERE student_id = $1 AND type = 'low_gpa' AND is_resolved = false", [studentId, new Date().toISOString()]);
      await pool.query("UPDATE student_profiles SET academic_probation = false WHERE user_id = $1", [studentId]);
    } else if (gpa < 2.0) {
      await pool.query(
        `INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at)
         VALUES ($1,$2,'low_gpa',$3,false,$4)
         ON CONFLICT (student_id, type, COALESCE(course_id, '')) DO UPDATE
         SET message = EXCLUDED.message, is_resolved = false, resolved_at = null, resolved_by = null`,
        [`warning_low_gpa_${studentId}`, studentId, `Điểm trung bình (GPA) dưới 2.0 (${gpa}).`, new Date().toISOString()]
      );
      await pool.query("UPDATE student_profiles SET academic_probation = true WHERE user_id = $1", [studentId]);
    } else {
      await pool.query("UPDATE academic_warnings SET is_resolved = true, resolved_at = $2 WHERE student_id = $1 AND type = 'low_gpa' AND is_resolved = false", [studentId, new Date().toISOString()]);
      await pool.query("UPDATE student_profiles SET academic_probation = false WHERE user_id = $1", [studentId]);
    }

    if (profile) {
      const program = (await pool.query("SELECT total_credits FROM programs WHERE id = $1", [profile.program_id])).rows[0];
      if (program && credits >= Number(program.total_credits) && gpa >= 2.0) {
        await eventBus.emit("program.completed", { studentId, programId: profile.program_id }, pool);
      }
    }
    await notifyStudent(pool, studentId, `Điểm số mới đã được công bố: ${grade}`, { relatedEntityType: "course_registration", relatedEntityId: courseRegistrationId });
    await notifyParentOf(pool, studentId, `Điểm số mới của học sinh đã được công bố: ${grade}`, { relatedEntityType: "course_registration", relatedEntityId: courseRegistrationId });
  });

  eventBus.on("attendance.session.saved", async ({ courseId, records }, pool) => {
    for (const { studentId } of records || []) {
      const totals = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE ar.status IN ('present','late','excused'))::int AS present
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = $2
         WHERE s.course_id = $1`,
        [courseId, studentId]
      );
      const total = Number(totals.rows[0]?.total || 0);
      const present = Number(totals.rows[0]?.present || 0);
      const attendancePct = total ? Math.round((present / total) * 100) : 100;
      const studentReg = (await pool.query(
        `SELECT cs.section_code 
         FROM course_registrations cr
         JOIN course_sections cs ON cs.id = cr.section_id
         WHERE cr.student_id = $1 AND cs.course_id = $2 AND cr.status = 'registered'
         LIMIT 1`,
        [studentId, courseId]
      )).rows[0];
      const sectionCode = studentReg ? studentReg.section_code : "";
      const sectionText = sectionCode ? ` lớp ${sectionCode}` : "";
      const warningMessage = `Tỷ lệ chuyên cần${sectionText} dưới 80% (${attendancePct}%).`;
      const existingWarning = (await pool.query(
        "SELECT id FROM academic_warnings WHERE student_id = $1 AND course_id = $2 AND type = 'low_attendance' AND is_resolved = false",
        [studentId, courseId]
      )).rows[0];

      if (attendancePct < 80) {
        await pool.query(
          `INSERT INTO academic_warnings (id, student_id, type, course_id, message, is_resolved, created_at)
           VALUES ($1,$2,'low_attendance',$3,$4,false,$5)
           ON CONFLICT (student_id, type, COALESCE(course_id, '')) DO UPDATE
           SET message = EXCLUDED.message, is_resolved = false, resolved_at = null, resolved_by = null`,
          [`warning_att_${studentId}_${courseId}`, studentId, courseId, warningMessage, new Date().toISOString()]
        );
        if (!existingWarning) {
          await notifyStudent(pool, studentId, `Cảnh báo chuyên cần: Tỷ lệ đi học${sectionText} dưới 80% (${attendancePct}%).`, { relatedEntityType: "course", relatedEntityId: courseId });
          await notifyAdvisorOf(pool, studentId, `Học sinh được phân công có tỷ lệ chuyên cần${sectionText} dưới 80% (${attendancePct}%).`, { relatedEntityType: "course", relatedEntityId: courseId });
          await notifyParentOf(pool, studentId, `Cảnh báo chuyên cần của con em: Tỷ lệ đi học${sectionText} dưới 80% (${attendancePct}%).`, { relatedEntityType: "course", relatedEntityId: courseId });
        }
      }
      if (attendancePct < 60) {
        await pool.query(
          `UPDATE course_registrations cr
           SET exam_ban = true
           FROM course_sections cs
           WHERE cs.id = cr.section_id AND cr.student_id = $1 AND cs.course_id = $2`,
          [studentId, courseId]
        );
        if (!existingWarning) {
          await notifyRole(pool, "admin", "Một học sinh đã bị cấm thi do không đạt đủ tỷ lệ chuyên cần.", { relatedEntityType: "course", relatedEntityId: courseId });
        }
      } else {
        await pool.query(
          `UPDATE course_registrations cr
           SET exam_ban = false
           FROM course_sections cs
           WHERE cs.id = cr.section_id AND cr.student_id = $1 AND cs.course_id = $2 AND cr.exam_ban = true`,
          [studentId, courseId]
        );
      }
      if (attendancePct >= 80) {
        await pool.query("UPDATE academic_warnings SET is_resolved = true, resolved_at = $3 WHERE student_id = $1 AND course_id = $2 AND type = 'low_attendance'", [studentId, courseId, new Date().toISOString()]);
      }
    }
  });

  eventBus.on("tuition.overdue", async ({ feeId, studentId }, pool) => {
    const hadUnresolvedWarning = Boolean((await pool.query(
      "SELECT 1 FROM academic_warnings WHERE student_id = $1 AND type = 'unpaid_fee' AND is_resolved = false LIMIT 1",
      [studentId]
    )).rowCount);

    await pool.query(
      `INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at)
       VALUES ($1,$2,'unpaid_fee','Học phí học phần đã quá hạn thanh toán.',false,$3)
       ON CONFLICT (student_id, type, COALESCE(course_id, '')) DO UPDATE
       SET message = EXCLUDED.message, is_resolved = false, resolved_at = null, resolved_by = null`,
      [`warning_fee_${studentId}`, studentId, new Date().toISOString()]
    );
    await pool.query("UPDATE student_profiles SET fee_hold = true WHERE user_id = $1", [studentId]);

    if (!hadUnresolvedWarning) {
      await notifyStudent(pool, studentId, "Học phí đã quá hạn thanh toán.", { relatedEntityType: "tuition_fee", relatedEntityId: feeId });
      await notifyParentOf(pool, studentId, "Học phí của con em đã quá hạn thanh toán.", { relatedEntityType: "tuition_fee", relatedEntityId: feeId });
      await notifyRole(pool, "admin", "Một khoản học phí của học viên đã quá hạn thanh toán.", { relatedEntityType: "tuition_fee", relatedEntityId: feeId });
    }
  });

  eventBus.on("scholarship.approved", async ({ studentId, scholarshipId, semesterId }, pool) => {
    const scholarship = (await pool.query("SELECT * FROM scholarships WHERE id = $1", [scholarshipId])).rows[0];
    const fee = (await pool.query("SELECT * FROM tuition_fees WHERE student_id = $1 AND semester_id = $2 ORDER BY due_date DESC LIMIT 1", [studentId, semesterId])).rows[0];
    if (scholarship && fee) {
      const amount = Number(scholarship.amount || 0);
      const discount = Number(scholarship.discount_percent || 0);
      const reduction = amount || (Number(fee.amount) * discount) / 100;
      await pool.query("UPDATE tuition_fees SET amount = GREATEST(0, amount - $1) WHERE id = $2", [reduction, fee.id]);
    }
    await notifyStudent(pool, studentId, "Đơn xin học bổng đã được phê duyệt.", { relatedEntityType: "scholarship", relatedEntityId: scholarshipId });
    await notifyParentOf(pool, studentId, "Đơn xin học bổng của con em đã được phê duyệt.", { relatedEntityType: "scholarship", relatedEntityId: scholarshipId });
  });

  eventBus.on("leave.approved", async ({ studentId, semesterId }, pool) => {
    const affected = await pool.query(
      `UPDATE course_registrations
       SET status = 'withdrawn', grade = 'W', letter_grade = 'W'
       WHERE student_id = $1 AND semester_id = $2 AND status = 'registered'
       RETURNING section_id`,
      [studentId, semesterId]
    );
    const teachers = await pool.query("SELECT DISTINCT teacher_id FROM course_sections WHERE id = ANY($1)", [affected.rows.map(row => row.section_id)]);
    await notifyUsers(pool, teachers.rows.map(row => row.teacher_id), { type: "info", message: "Yêu cầu xin nghỉ học/bảo lưu của học viên đã được phê duyệt và rút tên khỏi các lớp học phần." });
    await recalculateGPA(pool, studentId);
    await notifyStudent(pool, studentId, "Yêu cầu nghỉ học/bảo lưu đã được phê duyệt.");
    await notifyParentOf(pool, studentId, "Yêu cầu nghỉ học/bảo lưu của con em đã được phê duyệt.");
  });

  eventBus.on("program.completed", async ({ studentId }, pool) => {
    await pool.query(
      `INSERT INTO graduation_applications (id, student_id, status, applied_at)
       VALUES ($1,$2,'eligible',$3)
       ON CONFLICT DO NOTHING`,
      [`grad_eligible_${studentId}`, studentId, new Date().toISOString()]
    );
    await notifyStudent(pool, studentId, "Bạn đã đủ điều kiện tốt nghiệp.");
    await notifyAdvisorOf(pool, studentId, "Học sinh được phân công đã đủ điều kiện tốt nghiệp.");
    await notifyRole(pool, "admin", "Có học sinh đủ điều kiện tốt nghiệp.");
    await notifyParentOf(pool, studentId, "Con em bạn đã đủ điều kiện tốt nghiệp.");
  });

  eventBus.on("user.created", async (user: any, pool) => {
    if (user.role !== "student") return;
    // Self-registered and CRM-created learners sign in with their personal email; no school mailbox.
    if (user.signupSource && user.signupSource !== "admin") return;
    try {
      await provisioningService.provisionStudentEmail(pool, user.id);
    } catch (err: any) {
      console.error("[email-provisioning] failed for", user.id, err);
      try {
        await auditRepository.log(
          pool,
          user.id,
          "email_provisioning_failed",
          "email",
          String(err.message || err)
        );
      } catch (logErr) {
        console.error("[email-provisioning] failed to log audit error:", logErr);
      }
    }
  });
}
