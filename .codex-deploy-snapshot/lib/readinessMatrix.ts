import {
  daysUntilExpiryCalendar,
  expiryUiStatus,
  type CertificationInventoryItem,
} from "@/lib/certificationExpirations";
import {
  keywordMatchesHaystack,
  normalizeForMatch,
  type TrainingMatrixCellState,
} from "@/lib/trainingMatrix";

export type ReadinessStatus = "ready" | "expiring_soon" | "gap" | "blocked" | "needs_review";
export type ReadinessPersonType = "employee" | "contractor";

export type ReadinessRequirement = {
  id: string;
  title: string;
  matchKeywords?: string[] | null;
};

export type ReadinessIssue = {
  type: "blocked" | "gap" | "expiring_soon" | "needs_review";
  label: string;
  detail: string;
  requirementId?: string | null;
  expiresOn?: string | null;
  daysUntilExpiry?: number | null;
};

export type ReadinessOperationalSignal = {
  type: "incident" | "corrective_action" | "permit" | "jsa_activity" | "sor";
  label: string;
  detail: string;
  jobsiteId: string | null;
  severity: "low" | "medium" | "high";
  count: number;
};

export type ReadinessRow = {
  id: string;
  personType: ReadinessPersonType;
  personId: string;
  assignmentId?: string | null;
  name: string;
  email: string;
  role: string;
  trade: string;
  position: string;
  jobsiteId: string | null;
  jobsiteName: string | null;
  contractorId?: string | null;
  contractorName?: string | null;
  deterministicStatus: ReadinessStatus;
  status: ReadinessStatus;
  readinessScore: number;
  blockers: ReadinessIssue[];
  gaps: ReadinessIssue[];
  expiring: ReadinessIssue[];
  reviewItems: ReadinessIssue[];
  operationalSignals?: ReadinessOperationalSignal[];
  source: {
    trainingRequirements: number;
    contractorTrainingRequirements: number;
    inductionRequirements: number;
    operationalSignals: number;
  };
  recommendedNextAction: string;
  ai?: {
    status?: ReadinessStatus;
    score?: number;
    explanation?: string;
    confidence?: number;
  } | null;
};

export type ReadinessSummary = {
  total: number;
  ready: number;
  expiringSoon: number;
  gap: number;
  blocked: number;
  needsReview: number;
  employees: number;
  contractors: number;
};

export type ReadinessAiRowFinding = {
  rowId: string;
  status?: ReadinessStatus;
  score?: number;
  explanation?: string;
  confidence?: number;
};

export type ReadinessAiReview = {
  overallScore: number | null;
  summary: string;
  prioritizedActions: string[];
  rowFindings: ReadinessAiRowFinding[];
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
};

export type ReadinessChartCellStatus = "met" | ReadinessStatus;
export type ReadinessPersonnelTypeFilter = "all" | ReadinessPersonType;

export type ReadinessChartModel = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{
    rowId: string;
    worker: string;
    trade: string;
    position: string;
    jobsiteName: string | null;
    personType: ReadinessPersonType;
    status: ReadinessStatus;
    cells: Array<{
      columnKey: string;
      status: ReadinessChartCellStatus;
      label: string;
      detail: string | null;
    }>;
  }>;
};

export function filterReadinessRowsForChart(
  rows: ReadinessRow[],
  filters: {
    personnelSearch?: string | null;
    personnelType?: ReadinessPersonnelTypeFilter | null;
  }
) {
  const search = normalizeForMatch(filters.personnelSearch ?? "");
  const personType = filters.personnelType ?? "all";

  return rows.filter((row) => {
    if (personType !== "all" && row.personType !== personType) return false;
    if (!search) return true;

    const searchable = [
      row.name,
      row.email,
      row.trade,
      row.position,
      row.role,
      row.contractorName,
      row.jobsiteName,
    ]
      .filter(Boolean)
      .map((value) => normalizeForMatch(String(value)))
      .join(" ");

    return searchable.includes(search);
  });
}

type EmployeeMatrixRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  cells: Record<string, TrainingMatrixCellState | string>;
  cellDetails?: Record<string, {
    state?: string;
    matchSource?: string;
    matchedLabel?: string | null;
    expiryStatus?: string | null;
    expiresOn?: string | null;
    daysUntilExpiry?: number | null;
    gapKeywords?: string[];
  }>;
  certificationInventory?: CertificationInventoryItem[];
  profileFields: {
    tradeSpecialty?: string | null;
    jobTitle?: string | null;
  };
};

