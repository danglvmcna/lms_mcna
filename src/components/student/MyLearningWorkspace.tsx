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
  const [expandedSessions, setExpandedSessions] = React.useState<Record<number, boolean>>({ 1: true });
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<"study" | "discussion">("study");
  const [myClassSearch, setMyClassSearch] = React.useState("");
  const [showSectionDetailModal, setShowSectionDetailModal] = React.useState(false);

  // Reset local states when user exits or enters a different course
  React.useEffect(() => {
    setActiveAssignmentId(null);
    setActivePresentationSessionNumber(null);
    setExpandedSessions({ 1: true });
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
    if (activeLessonId && session.lessons.some((lesson: any) => lesson.id === activeLessonId)) return true;
    if (activeAssignmentId && session.assignments.some((assignment: any) => assignment.id === activeAssignmentId)) return true;
    if (activePresentationSessionNumber && session.number === activePresentationSessionNumber) return true;
    return false;
  }) || null;
  // Recording links (Zoom cloud, Drive, YouTube) are web pages, not media files, so they get their own button instead of the <video> stage.
  const activeLessonVideoUrl = currentLessonContentObj?.videoUrl || activePresentationSession?.videoUrl || "";
  const activeLessonVideoTitle = currentLessonContentObj?.title || activePresentationSession?.topic || activePresentationSession?.title || "Video bài giảng";
  const renderPresentationSessionInfo = (session: any) => session ? (
    <div className="relative z-10 bg-black/20 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-widest">Thông tin buổi học</span>
          <h5 className="text-lg md:text-xl font-display font-extrabold text-white leading-tight">
            {session.title}{session.topic ? ` - ${session.topic}` : ""}
          </h5>
        </div>
        {session.date && (
          <span className="shrink-0 text-[11px] font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl">
            {new Date(session.date).toLocaleString("vi-VN")}
          </span>
        )}
      </div>
      {session.content && (
        <p className="text-xs md:text-sm text-white/70 leading-relaxed whitespace-pre-line">
          {session.content}
        </p>
      )}
      {session.materials?.length > 0 && <SessionMaterialsList materials={session.materials} />}
    </div>
  ) : null;
  const renderVideoStage = (videoUrl: string, title: string) => (
    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
      <div className="aspect-video w-full bg-black flex items-center justify-center">
        <video
          controls
          src={videoUrl}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 md:px-5 py-3 bg-slate-950/95 border-t border-white/10">
        <span className="text-xs md:text-sm font-bold text-white truncate">{title}</span>
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-mono font-bold text-cyan-300 hover:text-cyan-200 transition shrink-0"
        >
          Mở video trong tab mới ↗
        </a>
      </div>
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
            <h4 className="text-base font-display font-semibold text-white">Khóa học Đào tạo của tôi</h4>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
              <input
                value={myClassSearch}
                onChange={(event) => setMyClassSearch(event.target.value)}
                placeholder="Tìm lớp học theo tên môn, mã lớp, trạng thái..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/25 border border-white/10 text-sm text-white placeholder-white/35 focus:outline-none focus:border-indigo-400"
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

                return (
                  <div key={enroll.id} className="bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 shadow-xl group">
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-[10px] font-mono text-indigo-300 uppercase bg-indigo-500/10 py-1 px-2.5 rounded-full border border-indigo-500/20 font-bold">
                          {course.category}
                        </span>
                        {section && (
                          <span className="text-[10px] font-mono text-cyan-200 uppercase bg-cyan-500/10 py-1 px-2.5 rounded-full border border-cyan-500/20 font-bold">
                            {section.sectionCode}
                          </span>
                        )}
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-mono font-bold border ${
                          enroll.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          enroll.status === "pending" ? "bg-violet-500/10 text-violet-300 border-violet-500/20 font-bold" :
                          enroll.status === "pending_payment" ? "bg-amber-500/10 text-amber-300 border-amber-500/20 font-bold" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>
                          {enroll.status === "pending" ? "Chờ xếp lớp" : enroll.status === "pending_payment" ? "Chờ xác nhận thanh toán" : enroll.status === "active" ? "Đang học" : "Đã hoàn thành"}
                        </span>
                      </div>

                      <h5 className="font-display font-bold text-white text-base leading-tight group-hover:text-indigo-200 transition-colors">{course.title}</h5>
                      
                      {section && (
                        <div className="space-y-1 text-xs pt-1">
                          <div className="text-white/60 flex items-center gap-1.5 font-sans">
                            <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Khai giảng: <strong className="text-emerald-400">{section.openingDate ? new Date(section.openingDate).toLocaleDateString("vi-VN") : "Chưa xác định"}</strong></span>
                          </div>
                          <div className="text-white/60 flex items-start gap-1.5 font-sans">
                            <Clock className="h-3.5 w-3.5 text-indigo-400 mt-0.5" />
                            <span className="leading-tight">
                              Lịch học: <strong>{section.schedule.map((slot: any) => `${slot.dayOfWeek} (${slot.startTime}-${slot.endTime})`).join(", ")}</strong>
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Interactive Progress Tracking */}
                      {enroll.status !== "pending_payment" && enroll.status !== "pending" && (
                        <div className="space-y-2 pt-2">
                          <div className="flex justify-between text-[11px] text-white/50 font-mono">
                            <span>Tiến độ học tập</span>
                            <span>{completedProgress}/{totalLessonsCount} bài đã đạt ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                            <div 
                              className="bg-indigo-500 h-full rounded-full transition-all duration-500 shadow-md shadow-indigo-500/50"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {enroll.status === "pending_payment" && (
                        <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-[11px] text-amber-300/80 leading-relaxed font-sans shadow-inner">
                          Giao dịch học phí đang chờ bên xử lý thanh toán xác nhận. Bạn sẽ nhận được thông báo ngay khi trạng thái được cập nhật.
                        </div>
                      )}
                      {enroll.status === "pending" && (
                        <div className="bg-violet-500/5 border border-violet-500/10 p-3.5 rounded-xl text-[11px] text-violet-200/80 leading-relaxed font-sans shadow-inner">
                          Yêu cầu đăng ký đã được ghi nhận và đang chờ quản lý xếp lớp học phần.
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 mt-5 flex justify-between items-center text-xs">
                      {enroll.status === "pending_payment" ? (
                        <>
                          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-amber-400/80">Chờ xác nhận thanh toán</span>
                          <button
                            onClick={() => {
                              const foundTx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === course.id);
                              if (foundTx) setPaymentGuideTx(foundTx);
                            }}
                            className="p-1.5 px-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold border border-amber-500/20 rounded-xl transition-all duration-200 cursor-pointer text-[10px]"
                          >
                            Hướng dẫn thanh toán
                          </button>
                        </>
                      ) : (enroll.status === "pending" || !hasWorkspaceAccess(enroll, section)) ? (
                        <>
                          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-violet-300/80">Chờ xếp lớp</span>
                          <span className="text-[10px] text-white/40">Chờ xác nhận xếp lớp bởi admin</span>
                        </>
                      ) : (
                        <>
                          <span></span>
                          <button
                            onClick={() => { setLearningCourseId(course.id); setActiveLessonId(null); }}
                            className="p-2 px-4.5 bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                          >
                            Vào lớp học <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredMyEnrollments.length === 0 && (
                <div className="col-span-full text-center py-16 bg-black/10 border border-dashed border-white/5 rounded-2xl text-[0] text-transparent">
                  <span className="text-xs text-white/45">
                    {myEnrollments.length === 0 ? "Bạn chưa đăng ký lớp học nào." : "Không tìm thấy lớp học phù hợp với từ khóa."}
                  </span>
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
              <div className="py-16 px-6 text-center bg-slate-900/60 border border-white/10 rounded-3xl max-w-xl mx-auto space-y-5 font-sans mt-10 shadow-2xl">
                <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner animate-pulse">
                  🔒
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Không có quyền truy cập lớp học</h3>
                <p className="text-xs text-white/50 leading-relaxed max-w-md mx-auto">
                  Bạn chưa thanh toán học phí hoặc chưa được quản lý lớp xác nhận xếp lớp vào học phần này. Vui lòng hoàn tất thủ tục hoặc liên hệ quản trị viên để được hỗ trợ xếp lớp học phần.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => setLearningCourseId(null)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-xs cursor-pointer shadow-lg font-sans"
                  >
                    Quay lại danh sách khóa học
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
                <button 
                  onClick={() => setLearningCourseId(null)}
                  className="flex items-center justify-center gap-2 p-2.5 px-4 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl cursor-pointer transition-all duration-200 shrink-0 w-full sm:w-auto"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  <span>Quay lại danh sách</span>
                </button>
                <div className="h-6 w-px bg-white/10 hidden sm:block shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-mono font-bold text-indigo-700 uppercase tracking-widest block">LỚP HỌC TRỰC TUYẾN</span>
                  <div className="flex flex-col xl:flex-row xl:items-center gap-2.5 mt-0.5 min-w-0">
                    <h4 className="text-xl font-display font-extrabold text-indigo-950 leading-tight break-words line-clamp-2 min-w-0">
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
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 bg-black/30 border border-white/10 p-1 rounded-xl gap-1 shrink-0 w-full sm:w-fit lg:self-center">
                <button
                  onClick={() => setActiveWorkspaceTab("study")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${activeWorkspaceTab === "study" ? "bg-indigo-600 text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                >
                  Bài học & Bài tập
                </button>
                <button
                  onClick={() => setActiveWorkspaceTab("discussion")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${activeWorkspaceTab === "discussion" ? "bg-indigo-600 text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                >
                  Thảo luận lớp học
                </button>
              </div>
            </div>

            {activeWorkspaceTab === "study" ? (
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 xl:gap-8 items-start">
              {/* Sidebar: grouped study sessions */}
              <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-3xl p-4 xl:p-5 space-y-4 h-fit shadow-xl">
                <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/5 pb-2.5">Nội dung học tập</span>
                
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {courseSessions.map((session) => {
                    const isExpanded = expandedSessions[session.number] ?? false;
                    // Each session reads as a folder: the badge counts what is inside it.
                    const itemCount = session.materials.length + session.lessons.length + session.assignments.length;

                    return (
                      <div key={session.number} className="border border-white/10 rounded-2xl overflow-hidden bg-black/20 shadow-md">
                        {/* Session Accordion Header Toggle */}
                        <button
                          onClick={() => {
                            setExpandedSessions(prev => ({ ...prev, [session.number]: !isExpanded }));
                            setActivePresentationSessionNumber(session.number);
                            const firstLesson = session.lessons[0];
                            if (firstLesson) {
                              setActiveLessonId(firstLesson.id);
                              setActiveAssignmentId(null);
                            } else {
                              setActiveLessonId(null);
                              setActiveAssignmentId(null);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-4 bg-gradient-to-r ${
                            isExpanded ? "from-indigo-950/40 to-indigo-900/10 border-l-4 border-indigo-500" : "from-white/5 to-white/[0.02]"
                          } hover:from-white/10 hover:to-white/5 text-xs font-bold text-white transition-all duration-300 cursor-pointer`}
                        >
                          <div className="flex flex-col text-left gap-0.5">
                            <span className="flex items-center gap-2">
                              {isExpanded
                                ? <FolderOpen className="h-4.5 w-4.5 text-amber-300 shrink-0" />
                                : <Folder className="h-4.5 w-4.5 text-amber-300/80 shrink-0" />}
                              <span className="text-[13px]">{session.title} {session.topic && `- ${session.topic}`}</span>
                              <span className="shrink-0 text-[9px] font-mono font-bold text-white/50 bg-white/10 border border-white/10 rounded-full px-1.5 py-0.5">
                                {itemCount} mục
                              </span>
                            </span>
                            {session.date ? (
                              <span className="text-[10px] text-indigo-300/80 font-mono ml-6.5">⏰ Ngày giờ: {new Date(session.date).toLocaleString()}</span>
                            ) : (
                              <span className="text-[10px] text-amber-300/80 font-mono ml-6.5 italic">⏳ Chờ phòng Đào tạo xếp lịch</span>
                            )}
                          </div>
                          <ChevronRight className={`h-4 w-4 text-white/40 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
                        </button>

                        {/* Session Content Body */}
                        {isExpanded && (
                          <div className="p-3.5 space-y-4 bg-slate-900/40 border-t border-white/5">
                            
                            {/* Topic and summary only; video is shown in the main presentation area. */}
                            {(session.topic || session.content || session.videoUrl || session.materials.length > 0) && (
                              <div className="space-y-3 bg-black/25 p-3 rounded-xl border border-white/5 text-[11px] font-sans text-left">
                                {session.topic && (
                                  <div>
                                    <span className="text-white/40 block text-[9px] uppercase font-mono font-bold">Chủ đề buổi học</span>
                                    <span className="text-white font-medium text-xs">{session.topic}</span>
                                  </div>
                                )}
                                {session.content && (
                                  <div>
                                    <span className="text-white/40 block text-[9px] uppercase font-mono font-bold">Nội dung chi tiết</span>
                                    <p className="text-white/80 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto bg-black/10 p-2 rounded-lg mt-0.5 border border-white/5">
                                      <LinkedText text={session.content} />
                                    </p>
                                  </div>
                                )}
                                {(session.videoUrl || session.materials.length > 0) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePresentationSessionNumber(session.number);
                                      const firstLesson = session.lessons[0];
                                      setActiveLessonId(firstLesson?.id || null);
                                      setActiveAssignmentId(null);
                                    }}
                                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-200 transition cursor-pointer"
                                  >
                                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[9px] uppercase tracking-widest">
                                      <Play className="h-3.5 w-3.5" /> {session.videoUrl ? "Trình chiếu video" : `Xem tài liệu (${session.materials.length})`}
                                    </span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {session.recordingUrl && (
                                  <a
                                    href={session.recordingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 transition cursor-pointer"
                                  >
                                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[9px] uppercase tracking-widest">
                                      <Video className="h-3.5 w-3.5 text-emerald-400" /> Video Recording buổi học
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Folder contents: the files, slides and links attached to this session */}
                            {session.materials.length > 0 && (
                              <div className="bg-black/25 p-3 rounded-xl border border-white/5">
                                <SessionMaterialsList materials={session.materials} />
                              </div>
                            )}

                            {/* Sub-section: Lessons of this study session */}
                            {session.lessons.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest block px-1">Bài học lý thuyết</span>
                                {session.lessons.map((les) => {
                                  const progress = store.lessonProgress.find(
                                    p => p.enrollmentId === activeLearningEnrollment?.id && p.lessonId === les.id
                                  );
                                  const isCompleted = progress?.completed ?? false;
                                  const isSelected = activeLessonId === les.id && !activeAssignmentId;

                                  return (
                                    <div 
                                      key={les.id} 
                                      className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all duration-200 cursor-pointer ${
                                        isSelected 
                                          ? "bg-indigo-600/20 border-indigo-500/40 text-white font-semibold shadow-lg shadow-indigo-500/5" 
                                          : "bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/5"
                                      }`}
                                      onClick={() => {
                                        setActivePresentationSessionNumber(session.number);
                                        setActiveLessonId(les.id);
                                        setActiveAssignmentId(null);
                                      }}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent duplicate clicking actions
                                          if (activeLearningEnrollment) {
                                            handleToggleLessonComplete(activeLearningEnrollment.id, les.id);
                                          }
                                        }}
                                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-200 flex-shrink-0 cursor-pointer mt-0.5 ${
                                          isCompleted 
                                            ? "bg-emerald-500 border-emerald-500 text-slate-900 shadow-md shadow-emerald-500/10" 
                                            : "border-white/20 hover:border-white/40 bg-white/5"
                                        }`}
                                      >
                                        {isCompleted && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                      </button>
                                      
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium leading-normal break-words">{les.title}</p>
                                        <span className="text-[9px] font-mono text-white/30 mt-1 block">{les.duration}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Sub-section: Assignments/Exercises of this study session */}
                            {session.assignments.length > 0 && (
                              <div className="space-y-2 pt-3 border-t border-white/5">
                                <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest block px-1">Bài tập tự luận</span>
                                {session.assignments.map((assign) => {
                                  const sub = store.submissions.find(s => s.assignmentId === assign.id && s.studentId === currentUser.id);
                                  const isSelected = activeAssignmentId === assign.id && !activeLessonId;

                                  // Submission status configuration
                                  let statusBg = "bg-white/5 text-white/40 border-white/5";
                                  let statusText = "Chưa nộp";
                                  if (sub) {
                                    if (typeof sub.score === "number") {
                                      statusBg = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                                      statusText = `Đã chấm (${sub.score}/${assign.maxScore} đ)`;
                                    } else {
                                      statusBg = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                                      statusText = "Chờ chấm";
                                    }
                                  }

                                  return (
                                    <div 
                                      key={assign.id} 
                                      className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-all duration-200 cursor-pointer ${
                                        isSelected 
                                          ? "bg-indigo-600/20 border-indigo-500/40 text-white font-semibold shadow-lg shadow-indigo-500/5" 
                                          : "bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/5"
                                      }`}
                                      onClick={() => {
                                        setActivePresentationSessionNumber(session.number);
                                        setActiveAssignmentId(assign.id);
                                        setActiveLessonId(null);
                                      }}
                                    >
                                      <FileText className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isSelected ? "text-indigo-400" : "text-white/30"}`} />
                                      
                                      <div className="flex-1 min-w-0 space-y-1.5 font-sans">
                                        <div>
                                          {assign.type && assign.type !== "lesson" && (
                                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border mr-1.5 ${
                                              assign.type === "final" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                              assign.type === "midterm" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                              "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                            }`}>
                                              {assign.type === "final" ? "Cuối kỳ" : assign.type === "midterm" ? "Giữa kỳ" : "Cuối chương"}
                                            </span>
                                          )}
                                          <p className="font-medium leading-normal break-words inline">{assign.title}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-0.5">
                                          <span className="text-[9px] font-mono text-white/30">Hạn: {new Date(assign.deadline).toLocaleDateString("vi-VN")}</span>
                                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold truncate shrink-0 ${statusBg}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Qualification Quiz Check trigger block */}
                {activeLearningEnrollment && (() => {
                  const checkQuiz = store.quizzes.find(q => q.courseId === learningCourseId);
                  const isAllSessionsRead = store.lessonProgress.filter(
                    p => p.enrollmentId === activeLearningEnrollment.id && p.completed
                  ).length === currentLearningLessons.length;

                  if (checkQuiz && isAllSessionsRead) {
                    const isQuizDeadlineExpired = checkQuiz.deadline ? new Date(checkQuiz.deadline).getTime() < Date.now() : false;

                    return (
                      <div className="pt-2 border-t border-white/5 mt-4 space-y-2">
                        {checkQuiz.deadline && !isQuizDeadlineExpired && (
                          <div className="text-[10px] text-white/40 text-center font-mono">
                            Hạn nộp bài thi: {new Date(checkQuiz.deadline).toLocaleDateString("vi-VN")}
                          </div>
                        )}
                        {isQuizDeadlineExpired ? (
                          <button
                            disabled
                            className="w-full py-3 bg-red-600/20 text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                          >
                            <BadgeAlert className="h-4.5 w-4.5" /> Đã quá hạn làm bài thi trắc nghiệm ({new Date(checkQuiz.deadline).toLocaleDateString("vi-VN")})
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartQuiz(checkQuiz)}
                            className="w-full py-3 bg-[#16a34a] hover:bg-opacity-95 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
                          >
                            <Award className="h-4 w-4" /> Làm bài Đánh giá Cuối khóa
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Main Workspace Content Inspector */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Condition 1: View Assignment detail & submission console */}
                {activeAssignmentId ? (() => {
                  const assignObj = store.assignments.find(a => a.id === activeAssignmentId);
                  if (!assignObj) return null;
                  
                  const sub = store.submissions.find(s => s.assignmentId === assignObj.id && s.studentId === currentUser.id);
                  const isDeadlineExpired = new Date(assignObj.deadline).getTime() < Date.now();

                  return (
                    <div className="bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                      {/* Decorative glow */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
                      {renderPresentationSessionInfo(activePresentationSession)}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-5 gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">BÀI TẬP TỰ LUẬN</span>
                          <h5 className="text-lg md:text-xl font-display font-extrabold text-white leading-tight flex items-center gap-2">
                            <FileText className="h-5.5 w-5.5 text-indigo-400 shrink-0" />
                            {assignObj.title}
                          </h5>
                        </div>
                        <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20 shrink-0 self-start sm:self-auto font-semibold">
                          Hạn nộp: {new Date(assignObj.deadline).toLocaleDateString("vi-VN")}
                        </span>
                      </div>

                      {isDeadlineExpired && (
                        <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-4 text-xs text-red-200 flex items-start gap-2 shadow-lg shadow-red-500/5 animate-pulse">
                          <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-extrabold block text-sm uppercase tracking-wide">Thời hạn nộp bài đã kết thúc</span>
                            <p className="text-white/70">
                              Hạn chót nộp bài là <span className="text-white font-semibold">{new Date(assignObj.deadline).toLocaleDateString("vi-VN")}</span> lúc <span className="text-white font-semibold">{new Date(assignObj.deadline).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>. Bạn không thể nộp hoặc chỉnh sửa bài làm sau khi hết hạn.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <span className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest block">Yêu cầu & Hướng dẫn</span>
                        <div className="bg-black/20 p-5 rounded-2xl border border-white/5 text-xs md:text-sm text-white/70 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                          {assignObj.description}
                        </div>
                      </div>

                      {/* Display current submission content if already submitted */}
                      {sub && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block">Bài làm đã nộp của bạn</span>
                          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 max-h-60 overflow-y-auto font-mono text-xs text-white/80 whitespace-pre-wrap break-words leading-relaxed">
                            {sub.content}
                          </div>
                          
                           {sub.score !== undefined ? (
                             <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs md:text-sm text-white flex flex-col gap-2 shadow-lg shadow-emerald-500/5">
                               <span className="font-bold flex items-center gap-2 text-emerald-400 text-sm">
                                 <CheckCircle className="h-5 w-5 shrink-0" />
                                 Trạng thái: Đã chấm | Điểm: {sub.score}/{assignObj.maxScore} đ
                               </span>
                               {sub.feedback && (
                                 <p className="text-white/60 font-sans italic border-t border-white/5 pt-2 mt-1">
                                   Nhận xét của giảng viên: "{sub.feedback}"
                                 </p>
                               )}
                             </div>
                           ) : (
                             <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs font-medium text-amber-300 flex items-center gap-2 shadow-lg shadow-amber-500/5">
                               <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                               <span>⏳ Trạng thái: Chờ chấm (Bài làm của bạn đang được giảng viên xem xét & chấm điểm)</span>
                             </div>
                           )}
                        </div>
                      )}

                      <div className="pt-4 border-t border-white/5 flex justify-end">
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
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 cursor-pointer"
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
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer"
                          >
                            Cập nhật bài nộp mới
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })() : currentLessonContentObj ? (
                  // Condition 2: View Lesson content (default display)
                  <>
                    {activeLessonVideoUrl && renderVideoStage(activeLessonVideoUrl, activeLessonVideoTitle)}

                    <div className="bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
                      {renderPresentationSessionInfo(activePresentationSession)}

                      <div className="space-y-3 relative z-10">
                        <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">BÀI HỌC CHI TIẾT</span>
                        <h5 className="text-xl md:text-2xl font-display font-extrabold text-white leading-tight">{currentLessonContentObj.title}</h5>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-white/40 pt-2 border-b border-white/5 pb-4">
                          <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-indigo-400" /> Học viện Công nghệ MCNA</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-400" /> Thời lượng: {currentLessonContentObj.duration}</span>
                        </div>
                      </div>

                      <div className="relative z-10 text-sm text-white/80 leading-relaxed font-sans prose prose-invert max-w-none space-y-4 whitespace-pre-line bg-black/10 p-5 rounded-2xl border border-white/5 shadow-inner">
                        {currentLessonContentObj.content}
                      </div>
                    </div>
                  </>
                ) : activePresentationSession ? (
                  <>
                    {activePresentationSession.videoUrl ? (
                      renderVideoStage(activePresentationSession.videoUrl, activePresentationSession.topic || activePresentationSession.title)
                    ) : activePresentationSession.materials.length === 0 ? (
                      <div className="text-center py-16 bg-black/10 border border-dashed border-white/10 rounded-2xl text-xs text-white/45">
                        Buổi học này chưa có video hoặc bài học chi tiết để trình chiếu.
                      </div>
                    ) : null}

                    <div className="bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
                      {renderPresentationSessionInfo(activePresentationSession)}
                    </div>
                  </>
                ) : (
                  
                  // Condition 3: Default Blank State Placeholder
                  <div className="text-center py-24 bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-center items-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
                    <BookOpen className="h-14 w-14 text-indigo-400/40 mb-4 animate-pulse" />
                    <h5 className="font-bold text-white text-base font-display">Chào mừng đến với lớp học trực tuyến!</h5>
                    <p className="text-xs text-white/50 max-w-sm mt-1.5 leading-relaxed">
                      Vui lòng nhấp chọn bất kỳ buổi học nào ở thanh bên trái, sau đó mở tài liệu bài học lý thuyết hoặc bài tập tự luận để bắt đầu quá trình nghiên cứu của bạn.
                    </p>
                  </div>
                )}
              </div>
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-white font-sans">
              {/* Header Modal */}
              <div className="flex justify-between items-center bg-white/3 px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 font-mono font-bold rounded-lg border border-indigo-500/20 text-xs">
                    {section.sectionCode}
                  </span>
                  <h4 className="font-display font-bold text-white text-sm">
                    Chi tiết Lớp học phần
                  </h4>
                </div>
                <button
                  onClick={() => setShowSectionDetailModal(false)}
                  className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content Modal */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-mono font-bold">MÔN HỌC</span>
                  <h3 className="text-lg font-bold text-white leading-snug">{course?.title || "Không rõ môn học"}</h3>
                  <p className="text-xs text-white/50 whitespace-pre-line">
                    {course?.description ? <LinkedText text={course.description} /> : "Không có mô tả chi tiết môn học."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/40 block">Giảng viên phụ trách</span>
                    <span className="font-bold text-white text-xs block">{teacher?.name || "Chưa phân công"}</span>
                    <span className="text-white/50 text-[10px] block font-mono">{teacher?.email || ""}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/40 block">Khai giảng</span>
                    <span className="font-bold text-white text-xs block">{section.openingDate ? new Date(section.openingDate).toLocaleDateString("vi-VN") : "Đang cập nhật"}</span>
                    <span className="text-white/50 text-[10px] block font-mono">
                      {section.numberOfSessions ? `${section.numberOfSessions} buổi học` : ""}
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-white/5 md:border-none">
                    <span className="text-[10px] text-white/40 block">Sĩ số lớp</span>
                    <span className="font-bold text-white text-xs block">
                      {registrations.length} / {section.maxStudents} Học viên
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-white/5 md:border-none">
                    <span className="text-[10px] text-white/40 block">Ngày khai giảng</span>
                    <span className="font-bold text-emerald-400 text-xs block">
                      {section.openingDate ? new Date(section.openingDate).toLocaleDateString("vi-VN") : "Chưa xác định"}
                    </span>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-white/5 md:border-none col-span-1 md:col-span-2">
                    <span className="text-[10px] text-white/40 block">Trạng thái lớp</span>
                    <span className={`inline-block font-bold text-[10px] uppercase px-2 py-0.5 rounded-md mt-0.5 border ${
                      section.status === "open" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                      section.status === "closed" ? "bg-red-500/10 text-red-400 border-red-500/25" :
                      section.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/25" :
                      "bg-slate-500/10 text-slate-400 border-slate-500/25"
                    }`}>
                      {section.status === "open" ? "Đang mở đăng ký" :
                       section.status === "closed" ? "Đã khóa sĩ số" :
                       section.status === "pending" ? "Chờ duyệt" : "Đã hủy bỏ"}
                    </span>
                  </div>
                </div>

                {/* Section Online Channels (Zoom/Meet, Zalo/Discord) */}
                {(section.meetingUrl || section.groupChatUrl) && (
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-2">
                    <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-mono font-bold block">Kênh lớp học trực tuyến</span>
                    <div className="flex flex-wrap gap-2.5">
                      {section.meetingUrl && (
                        <a
                          href={section.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition"
                        >
                          <Video className="h-3.5 w-3.5 text-emerald-400" /> Vào phòng Zoom/Meet
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      )}
                      {section.groupChatUrl && (
                        <a
                          href={section.groupChatUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold transition"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-blue-400" /> Tham gia nhóm Zalo lớp
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Section Schedule slots */}
                <div className="space-y-2.5">
                  <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-mono font-bold block">Lịch học hàng tuần</span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {section.schedule.map((slot: any, sIdx: number) => (
                      <div key={sIdx} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className="p-2 bg-indigo-500/10 text-indigo-300 rounded-lg font-bold text-center min-w-16">
                            {slot.dayOfWeek}
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-semibold text-white flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-indigo-400" /> {slot.startTime} - {slot.endTime}
                            </span>
                            <span className="text-white/50 text-[10.5px] flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Phòng: {slot.room || "Trực tuyến"}
                            </span>
                          </div>
                        </div>
                        {slot.specificDate && (
                          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                            {slot.specificDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Class Roster / Classmates list */}
                <div className="space-y-2.5">
                  <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Bạn học cùng lớp ({classmates.length})
                  </span>
                  {classmates.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1.5 scrollbar-thin">
                      {classmates.map((student: any, sIdx: number) => (
                        <div key={sIdx} className="p-2 px-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-500/10 rounded-full flex items-center justify-center font-bold text-xs text-indigo-300 font-mono">
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5 truncate text-[11px]">
                            <span className="font-semibold text-white block truncate">{student.name}</span>
                            <span className="text-white/40 block truncate font-mono text-[9.5px]">{student.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-black/10 border border-dashed border-white/5 rounded-xl text-xs text-white/40">
                      Chưa có học viên nào đăng ký lớp học này.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Modal Actions */}
              <div className="bg-white/3 px-6 py-3 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setShowSectionDetailModal(false)}
                  className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-xs cursor-pointer"
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
