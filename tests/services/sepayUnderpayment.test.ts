import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  event: null as null | { transaction_id: string; status: string; error: string; processing_status: string },
  calls: [] as Array<{ sql: string; params?: unknown[] }>,
  released: false
}));

vi.mock("../../src/server/db", () => {
  const query = async (sql: string, params?: unknown[]) => {
    fake.calls.push({ sql, params });
    if (sql.includes("SELECT event_id, transaction_id, status, error, processing_status")) return { rows: fake.event ? [fake.event] : [] };
    if (sql.includes("FROM transactions t") && sql.includes("t.id ILIKE $1")) return { rows: [{
      id: "tx_a1b2c3d4", student_id: "user_learner", course_id: "course_1", amount: 1000000,
      status: "pending", enrollment_id: "enroll_1", requested_section_id: null,
      enrollment_status: "pending_payment", course_title: "Power BI"
    }] };
    if (sql.includes("INSERT INTO payment_webhook_events")) {
      fake.event = { transaction_id: "tx_a1b2c3d4", status: "rejected", error: "amount_mismatch", processing_status: "processed" };
      return { rowCount: 1, rows: [{ event_id: "sepay_123" }] };
    }
    if (sql.includes("SELECT id FROM users WHERE role IN ('admin', 'manager')")) return { rows: [{ id: "user_admin" }] };
    return { rows: [], rowCount: 1 };
  };
  return { pool: { query, connect: async () => ({ query, release: () => { fake.released = true; } }) } };
});

import { processSepayWebhook } from "../../src/server/services/sepayService";

describe("SePay underpayment policy", () => {
  beforeEach(() => {
    fake.event = null;
    fake.calls = [];
    fake.released = false;
  });

  it("keeps the order pending, records one review event and never asks for a top-up", async () => {
    const payload = { id: 123, content: "tx_a1b2c3d4", transferType: "in", transferAmount: 500000 };
    const first = await processSepayWebhook(payload, JSON.stringify(payload));
    expect(first).toMatchObject({ success: true, matched: true, underpaid: true, transactionId: "tx_a1b2c3d4" });
    expect(first.message).toContain("đối soát thủ công");
    expect(fake.calls.some(call => call.sql.includes("UPDATE transactions SET notes"))).toBe(true);
    expect(fake.calls.some(call => call.sql.includes("UPDATE transactions SET status"))).toBe(false);
    const notices = fake.calls.filter(call => call.sql.includes("INSERT INTO notifications"));
    expect(notices).toHaveLength(2);
    expect(String(notices[0].params?.[2])).toContain("không tự chuyển thêm");
    expect(fake.released).toBe(true);

    const second = await processSepayWebhook(payload, JSON.stringify(payload));
    expect(second).toMatchObject({ duplicate: true, underpaid: true });
    expect(fake.calls.filter(call => call.sql.includes("INSERT INTO notifications"))).toHaveLength(2);
  });

  it("rejects a non-positive amount before matching an order", async () => {
    const result = await processSepayWebhook({ id: 123, content: "tx_a1b2c3d4", transferType: "in", transferAmount: 0 }, "{}");
    expect(result.success).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});
