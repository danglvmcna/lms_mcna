import { LMSDataStore, PublicCourseDetail, PublicCourseSummary, SessionMaterial } from "./types";

import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_LABEL } from "./utils";

export function setCsrfToken(token: string | null) {
  if (token) {
    sessionStorage.setItem("mcna_lms_csrf", token);
    sessionStorage.setItem("e16_lms_csrf", token);
  } else {
    sessionStorage.removeItem("mcna_lms_csrf");
    sessionStorage.removeItem("e16_lms_csrf");
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    let errorMessage = payload.error;
    if (!errorMessage) {
      if (response.status === 404) {
        errorMessage = "Không tìm thấy tài nguyên hoặc API chưa sẵn sàng (HTTP 404). Vui lòng kiểm tra lại địa chỉ hoặc đảm bảo đang truy cập qua http://localhost:3000.";
      } else {
        errorMessage = `Lỗi kết nối máy chủ (HTTP ${response.status})`;
      }
    }
    const err = new Error(errorMessage) as any;
    err.payload = payload;
    throw err;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function postMultipart<T>(url: string, formData: FormData, fallbackError: string): Promise<T> {
  const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
    },
    body: formData
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || fallbackError);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getStore: () => apiFetch<LMSDataStore>("/api/store"),
  getAdminDashboard: () => apiFetch("/api/dashboard/admin"),
  getTeacherDashboard: () => apiFetch("/api/dashboard/teacher"),
  getStudentDashboard: () => apiFetch("/api/dashboard/student"),
  uploadFile: async (file: File) => {
    if (file.size >= MAX_UPLOAD_FILE_BYTES) {
      throw new Error(`Dung lượng tệp phải nhỏ hơn ${MAX_UPLOAD_FILE_LABEL}.`);
    }
    const formData = new FormData();
    formData.append("file", file);
    return postMultipart<{ url: string }>("/api/upload", formData, "Tải tệp lên thất bại.");
  },
  listSessionMaterials: (sessionId: string) => apiFetch<SessionMaterial[]>(`/api/sessions/${encodeURIComponent(sessionId)}/materials`),
  uploadSessionMaterial: (sessionId: string, type: "slide" | "document", file: File, title?: string) => {
    const formData = new FormData();
    formData.append("type", type);
    if (title) formData.append("title", title);
    formData.append("file", file);
    return postMultipart<SessionMaterial>(`/api/sessions/${encodeURIComponent(sessionId)}/materials`, formData, "Tải tài liệu lên thất bại.");
  },
  addLinkMaterial: (sessionId: string, payload: { type: "youtube" | "link"; url: string; title?: string }) =>
    apiFetch<SessionMaterial>(`/api/sessions/${encodeURIComponent(sessionId)}/materials`, { method: "POST", body: JSON.stringify(payload) }),
  updateSessionMaterial: (materialId: string, payload: { title?: string; url?: string }) =>
    apiFetch<SessionMaterial>(`/api/materials/${encodeURIComponent(materialId)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  reorderSessionMaterials: (sessionId: string, materialIds: string[]) =>
    apiFetch<SessionMaterial[]>(`/api/sessions/${encodeURIComponent(sessionId)}/materials/order`, { method: "PUT", body: JSON.stringify({ materialIds }) }),
  deleteSessionMaterial: (materialId: string) => apiFetch(`/api/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" }),
  materialDownloadUrl: (materialId: string) => `/api/materials/${encodeURIComponent(materialId)}/download`,
  getCourses: () => apiFetch("/api/courses"),
  getPublicCourses: () => apiFetch<PublicCourseSummary[]>("/api/public/courses"),
  getPublicCourse: (courseId: string) => apiFetch<PublicCourseDetail>(`/api/public/courses/${encodeURIComponent(courseId)}`),
  createCourse: (payload: unknown) => apiFetch("/api/courses", { method: "POST", body: JSON.stringify(payload) }),
  updateCourse: (courseId: string, payload: unknown) => apiFetch(`/api/courses/${courseId}`, { method: "PUT", body: JSON.stringify(payload) }),
  submitCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}/submit`, { method: "POST" }),
  publishCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}/publish`, { method: "POST" }),
  rejectCourse: (courseId: string, rejectionReason: string) => apiFetch(`/api/courses/${courseId}/reject`, { method: "POST", body: JSON.stringify({ rejectionReason }) }),
  deleteCourse: (courseId: string) => apiFetch(`/api/courses/${courseId}`, { method: "DELETE" }),
  addLesson: (payload: unknown) => apiFetch("/api/lessons", { method: "POST", body: JSON.stringify(payload) }),
  updateLesson: (lessonId: string, payload: unknown) => apiFetch(`/api/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLesson: (lessonId: string) => apiFetch(`/api/lessons/${lessonId}`, { method: "DELETE" }),
  getEnrollments: () => apiFetch("/api/enrollments"),
  registerEnrollment: (courseId: string, sectionId?: string) => apiFetch("/api/enrollments/register", { method: "POST", body: JSON.stringify({ courseId, sectionId }) }),
  activateEnrollment: (enrollmentId: string, payload: { sectionId?: string } = {}) => apiFetch<{ success: boolean; enrollment: any; registration: any }>(`/api/enrollments/${enrollmentId}/activate`, { method: "POST", body: JSON.stringify(payload) }),
  approveEnrollment: (enrollmentId: string, payload: { sectionId?: string } = {}) => apiFetch(`/api/enrollments/${enrollmentId}/approve`, { method: "PATCH", body: JSON.stringify(payload) }),
  approveCourseRegistration: (registrationId: string) => apiFetch(`/api/course-registrations/${registrationId}/approve`, { method: "PATCH" }),
  bulkPlaceEnrollments: (placements: any[]) => apiFetch("/api/admin/enrollments/bulk-place", { method: "POST", body: JSON.stringify({ placements }) }),
  requestNewSection: (courseId: string) => apiFetch(`/api/courses/${courseId}/request-section`, { method: "POST" }),
  issueCertificate: (payload: { enrollmentId: string }) => apiFetch<LMSDataStore["certificates"][number]>("/api/certificates/issue", { method: "POST", body: JSON.stringify(payload) }),
  revokeCertificate: (certificateId: string) => apiFetch(`/api/certificates/${certificateId}`, { method: "DELETE" }),
  toggleProgress: (payload: { enrollmentId: string; lessonId: string }) => apiFetch("/api/progress/toggle", { method: "POST", body: JSON.stringify(payload) }),
  createQuiz: (payload: unknown) => apiFetch("/api/quizzes", { method: "POST", body: JSON.stringify(payload) }),
  updateQuiz: (quizId: string, payload: unknown) => apiFetch(`/api/quizzes/${quizId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteQuiz: (quizId: string) => apiFetch(`/api/quizzes/${quizId}`, { method: "DELETE" }),
  bulkAddQuestions: (quizId: string, questions: unknown[]) => apiFetch(`/api/quizzes/${quizId}/questions/bulk`, { method: "POST", body: JSON.stringify({ questions }) }),
  addQuestion: (quizId: string, payload: unknown) => apiFetch(`/api/quizzes/${quizId}/questions`, { method: "POST", body: JSON.stringify(payload) }),
  updateQuestion: (questionId: string, payload: unknown) => apiFetch(`/api/questions/${questionId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteQuestion: (questionId: string) => apiFetch(`/api/questions/${questionId}`, { method: "DELETE" }),
  submitQuiz: (payload: { quizId: string; answers: Record<string, string>; startedAt?: string }) => apiFetch("/api/quizzes/submit", { method: "POST", body: JSON.stringify(payload) }),
  createAssignment: (payload: unknown) => apiFetch("/api/assignments", { method: "POST", body: JSON.stringify(payload) }),
  submitAssignment: (payload: { assignmentId: string; content: string; attachmentUrl?: string }) => apiFetch<LMSDataStore["submissions"][number]>("/api/assignments/submit", { method: "POST", body: JSON.stringify(payload) }),
  gradeAssignment: (payload: { submissionId: string; score: number; feedback: string }) => apiFetch("/api/assignments/grade", { method: "POST", body: JSON.stringify(payload) }),
  createUser: (payload: unknown) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  bulkCreateUsers: (payload: unknown) => apiFetch<{ createdCount: number; skippedCount: number; errorCount: number; errors: Array<{ row: number; email?: string; reason: string }>; created: LMSDataStore["users"] }>("/api/admin/users/bulk", { method: "POST", body: JSON.stringify(payload) }),
  setUserStatus: (userId: string, isActive: boolean) => apiFetch(`/api/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  setUserRole: (userId: string, role: string) => apiFetch(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  reviewTransaction: (transactionId: string, payload: { status: "approved" | "rejected"; notes?: string }) => apiFetch(`/api/payments/transactions/${transactionId}/review`, { method: "PATCH", body: JSON.stringify(payload) }),
  createCourseSection: (payload: unknown) => apiFetch("/api/course-sections", { method: "POST", body: JSON.stringify(payload) }),
  updateCourseSection: (sectionId: string, payload: unknown) => apiFetch(`/api/course-sections/${sectionId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCourseSection: (sectionId: string) => apiFetch(`/api/course-sections/${sectionId}`, { method: "DELETE" }),
  saveAttendance: (payload: unknown) => apiFetch("/api/attendance/sessions", { method: "POST", body: JSON.stringify(payload) }),
  updateAttendanceRecord: (payload: unknown) => apiFetch("/api/attendance/records", { method: "PATCH", body: JSON.stringify(payload) }),
  generateAttendanceLink: (payload: { courseId: string; sectionId?: string; topic: string }) => apiFetch<{ session: any; code: string; expiresAt: string }>("/api/attendance/sessions/generate-link", { method: "POST", body: JSON.stringify(payload) }),
  selfCheckin: (payload: { sessionId: string; code: string }) => apiFetch<{ ok: boolean; record: any }>("/api/attendance/self-checkin", { method: "POST", body: JSON.stringify(payload) }),
  markNotificationRead: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
  resetPassword: (userId: string) => apiFetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" }),
  teacherCheckin: (payload: { courseId: string; sectionId: string; slotTime: string; classDate: string }) => apiFetch<{ ok: boolean; record: any }>("/api/attendance/teacher-checkin", { method: "POST", body: JSON.stringify(payload) }),
  warnTeacher: (payload: { courseId: string; teacherId: string }) => apiFetch<{ ok: boolean }>("/api/attendance/warn-teacher", { method: "POST", body: JSON.stringify(payload) }),
  createForumPost: (courseId: string, payload: { title: string; content: string; sectionId?: string }) => apiFetch(`/api/courses/${courseId}/forum`, { method: "POST", body: JSON.stringify({ courseId, ...payload }) }),
  createForumReply: (postId: string, payload: { content: string }) => apiFetch(`/api/forum/posts/${postId}/replies`, { method: "POST", body: JSON.stringify(payload) }),
  updateAssignment: (id: string, payload: unknown) => apiFetch(`/api/assignments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAssignment: (id: string) => apiFetch(`/api/assignments/${id}`, { method: "DELETE" }),
  updateAttendanceSession: (id: string, payload: unknown) => apiFetch(`/api/attendance/sessions/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
};
