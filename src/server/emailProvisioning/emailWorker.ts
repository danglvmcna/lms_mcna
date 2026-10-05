import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import os from "os";
import { Pool } from "pg";
import { auditRepository } from "../repositories/audit";
import { hasGoogleCredentials } from "./googleWorkspaceClient";

const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const SCHOOL_EMAIL_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN || "mcna.edu.vn";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || `"LMS MCNA" <${SMTP_USER || "noreply@mcna.vn"}>`;

export function getSmtpUser(): string {
  return (process.env.SMTP_USER || "").trim();
}

export function getSmtpPass(): string {
  // Strip whitespace in case user pastes 16-character Gmail App Password with spaces
  return (process.env.SMTP_PASS || "").trim().replace(/\s+/g, "");
}

export function getSmtpFrom(): string {
  const user = getSmtpUser();
  return process.env.SMTP_FROM || `"LMS MCNA" <${user || "noreply@mcna.vn"}>`;
}

let activeTransporter: nodemailer.Transporter | null = null;

export function hasSmtpConfig(): boolean {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (user && pass && !user.includes("your_email") && !user.includes("example.com") && !pass.includes("your_app_password")) {
    return true;
  }
  return hasSmtpOauth2Config();
}

function hasSmtpOauth2Config(): boolean {
  const user = getSmtpUser();
  const isPlaceholder = user.includes("your_email") || user.includes("example.com");
  return !isPlaceholder && hasGoogleCredentials() && !!process.env.SMTP_USER;
}

/**
 * Initialize nodemailer transporter using standard SMTP or Service Account OAuth2 flow
 */
export function getTransporter(): nodemailer.Transporter {
  if (activeTransporter) return activeTransporter;

  const user = getSmtpUser();
  const pass = getSmtpPass();
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;

  if (user && pass) {
    console.log(`[EmailWorker] Initializing standard SMTP transport for: ${user}`);
    const isGmail = host === "smtp.gmail.com" || user.endsWith("@gmail.com");
    activeTransporter = nodemailer.createTransport(
      isGmail
        ? {
            service: "gmail",
            auth: {
              user,
              pass,
            },
          }
        : {
            host,
            port,
            secure: port === 465,
            auth: {
              user,
              pass,
            },
          }
    );
    return activeTransporter;
  }

  if (hasSmtpOauth2Config()) {
    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON!);
    console.log(`[EmailWorker] Initializing OAuth2 SMTP transport for user: ${user}`);

    activeTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        type: "OAuth2",
        user,
        serviceClient: creds.client_id,
        privateKey: creds.private_key.replace(/\\n/g, "\n"),
      },
    } as any);
    return activeTransporter!;
  }

  throw new Error("SMTP credentials are not configured. Falling back to mock logging.");
}

/**
 * Log email mock output locally or to console
 */
