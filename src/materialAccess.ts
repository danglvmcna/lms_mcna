import { SessionMaterial, SessionMaterialType } from "./types";

// Rules for class materials, shared by the API (enforcement) and the UI (which buttons to show).
// Learners only read slides and documents online; "data" files are the ones they may download.

export type FileMaterialType = "slide" | "document" | "data";

export const MATERIAL_EXTENSIONS: Record<FileMaterialType, string[]> = {
  slide: [".pdf", ".ppt", ".pptx"],
  document: [".pdf", ".doc", ".docx"],
  data: [".xlsx", ".xls", ".csv", ".pbix", ".zip", ".rar", ".json", ".txt", ".sql", ".ipynb", ".py", ".md"]
};

export const MATERIAL_TYPE_LABEL: Record<SessionMaterialType, string> = {
  slide: "Slide",
  document: "Tài liệu",
  data: "File data",
  youtube: "YouTube",
  link: "Liên kết"
};

export const isFileMaterialType = (type: string): type is FileMaterialType =>
  type === "slide" || type === "document" || type === "data";

export const fileExtension = (fileName?: string | null) => {
  const match = /\.[A-Za-z0-9]+$/.exec(String(fileName || "").trim());
  return match ? match[0].toLowerCase() : "";
};

export const isPdfFile = (mimeType?: string | null, fileName?: string | null) =>
  mimeType === "application/pdf" || fileExtension(fileName) === ".pdf";

/** Uploads sent as "document" with a dataset extension are stored as "data" (older clients, mixed buttons). */
export function resolveUploadType(requested: FileMaterialType, fileName: string): FileMaterialType {
  const ext = fileExtension(fileName);
  if (requested === "document" && !MATERIAL_EXTENSIONS.document.includes(ext) && MATERIAL_EXTENSIONS.data.includes(ext)) return "data";
  return requested;
}

export type LearnerMaterialAccess = "download" | "view" | "unavailable" | "link";

/**
 * What a learner may do with a material:
 * - download: data files
 * - view: PDF slides/documents, read online only
 * - unavailable: slides/documents without a PDF version (cannot be shown in the browser, never downloadable)
 * - link: YouTube and external links
 */
export function learnerMaterialAccess(material: Pick<SessionMaterial, "type" | "mimeType" | "fileName">): LearnerMaterialAccess {
  if (material.type === "youtube" || material.type === "link") return "link";
  if (material.type === "data") return "download";
  return isPdfFile(material.mimeType, material.fileName) ? "view" : "unavailable";
}
