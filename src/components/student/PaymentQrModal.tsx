import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Copy, 
  Check, 
  CreditCard, 
  Phone, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import ModalPortal from "../ModalPortal";
import { Course, Transaction } from "../../types";
import { api } from "../../api";

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

export default function PaymentQrModal({
  transaction,
  course,
  onClose,
  onRefreshData,
  onPaymentSuccess
}: PaymentQrModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(transaction.status === "approved");
  const [isRejected, setIsRejected] = useState<boolean>(transaction.status === "rejected");
  const [requiresManualReview, setRequiresManualReview] = useState(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [statusCheckFailed, setStatusCheckFailed] = useState(false);
  const [qrImgError, setQrImgError] = useState<boolean>(false);

  // Extract clean hex identifiers for standardized SePay memo parsing
  const studentHex = (transaction.studentId || "").replace(/^[^a-f0-9]*/i, "").substring(0, 6).toUpperCase() || "MCNA01";
  const txHex = (transaction.id || "").replace(/^[^a-f0-9]*/i, "").substring(0, 6).toUpperCase() || "ORDER1";
  const memoText = `MCNA ${studentHex} ${txHex}`;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
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
        setIsChecking(true);
        const tx = await api.getMyTransactionStatus(transaction.id);
        if (isMounted) setStatusCheckFailed(false);
        if (tx.status === "approved" && isMounted) {
          setIsSuccess(true);
          if (onRefreshDataRef.current) {
            await onRefreshDataRef.current();
          }
        } else if (tx.status === "rejected" && isMounted) {
          setIsRejected(true);
        } else if (tx.requiresManualReview && isMounted) {
          setRequiresManualReview(true);
        }
      } catch {
        if (isMounted) setStatusCheckFailed(true);
      } finally {
        inFlight = false;
        if (isMounted) setIsChecking(false);
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

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-6 md:pt-12 overflow-y-auto">
        <div 
          className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-900"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Success State */}
          {isSuccess ? (
            <div className="py-6 space-y-6 text-center animate-in zoom-in-90 duration-300">
              <div className="w-16 h-16 bg-emerald-100 border-2 border-emerald-400 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-full font-mono">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  XÁC NHẬN TỰ ĐỘNG THÀNH CÔNG
                </div>
                <h3 className="text-xl font-display font-extrabold text-slate-900">
                  Thanh Toán Học Phí Hoàn Tất!
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Giao dịch học phí cho khóa học <strong className="text-slate-900 font-semibold">{course?.title || "đã đăng ký"}</strong> đã được hệ thống SePay ghi nhận tự động.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2 text-left">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Mã đơn hàng:</span>
                  <span className="font-mono font-bold text-slate-900">{transaction.id}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Số tiền thanh toán:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {new Intl.NumberFormat("vi-VN").format(transaction.amount)} VND
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Trạng thái:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Đã kích hoạt học phí
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onPaymentSuccess) onPaymentSuccess();
                  onClose();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition cursor-pointer shadow-md shadow-emerald-600/20 uppercase tracking-wider font-display"
              >
                Vào Không Gian Học Tập Ngay
              </button>
            </div>
          ) : isRejected || requiresManualReview ? (
            <div className="py-8 space-y-4 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
              <h3 className="text-lg font-bold">{isRejected ? "Đơn thanh toán đã bị từ chối" : "Khoản thanh toán cần đối soát"}</h3>
              <p className="text-sm text-slate-600">{isRejected ? "Vui lòng liên hệ MCNA để kiểm tra trước khi chuyển khoản." : "MCNA đã ghi nhận khoản chuyển chưa đủ học phí. Đơn chưa được kích hoạt. Vui lòng liên hệ MCNA để đối soát hoặc hoàn tiền; không chuyển thêm theo đơn này."}</p>
              <a href="https://zalo.me/0939866825" target="_blank" rel="noreferrer" className="inline-flex px-5 py-2 bg-blue-600 text-white rounded-xl">Liên hệ MCNA</a>
              <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-900 text-white rounded-xl">Đóng</button>
            </div>
          ) : (
            /* Active QR State */
            <>
              {/* Header Title */}
              <div className="flex items-center gap-3 pr-8">
                <div className="w-11 h-11 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-display font-bold text-slate-900 tracking-tight uppercase">
                    Thanh Toán Học Phí VietQR
                  </h4>
                  <span className="text-[11px] text-slate-500 block font-mono">
                    Mã đơn hàng: <strong className="text-indigo-600">{transaction.id}</strong>
                  </span>
                </div>
              </div>

              {/* QR Code Graphic with Poller Status */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-gradient-to-b from-white to-slate-50/50 rounded-2xl border border-slate-200 mx-auto w-52 h-52 relative shadow-xs">
                {qrImgError ? (
                  <p className="text-center text-xs text-amber-800 flex flex-col items-center gap-2"><AlertTriangle className="h-6 w-6" />Không tải được VietQR. Vui lòng nhập chính xác thông tin chuyển khoản bên dưới hoặc liên hệ MCNA.</p>
                ) : (
                  <img src={vietQrUrl} alt="VietQR MCNA" className="w-44 h-44 object-contain rounded-lg" onError={() => setQrImgError(true)} />
                )}
              </div>

              {/* Auto-activation live poller badge */}
              <div className={`flex items-center justify-center gap-2 text-[11px] font-medium py-2 px-3 rounded-xl border ${statusCheckFailed ? "text-amber-800 bg-amber-50 border-amber-200" : "text-slate-600 bg-slate-50 border-slate-200/80"}`}>
                <span className="relative flex h-2 w-2">
                  {!statusCheckFailed && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${statusCheckFailed ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                </span>
                <span>
                  {statusCheckFailed ? "Chưa kiểm tra được trạng thái đơn; hệ thống sẽ thử lại." : isChecking ? "Đang kiểm tra trạng thái đơn..." : "Đang chờ xác nhận đủ học phí từ SePay"}
                </span>
              </div>

              {/* Bank Details Table */}
              <div className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl space-y-2.5 text-xs font-sans">
                <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
                  <span className="text-slate-500">Khóa học:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[220px] text-right">
                    {course?.title || "Khóa học MCNA"}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
                  <span className="text-slate-500">Số tiền cần chuyển:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-600 font-mono text-sm">
                      {new Intl.NumberFormat("vi-VN").format(transaction.amount)} VND
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(transaction.amount), "amount")}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs font-semibold"
                    >
                      {copiedField === "amount" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "amount" ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-bold text-slate-900">{BANK_NAME}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700 font-mono tracking-wider text-sm">
                      {BANK_ACCOUNT_NUMBER}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(BANK_ACCOUNT_NUMBER, "account")}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs font-semibold"
                    >
                      {copiedField === "account" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "account" ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-bold text-slate-900 uppercase text-[11px] font-mono">
                    {ACCOUNT_HOLDER}
                  </span>
                </div>

                {/* Memo with prominent copy button */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-bold text-xs">
                      Nội dung chuyển khoản (bắt buộc chính xác):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(memoText, "memo")}
                      className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[10px] text-indigo-700 flex items-center gap-1 cursor-pointer transition shadow-2xs font-bold"
                    >
                      {copiedField === "memo" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "memo" ? "Đã chép mã" : "Sao chép"}
                    </button>
                  </div>
                  <div className="p-2.5 bg-amber-50 text-amber-950 font-mono text-center rounded-xl border border-amber-200 select-all font-bold tracking-widest text-sm shadow-2xs">
                    {memoText}
                  </div>
                  <p className="text-[10px] text-slate-400 italic text-center">
                    *Mẹo: Mở app ngân hàng quét mã QR ở trên để tự động điền đúng số tiền và nội dung.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href="https://zalo.me/0939866825"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-center text-xs shadow-xs"
                >
                  <Phone className="h-3.5 w-3.5" /> Hỗ trợ kích hoạt nhanh
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer text-center text-xs"
                >
                  Đóng hướng dẫn
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
