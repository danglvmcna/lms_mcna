import { Queryable } from "../db";

export const financeRepository = {
  async reviewTransaction(db: Queryable, txId: string, status: "approved" | "rejected", reviewerId: string | null, notes?: string) {
    const tx = (await db.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [txId])).rows[0];
    if (!tx) return null;
    if (tx.status !== "pending") return { error: "Transaction already reviewed.", status: 409 };

    const processedAt = new Date().toISOString();
    const reviewNote = notes || (status === "approved" ? "Payment confirmed and learning flow updated." : "Payment rejected by payment operator.");
    const row = (await db.query(
      `UPDATE transactions
       SET status = $2, processed_at = $3, processed_by = $4, notes = $5
       WHERE id = $1
       RETURNING *`,
      [txId, status, processedAt, reviewerId, reviewNote]
    )).rows[0];

    if (tx.course_id) {
      // A confirmed payment moves the learner on to class placement; a rejection leaves them waiting to pay.
      await db.query(
        `UPDATE enrollments
         SET status = $3
         WHERE student_id = $1 AND course_id = $2 AND status = 'pending_payment'`,
        [tx.student_id, tx.course_id, status === "approved" ? "pending" : "pending_payment"]
      );
    }

    return row;
  }
};
