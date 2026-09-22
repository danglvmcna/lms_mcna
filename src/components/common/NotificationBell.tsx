import React from "react";
import { Bell, X, CheckCheck, Info, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { api } from "../../api";

interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function typeIcon(type: string) {
  switch (type) {
    case "success": return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "danger":  return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />;
    default:        return <Info className="h-4 w-4 text-indigo-500 shrink-0" />;
  }
}

function typeDot(type: string) {
  switch (type) {
    case "success": return "bg-emerald-500";
    case "warning": return "bg-amber-500";
    case "danger":  return "bg-rose-500";
    default:        return "bg-indigo-500";
  }
}

export default function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // silent fail
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh every 60s
  React.useEffect(() => {
    const interval = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
        title="Thông báo"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-700" />
              <span className="text-sm font-bold text-slate-900">Thông báo</span>
              {unreadCount > 0 && (
                <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition cursor-pointer disabled:opacity-50"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Đọc tất cả
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-xs font-medium">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.slice(0, 50).map(notif => (
                <button
                  key={notif.id}
                  onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                  className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition group cursor-pointer ${
                    notif.isRead
                      ? "bg-white hover:bg-slate-50/60"
                      : "bg-indigo-50/40 hover:bg-indigo-50/80"
                  }`}
                >
                  {/* Unread dot */}
                  <div className="mt-1 shrink-0">
                    {notif.isRead
                      ? <div className="w-2 h-2" />
                      : <div className={`w-2 h-2 rounded-full ${typeDot(notif.type)}`} />
                    }
                  </div>

                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">{typeIcon(notif.type)}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${notif.isRead ? "text-slate-600" : "text-slate-900 font-medium"}`}>
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      {relativeTime(notif.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-400 text-center font-mono">
                {notifications.length} thông báo · Click để đánh dấu đã đọc
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
