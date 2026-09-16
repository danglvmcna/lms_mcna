process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.VERCEL = process.env.VERCEL || "1";

import app, { ensureDatabaseReady } from "../../server";

void ensureDatabaseReady().catch((err) => {
  console.error("Vercel Serverless DB initialization error:", err);
});

export default function handler(req: any, res: any) {
  const originalPath = (req.headers["x-matched-path"] as string) || req.url;
  if (originalPath && req.url !== originalPath) {
    req.url = originalPath;
  }
  return app(req, res);
}
