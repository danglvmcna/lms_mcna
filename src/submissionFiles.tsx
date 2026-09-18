import React from "react";
import { FileText, Image as ImageIcon, Archive } from "lucide-react";
import { PowerPointLogo, WordLogo, ExcelLogo, PdfLogo } from "./components/icons/BrandLogos";

export interface SubmissionFileInfo {
  url: string;
  filename: string;
  ext: string;
  isWord: boolean;
  isExcel: boolean;
  isPowerPoint: boolean;
  isPdf: boolean;
  isImage: boolean;
  isZip: boolean;
}

export function buildSubmissionFileInfo(url: string, rawFilename?: string): SubmissionFileInfo {
  let filename = rawFilename || "";
  if (!filename) {
    const raw = url.split("/").pop() || "file_bai_lam";
    filename = raw.replace(/^\d+-\d+-/, "");
  }

  const ext = "." + (filename.split(".").pop() || url.split(".").pop() || "").toLowerCase();
  const isWord = [".doc", ".docx"].includes(ext);
  const isExcel = [".xls", ".xlsx", ".csv"].includes(ext);
  const isPowerPoint = [".ppt", ".pptx"].includes(ext);
  const isPdf = ext === ".pdf";
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext);
  const isZip = [".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext);

  return {
    url,
    filename: filename || (url ? "Tệp bài làm" : ""),
    ext,
    isWord,
    isExcel,
    isPowerPoint,
    isPdf,
    isImage,
    isZip
  };
}

/**
 * Extracts all attachments from submission content and attachmentUrl.
 * Supports multiple [Attachment: filename | url] or [Attachment: url] or legacy single attachmentUrl.
 */
export function parseSubmissionFiles(content?: string, attachmentUrl?: string): SubmissionFileInfo[] {
  const files: SubmissionFileInfo[] = [];
  const seenUrls = new Set<string>();

  if (content) {
    const regex = /\[(?:Attachment|Tệp đính kèm):\s*([^\]]+)\]/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const val = match[1].trim();
      let url = "";
      let filename = "";

      if (val.includes("|")) {
        const parts = val.split("|").map(p => p.trim());
        filename = parts[0];
        const urlPart = parts.find(p => p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/"));
        if (urlPart) url = urlPart;
      } else if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/")) {
        url = val;
      } else {
        filename = val;
      }

      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        files.push(buildSubmissionFileInfo(url, filename));
      }
    }
  }

  if (attachmentUrl && !seenUrls.has(attachmentUrl)) {
    seenUrls.add(attachmentUrl);
    files.push(buildSubmissionFileInfo(attachmentUrl));
  }

  return files;
}

/**
 * Removes all [Attachment: ...] tags from the submission text content.
 */
export function cleanSubmissionContent(content = ""): string {
  return content
    .replace(/\s*\[Attachment:[^\]]+\]/gi, "")
    .replace(/\s*\[Tệp đính kèm:[^\]]+\]/gi, "")
    .trim();
}

/**
 * Formats file size in bytes to human-readable string (KB, MB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Renders the authentic brand logo or icon for a submission file.
 */
export function renderSubmissionFileIcon(file: SubmissionFileInfo, size = "h-4 w-4") {
  if (file.isWord) return <WordLogo className={size} />;
  if (file.isExcel) return <ExcelLogo className={size} />;
  if (file.isPowerPoint) return <PowerPointLogo className={size} />;
  if (file.isPdf) return <PdfLogo className={size} />;
  if (file.isImage) return <ImageIcon className={`${size} text-sky-600`} />;
  if (file.isZip) return <Archive className={`${size} text-amber-600`} />;
  return <FileText className={`${size} text-indigo-600`} />;
}
