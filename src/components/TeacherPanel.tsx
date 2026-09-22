import React, { useState, useEffect } from "react";
import {
  BookOpen,
  HelpCircle,
  FileText,
  Plus,
  Eye,
  Edit,
  Check,
  Award,
  Settings,
  Download,
  Tv,
  Trash,
  ChevronRight,
  TrendingUp,
  BarChart,
  Users,
  Clock,
  Search,
  MessageSquare,
  X,
  PlusCircle,
  FolderPlus,
  Bell,
  Video
} from "lucide-react";
import { LMSDataStore, User, Course, Lesson, Quiz, Question, Assignment, Submission, QuizAttempt } from "../types";
import { AppStore } from "../store";
import CourseBuilder from "./teacher/CourseBuilder";
import QuizBuilder from "./teacher/QuizBuilder";
import AssignmentGrader from "./teacher/AssignmentGrader";
import GradebookTable from "./teacher/GradebookTable";
import TeacherAnalytics from "./teacher/TeacherAnalytics";
import ModalPortal from "./ModalPortal";
import NotificationInbox from "./NotificationInbox";
import { generateId } from "../utils";
import { useApiStore } from "../hooks/apiHooks";
import { api } from "../api";

interface TeacherPanelProps {
  currentUser: User;
  onLogout: () => void;
  onRefreshData: () => void;
  activeSystem?: "SIS" | "LMS";
  updateStore?: (updater: (draft: LMSDataStore) => void) => void;
}

