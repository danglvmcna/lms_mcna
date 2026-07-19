import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import os from "os";

// Setup multer for file uploads
let uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn(`Could not create ${uploadDir}, falling back to OS temp dir for uploads.`);
  uploadDir = path.join(os.tmpdir(), "lms_uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || "upload";
    cb(null, `${uniqueSuffix}-${base}${ext}`);
  }
});
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024; // 50MB
const allowedUploadExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".txt", ".md", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip",
  ".mp4", ".mov", ".avi", ".mkv", ".webm"
]);
const allowedUploadMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm"
]);
const uploadFileFilter = (_req: express.Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  const blockedExtensions = new Set([".svg", ".html", ".htm", ".js", ".svgz"]);
  const blockedMimeTypes = new Set(["image/svg+xml", "text/html", "application/javascript", "text/javascript"]);
  if (blockedExtensions.has(ext) || blockedMimeTypes.has(mime)) {
    const err = new Error("Unsupported file type. Security restrictions explicitly block SVG, HTML, and Javascript files.");
    (err as any).status = 400;
    cb(err, false);
    return;
  }

  if (allowedUploadExtensions.has(ext) && allowedUploadMimeTypes.has(mime)) {
    cb(null, true);
    return;
  }
  const err = new Error("Unsupported file type. Allowed uploads: raster images, PDF, office documents, text/CSV/Markdown, ZIP archives, and video files.");
  (err as any).status = 400;
  cb(err, false);
};
const upload = multer({ storage, fileFilter: uploadFileFilter, limits: { fileSize: MAX_UPLOAD_FILE_BYTES } }); // 10GB limit

import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { getInitialStore } from "./src/store";
import { hashPassword, verifyPassword } from "./src/authHash";
import { LMSDataStore, User } from "./src/types";
import { runMigrations } from "./src/dbMigrations";
import { pool, Queryable } from "./src/server/db";
import { redis, safeRedis } from "./src/server/redis";
import { generateId } from "./src/server/ids";
import { DbUserRow, toPublicUser, tuitionFeeFromRow, parseSchedule, courseSectionFromRow } from "./src/server/mappers";
import { validateBody, schemas } from "./src/server/validation";
import { seedAuthUsers, seedCoreLearningData } from "./src/server/seedCore";
import { usersRepository } from "./src/server/repositories/users";
import { coursesRepository } from "./src/server/repositories/courses";
import { enrollmentsRepository } from "./src/server/repositories/enrollments";
import { quizzesRepository } from "./src/server/repositories/quizzes";
import { assignmentsRepository } from "./src/server/repositories/assignments";
import { financeRepository } from "./src/server/repositories/finance";
import { academicsRepository } from "./src/server/repositories/academics";
import { auditRepository } from "./src/server/repositories/audit";
import { limitStoreForRole, storeSnapshotFromDb, invalidateStoreCache } from "./src/server/repositories/storeSnapshot";
import { advisorsRepository } from "./src/server/repositories/advisors";
import { parentRepository } from "./src/server/repositories/parent";
import { courseRegistrationsRepository } from "./src/server/repositories/courseRegistrations";
import { gradeAppealsRepository } from "./src/server/repositories/gradeAppeals";
import { leaveRequestsRepository } from "./src/server/repositories/leaveRequests";
import { graduationRepository } from "./src/server/repositories/graduation";
import { scholarshipsRepository } from "./src/server/repositories/scholarships";
import { notificationsRepository } from "./src/server/repositories/notifications";
import { notifyStudent, notifyRole } from "./src/server/notify";
import { attendanceRepository } from "./src/server/repositories/attendance";
import { forumRepository } from "./src/server/repositories/forum";
import { sectionsRepository } from "./src/server/repositories/sections";
import { eventBus } from "./src/server/eventBus";
import { registerEventHandlers } from "./src/server/eventHandlers";
import { toGradePoint, toLetterGrade } from "./src/server/gpaCalculator";
import { startScheduler } from "./src/server/scheduler";
import { provisioningService } from "./src/server/emailProvisioning/provisioningService";
import { deleteSchoolEmail } from "./src/server/emailProvisioning/googleWorkspaceClient";
import { sendPasswordResetLinkEmail } from "./src/server/emailProvisioning/emailWorker";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is required in production.");
  }
  console.warn("JWT_SECRET not set - using insecure dev default. Never deploy this.");
}
const JWT_SECRET_VALUE = JWT_SECRET || "dev-only-e16-lms-secret-do-not-use-in-prod";
const csrfSafeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET;
let PAYMENT_WEBHOOK_SECRET_VALUE = PAYMENT_WEBHOOK_SECRET;
if (!PAYMENT_WEBHOOK_SECRET) {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
    PAYMENT_WEBHOOK_SECRET_VALUE = crypto.randomBytes(32).toString("hex");
    console.warn("WARNING: PAYMENT_WEBHOOK_SECRET environment variable is not set. Using a secure random value generated at runtime; payment webhooks will be rejected.");
  } else {
    PAYMENT_WEBHOOK_SECRET_VALUE = "dev-only-payment-webhook-secret-do-not-use-in-prod";
  }
}
const configuredWebhookToleranceSeconds = Number(process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS || 300);
const PAYMENT_WEBHOOK_TOLERANCE_SECONDS = Number.isFinite(configuredWebhookToleranceSeconds) && configuredWebhookToleranceSeconds > 0
  ? configuredWebhookToleranceSeconds
  : 300;
const configuredPasswordResetTokenTtlMinutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Number.isFinite(configuredPasswordResetTokenTtlMinutes) && configuredPasswordResetTokenTtlMinutes > 0
  ? configuredPasswordResetTokenTtlMinutes
  : 30;

app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString("utf8");
  }
}));

app.use("/uploads", express.static(uploadDir, {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

app.post("/api/upload", requireCsrf, requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});


// Middleware tự động xóa cache khi có bất kỳ yêu cầu thay đổi dữ liệu nào
app.use((req, _res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    invalidateStoreCache();
  }
  next();
});

type AuthRequest = express.Request & { user?: User; linkedStudentId?: string };
type AsyncRoute = (req: AuthRequest, res: express.Response, next: express.NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncRoute) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

type StudentProfileDefaults = {
  programId?: string;
  departmentId?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  guardianName?: string;
  guardianPhone?: string;
  className?: string;
};

type UserCreateInput = {
  email: string;
  name: string;
  role: User["role"];
  phone?: string;
  linkedStudentId?: string;
  programId?: string;
  departmentId?: string;
  className?: string;
};

async function resolveStudentProgramDefaults(db: Queryable, programId?: string, departmentId?: string) {
  if (programId) {
    const row = (await db.query(
      `SELECT p.id AS program_id, p.department_id
       FROM programs p
       WHERE p.id = $1 AND ($2::text IS NULL OR p.department_id = $2)
       LIMIT 1`,
      [programId, departmentId || null]
    )).rows[0];
    if (row) {
      return { programId: row.program_id as string, departmentId: row.department_id as string };
    }
  }

  if (departmentId) {
    const row = (await db.query(
      `SELECT p.id AS program_id, p.department_id
       FROM programs p
       WHERE p.department_id = $1
       ORDER BY p.id
       LIMIT 1`,
      [departmentId]
    )).rows[0];
    if (row) {
      return { programId: row.program_id as string, departmentId: row.department_id as string };
    }
  }

  const row = (await db.query(
    `SELECT p.id AS program_id, p.department_id
     FROM programs p
     ORDER BY p.id
     LIMIT 1`
  )).rows[0];
  if (!row) {
    const err = new Error("No academic program is configured for student profile creation.");
    (err as any).status = 400;
    throw err;
  }
  return { programId: row.program_id as string, departmentId: row.department_id as string };
}

async function generateStudentCode(db: Queryable) {
  const prefix = `SV${new Date().getFullYear()}`;
  const latest = (await db.query(
    "SELECT student_code FROM student_profiles WHERE student_code LIKE $1 AND student_code ~ $2 ORDER BY student_code DESC LIMIT 1",
    [`${prefix}%`, `^${prefix}[0-9]+$`]
  )).rows[0]?.student_code as string | undefined;
  const suffix = latest?.startsWith(prefix) && /^\d+$/.test(latest.slice(prefix.length))
    ? Number(latest.slice(prefix.length))
    : 0;
  return `${prefix}${String(suffix + 1).padStart(4, "0")}`;
}

async function ensureStudentProfile(db: Queryable, userId: string, defaults: StudentProfileDefaults = {}) {
  const exists = (await db.query("SELECT id FROM student_profiles WHERE user_id = $1", [userId])).rowCount;
  if (exists) return false;

  const { programId, departmentId } = await resolveStudentProgramDefaults(db, defaults.programId, defaults.departmentId);
  const enrollmentDate = new Date().toISOString().slice(0, 10);
  const expectedGraduation = new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO student_profiles (
       id, user_id, student_code, program_id, department_id, academic_year, enrollment_date,
       expected_graduation, status, gpa, total_credits_earned, phone, date_of_birth, gender,
       address, guardian_name, guardian_phone, class_name
     ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, 'active', 0.0, 0, $8, $9, $10, $11, $12, $13, $14)`,
    [
      generateId("profile"),
      userId,
      await generateStudentCode(db),
      programId,
      departmentId,
      enrollmentDate,
      expectedGraduation,
      defaults.phone || null,
      defaults.dateOfBirth || null,
      defaults.gender || null,
      defaults.address || null,
      defaults.guardianName || null,
      defaults.guardianPhone || null,
      defaults.className || null
    ]
  );
  return true;
}

async function createUserAccount(db: Queryable, input: UserCreateInput, password: string) {
  const credential = hashPassword(password);
  const user: User = {
    id: generateId("user"),
    email: input.email.toLowerCase().trim(),
    passwordHash: credential.hash,
    passwordSalt: credential.salt,
    name: input.name.trim(),
    role: input.role,
    isActive: true,
    phone: input.phone,
    linkedStudentId: input.linkedStudentId,
    createdAt: new Date().toISOString()
  };
  const created = await usersRepository.create(db, user);
  if (created.role === "student") {
    await ensureStudentProfile(db, created.id, {
      programId: input.programId,
      departmentId: input.departmentId,
      phone: input.phone,
      className: input.className
    });
  }
  return created;
}

function generateTemporaryPassword() {
  return `Lms-${crypto.randomBytes(8).toString("base64url")}-1`;
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function passwordResetUrl(req: express.Request, token: string) {
  const baseUrl = (process.env.LMS_LOGIN_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`).replace(/\/$/, "");
  return `${baseUrl}/?resetToken=${encodeURIComponent(token)}`;
}

function parseWebhookTimestamp(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return parseWebhookTimestamp(asNumber);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isWebhookTimestampFresh(timestamp: Date) {
  return Math.abs(Date.now() - timestamp.getTime()) <= PAYMENT_WEBHOOK_TOLERANCE_SECONDS * 1000;
}

async function logSystemAudit(action: string, target: string, detail: string) {
  const user = (await pool.query(
    "SELECT id FROM users WHERE id = 'user_admin' OR lower(email) = 'admin@mcna.local' ORDER BY CASE WHEN id = 'user_admin' THEN 0 ELSE 1 END LIMIT 1"
  )).rows[0];
  if (!user?.id) return;
  await auditRepository.log(pool, user.id, action, target, detail);
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signToken(user: User): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET_VALUE).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

async function verifyToken(token: string): Promise<{ sub: string } | null> {
  if (await safeRedis(() => redis.exists(`revoked:${token}`), 0) === 1) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET_VALUE).update(`${header}.${payload}`).digest("base64url");
  const sigBuffer = Buffer.from(signature, "base64url");
  const expBuffer = Buffer.from(expected, "base64url");
  if (sigBuffer.byteLength !== expBuffer.byteLength) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

function setAuthCookie(res: express.Response, token: string) {
  const secure = (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") ? "; Secure" : "";
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
  res.setHeader("Set-Cookie", `e16_lms_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}${domain}`);
}

function setCsrfCookie(res: express.Response, token: string) {
  const secure = (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") ? "; Secure" : "";
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
  res.append("Set-Cookie", `e16_lms_csrf=${token}; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}${domain}`);
}

function clearAuthCookie(res: express.Response) {
  res.setHeader("Set-Cookie", [
    "e16_lms_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    "e16_lms_csrf=; SameSite=Lax; Path=/; Max-Age=0"
  ]);
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const match = (req.header("Cookie") || "").match(/(?:^|;\s*)e16_lms_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractCookie(req: express.Request, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (req.header("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function rateLimitLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:login:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 10;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);

    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function rateLimitResetPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:resetpwd:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 5;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);

    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many password reset attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function rateLimitBulkImport(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:bulkimport:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 3;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);

    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many bulk import attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requireCsrf(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (csrfSafeMethods.has(req.method)) return next();
  if (req.path === "/auth/login" || req.path === "/api/auth/login") return next();
  if (req.path === "/auth/reset-password/complete" || req.path === "/api/auth/reset-password/complete") return next();
  if (req.path === "/payments/webhook" || req.path === "/webhooks/payment" || req.path === "/api/payments/webhook" || req.path === "/api/webhooks/payment") return next();
  const cookieToken = extractCookie(req, "e16_lms_csrf");
  const headerToken = req.header("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(`[CSRF] Rejected ${req.method} ${req.originalUrl} — cookie=${cookieToken ? "present" : "MISSING"}, header=${headerToken ? "present" : "MISSING"}, match=${cookieToken === headerToken}`);
    return res.status(403).json({ error: "Invalid CSRF token.", debug: { hasCookie: !!cookieToken, hasHeader: !!headerToken } });
  }
  next();
}

async function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing session." });
    const payload = await verifyToken(token);
    if (!payload) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Invalid or expired session." });
    }
    const user = await usersRepository.findById(pool, payload.sub);
    if (!user || !user.isActive) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "User is not available." });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(roles: Array<User["role"]>) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Permission denied." });
    next();
  };
}

async function resolveLinkedStudent(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    const linkedStudentId = await parentRepository.getLinkedStudent(pool, req.user!.id);
    if (!linkedStudentId) return res.status(403).json({ error: "No linked student found for this parent account." });
    req.linkedStudentId = linkedStudentId;
    next();
  } catch (error) {
    next(error);
  }
}

async function audit(req: AuthRequest, action: string, target: string, detail: string) {
  if (!req.user) return;
  await auditRepository.log(pool, req.user.id, action, target, detail);
}

function certificateFromRow(row: any) {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    studentId: row.student_id,
    courseId: row.course_id,
    issuedAt: row.issued_at,
    certificateCode: row.certificate_code
  };
}

