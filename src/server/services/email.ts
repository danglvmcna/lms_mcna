import nodemailer from "nodemailer";
import { Queryable } from "../db";
import fs from "fs";
import path from "path";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || `"MCNA LMS" <${process.env.SMTP_USER || "noreply@mcna.vn"}>`;
// Where the "open the LMS" button in notification emails points; the button is left out when unset.
const LMS_URL = (process.env.LMS_LOGIN_URL || process.env.APP_URL || "").trim();

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const TEST_RECEIVER_EMAIL = process.env.TEST_RECEIVER_EMAIL || "";

const isPlaceholderSmtp = () => {
  return (
    !SMTP_USER ||
    SMTP_USER.includes("your_email") ||
    SMTP_USER.includes("example.com") ||
    SMTP_PASS.includes("your_app_password")
  );
};

let transporter: nodemailer.Transporter | null = null;
let etherealCredentials: { user: string; pass: string } | null = null;

/**
 * Initialize transporter
 */
async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    return transporter;
  }

  // Fallback to Ethereal Email (On-the-fly test SMTP account)
  console.log("[Email Service] Creating Ethereal Email test account...");
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealCredentials = { user: testAccount.user, pass: testAccount.pass };
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[Email Service] Ethereal Email test account created successfully!`);
    console.log(`[Email Service] Test SMTP User: ${testAccount.user}`);
    console.log(`[Email Service] Test SMTP Password: ${testAccount.pass}`);
    console.log(`[Email Service] View test emails at: https://ethereal.email/messages`);
    return transporter;
  } catch (err) {
    console.error("[Email Service] Failed to create Ethereal Email account, falling back to local file logging.", err);
    throw err;
  }
}

/**
 * Log email mock output locally to scratch/emails.log in the workspace
 */
function logEmailMock(to: string, name: string, subject: string, htmlContent: string) {
  const scratchDir = path.join(process.cwd(), "scratch");
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
  console.log(`[Email Mock] Sent to ${to}. Logged in scratch/emails.log`);
}

/**
 * Log the Ethereal Email preview link to emails.log
 */
function logPreviewUrl(to: string, subject: string, previewUrl: string) {
  const scratchDir = path.join(process.cwd(), "scratch");
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const logFile = path.join(scratchDir, "emails.log");
  const logEntry = `
========================================
[REAL EMAIL SENT (ETHEREAL)]
Timestamp: ${new Date().toISOString()}
To: ${to}
Subject: ${subject}
Preview link (Ctrl+Click to view): ${previewUrl}
========================================
\n`;
  fs.appendFileSync(logFile, logEntry, "utf8");
  console.log(`[Email Service] Real email sent. Preview URL: ${previewUrl}`);
}

/**
 * Log the real email sent via SMTP production to emails.log
 */
function logRealEmailSent(to: string, subject: string, info: any) {
  const scratchDir = path.join(process.cwd(), "scratch");
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const logFile = path.join(scratchDir, "emails.log");
  const logEntry = `
========================================
[REAL EMAIL SENT (SMTP PRODUCTION)]
Timestamp: ${new Date().toISOString()}
To: ${to}
Subject: ${subject}
MessageID: ${info.messageId}
Response: ${info.response}
========================================
\n`;
  fs.appendFileSync(logFile, logEntry, "utf8");
  console.log(`[Email Service] Real email sent to ${to}. MessageID: ${info.messageId}`);
}

/**
 * Generate a premium, beautiful HTML email template
 */
function generateEmailHtml(name: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
      font-weight: 800;
      letter-spacing: 0.5px;
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
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>MCNA Technology School</h1>
      </div>
      <div class="content">
        <p class="greeting">Chào ${escapeHtml(name)},</p>
        <p>Bạn có một thông báo mới từ MCNA LMS:</p>
        <div class="message-box">
          ${escapeHtml(message)}
        </div>
        <p>Đăng nhập MCNA LMS để xem chi tiết.</p>
        ${LMS_URL ? `<div class="button-container">
          <a href="${escapeHtml(LMS_URL)}" class="button" target="_blank">Mở MCNA LMS</a>
        </div>` : ""}
      </div>
      <div class="footer">
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
 * Send email direct to a recipient without querying the database (useful to avoid transaction client issues).
 */
export async function sendEmailDirect(recipientEmail: string, recipientName: string, message: string) {
  try {
    let toEmail = recipientEmail;
    if (TEST_RECEIVER_EMAIL && !TEST_RECEIVER_EMAIL.includes("your_real_email")) {
      toEmail = TEST_RECEIVER_EMAIL;
      console.log(`[Email Service] Overriding recipient email from ${recipientEmail} to ${TEST_RECEIVER_EMAIL} for testing.`);
    }

    const subject = `[MCNA LMS] Bạn có thông báo mới`;
    const htmlContent = generateEmailHtml(recipientName || "Học viên", message);

    if (isPlaceholderSmtp()) {
      logEmailMock(toEmail, recipientName || "Học viên", subject, htmlContent);
      return;
    }

    try {
      const activeTransporter = await getTransporter();
      const info = await activeTransporter.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject: subject,
        html: htmlContent,
        text: `Chào ${recipientName},\n\nBạn có một thông báo mới từ MCNA LMS:\n\n${message}\n\nĐăng nhập MCNA LMS để xem chi tiết.${LMS_URL ? `\n${LMS_URL}` : ""}`,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logPreviewUrl(toEmail, subject, previewUrl);
      } else {
        logRealEmailSent(toEmail, subject, info);
      }
    } catch (smtpErr) {
      console.warn("[Email Service] SMTP dispatch failed, falling back to local file log.", smtpErr);
      logEmailMock(toEmail, recipientName || "Học viên", subject, htmlContent);
    }
  } catch (err) {
    console.error(`[Email Service Error] Failed to process direct email notification to ${recipientEmail}:`, err);
  }
}

/**
 * Send email notification to a user by fetching their details from DB and mailing them.
 */
export async function sendEmailNotification(db: Queryable, userId: string, message: string) {
  try {
    const res = await db.query("SELECT email, name FROM users WHERE id = $1", [userId]);
    const user = res.rows[0];
    if (!user || !user.email) {
      return;
    }

    await sendEmailDirect(user.email, user.name || "Học viên", message);
  } catch (err) {
    console.error(`[Email Service Error] Failed to process email notification for user ${userId}:`, err);
  }
}
