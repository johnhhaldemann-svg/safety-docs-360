import { extractGcProgramDocumentText } from "@/lib/gcProgramAiReview";

export type BuilderProgramAiReview = {
  executiveSummary: string;
  /** How well the draft covers stated project scope, trade work, hazards, and controls */
  scopeTradeAndHazardCoverage: string;
  /** Strengths vs typical OSHA construction expectations and program clarity */
  regulatoryAndProgramStrengths: string[];
  /** Gaps, ambiguities, or risks to resolve before final approval */
  gapsRisksOrClarifications: string[];
  /** Concrete edits or follow-ups for the reviewer */
  recommendedEditsBeforeApproval: string[];
  overallAssessment: "sufficient" | "needs_work" | "insufficient_context";
};

const DISCLAIMER =
  "This AI review is for internal triage only. It is not legal advice, does not replace a competent safety professional or the AHJ, and may omit or misread content. Verify against current OSHA / state rules, environmental obligations where applicable, and the contract documents.";

function extractResponsesApiOutputText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.output_text === "string" && o.output_text.trim()) return o.output_text.trim();

  const output = o.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const itemObj = item as Record<string, unknown>;
    const content = itemObj.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") chunks.push(p.text);
    }
  }
  const joined = chunks.join("").trim();
  return joined || null;
}

export { extractGcProgramDocumentText as extractBuilderReviewDocumentText };

export async function generateBuilderProgramAiReview(params: {
  documentText: string;
  /** e.g. CSEP, PSHSEP, PESHEP */
  programLabel: string;
  projectName: string;
  documentTitle?: string | null;
  companyName?: string | null;
  recordNotes?: string | null;
  additionalReviewerContext?: string | null;
  /** Optional site/owner/GC reference (PDF/DOCX) to compare against the draft */
  siteReferenceText?: string | null;
  siteReferenceFileName?: string | null;
}): Promise<{ review: BuilderProgramAiReview; disclaimer: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const label = params.programLabel.trim().toUpperCase();
  const hasBody = params.documentText.trim().length >= 80;
  const siteName = params.siteReferenceFileName?.trim() || null;
  const siteText = params.siteReferenceText?.trim() ?? "";
  const hasSiteRef = Boolean(siteName && siteText.length >= 20);

  const contextBlock = [
    `Program type: ${label} (CSEP / PSHSEP / PESHEP-style builder safety-environmental plans in this product).`,
    `Project name: ${params.projectName || "(none)"}`,
    params.documentTitle?.trim() ? `Title: ${params.documentTitle.trim()}` : null,
    params.companyName?.trim() ? `Company: ${params.companyName.trim()}` : null,
    params.recordNotes?.trim() ? `Record notes: ${params.recordNotes.trim()}` : null,
    params.additionalReviewerContext?.trim()
      ? `Reviewer-provided context (site rules, owner requirements, gaps to check): ${params.additionalReviewerContext.trim()}`
      : null,
    siteName
      ? hasSiteRef
        ? `--- Site / owner / GC reference document (${siteName}) ---\n${params.siteReferenceText}`
        : `--- Site / owner / GC reference document (${siteName}) ---\n(Uploaded file has little or no extractable text; rely on pasted context and draft below.)`
      : null,
    hasBody
      ? `--- Builder draft under review ---\n${params.documentText}`
      : `--- Builder draft under review ---\n(No extractable text or too short; rely on metadata and reviewer context.)`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "You are an expert reviewer of U.S. construction safety documentation (OSHA 29 CFR Part 1926 where relevant) and practical field readiness of safety/environmental plans.",
    "The primary file is a draft from the product's builder workflow (CSEP, PSHSEP, PESHEP, etc.). It is not final until a human reviewer approves.",
    "Tasks:",
    "1) Summarize what the draft appears to cover (scope, trades, hazards, controls, PPE, permits, emergency info, environmental notes if any).",
    "2) Identify strengths relative to typical expectations for a site-specific or project safety/environmental plan.",
    "3) When a site/owner/GC reference document is provided, compare the draft to that reference: note matches, omissions, and conflicts, in addition to OSHA-oriented gaps.",
    "4) Identify gaps, ambiguities, or risks a reviewer should address before approving (missing sections, vague controls, inconsistent PPE, etc.).",
    "5) Recommend concrete edits or follow-up questions for the reviewer.",
    "Do NOT invent citations, inspections, or compliance determinations. If text is unreadable or too thin, set overallAssessment to insufficient_context.",
    "Output strict JSON matching the schema.",
    contextBlock,
  ].join("\n\n");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "builder_program_ai_review",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              executiveSummary: { type: "string" },
              scopeTradeAndHazardCoverage: { type: "string" },
              regulatoryAndProgramStrengths: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              gapsRisksOrClarifications: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 8,
              },
              recommendedEditsBeforeApproval: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              overallAssessment: {
                type: "string",
                enum: ["sufficient", "needs_work", "insufficient_context"],
              },
            },
            required: [
              "executiveSummary",
              "scopeTradeAndHazardCoverage",
              "regulatoryAndProgramStrengths",
              "gapsRisksOrClarifications",
              "recommendedEditsBeforeApproval",
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

  let parsed: Partial<BuilderProgramAiReview>;
  try {
    parsed = JSON.parse(rawText) as Partial<BuilderProgramAiReview>;
  } catch {
    throw new Error("Could not parse model JSON.");
  }

  const review: BuilderProgramAiReview = {
    executiveSummary: String(parsed.executiveSummary ?? "").trim() || "No summary returned.",
    scopeTradeAndHazardCoverage: String(parsed.scopeTradeAndHazardCoverage ?? "").trim() || "—",
    regulatoryAndProgramStrengths: Array.isArray(parsed.regulatoryAndProgramStrengths)
      ? parsed.regulatoryAndProgramStrengths.filter((x) => typeof x === "string" && x.trim())
      : [],
    gapsRisksOrClarifications: Array.isArray(parsed.gapsRisksOrClarifications)
      ? parsed.gapsRisksOrClarifications.filter((x) => typeof x === "string" && x.trim())
      : [],
    recommendedEditsBeforeApproval: Array.isArray(parsed.recommendedEditsBeforeApproval)
      ? parsed.recommendedEditsBeforeApproval.filter((x) => typeof x === "string" && x.trim())
      : [],
    overallAssessment:
      parsed.overallAssessment === "sufficient" ||
      parsed.overallAssessment === "needs_work" ||
      parsed.overallAssessment === "insufficient_context"
        ? parsed.overallAssessment
        : "insufficient_context",
  };

  return { review, disclaimer: DISCLAIMER };
}
