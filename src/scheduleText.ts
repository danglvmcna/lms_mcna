// Plain-text class timetable, shared by the placement email and the UI.

export type ScheduleSlotLike = { dayOfWeek?: string; startTime?: string; endTime?: string; room?: string; specificDate?: string };

const clean = (value: unknown) => String(value ?? "").trim();

/** "2026-10-06" or an ISO timestamp -> "06/10/2026". Date-only text is not shifted by the server timezone. */
export function formatDateVi(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const text = clean(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : formatDateVi(parsed);
}

/**
 * Groups slots that share the same hours: "Thứ Ba, Thứ Năm · 19:30 – 21:30".
 * Classes with different hours on different days are joined with "; ".
 */
export function formatScheduleSummary(schedule?: ScheduleSlotLike[] | null): string {
  const slots = (schedule || []).filter(slot => clean(slot?.dayOfWeek) || clean(slot?.specificDate));
  if (slots.length === 0) return "";

  const groups = new Map<string, string[]>();
  for (const slot of slots) {
    const start = clean(slot.startTime);
    const end = clean(slot.endTime);
    const hours = start && end ? `${start} – ${end}` : start || end;
    const day = clean(slot.dayOfWeek) || formatDateVi(slot.specificDate);
    const days = groups.get(hours) || [];
    if (!days.includes(day)) days.push(day);
    groups.set(hours, days);
  }

  return Array.from(groups.entries())
    .map(([hours, days]) => (hours ? `${days.join(", ")} · ${hours}` : days.join(", ")))
    .join("; ");
}

/** The room shared by every slot ("Online (Zoom)"), or "" when slots differ or none is set. */
export function commonScheduleRoom(schedule?: ScheduleSlotLike[] | null): string {
  const rooms = Array.from(new Set((schedule || []).map(slot => clean(slot?.room)).filter(Boolean)));
  return rooms.length === 1 ? rooms[0] : "";
}
