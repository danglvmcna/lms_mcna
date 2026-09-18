import React, { useRef, useState } from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert, Loader2, UploadCloud, Eye, Download } from "lucide-react";
import { api } from "../../api";
import ModalPortal from "../ModalPortal";
import { parseSubmissionFiles, cleanSubmissionContent, formatBytes, renderSubmissionFileIcon, buildSubmissionFileInfo, SubmissionFileInfo } from "../../submissionFiles";
import { PowerPointLogo, WordLogo, ExcelLogo, PdfLogo } from "../icons/BrandLogos";

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
              resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
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

  // Local multi-file state for the submission modal
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<SubmissionFileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const removeExistingFile = (index: number) => {
    setExistingFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitWithFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAssignment) return;
    const hasText = submissionCodeText.trim().length > 0;
    const hasFiles = selectedFiles.length > 0 || existingFiles.length > 0;
    if (!hasText && !hasFiles) {
      triggerToast("Vui lòng nhập nội dung bài làm hoặc đính kèm tệp.");
      return;
    }

    setIsSubmittingAssignment(true);
    setUploadProgress(null);
    setUploadStatusText("Đang xử lý bài nộp...");
    try {
      const uploadedFiles: { name: string; url: string }[] = [];
      const totalFilesToUpload = selectedFiles.length;

      for (let i = 0; i < totalFilesToUpload; i++) {
        const file = selectedFiles[i];
        setUploadStatusText(`Đang tối ưu tệp (${i + 1}/${totalFilesToUpload}): ${file.name}...`);
        const fileToUpload = await compressImageIfApplicable(file);

        setUploadStatusText(`Đang tải lên (${i + 1}/${totalFilesToUpload}): ${file.name}...`);
        const uploaded = await api.uploadFile(fileToUpload, (pct) => {
          const overall = Math.round(((i * 100) + pct) / totalFilesToUpload);
          setUploadProgress(overall);
          setUploadStatusText(`Đang tải lên (${i + 1}/${totalFilesToUpload}): ${file.name} (${pct}%)`);
        });
        uploadedFiles.push({ name: file.name, url: uploaded.url });
      }

      setUploadStatusText("Đang lưu bài nộp...");
      const allFinalFiles = [
        ...existingFiles.map(f => ({ name: f.filename, url: f.url })),
        ...uploadedFiles
      ];

      let finalContent = cleanSubmissionContent(submissionCodeText);
      for (const f of allFinalFiles) {
        finalContent += (finalContent ? "\n\n" : "") + `[Attachment: ${f.name} | ${f.url}]`;
      }

      const primaryAttachmentUrl = allFinalFiles.length > 0 ? allFinalFiles[0].url : undefined;
      const ok = await handleSendAssignmentSubmit(e, finalContent, primaryAttachmentUrl);
      if (ok !== false) {
        setSelectedFiles([]);
        setExistingFiles([]);
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

  const openAssignmentSubmission = (assignment: any, submission?: any) => {
    const isDeadlineExpired = new Date(assignment.deadline).getTime() < Date.now();
    if (isDeadlineExpired && !submission) {
      triggerToast("Đã quá hạn nộp bài tập này!");
      return;
    }
    setSubmittingAssignmentId(assignment.id);
    setSubmissionCodeText(cleanSubmissionContent(submission?.content || ""));
    setExistingFiles(parseSubmissionFiles(submission?.content, submission?.attachmentUrl));
    setSelectedFiles([]);
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
                        const files = parseSubmissionFiles(submission.content, submission.attachmentUrl);
                        if (files.length === 0) return null;
                        return (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                              Tệp đính kèm ({files.length} tệp):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {files.map((file, fIdx) => (
                                <div key={fIdx} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition shadow-2xs">
                                  {renderSubmissionFileIcon(file, "h-4 w-4 shrink-0")}
                                  <span className="truncate max-w-[180px] font-semibold text-slate-800" title={file.filename}>
                                    {file.filename}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0 ml-1 border-l border-slate-200 pl-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewAttachmentUrl(file.url)}
                                      className="p-1 rounded hover:bg-indigo-50 text-indigo-600 transition cursor-pointer"
                                      title="Xem tệp trực tiếp"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <a
                                      href={file.url}
                                      download={file.filename}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                      title="Tải tệp về máy"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
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

      {/* ASSIGNMENT MULTI-FILE MODAL SUBMISSION */}
      {submittingAssignmentId && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6.5 w-full max-w-lg shadow-2xl relative mb-10 text-slate-900">
            <button
              onClick={() => {
                setSubmittingAssignmentId(null);
                setSelectedFiles([]);
                setExistingFiles([]);
              }}
              disabled={isSubmittingAssignment}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-display font-bold text-slate-900 mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="h-5 w-5 text-indigo-600" /> Nộp sản phẩm & Bài làm bài tập tự luận
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mb-4 font-sans">
              Soạn thảo câu trả lời hoặc đính kèm nhiều tệp bài làm (Word, Excel, PowerPoint, PDF, ảnh, ZIP...). Giảng viên sẽ chấm điểm và phản hồi nhận xét trực tiếp.
            </p>

            <form onSubmit={handleSubmitWithFileUpload} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nội dung bài làm (văn bản / mã nguồn)</label>
                <textarea
                  placeholder="Nhập mã nguồn HTML, tóm tắt giải pháp hay nội dung trả lời câu hỏi bài tập tự luận..."
                  value={submissionCodeText}
                  onChange={(e) => setSubmissionCodeText(e.target.value)}
                  className="mcna-textarea font-mono h-32 max-h-44 mt-1.5"
                />
              </div>

              {/* Multi-file attachment dropzone & list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Đính kèm các tệp bài làm</label>
                  {(selectedFiles.length > 0 || existingFiles.length > 0) && (
                    <span className="text-[11px] font-semibold text-indigo-600 font-mono">
                      Tổng cộng: {existingFiles.length + selectedFiles.length} tệp
                    </span>
                  )}
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFilesAdded(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-4 border-2 border-dashed rounded-2xl cursor-pointer transition text-center flex flex-col items-center justify-center gap-1.5 ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50/80 text-indigo-700 scale-[0.99]"
                      : "border-slate-300 bg-slate-50/70 hover:bg-slate-50 text-slate-600 hover:border-indigo-400"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-indigo-600">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-indigo-600 hover:underline">Nhấn để chọn tệp</span> hoặc kéo thả nhiều tệp vào đây
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Hỗ trợ: PDF, Word (DOCX), Excel (XLSX), PowerPoint (PPTX), ZIP, RAR, Ảnh... (cho phép chọn nhiều tệp)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.png,.jpg,.jpeg,.txt,.py,.js,.html,.css,.java,.cpp,.c"
                    onChange={(e) => {
                      handleFilesAdded(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
                    className="hidden"
                  />
                </div>

                {/* Existing & Selected Files list */}
                {(existingFiles.length > 0 || selectedFiles.length > 0) && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {/* Existing files */}
                    {existingFiles.map((file, idx) => (
                      <div key={`exist-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs transition">
                        <div className="flex items-center gap-2 min-w-0">
                          {renderSubmissionFileIcon(file, "h-4 w-4 shrink-0")}
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 truncate block max-w-xs" title={file.filename}>
                              {file.filename}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium">Tệp đã nộp trước đó</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingFile(idx)}
                          className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer shrink-0"
                          title="Gỡ bỏ tệp này"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {/* New files */}
                    {selectedFiles.map((file, idx) => {
                      const fileInfo = buildSubmissionFileInfo("", file.name);
                      return (
                        <div key={`new-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200 text-xs transition">
                          <div className="flex items-center gap-2 min-w-0">
                            {renderSubmissionFileIcon(fileInfo, "h-4 w-4 shrink-0")}
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 truncate block max-w-xs" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-[10px] text-indigo-600 font-mono">
                                Mới • {formatBytes(file.size)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer shrink-0"
                            title="Xóa tệp này"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upload progress & feedback */}
              {isSubmittingAssignment && (
                <div className="space-y-1.5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs">
                  <div className="flex items-center justify-between text-indigo-900 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" />
                      <span className="truncate max-w-xs">{uploadStatusText || "Đang xử lý bài làm..."}</span>
                    </span>
                    {typeof uploadProgress === "number" && (
                      <span className="font-mono font-bold text-indigo-700 shrink-0">{uploadProgress}%</span>
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
                  onClick={() => {
                    setSubmittingAssignmentId(null);
                    setSelectedFiles([]);
                    setExistingFiles([]);
                  }}
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

      {/* STUDENT PREVIEW FILE ATTACHMENT MODAL */}
      {previewAttachmentUrl && (() => {
        const rawFilename = previewAttachmentUrl.split("/").pop() || "assignment_file";
        const cleanFilename = rawFilename.replace(/^\d+-\d+-/, "");
        const ext = "." + (cleanFilename.split(".").pop() || "").toLowerCase();
        const isWord = [".doc", ".docx"].includes(ext);
        const isExcel = [".xls", ".xlsx", ".csv"].includes(ext);
        const isPowerPoint = [".ppt", ".pptx"].includes(ext);

        return (
          <ModalPortal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[86vh] shadow-2xl relative overflow-hidden flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-white gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {isWord ? (
                      <WordLogo className="h-4 w-4 shrink-0" />
                    ) : isExcel ? (
                      <ExcelLogo className="h-4 w-4 shrink-0" />
                    ) : isPowerPoint ? (
                      <PowerPointLogo className="h-4 w-4 shrink-0" />
                    ) : ext === ".pdf" ? (
                      <PdfLogo className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                    )}
                    <h3 className="text-sm font-bold text-slate-900 truncate" title={cleanFilename}>
                      {cleanFilename}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={previewAttachmentUrl}
                      download={cleanFilename}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs decoration-none cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> Tải về máy
                    </a>
                    <a
                      href={previewAttachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 transition"
                    >
                      Mở tab mới
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreviewAttachmentUrl(null)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-900">
                  {/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(previewAttachmentUrl) ? (
                    <div className="h-full w-full overflow-auto flex items-center justify-center p-4 bg-slate-900">
                      <img src={previewAttachmentUrl} alt="File bài làm" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : /\.(pdf|txt|html|htm)(\?|#|$)/i.test(previewAttachmentUrl) ? (
                    <iframe
                      title="File bài làm"
                      src={previewAttachmentUrl}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center text-slate-900 bg-white space-y-5">
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
                        {isWord ? (
                          <WordLogo className="h-16 w-16" />
                        ) : isExcel ? (
                          <ExcelLogo className="h-16 w-16" />
                        ) : isPowerPoint ? (
                          <PowerPointLogo className="h-16 w-16" />
                        ) : (
                          <FileText className="h-16 w-16 text-indigo-600" />
                        )}
                      </div>
                      <div className="space-y-1.5 max-w-md">
                        <div className="flex justify-center">
                          {isWord && <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold font-mono uppercase tracking-wide">Microsoft Word (.docx)</span>}
                          {isExcel && <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono uppercase tracking-wide">Microsoft Excel (.xlsx)</span>}
                          {isPowerPoint && <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold font-mono uppercase tracking-wide">Microsoft PowerPoint (.pptx)</span>}
                          {!isWord && !isExcel && !isPowerPoint && <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold font-mono uppercase tracking-wide">{ext.toUpperCase() || "TỆP ĐÍNH KÈM"}</span>}
                        </div>
                        <h4 className="text-base font-bold text-slate-900 truncate px-4" title={cleanFilename}>{cleanFilename}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-sans">
                          Tệp bài làm này đã được lưu trữ an toàn trên hệ thống. Bạn có thể tải tệp về thiết bị để xem chi tiết hoặc mở trong ứng dụng tương ứng.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href={previewAttachmentUrl}
                          download={cleanFilename}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer font-sans decoration-none"
                        >
                          <Download className="h-4 w-4" /> Tải file bài làm xuống
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        );
      })()}

      {/* Hướng dẫn chuyển khoản học phí Modal */}
    </>
  );
}
