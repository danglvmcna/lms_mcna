import crypto from "crypto";
import { pool, Queryable } from "../db";
import { notificationsRepository } from "../repositories/notifications";
import { confirmCoursePayment, placeEnrollment, isServiceError } from "./enrollmentService";

export interface SepayWebhookPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content: string;
  transferType: "in" | "out" | string;
  transferAmount: number;
  accumulated?: number;
  referenceCode?: string;
  description?: string;
}

export interface ExtractedPaymentInfo {
  txIdFull?: string;
  txHex?: string;
  studentHex?: string;
  phone?: string;
  email?: string;
  rawKeywords: string[];
}

export interface MatchedTransaction {
  id: string;
  student_id: string;
  course_id: string;
  amount: number;
  status: string;
  enrollment_id: string;
  requested_section_id: string | null;
  enrollment_status: string;
  course_title: string;
}

export interface SepayProcessResult {
  success: boolean;
  matched: boolean;
  duplicate?: boolean;
  underpaid?: boolean;
  message: string;
  transactionId?: string;
  enrollmentId?: string;
  placedSectionId?: string | null;
  placementError?: string | null;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Extracts student hex code, transaction hex code, or direct IDs from transfer memo.
 * Expected formats:
 * - "MCNA [studentHex6] [txHex6]" (standard QR memo, e.g. "MCNA E2F4A1 98A7B6")
 * - "MCNA [txHex6]" or "MCNA tx_..."
 * - "MCNA[studentHex6][txHex6]" (compact format)
 * - "tx_[hex]" anywhere in the message
 * - Fallback: phone number or email of student
 */
export function extractPaymentCodes(content?: string, codeField?: string | null): ExtractedPaymentInfo {
  const text = `${codeField || ""} ${content || ""}`.trim();
  const result: ExtractedPaymentInfo = { rawKeywords: [] };
  if (!text) return result;

  // 1. Direct tx ID e.g. tx_1a2b3c4d5e6f
  const directTxMatch = text.match(/\b(tx_[a-f0-9]{6,16})\b/i);
  if (directTxMatch) {
    result.txIdFull = directTxMatch[1].toLowerCase();
    result.rawKeywords.push(result.txIdFull);
  }

  // 2. Standard MCNA memo with two hex words: "MCNA [studentSub] [txSub]"
  const mcnaTwoWordMatch = text.match(/MCNA\s*[:.\-_]?\s*([A-Za-z0-9]{4,12})\s+([A-Za-z0-9]{4,12})/i);
  if (mcnaTwoWordMatch) {
    result.studentHex = mcnaTwoWordMatch[1].toLowerCase();
    result.txHex = mcnaTwoWordMatch[2].toLowerCase();
    result.rawKeywords.push(result.studentHex, result.txHex);
    return result;
  }

  // 3. Compact 12-char hex after MCNA: "MCNA1A2B3C4D5E6F"
  const mcnaCompactMatch = text.match(/MCNA\s*[:.\-_]?\s*([A-Fa-f0-9]{12})\b/i);
  if (mcnaCompactMatch) {
    result.studentHex = mcnaCompactMatch[1].slice(0, 6).toLowerCase();
    result.txHex = mcnaCompactMatch[1].slice(6, 12).toLowerCase();
    result.rawKeywords.push(result.studentHex, result.txHex);
    return result;
  }

  // 4. Single code after MCNA: "MCNA [code]"
  const mcnaSingleMatch = text.match(/MCNA\s*[:.\-_]?\s*([A-Za-z0-9_]{5,24})\b/i);
  if (mcnaSingleMatch) {
    const code = mcnaSingleMatch[1].toLowerCase();
    if (code.startsWith("tx_")) {
      result.txIdFull = code;
    } else if (/^[0-9]{9,11}$/.test(code)) {
      result.phone = code;
    } else if (code.includes("@")) {
      result.email = code;
    } else {
      result.txHex = code;
    }
    result.rawKeywords.push(code);
  }

  // 5. Standalone phone number
  const phoneMatch = text.match(/\b(0[35789][0-9]{8})\b/);
  if (phoneMatch && !result.phone) {
    result.phone = phoneMatch[1];
  }

  // 6. Standalone email
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch && !result.email) {
    result.email = emailMatch[1].toLowerCase();
  }

