import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractReviewDocumentText } from "@/lib/documentReviewExtraction";
import { isApprovedDocumentStatus } from "@/lib/documentStatus";
import { htmlToSafetyText } from "@/lib/gusLearning/sanitize";
import type { ApprovedSourceRow } from "@/lib/gusLearning/types";
import { normalizeRiskLevel, sourceKey, vectorCoordinatesForNode } from "@/lib/aiKnowledgeMap/normalize";
import { normalizeDocumentsBucketObjectPath } from "@/lib/documentsBucketPath";
import type { AiKnowledgeEvidence, AiKnowledgeNode, AiKnowledgeRiskLevel } from "@/lib/aiKnowledgeMap/types";
import { learningCandidateReviewMetadata } from "@/lib/aiKnowledgeMap/reviewGate";
import {
  assertActiveKnowledgeCompany,
  assertAiKnowledgeCooldown,
  assertAiKnowledgeWritesEnabled,
  isAiKnowledgeSourceFetchDisabled,
  requireConcreteCompanyId,
} from "@/lib/aiKnowledgeMap/guardrails";
import { fetchApprovedSourceText, validateApprovedSourceUrl } from "@/lib/aiKnowledgeMap/sourceSafety";

type LearningDb = SupabaseClient;
type DbError = { message?: string | null };
type QueryResult<T> = { data: T | null; error: DbError | null; count?: number | null };

export const AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE = "learning_check";
export const AI_KNOWLEDGE_LEARNING_TIME_ZONE = "America/Chicago";
export const AI_KNOWLEDGE_LEARNING_LOCAL_HOURS = new Set([6, 18]);

const DEFAULT_MAX_COMPANIES = 5;
const DEFAULT_MAX_DOCUMENTS = 16;
const DEFAULT_MAX_INTERNET_SOURCES = 6;
const MAX_TEXT_CHARS = 60_000;
const MAX_SUMMARY_CHARS = 1_800;
const RISK_TERMS = [
  "critical",
  "high risk",
  "stop work",
  "fatality",
  "sif",
  "serious injury",
  "fire",
  "burn",
  "fall",
  "excavation",
  "trench",
  "confined space",
  "lockout",
  "loto",
  "electrical",
  "hot work",
  "hazard",
  "incident",
  "corrective action",
  "ppe",
  "permit",
  "training",
];

type SourceRow = Record<string, unknown>;

export type LearningCheckTrigger = "cron" | "manual";

export type LearningCheckRunInput = {
  companyId?: string | null;
  actorUserId?: string | null;
  force?: boolean;
  trigger: LearningCheckTrigger;
  now?: Date;
  maxCompanies?: number;
  maxDocuments?: number;
  maxInternetSources?: number;
};

export type LearningCheckCompanyResult = {
  companyId: string;
  batchId: string | null;
  documentsChecked: number;
  internetSourcesChecked: number;
  candidatesCreated: number;
  failedSources: number;
  warnings: string[];
};

export type LearningCheckResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  runSlot: "morning" | "evening" | "manual";
  generatedAt: string;
  companiesSeen: number;
  documentsChecked: number;
  internetSourcesChecked: number;
  candidatesCreated: number;
  failedSources: number;
  batches: LearningCheckCompanyResult[];
  warnings: string[];
};

export function getCentralHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AI_KNOWLEDGE_LEARNING_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return hour === 24 ? 0 : hour;
}

export function shouldRunLearningCheck(now = new Date(), force = false) {
  if (force) return true;
  return AI_KNOWLEDGE_LEARNING_LOCAL_HOURS.has(getCentralHour(now));
}

export function learningRunSlot(now = new Date(), trigger: LearningCheckTrigger = "cron") {
  if (trigger === "manual") return "manual" as const;
  return getCentralHour(now) === 6 ? "morning" as const : "evening" as const;
}

