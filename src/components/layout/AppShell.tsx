import React, { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, KeyRound, LogOut, type LucideIcon, MoreHorizontal, UserRound } from "lucide-react";
import { User } from "../../types";
import NotificationBell from "../common/NotificationBell";
import { Avatar, BrandLockup, BrandMark, cx, Dialog } from "../ui";
import { roleLabel } from "../../lib/format";

export interface NavItem {
  id: string;
  label: string;
  /** Shorter label for the mobile tab bar. */
  shortLabel?: string;
  icon: LucideIcon;
  badge?: number;
  group?: string;
  /** "tab" = mobile tab bar, "more" = inside the More sheet, "hidden" = reachable elsewhere (e.g. the bell). */
  mobile?: "tab" | "more" | "hidden";
}

interface AppShellProps {
  user: User;
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  onOpenProfile: () => void;
  onOpenPassword: () => void;
  onLogout: () => void;
  wide?: boolean;
  children: React.ReactNode;
}

function AccountMenu({ user, onOpenProfile, onOpenPassword, onLogout, onDone, className }: Pick<AppShellProps, "user" | "onOpenProfile" | "onOpenPassword" | "onLogout"> & { onDone: () => void; className?: string }) {
  const base = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium";
  const item = cx(base, "text-slate-700 hover:bg-slate-900/5");
  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-3 pb-3 pr-10 pt-2">
        <Avatar name={user.name} size={40} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-[13px] text-slate-500">{user.email}</p>
        </div>
      </div>
      <div className="my-1 h-px bg-slate-100" />
      <button type="button" className={item} onClick={() => { onDone(); onOpenProfile(); }}>
        <UserRound className="h-[18px] w-[18px] text-slate-500" /> Hồ sơ của tôi
      </button>
      <button type="button" className={item} onClick={() => { onDone(); onOpenPassword(); }}>
        <KeyRound className="h-[18px] w-[18px] text-slate-500" /> Đổi mật khẩu
      </button>
      <div className="my-1 h-px bg-slate-100" />
      <button type="button" className={cx(base, "text-rose-600 hover:bg-rose-50")} onClick={() => { onDone(); onLogout(); }}>
        <LogOut className="h-[18px] w-[18px]" /> Đăng xuất
      </button>
    </div>
  );
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

export default function AppShell({ user, nav, active, onNavigate, onOpenProfile, onOpenPassword, onLogout, wide, children }: AppShellProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const accountRef = useOutsideClose(accountOpen, () => setAccountOpen(false));

  const groups = nav.reduce<Array<{ label?: string; items: NavItem[] }>>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else acc.push({ label: item.group, items: [item] });
    return acc;
  }, []);

  const tabItems = nav.filter(item => (item.mobile || "tab") === "tab");
  const moreItems = nav.filter(item => item.mobile === "more");
  const activeItem = nav.find(item => item.id === active);
  const moreActive = moreItems.some(item => item.id === active);

  const navigate = (id: string) => {
    onNavigate(id);
    setMoreOpen(false);
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur-xl lg:flex">
        <div className="flex h-[72px] items-center justify-between px-5">
          <BrandLockup subtitle={roleLabel(user.role)} />
          <NotificationBell placement="sidebar" />
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
          {groups.map((group, index) => (
            <div key={group.label || index} className="space-y-0.5">
              {group.label && <p className="px-3 pb-1.5 text-xs font-semibold text-slate-500">{group.label}</p>}
              {group.items.map(item => {
                const selected = item.id === active;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    aria-current={selected ? "page" : undefined}
                    className={cx(
                      "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium",
                      selected ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
                    )}
                  >
                    <Icon className={cx("h-5 w-5 shrink-0", selected ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-600")} strokeWidth={selected ? 2.2 : 1.9} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {!!item.badge && (
                      <span className={cx("min-w-6 rounded-full px-1.5 text-center text-xs font-semibold leading-6", selected ? "bg-indigo-600 text-white" : "bg-slate-900/[0.06] text-slate-600")}>
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div ref={accountRef} className="relative border-t border-slate-200/70 p-3">
          {accountOpen && (
            <AccountMenu
              user={user}
              onOpenProfile={onOpenProfile}
              onOpenPassword={onOpenPassword}
              onLogout={onLogout}
              onDone={() => setAccountOpen(false)}
              className="absolute bottom-full left-3 right-3 mb-2 animate-pop rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-float"
            />
          )}
          <button
            type="button"
            onClick={() => setAccountOpen(open => !open)}
            aria-expanded={accountOpen}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-900/[0.04]"
          >
            <Avatar name={user.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
              <span className="block truncate text-xs text-slate-500">{roleLabel(user.role)}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-200/60 px-4 surface-glass lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="truncate font-display text-[17px] font-bold tracking-tight text-slate-900">{activeItem?.label || "MCNA"}</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell placement="topbar" />
          <button type="button" onClick={() => setMobileAccountOpen(true)} aria-label="Tài khoản" className="rounded-full p-1 active:scale-95">
            <Avatar name={user.name} size={32} />
          </button>
        </div>
      </header>

      <main className="lg:pl-[264px]">
        <div className={cx("mx-auto w-full px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10", wide ? "max-w-[1480px]" : "max-w-6xl")}>
          {children}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 surface-glass pb-safe lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {tabItems.map(item => {
            const selected = item.id === active;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={selected ? "page" : undefined}
                className={cx("relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold", selected ? "text-indigo-600" : "text-slate-500")}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={selected ? 2.2 : 1.8} />
                  {!!item.badge && <span className="absolute -right-2 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">{item.badge > 9 ? "9+" : item.badge}</span>}
                </span>
                <span className="max-w-full truncate">{item.shortLabel || item.label}</span>
              </button>
            );
          })}
          {moreItems.length > 0 && (
            <button type="button" onClick={() => setMoreOpen(true)} className={cx("flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold", moreActive ? "text-indigo-600" : "text-slate-500")}>
              <MoreHorizontal className="h-6 w-6" strokeWidth={moreActive ? 2.2 : 1.8} />
              <span>Thêm</span>
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <Dialog onClose={() => setMoreOpen(false)} title="Thêm" size="sm">
          <div className="-mx-2 space-y-0.5">
            {moreItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.id)} className={cx("flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium", item.id === active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-900/5")}>
                  <Icon className="h-5 w-5 text-slate-500" /> <span className="flex-1">{item.label}</span>
                  {!!item.badge && <span className="rounded-full bg-slate-900/[0.06] px-2 text-xs font-semibold leading-6 text-slate-600">{item.badge}</span>}
                </button>
              );
            })}
          </div>
        </Dialog>
      )}

      {mobileAccountOpen && (
        <Dialog onClose={() => setMobileAccountOpen(false)} size="sm">
          <AccountMenu user={user} onOpenProfile={onOpenProfile} onOpenPassword={onOpenPassword} onLogout={onLogout} onDone={() => setMobileAccountOpen(false)} className="-mx-2 -mt-2" />
        </Dialog>
      )}
    </div>
  );
}
