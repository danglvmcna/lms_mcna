import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Clock, Database, Download, ExternalLink, Eye, EyeOff, FileText, Link2, Pencil, Trash2, X } from "lucide-react";
import { api } from "../api";
import { learnerMaterialAccess, MATERIAL_EXTENSIONS } from "../materialAccess";
import { IntroMaterialCategory, SessionMaterial } from "../types";
import { extractYoutubeVideoId } from "../utils";
import { formatFileSize, formatUploadTime, getMaterialTypeMeta, isFileMaterial, materialHref } from "./SessionMaterialsList";
import { PowerPointLogo } from "./icons/BrandLogos";

const MATERIAL_MAX_BYTES = 50 * 1024 * 1024; // mirrors the server upload limit

// A list of materials belongs either to one session of a class, or to a course's opening materials.
export type MaterialsOwner =
  | { kind: "session"; sessionId: string }
  | { kind: "intro"; courseId: string; category: IntroMaterialCategory };

interface SessionMaterialsEditorProps {
  sessionId?: string;
  owner?: MaterialsOwner;
  triggerToast: (message: string) => void;
  onChanged?: () => void;
  theme?: "light" | "dark";
}

const ownerKey = (owner: MaterialsOwner) => (owner.kind === "session" ? `session:${owner.sessionId}` : `intro:${owner.courseId}:${owner.category}`);

