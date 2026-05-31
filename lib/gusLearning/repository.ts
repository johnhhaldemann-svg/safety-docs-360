import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding } from "@/lib/companyMemory/embed";
import { calculateKnowledgeQualityScore, rankApprovedKnowledge } from "@/lib/gusLearning/answer";
import type {
  GusAnswerAuditRow,
  ApprovedKnowledgeRow,
  ApprovedSourceRow,
  GusCitationSnippet,
  GusAnswerFeedbackType,
  GusKnowledgeChangeType,
  GusLearningAnswer,
  GusLearningReviewItemRow,
  GusLearningReviewItemType,
  GusLearningSourceType,
  GusLearningTrustLevel,
  GusQualitySignals,
  GusRequiredControlType,
  GusResearchStatus,
  KnowledgeChangeLogRow,
  ResearchQueueRow,
} from "@/lib/gusLearning/types";
import { normalizeDomain } from "@/lib/gusLearning/sourceValidation";
import { validateApprovedSourceUrl } from "@/lib/aiKnowledgeMap/sourceSafety";
import { serverLog } from "@/lib/serverLog";

export type GusLearningDb = Pick<SupabaseClient, "from" | "rpc">;

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function toError(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function listGusLearningOverview(db: GusLearningDb, companyId: string) {
  const [sources, pending, approved, rejected, expired, due, changeLog, feedback, answerAudits, reviewItems, weakKnowledge] = await Promise.all([
    db
      .from("approved_sources")
      .select("id, company_id, source_name, source_url, domain, source_type, jurisdiction, trust_level, is_active, created_by, created_at, updated_at")
      .or(`company_id.is.null,company_id.eq.${companyId}`)
      .order("updated_at", { ascending: false })
      .limit(200),
    db
      .from("research_queue")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("research_queue")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(100),
    db
      .from("research_queue")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "rejected")
      .order("reviewed_at", { ascending: false })
      .limit(100),
    db
      .from("approved_knowledge")
      .select("*")
      .eq("company_id", companyId)
      .eq("review_status", "needs_review")
      .order("review_due_date", { ascending: true })
      .limit(100),
    db
      .from("approved_knowledge")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .lte("review_due_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("review_due_date", { ascending: true })
      .limit(100),
    db
      .from("knowledge_change_log")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("gus_answer_feedback")
      .select("*")
      .eq("company_id", companyId)
      .eq("needs_admin_review", true)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("gus_answer_audit")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("gus_learning_review_items")
      .select("*")
      .eq("company_id", companyId)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("approved_knowledge")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .lt("quality_score", 55)
      .order("quality_score", { ascending: true })
      .limit(100),
  ]);

  const firstError =
    sources.error ||
    pending.error ||
    approved.error ||
    rejected.error ||
    expired.error ||
    due.error ||
    changeLog.error ||
    feedback.error ||
    answerAudits.error ||
    reviewItems.error ||
    weakKnowledge.error;
  if (firstError) {
    return { ok: false as const, error: firstError.message };
  }

  return {
    ok: true as const,
    overview: {
      sources: (sources.data ?? []) as ApprovedSourceRow[],
      pendingResearch: (pending.data ?? []) as ResearchQueueRow[],
      approvedFindings: (approved.data ?? []) as ResearchQueueRow[],
      rejectedFindings: (rejected.data ?? []) as ResearchQueueRow[],
      expiredKnowledge: (expired.data ?? []) as ApprovedKnowledgeRow[],
      knowledgeDueForReview: (due.data ?? []) as ApprovedKnowledgeRow[],
      changeLog: (changeLog.data ?? []) as KnowledgeChangeLogRow[],
      feedbackForReview: feedback.data ?? [],
      answerAudits: (answerAudits.data ?? []) as GusAnswerAuditRow[],
      reviewItems: (reviewItems.data ?? []) as GusLearningReviewItemRow[],
      weakCitationKnowledge: (weakKnowledge.data ?? []) as ApprovedKnowledgeRow[],
    },
  };
}

export async function createApprovedSource(
  db: GusLearningDb,
  input: {
    companyId: string | null;
    sourceName: string;
    sourceUrl: string;
    domain?: string | null;
    sourceType: GusLearningSourceType;
    jurisdiction: string;
    trustLevel: GusLearningTrustLevel;
    isActive?: boolean;
    createdBy: string;
  },
) {
  const sourceUrl = clean(input.sourceUrl, 1_000);
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return { ok: false as const, error: "source_url must be a valid URL." };
  }
  const safety = validateApprovedSourceUrl({ sourceUrl, domain: input.domain || url.hostname });
  if (!safety.ok) return { ok: false as const, error: safety.reason };
  const domain = normalizeDomain(input.domain || url.hostname);
  const row = {
    company_id: input.companyId,
    source_name: clean(input.sourceName, 240),
    source_url: sourceUrl,
    domain,
    source_type: input.sourceType,
    jurisdiction: clean(input.jurisdiction || "Federal", 120),
    trust_level: input.trustLevel,
    is_active: input.isActive !== false,
    created_by: input.createdBy,
  };
  if (!row.source_name) return { ok: false as const, error: "source_name is required." };

  const { data, error } = await db.from("approved_sources").insert(row).select("*").single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, source: data as ApprovedSourceRow };
}

