import React, { useState } from "react";
import { AlertCircle, CreditCard, FileText } from "lucide-react";

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
        <p className="text-xs text-slate-500">Các khóa học bạn đã đăng ký và lịch sử giao dịch chuyển khoản.</p>
      </div>

      <div className="space-y-3">
        {myEnrollments.map((enrollment: any) => {
          const course = store.courses.find((c: any) => c.id === enrollment.courseId);
          const price = course?.price || 0;
          const paidTx = (store.transactions || []).find(
            (tx: any) => tx.studentId === currentUser.id && tx.courseId === enrollment.courseId && tx.status === "approved"
          );

          return (
            <div key={enrollment.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900 text-sm">{course?.title || "Khóa học"}</h5>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Đăng ký ngày {new Date(enrollment.enrolledAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono self-start sm:self-auto border ${statusStyle[enrollment.status] || statusStyle.cancelled}`}>
                  {statusLabel[enrollment.status] || enrollment.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block font-medium">Học phí khóa học</span>
                  <span className="font-bold text-slate-900 mt-0.5 text-sm">{price > 0 ? `${price.toLocaleString()} VND` : "Miễn phí"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Thanh toán</span>
                  <span className={`font-bold mt-0.5 text-sm ${paidTx ? "text-emerald-700" : "text-amber-800"}`}>
                    {price > 0 ? (paidTx ? "Đã xác nhận" : "Chưa xác nhận") : "Không cần"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Ngày xác nhận</span>
                  <span className="font-bold text-slate-700 mt-0.5">
                    {paidTx?.processedAt ? new Date(paidTx.processedAt).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>

              {enrollment.status === "pending_payment" && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] leading-relaxed flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                  <span>Đơn của bạn đang chờ thanh toán. Sau khi bộ phận thu học phí xác nhận, bạn sẽ được xếp vào lớp.</span>
                </div>
              )}
            </div>
          );
        })}

        {myEnrollments.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-xs bg-white border border-dashed border-slate-200 rounded-2xl">
            Bạn chưa đăng ký khóa học nào. Hãy vào mục "Khám phá Khóa học" để bắt đầu.
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
            <input
              type="text"
              placeholder="Tìm mã giao dịch, khóa học..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-500 placeholder-slate-400 shadow-xs"
            />
            <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono tracking-wider font-bold">
                <th className="p-3 text-[10.5px]">Mã giao dịch</th>
                <th className="p-3 text-[10.5px]">Khóa học</th>
                <th className="p-3 text-right text-[10.5px]">Số tiền</th>
                <th className="p-3 text-[10.5px]">Phương thức</th>
                <th className="p-3 text-[10.5px]">Thời gian</th>
                <th className="p-3 text-right text-[10.5px]">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {myTransactions.map((tx: any) => {
                const course = store.courses.find((c: any) => c.id === tx.courseId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/75 transition duration-150">
                    <td className="p-3 font-mono font-bold text-indigo-700">{tx.id}</td>
                    <td className="p-3 font-medium text-slate-900">{course?.title || "Khóa học"}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{tx.amount.toLocaleString()} VND</td>
                    <td className="p-3 text-slate-500">{tx.paymentMethod}</td>
                    <td className="p-3 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">
                      {tx.status === "approved" && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">Thành công</span>
                      )}
                      {tx.status === "pending" && (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">Chờ xác nhận</span>
                      )}
                      {tx.status === "rejected" && (
                        <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold">Từ chối</span>
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
      </div>
    </div>
  );
}
