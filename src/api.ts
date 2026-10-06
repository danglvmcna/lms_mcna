import { CrmOutboxStatus, IntroMaterialCategory, LMSDataStore, PublicCourseDetail, PublicCourseSummary, SessionMaterial, SmtpTestInfo, SystemStatus } from "./types";
import { PaidImportResponse, PaidImportRow, PaidTableParseResult } from "./paidImport";
import { CrmPaidPull } from "./crmPaidSource";

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

export function getCsrfToken(): string | null {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)(?:mcna_lms_csrf|e16_lms_csrf)=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
}

export async function apiFetch<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const csrfToken = getCsrfToken();
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

export const operationsApi = <T = any>(path: string, payload?: unknown, method = payload === undefined ? 'GET' : 'POST') =>
  apiFetch<T>(`/api/operations${path}`, {method, ...(payload !== undefined ? {body:JSON.stringify(payload)} : {})});

/** A created material; "warning" is set when learners will not be able to read it online (not a PDF). */
export type UploadedMaterial = SessionMaterial & { warning?: string };

export type PlacementEmailCounts = { sent: number; mock: number; failed: number; skipped: number };
export type PlacementNotice = { studentId: string; sectionId: string; email: string | null; status: "sent" | "mock" | "failed" | "skipped"; reason?: string };
export type BulkPlacementResult = { success: boolean; count: number; placed: number; unchanged: number; emails: PlacementEmailCounts; notices: PlacementNotice[] };

async function postMultipart<T>(url: string, formData: FormData, fallbackError: string): Promise<T> {
  const csrfToken = getCsrfToken();
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

type DirectMaterialOwner = { kind: "session"; sessionId: string } | { kind: "intro"; courseId: string; category: IntroMaterialCategory };

async function uploadMaterial(owner: DirectMaterialOwner, type: "slide" | "document" | "data", file: File, title?: string): Promise<UploadedMaterial> {
  const start = await apiFetch<
    | { mode: "server"; maxBytes: number }
    | { mode: "direct"; signedUrl: string; grant: string; contentType: string }
  >("/api/materials/direct-upload/start", {
    method: "POST",
    body: JSON.stringify({ owner, type, fileName: file.name, sizeBytes: file.size, title })
  });
  if (start.mode === "direct") {
    const response = await fetch(start.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": start.contentType },
      body: file
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || payload.error || `Kho tài liệu từ chối tệp (HTTP ${response.status}).`);
    }
    return apiFetch<UploadedMaterial>("/api/materials/direct-upload/complete", {
      method: "POST",
      body: JSON.stringify({ grant: start.grant })
    });
  }
  if (file.size > start.maxBytes) throw new Error("Tệp lớn cần cấu hình Supabase Storage trên máy chủ để tải trực tiếp, hoặc nén xuống dưới 4 MB.");
  const formData = new FormData();
  formData.append("type", type);
  if (owner.kind === "intro") formData.append("category", owner.category);
  if (title) formData.append("title", title);
  formData.append("file", file);
  const url = owner.kind === "session"
    ? `/api/sessions/${encodeURIComponent(owner.sessionId)}/materials`
    : `/api/courses/${encodeURIComponent(owner.courseId)}/intro-materials`;
  return postMultipart<UploadedMaterial>(url, formData, "Tải tài liệu lên thất bại.");
}

