import { AppConfig, SalesMode } from "../types";

// Deployment switches for the direct-sale model. Read lazily: server.ts loads dotenv after its imports.

export const DEFAULT_SUPPORT_PHONE = "0939.866.825";

/** direct (default): accounts come from the CRM paid list. self_service: public sign-up, QR payment, admin approval. */
export function getSalesMode(): SalesMode {
  return (process.env.SALES_MODE || "").trim().toLowerCase() === "self_service" ? "self_service" : "direct";
}

export const isDirectSale = () => getSalesMode() === "direct";

export const getSupportPhone = () => (process.env.SUPPORT_PHONE || "").trim() || DEFAULT_SUPPORT_PHONE;

/** Password given to accounts created from the paid list; empty when none is configured. */
export function getDefaultStudentPassword() {
  const value = (process.env.DEFAULT_STUDENT_PASSWORD || "").trim();
  return value.length >= 8 ? value : "Mcna@2026";
}

export const allowHomeworkDownload = () => (process.env.ALLOW_HOMEWORK_DOWNLOAD || "").trim().toLowerCase() === "true";

export function getPublicAppConfig(): AppConfig {
  return {
    salesMode: getSalesMode(),
    supportPhone: getSupportPhone(),
    allowHomeworkDownload: allowHomeworkDownload()
  };
}
