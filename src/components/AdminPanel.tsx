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
  ClipboardList,
  KeyRound,
  Copy
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
import SystemStatusCard from "./admin/SystemStatusCard";
import { Avatar, Badge, Button, Callout, Card, cx, Dialog, EmptyState, PageHeader, SearchField, SectionTitle, Segmented, Spinner, StatTile, useToast } from "./ui";

interface AdminPanelProps {
  currentUser: User;
  onLogout: () => void;
  onRefreshData: () => void;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  navNonce?: number;
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

export default function AdminPanel({ currentUser, onRefreshData, activeSubTab, setActiveSubTab }: AdminPanelProps) {
  const { store, isLoading, isError, refetch } = useApiStore();
  const toast = useToast();

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
        setActiveSubTab("orders");
      } else if (
        relatedEntityType === "user" ||
        text.includes("tài khoản") ||
        text.includes("học viên mới")
      ) {
        setActiveSubTab("users");
      } else if (
        relatedEntityType === "course" ||
        relatedEntityType === "section" ||
        text.includes("lớp học phần") ||
        text.includes("mở thêm lớp")
      ) {
        setActiveSubTab("course_section_mgmt");
      } else if (relatedEntityType === "audit") {
        setActiveSubTab("audit");
      } else {
        setActiveSubTab("notifications");
      }
    };
    window.addEventListener("mcna:notification_click", handler as EventListener);
    return () => window.removeEventListener("mcna:notification_click", handler as EventListener);
  }, []);

  // Existing User modals states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"student" | "teacher" | "admin">("student");
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSendNotifModal, setShowSendNotifModal] = useState(false);

  useUnsavedChangesWarning(
    showAddUserModal && Boolean(newUserEmail.trim() || newUserName.trim() || newUserPassword.trim())
  );

  // Search & Filter flags for users registry
  const [userSearch, setUserSearch] = useState("");
  const [userDirTab, setUserDirTab] = useState<"student" | "teacher" | "admin">("student");
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

  const triggerToast = (msg: string) => toast(msg);

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
      role: "student" | "teacher" | "admin";
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
      const roleValidated = ["student", "teacher", "admin"].includes(cleanRole);
      const emailUnique = !seenEmails.has(cleanEmail) && !store.users.some(u => u.email.toLowerCase() === cleanEmail);

      if (!name.trim() || !cleanEmail.includes("@") || !roleValidated || !emailUnique) {
        localErrorCount++;
        return;
      }

      seenEmails.add(cleanEmail);
      usersToImport.push({
        name: name.trim(),
        email: cleanEmail,
        role: cleanRole as "student" | "teacher" | "admin"
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

  // Password reset: emails a one-time link; the link is shown here only when the email could not be sent.
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetLink, setResetLink] = useState<{ url: string; message: string } | null>(null);
  const [resetLinkCopied, setResetLinkCopied] = useState(false);

  const closeResetDialog = () => {
    setResetTarget(null);
    setResetLink(null);
    setResetLinkCopied(false);
  };

  const handleSendResetLink = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const result: any = await api.resetPassword(resetTarget.id);
      if (!result?.emailSent && result?.resetUrl) {
        setResetLink({ url: result.resetUrl, message: result.message });
      } else {
        toast(result?.message || `Đã gửi liên kết đặt lại mật khẩu tới ${resetTarget.email}.`, "success");
        closeResetDialog();
      }
    } catch (err: any) {
      toast(err.message || "Không thể tạo liên kết đặt lại mật khẩu.", "error");
    } finally {
      setResetBusy(false);
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
    const allowedRoles: User["role"][] = ["student", "teacher", "admin"];
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
  const filteredAuditLogs = (store.auditLogs || []).filter(log => {
    const query = auditSearch.toLowerCase();
    const matchesSearch = !query || [log.action, log.userId, log.target, log.detail].some(value => value.toLowerCase().includes(query));
    return matchesSearch && (auditFilterAction === "all" || log.action === auditFilterAction);
  });
  const adminNavGroups = [
    { label: "Vận hành", items: [
      { id: "overview", label: "Tổng quan", icon: Activity, count: 0 },
      { id: "orders", label: "Đơn hàng & Ghi danh", icon: ShoppingBag, count: pendingEnrollmentsCount },
      { id: "course_section_mgmt", label: "Khóa học & Lớp học", icon: BookOpen, count: 0 },
    ] },
    { label: "Hệ thống & tài khoản", items: [
      { id: "users", label: "Quản lý người dùng", icon: Users, count: 0 },
      { id: "audit", label: "Nhật ký hệ thống", icon: Database, count: 0 },
      { id: "notifications", label: "Thông báo hệ thống", icon: Bell, count: unreadAdminNotificationsCount }
    ] }
  ] as const;

  const sortIndicator = (field: string) => (sortField === field ? (sortOrder === "asc" ? "↑" : "↓") : "");
  const SortTh = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => (
    <th className={cx("mcna-th", className)}>
      <button type="button" onClick={() => handleSort(field)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {children} <span className="text-slate-500">{sortIndicator(field)}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-8">
      {isLoading && <Spinner label="Đang tải dữ liệu…" />}
      {isError && <Callout tone="danger" title="Không thể tải dữ liệu từ máy chủ." action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Thử lại</Button>} />}

      {activeSubTab === "overview" && (
        <div className="space-y-8">
          <PageHeader title="Tổng quan" subtitle="Tình hình học viện hôm nay và những việc cần xử lý." />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Người dùng" value={totalUsersCount} icon={<Users className="h-[18px] w-[18px]" />} />
            <StatTile label="Khóa học" value={totalCoursesCount} icon={<BookOpen className="h-[18px] w-[18px]" />} tone="violet" />
            <StatTile label="Lượt ghi danh" value={totalEnrollmentsCount} icon={<TrendingUp className="h-[18px] w-[18px]" />} tone="emerald" />
            <StatTile label="Chờ xử lý" value={operationsSummary?.pendingEnrollments ?? pendingEnrollmentsCount} icon={<ClipboardList className="h-[18px] w-[18px]" />} tone="amber" hint="Ghi danh cần duyệt" />
          </div>

          <section className="space-y-3">
            <SectionTitle
              title="Việc cần làm"
              action={<Button size="sm" variant="ghost" icon={<RefreshCw className="h-4 w-4" />} onClick={() => api.getOperationsSummary().then(setOperationsSummary).catch(() => undefined)}>Làm mới</Button>}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card as="button" type="button" interactive onClick={() => setActiveSubTab("orders")} className="flex items-center gap-4 p-5 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><ClipboardList className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-slate-900">{(operationsSummary?.pendingEnrollments ?? pendingEnrollmentsCount) || "Không có"} ghi danh chờ xử lý</span>
                  <span className="block text-sm text-slate-500">Xác nhận thanh toán và xếp lớp cho học viên</span>
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </Card>
              <Card as="button" type="button" interactive onClick={() => setActiveSubTab("audit")} className="flex items-center gap-4 p-5 text-left">
                <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", operationsSummary?.crmFailures ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}><Radio className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-slate-900">{operationsSummary?.crmFailures ? `${operationsSummary.crmFailures} sự kiện CRM lỗi` : "Đồng bộ CRM ổn định"}</span>
                  <span className="block text-sm text-slate-500">Theo dõi hàng đợi gửi sang CRM</span>
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </Card>
            </div>
          </section>

          <SystemStatusCard />
        </div>
      )}

      {activeSubTab === "orders" && (
        <AdminOrdersManager store={store} currentUser={currentUser} onRefreshData={onRefreshData} triggerToast={triggerToast} />
      )}

      {activeSubTab === "course_section_mgmt" && (
        <CourseSectionManager store={store} currentUser={currentUser} onRefreshData={onRefreshData} />
      )}

      {activeSubTab === "notifications" && (
        <NotificationInbox store={store} currentUser={currentUser} onRefreshData={onRefreshData} triggerToast={triggerToast} />
      )}

      {resetTarget && (
        <Dialog
          onClose={closeResetDialog}
          size="sm"
          icon={<KeyRound className="h-5 w-5" />}
          title="Đặt lại mật khẩu"
          description={resetLink ? resetLink.message : <>Gửi liên kết đặt lại mật khẩu tới <strong className="font-semibold text-slate-900">{resetTarget.email}</strong>. {resetTarget.name} mở liên kết để tự đặt mật khẩu mới; liên kết dùng một lần và có thời hạn.</>}
          footer={resetLink ? (
            <Button onClick={closeResetDialog}>Xong</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeResetDialog}>Hủy</Button>
              <Button loading={resetBusy} onClick={handleSendResetLink}>Gửi liên kết</Button>
            </>
          )}
        >
          {resetLink && (
            <div className="space-y-2">
              <p className="break-all rounded-2xl bg-canvas px-4 py-3 font-mono text-[13px] text-slate-700">{resetLink.url}</p>
              <Button
                variant="secondary"
                block
                icon={resetLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                onClick={() => { navigator.clipboard?.writeText(resetLink.url); setResetLinkCopied(true); }}
              >
                {resetLinkCopied ? "Đã chép liên kết" : "Chép liên kết"}
              </Button>
            </div>
          )}
        </Dialog>
      )}

      {activeSubTab === "users" && (
        <div className="space-y-6">
          <PageHeader
            title="Người dùng"
            subtitle="Tìm kiếm, phân quyền, đặt lại mật khẩu và khóa/mở tài khoản."
            actions={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowAddUserModal(true)}>Tạo người dùng</Button>}
          />

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Segmented<"student" | "teacher" | "admin">
              value={userDirTab}
              onChange={value => { setUserDirTab(value); setUserPage(1); }}
              options={[
                { value: "student", label: "Học viên" },
                { value: "teacher", label: "Giảng viên" },
                { value: "admin", label: "Quản trị" }
              ]}
            />
            <SearchField value={userSearch} onChange={value => { setUserSearch(value); setUserPage(1); }} placeholder="Tìm theo tên, email…" className="md:w-80" />
          </div>

          <div className="space-y-3 md:hidden">
            {paginatedUsers.map(usr => (
              <Card key={usr.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={usr.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{usr.name}</p>
                    <p className="truncate text-[13px] text-slate-500">{usr.email}</p>
                  </div>
                  <Badge tone={usr.isActive ? "success" : "danger"} dot>{usr.isActive ? "Hoạt động" : "Đã khóa"}</Badge>
                </div>
                {userDirTab === "student" && <p className="text-sm text-slate-600">{usr.phone || "Chưa có số điện thoại"}</p>}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <select value={usr.role} onChange={event => handleUpdateUserRole(usr.id, event.target.value as User["role"])} disabled={usr.id === currentUser.id} aria-label="Vai trò" className="mcna-select !h-9 !w-auto text-sm">
                    <option value="student">Học viên</option><option value="teacher">Giảng viên</option><option value="admin">Quản trị viên</option>
                  </select>
                  {usr.id !== currentUser.id && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setResetTarget(usr)}>Mật khẩu</Button>
                      <Button size="sm" variant={usr.isActive ? "danger" : "tinted"} onClick={() => handleToggleUserStatus(usr.id)}>{usr.isActive ? "Khóa" : "Mở khóa"}</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {paginatedUsers.length === 0 && <Card><EmptyState compact icon={<Users className="h-6 w-6" />} title="Không có tài khoản phù hợp" /></Card>}
          </div>

          <div className="mcna-table-wrapper hidden md:block">
            <table className="mcna-table">
              <thead>
                <tr>
                  <SortTh field="name">Họ và tên</SortTh>
                  <SortTh field="email">Email</SortTh>
                  {userDirTab === "student" && <SortTh field="phone">Số điện thoại</SortTh>}
                  <SortTh field="role">Vai trò</SortTh>
                  <SortTh field="isActive">Trạng thái</SortTh>
                  <th className="mcna-th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(usr => (
                  <tr key={usr.id}>
                    <td className="mcna-td">
                      <span className="flex items-center gap-3"><Avatar name={usr.name} size={32} /><span className="font-semibold text-slate-900">{usr.name}</span></span>
                    </td>
                    <td className="mcna-td text-slate-600">{usr.email}</td>
                    {userDirTab === "student" && (
                      <td className="mcna-td">
                        <div className="text-slate-700">{usr.phone || "—"}</div>
                        <div className="text-xs text-slate-500">{usr.schoolEmail || "Chưa cấp email trường"}</div>
                      </td>
                    )}
                    <td className="mcna-td">
                      <select value={usr.role} onChange={e => handleUpdateUserRole(usr.id, e.target.value as User["role"])} disabled={usr.id === currentUser.id} aria-label={`Vai trò của ${usr.name}`} className="mcna-select !h-9 !w-auto text-sm">
                        <option value="student">Học viên</option><option value="teacher">Giảng viên</option><option value="admin">Quản trị viên</option>
                      </select>
                    </td>
                    <td className="mcna-td"><Badge tone={usr.isActive ? "success" : "danger"} dot>{usr.isActive ? "Hoạt động" : "Đã khóa"}</Badge></td>
                    <td className="mcna-td text-right">
                      {usr.id !== currentUser.id ? (
                        <span className="inline-flex items-center gap-2">
                          <Button size="sm" variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setResetTarget(usr)}>Đặt lại mật khẩu</Button>
                          <Button size="sm" variant={usr.isActive ? "danger" : "tinted"} onClick={() => handleToggleUserStatus(usr.id)}>{usr.isActive ? "Khóa" : "Mở khóa"}</Button>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Bạn</span>
                      )}
                    </td>
                  </tr>
                ))}
                {paginatedUsers.length === 0 && (
                  <tr><td colSpan={userDirTab === "student" ? 6 : 5} className="mcna-td py-12 text-center text-slate-500">Không có tài khoản phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <Button size="sm" variant="secondary" onClick={() => setUserPage(p => Math.max(p - 1, 1))} disabled={userPage === 1}>Trước</Button>
              <span className="text-sm text-slate-500">Trang {userPage}/{pageCount}</span>
              <Button size="sm" variant="secondary" onClick={() => setUserPage(p => Math.min(p + 1, pageCount))} disabled={userPage === pageCount}>Sau</Button>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "audit" && (
        <div className="space-y-8">
          <PageHeader
            title="Nhật ký & CRM"
            subtitle="Thao tác quản trị, nhật ký bảo mật và đồng bộ dữ liệu sang CRM."
            actions={
              <>
                <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setShowImportModal(true)}>Nhập CSV</Button>
                <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExportDataStore}>Sao lưu JSON</Button>
              </>
            }
          />

          <Card className="space-y-5 p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Đồng bộ CRM</h2>
                  {crmOutbox?.configured ? <Badge tone="success" dot>Webhook hoạt động</Badge> : <Badge tone="warning" dot>Chưa cấu hình webhook</Badge>}
                </div>
                <p className="text-sm text-slate-500">
                  Hàng đợi gửi sự kiện sang CRM: đăng ký mới, kích hoạt khóa học, học phí.
                  {crmOutbox?.webhookUrl && <span className="ml-1 font-mono text-xs text-slate-500">({crmOutbox.webhookUrl})</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {crmOutbox && crmOutbox.counts.failed > 0 && (
                  <Button size="sm" variant="danger" disabled={syncingCrm} onClick={() => handleSyncCrm(true)}>Thử lại {crmOutbox.counts.failed} lỗi</Button>
                )}
                <Button size="sm" disabled={syncingCrm || loadingCrmOutbox} onClick={() => handleSyncCrm(false)} icon={<RefreshCw className={cx("h-4 w-4", syncingCrm && "animate-spin")} />}>
                  {syncingCrm ? "Đang đồng bộ…" : "Đồng bộ ngay"}
                </Button>
              </div>
            </div>

            {crmSyncMessage && <Callout tone="info" action={<Button size="sm" variant="ghost" onClick={() => setCrmSyncMessage(null)}>Đóng</Button>}>{crmSyncMessage}</Callout>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Tổng sự kiện", value: crmOutbox?.counts.total, tone: "text-slate-900" },
                { label: "Đã gửi", value: crmOutbox?.counts.sent, tone: "text-emerald-600" },
                { label: "Đang chờ", value: crmOutbox?.counts.pending, tone: "text-amber-600" },
                { label: "Thất bại", value: crmOutbox?.counts.failed, tone: "text-rose-600" }
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-canvas p-4">
                  <p className="text-[13px] text-slate-500">{item.label}</p>
                  <p className={cx("mt-1 font-display text-2xl font-bold", item.tone)}>{item.value ?? "—"}</p>
                </div>
              ))}
            </div>

            {crmOutbox?.recentEvents && crmOutbox.recentEvents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Sự kiện gần đây</h3>
                  <button type="button" onClick={loadCrmOutbox} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Làm mới</button>
                </div>
                <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-2xl ring-1 ring-slate-200/70">
                  {crmOutbox.recentEvents.map(evt => (
                    <li key={evt.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-mono text-[13px] font-semibold text-slate-800">{evt.eventType} <span className="font-normal text-slate-500">#{evt.id.slice(0, 14)}</span></p>
                        {evt.lastError && <p className="line-clamp-1 break-all text-xs text-rose-600">Lỗi: {evt.lastError}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-slate-500">{new Date(evt.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                        <Badge tone={evt.status === "sent" ? "success" : evt.status === "pending" ? "warning" : "danger"}>
                          {evt.status === "sent" ? "Đã gửi" : evt.status === "pending" ? `Chờ (${evt.attempts})` : `Lỗi (${evt.attempts})`}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <section className="space-y-3">
            <SectionTitle title="Nhật ký hệ thống" description={`${filteredAuditLogs.length} bản ghi`} />
            <div className="flex flex-col gap-3 md:flex-row">
              <SearchField value={auditSearch} onChange={setAuditSearch} placeholder="Tìm theo hành động, người dùng, nội dung…" className="flex-1" />
              <select value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)} aria-label="Lọc theo hành động" className="mcna-select md:!w-64 !rounded-full">
                <option value="all">Tất cả hành động</option>
                {Array.from(new Set((store?.auditLogs || []).map(l => l.action))).map(act => <option key={act} value={act}>{act}</option>)}
              </select>
            </div>
            <Card as="ul" className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {filteredAuditLogs.map((log, i) => (
                <li key={log.id || i} className="px-5 py-3.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-semibold text-slate-900">{log.action}</span>
                    <time className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("vi-VN")}</time>
                  </div>
                  <p className="mt-1 break-words text-slate-700">{log.detail}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">Người thực hiện: {log.userId} · Đối tượng: {log.target}</p>
                </li>
              ))}
              {filteredAuditLogs.length === 0 && <li className="py-12 text-center text-sm text-slate-500">Không có bản ghi phù hợp.</li>}
            </Card>
          </section>
        </div>
      )}

      {/* USER REGISTRATION POPUP MODAL */}
      {showAddUserModal && (
        <ModalPortal>
        <div className="mcna-overlay">
          <div className="mcna-dialog sm:max-w-sm">
            <button 
              onClick={() => setShowAddUserModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-5 flex items-center gap-2.5 pr-10 text-lg font-bold text-slate-900">
              Khởi tạo người dùng hệ thống mới
            </h3>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="mcna-label">Họ và Tên</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Địa chỉ Email</label>
                <input
                  type="email"
                  required
                  placeholder="Ví dụ: an.nguyen@gmail.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Mật khẩu ban đầu</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="mcna-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="mcna-label">Phân hệ Quyền</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="mcna-select w-full"
                >
                  <option value="student">Học Viên (Student)</option>
                  <option value="teacher">Giảng Viên (Teacher)</option>
                  <option value="admin">Quản Trị Viên (Admin)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="mcna-btn-ghost"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="mcna-btn-primary"
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
        <div className="mcna-overlay">
          <div className="mcna-dialog sm:max-w-lg">
            <button 
              onClick={() => { setShowImportModal(false); setImportMessage(null); }}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-5 flex items-center gap-2.5 pr-10 text-lg font-bold text-slate-900">
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
                  placeholder="name, email, role&#10;Nguyễn Văn An, an.nguyen@gmail.com, student&#10;Trần Thị Bình, binh.tran@gmail.com, teacher"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="mcna-textarea w-full font-mono h-36 mt-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportMessage(null); }}
                  className="mcna-btn-ghost"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="mcna-btn-primary"
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
