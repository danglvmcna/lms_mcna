import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lms_mcna";

const isLocalDb = Boolean(
  dbUrl.includes("localhost") || 
  dbUrl.includes("127.0.0.1")
);

export const pool = new pg.Pool({
  connectionString: dbUrl,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false }
});

export type Queryable = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;
