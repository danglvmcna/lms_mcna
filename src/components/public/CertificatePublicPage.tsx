import React from "react";
import { Award, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type Certificate = {
  certificateCode: string;
  issuedAt: string;
  studentName: string;
  courseTitle: string;
  status: "valid";
};

export default function CertificatePublicPage({ code }: { code: string }) {
  const [certificate, setCertificate] = React.useState<Certificate | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/certificates/${encodeURIComponent(code)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Không thể xác thực chứng chỉ.");
        return body as Certificate;
      })
      .then(value => { if (!cancelled) setCertificate(value); })
      .catch(reason => { if (!cancelled) setError(reason.message || "Không tìm thấy chứng chỉ."); });
    return () => { cancelled = true; };
  }, [code]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-mono font-bold uppercase tracking-[0.28em] text-indigo-600">MCNA Technology School</p>
          <h1 className="mt-3 text-2xl font-display font-bold">Xác thực chứng chỉ</h1>
          <p className="mt-2 text-sm text-slate-500">Trang kiểm tra công khai cho nhà tuyển dụng và đối tác.</p>
        </div>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
          {!certificate && !error && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Đang kiểm tra mã…</div>}
          {error && <div className="py-12 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-rose-500" /><h2 className="mt-4 text-lg font-bold">Không xác thực được</h2><p className="mt-2 text-sm text-slate-500">{error}</p><p className="mt-4 font-mono text-xs text-slate-400">Mã: {code.toUpperCase()}</p></div>}
          {certificate && <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><Award className="h-7 w-7" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Chứng chỉ hợp lệ</p><p className="mt-1 text-xs text-slate-500">Đã được cấp bởi MCNA</p></div></div>
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            </div>
            <div className="space-y-4 text-sm">
              <div><p className="text-xs text-slate-400">Học viên</p><p className="mt-1 text-lg font-bold text-slate-900">{certificate.studentName}</p></div>
              <div><p className="text-xs text-slate-400">Khóa học hoàn thành</p><p className="mt-1 font-semibold text-slate-800">{certificate.courseTitle}</p></div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4"><div><p className="text-xs text-slate-400">Ngày cấp</p><p className="mt-1 font-mono text-xs font-semibold">{new Date(certificate.issuedAt).toLocaleDateString("vi-VN")}</p></div><div><p className="text-xs text-slate-400">Mã kiểm định</p><p className="mt-1 font-mono text-xs font-semibold uppercase text-indigo-700">{certificate.certificateCode}</p></div></div>
            </div>
          </div>}
        </section>
      </div>
    </main>
  );
}
