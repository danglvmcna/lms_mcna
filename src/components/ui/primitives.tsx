import React from "react";
import { Loader2, Search, X } from "lucide-react";

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Buttons */

export type ButtonVariant = "primary" | "secondary" | "tinted" | "ghost" | "danger" | "dark" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white shadow-primary hover:bg-indigo-700",
  secondary: "bg-white text-slate-900 ring-1 ring-inset ring-slate-200 shadow-card hover:bg-slate-50 hover:ring-slate-300",
  tinted: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  ghost: "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900",
  danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  dark: "bg-slate-900 text-white hover:bg-slate-800",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2"
};

export function buttonClass({ variant = "primary", size = "md", block = false, className }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cx(
    "inline-flex select-none items-center justify-center rounded-full font-semibold whitespace-nowrap active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, icon, iconRight, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass({ variant, size, block, className })} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/5 hover:text-slate-900 active:scale-95", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Surfaces */

export function Card({ className, interactive, as: Tag = "div", ...rest }: React.HTMLAttributes<HTMLElement> & { interactive?: boolean; as?: React.ElementType; type?: "button" | "submit" }) {
  return (
    <Tag
      className={cx(
        "rounded-[1.25rem] border border-slate-200/70 bg-white shadow-card",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-raised",
        className
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ Status */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "violet";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  primary: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
  violet: "bg-violet-50 text-violet-700"
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-slate-400",
  primary: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  violet: "bg-violet-500"
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none", TONES[tone], className)}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Inputs */

export function SearchField({ value, onChange, placeholder, className, autoFocus }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <label className={cx("relative block", className)}>
      <span className="sr-only">{placeholder || "Tìm kiếm"}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-10 text-[15px] text-slate-900 shadow-card placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onChange("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}

export function Field({ label, hint, error, htmlFor, children, className }: { label: string; hint?: React.ReactNode; error?: string | null; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700">{label}</label>
      {children}
      {error ? <p className="text-[13px] text-rose-600">{error}</p> : hint ? <p className="text-[13px] leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50";

/* ------------------------------------------------------------------ Segmented control */

export function Segmented<const T extends string>({ value, onChange, options, className, size = "md" }: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-full bg-slate-900/[0.05] p-1", className)}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold",
              size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
              selected ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className={cx("rounded-full px-1.5 text-[11px] leading-5", selected ? "bg-indigo-600 text-white" : "bg-slate-900/10 text-slate-600")}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Loading */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-slate-200/60", className)} />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ Callout */

export function Callout({ tone = "info", icon, title, children, action, className }: { tone?: "info" | "success" | "warning" | "danger"; icon?: React.ReactNode; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const toneClass = {
    info: "bg-indigo-50/70 text-indigo-900",
    success: "bg-emerald-50 text-emerald-900",
    warning: "bg-amber-50 text-amber-900",
    danger: "bg-rose-50 text-rose-900"
  }[tone];
  return (
    <div className={cx("flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center", toneClass, className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0 space-y-0.5 text-sm leading-relaxed">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className="opacity-90">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
