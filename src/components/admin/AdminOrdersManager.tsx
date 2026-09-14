import React, { useState, useMemo } from "react";
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
  ChevronRight,
  Phone,
  Mail
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
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [selectedEnrollmentForPlacement, setSelectedEnrollmentForPlacement] = useState<any | null>(null);
  const [chosenSectionId, setChosenSectionId] = useState<string>("");

  const enrollments: Enrollment[] = store.enrollments || [];
  const users: User[] = store.users || [];
  const courses: Course[] = store.courses || [];
  const sections: CourseSection[] = store.courseSections || [];
  const transactions: Transaction[] = store.transactions || [];
  const registrations = store.courseRegistrations || [];

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
  }, [orders, search, statusFilter]);

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
    const availableSections = sections.filter(s => s.courseId === order.courseId && s.status === "open");
    const preselected = order.requestedSectionId || availableSections[0]?.id || "";

    if (!preselected && availableSections.length === 0) {
      triggerToast("Khóa học này hiện chưa có lớp nào mở. Vui lòng tạo lớp học trước khi kích hoạt.");
      return;
    }

    if (availableSections.length > 1 && !order.requestedSectionId) {
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
          <span className="text-xs font-mono font-semibold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase">
            QUẢN LÝ BÁN KHÓA HỌC & ĐƠN HÀNG
          </span>
          <h2 className="text-xl font-display font-bold text-white mt-2">Đơn hàng & Ghi danh Khóa học</h2>
          <p className="text-xs text-white/50">Xác nhận chuyển khoản học phí, kích hoạt tài khoản và xếp lớp 1-chạm.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Tổng đơn đăng ký</p>
          <h3 className="text-2xl font-bold font-mono text-white mt-1">{orders.length}</h3>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
          <p className="text-[10px] text-amber-300 uppercase tracking-widest font-bold">Chờ thanh toán</p>
          <h3 className="text-2xl font-bold font-mono text-amber-300 mt-1">{pendingPaymentCount}</h3>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
          <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Chờ xếp lớp</p>
          <h3 className="text-2xl font-bold font-mono text-blue-300 mt-1">{pendingPlacementCount}</h3>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
          <p className="text-[10px] text-emerald-300 uppercase tracking-widest font-bold">Đã kích hoạt / Doanh thu</p>
          <h3 className="text-lg md:text-xl font-bold font-mono text-emerald-300 mt-1 truncate">
            {formatMoney(totalRevenue)}
          </h3>
          <span className="text-[10px] text-emerald-400/70">{activeCount} học viên đang học</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên học viên, SĐT, email, tên khóa..."
            className="w-full pl-9 pr-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl text-xs focus:outline-none focus:border-indigo-400 placeholder-white/30"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
          >
            <option value="all">Tất cả trạng thái ({orders.length})</option>
            <option value="pending_payment">Chờ xác nhận đóng tiền ({pendingPaymentCount})</option>
            <option value="pending">Chờ xếp lớp ({pendingPlacementCount})</option>
            <option value="active">Đã kích hoạt ({activeCount})</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-white/50 text-[10px] uppercase font-mono tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">Học viên</th>
                <th className="p-3.5">Khóa học</th>
                <th className="p-3.5">Lớp & Lịch học</th>
                <th className="p-3.5 text-right">Số tiền</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-right pr-4">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-white/40">
                    Không tìm thấy đơn đăng ký nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isPending = order.status === "pending_payment" || order.status === "pending";
                  const isActive = order.status === "active";
                  const activeSection = order.currentSection || order.requestedSection;

                  return (
                    <tr key={order.id} className="hover:bg-white/2 transition">
                      <td className="p-3.5 pl-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-xs">
                            {order.student?.name || "Học viên"}
                          </span>
                          <span className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {order.student?.email || "—"}
                          </span>
                          {order.student?.phone && (
                            <span className="text-[11px] text-cyan-400/80 flex items-center gap-1 mt-0.5 font-mono">
                              <Phone className="h-3 w-3" /> {order.student?.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-white/90 line-clamp-2">
                          {order.course?.title || "Khóa học"}
                        </span>
                        <span className="text-[10px] text-indigo-300/70 block mt-0.5">
                          {order.course?.category}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {activeSection ? (
                          <div>
                            <span className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 text-[10px]">
                              {activeSection.sectionCode}
                            </span>
                            {activeSection.openingDate && (
                              <span className="text-[10px] text-white/50 block mt-1">
                                Khai giảng: {new Date(activeSection.openingDate).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/30 italic text-[11px]">Chưa chọn lớp</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-white">
                        {formatMoney(order.price)}
                      </td>

                      <td className="p-3.5 text-center">
                        {order.status === "pending_payment" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Clock className="h-3 w-3" /> Chờ thanh toán
                          </span>
                        )}
                        {order.status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            <AlertCircle className="h-3 w-3" /> Chờ xếp lớp
                          </span>
                        )}
                        {order.status === "active" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <CheckCircle className="h-3 w-3" /> Đang học
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right pr-4">
                        {isPending ? (
                          <button
                            onClick={() => handleQuickActivate(order)}
                            disabled={activatingId === order.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition text-[11px] shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer"
                            title="Xác nhận thanh toán và kích hoạt vào lớp"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{activatingId === order.id ? "Đang xử lý..." : "Kích hoạt 1-chạm"}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-white/40 flex items-center justify-end gap-1 font-mono">
                            <Check className="h-3 w-3 text-emerald-400" /> Đã hoàn tất
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

      {/* Select Section Modal if multiple sections available */}
      {selectedEnrollmentForPlacement && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/15 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl text-white">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <h4 className="text-sm font-display font-extrabold uppercase tracking-wider">
                  Chọn lớp học phần để xếp lớp
                </h4>
                <button
                  onClick={() => setSelectedEnrollmentForPlacement(null)}
                  className="p-1 text-white/50 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="text-xs text-white/70 space-y-2">
                <p>Học viên: <strong className="text-white">{selectedEnrollmentForPlacement.student?.name}</strong></p>
                <p>Khóa học: <strong className="text-white">{selectedEnrollmentForPlacement.course?.title}</strong></p>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-white/70 block font-semibold">Chọn lớp khai giảng:</label>
                <select
                  value={chosenSectionId}
                  onChange={e => setChosenSectionId(e.target.value)}
                  className="w-full bg-slate-800 border border-white/15 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-400 text-xs"
                >
                  {sections
                    .filter(s => s.courseId === selectedEnrollmentForPlacement.courseId && s.status === "open")
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.sectionCode} {s.openingDate ? `(KG: ${s.openingDate})` : ""} - Sĩ số: {s.maxStudents}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setSelectedEnrollmentForPlacement(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmPlacementModal}
                  disabled={activatingId !== null}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5"
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
