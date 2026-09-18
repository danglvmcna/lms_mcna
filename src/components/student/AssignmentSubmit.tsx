import React, { useRef, useState } from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert, Loader2 } from "lucide-react";
import { api } from "../../api";
import ModalPortal from "../ModalPortal";

interface ComponentProps {
  [key: string]: any;
}

async function compressImageIfApplicable(file: File): Promise<File> {
  // Only compress raster images > 1MB
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml" || file.size < 1024 * 1024) {
    return file;
  }
  return new Promise<File>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1920;
        const maxHeight = 1920;
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function getAttachmentInfo(attachmentUrl?: string, content?: string) {
  let url = attachmentUrl;
  let name = "";
  if (content) {
    const match = content.match(/\[(?:Attachment|Tệp đính kèm):\s*([^\]]+)\]/i);
    if (match) {
      const val = match[1].trim();
      if (val.includes("|")) {
        const parts = val.split("|").map(p => p.trim());
        name = parts[0];
        const urlPart = parts.find(p => p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/"));
        if (urlPart && !url) url = urlPart;
      } else if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/")) {
        if (!url) url = val;
      } else {
        name = val;
      }
    }
  }
  if (!name && url) {
    const raw = url.split("/").pop() || "file_bai_lam";
    name = raw.replace(/^\d+-\d+-/, "");
  }
  return { url, name: name || "Tệp đính kèm" };
}

