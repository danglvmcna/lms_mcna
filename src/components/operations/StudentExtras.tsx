import React,{useEffect,useRef,useState} from 'react';
import {operationsApi} from '../../api';
import {downloadCertificate} from '../../certificateDocument';
import {buttonClass,inputClass,Field,Panel} from './OperationUI';
import {voucherDiscount} from '../../operationRules';

export default function StudentExtras() {
  const [offers,setOffers]=useState<any>(null),[certificates,setCertificates]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [request,setRequest]=useState(''),[courseId,setCourseId]=useState(''),[voucherCode,setVoucherCode]=useState('');
  const requestKey=useRef(crypto.randomUUID()),orderKey=useRef(crypto.randomUUID());
  const load=async()=>{const [o,c]=await Promise.all([operationsApi('/my-offers'),operationsApi('/my-certificates')]);setOffers(o);setCertificates(c);};
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  const run=async(fn:()=>Promise<any>,success:string)=>{setBusy(true);setMessage('');try{await fn();await load();setMessage(success);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
  const selected=offers?.courses.find((c:any)=>c.id===courseId),voucher=offers?.vouchers.find((v:any)=>v.code===voucherCode.trim().toUpperCase() && (!v.course_id || v.course_id===courseId));
  const price=selected?voucherDiscount(Number(selected.price),Number(voucher?.amount || 0)):null;
  const pendingSelected=offers?.orders.some((o:any)=>o.course_id===courseId && o.status==='pending');
  return <div className="space-y-5">
    {message && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">{message}</p>}
    <Panel title="Chứng chỉ của tôi">
      {!certificates.length && <p className="text-sm text-slate-500">Chứng chỉ sẽ xuất hiện sau khi bạn đủ điều kiện hoặc được Quản lý lớp xác nhận.</p>}
      {certificates.map(c=><article key={c.id} className="border-b border-slate-100 py-3 space-y-2"><p className="font-medium">{c.course_title}</p><p className="text-xs text-slate-500">{new Date(c.issued_at).toLocaleDateString('vi-VN')} · {c.certificate_code}</p><div className="flex flex-wrap gap-3"><a className="text-sm text-indigo-700 underline" href={`/verify/certificate/${c.certificate_code}`} target="_blank" rel="noreferrer">Xem & xác minh</a><button className={buttonClass} onClick={()=>downloadCertificate(c)}>Tải chứng chỉ điện tử (SVG)</button></div></article>)}
    </Panel>
    <Panel title="Khóa học tiếp theo & Ưu đãi">
      {!offers?<p className="text-sm text-slate-500">Đang tải...</p>:!offers.courses.length?<p className="text-sm text-slate-500">Chưa có khóa học tiếp theo được gợi ý. Bạn có thể gửi yêu cầu tư vấn bên dưới.</p>:<form className="space-y-3" onSubmit={e=>{e.preventDefault();run(async()=>{await operationsApi('/upsell-orders',{courseId,voucherCode:voucherCode.trim() || undefined,requestKey:orderKey.current});orderKey.current=crypto.randomUUID();},'Đã tạo đơn ưu đãi. Sau khi thanh toán, MCNA xác nhận và Quản lý lớp xếp lớp cho bạn.');}}>
        <Field label="Khóa được gợi ý"><select required className={inputClass} value={courseId} onChange={e=>{setCourseId(e.target.value);orderKey.current=crypto.randomUUID();}}><option value="">Chọn khóa</option>{offers.courses.map((c:any)=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
        <Field label="Mã voucher (nếu có)"><input className={inputClass} value={voucherCode} onChange={e=>setVoucherCode(e.target.value)} list="my-vouchers"/><datalist id="my-vouchers">{offers.vouchers.map((v:any)=><option key={v.code} value={v.code}>Giảm {Number(v.amount).toLocaleString('vi-VN')}đ</option>)}</datalist></Field>
        {price && <p className="text-lg font-semibold">{price.discount>0 && <del className="mr-3 text-sm font-normal text-slate-400">{price.originalPrice.toLocaleString('vi-VN')}đ</del>}{price.amount.toLocaleString('vi-VN')}đ</p>}
        {pendingSelected && <p className="text-sm text-slate-600">Khóa này đã có đơn chờ xác nhận ở bên dưới.</p>}
        <button className={buttonClass} disabled={busy || !courseId || pendingSelected}>Nhận ưu đãi & Tạo đơn</button>
      </form>}
    </Panel>
    {offers?.orders.length>0 && <Panel title="Đơn ưu đãi của tôi">{offers.orders.map((o:any)=><article key={o.id} className="space-y-2 border-b border-slate-100 py-3">
      <p className="text-sm font-medium">{o.course_title || offers.courses.find((c:any)=>c.id===o.course_id)?.title || 'Khóa học'} · {Number(o.amount).toLocaleString('vi-VN')}đ</p>
      <p className="text-sm">{({pending:'Chờ xác nhận thanh toán',paid:'Đã thanh toán — xem lớp sau khi được xếp',cancelled:'Đã hủy'} as any)[o.status]}</p>
      {o.status==='pending' && <>
        {offers.bank.bin && offers.bank.account && Number(o.amount)>0?<div className="flex flex-col sm:flex-row gap-4"><img loading="lazy" className="h-48 w-48 object-contain" alt="QR chuyển khoản công ty" src={`https://img.vietqr.io/image/${offers.bank.bin}-${offers.bank.account}-compact2.png?amount=${o.amount}&addInfo=${encodeURIComponent(o.id)}&accountName=${encodeURIComponent(offers.bank.name)}`}/><p className="text-sm">Tài khoản: {offers.bank.account}<br/>Chủ tài khoản: {offers.bank.name}<br/>Nội dung: {o.id}<br/>Sau khi chuyển khoản, gửi mã đơn cho tư vấn viên hoặc nhóm lớp để MCNA xác nhận.</p></div>:<p className="text-sm text-slate-500">{Number(o.amount)===0?'Đơn được giảm toàn bộ học phí, vẫn cần MCNA xác nhận.':'Thông tin ngân hàng chưa được cấu hình. Vui lòng liên hệ MCNA trước khi chuyển khoản.'}</p>}
        <a className="text-sm text-indigo-700 underline" target="_blank" rel="noreferrer" href={`https://zalo.me/${String(offers.supportPhone).replace(/\D/g,'')}`}>Nhắn MCNA xác nhận đơn</a>
        <button disabled={busy} className="ml-3 text-sm text-rose-700" onClick={()=>run(()=>operationsApi(`/upsell-orders/${o.id}/cancel`,{}),'Đã hủy đơn.')}>Hủy đơn chờ thanh toán</button>
      </>}
    </article>)}</Panel>}
    <Panel title="Cần tư vấn">
      <form className="space-y-3" onSubmit={e=>{e.preventDefault();run(async()=>{await operationsApi('/consultations',{courseId:courseId || undefined,message:request,requestKey:requestKey.current});requestKey.current=crypto.randomUUID();setRequest('');},'Đã gửi yêu cầu cho bộ phận tư vấn MCNA.');}}>
        <Field label="Bạn cần MCNA hỗ trợ điều gì?"><textarea className={inputClass} minLength={2} maxLength={2000} rows={3} required value={request} onChange={e=>setRequest(e.target.value)}/></Field><button disabled={busy} className={buttonClass}>Gửi yêu cầu tư vấn</button>
      </form>
    </Panel>
  </div>;
}
