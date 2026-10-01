import nodemailer from "nodemailer";
import { getSupportPhone } from "../config";
import { Queryable } from "../db";
import fs from "fs";
import path from "path";

const getSmtpConfig = () => ({
  host: (process.env.SMTP_HOST || "").trim(),
  port: Number(process.env.SMTP_PORT) || 587,
  user: (process.env.SMTP_USER || "").trim(),
  pass: (process.env.SMTP_PASS || "").trim().replace(/\s+/g, ""),
  from: process.env.SMTP_FROM || `"Học Viện Công Nghệ MCNA" <${(process.env.SMTP_USER || "noreply@mcna.vn").trim()}>`,
  testReceiver: (process.env.TEST_RECEIVER_EMAIL || "").trim(),
  appUrl: (process.env.APP_URL || process.env.LMS_LOGIN_URL || "https://lms.mcna.vn").replace(/\/$/, "")
});

const BANK_ACCOUNT_NUMBER = "099162438104";
const BANK_NAME = "MB Bank (Ngân hàng Quân Đội)";
const ACCOUNT_HOLDER = "HOC VIEN CONG NGHE MCNA";
const getAppUrl = () => (process.env.APP_URL || process.env.LMS_LOGIN_URL || "https://lms.mcna.vn").replace(/\/$/, "");

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
      const isGmail = config.host === "smtp.gmail.com" || config.user.endsWith("@gmail.com");
      transporter = nodemailer.createTransport(
        isGmail
          ? {
              service: "gmail",
              auth: {
                user: config.user,
                pass: config.pass,
              },
            }
          : {
              host: config.host,
              port: config.port,
              secure: config.port === 465,
              auth: {
                user: config.user,
                pass: config.pass,
              },
            }
      );
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
        <p style="margin: 0 0 4px 0;">Hotline / Hỗ trợ học vụ: ${getSupportPhone()} · Website: <a href="${getSmtpConfig().appUrl}" style="color: #4f46e5; text-decoration: none;">${getSmtpConfig().appUrl.replace(/^https?:\/\//, '')}</a></p>
        <p style="margin: 0; color: #94a3b8;">© ${new Date().getFullYear()} MCNA Technology School. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** sent: handed to SMTP; mock: SMTP is not configured, written to scratch/emails.log; failed: SMTP rejected it. */
export type EmailDeliveryStatus = "sent" | "mock" | "failed";

export async function dispatchEmail(to: string, name: string, subject: string, html: string, text: string): Promise<EmailDeliveryStatus> {
  const config = getSmtpConfig();
  let toEmail = to;
  if (config.testReceiver && !config.testReceiver.includes("your_real_email")) {
    toEmail = config.testReceiver;
    console.log(`[Email Service] Overriding recipient from ${to} to test email ${toEmail}`);
  }

  const activeTransporter = await getTransporter();
  if (!activeTransporter) {
    logEmailMock(toEmail, name, subject, html);
    return "mock";
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
    return "sent";
  } catch (err) {
    console.warn(`[Email Service] SMTP dispatch failed, fallback to mock log:`, err);
    logEmailMock(toEmail, name, subject, html);
    return "failed";
  }
}

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const safeHttpUrl = (value?: string | null) => {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const infoRow = (label: string, value: string, valueStyle = "font-weight: 700; color: #0f172a;") => `
          <tr>
            <td style="color: #64748b; padding: 5px 0; vertical-align: top; width: 38%;">${label}</td>
            <td style="${valueStyle} text-align: right; padding: 5px 0;">${value}</td>
          </tr>`;

export interface ClassPlacementEmailParams {
  to: string;
  name: string;
  courseTitle: string;
  sectionCode: string;
  scheduleText?: string | null;
  room?: string | null;
  openingDate?: string | null;
  numberOfSessions?: number | null;
  teacherName?: string | null;
  groupChatUrl?: string | null;
  supportPhone: string;
  // The account still has the default password: remind the learner about the first sign-in.
  firstLoginPending?: boolean;
}

/**
 * Tells a learner which class they were placed in: class name, timetable, Zalo group, teacher and support phone.
 */
export async function sendClassPlacementEmail(params: ClassPlacementEmailParams): Promise<EmailDeliveryStatus> {
  try {
    const subject = `[MCNA] Thông tin xếp lớp ${params.sectionCode} – ${params.courseTitle}`;
    const zaloUrl = safeHttpUrl(params.groupChatUrl);
    const schedule = String(params.scheduleText || "").trim() || "MCNA sẽ thông báo trong nhóm lớp";
    const teacher = String(params.teacherName || "").trim() || "Đang cập nhật";
    const appUrl = getAppUrl();

    const bodyContent = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Chào ${escapeHtml(params.name)},</p>
      <p>MCNA đã xếp bạn vào lớp của khóa học <strong>${escapeHtml(params.courseTitle)}</strong>. Dưới đây là thông tin lớp của bạn:</p>

      <div class="success-box">
        <div style="font-weight: 800; font-size: 14px; color: #15803d; margin-bottom: 12px; text-transform: uppercase; border-bottom: 1px solid #bbf7d0; padding-bottom: 6px;">
          THÔNG TIN LỚP HỌC
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${infoRow("Tên lớp:", escapeHtml(params.sectionCode), "font-weight: 800; color: #4338ca; font-size: 15px;")}
          ${params.openingDate ? infoRow("Ngày khai giảng:", escapeHtml(params.openingDate)) : ""}
          ${infoRow("Lịch học:", escapeHtml(schedule))}
          ${params.room ? infoRow("Hình thức / phòng học:", escapeHtml(params.room), "font-weight: 600; color: #334155;") : ""}
          ${params.numberOfSessions ? infoRow("Số buổi:", `${Number(params.numberOfSessions)} buổi`, "font-weight: 600; color: #334155;") : ""}
          ${infoRow("Giảng viên phụ trách:", escapeHtml(teacher))}
          ${infoRow("Số điện thoại hỗ trợ:", escapeHtml(params.supportPhone), "font-weight: 800; color: #b91c1c;")}
        </table>
      </div>

      <div class="bank-box">
        <div style="font-weight: 800; font-size: 14px; color: #1e40af; margin-bottom: 8px; text-transform: uppercase;">NHÓM ZALO CỦA LỚP</div>
        ${zaloUrl ? `
        <p style="font-size: 13px; color: #334155; margin: 0 0 12px 0;">Mọi thông báo của lớp và trao đổi với giảng viên diễn ra trong nhóm Zalo. Bạn tham gia nhóm trước buổi khai giảng nhé.</p>
        <div style="text-align: center;">
          <a href="${escapeHtml(zaloUrl)}" class="btn" target="_blank" style="background-color: #0068ff;">Tham gia nhóm Zalo lớp</a>
        </div>
        <p style="font-size: 11px; color: #64748b; margin: 10px 0 0 0; word-break: break-all; text-align: center;">${escapeHtml(zaloUrl)}</p>
        ` : `
        <p style="font-size: 13px; color: #334155; margin: 0;">Link nhóm Zalo sẽ được MCNA gửi cho bạn trước buổi khai giảng. Nếu cần sớm hơn, bạn gọi số hỗ trợ ${escapeHtml(params.supportPhone)}.</p>
        `}
      </div>

      <p style="font-size: 14px; color: #334155;">
        Lớp học đã hiển thị trong tài khoản MCNA LMS của bạn (đăng nhập bằng email <strong>${escapeHtml(params.to)}</strong>). Tại đó có tài liệu mở đầu, slide, file data và bài tập về nhà của từng buổi.
      </p>
      ${params.firstLoginPending ? `
      <p style="font-size: 13px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 12px;">
        Lần đăng nhập đầu tiên, bạn dùng mật khẩu mặc định trong email "Tài khoản học viên" MCNA đã gửi, sau đó đặt mật khẩu của riêng bạn. Nếu không tìm thấy, bạn chọn "Quên mật khẩu" ở trang đăng nhập.
      </p>` : ""}

      <div class="btn-container">
        <a href="${escapeHtml(appUrl)}" class="btn btn-green" target="_blank">Vào lớp học trên MCNA LMS</a>
      </div>
    `;

    const plainText = [
      `Chào ${params.name},`,
      "",
      `MCNA đã xếp bạn vào lớp của khóa học "${params.courseTitle}".`,
      `Tên lớp: ${params.sectionCode}`,
      params.openingDate ? `Ngày khai giảng: ${params.openingDate}` : "",
      `Lịch học: ${schedule}`,
      params.room ? `Hình thức / phòng học: ${params.room}` : "",
      params.numberOfSessions ? `Số buổi: ${params.numberOfSessions}` : "",
      `Giảng viên phụ trách: ${teacher}`,
      zaloUrl ? `Nhóm Zalo của lớp: ${zaloUrl}` : "Link nhóm Zalo sẽ được MCNA gửi trước buổi khai giảng.",
      `Số điện thoại hỗ trợ: ${params.supportPhone}`,
      "",
      `Đăng nhập MCNA LMS bằng email ${params.to} tại: ${appUrl}`
    ].filter(line => line !== "").join("\n");

    return await dispatchEmail(params.to, params.name, subject, renderBaseLayout(subject, bodyContent), plainText);
  } catch (err) {
    console.error("[Email Service] sendClassPlacementEmail error:", err);
    return "failed";
  }
}

export interface StudentAccountEmailParams {
  to: string;
  name: string;
  password: string;
  courseTitles: string[];
  supportPhone: string;
}

/** Login details for an account created from the paid list: personal email plus the default password. */
export async function sendStudentAccountEmail(params: StudentAccountEmailParams): Promise<EmailDeliveryStatus> {
  try {
    const subject = "[MCNA] Tài khoản học viên MCNA LMS của bạn";
    const appUrl = getAppUrl();
    const courses = params.courseTitles.filter(Boolean);
    const courseText = courses.length ? ` khóa học <strong>${courses.map(escapeHtml).join(", ")}</strong>` : " khóa học";

    const bodyContent = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Chào ${escapeHtml(params.name)},</p>
      <p>Cảm ơn bạn đã đăng ký${courseText} tại <strong>Học Viện Công Nghệ MCNA</strong>. Tài khoản học viên của bạn trên MCNA LMS đã sẵn sàng:</p>

      <div class="info-box">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${infoRow("Email đăng nhập:", escapeHtml(params.to))}
          ${infoRow("Mật khẩu mặc định:", `<span class="mono" style="font-size: 15px;">${escapeHtml(params.password)}</span>`, "font-weight: 800; color: #b91c1c;")}
        </table>
      </div>

      <p style="font-size: 13px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 12px;">
        Ở lần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn đặt mật khẩu của riêng bạn.
      </p>
      <p style="font-size: 14px; color: #334155;">
        Lớp học sẽ xuất hiện trong tài khoản ngay khi MCNA xếp lớp xong. Khi đó bạn sẽ nhận thêm một email với tên lớp, lịch học, nhóm Zalo và giảng viên phụ trách.
      </p>
      <p style="font-size: 13px; color: #475569;">Cần hỗ trợ, bạn gọi <strong>${escapeHtml(params.supportPhone)}</strong>.</p>

      <div class="btn-container">
        <a href="${escapeHtml(appUrl)}" class="btn" target="_blank">Đăng nhập MCNA LMS</a>
      </div>
    `;

    const plainText = [
      `Chào ${params.name},`,
      "",
      `Tài khoản học viên MCNA LMS của bạn đã sẵn sàng${courses.length ? ` (khóa học: ${courses.join(", ")})` : ""}.`,
      `Email đăng nhập: ${params.to}`,
      `Mật khẩu mặc định: ${params.password}`,
      "Ở lần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn đặt mật khẩu của riêng bạn.",
      "Lớp học sẽ xuất hiện trong tài khoản khi MCNA xếp lớp xong.",
      `Số điện thoại hỗ trợ: ${params.supportPhone}`,
      "",
      `Đăng nhập tại: ${appUrl}`
    ].join("\n");

    return await dispatchEmail(params.to, params.name, subject, renderBaseLayout(subject, bodyContent), plainText);
  } catch (err) {
    console.error("[Email Service] sendStudentAccountEmail error:", err);
    return "failed";
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
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Kính gửi ${escapeHtml(params.name)},</p>
      <p>Cảm ơn bạn đã đăng ký khóa học tại <strong>Học Viện Công Nghệ MCNA</strong>. Đơn đăng ký học tập của bạn đã được ghi nhận trên hệ thống.</p>

      <div class="info-box">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
          THÔNG TIN KHÓA HỌC ĐĂNG KÝ
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Khóa học:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right; padding: 4px 0;">${escapeHtml(params.courseTitle)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding: 4px 0;">Lớp học phần:</td>
            <td style="font-weight: 600; color: #4338ca; text-align: right; padding: 4px 0;">${escapeHtml(params.sectionCode || "Đang xếp lớp")}</td>
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
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Kính gửi ${escapeHtml(params.name)},</p>
      <p>Học Viện Công Nghệ MCNA xin trân trọng thông báo: Khoản thanh toán học phí của bạn đã được <strong>xác nhận thành công</strong>! Khóa học của bạn đã được kích hoạt trên hệ thống.</p>

      <div class="success-box">
        <div style="font-weight: 800; font-size: 14px; color: #15803d; margin-bottom: 12px; text-transform: uppercase; border-bottom: 1px solid #bbf7d0; padding-bottom: 6px;">
          BIÊN NHẬN THANH TOÁN & THÔNG TIN HỌC PHẦN
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #475569; padding: 5px 0;">Khóa học:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right; padding: 5px 0;">${escapeHtml(params.courseTitle)}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Số tiền đã thanh toán:</td>
            <td style="font-weight: 800; color: #15803d; font-size: 15px; text-align: right; padding: 5px 0;">${formatMoney(params.amount)}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Mã giao dịch:</td>
            <td style="font-weight: 700; color: #334155; text-align: right; padding: 5px 0;" class="mono">${escapeHtml(params.transactionId || "TX-" + Date.now())}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Thời gian xác nhận:</td>
            <td style="font-weight: 600; color: #334155; text-align: right; padding: 5px 0;">${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
          </tr>
          <tr>
            <td style="color: #475569; padding: 5px 0;">Lớp học phần:</td>
            <td style="font-weight: 700; color: #4338ca; text-align: right; padding: 5px 0;">${escapeHtml(params.sectionCode || "Đang xếp lớp")}</td>
          </tr>
          ${safeTeacherName ? `
          <tr>
            <td style="color: #475569; padding: 5px 0;">Giảng viên phụ trách:</td>
            <td style="font-weight: 600; color: #0f172a; text-align: right; padding: 5px 0;">${escapeHtml(params.teacherName)}</td>
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
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Kính gửi ${escapeHtml(recipientName)},</p>
      <p>Hệ thống Học Viện Công Nghệ MCNA xin gửi đến bạn thông báo mới:</p>
      <div class="info-box" style="font-size: 14px; color: #1e293b; line-height: 1.6;">
        ${escapeHtml(message).replace(/\r?\n/g, "<br>")}
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
