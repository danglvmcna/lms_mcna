import fs from "fs";
import path from "path";
import pg from "pg";

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

export function getMigrationFiles() {
  const migrationsDir = path.join(process.cwd(), "migrations", "postgres");
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith(".sql"))
    .sort()
    .map(file => ({
      file,
      version: file.split("_")[0],
      name: file,
      sql: fs.readFileSync(path.join(migrationsDir, file), "utf8").trimStart()
    }));
}

export async function runMigrations(pool: pg.Pool): Promise<MigrationResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const migration of getMigrationFiles()) {
    const existing = await pool.query("SELECT version FROM schema_migrations WHERE version = $1", [migration.version]);
    if (existing.rowCount) {
      skipped.push(migration.name);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (migration.sql) {
        await client.query(migration.sql);
      }
      await client.query(
        "INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
        [migration.version, migration.name]
      );
      await client.query("COMMIT");
      applied.push(migration.name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
}
