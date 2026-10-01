import express from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { User } from '../types';
import { generateId } from './ids';
import { getDefaultStudentPassword, getSupportPhone } from './config';
import { enqueueCrmEvent } from './crm/crmOutbox';
import { autoIssueCertificates, getCertificateEligibility } from './services/certificateEligibility';
import { validateAttachmentOwner } from './services/uploadAccess';
import { commissionSnapshot, teacherTier, voucherDiscount } from '../operationRules';
import { sendTeacherAssignmentNotice } from './services/teacherAssignmentNotice';

type Request = express.Request & { user?: User };
type Dependencies = { pool: Pool; requireAuth: express.RequestHandler; invalidateStoreCache:()=>void;
  audit:(req:Request,action:string,target:string,detail:string)=>Promise<void>;
  createUserAccount:(db:any,input:any,password:string)=>Promise<User> };
const id=z.string().trim().min(1).max(200);
const key=z.string().trim().min(8).max(200);
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const staff=['admin','manager'];
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status});};
const body=<T>(schema:z.ZodType<T>, req:Request):T=>{
  const parsed=schema.safeParse(req.body);
  if(!parsed.success) fail(parsed.error.issues.map(i=>i.message).join(' '));
  return parsed.data;
};

export function registerOperationsRoutes(app:express.Express, deps:Dependencies) {
  const {pool,requireAuth,invalidateStoreCache,audit,createUserAccount}=deps;
  const transaction=async<T>(fn:(db:PoolClient)=>Promise<T>)=>{
    const db=await pool.connect();
    try {await db.query('BEGIN');const value=await fn(db);await db.query('COMMIT');invalidateStoreCache();return value;}
    catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  };
  const monthLock=async(db:PoolClient,teacherId:string,monthValue:string)=>db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`teaching:${teacherId}:${monthValue}`]);
  const add=(method:'get'|'post'|'put'|'patch',route:string,roles:string[],fn:(req:Request)=>Promise<any>)=>{
    app[method](`/api/operations${route}`,requireAuth,(req:Request,res,next)=>{
      if(!req.user || !roles.includes(req.user.role)) return res.status(403).json({error:'Không có quyền thực hiện.'});
      fn(req).then(value=>res.json(value)).catch(next);
    });
  };
  const settings=async(db=pool as any)=>(await db.query("SELECT value FROM operation_settings WHERE id='rules'")).rows[0].value;
  const sales=async(req:Request)=>{
    if(req.user!.role==='admin') return;
    if(!(await pool.query('SELECT 1 FROM users WHERE id=$1 AND can_manage_sales=true',[req.user!.id])).rowCount) fail('Chưa được cấp quyền tư vấn/voucher.',403);
  };
  const section=async(req:Request,sectionId:string,db=pool as any)=>{
    const row=(await db.query('SELECT * FROM course_sections WHERE id=$1',[sectionId])).rows[0];
    if(!row) fail('Không tìm thấy lớp.',404);
    if(req.user!.role==='teacher' && row.teacher_id!==req.user!.id) fail('Bạn không phụ trách lớp này.',403);
    return row;
  };
  const session=async(req:Request,sessionId:string,db=pool as any)=>{
    const row=(await db.query('SELECT * FROM attendance_sessions WHERE id=$1',[sessionId])).rows[0];
    if(!row?.section_id) fail('Buổi học phải thuộc một lớp.',404);
    await section(req,row.section_id,db);return row;
  };

  add('get','/settings',staff,async()=>settings());
  add('put','/settings',['admin'],async req=>{
    const rules=body(z.object({absentStatuses:z.array(z.enum(['absent','late','excused'])).min(1),
      tierRules:z.array(z.object({label:z.string().trim().min(1).max(40),courses:z.number().int().min(0)})).max(50),
      commissionStart:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v).nullable(),
      bankBin:z.string().regex(/^([0-9]{6})?$/),bankAccount:z.string().regex(/^([0-9]{5,30})?$/),bankName:z.string().trim().max(120)}).strict(),req);
    if(new Set(rules.tierRules.map(r=>r.courses)).size!==rules.tierRules.length) fail('Mỗi bậc phải có mốc số khóa riêng.');
    await pool.query("UPDATE operation_settings SET value=$1,updated_by=$2,updated_at=CURRENT_TIMESTAMP WHERE id='rules'",[JSON.stringify(rules),req.user!.id]);
    await audit(req,'update_operation_settings','rules','Cập nhật quy tắc vận hành');return {ok:true};
  });
  add('get','/teachers',staff,async()=>{
    return (await pool.query(`SELECT u.id,u.name,u.email,u.phone,u.is_active,COALESCE(array_agg(ts.course_id) FILTER(WHERE ts.course_id IS NOT NULL),'{}') course_ids
      FROM users u LEFT JOIN teacher_subjects ts ON ts.teacher_id=u.id WHERE u.role='teacher' GROUP BY u.id ORDER BY u.name`)).rows;
  });
  add('post','/sections/:id/teacher-notice',staff,async req=>{
    await section(req,req.params.id);await audit(req,'resend_teacher_notice',req.params.id,'Gửi lại email phân lớp');return sendTeacherAssignmentNotice(req.params.id,true);
  });
  add('post','/teachers',staff,async req=>{
    const input=body(z.object({name:z.string().trim().min(2).max(160),email:z.email().trim().toLowerCase(),phone:z.string().trim().max(30).optional(),password:z.string().min(8).optional(),courseIds:z.array(id).max(100)}).strict(),req);
    const password=input.password || getDefaultStudentPassword();
    if(!password) fail('Cấu hình mật khẩu mặc định hoặc nhập mật khẩu ban đầu (ít nhất 8 ký tự).');
    const teacher=await transaction(async db=>{
      const created=await createUserAccount(db,{...input,role:'teacher'},password);
      await db.query('UPDATE users SET must_change_password=true WHERE id=$1',[created.id]);
      for(const courseId of new Set(input.courseIds)) await db.query('INSERT INTO teacher_subjects(teacher_id,course_id) VALUES($1,$2)',[created.id,courseId]);
      return {id:created.id,name:created.name,email:created.email};
    });
    await audit(req,'create_teacher',teacher.id,teacher.email);return teacher;
  });
  add('put','/teachers/:id/subjects',staff,async req=>{
    const input=body(z.object({courseIds:z.array(id).max(100)}).strict(),req);
    await transaction(async db=>{
      if(!(await db.query("SELECT 1 FROM users WHERE id=$1 AND role='teacher' FOR UPDATE",[req.params.id])).rowCount) fail('Không phải tài khoản giảng viên.',404);
      await db.query('DELETE FROM teacher_subjects WHERE teacher_id=$1',[req.params.id]);
      for(const courseId of new Set(input.courseIds)) await db.query('INSERT INTO teacher_subjects(teacher_id,course_id) VALUES($1,$2)',[req.params.id,courseId]);
    });
    await audit(req,'update_teacher_subjects',req.params.id,input.courseIds.join(','));return {ok:true};
  });
  add('patch','/sales-permissions/:id',['admin'],async req=>{
    const input=body(z.object({enabled:z.boolean()}).strict(),req);
    const result=await pool.query("UPDATE users SET can_manage_sales=$1 WHERE id=$2 AND role='manager' RETURNING id",[input.enabled,req.params.id]);
    if(!result.rowCount) fail('Chỉ cấp quyền này cho tài khoản Quản lý lớp.',400);
    await audit(req,'sales_permission',req.params.id,String(input.enabled));return {ok:true};
  });
  add('get','/sessions/:id', [...staff,'teacher'],async req=>{
    const s=await session(req,req.params.id);
    const roster=(await pool.query("SELECT u.id,u.name,u.email FROM users u JOIN course_registrations cr ON cr.student_id=u.id WHERE cr.section_id=$1 AND cr.status='registered' ORDER BY u.name",[s.section_id])).rows;
    const records=(await pool.query('SELECT * FROM attendance_records WHERE session_id=$1',[s.id])).rows;
    const submissions=(await pool.query(`SELECT sub.*,a.title assignment_title,a.max_score,u.name student_name FROM submissions sub
      JOIN assignments a ON a.id=sub.assignment_id JOIN users u ON u.id=sub.student_id WHERE a.session_id=$1 ORDER BY sub.submitted_at DESC`,[s.id])).rows;
    return {session:s,roster,records,submissions};
  });
  add('put','/sessions/:id/attendance',[...staff,'teacher'],async req=>{
    const input=body(z.object({records:z.array(z.object({studentId:id,status:z.enum(['present','absent','late','excused']),note:z.string().trim().max(1000).default('')})).max(500),
      complete:z.boolean().default(false),minutes:z.number().int().min(1).max(1440).optional()}).strict(),req);
    if(new Set(input.records.map(r=>r.studentId)).size!==input.records.length) fail('Danh sách có học viên trùng.');
    const s=await transaction(async db=>{
      await db.query('SELECT id FROM attendance_sessions WHERE id=$1 FOR UPDATE',[req.params.id]);
      const s=await session(req,req.params.id,db);
      const monthValue=new Date(s.date).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
      await monthLock(db,s.teacher_id,monthValue);
      if(new Date(s.date).getTime()>Date.now()) fail('Không điểm danh hoặc xác nhận buổi học tương lai.');
      const roster=(await db.query("SELECT student_id FROM course_registrations WHERE section_id=$1 AND status='registered'",[s.section_id])).rows.map(r=>r.student_id);
      for(const record of input.records) {
        if(!roster.includes(record.studentId)) fail('Có học viên không thuộc lớp.');
        const updated=await db.query('UPDATE attendance_records SET status=$1,note=$2,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE session_id=$4 AND student_id=$5',[record.status,record.note,req.user!.id,s.id,record.studentId]);
        if(!updated.rowCount) await db.query(`INSERT INTO attendance_records(id,session_id,student_id,status,note,updated_by,updated_at,checkin_method) VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,'manual')`,[generateId('atr'),s.id,record.studentId,record.status,record.note,req.user!.id]);
      }
      if(input.complete) {
        if(!input.minutes || roster.some(studentId=>!input.records.some(r=>r.studentId===studentId))) fail('Nhập thời lượng thực tế và điểm danh đủ học viên trước khi xác nhận.');
        await db.query('UPDATE attendance_sessions SET taught_at=CURRENT_TIMESTAMP,taught_minutes=$1,taught_by=$2 WHERE id=$3',[input.minutes,req.user!.id,s.id]);
        // A changed actual session invalidates previously confirmed totals, including an approved month.
        await db.query("UPDATE teaching_months SET status='revision',note='Buổi dạy thực tế đã thay đổi; cần xác nhận lại.',updated_at=CURRENT_TIMESTAMP WHERE teacher_id=$1 AND month=to_char($2::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM')",[s.teacher_id,s.date]);
      }
      return s;
    });
    await audit(req,'mark_session_attendance',s.id,`${input.records.length} học viên; đã dạy=${input.complete}`);
    const certificates=await autoIssueCertificates(pool,s.section_id);return {ok:true,...certificates};
  });
  add('get','/submissions/:id/history',[...staff,'teacher','student'],async req=>{
    const sub=(await pool.query('SELECT sub.*,a.session_id FROM submissions sub JOIN assignments a ON a.id=sub.assignment_id WHERE sub.id=$1',[req.params.id])).rows[0];
    if(!sub) fail('Không tìm thấy bài nộp.',404);
    if(req.user!.role==='student') {if(sub.student_id!==req.user!.id) fail('Không có quyền.',403);}
    else await session(req,sub.session_id);
    return (await pool.query('SELECT * FROM submission_versions WHERE submission_id=$1 ORDER BY submitted_at DESC',[sub.id])).rows;
  });
  add('get','/sessions/:id/solution',[...staff,'teacher','student'],async req=>{
    if(req.user!.role==='student') {
      const access=(await pool.query(`SELECT 1 FROM attendance_sessions s JOIN course_registrations cr ON cr.section_id=s.section_id AND cr.status='registered'
        JOIN enrollments e ON e.student_id=cr.student_id AND e.course_id=s.course_id AND e.status IN ('active','completed') WHERE s.id=$1 AND cr.student_id=$2`,[req.params.id,req.user!.id])).rowCount;
      if(!access) fail('Không có quyền.',403);
    } else await session(req,req.params.id);
    return (await pool.query(`SELECT * FROM session_solutions WHERE session_id=$1 AND ($2::boolean OR published=true)`,[req.params.id,req.user!.role!=='student'])).rows[0] || null;
  });
  add('put','/sessions/:id/solution',[...staff,'teacher'],async req=>{
    await session(req,req.params.id);
    const input=body(z.object({content:z.string().max(20000),attachmentUrl:z.string().nullable().optional(),published:z.boolean()}).strict(),req);
    const existing=(await pool.query('SELECT attachment_url FROM session_solutions WHERE session_id=$1',[req.params.id])).rows[0];
    if(input.attachmentUrl && input.attachmentUrl!==existing?.attachment_url) await validateAttachmentOwner(pool,req.user!,input.attachmentUrl);
    await pool.query(`INSERT INTO session_solutions(session_id,content,attachment_url,published,updated_by) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(session_id) DO UPDATE SET content=EXCLUDED.content,attachment_url=EXCLUDED.attachment_url,published=EXCLUDED.published,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP`,[req.params.id,input.content,input.attachmentUrl || null,input.published,req.user!.id]);
    await audit(req,'update_solution',req.params.id,`công bố=${input.published}`);return {ok:true};
  });
  add('get','/sections/:id/certificates',staff,async req=>{
    const cs=await section(req,req.params.id);
    const list=(await pool.query(`SELECT e.id enrollment_id,u.name,u.email FROM enrollments e JOIN users u ON u.id=e.student_id
      JOIN course_registrations cr ON cr.student_id=e.student_id WHERE e.course_id=$1 AND cr.section_id=$2 AND cr.status='registered'`,[cs.course_id,cs.id])).rows;
    return Promise.all(list.map(async row=>({...row,...await getCertificateEligibility(pool,row.enrollment_id,cs.id),certificate:(await pool.query('SELECT certificate_code FROM certificates WHERE enrollment_id=$1',[row.enrollment_id])).rows[0] || null})));
  });
  add('post','/sections/:id/certificates/reconcile',staff,async req=>{
    await section(req,req.params.id);const result=await autoIssueCertificates(pool,req.params.id);await audit(req,'reconcile_certificates',req.params.id,JSON.stringify(result));return result;
  });
  add('get','/my-certificates',['student'],async req=>
    (await pool.query('SELECT cert.*,c.title course_title,u.name student_name FROM certificates cert JOIN courses c ON c.id=cert.course_id JOIN users u ON u.id=cert.student_id WHERE cert.student_id=$1 ORDER BY issued_at DESC',[req.user!.id])).rows);

  const teachingSnapshot=async(teacherId:string,m:string,db=pool as any)=>{
    const rows=(await db.query(`SELECT s.id,s.topic,s.date,s.taught_minutes,cs.section_code,c.title course_title FROM attendance_sessions s
      JOIN course_sections cs ON cs.id=s.section_id JOIN courses c ON c.id=s.course_id
      WHERE s.teacher_id=$1 AND s.taught_at IS NOT NULL AND to_char(s.date::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM')=$2 ORDER BY s.date`,[teacherId,m])).rows;
    return {sessions:rows,totalMinutes:rows.reduce((sum,row)=>sum+Number(row.taught_minutes || 0),0)};
  };
  add('get','/teaching',[...staff,'teacher'],async req=>{
    const parsed=month.safeParse(req.query.month || new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7));if(!parsed.success)fail('Tháng không hợp lệ.');const m=parsed.data;
    const teacherId=req.user!.role==='teacher' ? req.user!.id : String(req.query.teacherId || req.user!.id);
    const snapshot=await teachingSnapshot(teacherId,m);
    const courses=Number((await pool.query(`SELECT COUNT(DISTINCT cs.id)::int count FROM course_sections cs WHERE cs.status<>'cancelled'
      AND EXISTS(SELECT 1 FROM attendance_sessions own WHERE own.section_id=cs.id AND own.teacher_id=$1 AND own.taught_at IS NOT NULL)
      AND EXISTS(SELECT 1 FROM attendance_sessions s WHERE s.section_id=cs.id)
      AND (SELECT COUNT(*) FROM attendance_sessions s WHERE s.section_id=cs.id AND s.taught_at IS NOT NULL)>=COALESCE(cs.number_of_sessions,1)`,[teacherId])).rows[0].count);
    const totalMinutes=Number((await pool.query('SELECT COALESCE(SUM(taught_minutes),0)::int count FROM attendance_sessions WHERE teacher_id=$1 AND taught_at IS NOT NULL',[teacherId])).rows[0].count);
    return {...snapshot,monthlyMinutes:snapshot.totalMinutes,teacherId,month:m,totalMinutes,courses,tier:teacherTier(courses,(await settings()).tierRules || []),confirmation:(await pool.query('SELECT * FROM teaching_months WHERE teacher_id=$1 AND month=$2',[teacherId,m])).rows[0] || null};
  });
  add('post','/teaching/confirm',['teacher'],async req=>{
    const input=body(z.object({month,note:z.string().max(2000).default('')}).strict(),req);
    const currentMonth=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
    if(input.month>=currentMonth) fail('Chỉ xác nhận tháng đã kết thúc.');
    await transaction(async db=>{
    await monthLock(db,req.user!.id,input.month);
    const snapshot=await teachingSnapshot(req.user!.id,input.month,db);
    if(!snapshot.sessions.length) fail('Tháng này chưa có buổi dạy thực tế.');
    const changed=await db.query(`INSERT INTO teaching_months(teacher_id,month,status,snapshot,note) VALUES($1,$2,'submitted',$3,$4)
      ON CONFLICT(teacher_id,month) DO UPDATE SET status='submitted',snapshot=EXCLUDED.snapshot,note=EXCLUDED.note,reviewed_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE teaching_months.status<>'approved'`,[req.user!.id,input.month,JSON.stringify(snapshot),input.note]);
    if(!changed.rowCount)fail('Tháng đã được duyệt.',409);
    });
    await audit(req,'confirm_teaching_month',req.user!.id,input.month);return {ok:true};
  });
  add('post','/teaching/review',staff,async req=>{
    const input=body(z.object({teacherId:id,month,status:z.enum(['approved','revision']),note:z.string().trim().max(2000).default('')}).strict(),req);
    await transaction(async db=>{
      await monthLock(db,input.teacherId,input.month);
      const claim=(await db.query('SELECT * FROM teaching_months WHERE teacher_id=$1 AND month=$2 FOR UPDATE',[input.teacherId,input.month])).rows[0];
      if(!claim || claim.status!=='submitted') fail('Giảng viên chưa gửi xác nhận tháng này.');
      const actual=await teachingSnapshot(input.teacherId,input.month,db);
      const fingerprint=(snapshot:any)=>JSON.stringify(snapshot.sessions.map((s:any)=>[s.id,new Date(s.date).toISOString(),Number(s.taught_minutes)]).sort((a:any,b:any)=>String(a[0]).localeCompare(String(b[0]))));
      if(fingerprint(claim.snapshot)!==fingerprint(actual)) fail('Buổi dạy đã thay đổi, giảng viên cần xác nhận lại.');
      await db.query('UPDATE teaching_months SET status=$1,note=$2,reviewed_by=$3,updated_at=CURRENT_TIMESTAMP WHERE teacher_id=$4 AND month=$5',[input.status,input.note,req.user!.id,input.teacherId,input.month]);
    });
    await audit(req,'review_teaching_month',input.teacherId,`${input.month}: ${input.status}`);return {ok:true};
  });

  // Templates contain references to private storage, not public signed download URLs.
  add('get','/templates',[...staff,'teacher'],async req=>{
    if(req.user!.role!=='teacher') return (await pool.query('SELECT id,course_id,title,created_at FROM lesson_plan_templates ORDER BY created_at DESC')).rows;
    return (await pool.query(`SELECT t.id,t.course_id,t.title,t.created_at FROM lesson_plan_templates t WHERE EXISTS(SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id=$1 AND ts.course_id=t.course_id)
      OR EXISTS(SELECT 1 FROM course_sections cs WHERE cs.teacher_id=$1 AND cs.course_id=t.course_id)`,[req.user!.id])).rows;
  });
  add('post','/templates',staff,async req=>{
    const input=body(z.object({sectionId:id,title:z.string().trim().min(2).max(160)}).strict(),req);
    const cs=await section(req,input.sectionId);
    const sessions=(await pool.query('SELECT * FROM attendance_sessions WHERE section_id=$1 ORDER BY date,id',[cs.id])).rows;
    if(!sessions.length) fail('Lớp chưa có buổi học để lưu mẫu.');
    const snapshots=await Promise.all(sessions.map(async s=>({topic:s.topic,content:s.content || '',
      materials:(await pool.query('SELECT * FROM session_materials WHERE session_id=$1',[s.id])).rows,
      assignments:(await pool.query('SELECT * FROM assignments WHERE session_id=$1',[s.id])).rows,
      solution:(await pool.query('SELECT content,attachment_url FROM session_solutions WHERE session_id=$1',[s.id])).rows[0] || null})));
    const templateId=generateId('plan');
    await pool.query('INSERT INTO lesson_plan_templates(id,course_id,title,sessions,created_by) VALUES($1,$2,$3,$4,$5)',[templateId,cs.course_id,input.title,JSON.stringify(snapshots),req.user!.id]);
    await audit(req,'create_plan_template',templateId,input.title);return {id:templateId};
  });
  add('post','/sections/:id/plan',[...staff,'teacher'],async req=>{
    const input=body(z.object({mode:z.enum(['default','custom']),templateId:id.optional()}).strict(),req);
    await transaction(async db=>{
      await db.query('SELECT id FROM course_sections WHERE id=$1 FOR UPDATE',[req.params.id]);
      const cs=await section(req,req.params.id,db);
      if(input.templateId) {
        const template=(await db.query('SELECT * FROM lesson_plan_templates WHERE id=$1 AND course_id=$2',[input.templateId,cs.course_id])).rows[0];
        if(!template) fail('Mẫu không thuộc môn của lớp.');
        const sessions=(await db.query('SELECT * FROM attendance_sessions WHERE section_id=$1 ORDER BY date,id',[cs.id])).rows;
        if(sessions.length!==template.sessions.length) fail('Số buổi lớp và giáo án mẫu không khớp.');
        if((await db.query(`SELECT 1 FROM attendance_sessions s WHERE s.section_id=$1 AND (s.taught_at IS NOT NULL OR EXISTS(SELECT 1 FROM session_materials m WHERE m.session_id=s.id) OR EXISTS(SELECT 1 FROM assignments a WHERE a.session_id=s.id) OR EXISTS(SELECT 1 FROM session_solutions sol WHERE sol.session_id=s.id)) LIMIT 1`,[cs.id])).rowCount) fail('Chỉ áp dụng mẫu vào lớp chưa có tài liệu/bài tập/buổi đã dạy. Không ghi đè dữ liệu hiện có.');
        for(let index=0;index<sessions.length;index++) {
          const target=sessions[index], source=template.sessions[index];
          await db.query('UPDATE attendance_sessions SET topic=$1,content=$2 WHERE id=$3',[source.topic,source.content,target.id]);
          for(const material of source.materials) await db.query(`INSERT INTO session_materials(id,session_id,section_id,course_id,type,title,url,storage_path,file_name,mime_type,size_bytes,sort_order,created_by)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[generateId('mat'),target.id,cs.id,cs.course_id,material.type,material.title,material.url,material.storage_path,material.file_name,material.mime_type,material.size_bytes,material.sort_order,req.user!.id]);
          for(const assignment of source.assignments) {
            const date=new Date(target.date);date.setDate(date.getDate()+7);
            await db.query(`INSERT INTO assignments(id,course_id,session_id,title,description,deadline,max_score,type,allow_late,attachment_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[generateId('assign'),cs.course_id,target.id,assignment.title,assignment.description,date.toISOString(),assignment.max_score,assignment.type,assignment.allow_late,assignment.attachment_url]);
          }
          if(source.solution) await db.query('INSERT INTO session_solutions(session_id,content,attachment_url,published,updated_by) VALUES($1,$2,$3,false,$4)',[target.id,source.solution.content,source.solution.attachment_url,req.user!.id]);
        }
      } else if(input.mode==='default') fail('Chọn bộ giáo án mặc định.');
      await db.query('UPDATE course_sections SET lesson_plan_mode=$1,lesson_plan_template_id=COALESCE($2,lesson_plan_template_id) WHERE id=$3',[input.mode,input.templateId || null,cs.id]);
    });
    await audit(req,'set_class_plan',req.params.id,input.mode);return {ok:true};
  });

  add('post','/consultations',['student'],async req=>{
    const input=body(z.object({courseId:id.optional(),message:z.string().trim().min(2).max(2000),requestKey:key}).strict(),req);
    const request=await transaction(async db=>{
      const row=(await db.query(`INSERT INTO consultation_requests(id,student_id,course_id,message,request_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,request_key) DO NOTHING RETURNING *`,[generateId('lead'),req.user!.id,input.courseId || null,input.message,input.requestKey])).rows[0];
      if(row) await enqueueCrmEvent(db,'consultation.requested',{requestId:row.id,lmsUserId:req.user!.id,courseId:input.courseId || null,message:input.message});
      return row || (await db.query('SELECT * FROM consultation_requests WHERE student_id=$1 AND request_key=$2',[req.user!.id,input.requestKey])).rows[0];
    });return request;
  });
  add('get','/sales',staff,async req=>{
    await sales(req);
    return {consultations:(await pool.query('SELECT r.*,u.name,u.email,u.phone,c.title course_title FROM consultation_requests r JOIN users u ON u.id=r.student_id LEFT JOIN courses c ON c.id=r.course_id ORDER BY r.created_at DESC LIMIT 300')).rows,
      vouchers:(await pool.query('SELECT * FROM vouchers ORDER BY created_at DESC LIMIT 300')).rows,
      orders:(await pool.query('SELECT o.*,u.name,c.title course_title FROM upsell_orders o JOIN users u ON u.id=o.student_id JOIN courses c ON c.id=o.course_id ORDER BY o.created_at DESC LIMIT 300')).rows,
      recommendations:(await pool.query('SELECT * FROM course_recommendations')).rows};
  });
  add('patch','/consultations/:id',staff,async req=>{
    await sales(req);const input=body(z.object({status:z.enum(['new','contacted','closed'])}).strict(),req);
    const row=(await pool.query('UPDATE consultation_requests SET status=$1,assigned_to=$2 WHERE id=$3 RETURNING id',[input.status,req.user!.id,req.params.id])).rows[0];
    if(!row) fail('Không tìm thấy yêu cầu.',404);await audit(req,'update_consultation',row.id,input.status);return row;
  });
  add('post','/vouchers',staff,async req=>{
    await sales(req);const input=body(z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),amount:z.number().int().positive().max(100000000),courseId:id.optional(),studentId:id.optional(),expiresAt:z.iso.datetime({offset:true}),maxUses:z.number().int().min(1).max(10000)}).strict(),req);
    if(Date.parse(input.expiresAt)<=Date.now()) fail('Voucher phải có hạn sử dụng trong tương lai.');
    if(input.studentId && !(await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='student'",[input.studentId])).rowCount) fail('Đối tượng voucher phải là học viên.');
    const row=(await pool.query('INSERT INTO vouchers(id,code,amount,course_id,student_id,expires_at,max_uses,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[generateId('voucher'),input.code,input.amount,input.courseId || null,input.studentId || null,input.expiresAt,input.maxUses,req.user!.id])).rows[0];
    await audit(req,'create_voucher',row.id,input.code);return row;
  });
  add('post','/broadcast',staff,async req=>{
    await sales(req);const input=body(z.object({studentIds:z.array(id).min(1).max(500),message:z.string().trim().min(2).max(2000),voucherId:id.optional(),requestKey:key}).strict(),req);
    let sent=0;
    await transaction(async db=>{
      if(!(await db.query('INSERT INTO operation_dispatches(id,actor_id,request_key) VALUES($1,$2,$3) ON CONFLICT(actor_id,request_key) DO NOTHING RETURNING id',[generateId('dispatch'),req.user!.id,input.requestKey])).rowCount) return;
      const ids=[...new Set(input.studentIds)];
      if((await db.query("SELECT id FROM users WHERE id=ANY($1::text[]) AND role='student' AND is_active=true",[ids])).rowCount!==ids.length) fail('Chỉ gửi tới học viên đang hoạt động.');
      let message=input.message;
      if(input.voucherId){const voucher=(await db.query('SELECT * FROM vouchers WHERE id=$1 AND expires_at>CURRENT_TIMESTAMP',[input.voucherId])).rows[0];
        if(!voucher || (voucher.student_id && ids.some(studentId=>studentId!==voucher.student_id))) fail('Voucher không áp dụng cho toàn bộ người nhận.');
        message+=`\nVoucher ${voucher.code}: giảm ${Number(voucher.amount).toLocaleString('vi-VN')}đ; hết hạn ${new Date(voucher.expires_at).toLocaleDateString('vi-VN')}.`;
      }
      for(const userId of ids) await db.query("INSERT INTO notifications(id,user_id,type,message,is_read,created_at) VALUES($1,$2,'info',$3,false,CURRENT_TIMESTAMP)",[generateId('noti'),userId,message]);
      sent=ids.length;
    });await audit(req,'sales_broadcast',req.user!.id,`${sent} học viên`);return {sent};
  });
  add('put','/recommendations',staff,async req=>{
    await sales(req);const input=body(z.object({sourceCourseId:id,targetCourseIds:z.array(id).max(20)}).strict(),req);
    if(input.targetCourseIds.includes(input.sourceCourseId)) fail('Không gợi ý lại cùng khóa.');
    await transaction(async db=>{await db.query('DELETE FROM course_recommendations WHERE source_course_id=$1',[input.sourceCourseId]);for(const target of new Set(input.targetCourseIds)) await db.query('INSERT INTO course_recommendations(source_course_id,target_course_id) VALUES($1,$2)',[input.sourceCourseId,target]);});return {ok:true};
  });
  add('get','/my-offers',['student'],async req=>{
    const rules=await settings();
    return {courses:(await pool.query(`SELECT DISTINCT c.id,c.title,c.description,c.price FROM courses c JOIN course_recommendations r ON r.target_course_id=c.id
      JOIN enrollments e ON e.course_id=r.source_course_id WHERE e.student_id=$1 AND e.status='completed' AND c.status='published' AND c.price>0
      AND NOT EXISTS(SELECT 1 FROM enrollments owned WHERE owned.course_id=c.id AND owned.student_id=$1 AND owned.status<>'cancelled')`,[req.user!.id])).rows,
      vouchers:(await pool.query(`SELECT v.code,v.amount,v.course_id,v.expires_at FROM vouchers v WHERE (v.student_id IS NULL OR v.student_id=$1) AND v.expires_at>CURRENT_TIMESTAMP
        AND (SELECT COUNT(*) FROM upsell_orders used WHERE used.voucher_id=v.id AND used.status IN ('pending','paid'))<v.max_uses`,[req.user!.id])).rows,
      orders:(await pool.query('SELECT o.id,o.course_id,c.title course_title,o.original_price,o.discount,o.amount,o.status,o.reference,o.created_at FROM upsell_orders o JOIN courses c ON c.id=o.course_id WHERE o.student_id=$1 ORDER BY o.created_at DESC',[req.user!.id])).rows,
      bank:{bin:rules.bankBin,account:rules.bankAccount,name:rules.bankName},supportPhone:getSupportPhone()};
  });
  add('post','/upsell-orders',['student',...staff],async req=>{
    const input=body(z.object({courseId:id,studentId:id.optional(),voucherCode:z.string().trim().toUpperCase().max(40).optional(),requestKey:key}).strict(),req);
    if(req.user!.role!=='student') await sales(req);
    const studentId=req.user!.role==='student' ? req.user!.id : input.studentId;
    if(!studentId) fail('Chọn học viên.');
    const source=req.user!.role==='student'?'self':'sale';
    return transaction(async db=>{
      // Serialize reservations per learner; voucher lock serializes all users of the same voucher.
      if(!(await db.query("SELECT 1 FROM users WHERE id=$1 AND role='student' AND is_active=true FOR UPDATE",[studentId])).rowCount) fail('Học viên không hợp lệ.');
      const previous=(await db.query('SELECT o.*,v.code voucher_code FROM upsell_orders o LEFT JOIN vouchers v ON v.id=o.voucher_id WHERE o.student_id=$1 AND o.request_key=$2',[studentId,input.requestKey])).rows[0];
      if(previous) {
        if(previous.course_id!==input.courseId || previous.source!==source || (previous.voucher_code || '')!==(input.voucherCode || '')) fail('Mã yêu cầu đã dùng cho đơn khác.',409);
        return previous;
      }
      const course=(await db.query("SELECT * FROM courses WHERE id=$1 AND status='published'",[input.courseId])).rows[0];if(!course)fail('Khóa học chưa mở.');
      if((await db.query("SELECT 1 FROM enrollments WHERE student_id=$1 AND course_id=$2 AND status<>'cancelled'",[studentId,input.courseId])).rowCount) fail('Học viên đã đăng ký khóa này.');
      if((await db.query("SELECT 1 FROM upsell_orders WHERE student_id=$1 AND course_id=$2 AND status='pending'",[studentId,input.courseId])).rowCount) fail('Đã có đơn đang chờ xác nhận.');
      if(source==='self' && !(await db.query(`SELECT 1 FROM course_recommendations r JOIN enrollments e ON e.course_id=r.source_course_id WHERE e.student_id=$1 AND e.status='completed' AND r.target_course_id=$2`,[studentId,input.courseId])).rowCount) fail('Khóa này chưa nằm trong gợi ý học tiếp của bạn.',403);
      let voucher:any=null;
      if(input.voucherCode) {
        voucher=(await db.query('SELECT * FROM vouchers WHERE code=$1 FOR UPDATE',[input.voucherCode])).rows[0];
        if(!voucher || new Date(voucher.expires_at).getTime()<=Date.now() || (voucher.course_id && voucher.course_id!==input.courseId) || (voucher.student_id && voucher.student_id!==studentId)) fail('Voucher không hợp lệ hoặc không áp dụng.');
        const used=Number((await db.query("SELECT COUNT(*)::int count FROM upsell_orders WHERE voucher_id=$1 AND status IN ('pending','paid')",[voucher.id])).rows[0].count);
        if(used>=voucher.max_uses) fail('Voucher đã hết lượt sử dụng.');
      }
      const price=voucherDiscount(Number(course.price),Number(voucher?.amount || 0));
      const policy=commissionSnapshot(source,(await settings(db)).commissionStart);
      const order=(await db.query(`INSERT INTO upsell_orders(id,student_id,course_id,voucher_id,original_price,discount,amount,source,commission_rate,policy,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[generateId('upsell'),studentId,input.courseId,voucher?.id || null,price.originalPrice,price.discount,price.amount,source,policy.rate,JSON.stringify(policy),input.requestKey])).rows[0];
      await enqueueCrmEvent(db,'upsell.requested',{orderId:order.id,lmsUserId:studentId,courseId:input.courseId,amount:price.amount,source,policy});return order;
    });
  });
  add('post','/upsell-orders/:id/confirm',staff,async req=>{
    await sales(req);const input=body(z.object({amount:z.number().int().nonnegative(),reference:z.string().trim().min(3).max(200)}).strict(),req);
    const result=await transaction(async db=>{
      const order=(await db.query('SELECT * FROM upsell_orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!order) fail('Không tìm thấy đơn.',404);
      if(order.status==='paid') {
        if(input.amount!==Number(order.amount) || input.reference!==order.reference) fail('Đơn đã xác nhận với số tiền/mã đối soát khác.',409);
        return order;
      }
      if(order.status!=='pending' || input.amount!==Number(order.amount)) fail('Trạng thái hoặc số tiền không khớp.');
      const learner=(await db.query("SELECT id FROM users WHERE id=$1 AND role='student' FOR UPDATE",[order.student_id])).rows[0];if(!learner)fail('Không tìm thấy học viên.');
      let enrollment=(await db.query('SELECT * FROM enrollments WHERE student_id=$1 AND course_id=$2 FOR UPDATE',[order.student_id,order.course_id])).rows[0];
      if(enrollment && !['cancelled','pending_payment','pending'].includes(enrollment.status)) fail('Khóa học đã được kích hoạt ngoài đơn này; cần đối soát.');
      if(!enrollment) enrollment=(await db.query("INSERT INTO enrollments(id,student_id,course_id,status,enrolled_at) VALUES($1,$2,$3,'pending',CURRENT_TIMESTAMP) RETURNING *",[generateId('enroll'),order.student_id,order.course_id])).rows[0];
      else await db.query("UPDATE enrollments SET status='pending',completed_at=NULL,requested_section_id=NULL WHERE id=$1",[enrollment.id]);
      await db.query("INSERT INTO transactions(id,student_id,course_id,amount,status,payment_method,created_at,processed_at,processed_by,notes) VALUES($1,$2,$3,$4,'approved','Upsell manual',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$5,$6)",[generateId('tx'),order.student_id,order.course_id,input.amount,req.user!.id,`${order.id}: ${input.reference}`]);
      const updated=(await db.query("UPDATE upsell_orders SET status='paid',reference=$1,enrollment_id=$2,confirmed_by=$3 WHERE id=$4 RETURNING *",[input.reference,enrollment.id,req.user!.id,order.id])).rows[0];
      await enqueueCrmEvent(db,'upsell.payment_confirmed',{orderId:order.id,enrollmentId:enrollment.id,lmsUserId:order.student_id,amount:input.amount,reference:input.reference});return updated;
    });await audit(req,'confirm_upsell_payment',req.params.id,input.reference);return result;
  });
  add('post','/upsell-orders/:id/cancel',['student',...staff],async req=>{
    if(req.user!.role!=='student') await sales(req);
    const result=await pool.query("UPDATE upsell_orders SET status='cancelled' WHERE id=$1 AND status='pending' AND ($2::boolean OR student_id=$3) RETURNING id",[req.params.id,req.user!.role!=='student',req.user!.id]);
    if(!result.rowCount) fail('Không thể hủy đơn này.',400);await audit(req,'cancel_upsell_order',req.params.id,'Hủy đơn chờ thanh toán');return {ok:true};
  });
}
