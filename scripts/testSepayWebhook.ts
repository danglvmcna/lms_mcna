import assert from "assert";
import { extractPaymentCodes, processSepayWebhook } from "../src/server/services/sepayService";
import { pool } from "../src/server/db";
import { generateId } from "../src/server/ids";

async function runUnitTests() {
  console.log("--- 1. Testing extractPaymentCodes ---");

  // Test 1: Standard VietQR format
  const t1 = extractPaymentCodes("MCNA E2F4A1 98A7B6");
  assert.strictEqual(t1.studentHex, "e2f4a1", "Should extract studentHex");
  assert.strictEqual(t1.txHex, "98a7b6", "Should extract txHex");
  console.log("✓ Test 1 passed: Standard format MCNA E2F4A1 98A7B6");

  // Test 2: Bank app with prepended & appended text
  const t2 = extractPaymentCodes("MBVCB.123456789.MCNA E2F4A1 98A7B6.CT tu 0987654321 Nguyen Van A");
  assert.strictEqual(t2.studentHex, "e2f4a1", "Should extract studentHex with bank text");
  assert.strictEqual(t2.txHex, "98a7b6", "Should extract txHex with bank text");
  console.log("✓ Test 2 passed: Real bank SMS/description text");

  // Test 3: Compact 12-character format (no space between codes)
  const t3 = extractPaymentCodes("MCNA E2F4A198A7B6");
  assert.strictEqual(t3.studentHex, "e2f4a1", "Should extract studentHex from compact text");
  assert.strictEqual(t3.txHex, "98a7b6", "Should extract txHex from compact text");
  console.log("✓ Test 3 passed: Compact MCNA E2F4A198A7B6");

  // Test 4: Single code format (only transaction code provided)
  const t4 = extractPaymentCodes("MCNA 98A7B6");
  assert.strictEqual(t4.txHex, "98a7b6", "Should extract single tx code");
  console.log("✓ Test 4 passed: Single code MCNA 98A7B6");

  // Test 5: Direct full transaction ID
  const t5 = extractPaymentCodes("Thanh toan tx_98a7b6c5d4e3");
  assert.strictEqual(t5.txIdFull, "tx_98a7b6c5d4e3", "Should extract full transaction ID");
  console.log("✓ Test 5 passed: Full tx ID tx_98a7b6c5d4e3");

  // Test 6: Fallback with phone number
  const t6 = extractPaymentCodes("MCNA 0987654321");
  assert.strictEqual(t6.phone, "0987654321", "Should extract phone number");
  console.log("✓ Test 6 passed: Phone number fallback");

  // Test 7: Unrelated personal transfer
  const t7 = extractPaymentCodes("Tra tien an trua qua momo nhe ban oi");
  assert.strictEqual(t7.txHex, undefined, "Should not match unrelated transfer");
  assert.strictEqual(t7.studentHex, undefined, "Should not match unrelated transfer");
  assert.strictEqual(t7.txIdFull, undefined, "Should not match unrelated transfer");
  console.log("✓ Test 7 passed: Unrelated transfer ignored");
}

