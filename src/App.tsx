import React, { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, ClipboardList, Compass, GraduationCap, House, LayoutDashboard, ScrollText, Users, Wallet } from "lucide-react";
import { User, LMSDataStore } from "./types";
import { AppStore } from "./store";
import { api, setCsrfToken } from "./api";
import PublicCourseCatalog from "./components/public/PublicCourseCatalog";
import { clearEnrollIntent, EnrollIntent, readEnrollIntent, saveEnrollIntent } from "./enrollIntent";
import { ForcedPasswordChange, ForgotPasswordScreen, LoginScreen, ResetPasswordScreen, SignUpScreen } from "./components/public/AccountForms";
import ErrorBoundary from "./components/ErrorBoundary";
import CertificatePublicPage from "./components/public/CertificatePublicPage";
import AppShell, { NavItem } from "./components/layout/AppShell";
import { ChangePasswordDialog, ProfileDialog } from "./components/account/AccountDialogs";
import { Spinner, ToastProvider, useToast } from "./components/ui";

const AdminPanel = React.lazy(() => import("./components/AdminPanel"));
const TeacherPanel = React.lazy(() => import("./components/TeacherPanel"));
const StudentPanel = React.lazy(() => import("./components/StudentPanel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false
    }
  }
});

type AuthView = "catalog" | "login" | "register" | "forgot";

const DEFAULT_TAB: Record<User["role"], string> = { student: "home", teacher: "courses", admin: "overview" };

function navFor(user: User, store: LMSDataStore): NavItem[] {
  const unread = (store.notifications || []).filter(n => n.userId === user.id && !n.isRead).length;
  if (user.role === "student") {
    const awaitingPayment = (store.enrollments || []).filter(e => e.studentId === user.id && e.status === "pending_payment").length;
    return [
      { id: "home", label: "Trang chủ", icon: House },
      { id: "catalog", label: "Khám phá", icon: Compass },
      { id: "learning", label: "Lớp học của tôi", shortLabel: "Lớp học", icon: GraduationCap },
      { id: "orders", label: "Học phí", icon: Wallet, badge: awaitingPayment },
      { id: "notifications", label: "Thông báo", icon: Bell, badge: unread, mobile: "hidden" }
    ];
  }
  if (user.role === "teacher") {
    return [
      { id: "courses", label: "Khóa học", icon: BookOpen },
      { id: "notifications", label: "Thông báo", icon: Bell, badge: unread }
    ];
  }
  const pending = (store.enrollments || []).filter(e => e.status === "pending_payment" || e.status === "pending").length;
  return [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard, group: "Vận hành" },
    { id: "orders", label: "Ghi danh", icon: ClipboardList, badge: pending, group: "Vận hành" },
    { id: "course_section_mgmt", label: "Khóa học & lớp", shortLabel: "Khóa học", icon: BookOpen, group: "Vận hành" },
    { id: "users", label: "Người dùng", icon: Users, group: "Hệ thống" },
    { id: "audit", label: "Nhật ký & CRM", icon: ScrollText, group: "Hệ thống", mobile: "more" },
    { id: "notifications", label: "Thông báo", icon: Bell, badge: unread, group: "Hệ thống", mobile: "more" }
  ];
}

function readAuthViewFromHash(): AuthView | null {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (hash === "login" || hash === "register" || hash === "forgot") return hash;
  if (!hash || hash === "catalog") return "catalog";
  return null;
}

