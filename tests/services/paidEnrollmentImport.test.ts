import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../../src/authHash";

const fakeDb = vi.hoisted(() => ({
  courses: [
    { id: "course_ai_auto", title: "AI Automation", price: 3500000, status: "published", tags: ["mcna", "AI_AUTO"] },
    { id: "course_ai_work", title: "AI for Work", price: 2990000, status: "published", tags: ["mcna", "AI_WORK"] }
  ],
  users: new Map<string, any>(),
  enrollments: new Map<string, any>(),
  queries: [] as { sql: string; params?: unknown[] }[],
  createdUsers: [] as any[],
  confirmedPayments: [] as any[],
  sentEmails: [] as any[]
}));

vi.mock("../../src/server/db", () => ({
  pool: {
    query: async (sql: string, params?: unknown[]) => {
      fakeDb.queries.push({ sql, params });
      if (sql.includes("FROM courses")) {
        return { rows: fakeDb.courses };
      }
      if (sql.includes("FROM course_sections")) {
        return { rows: [] };
      }
      if (sql.includes("FROM enrollments WHERE student_id")) {
        const studentId = params?.[0] as string;
        const courseId = params?.[1] as string;
        const key = `${studentId}|${courseId}`;
        const existing = fakeDb.enrollments.get(key);
        return { rows: existing ? [existing] : [] };
      }
      return { rows: [] };
    },
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        fakeDb.queries.push({ sql, params });
        return { rows: [] };
      },
      release: () => {}
    })
  }
}));

vi.mock("../../src/server/repositories/users", () => ({
  usersRepository: {
    findAuthByEmail: async (_db: unknown, email: string) => {
      return fakeDb.users.get(email.toLowerCase().trim()) || null;
    },
    create: async (_db: unknown, user: any) => {
      fakeDb.createdUsers.push(user);
      fakeDb.users.set(user.email.toLowerCase().trim(), {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: true
      });
      return user;
    }
  }
}));

vi.mock("../../src/server/repositories/audit", () => ({
  auditRepository: {
    log: async () => {}
  }
}));

vi.mock("../../src/server/crm/crmOutbox", () => ({
  enqueueCrmEvent: async () => {}
}));

vi.mock("../../src/server/services/enrollmentService", () => ({
  isServiceError: (val: any) => Boolean(val && typeof val === "object" && "error" in val),
  requestEnrollment: async (input: { studentId: string; courseId: string; sectionId?: string; origin?: string }) => {
    const id = `enroll_${input.studentId}_${input.courseId}`;
    fakeDb.enrollments.set(`${input.studentId}|${input.courseId}`, { id, status: "pending_payment" });
    return { enrollment: { id, status: "pending_payment" } };
  },
  confirmCoursePayment: async (_client: unknown, enrollmentId: string, options: any, _actor: string) => {
    fakeDb.confirmedPayments.push({ enrollmentId, options });
    for (const [key, val] of fakeDb.enrollments.entries()) {
      if (val.id === enrollmentId) {
        fakeDb.enrollments.set(key, { ...val, status: "pending" });
      }
    }
    return { ok: true, transactionId: `tx_${enrollmentId}` };
  }
}));

vi.mock("../../src/server/services/email", () => ({
  sendStudentAccountEmail: async (params: any) => {
    fakeDb.sentEmails.push(params);
    return "sent";
  }
}));

