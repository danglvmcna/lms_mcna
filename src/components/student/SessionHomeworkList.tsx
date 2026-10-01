import React, { useState } from "react";
import { CheckCircle, Clock, Download, Eye, FileText, Paperclip, X } from "lucide-react";
import { Assignment, Submission } from "../../types";
import LinkedText from "../LinkedText";
import ModalPortal from "../ModalPortal";
import PdfViewer from "../common/PdfViewer";
import ProtectedImage from "../common/ProtectedImage";
import { attachmentName, formatDeadline } from "../teacher/SessionHomeworkEditor";
import HomeworkSubmission from "../operations/HomeworkSubmission";

interface SessionHomeworkListProps {
  assignments: Assignment[];
  submissions: Submission[];
  // Whether learners may download the attached brief; view-only until MCNA decides otherwise.
  allowDownload: boolean;
  onChanged: () => void;
}

const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);
const isImage = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

/** Homework of one class session as the learner sees it: the brief, its deadline and the attached file. */
export default function SessionHomeworkList({ assignments, submissions, allowDownload, onChanged }: SessionHomeworkListProps) {
  const [viewing, setViewing] = useState<Assignment | null>(null);

  if (assignments.length === 0) {
    return <p className="py-2 text-sm text-slate-500">Buổi học này chưa có bài tập về nhà.</p>;
  }

  return (
    <div className="space-y-3">
      {assignments.map(assignment => {
        const submission = submissions.find(item => item.assignmentId === assignment.id);
        const overdue = new Date(assignment.deadline).getTime() < Date.now();
        const attachment = assignment.attachmentUrl;
        const canViewOnline = Boolean(attachment && (isPdf(attachment) || isImage(attachment)));

        return (
          <article key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <h5 className="font-bold text-slate-900 text-base leading-snug">{assignment.title}</h5>
              <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${overdue ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                <Clock className="h-3.5 w-3.5" /> {overdue ? "Đã quá hạn" : "Hạn nộp"}: {formatDeadline(assignment.deadline)}
              </span>
            </div>

            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              <LinkedText text={assignment.description} />
            </div>

            {attachment && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-slate-600"><Paperclip className="h-4 w-4 text-slate-400" /> {attachmentName(attachment)}</span>
                {canViewOnline && (
                  <button type="button" onClick={() => setViewing(assignment)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer">
                    <Eye className="h-3.5 w-3.5" /> Xem đề bài
                  </button>
                )}
                {allowDownload && (
                  <a href={attachment} download className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5" /> Tải về
                  </a>
                )}
                {!canViewOnline && !allowDownload && (
                  <span className="text-xs text-slate-500">Tệp này chưa xem được trực tuyến; giảng viên sẽ chia sẻ trong nhóm lớp.</span>
                )}
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Thang điểm {assignment.maxScore}</span>
              {submission ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {submission.score !== undefined && submission.score !== null ? `Đã chấm: ${submission.score}/${assignment.maxScore}` : "Đã nộp, chờ chấm"}
                </span>
              ) : (
                <span>Chưa nộp bài.</span>
              )}
            </div>
            {submission?.feedback && <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">Nhận xét: {submission.feedback}</p>}
            <HomeworkSubmission key={`${assignment.id}-${submission?.submittedAt || 'new'}`} assignment={assignment} submission={submission} onChanged={onChanged}/>
          </article>
        );
      })}

      {viewing?.attachmentUrl && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-2 md:p-6">
            <div className="bg-white border border-slate-200 w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600 shrink-0" /> {viewing.title}</h4>
                <button type="button" onClick={() => setViewing(null)} aria-label="Đóng" className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {isPdf(viewing.attachmentUrl) ? (
                  <PdfViewer url={viewing.attachmentUrl} title={viewing.title} />
                ) : (
                  <ProtectedImage url={viewing.attachmentUrl} title={viewing.title}/>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
