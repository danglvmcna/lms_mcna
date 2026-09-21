import { describe, it, expect } from "vitest";
import {
  percentToLetterGrade,
  percentToGradePoint,
  normalizeWarningType,
  warningTypesMatch,
  warningTypeLabel,
  calculateCourseGradePercent
} from "../../src/gradeUtils";

describe("Grade Utilities & Academic Calculations (gradeUtils.ts)", () => {
  describe("percentToLetterGrade", () => {
    it("maps percentage scores to standard letter grades correctly", () => {
      expect(percentToLetterGrade(100)).toBe("A");
      expect(percentToLetterGrade(90)).toBe("A");
      expect(percentToLetterGrade(89)).toBe("B");
      expect(percentToLetterGrade(80)).toBe("B");
      expect(percentToLetterGrade(79)).toBe("C");
      expect(percentToLetterGrade(70)).toBe("C");
      expect(percentToLetterGrade(69)).toBe("D");
      expect(percentToLetterGrade(60)).toBe("D");
      expect(percentToLetterGrade(59)).toBe("F");
      expect(percentToLetterGrade(0)).toBe("F");
    });
  });

  describe("percentToGradePoint", () => {
    it("converts letter grades to GPA 4.0 scale", () => {
      expect(percentToGradePoint("A")).toBe(4.0);
      expect(percentToGradePoint("B")).toBe(3.0);
      expect(percentToGradePoint("C")).toBe(2.0);
      expect(percentToGradePoint("D")).toBe(1.0);
      expect(percentToGradePoint("F")).toBe(0.0);
      expect(percentToGradePoint("W")).toBe(0.0);
      expect(percentToGradePoint("UNKNOWN")).toBe(0.0);
    });
  });

  describe("Warning Type Normalization and Matching", () => {
    it("normalizes alias forms to canonical warning types", () => {
      expect(normalizeWarningType("low-gpa")).toBe("low_gpa");
      expect(normalizeWarningType("low_gpa")).toBe("low_gpa");
      expect(normalizeWarningType("unpaid-fee")).toBe("unpaid_fee");
      expect(normalizeWarningType("unpaid_fee")).toBe("unpaid_fee");
      expect(normalizeWarningType("overdue-assignment")).toBe("overdue_assignment");
      expect(normalizeWarningType("unknown-type")).toBe("low_gpa");
    });

    it("matches warning types across dash and underscore variations", () => {
      expect(warningTypesMatch("low-gpa", "low_gpa")).toBe(true);
      expect(warningTypesMatch("unpaid-fee", "unpaid_fee")).toBe(true);
      expect(warningTypesMatch("low_gpa", "unpaid_fee")).toBe(false);
    });

    it("provides human-readable Vietnamese labels", () => {
      expect(warningTypeLabel("low_gpa")).toBe("Kết quả học tập");
      expect(warningTypeLabel("unpaid_fee")).toBe("Học phí");
      expect(warningTypeLabel("exam_ban")).toBe("Cấm thi");
      expect(warningTypeLabel("overdue_assignment")).toBe("Bài tập quá hạn");
      expect(warningTypeLabel("unknown")).toBe("Kết quả học tập");
    });
  });

  describe("calculateCourseGradePercent", () => {
    it("computes weighted final grade: 30% assignment + 70% quiz", () => {
      const result = calculateCourseGradePercent({
        assignmentScoresPercent: [80, 100], // avg = 90
        quizScores: [80, 80],               // avg = 80
        hasCourseAssignments: true,
        hasCourseQuizzes: true,
        isPending: false
      });

      // 90 * 0.3 + 80 * 0.7 = 27 + 56 = 83
      expect(result.finalPercent).toBe(83);
      expect(result.hasGrades).toBe(true);
      expect(result.assignmentAvg).toBe(90);
      expect(result.quizAvg).toBe(80);
      expect(result.letterGrade).toBe("B");
      expect(result.gradePoint).toBe(3.0);
      expect(result.countsForGpa).toBe(true);
    });

    it("handles courses with only quizzes (100% quiz weight)", () => {
      const result = calculateCourseGradePercent({
        assignmentScoresPercent: [],
        quizScores: [92, 98], // avg = 95
        hasCourseAssignments: false,
        hasCourseQuizzes: true,
        isPending: false
      });

      expect(result.finalPercent).toBe(95);
      expect(result.assignmentAvg).toBeNull();
      expect(result.quizAvg).toBe(95);
      expect(result.letterGrade).toBe("A");
      expect(result.gradePoint).toBe(4.0);
      expect(result.countsForGpa).toBe(true);
    });

    it("handles courses with only assignments (100% assignment weight)", () => {
      const result = calculateCourseGradePercent({
        assignmentScoresPercent: [70],
        quizScores: [],
        hasCourseAssignments: true,
        hasCourseQuizzes: false,
        isPending: false
      });

      expect(result.finalPercent).toBe(70);
      expect(result.assignmentAvg).toBe(70);
      expect(result.quizAvg).toBeNull();
      expect(result.letterGrade).toBe("C");
      expect(result.gradePoint).toBe(2.0);
      expect(result.countsForGpa).toBe(true);
    });

    it("marks failing grades (< 60) as F and does not count towards GPA", () => {
      const result = calculateCourseGradePercent({
        assignmentScoresPercent: [50],
        quizScores: [50],
        hasCourseAssignments: true,
        hasCourseQuizzes: true,
        isPending: false
      });

      expect(result.finalPercent).toBe(50);
      expect(result.letterGrade).toBe("F");
      expect(result.gradePoint).toBe(0.0);
      expect(result.countsForGpa).toBe(false);
    });

    it("marks in-progress courses as IP with null gradePoint and false countsForGpa", () => {
      const result = calculateCourseGradePercent({
        assignmentScoresPercent: [85],
        quizScores: [90],
        hasCourseAssignments: true,
        hasCourseQuizzes: true,
        isPending: true
      });

      expect(result.letterGrade).toBe("IP");
      expect(result.gradePoint).toBeNull();
      expect(result.countsForGpa).toBe(false);
    });

    it("returns null grades for courses with no assignments and no quizzes", () => {
      const result = calculateCourseGradePercent({
        assignmentScoresPercent: [],
        quizScores: [],
        hasCourseAssignments: false,
        hasCourseQuizzes: false,
        isPending: false
      });

      expect(result.finalPercent).toBeNull();
      expect(result.hasGrades).toBe(false);
      expect(result.letterGrade).toBeNull();
      expect(result.gradePoint).toBeNull();
      expect(result.countsForGpa).toBe(false);
    });
  });
});
