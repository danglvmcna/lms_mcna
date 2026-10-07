import { describe, it, expect } from "vitest";
import { signCrmPayload, verifyBearerSecret, verifyCrmSignature } from "../../src/server/crm/signature";

describe("Supabase webhook bearer secret", () => {
  const secret = "test-only-revenue-webhook-secret";

  it("accepts only the configured Bearer token", () => {
    expect(verifyBearerSecret(secret, `Bearer ${secret}`)).toBe(true);
    expect(verifyBearerSecret(secret, undefined)).toBe(false);
    expect(verifyBearerSecret(secret, "")).toBe(false);
    expect(verifyBearerSecret(secret, "Bearer wrong-secret")).toBe(false);
    expect(verifyBearerSecret(secret, secret)).toBe(false);
  });
});

describe("CRM HMAC Signature (signature.ts)", () => {
  const secret = "test_crm_webhook_secret_key_12345";
  const body = JSON.stringify({ event: "lead.created", email: "student@mcna.vn" });
  const tolerance = 300;

  it("signCrmPayload generates deterministic hex hash", () => {
    const timestamp = "1700000000";
    const sig1 = signCrmPayload(secret, timestamp, body);
    const sig2 = signCrmPayload(secret, timestamp, body);
    expect(sig1).toBe(sig2);
    expect(typeof sig1).toBe("string");
    expect(sig1.length).toBe(64);
  });

  it("verifyCrmSignature succeeds with correct secret, timestamp and sha256= prefix", () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    const hex = signCrmPayload(secret, nowSeconds, body);
    const result = verifyCrmSignature(secret, nowSeconds, `sha256=${hex}`, body, tolerance);
    expect(result).toBeNull();
  });

  it("verifyCrmSignature succeeds with raw hex signature without sha256= prefix", () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    const hex = signCrmPayload(secret, nowSeconds, body);
    const result = verifyCrmSignature(secret, nowSeconds, hex, body, tolerance);
    expect(result).toBeNull();
  });

  it("rejects when timestamp or signature header is missing", () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    expect(verifyCrmSignature(secret, undefined, "sha256=abc", body, tolerance)).toEqual({
      status: 401,
      error: "Missing timestamp or signature header."
    });
    expect(verifyCrmSignature(secret, nowSeconds, undefined, body, tolerance)).toEqual({
      status: 401,
      error: "Missing timestamp or signature header."
    });
  });

  it("rejects non-numeric timestamp", () => {
    const result = verifyCrmSignature(secret, "invalid_timestamp", "sha256=abc", body, tolerance);
    expect(result).toEqual({
      status: 400,
      error: "Timestamp header must be Unix time in seconds."
    });
  });

  it("rejects timestamp exceeding tolerance window (> 300s in the past)", () => {
    const pastSeconds = (Math.floor(Date.now() / 1000) - 301).toString();
    const hex = signCrmPayload(secret, pastSeconds, body);
    const result = verifyCrmSignature(secret, pastSeconds, `sha256=${hex}`, body, tolerance);
    expect(result).toEqual({
      status: 401,
      error: "Request timestamp is outside the allowed window."
    });
  });

  it("rejects timestamp exceeding tolerance window in the future", () => {
    const futureSeconds = (Math.floor(Date.now() / 1000) + 305).toString();
    const hex = signCrmPayload(secret, futureSeconds, body);
    const result = verifyCrmSignature(secret, futureSeconds, `sha256=${hex}`, body, tolerance);
    expect(result).toEqual({
      status: 401,
      error: "Request timestamp is outside the allowed window."
    });
  });

  it("rejects when secret is wrong", () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    const hex = signCrmPayload("wrong_secret", nowSeconds, body);
    const result = verifyCrmSignature(secret, nowSeconds, `sha256=${hex}`, body, tolerance);
    expect(result).toEqual({
      status: 401,
      error: "Invalid request signature."
    });
  });

  it("rejects when body is tampered", () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    const hex = signCrmPayload(secret, nowSeconds, body);
    const tamperedBody = JSON.stringify({ event: "lead.created", email: "hacker@mcna.vn" });
    const result = verifyCrmSignature(secret, nowSeconds, `sha256=${hex}`, tamperedBody, tolerance);
    expect(result).toEqual({
      status: 401,
      error: "Invalid request signature."
    });
  });
});
