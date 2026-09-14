import { AcademicWarning, Assignment, Course, CourseSection, Enrollment, LessonProgress, PublicCourseSection, PublicCourseSummary, Question, Quiz, QuizAttempt, SessionMaterial, Submission, TuitionFee, User, UserRole } from "../types";

export type DbUserRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt?: string | null;
  name: string;
  role: UserRole;
  is_active: number | boolean;
  phone?: string | null;
  linked_student_id?: string | null;
  created_at: string;
  school_email?: string | null;
  email_provisioned?: boolean;
  email_provisioned_at?: string | null;
  must_change_password?: boolean | null;
  signup_source?: User["signupSource"] | null;
  crm_contact_id?: string | null;
};

export function normalizeRole(role: string): UserRole {
  if (role === "teacher" || role === "advisor") return "teacher";
  if (role === "student" || role === "parent") return "student";
  return "admin";
}

export function denormalizeRole(role: string): string {
  return role;
}

export function toPublicUser(row: DbUserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: "",
    name: row.name,
    role: normalizeRole(row.role),
    isActive: Boolean(row.is_active),
    phone: row.phone || undefined,
    linkedStudentId: row.linked_student_id || undefined,
    createdAt: row.created_at,
    schoolEmail: row.school_email || undefined,
    emailProvisioned: Boolean(row.email_provisioned),
    emailProvisionedAt: row.email_provisioned_at || undefined,
    mustChangePassword: Boolean(row.must_change_password),
    signupSource: row.signup_source || "admin",
    crmContactId: row.crm_contact_id || undefined
  };
}

export function courseFromRow(row: any): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teacherId: row.teacher_id,
    status: row.status,
    category: row.category,
    thumbnail: row.thumbnail || undefined,
    price: row.price === null || row.price === undefined ? undefined : Number(row.price),
    originalPrice: row.original_price === null || row.original_price === undefined ? undefined : Number(row.original_price),
    level: row.level || undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    rejectionReason: row.rejection_reason || undefined,
    createdAt: row.created_at,
    openingDate: row.opening_date || undefined,
    numberOfLessons: row.number_of_lessons === null || row.number_of_lessons === undefined ? undefined : Number(row.number_of_lessons)
  };
}

/** Expects courses.* plus teacher_name and open_section_count. */
export function publicCourseFromRow(row: any): PublicCourseSummary {
  const course = courseFromRow(row);
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    thumbnail: course.thumbnail,
    price: course.price || 0,
    originalPrice: course.originalPrice,
    level: course.level,
    tags: course.tags || [],
    openingDate: course.openingDate,
    numberOfLessons: course.numberOfLessons,
    teacherName: row.teacher_name || undefined,
    openSectionCount: Number(row.open_section_count || 0)
  };
}

/** Expects course_sections.* plus teacher_name and registered_count, with that class's attendance_sessions rows. */
export function publicCourseSectionFromRow(row: any, sessionRows: any[]): PublicCourseSection {
  const section = courseSectionFromRow(row);
  const toDateText = (value: any) => (value instanceof Date ? value.toISOString() : value ? String(value) : undefined);
  return {
    id: section.id,
    sectionCode: section.sectionCode,
    teacherName: row.teacher_name || undefined,
    maxStudents: section.maxStudents,
    seatsLeft: Math.max(0, section.maxStudents - Number(row.registered_count || 0)),
    schedule: section.schedule,
    openingDate: section.openingDate,
    numberOfSessions: section.numberOfSessions,
    sessions: sessionRows
      .map(session => ({
        id: session.id,
        topic: session.topic,
        date: toDateText(session.date || session.session_date)
      }))
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
  };
}

export function enrollmentFromRow(row: any): Enrollment {
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at || undefined,
    requestedSectionId: row.requested_section_id || undefined,
    crmDealId: row.crm_deal_id || undefined
  };
}

