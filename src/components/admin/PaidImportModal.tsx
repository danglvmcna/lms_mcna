import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileSpreadsheet, UserPlus, X } from "lucide-react";
import { api } from "../../api";
import { PaidImportResponse, PaidImportRow, PaidImportRowResult, parsePaidTable } from "../../paidImport";
import { Course } from "../../types";
import ModalPortal from "../ModalPortal";

interface PaidImportModalProps {
  courses: Course[];
  onClose: () => void;
  onImported: () => void;
  triggerToast: (message: string) => void;
}

const HEADER_LINE = "Họ tên\tEmail\tSĐT\tKhóa học\tSố tiền\tMã lớp";
const SAMPLE_TABLE = [
  HEADER_LINE,
  // example.com never delivers mail, so trying the sample cannot email a stranger.
  "Nguyễn Văn An\tan.nguyen@example.com\t0912345678\tAI Automation\t3.500.000\t",
  "Trần Thị Bình\tbinh.tran@example.com\t0987654321\tAI for Work\t2.900.000\t"
].join("\n");

const STATUS_STYLE: Record<PaidImportRowResult["status"], { label: string; className: string }> = {
  ready: { label: "Sẵn sàng", className: "bg-sky-50 text-sky-700 border-sky-200" },
  created: { label: "Đã tạo", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  linked: { label: "Đã ghi danh", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  skipped: { label: "Bỏ qua", className: "bg-slate-100 text-slate-600 border-slate-200" },
  error: { label: "Lỗi", className: "bg-rose-50 text-rose-700 border-rose-200" }
};

const inputClass = "w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 text-xs";

/**
 * Direct-sale intake: paste (or upload) the "paid customers" table, check it, then create the learner
 * accounts and paid enrollments. Nothing is written until the second step is confirmed.
 */
export default function PaidImportModal({ courses, onClose, onImported, triggerToast }: PaidImportModalProps) {
  const [text, setText] = useState("");
  const [fileRows, setFileRows] = useState<{ name: string; rows: PaidImportRow[]; errors: Array<{ line: number; reason: string }> } | null>(null);
  const [defaultPassword, setDefaultPassword] = useState("");
  const [sendAccountEmail, setSendAccountEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PaidImportResponse | null>(null);
  const [outcome, setOutcome] = useState<PaidImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Single-learner form: appended to the table as one more line.
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCourseId, setManualCourseId] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const publishedCourses = useMemo(
    () => courses.filter(course => course.status === "published").sort((a, b) => a.title.localeCompare(b.title, "vi")),
    [courses]
  );

  useEffect(() => {
    api.getPaidImportConfig()
      .then(config => setDefaultPassword(current => current || config.defaultPassword || ""))
      .catch(() => undefined);
  }, []);

  const parsed = useMemo(() => (fileRows ? fileRows : parsePaidTable(text)), [text, fileRows]);
  const rows = parsed.rows;
  const resetChecks = () => {
    setPreview(null);
    setError(null);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    resetChecks();
    try {
      const result = await api.parsePaidTableFile(file);
      setFileRows({ name: file.name, rows: result.rows, errors: result.errors });
      if (result.rows.length === 0) setError("Không đọc được dòng hợp lệ nào trong tệp. Hãy kiểm tra các cột Họ tên, Email, Khóa học.");
    } catch (err: any) {
      setError(err.message || "Không đọc được tệp danh sách.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddManual = (event: React.FormEvent) => {
    event.preventDefault();
    const course = publishedCourses.find(item => item.id === manualCourseId);
    if (manualName.trim().length < 2 || !manualEmail.includes("@") || !course) {
      setError("Nhập họ tên, email và chọn khóa học trước khi thêm.");
      return;
    }
    const clean = (value: string) => value.replace(/[\t\n\r]+/g, " ").trim();
    const line = [clean(manualName), clean(manualEmail).toLowerCase(), clean(manualPhone), course.title, clean(manualAmount), ""].join("\t");
    setFileRows(null);
    setText(current => (current.trim() ? `${current.replace(/\s+$/, "")}\n${line}` : `${HEADER_LINE}\n${line}`));
    setManualName("");
    setManualEmail("");
    setManualPhone("");
    setManualAmount("");
    resetChecks();
  };

  const handlePreview = async () => {
    if (rows.length === 0) {
      setError("Chưa có dòng hợp lệ nào. Dán bảng có các cột Họ tên, Email, Khóa học hoặc thêm từng học viên ở bên dưới.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.importPaidEnrollments({ rows, dryRun: true }));
    } catch (err: any) {
      setError(err.message || "Không kiểm tra được danh sách.");
    } finally {
      setBusy(false);
    }
  };

  const readyCount = preview ? preview.results.filter(row => row.status === "ready").length : 0;

  const handleImport = async () => {
    if (!preview) return;
    if (preview.summary.accountsCreated > 0 && defaultPassword.trim().length < 8) {
      setError("Cần mật khẩu mặc định (tối thiểu 8 ký tự) cho các tài khoản mới.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.importPaidEnrollments({ rows, defaultPassword: defaultPassword.trim() || undefined, sendAccountEmail });
      setOutcome(result);
      onImported();
      triggerToast(`Đã nhập: ${result.summary.accountsCreated} tài khoản mới, ${result.summary.enrollmentsCreated + result.summary.paymentsConfirmed} học viên chờ xếp lớp.`);
    } catch (err: any) {
      setError(err.message || "Không nhập được danh sách.");
    } finally {
      setBusy(false);
    }
  };

  const shown = outcome || preview;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-3 md:p-6 overflow-y-auto font-sans">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl text-slate-900 my-2">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Nhập danh sách khách đã thanh toán</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mỗi dòng tạo một tài khoản học viên (đăng nhập bằng email, mật khẩu mặc định) và một lượt ghi danh chờ xếp lớp.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-xs">
            {!outcome && (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="paid-table" className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ClipboardPaste className="h-4 w-4 text-indigo-600" /> Dán bảng từ Excel / Google Sheets
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => { setFileRows(null); setText(SAMPLE_TABLE); resetChecks(); }} className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">
                        Dán bảng mẫu
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Chọn tệp .xlsx / .csv
                        <input type="file" accept=".xlsx,.csv,.txt,.tsv" className="hidden" onChange={handleFile} disabled={busy} />
                      </label>
                    </div>
                  </div>
                  {fileRows ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800">
                      <span>Đã đọc tệp <strong>{fileRows.name}</strong>: {fileRows.rows.length} dòng hợp lệ.</span>
                      <button type="button" onClick={() => { setFileRows(null); resetChecks(); }} className="font-semibold underline cursor-pointer">Bỏ tệp, dán bảng</button>
                    </div>
                  ) : (
                    <textarea
                      id="paid-table"
                      value={text}
                      onChange={event => { setText(event.target.value); resetChecks(); }}
                      placeholder={"Họ tên\tEmail\tSĐT\tKhóa học\tSố tiền\tMã lớp\nNguyễn Văn An\tan@gmail.com\t0912345678\tAI Automation\t3.500.000"}
                      className="w-full h-36 px-3 py-2 bg-white text-slate-900 font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 text-xs whitespace-pre"
                    />
                  )}
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Cột bắt buộc: <strong>Họ tên, Email, Khóa học</strong>. Tùy chọn: SĐT, Số tiền, Mã lớp (lớp mong muốn), Ghi chú. Khóa học ghi theo tên (ví dụ "AI Automation") hoặc mã khóa.
                    {rows.length > 0 && <span className="ml-1 font-semibold text-slate-700">Đang có {rows.length} dòng hợp lệ.</span>}
                  </p>
                  {parsed.errors.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {parsed.errors.length} dòng bị bỏ qua khi đọc bảng</div>
                      {parsed.errors.slice(0, 5).map(item => <div key={item.line}>Dòng {item.line}: {item.reason}</div>)}
                      {parsed.errors.length > 5 && <div>... và {parsed.errors.length - 5} dòng khác.</div>}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddManual} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5"><UserPlus className="h-4 w-4 text-indigo-600" /> Hoặc thêm từng học viên</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <input value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Họ tên" className={inputClass} />
                    <input type="email" value={manualEmail} onChange={event => setManualEmail(event.target.value)} placeholder="Email (Gmail)" className={inputClass} />
                    <input value={manualPhone} onChange={event => setManualPhone(event.target.value)} placeholder="Số điện thoại" className={inputClass} />
                    <select value={manualCourseId} onChange={event => setManualCourseId(event.target.value)} className={inputClass} aria-label="Khóa học">
                      <option value="">Chọn khóa học</option>
                      {publishedCourses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input value={manualAmount} onChange={event => setManualAmount(event.target.value)} placeholder="Số tiền" className={inputClass} />
                      <button type="submit" className="shrink-0 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold cursor-pointer">Thêm</button>
                    </div>
                  </div>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="default-password" className="font-semibold text-slate-700">Mật khẩu mặc định cho tài khoản mới</label>
                    <input
                      id="default-password"
                      type="text"
                      value={defaultPassword}
                      onChange={event => setDefaultPassword(event.target.value)}
                      placeholder="Tối thiểu 8 ký tự, ví dụ Mcna@2026"
                      autoComplete="off"
                      className={`${inputClass} font-mono`}
                    />
                    <p className="text-[11px] text-slate-500">Học viên phải đặt mật khẩu riêng ngay lần đăng nhập đầu tiên.</p>
                  </div>
                  <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer">
                    <input type="checkbox" checked={sendAccountEmail} onChange={event => setSendAccountEmail(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
                    <span>
                      <span className="font-semibold text-slate-700 block">Gửi email thông tin đăng nhập</span>
                      <span className="text-[11px] text-slate-500">Mỗi tài khoản mới nhận một email gồm email đăng nhập và mật khẩu mặc định. Email xếp lớp được gửi riêng khi bạn xếp lớp.</span>
                    </span>
                  </label>
                </div>
              </>
            )}

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}

            {shown && (
              <div className="space-y-2">
                <div className={`rounded-xl border p-3 flex flex-wrap items-center gap-x-4 gap-y-1 ${outcome ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> {outcome ? "Kết quả nhập" : "Kết quả kiểm tra (chưa ghi dữ liệu)"}
                  </span>
                  <span>Tài khoản mới: <strong>{shown.summary.accountsCreated}</strong></span>
                  <span>Ghi danh chờ xếp lớp: <strong>{shown.summary.enrollmentsCreated + shown.summary.paymentsConfirmed}</strong></span>
                  <span>Bỏ qua: <strong>{shown.summary.skipped}</strong></span>
                  <span className={shown.summary.errors ? "text-rose-700 font-semibold" : ""}>Lỗi: <strong>{shown.summary.errors}</strong></span>
                  {outcome && sendAccountEmail && <span>Email đăng nhập: <strong>{outcome.summary.accountEmailsSent}</strong> đã gửi{outcome.summary.accountEmailsFailed ? `, ${outcome.summary.accountEmailsFailed} lỗi` : ""}</span>}
                </div>
                {outcome && outcome.summary.accountEmailsNotSent > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Máy chủ chưa cấu hình SMTP nên <strong>{outcome.summary.accountEmailsNotSent} email đăng nhập chưa được gửi</strong> (chỉ ghi vào log thử nghiệm).
                      Hãy báo email đăng nhập và mật khẩu mặc định cho học viên qua Zalo hoặc điện thoại.
                    </span>
                  </div>
                )}
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2">Học viên</th>
                        <th className="px-3 py-2">Khóa học</th>
                        <th className="px-3 py-2 whitespace-nowrap">Trạng thái</th>
                        <th className="px-3 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shown.results.map(row => (
                        <tr key={row.row} className={row.status === "error" ? "bg-rose-50/40" : ""}>
                          <td className="px-3 py-2 text-slate-400 font-mono">{row.row}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{row.name || "—"}</div>
                            <div className="text-slate-500 font-mono">{row.email}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.courseTitle || row.course}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded-md border font-semibold whitespace-nowrap ${STATUS_STYLE[row.status].className}`}>{STATUS_STYLE[row.status].label}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.message}
                            {row.accountEmail === "failed" && <div className="text-rose-700">Chưa gửi được email đăng nhập; hãy báo mật khẩu mặc định cho học viên.</div>}
                            {row.accountEmail === "mock" && <div className="text-amber-700">Email đăng nhập chưa được gửi (máy chủ chưa cấu hình SMTP).</div>}
                            {row.warnings.map((warning, index) => <div key={index} className="text-amber-700">{warning}</div>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 text-xs">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer">
              {outcome ? "Đóng" : "Hủy"}
            </button>
            {!outcome && !preview && (
              <button type="button" onClick={handlePreview} disabled={busy || rows.length === 0} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 cursor-pointer">
                {busy ? "Đang kiểm tra..." : `Kiểm tra ${rows.length || ""} dòng`}
              </button>
            )}
            {!outcome && preview && (
              <button type="button" onClick={handleImport} disabled={busy || readyCount === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer">
                {busy ? "Đang nhập..." : readyCount === 0 ? "Không có dòng nào để nhập" : `Nhập ${readyCount} học viên`}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