  return result;
}

/**
 * Searches for a pending transaction matching the extracted codes.
 */
export async function findMatchingPendingTransaction(
  db: Queryable,
  info: ExtractedPaymentInfo
): Promise<MatchedTransaction | null> {
  // 1. Direct transaction ID match
  if (info.txIdFull) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending' AND t.id ILIKE $1
       LIMIT 1`,
      [info.txIdFull]
    )).rows[0];
    if (row) return row;
  }

  // 2. Both studentHex and txHex extracted from "MCNA [student] [tx]"
  if (info.studentHex && info.txHex) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending'
         AND (
           (t.id ILIKE 'tx_' || $1 || '%' AND t.student_id ILIKE 'user_' || $2 || '%')
           OR (t.id ILIKE 'tx_' || $2 || '%' AND t.student_id ILIKE 'user_' || $1 || '%')
           OR (t.id ILIKE 'tx_' || $1 || '%')
           OR (t.id ILIKE 'tx_' || $2 || '%')
         )
       ORDER BY
         (t.id ILIKE 'tx_' || $1 || '%' AND t.student_id ILIKE 'user_' || $2 || '%') DESC,
         (t.id ILIKE 'tx_' || $2 || '%' AND t.student_id ILIKE 'user_' || $1 || '%') DESC,
         t.created_at DESC
       LIMIT 1`,
      [info.txHex, info.studentHex]
    )).rows[0];
    if (row) return row;
  }

  // 3. Single txHex extracted
  if (info.txHex) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending'
         AND (t.id ILIKE 'tx_' || $1 || '%' OR t.id ILIKE $1)
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [info.txHex]
    )).rows[0];
    if (row) return row;
  }

  // 4. Fallback search by student phone or email
  if (info.phone || info.email) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN users u ON u.id = t.student_id
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending'
         AND (
           ($1 <> '' AND u.phone = $1)
           OR ($2 <> '' AND u.email ILIKE $2)
         )
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [info.phone || "", info.email || ""]
    )).rows[0];
    if (row) return row;
  }

  return null;
}

/**
 * Main processor for incoming SePay webhook events.
 */
