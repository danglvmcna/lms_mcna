import React, {useEffect, useState} from 'react';

/** Authenticated, viewer-only request, like PDF pages; no plain file link. */
export default function ProtectedImage({url,title}:{url:string;title:string}) {
  const [src,setSrc]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let objectUrl='';
    setSrc('');setError('');
    fetch(url,{credentials:'include',headers:{'X-LMS-Viewer':'1'},signal:controller.signal})
      .then(async response=>{
        if(!response.ok) throw new Error('Không mở được ảnh hoặc bạn không còn quyền truy cập.');
        const blob=await response.blob();
        if(controller.signal.aborted)return;
        objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);
      }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[url]);
  return <div className="lms-view-only h-full overflow-auto bg-slate-100 p-3" onContextMenu={e=>e.preventDefault()}>
    {src?<img src={src} alt={title} draggable={false} className="mx-auto max-w-full select-none"/>:<p role="status" className="text-sm text-slate-600">{error || 'Đang mở ảnh...'}</p>}
  </div>;
}
