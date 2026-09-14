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
import { api, setCsrfToken } from "./api";
import PublicCourseCatalog from "./components/public/PublicCourseCatalog";
import { clearEnrollIntent, EnrollIntent, readEnrollIntent, saveEnrollIntent } from "./enrollIntent";
import { ForcedPasswordChange, ForgotPasswordForm, SignUpForm } from "./components/public/AccountForms";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: true
    }
  }
});

function AppShell() {
  console.log("APP: AppShell function executing...");
  const queryClient = useQueryClient();
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
  const [authView, setAuthView] = useState<"catalog" | "login" | "register" | "forgot">(() => (resetToken ? "login" : "catalog"));
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
        const csrfCookie = document.cookie.split("; ").find(item => item.startsWith("e16_lms_csrf="));
        if (csrfCookie) setCsrfToken(decodeURIComponent(csrfCookie.split("=")[1] || ""));
        sessionStorage.setItem("e16_lms_active_session", "true");
        // Data APIs stay locked until a temporary password is replaced (ForcedPasswordChange loads the store after).
        if (data.user?.mustChangePassword) return;
        const serverStore = await api.getStore();
        AppStore.hydrate(serverStore);
        setStoreData({ ...serverStore });
      })
      .catch(() => {
        // The session cookie may be invalid/expired but still present in the browser.
        // Actively clear it (no-auth endpoint) so a leftover cookie can't later trigger
        // a false "already logged in with another account" error on next login.
        fetch("/api/auth/force-logout", { method: "POST", credentials: "include" }).catch(() => undefined);
        setCurrentUser(null);
        setCsrfToken(null);
        sessionStorage.removeItem("e16_lms_active_session");
      });
  }, []);

  // Trap the browser Back button so it can't navigate away from this single-page app
  // (there is no client-side router with real history entries to step through instead).
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem("e16_lms_role", currentUser.role);
    } else {
      sessionStorage.removeItem("e16_lms_role");
    }
  }, [currentUser]);

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

  const [activeSystem, setActiveSystem] = useState<"SIS" | "LMS">("SIS");

  useEffect(() => {
    if (currentUser) {
      if (["teacher", "student"].includes(currentUser.role)) {
        setActiveSystem("LMS");
      } else {
        setActiveSystem("SIS");
      }
    }
  }, [currentUser]);

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
    const csrfToken = sessionStorage.getItem("e16_lms_csrf");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined
    }).catch(() => undefined);
    setCurrentUser(null);
    setCsrfToken(null);
    setAuthView("catalog");
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
    if (!localStorage.getItem("e16_lms_data")) {
      localStorage.setItem("e16_lms_data", JSON.stringify(SEEDED_DUMP));
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
    downloadAnchor.download = "e16_lms_standalone.html";
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/20 selection:text-indigo-900 relative ${!currentUser ? "pb-12 overflow-hidden" : ""}`}>
      {/* Dynamic Ambient Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />

      {appNotice && (
        <div
          role="status"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-start justify-between gap-3 border ${
            appNotice.type === "success" ? "bg-emerald-950 border-emerald-500/30 text-emerald-200" : "bg-red-950 border-red-500/30 text-red-200"
          }`}
        >
          <span>{appNotice.message}</span>
          <button type="button" onClick={() => setAppNotice(null)} className="shrink-0 cursor-pointer" aria-label="Đóng thông báo">
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
            setCurrentUser(data.user);
          }}
        />
      ) : currentUser ? (
        <div className="min-h-screen flex flex-col md:flex-row relative">

          {/* DESKTOP SIDEBAR NAV BAR */}
          <aside className={`hidden md:flex flex-col bg-slate-900 border-r border-white/10 p-4 flex-shrink-0 sticky top-0 h-screen z-40 backdrop-blur-xl transition-all duration-300 ${
            isSidebarCollapsed ? "w-20 items-center px-2" : "w-64"
          }`}>
            {/* Top Logo and Toggle */}
            <div className={`flex items-center justify-between pb-4 border-b border-white/5 w-full ${
              isSidebarCollapsed ? "flex-col gap-3" : ""
            }`}>
              <div className="flex items-center space-x-2.5">
                <img
                  src="/mcna-logo.png"
                  alt="MCNA Technology School"
                  className="w-9 h-9 object-contain bg-white rounded-xl p-1 shrink-0 shadow-md"
                />
                {!isSidebarCollapsed && (
                  <div>
                    <h1 className="text-sm font-display font-black tracking-widest text-white uppercase leading-none">MCNA LMS</h1>
                    <p className="text-[9px] text-white/40 uppercase tracking-tighter mt-0.5">Học viện MCNA v1.1</p>
                  </div>
                )}
              </div>

              {/* Collapse/Expand Toggle Button */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition duration-150 cursor-pointer"
                title={isSidebarCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* USER PROFILE DROPDOWN MENU / POPOVER */}
            <div className="relative w-full py-4 border-b border-white/5">
              {/* Dropdown Menu Popup */}
              {userDropdownOpen && (
                <div className={`absolute top-full mt-3 z-50 bg-[#0f172a] border border-white/10 rounded-2xl p-2.5 shadow-2xl backdrop-blur-2xl w-60 animate-in fade-in slide-in-from-top-2 duration-150 ${
                  isSidebarCollapsed ? "left-0" : "left-0 right-0 w-full"
                }`}>
                  {/* Scoped Profile Header Info */}
                  <div className="px-3 py-2 border-b border-white/5 mb-1.5 text-xs text-left">
                    <p className="font-mono text-[9px] text-indigo-300 font-extrabold uppercase tracking-wider mb-0.5">
                      {roleLabel(currentUser.role)}
                    </p>
                    <h6 className="font-bold text-white truncate text-xs">{currentUser.name}</h6>
                    <p className="text-[10px] text-white/40 truncate font-mono mt-0.5">{currentUser.email}</p>
                  </div>

                  {/* Action Buttons */}
                  <button
                    onClick={() => { setShowProfileModal(true); setUserDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <Fingerprint className="h-4 w-4 text-indigo-400" />
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
                    className="w-full text-left px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="h-4 w-4 text-amber-400" />
                    <span>Đổi mật khẩu tài khoản</span>
                  </button>

                  <div className="border-t border-white/5 my-1.5" />

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/10 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Đăng xuất phiên</span>
                  </button>
                </div>
              )}

              {/* Main Profile Trigger Button */}
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`w-full flex items-center gap-3 p-2 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl transition duration-150 cursor-pointer ${
                  isSidebarCollapsed ? "justify-center p-1.5 h-11 w-11" : "text-left"
                }`}
                title={currentUser.name}
              >
                {/* Avatar circle */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-xs text-white shadow-inner shrink-0 uppercase font-mono">
                  {currentUser.name.slice(0, 2)}
                </div>

                {/* User Details */}
                {!isSidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-white truncate leading-none">{currentUser.name}</p>
                    <span className="text-[8px] font-mono font-bold tracking-wider text-white/30 truncate block mt-1 uppercase">
                      {roleLabel(currentUser.role)}
                    </span>
                  </div>
                )}

                {/* Arrow indicator */}
                {!isSidebarCollapsed && (
                  <ChevronDown className={`h-4 w-4 text-white/30 transform transition-transform duration-200 ${
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
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex md:hidden animate-in fade-in duration-150">
              <div className="w-64 bg-slate-900 border-r border-white/15 p-6 space-y-6 animate-in slide-in-from-left duration-200 shadow-2xl">
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="h-5 w-5 text-indigo-400" />
                    <span className="text-sm font-bold text-white font-display">Lớp học E16 LMS</span>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg text-white/60">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="bg-white/5 p-4 rounded-xl text-xs space-y-1">
                  <p className="font-mono text-indigo-300 uppercase font-bold text-[9px]">
                    Vai trò: {roleLabel(currentUser.role)}
                  </p>
                  <p className="text-white font-bold truncate">{currentUser.name}</p>
                </div>

                <div className="space-y-4 pt-4 text-xs">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left py-2.5 px-3 bg-red-500/15 text-red-400 font-bold rounded-xl flex items-center gap-1.5"
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
            <header className="p-4 md:p-6 border-b border-white/10 bg-white/5 backdrop-blur-md flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-white md:hidden hover:bg-white/10 cursor-pointer"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <h3 className="font-display font-black text-white text-sm md:text-base leading-none uppercase tracking-widest hidden md:block">
                  HỌC VIỆN CÔNG NGHỆ MCNA
                </h3>
              </div>

              {/* Header right: Clean Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Hệ thống trực tuyến
                </span>
              </div>
            </header>

            {/* Inner responsive Padding page body */}
            <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center p-16 space-y-4">
                  <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-xs text-indigo-300 font-mono tracking-widest uppercase">Đang tải phân hệ học vụ...</span>
                </div>
              }>
                {currentUser.role === "admin" && (
                  <AdminPanel
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onRefreshData={refreshStoreDataFromServer}
                    activeSystem={activeSystem}
                    updateStore={updateStore}
                  />
                )}
                {currentUser.role === "teacher" && (
                  <TeacherPanel
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onRefreshData={refreshStoreDataFromServer}
                    activeSystem={activeSystem}
                    updateStore={updateStore}
                  />
                )}
                {currentUser.role === "student" && (
                  <StudentPanel
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onRefreshData={refreshStoreDataFromServer}
                    activeSystem={activeSystem}
                  />
                )}
              </React.Suspense>
            </div>
          </main>

        </div>
      ) : authView === "catalog" && !resetToken ? (
        <PublicCourseCatalog
          initialCourseId={initialCourseId}
          onLogin={() => setAuthView("login")}
          onRegister={intent => {
            if (intent) {
              saveEnrollIntent(intent);
              setPendingIntent(intent);
            }
            setAuthView("register");
          }}
        />
      ) : (
        /* AUTH SECTION VIEW (SPLIT SCREEN LOGIN / WELCOME CARD) */
        <div className="min-h-screen flex items-center justify-center p-4 relative z-20 animate-in fade-in zoom-in-95 duration-200">

          <div className="bg-slate-900 border border-white/15 w-full max-w-5xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-2xl">

            {/* LEFT LOGO COLUMN */}
            <div className="lg:col-span-5 bg-[#2563eb]/20 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden min-h-[300px] lg:min-h-0">
              {/* Blur bubble */}
              <div className="absolute top-[-20%] left-[-20%] w-72 h-72 bg-[#2563eb]/35 rounded-full filter blur-[100px]" />

              <div className="flex items-center space-x-2.5 relative z-10 pt-2">
                <img
                  src="/mcna-logo.png"
                  alt="MCNA Technology School"
                  className="h-9 w-9 object-contain bg-white rounded-lg p-1"
                />
                <span className="font-display font-black text-white tracking-widest uppercase text-xs">MCNA LMS</span>
              </div>

              <div className="relative z-10 py-12 space-y-4">
                <h2 className="text-2xl font-display font-extrabold text-white leading-tight">Hệ thống Quản lý Học tập Nâng cao</h2>
                <p className="text-xs text-indigo-200/75 leading-relaxed font-sans max-w-sm">
                  Trải nghiệm môi trường học tập chất lượng cao. Quản lý yêu cầu khóa học, xây dựng đề cương chi tiết, đánh giá kết quả và cấp chứng chỉ trực tuyến tức thì.
                </p>
              </div>

              <div className="relative z-10 text-[10px] font-mono text-white/40">
                Khởi tạo ngày: 2026-05-25 • Nền tảng MCNA
              </div>
            </div>

            {/* RIGHT FORM COLUMN */}
            <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-center space-y-6">
              {!resetToken && (
                <button
                  type="button"
                  onClick={() => setAuthView("catalog")}
                  className="self-start inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" /> Xem danh sách khóa học
                </button>
              )}
              <div className="space-y-1">
                <h3 className="text-lg font-display font-bold text-white tracking-tight">
                  {resetToken
                    ? "Đặt lại mật khẩu"
                    : authView === "register"
                      ? "Tạo tài khoản học viên"
                      : authView === "forgot"
                        ? "Quên mật khẩu"
                        : "Đăng nhập tài khoản của bạn"}
                </h3>
                <p className="text-xs text-white/55">
                  {resetToken
                    ? "Thiết lập mật khẩu mới bằng liên kết một lần được gửi qua email."
                    : authView === "register"
                      ? "Đăng ký bằng email cá nhân – mật khẩu tạm thời sẽ được gửi qua email."
                      : authView === "forgot"
                        ? "Nhập email đăng nhập để nhận liên kết đặt lại mật khẩu."
                        : "Xác thực để truy cập phân hệ học vụ hoặc lớp học tương ứng."}
                </p>
              </div>

              {!resetToken && pendingIntent && (
                <div className="bg-indigo-500/10 border border-indigo-400/20 text-indigo-200 p-3 rounded-xl text-xs flex items-start justify-between gap-3">
                  <span>
                    Đăng nhập hoặc tạo tài khoản để hoàn tất đăng ký {pendingIntent.sectionCode ? `lớp ${pendingIntent.sectionCode} – ` : ""}{pendingIntent.courseTitle || "khóa học đã chọn"}.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearEnrollIntent();
                      setPendingIntent(null);
                    }}
                    className="shrink-0 font-bold cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}

              {!resetToken && authView === "login" && authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 stroke-[2.5] shrink-0" />
                    <span>{authError}</span>
                  </div>
                  {sessionConflict && (
                    <button
                      type="button"
                      onClick={handleForceLogoutOtherSession}
                      className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Đăng xuất tài khoản đang chạy
                    </button>
                  )}
                </div>
              )}

              {resetPasswordError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs">
                  {resetPasswordError}
                </div>
              )}

              {resetPasswordMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl text-xs">
                  {resetPasswordMessage}
                </div>
              )}

              {resetToken ? (
                <form onSubmit={handleCompletePasswordReset} className="space-y-4 text-xs font-sans">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70 block">Mật khẩu mới</label>
                    <input
                      name="newPassword"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Tối thiểu 8 ký tự"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/20 h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70 block">Xác nhận mật khẩu mới</label>
                    <input
                      name="confirmNewPassword"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Nhập lại mật khẩu mới"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/20 h-10"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-white text-indigo-950 hover:bg-white/95 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg tracking-wider uppercase font-display"
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
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Quay lại đăng nhập
                  </button>
                </form>
              ) : authView === "register" ? (
                <SignUpForm
                  intent={pendingIntent}
                  onGoToLogin={email => {
                    if (email) setLoginEmail(email);
                    setAuthError(null);
                    setAuthView("login");
                  }}
                />
              ) : authView === "forgot" ? (
                <ForgotPasswordForm onGoToLogin={() => setAuthView("login")} />
              ) : (
                <>
                  {/* Login submit form */}
                  <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-sans">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-white/70 block">Địa chỉ Email đăng nhập</label>
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="Ví dụ: admin@e16.local"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/25 h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/70 block">Mật khẩu tài khoản</label>
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="Mật khẩu của bạn"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/20 h-10"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-white text-indigo-950 hover:bg-white/95 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg tracking-wider uppercase font-display"
                    >
                      Xác nhận Đăng nhập
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError(null);
                          setAuthView("forgot");
                        }}
                        className="text-white/60 hover:text-white font-semibold cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError(null);
                          setAuthView("register");
                        }}
                        className="text-indigo-300 hover:text-indigo-200 font-bold cursor-pointer"
                      >
                        Chưa có tài khoản? Tạo tài khoản
                      </button>
                    </div>
                  </form>

                </>
              )}

            </div>

          </div>

        </div>
      )}

      {/* 1. VIEW PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-white/15 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition duration-150 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center">
                <Fingerprint className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="font-display font-black text-white text-base leading-none uppercase tracking-widest">LÝ LỊCH CÁ NHÂN</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-tighter mt-1">Thông tin chi tiết tài khoản</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="space-y-1 py-1.5 border-b border-white/5 flex justify-between items-center">
                <span className="text-white/40">Họ và Tên</span>
                <strong className="text-white text-sm">{currentUser.name}</strong>
              </div>
              <div className="space-y-1 py-1.5 border-b border-white/5 flex justify-between items-center">
                <span className="text-white/40">Địa chỉ Email</span>
                <strong className="text-white font-mono">{currentUser.email}</strong>
              </div>
              <div className="space-y-1 py-1.5 border-b border-white/5 flex justify-between items-center">
                <span className="text-white/40">Vai trò Hệ thống</span>
                <strong className="text-indigo-300 font-bold uppercase">{roleLabel(currentUser.role)}</strong>
              </div>
              <div className="space-y-1 py-1.5 border-b border-white/5 flex justify-between items-center">
                <span className="text-white/40">Số Điện thoại</span>
                <strong className="text-white font-mono">{currentUser.phone || "Chưa cập nhật"}</strong>
              </div>
              {currentUser.linkedStudentId && (
                <div className="space-y-1 py-1.5 border-b border-white/5 flex justify-between items-center">
                  <span className="text-white/40">ID Học viên Liên kết</span>
                  <strong className="text-white font-mono">{currentUser.linkedStudentId}</strong>
                </div>
              )}
              <div className="space-y-1 py-1.5 flex justify-between items-center">
                <span className="text-white/40">Ngày kích hoạt</span>
                <strong className="text-white font-mono">{currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : "Chưa xác định"}</strong>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition cursor-pointer border border-white/10"
              >
                Đóng thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHANGE PASSWORD MODAL */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-white/15 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setShowChangePasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition duration-150 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center">
                <Lock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h4 className="font-display font-black text-white text-base leading-none uppercase tracking-widest">ĐỔI MẬT KHẨU</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-tighter mt-1">Cập nhật khóa bảo mật tài khoản</p>
              </div>
            </div>

            {changePasswordError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs">
                {changePasswordError}
              </div>
            )}

            {changePasswordSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl text-xs">
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
                const csrfToken = sessionStorage.getItem("e16_lms_csrf");
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
                <label className="text-xs font-semibold text-white/70 block">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu hiện tại"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/20 h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/20 h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/20 h-10"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg tracking-wider uppercase font-display"
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
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
