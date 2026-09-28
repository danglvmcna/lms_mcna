import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Hourglass,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  PlayCircle,
  QrCode,
  Users,
  Video
} from "lucide-react";
import { api } from "../../api";
import ForumDiscussion from "../ForumDiscussion";
import SessionMaterialsList from "../SessionMaterialsList";
import LinkedText from "../LinkedText";
import { ZoomLogo } from "../icons/BrandLogos";
import { instructorName } from "./studentDisplay";
import VideoStage from "./VideoStage";
import { StudentViewProps } from "./types";
import {
  buildClassSessions,
  ClassSession,
  cleanTopic,
  courseProgress,
  ENROLLMENT_STATUS,
  enrollmentSection,
  hasClassroomAccess,
  isLessonCompleted,
  registeredSectionId,
  sessionTiming,
  supportsVietQr,
  upcomingSessions
} from "./learning";
import { formatDate, formatDayLong, formatTimeIfSet, relativeDay } from "../../lib/format";
import { Avatar, Badge, Button, buttonClass, Card, CourseCover, cx, Dialog, EmptyState, PageHeader, ProgressBar, ProgressRing, Segmented } from "../ui";
import { Course, CourseSection, Enrollment, Lesson } from "../../types";

const lessonTitle = (lesson?: Lesson) => (lesson ? lesson.title.replace(/^\d+\.\s*/, "") : "");

interface WorkspaceProps extends StudentViewProps {
  learningCourseId: string | null;
  setLearningCourseId: (id: string | null) => void;
  focusSessionNumber: number | null;
  onToggleLesson: (enrollmentId: string, lessonId: string) => Promise<unknown> | void;
}

export default function MyLearningWorkspace(props: WorkspaceProps) {
  return props.learningCourseId ? <Classroom {...props} courseId={props.learningCourseId} /> : <ClassList {...props} />;
}

/* ====================================================================== Class list */

