import crypto from "crypto";

// Pure HMAC helpers shared by the LMS server, the local mock CRM and tests (no database imports).
// Scheme (both directions): hex HMAC-SHA256 over `${timestamp}.${rawBody}`, sent as `sha256=<hex>`.

export function signCrmPayload(secret: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type CrmSignatureFailure = { status: number; error: string };

/** Returns null when the request is authentic, otherwise the HTTP status and reason to reject it with. */
export function verifyCrmSignature(
  secret: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  rawBody: string,
  toleranceSeconds: number
): CrmSignatureFailure | null {
  if (!timestampHeader || !signatureHeader) {
    return { status: 401, error: "Missing timestamp or signature header." };
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return { status: 400, error: "Timestamp header must be Unix time in seconds." };
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return { status: 401, error: "Request timestamp is outside the allowed window." };
  }
  const expected = Buffer.from(signCrmPayload(secret, timestampHeader, rawBody), "utf8");
  const received = Buffer.from(signatureHeader.startsWith("sha256=") ? signatureHeader.slice("sha256=".length) : signatureHeader, "utf8");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { status: 401, error: "Invalid request signature." };
  }
  return null;
}
