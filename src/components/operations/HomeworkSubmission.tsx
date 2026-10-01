import React,{useState} from 'react';
import {api,operationsApi} from '../../api';
import {Assignment,Submission} from '../../types';
import {buttonClass,inputClass} from './OperationUI';

export default function HomeworkSubmission({assignment,submission,onChanged}:{assignment:Assignment;submission?:Submission;onChanged:()=>void}) {
  const [opened,setOpened]=useState(false),[content,setContent]=useState(submission?.content || ''),[file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[history,setHistory]=useState<any[]|null>(null);
  const closed=!assignment.allowLate && Date.now()>Date.parse(assignment.deadline);
  return <div className="space-y-2 pt-2">
    <div className="flex flex-wrap gap-3 text-sm">
      <button className={buttonClass} disabled={closed || busy} onClick={()=>{setContent(submission?.content || '');setOpened(!opened);}}>{closed?'Đã hết hạn nộp':submission?'Nộp lại bài':'Nộp bài trên LMS'}</button>
      {submission && <button className="text-indigo-700" onClick={()=>operationsApi(`/submissions/${submission.id}/history`).then(setHistory).catch(e=>setMessage(e.message))}>Lịch sử bài nộp</button>}
    </div>
    {submission && <p className="text-xs text-slate-500">Đã nộp {new Date(submission.submittedAt).toLocaleString('vi-VN')}</p>}
    {opened && <form className="space-y-3" onSubmit={async event=>{
      event.preventDefault();setBusy(true);setMessage('');
      try {
        let attachmentUrl:string|undefined;
        if(file){if(file.size>50*1024*1024)throw new Error('Tệp tối đa 50 MB.');attachmentUrl=(await api.uploadFile(file)).url;}
        await api.submitAssignment({assignmentId:assignment.id,content,attachmentUrl});setOpened(false);setFile(null);setMessage('Đã nộp bài.');onChanged();
      }catch(error:any){setMessage(error.message);}finally{setBusy(false);}
    }}>
      <label className="block text-sm">Nội dung bài làm<textarea required maxLength={20000} rows={5} className={inputClass} value={content} onChange={e=>setContent(e.target.value)}/></label>
      <label className="block text-sm">Tệp bài làm (tối đa 50 MB)<input className="block mt-1" type="file" onChange={e=>setFile(e.target.files?.[0] || null)}/></label>
      {submission?.score!==undefined && <p className="text-xs text-amber-800">Nộp lại sẽ chuyển bài về trạng thái chờ chấm; phiên bản trước được lưu trong lịch sử.</p>}
      <button disabled={busy || !content.trim()} className={buttonClass}>{busy?'Đang nộp...':'Xác nhận nộp'}</button>
    </form>}
    {message && <p role="status" className="text-sm text-indigo-700">{message}</p>}
    {history && <div className="space-y-2 text-xs">{history.length?history.map(v=><details key={v.id}><summary>{new Date(v.submitted_at).toLocaleString('vi-VN')}</summary><p className="whitespace-pre-wrap">{v.content}</p>{v.attachment_url && <a href={v.attachment_url} className="text-indigo-700 underline">Tệp đính kèm</a>}</details>):'Chưa có phiên bản trước.'}</div>}
  </div>;
}
