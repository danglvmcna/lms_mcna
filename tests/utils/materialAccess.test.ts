import { describe, expect, it } from "vitest";
import { fileExtension, isPdfFile, learnerMaterialAccess, MATERIAL_EXTENSIONS, resolveUploadType } from "../../src/materialAccess";

describe("learnerMaterialAccess", () => {
  it("lets learners download data files only", () => {
    expect(learnerMaterialAccess({ type: "data", fileName: "don-hang.csv", mimeType: "text/csv" })).toBe("download");
    expect(learnerMaterialAccess({ type: "data", fileName: "workflow.json" })).toBe("download");
  });

  it("makes PDF slides and documents view-only", () => {
    expect(learnerMaterialAccess({ type: "slide", fileName: "buoi-1.pdf", mimeType: "application/pdf" })).toBe("view");
    expect(learnerMaterialAccess({ type: "document", fileName: "GIAO-TRINH.PDF" })).toBe("view");
  });

  it("does not serve slides or documents that have no PDF version", () => {
    expect(learnerMaterialAccess({ type: "slide", fileName: "buoi-1.pptx" })).toBe("unavailable");
    expect(learnerMaterialAccess({ type: "document", fileName: "de-cuong.docx" })).toBe("unavailable");
  });

  it("treats YouTube and external links as links", () => {
    expect(learnerMaterialAccess({ type: "youtube" })).toBe("link");
    expect(learnerMaterialAccess({ type: "link" })).toBe("link");
  });
});

describe("resolveUploadType", () => {
  it("stores a dataset uploaded as a document as data", () => {
    expect(resolveUploadType("document", "bang-tinh.xlsx")).toBe("data");
    expect(resolveUploadType("document", "du-lieu.ZIP")).toBe("data");
  });

  it("keeps the requested type otherwise", () => {
    expect(resolveUploadType("document", "giao-trinh.pdf")).toBe("document");
    expect(resolveUploadType("slide", "buoi-1.pptx")).toBe("slide");
    expect(resolveUploadType("slide", "sai.xlsx")).toBe("slide");
    expect(resolveUploadType("data", "du-lieu.csv")).toBe("data");
  });
});

describe("material file rules", () => {
  it("never lists slide or document formats as downloadable data", () => {
    for (const ext of [".pdf", ".ppt", ".pptx", ".doc", ".docx"]) {
      expect(MATERIAL_EXTENSIONS.data).not.toContain(ext);
    }
  });

  it("reads extensions and PDF files case-insensitively", () => {
    expect(fileExtension("Báo cáo.Final.PDF")).toBe(".pdf");
    expect(fileExtension("khong-co-duoi")).toBe("");
    expect(isPdfFile(null, "slide.Pdf")).toBe(true);
    expect(isPdfFile("application/pdf", "tep")).toBe(true);
    expect(isPdfFile("application/zip", "tep.zip")).toBe(false);
  });
});
