import { Course, Lesson } from "../../types";
import { Queryable } from "../db";
import { generateId } from "../ids";
import { courseFromRow } from "../mappers";

export const coursesRepository = {
  async list(db: Queryable) {
    return (await db.query("SELECT * FROM courses ORDER BY created_at DESC")).rows.map(courseFromRow);
  },

  async listByTeacher(db: Queryable, teacherId: string) {
    return (await db.query("SELECT * FROM courses WHERE teacher_id = $1 ORDER BY created_at DESC", [teacherId])).rows.map(courseFromRow);
  },

  async findById(db: Queryable, id: string) {
    const row = (await db.query("SELECT * FROM courses WHERE id = $1", [id])).rows[0];
    return row ? courseFromRow(row) : null;
  },

  async create(db: Queryable, input: Omit<Course, "id" | "createdAt">) {
    const course: Course = { ...input, id: generateId("course"), createdAt: new Date().toISOString() };
    await db.query(
      "INSERT INTO courses (id,title,description,teacher_id,status,category,thumbnail,price,level,tags_json,rejection_reason,created_at,opening_date,number_of_lessons,original_price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
      [
        course.id,
        course.title,
        course.description,
        course.teacherId,
        course.status,
        course.category,
        course.thumbnail || null,
        course.price || 0,
        course.level || null,
        JSON.stringify(course.tags || []),
        course.rejectionReason || null,
        course.createdAt,
        course.openingDate || null,
        course.numberOfLessons || null,
        course.originalPrice ?? null
      ]
    );
    return course;
  },

  async updateDetails(db: Queryable, id: string, input: Pick<Course, "title" | "description" | "category"> & Partial<Pick<Course, "thumbnail" | "price" | "originalPrice" | "level" | "tags" | "openingDate" | "numberOfLessons">>) {
    const row = (await db.query(
      `UPDATE courses
       SET title = $1,
           description = $2,
           category = $3,
           thumbnail = $4,
           price = $5,
           level = $6,
           tags_json = $7,
           opening_date = $8,
           number_of_lessons = $9,
           original_price = $10
       WHERE id = $11
       RETURNING *`,
      [
        input.title,
        input.description,
        input.category,
        input.thumbnail || null,
        input.price || 0,
        input.level || null,
        JSON.stringify(input.tags || []),
        input.openingDate || null,
        input.numberOfLessons || null,
        input.originalPrice ?? null,
        id
      ]
    )).rows[0];
    return row ? courseFromRow(row) : null;
  },

  async setStatus(db: Queryable, id: string, status: Course["status"], rejectionReason?: string) {
    const row = (await db.query("UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *", [status, rejectionReason || null, id])).rows[0];
    return row ? courseFromRow(row) : null;
  },

  async addLesson(db: Queryable, input: Omit<Lesson, "id">) {
    const lesson = { ...input, id: generateId("lesson") };
    await db.query(
      "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [lesson.id, lesson.courseId, lesson.title, lesson.content, lesson.videoUrl || null, lesson.order, lesson.duration]
    );
    return lesson;
  },

  async updateLesson(db: Queryable, id: string, input: Partial<Omit<Lesson, "id" | "courseId">>) {
    const row = (await db.query(
      "UPDATE lessons SET title = COALESCE($1, title), content = COALESCE($2, content), video_url = $3, lesson_order = COALESCE($4, lesson_order), duration = COALESCE($5, duration) WHERE id = $6 RETURNING *",
      [
        input.title || null,
        input.content || null,
        input.videoUrl || null,
        input.order !== undefined ? input.order : null,
        input.duration || null,
        id
      ]
    )).rows[0];
    return row ? {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      content: row.content,
      videoUrl: row.video_url || undefined,
      order: row.lesson_order,
      duration: row.duration
    } : null;
  },

  async deleteLesson(db: Queryable, id: string) {
    await db.query("DELETE FROM lessons WHERE id = $1", [id]);
  },

  async teacherOwnsCourse(db: Queryable, teacherId: string, courseId: string) {
    return Boolean((await db.query("SELECT id FROM courses WHERE id = $1 AND teacher_id = $2", [courseId, teacherId])).rows[0]);
  }
};