async function generateCertificateCode(db: Queryable) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    const code = `MCNA-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    const existing = await db.query("SELECT 1 FROM certificates WHERE certificate_code = $1", [code]);
    if (existing.rowCount === 0) return code;
  }
  return `MCNA-${Date.now().toString(36).toUpperCase()}`;
}

async function maybePostFinalCourseGrade(db: Queryable, studentId: string, courseId: string) {
  const assignments = (await db.query(
    `SELECT a.id, a.max_score, s.score
     FROM assignments a
     LEFT JOIN LATERAL (
       SELECT score
       FROM submissions
       WHERE assignment_id = a.id
         AND student_id = $2
         AND score IS NOT NULL
       ORDER BY graded_at DESC NULLS LAST, submitted_at DESC
       LIMIT 1
     ) s ON true
     WHERE a.course_id = $1`,
    [courseId, studentId]
  )).rows;

  const quizzes = (await db.query(
    `SELECT q.id, qa.score
     FROM quizzes q
     LEFT JOIN LATERAL (
       SELECT score
       FROM quiz_attempts
       WHERE quiz_id = q.id
         AND student_id = $2
       ORDER BY score DESC, submitted_at DESC
       LIMIT 1
     ) qa ON true
     WHERE q.course_id = $1`,
    [courseId, studentId]
  )).rows;

  if (assignments.length === 0 && quizzes.length === 0) return null;

  let assignmentPercent: number | null = null;
  if (assignments.length > 0) {
    if (assignments.some((row: any) => row.score === null || row.score === undefined)) return null;
    assignmentPercent = assignments.reduce((sum: number, row: any) => {
      const maxScore = Math.max(1, Number(row.max_score || 1));
      return sum + (Number(row.score) / maxScore) * 100;
    }, 0) / assignments.length;
  }

  let quizPercent: number | null = null;
  if (quizzes.length > 0) {
    if (quizzes.some((row: any) => row.score === null || row.score === undefined)) return null;
    quizPercent = quizzes.reduce((sum: number, row: any) => sum + Number(row.score || 0), 0) / quizzes.length;
  }

  const rawFinalScore = assignmentPercent !== null && quizPercent !== null
    ? assignmentPercent * 0.3 + quizPercent * 0.7
    : assignmentPercent ?? quizPercent;
  if (rawFinalScore === null || rawFinalScore === undefined) return null;

  const finalScore = Math.round(rawFinalScore * 100) / 100;
  const letterGrade = toLetterGrade(finalScore);
  const gradePoint = toGradePoint(letterGrade);
  const postedAt = new Date().toISOString();
  const updated = (await db.query(
    `WITH target_registration AS (
       SELECT cr.id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = $1
         AND cs.course_id = $2
         AND cr.status NOT IN ('dropped', 'waitlisted', 'withdrawn')
       ORDER BY cr.registered_at DESC
       LIMIT 1
     )
     UPDATE course_registrations cr
     SET grade = $3,
         letter_grade = $4,
         grade_point = $5,
         grade_posted_at = $6
     FROM target_registration target
     WHERE cr.id = target.id
       AND (
         cr.grade IS DISTINCT FROM $3
         OR cr.letter_grade IS DISTINCT FROM $4
         OR cr.grade_point IS DISTINCT FROM $5
         OR cr.grade_posted_at IS NULL
       )
     RETURNING cr.id`,
    [studentId, courseId, finalScore, letterGrade, gradePoint, postedAt]
  )).rows;

  for (const row of updated) {
    await eventBus.emit("grade.saved", { studentId, courseRegistrationId: row.id, grade: letterGrade }, pool);
  }

  return { studentId, courseId, finalScore, letterGrade, gradePoint, registrationIds: updated.map((row: any) => row.id) };
}

async function maybePostFinalCourseGradeForQuiz(db: Queryable, studentId: string, quizId: string) {
  const quiz = (await db.query("SELECT course_id FROM quizzes WHERE id = $1", [quizId])).rows[0];
  if (!quiz) return null;
  return maybePostFinalCourseGrade(db, studentId, quiz.course_id);
}

async function hasConfirmedPaymentForCoursePlacement(db: Queryable, studentId: string, courseId: string): Promise<boolean> {
  const course = (await db.query("SELECT price FROM courses WHERE id = $1", [courseId])).rows[0];
  if (!course) return false;
  if (Number(course.price || 0) <= 0) return true;

  const approvedPayment = (await db.query(
    `SELECT id
     FROM transactions
     WHERE student_id = $1
       AND course_id = $2
       AND status = 'approved'
     LIMIT 1`,
    [studentId, courseId]
  )).rows[0];
  return Boolean(approvedPayment);
}

async function maybePostFinalCourseGradeForSubmission(db: Queryable, submissionId: string) {
  const submission = (await db.query(
    `SELECT s.student_id, a.course_id
     FROM submissions s
     JOIN assignments a ON a.id = s.assignment_id
     WHERE s.id = $1`,
    [submissionId]
  )).rows[0];
  if (!submission) return null;
  return maybePostFinalCourseGrade(db, submission.student_id, submission.course_id);
}

async function maybePostGradeEntry(
  db: Queryable,
  studentId: string,
  sourceType: "quiz" | "assignment",
  sourceId: string,
  score: number,
  maxScore: number = 100
) {
  try {
    let courseId = "";
    if (sourceType === "quiz") {
      const res = await db.query(
        `SELECT q.course_id
         FROM quizzes q
         JOIN quiz_attempts qa ON qa.quiz_id = q.id
         WHERE qa.id = $1`,
        [sourceId]
      );
      courseId = res.rows[0]?.course_id;
    } else if (sourceType === "assignment") {
      const res = await db.query(
        `SELECT a.course_id
         FROM assignments a
         JOIN submissions s ON s.assignment_id = a.id
         WHERE s.id = $1`,
        [sourceId]
      );
      courseId = res.rows[0]?.course_id;
    }

    if (!courseId) {
      console.warn(`[maybePostGradeEntry] Could not find courseId for sourceId: ${sourceId}`);
      return;
    }

    const existing = await db.query(
      `SELECT id FROM grades WHERE source_type = $1 AND source_id = $2`,
      [sourceType, sourceId]
    );

    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE grades SET score = $1, max_score = $2 WHERE id = $3`,
        [score, maxScore, existing.rows[0].id]
      );
    } else {
      const gradeId = generateId("grd");
      const createdAt = new Date().toISOString();
      await db.query(
        `INSERT INTO grades (id, student_id, course_id, source_type, source_id, score, max_score, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [gradeId, studentId, courseId, sourceType, sourceId, score, maxScore, createdAt]
      );
    }
  } catch (err) {
    console.error("[maybePostGradeEntry] Failed to write grade entry:", err);
  }
}

type SectionScheduleSlot = { dayOfWeek: string; startTime: string; endTime: string; room?: string; specificDate?: string };
type SectionPayload = {
  id?: string;
  courseId: string;
  semesterId: string;
  teacherId: string;
  sectionCode: string;
  maxStudents: number;
  schedule: SectionScheduleSlot[];
  status: "pending" | "open" | "closed" | "cancelled";
  openingDate?: string;
  numberOfSessions?: number;
};

const normalizeDayText = (value: any) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const dayOfWeekIndex = (value: any) => {
  const text = normalizeDayText(value);
  if (text.includes("sun") || text.includes("chu nhat")) return 0;
  if (text.includes("mon") || text.includes("hai")) return 1;
  if (text.includes("tue") || text.includes("ba")) return 2;
  if (text.includes("wed") || text.includes("tu")) return 3;
  if (text.includes("thu") || text.includes("nam")) return 4;
  if (text.includes("fri") || text.includes("sau")) return 5;
  if (text.includes("sat") || text.includes("bay")) return 6;
  return null;
};

const addDaysIso = (dateOnly: string, days: number) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isDateOnlyText = (value: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10));
const normalizeDateOnly = (value: any, fallback = new Date().toISOString().slice(0, 10)) => {
  const dateOnly = String(value || "").slice(0, 10);
  return isDateOnlyText(dateOnly) ? dateOnly : fallback;
};

const nextDateForSlot = (fromDate: string, slot: SectionScheduleSlot, cycle: number) => {
  if (slot.specificDate) return addDaysIso(normalizeDateOnly(slot.specificDate, fromDate), cycle * 7);
  const targetDay = dayOfWeekIndex(slot.dayOfWeek);
  if (targetDay === null) return addDaysIso(fromDate, cycle * 7);
  const [year, month, day] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const currentDay = start.getUTCDay();
  const delta = (targetDay - currentDay + 7) % 7;
  return addDaysIso(fromDate, delta + cycle * 7);
};

const dateTimeForSlot = (dateOnly: string, slot?: SectionScheduleSlot | null) => {
  const startTime = String(slot?.startTime || "").trim();
  return /^\d{2}:\d{2}$/.test(startTime) ? `${dateOnly}T${startTime}:00` : dateOnly;
};

const scheduleSlotTime = (slot: any, key: "start" | "end") => String(
  key === "start"
    ? slot?.startTime || slot?.start_time || ""
    : slot?.endTime || slot?.end_time || ""
).trim();

const scheduleSlotRoom = (slot: any) => String(slot?.room || "").trim();

const scheduleSlotDayLabel = (slot: any) => String(slot?.dayOfWeek || slot?.day_of_week || slot?.specificDate || slot?.specific_date || "").trim();

const timeToMinutes = (value: any) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const slotDateDayIndex = (slot: any) => {
  const specificDate = String(slot?.specificDate || slot?.specific_date || "").slice(0, 10);
  if (!isDateOnlyText(specificDate)) return null;
  const [year, month, day] = specificDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const slotsOccurOnSameDay = (left: any, right: any) => {
  const leftDate = String(left?.specificDate || left?.specific_date || "").slice(0, 10);
  const rightDate = String(right?.specificDate || right?.specific_date || "").slice(0, 10);
  if (isDateOnlyText(leftDate) && isDateOnlyText(rightDate)) return leftDate === rightDate;

  const leftDay = slotDateDayIndex(left) ?? dayOfWeekIndex(left?.dayOfWeek || left?.day_of_week);
  const rightDay = slotDateDayIndex(right) ?? dayOfWeekIndex(right?.dayOfWeek || right?.day_of_week);
  return leftDay !== null && rightDay !== null && leftDay === rightDay;
};

const slotsOverlap = (left: any, right: any) => {
  if (!slotsOccurOnSameDay(left, right)) return false;
  const leftStart = timeToMinutes(scheduleSlotTime(left, "start"));
  const leftEnd = timeToMinutes(scheduleSlotTime(left, "end"));
  const rightStart = timeToMinutes(scheduleSlotTime(right, "start"));
  const rightEnd = timeToMinutes(scheduleSlotTime(right, "end"));
  if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) return false;
  return leftStart < rightEnd && rightStart < leftEnd;
};

async function validateCourseSectionScheduleConflicts(db: Queryable, section: SectionPayload) {
  const schedule = Array.isArray(section.schedule) ? section.schedule : [];
  const errors: string[] = [];

  for (const slot of schedule) {
    const start = timeToMinutes(scheduleSlotTime(slot, "start"));
    const end = timeToMinutes(scheduleSlotTime(slot, "end"));
    if (start === null || end === null || start >= end) {
      errors.push(`Invalid class time for ${scheduleSlotDayLabel(slot) || "schedule slot"}: ${scheduleSlotTime(slot, "start")} - ${scheduleSlotTime(slot, "end")}.`);
    }
  }

  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      if (slotsOverlap(schedule[i], schedule[j])) {
        errors.push(`This class has overlapping schedule slots on ${scheduleSlotDayLabel(schedule[i]) || "the same day"}.`);
      }
    }
  }

  if (!section.teacherId || !section.semesterId || schedule.length === 0) return errors;

  const existingSections = (await db.query(
    `SELECT cs.*, c.title AS course_title, u.name AS teacher_name
     FROM course_sections cs
     LEFT JOIN courses c ON c.id = cs.course_id
     LEFT JOIN users u ON u.id = cs.teacher_id
     WHERE cs.semester_id = $1
       AND cs.status <> 'cancelled'
       AND cs.id <> $2
       AND (cs.teacher_id = $3 OR cs.schedule IS NOT NULL OR cs.schedule_json IS NOT NULL)`,
    [section.semesterId, section.id || "", section.teacherId]
  )).rows;

  for (const existing of existingSections) {
    const existingSchedule = parseSchedule(existing);
    for (const slot of schedule) {
      for (const existingSlot of existingSchedule) {
        if (!slotsOverlap(slot, existingSlot)) continue;

        if (existing.teacher_id === section.teacherId) {
          errors.push(
            `Teacher schedule conflict with class ${existing.section_code} (${existing.course_title || "course"}) on ${scheduleSlotDayLabel(slot)} ${scheduleSlotTime(slot, "start")} - ${scheduleSlotTime(slot, "end")}.`
          );
        }

        const room = scheduleSlotRoom(slot).toLowerCase();
        const existingRoom = scheduleSlotRoom(existingSlot).toLowerCase();
        if (room && existingRoom && room === existingRoom) {
          errors.push(
            `Room schedule conflict with class ${existing.section_code} (${existing.course_title || "course"}) in room ${scheduleSlotRoom(slot)} on ${scheduleSlotDayLabel(slot)} ${scheduleSlotTime(slot, "start")} - ${scheduleSlotTime(slot, "end")}.`
          );
        }
      }
    }
  }

  return Array.from(new Set(errors));
}

const buildScheduledSessionSeed = (order: number, schedule: SectionScheduleSlot[], openingDate?: string | null) => {
  const slotCount = Math.max(schedule.length, 1);
  const slot = schedule.length > 0 ? schedule[(order - 1) % slotCount] : null;
  const cycle = Math.floor((order - 1) / slotCount);
  const baseDate = normalizeDateOnly(openingDate || slot?.specificDate);
  const date = slot ? nextDateForSlot(baseDate, slot, cycle) : addDaysIso(baseDate, order - 1);
  const time = slot ? `${slot.startTime} - ${slot.endTime}` : "";
  const room = slot?.room || "Online";
  const scheduleText = slot
    ? `${slot.dayOfWeek}, ${time}, ${room}`
    : date;
  return {
    date: dateTimeForSlot(date, slot),
    topic: `Buổi ${order}: ${scheduleText}`,
    content: slot
      ? `Lịch học theo thời khóa biểu: ${scheduleText}. Giảng viên có thể cập nhật nội dung chi tiết cho buổi học này.`
      : "Giảng viên có thể cập nhật nội dung chi tiết cho buổi học này."
  };
};

const buildLessonSeed = (order: number, schedule: SectionScheduleSlot[], openingDate?: string) => {
  const slot = schedule.length > 0 ? schedule[(order - 1) % schedule.length] : null;
  const cycle = Math.floor((order - 1) / Math.max(schedule.length, 1));
  const baseDate = normalizeDateOnly(openingDate || slot?.specificDate);
  const date = slot ? nextDateForSlot(baseDate, slot, cycle) : "";
  const time = slot ? `${slot.startTime} - ${slot.endTime}` : "";
  const room = slot?.room || "Online";
  const titleSuffix = date || time ? ` (${[date, time].filter(Boolean).join(" ")})` : "";
  return {
    title: `Buoi ${order}${titleSuffix}`,
    content: slot
      ? `Lich hoc du kien: ${slot.dayOfWeek}, ${time}, ${room}. Giang vien cap nhat ten buoi hoc va noi dung bai day tai day.`
      : "Giang vien cap nhat ten buoi hoc va noi dung bai day tai day.",
    duration: time ? `${time}${room ? ` | ${room}` : ""}` : "1 buoi"
  };
};

async function ensureCourseLessonsForSchedule(db: any, courseId: string, count?: number | null, schedule: SectionScheduleSlot[] = [], openingDate?: string | null) {
  const targetCount = Number(count || 0);
  if (!Number.isFinite(targetCount) || targetCount < 1) return;

  const existing = (await db.query(
    "SELECT lesson_order FROM lessons WHERE course_id = $1",
    [courseId]
  )).rows;
  const existingOrders = new Set(existing.map((row: any) => Number(row.lesson_order)));

  for (let order = 1; order <= targetCount; order++) {
    if (existingOrders.has(order)) continue;
    const seed = buildLessonSeed(order, schedule, openingDate || undefined);
    await db.query(
      "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [generateId("lesson"), courseId, seed.title, seed.content, null, order, seed.duration]
    );
  }
}

const isGeneratedSessionTopicForOrder = (topic: any, order: number) => {
  const normalized = normalizeDayText(topic).replace(/\s+/g, " ").trim();
  return normalized === `buoi ${order}` || normalized.startsWith(`buoi ${order}:`) || normalized.startsWith(`buoi ${order} `);
};

const generatedSessionOrder = (topic: any) => {
  const normalized = normalizeDayText(topic).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^buoi\s+(\d+)(?::|\s|$)/);
  return match ? Number(match[1]) : null;
};

async function ensureSectionAttendanceSessionsForSchedule(
  db: any,
  section: { id: string; course_id: string; semester_id: string; teacher_id: string; number_of_sessions?: number | null; opening_date?: string | null },
  schedule: SectionScheduleSlot[] = []
) {
  const targetCount = Number(section.number_of_sessions || 0);
  if (!Number.isFinite(targetCount) || targetCount < 1) return;

  const columns = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions'"
  )).rows.map((row: any) => row.column_name);
  const hasDate = columns.includes("date");
  const hasSessionDate = columns.includes("session_date");
  const hasSectionId = columns.includes("section_id");
  const hasContent = columns.includes("content");
  if (!hasSectionId) return;
  const dateOrderExpression = hasDate && hasSessionDate
    ? "COALESCE(date::text, session_date::text)"
    : hasDate
      ? "date::text"
      : hasSessionDate
        ? "session_date::text"
        : "id";

  const existing = (await db.query(
    `SELECT * FROM attendance_sessions
     WHERE section_id = $1
     ORDER BY ${dateOrderExpression}, topic, id`,
    [section.id]
  )).rows;
  const usedIds = new Set<string>();

  for (let order = 1; order <= targetCount; order++) {
    const seed = buildScheduledSessionSeed(order, schedule, section.opening_date);
    const generatedMatch = existing.find((row: any) => !usedIds.has(row.id) && isGeneratedSessionTopicForOrder(row.topic, order));
    const fallbackMatch = existing[order - 1] && !usedIds.has(existing[order - 1].id) ? existing[order - 1] : null;
    const current = generatedMatch || fallbackMatch;

    if (current) {
      usedIds.add(current.id);
      const sets = ["semester_id = $1", "teacher_id = $2"];
      const values: any[] = [section.semester_id || null, section.teacher_id];
      let paramIndex = values.length + 1;

      if (hasDate) {
        sets.push(`date = $${paramIndex++}`);
        values.push(seed.date);
      }
      if (hasSessionDate) {
        sets.push(`session_date = $${paramIndex++}`);
        values.push(seed.date.slice(0, 10));
      }
      if (isGeneratedSessionTopicForOrder(current.topic, order)) {
        sets.push(`topic = $${paramIndex++}`);
        values.push(seed.topic);
      }
      if (hasContent && !current.content) {
        sets.push(`content = $${paramIndex++}`);
        values.push(seed.content);
      }
      values.push(current.id);
      await db.query(`UPDATE attendance_sessions SET ${sets.join(", ")} WHERE id = $${paramIndex}`, values);
      continue;
    }

    const insertColumns = ["id", "course_id", "semester_id", "teacher_id", "topic"];
    const values: any[] = [generateId("ats"), section.course_id, section.semester_id || null, section.teacher_id, seed.topic];
    const placeholders = values.map((_, index) => `$${index + 1}`);
    if (hasDate) {
      insertColumns.push("date");
      values.push(seed.date);
      placeholders.push(`$${values.length}`);
    }
    if (hasSessionDate) {
      insertColumns.push("session_date");
      values.push(seed.date.slice(0, 10));
      placeholders.push(`$${values.length}`);
    }
    if (hasSectionId) {
      insertColumns.push("section_id");
      values.push(section.id);
      placeholders.push(`$${values.length}`);
    }
    if (hasContent) {
      insertColumns.push("content");
      values.push(seed.content);
      placeholders.push(`$${values.length}`);
    }
    await db.query(
      `INSERT INTO attendance_sessions (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values
    );
  }

  const excessGeneratedIds = existing
    .filter((row: any) => {
      const order = generatedSessionOrder(row.topic);
      return order !== null && (order > targetCount || !usedIds.has(row.id));
    })
    .map((row: any) => row.id);
  if (excessGeneratedIds.length > 0) {
    await db.query("DELETE FROM attendance_sessions WHERE id = ANY($1)", [excessGeneratedIds]);
  }
}

async function getCourseSectionColumnSet(db: { query: (sql: string, params?: any[]) => Promise<any> }) {
  const rows = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'course_sections'"
  )).rows;
  return new Set<string>(rows.map((row: any) => row.column_name));
}

async function upsertCourseSection(db: any, section: SectionPayload) {
  const id = section.id || generateId("section");
  const scheduleJson = JSON.stringify(section.schedule || []);
  const columns = await getCourseSectionColumnSet(db);
  const insertColumns = ["id", "course_id", "semester_id", "teacher_id", "section_code", "max_students", "status"];
  const values: any[] = [id, section.courseId, section.semesterId, section.teacherId, section.sectionCode, Number(section.maxStudents), section.status];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updates = [
    "course_id = EXCLUDED.course_id",
    "semester_id = EXCLUDED.semester_id",
    "teacher_id = EXCLUDED.teacher_id",
    "section_code = EXCLUDED.section_code",
    "max_students = EXCLUDED.max_students",
    "status = EXCLUDED.status"
  ];

  if (columns.has("schedule_json")) {
    insertColumns.push("schedule_json");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}`);
    updates.push("schedule_json = EXCLUDED.schedule_json");
  }
  if (columns.has("schedule")) {
    insertColumns.push("schedule");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}::jsonb`);
    updates.push("schedule = EXCLUDED.schedule");
  }
  if (columns.has("opening_date")) {
    insertColumns.push("opening_date");
    values.push(section.openingDate || null);
    placeholders.push(`$${values.length}`);
    updates.push("opening_date = EXCLUDED.opening_date");
  }
  if (columns.has("number_of_sessions")) {
    insertColumns.push("number_of_sessions");
    values.push(section.numberOfSessions || null);
    placeholders.push(`$${values.length}`);
    updates.push("number_of_sessions = EXCLUDED.number_of_sessions");
  }

  const row = (await db.query(
    `INSERT INTO course_sections (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}
     RETURNING *`,
    values
  )).rows[0];

  await ensureCourseLessonsForSchedule(
    db,
    row.course_id,
    row.number_of_sessions,
    parseSchedule(row),
    row.opening_date || undefined
  );
  await ensureSectionAttendanceSessionsForSchedule(db, row, parseSchedule(row));

  return courseSectionFromRow(row);
}

