import React, { useState, useEffect } from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert, Copy } from "lucide-react";
import { AppStore } from "../../store";
import ModalPortal from "../ModalPortal";
import { api } from "../../api";

interface ComponentProps {
  [key: string]: any;
}

export default function CourseCatalog(props: ComponentProps) {
  const [catalogPage, setCatalogPage] = useState(0);
  const [sectionSelections, setSectionSelections] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  const COURSES_PER_PAGE = 9;
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
    filterNoConflict,
    setFilterNoConflict,
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

  return (
    <>
        {/* Tab 1: Course list catalogs grid and search */}
        {activeSubTab === "catalog" && !viewingCourseId && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h4 className="text-base font-display font-semibold text-white">Danh mục Khóa học Công khai</h4>
                <p className="text-xs text-white/50">Hiện có {filteredCatalog.length} khóa học đang tuyển sinh học viên.</p>
              </div>

              {/* Filtering / Search panel */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm khóa học..."
                    value={catalogSearch}
                    onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(0); }}
                    className="pl-9 pr-4 py-2 text-xs bg-black/25 text-white placeholder-white/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 w-52"
                  />
                </div>

                <select
                  value={catalogCategory}
                  onChange={(e) => { setCatalogCategory(e.target.value); setCatalogPage(0); }}
                  className="p-2 py-1.5 text-xs bg-black/25 text-white/80 border border-white/10 rounded-xl focus:outline-none"
                >
                  <option value="all" className="bg-slate-900">Tất cả Danh mục</option>
                  <option value="Web Development" className="bg-slate-900">Lập trình Web</option>
                  <option value="Data Science" className="bg-slate-900">Khoa học Dữ liệu</option>
                  <option value="Software Engineering" className="bg-slate-900">Kỹ nghệ Phần mềm</option>
                </select>

                <label className="flex items-center gap-2 px-3 py-2 text-xs bg-black/25 text-white/80 border border-white/10 rounded-xl cursor-pointer hover:bg-white/5 select-none">
                  <input
                    type="checkbox"
                    checked={filterNoConflict}
                    onChange={(e) => { setFilterNoConflict(e.target.checked); setCatalogPage(0); }}
                    className="rounded border-white/20 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Ẩn khóa học trùng lịch</span>
                </label>
              </div>
            </div>

            {/* Courses Matrix layout cards - paginated */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredCatalog
                .slice(catalogPage * COURSES_PER_PAGE, (catalogPage + 1) * COURSES_PER_PAGE)
                .map(course => {
                const lessonsCount = store.lessons.filter(l => l.courseId === course.id).length;
                const isEnrolled = myEnrolledCourseIds.includes(course.id);

                return (
                  <div key={course.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition duration-150 flex flex-col justify-between">
                    <div>
                      <div className="h-28 bg-indigo-50/50 flex items-center justify-center relative border-b border-slate-100">
                        <BookOpen className="h-8 w-8 text-indigo-500" />
                        {isEnrolled && (
                          <div className="absolute top-3 right-3 bg-indigo-600 text-white font-sans font-bold text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full">
                            Đã đăng ký
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-indigo-300">
                            {course.category}
                          </span>
                          {course.price !== undefined && (
                            <div className="text-right">
                              {course.originalPrice && course.originalPrice > course.price ? (
                                <span className="text-[10px] text-white/40 line-through mr-1 font-mono">
                                  {new Intl.NumberFormat("vi-VN").format(course.originalPrice)} đ
                                </span>
                              ) : null}
                              <span className="text-xs font-bold text-emerald-400 font-mono">
                                {course.price > 0 ? `${new Intl.NumberFormat("vi-VN").format(course.price)} đ` : "Miễn phí"}
                              </span>
                            </div>
                          )}
                        </div>
                        <h5 className="font-display font-bold text-white text-sm line-clamp-1">{course.title}</h5>
                        <p className="text-xs text-white/60 line-clamp-3 leading-relaxed">{course.description}</p>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-white/5 mt-3 flex items-center justify-between text-xs">
                      <span className="text-white/40 font-mono text-[11px]">{lessonsCount} bài học</span>
                      <button
                        onClick={() => setViewingCourseId(course.id)}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 cursor-pointer"
                      >
                        Chi tiết lộ trình
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredCatalog.length === 0 && (
                <div className="col-span-full text-center py-16 bg-black/10 rounded-2xl border border-dashed border-white/5 text-xs text-white/40">
                  Không tìm thấy khóa đào tạo nào khớp với tiêu chuẩn tìm kiếm của bạn.
                </div>
              )}
            </div>

            {/* Pagination controls */}
            {filteredCatalog.length > COURSES_PER_PAGE && (
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <button
                  onClick={() => setCatalogPage(p => Math.max(0, p - 1))}
                  disabled={catalogPage === 0}
                  className="px-4 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  ← Trang trước
                </button>
                <span className="text-[11px] text-white/40 font-mono">
                  {catalogPage + 1} / {Math.ceil(filteredCatalog.length / COURSES_PER_PAGE)} trang
                  <span className="ml-2 text-white/20">({filteredCatalog.length} khóa học)</span>
                </span>
                <button
                  onClick={() => setCatalogPage(p => Math.min(Math.ceil(filteredCatalog.length / COURSES_PER_PAGE) - 1, p + 1))}
                  disabled={(catalogPage + 1) * COURSES_PER_PAGE >= filteredCatalog.length}
                  className="px-4 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Trang sau →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 1 Detail: Public course detailed inspector details modal view */}
        {activeSubTab === "catalog" && viewingCourseId && (
          (() => {
            const crs = store.courses.find(c => c.id === viewingCourseId);
            if (!crs) return null;
            const teacher = store.users.find(u => u.id === crs.teacherId);
            const courseLessons = store.lessons.filter(l => l.courseId === viewingCourseId).sort((a,b) => a.order - b.order);
            const matchEnroll = myEnrollments.find(e => e.courseId === crs.id);
            const isEnrolled = !!matchEnroll;

            const courseSections = (store.courseSections || []).filter(
              (s: any) => s.courseId === crs.id && s.status === "open" && s.schedule && s.schedule.length > 0
            );
            const isAllSectionsFull = courseSections.length > 0 && courseSections.every((s: any) => {
              const regCount = (store.courseRegistrations || []).filter((r: any) => r.sectionId === s.id && r.status === "registered").length;
              return regCount >= s.maxStudents;
            });

            // Timetable conflict checks for student
            const studentRegisteredSections = (store.courseRegistrations || [])
              .filter((r: any) => r.studentId === currentUser.id && r.status === "registered")
              .map((r: any) => (store.courseSections || []).find((sec: any) => sec.id === r.sectionId))
              .filter(Boolean);

            const timeToMinutes = (timeStr: string): number => {
              const [hrs, mins] = timeStr.split(":").map(Number);
              return hrs * 60 + mins;
            };

            const checkSectionConflict = (section: any): string | null => {
              if (!section.schedule || !Array.isArray(section.schedule)) return null;

              for (const slot of section.schedule) {
                const slotDay = String(slot.dayOfWeek || "").trim().toLowerCase();
                const slotStart = timeToMinutes(slot.startTime);
                const slotEnd = timeToMinutes(slot.endTime);

                for (const regSec of studentRegisteredSections) {
                  if (!regSec.schedule || !Array.isArray(regSec.schedule)) continue;

                  for (const regSlot of regSec.schedule) {
                    const regDay = String(regSlot.dayOfWeek || "").trim().toLowerCase();
                    
                    const slotDate = slot.specificDate ? String(slot.specificDate).slice(0, 10) : "";
                    const regDate = regSlot.specificDate ? String(regSlot.specificDate).slice(0, 10) : "";

                    const daysMatch = slotDay && regDay && slotDay === regDay;
                    const datesMatch = slotDate && regDate && slotDate === regDate;
                    const isOverlapDay = (slotDate && regDate) ? datesMatch : daysMatch;

                    if (isOverlapDay) {
                      const regStart = timeToMinutes(regSlot.startTime);
                      const regEnd = timeToMinutes(regSlot.endTime);

                      if (Math.max(slotStart, regStart) < Math.min(slotEnd, regEnd)) {
                        return regSec.sectionCode;
                      }
                    }
                  }
                }
              }
              return null;
            };

            return (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <button 
                    onClick={() => setViewingCourseId(null)}
                    className="p-1 px-2 text-xs bg-white/5 hover:bg-white/10 text-white/70 rounded-lg cursor-pointer"
                  >
                    Quay lại Danh mục
                  </button>
                  <h4 className="text-base font-display font-semibold text-indigo-200">Chi tiết chương trình học</h4>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Main Details & Available Sections */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] bg-[#2563eb]/20 text-indigo-300 font-mono tracking-widest px-2.5 py-1 border border-indigo-500/10 rounded-full font-bold uppercase">
                        {crs.category}
                      </span>
                      <h4 className="text-2xl font-display font-extrabold text-white mt-2">{crs.title}</h4>
                      <p className="text-sm text-white/70 leading-relaxed font-sans">{crs.description}</p>
                    </div>

                    {/* Available Class Sections */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider block">Các lớp học phần mở đăng ký ({courseSections.length})</span>
                      
                      {courseSections.length === 0 ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs leading-relaxed flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                          <span>Chưa có lớp học phần nào được mở cho môn học này trong tháng hiện tại.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {courseSections.map((s: any) => {
                            const regCount = (store.courseRegistrations || []).filter((r: any) => r.sectionId === s.id && r.status === "registered").length;
                            const isFull = regCount >= s.maxStudents;
                            const sectionTeacher = store.users.find((u: any) => u.id === s.teacherId) || teacher;
                            const openingStr = s.openingDate ? new Date(s.openingDate).toLocaleDateString("vi-VN") : "Chưa xác định";
                            const conflictingSectionCode = checkSectionConflict(s);

                            return (
                              <div key={s.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 text-xs transition-all hover:bg-white/[0.08] hover:border-indigo-500/30 flex flex-col justify-between">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-white text-base">Lớp {s.sectionCode}</span>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                      isFull ? "bg-red-500/10 text-red-400 border border-red-500/25" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                    }`}>
                                      {regCount}/{s.maxStudents} Học viên {isFull ? "[ĐẦY]" : ""}
                                    </span>
                                  </div>

                                  {conflictingSectionCode && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2.5 rounded-xl flex items-center gap-1.5 font-semibold text-[11px] animate-in fade-in duration-200">
                                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                      <span>Trùng lịch học với lớp {conflictingSectionCode}</span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl text-xs text-white/70">
                                    <div>
                                      <span className="text-white/40 block text-[10px] uppercase">Khai giảng</span>
                                      <span className="font-bold text-emerald-400">{openingStr}</span>
                                    </div>
                                    <div>
                                      <span className="text-white/40 block text-[10px] uppercase">Giảng viên</span>
                                      <span className="font-bold text-white truncate block" title={sectionTeacher?.name}>
                                        {sectionTeacher?.name || "Chưa phân công"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <span className="text-indigo-300 font-bold text-[10px] uppercase block tracking-wider">Lịch học hàng tuần</span>
                                    <div className="space-y-1.5">
                                      {s.schedule.map((slot: any, idx: number) => (
                                        <div key={idx} className="bg-black/20 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono">
                                          <span className="text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded">{slot.dayOfWeek}</span>
                                          <span className="text-white font-semibold">{slot.startTime} - {slot.endTime}</span>
                                          <span className="text-white/40 text-[10px]">Phòng: {slot.room || "Online"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleEnrollIntoCourse(crs.id, s.id)}
                                  disabled={isFull || isEnrolled || !!conflictingSectionCode}
                                  className={`w-full py-3 font-bold rounded-xl text-xs transition uppercase tracking-wider font-semibold text-center block mt-4 shadow-md ${
                                    isEnrolled ? "bg-slate-700 text-white/50 cursor-not-allowed" : isFull ? "bg-slate-800 text-white/30 cursor-not-allowed" : conflictingSectionCode ? "bg-amber-600/30 text-amber-400/50 cursor-not-allowed border border-amber-500/20" : crs.price ? "bg-[#16a34a] hover:bg-[#15803d] text-white cursor-pointer" : "bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                                  }`}
                                >
                                  {isEnrolled ? "Đã đăng ký môn học" : isFull ? "Lớp đã đầy" : conflictingSectionCode ? `Trùng lịch với lớp ${conflictingSectionCode}` : crs.price ? `Đăng ký lớp học | ${new Intl.NumberFormat("vi-VN").format(crs.price)} đ` : "Đăng ký miễn phí"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Course lessons list */}
                    <div className="space-y-3.5 pt-4 border-t border-white/10">
                      <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block">Nội dung bài học ({courseLessons.length})</span>
                      {courseLessons.map((les, i) => (
                        <div key={les.id} className="bg-black/25 border border-white/5 rounded-2xl p-4 flex gap-3 text-xs">
                          <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono font-bold flex items-center justify-center text-white/70">
                            {i+1}
                          </span>
                          <div className="space-y-1">
                            <h6 className="font-bold text-white text-xs">{les.title}</h6>
                            <span className="text-[10px] font-mono text-white/40 uppercase tracking-tight block">Thời lượng: {les.duration}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column - General info & request form */}
                  <div className="space-y-5">
                    {/* Giảng viên phụ trách môn */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 h-fit space-y-4">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider block border-b border-white/10 pb-2">Giảng viên phụ trách môn</span>
                      
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center font-bold font-mono text-cyan-300">
                          {teacher?.name?.slice(0, 2).toUpperCase() || "GV"}
                        </div>
                        <div className="truncate">
                          <h6 className="font-bold text-white">{teacher?.name || "Giảng viên môn học"}</h6>
                          <span className="text-[10px] text-white/40 block font-mono">Thông tin Người hướng dẫn môn</span>
                        </div>
                      </div>
                    </div>

                    {/* Action box for registered status */}
                    {isEnrolled && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                        <span className="text-xs font-semibold text-white uppercase block border-b border-white/10 pb-2">Trạng thái đăng ký</span>
                        {(() => {
                          const isPendingPlacement = matchEnroll?.status === "pending";
                          const isPendingPayment = matchEnroll?.status === "pending_payment";

                          if (isPendingPlacement) {
                            return (
                              <span className="block text-center text-xs font-mono font-bold text-violet-300 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                                Chờ xếp lớp học phần
                              </span>
                            );
                          }
                          if (isPendingPayment) {
                            return (
                              <div className="space-y-2">
                                <span className="block text-center text-xs font-mono font-bold text-amber-400 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                  Chờ xác nhận thanh toán
                                </span>
                                <button
                                  onClick={() => {
                                    const foundTx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === crs.id);
                                    if (foundTx) setPaymentGuideTx(foundTx);
                                  }}
                                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 rounded-xl text-[11px] transition tracking-wider cursor-pointer block text-center uppercase"
                                >
                                  Xem Hướng dẫn thanh toán
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() => { setLearningCourseId(crs.id); setActiveSubTab("learning"); setViewingCourseId(null); }}
                              className="w-full py-2.5 bg-[#2563eb] text-white font-bold rounded-xl text-xs transition uppercase tracking-wider shadow-md cursor-pointer text-center block"
                            >
                              Vào phòng học tập
                            </button>
                          );
                        })()}
                      </div>
                    )}

                    {/* Request Section Box */}
                    {(courseSections.length === 0 || isAllSectionsFull) && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                        <span className="text-xs font-semibold text-white uppercase block border-b border-white/10 pb-2">Hết lớp học phần</span>
                        <p className="text-[11px] text-white/60">Tất cả các lớp học phần hiện tại đã đầy hoặc chưa được mở. Bạn có thể gửi yêu cầu mở thêm lớp mới.</p>
                        <button
                          onClick={async () => {
                            try {
                              await api.requestNewSection(crs.id);
                              triggerToast("✅ Gửi yêu cầu mở thêm lớp học phần thành công!");
                            } catch (err: any) {
                              triggerToast(err.message || "Không thể gửi yêu cầu.");
                            }
                          }}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider shadow-md cursor-pointer text-center block"
                        >
                          Yêu cầu mở thêm lớp
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        )}

      {paymentGuideTx && (() => {
        const matchingCourse = store.courses.find(c => c.id === paymentGuideTx.courseId);
        const memoText = `MCNA ${paymentGuideTx.studentId?.substring(5,11).toUpperCase()} ${paymentGuideTx.id?.substring(3,9).toUpperCase()}`;
        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
            <div className="bg-slate-900 border border-white/15 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150 text-white leading-relaxed">
              <button 
                onClick={() => setPaymentGuideTx(null)}
                className="absolute top-4 right-4 p-1 text-white/50 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-display font-extrabold text-white uppercase tracking-wider">THANH TOÁN HỌC PHÍ MCNA</h4>
                  <span className="text-[10px] text-white/40 block font-mono">Mã đơn hàng: {paymentGuideTx.id}</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3 text-xs font-sans">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-white/40">Khóa học đăng ký:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{matchingCourse?.title || "Khóa học đào tạo"}</span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-white/40">Số tiền cần chuyển:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400 font-mono text-sm">
                      {new Intl.NumberFormat("vi-VN").format(paymentGuideTx.amount)} VND
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(paymentGuideTx.amount), "amount")}
                      className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white/70 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "amount" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "amount" ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-white/40">Ngân hàng thụ hưởng:</span>
                  <span className="font-bold text-white">MB Bank (Ngân hàng Quân Đội)</span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-white/40">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-300 font-mono tracking-wider text-sm">099162438104</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("099162438104", "account")}
                      className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white/70 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "account" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "account" ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-white/40">Chủ tài khoản:</span>
                  <span className="font-bold text-white uppercase text-[11px]">HOC VIEN CONG NGHE MCNA</span>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Nội dung chuyển khoản (bắt buộc):</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(memoText, "memo")}
                      className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white/70 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "memo" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "memo" ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                  <span className="p-2.5 bg-black/45 text-amber-300 font-mono text-center rounded-xl border border-amber-500/20 select-all font-bold tracking-wider text-xs">
                    {memoText}
                  </span>
                  <span className="text-[9px] text-white/40 text-center italic mt-0.5">
                    *Mẹo: Nhấn nút sao chép để dán đúng mã đơn hàng khi chuyển khoản.
                  </span>
                </div>
              </div>

              {/* Mock QR VietQR */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-2xl border border-white/10 mx-auto w-40 h-40 relative group shadow-lg">
                <img
                  src={`https://img.vietqr.io/image/MB-099162438104-compact2.png?amount=${paymentGuideTx.amount}&addInfo=${encodeURIComponent(memoText)}&accountName=HOC%20VIEN%20CONG%20NGHE%20MCNA`}
                  alt="VietQR MCNA"
                  className="w-34 h-34 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      `VietQR MB 099162438104 amount ${paymentGuideTx.amount} memo ${memoText}`
                    )}`;
                  }}
                />
                <div className="absolute inset-0 bg-slate-950/90 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-2xl p-2 text-center">
                  <span className="text-[10px] font-mono font-bold text-emerald-400">QUÉT CHUYỂN KHOẢN QR</span>
                  <span className="text-[8px] text-white/50 leading-tight mt-1">Hỗ trợ mọi App Ngân hàng Việt Nam (VietQR)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2">
                <p className="text-[10px] text-amber-300/80 text-center leading-relaxed">
                  Sau khi bạn chuyển khoản, bộ phận Học vụ MCNA sẽ duyệt đơn và kích hoạt lớp học cho bạn ngay.
                </p>
                <button
                  type="button"
                  onClick={() => setPaymentGuideTx(null)}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl transition cursor-pointer text-center text-xs"
                >
                  Đóng hướng dẫn
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}

      {/* CHỨNG NHẬN / HỌC BẠ PRINT TRANSCRIPT DIALOG */}
    </>
  );
}
