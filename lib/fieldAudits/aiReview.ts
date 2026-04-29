import type { SupabaseClient } from "@supabase/supabase-js";
import { runStructuredAiJsonTask, type AiExecutionMeta } from "@/lib/ai/responses";
import type {
  FieldAuditScoreSummary,
  NormalizedFieldAuditObservation,
} from "@/lib/fieldAudits/normalize";

type LiteClient = SupabaseClient<any, "public", any>;

export type FieldAuditAiReview = {
  overallStatus: "ready_for_admin_review" | "needs_admin_attention" | "insufficient_context";
  executiveSummary: string;
  correctedReportSummary: string;
  adminReviewNotes: string[];
  requiredCorrections: string[];
  correctedFindings: Array<{
    sourceKey: string;
    itemLabel: string;
    originalStatus: "pass" | "fail" | "na";
    severity: string;
    correctedFindingSummary: string;
    correctedAction: string;
    customerFacingNote: string;
  }>;
  hazardImprovementSignals: Array<{
    hazard: string;
    signal: string;
    recommendedLibraryUpdate: string;
  }>;
  emailSummary: {
    subjectLine: string;
    openingSummary: string;
    findingHighlights: string[];
  };
  disclaimer: string;
};

export type FieldAuditAiReviewResult = {
  review: FieldAuditAiReview;
  meta: AiExecutionMeta;
};

const FALLBACK_MODEL = "gpt-4o-mini";
const DISCLAIMER =
  "AI review is for admin triage only. A qualified company reviewer must approve the final audit, corrections, customer copy, and any safety actions.";

