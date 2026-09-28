import React, { useState } from "react";
import { Archive, BarChart3, Download, ExternalLink, Eye, Link2, Play } from "lucide-react";
import { api } from "../api";
import { SessionMaterial } from "../types";
import { buttonClass, Dialog } from "./ui";
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

/** Read-only view of a session's materials for learners. Videos open on YouTube; PDFs preview in place. */
export default function SessionMaterialsList({ materials, sessionId }: { materials: SessionMaterial[]; sessionId?: string }) {
  const [previewPdf, setPreviewPdf] = useState<SessionMaterial | null>(null);

  if (materials.length === 0) return null;
  const canBundle = Boolean(sessionId) && materials.filter(material => isFileMaterial(material) || material.url).length > 1;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-[1.25rem] border border-slate-200/70 bg-white shadow-card">
        {materials.map(material => {
          const meta = getMaterialTypeMeta(material);
          const isFile = isFileMaterial(material);
          const isPdf = isPdfMaterial(material);
          const details = [meta.label, formatFileSize(material.sizeBytes)].filter(Boolean).join(" · ");

          return (
            <li key={material.id} className="flex items-center gap-3.5 px-4 py-3.5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${meta.iconBg} ${meta.iconColor}`}>
                <meta.Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-slate-900">{material.title}</span>
                <span className="block truncate text-[13px] text-slate-500">{details}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {isPdf && (
                  <button type="button" onClick={() => setPreviewPdf(material)} className={buttonClass({ size: "sm", variant: "tinted" })}>
                    <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Xem</span>
                  </button>
                )}
                {isFile ? (
                  <a href={materialHref(material)} download={material.fileName || true} aria-label={`Tải về ${material.fileName || material.title}`} className={buttonClass({ size: "sm", variant: "secondary" })}>
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">Tải về</span>
                  </a>
                ) : (
                  <a href={materialHref(material)} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "secondary" })}>
                    {material.type === "youtube" ? <Play className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                    <span className="hidden sm:inline">{material.type === "youtube" ? "Xem video" : "Mở"}</span>
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {canBundle && (
        <a href={api.sessionMaterialsBundleUrl(sessionId!)} download className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          <Archive className="h-4 w-4" /> Tải tất cả (.zip)
        </a>
      )}

      {previewPdf && (
        <Dialog onClose={() => setPreviewPdf(null)} size="2xl" title={previewPdf.title} description={[previewPdf.fileName, formatFileSize(previewPdf.sizeBytes)].filter(Boolean).join(" · ")}>
          <div className="space-y-4">
            <div className="h-[70dvh] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
              <iframe src={`${api.materialDownloadUrl(previewPdf.id)}?inline=true`} title={previewPdf.title} className="h-full w-full border-0 bg-white" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <a href={`${api.materialDownloadUrl(previewPdf.id)}?inline=true`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary" })}>
                <ExternalLink className="h-4 w-4" /> Mở tab mới
              </a>
              <a href={api.materialDownloadUrl(previewPdf.id)} download={previewPdf.fileName || true} className={buttonClass()}>
                <Download className="h-4 w-4" /> Tải về
              </a>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
