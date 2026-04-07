import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { normalizeDocumentsBucketObjectPath } from "@/lib/documentsBucketPath";

export { normalizeDocumentsBucketObjectPath } from "@/lib/documentsBucketPath";

/**
 * Download an object from the `documents` bucket using the service role.
 * Required for paths outside `companies/...` (e.g. `drafts/`, `final/`, `marketplace-preview/`)
 * because storage RLS for authenticated users is scoped to company prefixes.
 */
export async function downloadDocumentsBucketObject(
  objectPath: string
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "File preview is unavailable: add SUPABASE_SERVICE_ROLE_KEY to the server environment (e.g. Vercel project settings).",
      status: 503,
    };
  }

  const key = normalizeDocumentsBucketObjectPath(objectPath);

  const { data: blob, error } = await admin.storage.from("documents").download(key);

  if (error || !blob) {
    const msg = (error?.message ?? "").toLowerCase();
    const notFound =
      msg.includes("not found") ||
      msg.includes("does not exist") ||
      msg.includes("no such object") ||
      msg.includes("object not found") ||
      /\b404\b/.test(msg);
    if (notFound) {
      return {
        ok: false,
        error:
          "The file could not be found in storage. It may have been removed or the path may be outdated.",
        status: 404,
      };
    }
    return {
      ok: false,
      error: error?.message || "Could not read the file from storage.",
      status: 503,
    };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  return { ok: true, buffer };
}
