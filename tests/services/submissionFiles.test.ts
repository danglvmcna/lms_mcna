import { describe, it, expect } from "vitest";
import { 
  parseSubmissionFiles, 
  cleanSubmissionContent, 
  buildSubmissionFileInfo,
  formatBytes 
} from "../../src/submissionFiles";

describe("Submission Files Parser & Formatter (submissionFiles.ts)", () => {
  describe("buildSubmissionFileInfo", () => {
    it("identifies PDF files correctly", () => {
      const file = buildSubmissionFileInfo("/uploads/1718000000-12345-report.pdf");
      expect(file.isPdf).toBe(true);
      expect(file.isImage).toBe(false);
      expect(file.ext).toBe(".pdf");
      expect(file.filename).toBe("report.pdf");
    });

    it("identifies Office files (Word, Excel, PowerPoint)", () => {
      const doc = buildSubmissionFileInfo("https://example.com/essay.docx");
      expect(doc.isWord).toBe(true);
      expect(doc.ext).toBe(".docx");

      const sheet = buildSubmissionFileInfo("/files/data.xlsx");
      expect(sheet.isExcel).toBe(true);

      const slide = buildSubmissionFileInfo("/files/presentation.pptx");
      expect(slide.isPowerPoint).toBe(true);
    });

    it("identifies Image files and cleans timestamp prefix", () => {
      const img = buildSubmissionFileInfo("/uploads/1718000000-123456-screenshot.png");
      expect(img.isImage).toBe(true);
      expect(img.filename).toBe("screenshot.png");
      expect(img.ext).toBe(".png");
    });

    it("identifies Zip and archive files", () => {
      const zip = buildSubmissionFileInfo("/uploads/source_code.zip");
      expect(zip.isZip).toBe(true);
      expect(zip.ext).toBe(".zip");
    });
  });

  describe("parseSubmissionFiles", () => {
    it("parses multiple attachments embedded in text content", () => {
      const content = `
        Em xin nộp bài tập lớn ạ.
        [Attachment: Bao_cao.docx | /uploads/100-Bao_cao.docx]
        [Attachment: Du_lieu.xlsx | /uploads/101-Du_lieu.xlsx]
        [Tệp đính kèm: Slide.pptx | /uploads/102-Slide.pptx]
      `;
      const files = parseSubmissionFiles(content);
      expect(files).toHaveLength(3);
      expect(files[0].filename).toBe("Bao_cao.docx");
      expect(files[0].url).toBe("/uploads/100-Bao_cao.docx");
      expect(files[0].isWord).toBe(true);
      expect(files[1].filename).toBe("Du_lieu.xlsx");
      expect(files[1].isExcel).toBe(true);
      expect(files[2].filename).toBe("Slide.pptx");
      expect(files[2].isPowerPoint).toBe(true);
    });

    it("handles legacy attachmentUrl prop along with content tags", () => {
      const content = "Bài làm [Attachment: code.py | /uploads/code.py]";
      const legacyUrl = "/uploads/report.pdf";
      const files = parseSubmissionFiles(content, legacyUrl);
      expect(files).toHaveLength(2);
      expect(files.some(f => f.url === "/uploads/code.py")).toBe(true);
      expect(files.some(f => f.url === legacyUrl && f.isPdf)).toBe(true);
    });

    it("deduplicates identical file URLs", () => {
      const content = `
        [Attachment: file1.pdf | /uploads/same.pdf]
        [Attachment: file2.pdf | /uploads/same.pdf]
      `;
      const files = parseSubmissionFiles(content, "/uploads/same.pdf");
      expect(files).toHaveLength(1);
    });

    it("returns empty array when no attachments are present", () => {
      const files = parseSubmissionFiles("Chỉ có nội dung văn bản thuần.");
      expect(files).toHaveLength(0);
    });
  });

  describe("cleanSubmissionContent", () => {
    it("strips all attachment tags leaving clean text", () => {
      const raw = `
        Kính gửi thầy cô, em nộp bài.
        [Attachment: btl.zip | /uploads/btl.zip]
        [Tệp đính kèm: note.txt | /uploads/note.txt]
        Chúc thầy cô một ngày tốt lành!
      `;
      const cleaned = cleanSubmissionContent(raw);
      expect(cleaned).not.toContain("[Attachment:");
      expect(cleaned).not.toContain("[Tệp đính kèm:");
      expect(cleaned).toContain("Kính gửi thầy cô, em nộp bài.");
      expect(cleaned).toContain("Chúc thầy cô một ngày tốt lành!");
    });
  });

  describe("formatBytes", () => {
    it("formats bytes into human readable units", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
    });
  });
});
