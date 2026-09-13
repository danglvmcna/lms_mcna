/**
 * Escape user string contents to prevent CSS/XSS injections.
 */
export function escapeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Clean UUID/Unique identifier generator
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024 * 1024;
export const MAX_UPLOAD_FILE_LABEL = "10 GB";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract the 11-character video id from any common YouTube link
 * (watch?v=, youtu.be/, shorts/, embed/, live/) or a bare id. Returns null otherwise.
 * Shared by the server (validation) and the client (embedding).
 */
export function extractYoutubeVideoId(input: string): string | null {
  const value = String(input || "").trim();
  if (YOUTUBE_VIDEO_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] || null;
  } else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = match ? match[1] : null;
    }
  }
  return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
}

export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
export const youtubeEmbedUrl = (videoId: string) => `https://www.youtube-nocookie.com/embed/${videoId}`;
