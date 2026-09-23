import React, { useState } from "react";
import { AlertCircle, CreditCard, FileText, Search, QrCode } from "lucide-react";

interface ComponentProps {
  [key: string]: any;
}

const statusLabel: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  pending: "Chờ xếp lớp",
  active: "Đang học",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy"
};

const statusStyle: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-800 border-amber-200",
  pending: "bg-sky-50 text-sky-700 border-sky-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200"
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const formatDateTime = (value: string) => new Date(value).toLocaleString("vi-VN");
const formatAmount = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
const supportsVietQr = (method?: string) => /chuyển khoản|bank|vietqr/i.test(method || "");

/** Orders & payments tab: the courses the learner signed up for and the transfers they sent. */
export default function StudentOrders(props: ComponentProps) {
  const { activeSubTab, store, currentUser, myEnrollments } = props;
  const [search, setSearch] = useState("");

  if (activeSubTab !== "orders") return null;

  const myTransactions = (store.transactions || [])
    .filter((tx: any) => tx.studentId === currentUser.id)
    .filter((tx: any) => {
      if (!search.trim()) return true;
      const course = store.courses.find((c: any) => c.id === tx.courseId);
      const haystack = `${tx.id} ${course?.title || ""} ${tx.paymentMethod || ""}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h4 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-600" /> Đơn hàng & thanh toán
        </h4>
        <p className="text-sm text-slate-500 mt-1">Các khóa học bạn đã đăng ký và lịch sử thanh toán.</p>
      </div>

      <div className="space-y-3">
        {myEnrollments.map((enrollment: any) => {
          const course = store.courses.find((c: any) => c.id === enrollment.courseId);
          const price = course?.price || 0;
          const paidTx = (store.transactions || []).find(
            (tx: any) => tx.studentId === currentUser.id && tx.courseId === enrollment.courseId && tx.status === "approved"
          );
          const pendingTx = (store.transactions || []).find(
            (tx: any) => tx.studentId === currentUser.id && tx.courseId === enrollment.courseId && tx.status === "pending" && supportsVietQr(tx.paymentMethod)
          );
          const paymentState = price === 0 ? "Không cần" : paidTx ? "Đã xác nhận" : ["active", "completed"].includes(enrollment.status) ? "Lớp đã kích hoạt" : "Chờ xác nhận";

          return (
            <div key={enrollment.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900 text-sm">{course?.title || "Khóa học"}</h5>
                  <p className="text-xs text-slate-500">
                    Đăng ký ngày {formatDate(enrollment.enrolledAt)}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold self-start sm:self-auto border ${statusStyle[enrollment.status] || statusStyle.cancelled}`}>
                  {statusLabel[enrollment.status] || enrollment.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Học phí khóa học</span>
                  <span className="font-bold text-slate-900 mt-0.5 text-sm">{price > 0 ? formatAmount(price) : "Miễn phí"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Thanh toán</span>
                  <span className={`font-bold mt-0.5 text-sm ${paidTx || ["active", "completed"].includes(enrollment.status) ? "text-emerald-700" : "text-amber-800"}`}>
                    {paymentState}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Ngày xác nhận</span>
                  <span className="font-bold text-slate-700 mt-0.5">
                    {paidTx?.processedAt ? formatDate(paidTx.processedAt) : "—"}
                  </span>
                </div>
              </div>

              {enrollment.status === "pending_payment" && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                    <span>{pendingTx ? "Đơn của bạn đang chờ thanh toán. Mở hướng dẫn VietQR để hoàn tất học phí." : "Đơn đang chờ cập nhật thanh toán. Nếu đã thanh toán, vui lòng chờ xác nhận hoặc liên hệ MCNA để được hỗ trợ."}</span>
                  </div>
                  {pendingTx && <button
                    type="button"
                    onClick={() => props.setPaymentGuideTx?.(pendingTx)}
                    className="shrink-0 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-sm transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <QrCode className="h-3.5 w-3.5" /> Thanh toán VietQR
                  </button>}
                </div>
              )}
            </div>
          );
        })}

        {myEnrollments.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-base font-semibold text-slate-900">Bạn chưa đăng ký khóa học nào</p>
            <p className="text-sm text-slate-500">Khám phá các khóa học đang mở để bắt đầu học.</p>
            <button type="button" onClick={() => props.setActiveSubTab?.("catalog")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Khám phá khóa học</button>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-600" /> Lịch sử giao dịch
            </h5>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Giao dịch ở trạng thái "Chờ xác nhận" đang đợi bên xử lý thanh toán cập nhật kết quả.
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm mã giao dịch, khóa học..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mcna-input pl-9"
            />
          </div>
        </div>

        <div className="mcna-table-wrapper hidden overflow-x-auto md:block">
          <table className="mcna-table">
            <thead>
              <tr>
                <th className="mcna-th">Mã giao dịch</th>
                <th className="mcna-th">Khóa học</th>
                <th className="mcna-th text-right">Số tiền</th>
                <th className="mcna-th">Phương thức</th>
                <th className="mcna-th">Thời gian</th>
                <th className="mcna-th text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {myTransactions.map((tx: any) => {
                const course = store.courses.find((c: any) => c.id === tx.courseId);
                return (
                  <tr key={tx.id}>
                    <td className="mcna-td font-mono font-bold text-indigo-700">{tx.id}</td>
                    <td className="mcna-td font-medium text-slate-900">{course?.title || "Khóa học"}</td>
                    <td className="mcna-td text-right font-mono font-bold text-emerald-700">{formatAmount(tx.amount)}</td>
                    <td className="mcna-td text-slate-500">{tx.paymentMethod}</td>
                    <td className="mcna-td text-slate-500 text-xs">{formatDateTime(tx.createdAt)}</td>
                    <td className="mcna-td text-right font-mono">
                      {tx.status === "approved" && (
                        <span className="mcna-badge-success">Thành công</span>
                      )}
                        {tx.status === "pending" && supportsVietQr(tx.paymentMethod) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (props.setPaymentGuideTx) {
                              props.setPaymentGuideTx(tx);
                            }
                          }}
                          className="mcna-badge-warning hover:bg-amber-100 transition cursor-pointer inline-flex items-center gap-1"
                          title="Bấm để mở mã VietQR thanh toán"
                        >
                          <QrCode className="h-3 w-3" /> Chờ xác nhận
                        </button>
                        )}
                        {tx.status === "pending" && !supportsVietQr(tx.paymentMethod) && <span className="mcna-badge-warning">Chờ xác nhận</span>}
                      {tx.status === "rejected" && (
                        <span className="mcna-badge-danger">Từ chối</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {myTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 italic">Chưa có giao dịch nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {myTransactions.map((tx: any) => {
            const course = store.courses.find((c: any) => c.id === tx.courseId);
            return <div key={tx.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-900">{course?.title || "Khóa học"}</p><span className="shrink-0 font-semibold text-slate-900">{formatAmount(tx.amount)}</span></div>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(tx.createdAt)} · {tx.paymentMethod}</p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">Mã: {tx.id}</span>{tx.status === "pending" && supportsVietQr(tx.paymentMethod) ? <button type="button" onClick={() => props.setPaymentGuideTx?.(tx)} className="font-semibold text-amber-700">Xem VietQR</button> : <span className="font-semibold text-slate-700">{tx.status === "approved" ? "Thành công" : tx.status === "rejected" ? "Từ chối" : tx.status === "pending" ? "Chờ xác nhận" : tx.status}</span>}</div>
            </div>;
          })}
          {myTransactions.length === 0 && <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Chưa có giao dịch nào.</p>}
        </div>
      </div>
    </div>
  );
}