async function ensureScheduledSessionsForAllSections(db: any) {
  const sectionColumns = await getCourseSectionColumnSet(db);
  const numberOfSessionsSelect = sectionColumns.has("number_of_sessions") ? "cs.number_of_sessions" : "NULL";
  const openingDateSelect = sectionColumns.has("opening_date") ? "cs.opening_date" : "NULL";
  const rows = (await db.query(
    `SELECT cs.*, ${numberOfSessionsSelect} AS resolved_number_of_sessions,
            ${openingDateSelect} AS resolved_opening_date,
            c.number_of_lessons AS course_number_of_lessons,
            c.opening_date AS course_opening_date
     FROM course_sections cs
     JOIN courses c ON c.id = cs.course_id`
  )).rows;

  for (const row of rows) {
    const targetCount = Number(row.resolved_number_of_sessions || row.course_number_of_lessons || 10);
    const openingDate = row.resolved_opening_date || row.course_opening_date || undefined;
    if (sectionColumns.has("number_of_sessions") && !row.resolved_number_of_sessions) {
      await db.query("UPDATE course_sections SET number_of_sessions = $1 WHERE id = $2", [targetCount, row.id]);
    }
    await ensureCourseLessonsForSchedule(db, row.course_id, targetCount, parseSchedule(row), openingDate);
    await ensureSectionAttendanceSessionsForSchedule(
      db,
      { ...row, number_of_sessions: targetCount, opening_date: openingDate },
      parseSchedule(row)
    );
  }
}

let isSyncing = false;
const syncQueue: (() => void)[] = [];

async function syncClientStoreToDb(store: Partial<LMSDataStore>) {
  // Protect school email fields from client sync
  if (store.users) {
    for (const u of store.users) {
      delete (u as any).school_email;
      delete (u as any).schoolEmail;
      delete (u as any).email_provisioned;
      delete (u as any).emailProvisioned;
      delete (u as any).email_provisioned_at;
      delete (u as any).emailProvisionedAt;
    }
  }

  // Serialize syncs to prevent PostgreSQL deadlocks on concurrent saves
  await new Promise<void>((resolve) => {
    if (!isSyncing) {
      isSyncing = true;
      resolve();
    } else {
      syncQueue.push(resolve);
    }
  });

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Legacy snapshots are not trusted for identities or student records.
      // users and student_profiles are written only through scoped API routes.

    // Fetch existing courses to skip identical updates
    const dbCoursesRes = await client.query("SELECT id, status, rejection_reason FROM courses");
    const dbCoursesMap = new Map<string, any>(dbCoursesRes.rows.map(r => [r.id, r]));

    for (const course of store.courses || []) {
      const dbCourse = dbCoursesMap.get(course.id);
      const isDirty = !dbCourse ||
        dbCourse.status !== course.status ||
        dbCourse.rejection_reason !== (course.rejectionReason || null);

      if (isDirty) {
        await client.query(
          `UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3`,
          [course.status, course.rejectionReason || null, course.id]
        );
      }
    }

    // Sync structural tables (academic_years, semesters, departments, programs, program_courses)
    if (store.programCourses !== undefined) {
      const clientIds = (store.programCourses || []).map(x => x.id);
      if (clientIds.length > 0) {
        await client.query(`DELETE FROM program_courses WHERE id NOT IN (${clientIds.map((_, i) => `$${i + 1}`).join(", ")})`, clientIds);
      } else {
        await client.query(`DELETE FROM program_courses`);
      }
    }
    if (store.programs !== undefined) {
      const clientIds = (store.programs || []).map(x => x.id);
      if (clientIds.length > 0) {
        await client.query(`DELETE FROM programs WHERE id NOT IN (${clientIds.map((_, i) => `$${i + 1}`).join(", ")})`, clientIds);
      } else {
        await client.query(`DELETE FROM programs`);
      }
    }
    if (store.departments !== undefined) {
      const clientIds = (store.departments || []).map(x => x.id);
      if (clientIds.length > 0) {
        await client.query(`DELETE FROM departments WHERE id NOT IN (${clientIds.map((_, i) => `$${i + 1}`).join(", ")})`, clientIds);
      } else {
        await client.query(`DELETE FROM departments`);
      }
    }
    if (store.semesters !== undefined) {
      const clientIds = (store.semesters || []).map(x => x.id);
      if (clientIds.length > 0) {
        await client.query(`DELETE FROM semesters WHERE id NOT IN (${clientIds.map((_, i) => `$${i + 1}`).join(", ")})`, clientIds);
      } else {
        await client.query(`DELETE FROM semesters`);
      }
    }
    if (store.academicYears !== undefined) {
      const clientIds = (store.academicYears || []).map(x => x.id);
      if (clientIds.length > 0) {
        await client.query(`DELETE FROM academic_years WHERE id NOT IN (${clientIds.map((_, i) => `$${i + 1}`).join(", ")})`, clientIds);
      } else {
        await client.query(`DELETE FROM academic_years`);
      }
    }
    if (store.academicYears !== undefined) {
      const dbRes = await client.query("SELECT id, name, start_date, end_date, is_current FROM academic_years");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientYears = store.academicYears || [];
      for (const year of clientYears) {
        const dbVal = dbMap.get(year.id);
        const isDirty = !dbVal ||
          dbVal.name !== year.name ||
          dbVal.start_date !== year.startDate ||
          dbVal.end_date !== year.endDate ||
          Boolean(dbVal.is_current) !== Boolean(year.isCurrent);

        if (isDirty) {
          await client.query(
            `INSERT INTO academic_years (id, name, start_date, end_date, is_current)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               start_date = EXCLUDED.start_date,
               end_date = EXCLUDED.end_date,
               is_current = EXCLUDED.is_current`,
            [year.id, year.name, year.startDate, year.endDate, Boolean(year.isCurrent)]
          );
        }
      }
    }

    if (store.semesters !== undefined) {
      const dbRes = await client.query("SELECT id, academic_year_id, name, type, start_date, end_date, registration_open, registration_close, is_current FROM semesters");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientSemesters = store.semesters || [];
      for (const sem of clientSemesters) {
        const dbVal = dbMap.get(sem.id);
        const isDirty = !dbVal ||
          dbVal.academic_year_id !== (sem.academicYearId || null) ||
          dbVal.name !== sem.name ||
          dbVal.type !== (sem.type || null) ||
          dbVal.start_date !== (sem.startDate || null) ||
          dbVal.end_date !== (sem.endDate || null) ||
          dbVal.registration_open !== (sem.registrationOpen || null) ||
          dbVal.registration_close !== (sem.registrationClose || null) ||
          Boolean(dbVal.is_current) !== Boolean(sem.isCurrent);

        if (isDirty) {
          await client.query(
            `INSERT INTO semesters (id, academic_year_id, name, type, start_date, end_date, registration_open, registration_close, is_current)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               academic_year_id = EXCLUDED.academic_year_id,
               name = EXCLUDED.name,
               type = EXCLUDED.type,
               start_date = EXCLUDED.start_date,
               end_date = EXCLUDED.end_date,
               registration_open = EXCLUDED.registration_open,
               registration_close = EXCLUDED.registration_close,
               is_current = EXCLUDED.is_current`,
            [
              sem.id,
              sem.academicYearId || null,
              sem.name,
              sem.type || null,
              sem.startDate || null,
              sem.endDate || null,
              sem.registrationOpen || null,
              sem.registrationClose || null,
              Boolean(sem.isCurrent)
            ]
          );
        }
      }
    }

    if (store.departments !== undefined) {
      const dbRes = await client.query("SELECT id, name, code, head_teacher_id, description FROM departments");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientDepts = store.departments || [];
      for (const dept of clientDepts) {
        const dbVal = dbMap.get(dept.id);
        const isDirty = !dbVal ||
          dbVal.name !== dept.name ||
          dbVal.code !== dept.code ||
          dbVal.head_teacher_id !== (dept.headTeacherId || null) ||
          dbVal.description !== (dept.description || null);

        if (isDirty) {
          await client.query(
            `INSERT INTO departments (id, name, code, head_teacher_id, description)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               head_teacher_id = EXCLUDED.head_teacher_id,
               description = EXCLUDED.description`,
            [
              dept.id,
              dept.name,
              dept.code,
              dept.headTeacherId || null,
              dept.description || null
            ]
          );
        }
      }
    }

    if (store.programs !== undefined) {
      const dbRes = await client.query("SELECT id, department_id, name, code, type, total_credits, description FROM programs");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientProgs = store.programs || [];
      for (const prog of clientProgs) {
        const dbVal = dbMap.get(prog.id);
        const isDirty = !dbVal ||
          dbVal.department_id !== prog.departmentId ||
          dbVal.name !== prog.name ||
          dbVal.code !== prog.code ||
          dbVal.type !== (prog.type || "degree") ||
          Number(dbVal.total_credits) !== (Number(prog.totalCredits) || 0) ||
          dbVal.description !== (prog.description || null);

        if (isDirty) {
          await client.query(
            `INSERT INTO programs (id, department_id, name, code, type, total_credits, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               department_id = EXCLUDED.department_id,
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               type = EXCLUDED.type,
               total_credits = EXCLUDED.total_credits,
               description = EXCLUDED.description`,
            [
              prog.id,
              prog.departmentId,
              prog.name,
              prog.code,
              prog.type || "degree",
              Number(prog.totalCredits) || 0,
              prog.description || null
            ]
          );
        }
      }
    }

    if (store.programCourses !== undefined) {
      const dbRes = await client.query("SELECT id, program_id, course_id, credits, is_required, semester FROM program_courses");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientProgCourses = store.programCourses || [];
      for (const pc of clientProgCourses) {
        const dbVal = dbMap.get(pc.id);
        const isDirty = !dbVal ||
          dbVal.program_id !== pc.programId ||
          dbVal.course_id !== pc.courseId ||
          Number(dbVal.credits) !== (Number(pc.credits) || 0) ||
          Boolean(dbVal.is_required) !== Boolean(pc.isRequired) ||
          Number(dbVal.semester) !== (Number(pc.semester) || 1);

        if (isDirty) {
          await client.query(
            `INSERT INTO program_courses (id, program_id, course_id, credits, is_required, semester)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               program_id = EXCLUDED.program_id,
               course_id = EXCLUDED.course_id,
               credits = EXCLUDED.credits,
               is_required = EXCLUDED.is_required,
               semester = EXCLUDED.semester`,
            [
              pc.id,
              pc.programId,
              pc.courseId,
              Number(pc.credits) || 0,
              Boolean(pc.isRequired),
              Number(pc.semester) || 1
            ]
          );
        }
      }
    }

    if (store.notifications !== undefined) {
      const dbRes = await client.query("SELECT id, user_id, type, message, is_read, created_at FROM notifications");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientNotes = store.notifications || [];
      for (const note of clientNotes) {
        const dbVal = dbMap.get(note.id);
        const isDirty = !dbVal ||
          dbVal.user_id !== note.userId ||
          dbVal.type !== note.type ||
          dbVal.message !== note.message ||
          Boolean(dbVal.is_read) !== Boolean(note.isRead) ||
          dbVal.created_at !== note.createdAt;

        if (isDirty) {
          await client.query(
            `INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               user_id = EXCLUDED.user_id,
               type = EXCLUDED.type,
               message = EXCLUDED.message,
               is_read = EXCLUDED.is_read,
               created_at = EXCLUDED.created_at`,
            [note.id, note.userId, note.type, note.message, Boolean(note.isRead), note.createdAt]
          );
        }
      }
    }

    if (store.advisorNotes !== undefined) {
      const dbRes = await client.query("SELECT id, advisor_id, student_id, content, type, created_at FROM advisor_notes");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientNotesAdvisor = store.advisorNotes || [];
      for (const n of clientNotesAdvisor) {
        const dbVal = dbMap.get(n.id);
        const isDirty = !dbVal ||
          dbVal.advisor_id !== (n.advisorId || null) ||
          dbVal.student_id !== n.studentId ||
          dbVal.content !== n.content ||
          dbVal.type !== n.type ||
          dbVal.created_at !== n.createdAt;

        if (isDirty) {
          await client.query(
            `INSERT INTO advisor_notes (id, advisor_id, student_id, content, type, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               advisor_id = EXCLUDED.advisor_id,
               student_id = EXCLUDED.student_id,
               content = EXCLUDED.content,
               type = EXCLUDED.type,
               created_at = EXCLUDED.created_at`,
            [
              n.id,
              n.advisorId || null,
              n.studentId,
              n.content,
              n.type,
              n.createdAt
            ]
          );
        }
      }
    }

    if (store.quizzes !== undefined) {
      const dbRes = await client.query("SELECT id, course_id, lesson_id, title, passing_score, time_limit, max_attempts, attachment_url FROM quizzes");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientQuizzes = store.quizzes || [];
      for (const q of clientQuizzes) {
        const dbVal = dbMap.get(q.id);
        const isDirty = !dbVal ||
          dbVal.course_id !== q.courseId ||
          dbVal.lesson_id !== (q.lessonId || null) ||
          dbVal.title !== q.title ||
          Number(dbVal.passing_score) !== (Number(q.passingScore) || 70) ||
          Number(dbVal.time_limit) !== (Number(q.timeLimit) || 15) ||
          Number(dbVal.max_attempts) !== (Number(q.maxAttempts) || 3) ||
          dbVal.attachment_url !== (q.attachmentUrl || null);

        if (isDirty) {
          await client.query(
            `INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts, attachment_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               course_id = EXCLUDED.course_id,
               lesson_id = EXCLUDED.lesson_id,
               title = EXCLUDED.title,
               passing_score = EXCLUDED.passing_score,
               time_limit = EXCLUDED.time_limit,
               max_attempts = EXCLUDED.max_attempts,
               attachment_url = EXCLUDED.attachment_url`,
            [
              q.id,
              q.courseId,
              q.lessonId || null,
              q.title,
              Number(q.passingScore) || 70,
              Number(q.timeLimit) || 15,
              Number(q.maxAttempts) || 3,
              q.attachmentUrl || null
            ]
          );
        }
      }
    }

    if (store.questions !== undefined) {
      const dbRes = await client.query("SELECT id, quiz_id, text, type, options_json, correct_answer FROM questions");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientQuestions = store.questions || [];
      for (const qst of clientQuestions) {
        const dbVal = dbMap.get(qst.id);
        const optionsStr = JSON.stringify(qst.options || []);
        const isDirty = !dbVal ||
          dbVal.quiz_id !== qst.quizId ||
          dbVal.text !== qst.text ||
          dbVal.type !== qst.type ||
          JSON.stringify(dbVal.options_json ? (typeof dbVal.options_json === "string" ? JSON.parse(dbVal.options_json) : dbVal.options_json) : []) !== JSON.stringify(qst.options || []) ||
          dbVal.correct_answer !== qst.correctAnswer;

        if (isDirty) {
          await client.query(
            `INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               quiz_id = EXCLUDED.quiz_id,
               text = EXCLUDED.text,
               type = EXCLUDED.type,
               options_json = EXCLUDED.options_json,
               correct_answer = EXCLUDED.correct_answer,
               created_at = COALESCE(questions.created_at, EXCLUDED.created_at)`,
            [
              qst.id,
              qst.quizId,
              qst.text,
              qst.type,
              optionsStr,
              qst.correctAnswer,
              qst.createdAt || new Date().toISOString()
            ]
          );
        }
      }
    }

    if (store.courseSections !== undefined) {
      const dbRes = await client.query("SELECT id, course_id, semester_id, teacher_id, section_code, max_students, status, schedule_json, schedule, opening_date, number_of_sessions FROM course_sections");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientSections = store.courseSections || [];
      for (const sec of clientSections) {
        const dbVal = dbMap.get(sec.id);
        const sectionSchedule = parseSchedule({ schedule: sec.schedule });
        const scheduleStr = JSON.stringify(sectionSchedule);
        const sectionSessionCount = Number(sec.numberOfSessions || dbVal?.number_of_sessions || 10);
        let dbScheduleStr = "[]";
        if (dbVal) {
          dbScheduleStr = JSON.stringify(parseSchedule(dbVal));
        }

        const isDirty = !dbVal ||
          dbVal.course_id !== sec.courseId ||
          dbVal.semester_id !== sec.semesterId ||
          dbVal.teacher_id !== sec.teacherId ||
          dbVal.section_code !== sec.sectionCode ||
          Number(dbVal.max_students) !== (Number(sec.maxStudents) || 30) ||
          dbVal.status !== (sec.status || "open") ||
          dbVal.opening_date !== (sec.openingDate || null) ||
          Number(dbVal.number_of_sessions || 0) !== sectionSessionCount ||
          dbScheduleStr !== scheduleStr;

        if (isDirty) {
          await upsertCourseSection(client, {
            id: sec.id,
            courseId: sec.courseId,
            semesterId: sec.semesterId,
            teacherId: sec.teacherId,
            sectionCode: sec.sectionCode,
            maxStudents: Number(sec.maxStudents) || 30,
            schedule: sectionSchedule,
            status: sec.status || "open",
            openingDate: sec.openingDate || dbVal?.opening_date || undefined,
            numberOfSessions: sectionSessionCount
          });
        }
      }
    }

    if (store.enrollments !== undefined) {
      const dbRes = await client.query("SELECT id, course_id, student_id, status, enrolled_at, completed_at FROM enrollments");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      const clientEnrollments = store.enrollments || [];
      for (const e of clientEnrollments) {
        const dbVal = dbMap.get(e.id);
        const isDirty = !dbVal ||
          dbVal.course_id !== e.courseId ||
          dbVal.student_id !== e.studentId ||
          dbVal.status !== e.status ||
          dbVal.enrolled_at !== e.enrolledAt ||
          dbVal.completed_at !== (e.completedAt || null);

        if (isDirty && dbVal) {
          // Only update completed_at on existing enrollments — status/student_id/course_id
          // must go through proper payment/admin workflows, not client-side sync
          await client.query(
            `UPDATE enrollments SET completed_at = $1 WHERE id = $2`,
            [e.completedAt || null, e.id]
          );
        }
      }
    }

    if (store.certificates !== undefined) {
      const clientCerts = store.certificates || [];
      const clientCertIds = clientCerts.map(c => c.id);

      const dbRes = await client.query("SELECT id, enrollment_id, student_id, course_id, issued_at, certificate_code FROM certificates");
      const dbMap = new Map<string, any>(dbRes.rows.map(r => [r.id, r]));

      if (clientCertIds.length > 0) {
        await client.query(
          `DELETE FROM certificates WHERE id NOT IN (${clientCertIds.map((_, i) => `$${i + 1}`).join(", ")})`,
          clientCertIds
        );
      } else {
        await client.query(`DELETE FROM certificates`);
      }

      for (const cert of clientCerts) {
        const dbVal = dbMap.get(cert.id);
        const isDirty = !dbVal ||
          dbVal.enrollment_id !== cert.enrollmentId ||
          dbVal.student_id !== cert.studentId ||
          dbVal.course_id !== cert.courseId ||
          dbVal.issued_at !== cert.issuedAt ||
          dbVal.certificate_code !== cert.certificateCode;

        if (isDirty) {
          await client.query(
            `INSERT INTO certificates (id, enrollment_id, student_id, course_id, issued_at, certificate_code)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               enrollment_id = EXCLUDED.enrollment_id,
               student_id = EXCLUDED.student_id,
               course_id = EXCLUDED.course_id,
               issued_at = EXCLUDED.issued_at,
               certificate_code = EXCLUDED.certificate_code`,
            [
              cert.id,
              cert.enrollmentId,
              cert.studentId,
              cert.courseId,
              cert.issuedAt,
              cert.certificateCode
            ]
          );
        }
      }
    }

    // Sync courseRegistrations bypassed (server-managed only)

    await client.query("COMMIT");
    invalidateStoreCache();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (syncQueue.length > 0) {
      const next = syncQueue.shift();
      next!();
    } else {
      isSyncing = false;
    }
  }
}

