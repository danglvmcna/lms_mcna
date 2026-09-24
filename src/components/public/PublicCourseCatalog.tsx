import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Calendar, Check, ChevronDown, Clock, MapPin, Search, Share2, User as UserIcon, Users } from "lucide-react";
import { api } from "../../api";
import { EnrollIntent } from "../../enrollIntent";
import { PublicCourseDetail, PublicCourseSummary } from "../../types";
import LinkedText from "../LinkedText";
import { instructorName } from "../student/studentDisplay";

interface PublicCourseCatalogProps {
  initialCourseId?: string;
  onLogin: () => void;
  onRegister: (intent?: EnrollIntent) => void;
}

const formatPrice = (price: number) => (price > 0 ? `${new Intl.NumberFormat("vi-VN").format(price)} đ` : "Miễn phí");

const formatDate = (value?: string) => {
  if (!value) return "Chưa xác định";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
};

// Keeps ?course=<id> in the address bar so a course page can be shared.
function syncCourseParam(courseId: string | null) {
  const url = new URL(window.location.href);
  if (courseId) url.searchParams.set("course", courseId);
  else url.searchParams.delete("course");
  window.history.replaceState(null, "", url.toString());
}

/** Landing page for visitors: published courses, their open classes and session schedule. */
export default function PublicCourseCatalog({ initialCourseId, onLogin, onRegister }: PublicCourseCatalogProps) {
  const [courses, setCourses] = useState<PublicCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId || null);
  const [detail, setDetail] = useState<PublicCourseDetail | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [copiedCourseId, setCopiedCourseId] = useState<string | null>(null);

  const handleCopyCourseLink = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?course=${encodeURIComponent(courseId)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCourseId(courseId);
      setTimeout(() => setCopiedCourseId(null), 2500);
    });
  };

  const courseDetailCache = useRef<Map<string, PublicCourseDetail>>(new Map());

  const [retryTrigger, setRetryTrigger] = useState(0);

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
    if (cached) {
      setDetail(cached);
    } else {
      setDetail(null);
    }

    let cancelled = false;
    api.getPublicCourse(selectedCourseId)
      .then(result => {
        if (!cancelled) {
          courseDetailCache.current.set(selectedCourseId, result);
          setDetail(result);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        if (!cached) {
          setError(err.message || "Không tìm thấy khóa học.");
          setSelectedCourseId(null);
        }
      });
    window.scrollTo({ top: 0 });
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  const categories = useMemo(() => Array.from(new Set(courses.map(course => course.category).filter(Boolean))).sort(), [courses]);

  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return courses.filter(course => {
      if (category !== "all" && course.category !== category) return false;
      if (!keyword) return true;
      return [course.title, course.description, course.teacherName].some(value => String(value || "").toLowerCase().includes(keyword));
    });
  }, [courses, search, category]);

  const renderCourseList = () => (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold leading-tight text-slate-900">Khóa học đang mở đăng ký</h1>
        <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
          Chọn một khóa học để xem các lớp, lịch từng buổi học và đăng ký. Tài khoản học viên được tạo bằng email cá nhân; mật khẩu đăng nhập được gửi về email của bạn.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên khóa học, giảng viên..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 text-slate-900 shadow-2xs"
          />
        </label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="sm:w-56 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 text-slate-900 shadow-2xs cursor-pointer"
        >
          <option value="all">Tất cả lĩnh vực</option>
          {categories.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(index => (
            <div key={index} className="h-72 rounded-2xl bg-white border border-slate-200/80 animate-pulse shadow-xs" />
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
          {courses.length === 0 ? "Hiện chưa có khóa học nào mở đăng ký." : "Không có khóa học phù hợp với bộ lọc."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map(course => (
            <button
              key={course.id}
              type="button"
              onClick={() => setSelectedCourseId(course.id)}
              className="text-left bg-white border border-slate-200/80 hover:border-indigo-300 hover:-translate-y-1 hover:shadow-md rounded-2xl overflow-hidden flex flex-col transition-all duration-300 cursor-pointer group shadow-xs"
            >
              <div className="aspect-video w-full max-w-full bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <BookOpen className="h-10 w-10 text-slate-400" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-wider shadow-2xs">{course.category}</span>
                  {course.level && <span className="px-2.5 py-1 rounded-full border border-slate-200 bg-white/90 text-[9px] font-bold text-slate-700 backdrop-blur-xs">{course.level}</span>}
                </div>
                <button
                  type="button"
                  title="Sao chép liên kết chia sẻ"
                  onClick={(e) => handleCopyCourseLink(e, course.id)}
                  className="absolute right-3 top-3 p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 shadow-2xs backdrop-blur-xs transition z-10 cursor-pointer"
                >
                  {copiedCourseId === course.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <span className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[9px] font-bold shadow-2xs ${course.openSectionCount > 0 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
                  {course.openSectionCount > 0 ? "Đang mở ghi danh" : "Sắp khai giảng"}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2.5 flex-1">
                <h3 className="font-bold text-base leading-snug group-hover:text-indigo-600 text-slate-900 transition-colors">{course.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{course.description}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5 min-w-0"><UserIcon className="h-3.5 w-3.5 text-indigo-500 shrink-0" /><span className="truncate">{instructorName({ name: course.teacherName })}</span></span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />{course.numberOfLessons || "—"} buổi</span>
                  <span className="col-span-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0" />{course.openingDate ? `Khai giảng ${formatDate(course.openingDate)}` : "Lịch khai giảng đang cập nhật"}</span>
                </div>
                <div className="mt-auto pt-3 flex items-center justify-between gap-2 text-xs border-t border-slate-100">
                  <div className="flex flex-col">
                    {course.originalPrice && course.originalPrice > course.price ? (
                      <span className="text-[10px] text-slate-400 line-through font-mono">{formatPrice(course.originalPrice)}</span>
                    ) : null}
                    <span className="font-bold text-emerald-600 text-sm font-mono">{formatPrice(course.price)}</span>
                  </div>
                  <span className="text-slate-500 font-medium">{course.openSectionCount > 0 ? `${course.openSectionCount} lớp đang mở` : "Chưa mở lớp"}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const renderCourseDetail = () => {
    if (!detail || !detail.course) {
      return (
        <div className="py-24 text-center text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
          Đang tải thông tin khóa học...
        </div>
      );
    }
    const { course } = detail;
    const sections = Array.isArray(detail.sections) ? detail.sections : [];
    const lessons = Array.isArray(detail.lessons) ? detail.lessons : [];

    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedCourseId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer transition"
          >
            <ArrowLeft className="h-4 w-4" /> Tất cả khóa học
          </button>
          <button
            type="button"
            onClick={(e) => handleCopyCourseLink(e, course.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            {copiedCourseId === course.id ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Đã sao chép link</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Chia sẻ khóa học</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              {course.category && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{course.category}</span>
              )}
              {course.level && (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{course.level}</span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold leading-tight text-slate-900">{course.title}</h1>
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              <LinkedText text={course.description || ""} />
            </div>

            {lessons.length > 0 && (
              <div className="mt-6 bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs">
                <h3 className="text-base font-bold flex items-center gap-2 text-slate-900">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  Đề cương &amp; Nội dung khóa học ({lessons.length} bài)
                </h3>
                <div className="divide-y divide-slate-100">
                  {lessons.map((lesson, idx) => (
                    <div key={lesson.id || idx} className="py-2.5 flex items-start gap-3 text-xs">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{lesson.title}</p>
                        {(lesson as any).content && (
                          <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">{(lesson as any).content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 h-fit text-sm overflow-hidden shadow-xs">
            {course.thumbnail && (
              <div className="aspect-video -mx-5 -mt-5 mb-4 overflow-hidden border-b border-slate-200 bg-slate-100">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Học phí</span>
              <div className="text-right">
                {course.originalPrice && course.originalPrice > course.price && (
                  <span className="text-xs text-slate-400 line-through block font-mono">
                    {formatPrice(course.originalPrice)}
                  </span>
                )}
                <span className="font-extrabold text-emerald-600 text-lg font-mono">
                  {formatPrice(course.price || 0)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Giảng viên</span>
              <span className="font-semibold text-slate-800 text-right">{instructorName({ name: course.teacherName })}</span>
            </div>
            {course.numberOfLessons ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Số buổi</span>
                <span className="font-semibold text-slate-800">{course.numberOfLessons} buổi</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Lớp đang mở</span>
              <span className="font-semibold text-slate-800">{sections.length}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
              Chọn một lớp bên dưới để đăng ký. Sau khi đăng ký, học viện sẽ xác nhận{course.price && course.price > 0 ? " thanh toán và" : ""} xếp lớp rồi kích hoạt khóa học ngay.
            </p>
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={(e) => handleCopyCourseLink(e, course.id)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
              >
                {copiedCourseId === course.id ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Đã sao chép liên kết khóa học!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 text-indigo-500" />
                    <span>Sao chép liên kết chia sẻ</span>
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Các lớp đang mở ({sections.length})</h2>
          {sections.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
              Khóa học chưa có lớp mở đăng ký. Vui lòng quay lại sau.
            </div>
          ) : (
            sections.map(section => {
              const sessionsList = Array.isArray(section.sessions) ? section.sessions : [];
              const scheduleList = Array.isArray(section.schedule) ? section.schedule : [];
              const maxStudents = typeof section.maxStudents === "number" ? section.maxStudents : 0;
              const seatsLeft = typeof section.seatsLeft === "number" ? section.seatsLeft : maxStudents;
              const isFull = maxStudents > 0 ? seatsLeft <= 0 : false;
              const sessionCount = section.numberOfSessions || sessionsList.length;
              const isExpanded = expandedSectionId === section.id;

              return (
                <div key={section.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-bold text-base text-slate-900">Lớp {section.sectionCode}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-indigo-500" /> Khai giảng {formatDate(section.openingDate)}</span>
                        <span className="inline-flex items-center gap-1"><UserIcon className="h-3.5 w-3.5 text-indigo-500" /> {section.teacherName ? instructorName({ name: section.teacherName }) : "Chưa phân công"}</span>
                        <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-indigo-500" /> {sessionCount > 0 ? `${sessionCount} buổi` : "Đang cập nhật"}</span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${isFull ? "text-rose-600" : "text-emerald-600"}`}>
                          <Users className="h-3.5 w-3.5" /> {isFull ? "Đã đủ học viên" : typeof section.seatsLeft === "number" ? `Còn ${seatsLeft}/${maxStudents} chỗ` : `${maxStudents} chỗ`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isFull}
                      onClick={() => onRegister({ courseId: course.id, sectionId: section.id, courseTitle: course.title, sectionCode: section.sectionCode })}
                      className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      {isFull ? "Lớp đã đầy" : <>Đăng ký lớp này <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>

                  {scheduleList.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {scheduleList.map((slot, index) => (
                        <span key={index} className="inline-flex flex-wrap items-center gap-1.5 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700">
                          <Clock className="h-3.5 w-3.5 text-indigo-600" /> {slot.dayOfWeek} {slot.startTime}–{slot.endTime}
                          <MapPin className="h-3.5 w-3.5 text-indigo-600 ml-1" /> {slot.room || "Online"}
                        </span>
                      ))}
                    </div>
                  )}

                  {sessionsList.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Ẩn lịch buổi học" : `Xem lịch ${sessionsList.length} buổi học`}
                      </button>
                      {isExpanded && (
                        <ol className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {sessionsList.map(session => (
                            <li key={session.id} className="text-xs bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 flex items-center justify-between gap-2 min-w-0 text-slate-700">
                              <span className="truncate">{session.topic}</span>
                              {session.date && <span className="shrink-0 text-slate-400 font-mono">{formatDate(session.date)}</span>}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative z-20 font-sans">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setSelectedCourseId(null)} className="flex items-center gap-3 sm:gap-4 min-w-0 cursor-pointer text-left group">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
              <img src="/mcna-logo.png" alt="MCNA Technology School" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-display font-extrabold tracking-wider uppercase text-base sm:text-lg md:text-xl leading-tight truncate text-slate-900">MCNA LMS</span>
              <span className="text-[10px] sm:text-[11px] md:text-xs text-indigo-600 font-bold tracking-wider uppercase truncate">Học Viện Công Nghệ MCNA</span>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onLogin} className="px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 cursor-pointer transition shadow-2xs">
              Đăng nhập
            </button>
            <button type="button" onClick={() => onRegister()} className="px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition">
              Tạo tài khoản
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
            <span>{error}</span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setRetryTrigger(prev => prev + 1)}
                className="font-bold underline hover:text-rose-900 cursor-pointer"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="font-bold cursor-pointer text-rose-500 hover:text-rose-700"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
        {selectedCourseId ? renderCourseDetail() : renderCourseList()}
      </main>
    </div>
  );
}
