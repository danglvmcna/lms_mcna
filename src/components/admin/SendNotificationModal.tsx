import React, { useRef, useState } from "react";
import { X, Send, Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, Users, UserCheck } from "lucide-react";
import { LMSDataStore } from "../../types";
import { api } from "../../api";
import ModalPortal from "../ModalPortal";

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: LMSDataStore;
  onSent?: () => void;
  triggerToast?: (msg: string) => void;
}

export default function SendNotificationModal({
  isOpen,
  onClose,
  store,
  onSent,
  triggerToast
}: SendNotificationModalProps) {
  const [targetType, setTargetType] = useState<"all" | "student" | "teacher" | "admin" | "specific">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [notifType, setNotifType] = useState<"info" | "success" | "warning" | "danger">("info");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the same key across retries; a changed draft gets a new key.
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const resetDraftKey = () => { idempotencyKeyRef.current = crypto.randomUUID(); };

  if (!isOpen) return null;

  const users = store.users || [];
  const filteredUsers = users.filter(u => {
    if (u.isActive === false) return false;
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const getRecipientCount = () => {
    if (targetType === "all") return users.filter(u => u.isActive !== false).length;
    if (targetType === "specific") return selectedUserId ? 1 : 0;
    return users.filter(u => u.role === targetType && u.isActive !== false).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Vui lòng nhập nội dung thông báo.");
      return;
    }
    if (targetType === "specific" && !selectedUserId) {
      setError("Vui lòng chọn người nhận thông báo.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: {
        idempotencyKey: string;
        message: string;
        type: string;
        role?: string;
        userIds?: string[];
      } = {
        idempotencyKey: idempotencyKeyRef.current,
        message: message.trim(),
        type: notifType
      };

      if (targetType === "specific") {
        payload.userIds = [selectedUserId];
      } else {
        payload.role = targetType;
      }

      const res = await api.sendAdminNotification(payload);
      const count = res?.sent ?? getRecipientCount();

      if (triggerToast) {
        triggerToast(res?.duplicate ? `Thông báo đã được gửi trước đó tới ${count} người dùng.` : `Đã gửi thông báo tới ${count} người dùng trong LMS!`);
      }

      resetDraftKey();
      setMessage("");
      setSelectedUserId("");
      setUserSearch("");
      if (onSent) onSent();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể gửi thông báo. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="mcna-overlay">
        <div className="mcna-dialog sm:max-w-lg">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-5 flex items-start gap-3.5 pr-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Bell className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold leading-snug text-slate-900">
                Gửi thông báo
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Gửi trong LMS tới người dùng đang hoạt động; thao tác này không gửi email.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-sm">
            {/* Đối tượng nhận */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center justify-between">
                <span>Đối tượng nhận thông báo</span>
                <span className="text-[11px] font-normal text-slate-500">
                  Dự kiến: <strong className="text-indigo-600 font-bold">{getRecipientCount()}</strong> người nhận
                </span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "all", label: "Tất cả mọi người", icon: Users },
                  { id: "student", label: "Tất cả Học viên", icon: UserCheck },
                  { id: "teacher", label: "Tất cả Giảng viên", icon: UserCheck },
                  { id: "admin", label: "Ban Quản trị", icon: UserCheck },
                  { id: "specific", label: "Chọn người cụ thể", icon: Bell },
                ].map(opt => {
                  const Icon = opt.icon;
                  const isSelected = targetType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        resetDraftKey();
                        setTargetType(opt.id as any);
                        if (opt.id !== "specific") setSelectedUserId("");
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/70 border-indigo-400 text-indigo-900 font-semibold shadow-2xs ring-1 ring-indigo-500/20"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chọn người cụ thể nếu targetType === 'specific' */}
            {targetType === "specific" && (
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="font-semibold text-slate-700 block">
                  Tìm và chọn tài khoản nhận
                </label>
                <input
                  type="text"
                  placeholder="Gõ tên hoặc email để lọc nhanh..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="mcna-input w-full"
                />
                <select
                  value={selectedUserId}
                  onChange={(e) => { resetDraftKey(); setSelectedUserId(e.target.value); }}
                  className="mcna-select w-full"
                  size={Math.min(5, Math.max(2, filteredUsers.length))}
                >
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id} className="py-1">
                      {u.name} ({u.email}) — [{u.role.toUpperCase()}]
                    </option>
                  ))}
                  {filteredUsers.length === 0 && (
                    <option disabled value="">Không tìm thấy người dùng nào</option>
                  )}
                </select>
              </div>
            )}

            {/* Loại thông báo */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Phân loại thông báo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "info", label: "Thông tin", color: "border-indigo-200 bg-indigo-50 text-indigo-700", icon: Info },
                  { id: "success", label: "Thành công", color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
                  { id: "warning", label: "Cảnh báo", color: "border-amber-200 bg-amber-50 text-amber-700", icon: AlertTriangle },
                  { id: "danger", label: "Quan trọng", color: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertCircle },
                ].map(t => {
                  const Icon = t.icon;
                  const isSelected = notifType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { resetDraftKey(); setNotifType(t.id as any); }}
                      className={`p-2 rounded-xl border text-center flex items-center justify-center gap-1.5 transition cursor-pointer font-medium ${
                        isSelected
                          ? `${t.color} font-bold ring-2 ring-indigo-500/30 shadow-2xs`
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nội dung thông báo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Nội dung thông báo</label>
                <span className="text-[11px] font-mono text-slate-400">{message.length} ký tự</span>
              </div>
              <textarea
                required
                maxLength={2000}
                rows={4}
                value={message}
                onChange={(e) => { resetDraftKey(); setMessage(e.target.value); }}
                placeholder="Nhập nội dung thông báo muốn gửi tới học viên hoặc giảng viên..."
                className="mcna-textarea w-full"
              />
            </div>

            {/* Action buttons */}
            <div className="flex justify-end items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="mcna-btn-ghost"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || getRecipientCount() === 0}
                className="mcna-btn-primary"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Đang gửi..." : "Gửi thông báo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
