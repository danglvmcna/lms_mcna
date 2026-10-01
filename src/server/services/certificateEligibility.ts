import crypto from 'crypto';
import { pool, Queryable } from '../db';
import { certificateDecision } from '../../operationRules';
import { generateId } from '../ids';
import { enqueueCertificateIssuedEvent, enqueueCourseCompletedEvent } from '../crm/crmOutbox';
import { invalidateStoreCache } from '../repositories/storeSnapshot';

export async function getCertificateEligibility(db: Queryable, enrollmentId: string, sectionId?: string) {
  const row = (await db.query(`SELECT e.*,cs.id section_id,cs.number_of_sessions,cs.status section_status
    FROM enrollments e JOIN course_registrations cr ON cr.student_id=e.student_id AND cr.status='registered'
    JOIN course_sections cs ON cs.id=cr.section_id AND cs.course_id=e.course_id
    WHERE e.id=$1 AND ($2::text IS NULL OR cs.id=$2) ORDER BY cr.registered_at DESC LIMIT 1`,[enrollmentId,sectionId || null])).rows[0];
  if (!row || !['active','completed'].includes(row.status)) return {eligible:false,reasons:['Học viên chưa được xếp lớp.'],sectionId:null};
  const sessions = (await db.query('SELECT id,date,taught_at,taught_minutes FROM attendance_sessions WHERE section_id=$1',[row.section_id])).rows;
  const settings = (await db.query("SELECT value FROM operation_settings WHERE id='rules'")).rows[0]?.value || {};
  const absent = settings.absentStatuses || ['absent'];
  const records = (await db.query('SELECT session_id,status FROM attendance_records WHERE student_id=$1 AND session_id=ANY($2::text[])',[row.student_id,sessions.map(s=>s.id)])).rows;
  const unique = new Map(records.map(r=>[r.session_id,r.status]));
  const finalSubmitted = Boolean((await db.query(`SELECT 1 FROM submissions sub JOIN assignments a ON a.id=sub.assignment_id
    JOIN attendance_sessions s ON s.id=a.session_id WHERE sub.student_id=$1 AND s.section_id=$2 AND a.type='final' LIMIT 1`,[row.student_id,row.section_id])).rowCount);
  const ended = row.section_status !== 'cancelled' && sessions.length > 0 && sessions.every(s=>s.taught_at && new Date(s.date).getTime() + Number(s.taught_minutes || 0)*60_000 <= Date.now());
  const decision = certificateDecision({ expected:Number(row.number_of_sessions || 0),sessions:sessions.length,recorded:unique.size,ended,absences:[...unique.values()].filter(v=>absent.includes(v)).length,finalSubmitted });
  return {...decision,sectionId:row.section_id,absences:[...unique.values()].filter(v=>absent.includes(v)).length};
}

/** Triggered by attendance, final submission and explicit reconciliation. Enrollment row locks prevent duplicates. */
export async function autoIssueCertificates(_db: Queryable, sectionId: string) {
  const enrolled = (await pool.query(`SELECT e.id FROM enrollments e JOIN course_sections cs ON cs.course_id=e.course_id
    JOIN course_registrations cr ON cr.section_id=cs.id AND cr.student_id=e.student_id AND cr.status='registered'
    WHERE cs.id=$1 AND e.status='active'`,[sectionId])).rows;
  let issued=0;
  for (const item of enrolled) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const enrollment=(await client.query('SELECT * FROM enrollments WHERE id=$1 FOR UPDATE',[item.id])).rows[0];
      const existing=(await client.query('SELECT 1 FROM certificates WHERE student_id=$1 AND course_id=$2',[enrollment.student_id,enrollment.course_id])).rowCount;
      const decision=await getCertificateEligibility(client,item.id,sectionId);
      if (!existing && decision.eligible && enrollment.status==='active') {
        const id=generateId('cert'), code=crypto.randomBytes(5).toString('hex').toUpperCase();
        await client.query('INSERT INTO certificates(id,enrollment_id,student_id,course_id,issued_at,certificate_code,section_id) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP,$5,$6)',[id,item.id,enrollment.student_id,enrollment.course_id,code,sectionId]);
        await client.query("UPDATE enrollments SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=$1",[item.id]);
        await enqueueCourseCompletedEvent(client,item.id);
        await enqueueCertificateIssuedEvent(client,id);
        await client.query("INSERT INTO notifications(id,user_id,type,message,is_read,created_at,related_entity_type,related_entity_id) VALUES($1,$2,'success',$3,false,CURRENT_TIMESTAMP,'course',$4)",[generateId('noti'),enrollment.student_id,`Bạn đã được cấp chứng chỉ. Mã xác minh: ${code}.`,enrollment.course_id]);
        issued++;
      }
      await client.query('COMMIT');
    } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
  }
  if (issued) invalidateStoreCache();
  return {issued};
}
