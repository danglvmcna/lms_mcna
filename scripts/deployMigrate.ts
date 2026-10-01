import dotenv from "dotenv";
import pg from "pg";
import { runMigrations } from "../src/dbMigrations";
import { planDeployMigration } from "../src/deployMigrationPlan";

dotenv.config();

// Build step for hosts that do not run the server's start-up routine (Vercel): applies pending migrations
// before the new build is published. A failing migration fails the build, so code that needs the new
// schema is never deployed on top of the old one.

async function main() {
  const plan = planDeployMigration(process.env);
  if (plan.action === "skip") {
    console.warn(`[deploy-migrate] Skipped: ${plan.reason}.`);
    console.warn("[deploy-migrate] If this build needs new migrations, run `npm run db:migrate` against its database.");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL!;
  const isLocalDb = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: isLocalDb ? undefined : { rejectUnauthorized: false } });
  try {
    const result = await runMigrations(pool);
    console.log(
      result.applied.length
        ? `[deploy-migrate] Applied ${result.applied.length} migration(s): ${result.applied.join(", ")}`
        : `[deploy-migrate] Database is up to date (${result.skipped.length} migrations already applied).`
    );
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error("[deploy-migrate] Migration failed:", error);
  process.exit(1);
});
