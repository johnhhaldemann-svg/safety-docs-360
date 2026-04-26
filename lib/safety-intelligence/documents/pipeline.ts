import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiReviewContext,
  BucketedWorkItem,
  DocumentGenerationRequest,
  GeneratedDocumentRecord,
  JsonObject,
  RawTaskInput,
  RulesEvaluation,
  SafetyPlanGenerationContext,
} from "@/types/safety-intelligence";
import { buildBucketedWorkItem } from "@/lib/safety-intelligence/buckets";
import { generateDocumentDraft, generateSafetyPlanNarratives } from "@/lib/safety-intelligence/ai/documentGenerationService";
import { generateRiskIntelligence } from "@/lib/safety-intelligence/ai/riskIntelligenceService";
import { buildRawTaskInputsFromGenerationContext } from "@/lib/safety-intelligence/documentIntake";
import { buildGeneratedSafetyPlanDraft } from "@/lib/safety-intelligence/documents/assemble";
import { getCsepProgramConfig } from "@/lib/csepProgramSettings";
import { getJurisdictionStandardsConfig } from "@/lib/jurisdictionStandards/settings";
import { attachSmartSafetyEngineLayers, buildSmartSafetyAiReviewContext } from "@/lib/safety-intelligence/engine/orchestrator";
import { refreshRiskMemoryRollupForCompany } from "@/lib/riskMemory/refreshCompany";
import {
  deriveCsepTrainingProgram,
  syncGeneratedTrainingRequirements,
} from "@/lib/safety-intelligence/trainingProgram";
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

type LiteClient = SupabaseClient;

type CompanyBucketItemPeerRow = {
  bucket_payload: BucketedWorkItem | null;
  rule_results: RulesEvaluation | null;
};

function hasPeerConflictData(
  row: CompanyBucketItemPeerRow
): row is { bucket_payload: BucketedWorkItem; rule_results: RulesEvaluation } {
  return Boolean(row.bucket_payload && row.rule_results);
}

export function buildSafetyPlanTemplateContext(params: {
  documentProfile: SafetyPlanGenerationContext["documentProfile"];
  siteMetadata: JsonObject;
}) {
  const siteMetadata = params.siteMetadata ?? {};

  return {
    documentProfile: params.documentProfile,
    taskModulePackKey:
      typeof siteMetadata.taskModulePackKey === "string"
        ? siteMetadata.taskModulePackKey
        : null,
    taskModuleTitles: Array.isArray(siteMetadata.taskModuleTitles)
      ? siteMetadata.taskModuleTitles
      : [],
    taskModules: Array.isArray(siteMetadata.taskModules)
      ? siteMetadata.taskModules
      : [],
    hazardModulePackKey:
      typeof siteMetadata.hazardModulePackKey === "string"
        ? siteMetadata.hazardModulePackKey
        : null,
    hazardModuleTitles: Array.isArray(siteMetadata.hazardModuleTitles)
      ? siteMetadata.hazardModuleTitles
      : [],
    hazardModules: Array.isArray(siteMetadata.hazardModules)
      ? siteMetadata.hazardModules
      : [],
    steelTaskModulePackKey:
      typeof siteMetadata.steelTaskModulePackKey === "string"
        ? siteMetadata.steelTaskModulePackKey
        : null,
    steelTaskModuleTitles: Array.isArray(siteMetadata.steelTaskModuleTitles)
      ? siteMetadata.steelTaskModuleTitles
      : [],
    steelTaskModules: Array.isArray(siteMetadata.steelTaskModules)
      ? siteMetadata.steelTaskModules
      : [],
    steelHazardModulePackKey:
      typeof siteMetadata.steelHazardModulePackKey === "string"
        ? siteMetadata.steelHazardModulePackKey
        : null,
    steelHazardModuleTitles: Array.isArray(siteMetadata.steelHazardModuleTitles)
      ? siteMetadata.steelHazardModuleTitles
      : [],
    steelHazardModules: Array.isArray(siteMetadata.steelHazardModules)
      ? siteMetadata.steelHazardModules
      : [],
    steelProgramModulePackKey:
      typeof siteMetadata.steelProgramModulePackKey === "string"
        ? siteMetadata.steelProgramModulePackKey
        : null,
    steelProgramModuleTitles: Array.isArray(siteMetadata.steelProgramModuleTitles)
      ? siteMetadata.steelProgramModuleTitles
      : [],
    steelProgramModules: Array.isArray(siteMetadata.steelProgramModules)
      ? siteMetadata.steelProgramModules
      : [],
  };
}