function AppRoot() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [storeData, setStoreData] = useState<LMSDataStore>(AppStore.get());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [authView, setAuthView] = useState<AuthView>(() => (resetToken ? "login" : readAuthViewFromHash() || "catalog"));
  const [prefillEmail, setPrefillEmail] = useState("");
  const [initialCourseId] = useState(() => new URLSearchParams(window.location.search).get("course") || undefined);
  const [pendingIntent, setPendingIntent] = useState<EnrollIntent | null>(() => readEnrollIntent());

  const [activeTab, setActiveTab] = useState("home");
  const [navNonce, setNavNonce] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigateAuth = (view: AuthView) => {
    setAuthView(view);
    const currentHash = window.location.hash.replace("#", "").toLowerCase();
    if (view === "catalog") {
      if (currentHash) window.history.pushState(null, "", window.location.pathname + window.location.search);
    } else if (currentHash !== view) {
      window.location.hash = view;
    }
    window.scrollTo({ top: 0 });
  };

  const hydrate = (serverStore: LMSDataStore) => {
    AppStore.hydrate(serverStore);
    setStoreData({ ...serverStore });
    queryClient.setQueryData(["store"], serverStore);
  };

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();
        setCurrentUser(data.user);
        const csrfCookie = document.cookie.split("; ").find(item => item.startsWith("mcna_lms_csrf=") || item.startsWith("e16_lms_csrf="));
        if (csrfCookie) setCsrfToken(decodeURIComponent(csrfCookie.split("=")[1] || ""));
        sessionStorage.setItem("mcna_lms_active_session", "true");
        sessionStorage.setItem("e16_lms_active_session", "true");
        // Data APIs stay locked until a temporary password is replaced (ForcedPasswordChange loads the store after).
        if (data.user?.mustChangePassword) return;
        hydrate(await api.getStore());
      })
      .catch(() => {
        // The session cookie may be invalid/expired but still present in the browser.
        // Actively clear it (no-auth endpoint) so a leftover cookie can't later trigger
        // a false "already logged in with another account" error on next login.
        fetch("/api/auth/force-logout", { method: "POST", credentials: "include" }).catch(() => undefined);
        setCurrentUser(null);
        setCsrfToken(null);
        sessionStorage.removeItem("mcna_lms_active_session");
        sessionStorage.removeItem("e16_lms_active_session");
      })
      .finally(() => setSessionChecked(true));
  }, []);

  // Browser back/forward between catalog and auth screens.
  useEffect(() => {
    const handleLocationChange = () => {
      const view = readAuthViewFromHash();
      if (view) setAuthView(view);
    };
    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem("mcna_lms_role", currentUser.role);
      sessionStorage.setItem("e16_lms_role", currentUser.role);
    } else {
      sessionStorage.removeItem("mcna_lms_role");
      sessionStorage.removeItem("e16_lms_role");
    }
  }, [currentUser]);

  // Each role lands on its own home tab.
  useEffect(() => {
    if (currentUser) setActiveTab(DEFAULT_TAB[currentUser.role] || "home");
  }, [currentUser?.id, currentUser?.role]);

  // Submit the class a visitor picked in the public catalog once they are signed in as a student.
  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword) return;
    const intent = readEnrollIntent();
    if (!intent) return;
    clearEnrollIntent();
    setPendingIntent(null);
    if (currentUser.role !== "student") return;
    api.registerEnrollment(intent.courseId, intent.sectionId)
      .then(async () => {
        const target = [intent.sectionCode ? `lớp ${intent.sectionCode}` : "", intent.courseTitle || ""].filter(Boolean).join(" – ") || "khóa học";
        toast(`Đã gửi đăng ký ${target}. MCNA sẽ xác nhận và mở lớp cho bạn.`, "success");
        await refreshStoreDataFromServer();
        setActiveTab("learning");
      })
      .catch((err: any) => toast(err.message || "Không thể đăng ký lớp đã chọn.", "error"));
  }, [currentUser?.id, currentUser?.mustChangePassword]);

  const refreshStoreDataFromServer = async () => {
    if (AppStore.syncPromise) {
      try {
        await AppStore.syncPromise;
      } catch (e) {
        console.error("Sync error in refreshStoreDataFromServer", e);
      }
    }
    const serverStore = await api.getStore();
    hydrate(serverStore);
    await queryClient.invalidateQueries();
    if (currentUser) {
      const freshUser = serverStore.users.find(u => u.id === currentUser.id);
      if (freshUser) setCurrentUser(freshUser);
    }
  };

  const updateStore = (updater: (draft: LMSDataStore) => void) => {
    const currentStore = AppStore.get();
    updater(currentStore);
    const newStore = { ...currentStore };
    setStoreData(newStore);
    queryClient.setQueryData(["store"], newStore);
  };

  const handleLoggedIn = async (data: { user: User; csrfToken?: string }) => {
    setCurrentUser(data.user);
    setCsrfToken(data.csrfToken || null);
    sessionStorage.setItem("mcna_lms_active_session", "true");
    sessionStorage.setItem("e16_lms_active_session", "true");
    if (!data.user.mustChangePassword) await refreshStoreDataFromServer();
    AppStore.log(data.user.id, "authentication_login", "security", `Successfully authenticated into profile desk role: ${data.user.role}`);
  };

  const handleLogout = async () => {
    if (currentUser) AppStore.log(currentUser.id, "authentication_logout", "security", "Successfully closed session.");
    const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined
    }).catch(() => undefined);
    setCurrentUser(null);
    setCsrfToken(null);
    navigateAuth("catalog");
    sessionStorage.removeItem("mcna_lms_active_session");
    sessionStorage.removeItem("e16_lms_active_session");
  };

  const clearIntent = () => {
    clearEnrollIntent();
    setPendingIntent(null);
  };

  const nav = useMemo(() => (currentUser ? navFor(currentUser, storeData) : []), [currentUser, storeData]);

  const navigateTab = (id: string) => {
    setActiveTab(id);
    setNavNonce(n => n + 1);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  if (!sessionChecked) {
    return <div className="flex min-h-dvh items-center justify-center bg-canvas"><Spinner /></div>;
  }

  if (currentUser?.mustChangePassword) {
    return (
      <ForcedPasswordChange
        user={currentUser}
        onLogout={handleLogout}
        onChanged={async () => {
          const response = await fetch("/api/auth/me", { credentials: "include" });
          const data = await response.json();
          if (!response.ok || !data.user) throw new Error("Phiên đăng nhập đã hết hạn.");
          hydrate(await api.getStore());
          setCurrentUser(data.user);
        }}
      />
    );
  }

  if (currentUser) {
    const panelProps = { currentUser, onLogout: handleLogout, onRefreshData: refreshStoreDataFromServer, activeSubTab: activeTab, setActiveSubTab: setActiveTab, navNonce };
    return (
      <>
        <AppShell
          user={currentUser}
          nav={nav}
          active={activeTab}
          onNavigate={navigateTab}
          onOpenProfile={() => setShowProfile(true)}
          onOpenPassword={() => setShowPassword(true)}
          onLogout={handleLogout}
          wide={currentUser.role === "admin" || (currentUser.role === "teacher" && activeTab === "courses")}
        >
          <React.Suspense fallback={<Spinner />}>
            {currentUser.role === "admin" && <AdminPanel {...panelProps} updateStore={updateStore} />}
            {currentUser.role === "teacher" && <TeacherPanel {...panelProps} updateStore={updateStore} />}
            {currentUser.role === "student" && <StudentPanel {...panelProps} />}
          </React.Suspense>
        </AppShell>
        {showProfile && <ProfileDialog user={currentUser} onClose={() => setShowProfile(false)} />}
        {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
      </>
    );
  }

  if (resetToken) {
    return <ResetPasswordScreen token={resetToken} onDone={() => { setResetToken(""); navigateAuth("login"); }} />;
  }

  if (authView === "register") {
    return (
      <SignUpScreen
        intent={pendingIntent}
        onClearIntent={clearIntent}
        onBackToCourses={() => navigateAuth("catalog")}
        onGoToLogin={email => {
          if (email) setPrefillEmail(email);
          navigateAuth("login");
        }}
      />
    );
  }

  if (authView === "forgot") {
    return <ForgotPasswordScreen onGoToLogin={() => navigateAuth("login")} />;
  }

  if (authView === "login") {
    return (
      <LoginScreen
        key={prefillEmail}
        initialEmail={prefillEmail}
        intent={pendingIntent}
        onClearIntent={clearIntent}
        onLoggedIn={handleLoggedIn}
        onRegister={() => navigateAuth("register")}
        onForgot={() => navigateAuth("forgot")}
        onBackToCourses={() => navigateAuth("catalog")}
      />
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Không thể tải danh mục khóa học">
      <PublicCourseCatalog
        initialCourseId={initialCourseId}
        onLogin={() => navigateAuth("login")}
        onRegister={intent => {
          if (intent) {
            saveEnrollIntent(intent);
            setPendingIntent(intent);
          }
          navigateAuth("register");
        }}
      />
    </ErrorBoundary>
  );
}

export default function App() {
  const certificateMatch = window.location.pathname.match(/^\/verify\/certificate\/([^/]+)$/i);
  if (certificateMatch) return <CertificatePublicPage code={decodeURIComponent(certificateMatch[1])} />;
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <AppRoot />
      </QueryClientProvider>
    </ToastProvider>
  );
}