export type ReadinessOperationalSignalInput = {
  jobsiteId: string | null;
  signals: ReadinessOperationalSignal[];
};

export type ContractorReadinessRequirement = {
  id: string;
  title: string;
};

export type ContractorReadinessRecord = {
  requirementId: string | null;
  title: string;
  status: "complete" | "missing" | "expired" | "expiring" | "na";
  expiresOn?: string | null;
};

export type ContractorReadinessInput = {
  assignmentId: string;
  employeeId: string;
  name: string;
  email: string;
  contractorId: string | null;
  contractorName: string | null;
  jobsiteId: string;
  jobsiteName: string;
  trade: string;
  position: string;
  readinessStatus?: string | null;
  requirements: ContractorReadinessRequirement[];
  records: ContractorReadinessRecord[];
  induction?: {
    status: "eligible" | "blocked";
    reasons: string[];
    missingProgramIds: string[];
  } | null;
  expiredContractorDocuments?: Array<{ title: string; docType?: string | null; expiresOn?: string | null }>;
};

function clean(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function statusFromIssues(params: {
  blockers: ReadinessIssue[];
  gaps: ReadinessIssue[];
  expiring: ReadinessIssue[];
  reviewItems: ReadinessIssue[];
}): ReadinessStatus {
  if (params.blockers.length > 0) return "blocked";
  if (params.gaps.length > 0) return "gap";
  if (params.expiring.length > 0) return "expiring_soon";
  if (params.reviewItems.length > 0) return "needs_review";
  return "ready";
}

export function readinessStatusLabel(status: ReadinessStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "expiring_soon":
      return "Expiring Soon";
    case "gap":
      return "Gap";
    case "blocked":
      return "Blocked";
    case "needs_review":
      return "Needs Review";
  }
}

function scoreForStatus(status: ReadinessStatus) {
  switch (status) {
    case "ready":
      return 100;
    case "expiring_soon":
      return 82;
    case "needs_review":
      return 72;
    case "gap":
      return 48;
    case "blocked":
      return 15;
  }
}

function scoreFloorForSignals(status: ReadinessStatus, signals: ReadinessOperationalSignal[]) {
  if (signals.length === 0) return scoreForStatus(status);
  if (signals.some((signal) => signal.severity === "high")) return Math.min(scoreForStatus(status), 70);
  return Math.min(scoreForStatus(status), 78);
}

function recommendedAction(row: Pick<ReadinessRow, "status" | "blockers" | "gaps" | "expiring" | "reviewItems">) {
  if (row.status === "blocked") return row.blockers[0]?.detail || "Resolve blocking readiness issue before work starts.";
  if (row.status === "gap") return row.gaps[0]?.detail || "Assign or upload missing required training.";
  if (row.status === "expiring_soon") return row.expiring[0]?.detail || "Schedule credential renewal before expiration.";
  if (row.status === "needs_review") return row.reviewItems[0]?.detail || "Review profile and requirement scope.";
  return "Ready for assigned scope.";
}

function expiredCredentialMatchesRequirement(certName: string, req: ReadinessRequirement) {
  const haystack = normalizeForMatch(certName);
  return (req.matchKeywords ?? []).some((kw) => keywordMatchesHaystack(normalizeForMatch(kw), haystack));
}

function issuePriority(issue: ReadinessIssue) {
  switch (issue.type) {
    case "blocked":
      return 5;
    case "gap":
      return 4;
    case "expiring_soon":
      return 3;
    case "needs_review":
      return 2;
  }
}

function chartIssueKey(issue: ReadinessIssue) {
  if (issue.requirementId) return `requirement:${issue.requirementId}`;
  const normalized = normalizeForMatch(issue.label || issue.detail);
  return `issue:${normalized || "readiness"}`;
}

