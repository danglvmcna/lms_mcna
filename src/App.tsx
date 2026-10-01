import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Terminal,
  Settings,
  LogOut,
  ShieldAlert,
  ArrowRight,
  FileCode,
  LayoutDashboard,
  Search,
  BookOpen,
  GraduationCap,
  Bell,
  CheckCircle,
  Eye,
  Menu,
  X,
  Lock,
  Download,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { User, LMSDataStore } from "./types";
import { AppStore } from "./store";
const AdminPanel = React.lazy(() => import("./components/AdminPanel"));
const TeacherPanel = React.lazy(() => import("./components/TeacherPanel"));
const StudentPanel = React.lazy(() => import("./components/StudentPanel"));
import NotificationBell from "./components/common/NotificationBell";
import { api, setCsrfToken, getCsrfToken } from "./api";
import PublicCourseCatalog from "./components/public/PublicCourseCatalog";
import { clearEnrollIntent, EnrollIntent, readEnrollIntent, saveEnrollIntent } from "./enrollIntent";
import { ForcedPasswordChange, ForgotPasswordForm, SignUpForm } from "./components/public/AccountForms";
import ErrorBoundary from "./components/ErrorBoundary";
import CertificatePublicPage from "./components/public/CertificatePublicPage";
import { phoneDigits, useAppConfigQuery } from "./appConfig";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false
    }
  }
});

