import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiReviewContext,
  DocumentGenerationRequest,
  GeneratedDocumentRecord,
  JsonObject,
  RawTaskInput,
  SafetyPlanGenerationContext,
} from "@/types/safety-intelligence";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { generateDocumentDraft, generateSafetyPlanNarratives } from "@/lib/safety-intelligence/ai/documentGenerationService";
import { generateRiskIntelligence } from "@/lib/safety-intelligence/ai/riskIntelligenceService";
import { buildRawTaskInputsFromGenerationContext } from "@/lib/safety-intelligence/documentIntake";
import { buildGeneratedSafetyPlanDraft } from "@/lib/safety-intelligence/documents/assemble";
import { buildAiReviewContext } from "@/lib/safety-intelligence/service";
import {
  loadGeneratedDocumentDraft,
  persistAiReview,
  persistBucketRun,
  persistGeneratedDocument,
  persistSafetyPlanRun,
} from "@/lib/safety-intelligence/repository";
import { buildConflictMatrix, detectConflicts } from "@/lib/safety-intelligence/conflicts";
import { evaluateRules } from "@/lib/safety-intelligence/rules";
import { STATIC_PLATFORM_RULE_TEMPLATES } from "@/lib/safety-intelligence/rules/catalog";
import { loadDbRuleTemplates } from "@/lib/safety-intelligence/rules/repository";

type LiteClient = SupabaseClient<any, "public", any>;

