import React, { useState } from "react";
import { ArrowRight, QrCode, Receipt, Wallet } from "lucide-react";
import { StudentViewProps } from "./types";
import { ENROLLMENT_STATUS, supportsVietQr } from "./learning";
import { formatDate, formatDateTime, formatVnd } from "../../lib/format";
import { Badge, Button, Card, CourseCover, EmptyState, PageHeader, SearchField, Tone } from "../ui";

const TX_STATUS: Record<string, { label: string; tone: Tone }> = {
  approved: { label: "Thành công", tone: "success" },
  pending: { label: "Chờ xác nhận", tone: "warning" },
  rejected: { label: "Từ chối", tone: "danger" }
};

/** Tuition tab: what the learner has signed up for, what is still due, and every transfer they sent. */
export default function StudentOrders({ store, currentUser, myEnrollments, openPayment, go }: StudentViewProps) {
  const [search, setSearch] = useState("");

  const transactions = (store.transactions || [])
    .filter(tx => tx.studentId === currentUser.id)
    .filter(tx => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      const course = store.courses.find(c => c.id === tx.courseId);
      return `${tx.id} ${course?.title || ""} ${tx.paymentMethod || ""}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const due = myEnrollments.filter(e => e.status === "pending_payment");
  const others = myEnrollments.filter(e => e.status !== "pending_payment");

  if (myEnrollments.length === 0 && transactions.length === 0 && !search) {
    return (
      <div className="space-y-6">
        <PageHeader title="Học phí" />
        <Card>
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Chưa có khoản học phí nào"
            description="Khi bạn đăng ký khóa học có phí, hướng dẫn thanh toán VietQR và lịch sử giao dịch sẽ hiện ở đây."
            action={<Button onClick={() => go("catalog")} iconRight={<ArrowRight className="h-4 w-4" />}>Khám phá khóa học</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Học phí" subtitle="Các khóa bạn đã đăng ký và lịch sử thanh toán." />

      {due.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Cần thanh toán</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {due.map(enrollment => {
              const course = store.courses.find(c => c.id === enrollment.courseId);
              const pendingTx = (store.transactions || []).find(tx => tx.studentId === currentUser.id && tx.courseId === enrollment.courseId && tx.status === "pending" && supportsVietQr(tx.paymentMethod));
              return (
                <Card key={enrollment.id} className="overflow-hidden border-amber-200/80">
                  <div className="flex items-center gap-4 p-5">
                    <CourseCover src={course?.thumbnail} title={course?.title} category={course?.category} className="h-14 w-14 shrink-0 rounded-2xl" iconSize="h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{course?.title || "Khóa học"}</p>
                      <p className="text-sm text-slate-500">Đăng ký ngày {formatDate(enrollment.enrolledAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-amber-50/70 px-5 py-4">
                    <div>
                      <p className="text-xs font-medium text-amber-800">Số tiền</p>
                      <p className="font-display text-xl font-bold text-slate-900">{formatVnd(pendingTx?.amount ?? course?.price ?? 0)}</p>
                    </div>
                    {pendingTx ? (
                      <Button onClick={() => openPayment(pendingTx)} icon={<QrCode className="h-4 w-4" />}>Thanh toán VietQR</Button>
                    ) : (
                      <p className="max-w-[12rem] text-right text-xs leading-snug text-amber-800">Đang chờ cập nhật. Đã chuyển khoản? MCNA sẽ xác nhận sớm.</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Khóa học đã đăng ký</h2>
          <Card as="ul" className="divide-y divide-slate-100 overflow-hidden">
            {others.map(enrollment => {
              const course = store.courses.find(c => c.id === enrollment.courseId);
              const status = ENROLLMENT_STATUS[enrollment.status] || ENROLLMENT_STATUS.cancelled;
              const price = course?.price || 0;
              return (
                <li key={enrollment.id} className="flex items-center gap-4 px-5 py-4">
                  <CourseCover src={course?.thumbnail} title={course?.title} category={course?.category} className="h-11 w-11 shrink-0 rounded-xl" iconSize="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-900">{course?.title || "Khóa học"}</p>
                    <p className="text-[13px] text-slate-500">{price > 0 ? formatVnd(price) : "Miễn phí"} · {formatDate(enrollment.enrolledAt)}</p>
                  </div>
                  <Badge tone={status.tone} dot>{status.label}</Badge>
                </li>
              );
            })}
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Lịch sử giao dịch</h2>
            <p className="text-sm text-slate-500">Giao dịch “Chờ xác nhận” đang được đối soát tự động.</p>
          </div>
          <SearchField value={search} onChange={setSearch} placeholder="Tìm mã giao dịch, khóa học…" className="sm:w-72" />
        </div>
        {transactions.length === 0 ? (
          <Card>
            <EmptyState compact icon={<Receipt className="h-6 w-6" />} title={search ? "Không tìm thấy giao dịch" : "Chưa có giao dịch"} />
          </Card>
        ) : (
          <Card as="ul" className="divide-y divide-slate-100 overflow-hidden">
            {transactions.map(tx => {
              const course = store.courses.find(c => c.id === tx.courseId);
              const status = TX_STATUS[tx.status] || { label: tx.status, tone: "neutral" as Tone };
              const canPay = tx.status === "pending" && supportsVietQr(tx.paymentMethod);
              return (
                <li key={tx.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-900">{course?.title || "Học phí"}</p>
                    <p className="truncate text-[13px] text-slate-500">{formatDateTime(tx.createdAt)} · {tx.paymentMethod} · <span className="font-mono text-xs">{tx.id}</span></p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold text-slate-900">{formatVnd(tx.amount)}</span>
                    {canPay ? (
                      <button type="button" onClick={() => openPayment(tx)} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                        <QrCode className="h-3.5 w-3.5" /> Chờ · Mở QR
                      </button>
                    ) : (
                      <Badge tone={status.tone}>{status.label}</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