export default function TeacherPanel({ currentUser, onLogout, onRefreshData, activeSystem = "LMS", updateStore }: TeacherPanelProps) {
  const { store, isLoading, isError } = useApiStore();

  // Local active sub-module state
  const [activeSubTab, setActiveSubTab] = useState<string>("courses");
  const [showSidebar, setShowSidebar] = useState(false);

  const handleNavClick = (tab: string) => {
    setActiveSubTab(tab);
    setShowSidebar(false);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSubTab]);

  useEffect(() => {
    const allowed = ["courses", "assignments", "notifications"];
    if (!allowed.includes(activeSubTab)) {
      setActiveSubTab("courses");
    }
  }, []);

  // Selection states
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedEssayId, setSelectedEssayId] = useState<string | null>(null);
  const [assessmentType, setAssessmentType] = useState<"quiz" | "essay">("quiz");

  // Modal control states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalMode, setCourseModalMode] = useState<"create" | "edit">("create");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  // Create / Edit course fields
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseCategory, setCourseCategory] = useState("Web Development");
  const [courseThumb, setCourseThumb] = useState("");
  const [coursePrice, setCoursePrice] = useState<number>(0);
  const [courseLevel, setCourseLevel] = useState<string>("Cơ bản");
  const [courseTags, setCourseTags] = useState<string>("");

  // Create Lesson state
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideo, setLessonVideo] = useState("");
  const [lessonDuration, setLessonDuration] = useState("15 mins");

  // Create Quiz state
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizPassing, setQuizPassing] = useState(70);
  const [quizLimit, setQuizLimit] = useState(15);
  const [quizAttempts, setQuizAttempts] = useState(3);
  const [quizDeadline, setQuizDeadline] = useState("");
  const [quizAttachmentUrl, setQuizAttachmentUrl] = useState("");

  // Add Question state
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"single" | "multiple" | "text">("single");
  const [qOptions, setQOptions] = useState<string[]>(["", "", ""]);
  const [qCorrect, setQCorrect] = useState("0");

  // Create Assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDeadline, setAssignDeadline] = useState("");
  const [assignMaxScore, setAssignMaxScore] = useState(100);
  const [assignAttachmentUrl, setAssignAttachmentUrl] = useState("");
  const [assignLessonId, setAssignLessonId] = useState("");
  const [assignType, setAssignType] = useState<"lesson" | "chapter" | "midterm" | "final">("lesson");
  const [assignSectionId, setAssignSectionId] = useState("");
  const [assignSessionId, setAssignSessionId] = useState("");

  // Grading submission state
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [gradingScore, setGradingScore] = useState(100);
  const [gradingFeedback, setGradingFeedback] = useState("");

  // General feedback messaging
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Get active teacher datasets
  const myCourses = store.courses.filter(c => c.teacherId === currentUser.id);
  const myCourseIds = myCourses.map(c => c.id);

  useEffect(() => {
    if (showAssignModal && !selectedCourseId && myCourses.length === 1) {
      setSelectedCourseId(myCourses[0].id);
    }
  }, [showAssignModal, selectedCourseId, myCourses]);

  // Handle Course creation / update
  const handleOpenCreateCourse = () => {
    setCourseModalMode("create");
    setCourseTitle("");
    setCourseDesc("");
    setCourseCategory("Web Development");
    setCourseThumb("");
    setCoursePrice(0);
    setCourseLevel("Cơ bản");
    setCourseTags("");
    setShowCourseModal(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setCourseModalMode("edit");
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDesc(course.description);
    setCourseCategory(course.category);
    setCourseThumb(course.thumbnail || "");
    setCoursePrice(course.price || 0);
    setCourseLevel(course.level || "Cơ bản");
    setCourseTags(course.tags ? course.tags.join(", ") : "");
    setShowCourseModal(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDesc.trim()) {
      triggerToast("Vui lòng điền đầy đủ các thông tin tiêu đề và mô tả khóa học.");
      return;
    }

    const storeData = AppStore.get();
    const tagsArray = courseTags
      ? courseTags.split(",").map(item => item.trim()).filter(Boolean)
      : [];

    const coursePayload = {
      title: courseTitle,
      description: courseDesc,
      teacherId: currentUser.id,
      category: courseCategory,
      thumbnail: courseThumb || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60",
      price: Number(coursePrice) || 0,
      level: courseLevel,
      tags: tagsArray
    };

    try {
      if (courseModalMode === "create") {
        await api.createCourse(coursePayload);
        triggerToast("Đã lập bản nháp khóa đào tạo mới thành công.");
      } else if (editingCourseId) {
        await api.updateCourse(editingCourseId, coursePayload);
        triggerToast("Cập nhật thông tin khóa học thành công!");
      }

      setShowCourseModal(false);
      await Promise.resolve(onRefreshData());
    } catch (err: any) {
      triggerToast(err.message || "Không thể lưu thông tin khóa học.");
    }
    return;

    if (courseModalMode === "create") {
      const newCourse: Course = {
        id: generateId("course"),
        title: courseTitle,
        description: courseDesc,
        teacherId: currentUser.id,
        status: "draft",
        category: courseCategory,
        thumbnail: courseThumb || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date().toISOString(),
        price: Number(coursePrice) || 0,
        level: courseLevel as any,
        tags: tagsArray
      };
      storeData.courses.push(newCourse);

      api.createCourse({
        title: courseTitle,
        description: courseDesc,
        teacherId: currentUser.id,
        category: courseCategory,
        thumbnail: courseThumb || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60",
        price: Number(coursePrice) || 0,
        level: courseLevel,
        tags: tagsArray
      }).catch(err => console.warn("Failed to create course on server:", err));

      AppStore.log(currentUser.id, "create_course_draft", newCourse.title, "Saved course outline draft successfully.");
      triggerToast("Đã lập bản nháp khóa đào tạo mới thành công.");
    } else {
      storeData.courses = storeData.courses.map(c => {
        if (c.id === editingCourseId) {
          AppStore.log(currentUser.id, "edit_course_details", c.title, "Updated course detailed descriptors.");
          return {
            ...c,
            title: courseTitle,
            description: courseDesc,
            category: courseCategory,
            thumbnail: courseThumb,
            price: Number(coursePrice) || 0,
            level: courseLevel as any,
            tags: tagsArray
          };
        }
        return c;
      });
      triggerToast("Cập nhật thông tin khóa học thành công!");
    }

    AppStore.save(storeData);
    setShowCourseModal(false);
    onRefreshData();
  };

  const handleSubmitCourseForApproval = async (courseId: string) => {
    try {
      await api.submitCourse(courseId);
      await Promise.resolve(onRefreshData());
      triggerToast("Khóa học đã được gửi duyệt thành công.");
    } catch (err: any) {
      triggerToast(err.message || "Không thể gửi duyệt khóa học.");
    }
    return;

    const storeData = AppStore.get();
    storeData.courses = storeData.courses.map(c => {
      if (c.id === courseId) {
        AppStore.log(currentUser.id, "submit_course_for_review", c.title, "Submitted course for manager approval.");
        return { ...c, status: "pending" };
      }
      return c;
    });

    api.submitCourse(courseId).catch(err => console.warn("Failed to submit course for approval on server:", err));

    AppStore.save(storeData);
    onRefreshData();
    triggerToast("Khóa học đã được gửi duyệt thành công.");
  };

  // Add Lesson to current Course
  const handleAddLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    if (!lessonTitle.trim() || !lessonContent.trim()) {
      triggerToast("Please enter title and tutorial details.");
      return;
    }

    const orderNum = (store.lessons.filter(l => l.courseId === selectedCourseId)).length + 1;

    try {
      const created = await api.addLesson({
        courseId: selectedCourseId,
        title: lessonTitle,
        content: lessonContent,
        videoUrl: lessonVideo || undefined,
        order: orderNum,
        duration: lessonDuration
      }) as Lesson;

      if (updateStore) {
        updateStore(draft => {
          draft.lessons.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.lessons.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "add_lesson", created.title, `Added learning module inside course: ${selectedCourseId}`);
      
      setLessonTitle("");
      setLessonContent("");
      setLessonVideo("");
      setLessonDuration("15 mins");
      setShowLessonModal(false);
      triggerToast("Module successfully published inside course.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to add lesson on server.");
    }
  };

  // Create Quiz linked to Course
  const handleAddQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    if (!quizTitle.trim()) {
      triggerToast("Please provide a valid assessment caption.");
      return;
    }

    try {
      const created = await api.createQuiz({
        courseId: selectedCourseId,
        title: quizTitle,
        passingScore: quizPassing,
        timeLimit: quizLimit,
        maxAttempts: quizAttempts,
        deadline: quizDeadline || null
      }) as Quiz;

      if (updateStore) {
        updateStore(draft => {
          draft.quizzes.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.quizzes.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "create_quiz", created.title, `Added assessment linked to course: ${selectedCourseId}`);

      setSelectedQuizId(created.id);
      setQuizTitle("");
      setQuizPassing(70);
      setQuizLimit(15);
      setQuizAttempts(3);
      setQuizDeadline("");
      setQuizAttachmentUrl("");
      setShowQuizModal(false);
      triggerToast("Course final assessment criteria mapped successfully.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to create quiz on server.");
    }
  };

  // Add question to active Quiz
  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;
    if (!qText.trim()) {
      triggerToast("Please describe the question prompt.");
      return;
    }

    const cleanedOptions = qType !== "text" ? qOptions.filter(o => o.trim() !== "") : [];

    try {
      const created = await api.addQuestion(selectedQuizId, {
        text: qText,
        type: qType,
        options: cleanedOptions,
        correctAnswer: qCorrect
      }) as Question;

      if (updateStore) {
        updateStore(draft => {
          draft.questions.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.questions.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "add_quiz_question", created.text, `Added question mapping inside quiz ID: ${selectedQuizId}`);

      setQText("");
      setQOptions(["", "", ""]);
      setQCorrect("0");
      setShowQuestionModal(false);
      triggerToast("Question prompt mapped into standard checks.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to add question on server.");
    }
  };

  // Create Assignment
  const handleAddAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      triggerToast("Vui lòng chọn khóa học trước khi tạo bài tự luận.");
      return;
    }
    if (!assignTitle.trim() || !assignDesc.trim() || !assignDeadline) {
      triggerToast("All fields elements are mandatory.");
      return;
    }
    if (!assignSessionId) {
      triggerToast("Vui lòng chọn buổi học áp dụng cho bài tập.");
      return;
    }

    try {
      const created = await api.createAssignment({
        courseId: selectedCourseId,
        title: assignTitle,
        description: assignDesc,
        deadline: assignDeadline,
        maxScore: Number(assignMaxScore),
        sessionId: assignSessionId || undefined,
        type: assignType
      }) as Assignment;

      if (updateStore) {
        updateStore(draft => {
          draft.assignments.push(created);
        });
      } else {
        const storeData = AppStore.get();
        storeData.assignments.push(created);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "create_assignment", created.title, `Added task outline inside course: ${selectedCourseId}`);

      setAssignTitle("");
      setAssignDesc("");
      setAssignDeadline("");
      setAssignMaxScore(100);
      setAssignAttachmentUrl("");
      setAssignLessonId("");
      setAssignSectionId("");
      setAssignSessionId("");
      setAssignType("lesson");
      setShowAssignModal(false);
      triggerToast("Course Assignment challenge configured.");
    } catch (err: any) {
      triggerToast(err.message || "Failed to create assignment on server.");
    }
  };

  // Submit Grading Score
  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmissionId) return;

    try {
      await api.gradeAssignment({
        submissionId: activeSubmissionId,
        score: Number(gradingScore),
        feedback: gradingFeedback
      });

      if (updateStore) {
        updateStore(draft => {
          const sub = draft.submissions.find(s => s.id === activeSubmissionId);
          if (sub) {
            sub.score = Number(gradingScore);
            sub.feedback = gradingFeedback;
            sub.gradedAt = new Date().toISOString();
            
            const chal = draft.assignments.find(a => a.id === sub.assignmentId);
            const maxScore = chal?.maxScore || 100;
            AppStore.log(currentUser.id, "grade_assignment", sub.id, `Graded score ${gradingScore} with feedback: ${gradingFeedback}`);
            AppStore.notify(sub.studentId, "success", `Bài làm của bạn cho bài tập "${chal?.title || "Không tên"}" đã được chấm điểm! Điểm số: ${gradingScore}/${maxScore}. Nhận xét: ${gradingFeedback}`);
          }
        });
      } else {
        await onRefreshData();
      }

      setActiveSubmissionId(null);
      setGradingFeedback("");
      triggerToast("Đã cập nhật điểm số và nhận xét thành công!");
    } catch (err: any) {
      console.error("Failed to grade assignment on server:", err);
      triggerToast(`Lỗi chấm điểm: ${err.message || "Không thể kết nối tới máy chủ."}`);
    }
  };

  // Export Gradebook CSV
  const handleExportCSVGradebook = () => {
    const storeData = AppStore.get();
    let csvContent = "data:text/csv;charset=utf-8,Student Name,Email,Course,Assignment,Score Obtained,Max Possible Score\n";

    const mySubmissions = storeData.submissions.filter(sub => {
      const assignment = storeData.assignments.find(a => a.id === sub.assignmentId);
      return assignment && myCourseIds.includes(assignment.courseId);
    });

    mySubmissions.forEach(sub => {
      const student = storeData.users.find(u => u.id === sub.studentId);
      const assignment = storeData.assignments.find(a => a.id === sub.assignmentId);
      const course = storeData.courses.find(c => c.id === assignment?.courseId);

      const parts = [
        `"${student?.name || "Không xác định"}"`,
        `"${student?.email || "Không xác định"}"`,
        `"${course?.title || "Không xác định"}"`,
        `"${assignment?.title || "Không xác định"}"`,
        `"${sub.score ?? "Chưa chấm"}"`,
        `"${assignment?.maxScore || 100}"`
      ];
      csvContent += parts.join(",") + "\n";
    });

    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `mcna_lms_gradebook_export.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Gradebook CSV compilation exported for local download.");
  };

  // Retrieve matching subsets for Course details explorer
  const activeCourse = store.courses.find(c => c.id === selectedCourseId);
  const lessons = store.lessons.filter(l => l.courseId === selectedCourseId).sort((a,b) => a.order - b.order);
  const courseQuizzes = store.quizzes.filter(q => q.courseId === selectedCourseId);
  const courseAssignments = store.assignments.filter(a => a.courseId === selectedCourseId);

  // Retrieve Grading lists
  const myAssignments = store.assignments.filter(a => myCourseIds.includes(a.courseId));
  const myAssignmentIds = myAssignments.map(a => a.id);
  const studentSubmissionsRaw = store.submissions.filter(sub => myAssignmentIds.includes(sub.assignmentId));

  const unreadTeacherNotificationsCount = (store.notifications || []).filter(
    (n: any) => n.userId === currentUser.id && !n.isRead
  ).length;

  const teacherPanelProps = {
    activeSubTab, setActiveSubTab, selectedCourseId, setSelectedCourseId, selectedQuizId, setSelectedQuizId,
    selectedEssayId, setSelectedEssayId, assessmentType, setAssessmentType,
    showCourseModal, setShowCourseModal, courseModalMode, courseTitle, setCourseTitle, courseDesc, setCourseDesc,
    courseCategory, setCourseCategory, courseThumb, setCourseThumb, coursePrice, setCoursePrice, courseLevel, setCourseLevel, courseTags, setCourseTags,
    showLessonModal, setShowLessonModal, lessonTitle, setLessonTitle, lessonContent, setLessonContent, lessonVideo, setLessonVideo, lessonDuration, setLessonDuration,
    showQuizModal, setShowQuizModal, quizTitle, setQuizTitle, quizPassing, setQuizPassing, quizLimit, setQuizLimit, quizAttempts, setQuizAttempts, quizDeadline, setQuizDeadline, quizAttachmentUrl, setQuizAttachmentUrl,
    showQuestionModal, setShowQuestionModal, qText, setQText, qType, setQType, qOptions, setQOptions, qCorrect, setQCorrect,
    showAssignModal, setShowAssignModal, assignTitle, setAssignTitle, assignDesc, setAssignDesc, assignDeadline, setAssignDeadline, assignMaxScore, setAssignMaxScore, assignAttachmentUrl, setAssignAttachmentUrl,
    assignLessonId, setAssignLessonId, assignType, setAssignType,
    activeSubmissionId, setActiveSubmissionId, gradingScore, setGradingScore, gradingFeedback, setGradingFeedback,
    store, currentUser, myCourses, myCourseIds, handleOpenCreateCourse, handleOpenEditCourse, handleSaveCourse,
    handleSubmitCourseForApproval, handleAddLessonSubmit, handleAddQuizSubmit, handleAddQuestionSubmit, handleAddAssignmentSubmit,
    handleGradeSubmission, handleExportCSVGradebook, activeCourse, lessons, courseQuizzes, courseAssignments, myAssignments, studentSubmissionsRaw, updateStore,
    triggerToast, onRefreshData
  };

  return (
    <div className="space-y-8">
      {/* Toast Alert bottom right */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white font-medium text-xs px-4 py-3 rounded-xl shadow-xl animate-in fade-in duration-150">
          {toastMessage}
        </div>
      )}

      {/* Header section spacing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">
            Không gian Giảng dạy & Đào tạo
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Quản lý giáo án, bài giảng, lưu trữ video recording và chấm điểm bài nộp của học viên.
          </p>
        </div>
      </div>

      {/* Side-by-side dashboard layout: sidebar navigation on the left, workspace canvas on the right */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start">
        {/* Mobile: sidebar toggle bar */}
        <div className="lg:hidden w-full">
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-xs"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              <span className="font-semibold">Menu điều hướng</span>
              <span className="text-slate-400">— đang xem: <strong className="text-indigo-600">{{
                courses: "Khóa học & Bài giảng",
                assignments: "Bài tập & Chấm điểm",
                quizzes: "Đề thi & Đánh giá",
                gradebook: "Sổ điểm Tổng hợp",
                analytics: "Báo cáo Hiệu suất",
                notifications: "Hộp thư Thông báo",
              }[activeSubTab] || activeSubTab}</strong></span>
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showSidebar ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Left Navigation Sidebar */}
        <div className={`w-full lg:w-64 xl:w-72 flex flex-col gap-4 shrink-0 ${showSidebar ? "block" : "hidden"} lg:flex lg:flex-col`}>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 flex flex-col gap-1 w-full text-xs shadow-xs">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider px-3 py-2 font-semibold">
              NGHIỆP VỤ GIẢNG DẠY
            </span>
            
            <button
              onClick={() => { handleNavClick("courses"); setSelectedCourseId(null); }}
              className={`w-full text-left px-3.5 py-2.5 font-medium rounded-xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "courses" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BookOpen className={`h-4 w-4 ${activeSubTab === "courses" ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Khóa học & Bài giảng</span>
            </button>

            <button
              onClick={() => handleNavClick("assignments")}
              className={`w-full text-left px-3.5 py-2.5 font-medium rounded-xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "assignments" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Edit className={`h-4 w-4 ${activeSubTab === "assignments" ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Bài tập & Chấm điểm</span>
            </button>

            <button
              onClick={() => handleNavClick("notifications")}
              className={`w-full text-left px-3.5 py-2.5 font-medium rounded-xl transition duration-150 cursor-pointer flex items-center justify-between ${
                activeSubTab === "notifications" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Bell className={`h-4 w-4 ${activeSubTab === "notifications" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>Hộp thư Thông báo</span>
              </span>
              {unreadTeacherNotificationsCount > 0 && (
                <span className="bg-rose-50 text-rose-700 font-mono text-[10px] px-1.5 py-0.5 rounded-full border border-rose-200/80 font-medium">
                  {unreadTeacherNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Panel View Canvas */}
        <div className="flex-1 min-w-0 w-full">
          <CourseBuilder {...teacherPanelProps} />
          <QuizBuilder {...teacherPanelProps} />
          <AssignmentGrader {...teacherPanelProps} />
          <GradebookTable {...teacherPanelProps} />
          <TeacherAnalytics {...teacherPanelProps} />

          {activeSubTab === "notifications" && (
            <NotificationInbox
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
              triggerToast={triggerToast}
            />
          )}
        </div>
      </div>
      
      {/* MODAL 5: CREATE ASSIGNMENT FORM (Shared in Parent) */}
      {showAssignModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-xs text-slate-900">
            <button 
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="h-5 w-5 text-indigo-600" /> Tạo Thử thách Bài tự luận Khóa học
            </h3>

            <form onSubmit={handleAddAssignmentSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Chọn Khóa học tương ứng</label>
                <select
                  required
                  value={selectedCourseId || ""}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setAssignSectionId("");
                    setAssignSessionId("");
                  }}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 font-sans"
                >
                  <option value="" disabled>-- Chọn khóa học --</option>
                  {myCourses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Tiêu đề Thử thách bài tập</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết lập Express Routing Controller"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Hạn chót Hoàn thành</label>
                  <input
                    type="datetime-local"
                    required
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Điểm tối đa</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={assignMaxScore}
                    onChange={(e) => setAssignMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Loại bài tập</label>
                  <select
                    value={assignType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setAssignType(val);
                    }}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 font-sans"
                  >
                    <option value="lesson">Bài tập buổi học</option>
                    <option value="chapter">Bài tập cuối chương</option>
                    <option value="midterm">Bài tập giữa kỳ</option>
                    <option value="final">Bài tập cuối kỳ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Chọn Lớp học phần</label>
                  <select
                    required
                    value={assignSectionId || ""}
                    onChange={(e) => {
                      setAssignSectionId(e.target.value);
                      setAssignSessionId("");
                    }}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 font-sans"
                  >
                    <option value="" disabled>-- Chọn lớp học phần --</option>
                    {(store.courseSections || [])
                      .filter((sec: any) => sec.courseId === selectedCourseId)
                      .map((sec: any) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.sectionCode}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Buổi học áp dụng</label>
                <select
                  required
                  value={assignSessionId || ""}
                  onChange={(e) => setAssignSessionId(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 font-sans"
                >
                  <option value="" disabled>-- Chọn buổi học --</option>
                  {(store.attendanceSessions || [])
                    .filter((sess: any) => sess.sectionId === assignSectionId)
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((sess: any, sIdx: number) => (
                      <option key={sess.id} value={sess.id}>
                        Buổi {sIdx + 1}: {sess.topic} ({new Date(sess.date).toLocaleDateString("vi-VN")})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Mô tả / Yêu cầu chi tiết</label>
                <textarea
                  required
                  placeholder="Dán các định dạng file hoặc yêu cầu nộp sản phẩm..."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-900 h-24 max-h-32 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 transition cursor-pointer font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Tạo Thử thách
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
