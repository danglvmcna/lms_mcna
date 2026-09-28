import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, MessageCircle, ShieldCheck } from "lucide-react";
import { Course, Transaction } from "../../types";
import { api } from "../../api";
import { formatVnd } from "../../lib/format";
import { Button, buttonClass, cx, Dialog, Illustration } from "../ui";

interface PaymentQrModalProps {
  transaction: Transaction;
  course?: Course | null;
  onClose: () => void;
  onRefreshData?: () => Promise<any> | void;
  onPaymentSuccess?: () => void;
}

const BANK_ACCOUNT_NUMBER = "099162438104";
const BANK_NAME = "MB Bank (Ngân hàng Quân Đội)";
const ACCOUNT_HOLDER = "HOC VIEN CONG NGHE MCNA";

function CopyRow({ label, value, display, copied, onCopy, emphasis }: { label: string; value: string; display?: React.ReactNode; copied: boolean; onCopy: () => void; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cx("truncate font-semibold", emphasis ? "font-mono text-base tracking-wider text-indigo-700" : "text-[15px] text-slate-900")}>{display ?? value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={cx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold", copied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}

export default function PaymentQrModal({ transaction, course, onClose, onRefreshData, onPaymentSuccess }: PaymentQrModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(transaction.status === "approved");
  const [isRejected, setIsRejected] = useState<boolean>(transaction.status === "rejected");
  const [requiresManualReview, setRequiresManualReview] = useState(false);
  const [statusCheckFailed, setStatusCheckFailed] = useState(false);
  const [qrImgError, setQrImgError] = useState<boolean>(false);

  // Clean hex identifiers keep the memo in the format SePay parses.
  const studentHex = (transaction.studentId || "").replace(/^[^a-f0-9]*/i, "").substring(0, 6).toUpperCase() || "MCNA01";
  const txHex = (transaction.id || "").replace(/^[^a-f0-9]*/i, "").substring(0, 6).toUpperCase() || "ORDER1";
  const memoText = `MCNA ${studentHex} ${txHex}`;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Poll only this learner's order, never the full LMS store.
  const onRefreshDataRef = useRef(onRefreshData);
  onRefreshDataRef.current = onRefreshData;

  useEffect(() => {
    if (isSuccess || isRejected) return;
    let isMounted = true;
    let inFlight = false;
    const checkPaymentStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const tx = await api.getMyTransactionStatus(transaction.id);
        if (isMounted) setStatusCheckFailed(false);
        if (tx.status === "approved" && isMounted) {
          setIsSuccess(true);
          if (onRefreshDataRef.current) await onRefreshDataRef.current();
        } else if (tx.status === "rejected" && isMounted) {
          setIsRejected(true);
        } else if (tx.requiresManualReview && isMounted) {
          setRequiresManualReview(true);
        }
      } catch {
        if (isMounted) setStatusCheckFailed(true);
      } finally {
        inFlight = false;
      }
    };
    void checkPaymentStatus();
    const poller = setInterval(checkPaymentStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(poller);
    };
  }, [isSuccess, isRejected, transaction.id]);

  const vietQrUrl = `https://img.vietqr.io/image/MB-${BANK_ACCOUNT_NUMBER}-compact2.png?amount=${transaction.amount}&addInfo=${encodeURIComponent(memoText)}&accountName=${encodeURIComponent(ACCOUNT_HOLDER)}`;

  if (isSuccess) {
    return (
      <Dialog onClose={onClose} size="sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <Illustration name="celebrate" eager className="h-40 w-40" fallback={<span className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-10 w-10" /></span>} />
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Thanh toán thành công!</h2>
            <p className="text-[15px] leading-relaxed text-slate-600">
              Học phí cho <strong className="font-semibold text-slate-900">{course?.title || "khóa học"}</strong> đã được xác nhận tự động.
            </p>
          </div>
          <div className="w-full divide-y divide-slate-100 rounded-2xl bg-canvas text-left text-sm">
            <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Số tiền</span><span className="font-semibold text-slate-900">{formatVnd(transaction.amount)}</span></div>
            <div className="flex justify-between px-4 py-3"><span className="text-slate-500">Mã đơn</span><span className="font-mono text-xs font-semibold text-slate-900">{transaction.id}</span></div>
          </div>
          <Button block size="lg" onClick={() => { onPaymentSuccess?.(); onClose(); }}>Vào lớp học</Button>
        </div>
      </Dialog>
    );
  }

  if (isRejected || requiresManualReview) {
    return (
      <Dialog onClose={onClose} size="sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600"><AlertTriangle className="h-8 w-8" /></span>
          <h2 className="text-xl font-bold text-slate-900">{isRejected ? "Đơn thanh toán đã bị từ chối" : "Khoản thanh toán cần đối soát"}</h2>
          <p className="text-[15px] leading-relaxed text-slate-600">
            {isRejected
              ? "Vui lòng liên hệ MCNA để kiểm tra trước khi chuyển khoản."
              : "MCNA đã nhận khoản chuyển nhưng chưa đủ học phí, nên lớp chưa được mở. Hãy liên hệ MCNA để đối soát hoặc hoàn tiền; đừng chuyển thêm theo đơn này."}
          </p>
          <div className="flex w-full flex-col gap-2">
            <a href="https://zalo.me/0939866825" target="_blank" rel="noreferrer" className={buttonClass({ block: true, size: "lg" })}><MessageCircle className="h-5 w-5" /> Nhắn MCNA qua Zalo</a>
            <Button block variant="ghost" onClick={onClose}>Đóng</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={onClose} size="md" title="Thanh toán học phí" description={course?.title || "Khóa học MCNA"}>
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-canvas p-5">
          <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-card">
            {qrImgError ? (
              <p className="flex flex-col items-center gap-2 px-4 text-center text-sm text-amber-800"><AlertTriangle className="h-6 w-6" /> Không tải được mã QR. Hãy nhập thông tin chuyển khoản bên dưới.</p>
            ) : (
              <img src={vietQrUrl} alt="Mã VietQR thanh toán học phí MCNA" className="h-full w-full object-contain" onError={() => setQrImgError(true)} />
            )}
          </div>
          <p className="font-display text-3xl font-bold tracking-tight text-slate-900">{formatVnd(transaction.amount)}</p>
          <p className="text-center text-sm text-slate-500">Mở app ngân hàng và quét mã. Số tiền và nội dung sẽ được điền sẵn.</p>
        </div>

        <div className={cx("flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium", statusCheckFailed ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")} aria-live="polite">
          <span className="relative flex h-2 w-2">
            {!statusCheckFailed && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={cx("relative inline-flex h-2 w-2 rounded-full", statusCheckFailed ? "bg-amber-500" : "bg-emerald-500")} />
          </span>
          {statusCheckFailed ? "Chưa kiểm tra được trạng thái, đang thử lại…" : "Đang chờ xác nhận. Lớp sẽ mở tự động khi nhận đủ học phí."}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">Hoặc chuyển khoản thủ công</p>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-200/80">
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500">Ngân hàng</p>
              <p className="text-[15px] font-semibold text-slate-900">{BANK_NAME}</p>
            </div>
            <CopyRow label="Số tài khoản" value={BANK_ACCOUNT_NUMBER} copied={copiedField === "account"} onCopy={() => copyToClipboard(BANK_ACCOUNT_NUMBER, "account")} emphasis />
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500">Chủ tài khoản</p>
              <p className="text-[15px] font-semibold text-slate-900">{ACCOUNT_HOLDER}</p>
            </div>
            <CopyRow label="Số tiền" value={String(transaction.amount)} display={formatVnd(transaction.amount)} copied={copiedField === "amount"} onCopy={() => copyToClipboard(String(transaction.amount), "amount")} />
            <div className="bg-amber-50/70">
              <CopyRow label="Nội dung chuyển khoản (ghi chính xác)" value={memoText} copied={copiedField === "memo"} onCopy={() => copyToClipboard(memoText, "memo")} emphasis />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a href="https://zalo.me/0939866825" target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", block: true })}>
            <MessageCircle className="h-4 w-4 text-blue-600" /> Cần hỗ trợ?
          </a>
          <Button block variant="ghost" onClick={onClose}>Để sau</Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Mã đơn {transaction.id}</p>
      </div>
    </Dialog>
  );
}
