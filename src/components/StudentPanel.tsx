import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  GraduationCap, 
  CheckCircle, 
  Bookmark, 
  Award, 
  Send, 
  Clock, 
  Play, 
  Check, 
  Lock, 
  User, 
  Bell, 
  Search, 
  ChevronRight, 
  ArrowRight,
  HelpCircle,
  FileCheck,
  AlertCircle,
  X,
  FileText,
  CreditCard,
  Phone,
  Calendar,
  Home,
  Shield,
  Activity,
  DollarSign,
  Printer,
  FileSpreadsheet,
  Cpu,
  ChevronUp,
  BadgeAlert,
  LifeBuoy
} from "lucide-react";
import NotificationInbox from "./NotificationInbox";
import { LMSDataStore, User as UserType, Course, Lesson, Enrollment, LessonProgress, Quiz, Question, QuizAttempt, Assignment, Submission, Certificate, Notification, Transaction, AttendanceRecord, AttendanceSession, TuitionFee, AcademicWarning } from "../types";
import { AppStore } from "../store";
import CourseCatalog from "./student/CourseCatalog";
import MyLearningWorkspace from "./student/MyLearningWorkspace";
import QuizConsole from "./student/QuizConsole";
import AssignmentSubmit from "./student/AssignmentSubmit";
import StudentAcademics from "./student/StudentAcademics";
import ParentPanel from "./ParentPanel";
import Timetable from "./Timetable";
import UserGuide from "./UserGuide";
import { generateId, escapeHTML } from "../utils";
import { useApiStore } from "../hooks/apiHooks";
import { api } from "../api";
import ModalPortal from "./ModalPortal";

interface StudentPanelProps {
  currentUser: UserType;
  onLogout: () => void;
  onRefreshData: () => void;
  activeSystem?: "SIS" | "LMS";
}

