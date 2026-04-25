import type {
  CsepAiAssemblyDecisions,
  DocumentGenerationRequest,
  GeneratedDocumentRecord,
  GeneratedSafetyPlanDraft,
  SafetyPlanGenerationContext,
} from "@/types/safety-intelligence";
import { CSEP_FORMAT_SECTION_KEYS, type CsepFormatSectionKey } from "@/types/csep-builder";
import { getCustomerFacingDocumentLayoutGuidance } from "@/lib/documentLayoutGuidance";
import { assertAiReviewContextReady } from "@/lib/safety-intelligence/validation/ai";
import { runStructuredAiJson } from "@/lib/safety-intelligence/ai/utils";
import { buildFallbackNarratives } from "@/lib/safety-intelligence/documents/assemble";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";

function fallbackDocument(request: DocumentGenerationRequest): GeneratedDocumentRecord {
  const exposures = request.reviewContext.rulesEvaluations.flatMap((row) => row.hazardFamilies);
  const controls = request.reviewContext.rulesEvaluations.flatMap((row) => row.requiredControls);
  const conflicts = request.reviewContext.conflictEvaluations.flatMap((row) => row.conflicts.map((conflict) => conflict.rationale));

  const sections = [
    {
      heading: "Scope of Work",
      body: request.reviewContext.buckets.map((bucket) => bucket.taskTitle).join("; "),
    },
    {
      heading: "Hazards and Exposures",
      body: exposures.length ? exposures.join(", ") : "No hazards identified.",
    },
    {
      heading: "Required Controls",
      body: controls.length ? [...new Set(controls)].join(", ") : "No required controls identified.",
    },
    {
      heading: "Conflict Alerts",
      body: conflicts.length ? conflicts.join(" ") : "No simultaneous-operation conflicts identified.",
    },
  ];

  const title = request.title?.trim() || `${request.documentType.toUpperCase()} Draft`;
  return {
    documentType: request.documentType,
    title,
    sections,
    htmlPreview: sections.map((section) => `<section><h2>${section.heading}</h2><p>${section.body}</p></section>`).join(""),
    draftJson: {
      title,
      sections,
    },
    provenance: {
      generator: "fallback",
      documentType: request.documentType,
    },
  };
}

export async function generateDocumentDraft(request: DocumentGenerationRequest): Promise<{
  record: GeneratedDocumentRecord;
  model: string | null;
  promptHash: string | null;
}> {
  assertAiReviewContextReady(request.reviewContext);
  const fallback = fallbackDocument(request);
  const system = [
    "You generate structured construction safety documents.",
    "Use ONLY the provided JSON review context.",
    getCustomerFacingDocumentLayoutGuidance(),
    "Keep narrative fields concise and non-repetitive.",
    "Do not reuse the same sentence or restate OSHA references, front-matter facts, or section headings already captured elsewhere in the draft.",
    "Prefer short summaries because tables, numbered procedural requirements, and program sections carry the detailed content.",
    "Return JSON with keys: title, sections (array of heading/body), htmlPreview, draftJson, provenance.",
  ].join(" ");
  const user = JSON.stringify(request);
  const result = await runStructuredAiJson<GeneratedDocumentRecord>({
    modelEnv: process.env.SAFETY_INTELLIGENCE_DOCUMENT_MODEL,
    fallbackModel: resolveCompanyAiDefaultModel("gpt-4o-mini"),
    system,
    user,
    fallback,
    surface: "safety-intelligence.document.draft",
  });

  return {
    record: {
      ...fallback,
      ...result.parsed,
      documentType: request.documentType,
    },
    model: result.model,
    promptHash: result.promptHash,
  };
}

type NarrativeOutput = {
  tradeBreakdownSummary: string;
  riskPrioritySummary: string;
  requiredControlsSummary: string;
  safetyNarrative: string;
  aiAssemblyDecisions?: CsepAiAssemblyDecisions;
};

function buildFallbackAiAssemblyDecisions(
  draft: GeneratedSafetyPlanDraft
): CsepAiAssemblyDecisions | null {
  if (draft.documentType !== "csep") {
    return null;
  }

  const sectionDecisions = Object.fromEntries(
    CSEP_FORMAT_SECTION_KEYS.map((sectionKey) => {
      const existingSection = draft.sectionMap.find((section) =>
        section.key === sectionKey ||
        section.layoutKey === sectionKey ||
        section.parentSectionKey === sectionKey
      );
      const decision =
        existingSection?.summary ??
        existingSection?.body ??
        `Keep this section concise, customer-facing, and limited to project-supported facts for ${sectionKey.replace(/_/g, " ")}.`;
      return [sectionKey, decision];
    })
  ) as Partial<Record<CsepFormatSectionKey, string>>;

  return {
    frontMatterGuidance:
      "Use the front matter to orient field teams quickly, keep placeholders explicit when project facts are missing, and avoid repeating numbered-section details above the main body.",
    coverageGuidance:
      "Keep required-content emphasis visible when hazards, permits, competent-person requirements, rescue expectations, owner rules, or recurring inspections could otherwise be lost in the layout.",
    sectionDecisions,
    decisionSource: "fallback",
  };
}

