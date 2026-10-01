import React, { useState, useEffect } from "react";
import { 
  Users, 
  BookOpen, 
  ShoppingBag,
  DollarSign, 
  TrendingUp, 
  UserPlus, 
  Upload, 
  Download, 
  Check, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  FileSpreadsheet, 
  SlidersHorizontal,
  Database,
  ShieldCheck,
  AlertCircle,
  Info,
  Calendar,
  Clock,
  ShieldAlert,
  Activity,
  LogOut,
  ChevronRight,
  HelpCircle,
  Bell,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  FolderOpen
} from "lucide-react";
import { CrmOutboxStatus, User } from "../types";
import { useApiStore } from "../hooks/apiHooks";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { api } from "../api";

import AdminOrdersManager from "./admin/AdminOrdersManager";
import ModalPortal from "./ModalPortal";
import NotificationInbox from "./NotificationInbox";
import CourseSectionManager from "./CourseSectionManager";
import SendNotificationModal from "./admin/SendNotificationModal";
import ClassPlacementManager from "./admin/ClassPlacementManager";
import OperationsWorkspace from "./operations/OperationsWorkspace";
import SalesWorkspace from "./operations/SalesWorkspace";
import { useAppConfig } from "../appConfig";

// Session content (materials, data, homework, opening materials) reuses the teacher workspace for every course.
const ClassContentManager = React.lazy(() => import("./TeacherPanel"));

type AdminTab = "overview" | "placement" | "orders" | "course_section_mgmt" | "content" | "users" | "audit" | "notifications" | "operations" | "sales";
type StaffRole = "student" | "teacher" | "manager" | "admin";

interface AdminPanelProps {
  currentUser: User;
  onLogout: () => void;
  onRefreshData: () => void;
  activeSystem?: "SIS" | "LMS";
  updateStore?: (updater: (draft: any) => void) => void;
}

function generateClientTemporaryPassword() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    bytes.set(Array.from({ length: 8 }, (_, index) => (Date.now() >> (index % 8)) & 255));
  }
  const token = Array.from(bytes, byte => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
  return `Lms-${token}-1`;
}

