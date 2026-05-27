import { loadOwnerChangeLogEntries, type OwnerChangeLogEntry, type OwnerChangeLogSupabaseClient } from "@/lib/superadmin/ownerChangeLog";
import {
  loadOwnerValidationOverview,
  type OwnerValidationSupabaseClient,
} from "@/lib/superadmin/ownerValidation";
import type {
  OwnerCustomerReadyGate,
  OwnerManualReviewItem,
  OwnerValidationCheckResult,
  OwnerValidationModule,
  OwnerValidationOverview,
  OwnerValidationRun,
  OwnerValidationStatus,
} from "@/lib/superadmin/ownerValidationTypes";

type SupabaseResult<T> = {
  data: T | null;
  error: { message?: string | null } | null;
};

type OwnerProofReportExecutableQuery<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (columns?: string) => OwnerProofReportExecutableQuery<T>;
  eq: (column: string, value: unknown) => OwnerProofReportExecutableQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => OwnerProofReportExecutableQuery<T>;
};

type OwnerProofReportTableQuery = {
  select: (columns?: string) => OwnerProofReportExecutableQuery;
};

export type OwnerProofReportSupabaseClient = OwnerValidationSupabaseClient &
  OwnerChangeLogSupabaseClient;

export type OwnerProofReportSummary = {
  overallStatus: OwnerValidationStatus;
  overallStatusLabel: string;
  overallScore: number;
  testedAt: string | null;
  testedBy: string | null;
  safeToDemo: "Yes" | "No" | "Needs Review";
  safeForCustomerUse: "Yes" | "No" | "Needs Review";
  plainEnglishSummary: string;
};

export type OwnerProofReport = {
  summary: OwnerProofReportSummary;
  modulesPassed: OwnerValidationModule[];
  modulesNeedingReview: OwnerValidationModule[];
  modulesFailed: OwnerValidationModule[];
  modulesNotTested: OwnerValidationModule[];
  customerReadyModules: OwnerCustomerReadyGate[];
  blockedModules: OwnerCustomerReadyGate[];
  manualChecklist: {
    totalRequired: number;
    passedRequired: number;
    needsReview: number;
    failed: number;
    completionPercent: number;
  };
  recentChanges: OwnerChangeLogEntry[];
  latestRun: OwnerValidationRun | null;
  latestRunChecks: OwnerValidationCheckResult[];
  topRisks: string[];
  recommendedNextActions: string[];
};

