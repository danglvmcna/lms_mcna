import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Mail, MailCheck, MailWarning, Search, Upload, Users, X } from "lucide-react";
import { api } from "../../api";
import { formatDateVi, formatScheduleSummary } from "../../scheduleText";
import { Course, CourseRegistration, CourseSection, Enrollment, Transaction, User } from "../../types";
import PaidImportModal from "./PaidImportModal";

interface ClassPlacementManagerProps {
  store: any;
  currentUser: User;
  onRefreshData: () => void | Promise<void>;
  triggerToast: (msg: string) => void;
}

type StatusFilter = "pending" | "placed" | "pending_payment" | "all";

type PlacementRow = Enrollment & {
  student?: User;
  course?: Course;
  registration?: CourseRegistration;
  currentSection?: CourseSection;
  requestedSection?: CourseSection;
  transaction?: Transaction;
};

const PAGE_SIZE = 20;

const formatMoney = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;

/**
 * Class manager's main screen in the direct-sale model: the learners who paid (from the CRM list),
 * who is still waiting for a class, and placing them into a class code. Placement sends the class email.
 */
export default function ClassPlacementManager({ store, onRefreshData, triggerToast }: ClassPlacementManagerProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [courseFilter, setCourseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetSectionId, setTargetSectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [placementErrors, setPlacementErrors] = useState<string[]>([]);

  const enrollments: Enrollment[] = store.enrollments || [];
  const users: User[] = store.users || [];
  const courses: Course[] = store.courses || [];
  const sections: CourseSection[] = store.courseSections || [];
  const transactions: Transaction[] = store.transactions || [];
  const registrations: CourseRegistration[] = store.courseRegistrations || [];

  const sectionOccupancy = useMemo(() => {
    const occupancy = new Map<string, number>();
    registrations.forEach(registration => {
      if (registration.status === "registered") occupancy.set(registration.sectionId, (occupancy.get(registration.sectionId) || 0) + 1);
    });
    return occupancy;
  }, [registrations]);

  const rows: PlacementRow[] = useMemo(() => {
    const userById = new Map(users.map(user => [user.id, user]));
    const courseById = new Map(courses.map(course => [course.id, course]));
    const sectionById = new Map(sections.map(section => [section.id, section]));
    return enrollments
      .filter(enrollment => enrollment.status !== "cancelled")
      .map(enrollment => {
        const registration = registrations.find(item =>
          item.studentId === enrollment.studentId && item.status === "registered" && sectionById.get(item.sectionId)?.courseId === enrollment.courseId);
        const studentTransactions = transactions.filter(item => item.studentId === enrollment.studentId && item.courseId === enrollment.courseId);
        return {
          ...enrollment,
          student: userById.get(enrollment.studentId),
          course: courseById.get(enrollment.courseId),
          registration,
          currentSection: registration ? sectionById.get(registration.sectionId) : undefined,
          requestedSection: enrollment.requestedSectionId ? sectionById.get(enrollment.requestedSectionId) : undefined,
          transaction: studentTransactions.find(item => item.status === "approved") || studentTransactions.find(item => item.status === "pending")
        };
      })
      .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());
  }, [enrollments, users, courses, sections, transactions, registrations]);

  // Paid and waiting for a class: "pending", plus active enrollments that never got a seat.
  const isWaiting = (row: PlacementRow) => row.status === "pending" || (row.status === "active" && !row.currentSection);
  const isPlaced = (row: PlacementRow) => Boolean(row.currentSection) && (row.status === "active" || row.status === "completed");

  const counts = useMemo(() => ({
    pending: rows.filter(isWaiting).length,
    placed: rows.filter(isPlaced).length,
    pending_payment: rows.filter(row => row.status === "pending_payment").length,
    all: rows.length
  }), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      if (statusFilter === "pending" && !isWaiting(row)) return false;
      if (statusFilter === "placed" && !isPlaced(row)) return false;
      if (statusFilter === "pending_payment" && row.status !== "pending_payment") return false;
      if (courseFilter !== "all" && row.courseId !== courseFilter) return false;
      if (!query) return true;
      return [row.student?.name, row.student?.email, row.student?.phone, row.course?.title, row.currentSection?.sectionCode]
        .some(value => String(value || "").toLowerCase().includes(query));
    });
  }, [rows, statusFilter, courseFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, courseFilter, search]);

  // Selections that left the list (after a refresh or a filter change) are dropped.
  useEffect(() => {
    const visibleIds = new Set(filtered.map(row => row.id));
    setSelected(current => {
      const next = new Set([...current].filter(id => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const canSelect = (row: PlacementRow) => row.status === "pending" || row.status === "active";
  const selectedRows = rows.filter(row => selected.has(row.id));
  const selectedCourseIds = Array.from(new Set(selectedRows.map(row => row.courseId)));
  const selectedCourse = selectedCourseIds.length === 1 ? courses.find(course => course.id === selectedCourseIds[0]) : undefined;
  const targetSections = selectedCourse
    ? sections.filter(section => section.courseId === selectedCourse.id && section.status !== "cancelled")
        .sort((a, b) => String(a.openingDate || "").localeCompare(String(b.openingDate || "")))
    : [];
  const targetSection = targetSections.find(section => section.id === targetSectionId);

  useEffect(() => {
    if (!targetSections.some(section => section.id === targetSectionId)) {
      // Pre-select the class the learners asked for, when they all asked for the same one.
      const requested = Array.from(new Set(selectedRows.map(row => row.requestedSectionId).filter(Boolean)));
      setTargetSectionId(requested.length === 1 && targetSections.some(section => section.id === requested[0]) ? String(requested[0]) : "");
    }
  }, [selectedCourse?.id, selected.size]);

  const toggleRow = (row: PlacementRow) => {
    setPlacementErrors([]);
    setSelected(current => {
      const next = new Set(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  };

  const selectablePageRows = pageRows.filter(canSelect);
  const allPageSelected = selectablePageRows.length > 0 && selectablePageRows.every(row => selected.has(row.id));
  const togglePage = () => {
    setPlacementErrors([]);
    setSelected(current => {
      const next = new Set(current);
      selectablePageRows.forEach(row => (allPageSelected ? next.delete(row.id) : next.add(row.id)));
      return next;
    });
  };

  const seatsLeft = (section: CourseSection) => Math.max(0, section.maxStudents - (sectionOccupancy.get(section.id) || 0));
  // Selected learners already seated in a class do not need a new seat there.
  const newSeatsNeeded = (section: CourseSection) => selectedRows.filter(row => row.currentSection?.id !== section.id).length;

  const handlePlace = async () => {
    if (!targetSection || selectedRows.length === 0) return;
    setBusy(true);
    setPlacementErrors([]);
    try {
      const result = await api.bulkPlaceEnrollments(selectedRows.map(row => ({ enrollmentId: row.id, sectionId: targetSection.id })));
      const parts = [`Đã xếp ${result.placed} học viên vào lớp ${targetSection.sectionCode}.`];
      if (result.unchanged) parts.push(`${result.unchanged} học viên đã ở sẵn lớp này.`);
      if (result.emails.sent || result.emails.failed) parts.push(`Email xếp lớp: ${result.emails.sent} đã gửi${result.emails.failed ? `, ${result.emails.failed} lỗi` : ""}.`);
      if (result.emails.mock) parts.push(`${result.emails.mock} email xếp lớp CHƯA được gửi vì máy chủ chưa cấu hình SMTP (chỉ ghi vào log thử nghiệm).`);
      triggerToast(parts.join(" "));
      setSelected(new Set());
      await onRefreshData();
    } catch (err: any) {
      const details: string[] = (err.payload?.errors || []).map((item: any) => {
        const row = selectedRows[item.index];
        return `${row?.student?.name || row?.student?.email || `Dòng ${item.index + 1}`}: ${item.error}`;
      });
      setPlacementErrors(details.length ? details : [err.message || "Không xếp được lớp."]);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async (row: PlacementRow) => {
    if (!row.currentSection) return;
    setBusy(true);
    try {
      const result = await api.resendPlacementEmail([{ studentId: row.studentId, sectionId: row.currentSection.id }]);
      const notice = result.notices[0];
      triggerToast(
        notice?.status === "sent" ? `Đã gửi lại email xếp lớp tới ${notice.email}.`
          : notice?.status === "mock" ? "Email CHƯA được gửi: máy chủ chưa cấu hình SMTP (chỉ ghi vào log thử nghiệm)."
          : `Không gửi được email: ${notice?.reason || "lỗi máy chủ thư"}.`
      );
      await onRefreshData();
    } catch (err: any) {
      triggerToast(err.message || "Không gửi được email xếp lớp.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPayment = async (row: PlacementRow) => {
    if (!row.transaction || row.transaction.status !== "pending") {
      triggerToast("Không tìm thấy giao dịch đang chờ của học viên này.");
      return;
    }
    if (!window.confirm(`Xác nhận ${row.student?.name || "học viên"} đã thanh toán ${formatMoney(row.transaction.amount)} cho khóa "${row.course?.title}"?`)) return;
    setBusy(true);
    try {
      await api.reviewTransaction(row.transaction.id, { status: "approved", notes: "Xác nhận thủ công tại màn Xếp lớp." });
      triggerToast("Đã xác nhận thanh toán. Học viên chuyển sang danh sách chờ xếp lớp.");
      await onRefreshData();
    } catch (err: any) {
      triggerToast(err.message || "Không xác nhận được thanh toán.");
    } finally {
      setBusy(false);
    }
  };

  const statusTabs: Array<{ id: StatusFilter; label: string; count: number; hidden?: boolean }> = [
    { id: "pending", label: "Chờ xếp lớp", count: counts.pending },
    { id: "placed", label: "Đã xếp lớp", count: counts.placed },
    { id: "pending_payment", label: "Chờ thanh toán", count: counts.pending_payment, hidden: counts.pending_payment === 0 },
    { id: "all", label: "Tất cả", count: counts.all }
  ];

  const renderEmailStatus = (row: PlacementRow) => {
    if (!row.currentSection) return null;
    const status = row.registration?.placementEmailStatus;
    const time = row.registration?.placementEmailAt ? new Date(row.registration.placementEmailAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    if (status === "sent") return <span className="inline-flex items-center gap-1 text-emerald-700"><MailCheck className="h-3.5 w-3.5" /> Email đã gửi {time}</span>;
    if (status === "mock") return <span className="inline-flex items-center gap-1 text-amber-700" title="Máy chủ chưa cấu hình SMTP: email chỉ được ghi vào log thử nghiệm."><Mail className="h-3.5 w-3.5" /> Email chưa gửi (chưa có SMTP) {time}</span>;
    if (status === "failed") return <span className="inline-flex items-center gap-1 text-rose-700"><MailWarning className="h-3.5 w-3.5" /> Email gửi lỗi {time}</span>;
    return <span className="text-slate-400">Chưa gửi email xếp lớp</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Học viên & Xếp lớp</h3>
          <p className="text-sm text-slate-500 mt-1">Nhập danh sách khách đã thanh toán, rồi chọn học viên và gán vào mã lớp. Học viên nhận email thông tin lớp ngay khi được xếp.</p>
        </div>
        <button type="button" onClick={() => setShowImport(true)} className="mcna-btn-primary !h-9 !px-3.5 !text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0">
          <Upload className="h-4 w-4" /> Nhập danh sách đã thanh toán
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.filter(tab => !tab.hidden).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${statusFilter === tab.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {tab.label} <span className={`ml-1 font-mono ${statusFilter === tab.id ? "text-indigo-100" : "text-slate-400"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên, email, SĐT, mã lớp..." className="mcna-input mcna-input-search !pl-9 w-full" />
        </div>
        <select value={courseFilter} onChange={event => setCourseFilter(event.target.value)} className="mcna-select text-sm sm:max-w-xs" aria-label="Lọc theo khóa học">
          <option value="all">Tất cả khóa học</option>
          {courses.filter(course => rows.some(row => row.courseId === course.id)).sort((a, b) => a.title.localeCompare(b.title, "vi")).map(course => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
      </div>

      {selectedRows.length > 0 && (
        <div className="sticky top-16 z-10 rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <span className="text-sm font-semibold text-indigo-900 shrink-0">Đã chọn {selectedRows.length} học viên</span>
            {!selectedCourse ? (
              <span className="text-sm text-amber-800 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Hãy chọn học viên của cùng một khóa học để xếp vào một lớp.</span>
            ) : targetSections.length === 0 ? (
              <span className="text-sm text-amber-800 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Khóa "{selectedCourse.title}" chưa có lớp. Tạo lớp ở mục Khóa học & Lớp học.</span>
            ) : (
              <>
                <select value={targetSectionId} onChange={event => { setTargetSectionId(event.target.value); setPlacementErrors([]); }} className="mcna-select text-sm flex-1 min-w-0" aria-label="Chọn lớp">
                  <option value="">Chọn mã lớp của khóa {selectedCourse.title}</option>
                  {targetSections.map(section => (
                    <option key={section.id} value={section.id} disabled={seatsLeft(section) < newSeatsNeeded(section)}>
                      {section.sectionCode} · còn {seatsLeft(section)}/{section.maxStudents} chỗ{section.openingDate ? ` · khai giảng ${formatDateVi(section.openingDate)}` : ""}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={handlePlace} disabled={busy || !targetSection} className="mcna-btn-primary !h-9 !px-4 !text-xs inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0">
                  <Check className="h-4 w-4" /> {busy ? "Đang xếp lớp..." : "Xếp lớp & gửi email"}
                </button>
              </>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer shrink-0 inline-flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Bỏ chọn
            </button>
          </div>
          {targetSection && (
            <p className="text-xs text-indigo-900/80">
              Lớp {targetSection.sectionCode}: {formatScheduleSummary(targetSection.schedule) || "chưa có lịch học"}
              {users.find(user => user.id === targetSection.teacherId) ? ` · GV ${users.find(user => user.id === targetSection.teacherId)!.name}` : ""}
              {targetSection.groupChatUrl ? " · đã có link Zalo" : " · chưa có link Zalo (email sẽ ghi là gửi sau)"}
            </p>
          )}
          {placementErrors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 space-y-1">
              <div className="font-semibold">Chưa xếp được lớp, không có học viên nào bị thay đổi:</div>
              {placementErrors.slice(0, 6).map((message, index) => <div key={index}>{message}</div>)}
              {placementErrors.length > 6 && <div>... và {placementErrors.length - 6} lỗi khác.</div>}
            </div>
          )}
        </div>
      )}

      <div className="mcna-table-wrapper overflow-x-auto">
        <table className="mcna-table min-w-[820px]">
          <thead className="mcna-thead">
            <tr>
              <th className="mcna-th pl-4 w-10">
                <input type="checkbox" checked={allPageSelected} onChange={togglePage} disabled={selectablePageRows.length === 0} aria-label="Chọn tất cả trong trang" className="h-4 w-4 accent-indigo-600" />
              </th>
              <th className="mcna-th min-w-[190px]">Học viên</th>
              <th className="mcna-th min-w-[170px]">Khóa học</th>
              <th className="mcna-th min-w-[150px]">Lớp & email xếp lớp</th>
              <th className="mcna-th text-right whitespace-nowrap">Đã thanh toán</th>
              <th className="mcna-th text-right pr-4 whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="max-w-sm mx-auto space-y-2">
                    <Users className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-medium text-slate-600">
                      {rows.length === 0 ? "Chưa có học viên nào." : statusFilter === "pending" ? "Không còn học viên nào chờ xếp lớp." : "Không có học viên phù hợp bộ lọc."}
                    </p>
                    {rows.length === 0 && <p className="text-xs text-slate-400">Bấm "Nhập danh sách đã thanh toán" để tạo tài khoản học viên từ bảng CRM.</p>}
                  </div>
                </td>
              </tr>
            ) : pageRows.map(row => (
              <tr key={row.id} className={`transition-colors ${selected.has(row.id) ? "bg-indigo-50/60" : "hover:bg-slate-50/70"}`}>
                <td className="mcna-td pl-4">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row)} disabled={!canSelect(row)} aria-label={`Chọn ${row.student?.name || row.id}`} className="h-4 w-4 accent-indigo-600" />
                </td>
                <td className="mcna-td">
                  <div className="font-semibold text-slate-900 text-sm">{row.student?.name || "Chưa đặt tên"}</div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-2">
                    <span className="font-mono">{row.student?.email || "—"}</span>
                    {row.student?.phone && <span className="font-mono">{row.student.phone}</span>}
                  </div>
                  {row.student?.mustChangePassword && <div className="text-[11px] text-amber-700 mt-0.5">Chưa đăng nhập lần đầu</div>}
                </td>
                <td className="mcna-td">
                  <span className="text-sm text-slate-800 line-clamp-2">{row.course?.title || "Khóa học chưa xác định"}</span>
                </td>
                <td className="mcna-td">
                  {row.currentSection ? (
                    <div>
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">{row.currentSection.sectionCode}</span>
                      {row.currentSection.openingDate && <div className="text-[11px] text-slate-500 mt-1">Khai giảng {formatDateVi(row.currentSection.openingDate)}</div>}
                      <div className="text-[11px] mt-0.5">{renderEmailStatus(row)}</div>
                    </div>
                  ) : row.status === "pending_payment" ? (
                    <span className="text-xs text-amber-700">Chờ thanh toán</span>
                  ) : (
                    <div>
                      <span className="text-xs font-semibold text-sky-700">Chờ xếp lớp</span>
                      {row.requestedSection && <div className="text-[11px] text-slate-500 mt-0.5">Lớp mong muốn: {row.requestedSection.sectionCode}</div>}
                    </div>
                  )}
                </td>
                <td className="mcna-td text-right whitespace-nowrap">
                  {row.transaction ? (
                    <div title={row.transaction.notes || row.transaction.paymentMethod}>
                      <span className={`font-mono text-sm font-semibold ${row.transaction.status === "approved" ? "text-slate-900" : "text-amber-700"}`}>{formatMoney(row.transaction.amount)}</span>
                      <div className="text-[11px] text-slate-500">{row.transaction.status === "approved" ? row.transaction.paymentMethod : "chưa xác nhận"}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{row.course && !row.course.price ? "Miễn phí" : "—"}</span>
                  )}
                </td>
                <td className="mcna-td text-right pr-4 whitespace-nowrap">
                  {row.status === "pending_payment" ? (
                    <button type="button" onClick={() => handleConfirmPayment(row)} disabled={busy} className="mcna-btn-secondary !h-8 !px-3 !text-xs disabled:opacity-50 cursor-pointer">Xác nhận đã thanh toán</button>
                  ) : row.currentSection ? (
                    <div className="inline-flex flex-col items-end gap-1">
                      <button type="button" onClick={() => handleResend(row)} disabled={busy} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50 cursor-pointer">Gửi lại email</button>
                      {row.status === "active" && <button type="button" onClick={() => { setSelected(new Set([row.id])); setTargetSectionId(""); setPlacementErrors([]); }} className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">Chuyển lớp</button>}
                    </div>
                  ) : canSelect(row) ? (
                    <button type="button" onClick={() => { setSelected(new Set([row.id])); setPlacementErrors([]); }} className="mcna-btn-primary !h-8 !px-3 !text-xs cursor-pointer">Xếp lớp</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <span>{filtered.length === 0 ? "" : `Hiển thị ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} trong ${filtered.length} học viên`}</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={safePage === 1} className="mcna-btn-secondary !h-8 !px-3 !text-xs inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer">
              <ChevronLeft className="h-3.5 w-3.5" /> Trước
            </button>
            <span>Trang {safePage}/{pageCount}</span>
            <button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={safePage === pageCount} className="mcna-btn-secondary !h-8 !px-3 !text-xs inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer">
              Sau <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {showImport && (
        <PaidImportModal
          courses={courses}
          onClose={() => setShowImport(false)}
          onImported={() => { void onRefreshData(); setStatusFilter("pending"); }}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
