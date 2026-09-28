import React, { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { getCsrfToken } from "../../api";
import { User } from "../../types";
import { formatDate, roleLabel } from "../../lib/format";
import { Avatar, Badge, Button, Callout, Dialog, Field, inputClass } from "../ui";
import PasswordInput from "./PasswordInput";

export function ProfileDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Email", user.email],
    ["Số điện thoại", user.phone || "Chưa cập nhật"],
    ...(user.schoolEmail ? [["Email học viện", user.schoolEmail] as [string, React.ReactNode]] : []),
    ...(user.linkedStudentId ? [["Mã học viên", user.linkedStudentId] as [string, React.ReactNode]] : []),
    ["Tham gia từ", formatDate(user.createdAt, "Chưa xác định")]
  ];
  return (
    <Dialog onClose={onClose} size="md">
      <div className="flex flex-col items-center gap-3 pb-6 pt-2 text-center">
        <Avatar name={user.name} size={72} />
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
          <Badge tone="primary">{roleLabel(user.role)}</Badge>
        </div>
      </div>
      <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-slate-50">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3.5 text-[15px]">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-center text-[13px] leading-relaxed text-slate-500">Cần thay đổi thông tin? Liên hệ MCNA qua Zalo 0939 866 825.</p>
    </Dialog>
  );
}

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
    if (newPassword !== confirmPassword) return setError("Hai mật khẩu mới chưa khớp nhau.");
    setSaving(true);
    try {
      const csrfToken = getCsrfToken() || sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
      const response = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken || "" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Chưa đổi được mật khẩu. Vui lòng thử lại.");
        return;
      }
      setDone(true);
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Dialog onClose={onClose} size="sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></span>
          <h2 className="text-lg font-bold text-slate-900">Đã đổi mật khẩu</h2>
          <p className="text-sm text-slate-500">Lần đăng nhập sau, hãy dùng mật khẩu mới nhé.</p>
          <Button block className="mt-3" onClick={onClose}>Xong</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={onClose} size="sm" icon={<KeyRound className="h-5 w-5" />} title="Đổi mật khẩu" description="Dùng ít nhất 8 ký tự. Mật khẩu dài và khó đoán sẽ an toàn hơn." dismissible={!currentPassword && !newPassword}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Mật khẩu hiện tại" htmlFor="cp-current">
          <PasswordInput id="cp-current" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" required />
        </Field>
        <Field label="Mật khẩu mới" htmlFor="cp-new">
          <PasswordInput id="cp-new" value={newPassword} onChange={setNewPassword} autoComplete="new-password" required minLength={8} showStrength />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="cp-confirm">
          <input id="cp-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required className={inputClass} />
        </Field>
        <Button type="submit" block size="lg" loading={saving}>Lưu mật khẩu mới</Button>
      </form>
    </Dialog>
  );
}
