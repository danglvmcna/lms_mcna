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

// Session materials are kept in memory only long enough to be pushed to private storage.
// Browsers without Office installed often send docx/pptx as application/octet-stream, so match on
// the extension and store a canonical content type instead of trusting the client MIME.
const MATERIAL_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
const materialUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(Buffer.from(file.originalname, "latin1").toString("utf8")).toLowerCase();
    if (MATERIAL_MIME_BY_EXT[ext]) return cb(null, true);
    const err = new Error("Tài liệu buổi học chỉ nhận tệp .ppt, .pptx, .pdf, .doc, .docx.");
    (err as any).status = 400;
    cb(err);
  },
  limits: { fileSize: MAX_UPLOAD_FILE_BYTES }
});
const MATERIAL_FILE_EXTENSIONS: Record<"slide" | "document", Set<string>> = {
  slide: new Set([".ppt", ".pptx", ".pdf"]),
  document: new Set([".doc", ".docx", ".pdf"])
};

import crypto from "crypto";
import dotenv from "dotenv";
import { getInitialStore } from "./src/store";
import { hashPassword, verifyPassword } from "./src/authHash";
import { LMSDataStore, User } from "./src/types";
import { runMigrations } from "./src/dbMigrations";
import { pool, Queryable } from "./src/server/db";
import { redis, safeRedis } from "./src/server/redis";
import { generateId } from "./src/server/ids";
import { DbUserRow, toPublicUser, parseSchedule, courseSectionFromRow, publicCourseFromRow, publicCourseSectionFromRow } from "./src/server/mappers";
import { validateBody, schemas } from "./src/server/validation";
import { seedAuthUsers, seedCoreLearningData } from "./src/server/seedCore";
import { usersRepository } from "./src/server/repositories/users";
import { coursesRepository } from "./src/server/repositories/courses";
import { enrollmentsRepository } from "./src/server/repositories/enrollments";
import { quizzesRepository } from "./src/server/repositories/quizzes";
import { assignmentsRepository } from "./src/server/repositories/assignments";
import { financeRepository } from "./src/server/repositories/finance";
import { auditRepository } from "./src/server/repositories/audit";
import { limitStoreForRole, storeSnapshotFromDb, invalidateStoreCache } from "./src/server/repositories/storeSnapshot";
import { courseRegistrationsRepository } from "./src/server/repositories/courseRegistrations";
import { notificationsRepository } from "./src/server/repositories/notifications";
import { notifyStudent, notifyRole } from "./src/server/notify";
import { attendanceRepository } from "./src/server/repositories/attendance";
import { forumRepository } from "./src/server/repositories/forum";
import { sectionsRepository } from "./src/server/repositories/sections";
import { sessionMaterialsRepository } from "./src/server/repositories/sessionMaterials";
import { materialStorage } from "./src/server/services/storage";
import {
  dayOfWeekIndex,
  ensureCourseLessonsForSchedule,
  ensureScheduledSessionsForAllSections,
  generatedSessionOrder,
  isDateOnlyText,
  SectionPayload,
  upsertCourseSection
} from "./src/server/services/sectionSchedule";
import {
  confirmCoursePayment,
  hasConfirmedPaymentForCoursePlacement,
  isServiceError,
  placeEnrollment,
  PlacementResult,
  requestEnrollment,
  ServiceError
} from "./src/server/services/enrollmentService";
import { processSepayWebhook } from "./src/server/services/sepayService";
import { enqueueCrmEvent, enqueueEnrollmentEvent } from "./src/server/crm/crmOutbox";
import { verifyCrmSignature } from "./src/server/crm/signature";
import { extractYoutubeVideoId, youtubeWatchUrl } from "./src/utils";
import { eventBus } from "./src/server/eventBus";
import { registerEventHandlers } from "./src/server/eventHandlers";
import { startScheduler } from "./src/server/scheduler";
import { percentToLetterGrade as toLetterGrade, percentToGradePoint as toGradePoint } from "./src/gradeUtils";

import { provisioningService } from "./src/server/emailProvisioning/provisioningService";
import { deleteSchoolEmail } from "./src/server/emailProvisioning/googleWorkspaceClient";
import { sendAccountExistsEmail, sendPasswordResetLinkEmail, sendTemporaryPasswordEmail, hasSmtpConfig } from "./src/server/emailProvisioning/emailWorker";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "mcna-prod-fallback-jwt-secret-92f3e380913d";
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET not set - using fallback secret. Set JWT_SECRET in Vercel/production environment variables.");
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

type UserCreateInput = {
  email: string;
  name: string;
  role: User["role"];
  phone?: string;
};

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
    createdAt: new Date().toISOString()
  };
  return usersRepository.create(db, user);
}

function generateTemporaryPassword() {
  return `Lms-${crypto.randomBytes(8).toString("base64url")}-1`;
}

/**
 * Learner account created from a personal email (self sign-up or CRM): random temporary password,
 * emailed to the learner, who must replace it at first login. If the email cannot be delivered the
 * account is removed again, so the person can simply retry.
 */
