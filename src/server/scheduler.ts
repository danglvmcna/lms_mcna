import { deliverPendingCrmEvents } from "./crm/crmOutbox";
import { pool } from "./db";
import { eventBus } from "./eventBus";

export function startScheduler() {
  setInterval(async () => {
    await runSchedulerTask("attendance alerts", checkAttendanceAlerts);
  }, 60 * 60 * 1000);

  setInterval(() => {
    void runSchedulerTask("crm outbox", async () => {
      await deliverPendingCrmEvents();
    });
  }, 30 * 1000);
}

async function runSchedulerTask(name: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error(`[scheduler] ${name} failed`, error);
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
