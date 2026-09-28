import React from "react";
import { cx } from "./primitives";

/**
 * Mascot and scene illustrations. Artwork lives in src/assets/illustrations/<name>.(webp|png)
 * and is registered automatically at build time; a name without a file renders its fallback,
 * so layouts never show a broken image.
 */
export type IllustrationName =
  | "welcome"     // mascot waving: landing hero, sign-in panel
  | "explore"     // mascot with a map/telescope: onboarding step "find a course"
  | "live-class"  // mascot on a video call: onboarding step "join live classes"
  | "progress"    // mascot climbing steps: onboarding step "track progress"
  | "celebrate"   // mascot cheering: payment success, course completed
  | "mail"        // mascot holding an envelope: check your email
  | "lock"        // mascot with a key: set/reset password
  | "study"       // mascot reading: empty "my classes"
  | "waiting"     // mascot with an hourglass: waiting for placement/payment review
  | "search"      // mascot with a magnifier: no search results
  | "chat"        // mascot with speech bubbles: empty discussion
  | "inbox"       // mascot with a tray: empty notifications
  | "teach";      // mascot at a whiteboard: teacher empty states

const illustrationFiles = import.meta.glob("../../assets/illustrations/*.{webp,png}", { eager: true, import: "default" }) as Record<string, string>;

export const ILLUSTRATIONS: Partial<Record<IllustrationName, string>> = Object.fromEntries(
  Object.entries(illustrationFiles).map(([path, url]) => [path.split("/").pop()!.replace(/\.(webp|png)$/, ""), url])
);

export function Illustration({ name, className, alt = "", fallback = null, eager }: { name: IllustrationName; className?: string; alt?: string; fallback?: React.ReactNode; eager?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  const src = ILLUSTRATIONS[name];
  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cx("select-none object-contain", className)}
    />
  );
}

export const hasIllustration = (name: IllustrationName) => Boolean(ILLUSTRATIONS[name]);

export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/mcna-mark.png" alt="" aria-hidden draggable={false} className={cx("select-none object-contain", className)} />;
}

/** Mark + wordmark. `compact` drops the "Technology School" line. */
export function BrandLockup({ className, compact, subtitle = "Technology School" }: { className?: string; compact?: boolean; subtitle?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <BrandMark className="h-8 w-8" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-bold tracking-tight text-slate-900">MCNA</span>
        {!compact && <span className="mt-1 whitespace-nowrap text-[11px] font-medium text-slate-500">{subtitle}</span>}
      </span>
    </span>
  );
}
