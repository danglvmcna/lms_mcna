import { describe, expect, it } from "vitest";
import { schemas } from "../../src/server/validation";

const key = "6b95dfb7-d453-446e-a68b-a80293aa11b2";

describe("admin notification validation", () => {
  it("requires one explicit audience and a retry key", () => {
    expect(schemas.adminNotification.safeParse({ idempotencyKey: key, message: "Thông báo", role: "all" }).success).toBe(true);
    expect(schemas.adminNotification.safeParse({ idempotencyKey: key, message: "Thông báo" }).success).toBe(false);
    expect(schemas.adminNotification.safeParse({ idempotencyKey: key, message: "Thông báo", role: "all", userIds: ["user_1"] }).success).toBe(false);
    expect(schemas.adminNotification.safeParse({ message: "Thông báo", role: "all" }).success).toBe(false);
  });

  it("rejects empty or excessive messages and unsupported types", () => {
    expect(schemas.adminNotification.safeParse({ idempotencyKey: key, message: "   ", role: "student" }).success).toBe(false);
    expect(schemas.adminNotification.safeParse({ idempotencyKey: key, message: "x".repeat(2001), role: "student" }).success).toBe(false);
    expect(schemas.adminNotification.safeParse({ idempotencyKey: key, message: "Thông báo", type: "script", role: "student" }).success).toBe(false);
  });
});
