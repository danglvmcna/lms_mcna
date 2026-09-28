import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cx, inputClass } from "../ui";

const strengthOf = (value: string) => {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return score;
};

const STRENGTH = [
  { label: "Quá ngắn", color: "bg-rose-400" },
  { label: "Yếu", color: "bg-rose-400" },
  { label: "Tạm được", color: "bg-amber-400" },
  { label: "Tốt", color: "bg-emerald-400" },
  { label: "Rất mạnh", color: "bg-emerald-500" }
];

/** Password field with a show/hide toggle and an optional strength meter for new passwords. */
export default function PasswordInput({ id, name, value, onChange, placeholder, autoComplete, required, minLength, showStrength }: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  showStrength?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const score = strengthOf(value);
  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={cx(inputClass, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map(step => (
              <span key={step} className={cx("h-1.5 flex-1 rounded-full", score >= step ? STRENGTH[score].color : "bg-slate-200")} />
            ))}
          </div>
          <span className="w-16 text-right text-xs font-medium text-slate-500">{STRENGTH[score].label}</span>
        </div>
      )}
    </div>
  );
}