function dashboardFromStore(store: any, user: User) {
  const scoped = limitStoreForRole(store, user);
  if (user.role === "manager" || user.role === "admin" || user.role === "super_admin") {
    return {
      ...scoped,
      dashboard: {
        users: scoped.users.length,
        courses: scoped.courses.length,
        pendingCourses: scoped.courses.filter((course: any) => course.status === "pending").length,
        activeEnrollments: scoped.enrollments.filter((item: any) => item.status === "active").length
      }
    };
  }
  if (user.role === "teacher") {
    return {
      ...scoped,
      dashboard: {
        courses: scoped.courses.length,
        enrollments: scoped.enrollments.length,
        submissionsToGrade: scoped.submissions.filter((item: any) => item.score === undefined).length
      }
    };
  }
  if (user.role === "student") {
    return {
      ...scoped,
      dashboard: {
        enrolledCourses: scoped.enrollments.length,
        completedLessons: scoped.lessonProgress.filter((item: any) => item.completed).length,
        unpaidFees: scoped.tuitionFees.filter((fee: any) => fee.status !== "paid").length
      }
    };
  }
  return scoped;
}

async function initializeDatabase() {
  await runMigrations(pool);
  await usersRepository.normalizeLegacyRoles(pool);
  await seedAuthUsers(pool);
  await seedCoreLearningData(pool);
  await usersRepository.normalizeSystemUsers(pool);
  if (process.env.NODE_ENV === "production") await ensureScheduledSessionsForAllSections(pool);
  invalidateStoreCache();
  registerEventHandlers();
  startScheduler();
}

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } }) : null;

// Force-logout: clears session cookie without requiring auth or CSRF.
// Must be registered BEFORE requireCsrf middleware so unauthenticated tabs
// (new tab, incognito, different user) can clear a stale session cookie.
app.post("/api/auth/force-logout", asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    await safeRedis(() => redis.set(`revoked:${token}`, "1", "EX", 60 * 60 * 8), "OK");
    const payload = await verifyToken(token);
    if (payload) await auditRepository.log(pool, payload.sub, "authentication_force_logout", "security", "Session forcibly cleared from login screen.");
  }
  clearAuthCookie(res);
  res.status(204).send();
}));

app.use("/api", requireCsrf);

