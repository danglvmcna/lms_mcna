import React, { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Dumbbell, Mail, Sparkles } from "lucide-react";
import { api } from "../../api";
import { useAppConfig } from "../../appConfig";
import { Course, SessionMaterial } from "../../types";
import { DEFAULT_WELCOME_LETTER, renderWelcomeLetter, WELCOME_LETTER_PLACEHOLDERS } from "../../welcomeLetter";
import SessionMaterialsEditor from "../SessionMaterialsEditor";

interface CourseIntroEditorProps {
  course: Course;
  introMaterials: SessionMaterial[];
  triggerToast: (message: string) => void;
  onChanged: () => void;
}

/**
 * Opening materials of a course, shown to learners once they are placed in a class:
 * the welcome letter, reference reading and practice exercises. Shared by every class of the course.
 */
export default function CourseIntroEditor({ course, introMaterials, triggerToast, onChanged }: CourseIntroEditorProps) {
  const { supportPhone } = useAppConfig();
  const [open, setOpen] = useState(false);
  const [letter, setLetter] = useState(course.welcomeLetter || DEFAULT_WELCOME_LETTER);
  const [busy, setBusy] = useState<"save" | "draft" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setLetter(course.welcomeLetter || DEFAULT_WELCOME_LETTER);
    setNote(null);
    setShowPreview(false);
  }, [course.id]);

  const savedLetter = course.welcomeLetter || DEFAULT_WELCOME_LETTER;
  const dirty = letter.trim() !== savedLetter.trim();
  const referenceCount = introMaterials.filter(item => item.category === "reference").length;
  const practiceCount = introMaterials.filter(item => item.category === "practice").length;

  const handleSave = async () => {
    setBusy("save");
    try {
      // Saving the untouched default keeps the course on "default letter" (so later template updates apply).
      await api.saveWelcomeLetter(course.id, letter.trim() === DEFAULT_WELCOME_LETTER.trim() ? "" : letter.trim());
      triggerToast("Đã lưu thư chúc mừng.");
      onChanged();
    } catch (err: any) {
      triggerToast(err.message || "Không lưu được thư chúc mừng.");
    } finally {
      setBusy(null);
    }
  };

  const handleDraft = async () => {
    if (dirty && !window.confirm("Thay nội dung đang soạn bằng bản nháp mới?")) return;
    setBusy("draft");
    setNote(null);
    try {
      const draft = await api.draftWelcomeLetter(course.id);
      setLetter(draft.letter);
      setNote(draft.source === "ai" ? "AI đã soạn bản nháp. Hãy đọc lại, chỉnh sửa rồi bấm Lưu." : draft.note || "Đang dùng thư mẫu của MCNA.");
    } catch (err: any) {
      triggerToast(err.message || "Không soạn được thư.");
    } finally {
      setBusy(null);
    }
  };

  const preview = renderWelcomeLetter(letter, {
    studentName: "Nguyễn Văn An",
    courseTitle: course.title,
    sectionCode: "(mã lớp)",
    teacherName: "(giảng viên của lớp)",
    openingDate: "(ngày khai giảng)",
    schedule: "(lịch học của lớp)",
    supportPhone
  });

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/40">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-900">Tài liệu mở đầu</span>
          <span className="block text-sm text-slate-500 mt-0.5">
            Thư chúc mừng ({course.welcomeLetter ? "đã soạn riêng" : "thư mẫu MCNA"}) · {referenceCount} sách/tài liệu tham khảo · {practiceCount} bài luyện tập. Dùng chung cho mọi lớp của khóa này.
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-6 border-t border-indigo-200 px-4 py-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-600" /> Thư chúc mừng</h5>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={handleDraft} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 cursor-pointer">
                  <Sparkles className="h-3.5 w-3.5" /> {busy === "draft" ? "Đang soạn..." : "Soạn bằng AI"}
                </button>
                <button type="button" onClick={() => { setLetter(DEFAULT_WELCOME_LETTER); setNote(null); }} disabled={busy !== null} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                  Dùng thư mẫu
                </button>
                <button type="button" onClick={() => setShowPreview(current => !current)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  {showPreview ? "Sửa thư" : "Xem thử"}
                </button>
                <button type="button" onClick={handleSave} disabled={busy !== null || !dirty} className="rounded-lg bg-indigo-600 px-3.5 py-1.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                  {busy === "save" ? "Đang lưu..." : dirty ? "Lưu thư" : "Đã lưu"}
                </button>
              </div>
            </div>
            {note && <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">{note}</p>}
            {showPreview ? (
              <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">{preview}</div>
            ) : (
              <textarea
                value={letter}
                onChange={event => setLetter(event.target.value)}
                maxLength={8000}
                rows={12}
                aria-label="Nội dung thư chúc mừng"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
              />
            )}
            <p className="text-[11px] leading-relaxed text-slate-500">
              Các biến được thay tự động theo từng học viên và lớp:{" "}
              {WELCOME_LETTER_PLACEHOLDERS.map((item, index) => (
                <span key={item.token}>
                  <code className="font-mono text-indigo-700">{item.token}</code> ({item.label.toLowerCase()}){index < WELCOME_LETTER_PLACEHOLDERS.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>

          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-600" /> Sách & tài liệu tham khảo</h5>
            <SessionMaterialsEditor owner={{ kind: "intro", courseId: course.id, category: "reference" }} triggerToast={triggerToast} onChanged={onChanged} />
          </div>

          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Dumbbell className="h-4 w-4 text-indigo-600" /> Bài luyện tập</h5>
            <SessionMaterialsEditor owner={{ kind: "intro", courseId: course.id, category: "practice" }} triggerToast={triggerToast} onChanged={onChanged} />
          </div>
        </div>
      )}
    </section>
  );
}
