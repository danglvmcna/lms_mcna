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
      <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-widest block">Tài liệu buổi học</span>

      {videos.map(video => {
        const videoId = extractYoutubeVideoId(video.url || "");
        if (!videoId) return null;
        return (
          <div key={video.id} className="bg-black border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
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
            <div className="px-4 py-2.5 text-xs font-bold text-slate-800 truncate bg-slate-50 border-t border-slate-200">{video.title}</div>
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
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 transition text-left min-w-0 shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewPdf(material)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <MaterialIcon type={material.type} className="h-5 w-5 text-indigo-600 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900 truncate hover:text-indigo-600 transition">{material.title}</span>
                      <span className="block text-[10px] font-mono text-slate-400 truncate">
                        {[MATERIAL_TYPE_LABEL[material.type], material.fileName, formatFileSize(material.sizeBytes)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewPdf(material)}
                      title="Xem trực tiếp PDF"
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer text-xs font-semibold flex items-center gap-1 border border-indigo-200/60"
                    >
                      <Eye className="h-3.5 w-3.5" /> Xem
                    </button>
                    <a
                      href={materialHref(material)}
                      download={material.fileName || true}
                      title="Tải về máy"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
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
                className="flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 transition text-left min-w-0 shadow-xs"
              >
                <MaterialIcon type={material.type} className="h-5 w-5 text-indigo-600 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 truncate">{material.title}</span>
                  <span className="block text-[10px] font-mono text-slate-400 truncate">
                    {[MATERIAL_TYPE_LABEL[material.type], material.fileName, formatFileSize(material.sizeBytes)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {isFile ? <Download className="h-4 w-4 text-slate-400 shrink-0" /> : <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />}
              </a>
            );
          })}
        </div>
      )}

      {/* Inline PDF Preview Modal */}
      {previewPdf && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 w-full max-w-5xl h-[88vh] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
                    <h4 className="font-bold text-slate-900 text-sm truncate">{previewPdf.title}</h4>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-mono uppercase font-bold shrink-0 border border-indigo-200/60">PDF</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate font-mono mt-0.5">
                    {previewPdf.fileName} {previewPdf.sizeBytes ? `(${formatFileSize(previewPdf.sizeBytes)})` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`${api.materialDownloadUrl(previewPdf.id)}?inline=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Mở tab mới
                  </a>
                  <a
                    href={api.materialDownloadUrl(previewPdf.id)}
                    download={previewPdf.fileName || true}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Tải về
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewPdf(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full h-full min-h-0 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
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
