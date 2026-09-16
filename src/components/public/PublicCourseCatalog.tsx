import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Calendar, ChevronDown, Clock, MapPin, Search, User as UserIcon, Users } from "lucide-react";
import { api } from "../../api";
import { EnrollIntent } from "../../enrollIntent";
import { PublicCourseDetail, PublicCourseSummary } from "../../types";
import LinkedText from "../LinkedText";

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
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
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
    setDetail(null);
    setExpandedSectionId(null);
    if (!selectedCourseId) return;
    let cancelled = false;
    api.getPublicCourse(selectedCourseId)
      .then(result => {
        if (!cancelled) setDetail(result);
      })
      .catch((err: any) => {
        if (cancelled) return;
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
    return courses.filter(course => {
      if (category !== "all" && course.category !== category) return false;
      if (!keyword) return true;
      return [course.title, course.description, course.teacherName].some(value => String(value || "").toLowerCase().includes(keyword));
    });
  }, [courses, search, category]);

  const renderCourseList = () => (
    <>
      <section className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold leading-tight">Khóa học đang mở đăng ký</h1>
        <p className="text-sm text-white/60 max-w-2xl leading-relaxed">
          Chọn một khóa học để xem các lớp, lịch từng buổi học và đăng ký. Tài khoản học viên được tạo bằng email cá nhân; mật khẩu đăng nhập được gửi về email của bạn.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên khóa học, giảng viên..."
            className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-indigo-400 placeholder-white/30"
          />
        </label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="sm:w-56 px-3 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
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
            <div key={index} className="h-72 rounded-2xl bg-slate-900 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-16 text-center text-sm text-white/50 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl">
          {courses.length === 0 ? "Hiện chưa có khóa học nào mở đăng ký." : "Không có khóa học phù hợp với bộ lọc."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map(course => (
            <button
              key={course.id}
              type="button"
              onClick={() => setSelectedCourseId(course.id)}
              className="text-left bg-slate-900 border border-white/10 hover:border-indigo-400/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-950/10 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 cursor-pointer group"
            >
              <div className="aspect-video w-full max-w-full bg-gradient-to-br from-indigo-600/40 to-slate-800 flex items-center justify-center overflow-hidden relative">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <BookOpen className="h-10 w-10 text-white/40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full border border-indigo-400/30 bg-indigo-600 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">{course.category}</span>
                  {course.level && <span className="px-2.5 py-1 rounded-full border border-white/20 bg-white/85 text-[9px] font-bold text-slate-800 backdrop-blur-md">{course.level}</span>}
                </div>
                <span className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[9px] font-bold shadow-sm ${course.openSectionCount > 0 ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-950"}`}>
                  {course.openSectionCount > 0 ? "Đang mở ghi danh" : "Sắp khai giảng"}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2.5 flex-1">
                <h3 className="font-bold text-base leading-snug group-hover:text-indigo-200">{course.title}</h3>
                <p className="text-xs text-white/55 line-clamp-2 leading-relaxed">{course.description}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-white/55 pt-1">
                  <span className="flex items-center gap-1.5 min-w-0"><UserIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0" /><span className="truncate">{course.teacherName || "MCNA"}</span></span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />{course.numberOfLessons || "—"} buổi</span>
                  <span className="col-span-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />{course.openingDate ? `Khai giảng ${formatDate(course.openingDate)}` : "Lịch khai giảng đang cập nhật"}</span>
                </div>
                <div className="mt-auto pt-3 flex items-center justify-between gap-2 text-xs border-t border-white/5">
                  <div className="flex flex-col">
                    {course.originalPrice && course.originalPrice > course.price ? (
                      <span className="text-[10px] text-white/40 line-through">{formatPrice(course.originalPrice)}</span>
                    ) : null}
                    <span className="font-bold text-emerald-400">{formatPrice(course.price)}</span>
                  </div>
                  <span className="text-white/50">{course.openSectionCount > 0 ? `${course.openSectionCount} lớp đang mở` : "Chưa mở lớp"}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const renderCourseDetail = () => {
    if (!detail) {
      return <div className="py-24 text-center text-sm text-white/50">Đang tải thông tin khóa học...</div>;
    }
    const { course, sections, lessons } = detail;
    return (
      <>
        <button
          type="button"
          onClick={() => setSelectedCourseId(null)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Tất cả khóa học
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">{course.category}</span>
              {course.level && <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/60">{course.level}</span>}
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold leading-tight">{course.title}</h1>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
              <LinkedText text={course.description} />
            </p>

            {lessons && lessons.length > 0 && (
              <div className="mt-6 bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                  Đề cương & Nội dung khóa học ({lessons.length} bài)
                </h3>
                <div className="divide-y divide-white/5">
                  {lessons.map((lesson, idx) => (
                    <div key={lesson.id} className="py-2.5 flex items-start gap-3 text-xs">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-300 font-mono font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white/90">{lesson.title}</p>
                        {lesson.content && (
                          <p className="text-white/50 text-[11px] mt-0.5 line-clamp-2">{lesson.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-3 h-fit text-sm overflow-hidden">
            {course.thumbnail && (
              <div className="aspect-video -mx-5 -mt-5 mb-4 overflow-hidden border-b border-white/10 bg-slate-950">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/50">Học phí</span>
              <div className="text-right">
                {course.originalPrice && course.originalPrice > course.price && (
                  <span className="text-xs text-white/40 line-through block font-mono">
                    {formatPrice(course.originalPrice)}
                  </span>
                )}
                <span className="font-extrabold text-emerald-400 text-lg">
                  {formatPrice(course.price)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/50">Giảng viên</span>
              <span className="font-semibold text-right">{course.teacherName || "Đang cập nhật"}</span>
            </div>
            {course.numberOfLessons ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/50">Số buổi</span>
                <span className="font-semibold">{course.numberOfLessons} buổi</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/50">Lớp đang mở</span>
              <span className="font-semibold">{sections.length}</span>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed pt-2 border-t border-white/5">
              Chọn một lớp bên dưới để đăng ký. Sau khi đăng ký, học viện sẽ xác nhận{course.price > 0 ? " thanh toán và" : ""} xếp lớp rồi kích hoạt khóa học ngay.
            </p>
          </aside>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Các lớp đang mở ({sections.length})</h2>
          {sections.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/50 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl">
              Khóa học chưa có lớp mở đăng ký. Vui lòng quay lại sau.
            </div>
          ) : (
            sections.map(section => {
              const isFull = section.seatsLeft <= 0;
              const isExpanded = expandedSectionId === section.id;
              return (
                <div key={section.id} className="bg-slate-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-extrabold text-base">Lớp {section.sectionCode}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Khai giảng {formatDate(section.openingDate)}</span>
                        <span className="inline-flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {section.teacherName || "Chưa phân công"}</span>
                        <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {section.numberOfSessions || section.sessions.length} buổi</span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${isFull ? "text-red-400" : "text-emerald-400"}`}>
                          <Users className="h-3.5 w-3.5" /> {isFull ? "Đã đủ học viên" : `Còn ${section.seatsLeft}/${section.maxStudents} chỗ`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isFull}
                      onClick={() => onRegister({ courseId: course.id, sectionId: section.id, courseTitle: course.title, sectionCode: section.sectionCode })}
                      className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      {isFull ? "Lớp đã đầy" : <>Đăng ký lớp này <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>

                  {section.schedule.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {section.schedule.map((slot, index) => (
                        <span key={index} className="inline-flex flex-wrap items-center gap-1.5 text-[11px] font-mono bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                          <Clock className="h-3.5 w-3.5 text-indigo-300" /> {slot.dayOfWeek} {slot.startTime}–{slot.endTime}
                          <MapPin className="h-3.5 w-3.5 text-indigo-300 ml-1" /> {slot.room || "Online"}
                        </span>
                      ))}
                    </div>
                  )}

                  {section.sessions.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                        className="text-xs font-bold text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Ẩn lịch buổi học" : `Xem lịch ${section.sessions.length} buổi học`}
                      </button>
                      {isExpanded && (
                        <ol className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {section.sessions.map(session => (
                            <li key={session.id} className="text-xs bg-black/20 border border-white/5 rounded-lg px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                              <span className="truncate">{session.topic}</span>
                              {session.date && <span className="shrink-0 text-white/40 font-mono">{formatDate(session.date)}</span>}
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
    <div className="min-h-screen bg-slate-950 text-white relative z-20">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setSelectedCourseId(null)} className="flex items-center gap-2.5 min-w-0 cursor-pointer">
            <img src="/mcna-logo.png" alt="MCNA Technology School" className="h-9 w-9 object-contain bg-white rounded-lg p-1 shrink-0" />
            <span className="mcna-on-dark font-display font-black tracking-widest uppercase text-xs truncate">MCNA LMS</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onLogin} className="px-3 py-2 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer">
              Đăng nhập
            </button>
            <button type="button" onClick={() => onRegister()} className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
              Tạo tài khoản
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs flex items-center justify-between gap-3">
            <span>{error}</span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setRetryTrigger(prev => prev + 1)}
                className="font-bold underline hover:text-white cursor-pointer"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="font-bold cursor-pointer text-white/60 hover:text-white"
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
