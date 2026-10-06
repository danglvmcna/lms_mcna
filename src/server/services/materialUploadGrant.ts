import crypto from "crypto";
import { IntroMaterialCategory } from "../../types";
import { FileMaterialType } from "../../materialAccess";

export type MaterialUploadOwner =
  | { kind: "session"; sessionId: string }
  | { kind: "intro"; courseId: string; category: IntroMaterialCategory };

export type MaterialUploadGrant = {
  owner: MaterialUploadOwner;
  createdBy: string;
  materialId: string;
  storagePath: string;
  fileName: string;
  title?: string;
  sizeBytes: number;
  type: FileMaterialType;
  expiresAt: number;
};

/** Keeps the upload metadata bound to the authorized user and destination without a pending-upload table. */
export function signMaterialUploadGrant(grant: MaterialUploadGrant, secret: string): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyMaterialUploadGrant(token: string, secret: string, now = Date.now()): MaterialUploadGrant | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest();
  let actual: Buffer;
  try { actual = Buffer.from(parts[1], "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const grant = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as MaterialUploadGrant;
    if (!grant || !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt < now || grant.expiresAt > now + 60 * 60_000) return null;
    if (typeof grant.createdBy !== "string" || typeof grant.materialId !== "string" || typeof grant.storagePath !== "string") return null;
    if (typeof grant.fileName !== "string" || typeof grant.sizeBytes !== "number" || !grant.owner) return null;
    return grant;
  } catch { return null; }
}
