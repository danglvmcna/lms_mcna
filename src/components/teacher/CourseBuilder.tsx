import React from "react";
import { 
  BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, 
  ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus, 
  MapPin, Calendar, Trash2, AlertCircle, Layers, Folder, FolderOpen, Video, ArrowRight, ArrowLeft, Upload, ExternalLink, Play, CheckCircle2
} from "lucide-react";
import ModalPortal from "../ModalPortal";
import { AppStore } from "../../store";
import { ZoomLogo } from "../icons/BrandLogos";
import SessionMaterialsEditor from "../SessionMaterialsEditor";
import { api } from "../../api";
import ForumDiscussion from "../ForumDiscussion";
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
    triggerToast
  } = props;

  const [preselectedSessionId, setPreselectedSessionId] = React.useState("");

  React.useEffect(() => {
    setSelectedClassSectionId(null);
    setSelectedClassLessonId("");
    setSelectedFolderSessionNumber(null);
    setPreselectedSessionId("");
    setClassDetailTab("lessons");
  }, [selectedCourseId]);

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

  const getCourseSessions = () => {
    if (!activeCourse) return [];
    const courseLessons = (lessons || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const courseAssignmentsList = courseAssignments || [];
    const courseQuizzesList = courseQuizzes || [];
    
    // Lấy attendance sessions của môn học và lớp đang chọn (nếu có)
    const courseSessionsData = (store.attendanceSessions || [])
      .filter((s: any) => s.courseId === activeCourse.id && (!selectedClassSectionId || s.sectionId === selectedClassSectionId))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const numSessions = Math.max(
      courseLessons.length, 
      courseSessionsData.length, 
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

      // 1. Lưu AttendanceSession (quản lý thư mục buổi, tài liệu, điểm danh, recording)
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

  return (
    <>
        {/* Tab 1: Danh sách Khóa học phụ trách (Level 1: Courses Overview) */}
        {activeSubTab === "courses" && !selectedCourseId && (
          <div className="space-y-6 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h4 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  Khóa học Phụ trách ({myCourses.length})
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quản lý giáo án, thư mục buổi học, tài liệu, bài tập và chấm điểm học viên theo từng khóa học.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm khóa học..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-white text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                  />
                </div>
                {currentUser.role !== "teacher" && (
                  <button
                    onClick={handleOpenCreateCourse}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tạo khóa học
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {filteredCourses.map((course: any) => {
                const enrolledCount = store.enrollments.filter((e: any) => e.courseId === course.id).length;
                const sectionsCount = (store.courseSections || []).filter((s: any) => s.courseId === course.id).length;
                const lessonsCount = (store.lessons || []).filter((l: any) => l.courseId === course.id).length;
                
                return (
                  <div 
                    key={course.id} 
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="h-40 w-full bg-slate-100 flex items-center justify-center relative border-b border-slate-100 overflow-hidden">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              const fallback = parent?.querySelector(".thumb-fallback");
                              if (fallback) (fallback as HTMLElement).style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div className={`thumb-fallback w-full h-full items-center justify-center ${course.thumbnail ? "hidden" : "flex"} bg-gradient-to-br from-indigo-50 to-slate-100`}>
                          <BookOpen className="h-10 w-10 text-indigo-400" />
                        </div>
                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase backdrop-blur-md shadow-sm border ${
                            course.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            course.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            course.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                            "bg-slate-100 text-slate-700 border-slate-300"
                          }`}>
                            {course.status === "published" ? "ĐANG MỞ" :
                             course.status === "pending" ? "CHỜ XUẤT BẢN" :
                             course.status === "rejected" ? "BỊ TRẢ VỀ" : "BẢN NHÁP"}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {course.category || "CHUYÊN ĐỀ"}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {sectionsCount > 0 ? `${sectionsCount} lớp học` : "Chưa lập lớp"}
                          </span>
                        </div>
                        <h5 className="font-display font-bold text-slate-900 text-base group-hover:text-indigo-600 transition leading-snug line-clamp-2">
                          {course.title}
                        </h5>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium text-[11px]">
                        👥 {enrolledCount} học viên
                      </span>
                      
                      <div className="flex gap-2">
                        {currentUser.role !== "teacher" && (
                          <button
                            onClick={() => handleOpenEditCourse(course)}
                            className="p-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 text-[11px] rounded-xl border border-slate-200 text-slate-700 font-semibold cursor-pointer flex items-center gap-1 transition"
                          >
                            <Edit className="h-3 w-3" /> Sửa
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setSelectedFolderSessionNumber(null);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-[11px] rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          Mở thư mục khóa học <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCourses.length === 0 && (
                <div className="col-span-full text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
                  <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500 mb-3">
                    {myCourses.length === 0 ? "Chưa có khóa học nào được phân công cho tài khoản này." : "Không tìm thấy khóa học nào phù hợp với từ khóa tìm kiếm."}
                  </p>
                  {myCourses.length === 0 && currentUser.role !== "teacher" && (
                    <button 
                      onClick={handleOpenCreateCourse}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                    >
                      Tạo bản nháp khóa học
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1 Detail: Quản lý Khóa học & Thư mục Buổi học (Folder View) */}
        {activeSubTab === "courses" && selectedCourseId && activeCourse && (
          <div className="space-y-6 font-sans">
            {/* Header tổng quan khóa học & Thanh công cụ */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <button 
                    onClick={() => {
                      if (selectedFolderSessionNumber) {
                        setSelectedFolderSessionNumber(null);
                      } else {
                        setSelectedCourseId(null);
                      }
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 rounded-xl cursor-pointer font-bold flex items-center gap-1 transition shrink-0"
                    title="Quay lại"
                  >
                    <ArrowLeft className="h-4 w-4" /> Quay lại
                  </button>

                  {activeCourse.thumbnail && (
                    <img src={activeCourse.thumbnail} alt="" className="h-11 w-16 object-cover rounded-xl border border-slate-200 shrink-0 shadow-sm" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                        {activeCourse.category || "KHÓA HỌC"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                        activeCourse.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        activeCourse.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        activeCourse.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {activeCourse.status === "published" ? "ĐANG MỞ" :
                         activeCourse.status === "pending" ? "CHỜ XUẤT BẢN" :
                         activeCourse.status === "rejected" ? "BỊ TRẢ VỀ" : "BẢN NHÁP"}
                      </span>
                    </div>
                    <h4 className="text-base md:text-lg font-display font-bold text-slate-900 truncate mt-0.5">
                      {activeCourse.title}
                    </h4>
                  </div>
                </div>

                {/* Quick actions for teacher */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenCreateSession}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tạo buổi học
                  </button>
                  {activeCourse.status === "published" && currentUser.role !== "teacher" && (
                    <button
                      type="button"
                      onClick={handleOpenCreateSection}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Lập lớp học phần
                    </button>
                  )}
                  {activeCourse.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => handleSubmitCourseForApproval(activeCourse.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                    >
                      Gửi duyệt khóa học
                    </button>
                  )}
                </div>
              </div>

              {/* Section selector & filter bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-600">Lớp học phần:</span>
                  <button
                    onClick={() => setSelectedClassSectionId(null)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      !selectedClassSectionId 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Tất cả / Giáo trình môn
                  </button>
                  {courseSections.map((sec: any) => (
                    <button
                      key={sec.id}
                      onClick={() => setSelectedClassSectionId(sec.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        selectedClassSectionId === sec.id 
                          ? "bg-indigo-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span>Lớp {sec.sectionCode}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                        selectedClassSectionId === sec.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {getSectionRegisteredCount(sec.id)} HS
                      </span>
                    </button>
                  ))}
                </div>

                {selectedClassSection && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 font-sans border-t border-slate-100 pt-3 mt-1 w-full">
                    <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                      <span className="font-bold text-indigo-700">TKB:</span>
                      {(selectedClassSection.schedule || []).map((slot: any, idx: number) => (
                        <span key={idx} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700">
                          {slot.dayOfWeek} ({slot.startTime}-{slot.endTime})
                        </span>
                      ))}
                      {(!selectedClassSection.schedule || selectedClassSection.schedule.length === 0) && (
                        <span className="text-amber-600 italic">Chưa xếp ca học</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedClassSection.meetingUrl ? (
                        <>
                          <a
                            href={selectedClassSection.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-200 transition shadow-xs"
                            title={selectedClassSection.meetingUrl}
                          >
                            <ZoomLogo className="h-3.5 w-3.5 shrink-0" /> Vào phòng Zoom ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => handleOpenEditZoom(selectedClassSection)}
                            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer px-1"
                          >
                            Đổi link
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEditZoom(selectedClassSection)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200"
                        >
                          <ZoomLogo className="h-3.5 w-3.5 shrink-0" /> + Gắn link Zoom cho lớp
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MAIN CONTENT: FOLDER GRID HOẶC FOLDER VIEW */}
            {!selectedFolderSessionNumber ? (
              /* LEVEL 2: LƯỚI TẤT CẢ CÁC THƯ MỤC BUỔI HỌC (FOLDER CARDS GRID) */
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h4 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                      <Folder className="h-5 w-5 text-amber-500" />
                      Các Thư mục Buổi học của Lớp
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {courseSessions.length} buổi học · Chọn một buổi để quản lý file slide bài giảng, tài liệu Word/PDF và video cho lớp.
                    </p>
                  </div>
                </div>

                {/* Grid các thư mục buổi học */}
                {courseSessions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-white p-6 space-y-3">
                    <Folder className="h-10 w-10 text-slate-300 mx-auto" />
                    <div className="text-sm font-bold text-slate-700">Chưa có buổi học nào</div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Bấm nút &quot;Tạo buổi học&quot; ở góc trên bên phải để tạo buổi học đầu tiên cho khóa học này.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {courseSessions.map((session) => {
                    return (
                      <div
                        key={session.number}
                        onClick={() => setSelectedFolderSessionNumber(session.number)}
                        className="group bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md p-5 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm relative overflow-hidden"
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 group-hover:bg-amber-100 flex items-center justify-center text-amber-600 transition shadow-sm">
                              <Folder className="h-6 w-6" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 font-mono flex items-center gap-1">
                              <FileText className="h-3 w-3 text-slate-400" /> {session.materials.length} file tài liệu
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-widest block">
                              BUỔI HỌC {session.number}
                            </span>
                            <h5 className="font-display font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-700 transition-colors line-clamp-1">
                              {session.topic}
                            </h5>
                            {session.content && (
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {session.content}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono pt-1">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold flex items-center gap-1">
                              <FileText className="h-3 w-3 text-indigo-500" /> {session.materials.length} tài liệu / slide
                            </span>
                            {(session.videoUrl || session.recordingUrl) && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-semibold flex items-center gap-0.5">
                                <Video className="h-3 w-3" /> Video
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {session.date ? new Date(session.date).toLocaleDateString("vi-VN") : "Ca học theo TKB"}
                          </span>
                          <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            Mở thư mục file <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            ) : currentFolderSession ? (
              /* LEVEL 3: CHI TIẾT THƯ MỤC BUỔI HỌC - CHỈ TẬP TRUNG QUẢN LÝ FILE & TÀI LIỆU */
              <div className="space-y-6">
                {/* Folder Breadcrumbs */}
                <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => setSelectedFolderSessionNumber(null)}
                    className="hover:text-indigo-700 flex items-center gap-1.5 font-bold transition cursor-pointer text-slate-600"
                  >
                    <Folder className="h-4 w-4 text-amber-500" /> Tổng quan khóa học
                  </button>
                  <span className="text-slate-400">/</span>
                  {selectedClassSection && (
                    <>
                      <span className="text-slate-600 font-medium">Lớp {selectedClassSection.sectionCode}</span>
                      <span className="text-slate-400">/</span>
                    </>
                  )}
                  <span className="text-slate-900 font-bold flex items-center gap-1.5 truncate">
                    <FolderOpen className="h-4 w-4 text-amber-500" /> Buổi {currentFolderSession.number}: {currentFolderSession.topic}
                  </span>
                </div>

                {/* Main Folder Banner Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                        <FolderOpen className="h-7 w-7" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            THƯ MỤC BUỔI {currentFolderSession.number}
                          </span>
                          <span className="text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {currentFolderSession.materials.length} file tài liệu
                          </span>
                          {selectedClassSection && (
                            <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              Lớp {selectedClassSection.sectionCode}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg md:text-xl font-display font-bold text-slate-900 leading-tight">
                          {currentFolderSession.title}: {currentFolderSession.topic}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSession(currentFolderSession)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Edit className="h-3.5 w-3.5" /> Sửa thông tin buổi / Video
                      </button>
                      {currentFolderSession.date && (
                        <span className="shrink-0 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-600" />
                          {new Date(currentFolderSession.date).toLocaleString("vi-VN")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Folder Description */}
                  {currentFolderSession.content && (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line">
                      {currentFolderSession.content}
                    </div>
                  )}

                  {/* Video Recording Link */}
                  {currentFolderSession.recordingUrl && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                        <Video className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                        <span>Video Recording buổi học đã có sẵn để học viên xem lại.</span>
                      </div>
                      <a
                        href={currentFolderSession.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
                      >
                        Xem Video Recording ↗
                      </a>
                    </div>
                  )}

                  {/* Direct Video Player */}
                  {currentFolderSession.videoUrl && (
                    <div className="space-y-2">
                      <span className="text-xs font-mono font-bold text-indigo-700 uppercase tracking-widest block">
                        VIDEO BÀI GIẢNG TRỰC TIẾP
                      </span>
                      <div className="bg-black border border-slate-200 rounded-2xl overflow-hidden shadow-lg max-w-2xl">
                        <div className="aspect-video w-full bg-black flex items-center justify-center">
                          <video controls src={currentFolderSession.videoUrl} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white text-xs">
                          <span className="font-bold truncate">{currentFolderSession.topic}</span>
                          <a href={currentFolderSession.videoUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Mở tab mới ↗</a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* KHU VỰC TRỌNG TÂM: QUẢN LÝ FILE & TÀI LIỆU BUỔI HỌC */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-indigo-600" />
                        Quản lý File & Slide bài giảng ({currentFolderSession.materials.length})
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tải lên slide PowerPoint (.pptx), tệp Word/PDF và đính kèm video YouTube / Google Drive cho buổi học này.
                      </p>
                    </div>
                  </div>

                  {currentFolderSession.sessionId ? (
                    <SessionMaterialsEditor
                      sessionId={currentFolderSession.sessionId}
                      triggerToast={triggerToast || props.triggerToast || (() => {})}
                      onChanged={onRefreshData}
                      theme="light"
                    />
                  ) : (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 space-y-3">
                      <p>Buổi học này chưa được kích hoạt đợt ca học để đính kèm file slide / tài liệu.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenEditSession(currentFolderSession)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-sm"
                      >
                        Khởi tạo buổi học để tải lên tài liệu
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

      {/* MODAL 1: ADD / EDIT COURSE FORMS */}
      {showCourseModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-slate-900">
            <button 
              onClick={() => setShowCourseModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-display font-bold text-slate-900 mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
              <BookOpen className="h-5 w-5 text-indigo-600" /> 
              {courseModalMode === "create" ? "Khởi tạo Khóa học Mới" : "Chỉnh sửa Thông tin Khóa học"}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tiêu đề Khóa học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết kế hệ thống cơ sở dữ liệu quy mô lớn"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Danh mục Chuyên môn</label>
                <select
                  value={courseCategory}
                  onChange={(e) => setCourseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-xs"
                >
                  <option value="Web Development">Phát triển Web</option>
                  <option value="Data Science">Khoa học Dữ liệu</option>
                  <option value="Software Engineering">Kỹ thuật Phần mềm</option>
                  <option value="DevOps & Infrastructure">DevOps & Hạ tầng</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Mô tả / Đề cương khóa học</label>
                <textarea
                  required
                  placeholder="Mô tả chi tiết nội dung chương trình học..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 h-20 max-h-24 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mức học phí (VND)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Miễn phí"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-mono shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Trình độ đào tạo</label>
                  <select
                    value={courseLevel}
                    onChange={(e) => setCourseLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-xs"
                  >
                    <option value="Cơ bản">Cơ bản</option>
                    <option value="Trung cấp">Trung cấp</option>
                    <option value="Nâng cao">Nâng cao</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Các thẻ từ khóa Tìm kiếm (tags)</label>
                <input
                  type="text"
                  placeholder="Next.js, Python, CSS (phân tách bằng dấu phẩy)"
                  value={courseTags}
                  onChange={(e) => setCourseTags(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs shadow-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            <button 
              onClick={() => setShowLessonModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-display font-bold text-slate-900 mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="h-5 w-5 text-indigo-600" /> Thêm Bài học mới
            </h3>

            <form onSubmit={handleAddLessonSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tiêu đề Bài học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài 1. Làm việc với HTTP controllers"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Video bài giảng (Không bắt buộc)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="URL hoặc tải lên"
                      value={lessonVideo}
                      onChange={(e) => setLessonVideo(e.target.value)}
                      disabled={isVideoUploading}
                      className="flex-1 px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-xs"
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
                    <div className="text-[10px] text-indigo-600 font-sans">
                      ⏳ Đang tải video lên...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Thời lượng bài học</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: 20 phút"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nội dung hướng dẫn chi tiết (Hỗ trợ Markdown)</label>
                <textarea
                  required
                  placeholder="Mô tả hướng dẫn chi tiết từng bước cho học sinh tại đây..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 h-36 max-h-48 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs shadow-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            <button
              onClick={() => setShowEditLessonModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-base font-display font-bold text-slate-900 mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Edit className="h-5 w-5 text-indigo-600" /> Sửa nội dung buổi học
            </h3>
            <form onSubmit={handleSaveClassLesson} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tên buổi học</label>
                <input
                  type="text"
                  required
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Thời lượng / lịch học</label>
                  <input
                    type="text"
                    required
                    value={editLessonDuration}
                    onChange={(e) => setEditLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Video bài giảng</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editLessonVideo}
                      onChange={(e) => setEditLessonVideo(e.target.value)}
                      disabled={isVideoUploading}
                      className="flex-1 px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-xs min-w-0 shadow-xs"
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
                <label className="text-xs font-bold text-slate-700">Nội dung bài dạy</label>
                <textarea
                  required
                  value={editLessonContent}
                  onChange={(e) => setEditLessonContent(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-800 h-44 max-h-64 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-sans text-xs leading-relaxed shadow-xs"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditLessonModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-xs"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={() => setShowSectionModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
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
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono shadow-xs"
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
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
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
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
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
                    <h5 className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-600">
                      Thời khóa biểu chi tiết ({formSlots.length})
                    </h5>
                    <button
                      type="button"
                      onClick={addFormSlot}
                      className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-100 transition cursor-pointer text-[10.5px]"
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
                          <label className="text-slate-500 text-[10px] block font-medium">Ngày học</label>
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) => updateFormSlot(idx, "dayOfWeek", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                          >
                            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 text-[10px] block font-medium">Giờ bắt đầu</label>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => updateFormSlot(idx, "startTime", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 text-[10px] block font-medium">Giờ kết thúc</label>
                          <input
                            type="time"
                            required
                            value={slot.endTime}
                            onChange={(e) => updateFormSlot(idx, "endTime", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1 relative">
                          <label className="text-slate-500 text-[10px] block font-medium">Phòng học / Đường dẫn</label>
                          <input
                            type="text"
                            required
                            placeholder="Ví dụ: Phòng A101"
                            value={slot.room}
                            onChange={(e) => updateFormSlot(idx, "room", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
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
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-150 text-slate-900 font-sans">
              <button 
                onClick={() => setShowEditZoomModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer font-sans"
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
                  <label className="text-xs font-semibold text-slate-700">Đường link phòng Zoom / Google Meet *</label>
                  <input
                    type="url"
                    required
                    value={zoomUrlInput}
                    onChange={(e) => setZoomUrlInput(e.target.value)}
                    placeholder="https://zoom.us/j/... hoặc https://meet.google.com/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white text-xs font-mono"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowEditSessionModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
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
                  <label className="text-xs font-bold text-slate-700">Chủ đề / Tiêu đề buổi học *</label>
                  <input
                    type="text"
                    required
                    value={editSessionTopic}
                    onChange={(e) => setEditSessionTopic(e.target.value)}
                    placeholder="Ví dụ: Giới thiệu kiến trúc & Cài đặt môi trường"
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nội dung tóm tắt / Giáo án buổi học</label>
                  <textarea
                    rows={3}
                    value={editSessionContent}
                    onChange={(e) => setEditSessionContent(e.target.value)}
                    placeholder="Tóm tắt các mục kiến thức cốt lõi và mục tiêu buổi học..."
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Thời gian buổi học</label>
                    <input
                      type="datetime-local"
                      value={editSessionDate}
                      onChange={(e) => setEditSessionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Link Video Recording (Zoom / Drive)</label>
                    <input
                      type="url"
                      value={editSessionRecordingUrl}
                      onChange={(e) => setEditSessionRecordingUrl(e.target.value)}
                      placeholder="https://zoom.us/rec/... hoặc Drive"
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-mono shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Video bài giảng trực tiếp (MP4 URL hoặc Tải lên)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={editSessionVideoUrl}
                      onChange={(e) => setEditSessionVideoUrl(e.target.value)}
                      placeholder="https://... hoặc bấm Tải tệp lên"
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-mono shadow-sm"
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
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSession}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-8">
              <button
                type="button"
                onClick={() => setShowCreateSessionModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
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
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                      GIẢNG VIÊN TẠO BUỔI HỌC
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500">
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
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
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
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-indigo-600" /> Áp dụng cho lớp học phần
                    </label>
                    <select
                      value={newSessionSectionId}
                      onChange={(e) => setNewSessionSectionId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
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
                  <label className="text-xs font-bold text-slate-700">Chủ đề / Tiêu đề buổi học *</label>
                  <input
                    type="text"
                    required
                    value={newSessionTopic}
                    onChange={(e) => setNewSessionTopic(e.target.value)}
                    placeholder="Ví dụ: Buổi 5: Xử lý State nâng cao & Redux Toolkit"
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600" /> Thời gian diễn ra
                    </label>
                    <input
                      type="datetime-local"
                      value={newSessionDate}
                      onChange={(e) => setNewSessionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-600" /> Thời lượng ước tính
                    </label>
                    <input
                      type="text"
                      value={newSessionDuration}
                      onChange={(e) => setNewSessionDuration(e.target.value)}
                      placeholder="Ví dụ: 2 giờ hoặc 90 phút"
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nội dung tóm tắt / Mục tiêu buổi học</label>
                  <textarea
                    rows={3}
                    value={newSessionContent}
                    onChange={(e) => setNewSessionContent(e.target.value)}
                    placeholder="Tóm tắt giáo án, kiến thức cốt lõi và bài tập cần hoàn thành trong buổi này..."
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Video className="h-3.5 w-3.5 text-indigo-600" /> Video bài giảng trực tiếp (MP4 URL hoặc tải file lên)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newSessionVideoUrl}
                      onChange={(e) => setNewSessionVideoUrl(e.target.value)}
                      placeholder="https://... hoặc tải video từ máy tính"
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-mono shadow-sm"
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
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-600" /> Link Video Recording (Zoom / Google Drive / Teams)
                  </label>
                  <input
                    type="url"
                    value={newSessionRecordingUrl}
                    onChange={(e) => setNewSessionRecordingUrl(e.target.value)}
                    placeholder="https://zoom.us/rec/... hoặc liên kết Google Drive"
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-mono shadow-sm"
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
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSession}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
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

