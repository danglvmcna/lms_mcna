import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus } from "lucide-react";

interface ComponentProps {
  [key: string]: any;
}

export default function TeacherAnalytics(props: ComponentProps) {
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

  return (
    <>
        {/* Tab 5: Analytics metrics */}
        {activeSubTab === "analytics" && (
          <div className="space-y-6">
            <div><h4 className="text-xl font-semibold text-slate-900">Báo cáo hiệu suất</h4><p className="mt-1 text-sm text-slate-500">Tình hình ghi danh và đánh giá theo khóa học.</p></div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {myCourses.map(course => {
                const enrolledEnroll = store.enrollments.filter(e => e.courseId === course.id);
                const averageScoreRaw = store.quizAttempts.filter(qa => {
                  const quiz = store.quizzes.find(q => q.id === qa.quizId);
                  return quiz?.courseId === course.id;
                });
                const totalAvgQuiz = averageScoreRaw.reduce((sum, qa) => sum + qa.score, 0) / (averageScoreRaw.length || 1);

                return (
                  <div key={course.id} className="bg-white border border-slate-200 p-5 rounded-xl">
                    <h5 className="font-semibold text-slate-900 text-base leading-snug min-h-12">{course.title}</h5>

                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center gap-3 text-sm">
                        <span className="text-slate-500">Lượt đăng ký học</span>
                        <span className="font-mono text-slate-800 font-semibold">{enrolledEnroll.length} học viên</span>
                      </div>
                      <div className="flex justify-between items-center gap-3 text-sm">
                        <span className="text-slate-500">Điểm kiểm tra trung bình</span>
                        <span className="font-medium text-slate-800">{averageScoreRaw.length ? `${Math.round(totalAvgQuiz)}%` : "Chưa có"}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3 text-sm">
                        <span className="text-slate-500">Trạng thái khóa học</span>
                        <span className={`uppercase font-mono text-[10px] py-0.5 px-2.5 rounded-full font-bold ${
                          course.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : course.status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : course.status === "rejected"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {course.status === "published" ? "Đang mở" : course.status === "pending" ? "Chưa xuất bản" : course.status === "rejected" ? "Bị trả về" : "Bản nháp"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {myCourses.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-400 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs font-medium">
                  Chưa có dữ liệu thống kê. Vui lòng khởi tạo chương trình đào tạo của bạn trước.
                </div>
              )}
            </div>
          </div>
        )}
    </>
  );
}
