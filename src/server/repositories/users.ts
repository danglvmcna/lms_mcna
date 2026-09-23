import { Queryable } from "../db";
import { DbUserRow, denormalizeRole, toPublicUser } from "../mappers";
import { User } from "../../types";

export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return "0" + digits.slice(2);
  }
  return digits;
}

export const usersRepository = {
  async normalizeLegacyRoles(db: Queryable) {
    await db.query(`
      UPDATE users SET role = 'admin' WHERE role IN ('ke_toan', 'finance', 'le_tan', 'sale', 'quan_ly_hoc_vu', 'academic', 'academic_admin');
      UPDATE users SET role = 'teacher' WHERE role = 'advisor';
    `);
  },

  async normalizeSystemUsers(db: Queryable) {
    const systemUsers = [
      ["admin@mcna.local", "Arthur Pendragon", "admin"],
      ["teacher@mcna.local", "Prof. Linus Torvalds", "teacher"]
    ];

    for (const [email, name, role] of systemUsers) {
      await db.query(
        "UPDATE users SET name = $1, role = $2 WHERE lower(email) = $3",
        [name, role, email]
      );
    }
  },

  async count(db: Queryable) {
    return Number((await db.query("SELECT COUNT(*) AS count FROM users")).rows[0].count);
  },

  async findAuthByEmail(db: Queryable, email: string) {
    const cleanEmail = email.toLowerCase().trim();
    const exactMatch = (await db.query<DbUserRow>("SELECT * FROM users WHERE lower(email) = $1", [cleanEmail])).rows[0];
    if (exactMatch) return exactMatch;

    if (cleanEmail.endsWith("@e16.local")) {
      const mappedEmail = cleanEmail.replace("@e16.local", "@mcna.local");
      const mappedMatch = (await db.query<DbUserRow>("SELECT * FROM users WHERE lower(email) = $1", [mappedEmail])).rows[0];
      if (mappedMatch) return mappedMatch;
    }

    if (cleanEmail.endsWith("@mcna.local")) {
      const mappedEmail = cleanEmail.replace("@mcna.local", "@e16.local");
      const mappedMatch = (await db.query<DbUserRow>("SELECT * FROM users WHERE lower(email) = $1", [mappedEmail])).rows[0];
      if (mappedMatch) return mappedMatch;
    }

    return null;
  },

  async findStudentByPhone(db: Queryable, phone: string) {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return null;
    const norm = normalizePhone(cleanPhone);
    const row = (await db.query<DbUserRow>(
      `SELECT * FROM users 
       WHERE role = 'student' 
         AND (
           phone = $1 
           OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $2
           OR regexp_replace(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), '^84', '0') = $2
         )
       LIMIT 1`,
      [cleanPhone, norm || cleanPhone]
    )).rows[0];
    return row || null;
  },

  async findStudentByEmailOrPhone(db: Queryable, params: { email?: string; phone?: string; crmContactId?: string }) {
    if (params.crmContactId) {
      const row = (await db.query<DbUserRow>(
        "SELECT * FROM users WHERE crm_contact_id = $1 AND role = 'student' LIMIT 1",
        [params.crmContactId]
      )).rows[0];
      if (row) return row;
    }
    if (params.email) {
      const row = await this.findAuthByEmail(db, params.email);
      if (row && row.role === "student") return row;
    }
    if (params.phone) {
      const row = await this.findStudentByPhone(db, params.phone);
      if (row) return row;
    }
    return null;
  },

  async findById(db: Queryable, id: string) {
    const row = (await db.query<DbUserRow>("SELECT * FROM users WHERE id = $1", [id])).rows[0];
    return row ? toPublicUser(row) : null;
  },

  async list(db: Queryable) {
    return (await db.query<DbUserRow>("SELECT * FROM users ORDER BY created_at DESC")).rows.map(toPublicUser);
  },

  async create(db: Queryable, user: User) {
    await db.query(
      `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [user.id, user.email.toLowerCase(), user.passwordHash, user.passwordSalt || null, user.name, denormalizeRole(user.role), user.isActive, user.phone || null, user.linkedStudentId || null, user.createdAt]
    );
    return { ...user, passwordHash: "" };
  },

  async seed(db: Queryable, users: User[]) {
    for (const user of users) {
      await db.query(
        `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email.toLowerCase(), user.passwordHash, user.passwordSalt || null, user.name, denormalizeRole(user.role), user.isActive, user.phone || null, user.linkedStudentId || null, user.createdAt]
      );
    }
  },

  async setActive(db: Queryable, id: string, isActive: boolean) {
    const row = (await db.query<DbUserRow>("UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *", [isActive, id])).rows[0];
    return row ? toPublicUser(row) : null;
  }
};
