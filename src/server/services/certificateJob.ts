import {pool} from '../db';
import {isDirectSale} from '../config';
import {autoIssueCertificates} from './certificateEligibility';

/** Catch classes whose last session ended after attendance was recorded. Safe to rerun. */
export async function runCertificateJob() {
  if(!isDirectSale())return {issued:0,checked:0};
  const cursor=(await pool.query("SELECT value FROM operation_settings WHERE id='certificate-job-cursor'")).rows[0]?.value?.lastId || '';
  // Rotate through bounded batches: ineligible classes must not starve later classes forever.
  const classes=(await pool.query(`SELECT candidates.id FROM (SELECT DISTINCT cs.id FROM course_sections cs
    JOIN course_registrations cr ON cr.section_id=cs.id AND cr.status='registered'
    JOIN enrollments e ON e.student_id=cr.student_id AND e.course_id=cs.course_id AND e.status='active'
    WHERE cs.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM certificates cert WHERE cert.enrollment_id=e.id)
      AND EXISTS(SELECT 1 FROM attendance_sessions s WHERE s.section_id=cs.id)
      AND NOT EXISTS(SELECT 1 FROM attendance_sessions s WHERE s.section_id=cs.id AND
        (s.taught_at IS NULL OR s.date::timestamptz + COALESCE(s.taught_minutes,0)*interval '1 minute'>CURRENT_TIMESTAMP))
    ) candidates ORDER BY (candidates.id > $1) DESC,candidates.id LIMIT 25`,[cursor])).rows;
  let issued=0;
  for(const cs of classes)issued+=(await autoIssueCertificates(pool,cs.id)).issued;
  if(classes.length)await pool.query(`INSERT INTO operation_settings(id,value) VALUES('certificate-job-cursor',$1::jsonb)
    ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,updated_at=CURRENT_TIMESTAMP`,[JSON.stringify({lastId:classes[classes.length-1].id})]);
  return {issued,checked:classes.length};
}
