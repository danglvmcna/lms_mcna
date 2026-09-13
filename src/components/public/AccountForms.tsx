import React, { useState } from "react";
import { CheckCircle, Lock, LogOut } from "lucide-react";
import { EnrollIntent } from "../../enrollIntent";
import { User } from "../../types";

const inputClass = "w-full px-3.5 py-2.5 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 placeholder-white/25 h-10";
const primaryButtonClass = "w-full py-2.5 bg-white text-indigo-950 hover:bg-white/95 disabled:opacity-60 text-xs font-bold rounded-xl transition cursor-pointer shadow-lg tracking-wider uppercase font-display";
const secondaryButtonClass = "w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-bold rounded-xl transition cursor-pointer";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function ErrorBox({ message }: { message: string }) {
  return <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs">{message}</div>;
}

interface SignUpFormProps {
  intent: EnrollIntent | null;
  onGoToLogin: (email?: string) => void;
}

/** Self sign-up with a personal email; the server emails a temporary password. */
export function SignUpForm({ intent, onGoToLogin }: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; email: string; devTemporaryPassword?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Vui lòng nhập họ và tên.");
    if (!/^[0-9+\s.()-]{8,20}$/.test(phone.trim())) return setError("Số điện thoại không hợp lệ.");

    setSubmitting(true);
    try {
      const { ok, status, data } = await postJson("/api/auth/register", { name: name.trim(), email: email.trim(), phone: phone.trim() });
      if (!ok) {
        setError(
          status === 400 && data.issues
            ? "Vui lòng kiểm tra lại họ tên, email và số điện thoại."
            : data.error || "Không thể tạo tài khoản lúc này."
        );
        return;
      }
      setResult({ message: data.message, email: email.trim().toLowerCase(), devTemporaryPassword: data.devTemporaryPassword });
    } catch {
      setError("Dịch vụ đăng ký chưa sẵn sàng. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4 text-xs font-sans">
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle className="h-4 w-4 shrink-0" /> Đã gửi yêu cầu tạo tài khoản
          </div>
          <p className="leading-relaxed">{result.message}</p>
          <p className="leading-relaxed">
            Đăng nhập bằng <strong className="font-mono">{result.email}</strong> và mật khẩu tạm trong email. Bạn sẽ được yêu cầu đổi mật khẩu ngay sau đó
            {intent ? ", rồi hệ thống tự gửi đăng ký lớp bạn đã chọn." : "."}
          </p>
          {result.devTemporaryPassword && (
            <p className="font-mono bg-black/30 rounded-lg px-2.5 py-1.5 text-amber-200">
              Môi trường thử nghiệm – mật khẩu tạm: {result.devTemporaryPassword}
            </p>
          )}
        </div>
        <button type="button" onClick={() => onGoToLogin(result.email)} className={primaryButtonClass}>
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
      {error && <ErrorBox message={error} />}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-white/70 block">Họ và tên</label>
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" className={inputClass} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-white/70 block">Email cá nhân</label>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@gmail.com" autoComplete="email" className={inputClass} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-white/70 block">Số điện thoại</label>
        <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912 345 678" autoComplete="tel" className={inputClass} />
      </div>
      <p className="text-[11px] text-white/45 leading-relaxed">
        Mật khẩu tạm thời sẽ được gửi tới email trên. Thông tin liên hệ được chuyển tới bộ phận tư vấn của MCNA để hỗ trợ bạn đăng ký học.
      </p>
      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
      </button>
      <button type="button" onClick={() => onGoToLogin()} className={secondaryButtonClass}>
        Đã có tài khoản? Đăng nhập
      </button>
    </form>
  );
}

/** Public "forgot password": always answers with the same message to avoid revealing which emails exist. */
export function ForgotPasswordForm({ onGoToLogin }: { onGoToLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { ok, data } = await postJson("/api/auth/forgot-password", { email: email.trim() });
      if (!ok) {
        setError(data.error || "Không thể gửi yêu cầu lúc này.");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
      {error && <ErrorBox message={error} />}
      {message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-3 rounded-xl leading-relaxed">{message}</div>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70 block">Email đăng nhập</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@gmail.com" autoComplete="email" className={inputClass} />
          </div>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>
            {submitting ? "Đang gửi..." : "Gửi liên kết đặt lại mật khẩu"}
          </button>
        </>
      )}
      <button type="button" onClick={onGoToLogin} className={secondaryButtonClass}>
        Quay lại đăng nhập
      </button>
    </form>
  );
}

interface ForcedPasswordChangeProps {
  user: User;
  onChanged: () => Promise<void> | void;
  onLogout: () => void;
}

/** Blocks the app until an account created with a temporary password sets its own password. */
export function ForcedPasswordChange({ user, onChanged, onLogout }: ForcedPasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
    if (newPassword !== confirmPassword) return setError("Xác nhận mật khẩu mới không trùng khớp.");
    if (newPassword === currentPassword) return setError("Mật khẩu mới phải khác mật khẩu tạm thời.");

    setSubmitting(true);
    try {
      const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf") || "";
      const response = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Không thể đổi mật khẩu.");
        return;
      }
      await onChanged();
    } catch {
      setError("Dịch vụ xác thực không phản hồi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 relative z-20">
      <div className="bg-slate-900 border border-white/15 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl text-left">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h4 className="font-display font-black text-white text-base leading-tight uppercase tracking-widest">Đặt mật khẩu mới</h4>
            <p className="text-[11px] text-white/50 mt-1 truncate">{user.email}</p>
          </div>
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          Bạn đang dùng mật khẩu tạm thời được gửi qua email. Hãy đặt mật khẩu của riêng bạn để tiếp tục sử dụng LMS.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {error && <ErrorBox message={error} />}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70 block">Mật khẩu tạm thời (trong email)</label>
            <input required type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70 block">Mật khẩu mới</label>
            <input required type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/70 block">Nhập lại mật khẩu mới</label>
            <input required type="password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
          </div>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>
            {submitting ? "Đang lưu..." : "Lưu mật khẩu và tiếp tục"}
          </button>
          <button type="button" onClick={onLogout} className={`${secondaryButtonClass} inline-flex items-center justify-center gap-1.5`}>
            <LogOut className="h-3.5 w-3.5" /> Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
