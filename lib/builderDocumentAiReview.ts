import { extractResponsesApiOutputText } from "@/lib/ai/responses";
import { extractGcProgramDocumentText } from "@/lib/gcProgramAiReview";
import { getOpenAiApiBaseUrl, resolveOpenAiCompatibleModelId } from "@/lib/openaiClient";

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

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function buildDeterministicBuilderProgramReview(params: {
  documentText: string;
  programLabel: string;
  projectName: string;
  additionalReviewerContext?: string | null;
  siteReferenceText?: string | null;
  companyMemoryExcerpts?: string | null;
}): BuilderProgramAiReview {
  const draftText = params.documentText.trim().toLowerCase();
  const referenceText = `${params.additionalReviewerContext ?? ""}\n${params.siteReferenceText ?? ""}\n${params.companyMemoryExcerpts ?? ""}`.toLowerCase();
  const hasBody = draftText.length >= 80;
  const strengths: string[] = [];
  const gaps: string[] = [];
  const edits: string[] = [];

  if (includesAny(draftText, ["ppe", "hard hat", "gloves", "respirator", "safety glasses"])) {
    strengths.push("The draft appears to include at least some PPE expectations for field crews.");
  } else {
    gaps.push("PPE expectations are not clearly described and should be made explicit for the planned work.");
    edits.push("Add a dedicated PPE section tied to the active trades, tasks, and site conditions.");
  }

  if (includesAny(draftText, ["permit", "hot work", "confined space", "loto", "excavat", "trench"])) {
    strengths.push("The draft references permit-sensitive work or approval triggers that usually require closer field coordination.");
  } else {
    gaps.push("Permit-triggering activities are not clearly mapped, so reviewers should confirm whether hot work, excavation, electrical, or confined-space permits apply.");
    edits.push("Add a permit matrix listing each task and the required permit, notice, or pre-task authorization.");
  }

  if (includesAny(draftText, ["hazard", "risk", "control", "mitigation"])) {
    strengths.push("The submission includes hazard or control language that can be used to support task-level review.");
  } else {
    gaps.push("Hazards and controls are too thin for a reliable pre-approval review.");
    edits.push("Add a task-by-task hazard and control table before approval.");
  }

  if (includesAny(draftText, ["emergency", "medical", "evacuation", "first aid"])) {
    strengths.push("Emergency-response content appears to be present.");
  } else {
    gaps.push("Emergency procedures are not clearly stated for crews working under this plan.");
    edits.push("Add emergency response, evacuation, and incident-reporting steps for the site.");
  }

  if (referenceText.trim()) {
    if (!hasBody) {
      gaps.push("Reference material was provided, but the draft text is too limited to confirm alignment.");
      edits.push("Compare the uploaded site or GC requirements against the final draft after expanding the body content.");
    } else {
      strengths.push("Reviewer-supplied site, GC, or company reference context is available for comparison during final approval.");
      edits.push("Verify that site-specific restrictions, owner exhibits, and GC-required controls are carried into the final approved version.");
    }
  }

  if (!hasBody) {
    gaps.unshift("The uploaded draft has little extractable text, so this review is based on limited content.");
    edits.unshift("Re-export the draft after confirming the document body is present and readable.");
  }

  while (strengths.length < 2) {
    strengths.push("The draft establishes enough structure to support a human approval review, even if several details still need tightening.");
  }
  while (gaps.length < 2) {
    gaps.push("Reviewer clarification is needed before treating the draft as approval-ready.");
  }
  while (edits.length < 2) {
    edits.push("Have the reviewer confirm trade scope, hazards, controls, and permit triggers before final approval.");
  }

  return {
    executiveSummary: hasBody
      ? `${params.programLabel} draft for ${params.projectName || "the project"} was reviewed using deterministic fallback logic because no server OpenAI key is configured. The document appears to include some structured safety content, but it still needs human confirmation before approval.`
      : `${params.programLabel} draft for ${params.projectName || "the project"} could not be deeply reviewed because the extracted text is too limited and no server OpenAI key is configured.`,
    scopeTradeAndHazardCoverage: hasBody
      ? "The draft includes enough readable content to flag likely strengths and gaps, but trade scope, task hazards, controls, PPE, permits, and site-specific restrictions still need reviewer confirmation."
      : "The draft text is too limited to confirm trade scope, hazards, controls, and permit coverage with confidence.",
    regulatoryAndProgramStrengths: strengths.slice(0, 6),
    gapsRisksOrClarifications: gaps.slice(0, 8),
    recommendedEditsBeforeApproval: edits.slice(0, 6),
    overallAssessment: hasBody ? "needs_work" : "insufficient_context",
  };
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
  /** Optional company knowledge snippets (from memory bank, including uploaded reference docs) */
  companyMemoryExcerpts?: string | null;
}): Promise<{ review: BuilderProgramAiReview; disclaimer: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      review: buildDeterministicBuilderProgramReview(params),
      disclaimer: DISCLAIMER,
    };
  }

  const label = params.programLabel.trim().toUpperCase();
  const hasBody = params.documentText.trim().length >= 80;
  const siteName = params.siteReferenceFileName?.trim() || null;
  const siteText = params.siteReferenceText?.trim() ?? "";
  const hasSiteRef = Boolean(siteName && siteText.length >= 20);

  const memoryExcerpts = params.companyMemoryExcerpts?.trim() ?? "";
  const hasMemory = memoryExcerpts.length >= 40;

  const contextBlock = [
    `Program type: ${label} (CSEP / PSHSEP / PESHEP-style builder safety-environmental plans in this product).`,
    `Project name: ${params.projectName || "(none)"}`,
    params.documentTitle?.trim() ? `Title: ${params.documentTitle.trim()}` : null,
    params.companyName?.trim() ? `Company: ${params.companyName.trim()}` : null,
    params.recordNotes?.trim() ? `Record notes: ${params.recordNotes.trim()}` : null,
    params.additionalReviewerContext?.trim()
      ? `Reviewer-provided context (site rules, owner requirements, gaps to check): ${params.additionalReviewerContext.trim()}`
      : null,
    hasMemory
      ? `--- Company knowledge (internal reference only; not a regulation) ---\n${memoryExcerpts.slice(0, 24_000)}${memoryExcerpts.length > 24_000 ? "\n…" : ""}`
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
    "3) When company knowledge excerpts are provided, treat them as the company's own rules and priorities—align the draft and flag conflicts. When a site/owner/GC reference document is provided, compare the draft to that reference: note matches, omissions, and conflicts, in addition to OSHA-oriented gaps.",
    "4) Identify gaps, ambiguities, or risks a reviewer should address before approving (missing sections, vague controls, inconsistent PPE, etc.).",
    "5) Recommend concrete edits or follow-up questions for the reviewer.",
    "Do NOT invent citations, inspections, or compliance determinations. If text is unreadable or too thin, set overallAssessment to insufficient_context.",
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
