// The "paid customers" table (name, email, phone, course) that a class manager pastes from the CRM export
// or a spreadsheet. Parsing and course matching are shared by the import dialog (preview) and the API.

export type PaidImportRow = {
  name: string;
  email: string;
  phone?: string;
  course: string;
  amount?: number;
  sectionCode?: string;
  note?: string;
  // Id of the source revenue record, kept in the payment reference. Not a CRM deal id.
  crmRef?: string;
};

export type PaidTableParseResult = {
  rows: PaidImportRow[];
  errors: Array<{ line: number; reason: string }>;
  headerDetected: boolean;
};

type ColumnKey = Exclude<keyof PaidImportRow, "crmRef">;

/** Lower-case, without Vietnamese diacritics, with every run of other characters collapsed to one space. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_SYNONYMS: Record<ColumnKey, string[]> = {
  name: ["ho ten", "ho va ten", "ten", "name", "full name", "fullname", "khach hang", "ten khach hang", "hoc vien", "ten hoc vien", "ho ten hoc vien"],
  email: ["email", "gmail", "mail", "e mail", "dia chi email", "email hoc vien"],
  phone: ["sdt", "so dien thoai", "dien thoai", "phone", "so dt", "mobile", "tel", "so phone"],
  course: ["khoa hoc", "khoa", "course", "san pham", "ten khoa hoc", "khoa dang ky", "khoa hoc dang ky", "ten khoa"],
  amount: ["so tien", "da thanh toan", "thanh toan", "hoc phi", "amount", "gia tri", "doanh thu", "so tien da thanh toan", "so tien thanh toan"],
  sectionCode: ["lop", "ma lop", "class", "lop hoc", "ma lop hoc"],
  note: ["ghi chu", "note", "ma don", "ma deal", "deal", "reference", "ma giao dich", "ma don hang"]
};

const POSITIONAL_COLUMNS: ColumnKey[] = ["name", "email", "phone", "course", "amount", "sectionCode", "note"];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectDelimiter(lines: string[]): string {
  if (lines.some(line => line.includes("\t"))) return "\t";
  const count = (char: string) => lines.reduce((sum, line) => sum + line.split(char).length - 1, 0);
  return count(";") > count(",") ? ";" : ",";
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }
  cells.push(value.trim());
  return cells;
}

function headerColumns(cells: string[]): Map<number, ColumnKey> | null {
  const columns = new Map<number, ColumnKey>();
  cells.forEach((cell, index) => {
    const normalized = normalizeText(cell);
    if (!normalized) return;
    const key = (Object.keys(HEADER_SYNONYMS) as ColumnKey[]).find(candidate => HEADER_SYNONYMS[candidate].includes(normalized));
    if (key && !Array.from(columns.values()).includes(key)) columns.set(index, key);
  });
  const found = new Set(columns.values());
  return found.has("email") && (found.has("name") || found.has("course")) ? columns : null;
}

/** "3.500.000 đ", "3,500,000" and "3500000" all mean 3500000. */
export function parseAmount(value: string | undefined): number | undefined {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : undefined;
}

/**
 * Reads pasted spreadsheet cells (tab-separated) or CSV text. A header row is recognised by its column
 * names in Vietnamese or English; without one the columns are read as: name, email, phone, course,
 * amount, class code, note.
 */
export function parsePaidTable(text: string): PaidTableParseResult {
  const lines = String(text || "")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((content, index) => ({ content, line: index + 1 }))
    .filter(item => item.content.trim());
  const result: PaidTableParseResult = { rows: [], errors: [], headerDetected: false };
  if (lines.length === 0) return result;

  const delimiter = detectDelimiter(lines.map(item => item.content));
  const header = headerColumns(splitLine(lines[0].content, delimiter));
  result.headerDetected = Boolean(header);
  const columns = header || new Map<number, ColumnKey>(POSITIONAL_COLUMNS.map((key, index) => [index, key]));
  const seenKeys = new Set<string>();

  for (const item of header ? lines.slice(1) : lines) {
    const cells = splitLine(item.content, delimiter);
    const values: Partial<Record<ColumnKey, string>> = {};
    columns.forEach((key, index) => {
      if (cells[index]) values[key] = cells[index];
    });

    const email = String(values.email || "").toLowerCase();
    const name = String(values.name || "").trim();
    const course = String(values.course || "").trim();
    if (!email && !name && !course) continue;
    if (!EMAIL_PATTERN.test(email)) {
      result.errors.push({ line: item.line, reason: `Email không hợp lệ: "${values.email || ""}".` });
      continue;
    }
    if (name.length < 2) {
      result.errors.push({ line: item.line, reason: `Thiếu họ tên của ${email}.` });
      continue;
    }
    if (!course) {
      result.errors.push({ line: item.line, reason: `Thiếu khóa học của ${email}.` });
      continue;
    }
    const key = `${email}|${normalizeText(course)}`;
    if (seenKeys.has(key)) {
      result.errors.push({ line: item.line, reason: `Trùng dòng: ${email} đã có khóa "${course}" ở phía trên.` });
      continue;
    }
    seenKeys.add(key);

    result.rows.push({
      name,
      email,
      phone: values.phone ? values.phone.trim() : undefined,
      course,
      amount: parseAmount(values.amount),
      sectionCode: values.sectionCode ? values.sectionCode.trim() : undefined,
      note: values.note ? values.note.trim() : undefined
    });
  }
  return result;
}

