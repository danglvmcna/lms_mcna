import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

let dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lms_mcna";

// Auto-switch Supabase Pooler to Transaction Mode (port 6543) for Serverless reliability
if (dbUrl.includes("pooler.supabase.com:5432")) {
  dbUrl = dbUrl.replace(":5432", ":6543");
  if (!dbUrl.includes("pgbouncer=true")) {
    dbUrl += (dbUrl.includes("?") ? "&" : "?") + "pgbouncer=true";
  }
}

const isLocalDb = Boolean(
  dbUrl.includes("localhost") || 
  dbUrl.includes("127.0.0.1")
);

export const pool = new pg.Pool({
  connectionString: dbUrl,
  max: process.env.VERCEL ? 3 : Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false }
});

export type Queryable = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;
