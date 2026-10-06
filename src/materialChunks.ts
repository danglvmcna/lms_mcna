const MATERIAL_VIEW_CHUNK_BYTES = 2 * 1024 * 1024;

/** The LMS still authorizes every chunk, keeping large PDFs inside the read-only viewer. */
export async function readLargeMaterial(url: string, sizeBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 50 * 1024 * 1024) throw new Error("Dung lượng tài liệu không hợp lệ.");
  const chunkUrl = url.replace(/\/download(?:\?.*)?$/, "/view-chunk");
  if (chunkUrl === url) throw new Error("Không tìm thấy đường dẫn đọc tài liệu lớn.");
  const result = new Uint8Array(sizeBytes);
  const count = Math.ceil(sizeBytes / MATERIAL_VIEW_CHUNK_BYTES);
  for (let first = 0; first < count; first += 4) {
    const chunks = await Promise.all(Array.from({ length: Math.min(4, count - first) }, async (_, offset) => {
      const index = first + offset;
      const response = await fetch(`${chunkUrl}?index=${index}`, { credentials: "include", headers: { "X-LMS-Viewer": "1" } });
      if (!response.ok) throw new Error(`Không tải được phần ${index + 1} của tài liệu (HTTP ${response.status}).`);
      return { index, bytes: new Uint8Array(await response.arrayBuffer()) };
    }));
    for (const { index, bytes } of chunks) {
      const start = index * MATERIAL_VIEW_CHUNK_BYTES;
      if (bytes.length !== Math.min(MATERIAL_VIEW_CHUNK_BYTES, sizeBytes - start)) throw new Error("Tài liệu nhận được không đầy đủ.");
      result.set(bytes, start);
    }
  }
  return result;
}

export async function fetchMaterialPdf(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { credentials: "include", headers: { "X-LMS-Viewer": "1" } });
  if (response.status === 409) {
    const payload = await response.json().catch(() => ({}));
    if (payload.code === "CHUNK_REQUIRED") return readLargeMaterial(url, payload.sizeBytes);
    throw new Error(payload.error || "Không tải được tài liệu.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Không tải được tài liệu (HTTP ${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