/** Staff editor for slides, documents, data files and links. Learners read slides/documents online and download data files only. */
export default function SessionMaterialsEditor({ sessionId, owner: ownerProp, triggerToast, onChanged, theme = "light" }: SessionMaterialsEditorProps) {
  const owner: MaterialsOwner = ownerProp || { kind: "session", sessionId: sessionId || "" };
  const key = ownerKey(owner);
  const [materials, setMaterials] = useState<SessionMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const isLight = theme === "light";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditingId(null);
    const request = owner.kind === "session"
      ? api.listSessionMaterials(owner.sessionId)
      : api.listIntroMaterials(owner.courseId).then(items => items.filter(item => item.category === owner.category));
    request
      .then(items => {
        if (!cancelled) setMaterials(items);
      })
      .catch((err: any) => {
        if (!cancelled) triggerToast(err.message || "Không tải được danh sách tài liệu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const run = async (action: () => Promise<string | void>, successMessage?: string) => {
    setBusy(true);
    try {
      const warning = await action();
      if (warning) triggerToast(warning);
      else if (successMessage) triggerToast(successMessage);
      onChanged?.();
    } catch (err: any) {
      triggerToast(err.message || "Thao tác với tài liệu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = (type: "slide" | "document" | "data") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MATERIAL_MAX_BYTES) {
      triggerToast("Tệp tài liệu phải nhỏ hơn 50 MB.");
      return;
    }
    await run(async () => {
      const created = owner.kind === "session"
        ? await api.uploadSessionMaterial(owner.sessionId, type, file)
        : await api.uploadIntroMaterial(owner.courseId, owner.category, type === "slide" ? "document" : type, file);
      const { warning, ...material } = created;
      setMaterials(prev => [...prev, material]);
      return warning;
    }, type === "data" ? "Đã tải file data (học viên được tải về)." : "Đã tải tài liệu (học viên chỉ xem trực tuyến).");
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      triggerToast("Liên kết phải bắt đầu bằng http:// hoặc https://.");
      return;
    }
    const type = extractYoutubeVideoId(url) ? "youtube" : "link";
    await run(async () => {
      const payload = { type, url, title: linkTitle.trim() || undefined } as const;
      const created = owner.kind === "session"
        ? await api.addLinkMaterial(owner.sessionId, payload)
        : await api.addIntroLink(owner.courseId, { ...payload, category: owner.category });
      setMaterials(prev => [...prev, created]);
      setLinkUrl("");
      setLinkTitle("");
    }, type === "youtube" ? "Đã thêm video YouTube." : "Đã thêm liên kết.");
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= materials.length) return;
    const next = [...materials];
    [next[index], next[target]] = [next[target], next[index]];
    const ids = next.map(material => material.id);
    void run(async () => {
      setMaterials(owner.kind === "session"
        ? await api.reorderSessionMaterials(owner.sessionId, ids)
        : await api.reorderIntroMaterials(owner.courseId, owner.category, ids));
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
    if (!window.confirm(`Xóa "${material.title}"?`)) return;
    await run(async () => {
      await api.deleteSessionMaterial(material.id);
      setMaterials(prev => prev.filter(item => item.id !== material.id));
    }, "Đã xóa tài liệu.");
  };

  const uploadButtonClass = `flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer text-white shadow-sm active:scale-[0.98] ${busy ? "opacity-50 pointer-events-none" : ""}`;
  const inputClass = `min-w-0 px-3.5 py-2 rounded-xl border text-xs transition focus:outline-none ${
    isLight
      ? "bg-white text-slate-900 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 placeholder-slate-400"
      : "bg-slate-950 text-white border-white/10 focus:border-indigo-400 placeholder-white/30"
  }`;

  return (
    <div className={`p-4 rounded-2xl space-y-3 font-sans text-xs transition-colors ${
      isLight
        ? "bg-slate-50/80 border border-slate-200 text-slate-800"
        : "bg-slate-900/60 border border-white/10 text-white shadow-md"
    }`}>
      <div className={`flex items-center justify-between gap-2 pb-2 border-b ${isLight ? "border-slate-200" : "border-white/5"}`}>
        <h5 className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? "text-slate-600" : "text-white/70"}`}>
          {owner.kind === "session" ? "Slide, tài liệu, file data & liên kết" : "Tài liệu, file data & liên kết"}
        </h5>
        {busy && <span className={`h-4 w-4 rounded-full border-2 border-t-transparent animate-spin ${isLight ? "border-indigo-600" : "border-cyan-300"}`} aria-label="Đang xử lý" />}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {owner.kind === "session" && (
          <label className={`${uploadButtonClass} bg-[#D24726] hover:bg-[#b83b1d]`}>
            <PowerPointLogo className="h-4 w-4 shrink-0" /> Slide (nên dùng PDF)
            <input type="file" accept={MATERIAL_EXTENSIONS.slide.join(",")} className="hidden" onChange={handleUpload("slide")} disabled={busy} />
          </label>
        )}
        <label className={`${uploadButtonClass} bg-[#2B579A] hover:bg-[#234a84]`}>
          <FileText className="h-4 w-4 shrink-0" /> Tài liệu (PDF, Word)
          <input type="file" accept={MATERIAL_EXTENSIONS.document.join(",")} className="hidden" onChange={handleUpload("document")} disabled={busy} />
        </label>
        <label className={`${uploadButtonClass} bg-[#107C41] hover:bg-[#0d6434]`}>
          <Database className="h-4 w-4 shrink-0" /> File data (học viên được tải)
          <input type="file" accept={MATERIAL_EXTENSIONS.data.join(",")} className="hidden" onChange={handleUpload("data")} disabled={busy} />
        </label>
      </div>
      <p className={`text-[11px] leading-relaxed ${isLight ? "text-slate-500" : "text-white/50"}`}>
        Học viên chỉ <strong>xem trực tuyến</strong> slide và tài liệu (cần file PDF để hiển thị) và chỉ <strong>tải được file data</strong> (Excel, CSV, ZIP, JSON...).
      </p>

      <form onSubmit={handleAddLink} className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={linkUrl}
          onChange={e => setLinkUrl(e.target.value)}
          placeholder="Dán link YouTube hoặc liên kết tham khảo (https://...)"
          className={`flex-1 ${inputClass}`}
        />
        <input
          type="text"
          value={linkTitle}
          onChange={e => setLinkTitle(e.target.value)}
          placeholder="Tiêu đề (tùy chọn)"
          className={`sm:w-52 ${inputClass}`}
        />
        <button
          type="submit"
          disabled={busy || !linkUrl.trim()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <Link2 className="h-4 w-4 shrink-0" /> Thêm liên kết
        </button>
      </form>

      {loading ? (
        <div className={`py-6 text-center ${isLight ? "text-slate-400" : "text-white/40"}`}>Đang tải tài liệu...</div>
      ) : materials.length === 0 ? (
        <div className={`py-8 text-center rounded-xl border border-dashed text-xs ${
          isLight ? "bg-white border-slate-200 text-slate-500" : "bg-black/20 border-white/5 text-white/40"
        }`}>
          Chưa có mục nào. Dùng các nút phía trên để tải tệp hoặc thêm liên kết.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {materials.map((material, index) => {
            const meta = getMaterialTypeMeta(material);
            const uploadTime = formatUploadTime(material.createdAt);
            const isFile = isFileMaterial(material);
            const access = learnerMaterialAccess(material);

            return (
              <li
                key={material.id}
                className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all ${
                  isLight ? `bg-white border-slate-200/90 ${meta.hoverBorder} hover:shadow-xs` : "bg-black/20 border-white/5"
                }`}
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${meta.iconBg} ${meta.iconColor} shadow-2xs`}>
                  <meta.Icon className="h-5 w-5" />
                </div>

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
                        isLight ? "bg-white text-slate-900 border-indigo-600 ring-2 ring-indigo-100" : "bg-slate-950 text-white border-indigo-400"
                      }`}
                    />
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-xs truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                        {material.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider shrink-0 border ${meta.badgeStyle}`}>
                        {meta.badge}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-mono">
                    {access === "view" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 font-sans font-semibold text-[10px]">
                        <Eye className="h-3 w-3" /> Học viên chỉ xem
                      </span>
                    )}
                    {access === "download" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 font-sans font-semibold text-[10px]">
                        <Download className="h-3 w-3" /> Học viên được tải
                      </span>
                    )}
                    {access === "unavailable" && (
                      <span
                        title="Học viên không tải được slide/tài liệu và chỉ xem được file PDF. Hãy xuất tệp này sang PDF rồi tải lên."
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-300 font-sans font-semibold text-[10px]"
                      >
                        <EyeOff className="h-3 w-3" /> Học viên chưa xem được, cần bản PDF
                      </span>
                    )}
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono font-medium ${
                        isLight
                          ? "bg-slate-50 text-slate-600 border-slate-200"
                          : "bg-white/5 text-white/60 border-white/10"
                      }`}>
                        <Clock className="h-3 w-3 text-slate-400" />
                        {uploadTime}
                      </span>
                    )}
                  </div>
                </div>

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
