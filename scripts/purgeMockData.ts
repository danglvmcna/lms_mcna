import dotenv from "dotenv";
import { pool } from "../src/server/db";
import { importMcnaCatalog } from "../src/server/services/catalogImport";
import { invalidateStoreCache } from "../src/server/repositories/storeSnapshot";

dotenv.config();

async function purgeMockData() {
  console.log("==================================================");
  console.log("🧹 BẮT ĐẦU XÓA TOÀN BỘ DỮ LIỆU MOCK SEED...");
  console.log("==================================================");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Delete notifications of mock users
    const delNotif = await client.query(`
      DELETE FROM notifications 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%@e16.local' 
           OR id LIKE 'student_gen_%' 
           OR id LIKE 'teacher_gen_%' 
           OR id IN ('user_advisor', 'user_academic', 'user_le_tan', 'user_finance', 'user_student_active', 'user_student_graduated', 'user_student_on_leave', 'user_student_suspended', 'user_student_withdrawn') 
           OR email LIKE 'sepay_%'
      )
    `);
    console.log(`✓ Đã xóa ${delNotif.rowCount} thông báo của tài khoản mock.`);

    // 2. Delete audit logs of mock users
    const delAudit = await client.query(`
      DELETE FROM audit_logs 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%@e16.local' 
           OR id LIKE 'student_gen_%' 
           OR id LIKE 'teacher_gen_%'
      )
    `);
    console.log(`✓ Đã xóa ${delAudit.rowCount} audit logs của tài khoản mock.`);

    // 3. Delete password reset tokens of mock users
    await client.query(`
      DELETE FROM password_reset_tokens 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%@e16.local' 
           OR id LIKE 'student_gen_%' 
           OR id LIKE 'teacher_gen_%'
      )
    `);

    // 3b. Delete SIS leftover records
    await client.query("DELETE FROM advisor_notes");
    await client.query("DELETE FROM advisor_assignments");
    await client.query("DELETE FROM scholarship_applications");
    await client.query("DELETE FROM grade_appeals");
    await client.query("DELETE FROM leave_requests");
    await client.query("DELETE FROM graduation_applications");
    await client.query("DELETE FROM parent_links");
    await client.query("DELETE FROM academic_warnings");
    await client.query("DELETE FROM grades");
    await client.query("DELETE FROM tuition_fees");
    await client.query("DELETE FROM student_profiles WHERE user_id NOT IN ('user_student', 'user_92f3e380913d')");
    await client.query("UPDATE departments SET head_teacher_id = 'user_teacher' WHERE head_teacher_id IS NOT NULL");
    await client.query("UPDATE users SET linked_student_id = NULL WHERE linked_student_id IS NOT NULL");

    // 4. Delete certificates for mock courses or mock students
    await client.query(`
      DELETE FROM certificates 
      WHERE course_id NOT LIKE 'course_mcna_%' 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);

    // 5. Delete forum replies and posts for mock courses/users
    await client.query(`
      DELETE FROM forum_replies 
      WHERE author_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%' OR id LIKE 'teacher_gen_%') 
         OR post_id IN (SELECT id FROM forum_posts WHERE course_id NOT LIKE 'course_mcna_%')
    `);
    await client.query(`
      DELETE FROM forum_posts 
      WHERE course_id NOT LIKE 'course_mcna_%' 
         OR author_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%' OR id LIKE 'teacher_gen_%')
    `);

    // 6. Delete teacher attendance and session materials for mock courses
    await client.query(`
      DELETE FROM teacher_attendance 
      WHERE course_id NOT LIKE 'course_mcna_%'
    `);
    await client.query(`
      DELETE FROM session_materials 
      WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id NOT LIKE 'course_mcna_%')
    `);

    // 7. Delete attendance records and sessions for mock courses
    await client.query(`
      DELETE FROM attendance_records 
      WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id NOT LIKE 'course_mcna_%') 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);
    await client.query(`
      DELETE FROM attendance_sessions 
      WHERE course_id NOT LIKE 'course_mcna_%' 
         OR teacher_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'teacher_gen_%')
    `);

    // 8. Delete lesson progress for mock courses/students
    await client.query(`
      DELETE FROM lesson_progress 
      WHERE enrollment_id IN (
        SELECT id FROM enrollments 
        WHERE course_id NOT LIKE 'course_mcna_%' 
           OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
      )
    `);

    // 9. Delete registrations, schedules, and sections for mock courses
    await client.query(`
      DELETE FROM course_registrations 
      WHERE section_id IN (SELECT id FROM course_sections WHERE course_id NOT LIKE 'course_mcna_%') 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);
    await client.query(`
      DELETE FROM section_schedules 
      WHERE section_id IN (SELECT id FROM course_sections WHERE course_id NOT LIKE 'course_mcna_%')
    `);
    await client.query(`
      DELETE FROM course_sections 
      WHERE course_id NOT LIKE 'course_mcna_%' 
         OR teacher_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'teacher_gen_%')
    `);

    // 10. Delete submissions and assignments for mock courses
    await client.query(`
      DELETE FROM submissions 
      WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id NOT LIKE 'course_mcna_%') 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);
    await client.query(`
      DELETE FROM assignments 
      WHERE course_id NOT LIKE 'course_mcna_%'
    `);

    // 11. Delete quiz attempts, questions, quizzes for mock courses
    await client.query(`
      DELETE FROM quiz_attempts 
      WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id NOT LIKE 'course_mcna_%') 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);
    await client.query(`
      DELETE FROM questions 
      WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id NOT LIKE 'course_mcna_%')
    `);
    await client.query(`
      DELETE FROM quizzes 
      WHERE course_id NOT LIKE 'course_mcna_%'
    `);

    // 12. Delete payment webhook events & transactions for mock courses
    await client.query(`
      DELETE FROM payment_webhook_events 
      WHERE transaction_id IN (
        SELECT id FROM transactions 
        WHERE course_id NOT LIKE 'course_mcna_%' 
           OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
      ) OR event_id LIKE 'sepay_test_%'
    `);
    await client.query(`
      DELETE FROM transactions 
      WHERE course_id NOT LIKE 'course_mcna_%' 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);

    // 13. Delete enrollments for mock courses/students
    await client.query(`
      DELETE FROM enrollments 
      WHERE course_id NOT LIKE 'course_mcna_%' 
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@e16.local' OR id LIKE 'student_gen_%')
    `);

    // 14. Delete lessons for mock courses
    await client.query(`
      DELETE FROM lessons 
      WHERE course_id NOT LIKE 'course_mcna_%'
    `);

    // 15. Delete mock courses
    const delCourses = await client.query(`
      DELETE FROM courses 
      WHERE id NOT LIKE 'course_mcna_%'
    `);
    console.log(`✓ Đã xóa ${delCourses.rowCount} khóa học demo không thuộc MCNA.`);

    // 16. Delete all mock users (teachers and students generated by seeds)
    const delUsers = await client.query(`
      DELETE FROM users 
      WHERE email LIKE '%@e16.local' 
         OR id LIKE 'student_gen_%' 
         OR id LIKE 'teacher_gen_%' 
         OR id IN ('user_advisor', 'user_academic', 'user_le_tan', 'user_finance', 'user_student_active', 'user_student_graduated', 'user_student_on_leave', 'user_student_suspended', 'user_student_withdrawn') 
         OR email LIKE 'sepay_%'
    `);
    console.log(`✓ Đã xóa ${delUsers.rowCount} tài khoản người dùng mock (giáo viên và học viên demo).`);

    // 17. Ensure real MCNA catalogue is imported
    console.log("\n📦 Đang đồng bộ danh mục khóa học thật từ mcnaCatalog.json...");
    const summary = await importMcnaCatalog(client, { log: msg => console.log(`   ${msg}`) });
    console.log(`✓ Danh mục MCNA hoàn tất: ${summary.coursesCreated} tạo mới, ${summary.coursesUpdated} cập nhật, ${summary.lessons} bài học, ${summary.classesCreated} lớp học phần.`);

    await client.query("COMMIT");
    console.log("\n✅ ĐÃ XÓA TOÀN BỘ MOCK DATA VÀ ĐỒNG BỘ THÀNH CÔNG!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Có lỗi xảy ra trong quá trình xóa dữ liệu mock:", err);
    process.exit(1);
  } finally {
    client.release();
  }

  // 18. Invalidate store cache
  invalidateStoreCache();

  // Print current clean stats
  const [userStats, courseStats, classStats] = await Promise.all([
    pool.query("SELECT role, count(*) FROM users GROUP BY role"),
    pool.query("SELECT count(*) FROM courses"),
    pool.query("SELECT count(*) FROM course_sections")
  ]);

  console.log("\n==================================================");
  console.log("📊 THỐNG KÊ DỮ LIỆU HIỆN TẠI (SAU KHI DỌN SẠCH):");
  console.log("==================================================");
  console.log(`- Tổng số khóa học (MCNA thật): ${courseStats.rows[0].count}`);
  console.log(`- Tổng số lớp học phần mở: ${classStats.rows[0].count}`);
  console.log("- Người dùng hệ thống:");
  for (const r of userStats.rows) {
    console.log(`  + Role "${r.role}": ${r.count} người dùng`);
  }

  const remainingUsers = await pool.query("SELECT id, email, name, role FROM users ORDER BY role, id");
  console.log("\nDanh sách tài khoản còn lại trong hệ thống:");
  console.table(remainingUsers.rows);

  process.exit(0);
}

purgeMockData().catch(console.error);
