import { Notification } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { sendEmailNotification, sendEmailDirect } from "../services/email";
import { provisioningService } from "../emailProvisioning/provisioningService";

type CreateNotificationInput = {
  userId: string;
  type?: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /**
   * Important news (fee confirmed, placed in a class). Students without a school mailbox, such as
   * everyone who signed up on the website, then also get it at the email they registered with.
   */
  emailFallback?: boolean;
};

export const notificationsRepository = {
  async listForUser(db: Queryable, userId: string, unreadOnly = false): Promise<Notification[]> {
    const res = unreadOnly
      ? await db.query("SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC", [userId])
      : await db.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      message: row.message,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
      relatedEntityType: row.related_entity_type || undefined,
      relatedEntityId: row.related_entity_id || undefined
    }));
  },

  async create(db: Queryable, input: CreateNotificationInput): Promise<Notification> {
    const notification: Notification = {
      id: generateId("noti"),
      userId: input.userId,
      type: input.type || "info",
      message: input.message,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    // Fetch user details synchronously using the active transaction/query client
    let userEmail: string | null = null;
    let userName: string | null = null;
    let userRole: string | null = null;
    let emailProvisioned = false;
    try {
      const userRes = await db.query(
        "SELECT email, name, role, email_provisioned FROM users WHERE id = $1",
        [notification.userId]
      );
      if (userRes.rows[0]) {
        userEmail = userRes.rows[0].email;
        userName = userRes.rows[0].name;
        userRole = userRes.rows[0].role;
        emailProvisioned = Boolean(userRes.rows[0].email_provisioned);
      }
    } catch (dbErr) {
      console.error("[Notifications Repository] Synchronous user email fetch failed:", dbErr);
    }

    await db.query(
      `INSERT INTO notifications (id, user_id, type, message, is_read, created_at, related_entity_type, related_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        notification.id,
        notification.userId,
        notification.type,
        notification.message,
        Boolean(notification.isRead),
        notification.createdAt,
        input.relatedEntityType || null,
        input.relatedEntityId || null
      ]
    );

    // Dispatch email notification asynchronously
    if (userRole === "student") {
      if (emailProvisioned) {
        // Fire and forget
        provisioningService.sendNotificationEmail(db as any, notification.userId, {
          subject: "Cập nhật thông báo từ LMS",
          body: notification.message,
          type: notification.type
        }).catch(err => {
          console.error("[Notifications Repository] School email notification dispatch error:", err);
        });
      } else if (input.emailFallback && userEmail) {
        sendEmailDirect(userEmail, userName || "Học viên", notification.message).catch(err => {
          console.error("[Notifications Repository] Sign-up email notification dispatch error:", err);
        });
      } else {
        console.log(`[Notifications Repository] Skipping email for unprovisioned student ${notification.userId}`);
      }
    } else {
      // Non-students still use the legacy sendEmailDirect
      if (userEmail) {
        sendEmailDirect(userEmail, userName || "Học viên", notification.message).catch(err => {
          console.error("[Email Notification dispatch error]:", err);
        });
      }
    }

    return notification;
  },

  async createBulk(db: Queryable, notifications: CreateNotificationInput[]) {
    for (const notification of notifications) {
      await this.create(db, notification);
    }
  },

  async createNotification(db: Queryable, userId: string, type: string, message: string): Promise<Notification> {
    return this.create(db, { userId, type, message });
  },

  async markRead(db: Queryable, notificationId: string, userId?: string): Promise<void> {
    if (userId) {
      await db.query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [notificationId, userId]);
      return;
    }
    await db.query("UPDATE notifications SET is_read = true WHERE id = $1", [notificationId]);
  },

  async markAllRead(db: Queryable, userId: string): Promise<void> {
    await db.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [userId]);
  },

  async markAllReadForUser(db: Queryable, userId: string): Promise<void> {
    await this.markAllRead(db, userId);
  }
};
