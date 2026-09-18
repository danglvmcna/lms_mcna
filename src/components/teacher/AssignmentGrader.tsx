import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";
import ModalPortal from "../ModalPortal";
import { api } from "../../api";

interface ComponentProps {
  [key: string]: any;
}

export default function AssignmentGrader(props: ComponentProps) {
  const [submissionSearch, setSubmissionSearch] = React.useState("");
  const [courseDetailId, setCourseDetailId] = React.useState<string | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = React.useState<string | null>(null);
  const [feedbackTemplates, setFeedbackTemplates] = React.useState<any[]>([]);

  // Sorting state for student submissions grading table
  const [subSortField, setSubSortField] = React.useState<string>("studentName");
  const [subSortOrder, setSubSortOrder] = React.useState<"asc" | "desc">("asc");

  const handleSubSort = (field: string) => {
    if (subSortField === field) {
      setSubSortOrder(subSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSubSortField(field);
      setSubSortOrder("asc");
    }
  };
  const {
    activeSubTab,
    setActiveSubTab,
    selectedCourseId,
    setSelectedCourseId,
    selectedQuizId,
    setSelectedQuizId,
    showCourseModal,
    setShowCourseModal,
    courseModalMode,
    courseTitle,
    setCourseTitle,
    courseDesc,
    setCourseDesc,
    courseCategory,
    setCourseCategory,
    courseThumb,
    setCourseThumb,
    coursePrice,
    setCoursePrice,
    courseLevel,
    setCourseLevel,
    courseTags,
    setCourseTags,
    showLessonModal,
    setShowLessonModal,
    lessonTitle,
    setLessonTitle,
    lessonContent,
    setLessonContent,
    lessonVideo,
    setLessonVideo,
    lessonDuration,
    setLessonDuration,
    showQuizModal,
    setShowQuizModal,
    quizTitle,
    setQuizTitle,
    quizPassing,
    setQuizPassing,
    quizLimit,
    setQuizLimit,
    quizAttempts,
    setQuizAttempts,
    showQuestionModal,
    setShowQuestionModal,
    qText,
    setQText,
    qType,
    setQType,
    qOptions,
    setQOptions,
    qCorrect,
    setQCorrect,
    showAssignModal,
    setShowAssignModal,
    assignTitle,
    setAssignTitle,
    assignDesc,
    setAssignDesc,
    assignDeadline,
    setAssignDeadline,
    assignMaxScore,
    setAssignMaxScore,
    activeSubmissionId,
    setActiveSubmissionId,
    gradingScore,
    setGradingScore,
    gradingFeedback,
    setGradingFeedback,
    store,
    currentUser,
    myCourses,
    myCourseIds,
    handleOpenCreateCourse,
    handleOpenEditCourse,
    handleSaveCourse,
    handleSubmitCourseForApproval,
    handleAddLessonSubmit,
    handleAddQuizSubmit,
    handleAddQuestionSubmit,
    handleAddAssignmentSubmit,
    handleGradeSubmission,
    handleExportCSVGradebook,
    activeCourse,
    lessons,
    courseQuizzes,
    courseAssignments,
    myAssignments,
    studentSubmissionsRaw
  } = props;

  React.useEffect(() => {
    const submission = activeSubmissionId ? store.submissions.find((item: any) => item.id === activeSubmissionId) : null;
    const assignment = submission ? store.assignments.find((item: any) => item.id === submission.assignmentId) : null;
    if (!activeSubmissionId || !assignment?.courseId) {
      setFeedbackTemplates([]);
      return;
    }
    let cancelled = false;
    api.listFeedbackTemplates(assignment.courseId)
      .then((items: any[]) => { if (!cancelled) setFeedbackTemplates(Array.isArray(items) ? items : []); })
      .catch(() => { if (!cancelled) setFeedbackTemplates([]); });
    return () => { cancelled = true; };
  }, [activeSubmissionId, store.submissions, store.assignments]);

  const filteredSubmissions = studentSubmissionsRaw.filter((sub: any) => {
    const student = store.users.find((u: any) => u.id === sub.studentId);
    const challenge = store.assignments.find((a: any) => a.id === sub.assignmentId);
    return !submissionSearch ||
      (student?.name || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
      (challenge?.title || "").toLowerCase().includes(submissionSearch.toLowerCase());
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a: any, b: any) => {
    if (!subSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    const studentA = store.users.find((u: any) => u.id === a.studentId);
    const studentB = store.users.find((u: any) => u.id === b.studentId);
    const challengeA = store.assignments.find((ea: any) => ea.id === a.assignmentId);
    const challengeB = store.assignments.find((ea: any) => ea.id === b.assignmentId);

    if (subSortField === "studentName") {
      valA = studentA?.name || "";
      valB = studentB?.name || "";
    } else if (subSortField === "challengeTitle") {
      valA = challengeA?.title || "";
      valB = challengeB?.title || "";
    } else if (subSortField === "submittedAt") {
      valA = new Date(a.submittedAt).getTime();
      valB = new Date(b.submittedAt).getTime();
    } else if (subSortField === "score") {
      valA = a.score !== undefined ? a.score : -1;
      valB = b.score !== undefined ? b.score : -1;
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return subSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return subSortOrder === "asc" ? valA - valB : valB - valA;
  });

  return (
    <>
        {/* Tab 3: Assignments list & Student submissions grading cockpit */}
        {activeSubTab === "assignments" && (
          <div className="space-y-6">
            <h4 className="text-base font-semibold text-slate-900">Bảng Chấm điểm Bài tự luận của Học viên</h4>

            {/* Submissions Search Input bar */}
            <div className="flex items-center gap-2 bg-white border border-slate-200/80 px-3 py-2 rounded-xl text-xs max-w-sm shadow-xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Tìm tên học viên hoặc tên bài tập..."
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                className="w-full bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none font-sans text-xs"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-bold text-slate-900">Bài tập đã giao</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">Bài tập vừa tạo sẽ hiện ở đây ngay cả khi chưa có học viên nộp bài.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <PlusCircle className="h-4 w-4" /> Tạo bài tập
                </button>
              </div>

              {myAssignments.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
                  Chưa có bài tập nào được giao cho các khóa học của bạn.
                </div>
              ) : (
                <div className="space-y-3">
                  {myCourses.map((course: any) => {
                    const assignmentsForCourse = myAssignments.filter((assignment: any) => assignment.courseId === course.id);
                    if (assignmentsForCourse.length === 0) return null;

                    return (
                      <div key={`assigned-${course.id}`} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                          <div>
                            <h6 className="text-sm font-bold text-indigo-700">{course.title}</h6>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{assignmentsForCourse.length} bài tập đã giao</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {assignmentsForCourse.map((assignment: any) => {
                            const submissions = store.submissions.filter((submission: any) => submission.assignmentId === assignment.id);
                            const gradedCount = submissions.filter((submission: any) => typeof submission.score === "number").length;
                            const session = (store.attendanceSessions || []).find((item: any) => item.id === assignment.sessionId);
                            return (
                              <div key={assignment.id} className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-3 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h6 className="font-bold text-slate-900 text-xs leading-snug break-words">{assignment.title}</h6>
                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{assignment.description}</p>
                                  </div>
                                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px] font-bold font-mono">
                                    {assignment.maxScore || 100} điểm
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                                  <span>Hạn: <strong className="text-slate-800 font-semibold">{new Date(assignment.deadline).toLocaleDateString("vi-VN")}</strong></span>
                                  <span>Nộp: <strong className="text-slate-800 font-semibold">{submissions.length}</strong></span>
                                  <span>Đã chấm: <strong className="text-slate-800 font-semibold">{gradedCount}</strong></span>
                                  <span className="truncate" title={session?.topic || ""}>Buổi: <strong className="text-slate-800 font-semibold">{session?.topic || "Chưa rõ"}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {myCourses.map(course => {
                const courseAssignments = store.assignments.filter((a: any) => a.courseId === course.id);
                const courseAssignmentIds = courseAssignments.map((a: any) => a.id);
                const courseSubmissions = sortedSubmissions.filter((sub: any) => courseAssignmentIds.includes(sub.assignmentId));
                
                if (courseSubmissions.length === 0) return null;
                
                return (
                  <div key={course.id} className="mcna-card space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 font-display flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-indigo-600" /> {course.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Phân loại: {course.category} · Tổng số {courseSubmissions.length} bài nộp</p>
                      </div>
                    </div>

                    <div className="mcna-table-wrapper">
                      <table className="mcna-table">
                        <thead className="mcna-thead">
                          <tr>
                            <th className="mcna-th cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSubSort("studentName")}>
                              Tên Học viên {subSortField === "studentName" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="mcna-th cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSubSort("challengeTitle")}>
                              Bài tập Thử thách {subSortField === "challengeTitle" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="mcna-th cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSubSort("submittedAt")}>
                              Ngày nộp {subSortField === "submittedAt" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="mcna-th cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSubSort("score")}>
                              Điểm số đạt được {subSortField === "score" ? (subSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="mcna-th text-right">Hành động Chấm điểm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {courseSubmissions.map((sub: any) => {
                            const student = store.users.find((u: any) => u.id === sub.studentId);
                            const challenge = store.assignments.find((a: any) => a.id === sub.assignmentId);
                            
                            return (
                              <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="mcna-td font-medium text-slate-900">{student?.name || "Học viên ẩn danh"}</td>
                                <td className="mcna-td font-semibold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <span>{challenge?.title || "Không xác định"}</span>
                                    {challenge && (
                                      <button
                                        onClick={() => setCourseDetailId(challenge.courseId)}
                                        className="mcna-badge-primary inline-flex items-center gap-1 cursor-pointer hover:bg-indigo-100 transition"
                                      >
                                        <Eye className="w-3 h-3" /> Xem
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="mcna-td text-slate-500 font-mono text-[11px]">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td className="mcna-td">
                                  {sub.score !== undefined ? (
                                    <span className="mcna-badge-success">
                                      {sub.score}/{challenge?.maxScore || 100} điểm
                                    </span>
                                  ) : (
                                    <span className="mcna-badge-warning">
                                      Chưa chấm điểm
                                    </span>
                                  )}
                                </td>
                                <td className="mcna-td text-right">
                                  <button
                                    onClick={() => {
                                      setActiveSubmissionId(sub.id);
                                      setGradingScore(sub.score ?? challenge?.maxScore ?? 100);
                                      setGradingFeedback(sub.feedback ?? "");
                                    }}
                                    className="mcna-btn-secondary text-[11px] py-1.5"
                                  >
                                    {sub.score !== undefined ? "Cập nhật Điểm" : "Chấm điểm & Nhận xét"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {studentSubmissionsRaw.filter((sub: any) => {
                const student = store.users.find((u: any) => u.id === sub.studentId);
                const challenge = store.assignments.find((a: any) => a.id === sub.assignmentId);
                return !submissionSearch ||
                  (student?.name || "").toLowerCase().includes(submissionSearch.toLowerCase()) ||
                  (challenge?.title || "").toLowerCase().includes(submissionSearch.toLowerCase());
              }).length === 0 && (
                <div className="text-center py-12 text-slate-400 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs font-medium">
                  {studentSubmissionsRaw.length === 0 ? "Hiện chưa có học viên nào nộp bài tự luận cho các bài tập được giao." : "Không tìm thấy bài nộp nào phù hợp với bộ lọc."}
                </div>
              )}
            </div>
          </div>
        )}



      {/* MODAL 6: EVALUATE & GRADE FORM */}
      {activeSubmissionId && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setActiveSubmissionId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Award className="h-5 w-5 text-indigo-600" /> Chấm điểm & Nhận xét Sản phẩm
            </h3>

            {(() => {
              const sub = store.submissions.find(s => s.id === activeSubmissionId);
              const chal = store.assignments.find(a => a.id === sub?.assignmentId);
              const stud = store.users.find(u => u.id === sub?.studentId);
              return (
                <form onSubmit={handleGradeSubmission} className="space-y-4 text-xs font-sans">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Nội dung bài làm ({stud?.name})</span>
                    <p className="text-slate-800 leading-relaxed font-mono whitespace-pre-wrap max-h-32 overflow-y-auto pr-1 text-xs">
                      {sub?.content ? sub.content.replace(/\s*\[Attachment:[^\]]+\]/g, "").replace(/\s*\[Tệp đính kèm:[^\]]+\]/g, "") : ""}
                    </p>

                    {(() => {
                      let extractedUrl = sub?.attachmentUrl;
                      if (!extractedUrl && sub?.content) {
                        const match = sub.content.match(/\[Attachment:\s*([^\]]+)\]/) || sub.content.match(/\[Tệp đính kèm:\s*([^\]]+)\]/);
                        if (match) {
                          const val = match[1].trim();
                          if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/")) {
                            extractedUrl = val;
                          }
                        }
                      }
                      if (!extractedUrl) return null;

                      return (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Tệp đính kèm:</span>
                          <button
                            type="button"
                            onClick={() => setPreviewAttachmentUrl(extractedUrl)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition text-[11px] font-semibold cursor-pointer font-sans"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem file bài làm
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Nhập Điểm số (Tối đa: {chal?.maxScore || 100})</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={chal?.maxScore || 100}
                      value={gradingScore}
                      onChange={(e) => setGradingScore(Number(e.target.value))}
                      className="mcna-input"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Góp ý & Nhận xét của Giảng viên</label>
                    {feedbackTemplates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-1.5">
                        {feedbackTemplates.map((template: any) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setGradingFeedback((current: string) => current ? `${current}\n${template.content}` : template.content)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                            title={template.content}
                          >
                            + {template.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      required
                      placeholder="Ví dụ: Ý tưởng tốt, cách trình bày rõ ràng, cần tối ưu thêm mã nguồn."
                      value={gradingFeedback}
                      onChange={(e) => setGradingFeedback(e.target.value)}
                      className="mcna-textarea h-20 max-h-32"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveSubmissionId(null)}
                      className="mcna-btn-ghost"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="mcna-btn-primary"
                    >
                      Hoàn tất Chấm điểm
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
        </ModalPortal>
      )}

      {previewAttachmentUrl && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[86vh] shadow-2xl relative overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-white">
                <h3 className="text-sm font-semibold text-slate-900">Xem file bài làm</h3>
                <div className="flex items-center gap-2">
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
                  <div className="h-full w-full overflow-auto flex items-center justify-center p-4">
                    <img src={previewAttachmentUrl} alt="File bài làm" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : /\.(pdf|txt|html|htm)(\?|#|$)/i.test(previewAttachmentUrl) ? (
                  <iframe
                    title="File bài làm"
                    src={previewAttachmentUrl}
                    className="h-full w-full border-0 bg-white"
                  />
                ) : (() => {
                  const filename = previewAttachmentUrl.split("/").pop() || "assignment_file";
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center text-slate-900 bg-white space-y-6">
                      <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-600">
                        <FileText className="h-16 w-16" />
                      </div>
                      <div className="space-y-2 max-w-md">
                        <h4 className="text-base font-bold truncate px-4" title={filename}>{filename}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-sans">
                          Định dạng file này không hỗ trợ xem trực tiếp trực tuyến. Vui lòng tải file bài làm về thiết bị để xem chi tiết.
                        </p>
                      </div>
                      <a
                        href={previewAttachmentUrl}
                        download
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer font-sans decoration-none"
                      >
                        <Download className="h-4 w-4" /> Tải file bài làm xuống
                      </a>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Premium glassmorphic Course Details consultation modal */}
      {courseDetailId && (() => {
        const course = store.courses.find((c: any) => c.id === courseDetailId);
        if (!course) return null;
        const teacher = store.users.find((u: any) => u.id === course.teacherId) || { name: "Chưa phân công" };
        const lessons = store.lessons.filter((l: any) => l.courseId === course.id).sort((a: any, b: any) => a.order - b.order);
        const quizzes = store.quizzes.filter((q: any) => q.courseId === course.id);
        const assignments = store.assignments.filter((a: any) => a.courseId === course.id);
        const formatVND = (num: number) => {
          return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
        };
        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto text-slate-900">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-150 text-slate-900 font-sans max-h-[85vh] overflow-y-auto flex flex-col justify-between">
              <div className="space-y-5 text-left">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {course.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-2">{course.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">Giảng viên: <strong className="text-slate-800">{teacher.name}</strong></p>
                  </div>
                  <button 
                    onClick={() => setCourseDetailId(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    <span className="text-base font-bold">✕</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-sans">
                  <div>
                    <span className="text-slate-500 block">Học phí:</span>
                    <strong className="text-sm font-mono text-emerald-600 font-bold">{course.price ? formatVND(course.price) : "Miễn phí"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cấp trình độ:</span>
                    <strong className="text-indigo-600 capitalize font-medium">{course.level || "Cơ bản"}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Mô tả khóa đào tạo:</span>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 font-sans">{course.description}</p>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-1 font-sans">
                    Khung chương trình ({lessons.length} bài học, {quizzes.length} bài thi, {assignments.length} tự luận)
                  </span>
                  
                  {lessons.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-sans">
                      {lessons.map((lesson: any, idx: number) => (
                        <div key={lesson.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-800">Bài {idx + 1}: {lesson.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{lesson.duration || "15 phút"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic font-sans">Chưa tải giáo trình bài giảng cho lớp học này.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-5 flex justify-end">
                <button
                  onClick={() => setCourseDetailId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer font-sans"
                >
                  Đóng thông tin
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}
    </>
  );
}
