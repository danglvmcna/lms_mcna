import { AttendanceSession, CourseSection, Enrollment, Lesson, LMSDataStore, SessionMaterial } from "../../types";

/** The class (section) a learner belongs to for a course, ignoring dropped/waitlisted/withdrawn registrations. */
export function enrollmentSection(store: LMSDataStore, studentId: string, courseId: string): CourseSection | undefined {
  const registration = (store.courseRegistrations || []).find(r => {
    if (r.studentId !== studentId || ["dropped", "waitlisted", "withdrawn"].includes(r.status)) return false;
    const section = (store.courseSections || []).find(s => s.id === r.sectionId);
    return section && section.courseId === courseId;
  });
  return (store.courseSections || []).find(section => section.id === registration?.sectionId);
}

/** The class a learner is actively registered in for a course (used for the classroom and its forum). */
export function registeredSectionId(store: LMSDataStore, studentId: string, courseId: string): string | null {
  const registration = (store.courseRegistrations || []).find(r => {
    if (r.studentId !== studentId || r.status !== "registered") return false;
    return (store.courseSections || []).some(section => section.id === r.sectionId && section.courseId === courseId);
  });
  return registration?.sectionId || null;
}

/** Learners can open the classroom once the enrollment is active and they are placed in a class. */
export function hasClassroomAccess(store: LMSDataStore, studentId: string, enrollment?: Enrollment, section?: CourseSection | null) {
  if (!enrollment || (enrollment.status !== "active" && enrollment.status !== "completed") || !section) return false;
  const registration = (store.courseRegistrations || []).find(r => r.studentId === studentId && r.sectionId === section.id);
  return registration?.status === "registered";
}

export function courseProgress(store: LMSDataStore, enrollment: Enrollment) {
  const total = store.lessons.filter(lesson => lesson.courseId === enrollment.courseId).length;
  const completed = store.lessonProgress.filter(progress => progress.enrollmentId === enrollment.id && progress.completed).length;
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function isLessonCompleted(store: LMSDataStore, enrollmentId: string | undefined, lessonId: string) {
  if (!enrollmentId) return false;
  return Boolean(store.lessonProgress.find(progress => progress.enrollmentId === enrollmentId && progress.lessonId === lessonId)?.completed);
}

export function upcomingSessions(store: LMSDataStore, courseId: string, sectionId?: string | null) {
  const now = Date.now();
  return (store.attendanceSessions || [])
    .filter(session => session.courseId === courseId && (!sectionId || session.sectionId === sectionId) && session.date && new Date(session.date).getTime() >= now - 3 * 3600_000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface ClassSession {
  number: number;
  sessionId?: string;
  title: string;
  date?: string;
  topic?: string;
  content?: string;
  videoUrl?: string;
  recordingUrl?: string;
  materials: SessionMaterial[];
  lessons: Lesson[];
}

/**
 * Group a course into numbered sessions: the class's scheduled sessions paired with the course lessons
 * by position (lesson N belongs to session N), padded so every lesson and session has a slot.
 */
export function buildClassSessions(store: LMSDataStore, courseId: string, sectionId: string | null, lessons: Lesson[]): ClassSession[] {
  const scheduled: AttendanceSession[] = (store.attendanceSessions || [])
    .filter(session => session.courseId === courseId && (!sectionId || session.sectionId === sectionId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const count = Math.max(lessons.length, scheduled.length, 1);
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const lessonsInSession = lessons.filter((_, lessonIndex) => lessonIndex === index);
    const session = scheduled[index];
    return {
      number,
      sessionId: session?.id,
      materials: session ? (store.sessionMaterials || []).filter(material => material.sessionId === session.id) : [],
      title: `Buổi ${number}`,
      date: session?.date,
      topic: session?.topic,
      content: session?.content,
      videoUrl: session?.videoUrl || lessonsInSession.find(lesson => lesson.videoUrl)?.videoUrl,
      recordingUrl: session?.recordingUrl,
      lessons: lessonsInSession
    };
  });
}

/** Session topics are often stored as "Buổi 2: Kiến thức nền tảng"; drop the redundant prefix for display. */
export const cleanTopic = (topic?: string) => (topic || "").replace(/^\s*buổi\s*\d+\s*[:.\-–]\s*/i, "").trim();

export type SessionTiming = "past" | "today" | "upcoming" | "unscheduled";

export function sessionTiming(date?: string): SessionTiming {
  if (!date) return "unscheduled";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "unscheduled";
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return "today";
  return value.getTime() < today.getTime() ? "past" : "upcoming";
}

export const ENROLLMENT_STATUS: Record<string, { label: string; tone: "success" | "warning" | "violet" | "primary" | "neutral" }> = {
  active: { label: "Đang học", tone: "success" },
  completed: { label: "Đã hoàn thành", tone: "primary" },
  pending: { label: "Chờ xếp lớp", tone: "violet" },
  pending_payment: { label: "Chờ thanh toán", tone: "warning" },
  cancelled: { label: "Đã hủy", tone: "neutral" }
};

export const supportsVietQr = (method?: string) => /chuyển khoản|bank|vietqr/i.test(method || "");