function fallbackChartColumns(rows: ReadinessRow[]) {
  const columns: Array<{ key: string; label: string }> = [];
  if (rows.some((row) => row.source.trainingRequirements > 0)) {
    columns.push({ key: "scope:training", label: "Required Training" });
  }
  if (rows.some((row) => row.source.contractorTrainingRequirements > 0)) {
    columns.push({ key: "scope:contractor-training", label: "Contractor Training" });
  }
  if (rows.some((row) => row.source.inductionRequirements > 0)) {
    columns.push({ key: "scope:site-induction", label: "Site Induction" });
  }
  return columns.length ? columns : [{ key: "scope:readiness", label: "Assigned Scope" }];
}

export function buildReadinessChart(rows: ReadinessRow[], maxColumns = 6): ReadinessChartModel {
  const columnMap = new Map<string, { key: string; label: string; score: number }>();
  for (const row of rows) {
    for (const issue of [...row.blockers, ...row.gaps, ...row.expiring, ...row.reviewItems]) {
      const key = chartIssueKey(issue);
      const existing = columnMap.get(key);
      if (existing) {
        existing.score += issuePriority(issue);
      } else {
        columnMap.set(key, {
          key,
          label: issue.label || "Readiness Item",
          score: issuePriority(issue),
        });
      }
    }
  }

  const columns = (columnMap.size > 0
    ? [...columnMap.values()]
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, Math.max(1, maxColumns))
        .map(({ key, label }) => ({ key, label }))
    : fallbackChartColumns(rows).slice(0, Math.max(1, maxColumns)));

  return {
    columns,
    rows: rows.map((row) => {
      const issues = [...row.blockers, ...row.gaps, ...row.expiring, ...row.reviewItems];
      return {
        rowId: row.id,
        worker: row.name,
        trade: row.trade,
        position: row.position,
        jobsiteName: row.jobsiteName,
        personType: row.personType,
        status: row.status,
        cells: columns.map((column) => {
          const issue = issues
            .filter((candidate) => chartIssueKey(candidate) === column.key)
            .sort((a, b) => issuePriority(b) - issuePriority(a))[0];
          if (!issue) {
            return {
              columnKey: column.key,
              status: "met" as const,
              label: "Met",
              detail: null,
            };
          }
          return {
            columnKey: column.key,
            status: issue.type,
            label: readinessStatusLabel(issue.type),
            detail: issue.detail,
          };
        }),
      };
    }),
  };
}

export function buildEmployeeReadinessRow(params: {
  row: EmployeeMatrixRow;
  requirements: ReadinessRequirement[];
  jobsiteId?: string | null;
  jobsiteName?: string | null;
}): ReadinessRow {
  const { row, requirements } = params;
  const blockers: ReadinessIssue[] = [];
  const gaps: ReadinessIssue[] = [];
  const expiring: ReadinessIssue[] = [];
  const reviewItems: ReadinessIssue[] = [];
  const trade = clean(row.profileFields.tradeSpecialty, "Unspecified trade");
  const position = clean(row.profileFields.jobTitle, "Unspecified position");

  for (const cert of row.certificationInventory ?? []) {
    if (cert.expiryStatus !== "expired") continue;
    const matchedReq = requirements.find((req) => expiredCredentialMatchesRequirement(cert.name, req));
    blockers.push({
      type: "blocked",
      label: cert.name,
      detail: `${cert.name} is expired${cert.expiresOn ? ` (${cert.expiresOn})` : ""}.`,
      requirementId: matchedReq?.id ?? null,
      expiresOn: cert.expiresOn,
      daysUntilExpiry: cert.daysUntilExpiry,
    });
  }

  for (const req of requirements) {
    const state = row.cells[req.id] ?? "gap";
    if (state === "na") continue;
    const detail = row.cellDetails?.[req.id];
    if (state === "gap") {
      gaps.push({
        type: "gap",
        label: req.title,
        detail: `Missing in-scope requirement: ${req.title}.`,
        requirementId: req.id,
      });
    } else if (detail?.matchSource === "certifications" && detail.expiryStatus === "soon") {
      expiring.push({
        type: "expiring_soon",
        label: detail.matchedLabel ?? req.title,
        detail: `${detail.matchedLabel ?? req.title} expires soon${detail.expiresOn ? ` (${detail.expiresOn})` : ""}.`,
        requirementId: req.id,
        expiresOn: detail.expiresOn ?? null,
        daysUntilExpiry: detail.daysUntilExpiry ?? null,
      });
    } else if (detail?.matchSource === "certifications" && detail.expiryStatus === "none") {
      reviewItems.push({
        type: "needs_review",
        label: detail.matchedLabel ?? req.title,
        detail: `${detail.matchedLabel ?? req.title} has no expiration date on file.`,
        requirementId: req.id,
      });
    }
  }

  if (trade === "Unspecified trade" || position === "Unspecified position") {
    reviewItems.push({
      type: "needs_review",
      label: "Incomplete profile",
      detail: "Trade and position are required for accurate readiness scoring.",
    });
  }

  const status = statusFromIssues({ blockers, gaps, expiring, reviewItems });
  const base: ReadinessRow = {
    id: `employee:${row.userId}`,
    personType: "employee",
    personId: row.userId,
    name: clean(row.name, "Unknown employee"),
    email: row.email,
    role: row.role,
    trade,
    position,
    jobsiteId: params.jobsiteId ?? null,
    jobsiteName: params.jobsiteName ?? null,
    deterministicStatus: status,
    status,
    readinessScore: scoreForStatus(status),
    blockers,
    gaps,
    expiring,
    reviewItems,
    source: {
      trainingRequirements: requirements.length,
      contractorTrainingRequirements: 0,
      inductionRequirements: 0,
      operationalSignals: 0,
    },
    recommendedNextAction: "",
    ai: null,
  };
  return { ...base, recommendedNextAction: recommendedAction(base) };
}

