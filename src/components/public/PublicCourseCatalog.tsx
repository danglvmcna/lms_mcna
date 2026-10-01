import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock, GraduationCap, Laptop, Link2, MapPin, MessageCircle, Search, UserRound } from "lucide-react";
import { api } from "../../api";
import { EnrollIntent } from "../../enrollIntent";
import { PublicCourseDetail, PublicCourseSummary, SalesMode } from "../../types";
import { phoneDigits } from "../../appConfig";
import LinkedText from "../LinkedText";
import CourseCard from "../common/CourseCard";
import { instructorName } from "../student/studentDisplay";
import { formatDate, formatPrice, formatVnd } from "../../lib/format";
import { Badge, BrandLockup, Button, buttonClass, Callout, CourseCover, cx, EmptyState, hasIllustration, Illustration, SearchField, Skeleton } from "../ui";

interface PublicCourseCatalogProps {
  initialCourseId?: string;
  // direct: the catalogue is a showcase and enrollment goes through MCNA's advisers; self_service: visitors sign up here.
  salesMode?: SalesMode;
  supportPhone?: string;
  onLogin: () => void;
  onRegister: (intent?: EnrollIntent) => void;
}

// Keeps ?course=<id> in the address bar so a course page can be shared.
function syncCourseParam(courseId: string | null) {
  const url = new URL(window.location.href);
  if (courseId) url.searchParams.set("course", courseId);
  else url.searchParams.delete("course");
  window.history.replaceState(null, "", url.toString());
}

const PAGE_SIZE = 9;

const STEPS = [
  { title: "Chọn lớp phù hợp", text: "Xem lịch từng lớp và chọn khung giờ hợp với bạn." },
  { title: "Tạo tài khoản", text: "Chỉ cần họ tên, email và số điện thoại. Mật khẩu gửi qua email." },
  { title: "Vào học", text: "MCNA xác nhận, mở lớp và bạn học trực tiếp cùng giảng viên." }
];

function PublicCard({ course, onOpen }: { course: PublicCourseSummary; onOpen: () => void }) {
  return (
    <CourseCard
      title={course.title}
      category={course.category}
      level={course.level}
      description={course.description}
      thumbnail={course.thumbnail}
      price={course.price}
      originalPrice={course.originalPrice}
      onOpen={onOpen}
      status={course.openSectionCount > 0 ? <Badge tone="success" dot>{course.openSectionCount} lớp đang mở</Badge> : <Badge tone="warning" dot>Sắp khai giảng</Badge>}
    />
  );
}

