import path from 'path';
import { Queryable } from '../db';
import { User } from '../../types';
import { allowHomeworkDownload } from '../config';

export async function validateAttachmentOwner(db: Queryable, user: User, url?: string | null) {
  if (!url) return;
  if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(url)) throw Object.assign(new Error('Chỉ nhận tệp tải lên LMS.'), { status: 400 });
  const upload = (await db.query('SELECT owner_id FROM private_uploads WHERE filename=$1', [url.slice('/uploads/'.length)])).rows[0];
  if (!upload || upload.owner_id !== user.id) throw Object.assign(new Error('Tệp không thuộc tài khoản của bạn.'), { status: 403 });
}

export async function uploadAccess(db: Queryable, user: User, filename: string, viewer: boolean) {
  const url = `/uploads/${filename}`;
  const upload = (await db.query('SELECT owner_id FROM private_uploads WHERE filename=$1', [filename])).rows[0];
  if (user.role === 'admin' || user.role === 'manager' || (upload?.owner_id === user.id && user.role === 'teacher')) return { allowed: true, viewOnly: false };
  const associations = (await db.query(`
    SELECT a.course_id, a.session_id, NULL::text student_id, 'brief' kind FROM assignments a WHERE a.attachment_url=$1
    UNION ALL
    SELECT a.course_id, a.session_id, sub.student_id, 'submission' kind FROM submissions sub JOIN assignments a ON a.id=sub.assignment_id WHERE sub.attachment_url=$1
    UNION ALL
    SELECT s.course_id, s.id, NULL::text, CASE WHEN sol.published THEN 'solution' ELSE 'hidden' END FROM session_solutions sol JOIN attendance_sessions s ON s.id=sol.session_id WHERE sol.attachment_url=$1
    UNION ALL
    SELECT a.course_id, a.session_id, sub.student_id, 'submission' FROM submission_versions v JOIN submissions sub ON sub.id=v.submission_id JOIN assignments a ON a.id=sub.assignment_id WHERE v.attachment_url=$1`, [url])).rows;
  for (const item of associations) {
    const session = item.session_id ? (await db.query('SELECT section_id FROM attendance_sessions WHERE id=$1', [item.session_id])).rows[0] : null;
    if (user.role === 'teacher') {
      const assigned = (await db.query(`SELECT 1 FROM course_sections WHERE id=$1 AND teacher_id=$2`, [session?.section_id, user.id])).rowCount;
      if (assigned) return { allowed: true, viewOnly: false };
    }
    if (user.role !== 'student' || item.kind === 'hidden' || (item.student_id && item.student_id !== user.id)) continue;
    const placed = (await db.query(`SELECT 1 FROM enrollments e JOIN course_registrations cr ON cr.student_id=e.student_id JOIN course_sections cs ON cs.id=cr.section_id AND cs.course_id=e.course_id
      WHERE e.student_id=$1 AND e.course_id=$2 AND e.status IN ('active','completed') AND cr.status='registered' AND ($3::text IS NULL OR cs.id=$3) LIMIT 1`, [user.id,item.course_id,session?.section_id || null])).rowCount;
    if (!placed) continue;
    if (item.kind === 'submission' || allowHomeworkDownload()) return { allowed: true, viewOnly: false };
    if (viewer && /\.(pdf|png|jpe?g|webp|gif)$/i.test(path.extname(filename))) return { allowed: true, viewOnly: true };
  }
  if (user.role === 'student' && upload?.owner_id === user.id && !associations.length) return { allowed: true, viewOnly: false };
  return { allowed: false, viewOnly: false, reason: 'Không có quyền tải tệp này. Đề bài/lời giải chỉ xem trực tuyến trên LMS.' };
}
