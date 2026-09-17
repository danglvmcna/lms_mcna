import React from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert, Users, MapPin, Video, ExternalLink, MessageSquare, Folder, FolderOpen } from "lucide-react";
import { AppStore } from "../../store";
import ForumDiscussion from "../ForumDiscussion";
import SessionMaterialsList from "../SessionMaterialsList";
import LinkedText from "../LinkedText";

interface ComponentProps {
  [key: string]: any;
}

export default function MyLearningWorkspace(props: ComponentProps) {
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

  // Local state for active assignment detail and accordion sessions
  const [activeAssignmentId, setActiveAssignmentId] = React.useState<string | null>(null);
  const [activePresentationSessionNumber, setActivePresentationSessionNumber] = React.useState<number | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<"study" | "discussion">("study");
  const [myClassSearch, setMyClassSearch] = React.useState("");
  const [showSectionDetailModal, setShowSectionDetailModal] = React.useState(false);

  // Reset local states when user exits or enters a different course
  React.useEffect(() => {
    setActiveAssignmentId(null);
    setActivePresentationSessionNumber(null);
    setActiveWorkspaceTab("study");
  }, [learningCourseId]);

  const activeLearningSectionId = ((store.courseRegistrations || []).find((registration: any) => {
    if (registration.studentId !== currentUser.id || registration.status !== "registered") return false;
    return (store.courseSections || []).some((section: any) => section.id === registration.sectionId && section.courseId === learningCourseId);
  }) || {}).sectionId || null;

  // Construct structured study sessions by grouping lessons and assignments dynamically
  const getCourseSessions = () => {
    const courseLessons = currentLearningLessons || [];
    const courseAssignments = store.assignments.filter((a: any) => a.courseId === learningCourseId) || [];
    const courseQuizzes = store.quizzes.filter((q: any) => q.courseId === learningCourseId) || [];
    const activeSection = (store.courseSections || []).find((section: any) => section.id === activeLearningSectionId);
    const courseSessionsData = store.attendanceSessions
      .filter((s: any) => s.courseId === learningCourseId && (!activeLearningSectionId || s.sectionId === activeLearningSectionId))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const numSessions = Math.max(courseLessons.length, courseSessionsData.length, 1);
    return Array.from({ length: numSessions }, (_, idx) => {
      const sessionNum = idx + 1;
      // Lesson index matches the session index
      const lessonsInSession = courseLessons.filter((_, lIdx) => lIdx === idx);
      const attendanceSession = courseSessionsData[idx];
      
      // Distribute assignments cleanly based on sessionId or fallback to lessonId
      const assignmentsInSession = courseAssignments.filter((assign) => {
        if (assign.sessionId) {
          return attendanceSession && attendanceSession.id === assign.sessionId;
        }
        if (assign.lessonId) {
          return lessonsInSession.some(l => l.id === assign.lessonId);
        }
        return false;
      });
      const quizzesInSession = courseQuizzes.filter((quiz: any) => {
        if (quiz.sessionId) {
          return attendanceSession && attendanceSession.id === quiz.sessionId;
        }
        if (quiz.lessonId) {
          return lessonsInSession.some(l => l.id === quiz.lessonId);
        }
        return false;
      });
      
      return {
        number: sessionNum,
        sessionId: attendanceSession?.id,
        materials: attendanceSession
          ? (store.sessionMaterials || []).filter((material: any) => material.sessionId === attendanceSession.id)
          : [],
        title: `Buổi học ${sessionNum}`,
        date: attendanceSession?.date,
        topic: attendanceSession?.topic,
        content: attendanceSession?.content,
        videoUrl: attendanceSession?.videoUrl || lessonsInSession.find((lesson: any) => lesson.videoUrl)?.videoUrl,
        recordingUrl: attendanceSession?.recordingUrl,
        lessons: lessonsInSession,
        assignments: assignmentsInSession,
        quizzes: quizzesInSession
      };
    });
  };

  const courseSessions = learningCourseId ? getCourseSessions() : [];
  const activePresentationSession = courseSessions.find((session) => {
    if (activePresentationSessionNumber && session.number === activePresentationSessionNumber) return true;
    if (activeLessonId && session.lessons.some((lesson: any) => lesson.id === activeLessonId)) return true;
    if (activeAssignmentId && session.assignments.some((assignment: any) => assignment.id === activeAssignmentId)) return true;
    return false;
  }) || null;
  // Recording links (Zoom cloud, Drive, YouTube) are web pages, not media files, so they get their own button instead of the <video> stage.
  const activeLessonVideoUrl = currentLessonContentObj?.videoUrl || activePresentationSession?.videoUrl || "";
  const activeLessonVideoTitle = currentLessonContentObj?.title || activePresentationSession?.topic || activePresentationSession?.title || "Video bài giảng";
  const renderPresentationSessionInfo = (session: any) => session ? (
    <div className="relative z-10 bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-widest">Thông tin buổi học</span>
          <h5 className="text-base md:text-lg font-display font-bold text-slate-900 leading-tight">
            {session.title}{session.topic ? ` - ${session.topic}` : ""}
          </h5>
        </div>
        {session.date && (
          <span className="shrink-0 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
            {new Date(session.date).toLocaleString("vi-VN")}
          </span>
        )}
      </div>
      {session.content && (
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
          {session.content}
        </p>
      )}
      {session.materials?.length > 0 && <SessionMaterialsList materials={session.materials} />}
    </div>
  ) : null;
  const renderVideoStage = (videoUrl: string, title: string) => (
    <div className="bg-slate-950 border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative">
      <div className="aspect-video w-full bg-slate-950 flex items-center justify-center">
        <video
          controls
          src={videoUrl}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 md:px-5 py-3 bg-white border-t border-slate-200">
        <span className="text-xs md:text-sm font-semibold text-slate-800 truncate">{title}</span>
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-mono font-semibold text-indigo-600 hover:text-indigo-700 transition shrink-0"
        >
          Mở video trong tab mới ↗
        </a>
      </div>
    </div>
  );

  const renderFolderView = (session: any) => {
    if (!session) return null;
    const itemCount = (session.materials?.length || 0) + (session.lessons?.length || 0) + (session.assignments?.length || 0);

    return (
      <div className="space-y-4">
        {/* Folder Breadcrumb Navigation */}
        <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => {
              setActivePresentationSessionNumber(null);
              setActiveLessonId(null);
              setActiveAssignmentId(null);
            }}
            className="hover:text-indigo-700 flex items-center gap-1.5 font-semibold transition cursor-pointer text-slate-600"
          >
            <Folder className="h-4 w-4 text-amber-500" /> Tổng quan khóa học
          </button>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900 font-bold flex items-center gap-1.5 truncate">
            <FolderOpen className="h-4 w-4 text-amber-500" /> {session.title}{session.topic ? `: ${session.topic}` : ""}
          </span>
        </div>

        {/* Main Folder Banner Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-sm relative overflow-hidden">

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <FolderOpen className="h-7 w-7" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    THƯ MỤC BUỔI HỌC
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {itemCount} mục
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 leading-tight">
                  {session.title}{session.topic ? ` - ${session.topic}` : ""}
                </h3>
              </div>
            </div>

            {session.date && (
              <span className="shrink-0 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                ⏰ {new Date(session.date).toLocaleString("vi-VN")}
              </span>
            )}
          </div>

          {/* Folder Description */}
          {session.content && (
            <div className="bg-slate-50 p-4 md:p-5 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line">
              <LinkedText text={session.content} />
            </div>
          )}

          {/* Video Recording Link */}
          {session.recordingUrl && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-800">
                <Video className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Video Recording buổi học đã có sẵn để xem lại.</span>
              </div>
              <a
                href={session.recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
              >
                Xem Video Recording ↗
              </a>
            </div>
          )}

          {/* Direct Video Player */}
          {session.videoUrl && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-indigo-700 uppercase tracking-widest block">
                VIDEO BÀI GIẢNG TRỰC TIẾP
              </span>
              {renderVideoStage(session.videoUrl, session.topic || session.title)}
            </div>
          )}
        </div>

        {/* SECTION 1: MATERIALS & SLIDES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-indigo-600" />
              Tài liệu & Slide bài giảng ({session.materials.length})
            </h4>
            <span className="text-[11px] text-slate-500">Xem trực tiếp PDF hoặc tải về máy</span>
          </div>

          {session.materials.length > 0 ? (
            <SessionMaterialsList materials={session.materials} />
          ) : (
            <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              Thư mục này hiện chưa có file tài liệu hoặc slide đính kèm.
            </div>
          )}
        </div>

        {/* SECTION 2: THEORY LESSONS */}
        {session.lessons.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-indigo-600" />
                Bài học lý thuyết ({session.lessons.length})
              </h4>
              <span className="text-[11px] text-slate-500">Chọn bài học để đọc nội dung</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {session.lessons.map((les: any, idx: number) => {
                const progress = store.lessonProgress.find(
                  (p: any) => p.enrollmentId === activeLearningEnrollment?.id && p.lessonId === les.id
                );
                const isCompleted = progress?.completed ?? false;

                return (
                  <div
                    key={les.id}
                    onClick={() => {
                      setActivePresentationSessionNumber(session.number);
                      setActiveLessonId(les.id);
                      setActiveAssignmentId(null);
                    }}
                    className="p-4 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 flex items-start justify-between gap-3 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeLearningEnrollment) {
                            handleToggleLessonComplete(activeLearningEnrollment.id, les.id);
                          }
                        }}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer mt-0.5 ${
                          isCompleted
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 hover:border-indigo-400 bg-white"
                        }`}
                      >
                        {isCompleted && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </button>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[9px] font-mono text-indigo-700 font-bold uppercase block">Bài {idx + 1}</span>
                        <h5 className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors leading-snug line-clamp-2">
                          {les.title}
                        </h5>
                        <span className="text-[10px] text-slate-500 font-mono block">Thời lượng: {les.duration}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: ASSIGNMENTS */}
        {session.assignments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-indigo-600" />
                Bài tập tự luận ({session.assignments.length})
              </h4>
              <span className="text-[11px] text-slate-500">Chọn bài tập để xem đề và nộp bài</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {session.assignments.map((assign: any) => {
                const sub = store.submissions.find((s: any) => s.assignmentId === assign.id && s.studentId === currentUser.id);
                let statusBg = "bg-slate-100 text-slate-600 border-slate-200";
                let statusText = "Chưa nộp";
                if (sub) {
                  if (typeof sub.score === "number") {
                    statusBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    statusText = `Đã chấm (${sub.score}/${assign.maxScore} đ)`;
                  } else {
                    statusBg = "bg-amber-50 text-amber-700 border-amber-200";
                    statusText = "Chờ chấm";
                  }
                }

                return (
                  <div
                    key={assign.id}
                    onClick={() => {
                      setActivePresentationSessionNumber(session.number);
                      setActiveAssignmentId(assign.id);
                      setActiveLessonId(null);
                    }}
                    className="p-4 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 flex items-start justify-between gap-3 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {assign.type && assign.type !== "lesson" && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            assign.type === "final" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            assign.type === "midterm" ? "bg-rose-50 text-rose-700 border-rose-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {assign.type === "final" ? "Cuối kỳ" : assign.type === "midterm" ? "Giữa kỳ" : "Cuối chương"}
                          </span>
                        )}
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold ${statusBg}`}>
                          {statusText}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors leading-snug line-clamp-2">
                        {assign.title}
                      </h5>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Hạn nộp: {new Date(assign.deadline).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAllFoldersGrid = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h4 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <Folder className="h-5 w-5 text-indigo-600" />
            Tổng quan chương trình
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            {courseSessions.length} buổi học · Chọn một buổi để xem nội dung, tài liệu và bài tập.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courseSessions.map((session) => {
          const itemCount = session.materials.length + session.lessons.length + session.assignments.length;

          return (
            <div
              key={session.number}
              onClick={() => {
                setActivePresentationSessionNumber(session.number);
                setActiveLessonId(null);
                setActiveAssignmentId(null);
              }}
              className="group bg-white border border-slate-200 hover:border-indigo-300 p-5 rounded-xl transition-colors duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition">
                    <Folder className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {itemCount} mục
                  </span>
                </div>

                <div className="space-y-1">
                  <h5 className="font-display font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-700 transition-colors">
                    {session.title}{session.topic ? ` - ${session.topic}` : ""}
                  </h5>
                  {session.content && (
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                      {session.content}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono pt-1">
                  {session.materials.length > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      📄 {session.materials.length} tài liệu
                    </span>
                  )}
                  {session.lessons.length > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold">
                      📖 {session.lessons.length} bài học
                    </span>
                  )}
                  {session.assignments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
                      📝 {session.assignments.length} bài tập
                    </span>
                  )}
                  {session.videoUrl && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      🎥 Video
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  {session.date ? `⏰ ${new Date(session.date).toLocaleDateString("vi-VN")}` : "⏳ Chờ xếp lịch"}
                </span>
                <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Xem buổi học <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Qualification Final Exam Banner if completed */}
      {activeLearningEnrollment && (() => {
        const checkQuiz = store.quizzes.find(q => q.courseId === learningCourseId);
        const isAllSessionsRead = currentLearningLessons.length > 0 && store.lessonProgress.filter(
          p => p.enrollmentId === activeLearningEnrollment.id && p.completed
        ).length === currentLearningLessons.length;

        if (checkQuiz && isAllSessionsRead) {
          const isQuizDeadlineExpired = checkQuiz.deadline ? new Date(checkQuiz.deadline).getTime() < Date.now() : false;

          return (
            <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-md border border-emerald-300/40 inline-block">
                  ĐÁNH GIÁ CUỐI KHÓA HỌC
                </span>
                <h5 className="text-base sm:text-lg font-bold text-slate-950">Chúc mừng! Bạn đã hoàn thành toàn bộ bài học lý thuyết.</h5>
                <p className="text-xs text-slate-600">
                  {checkQuiz.deadline
                    ? `Hạn chót làm bài kiểm tra: ${new Date(checkQuiz.deadline).toLocaleDateString("vi-VN")}`
                    : "Bạn có thể bắt đầu bài kiểm tra đánh giá để nhận chứng chỉ."}
                </p>
              </div>
              {isQuizDeadlineExpired ? (
                <button
                  disabled
                  className="px-5 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-not-allowed shrink-0"
                >
                  <BadgeAlert className="h-4 w-4" /> Đã quá hạn làm bài thi ({new Date(checkQuiz.deadline).toLocaleDateString("vi-VN")})
                </button>
              ) : (
                <button
                  onClick={() => handleStartQuiz(checkQuiz)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 shrink-0"
                >
                  <Award className="h-4.5 w-4.5" /> Bắt đầu bài Đánh giá Cuối khóa
                </button>
              )}
            </div>
          );
        }
        return null;
      })()}
    </div>
  );

  const getEnrollmentSection = (enroll: any) => {
    const registration = (store.courseRegistrations || []).find((r: any) => {
      if (r.studentId !== currentUser.id || ["dropped", "waitlisted", "withdrawn"].includes(r.status)) return false;
      const sec = (store.courseSections || []).find((s: any) => s.id === r.sectionId);
      return sec && sec.courseId === enroll.courseId;
    });
    return (store.courseSections || []).find((section: any) => section.id === registration?.sectionId);
  };

  const hasWorkspaceAccess = (enroll: any, section: any) => {
    if (!enroll) return false;
    if (enroll.status !== "active" && enroll.status !== "completed") {
      return false;
    }
    if (!section) return false;
    const registration = (store.courseRegistrations || []).find(
      r => r.studentId === currentUser.id && r.sectionId === section.id
    );
    if (!registration || registration.status !== "registered") {
      return false;
    }
    return true;
  };
  const filteredMyEnrollments = myEnrollments.filter((enroll: any) => {
    const query = myClassSearch.trim().toLowerCase();
    if (!query) return true;
    const course = store.courses.find((c: any) => c.id === enroll.courseId);
    const section = getEnrollmentSection(enroll);
    return [course?.title, course?.category, enroll.status, section?.sectionCode]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  });

  return (
    <>
        {/* Tab 2: Registered Courses checklist (My Learning) */}
        {activeSubTab === "learning" && !learningCourseId && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-bold text-slate-900">Khóa học Đào tạo của tôi</h4>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={myClassSearch}
                onChange={(event) => setMyClassSearch(event.target.value)}
                placeholder="Tìm lớp học theo tên môn, mã lớp, trạng thái..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMyEnrollments.map(enroll => {
                const course = store.courses.find(c => c.id === enroll.courseId);
                if (!course) return null;
                const section = getEnrollmentSection(enroll);
                const totalLessonsCount = store.lessons.filter(l => l.courseId === course.id).length;
                const completedProgress = store.lessonProgress.filter(p => p.enrollmentId === enroll.id && p.completed).length;
                const percentage = totalLessonsCount ? Math.round((completedProgress / totalLessonsCount) * 100) : 0;
                const workspaceReady = hasWorkspaceAccess(enroll, section);
                const nextSession = (store.attendanceSessions || [])
                  .filter((session: any) => session.courseId === course.id && (!section || session.sectionId === section.id) && session.date && new Date(session.date).getTime() >= Date.now())
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

                return (
                  <div key={enroll.id} className="bg-white border border-slate-200/90 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md rounded-2xl flex flex-col justify-between transition-all duration-200 shadow-xs group overflow-hidden">
                    {course.thumbnail ? (
                      <div className="h-36 w-full overflow-hidden border-b border-slate-100">
                        <img src={course.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      </div>
                    ) : (
                      <div className="h-24 w-full bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center border-b border-slate-100">
                        <BookOpen className="h-8 w-8 text-indigo-400" />
                      </div>
                    )}
                    <div className="p-6 flex flex-col justify-between flex-1">
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-indigo-700 uppercase bg-indigo-50 py-1 px-2.5 rounded-full border border-indigo-100 font-bold">
                            {course.category}
                          </span>
                          {section && (
                            <span className="text-[10px] font-mono text-slate-700 uppercase bg-slate-100 py-1 px-2.5 rounded-full border border-slate-200 font-bold">
                              {section.sectionCode}
                            </span>
                          )}
                        </div>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-mono font-bold border ${
                          enroll.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          enroll.status === "pending" ? "bg-violet-50 text-violet-700 border-violet-200" :
                          enroll.status === "pending_payment" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {enroll.status === "pending" ? "Chờ xếp lớp" : enroll.status === "pending_payment" ? "Chờ xác nhận thanh toán" : enroll.status === "active" ? "Đang học" : "Đã hoàn thành"}
                        </span>
                      </div>

                      <h5 className="font-display font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors">{course.title}</h5>
                      
                      {section && (
                        <div className="space-y-1 text-xs pt-1 text-slate-600">
                          <div className="flex items-center gap-1.5 font-sans">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>Khai giảng: <strong className="text-emerald-700 font-semibold">{section.openingDate ? new Date(section.openingDate).toLocaleDateString("vi-VN") : "Chưa xác định"}</strong></span>
                          </div>
                          <div className="flex items-start gap-1.5 font-sans">
                            <Clock className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                            <span className="leading-tight">
                              Lịch học: <strong>{section.schedule.map((slot: any) => `${slot.dayOfWeek} (${slot.startTime}-${slot.endTime})`).join(", ")}</strong>
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Interactive Progress Tracking */}
                      {enroll.status !== "pending_payment" && enroll.status !== "pending" && (
                        <div className="space-y-2 pt-2">
                          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                            <span>Tiến độ học tập</span>
                            <span>{completedProgress}/{totalLessonsCount} bài đã đạt ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {workspaceReady && section && (nextSession || section.meetingUrl) && (
                        <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-800">Buổi học tiếp theo</span>
                              <p className="mt-0.5 text-xs font-bold text-slate-900 line-clamp-1">{nextSession?.topic || nextSession?.content || "Lớp học trực tuyến MCNA"}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {nextSession?.date ? new Date(nextSession.date).toLocaleString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Thời gian theo lịch lớp đã công bố"}
                              </p>
                            </div>
                            <Calendar className="h-5 w-5 text-cyan-600 shrink-0" />
                          </div>
                          {section.meetingUrl && (
                            <a
                              href={section.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-xs transition hover:bg-emerald-700"
                            >
                              <Video className="h-3.5 w-3.5" /> Vào phòng Zoom / Google Meet <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {enroll.status === "pending_payment" && (
                        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-[11px] text-amber-800 leading-relaxed font-sans">
                          Giao dịch học phí đang chờ bên xử lý thanh toán xác nhận. Bạn sẽ nhận được thông báo ngay khi trạng thái được cập nhật.
                        </div>
                      )}
                      {enroll.status === "pending" && (
                        <div className="bg-violet-50 border border-violet-200 p-3.5 rounded-xl text-[11px] text-violet-800 leading-relaxed font-sans">
                          Yêu cầu đăng ký đã được ghi nhận và đang chờ quản lý xếp lớp học phần.
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-5 flex justify-between items-center text-xs">
                      {enroll.status === "pending_payment" ? (
                        <>
                          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-amber-800">Chờ xác nhận thanh toán</span>
                          <button
                            onClick={() => {
                              const foundTx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === course.id);
                              if (foundTx) setPaymentGuideTx(foundTx);
                            }}
                            className="p-1.5 px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 rounded-xl transition cursor-pointer text-[10px] shadow-xs"
                          >
                            Hướng dẫn thanh toán
                          </button>
                        </>
                      ) : (enroll.status === "pending" || !workspaceReady) ? (
                        <>
                          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-violet-700">Chờ xếp lớp</span>
                          <span className="text-[10px] text-slate-400">Chờ xác nhận xếp lớp bởi admin</span>
                        </>
                      ) : (
                        <>
                          <span></span>
                          <button
                            onClick={() => { setLearningCourseId(course.id); setActiveLessonId(null); }}
                            className="p-2 px-4.5 bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            Vào lớp học <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })}

              {filteredMyEnrollments.length === 0 && (
                <div className="col-span-full text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                  {myEnrollments.length === 0 ? "Bạn chưa đăng ký lớp học nào." : "Không tìm thấy lớp học phù hợp với từ khóa."}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 Detail: Active Classroom interactive study desk */}
        {activeSubTab === "learning" && learningCourseId && currentLearningCourse && (() => {
          const enroll = myEnrollments.find(e => e.courseId === learningCourseId);
          const section = enroll ? getEnrollmentSection(enroll) : null;
          const isAccessGranted = enroll && hasWorkspaceAccess(enroll, section);
          if (!isAccessGranted) {
            return (
              <div className="py-16 px-6 text-center bg-white border border-slate-200/80 rounded-2xl max-w-xl mx-auto space-y-5 font-sans mt-10 shadow-xs">
                <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-2xs">
                  🔒
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Không có quyền truy cập lớp học</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  Bạn chưa thanh toán học phí hoặc chưa được quản lý lớp xác nhận xếp lớp vào học phần này. Vui lòng hoàn tất thủ tục hoặc liên hệ quản trị viên để được hỗ trợ xếp lớp học phần.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setLearningCourseId(null)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition text-xs cursor-pointer shadow-xs font-sans"
                  >
                    Quay lại danh sách khóa học
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-5">
            <div className="bg-white border-b border-slate-200 pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
                <button 
                  onClick={() => setLearningCourseId(null)}
                  className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl cursor-pointer transition shrink-0 w-full sm:w-auto"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  <span>Quay lại danh sách</span>
                </button>
                <div className="h-10 w-px bg-slate-200 hidden sm:block shrink-0" />
                <div className="min-w-0 flex-1 flex items-center gap-3.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-mono font-bold text-indigo-700 uppercase tracking-widest block">LỚP HỌC TRỰC TUYẾN</span>
                     <div className="space-y-2 mt-0.5 min-w-0">
                       <h4 className="text-xl md:text-2xl font-display font-bold text-slate-900 leading-tight break-words line-clamp-2 min-w-0">
                        {currentLearningCourse.title}
                      </h4>
                    {(() => {
                      const section = (store.courseSections || []).find(s => s.id === activeLearningSectionId);
                      if (!section) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setShowSectionDetailModal(true)}
                            className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 hover:text-indigo-800 text-[10.5px] font-mono font-bold rounded-lg border border-indigo-500/20 flex items-center gap-1 transition cursor-pointer w-fit shrink-0"
                          >
                            <Calendar className="h-3.5 w-3.5" /> Chi tiết lớp {section.sectionCode}
                          </button>
                          {section.meetingUrl && (
                            <a
                              href={section.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 hover:text-emerald-800 text-[10.5px] font-mono font-bold rounded-lg border border-emerald-500/20 flex items-center gap-1 transition cursor-pointer w-fit shrink-0"
                              title="Vào phòng học trực tuyến Zoom / Google Meet"
                            >
                              <Video className="h-3.5 w-3.5 text-emerald-600" /> Vào Zoom/Meet ↗
                            </a>
                          )}
                          {section.groupChatUrl && (
                            <a
                              href={section.groupChatUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 hover:text-blue-800 text-[10.5px] font-mono font-bold rounded-lg border border-blue-500/20 flex items-center gap-1 transition cursor-pointer w-fit shrink-0"
                              title="Tham gia nhóm Zalo / Discord của lớp học"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-blue-600" /> Nhóm Zalo lớp ↗
                            </a>
                          )}
                        </div>
                      );
                     })()}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 bg-slate-100 border border-slate-200 p-1 rounded-xl gap-1 shrink-0 w-full sm:w-fit xl:self-center">
                <button
                  onClick={() => setActiveWorkspaceTab("study")}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${activeWorkspaceTab === "study" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Bài học & Bài tập
                </button>
                <button
                  onClick={() => setActiveWorkspaceTab("discussion")}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${activeWorkspaceTab === "discussion" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Thảo luận lớp học
                </button>
              </div>
            </div>

            {activeWorkspaceTab === "study" ? (
              <div className="space-y-5 min-w-0 w-full">
                
                {/* Condition 1: View Assignment detail & submission console */}
                {activeAssignmentId ? (() => {
                  const assignObj = store.assignments.find(a => a.id === activeAssignmentId);
                  if (!assignObj) return null;
                  
                  const sub = store.submissions.find(s => s.assignmentId === assignObj.id && s.studentId === currentUser.id);
                  const isDeadlineExpired = new Date(assignObj.deadline).getTime() < Date.now();

                  return (
                    <div className="space-y-4">
                      {/* Breadcrumb back to session folder */}
                      <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePresentationSessionNumber(null);
                            setActiveLessonId(null);
                            setActiveAssignmentId(null);
                          }}
                          className="hover:text-indigo-700 flex items-center gap-1.5 font-semibold transition cursor-pointer text-slate-600"
                        >
                          <Folder className="h-4 w-4 text-amber-500" /> Tổng quan khóa học
                        </button>
                        <span className="text-slate-400">/</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAssignmentId(null);
                          }}
                          className="hover:text-indigo-700 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <FolderOpen className="h-4 w-4 text-amber-500" /> {activePresentationSession?.title || "Buổi học"}
                        </button>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-900 font-bold truncate">{assignObj.title}</span>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm relative overflow-hidden">
                        {renderPresentationSessionInfo(activePresentationSession)}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-5 gap-3">
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-indigo-700 uppercase tracking-widest">BÀI TẬP TỰ LUẬN</span>
                            <h5 className="text-lg md:text-xl font-display font-bold text-slate-900 leading-tight flex items-center gap-2">
                              <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
                              {assignObj.title}
                            </h5>
                          </div>
                          <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-200 shrink-0 self-start sm:self-auto font-semibold">
                            Hạn nộp: {new Date(assignObj.deadline).toLocaleDateString("vi-VN")}
                          </span>
                        </div>

                        {isDeadlineExpired && (
                          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-2 shadow-sm">
                            <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <span className="font-bold block text-sm uppercase tracking-wide">Thời hạn nộp bài đã kết thúc</span>
                              <p className="text-slate-600">
                                Hạn chót nộp bài là <span className="text-slate-900 font-semibold">{new Date(assignObj.deadline).toLocaleDateString("vi-VN")}</span> lúc <span className="text-slate-900 font-semibold">{new Date(assignObj.deadline).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>. Bạn không thể nộp hoặc chỉnh sửa bài làm sau khi hết hạn.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest block">Yêu cầu & Hướng dẫn</span>
                          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line">
                            {assignObj.description}
                          </div>
                        </div>

                        {/* Display current submission content if already submitted */}
                        {sub && (
                          <div className="space-y-4 pt-4 border-t border-slate-200">
                            <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest block">Bài làm đã nộp của bạn</span>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-60 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                              {sub.content}
                            </div>
                            
                            {sub.score !== undefined ? (
                              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs md:text-sm text-slate-900 flex flex-col gap-2 shadow-sm">
                                <span className="font-bold flex items-center gap-2 text-emerald-700 text-sm">
                                  <CheckCircle className="h-5 w-5 shrink-0" />
                                  Trạng thái: Đã chấm | Điểm: {sub.score}/{assignObj.maxScore} đ
                                </span>
                                {sub.feedback && (
                                  <p className="text-slate-600 font-sans italic border-t border-emerald-200/60 pt-2 mt-1">
                                    Nhận xét của giảng viên: "{sub.feedback}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-medium text-amber-800 flex items-center gap-2 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                                <span>⏳ Trạng thái: Chờ chấm (Bài làm của bạn đang được giảng viên xem xét & chấm điểm)</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-200 flex justify-end">
                          {!sub ? (
                            <button
                              onClick={() => {
                                if (isDeadlineExpired) {
                                  triggerToast("Đã quá hạn nộp bài tập này!");
                                  return;
                                }
                                setSubmittingAssignmentId(assignObj.id);
                                setSubmissionCodeText("");
                              }}
                              disabled={isDeadlineExpired}
                              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer"
                            >
                              Nộp bài tập làm
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (isDeadlineExpired) {
                                  triggerToast("Đã quá hạn nộp bài tập này!");
                                  return;
                                }
                                setSubmittingAssignmentId(assignObj.id);
                                // Strip file attachment brackets if editing existing
                                const match = sub.content.match(/\[Tệp đính kèm:\s*([^\]]+)\]/);
                                if (match) {
                                  setSubmissionCodeText(sub.content.replace(/\s*\[Tệp đính kèm:[^\]]+\]/g, "").trim());
                                } else {
                                  setSubmissionCodeText(sub.content);
                                }
                              }}
                              disabled={isDeadlineExpired}
                              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                              Cập nhật bài nộp mới
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })() : currentLessonContentObj ? (
                  // Condition 2: View Lesson content (default display)
                  <div className="space-y-4">
                    {/* Breadcrumb back to session folder */}
                    <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePresentationSessionNumber(null);
                          setActiveLessonId(null);
                          setActiveAssignmentId(null);
                        }}
                        className="hover:text-indigo-700 flex items-center gap-1.5 font-semibold transition cursor-pointer text-slate-600"
                      >
                        <Folder className="h-4 w-4 text-amber-500" /> Tổng quan khóa học
                      </button>
                      <span className="text-slate-400">/</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLessonId(null);
                        }}
                        className="hover:text-indigo-700 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <FolderOpen className="h-4 w-4 text-amber-500" /> {activePresentationSession?.title || "Buổi học"}
                      </button>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-900 font-bold truncate">{currentLessonContentObj.title}</span>
                    </div>

                    {activeLessonVideoUrl && renderVideoStage(activeLessonVideoUrl, activeLessonVideoTitle)}

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm relative overflow-hidden">
                      {renderPresentationSessionInfo(activePresentationSession)}

                      <div className="space-y-3 relative z-10">
                        <span className="text-xs font-mono font-bold text-indigo-700 uppercase tracking-widest">BÀI HỌC CHI TIẾT</span>
                        <h5 className="text-xl md:text-2xl font-display font-bold text-slate-900 leading-tight">{currentLessonContentObj.title}</h5>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-b border-slate-200 pb-4">
                          <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-indigo-600" /> Học viện Công nghệ MCNA</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-600" /> Thời lượng: {currentLessonContentObj.duration}</span>
                        </div>
                      </div>

                      <div className="relative z-10 text-sm md:text-base text-slate-800 leading-relaxed font-sans max-w-none space-y-4 whitespace-pre-line bg-slate-50 p-6 rounded-xl border border-slate-200">
                        {currentLessonContentObj.content}
                      </div>
                    </div>
                  </div>
                ) : activePresentationSession ? (
                  renderFolderView(activePresentationSession)
                ) : (
                  renderAllFoldersGrid()
                )}
              </div>
            ) : (
              <div className="w-full">
                <ForumDiscussion
                  courseId={learningCourseId}
                  sectionId={activeLearningSectionId}
                  store={store}
                  currentUser={currentUser}
                  onRefreshData={onRefreshData}
                  triggerToast={triggerToast}
                />
              </div>
            )}
          </div>
          );
        })()}

      {showSectionDetailModal && (() => {
        const section = (store.courseSections || []).find(s => s.id === activeLearningSectionId);
        if (!section) return null;
        const course = store.courses.find(c => c.id === section.courseId);
        const teacher = store.users.find(u => u.id === section.teacherId);
        const registrations = (store.courseRegistrations || []).filter(r => r.sectionId === section.id && r.status === "registered");
        
        // Find classmate users
        const classmates = registrations
          .map(r => store.users.find(u => u.id === r.studentId))
          .filter(Boolean);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-900 font-sans">
              {/* Header Modal */}
              <div className="flex justify-between items-center bg-slate-50/80 px-6 py-4 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-mono font-bold rounded-lg border border-indigo-200 text-xs">
                    {section.sectionCode}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Chi tiết Lớp học phần
                  </h4>
                </div>
                <button
                  onClick={() => setShowSectionDetailModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content Modal */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-600 uppercase tracking-widest font-mono font-bold">MÔN HỌC</span>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{course?.title || "Không rõ môn học"}</h3>
                  <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {course?.description ? <LinkedText text={course.description} /> : "Không có mô tả chi tiết môn học."}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/60 border border-slate-200/80 p-4 rounded-2xl">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Giảng viên phụ trách</span>
                    <span className="font-semibold text-slate-800 text-xs block">{teacher?.name || "Chưa phân công"}</span>
                    <span className="text-slate-500 text-[10px] block font-mono">{teacher?.email || ""}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Khai giảng</span>
                    <span className="font-semibold text-slate-800 text-xs block">{section.openingDate ? new Date(section.openingDate).toLocaleDateString("vi-VN") : "Đang cập nhật"}</span>
                    <span className="text-slate-500 text-[10px] block font-mono">
                      {section.numberOfSessions ? `${section.numberOfSessions} buổi học` : ""}
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-200/60 md:border-none">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Sĩ số lớp</span>
                    <span className="font-semibold text-slate-800 text-xs block">
                      {registrations.length} / {section.maxStudents} Học viên
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-200/60 md:border-none">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Ngày khai giảng</span>
                    <span className="font-semibold text-emerald-600 text-xs block">
                      {section.openingDate ? new Date(section.openingDate).toLocaleDateString("vi-VN") : "Chưa xác định"}
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-200/60 md:border-none col-span-1 md:col-span-2">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Trạng thái lớp</span>
                    <span className={`inline-block font-semibold text-[10px] uppercase px-2.5 py-0.5 rounded-md mt-0.5 border ${
                      section.status === "open" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      section.status === "closed" ? "bg-rose-50 text-rose-700 border-rose-200" :
                      section.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {section.status === "open" ? "Đang mở đăng ký" :
                       section.status === "closed" ? "Đã khóa sĩ số" :
                       section.status === "pending" ? "Chờ duyệt" : "Đã hủy bỏ"}
                    </span>
                  </div>
                </div>

                {/* Section Online Channels (Zoom/Meet, Zalo/Discord) */}
                {(section.meetingUrl || section.groupChatUrl) && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2.5">
                    <span className="text-[10px] text-indigo-700 uppercase tracking-widest font-mono font-bold block">Kênh lớp học trực tuyến</span>
                    <div className="flex flex-wrap gap-2.5">
                      {section.meetingUrl && (
                        <a
                          href={section.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                        >
                          <Video className="h-3.5 w-3.5 text-emerald-600" /> Vào phòng Zoom/Meet
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      )}
                      {section.groupChatUrl && (
                        <a
                          href={section.groupChatUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600" /> Tham gia nhóm Zalo lớp
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Section Schedule slots */}
                <div className="space-y-2.5">
                  <span className="text-[10px] text-indigo-600 uppercase tracking-widest font-mono font-bold block">Lịch học hàng tuần</span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {section.schedule.map((slot: any, sIdx: number) => (
                      <div key={sIdx} className="bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg font-bold text-center min-w-16">
                            {slot.dayOfWeek}
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-indigo-500" /> {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="text-slate-500 text-[10.5px] flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-indigo-500" /> Phòng: {slot.room || "Trực tuyến"}
                            </span>
                          </div>
                        </div>
                        {slot.specificDate && (
                          <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                            {slot.specificDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Class Roster / Classmates list */}
                <div className="space-y-2.5">
                  <span className="text-[10px] text-indigo-600 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Bạn học cùng lớp ({classmates.length})
                  </span>
                  {classmates.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1.5 scrollbar-thin">
                      {classmates.map((student: any, sIdx: number) => (
                        <div key={sIdx} className="p-2 px-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs font-mono">
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5 truncate text-[11px]">
                            <span className="font-semibold text-slate-800 block truncate">{student.name}</span>
                            <span className="text-slate-400 block truncate font-mono text-[9.5px]">{student.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      Chưa có học viên nào đăng ký lớp học này.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Modal Actions */}
              <div className="bg-slate-50/80 px-6 py-3 border-t border-slate-200/80 flex justify-end">
                <button
                  onClick={() => setShowSectionDetailModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition text-xs shadow-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </>
  );
}
