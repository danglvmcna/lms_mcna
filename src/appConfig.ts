import { useQuery } from "@tanstack/react-query";
import { AppConfig } from "./types";

// Deployment switches served by /api/public/config. Until they arrive (or if the request fails) the
// app behaves as direct sale, so the sign-up entry points never flash on screen.
export const DEFAULT_APP_CONFIG: AppConfig = {
  salesMode: "direct",
  supportPhone: "0939.866.825",
  allowHomeworkDownload: false
};

async function fetchAppConfig(): Promise<AppConfig> {
  const response = await fetch("/api/public/config", { credentials: "include" });
  if (!response.ok) throw new Error("Không tải được cấu hình hệ thống.");
  return { ...DEFAULT_APP_CONFIG, ...(await response.json()) };
}

export function useAppConfigQuery() {
  const query = useQuery({ queryKey: ["public-config"], queryFn: fetchAppConfig, staleTime: Infinity, retry: 1 });
  return { config: query.data || DEFAULT_APP_CONFIG, isLoading: query.isLoading };
}

export function useAppConfig(): AppConfig {
  return useAppConfigQuery().config;
}

/** "0939.866.825" -> "0939866825", for tel: and zalo.me links. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "");
