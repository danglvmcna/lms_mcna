import React from "react";
import { BookOpenCheck, ChevronLeft, LineChart, Video } from "lucide-react";
import { BrandLockup, cx, Illustration } from "../ui";

const HIGHLIGHTS = [
  { icon: Video, title: "Lớp học trực tuyến", text: "Học trực tiếp cùng giảng viên qua Zoom, hỏi đáp ngay trong buổi." },
  { icon: BookOpenCheck, title: "Tài liệu từng buổi", text: "Slide, video xem lại và bài đọc luôn sẵn sàng sau mỗi buổi học." },
  { icon: LineChart, title: "Thấy rõ tiến độ", text: "Biết mình đã học đến đâu và buổi tiếp theo là khi nào." }
];

export const ONBOARDING_STEPS = ["Tạo tài khoản", "Nhận email", "Đặt mật khẩu"];

/** "1 Tạo tài khoản — 2 Nhận email — 3 Đặt mật khẩu" so first-time learners know what comes next. */
export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Các bước tạo tài khoản">
      {ONBOARDING_STEPS.map((label, index) => {
        const step = index + 1;
        const state = step < current ? "done" : step === current ? "current" : "todo";
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={state === "current" ? "step" : undefined}>
            <span className={cx("h-1.5 rounded-full", state === "todo" ? "bg-slate-200" : "bg-indigo-600")} />
            <span className={cx("truncate text-xs font-semibold", state === "todo" ? "text-slate-400" : "text-slate-700")}>
              {step}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Split layout for sign-in and account setup: brand story on the left (desktop), form on the right. */
export default function AuthLayout({ children, onBackToCourses, title, subtitle, top }: {
  children: React.ReactNode;
  onBackToCourses?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  top?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-aurora lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <BrandLockup />
        <div className="relative z-10 max-w-md space-y-10">
          <Illustration name="welcome" eager className="-mb-4 -ml-4 h-36 w-36 xl:h-44 xl:w-44 [@media(max-height:800px)]:hidden" />
          <h2 className="text-[40px] font-bold leading-[1.1] tracking-tight text-slate-900 xl:text-5xl">
            Học công nghệ,
            <br />
            <span className="text-brand-gradient">vui hơn mỗi ngày.</span>
          </h2>
          <ul className="space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-card ring-1 ring-slate-200/60">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">{itemTitle}</span>
                  <span className="mt-0.5 block text-[15px] leading-relaxed text-slate-600">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-sm text-slate-500">© {new Date().getFullYear()} MCNA Technology School</p>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:min-h-0 lg:justify-center lg:px-12 lg:py-12">
        <div className="flex items-center justify-between lg:hidden">
          <BrandLockup compact />
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8 lg:flex-none lg:py-0">
          {onBackToCourses && (
            <button type="button" onClick={onBackToCourses} className="-ml-2 mb-6 inline-flex h-9 w-fit items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
              <ChevronLeft className="h-4 w-4" /> Xem các khóa học
            </button>
          )}
          {top && <div className="mb-6">{top}</div>}
          <div className="mb-7 space-y-2">
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
