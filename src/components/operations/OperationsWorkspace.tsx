import React,{useEffect,useRef,useState} from 'react';
import {api,operationsApi} from '../../api';
import {LMSDataStore,User} from '../../types';
import SessionOperations from './SessionOperations';
import {buttonClass,inputClass,Field,Panel} from './OperationUI';

export default function OperationsWorkspace({store,currentUser,onChanged}:{store:LMSDataStore;currentUser:User;onChanged:()=>void}) {
  const staff=currentUser.role!=='teacher';
  const [tab,setTab]=useState('sessions'),[sectionId,setSectionId]=useState(''),[sessionId,setSessionId]=useState('');
  const tabs=[['sessions','Điểm danh & Chấm bài'],['plans','Giáo án'],['teaching','Buổi dạy & Bậc giảng viên'],...(staff?[['teachers','Giảng viên'],['certificates','Chứng chỉ']]:[]),...(currentUser.role==='admin'?[['settings','Cấu hình vận hành']]:[])];
  const sections=store.courseSections || [], sessions=(store.attendanceSessions || []).filter(s=>s.sectionId===sectionId).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  return <div className="space-y-5">
    <nav aria-label="Vận hành lớp học" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{tabs.map(([key,label])=><button key={key} className={`rounded-lg px-3 py-2 text-sm ${tab===key?'bg-indigo-50 text-indigo-700 font-semibold':'text-slate-600 hover:bg-slate-50'}`} onClick={()=>setTab(key)}>{label}</button>)}</nav>
    {['sessions','plans','certificates'].includes(tab) && <Field label="Lớp học"><select className={inputClass} value={sectionId} onChange={e=>{setSectionId(e.target.value);setSessionId('');}}><option value="">Chọn lớp</option>{sections.map(s=><option key={s.id} value={s.id}>{s.sectionCode} · {store.courses.find(c=>c.id===s.courseId)?.title}</option>)}</select></Field>}
    {tab==='sessions' && sectionId && <>
      <Field label="Buổi học"><select className={inputClass} value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">Chọn buổi</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.topic} · {new Date(s.date).toLocaleDateString('vi-VN')}</option>)}</select></Field>
      {sessionId && <SessionOperations key={sessionId} sessionId={sessionId} onChanged={onChanged}/>}
    </>}
    {tab==='teachers' && <TeacherDirectory courses={store.courses} onChanged={onChanged}/>}
    {tab==='plans' && sectionId && <PlanManager key={sectionId} sectionId={sectionId} courseId={sections.find(s=>s.id===sectionId)?.courseId || ''} staff={staff} onChanged={onChanged}/>}
    {tab==='certificates' && sectionId && <ClassCertificates key={sectionId} sectionId={sectionId} onChanged={onChanged}/>}
    {tab==='teaching' && <TeachingSummary users={store.users} currentUser={currentUser}/>}
    {tab==='settings' && <OperationSettings users={store.users}/>}
  </div>;
}

function TeacherDirectory({courses,onChanged}:{courses:LMSDataStore['courses'];onChanged:()=>void}) {
  const [teachers,setTeachers]=useState<any[]>([]),[editing,setEditing]=useState<any|null>(null),[ids,setIds]=useState<string[]>([]);
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>operationsApi('/teachers').then(setTeachers);
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  return <Panel title="Giảng viên & Môn có thể dạy">
    {message && <p role="status" className="text-sm text-indigo-700">{message}</p>}
    <div className="space-y-2">{teachers.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2"><div><p className="font-medium text-sm">{t.name}</p><p className="text-xs text-slate-500">{t.email} · {t.course_ids.map((id:string)=>courses.find(c=>c.id===id)?.title).filter(Boolean).join(', ') || 'Chưa chọn môn'}</p></div><button className="text-sm text-indigo-700" onClick={()=>{setEditing(t);setIds(t.course_ids);}}>Sửa môn dạy</button></div>)}</div>
    <button className={buttonClass} onClick={()=>{setEditing('new');setIds([]);setName('');setEmail('');setPhone('');setPassword('');}}>Tạo giảng viên</button>
    {editing && <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setMessage('');
      try{if(editing==='new') await operationsApi('/teachers',{name,email,phone,password:password || undefined,courseIds:ids});else await operationsApi(`/teachers/${editing.id}/subjects`,{courseIds:ids},'PUT');
        await load();onChanged();setEditing(null);setMessage('Đã lưu giảng viên. Tài khoản mới phải đổi mật khẩu lần đầu.');
      }catch(error:any){setMessage(error.message);}finally{setBusy(false);}
    }}>
      {editing==='new' && <div className="grid sm:grid-cols-2 gap-3"><Field label="Họ tên"><input className={inputClass} required value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Email cá nhân/Gmail"><input className={inputClass} type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Số điện thoại"><input className={inputClass} value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Field label="Mật khẩu ban đầu (để trống dùng cấu hình)"><input className={inputClass} type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></Field></div>}
      <fieldset className="grid sm:grid-cols-2 gap-2"><legend className="text-sm font-medium mb-2">Môn có thể dạy</legend>{courses.map(c=><label key={c.id} className="flex gap-2 text-sm items-start"><input type="checkbox" checked={ids.includes(c.id)} onChange={e=>setIds(e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id))}/>{c.title}</label>)}</fieldset>
      <div className="flex gap-3"><button className={buttonClass} disabled={busy}>Lưu</button><button type="button" onClick={()=>setEditing(null)}>Hủy</button></div>
    </form>}
  </Panel>;
}