app.post("/api/analyze", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code content is required." });
  if (!ai) return res.status(503).json({ error: "Gemini API Key is not configured in the workspace secrets. Please configure GEMINI_API_KEY in Settings." });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Analyze this web/backend application entrypoint file, specifically looking at its structure, routing, models (if applicable), and configuration, and generate a structured JSON feedback. Here is the code:\n\n${code}`,
    config: {
      systemInstruction: "You are an expert full-stack engineer specialized in web frameworks, microservices, and porting applications across Python (Flask) and Node.js/Express.js.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          configs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, defaultValue: { type: Type.STRING }, envVar: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["name", "defaultValue", "envVar", "description"] } },
          nodePort: { type: Type.STRING },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["explanation", "configs", "nodePort", "tips"]
      }
    }
  });
  res.json(JSON.parse(response.text?.trim() ?? "{}"));
}));

app.get("/health", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, database: "ok", uptime: process.uptime() });
}));

app.post("/api/auth/login", rateLimitLogin, validateBody(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const row = await usersRepository.findAuthByEmail(pool, email) as DbUserRow | null;
  if (!row || !verifyPassword(password, row.password_hash, row.password_salt || undefined)) return res.status(401).json({ error: "Incorrect email or password." });
  if (!row.is_active) return res.status(403).json({ error: "Account inactive." });

  // Single Browser Session Check: reject login if another session is already active in cookies
  const existingToken = extractBearerToken(req);
  if (existingToken) {
    try {
      const payload = await verifyToken(existingToken);
      if (payload && payload.sub !== row.id) {
        return res.status(400).json({
          error: "Bạn đang đăng nhập bằng một tài khoản khác. Vui lòng đăng xuất trước khi đăng nhập tài khoản mới.",
          code: "SESSION_CONFLICT"
        });
      }
    } catch (e) {
      // Ignore token verification errors
    }
  }

  const user = toPublicUser(row);
  setAuthCookie(res, signToken(user));
  const csrfToken = crypto.randomBytes(24).toString("base64url");
  setCsrfCookie(res, csrfToken);
  await auditRepository.log(pool, user.id, "authentication_login", "security", `Authenticated role ${user.role}.`);
  res.json({ user, csrfToken });
}));

app.post("/api/auth/reset-password/complete", rateLimitResetPassword, validateBody(schemas.completePasswordReset), asyncHandler(async (req, res) => {
  const tokenHash = sha256Hex(req.body.token);
  const credential = hashPassword(req.body.newPassword);
  const client = await pool.connect();
  let userId = "";
  try {
    await client.query("BEGIN");
    const resetToken = (await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    )).rows[0];

    if (!resetToken || resetToken.used_at || new Date(resetToken.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." });
    }

    userId = resetToken.user_id;
    await client.query(
      "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
      [credential.hash, credential.salt, userId]
    );
    await client.query(
      "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1",
      [resetToken.id]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await auditRepository.log(pool, userId, "password_reset_token_used", "security", "User completed one-time password reset.");
  res.json({ ok: true, message: "Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập bằng mật khẩu mới." });
}));

app.post("/api/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) await safeRedis(() => redis.set(`revoked:${token}`, "1", "EX", 60 * 60 * 8), "OK");
  await audit(req, "authentication_logout", "security", "Session closed.");
  clearAuthCookie(res);
  res.status(204).send();
}));
app.get("/api/auth/me", requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: req.user
      ? {
          ...req.user,
          school_email: req.user.schoolEmail,
          email_provisioned: req.user.emailProvisioned,
          email_provisioned_at: req.user.emailProvisionedAt,
        }
      : null
  });
});

app.post("/api/users/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Vui lòng nhập đầy đủ mật khẩu cũ và mới." });

  const row = await usersRepository.findAuthByEmail(pool, req.user!.email) as DbUserRow | null;
  if (!row || !verifyPassword(currentPassword, row.password_hash, row.password_salt || undefined)) {
    return res.status(401).json({ error: "Mật khẩu hiện tại không chính xác." });
  }

  const credential = hashPassword(newPassword);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [credential.hash, credential.salt, req.user!.id]
  );

  await audit(req, "change_password", req.user!.id, "User updated their account password.");
  res.json({ ok: true, message: "Đổi mật khẩu thành công!" });
}));

app.patch("/api/student/profile", requireAuth, requireRole(["student"]), validateBody(schemas.updateProfile), asyncHandler(async (req, res) => {
  const { phone, dateOfBirth, gender, address, guardianName, guardianPhone } = req.body;
  const exists = (await pool.query("SELECT id FROM student_profiles WHERE user_id = $1", [req.user!.id])).rowCount;

  if (!exists) {
    await ensureStudentProfile(pool, req.user!.id, {
      phone,
      dateOfBirth,
      gender,
      address,
      guardianName,
      guardianPhone
    });
  } else {
    await pool.query(
      `UPDATE student_profiles
       SET phone = $1,
           date_of_birth = $2,
           gender = $3,
           address = $4,
           guardian_name = $5,
           guardian_phone = $6
       WHERE user_id = $7`,
      [phone || null, dateOfBirth || null, gender || null, address || null, guardianName || null, guardianPhone || null, req.user!.id]
    );
  }

  if (phone) {
    await pool.query("UPDATE users SET phone = $1 WHERE id = $2", [phone, req.user!.id]);
  }

  await audit(req, "update_profile", req.user!.id, "Student updated their personal profile.");
  res.json({ ok: true, message: "Cập nhật hồ sơ lý lịch thành công!" });
}));

app.get("/api/store", requireAuth, asyncHandler(async (req, res) => res.json(limitStoreForRole(await storeSnapshotFromDb(pool), req.user!))));

app.get("/api/dashboard/admin", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const store = await storeSnapshotFromDb(pool);
  res.json({ ...dashboardFromStore(store, req.user!), auditLogs: await auditRepository.listRecent(pool, 100) });
}));
app.get("/api/dashboard/teacher", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/student", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/finance", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (_req, res) => res.json(await financeRepository.getDashboard(pool))));
app.get("/api/dashboard/academic", requireAuth, requireRole(["admin", "super_admin"]), asyncHandler(async (req, res) => res.json({ ...dashboardFromStore(await storeSnapshotFromDb(pool), req.user!), warnings: await academicsRepository.listWarnings(pool) })));
app.get("/api/dashboard/advisor", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getDashboard(pool, req.user!.id))));
app.get("/api/dashboard/parent", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getDashboard(pool, req.linkedStudentId!))));

app.get("/api/courses", requireAuth, asyncHandler(async (_req, res) => res.json(await coursesRepository.list(pool))));
app.post("/api/courses", requireAuth, requireRole(["admin", "super_admin"]), validateBody(schemas.createCourse), asyncHandler(async (req, res) => {
  const body = req.body;
  const course = await coursesRepository.create(pool, {
    title: body.title,
    description: body.description,
    teacherId: body.teacherId || req.user!.id,
    status: "published",
    category: body.category,
    thumbnail: body.thumbnail,
    price: body.price,
    level: body.level,
    tags: body.tags,
    openingDate: body.openingDate,
    numberOfLessons: body.numberOfLessons
  });
  await ensureCourseLessonsForSchedule(pool, course.id, body.numberOfLessons, [], body.openingDate);
  invalidateStoreCache();
  await audit(req, "create_course", course.id, course.title);
  res.status(201).json(course);
}));

app.put("/api/courses/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.createCourse), asyncHandler(async (req, res) => {
  const existing = await coursesRepository.findById(pool, req.params.id);
  if (!existing) return res.status(404).json({ error: "Course not found." });

  const body = req.body;
  if (req.user!.role === "teacher") {
    if (existing.teacherId !== req.user!.id) {
      return res.status(403).json({ error: "Permission denied." });
    }
    const updated = await coursesRepository.updateDetails(pool, req.params.id, {
      title: existing.title,
      description: existing.description,
      category: existing.category,
      thumbnail: existing.thumbnail,
      price: existing.price,
      level: existing.level,
      tags: existing.tags,
      openingDate: existing.openingDate,
      numberOfLessons: body.numberOfLessons
    });
    await ensureCourseLessonsForSchedule(pool, req.params.id, body.numberOfLessons, [], existing.openingDate);
    invalidateStoreCache();
    await audit(req, "update_course_lessons_count", req.params.id, `Lessons: ${body.numberOfLessons}`);
    return res.json(updated);
  }

  const updated = await coursesRepository.updateDetails(pool, req.params.id, {
    title: body.title,
    description: body.description,
    category: body.category,
    thumbnail: body.thumbnail,
    price: body.price,
    level: body.level,
    tags: body.tags,
    openingDate: body.openingDate,
    numberOfLessons: body.numberOfLessons
  });
  await ensureCourseLessonsForSchedule(pool, req.params.id, body.numberOfLessons, [], body.openingDate);
  invalidateStoreCache();
  await audit(req, "update_course", req.params.id, body.title);
  res.json(updated);
}));
app.post("/api/courses/:id/submit", requireAuth, requireRole(["teacher", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.params.id)) return res.status(403).json({ error: "Permission denied." });
  const nextStatus = req.user!.role === "teacher" ? "pending" : "published";
  const course = await coursesRepository.setStatus(pool, req.params.id, nextStatus);
  if (!course) return res.status(404).json({ error: "Course not found." });
  invalidateStoreCache();
  await audit(req, req.user!.role === "teacher" ? "submit_course_for_review" : "publish_course_direct", course.id, course.title);

  if (nextStatus === "pending") {
    const teacherName = req.user!.name || "Giáo viên";
    const message = `Giảng viên ${teacherName} đã gửi yêu cầu phê duyệt khóa học mới: "${course.title}".`;
    await notifyRole(pool, "admin", message, { relatedEntityType: "course", relatedEntityId: course.id });
    await notifyRole(pool, "manager", message, { relatedEntityType: "course", relatedEntityId: course.id });
    await notifyRole(pool, "super_admin", message, { relatedEntityType: "course", relatedEntityId: course.id });
  }

  res.json(course);
}));
app.post("/api/courses/:id/publish", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "published");
  if (!course) return res.status(404).json({ error: "Course not found." });
  invalidateStoreCache();
  await audit(req, "approve_course", course.id, course.title);

  if (course.teacherId) {
    const message = `Khóa học "${course.title}" của bạn đã được phê duyệt và xuất bản.`;
    await notifyStudent(pool, course.teacherId, message, { relatedEntityType: "course", relatedEntityId: course.id });
  }

  res.json(course);
}));
app.post("/api/courses/:id/reject", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.rejectCourse), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "rejected", req.body.rejectionReason);
  if (!course) return res.status(404).json({ error: "Course not found." });
  invalidateStoreCache();
  await audit(req, "reject_course", course.id, req.body.rejectionReason);

  if (course.teacherId) {
    const message = `Khóa học "${course.title}" của bạn đã bị từ chối phê duyệt. Lý do: ${req.body.rejectionReason}`;
    await notifyStudent(pool, course.teacherId, message, { relatedEntityType: "course", relatedEntityId: course.id });
  }

  res.json(course);
}));

app.delete("/api/courses/:id", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  // Kiểm tra sĩ số sinh viên hoạt động
  const enrollmentsCountRes = await pool.query("SELECT COUNT(*) AS count FROM enrollments WHERE course_id = $1 AND status = 'active'", [courseId]);
  const enrollmentsCount = Number(enrollmentsCountRes.rows[0].count);
  if (enrollmentsCount > 0) {
    return res.status(400).json({ error: "Không thể xóa khóa học đang có sinh viên tham gia học tập thực tế." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Xóa phản hồi diễn đàn liên quan
    await client.query(
      `DELETE FROM forum_replies
       WHERE post_id IN (SELECT id FROM forum_posts WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa bài viết diễn đàn liên quan
    await client.query("DELETE FROM forum_posts WHERE course_id = $1", [courseId]);

    // Xóa tiến độ bài học liên quan
    await client.query(
      `DELETE FROM lesson_progress
       WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các bài học liên quan
    await client.query("DELETE FROM lessons WHERE course_id = $1", [courseId]);

    // Xóa các lượt thử làm bài quiz liên quan
    await client.query(
      `DELETE FROM quiz_attempts
       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các câu hỏi trắc nghiệm liên quan
    await client.query(
      `DELETE FROM questions
       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các bài thi trắc nghiệm liên quan
    await client.query("DELETE FROM quizzes WHERE course_id = $1", [courseId]);

    // Xóa bài nộp tự luận liên quan
    await client.query(
      `DELETE FROM submissions
       WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = $1)`,
      [courseId]
    );
    // Xóa các bài tập tự luận liên quan
    await client.query("DELETE FROM assignments WHERE course_id = $1", [courseId]);

    // Xóa giao dịch liên quan
    await client.query("DELETE FROM transactions WHERE course_id = $1", [courseId]);

    // Xóa chứng chỉ học phần liên quan
    await client.query("DELETE FROM certificates WHERE course_id = $1", [courseId]);

    // Xóa các lớp học phần/buổi học cụ thể liên quan
    await client.query("DELETE FROM course_sections WHERE course_id = $1", [courseId]);

    // Xóa đăng ký học phần/enrollments
    await client.query("DELETE FROM enrollments WHERE course_id = $1", [courseId]);

    // Xóa liên kết chương trình học/khung ngành
    await client.query("DELETE FROM program_courses WHERE course_id = $1", [courseId]);

    // Cuối cùng xóa khóa học
    await client.query("DELETE FROM courses WHERE id = $1", [courseId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await audit(req, "delete_course", courseId, "Successfully performed cascading delete on course and related assets.");
  res.json({ ok: true });
}));

app.post("/api/lessons", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.addLesson), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const lesson = await coursesRepository.addLesson(pool, req.body);
  invalidateStoreCache();
  await audit(req, "add_lesson", lesson.id, lesson.title);
  res.status(201).json(lesson);
}));

app.put("/api/lessons/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.updateLesson), asyncHandler(async (req, res) => {
  const lessonRow = (await pool.query("SELECT course_id FROM lessons WHERE id = $1", [req.params.id])).rows[0];
  if (!lessonRow) return res.status(404).json({ error: "Lesson not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, lessonRow.course_id)) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const lesson = await coursesRepository.updateLesson(pool, req.params.id, req.body);
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });
  invalidateStoreCache();
  await audit(req, "update_lesson", lesson.id, lesson.title);
  res.json(lesson);
}));

app.delete("/api/lessons/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const lessonRes = await pool.query("SELECT * FROM lessons WHERE id = $1", [req.params.id]);
  const lessonRow = lessonRes.rows[0];
  if (!lessonRow) return res.status(404).json({ error: "Lesson not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, lessonRow.course_id)) {
    return res.status(403).json({ error: "Permission denied." });
  }

  await coursesRepository.deleteLesson(pool, req.params.id);
  invalidateStoreCache();
  await audit(req, "delete_lesson", req.params.id, lessonRow.title);
  res.json({ ok: true });
}));

app.get("/api/enrollments", requireAuth, asyncHandler(async (req, res) => res.json(await enrollmentsRepository.listForUser(pool, req.user!))));
app.post("/api/enrollments/register", requireAuth, requireRole(["student"]), validateBody(schemas.registerEnrollment), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course || course.status !== "published") return res.status(404).json({ error: "Published course not found." });
  if (await enrollmentsRepository.existsForCourse(pool, req.user!.id, course.id)) return res.status(409).json({ error: "Enrollment already exists." });

  const isPaid = Number(course.price || 0) > 0;
  const sectionId = isPaid ? undefined : req.body.sectionId;
  if (sectionId) {
    const section = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [sectionId])).rows[0];
    if (!section) return res.status(404).json({ error: "Selected class section not found." });
    if (section.course_id !== course.id) return res.status(400).json({ error: "Selected section does not belong to this course." });

    // Check capacity
    const countRes = await pool.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    );
    const count = Number(countRes.rows[0].count);
    if (count >= section.max_students) {
      return res.status(400).json({ error: "Lớp học phần này đã đạt sĩ số tối đa. Vui lòng chọn lớp khác." });
    }

    // Check timetable conflict
    if (await sectionsRepository.conflictCheck(pool, req.user!.id, sectionId)) {
      return res.status(400).json({ error: "Lớp học phần này bị trùng lịch học với các lớp khác bạn đã đăng ký." });
    }
  }

  const enrollment = await enrollmentsRepository.register(pool, req.user!.id, course.id, isPaid);
  if (isPaid) {
    const txId = generateId("tx");
    await pool.query(
      `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at)
       VALUES ($1, $2, $3, $4, 'pending', 'Chuyển khoản Ngân hàng (QR)', $5)`,
      [txId, req.user!.id, course.id, Number(course.price), new Date().toISOString()]
    );
  }

  if (sectionId) {
    const section = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [sectionId])).rows[0];
    const creditsRow = (await pool.query(
      "SELECT COALESCE(MAX(credits), 3) AS credits FROM program_courses WHERE course_id = $1",
      [course.id]
    )).rows[0];

    await pool.query(
      `INSERT INTO course_registrations (id, student_id, section_id, semester_id, status, registered_at, credits, is_retake)
       VALUES ($1, $2, $3, $4, 'waitlisted', $5, $6, false)`,
      [generateId("reg"), req.user!.id, sectionId, section.semester_id, new Date().toISOString(), Number(creditsRow?.credits || 3)]
    );
  }

  invalidateStoreCache();
  await audit(req, "enroll_course", course.id, course.title);
  res.status(201).json(enrollment);
}));
app.post("/api/enrollments/:id/activate", requireAuth, requireRole(["admin", "super_admin"]), asyncHandler(async (req, res) => {
  const enrollment = await enrollmentsRepository.activateEnrollment(pool, req.params.id);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found." });
  invalidateStoreCache();
  await audit(req, "activate_enrollment", enrollment.id, `Activated enrollment for student ID: ${enrollment.studentId}`);
  res.json(enrollment);
}));
app.patch("/api/enrollments/:id/approve", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.approveEnrollment), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");

    const enrollmentRow = (await client.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!enrollmentRow) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Enrollment not found." });
    }
    if (!await hasConfirmedPaymentForCoursePlacement(client, enrollmentRow.student_id, enrollmentRow.course_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment must be confirmed before class placement." });
    }
    const enrollment = (await client.query(
      "UPDATE enrollments SET status = 'active' WHERE id = $1 RETURNING *",
      [req.params.id]
    )).rows[0];

    let registration = null;
    const sectionId = req.body.sectionId;
    if (sectionId) {
      const section = (await client.query("SELECT * FROM course_sections WHERE id = $1 FOR UPDATE", [sectionId])).rows[0];
      if (!section) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Course section not found." });
      }
      if (section.course_id !== enrollment.course_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Selected section does not belong to this course." });
      }

      // Check capacity
      const countRes = await client.query(
        "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
        [sectionId]
      );
      const count = Number(countRes.rows[0].count);
      if (count >= section.max_students) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Lớp học phần này đã đạt sĩ số tối đa. Không thể xếp thêm học viên." });
      }

      const existingRegistration = (await client.query(
        `SELECT cr.id, cr.status
         FROM course_registrations cr
         JOIN course_sections cs ON cs.id = cr.section_id
         WHERE cr.student_id = $1
           AND cs.course_id = $2
           AND cr.semester_id = $3
           AND cr.status IN ('registered', 'waitlisted')`,
        [enrollment.student_id, enrollment.course_id, section.semester_id]
      )).rows[0];

      if (!existingRegistration) {
        const creditsRow = (await client.query(
          "SELECT COALESCE(MAX(credits), 3) AS credits FROM program_courses WHERE course_id = $1",
          [enrollment.course_id]
        )).rows[0];
        registration = (await client.query(
          `INSERT INTO course_registrations (id, student_id, section_id, semester_id, status, registered_at, credits, is_retake)
           VALUES ($1, $2, $3, $4, 'registered', $5, $6, false)
           RETURNING *`,
          [generateId("reg"), enrollment.student_id, sectionId, section.semester_id, new Date().toISOString(), Number(creditsRow?.credits || 3)]
        )).rows[0];
      } else {
        registration = (await client.query(
          "UPDATE course_registrations SET section_id = $1, status = 'registered' WHERE id = $2 RETURNING *",
          [sectionId, existingRegistration.id]
        )).rows[0];
      }
    }

    await client.query("COMMIT");
    committed = true;
    invalidateStoreCache();
    await notificationsRepository.create(pool, {
      userId: enrollment.student_id,
      type: "success",
      message: sectionId
        ? "Yêu cầu đăng ký môn học của bạn đã được duyệt và xếp vào lớp học phần."
        : "Yêu cầu đăng ký môn học của bạn đã được duyệt."
    });
    await audit(req, "approve_enrollment", enrollment.id, sectionId || "no-section");
    res.json({ enrollment, registration });
  } catch (error) {
    if (!committed) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/admin/enrollments/bulk-place", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const { placements } = req.body;
  if (!Array.isArray(placements)) {
    return res.status(400).json({ error: "Mảng danh sách xếp lớp placements là bắt buộc." });
  }

  const client = await pool.connect();
  const results: any[] = [];
  const errors: any[] = [];

  try {
    await client.query("BEGIN");
    const sectionCounts = new Map<string, number>();
    for (const [index, p] of placements.entries()) {
      let studentId = "";
      let enrollmentId = p.enrollmentId;
      let sectionId = p.sectionId;

      if (p.studentCode || p.email) {
        const studentRow = (await client.query(
          `SELECT u.id 
           FROM users u
           LEFT JOIN student_profiles sp ON u.id = sp.user_id
           WHERE ($1::text IS NULL OR sp.student_code = $1)
             AND ($2::text IS NULL OR u.email = $2)
           LIMIT 1`,
          [p.studentCode || null, p.email || null]
        )).rows[0];
        if (!studentRow) {
          errors.push({ index, error: `Không tìm thấy học viên với mã: ${p.studentCode || ''}, email: ${p.email || ''}` });
          continue;
        }
        studentId = studentRow.id;
      }

      if (p.sectionCode && !sectionId) {
        const secRow = (await client.query("SELECT id FROM course_sections WHERE section_code = $1", [p.sectionCode])).rows[0];
        if (!secRow) {
          errors.push({ index, error: `Không tìm thấy lớp học phần với mã: ${p.sectionCode}` });
          continue;
        }
        sectionId = secRow.id;
      }

      if (!sectionId) {
        errors.push({ index, error: "Thiếu mã lớp học phần." });
        continue;
      }

      const section = (await client.query("SELECT * FROM course_sections WHERE id = $1", [sectionId])).rows[0];
      if (!section) {
        errors.push({ index, error: `Không tìm thấy lớp học phần ID ${sectionId}.` });
        continue;
      }

      // Check capacity
      let currentCount = sectionCounts.get(sectionId);
      if (currentCount === undefined) {
        const countRes = await client.query(
          "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
          [sectionId]
        );
        currentCount = Number(countRes.rows[0].count);
        sectionCounts.set(sectionId, currentCount);
      }

      if (currentCount >= section.max_students) {
        errors.push({ index, error: `Lớp học phần ${section.section_code} đã đạt sĩ số tối đa (${section.max_students}).` });
        continue;
      }

      if (!enrollmentId) {
        if (!studentId) {
          errors.push({ index, error: "Thiếu thông tin nhận diện học viên." });
          continue;
        }
        const enrollRow = (await client.query(
          "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1",
          [studentId, section.course_id]
        )).rows[0];
        if (enrollRow) {
          enrollmentId = enrollRow.id;
        } else {
          const courseForPlacement = (await client.query("SELECT price FROM courses WHERE id = $1", [section.course_id])).rows[0];
          if (Number(courseForPlacement?.price || 0) > 0) {
            errors.push({ index, error: "Payment must be confirmed before class placement." });
            continue;
          }
          enrollmentId = generateId("enroll");
          await client.query(
            "INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at) VALUES ($1, $2, $3, 'active', $4)",
            [enrollmentId, section.course_id, studentId, new Date().toISOString()]
          );
        }
      }

      const enrollmentRow = (await client.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [enrollmentId])).rows[0];
      if (!enrollmentRow) {
        errors.push({ index, error: "Enrollment not found for class placement." });
        continue;
      }
      if (enrollmentRow.course_id !== section.course_id) {
        errors.push({ index, error: "Enrollment does not belong to the target class course." });
        continue;
      }
      if (!await hasConfirmedPaymentForCoursePlacement(client, enrollmentRow.student_id, enrollmentRow.course_id)) {
        errors.push({ index, error: "Payment must be confirmed before class placement." });
        continue;
      }

      await client.query(
        "UPDATE enrollments SET status = 'active' WHERE id = $1",
        [enrollmentId]
      );

      if (!studentId) {
        const enroll = (await client.query("SELECT student_id FROM enrollments WHERE id = $1", [enrollmentId])).rows[0];
        studentId = enroll?.student_id;
      }

      if (!studentId) {
        errors.push({ index, error: "Không tìm thấy thông tin học viên của lượt ghi danh này." });
        continue;
      }

      const existingRegistration = (await client.query(
        `SELECT cr.id
         FROM course_registrations cr
         JOIN course_sections cs ON cs.id = cr.section_id
         WHERE cr.student_id = $1
           AND cs.course_id = $2
           AND cr.semester_id = $3
           AND cr.status IN ('registered', 'waitlisted')`,
        [studentId, section.course_id, section.semester_id]
      )).rows[0];

      if (!existingRegistration) {
        const creditsRow = (await client.query(
          "SELECT COALESCE(MAX(credits), 3) AS credits FROM program_courses WHERE course_id = $1",
          [section.course_id]
        )).rows[0];
        await client.query(
          `INSERT INTO course_registrations (id, student_id, section_id, semester_id, status, registered_at, credits, is_retake)
           VALUES ($1, $2, $3, $4, 'registered', $5, $6, false)`,
          [generateId("reg"), studentId, sectionId, section.semester_id, new Date().toISOString(), Number(creditsRow?.credits || 3)]
        );
      } else {
        await client.query(
          "UPDATE course_registrations SET section_id = $1, status = 'registered' WHERE id = $2",
          [sectionId, existingRegistration.id]
        );
      }

      results.push({ index, enrollmentId, sectionId });
      sectionCounts.set(sectionId, currentCount + 1);
    }

    if (errors.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Lỗi kiểm tra dữ liệu xếp lớp hàng loạt.", errors });
    }

    await client.query("COMMIT");
    invalidateStoreCache();
    res.json({ success: true, count: results.length });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message || "Không thể thực hiện xếp lớp hàng loạt." });
  } finally {
    client.release();
  }
}));

app.post("/api/courses/:id/request-section", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found." });

  const studentName = req.user!.name || "Học viên";
  const message = `Học viên ${studentName} đã gửi yêu cầu mở thêm lớp học phần cho môn học: "${course.title}".`;
  await notifyRole(pool, "admin", message, { relatedEntityType: "course", relatedEntityId: course.id });
  await notifyRole(pool, "super_admin", message, { relatedEntityType: "course", relatedEntityId: course.id });

  await audit(req, "request_new_section", course.id, course.title);
  res.json({ success: true, message: "Yêu cầu mở thêm lớp học phần đã được gửi tới quản trị viên." });
}));

app.post("/api/certificates/issue", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.issueCertificate), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");

    const enrollment = (await client.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [req.body.enrollmentId])).rows[0];
    if (!enrollment) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Enrollment not found." });
    }
    if (enrollment.status === "cancelled" || enrollment.status === "pending_payment") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Enrollment is not eligible for certificate issuance." });
    }

    const existingCertificate = (await client.query(
      "SELECT * FROM certificates WHERE enrollment_id = $1 OR (student_id = $2 AND course_id = $3) LIMIT 1",
      [enrollment.id, enrollment.student_id, enrollment.course_id]
    )).rows[0];
    if (existingCertificate) {
      await client.query("COMMIT");
      committed = true;
      return res.status(409).json({ error: "Certificate already exists for this enrollment." });
    }

    const issuedAt = new Date().toISOString();
    const certificateCode = await generateCertificateCode(client);
    const certificate = (await client.query(
      `INSERT INTO certificates (id, enrollment_id, student_id, course_id, issued_at, certificate_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [generateId("cert"), enrollment.id, enrollment.student_id, enrollment.course_id, issuedAt, certificateCode]
    )).rows[0];

    await client.query(
      "UPDATE enrollments SET status = 'completed', completed_at = $1 WHERE id = $2",
      [issuedAt, enrollment.id]
    );

    await client.query("COMMIT");
    committed = true;
    invalidateStoreCache();
    await notificationsRepository.create(pool, {
      userId: enrollment.student_id,
      type: "success",
      message: `Chứng chỉ khóa học của bạn đã được cấp chính thức. Mã kiểm định: ${certificateCode}.`
    });
    await audit(req, "issue_certificate", certificate.id, certificateCode);
    res.status(201).json(certificateFromRow(certificate));
  } catch (error) {
    if (!committed) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.delete("/api/certificates/:id", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");

    const certificate = (await client.query("SELECT * FROM certificates WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!certificate) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Certificate not found." });
    }

    await client.query("DELETE FROM certificates WHERE id = $1", [req.params.id]);

    await client.query("COMMIT");
    committed = true;
    invalidateStoreCache();
    await notificationsRepository.create(pool, {
      userId: certificate.student_id,
      type: "danger",
      message: `Chứng chỉ mã ${certificate.certificate_code} đã bị thu hồi khỏi sổ chứng chỉ.`
    });
    await audit(req, "revoke_certificate", certificate.id, certificate.certificate_code);
    res.json({ ok: true, certificate: certificateFromRow(certificate) });
  } catch (error) {
    if (!committed) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/progress/toggle", requireAuth, requireRole(["student"]), validateBody(schemas.toggleProgress), asyncHandler(async (req, res) => {
  const enrollment = await enrollmentsRepository.findStudentEnrollment(pool, req.user!.id, req.body.enrollmentId);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found." });
  const result = await enrollmentsRepository.toggleProgress(pool, req.body.enrollmentId, req.body.lessonId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "toggle_lesson_progress", req.body.lessonId, `completed=${result.row.completed}`);
  res.json(result.row);
}));

app.post("/api/quizzes", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.createQuiz), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, req.body.courseId])).rows[0];
    if (!session) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, req.body.courseId])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  }
  const quiz = await quizzesRepository.create(pool, req.body);
  invalidateStoreCache();
  await audit(req, "create_quiz", quiz.id, quiz.title);
  res.status(201).json(quiz);
}));

app.put("/api/quizzes/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.updateQuiz), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, quiz.courseId])).rows[0];
    if (!session) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, quiz.courseId])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  }
  const updated = await quizzesRepository.update(pool, req.params.id, req.body);
  invalidateStoreCache();
  await audit(req, "update_quiz", req.params.id, updated!.title);
  res.json(updated);
}));

app.delete("/api/quizzes/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  await quizzesRepository.delete(pool, req.params.id);
  invalidateStoreCache();
  await audit(req, "delete_quiz", req.params.id, quiz.title);
  res.json({ ok: true });
}));

app.post("/api/quizzes/:id/questions/bulk", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.bulkAddQuestions), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  
  const createdQuestions = [];
  for (const q of req.body.questions) {
    const qCreated = await quizzesRepository.addQuestion(pool, { ...q, quizId: req.params.id });
    createdQuestions.push(qCreated);
  }
  await audit(req, "bulk_add_quiz_questions", req.params.id, `Imported ${createdQuestions.length} questions`);
  res.status(201).json(createdQuestions);
}));
app.post("/api/quizzes/:id/questions", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.addQuestion), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const question = await quizzesRepository.addQuestion(pool, { ...req.body, quizId: req.params.id });
  await audit(req, "add_quiz_question", question.id, quiz.id);
  res.status(201).json(question);
}));

app.put("/api/questions/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.addQuestion), asyncHandler(async (req, res) => {
  const question = (await pool.query("SELECT quiz_id FROM questions WHERE id = $1", [req.params.id])).rows[0];
  if (!question) return res.status(404).json({ error: "Question not found." });
  const quiz = await quizzesRepository.findById(pool, question.quiz_id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const updated = await quizzesRepository.updateQuestion(pool, req.params.id, req.body);
  await audit(req, "update_quiz_question", req.params.id, quiz.id);
  res.json(updated);
}));

