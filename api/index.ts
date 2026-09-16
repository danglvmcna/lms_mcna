import app, { ensureDatabaseReady } from "../server";

void ensureDatabaseReady().catch((err) => {
  console.error("Vercel Serverless DB initialization error:", err);
});

export default app;
