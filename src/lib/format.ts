/** Shared, locale-aware formatting for the Vietnamese UI. */

export const formatVnd = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

export const formatPrice = (price?: number | null) => (price && price > 0 ? formatVnd(price) : "Miễn phí");

const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: string | null, fallback = "Chưa xác định") => {
  const date = toDate(value);
  return date ? date.toLocaleDateString("vi-VN") : value || fallback;
};

export const formatDateTime = (value?: string | null) => {
  const date = toDate(value);
  return date
    ? date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
};

/** "Thứ Hai, 15 tháng 9" */
export const formatDayLong = (value?: string | null) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" });
};

export const capitalizeFirst = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/** Only show a clock time when the stored value actually carries one. */
export const formatTimeIfSet = (value?: string | null) => {
  const date = toDate(value);
  if (!date || (date.getHours() === 0 && date.getMinutes() === 0)) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Hôm nay", "Ngày mai", "Còn 5 ngày"… for upcoming dates. */
export const relativeDay = (value?: string | null) => {
  const date = toDate(value);
  if (!date) return "";
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Ngày mai";
  if (days === -1) return "Hôm qua";
  if (days > 1 && days < 7) return `Còn ${days} ngày`;
  if (days < 0) return `${-days} ngày trước`;
  return formatDate(value);
};

export const relativeTime = (value?: string | null) => {
  const date = toDate(value);
  if (!date) return "";
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN");
};

export const greeting = (now = new Date()) => {
  const hour = now.getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
};

const VIETNAMESE_SURNAMES = new Set([
  "nguyễn", "trần", "lê", "phạm", "hoàng", "huỳnh", "phan", "vũ", "võ", "đặng", "bùi", "đỗ", "hồ", "ngô", "dương", "lý", "đinh", "trương", "đoàn", "lâm", "mai", "tô", "cao", "trịnh", "hà", "tạ", "lương", "chu", "đào", "vương"
]);

/** The name people are greeted by: the given name for Vietnamese names, the first word otherwise. */
export const callName = (fullName?: string | null) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "bạn";
  if (parts.length === 1) return parts[0];
  return VIETNAMESE_SURNAMES.has(parts[0].toLowerCase()) ? parts[parts.length - 1] : parts[0];
};

export const initials = (fullName?: string | null) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const scheduleSummary = (schedule?: Array<{ dayOfWeek: string; startTime: string; endTime: string }> | null) =>
  (schedule || []).map(slot => `${slot.dayOfWeek} ${slot.startTime}–${slot.endTime}`).join(" · ");

export const roleLabel = (role?: string) =>
  role === "admin" ? "Quản trị viên" : role === "manager" ? "Quản lý lớp" : role === "teacher" ? "Giảng viên" : role === "student" ? "Học viên" : role || "";
