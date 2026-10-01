import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendClassPlacementEmail, sendEmailDirect, sendPaymentConfirmationEmail, sendStudentAccountEmail } from "../../src/server/services/email";

// Without SMTP credentials the service writes each email to the mock log; the tests read it from there.
describe("direct-sale emails", () => {
  const originalEnv = process.env;
  let written: string[];

  beforeEach(() => {
    process.env = { ...originalEnv, APP_URL: "https://lms.mcna.vn" };
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.TEST_RECEIVER_EMAIL;
    delete process.env.SUPPORT_PHONE;
    written = [];
    vi.spyOn(fs, "appendFileSync").mockImplementation((_file, data) => {
      written.push(String(data));
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("class placement email carries class name, timetable, Zalo link, teacher and support phone", async () => {
    const status = await sendClassPlacementEmail({
      to: "an@gmail.com",
      name: "Nguyễn Văn An",
      courseTitle: "AI Automation: Xây dựng hệ thống tự động hóa doanh nghiệp",
      sectionCode: "AI Automation 89",
      scheduleText: "Thứ Hai, Thứ Năm · 19:30 – 21:30",
      room: "Online (Zoom)",
      openingDate: "12/10/2026",
      numberOfSessions: 5,
      teacherName: "Trần Giảng Viên",
      groupChatUrl: "https://zalo.me/g/abc123",
      supportPhone: "0939.866.825"
    });

    expect(status).toBe("mock");
    const email = written.join("\n");
    expect(email).toContain("To: \"Nguyễn Văn An\" <an@gmail.com>");
    expect(email).toContain("Thông tin xếp lớp AI Automation 89");
    expect(email).toContain("Thứ Hai, Thứ Năm · 19:30 – 21:30");
    expect(email).toContain("12/10/2026");
    expect(email).toContain("https://zalo.me/g/abc123");
    expect(email).toContain("Trần Giảng Viên");
    expect(email).toContain("0939.866.825");
    expect(email).not.toContain("mật khẩu mặc định");
  });

  it("says the Zalo link will follow when the class has none, and reminds first-time learners about the default password", async () => {
    await sendClassPlacementEmail({
      to: "binh@gmail.com",
      name: "Trần Thị Bình",
      courseTitle: "AI for Work",
      sectionCode: "AI for Work 12",
      scheduleText: "",
      teacherName: null,
      groupChatUrl: "javascript:alert(1)",
      supportPhone: "0939.866.825",
      firstLoginPending: true
    });

    const email = written.join("\n");
    expect(email).toContain("Link nhóm Zalo sẽ được MCNA gửi");
    expect(email).not.toContain("javascript:alert");
    expect(email).toContain("mật khẩu mặc định");
    expect(email).toContain("Đang cập nhật");
  });

  it("escapes names typed by staff so they cannot inject markup", async () => {
    await sendClassPlacementEmail({
      to: "c@gmail.com",
      name: "<b>Chi</b>",
      courseTitle: "Khóa <script>alert(1)</script>",
      sectionCode: "Lớp \"A\" & B",
      supportPhone: "0939.866.825"
    });

    // The log entry starts with the plain-text To/Subject lines; only the HTML document after them must be escaped.
    const html = written.map(entry => entry.slice(entry.indexOf("<!DOCTYPE html>"))).join("\n");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<b>Chi</b>");
    expect(html).toContain("&lt;b&gt;Chi&lt;/b&gt;");
    expect(html).toContain("Lớp &quot;A&quot; &amp; B");
    expect(html).toContain("<title>[MCNA] Thông tin xếp lớp Lớp &quot;A&quot; &amp; B – Khóa &lt;script&gt;alert(1)&lt;/script&gt;</title>");
  });

  it("escapes learner names and notification text in the older templates too", async () => {
    await sendPaymentConfirmationEmail({
      to: "d@gmail.com",
      name: "<img src=x onerror=alert(1)>",
      courseTitle: "AI <i>Automation</i>",
      amount: 3500000,
      sectionCode: "<u>89</u>",
      teacherName: "<b>GV</b>"
    });
    await sendEmailDirect("staff@mcna.vn", "Quản lý", "Học viên <a href=\"https://evil.example\">bấm vào đây</a>\nđã đăng ký");

    const all = written.map(entry => entry.slice(entry.indexOf("<!DOCTYPE html>"))).join("\n");
    expect(all).not.toContain("<img src=x onerror=alert(1)>");
    expect(all).not.toContain("<i>Automation</i>");
    expect(all).not.toContain("<u>89</u>");
    expect(all).not.toContain("<b>GV</b>");
    expect(all).not.toContain("<a href=\"https://evil.example\">");
    expect(all).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;bấm vào đây&lt;/a&gt;<br>đã đăng ký");
  });

  it("account email gives the login email, the default password and the courses", async () => {
    const status = await sendStudentAccountEmail({
      to: "an@gmail.com",
      name: "Nguyễn Văn An",
      password: "Mcna@2026",
      courseTitles: ["AI Automation", "AI for Work"],
      supportPhone: "0939.866.825"
    });

    expect(status).toBe("mock");
    const email = written.join("\n");
    expect(email).toContain("Tài khoản học viên MCNA LMS của bạn");
    expect(email).toContain("an@gmail.com");
    expect(email).toContain("Mcna@2026");
    expect(email).toContain("AI Automation, AI for Work");
    expect(email).toContain("https://lms.mcna.vn");
  });
});
