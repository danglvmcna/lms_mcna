import fs from "fs";
import path from "path";
import os from "os";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { pool } from "../db";

// Session materials (slides, documents) are stored in a private Supabase Storage bucket.
// Without Supabase credentials (local dev / serverless) files are persisted to PostgreSQL (BYTEA)
// so that multi-instance serverless functions (like Vercel) can download files reliably.

const SIGNED_URL_TTL_SECONDS = 60;

let client: SupabaseClient | null = null;
let bucketVerified = false;
let tableEnsured = false;

export async function ensureMaterialFilesTable() {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_files (
        storage_path TEXT PRIMARY KEY,
        file_data BYTEA NOT NULL,
        mime_type TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableEnsured = true;
  } catch (err: any) {
    console.warn("[Storage] Table creation notice:", err.message);
  }
}

// Env is read lazily because server.ts loads dotenv after its imports are evaluated.
function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (!client) {
    client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function bucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "lms-materials";
}

async function ensurePrivateBucket(supabase: SupabaseClient) {
  if (bucketVerified) return;
  const bucketName = bucket();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const existing = (buckets || []).find(item => item.name === bucketName);
  if (existing?.public) throw new Error("Material storage bucket must be private.");
  if (!existing) {
    const created = await supabase.storage.createBucket(bucketName, { public: false });
    if (created.error) throw created.error;
  }
  bucketVerified = true;
}

function getStorageRoot(): string {
  // On Vercel / serverless without explicit MATERIALS_DIR, use os.tmpdir() because cwd is read-only
  if (process.env.MATERIALS_DIR && !process.env.VERCEL) {
    return path.resolve(process.env.MATERIALS_DIR);
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "lms_materials");
  }
  return path.resolve(process.env.MATERIALS_DIR || path.join(process.cwd(), "storage", "materials"));
}

function localPathFor(objectPath: string) {
  const root = getStorageRoot();
  const resolved = path.resolve(root, objectPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid storage path.");
  }
  return resolved;
}

export type MaterialDownload =
  | { kind: "redirect"; url: string }
  | { kind: "buffer"; buffer: Buffer; mimeType?: string }
  | { kind: "local"; absolutePath: string };

export const materialStorage = {
  isRemote() {
    return Boolean(getClient());
  },

  async createDirectUpload(objectPath: string) {
    const supabase = getClient();
    if (!supabase) return null;
    await ensurePrivateBucket(supabase);
    const { data, error } = await supabase.storage.from(bucket()).createSignedUploadUrl(objectPath);
    if (error || !data) throw error || new Error("Could not create a signed upload URL.");
    return data.signedUrl;
  },

  async getDirectUploadInfo(objectPath: string) {
    const supabase = getClient();
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(bucket()).info(objectPath);
    if (error || !data) return null;
    return { sizeBytes: data.size ?? data.metadata?.size, contentType: data.contentType ?? data.metadata?.mimetype };
  },

  async put(objectPath: string, body: Buffer, contentType: string) {
    const supabase = getClient();
    if (supabase) {
      const bucketName = bucket();
      try {
        await ensurePrivateBucket(supabase);

        const { error } = await supabase.storage.from(bucketName).upload(objectPath, body, { contentType, upsert: true });
        if (!error) return;

        // If bucket error (e.g. 404 not found), try auto-creating once
        if (error.message?.toLowerCase().includes("not found") || (error as any).statusCode === 404) {
          await supabase.storage.createBucket(bucketName, { public: false }).catch(() => undefined);
          const retry = await supabase.storage.from(bucketName).upload(objectPath, body, { contentType, upsert: true });
          if (!retry.error) return;
        }

        console.warn(`[Storage] Supabase upload failed: ${error.message}. Falling back to DB/local storage.`);
      } catch (supaErr: any) {
        console.warn(`[Storage] Supabase error: ${supaErr.message}. Falling back to DB/local storage.`);
      }
    }

    // Persistent database storage fallback (ensures cross-instance persistence on Vercel Serverless)
    try {
      await ensureMaterialFilesTable();
      await pool.query(
        `INSERT INTO material_files (storage_path, file_data, mime_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (storage_path) DO UPDATE SET file_data = EXCLUDED.file_data, mime_type = EXCLUDED.mime_type`,
        [objectPath, body, contentType]
      );
    } catch (dbErr: any) {
      console.warn("[Storage] DB persistence notice:", dbErr.message);
    }

    // Local filesystem / tmpdir fallback
    try {
      const target = localPathFor(objectPath);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, body);
    } catch (fsErr: any) {
      console.warn("[Storage] Local filesystem write notice:", fsErr.message);
    }
  },

  async getDownload(objectPath: string, fileName: string, options?: { inline?: boolean }): Promise<MaterialDownload> {
    const supabase = getClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket())
          .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, options?.inline ? undefined : { download: fileName });
        if (!error && data?.signedUrl) {
          return { kind: "redirect", url: data.signedUrl };
        }
      } catch (err: any) {
        console.warn("[Storage] Supabase download error:", err.message);
      }
    }

    // Try persistent database storage (works on any Vercel serverless container)
    try {
      await ensureMaterialFilesTable();
      const res = await pool.query("SELECT file_data, mime_type FROM material_files WHERE storage_path = $1", [objectPath]);
      if (res.rows[0]?.file_data) {
        return {
          kind: "buffer",
          buffer: Buffer.from(res.rows[0].file_data),
          mimeType: res.rows[0].mime_type || undefined
        };
      }
    } catch (dbErr: any) {
      console.warn("[Storage] DB retrieve error:", dbErr.message);
    }

    // Try local filesystem
    try {
      const localPath = localPathFor(objectPath);
      if (fs.existsSync(localPath)) {
        return { kind: "local", absolutePath: localPath };
      }
    } catch {
      // ignore
    }

    return { kind: "local", absolutePath: localPathFor(objectPath) };
  },

  async remove(objectPaths: string[]) {
    if (objectPaths.length === 0) return;
    const supabase = getClient();
    if (supabase) {
      try {
        await supabase.storage.from(bucket()).remove(objectPaths);
      } catch {
        // Continue
      }
    }
    try {
      await pool.query("DELETE FROM material_files WHERE storage_path = ANY($1)", [objectPaths]);
    } catch {
      // Continue
    }
    for (const objectPath of objectPaths) {
      try {
        await fs.promises.rm(localPathFor(objectPath), { force: true });
      } catch {
        // Ignore deletion errors
      }
    }
  }
};
