import React,{useEffect,useState} from 'react';
import {api,operationsApi} from '../../api';
import {buttonClass,inputClass,Field,Panel} from './OperationUI';
import {Assignment,Submission} from '../../types';

export default function SessionOperations({sessionId,onChanged}:{sessionId:string;onChanged:()=>void}) {
  const [data,setData]=useState<any>(null),[marks,setMarks]=useState<Record<string,any>>({}),[minutes,setMinutes]=useState(120);
  const [solution,setSolution]=useState({content:'',attachmentUrl:'',published:false}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=async()=>{
    const [next,sol]=await Promise.all([operationsApi(`/sessions/${sessionId}`),operationsApi(`/sessions/${sessionId}/solution`)]);
    setData(next);setMinutes(next.session.taught_minutes || 120);
    setMarks(Object.fromEntries(next.records.map((r:any)=>[r.student_id,{status:r.status,note:r.note || ''}])));
    setSolution({content:sol?.content || '',attachmentUrl:sol?.attachment_url || '',published:sol?.published || false});
  };
  useEffect(()=>{let cancelled=false;setData(null);setError('');
    load().catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[sessionId]);
  const run=async(fn:()=>Promise<any>)=>{setBusy(true);setError('');try{await fn();await load();onChanged();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!data ? <p className="text-sm text-slate-500">Đang tải vận hành buổi học...</p> : <>
      <Panel title="Điểm danh & Buổi dạy thực tế">
        <p className="text-sm text-slate-500">Không mặc định học viên có mặt. Chọn trạng thái từng người trước khi xác nhận buổi đã dạy.</p>
        <div className="space-y-2">{data.roster.map((student:any)=><div key={student.id} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_1fr] items-center gap-2 border-b border-slate-100 pb-2">
          <span className="text-sm font-medium">{student.name}</span>
          <select aria-label={`Điểm danh ${student.name}`} className={inputClass} value={marks[student.id]?.status || ''} onChange={e=>setMarks({...marks,[student.id]:{...marks[student.id],status:e.target.value}})}>
            <option value="">Chưa điểm danh</option><option value="present">Có mặt</option><option value="absent">Vắng</option><option value="late">Muộn</option><option value="excused">Có phép</option>
          </select>
          <input aria-label={`Ghi chú ${student.name}`} className={inputClass} value={marks[student.id]?.note || ''} placeholder="Ghi chú" onChange={e=>setMarks({...marks,[student.id]:{...marks[student.id],note:e.target.value}})} />
        </div>)}</div>
        {!data.roster.length && <p className="text-sm text-slate-500">Chưa có học viên được xếp vào lớp.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Thời lượng thực tế (phút)"><input type="number" min={1} max={1440} className={inputClass} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></Field>
          {[false,true].map(complete=><button key={String(complete)} className={buttonClass} disabled={busy || !data.roster.length} onClick={()=>run(()=>operationsApi(`/sessions/${sessionId}/attendance`,{records:data.roster.filter((r:any)=>marks[r.id]?.status).map((r:any)=>({studentId:r.id,status:marks[r.id].status,note:marks[r.id].note || ''})),complete,minutes},'PUT'))}>{complete?'Xác nhận đã dạy':'Lưu điểm danh'}</button>)}
        </div>
        {data.session.taught_at && <p className="text-sm text-emerald-700">Đã ghi nhận buổi dạy thực tế.</p>}
      </Panel>
      <Panel title={`Bài nộp & Chấm bài (${data.submissions.length})`}>
        {!data.submissions.length && <p className="text-sm text-slate-500">Chưa có bài nộp.</p>}
        {data.submissions.map((sub:any)=><GradeSubmission key={`${sub.id}-${sub.submitted_at}`} submission={sub} disabled={busy} onSave={(score,feedback)=>run(()=>api.gradeAssignment({submissionId:sub.id,score,feedback,expectedSubmittedAt:sub.submitted_at}))}/>)}
      </Panel>
      <Panel title="Lời giải">
        <textarea aria-label="Nội dung lời giải" className={inputClass} rows={5} value={solution.content} onChange={e=>setSolution({...solution,content:e.target.value})}/>
        <Field label="Tệp lời giải (PDF để học viên xem trực tuyến)"><input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)run(async()=>{const result=await api.uploadFile(file);await operationsApi(`/sessions/${sessionId}/solution`,{...solution,attachmentUrl:result.url},'PUT');});e.target.value='';}}/></Field>
        {solution.attachmentUrl && <div className="flex gap-3 text-sm"><a href={solution.attachmentUrl} className="text-indigo-700 underline" target="_blank" rel="noreferrer">Mở tệp lời giải</a><button onClick={()=>setSolution({...solution,attachmentUrl:''})}>Gỡ tệp</button></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={solution.published} onChange={e=>setSolution({...solution,published:e.target.checked})}/> Công bố cho học viên</label>
        <button className={buttonClass} disabled={busy} onClick={()=>run(()=>operationsApi(`/sessions/${sessionId}/solution`,{...solution,attachmentUrl:solution.attachmentUrl || null},'PUT'))}>Lưu lời giải</button>
      </Panel>
    </>}
  </div>;
}

function GradeSubmission({submission,disabled,onSave}:{submission:any;disabled:boolean;onSave:(score:number,feedback:string)=>void}) {
  const [score,setScore]=useState(submission.score ?? ''),[feedback,setFeedback]=useState(submission.feedback || ''),[history,setHistory]=useState<any[]|null>(null),[error,setError]=useState('');
  return <article className="border-b border-slate-200 pb-4 space-y-2">
    <p className="text-sm font-semibold">{submission.student_name} · {submission.assignment_title}</p>
    <p className="text-xs text-slate-500">Nộp {new Date(submission.submitted_at).toLocaleString('vi-VN')}</p>
    <p className="whitespace-pre-wrap text-sm break-words">{submission.content}</p>
    {submission.attachment_url && <a className="text-sm text-indigo-700 underline" href={submission.attachment_url} target="_blank" rel="noreferrer">Tải bài nộp</a>}
    <button className="ml-3 text-xs text-indigo-700" onClick={()=>operationsApi(`/submissions/${submission.id}/history`).then(setHistory).catch(e=>setError(e.message))}>Lịch sử nộp</button>
    {history && <div className="text-xs text-slate-500 space-y-1">{!history.length?'Chưa có phiên bản trước.':history.map(v=><details key={v.id}><summary>{new Date(v.submitted_at).toLocaleString('vi-VN')}</summary><p className="whitespace-pre-wrap">{v.content}</p>{v.attachment_url && <a href={v.attachment_url}>Tệp phiên bản cũ</a>}</details>)}</div>}
    {error && <p role="alert" className="text-rose-700 text-sm">{error}</p>}
    <div className="flex flex-col sm:flex-row gap-2">
      <Field label={`Điểm / ${submission.max_score}`}><input type="number" min={0} max={Number(submission.max_score)} step="0.1" className={inputClass} value={score} onChange={e=>setScore(e.target.value)}/></Field>
      <div className="flex-1"><Field label="Nhận xét"><textarea className={inputClass} value={feedback} onChange={e=>setFeedback(e.target.value)}/></Field></div>
      <button className={buttonClass} disabled={disabled || score===''} onClick={()=>onSave(Number(score),feedback)}>Lưu kết quả</button>
    </div>
    <div className="flex flex-wrap gap-2">{['Bài làm tốt, tư duy logic.','Cần bổ sung nguồn dữ liệu.','File nộp chưa đúng định dạng.'].map(text=><button key={text} className="text-xs text-slate-600 bg-slate-50 rounded-md p-2" onClick={()=>setFeedback(previous=>previous?`${previous}\n${text}`:text)}>{text}</button>)}</div>
  </article>;
}
