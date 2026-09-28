import React from "react";
import { Award, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { BrandLockup } from "../ui";

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
    <main className="min-h-dvh bg-aurora px-5 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <div className="flex justify-center"><BrandLockup /></div>
        <div className="text-center">
          <h1 className="text-[28px] font-bold tracking-tight">Xác thực chứng chỉ</h1>
          <p className="mt-2 text-[15px] text-slate-500">Trang kiểm tra công khai dành cho nhà tuyển dụng và đối tác.</p>
        </div>
        <section className="rounded-[1.75rem] bg-white p-6 shadow-raised ring-1 ring-slate-200/70 md:p-8">
          {!certificate && !error && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Đang kiểm tra mã…</div>}
          {error && (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500"><ShieldCheck className="h-8 w-8" /></span>
              <h2 className="mt-4 text-lg font-bold">Không xác thực được</h2>
              <p className="mt-2 text-sm text-slate-500">{error}</p>
              <p className="mt-4 font-mono text-xs text-slate-400">Mã: {code.toUpperCase()}</p>
            </div>
          )}
          {certificate && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckCircle2 className="h-6 w-6" /></span>
                <div>
                  <p className="font-semibold text-emerald-900">Chứng chỉ hợp lệ</p>
                  <p className="text-sm text-emerald-800/80">Được cấp bởi MCNA Technology School</p>
                </div>
              </div>
              <div className="space-y-1 text-center">
                <Award className="mx-auto h-8 w-8 text-indigo-500" />
                <p className="pt-2 text-sm text-slate-500">Chứng nhận</p>
                <p className="text-2xl font-bold tracking-tight text-slate-900">{certificate.studentName}</p>
                <p className="text-sm text-slate-500">đã hoàn thành khóa học</p>
                <p className="text-lg font-semibold text-slate-800">{certificate.courseTitle}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-canvas p-4"><dt className="text-xs text-slate-500">Ngày cấp</dt><dd className="mt-0.5 font-semibold">{new Date(certificate.issuedAt).toLocaleDateString("vi-VN")}</dd></div>
                <div className="rounded-2xl bg-canvas p-4"><dt className="text-xs text-slate-500">Mã kiểm định</dt><dd className="mt-0.5 truncate font-mono text-sm font-semibold uppercase text-indigo-700">{certificate.certificateCode}</dd></div>
              </dl>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