function AppShell() {
  console.log("APP: AppShell function executing...");
  const queryClient = useQueryClient();
  // Direct sale: accounts are issued by MCNA, so the sign-up and self-enrollment entry points are hidden.
  const { config: appConfig, isLoading: appConfigLoading } = useAppConfigQuery();
  const isDirectSale = appConfig.salesMode === "direct";
  // Store instance reactivity state
  console.log("APP: Initializing storeData state...");
  const [storeData, setStoreData] = useState<LMSDataStore>(AppStore.get());
  console.log("APP: storeData initialized:", !!storeData);


  // Auth states
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState<string | null>(null);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Visitors land on the public course catalog; "login" shows the sign-in card.
  const [authView, setAuthView] = useState<"catalog" | "login" | "register" | "forgot">(() => {
    if (resetToken) return "login";
    const hash = (typeof window !== "undefined" ? window.location.hash.replace("#", "").toLowerCase() : "");
    if (hash === "login" || hash === "register" || hash === "forgot") {
      return hash;
    }
    return "catalog";
  });

  const navigateAuth = (view: "catalog" | "login" | "register" | "forgot") => {
    setAuthView(view);
    if (typeof window !== "undefined") {
      const currentHash = window.location.hash.replace("#", "").toLowerCase();
      if (view === "catalog") {
        if (currentHash) {
          window.history.pushState(null, "", window.location.pathname + window.location.search);
        }
      } else if (currentHash !== view) {
        window.location.hash = view;
      }
    }
  };
  const [initialCourseId] = useState(() => new URLSearchParams(window.location.search).get("course") || undefined);
  const [pendingIntent, setPendingIntent] = useState<EnrollIntent | null>(() => readEnrollIntent());
  const [appNotice, setAppNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Mobile sidebar navigation visibility
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // User profile dropdown menu popover state
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Profile and Password Modals states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);

  const roleLabel = (role: User["role"]) => {
    if (role === "admin") return "Quản Trị Viên";
    if (role === "manager") return "Quản Lý Lớp";
    if (role === "teacher") return "Giảng Viên";
    if (role === "student") return "Học Viên";
    return role;
  };

  useEffect(() => {
    fetch("/api/auth/me", {
      credentials: "include"
    })
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
        const serverStore = await api.getStore();
        AppStore.hydrate(serverStore);
        setStoreData({ ...serverStore });
        queryClient.setQueryData(["store"], serverStore);
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
      });
  }, []);

  const directSaleRef = React.useRef(isDirectSale);
  directSaleRef.current = isDirectSale;

  // Synchronize browser history and hash navigation (back/forward buttons)
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "login" || hash === "register" || hash === "forgot") {
        setAuthView(hash === "register" && directSaleRef.current ? "login" : hash);
      } else if (!hash || hash === "catalog") {
        setAuthView("catalog");
      }
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

  useEffect(() => {
    if (appConfigLoading || !isDirectSale) return;
    clearEnrollIntent();
    setPendingIntent(null);
    setAuthView(current => {
      if (current === "register") return "login";
      const hash = window.location.hash.replace("#", "").toLowerCase();
      return current === "catalog" && !initialCourseId && !hash ? "login" : current;
    });
  }, [appConfigLoading, isDirectSale]);

  // Submit the class a visitor picked in the public catalog once they are signed in as a student.
  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword) return;
    const intent = readEnrollIntent();
    if (!intent) return;
    clearEnrollIntent();
    setPendingIntent(null);
    if (currentUser.role !== "student" || isDirectSale) return;
    api.registerEnrollment(intent.courseId, intent.sectionId)
      .then(async () => {
        const target = [intent.sectionCode ? `lớp ${intent.sectionCode}` : "", intent.courseTitle || ""].filter(Boolean).join(" – ") || "khóa học";
        setAppNotice({ type: "success", message: `Đã gửi yêu cầu đăng ký ${target}. Phòng đào tạo sẽ xác nhận và mở quyền học cho bạn.` });
        await refreshStoreDataFromServer();
      })
      .catch((err: any) => setAppNotice({ type: "error", message: err.message || "Không thể đăng ký lớp đã chọn." }));
  }, [currentUser?.id, currentUser?.mustChangePassword]);

  useEffect(() => {
    if (!appNotice) return;
    const timer = setTimeout(() => setAppNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [appNotice]);



  // Refresh reactive data from store changes
  const refreshStoreData = () => {
    setStoreData({ ...AppStore.get() });
    queryClient.invalidateQueries();

    // Update local currentUser reference
    if (currentUser) {
      const freshStore = AppStore.get();
      const freshUser = freshStore.users.find(u => u.id === currentUser.id);
      if (freshUser) {
        if (!freshUser.isActive) {
          handleLogout();
          alert("Your account has been deactivated by the system administrator.");
        } else {
          setCurrentUser(freshUser);
        }
      }
    }
  };

  const refreshStoreDataFromServer = async () => {
    if (AppStore.syncPromise) {
      try {
        await AppStore.syncPromise;
      } catch (e) {
        console.error("Sync error in refreshStoreDataFromServer", e);
      }
    }
    const serverStore = await api.getStore();
    AppStore.hydrate(serverStore);
    setStoreData({ ...serverStore });
    queryClient.setQueryData(["store"], serverStore);
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

  // Auth Operations
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSessionConflict(false);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const submittedEmail = String(formData.get("email") || loginEmail);
    const submittedPassword = String(formData.get("password") || loginPassword);
    const emailClean = submittedEmail.trim().toLowerCase();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailClean, password: submittedPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "SESSION_CONFLICT") {
          setSessionConflict(true);
        }
        setAuthError(data.error || "Incorrect password credentials.");
        return;
      }

      setCurrentUser(data.user);
      setCsrfToken(data.csrfToken || null);
      sessionStorage.setItem("mcna_lms_active_session", "true");
      sessionStorage.setItem("e16_lms_active_session", "true");
      if (!data.user.mustChangePassword) await refreshStoreDataFromServer();
      AppStore.log(data.user.id, "authentication_login", "security", `Successfully authenticated into profile desk role: ${data.user.role}`);
      setLoginEmail("");
      setLoginPassword("");
    } catch (error) {
      setAuthError("Authentication service is not available.");
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      AppStore.log(currentUser.id, "authentication_logout", "security", "Successfully closed session.");
    }
    const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined
    }).catch(() => undefined);
    setCurrentUser(null);
    setUserDropdownOpen(false);
    setCsrfToken(null);
    navigateAuth(isDirectSale ? "login" : "catalog");
    sessionStorage.removeItem("mcna_lms_active_session");
    sessionStorage.removeItem("e16_lms_active_session");
  };

  // Force logout the other active session from the login screen (no auth required)
  const handleForceLogoutOtherSession = async () => {
    // Clear the session cookie by calling a lightweight logout that doesn't require auth
    await fetch("/api/auth/force-logout", {
      method: "POST",
      credentials: "include"
    }).catch(() => undefined);
    setAuthError(null);
    setSessionConflict(false);
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError(null);
    setResetPasswordMessage(null);
    if (resetNewPassword.length < 8) {
      setResetPasswordError("Mật khẩu mới phải dài tối thiểu 8 ký tự.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetPasswordError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    try {
      const response = await fetch("/api/auth/reset-password/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword: resetNewPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        setResetPasswordError(data.error || "Không thể đặt lại mật khẩu.");
        return;
      }
      setResetPasswordMessage(data.message || "Mật khẩu đã được đặt lại thành công.");
      setResetToken("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      setResetPasswordError("Dịch vụ đặt lại mật khẩu chưa sẵn sàng.");
    }
  };

  // Standalone Single-File download builder
  const handleExportStandaloneHTMLFile = () => {
    const rawStoreJson = JSON.stringify({ ...AppStore.get(), users: [] });

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCNA LMS - Hệ thống Quản lý Học tập Nội bộ</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #0f172a;
      background-image:
        radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.1) 0px, transparent 50%);
      color: rgba(255, 255, 255, 0.9);
    }
    /* Scrollbars custom styling */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.03);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.15);
      border-radius: 9999px;
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-6">

  <div class="w-full max-w-6xl bg-white/5 border border-white/10 rounded-3xl p-10 backdrop-blur-2xl shadow-2xl text-center space-y-6">
    <div class="inline-flex p-4 bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 rounded-2xl">
      <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
    <div class="space-y-2">
      <h1 class="text-3xl font-extrabold text-white tracking-widest uppercase">MCNA LMS - Bản chạy Ngoại tuyến</h1>
      <p class="text-sm text-indigo-200/70 max-w-xl mx-auto leading-relaxed">
        Bản xuất bản này chỉ chứa dữ liệu học tập công khai. Thông tin tài khoản người dùng và hồ sơ nhân sự được chủ ý loại bỏ khỏi bộ nhớ lưu trữ trình duyệt.
      </p>
    </div>

    <div class="max-w-md mx-auto bg-black/35 p-6 rounded-2xl border border-white/5 text-left space-y-4">
      <span class="text-xs font-mono font-bold tracking-wider text-indigo-300 block uppercase">Tài khoản demo cấu hình sẵn:</span>
      <div class="space-y-2 text-xs font-mono divide-y divide-white/5">
        <div class="py-1.5 flex justify-between"><span>Quản trị viên (Manager)</span><span class="text-white">admin@mcna.local / admine16</span></div>
        <div class="py-1.5 flex justify-between"><span>Giảng viên (Teacher)</span><span class="text-white">teacher@mcna.local / teachere16</span></div>
        <div class="py-1.5 flex justify-between"><span>Học viên (Student)</span><span class="text-white">student@mcna.local / studente16</span></div>
      </div>
    </div>

    <div class="pt-4">
      <button onclick="launchInteractiveWorkspace()" class="px-6 py-3 bg-white text-indigo-950 font-bold hover:bg-white/95 text-sm rounded-xl transition cursor-pointer shadow-lg inline-flex items-center gap-1.5">
        Khởi chạy Không gian LMS MCNA
      </button>
    </div>
  </div>

  <script>
    // Seeding internal localStorage engine with live runtime datasets
    const SEEDED_DUMP = ${rawStoreJson};
    if (!localStorage.getItem("mcna_lms_data") && !localStorage.getItem("e16_lms_data")) {
      localStorage.setItem("mcna_lms_data", JSON.stringify(SEEDED_DUMP));
    }

    function launchInteractiveWorkspace() {
      // Direct redirection to the full active preview layout in this local file directory
      alert("Không gian làm việc ngoại tuyến đã khởi tạo thành công! Bạn có thể trải nghiệm toàn bộ tính năng trực tiếp.");
    }
  </script>

