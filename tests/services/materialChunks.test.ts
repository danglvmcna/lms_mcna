import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMaterialPdf } from "../../src/materialChunks";

afterEach(() => vi.unstubAllGlobals());

describe("large PDF viewer", () => {
  it("assembles authorized chunks without requesting the full file through Vercel", async () => {
    const chunkBytes = 2 * 1024 * 1024;
    const sizeBytes = 2 * chunkBytes + 3;
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(options.headers).toEqual({ "X-LMS-Viewer": "1" });
      if (url.endsWith("/download?inline=true")) return new Response(JSON.stringify({ code: "CHUNK_REQUIRED", sizeBytes }), { status: 409 });
      const index = Number(new URL(url, "https://lms.example").searchParams.get("index"));
      return new Response(new Uint8Array(index === 2 ? 3 : chunkBytes).fill(index + 1));
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchMaterialPdf("/api/materials/mat-1/download?inline=true");
    expect(data.length).toBe(sizeBytes);
    expect([data[0], data[chunkBytes], data[2 * chunkBytes], data[sizeBytes - 1]]).toEqual([1, 2, 3, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects a truncated chunk", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "CHUNK_REQUIRED", sizeBytes: 2 * 1024 * 1024 }), { status: 409 }))
      .mockResolvedValueOnce(new Response(new Uint8Array(10))));
    await expect(fetchMaterialPdf("/api/materials/mat-1/download?inline=true")).rejects.toThrow("không đầy đủ");
  });
});
