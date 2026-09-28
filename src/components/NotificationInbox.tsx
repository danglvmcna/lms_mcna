import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, ChevronRight, Info, Send, XCircle } from "lucide-react";
import { api } from "../api";
import { LMSDataStore, Notification, User } from "../types";
import SendNotificationModal from "./admin/SendNotificationModal";
import { relativeTime } from "../lib/format";
import { Button, Callout, Card, cx, EmptyState, PageHeader, SearchField, Segmented } from "./ui";

interface NotificationInboxProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
  title?: string;
  triggerToast?: (msg: string) => void;
}

function TypeIcon({ type }: { type: string }) {
  const base = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full";
  if (type === "success") return <span className={cx(base, "bg-emerald-50 text-emerald-600")}><CheckCircle2 className="h-5 w-5" /></span>;
  if (type === "warning") return <span className={cx(base, "bg-amber-50 text-amber-600")}><AlertTriangle className="h-5 w-5" /></span>;
  if (type === "danger" || type === "error") return <span className={cx(base, "bg-rose-50 text-rose-600")}><XCircle className="h-5 w-5" /></span>;
  return <span className={cx(base, "bg-indigo-50 text-indigo-600")}><Info className="h-5 w-5" /></span>;
}

const dayLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });
};

export default function NotificationInbox({ store, currentUser, onRefreshData, title = "Thông báo", triggerToast }: NotificationInboxProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  // Notifications read during this visit stay visible under "Chưa đọc" until the filter changes.
  const [locallyMarkedReadIds, setLocallyMarkedReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocallyMarkedReadIds(new Set());
  }, [filter]);

  const notifications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.notifications || [])
      .filter(note => note.userId === currentUser.id)
      .filter(note => filter !== "unread" || locallyMarkedReadIds.has(note.id) || !note.isRead)
      .filter(note => !query || note.message.toLowerCase().includes(query) || note.type.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser.id, search, store.notifications, filter, locallyMarkedReadIds]);

  const totalUnreadCount = useMemo(
    () => (store.notifications || []).filter(note => note.userId === currentUser.id && !note.isRead && !locallyMarkedReadIds.has(note.id)).length,
    [currentUser.id, store.notifications, locallyMarkedReadIds]
  );

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: Notification[] }> = [];
    notifications.forEach(note => {
      const label = dayLabel(note.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(note);
      else groups.push({ label, items: [note] });
    });
    return groups;
  }, [notifications]);

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
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={totalUnreadCount > 0 ? `${totalUnreadCount} thông báo chưa đọc` : "Bạn đã xem hết thông báo."}
        actions={
          <>
            {currentUser.role === "admin" && <Button variant="secondary" icon={<Send className="h-4 w-4" />} onClick={() => setShowSendModal(true)}>Gửi thông báo</Button>}
            <Button variant="tinted" icon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead} disabled={totalUnreadCount === 0 || busyId === "all"}>Đọc tất cả</Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<"all" | "unread">
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "unread", label: "Chưa đọc", count: totalUnreadCount }
          ]}
        />
        <SearchField value={search} onChange={setSearch} placeholder="Tìm thông báo…" className="sm:w-80" />
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      {notifications.length === 0 ? (
        <Card>
          <EmptyState illustration="inbox" icon={<Bell className="h-6 w-6" />} title={filter === "unread" ? "Không còn thông báo chưa đọc" : "Chưa có thông báo"} description={search ? "Thử tìm với từ khóa khác." : "Cập nhật về lớp học, thanh toán và tài liệu sẽ hiện ở đây."} />
        </Card>
      ) : (
        grouped.map(group => (
          <section key={group.label} className="space-y-2">
            <h2 className="px-1 text-[13px] font-semibold capitalize text-slate-500">{group.label}</h2>
            <Card as="ul" className="divide-y divide-slate-100 overflow-hidden">
              {group.items.map(note => {
                const unread = !note.isRead && !locallyMarkedReadIds.has(note.id);
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      disabled={busyId === note.id}
                      onClick={() => {
                        markRead(note);
                        window.dispatchEvent(new CustomEvent("mcna:notification_click", { detail: note }));
                      }}
                      className={cx("group flex w-full items-start gap-3.5 px-4 py-4 text-left hover:bg-slate-900/[0.025] md:px-5", unread && "bg-indigo-50/40")}
                    >
                      <TypeIcon type={note.type} />
                      <span className="min-w-0 flex-1">
                        <span className={cx("block text-[15px] leading-snug", unread ? "font-semibold text-slate-900" : "text-slate-700")}>{note.message}</span>
                        <span className="mt-1 block text-xs text-slate-400">{relativeTime(note.createdAt)}</span>
                      </span>
                      {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" aria-label="Chưa đọc" />}
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
                    </button>
                  </li>
                );
              })}
            </Card>
          </section>
        ))
      )}

      {showSendModal && (
        <SendNotificationModal isOpen={showSendModal} onClose={() => setShowSendModal(false)} store={store} onSent={onRefreshData} triggerToast={triggerToast} />
      )}
    </div>
  );
}
