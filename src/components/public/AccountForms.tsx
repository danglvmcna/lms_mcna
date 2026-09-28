import React, { useState } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, LogOut, Mail, X } from "lucide-react";
import { EnrollIntent } from "../../enrollIntent";
import { User } from "../../types";
import { Button, Callout, Field, Illustration, inputClass } from "../ui";
import AuthLayout, { StepIndicator } from "./AuthLayout";
import PasswordInput from "../account/PasswordInput";

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

/** Reminds a visitor which class they picked in the catalog while they sign in or sign up. */
export function IntentBanner({ intent, onClear }: { intent: EnrollIntent; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 pr-2 shadow-card ring-1 ring-slate-200/70">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <GraduationCap className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">Lớp bạn đã chọn</p>
        <p className="truncate text-sm font-semibold text-slate-900">
          {intent.courseTitle || "Khóa học đã chọn"}{intent.sectionCode ? ` · ${intent.sectionCode}` : ""}
        </p>
      </div>
      <button type="button" onClick={onClear} aria-label="Bỏ chọn lớp" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ Sign in */

export function LoginScreen({ initialEmail = "", intent, onClearIntent, onLoggedIn, onRegister, onForgot, onBackToCourses }: {
  initialEmail?: string;
  intent: EnrollIntent | null;
  onClearIntent: () => void;
  onLoggedIn: (data: { user: User; csrfToken?: string }) => Promise<void> | void;
  onRegister: () => void;
  onForgot: () => void;
  onBackToCourses: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSessionConflict(false);
    setSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const { ok, data } = await postJson("/api/auth/login", {
        email: String(formData.get("email") || email).trim().toLowerCase(),
        password: String(formData.get("password") || password)
      });
      if (!ok) {
        if (data.code === "SESSION_CONFLICT") setSessionConflict(true);
        setError(data.error || "Email hoặc mật khẩu chưa đúng.");
        return;
      }
      await onLoggedIn(data);
    } catch {
      setError("Chưa kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOutOtherSession = async () => {
    await fetch("/api/auth/force-logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setError(null);
    setSessionConflict(false);
  };

  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để vào lớp học và tiếp tục bài đang học."
      onBackToCourses={onBackToCourses}
      top={intent ? <IntentBanner intent={intent} onClear={onClearIntent} /> : undefined}
    >
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <Callout
            tone="danger"
            title={error}
            action={sessionConflict ? <Button size="sm" variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={signOutOtherSession}>Đăng xuất phiên cũ</Button> : undefined}
          />
        )}
        <Field label="Email" htmlFor="login-email">
          <input id="login-email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="ban@gmail.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-[13px] font-semibold text-slate-700">Mật khẩu</label>
            <button type="button" onClick={onForgot} className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">Quên mật khẩu?</button>
          </div>
          <PasswordInput id="login-password" name="password" value={password} onChange={setPassword} autoComplete="current-password" required placeholder="Mật khẩu của bạn" />
        </div>
        <Button type="submit" block size="lg" loading={submitting}>Đăng nhập</Button>
      </form>
      <div className="mt-8 rounded-2xl bg-white p-4 text-center shadow-card ring-1 ring-slate-200/70">
        <p className="text-sm text-slate-600">Lần đầu đến với MCNA?</p>
        <button type="button" onClick={onRegister} className="mt-1 inline-flex items-center gap-1 text-[15px] font-semibold text-indigo-600 hover:text-indigo-700">
          Tạo tài khoản miễn phí <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ Sign up */

export function SignUpScreen({ intent, onClearIntent, onGoToLogin, onBackToCourses }: {
  intent: EnrollIntent | null;
  onClearIntent: () => void;
  onGoToLogin: (email?: string) => void;
  onBackToCourses: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; email: string; devTemporaryPassword?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Bạn nhập giúp họ và tên nhé.");
    if (!/^[0-9+\s.()-]{8,20}$/.test(phone.trim())) return setError("Số điện thoại chưa đúng định dạng.");

    setSubmitting(true);
    try {
      const { ok, status, data } = await postJson("/api/auth/register", { name: name.trim(), email: email.trim(), phone: phone.trim() });
      if (!ok) {
        setError(status === 400 && data.issues ? "Vui lòng kiểm tra lại họ tên, email và số điện thoại." : data.error || "Chưa tạo được tài khoản lúc này.");
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
      <AuthLayout title="Kiểm tra hộp thư của bạn" top={<StepIndicator current={2} />}>
        <div className="space-y-6">
          <Illustration name="mail" className="h-36 w-36" fallback={<span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Mail className="h-7 w-7" /></span>} />
          <p className="text-[15px] leading-relaxed text-slate-600">
            Chúng tôi đã gửi <strong className="font-semibold text-slate-900">mật khẩu tạm</strong> tới <strong className="font-semibold text-slate-900">{result.email}</strong>. Dùng nó để đăng nhập, sau đó bạn sẽ đặt mật khẩu của riêng mình.
          </p>
          <ul className="space-y-2.5 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-card ring-1 ring-slate-200/70">
            <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Không thấy email? Xem thử mục Spam hoặc Quảng cáo.</li>
            <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{intent ? "Sau khi đặt mật khẩu, MCNA sẽ tự gửi đăng ký lớp bạn đã chọn." : "Email có thể mất một vài phút để tới."}</li>
          </ul>
          {result.devTemporaryPassword && (
            <Callout tone="warning" title="Môi trường thử nghiệm">
              Mật khẩu tạm: <code className="font-mono font-semibold">{result.devTemporaryPassword}</code>
            </Callout>
          )}
          <Button block size="lg" onClick={() => onGoToLogin(result.email)} iconRight={<ArrowRight className="h-4 w-4" />}>Tôi đã có mật khẩu, đăng nhập</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Tạo tài khoản học viên"
      subtitle="Chỉ mất một phút. Mật khẩu tạm sẽ được gửi tới email của bạn."
      onBackToCourses={onBackToCourses}
      top={
        <div className="space-y-4">
          <StepIndicator current={1} />
          {intent && <IntentBanner intent={intent} onClear={onClearIntent} />}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Họ và tên" htmlFor="su-name">
          <input id="su-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Minh An" autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="su-email" hint="Dùng email bạn (hoặc phụ huynh) kiểm tra thường xuyên.">
          <input id="su-email" required type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@gmail.com" autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Số điện thoại" htmlFor="su-phone">
          <input id="su-phone" required type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912 345 678" autoComplete="tel" className={inputClass} />
        </Field>
        <Button type="submit" block size="lg" loading={submitting}>Tạo tài khoản</Button>
        <p className="text-center text-[13px] leading-relaxed text-slate-500">
          Thông tin liên hệ được gửi tới bộ phận tư vấn MCNA để hỗ trợ bạn chọn lớp phù hợp.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Đã có tài khoản?{" "}
        <button type="button" onClick={() => onGoToLogin()} className="font-semibold text-indigo-600 hover:text-indigo-700">Đăng nhập</button>
      </p>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ Forgot password */

export function ForgotPasswordScreen({ onGoToLogin }: { onGoToLogin: () => void }) {
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
        setError(data.error || "Chưa gửi được yêu cầu lúc này.");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  if (message) {
    return (
      <AuthLayout title="Đã gửi liên kết">
        <div className="space-y-6">
          <Illustration name="mail" className="h-36 w-36" fallback={<span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Mail className="h-7 w-7" /></span>} />
          <p className="text-[15px] leading-relaxed text-slate-600">{message}</p>
          <Button block size="lg" variant="secondary" onClick={onGoToLogin}>Quay lại đăng nhập</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Quên mật khẩu?" subtitle="Nhập email đăng nhập, chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu." top={<Illustration name="lock" className="h-28 w-28" />}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Email" htmlFor="fp-email">
          <input id="fp-email" required type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@gmail.com" autoComplete="email" className={inputClass} />
        </Field>
        <Button type="submit" block size="lg" loading={submitting}>Gửi liên kết đặt lại</Button>
        <Button block size="lg" variant="ghost" onClick={onGoToLogin}>Quay lại đăng nhập</Button>
      </form>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ Reset password (link from email) */

export function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
    if (password !== confirm) return setError("Hai mật khẩu chưa khớp nhau.");
    setSubmitting(true);
    try {
      const { ok, data } = await postJson("/api/auth/reset-password/complete", { token, newPassword: password });
      if (!ok) {
        setError(data.error || "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.");
        return;
      }
      setMessage(data.message || "Mật khẩu đã được đặt lại thành công.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      setError("Dịch vụ đặt lại mật khẩu chưa sẵn sàng.");
    } finally {
      setSubmitting(false);
    }
  };

  if (message) {
    return (
      <AuthLayout title="Xong rồi!">
        <div className="space-y-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
          <p className="text-[15px] leading-relaxed text-slate-600">{message}</p>
          <Button block size="lg" onClick={onDone}>Đăng nhập với mật khẩu mới</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đặt lại mật khẩu" subtitle="Chọn một mật khẩu mới cho tài khoản của bạn.">
      <form onSubmit={submit} className="space-y-5">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Mật khẩu mới" htmlFor="rp-new">
          <PasswordInput id="rp-new" name="newPassword" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" showStrength />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="rp-confirm">
          <input id="rp-confirm" name="confirmNewPassword" type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className={inputClass} />
        </Field>
        <Button type="submit" block size="lg" loading={submitting}>Lưu mật khẩu</Button>
        <Button block size="lg" variant="ghost" onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); onDone(); }}>Quay lại đăng nhập</Button>
      </form>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ Forced password change (first login) */

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
    if (newPassword.length < 8) return setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
    if (newPassword !== confirmPassword) return setError("Hai mật khẩu mới chưa khớp nhau.");
    if (newPassword === currentPassword) return setError("Mật khẩu mới cần khác mật khẩu tạm.");

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
    <AuthLayout
      title="Đặt mật khẩu của riêng bạn"
      subtitle={<>Bạn đang đăng nhập bằng mật khẩu tạm cho <strong className="font-semibold text-slate-700">{user.email}</strong>. Bước cuối cùng thôi!</>}
      top={<StepIndicator current={3} />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Mật khẩu tạm (trong email)" htmlFor="fc-current">
          <PasswordInput id="fc-current" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" required />
        </Field>
        <Field label="Mật khẩu mới" htmlFor="fc-new">
          <PasswordInput id="fc-new" value={newPassword} onChange={setNewPassword} minLength={8} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" required showStrength />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="fc-confirm">
          <input id="fc-confirm" required type="password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
        </Field>
        <Button type="submit" block size="lg" loading={submitting}>Lưu và bắt đầu học</Button>
        <Button block size="lg" variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={onLogout}>Đăng xuất</Button>
      </form>
    </AuthLayout>
  );
}
