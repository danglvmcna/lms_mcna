import express from "express";
import { ZodSchema, z } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", issues: z.treeifyError(parsed.error) });
    }
    req.body = parsed.data;
    next();
  };
}

export const schemas = {
  login: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1)
  }),
  completePasswordReset: z.object({
    token: z.string().trim().min(32),
    newPassword: z.string().min(8)
  }),
  createUser: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8),
    name: z.string().trim().min(1),
    role: z.enum(["admin", "teacher", "student"]),
    phone: z.string().trim().optional()
  }),
  bulkCreateUsers: z.object({
    users: z.array(z.object({
      email: z.email().trim().toLowerCase(),
      name: z.string().trim().min(1),
      role: z.enum(["admin", "teacher", "student"]),
      phone: z.string().trim().optional()
    })).min(1).max(5000),
    defaultPassword: z.string().min(8).optional()
  }),
  setUserActive: z.object({
    isActive: z.boolean()
  }),
  adminNotification: z.object({
    idempotencyKey: z.uuid(),
    message: z.string().trim().min(1).max(2000),
    type: z.enum(["info", "success", "warning", "danger"]).default("info"),
    role: z.enum(["all", "student", "teacher", "admin"]).optional(),
    userIds: z.array(z.string().trim().min(1)).min(1).max(100).optional()
  }).refine(value => Boolean(value.role) !== Boolean(value.userIds), {
    message: "Provide exactly one audience: role or userIds."
  }),
  createCourse: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    teacherId: z.string().trim().optional(),
    category: z.string().trim().min(1).default("General"),
    thumbnail: z.string().trim().optional(),
    price: z.coerce.number().min(0).default(0),
    originalPrice: z.coerce.number().min(0).optional().nullable(),
    level: z.string().trim().optional(),
    tags: z.array(z.string().trim()).default([]),
    openingDate: z.string().trim().optional(),
    numberOfLessons: z.coerce.number().int().min(1).optional()
  }),
  rejectCourse: z.object({
    rejectionReason: z.string().trim().min(1)
  }),
  addLesson: z.object({
    courseId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    videoUrl: z.string().trim().optional(),
    order: z.coerce.number().int().min(0),
    duration: z.string().trim().min(1)
  }),
  updateLesson: z.object({
    title: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    videoUrl: z.string().trim().optional(),
    order: z.coerce.number().int().min(0).optional(),
    duration: z.string().trim().min(1).optional()
  }),
  createQuiz: z.object({
    courseId: z.string().trim().min(1),
    lessonId: z.string().trim().optional(),
    sessionId: z.string().trim().optional(),
    title: z.string().trim().min(1),
    passingScore: z.coerce.number().min(0).max(100),
    timeLimit: z.coerce.number().int().min(1),
    maxAttempts: z.coerce.number().int().min(1),
    deadline: z.string().trim().nullish()
  }),
  updateQuiz: z.object({
    lessonId: z.string().trim().optional().nullable(),
    sessionId: z.string().trim().optional().nullable(),
    title: z.string().trim().min(1).optional(),
    passingScore: z.coerce.number().min(0).max(100).optional(),
    timeLimit: z.coerce.number().int().min(1).optional(),
    maxAttempts: z.coerce.number().int().min(1).optional(),
    deadline: z.string().trim().nullish()
  }),
  bulkAddQuestions: z.object({
    questions: z.array(z.object({
      text: z.string().trim().min(1),
      type: z.enum(["single", "multiple", "text"]),
      options: z.array(z.string()).default([]),
      correctAnswer: z.string().trim().min(1)
    }))
  }),
  addQuestion: z.object({
    text: z.string().trim().min(1),
    type: z.enum(["single", "multiple", "text"]),
    options: z.array(z.string()).default([]),
    correctAnswer: z.string().trim().min(1)
  }),
  registerEnrollment: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().optional()
  }),
  approveEnrollment: z.object({
    sectionId: z.string().trim().min(1).optional()
  }),
  issueCertificate: z.object({
    enrollmentId: z.string().trim().min(1)
  }),
  toggleProgress: z.object({
    enrollmentId: z.string().trim().min(1),
    lessonId: z.string().trim().min(1)
  }),
  submitQuiz: z.object({
    quizId: z.string().trim().min(1),
    answers: z.record(z.string(), z.string()).default({}),
    startedAt: z.string().trim().optional()
  }),
  createAssignment: z.object({
    courseId: z.string().trim().min(1),
    sessionId: z.string().trim().optional(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    deadline: z.string().trim().min(1),
    maxScore: z.coerce.number().min(1),
    attachmentUrl: z.string().trim().optional(),
    lessonId: z.string().trim().optional(),
    type: z.enum(["lesson", "chapter", "midterm", "final"]).optional()
  }),
  updateAssignment: z.object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    deadline: z.string().trim().min(1).optional(),
    maxScore: z.coerce.number().min(1).optional(),
    attachmentUrl: z.string().trim().optional().nullable(),
    lessonId: z.string().trim().optional().nullable(),
    sessionId: z.string().trim().optional().nullable(),
    type: z.enum(["lesson", "chapter", "midterm", "final"]).optional()
  }),

  submitAssignment: z.object({
    assignmentId: z.string().trim().min(1),
    content: z.string().trim().min(1),
    attachmentUrl: z.string().trim().optional()
  }),
  gradeAssignment: z.object({
    submissionId: z.string().trim().min(1),
    score: z.coerce.number().min(0),
    feedback: z.string().trim().default("")
  }),
  reviewTransaction: z.object({
    status: z.enum(["approved", "rejected"]),
    notes: z.string().trim().optional()
  }),
  attendanceSession: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    date: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    content: z.string().trim().optional(),
    videoUrl: z.string().trim().optional(),
    recordingUrl: z.string().trim().optional(),
    records: z.array(z.object({
      studentId: z.string().trim().min(1),
      status: z.enum(["present", "absent", "late", "excused"]),
      note: z.string().trim().optional()
    })).default([])
  }),
  attendanceRecord: z.object({
    sessionId: z.string().trim().min(1),
    studentId: z.string().trim().min(1),
    status: z.enum(["present", "absent", "late", "excused"]),
    note: z.string().trim().optional()
  }),
  courseRegistration: z.object({
    sectionId: z.string().min(1)
  }),
  sectionScheduleSlot: z.object({
    dayOfWeek: z.string().trim().min(1),
    startTime: z.string().trim().min(1),
    endTime: z.string().trim().min(1),
    room: z.string().trim().optional(),
    specificDate: z.string().trim().optional()
  }),
  courseSection: z.object({
    courseId: z.string().trim().min(1),
    teacherId: z.string().trim().min(1).optional(),
    sectionCode: z.string().trim().min(1),
    maxStudents: z.coerce.number().int().min(1),
    numberOfSessions: z.coerce.number().int().min(1).max(200).optional(),
    schedule: z.array(z.object({
      dayOfWeek: z.string().trim().min(1),
      startTime: z.string().trim().min(1),
      endTime: z.string().trim().min(1),
      room: z.string().trim().optional(),
      specificDate: z.string().trim().optional()
    })).default([]),
    status: z.enum(["pending", "open", "closed", "cancelled"]).default("open"),
    openingDate: z.string().trim().optional(),
    meetingUrl: z.string().trim().optional().nullable(),
    groupChatUrl: z.string().trim().optional().nullable()
  }),

  lessonNote: z.object({
    content: z.string().max(20000)
  }),
  feedbackTemplate: z.object({
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(2000),
    courseId: z.string().trim().min(1).optional()
  }),
  createForumPost: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(10000)
  }),
  createForumReply: z.object({
    content: z.string().trim().min(1).max(10000)
  }),
  updateAttendanceSession: z.object({
    topic: z.string().trim().min(1).optional(),
    date: z.string().trim().min(1).optional(),
    videoUrl: z.string().trim().optional().nullable(),
    recordingUrl: z.string().trim().optional().nullable(),
    content: z.string().trim().optional().nullable()
  }),
  // Multipart for slide/document (fields arrive as strings), JSON for youtube/link.
  createSessionMaterial: z.object({
    type: z.enum(["slide", "document", "youtube", "link"]),
    title: z.string().trim().max(200).optional().transform(value => value || undefined),
    url: z.string().trim().max(2000).optional()
  }),
  updateSessionMaterial: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    url: z.string().trim().min(1).max(2000).optional()
  }),
  reorderSessionMaterials: z.object({
    materialIds: z.array(z.string().trim().min(1)).min(1).max(200)
  }),
  selfRegister: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().trim().toLowerCase(),
    phone: z.string().trim().regex(/^[0-9+\s.()-]{8,20}$/)
  }),
  forgotPassword: z.object({
    email: z.email().trim().toLowerCase()
  }),
  crmUpsertStudent: z.object({
    crmContactId: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(2).max(120),
    email: z.email().trim().toLowerCase(),
    phone: z.string().trim().regex(/^[0-9+\s.()-]{8,20}$/).optional()
  }),
  crmCreateEnrollment: z.object({
    crmContactId: z.string().trim().min(1).max(200).optional(),
    email: z.email().trim().toLowerCase().optional(),
    phone: z.string().trim().regex(/^[0-9+\s.()-]{8,20}$/).optional(),
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    crmDealId: z.string().trim().min(1).max(200).optional()
  }).refine(value => Boolean(value.crmContactId || value.email || value.phone), { message: "crmContactId, email, or phone is required." }),
  crmConfirmPayment: z.object({
    enrollmentId: z.string().trim().min(1).optional(),
    crmDealId: z.string().trim().min(1).max(200).optional(),
    amount: z.coerce.number().nonnegative().optional(),
    reference: z.string().trim().max(200).optional(),
    paidAt: z.string().trim().max(40).optional(),
    sectionId: z.string().trim().min(1).optional()
  }).refine(value => Boolean(value.enrollmentId || value.crmDealId), { message: "enrollmentId or crmDealId is required." })
};
