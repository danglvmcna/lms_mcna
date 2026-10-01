import React,{useEffect,useState} from 'react';
import {operationsApi} from '../../api';
import PdfViewer from '../common/PdfViewer';

export default function LearnerSolution({sessionId,allowDownload}:{sessionId:string;allowDownload:boolean}) {
  const [solution,setSolution]=useState<any>(null),[open,setOpen]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let alive=true;operationsApi(`/sessions/${sessionId}/solution`).then(value=>{if(alive)setSolution(value);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[sessionId]);
  if(error)return <p className="text-sm text-rose-700" role="alert">{error}</p>;
  if(!solution)return null;
  return <section className="border-t border-slate-200 pt-4 space-y-2"><h4 className="font-semibold text-sm">Lời giải đã công bố</h4><p className="whitespace-pre-wrap text-sm text-slate-700">{solution.content}</p>
    {solution.attachment_url && (/\.pdf$/i.test(solution.attachment_url)?<><button className="text-sm text-indigo-700" onClick={()=>setOpen(!open)}>{open?'Đóng':'Xem lời giải'}</button>{open && <div className="h-[70vh] min-h-72"><PdfViewer url={solution.attachment_url} title="Lời giải"/></div>}</>:!allowDownload?<p className="text-xs text-slate-500">Cần bản PDF để xem lời giải trực tuyến.</p>:null)}
    {allowDownload && solution.attachment_url && <a className="text-sm text-indigo-700 underline ml-3" href={solution.attachment_url} download>Tải lời giải</a>}
  </section>;
}
