import crypto from "crypto";
import { pool, Queryable } from "../db";
import { notificationsRepository } from "../repositories/notifications";
import { notifyRole } from "../notify";
import { generateId } from "../ids";
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
  if (!payload || !String(payload.id ?? "").trim() || !Number.isSafeInteger(Number(payload.transferAmount)) || Number(payload.transferAmount) <= 0) {
    return { success: false, matched: false, message: "Dữ liệu giao dịch SePay không hợp lệ." };
  }
  // 1. Ignore non-incoming money transfers
  if (String(payload.transferType || "").toLowerCase() !== "in") {
    return {
      success: true,
      matched: false,
      message: "Bỏ qua giao dịch tiền ra khỏi tài khoản."
    };
  }

  // 2. Idempotency check with payment_webhook_events
  const eventId = `sepay_${payload.id}`;
  const existingEvent = (await pool.query(
    "SELECT event_id, transaction_id, status, error, processing_status FROM payment_webhook_events WHERE event_id = $1",
    [eventId]
  )).rows[0];

  if (existingEvent && existingEvent.processing_status === "processed") {
    return {
      success: true,
      matched: true,
      duplicate: true,
      underpaid: existingEvent.error === "amount_mismatch",
      transactionId: existingEvent.transaction_id,
      message: existingEvent.error === "amount_mismatch"
        ? "Khoản chuyển thiếu đã được ghi nhận để MCNA đối soát thủ công."
        : "Giao dịch SePay này đã được hệ thống xử lý thành công trước đó."
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

  const receivedAmount = Number(payload.transferAmount);
  const requiredAmount = Number(matchedTx.amount || 0);
  const payloadSha256 = sha256Hex(rawBody || JSON.stringify(payload));

  // 4. Underpayment check
  if (receivedAmount < requiredAmount) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const recorded = await client.query(
        `INSERT INTO payment_webhook_events
           (event_id, transaction_id, status, event_timestamp, payload_sha256, processing_status, processed_at, error)
         VALUES ($1, $2, 'rejected', CURRENT_TIMESTAMP, $3, 'processed', CURRENT_TIMESTAMP, 'amount_mismatch')
         ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [eventId, matchedTx.id, payloadSha256]
      );
      if (!recorded.rowCount) {
        const previous = (await client.query(
          "SELECT transaction_id, error FROM payment_webhook_events WHERE event_id = $1",
          [eventId]
        )).rows[0];
        await client.query("ROLLBACK");
        return { success: true, matched: true, duplicate: true, underpaid: previous?.error === "amount_mismatch", transactionId: previous?.transaction_id || matchedTx.id,
          message: "Giao dịch SePay này đã được ghi nhận trước đó." };
      }
      await client.query(
        `UPDATE transactions SET notes = CONCAT_WS(E'\n', NULLIF(notes, ''), $2) WHERE id = $1`,
        [matchedTx.id, `SePay #${payload.id}: nhận ${receivedAmount.toLocaleString("vi-VN")} đ / học phí ${requiredAmount.toLocaleString("vi-VN")} đ; chờ đối soát thủ công, không tự kích hoạt.`]
      );
      const adminIds = (await client.query("SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = true")).rows.map(row => String(row.id));
      const recipients = [...new Set([matchedTx.student_id, ...adminIds])];
      for (const userId of recipients) {
        const isStudent = userId === matchedTx.student_id;
        await client.query(
          `INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
           VALUES ($1, $2, 'warning', $3, false, CURRENT_TIMESTAMP)`,
          [generateId("noti"), userId, isStudent
            ? `MCNA đã nhận khoản chuyển ${receivedAmount.toLocaleString("vi-VN")} đ cho khóa "${matchedTx.course_title}" nhưng chưa đủ học phí. Đơn chưa được kích hoạt. Vui lòng liên hệ MCNA để đối soát hoặc hoàn tiền; không tự chuyển thêm theo đơn này.`
            : `Cần đối soát thủ công: SePay #${payload.id}, đơn ${matchedTx.id} nhận ${receivedAmount.toLocaleString("vi-VN")} đ / ${requiredAmount.toLocaleString("vi-VN")} đ. Đơn vẫn đang chờ; liên hệ học viên để xử lý.`]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    onSuccessfulPayment?.();

    return {
      success: true,
      matched: true,
      underpaid: true,
      transactionId: matchedTx.id,
      message: `Khoản chuyển thiếu (${receivedAmount.toLocaleString("vi-VN")} đ / ${requiredAmount.toLocaleString("vi-VN")} đ) đã chuyển sang đối soát thủ công; đơn chưa kích hoạt.`
    };
  }

  // 5. Full payment execution inside DB transaction
  const client = await pool.connect();
  let placedSectionId: string | null = null;
  let placementError: string | null = null;

  try {
    await client.query("BEGIN");
    const recorded = await client.query(
      `INSERT INTO payment_webhook_events
         (event_id, transaction_id, status, event_timestamp, payload_sha256, processing_status)
       VALUES ($1, $2, 'approved', CURRENT_TIMESTAMP, $3, 'processing')
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [eventId, matchedTx.id, payloadSha256]
    );
    if (!recorded.rowCount) {
      const previous = (await client.query(
        "SELECT transaction_id, error, processing_status FROM payment_webhook_events WHERE event_id = $1",
        [eventId]
      )).rows[0];
      await client.query("ROLLBACK");
      return {
        success: true, matched: true, duplicate: true,
        underpaid: previous?.error === "amount_mismatch",
        transactionId: previous?.transaction_id || matchedTx.id,
        message: "Giao dịch SePay này đã được ghi nhận trước đó."
      };
    }

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

    // Complete the idempotent event in the same transaction as payment approval.
    await client.query(
      "UPDATE payment_webhook_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = $1",
      [eventId]
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

  void notifyRole(pool, "admin", `SePay: Đã nhận thanh toán ${receivedAmount.toLocaleString("vi-VN")}đ cho khóa học "${matchedTx.course_title}".`, {
    type: "success",
    relatedEntityType: "transaction",
    relatedEntityId: matchedTx.id
  }).catch(err => console.error("[notify] failed to notify admin on sepay payment:", err));

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
