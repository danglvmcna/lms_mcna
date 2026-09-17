import React, { useEffect, useMemo, useState } from "react";
import { 
  ShoppingBag, 
  Search, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  User as UserIcon, 
  BookOpen, 
  DollarSign, 
  Calendar, 
  Check, 
  X,
  ExternalLink,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Users
} from "lucide-react";
import { api } from "../../api";
import { Enrollment, User, Course, CourseSection, Transaction } from "../../types";
import ModalPortal from "../ModalPortal";

interface AdminOrdersManagerProps {
  store: any;
  currentUser: User;
  onRefreshData: () => void;
  triggerToast: (msg: string) => void;
}

export default function AdminOrdersManager({
  store,
  currentUser,
  onRefreshData,
  triggerToast
}: AdminOrdersManagerProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [selectedEnrollmentForPlacement, setSelectedEnrollmentForPlacement] = useState<any | null>(null);
  const [chosenSectionId, setChosenSectionId] = useState<string>("");

  const enrollments: Enrollment[] = store.enrollments || [];
  const users: User[] = store.users || [];
  const courses: Course[] = store.courses || [];
  const sections: CourseSection[] = store.courseSections || [];
  const transactions: Transaction[] = store.transactions || [];
  const registrations = store.courseRegistrations || [];
  const pageSize = 8;

  const sectionOccupancy = useMemo(() => {
    const occupancy = new Map<string, number>();
    registrations.forEach((registration: any) => {
      if (registration.status !== "registered") return;
      occupancy.set(registration.sectionId, (occupancy.get(registration.sectionId) || 0) + 1);
    });
    return occupancy;
  }, [registrations]);

  const getSectionOccupancy = (sectionId: string) => sectionOccupancy.get(sectionId) || 0;
  const isSectionFull = (section: CourseSection) => getSectionOccupancy(section.id) >= section.maxStudents;

  // Enriched orders
  const orders = useMemo(() => {
    return enrollments.map(enroll => {
      const student = users.find(u => u.id === enroll.studentId);
      const course = courses.find(c => c.id === enroll.courseId);
      const reg = registrations.find(
        (r: any) => r.studentId === enroll.studentId && r.status === "registered" && sections.some(s => s.id === r.sectionId && s.courseId === enroll.courseId)
      );
      const currentSection = reg ? sections.find(s => s.id === reg.sectionId) : null;
      const requestedSection = enroll.requestedSectionId ? sections.find(s => s.id === enroll.requestedSectionId) : null;
      const tx = transactions.find(t => t.studentId === enroll.studentId && t.courseId === enroll.courseId);

      return {
        ...enroll,
        student,
        course,
        currentSection,
        requestedSection,
        transaction: tx,
        price: tx?.amount || course?.price || 0
      };
    }).sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());
  }, [enrollments, users, courses, sections, transactions, registrations]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(order => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (courseFilter !== "all" && order.courseId !== courseFilter) return false;
      if (!q) return true;
      return (
        order.student?.name?.toLowerCase().includes(q) ||
        order.student?.email?.toLowerCase().includes(q) ||
        order.student?.phone?.toLowerCase().includes(q) ||
        order.course?.title?.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.transaction?.id?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter, courseFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, courseFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Counters
  const pendingPaymentCount = useMemo(() => orders.filter(o => o.status === "pending_payment").length, [orders]);
  const pendingPlacementCount = useMemo(() => orders.filter(o => o.status === "pending").length, [orders]);
  const activeCount = useMemo(() => orders.filter(o => o.status === "active").length, [orders]);
  const totalRevenue = useMemo(() => {
    return orders
      .filter(o => o.status === "active" || o.transaction?.status === "approved")
      .reduce((sum, o) => sum + (o.price || 0), 0);
  }, [orders]);

  const handleQuickActivate = async (order: any) => {
    const availableSections = sections.filter(s => s.courseId === order.courseId && s.status === "open" && !isSectionFull(s));
    const requestedSectionIsAvailable = availableSections.some(section => section.id === order.requestedSectionId);
    const preselected = requestedSectionIsAvailable ? order.requestedSectionId : availableSections[0]?.id || "";

    if (availableSections.length === 0) {
      triggerToast("Khóa học này chưa có lớp mở còn chỗ. Vui lòng mở thêm lớp trước khi kích hoạt.");
      return;
    }

    if (availableSections.length > 1 && !requestedSectionIsAvailable) {
      setSelectedEnrollmentForPlacement(order);
      setChosenSectionId(availableSections[0].id);
      return;
    }

    setActivatingId(order.id);
    try {
      await api.activateEnrollment(order.id, { sectionId: preselected });
      onRefreshData();
      triggerToast(`Đã xác nhận thanh toán và kích hoạt thành công cho học viên ${order.student?.name || ""}!`);
    } catch (err: any) {
      triggerToast(err.message || "Không thể kích hoạt đơn hàng.");
    } finally {
      setActivatingId(null);
    }
  };

  const handleConfirmPlacementModal = async () => {
    if (!selectedEnrollmentForPlacement || !chosenSectionId) return;
    const chosenSection = sections.find(section => section.id === chosenSectionId);
    if (!chosenSection || isSectionFull(chosenSection)) {
      triggerToast("Lớp đã đủ sĩ số. Vui lòng chọn lớp khác còn chỗ.");
      return;
    }
    setActivatingId(selectedEnrollmentForPlacement.id);
    try {
      await api.activateEnrollment(selectedEnrollmentForPlacement.id, { sectionId: chosenSectionId });
      onRefreshData();
      triggerToast(`Đã kích hoạt và xếp học viên vào lớp thành công!`);
      setSelectedEnrollmentForPlacement(null);
    } catch (err: any) {
      triggerToast(err.message || "Không thể kích hoạt.");
    } finally {
      setActivatingId(null);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
            QUẢN LÝ BÁN KHÓA HỌC & ĐƠN HÀNG
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">Đơn hàng & Ghi danh Khóa học</h2>
          <p className="text-xs text-slate-500 mt-0.5">Xác nhận chuyển khoản học phí, kích hoạt tài khoản và xếp lớp 1-chạm.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Tổng đơn đăng ký</p>
          <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{orders.length}</h3>
        </div>
        <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl shadow-xs">
          <p className="text-[11px] text-amber-800 uppercase tracking-wider font-semibold">Chờ thanh toán</p>
          <h3 className="text-2xl font-bold font-mono text-amber-900 mt-1">{pendingPaymentCount}</h3>
        </div>
        <div className="bg-indigo-50/60 border border-indigo-200/80 p-4 rounded-2xl shadow-xs">
          <p className="text-[11px] text-indigo-800 uppercase tracking-wider font-semibold">Chờ xếp lớp</p>
          <h3 className="text-2xl font-bold font-mono text-indigo-900 mt-1">{pendingPlacementCount}</h3>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl shadow-xs">
          <p className="text-[11px] text-emerald-800 uppercase tracking-wider font-semibold">Đã kích hoạt / Doanh thu</p>
          <h3 className="text-lg md:text-xl font-bold font-mono text-emerald-900 mt-1 truncate">
            {formatMoney(totalRevenue)}
          </h3>
          <span className="text-[10px] text-emerald-700 font-medium">{activeCount} học viên đang học</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên học viên, SĐT, email, tên khóa..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white placeholder-slate-400 shadow-xs"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 shadow-xs"
          >
            <option value="all">Tất cả trạng thái ({orders.length})</option>
            <option value="pending_payment">Chờ xác nhận đóng tiền ({pendingPaymentCount})</option>
            <option value="pending">Chờ xếp lớp ({pendingPlacementCount})</option>
            <option value="active">Đã kích hoạt ({activeCount})</option>
          </select>
        </div>
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 min-w-48 shadow-xs"
          aria-label="Lọc đơn theo khóa học"
        >
          <option value="all">Tất cả khóa học</option>
          {courses
            .filter(course => orders.some(order => order.courseId === course.id))
            .sort((a, b) => a.title.localeCompare(b.title, "vi"))
            .map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span>Hiển thị {filteredOrders.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredOrders.length)} / {filteredOrders.length} đơn</span>
        {(search || statusFilter !== "all" || courseFilter !== "all") && (
          <button
            type="button"
            onClick={() => { setSearch(""); setStatusFilter("all"); setCourseFilter("all"); }}
            className="font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-mono tracking-wider font-semibold">
              <tr>
                <th className="p-3.5 pl-4">Học viên</th>
                <th className="p-3.5">Khóa học</th>
                <th className="p-3.5">Lớp & Lịch học</th>
                <th className="p-3.5 text-right">Số tiền</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-right pr-4">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy đơn đăng ký nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const isPending = order.status === "pending_payment" || order.status === "pending";
                  const isActive = order.status === "active";
                  const activeSection = order.currentSection || order.requestedSection;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5 pl-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-xs">
                            {order.student?.name || "Học viên"}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {order.student?.email || "—"}
                          </span>
                          {order.student?.phone && (
                            <span className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5 font-mono">
                              <Phone className="h-3 w-3 text-slate-400" /> {order.student?.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="font-medium text-slate-900 line-clamp-2">
                          {order.course?.title || "Khóa học"}
                        </span>
                        <span className="text-[10px] text-indigo-600 font-mono block mt-0.5">
                          {order.course?.category}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {activeSection ? (
                          <div>
                            <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[10px]">
                              {activeSection.sectionCode}
                            </span>
                            {activeSection.openingDate && (
                              <span className="text-[10px] text-slate-500 block mt-1">
                                Khai giảng: {new Date(activeSection.openingDate).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa chọn lớp</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {formatMoney(order.price)}
                      </td>

                      <td className="p-3.5 text-center">
                        {order.status === "pending_payment" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> Chờ thanh toán
                          </span>
                        )}
                        {order.status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <AlertCircle className="h-3 w-3" /> Chờ xếp lớp
                          </span>
                        )}
                        {order.status === "active" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3" /> Đang học
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right pr-4">
                        {isPending ? (
                          <button
                            onClick={() => handleQuickActivate(order)}
                            disabled={activatingId === order.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-[11px] shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer"
                            title="Xác nhận thanh toán và kích hoạt vào lớp"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{activatingId === order.id ? "Đang xử lý..." : "Kích hoạt 1-chạm"}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                            <Check className="h-3 w-3 text-emerald-600" /> Đã hoàn tất
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-500">Trang {safePage} / {pageCount}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Trước
            </button>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              Sau <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Select Section Modal if multiple sections available */}
      {selectedEnrollmentForPlacement && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-150 font-sans">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
                  Chọn lớp học phần để xếp lớp
                </h4>
                <button
                  onClick={() => setSelectedEnrollmentForPlacement(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p>Học viên: <strong className="text-slate-900">{selectedEnrollmentForPlacement.student?.name}</strong></p>
                <p>Khóa học: <strong className="text-slate-900">{selectedEnrollmentForPlacement.course?.title}</strong></p>
              </div>

              <div className="space-y-2 text-xs">
                <label className="text-slate-700 block font-medium">Chọn lớp còn chỗ:</label>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sections
                    .filter(s => s.courseId === selectedEnrollmentForPlacement.courseId && s.status === "open")
                    .map(s => {
                      const enrolledCount = getSectionOccupancy(s.id);
                      const seatsLeft = Math.max(0, s.maxStudents - enrolledCount);
                      const isFull = seatsLeft === 0;
                      const fillPercentage = Math.min(100, Math.round((enrolledCount / Math.max(1, s.maxStudents)) * 100));
                      const selected = chosenSectionId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={isFull}
                          onClick={() => setChosenSectionId(s.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20" : "border-slate-200 bg-white hover:border-slate-300"} ${isFull ? "opacity-55 cursor-not-allowed bg-slate-50" : "cursor-pointer"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono font-bold text-slate-900">{s.sectionCode}</p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                {s.openingDate ? `Khai giảng ${new Date(s.openingDate).toLocaleDateString("vi-VN")}` : "Chưa chốt ngày khai giảng"}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isFull ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              <Users className="h-3 w-3" /> {enrolledCount}/{s.maxStudents}
                            </span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${isFull ? "bg-rose-500" : fillPercentage >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${fillPercentage}%` }} />
                          </div>
                          <p className="mt-1.5 text-[10px] text-slate-500">{isFull ? "Lớp đã đủ sĩ số" : `Còn ${seatsLeft} chỗ trống`}</p>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 text-xs border-t border-slate-100">
                <button
                  onClick={() => setSelectedEnrollmentForPlacement(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmPlacementModal}
                  disabled={activatingId !== null || !chosenSectionId || Boolean(sections.find(section => section.id === chosenSectionId && isSectionFull(section)))}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>Xác nhận & Kích hoạt</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
