import { Queryable } from "../db";

export const financeRepository = {
  async payTuition(db: Queryable, feeId: string, paidAmount: number, ownerStudentId?: string) {
    const fee = (await db.query("SELECT * FROM tuition_fees WHERE id = $1 FOR UPDATE", [feeId])).rows[0];
    if (!fee) return null;
    if (ownerStudentId && fee.student_id !== ownerStudentId) return null;
    if (paidAmount <= 0) return null;
    const currentPaid = Number(fee.paid_amount || 0);
    const totalPaid = currentPaid + paidAmount;
    const status = totalPaid >= Number(fee.amount) ? "paid" : "partial";
    await db.query("UPDATE tuition_fees SET paid_amount = $1, status = $2 WHERE id = $3", [totalPaid, status, feeId]);
    return { id: feeId, paidAmount: totalPaid, status };
  },

  async reviewTransaction(db: Queryable, txId: string, status: "approved" | "rejected", reviewerId: string | null, notes?: string) {
    const tx = (await db.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [txId])).rows[0];
    if (!tx) return null;
    if (tx.status !== "pending") return { error: "Transaction already reviewed.", status: 409 };

    const processedAt = new Date().toISOString();
    const isTuitionPayment = typeof tx.notes === "string" && tx.notes.startsWith("tuition_fee_pay:");
    const tuitionFeeId = isTuitionPayment ? tx.notes.split("|")[0].replace("tuition_fee_pay:", "").trim() : null;
    const reviewNote = notes || (status === "approved" ? "Payment confirmed and learning flow updated." : "Payment rejected by payment operator.");
    const finalNotes = isTuitionPayment ? `${tx.notes} | ${reviewNote}` : reviewNote;
    const row = (await db.query(
      `UPDATE transactions
       SET status = $2, processed_at = $3, processed_by = $4, notes = $5
       WHERE id = $1
       RETURNING *`,
      [txId, status, processedAt, reviewerId, finalNotes]
    )).rows[0];

    if (status === "approved") {
      // Only activate enrollment for course-registration transactions (not semester tuition payments)
      if (!isTuitionPayment && tx.course_id) {
        await db.query(
          `UPDATE enrollments
           SET status = 'pending'
           WHERE student_id = $1 AND course_id = $2 AND status = 'pending_payment'`,
          [tx.student_id, tx.course_id]
        );
      }
      if (tuitionFeeId) {
        const paid = await this.payTuition(db, tuitionFeeId, Number(tx.amount));
        if (!paid) return { error: "Tuition fee not found or invalid.", status: 404 };
      }
    } else {
      if (!isTuitionPayment && tx.course_id) {
        await db.query(
          `UPDATE enrollments
           SET status = 'pending_payment'
           WHERE student_id = $1 AND course_id = $2 AND status = 'pending_payment'`,
          [tx.student_id, tx.course_id]
        );
      }
    }

    return row;
  }
};
