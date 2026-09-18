import { SessionMaterial } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { sessionMaterialFromRow } from "../mappers";

export type NewSessionMaterial = {
  id?: string;
  sessionId: string;
  sectionId?: string | null;
  courseId: string;
  type: SessionMaterial["type"];
  title: string;
  url?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdBy?: string | null;
};

export const sessionMaterialsRepository = {
  newId() {
    return generateId("mat");
  },

  async listBySession(db: Queryable, sessionId: string) {
    return (await db.query(
      "SELECT * FROM session_materials WHERE session_id = $1 ORDER BY sort_order, created_at",
      [sessionId]
    )).rows.map(sessionMaterialFromRow);
  },

  async listRowsBySession(db: Queryable, sessionId: string) {
    return (await db.query(
      "SELECT * FROM session_materials WHERE session_id = $1 ORDER BY sort_order, created_at",
      [sessionId]
    )).rows;
  },

  /** Raw row including storage_path; server-side use only. */
  async findRowById(db: Queryable, id: string) {
    return (await db.query("SELECT * FROM session_materials WHERE id = $1", [id])).rows[0] || null;
  },

  async create(db: Queryable, input: NewSessionMaterial) {
    const row = (await db.query(
      `INSERT INTO session_materials (id, session_id, section_id, course_id, type, title, url, storage_path, file_name, mime_type, size_bytes, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM session_materials WHERE session_id = $2),
               $12)
       RETURNING *`,
      [
        input.id || generateId("mat"),
        input.sessionId,
        input.sectionId || null,
        input.courseId,
        input.type,
        input.title,
        input.url || null,
        input.storagePath || null,
        input.fileName || null,
        input.mimeType || null,
        input.sizeBytes ?? null,
        input.createdBy || null
      ]
    )).rows[0];
    return sessionMaterialFromRow(row);
  },

  async update(db: Queryable, id: string, input: { title?: string; url?: string }) {
    const row = (await db.query(
      "UPDATE session_materials SET title = COALESCE($1, title), url = COALESCE($2, url) WHERE id = $3 RETURNING *",
      [input.title ?? null, input.url ?? null, id]
    )).rows[0];
    return row ? sessionMaterialFromRow(row) : null;
  },

  async remove(db: Queryable, id: string) {
    return (await db.query("DELETE FROM session_materials WHERE id = $1 RETURNING *", [id])).rows[0] || null;
  },

  async reorder(db: Queryable, sessionId: string, orderedIds: string[]) {
    for (const [index, id] of orderedIds.entries()) {
      await db.query(
        "UPDATE session_materials SET sort_order = $1 WHERE id = $2 AND session_id = $3",
        [index + 1, id, sessionId]
      );
    }
    return this.listBySession(db, sessionId);
  },

  /** Storage objects of every uploaded file in a class, so they can be removed with the class. */
  async listStoragePathsForSection(db: Queryable, sectionId: string): Promise<string[]> {
    return (await db.query(
      "SELECT storage_path FROM session_materials WHERE section_id = $1 AND storage_path IS NOT NULL",
      [sectionId]
    )).rows.map(row => row.storage_path);
  }
};
