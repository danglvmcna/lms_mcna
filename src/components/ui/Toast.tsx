import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ShowToast = (message: string, tone?: ToastTone | "warning") => void;

const ToastContext = createContext<ShowToast>(() => undefined);

const ERROR_HINT = /không thể|lỗi|thất bại|chưa hợp lệ|vui lòng|hết hạn|đã dùng hết|không tìm thấy|đã tồn tại|failed|error|please/i;

/** Messages from older call sites carry no tone; infer it from the wording. */
export const inferTone = (message: string): ToastTone => (ERROR_HINT.test(message) ? "error" : "success");

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback<ShowToast>((message, tone) => {
    const id = nextId.current++;
    const resolved: ToastTone = tone === "warning" ? "error" : tone || inferTone(message);
    const clean = message.replace(/^[✅❌⚠️]\s*/u, "");
    setItems(current => [...current.slice(-2), { id, message: clean, tone: resolved }]);
    window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), resolved === "error" ? 5200 : 3400);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-8"
      >
        {items.map(item => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex max-w-md animate-fade-up items-start gap-2.5 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm font-medium text-white shadow-float backdrop-blur"
          >
            {item.tone === "success" ? (
              <CheckCircle2 className="mt-px h-[18px] w-[18px] shrink-0 text-emerald-400" />
            ) : item.tone === "error" ? (
              <AlertCircle className="mt-px h-[18px] w-[18px] shrink-0 text-rose-400" />
            ) : (
              <Info className="mt-px h-[18px] w-[18px] shrink-0 text-sky-300" />
            )}
            <span className="leading-snug">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
