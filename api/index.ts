import app, { ensureDatabaseReady } from "../server";

export default async function handler(req: any, res: any) {
  try {
    await ensureDatabaseReady();
  } catch (err: any) {
    console.error("Vercel Serverless DB initialization error:", err);
  }
  return app(req, res);
}
