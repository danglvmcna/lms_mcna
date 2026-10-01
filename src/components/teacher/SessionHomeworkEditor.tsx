import React, { useState } from "react";
import { ClipboardList, Clock, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../../api";
import { Assignment, Submission } from "../../types";

interface SessionHomeworkEditorProps {
  courseId: string;
  sessionId: string;
  sessionDate?: string;
  assignments: Assignment[];
  submissions: Submission[];
  triggerToast: (message: string) => void;
  onChanged: () => void;
}

const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

// "2026-10-15T23:59" for <input type="datetime-local">, in the browser's timezone.
const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

// One week after the session, end of day.
function defaultDeadline(sessionDate?: string) {
  const base = sessionDate ? new Date(sessionDate) : new Date();
  const start = Number.isNaN(base.getTime()) ? new Date() : base;
  const deadline = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  deadline.setHours(23, 59, 0, 0);
  return toLocalInput(deadline);
}

export const formatDeadline = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const attachmentName = (url: string) => decodeURIComponent(url.split("/").pop() || url).replace(/^\d+-\d+-/, "");

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20";

/** Homework of one class session: staff add, edit and remove the assignments learners see under that session. */
export default function SessionHomeworkEditor({ courseId, sessionId, sessionDate, assignments, submissions, triggerToast, onChanged }: SessionHomeworkEditorProps) {
  const [editing, setEditing] = useState<Assignment | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [allowLate, setAllowLate] = useState(false);
  const [assignmentType, setAssignmentType] = useState<Assignment['type']>('lesson');
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const openForm = (assignment: Assignment | "new") => {
    setEditing(assignment);
    if (assignment === "new") {
      setTitle("");
      setDescription("");
      setDeadline(defaultDeadline(sessionDate));
      setMaxScore(10);
      setAllowLate(false);
      setAssignmentType('lesson');
      setAttachmentUrl("");
    } else {
      setTitle(assignment.title);
      setDescription(assignment.description);
      setDeadline(assignment.deadline.length >= 16 && !assignment.deadline.endsWith("Z") ? assignment.deadline.slice(0, 16) : toLocalInput(new Date(assignment.deadline)));
      setMaxScore(assignment.maxScore);
      setAllowLate(Boolean(assignment.allowLate));
      setAssignmentType(assignment.type || 'lesson');
      setAttachmentUrl(assignment.attachmentUrl || "");
    }
  };

  const handleAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_BYTES) {
      triggerToast("Tệp đính kèm phải nhỏ hơn 50 MB.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploadFile(file);
      setAttachmentUrl(uploaded.url);
    } catch (err: any) {
      triggerToast(err.message || "Không tải được tệp đính kèm.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !deadline) {
      triggerToast("Nhập tên bài tập, yêu cầu và hạn nộp.");
      return;
    }
    setBusy(true);
    try {
      if (editing === "new") {
        await api.createAssignment({ courseId, sessionId, title: title.trim(), description: description.trim(), deadline: new Date(deadline).toISOString(), maxScore, attachmentUrl: attachmentUrl || undefined, type: assignmentType, allowLate });
        triggerToast("Đã giao bài tập về nhà cho buổi học.");
      } else if (editing) {
        await api.updateAssignment(editing.id, { title: title.trim(), description: description.trim(), deadline: new Date(deadline).toISOString(), maxScore, attachmentUrl: attachmentUrl || null, type: assignmentType, allowLate });
        triggerToast("Đã cập nhật bài tập.");
      }
      setEditing(null);
      onChanged();
    } catch (err: any) {
      triggerToast(err.message || "Không lưu được bài tập.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (assignment: Assignment) => {
    const submitted = submissions.filter(item => item.assignmentId === assignment.id).length;
    const warning = submitted > 0 ? ` ${submitted} bài nộp của học viên cũng sẽ bị xóa.` : "";
    if (!window.confirm(`Xóa bài tập "${assignment.title}"?${warning}`)) return;
    setBusy(true);
    try {
      await api.deleteAssignment(assignment.id);
      triggerToast("Đã xóa bài tập.");
      onChanged();
    } catch (err: any) {
      triggerToast(err.message || "Không xóa được bài tập.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-600" />
            Bài tập về nhà ({assignments.length})
          </h4>
          <p className="text-sm text-slate-500 mt-1">Bài tập hiển thị cho học viên của lớp ngay trong buổi học này.</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => openForm("new")} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer shrink-0">
            <Plus className="h-3.5 w-3.5" /> Giao bài tập
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSave} className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{editing === "new" ? "Bài tập mới" : "Sửa bài tập"}</span>
            <button type="button" onClick={() => setEditing(null)} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Tên bài tập, ví dụ: Dựng workflow gửi email tự động" className={inputClass} required />
          <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Yêu cầu bài tập, cách nộp, tiêu chí đánh giá..." rows={4} className={inputClass} required />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowLate} onChange={e=>setAllowLate(e.target.checked)}/> Cho phép nộp muộn</label>
          <label className="block text-sm">Loại bài tập<select className={inputClass} value={assignmentType} onChange={e=>setAssignmentType(e.target.value as Assignment['type'])}><option value="lesson">Bài tập buổi học</option><option value="final">Bài cuối khóa (xét chứng chỉ)</option><option value="chapter">Bài chuyên đề</option><option value="midterm">Bài giữa khóa</option></select></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Hạn nộp
              <input type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} className={inputClass} required />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Thang điểm
              <input type="number" min={1} max={1000} value={maxScore} onChange={event => setMaxScore(Number(event.target.value) || 10)} className={inputClass} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {attachmentUrl ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="max-w-[220px] truncate font-medium text-indigo-700 hover:underline">{attachmentName(attachmentUrl)}</a>
                <button type="button" onClick={() => setAttachmentUrl("")} aria-label="Bỏ tệp đính kèm" className="text-slate-400 hover:text-rose-600 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
              </span>
            ) : (
              <label className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Đang tải tệp..." : "Đính kèm đề bài"}
                <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.zip,.png,.jpg,.jpeg" className="hidden" onChange={handleAttachment} disabled={uploading} />
              </label>
            )}
            <span className="text-[11px] text-slate-500">Nên dùng PDF để học viên xem đề ngay trên LMS.</span>
          </div>
          <div className="flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-700 hover:bg-slate-200 cursor-pointer">Hủy</button>
            <button type="submit" disabled={busy || uploading} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">{busy ? "Đang lưu..." : "Lưu bài tập"}</button>
          </div>
        </form>
      )}

      {assignments.length === 0 && !editing ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-slate-500">Buổi học này chưa có bài tập về nhà.</p>
      ) : (
        <ul className="space-y-2.5">
          {assignments.map(assignment => {
            const submitted = submissions.filter(item => item.assignmentId === assignment.id).length;
            return (
              <li key={assignment.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{assignment.title}</p>
                  <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-line">{assignment.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Hạn nộp: {formatDeadline(assignment.deadline)}</span>
                    <span>Thang điểm {assignment.maxScore}</span>
                    {assignment.attachmentUrl && <a href={assignment.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline"><Paperclip className="h-3.5 w-3.5" /> {attachmentName(assignment.attachmentUrl)}</a>}
                    {submitted > 0 && <span className="font-medium text-emerald-700">{submitted} bài đã nộp</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openForm(assignment)} disabled={busy} aria-label="Sửa bài tập" title="Sửa bài tập" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-40 cursor-pointer"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => handleDelete(assignment)} disabled={busy} aria-label="Xóa bài tập" title="Xóa bài tập" className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
