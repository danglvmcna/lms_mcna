import React, { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { extractYoutubeVideoId, youtubeEmbedUrl } from "../../utils";
import { cx } from "../ui";

/**
 * 16:9 video area. YouTube links show their thumbnail until tapped, so the page stays light;
 * direct files use the native player. Recording pages (Zoom/Drive) are linked, not embedded.
 */
export default function VideoStage({ url, title, className }: { url: string; title: string; className?: string }) {
  const youtubeId = extractYoutubeVideoId(url);
  const isFile = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url);
  const [playing, setPlaying] = useState(false);

  if (!youtubeId && !isFile) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cx("group flex items-center gap-4 rounded-[1.25rem] bg-slate-900 p-5 text-white shadow-raised", className)}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 group-hover:bg-white/25"><Play className="ml-0.5 h-5 w-5 fill-white" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="text-sm text-slate-300">Mở video trong tab mới</span>
        </span>
        <ExternalLink className="h-5 w-5 shrink-0 text-slate-400" />
      </a>
    );
  }

  return (
    <div className={cx("overflow-hidden rounded-[1.25rem] bg-slate-950 shadow-raised", className)}>
      <div className="relative aspect-video w-full">
        {youtubeId ? (
          playing ? (
            <iframe
              src={`${youtubeEmbedUrl(youtubeId)}?autoplay=1&rel=0`}
              title={title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={`Phát video: ${title}`}>
              <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
              <span className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-float transition-transform group-hover:scale-105 group-active:scale-95">
                <Play className="ml-1 h-7 w-7 fill-slate-900 text-slate-900" />
              </span>
              <span className="absolute bottom-4 left-5 right-5 truncate text-left text-[15px] font-semibold text-white">{title}</span>
            </button>
          )
        ) : (
          <video controls preload="metadata" src={url} className="absolute inset-0 h-full w-full object-contain" />
        )}
      </div>
    </div>
  );
}
