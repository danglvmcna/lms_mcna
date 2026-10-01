import { Assignment } from '../../types';
import { Queryable, pool } from '../db';
import { generateId } from '../ids';
import { notifyStudent } from '../notify';
import { assignmentFromRow, submissionFromRow } from '../mappers';

export const assignmentsRepository = {
  async create(db: Queryable, input: Omit<Assignment, 'id'>) {
    const row = (await db.query(`INSERT INTO assignments(id,course_id,title,description,deadline,max_score,attachment_url,lesson_id,type,session_id,allow_late)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [generateId('assign'),input.courseId,input.title,input.description,input.deadline,input.maxScore,input.attachmentUrl || null,input.lessonId || null,input.type || 'lesson',input.sessionId || null,input.allowLate || false])).rows[0];
    return assignmentFromRow(row);
  },
  async submit(_db: Queryable, studentId: string, assignmentId: string, content: string, attachmentUrl?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const assignment = (await client.query('SELECT * FROM assignments WHERE id=$1 FOR UPDATE', [assignmentId])).rows[0];
      const fail = async (error: string, status: number) => { await client.query('ROLLBACK'); return { error, status }; };
      if (!assignment) return await fail('Không tìm thấy bài tập.',404);
      if (!assignment.allow_late && Date.now() > new Date(assignment.deadline).getTime()) return await fail('Đã quá hạn nộp bài.',400);
      const access = (await client.query(`SELECT 1 FROM enrollments e WHERE e.student_id=$1 AND e.course_id=$2 AND e.status IN ('active','completed')
        AND EXISTS(SELECT 1 FROM course_registrations cr JOIN course_sections cs ON cs.id=cr.section_id
          WHERE cr.student_id=e.student_id AND cs.course_id=e.course_id AND cr.status='registered'
          AND ($3::text IS NULL OR cr.section_id=(SELECT section_id FROM attendance_sessions WHERE id=$3)))`,[studentId,assignment.course_id,assignment.session_id])).rowCount;
      if (!access) return await fail('Bạn chưa được xếp vào lớp của bài tập này.',403);
      const existing = (await client.query('SELECT * FROM submissions WHERE student_id=$1 AND assignment_id=$2 ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE',[studentId,assignmentId])).rows[0];
      const id = existing?.id || generateId('sub');
      if (existing) await client.query(`INSERT INTO submission_versions(id,submission_id,content,attachment_url,submitted_at) VALUES($1,$2,$3,$4,$5)`,[generateId('rev'),id,existing.content,existing.attachment_url,existing.submitted_at]);
      const row = existing
        ? (await client.query(`UPDATE submissions SET content=$1,attachment_url=COALESCE($2,attachment_url),submitted_at=GREATEST(clock_timestamp(),submitted_at::timestamptz + interval '1 millisecond'),score=NULL,feedback=NULL,graded_at=NULL WHERE id=$3 RETURNING *`,[content,attachmentUrl || null,id])).rows[0]
        : (await client.query(`INSERT INTO submissions(id,assignment_id,student_id,content,attachment_url,submitted_at) VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) RETURNING *`,[id,assignmentId,studentId,content,attachmentUrl || null])).rows[0];
      await client.query('COMMIT');
      return { row: submissionFromRow(row) };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  },
  async findSubmissionForGrading(db: Queryable, submissionId: string) {
    return (await db.query(`SELECT s.*,a.max_score,a.course_id,a.session_id,c.teacher_id FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id WHERE s.id=$1`,[submissionId])).rows[0] || null;
  },
  async grade(db: Queryable, submissionId: string, score: number, feedback: string, expectedSubmittedAt?: string) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const current=(await client.query('SELECT sub.*,a.max_score FROM submissions sub JOIN assignments a ON a.id=sub.assignment_id WHERE sub.id=$1 FOR UPDATE OF sub',[submissionId])).rows[0];
      if(!current || (expectedSubmittedAt && new Date(current.submitted_at).getTime()!==Date.parse(expectedSubmittedAt))){await client.query('ROLLBACK');return {error:'Bài nộp đã thay đổi. Tải lại trước khi chấm.',status:409};}
      if(score<0 || score>Number(current.max_score)){await client.query('ROLLBACK');return {error:'Điểm vượt thang điểm.',status:400};}
      await client.query('UPDATE submissions SET score=$1,feedback=$2,graded_at=CURRENT_TIMESTAMP WHERE id=$3',[score,feedback,submissionId]);
      await client.query('COMMIT');
    } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const sub = (await db.query('SELECT s.student_id,a.title,a.max_score FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=$1',[submissionId])).rows[0];
    if (sub) await notifyStudent(db,sub.student_id,`Bài tập "${sub.title}" đã được chấm: ${score}/${sub.max_score}. ${feedback}`,{relatedEntityType:'submission',relatedEntityId:submissionId});
    return { id:submissionId,score,feedback };
  },
  async update(db: Queryable, id: string, input: Partial<Omit<Assignment,'id'|'courseId'>>) {
    const map: Record<string,string> = {title:'title',description:'description',deadline:'deadline',maxScore:'max_score',attachmentUrl:'attachment_url',lessonId:'lesson_id',sessionId:'session_id',type:'type',allowLate:'allow_late'};
    const entries = Object.entries(input).filter(([key,value]) => map[key] && value !== undefined);
    if (entries.length) await db.query(`UPDATE assignments SET ${entries.map(([key],i)=>`${map[key]}=$${i+1}`).join(',')} WHERE id=$${entries.length+1}`,[...entries.map(([,value])=>value),id]);
    const row = (await db.query('SELECT * FROM assignments WHERE id=$1',[id])).rows[0];
    return row ? assignmentFromRow(row) : null;
  },
  async delete(db: Queryable,id:string) { await db.query('DELETE FROM assignments WHERE id=$1',[id]); return {id}; }
};