export async function updateApprovedSource(
  db: GusLearningDb,
  input: {
    sourceId: string;
    companyId: string | null;
    trustLevel?: GusLearningTrustLevel;
    isActive?: boolean;
  },
) {
  const patch: Record<string, unknown> = {};
  if (input.trustLevel) patch.trust_level = input.trustLevel;
  if (typeof input.isActive === "boolean") patch.is_active = input.isActive;
  if (Object.keys(patch).length === 0) {
    return { ok: false as const, status: 400, error: "No source updates were provided." };
  }

  let query = db.from("approved_sources").update(patch).eq("id", input.sourceId);
  query = input.companyId ? query.eq("company_id", input.companyId) : query.is("company_id", null);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Approved source not found." };
  return { ok: true as const, source: data as ApprovedSourceRow };
}

export async function listActiveApprovedSourcesForUrl(db: GusLearningDb, companyId: string, requestedUrl: string) {
  let url: URL;
  try {
    url = new URL(requestedUrl);
  } catch {
    return { ok: false as const, error: "source_url must be a valid URL.", sources: [] as ApprovedSourceRow[] };
  }
  const host = normalizeDomain(url.hostname);
  const { data, error } = await db
    .from("approved_sources")
    .select("id, company_id, source_name, source_url, domain, source_type, jurisdiction, trust_level, is_active, created_by, created_at, updated_at")
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .eq("is_active", true)
    .neq("trust_level", "blocked");
  if (error) return { ok: false as const, error: error.message, sources: [] as ApprovedSourceRow[] };
  const sources = ((data ?? []) as ApprovedSourceRow[]).filter((source) => {
    const domain = normalizeDomain(source.domain);
    return host === domain || host.endsWith(`.${domain}`);
  });
  return { ok: true as const, sources };
}

export async function insertResearchFinding(
  db: GusLearningDb,
  input: {
    requestedBy: string;
    companyId: string;
    projectId?: string | null;
    approvedSourceId?: string | null;
    topic: string;
    question: string;
    sourceUrl: string;
    sourceTitle?: string | null;
    sourceDomain: string;
    sourceType: GusLearningSourceType;
    rawSummary: string;
    aiConfidence: number | null;
    jurisdiction: string;
    affectedModules?: string[];
  },
) {
  const { data, error } = await db
    .from("research_queue")
    .insert({
      requested_by: input.requestedBy,
      company_id: input.companyId,
      project_id: input.projectId ?? null,
      approved_source_id: input.approvedSourceId ?? null,
      topic: clean(input.topic, 240),
      question: clean(input.question, 1_000),
      source_url: clean(input.sourceUrl, 1_000),
      source_title: clean(input.sourceTitle, 240) || null,
      source_domain: normalizeDomain(input.sourceDomain),
      source_type: input.sourceType,
      raw_summary: clean(input.rawSummary, 8_000),
      ai_confidence: input.aiConfidence,
      jurisdiction: clean(input.jurisdiction || "Federal", 120),
      affected_modules: input.affectedModules ?? [],
      status: "pending_review",
    })
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, finding: data as ResearchQueueRow };
}

