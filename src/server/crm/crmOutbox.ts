import { pool, Queryable } from "../db";
import { generateId } from "../ids";
import { signCrmPayload } from "./signature";

// LMS -> CRM sync uses a transactional outbox: business code inserts an event row in the same transaction
// as its own writes, and a scheduler job delivers pending rows to CRM_WEBHOOK_URL with an HMAC signature,
// retrying with backoff. Contract: docs/crm-integration.md.

export type CrmEventType =
  | "contact.registered"
  | "enrollment.requested"
  | "enrollment.status_changed"
  | "attendance.risk_detected"
  | "attendance.recovered"
  | "course.completed"
  | "certificate.issued";
export type CrmOrigin = "lms" | "crm";

const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 20;
const DELIVERY_TIMEOUT_MS = 10_000;

export async function enqueueCrmEvent(db: Queryable, type: CrmEventType, data: Record<string, unknown>, origin: CrmOrigin = "lms") {
  const id = generateId("crmevt");
  const payload = { id, type, origin, occurredAt: new Date().toISOString(), data };
  // clock_timestamp(), not the column default: events queued in one transaction (payment confirmed, then placed)
  // would otherwise share the transaction start time and could reach the CRM out of order.
  await db.query(
    "INSERT INTO crm_outbox (id, event_type, payload, created_at) VALUES ($1, $2, $3, clock_timestamp())",
    [id, type, JSON.stringify(payload)]
  );
  return id;
}

/** Snapshot of an enrollment as the CRM sees it: learner, course, requested/placed class and latest payment. */
export async function buildEnrollmentEventData(db: Queryable, enrollmentId: string) {
  const row = (await db.query(
    `SELECT e.id, e.status, e.enrolled_at, e.crm_deal_id, e.requested_section_id,
            u.id AS student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone, u.crm_contact_id,
            c.id AS course_id, c.title AS course_title, COALESCE(c.price, 0) AS course_price,
            rs.section_code AS requested_section_code,
            placed.section_id AS placed_section_id, ps.section_code AS placed_section_code
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_sections rs ON rs.id = e.requested_section_id
     LEFT JOIN LATERAL (
       SELECT cr.section_id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = e.student_id AND cs.course_id = e.course_id AND cr.status = 'registered'
       ORDER BY cr.registered_at DESC
       LIMIT 1
     ) placed ON true
     LEFT JOIN course_sections ps ON ps.id = placed.section_id
     WHERE e.id = $1`,
    [enrollmentId]
  )).rows[0];
  if (!row) return null;

  const payment = (await db.query(
    `SELECT id, amount, status
     FROM transactions
     WHERE student_id = $1 AND course_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [row.student_id, row.course_id]
  )).rows[0];

  return {
    enrollmentId: row.id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    crmDealId: row.crm_deal_id || null,
    student: {
      lmsUserId: row.student_id,
      name: row.student_name,
      email: row.student_email,
      phone: row.student_phone || null,
      crmContactId: row.crm_contact_id || null
    },
    course: { id: row.course_id, title: row.course_title, price: Number(row.course_price) },
    requestedSection: row.requested_section_id ? { id: row.requested_section_id, code: row.requested_section_code } : null,
    placedSection: row.placed_section_id ? { id: row.placed_section_id, code: row.placed_section_code } : null,
    payment: payment ? { transactionId: payment.id, amount: Number(payment.amount), status: payment.status } : null
  };
}

export async function enqueueEnrollmentEvent(
  db: Queryable,
  type: "enrollment.requested" | "enrollment.status_changed",
  enrollmentId: string,
  origin: CrmOrigin = "lms"
) {
  const data = await buildEnrollmentEventData(db, enrollmentId);
  if (data) await enqueueCrmEvent(db, type, data, origin);
}

/** Build a privacy-conscious certificate event for CRM lifecycle automations. */
export async function enqueueCertificateIssuedEvent(db: Queryable, certificateId: string, origin: CrmOrigin = "lms") {
  const row = (await db.query(
    `SELECT cert.id, cert.certificate_code, cert.issued_at,
            u.id AS student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone,
            u.crm_contact_id, c.id AS course_id, c.title AS course_title
     FROM certificates cert
     JOIN users u ON u.id = cert.student_id
     JOIN courses c ON c.id = cert.course_id
     WHERE cert.id = $1`,
    [certificateId]
  )).rows[0];
  if (!row) return null;
  return enqueueCrmEvent(db, "certificate.issued", {
    certificateId: row.id,
    certificateCode: row.certificate_code,
    issuedAt: row.issued_at,
    student: {
      lmsUserId: row.student_id,
      name: row.student_name,
      email: row.student_email,
      phone: row.student_phone || null,
      crmContactId: row.crm_contact_id || null
    },
    course: { id: row.course_id, title: row.course_title }
  }, origin);
}

export async function enqueueCourseCompletedEvent(
  db: Queryable,
  enrollmentId: string,
  origin: CrmOrigin = "lms"
) {
  const data = await buildEnrollmentEventData(db, enrollmentId);
  if (!data) return null;
  return enqueueCrmEvent(db, "course.completed", {
    ...data,
    completedAt: new Date().toISOString()
  }, origin);
}

// 1 min, 2 min, 4 min ... capped at 6 hours.
const retryDelaySeconds = (attempt: number) => Math.min(60 * 2 ** (attempt - 1), 6 * 60 * 60);

let delivering = false;

/** Sends due outbox events to the CRM. No-op until CRM_WEBHOOK_URL and CRM_WEBHOOK_SECRET are configured. */
export async function deliverPendingCrmEvents(): Promise<{ sent: number; failed: number }> {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!url || !secret || delivering) return { sent: 0, failed: 0 };

  delivering = true;
  let sent = 0;
  let failed = 0;
  try {
    // Lease the batch first so no HTTP call runs inside an open transaction and parallel workers skip it.
    // Sorted in SQL: JS dates drop the microseconds that separate events queued in the same transaction.
    const rows = (await pool.query(
      `WITH leased AS (
         UPDATE crm_outbox
         SET next_attempt_at = NOW() + INTERVAL '5 minutes'
         WHERE id IN (
           SELECT id FROM crm_outbox
           WHERE status = 'pending' AND next_attempt_at <= NOW()
           ORDER BY created_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *
       )
       SELECT * FROM leased ORDER BY created_at, id`,
      [BATCH_SIZE]
    )).rows;

    for (const row of rows) {
      const body = JSON.stringify(row.payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-LMS-Event": row.event_type,
            "X-LMS-Event-Id": row.id,
            "X-LMS-Timestamp": timestamp,
            "X-LMS-Signature": `sha256=${signCrmPayload(secret, timestamp, body)}`
          },
          body,
          signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
        });
        if (!response.ok) throw new Error(`CRM responded with HTTP ${response.status}`);
        await pool.query(
          "UPDATE crm_outbox SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), last_error = NULL WHERE id = $1",
          [row.id]
        );
        sent++;
      } catch (error: any) {
        const attempts = Number(row.attempts) + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        await pool.query(
          `UPDATE crm_outbox
           SET attempts = $2, status = $3, last_error = $4, next_attempt_at = NOW() + ($5::text || ' seconds')::interval
           WHERE id = $1`,
          [row.id, attempts, giveUp ? "failed" : "pending", String(error?.message || error).slice(0, 1000), String(retryDelaySeconds(attempts))]
        );
        if (giveUp) console.error(`[crm-outbox] giving up on ${row.event_type} ${row.id} after ${attempts} attempts:`, error);
        failed++;
      }
    }
  } finally {
    delivering = false;
  }
  return { sent, failed };
}
