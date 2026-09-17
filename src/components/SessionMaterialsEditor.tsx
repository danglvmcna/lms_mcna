import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Clock, Download, ExternalLink, Pencil, Play, Presentation, FileText, Trash2, X } from "lucide-react";
import { api } from "../api";
import { SessionMaterial } from "../types";
import { extractYoutubeVideoId } from "../utils";
import { formatFileSize, formatUploadTime, getMaterialTypeMeta, isFileMaterial, MATERIAL_TYPE_LABEL, MaterialIcon, materialHref } from "./SessionMaterialsList";

const MATERIAL_MAX_BYTES = 50 * 1024 * 1024; // mirrors the server upload limit

interface SessionMaterialsEditorProps {
  sessionId: string;
  triggerToast: (message: string) => void;
  onChanged?: () => void;
  theme?: "light" | "dark";
}

/** Teacher/admin editor for one session's slides, documents and YouTube videos. */
export default function SessionMaterialsEditor({ sessionId, triggerToast, onChanged, theme = "light" }: SessionMaterialsEditorProps) {
  const [materials, setMaterials] = useState<SessionMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const isLight = theme === "light";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditingId(null);
    api.listSessionMaterials(sessionId)
      .then(items => {
        if (!cancelled) setMaterials(items);
      })
      .catch((err: any) => {
        if (!cancelled) triggerToast(err.message || "Không tải được tài liệu buổi học.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const run = async (action: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    try {
      await action();
      if (successMessage) triggerToast(successMessage);
      onChanged?.();
    } catch (err: any) {
      triggerToast(err.message || "Thao tác với tài liệu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = (type: "slide" | "document") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MATERIAL_MAX_BYTES) {
      triggerToast("Tệp tài liệu phải nhỏ hơn 50 MB.");
      return;
    }
    await run(async () => {
      const created = await api.uploadSessionMaterial(sessionId, type, file);
      setMaterials(prev => [...prev, created]);
    }, type === "slide" ? "Đã tải slide lên buổi học." : "Đã tải tài liệu lên buổi học.");
  };

  const handleAddYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractYoutubeVideoId(youtubeUrl)) {
      triggerToast("Link YouTube không hợp lệ.");
      return;
    }
    await run(async () => {
      const created = await api.addLinkMaterial(sessionId, { type: "youtube", url: youtubeUrl.trim(), title: youtubeTitle.trim() || undefined });
      setMaterials(prev => [...prev, created]);
      setYoutubeUrl("");
      setYoutubeTitle("");
    }, "Đã thêm video YouTube vào buổi học.");
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= materials.length) return;
    const next = [...materials];
    [next[index], next[target]] = [next[target], next[index]];
    void run(async () => {
      setMaterials(await api.reorderSessionMaterials(sessionId, next.map(material => material.id)));
    });
  };

  const handleRename = async (material: SessionMaterial) => {
    const title = editingTitle.trim();
    if (!title) return;
    await run(async () => {
      const updated = await api.updateSessionMaterial(material.id, { title });
      setMaterials(prev => prev.map(item => (item.id === material.id ? updated : item)));
      setEditingId(null);
    }, "Đã đổi tên tài liệu.");
  };

  const handleDelete = async (material: SessionMaterial) => {
    if (!window.confirm(`Xóa "${material.title}" khỏi buổi học?`)) return;
    await run(async () => {
      await api.deleteSessionMaterial(material.id);
      setMaterials(prev => prev.filter(item => item.id !== material.id));
    }, "Đã xóa tài liệu.");
  };

  const uploadButtonClass = "flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer text-white shadow-sm";

  return (
    <div className={`p-4 rounded-2xl space-y-3 font-sans text-xs transition-colors ${
      isLight 
        ? "bg-slate-50/80 border border-slate-200 text-slate-800" 
        : "bg-slate-900/60 border border-white/10 text-white shadow-md"
    }`}>
      <div className={`flex items-center justify-between gap-2 pb-2 border-b ${
        isLight ? "border-slate-200" : "border-white/5"
      }`}>
        <h5 className={`font-bold uppercase tracking-wider text-[11px] ${
          isLight ? "text-slate-600" : "text-white/70"
        }`}>Slide, tài liệu & video YouTube</h5>
        {busy && <span className={`h-4 w-4 rounded-full border-2 border-t-transparent animate-spin ${
          isLight ? "border-indigo-600" : "border-cyan-300"
        }`} aria-label="Đang xử lý" />}
      </div>

      <div className="flex flex-wrap gap-2.5">
        <label className={`${uploadButtonClass} bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          <Presentation className="h-4 w-4" /> Tải slide (PPT/PDF)
          <input type="file" accept=".ppt,.pptx,.pdf" className="hidden" onChange={handleUpload("slide")} disabled={busy} />
        </label>
        <label className={`${uploadButtonClass} bg-sky-600 hover:bg-sky-700 active:scale-[0.98] ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          <FileText className="h-4 w-4" /> Tải file Word/PDF
          <input type="file" accept=".doc,.docx,.pdf" className="hidden" onChange={handleUpload("document")} disabled={busy} />
        </label>
      </div>

      <form onSubmit={handleAddYoutube} className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={youtubeUrl}
          onChange={e => setYoutubeUrl(e.target.value)}
          placeholder="Dán link YouTube (youtube.com/watch?v=... hoặc youtu.be/...)"
          className={`flex-1 min-w-0 px-3.5 py-2 rounded-xl border text-xs transition focus:outline-none ${
            isLight
              ? "bg-white text-slate-900 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 placeholder-slate-400"
              : "bg-slate-950 text-white border-white/10 focus:border-indigo-400 placeholder-white/30"
          }`}
        />
        <input
          type="text"
          value={youtubeTitle}
          onChange={e => setYoutubeTitle(e.target.value)}
          placeholder="Tiêu đề video (tùy chọn)"
          className={`sm:w-52 min-w-0 px-3.5 py-2 rounded-xl border text-xs transition focus:outline-none ${
            isLight
              ? "bg-white text-slate-900 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 placeholder-slate-400"
              : "bg-slate-950 text-white border-white/10 focus:border-indigo-400 placeholder-white/30"
          }`}
        />
        <button
          type="submit"
          disabled={busy || !youtubeUrl.trim()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" /> Thêm video
        </button>
      </form>

      {loading ? (
        <div className={`py-6 text-center ${isLight ? "text-slate-400" : "text-white/40"}`}>Đang tải tài liệu...</div>
      ) : materials.length === 0 ? (
        <div className={`py-8 text-center rounded-xl border border-dashed text-xs ${
          isLight
            ? "bg-white border-slate-200 text-slate-500"
            : "bg-black/20 border-white/5 text-white/40"
        }`}>
          Buổi học này chưa có tài liệu nào. Bấm nút phía trên để tải slide, file tài liệu hoặc thêm video bài giảng!
        </div>
      ) : (
        <ul className="space-y-2.5">
          {materials.map((material, index) => {
            const meta = getMaterialTypeMeta(material);
            const uploadTime = formatUploadTime(material.createdAt);
            const isFile = isFileMaterial(material);

            return (
              <li
                key={material.id}
                className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all ${
                  isLight
                    ? `bg-white border-slate-200/90 ${meta.hoverBorder} hover:shadow-xs`
                    : "bg-black/20 border-white/5"
                }`}
              >
                {/* Colorful Icon Box */}
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${meta.iconBg} ${meta.iconColor} shadow-2xs`}>
                  <meta.Icon className="h-5 w-5" />
                </div>

                {/* Content & Metadata */}
                <div className="min-w-0 flex-1">
                  {editingId === material.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") void handleRename(material);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className={`w-full px-2.5 py-1 rounded-lg border focus:outline-none text-xs font-semibold ${
                        isLight
                          ? "bg-white text-slate-900 border-indigo-600 ring-2 ring-indigo-100"
                          : "bg-slate-950 text-white border-indigo-400"
                      }`}
                    />
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-xs truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                        {material.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 border ${meta.badgeStyle}`}>
                        {meta.badge}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-mono">
                    <span className={`font-medium ${isLight ? "text-slate-600" : "text-white/60"}`}>
                      {meta.label}
                    </span>
                    {material.fileName && material.fileName !== material.title && (
                      <span className={`truncate max-w-[200px] sm:max-w-xs ${isLight ? "text-slate-500" : "text-white/40"}`}>
                        {material.fileName}
                      </span>
                    )}
                    {material.sizeBytes ? (
                      <span className={isLight ? "text-slate-400" : "text-white/40"}>
                        {formatFileSize(material.sizeBytes)}
                      </span>
                    ) : null}
                    {uploadTime && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono font-medium ${
                        isLight
                          ? "bg-slate-50 text-slate-600 border-slate-200"
                          : "bg-white/5 text-white/60 border-white/10"
                      }`}>
                        <Clock className="h-3 w-3 text-slate-400" />
                        Tải lên: {uploadTime}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === material.id ? (
                    <>
                      <IconButton isLight={isLight} title="Lưu tên" onClick={() => void handleRename(material)} disabled={busy}><Check className="h-4 w-4 text-emerald-600" /></IconButton>
                      <IconButton isLight={isLight} title="Hủy" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></IconButton>
                    </>
                  ) : (
                    <>
                      <a
                        href={materialHref(material)}
                        target="_blank"
                        rel="noreferrer"
                        title={isFile ? "Tải về / mở tệp" : "Mở liên kết"}
                        className={`p-2 rounded-xl transition cursor-pointer border ${
                          isLight
                            ? "border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200"
                            : "border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {isFile ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                      </a>
                      <IconButton isLight={isLight} title="Lên" onClick={() => handleMove(index, -1)} disabled={busy || index === 0}><ArrowUp className="h-4 w-4" /></IconButton>
                      <IconButton isLight={isLight} title="Xuống" onClick={() => handleMove(index, 1)} disabled={busy || index === materials.length - 1}><ArrowDown className="h-4 w-4" /></IconButton>
                      <IconButton isLight={isLight} title="Đổi tên" onClick={() => { setEditingId(material.id); setEditingTitle(material.title); }} disabled={busy}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton isLight={isLight} title="Xóa" onClick={() => void handleDelete(material)} disabled={busy} danger><Trash2 className="h-4 w-4" /></IconButton>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function IconButton({ title, onClick, disabled, danger, isLight, children }: { title: string; onClick: () => void; disabled?: boolean; danger?: boolean; isLight?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
        danger 
          ? isLight 
            ? "text-rose-600 hover:bg-rose-50" 
            : "text-red-400 hover:bg-red-500/15" 
          : isLight 
            ? "text-slate-500 hover:text-slate-900 hover:bg-slate-200/70" 
            : "text-white/60 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
