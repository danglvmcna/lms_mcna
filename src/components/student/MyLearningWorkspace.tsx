import React from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert, Users, MapPin, Video, ExternalLink, MessageSquare, Folder, FolderOpen } from "lucide-react";
import { AppStore } from "../../store";
import { api } from "../../api";
import ForumDiscussion from "../ForumDiscussion";
import SessionMaterialsList from "../SessionMaterialsList";
import SessionHomeworkList from "./SessionHomeworkList";
import LinkedText from "../LinkedText";
import { useAppConfig } from "../../appConfig";
import { formatDateVi, formatScheduleSummary } from "../../scheduleText";
import { renderWelcomeLetter } from "../../welcomeLetter";
import LearnerSolution from "../operations/LearnerSolution";
import { ZoomLogo } from "../icons/BrandLogos";
import { extractYoutubeVideoId, youtubeEmbedUrl } from "../../utils";
import { instructorName } from "./studentDisplay";

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

  // Direct sale: a class only appears once the class manager has placed the learner in it.
  const appConfig = useAppConfig();
  const isDirectSale = appConfig.salesMode === "direct";
  const [showIntro, setShowIntro] = React.useState(false);

  // Local state for the selected course session
  const [activePresentationSessionNumber, setActivePresentationSessionNumber] = React.useState<number | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<"study" | "discussion">("study");
  const [myClassSearch, setMyClassSearch] = React.useState("");
  const [showSectionDetailModal, setShowSectionDetailModal] = React.useState(false);
  const [lessonNote, setLessonNote] = React.useState("");
  const [noteDirty, setNoteDirty] = React.useState(false);
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [openVideoUrl, setOpenVideoUrl] = React.useState<string | null>(null);
  const noteDirtyRef = React.useRef(false);

  // Reset local states when user exits or enters a different course
  React.useEffect(() => {
    setActivePresentationSessionNumber(null);
    setActiveWorkspaceTab("study");
    setOpenVideoUrl(null);
    setShowIntro(false);
  }, [learningCourseId]);

  React.useEffect(() => {
    let cancelled = false;
    setLessonNote("");
    setNoteDirty(false);
    noteDirtyRef.current = false;
    if (!activeLessonId) return () => { cancelled = true; };
    api.getLessonNote(activeLessonId)
      .then((response: any) => {
        if (!cancelled && !noteDirtyRef.current) setLessonNote(response?.note?.content || "");
      })
      .catch(() => {
        // Notes are an enhancement; an unavailable notes endpoint must not block lesson playback.
      });
    return () => { cancelled = true; };
  }, [activeLessonId]);

  React.useEffect(() => {
    if (!activeLessonId || !noteDirty) return;
    const timer = window.setTimeout(async () => {
      setNoteSaving(true);
      try {
        await api.saveLessonNote(activeLessonId, lessonNote);
        setNoteDirty(false);
        noteDirtyRef.current = false;
      } catch {
        // Keep the dirty flag so the next edit retries the save.
      } finally {
        setNoteSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeLessonId, lessonNote, noteDirty]);

  const activeLearningSectionId = ((store.courseRegistrations || []).find((registration: any) => {
    if (registration.studentId !== currentUser.id || registration.status !== "registered") return false;
    return (store.courseSections || []).some((section: any) => section.id === registration.sectionId && section.courseId === learningCourseId);
  }) || {}).sectionId || null;

  // Group lessons and materials into course sessions.
  const getCourseSessions = () => {
    const courseLessons = currentLearningLessons || [];
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
      
      return {
        number: sessionNum,
        sessionId: attendanceSession?.id,
        materials: attendanceSession
          ? (store.sessionMaterials || []).filter((material: any) => material.sessionId === attendanceSession.id)
          : [],
        assignments: attendanceSession
          ? (store.assignments || []).filter((assignment: any) => assignment.sessionId === attendanceSession.id)
          : [],
        title: `Buổi học ${sessionNum}`,
        date: attendanceSession?.date,
        topic: attendanceSession?.topic,
        content: attendanceSession?.content,
        videoUrl: attendanceSession?.videoUrl || lessonsInSession.find((lesson: any) => lesson.videoUrl)?.videoUrl,
        recordingUrl: attendanceSession?.recordingUrl,
        lessons: lessonsInSession
      };
    });
  };

  const courseSessions = learningCourseId ? getCourseSessions() : [];
  const activePresentationSession = courseSessions.find((session) => {
    if (activePresentationSessionNumber && session.number === activePresentationSessionNumber) return true;
    if (activeLessonId && session.lessons.some((lesson: any) => lesson.id === activeLessonId)) return true;
    return false;
  }) || null;
  // Recording links (Zoom cloud, Drive, YouTube) are web pages, not media files, so they get their own button instead of the <video> stage.
  const activeLessonVideoUrl = currentLessonContentObj?.videoUrl || activePresentationSession?.videoUrl || "";
  const activeLessonVideoTitle = currentLessonContentObj?.title || activePresentationSession?.topic || activePresentationSession?.title || "Video bài giảng";
  const renderPresentationSessionInfo = (session: any) => session ? (
    <div className="relative z-10 border-y border-slate-200 py-4 space-y-3">
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
      {session.materials?.length > 0 && <SessionMaterialsList materials={session.materials} sessionId={session.sessionId} />}
    </div>
  ) : null;
  const renderVideoStage = (videoUrl: string, title: string) => {
    const youtubeId = extractYoutubeVideoId(videoUrl);
    return <div className="max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2"><Video className="h-5 w-5 shrink-0 text-indigo-600" /><span className="truncate text-sm font-semibold text-slate-900">{title}</span></div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <button type="button" onClick={() => setOpenVideoUrl(current => current === videoUrl ? null : videoUrl)} className="text-indigo-700 hover:text-indigo-900">{openVideoUrl === videoUrl ? "Thu gọn" : "Xem video"}</button>
          <a href={videoUrl} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-indigo-700">Mở tab mới ↗</a>
        </div>
      </div>
      {openVideoUrl === videoUrl && <div className="aspect-video w-full bg-slate-950">{youtubeId ? <iframe src={youtubeEmbedUrl(youtubeId)} title={title} className="h-full w-full" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video controls src={videoUrl} className="h-full w-full object-contain" />}</div>}
    </div>;
  };

  const renderFolderView = (session: any) => {
    if (!session) return null;
    const currentSection = (store.courseSections || []).find((s: any) => s.id === (session.sectionId || activeLearningSectionId))
      || (store.courseSections || []).find((s: any) => s.courseId === learningCourseId);
    const zoomUrl = currentSection?.meetingUrl;
    const itemCount = (session.materials?.length || 0) + (session.lessons?.length || 0) + (session.assignments?.length || 0);
    // Slides, documents and links are read online; data files are the ones learners may download.
    const readingMaterials = (session.materials || []).filter((material: any) => material.type !== "data");
    const dataMaterials = (session.materials || []).filter((material: any) => material.type === "data");

    return (
      <div className="space-y-4">
        {/* Folder Breadcrumb Navigation */}
        <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => {
              setActivePresentationSessionNumber(null);
              setActiveLessonId(null);
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
        <div className="space-y-5">

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">{itemCount} mục học tập</span>
                </div>
                <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 leading-tight">
                  {session.title}{session.topic ? ` - ${session.topic}` : ""}
                </h3>
              </div>
            </div>

            {session.date && (
              <span className="shrink-0 text-sm text-slate-600 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                {new Date(session.date).toLocaleString("vi-VN")}
              </span>
            )}
          </div>

          {/* Folder Description */}
          {session.content && (
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              <LinkedText text={session.content} />
            </div>
          )}

          {/* Zoom Meeting Link - Ngay dưới mô tả buổi học */}
          {zoomUrl && <div className="p-4 bg-blue-50/70 border-l-2 border-blue-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
                <ZoomLogo className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-bold text-slate-900 truncate">
                  Phòng học Zoom trực tuyến của buổi học
                </span>
                <span className="text-sm text-blue-700">
                  Liên kết phòng học của lớp
                </span>
              </div>
            </div>
            <a
              href={zoomUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-[#0B5CFF] hover:bg-[#004BE5] text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ZoomLogo className="h-4 w-4" />
              Vào phòng Zoom ngay ↗
            </a>
          </div>}

          {/* Video Recording Link */}
          {session.recordingUrl && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-indigo-900">
                <Video className="h-5 w-5 text-indigo-600 shrink-0" />
                <span>Video Recording buổi học đã có sẵn để xem lại.</span>
              </div>
              <a
                href={session.recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
              >
                Xem Video Recording <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {/* Direct Video Player */}
          {session.videoUrl && (
            <div className="space-y-2">
              <span className="text-sm font-semibold text-slate-900 block">
                Video bài giảng
              </span>
              {renderVideoStage(session.videoUrl, session.topic || session.title)}
            </div>
          )}
        </div>

        {/* SECTION 1: MATERIALS & SLIDES (read online only) */}
        <div className="border-t border-slate-200 pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-indigo-600" />
              Tài liệu & slide bài giảng ({readingMaterials.length})
            </h4>
            <span className="text-[11px] text-slate-500">Xem trực tuyến trên LMS, không tải về</span>
          </div>

          {readingMaterials.length > 0 ? (
            <SessionMaterialsList materials={readingMaterials} />
          ) : (
            <p className="py-2 text-sm text-slate-500">Buổi học này chưa có slide hay tài liệu.</p>
          )}
        </div>

        {/* SECTION 2: DATA FILES (downloadable) */}
        <div className="border-t border-slate-200 pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-600" />
              File data thực hành ({dataMaterials.length})
            </h4>
            <span className="text-[11px] text-slate-500">Tải về máy để thực hành</span>
          </div>

          {dataMaterials.length > 0 ? (
            <SessionMaterialsList materials={dataMaterials} sessionId={session.sessionId} />
          ) : (
            <p className="py-2 text-sm text-slate-500">Buổi học này chưa có file data.</p>
          )}
        </div>

        {/* SECTION 3: HOMEWORK */}
        <div className="border-t border-slate-200 pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="h-4.5 w-4.5 text-indigo-600" />
              Bài tập về nhà ({session.assignments.length})
            </h4>
          </div>
          <SessionHomeworkList
            assignments={session.assignments}
            submissions={(store.submissions || []).filter((submission: any) => submission.studentId === currentUser.id)}
            allowDownload={appConfig.allowHomeworkDownload}
            onChanged={onRefreshData}
          />
          {session.sessionId && <LearnerSolution key={session.sessionId} sessionId={session.sessionId} allowDownload={appConfig.allowHomeworkDownload}/>}
        </div>

        {/* SECTION 2: THEORY LESSONS */}
        {session.lessons.length > 0 && (
          <div className="border-t border-slate-200 pt-5 space-y-4">
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
                    className="p-4 rounded-lg bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 flex items-start gap-3 transition-colors group"
                  >
                      <button
                        type="button"
                        aria-label={isCompleted ? `Đánh dấu chưa hoàn thành ${les.title}` : `Đánh dấu hoàn thành ${les.title}`}
                        onClick={() => {
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
                      <button type="button" onClick={() => { setActivePresentationSessionNumber(session.number); setActiveLessonId(les.id); }} className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left">
                        <span className="space-y-1 min-w-0">
                        <span className="text-[9px] font-mono text-indigo-700 font-bold uppercase block">Bài {idx + 1}</span>
                        <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors leading-snug line-clamp-2 block">
                          {les.title}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">Thời lượng: {les.duration}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition shrink-0 mt-1" />
                      </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    );
  };

  const renderIntro = () => {
    const course = currentLearningCourse;
    const section = (store.courseSections || []).find((s: any) => s.id === activeLearningSectionId);
    if (!course || !section) return null;
    const teacher = store.users.find((u: any) => u.id === section.teacherId);
    const introMaterials = (store.sessionMaterials || []).filter((material: any) => !material.sessionId && material.courseId === course.id);
    const references = introMaterials.filter((material: any) => material.category === "reference");
    const practice = introMaterials.filter((material: any) => material.category === "practice");
    const letter = renderWelcomeLetter(course.welcomeLetter, {
      studentName: currentUser.name,
      courseTitle: course.title,
      sectionCode: section.sectionCode,
      teacherName: instructorName(teacher),
      openingDate: formatDateVi(section.openingDate),
      schedule: formatScheduleSummary(section.schedule),
      supportPhone: appConfig.supportPhone
    });

    return (
      <section className="rounded-xl border border-indigo-200 bg-indigo-50/40">
        <button
          type="button"
          onClick={() => setShowIntro(current => !current)}
          aria-expanded={showIntro}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 border border-indigo-200"><Bookmark className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block font-display font-bold text-slate-900 text-base">Tài liệu mở đầu</span>
              <span className="block text-sm text-slate-500">Thư chúc mừng · {references.length} sách & tài liệu tham khảo · {practice.length} bài luyện tập</span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-indigo-600">{showIntro ? "Thu gọn" : "Mở xem"}</span>
        </button>

        {showIntro && (
          <div className="space-y-5 border-t border-indigo-200 px-5 py-5">
            <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800">{letter}</div>

            <div className="space-y-3">
              <h5 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-600" /> Sách & tài liệu tham khảo</h5>
              {references.length > 0 ? <SessionMaterialsList materials={references} /> : <p className="text-sm text-slate-500">Giảng viên sẽ bổ sung tài liệu tham khảo.</p>}
            </div>

            <div className="space-y-3">
              <h5 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2"><FileCheck className="h-4 w-4 text-indigo-600" /> Bài luyện tập</h5>
              {practice.length > 0 ? <SessionMaterialsList materials={practice} /> : <p className="text-sm text-slate-500">Chưa có bài luyện tập.</p>}
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderAllFoldersGrid = () => (
    <div className="space-y-5">
      {renderIntro()}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h4 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <Folder className="h-5 w-5 text-indigo-600" />
            Tổng quan chương trình
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            {courseSessions.length} buổi học · Chọn một buổi để xem slide, file data, bài tập và video xem lại.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {courseSessions.map((session) => {
          const itemCount = session.materials.length + session.lessons.length + session.assignments.length;

          return (
            <button
              type="button"
              key={session.number}
              onClick={() => {
                setActivePresentationSessionNumber(session.number);
                setActiveLessonId(null);
              }}
              className="group bg-white border border-slate-200 hover:border-indigo-300 p-5 rounded-lg transition-colors cursor-pointer flex flex-col justify-between text-left"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Folder className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-slate-500">
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

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  {session.materials.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {session.materials.length} tài liệu
                    </span>
                  )}
                  {session.lessons.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> {session.lessons.length} bài học
                    </span>
                  )}
                  {session.assignments.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileCheck className="h-3 w-3" /> {session.assignments.length} bài tập
                    </span>
                  )}
                  {session.videoUrl && (
                    <span className="inline-flex items-center gap-1">
                      <Video className="h-3 w-3" /> Video
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 font-mono">
                  {session.date ? (
                    <>
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {new Date(session.date).toLocaleDateString("vi-VN")}
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 text-slate-400" />
                      Chờ xếp lịch
                    </>
                  )}
                </span>
                <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Xem buổi học <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
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
  const listedEnrollments = isDirectSale
    ? myEnrollments.filter((enroll: any) => hasWorkspaceAccess(enroll, getEnrollmentSection(enroll)))
    : myEnrollments;
  const filteredMyEnrollments = listedEnrollments.filter((enroll: any) => {
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
            <h4 className="text-xl font-display font-bold text-slate-900">Lớp học của tôi</h4>

            {listedEnrollments.length > 0 && <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={myClassSearch}
                onChange={(event) => setMyClassSearch(event.target.value)}
                placeholder="Tìm lớp học theo tên môn, mã lớp, trạng thái..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
              />
            </div>}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredMyEnrollments.map(enroll => {
                const course = store.courses.find(c => c.id === enroll.courseId);
                if (!course) return null;
                const section = getEnrollmentSection(enroll);
                const totalLessonsCount = store.lessons.filter(l => l.courseId === course.id).length;
                const completedProgress = store.lessonProgress.filter(p => p.enrollmentId === enroll.id && p.completed).length;
                const percentage = totalLessonsCount ? Math.round((completedProgress / totalLessonsCount) * 100) : 0;
                const workspaceReady = hasWorkspaceAccess(enroll, section);
                const pendingBankTx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === course.id && t.status === "pending" && /chuyển khoản|bank|vietqr/i.test(t.paymentMethod || ""));
                const nextSession = (store.attendanceSessions || [])
                  .filter((session: any) => session.courseId === course.id && (!section || session.sectionId === section.id) && session.date && new Date(session.date).getTime() >= Date.now())
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

                return (
                  <div key={enroll.id} className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl flex flex-col justify-between transition-colors group overflow-hidden">
                    <div className="p-5 flex flex-col justify-between flex-1">
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-indigo-700 font-semibold">
                            {course.category}
                          </span>
                          {section && (
                            <span className="text-xs text-slate-500">
                              {section.sectionCode}
                            </span>
                          )}
                        </div>
                        
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                          enroll.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          enroll.status === "pending" ? "bg-violet-50 text-violet-700 border-violet-200" :
                          enroll.status === "pending_payment" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {enroll.status === "pending" ? "Chờ xếp lớp" : enroll.status === "pending_payment" ? "Chờ xác nhận thanh toán" : enroll.status === "active" ? "Đang học" : "Đã hoàn thành"}
                        </span>
                      </div>

                      <h5 className="font-display font-bold text-slate-900 text-lg leading-snug group-hover:text-indigo-600 transition-colors">{course.title}</h5>
                      
                      {section && (
                        <div className="space-y-1 text-sm pt-1 text-slate-600">
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
                          <div className="flex justify-between gap-2 text-xs text-slate-500">
                            <span>Tiến độ học tập</span>
                            <span>{completedProgress}/{totalLessonsCount} bài đã đánh dấu ({percentage}%)</span>
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
                        <div className="border-l-2 border-indigo-500 bg-indigo-50/50 p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-indigo-800">Buổi học tiếp theo</span>
                              <p className="mt-0.5 text-sm font-bold text-slate-900 line-clamp-1">{nextSession?.topic || nextSession?.content || "Lớp học trực tuyến MCNA"}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
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
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                            >
                              <Video className="h-3.5 w-3.5" /> Vào phòng Zoom / Google Meet <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {enroll.status === "pending_payment" && (
                        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-[11px] text-amber-800 leading-relaxed font-sans">
                          Giao dịch học phí đang chờ xác nhận. Bạn sẽ nhận được thông báo khi trạng thái được cập nhật.
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
                          {pendingBankTx && <button
                            onClick={() => setPaymentGuideTx(pendingBankTx)}
                            className="p-2 px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold border border-amber-200 rounded-lg transition cursor-pointer text-sm"
                          >
                            Hướng dẫn thanh toán
                          </button>}
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
                            className="p-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-sm text-white font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
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
                <div className="col-span-full text-center py-16 px-6 bg-white border border-dashed border-slate-200 rounded-2xl text-sm text-slate-500 space-y-2">
                  {listedEnrollments.length > 0 ? (
                    <p>Không tìm thấy lớp học phù hợp với từ khóa.</p>
                  ) : isDirectSale ? (
                    <>
                      <p className="font-semibold text-slate-700">Bạn chưa có lớp học nào.</p>
                      <p className="max-w-md mx-auto leading-relaxed">
                        Lớp học sẽ hiển thị tại đây ngay khi MCNA xếp lớp xong, và bạn sẽ nhận email kèm lịch học, nhóm Zalo và giảng viên phụ trách. Cần hỗ trợ, gọi {appConfig.supportPhone}.
                      </p>
                    </>
                  ) : (
                    <p>Bạn chưa đăng ký lớp học nào.</p>
                  )}
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
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0B5CFF] text-[10.5px] font-mono font-bold rounded-lg border border-blue-200 flex items-center gap-1.5 transition cursor-pointer w-fit shrink-0"
                              title="Vào phòng học trực tuyến Zoom"
                            >
                              <ZoomLogo className="h-3.5 w-3.5" /> Vào Zoom ↗
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
                  Tài liệu học tập
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
                
                {currentLessonContentObj ? (
                  // Condition 2: View Lesson content (default display)
                  <div className="space-y-4">
                    {/* Breadcrumb back to session folder */}
                    <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePresentationSessionNumber(null);
                          setActiveLessonId(null);
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

                      <div className="relative z-10 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 md:p-5 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label htmlFor="lesson-personal-note" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800">
                            <MessageSquare className="h-4 w-4" /> Ghi chú cá nhân
                          </label>
                          <span className="text-[10px] font-mono text-indigo-500">
                            {noteSaving ? "Đang lưu…" : noteDirty ? "Chưa lưu" : "Đã lưu tự động"}
                          </span>
                        </div>
                        <textarea
                          id="lesson-personal-note"
                          value={lessonNote}
                          onChange={(event) => {
                            setLessonNote(event.target.value);
                            setNoteDirty(true);
                            noteDirtyRef.current = true;
                          }}
                          placeholder="Ghi lại công thức, câu hỏi hoặc điều cần ôn tập…"
                          className="min-h-28 w-full resize-y rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
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
                    <span className="font-semibold text-slate-800 text-xs block">{teacher ? instructorName(teacher) : "Chưa phân công"}</span>
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
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-[#0B5CFF] text-xs font-semibold shadow-2xs transition cursor-pointer"
                        >
                          <ZoomLogo className="h-4 w-4" /> Vào phòng Zoom
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