export default function StudentPanel({ currentUser, onLogout, onRefreshData, activeSystem = "LMS" }: StudentPanelProps) {
  const { store, isLoading, isError, refetch } = useApiStore();


  // Safeguard StudentProfile backfill so it never crashes
  const studentProfiles = store.studentProfiles || [];
  let myProfile = studentProfiles.find(p => p.userId === currentUser.id);
  if (!myProfile) {
    myProfile = {
      id: "profile_" + currentUser.id,
      userId: currentUser.id,
      studentCode: "SV2025" + currentUser.id.slice(-4),
      programId: "prog_se",
      departmentId: "dept_cs",
      academicYear: 1,
      enrollmentDate: new Date().toISOString().slice(0, 10),
      expectedGraduation: "2029-06-30",
      status: "active",
      gpa: 0.0,
      totalCreditsEarned: 0,
      phone: "",
      dateOfBirth: "",
      gender: "Nam",
      address: "",
      guardianName: "",
      guardianPhone: ""
    };
  }

  // Profile forms editable fields states
  const [editPhone, setEditPhone] = useState(myProfile.phone || "");
  const [editBirth, setEditBirth] = useState(myProfile.dateOfBirth || "");
  const [editGender, setEditGender] = useState(myProfile.gender || "Nam");
  const [editAddress, setEditAddress] = useState(myProfile.address || "");
  const [editParent, setEditParent] = useState(myProfile.guardianName || "");
  const [editParentPhone, setEditParentPhone] = useState(myProfile.guardianPhone || "");
  const [showProfileEditForm, setShowProfileEditForm] = useState(false);

  // Active Transcript Print view overlay
  const [showPrintTranscript, setShowPrintTranscript] = useState(false);

  // Local navigation states
  const [activeSubTab, setActiveSubTab] = useState<
    | "catalog" 
    | "learning" 
    | "student_tuition"
    | "quizzes" 
    | "assignments" 
    | "certificates" 
    | "notifications"
    | "profile"
    | "academics_record"
    | "student_attendance"
    | "student_transcript"
    | "parent_view"
    | "student_guide"
    | "student_timetable"
  >("catalog");

  // Auto-refresh store data whenever the notifications tab is opened
  useEffect(() => {
    if (activeSubTab === "notifications") {
      onRefreshData();
    }
  }, [activeSubTab]);

  // Periodic polling every 30s while on the notifications tab to catch new attendance links
  useEffect(() => {
    if (activeSubTab !== "notifications") return;
    const interval = setInterval(() => {
      onRefreshData();
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeSubTab]);

  // Payment popup state
  const [paymentGuideTx, setPaymentGuideTx] = useState<Transaction | null>(null);

  // Notification pagination
  const [notifPage, setNotifPage] = useState(0);
  const NOTIF_PER_PAGE = 10;
  const [locallyReadNotificationIds, setLocallyReadNotificationIds] = useState<Set<string>>(new Set());

  // User avatar dropdown menu state
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpOldPass, setCpOldPass] = useState("");
  const [cpNewPass, setCpNewPass] = useState("");
  const [cpConfirmPass, setCpConfirmPass] = useState("");
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSuccess, setCpSuccess] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);

  // Mobile sidebar visibility
  const [showSidebar, setShowSidebar] = useState(false);

  // Ref for mobile scroll-to-content
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll-to-top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-to-top or content area when activeSubTab changes
  useEffect(() => {
    if (window.innerWidth < 1024 && contentRef.current) {
      setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [activeSubTab]);

  // Selection references
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [learningCourseId, setLearningCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // Active Quiz taking session states
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const quizAnswersRef = useRef<Record<string, string>>({});
  quizAnswersRef.current = quizAnswers;
  const [quizTimeRemaining, setQuizTimeRemaining] = useState(0);
  const [quizStartedAt, setQuizStartedAt] = useState<string | null>(null);
  const [quizFinishedState, setQuizFinishedState] = useState<{
    score: number;
    passed: boolean;
    correctAnswers: number;
    total: number;
  } | null>(null);

  // Assignment submissions states
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);
  const [submissionCodeText, setSubmissionCodeText] = useState("");
  const [checkinCodes, setCheckinCodes] = useState<Record<string, string>>({});

  // Catalog filtering states
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [filterNoConflict, setFilterNoConflict] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Timer countdown effects
  useEffect(() => {
    if (activeQuizId && quizTimeRemaining > 0 && !quizFinishedState) {
      const interval = setInterval(() => {
        setQuizTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            // Auto submit
            handleAutoSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeQuizId, quizTimeRemaining, quizFinishedState]);


  // Compute active variables
  const semesters = store.semesters || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeSemesterId = semesters.find((s: any) => s.isCurrent)?.id ||
    semesters.find((s: any) => s.startDate && s.endDate && todayStr >= String(s.startDate).slice(0, 10) && todayStr <= String(s.endDate).slice(0, 10))?.id ||
    semesters[0]?.id ||
    "";

  const publishedCourses = store.courses.filter(c => {
    if (c.status !== "published") return false;
    const sections = (store.courseSections || []).filter(
      (s: any) => s.courseId === c.id && s.semesterId === activeSemesterId
    );
    const validSections = sections.filter(s => s.schedule && s.schedule.length > 0);
    return validSections.length > 0;
  });

  // Timetable conflict calculations for catalog courses
  const studentRegisteredSections = (store.courseRegistrations || [])
    .filter((r: any) => r.studentId === currentUser.id && r.semesterId === activeSemesterId && r.status === "registered")
    .map((r: any) => (store.courseSections || []).find((sec: any) => sec.id === r.sectionId))
    .filter(Boolean);

  const timeToMinutes = (timeStr: string): number => {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
  };

  const isSectionConflicting = (section: any): boolean => {
    if (!section.schedule || !Array.isArray(section.schedule)) return false;

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
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const isCourseConflicting = (courseId: string): boolean => {
    const sections = (store.courseSections || []).filter(
      (s: any) => s.courseId === courseId && s.semesterId === activeSemesterId && s.schedule && s.schedule.length > 0
    );
    if (sections.length === 0) return false;
    return sections.every(s => isSectionConflicting(s));
  };

  const filteredCatalog = publishedCourses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                          c.description.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesCategory = catalogCategory === "all" || c.category === catalogCategory;
    const matchesConflictFilter = !filterNoConflict || !isCourseConflicting(c.id);
    return matchesSearch && matchesCategory && matchesConflictFilter;
  });

  const myEnrollments = store.enrollments.filter(e => e.studentId === currentUser.id);
  const myEnrolledCourseIds = myEnrollments.map(e => e.courseId);

  // Handle Enrollment
  const handleEnrollIntoCourse = (courseId: string, sectionId?: string) => {
    const storeData = AppStore.get();
    const courseObj = storeData.courses.find(c => c.id === courseId);
    if (!courseObj) return;

    // Safety check
    if (storeData.enrollments.find(e => e.courseId === courseId && e.studentId === currentUser.id)) {
      triggerToast("Bạn đã có lượt đăng ký hoặc đang chờ xác nhận thanh toán học phí khóa học này!");
      return;
    }

    const price = courseObj.price || 0;
    api.registerEnrollment(courseId, sectionId)
      .then(() => {
        onRefreshData();
        triggerToast("Đã lập yêu cầu đăng ký học thành công!");
        if (price <= 0) {
          setViewingCourseId(null);
          setActiveSubTab("learning");
        }
      })
      .catch((err: any) => triggerToast(err.message || "Không thể đăng ký khóa học."));
    return;
    
    if (price > 0) {
      // Paid courses still wait for class placement; payment review is tracked by the transaction.
      const newEnroll: Enrollment = {
        id: generateId("enroll"),
        courseId,
        studentId: currentUser.id,
        status: "pending",
        enrolledAt: new Date().toISOString()
      };

      // Create a Transaction with status "pending"
      const newTx: Transaction = {
        id: generateId("tx"),
        studentId: currentUser.id,
        courseId,
        amount: price,
        status: "pending",
        paymentMethod: "Chuyển khoản Ngân hàng (QR)",
        createdAt: new Date().toISOString()
      };

      storeData.enrollments.push(newEnroll);
      if (!storeData.transactions) storeData.transactions = [];
      storeData.transactions.push(newTx);
      
      AppStore.log(currentUser.id, "request_enroll_paid_course", courseId, `Học viên gửi yêu cầu đăng ký khóa học: ${courseObj.title}. Số tiền học phí: ${price} VND`);
      AppStore.notify(currentUser.id, "info", `Đã gửi yêu cầu đăng ký khóa học "${courseObj.title}". Vui lòng hoàn tất chuyển khoản chuyển khoản.`);
      AppStore.save(storeData);

      onRefreshData();
      triggerToast("Đã lập yêu cầu đăng ký học thành công!");
      setPaymentGuideTx(newTx);
    } else {
      // Free course -> Set status to pending (waiting for manager assignment)
      const newEnroll: Enrollment = {
        id: generateId("enroll"),
        courseId,
        studentId: currentUser.id,
        status: "pending",
        enrolledAt: new Date().toISOString()
      };

      storeData.enrollments.push(newEnroll);
      AppStore.log(currentUser.id, "enroll_course", courseId, "Đăng ký tham gia khóa đào tạo miễn phí thành công. Trạng thái: Chờ xếp lớp.");
      AppStore.notify(currentUser.id, "success", `Đã gửi yêu cầu đăng ký khóa học "${courseObj.title}". Vui lòng chờ Giáo vụ sắp xếp lớp học phần.`);
      AppStore.save(storeData);

      onRefreshData();
      triggerToast("Đăng ký khóa học thành công! Vui lòng chờ sắp xếp lớp.");
      setViewingCourseId(null);
      setActiveSubTab("learning");
    }
  };

  // Lesson Tick Mark Toggle
  const handleToggleLessonComplete = (enrollmentId: string, lessonId: string) => {
    api.toggleProgress({ enrollmentId, lessonId })
      .then(() => onRefreshData())
      .catch((err: Error) => triggerToast(err.message || "Không thể cập nhật tiến độ bài học."));
  };

  // Launch Quiz Parameters
  const handleStartQuiz = (quiz: Quiz) => {
    if (quiz.deadline) {
      const isQuizDeadlineExpired = new Date(quiz.deadline).getTime() < Date.now();
      if (isQuizDeadlineExpired) {
        triggerToast("Đề thi trắc nghiệm này đã hết hạn nộp bài (deadline)!");
        return;
      }
    }

    const studentAttemptsCount = store.quizAttempts.filter(
      qa => qa.quizId === quiz.id && qa.studentId === currentUser.id
    ).length;

    if (studentAttemptsCount >= quiz.maxAttempts) {
      triggerToast(`Bạn đã dùng hết số lượt làm bài kiểm tra này (Tối đa: ${quiz.maxAttempts} lần)!`);
      return;
    }

    setActiveQuizId(quiz.id);
    setCurrentQuestionIndex(0);
    setQuizAnswers({});
    setQuizFinishedState(null);
    setQuizTimeRemaining(quiz.timeLimit * 60);
    setQuizStartedAt(new Date().toISOString());
  };

  const handleSelectQuizAnswer = (questionId: string, answerValue: string) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answerValue
    }));
  };

  // Auto-submit on timer end or manual check
  const handleAutoSubmitQuiz = () => {
    if (!activeQuizId) return;
    const answers = quizAnswersRef.current;
    api.submitQuiz({ quizId: activeQuizId, answers, startedAt: quizStartedAt || new Date().toISOString() })
      .then((result: any) => {
        setQuizFinishedState({
          score: result.score,
          passed: result.passed,
          correctAnswers: result.correctAnswers,
          total: result.total
        });
        setQuizStartedAt(null);
        onRefreshData();
      })
      .catch((err: any) => triggerToast(err.message || "Không thể nộp bài trắc nghiệm."));
  };

  // Send assignment files
  const handleSendAssignmentSubmit = async (e: React.FormEvent, overrideContent?: string, attachmentUrl?: string) => {
    e.preventDefault();
    const contentToUse = overrideContent !== undefined ? overrideContent : submissionCodeText;
    if (!submittingAssignmentId || !contentToUse.trim()) {
      triggerToast("Vui lòng nhập nội dung bài làm hoặc đính kèm tệp.");
      return false;
    }

    try {
      const submitted = await api.submitAssignment({
        assignmentId: submittingAssignmentId,
        content: contentToUse,
        attachmentUrl
      });
      const localStore = AppStore.get();
      const existingIndex = localStore.submissions.findIndex(
        sub => sub.assignmentId === submittingAssignmentId && sub.studentId === currentUser.id
      );
      if (existingIndex >= 0) {
        localStore.submissions[existingIndex] = {
          ...localStore.submissions[existingIndex],
          ...submitted
        };
      } else {
        localStore.submissions.unshift(submitted);
      }
      AppStore.hydrate({ ...localStore, submissions: [...localStore.submissions] });
      triggerToast("Đã nộp bài thành công!");
      setSubmissionCodeText("");
      setSubmittingAssignmentId(null);
      void onRefreshData();
      return true;
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Không thể nộp bài tập lên server.");
      return false;
    }
  };

  const handleSelfCheckinSubmit = async (sessionId: string, code: string, notificationId: string) => {
    if (!code.trim()) {
      triggerToast("Vui lòng nhập mã điểm danh 6 ký tự!");
      return;
    }
    try {
      await api.selfCheckin({ sessionId, code: code.trim().toUpperCase() });
      triggerToast("Điểm danh thành công! Trạng thái: Có mặt 🎉");
      await api.markNotificationRead(notificationId);
      void onRefreshData();
    } catch (err: any) {
      triggerToast(err.message || "Điểm danh thất bại.");
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    setLocallyReadNotificationIds(prev => new Set(prev).add(id));
    try {
      await api.markNotificationRead(id);
      void onRefreshData();
    } catch (err: any) {
      setLocallyReadNotificationIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      triggerToast(err.message || "Không thể đánh dấu thông báo đã đọc.");
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unreadIds = store.notifications.filter(n => n.userId === currentUser.id && !n.isRead).map(n => n.id);
    setLocallyReadNotificationIds(prev => {
      const next = new Set(prev);
      unreadIds.forEach(id => next.add(id));
      return next;
    });
    try {
      await api.markAllNotificationsRead();
      void onRefreshData();
    } catch (err: any) {
      setLocallyReadNotificationIds(prev => {
        const next = new Set(prev);
        unreadIds.forEach(id => next.delete(id));
        return next;
      });
      triggerToast(err.message || "Không thể đánh dấu tất cả thông báo đã đọc.");
    }
  };

  const myNotifications = store.notifications
    .filter(n => n.userId === currentUser.id)
    .map(n => locallyReadNotificationIds.has(n.id) ? { ...n, isRead: true } : n);

  // active course workspace helper values
  const currentLearningCourse = store.courses.find(c => c.id === learningCourseId);
  const currentLearningLessons = store.lessons.filter(l => l.courseId === learningCourseId).sort((a,b) => a.order - b.order);
  const activeLearningEnrollment = store.enrollments.find(e => e.courseId === learningCourseId && e.studentId === currentUser.id);
  const currentLessonContentObj = store.lessons.find(l => l.id === activeLessonId);

  const studentPanelProps = {
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
    quizStartedAt,
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
    showPrintTranscript,
    setShowPrintTranscript,
    paymentGuideTx,
    setPaymentGuideTx,
    myNotifications,
    handleMarkNotificationRead
  };

  return (
    <div className="space-y-8">
      {/* Toast popup Alert bottom right */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2563eb] text-white font-medium text-xs px-4 py-3 rounded-2xl shadow-2xl border border-white/10 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-6 md:pt-10 overflow-y-auto" onClick={() => { setShowChangePassword(false); setCpError(null); setCpSuccess(false); }}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-white">Đổi mật khẩu</h3>
              <button onClick={() => { setShowChangePassword(false); setCpError(null); setCpSuccess(false); }} className="text-white/40 hover:text-white transition cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            {cpSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-sm text-white font-semibold">Đổi mật khẩu thành công!</p>
                <p className="text-xs text-white/50">Mật khẩu của bạn đã được cập nhật.</p>
                <button onClick={() => { setShowChangePassword(false); setCpSuccess(false); }} className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer">Đóng</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-mono uppercase tracking-widest">Mật khẩu hiện tại</label>
                  <input type="password" value={cpOldPass} onChange={e => { setCpOldPass(e.target.value); setCpError(null); }} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-mono uppercase tracking-widest">Mật khẩu mới</label>
                  <input type="password" value={cpNewPass} onChange={e => { setCpNewPass(e.target.value); setCpError(null); }} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-mono uppercase tracking-widest">Xác nhận mật khẩu mới</label>
                  <input type="password" value={cpConfirmPass} onChange={e => { setCpConfirmPass(e.target.value); setCpError(null); }} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" />
                </div>
                {cpError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">{cpError}</p>
                )}
                <button
                  disabled={cpLoading}
                  onClick={async () => {
                    if (!cpOldPass || !cpNewPass || !cpConfirmPass) { setCpError("Vui lòng điền đầy đủ thông tin."); return; }
                    if (cpNewPass.length < 6) { setCpError("Mật khẩu mới phải có ít nhất 6 ký tự."); return; }
                    if (cpNewPass !== cpConfirmPass) { setCpError("Mật khẩu xác nhận không khớp."); return; }
                    setCpLoading(true);
                    setCpError(null);
                    try {
                      const csrfToken = sessionStorage.getItem("mcna_lms_csrf");
                      const response = await fetch("/api/users/change-password", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "X-CSRF-Token": csrfToken || ""
                        },
                        credentials: "include",
                        body: JSON.stringify({ currentPassword: cpOldPass, newPassword: cpNewPass })
                      });
                      const data = await response.json();
                      if (!response.ok) {
                        setCpError(data.error || "Có lỗi xảy ra khi đổi mật khẩu.");
                        return;
                      }
                      setCpSuccess(true);
                      setCpOldPass("");
                      setCpNewPass("");
                      setCpConfirmPass("");
                    } catch {
                      setCpError("Dịch vụ xác thực không phản hồi.");
                    } finally {
                      setCpLoading(false);
                    }
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  {cpLoading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                </button>
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Header section spacing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold tracking-widest text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 uppercase">
            Cổng Học Tập Học Viên
          </span>
          <h2 className="text-2xl font-display font-bold text-white mt-1.5">Chào mừng trở lại, {currentUser.name} 🎓</h2>
          <p className="text-sm text-white/60">Khám phá các khóa học thực chiến, tham gia lớp học trực tuyến, xem lại video bài giảng và quản lý học phí.</p>
        </div>
      </div>

      {/* Side-by-side dashboard layout: sidebar navigation on the left, workspace canvas on the right */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start">
        {/* Mobile: sidebar toggle bar */}
        <div className="lg:hidden w-full">
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/70 hover:text-white hover:bg-white/8 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
              <span className="font-semibold">Menu điều hướng</span>
              <span className="text-white/40">— đang xem: <strong className="text-indigo-300">{{
                catalog: "Khám phá Khóa học",
                learning: "Lớp học của tôi",
                student_tuition: "Đơn hàng & Học phí",
                assignments: "Bài tập & Đồ án",
                certificates: "Chứng nhận của tôi",
                notifications: "Hộp thư thông báo",
              }[activeSubTab] || activeSubTab}</strong></span>
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showSidebar ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Left Navigation Sidebar */}
        <div className={`w-full lg:w-64 xl:w-72 flex flex-col gap-4 shrink-0 ${showSidebar ? "block" : "hidden"} lg:flex lg:flex-col`}>
          <div className="bg-white/3 border border-white/10 rounded-3xl p-3 flex flex-col gap-1 w-full text-xs">
            <span className="text-[10px] text-white/40 uppercase tracking-widest px-3 py-2 font-bold font-mono border-b border-white/5 mb-1.5">
              HỌC VIỆN MCNA
            </span>
            <button
              onClick={() => { setActiveSubTab("catalog"); setLearningCourseId(null); setShowSidebar(false); }}
              className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "catalog" 
                  ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Search className={`h-4.5 w-4.5 ${activeSubTab === "catalog" ? "text-indigo-300" : "text-white/40"}`} />
              <span>Khám phá Khóa học</span>
            </button>
            <button
              onClick={() => { setActiveSubTab("learning"); setShowSidebar(false); }}
              className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "learning" 
                  ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <BookOpen className={`h-4.5 w-4.5 ${activeSubTab === "learning" ? "text-indigo-300" : "text-white/40"}`} />
              <span>Lớp học của tôi</span>
            </button>
            <button
              onClick={() => { setActiveSubTab("student_tuition"); setShowSidebar(false); }}
              className={`w-full text-left px-4 py-3 font-semibold rounded-2xl transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "student_tuition" 
                  ? "bg-white/10 text-indigo-300 font-bold border border-white/10 shadow-lg shadow-indigo-500/5" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <CreditCard className={`h-4.5 w-4.5 ${activeSubTab === "student_tuition" ? "text-indigo-300" : "text-white/40"}`} />
              <span>Đơn hàng & Học phí</span>
            </button>
          </div>
        </div>

        {/* Right Canvas workspace content bodies */}
        <div ref={contentRef} className="relative flex-1 w-full bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 min-w-0 scroll-mt-4">

        <CourseCatalog {...studentPanelProps} />
        <MyLearningWorkspace {...studentPanelProps} />
        <AssignmentSubmit {...studentPanelProps} />
        {/* Tab 4: Graduation Certificates display board */}
        {activeSubTab === "certificates" && (
          <div className="space-y-6">
      {isLoading && <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">Đang tải dữ liệu...</div>}
      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          <span>Không thể tải dữ liệu từ server.</span>
          <button onClick={() => refetch()} className="shrink-0 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1 font-semibold text-red-100 hover:bg-red-500/20">Thử lại</button>
        </div>
      )}
            <h4 className="text-base font-display font-semibold text-white">Chứng nhận của tôi ({store.certificates.filter(c => c.studentId === currentUser.id).length})</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {store.certificates.filter(c => c.studentId === currentUser.id).map(cert => {
                const cTitle = store.courses.find(cr => cr.id === cert.courseId)?.title || "Curriculum Master Class";
                const enrolledVal = store.enrollments.find(e => e.id === cert.enrollmentId);

                return (
                  <div key={cert.id} className="relative overflow-hidden bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl backdrop-blur-md">
                    {/* Background glows details */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full filter blur-xl" />
                    
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <Award className="h-10 w-10 text-amber-500" />
                        <span className="text-[10px] font-mono text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">
                          Xác thực chính chủ
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">HỆ THỐNG ĐÀO TẠO E16</span>
                        <h5 className="font-display font-black text-white text-base leading-tight tracking-tight">{cTitle}</h5>
                        <p className="text-xs text-white/60 font-sans leading-relaxed">
                          Chứng nhận tốt nghiệp được trao tặng cho học viên <strong className="text-white">{currentUser.name}</strong> vì đã hoàn thành toàn diện lộ trình giáo trình và vượt qua các yêu cầu đánh giá năng lực của khóa học.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono">
                        <div>
                          <span className="text-white/40 block uppercase">Ngày cấp chứng chỉ</span>
                          <span className="text-white/70 font-semibold">{new Date(cert.issuedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white/40 block uppercase">Mã kiểm định độc bản</span>
                          <span className="text-amber-400 font-bold font-mono tracking-widest uppercase">{cert.certificateCode}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {store.certificates.filter(c => c.studentId === currentUser.id).length === 0 && (
                <div className="col-span-full text-center py-16 bg-black/15 border border-dashed border-white/5 rounded-2xl text-xs text-white/40">
                  Bạn chưa sở hữu chứng nhận nào. Hãy hoàn thành tất cả giáo trình bài học và đạt điểm bài trắc nghiệm cuối khóa để kích hoạt chứng nhận.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: alerts and Notifications list panel */}
        {activeSubTab === "notifications" && (
          <NotificationInbox
            store={store}
            currentUser={currentUser}
            onRefreshData={onRefreshData}
            title="Hộp thư thông báo từ Hệ thống"
          />
        )}

        {/* Tab SIS 1: My Profile Section */}
        <StudentAcademics {...studentPanelProps} />
        <QuizConsole {...studentPanelProps} />

        {activeSubTab === "student_guide" && (
          <UserGuide
            role="student"
            activeSystem={activeSystem}
            onClose={() => setActiveSubTab("catalog")}
          />
        )}

        {activeSubTab === "student_timetable" && (
          <Timetable
            role="student"
            currentUser={currentUser}
            store={store}
            onRefreshData={onRefreshData}
          />
        )}

        {activeSubTab === "parent_view" && (
          <ParentPanel 
            currentUser={currentUser} 
            onLogout={onLogout} 
            onRefreshData={onRefreshData} 
          />
        )}

        </div>
      </div>
      {/* Scroll-to-top floating button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 left-6 z-40 p-2.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-full shadow-2xl border border-indigo-500/30 transition-all duration-200 cursor-pointer backdrop-blur-sm"
          aria-label="Lên đầu trang"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
