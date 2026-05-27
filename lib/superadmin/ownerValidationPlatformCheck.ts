import {
  loadSafety360TestCompanySummary,
  SAFETY360_TEST_COMPANY_NAME,
} from "@/lib/superadmin/ownerValidationSandbox";
import {
  ensureDefaultOwnerValidationModules,
  recordOwnerValidationRun,
  type OwnerValidationSupabaseClient,
} from "@/lib/superadmin/ownerValidation";
import type { OwnerValidationRunInput, OwnerValidationStatus } from "@/lib/superadmin/ownerValidationTypes";

type PlatformCheckStatus = "pass" | "warning" | "fail";

export type OwnerPlatformCheckResult = {
  moduleKey: string;
  checkName: string;
  status: PlatformCheckStatus;
  result: string;
  whyItMatters: string;
  recommendedOwnerAction: string;
};

export type OwnerPlatformCheckResponse = {
  overallStatus: OwnerValidationStatus;
  overallScore: number;
  summary: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: OwnerPlatformCheckResult[];
  run: unknown;
};

const REQUIRED_SANDBOX_RECORDS = {
  employee: 6,
  jobsite: 3,
  jsa: 3,
  permit: 4,
  training_requirement: 3,
  training_record: 2,
  observation: 3,
  incident: 3,
  corrective_action: 3,
  document: 3,
} as const;

function toValidationStatus(status: PlatformCheckStatus): OwnerValidationStatus {
  if (status === "pass") return "green";
  if (status === "warning") return "yellow";
  return "red";
}