function logEmailMock(to: string, name: string, subject: string, htmlContent: string) {
  try {
    const baseDir = process.env.VERCEL ? os.tmpdir() : process.cwd();
    const scratchDir = path.join(baseDir, "scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    const logFile = path.join(scratchDir, "emails.log");
    const logEntry = `
========================================
[EMAIL MOCK DISPATCHED]
Timestamp: ${new Date().toISOString()}
To: "${name}" <${to}>
Subject: ${subject}
----------------------------------------
${htmlContent}
========================================
\n`;
    fs.appendFileSync(logFile, logEntry, "utf8");
  } catch {
    // Non-fatal if filesystem is read-only
  }
  console.log(`[Email Mock] Dispatched to ${to}: ${subject}`);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Retry utility with backoff: 5s / 30s / 120s
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delays = [5000, 30000, 120000]
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const delay = delays[attempt - 1] || 5000;
      console.warn(`[EmailWorker] Attempt ${attempt} failed. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate premium HTML envelope template
 */
function wrapHtmlBody(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #4f46e5;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 24px;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .content p.greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .message-box {
      background-color: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      color: #1e293b;
      margin: 20px 0;
      line-height: 1.6;
    }
    .button-container {
      text-align: center;
      margin: 24px 0 0 0;
    }
    .button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 12px 28px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body style="font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; line-height: 1.6;">
  <div class="wrapper" style="width: 100%; background-color: #f8fafc; padding: 30px 15px; box-sizing: border-box; font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif;">
    <div class="card" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif;">
      <div class="header" style="background-color: #4f46e5; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif; letter-spacing: 0.3px; text-transform: uppercase;">HỌC VIỆN CÔNG NGHỆ MCNA</h1>
      </div>
      <div class="content" style="padding: 32px 24px; font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif;">
        ${contentHtml}
      </div>
      <div class="footer" style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; font-family: Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif;">
        <p>© ${new Date().getFullYear()} MCNA Technology School · mcna.vn</p>
        <p>Email tự động từ hệ thống học trực tuyến MCNA LMS, vui lòng không trả lời thư này. Cần hỗ trợ, bạn nhắn MCNA qua Zalo 0939 866 825.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send welcome email containing school email, instructions and tempPassword
 */
export async function sendWelcomeEmail(
  pool: Pool,
  userId: string,
  params: {
    to: string;
    name: string;
    schoolEmail: string;
    tempPassword?: string;
    lmsLoginUrl: string;
  }
): Promise<void> {
  const subject = `[MCNA LMS] Chào mừng bạn đến với MCNA - Tài khoản email học viên`;

  const htmlContent = wrapHtmlBody(
    "Chào mừng bạn đến với MCNA",
    `
      <p class="greeting">Chào bạn ${params.name},</p>
      <p>Chào mừng bạn đến với MCNA Technology School! Tài khoản email học viên của bạn đã được tạo:</p>
      <div class="message-box">
        <strong>Email trường:</strong> ${params.schoolEmail}<br/>
        ${params.tempPassword ? `<strong>Mật khẩu tạm thời:</strong> ${params.tempPassword}<br/>` : ""}
        <strong>Liên kết cổng thông tin LMS:</strong> <a href="${params.lmsLoginUrl}">${params.lmsLoginUrl}</a>
      </div>
      <p><strong>Hướng dẫn kích hoạt:</strong></p>
      <ol style="font-size: 14px; line-height: 1.6; padding-left: 20px;">
        <li>Truy cập vào <a href="https://gmail.com" target="_blank">Gmail.com</a> và đăng nhập bằng Email trường ở trên.</li>
        <li>Hệ thống Google sẽ yêu cầu bạn đổi mật khẩu mới trong lần đăng nhập đầu tiên. Hãy chọn mật khẩu bảo mật của riêng bạn.</li>
        <li>Sử dụng Email trường này để nhận mọi thông báo, lịch học, điểm thi và học phí tiếp theo từ LMS.</li>
      </ol>
      <div class="button-container">
        <a href="${params.lmsLoginUrl}" class="button" target="_blank">Đăng nhập LMS</a>
      </div>
    `
  );

  const action = async () => {
    if (hasSmtpConfig()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: getSmtpFrom(),
        to: params.to,
        subject,
        html: htmlContent,
        text: `Chào mừng ${params.name},\n\nTài khoản email trường của bạn đã được tạo:\nEmail: ${params.schoolEmail}\nPassword tạm thời: ${params.tempPassword || "Đã cấu hình"}\n\nVui lòng đăng nhập Gmail và cổng thông tin LMS.`,
      });
      console.log(`[EmailWorker] Welcome email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock(params.to, params.name, subject, htmlContent);
    }
  };

  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool, userId, "welcome_email_sent", "email", `Gửi email chào mừng tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send welcome email after retries to: ${params.to}`, err);
    await auditRepository.log(
      pool,
      userId,
      "welcome_email_failed",
      "email",
      `Lỗi gửi email chào mừng: ${String(err.message || err)}`
    );
    throw err;
  }
}

/**
 * Send generic notification email with prefix subjects
 */
