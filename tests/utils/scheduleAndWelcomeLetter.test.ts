import { describe, expect, it } from "vitest";
import { commonScheduleRoom, formatDateVi, formatScheduleSummary } from "../../src/scheduleText";
import { DEFAULT_WELCOME_LETTER, renderWelcomeLetter, WELCOME_LETTER_PLACEHOLDERS } from "../../src/welcomeLetter";

describe("formatScheduleSummary", () => {
  it("groups days that share the same hours", () => {
    expect(formatScheduleSummary([
      { dayOfWeek: "Thứ Ba", startTime: "19:30", endTime: "21:30", room: "Online (Zoom)" },
      { dayOfWeek: "Thứ Năm", startTime: "19:30", endTime: "21:30", room: "Online (Zoom)" }
    ])).toBe("Thứ Ba, Thứ Năm · 19:30 – 21:30");
  });

  it("keeps different hours apart", () => {
    expect(formatScheduleSummary([
      { dayOfWeek: "Thứ Bảy", startTime: "09:00", endTime: "11:00" },
      { dayOfWeek: "Chủ Nhật", startTime: "14:00", endTime: "16:00" }
    ])).toBe("Thứ Bảy · 09:00 – 11:00; Chủ Nhật · 14:00 – 16:00");
  });

  it("returns an empty text when the class has no timetable", () => {
    expect(formatScheduleSummary([])).toBe("");
    expect(formatScheduleSummary(null)).toBe("");
  });
});

describe("commonScheduleRoom", () => {
  it("returns the room only when every slot shares it", () => {
    expect(commonScheduleRoom([{ room: "Online (Zoom)" }, { room: "Online (Zoom)" }])).toBe("Online (Zoom)");
    expect(commonScheduleRoom([{ room: "P201" }, { room: "P305" }])).toBe("");
    expect(commonScheduleRoom([])).toBe("");
  });
});

describe("formatDateVi", () => {
  it("formats date-only text without shifting the day", () => {
    expect(formatDateVi("2026-10-06")).toBe("06/10/2026");
    expect(formatDateVi("2026-10-06T19:30:00")).toBe("06/10/2026");
  });

  it("returns an empty text for a missing date", () => {
    expect(formatDateVi(undefined)).toBe("");
    expect(formatDateVi(null)).toBe("");
  });
});

describe("renderWelcomeLetter", () => {
  const vars = {
    studentName: "Nguyễn Văn An",
    courseTitle: "AI Automation",
    sectionCode: "AI Automation 89",
    teacherName: "Trần Giảng Viên",
    openingDate: "12/10/2026",
    schedule: "Thứ Hai, Thứ Năm · 19:30 – 21:30",
    supportPhone: "0939.866.825"
  };

  it("fills every placeholder of the default letter", () => {
    const letter = renderWelcomeLetter("", vars);
    expect(letter).toContain("Chào Nguyễn Văn An,");
    expect(letter).toContain("lớp AI Automation 89");
    expect(letter).toContain("0939.866.825");
    expect(letter).not.toMatch(/\{\{.*\}\}/);
  });

  it("uses the course's own letter and repeats placeholders", () => {
    expect(renderWelcomeLetter("{{ten_hoc_vien}} / {{ma_lop}} / {{ma_lop}}", vars)).toBe("Nguyễn Văn An / AI Automation 89 / AI Automation 89");
  });

  it("writes a neutral text for information the class does not have yet", () => {
    expect(renderWelcomeLetter("GV: {{giang_vien}}", { studentName: "An" })).toBe("GV: đang cập nhật");
  });

  it("documents every placeholder used by the default letter", () => {
    const used = DEFAULT_WELCOME_LETTER.match(/\{\{[a-z_]+\}\}/g) || [];
    const known = WELCOME_LETTER_PLACEHOLDERS.map(item => item.token);
    for (const token of used) expect(known).toContain(token);
  });
});
