"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  Download,
  FileText,
  FilterX,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import {
  SafePredictPermitFormDialog,
  type SafePredictPermitFormMode,
  type SafePredictPermitFormSaveInput,
} from "@/components/safe-predict/SafePredictPermitFormDialog";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  Card,
  CorrectiveActionCard,
  EventTimeline,
  ExportButton,
  ForecastTrendChart,
  MetricCard,
  NextStepRow,
  RiskBadge,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import { SafePredictOriginalSystemLinks } from "@/components/safe-predict/SafePredictOriginalSystemLinks";
import {
  riskForecastForSite,
  siteScoped,
  summarizeSafePredictDataset,
  summarizeSafePredictScope,
  type SafePredictDataset,
  type SafePredictJobsiteRecord,
} from "@/lib/safePredictData";
import {
  safePredictWorkspaceConfigs,
  type SafePredictWorkspaceSlug,
} from "@/lib/safePredictWorkspaceConfig";
import { mapSafePredictOperationHref, mapSafePredictSurfaceHref } from "@/lib/safePredictRouteMap";
import type { PermissionMap } from "@/lib/rbac";
import {
  DEFAULT_PREDICTABILITY_SETTINGS,
  PREDICTABILITY_DATA_MODES,
  PREDICTABILITY_MODE_DESCRIPTIONS,
  PREDICTABILITY_MODE_LABELS,
  type PredictabilityDataMode,
  type PredictabilitySettings,
} from "@/lib/predictability/settings";
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from "@/lib/incidents/bodyPart";
import {
  EXPOSURE_EVENT_TYPES,
  EXPOSURE_EVENT_TYPE_LABELS,
  type ExposureEventType,
} from "@/lib/incidents/exposureEventType";
import { INCIDENT_SOURCES, INCIDENT_SOURCE_LABELS, type IncidentSource } from "@/lib/incidents/incidentSource";
import { INJURY_TYPES, INJURY_TYPE_LABELS, type InjuryType } from "@/lib/incidents/injuryType";
import type { SafePredictActionStatus, SafePredictDemoEmployee, SafePredictRiskLevel } from "@/lib/safePredictMockData";
import { permitReadinessLabel } from "@/lib/safePredictPermitForms";

type RowAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  secondaryLabel?: string;
  secondaryOnClick?: () => void;
};

type ScopedRows = {
  actions: SafePredictDataset["actions"];
  alerts: SafePredictDataset["alerts"];
  inspections: SafePredictDataset["inspections"];
  incidents: SafePredictDataset["incidents"];
  observations: SafePredictDataset["observations"];
  hazards: SafePredictDataset["hazards"];
  permits: SafePredictDataset["permits"];
  employees: SafePredictDataset["employees"];
  documents: SafePredictDataset["documents"];
  reports: SafePredictDataset["reports"];
};

type WorkspaceRows = {
  title: string;
  headers: string[];
  rows: string[][];
  actions: RowAction[];
  exportRows: unknown[];
  cardGrid?: ReactNode;
  rowIds?: string[];
};

type TrainingAssignmentResult = {
  workerId: string;
  workerName: string;
  title: string;
  action: "create_requirement" | "assign_training" | "update_record" | "review";
  riskLevel: SafePredictRiskLevel;
  requirementTitle: string;
  detail: string;
  createdRequirementId?: string | null;
  createdActionId?: string | null;
};

type CorrectiveObservationType = "positive" | "negative" | "near_miss";

type CorrectiveActionDraft = {
  title: string;
  description: string;
  siteId: string;
  severity: SafePredictRiskLevel;
  category: string;
  dueAt: string;
  assignedUserId: string;
  observationType: CorrectiveObservationType;
  sifPotential: "yes" | "no";
  sifCategory: string;
};

type IncidentDraft = {
  title: string;
  description: string;
  siteId: string;
  category: "incident" | "near_miss" | "first_aid" | "property_damage";
  severity: SafePredictRiskLevel;
  eventType: ExposureEventType | "";
  source: IncidentSource | "";
  injuryType: InjuryType | "";
  bodyPart: BodyPart | "";
  recordable: boolean;
  lostTime: boolean;
  fatality: boolean;
  idlhFlag: boolean;
  occurredAt: string;
};

type IncidentNotificationSummary = {
  attempted?: boolean;
  recipients?: number;
  sent?: number;
  skipped?: number;
  failed?: number;
  error?: string | null;
};

export type SettingsUserContext = {
  id?: string;
  email?: string;
  role?: string;
  roleLabel?: string;
  team?: string;
  companyId?: string | null;
  companyName?: string | null;
  profileComplete?: boolean;
  permissionMap?: Partial<PermissionMap> | null;
  profile?: {
    fullName?: string;
    preferredName?: string;
    jobTitle?: string;
    tradeSpecialty?: string;
    photoUrl?: string;
  } | null;
};

type AuthMeSettingsResponse = {
  user?: SettingsUserContext;
};

const companyAdminFunctionLinks: Array<{
  href: string;
  title: string;
  detail: string;
  icon: ReactNode;
}> = [
  {
    href: "/safe-predict/team-access",
    title: "Team & Access",
    detail: "Invite users, manage roles, and review company permissions.",
    icon: <Users className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/apps-integrations",
    title: "Apps & Integrations",
    detail: "Manage connected apps, imports, and workspace data exchange.",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/onboarding-import",
    title: "Onboarding Import",
    detail: "Load roster, jobsite, and training data without adding seats.",
    icon: <Download className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/training-tracker",
    title: "Training Tracker",
    detail: "Review readiness, credentials, assignments, and gaps.",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/safety-forms",
    title: "Safety Forms",
    detail: "Configure forms and checklists crews complete in the field.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/inductions",
    title: "Inductions",
    detail: "Manage site access requirements and induction programs.",
    icon: <CalendarCheck className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/billing",
    title: "Billing",
    detail: "Review invoices, plan access, payments, and account charges.",
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    href: "/safe-predict/risk-memory",
    title: "Risk Memory Setup",
    detail: "Maintain contractor and crew lists used by risk workflows.",
    icon: <Settings className="h-5 w-5" />,
  },
];

function settingsDisplayName(user?: SettingsUserContext | null) {
  const preferred = user?.profile?.preferredName?.trim();
  const full = user?.profile?.fullName?.trim();
  return preferred || full || user?.email?.trim() || "Your Profile";
}

function settingsInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return ((parts[0]?.[0] ?? "Y") + (parts[1]?.[0] ?? "P")).toUpperCase();
}

function canViewCompanyAdminSettings(user?: SettingsUserContext | null) {
  return user?.role === "company_admin" || Boolean(user?.permissionMap?.can_manage_company_users);
}

