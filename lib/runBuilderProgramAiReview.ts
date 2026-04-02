import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractBuilderReviewDocumentText,
  generateBuilderProgramAiReview,
} from "@/lib/builderDocumentAiReview";

const BUILDER_TYPES = new Set(["CSEP", "PSHSEP", "PESHEP", "PESHEPS"]);

function normalizeBuilderProgramType(documentType: string | null | undefined): string | null {
  const t = (documentType ?? "").trim().toUpperCase();
  return BUILDER_TYPES.has(t) ? t : null;
}

export async function runBuilderProgramDocumentAiReview(
  admin: SupabaseClient,
  documentId: string,
  additionalReviewerContext: string
): Promise<
  | {
      ok: true;
      review: Awaited<ReturnType<typeof generateBuilderProgramAiReview>>["review"];
      disclaimer: string;
      extraction:
        | { ok: true; method: string; truncated: boolean }
        | { ok: false; error: string };
      documentId: string;
      programLabel: string;
    }
  | { ok: false; status: number; error: string }
> {
  const { data: row, error: docError } = await admin
    .from("documents")
    .select(
      "id, document_type, draft_file_path, final_file_path, file_name, document_title, project_name, notes, company_id"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (docError) {
    return { ok: false, status: 500, error: docError.message || "Failed to load document." };
  }

  const doc = row as {
    id?: string;
    document_type?: string | null;
    draft_file_path?: string | null;
    final_file_path?: string | null;
    file_name?: string | null;
    document_title?: string | null;
    project_name?: string | null;
    notes?: string | null;
    company_id?: string | null;
  } | null;

  if (!doc?.id) {
    return { ok: false, status: 404, error: "Document not found." };
  }

  const programLabel = normalizeBuilderProgramType(doc.document_type ?? null);
  if (!programLabel) {
    return {
      ok: false,
      status: 400,
      error: "AI review for this program type is only available for CSEP and PSHSEP submissions.",
    };
  }

  const storagePath = doc.draft_file_path?.trim() || doc.final_file_path?.trim() || "";
  if (!storagePath) {
    return { ok: false, status: 400, error: "No draft or final file is available for analysis." };
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

  const { data: fileBlob, error: dlError } = await admin.storage.from("documents").download(storagePath);

  if (dlError || !fileBlob) {
    return {
      ok: false,
      status: 500,
      error: dlError?.message || "Could not download file from storage.",
    };
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const fileName =
    doc.file_name?.trim() ||
    storagePath.split("/").pop()?.trim() ||
    `${programLabel.toLowerCase()}-draft.docx`;

  try {
    const extracted = await extractBuilderReviewDocumentText(buffer, fileName);
    const documentText = extracted.ok ? extracted.text : "";
    const extractionMeta = extracted.ok
      ? { ok: true as const, method: extracted.method, truncated: extracted.truncated }
      : { ok: false as const, error: extracted.error };

    const { review, disclaimer } = await generateBuilderProgramAiReview({
      documentText,
      programLabel,
      projectName: doc.project_name?.trim() || "",
      documentTitle: doc.document_title ?? null,
      companyName,
      recordNotes: doc.notes ?? null,
      additionalReviewerContext: additionalReviewerContext.trim() || null,
    });

    return {
      ok: true,
      review,
      disclaimer,
      extraction: extractionMeta,
      documentId: doc.id,
      programLabel,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI review failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    return { ok: false, status: isConfig ? 503 : 502, error: message };
  }
}
