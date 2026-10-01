import pg from "pg";
import { CrmPaidPull, crmRecordsToPaidRows, CrmRevenueRecord } from "../../crmPaidSource";

// Reads the CRM's revenue records straight from its database (CRM_DATABASE_URL) so the class manager does
// not have to paste the paid list by hand. The LMS only ever reads there: every query runs in a read-only
// transaction, and the connection should use a database role with read access to revenue_records only.

const MAX_RECORDS = 500;

export const isCrmSourceConfigured = () => Boolean((process.env.CRM_DATABASE_URL || "").trim());

let crmPool: pg.Pool | null = null;

function getCrmPool(): pg.Pool {
  if (!crmPool) {
    const connectionString = (process.env.CRM_DATABASE_URL || "").trim();
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid CRM database protocol.");
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    // URL SSL parameters can override node-postgres's explicit TLS configuration.
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
    crmPool = new pg.Pool({
      connectionString: url.toString(),
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
      application_name: "mcna-lms-crm-readonly",
      ssl: isLocal ? undefined : { rejectUnauthorized: true, ...(process.env.CRM_DATABASE_CA_CERT ? { ca: process.env.CRM_DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}) }
    });
    crmPool.on("error", () => console.error("[crm-source] idle connection failed"));
  }
  return crmPool;
}

/** The latest revenue records of the CRM as rows for the paid-customers import. */
export async function pullCrmPaidRecords(cursor?: string): Promise<CrmPaidPull> {
  if (!isCrmSourceConfigured()) throw new Error("CRM source not configured.");
  if (cursor !== undefined && !/^\d{1,20}$/.test(cursor)) throw new Error("Invalid CRM cursor.");
  const client = await getCrmPool().connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '8000ms'");
    const result = await client.query(
      `SELECT id, seq, "saleDate", "customerName", "customerPhone", "customerEmail", "customerType",
              "courseSold", "totalRevenue", debt, "paymentMethod"
       FROM revenue_records
       WHERE ($2::bigint IS NULL OR seq < $2::bigint)
       ORDER BY seq DESC
       LIMIT $1`,
      [MAX_RECORDS + 1, cursor || null]
    );
    await client.query("COMMIT");
    const records = result.rows.slice(0, MAX_RECORDS);
    return { ...crmRecordsToPaidRows(records as CrmRevenueRecord[]), ...(result.rows.length > MAX_RECORDS ? { nextCursor: String(records.at(-1).seq) } : {}) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