export default function AdminPanel({ currentUser, onLogout, onRefreshData, activeSystem = "SIS", updateStore }: AdminPanelProps) {
  const { store, isLoading, isError, refetch } = useApiStore();
  const appConfig = useAppConfig();
  // The class manager runs courses, classes and placements; accounts and the audit trail stay with the system admin.
  const isSystemAdmin = currentUser.role === "admin";
  const isDirectSale = appConfig.salesMode === "direct";
  // Where "enrollment needs attention" leads: the placement screen (direct sale) or the QR order queue (self-service).
  const enrollmentTab: AdminTab = isDirectSale || !isSystemAdmin ? "placement" : "orders";

  const [activeSubTab, setActiveSubTab] = useState<AdminTab>(isSystemAdmin ? "overview" : "placement");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSubTab]);

  useEffect(() => {
    const allowed: AdminTab[] = isSystemAdmin
      ? ["overview", "placement", "orders", "course_section_mgmt", "content", "users", "audit", "notifications", "operations", "sales"]
      : ["overview", "placement", "course_section_mgmt", "content", "notifications", "operations", "sales"];
    if (!allowed.includes(activeSubTab) || (activeSubTab === "orders" && isDirectSale)) {
      setActiveSubTab(isSystemAdmin ? "overview" : "placement");
    }
  }, [currentUser.role, isDirectSale]);

  useEffect(() => {
    const handler = (e: any) => {
      const notif = e.detail;
      if (!notif) return;
      const { relatedEntityType, message } = notif;
      const text = (message || "").toLowerCase();

      if (
        relatedEntityType === "enrollment" ||
        relatedEntityType === "transaction" ||
        text.includes("ghi danh") ||
        text.includes("đăng ký khóa học") ||
        text.includes("thanh toán")
      ) {
        setActiveSubTab(enrollmentTab);
      } else if (
        isSystemAdmin && (
          relatedEntityType === "user" ||
          text.includes("tài khoản") ||
          text.includes("học viên mới")
        )
      ) {
        setActiveSubTab("users");
      } else if (
        relatedEntityType === "course" ||
        relatedEntityType === "section" ||
        text.includes("lớp học phần") ||
        text.includes("mở thêm lớp")
      ) {
        setActiveSubTab("course_section_mgmt");
      } else if (relatedEntityType === "audit" && isSystemAdmin) {
        setActiveSubTab("audit");
      } else {
        setActiveSubTab("notifications");
      }
    };
    window.addEventListener("mcna:notification_click", handler as EventListener);
    return () => window.removeEventListener("mcna:notification_click", handler as EventListener);
  }, [enrollmentTab, isSystemAdmin]);

  // Existing User modals states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<StaffRole>("student");
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSendNotifModal, setShowSendNotifModal] = useState(false);

  useUnsavedChangesWarning(
    showAddUserModal && Boolean(newUserEmail.trim() || newUserName.trim() || newUserPassword.trim())
  );

  // Search & Filter flags for users registry
  const [userSearch, setUserSearch] = useState("");
  const [userDirTab, setUserDirTab] = useState<StaffRole>("student");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [sortField, setSortField] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };
  const itemsPerPage = 8;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [operationsSummary, setOperationsSummary] = useState<any | null>(null);
  const [crmOutbox, setCrmOutbox] = useState<CrmOutboxStatus | null>(null);
  const [loadingCrmOutbox, setLoadingCrmOutbox] = useState(false);
  const [syncingCrm, setSyncingCrm] = useState(false);
  const [crmSyncMessage, setCrmSyncMessage] = useState<string | null>(null);

  const loadCrmOutbox = async () => {
    setLoadingCrmOutbox(true);
    try {
      const data = await api.getCrmOutboxStatus();
      setCrmOutbox(data);
    } catch (err: any) {
      console.warn("Failed to load CRM outbox:", err);
    } finally {
      setLoadingCrmOutbox(false);
    }
  };

  const handleSyncCrm = async (retryFailed = false) => {
    setSyncingCrm(true);
    setCrmSyncMessage(null);
    try {
      const res = await api.syncCrmOutbox({ retryFailed });
      if (!res.configured) {
        setCrmSyncMessage("Máy chủ chưa cấu hình CRM_WEBHOOK_URL hoặc CRM_WEBHOOK_SECRET.");
      } else {
        setCrmSyncMessage(`Đồng bộ hoàn tất: Đã gửi ${res.sent} sự kiện, lỗi ${res.failed}.`);
      }
      await loadCrmOutbox();
    } catch (err: any) {
      setCrmSyncMessage(`Lỗi đồng bộ: ${err.message || "Không thể gửi sự kiện"}`);
    } finally {
      setSyncingCrm(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "audit") {
      loadCrmOutbox();
    }
  }, [activeSubTab]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    api.getOperationsSummary()
      .then(summary => { if (!cancelled) setOperationsSummary(summary); })
      .catch(() => { if (!cancelled) setOperationsSummary(null); });
    return () => { cancelled = true; };
  }, [store.enrollments.length, store.submissions.length, store.courses.length]);

  // Create User Action
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.includes("@") || newUserPassword.length < 8 || !newUserName.trim()) {
      triggerToast("Thông tin đăng ký chưa hợp lệ (Mật khẩu tối thiểu 8 ký tự).");
      return;
    }

    const roleToSubmit = newUserRole;

    const exists = store.users.find(u => u.email.toLowerCase() === newUserEmail.toLowerCase());
    if (exists) {
      triggerToast("Email đăng ký này tài khoản đã tồn tại.");
      return;
    }

    try {
      await api.createUser({
        email: newUserEmail.toLowerCase().trim(),
        password: newUserPassword,
        name: newUserName.trim(),
        role: roleToSubmit
      });
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setShowAddUserModal(false);
      onRefreshData();
      triggerToast("Đã lưu trữ và thiết lập tài khoản thành công.");
    } catch (err: any) {
      triggerToast(err.message || "Không thể tạo tài khoản.");
    }
  };

  // CSV Users Bulk Import Entry
  const handleImportCSVSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      triggerToast("Chưa nhập nội dung tệp CSV.");
      return;
    }

    const parseCsvLine = (row: string) => {
      const columns: string[] = [];
      let value = "";
      let quoted = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const next = row[i + 1];
        if (char === '"' && quoted && next === '"') {
          value += '"';
          i++;
          continue;
        }
        if (char === '"') {
          quoted = !quoted;
          continue;
        }
        if (char === "," && !quoted) {
          columns.push(value.trim());
          value = "";
          continue;
        }
        value += char;
      }
      columns.push(value.trim());
      return columns;
    };

    const rows = csvText.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const usersToImport: Array<{
      name: string;
      email: string;
      role: StaffRole;
    }> = [];
    const seenEmails = new Set<string>();
    let localErrorCount = 0;

    rows.forEach((row, index) => {
      if (index === 0 && (row.toLowerCase().includes("name") || row.toLowerCase().includes("email"))) {
        return;
      }

      const columns = parseCsvLine(row);
      if (columns.length < 3) {
        localErrorCount++;
        return;
      }

      const [name, email, role] = columns;
      const cleanEmail = email.toLowerCase().trim();
      const cleanRole = role.toLowerCase().trim();
      const roleValidated = ["student", "teacher", "manager", "admin"].includes(cleanRole);
      const emailUnique = !seenEmails.has(cleanEmail) && !store.users.some(u => u.email.toLowerCase() === cleanEmail);

      if (!name.trim() || !cleanEmail.includes("@") || !roleValidated || !emailUnique) {
        localErrorCount++;
        return;
      }

      seenEmails.add(cleanEmail);
      usersToImport.push({
        name: name.trim(),
        email: cleanEmail,
        role: cleanRole as StaffRole
      });
    });

    if (usersToImport.length === 0) {
      setImportMessage({
        type: "error",
        text: `Nhập dữ liệu đồng loạt thất bại. Toàn bộ ${localErrorCount} dòng có lỗi định dạng, quyền hạn hoặc email trùng lặp.`
      });
      return;
    }

    try {
      const batchTemporaryPassword = generateClientTemporaryPassword();
      const result = await api.bulkCreateUsers({ users: usersToImport, defaultPassword: batchTemporaryPassword });
      onRefreshData();
      const totalFailed = localErrorCount + result.errorCount;
      setImportMessage({
        type: result.createdCount > 0 ? "success" : "error",
        text: result.createdCount > 0
          ? `Đã xử lý CSV. Thành công: ${result.createdCount} tài khoản. Bỏ qua/thất bại: ${totalFailed}. Mật khẩu khởi tạo theo lô: ${batchTemporaryPassword}`
          : `Đã xử lý CSV. Thành công: 0 tài khoản. Bỏ qua/thất bại: ${totalFailed}.`
      });
      if (result.createdCount > 0) {
        setCsvText("");
      }
    } catch (err: any) {
      setImportMessage({
        type: "error",
        text: err.message || "Không thể nhập CSV vào cơ sở dữ liệu."
      });
    }
  };

  // Toggle user active status action
  const handleToggleUserStatus = (userId: string) => {
    const user = store.users.find(u => u.id === userId);
    if (!user) return;
    const nextState = !user.isActive;
    api.setUserStatus(userId, nextState)
      .then(() => {
        onRefreshData();
        triggerToast("Đã cập nhật trạng thái hoạt động người dùng.");
      })
      .catch((err: Error) => triggerToast(err.message || "Không thể cập nhật trạng thái."));
  };

  const handleUpdateUserRole = (userId: string, newRole: User["role"]) => {
    const allowedRoles: User["role"][] = ["student", "teacher", "manager", "admin"];
    if (!allowedRoles.includes(newRole)) return;
    
    api.setUserRole(userId, newRole)
      .then(() => {
        onRefreshData();
        triggerToast("Đã cập nhật quyền hạn người dùng thành công và lưu vào cơ sở dữ liệu.");
      })
      .catch((err: Error) => {
        triggerToast(err.message || "Không thể cập nhật quyền hạn người dùng.");
      });
  };

  // Local JSON snapshot export dump backup
  const handleExportDataStore = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sis_lms_backup_data_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Đã sao lưu dọn dẹp kết tinh tệp JSON sao lưu.");
  };

  // Computed counters metrics
  const totalUsersCount = store.users.length;
  const totalCoursesCount = store.courses.length;
  const totalEnrollmentsCount = store.enrollments.length;
  const unreadAdminNotificationsCount = (store.notifications || []).filter(
    (n: any) => n.userId === currentUser.id && !n.isRead
  ).length;

  // Search filter listings
  const filteredUsers = store.users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearch.toLowerCase());
    return matchesSearch && u.role === userDirTab;
  }).sort((a, b) => {
    if (!sortField) return 0;
    let valA: any = a[sortField as keyof User];
    let valB: any = b[sortField as keyof User];

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }
    if (typeof valA === "boolean" && typeof valB === "boolean") {
      return sortOrder === "asc" ? (valA === valB ? 0 : valA ? -1 : 1) : (valA === valB ? 0 : valA ? 1 : -1);
    }
    return 0;
  });

  const pageCount = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage);
  const pendingEnrollmentsCount = (store.enrollments || []).filter((enrollment: any) => enrollment.status === "pending_payment" || enrollment.status === "pending").length;
  const waitingPlacementCount = (store.enrollments || []).filter((enrollment: any) => enrollment.status === "pending").length;
  const filteredAuditLogs = (store.auditLogs || []).filter(log => {
    const query = auditSearch.toLowerCase();
    const matchesSearch = !query || [log.action, log.userId, log.target, log.detail].some(value => value.toLowerCase().includes(query));
    return matchesSearch && (auditFilterAction === "all" || log.action === auditFilterAction);
  });
  type NavItem = { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; count: number };
  const operationItems: NavItem[] = [
    { id: "overview", label: "Tổng quan", icon: Activity, count: 0 },
    { id: "placement", label: "Học viên & Xếp lớp", icon: UserCheck, count: waitingPlacementCount },
    // The QR self-registration queue only exists while the LMS runs in self-service mode.
    ...(isSystemAdmin && !isDirectSale ? [{ id: "orders" as AdminTab, label: "Đơn hàng & Ghi danh", icon: ShoppingBag, count: pendingEnrollmentsCount }] : []),
    { id: "course_section_mgmt", label: "Khóa học & Lớp học", icon: BookOpen, count: 0 },
    { id: "content", label: "Nội dung lớp học", icon: FolderOpen, count: 0 },
    { id: "operations", label: "Vận hành lớp học", icon: Users, count: 0 },
    { id: "sales", label: "Tư vấn & Ưu đãi", icon: ShoppingBag, count: 0 }
  ];
  const adminNavGroups: Array<{ label: string; items: NavItem[] }> = isSystemAdmin
    ? [
        { label: "Vận hành", items: operationItems },
        { label: "Hệ thống & tài khoản", items: [
          { id: "users", label: "Quản lý người dùng", icon: Users, count: 0 },
          { id: "audit", label: "Nhật ký hệ thống", icon: Database, count: 0 },
          { id: "notifications", label: "Thông báo hệ thống", icon: Bell, count: unreadAdminNotificationsCount }
        ] }
      ]
    : [
        { label: "Quản lý lớp", items: [...operationItems, { id: "notifications", label: "Thông báo", icon: Bell, count: unreadAdminNotificationsCount }] }
      ];

  return (
    <div className="space-y-6">
      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-xs">Đang tải dữ liệu...</div>}
      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span>Không thể tải dữ liệu từ server.</span>
          <button onClick={() => refetch()} className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1 font-semibold text-rose-700 hover:bg-rose-50 transition cursor-pointer shadow-xs">Thử lại</button>
        </div>
      )}
      {/* Toast logs alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white font-medium text-xs px-4 py-3 rounded-xl shadow-xl animate-in fade-in duration-150">
          {toastMessage}
        </div>
      )}

      {/* Main Administrative Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">{isSystemAdmin ? "Quản trị học viện" : "Quản lý lớp"}</h2>
          <p className="text-sm text-slate-500 mt-1">{isSystemAdmin ? "Theo dõi việc cần xử lý và quản lý vận hành LMS." : "Tạo lớp, xếp học viên vào lớp và quản lý nội dung từng buổi học."}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSubTab === "audit" && <button
            onClick={() => setShowImportModal(true)}
            className="mcna-btn-secondary !h-9 !px-3.5 !text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="h-4 w-4 text-slate-500" /> Nhập CSV
          </button>}
          {activeSubTab === "audit" && <button
            onClick={handleExportDataStore}
            className="mcna-btn-secondary !h-9 !px-3.5 !text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" /> Sao lưu JSON
          </button>}
          {activeSubTab === "notifications" && isSystemAdmin && <button
            onClick={() => setShowSendNotifModal(true)}
            className="mcna-btn-secondary !h-9 !px-3.5 !text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="h-4 w-4 text-slate-500" /> Gửi thông báo
          </button>}
          {activeSubTab === "users" && <button
            onClick={() => setShowAddUserModal(true)}
            className="mcna-btn-primary !h-9 !px-3.5 !text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Tạo người dùng
          </button>}
        </div>
      </div>

      {/* Main Two-Column Layout split sidebar list vs viewports */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

        <div className="lg:hidden w-full">
          <label htmlFor="admin-section" className="sr-only">Mục quản trị</label>
          <select id="admin-section" value={activeSubTab} onChange={event => setActiveSubTab(event.target.value as AdminTab)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900">
            {adminNavGroups.flatMap(group => group.items).map(item => (
              <option key={item.id} value={item.id}>{item.label}{item.count > 0 ? ` (${item.count})` : ""}</option>
            ))}
          </select>
        </div>
        
        {/* Left Column navbar structured sections */}
        <div className="hidden lg:block w-56 xl:w-60 flex-shrink-0 space-y-4">
          <nav aria-label="Điều hướng quản trị" className="bg-white border border-slate-200 rounded-xl p-2 text-sm space-y-3">
            {adminNavGroups.map((group, groupIndex) => (
              <div key={group.label} className={`space-y-1 ${groupIndex ? "border-t border-slate-100 pt-2" : ""}`}>
                <span className="block px-2.5 py-1 text-xs font-semibold text-slate-500">{group.label}</span>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const selected = activeSubTab === item.id;
                  return <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSubTab(item.id)}
                    aria-current={selected ? "page" : undefined}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-left font-medium transition-colors ${selected ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    <span className="flex min-w-0 items-center gap-2"><Icon className="h-4 w-4 shrink-0" />{item.label}</span>
                    {item.count > 0 && <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">{item.count}</span>}
                  </button>;
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Right Main viewport area container */}
        <div className="flex-1 min-w-0 w-full">

          {activeSubTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Tổng quan vận hành</h3>
                <p className="mt-1 text-sm text-slate-500">Số liệu hiện tại và các việc cần theo dõi.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Người dùng", totalUsersCount],
                  ["Khóa học", totalCoursesCount],
                  ["Lượt ghi danh", totalEnrollmentsCount]
                ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}
              </div>
              {operationsSummary && <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h4 className="text-base font-semibold text-slate-900">Việc cần theo dõi</h4><p className="mt-1 text-sm text-slate-500">Tổng hợp từ LMS và CRM.</p></div><button type="button" onClick={() => api.getOperationsSummary().then(setOperationsSummary).catch(() => undefined)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Làm mới</button></div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [isDirectSale ? "Học viên chờ xếp lớp" : "Ghi danh chờ xử lý", isDirectSale ? waitingPlacementCount : operationsSummary.pendingEnrollments],
                    ["CRM giao thất bại", operationsSummary.crmFailures]
                  ].map(([label, value]) => <div key={String(label)} className="border-l-2 border-indigo-300 bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}
                </div>
              </section>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveSubTab(enrollmentTab)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">{enrollmentTab === "placement" ? "Xếp lớp cho học viên" : "Xử lý ghi danh"}</button>
                <button type="button" onClick={() => setActiveSubTab("course_section_mgmt")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Khóa học & Lớp học</button>
                {isSystemAdmin && <button type="button" onClick={() => setActiveSubTab("users")} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Quản lý người dùng</button>}
              </div>
            </div>
          )}
          
          {/* DIRECT SALE: PAID LEARNERS AND CLASS PLACEMENT */}
          {activeSubTab === "operations" && <OperationsWorkspace store={store} currentUser={currentUser} onChanged={onRefreshData}/>}
          {activeSubTab === "sales" && <SalesWorkspace store={store} onChanged={onRefreshData}/>}
          {activeSubTab === "placement" && (
            <ClassPlacementManager
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
              triggerToast={triggerToast}
            />
          )}

          {/* SESSION CONTENT OF EVERY CLASS */}
          {activeSubTab === "content" && (
            <React.Suspense fallback={<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải nội dung lớp học...</div>}>
              <ClassContentManager currentUser={currentUser} onLogout={onLogout} onRefreshData={onRefreshData} updateStore={updateStore} embedded />
            </React.Suspense>
          )}

          {/* ORDERS & ENROLLMENTS GROUP */}
          {activeSubTab === "orders" && (
            <AdminOrdersManager
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
              triggerToast={triggerToast}
            />
          )}
          
          {/* COURSE & SECTION MANAGEMENT GROUP */}
          {activeSubTab === "course_section_mgmt" && (
            <CourseSectionManager
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
            />
          )}

          {activeSubTab === "notifications" && (
            <NotificationInbox
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
              triggerToast={triggerToast}
            />
          )}

          {/* EXISTING USER ACCESS CONTROLS REGISTRY */}
          {activeSubTab === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Người dùng</h3>
                  <p className="mt-1 text-sm text-slate-500">Tìm kiếm, phân quyền và quản lý trạng thái tài khoản.</p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Tìm theo tên, email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                    className="px-3 py-1.5 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                  />

                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "student", label: "Học Viên" },
                  { id: "teacher", label: "Giảng Viên" },
                  { id: "manager", label: "Quản Lý Lớp" },
                  { id: "admin", label: "Quản Trị Viên" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setUserDirTab(tab.id as StaffRole); setUserPage(1); }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${userDirTab === tab.id ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 md:hidden">
                {paginatedUsers.map(usr => <article key={usr.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h4 className="font-semibold text-slate-900">{usr.name}</h4><p className="truncate text-xs text-slate-500">{usr.email}</p></div>
                    <span className={`shrink-0 text-xs font-medium ${usr.isActive ? "text-emerald-700" : "text-rose-700"}`}>{usr.isActive ? "Đang hoạt động" : "Đang khóa"}</span>
                  </div>
                  {userDirTab === "student" && <p className="text-sm text-slate-600">{usr.phone || "Chưa có số điện thoại"}</p>}
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <label className="text-xs text-slate-500">Vai trò <select value={usr.role} onChange={event => handleUpdateUserRole(usr.id, event.target.value as User["role"])} disabled={usr.id === currentUser.id} className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:opacity-50"><option value="student">Học viên</option><option value="teacher">Giảng viên</option><option value="manager">Quản lý lớp</option><option value="admin">Quản trị viên</option></select></label>
                    {usr.id !== currentUser.id && <button type="button" onClick={() => handleToggleUserStatus(usr.id)} className="text-sm font-medium text-indigo-700">{usr.isActive ? "Khóa" : "Kích hoạt"}</button>}
                  </div>
                </article>)}
                {paginatedUsers.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Không có tài khoản phù hợp.</p>}
              </div>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase text-slate-500 font-semibold tracking-wider">
                        <th className="py-3 px-3.5 cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSort("name")}>
                          Họ và Tên {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="py-3 px-3.5 cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSort("email")}>
                          Email cá nhân {sortField === "email" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        {userDirTab === "student" && (
                          <th className="py-3 px-3.5 cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSort("phone")}>
                            Số điện thoại {sortField === "phone" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                          </th>
                        )}
                        <th className="py-3 px-3.5 cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSort("role")}>
                          Quyền hạn {sortField === "role" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="py-3 px-3.5 cursor-pointer select-none hover:text-slate-900 transition" onClick={() => handleSort("isActive")}>
                          Trạng thái khóa {sortField === "isActive" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="py-3 px-3.5 text-right">Khóa/Mở Khóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedUsers.map(usr => {
                        return (
                          <tr key={usr.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-3.5 font-semibold text-slate-900">{usr.name}</td>
                            <td className="py-3 px-3.5 font-mono text-slate-600">{usr.email}</td>
                            {userDirTab === "student" && (
                              <td className="py-3 px-3.5 text-slate-600">
                                <div className="font-mono text-indigo-600 font-medium">{usr.phone || "Chưa có SĐT"}</div>
                                <div className="text-[10px] text-slate-400">{usr.schoolEmail || "Chưa cấp email trường"}</div>
                              </td>
                            )}
                            <td className="py-3 px-3.5">
                              <select
                                value={usr.role}
                                onChange={(e) => handleUpdateUserRole(usr.id, e.target.value as User["role"])}
                                disabled={usr.id === currentUser.id}
                                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                              >
                                <option value="student">Học viên</option>
                                <option value="teacher">Giảng viên</option>
                                <option value="manager">Quản lý lớp</option>
                                <option value="admin">Quản trị viên</option>
                              </select>
                            </td>
                            <td className="py-3 px-3.5">
                              {usr.isActive ? (
                                <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md">Đang hoạt động</span>
                              ) : (
                                <span className="text-red-700 font-semibold text-[11px] bg-red-50 px-2 py-0.5 rounded-md">Đang khóa</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              {usr.id !== currentUser.id ? (
                                <button
                                  onClick={() => handleToggleUserStatus(usr.id)}
                                  className={`px-2.5 py-1 rounded-lg transition text-[11px] font-semibold cursor-pointer ${usr.isActive ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}
                                >
                                  {usr.isActive ? "Khóa" : "Kích hoạt"}
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Tài khoản hiện hành</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedUsers.length === 0 && (
                        <tr>
                          <td colSpan={userDirTab === "student" ? 6 : 5} className="py-10 text-center text-slate-400">
                            Không có tài khoản phù hợp trong thư mục này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paginations */}
              {pageCount > 1 && (
                <div className="flex justify-between items-center text-xs">
                  <button
                    onClick={() => setUserPage(p => Math.max(p - 1, 1))}
                    disabled={userPage === 1}
                    className="p-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Trước
                  </button>
                  <span className="text-slate-500 text-[11px]">Trang {userPage} / {pageCount}</span>
                  <button
                    onClick={() => setUserPage(p => Math.min(p + 1, pageCount))}
                    disabled={userPage === pageCount}
                    className="p-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Sau
                  </button>
                </div>
              )}

            </div>
          )}

          {/* SYSTEM SECURITY COMPLIANCE AUDIT LOGS */}
          {activeSubTab === "audit" && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-xl font-semibold text-slate-900">Nhật ký hệ thống &amp; Tích hợp CRM</h3>
                <p className="mt-1 text-sm text-slate-500">Theo dõi thao tác quản trị, nhật ký bảo mật và đồng bộ dữ liệu đa kênh CRM.</p>
              </div>

              {/* CRM INTEGRATION & OUTBOX SYNC MONITOR */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Radio className="h-5 w-5 text-indigo-600" />
                      <h4 className="text-base font-bold text-slate-900">Kết nối &amp; Đồng bộ CRM (Outbox)</h4>
                      {crmOutbox?.configured ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Webhook hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="h-3 w-3" /> Chưa cấu hình Webhook URL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Hàng đợi gửi sự kiện tự động sang CRM (đăng ký mới, kích hoạt khóa học, đóng học phí, cấp chứng chỉ).
                      {crmOutbox?.webhookUrl && <span className="font-mono text-[11px] ml-1 text-slate-600">({crmOutbox.webhookUrl})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {crmOutbox && crmOutbox.counts.failed > 0 && (
                      <button
                        type="button"
                        disabled={syncingCrm}
                        onClick={() => handleSyncCrm(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition disabled:opacity-50"
                      >
                        Thử lại {crmOutbox.counts.failed} sự kiện lỗi
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={syncingCrm || loadingCrmOutbox}
                      onClick={() => handleSyncCrm(false)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transition inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingCrm ? "animate-spin" : ""}`} />
                      {syncingCrm ? "Đang đồng bộ..." : "Đồng bộ CRM ngay"}
                    </button>
                  </div>
                </div>

                {crmSyncMessage && (
                  <div className="p-3 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between">
                    <span>{crmSyncMessage}</span>
                    <button type="button" onClick={() => setCrmSyncMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">×</button>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-center">
                    <span className="text-[11px] text-slate-500 font-medium block">Tổng sự kiện</span>
                    <span className="text-xl font-bold font-mono text-slate-900">{crmOutbox?.counts.total ?? "—"}</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3 text-center">
                    <span className="text-[11px] text-emerald-700 font-medium block">Đã gửi thành công</span>
                    <span className="text-xl font-bold font-mono text-emerald-600">{crmOutbox?.counts.sent ?? "—"}</span>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 text-center">
                    <span className="text-[11px] text-amber-700 font-medium block">Đang chờ gửi</span>
                    <span className="text-xl font-bold font-mono text-amber-600">{crmOutbox?.counts.pending ?? "—"}</span>
                  </div>
                  <div className="bg-rose-50/50 border border-rose-200/60 rounded-xl p-3 text-center">
                    <span className="text-[11px] text-rose-700 font-medium block">Thất bại</span>
                    <span className="text-xl font-bold font-mono text-rose-600">{crmOutbox?.counts.failed ?? "—"}</span>
                  </div>
                </div>

                {/* Recent events list */}
                {crmOutbox?.recentEvents && crmOutbox.recentEvents.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sự kiện gần đây</span>
                      <button
                        type="button"
                        onClick={loadCrmOutbox}
                        className="text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium"
                      >
                        Làm mới danh sách
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      {crmOutbox.recentEvents.map(evt => (
                        <div key={evt.id} className="p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 bg-white hover:bg-slate-50">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-slate-800">{evt.eventType}</span>
                              <span className="text-[10px] text-slate-400 font-mono">#{evt.id.slice(0, 14)}</span>
                            </div>
                            {evt.lastError && (
                              <p className="text-[11px] text-rose-600 line-clamp-1 break-all">Lỗi: {evt.lastError}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] text-slate-400">{new Date(evt.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              evt.status === "sent" ? "bg-emerald-100 text-emerald-800" :
                              evt.status === "pending" ? "bg-amber-100 text-amber-800" :
                              "bg-rose-100 text-rose-800"
                            }`}>
                              {evt.status === "sent" ? "Đã gửi" : evt.status === "pending" ? `Chờ (${evt.attempts})` : `Lỗi (${evt.attempts})`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reactive filter inputs */}
              <div className="flex flex-col md:flex-row gap-3 bg-white border border-slate-200/80 p-3.5 rounded-xl text-xs shadow-xs">
                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block">Tìm kiếm nhật ký</span>
                  <input
                    type="text"
                    placeholder="Tìm theo hành động, user ID, target, hoặc nội dung..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="w-full md:w-48 space-y-1">
                  <span className="text-[11px] text-slate-500 font-semibold block">Lọc theo hành động</span>
                  <select
                    value={auditFilterAction}
                    onChange={(e) => setAuditFilterAction(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg focus:outline-none font-sans"
                  >
                    <option value="all">Tất cả hành động</option>
                    {Array.from(new Set((store?.auditLogs || []).map(l => l.action))).map(act => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {filteredAuditLogs.map((log, i) => (
                  <div key={log.id || i} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-900">{log.action}</span><time className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("vi-VN")}</time></div>
                    <p className="mt-1 break-words text-slate-700">{log.detail}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">Người thực hiện: {log.userId} · Đối tượng: {log.target}</p>
                  </div>
                ))}
                {filteredAuditLogs.length === 0 && <div className="py-10 text-center text-sm text-slate-500">Không tìm thấy bản ghi nhật ký phù hợp.</div>}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* USER REGISTRATION POPUP MODAL */}
      {showAddUserModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-150 text-slate-900">
            <button 
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              Khởi tạo người dùng hệ thống mới
            </h3>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Họ và Tên</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Gavin Belson"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Địa chỉ Email</label>
                <input
                  type="email"
                  required
                  placeholder="Ví dụ: gavin@hooli.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Mật khẩu ban đầu</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự bảo mật"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Phân hệ Quyền</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 font-sans"
                >
                  <option value="student">Học Viên (Student)</option>
                  <option value="teacher">Giảng Viên (Teacher)</option>
                  <option value="manager">Quản Lý Lớp (Class manager)</option>
                  <option value="admin">Quản Trị Viên (Admin)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* IMPORT MULTIPLE USERS REGISTRY CSV */}
      {showImportModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-slate-900">
            <button 
              onClick={() => { setShowImportModal(false); setImportMessage(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-100 pb-3">
              Nhập đồng loạt người dùng từ CSV
            </h3>

            {importMessage && (
              <div className={`mb-4 rounded-xl p-3 flex items-center gap-2 text-xs border ${
                importMessage.type === "success" 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                  : "bg-red-50 border-red-200 text-red-700 animate-shake"
              }`}>
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>{importMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleImportCSVSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Nhập dòng giá trị ngăn cách bởi dấu phẩy. Cột định dạng: <code className="text-indigo-600 font-semibold font-mono">name, email, role</code>. Hệ thống sẽ sinh mật khẩu tạm thời cho từng lô nhập.
                </p>
                <textarea
                  required
                  placeholder="name, email, role&#10;Gavin Belson, gavin@hooli.com, student&#10;Laurie Bream, laurie@raviga.com, teacher"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 font-mono placeholder-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 h-36 mt-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportMessage(null); }}
                  className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Xác nhận tải tệp lên
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
      {showSendNotifModal && (
        <SendNotificationModal
          isOpen={showSendNotifModal}
          onClose={() => setShowSendNotifModal(false)}
          store={store}
          onSent={onRefreshData}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
