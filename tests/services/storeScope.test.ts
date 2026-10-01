import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { limitStoreForRole } from "../../src/server/repositories/storeSnapshot";
import { User } from "../../src/types";

const user = (id: string, role: User["role"]): User => ({
  id,
  email: `${id}@mcna.test`,
  passwordHash: "secret-hash",
  name: id,
  role,
  isActive: true,
  createdAt: "2026-10-01T00:00:00.000Z"
});

// Two courses. Course A has two classes (A1 taught by teacherA, A2 by teacherB); course B is only in the catalogue.
function buildStore() {
  return {
    users: [user("admin", "admin"), user("manager", "manager"), user("teacherA", "teacher"), user("teacherB", "teacher"), user("placed", "student"), user("waiting", "student"), user("other", "student")],
    courses: [
      { id: "courseA", title: "AI Automation", teacherId: "teacherA", status: "published", welcomeLetter: "Chào {{ten_hoc_vien}}" },
      { id: "courseB", title: "AI for Work", teacherId: "teacherA", status: "published" }
    ],
    lessons: [{ id: "lessonA1", courseId: "courseA", content: "Nội dung", order: 1 }],
    enrollments: [
      { id: "enrollPlaced", courseId: "courseA", studentId: "placed", status: "active" },
      { id: "enrollWaiting", courseId: "courseA", studentId: "waiting", status: "pending" },
      { id: "enrollOther", courseId: "courseA", studentId: "other", status: "active" }
    ],
    lessonProgress: [],
    quizzes: [],
    questions: [],
    quizAttempts: [],
    assignments: [
      { id: "homeworkA1", courseId: "courseA", sessionId: "sessionA1" },
      { id: "homeworkA2", courseId: "courseA", sessionId: "sessionA2" }
    ],
    submissions: [],
    certificates: [],
    notifications: [{ id: "n1", userId: "admin" }, { id: "n2", userId: "manager" }],
    forumPosts: [],
    auditLogs: [{ id: "log1" }],
    transactions: [{ id: "tx1", studentId: "placed", courseId: "courseA" }],
    attendanceSessions: [
      { id: "sessionA1", courseId: "courseA", sectionId: "sectionA1", code: "QR" },
      { id: "sessionA2", courseId: "courseA", sectionId: "sectionA2" }
    ],
    attendanceRecords: [],
    sessionMaterials: [
      { id: "slideA1", sessionId: "sessionA1", courseId: "courseA", type: "slide" },
      { id: "slideA2", sessionId: "sessionA2", courseId: "courseA", type: "slide" },
      { id: "introA", courseId: "courseA", type: "document", category: "reference" }
    ],
    courseSections: [
      { id: "sectionA1", courseId: "courseA", teacherId: "teacherB", sectionCode: "A1", meetingUrl: "https://zoom/a1", groupChatUrl: "https://zalo/a1" },
      { id: "sectionA2", courseId: "courseA", teacherId: "teacherA", sectionCode: "A2", meetingUrl: "https://zoom/a2", groupChatUrl: "https://zalo/a2" }
    ],
    courseRegistrations: [
      { id: "regPlaced", studentId: "placed", sectionId: "sectionA1", status: "registered" },
      { id: "regOther", studentId: "other", sectionId: "sectionA2", status: "registered" }
    ],
    systemEvents: [{ id: "event1" }],
    teacherAttendance: []
  };
}

const ids = (items: any[]) => items.map(item => item.id).sort();

