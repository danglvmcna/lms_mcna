import React, { useState, useEffect } from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert, Copy } from "lucide-react";
import { AppStore } from "../../store";
import ModalPortal from "../ModalPortal";
import LinkedText from "../LinkedText";
import { api } from "../../api";
import { instructorName } from "./studentDisplay";

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

  const catalogCategories = Array.from(
    new Set((store.courses || []).filter((course: any) => course.status === "published").map((course: any) => course.category).filter(Boolean))
  ).sort((a: string, b: string) => a.localeCompare(b, "vi"));

  return (
    <>
        {/* Tab 1: Course list catalogs grid and search */}
        {activeSubTab === "catalog" && !viewingCourseId && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h4 className="text-xl font-display font-bold text-slate-900">Khám phá khóa học</h4>
                <p className="text-sm text-slate-500 mt-1">{filteredCatalog.length} khóa học đang tuyển sinh.</p>
              </div>

              {/* Filtering / Search panel */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm khóa học..."
                    value={catalogSearch}
                    onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(0); }}
                    className="w-full sm:w-52 pl-9 pr-4 py-2 text-xs bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <select
                  value={catalogCategory}
                  onChange={(e) => { setCatalogCategory(e.target.value); setCatalogPage(0); }}
                  className="p-2 py-1.5 text-xs bg-white text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  <option value="all">Tất cả Danh mục</option>
                  {catalogCategories.map((item: string) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                <label className="flex items-center gap-2 px-3 py-2 text-xs bg-white text-slate-700 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 select-none shadow-xs">
                  <input
                    type="checkbox"
                    checked={filterNoConflict}
                    onChange={(e) => { setFilterNoConflict(e.target.checked); setCatalogPage(0); }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Ẩn trùng lịch</span>
                </label>
              </div>
            </div>

            {/* Courses Matrix layout cards - paginated */}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {filteredCatalog
                .slice(catalogPage * COURSES_PER_PAGE, (catalogPage + 1) * COURSES_PER_PAGE)
                .map(course => {
                const lessonsCount = store.lessons.filter(l => l.courseId === course.id).length;
                const isEnrolled = myEnrolledCourseIds.includes(course.id);
                const teacher = store.users.find((user: any) => user.id === course.teacherId);
                const openSections = (store.courseSections || []).filter((section: any) => section.courseId === course.id && section.status === "open");
                const upcomingOpening = openSections
                  .filter((section: any) => section.openingDate)
                  .sort((a: any, b: any) => new Date(a.openingDate).getTime() - new Date(b.openingDate).getTime())[0];
                const sessionCount = course.numberOfLessons || openSections.find((section: any) => section.numberOfSessions)?.numberOfSessions || lessonsCount;

                return (
                  <div key={course.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors flex flex-col justify-between group">
                    <div>
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-indigo-700">{course.category || "Khóa học MCNA"}</span>
                          <span>{course.level}</span>
                        </div>
                        <h5 className="font-display font-bold text-slate-900 text-lg leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">{course.title}</h5>
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{course.description}</p>
                        <div className="space-y-1.5 pt-1 text-sm text-slate-600">
                          <p className="flex items-center gap-2 min-w-0"><User className="h-4 w-4 text-slate-400 shrink-0" /><span className="truncate">{instructorName(teacher)}</span></p>
                          <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400 shrink-0" />{sessionCount} buổi · {lessonsCount} bài học</p>
                          <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400 shrink-0" />{upcomingOpening?.openingDate ? `Khai giảng ${new Date(upcomingOpening.openingDate).toLocaleDateString("vi-VN")}` : "Lịch khai giảng đang cập nhật"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 text-sm">
                      <div><p className="font-bold text-slate-900">{course.price > 0 ? `${new Intl.NumberFormat("vi-VN").format(course.price)} đ` : "Miễn phí"}</p><p className="text-xs text-slate-500">{isEnrolled ? "Đã đăng ký" : openSections.length > 0 ? `${openSections.length} lớp đang mở` : "Sắp khai giảng"}</p></div>
                      <button
                        onClick={() => setViewingCourseId(course.id)}
                        className="px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer"
                      >
                        Xem khóa học
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredCatalog.length === 0 && (
                <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                  Không tìm thấy khóa đào tạo nào khớp với tiêu chuẩn tìm kiếm của bạn.
                </div>
              )}
            </div>

            {/* Pagination controls */}
            {filteredCatalog.length > COURSES_PER_PAGE && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setCatalogPage(p => Math.max(0, p - 1))}
                  disabled={catalogPage === 0}
                  className="px-4 py-2 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs font-medium"
                >
                  ← Trang trước
                </button>
                <span className="text-[11px] text-slate-500 font-mono">
                  {catalogPage + 1} / {Math.ceil(filteredCatalog.length / COURSES_PER_PAGE)} trang
                  <span className="ml-2 text-slate-400">({filteredCatalog.length} khóa học)</span>
                </span>
                <button
                  onClick={() => setCatalogPage(p => Math.min(Math.ceil(filteredCatalog.length / COURSES_PER_PAGE) - 1, p + 1))}
                  disabled={(catalogPage + 1) * COURSES_PER_PAGE >= filteredCatalog.length}
                  className="px-4 py-2 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs font-medium"
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
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <button 
                    onClick={() => setViewingCourseId(null)}
                    className="p-1.5 px-3 text-xs bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1.5"
                  >
                    ← Quay lại Danh mục
                  </button>
                  <h4 className="text-base font-display font-bold text-slate-900">Chi tiết chương trình học</h4>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Main Details & Available Sections */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono tracking-wider px-2.5 py-1 border border-indigo-100 rounded-full font-bold uppercase">
                        {crs.category}
                      </span>
                      <h4 className="text-2xl font-display font-bold text-slate-900 mt-2">{crs.title}</h4>
                      <p className="text-sm text-slate-600 leading-relaxed font-sans whitespace-pre-line">
                        <LinkedText text={crs.description} />
                      </p>
                    </div>

                    {/* Available Class Sections */}
                    <div className="space-y-4 pt-4 border-t border-slate-200">
                      <span className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider block">Các lớp học phần mở đăng ký ({courseSections.length})</span>
                      
                      {courseSections.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs leading-relaxed flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
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
                              <div key={s.id} className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 text-xs transition-all hover:border-indigo-200 hover:shadow-md flex flex-col justify-between shadow-xs">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 text-base">Lớp {s.sectionCode}</span>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                      isFull ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}>
                                      {regCount}/{s.maxStudents} Học viên {isFull ? "[ĐẦY]" : ""}
                                    </span>
                                  </div>

                                  {conflictingSectionCode && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl flex items-center gap-1.5 font-semibold text-[11px]">
                                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                      <span>Trùng lịch học với lớp {conflictingSectionCode}</span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs text-slate-600">
                                    <div>
                                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Khai giảng</span>
                                      <span className="font-bold text-emerald-600">{openingStr}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Giảng viên</span>
                                      <span className="font-bold text-slate-800 truncate block" title={sectionTeacher?.name}>
                                        {sectionTeacher?.name || "Chưa phân công"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <span className="text-slate-500 font-bold text-[10px] uppercase block tracking-wider">Lịch học hàng tuần</span>
                                    <div className="space-y-1.5">
                                      {s.schedule.map((slot: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono">
                                          <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">{slot.dayOfWeek}</span>
                                          <span className="text-slate-800 font-semibold">{slot.startTime} - {slot.endTime}</span>
                                          <span className="text-slate-400 text-[10px]">Phòng: {slot.room || "Online"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleEnrollIntoCourse(crs.id, s.id)}
                                  disabled={isFull || isEnrolled || !!conflictingSectionCode}
                                  className={`w-full py-2.5 font-bold rounded-xl text-xs transition uppercase tracking-wider text-center block mt-4 shadow-xs ${
                                    isEnrolled ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" : isFull ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" : conflictingSectionCode ? "bg-amber-50 text-amber-600 cursor-not-allowed border border-amber-200" : crs.price ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer" : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
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
                    <div className="space-y-3.5 pt-4 border-t border-slate-200">
                      <span className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider block">Nội dung bài học ({courseLessons.length})</span>
                      {courseLessons.map((les, i) => (
                        <div key={les.id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 text-xs shadow-xs">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold flex items-center justify-center text-slate-700">
                            {i+1}
                          </span>
                          <div className="space-y-0.5">
                            <h6 className="font-bold text-slate-900 text-xs">{les.title}</h6>
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight block">Thời lượng: {les.duration}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column - General info & request form */}
                  <div className="space-y-5">
                    {crs.thumbnail && (
                      <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
                        <img src={crs.thumbnail} alt={crs.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Giảng viên phụ trách môn */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 h-fit space-y-4 shadow-xs">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-2">Giảng viên phụ trách môn</span>
                      
                      <div className="flex items-center gap-2.5 text-xs">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold font-mono text-indigo-700">
                          {instructorName(teacher).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <h6 className="font-bold text-slate-900">{instructorName(teacher)}</h6>
                          <span className="text-[10px] text-slate-400 block font-mono">Thông tin Người hướng dẫn môn</span>
                        </div>
                      </div>
                    </div>

                    {/* Action box for registered status */}
                    {isEnrolled && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                        <span className="text-xs font-bold text-slate-900 uppercase block border-b border-slate-100 pb-2">Trạng thái đăng ký</span>
                        {(() => {
                          const isPendingPlacement = matchEnroll?.status === "pending";
                          const isPendingPayment = matchEnroll?.status === "pending_payment";

                          if (isPendingPlacement) {
                            return (
                              <span className="block text-center text-xs font-mono font-bold text-indigo-700 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                                Chờ xếp lớp học phần
                              </span>
                            );
                          }
                          if (isPendingPayment) {
                            return (
                              <div className="space-y-2">
                                <span className="block text-center text-xs font-mono font-bold text-amber-800 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                  Chờ xác nhận thanh toán
                                </span>
                                <button
                                  onClick={() => {
                                    const foundTx = store.transactions.find(t => t.studentId === currentUser.id && t.courseId === crs.id);
                                    if (foundTx) setPaymentGuideTx(foundTx);
                                  }}
                                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl text-[11px] transition tracking-wider cursor-pointer block text-center uppercase shadow-xs"
                                >
                                  Xem Hướng dẫn thanh toán
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() => { setLearningCourseId(crs.id); setActiveSubTab("learning"); setViewingCourseId(null); }}
                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider shadow-xs cursor-pointer text-center block"
                            >
                              Vào phòng học tập
                            </button>
                          );
                        })()}
                      </div>
                    )}

                    {/* Request Section Box */}
                    {(courseSections.length === 0 || isAllSectionsFull) && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                        <span className="text-xs font-bold text-slate-900 uppercase block border-b border-slate-100 pb-2">Hết lớp học phần</span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Tất cả các lớp học phần hiện tại đã đầy hoặc chưa được mở. Bạn có thể gửi yêu cầu mở thêm lớp mới.</p>
                        <button
                          onClick={async () => {
                            try {
                              await api.requestNewSection(crs.id);
                              triggerToast("✅ Gửi yêu cầu mở thêm lớp học phần thành công!");
                            } catch (err: any) {
                              triggerToast(err.message || "Không thể gửi yêu cầu.");
                            }
                          }}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider shadow-xs cursor-pointer text-center block"
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



      {/* CHỨNG NHẬN / HỌC BẠ PRINT TRANSCRIPT DIALOG */}
    </>
  );
}
