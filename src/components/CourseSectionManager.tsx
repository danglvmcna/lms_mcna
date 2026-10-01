import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Settings,
  ChevronRight,
  Info,
  DollarSign,
  MessageSquare,
  Video,
  ExternalLink,
  MessageCircle,
  DownloadCloud
} from "lucide-react";
import { Course, CourseSection, User } from "../types";
import { api, operationsApi } from "../api";
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_LABEL } from "../utils";
import ModalPortal from "./ModalPortal";
import ForumDiscussion from "./ForumDiscussion";
import { ZoomLogo } from "./icons/BrandLogos";

interface CourseSectionManagerProps {
  store: any;
  currentUser: User;
  onRefreshData: () => void;
}

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

// MCNA classes run on Zoom; an online "room" can host any number of classes at the same time.
const DEFAULT_ROOM = "Online (Zoom)";
const isOnlineRoom = (room: string) => /online|zoom|meet|teams|trực tuyến|truc tuyen/i.test(room);
const DEFAULT_SLOT = { dayOfWeek: "Thứ Hai", startTime: "19:30", endTime: "21:30", room: DEFAULT_ROOM };
const DEFAULT_CATEGORIES = ["Web Development", "Mobile App", "Data Science", "UI/UX Design", "General"];
const CATEGORY_LABEL: Record<string, string> = {
  "Web Development": "Lập trình Web",
  "Mobile App": "Lập trình Di động",
  "Data Science": "Khoa học Dữ liệu",
  "UI/UX Design": "Thiết kế UI/UX",
  General: "Đại cương"
};