function PlanManager({sectionId,courseId,staff,onChanged}:{sectionId:string;courseId:string;staff:boolean;onChanged:()=>void}) {
  const [templates,setTemplates]=useState<any[]>([]),[selected,setSelected]=useState(''),[title,setTitle]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>operationsApi('/templates').then(rows=>setTemplates(rows.filter((row:any)=>row.course_id===courseId)));
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  const run=async(fn:()=>Promise<any>)=>{setBusy(true);try{await fn();setMessage('Đã lưu. Nội dung của lớp được giữ độc lập với bộ mẫu.');await load();onChanged();}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
  return <Panel title="Giáo án của lớp">
    <p className="text-sm text-slate-500">Áp dụng bộ mẫu vào lớp chưa có nội dung. Lớp đang có tài liệu sẽ không bị ghi đè. Sau khi sao chép, mỗi lớp có bản độc lập để giảng viên chỉnh sửa.</p>
    {message && <p role="status" className="text-sm text-indigo-700">{message}</p>}
    <Field label="Bộ mẫu MCNA"><select className={inputClass} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn bộ mẫu cùng môn</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
    <div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy || !selected} onClick={()=>run(()=>operationsApi(`/sections/${sectionId}/plan`,{mode:'default',templateId:selected}))}>Dùng bộ mẫu cho lớp</button><button className={buttonClass} disabled={busy} onClick={()=>run(()=>operationsApi(`/sections/${sectionId}/plan`,{mode:'custom'}))}>Dùng giáo án riêng</button></div>
    {staff && <form className="space-y-2 border-t border-slate-200 pt-3" onSubmit={e=>{e.preventDefault();run(()=>operationsApi('/templates',{sectionId,title}));}}><Field label="Lưu nội dung hiện tại thành bộ mẫu MCNA"><input className={inputClass} value={title} onChange={e=>setTitle(e.target.value)} minLength={2} required placeholder="Ví dụ: AI Automation — giáo án chuẩn"/></Field><button className={buttonClass} disabled={busy}>Lưu bộ mẫu</button></form>}
    {staff && <button className="text-sm text-indigo-700" disabled={busy} onClick={async()=>{
      setBusy(true);try{const result=await operationsApi(`/sections/${sectionId}/teacher-notice`,{});setMessage(result.status==='sent'?'Đã gửi email phân lớp cho giảng viên.':result.status==='failed'?'Gửi email thất bại. Kiểm tra cấu hình email.':'Email chưa gửi thực tế. Kiểm tra cấu hình email trong hướng dẫn vận hành.');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}
    }}>Gửi lại email phân lớp cho giảng viên</button>}
  </Panel>;
}