export async function logKnowledgeChange(
  db: GusLearningDb,
  input: {
    knowledgeId?: string | null;
    companyId?: string | null;
    changeType: GusKnowledgeChangeType;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    changedBy: string;
    changeReason?: string | null;
  },
) {
  const { error } = await db.from("knowledge_change_log").insert({
    knowledge_id: input.knowledgeId ?? null,
    company_id: input.companyId ?? null,
    change_type: input.changeType,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    changed_by: input.changedBy,
    change_reason: clean(input.changeReason, 1_000) || null,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

async function embedApprovedKnowledge(db: GusLearningDb, knowledgeId: string, text: string) {
  try {
    const embedding = await createEmbedding(text);
    const vectorLiteral = `[${embedding.join(",")}]`;
    const { error } = await db.from("approved_knowledge").update({ embedding: vectorLiteral }).eq("id", knowledgeId);
    if (error) {
      serverLog("warn", "gus_learning_embedding_update_failed", { knowledgeId, message: error.message.slice(0, 200) });
    }
  } catch (error) {
    serverLog("warn", "gus_learning_embedding_failed", {
      knowledgeId,
      message: error instanceof Error ? error.message.slice(0, 200) : "Embedding failed.",
    });
  }
}

export async function approveResearchFinding(
  db: GusLearningDb,
  input: {
    findingId: string;
    companyId: string;
    approvedBy: string;
    approvedSummary: string;
    knowledgeTitle?: string | null;
    regulationReference?: string | null;
    appliesTo?: string | null;
    affectedModules?: string[];
    requiredControlType: GusRequiredControlType;
    jurisdiction?: string | null;
    reviewDueDate: string;
    citationExcerpt?: string | null;
    citationLocator?: string | null;
    sourceContentHash?: string | null;
    verificationNotes?: string | null;
    supersedesKnowledgeId?: string | null;
    reviewerNotes?: string | null;
  },
) {
  const { data: finding, error: findError } = await db
    .from("research_queue")
    .select("*")
    .eq("id", input.findingId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  if (findError) return { ok: false as const, status: 500, error: findError.message };
  if (!finding) return { ok: false as const, status: 404, error: "Research finding not found." };

  const row = finding as ResearchQueueRow;
  const { data: knowledge, error: insertError } = await db
    .from("approved_knowledge")
    .insert({
      company_id: row.company_id,
      project_id: row.project_id,
      approved_source_id: row.approved_source_id,
      research_queue_id: row.id,
      topic: row.topic,
      knowledge_title: clean(input.knowledgeTitle, 240) || row.source_title || row.topic,
      approved_summary: clean(input.approvedSummary, 8_000),
      source_url: row.source_url,
      source_title: row.source_title,
      source_type: row.source_type,
      jurisdiction: clean(input.jurisdiction, 120) || row.jurisdiction,
      regulation_reference: clean(input.regulationReference, 240) || null,
      applies_to: clean(input.appliesTo, 500) || null,
      affected_modules: input.affectedModules?.length ? input.affectedModules : row.affected_modules,
      required_control_type: input.requiredControlType,
      citation_excerpt: clean(input.citationExcerpt, 1_500) || null,
      citation_locator: clean(input.citationLocator, 240) || null,
      source_content_hash: clean(input.sourceContentHash, 160) || hashText(`${row.source_url}\n${row.raw_summary}`),
      verification_notes: clean(input.verificationNotes, 1_000) || null,
      supersedes_knowledge_id: input.supersedesKnowledgeId ?? null,
      approved_by: input.approvedBy,
      review_due_date: input.reviewDueDate,
      review_status: "current",
      is_active: true,
    })
    .select("*")
    .single();

  if (insertError) return { ok: false as const, status: 500, error: insertError.message };
  const insertedKnowledgeRow = knowledge as ApprovedKnowledgeRow;
  const qualityScore = calculateKnowledgeQualityScore(insertedKnowledgeRow);
  const { data: qualityUpdated } = await db
    .from("approved_knowledge")
    .update({ quality_score: qualityScore })
    .eq("id", insertedKnowledgeRow.id)
    .select("*")
    .single();
  const knowledgeRow = (qualityUpdated ?? { ...insertedKnowledgeRow, quality_score: qualityScore }) as ApprovedKnowledgeRow;

  await Promise.all([
    db
      .from("research_queue")
      .update({
        status: "approved",
        reviewer_id: input.approvedBy,
        reviewer_notes: clean(input.reviewerNotes, 1_000) || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id),
    logKnowledgeChange(db, {
      knowledgeId: knowledgeRow.id,
      companyId: knowledgeRow.company_id,
      changeType: "approved",
      newValue: knowledgeRow as unknown as Record<string, unknown>,
      changedBy: input.approvedBy,
      changeReason: input.reviewerNotes || "Research finding approved into verified knowledge.",
    }),
    embedApprovedKnowledge(db, knowledgeRow.id, `${knowledgeRow.topic}\n${knowledgeRow.knowledge_title}\n${knowledgeRow.approved_summary}`),
    input.supersedesKnowledgeId
      ? db
          .from("approved_knowledge")
          .update({ superseded_by_knowledge_id: knowledgeRow.id, is_active: false, review_status: "archived" })
          .eq("id", input.supersedesKnowledgeId)
          .eq("company_id", input.companyId)
      : Promise.resolve({ error: null }),
  ]);

  return { ok: true as const, knowledge: knowledgeRow };
}

export async function updateResearchFindingStatus(
  db: GusLearningDb,
  input: {
    findingId: string;
    companyId: string;
    status: Exclude<GusResearchStatus, "approved">;
    reviewerId: string;
    reviewerNotes?: string | null;
    affectedModules?: string[];
    jurisdiction?: string | null;
  },
) {
  const patch: Record<string, unknown> = {
    status: input.status,
    reviewer_id: input.reviewerId,
    reviewer_notes: clean(input.reviewerNotes, 1_000) || null,
    reviewed_at: new Date().toISOString(),
  };
  if (input.affectedModules) patch.affected_modules = input.affectedModules;
  if (input.jurisdiction) patch.jurisdiction = clean(input.jurisdiction, 120);
  const { data, error } = await db
    .from("research_queue")
    .update(patch)
    .eq("id", input.findingId)
    .eq("company_id", input.companyId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Research finding not found." };
  return { ok: true as const, finding: data as ResearchQueueRow };
}

export async function archiveKnowledge(
  db: GusLearningDb,
  input: { knowledgeId: string; companyId: string; changedBy: string; reason?: string | null },
) {
  const { data: oldRow, error: oldError } = await db
    .from("approved_knowledge")
    .select("*")
    .eq("id", input.knowledgeId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  if (oldError) return { ok: false as const, status: 500, error: oldError.message };
  if (!oldRow) return { ok: false as const, status: 404, error: "Knowledge item not found." };
  const { data, error } = await db
    .from("approved_knowledge")
    .update({ is_active: false, review_status: "archived" })
    .eq("id", input.knowledgeId)
    .eq("company_id", input.companyId)
    .select("*")
    .single();
  if (error) return { ok: false as const, status: 500, error: error.message };
  await logKnowledgeChange(db, {
    knowledgeId: input.knowledgeId,
    companyId: input.companyId,
    changeType: "archived",
    oldValue: oldRow as Record<string, unknown>,
    newValue: data as Record<string, unknown>,
    changedBy: input.changedBy,
    changeReason: input.reason || "Knowledge item archived.",
  });
  return { ok: true as const, knowledge: data as ApprovedKnowledgeRow };
}

export async function markExpiredKnowledgeForReview(db: GusLearningDb, companyId: string, changedBy: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error: listError } = await db
    .from("approved_knowledge")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("review_status", "current")
    .lt("review_due_date", today);
  if (listError) return { ok: false as const, error: listError.message };
  const expiredRows = (rows ?? []) as ApprovedKnowledgeRow[];
  if (!expiredRows.length) return { ok: true as const, count: 0 };
  const { error } = await db
    .from("approved_knowledge")
    .update({ review_status: "needs_review" })
    .in("id", expiredRows.map((row) => row.id));
  if (error) return { ok: false as const, error: error.message };
  await Promise.all(
    expiredRows.map((row) =>
      logKnowledgeChange(db, {
        knowledgeId: row.id,
        companyId: row.company_id,
        changeType: "expired",
        oldValue: row as unknown as Record<string, unknown>,
        newValue: { ...row, review_status: "needs_review" },
        changedBy,
        changeReason: "Review due date passed.",
      }),
    ),
  );
  return { ok: true as const, count: expiredRows.length };
}

export async function searchApprovedKnowledgeKeyword(
  db: GusLearningDb,
  input: { companyId: string; projectId?: string | null; question: string; limit?: number },
) {
  const q = clean(input.question, 160);
  if (!q) return { ok: true as const, items: [] as ApprovedKnowledgeRow[] };
  const terms = (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((term) => term.length > 2).slice(0, 8);
  const seen = new Set<string>();
  const items: ApprovedKnowledgeRow[] = [];
  for (const term of terms.length ? terms : [q]) {
    const pattern = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    const { data, error } = await db
      .from("approved_knowledge")
      .select("*")
      .eq("is_active", true)
      .or(`company_id.is.null,company_id.eq.${input.companyId}`)
      .or(`topic.ilike.${pattern},knowledge_title.ilike.${pattern},approved_summary.ilike.${pattern},affected_modules.cs.{${term}}`)
      .limit(input.limit ?? 12);
    if (error) return { ok: false as const, error: error.message, items: [] as ApprovedKnowledgeRow[] };
    for (const row of (data ?? []) as ApprovedKnowledgeRow[]) {
      if (input.projectId && row.project_id && row.project_id !== input.projectId) continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(row);
    }
  }
  return { ok: true as const, items };
}

export async function retrieveApprovedKnowledge(
  db: GusLearningDb,
  input: { companyId: string; projectId?: string | null; question: string; topK?: number },
) {
  const topK = Math.min(Math.max(input.topK ?? 8, 1), 16);
  const seen = new Set<string>();
  const items: ApprovedKnowledgeRow[] = [];
  let semanticCount = 0;
  let keywordCount = 0;
  try {
    const embedding = await createEmbedding(input.question);
    const { data, error } = await db.rpc("match_approved_knowledge", {
      p_company_id: input.companyId,
      p_project_id: input.projectId ?? null,
      p_query_embedding: embedding,
      p_match_count: topK * 2,
    });
    if (!error && Array.isArray(data)) {
      for (const row of data as ApprovedKnowledgeRow[]) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        items.push(row);
        semanticCount += 1;
      }
    }
  } catch {
    // Continue with keyword search when embeddings are unavailable.
  }
  const keyword = await searchApprovedKnowledgeKeyword(db, {
    companyId: input.companyId,
    projectId: input.projectId,
    question: input.question,
    limit: topK * 2,
  });
  if (!keyword.ok) return { ok: false as const, error: keyword.error, items: [] as ApprovedKnowledgeRow[], method: "keyword" as const };
  for (const row of keyword.items) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    items.push(row);
    keywordCount += 1;
  }
  const ranked = rankApprovedKnowledge(items, input.projectId).slice(0, topK);
  const method = semanticCount && keywordCount ? "hybrid" : semanticCount ? "semantic" : keywordCount ? "keyword" : "none";
  return {
    ok: true as const,
    items: ranked,
    method: method as "hybrid" | "semantic" | "keyword" | "none",
    trace: {
      semanticCount,
      keywordCount,
      returnedCount: ranked.length,
      candidateCount: items.length,
    },
  };
}

export async function recordGusAnswerAudit(
  db: GusLearningDb,
  input: {
    userId: string | null;
    companyId: string | null;
    projectId?: string | null;
    question: string;
    answer: GusLearningAnswer;
    retrievalMethod: string;
    selectedKnowledgeIds: string[];
    rejectedCandidateIds?: string[];
    retrievalTrace?: Record<string, unknown>;
    citationSnippets: GusCitationSnippet[];
    qualitySignals: GusQualitySignals;
  },
) {
  const { data, error } = await db
    .from("gus_answer_audit")
    .insert({
      answer_id: input.answer.answerId,
      user_id: input.userId,
      company_id: input.companyId,
      project_id: input.projectId ?? null,
      question: clean(input.question, 4_000),
      question_hash: hashText(input.question),
      retrieval_method: input.retrievalMethod,
      selected_knowledge_ids: input.selectedKnowledgeIds,
      rejected_candidate_ids: input.rejectedCandidateIds ?? [],
      confidence: input.answer.confidence,
      unsupported: input.answer.unsupported,
      needs_review: input.answer.needsReview,
      answer_text_hash: hashText(input.answer.text),
      retrieval_trace: input.retrievalTrace ?? {},
      citation_snippets: input.citationSnippets,
      quality_signals: input.qualitySignals,
    })
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, audit: data as GusAnswerAuditRow };
}

function reviewItemTypeForFeedback(feedbackType: GusAnswerFeedbackType): GusLearningReviewItemType | null {
  if (feedbackType === "unsafe") return "unsafe_answer";
  if (feedbackType === "incorrect") return "incorrect_answer";
  if (feedbackType === "missing_source") return "missing_source";
  return null;
}

function recommendedActionForReviewItem(type: GusLearningReviewItemType) {
  if (type === "unsafe_answer") return "Review the cited knowledge and answer wording before Gus uses this pattern again.";
  if (type === "incorrect_answer") return "Compare the answer against approved knowledge and supersede or correct any bad record.";
  if (type === "missing_source") return "Add approved-source research or approved knowledge before treating this as official guidance.";
  if (type === "expired_source_used") return "Review and renew, edit, or archive the expired knowledge record.";
  if (type === "weak_citation") return "Add a citation excerpt and locator or request more source review.";
  return "Review whether the classification should be regulatory, company, site, manufacturer, best practice, or AI suggestion.";
}

export async function createGusLearningReviewItem(
  db: GusLearningDb,
  input: {
    companyId: string | null;
    projectId?: string | null;
    answerAuditId?: string | null;
    feedbackId?: string | null;
    itemType: GusLearningReviewItemType;
    title: string;
    userComment?: string | null;
    createdBy?: string | null;
    recommendedAdminAction?: string | null;
  },
) {
  const { data, error } = await db
    .from("gus_learning_review_items")
    .insert({
      company_id: input.companyId,
      project_id: input.projectId ?? null,
      answer_audit_id: input.answerAuditId ?? null,
      feedback_id: input.feedbackId ?? null,
      item_type: input.itemType,
      title: clean(input.title, 240),
      user_comment: clean(input.userComment, 1_000) || null,
      created_by: input.createdBy ?? null,
      recommended_admin_action: clean(input.recommendedAdminAction, 1_000) || recommendedActionForReviewItem(input.itemType),
    })
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, reviewItem: data as GusLearningReviewItemRow };
}

export async function updateGusLearningReviewItemStatus(
  db: GusLearningDb,
  input: {
    reviewItemId: string;
    companyId: string;
    status: "in_review" | "resolved" | "archived";
    reviewerId: string;
    reviewNotes?: string | null;
  },
) {
  const patch: Record<string, unknown> = {
    status: input.status,
    review_notes: clean(input.reviewNotes, 1_000) || null,
  };
  if (input.status === "resolved" || input.status === "archived") {
    patch.resolved_by = input.reviewerId;
    patch.resolved_at = new Date().toISOString();
  }
  const { data, error } = await db
    .from("gus_learning_review_items")
    .update(patch)
    .eq("id", input.reviewItemId)
    .eq("company_id", input.companyId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Gus learning review item not found." };
  return { ok: true as const, reviewItem: data as GusLearningReviewItemRow };
}

export async function recordGusAnswerFeedback(
  db: GusLearningDb,
  input: {
    answerId: string;
    answerAuditId?: string | null;
    userId: string;
    companyId: string | null;
    projectId?: string | null;
    feedbackType: GusAnswerFeedbackType;
    comment?: string | null;
  },
) {
  const needsAdminReview = input.feedbackType === "unsafe" || input.feedbackType === "incorrect" || input.feedbackType === "missing_source";
  const { data, error } = await db
    .from("gus_answer_feedback")
    .insert({
      answer_id: clean(input.answerId, 160),
      answer_audit_id: input.answerAuditId ?? null,
      user_id: input.userId,
      company_id: input.companyId,
      project_id: input.projectId ?? null,
      feedback_type: input.feedbackType,
      comment: clean(input.comment, 1_000) || null,
      needs_admin_review: needsAdminReview,
      review_status: "pending_review",
    })
    .select("*")
    .single();
  if (error) return { ok: false as const, error: toError(error, "Failed to save feedback.") };
  const feedback = data as { id: string };
  const itemType = reviewItemTypeForFeedback(input.feedbackType);
  let reviewItem: GusLearningReviewItemRow | null = null;
  if (itemType) {
    const review = await createGusLearningReviewItem(db, {
      companyId: input.companyId,
      projectId: input.projectId,
      answerAuditId: input.answerAuditId ?? null,
      feedbackId: feedback.id,
      itemType,
      title: `Gus answer flagged: ${input.feedbackType.replace("_", " ")}`,
      userComment: input.comment,
      createdBy: input.userId,
    });
    if (review.ok) reviewItem = review.reviewItem;
  }
  return { ok: true as const, feedback: data, reviewItem };
}
