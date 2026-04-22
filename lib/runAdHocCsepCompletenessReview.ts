import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import {
  extractBuilderReviewDocumentText,
  generateBuilderProgramAiReview,
} from "@/lib/builderDocumentAiReview";
import { serverLog } from "@/lib/serverLog";

export type AdHocReviewExtraction =
  | { ok: true; method: string; truncated: boolean; annotations: ReviewDocumentAnnotation[] }
  | { ok: false; error: string };

export type AdHocSiteReferenceExtraction =
  Array<{
      fileName: string;
      ok: true;
      method: string;
      truncated: boolean;
      annotations: ReviewDocumentAnnotation[];
    }>;

export async function runAdHocCsepCompletenessReview(params: {
  document: { buffer: Buffer; fileName: string };
  additionalReviewerContext: string;
  siteDocuments?: Array<{ buffer: Buffer; fileName: string }> | null;
  builderExpectationSummary?: string[] | null;
}) {
  try {
    const extracted = await extractBuilderReviewDocumentText(
      params.document.buffer,
      params.document.fileName
    );
    const documentText = extracted.ok ? extracted.text : "";
    const extractionMeta: AdHocReviewExtraction = extracted.ok
      ? {
          ok: true,
          method: extracted.method,
          truncated: extracted.truncated,
          annotations: extracted.annotations,
        }
      : { ok: false, error: extracted.error };

    const siteReferenceExtraction: AdHocSiteReferenceExtraction = [];
    const siteReferenceBlocks: string[] = [];

    for (const siteDocument of params.siteDocuments ?? []) {
      if (!siteDocument?.buffer?.length) {
        continue;
      }

      const refName = siteDocument.fileName?.trim() || `site-reference-${siteReferenceExtraction.length + 1}.pdf`;
      const siteExtracted = await extractBuilderReviewDocumentText(siteDocument.buffer, refName);
      if (!siteExtracted.ok) {
        return {
          ok: false as const,
          status: 400,
          error: `Site reference file "${refName}": ${siteExtracted.error}`,
        };
      }

      siteReferenceExtraction.push({
        fileName: refName,
        ok: true,
        method: siteExtracted.method,
        truncated: siteExtracted.truncated,
        annotations: siteExtracted.annotations,
      });
      siteReferenceBlocks.push(
        [`Reference file: ${refName}`, siteExtracted.text.trim()].filter(Boolean).join("\n")
      );
    }

    const { review, disclaimer } = await generateBuilderProgramAiReview({
      documentText,
      programLabel: "CSEP",
      projectName: params.document.fileName.replace(/\.[^.]+$/, ""),
      documentTitle: params.document.fileName,
      additionalReviewerContext: params.additionalReviewerContext,
      annotations: extracted.ok ? extracted.annotations : [],
      siteReferenceText: siteReferenceBlocks.length ? siteReferenceBlocks.join("\n\n---\n\n") : null,
      siteReferenceFileName: siteReferenceExtraction.length
        ? siteReferenceExtraction.map((item) => item.fileName).join(", ")
        : null,
      reviewMode: "csep_completeness",
      builderExpectationSummary: params.builderExpectationSummary,
    });

    return {
      ok: true as const,
      review,
      disclaimer,
      extraction: extractionMeta,
      siteReferenceExtraction,
      fileName: params.document.fileName,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI review failed.";
    const isConfig = message.includes("OPENAI_API_KEY");
    serverLog("error", "ad_hoc_csep_completeness_review_failed", {
      fileName: params.document.fileName,
      status: isConfig ? 503 : 502,
      errorKind: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false as const, status: isConfig ? 503 : 502, error: message };
  }
}