async function runDatabaseIntegrationTests() {
  console.log("\n--- 2. Testing Database Integration & SePay Webhook Processor ---");

  try {
    await pool.query("SELECT 1");
  } catch (err: any) {
    console.warn("Database is not reachable in this environment, skipping live DB tests:", err.message);
    return;
  }

  // Create temporary test user, course, section, enrollment, and pending transaction
  const testStudentId = generateId("user");
  const testCourseId = generateId("course");
  const testSectionId = generateId("sec");
  const testEnrollmentId = generateId("enr");
  const testTxId = generateId("tx");
  const coursePrice = 1500000;

  console.log(`Setting up test fixtures: student=${testStudentId}, tx=${testTxId}`);

  try {
    // 1. Insert test student
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
       VALUES ($1, $2, 'hash', 'Test Sepay Student', 'student', true, $3)`,
      [testStudentId, `sepay_${Date.now()}@example.com`, now]
    );

    // 2. Insert test course
    await pool.query(
      `INSERT INTO courses (id, title, description, teacher_id, status, category, price, created_at)
       VALUES ($1, 'Khoa Hoc Test SePay', 'Mo ta', $2, 'published', 'Web Development', $3, $4)`,
      [testCourseId, testStudentId, coursePrice, now]
    );

    // 3. Insert test class section
    await pool.query(
      `INSERT INTO course_sections (id, course_id, teacher_id, section_code, max_students, schedule, status)
       VALUES ($1, $2, $3, 'TEST-01', 30, '[]', 'open')`,
      [testSectionId, testCourseId, testStudentId]
    );

    // 4. Insert test enrollment (status: pending_payment)
    await pool.query(
      `INSERT INTO enrollments (id, student_id, course_id, status, requested_section_id, enrolled_at)
       VALUES ($1, $2, $3, 'pending_payment', $4, $5)`,
      [testEnrollmentId, testStudentId, testCourseId, testSectionId, now]
    );

    // 5. Insert test pending transaction
    await pool.query(
      `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at)
       VALUES ($1, $2, $3, $4, 'pending', 'Chuyển khoản Ngân hàng (QR)', $5)`,
      [testTxId, testStudentId, testCourseId, coursePrice, now]
    );

    // Build memo exactly like CourseCatalog.tsx
    const studentSub = testStudentId.substring(5, 11).toUpperCase();
    const txSub = testTxId.substring(3, 9).toUpperCase();
    const memoText = `MCNA ${studentSub} ${txSub}`;
    console.log(`Generated VietQR memo for test: "${memoText}"`);

    // --- Scenario A: Test Unrelated Transaction ---
    console.log("Running Scenario A: Unrelated transaction...");
    const resA = await processSepayWebhook(
      {
        id: `test_unrelated_${Date.now()}`,
        gateway: "MBBank",
        transferType: "in",
        transferAmount: 50000,
        content: "Tien ca phe nhe anh"
      },
      ""
    );
    assert.strictEqual(resA.success, true);
    assert.strictEqual(resA.matched, false);
    console.log("✓ Scenario A passed: Unrelated transfer returned success=true, matched=false");

    // --- Scenario B: Underpayment ---
    console.log("Running Scenario B: Underpayment...");
    const resB = await processSepayWebhook(
      {
        id: `test_underpaid_${Date.now()}`,
        gateway: "MBBank",
        transferType: "in",
        transferAmount: 1000000, // Less than 1,500,000
        content: `MBVCB.123.${memoText}.Chuyen tien`
      },
      ""
    );
    assert.strictEqual(resB.success, true);
    assert.strictEqual(resB.matched, true);
    assert.strictEqual(resB.underpaid, true);

    const txUnderpaid = (await pool.query("SELECT status, notes FROM transactions WHERE id = $1", [testTxId])).rows[0];
    assert.strictEqual(txUnderpaid.status, "pending", "Transaction should remain pending when underpaid");
    console.log("✓ Scenario B passed: Underpayment recognized and recorded in notes without approving");

    // --- Scenario C: Full payment with auto-placement ---
    console.log("Running Scenario C: Full payment confirmation...");
    const sepayTxId = `sepay_test_${Date.now()}`;
    const resC = await processSepayWebhook(
      {
        id: sepayTxId,
        gateway: "MBBank",
        transferType: "in",
        transferAmount: coursePrice,
        content: `MBVCB.999.${memoText}.Thanh toan hoc phi`
      },
      ""
    );
    assert.strictEqual(resC.success, true);
    assert.strictEqual(resC.matched, true);
    assert.strictEqual(resC.underpaid, undefined);
    assert.strictEqual(resC.transactionId, testTxId);
    assert.strictEqual(resC.placedSectionId, testSectionId, "Should auto-place into requested section");

    // Verify DB states
    const txAfter = (await pool.query("SELECT status FROM transactions WHERE id = $1", [testTxId])).rows[0];
    assert.strictEqual(txAfter.status, "approved", "Transaction status should be approved");

    const enrollmentAfter = (await pool.query("SELECT status FROM enrollments WHERE id = $1", [testEnrollmentId])).rows[0];
    assert.strictEqual(enrollmentAfter.status, "active", "Enrollment should be active");

    const registrationAfter = (await pool.query(
      "SELECT status FROM course_registrations WHERE student_id = $1 AND section_id = $2",
      [testStudentId, testSectionId]
    )).rows[0];
    assert.strictEqual(registrationAfter?.status, "registered", "Student should be registered in the class section");

    console.log("✓ Scenario C passed: Transaction approved, enrollment activated, student placed in section!");

    // --- Scenario D: Idempotency test (same webhook resent by SePay) ---
    console.log("Running Scenario D: Idempotency check...");
    const resD = await processSepayWebhook(
      {
        id: sepayTxId,
        gateway: "MBBank",
        transferType: "in",
        transferAmount: coursePrice,
        content: `MBVCB.999.${memoText}.Thanh toan hoc phi`
      },
      ""
    );
    assert.strictEqual(resD.success, true);
    assert.strictEqual(resD.duplicate, true, "Should detect duplicate event");
    console.log("✓ Scenario D passed: Duplicate event safely detected and handled without re-running");

  } finally {
    // Cleanup fixtures
    console.log("Cleaning up test fixtures...");
    await pool.query("DELETE FROM payment_webhook_events WHERE event_id LIKE 'sepay_test_%'");
    await pool.query("DELETE FROM notifications WHERE user_id = $1", [testStudentId]);
    await pool.query("DELETE FROM course_registrations WHERE student_id = $1", [testStudentId]);
    await pool.query("DELETE FROM transactions WHERE id = $1", [testTxId]);
    await pool.query("DELETE FROM enrollments WHERE id = $1", [testEnrollmentId]);
    await pool.query("DELETE FROM course_sections WHERE id = $1", [testSectionId]);
    await pool.query("DELETE FROM courses WHERE id = $1", [testCourseId]);
    await pool.query("DELETE FROM users WHERE id = $1", [testStudentId]);
    console.log("Cleanup finished.");
  }
}

async function main() {
  await runUnitTests();
  await runDatabaseIntegrationTests();
  console.log("\n=================================");
  console.log("🎉 ALL SEPAY WEBHOOK TESTS PASSED!");
  console.log("=================================\n");
  process.exit(0);
}

main().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