export const api = {
  getStore: () => apiFetch<LMSDataStore>("/api/store"),
  getAdminDashboard: () => apiFetch("/api/dashboard/admin"),
  getTeacherDashboard: () => apiFetch("/api/dashboard/teacher"),
  getStudentDashboard: () => apiFetch("/api/dashboard/student"),
  uploadFile: async (file: File, onProgress?: (percent: number) => void): Promise<{ url: string }> => {
    if (file.size >= MAX_UPLOAD_FILE_BYTES) {
      throw new Error(`Dung lượng tệp phải nhỏ hơn ${MAX_UPLOAD_FILE_LABEL}.`);
    }
    const formData = new FormData();
    formData.append("file", file);

    if (!onProgress) {
      return postMultipart<{ url: string }>("/api/upload", formData, "Tải tệp lên thất bại.");
    }

    return new Promise<{ url: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const csrfToken = getCsrfToken();
      xhr.open("POST", "/api/upload");
      xhr.withCredentials = true;
      if (csrfToken) {
        xhr.setRequestHeader("X-CSRF-Token", csrfToken);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
          onProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error("Phản hồi máy chủ không hợp lệ."));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || `Tải tệp lên thất bại (HTTP ${xhr.status})`));
          } catch {
            reject(new Error(`Tải tệp lên thất bại (HTTP ${xhr.status})`));
          }
        }
      };
      xhr.onerror = () => reject(new Error("Lỗi kết nối mạng khi tải tệp lên."));
      xhr.send(formData);
    });
  },
  listSessionMaterials: (sessionId: string) => apiFetch<SessionMaterial[]>(`/api/sessions/${encodeURIComponent(sessionId)}/materials`),
  uploadSessionMaterial: (sessionId: string, type: "slide" | "document" | "data", file: File, title?: string) =>
    uploadMaterial({ kind: "session", sessionId }, type, file, title),
  addLinkMaterial: (sessionId: string, payload: { type: "youtube" | "link"; url: string; title?: string }) =>
    apiFetch<SessionMaterial>(`/api/sessions/${encodeURIComponent(sessionId)}/materials`, { method: "POST", body: JSON.stringify(payload) }),
  // Course opening materials: reference reading and practice exercises shown before the first session.
  listIntroMaterials: (courseId: string) => apiFetch<SessionMaterial[]>(`/api/courses/${encodeURIComponent(courseId)}/intro-materials`),
  uploadIntroMaterial: (courseId: string, category: IntroMaterialCategory, type: "document" | "data", file: File, title?: string) =>
    uploadMaterial({ kind: "intro", courseId, category }, type, file, title),
  addIntroLink: (courseId: string, payload: { category: IntroMaterialCategory; type: "youtube" | "link"; url: string; title?: string }) =>
    apiFetch<SessionMaterial>(`/api/courses/${encodeURIComponent(courseId)}/intro-materials`, { method: "POST", body: JSON.stringify(payload) }),
  reorderIntroMaterials: (courseId: string, category: IntroMaterialCategory, materialIds: string[]) =>
    apiFetch<SessionMaterial[]>(`/api/courses/${encodeURIComponent(courseId)}/intro-materials/order`, { method: "PUT", body: JSON.stringify({ category, materialIds }) }),
  saveWelcomeLetter: (courseId: string, welcomeLetter: string) =>
    apiFetch<{ courseId: string; welcomeLetter: string }>(`/api/courses/${encodeURIComponent(courseId)}/welcome-letter`, { method: "PUT", body: JSON.stringify({ welcomeLetter }) }),
  draftWelcomeLetter: (courseId: string) =>
    apiFetch<{ letter: string; source: "ai" | "template"; note?: string }>(`/api/courses/${encodeURIComponent(courseId)}/welcome-letter/draft`, { method: "POST", body: "{}" }),
  updateSessionMaterial: (materialId: string, payload: { title?: string; url?: string }) =>
    apiFetch<SessionMaterial>(`/api/materials/${encodeURIComponent(materialId)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  reorderSessionMaterials: (sessionId: string, materialIds: string[]) =>
    apiFetch<SessionMaterial[]>(`/api/sessions/${encodeURIComponent(sessionId)}/materials/order`, { method: "PUT", body: JSON.stringify({ materialIds }) }),
  deleteSessionMaterial: (materialId: string) => apiFetch(`/api/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" }),
  materialDownloadUrl: (materialId: string) => `/api/materials/${encodeURIComponent(materialId)}/download`,
  // Read-only address for the in-app PDF viewer (learners cannot download slides or documents).
  materialViewUrl: (materialId: string) => `/api/materials/${encodeURIComponent(materialId)}/download?inline=true`,
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
  bulkPlaceEnrollments: (placements: Array<{ enrollmentId?: string; email?: string; sectionId?: string; sectionCode?: string }>, options: { notify?: boolean } = {}) =>
    apiFetch<BulkPlacementResult>("/api/admin/enrollments/bulk-place", { method: "POST", body: JSON.stringify({ placements, ...options }) }),
  resendPlacementEmail: (items: Array<{ studentId: string; sectionId: string }>) =>
    apiFetch<{ emails: PlacementEmailCounts; notices: PlacementNotice[] }>("/api/admin/placements/resend-email", { method: "POST", body: JSON.stringify({ items }) }),
  // Direct sale: the "paid customers" table becomes learner accounts and paid enrollments.
  getPaidImportConfig: () => apiFetch<{ defaultPassword: string; supportPhone: string; crmSource?: boolean }>("/api/admin/paid-enrollments/config"),
  getCrmPaidRecords: (cursor?: string) => apiFetch<CrmPaidPull & { fetchedAt: string }>(`/api/admin/paid-enrollments/crm${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  parsePaidTableFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return postMultipart<PaidTableParseResult>("/api/admin/paid-enrollments/parse", formData, "Không đọc được tệp danh sách.");
  },
  importPaidEnrollments: (payload: { rows: PaidImportRow[]; defaultPassword?: string; sendAccountEmail?: boolean; dryRun?: boolean }) =>
    apiFetch<PaidImportResponse>("/api/admin/paid-enrollments/import", { method: "POST", body: JSON.stringify(payload) }),
  importMcnaCatalog: () =>
    apiFetch<{ coursesCreated: number; coursesUpdated: number; lessons: number; source: string; scrapedAt: string | null }>("/api/admin/catalog/import-mcna", { method: "POST", body: "{}" }),
  requestNewSection: (courseId: string) => apiFetch(`/api/courses/${courseId}/request-section`, { method: "POST" }),
  issueCertificate: (payload: { enrollmentId: string; overrideReason?: string }) => apiFetch<LMSDataStore["certificates"][number]>("/api/certificates/issue", { method: "POST", body: JSON.stringify(payload) }),
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
  gradeAssignment: (payload: { submissionId: string; score: number; feedback: string; expectedSubmittedAt?: string }) => apiFetch("/api/assignments/grade", { method: "POST", body: JSON.stringify(payload) }),
  createUser: (payload: unknown) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  bulkCreateUsers: (payload: unknown) => apiFetch<{ createdCount: number; skippedCount: number; errorCount: number; errors: Array<{ row: number; email?: string; reason: string }>; created: LMSDataStore["users"] }>("/api/admin/users/bulk", { method: "POST", body: JSON.stringify(payload) }),
  setUserStatus: (userId: string, isActive: boolean) => apiFetch(`/api/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  setUserRole: (userId: string, role: string) => apiFetch(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  reviewTransaction: (transactionId: string, payload: { status: "approved" | "rejected"; notes?: string }) => apiFetch(`/api/payments/transactions/${transactionId}/review`, { method: "PATCH", body: JSON.stringify(payload) }),
  getMyTransactionStatus: (transactionId: string) => apiFetch<{ id: string; status: "pending" | "approved" | "rejected"; processedAt: string | null; requiresManualReview: boolean }>(`/api/student/transactions/${encodeURIComponent(transactionId)}/status`),
  createCourseSection: (payload: unknown) => apiFetch("/api/course-sections", { method: "POST", body: JSON.stringify(payload) }),
  updateCourseSection: (sectionId: string, payload: unknown) => apiFetch(`/api/course-sections/${sectionId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCourseSection: (sectionId: string) => apiFetch(`/api/course-sections/${sectionId}`, { method: "DELETE" }),
  saveAttendance: (payload: unknown) => apiFetch("/api/attendance/sessions", { method: "POST", body: JSON.stringify(payload) }),
  getGradebookReportUrl: (format: "csv" | "xlsx", filters: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return `/api/reports/gradebook.${format}${params.toString() ? `?${params.toString()}` : ""}`;
  },
  getOperationsSummary: () => apiFetch<{ pendingEnrollments: number; ungradedSubmissions: number; pendingCourses: number; attendanceRisks: number; crmFailures: number; generatedAt: string }>("/api/admin/operations/summary"),
  getLessonNote: (lessonId: string) => apiFetch<any>(`/api/lessons/${encodeURIComponent(lessonId)}/note`),
  saveLessonNote: (lessonId: string, content: string) => apiFetch<any>(`/api/lessons/${encodeURIComponent(lessonId)}/note`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteLessonNote: (lessonId: string) => apiFetch(`/api/lessons/${encodeURIComponent(lessonId)}/note`, { method: "DELETE" }),
  listFeedbackTemplates: (courseId?: string) => apiFetch<any[]>(`/api/feedback-templates${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""}`),
  createFeedbackTemplate: (payload: { title: string; content: string; courseId?: string }) => apiFetch<any>("/api/feedback-templates", { method: "POST", body: JSON.stringify(payload) }),
  deleteFeedbackTemplate: (id: string) => apiFetch(`/api/feedback-templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
  publicCertificateUrl: (code: string) => `/verify/certificate/${encodeURIComponent(code)}`,
  sessionMaterialsBundleUrl: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}/materials/download-all`,
  markNotificationRead: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
  getNotifications: () => apiFetch<any[]>("/api/notifications"),
  sendAdminNotification: (payload: { idempotencyKey: string; message: string; type?: string; userIds?: string[]; role?: string }) =>
    apiFetch<{ sent: number; duplicate: boolean }>("/api/admin/notifications", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (userId: string) => apiFetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" }),

  createForumPost: (courseId: string, payload: { title: string; content: string; sectionId?: string }) => apiFetch(`/api/courses/${courseId}/forum`, { method: "POST", body: JSON.stringify({ courseId, ...payload }) }),
  createForumReply: (postId: string, payload: { content: string }) => apiFetch(`/api/forum/posts/${postId}/replies`, { method: "POST", body: JSON.stringify(payload) }),
  updateAssignment: (id: string, payload: unknown) => apiFetch(`/api/assignments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAssignment: (id: string) => apiFetch(`/api/assignments/${id}`, { method: "DELETE" }),
  updateAttendanceSession: (id: string, payload: unknown) => apiFetch(`/api/attendance/sessions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getCrmOutboxStatus: () => apiFetch<CrmOutboxStatus>("/api/admin/crm/outbox"),
  getSystemStatus: () => apiFetch<SystemStatus>("/api/admin/system/status"),
  sendTestEmail: (targetEmail: string) =>
    apiFetch<{ ok: true; message: string; sender: string; targetEmail: string; smtp?: SmtpTestInfo }>("/api/admin/email/test", { method: "POST", body: JSON.stringify({ targetEmail }) }),
  syncCrmOutbox: (payload?: { retryFailed?: boolean }) =>
    apiFetch<{ success: boolean; configured: boolean; sent: number; failed: number }>("/api/admin/crm/outbox/sync", {
      method: "POST",
      body: JSON.stringify(payload || {})
    })
};
