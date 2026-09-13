import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Session materials (slides, documents) are stored in a private Supabase Storage bucket.
// Without Supabase credentials (local dev) files go to a private folder that is NOT exposed by
// the public /uploads static route; they are only reachable through the authorized download route.

const SIGNED_URL_TTL_SECONDS = 60;

let client: SupabaseClient | null = null;

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

function localPathFor(objectPath: string) {
  const root = path.resolve(process.env.MATERIALS_DIR || path.join(process.cwd(), "storage", "materials"));
  const resolved = path.resolve(root, objectPath);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid storage path.");
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
      const { error } = await supabase.storage.from(bucket()).upload(objectPath, body, { contentType, upsert: false });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
      return;
    }
    const target = localPathFor(objectPath);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, body);
  },

  async getDownload(objectPath: string, fileName: string): Promise<MaterialDownload> {
    const supabase = getClient();
    if (supabase) {
      const { data, error } = await supabase.storage
        .from(bucket())
        .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: fileName });
      if (error || !data?.signedUrl) throw new Error(`Supabase signed URL failed: ${error?.message || "missing URL"}`);
      return { kind: "redirect", url: data.signedUrl };
    }
    return { kind: "local", absolutePath: localPathFor(objectPath) };
  },

  async remove(objectPaths: string[]) {
    if (objectPaths.length === 0) return;
    const supabase = getClient();
    if (supabase) {
      const { error } = await supabase.storage.from(bucket()).remove(objectPaths);
      if (error) throw new Error(`Supabase delete failed: ${error.message}`);
      return;
    }
    for (const objectPath of objectPaths) {
      await fs.promises.rm(localPathFor(objectPath), { force: true });
    }
  }
};
