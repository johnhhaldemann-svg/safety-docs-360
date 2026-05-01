"use client";

import * as Tabs from "@radix-ui/react-tabs";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  Flag,
  History,
  ListFilter,
  Menu,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TableDensityToggle } from "@/components/app-shell/TableDensityToggle";
import { FieldMetricBarChart } from "@/components/metrics/FieldMetricBarChart";
import { FieldMetricRankedList } from "@/components/metrics/FieldMetricRankedList";
import { FieldMetricTrendChart } from "@/components/metrics/FieldMetricTrendChart";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import {
  formatRelative,
  useCompanyWorkspaceData,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import { RiskMemoryFormFields } from "@/components/risk-memory/RiskMemoryFormFields";
import {
  EMPTY_RISK_MEMORY_FORM,
  buildRiskMemoryApiObject,
  type RiskMemoryFormInput,
} from "@/lib/riskMemory/form";
import {
  buildFieldIssueImportTemplateXlsx,
  parseFieldIssueExcelBuffer,
  type FieldIssueImportRowErr,
  type FieldIssueImportRowOk,
} from "@/lib/fieldIssues/excelImport";
import {
  buildFieldIssueAnalytics,
  type AnalyticsStatusKey,
  type TrendGranularity,
} from "@/lib/fieldIssueAnalytics";
import { useTableDensity } from "@/hooks/useTableDensity";
import { fieldIdMatrixTableLayout } from "@/lib/tableDensityLayout";

const supabase = getSupabaseBrowserClient();

type FieldIssueLogTab = "board" | "analytics";
type CorrectionHubView = "consolidated" | "location" | "mine" | "overdue" | "completed";
function fieldIssueLogTabFromSearchParams(searchParams: URLSearchParams): FieldIssueLogTab {
  const raw = (searchParams.get("tab") ?? "").trim().toLowerCase();
  if (raw === "analytics" || raw === "metrics") {
    return "analytics";
  }
  return "board";
}

type CorrectiveActionRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  category:
    | "hazard"
    | "near_miss"
    | "incident"
    | "good_catch"
    | "ppe_violation"
    | "housekeeping"
    | "equipment_issue"
    | "fall_hazard"
    | "electrical_hazard"
    | "excavation_trench_concern"
    | "fire_hot_work_concern"
    | "corrective_action";
  status:
    | "open"
    | "assigned"
    | "in_progress"
    | "corrected"
    | "verified_closed"
    | "escalated"
    | "stop_work";
  assigned_user_id: string | null;
  due_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  manager_override_close: boolean;
  manager_override_reason: string | null;
  evidence_count?: number;
  latest_evidence_path?: string | null;
  priority?: "low" | "medium" | "high" | "critical" | null;
  observation_type?: "positive" | "negative" | "near_miss" | null;
  sif_potential?: boolean | null;
  sif_category?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  immediate_action_required?: boolean | null;
  time_to_close_hours?: number | null;
  created_at: string;
  updated_at: string;
};

type CreateActionState = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  observationType: "positive" | "negative" | "near_miss";
  sifPotential: "" | "yes" | "no";
  sifCategory:
    | ""
    | "fall_from_height"
    | "struck_by"
    | "caught_between"
    | "electrical"
    | "excavation_collapse"
    | "confined_space"
    | "hazardous_energy"
    | "crane_rigging"
    | "line_of_fire";
  jobsiteId: string;
  assignedUserId: string;
  dueAt: string;
  dapActivityId: string;
  workflowStatus:
    | "open"
    | "assigned"
    | "in_progress"
    | "corrected"
    | "verified_closed"
    | "escalated"
    | "stop_work";
  riskMemory: RiskMemoryFormInput;
};

type EvidenceComposerState = {
  file: File | null;
};

type EvidenceRow = {
  id: string;
  action_id: string;
  company_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
};

type SafetySubmissionRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  severity: CorrectiveActionRow["severity"];
  category: CorrectiveActionRow["category"];
  photo_path: string | null;
  submitted_by: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  linked_action_id: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_CREATE_ACTION: CreateActionState = {
  title: "",
  description: "",
  severity: "medium",
  observationType: "negative",
  sifPotential: "",
  sifCategory: "",
  jobsiteId: "",
  assignedUserId: "",
  dueAt: "",
  dapActivityId: "",
  workflowStatus: "open",
  riskMemory: { ...EMPTY_RISK_MEMORY_FORM },
};

type DapActivityOption = {
  id: string;
  dap_id: string;
  activity_name: string;
  status: string;
  trade?: string | null;
  area?: string | null;
  hazard_category?: string | null;
  permit_required?: boolean;
  permit_type?: string | null;
  jobsite_id?: string | null;
};

const EMPTY_EVIDENCE_COMPOSER: EvidenceComposerState = {
  file: null,
};

function getSeverityTone(severity: CorrectiveActionRow["severity"]) {
  if (severity === "critical" || severity === "high") return "error" as const;
  if (severity === "medium") return "warning" as const;
  return "info" as const;
}

function getStatusTone(status: CorrectiveActionRow["status"]) {
  if (status === "open") return "warning" as const;
  if (status === "assigned") return "info" as const;
  if (status === "in_progress") return "info" as const;
  if (status === "corrected") return "warning" as const;
  if (status === "escalated" || status === "stop_work") return "error" as const;
  return "success" as const;
}

function getStatusLabel(status: CorrectiveActionRow["status"]) {
  if (status === "assigned") return "Assigned";
  if (status === "in_progress") return "In Progress";
  if (status === "corrected") return "Corrected";
  if (status === "verified_closed") return "Verified Closed";
  if (status === "escalated") return "Escalated";
  if (status === "stop_work") return "Stop Work";
  return "Open";
}

function getStatusChartClasses(status: CorrectiveActionRow["status"]) {
  if (status === "verified_closed") {
    return {
      bar: "bg-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]",
      chip: "border-emerald-400/30 bg-emerald-950/40 text-emerald-200",
    };
  }
  if (status === "escalated" || status === "stop_work") {
    return {
      bar: "bg-rose-400 shadow-[0_0_0_1px_rgba(251,113,133,0.18)]",
      chip: "border-rose-400/30 bg-rose-950/40 text-rose-200",
    };
  }
  if (status === "corrected") {
    return {
      bar: "bg-amber-300 shadow-[0_0_0_1px_rgba(252,211,77,0.18)]",
      chip: "border-amber-300/30 bg-amber-950/40 text-amber-100",
    };
  }
  if (status === "assigned" || status === "in_progress") {
    return {
      bar: "bg-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]",
      chip: "border-sky-400/30 bg-sky-950/40 text-sky-200",
    };
  }
  return {
    bar: "bg-violet-300 shadow-[0_0_0_1px_rgba(196,181,253,0.18)]",
    chip: "border-violet-300/30 bg-violet-950/40 text-violet-100",
  };
}

function getSeverityLabel(severity: CorrectiveActionRow["severity"]) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function getCategoryLabel(category: CorrectiveActionRow["category"]) {
  const labels: Record<CorrectiveActionRow["category"], string> = {
    hazard: "Hazard",
    near_miss: "Near Miss",
    incident: "Incident",
    good_catch: "Good Catch",
    ppe_violation: "PPE Violation",
    housekeeping: "Housekeeping",
    equipment_issue: "Equipment Issue",
    fall_hazard: "Fall Hazard",
    electrical_hazard: "Electrical Hazard",
    excavation_trench_concern: "Excavation / Trench Concern",
    fire_hot_work_concern: "Fire / Hot Work Concern",
    corrective_action: "Corrective Action",
  };
  return labels[category];
}

function isActiveIssue(item: CorrectiveActionRow) {
  return item.status !== "verified_closed";
}

function isHighPriorityIssue(item: CorrectiveActionRow) {
  return (
    isActiveIssue(item) &&
    (item.priority === "high" ||
      item.priority === "critical" ||
      item.severity === "high" ||
      item.severity === "critical" ||
      Boolean(item.immediate_action_required))
  );
}

function getPriorityLabel(item: CorrectiveActionRow) {
  if (isHighPriorityIssue(item)) return "High";
  if (item.severity === "medium") return "Medium";
  return "Low";
}

function getObservationTypeLabel(item: CorrectiveActionRow) {
  if (item.observation_type === "positive") return "Good Catch";
  if (item.observation_type === "near_miss") return "Near Miss";
  return getCategoryLabel(item.category);
}

function buildReportId(item: CorrectiveActionRow) {
  const createdAt = new Date(item.created_at);
  const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();
  const shortId = item.id.replace(/-/g, "").slice(0, 4).toUpperCase().padEnd(4, "0");
  return `OBS-${year}-${shortId}`;
}