export default function CourseSectionManager({ store, currentUser, onRefreshData }: CourseSectionManagerProps) {
  const [activeTab, setActiveTab] = useState<"courses" | "sections">("courses");
  const [courseSearch, setCourseSearch] = useState("");
  const [sectionSearch, setSectionSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Modals state
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalMode, setCourseModalMode] = useState<"create" | "edit">("create");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionModalMode, setSectionModalMode] = useState<"create" | "edit">("create");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // Student List Modal States
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSectionForStudents, setSelectedSectionForStudents] = useState<CourseSection | null>(null);

  // Forum Discussion Modal States
  const [showForumModal, setShowForumModal] = useState(false);
  const [selectedSectionForForum, setSelectedSectionForForum] = useState<CourseSection | null>(null);

  // Lessons Management States
  const [showLessonsModal, setShowLessonsModal] = useState(false);
  const [selectedCourseForLessons, setSelectedCourseForLessons] = useState<Course | null>(null);
  const [showLessonFormModal, setShowLessonFormModal] = useState(false);
  const [lessonFormMode, setLessonFormMode] = useState<"create" | "edit">("create");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  // Lesson Form States
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDuration, setLessonDuration] = useState("15 mins");
  const [lessonOrder, setLessonOrder] = useState(1);

  // Course Form States
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseCategory, setCourseCategory] = useState("General");
  const [coursePrice, setCoursePrice] = useState(0);
  const [courseOriginalPrice, setCourseOriginalPrice] = useState<number | "">("");
  const [courseLevel, setCourseLevel] = useState("Cơ bản");
  const [courseTags, setCourseTags] = useState("");
  const [courseLessonsCount, setCourseLessonsCount] = useState(10);
  const [courseThumb, setCourseThumb] = useState("");

  // Section Form States
  const [sectionCourseId, setSectionCourseId] = useState("");
  const [sectionTeacherId, setSectionTeacherId] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [sectionMaxStudents, setSectionMaxStudents] = useState(50);
  const [sectionSessionsCount, setSectionSessionsCount] = useState(10);
  const [sectionOpeningDate, setSectionOpeningDate] = useState("");
  const [sectionStatus, setSectionStatus] = useState<"pending" | "open" | "closed" | "cancelled">("open");
  const [sectionMeetingUrl, setSectionMeetingUrl] = useState("");
  const [sectionGroupChatUrl, setSectionGroupChatUrl] = useState("");
  const [sectionSlots, setSectionSlots] = useState<Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>>([
    { ...DEFAULT_SLOT }
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [importingCatalog, setImportingCatalog] = useState(false);
  // Deleting a course is reserved for the system admin.
  const canDeleteCourse = currentUser.role === "admin";
  const categoryOptions = Array.from(new Set<string>([...DEFAULT_CATEGORIES, ...(store.courses || []).map((course: Course) => course.category).filter(Boolean)]));

  // Loads the MCNA course catalogue (courses and syllabus from mcna.vn) so courses are entered only once.
  const handleImportCatalog = async () => {
    if (!window.confirm("Nạp danh mục khóa học MCNA (lấy từ mcna.vn)?\n\nKhóa mới sẽ được tạo; khóa đã có được cập nhật lại tên, mô tả và đề cương theo danh mục. Học phí bạn đã sửa, các lớp và học viên được giữ nguyên.")) return;
    setImportingCatalog(true);
    try {
      const result = await api.importMcnaCatalog();
      showToast(`Đã nạp danh mục MCNA: ${result.coursesCreated} khóa mới, ${result.coursesUpdated} khóa cập nhật.`);
      onRefreshData();
    } catch (err: any) {
      showToast(`Không nạp được danh mục: ${err.message || "lỗi máy chủ"}`);
    } finally {
      setImportingCatalog(false);
    }
  };
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [formConflicts, setFormConflicts] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size >= MAX_UPLOAD_FILE_BYTES) {
      showToast(`Video bài giảng phải nhỏ hơn ${MAX_UPLOAD_FILE_LABEL}.`);
      e.target.value = "";
      return;
    }
    setIsVideoUploading(true);
    try {
      const res = await api.uploadFile(file);
      setter(res.url);
      showToast("✅ Tải video bài giảng lên thành công!");
    } catch (err: any) {
      showToast(err.message || "Không thể tải video bài giảng lên.");
    } finally {
      setIsVideoUploading(false);
      e.target.value = "";
    }
  };

  // Get teacher lists
  const teachers = (store.users || []).filter((u: any) => u.role === "teacher");
  const [teacherSubjects, setTeacherSubjects] = useState<Record<string,string[]>>({});
  useEffect(() => {
    if (currentUser.role === 'teacher') return;
    operationsApi('/teachers').then(rows=>setTeacherSubjects(Object.fromEntries(rows.map((row:any)=>[row.id,row.course_ids])))).catch(()=>setTeacherSubjects({}));
  }, [store.users]);

  // Sync section course ID if a course is already selected
  useEffect(() => {
    if (selectedCourseId) {
      setSectionCourseId(selectedCourseId);
    }
  }, [selectedCourseId]);

  // Open Course Modals
  const handleOpenCreateCourse = () => {
    setCourseModalMode("create");
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDesc("");
    setCourseCategory("Web Development");
    setCoursePrice(0);
    setCourseOriginalPrice("");
    setCourseLevel("Cơ bản");
    setCourseTags("");
    setCourseLessonsCount(10);
    setCourseThumb("");
    setShowCourseModal(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setCourseModalMode("edit");
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDesc(course.description);
    setCourseCategory(course.category);
    setCoursePrice(course.price || 0);
    setCourseOriginalPrice(course.originalPrice || "");
    setCourseLevel(course.level || "Cơ bản");
    setCourseTags(course.tags ? course.tags.join(", ") : "");
    setCourseLessonsCount(course.numberOfLessons || 10);
    setCourseThumb(course.thumbnail || "");
    setShowCourseModal(true);
  };

  // A new class starts with the number of sessions of its course (e.g. 5 for AI Automation).
  const sessionsOfCourse = (courseId: string) =>
    (store.courses || []).find((course: Course) => course.id === courseId)?.numberOfLessons || 10;

  // Open Section Modals
  const handleOpenCreateSection = (courseId: string = sectionCourseId) => {
    setSectionModalMode("create");
    setEditingSectionId(null);
    setSectionTeacherId(teachers[0]?.id || "");
    setSectionCode("");
    setSectionMaxStudents(50);
    setSectionSessionsCount(sessionsOfCourse(courseId));
    setSectionOpeningDate("");
    setSectionStatus("open");
    setSectionMeetingUrl("");
    setSectionGroupChatUrl("");
    setSectionSlots([{ ...DEFAULT_SLOT }]);
    setFormConflicts([]);
    setShowSectionModal(true);
  };

  const handleOpenEditSection = (sec: CourseSection) => {
    setSectionModalMode("edit");
    setEditingSectionId(sec.id);
    setSectionCourseId(sec.courseId);
    setSectionTeacherId(sec.teacherId);
    setSectionCode(sec.sectionCode);
    setSectionMaxStudents(sec.maxStudents);
    setSectionSessionsCount(sec.numberOfSessions || 10);
    setSectionOpeningDate(sec.openingDate || "");
    setSectionStatus(sec.status);
    setSectionMeetingUrl(sec.meetingUrl || "");
    setSectionGroupChatUrl(sec.groupChatUrl || "");
    setSectionSlots(sec.schedule || []);
    setFormConflicts([]);
    setShowSectionModal(true);
  };

  // Conflict Checker (Local verification)
  const checkConflicts = (
    sectionId: string | null,
    teacherId: string,
    slots: Array<{ dayOfWeek: string; startTime: string; endTime: string; room: string }>
  ): string[] => {
    const sections = store.courseSections || [];
    const activeSections = sections.filter(
      (s: any) => s.id !== sectionId && s.status !== "cancelled"
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
            const isOverlapping = start < secEnd && secStart < end;

            if (isOverlapping) {
              if (sec.teacherId === teacherId) {
                const tName = teachers.find(u => u.id === teacherId)?.name || "Giảng viên";
                const cTitle = (store.courses || []).find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Giảng viên ${tName} đã bị trùng lịch dạy lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} vào ${slot.dayOfWeek}.`
                );
              }
              if (String(secSlot.room || "").trim().toLowerCase() === slot.room.trim().toLowerCase() && slot.room.trim() && !isOnlineRoom(slot.room)) {
                const cTitle = (store.courses || []).find((c: any) => c.id === sec.courseId)?.title || "Môn học";
                conflicts.push(
                  `Phòng học "${slot.room}" đã bị trùng lịch bởi lớp "${sec.sectionCode}" (${cTitle}) tại khung giờ ${secSlot.startTime} - ${secSlot.endTime} vào ${slot.dayOfWeek}.`
                );
              }
            }
          }
        });
      });
    });

    return conflicts;
  };

  // Submit Course Form
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDesc.trim()) {
      showToast("Vui lòng điền đầy đủ tiêu đề và mô tả khóa học.");
      return;
    }

    const tagsArray = courseTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    const payload = {
      title: courseTitle.trim(),
      description: courseDesc.trim(),
      category: courseCategory,
      price: Number(coursePrice),
      originalPrice: courseOriginalPrice !== "" ? Number(courseOriginalPrice) : undefined,
      level: courseLevel,
      tags: tagsArray,
      numberOfLessons: Number(courseLessonsCount),
      thumbnail: courseThumb.trim() || undefined
    };

    try {
      if (courseModalMode === "create") {
        await api.createCourse(payload);
        showToast("✅ Đã tạo khóa học thành công!");
      } else if (editingCourseId) {
        await api.updateCourse(editingCourseId, payload);
        showToast("✅ Đã cập nhật thông tin khóa học!");
      }
      setShowCourseModal(false);
      onRefreshData();
    } catch (err: any) {
      showToast(`❌ Lỗi: ${err.message || "Không thể lưu khóa học"}`);
    }
  };

  // Submit Section Form
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionCourseId) {
      showToast("Vui lòng chọn khóa học.");
      return;
    }
    if (!sectionCode.trim()) {
      showToast("Vui lòng nhập mã lớp học phần.");
      return;
    }

    const conflicts = checkConflicts(editingSectionId, sectionTeacherId, sectionSlots);
    if (conflicts.length > 0) {
      setFormConflicts(conflicts);
      showToast("Trùng lịch! Vui lòng kiểm tra lại thời khóa biểu.");
      return;
    }

    const payload = {
      courseId: sectionCourseId,
      teacherId: sectionTeacherId || undefined,
      sectionCode: sectionCode.trim().replace(/\s+/g, " "),
      maxStudents: Number(sectionMaxStudents),
      numberOfSessions: Number(sectionSessionsCount),
      schedule: sectionSlots,
      status: sectionStatus,
      openingDate: sectionOpeningDate || undefined,
      meetingUrl: sectionMeetingUrl.trim() || null,
      groupChatUrl: sectionGroupChatUrl.trim() || null
    };

    try {
      if (sectionModalMode === "create") {
        await api.createCourseSection(payload);
        showToast("Đã tạo lớp học phần thành công!");
      } else if (editingSectionId) {
        await api.updateCourseSection(editingSectionId, payload);
        showToast("Đã cập nhật lớp học phần!");
      }
      setShowSectionModal(false);
      onRefreshData();
    } catch (err: any) {
      showToast(`Lỗi: ${err.message || "Không thể lưu lớp học phần"}`);
    }
  };

  // Delete Course
  const handleDeleteCourse = async (courseId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa khóa học "${title}" không? Hành động này sẽ xóa toàn bộ nội dung, bài tập và điểm của khóa học!`)) {
      return;
    }
    try {
      await api.deleteCourse(courseId);
      showToast(`Đã xóa khóa học "${title}"!`);
      onRefreshData();
    } catch (err: any) {
      showToast(`Không thể xóa khóa học: ${err.message}`);
    }
  };

  // Delete Section
  const handleDeleteSection = async (sectionId: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp học phần "${code}" không?`)) {
      return;
    }
    try {
      await api.deleteCourseSection(sectionId);
      showToast(`Đã xóa lớp học phần "${code}"!`);
      onRefreshData();
    } catch (err: any) {
      showToast(`Không thể xóa lớp học phần: ${err.message}`);
    }
  };

  // Lessons Management Event Handlers
  const handleOpenManageLessons = (course: Course) => {
    setSelectedCourseForLessons(course);
    setShowLessonsModal(true);
  };

  const handleOpenCreateLesson = () => {
    setLessonFormMode("create");
    setEditingLessonId(null);
    setLessonTitle("");
    setLessonContent("");
    setLessonVideoUrl("");
    setLessonDuration("15 mins");
    const courseLessons = (store.lessons || []).filter((l: any) => l.courseId === selectedCourseForLessons?.id);
    setLessonOrder(courseLessons.length + 1);
    setShowLessonFormModal(true);
  };

  const handleOpenEditLesson = (lesson: any) => {
    setLessonFormMode("edit");
    setEditingLessonId(lesson.id);
    setLessonTitle(lesson.title);
    setLessonContent(lesson.content);
    setLessonVideoUrl(lesson.videoUrl || "");
    setLessonDuration(lesson.duration || "15 mins");
    setLessonOrder(lesson.order);
    setShowLessonFormModal(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForLessons) return;

    const payload = {
      courseId: selectedCourseForLessons.id,
      title: lessonTitle,
      content: lessonContent,
      videoUrl: lessonVideoUrl || undefined,
      order: lessonOrder,
      duration: lessonDuration
    };

    try {
      if (lessonFormMode === "create") {
        await api.addLesson(payload);
        showToast("Đã thêm bài học thành công!");
      } else {
        if (!editingLessonId) return;
        await api.updateLesson(editingLessonId, payload);
        showToast("Đã cập nhật bài học thành công!");
      }
      setShowLessonFormModal(false);
      onRefreshData();
    } catch (err: any) {
      showToast(`Lỗi: ${err.message || "Không thể lưu bài học"}`);
    }
  };

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài học "${title}" không?`)) {
      return;
    }
    try {
      await api.deleteLesson(lessonId);
      showToast("Đã xóa bài học!");
      onRefreshData();
    } catch (err: any) {
      showToast(`Không thể xóa bài học: ${err.message}`);
    }
  };

  // Render Schedule Helper
  const renderSchedule = (slots: any[]) => {
    if (!slots || slots.length === 0) return <span className="text-amber-600 font-medium">Chưa xếp lịch</span>;
    return slots.map((slot, index) => (
      <div key={index} className="flex items-center gap-1.5 text-[11px] text-slate-600">
        <Clock className="h-3.5 w-3.5 text-indigo-600" />
        <span>{slot.dayOfWeek} ({slot.startTime} - {slot.endTime})</span>
        <span className="text-slate-300">|</span>
        <MapPin className="h-3.5 w-3.5 text-indigo-600" />
        <span>{slot.room || "Trực tuyến"}</span>
      </div>
    ));
  };

  const getSectionRegisteredCount = (secId: string) => {
    return (store.courseRegistrations || []).filter((r: any) => r.sectionId === secId && r.status === "registered").length;
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-slate-900 border border-slate-800 text-white px-4 py-2.5 rounded-xl z-50 shadow-2xl flex items-center gap-2 font-sans text-xs animate-in fade-in duration-150">
          <Info className="h-4 w-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" /> Quản lý Khóa học & Lớp học phần
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Khởi tạo và thiết lập giáo trình khóa học, lên lịch thời khóa biểu cho từng lớp học phần.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleImportCatalog}
            disabled={importingCatalog}
            title="Tạo/cập nhật các khóa học theo danh mục trên mcna.vn"
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <DownloadCloud className="h-4 w-4 text-indigo-600" /> {importingCatalog ? "Đang nạp..." : "Nạp khóa học từ mcna.vn"}
          </button>
          <button
            onClick={handleOpenCreateCourse}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" /> Khởi tạo Khóa học
          </button>
          <button
            onClick={() => handleOpenCreateSection()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" /> Thêm Lớp học phần
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 gap-6 pb-0.5">
        <button
          onClick={() => setActiveTab("courses")}
          className={`pb-3 text-xs font-semibold transition cursor-pointer relative ${
            activeTab === "courses" ? "text-indigo-600 font-sans" : "text-slate-500 hover:text-slate-900 font-sans"
          }`}
        >
          Danh sách Khóa học
          {activeTab === "courses" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("sections")}
          className={`pb-3 text-xs font-semibold transition cursor-pointer relative ${
            activeTab === "sections" ? "text-indigo-600 font-sans" : "text-slate-500 hover:text-slate-900 font-sans"
          }`}
        >
          Danh sách Lớp học phần
          {activeTab === "sections" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Course List Tab */}
      {activeTab === "courses" && (
        <div className="space-y-4 font-sans">
          <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 px-3 py-2 rounded-xl text-xs max-w-md shadow-xs">
            <Search className="h-4 w-4 text-slate-400 self-center shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm khóa học theo tiêu đề, danh mục..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full bg-transparent text-slate-900 placeholder-slate-400 border-none focus:outline-none text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {store.courses
              .filter((c: Course) => {
                const searchLower = courseSearch.toLowerCase();
                return (
                  c.title.toLowerCase().includes(searchLower) ||
                  c.category.toLowerCase().includes(searchLower)
                );
              })
              .map((c: Course) => {
                const courseSectionsList = (store.courseSections || []).filter((s: any) => s.courseId === c.id);

                return (
                  <div key={c.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col justify-between hover:shadow-md transition duration-150 group shadow-xs">
                    <div>
                      {c.thumbnail ? (
                        <div className="h-32 w-full overflow-hidden bg-slate-100 border-b border-slate-200/80 relative">
                          <img
                            src={c.thumbnail}
                            alt={c.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                          <div className="absolute top-2.5 right-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase backdrop-blur-md shadow-xs ${
                              c.status === "published" ? "bg-emerald-600 text-white" :
                              c.status === "pending" ? "bg-amber-500 text-white" :
                              "bg-slate-700 text-white"
                            }`}>
                              {c.status === "published" ? "Đã mở" : c.status === "pending" ? "Chưa xuất bản" : "Bản nháp"}
                            </span>
                          </div>
                        </div>
                      ) : null}
                      <div className="p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded text-[10px] uppercase tracking-wider border border-indigo-200/60">
                            {c.category}
                          </span>
                          {!c.thumbnail && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              c.status === "published" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              c.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}>
                              {c.status === "published" ? "Đã mở" : c.status === "pending" ? "Chưa xuất bản" : "Bản nháp"}
                            </span>
                          )}
                        </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">{c.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{c.description}</p>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-1 pt-1 font-sans">
                        <div>Số buổi học: <span className="text-slate-800 font-mono font-semibold">{c.numberOfLessons || 10}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-5 pt-3 border-t border-slate-100 mt-2 text-xs">
                      <span className="text-slate-400 font-medium">{courseSectionsList.length} lớp học phần</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenManageLessons(c)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition"
                          title="Quản lý bài học"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditCourse(c)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition"
                          title="Chỉnh sửa khóa học"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {canDeleteCourse && (
                          <button
                            onClick={() => handleDeleteCourse(c.id, c.title)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                            title="Xóa khóa học"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Class Section List Tab */}
      {activeTab === "sections" && (
        <div className="space-y-4 font-sans">
          <div className="flex items-center gap-2.5 bg-white border border-slate-200/80 px-3 py-2 rounded-xl text-xs max-w-md shadow-xs">
            <Search className="h-4 w-4 text-slate-400 self-center shrink-0" />
            <input
              type="text"
              placeholder="Tìm lớp học phần theo mã lớp..."
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              className="w-full bg-transparent text-slate-900 placeholder-slate-400 border-none focus:outline-none text-xs"
            />
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <table className="w-full text-xs text-left text-slate-700 font-sans">
              <thead className="bg-slate-50/80 text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Mã Lớp</th>
                  <th className="px-5 py-3.5">Khóa học</th>
                  <th className="px-5 py-3.5">Giảng viên</th>
                  <th className="px-5 py-3.5">Sĩ số</th>
                  <th className="px-5 py-3.5">Ngày khai giảng</th>
                  <th className="px-5 py-3.5">Thời khóa biểu</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(store.courseSections || [])
                  .filter((sec: CourseSection) => {
                    return !sectionSearch || sec.sectionCode.toLowerCase().includes(sectionSearch.toLowerCase());
                  })
                  .map((sec: CourseSection) => {
                    const course = (store.courses || []).find((c: any) => c.id === sec.courseId) || { title: "Không rõ" };
                    const teacherName = teachers.find(u => u.id === sec.teacherId)?.name || "Chưa phân công";
                    const currentCount = getSectionRegisteredCount(sec.id);

                    return (
                      <tr key={sec.id} className="hover:bg-slate-50/60 transition duration-75">
                        <td className="px-5 py-4 font-mono font-bold">
                          <button
                            onClick={() => {
                              setSelectedSectionForStudents(sec);
                              setShowStudentsModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer focus:outline-none text-left"
                            title="Xem danh sách học viên"
                          >
                            {sec.sectionCode}
                          </button>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900">{course.title}</td>
                        <td className="px-5 py-4 text-slate-700">{teacherName}</td>
                        <td className="px-5 py-4 font-mono">
                          <button
                            onClick={() => {
                              setSelectedSectionForStudents(sec);
                              setShowStudentsModal(true);
                            }}
                            className="text-slate-700 hover:text-indigo-600 hover:underline flex items-center gap-1.5 cursor-pointer focus:outline-none font-medium"
                            title="Xem danh sách học viên"
                          >
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {currentCount}/{sec.maxStudents}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{sec.openingDate ? new Date(sec.openingDate).toLocaleDateString("vi-VN") : "Chưa đặt"}</td>
                        <td className="px-5 py-4 space-y-1">
                          {renderSchedule(sec.schedule)}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {sec.meetingUrl && (
                              <a
                                href={sec.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-sans transition border border-blue-200/60 font-medium"
                                title={sec.meetingUrl}
                              >
                                <ZoomLogo className="h-3 w-3 shrink-0" /> Zoom
                              </a>
                            )}
                            {sec.groupChatUrl && (
                              <a
                                href={sec.groupChatUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-sans transition border border-emerald-200/60 font-medium"
                                title={sec.groupChatUrl}
                              >
                                <MessageCircle className="h-3 w-3" /> Nhóm Zalo
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            sec.status === "open" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            sec.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            sec.status === "closed" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {sec.status === "open" ? "Mở tuyển" :
                             sec.status === "pending" ? "Chờ mở" :
                             sec.status === "closed" ? "Khóa" : "Hủy"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => {
                                setSelectedSectionForForum(sec);
                                setShowForumModal(true);
                              }}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer transition"
                              title="Xem thảo luận lớp học"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditSection(sec)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer transition"
                              title="Sửa lớp học"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSection(sec.id, sec.sectionCode)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                              title="Xóa lớp học"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: CREATE/EDIT COURSE */}
      {showCourseModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className={`bg-white border border-slate-200 rounded-2xl p-6 w-full shadow-2xl relative text-xs text-slate-900 transition-all duration-300 ${courseModalMode === "edit" ? "max-w-4xl" : "max-w-lg"}`}>
              <button 
                onClick={() => setShowCourseModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                {courseModalMode === "create" ? "Khởi tạo Khóa học mới" : "Chỉnh sửa thông tin Khóa học"}
              </h3>

              <div className={courseModalMode === "edit" ? "grid grid-cols-1 md:grid-cols-2 gap-8 items-start" : "space-y-4"}>
                {/* COLUMN 1: Edit course metadata form */}
                <form onSubmit={handleSaveCourse} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 font-sans">Tên khóa học *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Lập trình Node.js & React nâng cao"
                      value={courseTitle}
                      onChange={(e) => setCourseTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 font-sans">Mô tả tóm tắt *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Nhập mô tả chi tiết chương trình đào tạo..."
                      value={courseDesc}
                      onChange={(e) => setCourseDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 font-sans">Danh mục</label>
                      <select
                        value={courseCategory}
                        onChange={(e) => setCourseCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                      >
                        {categoryOptions.map(category => (
                          <option key={category} value={category}>{CATEGORY_LABEL[category] || category}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 font-sans">Trình độ</label>
                      <select
                        value={courseLevel}
                        onChange={(e) => setCourseLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                      >
                        <option value="Cơ bản">Cơ bản</option>
                        <option value="Trung cấp">Trung cấp</option>
                        <option value="Nâng cao">Nâng cao</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 font-sans">Học phí bán (VND)</label>
                      <input
                        type="number"
                        min={0}
                        value={coursePrice}
                        onChange={(e) => setCoursePrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono shadow-xs text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 font-sans">Giá gốc (gạch ngang)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Để trống nếu không có"
                        value={courseOriginalPrice}
                        onChange={(e) => setCourseOriginalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono shadow-xs text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 font-sans">Số buổi học</label>
                      <input
                        type="number"
                        min={1}
                        value={courseLessonsCount}
                        onChange={(e) => setCourseLessonsCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono shadow-xs text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 font-sans">Ảnh Thumbnail (URL)</label>
                    <input
                      type="url"
                      placeholder="https://mcna.vn/... hoặc đường dẫn ảnh"
                      value={courseThumb}
                      onChange={(e) => setCourseThumb(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    />
                    {courseThumb.trim() && (
                      <div className="mt-2 h-24 w-40 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100">
                        <img
                          src={courseThumb}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 font-sans">Từ khóa (Tags - phân tách bằng dấu phẩy)</label>
                    <input
                      type="text"
                      placeholder="ví dụ: react, javascript, frontend"
                      value={courseTags}
                      onChange={(e) => setCourseTags(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 font-sans">
                    <button
                      type="button"
                      onClick={() => setShowCourseModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer font-sans transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer font-sans shadow-xs"
                    >
                      Lưu thông tin
                    </button>
                  </div>
                </form>

                {/* COLUMN 2: Class Sections and Timetables List (only in edit mode) */}
                {courseModalMode === "edit" && editingCourseId && (
                  <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-8 border-slate-200 pt-4 md:pt-0 font-sans">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 tracking-wide uppercase font-sans">Các lớp học phần tương ứng</h4>
                        <p className="text-[10px] text-slate-400 font-sans">Thời khóa biểu, phòng học và giảng viên</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSectionCourseId(editingCourseId);
                          handleOpenCreateSection(editingCourseId);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1 font-sans shadow-xs"
                      >
                        <Plus className="h-3 w-3" /> Thêm lớp
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                      {(store.courseSections || [])
                        .filter((sec: CourseSection) => sec.courseId === editingCourseId)
                        .map((sec: CourseSection) => {
                          const teacherName = teachers.find(u => u.id === sec.teacherId)?.name || "Chưa phân công";
                          const currentCount = getSectionRegisteredCount(sec.id);

                          return (
                            <div key={sec.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 relative group font-sans">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-mono font-bold text-indigo-700 text-xs block">{sec.sectionCode}</span>
                                  <span className="text-[10px] text-slate-400 font-sans">Sĩ số: {currentCount}/{sec.maxStudents}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSectionForForum(sec);
                                      setShowForumModal(true);
                                    }}
                                    className="p-1 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded cursor-pointer transition"
                                    title="Xem thảo luận lớp học"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditSection(sec)}
                                    className="p-1 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded cursor-pointer transition"
                                    title="Sửa ca học"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSection(sec.id, sec.sectionCode)}
                                    className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition"
                                    title="Xóa lớp học"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-500 font-sans space-y-1">
                                <div>Giảng viên: <span className="text-slate-800 font-medium">{teacherName}</span></div>
                                <div className="space-y-0.5">{renderSchedule(sec.schedule)}</div>
                                {(sec.meetingUrl || sec.groupChatUrl) && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {sec.meetingUrl && (
                                      <a
                                        href={sec.meetingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-sans transition border border-blue-200/60 font-medium"
                                        title={sec.meetingUrl}
                                      >
                                        <ZoomLogo className="h-3 w-3 shrink-0" /> Zoom
                                      </a>
                                    )}
                                    {sec.groupChatUrl && (
                                      <a
                                        href={sec.groupChatUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-sans transition border border-emerald-200/60 font-medium"
                                      >
                                        <MessageCircle className="h-3 w-3" /> Nhóm Zalo
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                      {(store.courseSections || []).filter((sec: CourseSection) => sec.courseId === editingCourseId).length === 0 && (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-sans">
                          Chưa có lớp học phần nào được tạo cho môn học này.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal 2: CREATE/EDIT SECTION */}
      {showSectionModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-xs text-slate-900">
              <button 
                onClick={() => setShowSectionModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Calendar className="h-5 w-5 text-indigo-600" />
                {sectionModalMode === "create" ? "Tạo Lớp học phần mới" : "Chỉnh sửa ca học lớp"}
              </h3>

              <form onSubmit={handleSaveSection} className="space-y-4">
                {sectionModalMode === "create" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Môn học tương ứng *</label>
                    <select
                      required
                      value={sectionCourseId}
                      onChange={(e) => {
                        setSectionCourseId(e.target.value);
                        setSectionSessionsCount(sessionsOfCourse(e.target.value));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    >
                      <option value="" disabled>-- Chọn môn học --</option>
                      {store.courses.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">Môn học</label>
                    <div className="px-3 py-2 bg-slate-100 rounded-xl text-slate-700 font-semibold border border-slate-200">
                      {(store.courses || []).find((c: any) => c.id === sectionCourseId)?.title || "Môn học"}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Mã Lớp học *</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: AI for Work 89"
                    value={sectionCode}
                    onChange={(e) => setSectionCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono shadow-xs text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Giảng viên phụ trách</label>
                    <select
                      value={sectionTeacherId}
                      onChange={(e) => setSectionTeacherId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    >
                      <option value="">-- Chưa phân công --</option>
                      {teachers.filter((t:any)=>!teacherSubjects[t.id]?.length || teacherSubjects[t.id].includes(sectionCourseId) || t.id===sectionTeacherId).map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Sĩ số tối đa</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={sectionMaxStudents}
                      onChange={(e) => setSectionMaxStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Ngày khai giảng</label>
                    <input
                      type="date"
                      value={sectionOpeningDate}
                      onChange={(e) => setSectionOpeningDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Số buổi học</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={200}
                      value={sectionSessionsCount}
                      onChange={(e) => setSectionSessionsCount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Trạng thái lớp</label>
                    <select
                      value={sectionStatus}
                      onChange={(e) => setSectionStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    >
                      <option value="pending">Chờ mở lớp (Pending)</option>
                      <option value="open">Đang mở tuyển (Open)</option>
                      <option value="closed">Đã khóa sĩ số (Closed)</option>
                      <option value="cancelled">Hủy lớp học phần (Cancelled)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Link phòng học online (Zoom / Google Meet)</label>
                    <input
                      type="url"
                      placeholder="https://meet.google.com/xyz hoặc https://zoom.us/j/..."
                      value={sectionMeetingUrl}
                      onChange={(e) => setSectionMeetingUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Link nhóm Zalo của lớp (gửi kèm email xếp lớp)</label>
                    <input
                      type="url"
                      placeholder="https://zalo.me/g/... hoặc https://discord.gg/..."
                      value={sectionGroupChatUrl}
                      onChange={(e) => setSectionGroupChatUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-xs"
                    />
                  </div>
                </div>

                {/* Local slots schedule editor */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Thời khóa biểu ca học</span>
                    <button
                      type="button"
                      onClick={() => setSectionSlots([...sectionSlots, { ...DEFAULT_SLOT }])}
                      className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer"
                    >
                      + Thêm ca học
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
                    {sectionSlots.map((slot, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                        <div className="col-span-3">
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) => {
                              const newSlots = [...sectionSlots];
                              newSlots[idx].dayOfWeek = e.target.value;
                              setSectionSlots(newSlots);
                            }}
                            className="w-full px-2 py-1 bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none font-sans text-[11px]"
                          >
                            {DAYS_OF_WEEK.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="08:00"
                            value={slot.startTime}
                            onChange={(e) => {
                              const newSlots = [...sectionSlots];
                              newSlots[idx].startTime = e.target.value;
                              setSectionSlots(newSlots);
                            }}
                            className="w-full px-2 py-1 bg-white text-slate-900 border border-slate-200 rounded-lg text-center font-mono text-[11px]"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="10:00"
                            value={slot.endTime}
                            onChange={(e) => {
                              const newSlots = [...sectionSlots];
                              newSlots[idx].endTime = e.target.value;
                              setSectionSlots(newSlots);
                            }}
                            className="w-full px-2 py-1 bg-white text-slate-900 border border-slate-200 rounded-lg text-center font-mono text-[11px]"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Online (Zoom) hoặc phòng học"
                            value={slot.room}
                            onChange={(e) => {
                              const newSlots = [...sectionSlots];
                              newSlots[idx].room = e.target.value;
                              setSectionSlots(newSlots);
                            }}
                            className="w-full px-2 py-1 bg-white text-slate-900 border border-slate-200 rounded-lg text-center text-[11px]"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            disabled={sectionSlots.length === 1}
                            onClick={() => setSectionSlots(sectionSlots.filter((_, sIdx) => sIdx !== idx))}
                            className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded disabled:opacity-40 cursor-pointer transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {formConflicts.length > 0 && (
                    <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-700 space-y-1 leading-relaxed max-h-24 overflow-y-auto">
                      <div className="font-bold flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Trùng lịch giảng dạy hoặc phòng học:</div>
                      {formConflicts.map((c, cIdx) => (
                        <div key={cIdx}>- {c}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSectionModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-xs"
                  >
                    Lưu ca học
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal 3: MANAGE LESSONS LIST */}
      {showLessonsModal && selectedCourseForLessons && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative text-xs text-slate-900">
              <button 
                onClick={() => setShowLessonsModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 pr-8">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 font-sans">
                    <BookOpen className="h-5 w-5 text-indigo-600 font-sans" />
                    Quản lý bài học: {selectedCourseForLessons.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5">Xem và cập nhật khung chương trình từng buổi học của môn học.</p>
                </div>
                <button
                  onClick={handleOpenCreateLesson}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 font-sans shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm Bài học
                </button>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {(store.lessons || [])
                  .filter((l: any) => l.courseId === selectedCourseForLessons.id)
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((lesson: any) => (
                    <div key={lesson.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 text-indigo-700 font-mono text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                          Buổi {lesson.order}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-semibold text-slate-900 truncate text-xs font-sans">{lesson.title}</h5>
                          <p className="text-[11px] text-slate-500 truncate font-sans">{lesson.duration || "15 phút"}{lesson.videoUrl ? ` | ${lesson.videoUrl}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditLesson(lesson)}
                          className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition"
                          title="Chỉnh sửa bài học"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                          className="p-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                          title="Xóa bài học"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                {(store.lessons || []).filter((l: any) => l.courseId === selectedCourseForLessons.id).length === 0 && (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 font-sans">
                    Chưa có bài học nào được tạo cho khóa học này.
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowLessonsModal(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer font-sans shadow-xs"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal 4: CREATE/EDIT LESSON FORM */}
      {showLessonFormModal && selectedCourseForLessons && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-xs text-slate-900">
              <button 
                onClick={() => setShowLessonFormModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-3 font-sans">
                <BookOpen className="h-5 w-5 text-indigo-600 font-sans" />
                {lessonFormMode === "create" ? "Thêm bài học mới" : "Chỉnh sửa bài học"}
              </h3>

              <form onSubmit={handleSaveLesson} className="space-y-4 font-sans">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Tiêu đề bài học *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tiêu đề bài học..."
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Buổi số *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={lessonOrder}
                      onChange={(e) => setLessonOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono shadow-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Thời lượng bài học *</label>
                    <input
                      type="text"
                      required
                      placeholder="ví dụ: 15 mins, 2 giờ..."
                      value={lessonDuration}
                      onChange={(e) => setLessonDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans shadow-xs text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Đường dẫn hoặc Tải lên video bài giảng (nếu có)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ví dụ: https://www.youtube.com/watch?v=... hoặc video đã tải lên"
                      value={lessonVideoUrl}
                      onChange={(e) => setLessonVideoUrl(e.target.value)}
                      disabled={isVideoUploading}
                      className="flex-1 px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-xs"
                    />
                    <label className={`px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 flex items-center justify-center min-w-[110px] transition ${isVideoUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {isVideoUploading ? "Đang tải..." : "Tải tệp video"}
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleVideoUpload(e, setLessonVideoUrl)}
                        disabled={isVideoUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {isVideoUploading && (
                    <div className="text-[10px] text-indigo-600 animate-pulse font-sans">
                      ⏳ Đang tải video bài giảng lên máy chủ (Giới hạn tối đa 10GB). Vui lòng không đóng trình duyệt...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nội dung bài học lý thuyết / hướng dẫn *</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Nhập nội dung bài học lý thuyết, tài liệu hướng dẫn học viên..."
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans leading-relaxed text-xs shadow-xs"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowLessonFormModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer font-sans transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer font-sans shadow-xs"
                  >
                    Lưu bài học
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Student List Modal */}
      {showStudentsModal && selectedSectionForStudents && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-4xl shadow-2xl relative text-xs text-slate-900 max-h-[85vh] flex flex-col">
              <button 
                onClick={() => setShowStudentsModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Header */}
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Danh sách Học viên — Lớp {selectedSectionForStudents.sectionCode}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Môn học: <strong className="text-slate-800 font-semibold">{(store.courses || []).find((c: any) => c.id === selectedSectionForStudents.courseId)?.title || "Không rõ"}</strong>
                </p>
              </div>

              {/* Modal Content - Student List Table */}
              <div className="overflow-y-auto flex-1 pr-1">
                {(() => {
                  const sectionRegs = (store.courseRegistrations || []).filter(
                    (r: any) => r.sectionId === selectedSectionForStudents.id && r.status === "registered"
                  );

                  if (sectionRegs.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 italic">
                        Hiện chưa có học viên nào được xếp vào lớp này.
                      </div>
                    );
                  }

                  return (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold font-mono bg-slate-50">
                          <th className="py-3 px-3">Họ và Tên</th>
                          <th className="py-3 px-3">Email</th>
                          <th className="py-3 px-3">Số điện thoại</th>
                          <th className="py-3 px-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {sectionRegs.map((reg: any) => {
                          const studentUser = (store.users || []).find((u: any) => u.id === reg.studentId);
                          if (!studentUser) return null;

                          return (
                            <tr key={reg.id} className="hover:bg-slate-50/60 transition">
                              <td className="py-3 px-3 font-semibold text-slate-900">
                                {studentUser.name}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600">
                                {studentUser.email}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600">
                                {studentUser.phone || "—"}
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono text-[10px] font-semibold rounded-md border border-indigo-200/60">
                                  {reg.status === "registered" ? "Đang học" : reg.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 pt-4 mt-4 flex justify-end">
                <button
                  onClick={() => setShowStudentsModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Forum Discussion Modal */}
      {showForumModal && selectedSectionForForum && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-4xl shadow-2xl relative text-xs text-slate-900 max-h-[85vh] flex flex-col">
              <button 
                onClick={() => setShowForumModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Header */}
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  Diễn đàn Thảo luận — Lớp {selectedSectionForForum.sectionCode}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-sans">
                  Môn học: <strong className="text-slate-800 font-semibold">{(store.courses || []).find((c: any) => c.id === selectedSectionForForum.courseId)?.title || "Không rõ"}</strong>
                </p>
              </div>

              {/* Modal Content - Forum Discussion */}
              <div className="overflow-y-auto flex-1 pr-1">
                <ForumDiscussion
                  courseId={selectedSectionForForum.courseId}
                  sectionId={selectedSectionForForum.id}
                  store={store}
                  currentUser={currentUser}
                  onRefreshData={onRefreshData}
                  triggerToast={(msg) => showToast(msg)}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

const renderSectionStatus = (status: string) => {
  switch (status) {
    case "pending": return "Chờ mở lớp";
    case "open": return "Đang mở tuyển";
    case "closed": return "Đã khóa sĩ số";
    case "cancelled": return "Hủy lớp";
    default: return "Chưa rõ";
  }
};
