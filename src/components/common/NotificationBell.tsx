import React from "react";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from "lucide-react";
import { api } from "../../api";
import { relativeTime } from "../../lib/format";
import { cx, EmptyState } from "../ui";

interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

function TypeIcon({ type }: { type: string }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full";
  switch (type) {
    case "success":
      return <span className={cx(base, "bg-emerald-50 text-emerald-600")}><CheckCircle2 className="h-[18px] w-[18px]" /></span>;
    case "warning":
      return <span className={cx(base, "bg-amber-50 text-amber-600")}><AlertTriangle className="h-[18px] w-[18px]" /></span>;
    case "danger":
    case "error":
      return <span className={cx(base, "bg-rose-50 text-rose-600")}><XCircle className="h-[18px] w-[18px]" /></span>;
    default:
      return <span className={cx(base, "bg-indigo-50 text-indigo-600")}><Info className="h-[18px] w-[18px]" /></span>;
  }
}

function groupNotifications(notifications: Notification[]) {
  const groups = new Map<string, Notification[]>();
  notifications.slice(0, 50).forEach(notification => {
    const day = new Date(notification.createdAt).toLocaleDateString("en-CA");
    const key = `${notification.type}\u0000${notification.message}\u0000${day}`;
    groups.set(key, [...(groups.get(key) || []), notification]);
  });
  return [...groups.values()];
}

/** Bell with an unread count and a quick-glance popover. `placement` decides where the popover anchors. */
export default function NotificationBell({ placement = "topbar" }: { placement?: "sidebar" | "topbar" }) {
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // The bell is a convenience; failures stay silent and the next poll retries.
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const notificationGroups = groupNotifications(notifications);

  const handleMarkRead = async (ids: string[]) => {
    await Promise.allSettled(ids.map(id => api.markNotificationRead(id)));
    await fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) fetchNotifications();
  };

  const handleClickNotification = async (notif: Notification, unreadIds: string[]) => {
    if (unreadIds.length > 0) await handleMarkRead(unreadIds);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("mcna:notification_click", { detail: notif }));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={cx("relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 active:scale-95", open && "bg-slate-900/5 text-slate-900")}
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        aria-expanded={open}
      >
        <Bell className="h-[22px] w-[22px]" strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cx(
            "z-50 flex max-h-[min(560px,calc(100dvh-6rem))] animate-pop flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-float",
            placement === "sidebar" ? "absolute left-0 top-full mt-2 w-[380px]" : "fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
          )}
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
            <div>
              <h2 className="text-[17px] font-bold text-slate-900">Thông báo</h2>
              <p className="text-[13px] text-slate-500">{unreadCount > 0 ? `${unreadCount} chưa đọc` : "Bạn đã xem hết"}</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-indigo-50 px-3 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" /> Đọc hết
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {notifications.length === 0 ? (
              <EmptyState compact illustration="inbox" icon={<Bell className="h-6 w-6" />} title="Chưa có thông báo" description="Khi lớp học, thanh toán hoặc tài liệu có cập nhật, bạn sẽ thấy ở đây." />
            ) : (
              notificationGroups.map(group => {
                const notif = group[0];
                const hasUnread = group.some(item => !item.isRead);
                const unreadIds = group.filter(item => !item.isRead).map(item => item.id);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleClickNotification(notif, unreadIds)}
                    className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-slate-900/[0.035]"
                  >
                    <TypeIcon type={notif.type} />
                    <span className="min-w-0 flex-1">
                      <span className={cx("line-clamp-3 text-[14px] leading-snug", hasUnread ? "font-semibold text-slate-900" : "text-slate-600")}>{notif.message}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {relativeTime(notif.createdAt)}{group.length > 1 ? ` · ${group.length} thông báo giống nhau` : ""}
                      </span>
                    </span>
                    {hasUnread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" aria-label="Chưa đọc" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