function cleanText(value: unknown, max = 1200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function fallbackFinding(observation: NormalizedFieldAuditObservation) {
  const finding = cleanText(
    observation.notes ||
      observation.correctiveActionRequired ||
      `${observation.itemLabel} was marked ${observation.status}.`
  );
  const action = cleanText(
    observation.correctiveActionRequired ||
      (observation.status === "fail"
        ? `Review and correct ${observation.itemLabel.toLowerCase()} before closing this audit item.`
        : "No corrective action required.")
  );

  return {
    sourceKey: observation.sourceKey,
    itemLabel: observation.itemLabel,
    originalStatus: observation.status,
    severity: observation.severity,
    correctedFindingSummary: finding,
    correctedAction: action,
    customerFacingNote:
      observation.status === "fail"
        ? `${observation.itemLabel}: ${finding} Corrective action: ${action}`
        : `${observation.itemLabel}: ${observation.status.toUpperCase()}.`,
  };
}

export function buildDeterministicFieldAuditAiReview(params: {
  scoreSummary: FieldAuditScoreSummary;
  observations: NormalizedFieldAuditObservation[];
  jobsiteName?: string | null;
  selectedTrade?: string | null;
}): FieldAuditAiReview {
  const failed = params.observations.filter((observation) => observation.status === "fail");
  const critical = failed.filter((observation) => observation.severity === "critical" || observation.severity === "high");
  const correctedFindings = failed.slice(0, 20).map(fallbackFinding);
  const jobsiteName = cleanText(params.jobsiteName) || "the jobsite";
  const trade = cleanText(params.selectedTrade).replaceAll("_", " ") || "field work";
  const compliance =
    typeof params.scoreSummary.compliancePercent === "number"
      ? `${params.scoreSummary.compliancePercent}%`
      : "not calculated";

  return {
    overallStatus: critical.length > 0 || failed.length > 0 ? "needs_admin_attention" : "ready_for_admin_review",
    executiveSummary:
      failed.length > 0
        ? `${jobsiteName} audit for ${trade} found ${failed.length} failed item${failed.length === 1 ? "" : "s"} with ${compliance} compliance. Admin review should verify corrective actions before approval.`
        : `${jobsiteName} audit for ${trade} had no failed checklist items and is ready for admin review.`,
    correctedReportSummary:
      failed.length > 0
        ? `The audit recorded ${params.scoreSummary.total} scored items, ${failed.length} finding${failed.length === 1 ? "" : "s"}, and ${params.scoreSummary.photoCount} photo reference${params.scoreSummary.photoCount === 1 ? "" : "s"}. Failed items should remain open until the listed corrective actions are verified.`
        : `The audit recorded ${params.scoreSummary.total} scored items with no failed findings. Admin should confirm the record and customer copy before release.`,
    adminReviewNotes: [
      failed.length > 0
        ? "Verify each failed item has a clear owner, due date, and corrective action before approving the report."
        : "Confirm the audit scope, trade, hours billed, and customer email before sending the report.",
      critical.length > 0
        ? "High or critical findings are present and should be reviewed before the customer report is sent."
        : "No high or critical failed findings were detected by the deterministic review.",
    ],
    requiredCorrections: failed
      .filter((observation) => !observation.correctiveActionRequired)
      .map((observation) => `Add a corrective action for ${observation.itemLabel}.`)
      .slice(0, 12),
    correctedFindings,
    hazardImprovementSignals: failed.slice(0, 10).map((observation) => ({
      hazard: cleanText(observation.categoryLabel || observation.categoryCode || observation.itemLabel),
      signal: cleanText(observation.notes || observation.itemLabel),
      recommendedLibraryUpdate: `Use this audit finding to improve hazard controls for ${cleanText(
        observation.categoryLabel || observation.tradeCode || "field work"
      )}.`,
    })),
    emailSummary: {
      subjectLine: `Approved audit report for ${jobsiteName}`,
      openingSummary:
        failed.length > 0
          ? `The approved audit found ${failed.length} item${failed.length === 1 ? "" : "s"} requiring follow-up.`
          : "The approved audit did not record failed checklist items.",
      findingHighlights:
        correctedFindings.length > 0
          ? correctedFindings.map((finding) => finding.customerFacingNote).slice(0, 8)
          : ["No failed checklist items were recorded."],
    },
    disclaimer: DISCLAIMER,
  };
}

function buildAuditReviewPrompt(params: {
  auditId: string;
  jobsiteName?: string | null;
  auditDate?: string | null;
  auditors?: string | null;
  selectedTrade?: string | null;
  hoursBilled?: number | null;
  scoreSummary: FieldAuditScoreSummary;
  observations: NormalizedFieldAuditObservation[];
}) {
  const failed = params.observations.filter((observation) => observation.status === "fail");
  const sampled = params.observations
    .filter((observation) => observation.status === "fail" || observation.severity === "high" || observation.severity === "critical")
    .slice(0, 45)
    .map((observation) => ({
      sourceKey: observation.sourceKey,
      itemLabel: observation.itemLabel,
      categoryLabel: observation.categoryLabel,
      status: observation.status,
      severity: observation.severity,
      notes: observation.notes,
      correctiveActionRequired: observation.correctiveActionRequired,
      photoCount: observation.photoCount,
      riskMemory: observation.riskMemory,
    }));

  return JSON.stringify(
    {
      auditId: params.auditId,
      jobsiteName: params.jobsiteName ?? null,
      auditDate: params.auditDate ?? null,
      auditors: params.auditors ?? null,
      selectedTrade: params.selectedTrade ?? null,
      hoursBilled: params.hoursBilled ?? null,
      scoreSummary: params.scoreSummary,
      failedFindingCount: failed.length,
      observationsForReview: sampled,
      instruction:
        "Review this field audit for admin approval. Correct wording, clarify findings, summarize the report, and identify hazard-library improvements. Do not invent completed work, photos, signatures, approvals, citations, or customer commitments.",
    },
    null,
    2
  );
}

export async function generateFieldAuditAiReview(params: {
  auditId: string;
  jobsiteName?: string | null;
  auditDate?: string | null;
  auditors?: string | null;
  selectedTrade?: string | null;
  hoursBilled?: number | null;
  scoreSummary: FieldAuditScoreSummary;
  observations: NormalizedFieldAuditObservation[];
}): Promise<FieldAuditAiReviewResult> {
  const fallback = buildDeterministicFieldAuditAiReview(params);
  const result = await runStructuredAiJsonTask<FieldAuditAiReview>({
    modelEnv: process.env.FIELD_AUDIT_AI_REVIEW_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: FALLBACK_MODEL,
    surface: "field-audits.ai-review",
    maxAttempts: 2,
    fallback,
    system: [
      "You are a construction safety audit reviewer helping a company admin review a submitted field audit.",
      "Return strict JSON only. Correct grammar and unclear wording in findings, but do not change pass/fail/NA statuses unless you call it out as an admin review note.",
      "Every failed item should have a clear corrected finding summary and corrective action. If the field user did not provide enough information, add it to requiredCorrections.",
      "Write customer-facing copy professionally and plainly. Keep it accurate to the submitted observations.",
    ].join("\n"),
    user: buildAuditReviewPrompt(params),
    body: {
      text: {
        format: {
          type: "json_schema",
          name: "field_audit_ai_review",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              overallStatus: {
                type: "string",
                enum: ["ready_for_admin_review", "needs_admin_attention", "insufficient_context"],
              },
              executiveSummary: { type: "string" },
              correctedReportSummary: { type: "string" },
              adminReviewNotes: { type: "array", items: { type: "string" }, maxItems: 8 },
              requiredCorrections: { type: "array", items: { type: "string" }, maxItems: 12 },
              correctedFindings: {
                type: "array",
                maxItems: 20,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    sourceKey: { type: "string" },
                    itemLabel: { type: "string" },
                    originalStatus: { type: "string", enum: ["pass", "fail", "na"] },
                    severity: { type: "string" },
                    correctedFindingSummary: { type: "string" },
                    correctedAction: { type: "string" },
                    customerFacingNote: { type: "string" },
                  },
                  required: [
                    "sourceKey",
                    "itemLabel",
                    "originalStatus",
                    "severity",
                    "correctedFindingSummary",
                    "correctedAction",
                    "customerFacingNote",
                  ],
                },
              },
              hazardImprovementSignals: {
                type: "array",
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    hazard: { type: "string" },
                    signal: { type: "string" },
                    recommendedLibraryUpdate: { type: "string" },
                  },
                  required: ["hazard", "signal", "recommendedLibraryUpdate"],
                },
              },
              emailSummary: {
                type: "object",
                additionalProperties: false,
                properties: {
                  subjectLine: { type: "string" },
                  openingSummary: { type: "string" },
                  findingHighlights: { type: "array", items: { type: "string" }, maxItems: 8 },
                },
                required: ["subjectLine", "openingSummary", "findingHighlights"],
              },
              disclaimer: { type: "string" },
            },
            required: [
              "overallStatus",
              "executiveSummary",
              "correctedReportSummary",
              "adminReviewNotes",
              "requiredCorrections",
              "correctedFindings",
              "hazardImprovementSignals",
              "emailSummary",
              "disclaimer",
            ],
          },
        },
      },
    },
  });

  return {
    review: {
      ...fallback,
      ...result.parsed,
      disclaimer: cleanText(result.parsed.disclaimer) || DISCLAIMER,
    },
    meta: result.meta,
  };
}

