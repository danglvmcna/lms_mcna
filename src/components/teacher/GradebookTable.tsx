import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";
import ModalPortal from "../ModalPortal";

interface ComponentProps {
  [key: string]: any;
}

export default function GradebookTable(props: ComponentProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [courseDetailId, setCourseDetailId] = React.useState<string | null>(null);

  // Sorting state for student gradebook matrix table
  const [gradebookSortField, setGradebookSortField] = React.useState<string>("studentName");
  const [gradebookSortOrder, setGradebookSortOrder] = React.useState<"asc" | "desc">("asc");

  const handleGradebookSort = (field: string) => {
    if (gradebookSortField === field) {
      setGradebookSortOrder(gradebookSortOrder === "asc" ? "desc" : "asc");
    } else {
      setGradebookSortField(field);
      setGradebookSortOrder("asc");
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

  const getEnrollmentSection = (enroll: any) => {
    const registration = (store.courseRegistrations || []).find((r: any) => {
      if (r.studentId !== enroll.studentId || r.status !== "registered") return false;
      return (store.courseSections || []).some((s: any) => s.id === r.sectionId && s.courseId === enroll.courseId);
    });
    return registration
      ? (store.courseSections || []).find((s: any) => s.id === registration.sectionId && s.courseId === enroll.courseId)
      : null;
  };

  const matchesGradebookSearch = (course: any, enroll: any) => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    const studentUser = store.users.find((u: any) => u.id === enroll.studentId);
    const section = getEnrollmentSection(enroll);
    return [
      studentUser?.name,
      studentUser?.email,
      course?.title,
      course?.category,
      section?.sectionCode
    ].some((value) => String(value || "").toLowerCase().includes(query));
  };

  return (
    <>
        {/* Tab 4: Student gradebook matrix table & CSV Export */}
        {activeSubTab === "gradebook" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h4 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-indigo-600" />
                  Sổ điểm Tổng hợp & Kiểm định Tiến trình
                </h4>
                <p className="text-xs text-slate-500 mt-1">Thống kê tiến độ xem bài giảng và điểm thi trung bình của học viên đăng ký.</p>
              </div>

              <button
                onClick={handleExportCSVGradebook}
                disabled={studentSubmissionsRaw.length === 0}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0"
              >
                <Download className="h-4 w-4 text-slate-500" /> Xuất bảng điểm CSV
              </button>
            </div>

            <div className="relative max-w-sm w-full">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm học viên theo tên hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-xs font-sans"
              />
            </div>

            <div className="space-y-6">
              {myCourses.map((course: any) => {
                const courseEnrollments = store.enrollments.filter((e: any) => e.courseId === course.id);
                
                const filteredCourseEnrollments = courseEnrollments.filter((enroll: any) => matchesGradebookSearch(course, enroll));

                if (courseEnrollments.length === 0) return null;
                if (filteredCourseEnrollments.length === 0 && searchTerm) return null;

                const sortedCourseEnrollments = [...filteredCourseEnrollments].sort((a: any, b: any) => {
                  if (!gradebookSortField) return 0;
                  let valA: any = "";
                  let valB: any = "";

                  const studentA = store.users.find((u: any) => u.id === a.studentId);
                  const studentB = store.users.find((u: any) => u.id === b.studentId);

                  if (gradebookSortField === "studentName") {
                    valA = studentA?.name || "";
                    valB = studentB?.name || "";
                  } else if (gradebookSortField === "progress") {
                    const completedA = store.lessonProgress.filter((p: any) => p.enrollmentId === a.id && p.completed).length;
                    const totalA = store.lessons.filter((l: any) => l.courseId === a.courseId).length;
                    const completedB = store.lessonProgress.filter((p: any) => p.enrollmentId === b.id && p.completed).length;
                    const totalB = store.lessons.filter((l: any) => l.courseId === b.courseId).length;

                    valA = totalA ? completedA / totalA : 0;
                    valB = totalB ? completedB / totalB : 0;
                  }

                  if (typeof valA === "string" && typeof valB === "string") {
                    return gradebookSortOrder === "asc"
                      ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
                      : valB.localeCompare(valA, "vi", { sensitivity: "base" });
                  }
                  return gradebookSortOrder === "asc" ? valA - valB : valB - valA;
                });

                return (
                  <div key={course.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-bold text-slate-900 font-display">📖 {course.title}</h5>
                          <button
                            onClick={() => setCourseDetailId(course.id)}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-semibold border border-indigo-100 transition flex items-center gap-0.5 cursor-pointer font-sans"
                          >
                            Xem 👁️
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Phân loại: {course.category} · Tổng số {filteredCourseEnrollments.length} học viên</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                      <table className="w-full text-left text-xs text-slate-700 font-sans border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-mono tracking-wider font-semibold">
                          <tr>
                            <th className="p-3.5 font-semibold cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleGradebookSort("studentName")}>
                              Tên Học sinh {gradebookSortField === "studentName" ? (gradebookSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="p-3.5 font-semibold cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleGradebookSort("progress")}>
                              Tiến độ bài học {gradebookSortField === "progress" ? (gradebookSortOrder === "asc" ? "▲" : "▼") : "↕"}
                            </th>
                            <th className="p-3.5 font-semibold text-right">Tóm tắt trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedCourseEnrollments.map((enroll: any, idx: number) => {
                            const studentUser = store.users.find((u: any) => u.id === enroll.studentId);
                            const completedLessons = store.lessonProgress.filter((p: any) => p.enrollmentId === enroll.id && p.completed).length;
                            const totalLessons = store.lessons.filter((l: any) => l.courseId === enroll.courseId).length;

                            return (
                                <tr key={idx} className="hover:bg-slate-50/60 transition">
                                  <td className="p-3.5 font-medium text-slate-900">
                                    <div>{studentUser?.name || "Không xác định"}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[11px] text-slate-400 font-mono">{studentUser?.email || "Không xác định"}</span>
                                      {(() => {
                                        const sec = getEnrollmentSection(enroll);
                                        if (!sec) return null;
                                        return (
                                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono text-[9px] font-bold uppercase">
                                            Lớp: {sec.sectionCode}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                <td className="p-3.5 text-xs font-mono text-slate-600">
                                  Đã hoàn thành {completedLessons}/{totalLessons} bài học
                                </td>
                                <td className="p-3.5 text-right text-[11px] text-emerald-600 font-medium">
                                  Học viên đang hoạt động
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

              {myCourses.filter((course: any) => {
                const courseEnrollments = store.enrollments.filter((e: any) => e.courseId === course.id);
                const filteredCourseEnrollments = courseEnrollments.filter((enroll: any) => matchesGradebookSearch(course, enroll));
                return courseEnrollments.length > 0 && (filteredCourseEnrollments.length > 0 || !searchTerm);
              }).length === 0 && (
                <div className="text-center py-12 text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl text-xs">
                  {store.enrollments.filter((e: any) => myCourseIds.includes(e.courseId)).length === 0 ? "Chưa có học sinh đăng ký các khóa học này." : "Không tìm thấy học sinh nào phù hợp."}
                </div>
              )}
            </div>
          </div>
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto text-slate-900">
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