export async function sendLmsNotification(
  pool: Pool,
  userId: string,
  params: {
    to: string;
    subject: string;
    body: string;
    type: string;
  }
): Promise<void> {
  const prefixMap: Record<string, string> = {
    grade: "[Điểm]",
    course: "[Khóa học]",
    deadline: "[Hạn chót]",
    tuition: "[Học phí]",
    finance: "[Tài chính]",
    warning: "[Cảnh báo]",
    danger: "[Khẩn cấp]",
    info: "[Thông báo]",
    success: "[Thành công]",
  };

  const prefix = prefixMap[params.type] || "[MCNA LMS]";
  const finalSubject = `${prefix} ${params.subject}`;

  const htmlContent = wrapHtmlBody(
    params.subject,
    `
      <p class="greeting">Chào học viên,</p>
      <p>Hệ thống LMS thông báo cập nhật mới liên quan đến tài khoản của bạn:</p>
      <div class="message-box">
        ${escapeHtml(params.body)}
      </div>
      <p>Vui lòng đăng nhập cổng thông tin LMS để biết thêm chi tiết.</p>
    `
  );

  const action = async () => {
    if (hasSmtpConfig()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: getSmtpFrom(),
        to: params.to,
        subject: finalSubject,
        html: htmlContent,
        text: params.body,
      });
      console.log(`[EmailWorker] Notification email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock(params.to, "Học viên", finalSubject, htmlContent);
    }
  };

  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool, userId, "notification_email_sent", "email", `Gửi thông báo loại [${params.type}] tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send notification email after retries to: ${params.to}`, err);
    await auditRepository.log(
      pool,
      userId,
      "notification_email_failed",
      "email",
      `Lỗi gửi thông báo [${params.type}]: ${String(err.message || err)}`
    );
    throw err;
  }
}

/**
 * Send one-time password reset link.
 */
export async function sendPasswordResetLinkEmail(
  pool: Pool,
  userId: string,
  params: {
    to: string;
    name: string;
    resetUrl: string;
    expiresAt: string;
  }
): Promise<void> {
  const subject = `[MCNA LMS] Liên kết đặt lại mật khẩu`;
  const safeName = escapeHtml(params.name);
  const safeResetUrl = escapeHtml(params.resetUrl);
  const expiresAt = new Date(params.expiresAt).toLocaleString("vi-VN");
  const htmlContent = wrapHtmlBody(
    "Đặt lại mật khẩu tài khoản",
    `
      <p class="greeting">Chào bạn ${safeName},</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản LMS của bạn. Vui lòng dùng liên kết một lần dưới đây để thiết lập mật khẩu mới. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      <div class="message-box" style="font-size: 16px; text-align: center;">
        <a href="${safeResetUrl}" style="display: inline-block; color: #ffffff; background: #4f46e5; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 700;">Đặt lại mật khẩu</a>
      </div>
      <p>Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:</p>
      <p style="word-break: break-all; font-family: monospace; font-size: 12px;">${safeResetUrl}</p>
      <p style="color: #ef4444; font-weight: 600;">Lưu ý bảo mật: Liên kết hết hạn lúc ${expiresAt} và chỉ dùng được một lần.</p>
    `
  );

  const action = async () => {
    if (hasSmtpConfig()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: getSmtpFrom(),
        to: params.to,
        subject,
        html: htmlContent,
        text: `Chào bạn ${params.name},\n\nDùng liên kết sau để đặt lại mật khẩu LMS. Liên kết hết hạn lúc ${expiresAt} và chỉ dùng được một lần:\n${params.resetUrl}`,
      });
      console.log(`[EmailWorker] Password reset link email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock(params.to, params.name, subject, htmlContent);
    }
  };

  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool, userId, "password_reset_link_email_sent", "email", `Gửi email liên kết đặt lại mật khẩu tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send password reset link email to: ${params.to}`, err);
    await auditRepository.log(
      pool,
      userId,
      "password_reset_link_email_failed",
      "email",
      `Lỗi gửi email liên kết đặt lại mật khẩu: ${String(err.message || err)}`
    );
    throw err;
  }
}

async function deliverEmail(params: { to: string; name: string; subject: string; html: string; text: string }) {
  if (hasSmtpConfig()) {
    await getTransporter().sendMail({ from: getSmtpFrom(), to: params.to, subject: params.subject, html: params.html, text: params.text });
    console.log(`[EmailWorker] "${params.subject}" dispatched to: ${params.to}`);
  } else {
    logEmailMock(params.to, params.name, params.subject, params.html);
  }
}

