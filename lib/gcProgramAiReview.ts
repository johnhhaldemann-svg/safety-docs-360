import { extractResponsesApiOutputText } from "@/lib/ai/responses";
import { getReviewLayoutGuidance } from "@/lib/documentLayoutGuidance";
import { buildNoteCoverage, detectDocumentQualityIssues } from "@/lib/documentAiReviewSignals";
import type { ReviewDocumentAnnotation } from "@/lib/documentReviewExtraction";
import {
  extractReviewDocumentText,
  sniffReviewDocumentKind,
} from "@/lib/documentReviewExtraction";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";

export type GcProgramAiReview = {
  executiveSummary: string;
  /** How well the submission reflects what the GC / site requires the sub to follow on site */
  alignmentWithGcSiteRequirements: string;
  /** Construction-relevant OSHA themes (e.g. fall protection, electrical, PPE, training) - strengths */
  oshaRelatedStrengths: string[];
  /** Gaps, missing elements, or risks relative to typical OSHA expectations for the described work */
  oshaRelatedGapsOrRisks: string[];
  recommendedFollowUps: string[];
  documentQualityIssues?: string[];
  noteCoverage?: string[];
  overallAssessment: "sufficient" | "needs_work" | "insufficient_context";
};

const DISCLAIMER =
  "This AI review is for internal triage only. It is not legal advice, does not replace a competent safety professional or the AHJ, and may omit or misread content. Verify against current OSHA / state rules and the contract documents.";

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

/** Detect PDF / Office Open XML (docx) when the filename omits or misstates the extension. */
export function sniffGcDocumentKind(buffer: Buffer): "pdf" | "docx" | null {
  return sniffReviewDocumentKind(buffer);
}

/** Extract plain text from uploaded GC program files (PDF, DOCX). */
export async function extractGcProgramDocumentText(buffer: Buffer, fileName: string) {
  return extractReviewDocumentText(buffer, fileName);
}

function buildDeterministicGcProgramReview(params: {
  documentText: string;
  documentTitle: string;
  fileName: string;
  additionalGcContext?: string | null;
  siteReferenceText?: string | null;
  annotations?: ReviewDocumentAnnotation[];
}): GcProgramAiReview {
  const draftText = params.documentText.trim().toLowerCase();
  const contextText = `${params.additionalGcContext ?? ""}\n${params.siteReferenceText ?? ""}`.toLowerCase();
  const hasBody = draftText.length >= 80;
  const strengths: string[] = [];
  const gaps: string[] = [];
  const followUps: string[] = [];

  if (includesAny(draftText, ["fall protection", "ppe", "training", "inspection", "emergency"])) {
    strengths.push(
      "The submission appears to address at least some core construction safety program elements expected during GC review."
    );
  } else {
    gaps.push(
      "Core construction safety elements such as PPE, training, inspections, or emergency response are not clearly described."
    );
    followUps.push(
      "Request a fuller program narrative covering PPE, training, inspections, and emergency responsibilities."
    );
  }

  if (includesAny(draftText, ["hazard", "control", "permit", "loto", "hot work", "excavat"])) {
    strengths.push(
      "The document includes language tied to hazard recognition, controls, or permit-sensitive work."
    );
  } else {
    gaps.push(
      "Hazard controls and permit-triggering work are not explained with enough detail for reliable GC review."
    );
    followUps.push(
      "Ask the subcontractor to add task-specific hazards, controls, and permit triggers."
    );
  }

  if (contextText.trim()) {
    strengths.push("GC or site reference context is available for manual comparison against the submission.");
    followUps.push("Verify the submission against the GC or site reference requirements before approval.");
  }

  if (!hasBody) {
    gaps.unshift("The uploaded submission contains too little extractable text for a strong document comparison.");
    followUps.unshift("Re-upload a readable PDF or DOCX before relying on this review.");
  }

  while (strengths.length < 2) {
    strengths.push("The submission provides at least a basic starting point for human GC review.");
  }
  while (gaps.length < 2) {
    gaps.push(
      "Additional clarification is required before this submission should be treated as approval-ready."
    );
  }
  while (followUps.length < 2) {
    followUps.push(
      "Have the reviewer confirm alignment with site rules and applicable OSHA-oriented expectations."
    );
  }

  return {
    executiveSummary: hasBody
      ? `Review for ${params.documentTitle || params.fileName} used deterministic fallback logic because no server OpenAI key is configured. The submission appears partially structured, but it still requires manual validation before approval.`
      : `Review for ${params.documentTitle || params.fileName} could not be completed in depth because the extracted text is limited and no server OpenAI key is configured.`,
    alignmentWithGcSiteRequirements: hasBody
      ? "The document can be compared manually against GC and site requirements, but alignment should not be assumed without reviewer confirmation."
      : "There is not enough readable content to confirm alignment with GC or site requirements.",
    oshaRelatedStrengths: strengths.slice(0, 6),
    oshaRelatedGapsOrRisks: gaps.slice(0, 8),
    recommendedFollowUps: followUps.slice(0, 6),
    documentQualityIssues: detectDocumentQualityIssues(params.documentText),
    noteCoverage: buildNoteCoverage(params.annotations ?? []),
    overallAssessment: hasBody ? "needs_work" : "insufficient_context",
  };
}

