import { describe, it, expect } from "vitest";
import { extractPaymentCodes } from "../../src/server/services/sepayService";

describe("Sepay Memo Parsing - extractPaymentCodes (sepayService.ts)", () => {
  it("extracts two hex codes from standard QR memo (MCNA [studentHex] [txHex])", () => {
    const memo = "MBVCB.123456.MCNA E2F4A1 98A7B6 chuyen tien khoa hoc";
    const result = extractPaymentCodes(memo);
    expect(result.studentHex).toBe("e2f4a1");
    expect(result.txHex).toBe("98a7b6");
    expect(result.rawKeywords).toContain("e2f4a1");
    expect(result.rawKeywords).toContain("98a7b6");
  });

  it("extracts from compact 12-hex format (MCNA1A2B3C4D5E6F)", () => {
    const memo = "Chuyen khoan hoc phi MCNA1A2B3C4D5E6F";
    const result = extractPaymentCodes(memo);
    expect(result.studentHex).toBe("1a2b3c");
    expect(result.txHex).toBe("4d5e6f");
    expect(result.rawKeywords).toEqual(["1a2b3c", "4d5e6f"]);
  });

  it("extracts direct tx_ ID format", () => {
    const memo = "Thanh toan don hang tx_a1b2c3d4e5 qua VietQR";
    const result = extractPaymentCodes(memo);
    expect(result.txIdFull).toBe("tx_a1b2c3d4e5");
    expect(result.rawKeywords).toContain("tx_a1b2c3d4e5");
  });

  it("extracts phone or email when formatted as single code after MCNA", () => {
    const phoneMemo = "MCNA 0987654321 ung ho";
    const phoneResult = extractPaymentCodes(phoneMemo);
    expect(phoneResult.phone).toBe("0987654321");

    const emailMemo = "MCNA student@mcna.vn dong hoc phi";
    const emailResult = extractPaymentCodes(emailMemo);
    expect(emailResult.email).toBe("student@mcna.vn");
  });

  it("extracts fallback phone number and email if present in text", () => {
    const text = "Nguyen Van A 0912345678 gui hoc phi lop IELTS";
    const resPhone = extractPaymentCodes(text);
    expect(resPhone.phone).toBe("0912345678");

    const textEmail = "Thanh toan tu contact@example.com hoc vien moi";
    const resEmail = extractPaymentCodes(textEmail);
    expect(resEmail.email).toBe("contact@example.com");
  });

  it("returns empty result when content is empty or undefined", () => {
    expect(extractPaymentCodes("")).toEqual({ rawKeywords: [] });
    expect(extractPaymentCodes(undefined, null)).toEqual({ rawKeywords: [] });
  });

  it("does not match transaction codes on unrelated/garbage content", () => {
    const memo = "Chuc mung sinh nhat anh vui ve hanh phuc nhe ban than";
    const result = extractPaymentCodes(memo);
    expect(result.txIdFull).toBeUndefined();
    expect(result.txHex).toBeUndefined();
    expect(result.studentHex).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.rawKeywords).toEqual([]);
  });
});