function ClassCertificates({sectionId,onChanged}:{sectionId:string;onChanged:()=>void}) {
  const [rows,setRows]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[override,setOverride]=useState<any|null>(null),[reason,setReason]=useState('');
  const load=()=>operationsApi(`/sections/${sectionId}/certificates`).then(setRows);
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[sectionId]);
  const run=async(fn:()=>Promise<any>)=>{setBusy(true);try{await fn();await load();onChanged();setMessage('Đã cập nhật chứng chỉ.');setOverride(null);setReason('');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
  return <Panel title="Xét chứng chỉ cuối khóa">
    <p className="text-sm text-slate-500">Lớp đã học đủ buổi, điểm danh đầy đủ, nghỉ không quá 2 buổi và đã nộp bài cuối khóa. Không dùng điều kiện quiz.</p>
    {message && <p role="status" className="text-sm text-indigo-700">{message}</p>}
    <button disabled={busy} className={buttonClass} onClick={()=>run(()=>operationsApi(`/sections/${sectionId}/certificates/reconcile`,{}))}>Xét và cấp cho học viên đủ điều kiện</button>
    {rows.map(row=><div key={row.enrollment_id} className="border-b border-slate-100 py-3 space-y-1"><p className="text-sm font-medium">{row.name} · {row.email}</p>{row.certificate?<a className="text-sm text-emerald-700 underline" href={`/verify/certificate/${row.certificate.certificate_code}`} target="_blank" rel="noreferrer">Đã cấp · {row.certificate.certificate_code}</a>:<><p className="text-sm text-slate-500">{row.eligible?'Đủ điều kiện':row.reasons.join(' ')}</p><button disabled={busy} className="text-sm text-indigo-700" onClick={()=>row.eligible?run(()=>api.issueCertificate({enrollmentId:row.enrollment_id})):setOverride(row)}>{row.eligible?'Cấp chứng chỉ':'Cấp ngoại lệ'}</button></>}</div>)}
    {override && <form className="space-y-2 rounded-lg bg-amber-50 p-3" onSubmit={e=>{e.preventDefault();run(()=>api.issueCertificate({enrollmentId:override.enrollment_id,overrideReason:reason}));}}><Field label={`Lý do cấp ngoại lệ cho ${override.name} (lưu vào nhật ký)`}><textarea className={inputClass} value={reason} onChange={e=>setReason(e.target.value)} required minLength={10}/></Field><div className="flex gap-3"><button disabled={busy} className={buttonClass}>Xác nhận cấp ngoại lệ</button><button type="button" onClick={()=>setOverride(null)}>Hủy</button></div></form>}
  </Panel>;
}

function TeachingSummary({users,currentUser}:{users:User[];currentUser:User}) {
  const staff=currentUser.role!=='teacher';
  const [teacherId,setTeacherId]=useState(staff?'':currentUser.id),[month,setMonth]=useState(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7)),[data,setData]=useState<any>(null),[note,setNote]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const requestVersion=useRef(0);
  const monthEnded=month<new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
  const load=async()=>{
    const version=++requestVersion.current;
    if(!teacherId)return;
    try{const result=await operationsApi(`/teaching?teacherId=${encodeURIComponent(teacherId)}&month=${month}`);if(version===requestVersion.current)setData(result);}
    catch(e:any){if(version===requestVersion.current)setMessage(e.message);}
  };
  useEffect(()=>{setData(null);setMessage('');setNote('');load();return ()=>{requestVersion.current++;};},[teacherId,month]);
  const run=async(fn:()=>Promise<any>)=>{setBusy(true);try{await fn();await load();setMessage('Đã lưu xác nhận.');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
  return <Panel title="Buổi dạy thực tế & Xác nhận tháng">
    <div className="grid sm:grid-cols-2 gap-3">{staff && <Field label="Giảng viên"><select disabled={busy} className={inputClass} value={teacherId} onChange={e=>setTeacherId(e.target.value)}><option value="">Chọn giảng viên</option>{users.filter(u=>u.role==='teacher').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}<Field label="Tháng"><input disabled={busy} type="month" className={inputClass} value={month} onChange={e=>setMonth(e.target.value)}/></Field></div>
    {message && <p role="status" className="text-sm text-indigo-700">{message}</p>}
    {data && <>
      <div className="grid sm:grid-cols-3 gap-3 text-sm"><p>Tổng giờ đã dạy: <strong>{(data.totalMinutes/60).toFixed(1)}</strong></p><p>Số khóa/lớp đã dạy xong: <strong>{data.courses}</strong></p><p>Bậc: <strong>{data.tier.label}</strong>{data.tier.next && <span> · Còn {data.tier.remaining} lớp để lên {data.tier.next}</span>}</p></div>
      <p className="font-medium text-sm">Tháng {month}: {data.sessions.length} buổi · {(data.monthlyMinutes/60).toFixed(1)} giờ</p>
      {data.sessions.map((s:any)=><p key={s.id} className="text-sm text-slate-600 border-b border-slate-100 py-2">{new Date(s.date).toLocaleDateString('vi-VN')} · {s.section_code} · {s.topic} · {s.taught_minutes} phút</p>)}
      <p className="text-sm">Trạng thái: {({submitted:'Chờ duyệt',approved:'Đã duyệt',revision:'Cần xác nhận lại'} as any)[data.confirmation?.status] || 'Chưa xác nhận'}{data.confirmation?.note && ` · ${data.confirmation.note}`}</p>
      <Field label="Ghi chú"><textarea className={inputClass} value={note} onChange={e=>setNote(e.target.value)}/></Field>
      {!staff && !monthEnded && <p className="text-sm text-slate-500">Có thể xác nhận số buổi sau khi tháng kết thúc. Chọn tháng trước để gửi xác nhận.</p>}
      {staff?<div className="flex gap-3">{['approved','revision'].map(status=><button key={status} className={buttonClass} disabled={busy || data.confirmation?.status!=='submitted'} onClick={()=>run(()=>operationsApi('/teaching/review',{teacherId,month,status,note}))}>{status==='approved'?'Duyệt tháng':'Yêu cầu sửa'}</button>)}</div>:<button className={buttonClass} disabled={busy || !monthEnded || !data.sessions.length || data.confirmation?.status==='approved'} onClick={()=>run(()=>operationsApi('/teaching/confirm',{month,note}))}>Xác nhận số buổi tháng này</button>}
    </>}
  </Panel>;
}

function OperationSettings({users}:{users:User[]}) {
  const [rules,setRules]=useState<any>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{operationsApi('/settings').then(setRules).catch(e=>setMessage(e.message));},[]);
  if(!rules)return <p>{message || 'Đang tải cấu hình...'}</p>;
  return <Panel title="Quy tắc vận hành (admin)">
    {message && <p role="status" className="text-sm text-indigo-700">{message}</p>}
    <form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await operationsApi('/settings',rules,'PUT');setMessage('Đã lưu cấu hình.');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}}>
      <fieldset><legend className="text-sm font-medium mb-2">Trạng thái tính là nghỉ khi xét chứng chỉ</legend>{[['absent','Vắng'],['late','Muộn'],['excused','Có phép']].map(([key,label])=><label key={key} className="inline-flex mr-4 gap-2 text-sm"><input type="checkbox" checked={rules.absentStatuses.includes(key)} onChange={e=>setRules({...rules,absentStatuses:e.target.checked?[...rules.absentStatuses,key]:rules.absentStatuses.filter((s:string)=>s!==key)})}/>{label}</label>)}</fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-medium mb-2">Bậc giảng viên — theo số lớp đã dạy xong, không hiển thị tiền</legend>{rules.tierRules.map((rule:any,index:number)=><div key={index} className="flex gap-2"><input aria-label="Tên bậc" className={inputClass} value={rule.label} placeholder="1.1" onChange={e=>setRules({...rules,tierRules:rules.tierRules.map((r:any,i:number)=>i===index?{...r,label:e.target.value}:r)})}/><input aria-label="Số lớp tối thiểu" type="number" min={0} className={inputClass} value={rule.courses} onChange={e=>setRules({...rules,tierRules:rules.tierRules.map((r:any,i:number)=>i===index?{...r,courses:Number(e.target.value)}:r)})}/><button type="button" onClick={()=>setRules({...rules,tierRules:rules.tierRules.filter((_:any,i:number)=>i!==index)})}>Xóa</button></div>)}<button type="button" className="text-sm text-indigo-700" onClick={()=>setRules({...rules,tierRules:[...rules.tierRules,{label:'',courses:0}]})}>Thêm bậc</button></fieldset>
      <Field label="Ngày bắt đầu chính sách hoa hồng 12 tháng (10% tự mua / 5% qua sale)"><input type="date" className={inputClass} value={rules.commissionStart || ''} onChange={e=>setRules({...rules,commissionStart:e.target.value || null})}/></Field>
      <p className="text-xs text-slate-500">Chưa đặt ngày bắt đầu: đơn vẫn ghi nguồn nhưng chưa ghi nhận tỷ lệ hoa hồng. Chính sách được chụp tại thời điểm tạo đơn.</p>
      <div className="grid sm:grid-cols-3 gap-3">{[['bankBin','BIN ngân hàng (6 số)'],['bankAccount','Số tài khoản công ty'],['bankName','Tên chủ tài khoản']].map(([key,label])=><Field key={key} label={label}><input className={inputClass} value={rules[key]} onChange={e=>setRules({...rules,[key]:e.target.value})}/></Field>)}</div>
      <button className={buttonClass} disabled={busy}>Lưu cấu hình</button>
    </form>
    <fieldset className="border-t border-slate-200 pt-4 space-y-2"><legend className="text-sm font-medium">Cấp quyền tư vấn, voucher và xác nhận đơn upsell</legend>{users.filter(u=>u.role==='manager').map(u=><div key={u.id} className="flex flex-wrap gap-3 items-center text-sm"><span>{u.name}</span>{[true,false].map(enabled=><button key={String(enabled)} disabled={busy} className="text-indigo-700" onClick={async()=>{setBusy(true);try{await operationsApi(`/sales-permissions/${u.id}`,{enabled},'PATCH');setMessage(`${enabled?'Đã cấp':'Đã thu hồi'} quyền cho ${u.name}.`);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}}>{enabled?'Cấp quyền':'Thu hồi'}</button>)}</div>)}</fieldset>
  </Panel>;
}
