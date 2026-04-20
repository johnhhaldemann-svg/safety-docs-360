import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCanonicalDocumentAiContext } from "@/lib/documentAiReviewContext";
import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import { GC_REQUIRED_PROGRAM_DOCUMENT_TYPE } from "@/lib/gcRequiredProgram";
import { serverLog } from "@/lib/serverLog";
import {
  extractGcProgramDocumentText,
  generateGcProgramAiReview,
} from "@/lib/gcProgramAiReview";

export type GcSiteReferenceExtractionMeta =
  | null
  | {
      fileName: string;
      ok: true;
      method: string;
      truncated: boolean;
      annotations: ReviewDocumentAnnotation[];
    }
  | {
      fileName: string;
      ok: false;
      error: string;
    };

export async function runGcProgramDocumentAiReview(
  admin: SupabaseClient,
  documentId: string,
  additionalGcContext: string,
  siteReference?: { buffer: Buffer; fileName: string } | null
): Promise<
  | {
      ok: true;
      review: Awaited<ReturnType<typeof generateGcProgramAiReview>>["review"];
      disclaimer: string;
      extraction:
        | { ok: true; method: string; truncated: boolean; annotations: ReviewDocumentAnnotation[] }
        | { ok: false; error: string };
      siteReferenceExtraction: GcSiteReferenceExtractionMeta;
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
      ? {
          ok: true as const,
          method: extracted.method,
          truncated: extracted.truncated,
          annotations: extracted.annotations,
        }
      : { ok: false as const, error: extracted.error };
    const canonicalReviewContext = buildCanonicalDocumentAiContext({
      recordNotes: doc.notes ?? null,
      annotations: extracted.ok ? extracted.annotations : [],
      reviewerContext: additionalGcContext.trim() || null,
    });

    let siteReferenceExtraction: GcSiteReferenceExtractionMeta = null;
    let siteReferenceText: string | null = null;
    let siteReferenceFileName: string | null = null;

    if (siteReference?.buffer?.length) {
      const refName = siteReference.fileName?.trim() || "site-reference.pdf";
      const siteExtracted = await extractGcProgramDocumentText(siteReference.buffer, refName);
      if (!siteExtracted.ok) {
        return {
          ok: false,
          status: 400,
          error: `Site reference file: ${siteExtracted.error}`,
        };
      }
      siteReferenceExtraction = {
        fileName: refName,
        ok: true,
        method: siteExtracted.method,
        truncated: siteExtracted.truncated,
        annotations: siteExtracted.annotations,
      };
      siteReferenceText = siteExtracted.text;
      siteReferenceFileName = refName;
    }

    const { review, disclaimer } = await generateGcProgramAiReview({
      documentText,
      documentTitle: doc.document_title ?? "",
      fileName,
      companyName,
      recordNotes: doc.notes ?? null,
      additionalGcContext: canonicalReviewContext || null,
      annotations: extracted.ok ? extracted.annotations : [],
      siteReferenceText,
      siteReferenceFileName,
    });

    return {
      ok: true,
      review,
      disclaimer,
      extraction: extractionMeta,
      siteReferenceExtraction,
      documentId: doc.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI review failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    serverLog("error", "gc_program_ai_review_failed", {
      documentId,
      status: isConfig ? 503 : 502,
      errorKind: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false, status: isConfig ? 503 : 502, error: message };
  }
}
