import React, { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronRight, Clock, Compass, Hourglass, QrCode, Video } from "lucide-react";
import { StudentViewProps } from "./types";
import { Course, Transaction } from "../../types";
import WelcomeTour, { shouldShowWelcomeTour } from "./WelcomeTour";
import { cleanTopic, courseProgress, enrollmentSection, hasClassroomAccess, supportsVietQr, upcomingSessions } from "./learning";
import { callName, capitalizeFirst, formatDayLong, formatPrice, formatTimeIfSet, greeting, relativeDay } from "../../lib/format";
import { Badge, Button, buttonClass, Card, CourseCover, cx, EmptyState, ProgressRing, SectionTitle } from "../ui";

export default function StudentHome({ store, currentUser, myEnrollments, go, openCourse, openClassroom, openPayment }: StudentViewProps) {
  const [tourOpen, setTourOpen] = useState(() => shouldShowWelcomeTour(currentUser.id));

  const classes = useMemo(() => myEnrollments
    .map(enrollment => {
      const course = store.courses.find(c => c.id === enrollment.courseId);
      if (!course) return null;
      const section = enrollmentSection(store, currentUser.id, course.id);
      const ready = hasClassroomAccess(store, currentUser.id, enrollment, section);
      const next = ready ? upcomingSessions(store, course.id, section?.id)[0] : undefined;
      return { enrollment, course, section, ready, next, progress: courseProgress(store, enrollment) };
    })
    .filter(Boolean) as Array<{ enrollment: any; course: any; section: any; ready: boolean; next: any; progress: ReturnType<typeof courseProgress> }>,
  [store, myEnrollments, currentUser.id]);

  const learning = classes.filter(item => item.ready);
  const nextUp = learning
    .filter(item => item.next)
    .sort((a, b) => new Date(a.next.date).getTime() - new Date(b.next.date).getTime())[0];

  type Todo = { key: string; kind: "payment" | "placement"; course: Course; tx?: Transaction };
  const todos: Todo[] = classes.flatMap((item): Todo[] => {
    if (item.enrollment.status === "pending_payment") {
      const tx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === item.course.id && t.status === "pending" && supportsVietQr(t.paymentMethod));
      return [{ key: item.enrollment.id, kind: "payment", course: item.course, tx }];
    }
    if (item.enrollment.status === "pending" || (!item.ready && item.enrollment.status === "active")) {
      return [{ key: item.enrollment.id, kind: "placement", course: item.course }];
    }
    return [];
  });

  const enrolledIds = new Set(myEnrollments.map(e => e.courseId));
  const suggestions = store.courses
    .filter(course => course.status === "published" && !enrolledIds.has(course.id))
    .filter(course => (store.courseSections || []).some(section => section.courseId === course.id && section.status === "open"))
    .slice(0, 3);

  const nextTime = nextUp ? formatTimeIfSet(nextUp.next.date) : "";
  const nextIsToday = nextUp && relativeDay(nextUp.next.date) === "Hôm nay";

  return (
    <div className="space-y-10">
      {tourOpen && <WelcomeTour userId={currentUser.id} name={currentUser.name} onClose={() => setTourOpen(false)} />}

      <header className="space-y-1">
        <p className="text-[15px] font-medium text-slate-500">{capitalizeFirst(formatDayLong(new Date().toISOString()))}</p>
        <h1 className="text-[30px] font-bold tracking-tight text-slate-900 md:text-[36px]">
          {greeting()}, {callName(currentUser.name)}!
        </h1>
      </header>

      {/* Next live session */}
      {nextUp && (
        <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-900 p-6 text-white shadow-raised md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-500/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-24 h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 space-y-3">
              <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold", nextIsToday ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-indigo-100")}>
                {nextIsToday && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
                Buổi học tiếp theo · {relativeDay(nextUp.next.date)}{nextTime ? ` lúc ${nextTime}` : ""}
              </span>
              <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-[28px]">{cleanTopic(nextUp.next.topic) || "Buổi học trực tuyến"}</h2>
              <p className="text-[15px] text-slate-300">
                {nextUp.course.title}{nextUp.section ? ` · ${nextUp.section.sectionCode}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              {nextUp.section?.meetingUrl && (
                <a href={nextUp.section.meetingUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "lg", variant: "light" })}>
                  <Video className="h-5 w-5 text-indigo-600" /> Vào lớp Zoom
                </a>
              )}
              <Button size="lg" variant="onDark" onClick={() => openClassroom(nextUp.course.id)}>
                Xem lớp học
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* To-dos */}
      {todos.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="Cần bạn chú ý" />
          <div className="grid gap-3 md:grid-cols-2">
            {todos.map(todo => (
              <Card key={todo.key} className="flex items-center gap-4 p-4">
                <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", todo.kind === "payment" ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-violet-600")}>
                  {todo.kind === "payment" ? <QrCode className="h-6 w-6" /> : <Hourglass className="h-6 w-6" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-slate-900">{todo.kind === "payment" ? "Hoàn tất học phí" : "Đang chờ xếp lớp"}</p>
                  <p className="truncate text-sm text-slate-500">{todo.course.title}</p>
                </div>
                {todo.kind === "payment" ? (
                  todo.tx ? <Button size="sm" onClick={() => openPayment(todo.tx!)}>Thanh toán</Button> : <Button size="sm" variant="secondary" onClick={() => go("orders")}>Xem</Button>
                ) : (
                  <span className="hidden text-right text-xs leading-snug text-slate-400 sm:block">MCNA sẽ báo<br />khi có lớp</span>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Continue learning */}
      {learning.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle
            title="Tiếp tục học"
            action={<button type="button" onClick={() => go("learning")} className="inline-flex items-center gap-0.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Tất cả <ChevronRight className="h-4 w-4" /></button>}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {learning.map(item => (
              <Card key={item.enrollment.id} as="button" type="button" interactive onClick={() => openClassroom(item.course.id)} className="group flex flex-col gap-4 p-5 text-left">
                <div className="flex items-start gap-4">
                  <CourseCover src={item.course.thumbnail} title={item.course.title} category={item.course.category} className="h-14 w-14 shrink-0 rounded-2xl" iconSize="h-5 w-5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-500">{item.section?.sectionCode || item.course.category}</p>
                    <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-700">{item.course.title}</h3>
                  </div>
                  <ProgressRing value={item.progress.percent} size={48} stroke={5} />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.next ? `Buổi tới: ${relativeDay(item.next.date)}` : `${item.progress.completed}/${item.progress.total} bài đã học`}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-indigo-600">Vào lớp <ArrowRight className="h-4 w-4" /></span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState
            illustration="study"
            icon={<Compass className="h-6 w-6" />}
            title="Sẵn sàng cho lớp học đầu tiên?"
            description="Chọn một khóa học bạn thích. Sau khi đăng ký, lớp học và lịch học sẽ hiện ở đây."
            action={<Button onClick={() => go("catalog")} iconRight={<ArrowRight className="h-4 w-4" />}>Khám phá khóa học</Button>}
          />
        </Card>
      ) : null}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle
            title={classes.length ? "Có thể bạn sẽ thích" : "Khóa học đang mở"}
            action={<button type="button" onClick={() => go("catalog")} className="inline-flex items-center gap-0.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Khám phá <ChevronRight className="h-4 w-4" /></button>}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map(course => (
              <Card key={course.id} as="button" type="button" interactive onClick={() => openCourse(course.id)} className="group overflow-hidden text-left">
                <CourseCover src={course.thumbnail} title={course.title} category={course.category} className="aspect-[16/9] w-full" />
                <div className="space-y-2 p-4">
                  <p className="text-[13px] font-semibold text-indigo-600">{course.category}</p>
                  <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 group-hover:text-indigo-700">{course.title}</h3>
                  <div className="flex items-center justify-between pt-1 text-sm">
                    <span className="font-semibold text-slate-900">{formatPrice(course.price)}</span>
                    {course.level && <Badge>{course.level}</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {learning.length > 0 && !nextUp && (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Clock className="h-4 w-4" /> Lịch các buổi học tiếp theo sẽ hiện ở đây khi giảng viên cập nhật.</p>
      )}
    </div>
  );
}
