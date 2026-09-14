import React, { useState } from "react";
import { Download, ExternalLink, Eye, FileText, Link2, Play, Presentation, X } from "lucide-react";
import { api } from "../api";
import { SessionMaterial } from "../types";
import { extractYoutubeVideoId, youtubeEmbedUrl } from "../utils";
import ModalPortal from "./ModalPortal";

export const MATERIAL_TYPE_LABEL: Record<SessionMaterial["type"], string> = {
  slide: "Slide",
  document: "Tài liệu",
  youtube: "YouTube",
  link: "Liên kết"
};

export function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialIcon({ type, className }: { type: SessionMaterial["type"]; className?: string }) {
  if (type === "slide") return <Presentation className={className} />;
  if (type === "document") return <FileText className={className} />;
  if (type === "youtube") return <Play className={className} />;
  return <Link2 className={className} />;
}

export const isFileMaterial = (material: SessionMaterial) => material.type === "slide" || material.type === "document";

export const isPdfMaterial = (material: SessionMaterial) =>
  material.mimeType === "application/pdf" || Boolean(material.fileName && material.fileName.toLowerCase().endsWith(".pdf"));

export const materialHref = (material: SessionMaterial) =>
  isFileMaterial(material) ? api.materialDownloadUrl(material.id) : material.url || "#";

/** Read-only view of a session's materials for learners: YouTube embeds plus download/open cards and inline PDF preview. */
export default function SessionMaterialsList({ materials }: { materials: SessionMaterial[] }) {
  const [previewPdf, setPreviewPdf] = useState<SessionMaterial | null>(null);

  if (materials.length === 0) return null;
  const videos = materials.filter(material => material.type === "youtube");
  const others = materials.filter(material => material.type !== "youtube");

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-widest block">Tài liệu buổi học</span>

      {videos.map(video => {
        const videoId = extractYoutubeVideoId(video.url || "");
        if (!videoId) return null;
        return (
          <div key={video.id} className="bg-black border border-white/10 rounded-2xl overflow-hidden">
            <div className="aspect-video w-full max-w-full">
              <iframe
                src={youtubeEmbedUrl(videoId)}
                title={video.title}
                className="w-full h-full"
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="px-4 py-2.5 text-xs font-bold text-white truncate bg-slate-950/95 border-t border-white/10">{video.title}</div>
          </div>
        );
      })}

      {others.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {others.map(material => {
            const isFile = isFileMaterial(material);
            const isPdf = isPdfMaterial(material);

            if (isPdf) {
              return (
                <div
                  key={material.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-left min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewPdf(material)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <MaterialIcon type={material.type} className="h-5 w-5 text-cyan-300 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-white truncate hover:text-indigo-300 transition">{material.title}</span>
                      <span className="block text-[10px] font-mono text-white/40 truncate">
                        {[MATERIAL_TYPE_LABEL[material.type], material.fileName, formatFileSize(material.sizeBytes)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewPdf(material)}
                      title="Xem trực tiếp PDF"
                      className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Xem
                    </button>
                    <a
                      href={materialHref(material)}
                      download={material.fileName || true}
                      title="Tải về máy"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            }

            return (
              <a
                key={material.id}
                href={materialHref(material)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-left min-w-0"
              >
                <MaterialIcon type={material.type} className="h-5 w-5 text-cyan-300 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white truncate">{material.title}</span>
                  <span className="block text-[10px] font-mono text-white/40 truncate">
                    {[MATERIAL_TYPE_LABEL[material.type], material.fileName, formatFileSize(material.sizeBytes)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {isFile ? <Download className="h-4 w-4 text-white/50 shrink-0" /> : <ExternalLink className="h-4 w-4 text-white/50 shrink-0" />}
              </a>
            );
          })}
        </div>
      )}

      {/* Inline PDF Preview Modal */}
      {previewPdf && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-white/15 w-full max-w-5xl h-[88vh] rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-400 shrink-0" />
                    <h4 className="font-bold text-white text-sm truncate">{previewPdf.title}</h4>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono uppercase font-bold shrink-0">PDF</span>
                  </div>
                  <p className="text-[11px] text-white/50 truncate font-mono mt-0.5">
                    {previewPdf.fileName} {previewPdf.sizeBytes ? `(${formatFileSize(previewPdf.sizeBytes)})` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`${api.materialDownloadUrl(previewPdf.id)}?inline=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Mở tab mới
                  </a>
                  <a
                    href={api.materialDownloadUrl(previewPdf.id)}
                    download={previewPdf.fileName || true}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" /> Tải về
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewPdf(null)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full h-full min-h-0 bg-slate-950 rounded-2xl overflow-hidden border border-white/10">
                <iframe
                  src={`${api.materialDownloadUrl(previewPdf.id)}?inline=true`}
                  title={previewPdf.title}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
