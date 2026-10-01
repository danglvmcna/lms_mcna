import React from "react";
import { 
  BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, 
  ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus, 
  MapPin, Calendar, CalendarDays, Trash2, AlertCircle, Layers, Folder, FolderOpen, Video, ArrowRight, ArrowLeft, Upload, ExternalLink, Play, CheckCircle2
} from "lucide-react";
import ModalPortal from "../ModalPortal";
import { Badge, Button, buttonClass, Callout, Card, CourseCover, cx, EmptyState, PageHeader, SearchField, SectionTitle, Segmented } from "../ui";
import { AppStore } from "../../store";
import { ZoomLogo } from "../icons/BrandLogos";
import SessionMaterialsEditor from "../SessionMaterialsEditor";
import CourseIntroEditor from "./CourseIntroEditor";
import SessionHomeworkEditor from "./SessionHomeworkEditor";
import { api } from "../../api";
import ForumDiscussion, { needsReply } from "../ForumDiscussion";
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_LABEL } from "../../utils";

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];




interface ComponentProps {
  [key: string]: any;
}

export default function CourseBuilder(props: ComponentProps) {
  const [courseSearch, setCourseSearch] = React.useState("");
  const [selectedClassSectionId, setSelectedClassSectionId] = React.useState<string | null>(null);
  const [selectedClassLessonId, setSelectedClassLessonId] = React.useState("");
  const [selectedFolderSessionNumber, setSelectedFolderSessionNumber] = React.useState<number | null>(null);
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
    triggerToast,
    // contentOnly: opened from the admin / class-manager panel, where courses and classes are managed elsewhere.
    contentOnly
  } = props;

  const [preselectedSessionId, setPreselectedSessionId] = React.useState("");
  const [forumPostId, setForumPostId] = React.useState<string | null>(null);
  // Where to land once the course opens, when arriving from a notification or a course card.
  const pendingForum = React.useRef<{ courseId: string; sectionId: string | null; postId: string | null } | null>(null);
  const autoSelectedCourseRef = React.useRef<string | null>(null);

  const showForum = (sectionId: string | null, postId: string | null) => {
    setSelectedClassSectionId(sectionId);
    setSelectedFolderSessionNumber(null);
    setClassDetailTab("forum");
    setForumPostId(postId);
  };

  React.useEffect(() => {
    setSelectedClassLessonId("");
    setPreselectedSessionId("");
    const pending = pendingForum.current;
    if (pending && pending.courseId === selectedCourseId) {
      pendingForum.current = null;
      autoSelectedCourseRef.current = selectedCourseId;
      showForum(pending.sectionId, pending.postId);
      return;
    }
    setSelectedClassSectionId(null);
    setSelectedFolderSessionNumber(null);
    setClassDetailTab("lessons");
    setForumPostId(null);
  }, [selectedCourseId]);

  const openForum = (courseId: string, sectionId: string | null = null, postId: string | null = null) => {
    // A course with a single class opens straight into that class's discussion.
    const classes = (store.courseSections || []).filter((section: any) => section.courseId === courseId);
    const target = sectionId || (classes.length === 1 ? classes[0].id : null);
    if (courseId === selectedCourseId) {
      showForum(target, postId);
    } else {
      pendingForum.current = { courseId, sectionId: target, postId };
      setSelectedCourseId(courseId);
    }
  };

  React.useEffect(() => {
    const handler = (event: Event) => {
      const { courseId, sectionId, postId } = (event as CustomEvent).detail || {};
      if (courseId) openForum(courseId, sectionId || null, postId || null);
    };
    window.addEventListener("mcna:open_forum", handler);
    return () => window.removeEventListener("mcna:open_forum", handler);
  });

  // Session Edit State for Teacher
  const [showEditSessionModal, setShowEditSessionModal] = React.useState(false);
  const [editingSessionNumber, setEditingSessionNumber] = React.useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [editSessionTopic, setEditSessionTopic] = React.useState("");
  const [editSessionContent, setEditSessionContent] = React.useState("");
  const [editSessionDate, setEditSessionDate] = React.useState("");
  const [editSessionRecordingUrl, setEditSessionRecordingUrl] = React.useState("");
  const [editSessionVideoUrl, setEditSessionVideoUrl] = React.useState("");
  const [isSavingSession, setIsSavingSession] = React.useState(false);

  // Session Create State for Teacher
  const [showCreateSessionModal, setShowCreateSessionModal] = React.useState(false);
  const [newSessionNumber, setNewSessionNumber] = React.useState<number>(1);
  const [newSessionSectionId, setNewSessionSectionId] = React.useState<string>("");
  const [newSessionTopic, setNewSessionTopic] = React.useState("");
  const [newSessionDate, setNewSessionDate] = React.useState("");
  const [newSessionContent, setNewSessionContent] = React.useState("");
  const [newSessionDuration, setNewSessionDuration] = React.useState("2 giờ");
  const [newSessionVideoUrl, setNewSessionVideoUrl] = React.useState("");
  const [newSessionRecordingUrl, setNewSessionRecordingUrl] = React.useState("");
  const [syncLessonToCurriculum, setSyncLessonToCurriculum] = React.useState(true);
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);

  const handleOpenEditSession = (session: any) => {
    setEditingSessionNumber(session.number);
    setEditingSessionId(session.sessionId || null);
    setEditSessionTopic(session.topic || `Buổi học ${session.number}`);
    setEditSessionContent(session.content || "");
    setEditSessionDate(session.date || "");
    setEditSessionRecordingUrl(session.recordingUrl || "");
    setEditSessionVideoUrl(session.videoUrl || "");
    setShowEditSessionModal(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse) return;
    setIsSavingSession(true);
    try {
      if (editingSessionId) {
        await api.updateAttendanceSession(editingSessionId, {
          topic: editSessionTopic.trim(),
          content: editSessionContent.trim(),
          date: editSessionDate.trim() || undefined,
          recordingUrl: editSessionRecordingUrl.trim() || undefined,
          videoUrl: editSessionVideoUrl.trim() || undefined
        });
      } else {
        const currentSecId = selectedClassSectionId || (courseSections[0]?.id) || undefined;
        await api.saveAttendance({
          courseId: activeCourse.id,
          sectionId: currentSecId,
          topic: editSessionTopic.trim(),
          date: editSessionDate.trim() || new Date().toISOString(),
          content: editSessionContent.trim() || undefined,
          videoUrl: editSessionVideoUrl.trim() || undefined,
          recordingUrl: editSessionRecordingUrl.trim() || undefined,
          records: []
        });
      }
      if (triggerToast) triggerToast("Đã cập nhật thông tin buổi học & Video Recording thành công!");
      setShowEditSessionModal(false);
      onRefreshData();
    } catch (err: any) {
      if (triggerToast) triggerToast(`Lỗi: ${err.message || "Không thể lưu thông tin buổi học"}`);
    } finally {
      setIsSavingSession(false);
    }
  };

  // Local states for CourseSection management inside CourseBuilder
  const [showSectionModal, setShowSectionModal] = React.useState(false);
  const [sectionModalMode, setSectionModalMode] = React.useState<"create" | "edit">("create");
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null);
  const [showEditZoomModal, setShowEditZoomModal] = React.useState(false);
  const [editingZoomSection, setEditingZoomSection] = React.useState<any | null>(null);
  const [zoomUrlInput, setZoomUrlInput] = React.useState("");
  const [isSavingZoom, setIsSavingZoom] = React.useState(false);

  const handleOpenEditZoom = (section: any) => {
    setEditingZoomSection(section);
    setZoomUrlInput(section.meetingUrl || "");
    setShowEditZoomModal(true);
  };

  const handleSaveZoomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoomSection) return;
    setIsSavingZoom(true);
    try {
      await api.updateCourseSection(editingZoomSection.id, {
        courseId: editingZoomSection.courseId,
        teacherId: editingZoomSection.teacherId,
        sectionCode: editingZoomSection.sectionCode,
        maxStudents: editingZoomSection.maxStudents,
        numberOfSessions: editingZoomSection.numberOfSessions,
        schedule: editingZoomSection.schedule || [],
        status: editingZoomSection.status,
        openingDate: editingZoomSection.openingDate,
        meetingUrl: zoomUrlInput.trim() || null
      });
      if (triggerToast) triggerToast("Đã cập nhật link Zoom cho lớp học thành công!");
      setShowEditZoomModal(false);
      props.onRefreshData?.();
    } catch (err: any) {
      if (triggerToast) triggerToast(err.message || "Không thể cập nhật link Zoom.");
    } finally {
      setIsSavingZoom(false);
    }
  };
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

    const conflicts = checkConflicts(editingSectionId, currentUser.id, formSlots);
    if (conflicts.length > 0) {
      setFormConflicts(conflicts);
      if (props.triggerToast) props.triggerToast("Phát hiện xung đột trùng lịch biểu. Vui lòng kiểm tra chi tiết báo đỏ.");
      return;
    }

    try {
      const payload = {
        courseId: activeCourse.id,
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
  const forumPosts: any[] = store.forumPosts || [];
  const unansweredCount = (courseId: string, sectionId?: string | null) =>
    forumPosts.filter(post => post.courseId === courseId && (!sectionId || post.sectionId === sectionId) && needsReply(post)).length;
  const courseAttendanceSessions = (store.attendanceSessions || [])
    .filter((session: any) => session.courseId === activeCourse?.id)
    .sort((a: any, b: any) => String(b.date || "").localeCompare(String(a.date || "")));

  const selectedClassSection = selectedClassSectionId
    ? courseSections.find((section: any) => section.id === selectedClassSectionId)
    : null;

  // Session materials and homework belong to one class, so opening a course starts on its newest class.
  React.useEffect(() => {
    if (!activeCourse || courseSections.length === 0 || autoSelectedCourseRef.current === activeCourse.id) return;
    autoSelectedCourseRef.current = activeCourse.id;
    const newest = [...courseSections].sort((a: any, b: any) => String(b.openingDate || "").localeCompare(String(a.openingDate || "")))[0];
    setSelectedClassSectionId(newest.id);
  }, [activeCourse?.id, courseSections.length]);

  // With classes present but none chosen, a "session" would silently point at some class's session.
  const needsClassChoice = !selectedClassSectionId && courseSections.length > 0;
  const introMaterials = activeCourse
    ? (store.sessionMaterials || []).filter((material: any) => !material.sessionId && material.courseId === activeCourse.id)
    : [];
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

  const getCourseSessions = () => {
    if (!activeCourse) return [];
    const courseLessons = (lessons || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const courseAssignmentsList = courseAssignments || [];
    const courseQuizzesList = courseQuizzes || [];
    
    // Lấy attendance sessions theo lớp cụ thể nếu đã chọn, hoặc không lọc (chỉ dùng để lookup) nếu ở chế độ "Tất cả"
    const courseSessionsData = (store.attendanceSessions || [])
      .filter((s: any) => s.courseId === activeCourse.id && (!selectedClassSectionId || s.sectionId === selectedClassSectionId))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // FIX: Khi ở chế độ "Tất cả / Giáo trình môn" (không chọn lớp cụ thể),
    // KHÔNG dùng courseSessionsData.length để tính numSessions vì nó chứa sessions
    // của TẤT CẢ các lớp cùng courseId → gây nhân đôi/nhân n lần số buổi.
    // Trong chế độ này, numSessions được xác định chỉ từ giáo trình (lessons + numberOfLessons).
    const isAllSectionsMode = !selectedClassSectionId;
    const numSessions = Math.max(
      courseLessons.length, 
      isAllSectionsMode ? 0 : courseSessionsData.length,  // chỉ dùng khi lọc theo lớp cụ thể
      activeCourse.numberOfLessons || 10,
      selectedClassSection?.numberOfSessions || 0,
      1
    );

    return Array.from({ length: numSessions }, (_, idx) => {
      const sessionNum = idx + 1;
      const lessonsInSession = courseLessons.filter((l: any, lIdx: number) => (l.order ? l.order === sessionNum : lIdx === idx));
      const attendanceSession = courseSessionsData.find((s: any) => {
        const match = s.topic?.match(/Buổi\s*(?:học\s*)?(\d+)/i);
        if (match && parseInt(match[1], 10) === sessionNum) return true;
        return false;
      }) || courseSessionsData[idx] || null;
      
      const assignmentsInSession = courseAssignmentsList.filter((assign: any) => {
        if (assign.sessionId && attendanceSession) {
          return assign.sessionId === attendanceSession.id;
        }
        if (assign.lessonId) {
          return lessonsInSession.some((l: any) => l.id === assign.lessonId);
        }
        return false;
      });

      const quizzesInSession = courseQuizzesList.filter((quiz: any) => {
        if (quiz.sessionId && attendanceSession) {
          return quiz.sessionId === attendanceSession.id;
        }
        if (quiz.lessonId) {
          return lessonsInSession.some((l: any) => l.id === quiz.lessonId);
        }
        return false;
      });

      const materials = attendanceSession
        ? (store.sessionMaterials || []).filter((m: any) => m.sessionId === attendanceSession.id)
        : [];

      return {
        number: sessionNum,
        sessionId: attendanceSession?.id,
        attendanceSession,
        title: `Buổi học ${sessionNum}`,
        topic: attendanceSession?.topic || lessonsInSession[0]?.title || `Chuyên đề Buổi ${sessionNum}`,
        content: attendanceSession?.content || lessonsInSession[0]?.content || "",
        date: attendanceSession?.date,
        videoUrl: attendanceSession?.videoUrl || lessonsInSession.find((l: any) => l.videoUrl)?.videoUrl || "",
        recordingUrl: attendanceSession?.recordingUrl || "",
        materials,
        lessons: lessonsInSession,
        assignments: assignmentsInSession,
        quizzes: quizzesInSession
      };
    });
  };

  const courseSessions = activeCourse ? getCourseSessions() : [];
  const currentFolderSession = selectedFolderSessionNumber
    ? courseSessions.find(s => s.number === selectedFolderSessionNumber) || null
    : null;

  const handleOpenCreateSession = () => {
    const nextNum = (courseSessions?.length || 0) + 1;
    setNewSessionNumber(nextNum);
    setNewSessionSectionId(selectedClassSectionId || "");
    setNewSessionTopic(`Buổi ${nextNum}: `);
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewSessionDate(localIso);
    setNewSessionContent("");
    setNewSessionDuration("2 giờ");
    setNewSessionVideoUrl("");
    setNewSessionRecordingUrl("");
    setSyncLessonToCurriculum(true);
    setShowCreateSessionModal(true);
  };

  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse) return;
    if (!newSessionTopic.trim()) {
      if (triggerToast) triggerToast("Vui lòng nhập chủ đề / tiêu đề buổi học.");
      return;
    }

    setIsCreatingSession(true);
    try {
      const targetSectionId = newSessionSectionId.trim() || undefined;
      const sessionDateIso = newSessionDate ? new Date(newSessionDate).toISOString() : new Date().toISOString();

      // 1. Lưu AttendanceSession (quản lý thư mục buổi học, tài liệu, recording)
      await api.saveAttendance({
        courseId: activeCourse.id,
        sectionId: targetSectionId,
        topic: newSessionTopic.trim(),
        date: sessionDateIso,
        content: newSessionContent.trim() || undefined,
        videoUrl: newSessionVideoUrl.trim() || undefined,
        recordingUrl: newSessionRecordingUrl.trim() || undefined,
        records: []
      });

      // 2. Đồng bộ vào Lesson trong giáo trình môn học nếu được bật
      if (syncLessonToCurriculum) {
        try {
          await api.addLesson({
            courseId: activeCourse.id,
            title: newSessionTopic.trim(),
            content: newSessionContent.trim() || `Nội dung giáo án Buổi học ${newSessionNumber}`,
            videoUrl: newSessionVideoUrl.trim() || undefined,
            order: newSessionNumber,
            duration: newSessionDuration.trim() || "2 giờ"
          });
        } catch (lessonErr: any) {
          console.warn("Could not sync to curriculum lesson:", lessonErr);
        }
      }

      // 3. Nếu số thứ tự buổi học vượt quá số buổi hiện tại của khóa học, cập nhật numberOfLessons
      if (newSessionNumber > (activeCourse.numberOfLessons || 0)) {
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
            numberOfLessons: newSessionNumber
          });
        } catch (courseErr: any) {
          console.warn("Could not update course lessons count:", courseErr);
        }
      }

      if (triggerToast) triggerToast("Đã tạo buổi học mới thành công!");
      setShowCreateSessionModal(false);
      onRefreshData();
      setSelectedFolderSessionNumber(newSessionNumber);
    } catch (err: any) {
      if (triggerToast) triggerToast(`Lỗi: ${err.message || "Không thể tạo buổi học"}`);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const filteredCourses = myCourses.filter((course: any) => {
    return !courseSearch ||
      course.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.category.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.description.toLowerCase().includes(courseSearch.toLowerCase());
  });

  const COURSE_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    published: { label: "Đang mở", tone: "success" },
    pending: { label: "Chưa xuất bản", tone: "warning" },
    rejected: { label: "Bị trả về", tone: "danger" },
    draft: { label: "Bản nháp", tone: "neutral" }
  };
  const courseStatus = (status: string) => COURSE_STATUS[status] || COURSE_STATUS.draft;

  // Courses where a learner's question has no answer yet, surfaced on the course list.
  const waitingCourses = myCourses
    .map((course: any) => ({ course, count: unansweredCount(course.id) }))
    .filter((item: any) => item.count > 0);
  const waitingTotal = waitingCourses.reduce((total: number, item: any) => total + item.count, 0);

  const renderForumPane = () => {
    if (!activeCourse) return null;
    if (selectedClassSection) {
      return (
        <ForumDiscussion
          key={selectedClassSection.id}
          courseId={activeCourse.id}
          sectionId={selectedClassSection.id}
          store={store}
          currentUser={currentUser}
          onRefreshData={onRefreshData}
          triggerToast={(message: string, type?: any) => triggerToast?.(message, type)}
          initialPostId={forumPostId}
        />
      );
    }
    if (courseSections.length === 0) {
      return (
        <Card>
          <EmptyState compact illustration="chat" icon={<MessageSquare className="h-6 w-6" />} title="Khóa học chưa có lớp" description="Mỗi lớp có một góc thảo luận riêng. Khi bạn được phân công lớp, câu hỏi của học viên sẽ hiện ở đây." />
        </Card>
      );
    }
    return (
      <section className="space-y-3">
        <SectionTitle title="Thảo luận theo lớp" description="Mỗi lớp có một góc thảo luận riêng. Chọn lớp để xem và trả lời câu hỏi của học viên." />
        <Card as="ul" className="divide-y divide-slate-100 overflow-hidden">
          {courseSections.map((sec: any) => {
            const threads = forumPosts.filter(post => post.sectionId === sec.id);
            const waiting = threads.filter(needsReply).length;
            return (
              <li key={sec.id}>
                <button type="button" onClick={() => showForum(sec.id, null)} className="group flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-900/[0.025] md:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><MessageSquare className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-900 group-hover:text-indigo-700">Lớp {sec.sectionCode}</span>
                    <span className="mt-0.5 block text-[13px] text-slate-500">{threads.length ? `${threads.length} chủ đề` : "Chưa có thảo luận"}</span>
                  </span>
                  {waiting > 0 && <Badge tone="warning" dot>{waiting} chưa trả lời</Badge>}
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                </button>
              </li>
            );
          })}
        </Card>
      </section>
    );
  };

  return (
    <>
        {/* Level 1: courses this teacher is responsible for */}
        {activeSubTab === "courses" && !selectedCourseId && (
          <div className="space-y-6">
            <PageHeader
              title="Khóa học của tôi"
              subtitle={myCourses.length ? `${myCourses.length} khóa học bạn phụ trách. Chọn một khóa để quản lý buổi học, tài liệu và lớp.` : undefined}
              actions={
                <>
                  <SearchField value={courseSearch} onChange={setCourseSearch} placeholder="Tìm khóa học…" className="w-full sm:w-64" />
                  {!contentOnly && currentUser.role !== "teacher" && (
                    <Button icon={<Plus className="h-4 w-4" />} onClick={handleOpenCreateCourse}>Tạo khóa học</Button>
                  )}
                </>
              }
            />

            {waitingTotal > 0 && (
              <Callout tone="warning" icon={<MessageSquare className="h-5 w-5" />} title={`${waitingTotal} câu hỏi của học viên đang chờ bạn trả lời`}>
                <ul className="mt-1 space-y-1">
                  {waitingCourses.map(({ course, count }: any) => (
                    <li key={course.id}>
                      <button type="button" onClick={() => openForum(course.id)} className="inline-flex max-w-full items-center gap-1 text-left font-semibold underline-offset-2 hover:underline">
                        <span className="truncate">{course.title}</span>
                        <span className="shrink-0">· {count} câu hỏi</span>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Callout>
            )}

            {filteredCourses.length === 0 ? (
              <Card>
                <EmptyState
                  illustration="teach"
                  icon={<BookOpen className="h-6 w-6" />}
                  title={myCourses.length === 0 ? "Chưa có khóa học nào" : "Không tìm thấy khóa học"}
                  description={myCourses.length === 0 ? "Khi quản trị viên phân công, khóa học của bạn sẽ hiện ở đây." : "Thử tìm với từ khóa khác."}
                  action={!contentOnly && myCourses.length === 0 && currentUser.role !== "teacher" ? <Button onClick={handleOpenCreateCourse}>Tạo bản nháp khóa học</Button> : undefined}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {filteredCourses.map((course: any) => {
                  const enrolledCount = store.enrollments.filter((e: any) => e.courseId === course.id).length;
                  const sectionsCount = (store.courseSections || []).filter((s: any) => s.courseId === course.id).length;
                  const lessonsCount = (store.lessons || []).filter((l: any) => l.courseId === course.id).length;
                  const status = courseStatus(course.status);
                  const open = () => { setSelectedCourseId(course.id); setSelectedFolderSessionNumber(null); };
                  return (
                    <Card key={course.id} className="flex flex-col overflow-hidden">
                      <button type="button" onClick={open} className="group text-left">
                        <CourseCover src={course.thumbnail} title={course.title} category={course.category} className="aspect-[16/7] w-full" iconSize="h-8 w-8" />
                        <div className="space-y-2 p-5 pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-indigo-600">{course.category || "Chuyên đề"}</span>
                            <Badge tone={status.tone} dot>{status.label}</Badge>
                          </div>
                          <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-slate-900 group-hover:text-indigo-700">{course.title}</h3>
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 text-[13px] text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><Layers className="h-4 w-4" />{sectionsCount ? `${sectionsCount} lớp` : "Chưa lập lớp"}</span>
                        <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{lessonsCount} bài học</span>
                        <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{enrolledCount} học viên</span>
                        {unansweredCount(course.id) > 0 && (
                          <button type="button" onClick={() => openForum(course.id)} className="inline-flex items-center gap-1.5 font-semibold text-amber-700 hover:underline">
                            <MessageSquare className="h-4 w-4" />{unansweredCount(course.id)} câu hỏi chờ trả lời
                          </button>
                        )}
                      </div>
                      <div className="mt-auto flex gap-2 p-5 pt-4">
                        {!contentOnly && currentUser.role !== "teacher" && (
                          <Button variant="secondary" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => handleOpenEditCourse(course)}>Sửa</Button>
                        )}
                        <Button size="sm" variant="tinted" className="flex-1" onClick={open} iconRight={<ChevronRight className="h-4 w-4" />}>Quản lý khóa học</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Level 2/3: one course, its classes and sessions */}
        {activeSubTab === "courses" && selectedCourseId && activeCourse && (
          <div className="space-y-8">
            <header className="space-y-5">
              <button
                type="button"
                onClick={() => (selectedFolderSessionNumber ? setSelectedFolderSessionNumber(null) : setSelectedCourseId(null))}
                className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                <ArrowLeft className="h-4 w-4" /> {selectedFolderSessionNumber ? "Tất cả buổi học" : "Khóa học của tôi"}
              </button>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-indigo-600">{activeCourse.category || "Khóa học"}</span>
                    <Badge tone={courseStatus(activeCourse.status).tone} dot>{courseStatus(activeCourse.status).label}</Badge>
                  </div>
                  <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900 md:text-[32px]">{activeCourse.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(activeCourse.status === "draft" || activeCourse.status === "pending" || activeCourse.status === "rejected") && (
                    <Button variant="secondary" onClick={() => handleSubmitCourseForApproval(activeCourse.id)}>Xuất bản khóa học</Button>
                  )}
                  {!contentOnly && activeCourse.status === "published" && currentUser.role !== "teacher" && (
                    <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={handleOpenCreateSection}>Lập lớp học phần</Button>
                  )}
                  <Button disabled={needsClassChoice} icon={<Plus className="h-4 w-4" />} onClick={handleOpenCreateSession}>Tạo buổi học</Button>
                </div>
              </div>

              {/* Class filter */}
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <button
                  type="button"
                  onClick={() => { setSelectedClassSectionId(null); setForumPostId(null); }}
                  className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-semibold", !selectedClassSectionId ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-card ring-1 ring-slate-200/70 hover:text-slate-900")}
                >
                  Giáo trình chung
                </button>
                {courseSections.map((sec: any) => {
                  const selected = selectedClassSectionId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => { setSelectedClassSectionId(sec.id); setForumPostId(null); }}
                      className={cx("inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold", selected ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-card ring-1 ring-slate-200/70 hover:text-slate-900")}
                    >
                      Lớp {sec.sectionCode}
                      <span className={cx("rounded-full px-1.5 text-xs leading-5", selected ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{getSectionRegisteredCount(sec.id)}</span>
                    </button>
                  );
                })}
              </div>

              {selectedClassSection && (
                <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    {(selectedClassSection.schedule || []).length > 0 ? (
                      selectedClassSection.schedule.map((slot: any, idx: number) => (
                        <span key={idx} className="rounded-full bg-canvas px-3 py-1 font-medium text-slate-700">{slot.dayOfWeek} {slot.startTime}–{slot.endTime}</span>
                      ))
                    ) : (
                      <span className="text-amber-700">Chưa xếp ca học</span>
                    )}
                    <span className="text-slate-400">· {renderSectionStatus(selectedClassSection.status)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {selectedClassSection.meetingUrl ? (
                      <>
                        <a href={selectedClassSection.meetingUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "zoom" })} title={selectedClassSection.meetingUrl}>
                          <Video className="h-4 w-4" /> Vào phòng Zoom
                        </a>
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEditZoom(selectedClassSection)}>Đổi link</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<ZoomLogo className="h-4 w-4" />} onClick={() => handleOpenEditZoom(selectedClassSection)}>Gắn link Zoom</Button>
                    )}
                  </div>
                </Card>
              )}

              {!selectedFolderSessionNumber && (
                <Segmented
                  value={classDetailTab}
                  onChange={tab => (tab === "forum" ? openForum(activeCourse.id, selectedClassSectionId) : setClassDetailTab(tab))}
                  options={[
                    { value: "lessons", label: "Buổi học" },
                    { value: "forum", label: "Thảo luận", count: unansweredCount(activeCourse.id, selectedClassSectionId) }
                  ]}
                />
              )}
            </header>

            {!selectedFolderSessionNumber && <CourseIntroEditor course={activeCourse} introMaterials={introMaterials} triggerToast={triggerToast || (() => {})} onChanged={onRefreshData} />}
            {needsClassChoice && classDetailTab !== "forum" ? (
              <Callout tone="info">Chọn một lớp để quản lý buổi học, tài liệu và bài tập riêng của lớp đó.</Callout>
            ) : !selectedFolderSessionNumber && classDetailTab === "forum" ? (
              renderForumPane()
            ) : !selectedFolderSessionNumber ? (
              <section className="space-y-3">
                <SectionTitle title="Buổi học" description={`${courseSessions.length} buổi · chọn một buổi để quản lý tài liệu và video`} />
                {courseSessions.length === 0 ? (
                  <Card>
                    <EmptyState compact icon={<FolderPlus className="h-6 w-6" />} title="Chưa có buổi học nào" description="Tạo buổi học đầu tiên để đăng tài liệu cho học viên." action={<Button onClick={handleOpenCreateSession} icon={<Plus className="h-4 w-4" />}>Tạo buổi học</Button>} />
                  </Card>
                ) : (
                  <Card as="ol" className="divide-y divide-slate-100 overflow-hidden">
                    {courseSessions.map(session => (
                      <li key={session.number}>
                        <button type="button" onClick={() => setSelectedFolderSessionNumber(session.number)} className="group flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-900/[0.025] md:px-5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-display text-sm font-bold text-indigo-600">{session.number}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-slate-900 group-hover:text-indigo-700">{session.topic}</span>
                            <span className="mt-0.5 block text-[13px] text-slate-500">
                              {session.date ? new Date(session.date).toLocaleDateString("vi-VN") : "Theo thời khóa biểu"} · {session.materials.length} tài liệu{(session.videoUrl || session.recordingUrl) ? " · Video" : ""}
                            </span>
                          </span>
                          {session.materials.length === 0 && <Badge>Chưa có tài liệu</Badge>}
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                        </button>
                      </li>
                    ))}
                  </Card>
                )}
              </section>
            ) : currentFolderSession ? (
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-[13px] font-semibold text-indigo-600">
                        Buổi {currentFolderSession.number}{selectedClassSection ? ` · Lớp ${selectedClassSection.sectionCode}` : ""}
                        {currentFolderSession.date ? ` · ${new Date(currentFolderSession.date).toLocaleString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                      <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{currentFolderSession.topic}</h2>
                    </div>
                    <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => handleOpenEditSession(currentFolderSession)}>Sửa buổi học</Button>
                  </div>
                  {currentFolderSession.content && <p className="max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{currentFolderSession.content}</p>}
                  {(currentFolderSession.recordingUrl || currentFolderSession.videoUrl) && (
                    <div className="flex flex-wrap gap-2">
                      {currentFolderSession.videoUrl && (
                        <a href={currentFolderSession.videoUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "secondary" })}><Play className="h-4 w-4 text-indigo-600" /> Video bài giảng</a>
                      )}
                      {currentFolderSession.recordingUrl && (
                        <a href={currentFolderSession.recordingUrl} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "secondary" })}><Video className="h-4 w-4 text-indigo-600" /> Video ghi hình buổi học</a>
                      )}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <SectionTitle title={`Tài liệu (${currentFolderSession.materials.length})`} description="Slide, tài liệu hoặc video cho học viên của buổi này." />
                  {currentFolderSession.sessionId ? (
                    <SessionMaterialsEditor
                      sessionId={currentFolderSession.sessionId}
                      triggerToast={triggerToast || props.triggerToast || (() => {})}
                      onChanged={onRefreshData}
                      theme="light"
                    />
                  ) : (
                    <Card>
                      <EmptyState compact icon={<FolderOpen className="h-6 w-6" />} title="Buổi học chưa được kích hoạt" description="Lưu thông tin buổi học một lần để có thể tải slide và tài liệu lên." action={<Button onClick={() => handleOpenEditSession(currentFolderSession)}>Kích hoạt buổi học</Button>} />
                    </Card>
                  )}
                </section>

                {!needsClassChoice && currentFolderSession.sessionId && (
                  <div className="border-t border-slate-200 pt-6">
                    <SessionHomeworkEditor
                      courseId={activeCourse.id}
                      sessionId={currentFolderSession.sessionId}
                      sessionDate={currentFolderSession.date}
                      assignments={(courseAssignments || []).filter((assignment: any) => assignment.sessionId === currentFolderSession.sessionId)}
                      submissions={store.submissions || []}
                      triggerToast={triggerToast || props.triggerToast || (() => {})}
                      onChanged={onRefreshData}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

      {/* MODAL 1: ADD / EDIT COURSE FORMS */}
      {showCourseModal && (
        <ModalPortal>
        <div className="mcna-overlay">
          <div className="mcna-dialog sm:max-w-md">
            <button 
              onClick={() => setShowCourseModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-5 flex items-center gap-2.5 pr-10 text-lg font-bold text-slate-900">
              <BookOpen className="h-5 w-5 text-indigo-600" /> 
              {courseModalMode === "create" ? "Khởi tạo Khóa học Mới" : "Chỉnh sửa Thông tin Khóa học"}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="mcna-label">Tiêu đề Khóa học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết kế hệ thống cơ sở dữ liệu quy mô lớn"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Danh mục Chuyên môn</label>
                <select
                  value={courseCategory}
                  onChange={(e) => setCourseCategory(e.target.value)}
                  className="mcna-select w-full"
                >
                  <option value="Web Development">Phát triển Web</option>
                  <option value="Data Science">Khoa học Dữ liệu</option>
                  <option value="Software Engineering">Kỹ thuật Phần mềm</option>
                  <option value="DevOps & Infrastructure">DevOps & Hạ tầng</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Mô tả / Đề cương khóa học</label>
                <textarea
                  required
                  placeholder="Mô tả chi tiết nội dung chương trình học..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="mcna-textarea w-full h-20 max-h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="mcna-label">Mức học phí (VND)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Miễn phí"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value) || 0)}
                    className="mcna-input w-full font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="mcna-label">Trình độ đào tạo</label>
                  <select
                    value={courseLevel}
                    onChange={(e) => setCourseLevel(e.target.value)}
                    className="mcna-select w-full"
                  >
                    <option value="Cơ bản">Cơ bản</option>
                    <option value="Trung cấp">Trung cấp</option>
                    <option value="Nâng cao">Nâng cao</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Các thẻ từ khóa Tìm kiếm (tags)</label>
                <input
                  type="text"
                  placeholder="Next.js, Python, CSS (phân tách bằng dấu phẩy)"
                  value={courseTags}
                  onChange={(e) => setCourseTags(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="mcna-btn-ghost"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="mcna-btn-primary"
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
        <div className="mcna-overlay">
          <div className="mcna-dialog sm:max-w-lg">
            <button 
              onClick={() => setShowLessonModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-5 flex items-center gap-2.5 pr-10 text-lg font-bold text-slate-900">
              <Plus className="h-5 w-5 text-indigo-600" /> Thêm Bài học mới
            </h3>

            <form onSubmit={handleAddLessonSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="mcna-label">Tiêu đề Bài học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài 1. Làm việc với HTTP controllers"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="mcna-label">Video bài giảng (Không bắt buộc)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="URL hoặc tải lên"
                      value={lessonVideo}
                      onChange={(e) => setLessonVideo(e.target.value)}
                      disabled={isVideoUploading}
                      className="mcna-input flex-1 font-mono"
                    />
                    <label className={`px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer text-xs font-bold text-slate-700 flex items-center justify-center min-w-[80px] transition shadow-xs ${isVideoUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
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
                    <div className="text-xs text-indigo-600 font-sans">
                      ⏳ Đang tải video lên...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="mcna-label">Thời lượng bài học</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 20 phút"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    className="mcna-input w-full"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Nội dung hướng dẫn chi tiết (Hỗ trợ Markdown)</label>
                <textarea
                  required
                  placeholder="Mô tả hướng dẫn chi tiết từng bước cho học sinh tại đây..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  className="mcna-textarea w-full h-36 max-h-48 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="mcna-btn-ghost"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="mcna-btn-primary"
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
        <div className="mcna-overlay">
          <div className="mcna-dialog sm:max-w-lg">
            <button
              onClick={() => setShowEditLessonModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-5 flex items-center gap-2.5 pr-10 text-lg font-bold text-slate-900">
              <Edit className="h-5 w-5 text-indigo-600" /> Sửa nội dung buổi học
            </h3>
            <form onSubmit={handleSaveClassLesson} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="mcna-label">Tên buổi học</label>
                <input
                  type="text"
                  required
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="mcna-label">Thời lượng / lịch học</label>
                  <input
                    type="text"
                    required
                    value={editLessonDuration}
                    onChange={(e) => setEditLessonDuration(e.target.value)}
                    className="mcna-input w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="mcna-label">Video bài giảng</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editLessonVideo}
                      onChange={(e) => setEditLessonVideo(e.target.value)}
                      disabled={isVideoUploading}
                      className="mcna-input flex-1 font-mono min-w-0"
                    />
                    <label className={`px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer text-xs font-bold text-slate-700 flex items-center justify-center transition shadow-xs ${isVideoUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
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
                <label className="mcna-label">Nội dung bài dạy</label>
                <textarea
                  required
                  value={editLessonContent}
                  onChange={(e) => setEditLessonContent(e.target.value)}
                  className="mcna-textarea w-full h-44 max-h-64"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditLessonModal(false)}
                  className="mcna-btn-ghost"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="mcna-btn-primary"
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
          <div className="mcna-overlay">
            <div className="mcna-dialog sm:max-w-xl">
              <button 
                onClick={() => setShowSectionModal(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Layers className="h-5 w-5 text-indigo-600" /> 
                {sectionModalMode === "create" ? "Khởi tạo Lớp học phần mới" : "Chỉnh sửa Lớp học phần"}
              </h3>

              <form onSubmit={handleSaveSection} className="space-y-4 text-xs font-sans">
                {/* Basic info row */}
                <div className="space-y-1">
                  <label className="text-slate-700 block font-medium">Mã lớp học *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: AI01-L02"
                    value={formSectionCode}
                    onChange={(e) => setFormSectionCode(e.target.value.toUpperCase())}
                    className="mcna-input w-full font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 block font-medium">Sĩ số tối đa (Học viên)</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={formMaxStudents}
                      onChange={(e) => setFormMaxStudents(Number(e.target.value))}
                      className="mcna-input w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 block font-medium">Số buổi học</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={formSessionsCount}
                      onChange={(e) => setFormSessionsCount(Number(e.target.value))}
                      className="mcna-input w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-700 block font-medium">Trạng thái phê duyệt</label>
                    <div className="px-3 py-2 bg-amber-50 text-amber-800 font-semibold border border-amber-200 rounded-xl text-xs flex items-center gap-1.5 h-[34px]">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
                      <span>Chờ duyệt & xếp ca</span>
                    </div>
                  </div>
                </div>

                {/* Sub-form for schedule slots */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-semibold text-indigo-600">
                      Thời khóa biểu chi tiết ({formSlots.length})
                    </h5>
                    <button
                      type="button"
                      onClick={addFormSlot}
                      className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-100 transition cursor-pointer text-xs"
                    >
                      + Thêm ca học tuần
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {formSlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-end relative overflow-hidden"
                      >
                        <div className="space-y-1">
                          <label className="text-slate-500 text-xs block font-medium">Ngày học</label>
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) => updateFormSlot(idx, "dayOfWeek", e.target.value)}
                            className="mcna-select w-full"
                          >
                            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 text-xs block font-medium">Giờ bắt đầu</label>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => updateFormSlot(idx, "startTime", e.target.value)}
                            className="mcna-input w-full font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 text-xs block font-medium">Giờ kết thúc</label>
                          <input
                            type="time"
                            required
                            value={slot.endTime}
                            onChange={(e) => updateFormSlot(idx, "endTime", e.target.value)}
                            className="mcna-input w-full font-mono"
                          />
                        </div>

                        <div className="space-y-1 relative">
                          <label className="text-slate-500 text-xs block font-medium">Phòng học / Đường dẫn</label>
                          <input
                            type="text"
                            required
                            placeholder="Ví dụ: Phòng A101"
                            value={slot.room}
                            onChange={(e) => updateFormSlot(idx, "room", e.target.value)}
                            className="mcna-input w-full"
                          />
                          {formSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeFormSlot(idx)}
                              className="absolute -top-1.5 -right-1 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 cursor-pointer"
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
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Phát hiện trùng lịch biểu ({formConflicts.length})</span>
                    </div>
                    <ul className="list-disc pl-5 text-rose-600 space-y-1 leading-relaxed">
                      {formConflicts.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Modal Actions */}
                <div className="border-t border-slate-100 pt-4 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowSectionModal(false)}
                    className="mcna-btn-ghost"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="mcna-btn-primary"
                  >
                    Lưu thiết lập
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
      {/* MODAL: EDIT ZOOM MEETING URL */}
      {showEditZoomModal && editingZoomSection && (
        <ModalPortal>
          <div className="mcna-overlay">
            <div className="mcna-dialog sm:max-w-md">
              <button 
                onClick={() => setShowEditZoomModal(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
                <ZoomLogo className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">
                  Link phòng Zoom - Lớp {editingZoomSection.sectionCode}
                </h3>
              </div>

              <form onSubmit={handleSaveZoomUrl} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="mcna-label">Đường link phòng Zoom / Google Meet *</label>
                  <input
                    type="url"
                    required
                    value={zoomUrlInput}
                    onChange={(e) => setZoomUrlInput(e.target.value)}
                    placeholder="https://zoom.us/j/... hoặc https://meet.google.com/..."
                    className="mcna-input w-full font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Học viên ghi danh vào lớp này sẽ thấy nút vào phòng Zoom trực tuyến ngay trên đầu buổi học.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditZoomModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingZoom}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSavingZoom ? "Đang lưu..." : "Lưu link Zoom"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: EDIT SESSION & RECORDING URL */}
      {showEditSessionModal && (
        <ModalPortal>
          <div className="mcna-overlay">
            <div className="mcna-dialog sm:max-w-lg">
              <button
                onClick={() => setShowEditSessionModal(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-bold text-slate-900">
                    Cập nhật Buổi học {editingSessionNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">Chỉnh sửa chuyên đề, nội dung giáo án, video recording và thời gian ca học.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSession} className="space-y-4">
                <div className="space-y-1">
                  <label className="mcna-label">Chủ đề / Tiêu đề buổi học *</label>
                  <input
                    type="text"
                    required
                    value={editSessionTopic}
                    onChange={(e) => setEditSessionTopic(e.target.value)}
                    placeholder="Ví dụ: Giới thiệu kiến trúc & Cài đặt môi trường"
                    className="mcna-input w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="mcna-label">Nội dung tóm tắt / Giáo án buổi học</label>
                  <textarea
                    rows={3}
                    value={editSessionContent}
                    onChange={(e) => setEditSessionContent(e.target.value)}
                    placeholder="Tóm tắt các mục kiến thức cốt lõi và mục tiêu buổi học..."
                    className="mcna-textarea w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="mcna-label">Thời gian buổi học</label>
                    <input
                      type="datetime-local"
                      value={editSessionDate}
                      onChange={(e) => setEditSessionDate(e.target.value)}
                      className="mcna-input w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="mcna-label">Link Video Recording (Zoom / Drive)</label>
                    <input
                      type="url"
                      value={editSessionRecordingUrl}
                      onChange={(e) => setEditSessionRecordingUrl(e.target.value)}
                      placeholder="https://zoom.us/rec/... hoặc Drive"
                      className="mcna-input w-full font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="mcna-label">Video bài giảng trực tiếp (MP4 URL hoặc Tải lên)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={editSessionVideoUrl}
                      onChange={(e) => setEditSessionVideoUrl(e.target.value)}
                      placeholder="https://... hoặc bấm Tải tệp lên"
                      className="mcna-input w-full font-mono"
                    />
                    <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl cursor-pointer shrink-0 font-bold text-xs flex items-center gap-1 shadow-sm">
                      <Upload className="h-3.5 w-3.5" /> Tải tệp
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleVideoUpload(e, setEditSessionVideoUrl)}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditSessionModal(false)}
                    className="mcna-btn-ghost"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSession}
                    className="mcna-btn-primary"
                  >
                    {isSavingSession ? "Đang lưu..." : "Lưu thông tin buổi học"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL: CREATE NEW SESSION */}
      {showCreateSessionModal && (
        <ModalPortal>
          <div className="mcna-overlay">
            <div className="mcna-dialog sm:max-w-xl">
              <button
                type="button"
                onClick={() => setShowCreateSessionModal(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <FolderPlus className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                      GIẢNG VIÊN TẠO BUỔI HỌC
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {activeCourse?.title}
                    </span>
                  </div>
                  <h3 className="text-base font-display font-bold text-slate-900 mt-0.5">
                    Thêm Buổi học Mới cho Khóa học
                  </h3>
                </div>
              </div>

              <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="mcna-label flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" /> Buổi số *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={newSessionNumber}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setNewSessionNumber(val);
                        if (!newSessionTopic || newSessionTopic.startsWith("Buổi ")) {
                          setNewSessionTopic(`Buổi ${val}: `);
                        }
                      }}
                      className="mcna-input w-full"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="mcna-label flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-indigo-600" /> Áp dụng cho lớp học phần
                    </label>
                    <select
                      value={newSessionSectionId}
                      onChange={(e) => setNewSessionSectionId(e.target.value)}
                      className="mcna-select w-full"
                    >
                      <option value="">Tất cả các lớp / Giáo trình chung của môn</option>
                      {courseSections.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>
                          Lớp {sec.sectionCode} ({getSectionRegisteredCount(sec.id)} học viên)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="mcna-label">Chủ đề / Tiêu đề buổi học *</label>
                  <input
                    type="text"
                    required
                    value={newSessionTopic}
                    onChange={(e) => setNewSessionTopic(e.target.value)}
                    placeholder="Ví dụ: Buổi 5: Xử lý State nâng cao & Redux Toolkit"
                    className="mcna-input w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="mcna-label flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600" /> Thời gian diễn ra
                    </label>
                    <input
                      type="datetime-local"
                      value={newSessionDate}
                      onChange={(e) => setNewSessionDate(e.target.value)}
                      className="mcna-input w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="mcna-label flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-600" /> Thời lượng ước tính
                    </label>
                    <input
                      type="text"
                      value={newSessionDuration}
                      onChange={(e) => setNewSessionDuration(e.target.value)}
                      placeholder="Ví dụ: 2 giờ hoặc 90 phút"
                      className="mcna-input w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="mcna-label">Nội dung tóm tắt / Mục tiêu buổi học</label>
                  <textarea
                    rows={3}
                    value={newSessionContent}
                    onChange={(e) => setNewSessionContent(e.target.value)}
                    placeholder="Tóm tắt giáo án, kiến thức cốt lõi và bài tập cần hoàn thành trong buổi này..."
                    className="mcna-textarea w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="mcna-label flex items-center gap-1">
                    <Video className="h-3.5 w-3.5 text-indigo-600" /> Video bài giảng trực tiếp (MP4 URL hoặc tải file lên)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newSessionVideoUrl}
                      onChange={(e) => setNewSessionVideoUrl(e.target.value)}
                      placeholder="https://... hoặc tải video từ máy tính"
                      className="mcna-input w-full font-mono"
                    />
                    <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl cursor-pointer shrink-0 font-bold text-xs flex items-center gap-1 shadow-sm transition">
                      <Upload className="h-3.5 w-3.5" />
                      {isVideoUploading ? "Đang tải..." : "Tải tệp"}
                      <input
                        type="file"
                        accept="video/*"
                        disabled={isVideoUploading}
                        className="hidden"
                        onChange={(e) => handleVideoUpload(e, setNewSessionVideoUrl)}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="mcna-label flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-600" /> Link Video Recording (Zoom / Google Drive / Teams)
                  </label>
                  <input
                    type="url"
                    value={newSessionRecordingUrl}
                    onChange={(e) => setNewSessionRecordingUrl(e.target.value)}
                    placeholder="https://zoom.us/rec/... hoặc liên kết Google Drive"
                    className="mcna-input w-full font-mono"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="syncCurriculumCheckbox"
                    checked={syncLessonToCurriculum}
                    onChange={(e) => setSyncLessonToCurriculum(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="syncCurriculumCheckbox" className="text-xs text-slate-700 cursor-pointer select-none">
                    <span className="font-bold block text-slate-800">Đồng bộ vào Giáo trình bài học (Curriculum) cho học viên</span>
                    <span className="text-[11px] text-slate-500">
                      Tự động tạo một bài học (Lesson) tương ứng trong cây chương trình để học viên có thể học và theo dõi tiến độ hoàn thành.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateSessionModal(false)}
                    className="mcna-btn-ghost"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSession}
                    className="mcna-btn-primary"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingSession ? "Đang tạo buổi học..." : "Khởi tạo buổi học"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

    </>
  );
}