export function documentSafetySortScore(row: SourceRow, missingMemory = true) {
  const text = compactText([
    row.title,
    row.document_title,
    row.document_type,
    row.category,
    row.notes,
    row.description,
    row.status,
    row.file_name,
  ], 5_000).toLowerCase();
  const finalPath = firstText(row.final_file_path, row.final_storage_path, row.final_url);
  const approved = isApprovedOrFinalDocument(row);
  const riskHits = RISK_TERMS.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
  const updatedAt = Date.parse(firstText(row.updated_at, row.created_at) ?? "") || 0;
  const recency = Math.min(20, Math.floor(updatedAt / 86_400_000) % 20);
  return (approved ? 1000 : 0) + (finalPath ? 80 : 0) + riskHits * 24 + (missingMemory ? 60 : 0) + recency;
}

export function isAllowedApprovedSourceRow(row: Pick<ApprovedSourceRow, "source_url" | "domain" | "is_active" | "trust_level">) {
  if (!row.is_active || row.trust_level === "blocked") return false;
  return validateApprovedSourceUrl({ sourceUrl: row.source_url, domain: row.domain }).ok;
}

export async function runAiKnowledgeLearningCheck(db: LearningDb, input: LearningCheckRunInput): Promise<LearningCheckResult> {
  assertAiKnowledgeWritesEnabled("AI Knowledge Map learning check");
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const force = input.force === true;
  const runSlot = learningRunSlot(now, input.trigger);
  if (!shouldRunLearningCheck(now, force)) {
    return {
      ok: true,
      skipped: true,
      reason: "Outside the 6 AM / 6 PM Central learning window.",
      runSlot,
      generatedAt,
      companiesSeen: 0,
      documentsChecked: 0,
      internetSourcesChecked: 0,
      candidatesCreated: 0,
      failedSources: 0,
      batches: [],
      warnings: [],
    };
  }

  const companyIds = input.companyId
    ? [await assertActiveKnowledgeCompany(db, requireConcreteCompanyId(input.companyId))]
    : await listCompanyIds(db, clamp(input.maxCompanies, DEFAULT_MAX_COMPANIES, 25));
  const batches: LearningCheckCompanyResult[] = [];

  for (const companyId of companyIds) {
    batches.push(await runCompanyLearningCheck(db, {
      companyId,
      actorUserId: input.actorUserId ?? null,
      trigger: input.trigger,
      runSlot,
      maxDocuments: clamp(input.maxDocuments, DEFAULT_MAX_DOCUMENTS, 75),
      maxInternetSources: clamp(input.maxInternetSources, DEFAULT_MAX_INTERNET_SOURCES, 25),
    }));
  }

  return {
    ok: true,
    skipped: false,
    runSlot,
    generatedAt,
    companiesSeen: companyIds.length,
    documentsChecked: sum(batches, "documentsChecked"),
    internetSourcesChecked: sum(batches, "internetSourcesChecked"),
    candidatesCreated: sum(batches, "candidatesCreated"),
    failedSources: sum(batches, "failedSources"),
    batches,
    warnings: batches.flatMap((batch) => batch.warnings),
  };
}

