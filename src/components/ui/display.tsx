import React, { useId, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Cloud,
  Code2,
  Cpu,
  Database,
  Gamepad2,
  Globe,
  type LucideIcon,
  Palette,
  Server,
  ShieldCheck,
  Smartphone,
  TrendingUp
} from "lucide-react";
import { cx } from "./primitives";
import { initials } from "../../lib/format";
import { Illustration, IllustrationName } from "./brand";

/* ------------------------------------------------------------------ Avatar */

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700"
];

const hash = (value: string) => Array.from(value).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const tone = AVATAR_TONES[hash(name || "?") % AVATAR_TONES.length];
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ Progress */

export function ProgressRing({ value, size = 56, stroke = 6, children, className }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; className?: string }) {
  const id = useId();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cx("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="60%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#22b8d8" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef0f6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children ?? <span className="text-xs font-bold text-slate-900">{Math.round(clamped)}%</span>}</span>
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${clamped}%`, transition: "width 700ms cubic-bezier(0.32,0.72,0,1)" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Course cover */

const COVER_THEMES: Array<{ match: RegExp; icon: LucideIcon; gradient: string }> = [
  { match: /data|dữ liệu|analytics|phân tích|sql|big data/i, icon: Database, gradient: "from-sky-500 via-cyan-500 to-teal-400" },
  { match: /\bai\b|artificial|trí tuệ|machine|nlp|học máy/i, icon: Brain, gradient: "from-violet-600 via-fuchsia-500 to-pink-400" },
  { match: /web|frontend|front-end|fullstack|full-stack/i, icon: Globe, gradient: "from-indigo-600 via-violet-500 to-sky-400" },
  { match: /devops|cloud|infrastructure|docker|kubernetes/i, icon: Cloud, gradient: "from-blue-600 via-indigo-500 to-cyan-400" },
  { match: /system|hệ thống|admin|server|network/i, icon: Server, gradient: "from-slate-700 via-indigo-600 to-violet-500" },
  { match: /security|bảo mật|an toàn|cyber/i, icon: ShieldCheck, gradient: "from-rose-500 via-pink-500 to-violet-500" },
  { match: /finance|tài chính|business|kinh doanh|marketing|thương mại/i, icon: TrendingUp, gradient: "from-amber-500 via-orange-500 to-rose-400" },
  { match: /design|thiết kế|ui|ux/i, icon: Palette, gradient: "from-pink-500 via-fuchsia-500 to-violet-500" },
  { match: /mobile|di động|app|flutter|react native/i, icon: Smartphone, gradient: "from-emerald-500 via-teal-500 to-sky-500" },
  { match: /game|unity|3d|đồ họa/i, icon: Gamepad2, gradient: "from-violet-600 via-indigo-500 to-emerald-400" },
  { match: /software|phần mềm|engineering|lập trình|python|code/i, icon: Code2, gradient: "from-indigo-600 via-blue-500 to-cyan-400" },
  { match: /hardware|iot|embedded|nhúng/i, icon: Cpu, gradient: "from-teal-600 via-emerald-500 to-lime-400" },
  { match: /management|quản lý|quản trị/i, icon: Briefcase, gradient: "from-indigo-500 via-violet-500 to-fuchsia-400" },
  { match: /report|báo cáo|power bi|excel/i, icon: BarChart3, gradient: "from-amber-400 via-yellow-400 to-emerald-400" }
];

export const coverTheme = (category?: string, title?: string) => {
  const text = `${category || ""} ${title || ""}`;
  return COVER_THEMES.find(theme => theme.match.test(text)) || { icon: BookOpen, gradient: "from-indigo-600 via-violet-500 to-cyan-400" };
};

/** Course artwork: the uploaded thumbnail, or a generated brand cover when there is none or it fails to load. */
export function CourseCover({ src, title, category, className, iconSize = "h-10 w-10" }: { src?: string; title?: string; category?: string; className?: string; iconSize?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const theme = coverTheme(category, title);
  const Icon = theme.icon;
  const showPhoto = Boolean(src) && status !== "failed";
  return (
    <div className={cx("relative overflow-hidden", className)}>
      {/* The generated cover doubles as the loading placeholder for a photo. */}
      <div className={cx("absolute inset-0 bg-gradient-to-br", theme.gradient)} aria-hidden>
        <div className="absolute -right-6 -top-10 h-40 w-40 rounded-full bg-white/15" />
        <div className="absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-white/10" />
        <Icon className="absolute -bottom-4 right-3 h-28 w-28 text-white/15" strokeWidth={1.25} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center rounded-2xl bg-white/20 p-3 ring-1 ring-white/30 backdrop-blur-sm">
            <Icon className={cx(iconSize, "text-white")} strokeWidth={1.75} />
          </span>
        </div>
      </div>
      {showPhoto && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={cx("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", status === "loaded" ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Empty state */

export function EmptyState({ illustration, icon, title, description, action, className, compact }: {
  illustration?: IllustrationName;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const iconBubble = icon ? (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</div>
  ) : null;
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "gap-3 px-6 py-10" : "gap-4 px-6 py-14", className)}>
      {illustration ? <Illustration name={illustration} className={compact ? "h-28 w-28" : "h-40 w-40"} fallback={iconBubble} /> : iconBubble}
      <div className="max-w-sm space-y-1.5">
        <h3 className={cx("font-bold text-slate-900", compact ? "text-base" : "text-lg")}>{title}</h3>
        {description && <p className="text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Page header */

export function PageHeader({ title, subtitle, eyebrow, actions, onBack, backLabel = "Quay lại", className }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header className={cx("space-y-3", className)}>
      {onBack && (
        <button type="button" onClick={onBack} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <div className="text-[13px] font-semibold text-indigo-600">{eyebrow}</div>}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 md:text-[34px]">{title}</h1>
          {subtitle && <p className="max-w-2xl text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ title, action, className, description }: { title: React.ReactNode; action?: React.ReactNode; className?: string; description?: React.ReactNode }) {
  return (
    <div className={cx("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, hint, icon, tone = "indigo" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky" }) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600"
  }[tone];
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-slate-200/70 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneClass)}>{icon}</span>}
      </div>
      <p className="mt-2 truncate font-display text-[26px] font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-[13px] text-slate-500">{hint}</p>}
    </div>
  );
}
