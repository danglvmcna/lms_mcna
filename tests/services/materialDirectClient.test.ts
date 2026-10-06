import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/api";

afterEach(() => vi.unstubAllGlobals());

const pdf = Object.assign(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { name: "slide.pdf" }) as File;

describe("material direct upload client", () => {
  it("sends file bytes to signed storage URL and only metadata to the LMS", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/start")) return new Response(JSON.stringify({ mode: "direct", signedUrl: "https://storage.example/upload?token=short-lived", grant: "signed-grant", contentType: "application/pdf" }));
      if (url.startsWith("https://storage.example/")) return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({ id: "mat-1", type: "slide" }), { status: 201 });
    }));

    const material = await api.uploadSessionMaterial("session-1", "slide", pdf);
    expect(material.id).toBe("mat-1");
    expect(calls.map(call => call.url)).toEqual([
      "/api/materials/direct-upload/start",
      "https://storage.example/upload?token=short-lived",
      "/api/materials/direct-upload/complete"
    ]);
    expect(calls[1].init.body).toBe(pdf);
    expect(calls[2].init.body).toBe(JSON.stringify({ grant: "signed-grant" }));
  });

  it("stops before sending a large file through Vercel without Storage", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ mode: "server", maxBytes: 4 * 1024 * 1024 })));
    vi.stubGlobal("fetch", fetchMock);
    const large = Object.assign(new Blob([new Uint8Array(5 * 1024 * 1024)]), { name: "slide.pdf" }) as File;
    await expect(api.uploadSessionMaterial("session-1", "slide", large)).rejects.toThrow("Supabase Storage");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
