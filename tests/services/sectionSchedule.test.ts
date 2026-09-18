import { describe, it, expect } from "vitest";
import {
  normalizeDayText,
  dayOfWeekIndex,
  addDaysIso,
  isDateOnlyText,
  normalizeDateOnly
} from "../../src/server/services/sectionSchedule";

describe("Section Schedule Pure Helpers (sectionSchedule.ts)", () => {
  describe("normalizeDayText", () => {
    it("strips Vietnamese diacritics and converts to lowercase", () => {
      expect(normalizeDayText("Thứ Hai")).toBe("thu hai");
      expect(normalizeDayText("Thứ Bảy")).toBe("thu bay");
      expect(normalizeDayText("Chủ Nhật")).toBe("chu nhat");
      expect(normalizeDayText("THỨ SÁU")).toBe("thu sau");
    });

    it("handles falsy and empty inputs safely", () => {
      expect(normalizeDayText("")).toBe("");
      expect(normalizeDayText(null)).toBe("");
      expect(normalizeDayText(undefined)).toBe("");
    });
  });

  describe("dayOfWeekIndex", () => {
    it("correctly maps standard Vietnamese day names and abbreviations", () => {
      expect(dayOfWeekIndex("Chủ Nhật")).toBe(0);
      expect(dayOfWeekIndex("CN")).toBe(0);
      expect(dayOfWeekIndex("Sunday")).toBe(0);

      expect(dayOfWeekIndex("Thứ 2")).toBe(1);
      expect(dayOfWeekIndex("Thứ Hai")).toBe(1);
      expect(dayOfWeekIndex("T2")).toBe(1);
      expect(dayOfWeekIndex("Mon")).toBe(1);

      expect(dayOfWeekIndex("Thứ 3")).toBe(2);
      expect(dayOfWeekIndex("Thứ Ba")).toBe(2);
      expect(dayOfWeekIndex("T3")).toBe(2);

      expect(dayOfWeekIndex("Thứ 4")).toBe(3);
      expect(dayOfWeekIndex("Thứ Tư")).toBe(3);
      expect(dayOfWeekIndex("T4")).toBe(3);

      expect(dayOfWeekIndex("Thứ 5")).toBe(4);
      expect(dayOfWeekIndex("Thứ Năm")).toBe(4);
      expect(dayOfWeekIndex("T5")).toBe(4);

      expect(dayOfWeekIndex("Thứ 6")).toBe(5);
      expect(dayOfWeekIndex("Thứ Sáu")).toBe(5);
      expect(dayOfWeekIndex("T6")).toBe(5);

      expect(dayOfWeekIndex("Thứ 7")).toBe(6);
      expect(dayOfWeekIndex("Thứ Bảy")).toBe(6);
      expect(dayOfWeekIndex("T7")).toBe(6);
    });

    it("does not mix up Thu Nam and Thu Sau (regression prevention)", () => {
      expect(dayOfWeekIndex("Thứ Năm")).toBe(4);
      expect(dayOfWeekIndex("Thứ Sáu")).toBe(5);
      expect(dayOfWeekIndex("Thứ Ba")).toBe(2);
      expect(dayOfWeekIndex("Thứ Bảy")).toBe(6);
    });

    it("returns null for unrecognized or invalid day names", () => {
      expect(dayOfWeekIndex("Ngày mai")).toBeNull();
      expect(dayOfWeekIndex("InvalidDay")).toBeNull();
      expect(dayOfWeekIndex("")).toBeNull();
      expect(dayOfWeekIndex(null)).toBeNull();
    });
  });

  describe("addDaysIso", () => {
    it("adds days within the same month", () => {
      expect(addDaysIso("2026-09-10", 5)).toBe("2026-09-15");
    });

    it("correctly wraps across month boundary", () => {
      expect(addDaysIso("2026-01-30", 3)).toBe("2026-02-02");
    });

    it("correctly handles leap year in February", () => {
      expect(addDaysIso("2024-02-28", 1)).toBe("2024-02-29");
      expect(addDaysIso("2024-02-28", 2)).toBe("2024-03-01");
      // Non-leap year:
      expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01");
    });

    it("correctly wraps across year boundary", () => {
      expect(addDaysIso("2026-12-30", 5)).toBe("2027-01-04");
    });

    it("supports negative day offsets", () => {
      expect(addDaysIso("2026-01-02", -3)).toBe("2025-12-30");
    });
  });

  describe("isDateOnlyText & normalizeDateOnly", () => {
    it("validates valid YYYY-MM-DD format", () => {
      expect(isDateOnlyText("2026-09-18")).toBe(true);
      expect(isDateOnlyText("2026-09-18T10:00:00")).toBe(true);
      expect(isDateOnlyText("invalid-date")).toBe(false);
      expect(isDateOnlyText(null)).toBe(false);
    });

    it("normalizes date string with fallback", () => {
      expect(normalizeDateOnly("2026-10-25T14:30:00", "2026-01-01")).toBe("2026-10-25");
      expect(normalizeDateOnly("invalid", "2026-01-01")).toBe("2026-01-01");
      expect(normalizeDateOnly(null, "2026-05-01")).toBe("2026-05-01");
    });
  });
});