describe("paid enrollment import safety guarantees", () => {
  beforeEach(() => {
    fakeDb.users.clear();
    fakeDb.enrollments.clear();
    fakeDb.queries = [];
    fakeDb.createdUsers = [];
    fakeDb.confirmedPayments = [];
    fakeDb.sentEmails = [];
  });

  it("dryRun: true only previews and never creates accounts, enrollments, or sends emails", async () => {
    const { importPaidEnrollments } = await import("../../src/server/services/paidEnrollmentImport");

    const rows = [
      { name: "Nguyễn Văn A", email: "a@gmail.com", course: "AI Automation", amount: 3500000, crmRef: "rev_1" },
      { name: "Nguyễn Văn A", email: "a@gmail.com", course: "AI for Work", amount: 2990000, crmRef: "rev_2" }
    ];

    const preview = await importPaidEnrollments({
      rows,
      defaultPassword: "TemporaryPassword123",
      sendAccountEmail: true,
      dryRun: true,
      actorId: "admin_1",
      actorName: "Quản trị viên"
    });

    // Preview reports that 1 account would be created for the 2 courses
    expect(preview.summary.total).toBe(2);
    expect(preview.summary.accountsCreated).toBe(1);
    expect(preview.summary.enrollmentsCreated).toBe(2);
    expect(preview.results[0].status).toBe("ready");
    expect(preview.results[0].accountCreated).toBe(true);
    expect(preview.results[1].accountCreated).toBe(false);
    expect(preview.results[1].message).toContain("Dùng tài khoản tạo ở dòng trên");

    // CRITICAL SAFETY: zero database writes occurred
    expect(fakeDb.createdUsers).toHaveLength(0);
    expect(fakeDb.users.size).toBe(0);
    expect(fakeDb.enrollments.size).toBe(0);
    expect(fakeDb.confirmedPayments).toHaveLength(0);
    expect(fakeDb.sentEmails).toHaveLength(0);
    expect(fakeDb.queries.some(q => /insert|update|delete/i.test(q.sql))).toBe(false);
  });

  it("real import sets crmRef in revenue reference and does not use deal id", async () => {
    const { importPaidEnrollments } = await import("../../src/server/services/paidEnrollmentImport");

    const rows = [
      { name: "Trần Thị B", email: "b@gmail.com", course: "AI Automation", amount: 3500000, crmRef: "rev_999", note: "CRM rev_999" }
    ];

    const result = await importPaidEnrollments({
      rows,
      defaultPassword: "TemporaryPassword123",
      sendAccountEmail: true,
      dryRun: false,
      actorId: "manager_1",
      actorName: "Quản lý lớp"
    });

    expect(result.summary.accountsCreated).toBe(1);
    expect(result.summary.enrollmentsCreated).toBe(1);
    expect(fakeDb.createdUsers).toHaveLength(1);
    expect(fakeDb.createdUsers[0].email).toBe("b@gmail.com");

    // crmRef must be recorded in payment reference note, NOT as a CRM deal id
    expect(fakeDb.confirmedPayments).toHaveLength(1);
    expect(fakeDb.confirmedPayments[0].options.reference).toContain("CRM revenue rev_999");
  });

  it("sends the actual random temporary password when no default is configured", async () => {
    const { importPaidEnrollments } = await import("../../src/server/services/paidEnrollmentImport");
    await importPaidEnrollments({
      rows: [{ name: "Học Viên Mới", email: "new@gmail.com", course: "AI Automation", crmRef: "rev_new" }],
      sendAccountEmail: true,
      dryRun: false,
      actorId: "manager_1",
      actorName: "Quản lý lớp"
    });

    expect(fakeDb.createdUsers).toHaveLength(1);
    expect(fakeDb.sentEmails).toHaveLength(1);
    const password = fakeDb.sentEmails[0].password;
    expect(password).toMatch(/^Lms-[A-Za-z0-9_-]+-1$/);
    expect(hashPassword(password, fakeDb.createdUsers[0].passwordSalt).hash).toBe(fakeDb.createdUsers[0].passwordHash);
  });

  it("never guesses an existing student's password in the notification email", async () => {
    const { importPaidEnrollments } = await import("../../src/server/services/paidEnrollmentImport");
    fakeDb.users.set("existing@gmail.com", {
      id: "user_existing",
      email: "existing@gmail.com",
      name: "Học Viên Cũ",
      role: "student",
      is_active: true,
      must_change_password: true
    });
    await importPaidEnrollments({
      rows: [{ name: "Học Viên Cũ", email: "existing@gmail.com", course: "AI Automation", crmRef: "rev_existing" }],
      defaultPassword: "TemporaryPassword123",
      sendAccountEmail: true,
      dryRun: false,
      actorId: "manager_1",
      actorName: "Quản lý lớp"
    });

    expect(fakeDb.sentEmails).toHaveLength(1);
    expect(fakeDb.sentEmails[0].password).toBeNull();
  });

  it("re-importing the same list is idempotent: skips existing enrollments and creates no duplicates", async () => {
    const { importPaidEnrollments } = await import("../../src/server/services/paidEnrollmentImport");

    const rows = [
      { name: "Lê Văn C", email: "c@gmail.com", course: "AI Automation", amount: 3500000, crmRef: "rev_301" }
    ];

    // First import
    const first = await importPaidEnrollments({
      rows,
      defaultPassword: "TemporaryPassword123",
      sendAccountEmail: false,
      dryRun: false,
      actorId: "manager_1",
      actorName: "Quản lý lớp"
    });

    expect(first.summary.accountsCreated).toBe(1);
    expect(first.summary.enrollmentsCreated).toBe(1);
    expect(first.summary.skipped).toBe(0);
    expect(fakeDb.createdUsers).toHaveLength(1);

    // Second import with the exact same rows
    const second = await importPaidEnrollments({
      rows,
      defaultPassword: "TemporaryPassword123",
      sendAccountEmail: false,
      dryRun: false,
      actorId: "manager_1",
      actorName: "Quản lý lớp"
    });

    // Idempotent: 0 new accounts, 0 new enrollments, 1 skipped
    expect(second.summary.accountsCreated).toBe(0);
    expect(second.summary.enrollmentsCreated).toBe(0);
    expect(second.summary.skipped).toBe(1);
    expect(second.results[0].status).toBe("skipped");
    expect(second.results[0].message).toContain("Đã ghi danh khóa này");

    // User count remains strictly 1 (no duplicate user account created)
    expect(fakeDb.createdUsers).toHaveLength(1);
  });

  it("includes both new and already-enrolled (skipped) courses in student confirmation email", async () => {
    const { importPaidEnrollments } = await import("../../src/server/services/paidEnrollmentImport");

    fakeDb.users.set("student@gmail.com", {
      id: "user_student",
      email: "student@gmail.com",
      name: "Học Viên",
      role: "student",
      is_active: true
    });
    fakeDb.enrollments.set("user_student|course_ai_auto", {
      id: "enroll_existing",
      status: "active"
    });

    const rows = [
      { name: "Học Viên", email: "student@gmail.com", course: "AI Automation", amount: 3500000, crmRef: "rev_multi_1" },
      { name: "Học Viên", email: "student@gmail.com", course: "AI for Work", amount: 2990000, crmRef: "rev_multi_2" }
    ];

    const result = await importPaidEnrollments({
      rows,
      defaultPassword: "TemporaryPassword123",
      sendAccountEmail: true,
      dryRun: false,
      actorId: "manager_1",
      actorName: "Quản lý lớp"
    });

    expect(result.summary.skipped).toBe(1);
    expect(result.summary.enrollmentsCreated).toBe(1);
    expect(fakeDb.sentEmails).toHaveLength(1);
    expect(fakeDb.sentEmails[0].courseTitles).toEqual(
      expect.arrayContaining(["AI Automation", "AI for Work"])
    );
  });
});

