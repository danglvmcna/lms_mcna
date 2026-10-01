/** Business rules shared by API, UI and tests. No environment or database side effects. */
export function paymentMayPlace(directSale: boolean, sectionId?: string | null) {
  return !directSale && Boolean(sectionId);
}
export function certificateDecision(input: { expected: number; sessions: number; recorded: number; ended: boolean; absences: number; finalSubmitted: boolean }) {
  const reasons: string[] = [];
  if (!input.ended) reasons.push('Lớp chưa kết thúc.');
  if (input.expected < 1 || input.sessions < input.expected || input.recorded < input.sessions) reasons.push('Chưa đủ buổi học hoặc điểm danh.');
  if (input.absences > 2) reasons.push(`Vắng ${input.absences} buổi (tối đa 2).`);
  if (!input.finalSubmitted) reasons.push('Chưa nộp bài cuối khóa.');
  return { eligible: reasons.length === 0, reasons };
}
export function voucherDiscount(price: number, amount: number) {
  if (!Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(amount) || amount < 0) throw new Error('Học phí hoặc voucher không hợp lệ.');
  const discount = Math.min(price, amount);
  return { originalPrice: price, discount, amount: price - discount };
}
export function commissionSnapshot(source: 'self' | 'sale', start: string | null, now = new Date()) {
  const begins = start ? new Date(`${start}T00:00:00+07:00`) : null;
  const ends = begins ? new Date(begins) : null;
  if (ends) ends.setUTCMonth(ends.getUTCMonth() + 12);
  const active = Boolean(begins && ends && now >= begins && now < ends);
  return { version: 'mcna-direct-sale-v1', start, endsAt: ends?.toISOString() || null, months: 12, source, rate: active ? (source === 'self' ? 0.10 : 0.05) : null };
}
export function teacherTier(courses: number, rules: { label: string; courses: number }[]) {
  const sorted = [...rules].sort((a,b) => a.courses - b.courses);
  const current = sorted.filter(rule => courses >= rule.courses).at(-1);
  const next = sorted.find(rule => rule.courses > courses);
  return { label: current?.label || 'Chưa cấu hình', next: next?.label || null, remaining: next ? next.courses - courses : 0 };
}
