import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ options: null as any, rows: [] as any[], queries: [] as any[], fail: false, released: false }));
vi.mock("pg", () => ({ default: { Pool: class {
  constructor(options: unknown) { fake.options = options; }
  on() {}
  async connect() { return {
    query: async (sql: string, params?: unknown[]) => {
      fake.queries.push({sql, params});
      if (sql.includes("FROM revenue_records")) { if (fake.fail) throw new Error("fake read failure"); return {rows:fake.rows}; }
      return {rows:[]};
    },
    release: () => { fake.released = true; }
  }; }
} } }));

describe("CRM read-only source", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("CRM_DATABASE_URL", "postgresql://readonly:local-only@127.0.0.1:55433/fake_crm");
    vi.stubEnv("CRM_DATABASE_CA_CERT", "");
    Object.assign(fake, {options:null, rows:[], queries:[], fail:false, released:false});
  });
  it("only reads inside a read-only transaction with a bounded query timeout", async () => {
    const {pullCrmPaidRecords} = await import("../../src/server/services/crmPaidSource");
    expect(await pullCrmPaidRecords()).toMatchObject({records:0, rows:[]});
    expect(fake.queries.map(q=>q.sql)).toEqual(["BEGIN TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '8000ms'", expect.stringContaining("FROM revenue_records"), "COMMIT"]);
    expect(fake.queries[2].params).toEqual([501,null]);
    expect(fake.options.query_timeout).toBe(10000);
    expect(fake.released).toBe(true);
  });
  it("rolls back and releases the connection if the read fails", async () => {
    fake.fail = true;
    const {pullCrmPaidRecords} = await import("../../src/server/services/crmPaidSource");
    await expect(pullCrmPaidRecords()).rejects.toThrow("fake read failure");
    expect(fake.queries.at(-1).sql).toBe("ROLLBACK");
    expect(fake.released).toBe(true);
  });
  it("does not connect when missing configuration or an invalid cursor is supplied", async () => {
    const {pullCrmPaidRecords} = await import("../../src/server/services/crmPaidSource");
    await expect(pullCrmPaidRecords("1; DELETE")).rejects.toThrow("Invalid CRM cursor");
    vi.stubEnv("CRM_DATABASE_URL", "");
    await expect(pullCrmPaidRecords()).rejects.toThrow("not configured");
    expect(fake.options).toBeNull();
  });
  it("verifies TLS on remote hosts even if the URL contains localhost in the password", async () => {
    vi.stubEnv("CRM_DATABASE_URL", "postgresql://readonly:localhost@crm.example.com/crm?sslmode=no-verify");
    vi.stubEnv("CRM_DATABASE_CA_CERT", "TEST\\nCA");
    const {pullCrmPaidRecords} = await import("../../src/server/services/crmPaidSource");
    await pullCrmPaidRecords();
    expect(fake.options.ssl).toEqual({rejectUnauthorized:true,ca:"TEST\nCA"});
    expect(fake.options.connectionString).not.toContain("sslmode");
  });
  it("returns a cursor for older records instead of silently hiding everything after 500", async () => {
    fake.rows = Array.from({length:501},(_,index)=>({id:`rev_${index}`,seq:1000-index, debt:1}));
    const {pullCrmPaidRecords} = await import("../../src/server/services/crmPaidSource");
    const first = await pullCrmPaidRecords();
    expect(first.records).toBe(500);
    expect(first.nextCursor).toBe("501");
    fake.rows = [{id:"old",seq:500,debt:1}];
    const next = await pullCrmPaidRecords(first.nextCursor);
    expect(fake.queries[6].params).toEqual([501,"501"]);
    expect(next.nextCursor).toBeUndefined();
  });
});
