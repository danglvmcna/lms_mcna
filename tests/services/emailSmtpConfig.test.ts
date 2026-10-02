import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "test" });
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport }, createTransport }));

// The account and class placement emails must use the same SMTP definition as the system status:
// with SMTP_USER and SMTP_PASS set, a missing SMTP_HOST means Gmail, not "email is not configured".
describe("one SMTP definition for the status screen and the direct-sale emails", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    sendMail.mockClear();
    createTransport.mockClear();
    process.env = { ...originalEnv };
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "TEST_RECEIVER_EMAIL", "GOOGLE_SERVICE_ACCOUNT_JSON"]) delete process.env[key];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  const account = { to: "an@gmail.com", name: "Nguyễn Văn An", password: "Mcna@2026", courseTitles: ["AI Automation"], supportPhone: "0939.866.825" };

  it("sends for real when only the user and password are set", async () => {
    process.env.SMTP_USER = "noreply.mcna@gmail.com";
    process.env.SMTP_PASS = "app-password-123";
    const { hasSmtpConfig } = await import("../../src/server/emailProvisioning/emailWorker");
    const { sendStudentAccountEmail } = await import("../../src/server/services/email");

    expect(hasSmtpConfig()).toBe(true);
    expect(await sendStudentAccountEmail(account)).toBe("sent");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "an@gmail.com" });
  }, 15000);

  it("uses the configured host for a non-Gmail mailbox", async () => {
    process.env.SMTP_HOST = "mail.mcna.vn";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "noreply@mcna.vn";
    process.env.SMTP_PASS = "mailbox-password";
    const { sendStudentAccountEmail } = await import("../../src/server/services/email");

    expect(await sendStudentAccountEmail(account)).toBe("sent");
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "mail.mcna.vn", port: 465, secure: true }));
  });

  it("reports the email as not sent when there are no credentials, in agreement with the status", async () => {
    const { hasSmtpConfig } = await import("../../src/server/emailProvisioning/emailWorker");
    const { sendStudentAccountEmail } = await import("../../src/server/services/email");

    expect(hasSmtpConfig()).toBe(false);
    expect(await sendStudentAccountEmail(account)).toBe("mock");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not report a sample mailbox as configured", async () => {
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "sample-password";
    const { hasSmtpConfig } = await import("../../src/server/emailProvisioning/emailWorker");
    const { sendStudentAccountEmail } = await import("../../src/server/services/email");

    expect(hasSmtpConfig()).toBe(false);
    expect(await sendStudentAccountEmail(account)).toBe("mock");
    expect(sendMail).not.toHaveBeenCalled();
  });
});