async function runCompanyLearningCheck(
  db: LearningDb,
  input: {
    companyId: string;
    actorUserId: string | null;
    trigger: LearningCheckTrigger;
    runSlot: "morning" | "evening" | "manual";
    maxDocuments: number;
    maxInternetSources: number;
  },
): Promise<LearningCheckCompanyResult> {
  await assertAiKnowledgeCooldown(db, { companyId: input.companyId, eventType: "learning_check_completed", cooldownMinutes: 15, action: "AI learning check" });
  const warnings: string[] = [];
  const documents = await listApprovedFinalDocuments(db, input.companyId, input.maxDocuments, warnings);
  const sources = await listApprovedInternetSources(db, input.companyId, input.maxInternetSources, warnings);
  const documentCandidates: Array<Record<string, unknown>> = [];
  const internetCandidates: Array<Record<string, unknown>> = [];
  const failedCandidates: Array<Record<string, unknown>> = [];

  const batch = await createLearningBatch(db, {
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    sourceCounts: {
      documents: documents.length,
      internetSources: sources.length,
    },
    candidateCounts: {},
    warnings,
    metadata: {
      trigger: input.trigger,
      runSlot: input.runSlot,
      documentScope: "approved_final_only",
      internetScope: "approved_sources_allowlist_only",
      trustedMemoryWrite: false,
      requiresHumanReview: true,
      whatAiEngineLearnedReviewRequired: true,
    },
  });

  for (let index = 0; index < documents.length; index += 1) {
    const row = documents[index];
    const table = String(row.__source_table ?? "documents");
    const sourceId = firstText(row.id);
    if (!sourceId) continue;
    if (await alreadyQueuedOrTrusted(db, input.companyId, table, sourceId)) continue;
    const built = await buildDocumentCandidate(db, batch.id, table, row, index + 1);
    if (built.kind === "failed") failedCandidates.push(built.row);
    else documentCandidates.push(built.row);
  }

  for (const source of sources) {
    if (await alreadyQueuedOrTrusted(db, input.companyId, "approved_sources", source.id)) continue;
    const built = await buildInternetSourceCandidate(batch.id, input.companyId, source);
    if (built.kind === "failed") failedCandidates.push(built.row);
    else internetCandidates.push(built.row);
  }

  const allCandidates = [...documentCandidates, ...internetCandidates, ...failedCandidates];
  const inserted = await insertLearningCandidates(db, allCandidates);
  await updateLearningBatchCounts(db, batch.id, {
    documentCandidates: documentCandidates.length,
    internetCandidates: internetCandidates.length,
    failedSourceCandidates: failedCandidates.length,
    totalCandidates: inserted.length,
  });
  await logLearningEvent(db, {
    eventType: "learning_check_completed",
    companyId: input.companyId,
    description: `AI learning check created ${inserted.length} Human Review candidates.`,
    metadata: {
      batchId: batch.id,
      trigger: input.trigger,
      runSlot: input.runSlot,
      documentsChecked: documents.length,
      internetSourcesChecked: sources.length,
      candidateCounts: {
        documentCandidates: documentCandidates.length,
        internetCandidates: internetCandidates.length,
        failedSourceCandidates: failedCandidates.length,
      },
      trustedMemoryWrite: false,
      requiresHumanReview: true,
    },
  });

  return {
    companyId: input.companyId,
    batchId: batch.id,
    documentsChecked: documents.length,
    internetSourcesChecked: sources.length,
    candidatesCreated: inserted.length,
    failedSources: failedCandidates.length,
    warnings,
  };
}

async function listCompanyIds(db: LearningDb, maxCompanies: number) {
  const { data, error } = (await db
    .from("companies")
    .select("id,status,is_active")
    .order("created_at", { ascending: false })
    .limit(maxCompanies)) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Could not load companies for AI learning check.");
  return (data ?? [])
    .filter((row) => row.is_active !== false && ["", "active", "approved"].includes(String(row.status ?? "").toLowerCase()))
    .map((row) => firstText(row.id))
    .filter((id): id is string => Boolean(id));
}

async function listApprovedFinalDocuments(db: LearningDb, companyId: string, limit: number, warnings: string[]) {
  const tables = ["documents", "company_generated_documents"] as const;
  const rows: SourceRow[] = [];
  for (const table of tables) {
    try {
      const { data, error } = (await db.from(table).select("*").eq("company_id", companyId).limit(limit * 3)) as QueryResult<SourceRow[]>;
      if (error) {
        warnings.push(`${table}: ${error.message ?? "document query failed"}`);
      } else {
        rows.push(...(data ?? []).map((row) => ({ ...row, __source_table: table })));
      }
    } catch (error) {
      warnings.push(`${table}: ${error instanceof Error ? error.message : "document query failed"}`);
    }
  }
  return rows
    .filter(isApprovedOrFinalDocument)
    .sort((a, b) => documentSafetySortScore(b, true) - documentSafetySortScore(a, true))
    .slice(0, limit);
}

async function listApprovedInternetSources(db: LearningDb, companyId: string, limit: number, warnings: string[]) {
  try {
    const { data, error } = (await db
      .from("approved_sources")
      .select("id, company_id, source_name, source_url, domain, source_type, jurisdiction, trust_level, is_active, created_by, created_at, updated_at")
      .or(`company_id.is.null,company_id.eq.${companyId}`)
      .eq("is_active", true)
      .neq("trust_level", "blocked")
      .order("updated_at", { ascending: false })
      .limit(limit * 2)) as QueryResult<ApprovedSourceRow[]>;
    if (error) {
      warnings.push(`approved_sources: ${error.message ?? "source query failed"}`);
      return [];
    }
    return (data ?? []).filter(isAllowedApprovedSourceRow).slice(0, limit);
  } catch (error) {
    warnings.push(`approved_sources: ${error instanceof Error ? error.message : "source query failed"}`);
    return [];
  }
}

