import { Queryable } from "./db";
import { UserRole } from "../types";
import { notificationsRepository } from "./repositories/notifications";

type NotificationInput = {
  type?: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export async function notifyUsers(db: Queryable, userIds: string[], notification: NotificationInput) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  await notificationsRepository.createBulk(
    db,
    uniqueIds.map(userId => ({ userId, type: notification.type || "info", ...notification }))
  );
}

export async function notifyStudent(db: Queryable, studentId: string, message: string, meta: Partial<NotificationInput> = {}) {
  await notifyUsers(db, [studentId], { type: "info", message, ...meta });
}

export async function notifyRole(db: Queryable, role: UserRole, message: string, meta: Partial<NotificationInput> = {}) {
  const users = await db.query("SELECT id FROM users WHERE role = $1 AND is_active = true", [role]);
  await notifyUsers(db, users.rows.map(row => row.id), { type: "info", message, ...meta });
}
