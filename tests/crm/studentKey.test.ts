import { describe, it, expect } from "vitest";
import { normalizePhone } from "../../src/server/repositories/users";
import { schemas } from "../../src/server/validation";

describe("CRM Student Keys: Phone and Email Validation & Normalization", () => {
  describe("normalizePhone", () => {
    it("normalizes standard 10-digit Vietnamese phone numbers", () => {
      expect(normalizePhone("0912345678")).toBe("0912345678");
      expect(normalizePhone("0388123456")).toBe("0388123456");
    });

    it("normalizes +84 international format to standard 0-prefix format", () => {
      expect(normalizePhone("+84912345678")).toBe("0912345678");
      expect(normalizePhone("+84 912 345 678")).toBe("0912345678");
      expect(normalizePhone("84912345678")).toBe("0912345678");
    });

    it("strips spaces, dots, dashes, and parentheses", () => {
      expect(normalizePhone("0912.345.678")).toBe("0912345678");
      expect(normalizePhone("0912-345-678")).toBe("0912345678");
      expect(normalizePhone("(0912) 345 678")).toBe("0912345678");
      expect(normalizePhone(" 0912 345 678 ")).toBe("0912345678");
    });

    it("handles null and undefined gracefully", () => {
      expect(normalizePhone(null)).toBe("");
      expect(normalizePhone(undefined)).toBe("");
      expect(normalizePhone("")).toBe("");
    });
  });

  describe("schemas.crmUpsertStudent", () => {
    it("allows upserting student with phone and email without crmContactId", () => {
      const parsed = schemas.crmUpsertStudent.safeParse({
        name: "Nguyễn Văn A",
        email: "nguyenvana@gmail.com",
        phone: "0912345678"
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.email).toBe("nguyenvana@gmail.com");
        expect(parsed.data.phone).toBe("0912345678");
        expect(parsed.data.crmContactId).toBeUndefined();
      }
    });

    it("allows upserting student with crmContactId, phone, and email", () => {
      const parsed = schemas.crmUpsertStudent.safeParse({
        crmContactId: "C-9988",
        name: "Trần Thị B",
        email: "tranthib@gmail.com",
        phone: "+84988776655"
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.crmContactId).toBe("C-9988");
        expect(parsed.data.email).toBe("tranthib@gmail.com");
      }
    });

    it("rejects invalid email formats", () => {
      const parsed = schemas.crmUpsertStudent.safeParse({
        name: "Lê C",
        email: "invalid-email",
        phone: "0912345678"
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("schemas.crmCreateEnrollment", () => {
    it("allows enrollment identified by phone only", () => {
      const parsed = schemas.crmCreateEnrollment.safeParse({
        phone: "0912345678",
        courseId: "course-123"
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.phone).toBe("0912345678");
      }
    });

    it("allows enrollment identified by email only", () => {
      const parsed = schemas.crmCreateEnrollment.safeParse({
        email: "student@mcna.vn",
        courseId: "course-123"
      });
      expect(parsed.success).toBe(true);
    });

    it("allows enrollment identified by both phone and email", () => {
      const parsed = schemas.crmCreateEnrollment.safeParse({
        phone: "0912345678",
        email: "student@mcna.vn",
        courseId: "course-123"
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects when neither phone, email, nor crmContactId is provided", () => {
      const parsed = schemas.crmCreateEnrollment.safeParse({
        courseId: "course-123"
      });
      expect(parsed.success).toBe(false);
    });
  });
});