export type MatchableCourse = { id: string; title: string; tags?: string[] };

export type CourseMatch<T extends MatchableCourse> =
  | { course: T; candidates: T[] }
  | { course: null; candidates: T[]; reason: "none" | "ambiguous" };

/** The part of a title before its tagline: "AI for Work: Tối ưu hiệu suất..." -> "AI for Work". */
const titleHead = (title: string) => title.split(/[:–—|]| - /)[0];

/** Normalised text without any separators: "AI_AGENT", "AI Agent" and "AIAGENT" all give "aiagent". */
const compact = (value: string) => normalizeText(value).replace(/[^a-z0-9]/g, "");

// Course codes the CRM writes in a way the rules below cannot derive from the catalogue code or title.
const COURSE_CODE_ALIASES: Record<string, string> = {
  ai4work: "aiforwork",
  aiwork: "aiforwork",
  aiagent: "aiagent",
  aiautomation: "aiautomation",
  aiauto: "aiautomation",
  ailead: "aicholanhdao",
  aileader: "aicholanhdao",
  airsearch: "aiforresearch",
  airesearch: "aiforresearch",
  pbi1: "powerbilevel1",
  pbilv1: "powerbilevel1",
  pbi2: "powerbilevel2",
  pbilv2: "powerbilevel2"
};

/**
 * Finds the course a table row refers to: by id, catalogue code (tag), full title, the title before
 * its tagline, the same code or title written without separators (CRM codes such as "AIAGENT"), or a
 * unique partial title. Each rule must single out exactly one course.
 */
export function matchCourse<T extends MatchableCourse>(input: string, courses: T[]): CourseMatch<T> {
  const raw = String(input || "").trim();
  const wanted = normalizeText(raw);
  if (!wanted) return { course: null, candidates: [], reason: "none" };
  const rawCompact = compact(raw);
  const wantedCompact = COURSE_CODE_ALIASES[rawCompact] || rawCompact;

  const rules: Array<(course: T) => boolean> = [
    course => course.id === raw,
    course => (course.tags || []).some(tag => normalizeText(tag) === wanted && normalizeText(tag) !== "mcna"),
    course => normalizeText(course.title) === wanted,
    course => normalizeText(titleHead(course.title)) === wanted,
    course => (course.tags || []).some(tag => {
      const c = compact(tag);
      return (c === wantedCompact || (COURSE_CODE_ALIASES[c] || c) === wantedCompact) && c !== "mcna";
    }),
    course => {
      const h = compact(titleHead(course.title));
      return h === wantedCompact || (COURSE_CODE_ALIASES[h] || h) === wantedCompact;
    },
    course => {
      const full = compact(course.title);
      return full.startsWith(wantedCompact) || full.includes(wantedCompact);
    },
    course => ` ${normalizeText(course.title)} `.includes(` ${wanted} `)
  ];

  for (const rule of rules) {
    const candidates = courses.filter(rule);
    if (candidates.length === 1) return { course: candidates[0], candidates };
    if (candidates.length > 1) return { course: null, candidates, reason: "ambiguous" };
  }
  return { course: null, candidates: [], reason: "none" };
}

// ---- Import results (API response of /api/admin/paid-enrollments/import) ----

export type PaidImportRowStatus = "ready" | "created" | "linked" | "skipped" | "error";

export type PaidImportRowResult = {
  row: number;
  name: string;
  email: string;
  course: string;
  courseId?: string;
  courseTitle?: string;
  // ready: preview only; created: new account; linked: existing account; skipped: already enrolled.
  status: PaidImportRowStatus;
  accountCreated: boolean;
  enrollmentId?: string;
  accountEmail?: "sent" | "mock" | "failed";
  message: string;
  warnings: string[];
};

export type PaidImportSummary = {
  total: number;
  accountsCreated: number;
  enrollmentsCreated: number;
  paymentsConfirmed: number;
  skipped: number;
  errors: number;
  accountEmailsSent: number;
  accountEmailsFailed: number;
  // SMTP is not configured on the server: the email was only written to the test log, nothing reached the learner.
  accountEmailsNotSent: number;
};

export type PaidImportResponse = { results: PaidImportRowResult[]; summary: PaidImportSummary };
