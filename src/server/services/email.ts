import nodemailer from "nodemailer";
import { Queryable } from "../db";
import fs from "fs";
import path from "path";

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || `"Học Viện Công Nghệ MCNA" <${process.env.SMTP_USER || "noreply@mcna.vn"}>`,
  testReceiver: process.env.TEST_RECEIVER_EMAIL || "",
  // Where the "open the LMS" button in notification emails points.
  appUrl: (process.env.LMS_LOGIN_URL || process.env.APP_URL || "https://lms-mcna.vercel.app").trim()
});

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BANK_ACCOUNT_NUMBER = "099162438104";
const BANK_NAME = "MB Bank (Ngân hàng Quân Đội)";
const ACCOUNT_HOLDER = "HOC VIEN CONG NGHE MCNA";
const getAppUrl = () => getSmtpConfig().appUrl;

export const isPlaceholderSmtp = () => {
  const config = getSmtpConfig();
  return (
    !config.user ||
    config.user.includes("your_email") ||
    config.user.includes("example.com") ||
    config.pass.includes("your_app_password")
  );
};

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const config = getSmtpConfig();
  if (config.host && config.user && config.pass && !isPlaceholderSmtp()) {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    }
    return transporter;
  }

  return null;
}

function logEmailMock(to: string, name: string, subject: string, htmlContent: string) {
  try {
    const scratchDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    const logFile = path.join(scratchDir, "emails.log");
    const logEntry = `\n========================================\n[EMAIL MOCK DISPATCHED] ${new Date().toISOString()}\nTo: "${name}" <${to}>\nSubject: ${subject}\n----------------------------------------\n${htmlContent}\n========================================\n`;
    fs.appendFileSync(logFile, logEntry, "utf8");
  } catch {
    // Read-only filesystem fallback (e.g. serverless)
  }
  console.log(`[Email Mock] Sent to "${name}" <${to}>: ${subject}`);
}

const formatMoney = (amount: number) =>
  amount > 0 ? `${new Intl.NumberFormat("vi-VN").format(amount)} đ` : "Miễn phí";