// storage_path is intentionally not exposed; files are served through the authorized download route.
export function sessionMaterialFromRow(row: any): SessionMaterial {
  return {
    id: row.id,
    sessionId: row.session_id,
    sectionId: row.section_id || undefined,
    courseId: row.course_id,
    type: row.type,
    title: row.title,
    url: row.url || undefined,
    fileName: row.file_name || undefined,
    mimeType: row.mime_type || undefined,
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? undefined : Number(row.size_bytes),
    sortOrder: Number(row.sort_order || 0),
    createdBy: row.created_by || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
}

export function lessonProgressFromRow(row: any): LessonProgress {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    lessonId: row.lesson_id,
    completed: Boolean(row.completed),
    completedAt: row.completed_at || undefined
  };
}

export function quizFromRow(row: any): Quiz {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id || undefined,
    sessionId: row.session_id || undefined,
    title: row.title,
    passingScore: Number(row.passing_score),
    timeLimit: Number(row.time_limit),
    maxAttempts: Number(row.max_attempts),
    deadline: row.deadline || undefined,
    attachmentUrl: row.attachment_url || undefined
  };
}

export function questionFromRow(row: any): Question {
  return {
    id: row.id,
    quizId: row.quiz_id,
    text: row.text,
    type: row.type,
    options: row.options_json ? JSON.parse(row.options_json) : [],
    correctAnswer: row.correct_answer,
    createdAt: row.created_at
  };
}

export function quizAttemptFromRow(row: any): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    answers: row.answers_json ? JSON.parse(row.answers_json) : {},
    score: Number(row.score),
    passed: Boolean(row.passed),
    startedAt: row.started_at,
    submittedAt: row.submitted_at
  };
}

export function assignmentFromRow(row: any): Assignment {
  return {
    id: row.id,
    courseId: row.course_id,
    sessionId: row.session_id || undefined,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    maxScore: Number(row.max_score),
    attachmentUrl: row.attachment_url || undefined,
    lessonId: row.lesson_id || undefined,
    type: row.type || undefined
  };
}


export function submissionFromRow(row: any): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    content: row.content,
    score: row.score !== null ? row.score : undefined,
    feedback: row.feedback || undefined,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at || undefined,
    attachmentUrl: row.attachment_url || undefined
  };
}

export function tuitionFeeFromRow(row: any): TuitionFee {
  return {
    id: row.id,
    studentId: row.student_id,
    semesterId: row.semester_id || "",
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    paidAmount: Number(row.paid_amount || 0),
    paidAt: row.paid_at || undefined,
    receiptCode: row.receipt_code || undefined
  };
}

export function academicWarningFromRow(row: any): AcademicWarning {
  return {
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    courseId: row.course_id || undefined,
    message: row.message,
    isResolved: Boolean(row.is_resolved),
    resolvedBy: row.resolved_by || undefined,
    resolvedAt: row.resolved_at || undefined,
    createdAt: row.created_at
  };
}

export function courseSectionFromRow(row: any): CourseSection {
  return {
    id: row.id,
    courseId: row.course_id,
    semesterId: row.semester_id,
    teacherId: row.teacher_id,
    sectionCode: row.section_code,
    maxStudents: Number(row.max_students),
    schedule: parseSchedule(row),
    status: row.status,
    openingDate: row.opening_date || undefined,
    numberOfSessions: row.number_of_sessions === null || row.number_of_sessions === undefined
      ? undefined
      : Number(row.number_of_sessions),
    meetingUrl: row.meeting_url || undefined,
    groupChatUrl: row.group_chat_url || undefined
  };
}

const parseScheduleValue = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Reads schedule slots from either course_sections.schedule (jsonb) or
 * course_sections.schedule_json (text). schedule_json defaults to "[]", so an
 * empty parsed value must not mask real data stored in schedule.
 */
export function parseSchedule(row: any): any[] {
  const parsedSchedule = parseScheduleValue(row?.schedule);
  if (parsedSchedule.length > 0) return parsedSchedule;

  const parsedScheduleJson = parseScheduleValue(row?.schedule_json);
  if (parsedScheduleJson.length > 0) return parsedScheduleJson;

  return [];
}