export async function generateGcProgramAiReview(params: {
  documentText: string;
  documentTitle: string;
  fileName: string;
  companyName?: string | null;
  recordNotes?: string | null;
  /** Pasted GC / site requirements when not fully captured in the file */
  additionalGcContext?: string | null;
  annotations?: ReviewDocumentAnnotation[];
  /** Optional uploaded site/GC reference (PDF/DOCX text) to compare against the submission */
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
}): Promise<{ review: GcProgramAiReview; disclaimer: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      review: buildDeterministicGcProgramReview(params),
      disclaimer: DISCLAIMER,
    };
  }

  const hasBody = params.documentText.trim().length >= 80;
  const siteName = params.siteReferenceFileName?.trim() || null;
  const siteText = params.siteReferenceText?.trim() ?? "";
  const hasSiteRef = Boolean(siteName && siteText.length >= 20);
  const annotationText = (params.annotations ?? [])
    .slice(0, 8)
    .map((annotation) =>
      [
        `- ${annotation.note}`,
        annotation.anchorText ? `  Anchor text: ${annotation.anchorText}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");

  const contextBlock = [
    `File name: ${params.fileName}`,
    `Title / label: ${params.documentTitle || "(none)"}`,
    params.companyName ? `Company: ${params.companyName}` : null,
    params.recordNotes ? `Record notes: ${params.recordNotes}` : null,
    annotationText ? `Embedded reviewer notes from DOCX comments:\n${annotationText}` : null,
    params.additionalGcContext?.trim()
      ? `Additional GC / site requirements (admin-provided): ${params.additionalGcContext.trim()}`
      : null,
    siteName
      ? hasSiteRef
        ? `--- Site / GC reference document (${siteName}) ---\n${params.siteReferenceText}`
        : `--- Site / GC reference document (${siteName}) ---\n(File uploaded but extractable text is missing or very short; rely on pasted requirements and submission text.)`
      : null,
    hasBody
      ? `--- Subcontractor submission (document under review) ---\n${params.documentText}`
      : `--- Subcontractor submission (document under review) ---\n(No extractable text or too short; rely on metadata and any additional context above.)`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "You are an expert in U.S. OSHA construction safety (29 CFR Part 1926 where relevant) and general industry concepts where they apply to described work.",
    "The primary input is a program, plan, or submission that a subcontractor uploaded because a General Contractor (GC) or site requires them to follow it on site, in addition to regulatory baselines.",
    getReviewLayoutGuidance(),
    "Tasks:",
    "1) Assess how well the submission addresses typical OSHA-aligned expectations for the scope implied in the text (hazards, controls, training, PPE, emergency response, competent persons, inspections, etc.) without inventing citations or claiming the document is filed with OSHA.",
    "2) Assess alignment with what the GC/site expects the sub to follow: use the submission text, any pasted 'Additional GC / site requirements', and when present the 'Site / GC reference document' section as the authoritative site/GC expectations to compare against.",
    "3) When a site/GC reference document is provided, explicitly call out where the submission matches, omits, or conflicts with that reference, in addition to OSHA-oriented gaps.",
    "4) Separate content or generation issues from visual or presentation issues where the text clearly shows layout, placeholder, branding, or internal-label problems.",
    "5) When record notes or embedded reviewer comments are provided, map them to concrete recommended follow-ups and capture that mapping in noteCoverage.",
    "6) Populate documentQualityIssues with customer-facing output problems such as placeholders, leaked internal generator labels, raw risk-score presentation, or task-trigger wording.",
    "7) Be specific and practical. If the text is thin or unreadable, set overallAssessment to insufficient_context and explain limitations.",
    "Do NOT invent incidents, citations, or OSHA inspection outcomes. Do not claim to verify regulatory compliance.",
    "Output strict JSON matching the schema.",
    contextBlock,
  ].join("\n\n");

  const res = await fetch(`${getOpenAiApiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAiCompatibleModelId("gpt-4.1"),
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "gc_program_ai_review",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              executiveSummary: { type: "string" },
              alignmentWithGcSiteRequirements: { type: "string" },
              oshaRelatedStrengths: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              oshaRelatedGapsOrRisks: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 8,
              },
              recommendedFollowUps: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              documentQualityIssues: {
                type: "array",
                items: { type: "string" },
                maxItems: 6,
              },
              noteCoverage: {
                type: "array",
                items: { type: "string" },
                maxItems: 8,
              },
              overallAssessment: {
                type: "string",
                enum: ["sufficient", "needs_work", "insufficient_context"],
              },
            },
            required: [
              "executiveSummary",
              "alignmentWithGcSiteRequirements",
              "oshaRelatedStrengths",
              "oshaRelatedGapsOrRisks",
              "recommendedFollowUps",
              "overallAssessment",
            ],
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errText.slice(0, 500)}`);
  }

  const json: unknown = await res.json();
  const rawText = extractResponsesApiOutputText(json);
  if (!rawText) {
    throw new Error("Empty model output.");
  }

  let parsed: Partial<GcProgramAiReview>;
  try {
    parsed = JSON.parse(rawText) as Partial<GcProgramAiReview>;
  } catch {
    throw new Error("Could not parse model JSON.");
  }

  const review: GcProgramAiReview = {
    executiveSummary: String(parsed.executiveSummary ?? "").trim() || "No summary returned.",
    alignmentWithGcSiteRequirements:
      String(parsed.alignmentWithGcSiteRequirements ?? "").trim() || "-",
    oshaRelatedStrengths: Array.isArray(parsed.oshaRelatedStrengths)
      ? parsed.oshaRelatedStrengths.filter((x) => typeof x === "string" && x.trim())
      : [],
    oshaRelatedGapsOrRisks: Array.isArray(parsed.oshaRelatedGapsOrRisks)
      ? parsed.oshaRelatedGapsOrRisks.filter((x) => typeof x === "string" && x.trim())
      : [],
    recommendedFollowUps: Array.isArray(parsed.recommendedFollowUps)
      ? parsed.recommendedFollowUps.filter((x) => typeof x === "string" && x.trim())
      : [],
    documentQualityIssues: Array.isArray(parsed.documentQualityIssues)
      ? parsed.documentQualityIssues.filter((x) => typeof x === "string" && x.trim())
      : detectDocumentQualityIssues(params.documentText),
    noteCoverage: Array.isArray(parsed.noteCoverage)
      ? parsed.noteCoverage.filter((x) => typeof x === "string" && x.trim())
      : buildNoteCoverage(params.annotations ?? []),
    overallAssessment:
      parsed.overallAssessment === "sufficient" ||
      parsed.overallAssessment === "needs_work" ||
      parsed.overallAssessment === "insufficient_context"
        ? parsed.overallAssessment
        : "insufficient_context",
  };

  return { review, disclaimer: DISCLAIMER };
}