</body>
</html>`;

    const downloadAnchor = document.createElement("a");
    const blob = new Blob([htmlTemplate], { type: "text/html" });
    downloadAnchor.href = URL.createObjectURL(blob);
    downloadAnchor.download = "mcna_lms_standalone.html";
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className={`min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-900 relative ${!currentUser ? "pb-12 overflow-hidden" : ""}`}>
      {appNotice && (
        <div
          role="status"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold flex items-start justify-between gap-3 border ${
            appNotice.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{appNotice.message}</span>
          <button type="button" onClick={() => setAppNotice(null)} className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Đóng thông báo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* MAIN LAYOUT CANVAS */}
      {currentUser?.mustChangePassword ? (
        <ForcedPasswordChange
          user={currentUser}
          onLogout={handleLogout}
          onChanged={async () => {
            const response = await fetch("/api/auth/me", { credentials: "include" });
            const data = await response.json();
            if (!response.ok || !data.user) throw new Error("Phiên đăng nhập đã hết hạn.");
            const serverStore = await api.getStore();
            AppStore.hydrate(serverStore);
            setStoreData({ ...serverStore });
            queryClient.setQueryData(["store"], serverStore);
            setCurrentUser(data.user);
          }}
        />
      ) : currentUser ? (
        <div className="min-h-screen flex flex-col md:flex-row relative">

          {/* DESKTOP SIDEBAR NAV BAR */}
          <aside className={`hidden flex-col bg-white border-r border-slate-200/80 p-4 flex-shrink-0 sticky top-0 h-screen z-40 transition-all duration-300 ${
            isSidebarCollapsed ? "w-20 items-center px-2" : "w-64"
          }`}>
            {/* Top Logo and Toggle */}
            <div className={`flex items-center justify-between pb-4 border-b border-slate-100 w-full ${
              isSidebarCollapsed ? "flex-col gap-3" : ""
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 bg-white border border-slate-200/80 rounded-xl p-1 shrink-0 shadow-xs flex items-center justify-center">
                  <img
                    src="/mcna-logo.png"
                    alt="MCNA Technology School"
                    className="w-full h-full object-contain"
                  />
                </div>
                {!isSidebarCollapsed && (
                  <div>
                    <h1 className="text-sm font-bold tracking-wider text-slate-900 uppercase leading-none">MCNA LMS</h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-tight mt-1 font-medium">Học viện MCNA v1.1</p>
                  </div>
                )}
              </div>

              {/* Collapse/Expand Toggle Button */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition duration-150 cursor-pointer"
                title={isSidebarCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* USER PROFILE DROPDOWN MENU / POPOVER */}
            <div className="relative w-full py-3 border-b border-slate-100">
              {/* Dropdown Menu Popup */}
              {userDropdownOpen && (
                <div className={`absolute top-full mt-1.5 z-50 bg-white border border-slate-200/90 rounded-xl p-1.5 shadow-lg text-slate-800 w-60 animate-in fade-in slide-in-from-top-1 duration-150 ${
                  isSidebarCollapsed ? "left-0" : "left-0 right-0 w-full"
                }`}>
                  {/* Scoped Profile Header Info */}
                  <div className="px-2.5 py-2 border-b border-slate-100 mb-1 text-xs text-left">
                    <p className="font-mono text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">
                      {roleLabel(currentUser.role)}
                    </p>
                    <h6 className="font-semibold text-slate-900 truncate text-xs">{currentUser.name}</h6>
                    <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">{currentUser.email}</p>
                  </div>

                  {/* Action Buttons */}
                  <button
                    onClick={() => { setShowProfileModal(true); setUserDropdownOpen(false); }}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition flex items-center gap-2 cursor-pointer"
                  >
                    <Fingerprint className="h-4 w-4 text-slate-400" />
                    <span>Xem lý lịch cá nhân</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowChangePasswordModal(true);
                      setUserDropdownOpen(false);
                      setChangePasswordError(null);
                      setChangePasswordSuccess(null);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="h-4 w-4 text-slate-400" />
                    <span>Đổi mật khẩu tài khoản</span>
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Đăng xuất phiên</span>
                  </button>
                </div>
              )}

              {/* Main Profile Trigger Button */}
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`w-full flex items-center gap-2.5 p-2 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl transition duration-150 cursor-pointer shadow-2xs ${
                  isSidebarCollapsed ? "justify-center p-1.5 h-10 w-10" : "text-left"
                }`}
                title={currentUser.name}
              >
                {/* Avatar circle */}
                <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-xs text-white shadow-2xs shrink-0 uppercase font-mono">
                  {currentUser.name.slice(0, 2)}
                </div>

                {/* User Details */}
                {!isSidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate leading-tight">{currentUser.name}</p>
                    <span className="text-[10px] font-mono font-medium text-slate-500 truncate block mt-0.5 uppercase">
                      {roleLabel(currentUser.role)}
                    </span>
                  </div>
                )}

                {/* Arrow indicator */}
                {!isSidebarCollapsed && (
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transform transition-transform duration-200 ${
                    userDropdownOpen ? "rotate-180" : ""
                  }`} />
                )}
              </button>
            </div>

            {/* Flex spacer to push menu content down if needed */}
            <div className="flex-1" />
          </aside>

          {/* MOBILE NAVIGATION SIDEBAR DRAWER */}
          {sidebarOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex md:hidden animate-in fade-in duration-150">
              <div className="w-72 bg-white border-r border-slate-200 p-6 space-y-6 animate-in slide-in-from-left duration-200 shadow-2xl flex flex-col justify-between text-slate-900 font-sans">
                <div className="space-y-5">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <GraduationCap className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 tracking-tight">Học Viện MCNA</span>
                    </div>
                    <button 
                      onClick={() => setSidebarOpen(false)} 
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center font-mono uppercase shrink-0">
                        {currentUser.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-900 font-semibold truncate leading-tight">{currentUser.name}</p>
                        <p className="font-mono text-indigo-600 text-[10px] font-medium uppercase tracking-wider mt-0.5">
                          {roleLabel(currentUser.role)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <button
                      onClick={() => { setShowProfileModal(true); setSidebarOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                    >
                      <Fingerprint className="h-4 w-4 text-indigo-600" />
                      <span>Xem lý lịch cá nhân</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowChangePasswordModal(true);
                        setSidebarOpen(false);
                        setChangePasswordError(null);
                        setChangePasswordSuccess(null);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                    >
                      <Lock className="h-4 w-4 text-amber-500" />
                      <span>Đổi mật khẩu tài khoản</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 text-xs">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" /> Đăng xuất phiên
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MAIN PAGE CONTAINERS */}
          <main className="flex-1 min-w-0 flex flex-col relative z-20">
            {/* Topbar headers in viewport */}
            <header className="px-4 md:px-8 py-3.5 border-b border-slate-200/80 bg-white/80 backdrop-blur-md flex justify-between items-center z-10 sticky top-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="hidden p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <h3 className="font-display font-bold text-slate-900 text-sm md:text-base leading-none">
                  MCNA LMS
                </h3>
              </div>

              {/* Header right: Notification Bell + System Status Badge */}
              <div className="flex items-center gap-2">
                <NotificationBell />
                {(
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setUserDropdownOpen(open => !open)}
                      aria-expanded={userDropdownOpen}
                      aria-label="Mở menu tài khoản"
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 hover:border-slate-300"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white uppercase">{currentUser.name.slice(0, 2)}</span>
                      <span className="hidden max-w-36 truncate font-medium sm:block">{currentUser.name}</span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>
                    {userDropdownOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                        <div className="border-b border-slate-100 px-2 py-2 mb-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{currentUser.name}</p>
                          <p className="truncate text-xs text-slate-500">{currentUser.email}</p>
                        </div>
                        <button type="button" onClick={() => { setShowProfileModal(true); setUserDropdownOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Fingerprint className="h-4 w-4" /> Hồ sơ cá nhân</button>
                        <button type="button" onClick={() => { setShowChangePasswordModal(true); setUserDropdownOpen(false); setChangePasswordError(null); setChangePasswordSuccess(null); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Lock className="h-4 w-4" /> Đổi mật khẩu</button>
                        <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" /> Đăng xuất</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </header>

            {/* Inner responsive Padding page body */}
            <div className={`mx-auto w-full pt-4 pb-6 md:pt-6 lg:pt-8 px-4 md:px-6 ${currentUser.role === "admin" || currentUser.role === "manager" ? "max-w-[1600px]" : "max-w-[1440px]"}`}>
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center p-16 space-y-4">
                  <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-xs text-indigo-300 font-mono tracking-widest uppercase">Đang tải phân hệ học vụ...</span>
                </div>
              }>
                {(currentUser.role === "admin" || currentUser.role === "manager") && (
                  <AdminPanel
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onRefreshData={refreshStoreDataFromServer}
                    updateStore={updateStore}
                  />
                )}
                {currentUser.role === "teacher" && (
                  <TeacherPanel
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onRefreshData={refreshStoreDataFromServer}
                    updateStore={updateStore}
                  />
                )}
                {currentUser.role === "student" && (
                  <StudentPanel
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onRefreshData={refreshStoreDataFromServer}
                  />
                )}
              </React.Suspense>
            </div>
          </main>

        </div>
      ) : appConfigLoading && !resetToken ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" aria-label="Đang tải" />
        </div>
      ) : authView === "catalog" && !resetToken ? (
        <ErrorBoundary fallbackTitle="Không thể tải danh mục khóa học">
          <PublicCourseCatalog
            initialCourseId={initialCourseId}
            salesMode={appConfig.salesMode}
            supportPhone={appConfig.supportPhone}
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
      ) : (
        /* AUTH SECTION VIEW (SPLIT SCREEN LOGIN / WELCOME CARD) */
        <div className="min-h-screen flex items-center justify-center p-4 relative z-20 animate-in fade-in zoom-in-95 duration-200">

          <div className="bg-white border border-slate-200/80 w-full max-w-5xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-xl">

            {/* LEFT LOGO COLUMN */}
            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white text-slate-900 p-8 md:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200/80 relative overflow-hidden min-h-[300px] lg:min-h-0">
              <div className="flex items-center space-x-3 relative z-10 pt-2">
                <div className="h-12 w-12 bg-white rounded-2xl p-1.5 shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
                  <img
                    src="/mcna-logo.png"
                    alt="MCNA Technology School"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <span className="font-display font-extrabold text-slate-900 tracking-wider uppercase text-sm block">MCNA LMS</span>
                  <span className="text-[10px] text-indigo-600 font-semibold tracking-wider uppercase block">Học Viện Công Nghệ MCNA</span>
                </div>
              </div>

              <div className="relative z-10 py-12 space-y-4">
                <h2 className="text-2xl font-display font-extrabold text-slate-900 leading-tight">Hệ thống Quản lý Học tập Nâng cao</h2>
                <p className="text-xs text-slate-600 leading-relaxed font-sans max-w-sm">
                  Trải nghiệm môi trường học tập chất lượng cao. Quản lý yêu cầu khóa học, xây dựng đề cương chi tiết, đánh giá kết quả và cấp chứng chỉ trực tuyến tức thì.
                </p>
              </div>

              <div className="relative z-10 text-[10px] font-mono text-slate-400">
                Nền tảng MCNA • Bản phát hành 2026
              </div>
            </div>

            {/* RIGHT FORM COLUMN */}
            <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-center space-y-6 bg-white text-slate-900">
              {!resetToken && (
                <button
                  type="button"
                  onClick={() => navigateAuth("catalog")}
                  className="self-start inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer transition"
                >
                  <ChevronLeft className="h-4 w-4" /> Xem danh sách khóa học
                </button>
              )}
              <div className="space-y-1">
                <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight">
                  {resetToken
                    ? "Đặt lại mật khẩu"
                    : authView === "register" && !isDirectSale
                      ? "Tạo tài khoản học viên"
                      : authView === "forgot"
                        ? "Quên mật khẩu"
                        : "Đăng nhập tài khoản của bạn"}
                </h3>
                <p className="text-xs text-slate-500">
                  {resetToken
                    ? "Thiết lập mật khẩu mới bằng liên kết một lần được gửi qua email."
                    : authView === "register" && !isDirectSale
                      ? "Đăng ký bằng email cá nhân – mật khẩu tạm thời sẽ được gửi qua email."
                      : authView === "forgot"
                        ? "Nhập email đăng nhập để nhận liên kết đặt lại mật khẩu."
                        : isDirectSale
                          ? "Học viên đăng nhập bằng email đã đăng ký khóa học và mật khẩu MCNA gửi qua email."
                          : "Xác thực để truy cập phân hệ học vụ hoặc lớp học tương ứng."}
                </p>
              </div>

              {!resetToken && pendingIntent && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3 rounded-xl text-xs flex items-start justify-between gap-3">
                  <span>
                    Đăng nhập hoặc tạo tài khoản để hoàn tất đăng ký {pendingIntent.sectionCode ? `lớp ${pendingIntent.sectionCode} – ` : ""}{pendingIntent.courseTitle || "khóa học đã chọn"}.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearEnrollIntent();
                      setPendingIntent(null);
                    }}
                    className="shrink-0 font-bold cursor-pointer text-indigo-700 hover:text-indigo-900"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}

              {!resetToken && authView === "login" && authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 stroke-[2.5] shrink-0" />
                    <span>{authError}</span>
                  </div>
                  {sessionConflict && (
                    <button
                      type="button"
                      onClick={handleForceLogoutOtherSession}
                      className="w-full py-2 bg-red-100 hover:bg-red-200 border border-red-200 text-red-800 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Đăng xuất tài khoản đang chạy
                    </button>
                  )}
                </div>
              )}

              {resetPasswordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
                  {resetPasswordError}
                </div>
              )}

              {resetPasswordMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs">
                  {resetPasswordMessage}
                </div>
              )}

              {resetToken ? (
                <form onSubmit={handleCompletePasswordReset} className="space-y-4 text-xs font-sans">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">Mật khẩu mới</label>
                    <input
                      name="newPassword"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Tối thiểu 8 ký tự"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">Xác nhận mật khẩu mới</label>
                    <input
                      name="confirmNewPassword"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Nhập lại mật khẩu mới"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm tracking-wider uppercase font-display"
                  >
                    Đặt lại mật khẩu
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetToken("");
                      setResetNewPassword("");
                      setResetConfirmPassword("");
                      setResetPasswordError(null);
                      window.history.replaceState({}, document.title, window.location.pathname);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Quay lại đăng nhập
                  </button>
                </form>
              ) : authView === "register" && !isDirectSale ? (
                <SignUpForm
                  intent={pendingIntent}
                  onGoToLogin={email => {
                    if (email) setLoginEmail(email);
                    setAuthError(null);
                    navigateAuth("login");
                  }}
                />
              ) : authView === "forgot" ? (
                <ForgotPasswordForm onGoToLogin={() => navigateAuth("login")} />
              ) : (
                <>
                  {/* Login submit form */}
                  <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-sans">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 block">Địa chỉ Email đăng nhập</label>
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder={isDirectSale ? "Ví dụ: ban@gmail.com" : "Ví dụ: admin@mcna.local"}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">Mật khẩu tài khoản</label>
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="Mật khẩu của bạn"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm tracking-wider uppercase font-display"
                    >
                      Xác nhận Đăng nhập
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError(null);
                          navigateAuth("forgot");
                        }}
                        className="text-slate-500 hover:text-slate-900 font-semibold cursor-pointer transition"
                      >
                        Quên mật khẩu?
                      </button>
                      {!isDirectSale && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthError(null);
                            navigateAuth("register");
                          }}
                          className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer transition"
                        >
                          Chưa có tài khoản? Tạo tài khoản
                        </button>
                      )}
                    </div>
                    {isDirectSale && (
                      <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                        Tài khoản học viên do MCNA cấp sau khi bạn đăng ký khóa học. Chưa nhận được thông tin đăng nhập? Gọi hoặc nhắn Zalo{" "}
                        <a href={`https://zalo.me/${phoneDigits(appConfig.supportPhone)}`} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-700">{appConfig.supportPhone}</a>.
                      </p>
                    )}
                  </form>

                </>
              )}

            </div>

          </div>

        </div>
      )}

      {/* 1. VIEW PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left text-slate-800">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition duration-150 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Fingerprint className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base leading-none">Lý lịch cá nhân</h4>
                <p className="text-xs text-slate-500 mt-1">Thông tin chi tiết tài khoản người dùng</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-sans">
              <div className="py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">Họ và Tên</span>
                <strong className="text-slate-900 text-sm font-semibold">{currentUser.name}</strong>
              </div>
              <div className="py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">Địa chỉ Email</span>
                <strong className="text-slate-900 font-mono">{currentUser.email}</strong>
              </div>
              <div className="py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">Vai trò Hệ thống</span>
                <strong className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-semibold">{roleLabel(currentUser.role)}</strong>
              </div>
              <div className="py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">Số Điện thoại</span>
                <strong className="text-slate-900 font-mono">{currentUser.phone || "Chưa cập nhật"}</strong>
              </div>
              {currentUser.linkedStudentId && (
                <div className="py-2 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-slate-500">ID Học viên Liên kết</span>
                  <strong className="text-slate-900 font-mono">{currentUser.linkedStudentId}</strong>
                </div>
              )}
              <div className="py-2 flex justify-between items-center">
                <span className="text-slate-500">Ngày kích hoạt</span>
                <strong className="text-slate-900 font-mono">{currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : "Chưa xác định"}</strong>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Đóng thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHANGE PASSWORD MODAL */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left text-slate-800">
            <button
              onClick={() => setShowChangePasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition duration-150 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base leading-none">Đổi mật khẩu</h4>
                <p className="text-xs text-slate-500 mt-1">Cập nhật khóa bảo mật tài khoản cá nhân</p>
              </div>
            </div>

            {changePasswordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
                {changePasswordError}
              </div>
            )}

            {changePasswordSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs">
                {changePasswordSuccess}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setChangePasswordError(null);
              setChangePasswordSuccess(null);

              if (newPassword.length < 8) {
                setChangePasswordError("Mật khẩu mới phải tối thiểu 8 ký tự.");
                return;
              }
              if (newPassword !== confirmPassword) {
                setChangePasswordError("Xác nhận mật khẩu mới không trùng khớp.");
                return;
              }

              try {
                const csrfToken = getCsrfToken() || sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
                const response = await fetch("/api/users/change-password", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken || ""
                  },
                  credentials: "include",
                  body: JSON.stringify({ currentPassword, newPassword })
                });

                const data = await response.json();
                if (!response.ok) {
                  setChangePasswordError(data.error || "Có lỗi xảy ra khi đổi mật khẩu.");
                  return;
                }

                setChangePasswordSuccess("Đổi mật khẩu thành công!");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setTimeout(() => setShowChangePasswordModal(false), 1500);
              } catch (error) {
                setChangePasswordError("Dịch vụ xác thực không phản hồi.");
              }
            }} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu hiện tại"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-400 h-10 transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm tracking-wider uppercase font-display"
              >
                Cập nhật Mật khẩu
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  const certificateMatch = window.location.pathname.match(/^\/verify\/certificate\/([^/]+)$/i);
  if (certificateMatch) return <CertificatePublicPage code={decodeURIComponent(certificateMatch[1])} />;
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