/**
 * Send the temporary password of a self-registered (or CRM-created) learner account to their personal email.
 * Retries briefly only, because the sign-up request waits for the result.
 */
export async function sendTemporaryPasswordEmail(
  pool: Pool,
  userId: string,
  params: { to: string; name: string; temporaryPassword: string; loginUrl: string }
): Promise<void> {
  const subject = `[MCNA LMS] Thông tin đăng nhập tài khoản học viên`;
  const safeName = escapeHtml(params.name);
  const safeEmail = escapeHtml(params.to);
  const safePassword = escapeHtml(params.temporaryPassword);
  const safeLoginUrl = escapeHtml(params.loginUrl);
  const html = wrapHtmlBody(
    "Thông tin đăng nhập",
    `
      <p class="greeting">Chào bạn ${safeName},</p>
      <p>Tài khoản học viên LMS của bạn đã được tạo bằng địa chỉ email này. Thông tin đăng nhập:</p>
      <div class="message-box">
        <strong>Email đăng nhập:</strong> ${safeEmail}<br/>
        <strong>Mật khẩu tạm thời:</strong> <span style="font-family: monospace; font-size: 16px;">${safePassword}</span>
      </div>
      <p style="color: #ef4444; font-weight: 600;">Vì lý do bảo mật, hệ thống sẽ yêu cầu bạn đổi mật khẩu ngay trong lần đăng nhập đầu tiên.</p>
      <div class="button-container">
        <a href="${safeLoginUrl}" class="button" target="_blank">Đăng nhập LMS</a>
      </div>
      <p>Nếu bạn không yêu cầu tạo tài khoản, hãy bỏ qua email này.</p>
    `
  );

  try {
    await retryWithBackoff(
      () => deliverEmail({
        to: params.to,
        name: params.name,
        subject,
        html,
        text: `Chào bạn ${params.name},\n\nTài khoản học viên LMS của bạn đã được tạo.\nEmail đăng nhập: ${params.to}\nMật khẩu tạm thời: ${params.temporaryPassword}\n\nBạn sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên: ${params.loginUrl}`
      }),
      2,
      [3000]
    );
    await auditRepository.log(pool, userId, "temporary_password_email_sent", "email", `Gửi mật khẩu tạm thời tới ${params.to}`);
  } catch (err: any) {
    console.error(`[EmailWorker] Failed to send temporary password email to: ${params.to}`, err);
    throw err;
  }
}

/** Tell an existing account holder that someone tried to sign up again with their email. */
export async function sendAccountExistsEmail(
  pool: Pool,
  userId: string,
  params: { to: string; name: string; loginUrl: string }
): Promise<void> {
  const subject = `[MCNA LMS] Bạn đã có tài khoản LMS`;
  const safeName = escapeHtml(params.name);
  const safeLoginUrl = escapeHtml(params.loginUrl);
  const html = wrapHtmlBody(
    "Bạn đã có tài khoản",
    `
      <p class="greeting">Chào bạn ${safeName},</p>
      <p>Có một yêu cầu tạo tài khoản LMS mới bằng địa chỉ email này, nhưng email đã được dùng cho một tài khoản hiện có.</p>
      <p>Hãy đăng nhập bằng mật khẩu hiện tại. Nếu quên mật khẩu, chọn <strong>Quên mật khẩu</strong> ở trang đăng nhập để nhận liên kết đặt lại.</p>
      <div class="button-container">
        <a href="${safeLoginUrl}" class="button" target="_blank">Đến trang đăng nhập</a>
      </div>
      <p>Nếu không phải bạn thực hiện, bạn có thể bỏ qua email này.</p>
    `
  );

  await retryWithBackoff(
    () => deliverEmail({
      to: params.to,
      name: params.name,
      subject,
      html,
      text: `Chào bạn ${params.name},\n\nEmail này đã có tài khoản LMS. Hãy đăng nhập hoặc dùng "Quên mật khẩu" tại ${params.loginUrl}`
    }),
    2,
    [3000]
  );
  await auditRepository.log(pool, userId, "account_exists_email_sent", "email", `Báo tài khoản đã tồn tại tới ${params.to}`);
}
