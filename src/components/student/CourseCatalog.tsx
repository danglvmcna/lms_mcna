import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Clock, Hourglass, Laptop, MapPin, Search, UserRound } from "lucide-react";
import { api } from "../../api";
import LinkedText from "../LinkedText";
import CourseCard from "../common/CourseCard";
import { instructorName } from "./studentDisplay";
import { StudentViewProps } from "./types";
import { ENROLLMENT_STATUS, supportsVietQr } from "./learning";
import { CourseSection } from "../../types";
import { formatDate, formatPrice } from "../../lib/format";
import { Badge, Button, Callout, Card, CourseCover, cx, EmptyState, PageHeader, SearchField } from "../ui";

const PAGE_SIZE = 12;

const timeToMinutes = (value: string) => {
  const [hours, minutes] = String(value || "0:0").split(":").map(Number);
  return hours * 60 + minutes;
};

/** Returns the code of an already-registered class whose weekly schedule overlaps `section`, if any. */
function findConflict(section: CourseSection, registered: CourseSection[]): string | null {
  for (const slot of section.schedule || []) {
    for (const other of registered) {
      for (const otherSlot of other.schedule || []) {
        const slotDate = slot.specificDate ? String(slot.specificDate).slice(0, 10) : "";
        const otherDate = otherSlot.specificDate ? String(otherSlot.specificDate).slice(0, 10) : "";
        const sameDay = slotDate && otherDate
          ? slotDate === otherDate
          : String(slot.dayOfWeek || "").trim().toLowerCase() === String(otherSlot.dayOfWeek || "").trim().toLowerCase() && Boolean(slot.dayOfWeek);
        if (sameDay && Math.max(timeToMinutes(slot.startTime), timeToMinutes(otherSlot.startTime)) < Math.min(timeToMinutes(slot.endTime), timeToMinutes(otherSlot.endTime))) {
          return other.sectionCode;
        }
      }
    }
  }
  return null;
}

interface CourseCatalogProps extends StudentViewProps {
  viewingCourseId: string | null;
  setViewingCourseId: (id: string | null) => void;
  onEnroll: (courseId: string, sectionId?: string) => void;
}

