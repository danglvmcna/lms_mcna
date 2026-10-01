import React, { useEffect, useMemo, useState } from "react";
import NotificationInbox from "./NotificationInbox";
import { Transaction, User as UserType } from "../types";
import CourseCatalog from "./student/CourseCatalog";
import MyLearningWorkspace from "./student/MyLearningWorkspace";
import StudentOrders from "./student/StudentOrders";
import StudentHome from "./student/StudentHome";
import PaymentQrModal from "./student/PaymentQrModal";
import { useApiStore } from "../hooks/apiHooks";
import { api } from "../api";
import { AppStore } from "../store";
import { useToast } from "./ui";
import { StudentTab, StudentViewProps } from "./student/types";
import { supportsVietQr } from "./student/learning";
import { useAppConfig } from "../appConfig";
import StudentExtras from "./operations/StudentExtras";

interface StudentPanelProps {
  currentUser: UserType;
  onLogout: () => void;
  onRefreshData: () => Promise<void> | void;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  /** Bumped whenever the learner picks a tab in the app navigation, so nested views reset to their top level. */
  navNonce: number;
}

export default function StudentPanel({ currentUser, onRefreshData, activeSubTab, setActiveSubTab, navNonce }: StudentPanelProps) {
  const { store } = useApiStore();
  const toast = useToast();
  const tab = activeSubTab as StudentTab;
  const isDirectSale = useAppConfig().salesMode === "direct";
  useEffect(() => {
    if (isDirectSale && ["catalog", "orders"].includes(activeSubTab)) setActiveSubTab("learning");
  }, [isDirectSale, activeSubTab]);

  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [learningCourseId, setLearningCourseId] = useState<string | null>(null);
  const [focusSessionNumber, setFocusSessionNumber] = useState<number | null>(null);
  // A discussion thread to open in the classroom, set when arriving from a notification.
  const [focusThread, setFocusThread] = useState<{ id: string; at: number } | null>(null);
  const [paymentGuideTx, setPaymentGuideTx] = useState<Transaction | null>(null);

  // Choosing a tab in the navigation always returns to that tab's top level.
  useEffect(() => {
    setViewingCourseId(null);
    setLearningCourseId(null);
    setFocusSessionNumber(null);
    setFocusThread(null);
  }, [navNonce]);

  // Refresh when the inbox opens, then poll every 30s while it stays open.
  useEffect(() => {
    if (tab !== "notifications") return;
    void onRefreshData();
    const interval = setInterval(() => void onRefreshData(), 30_000);
    return () => clearInterval(interval);
  }, [tab]);

  // Deep links from notification clicks (bell or inbox).
  useEffect(() => {
    const handler = (e: any) => {
      const notif = e.detail;
      if (!notif) return;
      const { relatedEntityType, relatedEntityId, message } = notif;
      const text = (message || "").toLowerCase();

      // Class discussion: open the classroom on its Thảo luận tab, at the thread when we know it.
      const forumClassCode = /^Diễn đàn lớp (\S+):/.exec(message || "")?.[1];
      if (relatedEntityType === "forum_post" || forumClassCode) {
        const post = relatedEntityType === "forum_post" ? (store?.forumPosts || []).find(p => p.id === relatedEntityId) : undefined;
        const courseId = post?.courseId || (store?.courseSections || []).find(sec => sec.sectionCode === forumClassCode)?.courseId;
        setActiveSubTab("learning");
        setViewingCourseId(null);
        setLearningCourseId(courseId || null);
        setFocusSessionNumber(null);
        setFocusThread(courseId ? { id: post?.id || "", at: Date.now() } : null);
        return;
      }
      setFocusThread(null);

      if (relatedEntityType === "transaction" || text.includes("thanh toán") || text.includes("học phí") || text.includes("đơn hàng")) {
        setActiveSubTab(isDirectSale ? "extras" : "orders");
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
          const course = (store?.courses || []).find(c => c.id === relatedEntityId);
          const enrollment = (store?.enrollments || []).find(en => en.id === relatedEntityId);
          const courseId = course?.id || enrollment?.courseId;
          if (courseId) setLearningCourseId(courseId);
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
  }, [store?.courses, store?.enrollments, store?.forumPosts, store?.courseSections, isDirectSale]);

  const myEnrollments = useMemo(() => store.enrollments.filter(e => e.studentId === currentUser.id), [store.enrollments, currentUser.id]);

  const handleEnrollIntoCourse = (courseId: string, sectionId?: string) => {
    const courseObj = AppStore.get().courses.find(c => c.id === courseId) || store.courses.find(c => c.id === courseId);
    if (!courseObj) return;
    if (myEnrollments.some(e => e.courseId === courseId)) {
      toast("Bạn đã đăng ký khóa học này rồi.", "info");
      return;
    }
    api.registerEnrollment(courseId, sectionId)
      .then(async () => {
        await onRefreshData();
        setViewingCourseId(null);
        if ((courseObj.price || 0) > 0) {
          // Paid classes open straight into the VietQR payment so the learner can finish in one go.
          const pendingTx = AppStore.get().transactions.find(t => t.studentId === currentUser.id && t.courseId === courseId && t.status === "pending" && supportsVietQr(t.paymentMethod));
          setActiveSubTab("orders");
          if (pendingTx) setPaymentGuideTx(pendingTx);
          toast("Đã gửi đăng ký! Hoàn tất học phí để MCNA mở lớp cho bạn.", "success");
        } else {
          setActiveSubTab("learning");
          toast("Đã gửi đăng ký! MCNA sẽ xếp lớp cho bạn sớm.", "success");
        }
      })
      .catch((err: any) => toast(err.message || "Không thể đăng ký khóa học.", "error"));
  };

  const handleToggleLessonComplete = (enrollmentId: string, lessonId: string) =>
    api.toggleProgress({ enrollmentId, lessonId })
      .then(() => onRefreshData())
      .catch((err: Error) => toast(err.message || "Không thể cập nhật tiến độ bài học.", "error"));

  const view: StudentViewProps = {
    store,
    currentUser,
    myEnrollments,
    onRefreshData,
    toast,
    go: next => {
      setActiveSubTab(next);
      setViewingCourseId(null);
      setLearningCourseId(null);
      setFocusThread(null);
      window.scrollTo({ top: 0 });
    },
    openCourse: courseId => {
      setActiveSubTab("catalog");
      setLearningCourseId(null);
      setViewingCourseId(courseId);
      window.scrollTo({ top: 0 });
    },
    openClassroom: (courseId, sessionNumber) => {
      setActiveSubTab("learning");
      setViewingCourseId(null);
      setLearningCourseId(courseId);
      setFocusSessionNumber(sessionNumber ?? null);
      setFocusThread(null);
      window.scrollTo({ top: 0 });
    },
    openPayment: setPaymentGuideTx
  };

  return (
    <>
      {tab === "home" && <StudentHome {...view} />}
      {tab === "catalog" && !isDirectSale && (
        <CourseCatalog {...view} viewingCourseId={viewingCourseId} setViewingCourseId={setViewingCourseId} onEnroll={handleEnrollIntoCourse} />
      )}
      {tab === "learning" && (
        <MyLearningWorkspace
          {...view}
          learningCourseId={learningCourseId}
          setLearningCourseId={id => { setLearningCourseId(id); setFocusSessionNumber(null); setFocusThread(null); }}
          focusSessionNumber={focusSessionNumber}
          focusThread={focusThread}
          onToggleLesson={handleToggleLessonComplete}
        />
      )}
      {tab === "orders" && !isDirectSale && <StudentOrders {...view} />}
      {tab === "extras" && <StudentExtras />}
      {tab === "notifications" && <NotificationInbox store={store} currentUser={currentUser} onRefreshData={onRefreshData} title="Thông báo" />}

      {paymentGuideTx && !isDirectSale && (
        <PaymentQrModal
          transaction={paymentGuideTx}
          course={store.courses.find(c => c.id === paymentGuideTx.courseId)}
          onClose={() => setPaymentGuideTx(null)}
          onRefreshData={onRefreshData}
          onPaymentSuccess={() => {
            void onRefreshData();
            toast("Thanh toán thành công! Khóa học đã được kích hoạt.", "success");
            setActiveSubTab("learning");
          }}
        />
      )}
    </>
  );
}
