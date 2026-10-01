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
  LifeBuoy,
  ExternalLink
} from "lucide-react";
import NotificationInbox from "./NotificationInbox";
import StudentExtras from "./operations/StudentExtras";
import { LMSDataStore, User as UserType, Course, Lesson, Enrollment, LessonProgress, Quiz, Question, QuizAttempt, Assignment, Submission, Certificate, Notification, Transaction, AttendanceSession } from "../types";
import { AppStore } from "../store";
import CourseCatalog from "./student/CourseCatalog";
import MyLearningWorkspace from "./student/MyLearningWorkspace";
import StudentOrders from "./student/StudentOrders";
import { generateId, escapeHTML } from "../utils";
import { useQueryClient } from "@tanstack/react-query";
import { useApiStore } from "../hooks/apiHooks";
import { api } from "../api";
import ModalPortal from "./ModalPortal";
import PaymentQrModal from "./student/PaymentQrModal";
import { useAppConfig } from "../appConfig";

interface StudentPanelProps {
  currentUser: UserType;
  onLogout: () => void;
  onRefreshData: () => void;
  activeSystem?: "SIS" | "LMS";
}

export default function StudentPanel({ currentUser, onLogout, onRefreshData, activeSystem = "LMS" }: StudentPanelProps) {
  const { store, isLoading, isError, refetch } = useApiStore();
  const queryClient = useQueryClient();
  // Direct sale: no catalogue to self-enroll from and no QR orders; the learner only sees the classes MCNA placed them in.
  const isDirectSale = useAppConfig().salesMode === "direct";


  // Local navigation states
  const [activeSubTab, setActiveSubTab] = useState<
    | "catalog"
    | "learning"
    | "orders"
    | "notifications"
    | "extras"
  >(isDirectSale ? "learning" : "catalog");

  useEffect(() => {
    if (isDirectSale && (activeSubTab === "catalog" || activeSubTab === "orders")) setActiveSubTab("learning");
  }, [isDirectSale, activeSubTab]);

  // Auto-refresh store data whenever the notifications tab is opened
  useEffect(() => {
    if (activeSubTab === "notifications") {
      onRefreshData();
    }
  }, [activeSubTab]);

  useEffect(() => {
    const handler = (e: any) => {
      const notif = e.detail;
      if (!notif) return;
      const { relatedEntityType, relatedEntityId, message } = notif;
      const text = (message || "").toLowerCase();

      if (
        relatedEntityType === "transaction" ||
        text.includes("thanh toán") ||
        text.includes("học phí") ||
        text.includes("đơn hàng")
      ) {
        setActiveSubTab(isDirectSale ? "notifications" : "orders");
        setLearningCourseId(null);
      } else if (
        relatedEntityType === "enrollment" ||
        relatedEntityType === "section" ||
        relatedEntityType === "session" ||
        text.includes("kích hoạt") ||
        text.includes("vào lớp") ||
        text.includes("bắt đầu học") ||
        text.includes("buổi học")
      ) {
        setActiveSubTab("learning");
        if (relatedEntityId) {
          const crs = (store?.courses || []).find(c => c.id === relatedEntityId);
          if (crs) {
            setLearningCourseId(crs.id);
          } else {
            const enr = (store?.enrollments || []).find(en => en.id === relatedEntityId);
            if (enr) setLearningCourseId(enr.courseId);
          }
        }
      } else if (relatedEntityType === "course") {
        setActiveSubTab(isDirectSale ? "learning" : "catalog");
        setLearningCourseId(null);
      } else {
        setActiveSubTab("notifications");
        setLearningCourseId(null);
      }
    };
    window.addEventListener("mcna:notification_click", handler as EventListener);
    return () => window.removeEventListener("mcna:notification_click", handler as EventListener);
  }, [store?.courses, store?.enrollments, isDirectSale]);

  // Periodic polling every 30s while on the notifications tab to refresh notifications
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
  const publishedCourses = store.courses.filter(c => {
    if (c.status !== "published") return false;
    const sections = (store.courseSections || []).filter(
      (s: any) => s.courseId === c.id
    );
    const validSections = sections.filter(s => s.schedule && s.schedule.length > 0);
    return validSections.length > 0;
  });

  // Timetable conflict calculations for catalog courses
  const studentRegisteredSections = (store.courseRegistrations || [])
    .filter((r: any) => r.studentId === currentUser.id && r.status === "registered")
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
      (s: any) => s.courseId === courseId && s.schedule && s.schedule.length > 0
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
  };

  const unusedLegacyEnrollFlow = (courseId: string, price: number, courseObj: Course, storeData: LMSDataStore) => {
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

      // Optimistically update React Query cache so the UI transitions instantly (0ms)
      queryClient.setQueryData(["store"], (old: LMSDataStore | undefined) => {
        if (!old) return localStore;
        const currentSubs = [...(old.submissions || [])];
        const idx = currentSubs.findIndex(
          sub => sub.assignmentId === submittingAssignmentId && sub.studentId === currentUser.id
        );
        if (idx >= 0) {
          currentSubs[idx] = { ...currentSubs[idx], ...submitted };
        } else {
          currentSubs.unshift(submitted);
        }
        return { ...old, submissions: currentSubs };
      });

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
    onRefreshData,
    triggerToast,
    paymentGuideTx,
    setPaymentGuideTx,
    myNotifications,
    handleMarkNotificationRead
  };

  return (
    <div className="space-y-8">
      {/* Toast popup Alert bottom right */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white font-medium text-xs px-4 py-3 rounded-xl shadow-xl animate-in fade-in duration-150">
          {toastMessage}
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-xs p-4 pt-10 md:pt-14 overflow-y-auto" onClick={() => { setShowChangePassword(false); setCpError(null); setCpSuccess(false); }}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Đổi mật khẩu</h3>
              <button onClick={() => { setShowChangePassword(false); setCpError(null); setCpSuccess(false); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            {cpSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
                <p className="text-sm text-slate-900 font-semibold">Đổi mật khẩu thành công!</p>
                <p className="text-xs text-slate-500">Mật khẩu của bạn đã được cập nhật.</p>
                <button onClick={() => { setShowChangePassword(false); setCpSuccess(false); }} className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm">Đóng</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Mật khẩu hiện tại</label>
                  <input type="password" value={cpOldPass} onChange={e => { setCpOldPass(e.target.value); setCpError(null); }} placeholder="••••••••" className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Mật khẩu mới</label>
                  <input type="password" value={cpNewPass} onChange={e => { setCpNewPass(e.target.value); setCpError(null); }} placeholder="••••••••" className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Xác nhận mật khẩu mới</label>
                  <input type="password" value={cpConfirmPass} onChange={e => { setCpConfirmPass(e.target.value); setCpError(null); }} placeholder="••••••••" className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 transition" />
                </div>
                {cpError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{cpError}</p>
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
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm"
                >
                  {cpLoading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                </button>
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Side-by-side dashboard layout: sidebar navigation on the left, workspace canvas on the right */}
      <div className={`flex flex-col lg:flex-row items-start ${learningCourseId ? "gap-0" : "gap-4 lg:gap-6"}`}>
        {/* Mobile: sidebar toggle bar */}
        <div className={`${learningCourseId ? "hidden" : "lg:hidden"} w-full`}>
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:text-slate-900 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="font-semibold">{{
                catalog: "Khám phá Khóa học",
                learning: "Lớp học của tôi",
                orders: "Đơn hàng & Thanh toán",
                notifications: "Hộp thư thông báo",
                extras: "Chứng chỉ & Tư vấn",
              }[activeSubTab] || activeSubTab}</span>
              <span className="text-slate-400">Đổi mục</span>
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showSidebar ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Left Navigation Sidebar */}
        <div className={learningCourseId ? "hidden" : `w-full lg:w-56 xl:w-60 flex-col gap-4 shrink-0 ${showSidebar ? "flex" : "hidden"} lg:flex`}>
          <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-0.5 w-full text-sm">
            <span className="text-xs text-slate-500 px-3 py-2 font-semibold">
              Học viên
            </span>
            {!isDirectSale && <button
              onClick={() => { setActiveSubTab("catalog"); setLearningCourseId(null); setShowSidebar(false); }}
              className={`w-full text-left px-3 py-2.5 font-medium rounded-lg transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "catalog" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Search className={`h-4 w-4 ${activeSubTab === "catalog" ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Khám phá Khóa học</span>
            </button>}
            <button
              onClick={() => { setActiveSubTab("learning"); setShowSidebar(false); }}
              className={`w-full text-left px-3 py-2.5 font-medium rounded-lg transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "learning" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BookOpen className={`h-4 w-4 ${activeSubTab === "learning" ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Lớp học của tôi</span>
            </button>
            {isDirectSale && (
              <button onClick={() => { setActiveSubTab("extras"); setLearningCourseId(null); setShowSidebar(false); }} className={`w-full text-left px-3 py-2.5 font-medium rounded-lg flex items-center gap-2.5 ${activeSubTab === "extras" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}><Award className="h-4 w-4"/><span>Chứng chỉ & Tư vấn</span></button>
            )}
            {isDirectSale && (
              <button
                onClick={() => { setActiveSubTab("notifications"); setLearningCourseId(null); setShowSidebar(false); }}
                className={`w-full text-left px-3 py-2.5 font-medium rounded-lg transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                  activeSubTab === "notifications"
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Bell className={`h-4 w-4 ${activeSubTab === "notifications" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>Hộp thư thông báo</span>
              </button>
            )}
            {!isDirectSale && <button
              onClick={() => { setActiveSubTab("orders"); setShowSidebar(false); }}
              className={`w-full text-left px-3 py-2.5 font-medium rounded-lg transition duration-150 cursor-pointer flex items-center gap-2.5 ${
                activeSubTab === "orders"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <CreditCard className={`h-4 w-4 ${activeSubTab === "orders" ? "text-indigo-600" : "text-slate-400"}`} />
              <span>Đơn hàng & Thanh toán</span>
            </button>}
          </div>
        </div>

        {/* Right Canvas workspace content bodies */}
        <div ref={contentRef} className="relative flex-1 w-full min-w-0 scroll-mt-4">

        {!isDirectSale && <CourseCatalog {...studentPanelProps} />}
        <MyLearningWorkspace {...studentPanelProps} />
        {activeSubTab === "extras" && <StudentExtras/>}

        {/* Tab 5: alerts and Notifications list panel */}
        {activeSubTab === "notifications" && (
          <NotificationInbox
            store={store}
            currentUser={currentUser}
            onRefreshData={onRefreshData}
            title="Hộp thư thông báo từ Hệ thống"
          />
        )}

        {!isDirectSale && <StudentOrders {...studentPanelProps} />}

        {paymentGuideTx && !isDirectSale && (
          <PaymentQrModal
            transaction={paymentGuideTx}
            course={store.courses.find(c => c.id === paymentGuideTx.courseId)}
            onClose={() => setPaymentGuideTx(null)}
            onRefreshData={onRefreshData}
            onPaymentSuccess={() => {
              onRefreshData();
              triggerToast("Thanh toán thành công! Khóa học đã được kích hoạt.");
            }}
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
