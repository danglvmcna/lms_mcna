import { describe, expect, it } from "vitest";
import { signMaterialUploadGrant, verifyMaterialUploadGrant, type MaterialUploadGrant } from "../../src/server/services/materialUploadGrant";

const now = Date.now();
const grant: MaterialUploadGrant = {
  owner: { kind: "session", sessionId: "session-1" },
  createdBy: "teacher-1",
  materialId: "mat-1",
  storagePath: "course-1/section-1/session-1/mat-1.pdf",
  fileName: "Bài giảng.pdf",
  sizeBytes: 8 * 1024 * 1024,
  type: "slide",
  expiresAt: now + 10 * 60_000
};

describe("signed direct material upload grant", () => {
  it("keeps the destination, file size and user bound to the grant", () => {
    const token = signMaterialUploadGrant(grant, "server-secret");
    expect(verifyMaterialUploadGrant(token, "server-secret", now)).toEqual(grant);
    expect(verifyMaterialUploadGrant(token, "another-secret", now)).toBeNull();
  });

  it("rejects changes to the upload metadata and expired grants", () => {
    const token = signMaterialUploadGrant(grant, "server-secret");
    const [payload, signature] = token.split(".");
    const altered = Buffer.from(JSON.stringify({ ...grant, sizeBytes: 1 })).toString("base64url");
    expect(verifyMaterialUploadGrant(`${altered}.${signature}`, "server-secret", now)).toBeNull();
    expect(verifyMaterialUploadGrant(`${payload}.${signature}`, "server-secret", grant.expiresAt + 1)).toBeNull();
  });
});
