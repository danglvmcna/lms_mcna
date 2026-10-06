import { describe, expect, it } from "vitest";
import { matchCourse, normalizeText, parseAmount, parsePaidTable } from "../../src/paidImport";

const courses = [
  { id: "course_mcna_ai_for_work", title: "AI for Work: Tối ưu hiệu suất & tự động hóa công việc", tags: ["mcna", "AI_WORK"] },
  { id: "course_mcna_ai_automation", title: "AI Automation: Xây dựng hệ thống tự động hóa doanh nghiệp", tags: ["mcna", "AI_AUTO"] },
  { id: "course_mcna_ai_agent", title: "AI Agent Masterclass: Xây dựng trợ lý ảo tự động 24/7", tags: ["mcna", "AI_AGENT"] },
  { id: "course_mcna_pbi_1", title: "Power BI Level 1: Phân tích & trực quan hóa dữ liệu", tags: ["mcna", "PBI_LV1"] },
  { id: "course_mcna_pbi_2", title: "Power BI Level 2: Giải pháp Business Intelligence", tags: ["mcna", "PBI_LV2"] }
];

describe("parsePaidTable", () => {
  it("reads cells pasted from a spreadsheet with a Vietnamese header row", () => {
    const result = parsePaidTable([
      "STT\tHọ và tên\tEmail\tSố điện thoại\tKhóa học\tSố tiền\tMã lớp",
      "1\tNguyễn Văn An\tAn.Nguyen@Gmail.com\t0912 345 678\tAI Automation\t3.500.000 đ\tAI Automation 01",
      "2\tTrần Thị Bình\tbinh@gmail.com\t\tAI for Work\t\t"
    ].join("\n"));

    expect(result.headerDetected).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { name: "Nguyễn Văn An", email: "an.nguyen@gmail.com", phone: "0912 345 678", course: "AI Automation", amount: 3500000, sectionCode: "AI Automation 01", note: undefined },
      { name: "Trần Thị Bình", email: "binh@gmail.com", phone: undefined, course: "AI for Work", amount: undefined, sectionCode: undefined, note: undefined }
    ]);
  });

  it("reads CSV with quoted cells and English headers in any order", () => {
    const result = parsePaidTable('email,name,course,amount\n"c@gmail.com","Lê, Văn C","AI Automation","3,500,000"\r\n');
    expect(result.headerDetected).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: "Lê, Văn C", email: "c@gmail.com", course: "AI Automation", amount: 3500000 });
  });

  it("falls back to the fixed column order when there is no header row", () => {
    const result = parsePaidTable("Phạm Thị D\td@gmail.com\t0987654321\tAI for Work");
    expect(result.headerDetected).toBe(false);
    expect(result.rows).toEqual([
      { name: "Phạm Thị D", email: "d@gmail.com", phone: "0987654321", course: "AI for Work", amount: undefined, sectionCode: undefined, note: undefined }
    ]);
  });

  it("reports invalid, incomplete and repeated rows with their line number", () => {
    const result = parsePaidTable([
      "Họ tên;Email;Khóa học",
      "Người Một;khong-phai-email;AI Automation",
      ";thieu.ten@gmail.com;AI Automation",
      "Người Ba;ba@gmail.com;",
      "Người Bốn;bon@gmail.com;AI Automation",
      "Người Bốn;BON@gmail.com;ai automation",
      "",
      "Người Bốn;bon@gmail.com;AI for Work"
    ].join("\n"));

    expect(result.rows.map(row => `${row.email}|${row.course}`)).toEqual(["bon@gmail.com|AI Automation", "bon@gmail.com|AI for Work"]);
    expect(result.errors.map(error => error.line)).toEqual([2, 3, 4, 6]);
    expect(result.errors[3].reason).toContain("Trùng dòng");
  });

  it("returns nothing for empty input", () => {
    expect(parsePaidTable("  \n \n")).toEqual({ rows: [], errors: [], headerDetected: false });
  });
});

describe("parseAmount", () => {
  it("accepts Vietnamese and plain number formats", () => {
    expect(parseAmount("3.500.000 đ")).toBe(3500000);
    expect(parseAmount("3,500,000")).toBe(3500000);
    expect(parseAmount("2990000")).toBe(2990000);
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount(undefined)).toBeUndefined();
  });
});

describe("matchCourse", () => {
  it("matches by id, catalogue code, full title and the title before its tagline", () => {
    expect(matchCourse("course_mcna_ai_automation", courses).course?.id).toBe("course_mcna_ai_automation");
    expect(matchCourse("ai_auto", courses).course?.id).toBe("course_mcna_ai_automation");
    expect(matchCourse("AI for Work: Tối ưu hiệu suất & tự động hóa công việc", courses).course?.id).toBe("course_mcna_ai_for_work");
    expect(matchCourse("AI Automation", courses).course?.id).toBe("course_mcna_ai_automation");
    expect(matchCourse("  ai   for work ", courses).course?.id).toBe("course_mcna_ai_for_work");
    expect(matchCourse("AI4WORK", courses).course?.id).toBe("course_mcna_ai_for_work");
    expect(matchCourse("AIAGENT", courses).course?.id).toBe("course_mcna_ai_agent");
    expect(matchCourse("AIAUTOMATION", courses).course?.id).toBe("course_mcna_ai_automation");
    expect(matchCourse("AIAUTO", courses).course?.id).toBe("course_mcna_ai_automation");
  });

  it("ignores Vietnamese diacritics and letter case", () => {
    expect(matchCourse("power bi level 1 phan tich & truc quan hoa du lieu", courses).course?.id).toBe("course_mcna_pbi_1");
  });

  it("accepts a partial title only when it singles out one course", () => {
    expect(matchCourse("Business Intelligence", courses).course?.id).toBe("course_mcna_pbi_2");
    const ambiguous = matchCourse("Power BI", courses);
    expect(ambiguous.course).toBeNull();
    expect(ambiguous).toMatchObject({ reason: "ambiguous" });
    expect(ambiguous.candidates.map(course => course.id)).toEqual(["course_mcna_pbi_1", "course_mcna_pbi_2"]);
  });

  it("does not match the shared catalogue tag or unknown names", () => {
    expect(matchCourse("mcna", courses)).toMatchObject({ course: null, reason: "none" });
    expect(matchCourse("Khóa không có", courses)).toMatchObject({ course: null, reason: "none" });
    expect(matchCourse("", courses)).toMatchObject({ course: null, reason: "none" });
  });
});

describe("normalizeText", () => {
  it("strips diacritics, including đ, and collapses separators", () => {
    expect(normalizeText("  Số   ĐIỆN-thoại ")).toBe("so dien thoai");
    expect(normalizeText("AI_WORK")).toBe("ai work");
  });
});
