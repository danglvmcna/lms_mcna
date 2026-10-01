import { describe, expect, it } from "vitest";
import { crmRecordsToPaidRows, isFullyPaid, soldCourses } from "../../src/crmPaidSource";
import { matchCourse } from "../../src/paidImport";

const FULLY_PAID = "Đã hoàn tất thanh toán - Fully Paid";

const record = (overrides: Record<string, unknown> = {}) => ({
  id: "rev_1",
  saleDate: "15/9/2026",
  customerName: "Nguyễn Văn An",
  customerPhone: "0912345678",
  customerEmail: "An.Nguyen@Gmail.com",
  customerType: "Đào tạo cá nhân B2C",
  courseSold: ["AIAUTOMATION"],
  totalRevenue: "3500000",
  debt: "0",
  paymentMethod: FULLY_PAID,
  ...overrides
});

describe("isFullyPaid", () => {
  it("accepts a settled sale without debt", () => {
    expect(isFullyPaid({ debt: "0", paymentMethod: FULLY_PAID })).toBe(true);
    expect(isFullyPaid({ debt: 0, paymentMethod: "fully paid" })).toBe(true);
  });

  it("rejects a sale with remaining debt or another payment status", () => {
    expect(isFullyPaid({ debt: "500000", paymentMethod: FULLY_PAID })).toBe(false);
    expect(isFullyPaid({ debt: "0", paymentMethod: "Đặt cọc - Deposit" })).toBe(false);
    expect(isFullyPaid({ debt: "0", paymentMethod: "" })).toBe(false);
  });
  it("does not accept negated paid statuses or unknown/invalid debt", () => {
    for (const paymentMethod of ["Chưa hoàn tất thanh toán", "not fully paid", "fully paid pending refund"]) expect(isFullyPaid({ debt: 0, paymentMethod })).toBe(false);
    for (const debt of [null, undefined, "", "abc", "Infinity", -1]) expect(isFullyPaid({ debt, paymentMethod: FULLY_PAID })).toBe(false);
  });
});

describe("soldCourses", () => {
  it("reads the array the CRM stores, without blanks or repeats", () => {
    expect(soldCourses(["AI4WORK", " AIAGENT ", "", "AI4WORK"])).toEqual(["AI4WORK", "AIAGENT"]);
  });

  it("also accepts a plain text list", () => {
    expect(soldCourses("PBI_LV1, PBI_LV2")).toEqual(["PBI_LV1", "PBI_LV2"]);
    expect(soldCourses(null)).toEqual([]);
  });
});

describe("crmRecordsToPaidRows", () => {
  it("makes one row for a single-course sale and keeps the amount", () => {
    const pull = crmRecordsToPaidRows([record()]);
    expect(pull.records).toBe(1);
    expect(pull.skipped).toEqual([]);
    expect(pull.rows).toEqual([{
      name: "Nguyễn Văn An",
      email: "an.nguyen@gmail.com",
      phone: "0912345678",
      course: "AIAUTOMATION",
      amount: 3500000,
      note: "CRM rev_1 · bán ngày 15/9/2026",
      crmRef: "rev_1"
    }]);
  });

  it("makes one row per course for a multi-course sale, without splitting the total", () => {
    const pull = crmRecordsToPaidRows([record({ id: "rev_2", courseSold: ["AI4WORK", "AIAGENT", "AIAUTOMATION"], totalRevenue: 5939000 })]);
    expect(pull.rows.map(row => row.course)).toEqual(["AI4WORK", "AIAGENT", "AIAUTOMATION"]);
    expect(pull.rows.every(row => row.amount === undefined && row.crmRef === "rev_2")).toBe(true);
    expect(pull.rows[0].note).toContain("cho 3 khóa");
  });

  it("leaves out unpaid sales, sales without an email and sales without a course, each with a reason", () => {
    const pull = crmRecordsToPaidRows([
      record({ id: "rev_debt", debt: 1000000 }),
      record({ id: "rev_deposit", paymentMethod: "Đặt cọc - Deposit" }),
      record({ id: "rev_no_email", customerEmail: " " }),
      record({ id: "rev_no_course", courseSold: [] })
    ]);
    expect(pull.rows).toEqual([]);
    expect(pull.skipped.map(item => item.crmRef)).toEqual(["rev_debt", "rev_deposit", "rev_no_email", "rev_no_course"]);
    expect(pull.skipped[0].reason).toContain("còn nợ");
    expect(pull.skipped[1].reason).toContain("Đặt cọc");
    expect(pull.skipped[2].reason).toContain("email");
    expect(pull.skipped[3].reason).toContain("khóa học");
  });

  it("does not repeat a learner and course that appear in two records", () => {
    const pull = crmRecordsToPaidRows([record({ id: "rev_a" }), record({ id: "rev_b", customerEmail: "an.nguyen@gmail.com" })]);
    expect(pull.rows).toHaveLength(1);
    expect(pull.rows[0].crmRef).toBe("rev_a");
  });
  it("skips malformed identities and amounts instead of poisoning the whole import", () => {
    const pull = crmRecordsToPaidRows([record({customerEmail: "invalid"}), record({customerName: ""}), record({totalRevenue: "Infinity"}), record({totalRevenue: -1}), record({courseSold: ["A".repeat(301)]})]);
    expect(pull.rows).toHaveLength(0);
    expect(pull.skipped).toHaveLength(5);
  });
});

describe("matchCourse with the codes the CRM uses", () => {
  const courses = [
    { id: "course_mcna_ai_for_work", title: "AI for Work: Tối ưu hiệu suất & tự động hóa công việc", tags: ["mcna", "AI_WORK"] },
    { id: "course_mcna_ai_agent", title: "AI Agent Masterclass: Xây dựng trợ lý ảo tự động 24/7", tags: ["mcna", "AI_AGENT"] },
    { id: "course_mcna_ai_automation", title: "AI Automation: Xây dựng hệ thống tự động hóa doanh nghiệp", tags: ["mcna", "AI_AUTO"] },
    { id: "course_mcna_ai_research", title: "AI for Research: Biến đề tài thành sản phẩm thật trong 3 buổi", tags: ["mcna", "AI_RSCH"] },
    { id: "course_mcna_pbi_lv1", title: "Power BI Level 1: Phân tích & trực quan hóa dữ liệu", tags: ["mcna", "PBI_LV1"] },
    { id: "course_mcna_pbi_lv2", title: "Power BI Level 2: Giải pháp Business Intelligence", tags: ["mcna", "PBI_LV2"] }
  ];
  const idOf = (code: string) => matchCourse(code, courses).course?.id;

  it("resolves codes written without separators", () => {
    expect(idOf("AI4WORK")).toBe("course_mcna_ai_for_work");
    expect(idOf("AIAGENT")).toBe("course_mcna_ai_agent");
    expect(idOf("AIAUTOMATION")).toBe("course_mcna_ai_automation");
    expect(idOf("AI FOR RESEARCH")).toBe("course_mcna_ai_research");
    expect(idOf("PBI_LV1")).toBe("course_mcna_pbi_lv1");
  });

  it("still refuses text that is not a course, such as a custom corporate training", () => {
    expect(matchCourse("Đào tạo COPILOT cho khối sản xuất", courses)).toMatchObject({ course: null, reason: "none" });
    expect(matchCourse("MCNA", courses)).toMatchObject({ course: null });
  });
  it("does not silently select one course when a compact code is ambiguous", () => {
    expect(matchCourse("AIAGENT", [...courses, {...courses[1], id:"duplicate"}])).toMatchObject({course:null, reason:"ambiguous"});
  });
});
