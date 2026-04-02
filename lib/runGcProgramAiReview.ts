import type { SupabaseClient } from "@supabase/supabase-js";
import { GC_REQUIRED_PROGRAM_DOCUMENT_TYPE } from "@/lib/gcRequiredProgram";
import {
  extractGcProgramDocumentText,
  generateGcProgramAiReview,
} from "@/lib/gcProgramAiReview";

export async function runGcProgramDocumentAiReview(
  admin: SupabaseClient,
  documentId: string,
  additionalGcContext: string
): Promise<
  | {
      ok: true;
      review: Awaited<ReturnType<typeof generateGcProgramAiReview>>["review"];
      disclaimer: string;
      extraction:
        | { ok: true; method: string; truncated: boolean }
        | { ok: false; error: string };
      documentId: string;
    }
  | { ok: false; status: number; error: string }
> {
  const { data: row, error: docError } = await admin
    .from("documents")
    .select("id, document_type, file_path, file_name, document_title, notes, company_id")
    .eq("id", documentId)
    .maybeSingle();

  if (docError) {
    return { ok: false, status: 500, error: docError.message || "Failed to load document." };
  }

  const doc = row as {
    id?: string;
    document_type?: string | null;
    file_path?: string | null;
    file_name?: string | null;
    document_title?: string | null;
    notes?: string | null;
    company_id?: string | null;
  } | null;

  if (!doc?.id || !doc.file_path) {
    return { ok: false, status: 404, error: "Document not found or has no file." };
  }

  if ((doc.document_type ?? "").trim() !== GC_REQUIRED_PROGRAM_DOCUMENT_TYPE) {
    return { ok: false, status: 400, error: "Not a GC program document." };
  }

  let companyName: string | null = null;
  if (doc.company_id) {
    const { data: co } = await admin
      .from("companies")
      .select("name")
      .eq("id", doc.company_id)
      .maybeSingle();
    companyName = (co as { name?: string } | null)?.name?.trim() || null;
  }

  const { data: fileBlob, error: dlError } = await admin.storage
    .from("documents")
    .download(doc.file_path);

  if (dlError || !fileBlob) {
    return {
      ok: false,
      status: 500,
      error: dlError?.message || "Could not download file from storage.",
    };
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const fileName = doc.file_name?.trim() || "upload";

  try {
    const extracted = await extractGcProgramDocumentText(buffer, fileName);
    const documentText = extracted.ok ? extracted.text : "";
    const extractionMeta = extracted.ok
      ? { ok: true as const, method: extracted.method, truncated: extracted.truncated }
      : { ok: false as const, error: extracted.error };

    const { review, disclaimer } = await generateGcProgramAiReview({
      documentText,
      documentTitle: doc.document_title ?? "",
      fileName,
      companyName,
      recordNotes: doc.notes ?? null,
      additionalGcContext: additionalGcContext.trim() || null,
    });

    return {
      ok: true,
      review,
      disclaimer,
      extraction: extractionMeta,
      documentId: doc.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI review failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    return { ok: false, status: isConfig ? 503 : 502, error: message };
  }
}
