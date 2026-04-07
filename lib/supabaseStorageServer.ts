import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

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

  const { data: blob, error } = await admin.storage
    .from("documents")
    .download(objectPath.trim());

  if (error || !blob) {
    return {
      ok: false,
      error: error?.message || "Could not read the file from storage.",
      status: 500,
    };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  return { ok: true, buffer };
}