function renderBaseLayout(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; line-height: 1.6; }
    .wrapper { width: 100%; background-color: #f8fafc; padding: 30px 15px; box-sizing: border-box; }
    .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #312e81 0%, #4338ca 50%, #4f46e5 100%); padding: 26px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
    .header p { color: #c7d2fe; margin: 4px 0 0 0; font-size: 12px; font-weight: 500; }
    .content { padding: 32px 24px; }
    .info-box { background-color: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
    .bank-box { background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1.5px solid #bfdbfe; }
    .success-box { background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1.5px solid #bbf7d0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .row-label { color: #64748b; font-weight: 500; }
    .row-value { color: #0f172a; font-weight: 700; text-align: right; }
    .highlight { color: #4f46e5; font-weight: 800; }
    .highlight-green { color: #16a34a; font-weight: 800; }
    .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6; }
    .btn-container { text-align: center; margin: 28px 0 10px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 13px; padding: 13px 32px; border-radius: 10px; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3); }
    .btn-green { background-color: #16a34a; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3); }
    .mono { font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>HỌC VIỆN CÔNG NGHỆ MCNA</h1>
        <p>Hệ thống Đào tạo & Quản lý Học vụ Trực tuyến (MCNA LMS)</p>
      </div>
      <div class="content">
        ${bodyContent}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #334155;">HỌC VIỆN CÔNG NGHỆ MCNA</p>
        <p style="margin: 0 0 4px 0;">Hotline / Hỗ trợ học vụ: Ban Đào tạo MCNA · Website: <a href="${escapeHtml(getAppUrl())}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(getAppUrl().replace(/^https?:\/\//, ''))}</a></p>
        <p style="margin: 0; color: #94a3b8;">© ${new Date().getFullYear()} MCNA Technology School. Mọi quyền được bảo lưu. Vui lòng không trả lời thư này, cần hỗ trợ hãy nhắn MCNA qua Zalo 0939 866 825.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function dispatchEmail(to: string, name: string, subject: string, html: string, text: string) {
  const config = getSmtpConfig();
  let toEmail = to;
  if (config.testReceiver && !config.testReceiver.includes("your_real_email")) {
    toEmail = config.testReceiver;
    console.log(`[Email Service] Overriding recipient from ${to} to test email ${toEmail}`);
  }

  const activeTransporter = await getTransporter();
  if (!activeTransporter) {
    logEmailMock(toEmail, name, subject, html);
    return;
  }

  try {
    await activeTransporter.sendMail({
      from: config.from,
      to: toEmail,
      subject,
      html,
      text,
    });
    console.log(`[Email Service] Real email sent to ${toEmail}: ${subject}`);
  } catch (err) {
    console.warn(`[Email Service] SMTP dispatch failed, fallback to mock log:`, err);
    logEmailMock(toEmail, name, subject, html);
  }
}

export interface CourseRegistrationEmailParams {
  to: string;
  name: string;
  courseTitle: string;
  sectionCode?: string | null;
  price: number;
  transactionId?: string | null;
  studentId?: string | null;
}

/**
 * Sends course registration confirmation email to the student with payment details if course is paid.
 */
export async function sendCourseRegistrationEmail(params: CourseRegistrationEmailParams) {
  try {
    const isPaid = params.price > 0;
    const studentHex = (params.studentId || "").replace(/^[^a-f0-9]*/i, "").substring(0, 6).toUpperCase() || "MCNA01";
    const txHex = (params.transactionId || "").replace(/^[^a-f0-9]*/i, "").substring(0, 6).toUpperCase() || "ORDER1";
    const memoText = `MCNA ${studentHex} ${txHex}`;
    const vietQrUrl = `https://img.vietqr.io/image/MB-${BANK_ACCOUNT_NUMBER}-compact2.png?amount=${params.price}&addInfo=${encodeURIComponent(memoText)}&accountName=${encodeURIComponent(ACCOUNT_HOLDER)}`;

    const safeName = escapeHtml(params.name);
    const safeCourseTitle = escapeHtml(params.courseTitle);
    const safeSectionCode = escapeHtml(params.sectionCode || "Đang xếp lớp");

    const subject = isPaid
      ? `[MCNA] Hướng dẫn thanh toán & Xác nhận đăng ký: ${params.courseTitle}`
      : `[MCNA] Xác nhận đăng ký thành công khóa học: ${params.courseTitle}`;

    const bodyContent = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Kính gửi ${safeName},</p>
      <p>Cảm ơn bạn đã đăng ký khóa học tại <strong>Học Viện Công Nghệ MCNA</strong>. Đơn đăng ký học tập của bạn đã được ghi nhận trên hệ thống.</p>

      <div class="info-box">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
          THÔNG TIN KHÓA HỌC ĐĂNG KÝ
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Khóa học:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right; padding: 4px 0;">${safeCourseTitle}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Lớp học phần:</td>
            <td style="font-weight: 600; color: #4338ca; text-align: right; padding: 4px 0;">${safeSectionCode}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Học phí:</td>
            <td style="font-weight: 800; color: ${isPaid ? '#059669' : '#4f46e5'}; text-align: right; padding: 4px 0;">${formatMoney(params.price)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Trạng thái:</td>
            <td style="font-weight: 700; color: ${isPaid ? '#d97706' : '#059669'}; text-align: right; padding: 4px 0;">${isPaid ? "Chờ thanh toán" : "Đã ghi danh"}</td>
          </tr>
        </table>
      </div>

      ${isPaid ? `
      <div class="bank-box">
        <div style="font-weight: 800; font-size: 14px; color: #1e40af; margin-bottom: 12px; text-transform: uppercase; border-bottom: 1px solid #bfdbfe; padding-bottom: 6px;">
          HƯỚNG DẪN CHUYỂN KHOẢN HỌC PHÍ
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #475569; padding: 5px 0;">Ngân hàng:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right; padding: 5px 0;">${BANK_NAME}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Số tài khoản:</td>
            <td style="font-weight: 800; color: #1e40af; font-size: 15px; text-align: right; padding: 5px 0;" class="mono">${BANK_ACCOUNT_NUMBER}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Chủ tài khoản:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right; padding: 5px 0;">${ACCOUNT_HOLDER}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Số tiền cần thanh toán:</td>
            <td style="font-weight: 800; color: #059669; font-size: 15px; text-align: right; padding: 5px 0;">${formatMoney(params.price)}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Nội dung chuyển khoản:</td>
            <td style="font-weight: 800; color: #b91c1c; font-size: 15px; text-align: right; padding: 5px 0;" class="mono">${memoText}</td>
          </tr>
        </table>

        <div style="text-align: center; margin-top: 16px;">
          <p style="font-size: 12px; color: #475569; margin: 0 0 8px 0;">Quét mã VietQR trên ứng dụng ngân hàng để thanh toán nhanh:</p>
          <img src="${vietQrUrl}" alt="VietQR MCNA" style="max-width: 220px; width: 100%; border-radius: 12px; border: 1px solid #bfdbfe; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin: 0 auto; display: block;" />
        </div>

        <p style="font-size: 12px; color: #64748b; margin: 12px 0 0 0; line-height: 1.5; text-align: center;">
          <em>* Lưu ý quan trọng: Vui lòng ghi chính xác nội dung <strong style="color: #b91c1c;">${memoText}</strong> để hệ thống tự động kích hoạt khóa học ngay sau khi nhận tiền.</em>
        </p>
      </div>
      ` : `
      <p>Khóa học miễn phí đã được kích hoạt trên tài khoản của bạn. Bạn có thể đăng nhập ngay để theo dõi đề cương và lịch học.</p>
      `}

      <div class="btn-container">
        <a href="${escapeHtml(getAppUrl())}" class="btn" target="_blank">Xem phòng học & Đơn đăng ký</a>
      </div>
    `;

    const plainText = `Kính gửi ${params.name},\n\nCảm ơn bạn đã đăng ký khóa học "${params.courseTitle}" tại MCNA Technology School.\nHọc phí: ${formatMoney(params.price)}\n${isPaid ? `\nThông tin chuyển khoản:\nNgân hàng: ${BANK_NAME}\nSố tài khoản: ${BANK_ACCOUNT_NUMBER}\nChủ tài khoản: ${ACCOUNT_HOLDER}\nSố tiền: ${formatMoney(params.price)}\nNội dung: ${memoText}\n` : ""}\nTruy cập hệ thống tại: ${getAppUrl()}`;

    await dispatchEmail(params.to, params.name, subject, renderBaseLayout(subject, bodyContent), plainText);
  } catch (err) {
    console.error("[Email Service] sendCourseRegistrationEmail error:", err);
  }
}

export interface PaymentConfirmationEmailParams {
  to: string;
  name: string;
  courseTitle: string;
  amount: number;
  transactionId?: string | null;
  sectionCode?: string | null;
  teacherName?: string | null;
}

/**
 * Sends a formal payment receipt & activation confirmation email to the student.
 */
export async function sendPaymentConfirmationEmail(params: PaymentConfirmationEmailParams) {
  try {
    const subject = `[MCNA] Xác nhận thanh toán thành công khóa học: ${params.courseTitle}`;

    const safeName = escapeHtml(params.name);
    const safeCourseTitle = escapeHtml(params.courseTitle);
    const safeSectionCode = escapeHtml(params.sectionCode || "Đang xếp lớp");
    const safeTeacherName = params.teacherName ? escapeHtml(params.teacherName) : "";
    const safeTransactionId = escapeHtml(params.transactionId || "TX-" + Date.now());

    const bodyContent = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Kính gửi ${safeName},</p>
      <p>Học Viện Công Nghệ MCNA xin trân trọng thông báo: Khoản thanh toán học phí của bạn đã được <strong>xác nhận thành công</strong>! Khóa học của bạn đã được kích hoạt trên hệ thống.</p>

      <div class="success-box">
        <div style="font-weight: 800; font-size: 14px; color: #15803d; margin-bottom: 12px; text-transform: uppercase; border-bottom: 1px solid #bbf7d0; padding-bottom: 6px;">
          BIÊN NHẬN THANH TOÁN & THÔNG TIN HỌC PHẦN
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #475569; padding: 5px 0;">Khóa học:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right; padding: 5px 0;">${safeCourseTitle}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Số tiền đã thanh toán:</td>
            <td style="font-weight: 800; color: #15803d; font-size: 15px; text-align: right; padding: 5px 0;">${formatMoney(params.amount)}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Mã giao dịch:</td>
            <td style="font-weight: 700; color: #334155; text-align: right; padding: 5px 0;" class="mono">${safeTransactionId}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Thời gian xác nhận:</td>
            <td style="font-weight: 600; color: #334155; text-align: right; padding: 5px 0;">${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Lớp học phần:</td>
            <td style="font-weight: 700; color: #4338ca; text-align: right; padding: 5px 0;">${safeSectionCode}</td>
          </tr>
          ${safeTeacherName ? `
          <tr>
            <td style="color: #475569; padding: 5px 0;">Giảng viên phụ trách:</td>
            <td style="font-weight: 600; color: #0f172a; text-align: right; padding: 5px 0;">${safeTeacherName}</td>
          </tr>` : ""}
          <tr>
            <td style="color: #475569; padding: 5px 0;">Trạng thái khóa học:</td>
            <td style="font-weight: 800; color: #15803d; text-align: right; padding: 5px 0;">Đã kích hoạt - Sẵn sàng vào học</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #334155;">
        Bạn hiện đã có đầy đủ quyền truy cập vào tài liệu học tập, bài giảng, bài tập và phòng học trực tuyến của khóa học. Hãy bắt đầu hành trình học tập cùng MCNA ngay hôm nay!
      </p>

      <div class="btn-container">
        <a href="${escapeHtml(getAppUrl())}" class="btn btn-green" target="_blank">Vào học ngay trên MCNA LMS</a>
      </div>
    `;

    const plainText = `Kính gửi ${params.name},\n\nHọc Viện Công Nghệ MCNA xác nhận đã nhận thanh toán số tiền ${formatMoney(params.amount)} cho khóa học "${params.courseTitle}".\nMã giao dịch: ${params.transactionId || ""}\nLớp học: ${params.sectionCode || "Đang xếp lớp"}\nKhóa học đã được kích hoạt thành công!\nTruy cập vào học ngay tại: ${getAppUrl()}`;

    await dispatchEmail(params.to, params.name, subject, renderBaseLayout(subject, bodyContent), plainText);
  } catch (err) {
    console.error("[Email Service] sendPaymentConfirmationEmail error:", err);
  }
}

/**
 * Send email direct to a recipient.
 */
export async function sendEmailDirect(recipientEmail: string, recipientName: string, message: string) {
  try {
    const subject = `[MCNA LMS] Thông báo mới từ hệ thống`;
    const safeName = escapeHtml(recipientName);
    const safeMessage = escapeHtml(message);
    const bodyContent = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Kính gửi ${safeName},</p>
      <p>Hệ thống Học Viện Công Nghệ MCNA xin gửi đến bạn thông báo mới:</p>
      <div class="info-box" style="font-size: 14px; color: #1e293b; line-height: 1.6;">
        ${safeMessage}
      </div>
      <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết.</p>
      <div class="btn-container">
        <a href="${escapeHtml(getAppUrl())}" class="btn" target="_blank">Đi tới MCNA LMS</a>
      </div>
    `;
    const plainText = `Kính gửi ${recipientName},\n\nBạn có một thông báo mới từ MCNA LMS:\n\n${message}\n\nTruy cập hệ thống: ${getAppUrl()}`;
    await dispatchEmail(recipientEmail, recipientName, subject, renderBaseLayout(subject, bodyContent), plainText);
  } catch (err) {
    console.error(`[Email Service Error] Failed to process direct email to ${recipientEmail}:`, err);
  }
}

/**
 * Send email notification to a user by fetching their details from DB and mailing them.
 */
export async function sendEmailNotification(db: Queryable, userId: string, message: string) {
  try {
    const res = await db.query("SELECT email, name FROM users WHERE id = $1", [userId]);
    const user = res.rows[0];
    if (!user || !user.email) return;

    await sendEmailDirect(user.email, user.name || "Học viên", message);
  } catch (err) {
    console.error(`[Email Service Error] Failed to process email notification for user ${userId}:`, err);
  }
}
