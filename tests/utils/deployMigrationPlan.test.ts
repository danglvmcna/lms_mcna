import { describe, expect, it } from "vitest";
import { planDeployMigration } from "../../src/deployMigrationPlan";

describe("planDeployMigration", () => {
  const databaseUrl = "postgresql://user:secret@db.example.com:5432/lms";

  it("migrates on a Vercel production build", () => {
    expect(planDeployMigration({ VERCEL_ENV: "production", DATABASE_URL: databaseUrl })).toEqual({ action: "run" });
  });

  it("never migrates from a preview or development build", () => {
    for (const vercelEnv of ["preview", "development", "Preview"]) {
      const plan = planDeployMigration({ VERCEL_ENV: vercelEnv, DATABASE_URL: databaseUrl });
      expect(plan.action).toBe("skip");
    }
  });

  it("skips, without failing the build, when the database URL is not exposed to it", () => {
    expect(planDeployMigration({ VERCEL_ENV: "production" })).toMatchObject({ action: "skip" });
    expect(planDeployMigration({ VERCEL_ENV: "production", DATABASE_URL: "  " })).toMatchObject({ action: "skip" });
  });

  it("migrates when run by hand outside Vercel", () => {
    expect(planDeployMigration({ DATABASE_URL: databaseUrl })).toEqual({ action: "run" });
  });
});