app.delete("/api/questions/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const question = (await pool.query("SELECT quiz_id FROM questions WHERE id = $1", [req.params.id])).rows[0];
  if (!question) return res.status(404).json({ error: "Question not found." });
  const quiz = await quizzesRepository.findById(pool, question.quiz_id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  await quizzesRepository.deleteQuestion(pool, req.params.id);
  await audit(req, "delete_quiz_question", req.params.id, quiz.id);
  res.status(204).end();
}));

app.post("/api/quizzes/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitQuiz), asyncHandler(async (req, res) => {
  const result = await quizzesRepository.submitAttempt(pool, req.body.quizId, req.user!.id, req.body.answers, req.body.startedAt);
  if (!result) return res.status(404).json({ error: "Quiz not found." });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await maybePostGradeEntry(pool, req.user!.id, "quiz", result.row.id, result.row.score, 100);
  await maybePostFinalCourseGradeForQuiz(pool, req.user!.id, req.body.quizId);
  await audit(req, "submit_quiz_attempt", result.row.quizId, `Score ${result.row.score}.`);
  res.status(201).json(result.row);
}));

app.post("/api/assignments", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.createAssignment), asyncHandler(async (req, res) => {
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, req.body.courseId])).rows[0];
    if (!session) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, req.body.courseId])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  }
  const assignment = await assignmentsRepository.create(pool, req.body);
  invalidateStoreCache();
  await audit(req, "create_assignment", assignment.id, assignment.title);
  res.status(201).json(assignment);
}));

app.put("/api/assignments/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.updateAssignment), asyncHandler(async (req, res) => {
  const assignment = (await pool.query("SELECT * FROM assignments WHERE id = $1", [req.params.id])).rows[0];
  if (!assignment) return res.status(404).json({ error: "Assignment not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, assignment.course_id)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, assignment.course_id])).rows[0];
    if (!session) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, assignment.course_id])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  }
  const updated = await assignmentsRepository.update(pool, req.params.id, req.body);
  invalidateStoreCache();
  await audit(req, "update_assignment", req.params.id, updated.title);
  res.json(updated);
}));

app.delete("/api/assignments/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const assignment = (await pool.query("SELECT * FROM assignments WHERE id = $1", [req.params.id])).rows[0];
  if (!assignment) return res.status(404).json({ error: "Assignment not found." });
  if (req.user!.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user!.id, assignment.course_id)) return res.status(403).json({ error: "Permission denied." });
  await assignmentsRepository.delete(pool, req.params.id);
  invalidateStoreCache();
  await audit(req, "delete_assignment", req.params.id, assignment.title);
  res.json({ ok: true });
}));
app.post("/api/assignments/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitAssignment), asyncHandler(async (req, res) => {
  const result = await assignmentsRepository.submit(pool, req.user!.id, req.body.assignmentId, req.body.content, req.body.attachmentUrl);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  invalidateStoreCache();
  await audit(req, "submit_assignment", result.row.id, result.row.assignmentId);
  res.status(201).json(result.row);
}));

app.post("/api/assignments/grade", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.gradeAssignment), asyncHandler(async (req, res) => {
  const submission = await assignmentsRepository.findSubmissionForGrading(pool, req.body.submissionId);
  if (!submission) return res.status(404).json({ error: "Submission not found." });
  if (req.user!.role === "teacher" && submission.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  if (req.body.score > Number(submission.max_score)) return res.status(400).json({ error: "Invalid score." });
  const result = await assignmentsRepository.grade(pool, req.body.submissionId, req.body.score, req.body.feedback);
  if (submission) {
    await maybePostGradeEntry(pool, submission.student_id, "assignment", req.body.submissionId, req.body.score, Number(submission.max_score) || 100);
  }
  await maybePostFinalCourseGradeForSubmission(pool, req.body.submissionId);
  invalidateStoreCache();
  await audit(req, "grade_assignment", req.body.submissionId, `Score ${req.body.score}.`);
  res.json(result);
}));

app.post("/api/courses/:courseId/forum", requireAuth, requireRole(["student", "teacher", "manager", "admin", "super_admin"]), validateBody(schemas.createForumPost), asyncHandler(async (req, res) => {
  const { courseId, sectionId, title, content } = req.body;
  if (courseId !== req.params.courseId) {
    return res.status(400).json({ error: "Course ID mismatch." });
  }

  const role = req.user!.role;
  const userId = req.user!.id;

  if (role === "student") {
    if (sectionId) {
      const isReg = (await pool.query(
        "SELECT id FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
        [userId, sectionId]
      )).rows[0];
      if (!isReg) {
        return res.status(403).json({ error: "You must be registered in this class section to post on the forum." });
      }
    } else {
      const enrollment = (await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [userId, courseId]
      )).rows[0];
      if (!enrollment) {
        return res.status(403).json({ error: "You must be enrolled in this course to post on the forum." });
      }
    }
  } else if (role === "teacher") {
    if (sectionId) {
      const isTeacher = (await pool.query(
        "SELECT id FROM course_sections WHERE id = $1 AND teacher_id = $2",
        [sectionId, userId]
      )).rows[0];
      if (!isTeacher) {
        return res.status(403).json({ error: "You can only post on the forum of classes you teach." });
      }
    } else {
      const owns = await coursesRepository.teacherOwnsCourse(pool, userId, courseId);
      if (!owns) {
        return res.status(403).json({ error: "You can only post on the forum of courses you teach." });
      }
    }
  } else if (role !== "manager" && role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ error: "Permission denied." });
  }

  const post = await forumRepository.createPost(pool, { courseId, sectionId, authorId: userId, title, content });

  // Notify students and teacher in this section
  if (sectionId) {
    const studentsRes = await pool.query(
      "SELECT student_id FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    );
    const secRes = await pool.query("SELECT section_code, teacher_id FROM course_sections WHERE id = $1", [sectionId]);
    const secCode = secRes.rows[0]?.section_code || "lớp";
    const teacherId = secRes.rows[0]?.teacher_id;

    const authorRes = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
    const authorName = authorRes.rows[0]?.name || "Thành viên";

    for (const row of studentsRes.rows) {
      if (row.student_id !== userId) {
        await notificationsRepository.create(pool, {
          userId: row.student_id,
          type: "info",
          message: `Diễn đàn lớp ${secCode}: ${authorName} đã đăng bài thảo luận mới: "${title}".`
        });
      }
    }

    if (teacherId && teacherId !== userId) {
      await notificationsRepository.create(pool, {
        userId: teacherId,
        type: "info",
        message: `Diễn đàn lớp ${secCode}: ${authorName} đã đăng bài thảo luận mới: "${title}".`
      });
    }
  }

  invalidateStoreCache();
  await audit(req, "create_forum_post", post.id, `Course: ${courseId}`);
  res.status(201).json(post);
}));

app.post("/api/forum/posts/:postId/replies", requireAuth, requireRole(["student", "teacher", "manager", "admin", "super_admin"]), validateBody(schemas.createForumReply), asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { postId } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;

  const postRes = await pool.query("SELECT course_id, section_id, title, author_id FROM forum_posts WHERE id = $1", [postId]);
  const post = postRes.rows[0];
  if (!post) {
    return res.status(404).json({ error: "Forum post not found." });
  }
  const courseId = post.course_id;
  const sectionId = post.section_id;
  const postTitle = post.title;
  const postAuthorId = post.author_id;

  if (role === "student") {
    if (sectionId) {
      const isReg = (await pool.query(
        "SELECT id FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
        [userId, sectionId]
      )).rows[0];
      if (!isReg) {
        return res.status(403).json({ error: "You must be registered in this class section to reply on the forum." });
      }
    } else {
      const enrollment = (await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [userId, courseId]
      )).rows[0];
      if (!enrollment) {
        return res.status(403).json({ error: "You must be enrolled in this course to reply on the forum." });
      }
    }
  } else if (role === "teacher") {
    if (sectionId) {
      const isTeacher = (await pool.query(
        "SELECT id FROM course_sections WHERE id = $1 AND teacher_id = $2",
        [sectionId, userId]
      )).rows[0];
      if (!isTeacher) {
        return res.status(403).json({ error: "You can only reply on the forum of classes you teach." });
      }
    } else {
      const owns = await coursesRepository.teacherOwnsCourse(pool, userId, courseId);
      if (!owns) {
        return res.status(403).json({ error: "You can only reply on the forum of courses you teach." });
      }
    }
  } else if (role !== "manager" && role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ error: "Permission denied." });
  }

  const reply = await forumRepository.createReply(pool, { postId, authorId: userId, content });

  // Notify section members
  if (sectionId) {
    const secRes = await pool.query("SELECT section_code, teacher_id FROM course_sections WHERE id = $1", [sectionId]);
    const secCode = secRes.rows[0]?.section_code || "lớp";
    const teacherId = secRes.rows[0]?.teacher_id;

    const authorRes = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
    const authorName = authorRes.rows[0]?.name || "Thành viên";

    if (postAuthorId && postAuthorId !== userId) {
      await notificationsRepository.create(pool, {
        userId: postAuthorId,
        type: "info",
        message: `Diễn đàn lớp ${secCode}: ${authorName} đã bình luận vào bài viết "${postTitle}" của bạn.`
      });
    }

    const studentsRes = await pool.query(
      "SELECT student_id FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    );
    for (const row of studentsRes.rows) {
      if (row.student_id !== userId && row.student_id !== postAuthorId) {
        await notificationsRepository.create(pool, {
          userId: row.student_id,
          type: "info",
          message: `Diễn đàn lớp ${secCode}: có phản hồi mới từ ${authorName} trong chủ đề "${postTitle}".`
        });
      }
    }

    if (teacherId && teacherId !== userId && teacherId !== postAuthorId) {
      await notificationsRepository.create(pool, {
        userId: teacherId,
        type: "info",
        message: `Diễn đàn lớp ${secCode}: có phản hồi mới từ ${authorName} trong chủ đề "${postTitle}".`
      });
    }
  }

  invalidateStoreCache();
  await audit(req, "create_forum_reply", reply.id, `Post: ${postId}`);
  res.status(201).json(reply);
}));

app.post("/api/admin/users", requireAuth, requireRole(["manager", "super_admin", "admin"]), validateBody(schemas.createUser), asyncHandler(async (req, res) => {
  if (req.user!.role === "admin" && req.body.role !== "student") {
    return res.status(403).json({ error: "Admins can create student accounts only." });
  }
  const client = await pool.connect();
  let created: User;
  try {
    await client.query("BEGIN");
    created = await createUserAccount(client, req.body, req.body.password);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (created.role === "student") {
    void eventBus.emit("user.created", created, pool).catch(err => {
      console.error("[user.created] async provisioning failed:", err);
    });
  }

  invalidateStoreCache();
  await audit(req, "create_user", created.id, created.email);
  res.status(201).json(created);
}));

app.post("/api/admin/users/bulk", requireAuth, requireRole(["manager", "super_admin", "admin"]), rateLimitBulkImport, validateBody(schemas.bulkCreateUsers), asyncHandler(async (req, res) => {
  const errors: Array<{ row: number; email?: string; reason: string }> = [];
  const created: User[] = [];
  const seenEmails = new Set<string>();

  for (const [index, input] of req.body.users.entries()) {
    const row = index + 1;
    const email = input.email.toLowerCase().trim();

    if (seenEmails.has(email)) {
      errors.push({ row, email, reason: "Duplicate email in import payload." });
      continue;
    }
    seenEmails.add(email);

    if (req.user!.role === "admin" && input.role !== "student") {
      errors.push({ row, email, reason: "Admins can bulk import student accounts only." });
      continue;
    }
    if (req.user!.role === "manager" && ["manager", "super_admin"].includes(input.role)) {
      errors.push({ row, email, reason: "Managers cannot create manager or super_admin accounts." });
      continue;
    }

    const existing = await usersRepository.findAuthByEmail(pool, email);
    if (existing) {
      errors.push({ row, email, reason: "Email already exists." });
      continue;
    }

    const client = await pool.connect();
    let newUser: User | null = null;
    try {
      await client.query("BEGIN");
      newUser = await createUserAccount(client, input, req.body.defaultPassword || generateTemporaryPassword());
      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      errors.push({
        row,
        email,
        reason: error?.code === "23505" ? "Duplicate user or student code." : error?.message || "Unable to create user."
      });
      continue;
    } finally {
      client.release();
    }

    created.push(newUser);
    if (newUser.role === "student") {
      void eventBus.emit("user.created", newUser, pool).catch(err => {
        console.error("[user.created] async provisioning failed:", err);
      });
    }
  }

  if (created.length > 0) {
    invalidateStoreCache();
    await audit(req, "bulk_create_users", "users", `Created ${created.length} users from CSV import; skipped ${errors.length}.`);
  }

  res.status(created.length > 0 ? 201 : 200).json({
    createdCount: created.length,
    skippedCount: errors.length,
    errorCount: errors.length,
    errors,
    created
  });
}));

app.post("/api/admin/users/:id/reset-password", requireAuth, requireRole(["manager", "super_admin", "admin"]), rateLimitResetPassword, asyncHandler(async (req, res) => {
  const user = await usersRepository.findById(pool, req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const resetToken = generatePasswordResetToken();
  const resetTokenHash = sha256Hex(resetToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  const resetUrl = passwordResetUrl(req, resetToken);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL",
      [user.id]
    );
    await client.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [generateId("pwd_reset"), user.id, resetTokenHash, req.user!.id, expiresAt]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let emailSent = false;
  try {
    await sendPasswordResetLinkEmail(pool, user.id, {
      to: user.email,
      name: user.name,
      resetUrl,
      expiresAt
    });
    emailSent = true;
  } catch (err) {
    console.error("Failed to email password reset link:", err);
  }

  await audit(req, "create_password_reset_link", req.params.id, `Password reset link created for: ${user.email}`);
  const canExposeResetUrl = !emailSent || (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "staging");
  res.json({
    ok: true,
    emailSent,
    expiresAt,
    ...(canExposeResetUrl ? { resetUrl } : {}),
    message: emailSent
      ? `Liên kết đặt lại mật khẩu đã được gửi tới email của người dùng: ${user.email}`
      : `Liên kết đặt lại mật khẩu đã được tạo, nhưng email gửi liên kết chưa thành công. Vui lòng chuyển liên kết qua kênh nội bộ.`
  });
}));

app.post("/api/admin/users/:id/reprovision-email", requireAuth, requireRole(["manager", "super_admin", "admin"]), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await usersRepository.findById(pool, userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  if (user.role !== "student") {
    return res.status(400).json({ error: "Only students can have emails provisioned." });
  }

  try {
    if (user.emailProvisioned) {
      return res.json({ ok: true, message: "Email already provisioned.", schoolEmail: user.schoolEmail });
    }
    await provisioningService.provisionStudentEmail(pool, userId);
    const updatedUser = await usersRepository.findById(pool, userId);
    res.json({
      ok: true,
      message: "Email provisioning completed successfully.",
      schoolEmail: updatedUser?.schoolEmail
    });
  } catch (err: any) {
    console.error("[reprovision-email] failed:", err);
    res.status(500).json({ error: `Provisioning failed: ${err.message || err}` });
  }
}));

app.patch("/api/admin/users/:id/role", requireAuth, requireRole(["manager", "super_admin", "admin"]), asyncHandler(async (req, res) => {
  const { role } = req.body;
  const allowedRoles = ["student", "teacher", "manager", "admin", "parent"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role value." });
  }

  if (req.user!.id === req.params.id) {
    return res.status(403).json({ error: "Cannot change your own role." });
  }
  if (req.user!.role === "admin" && !["student", "teacher", "parent"].includes(role)) {
    return res.status(403).json({ error: "Admins can only assign student, teacher, or parent roles." });
  }

  const userRes = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [req.params.id]);
  if (userRes.rows.length === 0) {
    return res.status(404).json({ error: "User not found." });
  }

  await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);

  if (role === "student") {
    await ensureStudentProfile(pool, req.params.id);
  }

  await audit(req, "update_user_role", req.params.id, `role=${role}`);
  invalidateStoreCache();

  res.json({ ok: true, message: "Role updated successfully." });
}));

app.patch("/api/admin/users/:id/status", requireAuth, requireRole(["manager", "super_admin", "admin"]), validateBody(schemas.setUserActive), asyncHandler(async (req, res) => {
  const user = await usersRepository.setActive(pool, req.params.id, req.body.isActive);
  if (!user) return res.status(404).json({ error: "User not found." });

  // If deactivated student, delete their Google Workspace email
  if (req.body.isActive === false && user.role === "student" && user.schoolEmail) {
    try {
      await deleteSchoolEmail(user.schoolEmail);
      await pool.query(
        "UPDATE users SET email_provisioned = false, school_email = NULL, email_provisioned_at = NULL WHERE id = $1",
        [user.id]
      );
      user.emailProvisioned = false;
      user.schoolEmail = undefined;
    } catch (err) {
      console.error(`[deleteSchoolEmail] Failed to delete workspace account for ${user.schoolEmail}:`, err);
    }
  }

  invalidateStoreCache();
  await audit(req, "toggle_user_status", user.id, `isActive=${user.isActive}`);
  res.json(user);
}));

app.get("/api/academics/warnings", requireAuth, asyncHandler(async (req, res) => {
  const requestedStudentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const result = await academicsRepository.listWarningsForUser(pool, req.user!, requestedStudentId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.json(result.warnings);
}));
app.post("/api/academics/warnings", requireAuth, requireRole(["admin", "teacher", "super_admin"]), validateBody(schemas.createWarning), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.createWarning(pool, req.body);
  await audit(req, "create_academic_warning", warning.studentId, warning.message);
  res.status(201).json(warning);
}));
app.post("/api/academics/warnings/:id/resolve", requireAuth, requireRole(["admin", "teacher", "super_admin"]), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.resolveWarning(pool, req.params.id);
  if (!warning) return res.status(404).json({ error: "Warning not found." });
  await audit(req, "resolve_academic_warning", warning.id, warning.studentId);
  res.json(warning);
}));
app.get("/api/advisor/students", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getAssignments(pool, req.user!.id))));
app.get("/api/advisor/at-risk", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getAtRiskStudents(pool, req.user!.id))));
app.get("/api/advisor/notes/:studentId", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await advisorsRepository.getNotes(pool, req.params.studentId))));
app.post("/api/advisor/notes", requireAuth, requireRole(["teacher"]), validateBody(schemas.advisorNote), asyncHandler(async (req, res) => {
  const note = await advisorsRepository.createNote(pool, { advisorId: req.user!.id, ...req.body });
  await audit(req, "add_advisor_note", note.student_id, note.type);
  res.status(201).json(note);
}));