function formatReportedDate(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function getAuthHeaders() {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;
  if (!accessToken) {
    throw new Error("Missing auth token.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatDateInput(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

function formatPercentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getAnalyticsStatusLabel(status: AnalyticsStatusKey) {
  if (status === "overdue") return "Overdue";
  return getStatusLabel(status);
}

function getAnalyticsStatusChartClasses(status: AnalyticsStatusKey) {
  if (status === "overdue") {
    return {
      bar: "bg-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.18)]",
      chip: "border-orange-400/30 bg-orange-950/40 text-orange-200",
    };
  }
  return getStatusChartClasses(status);
}

function getSeverityChartClasses(severity: CorrectiveActionRow["severity"]) {
  if (severity === "critical") {
    return "bg-rose-400 shadow-[0_0_0_1px_rgba(251,113,133,0.18)]";
  }
  if (severity === "high") {
    return "bg-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.18)]";
  }
  if (severity === "medium") {
    return "bg-amber-300 shadow-[0_0_0_1px_rgba(252,211,77,0.18)]";
  }
  return "bg-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]";
}

function getOverdueAgingLabel(bucket: "1_3" | "4_7" | "8_14" | "15_plus") {
  if (bucket === "1_3") return "1-3 days";
  if (bucket === "4_7") return "4-7 days";
  if (bucket === "8_14") return "8-14 days";
  return "15+ days";
}

function AnalyticsMetricCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-3 text-4xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{note}</div>
    </div>
  );
}

function RepeatIssueList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ key: string; label: string; count: number }>;
  emptyLabel: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.length < 1 ? (
          <div className="rounded-xl border border-dashed border-slate-700/80 px-3 py-4 text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-3"
            >
              <div className="min-w-0 flex-1 truncate text-sm text-slate-200" title={row.label}>
                {row.label}
              </div>
              <div className="shrink-0 text-sm font-black tabular-nums text-white">{row.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function FieldIdExchangePage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fieldIssueLogTab = useMemo(() => fieldIssueLogTabFromSearchParams(searchParams), [searchParams]);

  const commitFieldIssueLogTab = useCallback(
    (next: FieldIssueLogTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "board") {
        params.delete("tab");
      } else {
        params.set("tab", "analytics");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const {
    companyName,
    companyLocation,
    jobsites,
    companyUsers,
    referenceTime,
  } = useCompanyWorkspaceData();

  const [actions, setActions] = useState<CorrectiveActionRow[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [jobsiteFilter, setJobsiteFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [correctionHubView, setCorrectionHubView] = useState<CorrectionHubView>("consolidated");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openRowActionMenuId, setOpenRowActionMenuId] = useState<string | null>(null);
  const [analyticsStartDate, setAnalyticsStartDate] = useState(() =>
    formatDateInput(subtractDays(Date.now(), 89))
  );
  const [analyticsEndDate, setAnalyticsEndDate] = useState(() => formatDateInput(Date.now()));
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("week");
  const [composer, setComposer] = useState<CreateActionState>(EMPTY_CREATE_ACTION);
  const [showAdvancedComposer, setShowAdvancedComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);
  const [openEvidenceComposerId, setOpenEvidenceComposerId] = useState<string | null>(null);
  const [evidenceComposer, setEvidenceComposer] =
    useState<EvidenceComposerState>(EMPTY_EVIDENCE_COMPOSER);
  const [openingProofActionId, setOpeningProofActionId] = useState<string | null>(null);
  const [openProofHistoryActionId, setOpenProofHistoryActionId] = useState<string | null>(null);
  const [proofHistoryByActionId, setProofHistoryByActionId] = useState<
    Record<string, EvidenceRow[]>
  >({});
  const [loadingProofHistoryActionId, setLoadingProofHistoryActionId] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<SafetySubmissionRow[]>([]);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [dapActivities, setDapActivities] = useState<DapActivityOption[]>([]);
  const [contractors, setContractors] = useState<Array<{ id: string; name: string }>>([]);
  const [crews, setCrews] = useState<Array<{ id: string; name: string }>>([]);
  const [importParse, setImportParse] = useState<{
    fileName: string;
    ok: FieldIssueImportRowOk[];
    errors: FieldIssueImportRowErr[];
  } | null>(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importRunSummary, setImportRunSummary] = useState<{
    created: number;
    apiFailures: { sheetRow: number; message: string }[];
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetchWithTimeout("/api/company/contractors", { headers }, 12000);
        const data = (await res.json().catch(() => null)) as { contractors?: Array<{ id: string; name: string }> } | null;
        if (res.ok && data?.contractors) setContractors(data.contractors);
      } catch {
        /* optional */
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const q = composer.jobsiteId?.trim()
          ? `?jobsiteId=${encodeURIComponent(composer.jobsiteId.trim())}`
          : "";
        const res = await fetchWithTimeout(`/api/company/crews${q}`, { headers }, 12000);
        const data = (await res.json().catch(() => null)) as { crews?: Array<{ id: string; name: string }> } | null;
        if (res.ok && data?.crews) setCrews(data.crews);
      } catch {
        /* optional */
      }
    })();
  }, [composer.jobsiteId]);

  useEffect(() => {
    let ignore = false;

    async function loadActions() {
      setLoadingActions(true);
      setHasLoaded(true);
      try {
        const headers = await getAuthHeaders();
        const [actionsResponse, submissionsResponse, activitiesResponse] = await Promise.all([
          fetchWithTimeout("/api/company/corrective-actions", { headers }, 15000),
          fetchWithTimeout("/api/company/safety-submissions?status=pending", { headers }, 15000),
          fetchWithTimeout("/api/company/jsa-activities", { headers }, 15000),
        ]);
        const actionsPayload = (await actionsResponse.json().catch(() => null)) as
          | { actions?: CorrectiveActionRow[]; observations?: CorrectiveActionRow[]; error?: string }
          | null;
        const submissionsPayload = (await submissionsResponse.json().catch(() => null)) as
          | { submissions?: SafetySubmissionRow[]; error?: string }
          | null;
        const activitiesPayload = (await activitiesResponse.json().catch(() => null)) as
          | { activities?: DapActivityOption[] }
          | null;
        if (!ignore) {
          if (!actionsResponse.ok) {
            setActions([]);
            setMessage(actionsPayload?.error || "Unable to load corrective actions.");
            setMessageTone("error");
          } else {
            setActions(actionsPayload?.actions ?? actionsPayload?.observations ?? []);
            setPendingSubmissions(
              submissionsResponse.ok ? submissionsPayload?.submissions ?? [] : []
            );
            setDapActivities(activitiesResponse.ok ? activitiesPayload?.activities ?? [] : []);
    const preselectedActivity = searchParams.get("jsaActivityId")?.trim() ?? "";
            if (preselectedActivity) {
              const activity = (activitiesPayload?.activities ?? []).find(
                (item) => item.id === preselectedActivity
              );
              const prefilledTitle = activity
                ? `${activity.area || "General"} - ${activity.activity_name || "Planned Activity"}`
                : "";
              const prefilledDescription = activity
                ? [
                    activity.trade ? `Trade: ${activity.trade}` : null,
                    activity.area ? `Area: ${activity.area}` : null,
                    activity.activity_name ? `Activity: ${activity.activity_name}` : null,
                    activity.hazard_category ? `Hazard Category: ${activity.hazard_category}` : null,
                    `Permit Required: ${activity.permit_required ? "Yes" : "No"}`,
                    activity.permit_type ? `Permit Type: ${activity.permit_type}` : null,
                  ]
                    .filter(Boolean)
                    .join(" | ")
                : "";
              setComposer((current) => ({
                ...current,
                dapActivityId: preselectedActivity,
                title: current.title || prefilledTitle,
                description: current.description || prefilledDescription,
                jobsiteId: current.jobsiteId || activity?.jobsite_id || "",
              }));
              setShowAdvancedComposer(true);
            }
          }
        }
      } catch (error) {
        if (!ignore) {
          console.error("Failed to load corrective actions:", error);
          setActions([]);
          setMessage(
            error instanceof Error && error.name === "AbortError"
              ? "Load timed out. Please refresh the page."
              : "Unable to load corrective actions right now."
          );
          setMessageTone("error");
        }
      } finally {
        if (!ignore) {
          setLoadingActions(false);
        }
      }
    }

    void loadActions();
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  const assigneeLabelById = useMemo(() => {
    const next = new Map<string, string>();
    for (const user of companyUsers) {
      next.set(user.id, user.name || user.email);
    }
    return next;
  }, [companyUsers]);

  const fieldIssueEmailToUserId = useMemo(() => {
    const next = new Map<string, string>();
    for (const user of companyUsers) {
      next.set(user.email.trim().toLowerCase(), user.id);
    }
    return next;
  }, [companyUsers]);

  const jobsiteNameById = useMemo(() => {
    const next = new Map<string, string>();
    for (const jobsite of jobsites) {
      next.set(jobsite.id, jobsite.name);
    }
    return next;
  }, [jobsites]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return actions.filter((item) => {
      const actionJobsite = item.jobsite_id ? (jobsiteNameById.get(item.jobsite_id) ?? "") : "";
      const matchesJobsite = jobsiteFilter === "all" || actionJobsite === jobsiteFilter;
      const matchesCategory =
        categoryFilter === "all" || getCategoryLabel(item.category) === categoryFilter;
      const statusLabel = getStatusLabel(item.status);
      const matchesStatus = statusFilter === "all" || statusLabel === statusFilter;
      const ownerLabel = item.assigned_user_id
        ? (assigneeLabelById.get(item.assigned_user_id) ?? "Assigned User")
        : "Unassigned";
      const reporterLabel =
        (item.created_by ? assigneeLabelById.get(item.created_by) : null) ??
        (item.updated_by ? assigneeLabelById.get(item.updated_by) : null) ??
        ownerLabel;
      const matchesSearch =
        !normalizedSearch ||
        [
          buildReportId(item),
          item.title,
          item.description || "",
          ownerLabel,
          reporterLabel,
          actionJobsite || "General Workspace",
          getSeverityLabel(item.severity),
          getObservationTypeLabel(item),
          statusLabel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesJobsite && matchesCategory && matchesStatus && matchesSearch;
    });
  }, [
    actions,
    assigneeLabelById,
    categoryFilter,
    jobsiteFilter,
    jobsiteNameById,
    normalizedSearch,
    statusFilter,
  ]);

  const openCount = filteredItems.filter(
    (item) => item.status === "open" || item.status === "assigned"
  ).length;
  const inProgressCount = filteredItems.filter((item) => item.status === "in_progress").length;
  const overdueCount = filteredItems.filter(
    (item) =>
      item.status !== "verified_closed" &&
      item.due_at &&
      new Date(item.due_at).getTime() < referenceTime
  ).length;
  const coveredJobsites = new Set(
    filteredItems
      .map((item) => (item.jobsite_id ? jobsiteNameById.get(item.jobsite_id) ?? "" : "General Workspace"))
      .filter(Boolean)
  ).size;
  const openObservationsCount = filteredItems.filter(isActiveIssue).length;
  const highPriorityCount = filteredItems.filter(isHighPriorityIssue).length;
  const sifPotentialCount = filteredItems.filter(
    (item) => isActiveIssue(item) && Boolean(item.sif_potential)
  ).length;
  const awaitingClosureCount = filteredItems.filter((item) => item.status === "corrected").length;
  const todayStart = new Date(referenceTime);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const nextWeekEnd = new Date(todayStart);
  nextWeekEnd.setDate(todayStart.getDate() + 7);
  const dueTodayCount = filteredItems.filter((item) => {
    if (!isActiveIssue(item) || !item.due_at) return false;
    const dueTime = new Date(item.due_at).getTime();
    return dueTime >= todayStart.getTime() && dueTime < tomorrowStart.getTime();
  }).length;
  const dueThisWeekCount = filteredItems.filter((item) => {
    if (!isActiveIssue(item) || !item.due_at) return false;
    const dueTime = new Date(item.due_at).getTime();
    return dueTime >= todayStart.getTime() && dueTime < nextWeekEnd.getTime();
  }).length;
  const completedCount = filteredItems.filter((item) => item.status === "verified_closed").length;
  const correctionHubItems = useMemo(() => {
    if (correctionHubView === "mine") {
      const activeItems = filteredItems.filter(isActiveIssue);
      return currentUserId
        ? activeItems.filter((item) => item.assigned_user_id === currentUserId)
        : activeItems;
    }
    if (correctionHubView === "overdue") {
      return filteredItems.filter(
        (item) =>
          isActiveIssue(item) &&
          Boolean(item.due_at) &&
          new Date(item.due_at as string).getTime() < referenceTime
      );
    }
    if (correctionHubView === "completed") {
      return filteredItems.filter((item) => item.status === "verified_closed");
    }
    return filteredItems.filter(isActiveIssue);
  }, [correctionHubView, currentUserId, filteredItems, referenceTime]);
  const groupedHubItems = useMemo(() => {
    const groups = new Map<string, CorrectiveActionRow[]>();
    for (const item of filteredItems.filter(isActiveIssue)) {
      const location = item.jobsite_id
        ? (jobsiteNameById.get(item.jobsite_id) ?? "Jobsite")
        : "General Workspace";
      groups.set(location, [...(groups.get(location) ?? []), item]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems, jobsiteNameById]);
  const activityItems = filteredItems.map((item) => ({
    id: item.id,
    title: item.title,
    detail: `${getSeverityLabel(item.severity)} severity · ${getStatusLabel(item.status)}`,
    meta: `Updated ${formatRelative(item.updated_at, referenceTime)}`,
    tone: getSeverityTone(item.severity),
  }));

  const categoryCounts = useMemo(() => {
    const categories = [
      "Hazard",
      "Near Miss",
      "Incident",
      "Good Catch",
      "PPE Violation",
      "Housekeeping",
      "Equipment Issue",
      "Fall Hazard",
      "Electrical Hazard",
      "Excavation / Trench Concern",
      "Fire / Hot Work Concern",
      "Corrective Action",
    ];
    return categories.map((label) => ({
      label,
      count: filteredItems.filter((item) => getCategoryLabel(item.category) === label).length,
    }));
  }, [filteredItems]);

  function renderSharedFilters() {
    return (
      <div className="grid gap-3 lg:grid-cols-4">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search issue, assignee, or severity..."
          aria-label="Search observations by issue, assignee, or severity"
          className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
        />
        <select
          value={jobsiteFilter}
          onChange={(event) => setJobsiteFilter(event.target.value)}
          className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
        >
          <option value="all">All jobsites</option>
          {[...jobsites.map((jobsite) => jobsite.name)].map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
        >
          <option value="all">All statuses</option>
          <option value="Open">Open</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Corrected">Corrected</option>
          <option value="Escalated">Escalated</option>
          <option value="Stop Work">Stop Work</option>
          <option value="Verified Closed">Verified Closed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
        >
          <option value="all">All categories</option>
          {categoryCounts.map((category) => (
            <option key={category.label} value={category.label}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderMetricsFilters() {
    return (
      <div className="space-y-3">
        {renderSharedFilters()}
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Start date
            </span>
            <input
              type="date"
              value={analyticsStartDate}
              onChange={(event) => setAnalyticsStartDate(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none focus:border-sky-500"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              End date
            </span>
            <input
              type="date"
              value={analyticsEndDate}
              onChange={(event) => setAnalyticsEndDate(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none focus:border-sky-500"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Trend granularity
            </span>
            <select
              value={trendGranularity}
              onChange={(event) => setTrendGranularity(event.target.value as TrendGranularity)}
              className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
        </div>
      </div>
    );
  }

  const activeMatrix = useMemo(() => {
    const categories: CorrectiveActionRow["category"][] = [
      "hazard",
      "near_miss",
      "incident",
      "good_catch",
      "ppe_violation",
      "housekeeping",
      "equipment_issue",
      "fall_hazard",
      "electrical_hazard",
      "excavation_trench_concern",
      "fire_hot_work_concern",
      "corrective_action",
    ];

    return categories.map((category) => ({
      category,
      open: filteredItems.filter(
        (item) => item.category === category && item.status === "open"
      ).length,
      inProgress: filteredItems.filter(
        (item) => item.category === category && item.status === "in_progress"
      ).length,
      closed: filteredItems.filter(
        (item) => item.category === category && item.status === "verified_closed"
      ).length,
      total: filteredItems.filter((item) => item.category === category).length,
    }));
  }, [filteredItems]);

  const metricsAnalytics = useMemo(
    () =>
      buildFieldIssueAnalytics({
        items: filteredItems,
        sourceItems: filteredItems,
        jobsiteNameById,
        companyLabel: companyName || "Company Workspace",
        referenceTime,
        startDate: analyticsStartDate,
        endDate: analyticsEndDate,
        trendGranularity,
      }),
    [
      analyticsEndDate,
      analyticsStartDate,
      companyName,
      filteredItems,
      jobsiteNameById,
      referenceTime,
      trendGranularity,
    ]
  );

  async function reloadActions() {
    setHasLoaded(true);
    setLoadingActions(true);
    try {
      const headers = await getAuthHeaders();
      const [actionsResponse, submissionsResponse, activitiesResponse] = await Promise.all([
        fetchWithTimeout("/api/company/corrective-actions", { headers }, 15000),
        fetchWithTimeout("/api/company/safety-submissions?status=pending", { headers }, 15000),
        fetchWithTimeout("/api/company/jsa-activities", { headers }, 15000),
      ]);
      const actionsPayload = (await actionsResponse.json().catch(() => null)) as
        | { actions?: CorrectiveActionRow[]; observations?: CorrectiveActionRow[]; error?: string }
        | null;
      const submissionsPayload = (await submissionsResponse.json().catch(() => null)) as
        | { submissions?: SafetySubmissionRow[] }
        | null;
      const activitiesPayload = (await activitiesResponse.json().catch(() => null)) as
        | { activities?: DapActivityOption[] }
        | null;
      if (!actionsResponse.ok) {
        setMessage(actionsPayload?.error || "Unable to load corrective actions.");
        setMessageTone("error");
        return;
      }
      setActions(actionsPayload?.observations ?? actionsPayload?.actions ?? []);
      setPendingSubmissions(submissionsResponse.ok ? submissionsPayload?.submissions ?? [] : []);
      setDapActivities(activitiesResponse.ok ? activitiesPayload?.activities ?? [] : []);
      const preselectedActivity = searchParams.get("jsaActivityId")?.trim() ?? "";
      if (preselectedActivity) {
        const activity = (activitiesPayload?.activities ?? []).find(
          (item) => item.id === preselectedActivity
        );
        const prefilledTitle = activity
          ? `${activity.area || "General"} - ${activity.activity_name || "Planned Activity"}`
          : "";
        const prefilledDescription = activity
          ? [
              activity.trade ? `Trade: ${activity.trade}` : null,
              activity.area ? `Area: ${activity.area}` : null,
              activity.activity_name ? `Activity: ${activity.activity_name}` : null,
              activity.hazard_category ? `Hazard Category: ${activity.hazard_category}` : null,
              `Permit Required: ${activity.permit_required ? "Yes" : "No"}`,
              activity.permit_type ? `Permit Type: ${activity.permit_type}` : null,
            ]
              .filter(Boolean)
              .join(" | ")
          : "";
        setComposer((current) => ({
          ...current,
          dapActivityId: preselectedActivity,
          title: current.title || prefilledTitle,
          description: current.description || prefilledDescription,
          jobsiteId: current.jobsiteId || activity?.jobsite_id || "",
        }));
        setShowAdvancedComposer(true);
      }
    } catch (error) {
      console.error("Failed to reload corrective actions:", error);
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Refresh timed out. Please try again."
          : "Unable to refresh corrective actions right now."
      );
      setMessageTone("error");
    } finally {
      setLoadingActions(false);
    }
  }

  async function reviewSubmission(
    submission: SafetySubmissionRow,
    decision: "approved" | "rejected",
    actionStatus: "open" | "verified_closed"
  ) {
    setReviewingSubmissionId(submission.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/safety-submissions/${submission.id}/review`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          decision,
          actionStatus,
          category: submission.category,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to review submission.");
        setMessageTone("error");
        return;
      }
      setMessage(payload?.message || "Submission reviewed.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to review submission:", error);
      setMessage("Failed to review submission right now.");
      setMessageTone("error");
    } finally {
      setReviewingSubmissionId(null);
    }
  }

  async function createAction() {
    if (!composer.title.trim()) {
      const msg = "Issue title is required.";
      setMessage(msg);
      setMessageTone("error");
      toast.error(msg);
      return;
    }
    if (composer.observationType === "negative" && !composer.sifPotential) {
      const msg = "SIF evaluation is required for negative observations.";
      setMessage(msg);
      setMessageTone("error");
      toast.error(msg);
      return;
    }
    if (composer.observationType === "negative" && composer.sifPotential === "yes" && !composer.sifCategory) {
      const msg = "Select a SIF category.";
      setMessage(msg);
      setMessageTone("error");
      toast.error(msg);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetchWithTimeout("/api/company/corrective-actions", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          title: composer.title,
          description: composer.description,
          severity: composer.severity,
          category:
            composer.observationType === "positive"
              ? "good_catch"
              : composer.observationType === "near_miss"
                ? "near_miss"
                : "hazard",
          jobsiteId: composer.jobsiteId,
          assignedUserId: composer.assignedUserId,
          dueAt: composer.dueAt,
          dapActivityId: composer.dapActivityId,
          status: composer.workflowStatus,
          observationType: composer.observationType,
          sifPotential:
            composer.observationType === "negative"
              ? composer.sifPotential === "yes"
              : undefined,
          sifCategory:
            composer.observationType === "negative" && composer.sifPotential === "yes"
              ? composer.sifCategory
              : undefined,
          ...((): Record<string, unknown> => {
            const rm = buildRiskMemoryApiObject(composer.riskMemory);
            return rm ? { riskMemory: rm } : {};
          })(),
        }),
      }, 15000);
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        if (response.status === 429) {
          const msg = "Request limit reached. Wait a few seconds and try Save again.";
          setMessage(msg);
          setMessageTone("warning");
          toast.warning(msg);
          return;
        }
        const msg = payload?.error || "Failed to create corrective action.";
        setMessage(msg);
        setMessageTone("error");
        toast.error(msg);
        return;
      }
      setComposer(EMPTY_CREATE_ACTION);
      setShowCreatePanel(false);
      const okMsg = payload?.message || "Corrective action created.";
      setMessage(okMsg);
      setMessageTone("success");
      toast.success(okMsg);
      await reloadActions();
    } catch (error) {
      console.error("Failed to create corrective action:", error);
      const msg =
        error instanceof Error && error.name === "AbortError"
          ? "Save timed out. Please try again."
          : "Failed to create corrective action right now.";
      setMessage(msg);
      setMessageTone("error");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function downloadFieldIssueImportTemplate() {
    const bytes = buildFieldIssueImportTemplateXlsx();
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "field-issue-import-template.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function onFieldIssueImportFileSelected(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    setImportRunSummary(null);
    if (!file) {
      setImportParse(null);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const { ok, errors } = parseFieldIssueExcelBuffer(
        buffer,
        jobsites.map((j) => ({ id: j.id, name: j.name })),
        { emailToUserId: fieldIssueEmailToUserId }
      );
      setImportParse({ fileName: file.name, ok, errors });
      if (errors.length && !ok.length) {
        toast.error(
          `Import file has ${errors.length} row error(s). Fix the sheet or download a fresh template.`
        );
      } else if (errors.length) {
        toast.warning(`${ok.length} row(s) ready; ${errors.length} row(s) skipped due to errors.`);
      } else if (ok.length) {
        toast.success(`${ok.length} row(s) ready to import.`);
      } else {
        toast.info("No data rows found in that file.");
      }
    } catch (error) {
      console.error("Field issue import parse failed:", error);
      setImportParse(null);
      toast.error("Could not read that Excel file.");
    }
  }

  async function runFieldIssueExcelImport() {
    if (!importParse?.ok.length) {
      toast.error("No valid rows to import.");
      return;
    }
    setImportRunning(true);
    setImportRunSummary(null);
    const apiFailures: { sheetRow: number; message: string }[] = [];
    let created = 0;
    try {
      const headers = await getAuthHeaders();
      for (const row of importParse.ok) {
        const p = row.payload;
        try {
          const response = await fetchWithTimeout(
            "/api/company/corrective-actions",
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                title: p.title,
                description: p.description ?? "",
                severity: p.severity,
                category: p.category ?? "hazard",
                jobsiteId: p.jobsiteId ?? "",
                assignedUserId: p.assignedUserId ?? "",
                dueAt: p.dueAt ?? "",
                dapActivityId: p.dapActivityId ?? "",
                status: p.status,
                observationType: p.observationType,
                sifPotential:
                  p.observationType === "negative" ? p.sifPotential : undefined,
                sifCategory:
                  p.observationType === "negative" && p.sifPotential
                    ? p.sifCategory
                    : undefined,
              }),
            },
            15000
          );
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          if (!response.ok) {
            if (response.status === 429) {
              apiFailures.push({
                sheetRow: row.sheetRow,
                message: "Rate limited. Wait and re-import remaining rows.",
              });
              break;
            }
            apiFailures.push({
              sheetRow: row.sheetRow,
              message: payload?.error || `Request failed (${response.status}).`,
            });
          } else {
            created += 1;
          }
        } catch (error) {
          apiFailures.push({
            sheetRow: row.sheetRow,
            message:
              error instanceof Error && error.name === "AbortError"
                ? "Request timed out."
                : "Network error.",
          });
        }
      }
      setImportRunSummary({ created, apiFailures });
      if (apiFailures.length === 0) {
        toast.success(`Imported ${created} observation(s).`);
      } else {
        toast.warning(`Created ${created}; ${apiFailures.length} row(s) failed.`);
      }
      setImportParse(null);
      await reloadActions();
    } finally {
      setImportRunning(false);
    }
  }

  async function updateStatus(
    action: CorrectiveActionRow,
    nextStatus: "open" | "assigned" | "in_progress" | "corrected" | "escalated" | "stop_work"
  ) {
    setUpdatingActionId(action.id);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const statusSequence =
        action.status === "open" && nextStatus === "in_progress"
          ? (["assigned", "in_progress"] as const)
          : action.status === "assigned" && nextStatus === "stop_work"
            ? (["in_progress", "stop_work"] as const)
            : ([nextStatus] as const);
      for (const status of statusSequence) {
        const response = await fetch(`/api/company/corrective-actions/${action.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            status,
            workflowStatus: status,
          }),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
        if (!response.ok) {
          setMessage(payload?.error || "Failed to update action status.");
          setMessageTone("error");
          return;
        }
      }
      setMessage("Action status updated.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to update action:", error);
      setMessage("Failed to update action right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function closeAction(actionId: string) {
    const managerOverride = window.confirm(
      "Close with manager override if no photo proof is available?\nSelect Cancel to require photo proof."
    );
    const managerOverrideReason = managerOverride
      ? window.prompt("Enter manager override reason:")?.trim() ?? ""
      : "";
    const closureNote = window.prompt("Closure note (required for SIF observations):")?.trim() ?? "";

    if (managerOverride && !managerOverrideReason) {
      setMessage("Manager override reason is required.");
      setMessageTone("error");
      return;
    }

    setUpdatingActionId(actionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/corrective-actions/${actionId}/close`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          managerOverride,
          managerOverrideReason: managerOverride ? managerOverrideReason : undefined,
          closureNote: closureNote || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to close corrective action.");
        setMessageTone("error");
        return;
      }
      setMessage(payload?.message || "Corrective action closed.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to close corrective action:", error);
      setMessage("Failed to close corrective action right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function convertToIncident(action: CorrectiveActionRow) {
    setUpdatingActionId(action.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/corrective-actions/${action.id}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          convertToIncident: true,
          incidentType: action.category === "near_miss" ? "near_miss" : "incident",
          status: "escalated",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to convert observation into incident.");
        setMessageTone("error");
        return;
      }
      setMessage("Observation escalated and incident record created.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to convert to incident:", error);
      setMessage("Failed to convert observation right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function attachProof(actionId: string) {
    if (!evidenceComposer.file) {
      setMessage("Select a proof photo before saving.");
      setMessageTone("error");
      return;
    }

    setUpdatingActionId(actionId);
    setMessage(null);
    try {
      const uploadUrlResponse = await fetch(`/api/company/corrective-actions/${actionId}/upload-url`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          fileName: evidenceComposer.file.name,
          mimeType: evidenceComposer.file.type || "image/jpeg",
        }),
      });
      const uploadUrlPayload = (await uploadUrlResponse.json().catch(() => null)) as
        | { error?: string; path?: string; token?: string; bucket?: string }
        | null;
      if (!uploadUrlResponse.ok || !uploadUrlPayload?.path || !uploadUrlPayload?.token) {
        setMessage(uploadUrlPayload?.error || "Failed to initialize secure proof upload.");
        setMessageTone("error");
        return;
      }
      const bucket = uploadUrlPayload.bucket || "documents";
      if (uploadUrlPayload.token !== "offline-demo-token") {
        const uploadResult = await supabase.storage
          .from(bucket)
          .uploadToSignedUrl(uploadUrlPayload.path, uploadUrlPayload.token, evidenceComposer.file);
        if (uploadResult.error) {
          setMessage(`Proof upload failed: ${uploadResult.error.message}`);
          setMessageTone("error");
          return;
        }
      }

      const response = await fetch(`/api/company/corrective-actions/${actionId}/evidence`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          filePath: uploadUrlPayload.path,
          fileName: evidenceComposer.file.name,
          mimeType: evidenceComposer.file.type || "image/jpeg",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to attach completion proof.");
        setMessageTone("error");
        return;
      }

      setMessage(payload?.message || "Completion proof attached.");
      setMessageTone("success");
      setOpenEvidenceComposerId(null);
      setEvidenceComposer(EMPTY_EVIDENCE_COMPOSER);
      await reloadActions();
    } catch (error) {
      console.error("Failed to attach completion proof:", error);
      setMessage("Failed to attach completion proof right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function openLatestProof(action: CorrectiveActionRow) {
    if (!action.latest_evidence_path) {
      setMessage("No proof file is available to open yet.");
      setMessageTone("warning");
      return;
    }

    setOpeningProofActionId(action.id);
    setMessage(null);
    try {
      const signed = await supabase.storage
        .from("documents")
        .createSignedUrl(action.latest_evidence_path, 60);
      if (signed.error || !signed.data?.signedUrl) {
        setMessage(signed.error?.message || "Failed to open proof file.");
        setMessageTone("error");
        return;
      }

      window.open(signed.data.signedUrl, "_blank");
    } catch (error) {
      console.error("Failed to open proof file:", error);
      setMessage("Failed to open proof file right now.");
      setMessageTone("error");
    } finally {
      setOpeningProofActionId(null);
    }
  }

  async function openProofFile(actionId: string, filePath: string) {
    setOpeningProofActionId(actionId);
    setMessage(null);
    try {
      const signed = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
      if (signed.error || !signed.data?.signedUrl) {
        setMessage(signed.error?.message || "Failed to open proof file.");
        setMessageTone("error");
        return;
      }
      window.open(signed.data.signedUrl, "_blank");
    } catch (error) {
      console.error("Failed to open proof file:", error);
      setMessage("Failed to open proof file right now.");
      setMessageTone("error");
    } finally {
      setOpeningProofActionId(null);
    }
  }

  async function toggleProofHistory(actionId: string) {
    if (openProofHistoryActionId === actionId) {
      setOpenProofHistoryActionId(null);
      return;
    }

    setOpenProofHistoryActionId(actionId);
    if (proofHistoryByActionId[actionId]) {
      return;
    }

    setLoadingProofHistoryActionId(actionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/corrective-actions/${actionId}/evidence/list`, {
        headers: await getAuthHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as
        | { evidence?: EvidenceRow[]; error?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to load proof history.");
        setMessageTone("error");
        return;
      }

      setProofHistoryByActionId((current) => ({
        ...current,
        [actionId]: payload?.evidence ?? [],
      }));
    } catch (error) {
      console.error("Failed to load proof history:", error);
      setMessage("Failed to load proof history right now.");
      setMessageTone("error");
    } finally {
      setLoadingProofHistoryActionId(null);
    }
  }

  const { density, setDensity, isCompact } = useTableDensity();
  const matrixLayout = useMemo(() => fieldIdMatrixTableLayout(isCompact), [isCompact]);

  const showFieldAnalyticsCharts =
    hasLoaded && !loadingActions && metricsAnalytics.metricsItems.length > 0;

  const fieldAnalyticsJumpLinks: Array<{ href: string; label: string }> = [
    { href: "#fiel-analytics-kpis", label: "Overview" },
    { href: "#fiel-analytics-status", label: "Status" },
    { href: "#fiel-analytics-trends", label: "Trends" },
    { href: "#fiel-analytics-location", label: "Location & aging" },
    { href: "#fiel-analytics-repeat", label: "Repeat patterns" },
    { href: "#fiel-analytics-matrix", label: "Matrix" },
  ];

  const workQueueMetrics = [
    {
      label: "Open Observations",
      value: openObservationsCount,
      note: "Needs review",
      icon: BarChart3,
      color: "text-blue-600",
    },
    {
      label: "High Priority",
      value: highPriorityCount,
      note: "Priority watch",
      icon: Flag,
      color: "text-red-600",
    },
    {
      label: "SIF Potential",
      value: sifPotentialCount,
      note: "Serious injury exposure",
      icon: ShieldAlert,
      color: "text-orange-600",
    },
    {
      label: "Awaiting Closure",
      value: awaitingClosureCount,
      note: "Ready to verify",
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
  ];

  const hubTabs: Array<{ id: CorrectionHubView; label: string }> = [
    { id: "consolidated", label: "Consolidated" },
    { id: "location", label: "Grouped by Location" },
    { id: "mine", label: "My Actions" },
    { id: "overdue", label: `Overdue (${overdueCount})` },
    { id: "completed", label: "Completed" },
  ];
  const hubMetrics = [
    { label: "Overdue", value: overdueCount, tone: "text-red-600" },
    { label: "Due Today", value: dueTodayCount, tone: "text-orange-500" },
    { label: "Due This Week", value: dueThisWeekCount, tone: "text-blue-600" },
    { label: "In Progress", value: inProgressCount, tone: "text-blue-700" },
    { label: "Completed", value: completedCount, tone: "text-emerald-600" },
  ];

  function getLocationLabel(item: CorrectiveActionRow) {
    return item.jobsite_id ? (jobsiteNameById.get(item.jobsite_id) ?? "Jobsite") : "General Workspace";
  }

  function getReporterLabel(item: CorrectiveActionRow) {
    return (
      (item.created_by ? assigneeLabelById.get(item.created_by) : null) ??
      (item.updated_by ? assigneeLabelById.get(item.updated_by) : null) ??
      (item.assigned_user_id ? assigneeLabelById.get(item.assigned_user_id) : null) ??
      "Field User"
    );
  }

  function renderPriorityPill(item: CorrectiveActionRow) {
    const priority = getPriorityLabel(item);
    const className =
      priority === "High"
        ? "border-red-200 bg-red-50 text-red-700"
        : priority === "Medium"
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";
    return (
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${className}`}>
        {priority}
      </span>
    );
  }

  function renderStatusPill(item: CorrectiveActionRow) {
    const className =
      item.status === "verified_closed"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : item.status === "stop_work" || item.status === "escalated"
          ? "border-red-200 bg-red-50 text-red-700"
          : item.status === "corrected"
            ? "border-orange-200 bg-orange-50 text-orange-700"
            : "border-blue-200 bg-blue-50 text-blue-700";
    return (
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${className}`}>
        {getStatusLabel(item.status)}
      </span>
    );
  }

  function renderIssueActionButtons(item: CorrectiveActionRow, compact = false) {
    const buttonClass = compact
      ? "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
    const busy = updatingActionId === item.id;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.status === "open" ? (
          <button type="button" onClick={() => void updateStatus(item, "assigned")} disabled={busy} className={buttonClass}>
            Assign
          </button>
        ) : null}
        {(item.status === "open" || item.status === "assigned") ? (
          <button type="button" onClick={() => void updateStatus(item, "in_progress")} disabled={busy} className={buttonClass}>
            Start
          </button>
        ) : null}
        {item.status === "in_progress" ? (
          <button type="button" onClick={() => void updateStatus(item, "corrected")} disabled={busy} className={buttonClass}>
            Corrected
          </button>
        ) : null}
        {(item.status === "open" || item.status === "assigned" || item.status === "in_progress") ? (
          <button type="button" onClick={() => void updateStatus(item, "stop_work")} disabled={busy} className={buttonClass}>
            Stop Work
          </button>
        ) : null}
        {item.status !== "verified_closed" ? (
          <button
            type="button"
            onClick={() => {
              setOpenEvidenceComposerId(openEvidenceComposerId === item.id ? null : item.id);
              setEvidenceComposer(EMPTY_EVIDENCE_COMPOSER);
            }}
            disabled={busy}
            className={buttonClass}
          >
            <Upload aria-hidden="true" className="h-3.5 w-3.5" />
            Proof
          </button>
        ) : null}
        {(item.evidence_count ?? 0) > 0 ? (
          <button type="button" onClick={() => void openLatestProof(item)} disabled={openingProofActionId === item.id} className={buttonClass}>
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
            Latest
          </button>
        ) : null}
        {(item.evidence_count ?? 0) > 0 ? (
          <button type="button" onClick={() => void toggleProofHistory(item.id)} disabled={loadingProofHistoryActionId === item.id} className={buttonClass}>
            <History aria-hidden="true" className="h-3.5 w-3.5" />
            History
          </button>
        ) : null}
        {item.status !== "verified_closed" ? (
          <button type="button" onClick={() => void closeAction(item.id)} disabled={busy} className={`${buttonClass} border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:text-emerald-800`}>
            Verify
          </button>
        ) : null}
        {(item.category === "near_miss" || item.category === "incident") && item.status !== "verified_closed" ? (
          <button type="button" onClick={() => void convertToIncident(item)} disabled={busy} className={`${buttonClass} border-orange-200 text-orange-700 hover:border-orange-300 hover:text-orange-800`}>
            Incident
          </button>
        ) : null}
      </div>
    );
  }

  function renderProofTools(item: CorrectiveActionRow) {
    return (
      <>
        {openEvidenceComposerId === item.id ? (
          <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setEvidenceComposer((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
            />
            {evidenceComposer.file ? (
              <div className="text-xs text-slate-500">Selected: {evidenceComposer.file.name}</div>
            ) : null}
            <button
              type="button"
              onClick={() => void attachProof(item.id)}
              disabled={updatingActionId === item.id}
              className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save Proof
            </button>
          </div>
        ) : null}
        {openProofHistoryActionId === item.id ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {loadingProofHistoryActionId === item.id ? (
              <div className="text-xs text-slate-500">Loading proof history...</div>
            ) : (proofHistoryByActionId[item.id] ?? []).length === 0 ? (
              <div className="text-xs text-slate-500">No proof files found for this issue yet.</div>
            ) : (
              <div className="space-y-2">
                {(proofHistoryByActionId[item.id] ?? []).map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{proof.file_name}</div>
                      <div className="text-[11px] text-slate-500">{formatRelative(proof.created_at, referenceTime)}</div>
                    </div>
                    <button type="button" onClick={() => void openProofFile(item.id, proof.file_path)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700">
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </>
    );
  }

  function renderRowActionPanel(item: CorrectiveActionRow) {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {renderPriorityPill(item)}
              {renderStatusPill(item)}
              <span className="font-mono text-[11px] font-semibold text-slate-500">{buildReportId(item)}</span>
            </div>
            <div className="mt-2 text-sm font-bold text-slate-950">{item.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{getLocationLabel(item)}</span>
              <span>{getReporterLabel(item)}</span>
              <span>{item.due_at ? `Due ${formatRelative(item.due_at, referenceTime)}` : "No due date"}</span>
              <span>Proof photos: {item.evidence_count ?? 0}</span>
            </div>
          </div>
          <div className="lg:max-w-[34rem]">{renderIssueActionButtons(item, true)}</div>
        </div>
        {item.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{item.description}</p> : null}
        {renderProofTools(item)}
      </div>
    );
  }

  function renderCreatePanel() {
    if (!showCreatePanel) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
        <button
          type="button"
          aria-label="Close create observation panel"
          className="absolute inset-0 cursor-default"
          onClick={() => setShowCreatePanel(false)}
        />
        <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Create Observation</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">New field issue</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCreatePanel(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Close panel"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Observation title</span>
                <input
                  type="text"
                  value={composer.title}
                  onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Exposed rebar in walkway"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Description</span>
                <textarea
                  value={composer.description}
                  onChange={(event) => setComposer((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
                />
              </label>
              <label>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Severity</span>
                <select
                  value={composer.severity}
                  onChange={(event) => setComposer((current) => ({ ...current, severity: event.target.value as CreateActionState["severity"] }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Observation Type</span>
                <select
                  value={composer.observationType}
                  onChange={(event) => setComposer((current) => ({ ...current, observationType: event.target.value as CreateActionState["observationType"] }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="negative">Negative</option>
                  <option value="near_miss">Near Miss</option>
                  <option value="positive">Positive</option>
                </select>
              </label>
              {composer.observationType === "negative" ? (
                <>
                  <label>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">SIF Potential</span>
                    <select
                      value={composer.sifPotential}
                      onChange={(event) => setComposer((current) => ({ ...current, sifPotential: event.target.value as CreateActionState["sifPotential"] }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">SIF Category</span>
                    <select
                      value={composer.sifCategory}
                      onChange={(event) => setComposer((current) => ({ ...current, sifCategory: event.target.value as CreateActionState["sifCategory"] }))}
                      disabled={composer.sifPotential !== "yes"}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100"
                    >
                      <option value="">Select category</option>
                      <option value="fall_from_height">fall from height</option>
                      <option value="struck_by">struck-by</option>
                      <option value="caught_between">caught-between</option>
                      <option value="electrical">electrical</option>
                      <option value="excavation_collapse">excavation collapse</option>
                      <option value="confined_space">confined space</option>
                      <option value="hazardous_energy">hazardous energy</option>
                      <option value="crane_rigging">crane / rigging</option>
                      <option value="line_of_fire">line of fire</option>
                    </select>
                  </label>
                </>
              ) : null}
              <label>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Jobsite</span>
                <select
                  value={composer.jobsiteId}
                  onChange={(event) => setComposer((current) => ({ ...current, jobsiteId: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">General Workspace</option>
                  {jobsites.map((jobsite) => (
                    <option key={jobsite.id} value={jobsite.id}>{jobsite.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Assign to</span>
                <select
                  value={composer.assignedUserId}
                  onChange={(event) => setComposer((current) => ({ ...current, assignedUserId: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {companyUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Due date</span>
                <input
                  type="date"
                  value={composer.dueAt}
                  onChange={(event) => setComposer((current) => ({ ...current, dueAt: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
              <label>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Workflow status</span>
                <select
                  value={composer.workflowStatus}
                  onChange={(event) => setComposer((current) => ({ ...current, workflowStatus: event.target.value as CreateActionState["workflowStatus"] }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="corrected">Corrected</option>
                  <option value="verified_closed">Verified Closed</option>
                  <option value="escalated">Escalated</option>
                  <option value="stop_work">Stop Work</option>
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Link to JSA Activity</span>
                <select
                  value={composer.dapActivityId}
                  onChange={(event) => setComposer((current) => ({ ...current, dapActivityId: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Ad-hoc observation</option>
                  {dapActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>{activity.activity_name}</option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <RiskMemoryFormFields
                  showOutcomeFields={false}
                  showPicklistSettingsLink
                  value={composer.riskMemory}
                  onChange={(riskMemory) => setComposer((current) => ({ ...current, riskMemory }))}
                  contractors={contractors}
                  crews={crews}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                setComposer(EMPTY_CREATE_ACTION);
                setShowAdvancedComposer(false);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void createAction()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Create Observation"}
            </button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {renderCreatePanel()}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(76,108,161,0.10)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <Link href="/dashboard" className="rounded-full border border-slate-200 px-3 py-1.5 text-blue-700 transition hover:bg-blue-50">
              Dashboard
            </Link>
            <span>/</span>
            <span>Observations</span>
            <span>/</span>
            <span>Corrective Actions</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void reloadActions()}
              aria-busy={loadingActions}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
            >
              <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loadingActions ? "animate-spin" : ""}`} />
              {loadingActions ? "Refreshing" : hasLoaded ? "Refresh" : "Load"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreatePanel(true)}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Create Observation
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search observations, locations, people, or tags"
                aria-label="Search observations, locations, people, or tags"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void reloadActions()}
              disabled={loadingActions}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Search
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterMenu((current) => !current)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                <Menu aria-hidden="true" className="h-4 w-4" />
                Menu
              </button>
              {showFilterMenu ? (
                <div className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    <ListFilter aria-hidden="true" className="h-4 w-4" />
                    Filters
                  </div>
                  <div className="grid gap-3">
                    <select value={jobsiteFilter} onChange={(event) => setJobsiteFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
                      <option value="all">All jobsites</option>
                      {jobsites.map((jobsite) => (
                        <option key={jobsite.name} value={jobsite.name}>{jobsite.name}</option>
                      ))}
                    </select>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
                      <option value="all">All statuses</option>
                      <option value="Open">Open</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Corrected">Corrected</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Stop Work">Stop Work</option>
                      <option value="Verified Closed">Verified Closed</option>
                    </select>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500">
                      <option value="all">All categories</option>
                      {categoryCounts.map((category) => (
                        <option key={category.label} value={category.label}>{category.label}</option>
                      ))}
                    </select>
                    <TableDensityToggle value={density} onChange={setDensity} disabled={loadingActions} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Work Queue</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Field Issue Log</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Review and act on observations, with prioritization based on risk and time.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {workQueueMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/15 bg-current/5 ${metric.color}`}>
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <div>
                        <div className={`text-2xl font-black tabular-nums ${metric.color}`}>{metric.value}</div>
                        <div className="text-xs font-bold text-slate-900">{metric.label}</div>
                        <div className="text-[11px] text-slate-500">{metric.note}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {!hasLoaded ? (
              <EmptyState title="Loading field issues" description="The work queue is preparing the latest observations." />
            ) : loadingActions ? (
              <EmptyState title="Refreshing field issues" description="Please wait while the queue updates." />
            ) : filteredItems.length === 0 ? (
              <EmptyState title="No field issues match this view" description="Create an observation or adjust the filters to widen the queue." />
            ) : (
              <>
                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1080px] w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Report ID</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Reported By</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Reported</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.slice(0, 12).map((item) => (
                        <Fragment key={item.id}>
                          <tr className="align-top transition hover:bg-blue-50/40">
                            <td className="px-4 py-3">{renderPriorityPill(item)}</td>
                            <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">{buildReportId(item)}</td>
                            <td className="px-4 py-3">
                              <div className="max-w-[16rem] font-semibold text-slate-950">{item.title}</div>
                              {item.description ? <div className="mt-1 line-clamp-2 max-w-[18rem] text-[11px] leading-5 text-slate-500">{item.description}</div> : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{getLocationLabel(item)}</td>
                            <td className="px-4 py-3 text-slate-700">{getReporterLabel(item)}</td>
                            <td className="px-4 py-3 text-slate-700">{getObservationTypeLabel(item)}</td>
                            <td className="px-4 py-3 text-slate-600">{formatReportedDate(item.created_at)}</td>
                            <td className="px-4 py-3">{renderStatusPill(item)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenRowActionMenuId((current) => (current === item.id ? null : item.id))
                                  }
                                  aria-expanded={openRowActionMenuId === item.id}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-700"
                                  aria-label={`Open actions for ${item.title}`}
                                >
                                  <MoreVertical aria-hidden="true" className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {openRowActionMenuId === item.id ? (
                            <tr key={`${item.id}-actions`} className="bg-blue-50/20">
                              <td colSpan={9} className="px-4 pb-4 pt-1">
                                {renderRowActionPanel(item)}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 p-3 xl:hidden">
                  {filteredItems.slice(0, 12).map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderPriorityPill(item)}
                          {renderStatusPill(item)}
                          <span className="font-mono text-[11px] font-semibold text-slate-500">{buildReportId(item)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenRowActionMenuId((current) => (current === item.id ? null : item.id))
                          }
                          aria-expanded={openRowActionMenuId === item.id}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-700"
                          aria-label={`Open actions for ${item.title}`}
                        >
                          <MoreVertical aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 font-semibold text-slate-950">{item.title}</div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600">
                        <span>{getLocationLabel(item)}</span>
                        <span>{getReporterLabel(item)} · {getObservationTypeLabel(item)}</span>
                        <span>{formatReportedDate(item.created_at)}</span>
                      </div>
                      {openRowActionMenuId === item.id ? (
                        <div className="mt-4">{renderRowActionPanel(item)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}
            {filteredItems.length > 12 ? (
              <div className="border-t border-slate-100 px-4 py-3 text-sm font-semibold text-blue-700">
                Showing 12 of {filteredItems.length} observations. Use filters to narrow the queue.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_12px_30px_rgba(76,108,161,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Workflow
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              Correction Action Hub
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Track tasks, assign owners, set due dates, and monitor progress to closure.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hubTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCorrectionHubView(tab.id)}
                className={`min-h-9 rounded-lg border px-3 py-2 text-xs font-bold shadow-sm transition ${
                  correctionHubView === tab.id
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {hubMetrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center">
              <div className="text-xs font-bold text-slate-700">{metric.label}</div>
              <div className={`mt-2 text-3xl font-black ${metric.tone}`}>{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {correctionHubView === "location" ? (
            groupedHubItems.length === 0 ? (
              <EmptyState title="No grouped actions" description="Active observations will appear grouped by location." />
            ) : (
              groupedHubItems.map(([location, items]) => (
                <div key={location} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-950">{location}</div>
                    <div className="text-xs font-semibold text-slate-500">{items.length} open item{items.length === 1 ? "" : "s"}</div>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} id={`field-issue-action-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {renderPriorityPill(item)}
                              {renderStatusPill(item)}
                            </div>
                            <div className="mt-2 font-semibold text-slate-950">{item.title}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {buildReportId(item)} - {getReporterLabel(item)} - {formatRelative(item.updated_at, referenceTime)}
                            </div>
                          </div>
                          {renderIssueActionButtons(item, true)}
                        </div>
                        {renderProofTools(item)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : correctionHubItems.length === 0 ? (
            <EmptyState title="No actions in this view" description="Choose another segment or adjust filters to see corrective action workflow items." />
          ) : (
            correctionHubItems.map((item) => (
              <div key={item.id} id={`field-issue-action-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderPriorityPill(item)}
                      {renderStatusPill(item)}
                      <span className="font-mono text-[11px] font-semibold text-slate-500">{buildReportId(item)}</span>
                    </div>
                    <div className="mt-2 text-base font-bold text-slate-950">{item.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{getLocationLabel(item)}</span>
                      <span>{getReporterLabel(item)}</span>
                      <span>{item.due_at ? `Due ${formatRelative(item.due_at, referenceTime)}` : "No due date"}</span>
                      <span>Proof photos: {item.evidence_count ?? 0}</span>
                    </div>
                    {item.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.description}</p> : null}
                  </div>
                  {renderIssueActionButtons(item)}
                </div>
                {renderProofTools(item)}
              </div>
            ))
          )}
        </div>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(76,108,161,0.06)]">
        <summary className="cursor-pointer text-sm font-bold text-slate-900">
          Advanced tools and analytics
        </summary>
        <div className="mt-5 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <CompanyAiAssistPanel
              surface="corrective_actions"
              title="Corrective action assistant"
              structuredContext={JSON.stringify({
                open: openCount,
                inProgress: inProgressCount,
                overdue: overdueCount,
                company: companyName,
              })}
            />
            <CompanyMemoryBankPanel />
          </div>

      <Tabs.Root
        value={fieldIssueLogTab}
        onValueChange={(value) => commitFieldIssueLogTab(value as FieldIssueLogTab)}
        className="space-y-6"
      >
        <div className="space-y-2">
          <Tabs.List className="flex flex-wrap gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-2">
            <Tabs.Trigger
              value="board"
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:text-white data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent"
            >
              Board
            </Tabs.Trigger>
            <Tabs.Trigger
              value="analytics"
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:text-white data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent"
            >
              {"Analytics & trends"}
            </Tabs.Trigger>
          </Tabs.List>
          <p className="text-sm leading-relaxed text-slate-500">
            Use <span className="font-semibold text-slate-400">Board</span> to triage and update
            observations. Use{" "}
            <span className="font-semibold text-slate-400">{"Analytics & trends"}</span> for charts,
            repeat patterns, and the analytics matrix (shareable via the{" "}
            <code className="rounded bg-slate-900/90 px-1.5 py-0.5 text-xs text-slate-400">tab</code> query
            in the URL).
          </p>
        </div>

        <Tabs.Content value="board" className="space-y-6 outline-none">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Open Items",
                value: String(openCount),
                note: "Issues that need assignment or immediate action",
              },
              {
                title: "In Progress",
                value: String(inProgressCount),
                note: "Issues actively being worked in the field",
              },
              {
                title: "Overdue",
                value: String(overdueCount),
                note: "Open or active issues past their due date",
              },
              {
                title: "Jobsites Covered",
                value: String(coveredJobsites || jobsites.length),
                note: companyLocation,
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 text-4xl font-black tracking-tight text-white">
                  {card.value}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{card.note}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-6">
        <SectionCard
          title="Create Observation"
          description="Create an observation, assign owner, set due date, and track closure proof."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="fie-observation-title"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
              >
                Observation title
              </label>
              <input
                id="fie-observation-title"
                type="text"
                value={composer.title}
                onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
                placeholder="Unsecured ladder access on west elevation"
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="fie-observation-description"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
              >
                Description
              </label>
              <textarea
                id="fie-observation-description"
                value={composer.description}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-600 px-4 py-3 text-sm leading-6 text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Severity
              </label>
              <select
                value={composer.severity}
                onChange={(event) =>
                  setComposer((current) => ({
                    ...current,
                    severity: event.target.value as CreateActionState["severity"],
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Observation Type
              </label>
              <select
                value={composer.observationType}
                onChange={(event) =>
                  setComposer((current) => ({
                    ...current,
                    observationType: event.target.value as CreateActionState["observationType"],
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="negative">Negative</option>
                <option value="near_miss">Near Miss</option>
                <option value="positive">Positive</option>
              </select>
            </div>
            {composer.observationType === "negative" ? (
              <>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    SIF Potential (Required)
                  </label>
                  <select
                    value={composer.sifPotential}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        sifPotential: event.target.value as CreateActionState["sifPotential"],
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    SIF Category
                  </label>
                  <select
                    value={composer.sifCategory}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        sifCategory: event.target.value as CreateActionState["sifCategory"],
                      }))
                    }
                    disabled={composer.sifPotential !== "yes"}
                    className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500 disabled:bg-slate-800/70"
                  >
                    <option value="">Select category</option>
                    <option value="fall_from_height">fall from height</option>
                    <option value="struck_by">struck-by</option>
                    <option value="caught_between">caught-between</option>
                    <option value="electrical">electrical</option>
                    <option value="excavation_collapse">excavation collapse</option>
                    <option value="confined_space">confined space</option>
                    <option value="hazardous_energy">hazardous energy</option>
                    <option value="crane_rigging">crane / rigging</option>
                    <option value="line_of_fire">line of fire</option>
                  </select>
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvancedComposer((current) => !current)}
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition hover:bg-slate-950/50"
              >
                {showAdvancedComposer ? "Hide Advanced Fields" : "Show Advanced Fields"}
              </button>
            </div>
            {showAdvancedComposer ? (
              <>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Jobsite
              </label>
              <select
                value={composer.jobsiteId}
                onChange={(event) => setComposer((current) => ({ ...current, jobsiteId: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="">General Workspace</option>
                {jobsites.map((jobsite) => (
                  <option key={jobsite.id} value={jobsite.id}>
                    {jobsite.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Assign to
              </label>
              <select
                value={composer.assignedUserId}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, assignedUserId: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="">Unassigned</option>
                {companyUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Due date
              </label>
              <input
                type="date"
                value={composer.dueAt}
                onChange={(event) => setComposer((current) => ({ ...current, dueAt: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Link to JSA Activity (Optional)
              </label>
              <select
                value={composer.dapActivityId}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, dapActivityId: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="">Ad-hoc observation (not from a JSA)</option>
                {dapActivities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.activity_name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                {
                  "Use this only when the observation is tied to planned work from today's JSA or Live View."
                }
              </p>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Workflow status
              </label>
              <select
                value={composer.workflowStatus}
                onChange={(event) =>
                  setComposer((current) => ({
                    ...current,
                    workflowStatus: event.target.value as CreateActionState["workflowStatus"],
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="corrected">Corrected</option>
                <option value="verified_closed">Verified Closed</option>
                <option value="escalated">Escalated</option>
                <option value="stop_work">Stop Work</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <RiskMemoryFormFields
                showOutcomeFields={false}
                showPicklistSettingsLink
                value={composer.riskMemory}
                onChange={(riskMemory) => setComposer((current) => ({ ...current, riskMemory }))}
                contractors={contractors}
                crews={crews}
              />
            </div>
              </>
            ) : null}
          </div>
          {message ? (
            <div className="mt-5">
              <InlineMessage tone={messageTone}>{message}</InlineMessage>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3 max-lg:sticky max-lg:bottom-0 max-lg:z-[5] max-lg:-mx-1 max-lg:rounded-t-xl max-lg:border-t max-lg:border-slate-700 max-lg:bg-slate-900/95 max-lg:px-3 max-lg:py-3 max-lg:backdrop-blur-md max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => void createAction()}
              disabled={saving}
              className="min-h-11 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Create Observation"}
            </button>
            <button
              type="button"
              onClick={() => {
                setComposer(EMPTY_CREATE_ACTION);
                setShowAdvancedComposer(false);
              }}
              className="min-h-11 rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Clear
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Import from Excel"
          description="Bulk-create observations from a spreadsheet. Row 1 must be headers; data starts on row 2."
        >
          <p className="text-sm leading-6 text-slate-400">
            Use{" "}
            <span className="font-mono text-slate-300">
              jobsite_id
            </span>{" "}
            (UUID) or{" "}
            <span className="font-mono text-slate-300">jobsite_name</span> (exact match to a workspace
            jobsite).{" "}
            <span className="font-mono text-slate-300">severity</span>: low, medium, high, critical.{" "}
            <span className="font-mono text-slate-300">status</span>: open, assigned, in_progress,
            corrected, verified_closed, escalated, stop_work.{" "}
            <span className="font-mono text-slate-300">observation_type</span>: positive, negative,
            near_miss. For negative rows, set{" "}
            <span className="font-mono text-slate-300">sif_potential</span> (yes/no) and{" "}
            <span className="font-mono text-slate-300">sif_category</span> when potential is yes.{" "}
            <span className="font-mono text-slate-300">assigned_user_email</span> must match a company
            member.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadFieldIssueImportTemplate}
              className="min-h-11 rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Download template
            </button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  void onFieldIssueImportFileSelected(event.target.files);
                  event.target.value = "";
                }}
              />
              Choose Excel file
            </label>
            <button
              type="button"
              onClick={() => void runFieldIssueExcelImport()}
              disabled={importRunning || !importParse?.ok.length}
              className="min-h-11 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {importRunning ? "Importing…" : "Import valid rows"}
            </button>
          </div>
          {importParse ? (
            <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <div className="font-semibold text-slate-200">{importParse.fileName}</div>
              <div className="mt-2 text-slate-400">
                {importParse.ok.length} row(s) ready
                {importParse.errors.length
                  ? ` · ${importParse.errors.length} row(s) failed validation`
                  : ""}
              </div>
              {importParse.errors.length ? (
                <details className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Validation errors ({importParse.errors.length})
                  </summary>
                  <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs text-rose-200">
                    {importParse.errors.map((err) => (
                      <li key={`${err.sheetRow}-${err.message}`}>
                        Row {err.sheetRow}: {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
          {importRunSummary ? (
            <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 py-3 text-sm">
              <div className="font-semibold text-slate-200">Last import</div>
              <div className="mt-2 text-slate-300">
                Created: {importRunSummary.created}
                {importRunSummary.apiFailures.length
                  ? ` · Failed: ${importRunSummary.apiFailures.length}`
                  : ""}
              </div>
              {importRunSummary.apiFailures.length ? (
                <details className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    API errors ({importRunSummary.apiFailures.length})
                  </summary>
                  <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs text-rose-200">
                    {importRunSummary.apiFailures.map((err) => (
                      <li key={`${err.sheetRow}-${err.message}`}>
                        Row {err.sheetRow}: {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
        </div>

        <SectionCard
          title="Observation Queue"
          description="Assign, move to in progress, upload proof, then close with accountability."
        >
          <div className="mb-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              View Filters
            </div>
            {renderSharedFilters()}
          </div>

          {!hasLoaded ? (
            <EmptyState
              title="Load the field board"
              description="Click Refresh Board to pull the latest corrective actions, pending submissions, and JSA activity."
            />
          ) : loadingActions ? (
            <EmptyState title="Loading corrective actions" description="Please wait..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No field items match this view"
              description="Create an issue or adjust the filters to see corrective action workflow items."
            />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    item.status === "stop_work"
                      ? "border-amber-400 bg-amber-950/40"
                      : "border-slate-700/80 bg-slate-950/50"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                        <StatusBadge label={getCategoryLabel(item.category)} tone="info" />
                        <StatusBadge label={getSeverityLabel(item.severity)} tone={getSeverityTone(item.severity)} />
                        <StatusBadge label={getStatusLabel(item.status)} tone={getStatusTone(item.status)} />
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {item.jobsite_id
                          ? (jobsiteNameById.get(item.jobsite_id) ?? "Jobsite")
                          : "General Workspace"}{" "}
                        -{" "}
                        {item.assigned_user_id
                          ? (assigneeLabelById.get(item.assigned_user_id) ?? "Assigned user")
                          : "Unassigned"}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">
                        {item.description || "No description provided."}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {item.due_at
                          ? `Due ${formatRelative(item.due_at, referenceTime)}`
                          : "No due date"}
                        {item.status !== "verified_closed" &&
                        item.due_at &&
                        new Date(item.due_at).getTime() < referenceTime
                          ? " · Overdue"
                          : ""}
                        {` · Proof photos: ${item.evidence_count ?? 0}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">
                        Updated {formatRelative(item.updated_at, referenceTime)}
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {item.status === "open" ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "assigned")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Assign
                          </button>
                        ) : null}
                        {(item.status === "open" || item.status === "assigned") ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "in_progress")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Start Work
                          </button>
                        ) : null}
                        {item.status === "in_progress" ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "corrected")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Mark Corrected
                          </button>
                        ) : null}
                        {(item.status === "open" ||
                          item.status === "assigned" ||
                          item.status === "in_progress" ||
                          item.status === "corrected") ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "stop_work")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-amber-300 bg-amber-950/40 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:text-amber-400"
                          >
                            Stop Work
                          </button>
                        ) : null}
                        {(item.status === "in_progress" ||
                          item.status === "corrected" ||
                          item.status === "escalated" ||
                          item.status === "stop_work") ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "open")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Reopen Open
                          </button>
                        ) : null}
                        {item.status !== "verified_closed" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenEvidenceComposerId(
                                openEvidenceComposerId === item.id ? null : item.id
                              );
                              setEvidenceComposer(EMPTY_EVIDENCE_COMPOSER);
                            }}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Add Proof
                          </button>
                        ) : null}
                        {(item.evidence_count ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => void openLatestProof(item)}
                            disabled={openingProofActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {openingProofActionId === item.id ? "Opening..." : "View Latest Proof"}
                          </button>
                        ) : null}
                        {(item.evidence_count ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => void toggleProofHistory(item.id)}
                            disabled={loadingProofHistoryActionId === item.id}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {openProofHistoryActionId === item.id
                              ? "Hide Proof History"
                              : loadingProofHistoryActionId === item.id
                                ? "Loading..."
                                : "Proof History"}
                          </button>
                        ) : null}
                        {item.status !== "verified_closed" ? (
                          <button
                            type="button"
                            onClick={() => void closeAction(item.id)}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            Verify Closed
                          </button>
                        ) : (
                          <StatusBadge label="Verified Closed" tone="success" />
                        )}
                        {(item.category === "near_miss" || item.category === "incident") &&
                        item.status !== "verified_closed" ? (
                          <button
                            type="button"
                            onClick={() => void convertToIncident(item)}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-amber-300 bg-amber-950/40 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:text-amber-400"
                          >
                            Convert to Incident
                          </button>
                        ) : null}
                      </div>
                      {openEvidenceComposerId === item.id ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 text-left">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setEvidenceComposer((current) => ({
                                ...current,
                                file: event.target.files?.[0] ?? null,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 outline-none focus:border-sky-500"
                          />
                          {evidenceComposer.file ? (
                            <div className="text-xs text-slate-500">
                              Selected: {evidenceComposer.file.name}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void attachProof(item.id)}
                            disabled={updatingActionId === item.id}
                            className="w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Save Proof
                          </button>
                        </div>
                      ) : null}
                      {openProofHistoryActionId === item.id ? (
                        <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 text-left">
                          {loadingProofHistoryActionId === item.id ? (
                            <div className="text-xs text-slate-500">Loading proof history...</div>
                          ) : (proofHistoryByActionId[item.id] ?? []).length === 0 ? (
                            <div className="text-xs text-slate-500">
                              No proof files found for this issue yet.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(proofHistoryByActionId[item.id] ?? []).map((proof) => (
                                <div
                                  key={proof.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2"
                                >
                                  <div>
                                    <div className="text-xs font-semibold text-slate-100">
                                      {proof.file_name}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {formatRelative(proof.created_at, referenceTime)}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void openProofFile(item.id, proof.file_path)}
                                    className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70"
                                  >
                                    Open
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Admin Review Queue"
            description="Individual safety submissions await company admin review before final issue status decisions."
          >
            {pendingSubmissions.length === 0 ? (
              <EmptyState
                title="No pending safety submissions"
                description="New submissions will appear here for admin review and status update."
              />
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.slice(0, 6).map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-100">{submission.title}</div>
                        <StatusBadge label={getCategoryLabel(submission.category)} tone="info" />
                        <StatusBadge
                          label={getSeverityLabel(submission.severity)}
                          tone={getSeverityTone(submission.severity)}
                        />
                      </div>
                      <div className="text-xs text-slate-500">
                        Submitted {formatRelative(submission.created_at, referenceTime)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void reviewSubmission(submission, "approved", "open")
                          }
                          disabled={reviewingSubmissionId === submission.id}
                          className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Approve as Open
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void reviewSubmission(submission, "approved", "verified_closed")
                          }
                          disabled={reviewingSubmissionId === submission.id}
                          className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Approve as Closed
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void reviewSubmission(submission, "rejected", "verified_closed")
                          }
                          disabled={reviewingSubmissionId === submission.id}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Issue Categories"
            description="Track volume by issue category after admin review decisions."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {categoryCounts.map((category) => (
                <div key={category.label} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-100">{category.label}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {category.count} active issue{category.count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Active Matrix"
            description="Live matrix of issue categories by status."
          >
            <div className="overflow-x-auto">
              <table className={matrixLayout.table}>
                <thead>
                  <tr>
                    <th className={matrixLayout.thFirst}>
                      Category
                    </th>
                    <th className={matrixLayout.thNum}>
                      Open
                    </th>
                    <th className={matrixLayout.thNum}>
                      In Progress
                    </th>
                    <th className={matrixLayout.thNum}>
                      Closed
                    </th>
                    <th className={matrixLayout.thNum}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeMatrix.map((row) => (
                    <tr key={row.category}>
                      <td className={matrixLayout.tdCategory}>
                        {getCategoryLabel(row.category)}
                      </td>
                      <td className={matrixLayout.tdNumber}>
                        {row.open}
                      </td>
                      <td className={matrixLayout.tdNumber}>
                        {row.inProgress}
                      </td>
                      <td className={matrixLayout.tdNumber}>
                        {row.closed}
                      </td>
                      <td className={matrixLayout.tdTotal}>
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <ActivityFeed
            title="Recent Exchange Activity"
            description="The latest field-side movement across your company workspace."
            items={
              activityItems.length > 0
                ? activityItems
                : [
                    {
                      id: "no-exchange-activity",
                      title: "No field activity yet",
                      detail: "Field signals will show up here as work starts moving through the workspace.",
                      meta: "Waiting",
                      tone: "neutral" as const,
                    },
                  ]
            }
          />
        </div>
          </section>
        </Tabs.Content>

        <Tabs.Content value="analytics" className="space-y-6 outline-none">
          <div className="sticky top-2 z-20 space-y-4 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 shadow-lg shadow-black/20 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/85">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Analytics filters</div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                  Refine jobsite, status, category, date range, and trend granularity. These controls apply to
                  every chart in this tab.
                </p>
              </div>
              <Link
                href="/analytics"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-950/35 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-900/50"
              >
                Company-wide risk trends
              </Link>
            </div>
            {showFieldAnalyticsCharts ? (
              <nav
                className="flex flex-wrap gap-2 border-t border-slate-700/50 pt-3"
                aria-label="Jump to analytics sections"
              >
                {fieldAnalyticsJumpLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-sky-500/40 hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            ) : null}
            {renderMetricsFilters()}
          </div>

          {!hasLoaded ? (
            <EmptyState
              title="Load analytics"
              description="Click Refresh Board to pull the latest corrective actions before opening analytics."
            />
          ) : loadingActions ? (
            <EmptyState title="Refreshing analytics" description="Please wait..." />
          ) : metricsAnalytics.metricsItems.length === 0 ? (
            <EmptyState
              title="No issues match this analytics view"
              description='Try widening the date range, choosing "All jobsites", or clearing status or category filters. If you recently added work, click Refresh Board so new observations are included.'
            />
          ) : (
            <>
              <section
                id="fiel-analytics-kpis"
                className="scroll-mt-28 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              >
                {metricsAnalytics.kpis.map((card) => (
                  <AnalyticsMetricCard key={card.title} title={card.title} value={card.value} note={card.note} />
                ))}
              </section>

              <section
                id="fiel-analytics-status"
                className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
              >
                <SectionCard
                  title="Corrective Action Status"
                  description="Status distribution across the selected analytics window, including a derived overdue bucket."
                >
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {metricsAnalytics.statusCounts.map((statusRow) => {
                        const classes = getAnalyticsStatusChartClasses(statusRow.key);
                        const share =
                          metricsAnalytics.totalIssues > 0 ? statusRow.count / metricsAnalytics.totalIssues : 0;
                        return (
                          <div
                            key={statusRow.key}
                            className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${classes.chip}`}
                              >
                                {getAnalyticsStatusLabel(statusRow.key)}
                              </span>
                              <span className="text-lg font-black text-white">{statusRow.count}</span>
                            </div>
                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full rounded-full transition-[width] duration-300 ${classes.bar}`}
                                style={{ width: `${Math.max(share * 100, statusRow.count > 0 ? 8 : 0)}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {statusRow.key === "overdue"
                                ? "Derived from due date and active status."
                                : `${formatPercentage(share)} of the selected view`}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <FieldMetricBarChart
                      rows={metricsAnalytics.statusCounts.map((statusRow) => {
                        const classes = getAnalyticsStatusChartClasses(statusRow.key);
                        return {
                          key: statusRow.key,
                          label: getAnalyticsStatusLabel(statusRow.key),
                          count: statusRow.count,
                          barClassName: classes.bar,
                        };
                      })}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Issues by Category"
                  description="Ranked view of which safety categories are generating the most issues."
                >
                  <FieldMetricRankedList
                    rows={metricsAnalytics.categoryCounts.map((row) => ({
                      key: row.key,
                      label: getCategoryLabel(row.key),
                      count: row.count,
                    }))}
                    emptyLabel="No category activity in this range."
                  />
                </SectionCard>
              </section>

              <section
                id="fiel-analytics-trends"
                className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
              >
                <SectionCard
                  title="Open vs. Closed Trend"
                  description={`Created, verified closed, and open backlog trend by ${trendGranularity}.`}
                >
                  <FieldMetricTrendChart points={metricsAnalytics.trendPoints} />
                </SectionCard>

                <SectionCard
                  title="Severity Breakdown"
                  description="Low, medium, high, and critical issue volume in the selected range."
                >
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {metricsAnalytics.severityCounts.map((row) => (
                        <div key={row.key} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-100">{getSeverityLabel(row.key)}</span>
                            <span className="text-lg font-black text-white">{row.count}</span>
                          </div>
                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full transition-[width] duration-300 ${getSeverityChartClasses(row.key)}`}
                              style={{
                                width: `${Math.max(
                                  metricsAnalytics.totalIssues > 0
                                    ? (row.count / metricsAnalytics.totalIssues) * 100
                                    : 0,
                                  row.count > 0 ? 8 : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <FieldMetricBarChart
                      rows={metricsAnalytics.severityCounts.map((row) => ({
                        key: row.key,
                        label: getSeverityLabel(row.key),
                        count: row.count,
                        barClassName: getSeverityChartClasses(row.key),
                      }))}
                    />
                  </div>
                </SectionCard>
              </section>

              <section
                id="fiel-analytics-location"
                className="scroll-mt-28 grid gap-6 xl:grid-cols-3"
              >
                <SectionCard
                  title="Overdue Aging"
                  description="How long overdue issues have been sitting inside the selected range."
                >
                  <FieldMetricBarChart
                    rows={metricsAnalytics.overdueAgingCounts.map((row) => ({
                      key: row.key,
                      label: getOverdueAgingLabel(row.key),
                      count: row.count,
                      barClassName: "bg-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.18)]",
                    }))}
                  />
                </SectionCard>

                <SectionCard
                  title="Issues by Location"
                  description="Where issues are occurring most often across the filtered jobsite view."
                >
                  <FieldMetricRankedList
                    rows={metricsAnalytics.locationCounts.map((row) => ({
                      key: row.label,
                      label: row.label,
                      count: row.count,
                    }))}
                    emptyLabel="No location-based issues in this range."
                  />
                </SectionCard>

                <SectionCard
                  title="Issues by Responsible Company"
                  description="v1 ownership analytics grouped at the current company workspace level."
                >
                  <div className="space-y-3">
                    {metricsAnalytics.companyRows.map((row) => (
                      <div key={row.label} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                        <div className="text-sm font-semibold text-slate-100">{row.label}</div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Total</div>
                            <div className="mt-1 text-2xl font-black text-white">{row.total}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Open Backlog</div>
                            <div className="mt-1 text-2xl font-black text-white">{row.openBacklog}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Overdue</div>
                            <div className="mt-1 text-2xl font-black text-white">{row.overdue}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Verified Closed</div>
                            <div className="mt-1 text-2xl font-black text-white">{row.verifiedClosed}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </section>

              <section
                id="fiel-analytics-repeat"
                className="scroll-mt-28 grid gap-6 xl:grid-cols-3"
              >
                <SectionCard
                  title="Repeat Issue Analysis"
                  description="Repeat patterns based on the same category paired with the same location or company inside the selected time period."
                >
                  <div className="grid min-w-0 gap-4 xl:grid-cols-3">
                    <RepeatIssueList
                      title="Repeated Categories"
                      rows={metricsAnalytics.repeatSummary.repeatedCategories.map((row) => ({
                        key: row.key,
                        label: getCategoryLabel(row.key),
                        count: row.count,
                      }))}
                      emptyLabel="No repeated categories in this range."
                    />
                    <RepeatIssueList
                      title="Repeated Locations"
                      rows={metricsAnalytics.repeatSummary.repeatedLocations.map((row) => ({
                        key: row.label,
                        label: row.label,
                        count: row.count,
                      }))}
                      emptyLabel="No repeated locations in this range."
                    />
                    <RepeatIssueList
                      title="Repeated Companies"
                      rows={metricsAnalytics.repeatSummary.repeatedCompanies.map((row) => ({
                        key: row.label,
                        label: row.label,
                        count: row.count,
                      }))}
                      emptyLabel="No repeated company ownership patterns in this range."
                    />
                  </div>
                </SectionCard>
              </section>

              <div id="fiel-analytics-matrix" className="scroll-mt-28">
                <SectionCard
                  title="Analytics Matrix"
                  description="Category-by-status matrix for the selected filters, including a derived overdue column and totals row."
                >
                  <div className="overflow-x-auto">
                    <table className={matrixLayout.table}>
                      <thead>
                        <tr>
                          <th className={matrixLayout.thFirst}>
                            Category
                          </th>
                          <th className={matrixLayout.thNum}>
                            Open
                          </th>
                          <th className={matrixLayout.thNum}>
                            Assigned
                          </th>
                          <th className={matrixLayout.thNum}>
                            In Progress
                          </th>
                          <th className={matrixLayout.thNum}>
                            Corrected
                          </th>
                          <th className={matrixLayout.thNum}>
                            Verified Closed
                          </th>
                          <th className={matrixLayout.thNum}>
                            Overdue
                          </th>
                          <th className={matrixLayout.thNum}>
                            Escalated
                          </th>
                          <th className={matrixLayout.thNum}>
                            Stop Work
                          </th>
                          <th className={matrixLayout.thNum}>
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricsAnalytics.matrixRows.map((row) => (
                        <tr key={row.category}>
                          <td className={matrixLayout.tdCategory}>
                            {getCategoryLabel(row.category)}
                          </td>
                          <td className={matrixLayout.tdNumber}>{row.open}</td>
                          <td className={matrixLayout.tdNumber}>{row.assigned}</td>
                          <td className={matrixLayout.tdNumber}>{row.inProgress}</td>
                          <td className={matrixLayout.tdNumber}>{row.corrected}</td>
                          <td className={matrixLayout.tdNumber}>{row.verifiedClosed}</td>
                          <td className={matrixLayout.tdNumberOrange}>{row.overdue}</td>
                          <td className={matrixLayout.tdNumber}>{row.escalated}</td>
                          <td className={matrixLayout.tdNumber}>{row.stopWork}</td>
                          <td className={matrixLayout.tdTotal}>{row.total}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className={matrixLayout.tdFooterLabel}>
                          Total
                        </td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.open}</td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.assigned}</td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.inProgress}</td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.corrected}</td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.verifiedClosed}</td>
                        <td className={matrixLayout.tdFooterOrange}>{metricsAnalytics.matrixTotals.overdue}</td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.escalated}</td>
                        <td className={matrixLayout.tdFooter}>{metricsAnalytics.matrixTotals.stopWork}</td>
                        <td className={matrixLayout.tdFooterLast}>{metricsAnalytics.matrixTotals.total}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>
              </div>
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
        </div>
      </details>
    </div>
  );
}