function permitTypeApiValue(type: string) {
  return type.toLowerCase().replace(/\s*\/\s*/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const correctiveActionCategories = [
  { label: "Corrective action", value: "corrective_action" },
  { label: "Hazard", value: "hazard" },
  { label: "Near miss", value: "near_miss" },
  { label: "Incident", value: "incident" },
  { label: "Good catch", value: "good_catch" },
  { label: "PPE violation", value: "ppe_violation" },
  { label: "Housekeeping", value: "housekeeping" },
  { label: "Equipment issue", value: "equipment_issue" },
  { label: "Fall hazard", value: "fall_hazard" },
  { label: "Electrical hazard", value: "electrical_hazard" },
  { label: "Excavation/trench concern", value: "excavation_trench_concern" },
  { label: "Fire/hot work concern", value: "fire_hot_work_concern" },
];

const sifCategories = [
  { label: "Fall from height", value: "fall_from_height" },
  { label: "Struck by", value: "struck_by" },
  { label: "Caught between", value: "caught_between" },
  { label: "Electrical", value: "electrical" },
  { label: "Excavation collapse", value: "excavation_collapse" },
  { label: "Confined space", value: "confined_space" },
  { label: "Hazardous energy", value: "hazardous_energy" },
  { label: "Crane/rigging", value: "crane_rigging" },
  { label: "Line of fire", value: "line_of_fire" },
];

function buildEmptyCorrectiveActionDraft(siteId: string): CorrectiveActionDraft {
  return {
    title: "",
    description: "",
    siteId,
    severity: "medium",
    category: "corrective_action",
    dueAt: "",
    assignedUserId: "",
    observationType: "negative",
    sifPotential: "no",
    sifCategory: "",
  };
}

function buildEmptyIncidentDraft(siteId: string): IncidentDraft {
  return {
    title: "",
    description: "",
    siteId,
    category: "incident",
    severity: "medium",
    eventType: "",
    source: "",
    injuryType: "",
    bodyPart: "",
    recordable: false,
    lostTime: false,
    fatality: false,
    idlhFlag: false,
    occurredAt: "",
  };
}

function correctivePriority(severity: SafePredictRiskLevel): Exclude<SafePredictRiskLevel, "low"> {
  return severity === "critical" || severity === "high" ? "high" : "medium";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function workspacePrimaryHref(workspace: SafePredictWorkspaceSlug) {
  if (workspace === "incidents") return mapSafePredictOperationHref("/incidents");
  if (workspace === "observations") return mapSafePredictOperationHref("/safety-submit");
  if (workspace === "corrective-actions") return mapSafePredictOperationHref("/field-id-exchange");
  if (workspace === "inspections") return mapSafePredictOperationHref("/jobsites");
  if (workspace === "training") return mapSafePredictOperationHref("/training-matrix");
  if (workspace === "permits") return mapSafePredictSurfaceHref("/permits");
  if (workspace === "documents") return mapSafePredictOperationHref("/csep");
  if (workspace === "analytics") return mapSafePredictOperationHref("/analytics");
  if (workspace === "reports") return mapSafePredictOperationHref("/reports");
  return "/safe-predict/settings";
}

function WorkspaceIcon({ workspace }: { workspace: SafePredictWorkspaceSlug }) {
  if (workspace === "incidents") return <AlertTriangle className="h-6 w-6" />;
  if (workspace === "observations") return <ShieldAlert className="h-6 w-6" />;
  if (workspace === "corrective-actions") return <ClipboardCheck className="h-6 w-6" />;
  if (workspace === "inspections") return <CalendarCheck className="h-6 w-6" />;
  if (workspace === "hazards") return <TriangleAlert className="h-6 w-6" />;
  if (workspace === "training") return <GraduationCap className="h-6 w-6" />;
  if (workspace === "permits") return <FileText className="h-6 w-6" />;
  if (workspace === "documents") return <FileText className="h-6 w-6" />;
  if (workspace === "analytics") return <BarChart3 className="h-6 w-6" />;
  if (workspace === "reports") return <Download className="h-6 w-6" />;
  return <Settings className="h-6 w-6" />;
}

export function SettingsProfileHub({
  user,
  loading = false,
  message = "",
}: {
  user: SettingsUserContext | null;
  loading?: boolean;
  message?: string;
}) {
  const displayName = settingsDisplayName(user);
  const profileTitle = [user?.profile?.jobTitle, user?.profile?.tradeSpecialty]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" | ");
  const companyLabel = user?.companyName?.trim() || user?.team?.trim() || "Company not linked";
  const roleLabel = user?.roleLabel?.trim() || "Workspace member";
  const photoUrl = user?.profile?.photoUrl?.trim() || "";
  const showAdminFunctions = canViewCompanyAdminSettings(user);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          title="My Profile"
          action={
            <Link href="/safe-predict/profile" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-700">
              Edit Profile
            </Link>
          }
        />
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            {photoUrl ? (
              <div
                aria-label={`${displayName} profile photo`}
                className="h-24 w-24 shrink-0 rounded-2xl border border-slate-200 bg-cover bg-center shadow-sm"
                style={{ backgroundImage: `url("${photoUrl.replace(/"/g, "%22")}")` }}
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-2xl font-black text-blue-700 shadow-sm">
                {settingsInitials(displayName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Profile Summary</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{loading && !user ? "Loading profile..." : displayName}</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">{profileTitle || user?.email || "Profile details are still being loaded."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">{roleLabel}</span>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{companyLabel}</span>
                <span className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-black",
                  user?.profileComplete
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-amber-100 bg-amber-50 text-amber-700"
                )}>
                  {user?.profileComplete ? "Profile Complete" : "Profile Needs Details"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 text-sm lg:w-80">
            <ProfileFact label="Email" value={user?.email || "No email on file"} />
            <ProfileFact label="Company ID" value={user?.companyId || "Company scope unavailable"} />
          </div>
        </div>
        {message ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">{message}</p> : null}
      </Card>

      {showAdminFunctions ? (
        <Card className="p-5">
          <SectionTitle title="Company Admin Functions" />
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {companyAdminFunctionLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm group-hover:border-blue-200">
                  {item.icon}
                </span>
                <span className="mt-3 block text-sm font-black text-slate-950">{item.title}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{item.detail}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="mt-1 block truncate text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

function siteName(siteId: string, jobsites: Array<{ id: string; name: string }>) {
  return jobsites.find((site) => site.id === siteId)?.name ?? "All Sites";
}

function riskDotClass(level: SafePredictJobsiteRecord["riskLevel"]) {
  if (level === "critical") return "bg-red-500";
  if (level === "high") return "bg-orange-500";
  if (level === "medium") return "bg-amber-400";
  return "bg-emerald-500";
}

function LiveRiskMap({ jobsites }: { jobsites: SafePredictJobsiteRecord[] }) {
  if (jobsites.length === 0) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
        <div>
          <p className="text-sm font-black text-slate-800">No live risk map data yet</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Add jobsites and field activity to populate this map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {jobsites.slice(0, 6).map((jobsite) => (
        <Link
          key={jobsite.id}
          href={`/safe-predict/jobsites/${encodeURIComponent(jobsite.id)}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-900">{jobsite.name}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">{jobsite.openActions} open actions</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-slate-800">
            <span className={cx("h-2.5 w-2.5 rounded-full", riskDotClass(jobsite.riskLevel))} />
            {jobsite.riskScore}
          </span>
        </Link>
      ))}
    </div>
  );
}

function statusMatchesFilter(status: string, statusFilter: string) {
  if (statusFilter === "all") return true;
  const normalized = status.trim().toLowerCase();
  const filter = statusFilter.trim().toLowerCase();
  if (filter === "open") {
    return !["closed", "completed", "controlled", "approved", "ready"].some((closed) => normalized.includes(closed));
  }
  return normalized === filter || normalized.includes(filter);
}

function queryMatches(values: Array<string | number | null | undefined>, query: string) {
  return !query || values.filter((value) => value != null).join(" ").toLowerCase().includes(query);
}

function analyticsRiskMatches(level: SafePredictRiskLevel | undefined, riskFilter: SafePredictRiskLevel | "all") {
  return riskFilter === "all" || level === riskFilter;
}

function buildAnalyticsScope({
  dataset,
  siteFilter,
  riskFilter,
  statusFilter,
  query,
}: {
  dataset: SafePredictDataset;
  siteFilter: string;
  riskFilter: SafePredictRiskLevel | "all";
  statusFilter: string;
  query: string;
}) {
  const initialSites = dataset.jobsites.filter((site) => (siteFilter === "all" ? true : site.id === siteFilter));
  const sitesWithRisk = initialSites.filter((site) => analyticsRiskMatches(site.riskLevel, riskFilter));

  const siteMatchesQuery = (site: SafePredictJobsiteRecord) =>
    queryMatches([site.name, site.code, site.address, site.cityState, site.projectManager, site.siteLead, site.customerName], query);

  const relatedRowsForSite = (siteId: string) => [
    ...dataset.actions.filter((row) => row.siteId === siteId),
    ...dataset.alerts.filter((row) => row.siteId === siteId),
    ...dataset.inspections.filter((row) => row.siteId === siteId),
    ...dataset.incidents.filter((row) => row.siteId === siteId),
    ...dataset.observations.filter((row) => row.siteId === siteId),
    ...dataset.hazards.filter((row) => row.siteId === siteId),
    ...dataset.permits.filter((row) => row.siteId === siteId),
    ...dataset.documents.filter((row) => row.siteId === siteId),
    ...dataset.reports.filter((row) => row.siteId === siteId),
  ];

  const visibleJobsites = sitesWithRisk.filter((site) => {
    const siteQueryMatch = siteMatchesQuery(site);
    const related = relatedRowsForSite(site.id);
    const relatedQueryMatch = related.some((row) => queryMatches(Object.values(row).map(String), query));
    const relatedStatusMatch = related.some((row) => "status" in row && statusMatchesFilter(String(row.status), statusFilter));
    const siteStatusMatch = statusMatchesFilter(site.status, statusFilter);
    return (siteQueryMatch || relatedQueryMatch || !query) && (statusFilter === "all" || siteStatusMatch || relatedStatusMatch);
  });
  const visibleSiteIds = new Set(visibleJobsites.map((site) => site.id));
  const includeSiteRows = new Set(visibleJobsites.filter(siteMatchesQuery).map((site) => site.id));
  const rowQueryMatches = (siteId: string, values: Array<string | number | null | undefined>) =>
    includeSiteRows.has(siteId) || queryMatches(values, query);

  const scoped: ScopedRows = {
    actions: dataset.actions.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.priority, riskFilter) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.linkedRisk, row.assignee, row.status])
    ),
    alerts: dataset.alerts.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.riskLevel, riskFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.detail, row.source, row.area, row.site])
    ),
    inspections: dataset.inspections.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.riskLevel, riskFilter) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.checklist, row.inspector, row.status])
    ),
    incidents: dataset.incidents.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.severity, riskFilter) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.detail, row.type, row.status, row.reportedBy])
    ),
    observations: dataset.observations.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.riskLevel, riskFilter) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.detail, row.category, row.status, row.submittedBy])
    ),
    hazards: dataset.hazards.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.riskLevel, riskFilter) &&
        statusMatchesFilter(row.controlStatus, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.controlStatus, row.owner, row.driverId])
    ),
    permits: dataset.permits.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        analyticsRiskMatches(row.riskLevel, riskFilter) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.type, row.status, row.owner, row.readiness])
    ),
    employees: dataset.employees.filter(
      (row) =>
        visibleSiteIds.has(row.assignedSiteId) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.assignedSiteId, [row.name, row.trade, row.role, row.status, row.supervisor])
    ),
    documents: dataset.documents.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.type, row.status])
    ),
    reports: dataset.reports.filter(
      (row) =>
        visibleSiteIds.has(row.siteId) &&
        statusMatchesFilter(row.status, statusFilter) &&
        rowQueryMatches(row.siteId, [row.title, row.audience, row.status])
    ),
  };
  const scopedDataset: SafePredictDataset = {
    ...dataset,
    jobsites: visibleJobsites,
    actions: scoped.actions,
    alerts: scoped.alerts,
    inspections: scoped.inspections,
    incidents: scoped.incidents,
    observations: scoped.observations,
    hazards: scoped.hazards,
    permits: scoped.permits,
    employees: scoped.employees,
    documents: scoped.documents,
    reports: scoped.reports,
  };

  return {
    jobsites: visibleJobsites,
    scoped,
    dataset: scopedDataset,
    summary: summarizeSafePredictScope(scopedDataset, visibleSiteIds),
  };
}

function inferLocalTrainingTitle(employee: SafePredictDemoEmployee) {
  const haystack = [employee.trade, employee.role, ...(employee.credentials ?? [])].join(" ").toLowerCase();
  if (/\belectrical|electrician|loto|lockout|energy/.test(haystack)) return "LOTO Authorized Worker";
  if (/\bweld|hot work|fire watch/.test(haystack)) return "Hot Work / Fire Watch Training";
  if (/\bscaffold|height|fall|deck/.test(haystack)) return "Fall Protection / Scaffold User Training";
  if (/\bexcavat|trench|civil|concrete/.test(haystack)) return "Excavation and Trenching Competent Person";
  if (/\bsafety manager|site safety|supervisor|foreman/.test(haystack)) return "Supervisor Safety Leadership and Field Verification";
  return "Site Safety Orientation and Hazard Reporting";
}

function settingsForPredictabilityMode(mode: PredictabilityDataMode, current: PredictabilitySettings): PredictabilitySettings {
  if (mode === "company_only") {
    return {
      ...current,
      predictabilityDataMode: mode,
      allowCompanyData: true,
      allowPlatformAggregateFallback: false,
      allowOshaFallback: false,
      visibleBenchmarkSources: ["company"],
    };
  }
  if (mode === "company_then_platform") {
    return {
      ...current,
      predictabilityDataMode: mode,
      allowCompanyData: true,
      allowPlatformAggregateFallback: true,
      allowOshaFallback: false,
      visibleBenchmarkSources: ["company", "platform_aggregate"],
    };
  }
  if (mode === "company_then_osha") {
    return {
      ...current,
      predictabilityDataMode: mode,
      allowCompanyData: true,
      allowPlatformAggregateFallback: false,
      allowOshaFallback: true,
      visibleBenchmarkSources: ["company", "osha"],
    };
  }
  if (mode === "platform_aggregate_only") {
    return {
      ...current,
      predictabilityDataMode: mode,
      allowCompanyData: false,
      allowPlatformAggregateFallback: true,
      allowOshaFallback: false,
      visibleBenchmarkSources: ["platform_aggregate"],
    };
  }
  if (mode === "osha_only") {
    return {
      ...current,
      predictabilityDataMode: mode,
      allowCompanyData: false,
      allowPlatformAggregateFallback: false,
      allowOshaFallback: true,
      visibleBenchmarkSources: ["osha"],
    };
  }
  return {
    ...current,
    predictabilityDataMode: mode,
    allowCompanyData: true,
    allowPlatformAggregateFallback: true,
    allowOshaFallback: true,
    visibleBenchmarkSources: ["company", "platform_aggregate", "osha"],
  };
}

function buildLocalTrainingAssignments(employees: SafePredictDemoEmployee[]): TrainingAssignmentResult[] {
  return employees.map((employee) => {
    const requirementTitle = inferLocalTrainingTitle(employee);
    const hasEvidence = employee.credentials.length > 0;
    const action: TrainingAssignmentResult["action"] =
      employee.status === "overdue"
        ? "assign_training"
        : employee.status === "expiring"
          ? "assign_training"
          : hasEvidence
            ? "review"
            : "update_record";
    const riskLevel: SafePredictRiskLevel =
      employee.status === "overdue" || employee.readinessScore < 70
        ? "high"
        : employee.status === "expiring" || employee.readinessScore < 85 || !hasEvidence
          ? "medium"
          : "low";
    return {
      workerId: employee.id,
      workerName: employee.name,
      title:
        action === "update_record"
          ? `Update training records for ${employee.name}`
          : action === "review"
            ? `Review training fit for ${employee.name}`
            : `Assign ${requirementTitle} to ${employee.name}`,
      action,
      riskLevel,
      requirementTitle,
      detail:
        action === "update_record"
          ? `${employee.name} appears ready, but this view does not have training evidence attached. Verify and update the record.`
          : action === "review"
            ? `${employee.name} does not show an urgent gap. Review only.`
            : `${employee.name} has a readiness gap or renewal signal. Assign training to mitigate jobsite risk.`,
    };
  });
}

export function SafePredictNativeWorkspace({ workspace }: { workspace: SafePredictWorkspaceSlug }) {
  const { dataset, mode, setMode, selectedJobsiteId, setSelectedJobsiteId, refreshLiveData, updateActionStatus, closeActionWithPhoto, addDraftAction, addDraftHazard, addDraftIncident, addDraftPermit, updatePermit } = useSafePredictData();
  const router = useRouter();
  const config = safePredictWorkspaceConfigs[workspace];
  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState(selectedJobsiteId === "all" ? "all" : selectedJobsiteId);
  const [riskFilter, setRiskFilter] = useState<SafePredictRiskLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showIncidentComposer, setShowIncidentComposer] = useState(false);
  const [showHazardComposer, setShowHazardComposer] = useState(false);
  const [showCorrectiveComposer, setShowCorrectiveComposer] = useState(false);
  const [showPermitComposer, setShowPermitComposer] = useState(false);
  const [permitFormMode, setPermitFormMode] = useState<SafePredictPermitFormMode>("create");
  const [activePermit, setActivePermit] = useState<SafePredictDataset["permits"][number] | null>(null);
  const [correctiveMessage, setCorrectiveMessage] = useState("");
  const [correctiveSubmitting, setCorrectiveSubmitting] = useState(false);
  const [permitMessage, setPermitMessage] = useState("");
  const [incidentMessage, setIncidentMessage] = useState("");
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentTestSending, setIncidentTestSending] = useState(false);
  const [permitSubmitting, setPermitSubmitting] = useState(false);
  const [incidentDraft, setIncidentDraft] = useState(() =>
    buildEmptyIncidentDraft(selectedJobsiteId === "all" ? "" : selectedJobsiteId)
  );
  const [correctiveDraft, setCorrectiveDraft] = useState(() =>
    buildEmptyCorrectiveActionDraft(selectedJobsiteId === "all" ? "" : selectedJobsiteId)
  );
  const [hazardDraft, setHazardDraft] = useState({
    title: "",
    description: "",
    siteId: selectedJobsiteId === "all" ? "" : selectedJobsiteId,
    riskLevel: "medium" as SafePredictRiskLevel,
    controlStatus: "Needs Control" as SafePredictDataset["hazards"][number]["controlStatus"],
    owner: "",
    dueDate: "",
  });
  const [trainingAiLoading, setTrainingAiLoading] = useState(false);
  const [trainingAiMessage, setTrainingAiMessage] = useState("");
  const [trainingAiAssignments, setTrainingAiAssignments] = useState<TrainingAssignmentResult[]>([]);
  const [predictabilitySettings, setPredictabilitySettings] = useState<PredictabilitySettings>(DEFAULT_PREDICTABILITY_SETTINGS);
  const [predictabilitySettingsLoading, setPredictabilitySettingsLoading] = useState(false);
  const [predictabilitySettingsSaving, setPredictabilitySettingsSaving] = useState(false);
  const [predictabilitySettingsMessage, setPredictabilitySettingsMessage] = useState("");
  const [settingsUser, setSettingsUser] = useState<SettingsUserContext | null>(null);
  const [settingsUserLoading, setSettingsUserLoading] = useState(false);
  const [settingsUserMessage, setSettingsUserMessage] = useState("");
  const summary = summarizeSafePredictDataset(dataset);
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (workspace !== "settings") return;
    let active = true;

    async function loadSettingsUser() {
      setSettingsUserLoading(true);
      setSettingsUserMessage("");
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined;
        const response = await fetch("/api/auth/me", { headers });
        const body = (await response.json().catch(() => null)) as AuthMeSettingsResponse | { error?: string } | null;

        if (!active) return;
        if (!response.ok) {
          setSettingsUser(null);
          setSettingsUserMessage(
            body && "error" in body && body.error
              ? body.error
              : "Profile summary is unavailable."
          );
          return;
        }

        setSettingsUser((body as AuthMeSettingsResponse | null)?.user ?? null);
      } catch {
        if (active) {
          setSettingsUser(null);
          setSettingsUserMessage("Profile summary is unavailable.");
        }
      } finally {
        if (active) {
          setSettingsUserLoading(false);
        }
      }
    }

    void loadSettingsUser();
    return () => {
      active = false;
    };
  }, [workspace]);

  useEffect(() => {
    if (workspace !== "settings") return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setPredictabilitySettingsLoading(true);
      setPredictabilitySettingsMessage("");
    });
    fetch("/api/company/predictability/settings")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setPredictabilitySettingsMessage(body?.error ?? "Predictability Engine settings are unavailable.");
          return;
        }
        if (body?.settings) setPredictabilitySettings(body.settings as PredictabilitySettings);
      })
      .catch(() => {
        if (active) setPredictabilitySettingsMessage("Predictability Engine settings are unavailable.");
      })
      .finally(() => {
        if (active) setPredictabilitySettingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace]);

  const scoped = useMemo(() => {
    return {
      actions: siteScoped(dataset.actions, siteFilter),
      alerts: siteScoped(dataset.alerts, siteFilter),
      inspections: siteScoped(dataset.inspections, siteFilter),
      incidents: siteScoped(dataset.incidents, siteFilter),
      observations: siteScoped(dataset.observations, siteFilter),
      hazards: siteScoped(dataset.hazards, siteFilter),
      permits: siteScoped(dataset.permits, siteFilter),
      employees: siteFilter === "all" ? dataset.employees : dataset.employees.filter((employee) => employee.assignedSiteId === siteFilter),
      documents: siteScoped(dataset.documents, siteFilter),
      reports: siteScoped(dataset.reports, siteFilter),
    };
  }, [dataset, siteFilter]);
  const analyticsScope = useMemo(
    () => buildAnalyticsScope({ dataset, siteFilter, riskFilter, statusFilter, query: normalizedQuery }),
    [dataset, normalizedQuery, riskFilter, siteFilter, statusFilter]
  );
  const activeScoped = workspace === "analytics" ? analyticsScope.scoped : scoped;
  const activeSummary = workspace === "analytics" ? analyticsScope.summary : summary;
  const activeJobsites = workspace === "analytics" ? analyticsScope.jobsites : dataset.jobsites;
  const activeDataset = workspace === "analytics" ? analyticsScope.dataset : dataset;

  function clearFilters() {
    setQuery("");
    setSiteFilter("all");
    setSelectedJobsiteId("all");
    setRiskFilter("all");
    setStatusFilter("all");
  }

  function createActionFromSignal(signal: { id: string; title: string; siteId: string; riskLevel?: SafePredictRiskLevel; detail?: string; category?: string }) {
    const createdFrom = workspace === "observations" ? "Observation" : workspace === "inspections" ? "Inspection" : workspace === "hazards" ? "Hazard" : "Manual";
    const draft = addDraftAction({
      title: `Resolve ${signal.title.toLowerCase()}`,
      linkedRiskId: signal.id,
      linkedRisk: signal.title,
      siteId: signal.siteId,
      priority: signal.riskLevel === "critical" || signal.riskLevel === "high" ? "high" : "medium",
      createdFrom,
      description: signal.detail || `Created from SafePredict ${createdFrom}: ${signal.title}`,
      category: workspace === "incidents" ? "incident" : workspace === "hazards" ? "hazard" : signal.category === "near_miss" ? "near_miss" : "corrective_action",
      observationType: "negative",
      sifPotential: false,
    });
    router.push(`/safe-predict/corrective-actions#${draft.id}`);
  }

  function selectPredictabilityMode(nextMode: PredictabilityDataMode) {
    setPredictabilitySettings((current) => settingsForPredictabilityMode(nextMode, current));
    setPredictabilitySettingsMessage("");
  }

  async function savePredictabilitySettings() {
    setPredictabilitySettingsSaving(true);
    setPredictabilitySettingsMessage("");
    try {
      const res = await fetch("/api/company/predictability/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(predictabilitySettings),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setPredictabilitySettingsMessage(body?.error ?? "Could not save Predictability Engine settings.");
        return;
      }
      if (body?.settings) setPredictabilitySettings(body.settings as PredictabilitySettings);
      setPredictabilitySettingsMessage("Predictability Engine settings saved.");
    } catch {
      setPredictabilitySettingsMessage("Could not save Predictability Engine settings.");
    } finally {
      setPredictabilitySettingsSaving(false);
    }
  }

  function logHazard() {
    const title = hazardDraft.title.trim();
    if (!title) return;
    const fallbackSiteId = siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "riverside";
    const draft = addDraftHazard({
      title,
      description: hazardDraft.description.trim(),
      siteId: hazardDraft.siteId || fallbackSiteId,
      riskLevel: hazardDraft.riskLevel,
      controlStatus: hazardDraft.controlStatus,
      owner: hazardDraft.owner.trim() || "Unassigned",
      dueDate: hazardDraft.dueDate || "No due date",
    });
    setSiteFilter(draft.siteId);
    setSelectedJobsiteId(draft.siteId);
    setStatusFilter("all");
    setRiskFilter("all");
    setQuery("");
    setHazardDraft({
      title: "",
      description: "",
      siteId: draft.siteId,
      riskLevel: "medium",
      controlStatus: "Needs Control",
      owner: "",
      dueDate: "",
    });
    setShowHazardComposer(false);
    window.setTimeout(() => {
      document.getElementById(draft.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function openIncidentComposer() {
    const nextSiteId = siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "";
    setIncidentMessage("");
    setShowIncidentComposer(true);
    setIncidentDraft((current) => ({ ...current, siteId: current.siteId || nextSiteId }));
    window.setTimeout(() => {
      document.getElementById("safe-predict-incident-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function incidentRecordType(category: IncidentDraft["category"]) {
    if (category === "near_miss") return "Near Miss" as const;
    if (category === "first_aid") return "First Aid" as const;
    if (category === "property_damage") return "Property Damage" as const;
    return "Incident" as const;
  }

  async function saveIncident() {
    const title = incidentDraft.title.trim();
    const siteId = incidentDraft.siteId || (siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "");
    if (!title) {
      setIncidentMessage("Add an incident title before logging the record.");
      return;
    }
    if (!siteId) {
      setIncidentMessage("Choose an active jobsite before logging the incident.");
      return;
    }
    if (!incidentDraft.eventType) {
      setIncidentMessage("Choose an event / exposure type before logging the incident.");
      return;
    }
    if (!incidentDraft.source) {
      setIncidentMessage("Choose the equipment or object source before logging the incident.");
      return;
    }
    if (incidentDraft.category === "incident" && !incidentDraft.injuryType) {
      setIncidentMessage("Choose an injury type for injury incidents.");
      return;
    }
    if (incidentDraft.category === "incident" && !incidentDraft.bodyPart) {
      setIncidentMessage("Choose a body part for injury incidents.");
      return;
    }

    setIncidentSubmitting(true);
    setIncidentMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const sifFlag =
        incidentDraft.category === "incident" &&
        (incidentDraft.severity === "critical" || incidentDraft.severity === "high" || incidentDraft.fatality || incidentDraft.idlhFlag);
      const stopWorkStatus = incidentDraft.severity === "critical" || incidentDraft.fatality || incidentDraft.idlhFlag
        ? "stop_work_requested"
        : "normal";
      let notificationSummary: IncidentNotificationSummary | null = null;

      if (mode === "live" && token) {
        const response = await fetch("/api/company/incidents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title,
            description: incidentDraft.description.trim(),
            category: incidentDraft.category,
            severity: incidentDraft.severity,
            status: "open",
            jobsiteId: siteId,
            eventType: incidentDraft.eventType,
            source: incidentDraft.source,
            injuryType: incidentDraft.category === "incident" ? incidentDraft.injuryType : undefined,
            bodyPart: incidentDraft.category === "incident" ? incidentDraft.bodyPart : undefined,
            recordable: incidentDraft.recordable,
            lostTime: incidentDraft.lostTime,
            fatality: incidentDraft.fatality,
            idlhFlag: incidentDraft.idlhFlag,
            sifFlag,
            stopWorkStatus,
            stopWorkReason: stopWorkStatus === "normal" ? null : "SafePredict incident logging flagged immediate safety review.",
            occurredAt: incidentDraft.occurredAt ? new Date(incidentDraft.occurredAt).toISOString() : null,
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          notification?: IncidentNotificationSummary | null;
        } | null;
        if (!response.ok) {
          setIncidentMessage(data?.error || "Could not log the incident.");
          return;
        }
        notificationSummary = data?.notification ?? null;
        refreshLiveData();
      } else {
        addDraftIncident({
          title,
          siteId,
          type: incidentRecordType(incidentDraft.category),
          severity: incidentDraft.severity,
          detail: incidentDraft.description.trim() || "Incident queued from the SafePredict workspace.",
        });
      }

      setSiteFilter(siteId);
      setSelectedJobsiteId(siteId);
      setStatusFilter("all");
      setRiskFilter("all");
      setQuery("");
      setIncidentDraft(buildEmptyIncidentDraft(siteId));
      setShowIncidentComposer(false);
      if (mode === "live" && token) {
        const sent = notificationSummary?.sent ?? 0;
        const skipped = notificationSummary?.skipped ?? 0;
        const failed = notificationSummary?.failed ?? 0;
        const recipients = notificationSummary?.recipients ?? 0;
        setIncidentMessage(
          notificationSummary?.attempted
            ? `Incident logged to the company register. Notifications: ${sent} sent, ${skipped} skipped, ${failed} failed across ${recipients} recipient${recipients === 1 ? "" : "s"}.`
            : "Incident logged to the company register. No notification was triggered for this severity/category."
        );
      } else {
        setIncidentMessage("Incident queued locally in SafePredict.");
      }
    } catch (error) {
      setIncidentMessage(error instanceof Error ? error.message : "Could not log the incident.");
    } finally {
      setIncidentSubmitting(false);
    }
  }

  async function sendIncidentAlertTest() {
    if (mode !== "live") {
      setIncidentMessage("Switch to Live data before sending an incident alert test.");
      return;
    }
    const confirmed = window.confirm("Send a TEST ONLY critical incident alert to configured incident alert recipients?");
    if (!confirmed) return;
    setIncidentTestSending(true);
    setIncidentMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      if (!token) {
        setIncidentMessage("Sign in again before sending an incident alert test.");
        return;
      }
      const response = await fetch("/api/company/incidents/test-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            warning?: string | null;
            recipients?: number;
            sent?: number;
            skipped?: number;
            failed?: number;
          }
        | null;
      if (!response.ok) {
        setIncidentMessage(data?.error || data?.warning || "Incident alert test failed.");
        return;
      }
      setIncidentMessage(
        data?.message ||
          `Incident alert test complete. Recipients: ${data?.recipients ?? 0}. Sent: ${data?.sent ?? 0}. Skipped: ${data?.skipped ?? 0}. Failed: ${data?.failed ?? 0}.`
      );
    } catch (error) {
      setIncidentMessage(error instanceof Error ? error.message : "Incident alert test failed.");
    } finally {
      setIncidentTestSending(false);
    }
  }

  function openPermitComposer(siteId?: string, permit?: SafePredictDataset["permits"][number], nextMode: SafePredictPermitFormMode = "create") {
    const nextSiteId = siteId || (siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "");
    setActivePermit(permit ?? null);
    setPermitFormMode(permit ? nextMode : "create");
    setPermitMessage("");
    setShowPermitComposer(true);
    window.setTimeout(() => {
      document.getElementById("safe-predict-permit-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    if (nextSiteId) {
      setSiteFilter(nextSiteId);
      setSelectedJobsiteId(nextSiteId);
    }
  }

  function permitStatusApiValue(status: SafePredictDataset["permits"][number]["status"]) {
    if (status === "Active") return "active";
    if (status === "Expired") return "expired";
    return "draft";
  }

  function permitDueAtValue(expiresAt: string) {
    const trimmed = expiresAt.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  async function savePermit(input: SafePredictPermitFormSaveInput) {
    const title = input.title.trim();
    const siteId = input.siteId || (siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "");
    if (!title) {
      setPermitMessage("Add a permit title before saving the permit.");
      return;
    }
    if (!siteId) {
      setPermitMessage("Choose an active jobsite before saving the permit.");
      return;
    }

    setPermitSubmitting(true);
    setPermitMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      if (mode === "live" && token) {
        const response = await fetch("/api/company/permits", {
          method: input.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: input.id,
            title,
            permitType: permitTypeApiValue(input.type),
            severity: input.riskLevel,
            category: "safety",
            jobsiteId: siteId,
            ownerUserId: null,
            dueAt: permitDueAtValue(input.expiresAt),
            sifFlag: input.riskLevel === "critical" || input.riskLevel === "high",
            escalationLevel: input.riskLevel === "critical" ? "urgent" : "none",
            escalationReason: "",
            stopWorkStatus: input.status === "Expired" ? "stop_work_requested" : "normal",
            stopWorkReason: input.status === "Expired" ? "Expired permit requires hold before work proceeds." : "",
            jsaActivityId: null,
            observationId: null,
            status: permitStatusApiValue(input.status),
            permitForm: input.permitForm,
          }),
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setPermitMessage(data?.error || "Could not save the permit.");
          return;
        }
      }

      const nextPermit = {
        ...(activePermit ?? {}),
        id: input.id || activePermit?.id || `draft-permit-${Date.now()}`,
        title,
        siteId,
        type: input.type,
        status: input.status,
        owner: input.owner.trim() || "Unassigned",
        expiresAt: input.expiresAt || "No expiration set",
        riskLevel: input.riskLevel,
        permitForm: input.permitForm,
        readiness: permitReadinessLabel(input.permitForm),
      };
      if (input.id || activePermit) {
        updatePermit(nextPermit);
      } else {
        addDraftPermit(nextPermit);
      }
      setSiteFilter(siteId);
      setSelectedJobsiteId(siteId);
      setStatusFilter("all");
      setRiskFilter("all");
      setQuery("");
      setShowPermitComposer(false);
      setActivePermit(null);
      refreshLiveData();
      setPermitMessage(mode === "live" && token ? "Permit saved to the company permit register." : "Permit saved locally in SafePredict.");
      window.setTimeout(() => {
        document.getElementById(nextPermit.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } catch (error) {
      setPermitMessage(error instanceof Error ? error.message : "Could not save the permit.");
    } finally {
      setPermitSubmitting(false);
    }
  }

  async function createCorrectiveAction() {
    const title = correctiveDraft.title.trim();
    const siteId = correctiveDraft.siteId || (siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "");
    const assignedUserId = correctiveDraft.assignedUserId.trim();
    if (!title) {
      setCorrectiveMessage("Add a title before creating the corrective action.");
      return;
    }
    if (!siteId) {
      setCorrectiveMessage("Choose an active jobsite before creating the corrective action.");
      return;
    }
    if (correctiveDraft.observationType === "negative" && correctiveDraft.sifPotential === "yes" && !correctiveDraft.sifCategory) {
      setCorrectiveMessage("Choose a SIF category when SIF potential is yes.");
      return;
    }
    if (assignedUserId && !dataset.assignableUsers.some((user) => user.id === assignedUserId) && !isUuid(assignedUserId)) {
      setCorrectiveMessage("Choose an active company user or leave assignee blank.");
      return;
    }

    const payload = {
      title,
      description: correctiveDraft.description.trim(),
      severity: correctiveDraft.severity,
      category: correctiveDraft.category,
      status: "open",
      jobsiteId: siteId,
      assignedUserId: assignedUserId || null,
      dueAt: correctiveDraft.dueAt || null,
      observationType: correctiveDraft.observationType,
      sifPotential: correctiveDraft.observationType === "negative" ? correctiveDraft.sifPotential === "yes" : undefined,
      sifCategory: correctiveDraft.observationType === "negative" && correctiveDraft.sifPotential === "yes" ? correctiveDraft.sifCategory : null,
    };

    setCorrectiveSubmitting(true);
    setCorrectiveMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      if (mode === "live" && token) {
        const response = await fetch("/api/company/corrective-actions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
        if (!response.ok) {
          setCorrectiveMessage(data?.error || "Could not create the corrective action.");
          return;
        }
      }

      const draft = addDraftAction({
        title,
        linkedRiskId: `manual-${Date.now()}`,
        linkedRisk: correctiveDraft.category.replace(/_/g, " "),
        siteId,
        priority: correctivePriority(correctiveDraft.severity),
        createdFrom: "Manual",
        description: correctiveDraft.description,
        category: correctiveDraft.category,
        assignedUserId: assignedUserId || undefined,
        dueAt: correctiveDraft.dueAt,
        observationType: correctiveDraft.observationType,
        sifPotential: correctiveDraft.observationType === "negative" ? correctiveDraft.sifPotential === "yes" : undefined,
        sifCategory: correctiveDraft.sifCategory,
        persistLive: false,
        persistLocal: mode !== "live" || !token,
      });
      setSiteFilter(siteId);
      setSelectedJobsiteId(siteId);
      setStatusFilter("all");
      setRiskFilter("all");
      setQuery("");
      setCorrectiveDraft(buildEmptyCorrectiveActionDraft(siteId));
      setShowCorrectiveComposer(false);
      setCorrectiveMessage(mode === "live" && token ? "Corrective action created and saved to the company tracker." : "Corrective action queued locally. Switch to live data to save it to company records.");
      window.setTimeout(() => {
        document.getElementById(draft.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } catch (error) {
      setCorrectiveMessage(error instanceof Error ? error.message : "Could not create the corrective action.");
    } finally {
      setCorrectiveSubmitting(false);
    }
  }

  async function assignTrainingWithAi(worker?: SafePredictDemoEmployee) {
    const candidates = worker
      ? [worker]
      : scoped.employees
          .filter((employee) => employee.status !== "compliant" || employee.credentials.length === 0 || employee.readinessScore < 85)
          .slice(0, 12);
    const selectedWorkers = candidates.length > 0 ? candidates : scoped.employees.slice(0, 6);
    if (selectedWorkers.length === 0) {
      setTrainingAiMessage("No workers are visible for AI training assignment.");
      setTrainingAiAssignments([]);
      return;
    }

    setTrainingAiLoading(true);
    setTrainingAiMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      if (!token) {
        const localAssignments = buildLocalTrainingAssignments(selectedWorkers).map((assignment) => {
          if (assignment.action === "review") return assignment;
          const draft = addDraftAction({
            title: assignment.title,
            linkedRiskId: `training-${assignment.workerId}`,
            linkedRisk: assignment.requirementTitle,
            siteId: selectedWorkers.find((employee) => employee.id === assignment.workerId)?.assignedSiteId ?? dataset.jobsites[0]?.id ?? "riverside",
            priority: assignment.riskLevel === "critical" || assignment.riskLevel === "high" ? "high" : "medium",
            createdFrom: "Manual",
          });
          return { ...assignment, createdActionId: draft.id };
        });
        setTrainingAiAssignments(localAssignments);
        setTrainingAiMessage("AI training assignments were queued locally. Switch to live data to write them to company records.");
        return;
      }

      const response = await fetch("/api/company/training-matrix/ai-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workers: selectedWorkers }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            assignments?: TrainingAssignmentResult[];
            createdActions?: number;
            createdRequirements?: number;
          }
        | null;

      if (!response.ok) {
        setTrainingAiMessage(data?.error || "AI could not assign training.");
        setTrainingAiAssignments([]);
        return;
      }

      setTrainingAiAssignments(data?.assignments ?? []);
      setTrainingAiMessage(
        data?.message ||
          `AI queued ${data?.createdActions ?? 0} training follow-up actions and ${data?.createdRequirements ?? 0} missing requirements.`
      );
    } catch (error) {
      setTrainingAiMessage(error instanceof Error ? error.message : "AI could not assign training.");
      setTrainingAiAssignments([]);
    } finally {
      setTrainingAiLoading(false);
    }
  }

  const pageRows = buildRows({
    workspace,
    query: normalizedQuery,
    riskFilter,
    statusFilter,
    scoped: activeScoped,
    jobsites: activeJobsites,
    updateActionStatus,
    closeActionWithPhoto,
    createActionFromSignal,
    openPermitComposer,
    assignTrainingWithAi,
  });

  const selectedForecastSite = workspace === "analytics" ? (siteFilter === "all" ? "all" : siteFilter) : siteFilter === "all" ? dataset.jobsites[0]?.id ?? "riverside" : siteFilter;
  const selectedForecastTitle = selectedForecastSite === "all" ? (activeJobsites.length === dataset.jobsites.length ? "All Sites" : "Filtered Sites") : siteName(selectedForecastSite, dataset.jobsites);

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <div className="flex flex-col gap-4 px-0 py-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <WorkspaceIcon workspace={workspace} />
            </span>
            <div>
              <h1 className="font-app-display text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{config.title}</h1>
              <p className="mt-1 text-base text-slate-600">{config.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <button
            type="button"
            onClick={() => setMode(mode === "live" ? "demo" : "live")}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
          >
            <ShieldCheck className="h-4 w-4" />
            {mode === "live" ? "Live data" : "Sample data"}
          </button>
          <ExportButton
            fileName={`safe-predict-${workspace}.json`}
            label={`Export ${config.title}`}
            payload={{ mode, workspace, siteFilter, rows: pageRows.exportRows, dataset }}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export
          </ExportButton>
          {workspace === "observations" ? (
            <Link
              href="/api/company/sor/import/template"
              download="sor-import-template.csv"
              prefetch={false}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
            >
              <Download className="h-4 w-4" />
              SOR Template
            </Link>
          ) : null}
          {workspace === "incidents" ? (
            <>
              <button
                type="button"
                onClick={() => void sendIncidentAlertTest()}
                disabled={incidentTestSending}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TriangleAlert className="h-4 w-4" />
                {incidentTestSending ? "Sending test" : "Send test alert"}
              </button>
              <button
                type="button"
                onClick={openIncidentComposer}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
              >
                <Plus className="h-4 w-4" />
                {config.primaryAction}
              </button>
            </>
          ) : workspace === "permits" ? (
            <button
              type="button"
              onClick={() => openPermitComposer()}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
            >
              <Plus className="h-4 w-4" />
              {config.primaryAction}
            </button>
          ) : workspace === "training" ? (
            <button
              type="button"
              onClick={() => void assignTrainingWithAi()}
              disabled={trainingAiLoading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Sparkles className="h-4 w-4" />
              {trainingAiLoading ? "Assigning..." : config.primaryAction}
            </button>
          ) : workspace === "hazards" ? (
            <button
              type="button"
              onClick={() => setShowHazardComposer((current) => !current)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
            >
              <Plus className="h-4 w-4" />
              {config.primaryAction}
            </button>
          ) : workspace === "corrective-actions" ? (
            <button
              type="button"
              onClick={() => setShowCorrectiveComposer((current) => !current)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
            >
              <Plus className="h-4 w-4" />
              New Corrective Action
            </button>
          ) : (
            <Link href={workspacePrimaryHref(workspace)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]">
              <Plus className="h-4 w-4" />
              {config.primaryAction}
            </Link>
          )}
        </div>
      </div>

      {workspace === "incidents" && (showIncidentComposer || incidentMessage) ? (
        <Card id="safe-predict-incident-composer" className="mb-5 p-5">
          <SectionTitle
            title="Log Incident"
            action={
              <button
                type="button"
                onClick={() => setShowIncidentComposer((current) => !current)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm"
              >
                {showIncidentComposer ? "Hide" : "Show"}
              </button>
            }
            hint="Create a structured incident or near-miss record with enough context for risk scoring and follow-up."
          />
          {incidentMessage ? (
            <div className={cx("mt-4 rounded-lg border px-4 py-3 text-sm font-bold", incidentMessage.includes("logged") || incidentMessage.includes("queued") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
              {incidentMessage}
            </div>
          ) : null}
          {showIncidentComposer ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs font-bold text-slate-600">Title</span>
                <input
                  value={incidentDraft.title}
                  onChange={(event) => setIncidentDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Short incident title"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
              <SelectShell
                label="Jobsite"
                value={incidentDraft.siteId || (siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? "")}
                onChange={(value) => setIncidentDraft((current) => ({ ...current, siteId: value }))}
                options={dataset.jobsites.map((site) => ({ label: site.name, value: site.id }))}
              />
              <SelectShell
                label="Severity"
                value={incidentDraft.severity}
                onChange={(value) => setIncidentDraft((current) => ({ ...current, severity: value as SafePredictRiskLevel }))}
                options={[
                  { label: "Low", value: "low" },
                  { label: "Medium", value: "medium" },
                  { label: "High", value: "high" },
                  { label: "Critical", value: "critical" },
                ]}
              />
              <SelectShell
                label="Type"
                value={incidentDraft.category}
                onChange={(value) =>
                  setIncidentDraft((current) => ({
                    ...current,
                    category: value as IncidentDraft["category"],
                    injuryType: value === "incident" ? current.injuryType : "",
                    bodyPart: value === "incident" ? current.bodyPart : "",
                  }))
                }
                options={[
                  { label: "Incident", value: "incident" },
                  { label: "Near Miss", value: "near_miss" },
                  { label: "First Aid", value: "first_aid" },
                  { label: "Property Damage", value: "property_damage" },
                ]}
              />
              <SelectShell
                label="Event / Exposure"
                value={incidentDraft.eventType}
                onChange={(value) => setIncidentDraft((current) => ({ ...current, eventType: value as ExposureEventType }))}
                options={[
                  { label: "Select event", value: "" },
                  ...EXPOSURE_EVENT_TYPES.map((value) => ({ label: EXPOSURE_EVENT_TYPE_LABELS[value], value })),
                ]}
              />
              <SelectShell
                label="Source"
                value={incidentDraft.source}
                onChange={(value) => setIncidentDraft((current) => ({ ...current, source: value as IncidentSource }))}
                options={[
                  { label: "Select source", value: "" },
                  ...INCIDENT_SOURCES.map((value) => ({ label: INCIDENT_SOURCE_LABELS[value], value })),
                ]}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Occurred</span>
                <input
                  type="datetime-local"
                  value={incidentDraft.occurredAt}
                  onChange={(event) => setIncidentDraft((current) => ({ ...current, occurredAt: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
              {incidentDraft.category === "incident" ? (
                <>
                  <SelectShell
                    label="Injury Type"
                    value={incidentDraft.injuryType}
                    onChange={(value) => setIncidentDraft((current) => ({ ...current, injuryType: value as InjuryType }))}
                    options={[
                      { label: "Select injury type", value: "" },
                      ...INJURY_TYPES.map((value) => ({ label: INJURY_TYPE_LABELS[value], value })),
                    ]}
                  />
                  <SelectShell
                    label="Body Part"
                    value={incidentDraft.bodyPart}
                    onChange={(value) => setIncidentDraft((current) => ({ ...current, bodyPart: value as BodyPart }))}
                    options={[
                      { label: "Select body part", value: "" },
                      ...BODY_PARTS.map((value) => ({ label: BODY_PART_LABELS[value], value })),
                    ]}
                  />
                </>
              ) : null}
              <label className="block lg:col-span-4">
                <span className="mb-1 block text-xs font-bold text-slate-600">Description</span>
                <textarea
                  value={incidentDraft.description}
                  onChange={(event) => setIncidentDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What happened, immediate controls, and who was notified"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500"
                />
              </label>
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                {[
                  ["recordable", "OSHA recordable"],
                  ["lostTime", "Lost time"],
                  ["fatality", "Fatality"],
                  ["idlhFlag", "IDLH / life safety"],
                ].map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(incidentDraft[key as keyof IncidentDraft])}
                      onChange={(event) => setIncidentDraft((current) => ({ ...current, [key]: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                <button
                  type="button"
                  onClick={() => void saveIncident()}
                  disabled={incidentSubmitting}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus className="h-4 w-4" />
                  {incidentSubmitting ? "Logging..." : "Log Incident"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIncidentDraft(buildEmptyIncidentDraft(siteFilter !== "all" ? siteFilter : dataset.jobsites[0]?.id ?? ""));
                    setIncidentMessage("");
                  }}
                  className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {workspace === "permits" && (showPermitComposer || permitMessage) ? (
        <Card id="safe-predict-permit-composer" className="mb-5 p-5">
          <SectionTitle
            title={permitFormMode === "view" ? "View Permit" : activePermit ? "Edit Permit" : "Create Permit"}
            action={
              <button
                type="button"
                onClick={() => {
                  setShowPermitComposer((current) => !current);
                  if (showPermitComposer) {
                    setActivePermit(null);
                    setPermitMessage("");
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm"
              >
                {showPermitComposer ? "Close" : "Open form"}
              </button>
            }
            hint="Complete the permit checklist and acknowledgement without leaving the register."
          />
          {permitMessage ? (
            <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              {permitMessage}
            </p>
          ) : null}
          {showPermitComposer ? (
            <div className="mt-4">
              <SafePredictPermitFormDialog
                key={activePermit?.id ?? `create-${siteFilter}`}
                mode={permitFormMode}
                permit={activePermit}
                jobsites={dataset.jobsites}
                fallbackSiteId={siteFilter === "all" ? dataset.jobsites[0]?.id ?? "" : siteFilter}
                saving={permitSubmitting}
                message=""
                onClose={() => {
                  setShowPermitComposer(false);
                  setActivePermit(null);
                  setPermitMessage("");
                }}
                onModeChange={setPermitFormMode}
                onSave={(input) => void savePermit(input)}
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      {workspace === "hazards" && showHazardComposer ? (
        <Card className="mb-5 p-5">
          <SectionTitle title="Log Hazard" />
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_170px_190px_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Hazard</span>
              <input
                value={hazardDraft.title}
                onChange={(event) => setHazardDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Open edge at level 3 stairwell"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <SelectShell
              label="Jobsite"
              value={hazardDraft.siteId || (siteFilter === "all" ? dataset.jobsites[0]?.id ?? "" : siteFilter)}
              onChange={(value) => setHazardDraft((current) => ({ ...current, siteId: value }))}
              options={dataset.jobsites.map((site) => ({ label: site.name, value: site.id }))}
            />
            <SelectShell
              label="Risk"
              value={hazardDraft.riskLevel}
              onChange={(value) => setHazardDraft((current) => ({ ...current, riskLevel: value as SafePredictRiskLevel }))}
              options={[
                { label: "Critical", value: "critical" },
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
              ]}
            />
            <SelectShell
              label="Control"
              value={hazardDraft.controlStatus}
              onChange={(value) =>
                setHazardDraft((current) => ({
                  ...current,
                  controlStatus: value as SafePredictDataset["hazards"][number]["controlStatus"],
                }))
              }
              options={[
                { label: "Needs Control", value: "Needs Control" },
                { label: "Control Planned", value: "Control Planned" },
                { label: "Controlled", value: "Controlled" },
              ]}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Owner</span>
              <input
                value={hazardDraft.owner}
                onChange={(event) => setHazardDraft((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Owner"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_2fr_auto] xl:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Due date</span>
              <input
                type="date"
                value={hazardDraft.dueDate}
                onChange={(event) => setHazardDraft((current) => ({ ...current, dueDate: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Notes</span>
              <input
                value={hazardDraft.description}
                onChange={(event) => setHazardDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Immediate controls, location details, or escalation notes"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              />
            </label>
            <button
              type="button"
              onClick={logHazard}
              disabled={!hazardDraft.title.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" />
              Log Hazard
            </button>
          </div>
        </Card>
      ) : null}

      {workspace === "corrective-actions" && (showCorrectiveComposer || correctiveMessage) ? (
        <Card className="mb-5 p-5">
          <SectionTitle
            title="New Corrective Action"
            action={
              <button
                type="button"
                onClick={() => {
                  setShowCorrectiveComposer((current) => !current);
                  if (showCorrectiveComposer) setCorrectiveMessage("");
                }}
                className="text-sm font-black text-blue-600"
              >
                {showCorrectiveComposer ? "Close" : "Open form"}
              </button>
            }
          />
          {correctiveMessage ? (
            <p className={cx("mt-3 rounded-lg px-3 py-2 text-sm font-bold", correctiveMessage.includes("created") || correctiveMessage.includes("queued") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {correctiveMessage}
            </p>
          ) : null}
          {showCorrectiveComposer ? (
            <>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_180px_210px]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Title</span>
                  <input
                    value={correctiveDraft.title}
                    onChange={(event) => setCorrectiveDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Trash dumpster overflowing near north building"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                  />
                </label>
                <SelectShell
                  label="Jobsite"
                  value={correctiveDraft.siteId || (siteFilter === "all" ? dataset.jobsites[0]?.id ?? "" : siteFilter)}
                  onChange={(value) => setCorrectiveDraft((current) => ({ ...current, siteId: value }))}
                  options={dataset.jobsites.map((site) => ({ label: site.name, value: site.id }))}
                />
                <SelectShell
                  label="Severity"
                  value={correctiveDraft.severity}
                  onChange={(value) => setCorrectiveDraft((current) => ({ ...current, severity: value as SafePredictRiskLevel }))}
                  options={[
                    { label: "Critical", value: "critical" },
                    { label: "High", value: "high" },
                    { label: "Medium", value: "medium" },
                    { label: "Low", value: "low" },
                  ]}
                />
                <SelectShell
                  label="Category"
                  value={correctiveDraft.category}
                  onChange={(value) => setCorrectiveDraft((current) => ({ ...current, category: value }))}
                  options={correctiveActionCategories}
                />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_180px_190px_190px]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Description</span>
                  <input
                    value={correctiveDraft.description}
                    onChange={(event) => setCorrectiveDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Location, condition, immediate control, or evidence notes"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Due date</span>
                  <input
                    type="date"
                    value={correctiveDraft.dueAt}
                    onChange={(event) => setCorrectiveDraft((current) => ({ ...current, dueAt: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
                  />
                </label>
                <SelectShell
                  label="Observation"
                  value={correctiveDraft.observationType}
                  onChange={(value) => setCorrectiveDraft((current) => ({ ...current, observationType: value as CorrectiveObservationType }))}
                  options={[
                    { label: "Negative", value: "negative" },
                    { label: "Near miss", value: "near_miss" },
                    { label: "Positive", value: "positive" },
                  ]}
                />
                <SelectShell
                  label="SIF potential"
                  value={correctiveDraft.sifPotential}
                  onChange={(value) => setCorrectiveDraft((current) => ({ ...current, sifPotential: value as "yes" | "no" }))}
                  options={[
                    { label: "No", value: "no" },
                    { label: "Yes", value: "yes" },
                  ]}
                />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
                <SelectShell
                  label="Assignee"
                  value={correctiveDraft.assignedUserId}
                  onChange={(value) => setCorrectiveDraft((current) => ({ ...current, assignedUserId: value }))}
                  options={[
                    { label: "Assign later", value: "" },
                    ...dataset.assignableUsers.map((user) => ({ label: `${user.name} - ${user.role}`, value: user.id })),
                  ]}
                />
                {correctiveDraft.observationType === "negative" && correctiveDraft.sifPotential === "yes" ? (
                  <SelectShell
                    label="SIF category"
                    value={correctiveDraft.sifCategory}
                    onChange={(value) => setCorrectiveDraft((current) => ({ ...current, sifCategory: value }))}
                    options={[{ label: "Choose category", value: "" }, ...sifCategories]}
                  />
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => void createCorrectiveAction()}
                  disabled={correctiveSubmitting || !correctiveDraft.title.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus className="h-4 w-4" />
                  {correctiveSubmitting ? "Creating..." : "Create Action"}
                </button>
              </div>
            </>
          ) : null}
        </Card>
      ) : null}

      {workspace === "training" && (trainingAiMessage || trainingAiAssignments.length > 0) ? (
        <Card className="mb-5 p-5">
          <SectionTitle
            title="AI Training Assignments"
            action={<Link href="/training-matrix" className="text-sm font-black text-blue-600">Open training matrix</Link>}
          />
          {trainingAiMessage ? <p className="mt-2 text-sm font-semibold text-slate-600">{trainingAiMessage}</p> : null}
          {trainingAiAssignments.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {trainingAiAssignments.slice(0, 6).map((assignment) => (
                <article key={`${assignment.workerId}-${assignment.title}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{assignment.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{assignment.workerName}</p>
                    </div>
                    <RiskBadge level={assignment.riskLevel} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{assignment.detail}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{assignment.requirementTitle}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">{assignment.action.replace(/_/g, " ")}</span>
                  </div>
                  {assignment.createdActionId ? (
                    <Link href={`/safe-predict/corrective-actions#${assignment.createdActionId}`} className="mt-4 inline-flex text-sm font-black text-blue-600">
                      View queued action
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moduleMetrics(workspace, activeSummary, activeScoped).map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <Card className="mt-5 p-5">
        <div className="grid gap-4 2xl:grid-cols-[1fr_190px_170px_170px_auto] 2xl:items-end">
          <label className="relative block">
            <span className="mb-1 block text-xs font-bold text-slate-600">Search</span>
            <Search className="absolute bottom-3 left-3 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-500"
              placeholder={`Search ${config.title.toLowerCase()}...`}
            />
          </label>
          <SelectShell
            label="Jobsite"
            value={siteFilter}
            onChange={(value) => {
              setSiteFilter(value);
              setSelectedJobsiteId(value);
            }}
            options={[{ label: "All Sites", value: "all" }, ...dataset.jobsites.map((site) => ({ label: site.name, value: site.id }))]}
          />
          <SelectShell
            label="Risk"
            value={riskFilter}
            onChange={(value) => setRiskFilter(value as SafePredictRiskLevel | "all")}
            options={[
              { label: "All Risk", value: "all" },
              { label: "Critical", value: "critical" },
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ]}
          />
          <SelectShell
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All Statuses", value: "all" },
              { label: "Open", value: "Open" },
              { label: "New", value: "New" },
              { label: "In Progress", value: "In Progress" },
              { label: "Awaiting Verification", value: "Awaiting Verification" },
              { label: "Closed", value: "Closed" },
              { label: "Completed", value: "Completed" },
              { label: "Draft", value: "Draft" },
              { label: "Ready", value: "Ready" },
              { label: "Sent", value: "Sent" },
              { label: "Approved", value: "Approved" },
              { label: "Expired", value: "Expired" },
            ]}
          />
          <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-blue-600">
            <FilterX className="h-4 w-4" />
            Clear
          </button>
        </div>
      </Card>

      {workspace === "analytics" ? (
        <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <SectionTitle title={`Risk Forecast - ${selectedForecastTitle}`} />
            <ForecastTrendChart data={riskForecastForSite(activeDataset, selectedForecastSite)} />
          </Card>
          <Card className="p-5">
            <SectionTitle title="Risk Heat Map" />
            <div className="mt-4">
              {dataset.mode === "live" || workspace === "analytics" ? <LiveRiskMap jobsites={activeJobsites} /> : <RiskHeatMap variant="dashboard" />}
            </div>
          </Card>
        </div>
      ) : null}

      {workspace === "analytics" ? (
        <Card className="mt-5 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionTitle title={pageRows.title} action={<span className="text-sm font-black text-slate-500">{pageRows.rows.length} jobsites</span>} />
          </div>
          <DataTable headers={pageRows.headers} rows={pageRows.rows} actions={pageRows.actions} rowIds={pageRows.rowIds} />
        </Card>
      ) : null}

      {workspace === "reports" ? (
        <div className="mt-5 grid gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <SectionTitle title="Launch Readiness Snapshot" />
            <div className="mt-4 space-y-3">
              <NextStepRow title="Jobsite records connected" detail={`${dataset.jobsites.length} jobsites are available in SafePredict.`} tone="blue" icon={<MapPin className="h-5 w-5" />} href="/safe-predict/jobsites" />
              <NextStepRow title="Open work remains" detail={`${activeSummary.openActions} actions are still open across the platform.`} tone="high" icon={<ClipboardCheck className="h-5 w-5" />} href="/safe-predict/corrective-actions" />
              <NextStepRow title="Training risk visible" detail={`${activeSummary.workforce.overdue} workers have overdue readiness items.`} tone="medium" icon={<Users className="h-5 w-5" />} href="/safe-predict/training" />
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Activity Timeline" />
            <div className="mt-5"><EventTimeline events={dataset.events} /></div>
          </Card>
        </div>
      ) : null}

      {workspace === "settings" ? (
        <div className="mt-5 space-y-5">
          <SettingsProfileHub
            user={settingsUser}
            loading={settingsUserLoading}
            message={settingsUserMessage}
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle title="Workspace Data Mode" />
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">SafePredict reads authenticated workspace APIs when live data is enabled. If live data is empty or unavailable, the shell company data keeps the platform ready for walkthroughs.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => setMode("live")} className={cx("rounded-lg border px-4 py-3 text-sm font-black", mode === "live" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}>Live data</button>
                <button type="button" onClick={() => setMode("demo")} className={cx("rounded-lg border px-4 py-3 text-sm font-black", mode === "demo" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}>Sample data</button>
              </div>
            </Card>
            <Card className="p-5">
              <SectionTitle title="Predictability Engine" />
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Choose how predictions move from this company&apos;s own records to anonymized platform benchmark data and OSHA public baseline data.
              </p>
              <div className="mt-5 space-y-3">
                {PREDICTABILITY_DATA_MODES.map((option) => {
                  const selected = predictabilitySettings.predictabilityDataMode === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectPredictabilityMode(option)}
                      className={cx(
                        "w-full rounded-lg border p-4 text-left transition-colors",
                        selected ? "border-blue-500 bg-blue-50 text-blue-950" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                      )}
                    >
                      <span className="block text-sm font-black">{PREDICTABILITY_MODE_LABELS[option]}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                        {PREDICTABILITY_MODE_DESCRIPTIONS[option]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
                Enabled sources: {predictabilitySettings.visibleBenchmarkSources.join(", ").replace("platform_aggregate", "anonymized platform benchmark").replace("osha", "OSHA baseline").replace("company", "company data")}.
              </div>
              {predictabilitySettingsMessage ? (
                <p className="mt-3 text-sm font-bold text-slate-600">{predictabilitySettingsMessage}</p>
              ) : null}
              <button
                type="button"
                onClick={savePredictabilitySettings}
                disabled={predictabilitySettingsLoading || predictabilitySettingsSaving}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {predictabilitySettingsSaving ? "Saving..." : predictabilitySettingsLoading ? "Loading..." : "Save Predictability Settings"}
              </button>
            </Card>
            <Card className="p-5">
              <SectionTitle title="Risk Thresholds" />
              <div className="mt-4 space-y-3 text-sm font-black text-slate-700">
                <p className="flex justify-between rounded-lg bg-red-50 p-3 text-red-700"><span>Critical</span><span>90-100</span></p>
                <p className="flex justify-between rounded-lg bg-orange-50 p-3 text-orange-700"><span>High</span><span>70-89</span></p>
                <p className="flex justify-between rounded-lg bg-amber-50 p-3 text-amber-700"><span>Medium</span><span>40-69</span></p>
                <p className="flex justify-between rounded-lg bg-emerald-50 p-3 text-emerald-700"><span>Low</span><span>0-39</span></p>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {!["analytics", "reports", "settings"].includes(workspace) ? (
        <Card className="mt-5 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionTitle title={pageRows.title} action={<span className="text-sm font-black text-slate-500">{pageRows.rows.length} records</span>} />
          </div>
          {pageRows.cardGrid ? (
            <div className="grid gap-4 p-5 pt-2 md:grid-cols-2 2xl:grid-cols-3">{pageRows.cardGrid}</div>
          ) : (
            <DataTable headers={pageRows.headers} rows={pageRows.rows} actions={pageRows.actions} rowIds={pageRows.rowIds} />
          )}
        </Card>
      ) : null}

      <div className="mt-5">
        <SafePredictOriginalSystemLinks workspace={workspace} />
      </div>
    </div>
  );
}

function moduleMetrics(
  workspace: SafePredictWorkspaceSlug,
  summary: ReturnType<typeof summarizeSafePredictDataset>,
  scoped: ScopedRows
) {
  const scopedOpenActions = scoped.actions.filter((action) => action.status !== "Closed");
  const scopedOverdueActions = scopedOpenActions.filter((action) => {
    const parsed = Date.parse(action.dueDate);
    return Number.isFinite(parsed) && parsed < Date.now();
  });
  const shared = [
    { title: "Sites In Scope", value: summary.jobsites, detail: "Connected records", tone: "blue" as const, icon: <MapPin className="h-7 w-7" /> },
    { title: "Open Actions", value: scopedOpenActions.length, detail: `${scopedOverdueActions.length} overdue`, tone: "orange" as const, icon: <ClipboardCheck className="h-7 w-7" /> },
  ];
  if (workspace === "incidents") return [{ title: "Incident Reviews", value: scoped.incidents.length, detail: "Open and closed", tone: "red" as const, icon: <AlertTriangle className="h-7 w-7" /> }, ...shared, { title: "Near Miss Signals", value: scoped.incidents.filter((row) => row.type === "Near Miss").length, detail: "Last 30 days", tone: "amber" as const, icon: <ShieldAlert className="h-7 w-7" /> }];
  if (workspace === "observations") return [{ title: "Observations", value: scoped.observations.length, detail: "Field signals", tone: "amber" as const, icon: <ShieldAlert className="h-7 w-7" /> }, ...shared, { title: "Converted", value: scoped.observations.filter((row) => row.status === "Converted").length, detail: "To actions", tone: "green" as const, icon: <ShieldCheck className="h-7 w-7" /> }];
  if (workspace === "corrective-actions") return [{ title: "Corrective Actions", value: scoped.actions.length, detail: "In tracker", tone: "orange" as const, icon: <ClipboardCheck className="h-7 w-7" /> }, ...shared, { title: "Closed", value: summary.closedActions, detail: "Verified", tone: "green" as const, icon: <ShieldCheck className="h-7 w-7" /> }];
  if (workspace === "inspections") return [{ title: "Inspections", value: scoped.inspections.length, detail: "Scheduled and complete", tone: "blue" as const, icon: <CalendarCheck className="h-7 w-7" /> }, ...shared, { title: "Failed Checks", value: scoped.inspections.reduce((sum, row) => sum + row.failedItems, 0), detail: "Needs action", tone: "red" as const, icon: <AlertTriangle className="h-7 w-7" /> }];
  if (workspace === "hazards") return [{ title: "Hazards", value: scoped.hazards.length, detail: "Active drivers", tone: "red" as const, icon: <TriangleAlert className="h-7 w-7" /> }, ...shared, { title: "Needs Control", value: scoped.hazards.filter((row) => row.controlStatus !== "Controlled").length, detail: "Open controls", tone: "orange" as const, icon: <ShieldAlert className="h-7 w-7" /> }];
  if (workspace === "training") return [{ title: "Training Compliance", value: `${summary.workforce.compliantPercent}%`, detail: `${summary.workforce.overdue} overdue`, tone: "green" as const, icon: <GraduationCap className="h-7 w-7" /> }, ...shared, { title: "Workers In Scope", value: scoped.employees.length, detail: "Roster rows", tone: "blue" as const, icon: <Users className="h-7 w-7" /> }];
  if (workspace === "permits") return [{ title: "Permit Records", value: scoped.permits.length, detail: `${summary.permits.expired} expired`, tone: "blue" as const, icon: <FileText className="h-7 w-7" /> }, ...shared, { title: "Expiring Soon", value: scoped.permits.filter((row) => row.status === "Expiring Soon").length, detail: "Renewal needed", tone: "amber" as const, icon: <CalendarCheck className="h-7 w-7" /> }];
  if (workspace === "documents") return [{ title: "Documents", value: scoped.documents.length, detail: "Controlled records", tone: "blue" as const, icon: <FileText className="h-7 w-7" /> }, ...shared, { title: "Approved", value: scoped.documents.filter((row) => row.status === "Approved").length, detail: "Current versions", tone: "green" as const, icon: <ShieldCheck className="h-7 w-7" /> }];
  if (workspace === "analytics") {
    const signalCount = summary.openActions + summary.inspectionGaps + summary.incidents + summary.observations + summary.hazards + summary.permits.expiringSoon + summary.permits.expired;
    const trendLabel = signalCount === 0 ? "No Data" : summary.riskScore >= 70 ? "High" : summary.riskScore >= 40 ? "Elevated" : "Moderate";
    const trendTone = signalCount === 0 ? "blue" : summary.riskScore >= 70 ? "red" : summary.riskScore >= 40 ? "orange" : "green";
    return [
      { title: "Risk Trend", value: trendLabel, detail: signalCount === 0 ? "No matching signals" : `${signalCount} filtered signals`, tone: trendTone as "red" | "orange" | "green" | "blue", icon: <BarChart3 className="h-7 w-7" /> },
      ...shared,
      { title: "Risk Score", value: summary.riskScore, detail: summary.jobsites === 1 ? "Selected jobsite" : "Filtered jobsites", tone: summary.riskScore >= 70 ? "red" as const : summary.riskScore >= 40 ? "orange" as const : "green" as const, icon: <ShieldAlert className="h-7 w-7" /> },
    ];
  }
  if (workspace === "reports") return [{ title: "Reports", value: scoped.reports.length, detail: "Ready or draft", tone: "blue" as const, icon: <Download className="h-7 w-7" /> }, ...shared, { title: "Documents", value: scoped.documents.length, detail: "In evidence pack", tone: "green" as const, icon: <FileText className="h-7 w-7" /> }];
  return [{ title: "Mode", value: "Local", detail: "Live data capable", tone: "blue" as const, icon: <Settings className="h-7 w-7" /> }, ...shared, { title: "Jobsites", value: summary.jobsites, detail: "Available", tone: "green" as const, icon: <MapPin className="h-7 w-7" /> }];
}

function buildRows({
  workspace,
  query,
  riskFilter,
  statusFilter,
  scoped,
  jobsites,
  updateActionStatus,
  closeActionWithPhoto,
  createActionFromSignal,
  openPermitComposer,
  assignTrainingWithAi,
}: {
  workspace: SafePredictWorkspaceSlug;
  query: string;
  riskFilter: SafePredictRiskLevel | "all";
  statusFilter: string;
  scoped: ScopedRows;
  jobsites: SafePredictJobsiteRecord[];
  updateActionStatus: (id: string, status: SafePredictActionStatus) => void;
  closeActionWithPhoto: (id: string, file: File) => Promise<{ success: boolean; error?: string }>;
  createActionFromSignal: (signal: { id: string; title: string; siteId: string; riskLevel?: SafePredictRiskLevel; detail?: string; category?: string }) => void;
  openPermitComposer: (siteId?: string, permit?: SafePredictDataset["permits"][number], mode?: SafePredictPermitFormMode) => void;
  assignTrainingWithAi: (worker?: SafePredictDemoEmployee) => void;
}): WorkspaceRows {
  function textMatches(values: string[]) {
    return !query || values.join(" ").toLowerCase().includes(query);
  }
  function statusMatches(status: string) {
    return statusFilter === "all" || status === statusFilter;
  }
  function riskMatches(level?: SafePredictRiskLevel) {
    return riskFilter === "all" || level === riskFilter;
  }

  if (workspace === "corrective-actions") {
    const actions = scoped.actions.filter((action) => textMatches([action.title, action.linkedRisk, action.assignee, action.status]) && statusMatches(action.status) && riskMatches(action.priority));
    return {
      title: "Corrective Action Tracker",
      headers: [],
      rows: [],
      actions: [],
      exportRows: actions,
      cardGrid: actions.map((action) => (
        <div key={action.id} id={action.id} className="scroll-mt-28">
          <CorrectiveActionCard action={action} onStatusChange={updateActionStatus} onCloseWithPhoto={closeActionWithPhoto} />
        </div>
      )) as ReactNode,
    };
  }

  if (workspace === "incidents") {
    const rows = scoped.incidents.filter((row) => textMatches([row.title, row.detail, row.status, row.type]) && statusMatches(row.status) && riskMatches(row.severity));
    return table("Incident Register", ["Incident", "Jobsite", "Type", "Status", "Reported", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.type, row.status, row.reportedAt]), rows.map((row) => ({ label: "Create Action", onClick: () => createActionFromSignal(row) })), rows);
  }

  if (workspace === "observations") {
    const rows = scoped.observations.filter((row) => textMatches([row.title, row.detail, row.category, row.status]) && statusMatches(row.status) && riskMatches(row.riskLevel));
    return table("Observation Signals", ["Observation", "Jobsite", "Category", "Status", "Submitted", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.category, row.status, row.submittedAt]), rows.map((row) => ({ label: "Convert", onClick: () => createActionFromSignal(row) })), rows);
  }

  if (workspace === "inspections") {
    const rows = scoped.inspections.filter((row) => textMatches([row.title, row.checklist, row.inspector, row.status]) && statusMatches(row.status) && riskMatches(row.riskLevel));
    return table("Inspection Queue", ["Inspection", "Jobsite", "Checklist", "Inspector", "Status", "Failed", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.checklist, row.inspector, row.status, `${row.failedItems}`]), rows.map((row) => ({ label: "Action", onClick: () => createActionFromSignal(row) })), rows);
  }

  if (workspace === "hazards") {
    const rows = scoped.hazards.filter((row) => textMatches([row.title, row.controlStatus, row.owner]) && statusMatches(row.controlStatus) && riskMatches(row.riskLevel));
    return table("Hazard Control Register", ["Hazard", "Jobsite", "Control", "Owner", "Due", "Risk", "Action"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.controlStatus, row.owner, row.dueDate, row.riskLevel]), rows.map((row) => ({ label: "Create Control", onClick: () => createActionFromSignal(row) })), rows, rows.map((row) => row.id));
  }

  if (workspace === "training") {
    const rows = scoped.employees.filter((employee) => textMatches([employee.name, employee.trade, employee.role, employee.status]));
    return table(
      "Training & Readiness Roster",
      ["Employee", "Jobsite", "Trade", "Role", "Readiness", "Status"],
      rows.map((row) => [row.name, siteName(row.assignedSiteId, jobsites), row.trade, row.role, `${row.readinessScore}`, row.status]),
      rows.map((row) => ({ label: "Assign", onClick: () => assignTrainingWithAi(row) })),
      rows
    );
  }

  if (workspace === "permits") {
    const rows = scoped.permits.filter((row) => textMatches([row.title || row.type, row.status, row.owner, row.readiness]) && statusMatches(row.status) && riskMatches(row.riskLevel));
    return table(
      "Permit Register",
      ["Permit", "Jobsite", "Status", "Owner", "Expires", "Readiness", "Risk"],
      rows.map((row) => [row.title || row.type, siteName(row.siteId, jobsites), row.status, row.owner, row.expiresAt, row.readiness, row.riskLevel]),
      rows.map((row) => ({
        label: "View",
        onClick: () => openPermitComposer(row.siteId, row, "view"),
        secondaryLabel: "Edit",
        secondaryOnClick: () => openPermitComposer(row.siteId, row, "edit"),
      })),
      rows,
      rows.map((row) => row.id)
    );
  }

  if (workspace === "documents") {
    const rows = scoped.documents.filter((row) => textMatches([row.title, row.type, row.status]) && statusMatches(row.status));
    return table(
      "Document Control Register",
      ["Document", "Jobsite", "Type", "Status", "Updated", "Open"],
      rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.type, row.status, row.updatedAt]),
      rows.map(() => ({ label: "Open", href: mapSafePredictOperationHref("/documents") })),
      rows,
      rows.map((row) => row.id)
    );
  }

  if (workspace === "analytics") {
    return table(
      "Risk Analytics By Jobsite",
      ["Jobsite", "Score", "Open Actions", "Inspection Gaps", "Incidents", "Risk"],
      jobsites.map((site) => {
        const siteActions = scoped.actions.filter((row) => row.siteId === site.id && row.status !== "Closed");
        const inspectionGaps = scoped.inspections.filter((row) => row.siteId === site.id).reduce((sum, row) => sum + row.failedItems, 0);
        const incidents = scoped.incidents.filter((row) => row.siteId === site.id).length;
        return [site.name, `${site.riskScore}`, `${siteActions.length}`, `${inspectionGaps}`, `${incidents}`, site.riskLevel];
      }),
      [],
      jobsites,
      jobsites.map((site) => site.id)
    );
  }

  if (workspace === "reports") {
    const rows = scoped.reports.filter((row) => textMatches([row.title, row.audience, row.status]) && statusMatches(row.status));
    return table("Report Library", ["Report", "Jobsite", "Audience", "Status", "Updated", "Open"], rows.map((row) => [row.title, siteName(row.siteId, jobsites), row.audience, row.status, row.updatedAt]), rows.map(() => ({ label: "Open", href: mapSafePredictOperationHref("/reports") })), rows);
  }

  return table("Platform Settings", ["Setting", "Value", "Status"], [["Data mode", "Live data or sample fallback", "Ready"], ["Risk bands", "Low / Medium / High / Critical", "Ready"], ["Visual system", "SafePredict visual system", "Ready"]], [], []);
}

function table(title: string, headers: string[], rows: string[][], actions: RowAction[], exportRows: unknown[], rowIds?: string[]) {
  return { title, headers, rows, actions, exportRows, rowIds };
}

function DataTable({ headers, rows, actions, rowIds }: { headers: string[]; rows: string[][]; actions: RowAction[]; rowIds?: string[] }) {
  const visibleHeaders = headers.filter((header) => header !== "Action");
  return (
    <>
    <div className="space-y-3 p-4 pt-1 md:hidden">
      {rows.map((row, rowIndex) => (
        <article id={rowIds?.[rowIndex]} key={`workspace-card-${rowIndex}`} className="scroll-mt-28 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-base font-black leading-snug text-slate-950">{row[0]}</p>
          <dl className="mt-3 grid gap-2 text-sm">
            {row.slice(1).map((cell, cellIndex) => (
              <div key={`workspace-card-${rowIndex}-${cellIndex}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="font-bold text-slate-500">{visibleHeaders[cellIndex + 1] ?? "Detail"}</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {["critical", "high", "medium", "low"].includes(cell) ? <RiskBadge level={cell as SafePredictRiskLevel} /> : cell}
                </dd>
              </div>
            ))}
          </dl>
          {actions[rowIndex] ? (
            <div className="mt-4 flex gap-2">
              {actions[rowIndex].href ? (
                <Link href={actions[rowIndex].href} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</Link>
              ) : (
                <button type="button" onClick={actions[rowIndex].onClick} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</button>
              )}
              {actions[rowIndex].secondaryLabel ? (
                <button type="button" onClick={actions[rowIndex].secondaryOnClick} className="inline-flex w-full justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">{actions[rowIndex].secondaryLabel}</button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-500">No records match the current filters.</div>
      ) : null}
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-y border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
            {headers.map((header) => <th key={header} className="px-5 py-3">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr id={rowIds?.[rowIndex]} key={row.join("-")} className="scroll-mt-28 border-b border-slate-100 hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-5 py-3 font-semibold text-slate-700">
                  {cellIndex === row.length - 1 && ["critical", "high", "medium", "low"].includes(cell) ? <RiskBadge level={cell as SafePredictRiskLevel} /> : cell}
                </td>
              ))}
              {actions[rowIndex] ? (
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                  {actions[rowIndex].href ? (
                    <Link href={actions[rowIndex].href} className="inline-flex rounded-md border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</Link>
                  ) : (
                    <button type="button" onClick={actions[rowIndex].onClick} className="inline-flex rounded-md border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">{actions[rowIndex].label}</button>
                  )}
                  {actions[rowIndex].secondaryLabel ? (
                    <button type="button" onClick={actions[rowIndex].secondaryOnClick} className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">{actions[rowIndex].secondaryLabel}</button>
                  ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No records match the current filters.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
    </>
  );
}
