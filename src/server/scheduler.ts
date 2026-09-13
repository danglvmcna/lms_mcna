import { deliverPendingCrmEvents } from "./crm/crmOutbox";
import { pool } from "./db";
import { eventBus } from "./eventBus";
import { recalculateGPA } from "./gpaCalculator";

export function startScheduler() {
  setInterval(async () => {
    await runSchedulerTask("overdue fees", checkOverdueFees);
    await runSchedulerTask("attendance alerts", checkAttendanceAlerts);
    await runSchedulerTask("gpa warnings", checkGPAWarnings);
  }, 60 * 60 * 1000);

  setInterval(() => {
    void runSchedulerTask("crm outbox", async () => {
      await deliverPendingCrmEvents();
    });
  }, 30 * 1000);

  setTimeout(async () => {
    await runSchedulerTask("overdue fees", checkOverdueFees);
  }, 5000);
}

async function runSchedulerTask(name: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error(`[scheduler] ${name} failed`, error);
  }
}

async function checkOverdueFees() {
  const overdue = await pool.query(`
    SELECT id, student_id, semester_id FROM tuition_fees
    WHERE status != 'paid' AND due_date::date < NOW()::date
  `);
  for (const row of overdue.rows) {
    await eventBus.emit("tuition.overdue", { feeId: row.id, studentId: row.student_id, semesterId: row.semester_id }, pool);
  }
}

async function checkAttendanceAlerts() {
  const rows = await pool.query(`
    SELECT DISTINCT s.course_id, ar.student_id
    FROM attendance_sessions s
    JOIN attendance_records ar ON ar.session_id = s.id
  `);
  const byCourse = new Map<string, Array<{ studentId: string }>>();
  for (const row of rows.rows) {
    if (!byCourse.has(row.course_id)) byCourse.set(row.course_id, []);
    byCourse.get(row.course_id)!.push({ studentId: row.student_id });
  }
  for (const [courseId, records] of byCourse.entries()) {
    await eventBus.emit("attendance.session.saved", { courseId, records }, pool);
  }
}

async function checkGPAWarnings() {
  const students = await pool.query("SELECT user_id FROM student_profiles WHERE status = 'active'");
  for (const row of students.rows) {
    const studentId = row.user_id;
    const { gpa, attemptedCredits } = await recalculateGPA(pool, studentId);
    if (attemptedCredits === 0) {
      await pool.query(
        "UPDATE academic_warnings SET is_resolved = true, resolved_at = $2 WHERE student_id = $1 AND type = 'low_gpa' AND is_resolved = false",
        [studentId, new Date().toISOString()]
      );
      await pool.query("UPDATE student_profiles SET academic_probation = false WHERE user_id = $1", [studentId]);
      continue;
    }
    if (gpa < 2.0) {
      await pool.query(
        `INSERT INTO academic_warnings (id, student_id, type, message, is_resolved, created_at)
         VALUES ($1,$2,'low_gpa',$3,false,$4)
         ON CONFLICT (student_id, type, COALESCE(course_id, '')) DO UPDATE
         SET message = EXCLUDED.message, is_resolved = false, resolved_at = null, resolved_by = null`,
        [`warning_low_gpa_${studentId}`, studentId, `GPA is below 2.0 (${gpa}).`, new Date().toISOString()]
      );
      await pool.query("UPDATE student_profiles SET academic_probation = true WHERE user_id = $1", [studentId]);
    } else {
      await pool.query(
        "UPDATE academic_warnings SET is_resolved = true, resolved_at = $2 WHERE student_id = $1 AND type = 'low_gpa' AND is_resolved = false",
        [studentId, new Date().toISOString()]
      );
      await pool.query("UPDATE student_profiles SET academic_probation = false WHERE user_id = $1", [studentId]);
    }
  }
}