export function buildContractorReadinessRow(input: ContractorReadinessInput): ReadinessRow {
  const blockers: ReadinessIssue[] = [];
  const gaps: ReadinessIssue[] = [];
  const expiring: ReadinessIssue[] = [];
  const reviewItems: ReadinessIssue[] = [];
  const recordsByReq = new Map(input.records.filter((r) => r.requirementId).map((r) => [r.requirementId as string, r]));

  for (const req of input.requirements) {
    const record = recordsByReq.get(req.id);
    if (!record || record.status === "missing") {
      gaps.push({
        type: "gap",
        label: req.title,
        detail: `Missing contractor training requirement: ${req.title}.`,
        requirementId: req.id,
      });
    } else if (record.status === "expired") {
      blockers.push({
        type: "blocked",
        label: req.title,
        detail: `${req.title} is expired${record.expiresOn ? ` (${record.expiresOn})` : ""}.`,
        requirementId: req.id,
        expiresOn: record.expiresOn ?? null,
      });
    } else if (record.status === "expiring") {
      expiring.push({
        type: "expiring_soon",
        label: req.title,
        detail: `${req.title} expires soon${record.expiresOn ? ` (${record.expiresOn})` : ""}.`,
        requirementId: req.id,
        expiresOn: record.expiresOn ?? null,
        daysUntilExpiry: daysUntilExpiryCalendar(record.expiresOn, new Date()),
      });
    }
  }

  if (input.induction?.status === "blocked") {
    for (const reason of input.induction.reasons) {
      blockers.push({
        type: "blocked",
        label: "Induction",
        detail: reason,
      });
    }
  }

  for (const doc of input.expiredContractorDocuments ?? []) {
    blockers.push({
      type: "blocked",
      label: doc.title,
      detail: `Contractor document expired: ${doc.title}${doc.expiresOn ? ` (${doc.expiresOn})` : ""}.`,
      expiresOn: doc.expiresOn ?? null,
    });
  }

  const trade = clean(input.trade, "Unspecified trade");
  const position = clean(input.position, "Unspecified position");
  if (trade === "Unspecified trade" || position === "Unspecified position") {
    reviewItems.push({
      type: "needs_review",
      label: "Incomplete contractor profile",
      detail: "Contractor trade and position are required for accurate readiness scoring.",
    });
  }

  if (input.readinessStatus && ["limited", "needs_training", "onboarding"].includes(input.readinessStatus)) {
    reviewItems.push({
      type: "needs_review",
      label: "Profile readiness",
      detail: `Contractor profile readiness is ${input.readinessStatus.replaceAll("_", " ")}.`,
    });
  }

  const status = statusFromIssues({ blockers, gaps, expiring, reviewItems });
  const base: ReadinessRow = {
    id: `contractor:${input.assignmentId}`,
    personType: "contractor",
    personId: input.employeeId,
    assignmentId: input.assignmentId,
    name: clean(input.name, "Unknown contractor"),
    email: input.email,
    role: "contractor",
    trade,
    position,
    jobsiteId: input.jobsiteId,
    jobsiteName: input.jobsiteName,
    contractorId: input.contractorId,
    contractorName: input.contractorName,
    deterministicStatus: status,
    status,
    readinessScore: scoreForStatus(status),
    blockers,
    gaps,
    expiring,
    reviewItems,
    source: {
      trainingRequirements: 0,
      contractorTrainingRequirements: input.requirements.length,
      inductionRequirements: input.induction?.missingProgramIds.length ?? 0,
      operationalSignals: 0,
    },
    recommendedNextAction: "",
    ai: null,
  };
  return { ...base, recommendedNextAction: recommendedAction(base) };
}

