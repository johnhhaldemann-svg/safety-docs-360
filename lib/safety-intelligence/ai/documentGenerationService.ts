import type {
  DocumentGenerationRequest,
  GeneratedDocumentRecord,
  GeneratedSafetyPlanDraft,
} from "@/types/safety-intelligence";
import { assertAiReviewContextReady } from "@/lib/safety-intelligence/validation/ai";
import { runStructuredAiJson } from "@/lib/safety-intelligence/ai/utils";
import { buildFallbackNarratives } from "@/lib/safety-intelligence/documents/assemble";

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
    "Return JSON with keys: title, sections (array of heading/body), htmlPreview, draftJson, provenance.",
  ].join(" ");
  const user = JSON.stringify(request);
  const result = await runStructuredAiJson<GeneratedDocumentRecord>({
    modelEnv: process.env.SAFETY_INTELLIGENCE_DOCUMENT_MODEL,
    fallbackModel: "gpt-4o-mini",
    system,
    user,
    fallback,
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
};

export async function generateSafetyPlanNarratives(params: {
  draft: GeneratedSafetyPlanDraft;
  reviewContext: DocumentGenerationRequest["reviewContext"];
}) {
  assertAiReviewContextReady(params.reviewContext);

  const fallback = buildFallbackNarratives({
    generationContext: {
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
        source: "api",
      },
      legacyFormSnapshot: {},
    } as any,
    reviewContext: params.reviewContext,
    conflictMatrix: {
      items: params.draft.conflictSummary.items,
      score: params.draft.riskSummary.score,
      band: params.draft.riskSummary.band,
      intraDocumentConflictCount: params.draft.conflictSummary.intraDocument,
      externalConflictCount: params.draft.conflictSummary.external,
    },
  });

  const system = [
    "You write only approved narrative fields for a construction safety document.",
    "Use ONLY the provided JSON draft and review context.",
    "Do not invent new permits, controls, hazards, restrictions, or conflicts.",
    "Return JSON with keys: tradeBreakdownSummary, riskPrioritySummary, requiredControlsSummary, safetyNarrative.",
  ].join(" ");
  const user = JSON.stringify({
    draft: {
      documentType: params.draft.documentType,
      projectOverview: params.draft.projectOverview,
      operations: params.draft.operations,
      ruleSummary: params.draft.ruleSummary,
      conflictSummary: params.draft.conflictSummary,
      riskSummary: params.draft.riskSummary,
    },
    reviewContext: params.reviewContext,
  });

  const result = await runStructuredAiJson<NarrativeOutput>({
    modelEnv: process.env.SAFETY_INTELLIGENCE_DOCUMENT_MODEL,
    fallbackModel: "gpt-4o-mini",
    system,
    user,
    fallback,
  });

  return {
    sections: {
      ...fallback,
      ...result.parsed,
    },
    model: result.model,
    promptHash: result.promptHash,
    validation: {
      fallbackUsed: !result.model || JSON.stringify(result.parsed) === JSON.stringify(fallback),
      allowedKeys: Object.keys(fallback),
    },
  };
}