function countByKind(records: Array<{ record_kind?: string | null }>) {
  return records.reduce<Record<string, number>>((acc, record) => {
    const kind = record.record_kind ?? "unknown";
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
}

function sandboxCountCheck(params: {
  counts: Record<string, number>;
  kind: keyof typeof REQUIRED_SANDBOX_RECORDS;
  moduleKey: string;
  checkName: string;
  itemLabel: string;
}) {
  const actual = params.counts[params.kind] ?? 0;
  const expected = REQUIRED_SANDBOX_RECORDS[params.kind];
  const pass = actual >= expected;

  return {
    moduleKey: params.moduleKey,
    checkName: params.checkName,
    status: pass ? "pass" : "fail",
    result: pass
      ? `${params.itemLabel} are available in ${SAFETY360_TEST_COMPANY_NAME}. Found ${actual}.`
      : `${params.itemLabel} are missing or incomplete in ${SAFETY360_TEST_COMPANY_NAME}. Found ${actual}; expected at least ${expected}.`,
    whyItMatters: `This proves validation can use fake ${params.itemLabel.toLowerCase()} instead of real customer records.`,
    recommendedOwnerAction: pass
      ? `Open the related ${params.itemLabel.toLowerCase()} page and confirm the records clearly look like test data.`
      : `Create or refresh ${SAFETY360_TEST_COMPANY_NAME}, then run Platform Check again.`,
  } satisfies OwnerPlatformCheckResult;
}

function calculateOverall(checks: OwnerPlatformCheckResult[]) {
  const passedCount = checks.filter((check) => check.status === "pass").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const failedCount = checks.filter((check) => check.status === "fail").length;
  const total = checks.length || 1;
  const overallScore = Math.max(0, Math.round(((passedCount + warningCount * 0.5) / total) * 100));
  const overallStatus: OwnerValidationStatus =
    failedCount > 0 ? "red" : warningCount > 0 ? "yellow" : "green";

  return { passedCount, warningCount, failedCount, overallScore, overallStatus };
}

export async function runOwnerPlatformCheck(params: {
  client: OwnerValidationSupabaseClient;
  startedBy: string | null;
}): Promise<OwnerPlatformCheckResponse> {
  await ensureDefaultOwnerValidationModules(params.client);

  const sandbox = await loadSafety360TestCompanySummary(params.client);
  const records = Array.isArray(sandbox.records)
    ? (sandbox.records as Array<{ record_kind?: string | null }>)
    : [];
  const counts = countByKind(records);
  const checks: OwnerPlatformCheckResult[] = [
    {
      moduleKey: "login_auth",
      checkName: "Super Admin validation endpoint is protected and reachable",
      status: "pass",
      result: "The current Super Admin reached the protected platform-check endpoint.",
      whyItMatters: "This confirms the owner-only validation area can be reached by a Super Admin session.",
      recommendedOwnerAction: "Open the Owner Validation Console and confirm this result appears in plain English.",
    },
    {
      moduleKey: "roles_permissions",
      checkName: "Non-Super Admin access is blocked by the shared guard",
      status: "warning",
      result: "The backend uses the shared Super Admin guard, but this live run did not impersonate a normal user.",
      whyItMatters: "A role mistake could expose owner-only validation data to normal users.",
      recommendedOwnerAction: "In Step 9, use Preview As User to verify every role cannot open this console.",
    },
    {
      moduleKey: "company_setup",
      checkName: "Safety360 Test Company exists",
      status: sandbox.exists ? "pass" : "fail",
      result: sandbox.exists
        ? `${SAFETY360_TEST_COMPANY_NAME} exists and is marked as sandbox/demo data.`
        : `${SAFETY360_TEST_COMPANY_NAME} does not exist yet.`,
      whyItMatters: "All validation should run against fake sandbox data, never real customer records.",
      recommendedOwnerAction: sandbox.exists
        ? "Open the sandbox summary and confirm the company name is Safety360 Test Company."
        : "Click Create Test Company, then run Platform Check again.",
    },
    sandboxCountCheck({
      counts,
      kind: "employee",
      moduleKey: "roles_permissions",
      checkName: "Test employees exist",
      itemLabel: "Test employees",
    }),
    sandboxCountCheck({
      counts,
      kind: "jobsite",
      moduleKey: "jobsite_setup",
      checkName: "Test jobsites exist",
      itemLabel: "Test jobsites",
    }),
    sandboxCountCheck({
      counts,
      kind: "jsa",
      moduleKey: "jsa_builder",
      checkName: "Test JSAs exist",
      itemLabel: "Test JSAs",
    }),
    sandboxCountCheck({
      counts,
      kind: "permit",
      moduleKey: "permit_system",
      checkName: "Test permits exist",
      itemLabel: "Test permits",
    }),
    sandboxCountCheck({
      counts,
      kind: "training_requirement",
      moduleKey: "training_matrix",
      checkName: "Training requirement states exist",
      itemLabel: "Training requirements",
    }),
    sandboxCountCheck({
      counts,
      kind: "training_record",
      moduleKey: "training_matrix",
      checkName: "Training records can be checked",
      itemLabel: "Training records",
    }),
    sandboxCountCheck({
      counts,
      kind: "observation",
      moduleKey: "observations",
      checkName: "Test observations exist",
      itemLabel: "Test observations",
    }),
    sandboxCountCheck({
      counts,
      kind: "incident",
      moduleKey: "incidents",
      checkName: "Test incidents exist",
      itemLabel: "Test incidents",
    }),
    sandboxCountCheck({
      counts,
      kind: "corrective_action",
      moduleKey: "corrective_actions",
      checkName: "Test corrective actions exist",
      itemLabel: "Test corrective actions",
    }),
    sandboxCountCheck({
      counts,
      kind: "document",
      moduleKey: "documents",
      checkName: "Test documents exist",
      itemLabel: "Test documents",
    }),
    {
      moduleKey: "file_uploads",
      checkName: "File upload system is reachable",
      status: "warning",
      result: "File upload storage was not exercised in this safe first platform check.",
      whyItMatters: "Users may need to attach photos, evidence, and documents to safety records.",
      recommendedOwnerAction: "In a later document/upload validation step, upload a sandbox file only.",
    },
    {
      moduleKey: "pdf_word_exports",
      checkName: "PDF and Word export checks",
      status: counts.document >= REQUIRED_SANDBOX_RECORDS.document ? "warning" : "fail",
      result:
        counts.document >= REQUIRED_SANDBOX_RECORDS.document
          ? "Sample document records exist, but PDF and Word files were not generated in this run."
          : "Document export cannot be checked until sandbox documents exist.",
      whyItMatters: "Customers rely on downloaded JSAs, permits, and safety reports looking correct.",
      recommendedOwnerAction: "Step 13 should generate and inspect sandbox PDF/Word exports.",
    },
    {
      moduleKey: "notifications",
      checkName: "Notification system is reachable",
      status: "warning",
      result: "Notifications were not sent during this safe first check.",
      whyItMatters: "Validation should not accidentally email or text real people.",
      recommendedOwnerAction: "Use a sandbox-only notification test before marking notifications customer-ready.",
    },
    {
      moduleKey: "gus_ai",
      checkName: "Gus / AI Safety Coach endpoint is reachable",
      status: "warning",
      result: "Gus was not called in this run, so no AI safety response was generated.",
      whyItMatters: "Safety AI must not invent safety requirements or unsupported compliance claims.",
      recommendedOwnerAction: "Use Step 12 to run Gus against sandbox scenarios and review source grounding.",
    },
    {
      moduleKey: "ai_risk_engine",
      checkName: "AI Risk Engine has sandbox safety data",
      status:
        counts.incident >= REQUIRED_SANDBOX_RECORDS.incident &&
        counts.corrective_action >= REQUIRED_SANDBOX_RECORDS.corrective_action
          ? "pass"
          : "fail",
      result:
        counts.incident >= REQUIRED_SANDBOX_RECORDS.incident &&
        counts.corrective_action >= REQUIRED_SANDBOX_RECORDS.corrective_action
          ? "Sandbox incidents and corrective actions are available for risk-engine validation."
          : "Risk-engine sandbox data is incomplete.",
      whyItMatters: "Risk predictions should be tested on fake safety signals before using customer data.",
      recommendedOwnerAction: "Open dashboard/risk pages with sandbox data and confirm results are clearly test-only.",
    },
    {
      moduleKey: "mobile_views",
      checkName: "Mobile-critical pages need visual review",
      status: "warning",
      result: "Mobile layout was not browser-tested in this backend platform check.",
      whyItMatters: "Foremen and employees may use these workflows on phones in the field.",
      recommendedOwnerAction: "Open the Owner Validation Console and core sandbox pages on a phone-sized viewport.",
    },
  ];

  const totals = calculateOverall(checks);
  const summary =
    totals.failedCount > 0
      ? `Platform check found ${totals.failedCount} blocking issue(s), ${totals.warningCount} warning(s), and ${totals.passedCount} passed check(s).`
      : totals.warningCount > 0
        ? `Platform check passed the safe sandbox basics with ${totals.warningCount} owner-review warning(s).`
        : "Platform check passed all safe sandbox checks.";

  const input: OwnerValidationRunInput = {
    completedAt: new Date().toISOString(),
    overallStatus: totals.overallStatus,
    overallScore: totals.overallScore,
    summary,
    checks: checks.map((check) => ({
      moduleKey: check.moduleKey,
      checkName: check.checkName,
      status: toValidationStatus(check.status),
      result: check.result,
      technicalDetails: {
        whyItMatters: check.whyItMatters,
        source: "safe-owner-platform-check",
      },
      recommendedOwnerAction: check.recommendedOwnerAction,
    })),
  };

  const run = await recordOwnerValidationRun({
    client: params.client,
    startedBy: params.startedBy,
    input,
  });

  return {
    ...totals,
    summary,
    checks,
    run,
  };
}
