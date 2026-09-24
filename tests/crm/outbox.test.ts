import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deliverPendingCrmEvents } from "../../src/server/crm/crmOutbox";

describe("CRM Outbox Delivery (crmOutbox.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("deliverPendingCrmEvents returns 0 sent/failed when CRM is unconfigured", async () => {
    delete process.env.CRM_WEBHOOK_URL;
    delete process.env.CRM_WEBHOOK_SECRET;

    const result = await deliverPendingCrmEvents();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("deliverPendingCrmEvents returns 0 sent/failed when only URL is configured without secret", async () => {
    process.env.CRM_WEBHOOK_URL = "https://crm.example.com/webhook";
    delete process.env.CRM_WEBHOOK_SECRET;

    const result = await deliverPendingCrmEvents();
    expect(result).toEqual({ sent: 0, failed: 0 });
  });
});