export function buildGeneratedDocumentRecordFromDraft(
  draft: ReturnType<typeof buildGeneratedSafetyPlanDraft>,
  aiMetadata: JsonObject
): GeneratedDocumentRecord {
  function stripNumberPrefix(value: string) {
    return value.replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
  }

  function displayHeading(
    section: (typeof draft.sectionMap)[number],
    sectionIndex: number
  ) {
    if (section.numberLabel?.trim()) {
      const title = stripNumberPrefix(section.title);
      return section.title.startsWith(section.numberLabel)
        ? section.title
        : `${section.numberLabel} ${title}`.trim();
    }

    return `${sectionIndex + 1}. ${stripNumberPrefix(section.title)}`.trim();
  }

  function displayPrefix(
    section: (typeof draft.sectionMap)[number],
    sectionIndex: number
  ) {
    return section.numberLabel?.trim()
      ? section.numberLabel.trim().replace(/\.0$/, "")
      : String(sectionIndex + 1);
  }

  function renderNumberedItems(prefix: string, items: string[] | undefined) {
    return (items ?? [])
      .map((item, index) => `<p>${prefix}.${index + 1} ${item}</p>`)
      .join("");
  }

  function renderParagraphBlocks(text: string | null | undefined) {
    if (!text?.trim()) return "";

    return text
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p>${part}</p>`)
      .join("");
  }

  function renderTable(table: NonNullable<(typeof draft.sectionMap)[number]["table"]>) {
    const header = table.columns.map((column) => `<th>${column}</th>`).join("");
    const rows = table.rows
      .map(
        (row) =>
          `<tr>${table.columns
            .map((_, columnIndex) => `<td>${row[columnIndex] ?? "N/A"}</td>`)
            .join("")}</tr>`
      )
      .join("");

    return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderTableAsNumberedParagraphs(
    table: NonNullable<(typeof draft.sectionMap)[number]["table"]>,
    sectionNumber: string,
    priorNumberedItemCount: number
  ) {
    if (!table.rows.length) return "";
    return table.rows
      .map((row, rowIndex) => {
        const num = `${sectionNumber}.${priorNumberedItemCount + rowIndex + 1}`;
        const text = table.columns
          .map((column, columnIndex) => `${column}: ${row[columnIndex]?.trim() || "N/A"}`)
          .join(" ");
        return `<p>${num} ${text}</p>`;
      })
      .join("");
  }

  const sections = draft.sectionMap.map((section) => ({
    heading: section.title,
    body: [
      section.summary,
      section.body,
      ...(section.bullets ?? []),
      ...(section.subsections?.flatMap((subsection) => [
        subsection.title,
        subsection.body,
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
      .map((section, sectionIndex) => {
        const sectionHeading = displayHeading(section, sectionIndex);
        const sectionNumber = displayPrefix(section, sectionIndex);
        const subsectionBulletTotal =
          section.subsections?.reduce((acc, sub) => acc + (sub.bullets?.length ?? 0), 0) ?? 0;
        const numberedItemsBeforeTable =
          (section.bullets?.length ?? 0) + subsectionBulletTotal;
        const parts = [
          renderParagraphBlocks(section.summary),
          renderParagraphBlocks(section.body),
          renderNumberedItems(sectionNumber, section.bullets),
          section.subsections?.length
            ? section.subsections
                .map((subsection, subsectionIndex) => {
                  const subsectionPrefix = `${sectionNumber}.${subsectionIndex + 1}`;
                  const showHeading =
                    subsection.title.trim() &&
                    stripNumberPrefix(subsection.title).toLowerCase() !==
                      stripNumberPrefix(section.title).toLowerCase();
                  return `${showHeading ? `<h3>${subsectionPrefix} ${stripNumberPrefix(subsection.title)}</h3>` : ""}${
                    renderParagraphBlocks(subsection.body)
                  }${renderNumberedItems(showHeading ? subsectionPrefix : sectionNumber, subsection.bullets)}`;
                })
                .join("")
            : "",
          section.table?.rows.length
            ? draft.documentType === "csep"
              ? renderTableAsNumberedParagraphs(section.table, sectionNumber, numberedItemsBeforeTable)
              : renderTable(section.table)
            : "",
        ].join("");
        return `<section><h2>${sectionHeading}</h2>${parts}</section>`;
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
  const bucket = buildBucketedWorkItem(params.input);
  const { reviewContext: baseReview, rules, conflicts } = await buildSmartSafetyAiReviewContext({
    input: params.input,
    bucket,
    peerBuckets: params.peerBuckets,
    riskMemorySummary: params.riskMemorySummary ?? null,
    supabase: params.supabase,
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
    ...baseReview,
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
      smartSafetyProvenance: reviewContext.smartSafetyProvenance ?? null,
    },
    params.actorUserId,
    doc.model ?? risk.model,
    doc.promptHash ?? risk.promptHash
  );

  void refreshRiskMemoryRollupForCompany({
    supabase: params.supabase,
    companyId: params.input.companyId,
    jobsiteId: params.input.jobsiteId ?? null,
  }).catch(() => {});

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
      : (peersResult.data as CompanyBucketItemPeerRow[])
          .filter(hasPeerConflictData)
          .map((row) => ({
            bucket: row.bucket_payload,
            rules: row.rule_results,
          }));

  const conflictMatrix = buildConflictMatrix({
    buckets,
    rulesEvaluations: rules,
    externalPeers,
  });
  const conflictEvaluations = buckets.map((bucket, index) =>
    detectConflicts(bucket, rules[index], buckets, rules)
  );
  const trainingProgram = await deriveCsepTrainingProgram({
    supabase: params.supabase,
    companyId: params.companyId,
    generationContext: params.generationContext,
    rulesEvaluations: rules,
  });

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
  const siteMetadata = (params.generationContext.siteContext.metadata ?? {}) as JsonObject;

  let reviewContext: AiReviewContext = {
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
    templateContext: buildSafetyPlanTemplateContext({
      documentProfile: params.generationContext.documentProfile,
      siteMetadata,
    }),
  };

  const primaryInput = rawInputs[0];
  const primaryBucket = buckets[0];
  const primaryRules = rules[0];
  const primaryConflicts = conflictEvaluations[0];
  if (primaryInput && primaryBucket && primaryRules && primaryConflicts) {
    reviewContext = await attachSmartSafetyEngineLayers({
      context: reviewContext,
      primaryInput,
      primaryBucket,
      primaryRules,
      primaryConflicts,
      supabase: params.supabase,
    });
  }

  const [programConfig, jurisdictionStandardsConfig] = await Promise.all([
    getCsepProgramConfig().catch(() => null),
    getJurisdictionStandardsConfig(params.supabase).catch(() => null),
  ]);

  const appliedJurisdictionStandards =
    params.generationContext.documentProfile.jurisdictionCode
      ? (jurisdictionStandardsConfig?.standards
          .filter((standard) => {
            if (
              standard.surfaceScope !== "both" &&
              standard.surfaceScope !== params.generationContext.documentProfile.documentType
            ) {
              return false;
            }
            return (
              standard.jurisdictionCode === "federal" ||
              standard.jurisdictionCode === params.generationContext.documentProfile.jurisdictionCode
            );
          })
          .map((standard) => standard.id) ?? [])
      : [];
  const enrichedGenerationContext = {
    ...params.generationContext,
    documentProfile: {
      ...params.generationContext.documentProfile,
      jurisdictionStandardsApplied: appliedJurisdictionStandards,
    },
  };

  const preNarrativeDraft = buildGeneratedSafetyPlanDraft({
    generationContext: enrichedGenerationContext,
    reviewContext,
    conflictMatrix,
    programDefinitions: programConfig?.definitions,
    jurisdictionStandardsConfig: jurisdictionStandardsConfig ?? undefined,
    trainingProgram,
    riskMemorySummary: params.riskMemorySummary ?? null,
  });

  const narratives = await generateSafetyPlanNarratives({
    draft: preNarrativeDraft,
    reviewContext,
  });

  const finalDraft = buildGeneratedSafetyPlanDraft({
    generationContext: enrichedGenerationContext,
    reviewContext,
    conflictMatrix,
    programDefinitions: programConfig?.definitions,
    jurisdictionStandardsConfig: jurisdictionStandardsConfig ?? undefined,
    narrativeSections: narratives.sections,
    aiAssemblyDecisions: narratives.aiAssemblyDecisions,
    trainingProgram,
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
      aiAssemblyDecisions: narratives.aiAssemblyDecisions,
      validation: narratives.validation,
      smartSafetyProvenance: reviewContext.smartSafetyProvenance ?? null,
    },
    params.actorUserId,
    narratives.model ?? risk.model,
    narratives.promptHash ?? risk.promptHash
  );

  void refreshRiskMemoryRollupForCompany({
    supabase: params.supabase,
    companyId: params.companyId,
    jobsiteId: params.jobsiteId ?? null,
  }).catch(() => {});

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

  if (params.sourceDocumentId && params.generationContext.documentProfile.documentType === "csep") {
    await syncGeneratedTrainingRequirements({
      supabase: params.supabase,
      companyId: params.companyId,
      sourceDocumentId: params.sourceDocumentId,
      trainingProgram,
      actorUserId: params.actorUserId,
    });
  }

  return {
    bucketRunId,
    aiReviewId,
    generatedDocumentId,
    generationContext: enrichedGenerationContext,
    rawInputs,
    bucket: buckets[0] ?? null,
    buckets,
    rules,
    conflicts: conflictMatrix,
    trainingProgram,
    reviewContext,
    draft: finalDraft,
    document: documentRecord,
    risk: risk.record,
  };
}

export async function resolveGeneratedDraftById(params: {
  supabase: LiteClient;
  generatedDocumentId: string;
  companyId: string;
}) {
  return loadGeneratedDocumentDraft(
    params.supabase,
    params.generatedDocumentId,
    params.companyId
  );
}