function ClassList({ store, currentUser, myEnrollments, setLearningCourseId, openPayment, go }: WorkspaceProps) {
  const items = myEnrollments
    .map(enrollment => {
      const course = store.courses.find(c => c.id === enrollment.courseId);
      if (!course) return null;
      const section = enrollmentSection(store, currentUser.id, course.id);
      const ready = hasClassroomAccess(store, currentUser.id, enrollment, section);
      return { enrollment, course, section, ready };
    })
    .filter(Boolean) as Array<{ enrollment: Enrollment; course: Course; section?: CourseSection; ready: boolean }>;

  const active = items.filter(item => item.ready);
  const waiting = items.filter(item => !item.ready);

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lớp học của tôi" />
        <Card>
          <EmptyState
            illustration="study"
            icon={<GraduationCap className="h-6 w-6" />}
            title="Bạn chưa có lớp học nào"
            description="Đăng ký một khóa học, lớp của bạn sẽ xuất hiện ở đây cùng lịch học và tài liệu."
            action={<Button onClick={() => go("catalog")} iconRight={<ArrowRight className="h-4 w-4" />}>Khám phá khóa học</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Lớp học của tôi" subtitle={`${active.length} lớp đang học${waiting.length ? ` · ${waiting.length} đang chờ` : ""}`} />

      {active.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {active.map(({ enrollment, course, section }) => {
            const progress = courseProgress(store, enrollment);
            const next = upcomingSessions(store, course.id, section?.id)[0];
            const time = next ? formatTimeIfSet(next.date) : "";
            return (
              <Card key={enrollment.id} className="flex flex-col p-5">
                <div className="flex items-start gap-4">
                  <CourseCover src={course.thumbnail} title={course.title} category={course.category} className="h-16 w-16 shrink-0 rounded-2xl" iconSize="h-6 w-6" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-500">{section?.sectionCode}</p>
                    <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-slate-900">{course.title}</h3>
                  </div>
                  {enrollment.status === "completed" && <Badge tone="primary">Hoàn thành</Badge>}
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">Tiến độ</span>
                    <span className="font-semibold text-slate-700">{progress.completed}/{progress.total} bài · {progress.percent}%</span>
                  </div>
                  <ProgressBar value={progress.percent} />
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-canvas p-3.5">
                  <CalendarDays className="h-5 w-5 shrink-0 text-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-slate-500">{next ? `Buổi tới · ${relativeDay(next.date)}${time ? ` lúc ${time}` : ""}` : "Lịch học"}</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{next ? cleanTopic(next.topic) || "Buổi học trực tuyến" : section?.schedule?.map(s => `${s.dayOfWeek} ${s.startTime}`).join(" · ") || "Đang cập nhật"}</p>
                  </div>
                  {section?.meetingUrl && next && relativeDay(next.date) === "Hôm nay" && (
                    <a href={section.meetingUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm" })}>Vào Zoom</a>
                  )}
                </div>

                <Button className="mt-4" block onClick={() => setLearningCourseId(course.id)} iconRight={<ArrowRight className="h-4 w-4" />}>Vào lớp học</Button>
              </Card>
            );
          })}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Đang chờ xác nhận</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {waiting.map(({ enrollment, course, section }) => {
              const status = ENROLLMENT_STATUS[enrollment.status] || ENROLLMENT_STATUS.pending;
              const pendingTx = enrollment.status === "pending_payment"
                ? store.transactions.find(t => t.studentId === currentUser.id && t.courseId === course.id && t.status === "pending" && supportsVietQr(t.paymentMethod))
                : undefined;
              return (
                <Card key={enrollment.id} className="flex items-start gap-4 p-4">
                  <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", enrollment.status === "pending_payment" ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-violet-600")}>
                    {enrollment.status === "pending_payment" ? <QrCode className="h-6 w-6" /> : <Hourglass className="h-6 w-6" />}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Badge tone={status.tone} dot>{enrollment.status === "active" ? "Chờ xếp lớp" : status.label}</Badge>
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{course.title}</p>
                    <p className="text-[13px] leading-relaxed text-slate-500">
                      {enrollment.status === "pending_payment"
                        ? "Lớp sẽ mở ngay khi MCNA nhận được học phí."
                        : `MCNA đang xếp bạn vào lớp${section ? ` ${section.sectionCode}` : ""}. Bạn sẽ nhận thông báo khi xong.`}
                    </p>
                    {pendingTx && <Button size="sm" className="mt-2" onClick={() => openPayment(pendingTx)}>Thanh toán ngay</Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ====================================================================== Classroom */

function Classroom({ store, currentUser, myEnrollments, courseId, setLearningCourseId, focusSessionNumber, onToggleLesson, onRefreshData, toast }: WorkspaceProps & { courseId: string }) {
  const course = store.courses.find(c => c.id === courseId);
  const enrollment = myEnrollments.find(e => e.courseId === courseId);
  const section = enrollment ? enrollmentSection(store, currentUser.id, courseId) : undefined;
  const sectionId = registeredSectionId(store, currentUser.id, courseId);
  const activeSection = (store.courseSections || []).find(s => s.id === sectionId) || section;
  const lessons = useMemo(() => store.lessons.filter(l => l.courseId === courseId).sort((a, b) => a.order - b.order), [store.lessons, courseId]);
  const sessions = useMemo(() => buildClassSessions(store, courseId, sectionId, lessons), [store, courseId, sectionId, lessons]);

  const [tab, setTab] = useState<"sessions" | "discussion">("sessions");
  const [sessionNumber, setSessionNumber] = useState<number | null>(focusSessionNumber);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setTab("sessions");
    setSessionNumber(focusSessionNumber);
    setLessonId(null);
  }, [courseId, focusSessionNumber]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [sessionNumber, lessonId, tab]);

  if (!course) return null;

  if (!hasClassroomAccess(store, currentUser.id, enrollment, section)) {
    return (
      <Card className="mx-auto mt-6 max-w-xl">
        <EmptyState
          illustration="waiting"
          icon={<Lock className="h-6 w-6" />}
          title="Lớp học chưa mở cho bạn"
          description="Bạn cần hoàn tất học phí hoặc chờ MCNA xếp lớp. Khi xong, bạn sẽ nhận được thông báo."
          action={<Button variant="secondary" onClick={() => setLearningCourseId(null)}>Quay lại lớp học của tôi</Button>}
        />
      </Card>
    );
  }

  const progress = courseProgress(store, enrollment!);
  const activeSession = sessions.find(s => s.number === sessionNumber) || null;
  const activeLesson = lessonId ? lessons.find(l => l.id === lessonId) || null : null;
  const lessonSession = activeLesson ? sessions.find(s => s.lessons.some(l => l.id === activeLesson.id)) || activeSession : activeSession;
  const nextSession = sessions.find(s => s.date && (sessionTiming(s.date) === "today" || sessionTiming(s.date) === "upcoming"));

  const openSession = (number: number) => {
    setSessionNumber(number);
    setLessonId(null);
  };

  const header = (
    <header className="space-y-5">
      <button type="button" onClick={() => setLearningCourseId(null)} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
        <ArrowLeft className="h-4 w-4" /> Lớp học của tôi
      </button>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <CourseCover src={course.thumbnail} title={course.title} category={course.category} className="hidden h-16 w-16 shrink-0 rounded-2xl sm:block" iconSize="h-6 w-6" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-indigo-600">{[course.category, activeSection?.sectionCode].filter(Boolean).join(" · ")}</p>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 md:text-[30px]">{course.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200/70 md:shrink-0">
          <ProgressRing value={progress.percent} size={44} stroke={5} />
          <div className="text-sm">
            <p className="font-semibold text-slate-900">{progress.completed}/{progress.total} bài học</p>
            <p className="text-slate-500">{progress.percent === 100 ? "Tuyệt vời, bạn đã học hết!" : "Tiến độ của bạn"}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {activeSection?.meetingUrl && (
          <a href={activeSection.meetingUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm" })}>
            <Video className="h-4 w-4" /> Vào lớp Zoom
          </a>
        )}
        {activeSection?.groupChatUrl && (
          <a href={activeSection.groupChatUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "secondary" })}>
            <MessageCircle className="h-4 w-4 text-blue-600" /> Nhóm lớp
          </a>
        )}
        <Button size="sm" variant="secondary" icon={<Info className="h-4 w-4 text-slate-500" />} onClick={() => setShowInfo(true)}>Thông tin lớp</Button>
      </div>
      <Segmented
        value={tab}
        onChange={value => { setTab(value); setSessionNumber(null); setLessonId(null); }}
        options={[
          { value: "sessions", label: <><BookOpen className="h-4 w-4" /> Buổi học</> },
          { value: "discussion", label: <><MessagesSquare className="h-4 w-4" /> Thảo luận</> }
        ]}
        className="w-full sm:w-auto"
      />
    </header>
  );

  return (
    <div className="space-y-8">
      {!activeSession && !activeLesson && header}

      {tab === "discussion" ? (
        <ForumDiscussion courseId={courseId} sectionId={sectionId} store={store} currentUser={currentUser} onRefreshData={onRefreshData} triggerToast={toast} />
      ) : activeLesson ? (
        <LessonReader
          lesson={activeLesson}
          lessons={lessons}
          session={lessonSession}
          enrollmentId={enrollment!.id}
          completed={isLessonCompleted(store, enrollment!.id, activeLesson.id)}
          onToggle={() => onToggleLesson(enrollment!.id, activeLesson.id)}
          onOpenLesson={setLessonId}
          onBack={() => { setLessonId(null); if (lessonSession) setSessionNumber(lessonSession.number); }}
        />
      ) : activeSession ? (
        <SessionView
          session={activeSession}
          sessions={sessions}
          courseTitle={course.title}
          meetingUrl={activeSection?.meetingUrl}
          enrollmentId={enrollment!.id}
          isCompleted={id => isLessonCompleted(store, enrollment!.id, id)}
          onToggle={id => onToggleLesson(enrollment!.id, id)}
          onOpenSession={openSession}
          onOpenLesson={setLessonId}
          onBack={() => setSessionNumber(null)}
        />
      ) : (
        <SessionPath
          sessions={sessions}
          nextNumber={nextSession?.number}
          meetingUrl={activeSection?.meetingUrl}
          isSessionDone={s => s.lessons.length > 0 && s.lessons.every(l => isLessonCompleted(store, enrollment!.id, l.id))}
          onOpen={openSession}
        />
      )}

      {showInfo && activeSection && <ClassInfoDialog store={store} section={activeSection} course={course} onClose={() => setShowInfo(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- Session path */

function SessionPath({ sessions, nextNumber, meetingUrl, isSessionDone, onOpen }: {
  sessions: ClassSession[];
  nextNumber?: number;
  meetingUrl?: string;
  isSessionDone: (session: ClassSession) => boolean;
  onOpen: (number: number) => void;
}) {
  return (
    <ol className="relative space-y-3">
      <span className="absolute bottom-6 left-[27px] top-6 w-0.5 rounded-full bg-slate-200 md:left-[31px]" aria-hidden />
      {sessions.map(session => {
        const done = isSessionDone(session);
        const isNext = session.number === nextNumber;
        const timing = sessionTiming(session.date);
        const time = formatTimeIfSet(session.date);
        const topic = cleanTopic(session.topic) || lessonTitle(session.lessons[0]);
        const extras = [
          session.materials.length ? `${session.materials.length} tài liệu` : "",
          session.lessons.length ? `${session.lessons.length} bài học` : "",
          session.videoUrl || session.recordingUrl ? "Video" : ""
        ].filter(Boolean);

        return (
          <li key={session.number} className="relative flex gap-4 md:gap-5">
            <span
              className={cx(
                "relative z-10 mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold ring-4 ring-canvas md:h-16 md:w-16",
                done ? "bg-emerald-500 text-white" : isNext ? "bg-indigo-600 text-white shadow-primary" : timing === "past" ? "bg-white text-slate-500 ring-canvas shadow-card" : "bg-white text-slate-400 shadow-card"
              )}
              aria-hidden
            >
              {done ? <Check className="h-6 w-6" strokeWidth={3} /> : session.number}
            </span>
            <div className={cx("min-w-0 flex-1 rounded-[1.25rem] bg-white shadow-card ring-1 transition-shadow", isNext ? "ring-indigo-200" : "ring-slate-200/70")}>
              <button type="button" onClick={() => onOpen(session.number)} className="group flex w-full items-center gap-3 p-4 text-left md:p-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-500">{session.title}</span>
                    {isNext && <Badge tone="primary" dot>{timing === "today" ? "Hôm nay" : "Tiếp theo"}</Badge>}
                    {done && <Badge tone="success">Đã học</Badge>}
                  </div>
                  <h3 className="text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-700 md:text-[17px]">{topic || session.title}</h3>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {session.date ? `${formatDate(session.date)}${time ? ` · ${time}` : ""}` : "Chưa xếp lịch"}</span>
                    {extras.length > 0 && <span>{extras.join(" · ")}</span>}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-indigo-500" />
              </button>
              {isNext && meetingUrl && timing === "today" && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 md:px-5">
                  <a href={meetingUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", block: true })}>
                    <Video className="h-4 w-4" /> Vào lớp Zoom
                  </a>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------------- Session view */

function LessonRow({ lesson, index, completed, onToggle, onOpen }: { lesson: Lesson; index: number; completed: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-3 border-b border-slate-100 px-2 py-2 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={completed}
        aria-label={completed ? `Đánh dấu chưa học: ${lesson.title}` : `Đánh dấu đã học: ${lesson.title}`}
        className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", completed ? "text-emerald-600" : "text-slate-300 hover:text-indigo-500")}
      >
        <span className={cx("flex h-7 w-7 items-center justify-center rounded-full border-2", completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-current")}>
          {completed && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-slate-500">Bài {index} · {lesson.duration?.replace("mins", "phút")}</span>
          <span className={cx("block truncate text-[15px] font-semibold group-hover:text-indigo-700", completed ? "text-slate-500" : "text-slate-900")}>{lesson.title.replace(/^\d+\.\s*/, "")}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-indigo-500" />
      </button>
    </li>
  );
}

function SessionView({ session, sessions, courseTitle, meetingUrl, isCompleted, onToggle, onOpenSession, onOpenLesson, onBack }: {
  session: ClassSession;
  sessions: ClassSession[];
  courseTitle: string;
  meetingUrl?: string;
  enrollmentId: string;
  isCompleted: (lessonId: string) => boolean;
  onToggle: (lessonId: string) => void;
  onOpenSession: (number: number) => void;
  onOpenLesson: (lessonId: string) => void;
  onBack: () => void;
}) {
  const timing = sessionTiming(session.date);
  const time = formatTimeIfSet(session.date);
  const topic = cleanTopic(session.topic) || lessonTitle(session.lessons[0]);
  const prev = sessions.find(s => s.number === session.number - 1);
  const next = sessions.find(s => s.number === session.number + 1);
  const lessonIndex = (lesson: Lesson) => sessions.flatMap(s => s.lessons).findIndex(l => l.id === lesson.id) + 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Outline */}
      <nav aria-label="Các buổi học" className="hidden lg:block">
        <div className="sticky top-10 space-y-3">
          <button type="button" onClick={onBack} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
            <ArrowLeft className="h-4 w-4" /> Tất cả buổi học
          </button>
          <p className="line-clamp-2 px-1 text-sm font-semibold text-slate-900">{courseTitle}</p>
          <ol className="max-h-[70vh] space-y-0.5 overflow-y-auto pr-1">
            {sessions.map(item => {
              const selected = item.number === session.number;
              return (
                <li key={item.number}>
                  <button
                    type="button"
                    onClick={() => onOpenSession(item.number)}
                    aria-current={selected ? "page" : undefined}
                    className={cx("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left", selected ? "bg-indigo-50" : "hover:bg-slate-900/[0.04]")}
                  >
                    <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", selected ? "bg-indigo-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")}>{item.number}</span>
                    <span className="min-w-0">
                      <span className={cx("block truncate text-sm font-semibold", selected ? "text-indigo-700" : "text-slate-700")}>{cleanTopic(item.topic) || lessonTitle(item.lessons[0]) || item.title}</span>
                      <span className="block text-xs text-slate-400">{item.date ? formatDate(item.date) : "Chưa xếp lịch"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <article className="min-w-0 space-y-8">
        <header className="space-y-3">
          <button type="button" onClick={onBack} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Tất cả buổi học
          </button>
          <p className="text-[13px] font-semibold text-indigo-600">
            {session.title}{session.date ? ` · ${formatDayLong(session.date)}${time ? `, ${time}` : ""}` : " · Chưa xếp lịch"}
          </p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 md:text-[34px]">{topic || session.title}</h1>
          {session.content && <div className="max-w-[68ch] text-[16px] leading-relaxed text-slate-600 whitespace-pre-line"><LinkedText text={session.content} /></div>}
        </header>

        {meetingUrl && (timing === "today" || timing === "upcoming") && (
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50"><ZoomLogo className="h-7 w-7" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{timing === "today" ? "Buổi học diễn ra hôm nay" : `Học trực tuyến · ${relativeDay(session.date)}`}</p>
              <p className="text-sm text-slate-500">Vào phòng Zoom của lớp đúng giờ để học cùng giảng viên.</p>
            </div>
            <a href={meetingUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: "zoom" })}>
              <Video className="h-4 w-4" /> Vào lớp Zoom
            </a>
          </Card>
        )}

        {(session.videoUrl || session.recordingUrl) && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><PlayCircle className="h-5 w-5 text-indigo-500" /> Video</h2>
            {session.videoUrl && <VideoStage url={session.videoUrl} title={topic || session.title} />}
            {session.recordingUrl && session.recordingUrl !== session.videoUrl && <VideoStage url={session.recordingUrl} title={`Xem lại ${session.title.toLowerCase()}`} />}
          </section>
        )}

        {session.lessons.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpen className="h-5 w-5 text-indigo-500" /> Bài học</h2>
            <Card as="ol" className="px-2">
              {session.lessons.map(lesson => (
                <LessonRow key={lesson.id} lesson={lesson} index={lessonIndex(lesson)} completed={isCompleted(lesson.id)} onToggle={() => onToggle(lesson.id)} onOpen={() => onOpenLesson(lesson.id)} />
              ))}
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileText className="h-5 w-5 text-indigo-500" /> Tài liệu</h2>
          {session.materials.length > 0 ? (
            <SessionMaterialsList materials={session.materials} sessionId={session.sessionId} />
          ) : (
            <p className="rounded-2xl bg-white px-5 py-4 text-sm text-slate-500 shadow-card ring-1 ring-slate-200/70">Giảng viên chưa đăng tài liệu cho buổi này.</p>
          )}
        </section>

        <nav className="grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-6" aria-label="Chuyển buổi học">
          {prev ? (
            <button type="button" onClick={() => onOpenSession(prev.number)} className="group flex min-w-0 items-center gap-2 rounded-2xl p-3 text-left hover:bg-white hover:shadow-card">
              <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-indigo-600" />
              <span className="min-w-0"><span className="block text-xs text-slate-500">Buổi trước</span><span className="block truncate text-sm font-semibold text-slate-900">{cleanTopic(prev.topic) || prev.title}</span></span>
            </button>
          ) : <span />}
          {next ? (
            <button type="button" onClick={() => onOpenSession(next.number)} className="group flex min-w-0 items-center justify-end gap-2 rounded-2xl p-3 text-right hover:bg-white hover:shadow-card">
              <span className="min-w-0"><span className="block text-xs text-slate-500">Buổi sau</span><span className="block truncate text-sm font-semibold text-slate-900">{cleanTopic(next.topic) || next.title}</span></span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-indigo-600" />
            </button>
          ) : <span />}
        </nav>
      </article>
    </div>
  );
}

/* ---------------------------------------------------------------------- Lesson reader */

function LessonReader({ lesson, lessons, session, completed, onToggle, onOpenLesson, onBack }: {
  lesson: Lesson;
  lessons: Lesson[];
  session: ClassSession | null;
  enrollmentId: string;
  completed: boolean;
  onToggle: () => Promise<unknown> | void;
  onOpenLesson: (id: string) => void;
  onBack: () => void;
}) {
  const [note, setNote] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const noteDirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setNote("");
    setNoteDirty(false);
    noteDirtyRef.current = false;
    api.getLessonNote(lesson.id)
      .then((response: any) => {
        if (!cancelled && !noteDirtyRef.current) setNote(response?.note?.content || "");
      })
      .catch(() => {
        // Notes are an enhancement; an unavailable notes endpoint must not block the lesson.
      });
    return () => { cancelled = true; };
  }, [lesson.id]);

  useEffect(() => {
    if (!noteDirty) return;
    const timer = window.setTimeout(async () => {
      setNoteSaving(true);
      try {
        await api.saveLessonNote(lesson.id, note);
        setNoteDirty(false);
        noteDirtyRef.current = false;
      } catch {
        // Keep the dirty flag so the next edit retries the save.
      } finally {
        setNoteSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [lesson.id, note, noteDirty]);

  const index = lessons.findIndex(l => l.id === lesson.id);
  const nextLesson = index >= 0 ? lessons[index + 1] : undefined;
  const prevLesson = index > 0 ? lessons[index - 1] : undefined;
  const videoUrl = lesson.videoUrl || session?.videoUrl || "";

  const toggle = async () => {
    setToggling(true);
    try {
      await onToggle();
    } finally {
      setToggling(false);
    }
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <button type="button" onClick={onBack} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          <ArrowLeft className="h-4 w-4" /> {session ? `${session.title}${cleanTopic(session.topic) ? `: ${cleanTopic(session.topic)}` : ""}` : "Buổi học"}
        </button>
        <p className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-indigo-600">
          <span>Bài {index + 1}/{lessons.length}</span>
          {lesson.duration && <span className="inline-flex items-center gap-1 text-slate-500"><Clock className="h-3.5 w-3.5" /> {lesson.duration.replace("mins", "phút")}</span>}
          {completed && <Badge tone="success"><Check className="h-3.5 w-3.5" strokeWidth={3} /> Đã học</Badge>}
        </p>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 md:text-[36px]">{lesson.title.replace(/^\d+\.\s*/, "")}</h1>
      </header>

      {videoUrl && <VideoStage url={videoUrl} title={lesson.title} />}

      <Card className="p-6 md:p-10">
        <div className="mcna-prose max-w-[68ch]">{lesson.content}</div>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="lesson-note" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <NotebookPen className="h-[18px] w-[18px] text-amber-500" /> Ghi chú của tôi
          </label>
          <span className="text-xs text-slate-400" aria-live="polite">{noteSaving ? "Đang lưu…" : noteDirty ? "Chưa lưu" : note ? "Đã lưu" : ""}</span>
        </div>
        <textarea
          id="lesson-note"
          value={note}
          onChange={event => {
            setNote(event.target.value);
            setNoteDirty(true);
            noteDirtyRef.current = true;
          }}
          placeholder="Ghi lại ý chính, câu hỏi muốn hỏi giảng viên, hoặc điều cần ôn lại…"
          className="min-h-32 w-full resize-y rounded-[1.25rem] border border-amber-200/70 bg-amber-50/50 px-4 py-3.5 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-400/15"
        />
      </section>

      {/* Completion */}
      <Card className={cx("flex flex-col items-stretch gap-4 p-5 sm:flex-row sm:items-center", completed && "!border-emerald-200 !bg-emerald-50/60")}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", completed ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-600")}>
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{completed ? "Bạn đã học xong bài này" : "Đã hiểu bài này?"}</p>
            <p className="text-sm text-slate-500">{completed ? (nextLesson ? "Cùng sang bài tiếp theo nhé." : "Đây là bài cuối của khóa học.") : "Đánh dấu hoàn thành để cập nhật tiến độ."}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {completed ? (
            <>
              <Button variant="ghost" loading={toggling} onClick={toggle}>Chưa học xong</Button>
              {nextLesson && <Button onClick={() => onOpenLesson(nextLesson.id)} iconRight={<ArrowRight className="h-4 w-4" />}>Bài tiếp theo</Button>}
            </>
          ) : (
            <Button variant="success" loading={toggling} onClick={toggle} icon={<Check className="h-4 w-4" strokeWidth={3} />}>Hoàn thành bài học</Button>
          )}
        </div>
      </Card>

      <nav className="grid grid-cols-2 gap-3" aria-label="Chuyển bài học">
        {prevLesson ? (
          <button type="button" onClick={() => onOpenLesson(prevLesson.id)} className="group flex min-w-0 items-center gap-2 rounded-2xl p-3 text-left hover:bg-white hover:shadow-card">
            <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-indigo-600" />
            <span className="min-w-0"><span className="block text-xs text-slate-500">Bài trước</span><span className="block truncate text-sm font-semibold text-slate-900">{prevLesson.title.replace(/^\d+\.\s*/, "")}</span></span>
          </button>
        ) : <span />}
        {nextLesson ? (
          <button type="button" onClick={() => onOpenLesson(nextLesson.id)} className="group flex min-w-0 items-center justify-end gap-2 rounded-2xl p-3 text-right hover:bg-white hover:shadow-card">
            <span className="min-w-0"><span className="block text-xs text-slate-500">Bài sau</span><span className="block truncate text-sm font-semibold text-slate-900">{nextLesson.title.replace(/^\d+\.\s*/, "")}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-indigo-600" />
          </button>
        ) : <span />}
      </nav>
    </article>
  );
}

/* ---------------------------------------------------------------------- Class info */

function ClassInfoDialog({ store, section, course, onClose }: { store: WorkspaceProps["store"]; section: CourseSection; course: Course; onClose: () => void }) {
  const teacher = store.users.find(u => u.id === section.teacherId);
  const classmates = (store.courseRegistrations || [])
    .filter(r => r.sectionId === section.id && r.status === "registered")
    .map(r => store.users.find(u => u.id === r.studentId))
    .filter(Boolean) as Array<{ id: string; name: string }>;

  return (
    <Dialog onClose={onClose} size="lg" title={`Lớp ${section.sectionCode}`} description={course.title} icon={<GraduationCap className="h-5 w-5" />}>
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3">
          {[
            ["Giảng viên", instructorName(teacher)],
            ["Khai giảng", formatDate(section.openingDate, "Đang cập nhật")],
            ["Số buổi", section.numberOfSessions ? `${section.numberOfSessions} buổi` : "Đang cập nhật"],
            ["Sĩ số", `${classmates.length}/${section.maxStudents} học viên`]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-canvas p-3.5">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Lịch học hằng tuần</h3>
          <ul className="space-y-2">
            {(section.schedule || []).map((slot, index) => (
              <li key={index} className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3 text-sm">
                <span className="w-20 shrink-0 font-bold text-slate-900">{slot.dayOfWeek}</span>
                <span className="font-medium text-slate-700">{slot.startTime} – {slot.endTime}</span>
                <span className="ml-auto inline-flex min-w-0 items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" /> {slot.room || "Trực tuyến"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4 text-slate-400" /> Bạn cùng lớp ({classmates.length})</h3>
          {classmates.length > 0 ? (
            <ul className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {classmates.map(student => (
                <li key={student.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                  <Avatar name={student.name} size={30} />
                  <span className="truncate text-sm font-medium text-slate-700">{student.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Chưa có học viên nào trong lớp.</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