app.patch("/api/advisor/student-profile/:studentId", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.updateStudentNotes), asyncHandler(async (req, res) => {
  const { notes } = req.body;
  await pool.query(
    "UPDATE student_profiles SET notes = $1 WHERE user_id = $2",
    [notes, req.params.studentId]
  );
  await audit(req, "update_student_notes", req.params.studentId, "Advisor updated student academic plan/notes.");
  res.json({ ok: true, message: "Cập nhật đề xuất lộ trình thành công!" });
}));
app.post("/api/advisor/assignments", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.advisorAssignment), asyncHandler(async (req, res) => {
  const assignment = await advisorsRepository.assignStudent(pool, req.body.advisorId, req.body.studentId, req.body.semesterId);
  res.status(assignment ? 201 : 409).json(assignment || { error: "Advisor assignment already exists." });
}));
app.delete("/api/advisor/assignments/:id", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const assignment = await advisorsRepository.unassignStudent(pool, req.params.id);
  if (!assignment) return res.status(404).json({ error: "Advisor assignment not found." });
  res.json(assignment);
}));

app.get("/api/parent/grades", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getGrades(pool, req.linkedStudentId!))));
app.get("/api/parent/attendance", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getAttendance(pool, req.linkedStudentId!))));
app.get("/api/parent/tuition", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getTuition(pool, req.linkedStudentId!))));
app.get("/api/parent/warnings", requireAuth, requireRole(["parent"]), resolveLinkedStudent, asyncHandler(async (req, res) => res.json(await parentRepository.getWarnings(pool, req.linkedStudentId!))));
app.get("/api/parent/notifications", requireAuth, requireRole(["parent"]), asyncHandler(async (req, res) => res.json(await parentRepository.getNotifications(pool, req.user!.id))));

app.get("/api/notifications", requireAuth, asyncHandler(async (req, res) => res.json(await notificationsRepository.listForUser(pool, req.user!.id, req.query.unreadOnly === "true"))));
// IMPORTANT: /read-all must be registered BEFORE /:id/read to avoid Express matching "read-all" as an id param
app.patch("/api/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  await notificationsRepository.markAllRead(pool, req.user!.id);
  invalidateStoreCache();
  res.status(204).send();
}));
app.patch("/api/notifications/:id/read", requireAuth, asyncHandler(async (req, res) => {
  await notificationsRepository.markRead(pool, req.params.id, req.user!.id);
  invalidateStoreCache();
  res.status(204).send();
}));

app.post("/api/course-sections", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.courseSection), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user!.role === "teacher") {
    if (course.teacherId !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
    req.body.teacherId = req.user!.id;
    req.body.status = "pending";
  }
  const payload: SectionPayload = {
    ...req.body,
    numberOfSessions: req.body.numberOfSessions || course.numberOfLessons || 10,
    openingDate: req.body.openingDate || course.openingDate
  };
  if (!payload.teacherId) return res.status(400).json({ error: "teacherId is required." });
  const scheduleConflicts = await validateCourseSectionScheduleConflicts(pool, payload);
  if (scheduleConflicts.length > 0) {
    return res.status(409).json({ error: scheduleConflicts[0], conflicts: scheduleConflicts });
  }
  const row = await upsertCourseSection(pool, payload);
  invalidateStoreCache();
  await audit(req, "create_course_section", row.id, row.sectionCode);
  res.status(201).json(row);
}));

app.put("/api/course-sections/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.courseSection), asyncHandler(async (req, res) => {
  const existing = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Course section not found." });
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user!.role === "teacher") {
    if (course.teacherId !== req.user!.id || existing.teacher_id !== req.user!.id) {
      return res.status(403).json({ error: "Permission denied." });
    }
    req.body.teacherId = req.user!.id;
    req.body.status = existing.status;
  }
  const payload: SectionPayload = {
    ...req.body,
    id: req.params.id,
    numberOfSessions: req.body.numberOfSessions || existing.number_of_sessions || course.numberOfLessons || 10,
    openingDate: req.body.openingDate || existing.opening_date || course.openingDate
  };
  if (!payload.teacherId) return res.status(400).json({ error: "teacherId is required." });
  const scheduleConflicts = await validateCourseSectionScheduleConflicts(pool, payload);
  if (scheduleConflicts.length > 0) {
    return res.status(409).json({ error: scheduleConflicts[0], conflicts: scheduleConflicts });
  }
  const row = await upsertCourseSection(pool, payload);
  invalidateStoreCache();
  await audit(req, "update_course_section", row.id, row.sectionCode);
  res.json(row);
}));

app.delete("/api/course-sections/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const existing = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Course section not found." });
  if (req.user!.role === "teacher" && existing.teacher_id !== req.user!.id) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM course_registrations WHERE section_id = $1", [req.params.id]);
    await client.query("DELETE FROM section_schedules WHERE section_id = $1", [req.params.id]);
    await client.query("DELETE FROM course_sections WHERE id = $1", [req.params.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  invalidateStoreCache();
  await audit(req, "delete_course_section", req.params.id, existing.section_code);
  res.status(204).send();
}));

app.post("/api/course-registrations", requireAuth, requireRole(["student"]), validateBody(schemas.courseRegistration), asyncHandler(async (req, res) => {
  const result = await courseRegistrationsRepository.register(pool, req.user!.id, req.body.sectionId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  invalidateStoreCache();
  res.status(201).json(result.row);
}));
app.patch("/api/course-registrations/:id/drop", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const registration = await courseRegistrationsRepository.drop(pool, req.params.id, req.user!.id);
  if (!registration) return res.status(404).json({ error: "Course registration not found." });
  invalidateStoreCache();
  res.json(registration);
}));

app.patch("/api/course-registrations/:id/approve", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const registration = (await client.query(
      `SELECT cr.*, cs.max_students, cs.course_id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.id = $1
       FOR UPDATE`,
      [req.params.id]
    )).rows[0];
    if (!registration) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Course registration not found." });
    }
    const enrollment = (await client.query(
      "SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2 FOR UPDATE",
      [registration.student_id, registration.course_id]
    )).rows[0];
    if (!enrollment) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Enrollment not found." });
    }
    if (!await hasConfirmedPaymentForCoursePlacement(client, registration.student_id, registration.course_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment must be confirmed before class placement." });
    }
    const count = Number((await client.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered' AND id <> $2",
      [registration.section_id, registration.id]
    )).rows[0].count);
    if (count >= Number(registration.max_students)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Class section is full." });
    }
    const row = (await client.query(
      "UPDATE course_registrations SET status = 'registered' WHERE id = $1 RETURNING *",
      [req.params.id]
    )).rows[0];
    await client.query("UPDATE enrollments SET status = 'active' WHERE id = $1", [enrollment.id]);
    await client.query("COMMIT");
    invalidateStoreCache();
    await audit(req, "approve_course_registration", req.params.id, registration.student_id);
    res.json(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/grade-appeals", requireAuth, requireRole(["student"]), validateBody(schemas.gradeAppeal), asyncHandler(async (req, res) => {
  const result = await gradeAppealsRepository.create(pool, req.user!.id, req.body);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.get("/api/grade-appeals", requireAuth, requireRole(["student", "teacher", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await gradeAppealsRepository.list(pool, req.user!))));
app.patch("/api/grade-appeals/:id/review", requireAuth, requireRole(["teacher"]), validateBody(schemas.gradeAppealReview), asyncHandler(async (req, res) => {
  const appeal = await gradeAppealsRepository.review(pool, req.params.id, req.user!.id, req.body.revisedGrade);
  if (!appeal) return res.status(404).json({ error: "Grade appeal not found." });
  res.json(appeal);
}));
app.patch("/api/grade-appeals/:id/resolve", requireAuth, requireRole(["admin"]), validateBody(schemas.gradeAppealResolve), asyncHandler(async (req, res) => {
  const appeal = await gradeAppealsRepository.resolve(pool, req.params.id, req.user!.id, req.body.status, req.body.resolutionNote);
  if (!appeal) return res.status(404).json({ error: "Grade appeal not found." });
  res.json(appeal);
}));
app.patch("/api/grade-appeals/:id/escalate", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const appeal = await gradeAppealsRepository.escalate(pool, req.params.id, req.user!.id);
  if (!appeal) return res.status(404).json({ error: "Rejected appeal not found or already escalated." });
  res.json(appeal);
}));

app.post("/api/leave-requests", requireAuth, requireRole(["student"]), validateBody(schemas.leaveRequest), asyncHandler(async (req, res) => res.status(201).json(await leaveRequestsRepository.create(pool, req.user!.id, req.body))));
app.get("/api/leave-requests", requireAuth, requireRole(["student", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await leaveRequestsRepository.list(pool, req.user!))));
app.patch("/api/leave-requests/:id/approve", requireAuth, requireRole(["admin"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const request = await leaveRequestsRepository.approve(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!request) return res.status(404).json({ error: "Leave request not found." });
  res.json(request);
}));
app.patch("/api/leave-requests/:id/reject", requireAuth, requireRole(["admin"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const request = await leaveRequestsRepository.reject(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!request) return res.status(404).json({ error: "Leave request not found." });
  res.json(request);
}));

