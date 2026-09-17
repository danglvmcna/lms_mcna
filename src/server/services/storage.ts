import fs from "fs";
import path from "path";
import os from "os";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Session materials (slides, documents) are stored in a private Supabase Storage bucket.
// Without Supabase credentials (local dev / serverless) files go to a private folder that is NOT exposed by
// the public /uploads static route; they are only reachable through the authorized download route.

const SIGNED_URL_TTL_SECONDS = 60;

let client: SupabaseClient | null = null;
let bucketVerified = false;

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
  | { kind: "local"; absolutePath: string };

export const materialStorage = {
  isRemote() {
    return Boolean(getClient());
  },

  async put(objectPath: string, body: Buffer, contentType: string) {
    const supabase = getClient();
    if (supabase) {
      const bucketName = bucket();
      try {
        if (!bucketVerified) {
          const { data: buckets } = await supabase.storage.listBuckets();
          const exists = (buckets || []).some(b => b.name === bucketName);
          if (!exists) {
            await supabase.storage.createBucket(bucketName, { public: false }).catch(() => undefined);
          }
          bucketVerified = true;
        }

        const { error } = await supabase.storage.from(bucketName).upload(objectPath, body, { contentType, upsert: true });
        if (!error) return;

        // If bucket error (e.g. 404 not found), try auto-creating once
        if (error.message?.toLowerCase().includes("not found") || (error as any).statusCode === 404) {
          await supabase.storage.createBucket(bucketName, { public: false }).catch(() => undefined);
          const retry = await supabase.storage.from(bucketName).upload(objectPath, body, { contentType, upsert: true });
          if (!retry.error) return;
        }

        console.warn(`[Storage] Supabase upload failed: ${error.message}. Falling back to local storage.`);
      } catch (supaErr: any) {
        console.warn(`[Storage] Supabase error: ${supaErr.message}. Falling back to local storage.`);
      }
    }

    const target = localPathFor(objectPath);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, body);
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
        console.warn("[Storage] Supabase download error, trying local fallback:", err.message);
      }
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
        // Continue to local cleanup
      }
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
