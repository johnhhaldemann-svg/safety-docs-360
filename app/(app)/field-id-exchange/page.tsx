"use client";

import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  PageHero,
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const STATUS_CHART_ORDER: CorrectiveActionRow["status"][] = [
  "open",
  "assigned",
  "in_progress",
  "corrected",
  "verified_closed",
  "escalated",
  "stop_work",
];

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

export default function FieldIdExchangePage() {
  const searchParams = useSearchParams();
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
      try {
        const headers = await getAuthHeaders();
        const [actionsResponse, submissionsResponse, activitiesResponse] = await Promise.all([
          fetchWithTimeout("/api/company/observations", { headers }, 15000),
          fetchWithTimeout("/api/company/safety-submissions?status=pending", { headers }, 15000),
          fetchWithTimeout("/api/company/jsa-activities", { headers }, 15000),
        ]);
        const actionsPayload = (await actionsResponse.json().catch(() => null)) as
          | { actions?: CorrectiveActionRow[]; error?: string }
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
            setActions(actionsPayload?.actions ?? []);
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
      const matchesSearch =
        !normalizedSearch ||
        [
          item.title,
          item.description || "",
          ownerLabel,
          actionJobsite || "General Workspace",
          getSeverityLabel(item.severity),
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

  const statusChartData = useMemo(() => {
    return STATUS_CHART_ORDER.map((status) => {
      const count = filteredItems.filter((item) => item.status === status).length;
      return {
        status,
        label: getStatusLabel(status),
        count,
        share: filteredItems.length > 0 ? count / filteredItems.length : 0,
        ...getStatusChartClasses(status),
      };
    });
  }, [filteredItems]);

  const verifiedClosedCount = useMemo(
    () => filteredItems.filter((item) => item.status === "verified_closed").length,
    [filteredItems]
  );

  const actionStatusSummary = useMemo(
    () => [
      {
        title: "Filtered Actions",
        value: String(filteredItems.length),
        note: "Every card and chart in this view follows your current filters.",
      },
      {
        title: "Open Backlog",
        value: String(openCount),
        note: "Open and assigned work that still needs ownership or execution.",
      },
      {
        title: "Overdue",
        value: String(overdueCount),
        note: "Open or active issues currently past their due date.",
      },
      {
        title: "Verified Closed",
        value: String(verifiedClosedCount),
        note: "Items already closed and verified in the current filtered view.",
      },
    ],
    [filteredItems.length, openCount, overdueCount, verifiedClosedCount]
  );

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

  async function reloadActions() {
    setHasLoaded(true);
    setLoadingActions(true);
    try {
      const headers = await getAuthHeaders();
      const [actionsResponse, submissionsResponse, activitiesResponse] = await Promise.all([
        fetchWithTimeout("/api/company/observations", { headers }, 15000),
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
      const response = await fetchWithTimeout("/api/company/observations", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          title: composer.title,
          description: composer.description,
          severity: composer.severity,
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

  async function updateStatus(
    action: CorrectiveActionRow,
    nextStatus: "open" | "assigned" | "in_progress" | "corrected" | "escalated" | "stop_work"
  ) {
    setUpdatingActionId(action.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/observations/${action.id}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          status: nextStatus,
          workflowStatus: nextStatus,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to update action status.");
        setMessageTone("error");
        return;
      }
      setMessage(payload?.message || "Action status updated.");
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
      const response = await fetch(`/api/company/observations/${actionId}/close`, {
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
      const response = await fetch(`/api/company/observations/${action.id}`, {
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
      const uploadUrlResponse = await fetch(`/api/company/observations/${actionId}/upload-url`, {
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
      const uploadResult = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(uploadUrlPayload.path, uploadUrlPayload.token, evidenceComposer.file);
      if (uploadResult.error) {
        setMessage(`Proof upload failed: ${uploadResult.error.message}`);
        setMessageTone("error");
        return;
      }

      const response = await fetch(`/api/company/observations/${actionId}/evidence`, {
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
      const response = await fetch(`/api/company/observations/${actionId}/evidence/list`, {
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

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Corrective Action Hub"
        description={`Track hazards and corrective actions for ${companyName} with assignees, due dates, reminders, and closure controls.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => void reloadActions()}
              aria-busy={loadingActions}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-500/35 bg-sky-950/35 px-5 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-100"
            >
              {loadingActions ? "Refreshing..." : hasLoaded ? "Refresh Board" : "Load Board"}
            </button>
            <Link
              href="/safety-submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Individual Safety Submission
            </Link>
            <Link
              href="/upload"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Upload Field Photo
            </Link>
          </>
        }
      />

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

      <InlineMessage tone="neutral">
        This board stays on-demand. Click Refresh Board to load the current field items, then use
        the cards and filters below to review or update corrective actions.
      </InlineMessage>

      <Tabs.Root defaultValue="board" className="space-y-6">
        <Tabs.List className="flex flex-wrap gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-2">
          <Tabs.Trigger
            value="board"
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:text-white data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent"
          >
            Board
          </Tabs.Trigger>
          <Tabs.Trigger
            value="metrics"
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:text-white data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent"
          >
            Metrics
          </Tabs.Trigger>
        </Tabs.List>

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
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Category
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Open
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      In Progress
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Closed
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeMatrix.map((row) => (
                    <tr key={row.category}>
                      <td className="rounded-l-xl border-y border-l border-slate-700/80 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-100">
                        {getCategoryLabel(row.category)}
                      </td>
                      <td className="border-y border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                        {row.open}
                      </td>
                      <td className="border-y border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                        {row.inProgress}
                      </td>
                      <td className="border-y border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                        {row.closed}
                      </td>
                      <td className="rounded-r-xl border-y border-r border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs font-semibold text-slate-100">
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

        <Tabs.Content value="metrics" className="space-y-6 outline-none">
          <SectionCard
            title="Metrics Filters"
            description="Refine the dataset shown in the status chart and supporting corrective-action metrics."
          >
            {renderSharedFilters()}
          </SectionCard>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {actionStatusSummary.map((card) => (
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

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Corrective Action Status"
              description="Live status mix for the current filtered corrective-action view."
            >
              {!hasLoaded ? (
                <EmptyState
                  title="Load metrics"
                  description="Click Refresh Board to pull the latest corrective actions before opening metrics."
                />
              ) : loadingActions ? (
                <EmptyState title="Refreshing metrics" description="Please wait..." />
              ) : filteredItems.length === 0 ? (
                <EmptyState
                  title="No filtered actions to chart"
                  description="Adjust the filters or create an observation to populate the metrics tab."
                />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {statusChartData.map((statusRow) => (
                      <div
                        key={statusRow.status}
                        className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusRow.chip}`}
                          >
                            {statusRow.label}
                          </span>
                          <span className="text-lg font-black text-white">{statusRow.count}</span>
                        </div>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${statusRow.bar}`}
                            style={{ width: `${Math.max(statusRow.share * 100, statusRow.count > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {filteredItems.length > 0
                            ? `${Math.round(statusRow.share * 100)}% of the current view`
                            : "0% of the current view"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                    <div className="flex items-end gap-3 overflow-x-auto pb-1">
                      {statusChartData.map((statusRow) => (
                        <div
                          key={`chart-${statusRow.status}`}
                          className="flex min-w-[88px] flex-1 flex-col items-center gap-3"
                        >
                          <div className="text-sm font-black text-white">{statusRow.count}</div>
                          <div className="flex h-52 w-full items-end rounded-2xl bg-slate-900/90 px-3 py-3">
                            <div
                              className={`w-full rounded-xl transition-[height] duration-300 ${statusRow.bar}`}
                              style={{
                                height: `${Math.max(statusRow.share * 100, statusRow.count > 0 ? 12 : 2)}%`,
                              }}
                            />
                          </div>
                          <div className="text-center text-[11px] font-semibold leading-4 text-slate-400">
                            {statusRow.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            <div className="space-y-6">
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
                  <table className="min-w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Category
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Open
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          In Progress
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Closed
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMatrix.map((row) => (
                        <tr key={row.category}>
                          <td className="rounded-l-xl border-y border-l border-slate-700/80 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-100">
                            {getCategoryLabel(row.category)}
                          </td>
                          <td className="border-y border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                            {row.open}
                          </td>
                          <td className="border-y border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                            {row.inProgress}
                          </td>
                          <td className="border-y border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                            {row.closed}
                          </td>
                          <td className="rounded-r-xl border-y border-r border-slate-700/80 bg-slate-950/50 px-3 py-2 text-right text-xs font-semibold text-slate-100">
                            {row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </section>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