function buildGeneratedDocumentRecordFromDraft(
  draft: ReturnType<typeof buildGeneratedSafetyPlanDraft>,
  aiMetadata: JsonObject
): GeneratedDocumentRecord {
  const sections = draft.sectionMap.map((section) => ({
    heading: section.title,
    body: [
      section.summary,
      section.body,
      ...(section.bullets ?? []),
      ...(section.subsections?.flatMap((subsection) => [
        subsection.title,
        ...subsection.bullets,
      ]) ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return {
    documentType: draft.documentType,
    title: draft.title,
    sections,
    htmlPreview: draft.sectionMap
      .map((section) => {
        const parts = [
          section.summary ? `<p>${section.summary}</p>` : "",
          section.body ? `<p>${section.body}</p>` : "",
          section.bullets?.length
            ? `<ul>${section.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : "",
          section.subsections?.length
            ? section.subsections
                .map(
                  (subsection) =>
                    `<h3>${subsection.title}</h3><ul>${subsection.bullets
                      .map((item) => `<li>${item}</li>`)
                      .join("")}</ul>`
                )
                .join("")
            : "",
        ].join("");
        return `<section><h2>${section.title}</h2>${parts}</section>`;
      })
      .join(""),
    draftJson: draft as JsonObject,
    provenance: {
      ...draft.provenance,
      aiMetadata,
    },
  };
}

export async function runSafetyIntelligenceDocumentPipeline(params: {
  supabase: LiteClient;
  actorUserId: string;
  input: RawTaskInput;
  documentType: DocumentGenerationRequest["documentType"];
  peerBuckets?: DocumentGenerationRequest["reviewContext"]["buckets"];
  riskMemorySummary?: JsonObject | null;
}) {
  const { bucket, rules, conflicts, context } = buildAiReviewContext({
    input: params.input,
    bucket: buildBucketedWorkItem(params.input),
    peerBuckets: params.peerBuckets,
    riskMemorySummary: params.riskMemorySummary,
  });

  const bucketRunId = await persistBucketRun(
    params.supabase,
    params.input,
    bucket,
    rules,
    conflicts,
    params.actorUserId
  );

  const reviewContext = {
    ...context,
    bucketRunId,
    documentType: params.documentType,
  };

  const risk = await generateRiskIntelligence({
    reviewContext,
  });
  const doc = await generateDocumentDraft({
    reviewContext,
    documentType: params.documentType,
  });

  const aiReviewId = await persistAiReview(
    params.supabase,
    reviewContext,
    "combined",
    {
      document: doc.record,
      risk: risk.record,
    },
    params.actorUserId,
    doc.model ?? risk.model,
    doc.promptHash ?? risk.promptHash
  );

  const generatedDocumentId = await persistGeneratedDocument(params.supabase, {
    companyId: params.input.companyId,
    jobsiteId: params.input.jobsiteId ?? null,
    bucketRunId,
    aiReviewId,
    record: doc.record,
    riskOutputs: risk.record,
    actorUserId: params.actorUserId,
  });

  return {
    bucketRunId,
    aiReviewId,
    generatedDocumentId,
    bucket,
    rules,
    conflicts,
    document: doc.record,
    risk: risk.record,
  };
}

export async function runSafetyPlanDocumentPipeline(params: {
  supabase: LiteClient;
  actorUserId: string;
  companyId: string;
  jobsiteId?: string | null;
  sourceDocumentId?: string | null;
  generationContext: SafetyPlanGenerationContext;
  intakePayload: Record<string, unknown>;
  riskMemorySummary?: JsonObject | null;
}) {
  const rawInputs = buildRawTaskInputsFromGenerationContext(
    params.generationContext,
    params.companyId
  );
  const buckets = rawInputs.map((input) => buildBucketedWorkItem(input));
  const dbTemplates = await loadDbRuleTemplates({
    supabase: params.supabase,
    companyId: params.companyId,
    jobsiteId: params.jobsiteId ?? null,
  });
  const templates = [...STATIC_PLATFORM_RULE_TEMPLATES, ...dbTemplates].filter(
    (template, index, list) =>
      index === list.findIndex((candidate) => candidate.code === template.code)
  );
  const rules = rawInputs.map((input, index) =>
    evaluateRules(input, buckets[index], templates)
  );

  const peersResult = await params.supabase
    .from("company_bucket_items")
    .select("bucket_payload, rule_results")
    .eq("company_id", params.companyId)
    .order("updated_at", { ascending: false })
    .limit(25);

  const externalPeers =
    peersResult.error || !Array.isArray(peersResult.data)
      ? []
      : (peersResult.data as Array<Record<string, unknown>>)
          .filter((row) => row.bucket_payload && row.rule_results)
          .map((row) => ({
            bucket: row.bucket_payload as any,
            rules: row.rule_results as any,
          }));

  const conflictMatrix = buildConflictMatrix({
    buckets,
    rulesEvaluations: rules,
    externalPeers,
  });
  const conflictEvaluations = buckets.map((bucket, index) =>
    detectConflicts(bucket, rules[index], buckets, rules)
  );

  const bucketRunId = await persistSafetyPlanRun({
    supabase: params.supabase,
    companyId: params.companyId,
    jobsiteId: params.jobsiteId ?? null,
    sourceDocumentId: params.sourceDocumentId ?? null,
    generationContext: {},
    intakePayload: params.intakePayload,
    rawInputs,
    buckets,
    rules,
    conflictMatrix,
    actorUserId: params.actorUserId,
  });

  const reviewContext: AiReviewContext = {
    companyId: params.companyId,
    jobsiteId: params.jobsiteId ?? null,
    bucketRunId,
    documentType: params.generationContext.documentProfile.documentType,
    buckets,
    rulesEvaluations: rules,
    conflictEvaluations,
    riskMemorySummary: params.riskMemorySummary ?? null,
    companyContext: {
      sourceDocumentId: params.sourceDocumentId ?? null,
    },
    templateContext: {
      documentProfile: params.generationContext.documentProfile,
    },
  };

  const preNarrativeDraft = buildGeneratedSafetyPlanDraft({
    generationContext: params.generationContext,
    reviewContext,
    conflictMatrix,
    riskMemorySummary: params.riskMemorySummary ?? null,
  });

  const narratives = await generateSafetyPlanNarratives({
    draft: preNarrativeDraft,
    reviewContext,
  });

  const finalDraft = buildGeneratedSafetyPlanDraft({
    generationContext: params.generationContext,
    reviewContext,
    conflictMatrix,
    narrativeSections: narratives.sections,
    riskMemorySummary: params.riskMemorySummary ?? null,
  });
  const risk = await generateRiskIntelligence({ reviewContext });
  const documentRecord = buildGeneratedDocumentRecordFromDraft(finalDraft, {
    model: narratives.model,
    promptHash: narratives.promptHash,
    validation: narratives.validation,
    sourceContextHash: Buffer.from(JSON.stringify(params.generationContext))
      .toString("base64")
      .slice(0, 32),
  });

  const aiReviewId = await persistAiReview(
    params.supabase,
    reviewContext,
    "combined",
    {
      document: documentRecord,
      risk: risk.record,
      narrativeSections: narratives.sections,
      validation: narratives.validation,
    },
    params.actorUserId,
    narratives.model ?? risk.model,
    narratives.promptHash ?? risk.promptHash
  );

  const generatedDocumentId = await persistGeneratedDocument(params.supabase, {
    companyId: params.companyId,
    jobsiteId: params.jobsiteId ?? null,
    bucketRunId,
    aiReviewId,
    record: documentRecord,
    riskOutputs: risk.record,
    actorUserId: params.actorUserId,
    sourceDocumentId: params.sourceDocumentId ?? null,
  });

  return {
    bucketRunId,
    aiReviewId,
    generatedDocumentId,
    generationContext: params.generationContext,
    rawInputs,
    bucket: buckets[0] ?? null,
    buckets,
    rules,
    conflicts: conflictMatrix,
    reviewContext,
    draft: finalDraft,
    document: documentRecord,
    risk: risk.record,
  };
}

export async function resolveGeneratedDraftById(params: {
  supabase: LiteClient;
  generatedDocumentId: string;
}) {
  return loadGeneratedDocumentDraft(params.supabase, params.generatedDocumentId);
}
