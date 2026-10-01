// "manager" is the class manager (Quản lý lớp): runs courses, classes and placements, but not system accounts.
export type UserRole =
  | "admin"
  | "manager"
  | "teacher"
  | "student";

/** direct: accounts and enrollments come from the CRM paid list; self_service: learners sign up and pay by QR. */
export type SalesMode = "direct" | "self_service";

export interface AppConfig {
  salesMode: SalesMode;
  supportPhone: string;
  // Homework attachments stay view-only for learners until MCNA decides otherwise.
  allowHomeworkDownload: boolean;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt?: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  createdAt: string;
  linkedStudentId?: string;
  schoolEmail?: string;
  emailProvisioned?: boolean;
  emailProvisionedAt?: string;
  mustChangePassword?: boolean;
  signupSource?: "admin" | "self" | "crm";
  crmContactId?: string;
  canManageSales?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  status: "draft" | "pending" | "published" | "rejected";
  category: string;
  thumbnail?: string;
  price?: number;
  originalPrice?: number;
  level?: "Cơ bản" | "Trung cấp" | "Nâng cao";
  tags?: string[];
  rejectionReason?: string;
  createdAt: string;
  openingDate?: string;
  numberOfLessons?: number;
  welcomeLetter?: string; // opening letter shown to learners placed in a class; empty means the default letter
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  videoUrl?: string;
  order: number;
  duration: string; // e.g. "15 mins"
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: "pending" | "active" | "completed" | "cancelled" | "pending_payment";
  enrolledAt: string;
  completedAt?: string;
  requestedSectionId?: string; // class the student picked when registering; pre-fills placement
  crmDealId?: string;
}

export interface LessonProgress {
  id: string;
  enrollmentId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  lessonId?: string; // or linked to course directly
  sessionId?: string;
  title: string;
  passingScore: number; // e.g. 70 for 70%
  timeLimit: number; // in mins
  maxAttempts: number;
  deadline?: string;
  attachmentUrl?: string;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: "single" | "multiple" | "text";
  options: string[]; // only for single or multiple
  correctAnswer: string; // indices comma-separated for multi, or text
  createdAt?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  answers: Record<string, string>; // questionId -> answer
  score: number; // computed percentage
  passed: boolean;
  startedAt: string;
  submittedAt: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  sessionId?: string;
  title: string;
  description: string;
  deadline: string;
  maxScore: number;
  allowLate?: boolean;
  attachmentUrl?: string;
  lessonId?: string;
  type?: "lesson" | "chapter" | "midterm" | "final";
}


export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
  attachmentUrl?: string;
}

export interface Certificate {
  id: string;
  enrollmentId: string;
  studentId: string;
  courseId: string;
  issuedAt: string;
  certificateCode: string; // 8-char alphanumeric
}

