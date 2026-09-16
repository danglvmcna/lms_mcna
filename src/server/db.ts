import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the Postgres/Supabase backend.");
}

const isLocalDb = Boolean(
  process.env.DATABASE_URL.includes("localhost") || 
  process.env.DATABASE_URL.includes("127.0.0.1")
);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false }
});

export type Queryable = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;