export async function processSepayWebhook(
  payload: SepayWebhookPayload,
  rawBody: string,
  onSuccessfulPayment?: () => void
): Promise<SepayProcessResult> {
  // 1. Ignore non-incoming money transfers
  if (payload.transferType && String(payload.transferType).toLowerCase() !== "in") {
    return {
      success: true,
      matched: false,
      message: "Bỏ qua giao dịch tiền ra khỏi tài khoản."
    };
  }

  // 2. Idempotency check with payment_webhook_events
  const eventId = `sepay_${payload.id}`;
  const existingEvent = (await pool.query(
    "SELECT event_id, transaction_id, processing_status FROM payment_webhook_events WHERE event_id = $1",
    [eventId]
  )).rows[0];

  if (existingEvent && existingEvent.processing_status === "processed") {
    return {
      success: true,
      matched: true,
      duplicate: true,
      transactionId: existingEvent.transaction_id,
      message: "Giao dịch SePay này đã được hệ thống xử lý thành công trước đó."
    };
  }

  // 3. Extract codes from transfer content
  const info = extractPaymentCodes(payload.content, payload.code);
  const matchedTx = await findMatchingPendingTransaction(pool, info);

  if (!matchedTx) {
    return {
      success: true,
      matched: false,
      message: "Không tìm thấy đơn hàng học phí pending phù hợp với nội dung chuyển khoản."
    };
  }

  const receivedAmount = Number(payload.transferAmount || 0);
  const requiredAmount = Number(matchedTx.amount || 0);

  // 4. Underpayment check
  if (receivedAmount < requiredAmount) {
    const diff = requiredAmount - receivedAmount;
    await pool.query(
      `UPDATE transactions
       SET notes = $2
       WHERE id = $1`,
      [
        matchedTx.id,
        `SePay: Nhận ${receivedAmount.toLocaleString("vi-VN")} đ (thiếu ${diff.toLocaleString("vi-VN")} đ so với học phí ${requiredAmount.toLocaleString("vi-VN")} đ). GD #${payload.id}.`
      ]
    );

    await notificationsRepository.create(pool, {
      userId: matchedTx.student_id,
      type: "warning",
      message: `MCNA đã nhận ${receivedAmount.toLocaleString("vi-VN")} đ học phí môn ${matchedTx.course_title}, nhưng số tiền quy định là ${requiredAmount.toLocaleString("vi-VN")} đ (còn thiếu ${diff.toLocaleString("vi-VN")} đ). Vui lòng chuyển bổ sung để hoàn tất kích hoạt lớp học.`
    });

    return {
      success: true,
      matched: true,
      underpaid: true,
      transactionId: matchedTx.id,
      message: `Giao dịch chuyển thiếu tiền (${receivedAmount.toLocaleString("vi-VN")} đ / ${requiredAmount.toLocaleString("vi-VN")} đ). Đã lưu ghi chú.`
    };
  }

  // 5. Full payment execution inside DB transaction
  const client = await pool.connect();
  let placedSectionId: string | null = null;
  let placementError: string | null = null;
  const payloadSha256 = sha256Hex(rawBody || JSON.stringify(payload));

  try {
    await client.query("BEGIN");

    // Approve payment via shared enrollmentService
    const payment = await confirmCoursePayment(
      client,
      matchedTx.enrollment_id,
      {
        amount: receivedAmount,
        reference: `SePay #${payload.id} (${payload.gateway || "MBBank"}${payload.referenceCode ? ` - ${payload.referenceCode}` : ""})`,
        paidAt: payload.transactionDate || new Date().toISOString()
      },
      "lms"
    );

    if (isServiceError(payment)) {
      await client.query("ROLLBACK");
      return {
        success: false,
        matched: true,
        message: payment.error,
        transactionId: matchedTx.id
      };
    }

    // Auto-place into requested section if student selected one during registration
    const sectionId = matchedTx.requested_section_id;
    if (sectionId && matchedTx.enrollment_status !== "active" && matchedTx.enrollment_status !== "completed") {
      await client.query("SAVEPOINT sepay_placement");
      const placement = await placeEnrollment(client, matchedTx.enrollment_id, sectionId, "lms");
      if (isServiceError(placement)) {
        await client.query("ROLLBACK TO SAVEPOINT sepay_placement");
        placementError = placement.error;
      } else {
        placedSectionId = sectionId;
      }
    }

    // Record webhook event for audit & idempotency
    await client.query(
      `INSERT INTO payment_webhook_events (
         event_id, transaction_id, status, event_timestamp, payload_sha256, processing_status, processed_at
       ) VALUES ($1, $2, 'approved', CURRENT_TIMESTAMP, $3, 'processed', CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO UPDATE
         SET processing_status = 'processed',
             processed_at = CURRENT_TIMESTAMP,
             transaction_id = $2`,
      [eventId, matchedTx.id, payloadSha256]
    );

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Trigger cache invalidation callback
  onSuccessfulPayment?.();

  // Send notifications to the learner
  if (placedSectionId) {
    await notificationsRepository.create(pool, {
      userId: matchedTx.student_id,
      type: "success",
      message: `Thanh toán học phí khóa học "${matchedTx.course_title}" đã được xác nhận tự động qua SePay! Bạn đã được xếp vào lớp học và có thể bắt đầu học tập ngay.`
    });
  } else {
    await notificationsRepository.create(pool, {
      userId: matchedTx.student_id,
      type: "success",
      message: `Thanh toán học phí khóa học "${matchedTx.course_title}" đã được xác nhận tự động qua SePay! Bạn vui lòng chờ quản trị viên xếp lớp học phần.`
    });
  }

  return {
    success: true,
    matched: true,
    transactionId: matchedTx.id,
    enrollmentId: matchedTx.enrollment_id,
    placedSectionId,
    placementError,
    message: "Xác nhận thanh toán tự động qua SePay thành công."
  };
}
