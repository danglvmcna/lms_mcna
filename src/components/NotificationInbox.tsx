import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Inbox, Search, Send, ChevronRight } from "lucide-react";
import { api } from "../api";
import { LMSDataStore, Notification, User } from "../types";
import SendNotificationModal from "./admin/SendNotificationModal";

interface NotificationInboxProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
  title?: string;
  triggerToast?: (msg: string) => void;
}

const formatNotificationTime = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const translateType = (type: string) => {
  switch (type) {
    case "success":
      return "Thành công";
    case "warning":
      return "Cảnh báo";
    case "danger":
    case "error":
      return "Khẩn cấp";
    case "attendance_link":
      return "Điểm danh";
    default:
      return "Thông báo";
  }
};

const typeClasses = (type: string) => {
  switch (type) {
    case "success":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "danger":
    case "error":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "attendance_link":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export default function NotificationInbox({ store, currentUser, onRefreshData, title = "Hộp thư thông báo", triggerToast }: NotificationInboxProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  // Local state to keep track of notifications marked read in the current view session
  const [locallyMarkedReadIds, setLocallyMarkedReadIds] = useState<Set<string>>(new Set());

  // Reset local read state when filter tab changes so they finally filter out if viewing "unread"
  useEffect(() => {
    setLocallyMarkedReadIds(new Set());
  }, [filter]);

  const notifications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.notifications || [])
      .filter(note => note.userId === currentUser.id)
      .filter(note => {
        if (filter === "unread") {
          // If the notification was marked read in this view session, keep showing it
          if (locallyMarkedReadIds.has(note.id)) return true;
          return !note.isRead;
        }
        return true;
      })
      .filter(note => {
        if (!query) return true;
        return note.message.toLowerCase().includes(query) || note.type.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser.id, search, store.notifications, filter, locallyMarkedReadIds]);

  const totalUnreadCount = useMemo(() => {
    return (store.notifications || []).filter(note => note.userId === currentUser.id && !note.isRead && !locallyMarkedReadIds.has(note.id)).length;
  }, [currentUser.id, store.notifications, locallyMarkedReadIds]);

  const markRead = async (note: Notification) => {
    if (note.isRead || locallyMarkedReadIds.has(note.id)) return;
    setLocallyMarkedReadIds(prev => new Set(prev).add(note.id));
    setBusyId(note.id);
    setError(null);
    try {
      await api.markNotificationRead(note.id);
      onRefreshData();
    } catch (err: any) {
      setError(err.message || "Không thể đánh dấu thông báo đã đọc.");
      setLocallyMarkedReadIds(prev => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead && !locallyMarkedReadIds.has(n.id)).map(n => n.id);
    setLocallyMarkedReadIds(prev => {
      const next = new Set(prev);
      unreadIds.forEach(id => next.add(id));
      return next;
    });
    setBusyId("all");
    setError(null);
    try {
      await api.markAllNotificationsRead();
      onRefreshData();
    } catch (err: any) {
      setError(err.message || "Không thể đánh dấu toàn bộ thông báo đã đọc.");
      setLocallyMarkedReadIds(prev => {
        const next = new Set(prev);
        unreadIds.forEach(id => next.delete(id));
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };



  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                {totalUnreadCount} mới
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Theo dõi thông báo hệ thống dành riêng cho tài khoản của bạn.</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === "admin" && (
            <button
              onClick={() => setShowSendModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium flex items-center gap-2 hover:bg-slate-800 shadow-xs transition cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              Gửi thông báo
            </button>
          )}
          <button
            onClick={markAllRead}
            disabled={totalUnreadCount === 0 || busyId === "all"}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 shadow-xs transition cursor-pointer"
          >
            <CheckCheck className="h-4 w-4" />
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* All/Unread Tabs */}
        <div className="flex border border-slate-200 bg-slate-100/80 p-1 rounded-xl w-fit shadow-2xs">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              filter === "unread"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Chưa đọc
            {totalUnreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-semibold ${
                filter === "unread" ? "bg-white text-indigo-700" : "bg-indigo-100 text-indigo-800"
              }`}>
                {totalUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm thông báo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs transition"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        {notifications.map(note => {
          const isNoteRead = note.isRead || locallyMarkedReadIds.has(note.id);
          return (
            <button
              key={note.id}
              onClick={() => {
                markRead(note);
                window.dispatchEvent(new CustomEvent("mcna:notification_click", { detail: note }));
              }}
              className={`w-full text-left rounded-2xl border p-4 transition cursor-pointer group ${
                isNoteRead
                  ? "bg-white border-slate-200/80 hover:bg-slate-50/80 shadow-2xs"
                  : "bg-indigo-50/40 border-indigo-200/80 shadow-xs hover:bg-indigo-50/60"
              }`}
              disabled={busyId === note.id}
            >
              <div className="flex items-start gap-3.5">
                <div className={`mt-0.5 h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 ${typeClasses(note.type)}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase ${typeClasses(note.type)}`}>
                        {translateType(note.type)}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatNotificationTime(note.createdAt)}</span>
                      {!isNoteRead && <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">Chưa đọc</span>}
                    </div>
                    <span className="text-[11px] font-medium text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                      Mở chi tiết <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-sans group-hover:text-slate-900">{note.message}</p>
                </div>
              </div>
            </button>
        )})}

        {notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
            <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500">Không có thông báo phù hợp.</p>
          </div>
        )}
      </div>

      {showSendModal && (
        <SendNotificationModal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          store={store}
          onSent={onRefreshData}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
