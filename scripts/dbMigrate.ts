import dotenv from "dotenv";
import pg from "pg";
import { runMigrations } from "../src/dbMigrations";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const isLocalDb = Boolean(
  process.env.DATABASE_URL.includes("localhost") || 
  process.env.DATABASE_URL.includes("127.0.0.1")
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false }
});

runMigrations(pool)
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
  })
  .finally(() => pool.end());
