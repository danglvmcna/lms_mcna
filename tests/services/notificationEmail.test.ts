import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsRepository } from "../../src/server/repositories/notifications";
import { sendEmailDirect } from "../../src/server/services/email";
import { provisioningService } from "../../src/server/emailProvisioning/provisioningService";

vi.mock("../../src/server/services/email", () => ({ sendEmailDirect: vi.fn().mockResolvedValue(undefined), sendEmailNotification: vi.fn() }));
vi.mock("../../src/server/emailProvisioning/provisioningService", () => ({ provisioningService: { sendNotificationEmail: vi.fn().mockResolvedValue(undefined) } }));

const database = (provisioned: boolean) => ({
  query: vi.fn().mockImplementation(async (sql: string) => ({ rows: sql.startsWith("SELECT") ? [{ email: "learner@example.com", name: "Learner", role: "student", email_provisioned: provisioned }] : [] }))
});

describe("notification email dispatch", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps an inbox entry without emailing twice after a dedicated workflow email", async () => {
    const db = database(true);
    await notificationsRepository.create(db as any, { userId: "learner", message: "Placed", emailFallback: true, skipEmail: true });
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(provisioningService.sendNotificationEmail).not.toHaveBeenCalled();
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });
  it("still sends ordinary notifications to a provisioned school mailbox", async () => {
    await notificationsRepository.create(database(true) as any, { userId: "learner", message: "New discussion" });
    expect(provisioningService.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });
  it("retains important-news fallback to an unprovisioned student's registered email", async () => {
    await notificationsRepository.create(database(false) as any, { userId: "learner", message: "Approved", emailFallback: true });
    expect(sendEmailDirect).toHaveBeenCalledWith("learner@example.com", "Learner", "Approved");
    expect(provisioningService.sendNotificationEmail).not.toHaveBeenCalled();
  });
});
