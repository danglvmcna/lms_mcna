import { pool } from "../src/server/db";

export default async function handler(req: any, res: any) {
  try {
    const dbTest = await pool.query("SELECT COUNT(*) FROM courses");
    res.status(200).json({
      status: "ok",
      url: req.url,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbHost: process.env.DATABASE_URL ? process.env.DATABASE_URL.split("@")[1]?.split("/")[0] : null,
      courseCount: Number(dbTest.rows[0].count)
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message,
      code: err.code,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbHost: process.env.DATABASE_URL ? process.env.DATABASE_URL.split("@")[1]?.split("/")[0] : null
    });
  }
}
