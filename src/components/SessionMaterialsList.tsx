import React from "react";
import { Download, ExternalLink, FileText, Link2, Play, Presentation } from "lucide-react";
import { api } from "../api";
import { SessionMaterial } from "../types";
import { extractYoutubeVideoId, youtubeEmbedUrl } from "../utils";

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

export const materialHref = (material: SessionMaterial) =>
  isFileMaterial(material) ? api.materialDownloadUrl(material.id) : material.url || "#";

/** Read-only view of a session's materials for learners: YouTube embeds plus download/open cards. */
export default function SessionMaterialsList({ materials }: { materials: SessionMaterial[] }) {
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
    </div>
  );
}
