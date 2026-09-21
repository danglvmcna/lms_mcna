import { describe, it, expect } from "vitest";
import { extractYoutubeVideoId, escapeHTML, youtubeWatchUrl, youtubeEmbedUrl } from "../../src/utils";

describe("Utils - YouTube Video Extractor and HTML Escaper (utils.ts)", () => {
  describe("extractYoutubeVideoId", () => {
    it("extracts ID from standard watch URL", () => {
      expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from youtu.be short link", () => {
      expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from youtube embed link", () => {
      expect(extractYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from youtube shorts link", () => {
      expect(extractYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("accepts bare 11-char ID directly", () => {
      expect(extractYoutubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("returns null for invalid inputs or random URLs", () => {
      expect(extractYoutubeVideoId("")).toBeNull();
      expect(extractYoutubeVideoId("https://example.com/video")).toBeNull();
      expect(extractYoutubeVideoId("not-a-valid-id")).toBeNull();
    });
  });

  describe("escapeHTML", () => {
    it("escapes dangerous HTML characters to prevent XSS", () => {
      const malicious = '<script>alert("XSS & hack")</script>\'';
      const escaped = escapeHTML(malicious);
      expect(escaped).toBe("&lt;script&gt;alert(&quot;XSS &amp; hack&quot;)&lt;/script&gt;&#039;");
    });

    it("returns empty string when input is empty", () => {
      expect(escapeHTML("")).toBe("");
    });
  });

  describe("youtube URL builders", () => {
    it("generates correct watch and embed URLs", () => {
      expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    });
  });
});
