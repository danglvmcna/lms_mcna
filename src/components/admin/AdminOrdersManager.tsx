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
  Users,
  ClipboardList,
  Wallet,
  Hourglass,
  TrendingUp
} from "lucide-react";
import { api } from "../../api";
import { Enrollment, User, Course, CourseSection, Transaction } from "../../types";
import ModalPortal from "../ModalPortal";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SearchField, StatTile } from "../ui";

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
    return new Intl.NumberFormat("vi-VN").format(amount) + "\u00A0đ";
  };



  return (
    <div className="space-y-6">
      <PageHeader title="Ghi danh" subtitle="Xác nhận học phí, xếp lớp và kích hoạt học viên." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Tổng đơn" value={orders.length} icon={<ClipboardList className="h-[18px] w-[18px]" />} />
        <StatTile label="Chờ thanh toán" value={pendingPaymentCount} tone="amber" icon={<Wallet className="h-[18px] w-[18px]" />} hint={pendingPaymentCount ? "Cần xác nhận" : "Đã xử lý hết"} />
        <StatTile label="Chờ xếp lớp" value={pendingPlacementCount} tone="sky" icon={<Hourglass className="h-[18px] w-[18px]" />} hint={pendingPlacementCount ? "Chờ phân bổ" : "Đã xử lý hết"} />
        <StatTile label="Doanh thu" value={<span className="text-xl sm:text-2xl" title={formatMoney(totalRevenue)}>{formatMoney(totalRevenue)}</span>} tone="emerald" icon={<TrendingUp className="h-[18px] w-[18px]" />} hint={`${activeCount} học viên đang học`} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Tìm theo tên, SĐT, email, mã đơn…" className="flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Lọc theo trạng thái" className="mcna-select !w-auto !rounded-full">
            <option value="all">Tất cả trạng thái ({orders.length})</option>
            <option value="pending_payment">Chờ thanh toán ({pendingPaymentCount})</option>
            <option value="pending">Chờ xếp lớp ({pendingPlacementCount})</option>
            <option value="active">Đang học ({activeCount})</option>
          </select>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} aria-label="Lọc đơn theo khóa học" className="mcna-select !w-auto max-w-[240px] !rounded-full">
            <option value="all">Tất cả khóa học</option>
            {courses
              .filter(course => orders.some(order => order.courseId === course.id))
              .sort((a, b) => a.title.localeCompare(b.title, "vi"))
              .map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
          </select>
          {(search || statusFilter !== "all" || courseFilter !== "all") && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setStatusFilter("all"); setCourseFilter("all"); }}>Đặt lại</Button>
          )}
        </div>
      </div>

      {/* Integrated Result Count */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          {filteredOrders.length === 0
            ? "Không có học viên nào phù hợp"
            : `Hiển thị ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredOrders.length)} trong tổng số ${filteredOrders.length} học viên`}
        </span>
      </div>

      <div className="space-y-3 lg:hidden">
        {paginatedOrders.map(order => {
          const activeSection = order.currentSection || order.requestedSection;
          const isPending = order.status === "pending_payment" || order.status === "pending";
          return <Card key={order.id} className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={order.student?.name} size={40} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-900">{order.student?.name || "Chưa đặt tên"}</h3>
                <p className="truncate text-[13px] text-slate-500">{order.student?.email || "—"}</p>
              </div>
              <Badge tone={order.status === "active" ? "success" : order.status === "pending" ? "info" : "warning"} dot>
                {order.status === "active" ? "Đang học" : order.status === "pending" ? "Chờ xếp lớp" : "Chờ thanh toán"}
              </Badge>
            </div>
            <div className="rounded-2xl bg-canvas p-3 text-sm">
              <p className="font-semibold text-slate-800">{order.course?.title || "Khóa học chưa xác định"}</p>
              <p className="mt-0.5 text-[13px] text-slate-500">{activeSection ? `Lớp ${activeSection.sectionCode}` : "Chưa chọn lớp"}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-900">{formatMoney(order.price)}</span>
              {isPending && <Button size="sm" onClick={() => handleQuickActivate(order)} loading={activatingId === order.id} icon={<Check className="h-4 w-4" />}>Kích hoạt</Button>}
            </div>
          </Card>;
        })}
        {paginatedOrders.length === 0 && <Card><EmptyState compact icon={<ClipboardList className="h-6 w-6" />} title="Không có đơn phù hợp" /></Card>}
      </div>

      {/* Orders Data Table */}
      <div className="mcna-table-wrapper hidden lg:block">
        <table className="mcna-table min-w-[900px]">
          <thead className="mcna-thead">
            <tr>
              <th className="mcna-th pl-4 min-w-[200px]">Học viên</th>
              <th className="mcna-th min-w-[200px]">Khóa học</th>
              <th className="mcna-th min-w-[140px] whitespace-nowrap">Lớp học</th>
              <th className="mcna-th text-right whitespace-nowrap min-w-[130px]">Học phí</th>
              <th className="mcna-th text-center whitespace-nowrap min-w-[140px]">Trạng thái</th>
              <th className="mcna-th text-right pr-4 whitespace-nowrap min-w-[140px]">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <p className="text-sm font-medium text-slate-600">Không tìm thấy học viên</p>
                    <p className="text-xs text-slate-400">
                      Không có kết quả nào khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại.
                    </p>
                    {(search || statusFilter !== "all" || courseFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => { setSearch(""); setStatusFilter("all"); setCourseFilter("all"); }}
                        className="mcna-btn-secondary !h-8 !px-3 !text-xs mt-2"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedOrders.map(order => {
                const isPending = order.status === "pending_payment" || order.status === "pending";
                const activeSection = order.currentSection || order.requestedSection;

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Column 1: Học viên (Primary Identity) */}
                    <td className="mcna-td pl-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={order.student?.name} size={38} />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-sm truncate">
                            {order.student?.name || "Chưa đặt tên"}
                          </div>
                          <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            <span>{order.student?.email || "—"}</span>
                            {order.student?.phone && (
                              <>
                                <span className="text-slate-300 font-bold">·</span>
                                <span className="font-mono text-slate-500">{order.student?.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Khóa học */}
                    <td className="mcna-td py-3.5">
                      <div className="min-w-0 max-w-xs">
                        <span className="font-semibold text-slate-900 text-sm block leading-snug line-clamp-2">
                          {order.course?.title || "Khóa học chưa xác định"}
                        </span>
                        {order.course?.category && (
                          <span className="text-xs text-slate-500 font-normal block mt-0.5 truncate">
                            {order.course.category}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3: Lớp học */}
                    <td className="mcna-td py-3.5 whitespace-nowrap">
                      {activeSection ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                            {activeSection.sectionCode}
                          </span>
                          {activeSection.openingDate && (
                            <span className="text-xs text-slate-500 block mt-1">
                              Khai giảng · {new Date(activeSection.openingDate).toLocaleDateString("vi-VN")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa chọn lớp</span>
                      )}
                    </td>

                    {/* Column 4: Học phí */}
                    <td className="mcna-td py-3.5 text-right whitespace-nowrap">
                      <span className="font-mono font-semibold text-slate-900 text-sm md:text-base">
                        {formatMoney(order.price)}
                      </span>
                    </td>

                    {/* Column 5: Trạng thái */}
                    <td className="mcna-td py-3.5 text-center whitespace-nowrap">
                      {order.status === "pending_payment" && (
                        <Badge tone="warning" dot>Chờ thanh toán</Badge>
                      )}
                      {order.status === "pending" && (
                        <Badge tone="info" dot>Chờ xếp lớp</Badge>
                      )}
                      {order.status === "active" && (
                        <Badge tone="success" dot>Đang học</Badge>
                      )}
                    </td>

                    {/* Column 6: Hành động */}
                    <td className="mcna-td py-3.5 text-right pr-4 whitespace-nowrap">
                      {isPending ? (
                        <button
                          onClick={() => handleQuickActivate(order)}
                          disabled={activatingId === order.id}
                          className="mcna-btn-primary !h-8 !px-3 !text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Xác nhận thanh toán và kích hoạt vào lớp"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{activatingId === order.id ? "Đang xử lý..." : "Kích hoạt"}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 inline-flex items-center justify-end gap-1.5 font-medium whitespace-nowrap">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Đã hoàn tất</span>
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

      {pageCount > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500">
            Trang <span className="font-semibold text-slate-700">{safePage}</span> / {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="mcna-btn-secondary !h-8 !px-3 !text-xs inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Trước
            </button>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
              className="mcna-btn-secondary !h-8 !px-3 !text-xs inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Sau <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Select Section Modal if multiple sections available */}
      {selectedEnrollmentForPlacement && (
        <ModalPortal>
          <div className="mcna-overlay">
            <div className="mcna-dialog sm:max-w-md">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900">
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
                              <p className="mt-1 text-xs text-slate-500">
                                {s.openingDate ? `Khai giảng ${new Date(s.openingDate).toLocaleDateString("vi-VN")}` : "Chưa chốt ngày khai giảng"}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-md font-mono px-2 py-0.5 text-xs font-semibold ${isFull ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              <Users className="h-3 w-3" /> {enrolledCount}/{s.maxStudents}
                            </span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${isFull ? "bg-rose-500" : fillPercentage >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${fillPercentage}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">{isFull ? "Lớp đã đủ sĩ số" : `Còn ${seatsLeft} chỗ trống`}</p>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 text-xs border-t border-slate-100">
                <button
                  onClick={() => setSelectedEnrollmentForPlacement(null)}
                  className="mcna-btn-ghost"
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
