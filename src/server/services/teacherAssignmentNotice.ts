import crypto from 'crypto';
import {pool} from '../db';
import {generateId} from '../ids';
import {parseSchedule} from '../mappers';
import {formatScheduleSummary} from '../../scheduleText';
import {getSupportPhone} from '../config';
import {dispatchEmail} from './email';
import {escapeHtml} from '../emailProvisioning/emailWorker';

export async function sendTeacherAssignmentNotice(sectionId:string,force=false) {
  const db=await pool.connect();let row:any, noticeKey='';
  try {
    await db.query('BEGIN');
    row=(await db.query(`SELECT cs.*,c.title course_title,u.name teacher_name,u.email teacher_email FROM course_sections cs
      JOIN courses c ON c.id=cs.course_id JOIN users u ON u.id=cs.teacher_id AND u.role='teacher' AND u.is_active=true WHERE cs.id=$1 FOR UPDATE OF cs`,[sectionId])).rows[0];
    if(!row){await db.query('ROLLBACK');return {status:'skipped'};}
    noticeKey=crypto.createHash('sha256').update(JSON.stringify([row.teacher_id,row.section_code,row.opening_date,parseSchedule(row),row.group_chat_url,row.meeting_url])).digest('hex');
    if(!force && row.assignment_notice_key===noticeKey){await db.query('ROLLBACK');return {status:row.assignment_email_status};}
    await db.query("UPDATE course_sections SET assignment_notice_key=$1,assignment_email_status='sending' WHERE id=$2",[noticeKey,sectionId]);
    const message=`Bạn được phân công lớp ${row.section_code} — ${row.course_title}.\nLịch: ${formatScheduleSummary(parseSchedule(row))}.\nKhai giảng: ${row.opening_date || 'Chưa cập nhật'}.\nNhóm Zalo: ${row.group_chat_url || 'Chưa cập nhật'}.\nPhòng học: ${row.meeting_url || 'Chưa cập nhật'}.\nHỗ trợ: ${getSupportPhone()}.`;
    if(row.assignment_notice_key!==noticeKey) await db.query("INSERT INTO notifications(id,user_id,type,message,is_read,created_at,related_entity_type,related_entity_id) VALUES($1,$2,'info',$3,false,CURRENT_TIMESTAMP,'section',$4)",[generateId('noti'),row.teacher_id,message,sectionId]);
    await db.query('COMMIT');
    const status=await dispatchEmail(row.teacher_email,row.teacher_name,`[MCNA] Phân công giảng dạy lớp ${row.section_code}`,`<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(message)}</div>`,message);
    await pool.query('UPDATE course_sections SET assignment_email_status=$1 WHERE id=$2 AND assignment_notice_key=$3',[status,sectionId,noticeKey]);
    return {status};
  } catch(error) {
    await db.query('ROLLBACK').catch(()=>undefined);
    await pool.query("UPDATE course_sections SET assignment_email_status='failed' WHERE id=$1 AND assignment_notice_key=$2",[sectionId,noticeKey]).catch(()=>undefined);
    console.error('[teacher-assignment-notice]',error);return {status:'failed'};
  } finally {db.release();}
}
