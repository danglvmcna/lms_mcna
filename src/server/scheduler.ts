import { deliverPendingCrmEvents } from "./crm/crmOutbox";
import { pool } from "./db";
import { checkAttendanceRisks } from "./services/attendanceRisk";

export function startScheduler() {
  setInterval(async () => {
    await runSchedulerTask("attendance risk scan", runAttendanceRiskJob);
  }, 60 * 60 * 1000);

  setInterval(() => {
    void runSchedulerTask("crm outbox", runCrmOutboxJob);
  }, 30 * 1000);
}

/** Returns the delivery stats so the cron endpoint can report them back to Vercel's job log. */
export async function runCrmOutboxJob() {
  return deliverPendingCrmEvents();
}

export async function runAttendanceRiskJob() {
  return checkAttendanceRisks(pool);
}

async function runSchedulerTask(name: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    console.error(`[scheduler] ${name} failed`, error);
  }
}
