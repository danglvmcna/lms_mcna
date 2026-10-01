import { Pool } from "pg";
import { createSchoolEmail } from "./googleWorkspaceClient";
import { sendWelcomeEmail, sendLmsNotification } from "./emailWorker";
import { notificationsRepository } from "../repositories/notifications";
import { auditRepository } from "../repositories/audit";

const LMS_LOGIN_URL = process.env.LMS_LOGIN_URL || process.env.APP_URL || "https://lms.mcna.vn";

export const provisioningService = {
  /**
   * Provision a Google Workspace email account for a student user
   */
  async provisionStudentEmail(pool: Pool, userId: string): Promise<void> {
    console.log(`[ProvisioningService] Beginning provisioning for student user ID: ${userId}`);

    // 1. Fetch student info
    const userRes = await pool.query(
      "SELECT id, email, name, role, email_provisioned, school_email FROM users WHERE id = $1",
      [userId]
    );
    const user = userRes.rows[0];

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (user.role !== "student") {
      console.log(`[ProvisioningService] User ${userId} is not a student (${user.role}). Skipping provisioning.`);
      return;
    }

    // 2. Check if already provisioned
    if (user.email_provisioned) {
      console.log(`[ProvisioningService] User ${userId} is already provisioned (${user.school_email}). Skipping.`);
      return;
    }

    // 3. Create Google Workspace Email
    const { schoolEmail, tempPassword } = await createSchoolEmail(pool, {
      id: user.id,
      name: user.name,
      email: user.email,
    });

    // 4. Update Database
    await pool.query(
      `UPDATE users
       SET school_email = $1, email_provisioned = true, email_provisioned_at = NOW()
       WHERE id = $2`,
      [schoolEmail, userId]
    );
    console.log(`[ProvisioningService] Updated user table for ${userId} with email ${schoolEmail}.`);

    // 5. Send Welcome Email to the student's personal email (user.email)
    try {
      await sendWelcomeEmail(pool, userId, {
        to: user.email,
        name: user.name,
        schoolEmail,
        tempPassword,
        lmsLoginUrl: LMS_LOGIN_URL,
      });
    } catch (welcomeErr) {
      console.error(`[ProvisioningService] Welcome email dispatch failed for ${userId}:`, welcomeErr);
      // Do not throw: welcome email fail shouldn't completely fail provisioning if account is already created.
    }

    // 6. Create internal notification
    try {
      await notificationsRepository.create(pool, {
        userId,
        type: "success",
        message: `Tài khoản email trường đã được tạo thành công: ${schoolEmail}. Vui lòng kiểm tra hộp thư cá nhân để nhận mật khẩu đăng nhập.`,
      });
    } catch (notifErr) {
      console.error(`[ProvisioningService] Internal notification creation failed for ${userId}:`, notifErr);
    }

    // 7. Log audit log
    await auditRepository.log(
      pool,
      userId,
      "email_provisioning_completed",
      "email",
      `Đã hoàn thành tạo email trường ${schoolEmail}`
    );
  },

  /**
   * Send notification to a student's school email if provisioned
   */
  async sendNotificationEmail(
    pool: Pool,
    userId: string,
    payload: { subject: string; body: string; type: string }
  ): Promise<void> {
    // 1. Fetch user's school email details
    const userRes = await pool.query(
      "SELECT school_email, email_provisioned, role FROM users WHERE id = $1",
      [userId]
    );
    const user = userRes.rows[0];

    if (!user) {
      console.warn(`[ProvisioningService] User ${userId} not found for sending notification email.`);
      return;
    }

    // 2. Only students get school email notifications; others (teachers/parents) are handled separately
    if (user.role !== "student") {
      return;
    }

    if (!user.email_provisioned || !user.school_email) {
      console.log(`[ProvisioningService] Student ${userId} email is not provisioned yet. Skipping notification email.`);
      return;
    }

    // 3. Dispatch notification email
    await sendLmsNotification(pool, userId, {
      to: user.school_email,
      subject: payload.subject,
      body: payload.body,
      type: payload.type,
    });
  },
};