export default function CourseCatalog({ store, currentUser, myEnrollments, viewingCourseId, setViewingCourseId, onEnroll, openClassroom, openPayment, toast }: CourseCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [hideConflicts, setHideConflicts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => setVisibleCount(PAGE_SIZE), [search, category, hideConflicts]);

  const sections = store.courseSections || [];
  const registrations = store.courseRegistrations || [];

  const registeredSections = useMemo(
    () => registrations
      .filter(r => r.studentId === currentUser.id && r.status === "registered")
      .map(r => sections.find(section => section.id === r.sectionId))
      .filter(Boolean) as CourseSection[],
    [registrations, sections, currentUser.id]
  );

  const publishedCourses = useMemo(
    () => store.courses.filter(course => course.status === "published" && sections.some(section => section.courseId === course.id && section.schedule?.length > 0)),
    [store.courses, sections]
  );

  const categories = useMemo(
    () => Array.from(new Set(publishedCourses.map(course => course.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")),
    [publishedCourses]
  );

  const enrollmentFor = (courseId: string) => myEnrollments.find(e => e.courseId === courseId);

  const filtered = publishedCourses.filter(course => {
    const keyword = search.trim().toLowerCase();
    if (keyword && ![course.title, course.description, ...(course.tags || [])].some(value => String(value || "").toLowerCase().includes(keyword))) return false;
    if (category !== "all" && course.category !== category) return false;
    if (hideConflicts) {
      const courseSections = sections.filter(section => section.courseId === course.id && section.schedule?.length > 0);
      const otherCourses = registeredSections.filter(other => other.courseId !== course.id);
      if (courseSections.length > 0 && courseSections.every(section => findConflict(section, otherCourses))) return false;
    }
    return true;
  });

  /* ---------------------------------------------------------------- Course detail */
  if (viewingCourseId) {
    const course = store.courses.find(c => c.id === viewingCourseId);
    if (!course) return null;
    const teacher = store.users.find(u => u.id === course.teacherId);
    const lessons = store.lessons.filter(l => l.courseId === course.id).sort((a, b) => a.order - b.order);
    const enrollment = enrollmentFor(course.id);
    const openSections = sections.filter(s => s.courseId === course.id && s.status === "open" && s.schedule?.length > 0);
    const seatCount = (section: CourseSection) => registrations.filter(r => r.sectionId === section.id && r.status === "registered").length;
    const allFull = openSections.length > 0 && openSections.every(section => seatCount(section) >= section.maxStudents);
    const firstOpening = openSections.map(section => section.openingDate).filter(Boolean).sort()[0];

    const requestNewSection = async () => {
      setRequesting(true);
      try {
        await api.requestNewSection(course.id);
        toast("Đã gửi yêu cầu mở thêm lớp. MCNA sẽ báo bạn khi có lớp mới.", "success");
      } catch (err: any) {
        toast(err.message || "Không thể gửi yêu cầu.", "error");
      } finally {
        setRequesting(false);
      }
    };

    const status = enrollment ? ENROLLMENT_STATUS[enrollment.status] : null;
    const pendingTx = enrollment?.status === "pending_payment"
      ? store.transactions.find(t => t.studentId === currentUser.id && t.courseId === course.id && t.status === "pending" && supportsVietQr(t.paymentMethod))
      : undefined;

    const enrollmentPanel = enrollment ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Trạng thái</span>
          {status && <Badge tone={status.tone} dot>{status.label}</Badge>}
        </div>
        {enrollment.status === "pending_payment" && (pendingTx
          ? <Button block onClick={() => openPayment(pendingTx)}>Thanh toán học phí</Button>
          : <p className="text-sm text-slate-500">Đơn đang chờ cập nhật thanh toán.</p>)}
        {enrollment.status === "pending" && <p className="text-sm leading-relaxed text-slate-500">MCNA đang xếp lớp cho bạn. Bạn sẽ nhận thông báo khi lớp sẵn sàng.</p>}
        {(enrollment.status === "active" || enrollment.status === "completed") && (
          <Button block onClick={() => openClassroom(course.id)} iconRight={<ArrowRight className="h-4 w-4" />}>Vào lớp học</Button>
        )}
      </div>
    ) : null;

    return (
      <div className="space-y-10">
        <PageHeader
          onBack={() => setViewingCourseId(null)}
          backLabel="Khám phá"
          eyebrow={[course.category, course.level].filter(Boolean).join(" · ")}
          title={course.title}
        />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            <div className="text-[16px] leading-relaxed text-slate-600 whitespace-pre-line">
              <LinkedText text={course.description} />
            </div>

            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { icon: UserRound, label: "Giảng viên", value: instructorName(teacher) },
                { icon: Clock, label: "Thời lượng", value: course.numberOfLessons ? `${course.numberOfLessons} buổi` : `${lessons.length} bài học` },
                { icon: CalendarDays, label: "Khai giảng", value: firstOpening ? formatDate(firstOpening) : "Đang cập nhật" },
                { icon: Laptop, label: "Hình thức", value: "Trực tuyến" }
              ].map(({ icon: Icon, label, value }) => (
                <Card key={label} className="p-4">
                  <Icon className="h-5 w-5 text-indigo-500" />
                  <dt className="mt-3 text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{value}</dd>
                </Card>
              ))}
            </dl>

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{enrollment ? "Các lớp của khóa học" : "Chọn lớp học"}</h2>
                <p className="mt-1 text-sm text-slate-500">Lớp trùng lịch với lớp bạn đang học sẽ được đánh dấu.</p>
              </div>

              {openSections.length === 0 ? (
                <Card>
                  <EmptyState compact illustration="waiting" icon={<Hourglass className="h-6 w-6" />} title="Chưa có lớp mở" description="Gửi yêu cầu để MCNA mở lớp mới cho khóa học này." action={<Button variant="secondary" loading={requesting} onClick={requestNewSection}>Yêu cầu mở lớp</Button>} />
                </Card>
              ) : (
                openSections.map(section => {
                  const taken = seatCount(section);
                  const seatsLeft = Math.max(0, section.maxStudents - taken);
                  const isFull = taken >= section.maxStudents;
                  const conflict = findConflict(section, registeredSections.filter(other => other.courseId !== course.id));
                  const isMine = registeredSections.some(other => other.id === section.id);
                  const sectionTeacher = store.users.find(u => u.id === section.teacherId) || teacher;
                  const classSessions = (store.attendanceSessions || []).filter(s => s.sectionId === section.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  const expanded = expandedSectionId === section.id;

                  return (
                    <Card key={section.id} className="p-5 md:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">Lớp {section.sectionCode}</h3>
                            {isMine ? <Badge tone="primary">Lớp của bạn</Badge> : isFull ? <Badge tone="danger">Đã đủ học viên</Badge> : <Badge tone={seatsLeft <= 3 ? "warning" : "success"} dot>Còn {seatsLeft} chỗ</Badge>}
                          </div>
                          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Khai giảng {formatDate(section.openingDate, "đang cập nhật")}</span>
                            <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> {instructorName(sectionTeacher)}</span>
                          </p>
                        </div>
                        {!enrollment && (
                          <Button
                            className="w-full sm:w-auto"
                            disabled={isFull || Boolean(conflict)}
                            onClick={() => onEnroll(course.id, section.id)}
                            iconRight={!isFull && !conflict ? <ArrowRight className="h-4 w-4" /> : undefined}
                          >
                            {isFull ? "Lớp đã đầy" : course.price ? `Đăng ký · ${formatPrice(course.price)}` : "Đăng ký miễn phí"}
                          </Button>
                        )}
                      </div>

                      {conflict && !enrollment && (
                        <Callout tone="warning" className="mt-4" icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}>
                          Trùng lịch với lớp <strong>{conflict}</strong> bạn đang học.
                        </Callout>
                      )}

                      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                        {(section.schedule || []).map((slot, index) => (
                          <li key={index} className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3">
                            <span className="w-[4.5rem] shrink-0 text-sm font-bold text-slate-900">{slot.dayOfWeek}</span>
                            <span className="text-sm font-medium text-slate-700">{slot.startTime} – {slot.endTime}</span>
                            <span className="ml-auto inline-flex min-w-0 items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{slot.room || "Online"}</span>
                          </li>
                        ))}
                      </ul>

                      {classSessions.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <button type="button" onClick={() => setExpandedSectionId(expanded ? null : section.id)} aria-expanded={expanded} className="inline-flex h-9 items-center gap-1.5 px-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                            <ChevronDown className={cx("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                            {expanded ? "Ẩn lịch từng buổi" : `Xem lịch ${classSessions.length} buổi học`}
                          </button>
                          {expanded && (
                            <ol className="mt-2 divide-y divide-slate-100">
                              {classSessions.map((session, index) => (
                                <li key={session.id} className="flex items-center gap-3 py-2.5 text-sm">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">{index + 1}</span>
                                  <span className="min-w-0 flex-1 truncate text-slate-700">{session.topic}</span>
                                  {session.date && <span className="shrink-0 text-xs text-slate-500">{formatDate(session.date)}</span>}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}

              {allFull && !enrollment && (
                <Callout tone="info" title="Các lớp hiện đã đầy" action={<Button size="sm" variant="secondary" loading={requesting} onClick={requestNewSection}>Yêu cầu mở lớp</Button>}>
                  Gửi yêu cầu để MCNA mở thêm lớp mới.
                </Callout>
              )}
            </section>

            {lessons.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Bạn sẽ học gì</h2>
                <Card as="ol" className="overflow-hidden">
                  {lessons.map((lesson, index) => (
                    <li key={lesson.id} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-bold text-slate-600">{index + 1}</span>
                      <span className="min-w-0 flex-1 text-[15px] font-medium text-slate-800">{lesson.title.replace(/^\d+\.\s*/, "")}</span>
                      {lesson.duration && <span className="shrink-0 text-xs text-slate-500">{lesson.duration.replace("mins", "phút")}</span>}
                    </li>
                  ))}
                </Card>
              </section>
            )}
          </div>

          <aside className="order-first lg:order-none">
            <Card className="overflow-hidden lg:sticky lg:top-10">
              <CourseCover src={course.thumbnail} title={course.title} category={course.category} className="aspect-[16/10] w-full" iconSize="h-12 w-12" />
              <div className="space-y-4 p-5">
                <p className="font-display text-[28px] font-bold tracking-tight text-slate-900">{formatPrice(course.price)}</p>
                {enrollmentPanel || (
                  <p className="text-[13px] leading-relaxed text-slate-500">
                    Chọn một lớp bên dưới để đăng ký. MCNA sẽ xác nhận{course.price ? " học phí," : ""} xếp lớp và báo bạn khi có thể vào học.
                  </p>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- Catalog grid */
  return (
    <div className="space-y-6">
      <PageHeader title="Khám phá" subtitle="Tìm khóa học tiếp theo cho hành trình của bạn." />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Tìm khóa học…" className="md:max-w-sm md:flex-1" />
        <label className="inline-flex h-11 cursor-pointer items-center gap-3 self-start rounded-full bg-white px-4 text-sm font-medium text-slate-700 shadow-card ring-1 ring-slate-200/70 md:self-auto">
          <input type="checkbox" checked={hideConflicts} onChange={e => setHideConflicts(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-indigo-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500" />
          Ẩn lớp trùng lịch
        </label>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {["all", ...categories].map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-semibold", category === item ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-card ring-1 ring-slate-200/70 hover:text-slate-900")}
          >
            {item === "all" ? "Tất cả" : item}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState illustration="search" icon={<Search className="h-6 w-6" />} title="Không tìm thấy khóa học" description="Thử từ khóa khác hoặc bỏ bớt bộ lọc." action={<Button variant="secondary" onClick={() => { setSearch(""); setCategory("all"); setHideConflicts(false); }}>Xóa bộ lọc</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, visibleCount).map(course => {
              const enrollment = enrollmentFor(course.id);
              const openCount = sections.filter(section => section.courseId === course.id && section.status === "open").length;
              const status = enrollment
                ? <Badge tone={ENROLLMENT_STATUS[enrollment.status]?.tone || "neutral"}><CheckCircle2 className="h-3.5 w-3.5" /> {ENROLLMENT_STATUS[enrollment.status]?.label || "Đã đăng ký"}</Badge>
                : openCount > 0 ? <Badge tone="success" dot>{openCount} lớp đang mở</Badge> : <Badge tone="warning" dot>Sắp khai giảng</Badge>;
              return (
                <CourseCard
                  key={course.id}
                  title={course.title}
                  category={course.category}
                  level={course.level}
                  description={course.description}
                  thumbnail={course.thumbnail}
                  price={course.price}
                  originalPrice={course.originalPrice}
                  status={status}
                  onOpen={() => { setViewingCourseId(course.id); window.scrollTo({ top: 0 }); }}
                />
              );
            })}
          </div>
          {filtered.length > visibleCount && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisibleCount(count => count + PAGE_SIZE)} iconRight={<ChevronDown className="h-4 w-4" />}>
                Xem thêm {Math.min(PAGE_SIZE, filtered.length - visibleCount)} khóa học
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