async function createStudentWithTemporaryPassword(
  input: { name: string; email: string; phone?: string; crmContactId?: string },
  source: "self" | "crm",
  loginUrl: string
): Promise<{ user: User; temporaryPassword: string } | ServiceError> {
  const temporaryPassword = generateTemporaryPassword();
  const client = await pool.connect();
  let user: User;
  try {
    await client.query("BEGIN");
    const created = await createUserAccount(client, { email: input.email, name: input.name, role: "student", phone: input.phone }, temporaryPassword);
    await client.query(
      "UPDATE users SET must_change_password = true, signup_source = $1, crm_contact_id = $2 WHERE id = $3",
      [source, input.crmContactId || null, created.id]
    );
    await client.query("COMMIT");
    user = { ...created, mustChangePassword: true, signupSource: source, crmContactId: input.crmContactId };
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") return { error: "Email hoặc mã liên hệ CRM đã được sử dụng.", status: 409 };
    throw error;
  } finally {
    client.release();
  }

  try {
    await sendTemporaryPasswordEmail(pool, user.id, { to: user.email, name: user.name, temporaryPassword, loginUrl });
  } catch {
    const cleanup = await pool.connect();
    try {
      await cleanup.query("BEGIN");
      await cleanup.query("DELETE FROM audit_logs WHERE user_id = $1", [user.id]);
      await cleanup.query("DELETE FROM users WHERE id = $1", [user.id]);
      await cleanup.query("COMMIT");
    } catch (cleanupError) {
      await cleanup.query("ROLLBACK");
      console.error("[account] failed to remove account after email failure:", user.id, cleanupError);
    } finally {
      cleanup.release();
    }
    return { error: "Không gửi được email mật khẩu. Vui lòng kiểm tra địa chỉ email và thử lại sau.", status: 503 };
  }
  await enqueueCrmEvent(pool, "contact.registered", {
    lmsUserId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    signupSource: source,
    crmContactId: input.crmContactId || null,
    createdAt: user.createdAt
  }, source === "crm" ? "crm" : "lms");
  return { user, temporaryPassword };
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function lmsBaseUrl(req: express.Request) {
  return (process.env.LMS_LOGIN_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`).replace(/\/$/, "");
}

function passwordResetUrl(req: express.Request, token: string) {
  return `${lmsBaseUrl(req)}/?resetToken=${encodeURIComponent(token)}`;
}

/** Issues a one-time reset token and invalidates the user's earlier unused tokens. */
async function issuePasswordResetToken(userId: string, createdBy: string | null) {
  const resetToken = generatePasswordResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL",
      [userId]
    );
    await client.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [generateId("pwd_reset"), userId, sha256Hex(resetToken), createdBy, expiresAt]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { resetToken, expiresAt };
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

function createIpRateLimiter(name: string, max: number, windowSec: number, message: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      if (process.env.DISABLE_RATE_LIMIT === "true") return next();
      const key = `ratelimit:${name}:${req.ip || req.socket.remoteAddress || "unknown"}`;
      const current = await safeRedis(async () => {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        return count;
      }, 1);
      if (current > max) {
        const ttl = await safeRedis(() => redis.ttl(key), windowSec);
        res.setHeader("Retry-After", String(ttl));
        return res.status(429).json({ error: message });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

const rateLimitPublicCatalog = createIpRateLimiter("public-catalog", 120, 60, "Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.");
const rateLimitRegister = createIpRateLimiter("register", 5, 60 * 60, "Bạn đã gửi quá nhiều yêu cầu tạo tài khoản. Vui lòng thử lại sau.");
const rateLimitForgotPassword = createIpRateLimiter("forgot-password", 5, 15 * 60, "Quá nhiều yêu cầu quên mật khẩu. Vui lòng thử lại sau.");
const rateLimitCrmIntegration = createIpRateLimiter("crm-integration", 300, 60, "Too many CRM integration requests.");

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
  if (req.path === "/auth/register" || req.path === "/api/auth/register") return next();
  if (req.path === "/auth/forgot-password" || req.path === "/api/auth/forgot-password") return next();
  // CRM server-to-server calls authenticate with an API key and an HMAC signature instead of cookies.
  if (req.path.startsWith("/integrations/crm/")) return next();
  if (
    req.path === "/payments/webhook" ||
    req.path === "/webhooks/payment" ||
    req.path === "/api/payments/webhook" ||
    req.path === "/api/webhooks/payment" ||
    req.path === "/api/payments/sepay/webhook" ||
    req.path === "/api/webhooks/sepay" ||
    req.path === "/payments/sepay/webhook" ||
    req.path === "/webhooks/sepay"
  ) return next();
  const cookieToken = extractCookie(req, "e16_lms_csrf");
  const headerToken = req.header("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(`[CSRF] Rejected ${req.method} ${req.originalUrl} — cookie=${cookieToken ? "present" : "MISSING"}, header=${headerToken ? "present" : "MISSING"}, match=${cookieToken === headerToken}`);
    return res.status(403).json({ error: "Invalid CSRF token.", debug: { hasCookie: !!cookieToken, hasHeader: !!headerToken } });
  }
  next();
}

// An account still on its emailed temporary password may only do this much until it sets its own.
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(["/api/auth/me", "/api/auth/logout", "/api/users/change-password"]);

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
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED_PATHS.has(req.originalUrl.split("?")[0])) {
      return res.status(403).json({ error: "Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.", code: "PASSWORD_CHANGE_REQUIRED" });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(roles: Array<User["role"] | string>) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Permission denied." });
    next();
  };
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

  if (!section.teacherId || schedule.length === 0) return errors;

  const existingSections = (await db.query(
    `SELECT cs.*, c.title AS course_title, u.name AS teacher_name
     FROM course_sections cs
     LEFT JOIN courses c ON c.id = cs.course_id
     LEFT JOIN users u ON u.id = cs.teacher_id
     WHERE cs.status <> 'cancelled'
       AND cs.id <> $1
       AND (cs.teacher_id = $2 OR cs.schedule IS NOT NULL OR cs.schedule_json IS NOT NULL)`,
    [section.id || "", section.teacherId]
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
      // User records are written only through scoped API routes, never from a client snapshot.

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
  if (user.role === "admin") {
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
        completedLessons: scoped.lessonProgress.filter((item: any) => item.completed).length
      }
    };
  }
  return scoped;
}

async function initializeDatabase() {
  registerEventHandlers();
  if (process.env.VERCEL) {
    return;
  }
  await runMigrations(pool);
  await usersRepository.normalizeLegacyRoles(pool);
  await seedAuthUsers(pool);
  await seedCoreLearningData(pool);
  await usersRepository.normalizeSystemUsers(pool);
  if (process.env.NODE_ENV === "production") await ensureScheduledSessionsForAllSections(pool);
  invalidateStoreCache();
  startScheduler();
}

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
      "UPDATE users SET password_hash = $1, password_salt = $2, must_change_password = false WHERE id = $3",
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

const ACCOUNT_REQUEST_MESSAGE = "Nếu email hợp lệ, thông tin đăng nhập đã được gửi tới hộp thư của bạn. Vui lòng kiểm tra cả thư mục Spam.";
// Outside production the temporary password is returned too, so E2E tests and local QA can log in without a mailbox.
const exposeDevSecrets = () => process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "staging";

app.post("/api/auth/register", rateLimitRegister, validateBody(schemas.selfRegister), asyncHandler(async (req, res) => {
  const existing = await usersRepository.findAuthByEmail(pool, req.body.email) as DbUserRow | null;
  if (existing) {
    // Same answer as a fresh sign-up so the form cannot be used to discover registered emails.
    void sendAccountExistsEmail(pool, existing.id, { to: existing.email, name: existing.name, loginUrl: lmsBaseUrl(req) })
      .catch(err => console.error("[register] failed to send account-exists email:", err));
    return res.status(202).json({ ok: true, message: ACCOUNT_REQUEST_MESSAGE });
  }

  const result = await createStudentWithTemporaryPassword(
    { name: req.body.name, email: req.body.email, phone: req.body.phone },
    "self",
    lmsBaseUrl(req)
  );
  if ("error" in result) return res.status(result.status).json({ error: result.error });

  invalidateStoreCache();
  await auditRepository.log(pool, result.user.id, "self_register", "security", `Self sign-up with personal email ${result.user.email}.`);
  res.status(202).json({
    ok: true,
    message: ACCOUNT_REQUEST_MESSAGE,
    ...(exposeDevSecrets() || !hasSmtpConfig() ? { devTemporaryPassword: result.temporaryPassword } : {})
  });
}));

app.post("/api/auth/forgot-password", rateLimitForgotPassword, validateBody(schemas.forgotPassword), asyncHandler(async (req, res) => {
  const row = await usersRepository.findAuthByEmail(pool, req.body.email) as DbUserRow | null;
  if (row && row.is_active) {
    // Runs in the background so neither the response body nor its timing reveals whether the email exists.
    void (async () => {
      const { resetToken, expiresAt } = await issuePasswordResetToken(row.id, null);
      await sendPasswordResetLinkEmail(pool, row.id, { to: row.email, name: row.name, resetUrl: passwordResetUrl(req, resetToken), expiresAt });
      await auditRepository.log(pool, row.id, "forgot_password_link_sent", "security", "User requested a password reset link.");
    })().catch(err => console.error("[forgot-password] failed:", err));
  }
  res.json({ ok: true, message: "Nếu email có trong hệ thống, liên kết đặt lại mật khẩu đã được gửi tới hộp thư của bạn." });
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
  if (String(newPassword).length < 8) return res.status(400).json({ error: "Mật khẩu mới phải có tối thiểu 8 ký tự." });
  if (newPassword === currentPassword) return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });

  const row = await usersRepository.findAuthByEmail(pool, req.user!.email) as DbUserRow | null;
  if (!row || !verifyPassword(currentPassword, row.password_hash, row.password_salt || undefined)) {
    return res.status(401).json({ error: "Mật khẩu hiện tại không chính xác." });
  }

  const credential = hashPassword(newPassword);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_salt = $2, must_change_password = false WHERE id = $3",
    [credential.hash, credential.salt, req.user!.id]
  );

  await audit(req, "change_password", req.user!.id, "User updated their account password.");
  res.json({ ok: true, message: "Đổi mật khẩu thành công!" });
}));

app.get("/api/store", requireAuth, asyncHandler(async (req, res) => res.json(limitStoreForRole(await storeSnapshotFromDb(pool), req.user!))));

app.get("/api/dashboard/admin", requireAuth, requireRole(["manager", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const store = await storeSnapshotFromDb(pool);
  res.json({ ...dashboardFromStore(store, req.user!), auditLogs: await auditRepository.listRecent(pool, 100) });
}));
app.get("/api/dashboard/teacher", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));
app.get("/api/dashboard/student", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => res.json(dashboardFromStore(await storeSnapshotFromDb(pool), req.user!))));


const PUBLIC_COURSE_SELECT = `
  SELECT c.*, u.name AS teacher_name,
         (SELECT COUNT(*) FROM course_sections cs WHERE cs.course_id = c.id AND cs.status = 'open')::int AS open_section_count
  FROM courses c
  LEFT JOIN users u ON u.id = c.teacher_id`;

async function listOpenSectionRows(courseIds: string[]) {
  if (courseIds.length === 0) return [];
  return (await pool.query(
    `SELECT cs.*, u.name AS teacher_name,
            (SELECT COUNT(*) FROM course_registrations cr WHERE cr.section_id = cs.id AND cr.status = 'registered')::int AS registered_count
     FROM course_sections cs
     LEFT JOIN users u ON u.id = cs.teacher_id
     WHERE cs.course_id = ANY($1) AND cs.status = 'open'
     ORDER BY cs.opening_date NULLS LAST, cs.section_code`,
    [courseIds]
  )).rows;
}

app.get("/api/public/courses", rateLimitPublicCatalog, asyncHandler(async (_req, res) => {
  const rows = (await pool.query(`${PUBLIC_COURSE_SELECT} WHERE c.status = 'published' ORDER BY c.created_at DESC`)).rows;
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(rows.map(publicCourseFromRow));
}));

app.get("/api/public/courses/:id", rateLimitPublicCatalog, asyncHandler(async (req, res) => {
  const courseRow = (await pool.query(`${PUBLIC_COURSE_SELECT} WHERE c.status = 'published' AND c.id = $1`, [req.params.id])).rows[0];
  if (!courseRow) return res.status(404).json({ error: "Không tìm thấy khóa học." });
  const sectionRows = await listOpenSectionRows([courseRow.id]);
  const sessionRows = sectionRows.length
    ? (await pool.query("SELECT * FROM attendance_sessions WHERE section_id = ANY($1)", [sectionRows.map(row => row.id)])).rows
    : [];
  const lessonRows = (await pool.query(
    "SELECT id, title, duration, lesson_order FROM lessons WHERE course_id = $1 ORDER BY lesson_order ASC",
    [courseRow.id]
  )).rows;
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json({
    course: publicCourseFromRow(courseRow),
    sections: sectionRows.map(row => publicCourseSectionFromRow(row, sessionRows.filter(session => session.section_id === row.id))),
    lessons: lessonRows.map(l => ({ id: l.id, title: l.title, duration: l.duration, order: l.lesson_order }))
  });
}));

// ---- MCNA CRM integration (server-to-server). Contract: docs/crm-integration.md ----

function requireCrmIntegration(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = process.env.CRM_API_KEY;
  const secret = process.env.CRM_INBOUND_SECRET;
  if (!apiKey || !secret) return res.status(503).json({ error: "CRM integration is not configured." });

  const authorization = req.header("Authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  // Compare digests so the check takes the same time whatever the key length.
  const keyMatches = crypto.timingSafeEqual(
    crypto.createHash("sha256").update(provided).digest(),
    crypto.createHash("sha256").update(apiKey).digest()
  );
  if (!provided || !keyMatches) return res.status(401).json({ error: "Invalid CRM API key." });

  const configuredTolerance = Number(process.env.CRM_SIGNATURE_TOLERANCE_SECONDS || 300);
  const signatureFailure = verifyCrmSignature(
    secret,
    req.header("X-CRM-Timestamp"),
    req.header("X-CRM-Signature"),
    (req as any).rawBody || "",
    Number.isFinite(configuredTolerance) && configuredTolerance > 0 ? configuredTolerance : 300
  );
  if (signatureFailure) return res.status(signatureFailure.status).json({ error: signatureFailure.error });
  next();
}

type CrmResult = { status: number; body: any };

/** Runs a CRM write at most once per X-CRM-Event-Id and replays the stored answer when the CRM retries. */
async function runIdempotentCrmCall(req: express.Request, res: express.Response, type: string, handler: () => Promise<CrmResult>) {
  const eventId = req.header("X-CRM-Event-Id");
  if (!eventId || eventId.length > 200) return res.status(400).json({ error: "X-CRM-Event-Id header is required (max 200 characters)." });
  const payloadHash = sha256Hex((req as any).rawBody || "");

  const claimed = await pool.query(
    "INSERT INTO crm_inbound_events (event_id, type, payload_sha256) VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
    [eventId, type, payloadHash]
  );
  if (!claimed.rowCount) {
    const existing = (await pool.query("SELECT * FROM crm_inbound_events WHERE event_id = $1", [eventId])).rows[0];
    if (existing.type !== type || existing.payload_sha256 !== payloadHash) {
      return res.status(409).json({ error: "X-CRM-Event-Id was already used for a different request." });
    }
    if (existing.status === "processed" && existing.response) {
      res.setHeader("X-Idempotent-Replay", "true");
      return res.status(existing.response.status).json(existing.response.body);
    }
    // Only a failed attempt may be retried; a concurrent duplicate is still "processing".
    const retry = await pool.query(
      "UPDATE crm_inbound_events SET status = 'processing', error = NULL WHERE event_id = $1 AND status = 'failed' RETURNING event_id",
      [eventId]
    );
    if (!retry.rowCount) return res.status(409).json({ error: "This event is still being processed." });
  }

  let result: CrmResult;
  try {
    result = await handler();
  } catch (error: any) {
    await pool.query(
      "UPDATE crm_inbound_events SET status = 'failed', error = $2, processed_at = NOW() WHERE event_id = $1",
      [eventId, String(error?.message || error).slice(0, 1000)]
    );
    throw error;
  }
  // 5xx answers are temporary, so the event stays retryable with the same id.
  const temporaryFailure = result.status >= 500;
  await pool.query(
    "UPDATE crm_inbound_events SET status = $2, response = $3, error = $4, processed_at = NOW() WHERE event_id = $1",
    [eventId, temporaryFailure ? "failed" : "processed", JSON.stringify(result), temporaryFailure ? String(result.body?.error || "") : null]
  );
  if (!temporaryFailure) invalidateStoreCache();
  return res.status(result.status).json(result.body);
}

async function findCrmStudentId(input: { crmContactId?: string; email?: string }) {
  if (input.crmContactId) {
    const row = (await pool.query("SELECT id FROM users WHERE crm_contact_id = $1 AND role = 'student'", [input.crmContactId])).rows[0];
    if (row) return row.id as string;
  }
  if (input.email) {
    const row = await usersRepository.findAuthByEmail(pool, input.email) as DbUserRow | null;
    if (row?.role === "student") return row.id;
  }
  return null;
}

app.get("/api/integrations/crm/courses", rateLimitCrmIntegration, requireCrmIntegration, asyncHandler(async (_req, res) => {
  const courseRows = (await pool.query(`${PUBLIC_COURSE_SELECT} WHERE c.status = 'published' ORDER BY c.created_at DESC`)).rows;
  const sectionRows = await listOpenSectionRows(courseRows.map(row => row.id));
  res.json({
    courses: courseRows.map(row => ({
      ...publicCourseFromRow(row),
      sections: sectionRows
        .filter(section => section.course_id === row.id)
        .map(section => {
          const { sessions, ...summary } = publicCourseSectionFromRow(section, []);
          return summary;
        })
    }))
  });
}));

app.post("/api/integrations/crm/students", rateLimitCrmIntegration, requireCrmIntegration, validateBody(schemas.crmUpsertStudent), asyncHandler(async (req, res) => {
  await runIdempotentCrmCall(req, res, "students.upsert", async () => {
    const { crmContactId, name, email, phone } = req.body;
    const linked = (await pool.query("SELECT id, email FROM users WHERE crm_contact_id = $1", [crmContactId])).rows[0];
    if (linked) return { status: 200, body: { lmsUserId: linked.id, email: linked.email, created: false } };

    const existing = await usersRepository.findAuthByEmail(pool, email) as DbUserRow | null;
    if (existing) {
      if (existing.role !== "student") return { status: 409, body: { error: "Email belongs to a non-student account." } };
      if (existing.crm_contact_id) return { status: 409, body: { error: "Email is already linked to another CRM contact." } };
      await pool.query("UPDATE users SET crm_contact_id = $1 WHERE id = $2", [crmContactId, existing.id]);
      return { status: 200, body: { lmsUserId: existing.id, email: existing.email, created: false } };
    }

    const result = await createStudentWithTemporaryPassword({ name, email, phone, crmContactId }, "crm", lmsBaseUrl(req));
    if (isServiceError(result)) return { status: result.status, body: { error: result.error } };
    await auditRepository.log(pool, result.user.id, "crm_create_student", "security", `Created from CRM contact ${crmContactId}.`);
    return { status: 201, body: { lmsUserId: result.user.id, email: result.user.email, created: true } };
  });
}));

app.post("/api/integrations/crm/enrollments", rateLimitCrmIntegration, requireCrmIntegration, validateBody(schemas.crmCreateEnrollment), asyncHandler(async (req, res) => {
  await runIdempotentCrmCall(req, res, "enrollments.create", async () => {
    const studentId = await findCrmStudentId(req.body);
    if (!studentId) return { status: 404, body: { error: "No student account found for this CRM contact or email." } };

    const result = await requestEnrollment({
      studentId,
      courseId: req.body.courseId,
      sectionId: req.body.sectionId,
      origin: "crm",
      crmDealId: req.body.crmDealId
    });
    if (isServiceError(result)) {
      if (result.status !== 409) return { status: result.status, body: { error: result.error } };
      const current = (await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 ORDER BY enrolled_at DESC LIMIT 1",
        [studentId, req.body.courseId]
      )).rows[0];
      return { status: 409, body: { error: result.error, enrollmentId: current?.id || null } };
    }
    return {
      status: 201,
      body: {
        enrollmentId: result.enrollment.id,
        status: result.enrollment.status,
        transactionId: result.transactionId || null,
        requestedSectionId: result.enrollment.requestedSectionId || null
      }
    };
  });
}));

app.post("/api/integrations/crm/payments/confirm", rateLimitCrmIntegration, requireCrmIntegration, validateBody(schemas.crmConfirmPayment), asyncHandler(async (req, res) => {
  await runIdempotentCrmCall(req, res, "payments.confirm", async () => {
    const enrollmentRow = req.body.enrollmentId
      ? (await pool.query("SELECT * FROM enrollments WHERE id = $1", [req.body.enrollmentId])).rows[0]
      : (await pool.query("SELECT * FROM enrollments WHERE crm_deal_id = $1 ORDER BY enrolled_at DESC LIMIT 1", [req.body.crmDealId])).rows[0];
    if (!enrollmentRow) return { status: 404, body: { error: "Enrollment not found." } };

    let transactionId: string | null = null;
    let placedSectionId: string | null = null;
    let placementError: string | null = null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const payment = await confirmCoursePayment(
        client,
        enrollmentRow.id,
        { amount: req.body.amount, reference: req.body.reference, paidAt: req.body.paidAt },
        "crm"
      );
      if (isServiceError(payment)) {
        await client.query("ROLLBACK");
        return { status: payment.status, body: { error: payment.error } };
      }
      transactionId = payment.transactionId;

      const sectionId = req.body.sectionId || enrollmentRow.requested_section_id;
      if (sectionId && !["active", "completed"].includes(enrollmentRow.status)) {
        // A failed placement (e.g. the class filled up) must not undo the recorded payment.
        await client.query("SAVEPOINT placement");
        const placement = await placeEnrollment(client, enrollmentRow.id, sectionId, "crm");
        if (isServiceError(placement)) {
          await client.query("ROLLBACK TO SAVEPOINT placement");
          placementError = placement.error;
        } else {
          placedSectionId = sectionId;
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (placedSectionId) {
      await notificationsRepository.create(pool, {
        userId: enrollmentRow.student_id,
        type: "success",
        message: "Thanh toán của bạn đã được xác nhận và bạn đã được xếp vào lớp học."
      });
    }
    const current = (await pool.query("SELECT status FROM enrollments WHERE id = $1", [enrollmentRow.id])).rows[0];
    return {
      status: 200,
      body: { enrollmentId: enrollmentRow.id, status: current?.status, transactionId, placedSectionId, placementError }
    };
  });
}));

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
    originalPrice: body.originalPrice ?? undefined,
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
      originalPrice: existing.originalPrice,
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
    originalPrice: body.originalPrice ?? undefined,
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
  }

  res.json(course);
}));
app.post("/api/courses/:id/publish", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
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
  const result = await requestEnrollment({
    studentId: req.user!.id,
    courseId: req.body.courseId,
    sectionId: req.body.sectionId,
    origin: "lms"
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });

  invalidateStoreCache();
  await audit(req, "enroll_course", result.course.id, result.course.title);
  res.status(201).json(result.enrollment);
}));
// One-click activation from the admin orders screen: record the payment, then place the learner.
app.post("/api/enrollments/:id/activate", requireAuth, requireRole(["admin", "super_admin"]), asyncHandler(async (req, res) => {
  const enrollmentId = req.params.id;
  const chosenSectionId = typeof req.body?.sectionId === "string" && req.body.sectionId.trim() ? req.body.sectionId.trim() : undefined;
  const client = await pool.connect();
  let placement: PlacementResult;
  let studentId: string;
  let targetSectionId: string | undefined;
  try {
    await client.query("BEGIN");
    const enrollmentRow = (await client.query("SELECT student_id, requested_section_id FROM enrollments WHERE id = $1", [enrollmentId])).rows[0];
    if (!enrollmentRow) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Không tìm thấy đơn đăng ký." });
    }
    studentId = enrollmentRow.student_id;
    // Only the class the admin picked or the one the learner asked for; never guess a class.
    targetSectionId = chosenSectionId || enrollmentRow.requested_section_id || undefined;

    const payment = await confirmCoursePayment(client, enrollmentId, { reference: `admin ${req.user!.id}` }, "lms");
    if (isServiceError(payment)) {
      await client.query("ROLLBACK");
      return res.status(payment.status).json({ error: payment.error });
    }
    const result = await placeEnrollment(client, enrollmentId, targetSectionId, "lms");
    if (isServiceError(result)) {
      await client.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    placement = result;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  invalidateStoreCache();
  await notificationsRepository.create(pool, {
    userId: studentId,
    type: "success",
    message: targetSectionId
      ? "Đơn đăng ký khóa học của bạn đã được kích hoạt và xếp vào lớp. Chúc bạn học tập hiệu quả!"
      : "Đơn đăng ký khóa học của bạn đã được kích hoạt."
  });
  await audit(req, "activate_enrollment_one_click", enrollmentId, targetSectionId || "no-section");
  res.json({ success: true, enrollment: placement.enrollment, registration: placement.registration });
}));
app.patch("/api/enrollments/:id/approve", requireAuth, requireRole(["manager", "admin", "super_admin"]), validateBody(schemas.approveEnrollment), asyncHandler(async (req, res) => {
  const sectionId = req.body.sectionId;
  const client = await pool.connect();
  let placement: PlacementResult;
  try {
    await client.query("BEGIN");
    const result = await placeEnrollment(client, req.params.id, sectionId, "lms");
    if (isServiceError(result)) {
      await client.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    placement = result;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const { enrollment, registration } = placement;
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

      if (p.email) {
        const studentRow = (await client.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [p.email]
        )).rows[0];
        if (!studentRow) {
          errors.push({ index, error: `Không tìm thấy học viên với email: ${p.email}` });
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
           AND cr.status IN ('registered', 'waitlisted')`,
        [studentId, section.course_id]
      )).rows[0];

      if (!existingRegistration) {
        await client.query(
          `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
           VALUES ($1, $2, $3, 'registered', $4, $5, false)`,
          [generateId("reg"), studentId, sectionId, new Date().toISOString(), 3]
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

    for (const placed of results) {
      await enqueueEnrollmentEvent(client, "enrollment.status_changed", placed.enrollmentId);
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

  await audit(req, "request_new_section", course.id, course.title);
  res.json({ success: true, message: "Yêu cầu mở thêm lớp học phần đã được gửi tới quản trị viên." });
}));

app.post("/api/certificates/issue", requireAuth, requireRole(["admin"]), validateBody(schemas.issueCertificate), asyncHandler(async (req, res) => {
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

app.post("/api/courses/:courseId/forum", requireAuth, requireRole(["student", "teacher", "admin"]), validateBody(schemas.createForumPost), asyncHandler(async (req, res) => {
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
  } else if (role !== "admin") {
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

app.post("/api/forum/posts/:postId/replies", requireAuth, requireRole(["student", "teacher", "admin"]), validateBody(schemas.createForumReply), asyncHandler(async (req, res) => {
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
  } else if (role !== "admin") {
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

app.post("/api/admin/users", requireAuth, requireRole(["admin"]), validateBody(schemas.createUser), asyncHandler(async (req, res) => {
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

app.post("/api/admin/users/bulk", requireAuth, requireRole(["admin"]), rateLimitBulkImport, validateBody(schemas.bulkCreateUsers), asyncHandler(async (req, res) => {
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
  const { resetToken, expiresAt } = await issuePasswordResetToken(user.id, req.user!.id);
  const resetUrl = passwordResetUrl(req, resetToken);

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

app.patch("/api/admin/users/:id/role", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
  const { role } = req.body;
  const allowedRoles = ["student", "teacher", "admin"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role value." });
  }

  if (req.user!.id === req.params.id) {
    return res.status(403).json({ error: "Cannot change your own role." });
  }

  const userRes = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [req.params.id]);
  if (userRes.rows.length === 0) {
    return res.status(404).json({ error: "User not found." });
  }

  await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);

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
  // Shrinking a class deletes its trailing generated sessions (and their materials by cascade).
  const sessionsWithMaterials = await generatedSessionsWithMaterialsBeyond(pool, req.params.id, Number(payload.numberOfSessions));
  if (sessionsWithMaterials.length > 0) {
    return res.status(409).json({
      error: `Không thể giảm số buổi vì ${sessionsWithMaterials.join(", ")} đang có tài liệu. Hãy xóa hoặc chuyển tài liệu trước.`
    });
  }
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
  // Rows cascade with the section; the uploaded files must be removed from storage separately.
  const materialStoragePaths = await sessionMaterialsRepository.listStoragePathsForSection(pool, req.params.id);
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
  await materialStorage.remove(materialStoragePaths).catch(err => {
    console.error("[session-materials] failed to remove files of deleted section:", err);
  });
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
    await enqueueEnrollmentEvent(client, "enrollment.status_changed", enrollment.id);
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
    if (result.course_id) {
      const affected = (await client.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [result.student_id, result.course_id]
      )).rows;
      for (const row of affected) await enqueueEnrollmentEvent(client, "enrollment.status_changed", row.id);
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
    if (result.course_id) {
      const affected = (await client.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [result.student_id, result.course_id]
      )).rows;
      for (const row of affected) await enqueueEnrollmentEvent(client, "enrollment.status_changed", row.id);
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

const sepayWebhookHandler = asyncHandler(async (req, res) => {
  const expectedApiKey = process.env.SEPAY_API_KEY?.trim();
  if (expectedApiKey) {
    const authHeader = req.header("Authorization") || "";
    const token = authHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
    if (!token || token !== expectedApiKey) {
      return res.status(401).json({ success: false, error: "Invalid or missing SePay API key." });
    }
  }

  const rawPayload = (req as any).rawBody || JSON.stringify(req.body);
  const result = await processSepayWebhook(req.body, rawPayload, () => {
    invalidateStoreCache();
  });

  res.status(result.success ? 200 : 400).json(result);
});

app.post("/api/payments/sepay/webhook", sepayWebhookHandler);
app.post("/api/webhooks/sepay", sepayWebhookHandler);

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

type SessionOwnership = {
  id: string;
  course_id: string;
  section_id: string | null;
  course_teacher_id: string;
  section_teacher_id: string | null;
};

async function findSessionWithOwners(sessionId: string): Promise<SessionOwnership | null> {
  return (await pool.query(
    `SELECT s.id, s.course_id, s.section_id, c.teacher_id AS course_teacher_id, cs.teacher_id AS section_teacher_id
     FROM attendance_sessions s
     JOIN courses c ON c.id = s.course_id
     LEFT JOIN course_sections cs ON cs.id = s.section_id
     WHERE s.id = $1`,
    [sessionId]
  )).rows[0] || null;
}

function canManageSessionMaterials(user: User, session: SessionOwnership) {
  if (user.role === "admin") return true;
  return user.role === "teacher" && (session.section_teacher_id === user.id || session.course_teacher_id === user.id);
}

// Mirrors limitStoreForRole: a student sees a session only with an active/completed enrollment
// in the course and, for class sessions, a registered seat in that class.
async function canViewSessionMaterials(user: User, session: SessionOwnership) {
  if (canManageSessionMaterials(user, session)) return true;
  if (user.role !== "student") return false;
  const enrolled = await pool.query(
    "SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
    [user.id, session.course_id]
  );
  if (!enrolled.rowCount) return false;
  if (!session.section_id) return true;
  const registered = await pool.query(
    "SELECT 1 FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
    [user.id, session.section_id]
  );
  return Boolean(registered.rowCount);
}

function resolveMaterialUrl(type: "youtube" | "link", value: unknown): string | null {
  if (type === "youtube") {
    const videoId = extractYoutubeVideoId(String(value || ""));
    return videoId ? youtubeWatchUrl(videoId) : null;
  }
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const materialUrlError = (type: "youtube" | "link") =>
  type === "youtube" ? "Link YouTube không hợp lệ." : "Liên kết phải bắt đầu bằng http:// hoặc https://.";

async function generatedSessionsWithMaterialsBeyond(db: Queryable, sectionId: string, targetCount: number) {
  const rows = (await db.query(
    `SELECT DISTINCT s.topic
     FROM session_materials m
     JOIN attendance_sessions s ON s.id = m.session_id
     WHERE s.section_id = $1`,
    [sectionId]
  )).rows;
  return rows
    .map(row => generatedSessionOrder(row.topic))
    .filter((order): order is number => order !== null && order > targetCount)
    .sort((a, b) => a - b)
    .map(order => `Buổi ${order}`);
}

app.get("/api/sessions/:sessionId/materials", requireAuth, asyncHandler(async (req, res) => {
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Không tìm thấy buổi học." });
  if (!await canViewSessionMaterials(req.user!, session)) return res.status(403).json({ error: "Permission denied." });
  res.json(await sessionMaterialsRepository.listBySession(pool, session.id));
}));

app.post("/api/sessions/:sessionId/materials", requireAuth, requireRole(["teacher", "admin", "super_admin"]), materialUpload.single("file"), validateBody(schemas.createSessionMaterial), asyncHandler(async (req, res) => {
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Không tìm thấy buổi học." });
  if (!canManageSessionMaterials(req.user!, session)) return res.status(403).json({ error: "Permission denied for this class session." });

  const type = req.body.type as "slide" | "document" | "youtube" | "link";
  const base = {
    id: sessionMaterialsRepository.newId(),
    sessionId: session.id,
    sectionId: session.section_id,
    courseId: session.course_id,
    type,
    createdBy: req.user!.id
  };

  let material;
  if (type === "youtube" || type === "link") {
    if (req.file) return res.status(400).json({ error: "Tài liệu dạng liên kết không kèm tệp." });
    const url = resolveMaterialUrl(type, req.body.url);
    if (!url) return res.status(400).json({ error: materialUrlError(type) });
    material = await sessionMaterialsRepository.create(pool, {
      ...base,
      title: req.body.title || (type === "youtube" ? "Video bài giảng" : url),
      url
    });
  } else {
    if (!req.file) return res.status(400).json({ error: "Vui lòng chọn tệp tài liệu." });
    // multer decodes multipart filenames as latin1; restore UTF-8 so Vietnamese names survive.
    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const ext = path.extname(fileName).toLowerCase();
    if (!MATERIAL_FILE_EXTENSIONS[type].has(ext)) {
      return res.status(400).json({
        error: type === "slide" ? "Slide phải là tệp .ppt, .pptx hoặc .pdf." : "Tài liệu phải là tệp .doc, .docx hoặc .pdf."
      });
    }
    const storagePath = `${session.course_id}/${session.section_id || "course"}/${session.id}/${base.id}${ext}`;
    await materialStorage.put(storagePath, req.file.buffer, MATERIAL_MIME_BY_EXT[ext]);
    try {
      material = await sessionMaterialsRepository.create(pool, {
        ...base,
        title: req.body.title || path.basename(fileName, path.extname(fileName)),
        storagePath,
        fileName,
        mimeType: MATERIAL_MIME_BY_EXT[ext],
        sizeBytes: req.file.size
      });
    } catch (error) {
      await materialStorage.remove([storagePath]).catch(() => undefined);
      throw error;
    }
  }

  invalidateStoreCache();
  await audit(req, "create_session_material", material.id, `${type}: ${material.title}`);
  res.status(201).json(material);
}));

app.put("/api/sessions/:sessionId/materials/order", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.reorderSessionMaterials), asyncHandler(async (req, res) => {
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Không tìm thấy buổi học." });
  if (!canManageSessionMaterials(req.user!, session)) return res.status(403).json({ error: "Permission denied for this class session." });
  const materials = await sessionMaterialsRepository.reorder(pool, session.id, req.body.materialIds);
  invalidateStoreCache();
  res.json(materials);
}));

app.patch("/api/materials/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), validateBody(schemas.updateSessionMaterial), asyncHandler(async (req, res) => {
  const row = await sessionMaterialsRepository.findRowById(pool, req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài liệu." });
  const session = await findSessionWithOwners(row.session_id);
  if (!session || !canManageSessionMaterials(req.user!, session)) return res.status(403).json({ error: "Permission denied for this class session." });

  let url: string | undefined;
  if (req.body.url !== undefined) {
    if (row.type !== "youtube" && row.type !== "link") return res.status(400).json({ error: "Chỉ tài liệu dạng liên kết mới đổi được URL." });
    url = resolveMaterialUrl(row.type, req.body.url) || undefined;
    if (!url) return res.status(400).json({ error: materialUrlError(row.type) });
  }
  const material = await sessionMaterialsRepository.update(pool, row.id, { title: req.body.title, url });
  invalidateStoreCache();
  await audit(req, "update_session_material", row.id, material?.title || row.title);
  res.json(material);
}));

app.delete("/api/materials/:id", requireAuth, requireRole(["teacher", "admin", "super_admin"]), asyncHandler(async (req, res) => {
  const row = await sessionMaterialsRepository.findRowById(pool, req.params.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy tài liệu." });
  const session = await findSessionWithOwners(row.session_id);
  if (!session || !canManageSessionMaterials(req.user!, session)) return res.status(403).json({ error: "Permission denied for this class session." });

  await sessionMaterialsRepository.remove(pool, row.id);
  if (row.storage_path) {
    await materialStorage.remove([row.storage_path]).catch(err => {
      console.error("[session-materials] failed to remove file:", row.storage_path, err);
    });
  }
  invalidateStoreCache();
  await audit(req, "delete_session_material", row.id, row.title);
  res.status(204).send();
}));

app.get("/api/materials/:id/download", requireAuth, asyncHandler(async (req, res) => {
  const row = await sessionMaterialsRepository.findRowById(pool, req.params.id);
  if (!row || !row.storage_path) return res.status(404).json({ error: "Không tìm thấy tệp tài liệu." });
  const session = await findSessionWithOwners(row.session_id);
  if (!session || !await canViewSessionMaterials(req.user!, session)) return res.status(403).json({ error: "Permission denied." });

  const isPdf = row.mime_type === "application/pdf" || (row.file_name && row.file_name.toLowerCase().endsWith(".pdf"));
  const wantsInline = req.query.inline === "true" && isPdf;

  const download = await materialStorage.getDownload(
    row.storage_path, 
    row.file_name || path.basename(row.storage_path),
    { inline: wantsInline }
  );
  if (download.kind === "redirect") return res.redirect(302, download.url);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (wantsInline) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(row.file_name || "document.pdf")}"`);
    return res.sendFile(download.absolutePath);
  }
  res.download(download.absolutePath, row.file_name || path.basename(row.storage_path));
}));

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
  const { courseId, sectionId, topic } = req.body;
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
      `INSERT INTO attendance_sessions (id, course_id, teacher_id, session_date, date, topic, code, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [session.id, session.courseId, session.teacherId, sessionDateOnly, session.date, session.topic, session.code, session.expiresAt]
    );
  } else {
    await pool.query(
      `INSERT INTO attendance_sessions (id, course_id, teacher_id, date, topic, code, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [session.id, session.courseId, session.teacherId, session.date, session.topic, session.code, session.expiresAt]
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

let initDbPromise: Promise<void> | null = null;
export async function ensureDatabaseReady() {
  if (!initDbPromise) {
    initDbPromise = initializeDatabase();
  }
  return initDbPromise;
}

// Express error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Dung lượng tệp phải nhỏ hơn 10 GB." });
    return;
  }
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error." : err.message || "Internal server error." });
});

async function setupServer() {
  await ensureDatabaseReady();
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  const HOST = process.env.HOST || "0.0.0.0";
  const server = app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
  server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 0);
}

if (!process.env.VERCEL) {
  setupServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;