export interface Notification {
  id: string;
  userId: string;
  type: string; // e.g., "info", "success", "warning", "danger"
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface ForumPost {
  id: string;
  courseId: string;
  sectionId?: string;
  authorId: string;
  title: string;
  content: string;
  replies: ForumReply[];
  createdAt: string;
}

export interface ForumReply {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  studentId: string;
  courseId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  paymentMethod: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  notes?: string;
}


export interface AttendanceSession {
  id: string;
  courseId: string;
  sectionId?: string;
  teacherId: string;
  date: string;
  topic: string;
  videoUrl?: string;
  recordingUrl?: string;
  content?: string;
  code?: string;
  expiresAt?: string;
}

export type SessionMaterialType = "slide" | "document" | "data" | "youtube" | "link";
export type IntroMaterialCategory = "reference" | "practice";

export interface SessionMaterial {
  id: string;
  sessionId?: string; // absent for a course's opening materials
  sectionId?: string;
  courseId: string;
  // slide/document are view-only for learners; data files are the ones they may download.
  type: SessionMaterialType;
  category?: IntroMaterialCategory; // opening materials only
  title: string;
  url?: string; // YouTube or external link; uploaded files are fetched via /api/materials/:id/download
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  sortOrder: number;
  createdBy?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: "present" | "absent" | "late" | "excused";
  note?: string;
  checkedInAt?: string;
  checkinMethod?: "manual" | "link" | "qr";
}

export interface LessonNote {
  id: string;
  studentId: string;
  lessonId: string;
  courseId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackTemplate {
  id: string;
  ownerUserId: string;
  courseId?: string;
  title: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSection {
  id: string;
  courseId: string;
  teacherId: string;
  sectionCode: string;          // e.g. "CS101-01"
  maxStudents: number;          // capacity cap
  schedule: Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string; specificDate?: string }>;
  status: "pending" | "open" | "closed" | "cancelled";
  openingDate?: string;
  numberOfSessions?: number;
  meetingUrl?: string;          // Link Zoom / Google Meet
  groupChatUrl?: string;        // Link Nhóm Zalo / Discord
}

// Public (unauthenticated) catalog shapes: only what a visitor may see before signing up.
export interface PublicCourseSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail?: string;
  price: number;
  originalPrice?: number;
  level?: Course["level"];
  tags: string[];
  openingDate?: string;
  numberOfLessons?: number;
  teacherName?: string;
  openSectionCount: number;
}

export interface PublicCourseSection {
  id: string;
  sectionCode: string;
  teacherName?: string;
  maxStudents: number;
  seatsLeft: number;
  schedule: CourseSection["schedule"];
  openingDate?: string;
  numberOfSessions?: number;
  // Meeting/group links and recordings are deliberately absent: they are only for learners placed in the class.
  sessions: Array<{ id: string; topic: string; date?: string }>;
}

export interface PublicCourseDetail {
  course: PublicCourseSummary;
  sections: PublicCourseSection[];
  lessons?: Array<{ id: string; title: string; duration: string; order: number }>;
}


export interface CourseRegistration {
  id: string;
  studentId: string;
  sectionId: string;
  status: "registered" | "waitlisted" | "dropped" | "withdrawn" | "completed" | "failed";
  registeredAt: string;
  droppedAt?: string;
  grade?: string;
  letterGrade?: string;
  gradePoint?: number;
  credits?: number;
  isRetake?: boolean;                // true if student previously failed this course
  examBan?: boolean;
  gradePostedAt?: string;
  placementEmailStatus?: "sent" | "mock" | "failed";
  placementEmailAt?: string;
}


export interface SystemEvent {
  id: string;
  type: string;
  payload: any;
  triggeredAt: string;
  processed: boolean;
}

export interface TeacherAttendance {
  id: string;
  teacherId: string;
  courseId: string;
  sectionId: string;
  classDate: string;  // "YYYY-MM-DD"
  slotTime: string;   // e.g. "08:00 - 10:00"
  status: "present" | "late" | "absent";
  checkedInAt: string;
}

export interface LMSDataStore {
  users: User[];
  courses: Course[];
  lessons: Lesson[];
  enrollments: Enrollment[];
  lessonProgress: LessonProgress[];
  quizzes: Quiz[];
  questions: Question[];
  quizAttempts: QuizAttempt[];
  assignments: Assignment[];
  submissions: Submission[];
  certificates: Certificate[];
  notifications: Notification[];
  forumPosts: ForumPost[];
  auditLogs: AuditLog[];
  transactions: Transaction[];
  attendanceSessions: AttendanceSession[];
  sessionMaterials?: SessionMaterial[];
  attendanceRecords: AttendanceRecord[];
  lessonNotes?: LessonNote[];
  feedbackTemplates?: FeedbackTemplate[];
  courseSections?: CourseSection[];
  courseRegistrations?: CourseRegistration[];
  systemEvents?: SystemEvent[];
  teacherAttendance?: TeacherAttendance[];
}

export interface CrmOutboxEvent {
  id: string;
  eventType: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  sentAt?: string | null;
}

/** Presence of each integration's settings on the server (GET /api/admin/system/status). */
export interface SystemStatus {
  environment: string;
  sepay: boolean;
  email: boolean;
  appUrl: boolean;
  storage: "supabase" | "database";
  crmOutbound: boolean;
  crmInbound: boolean;
  cron: boolean;
  googleWorkspace: boolean;
}

export interface CrmOutboxStatus {
  configured: boolean;
  webhookUrl: string | null;
  counts: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
  };
  recentEvents: CrmOutboxEvent[];
}
