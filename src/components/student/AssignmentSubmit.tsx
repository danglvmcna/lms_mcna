import React, { useRef, useState } from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert } from "lucide-react";
import { api } from "../../api";
import ModalPortal from "../ModalPortal";

interface ComponentProps {
  [key: string]: any;
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
      triggerToast("Vui long nhap noi dung bai lam hoac dinh kem tep.");
      return;
    }

    setIsSubmittingAssignment(true);
    try {
      let attachmentUrl = existingAttachment || undefined;
      if (selectedFile) {
        const uploaded = await api.uploadFile(selectedFile);
        attachmentUrl = uploaded.url;
      }

      let finalContent = submissionCodeText.trim().replace(/\s*\[Attachment:[^\]]+\]/g, "").trim();
      if (selectedFile) {
        finalContent += (finalContent ? "\n\n" : "") + `[Attachment: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)]`;
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
      triggerToast(err.message || "Khong the upload tep dinh kem.");
    } finally {
      setIsSubmittingAssignment(false);
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
            <h4 className="text-base font-display font-semibold text-white">Bài tập chưa hoàn thành</h4>

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
                    <div className="text-center py-16 text-white/40 bg-black/10 rounded-3xl border border-dashed border-white/10 text-xs flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="h-10 w-10 text-emerald-400 mb-1" />
                      <p className="font-semibold text-white">Tuyệt vời! Bạn đã hoàn thành tất cả bài tập.</p>
                      <p className="text-[11px] text-white/40">Không có bài tập chưa hoàn thành nào tại thời điểm này.</p>
                    </div>
                  );
                }

                return uncompletedAssignments.map(a => {
                  const courseTitle = store.courses.find(c => c.id === a.courseId)?.title || "Không xác định";
                  const isDeadlineExpired = new Date(a.deadline).getTime() < Date.now();

                  return (
                    <div key={a.id} className="bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 p-5 rounded-2xl hover:border-white/20 transition-all duration-200 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full filter blur-xl pointer-events-none" />
                      
                      {isDeadlineExpired && (
                        <div className="mb-4 bg-red-500/10 dark:bg-red-950/20 border border-red-500/20 dark:border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-red-800 dark:text-red-200 text-xs animate-pulse">
                          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                          <div>
                            <span className="font-bold">Đã quá hạn nộp bài!</span> Hạn cuối là {new Date(a.deadline).toLocaleDateString("vi-VN")} lúc {new Date(a.deadline).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}. Bạn không thể nộp bài này nữa.
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-500/10 py-0.5 px-2.5 rounded-full border border-indigo-500/20 uppercase">{courseTitle}</span>
                            {(() => {
                              if (a.type === "lesson" && a.lessonId) {
                                const lesson = store.lessons.find((l: any) => l.id === a.lessonId);
                                return (
                                  <span className="text-[10px] font-mono font-bold text-violet-300 bg-violet-500/10 py-0.5 px-2.5 rounded-full border border-violet-500/20 uppercase">
                                    Buổi {lesson?.order || ""}: {lesson?.title || "Bài học"}
                                  </span>
                                );
                              }
                              if (a.type === "chapter") {
                                return (
                                  <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 py-0.5 px-2.5 rounded-full border border-amber-500/20 uppercase">
                                    Cuối chương
                                  </span>
                                );
                              }
                              if (a.type === "midterm") {
                                return (
                                  <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/10 py-0.5 px-2.5 rounded-full border border-rose-500/20 uppercase">
                                    Giữa kỳ
                                  </span>
                                );
                              }
                              if (a.type === "final") {
                                return (
                                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/10 py-0.5 px-2.5 rounded-full border border-emerald-500/20 uppercase">
                                    Cuối kỳ
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className="text-[10px] font-mono text-white/40">Hạn nộp: {new Date(a.deadline).toLocaleDateString("vi-VN")}</span>
                          </div>

                          <h5 className="text-sm font-bold text-white pr-2 leading-snug break-words">{a.title}</h5>
                          <p className="text-xs text-white/60 leading-relaxed max-w-2xl font-sans break-words">{a.description}</p>
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
                            className="p-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl disabled:bg-slate-100 disabled:text-slate-700 disabled:border disabled:border-slate-300 disabled:cursor-not-allowed transition cursor-pointer shadow-lg shadow-indigo-600/10"
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

            <div className="space-y-4 border-t border-white/10 pt-6">
              <h4 className="text-base font-display font-semibold text-white">Bài tập đã hoàn thành</h4>
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
                    <div className="text-center py-10 text-white/40 bg-black/10 rounded-2xl border border-dashed border-white/10 text-xs">
                      Chưa có bài tập đã nộp.
                    </div>
                  );
                }

                return completedAssignments.map(({ assignment, submission }: any) => {
                  const courseTitle = store.courses.find((course: any) => course.id === assignment.courseId)?.title || "Không xác định";
                  const isDeadlineExpired = new Date(assignment.deadline).getTime() < Date.now();
                  const contentPreview = cleanSubmissionContent(submission.content || "");

                  return (
                    <div key={submission.id} className="bg-white/[0.03] border border-white/10 p-5 rounded-2xl space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-2 min-w-0">
                           <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-cyan-200 bg-cyan-500/10 py-0.5 px-2.5 rounded-full border border-cyan-500/20 uppercase">{courseTitle}</span>
                            {(() => {
                              if (assignment.type === "lesson" && assignment.lessonId) {
                                const lesson = store.lessons.find((l: any) => l.id === assignment.lessonId);
                                return (
                                  <span className="text-[10px] font-mono font-bold text-violet-300 bg-violet-500/10 py-0.5 px-2.5 rounded-full border border-violet-500/20 uppercase">
                                    Buổi {lesson?.order || ""}: {lesson?.title || "Bài học"}
                                  </span>
                                );
                              }
                              if (assignment.type === "chapter") {
                                return (
                                  <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 py-0.5 px-2.5 rounded-full border border-amber-500/20 uppercase">
                                    Cuối chương
                                  </span>
                                );
                              }
                              if (assignment.type === "midterm") {
                                return (
                                  <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-500/10 py-0.5 px-2.5 rounded-full border border-rose-500/20 uppercase">
                                    Giữa kỳ
                                  </span>
                                );
                              }
                              if (assignment.type === "final") {
                                return (
                                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/10 py-0.5 px-2.5 rounded-full border border-emerald-500/20 uppercase">
                                    Cuối kỳ
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className="text-[10px] font-mono text-white/45">Đã nộp: {new Date(submission.submittedAt).toLocaleString("vi-VN")}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeof submission.score === "number" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                              {typeof submission.score === "number" ? `Đã chấm: ${submission.score}/${assignment.maxScore} điểm` : "Chờ chấm"}
                            </span>
                          </div>
                          <h5 className="text-sm font-bold text-white leading-snug">{assignment.title}</h5>
                        </div>
                        {!isDeadlineExpired && (
                          <button
                            onClick={() => openAssignmentSubmission(assignment, submission)}
                            className="px-3 py-2 bg-white text-indigo-950 rounded-xl text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
                          >
                            Cập nhật bài làm
                          </button>
                        )}
                      </div>

                      {contentPreview && (
                        <div className="rounded-xl bg-black/25 border border-white/5 p-3 text-xs text-white/70 whitespace-pre-wrap max-h-28 overflow-auto">
                          {contentPreview}
                        </div>
                      )}

                      {submission.attachmentUrl && (
                        <a
                          href={submission.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-cyan-200 hover:text-cyan-100 font-semibold"
                        >
                          <FileText className="h-3.5 w-3.5" /> Xem tệp đã nộp
                        </a>
                      )}

                      {submission.feedback && (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/20 p-3 text-xs text-emerald-100">
                          <span className="font-bold">Nhận xét:</span> {submission.feedback}
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6.5 w-full max-w-lg shadow-2xl relative mb-10">
            <button
              onClick={() => setSubmittingAssignmentId(null)}
              disabled={isSubmittingAssignment}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <FileText className="h-5 w-5 text-indigo-400" /> Nộp sản phẩm & Bài làm bài tập tự luận
            </h3>

            <p className="text-xs text-white/50 leading-relaxed mb-4">
              Vui lòng soạn thảo hoặc dán mã nguồn, câu trả lời, nhận xét phân tích hoặc liên kết sản phẩm của bạn vào khung bên dưới. Sau khi hoàn thành, giảng viên sẽ chấm điểm và để lại nhận xét góp ý.
            </p>

            <form onSubmit={handleSubmitWithFileUpload} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Nội dung bài làm (văn bản / mã nguồn)</label>
                <textarea
                  placeholder="Nhập mã nguồn HTML, tóm tắt giải pháp hay nội dung trả lời câu hỏi bài tập tự luận..."
                  value={submissionCodeText}
                  onChange={(e) => setSubmissionCodeText(e.target.value)}
                  className="w-full px-3.5 py-3 bg-black/30 text-white font-mono placeholder-white/20 h-36 max-h-48 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs mt-2"
                />
              </div>

              {/* File attachment */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Hoặc đính kèm tệp</label>
                <label className={`mt-1.5 flex items-center gap-3 w-full px-4 py-3 border border-dashed rounded-xl cursor-pointer transition text-xs ${submissionFile ? "border-indigo-400/60 bg-indigo-500/10 text-indigo-300" : existingAttachment ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300" : "border-white/15 bg-white/3 text-white/40 hover:border-white/30 hover:text-white/60"}`}>
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
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Xóa tệp đính kèm mới
                  </button>
                ) : existingAttachment ? (
                  <button
                    type="button"
                    onClick={() => setExistingAttachment(null)}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Gỡ bỏ tệp cũ
                  </button>
                ) : null}
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setSubmittingAssignmentId(null); setSubmissionFile(null); }}
                  disabled={isSubmittingAssignment}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssignment}
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {isSubmittingAssignment ? "Đang gửi..." : "Xác nhận nộp bài"}
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