describe("limitStoreForRole", () => {
  const originalMode = process.env.SALES_MODE;

  beforeEach(() => {
    delete process.env.SALES_MODE; // direct sale is the default
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.SALES_MODE;
    else process.env.SALES_MODE = originalMode;
  });

  it("class manager sees learners and teachers, but no system accounts and no audit trail", () => {
    const scoped = limitStoreForRole(buildStore(), user("manager", "manager"));
    expect(ids(scoped.users)).toEqual(["manager", "other", "placed", "teacherA", "teacherB", "waiting"]);
    expect(scoped.users.every((item: User) => item.passwordHash === "")).toBe(true);
    expect(scoped.auditLogs).toEqual([]);
    expect(ids(scoped.notifications)).toEqual(["n2"]);
    expect(scoped.enrollments).toHaveLength(3);
    expect(scoped.transactions).toHaveLength(1);
  });

  it("admin still sees everything", () => {
    const scoped = limitStoreForRole(buildStore(), user("admin", "admin"));
    expect(scoped.users).toHaveLength(7);
    expect(scoped.auditLogs).toHaveLength(1);
  });

  it("a learner placed in a class sees that class, its materials and the opening materials", () => {
    const scoped = limitStoreForRole(buildStore(), user("placed", "student"));
    expect(ids(scoped.courses)).toEqual(["courseA"]);
    expect(scoped.courses[0].welcomeLetter).toBe("Chào {{ten_hoc_vien}}");
    expect(ids(scoped.courseSections)).toEqual(["sectionA1"]);
    expect(scoped.courseSections[0].groupChatUrl).toBe("https://zalo/a1");
    expect(ids(scoped.attendanceSessions)).toEqual(["sessionA1"]);
    expect(scoped.attendanceSessions[0].code).toBeUndefined();
    expect(ids(scoped.sessionMaterials)).toEqual(["introA", "slideA1"]);
    expect(ids(scoped.assignments)).toEqual(["homeworkA1"]);
    expect(ids(scoped.users)).toEqual(["placed", "teacherA", "teacherB"]);
  });

  it("a learner waiting for placement sees no class, no materials and no catalogue in direct sale", () => {
    const scoped = limitStoreForRole(buildStore(), user("waiting", "student"));
    expect(ids(scoped.enrollments)).toEqual(["enrollWaiting"]);
    expect(ids(scoped.courses)).toEqual(["courseA"]);
    expect(scoped.courses[0].welcomeLetter).toBeUndefined();
    expect(scoped.courseSections).toEqual([]);
    expect(scoped.attendanceSessions).toEqual([]);
    expect(scoped.sessionMaterials).toEqual([]);
    expect(scoped.assignments).toEqual([]);
  });

  it("self-service mode keeps the catalogue visible, without class links", () => {
    process.env.SALES_MODE = "self_service";
    const scoped = limitStoreForRole(buildStore(), user("waiting", "student"));
    expect(ids(scoped.courses)).toEqual(["courseA", "courseB"]);
    expect(ids(scoped.courseSections)).toEqual(["sectionA1", "sectionA2"]);
    expect(scoped.courseSections.every((section: any) => section.meetingUrl === undefined && section.groupChatUrl === undefined)).toBe(true);
    expect(scoped.sessionMaterials).toEqual([]);
  });

  it("a teacher who only teaches a class sees that class and its learners, not the other classes of the course", () => {
    const scoped = limitStoreForRole(buildStore(), user("teacherB", "teacher"));
    expect(ids(scoped.courses)).toEqual(["courseA"]);
    expect(ids(scoped.courseSections)).toEqual(["sectionA1"]);
    expect(ids(scoped.attendanceSessions)).toEqual(["sessionA1"]);
    expect(ids(scoped.enrollments)).toEqual(["enrollPlaced"]);
    expect(ids(scoped.users)).toEqual(["placed", "teacherB"]);
    expect(ids(scoped.assignments)).toEqual(["homeworkA1"]);
    expect(ids(scoped.sessionMaterials)).toEqual(["introA", "slideA1"]);
  });

  it("even the course owner only sees their assigned class in direct sale", () => {
    const scoped = limitStoreForRole(buildStore(), user("teacherA", "teacher"));
    expect(ids(scoped.courses)).toEqual(["courseA", "courseB"]);
    expect(ids(scoped.attendanceSessions)).toEqual(["sessionA2"]);
    expect(ids(scoped.enrollments)).toEqual(["enrollOther"]);
    expect(ids(scoped.assignments)).toEqual(["homeworkA2"]);
    expect(ids(scoped.users)).toEqual(["other", "teacherA"]);
    expect(ids(scoped.courseSections)).toEqual(["sectionA2"]);
  });
});
