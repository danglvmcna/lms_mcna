import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import ModalPortal from "../ModalPortal";
import { cx } from "./primitives";

const WIDTHS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-4xl"
} as const;

interface DialogProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof WIDTHS;
  /** Closing on backdrop click/Escape; turn off for forms with unsaved input. */
  dismissible?: boolean;
  className?: string;
  children?: React.ReactNode;
}

let openDialogs = 0;

/**
 * Bottom sheet on phones, centered card on larger screens.
 * Locks page scroll while open and closes on Escape or backdrop tap.
 */
export default function Dialog({ open = true, onClose, title, description, icon, footer, size = "md", dismissible = true, className, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openDialogs += 1;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTarget = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), textarea, select");
    (focusTarget || panelRef.current)?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="mcna-overlay" onMouseDown={event => { if (dismissible && event.target === event.currentTarget) onClose(); }}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={cx("mcna-dialog outline-none", WIDTHS[size], className)}
        >
          <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
          {(title || icon) && (
            <div className="mb-5 flex items-start gap-3.5 pr-10">
              {icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</div>}
              <div className="min-w-0 space-y-1">
                {title && <h2 className="text-lg font-bold leading-snug text-slate-900">{title}</h2>}
                {description && <p className="text-sm leading-relaxed text-slate-500">{description}</p>}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 sm:right-5 sm:top-5"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
          {children}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      </div>
    </ModalPortal>
  );
}
