// Vercel never runs the server's start-up routine (migrations, seeding), so a production build applies the
// pending migrations itself before the new code goes live. Other hosts migrate when the server starts.

export type DeployMigrationPlan = { action: "run" } | { action: "skip"; reason: string };

export function planDeployMigration(env: Record<string, string | undefined>): DeployMigrationPlan {
  const vercelEnv = (env.VERCEL_ENV || "").trim().toLowerCase();
  // A preview build of an unmerged branch must not change the schema the live site is using.
  if (vercelEnv && vercelEnv !== "production") {
    return { action: "skip", reason: `VERCEL_ENV=${vercelEnv}: only production builds migrate the database` };
  }
  if (!(env.DATABASE_URL || "").trim()) {
    return { action: "skip", reason: "DATABASE_URL is not available to the build" };
  }
  return { action: "run" };
}
