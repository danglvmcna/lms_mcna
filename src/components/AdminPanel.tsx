import React, { useState, useEffect } from "react";
import { 
  Users, 
  BookOpen, 
  ShoppingBag,
  GraduationCap, 
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
  FileText,
  HelpCircle,
  Bell,
  Eye
} from "lucide-react";
import { User } from "../types";
import { useApiStore } from "../hooks/apiHooks";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { api } from "../api";

import AdminOrdersManager from "./admin/AdminOrdersManager";
import ModalPortal from "./ModalPortal";
import NotificationInbox from "./NotificationInbox";
import CourseSectionManager from "./CourseSectionManager";

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

  // Navigation tab states
  // Groupings: ACADEMIC, STUDENTS, LEARNING, REPORTS
  const [activeSubTab, setActiveSubTab] = useState<
    | "orders"
    | "course_section_mgmt"
    | "approval"
    | "users"
    | "audit"
    | "notifications"
  >("orders");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSubTab]);

  useEffect(() => {
    const allowed = ["orders", "course_section_mgmt", "approval", "users", "audit", "notifications"];
    if (!allowed.includes(activeSubTab)) {
      setActiveSubTab("orders");
    }
  }, [currentUser.role]);

  // Existing User modals states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"student" | "teacher" | "admin">("student");
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useUnsavedChangesWarning(
    showAddUserModal && Boolean(newUserEmail.trim() || newUserName.trim() || newUserPassword.trim())
  );

  // Course rejection states
  const [rejectingCourseId, setRejectingCourseId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Search & Filter flags for users registry
  const [userSearch, setUserSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
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
  const [approvalSearch, setApprovalSearch] = useState("");
  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [operationsSummary, setOperationsSummary] = useState<any | null>(null);



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

  // Approve Course selection
  const handleApproveCourse = (courseId: string) => {
    api.publishCourse(courseId)
      .then(() => {
        onRefreshData();
        triggerToast("Đã phê duyệt và phát hành khóa học.");
      })
      .catch((err: Error) => triggerToast(err.message || "Không thể phê duyệt khóa học."));
  };

  const handleStartRejectCourse = (courseId: string) => {
    setRejectingCourseId(courseId);
    setRejectReason("");
  };

  const handleConfirmRejectCourse = () => {
    if (!rejectingCourseId) return;
    if (!rejectReason.trim()) {
      triggerToast("Vui lòng ghi rõ lý do trả về học phần.");
      return;
    }

    api.rejectCourse(rejectingCourseId, rejectReason)
      .then(() => {
        setRejectingCourseId(null);
        onRefreshData();
        triggerToast("Học phần lớp học được trả về để điều hành giảng viên bổ sung.");
      })
      .catch((err: Error) => triggerToast(err.message || "Không thể từ chối khóa học."));
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

  // Search filter listings
  const filteredUsers = store.users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && u.isActive) || 
      (filterStatus === "inactive" && !u.isActive);
    const matchesDirectory = filterRole !== "all" ? true : (
      userDirTab === "student" ? u.role === "student" :
      userDirTab === "teacher" ? u.role === "teacher" :
      u.role === "admin"
    );

    return matchesSearch && matchesRole && matchesStatus && matchesDirectory;
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
  const pendingCourses = store.courses.filter(c => c.status === "pending");

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-transparent">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Cổng Điều hành & Hồ sơ Học vụ</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Phân quyền giám sát cấu trúc khóa học, chuyên cần học sinh và trạng thái thanh toán học phí.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button 
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Upload className="h-4 w-4 text-slate-500" /> Nhập CSV Users
          </button>
          <button 
            onClick={handleExportDataStore}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4 text-slate-500" /> Sao lưu JSON
          </button>
          <button 
            onClick={() => setShowAddUserModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Tạo người dùng
          </button>
        </div>
      </div>

      {/* Grid counters stat cards metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Nhân khẩu học (Tổng tài khoản)</p>
          <h3 className="text-2xl md:text-3xl font-bold font-mono text-slate-900 mt-1">{totalUsersCount}</h3>
        </div>
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Khóa học môn giảng dạy</p>
          <h3 className="text-2xl md:text-3xl font-bold font-mono text-slate-900 mt-1">{totalCoursesCount}</h3>
        </div>
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Đăng ký lớp học niên khóa</p>
          <h3 className="text-2xl md:text-3xl font-bold font-mono text-slate-900 mt-1">{totalEnrollmentsCount}</h3>
        </div>
      </div>

      {operationsSummary && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-800">Bảng điều hành hôm nay</p><p className="mt-1 text-[10px] text-slate-500">Các việc cần xử lý được tổng hợp từ LMS và CRM.</p></div><button type="button" onClick={() => api.getOperationsSummary().then(setOperationsSummary).catch(() => undefined)} className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50">Làm mới</button></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ["Ghi danh chờ xử lý", operationsSummary.pendingEnrollments, "text-amber-700"],
              ["Bài chưa chấm", operationsSummary.ungradedSubmissions, "text-rose-700"],
              ["Khóa chờ duyệt", operationsSummary.pendingCourses, "text-indigo-700"],
              ["CRM giao thất bại", operationsSummary.crmFailures, "text-slate-700"]
            ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white/90 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold font-mono ${color}`}>{value}</p></div>)}
          </div>
        </div>
      )}

      {/* Main Two-Column Layout split sidebar list vs viewports */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column navbar structured sections */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 text-xs space-y-3 shadow-xs">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block px-2.5">
                ĐIỀU HÀNH & BÁN HÀNG
              </span>
              <button
                onClick={() => setActiveSubTab("orders")}
                className={`w-full text-left py-2.5 px-3 rounded-xl transition font-medium flex items-center justify-between cursor-pointer ${
                  activeSubTab === "orders" ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100/80 shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2"><ShoppingBag className={`h-4 w-4 ${activeSubTab === "orders" ? "text-emerald-600" : "text-slate-400"}`} /> Đơn hàng & Ghi danh</span>
                {(() => {
                  const pendingCount = (store.enrollments || []).filter((e: any) => e.status === "pending_payment" || e.status === "pending").length;
                  if (pendingCount === 0) return null;
                  return (
                    <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-1.5 py-0.5 rounded-md font-mono border border-amber-200/60">
                      {pendingCount}
                    </span>
                  );
                })()}
              </button>
              <button
                onClick={() => setActiveSubTab("course_section_mgmt")}
                className={`w-full text-left py-2.5 px-3 rounded-xl transition font-medium flex items-center justify-between cursor-pointer ${
                  activeSubTab === "course_section_mgmt" ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2"><BookOpen className={`h-4 w-4 ${activeSubTab === "course_section_mgmt" ? "text-indigo-600" : "text-slate-400"}`} /> Khóa học & Lớp học</span>
              </button>
              <button
                onClick={() => setActiveSubTab("approval")}
                className={`w-full text-left py-2.5 px-3 rounded-xl transition font-medium flex items-center justify-between cursor-pointer ${
                  activeSubTab === "approval" ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2"><GraduationCap className={`h-4 w-4 ${activeSubTab === "approval" ? "text-indigo-600" : "text-slate-400"}`} /> Duyệt khóa học</span>
                {pendingCourses.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-1.5 py-0.5 rounded-md font-mono border border-amber-200/60">
                    {pendingCourses.length}
                  </span>
                )}
              </button>
            </div>

            <div className="space-y-1 border-t border-slate-100 pt-2.5">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block px-2.5">
                HỆ THỐNG & TÀI KHOẢN
              </span>
              <button
                onClick={() => setActiveSubTab("users")}
                className={`w-full text-left py-2.5 px-3 rounded-xl transition font-medium flex items-center justify-between cursor-pointer ${
                  activeSubTab === "users" ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2"><Users className={`h-4 w-4 ${activeSubTab === "users" ? "text-indigo-600" : "text-slate-400"}`} /> Quản lý Người dùng</span>
              </button>
              <button
                onClick={() => setActiveSubTab("audit")}
                className={`w-full text-left py-2.5 px-3 rounded-xl transition font-medium flex items-center justify-between cursor-pointer ${
                  activeSubTab === "audit" ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2"><Database className={`h-4 w-4 ${activeSubTab === "audit" ? "text-indigo-600" : "text-slate-400"}`} /> Nhật ký hệ thống</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Main viewport area container */}
        <div className="flex-1 min-w-0 w-full">
          
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
            />
          )}

          {activeSubTab === "approval" && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900">Xử lý Phê duyệt Mở Môn học & Đề cương</h3>
                <p className="text-xs text-slate-500">Phê duyệt để đưa bài khóa học của Giáo viên chuyên môn lên Hệ thống tuyển sinh đào tạo.</p>
              </div>

              {/* Reactive filter inputs */}
              <div className="flex gap-3 bg-white border border-slate-200/80 p-2.5 rounded-xl text-xs max-w-md shadow-xs">
                <input
                  type="text"
                  placeholder="Tìm kiếm khóa học chờ phê duyệt..."
                  value={approvalSearch}
                  onChange={(e) => setApprovalSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none font-sans"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                {pendingCourses.filter(c => {
                  return !approvalSearch ||
                    c.title.toLowerCase().includes(approvalSearch.toLowerCase()) ||
                    c.category.toLowerCase().includes(approvalSearch.toLowerCase()) ||
                    c.description.toLowerCase().includes(approvalSearch.toLowerCase());
                }).map(course => {
                  const teacherUser = store.users.find(u => u.id === course.teacherId) || { name: "Giảng viên" };
                  return (
                    <div key={course.id} className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col justify-between shadow-xs hover:border-slate-300 transition duration-150">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-mono text-indigo-600 font-bold uppercase">{course.category}</span>
                          <span className="text-slate-400">{teacherUser.name}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{course.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{course.description}</p>
                      </div>

                      <div className="flex gap-2 justify-between items-center text-xs pt-4 border-t border-slate-100 mt-4">
                        <button
                          onClick={() => setCourseDetailId(course.id)}
                          className="mcna-badge-primary inline-flex items-center gap-1.5 cursor-pointer hover:bg-indigo-100 transition px-3 py-1.5 text-xs font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Xem chi tiết
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartRejectCourse(course.id)}
                            className="px-3.5 py-1.5 text-red-600 hover:bg-red-50 rounded-xl transition text-[11px] font-semibold cursor-pointer"
                          >
                            Trả về yêu cầu
                          </button>
                          <button
                            onClick={() => handleApproveCourse(course.id)}
                            className="px-4 py-1.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-[11px] cursor-pointer shadow-xs"
                          >
                            Phê duyệt lập tức
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {pendingCourses.filter(c => {
                  return !approvalSearch ||
                    c.title.toLowerCase().includes(approvalSearch.toLowerCase()) ||
                    c.category.toLowerCase().includes(approvalSearch.toLowerCase()) ||
                    c.description.toLowerCase().includes(approvalSearch.toLowerCase());
                }).length === 0 && (
                  <div className="col-span-2 py-16 text-center text-slate-400 text-xs">
                    {pendingCourses.length === 0 ? "Không có khóa học nào đang chờ phê duyệt." : "Không tìm thấy khóa học nào phù hợp với bộ lọc."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EXISTING USER ACCESS CONTROLS REGISTRY */}
          {activeSubTab === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thư mục Người dùng & Quản lý Truy cập</h3>
                  <p className="text-xs text-slate-500">Giám sát tài khoản phân hệ trực quan.</p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Tìm theo tên, email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                    className="px-3 py-1.5 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
                  />

                  <select
                    value={filterRole}
                    onChange={(e) => { setFilterRole(e.target.value); setUserPage(1); }}
                    className="p-1.5 px-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-sans"
                  >
                    <option value="all">Mọi vai trò</option>
                    <option value="student">Học Viên</option>
                    <option value="teacher">Giảng Viên</option>
                    <option value="admin">Quản Trị Viên</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "student", label: "Học Viên" },
                  { id: "teacher", label: "Giảng Viên" },
                  { id: "admin", label: "Quản Trị Viên" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setUserDirTab(tab.id as "student" | "teacher" | "admin"); setUserPage(1); }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${userDirTab === tab.id ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
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
                <h3 className="text-base font-bold text-slate-900">Nhật ký Hệ thống & Access Audits (Infrastructure Logs)</h3>
                <p className="text-xs text-slate-500">Nhật ký theo dõi các bút toán an ninh, sửa đổi kết cấu điểm số, học bạ chính xác theo thời gian thực.</p>
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

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] leading-relaxed max-h-96 overflow-y-auto space-y-2 text-slate-200 shadow-inner">
                {((store?.auditLogs || []).filter(log => {
                  const matchesSearch = !auditSearch || 
                    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    log.userId.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    log.target.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    log.detail.toLowerCase().includes(auditSearch.toLowerCase());
                  const matchesAction = auditFilterAction === "all" || log.action === auditFilterAction;
                  return matchesSearch && matchesAction;
                })).map((log, i) => (
                  <div key={log.id || i} className="border-b border-slate-800 pb-2">
                    <span className="text-indigo-400">[{log.createdAt.slice(11, 19)}]</span>{" "}
                    <span className="text-cyan-400 font-bold">{log.action.toUpperCase()}</span>{" "}
                    <span className="text-slate-400">bởi:</span> <span className="text-emerald-400 font-bold">{log.userId}</span>{" "}
                    <span className="text-slate-400">đối tượng:</span> <span className="text-amber-400">{log.target}</span> --{" "}
                    <span className="text-slate-200">{log.detail}</span>
                  </div>
                ))}
                {((store?.auditLogs || []).filter(log => {
                  const matchesSearch = !auditSearch || 
                    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    log.userId.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    log.target.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    log.detail.toLowerCase().includes(auditSearch.toLowerCase());
                  const matchesAction = auditFilterAction === "all" || log.action === auditFilterAction;
                  return matchesSearch && matchesAction;
                })).length === 0 && (
                  <div className="text-center text-slate-500 italic py-6">Không tìm thấy bản ghi nhật ký phù hợp.</div>
                )}
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

      {/* REJECT MODAL CHAT BOX */}
      {rejectingCourseId && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-150 text-slate-900">
            <button 
              onClick={() => setRejectingCourseId(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-2 border-b border-slate-100 pb-3">
              Trả lại hồ sơ đăng ký giảng dạy
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); handleConfirmRejectCourse(); }} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Góp ý lý do trả về đính kèm:</label>
                <textarea
                  required
                  placeholder="Ví dụ: Đề cương chương 3 chưa đính kèm bài giảng lý thuyết..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-500/20 h-24 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingCourseId(null)}
                  className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Xác nhận trả về
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
      {/* Premium Course Details consultation modal */}
      {courseDetailId && (() => {
        const course = store.courses.find(c => c.id === courseDetailId);
        if (!course) return null;
        const teacher = store.users.find(u => u.id === course.teacherId) || { name: "Chưa phân công" };
        const lessons = store.lessons.filter(l => l.courseId === course.id).sort((a,b) => a.order - b.order);
        const quizzes = store.quizzes.filter(q => q.courseId === course.id);
        const assignments = store.assignments.filter(a => a.courseId === course.id);
        const formatVND = (num: number) => {
          return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
        };
        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-150 text-slate-900 font-sans max-h-[85vh] overflow-y-auto flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                      {course.category}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">{course.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">Giảng viên: <strong className="text-slate-800 font-semibold">{teacher.name}</strong></p>
                  </div>
                  <button 
                    onClick={() => setCourseDetailId(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80 font-sans">
                  <div>
                    <span className="text-slate-500 block font-medium">Học phí:</span>
                    <strong className="text-sm font-mono text-emerald-700 font-bold">{course.price ? formatVND(course.price) : "Miễn phí"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Cấp trình độ:</span>
                    <strong className="text-slate-900 font-semibold capitalize">{course.level || "Cơ bản"}</strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Mô tả khóa đào tạo:</span>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80 font-sans">{course.description}</p>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-1.5 font-sans">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" /> Khung chương trình ({lessons.length} bài học, {quizzes.length} bài thi, {assignments.length} tự luận)
                  </span>
                  
                  {lessons.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-sans">
                      {lessons.map((lesson, idx) => (
                        <div key={lesson.id} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-800">Bài {idx + 1}: {lesson.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{lesson.duration || "15 phút"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic font-sans">Chưa tải giáo trình bài giảng cho lớp học này.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-5 flex justify-end">
                <button
                  onClick={() => setCourseDetailId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs cursor-pointer"
                >
                  Đóng thông tin
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}
    </div>
  );
}
