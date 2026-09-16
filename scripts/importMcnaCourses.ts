import dotenv from "dotenv";
import { pool } from "../src/server/db";
import { importMcnaCatalog } from "../src/server/services/catalogImport";

dotenv.config();

// Imports the MCNA course catalog (src/server/data/mcnaCatalog.json, taken from mcna.vn) into the database.
// The seed loads the same catalogue on a fresh database; this script is for re-importing after the file changes.
//
// Usage: npm run import:mcna -- [--hide-other-courses] [--teacher-email=teacher@mcna.local]
//   --hide-other-courses  move every other published course (e.g. demo data) back to draft
//   --teacher-email       teacher account assigned to new courses and classes

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"] as const;
  })
);

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const summary = await importMcnaCatalog(client, {
      teacherEmail: args.get("teacher-email") || undefined,
      hideOtherCourses: args.has("hide-other-courses"),
      log: message => console.log(message)
    });
    await client.query("COMMIT");
    console.table(summary);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