export async function persistFieldAuditAiReview(params: {
  supabase: LiteClient;
  companyId: string;
  jobsiteId?: string | null;
  auditId: string;
  actorUserId: string;
  scoreSummary: FieldAuditScoreSummary;
  observations: NormalizedFieldAuditObservation[];
  review: FieldAuditAiReview;
  meta: AiExecutionMeta;
}) {
  const runInsert = await params.supabase
    .from("company_bucket_runs")
    .insert({
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      source_module: "company_jobsite_audit",
      source_id: params.auditId,
      run_status: "ai_reviewed",
      intake_payload: {
        auditId: params.auditId,
        scoreSummary: params.scoreSummary,
      },
      bucket_summary: {
        source: "field_audit_ai_review",
        observationCount: params.observations.length,
        failedObservations: params.observations
          .filter((observation) => observation.status === "fail")
          .map((observation) => ({
            sourceKey: observation.sourceKey,
            categoryLabel: observation.categoryLabel,
            itemLabel: observation.itemLabel,
            severity: observation.severity,
            correctiveActionRequired: observation.correctiveActionRequired,
          })),
      },
      rules_summary: {
        scoreSummary: params.scoreSummary,
      },
      conflict_summary: {
        requiredCorrections: params.review.requiredCorrections,
        hazardImprovementSignals: params.review.hazardImprovementSignals,
      },
      completed_at: new Date().toISOString(),
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    })
    .select("id")
    .single();

  if (runInsert.error) {
    throw new Error(runInsert.error.message || "Failed to save audit AI review run.");
  }

  const bucketRunId = String(runInsert.data.id);
  const reviewInsert = await params.supabase
    .from("company_ai_reviews")
    .insert({
      company_id: params.companyId,
      jobsite_id: params.jobsiteId ?? null,
      bucket_run_id: bucketRunId,
      review_type: "risk_intelligence",
      status: "reviewed",
      input_snapshot: {
        auditId: params.auditId,
        observations: params.observations,
      },
      rules_snapshot: {
        scoreSummary: params.scoreSummary,
      },
      conflicts_snapshot: {
        requiredCorrections: params.review.requiredCorrections,
      },
      ai_summary: params.review,
      model: params.meta.model,
      prompt_hash: params.meta.promptHash,
      reviewed_at: new Date().toISOString(),
      created_by: params.actorUserId,
      updated_by: params.actorUserId,
    })
    .select("id")
    .single();

  if (reviewInsert.error) {
    throw new Error(reviewInsert.error.message || "Failed to save audit AI review.");
  }

  return String(reviewInsert.data.id);
}
