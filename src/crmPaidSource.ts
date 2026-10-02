import { EMAIL_PATTERN, normalizeText, PaidImportRow } from "./paidImport";

// Turns the CRM's revenue records ("ghi nhận doanh thu": who paid, for which courses) into rows of the
// paid-customers import. Shared by the server, which reads the CRM database, and the import dialog.

/** One row of the CRM table revenue_records, with the columns the LMS uses. */
export type CrmRevenueRecord = {
  id: string;
  saleDate?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerType?: string | null;
  courseSold?: unknown;
  totalRevenue?: number | string | null;
  debt?: number | string | null;
  paymentMethod?: string | null;
};

export type CrmSkippedRecord = { crmRef: string; customer: string; saleDate: string; reason: string };

export type CrmPaidPull = {
  // Revenue records read from the CRM.
  records: number;
  rows: PaidImportRow[];
  // Records left out, with the reason shown to the class manager.
  skipped: CrmSkippedRecord[];
  // Cursor for the next, older page of revenue records (not a customer identifier).
  nextCursor?: string;
};

const text = (value: unknown) => String(value ?? "").trim();

/** The CRM marks a settled sale with "Đã hoàn tất thanh toán - Fully Paid" and no remaining debt. */
export function isFullyPaid(record: Pick<CrmRevenueRecord, "debt" | "paymentMethod">): boolean {
  const status = normalizeText(record.paymentMethod);
  const settled = ["da hoan tat thanh toan fully paid", "da hoan tat thanh toan", "fully paid"].includes(status);
  const debt = record.debt;
  return settled && debt !== null && debt !== undefined && String(debt).trim() !== "" && Number.isFinite(Number(debt)) && Number(debt) === 0;
}

/** Courses of a record: the CRM stores an array of course codes or names. */
export function soldCourses(courseSold: unknown): string[] {
  const list = Array.isArray(courseSold) ? courseSold : typeof courseSold === "string" ? courseSold.split(/[,;\n]/) : [];
  return Array.from(new Set(list.map(text).filter(Boolean)));
}

/** One import row per fully paid customer and course. Records that cannot be imported are listed with a reason. */
export function crmRecordsToPaidRows(records: CrmRevenueRecord[]): CrmPaidPull {
  const rows: PaidImportRow[] = [];
  const skipped: CrmSkippedRecord[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const customer = text(record.customerName);
    const saleDate = text(record.saleDate);
    const skip = (reason: string) => skipped.push({ crmRef: record.id, customer, saleDate, reason });

    if (!isFullyPaid(record)) {
      skip(`Chưa thanh toán đủ (trạng thái CRM: ${text(record.paymentMethod) || "chưa ghi"}${Number(record.debt || 0) > 0 ? `, còn nợ ${Number(record.debt).toLocaleString("vi-VN")} đ` : ""}).`);
      continue;
    }
    const email = text(record.customerEmail).toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 320) {
      skip("CRM chưa có email hợp lệ của khách.");
      continue;
    }
    if (customer.length < 2 || customer.length > 150 || !text(record.id) || text(record.id).length > 80) {
      skip("CRM thiếu họ tên hợp lệ hoặc mã bản ghi doanh thu.");
      continue;
    }
    const courses = soldCourses(record.courseSold);
    if (courses.length === 0) {
      skip("CRM chưa ghi khóa học đã bán.");
      continue;
    }

    const total = Number(record.totalRevenue || 0);
    if (!Number.isFinite(total) || total < 0) {
      skip("Tổng doanh thu CRM không hợp lệ; cần đối soát trước khi nhập.");
      continue;
    }
    for (const course of courses) {
      if (course.length > 300 || text(record.customerPhone).length > 40) {
        skip("Mã khóa học hoặc số điện thoại vượt giới hạn; cần sửa trên CRM.");
        continue;
      }
      const key = `${email}|${normalizeText(course)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        name: customer,
        email,
        phone: text(record.customerPhone) || undefined,
        course,
        // The CRM records one total per sale; it is only a course's own amount when the sale has one course.
        amount: courses.length === 1 && total > 0 ? total : undefined,
        note: [
          `CRM ${record.id}`,
          saleDate ? `bán ngày ${saleDate}` : "",
          courses.length > 1 && total > 0 ? `tổng ${total.toLocaleString("vi-VN")} đ cho ${courses.length} khóa` : ""
        ].filter(Boolean).join(" · "),
        crmRef: record.id
      });
    }
  }
  return { records: records.length, rows, skipped };
}