export async function generateSafetyPlanNarratives(params: {
  draft: GeneratedSafetyPlanDraft;
  reviewContext: DocumentGenerationRequest["reviewContext"];
}) {
  assertAiReviewContextReady(params.reviewContext);

  const fallbackGenerationContext: SafetyPlanGenerationContext = {
    project: {
      projectName: params.draft.projectOverview.projectName,
    },
    scope: {
      trades: params.draft.operations
        .map((operation) => operation.tradeLabel ?? operation.tradeCode ?? "")
        .filter(Boolean),
      subTrades: params.draft.operations
        .map((operation) => operation.subTradeLabel ?? operation.subTradeCode ?? "")
        .filter(Boolean),
      tasks: params.draft.operations.map((operation) => operation.taskTitle),
      equipment: params.draft.operations.flatMap((operation) => operation.equipmentUsed),
    },
    operations: [],
    siteContext: {
      workConditions: params.draft.operations.flatMap((operation) => operation.workConditions),
      siteRestrictions: params.draft.ruleSummary.siteRestrictions,
      simultaneousOperations: [],
    },
    documentProfile: {
      documentType: params.draft.documentType,
      projectDeliveryType: params.draft.projectDeliveryType,
      source: "api",
    },
    legacyFormSnapshot: {},
  };

  const fallback = buildFallbackNarratives({
    generationContext: fallbackGenerationContext,
    reviewContext: params.reviewContext,
    conflictMatrix: {
      items: params.draft.conflictSummary.items,
      score: params.draft.riskSummary.score,
      band: params.draft.riskSummary.band,
      intraDocumentConflictCount: params.draft.conflictSummary.intraDocument,
      externalConflictCount: params.draft.conflictSummary.external,
    },
  });
  const fallbackAiAssemblyDecisions = buildFallbackAiAssemblyDecisions(params.draft);

  const system = [
    "You write only approved narrative fields for a construction safety document.",
    "Use ONLY the provided JSON draft and review context.",
    getCustomerFacingDocumentLayoutGuidance(),
    "Do not invent new permits, controls, hazards, restrictions, or conflicts.",
    "Keep each field to a concise customer-facing summary, not a full section rewrite.",
    "Do not repeat the same sentence or idea across fields.",
    "Do not restate OSHA references, project metadata, front-matter facts, or section titles that already appear elsewhere in the document.",
    "Treat tables, numbered requirement lists, and generated program sections as the detailed source of truth and keep these narrative fields brief.",
    "For CSEP drafts, also return aiAssemblyDecisions with keys frontMatterGuidance, coverageGuidance, and sectionDecisions.",
    "For CSEP, editorial guidance should favor a field-manual tone: numbered procedural steps and narrative paragraphs rather than checklist-style bullets.",
    "sectionDecisions must be a map keyed by the numbered CSEP section keys and represents the final editorial guidance the formatter should use when building the document.",
    "These AI assembly decisions are the final deciding factor for section emphasis and placeholder visibility, but they must stay within the provided facts.",
    "Return JSON with keys: tradeBreakdownSummary, riskPrioritySummary, requiredControlsSummary, safetyNarrative, aiAssemblyDecisions.",
  ].join(" ");
  const user = JSON.stringify({
    draft: {
      documentType: params.draft.documentType,
      projectOverview: params.draft.projectOverview,
      operations: params.draft.operations,
      ruleSummary: params.draft.ruleSummary,
      conflictSummary: params.draft.conflictSummary,
      riskSummary: params.draft.riskSummary,
      sectionMap: params.draft.sectionMap,
      documentControl: params.draft.documentControl ?? null,
      builderSnapshot: params.draft.builderSnapshot ?? null,
    },
    csepFormatSectionKeys: CSEP_FORMAT_SECTION_KEYS,
    reviewContext: params.reviewContext,
  });

  const result = await runStructuredAiJson<NarrativeOutput>({
    modelEnv: process.env.SAFETY_INTELLIGENCE_DOCUMENT_MODEL,
    fallbackModel: resolveCompanyAiDefaultModel("gpt-4o-mini"),
    system,
    user,
    fallback,
    surface: "safety-intelligence.document.narratives",
  });
  const { aiAssemblyDecisions: parsedAiAssemblyDecisions, ...parsedSections } = result.parsed;

  return {
    sections: {
      ...fallback,
      ...parsedSections,
    },
    aiAssemblyDecisions: {
      ...fallbackAiAssemblyDecisions,
      ...(parsedAiAssemblyDecisions ?? {}),
      sectionDecisions: {
        ...(fallbackAiAssemblyDecisions?.sectionDecisions ?? {}),
        ...(parsedAiAssemblyDecisions?.sectionDecisions ?? {}),
      },
      decisionSource:
        parsedAiAssemblyDecisions?.decisionSource ??
        result.model ??
        fallbackAiAssemblyDecisions?.decisionSource ??
        null,
    },
    model: result.model,
    promptHash: result.promptHash,
    validation: {
      fallbackUsed: !result.model || JSON.stringify(result.parsed) === JSON.stringify(fallback),
      allowedKeys: Object.keys(fallback),
    },
  };
}
