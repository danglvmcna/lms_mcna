import { deliverPendingCrmEvents } from "./crm/crmOutbox";

export function startScheduler() {
  setInterval(() => {
    void runSchedulerTask("crm outbox", runCrmOutboxJob);
  }, 30 * 1000);
}

/** Returns the delivery stats so the cron endpoint can report them back to Vercel's job log. */
export async function runCrmOutboxJob() {
  return deliverPendingCrmEvents();
}


async function runSchedulerTask(name: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    console.error(`[scheduler] ${name} failed`, error);
  }
}
