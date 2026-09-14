import React from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus, MapPin, Calendar, Trash2, AlertCircle, Layers } from "lucide-react";
import ModalPortal from "../ModalPortal";
import { AppStore } from "../../store";
import AttendanceManager from "../AttendanceManager";
import SessionMaterialsEditor from "../SessionMaterialsEditor";
import { api } from "../../api";
import ForumDiscussion from "../ForumDiscussion";
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_LABEL } from "../../utils";

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

const resolveCurrentSemesterId = (store: any) => {
  const semesters = store?.semesters || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  return semesters.find((s: any) => s.isCurrent)?.id ||
    semesters.find((s: any) => s.startDate && s.endDate && todayStr >= String(s.startDate).slice(0, 10) && todayStr <= String(s.endDate).slice(0, 10))?.id ||
    semesters[0]?.id ||
    "";
};


interface ComponentProps {
  [key: string]: any;
}

export default function CourseBuilder(props: ComponentProps) {
  const [courseSearch, setCourseSearch] = React.useState("");
  const [selectedClassSectionId, setSelectedClassSectionId] = React.useState<string | null>(null);
  const [selectedClassLessonId, setSelectedClassLessonId] = React.useState("");
  const [classDetailTab, setClassDetailTab] = React.useState<"lessons" | "forum">("lessons");
  const {
    activeSubTab,
    setActiveSubTab,
    selectedCourseId,
    setSelectedCourseId,
    selectedQuizId,
    setSelectedQuizId,
    selectedEssayId,
    setSelectedEssayId,
    assessmentType,
    setAssessmentType,
    showCourseModal,
    setShowCourseModal,
    courseModalMode,
    courseTitle,
    setCourseTitle,
    courseDesc,
    setCourseDesc,
    courseCategory,
    setCourseCategory,
    courseThumb,
    setCourseThumb,
    coursePrice,
    setCoursePrice,
    courseLevel,
    setCourseLevel,
    courseTags,
    setCourseTags,
    showLessonModal,
    setShowLessonModal,
    lessonTitle,
    setLessonTitle,
    lessonContent,
    setLessonContent,
    lessonVideo,
    setLessonVideo,
    lessonDuration,
    setLessonDuration,
    showQuizModal,
    setShowQuizModal,
    setQuizLessonId,
    quizTitle,
    setQuizTitle,
    quizPassing,
    setQuizPassing,
    quizLimit,
    setQuizLimit,
    quizAttempts,
    setQuizAttempts,
    showQuestionModal,
    setShowQuestionModal,
    qText,
    setQText,
    qType,
    setQType,
    qOptions,
    setQOptions,
    qCorrect,
    setQCorrect,
    showAssignModal,
    setShowAssignModal,
    assignTitle,
    setAssignTitle,
    assignDesc,
    setAssignDesc,
    assignDeadline,
    setAssignDeadline,
    assignMaxScore,
    setAssignMaxScore,
    activeSubmissionId,
    setActiveSubmissionId,
    gradingScore,
    setGradingScore,
    gradingFeedback,
    setGradingFeedback,
    store,
    currentUser,
    myCourses,
    myCourseIds,
    handleOpenCreateCourse,
    handleOpenEditCourse,
    handleSaveCourse,
    handleSubmitCourseForApproval,
    handleAddLessonSubmit,
    handleAddQuizSubmit,
    handleAddQuestionSubmit,
    handleAddAssignmentSubmit,
    handleGradeSubmission,
    handleExportCSVGradebook,
    activeCourse,
    lessons,
    courseQuizzes,
    courseAssignments,
    myAssignments,
    studentSubmissionsRaw,
    onRefreshData,
    triggerToast
  } = props;

  const [preselectedSessionId, setPreselectedSessionId] = React.useState("");

  React.useEffect(() => {
    setSelectedClassSectionId(null);
    setSelectedClassLessonId("");
    setPreselectedSessionId("");
    setClassDetailTab("lessons");
  }, [selectedCourseId]);

  // Local states for CourseSection management inside CourseBuilder
  const [showSectionModal, setShowSectionModal] = React.useState(false);
  const [sectionModalMode, setSectionModalMode] = React.useState<"create" | "edit">("create");
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = React.useState(false);
  const [isVideoUploading, setIsVideoUploading] = React.useState(false);
  const [showEditLessonModal, setShowEditLessonModal] = React.useState(false);
  const [editingLesson, setEditingLesson] = React.useState<any | null>(null);
  const [editLessonTitle, setEditLessonTitle] = React.useState("");
  const [editLessonContent, setEditLessonContent] = React.useState("");
  const [editLessonVideo, setEditLessonVideo] = React.useState("");
  const [editLessonDuration, setEditLessonDuration] = React.useState("");

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size >= MAX_UPLOAD_FILE_BYTES) {
      if (triggerToast) triggerToast(`Video bài giảng phải nhỏ hơn ${MAX_UPLOAD_FILE_LABEL}.`);
      e.target.value = "";
      return;
    }
    setIsVideoUploading(true);
    try {
      const res = await api.uploadFile(file);
      setter(res.url);
      if (triggerToast) triggerToast("✅ Tải video bài giảng lên thành công!");
    } catch (err: any) {
      if (triggerToast) triggerToast(err.message || "Không thể tải video bài giảng lên.");
    } finally {
      setIsVideoUploading(false);
      e.target.value = "";
    }
  };

  const [localLessonsCount, setLocalLessonsCount] = React.useState<number>(activeCourse?.numberOfLessons || 10);

  React.useEffect(() => {
    if (activeCourse) {
      setLocalLessonsCount(activeCourse.numberOfLessons || 10);
    }
  }, [activeCourse]);

  const handleUpdateLessonsCount = async () => {
    if (!activeCourse) return;
    try {
      await api.updateCourse(activeCourse.id, {
        title: activeCourse.title,
        description: activeCourse.description,
        category: activeCourse.category || "General",
        thumbnail: activeCourse.thumbnail,
        price: activeCourse.price || 0,
        level: activeCourse.level,
        tags: activeCourse.tags || [],
        openingDate: activeCourse.openingDate,
        numberOfLessons: localLessonsCount
      });
      if (triggerToast) triggerToast("✅ Đã cập nhật số buổi học thành công!");
      onRefreshData();
    } catch (err: any) {
      if (triggerToast) triggerToast(`❌ Lỗi: ${err.message || "Không thể cập nhật số buổi học"}`);
    }
  };

  const handleOpenEditClassLesson = (lesson: any) => {
    setEditingLesson(lesson);
    setEditLessonTitle(lesson.title || "");
    setEditLessonContent(lesson.content || "");
    setEditLessonVideo(lesson.videoUrl || "");
    setEditLessonDuration(lesson.duration || "1 buoi");
    setShowEditLessonModal(true);
  };

  const handleSaveClassLesson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingLesson) return;
    try {
      await api.updateLesson(editingLesson.id, {
        title: editLessonTitle,
        content: editLessonContent,
        videoUrl: editLessonVideo || undefined,
        order: editingLesson.order,
        duration: editLessonDuration
      });
      setShowEditLessonModal(false);
      setEditingLesson(null);
      onRefreshData();
      if (triggerToast) triggerToast("Da cap nhat noi dung buoi hoc.");
    } catch (err: any) {
      if (triggerToast) triggerToast(err.message || "Khong the cap nhat buoi hoc.");
    }
  };

  // Form states
  const [formSemesterId, setFormSemesterId] = React.useState(() => resolveCurrentSemesterId(store));
  const [formSectionCode, setFormSectionCode] = React.useState("");
  const [formMaxStudents, setFormMaxStudents] = React.useState<number>(30);
  const [formSessionsCount, setFormSessionsCount] = React.useState<number>(10);
  const [formStatus, setFormStatus] = React.useState<"pending" | "open" | "closed" | "cancelled">("open");
  const [formSlots, setFormSlots] = React.useState<Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>>([
    { dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "Phòng A101" }
  ]);
  const [formConflicts, setFormConflicts] = React.useState<string[]>([]);

  // Conflict Checker
  const checkConflicts = (
    sectionId: string | null,
    teacherId: string,
    slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>,
    semesterId: string
  ): string[] => {
    const sections = store.courseSections || [];
    const activeSections = sections.filter(
      (s: any) => s.id !== sectionId && s.semesterId === semesterId && s.status !== "cancelled"
    );

    const conflicts: string[] = [];

    slots.forEach(slot => {
      const timeToMins = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const start = timeToMins(slot.startTime);
      const end = timeToMins(slot.endTime);

      if (start >= end) {
        conflicts.push(`Ca học vào ${slot.dayOfWeek} có giờ bắt đầu (${slot.startTime}) phải nhỏ hơn giờ kết thúc (${slot.endTime}).`);
        return;
      }

      activeSections.forEach((sec: any) => {
        sec.schedule.forEach((secSlot: any) => {
          if (secSlot.dayOfWeek === slot.dayOfWeek) {
            const secStart = timeToMins(secSlot.startTime);
            const secEnd = timeToMins(secSlot.endTime);

            // Overlap logic: startA < endB && startB < endA
            const isOverlapping = start < secEnd && secStart < end;

            if (isOverlapping) {
              // Check teacher conflict
              if (sec.teacherId === teacherId) {
                const tName = store.users.find((u: any) => u.id === teacherId)?.name || "Giảng viên";
                const cTitle = store.courses.find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Giảng viên ${tName} đã bị trùng lịch dạy lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} cùng ngày ${slot.dayOfWeek}.`
                );
              }
              // Check room conflict
              if (secSlot.room.trim().toLowerCase() === slot.room.trim().toLowerCase() && slot.room.trim()) {
                const cTitle = store.courses.find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Phòng học "${slot.room}" đã bị đặt bởi lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} cùng ngày ${slot.dayOfWeek}.`
                );
              }
            }
          }
        });
      });
    });

    return conflicts;
  };

  const handleOpenCreateSection = () => {
    setSectionModalMode("create");
    setEditingSectionId(null);
    setFormSemesterId(resolveCurrentSemesterId(store));
    setFormSectionCode("");
    setFormMaxStudents(30);
    setFormSessionsCount(activeCourse?.numberOfLessons || 10);
    setFormStatus("pending");
    setFormSlots([]);
    setFormConflicts([]);
    setShowSectionModal(true);
  };

  const handleOpenEditSection = (sec: any) => {
    setSectionModalMode("edit");
    setEditingSectionId(sec.id);
    setFormSemesterId(sec.semesterId);
    setFormSectionCode(sec.sectionCode);
    setFormMaxStudents(sec.maxStudents);
    setFormSessionsCount(sec.numberOfSessions || activeCourse?.numberOfLessons || 10);
    setFormStatus(sec.status);
    setFormSlots(sec.schedule);
    setFormConflicts([]);
    setShowSectionModal(true);
  };

  const handleDeleteSection = async (id: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp học phần "${code}"? Tất cả thông tin lịch dạy sẽ bị hủy bỏ hoàn toàn.`)) return;
    
    try {
      await api.deleteCourseSection(id);
      props.onRefreshData();
      if (props.triggerToast) props.triggerToast(`Đã xóa lớp học phần ${code}.`);
    } catch (err: any) {
      if (props.triggerToast) props.triggerToast(err.message || "Không thể xóa lớp học phần.");
    }
    return;

    const storeData = AppStore.get();
    storeData.courseSections = (storeData.courseSections || []).filter((s: any) => s.id !== id);
    storeData.courseRegistrations = (storeData.courseRegistrations || []).filter((r: any) => r.sectionId !== id);

    AppStore.log(currentUser.id, "delete_section_from_builder", code, `Xóa lớp học phần ${code} trực tiếp từ trình quản lý khóa học.`);
    AppStore.save(storeData);
    props.onRefreshData();
    if (props.triggerToast) props.triggerToast(`Đã xóa lớp học phần ${code}.`);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSectionCode.trim()) {
      if (props.triggerToast) props.triggerToast("Vui lòng nhập mã lớp học phần.");
      return;
    }

    const conflicts = checkConflicts(editingSectionId, currentUser.id, formSlots, formSemesterId);
    if (conflicts.length > 0) {
      setFormConflicts(conflicts);
      if (props.triggerToast) props.triggerToast("Phát hiện xung đột trùng lịch biểu. Vui lòng kiểm tra chi tiết báo đỏ.");
      return;
    }

    try {
      const payload = {
        courseId: activeCourse.id,
        semesterId: formSemesterId,
        teacherId: currentUser.id,
        sectionCode: formSectionCode,
        maxStudents: formMaxStudents,
        numberOfSessions: formSessionsCount,
        schedule: formSlots,
        status: formStatus
      };
      if (sectionModalMode === "create") {
        await api.createCourseSection(payload);
      } else if (editingSectionId) {
        await api.updateCourseSection(editingSectionId, payload);
      }
      setShowSectionModal(false);
      props.onRefreshData();
    } catch (err: any) {
      if (props.triggerToast) props.triggerToast(err.message || "Không thể lưu lớp học phần.");
    }
    return;

    const storeData = AppStore.get();
    const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

    if (sectionModalMode === "create") {
      const newSection = {
        id: generateId("section"),
        courseId: activeCourse.id,
        semesterId: formSemesterId,
        teacherId: currentUser.id,
        sectionCode: formSectionCode,
        maxStudents: formMaxStudents,
        schedule: formSlots,
        status: formStatus
      };

      if (!storeData.courseSections) storeData.courseSections = [];
      storeData.courseSections.push(newSection);
      AppStore.log(currentUser.id, "create_section_from_builder", newSection.sectionCode, `Khởi tạo lớp học phần ${newSection.sectionCode} cho khóa ${activeCourse.title} trực tiếp từ CourseBuilder.`);
    } else {
      storeData.courseSections = (storeData.courseSections || []).map((s: any) => {
        if (s.id === editingSectionId) {
          AppStore.log(currentUser.id, "edit_section_from_builder", s.sectionCode, `Cập nhật lớp học phần ${formSectionCode} từ CourseBuilder.`);
          return {
            ...s,
            semesterId: formSemesterId,
            sectionCode: formSectionCode,
            maxStudents: formMaxStudents,
            schedule: formSlots,
            status: formStatus
          };
        }
        return s;
      });
    }

    AppStore.save(storeData);
    setShowSectionModal(false);
    props.onRefreshData();
  };

  const addFormSlot = () => {
    setFormSlots([...formSlots, { dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "" }]);
  };

  const removeFormSlot = (idx: number) => {
    setFormSlots(formSlots.filter((_, i) => i !== idx));
  };

  const updateFormSlot = (idx: number, field: string, value: string) => {
    setFormSlots(formSlots.map((slot, i) => {
      if (i === idx) {
        return { ...slot, [field]: value };
      }
      return slot;
    }));
  };

  const courseSections = (store.courseSections || []).filter((s: any) => s.courseId === activeCourse?.id);
  const courseAttendanceSessions = (store.attendanceSessions || [])
    .filter((session: any) => session.courseId === activeCourse?.id)
    .sort((a: any, b: any) => String(b.date || "").localeCompare(String(a.date || "")));

  const selectedClassSection = selectedClassSectionId
    ? courseSections.find((section: any) => section.id === selectedClassSectionId)
    : null;
  const selectedClassLesson = lessons.find((lesson: any) => lesson.id === selectedClassLessonId) || lessons[0] || null;
  const selectedClassAttendanceSessions = selectedClassSection
    ? courseAttendanceSessions.filter((session: any) => session.sectionId === selectedClassSection.id)
    : [];
  const selectedClassAttendanceSessionsByOrder = [...selectedClassAttendanceSessions]
    .sort((a: any, b: any) => String(a.date || "").localeCompare(String(b.date || "")));

  const renderSectionStatus = (status: string) => {
    if (status === "pending") return "Chờ duyệt";
    if (status === "open") return "Đang mở";
    if (status === "closed") return "Đã đóng";
    return "Đã hủy";
  };

  const getSectionRegisteredCount = (sectionId: string) => (store.courseRegistrations || []).filter(
    (r: any) => r.sectionId === sectionId && r.status === "registered"
  ).length;

  const handleOpenClassDetail = (sectionId: string) => {
    setSelectedClassSectionId(sectionId);
    setSelectedClassLessonId(lessons[0]?.id || "");
    setPreselectedSessionId("");
    setClassDetailTab("lessons");
  };

  const filteredCourses = myCourses.filter((course: any) => {
    return !courseSearch ||
      course.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.category.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.description.toLowerCase().includes(courseSearch.toLowerCase());
  });

  return (
    <>
        {/* Tab 1: Curriculum development & course viewer */}
        {activeSubTab === "courses" && !selectedCourseId && (
          <div className="space-y-6">
            <h4 className="text-base font-display font-semibold text-white">Khóa học Phụ trách ({myCourses.length})</h4>
            
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-xl text-xs">
              <input
                type="text"
                placeholder="Tìm kiếm khóa học theo tên, danh mục hoặc mô tả..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full md:w-64 px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {filteredCourses.map((course: any) => {
                const enrolledCount = store.enrollments.filter((e: any) => e.courseId === course.id).length;
                return (
                  <div key={course.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition duration-150 flex flex-col justify-between">
                    <div>
                      <div className="h-28 bg-indigo-50/50 flex items-center justify-center relative border-b border-slate-100">
                        <BookOpen className="h-8 w-8 text-indigo-500" />
                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
                            course.status === "published" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            course.status === "pending" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            course.status === "rejected" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                            "bg-white/10 text-white/60 border border-white/5"
                          }`}>
                            {course.status === "published" ? "ĐANG MỞ" :
                             course.status === "pending" ? "CHỜ XUẤT BẢN" :
                             course.status === "rejected" ? "BỊ TRẢ VỀ" : "BẢN NHÁP"}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-2">
                        <p className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest">{course.category}</p>
                        <h5 className="font-display font-bold text-white text-sm line-clamp-1">{course.title}</h5>
                        <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">{course.description}</p>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-white/5 mt-3 flex items-center justify-between text-xs">
                      <span className="text-white/50">{enrolledCount} học viên đã đăng ký</span>
                      
                      <div className="flex gap-1.5">
                        {currentUser.role !== "teacher" && (
                          <button
                            onClick={() => handleOpenEditCourse(course)}
                            className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-[10px] rounded-lg border border-white/10 text-white/85 cursor-pointer flex items-center"
                          >
                            <Edit className="h-3 w-3 inline mr-1" /> Sửa
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedCourseId(course.id)}
                          className="p-1 px-2.5 bg-white/10 hover:bg-indigo-600 font-bold hover:text-white text-[10px] rounded-lg text-white transition cursor-pointer flex items-center"
                        >
                          Chi tiết <ChevronRight className="h-3 w-3 inline ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCourses.length === 0 && (
                <div className="col-span-full text-center py-16 bg-black/10 rounded-2xl border-2 border-dashed border-white/5">
                  <p className="text-xs text-white/50 mb-3">
                    {myCourses.length === 0 ? "Chưa có bản nháp khóa học nào được tạo trên hồ sơ này." : "Không tìm thấy khóa học nào phù hợp với bộ lọc."}
                  </p>
                  {myCourses.length === 0 && currentUser.role !== "teacher" && (
                    <button 
                      onClick={handleOpenCreateCourse}
                      className="px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl"
                    >
                      Tạo bản nháp khóa học
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1 Detail: Comprehensive Single Course modules editor */}
        {activeSubTab === "courses" && selectedCourseId && activeCourse && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedCourseId(null)}
                  className="p-1 px-2 bg-white/5 hover:bg-white/10 text-xs text-white/70 rounded-lg cursor-pointer"
                >
                  Quay lại danh sách
                </button>
                <h4 className="text-base font-display font-semibold text-white truncate max-w-sm md:max-w-md">Khóa học: {activeCourse.title}</h4>
                <span className="text-xs text-white/40">Trạng thái: <strong className="text-indigo-200 uppercase">{
                  activeCourse.status === "published" ? "Đang mở" :
                  activeCourse.status === "pending" ? "Chờ xuất bản" :
                  activeCourse.status === "rejected" ? "Bị trả về chỉnh sửa" : "Bản nháp"
                }</strong></span>
              </div>

            </div>

            {selectedClassSection ? (
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedClassSectionId(null);
                        setSelectedClassLessonId("");
                        setPreselectedSessionId("");
                      }}
                      className="text-[11px] text-white/60 hover:text-white cursor-pointer font-sans"
                    >
                      ← Quay lại danh sách lớp
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-bold text-white">Lớp {selectedClassSection.sectionCode}</h5>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[9px] font-bold uppercase">
                        {renderSectionStatus(selectedClassSection.status)}
                      </span>
                      <span className="text-[10px] text-white/45 font-mono">
                        Sĩ số {getSectionRegisteredCount(selectedClassSection.id)}/{selectedClassSection.maxStudents}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50">{activeCourse.title}</p>
                  </div>
                  <div className="text-[10px] text-white/55 space-y-1 lg:text-right font-sans">
                    {(selectedClassSection.schedule || []).map((slot: any, idx: number) => (
                      <div key={idx} className="flex lg:justify-end items-center gap-1">
                        <Clock className="h-3 w-3 text-indigo-300" />
                        <span>{slot.dayOfWeek} ({slot.startTime} - {slot.endTime})</span>
                        <MapPin className="h-3 w-3 text-indigo-300" />
                        <span>{slot.room || "Trực tuyến"}</span>
                      </div>
                    ))}
                    {(!selectedClassSection.schedule || selectedClassSection.schedule.length === 0) && (
                      <span className="text-amber-300">Chờ Giáo vụ xếp ca & phòng học</span>
                    )}
                  </div>
                </div>

                {/* Tabs selection: Bài học & Điểm danh / Diễn đàn lớp học */}
                <div className="flex border-b border-white/10 gap-6 pb-1">
                  <button
                    onClick={() => setClassDetailTab("lessons")}
                    className={`pb-3 text-xs font-bold transition cursor-pointer relative ${
                      classDetailTab === "lessons" ? "text-indigo-400 font-sans" : "text-white/60 hover:text-white font-sans"
                    }`}
                  >
                    Bài học & Điểm danh
                    {classDetailTab === "lessons" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-150" />
                    )}
                  </button>
                  <button
                    onClick={() => setClassDetailTab("forum")}
                    className={`pb-3 text-xs font-bold transition cursor-pointer relative ${
                      classDetailTab === "forum" ? "text-indigo-400 font-sans" : "text-white/60 hover:text-white font-sans"
                    }`}
                  >
                    Diễn đàn lớp học
                    {classDetailTab === "forum" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full animate-in fade-in slide-in-from-bottom-1 duration-150" />
                    )}
                  </button>
                </div>

                {classDetailTab === "lessons" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white tracking-widest uppercase">Các buổi học ({lessons.length})</span>
                        {currentUser.role !== "teacher" && (
                          <button
                            onClick={() => setShowLessonModal(true)}
                            className="p-1.5 bg-white/10 hover:bg-white/15 text-[10px] text-white font-bold rounded-xl border border-white/10 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5 inline mr-1" /> Thêm
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                        {lessons.map((lesson: any) => (
                          <button
                            key={lesson.id}
                            onClick={() => {
                              setSelectedClassLessonId(lesson.id);
                              setPreselectedSessionId("");
                            }}
                            className={`w-full text-left rounded-2xl border p-3 transition cursor-pointer ${
                              selectedClassLesson?.id === lesson.id
                                ? "bg-indigo-600/30 border-indigo-400/50"
                                : "bg-black/25 border-white/5 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-indigo-200">Buổi {lesson.order}</span>
                              <span className="text-[9px] text-white/45">{lesson.duration}</span>
                            </div>
                            <div className="mt-1 text-xs font-bold text-white line-clamp-2">{lesson.title}</div>
                          </button>
                        ))}
                        {lessons.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-center text-[11px] text-white/45">
                            Chưa có buổi học nào cho khóa học này.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                      {selectedClassLesson ? (
                        <>
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <span className="text-xs font-semibold text-white">Nội dung buổi học</span>
                              <div className="flex items-center gap-2">
                                {currentUser.role === "teacher" && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditClassLesson(selectedClassLesson)}
                                    className="px-2.5 py-1 bg-indigo-600/25 hover:bg-indigo-600/40 text-[10px] text-indigo-200 font-bold rounded-lg border border-indigo-500/20 cursor-pointer"
                                  >
                                    Sửa nội dung
                                  </button>
                                )}
                                <span className="text-[10px] text-white/45 font-mono">Buổi {selectedClassLesson.order}</span>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h6 className="text-sm font-bold text-white">{selectedClassLesson.title}</h6>
                              <p className="text-xs text-white/65 leading-relaxed whitespace-pre-line font-sans">{selectedClassLesson.content}</p>
                              {selectedClassLesson.videoUrl && (
                                <div className="text-[10px] text-indigo-200 font-mono flex items-center gap-1 pt-1">
                                  <Tv className="h-3 w-3" /> Bài giảng đính kèm: {selectedClassLesson.videoUrl}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card: Assignments of this lesson */}
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div>
                                <span className="text-xs font-semibold text-white block">Bài tập của buổi học</span>
                                <span className="text-[10px] text-white/40">Giao bài tập tự luận cho buổi học này</span>
                              </div>
                              {currentUser.role === "teacher" && (
                                <button
                                  onClick={() => {
                                    if (props.setAssignType) props.setAssignType("lesson");
                                    if (props.setAssignLessonId) props.setAssignLessonId(selectedClassLesson.id);
                                    if (props.setSelectedCourseId) props.setSelectedCourseId(activeCourse.id);
                                    setShowAssignModal(true);
                                  }}
                                  className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-[10px] text-indigo-300 font-bold rounded-lg border border-indigo-500/20 cursor-pointer"
                                >
                                  + Thêm bài tập
                                </button>
                              )}
                            </div>

                            <div className="space-y-2.5">
                              {(() => {
                                const lessonAssignments = courseAssignments.filter(
                                  (a: any) => a.lessonId === selectedClassLesson.id
                                );

                                if (lessonAssignments.length === 0) {
                                  return (
                                    <p className="text-[11px] text-white/40">Chưa có bài tập tự luận nào cho buổi học này.</p>
                                  );
                                }

                                return lessonAssignments.map((a: any) => (
                                  <div key={a.id} className="text-xs flex items-center justify-between bg-black/25 p-3 rounded-xl border border-white/5 font-sans">
                                    <div className="space-y-1 min-w-0 flex-1 pr-2">
                                      <span className="font-bold text-white block truncate">{a.title}</span>
                                      <span className="text-[10px] text-white/50 block">Hạn nộp: {new Date(a.deadline).toLocaleDateString("vi-VN")}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                                      {a.maxScore} đ
                                    </span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div>
                                <span className="text-xs font-semibold text-white block">Đề trắc nghiệm của buổi học</span>
                                <span className="text-[10px] text-white/40">Tạo đề kiểm tra gắn trực tiếp với buổi học này</span>
                              </div>
                              {currentUser.role === "teacher" && (
                                <button
                                  onClick={() => {
                                    if (setQuizLessonId) setQuizLessonId(selectedClassLesson.id);
                                    if (props.setSelectedCourseId) props.setSelectedCourseId(activeCourse.id);
                                    setShowQuizModal(true);
                                  }}
                                  className="px-3 py-1 bg-emerald-600/25 hover:bg-emerald-600/40 text-[10px] text-emerald-200 font-bold rounded-lg border border-emerald-500/20 cursor-pointer"
                                >
                                  + Thêm đề
                                </button>
                              )}
                            </div>
                            <div className="space-y-2.5">
                              {(() => {
                                const lessonQuizzes = courseQuizzes.filter((quiz: any) => quiz.lessonId === selectedClassLesson.id);
                                if (lessonQuizzes.length === 0) {
                                  return <p className="text-[11px] text-white/40">Chưa có đề trắc nghiệm nào cho buổi học này.</p>;
                                }
                                return lessonQuizzes.map((quiz: any) => (
                                  <button
                                    key={quiz.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedQuizId(quiz.id);
                                      setAssessmentType("quiz");
                                      setActiveSubTab("quizzes");
                                    }}
                                    className="w-full text-left text-xs flex items-center justify-between bg-black/25 hover:bg-white/5 p-3 rounded-xl border border-white/5 transition cursor-pointer text-white"
                                  >
                                    <span className="truncate font-medium">{quiz.title}</span>
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                                      {quiz.passingScore}% đạt
                                    </span>
                                  </button>
                                ));
                              })()}
                            </div>
                          </div>

                          {/* Card: Session Materials (Slide, Docx, PDF, YouTube, Link) */}
                          {(() => {
                            const sessionIndex = Math.max(Number(selectedClassLesson.order || 1) - 1, 0);
                            const matchingSession = selectedClassAttendanceSessionsByOrder[sessionIndex] || null;
                            const currentSessionId = matchingSession ? matchingSession.id : "";
                            if (!currentSessionId) return null;

                            return (
                              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                  <div>
                                    <span className="text-xs font-semibold text-white block">Tài liệu buổi học</span>
                                    <span className="text-[10px] text-white/40">Quản lý slide bài giảng, tệp Word/PDF và liên kết YouTube cho buổi học này</span>
                                  </div>
                                  <FileText className="h-4 w-4 text-indigo-300" />
                                </div>
                                <SessionMaterialsEditor
                                  sessionId={currentSessionId}
                                  triggerToast={triggerToast || props.triggerToast || (() => {})}
                                  onChanged={onRefreshData}
                                />
                              </div>
                            );
                          })()}

                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div>
                                <span className="text-xs font-semibold text-white block">Quản lý điểm danh</span>
                                <span className="text-[10px] text-white/40">{selectedClassAttendanceSessions.length} buổi điểm danh của lớp này</span>
                              </div>
                              <Calendar className="h-4 w-4 text-indigo-300" />
                            </div>
                            {(() => {
                              const expectedTopic = `Buổi ${selectedClassLesson.order}: ${selectedClassLesson.title}`;
                              const sessionIndex = Math.max(Number(selectedClassLesson.order || 1) - 1, 0);
                              const matchingSession = selectedClassAttendanceSessionsByOrder[sessionIndex] || null;
                              const defaultSessionId = matchingSession ? matchingSession.id : "";
                              return (
                                <AttendanceManager
                                  store={store}
                                  currentUser={currentUser}
                                  onRefreshData={onRefreshData}
                                  triggerToast={triggerToast}
                                  defaultCourseId={activeCourse.id}
                                  courseId={activeCourse.id}
                                  sectionId={selectedClassSection.id}
                                  defaultSessionId={defaultSessionId}
                                  defaultSessionTopic={expectedTopic}
                                  lockSelectors
                                />
                              );
                            })()}
                          </div>
                        </>
                      ) : (
                        <div className="py-24 text-center border border-dashed border-white/10 bg-white/5 rounded-3xl text-white/30 space-y-2">
                          <BookOpen className="h-8 w-8 mx-auto text-white/20 animate-pulse" />
                          <p className="text-xs text-white/50">Vui lòng chọn bài học ở danh sách bên trái để hiển thị chi tiết bài học và quản lý điểm danh.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                      <MessageSquare className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs font-semibold text-white">Diễn đàn lớp {selectedClassSection.sectionCode}</span>
                    </div>
                    <ForumDiscussion
                      courseId={selectedCourseId}
                      sectionId={selectedClassSection.id}
                      store={store}
                      currentUser={currentUser}
                      onRefreshData={onRefreshData}
                      triggerToast={triggerToast}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Sections list and Lessons list */}
                <div className={currentUser.role === "teacher" ? "lg:col-span-3 space-y-6" : "lg:col-span-2 space-y-6"}>
                  {/* Card 1: Class Sections list */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-white block">Các Lớp học phần đang mở</span>
                        <span className="text-[10px] text-white/40 block">Phân bổ ca học & thời khóa biểu</span>
                      </div>
                      {activeCourse.status === "published" && currentUser.role !== "teacher" && (
                        <button 
                          onClick={handleOpenCreateSection}
                          className="text-[10px] text-indigo-300 font-bold hover:underline cursor-pointer"
                        >
                          + Lập lớp học
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {courseSections.map((sec: any) => {
                        const currentCount = getSectionRegisteredCount(sec.id);
                        return (
                          <div key={sec.id} className="text-xs space-y-2 bg-black/25 p-4 rounded-xl border border-white/5 relative group flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 bg-indigo-600 text-white font-bold rounded-lg text-[9px] font-mono tracking-wider">
                                  {sec.sectionCode}
                                </span>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => handleOpenClassDetail(sec.id)}
                                    className="p-0.5 hover:bg-white/10 text-cyan-300 rounded cursor-pointer"
                                    title="Mở chi tiết buổi học & Diễn đàn"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                  {currentUser.role !== "teacher" && (
                                    <>
                                      <button
                                        onClick={() => handleOpenEditSection(sec)}
                                        className="p-0.5 hover:bg-white/10 text-indigo-300 rounded cursor-pointer"
                                        title="Chỉnh sửa ca học"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSection(sec.id, sec.sectionCode)}
                                        className="p-0.5 hover:bg-red-500/20 text-red-400 rounded cursor-pointer"
                                        title="Xóa lớp học phần"
                                      >
                                        <Trash className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-[10px] text-white/50 space-y-1 font-sans">
                                {(sec.schedule || []).map((slot: any, sIdx: number) => (
                                  <div key={sIdx} className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 shrink-0 text-indigo-400" />
                                    <span>{slot.dayOfWeek} ({slot.startTime} - {slot.endTime})</span>
                                    <span className="font-mono text-white/30">|</span>
                                    <MapPin className="h-3 w-3 shrink-0 text-indigo-400" />
                                    <span className="truncate">{slot.room || "Trực tuyến"}</span>
                                  </div>
                                ))}
                                {(!sec.schedule || sec.schedule.length === 0) && (
                                  <div className="text-[10px] text-amber-400/80 italic flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span>Chờ Giáo vụ xếp ca & phòng học</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-[9px] pt-2 border-t border-white/5 font-mono text-white/40 mt-1">
                              <span>Sĩ số: {currentCount}/{sec.maxStudents} HS</span>
                              <div className="flex items-center gap-2">
                                <span className={`uppercase font-bold ${
                                  sec.status === "pending" ? "text-amber-400" :
                                  sec.status === "open" ? "text-emerald-400" : "text-white/40"
                                }`}>
                                  {renderSectionStatus(sec.status)}
                                </span>
                                <button
                                  onClick={() => handleOpenClassDetail(sec.id)}
                                  className="px-2 py-0.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer font-sans"
                                >
                                  Chi tiết
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {courseSections.length === 0 && (
                        <p className="text-[11px] text-white/40 italic col-span-full">Chưa có lớp học phần nào được lập. Hãy xuất bản khóa học và nhấp "+ Lập lớp học" để bắt đầu xếp thời khóa biểu.</p>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Lessons List */}
                  {currentUser.role !== "teacher" && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                        <span className="text-xs font-semibold text-white tracking-widest uppercase">Các buổi học trong môn ({lessons.length})</span>
                        {currentUser.role !== "teacher" && (
                          <button
                            onClick={() => setShowLessonModal(true)}
                            className="p-1.5 bg-white/15 hover:bg-white/20 text-[11px] text-white font-bold rounded-xl border border-white/10 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5 inline mr-1" /> Thêm Bài học
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {lessons.map(lesson => (
                          <div key={lesson.id} className="bg-black/25 border border-white/10 rounded-2xl p-4 flex items-start gap-3.5 hover:bg-black/35 transition">
                            <div className="w-14 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/20 text-indigo-300 font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                              Buổi {lesson.order}
                            </div>

                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <h6 className="text-xs font-display font-bold text-white">Buổi học {lesson.order}: {lesson.title}</h6>
                                <span className="text-[10px] font-mono text-white/40">{lesson.duration}</span>
                              </div>
                              <p className="text-xs text-white/65 leading-relaxed font-sans">{lesson.content}</p>
                              {lesson.videoUrl && (
                                <div className="text-[10px] text-indigo-200 font-mono flex items-center gap-1 pt-1">
                                  <Tv className="h-3 w-3" /> Bài giảng đính kèm: {lesson.videoUrl}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {lessons.length === 0 && (
                          <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-xs text-white/50">Môn học hiện chưa có buổi học nào. Hãy bấm "Thêm Bài học" để bắt đầu thiết lập nội dung từng buổi.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Status & actions block, quizzes, assignments */}
                {currentUser.role !== "teacher" && (
                  <div className="space-y-6">
                    {/* Actions Block */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                      <span className="text-xs font-semibold text-white block border-b border-white/10 pb-2.5">Hành động tiến trình</span>
                      
                      {activeCourse.status === "draft" && (
                        <button
                          onClick={() => handleSubmitCourseForApproval(activeCourse.id)}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Gửi duyệt khóa học
                        </button>
                      )}

                      {activeCourse.status === "rejected" && (
                        <div className="space-y-2">
                          <div className="bg-red-500/15 border border-red-500/20 rounded-xl p-3 text-[11px] text-red-200/90 leading-relaxed">
                            Khóa học bị trả về. Vui lòng đọc chi tiết lý do, cập nhật các nội dung cần thiết và gửi duyệt lại.
                          </div>
                          <button
                            onClick={() => handleSubmitCourseForApproval(activeCourse.id)}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Gửi duyệt lại khóa học
                          </button>
                        </div>
                      )}

                      {activeCourse.status === "published" && (
                        <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-300 flex items-center gap-1.5 font-semibold">
                          <Check className="h-4 w-4" /> Giáo trình đã xuất bản và đang hoạt động.
                        </div>
                      )}

                      {activeCourse.status === "pending" && (
                        <div className="bg-amber-500/15 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-300 leading-normal">
                          Khóa học đã gửi duyệt và đang chờ quản lý phê duyệt trước khi công khai.
                        </div>
                      )}
                    </div>

                    {/* Settings / Config Number of Lessons for Teacher */}
                    {currentUser.role !== "teacher" && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                        <span className="text-xs font-semibold text-white block border-b border-white/10 pb-2.5 flex items-center gap-1.5">
                          <Settings className="h-4 w-4 text-indigo-400" /> Thiết lập Khóa học
                        </span>
                        <div className="space-y-3 text-xs font-sans">
                          <div className="space-y-1">
                            <label className="text-[11px] text-white/50 block">Số buổi học thiết lập</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                className="w-20 px-2 py-1 bg-black/25 text-white border border-white/10 rounded-lg text-xs"
                                value={localLessonsCount}
                                onChange={(e) => setLocalLessonsCount(Number(e.target.value))}
                              />
                              <button
                                onClick={handleUpdateLessonsCount}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                              >
                                Lưu lại
                              </button>
                            </div>
                          </div>
                          {activeCourse.openingDate && (
                            <div>
                              <span className="text-[11px] text-white/50 block">Ngày khai giảng</span>
                              <span className="text-white font-medium">{new Date(activeCourse.openingDate).toLocaleDateString("vi-VN")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quizzes overview in Course details */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                        <span className="text-xs font-semibold text-white">Bài thi trắc nghiệm tương tác</span>
                        <button 
                          onClick={() => {
                            if (setQuizLessonId) setQuizLessonId(lessons[0]?.id || "");
                            setShowQuizModal(true);
                          }}
                          className="text-[10px] text-indigo-300 font-bold hover:underline cursor-pointer"
                        >
                          + Tạo Đề thi
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {courseQuizzes.map(q => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => {
                              setSelectedQuizId(q.id);
                              setAssessmentType("quiz");
                              setActiveSubTab("quizzes");
                            }}
                            className="w-full text-left text-xs flex items-center justify-between bg-black/25 hover:bg-white/5 hover:text-white p-2 rounded-xl border border-white/5 transition duration-150 cursor-pointer text-white"
                            title="Click để chỉnh sửa / import câu hỏi đề thi"
                          >
                            <span className="truncate max-w-[140px] font-medium">{q.title}</span>
                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/80 font-mono">
                              {q.passingScore}% đạt
                            </span>
                          </button>
                        ))}

                        {courseQuizzes.length === 0 && (
                          <p className="text-[11px] text-white/40">Chưa có bài thi trắc nghiệm nào được tạo.</p>
                        )}
                      </div>
                    </div>

                    {/* Assignments overview in Course details */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                        <span className="text-xs font-semibold text-white">Thử thách Bài tự luận</span>
                        <button 
                          onClick={() => {
                            if (props.setAssignType) props.setAssignType("lesson");
                            if (props.setAssignLessonId) props.setAssignLessonId(lessons[0]?.id || "");
                            setShowAssignModal(true);
                          }}
                          className="text-[10px] text-indigo-300 font-bold hover:underline cursor-pointer"
                        >
                          + Tạo Bài tập
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {courseAssignments.map(a => {
                          let typeLabel = "";
                          if (a.type === "lesson" && a.lessonId) {
                            const lesson = lessons.find((l: any) => l.id === a.lessonId);
                            typeLabel = `[Buổi ${lesson?.order || ""}]`;
                          } else if (a.type === "chapter") {
                            typeLabel = "[Cuối chương]";
                          } else if (a.type === "midterm") {
                            typeLabel = "[Giữa kỳ]";
                          } else if (a.type === "final") {
                            typeLabel = "[Cuối kỳ]";
                          }
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setSelectedEssayId(a.id);
                                setAssessmentType("essay");
                                setActiveSubTab("quizzes");
                              }}
                              className="w-full text-left text-xs flex items-center justify-between bg-black/25 hover:bg-white/5 hover:text-white p-2 rounded-xl border border-white/5 transition duration-150 cursor-pointer font-sans text-white"
                              title="Click để chấm bài học viên"
                            >
                              <div className="flex flex-col min-w-0 pr-2 flex-1">
                                <span className="truncate font-medium">{a.title}</span>
                                {typeLabel && <span className="text-[9px] text-white/45 mt-0.5">{typeLabel}</span>}
                              </div>
                              <span className="text-[10px] font-mono text-indigo-200 shrink-0">
                                Tối đa: {a.maxScore} đ
                              </span>
                            </button>
                          );
                        })}

                        {courseAssignments.length === 0 && (
                          <p className="text-[11px] text-white/40">Chưa có thử thách bài tập tự luận nào được tạo.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* MODAL 1: ADD / EDIT COURSE FORMS */}
      {showCourseModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowCourseModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <BookOpen className="h-5 w-4 text-indigo-400" /> 
              {courseModalMode === "create" ? "Khởi tạo Khóa học Mới" : "Chỉnh sửa Thông tin Khóa học"}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Tiêu đề Khóa học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết kế hệ thống cơ sở dữ liệu quy mô lớn"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Danh mục Chuyên môn</label>
                <select
                  value={courseCategory}
                  onChange={(e) => setCourseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                >
                  <option value="Web Development" className="bg-slate-900">Phát triển Web</option>
                  <option value="Data Science" className="bg-slate-900">Khoa học Dữ liệu</option>
                  <option value="Software Engineering" className="bg-slate-900">Kỹ thuật Phần mềm</option>
                  <option value="DevOps & Infrastructure" className="bg-slate-900">DevOps & Hạ tầng</option>
                </select>
              </div>


              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Mô tả / Đề cương khóa học</label>
                <textarea
                  required
                  placeholder="Mô tả chi tiết nội dung chương trình học..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white h-20 max-h-24 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Mức học phí (VND)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Miễn phí"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Trình độ đào tạo</label>
                  <select
                    value={courseLevel}
                    onChange={(e) => setCourseLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                  >
                    <option value="Cơ bản" className="bg-slate-900">Cơ bản</option>
                    <option value="Trung cấp" className="bg-slate-900">Trung cấp</option>
                    <option value="Nâng cao" className="bg-slate-900">Nâng cao</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Các thẻ từ khóa Tìm kiếm (tags)</label>
                <input
                  type="text"
                  placeholder="Next.js, Python, CSS (phân tách bằng dấu phẩy)"
                  value={courseTags}
                  onChange={(e) => setCourseTags(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Xác nhận lưu thông số
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL 2: ADD LESSON FORM */}
      {showLessonModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setShowLessonModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <Plus className="h-4 w-4 text-indigo-400" /> Thêm Bài học mới
            </h3>

            <form onSubmit={handleAddLessonSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Tiêu đề Bài học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài 1. Làm việc với HTTP controllers"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/70 block">Video bài giảng (Không bắt buộc)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="URL hoặc tải lên"
                      value={lessonVideo}
                      onChange={(e) => setLessonVideo(e.target.value)}
                      disabled={isVideoUploading}
                      className="flex-1 px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-xs"
                    />
                    <label className={`px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer text-xs font-bold text-white flex items-center justify-center min-w-[80px] transition ${isVideoUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {isVideoUploading ? "Tải..." : "Tải tệp"}
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleVideoUpload(e, setLessonVideo)}
                        disabled={isVideoUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {isVideoUploading && (
                    <div className="text-[10px] text-indigo-300 animate-pulse font-sans">
                      ⏳ Đang tải video lên...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Thời lượng bài học</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 20 phút"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Nội dung hướng dẫn chi tiết (Hỗ trợ Markdown)</label>
                <textarea
                  required
                  placeholder="Mô tả hướng dẫn chi tiết từng bước cho học sinh tại đây..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white h-36 max-h-48 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl transition cursor-pointer"
                >
                  Xác nhận thêm
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {showEditLessonModal && editingLesson && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowEditLessonModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3">
              <Edit className="h-4 w-4 text-indigo-400" /> Sửa nội dung buổi học
            </h3>
            <form onSubmit={handleSaveClassLesson} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Tên buổi học</label>
                <input
                  type="text"
                  required
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/70">Thời lượng / lịch học</label>
                  <input
                    type="text"
                    required
                    value={editLessonDuration}
                    onChange={(e) => setEditLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/70 block">Video bài giảng</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editLessonVideo}
                      onChange={(e) => setEditLessonVideo(e.target.value)}
                      disabled={isVideoUploading}
                      className="flex-1 px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-xs min-w-0"
                    />
                    <label className={`px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer text-xs font-bold text-white flex items-center justify-center transition ${isVideoUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {isVideoUploading ? "Tải..." : "Tải"}
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleVideoUpload(e, setEditLessonVideo)}
                        disabled={isVideoUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/70">Nội dung bài dạy</label>
                <textarea
                  required
                  value={editLessonContent}
                  onChange={(e) => setEditLessonContent(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 text-white h-44 max-h-64 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-sans text-xs leading-relaxed"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditLessonModal(false)}
                  className="px-4 py-2 bg-transparent text-white/60 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Lưu buổi học
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {showSectionModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={() => setShowSectionModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-lg font-display font-medium text-white mb-2 flex items-center gap-2 border-b border-white/10 pb-3">
                <Layers className="h-5 w-5 text-indigo-400" /> 
                {sectionModalMode === "create" ? "Khởi tạo Lớp học phần mới" : "Chỉnh sửa Lớp học phần"}
              </h3>

              <form onSubmit={handleSaveSection} className="space-y-4 text-xs font-sans">
                {/* Basic info row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Tháng</label>
                    <select
                      value={formSemesterId}
                      onChange={(e) => setFormSemesterId(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                    >
                      {(store.semesters || []).map((s: any) => (
                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Mã lớp học phần</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: CS101-L02"
                      value={formSectionCode}
                      onChange={(e) => setFormSectionCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Sĩ số tối đa (Học sinh)</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={formMaxStudents}
                      onChange={(e) => setFormMaxStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Số buổi học</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={formSessionsCount}
                      onChange={(e) => setFormSessionsCount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/60 block font-bold">Trạng thái phê duyệt</label>
                    <div className="px-3 py-2 bg-black/40 text-amber-300 font-bold border border-amber-500/20 rounded-xl text-xs flex items-center gap-1.5 h-[34px]">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                      <span>Chờ duyệt & xếp ca</span>
                    </div>
                  </div>
                </div>

                {/* Sub-form for schedule slots */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider text-indigo-400">
                      Thời khóa biểu chi tiết ({formSlots.length})
                    </h5>
                    <button
                      type="button"
                      onClick={addFormSlot}
                      className="px-3 py-1 bg-white/5 border border-white/10 text-white font-bold rounded-lg hover:bg-white/10 transition cursor-pointer text-[10.5px]"
                    >
                      + Thêm ca học tuần
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {formSlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className="bg-black/15 border border-white/5 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-end relative overflow-hidden"
                      >
                        <div className="space-y-1">
                          <label className="text-white/40 text-[10px] block">Ngày học</label>
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) => updateFormSlot(idx, "dayOfWeek", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs"
                          >
                            {DAYS_OF_WEEK.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/40 text-[10px] block">Giờ bắt đầu</label>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => updateFormSlot(idx, "startTime", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/40 text-[10px] block">Giờ kết thúc</label>
                          <input
                            type="time"
                            required
                            value={slot.endTime}
                            onChange={(e) => updateFormSlot(idx, "endTime", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1 relative">
                          <label className="text-white/40 text-[10px] block">Phòng học / Đường dẫn</label>
                          <input
                            type="text"
                            required
                            placeholder="Ví dụ: Phòng A101"
                            value={slot.room}
                            onChange={(e) => updateFormSlot(idx, "room", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-xs"
                          />
                          {formSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeFormSlot(idx)}
                              className="absolute -top-1.5 -right-1 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-lg border border-red-500/10 cursor-pointer"
                              title="Xóa ca học"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conflicts Panel */}
                {formConflicts.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-red-400 font-bold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Phát hiện trùng lịch biểu ({formConflicts.length})</span>
                    </div>
                    <ul className="list-disc pl-5 text-red-200/80 space-y-1 leading-relaxed">
                      {formConflicts.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Modal Actions */}
                <div className="border-t border-white/5 pt-4 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowSectionModal(false)}
                    className="px-4 py-2 bg-transparent text-white/50 hover:text-white transition cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer"
                  >
                    Lưu thiết lập
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
      {/* MODAL: ATTENDANCE MANAGER INTEGRATED */}
      {showAttendanceModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-150 text-white font-sans max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowAttendanceModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/50 cursor-pointer font-sans"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="text-base font-bold text-white mb-4 border-b border-white/10 pb-3 flex items-center gap-2 font-sans uppercase">
              Bảng Quản Lý Điểm Danh - {activeCourse.title}
            </h3>
            
            <AttendanceManager
              store={store}
              currentUser={currentUser}
              onRefreshData={props.onRefreshData}
              triggerToast={(msg: string) => {
                if (props.triggerToast) props.triggerToast(msg);
                else console.log(msg);
              }}
              defaultCourseId={activeCourse.id}
              defaultSessionId={preselectedSessionId}
            />
          </div>
        </div>
        </ModalPortal>
      )}

    </>
  );
}