export default function AssignmentSubmit(props: ComponentProps) {
  const {
    activeSubTab,
    setActiveSubTab,
    viewingCourseId,
    setViewingCourseId,
    filteredCatalog,
    catalogSearch,
    setCatalogSearch,
    catalogCategory,
    setCatalogCategory,
    myEnrolledCourseIds,
    store,
    handleEnrollIntoCourse,
    setLearningCourseId,
    myEnrollments,
    currentUser,
    setActiveLessonId,
    handleToggleLessonComplete,
    learningCourseId,
    currentLearningCourse,
    currentLearningLessons,
    activeLearningEnrollment,
    activeLessonId,
    currentLessonContentObj,
    handleStartQuiz,
    setSubmittingAssignmentId,
    setSubmissionCodeText,
    submittingAssignmentId,
    submissionCodeText,
    handleSendAssignmentSubmit,
    quizTimeRemaining,
    activeQuizId,
    setActiveQuizId,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    quizAnswers,
    quizFinishedState,
    handleSelectQuizAnswer,
    handleAutoSubmitQuiz,
    showProfileEditForm,
    setShowProfileEditForm,
    myProfile,
    editPhone,
    setEditPhone,
    editBirth,
    setEditBirth,
    editGender,
    setEditGender,
    editAddress,
    setEditAddress,
    editParent,
    setEditParent,
    editParentPhone,
    setEditParentPhone,
    onRefreshData,
    triggerToast,
    paymentGuideTx,
    setPaymentGuideTx,
    myNotifications,
    handleMarkNotificationRead
  } = props;

  // Local file state for the submission modal
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<string | null>(null);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubmissionFile(e.target.files?.[0] || null);
  };

  const handleSubmitWithFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAssignment) return;
    const hasText = submissionCodeText.trim().length > 0;
    const selectedFile = submissionFile;
    const hasFile = selectedFile !== null;
    if (!hasText && !hasFile && !existingAttachment) {
      triggerToast("Vui lòng nhập nội dung bài làm hoặc đính kèm tệp.");
      return;
    }

    setIsSubmittingAssignment(true);
    setUploadProgress(null);
    setUploadStatusText("Đang xử lý bài nộp...");
    try {
      let attachmentUrl = existingAttachment || undefined;
      const selectedFileName = selectedFile?.name;
      if (selectedFile) {
        setUploadStatusText("Đang chuẩn bị và tối ưu tệp...");
        const fileToUpload = await compressImageIfApplicable(selectedFile);

        setUploadStatusText("Đang tải tệp lên máy chủ...");
        setUploadProgress(0);
        const uploaded = await api.uploadFile(fileToUpload, (pct) => {
          setUploadProgress(pct);
          setUploadStatusText(`Đang tải tệp lên: ${pct}%`);
        });
        attachmentUrl = uploaded.url;
      }

      setUploadStatusText("Đang lưu bài nộp...");
      let finalContent = submissionCodeText.trim().replace(/\s*\[(?:Attachment|Tệp đính kèm):[^\]]+\]/g, "").trim();
      if (selectedFileName && attachmentUrl) {
        finalContent += (finalContent ? "\n\n" : "") + `[Attachment: ${selectedFileName} | ${attachmentUrl}]`;
      } else if (attachmentUrl) {
        finalContent += (finalContent ? "\n\n" : "") + `[Attachment: ${attachmentUrl}]`;
      }

      const ok = await handleSendAssignmentSubmit(e, finalContent, attachmentUrl);
      if (ok !== false) {
        setSubmissionFile(null);
        setExistingAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Không thể upload tệp đính kèm.");
    } finally {
      setIsSubmittingAssignment(false);
      setUploadProgress(null);
      setUploadStatusText("");
    }
  };

  const cleanSubmissionContent = (content = "") =>
    content.replace(/\s*\[Attachment:[^\]]+\]/g, "").replace(/\s*\[Tệp đính kèm:[^\]]+\]/g, "").trim();

  const openAssignmentSubmission = (assignment: any, submission?: any) => {
    const isDeadlineExpired = new Date(assignment.deadline).getTime() < Date.now();
    if (isDeadlineExpired && !submission) {
      triggerToast("Đã quá hạn nộp bài tập này!");
      return;
    }
    setSubmittingAssignmentId(assignment.id);
    setSubmissionCodeText(cleanSubmissionContent(submission?.content || ""));
    setExistingAttachment(submission?.attachmentUrl || null);
    setSubmissionFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
        {/* Tab 3: Assignments list & Submissions panels */}
        {activeSubTab === "assignments" && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-bold text-slate-900">Bài tập chưa hoàn thành</h4>

            <div className="space-y-4">
              {(() => {
                const placedCourseIds = (store.courseRegistrations || [])
                  .filter((r: any) => r.studentId === currentUser.id && ["registered", "completed"].includes(r.status))
                  .map((r: any) => {
                    const section = (store.courseSections || []).find((s: any) => s.id === r.sectionId);
                    return section ? section.courseId : null;
                  })
                  .filter(Boolean);

                const uncompletedAssignments = store.assignments.filter(a => {
                  if (!placedCourseIds.includes(a.courseId)) return false;
                  const sub = store.submissions.find(s => s.assignmentId === a.id && s.studentId === currentUser.id);
                  return !sub;
                });

                if (uncompletedAssignments.length === 0) {
                  return (
                    <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="h-10 w-10 text-emerald-500 mb-1" />
                      <p className="font-bold text-slate-900">Tuyệt vời! Bạn đã hoàn thành tất cả bài tập.</p>
                      <p className="text-[11px] text-slate-400">Không có bài tập chưa hoàn thành nào tại thời điểm này.</p>
                    </div>
                  );
                }

                return uncompletedAssignments.map(a => {
                  const courseTitle = store.courses.find(c => c.id === a.courseId)?.title || "Không xác định";
                  const isDeadlineExpired = new Date(a.deadline).getTime() < Date.now();

                  return (
                    <div key={a.id} className="mcna-card hover:border-indigo-300 transition-all relative overflow-hidden space-y-4">
                      {isDeadlineExpired && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-800 text-xs">
                          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold">Đã quá hạn nộp bài!</span> Hạn cuối là {new Date(a.deadline).toLocaleDateString("vi-VN")} lúc {new Date(a.deadline).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}. Bạn không thể nộp bài này nữa.
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mcna-badge-primary uppercase">{courseTitle}</span>
                            {(() => {
                              if (a.type === "lesson" && a.lessonId) {
                                const lesson = store.lessons.find((l: any) => l.id === a.lessonId);
                                return (
                                  <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 py-0.5 px-2.5 rounded-full border border-violet-100 uppercase">
                                    Buổi {lesson?.order || ""}: {lesson?.title || "Bài học"}
                                  </span>
                                );
                              }
                              if (a.type === "chapter") {
                                return (
                                  <span className="mcna-badge-warning uppercase">
                                    Cuối chương
                                  </span>
                                );
                              }
                              if (a.type === "midterm") {
                                return (
                                  <span className="mcna-badge-danger uppercase">
                                    Giữa kỳ
                                  </span>
                                );
                              }
                              if (a.type === "final") {
                                return (
                                  <span className="mcna-badge-success uppercase">
                                    Cuối kỳ
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className="text-[10px] font-mono text-slate-400">Hạn nộp: {new Date(a.deadline).toLocaleDateString("vi-VN")}</span>
                          </div>

                          <h5 className="text-sm font-bold text-slate-900 pr-2 leading-snug break-words">{a.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl font-sans break-words">{a.description}</p>
                        </div>

                        <div className="flex-shrink-0 self-start md:self-auto">
                          <button
                            onClick={() => {
                              if (isDeadlineExpired) {
                                triggerToast("Đã quá hạn nộp bài tập này!");
                                return;
                              }
                              setSubmittingAssignmentId(a.id);
                              setSubmissionCodeText("");
                              setExistingAttachment(null);
                            }}
                            disabled={isDeadlineExpired}
                            className="mcna-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Nộp bài làm
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-6">
              <h4 className="text-base font-display font-bold text-slate-900">Bài tập đã hoàn thành</h4>
              {(() => {
                const placedCourseIds = (store.courseRegistrations || [])
                  .filter((r: any) => r.studentId === currentUser.id && ["registered", "completed"].includes(r.status))
                  .map((r: any) => {
                    const section = (store.courseSections || []).find((s: any) => s.id === r.sectionId);
                    return section ? section.courseId : null;
                  })
                  .filter(Boolean);

                const completedAssignments = store.assignments
                  .filter((assignment: any) => placedCourseIds.includes(assignment.courseId))
                  .map((assignment: any) => ({
                    assignment,
                    submission: store.submissions.find((submission: any) =>
                      submission.assignmentId === assignment.id && submission.studentId === currentUser.id
                    )
                  }))
                  .filter((item: any) => item.submission)
                  .sort((a: any, b: any) => new Date(b.submission.submittedAt).getTime() - new Date(a.submission.submittedAt).getTime());

                if (completedAssignments.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 text-xs">
                      Chưa có bài tập đã nộp.
                    </div>
                  );
                }

                return completedAssignments.map(({ assignment, submission }: any) => {
                  const courseTitle = store.courses.find((course: any) => course.id === assignment.courseId)?.title || "Không xác định";
                  const isDeadlineExpired = new Date(assignment.deadline).getTime() < Date.now();
                  const contentPreview = cleanSubmissionContent(submission.content || "");

                  return (
                    <div key={submission.id} className="mcna-card space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-2 min-w-0">
                           <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 py-0.5 px-2.5 rounded-full border border-slate-200 uppercase">{courseTitle}</span>
                            {(() => {
                              if (assignment.type === "lesson" && assignment.lessonId) {
                                const lesson = store.lessons.find((l: any) => l.id === assignment.lessonId);
                                return (
                                  <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 py-0.5 px-2.5 rounded-full border border-violet-100 uppercase">
                                    Buổi {lesson?.order || ""}: {lesson?.title || "Bài học"}
                                  </span>
                                );
                              }
                              if (assignment.type === "chapter") {
                                return (
                                  <span className="mcna-badge-warning uppercase">
                                    Cuối chương
                                  </span>
                                );
                              }
                              if (assignment.type === "midterm") {
                                return (
                                  <span className="mcna-badge-danger uppercase">
                                    Giữa kỳ
                                  </span>
                                );
                              }
                              if (assignment.type === "final") {
                                return (
                                  <span className="mcna-badge-success uppercase">
                                    Cuối kỳ
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className="text-[10px] font-mono text-slate-400">Đã nộp: {new Date(submission.submittedAt).toLocaleString("vi-VN")}</span>
                            <span className={typeof submission.score === "number" ? "mcna-badge-success" : "mcna-badge-warning"}>
                              {typeof submission.score === "number" ? `Đã chấm: ${submission.score}/${assignment.maxScore} điểm` : "Chờ chấm"}
                            </span>
                          </div>
                          <h5 className="text-sm font-bold text-slate-900 leading-snug">{assignment.title}</h5>
                        </div>
                        {!isDeadlineExpired && (
                          <button
                            onClick={() => openAssignmentSubmission(assignment, submission)}
                            className="mcna-btn-secondary text-xs py-1.5"
                          >
                            Cập nhật bài làm
                          </button>
                        )}
                      </div>

                      {contentPreview && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 whitespace-pre-wrap max-h-28 overflow-auto font-mono">
                          {contentPreview}
                        </div>
                      )}

                      {(() => {
                        const att = getAttachmentInfo(submission.attachmentUrl, submission.content);
                        if (!att.url) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-xs">{att.name}</span>
                              <span className="text-[10px] text-indigo-500 font-normal">(Xem / Tải về)</span>
                            </a>
                          </div>
                        );
                      })()}

                      {submission.feedback && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                          <span className="font-bold">Nhận xét của giáo viên:</span> {submission.feedback}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

      {/* ASSIGNMENT ATTACHMENT MODAL SUBMISSION */}
      {submittingAssignmentId && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6.5 w-full max-w-lg shadow-2xl relative mb-10 text-slate-900">
            <button
              onClick={() => setSubmittingAssignmentId(null)}
              disabled={isSubmittingAssignment}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-display font-bold text-slate-900 mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="h-5 w-5 text-indigo-600" /> Nộp sản phẩm & Bài làm bài tập tự luận
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mb-4 font-sans">
              Vui lòng soạn thảo hoặc dán mã nguồn, câu trả lời, nhận xét phân tích hoặc liên kết sản phẩm của bạn vào khung bên dưới. Sau khi hoàn thành, giảng viên sẽ chấm điểm và để lại nhận xét góp ý.
            </p>

            <form onSubmit={handleSubmitWithFileUpload} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nội dung bài làm (văn bản / mã nguồn)</label>
                <textarea
                  placeholder="Nhập mã nguồn HTML, tóm tắt giải pháp hay nội dung trả lời câu hỏi bài tập tự luận..."
                  value={submissionCodeText}
                  onChange={(e) => setSubmissionCodeText(e.target.value)}
                  className="mcna-textarea font-mono h-36 max-h-48 mt-2"
                />
              </div>

              {/* File attachment */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Hoặc đính kèm tệp</label>
                <label className={`mt-1.5 flex items-center gap-3 w-full px-4 py-3 border border-dashed rounded-xl cursor-pointer transition text-xs ${submissionFile ? "border-indigo-400 bg-indigo-50 text-indigo-700" : existingAttachment ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {submissionFile ? submissionFile.name : existingAttachment ? `Giữ tệp cũ: ${existingAttachment}` : "Chọn tệp đính kèm (PDF, DOCX, ZIP, ảnh...)"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.zip,.rar,.png,.jpg,.jpeg,.txt,.py,.js,.html,.css,.java,.cpp,.c"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {submissionFile ? (
                  <button
                    type="button"
                    onClick={() => { setSubmissionFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Xóa tệp đính kèm mới
                  </button>
                ) : existingAttachment ? (
                  <button
                    type="button"
                    onClick={() => setExistingAttachment(null)}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Gỡ bỏ tệp cũ
                  </button>
                ) : null}
              </div>

              {/* Upload progress & feedback */}
              {isSubmittingAssignment && (
                <div className="space-y-1.5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs">
                  <div className="flex items-center justify-between text-indigo-900 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" />
                      <span>{uploadStatusText || "Đang xử lý bài làm..."}</span>
                    </span>
                    {typeof uploadProgress === "number" && (
                      <span className="font-mono font-bold text-indigo-700">{uploadProgress}%</span>
                    )}
                  </div>
                  {typeof uploadProgress === "number" && (
                    <div className="w-full bg-indigo-200/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-200 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setSubmittingAssignmentId(null); setSubmissionFile(null); }}
                  disabled={isSubmittingAssignment}
                  className="mcna-btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssignment}
                  className="mcna-btn-primary disabled:opacity-60 disabled:cursor-wait flex items-center gap-2"
                >
                  {isSubmittingAssignment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>{uploadProgress !== null ? `Đang tải lên ${uploadProgress}%...` : "Đang lưu bài nộp..."}</span>
                    </>
                  ) : (
                    "Xác nhận nộp bài"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Hướng dẫn chuyển khoản học phí Modal */}
    </>
  );
}
