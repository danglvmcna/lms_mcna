import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isPlaceholderSmtp,
  sendCourseRegistrationEmail,
  sendPaymentConfirmationEmail,
  sendEmailDirect,
  sendEmailNotification
} from "../../src/server/services/email";
import fs from "fs";
import path from "path";

describe("MCNA Email Service (email.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("isPlaceholderSmtp detects unconfigured or dummy SMTP credentials", () => {
    delete process.env.SMTP_USER;
    expect(isPlaceholderSmtp()).toBe(true);

    process.env.SMTP_USER = "your_email@gmail.com";
    expect(isPlaceholderSmtp()).toBe(true);

    process.env.SMTP_USER = "test@example.com";
    expect(isPlaceholderSmtp()).toBe(true);

    process.env.SMTP_USER = "admin@mcna.vn";
    process.env.SMTP_PASS = "your_app_password";
    expect(isPlaceholderSmtp()).toBe(true);

    process.env.SMTP_USER = "admin@mcna.vn";
    process.env.SMTP_PASS = "realSecretPass123";
    expect(isPlaceholderSmtp()).toBe(false);
  });

  it("sendCourseRegistrationEmail handles paid course without throwing", async () => {
    delete process.env.SMTP_USER;

    await expect(
      sendCourseRegistrationEmail({
        to: "student@mcna.vn",
        name: "Nguyễn Văn Test",
        courseTitle: "Lập trình Web Fullstack",
        sectionCode: "WEB-K01",
        price: 3500000,
        transactionId: "tx_1a2b3c4d",
        studentId: "user_9f8e7d"
      })
    ).resolves.not.toThrow();
  });

  it("sendCourseRegistrationEmail handles free course without throwing", async () => {
    delete process.env.SMTP_USER;

    await expect(
      sendCourseRegistrationEmail({
        to: "free_student@mcna.vn",
        name: "Lê Thị Miễn Phí",
        courseTitle: "Nhập môn Trí tuệ Nhân tạo",
        sectionCode: "AI-K01",
        price: 0,
        transactionId: null,
        studentId: "user_free123"
      })
    ).resolves.not.toThrow();
  });

  it("sendPaymentConfirmationEmail handles payment confirmation without throwing", async () => {
    delete process.env.SMTP_USER;

    await expect(
      sendPaymentConfirmationEmail({
        to: "student_paid@mcna.vn",
        name: "Trần Học Viên",
        courseTitle: "Khoa học Dữ liệu Cơ bản",
        amount: 5000000,
        transactionId: "tx_pay999",
        sectionCode: "DS-K10",
        teacherName: "ThS. Hoàng Minh"
      })
    ).resolves.not.toThrow();
  });

  it("sendEmailDirect logs mock email cleanly when SMTP is unconfigured", async () => {
    delete process.env.SMTP_USER;

    await expect(
      sendEmailDirect("notify@mcna.vn", "Học viên A", "Khóa học của bạn sẽ bắt đầu vào ngày mai.")
    ).resolves.not.toThrow();
  });
});