/** Landing page for visitors: published courses, their open classes and session schedule. */
export default function PublicCourseCatalog({ initialCourseId, salesMode = "self_service", supportPhone = "", onLogin, onRegister }: PublicCourseCatalogProps) {
  const isDirectSale = salesMode === "direct";
  const adviserUrl = `https://zalo.me/${phoneDigits(supportPhone)}`;
  const [courses, setCourses] = useState<PublicCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId || null);
  const [detail, setDetail] = useState<PublicCourseDetail | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const courseDetailCache = useRef<Map<string, PublicCourseDetail>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const classesRef = useRef<HTMLElement>(null);

  const copyCourseLink = (courseId: string) => {
    const url = `${window.location.origin}/?course=${encodeURIComponent(courseId)}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getPublicCourses()
      .then(setCourses)
      .catch((err: any) => setError(err.message || "Không tải được danh sách khóa học."))
      .finally(() => setLoading(false));
  }, [retryTrigger]);

  useEffect(() => {
    syncCourseParam(selectedCourseId);
    setExpandedSectionId(null);
    if (!selectedCourseId) {
      setDetail(null);
      return;
    }
    const cached = courseDetailCache.current.get(selectedCourseId);
    setDetail(cached || null);

    let cancelled = false;
    api.getPublicCourse(selectedCourseId)
      .then(result => {
        if (cancelled) return;
        courseDetailCache.current.set(selectedCourseId, result);
        setDetail(result);
      })
      .catch((err: any) => {
        if (cancelled || cached) return;
        setError(err.message || "Không tìm thấy khóa học.");
        setSelectedCourseId(null);
      });
    window.scrollTo({ top: 0 });
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  const categories = useMemo(() => Array.from(new Set(courses.map(course => course.category).filter(Boolean))).sort(), [courses]);

  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return courses
      .filter(course => {
        if (category !== "all" && course.category !== category) return false;
        if (!keyword) return true;
        return [course.title, course.description, course.teacherName, ...(course.tags || [])].some(value => String(value || "").toLowerCase().includes(keyword));
      })
      .sort((a, b) => Number(b.openSectionCount > 0) - Number(a.openSectionCount > 0));
  }, [courses, search, category]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [search, category]);

  const openClassCount = useMemo(() => courses.reduce((sum, course) => sum + (course.openSectionCount || 0), 0), [courses]);
  const heroHasMascot = hasIllustration("welcome");

  const renderLanding = () => (
    <>
      <section className="bg-aurora">
        <div className={cx("mx-auto max-w-6xl px-5 pb-14 pt-12 sm:px-8 md:pb-20 md:pt-20", heroHasMascot && "grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]")}>
          <div className={cx("space-y-7", !heroHasMascot && "mx-auto max-w-3xl text-center")}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-card ring-1 ring-slate-200/70 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {openClassCount > 0 ? `${openClassCount} lớp đang nhận học viên` : "Lớp mới khai giảng liên tục"}
            </span>
            <h1 className="text-[40px] font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Học công nghệ
              <br />
              <span className="text-brand-gradient">dễ hiểu và thú vị.</span>
            </h1>
            <p className={cx("text-[17px] leading-relaxed text-slate-600 md:text-lg", !heroHasMascot && "mx-auto max-w-2xl")}>
              Lập trình, dữ liệu và AI cho học sinh, sinh viên và người đi làm. Học trực tuyến cùng giảng viên, tài liệu có sẵn sau mỗi buổi.
            </p>
            <div className={cx("flex max-w-xl flex-col gap-3 sm:flex-row", !heroHasMascot && "mx-auto")}>
              <SearchField value={search} onChange={setSearch} placeholder="Bạn muốn học gì? Ví dụ: Python" className="flex-1" />
              <Button size="md" onClick={() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} iconRight={<ArrowRight className="h-4 w-4" />}>
                Xem khóa học
              </Button>
            </div>
            <ul className={cx("flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600", !heroHasMascot && "justify-center")}>
              <li className="flex items-center gap-2"><Laptop className="h-4 w-4 text-indigo-500" /> Học online qua Zoom</li>
              <li className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-indigo-500" /> Giảng viên đồng hành</li>
              <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-indigo-500" /> Nhóm lớp hỏi đáp</li>
            </ul>
          </div>
          {heroHasMascot && <Illustration name="welcome" eager className="mx-auto hidden h-[380px] w-auto lg:block" />}
        </div>
      </section>

      <section ref={gridRef} className="mx-auto max-w-6xl scroll-mt-20 space-y-6 px-5 py-12 sm:px-8 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">Khóa học</h2>
            <p className="mt-1 text-[15px] text-slate-500">{loading ? "Đang tải…" : `${filteredCourses.length} khóa học${search || category !== "all" ? " phù hợp" : ""}`}</p>
          </div>
        </div>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {["all", ...categories].map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cx(
                "h-10 shrink-0 rounded-full px-4 text-sm font-semibold",
                category === item ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-card ring-1 ring-slate-200/70 hover:text-slate-900"
              )}
            >
              {item === "all" ? "Tất cả" : item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(index => <Skeleton key={index} className="h-[360px] rounded-[1.5rem]" />)}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white shadow-card ring-1 ring-slate-200/70">
            <EmptyState
              illustration="search"
              icon={<Search className="h-6 w-6" />}
              title={courses.length === 0 ? "Chưa có khóa học mở đăng ký" : "Không tìm thấy khóa học phù hợp"}
              description={courses.length === 0 ? "Các lớp mới sẽ sớm được công bố. Quay lại sau nhé!" : "Thử từ khóa khác hoặc chọn lĩnh vực “Tất cả”."}
              action={courses.length > 0 ? <Button variant="secondary" onClick={() => { setSearch(""); setCategory("all"); }}>Xóa bộ lọc</Button> : undefined}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.slice(0, visibleCount).map(course => <PublicCard key={course.id} course={course} onOpen={() => setSelectedCourseId(course.id)} />)}
            </div>
            {filteredCourses.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" onClick={() => setVisibleCount(count => count + PAGE_SIZE)} iconRight={<ChevronDown className="h-4 w-4" />}>
                  Xem thêm {Math.min(PAGE_SIZE, filteredCourses.length - visibleCount)} khóa học
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl space-y-8 px-5 py-14 sm:px-8 md:py-20">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">Bắt đầu chỉ với 3 bước</h2>
            <p className="mt-2 text-[15px] text-slate-500">Không cần kinh nghiệm. MCNA hỗ trợ bạn từ lúc chọn lớp đến buổi học đầu tiên.</p>
          </div>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(isDirectSale ? [
              { title: "Chọn khóa phù hợp", text: "Nhắn MCNA để được tư vấn khóa học và lịch lớp phù hợp." },
              { title: "Xác nhận đăng ký", text: "MCNA xác nhận thanh toán và gửi tài khoản qua email." },
              { title: "Được xếp lớp", text: "Quản lý lớp gửi lịch học, nhóm Zalo và tài liệu cho bạn." }
            ] : STEPS).map((step, index) => (
              <li key={step.title} className="rounded-[1.5rem] bg-canvas p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 font-display text-base font-bold text-white">{index + 1}</span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isDirectSale && <Button size="lg" onClick={() => onRegister()}>Tạo tài khoản miễn phí</Button>}
            <a href={adviserUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "lg" })}>
              <MessageCircle className="h-5 w-5 text-blue-600" /> Nhắn tư vấn qua Zalo
            </a>
          </div>
        </div>
      </section>
    </>
  );

  const renderCourseDetail = () => {
    if (!detail || !detail.course) {
      return (
        <div className="mx-auto max-w-6xl space-y-6 px-5 py-10 sm:px-8">
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
            <Skeleton className="h-[420px]" />
          </div>
        </div>
      );
    }
    const { course } = detail;
    const sections = Array.isArray(detail.sections) ? detail.sections : [];
    const lessons = Array.isArray(detail.lessons) ? detail.lessons : [];
    const hasDiscount = Boolean(course.originalPrice && course.originalPrice > course.price);
    const earliestOpening = sections.map(section => section.openingDate).filter(Boolean).sort()[0] || course.openingDate;
    const sessionCount = course.numberOfLessons || sections.find(section => section.numberOfSessions)?.numberOfSessions || lessons.length;
    const scrollToClasses = () => classesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    const facts = [
      { icon: UserRound, label: "Giảng viên", value: instructorName({ name: course.teacherName }) },
      { icon: Clock, label: "Thời lượng", value: sessionCount ? `${sessionCount} buổi` : "Đang cập nhật" },
      { icon: CalendarDays, label: "Khai giảng", value: earliestOpening ? formatDate(earliestOpening) : "Đang cập nhật" },
      { icon: Laptop, label: "Hình thức", value: "Trực tuyến" }
    ];

    return (
      <div className="mx-auto max-w-6xl px-5 pb-32 pt-6 sm:px-8 lg:pb-20 lg:pt-10">
        <button type="button" onClick={() => setSelectedCourseId(null)} className="-ml-2 mb-6 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          <ArrowLeft className="h-4 w-4" /> Tất cả khóa học
        </button>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-10">
            <section className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {course.category && <Badge tone="primary">{course.category}</Badge>}
                {course.level && <Badge>{course.level}</Badge>}
              </div>
              <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-slate-900 md:text-[44px]">{course.title}</h1>
              <div className="text-[16px] leading-relaxed text-slate-600 whitespace-pre-line md:text-[17px]">
                <LinkedText text={course.description || ""} />
              </div>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
                    <Icon className="h-5 w-5 text-indigo-500" />
                    <dt className="mt-3 text-xs font-medium text-slate-500">{label}</dt>
                    <dd className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section ref={classesRef} className="scroll-mt-24 space-y-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Chọn lớp học</h2>
                <p className="mt-1 text-[15px] text-slate-500">Mỗi lớp có lịch cố định trong tuần. Chọn lớp hợp với thời gian của bạn.</p>
              </div>
              {sections.length === 0 ? (
                <div className="rounded-[1.5rem] bg-white shadow-card ring-1 ring-slate-200/70">
                  <EmptyState compact illustration="waiting" icon={<CalendarDays className="h-6 w-6" />} title="Lớp mới sắp mở" description="Khóa học chưa có lớp nhận đăng ký. Nhắn MCNA để được báo khi có lớp mới." action={<a href="https://zalo.me/0939866825" target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>Nhắn MCNA qua Zalo</a>} />
                </div>
              ) : (
                sections.map(section => {
                  const sessionsList = Array.isArray(section.sessions) ? section.sessions : [];
                  const scheduleList = Array.isArray(section.schedule) ? section.schedule : [];
                  const maxStudents = typeof section.maxStudents === "number" ? section.maxStudents : 0;
                  const seatsLeft = typeof section.seatsLeft === "number" ? section.seatsLeft : maxStudents;
                  const isFull = maxStudents > 0 ? seatsLeft <= 0 : false;
                  const almostFull = !isFull && maxStudents > 0 && seatsLeft <= Math.max(3, Math.round(maxStudents * 0.15));
                  const sectionSessions = section.numberOfSessions || sessionsList.length;
                  const isExpanded = expandedSectionId === section.id;

                  return (
                    <article key={section.id} className="rounded-[1.5rem] bg-white p-5 shadow-card ring-1 ring-slate-200/70 md:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">Lớp {section.sectionCode}</h3>
                            {isFull ? <Badge tone="danger">Đã đủ học viên</Badge> : almostFull ? <Badge tone="warning" dot>Còn {seatsLeft} chỗ</Badge> : <Badge tone="success" dot>Còn {seatsLeft} chỗ</Badge>}
                          </div>
                          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Khai giảng {formatDate(section.openingDate, "đang cập nhật")}</span>
                            <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> {section.teacherName ? instructorName({ name: section.teacherName }) : "Giảng viên MCNA"}</span>
                            {sectionSessions > 0 && <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {sectionSessions} buổi</span>}
                          </p>
                        </div>
                        {isDirectSale ? <a href={adviserUrl} target="_blank" rel="noreferrer" className={buttonClass({variant:"secondary"})}>Liên hệ tư vấn</a> : <Button
                          disabled={isFull}
                          onClick={() => onRegister({ courseId: course.id, sectionId: section.id, courseTitle: course.title, sectionCode: section.sectionCode })}
                          iconRight={!isFull ? <ArrowRight className="h-4 w-4" /> : undefined}
                          className="w-full sm:w-auto"
                        >
                          {isFull ? "Lớp đã đầy" : "Đăng ký lớp này"}
                        </Button>}
                      </div>

                      {scheduleList.length > 0 && (
                        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {scheduleList.map((slot, index) => (
                            <li key={index} className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3">
                              <span className="w-[4.5rem] shrink-0 text-sm font-bold text-slate-900">{slot.dayOfWeek}</span>
                              <span className="text-sm font-medium text-slate-700">{slot.startTime} – {slot.endTime}</span>
                              <span className="ml-auto inline-flex min-w-0 items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{slot.room || "Online"}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {sessionsList.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <button type="button" onClick={() => setExpandedSectionId(isExpanded ? null : section.id)} aria-expanded={isExpanded} className="inline-flex h-9 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                            <ChevronDown className={cx("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                            {isExpanded ? "Ẩn lịch từng buổi" : `Xem lịch ${sessionsList.length} buổi học`}
                          </button>
                          {isExpanded && (
                            <ol className="mt-2 divide-y divide-slate-100">
                              {sessionsList.map((session, index) => (
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
                    </article>
                  );
                })
              )}
            </section>

            {lessons.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bạn sẽ học gì</h2>
                <ol className="overflow-hidden rounded-[1.5rem] bg-white shadow-card ring-1 ring-slate-200/70">
                  {lessons.map((lesson, idx) => (
                    <li key={lesson.id || idx} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-bold text-slate-600">{idx + 1}</span>
                      <span className="min-w-0 flex-1 text-[15px] font-medium text-slate-800">{lesson.title.replace(/^\d+\.\s*/, "")}</span>
                      {lesson.duration && <span className="shrink-0 text-xs text-slate-500">{lesson.duration.replace("mins", "phút")}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 overflow-hidden rounded-[1.5rem] bg-white shadow-raised ring-1 ring-slate-200/70">
              <CourseCover src={course.thumbnail} title={course.title} category={course.category} className="aspect-[16/10] w-full" iconSize="h-12 w-12" />
              <div className="space-y-5 p-6">
                <div>
                  {hasDiscount && <p className="text-sm text-slate-500 line-through">{formatVnd(course.originalPrice!)}</p>}
                  <p className="font-display text-3xl font-bold tracking-tight text-slate-900">{formatPrice(course.price)}</p>
                </div>
                <Button block size="lg" onClick={scrollToClasses} disabled={sections.length === 0}>
                  {sections.length === 0 ? "Chưa có lớp mở" : isDirectSale ? "Xem lịch lớp" : "Chọn lớp để đăng ký"}
                </Button>
                <p className="text-[13px] leading-relaxed text-slate-500">
                  {isDirectSale ? "Liên hệ MCNA để xác nhận đăng ký. Tài khoản, lịch và tài liệu được gửi sau khi xếp lớp." : `Sau khi đăng ký, MCNA sẽ xác nhận${course.price > 0 ? " học phí," : ""} xếp lớp và gửi thông báo khi bạn có thể vào học.`}
                </p>
                <button type="button" onClick={() => copyCourseLink(course.id)} className="flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold text-slate-600 hover:bg-slate-900/5 hover:text-slate-900">
                  {copied ? <><Check className="h-4 w-4 text-emerald-600" /> Đã sao chép liên kết</> : <><Link2 className="h-4 w-4" /> Chia sẻ khóa học</>}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile purchase bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 surface-glass lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Học phí</p>
              <p className="truncate text-lg font-bold text-slate-900">{formatPrice(course.price)}</p>
            </div>
            <Button onClick={scrollToClasses} disabled={sections.length === 0}>{sections.length === 0 ? "Chưa có lớp" : "Chọn lớp"}</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-canvas text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 surface-glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <button type="button" onClick={() => setSelectedCourseId(null)} aria-label="Trang chủ MCNA" className="rounded-xl">
            <span className="block sm:hidden"><BrandLockup compact /></span>
            <span className="hidden sm:block"><BrandLockup /></span>
          </button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onLogin}>Đăng nhập</Button>
            {!isDirectSale && <Button size="sm" onClick={() => onRegister()}>Tạo tài khoản</Button>}
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-6xl px-5 pt-4 sm:px-8">
          <Callout tone="danger" title={error} action={<div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setRetryTrigger(n => n + 1)}>Thử lại</Button><Button size="sm" variant="ghost" onClick={() => setError(null)}>Đóng</Button></div>} />
        </div>
      )}

      {selectedCourseId ? renderCourseDetail() : renderLanding()}

      {!selectedCourseId && (
        <footer className="border-t border-slate-200/70 bg-canvas">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <BrandLockup />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="https://mcna.vn" target="_blank" rel="noreferrer" className="hover:text-slate-900">mcna.vn</a>
              <a href="https://zalo.me/0939866825" target="_blank" rel="noreferrer" className="hover:text-slate-900">Zalo 0939 866 825</a>
              <span>© {new Date().getFullYear()} MCNA Technology School</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