app.post("/api/graduation-applications", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const result = await graduationRepository.create(pool, req.user!.id);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.get("/api/graduation-applications", requireAuth, requireRole(["student", "manager", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await graduationRepository.list(pool, req.user!))));
app.patch("/api/graduation-applications/:id/approve", requireAuth, requireRole(["admin"]), validateBody(schemas.graduationApplicationReview), asyncHandler(async (req, res) => {
  const application = await graduationRepository.approve(pool, req.params.id, req.user!.id, req.body.note);
  if (!application) return res.status(404).json({ error: "Graduation application not found." });
  if ("error" in application) return res.status(application.status).json({ error: application.error });
  res.json(application);
}));
app.patch("/api/graduation-applications/:id/reject", requireAuth, requireRole(["admin"]), validateBody(schemas.graduationApplicationReview), asyncHandler(async (req, res) => {
  const application = await graduationRepository.reject(pool, req.params.id, req.user!.id, req.body.note);
  if (!application) return res.status(404).json({ error: "Graduation application not found." });
  res.json(application);
}));

app.get("/api/scholarships", requireAuth, asyncHandler(async (_req, res) => res.json(await scholarshipsRepository.list(pool))));
app.post("/api/scholarships", requireAuth, requireRole(["admin", "super_admin"]), validateBody(schemas.scholarship), asyncHandler(async (req, res) => res.status(201).json(await scholarshipsRepository.create(pool, req.body))));
app.get("/api/scholarship-applications", requireAuth, requireRole(["student", "teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => res.json(await scholarshipsRepository.listApplications(pool, req.user!))));
app.post("/api/scholarship-applications", requireAuth, requireRole(["student"]), validateBody(schemas.scholarshipApplication), asyncHandler(async (req, res) => {
  const result = await scholarshipsRepository.apply(pool, req.user!.id, req.body);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.row);
}));
app.patch("/api/scholarship-applications/:id/approve", requireAuth, requireRole(["admin", "super_admin"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const application = await scholarshipsRepository.approve(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!application) return res.status(404).json({ error: "Scholarship application not found." });
  res.json(application);
}));
app.patch("/api/scholarship-applications/:id/reject", requireAuth, requireRole(["admin", "super_admin"]), validateBody(schemas.reviewNote), asyncHandler(async (req, res) => {
  const application = await scholarshipsRepository.reject(pool, req.params.id, req.user!.id, req.body.reviewNote);
  if (!application) return res.status(404).json({ error: "Scholarship application not found." });
  res.json(application);
}));

app.get("/api/academic-warnings", requireAuth, asyncHandler(async (req, res) => {
  const requestedStudentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const result = await academicsRepository.listWarningsForUser(pool, req.user!, requestedStudentId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.json(result.warnings);
}));
app.patch("/api/academic-warnings/:id/resolve", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const warning = await academicsRepository.resolveWarning(pool, req.params.id, req.user!.id);
  if (!warning) return res.status(404).json({ error: "Warning not found." });
  res.json(warning);
}));

app.post("/api/tuition/pay", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.payTuition), asyncHandler(async (req, res) => {
  const ownerStudentId = req.user!.role === "student" ? req.user!.id : undefined;
  const client = await pool.connect();
  let result;
  try {
    await client.query("BEGIN");
    result = await financeRepository.payTuition(client, req.body.feeId, req.body.paidAmount, ownerStudentId);
    if (!result) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Tuition fee not found." }); }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  await audit(req, "record_tuition_payment", req.body.feeId, `Paid amount ${req.body.paidAmount}.`);
  res.json(result);
}));

app.post("/api/tuition/confirm-transfer", requireAuth, requireRole(["student"]), validateBody(schemas.confirmTransfer), asyncHandler(async (req, res) => {
  const { feeId, amount } = req.body;
  const client = await pool.connect();
  let txId = "";
  try {
  await client.query("BEGIN");
  const fee = (await client.query(
    "SELECT id, student_id, amount, paid_amount FROM tuition_fees WHERE id = $1 FOR UPDATE",
    [feeId]
  )).rows[0];
  if (!fee || fee.student_id !== req.user!.id) {
    await client.query("ROLLBACK");
    return res.status(404).json({ error: "Tuition fee not found." });
  }
  const remaining = Math.max(0, Number(fee.amount) - Number(fee.paid_amount || 0));
  const tuitionNote = `tuition_fee_pay:${feeId}`;
  const pendingAmount = Number((await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE student_id = $1
       AND status = 'pending'
       AND (notes = $2 OR notes LIKE $2 || ' |%')`,
    [req.user!.id, tuitionNote]
  )).rows[0]?.total || 0);
  if (remaining <= 0 || Number(amount) + pendingAmount > remaining) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: "Invalid transfer amount." });
  }
  txId = generateId("tx");
  await client.query(
    `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at, notes)
     VALUES ($1, $2, NULL, $3, 'pending', 'Chuyển khoản Ngân hàng (QR)', $4, $5)`,
    [txId, req.user!.id, Number(amount), new Date().toISOString(), tuitionNote]
  );
  await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit(req, "request_tuition_confirm", feeId, `Pending bank transfer of ${amount} for tuition.`);
  res.json({ ok: true, transactionId: txId });
}));

const reviewTransactionHandler = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let result: any;
  try {
    await client.query("BEGIN");
    result = await financeRepository.reviewTransaction(client, req.params.id, req.body.status, req.user!.id, req.body.notes);
    if (!result) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found." });
    }
    if ("error" in result) {
      await client.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await audit(req, `finance_transaction_${req.body.status}`, req.params.id, req.body.notes || "");
  res.json(result);
});

app.patch("/api/finance/transactions/:id/review", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.reviewTransaction), reviewTransactionHandler);
app.patch("/api/payments/transactions/:id/review", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.reviewTransaction), reviewTransactionHandler);

const bulkIssueTuitionHandler = asyncHandler(async (req, res) => {
  const { semesterId, amount, dueDate } = req.body;
  const dueDateValue = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profiles = (await client.query(
      "SELECT user_id FROM student_profiles WHERE status = 'active'"
    )).rows;
    const created: any[] = [];
    for (const profile of profiles) {
      const exists = (await client.query(
        "SELECT id FROM tuition_fees WHERE student_id = $1 AND semester_id = $2",
        [profile.user_id, semesterId]
      )).rows[0];
      if (exists) continue;
      const id = generateId("tf");
      const row = (await client.query(
        `INSERT INTO tuition_fees (id, student_id, semester_id, amount, due_date, status, paid_amount)
         VALUES ($1,$2,$3,$4,$5,'unpaid',0)
         RETURNING *`,
        [id, profile.user_id, semesterId, Number(amount), dueDateValue]
      )).rows[0];
      await notificationsRepository.create(client, {
        userId: profile.user_id,
        type: "info",
        message: `Thông báo nộp học phí: học kỳ ${semesterId}, số tiền ${Number(amount).toLocaleString()} VND.`,
        relatedEntityType: "tuition_fee",
        relatedEntityId: id
      });
      created.push(row);
    }
    await client.query("COMMIT");
    await audit(req, "bulk_issue_tuition", semesterId, `Issued ${created.length} tuition fees.`);
    res.status(201).json({ createdCount: created.length, fees: created.map(tuitionFeeFromRow) });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.post("/api/finance/tuition/bulk-issue", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.bulkIssueTuition), bulkIssueTuitionHandler);
app.post("/api/payments/tuition/bulk-issue", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.bulkIssueTuition), bulkIssueTuitionHandler);

const scanOverdueHandler = asyncHandler(async (req, res) => {
  const overdue = await financeRepository.checkOverdueFees(pool);
  await audit(req, "scan_overdue_tuition", "tuition_fees", `Found ${overdue.length} overdue fees.`);
  res.json({ overdueCount: overdue.length, fees: overdue });
});

app.post("/api/finance/tuition/scan-overdue", requireAuth, requireRole(["manager", "admin", "super_admin"]), scanOverdueHandler);
app.post("/api/payments/tuition/scan-overdue", requireAuth, requireRole(["manager", "admin", "super_admin"]), scanOverdueHandler);

const paymentWebhookHandler = asyncHandler(async (req, res) => {
  const signature = req.header("X-Payment-Signature");

  if (!signature) {
    return res.status(400).json({ error: "Missing webhook signature header." });
  }

  const payload = (req as any).rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac("sha256", PAYMENT_WEBHOOK_SECRET_VALUE).update(payload).digest("hex");
  const receivedSignature = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;

  const sigBuffer = Buffer.from(receivedSignature, "utf8");
  const expBuffer = Buffer.from(expectedSignature, "utf8");

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  const { eventId, timestamp, transactionId, status, notes } = req.body;
  if (!eventId || !timestamp || !transactionId || !status) {
    return res.status(400).json({ error: "Missing required webhook payload fields." });
  }

  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "Invalid transaction status in webhook payload." });
  }

  const eventTimestamp = parseWebhookTimestamp(timestamp);
  if (!eventTimestamp) {
    return res.status(400).json({ error: "Invalid webhook timestamp." });
  }
  if (!isWebhookTimestampFresh(eventTimestamp)) {
    return res.status(400).json({ error: "Webhook timestamp is outside the allowed tolerance window." });
  }

  const payloadSha256 = sha256Hex(payload);
  const client = await pool.connect();
  let result: any;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO payment_webhook_events (
         event_id, transaction_id, status, event_timestamp, payload_sha256, processing_status
       ) VALUES ($1, $2, $3, $4, $5, 'processing')
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, transactionId, status, eventTimestamp.toISOString(), payloadSha256]
    );

    if (inserted.rowCount === 0) {
      const existing = (await client.query(
        "SELECT event_id, transaction_id, processing_status, payload_sha256, error FROM payment_webhook_events WHERE event_id = $1",
        [eventId]
      )).rows[0];
      await client.query("ROLLBACK");
      if (existing?.payload_sha256 && existing.payload_sha256 !== payloadSha256) {
        return res.status(409).json({ error: "Webhook event id was already used with a different payload." });
      }
      return res.json({
        ok: true,
        duplicate: true,
        eventId,
        transactionId: existing?.transaction_id || transactionId,
        status: existing?.processing_status || "unknown",
        error: existing?.error || undefined
      });
    }

    result = await financeRepository.reviewTransaction(
      client,
      transactionId,
      status,
      null,
      notes || "Processed via payment gateway webhook callback."
    );
    if (!result) {
      await client.query(
        "UPDATE payment_webhook_events SET processing_status = 'failed', error = $2 WHERE event_id = $1",
        [eventId, "Transaction not found."]
      );
      await client.query("COMMIT");
      return res.status(404).json({ error: "Transaction not found." });
    }
    if ("error" in result) {
      await client.query(
        "UPDATE payment_webhook_events SET processing_status = 'failed', error = $2 WHERE event_id = $1",
        [eventId, result.error]
      );
      await client.query("COMMIT");
      return res.status(result.status || 400).json({ error: result.error });
    }
    await client.query(
      "UPDATE payment_webhook_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = $1",
      [eventId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await logSystemAudit(`finance_transaction_${status}`, transactionId, notes || "Processed via payment gateway webhook callback.");
  res.json({ ok: true, eventId, message: "Webhook processed successfully", transaction: result });
});

app.post("/api/payments/webhook", paymentWebhookHandler);
app.post("/api/webhooks/payment", paymentWebhookHandler);

async function validateAttendanceSectionAccess(courseId: string, sectionId: string | undefined, user: User): Promise<{ section?: any; status?: number; error?: string }> {
  if (!sectionId) return {};
  const section = (await pool.query(
    "SELECT id, course_id, teacher_id FROM course_sections WHERE id = $1",
    [sectionId]
  )).rows[0];
  if (!section) return { status: 404, error: "Course section not found." };
  if (section.course_id !== courseId) return { status: 400, error: "Selected section does not belong to this course." };
  if (user.role === "teacher" && section.teacher_id !== user.id) return { status: 403, error: "Permission denied for this class section." };
  return { section };
}

app.post("/api/attendance/sessions", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.attendanceSession), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user!.role === "teacher" && course.teacherId !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  const sectionValidation = await validateAttendanceSectionAccess(req.body.courseId, req.body.sectionId, req.user!);
  if (sectionValidation.error) return res.status(sectionValidation.status!).json({ error: sectionValidation.error });
  const session = {
    id: generateId("ats"),
    courseId: req.body.courseId,
    sectionId: req.body.sectionId,
    semesterId: req.body.semesterId || "sem_spring25",
    teacherId: req.user!.role === "teacher" ? req.user!.id : course.teacherId,
    date: req.body.date,
    topic: req.body.topic
  };
  const records = (req.body.records || []).map((record: any) => ({
    id: generateId("atr"),
    sessionId: session.id,
    studentId: record.studentId,
    status: record.status,
    note: record.note
  }));
  await attendanceRepository.saveAttendanceSession(pool, session, records);
  invalidateStoreCache();
  await audit(req, "create_attendance_session", session.id, session.courseId);
  res.status(201).json({ session, records });
}));

app.patch("/api/attendance/sessions/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.updateAttendanceSession), asyncHandler(async (req, res) => {
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [req.params.id])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });
  if (req.user!.role === "teacher" && session.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  const updated = await attendanceRepository.updateSession(pool, req.params.id, req.body);
  invalidateStoreCache();
  await audit(req, "update_attendance_session", req.params.id, updated.topic);
  res.json(updated);
}));

app.patch("/api/attendance/records", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.attendanceRecord), asyncHandler(async (req, res) => {
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [req.body.sessionId])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });
  if (req.user!.role === "teacher" && session.teacher_id !== req.user!.id) return res.status(403).json({ error: "Permission denied." });
  const studentInSession = (await pool.query(
    `SELECT 1 FROM course_registrations cr
     JOIN attendance_sessions ats ON ats.section_id = cr.section_id
     WHERE ats.id = $1 AND cr.student_id = $2 AND cr.status = 'registered'`,
    [req.body.sessionId, req.body.studentId]
  )).rows[0];
  if (!studentInSession) return res.status(403).json({ error: "Student is not registered in this session's class." });
  const existing = (await pool.query(
    "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
    [req.body.sessionId, req.body.studentId]
  )).rows[0];
  const record = {
    id: existing?.id || generateId("atr"),
    sessionId: req.body.sessionId,
    studentId: req.body.studentId,
    status: req.body.status,
    note: req.body.note
  };
  await attendanceRepository.bulkMarkRecords(pool, [record]);
  invalidateStoreCache();
  await audit(req, "update_attendance_record", record.id, `${record.studentId}:${record.status}`);
  res.json(record);
}));

app.post("/api/attendance/sessions/generate-link", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.generateAttendanceLink), asyncHandler(async (req, res) => {
  const { courseId, sectionId, semesterId, topic } = req.body;
  const course = await coursesRepository.findById(pool, courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user!.role === "teacher" && course.teacherId !== req.user!.id) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const sectionValidation = await validateAttendanceSectionAccess(courseId, sectionId, req.user!);
  if (sectionValidation.error) return res.status(sectionValidation.status!).json({ error: sectionValidation.error });

  // Generate unique 6-character random uppercase code
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  // 5 minutes expiry
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const session = {
    id: generateId("ats"),
    courseId,
    sectionId,
    semesterId: semesterId || "sem_spring25",
    teacherId: req.user!.role === "teacher" ? req.user!.id : course.teacherId,
    date: new Date().toISOString().slice(0, 10),
    topic,
    code,
    expiresAt
  };

  // Insert session into database
  const columns = (await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' AND column_name IN ('date', 'session_date', 'section_id')"
  )).rows.map(row => row.column_name);
  const sessionDateOnly = session.date.slice(0, 10);

  if (columns.includes("session_date") && columns.includes("date")) {
    await pool.query(
      `INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, session_date, date, topic, code, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [session.id, session.courseId, session.semesterId, session.teacherId, sessionDateOnly, session.date, session.topic, session.code, session.expiresAt]
    );
  } else {
    await pool.query(
      `INSERT INTO attendance_sessions (id, course_id, semester_id, teacher_id, date, topic, code, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [session.id, session.courseId, session.semesterId, session.teacherId, session.date, session.topic, session.code, session.expiresAt]
    );
  }
  if (columns.includes("section_id") && sectionId) {
    await pool.query("UPDATE attendance_sessions SET section_id = $1 WHERE id = $2", [sectionId, session.id]);
  }

  // Fetch active students for the selected section when provided, otherwise for the course.
  const enrollmentsRes = sectionId
    ? await pool.query(
        "SELECT student_id FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
        [sectionId]
      )
    : await pool.query(
        "SELECT student_id FROM enrollments WHERE course_id = $1 AND status = 'active'",
        [courseId]
      );
  const studentIds = enrollmentsRes.rows.map(row => row.student_id);

  // Send check-in notifications to all active students in class
  const message = `[Điểm danh trực tuyến] Môn học "${course.title}" đang tiến hành điểm danh trực tuyến. Hãy click vào đây để xác nhận có mặt (Thời hạn 5 phút).`;

  for (const studentId of studentIds) {
    await notificationsRepository.create(pool, {
      userId: studentId,
      type: "attendance_link",
      message,
      relatedEntityType: "attendance_session",
      relatedEntityId: session.id
    });
  }

  await audit(req, "create_attendance_link", session.id, `Course: ${course.title}, Code: ${code}`);

  res.status(201).json({ session, code, expiresAt });
}));


const getVietnamTimeInfo = () => {
  const now = new Date();
  const tzOffset = 7 * 60; // Vietnam is UTC+7
  const localTime = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60 * 1000);

  const yyyy = localTime.getFullYear();
  const mm = String(localTime.getMonth() + 1).padStart(2, "0");
  const dd = String(localTime.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const day = localTime.getDay();
  const dayStr = day === 0 ? "Chủ Nhật" : `Thứ ${day === 1 ? "Hai" : day === 2 ? "Ba" : day === 3 ? "Tư" : day === 4 ? "Năm" : day === 5 ? "Sáu" : "Bảy"}`;

  const hh = String(localTime.getHours()).padStart(2, "0");
  const min = String(localTime.getMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${min}`;

  return { dateStr, dayStr, timeStr };
};

const VIETNAMESE_DAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const timeToMins = (time: string) => {
  const [h, m] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};

const parseSlotTime = (slotTime: string) => {
  const match = String(slotTime || "").trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!match) return null;
  return { startTime: match[1], endTime: match[2], normalized: `${match[1]} - ${match[2]}` };
};

const isValidDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const dayOfWeekForDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return VIETNAMESE_DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};

const findScheduleSlot = (schedule: any[], classDate: string, slotTime: string) => {
  if (!Array.isArray(schedule) || schedule.length === 0 || !isValidDateOnly(classDate)) return null;
  const parsedSlot = parseSlotTime(slotTime);
  if (!parsedSlot) return null;
  const requestedDay = dayOfWeekForDate(classDate);

  return schedule.find(slot => {
    if (`${slot.startTime} - ${slot.endTime}` !== parsedSlot.normalized) return false;
    if (slot.specificDate) return String(slot.specificDate).slice(0, 10) === classDate;
    return slot.dayOfWeek === requestedDay;
  }) || null;
};

const isCurrentVietnamTimeWithinSlot = (classDate: string, slot: any) => {
  const { dateStr, timeStr } = getVietnamTimeInfo();
  if (dateStr !== classDate) return false;
  const currentMins = timeToMins(timeStr);
  const startMins = timeToMins(slot.startTime);
  const endMins = timeToMins(slot.endTime);
  return Number.isFinite(currentMins) && currentMins >= startMins && currentMins <= endMins;
};

const isWithinSchedule = (schedule: any[]): boolean => {
  if (!Array.isArray(schedule) || schedule.length === 0) return true;
  const { dateStr } = getVietnamTimeInfo();
  return schedule.some(slot => findScheduleSlot([slot], dateStr, `${slot.startTime} - ${slot.endTime}`) && isCurrentVietnamTimeWithinSlot(dateStr, slot));
};

app.post("/api/attendance/self-checkin", requireAuth, requireRole(["student"]), validateBody(schemas.selfCheckin), asyncHandler(async (req, res) => {
  const { sessionId, code } = req.body;
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [sessionId])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });

  if (!session.code || session.code !== code) {
    return res.status(400).json({ error: "Mã điểm danh không chính xác hoặc không khả dụng." });
  }

  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    return res.status(400).json({ error: "Mã điểm danh đã hết hạn (Chỉ có giá trị trong 5 phút)." });
  }

  if (session.section_id) {
    const section = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [session.section_id])).rows[0];
    if (section) {
      const schedule = parseSchedule(section);
      if (!isWithinSchedule(schedule)) {
        return res.status(400).json({ error: "Điểm danh không hợp lệ: Hiện tại không nằm trong khung giờ học được lên lịch của lớp này!" });
      }
    }
    const registration = (await pool.query(
      "SELECT id FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
      [req.user!.id, session.section_id]
    )).rows[0];
    if (!registration) return res.status(403).json({ error: "Permission denied for this class section." });
  } else {
    const enrollment = (await pool.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'active'",
      [req.user!.id, session.course_id]
    )).rows[0];
    if (!enrollment) return res.status(403).json({ error: "Active enrollment required for attendance check-in." });
  }

  // Record presence for this student
  const existing = (await pool.query(
    "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
    [sessionId, req.user!.id]
  )).rows[0];

  const record = {
    id: existing?.id || generateId("atr"),
    sessionId,
    studentId: req.user!.id,
    status: "present" as const,
    note: "Tự điểm danh qua link"
  };

  await attendanceRepository.bulkMarkRecords(pool, [record]);
  await audit(req, "student_self_checkin", record.id, `Student: ${req.user!.id}, Status: present`);
  res.json({ ok: true, record });
}));

app.post("/api/attendance/teacher-checkin", requireAuth, requireRole(["teacher"]), validateBody(schemas.teacherCheckin), asyncHandler(async (req, res) => {
  const { courseId, sectionId, slotTime, classDate } = req.body;
  const teacherId = req.user!.id;

  if (!isValidDateOnly(classDate)) {
    return res.status(400).json({ error: "Ngày lên lớp không hợp lệ. Định dạng yêu cầu là YYYY-MM-DD." });
  }
  const parsedSlot = parseSlotTime(slotTime);
  if (!parsedSlot) {
    return res.status(400).json({ error: "Khung giờ lên lớp không hợp lệ. Định dạng yêu cầu là HH:mm - HH:mm." });
  }

  // Validate schedule slot matching
  const section = (await pool.query(
    `SELECT cs.*, c.teacher_id AS course_teacher_id
     FROM course_sections cs
     JOIN courses c ON c.id = cs.course_id
     WHERE cs.id = $1`,
    [sectionId]
  )).rows[0];
  if (!section) return res.status(404).json({ error: "Lớp học phần không tồn tại." });
  if (section.course_id !== courseId) {
    return res.status(400).json({ error: "Lớp học phần không thuộc môn học đã chọn." });
  }
  if (section.teacher_id !== teacherId) {
    return res.status(403).json({ error: "Bạn không phải giảng viên được phân công cho lớp học phần này." });
  }
  if (section.status === "cancelled") {
    return res.status(400).json({ error: "Không thể điểm danh lớp học phần đã hủy." });
  }

  const schedule = parseSchedule(section);
  const matchedSlot = findScheduleSlot(schedule, classDate, parsedSlot.normalized);
  if (!matchedSlot) {
    return res.status(400).json({ error: "Ca lên lớp không khớp thời khóa biểu của lớp học phần." });
  }
  if (!isCurrentVietnamTimeWithinSlot(classDate, matchedSlot)) {
    return res.status(400).json({ error: "Điểm danh không hợp lệ: Hiện tại không nằm trong khung giờ học được lên lịch của lớp này!" });
  }

  // Check if teacher already checked in for this section/date/slot.
  const existing = (await pool.query(
    "SELECT id FROM teacher_attendance WHERE teacher_id = $1 AND section_id = $2 AND class_date = $3 AND slot_time = $4",
    [teacherId, sectionId, classDate, parsedSlot.normalized]
  )).rows[0];

  if (existing) {
    return res.status(400).json({ error: "Giảng viên đã điểm danh cho ca học này rồi!" });
  }

  const record = {
    id: generateId("tat"),
    teacherId,
    courseId,
    sectionId,
    classDate,
    slotTime: parsedSlot.normalized,
    status: "present" as const,
    checkedInAt: new Date().toISOString()
  };

  const insertRes = await pool.query(
    `INSERT INTO teacher_attendance (id, teacher_id, course_id, section_id, class_date, slot_time, status, checked_in_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [record.id, record.teacherId, record.courseId, record.sectionId, record.classDate, record.slotTime, record.status, record.checkedInAt]
  );
  if (insertRes.rowCount === 0) {
    return res.status(400).json({ error: "Giảng viên đã điểm danh cho ca học này rồi." });
  }

  const { invalidateStoreCache } = await import("./src/server/repositories/storeSnapshot");
  invalidateStoreCache();

  await audit(req, "teacher_self_checkin", record.id, `Teacher: ${teacherId}, Section: ${sectionId}, Status: present`);

  res.status(201).json({ ok: true, record });
}));

app.post("/api/attendance/warn-teacher", requireAuth, requireRole(["admin", "super_admin"]), asyncHandler(async (req, res) => {
  const { courseId, teacherId } = req.body;
  if (!courseId || !teacherId) {
    return res.status(400).json({ error: "Missing courseId or teacherId." });
  }
  const course = await coursesRepository.findById(pool, courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  const teacher = (await pool.query("SELECT * FROM users WHERE id = $1 AND role = 'teacher'", [teacherId])).rows[0];
  if (!teacher) return res.status(404).json({ error: "Teacher not found." });

  const sectionsRes = await pool.query(
    "SELECT section_code FROM course_sections WHERE course_id = $1 AND teacher_id = $2 AND status != 'cancelled'",
    [courseId, teacherId]
  );
  const sectionCodes = sectionsRes.rows.map((r: any) => r.section_code);
  const sectionCodesText = sectionCodes.length > 0 ? ` (Lớp: ${sectionCodes.join(", ")})` : "";

  await notificationsRepository.createNotification(
    pool,
    teacherId,
    "danger",
    `CẢNH CÁO HỌC VỤ: Môn học "${course.title}"${sectionCodesText} chưa có bất kỳ buổi điểm danh nào. Yêu cầu giảng viên cập nhật điểm danh ngay lập tức!`
  );

  await audit(
    req,
    "warning_attendance_compliance",
    courseId,
    `Gửi cảnh cáo chưa điểm danh cho giảng viên ${teacher.name} (${teacherId})`
  );

  res.json({ ok: true });
}));

app.post("/api/store/sync", requireAuth, requireRole(["admin", "super_admin", "manager"]), asyncHandler(async (req, res) => {
  await syncClientStoreToDb(req.body || {});
  invalidateStoreCache();
  await audit(req, "store_sync", "store", "Client store changes synchronized into Postgres.");
  res.json({ ok: true, mode: "postgres-synchronized" });
}));

async function setupServer() {
  await initializeDatabase();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Dung lượng tệp phải nhỏ hơn 10 GB." });
      return;
    }
    res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error." : err.message || "Internal server error." });
  });
  const HOST = process.env.HOST || "0.0.0.0";
  const server = app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
  server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 0);
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