function assertNoSupabaseError<T>(result: SupabaseResult<T>, action: string): T {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? "Supabase request failed."}`);
  }

  return result.data as T;
}

function statusLabel(status: OwnerValidationStatus) {
  if (status === "green") return "Working";
  if (status === "yellow") return "Needs review";
  if (status === "red") return "Broken";
  return "Not tested";
}

function countStatus(modules: OwnerValidationModule[], status: OwnerValidationStatus) {
  return modules.filter((module) => module.status === status).length;
}

function calculateFallbackScore(modules: OwnerValidationModule[]) {
  const total = modules.length || 1;
  const green = countStatus(modules, "green");
  const yellow = countStatus(modules, "yellow");
  return Math.round(((green + yellow * 0.5) / total) * 100);
}

function calculateFallbackStatus(modules: OwnerValidationModule[]): OwnerValidationStatus {
  if (modules.some((module) => module.status === "red")) return "red";
  if (modules.some((module) => module.status === "yellow")) return "yellow";
  if (modules.length > 0 && modules.every((module) => module.status === "green")) return "green";
  return "gray";
}

function summarizeManualChecklist(items: OwnerManualReviewItem[]) {
  const required = items.filter((item) => item.required);
  const totalRequired = required.length;
  const passedRequired = required.filter((item) => item.status === "passed").length;
  const needsReview = items.filter((item) => item.status === "needs_review").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const completionPercent = totalRequired > 0 ? Math.round((passedRequired / totalRequired) * 100) : 0;

  return {
    totalRequired,
    passedRequired,
    needsReview,
    failed,
    completionPercent,
  };
}

function uniqueList(values: Array<string | null | undefined>, limit = 8) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).slice(0, limit);
}

function buildTopRisks(params: {
  modulesFailed: OwnerValidationModule[];
  modulesNotTested: OwnerValidationModule[];
  blockedModules: OwnerCustomerReadyGate[];
  manualChecklist: ReturnType<typeof summarizeManualChecklist>;
  latestRunChecks: OwnerValidationCheckResult[];
  recentChanges: OwnerChangeLogEntry[];
}) {
  const risks: string[] = [];

  for (const validationModule of params.modulesFailed.slice(0, 4)) {
    risks.push(
      `${validationModule.display_name} is marked broken: ${validationModule.summary || "No explanation recorded."}`
    );
  }

  for (const gate of params.blockedModules.slice(0, 4)) {
    risks.push(`${gate.module_key} is blocked from customer-ready use: ${gate.blocking_reason || "No blocking reason recorded."}`);
  }

  for (const check of params.latestRunChecks.filter((item) => item.status === "red").slice(0, 4)) {
    risks.push(`${check.check_name} failed: ${check.result}`);
  }

  if (params.manualChecklist.failed > 0) {
    risks.push(`${params.manualChecklist.failed} manual owner checklist item(s) are marked failed.`);
  }

  if (params.manualChecklist.needsReview > 0) {
    risks.push(`${params.manualChecklist.needsReview} manual owner checklist item(s) need review.`);
  }

  if (params.modulesNotTested.length > 0) {
    risks.push(`${params.modulesNotTested.length} module(s) have not been tested yet.`);
  }

  for (const change of params.recentChanges.filter((item) => item.risk_level === "High" || item.owner_review_required).slice(0, 3)) {
    risks.push(`Recent change needs owner review: ${change.module_name} - ${change.plain_english_description}`);
  }

  return uniqueList(risks, 10);
}

function buildRecommendedActions(params: {
  topRisks: string[];
  blockedModules: OwnerCustomerReadyGate[];
  latestRunChecks: OwnerValidationCheckResult[];
  manualChecklist: ReturnType<typeof summarizeManualChecklist>;
}) {
  const checkActions = params.latestRunChecks
    .filter((check) => check.status !== "green")
    .map((check) => check.recommended_owner_action);
  const blockedActions = params.blockedModules.map((gate) => gate.blocking_reason);
  const checklistActions =
    params.manualChecklist.completionPercent < 100
      ? ["Complete the required owner visual checklist items using Safety360 Test Company."]
      : [];

  return uniqueList(
    [
      ...checkActions,
      ...blockedActions,
      ...checklistActions,
      params.topRisks.length > 0 ? "Fix or review the top risks before approving customer use." : null,
      "Run Platform Check, Document Export Check, and Gus validation before a customer demo.",
    ],
    10
  );
}

export function buildOwnerProofReportFromData(params: {
  overview: OwnerValidationOverview;
  latestRunChecks: OwnerValidationCheckResult[];
  recentChanges: OwnerChangeLogEntry[];
}): OwnerProofReport {
  const modules = params.overview.modules;
  const latestRun = params.overview.recentRuns[0] ?? null;
  const modulesPassed = modules.filter((module) => module.status === "green");
  const modulesNeedingReview = modules.filter((module) => module.status === "yellow");
  const modulesFailed = modules.filter((module) => module.status === "red");
  const modulesNotTested = modules.filter((module) => module.status === "gray");
  const customerReadyModules = params.overview.customerReadyGates.filter(
    (gate) =>
      gate.customer_ready_status === "Approved for customer use" ||
      gate.customer_ready_status === "Approved for demo"
  );
  const blockedModules = params.overview.customerReadyGates.filter(
    (gate) => gate.customer_ready_status === "Blocked" || gate.automated_validation_status === "red"
  );
  const manualChecklist = summarizeManualChecklist(params.overview.manualReviewItems);
  const overallStatus = latestRun?.overall_status ?? calculateFallbackStatus(modules);
  const overallScore = latestRun?.overall_score ?? calculateFallbackScore(modules);
  const topRisks = buildTopRisks({
    modulesFailed,
    modulesNotTested,
    blockedModules,
    manualChecklist,
    latestRunChecks: params.latestRunChecks,
    recentChanges: params.recentChanges,
  });
  const recommendedNextActions = buildRecommendedActions({
    topRisks,
    blockedModules,
    latestRunChecks: params.latestRunChecks,
    manualChecklist,
  });
  const hasBlockingRisk = modulesFailed.length > 0 || blockedModules.length > 0 || params.latestRunChecks.some((check) => check.status === "red");
  const ownerReviewComplete = manualChecklist.totalRequired > 0 && manualChecklist.completionPercent === 100 && manualChecklist.failed === 0;
  const hasCustomerUseApproval = customerReadyModules.some(
    (gate) => gate.customer_ready_status === "Approved for customer use"
  );

  const safeToDemo: OwnerProofReportSummary["safeToDemo"] = hasBlockingRisk
    ? "No"
    : overallScore >= 80
      ? "Needs Review"
      : "No";
  const safeForCustomerUse: OwnerProofReportSummary["safeForCustomerUse"] =
    hasBlockingRisk || !ownerReviewComplete || !hasCustomerUseApproval ? "Needs Review" : "Yes";

  return {
    summary: {
      overallStatus,
      overallStatusLabel: statusLabel(overallStatus),
      overallScore,
      testedAt: latestRun?.completed_at ?? latestRun?.started_at ?? null,
      testedBy: latestRun?.started_by ?? null,
      safeToDemo,
      safeForCustomerUse,
      plainEnglishSummary:
        topRisks.length > 0
          ? `The platform has ${topRisks.length} owner-visible risk(s) to review before customer use.`
          : "No blocking risk is visible in the current owner validation report, but manual owner review is still required.",
    },
    modulesPassed,
    modulesNeedingReview,
    modulesFailed,
    modulesNotTested,
    customerReadyModules,
    blockedModules,
    manualChecklist,
    recentChanges: params.recentChanges.slice(0, 8),
    latestRun,
    latestRunChecks: params.latestRunChecks,
    topRisks,
    recommendedNextActions,
  };
}

export async function loadOwnerProofReport(client: OwnerProofReportSupabaseClient) {
  const overview = await loadOwnerValidationOverview(client);
  const latestRun = overview.recentRuns[0] ?? null;
  const [checksResult, recentChanges] = await Promise.all([
    latestRun
      ? (client.from("owner_validation_check_results") as unknown as OwnerProofReportTableQuery)
          .select("*")
          .eq("run_id", latestRun.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null } satisfies SupabaseResult<OwnerValidationCheckResult[]>),
    loadOwnerChangeLogEntries(client),
  ]);

  return buildOwnerProofReportFromData({
    overview,
    latestRunChecks: assertNoSupabaseError(
      checksResult,
      "Unable to load latest owner proof report checks"
    ) as OwnerValidationCheckResult[],
    recentChanges,
  });
}