export function applyOperationalSignalsToReadinessRows(
  rows: ReadinessRow[],
  signalInputs: ReadinessOperationalSignalInput[]
): ReadinessRow[] {
  const signalsByJobsite = new Map(
    signalInputs.map((input) => [input.jobsiteId ?? "company", input.signals])
  );

  return rows.map((row) => {
    const signals = signalsByJobsite.get(row.jobsiteId ?? "company") ?? [];
    if (signals.length === 0) return { ...row, operationalSignals: [] };

    const signalIssues: ReadinessIssue[] = signals.map((signal) => ({
      type: "needs_review",
      label: signal.label,
      detail: signal.detail,
    }));
    const reviewItems = [...row.reviewItems, ...signalIssues];
    const status = row.status === "ready" ? "needs_review" : row.status;
    const next: ReadinessRow = {
      ...row,
      status,
      readinessScore:
        row.status === "ready" || row.status === "needs_review"
          ? scoreFloorForSignals(status, signals)
          : row.readinessScore,
      reviewItems,
      operationalSignals: signals,
      source: {
        ...row.source,
        operationalSignals: signals.length,
      },
    };
    return { ...next, recommendedNextAction: recommendedAction(next) };
  });
}

export function summarizeReadinessRows(rows: ReadinessRow[]): ReadinessSummary {
  const summary: ReadinessSummary = {
    total: rows.length,
    ready: 0,
    expiringSoon: 0,
    gap: 0,
    blocked: 0,
    needsReview: 0,
    employees: 0,
    contractors: 0,
  };
  for (const row of rows) {
    if (row.personType === "employee") summary.employees++;
    else summary.contractors++;
    if (row.status === "ready") summary.ready++;
    else if (row.status === "expiring_soon") summary.expiringSoon++;
    else if (row.status === "gap") summary.gap++;
    else if (row.status === "blocked") summary.blocked++;
    else summary.needsReview++;
  }
  return summary;
}

function canAiSetStatus(deterministic: ReadinessStatus, proposed: ReadinessStatus | undefined): proposed is ReadinessStatus {
  if (!proposed) return false;
  if (deterministic === "blocked" || deterministic === "gap") {
    return proposed === deterministic || proposed === "needs_review";
  }
  return true;
}

export function applyAiReviewToReadinessRows(rows: ReadinessRow[], review: ReadinessAiReview): ReadinessRow[] {
  const findings = new Map(review.rowFindings.map((finding) => [finding.rowId, finding]));
  return rows.map((row) => {
    const finding = findings.get(row.id);
    if (!finding) return row;
    const status = canAiSetStatus(row.deterministicStatus, finding.status)
      ? finding.status
      : row.deterministicStatus;
    const score =
      typeof finding.score === "number" && Number.isFinite(finding.score)
        ? Math.max(0, Math.min(100, Math.round(finding.score)))
        : row.readinessScore;
    const next = {
      ...row,
      status,
      readinessScore: row.deterministicStatus === "blocked" || row.deterministicStatus === "gap"
        ? Math.min(score, row.readinessScore)
        : score,
      ai: {
        status: finding.status,
        score: finding.score,
        explanation: finding.explanation,
        confidence: finding.confidence,
      },
    };
    return { ...next, recommendedNextAction: recommendedAction(next) };
  });
}

export function credentialStatusFromExpiresOn(expiresOn: string | null | undefined) {
  return expiryUiStatus(expiresOn, new Date(), 60);
}