async function buildDocumentCandidate(db: LearningDb, batchId: string, table: string, row: SourceRow, sortRank: number) {
  const sourceId = firstText(row.id) ?? "";
  const title = titleForDocument(row);
  const filePath = firstText(row.final_file_path, row.final_storage_path, row.file_path, row.storage_path, row.path);
  const fallbackText = compactText([row.title, row.document_title, row.document_type, row.category, row.notes, row.description, row.content, row.body], MAX_TEXT_CHARS);
  let readStatus: "extracted" | "metadata_only" | "failed" = "metadata_only";
  let contentText = fallbackText;
  let extractionMethod: string | null = null;
  let extractionError: string | null = null;

  if (filePath) {
    const extracted = await extractDocumentStorageText(db, filePath, firstText(row.file_name, row.filename, row.name, filePath) ?? title);
    if (extracted.ok) {
      readStatus = "extracted";
      contentText = compactText([extracted.text, fallbackText], MAX_TEXT_CHARS);
      extractionMethod = extracted.method;
    } else {
      readStatus = fallbackText ? "metadata_only" : "failed";
      extractionError = extracted.error;
    }
  }

  if (!contentText.trim()) {
    return {
      kind: "failed" as const,
      row: failedCandidateRow(batchId, {
        companyId: firstText(row.company_id),
        sourceTable: table,
        sourceId,
        title,
        reason: extractionError ?? "Approved/final document has no readable text or metadata for AI learning.",
        metadata: learningCandidateReviewMetadata({
          sourceKind: "failed_source",
          learnedSummary: extractionError ?? "Approved/final document could not be read.",
          confidenceScore: 0,
          riskLevel: "unknown",
          sourceDocument: filePath ?? firstText(row.file_name),
          extra: { failedSourceKind: "document", readStatus, document_sort_rank: sortRank },
        }),
      }),
    };
  }

  const documentHash = sha256(contentText);
  const chunks = chunkText(contentText, 9_000);
  const summary = deterministicSafetySummary(contentText, title);
  const riskLevel = riskLevelFromText(contentText);
  const riskScore = riskScoreFor(riskLevel);
  const sourceEvidence = evidenceFor({
    companyId: firstText(row.company_id),
    jobsiteId: null,
    projectId: null,
    sourceTable: table,
    sourceId,
    sourceRecordId: sourceId,
    title,
    nodeType: "document",
    type: "document",
    category: firstText(row.category, row.document_type, "document") ?? "document",
    description: contentText.slice(0, 2_000),
    semanticSummary: summary,
    project: null,
    trade: null,
    riskLevel,
    riskScore,
    sourceUrl: filePath ?? firstText(row.source_url),
    sourceDocument: filePath ?? firstText(row.file_name),
    metadata: {},
    vectorStatus: "pending",
    vectorCoordinates: vectorCoordinatesForNode({ sourceTable: table, sourceId, type: "document", riskLevel }),
    confidenceScore: 0.74,
    validationStatus: "pending_review",
    createdByType: "system",
  }, summary);
  const node = knowledgeNode({
    companyId: firstText(row.company_id),
    sourceTable: table,
    sourceId,
    title,
    category: firstText(row.category, row.document_type, "document") ?? "document",
    description: contentText.slice(0, 2_000),
    semanticSummary: summary,
    riskLevel,
    riskScore,
    sourceUrl: filePath ?? firstText(row.source_url),
    sourceDocument: filePath ?? firstText(row.file_name),
    metadata: learningCandidateReviewMetadata({
      sourceKind: "document",
      learnedSummary: summary,
      sourceEvidence,
      confidenceScore: 0.74,
      riskLevel,
      sourceUrl: filePath ?? firstText(row.source_url),
      sourceDocument: filePath ?? firstText(row.file_name),
      extra: {
        originalStatus: firstText(row.status),
        document_sort_rank: sortRank,
        document_hash: documentHash,
        chunk_count: chunks.length,
        read_status: readStatus,
        extraction_method: extractionMethod,
        extraction_error: extractionError,
      },
    }),
  });
  return {
    kind: "node" as const,
    row: {
      batch_id: batchId,
      company_id: node.companyId,
      candidate_type: "node",
      source_table: node.sourceTable,
      source_id: node.sourceId,
      source_record_id: node.sourceRecordId,
      source_node_key: sourceKey(node.sourceTable, node.sourceId),
      title: node.title,
      semantic_summary: node.semanticSummary,
      reason: "Approved/final safety document was read, ranked, summarized, and queued for Super Admin review before entering trusted AI memory.",
      source_evidence: sourceEvidence,
      proposed_payload: node,
      confidence_score: node.confidenceScore,
      validation_status: "pending_review",
      metadata: node.metadata,
      created_by_type: "system",
    },
  };
}

