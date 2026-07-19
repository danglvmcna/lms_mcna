import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Inbox, Search } from "lucide-react";
import { api } from "../api";
import { LMSDataStore, Notification, User } from "../types";

interface NotificationInboxProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
  title?: string;
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
      return "bg-emerald-500/15 text-emerald-700 border-emerald-400/30 dark:text-emerald-400";
    case "warning":
      return "bg-amber-500/15 text-amber-700 border-amber-300/30 dark:text-amber-400";
    case "danger":
    case "error":
      return "bg-red-500/15 text-red-700 border-red-300/30 dark:text-red-400";
    case "attendance_link":
      return "bg-indigo-500/15 text-indigo-700 border-indigo-300/30 dark:text-indigo-400";
    default:
      return "bg-cyan-500/15 text-cyan-700 border-cyan-300/30 dark:text-cyan-400";
  }
};

export default function NotificationInbox({ store, currentUser, onRefreshData, title = "Hộp thư thông báo" }: NotificationInboxProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Student checkin states
  const [checkinCodes, setCheckinCodes] = useState<Record<string, string>>({});
  const [checkinSuccess, setCheckinSuccess] = useState<Record<string, boolean>>({});
  const [checkinLoading, setCheckinLoading] = useState<Record<string, boolean>>({});

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

  const handleSelfCheckinSubmit = async (sessionId: string, code: string, notificationId: string) => {
    if (!code.trim()) {
      setError("Vui lòng nhập mã điểm danh 6 ký tự!");
      return;
    }
    setCheckinLoading(prev => ({ ...prev, [notificationId]: true }));
    setError(null);
    try {
      await api.selfCheckin({ sessionId, code: code.trim().toUpperCase() });
      setCheckinSuccess(prev => ({ ...prev, [sessionId]: true }));
      await api.markNotificationRead(notificationId);
      onRefreshData();
    } catch (err: any) {
      setError(err.message || "Điểm danh thất bại.");
    } finally {
      setCheckinLoading(prev => ({ ...prev, [notificationId]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-white dark:bg-cyan-300 dark:text-slate-950 text-[10px] font-black">
                {totalUnreadCount} mới
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-white/55 mt-1">Theo dõi thông báo hệ thống dành riêng cho tài khoản của bạn.</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={totalUnreadCount === 0 || busyId === "all"}
          className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition cursor-pointer"
        >
          <CheckCheck className="h-4 w-4" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* All/Unread Tabs */}
        <div className="flex border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filter === "all"
                ? "bg-indigo-600 text-white"
                : "text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filter === "unread"
                ? "bg-indigo-600 text-white"
                : "text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Chưa đọc
            {totalUnreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                filter === "unread" ? "bg-white text-indigo-700" : "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
              }`}>
                {totalUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 dark:text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm thông báo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-black/25 border border-slate-200 dark:border-white/10 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/35 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs text-red-700 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {notifications.map(note => {
          const isNoteRead = note.isRead || locallyMarkedReadIds.has(note.id);
          return (
            <button
              key={note.id}
              onClick={() => {
                if (note.type !== "attendance_link") {
                  markRead(note);
                }
              }}
              className={`w-full text-left rounded-2xl border p-4 transition cursor-pointer ${
                isNoteRead
                  ? "bg-white/50 border-slate-100 dark:bg-white/[0.03] dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                  : "bg-cyan-500/5 border-cyan-300/20 shadow-sm dark:bg-cyan-500/10 dark:border-cyan-300/30 dark:shadow-lg dark:shadow-cyan-950/20 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15"
              }`}
              disabled={busyId === note.id}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-9 w-9 rounded-xl border flex items-center justify-center ${typeClasses(note.type)}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${typeClasses(note.type)}`}>
                      {translateType(note.type)}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-white/45">{formatNotificationTime(note.createdAt)}</span>
                    {!isNoteRead && <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-200">Chưa đọc</span>}
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-white/85 leading-relaxed">{note.message}</p>

                {/* Inline checkin form for students directly in their notifications */}
                {note.type === "attendance_link" && note.relatedEntityId && (() => {
                  const hasCheckedIn = (store.attendanceRecords || []).some(
                    r => r.sessionId === note.relatedEntityId && 
                         r.studentId === currentUser.id && 
                         r.status === "present"
                  );
                  
                  if (hasCheckedIn || checkinSuccess[note.relatedEntityId]) {
                    return (
                      <div className="mt-2.5 p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold flex items-center gap-1.5 w-fit font-sans text-xs">
                        <span>✅ Bạn đã xác nhận điểm danh thành công!</span>
                      </div>
                    );
                  }
                  
                  return (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="mt-2.5 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2 max-w-sm"
                    >
                      <input
                        type="text"
                        placeholder="Mã Code (6 ký tự)"
                        value={checkinCodes[note.id] || ""}
                        onChange={(e) => setCheckinCodes(prev => ({ ...prev, [note.id]: e.target.value }))}
                        maxLength={6}
                        className="w-32 px-2.5 py-1.5 bg-white dark:bg-black/45 text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 text-center font-mono font-bold uppercase placeholder-slate-400 dark:placeholder-white/20 text-xs"
                      />
                      <button
                        onClick={() => handleSelfCheckinSubmit(note.relatedEntityId!, checkinCodes[note.id] || "", note.id)}
                        disabled={checkinLoading[note.id]}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition duration-150 text-xs shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {checkinLoading[note.id] ? "Đang xử lý..." : "Xác nhận Có mặt ✍️"}
                      </button>
                    </div>
                  );
                })()}

              </div>
            </div>
          </button>
        )})}

        {notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.03] p-10 text-center">
            <Inbox className="h-8 w-8 text-slate-300 dark:text-white/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-white/65">Không có thông báo phù hợp.</p>
          </div>
        )}
      </div>
    </div>
  );
}
