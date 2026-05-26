"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { TableDensityToggle } from "@/components/app-shell/TableDensityToggle";
import { ComplianceCommandCenter } from "@/components/training-matrix/ComplianceCommandCenter";
import { CoordinatorQueue } from "@/components/training-matrix/CoordinatorQueue";
import { useTableDensity } from "@/hooks/useTableDensity";
import {
  InlineMessage,
  MetricTile,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { TRAINING_REQUIREMENTS_MIGRATION_SQL } from "@/lib/companyTrainingRequirementsDb";
import {
  PROFILE_CERTIFICATION_GROUPS,
  PROFILE_CERTIFICATION_SET,
} from "@/lib/constructionProfileCertifications";
import {
  CONSTRUCTION_POSITIONS,
  CONSTRUCTION_TRADES,
} from "@/lib/constructionProfileOptions";
import { buildTrainingMatrixActionQueue } from "@/lib/trainingMatrixActionQueue";
import type {
  Stage1ReadinessStatus,
  Stage1TrainingDetail,
  Stage1TrainingStatus,
  Stage1TrainingSummary,
} from "@/lib/trainingMatrixStage1";
import {
  WorkerProfileDrawer,
  buildWorkerProfileFromMatrixRow,
  type WorkerProfileRecord,
  type WorkerProfileTab,
} from "@/components/workforce/WorkerProfileDrawer";
import {
  applyAiReviewToReadinessRows,
  buildEmployeeReadinessRow,
  buildReadinessChart,
  filterReadinessRowsForChart,
  summarizeReadinessRows,
  type ReadinessAiReview,
  type ReadinessChartCellStatus,
  type ReadinessPersonnelTypeFilter,
  type ReadinessRow,
  type ReadinessStatus,
  type ReadinessSummary,
} from "@/lib/readinessMatrix";

const supabase = getSupabaseBrowserClient();

type Requirement = {
  id: string;
  title: string;
  sortOrder: number;
  matchKeywords: string[];
  matchFields: string[];
  applyTrades: string[];
  applyPositions: string[];
  applySubTrades: string[];
  applyTaskCodes: string[];
  renewalMonths?: number | null;
  isGenerated?: boolean;
  generatedSourceType?: string | null;
  generatedSourceDocumentId?: string | null;
  generatedSourceOperationKey?: string | null;
  category?: string;
  renewalPeriodDays?: number | null;
  courseOwner?: string;
  courseVersion?: string;
  requiresEvidence?: boolean;
};

type MatrixJobsiteOption = { id: string; name: string };

type MatrixFilters = {
  trades: string[];
  subTrades: string[];
  taskCodes: Array<{ value: string; label: string }>;
  jobsites?: MatrixJobsiteOption[];
};

type MatrixCellState = "match" | "gap" | "na";
type MatrixViewMode = "readiness" | "all" | "gaps" | "expiring";
type Stage1MatrixMode = "worker" | "course";
type Stage1StatusFilter =
  | "all"
  | "complete"
  | "expiring_soon"
  | "overdue"
  | "missing"
  | "permit_critical"
  | "no_portal";

function mergeJobsiteOptions(current: MatrixJobsiteOption[], next: MatrixJobsiteOption[]) {
  const merged = new Map<string, MatrixJobsiteOption>();
  for (const jobsite of [...current, ...next]) {
    const id = jobsite.id?.trim();
    if (!id) continue;
    merged.set(id, { id, name: jobsite.name?.trim() || "Unnamed job / project" });
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

type MatrixCellDetail = {
  state: MatrixCellState;
  matchSource?: string;
  matchedLabel?: string;
  expiresOn?: string | null;
  daysUntilExpiry?: number | null;
  expiryStatus?: "none" | "ok" | "soon" | "expired";
  gapKeywords?: string[];
};

type CertificationInventoryItem = {
  name: string;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  expiryStatus: "none" | "ok" | "soon" | "expired";
};

type MatrixRow = {
  userId: string;
  trackedEmployeeId?: string;
  personType?: "licensed_user" | "tracked_employee";
  licenseStatus?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  cells: Record<string, MatrixCellState>;
  cellDetails?: Record<string, MatrixCellDetail>;
  unmatchedCertifications: string[];
  certificationInventory?: CertificationInventoryItem[];
  profileFields: {
    tradeSpecialty: string;
    jobTitle: string;
    readinessStatus: string;
    yearsExperience: number | null;
  };
  workerType?: string;
  loginAccessStatus?: "Active User" | "Invited User" | "Disabled User" | "No Portal Access";
  companyOrDepartment?: string;
  jobTitleOrTrade?: string;
  assignedJobsites?: string[];
  supervisorOrManager?: string;
  readinessStatus?: Stage1ReadinessStatus | string;
  trainingStatus?: Stage1ReadinessStatus | string;
  permitExposureStatus?: string;
  accessStatus?: string;
  lastUpdated?: string | null;
  trainingRequirements?: Stage1TrainingDetail[];
  trainingSummary?: Stage1TrainingSummary;
};

const OFFLINE_DEMO_REQUIREMENTS: Requirement[] = [
  {
    id: "demo-req-a",
    title: "OSHA 10 (Foreman / Superintendent)",
    sortOrder: 1,
    matchKeywords: ["OSHA 10 Construction"],
    matchFields: ["certifications"],
    applyTrades: ["Structural Steel and Erection", "General Construction"],
    applyPositions: ["Foreman", "Superintendent"],
    applySubTrades: [],
    applyTaskCodes: [],
    renewalMonths: 60,
  },
  {
    id: "demo-req-b",
    title: "LOTO Authorized Worker",
    sortOrder: 2,
    matchKeywords: ["LOTO Authorized Worker", "Lockout/Tagout"],
    matchFields: ["certifications"],
    applyTrades: ["Electrical and Instrumentation"],
    applyPositions: ["Electrician", "Foreman"],
    applySubTrades: [],
    applyTaskCodes: ["energized_work_boundaries"],
    renewalMonths: 12,
  },
  {
    id: "demo-req-c",
    title: "First Aid / CPR",
    sortOrder: 3,
    matchKeywords: ["First Aid / CPR", "CPR"],
    matchFields: ["certifications"],
    applyTrades: ["Structural Steel and Erection", "Electrical and Instrumentation", "General Construction"],
    applyPositions: ["Foreman", "Safety Manager", "Electrician", "Superintendent"],
    applySubTrades: [],
    applyTaskCodes: [],
    renewalMonths: 24,
  },
];

const OFFLINE_DEMO_ROWS: MatrixRow[] = [
  {
    userId: "offline-demo-1",
    name: "Jordan Lee",
    email: "demo.20260425@safepredict.local",
    role: "company_admin",
    status: "Active",
    cells: { "demo-req-a": "match", "demo-req-b": "na", "demo-req-c": "match" },
    cellDetails: {
      "demo-req-a": { state: "match", expiryStatus: "ok", matchedLabel: "OSHA 10 Construction" },
      "demo-req-b": { state: "na" },
      "demo-req-c": { state: "match", expiryStatus: "soon", matchedLabel: "First Aid / CPR" },
    },
    unmatchedCertifications: [],
    certificationInventory: [
      { name: "OSHA 10 Construction", expiresOn: "2027-08-12", daysUntilExpiry: 472, expiryStatus: "ok" },
      { name: "First Aid / CPR", expiresOn: "2026-05-12", daysUntilExpiry: 15, expiryStatus: "soon" },
    ],
    profileFields: {
      tradeSpecialty: "Structural Steel and Erection",
      jobTitle: "Superintendent",
      readinessStatus: "ready",
      yearsExperience: 12,
    },
  },
  {
    userId: "offline-demo-2",
    name: "Tyler Ruiz",
    email: "tyler.ruiz@safepredict.local",
    role: "company_user",
    status: "Active",
    cells: { "demo-req-a": "na", "demo-req-b": "match", "demo-req-c": "match" },
    cellDetails: {
      "demo-req-a": { state: "na" },
      "demo-req-b": { state: "match", expiryStatus: "soon", matchedLabel: "LOTO Authorized Worker" },
      "demo-req-c": { state: "match", expiryStatus: "ok", matchedLabel: "First Aid / CPR" },
    },
    unmatchedCertifications: [],
    certificationInventory: [
      { name: "LOTO Authorized Worker", expiresOn: "2026-05-08", daysUntilExpiry: 11, expiryStatus: "soon" },
      { name: "First Aid / CPR", expiresOn: "2026-10-02", daysUntilExpiry: 158, expiryStatus: "ok" },
    ],
    profileFields: {
      tradeSpecialty: "Electrical and Instrumentation",
      jobTitle: "Electrician",
      readinessStatus: "travel_ready",
      yearsExperience: 5,
    },
  },
  {
    userId: "offline-demo-3",
    name: "Riley Morgan",
    email: "riley.morgan@safepredict.local",
    role: "field_user",
    status: "Active",
    cells: { "demo-req-a": "gap", "demo-req-b": "na", "demo-req-c": "gap" },
    cellDetails: {
      "demo-req-a": { state: "gap", gapKeywords: ["OSHA 10 Construction"] },
      "demo-req-b": { state: "na" },
      "demo-req-c": { state: "gap", gapKeywords: ["First Aid / CPR"] },
    },
    unmatchedCertifications: [],
    certificationInventory: [
      { name: "OSHA 10 Construction", expiresOn: "2025-01-10", daysUntilExpiry: -473, expiryStatus: "expired" },
    ],
    profileFields: {
      tradeSpecialty: "Structural Steel and Erection",
      jobTitle: "Apprentice Ironworker",
      readinessStatus: "limited",
      yearsExperience: 1,
    },
  },
];

function buildOfflineDemoMatrixPayload(selectedTradeFilter: string) {
  const filteredRows = selectedTradeFilter
    ? OFFLINE_DEMO_ROWS.filter(
        (row) => row.profileFields.tradeSpecialty.toLowerCase() === selectedTradeFilter.toLowerCase()
      )
    : OFFLINE_DEMO_ROWS;
  return {
    requirements: OFFLINE_DEMO_REQUIREMENTS,
    rows: filteredRows,
    filters: {
      trades: [
        "Structural Steel and Erection",
        "Electrical and Instrumentation",
        "General Construction",
      ],
      subTrades: [],
      taskCodes: [{ value: "energized_work_boundaries", label: "Energized Work Boundaries" }],
      jobsites: [{ id: "demo-site", name: "Demo Project" }],
    } as MatrixFilters,
  };
}

function normalizeCellState(v: unknown): MatrixCellState {
  if (v === true) return "match";
  if (v === false) return "gap";
  if (v === "match" || v === "gap" || v === "na") return v;
  return "gap";
}

const positionOptionSet = new Set<string>(CONSTRUCTION_POSITIONS);

function parseRenewalMonthsInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 600) return null;
  return n;
}

function requirementHeaderTitle(r: Requirement): string {
  const kw = r.matchKeywords.join(", ");
  if (r.renewalMonths != null && r.renewalMonths > 0) {
    return `${kw}\nTypical renewal: ${r.renewalMonths} mo (hint only; profile expiration dates control the matrix).`;
  }
  return kw;
}

function requirementScopeCaption(r: Requirement): string {
  const parts = [
    r.applyTrades.length ? `Trades: ${r.applyTrades.join(", ")}` : "",
    r.applyPositions.length ? `Positions: ${r.applyPositions.join(", ")}` : "",
    r.applySubTrades.length ? `Subtrades: ${r.applySubTrades.join(", ")}` : "",
    r.applyTaskCodes.length ? `Tasks: ${r.applyTaskCodes.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function readinessLabel(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "travel_ready") return "Travel ready";
  if (s === "limited") return "Limited availability";
  if (s === "ready") return "Ready for site";
  return raw || "—";
}

function ledgerChipToneDark(
  status: CertificationInventoryItem["expiryStatus"]
): { wrap: string; dot: string } {
  switch (status) {
    case "expired":
      return { wrap: "bg-rose-500/15 text-rose-100 ring-rose-500/40", dot: "bg-rose-400" };
    case "soon":
      return { wrap: "bg-amber-500/15 text-amber-100 ring-amber-500/35", dot: "bg-amber-400" };
    case "ok":
      return { wrap: "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35", dot: "bg-emerald-400" };
    default:
      return { wrap: "bg-zinc-800/80 text-zinc-300 ring-zinc-600", dot: "bg-zinc-500" };
  }
}

function cellExpiryCaption(d: MatrixCellDetail | undefined): string {
  if (!d || d.state !== "match") return "";
  if (d.expiryStatus === "none" || d.expiryStatus === undefined) {
    return "No expiry on file";
  }
  if (d.expiresOn && d.daysUntilExpiry !== null && d.daysUntilExpiry !== undefined) {
    if (d.daysUntilExpiry < 0) return `Expired ${d.expiresOn}`;
    if (d.daysUntilExpiry === 0) return `Expires today (${d.expiresOn})`;
    return `Expires ${d.expiresOn} · ${d.daysUntilExpiry}d`;
  }
  if (d.expiresOn) return `Expires ${d.expiresOn}`;
  return "";
}

function requirementCellTitle(r: Requirement, d: MatrixCellDetail | undefined, state: MatrixCellState): string {
  if (state === "na") return "Not required for this trade / position";
  if (state === "gap") {
    const kw = d?.gapKeywords?.length ? d.gapKeywords.join(", ") : r.matchKeywords.slice(0, 3).join(", ");
    return `Gap — profile should include training matching: ${kw || "see requirement keywords"}`;
  }
  if (d?.matchSource === "job_title") {
    return `Met via job title (“${d.matchedLabel ?? ""}”), not a certification line item`;
  }
  if (d?.matchSource === "trade_specialty") {
    return `Met via trade (“${d.matchedLabel ?? ""}”), not a certification line item`;
  }
  const cap = cellExpiryCaption(d);
  return [d?.matchedLabel ? `Matched: ${d.matchedLabel}` : "Met", cap].filter(Boolean).join("\n");
}

type PositionRollup = {
  missing: Requirement[];
  met: Requirement[];
  metExpiringSoon: Array<{ req: Requirement; detail: MatrixCellDetail }>;
  notRequired: Requirement[];
  expiredProfileCerts: CertificationInventoryItem[];
  soonProfileCerts: CertificationInventoryItem[];
};

function buildPositionRollup(row: MatrixRow, requirements: Requirement[]): PositionRollup {
  const missing: Requirement[] = [];
  const met: Requirement[] = [];
  const metExpiringSoon: Array<{ req: Requirement; detail: MatrixCellDetail }> = [];
  const notRequired: Requirement[] = [];

  for (const r of requirements) {
    const s = row.cells[r.id] ?? "gap";
    const d = row.cellDetails?.[r.id];
    if (s === "gap") {
      missing.push(r);
    } else if (s === "match") {
      met.push(r);
      if (d?.expiryStatus === "soon") {
        metExpiringSoon.push({ req: r, detail: d });
      }
    } else {
      notRequired.push(r);
    }
  }

  const inv = row.certificationInventory ?? [];
  const expiredProfileCerts = inv.filter((c) => c.expiryStatus === "expired");
  const soonProfileCerts = inv.filter((c) => c.expiryStatus === "soon");

  return { missing, met, metExpiringSoon, notRequired, expiredProfileCerts, soonProfileCerts };
}

function stage1StatusTone(status: Stage1TrainingStatus | Stage1ReadinessStatus | string): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "Complete" || status === "Ready") return "success";
  if (status === "Expiring Soon" || status === "Ready With Warnings") return "warning";
  if (status === "Overdue" || status === "Expired" || status === "Not Ready" || status === "Restricted" || status === "Blocked") return "error";
  if (status === "In Progress" || status === "Pending Review") return "info";
  return "neutral";
}

function stage1RowText(row: MatrixRow): string {
  return [
    row.name,
    row.email,
    row.workerType,
    row.loginAccessStatus,
    row.companyOrDepartment,
    row.profileFields.jobTitle,
    row.profileFields.tradeSpecialty,
    row.assignedJobsites?.join(" "),
    row.supervisorOrManager,
    ...(row.trainingRequirements ?? []).map((detail) => `${detail.trainingName} ${detail.requiredBecause}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesStage1StatusFilter(row: MatrixRow, filter: Stage1StatusFilter): boolean {
  const summary = row.trainingSummary;
  if (filter === "all") return true;
  if (filter === "complete") return Boolean(summary && summary.requiredCount > 0 && summary.completeCount === summary.requiredCount);
  if (filter === "expiring_soon") return Boolean(summary && summary.expiringSoonCount > 0);
  if (filter === "overdue") return Boolean(summary && summary.overdueCount > 0);
  if (filter === "missing") return Boolean(summary && summary.missingCount > 0);
  if (filter === "permit_critical") return Boolean(summary && summary.permitLinkedGaps > 0);
  if (filter === "no_portal") return row.loginAccessStatus === "No Portal Access";
  return true;
}

type Stage1CourseRollup = {
  requirement: Requirement;
  requiredWorkers: number;
  complete: number;
  missing: number;
  expiringSoon: number;
  overdue: number;
  workers: Array<{ row: MatrixRow; detail: Stage1TrainingDetail }>;
};

function buildStage1CourseRollups(rows: MatrixRow[], requirements: Requirement[]): Stage1CourseRollup[] {
  return requirements.map((requirement) => {
    const workers = rows
      .map((row) => {
        const detail = row.trainingRequirements?.find((item) => item.requirementId === requirement.id);
        return detail && detail.status !== "Not Applicable" ? { row, detail } : null;
      })
      .filter((item): item is { row: MatrixRow; detail: Stage1TrainingDetail } => Boolean(item));
    return {
      requirement,
      requiredWorkers: workers.length,
      complete: workers.filter((item) => item.detail.status === "Complete").length,
      missing: workers.filter((item) => item.detail.status === "Missing").length,
      expiringSoon: workers.filter((item) => item.detail.status === "Expiring Soon").length,
      overdue: workers.filter((item) => item.detail.status === "Overdue" || item.detail.status === "Expired").length,
      workers,
    };
  });
}

function readWorkerProfileTab(value: string | null): WorkerProfileTab {
  return value === "training" ||
    value === "permits" ||
    value === "jobsites" ||
    value === "documents" ||
    value === "actions" ||
    value === "access" ||
    value === "audit"
    ? value
    : "summary";
}

function Stage1ComplianceGrid({
  rows,
  requirements,
  mode,
  onModeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onOpenProfile,
}: {
  rows: MatrixRow[];
  requirements: Requirement[];
  mode: Stage1MatrixMode;
  onModeChange: (mode: Stage1MatrixMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: Stage1StatusFilter;
  onStatusFilterChange: (value: Stage1StatusFilter) => void;
  onOpenProfile: (workerId: string, tab?: WorkerProfileTab) => void;
}) {
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesStage1StatusFilter(row, statusFilter)) return false;
      if (!query) return true;
      return stage1RowText(row).includes(query);
    });
  }, [rows, search, statusFilter]);
  const courseRollups = useMemo(
    () =>
      buildStage1CourseRollups(filteredRows, requirements).filter((rollup) => {
        if (!search.trim()) return true;
        const query = search.trim().toLowerCase();
        return (
          rollup.requirement.title.toLowerCase().includes(query) ||
          rollup.requirement.category?.toLowerCase().includes(query) ||
          rollup.workers.some((item) => stage1RowText(item.row).includes(query))
        );
      }),
    [filteredRows, requirements, search]
  );
  const quickFilters: Array<{ id: Stage1StatusFilter; label: string }> = [
    { id: "all", label: "All workers" },
    { id: "overdue", label: "Overdue only" },
    { id: "expiring_soon", label: "Expiring in 30 days" },
    { id: "no_portal", label: "No portal access" },
    { id: "permit_critical", label: "Permit-critical workers" },
    { id: "missing", label: "Missing evidence" },
  ];

  return (
    <SectionCard
      eyebrow="Stage 1 Compliance Grid"
      title="Training Matrix"
      description="Detailed compliance grid by worker or by training course, including why each course is required."
      tone="elevated"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_220px] lg:min-w-[560px]">
          <label className="text-sm font-medium text-[var(--app-text-strong)]">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Worker, company, trade, jobsite, course, supervisor"
              className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
            />
          </label>
          <label className="text-sm font-medium text-[var(--app-text-strong)]">
            Status
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as Stage1StatusFilter)}
              className={`mt-1 w-full ${appNativeSelectClassName}`}
            >
              {quickFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--app-border)] bg-white p-1">
          {[
            { value: "worker" as const, label: "By Worker" },
            { value: "course" as const, label: "By Training Course" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={
                mode === option.value
                  ? "rounded-md bg-[var(--app-accent-primary)] px-3 py-2 text-xs font-bold text-white"
                  : "rounded-md px-3 py-2 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-panel-soft)]"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onStatusFilterChange(filter.id)}
            className={
              statusFilter === filter.id
                ? "rounded-lg bg-[var(--app-accent-primary)] px-3 py-1.5 text-xs font-bold text-white"
                : "rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-panel-soft)]"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {mode === "worker" ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--app-border)] bg-white">
          <table className="min-w-[1500px] border-collapse text-left text-sm">
            <thead className="bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              <tr>
                {[
                  "Worker",
                  "Worker type",
                  "Login access",
                  "Company / department",
                  "Job title / trade",
                  "Jobsite",
                  "Supervisor / manager",
                  "Required",
                  "Complete",
                  "Missing",
                  "Expiring soon",
                  "Overdue",
                  "Permit-linked gaps",
                  "Overall status",
                  "Next due date",
                  "Actions",
                ].map((header) => (
                  <th key={header} className="border-b border-[var(--app-border)] px-3 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const summary = row.trainingSummary;
                const expanded = expandedWorkerId === row.userId;
                return (
                  <Fragment key={row.userId}>
                    <tr key={row.userId} className="border-b border-[var(--app-border)] align-top hover:bg-[var(--app-accent-surface-06)]">
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setExpandedWorkerId(expanded ? null : row.userId)} className="font-semibold text-[var(--app-accent-primary)] hover:underline">
                          {row.name}
                        </button>
                        <div className="mt-0.5 text-xs text-[var(--app-muted)]">{row.email || "No email on file"}</div>
                      </td>
                      <td className="px-3 py-3">{row.workerType ?? (row.personType === "tracked_employee" ? "External Worker" : "Employee")}</td>
                      <td className="px-3 py-3"><StatusBadge label={row.loginAccessStatus ?? "Active User"} tone={row.loginAccessStatus === "No Portal Access" ? "info" : "success"} /></td>
                      <td className="px-3 py-3">{row.companyOrDepartment || "Not set"}</td>
                      <td className="px-3 py-3">{row.jobTitleOrTrade || [row.profileFields.jobTitle, row.profileFields.tradeSpecialty].filter(Boolean).join(" / ") || "Not set"}</td>
                      <td className="px-3 py-3">{row.assignedJobsites?.length ? row.assignedJobsites.join(", ") : "No jobsite assigned"}</td>
                      <td className="px-3 py-3">{row.supervisorOrManager || "Not assigned"}</td>
                      <td className="px-3 py-3 font-semibold">{summary?.requiredCount ?? 0}</td>
                      <td className="px-3 py-3">{summary?.completeCount ?? 0}</td>
                      <td className="px-3 py-3">{summary?.missingCount ?? 0}</td>
                      <td className="px-3 py-3">{summary?.expiringSoonCount ?? 0}</td>
                      <td className="px-3 py-3">{summary?.overdueCount ?? 0}</td>
                      <td className="px-3 py-3">{summary?.permitLinkedGaps ?? 0}</td>
                      <td className="px-3 py-3"><StatusBadge label={summary?.overallStatus ?? row.readinessStatus ?? "Pending Review"} tone={stage1StatusTone(summary?.overallStatus ?? row.readinessStatus ?? "")} /></td>
                      <td className="px-3 py-3">{summary?.nextDueDate ?? "No upcoming due date"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => onOpenProfile(row.userId, "summary")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">View profile</button>
                          <button type="button" onClick={() => onOpenProfile(row.userId, "training")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">Assign training</button>
                          {row.loginAccessStatus === "No Portal Access" ? (
                            <>
                              <button type="button" onClick={() => onOpenProfile(row.userId, "access")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">Convert to system user</button>
                              <button type="button" onClick={() => onOpenProfile(row.userId, "access")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">Approve site access</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => onOpenProfile(row.userId, "training")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">Review reminder</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr key={`${row.userId}-expanded`} className="border-b border-[var(--app-border)] bg-[var(--app-panel-soft)]">
                        <td colSpan={16} className="px-4 py-4">
                          <div className="overflow-x-auto rounded-lg border border-[var(--app-border)] bg-white">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-[var(--app-panel-soft)] uppercase tracking-wide text-[var(--app-muted)]">
                                <tr>
                                  {["Training name", "Required because", "Status", "Completed date", "Expiry date", "Due date", "Evidence", "Trainer / approver", "Course version", "Actions"].map((header) => (
                                    <th key={header} className="px-3 py-2">{header}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(row.trainingRequirements ?? []).map((detail) => (
                                  <tr key={detail.requirementId} className="border-t border-[var(--app-border)] align-top">
                                    <td className="px-3 py-2 font-semibold text-[var(--app-text-strong)]">{detail.trainingName}</td>
                                    <td className="px-3 py-2">{detail.requiredBecause}</td>
                                    <td className="px-3 py-2"><StatusBadge label={detail.status} tone={stage1StatusTone(detail.status)} /></td>
                                    <td className="px-3 py-2">{detail.completedDate ?? "Not complete"}</td>
                                    <td className="px-3 py-2">{detail.expiryDate ?? "No expiry on file"}</td>
                                    <td className="px-3 py-2">{detail.dueDate ?? "No due date"}</td>
                                    <td className="px-3 py-2">{detail.evidenceStatus}</td>
                                    <td className="px-3 py-2">{detail.trainerOrApprover}</td>
                                    <td className="px-3 py-2">{detail.courseVersion}</td>
                                    <td className="px-3 py-2">
                                      {detail.preventionMessage ? <p className="mb-2 text-[11px] font-semibold text-[var(--semantic-danger)]">{detail.preventionMessage}</p> : null}
                                      <button type="button" onClick={() => onOpenProfile(row.userId, "actions")} className="font-bold text-[var(--app-accent-primary)] hover:underline">Create action</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-sm text-[var(--app-muted)]">
                    {statusFilter === "overdue" ? "No overdue training found. Workers in this view are currently compliant." : "No workforce records match the current filters."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--app-border)] bg-white">
          <table className="min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-[var(--app-panel-soft)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              <tr>
                {["Training course", "Category", "Required workers", "Complete", "Missing", "Expiring soon", "Overdue", "Renewal period", "Course owner", "Actions"].map((header) => (
                  <th key={header} className="border-b border-[var(--app-border)] px-3 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courseRollups.map((rollup) => {
                const expanded = expandedCourseId === rollup.requirement.id;
                return (
                  <Fragment key={rollup.requirement.id}>
                    <tr key={rollup.requirement.id} className="border-b border-[var(--app-border)] align-top hover:bg-[var(--app-accent-surface-06)]">
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setExpandedCourseId(expanded ? null : rollup.requirement.id)} className="font-semibold text-[var(--app-accent-primary)] hover:underline">
                          {rollup.requirement.title}
                        </button>
                      </td>
                      <td className="px-3 py-3">{rollup.requirement.category ?? "General"}</td>
                      <td className="px-3 py-3 font-semibold">{rollup.requiredWorkers}</td>
                      <td className="px-3 py-3">{rollup.complete}</td>
                      <td className="px-3 py-3">{rollup.missing}</td>
                      <td className="px-3 py-3">{rollup.expiringSoon}</td>
                      <td className="px-3 py-3">{rollup.overdue}</td>
                      <td className="px-3 py-3">{rollup.requirement.renewalPeriodDays ? `${rollup.requirement.renewalPeriodDays} days` : "Not configured"}</td>
                      <td className="px-3 py-3">{rollup.requirement.courseOwner ?? "Safety team"}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedCourseId(expanded ? null : rollup.requirement.id)}
                          className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline"
                        >
                          Review workers
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr key={`${rollup.requirement.id}-expanded`} className="border-b border-[var(--app-border)] bg-[var(--app-panel-soft)]">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid gap-2">
                            {rollup.workers.map(({ row, detail }) => (
                              <div key={`${rollup.requirement.id}-${row.userId}`} className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-semibold text-[var(--app-text-strong)]">{row.name}</p>
                                  <p className="text-xs text-[var(--app-muted)]">{row.assignedJobsites?.join(", ") || "No jobsite assigned"} / Due {detail.dueDate ?? "not scheduled"} / Evidence {detail.evidenceStatus}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge label={detail.status} tone={stage1StatusTone(detail.status)} />
                                  <button type="button" onClick={() => onOpenProfile(row.userId, "training")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">Review reminder</button>
                                  <button type="button" onClick={() => onOpenProfile(row.userId, "actions")} className="text-xs font-bold text-[var(--app-accent-primary)] hover:underline">Create action</button>
                                </div>
                              </div>
                            ))}
                            {rollup.workers.length === 0 ? (
                              <p className="text-sm text-[var(--app-muted)]">No workers are currently required to complete this course.</p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function PositionScopeSummary({
  rollup,
  requirementsCount,
  theme = "light",
}: {
  rollup: PositionRollup;
  requirementsCount: number;
  theme?: "light" | "dark";
}) {
  const d = theme === "dark";
  if (requirementsCount === 0) {
    return (
      <p className={`mt-2 text-[11px] ${d ? "text-zinc-500" : "text-slate-500"}`}>
        No company requirements yet — add rules above to track gaps by position and trade.
      </p>
    );
  }

  const scopedCount = rollup.missing.length + rollup.met.length;

  return (
    <div
      className={
        d
          ? "mt-3 space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-2.5"
          : "mt-3 space-y-2 rounded-xl border border-slate-700/80 bg-slate-950/50/90 p-2.5"
      }
    >
      <p
        className={
          d
            ? "text-[10px] font-bold uppercase tracking-wide text-zinc-500"
            : "text-[10px] font-bold uppercase tracking-wide text-slate-400"
        }
      >
        For this position & trade
      </p>

      {rollup.missing.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-amber-300" : "text-amber-900"}`}>
            Missing ({rollup.missing.length})
          </p>
          <ul
            className={`mt-1 space-y-0.5 text-[11px] leading-snug ${d ? "text-amber-100" : "text-amber-950"}`}
          >
            {rollup.missing.map((r) => (
              <li
                key={r.id}
                className={`border-l-2 pl-1.5 ${d ? "border-amber-500" : "border-amber-400"}`}
              >
                <span className="line-clamp-2 font-medium">{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : scopedCount === 0 ? (
        <p className={`text-[11px] ${d ? "text-zinc-400" : "text-slate-400"}`}>
          No rules apply to this trade/position combination yet.
        </p>
      ) : (
        <p className={`text-[11px] font-semibold ${d ? "text-emerald-400" : "text-emerald-100"}`}>
          Every in-scope training rule satisfied ({rollup.met.length}).
        </p>
      )}

      {rollup.met.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-emerald-400" : "text-emerald-900"}`}>
            Covered for your role ({rollup.met.length})
          </p>
          <ul
            className={`mt-1 max-h-28 space-y-0.5 overflow-y-auto text-[11px] leading-snug ${d ? "text-emerald-100" : "text-emerald-950"}`}
          >
            {rollup.met.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className={`line-clamp-2 border-l-2 pl-1.5 ${d ? "border-emerald-500" : "border-emerald-400"}`}
              >
                {r.title}
              </li>
            ))}
          </ul>
          {rollup.met.length > 8 ? (
            <p className={`mt-0.5 text-[10px] ${d ? "text-emerald-300" : "text-emerald-100"}`}>
              +{rollup.met.length - 8} more
            </p>
          ) : null}
        </div>
      ) : null}

      {rollup.metExpiringSoon.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-amber-300" : "text-amber-900"}`}>
            Met — expiring soon ({rollup.metExpiringSoon.length})
          </p>
          <ul className={`mt-1 space-y-1 text-[11px] leading-snug ${d ? "text-amber-100" : "text-amber-950"}`}>
            {rollup.metExpiringSoon.map(({ req, detail }) => (
              <li
                key={req.id}
                className={
                  d
                    ? "rounded-md bg-amber-500/15 px-1.5 py-1 ring-1 ring-amber-500/30"
                    : "rounded-md bg-amber-100/80 px-1.5 py-1"
                }
              >
                <div className="font-semibold line-clamp-2">{req.title}</div>
                <div className={`text-[10px] ${d ? "text-amber-200/90" : "text-amber-900/90"}`}>
                  {detail.matchedLabel ? `${detail.matchedLabel} · ` : ""}
                  {cellExpiryCaption(detail)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rollup.expiredProfileCerts.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-rose-400" : "text-red-900"}`}>
            Expired on profile ({rollup.expiredProfileCerts.length})
          </p>
          <ul className={`mt-1 space-y-0.5 text-[11px] leading-snug ${d ? "text-rose-100" : "text-red-950"}`}>
            {rollup.expiredProfileCerts.map((c) => (
              <li key={c.name} className={`border-l-2 pl-1.5 ${d ? "border-rose-500" : "border-red-400"}`}>
                <span className="font-medium">{c.name}</span>
                {c.expiresOn ? (
                  <span className={d ? "text-rose-200/90" : "text-red-100/90"}> · ended {c.expiresOn}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rollup.soonProfileCerts.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold ${d ? "text-amber-300" : "text-amber-900"}`}>
            Credential expiring soon ({rollup.soonProfileCerts.length})
          </p>
          <ul className={`mt-1 space-y-0.5 text-[11px] leading-snug ${d ? "text-amber-100" : "text-amber-950"}`}>
            {rollup.soonProfileCerts.map((c) => (
              <li key={c.name} className={`border-l-2 pl-1.5 ${d ? "border-amber-400" : "border-amber-500"}`}>
                <span className="font-medium">{c.name}</span>
                {c.expiresOn ? (
                  <span className={d ? "text-amber-200/85" : "text-amber-900/85"}>
                    {" "}
                    · {c.expiresOn}
                    {c.daysUntilExpiry != null ? ` (${c.daysUntilExpiry}d)` : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rollup.notRequired.length > 0 ? (
        <p className={`text-[10px] ${d ? "text-zinc-500" : "text-slate-500"}`}>
          <span className={`font-semibold ${d ? "text-zinc-400" : "text-slate-400"}`}>
            {rollup.notRequired.length}
          </span>{" "}
          other company rule{rollup.notRequired.length === 1 ? "" : "s"} do not apply to this position/trade
          (see “Out of scope” in the grid).
        </p>
      ) : null}
    </div>
  );
}

/** Dropdown sentinel for a certification not in the profile catalog. */
const CUSTOM_PROFILE_CERT_VALUE = "__custom_cert__";

function resolvedTrainingFromCertPicker(select: string, custom: string): string {
  if (select === CUSTOM_PROFILE_CERT_VALUE) return custom.trim();
  return select.trim();
}

function certPickerStateFromTrainingLine(trainingLine: string): { select: string; custom: string } {
  const t = trainingLine.trim();
  if (!t) return { select: "", custom: "" };
  if (PROFILE_CERTIFICATION_SET.has(t)) return { select: t, custom: "" };
  return { select: CUSTOM_PROFILE_CERT_VALUE, custom: t };
}

/** Stored title: `Training name (Position A, Position B)` for matrix / lists. */
function composeRequirementTitle(trainingLine: string, positions: string[]): string {
  const t = trainingLine.trim();
  const pos = positions.filter(Boolean);
  if (!t) return "";
  if (pos.length === 0) return t;
  return `${t} (${pos.join(", ")})`;
}

/** Split stored title for editing; falls back to API positions when title is legacy plain text. */
function parseRequirementTitleForEdit(
  storedTitle: string,
  apiPositions: string[]
): { trainingLine: string; positions: string[] } {
  const m = storedTitle.trim().match(/^(.+)\s+\(([^)]+)\)\s*$/);
  if (!m) {
    return { trainingLine: storedTitle.trim(), positions: [...apiPositions] };
  }
  const trainingLine = m[1].trim();
  const candidates = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const matched = candidates.filter((p) => positionOptionSet.has(p));
  if (matched.length > 0) {
    return { trainingLine, positions: matched };
  }
  return { trainingLine: storedTitle.trim(), positions: [...apiPositions] };
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("You must be logged in.");
  }
  return session.access_token;
}

function sanitizeApiErrorMessage(raw: string): string {
  const t = raw.trim();
  if (
    t.startsWith("<!DOCTYPE") ||
    t.startsWith("<html") ||
    t.includes("<title>500") ||
    t.includes("Internal Server Error</h1>")
  ) {
    return "The server returned an error while loading the training matrix. Please try again. If it continues, confirm your Supabase migrations are applied (training requirements + profile columns).";
  }
  return t;
}

/** Single-select dropdowns + chips — works on mobile; native multi-select is often invisible there. */
function PickTradesAndPositions({
  trades,
  positions,
  onTradesChange,
  onPositionsChange,
  variant = "default",
}: {
  trades: string[];
  positions: string[];
  onTradesChange: (next: string[]) => void;
  onPositionsChange: (next: string[]) => void;
  variant?: "default" | "compact";
}) {
  const selectClass =
    variant === "compact"
      ? "mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark] outline-none focus:ring-2 focus:ring-sky-500"
      : "mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 [color-scheme:dark] outline-none focus:ring-2 focus:ring-sky-500";

  const selectAllBtnClass =
    variant === "compact"
      ? "rounded-lg px-2 py-1 text-xs font-semibold text-sky-400 transition hover:text-sky-300 disabled:cursor-default disabled:text-slate-500 disabled:hover:text-slate-500"
      : "rounded-lg px-2 py-1.5 text-sm font-semibold text-sky-400 transition hover:text-sky-300 disabled:cursor-default disabled:text-slate-500 disabled:hover:text-slate-500";

  const chipClass =
    variant === "compact"
      ? "inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-950/50 px-2 py-0.5 text-xs font-medium text-slate-200"
      : "inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/50 px-2.5 py-1 text-sm font-medium text-slate-200";

  const availableTrades = CONSTRUCTION_TRADES.filter((t) => !trades.includes(t));
  const availablePositions = CONSTRUCTION_POSITIONS.filter((p) => !positions.includes(p));

  const allTradesSelected =
    CONSTRUCTION_TRADES.length > 0 &&
    trades.length === CONSTRUCTION_TRADES.length &&
    CONSTRUCTION_TRADES.every((t) => trades.includes(t));
  const allPositionsSelected =
    CONSTRUCTION_POSITIONS.length > 0 &&
    positions.length === CONSTRUCTION_POSITIONS.length &&
    CONSTRUCTION_POSITIONS.every((p) => positions.includes(p));

  const headingClass =
    variant === "compact"
      ? "text-xs font-semibold text-slate-400"
      : "text-sm font-medium text-slate-300";

  return (
    <div className={variant === "compact" ? "grid gap-3 sm:grid-cols-2" : "mt-4 grid gap-5 md:grid-cols-2"}>
      <div>
        <div className={headingClass}>
          Applies to trades <span className="text-red-600">*</span>
        </div>
        {variant === "default" ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Same options as <strong>Primary trade</strong> on the construction profile. Choose from the
            dropdown; add several if needed.
          </p>
        ) : null}
        <div className={variant === "compact" ? "mt-1" : "mt-1.5"}>
          <button
            type="button"
            className={selectAllBtnClass}
            disabled={allTradesSelected}
            onClick={() => onTradesChange([...CONSTRUCTION_TRADES])}
          >
            {allTradesSelected ? "All trades selected" : "Select all trades"}
          </button>
        </div>
        <select
          key={`trade-dd-${trades.join("|")}`}
          className={selectClass}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onTradesChange([...trades, v]);
          }}
        >
          <option value="">Add a trade…</option>
          {availableTrades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {trades.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected trades">
            {trades.map((t) => (
              <li key={t} className={chipClass}>
                <span className="truncate">{t}</span>
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
                  aria-label={`Remove ${t}`}
                  onClick={() => onTradesChange(trades.filter((x) => x !== t))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No trades selected yet.</p>
        )}
      </div>
      <div>
        <div className={headingClass}>
          Applies to positions <span className="text-red-600">*</span>
        </div>
        {variant === "default" ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Same options as <strong>Site position</strong> on the construction profile. Each pick is
            included in the saved title after your training name.
          </p>
        ) : null}
        <div className={variant === "compact" ? "mt-1" : "mt-1.5"}>
          <button
            type="button"
            className={selectAllBtnClass}
            disabled={allPositionsSelected}
            onClick={() => onPositionsChange([...CONSTRUCTION_POSITIONS])}
          >
            {allPositionsSelected ? "All positions selected" : "Select all positions"}
          </button>
        </div>
        <select
          key={`position-dd-${positions.join("|")}`}
          className={selectClass}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onPositionsChange([...positions, v]);
          }}
        >
          <option value="">Add a position…</option>
          {availablePositions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {positions.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected positions">
            {positions.map((p) => (
              <li key={p} className={chipClass}>
                <span className="truncate">{p}</span>
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
                  aria-label={`Remove ${p}`}
                  onClick={() => onPositionsChange(positions.filter((x) => x !== p))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No positions selected yet.</p>
        )}
      </div>
    </div>
  );
}

const SCHEMA_MIGRATION_BANNER_DISMISSED_KEY = "sd360_dismiss_training_schema_migration_v1";
const DIRECTORY_NOTICE_DISMISSED_KEY = "sd360_dismiss_training_matrix_directory_notice_v1";

function SchemaMigrationBanner({ onDismiss }: { onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copySql = () => {
    void navigator.clipboard.writeText(TRAINING_REQUIREMENTS_MIGRATION_SQL).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-amber-950/40 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Database: enable trade and position rules</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/90">
            Run the SQL below in{" "}
            <strong className="font-semibold">Supabase → SQL Editor</strong> for this project. Until then,
            trade/position picks are not saved and requirements apply to everyone.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/60"
        >
          Dismiss
        </button>
      </div>
      <details className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/25 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-amber-100">
          Show SQL to copy
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900/5 p-3 font-mono text-xs leading-relaxed text-slate-200">
          {TRAINING_REQUIREMENTS_MIGRATION_SQL}
        </pre>
        <button
          type="button"
          onClick={() => copySql()}
          className="mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
        >
          {copied ? "Copied" : "Copy SQL"}
        </button>
      </details>
    </div>
  );
}

function readinessStatusText(status: ReadinessStatus) {
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

function readinessToneClass(status: ReadinessStatus) {
  switch (status) {
    case "ready":
      return "bg-emerald-500/12 text-emerald-300 ring-emerald-500/25";
    case "expiring_soon":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/35";
    case "gap":
      return "bg-fuchsia-500/12 text-fuchsia-300 ring-fuchsia-500/25";
    case "blocked":
      return "bg-red-500/15 text-red-200 ring-red-500/35";
    case "needs_review":
      return "bg-sky-500/12 text-sky-300 ring-sky-500/25";
  }
}

function readinessChartToneClass(status: ReadinessChartCellStatus) {
  if (status === "met") return "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25";
  return readinessToneClass(status);
}

function readinessChartCellLabel(status: ReadinessChartCellStatus) {
  return status === "met" ? "Met" : readinessStatusText(status);
}

function ReadinessChartPreview({ rows }: { rows: ReadinessRow[] }) {
  const chart = useMemo(() => buildReadinessChart(rows, 5), [rows]);
  const visibleRows = chart.rows.slice(0, 12);

  if (rows.length === 0 || chart.columns.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Readiness Chart</p>
          <p className="mt-1 text-sm text-zinc-400">
            Matrix-style view of workers against the highest-impact readiness requirements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-400">
          {(["met", "gap", "expiring_soon", "blocked", "needs_review"] as const).map((status) => (
            <span key={status} className={`rounded-full px-2 py-0.5 ring-1 ${readinessChartToneClass(status)}`}>
              {readinessChartCellLabel(status)}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/90">
              <th className="min-w-[190px] px-3 py-2 font-bold uppercase tracking-wide text-zinc-400">Worker</th>
              <th className="min-w-[130px] px-3 py-2 font-bold uppercase tracking-wide text-zinc-400">Trade</th>
              {chart.columns.map((column) => (
                <th key={column.key} className="min-w-[135px] px-3 py-2 font-bold uppercase tracking-wide text-zinc-400">
                  <span className="line-clamp-2">{column.label}</span>
                </th>
              ))}
              <th className="min-w-[130px] px-3 py-2 font-bold uppercase tracking-wide text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.rowId} className="border-b border-zinc-800/80">
                <td className="px-3 py-2 align-top">
                  <div className="font-semibold text-white">{row.worker}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">{row.personType}</div>
                </td>
                <td className="px-3 py-2 align-top text-zinc-300">
                  <div>{row.trade}</div>
                  {row.jobsiteName ? <div className="mt-0.5 text-[11px] text-zinc-500">{row.jobsiteName}</div> : null}
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.columnKey} className="px-3 py-2 align-top">
                    <span
                      title={cell.detail ?? cell.label}
                      className={`inline-flex min-w-[78px] justify-center rounded px-2 py-1 font-bold ring-1 ${readinessChartToneClass(cell.status)}`}
                    >
                      {cell.label}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-2 align-top">
                  <span className={`inline-flex rounded-full px-2 py-1 font-bold ring-1 ${readinessToneClass(row.status)}`}>
                    {readinessStatusText(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chart.rows.length > visibleRows.length ? (
        <p className="mt-2 text-xs text-zinc-500">
          Showing first {visibleRows.length} of {chart.rows.length} readiness rows. The detailed table below includes all rows.
        </p>
      ) : null}
    </div>
  );
}

function ReadinessChartSection({
  rows,
  allRowsCount,
  loading,
  loaded,
  error,
  jobsiteOptions,
  selectedJobsiteId,
  onJobsiteChange,
  personnelSearch,
  onPersonnelSearchChange,
  personnelType,
  onPersonnelTypeChange,
}: {
  rows: ReadinessRow[];
  allRowsCount: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  jobsiteOptions: MatrixJobsiteOption[];
  selectedJobsiteId: string;
  onJobsiteChange: (value: string) => void;
  personnelSearch: string;
  onPersonnelSearchChange: (value: string) => void;
  personnelType: ReadinessPersonnelTypeFilter;
  onPersonnelTypeChange: (value: ReadinessPersonnelTypeFilter) => void;
}) {
  const selectedJobsite = jobsiteOptions.find((jobsite) => jobsite.id === selectedJobsiteId);
  const employees = rows.filter((row) => row.personType === "employee").length;
  const contractors = rows.filter((row) => row.personType === "contractor").length;

  return (
    <SectionCard
      eyebrow="Workforce Readiness"
      title="Readiness Chart"
      description="Filter the picture-style readiness chart by job/project and personnel without changing the detailed compliance table below."
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Job / Project
          <select
            value={selectedJobsiteId}
            onChange={(event) => onJobsiteChange(event.target.value)}
            className={`mt-1 w-full ${appNativeSelectClassName}`}
          >
            <option value="">All jobs / projects</option>
            {jobsiteOptions.map((jobsite) => (
              <option key={jobsite.id} value={jobsite.id}>
                {jobsite.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Personnel Search
          <input
            type="search"
            value={personnelSearch}
            onChange={(event) => onPersonnelSearchChange(event.target.value)}
            placeholder="Name, email, trade, company, job"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          />
        </label>
        <label className="text-sm font-medium text-[var(--app-text-strong)]">
          Personnel Type
          <select
            value={personnelType}
            onChange={(event) => onPersonnelTypeChange(event.target.value as ReadinessPersonnelTypeFilter)}
            className={`mt-1 w-full ${appNativeSelectClassName}`}
          >
            <option value="all">All personnel</option>
            <option value="employee">Employees</option>
            <option value="contractor">Contractors</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
          {rows.length} visible of {allRowsCount} readiness rows
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
          {employees} employee{employees === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
          {contractors} contractor{contractors === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
          {selectedJobsite ? selectedJobsite.name : "All jobs / projects"}
        </span>
      </div>

      <div className="mt-4">
        {loaded && loading ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            Updating readiness chart...
          </p>
        ) : null}
        {!loaded && loading ? (
          <InlineMessage tone="neutral">Loading readiness chart...</InlineMessage>
        ) : error ? (
          <InlineMessage tone="error">{error}</InlineMessage>
        ) : rows.length === 0 ? (
          <InlineMessage tone="neutral">
            No readiness chart rows match the selected job and personnel filters.
          </InlineMessage>
        ) : (
          <ReadinessChartPreview rows={rows} />
        )}
      </div>
    </SectionCard>
  );
}

function ReadinessMatrixPanel({
  rows,
  summary,
  loading,
  loaded,
  error,
  aiReview,
  aiLoading,
  aiMessage,
  onRefresh,
  onRunAi,
}: {
  rows: ReadinessRow[];
  summary: ReadinessSummary | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  aiReview: ReadinessAiReview | null;
  aiLoading: boolean;
  aiMessage: string | null;
  onRefresh: () => void;
  onRunAi: () => void;
}) {
  const safeSummary = summary ?? summarizeReadinessRows(rows);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/55 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Readiness Matrix</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-300">
            Employees and jobsite contractor employees are scored from training rules, credential dates,
            contractor training records, inductions, and contractor document blockers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh readiness"}
          </button>
          <button
            type="button"
            onClick={onRunAi}
            disabled={aiLoading || loading || rows.length === 0}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            {aiLoading ? "Reviewing..." : "Run AI readiness review"}
          </button>
        </div>
      </div>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {aiMessage ? <InlineMessage tone="neutral">{aiMessage}</InlineMessage> : null}
      {aiReview ? (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-sm text-cyan-50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-cyan-300 px-2.5 py-1 text-xs font-bold text-cyan-950">
              AI Review
            </span>
            {aiReview.overallScore != null ? (
              <span className="font-mono text-lg font-bold">{aiReview.overallScore}/100</span>
            ) : null}
            {aiReview.fallbackUsed ? <span className="text-xs text-cyan-200">Fallback used</span> : null}
          </div>
          <p className="mt-2 leading-6 text-cyan-100">{aiReview.summary}</p>
          {aiReview.prioritizedActions.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {aiReview.prioritizedActions.slice(0, 4).map((action) => (
                <li key={action} className="rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-3 py-2">
                  {action}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Ready", value: safeSummary.ready, status: "ready" as const },
          { label: "Expiring", value: safeSummary.expiringSoon, status: "expiring_soon" as const },
          { label: "Gaps", value: safeSummary.gap, status: "gap" as const },
          { label: "Blocked", value: safeSummary.blocked, status: "blocked" as const },
          { label: "Needs review", value: safeSummary.needsReview, status: "needs_review" as const },
        ].map(({ label, value, status }) => (
          <div key={label} className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 ring-1 ${readinessToneClass(status)}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{label}</p>
            <p className="mt-2 font-mono text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {!loaded && loading ? (
        <InlineMessage tone="neutral">Loading readiness matrix...</InlineMessage>
      ) : rows.length === 0 ? (
        <InlineMessage tone="neutral">No readiness rows are available for the selected filters.</InlineMessage>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90">
                <th className="min-w-[240px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Worker</th>
                <th className="min-w-[150px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Status</th>
                <th className="min-w-[180px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Scope</th>
                <th className="min-w-[260px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Blocking / gap reasons</th>
                <th className="min-w-[220px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const topIssues = [...row.blockers, ...row.gaps, ...row.expiring, ...row.reviewItems].slice(0, 3);
                return (
                  <tr key={row.id} className="border-b border-zinc-800/80">
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-white">{row.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">{row.email || row.personId}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-300">
                          {row.personType}
                        </span>
                        {row.contractorName ? (
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                            {row.contractorName}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${readinessToneClass(row.status)}`}>
                        {readinessStatusText(row.status)}
                      </span>
                      <div className="mt-2 font-mono text-xs text-zinc-500">Score {row.readinessScore}</div>
                      {row.ai?.explanation ? (
                        <p className="mt-2 text-xs leading-5 text-cyan-200">{row.ai.explanation}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-xs leading-5 text-zinc-300">
                      <div>{row.trade}</div>
                      <div>{row.position}</div>
                      {row.jobsiteName ? <div className="text-zinc-500">{row.jobsiteName}</div> : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {topIssues.length > 0 ? (
                        <ul className="space-y-1.5 text-xs leading-5 text-zinc-300">
                          {topIssues.map((issue, index) => (
                            <li key={`${row.id}-${issue.type}-${index}`}>{issue.detail}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-zinc-500">No active issues.</span>
                      )}
                      {row.operationalSignals?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {row.operationalSignals.slice(0, 3).map((signal) => (
                            <span
                              key={`${row.id}-${signal.type}-${signal.label}`}
                              className={
                                signal.severity === "high"
                                  ? "rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-200 ring-1 ring-red-500/30"
                                  : "rounded-full bg-sky-500/12 px-2 py-0.5 text-[10px] font-bold text-sky-200 ring-1 ring-sky-500/25"
                              }
                              title={signal.detail}
                            >
                              {signal.label} ({signal.count})
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-xs leading-5 text-zinc-300">
                      {row.recommendedNextAction}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TrainingMatrixPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOfflineDemoUi = process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [filters, setFilters] = useState<MatrixFilters>({
    trades: [],
    subTrades: [],
    taskCodes: [],
  });
  const [selectedTradeFilter, setSelectedTradeFilter] = useState("");
  const [selectedSubTradeFilter, setSelectedSubTradeFilter] = useState("");
  const [selectedTaskCodeFilter, setSelectedTaskCodeFilter] = useState("");
  const [selectedJobsiteFilter, setSelectedJobsiteFilter] = useState("");
  const [readinessJobsites, setReadinessJobsites] = useState<MatrixJobsiteOption[]>([]);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelTypeFilter, setPersonnelTypeFilter] = useState<ReadinessPersonnelTypeFilter>("all");
  const [matrixPersonTypeFilter, setMatrixPersonTypeFilter] = useState<"all" | "licensed_user" | "tracked_employee">("all");
  const [matrixViewMode, setMatrixViewMode] = useState<MatrixViewMode>("readiness");
  const [stage1MatrixMode, setStage1MatrixMode] = useState<Stage1MatrixMode>("worker");
  const [stage1Search, setStage1Search] = useState("");
  const [stage1StatusFilter, setStage1StatusFilter] = useState<Stage1StatusFilter>(() => {
    const status = searchParams.get("status");
    if (status === "complete" || status === "expiring_soon" || status === "overdue") return status;
    return "all";
  });
  const [canMutate, setCanMutate] = useState(false);
  const [schemaMigrationNeeded, setSchemaMigrationNeeded] = useState(false);
  const [schemaMigrationBannerDismissed, setSchemaMigrationBannerDismissed] = useState(false);
  const [directoryNoticeDismissed, setDirectoryNoticeDismissed] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [directoryNotice, setDirectoryNotice] = useState<string | null>(null);
  /** Start true: we auto-fetch on mount so the first paint shows loading, not an empty “not loaded” shell. */
  const [loading, setLoading] = useState(true);
  const [workspaceDataLoaded, setWorkspaceDataLoaded] = useState(false);
  const [readinessRows, setReadinessRows] = useState<ReadinessRow[]>([]);
  const [readinessSummary, setReadinessSummary] = useState<ReadinessSummary | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [readinessLoaded, setReadinessLoaded] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<ReadinessAiReview | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewMessage, setAiReviewMessage] = useState<string | null>(null);
  const [notificationTestLoading, setNotificationTestLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );

  const [newProfileCertSelect, setNewProfileCertSelect] = useState("");
  const [newProfileCertCustom, setNewProfileCertCustom] = useState("");
  const [newApplyTrades, setNewApplyTrades] = useState<string[]>([]);
  const [newApplyPositions, setNewApplyPositions] = useState<string[]>([]);
  const [newRenewalMonths, setNewRenewalMonths] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProfileCertSelect, setEditProfileCertSelect] = useState("");
  const [editProfileCertCustom, setEditProfileCertCustom] = useState("");
  const [editApplyTrades, setEditApplyTrades] = useState<string[]>([]);
  const [editApplyPositions, setEditApplyPositions] = useState<string[]>([]);
  const [editRenewalMonths, setEditRenewalMonths] = useState("");

  const { density, setDensity, isCompact } = useTableDensity();
  const selectedWorkerId = searchParams.get("workerId") ?? "";
  const selectedWorkerTab = readWorkerProfileTab(searchParams.get("workerTab"));
  const selectedWorkerProfile = useMemo<WorkerProfileRecord | null>(() => {
    const row = rows.find((item) => item.userId === selectedWorkerId);
    return row ? buildWorkerProfileFromMatrixRow(row) : null;
  }, [rows, selectedWorkerId]);
  const updateWorkerProfileQuery = useCallback(
    (workerId: string | null, tab: WorkerProfileTab = selectedWorkerTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (workerId) {
        next.set("workerId", workerId);
        next.set("workerTab", tab);
      } else {
        next.delete("workerId");
        next.delete("workerTab");
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, selectedWorkerTab]
  );

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem(SCHEMA_MIGRATION_BANNER_DISMISSED_KEY) === "1"
      ) {
        setSchemaMigrationBannerDismissed(true);
      }
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem(DIRECTORY_NOTICE_DISMISSED_KEY) === "1"
      ) {
        setDirectoryNoticeDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "complete" || status === "expiring_soon" || status === "overdue") {
      setStage1StatusFilter(status);
    }
  }, [searchParams]);

  const dismissSchemaMigrationBanner = useCallback(() => {
    setSchemaMigrationBannerDismissed(true);
    try {
      window.localStorage.setItem(SCHEMA_MIGRATION_BANNER_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const dismissDirectoryNotice = useCallback(() => {
    setDirectoryNoticeDismissed(true);
    try {
      window.localStorage.setItem(DIRECTORY_NOTICE_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const loadReadiness = useCallback(async () => {
    setReadinessLoading(true);
    setReadinessError(null);
    setAiReviewMessage(null);
    setAiReview(null);

    if (isOfflineDemoUi) {
      const demo = buildOfflineDemoMatrixPayload(selectedTradeFilter);
      const demoRows = demo.rows.map((row) =>
        buildEmployeeReadinessRow({
          requirements: demo.requirements.map((requirement) => ({
            id: requirement.id,
            title: requirement.title,
            matchKeywords: requirement.matchKeywords,
          })),
          row,
          jobsiteId: selectedJobsiteFilter || null,
          jobsiteName: selectedJobsiteFilter ? "Demo Project" : null,
        })
      );
      setReadinessRows(demoRows);
      setReadinessSummary(summarizeReadinessRows(demoRows));
      setReadinessJobsites(demo.filters.jobsites ?? []);
      setReadinessLoading(false);
      setReadinessLoaded(true);
      return;
    }

    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (selectedTradeFilter) params.set("trade", selectedTradeFilter);
      if (selectedSubTradeFilter) params.set("subTrade", selectedSubTradeFilter);
      if (selectedTaskCodeFilter) params.set("taskCode", selectedTaskCodeFilter);
      if (selectedJobsiteFilter) params.set("jobsiteId", selectedJobsiteFilter);
      const query = params.toString();
      const res = await fetch(`/api/company/training-matrix/readiness${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            rows?: ReadinessRow[];
            summary?: ReadinessSummary;
            filters?: MatrixFilters;
            metadata?: { directoryNotice?: string | null; schemaMigrationNeeded?: boolean };
          }
        | null;
      if (!res.ok) {
        setReadinessRows([]);
        setReadinessSummary(summarizeReadinessRows([]));
        setReadinessError(sanitizeApiErrorMessage(data?.error || "Failed to load readiness matrix."));
        return;
      }
      const nextRows = data?.rows ?? [];
      setReadinessRows(nextRows);
      setReadinessSummary(data?.summary ?? summarizeReadinessRows(nextRows));
      setReadinessJobsites((current) => mergeJobsiteOptions(current, data?.filters?.jobsites ?? []));
      if (data?.metadata?.directoryNotice) setDirectoryNotice(data.metadata.directoryNotice);
      if (typeof data?.metadata?.schemaMigrationNeeded === "boolean") {
        setSchemaMigrationNeeded(data.metadata.schemaMigrationNeeded);
      }
    } catch (e) {
      setReadinessRows([]);
      setReadinessSummary(summarizeReadinessRows([]));
      setReadinessError(
        sanitizeApiErrorMessage(e instanceof Error ? e.message : "Failed to load readiness matrix.")
      );
    } finally {
      setReadinessLoading(false);
      setReadinessLoaded(true);
    }
  }, [
    isOfflineDemoUi,
    selectedJobsiteFilter,
    selectedSubTradeFilter,
    selectedTaskCodeFilter,
    selectedTradeFilter,
  ]);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setMessage("");
    if (isOfflineDemoUi) {
      const demo = buildOfflineDemoMatrixPayload(selectedTradeFilter);
      setRequirements(demo.requirements);
      setRows(demo.rows);
      setFilters(demo.filters);
      setReadinessJobsites(demo.filters.jobsites ?? []);
      setCanMutate(false);
      setSchemaMigrationNeeded(false);
      setWarning(null);
      setDirectoryNotice(null);
      setMessage("");
      setMessageTone("neutral");
      setLoading(false);
      setWorkspaceDataLoaded(true);
      return;
    }
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (selectedTradeFilter) params.set("trade", selectedTradeFilter);
      if (selectedSubTradeFilter) params.set("subTrade", selectedSubTradeFilter);
      if (selectedTaskCodeFilter) params.set("taskCode", selectedTaskCodeFilter);
      const query = params.toString();
      const res = await fetch(`/api/company/training-matrix${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            requirements?: Requirement[];
            rows?: MatrixRow[];
            warning?: string | null;
            directoryNotice?: string | null;
            schemaMigrationNeeded?: boolean;
            filters?: MatrixFilters;
            capabilities?: { canMutate?: boolean };
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(sanitizeApiErrorMessage(data?.error || "Failed to load training matrix."));
        setRequirements([]);
        setRows([]);
        setFilters({ trades: [], subTrades: [], taskCodes: [] });
        setSchemaMigrationNeeded(false);
        setWarning(null);
        setDirectoryNotice(null);
        return;
      }

      setSchemaMigrationNeeded(Boolean(data?.schemaMigrationNeeded));

      setRequirements(
        (data?.requirements ?? []).map((r) => ({
          ...r,
          applyTrades: r.applyTrades ?? [],
          applyPositions: r.applyPositions ?? [],
          applySubTrades: r.applySubTrades ?? [],
          applyTaskCodes: r.applyTaskCodes ?? [],
          renewalMonths: r.renewalMonths ?? null,
          isGenerated: Boolean(r.isGenerated),
          generatedSourceType: r.generatedSourceType ?? null,
          generatedSourceDocumentId: r.generatedSourceDocumentId ?? null,
          generatedSourceOperationKey: r.generatedSourceOperationKey ?? null,
          category: r.category ?? "General",
          renewalPeriodDays: r.renewalPeriodDays ?? null,
          courseOwner: r.courseOwner ?? "Safety team",
          courseVersion: r.courseVersion ?? "Current",
          requiresEvidence: r.requiresEvidence ?? true,
        }))
      );
      setFilters(data?.filters ?? { trades: [], subTrades: [], taskCodes: [] });
      setReadinessJobsites((current) => mergeJobsiteOptions(current, data?.filters?.jobsites ?? []));
      setRows(
        (data?.rows ?? []).map((row) => ({
          ...row,
          cells: Object.entries(row.cells ?? {}).reduce<Record<string, MatrixCellState>>((acc, [k, v]) => {
            acc[k] = normalizeCellState(v);
            return acc;
          }, {}),
          cellDetails: (row.cellDetails ?? {}) as Record<string, MatrixCellDetail>,
          certificationInventory: (row.certificationInventory ?? []) as CertificationInventoryItem[],
          profileFields: {
            tradeSpecialty: row.profileFields?.tradeSpecialty ?? "",
            jobTitle: row.profileFields?.jobTitle ?? "",
            readinessStatus: row.profileFields?.readinessStatus ?? "",
            yearsExperience:
              row.profileFields?.yearsExperience !== undefined &&
              row.profileFields?.yearsExperience !== null
                ? row.profileFields.yearsExperience
                : null,
          },
          workerType: row.workerType ?? (row.personType === "tracked_employee" ? "External Worker" : "Employee"),
          loginAccessStatus: row.loginAccessStatus ?? (row.personType === "tracked_employee" ? "No Portal Access" : "Active User"),
          companyOrDepartment: row.companyOrDepartment ?? "",
          jobTitleOrTrade: row.jobTitleOrTrade ?? "",
          assignedJobsites: row.assignedJobsites ?? [],
          supervisorOrManager: row.supervisorOrManager ?? "",
          readinessStatus: row.readinessStatus ?? "",
          trainingStatus: row.trainingStatus ?? "",
          permitExposureStatus: row.permitExposureStatus ?? "",
          accessStatus: row.accessStatus ?? "",
          lastUpdated: row.lastUpdated ?? null,
          trainingRequirements: row.trainingRequirements ?? [],
          trainingSummary: row.trainingSummary,
        }))
      );
      setCanMutate(Boolean(data?.capabilities?.canMutate));
      setWarning(data?.warning ?? null);
      setDirectoryNotice(data?.directoryNotice ?? null);
    } catch (e) {
      setMessageTone("error");
      setMessage(
        sanitizeApiErrorMessage(
          e instanceof Error ? e.message : "Failed to load training matrix."
        )
      );
      setRequirements([]);
      setRows([]);
      setFilters({ trades: [], subTrades: [], taskCodes: [] });
      setSchemaMigrationNeeded(false);
      setWarning(null);
      setDirectoryNotice(null);
    } finally {
      setLoading(false);
      setWorkspaceDataLoaded(true);
    }
  }, [isOfflineDemoUi, selectedSubTradeFilter, selectedTaskCodeFilter, selectedTradeFilter]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReadiness();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReadiness]);

  const handleTradeFilterChange = useCallback((value: string) => {
    setSelectedTradeFilter(value);
    setSelectedSubTradeFilter("");
    setSelectedTaskCodeFilter("");
  }, []);

  const handleSubTradeFilterChange = useCallback((value: string) => {
    setSelectedSubTradeFilter(value);
    setSelectedTaskCodeFilter("");
  }, []);

  const sendTrainingExpirationTest = useCallback(async () => {
    if (isOfflineDemoUi) {
      setMessageTone("warning");
      setMessage("Email notification tests are not available in offline demo mode.");
      return;
    }

    setNotificationTestLoading(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/training-expiration-notifications/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            status?: "sent" | "skipped" | "failed";
            realExpirationItemsSeen?: number;
            warning?: string | null;
          }
        | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(sanitizeApiErrorMessage(data?.error || "Training notification test failed."));
        return;
      }

      const itemCount =
        typeof data?.realExpirationItemsSeen === "number"
          ? ` Current real expiration candidates: ${data.realExpirationItemsSeen}.`
          : "";
      setMessageTone(data?.status === "sent" ? "success" : "warning");
      setMessage(
        sanitizeApiErrorMessage(
          `${data?.message || data?.warning || "Training notification test complete."}${itemCount}`
        )
      );
    } catch (e) {
      setMessageTone("error");
      setMessage(
        sanitizeApiErrorMessage(
          e instanceof Error ? e.message : "Training notification test failed."
        )
      );
    } finally {
      setNotificationTestLoading(false);
    }
  }, [isOfflineDemoUi]);

  const runAiReadinessReview = useCallback(async () => {
    if (readinessRows.length === 0) {
      setAiReviewMessage("Load readiness rows before running AI review.");
      return;
    }
    setAiReviewLoading(true);
    setAiReviewMessage(null);
    try {
      const token = await getAccessToken();
      const rowsForReview = readinessRows
        .filter((row) => row.status !== "ready")
        .slice(0, 80);
      const res = await fetch("/api/company/training-matrix/readiness/ai-review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: readinessSummary ?? summarizeReadinessRows(readinessRows),
          rows: rowsForReview.length ? rowsForReview : readinessRows.slice(0, 40),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; review?: ReadinessAiReview }
        | null;
      if (!res.ok || !data?.review) {
        setAiReviewMessage(sanitizeApiErrorMessage(data?.error || "AI readiness review failed."));
        return;
      }
      setAiReview(data.review);
      const reviewedRows = applyAiReviewToReadinessRows(readinessRows, data.review);
      setReadinessRows(reviewedRows);
      setReadinessSummary(summarizeReadinessRows(reviewedRows));
      if (data.review.fallbackUsed) {
        setAiReviewMessage("AI was unavailable, so deterministic readiness results remain the source of truth.");
      }
    } catch (e) {
      setAiReviewMessage(
        sanitizeApiErrorMessage(e instanceof Error ? e.message : "AI readiness review failed.")
      );
    } finally {
      setAiReviewLoading(false);
    }
  }, [readinessRows, readinessSummary]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/company/training-requirements", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: composeRequirementTitle(
            resolvedTrainingFromCertPicker(newProfileCertSelect, newProfileCertCustom),
            newApplyPositions
          ),
          keywords: resolvedTrainingFromCertPicker(newProfileCertSelect, newProfileCertCustom),
          matchFields: ["certifications"],
          applyTrades: newApplyTrades,
          applyPositions: newApplyPositions,
          renewalMonths: parseRenewalMonthsInput(newRenewalMonths),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        schemaWarning?: string | null;
      } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create requirement.");
        setSaving(false);
        return;
      }
      if (data?.schemaWarning) {
        setMessageTone("warning");
        setMessage(`Requirement added. ${data.schemaWarning}`);
      } else {
        setMessageTone("success");
        setMessage("Requirement added.");
      }
      setNewProfileCertSelect("");
      setNewProfileCertCustom("");
      setNewApplyTrades([]);
      setNewApplyPositions([]);
      setNewRenewalMonths("");
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to create requirement.");
    }
    setSaving(false);
  }, [
    loadMatrix,
    newApplyPositions,
    newApplyTrades,
    newProfileCertCustom,
    newProfileCertSelect,
    newRenewalMonths,
  ]);

  const startEdit = useCallback((r: Requirement) => {
    if (r.isGenerated) return;
    setEditingId(r.id);
    const parsed = parseRequirementTitleForEdit(r.title, r.applyPositions ?? []);
    const certUi = certPickerStateFromTrainingLine(parsed.trainingLine);
    setEditProfileCertSelect(certUi.select);
    setEditProfileCertCustom(certUi.custom);
    setEditApplyTrades([...(r.applyTrades ?? [])]);
    setEditApplyPositions(parsed.positions);
    setEditRenewalMonths(
      r.renewalMonths != null && r.renewalMonths > 0 ? String(r.renewalMonths) : ""
    );
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    setSaving(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/company/training-requirements/${editingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: composeRequirementTitle(
            resolvedTrainingFromCertPicker(editProfileCertSelect, editProfileCertCustom),
            editApplyPositions
          ),
          keywords: resolvedTrainingFromCertPicker(editProfileCertSelect, editProfileCertCustom),
          matchFields: ["certifications"],
          applyTrades: editApplyTrades,
          applyPositions: editApplyPositions,
          renewalMonths: parseRenewalMonthsInput(editRenewalMonths),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        schemaWarning?: string | null;
      } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update requirement.");
        setSaving(false);
        return;
      }
      if (data?.schemaWarning) {
        setMessageTone("warning");
        setMessage(`Requirement updated. ${data.schemaWarning}`);
      } else {
        setMessageTone("success");
        setMessage("Requirement updated.");
      }
      setEditingId(null);
      await loadMatrix();
    } catch (e) {
      setMessageTone("error");
      setMessage(e instanceof Error ? e.message : "Failed to update requirement.");
    }
    setSaving(false);
  }, [
    editApplyPositions,
    editApplyTrades,
    editProfileCertCustom,
    editProfileCertSelect,
    editRenewalMonths,
    editingId,
    loadMatrix,
  ]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this training requirement?")) return;
      setSaving(true);
      setMessage("");
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/company/training-requirements/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setMessageTone("error");
          setMessage(data?.error || "Failed to delete requirement.");
          setSaving(false);
          return;
        }
        setMessageTone("success");
        setMessage("Requirement removed.");
        await loadMatrix();
      } catch (e) {
        setMessageTone("error");
        setMessage(e instanceof Error ? e.message : "Failed to delete requirement.");
      }
      setSaving(false);
    },
    [loadMatrix]
  );

  const matrixTableLayout = useMemo(
    () => ({
      thFirst: isCompact
        ? "training-sticky-divider sticky left-0 z-10 min-w-[200px] max-w-[260px] bg-zinc-900 px-2 py-2 text-[11px] font-semibold text-zinc-200"
        : "training-sticky-divider sticky left-0 z-10 min-w-[260px] max-w-[320px] bg-zinc-900 px-4 py-3 font-semibold text-zinc-200",
      thReq: isCompact
        ? "min-w-[120px] border-l border-zinc-800 px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
        : "min-w-[156px] border-l border-zinc-800 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400",
      thCert: isCompact
        ? "min-w-[220px] border-l border-zinc-800 px-2 py-2 text-[11px] font-semibold text-zinc-200"
        : "min-w-[300px] border-l border-zinc-800 px-3 py-3 font-semibold text-zinc-200",
      tdFirst: isCompact
        ? "training-sticky-divider sticky left-0 z-10 min-w-[200px] max-w-[260px] bg-zinc-950 px-2 py-2 align-top"
        : "training-sticky-divider sticky left-0 z-10 min-w-[260px] max-w-[320px] bg-zinc-950 px-4 py-3 align-top",
      tdCell: isCompact
        ? "border-l border-zinc-800/80 px-1.5 py-1.5 align-top text-center"
        : "border-l border-zinc-800/80 px-2 py-2 align-top text-center",
      tdCert: isCompact
        ? "border-l border-zinc-800/80 px-2 py-2 align-top"
        : "border-l border-zinc-800/80 px-3 py-3 align-top",
      icon: isCompact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0",
    }),
    [isCompact]
  );

  const filteredMatrixRows = useMemo(() => {
    if (matrixPersonTypeFilter === "all") return rows;
    return rows.filter((row) => (row.personType ?? "licensed_user") === matrixPersonTypeFilter);
  }, [matrixPersonTypeFilter, rows]);

  const licensedMatrixRows = rows.filter(
    (row) => (row.personType ?? "licensed_user") !== "tracked_employee"
  ).length;
  const trackedMatrixRows = rows.filter((row) => row.personType === "tracked_employee").length;

  const trackerStats = useMemo(() => {
    if (!filteredMatrixRows.length || !requirements.length) return null;
    let met = 0;
    let gap = 0;
    let na = 0;
    for (const row of filteredMatrixRows) {
      for (const r of requirements) {
        const s = row.cells[r.id] ?? "gap";
        if (s === "match") met++;
        else if (s === "na") na++;
        else gap++;
      }
    }
    return { met, gap, na, total: met + gap + na };
  }, [filteredMatrixRows, requirements]);

  const coordinatorQueue = useMemo(
    () => buildTrainingMatrixActionQueue(filteredMatrixRows, requirements),
    [filteredMatrixRows, requirements]
  );

  const attentionCountByUser = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of coordinatorQueue) {
      counts.set(item.userId, (counts.get(item.userId) ?? 0) + 1);
    }
    return counts;
  }, [coordinatorQueue]);

  const attentionCountByRequirement = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of coordinatorQueue) {
      if (!item.requirementId) continue;
      counts.set(item.requirementId, (counts.get(item.requirementId) ?? 0) + 1);
    }
    return counts;
  }, [coordinatorQueue]);

  const visibleMatrixRequirements = useMemo(() => {
    if (matrixViewMode === "readiness" || matrixViewMode === "all") return requirements;
    return requirements.filter((requirement) =>
      filteredMatrixRows.some((row) => {
        const state = row.cells[requirement.id] ?? "gap";
        const detail = row.cellDetails?.[requirement.id];
        if (matrixViewMode === "gaps") return state === "gap";
        return (
          state === "match" &&
          detail?.matchSource === "certifications" &&
          (detail.expiryStatus === "soon" || detail.expiryStatus === "none")
        );
      })
    );
  }, [filteredMatrixRows, matrixViewMode, requirements]);

  const filteredReadinessChartRows = useMemo(
    () =>
      filterReadinessRowsForChart(readinessRows, {
        personnelSearch,
        personnelType: personnelTypeFilter,
      }),
    [personnelSearch, personnelTypeFilter, readinessRows]
  );

  const matrixViewOptions: Array<{ value: MatrixViewMode; label: string; count: number }> = [
    { value: "readiness", label: "Readiness", count: readinessSummary?.total ?? readinessRows.length },
    { value: "all", label: "All", count: requirements.length },
    {
      value: "gaps",
      label: "Only gaps",
      count: requirements.filter((requirement) =>
        filteredMatrixRows.some((row) => (row.cells[requirement.id] ?? "gap") === "gap")
      ).length,
    },
    {
      value: "expiring",
      label: "Expiring / no date",
      count: requirements.filter((requirement) =>
        filteredMatrixRows.some((row) => {
          const detail = row.cellDetails?.[requirement.id];
          return (
            (row.cells[requirement.id] ?? "gap") === "match" &&
            detail?.matchSource === "certifications" &&
            (detail.expiryStatus === "soon" || detail.expiryStatus === "none")
          );
        })
      ).length,
    },
  ];

  return (
    <div className="training-matrix-light space-y-8">
      <section className="training-hero-surface overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-accent-primary)]">
              Company workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--app-text-strong)] sm:text-4xl">
              Training matrix
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--app-text)]">
              Track certification requirements, verify worker readiness, and move directly from compliance
              gaps into the workflows that resolve them. This page is organized around one sequence:
              attention, rules, filters, and the live matrix.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => {
                void loadMatrix();
                void loadReadiness();
              }}
              disabled={loading || readinessLoading}
              className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {loading || readinessLoading
                ? workspaceDataLoaded
                  ? "Refreshing…"
                  : "Loading…"
                : "Refresh data"}
            </button>
            <Link
              href="/company-onboarding"
              className={appButtonSecondaryClassName}
            >
              Import roster/training
            </Link>
            {canMutate ? (
              <button
                type="button"
                onClick={() => void sendTrainingExpirationTest()}
                disabled={notificationTestLoading}
                className={`${appButtonSecondaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {notificationTestLoading ? "Sending test..." : "Send test email"}
              </button>
            ) : null}
            <Link
              href="/dashboard"
              className={appButtonSecondaryClassName}
            >
              Back to dashboard
            </Link>
            <TableDensityToggle
              value={density}
              onChange={setDensity}
              disabled={loading}
              className="sm:ml-0"
            />
          </div>
        </div>
      </section>

      <SectionCard
        eyebrow="Today / Attention"
        title="Compliance attention"
        description="Start with the current compliance picture, then move into requirements, filters, and the detailed matrix below."
        tone="attention"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            eyebrow="Workspace roster"
            title="People tracked"
            value={String(rows.length)}
            detail="People currently included in the workspace compliance view."
            tone="attention"
          />
          <MetricTile
            eyebrow="Requirement set"
            title="Requirements"
            value={String(requirements.length)}
            detail="Configured training rules, including generated task-scoped items."
          />
          <MetricTile
            eyebrow="Current coverage"
            title="Met checks"
            value={trackerStats ? String(trackerStats.met) : "-"}
            detail={
              trackerStats
                ? `${trackerStats.gap} gaps and ${trackerStats.na} not-applicable checks in the current matrix.`
                : "Compliance totals appear after the matrix loads."
            }
          />
          <MetricTile
            eyebrow="Workflow focus"
            title="Next action"
            value={
              requirements.length === 0
                ? "Add rule"
                : coordinatorQueue.length > 0
                  ? `${coordinatorQueue.length} actions`
                  : "Audit ledger"
            }
            detail={
              coordinatorQueue.length > 0
                ? "Work the coordinator queue first, then use the matrix for detail."
                : "No active coordinator actions in the current matrix."
            }
          />
        </div>
      </SectionCard>

      <CoordinatorQueue
        queue={coordinatorQueue}
        requirements={requirements}
        loading={loading}
        onRefresh={() => void loadMatrix()}
      />

      {!isOfflineDemoUi ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CompanyAiAssistPanel
            surface="training_matrix"
            title="Training assistant"
            structuredContext={JSON.stringify({
              requirements: requirements.length,
              people: rows.length,
              met: trackerStats?.met,
              gap: trackerStats?.gap,
              coordinatorActions: coordinatorQueue.length,
            })}
          />
          <CompanyMemoryBankPanel />
        </div>
      ) : null}

      {schemaMigrationNeeded && !schemaMigrationBannerDismissed ? (
        <SchemaMigrationBanner onDismiss={dismissSchemaMigrationBanner} />
      ) : null}
      {directoryNotice && !directoryNoticeDismissed ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div className="min-w-0 flex-1">
            <InlineMessage tone="neutral">{directoryNotice}</InlineMessage>
          </div>
          <button
            type="button"
            onClick={dismissDirectoryNotice}
            className="shrink-0 self-end rounded-lg border border-[rgba(198,212,236,0.9)] bg-[rgba(255,255,255,0.96)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] shadow-sm hover:bg-[var(--app-accent-surface-08)] sm:mt-2 sm:self-start"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {warning ? <InlineMessage tone="warning">{warning}</InlineMessage> : null}
      {message ? (
        <InlineMessage
          tone={messageTone}
          onRetry={messageTone === "error" ? () => void loadMatrix() : undefined}
        >
          {message}
        </InlineMessage>
      ) : null}

      <SectionCard
        eyebrow="Supporting Context"
        title="Context filters"
        description="Use trade, subtrade, and task filters to activate task-scoped requirements generated from selected CSEP work."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-[var(--app-text-strong)]">
            Trade
            <select
              value={selectedTradeFilter}
              onChange={(e) => handleTradeFilterChange(e.target.value)}
              className={`mt-1 w-full ${appNativeSelectClassName}`}
            >
              <option value="">All trades</option>
              {filters.trades.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--app-text-strong)]">
            Subtrade
            <select
              value={selectedSubTradeFilter}
              onChange={(e) => handleSubTradeFilterChange(e.target.value)}
              className={`mt-1 w-full ${appNativeSelectClassName}`}
            >
              <option value="">All subtrades</option>
              {filters.subTrades.map((subTrade) => (
                <option key={subTrade} value={subTrade}>
                  {subTrade}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--app-text-strong)]">
            Task
            <select
              value={selectedTaskCodeFilter}
              onChange={(e) => setSelectedTaskCodeFilter(e.target.value)}
              className={`mt-1 w-full ${appNativeSelectClassName}`}
            >
              <option value="">All tasks</option>
              {filters.taskCodes.map((task) => (
                <option key={task.value} value={task.value}>
                  {task.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <ReadinessChartSection
        rows={filteredReadinessChartRows}
        allRowsCount={readinessRows.length}
        loading={readinessLoading}
        loaded={readinessLoaded}
        error={readinessError}
        jobsiteOptions={readinessJobsites}
        selectedJobsiteId={selectedJobsiteFilter}
        onJobsiteChange={setSelectedJobsiteFilter}
        personnelSearch={personnelSearch}
        onPersonnelSearchChange={setPersonnelSearch}
        personnelType={personnelTypeFilter}
        onPersonnelTypeChange={setPersonnelTypeFilter}
      />

      <Stage1ComplianceGrid
        rows={rows}
        requirements={requirements}
        mode={stage1MatrixMode}
        onModeChange={setStage1MatrixMode}
        search={stage1Search}
        onSearchChange={setStage1Search}
        statusFilter={stage1StatusFilter}
        onStatusFilterChange={setStage1StatusFilter}
        onOpenProfile={(workerId, tab = "summary") => updateWorkerProfileQuery(workerId, tab)}
      />

      {canMutate ? (
        <SectionCard
          eyebrow="Work Area"
          title="Required trainings"
          description="Pick a certification from the same list workers use on their construction profile, then choose trades and positions. The saved title adds positions in parentheses."
          tone="elevated"
        >
          <label className="block text-sm font-medium text-[var(--app-text-strong)]">
            Training requirement
            <select
              value={newProfileCertSelect}
              onChange={(e) => {
                const v = e.target.value;
                setNewProfileCertSelect(v);
                if (v !== CUSTOM_PROFILE_CERT_VALUE) setNewProfileCertCustom("");
              }}
              className={`mt-1 w-full ${appNativeSelectClassName}`}
            >
              <option value="">Select from profile certifications…</option>
              {PROFILE_CERTIFICATION_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.items.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM_PROFILE_CERT_VALUE}>Other (not in list)…</option>
            </select>
            {newProfileCertSelect === CUSTOM_PROFILE_CERT_VALUE ? (
              <input
                value={newProfileCertCustom}
                onChange={(e) => setNewProfileCertCustom(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.18)]"
                placeholder="Custom name — should match text on profiles"
              />
            ) : null}
            <span className="mt-1 block text-xs font-normal text-[var(--app-muted)]">
              Matching uses this certification text against each person’s profile. Positions you add
              below are included in the column title.
            </span>
          </label>
          <PickTradesAndPositions
            trades={newApplyTrades}
            positions={newApplyPositions}
            onTradesChange={setNewApplyTrades}
            onPositionsChange={setNewApplyPositions}
            variant="default"
          />
          <label className="mt-4 block text-sm font-medium text-[var(--app-text-strong)]">
            Typical renewal (months, optional)
            <input
              type="number"
              min={1}
              max={600}
              value={newRenewalMonths}
              onChange={(e) => setNewRenewalMonths(e.target.value)}
              placeholder="e.g. 36"
              className="mt-1 w-full max-w-[200px] rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.18)]"
            />
            <span className="mt-1 block text-xs font-normal text-[var(--app-muted)]">
              Policy hint for your team. Actual compliance still uses each worker’s expiration dates on their
              construction profile.
            </span>
          </label>
          <div className="mt-4">
            <button
              type="button"
              disabled={
                saving ||
                !resolvedTrainingFromCertPicker(newProfileCertSelect, newProfileCertCustom).trim() ||
                newApplyTrades.length === 0 ||
                newApplyPositions.length === 0
              }
              onClick={() => void handleCreate()}
              className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {saving ? "Saving…" : "Add requirement"}
            </button>
          </div>

          {requirements.length > 0 ? (
            <ul className="mt-6 space-y-3 border-t border-[var(--app-border)] pt-6">
              {requirements.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4"
                >
                  {editingId === r.id && !r.isGenerated ? (
                    <div className="grid gap-3">
                      <label className="block text-xs font-semibold text-slate-400">
                        Training requirement
                        <select
                          value={editProfileCertSelect}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditProfileCertSelect(v);
                            if (v !== CUSTOM_PROFILE_CERT_VALUE) setEditProfileCertCustom("");
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-normal text-slate-100"
                        >
                          <option value="">Select from profile certifications…</option>
                          {PROFILE_CERTIFICATION_GROUPS.map((group) => (
                            <optgroup key={group.title} label={group.title}>
                              {group.items.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value={CUSTOM_PROFILE_CERT_VALUE}>Other (not in list)…</option>
                        </select>
                        {editProfileCertSelect === CUSTOM_PROFILE_CERT_VALUE ? (
                          <input
                            value={editProfileCertCustom}
                            onChange={(e) => setEditProfileCertCustom(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-600 px-3 py-2 text-sm font-normal"
                            placeholder="Custom certification name"
                          />
                        ) : null}
                      </label>
                      <PickTradesAndPositions
                        trades={editApplyTrades}
                        positions={editApplyPositions}
                        onTradesChange={setEditApplyTrades}
                        onPositionsChange={setEditApplyPositions}
                        variant="compact"
                      />
                      <label className="block text-xs font-semibold text-slate-400">
                        Typical renewal (months, optional)
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={editRenewalMonths}
                          onChange={(e) => setEditRenewalMonths(e.target.value)}
                          placeholder="Clear to remove"
                          className="mt-1 w-full max-w-[180px] rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-sm font-normal text-slate-100"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          disabled={
                            saving ||
                            !resolvedTrainingFromCertPicker(
                              editProfileCertSelect,
                              editProfileCertCustom
                            ).trim() ||
                            editApplyTrades.length === 0 ||
                            editApplyPositions.length === 0
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-slate-100">{r.title}</div>
                          {r.isGenerated ? (
                            <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                              Generated
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{requirementScopeCaption(r) || "All scopes"}</div>
                        {r.isGenerated && r.generatedSourceType ? (
                          <div className="mt-1 text-xs text-cyan-200/80">
                            Source: {r.generatedSourceType.replace(/_/g, " ")}
                          </div>
                        ) : null}
                        {r.renewalMonths != null && r.renewalMonths > 0 ? (
                          <div className="mt-1 text-xs font-medium text-sky-100">
                            Typical renewal: {r.renewalMonths} mo
                          </div>
                        ) : null}
                        <div className="mt-1 text-sm text-slate-400">
                          {r.matchKeywords.join(" · ")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          disabled={Boolean(r.isGenerated)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r.id)}
                          disabled={Boolean(r.isGenerated)}
                          className="rounded-lg border border-red-500/35 px-3 py-1.5 text-sm font-semibold text-red-200 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {workspaceDataLoaded
                ? "No requirements yet. Add at least one to populate matrix columns."
                : "Loading requirements…"}
            </p>
          )}
        </SectionCard>
      ) : null}

      <ComplianceCommandCenter
        rows={rows}
        requirements={requirements}
        loading={loading}
        workspaceDataLoaded={workspaceDataLoaded}
        warning={warning}
        isCompact={isCompact}
        onRefresh={() => void loadMatrix()}
        footer={
          !loading && filteredMatrixRows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>
                <span className="font-semibold text-zinc-300">{filteredMatrixRows.length}</span> people in this workspace
              </span>
              {trackerStats ? (
                <>
                  <span className="hidden sm:inline text-zinc-600" aria-hidden>
                    ·
                  </span>
                  <span>
                    <span className="font-semibold text-emerald-400">{trackerStats.met}</span> met ·{" "}
                    <span className="font-semibold text-fuchsia-400">{trackerStats.gap}</span> gaps ·{" "}
                    <span className="font-semibold text-zinc-500">{trackerStats.na}</span> not applicable
                  </span>
                  <span className="hidden sm:inline text-zinc-600" aria-hidden>
                    ·
                  </span>
                  <span>{trackerStats.total} requirement checks total</span>
                </>
              ) : null}
            </div>
          ) : null
        }
      >
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/55 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Matrix View</p>
            <p className="mt-1 text-xs text-zinc-500">
              {visibleMatrixRequirements.length} of {requirements.length} requirement columns visible
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {matrixViewOptions.map((option) => {
              const active = matrixViewMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMatrixViewMode(option.value)}
                  className={
                    active
                      ? "rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-zinc-950"
                      : "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                  }
                >
                  {option.label} ({option.count})
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/55 p-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">People</span>
          {[
            { value: "all" as const, label: "All", count: rows.length },
            { value: "licensed_user" as const, label: "Licensed users", count: licensedMatrixRows },
            { value: "tracked_employee" as const, label: "Tracked employee, no license", count: trackedMatrixRows },
          ].map((option) => {
            const active = matrixPersonTypeFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMatrixPersonTypeFilter(option.value)}
                className={
                  active
                    ? "rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-zinc-950"
                    : "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                }
              >
                {option.label} ({option.count})
              </button>
            );
          })}
        </div>
        {matrixViewMode === "readiness" ? (
          <ReadinessMatrixPanel
            rows={readinessRows}
            summary={readinessSummary}
            loading={readinessLoading}
            loaded={readinessLoaded}
            error={readinessError}
            aiReview={aiReview}
            aiLoading={aiReviewLoading}
            aiMessage={aiReviewMessage}
            onRefresh={() => void loadReadiness()}
            onRunAi={() => void runAiReadinessReview()}
          />
        ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
          <table
            className={`min-w-full border-collapse text-left ${isCompact ? "text-xs" : "text-sm"}`}
          >
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90">
                <th className={matrixTableLayout.thFirst}>
                  Person & field profile
                </th>
                {visibleMatrixRequirements.map((r) => {
                  const attentionCount = attentionCountByRequirement.get(r.id) ?? 0;
                  return (
                    <th
                      key={r.id}
                      className={matrixTableLayout.thReq}
                      title={requirementHeaderTitle(r)}
                    >
                      <span className="line-clamp-2">{r.title}</span>
                      {attentionCount > 0 ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-500/35">
                          {attentionCount} action{attentionCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </th>
                  );
                })}
                <th className={matrixTableLayout.thCert}>
                  On-profile certs
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMatrixRows.map((row) => {
                const positionRollup = buildPositionRollup(row, requirements);
                const attentionCount = attentionCountByUser.get(row.userId) ?? 0;
                return (
                  <tr key={row.userId} className="border-b border-zinc-800/80 bg-zinc-950/30">
                    <td className={matrixTableLayout.tdFirst}>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-white">{row.name}</div>
                        {attentionCount > 0 ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-500/35">
                            {attentionCount} need{attentionCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">
                            Clear
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">{row.email || row.userId}</div>
                      {row.personType === "tracked_employee" ? (
                        <div className="mt-2 inline-flex rounded-full bg-cyan-500/12 px-2 py-0.5 text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-500/25">
                          {row.licenseStatus || "Tracked employee, no license"}
                        </div>
                      ) : null}
                      <dl className="mt-2 space-y-1 text-xs text-zinc-300">
                        <div className="flex gap-1">
                          <dt className="shrink-0 font-semibold text-zinc-500">Position</dt>
                          <dd className="min-w-0">{row.profileFields.jobTitle || "—"}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="shrink-0 font-semibold text-zinc-500">Trade</dt>
                          <dd className="min-w-0">{row.profileFields.tradeSpecialty || "—"}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="shrink-0 font-semibold text-zinc-500">Readiness</dt>
                          <dd>{readinessLabel(row.profileFields.readinessStatus)}</dd>
                        </div>
                        {row.profileFields.yearsExperience != null ? (
                          <div className="flex gap-1">
                            <dt className="shrink-0 font-semibold text-zinc-500">Experience</dt>
                            <dd>{row.profileFields.yearsExperience} yr</dd>
                          </div>
                        ) : null}
                      </dl>
                      <PositionScopeSummary
                        rollup={positionRollup}
                        requirementsCount={requirements.length}
                        theme="light"
                      />
                      <div className="mt-2 text-[11px] text-zinc-600">Workspace access: {row.role}</div>
                      {row.personType === "tracked_employee" ? (
                        <Link
                          href="/company-onboarding"
                          className="mt-2 inline-block text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          Update tracked record
                        </Link>
                      ) : (
                        <Link
                          href={`/profile?userId=${encodeURIComponent(row.userId)}&returnTo=${encodeURIComponent("/training-matrix")}`}
                          className="mt-2 inline-block text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          Update profile & dates
                        </Link>
                      )}
                    </td>
                    {visibleMatrixRequirements.map((r) => {
                      const state = row.cells[r.id] ?? "gap";
                      const d = row.cellDetails?.[r.id];
                      const tip = requirementCellTitle(r, d, state);
                      return (
                        <td
                          key={r.id}
                          className={matrixTableLayout.tdCell}
                          title={tip}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {state === "match" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">
                                <Check className={matrixTableLayout.icon} aria-hidden />
                                Met
                              </span>
                            ) : state === "na" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500 ring-1 ring-zinc-700">
                                <Minus className={matrixTableLayout.icon} aria-hidden />
                                N/A
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/12 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300 ring-1 ring-fuchsia-500/25">
                                <X className={matrixTableLayout.icon} aria-hidden />
                                Gap
                              </span>
                            )}
                            {state === "match" ? (
                              <>
                                {d?.matchSource === "certifications" && d.matchedLabel ? (
                                  <p className="line-clamp-3 w-full text-[10px] font-medium leading-snug text-zinc-200">
                                    {d.matchedLabel}
                                  </p>
                                ) : d?.matchSource === "job_title" || d?.matchSource === "trade_specialty" ? (
                                  <p className="text-[10px] font-semibold leading-snug text-cyan-300">
                                    Via {d.matchSource === "job_title" ? "position" : "trade"} match
                                  </p>
                                ) : null}
                                {d?.expiryStatus === "soon" ? (
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-500/40">
                                    Expiring soon
                                  </span>
                                ) : null}
                                {(d?.expiryStatus === "soon" || d?.expiryStatus === "ok") && d.expiresOn ? (
                                  <span className="text-[10px] leading-tight text-zinc-500">
                                    {cellExpiryCaption(d)}
                                  </span>
                                ) : null}
                                {d?.matchSource === "certifications" && d.expiryStatus === "none" ? (
                                  <span className="text-[10px] text-zinc-500">No expiry on file</span>
                                ) : null}
                              </>
                            ) : null}
                            {state === "gap" ? (
                              <div className="w-full text-left">
                                <p className="text-[10px] font-bold text-amber-300">Missing</p>
                                {d?.gapKeywords?.length ? (
                                  <p className="mt-0.5 line-clamp-4 text-[10px] leading-snug text-zinc-400">
                                    {d.gapKeywords.join(" · ")}
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-[10px] text-zinc-500">Add matching training</p>
                                )}
                              </div>
                            ) : null}
                            {state === "na" ? (
                              <p className="text-[10px] text-zinc-600">Out of scope</p>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                    <td className={matrixTableLayout.tdCert}>
                      <div className={isCompact ? "space-y-1" : "space-y-2"}>
                        {row.certificationInventory && row.certificationInventory.length > 0 ? (
                          <ul className={isCompact ? "space-y-1" : "space-y-1.5"}>
                            {row.certificationInventory.map((item) => {
                              const t = ledgerChipToneDark(item.expiryStatus);
                              return (
                                <li
                                  key={item.name}
                                  className={`rounded-lg px-2 py-1.5 text-xs ring-1 ${t.wrap}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`}
                                      aria-hidden
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold leading-snug text-white">{item.name}</div>
                                      <div className="mt-0.5 text-[11px] opacity-90">
                                        {item.expiryStatus === "expired" && item.expiresOn
                                          ? `Expired ${item.expiresOn}`
                                          : item.expiryStatus === "soon" && item.expiresOn
                                            ? `Expires ${item.expiresOn} · ${item.daysUntilExpiry}d left`
                                            : item.expiryStatus === "ok" && item.expiresOn
                                              ? `Good through ${item.expiresOn}`
                                              : "No expiration date on file"}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <span className="text-sm text-zinc-600">No certifications on profile.</span>
                        )}
                        {row.unmatchedCertifications.length > 0 ? (
                          <div className="border-t border-dashed border-zinc-700 pt-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300">
                              Not applied to any requirement
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.unmatchedCertifications.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200 ring-1 ring-violet-500/40"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </ComplianceCommandCenter>
      <WorkerProfileDrawer
        profile={selectedWorkerProfile}
        activeTab={selectedWorkerTab}
        onTabChange={(tab) => updateWorkerProfileQuery(selectedWorkerId, tab)}
        onClose={() => updateWorkerProfileQuery(null)}
      />
    </div>
  );
}