async function buildInternetSourceCandidate(batchId: string, companyId: string, source: ApprovedSourceRow) {
  let bodyText = "";
  let sourceTitle = source.source_name;
  try {
    if (isAiKnowledgeSourceFetchDisabled()) throw new Error("Approved source fetching is disabled.");
    const response = await fetchApprovedSourceText(source, {
      headers: {
        accept: "text/html, text/plain;q=0.9, */*;q=0.5",
        "user-agent": "SafetyDocs360 AI Knowledge Learning Check/1.0",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const html = response.text.slice(0, 250_000);
    sourceTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 240) || source.source_name;
    bodyText = htmlToSafetyText(html).slice(0, MAX_TEXT_CHARS);
  } catch (error) {
    return {
      kind: "failed" as const,
      row: failedCandidateRow(batchId, {
        companyId,
        sourceTable: "approved_sources",
        sourceId: source.id,
        title: source.source_name,
        reason: `Allowlisted internet source could not be read: ${error instanceof Error ? error.message : "fetch failed"}`,
        metadata: {
          ...learningCandidateReviewMetadata({
            sourceKind: "failed_source",
            learnedSummary: `Allowlisted internet source could not be read: ${error instanceof Error ? error.message : "fetch failed"}`,
            confidenceScore: 0,
            riskLevel: "unknown",
            sourceUrl: source.source_url,
            sourceDocument: source.source_name,
            extra: { failedSourceKind: "internet_source", trustLevel: source.trust_level },
          }),
        },
      }),
    };
  }

  if (!bodyText.trim()) {
    return {
      kind: "failed" as const,
      row: failedCandidateRow(batchId, {
        companyId,
        sourceTable: "approved_sources",
        sourceId: source.id,
        title: source.source_name,
        reason: "Allowlisted internet source returned no readable safety text.",
        metadata: learningCandidateReviewMetadata({
          sourceKind: "failed_source",
          learnedSummary: "Allowlisted internet source returned no readable safety text.",
          confidenceScore: 0,
          riskLevel: "unknown",
          sourceUrl: source.source_url,
          sourceDocument: source.source_name,
          extra: { failedSourceKind: "internet_source" },
        }),
      }),
    };
  }

  const summary = deterministicSafetySummary(bodyText, sourceTitle);
  const riskLevel = riskLevelFromText(bodyText);
  const internetEvidence = [{
    sourceTable: "approved_sources",
    sourceRecordId: source.id,
    label: sourceTitle,
    detail: summary.slice(0, 700),
  }];
  const node = knowledgeNode({
    companyId,
    sourceTable: "approved_sources",
    sourceId: source.id,
    title: sourceTitle,
    category: "internet_source",
    description: bodyText.slice(0, 2_000),
    semanticSummary: summary,
    riskLevel,
    riskScore: riskScoreFor(riskLevel),
    sourceUrl: source.source_url,
    sourceDocument: source.source_name,
    metadata: learningCandidateReviewMetadata({
      sourceKind: "internet_source",
      learnedSummary: summary,
      sourceEvidence: internetEvidence,
      confidenceScore: 0.66,
      riskLevel,
      sourceUrl: source.source_url,
      sourceDocument: source.source_name,
      extra: {
        sourceDomain: source.domain,
        sourceType: source.source_type,
        jurisdiction: source.jurisdiction,
        trustLevel: source.trust_level,
        document_hash: sha256(bodyText),
        chunk_count: chunkText(bodyText, 9_000).length,
        read_status: "extracted",
        internetGuardrail: "approved_sources_allowlist_only",
      },
    }),
  });

  return {
    kind: "node" as const,
    row: {
      batch_id: batchId,
      company_id: companyId,
      candidate_type: "node",
      source_table: node.sourceTable,
      source_id: node.sourceId,
      source_record_id: node.sourceRecordId,
      source_node_key: sourceKey(node.sourceTable, node.sourceId),
      title: node.title,
      semantic_summary: node.semanticSummary,
      reason: "Super Admin-approved allowlisted internet source was checked and queued for Human Review before it can support AI memory.",
      source_evidence: internetEvidence,
      proposed_payload: node,
      confidence_score: node.confidenceScore,
      validation_status: "pending_review",
      metadata: node.metadata,
      created_by_type: "system",
    },
  };
}

async function extractDocumentStorageText(db: LearningDb, filePath: string, fileName: string) {
  try {
    const objectPath = normalizeDocumentsBucketObjectPath(filePath);
    const { data, error } = await db.storage.from("documents").download(objectPath);
    if (error || !data) {
      return { ok: false as const, error: error?.message ?? "Document file could not be downloaded." };
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const extracted = await extractReviewDocumentText(buffer, fileName);
    if (!extracted.ok) return { ok: false as const, error: extracted.error };
    return { ok: true as const, text: extracted.text, method: extracted.method };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Document extraction failed." };
  }
}

async function createLearningBatch(
  db: LearningDb,
  input: {
    companyId: string;
    actorUserId: string | null;
    sourceCounts: Record<string, number>;
    candidateCounts: Record<string, number>;
    warnings: string[];
    metadata: Record<string, unknown>;
  },
) {
  const { data, error } = (await db
    .from("ai_knowledge_ingest_batches")
    .insert({
      company_id: input.companyId,
      batch_type: AI_KNOWLEDGE_LEARNING_CHECK_BATCH_TYPE,
      status: "pending_review",
      source_counts: input.sourceCounts,
      candidate_counts: input.candidateCounts,
      warnings: input.warnings,
      metadata: input.metadata,
      created_by: input.actorUserId,
      created_by_type: input.actorUserId ? "user" : "system",
    })
    .select("id")
    .single()) as QueryResult<{ id: string }>;
  if (error || !data?.id) throw new Error(error?.message ?? "Could not create AI learning batch.");
  return { id: data.id };
}

async function updateLearningBatchCounts(db: LearningDb, batchId: string, candidateCounts: Record<string, number>) {
  await db
    .from("ai_knowledge_ingest_batches")
    .update({
      candidate_counts: candidateCounts,
      status: "pending_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);
}

async function insertLearningCandidates(db: LearningDb, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return [] as Array<Record<string, unknown>>;
  const { data, error } = (await db.from("ai_knowledge_ingest_candidates").insert(rows).select("id")) as QueryResult<Array<Record<string, unknown>>>;
  if (error) throw new Error(error.message ?? "Could not create AI learning candidates.");
  return data ?? [];
}

async function logLearningEvent(
  db: LearningDb,
  input: { eventType: string; companyId: string; description: string; metadata: Record<string, unknown> },
) {
  await db.from("ai_engine_events").insert({
    event_type: input.eventType,
    description: input.description,
    metadata: { ...input.metadata, companyId: input.companyId },
    created_by_type: "system",
  });
}

async function alreadyQueuedOrTrusted(db: LearningDb, companyId: string, sourceTable: string, sourceId: string) {
  const [trusted, candidate] = await Promise.all([
    db
      .from("ai_knowledge_nodes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .eq("validation_status", "approved") as unknown as Promise<QueryResult<unknown>>,
    db
      .from("ai_knowledge_ingest_candidates")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .in("validation_status", ["pending_review", "approved", "promoted"]) as unknown as Promise<QueryResult<unknown>>,
  ]);
  return (trusted.count ?? 0) > 0 || (candidate.count ?? 0) > 0;
}

function knowledgeNode(input: {
  companyId: string | null;
  sourceTable: string;
  sourceId: string;
  title: string;
  category: string;
  description: string;
  semanticSummary: string;
  riskLevel: AiKnowledgeRiskLevel;
  riskScore: number | null;
  sourceUrl: string | null;
  sourceDocument: string | null;
  metadata: Record<string, unknown>;
}): AiKnowledgeNode {
  const vectorCoordinates = vectorCoordinatesForNode({
    sourceTable: input.sourceTable,
    sourceId: input.sourceId,
    type: "document",
    riskLevel: input.riskLevel,
  });
  return {
    companyId: input.companyId,
    jobsiteId: null,
    projectId: null,
    sourceTable: input.sourceTable,
    sourceId: input.sourceId,
    sourceRecordId: input.sourceId,
    title: input.title.slice(0, 500) || "Learning candidate",
    nodeType: "document",
    type: "document",
    category: input.category.slice(0, 120) || "document",
    description: input.description,
    semanticSummary: input.semanticSummary || input.title,
    project: null,
    trade: null,
    riskLevel: input.riskLevel,
    riskScore: input.riskScore,
    sourceUrl: input.sourceUrl,
    sourceDocument: input.sourceDocument,
    metadata: input.metadata,
    vectorStatus: "pending",
    vectorCoordinates,
    confidenceScore: input.metadata.sourceKind === "internet_source" ? 0.66 : 0.74,
    validationStatus: "pending_review",
    createdByType: "system",
  };
}

function failedCandidateRow(
  batchId: string,
  input: {
    companyId: string | null;
    sourceTable: string;
    sourceId: string;
    title: string;
    reason: string;
    metadata: Record<string, unknown>;
  },
) {
  const metadata = input.metadata.requiresHumanReview === true
    ? input.metadata
    : learningCandidateReviewMetadata({
      sourceKind: "failed_source",
      learnedSummary: input.reason,
      confidenceScore: 0,
      riskLevel: "unknown",
      extra: input.metadata,
    });
  return {
    batch_id: batchId,
    company_id: input.companyId,
    candidate_type: "failed_source",
    source_table: input.sourceTable,
    source_id: input.sourceId,
    source_record_id: input.sourceId,
    title: input.title,
    semantic_summary: input.reason,
    reason: input.reason,
    source_evidence: [],
    proposed_payload: {},
    confidence_score: 0,
    validation_status: "failed",
    metadata,
    created_by_type: "system",
  };
}

function evidenceFor(node: AiKnowledgeNode, summary: string): AiKnowledgeEvidence[] {
  return [
    {
      sourceTable: node.sourceTable,
      sourceRecordId: node.sourceRecordId,
      label: node.title,
      detail: summary.slice(0, 700),
    },
  ];
}

function isApprovedOrFinalDocument(row: SourceRow) {
  const status = firstText(row.status, row.review_status, row.approval_status);
  const hasFinalFile = Boolean(firstText(row.final_file_path, row.final_storage_path, row.final_url));
  const normalized = (status ?? "").trim().toLowerCase();
  return isApprovedDocumentStatus(status, hasFinalFile) || normalized === "final" || normalized === "published" || normalized === "complete";
}

function titleForDocument(row: SourceRow) {
  return firstText(row.document_title, row.title, row.name, row.file_name, row.filename, row.document_type, "Approved document") ?? "Approved document";
}

function deterministicSafetySummary(text: string, title: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      score: RISK_TERMS.reduce((total, term) => total + (sentence.toLowerCase().includes(term) ? 1 : 0), 0) * 10 - index,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.sentence);
  return compactText([title, ...scored, cleaned.slice(0, 700)], MAX_SUMMARY_CHARS);
}

function riskLevelFromText(text: string) {
  return normalizeRiskLevel(text);
}

function riskScoreFor(level: AiKnowledgeRiskLevel) {
  if (level === "critical") return 92;
  if (level === "high") return 78;
  if (level === "moderate") return 55;
  if (level === "low") return 25;
  return null;
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [""];
}

function compactText(values: unknown[], max: number) {
  return values
    .map((value) => (typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""))
    .filter(Boolean)
    .join(" | ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function clamp(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function sum(rows: LearningCheckCompanyResult[], key: keyof Pick<LearningCheckCompanyResult, "documentsChecked" | "internetSourcesChecked" | "candidatesCreated" | "failedSources">) {
  return rows.reduce((total, row) => total + row[key], 0);
}
