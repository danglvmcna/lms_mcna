import React, { useState } from "react";
import { Archive, BarChart3, Clock, Download, ExternalLink, Eye, FileSpreadsheet, FileText, Link2, Play, Presentation, X } from "lucide-react";
import { api } from "../api";
import { SessionMaterial } from "../types";
import { extractYoutubeVideoId, youtubeEmbedUrl } from "../utils";
import ModalPortal from "./ModalPortal";
import { PowerPointLogo, WordLogo, ExcelLogo, YouTubeLogo, PdfLogo } from "./icons/BrandLogos";

export const MATERIAL_TYPE_LABEL: Record<SessionMaterial["type"], string> = {
  slide: "Slide",
  document: "Tài liệu",
  youtube: "YouTube",
  link: "Liên kết"
};

export type MaterialFileType = "pptx" | "docx" | "pdf" | "xlsx" | "pbix" | "zip" | "youtube" | "link";

export interface MaterialVisualMeta {
  key: MaterialFileType;
  badge: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  badgeStyle: string;
  hoverBorder: string;
  actionButton: string;
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} · ${date}`;
}

export function getMaterialTypeMeta(material: SessionMaterial): MaterialVisualMeta {
  const ext = (material.fileName ? material.fileName.split(".").pop()?.toLowerCase() : "") || "";
  const isPdf = material.mimeType === "application/pdf" || ext === "pdf";

  if (isPdf) {
    return {
      key: "pdf",
      badge: "PDF",
      label: "Tài liệu PDF",
      Icon: PdfLogo,
      iconColor: "",
      iconBg: "bg-rose-50 border-rose-200/90",
      badgeStyle: "bg-rose-50 text-rose-700 border-rose-200 font-bold",
      hoverBorder: "hover:border-rose-300",
      actionButton: "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80"
    };
  }

  // Power BI Desktop models
  if (ext === "pbix") {
    return {
      key: "pbix",
      badge: "PBIX",
      label: "Mẫu Power BI",
      Icon: BarChart3,
      iconColor: "text-amber-700",
      iconBg: "bg-amber-100/70 border-amber-300 text-amber-700",
      badgeStyle: "bg-amber-100/90 text-amber-900 border-amber-300 font-bold",
      hoverBorder: "hover:border-amber-400",
      actionButton: "bg-amber-100/80 hover:bg-amber-200 text-amber-900 border border-amber-300"
    };
  }

  // Excel / CSV Spreadsheets & Datasets
  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    return {
      key: "xlsx",
      badge: ext.toUpperCase() || "XLSX",
      label: ext === "csv" ? "Dữ liệu CSV" : "Bảng tính Excel",
      Icon: ExcelLogo,
      iconColor: "",
      iconBg: "bg-emerald-50 border-emerald-200/90",
      badgeStyle: "bg-emerald-100/80 text-emerald-800 border-emerald-300 font-bold",
      hoverBorder: "hover:border-emerald-400",
      actionButton: "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80"
    };
  }

  // Zip / Compressed archives
  if (ext === "zip" || ext === "rar") {
    return {
      key: "zip",
      badge: ext.toUpperCase() || "ZIP",
      label: "Tệp nén dữ liệu",
      Icon: Archive,
      iconColor: "text-purple-700",
      iconBg: "bg-purple-50 border-purple-200/90 text-purple-700",
      badgeStyle: "bg-purple-100/80 text-purple-800 border-purple-300 font-bold",
      hoverBorder: "hover:border-purple-400",
      actionButton: "bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80"
    };
  }

  if (material.type === "slide" || ext === "ppt" || ext === "pptx") {
    const isPpt = ext === "ppt";
    return {
      key: "pptx",
      badge: isPpt ? "PPT" : "PPTX",
      label: "Slide bài giảng (PowerPoint)",
      Icon: PowerPointLogo,
      iconColor: "",
      iconBg: "bg-orange-50 border-orange-200/90",
      badgeStyle: "bg-orange-50 text-orange-800 border-orange-200 font-bold",
      hoverBorder: "hover:border-orange-300",
      actionButton: "bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200/80"
    };
  }

  if (ext === "doc" || ext === "docx" || material.type === "document") {
    const isDoc = ext === "doc";
    return {
      key: "docx",
      badge: isDoc ? "DOC" : "DOCX",
      label: "Tài liệu Word",
      Icon: WordLogo,
      iconColor: "",
      iconBg: "bg-blue-50 border-blue-200/90",
      badgeStyle: "bg-blue-50 text-blue-700 border-blue-200 font-bold",
      hoverBorder: "hover:border-blue-300",
      actionButton: "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80"
    };
  }

  if (material.type === "youtube") {
    return {
      key: "youtube",
      badge: "YOUTUBE",
      label: "Video YouTube",
      Icon: YouTubeLogo,
      iconColor: "",
      iconBg: "bg-red-50 border-red-200/90",
      badgeStyle: "bg-red-50 text-red-700 border-red-200 font-bold",
      hoverBorder: "hover:border-red-300",
      actionButton: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80"
    };
  }

  return {
    key: "link",
    badge: "LINK",
    label: "Liên kết ngoài",
    Icon: Link2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 border-emerald-200/90 text-emerald-600",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hoverBorder: "hover:border-emerald-300",
    actionButton: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80"
  };
}

export function MaterialIcon({ material, type, className }: { material?: SessionMaterial; type?: SessionMaterial["type"]; className?: string }) {
  if (material) {
    const meta = getMaterialTypeMeta(material);
    return <meta.Icon className={className || "h-5 w-5"} />;
  }
  if (type === "slide") return <PowerPointLogo className={className || "h-5 w-5"} />;
  if (type === "document") return <WordLogo className={className || "h-5 w-5"} />;
  if (type === "youtube") return <YouTubeLogo className={className || "h-5 w-5"} />;
  return <Link2 className={className || "h-5 w-5"} />;
}

export const isFileMaterial = (material: SessionMaterial) => material.type === "slide" || material.type === "document";

export const isPdfMaterial = (material: SessionMaterial) =>
  material.mimeType === "application/pdf" || Boolean(material.fileName && material.fileName.toLowerCase().endsWith(".pdf"));

export const materialHref = (material: SessionMaterial) =>
  isFileMaterial(material) ? api.materialDownloadUrl(material.id) : material.url || "#";

/** Read-only view of a session's materials for learners: YouTube embeds plus download/open cards and inline PDF preview. */
export default function SessionMaterialsList({ materials, sessionId }: { materials: SessionMaterial[]; sessionId?: string }) {
  const [previewPdf, setPreviewPdf] = useState<SessionMaterial | null>(null);

  if (materials.length === 0) return null;
  const videos = materials.filter(material => material.type === "youtube");
  const others = materials.filter(material => material.type !== "youtube");

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-widest block">Tài liệu buổi học</span>
        {sessionId && (materials.some(material => isFileMaterial(material)) || materials.some(material => material.url)) && (
          <a
            href={api.sessionMaterialsBundleUrl(sessionId)}
            download
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Archive className="h-3.5 w-3.5" /> Tải toàn bộ (.ZIP)
          </a>
        )}
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {others.map(material => {
            const meta = getMaterialTypeMeta(material);
            const isFile = isFileMaterial(material);
            const isPdf = isPdfMaterial(material);
            const uploadTime = formatUploadTime(material.createdAt);

            return (
              <div
                key={material.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-white hover:bg-slate-50/70 border border-slate-200/80 ${meta.hoverBorder} transition-all text-left min-w-0 shadow-xs group`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Colorful Icon Box */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.iconBg} ${meta.iconColor} transition-colors shadow-2xs`}>
                    <meta.Icon className="h-5 w-5" />
                  </div>

                  {/* Information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="block text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {material.title}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 border ${meta.badgeStyle}`}>
                        {meta.badge}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono text-slate-400">
                      {material.fileName && material.fileName !== material.title && (
                        <span className="truncate max-w-[130px] text-slate-500 font-medium">{material.fileName}</span>
                      )}
                      {material.sizeBytes ? (
                        <span className="text-slate-500">{formatFileSize(material.sizeBytes)}</span>
                      ) : null}
                      {uploadTime && (
                        <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200/60">
                          <Clock className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                          {uploadTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPdf ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewPdf(material)}
                        title="Xem trực tiếp PDF"
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer text-xs font-semibold flex items-center gap-1 border border-rose-200/80 active:scale-95 shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5" /> Xem
                      </button>
                      <a
                        href={materialHref(material)}
                        download={material.fileName || true}
                        title="Tải về máy"
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer border border-slate-200/70"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </>
                  ) : isFile ? (
                    <a
                      href={materialHref(material)}
                      download={material.fileName || true}
                      title={`Tải về ${material.fileName || material.title}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs ${meta.actionButton}`}
                    >
                      <Download className="h-3.5 w-3.5" /> Tải về
                    </a>
                  ) : (
                    <a
                      href={materialHref(material)}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở liên kết"
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-200/70"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Mở
                    </a>
                  )}
                </div>
              </div>
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
