"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileDown,
  ListChecks,
  MailPlus,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeRowsArray,
  type ImportRowError,
  validateEmployeeImportRows,
} from "@/lib/companyOnboardingImport";
import {
  ActivityFeed,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import {
  demoCompanyInvites,
  demoCompanyJobsiteRows,
  demoCompanyProfile,
  demoCompanyUsers,
  demoJobsiteAssignments,
} from "@/lib/demoWorkspace";
import type {
  CompanyDataRequest,
  CompanyDataRequestScope,
  CompanyDataRequestType,
  CompanySecurityEvent,
} from "@/types/enterprise-readiness";
import {
  buildWorkforceCommandCenter,
  roleNeedsAssignments,
  type WorkforceActionItem,
  type WorkforceReadiness,
  type WorkspaceLoadState,
} from "./workforce-logic";

const supabase = getSupabaseBrowserClient();

type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type LeadershipSafetyScoreSummary = {
  userId: string;
  userName?: string;
  roleLabel: string;
  score: number;
  grade: string;
  trend: number;
  positiveSignals?: Array<{ label?: string; detail?: string }>;
  negativeSignals?: Array<{ label?: string; detail?: string }>;
  evidenceRefs?: Array<{ label?: string; href?: string }>;
  coachingPrompt?: string;
};

type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
  signup_url?: string | null;
};

type TrackedEmployee = {
  id: string;
  external_employee_id?: string | null;
  full_name: string;
  email?: string | null;
  job_title?: string | null;
  trade_specialty?: string | null;
  readiness_status?: string | null;
  status?: string | null;
  trainingRecords?: Array<{ id: string }>;
  jobsiteAssignments?: Array<{ id: string; jobsite_id: string; status?: string | null }>;
};

type TrackedEmployeeForm = {
  employee_id: string;
  full_name: string;
  email: string;
  job_title: string;
  trade_specialty: string;
  readiness_status: string;
  status: string;
  certifications: string;
};

type Jobsite = {
  id: string;
  name: string;
  status: string;
};

type EnvDetails = {
  url?: boolean;
  serviceRoleKey?: boolean;
  sources?: {
    url?: string | null;
    serviceRoleKey?: string | null;
  };
};

type WorkspaceData = {
  users: CompanyUser[];
  invites: CompanyInvite[];
  leadershipScores: LeadershipSafetyScoreSummary[];
  jobsites: Jobsite[];
  assignmentMap: Record<string, string[]>;
  trackedEmployees: TrackedEmployee[];
  securityEvents: CompanySecurityEvent[];
  dataRequests: CompanyDataRequest[];
  scopeTeam: string;
  scopeCompanyName: string;
  demoMode: boolean;
};

type TabId = "overview" | "access" | "users" | "training" | "audit";
type SecurityAuditView = "events" | "data_requests";

const emptyWorkspace: WorkspaceData = {
  users: [],
  invites: [],
  leadershipScores: [],
  jobsites: [],
  assignmentMap: {},
  trackedEmployees: [],
  securityEvents: [],
  dataRequests: [],
  scopeTeam: "General",
  scopeCompanyName: "General",
  demoMode: false,
};

const emptyLoadState: WorkspaceLoadState = {
  loading: true,
  criticalErrors: [],
  warnings: [],
};

const emptyTrackedEmployeeForm: TrackedEmployeeForm = {
  employee_id: "",
  full_name: "",
  email: "",
  job_title: "",
  trade_specialty: "",
  readiness_status: "ready",
  status: "active",
  certifications: "",
};

const roleOptions = [
  "Company Admin",
  "Operations Manager",
  "Safety Manager",
  "Project Manager",
  "Field Supervisor",
  "Foreman",
  "Field User",
  "Read Only",
  "Company User",
];

const fieldClassName =
  "w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]";

const compactCardClassName =
  "rounded-lg border border-[var(--app-border)] bg-white/92 p-4 shadow-[var(--app-shadow-soft)]";

function formatEnvDetails(details?: EnvDetails | null) {
  if (!details) return "";
  const urlText = details.url
    ? `URL from ${details.sources?.url ?? "unknown source"}`
    : "URL missing";
  const serviceRoleText = details.serviceRoleKey
    ? `service role from ${details.sources?.serviceRoleKey ?? "unknown source"}`
    : "service role missing";
  return ` Server check: ${urlText}; ${serviceRoleText}.`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatSecurityEventLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readinessLabel(value?: string | null) {
  return formatSecurityEventLabel(String(value || "ready"));
}

function getProfileHref(userId: string) {
  return `/profile?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent(
    "/company-users"
  )}`;
}

function getInviteSignupUrl(invite: CompanyInvite) {
  if (invite.signup_url) return invite.signup_url;
  if (typeof window === "undefined") return "";
  const url = new URL("/login", window.location.origin);
  url.searchParams.set("mode", "signup");
  url.searchParams.set("email", invite.email);
  url.searchParams.set("invite", "company");
  return url.toString();
}

function roleClasses(role: string) {
  if (role === "Safety Manager") return "app-badge-success";
  if (role === "Project Manager") return "app-badge-indigo";
  if (role === "Field Supervisor" || role === "Foreman") return "app-badge-cyan";
  if (role === "Field User") return "app-badge-lime";
  if (role === "Company Admin") return "app-badge-accent";
  if (role === "Operations Manager") return "app-badge-info";
  if (role === "Company User") return "app-badge-warning";
  return "app-badge-neutral";
}

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (status === "Suspended") return "error";
  return "neutral";
}

function readinessTone(readiness: WorkforceReadiness): "success" | "warning" | "error" {
  if (readiness === "healthy") return "success";
  if (readiness === "blocked") return "error";
  return "warning";
}

function dataRequestStatusTone(status: string): "success" | "warning" | "error" | "neutral" | "info" {
  if (status === "completed") return "success";
  if (status === "denied" || status === "canceled") return "error";
  if (status === "waiting_on_customer") return "warning";
  if (status === "reviewing") return "info";
  return "neutral";
}

function formatDemoRole(role: string) {
  const normalized = role.trim().toLowerCase();
  if (normalized === "company_admin") return "Company Admin";
  if (normalized === "safety_manager") return "Safety Manager";
  if (normalized === "project_manager") return "Project Manager";
  if (normalized === "field_supervisor") return "Field Supervisor";
  if (normalized === "foreman") return "Foreman";
  if (normalized === "field_user") return "Field User";
  if (normalized === "read_only") return "Read Only";
  return role;
}

async function fetchJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await response.json().catch(() => null)) as (T & {
    error?: string;
    details?: EnvDetails;
  }) | null;
  if (!response.ok) {
    throw new Error(`${data?.error || `Request failed: ${url}`}${formatEnvDetails(data?.details)}`);
  }
  return (data ?? {}) as T;
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

async function isSalesDemoToken(token: string) {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => null)) as
    | { user?: { role?: string | null } }
    | null;
  return response.ok && data?.user?.role === "sales_demo";
}

function demoWorkspace(): WorkspaceData {
  const now = Date.now();
  const users = demoCompanyUsers.map((user, index) => ({
    ...user,
    role: formatDemoRole(user.role),
    status: index === 3 ? "Pending" : user.status,
    last_sign_in_at: new Date(now - index * 17 * 60000).toISOString(),
    created_at: new Date(now - (index + 1) * 24 * 60 * 60000).toISOString(),
  }));
  const assignmentMap: Record<string, string[]> = {};
  for (const row of demoJobsiteAssignments) {
    assignmentMap[row.user_id] = assignmentMap[row.user_id]
      ? [...assignmentMap[row.user_id], row.jobsite_id]
      : [row.jobsite_id];
  }
  const staleInviteDate = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
  const invites = [
    ...demoCompanyInvites.map((invite, index) => ({
      ...invite,
      created_at: index === 0 ? staleInviteDate : invite.created_at,
    })),
    {
      id: "demo-invite-estimator",
      email: "estimator.demo@summitridge.example",
      role: "Read Only",
      status: "Pending",
      created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
  const trackedEmployees: TrackedEmployee[] = [
    {
      id: "demo-tracked-1",
      external_employee_id: "SR-044",
      full_name: "Maya Rodriguez",
      email: "maya.rodriguez@example.com",
      job_title: "Crane Signal Person",
      trade_specialty: "Hoisting",
      readiness_status: "needs_training",
      status: "active",
      trainingRecords: [{ id: "demo-training-1" }],
      jobsiteAssignments: [],
    },
    {
      id: "demo-tracked-2",
      external_employee_id: "SR-052",
      full_name: "Andre Bell",
      email: "andre.bell@example.com",
      job_title: "Concrete Finisher",
      trade_specialty: "Concrete",
      readiness_status: "ready",
      status: "active",
      trainingRecords: [{ id: "demo-training-2" }, { id: "demo-training-3" }],
      jobsiteAssignments: [{ id: "demo-employee-assignment-1", jobsite_id: "demo-jobsite-1", status: "active" }],
    },
  ];
  const leadershipScores = users.slice(0, 3).map((user, index) => ({
    userId: user.id,
    userName: user.name,
    roleLabel: user.role,
    score: [91, 84, 73][index] ?? 82,
    grade: ["A", "B", "C"][index] ?? "B",
    trend: [4, 1, -3][index] ?? 0,
    positiveSignals: [
      {
        label: "Risk actions reviewed",
        detail: "Recent risk follow-through is visible for assigned work.",
      },
    ],
    negativeSignals:
      index === 2
        ? [
            {
              label: "Closeout discipline",
              detail: "Assigned work includes open permit and JSA closeout items.",
            },
          ]
        : [],
    coachingPrompt:
      index === 2
        ? "Coach toward faster end-of-shift closeout and supervisor verification."
        : "Keep reinforcing prompt risk-response and documented follow-through.",
  }));
  const securityEvents: CompanySecurityEvent[] = [
    {
      id: "demo-event-invite",
      company_id: "demo-company",
      jobsite_id: null,
      actor_user_id: "demo-admin",
      actor_role: "company_admin",
      event_type: "user_invited",
      resource_type: "company_invite",
      resource_id: invites[0]?.id ?? null,
      title: "Company invite created",
      detail: "Invite evidence for IT review.",
      ip_address: null,
      user_agent: null,
      metadata: {},
      occurred_at: new Date(now - 12 * 60000).toISOString(),
    },
    {
      id: "demo-event-role",
      company_id: "demo-company",
      jobsite_id: null,
      actor_user_id: "demo-admin",
      actor_role: "company_admin",
      event_type: "user_access_updated",
      resource_type: "company_user",
      resource_id: users[0]?.id ?? null,
      title: "Company access updated",
      detail: "Role and assignment changes appear in this ledger.",
      ip_address: null,
      user_agent: null,
      metadata: {},
      occurred_at: new Date(now - 38 * 60000).toISOString(),
    },
  ];
  const dataRequests: CompanyDataRequest[] = [
    {
      id: "demo-data-request-1",
      company_id: "demo-company",
      request_type: "export",
      request_scope: "company",
      subject_user_id: null,
      subject_email: null,
      jobsite_id: null,
      document_id: null,
      status: "submitted",
      requested_by: "demo-admin",
      reviewed_by: null,
      completed_by: null,
      title: "Quarterly access export",
      description: "Export current access, role, invite, and suspension evidence.",
      reviewer_notes: null,
      completion_evidence: null,
      evidence_storage_path: null,
      metadata: {},
      due_at: null,
      reviewed_at: null,
      completed_at: null,
      created_at: new Date(now - 2 * 60 * 60000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60000).toISOString(),
    },
  ];

  return {
    users,
    invites,
    leadershipScores,
    jobsites: demoCompanyJobsiteRows.map((jobsite) => ({
      id: jobsite.id,
      name: jobsite.name,
      status: jobsite.status,
    })),
    assignmentMap,
    trackedEmployees,
    securityEvents,
    dataRequests,
    scopeTeam: "Demo Workspace",
    scopeCompanyName: demoCompanyProfile.name ?? "Summit Ridge Constructors",
    demoMode: true,
  };
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}) {
  return (
    <div className={compactCardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--app-text-strong)]">{value}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm leading-5 text-[var(--app-text)]">{detail}</p>
        <StatusBadge label={value} tone={tone} />
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleClasses(role)}`}>
      {role}
    </span>
  );
}

function TabButton({
  tab,
  label,
  activeTab,
  count,
  onClick,
}: {
  tab: TabId;
  label: string;
  activeTab: TabId;
  count?: number;
  onClick: (tab: TabId) => void;
}) {
  const isActive = activeTab === tab;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onClick(tab)}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
        isActive
          ? "bg-[var(--app-accent-primary)] text-white shadow-[var(--app-shadow-primary-button)]"
          : "text-[var(--app-text)] hover:bg-[var(--app-accent-primary-soft)] hover:text-[var(--app-text-strong)]"
      }`}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            isActive ? "bg-white/18 text-white" : "bg-[var(--semantic-neutral-bg)] text-[var(--app-muted)]"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export default function CompanyUsersPage() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [loadState, setLoadState] = useState<WorkspaceLoadState>(emptyLoadState);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Company User");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [editRole, setEditRole] = useState("Company User");
  const [editStatus, setEditStatus] = useState("Active");
  const [editAssignments, setEditAssignments] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [securityAuditView, setSecurityAuditView] = useState<SecurityAuditView>("events");
  const [dataRequestType, setDataRequestType] = useState<CompanyDataRequestType>("export");
  const [dataRequestScope, setDataRequestScope] = useState<CompanyDataRequestScope>("company");
  const [dataRequestTitle, setDataRequestTitle] = useState("");
  const [dataRequestDescription, setDataRequestDescription] = useState("");
  const [trackedRosterMessage, setTrackedRosterMessage] = useState("");
  const [trackedRosterMessageTone, setTrackedRosterMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");
  const [trackedEmployeeForm, setTrackedEmployeeForm] = useState<TrackedEmployeeForm>(
    emptyTrackedEmployeeForm
  );
  const [editingTrackedEmployee, setEditingTrackedEmployee] = useState<TrackedEmployee | null>(null);
  const [assigningTrackedEmployee, setAssigningTrackedEmployee] = useState<TrackedEmployee | null>(null);
  const [trackedEditAssignments, setTrackedEditAssignments] = useState<string[]>([]);
  const [trackedRosterRowErrors, setTrackedRosterRowErrors] = useState<ImportRowError[]>([]);

  const loadWorkspace = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setLoadState((current) => ({ ...current, loading: true }));
    if (!options?.preserveMessage) {
      setMessage("");
      setMessageTone("neutral");
    }

    try {
      const token = await getAccessToken();
      if (await isSalesDemoToken(token)) {
        setWorkspace(demoWorkspace());
        setLoadState({ loading: false, criticalErrors: [], warnings: [] });
        return;
      }

      const results = await Promise.allSettled([
        fetchJson<{
          users?: CompanyUser[];
          invites?: CompanyInvite[];
          scopeTeam?: string;
          scopeCompanyName?: string;
        }>("/api/company/users", token),
        fetchJson<{
          jobsites?: Jobsite[];
          assignments?: Array<{ user_id?: string; jobsite_id?: string }>;
        }>("/api/company/jobsite-assignments", token),
        fetchJson<{ scores?: LeadershipSafetyScoreSummary[] }>(
          "/api/company/leadership-safety-scores",
          token
        ),
        fetchJson<{ employees?: TrackedEmployee[]; warning?: string | null }>(
          "/api/company/tracked-employees",
          token
        ),
        fetchJson<{ events?: CompanySecurityEvent[] }>("/api/company/security/events?limit=25", token),
        fetchJson<{ requests?: CompanyDataRequest[] }>("/api/company/data-requests?limit=25", token),
      ]);

      const warnings: string[] = [];
      const criticalErrors: string[] = [];
      const usersResult = results[0];
      if (usersResult.status === "rejected") {
        criticalErrors.push(usersResult.reason instanceof Error ? usersResult.reason.message : "Failed to load company users.");
      }

      const userData = usersResult.status === "fulfilled" ? usersResult.value : {};
      const assignmentData = results[1].status === "fulfilled" ? results[1].value : {};
      const scoreData = results[2].status === "fulfilled" ? results[2].value : {};
      const trackedData = results[3].status === "fulfilled" ? results[3].value : {};
      const eventData = results[4].status === "fulfilled" ? results[4].value : {};
      const requestData = results[5].status === "fulfilled" ? results[5].value : {};

      results.forEach((result, index) => {
        if (index === 0 || result.status === "fulfilled") return;
        warnings.push(result.reason instanceof Error ? result.reason.message : "A supporting workforce panel could not load.");
      });
      if (trackedData.warning) warnings.push(trackedData.warning);

      const assignmentMap: Record<string, string[]> = {};
      for (const row of assignmentData.assignments ?? []) {
        const userId = row.user_id?.trim() ?? "";
        const jobsiteId = row.jobsite_id?.trim() ?? "";
        if (!userId || !jobsiteId) continue;
        assignmentMap[userId] = assignmentMap[userId] ? [...assignmentMap[userId], jobsiteId] : [jobsiteId];
      }

      setWorkspace({
        users: userData.users ?? [],
        invites: userData.invites ?? [],
        leadershipScores: scoreData.scores ?? [],
        jobsites: assignmentData.jobsites ?? [],
        assignmentMap,
        trackedEmployees: trackedData.employees ?? [],
        securityEvents: eventData.events ?? [],
        dataRequests: requestData.requests ?? [],
        scopeTeam: userData.scopeTeam ?? "General",
        scopeCompanyName: userData.scopeCompanyName ?? userData.scopeTeam ?? "General",
        demoMode: false,
      });
      setLoadState({ loading: false, criticalErrors, warnings });
    } catch (error) {
      setWorkspace((current) => ({ ...current, users: [], invites: [] }));
      setLoadState({
        loading: false,
        criticalErrors: [error instanceof Error ? error.message : "Failed to load workforce operations."],
        warnings: [],
      });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadWorkspace();
    });
  }, [loadWorkspace]);

  const activeJobsiteCount = useMemo(
    () => workspace.jobsites.filter((jobsite) => jobsite.status !== "archived").length,
    [workspace.jobsites]
  );
  const dataRequestReviewCount = useMemo(
    () =>
      workspace.dataRequests.filter(
        (request) =>
          request.status !== "completed" &&
          request.status !== "denied" &&
          request.status !== "canceled"
      ).length,
    [workspace.dataRequests]
  );
  const commandCenter = useMemo(
    () =>
      buildWorkforceCommandCenter({
        users: workspace.users,
        invites: workspace.invites,
        trackedEmployees: workspace.trackedEmployees,
        assignmentMap: workspace.assignmentMap,
        activeJobsiteCount,
        dataRequestReviewCount,
        loadState,
      }),
    [
      activeJobsiteCount,
      dataRequestReviewCount,
      loadState,
      workspace.assignmentMap,
      workspace.invites,
      workspace.trackedEmployees,
      workspace.users,
    ]
  );
  const jobsiteNameById = useMemo(
    () =>
      workspace.jobsites.reduce<Record<string, string>>((acc, jobsite) => {
        acc[jobsite.id] = jobsite.name;
        return acc;
      }, {}),
    [workspace.jobsites]
  );
  const activeTrackedEmployees = useMemo(
    () => workspace.trackedEmployees.filter((employee) => employee.status !== "archived"),
    [workspace.trackedEmployees]
  );
  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const users = workspace.users.filter((user) => user.status === "Active" || user.status === "Suspended");
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.role, user.status].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [searchTerm, workspace.users]);
  const leadershipRows = useMemo(() => {
    const byId = new Map(workspace.leadershipScores.map((score) => [score.userId, score]));
    return workspace.users
      .map((user) => ({ user, score: byId.get(user.id) }))
      .filter((row): row is { user: CompanyUser; score: LeadershipSafetyScoreSummary } => Boolean(row.score))
      .sort((a, b) => a.score.score - b.score.score)
      .slice(0, 3);
  }, [workspace.leadershipScores, workspace.users]);
  const activityItems = useMemo(() => {
    const userItems = workspace.users.map((user) => ({
      id: user.id,
      sortAt: new Date(user.last_sign_in_at ?? user.created_at ?? 0).getTime(),
      title: user.status === "Pending" ? `${user.name} is waiting for access` : `${user.name} is ${user.status.toLowerCase()}`,
      detail:
        user.status === "Pending"
          ? "This employee needs approval before entering the company workspace."
          : `${user.role} / ${workspace.scopeCompanyName}`,
      meta: formatRelative(user.last_sign_in_at ?? user.created_at),
      tone: user.status === "Pending" ? ("warning" as const) : ("info" as const),
    }));
    const inviteItems = workspace.invites.map((invite) => ({
      id: `invite-${invite.id}`,
      sortAt: new Date(invite.created_at ?? 0).getTime(),
      title: `${invite.email} was invited`,
      detail: `Waiting for account setup as ${invite.role}.`,
      meta: formatRelative(invite.created_at),
      tone: "warning" as const,
    }));
    const items = [...userItems, ...inviteItems].sort((a, b) => b.sortAt - a.sortAt).slice(0, 6);
    return items.length
      ? items
      : [
          {
            id: "empty-company-activity",
            title: "No company activity yet",
            detail: "Invites, approvals, and access changes will appear here.",
            meta: "Waiting",
            tone: "neutral" as const,
          },
        ];
  }, [workspace.invites, workspace.scopeCompanyName, workspace.users]);
  const securityEventItems = useMemo(
    () =>
      workspace.securityEvents.length
        ? workspace.securityEvents.map((event) => ({
            id: event.id,
            title: event.title || formatSecurityEventLabel(event.event_type),
            detail:
              event.detail ||
              `${formatSecurityEventLabel(event.event_type)} against ${formatSecurityEventLabel(
                event.resource_type
              )}.`,
            meta: formatRelative(event.occurred_at),
            tone: event.event_type.includes("removed") || event.event_type.includes("suspended")
              ? ("warning" as const)
              : ("info" as const),
          }))
        : [
            {
              id: "empty-security-events",
              title: "No security ledger events yet",
              detail: "Invite, access, export, download, and data request evidence will appear here.",
              meta: "Waiting",
              tone: "neutral" as const,
            },
          ],
    [workspace.securityEvents]
  );

  function openUserManager(user: CompanyUser, nextStatus?: "Active" | "Suspended" | "Pending") {
    setEditingUser(user);
    setEditRole(user.role);
    setEditStatus(nextStatus ?? (user.status === "Suspended" ? "Suspended" : user.status === "Pending" ? "Pending" : "Active"));
    setEditAssignments(workspace.assignmentMap[user.id] ?? []);
  }

  function openTrackedEmployeeEditor(employee: TrackedEmployee) {
    setEditingTrackedEmployee(employee);
    setTrackedEmployeeForm({
      employee_id: employee.external_employee_id ?? "",
      full_name: employee.full_name,
      email: employee.email ?? "",
      job_title: employee.job_title ?? "",
      trade_specialty: employee.trade_specialty ?? "",
      readiness_status: employee.readiness_status ?? "ready",
      status: employee.status ?? "active",
      certifications: "",
    });
    setTrackedRosterMessage("");
  }

  function resetTrackedEmployeeEditor() {
    setEditingTrackedEmployee(null);
    setTrackedEmployeeForm(emptyTrackedEmployeeForm);
  }

  function getAssignmentSummary(user: CompanyUser) {
    if (!roleNeedsAssignments(user.role)) {
      return { label: "Company-wide", detail: "All jobsites through role", tone: "success" as const };
    }
    const assignedIds = workspace.assignmentMap[user.id] ?? [];
    if (!assignedIds.length) {
      return { label: "No jobsites", detail: "Needs assignment", tone: "warning" as const };
    }
    const names = assignedIds.map((id) => jobsiteNameById[id] ?? "Unknown jobsite").slice(0, 2);
    const extra = assignedIds.length - names.length;
    return {
      label: `${assignedIds.length} assigned`,
      detail: `${names.join(", ")}${extra > 0 ? ` +${extra} more` : ""}`,
      tone: "info" as const,
    };
  }

  function getTrackedAssignmentSummary(employee: TrackedEmployee) {
    const assignedIds = (employee.jobsiteAssignments ?? [])
      .filter((assignment) => String(assignment.status ?? "active").toLowerCase() === "active")
      .map((assignment) => assignment.jobsite_id);
    if (!assignedIds.length) {
      return { label: "No jobsites", detail: "Needs assignment", tone: "warning" as const };
    }
    const names = assignedIds.map((id) => jobsiteNameById[id] ?? "Unknown jobsite").slice(0, 2);
    const extra = assignedIds.length - names.length;
    return {
      label: `${assignedIds.length} assigned`,
      detail: `${names.join(", ")}${extra > 0 ? ` +${extra} more` : ""}`,
      tone: "info" as const,
    };
  }

  function openTrackedAssignmentManager(employee: TrackedEmployee) {
    setAssigningTrackedEmployee(employee);
    setTrackedEditAssignments(
      (employee.jobsiteAssignments ?? [])
        .filter((assignment) => String(assignment.status ?? "active").toLowerCase() === "active")
        .map((assignment) => assignment.jobsite_id)
    );
  }

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setMessageTone("warning");
      setMessage("Enter a valid employee email before sending an invite.");
      return;
    }

    setBusyAction("invite");
    setMessage("");
    try {
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          invites: [
            {
              id: `demo-invite-${Date.now()}`,
              email,
              role: inviteRole,
              status: "Pending",
              created_at: new Date().toISOString(),
            },
            ...current.invites,
          ],
        }));
        setInviteEmail("");
        setInviteRole("Company User");
        setMessageTone("success");
        setMessage("Demo invite added locally for this session.");
        return;
      }

      const token = await getAccessToken();
      const data = await fetchJson<{ message?: string; warning?: string; inviteUrl?: string | null }>(
        "/api/company/users",
        token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role: inviteRole }),
        }
      );
      setInviteEmail("");
      setInviteRole("Company User");
      setMessageTone(data.warning ? "warning" : "success");
      setMessage(
        data.warning ||
          (data.inviteUrl
            ? `${data.message || "Company user invited successfully."} Invite link: ${data.inviteUrl}`
            : data.message || "Company user invited successfully.")
      );
      await loadWorkspace({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to invite company user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQuickStatus(user: CompanyUser, nextStatus: "Active" | "Suspended") {
    if (
      nextStatus === "Active" &&
      roleNeedsAssignments(user.role) &&
      activeJobsiteCount > 0 &&
      (workspace.assignmentMap[user.id] ?? []).length === 0
    ) {
      setMessageTone("warning");
      setMessage("Assign at least one jobsite before approving this field-scoped app user.");
      openUserManager(user, "Active");
      return;
    }

    const actionKey = `status-${user.id}-${nextStatus}`;
    setBusyAction(actionKey);
    setMessage("");
    try {
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          users: current.users.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)),
        }));
        setMessageTone(nextStatus === "Active" ? "success" : "warning");
        setMessage(nextStatus === "Active" ? `${user.name} approved.` : `${user.name} suspended.`);
        return;
      }

      const token = await getAccessToken();
      await fetchJson(`/api/company/users/${user.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: user.role, accountStatus: nextStatus }),
      });
      setMessageTone(nextStatus === "Active" ? "success" : "warning");
      setMessage(
        nextStatus === "Active"
          ? `${user.name} has been approved for the company workspace.`
          : `${user.name} has been suspended from the company workspace.`
      );
      await loadWorkspace({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update company user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    if (
      editStatus === "Active" &&
      roleNeedsAssignments(editRole) &&
      activeJobsiteCount > 0 &&
      editAssignments.length === 0
    ) {
      setMessageTone("warning");
      setMessage("Assign at least one jobsite before saving this active field-scoped user.");
      return;
    }

    setBusyAction(`save-${editingUser.id}`);
    setMessage("");
    try {
      const nextAssignments = roleNeedsAssignments(editRole) ? editAssignments : [];
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          users: current.users.map((user) =>
            user.id === editingUser.id ? { ...user, role: editRole, status: editStatus } : user
          ),
          assignmentMap: {
            ...current.assignmentMap,
            [editingUser.id]: nextAssignments,
          },
        }));
        setEditingUser(null);
        setMessageTone("success");
        setMessage("Demo user updated locally for this session.");
        return;
      }

      const token = await getAccessToken();
      await fetchJson(`/api/company/users/${editingUser.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole, accountStatus: editStatus }),
      });
      await fetchJson("/api/company/jobsite-assignments", token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, jobsiteIds: nextAssignments }),
      });
      setEditingUser(null);
      setMessageTone("success");
      setMessage("Company user updated.");
      await loadWorkspace({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update company user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemoveUser() {
    if (!editingUser) return;
    const confirmed = window.confirm(
      `Remove ${editingUser.name} from ${workspace.scopeCompanyName}? This revokes company access and suspends the account until reassigned.`
    );
    if (!confirmed) return;

    setBusyAction(`remove-${editingUser.id}`);
    setMessage("");
    try {
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          users: current.users.filter((user) => user.id !== editingUser.id),
        }));
        setEditingUser(null);
        setMessageTone("success");
        setMessage("Demo user removed locally for this session.");
        return;
      }
      const token = await getAccessToken();
      const data = await fetchJson<{ message?: string }>(`/api/company/users/${editingUser.id}`, token, {
        method: "DELETE",
      });
      setEditingUser(null);
      setMessageTone("success");
      setMessage(data.message || "User removed from the company workspace successfully.");
      await loadWorkspace({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to remove company user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTrackedRosterUpload(file: File | null) {
    if (!file) return;
    setBusyAction("roster-upload");
    setTrackedRosterMessage("");
    setTrackedRosterMessageTone("neutral");
    setTrackedRosterRowErrors([]);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("The uploaded file does not contain a worksheet.");
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
        defval: "",
        raw: false,
      });
      const rows = normalizeRowsArray(rawRows);
      const validation = validateEmployeeImportRows(rows);
      if (rows.length === 0) {
        setTrackedRosterMessageTone("warning");
        setTrackedRosterMessage("The roster file did not contain any rows to import.");
        return;
      }
      if (validation.validRows.length === 0) {
        setTrackedRosterRowErrors(validation.rowErrors);
        setTrackedRosterMessageTone("error");
        setTrackedRosterMessage(validation.rowErrors[0]?.message ?? "No valid roster rows were found.");
        return;
      }
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          trackedEmployees: [
            ...validation.validRows.map((row) => ({
              id: `demo-imported-${row.rowNumber}-${Date.now()}`,
              external_employee_id: row.externalEmployeeId,
              full_name: row.fullName,
              email: row.email,
              job_title: row.jobTitle,
              trade_specialty: row.tradeSpecialty,
              readiness_status: row.readinessStatus,
              status: row.status,
              trainingRecords: [],
              jobsiteAssignments: [],
            })),
            ...current.trackedEmployees,
          ],
        }));
        setTrackedRosterRowErrors(validation.rowErrors);
        setTrackedRosterMessageTone(validation.rowErrors.length ? "warning" : "success");
        setTrackedRosterMessage(`Imported ${validation.validRows.length} demo roster row(s).`);
        return;
      }
      const token = await getAccessToken();
      const data = await fetchJson<{
        acceptedCount?: number;
        rowErrors?: ImportRowError[];
      }>("/api/company/onboarding/import", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: rows, source: "company_users_roster_upload" }),
      });
      setTrackedRosterRowErrors(data.rowErrors ?? validation.rowErrors);
      await loadWorkspace({ preserveMessage: true });
      setTrackedRosterMessageTone(data.rowErrors?.length ? "warning" : "success");
      setTrackedRosterMessage(`Imported ${data.acceptedCount ?? validation.validRows.length} roster row(s).`);
    } catch (error) {
      setTrackedRosterMessageTone("error");
      setTrackedRosterMessage(error instanceof Error ? error.message : "Roster import failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveTrackedEmployee() {
    if (!trackedEmployeeForm.full_name.trim()) {
      setTrackedRosterMessageTone("warning");
      setTrackedRosterMessage("Full name is required before adding a training-only person.");
      return;
    }

    setBusyAction("tracked-save");
    setTrackedRosterMessage("");
    try {
      if (workspace.demoMode) {
        const nextEmployee: TrackedEmployee = {
          id: editingTrackedEmployee?.id ?? `demo-tracked-${Date.now()}`,
          external_employee_id: trackedEmployeeForm.employee_id || null,
          full_name: trackedEmployeeForm.full_name,
          email: trackedEmployeeForm.email || null,
          job_title: trackedEmployeeForm.job_title || null,
          trade_specialty: trackedEmployeeForm.trade_specialty || null,
          readiness_status: trackedEmployeeForm.readiness_status,
          status: trackedEmployeeForm.status,
          trainingRecords: editingTrackedEmployee?.trainingRecords ?? [],
          jobsiteAssignments: editingTrackedEmployee?.jobsiteAssignments ?? [],
        };
        setWorkspace((current) => ({
          ...current,
          trackedEmployees: editingTrackedEmployee
            ? current.trackedEmployees.map((employee) =>
                employee.id === editingTrackedEmployee.id ? nextEmployee : employee
              )
            : [nextEmployee, ...current.trackedEmployees],
        }));
        resetTrackedEmployeeEditor();
        setTrackedRosterMessageTone("success");
        setTrackedRosterMessage("Training-only person saved in demo mode.");
        return;
      }
      const token = await getAccessToken();
      await fetchJson(
        editingTrackedEmployee
          ? `/api/company/tracked-employees/${editingTrackedEmployee.id}`
          : "/api/company/tracked-employees",
        token,
        {
          method: editingTrackedEmployee ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trackedEmployeeForm),
        }
      );
      resetTrackedEmployeeEditor();
      await loadWorkspace({ preserveMessage: true });
      setTrackedRosterMessageTone("success");
      setTrackedRosterMessage(
        editingTrackedEmployee ? "Training-only person updated." : "Training-only person added without app access."
      );
    } catch (error) {
      setTrackedRosterMessageTone("error");
      setTrackedRosterMessage(
        error instanceof Error ? error.message : "Failed to save training-only person."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveTrackedAssignments() {
    if (!assigningTrackedEmployee) return;
    const nextAssignments = trackedEditAssignments;
    setBusyAction(`tracked-assign-${assigningTrackedEmployee.id}`);
    setTrackedRosterMessage("");
    try {
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          trackedEmployees: current.trackedEmployees.map((employee) =>
            employee.id === assigningTrackedEmployee.id
              ? {
                  ...employee,
                  jobsiteAssignments: nextAssignments.map((jobsiteId) => ({
                    id: `demo-tracked-assignment-${employee.id}-${jobsiteId}`,
                    jobsite_id: jobsiteId,
                    status: "active",
                  })),
                }
              : employee
          ),
        }));
        setAssigningTrackedEmployee(null);
        setTrackedRosterMessageTone("success");
        setTrackedRosterMessage("Training-only jobsite assignments saved in demo mode.");
        return;
      }

      const token = await getAccessToken();
      await fetchJson(
        `/api/company/tracked-employees/${assigningTrackedEmployee.id}/jobsite-assignments`,
        token,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobsiteIds: nextAssignments }),
        }
      );
      setAssigningTrackedEmployee(null);
      await loadWorkspace({ preserveMessage: true });
      setTrackedRosterMessageTone("success");
      setTrackedRosterMessage("Training-only jobsite assignments saved.");
    } catch (error) {
      setTrackedRosterMessageTone("error");
      setTrackedRosterMessage(
        error instanceof Error ? error.message : "Failed to save training-only jobsite assignments."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateDataRequest() {
    if (!dataRequestTitle.trim()) return;
    setBusyAction("data-request-create");
    setMessage("");
    try {
      if (workspace.demoMode) {
        const nowIso = new Date().toISOString();
        setWorkspace((current) => ({
          ...current,
          dataRequests: [
            {
              id: `demo-data-request-${Date.now()}`,
              company_id: "demo-company",
              request_type: dataRequestType,
              request_scope: dataRequestScope,
              subject_user_id: null,
              subject_email: null,
              jobsite_id: null,
              document_id: null,
              status: "submitted",
              requested_by: "demo-admin",
              reviewed_by: null,
              completed_by: null,
              title: dataRequestTitle,
              description: dataRequestDescription || null,
              reviewer_notes: null,
              completion_evidence: null,
              evidence_storage_path: null,
              metadata: {},
              due_at: null,
              reviewed_at: null,
              completed_at: null,
              created_at: nowIso,
              updated_at: nowIso,
            },
            ...current.dataRequests,
          ],
        }));
        setDataRequestTitle("");
        setDataRequestDescription("");
        setMessageTone("success");
        setMessage("Demo data request added locally for this session.");
        return;
      }
      const token = await getAccessToken();
      await fetchJson("/api/company/data-requests", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: dataRequestType,
          requestScope: dataRequestScope,
          title: dataRequestTitle,
          description: dataRequestDescription,
        }),
      });
      setDataRequestTitle("");
      setDataRequestDescription("");
      setMessageTone("success");
      setMessage("Company data request created.");
      await loadWorkspace({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to create data request.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateDataRequestStatus(
    requestId: string,
    status: CompanyDataRequest["status"]
  ) {
    setBusyAction(`data-${requestId}`);
    try {
      if (workspace.demoMode) {
        setWorkspace((current) => ({
          ...current,
          dataRequests: current.dataRequests.map((item) =>
            item.id === requestId ? { ...item, status, updated_at: new Date().toISOString() } : item
          ),
        }));
        return;
      }
      const token = await getAccessToken();
      await fetchJson(`/api/company/data-requests/${requestId}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadWorkspace({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update data request.");
    } finally {
      setBusyAction(null);
    }
  }

  function handleExportAuditEvidence() {
    const evidence = {
      exportedAt: new Date().toISOString(),
      company: workspace.scopeCompanyName,
      securityEvents: workspace.securityEvents,
      pendingInvites: workspace.invites,
      suspendedUsers: commandCenter.suspendedUsers,
      dataRequests: workspace.dataRequests,
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `safety360docs-audit-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyInviteLink(invite: CompanyInvite) {
    await navigator.clipboard?.writeText(getInviteSignupUrl(invite));
    setMessageTone("success");
    setMessage(`Invite link copied for ${invite.email}.`);
  }

  function handleActionItem(item: WorkforceActionItem) {
    if (item.kind === "review_audit") {
      setActiveTab("audit");
      return;
    }
    if (item.userId) {
      const user = workspace.users.find((entry) => entry.id === item.userId);
      if (user) {
        if (item.kind === "approve") void handleQuickStatus(user, "Active");
        else openUserManager(user);
      }
      return;
    }
    if (item.inviteId) {
      const invite = workspace.invites.find((entry) => entry.id === item.inviteId);
      if (invite) void copyInviteLink(invite);
      return;
    }
    if (item.employeeId) {
      const employee = workspace.trackedEmployees.find((entry) => entry.id === item.employeeId);
      if (employee) {
        setActiveTab("training");
        if (item.kind === "assign_tracked_jobsites") openTrackedAssignmentManager(employee);
        else openTrackedEmployeeEditor(employee);
      }
    }
  }

  const stats = [
    {
      label: "Active app users",
      value: loadState.loading ? "-" : String(commandCenter.activeUsers.length),
      detail: "Licensed users with live workspace access.",
      icon: Users,
      tone: commandCenter.activeUsers.length ? ("success" as const) : ("neutral" as const),
    },
    {
      label: "Pending approvals",
      value: loadState.loading ? "-" : String(commandCenter.pendingUsers.length),
      detail: "Employees who created accounts and need approval.",
      icon: UserCheck,
      tone: commandCenter.pendingUsers.length ? ("warning" as const) : ("success" as const),
    },
    {
      label: "Assignment gaps",
      value: loadState.loading ? "-" : String(commandCenter.assignmentGaps.length + commandCenter.trackedAssignmentGaps.length),
      detail: "Active field-scoped users and training-only people without jobsites.",
      icon: ListChecks,
      tone: commandCenter.assignmentGaps.length || commandCenter.trackedAssignmentGaps.length ? ("warning" as const) : ("success" as const),
    },
    {
      label: "Training-only",
      value: loadState.loading ? "-" : String(activeTrackedEmployees.length),
      detail: "People tracked without app login seats.",
      icon: ShieldCheck,
      tone: commandCenter.trainingGaps.length ? ("warning" as const) : ("info" as const),
    },
  ];

  return (
    <div className="company-access-workspace space-y-6">
      <PageHero
        eyebrow="Company Workspace"
        title="Workforce Operations"
        description="Manage app access, jobsite scope, training-only roster records, and audit evidence from one action-focused workspace."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/training-matrix" className={appButtonSecondaryClassName}>
              <ListChecks aria-hidden className="h-4 w-4" />
              Training Matrix
            </Link>
            <Link href="/billing" className={appButtonSecondaryClassName}>
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Billing Hub
            </Link>
            <button
              type="button"
              onClick={handleInvite}
              disabled={busyAction === "invite" || !inviteEmail.trim()}
              className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none`}
            >
              <MailPlus aria-hidden className="h-4 w-4" />
              {busyAction === "invite" ? "Sending..." : "Invite Employee"}
            </button>
          </div>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      {loadState.warnings.length > 0 ? (
        <InlineMessage tone="warning">{loadState.warnings[0]}</InlineMessage>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <SectionCard
          title="Command Readiness"
          description={commandCenter.readinessDetail}
          aside={<StatusBadge label={commandCenter.readinessLabel} tone={readinessTone(commandCenter.readiness)} />}
          tone={commandCenter.readiness === "blocked" ? "attention" : "panel"}
        >
          <div className="grid gap-3">
            <div className={compactCardClassName}>
              <div className="flex items-start gap-3">
                {commandCenter.readiness === "healthy" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--semantic-success)]" aria-hidden />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--semantic-warning)]" aria-hidden />
                )}
                <div>
                  <p className="font-semibold text-[var(--app-text-strong)]">
                    {commandCenter.actionItems.length
                      ? `${commandCenter.actionItems.length} action item${
                          commandCenter.actionItems.length === 1 ? "" : "s"
                        }`
                      : "No workforce actions waiting"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">
                    Readiness is based on approvals, stale invites, field-scoped jobsite access, suspended users,
                    training readiness, and data request review.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {commandCenter.actionItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={item.severity}
                        tone={item.severity === "critical" ? "error" : item.severity === "warning" ? "warning" : "info"}
                      />
                      <p className="font-semibold text-[var(--app-text-strong)]">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--app-text)]">{item.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleActionItem(item)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                  >
                    <SlidersHorizontal aria-hidden className="h-4 w-4" />
                    Handle
                  </button>
                </div>
              ))}
              {!commandCenter.actionItems.length ? (
                <EmptyState
                  title="Workforce queue is clear"
                  description="Approvals, stale invites, assignment gaps, training gaps, and audit requests will appear here."
                />
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Invite And Scope"
          description={`Workspace: ${workspace.scopeCompanyName}. Invite app users here; add non-login people from the Training-Only tab.`}
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className={fieldClassName}
              placeholder="employee@example.com"
              aria-label="Employee email"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
              className={appNativeSelectClassName}
              aria-label="Invite role"
            >
              {roleOptions.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleInvite}
              disabled={busyAction === "invite" || !inviteEmail.trim()}
              className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none`}
            >
              <UserPlus aria-hidden className="h-4 w-4" />
              Invite
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Company-wide roles</p>
              <p className="mt-1 text-sm text-[var(--app-text)]">Admins, operations, and safety managers see all jobsites.</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Field-scoped roles</p>
              <p className="mt-1 text-sm text-[var(--app-text)]">Project, supervisor, foreman, field, read-only, and company users need jobsite picks.</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Training-only</p>
              <p className="mt-1 text-sm text-[var(--app-text)]">Roster records do not create login access or use a licensed seat.</p>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Workforce Command Center"
        description="Switch between action queues, app users, training-only records, and audit evidence."
        actions={
          <div role="tablist" aria-label="Workforce views" className="flex flex-wrap gap-1 rounded-lg border border-[var(--app-border)] bg-white p-1">
            <TabButton tab="overview" label="Overview" activeTab={activeTab} onClick={setActiveTab} />
            <TabButton tab="access" label="Access Queue" activeTab={activeTab} count={commandCenter.pendingUsers.length + workspace.invites.length + commandCenter.suspendedUsers.length} onClick={setActiveTab} />
            <TabButton tab="users" label="App Users" activeTab={activeTab} count={filteredUsers.length} onClick={setActiveTab} />
            <TabButton tab="training" label="Training-Only" activeTab={activeTab} count={activeTrackedEmployees.length} onClick={setActiveTab} />
            <TabButton tab="audit" label="Audit" activeTab={activeTab} count={workspace.securityEvents.length + workspace.dataRequests.length} onClick={setActiveTab} />
          </div>
        }
      >
        {activeTab === "overview" ? (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-5">
              <ActionQueueSection
                actionItems={commandCenter.actionItems}
                onHandle={handleActionItem}
              />
              <LeadershipSection rows={leadershipRows} />
            </div>
            <ActivityFeed
              title="Company Access Activity"
              description="Recent membership, invite, and approval activity for this workspace."
              items={activityItems}
            />
          </div>
        ) : null}

        {activeTab === "access" ? (
          <AccessQueueView
            loading={loadState.loading}
            pendingUsers={commandCenter.pendingUsers}
            suspendedUsers={commandCenter.suspendedUsers}
            invites={workspace.invites}
            busyAction={busyAction}
            onApprove={(user) => void handleQuickStatus(user, "Active")}
            onSuspend={(user) => void handleQuickStatus(user, "Suspended")}
            onReactivate={(user) => void handleQuickStatus(user, "Active")}
            onManage={openUserManager}
            onCopyInvite={(invite) => void copyInviteLink(invite)}
          />
        ) : null}

        {activeTab === "users" ? (
          <AppUsersView
            loading={loadState.loading}
            users={filteredUsers}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            getAssignmentSummary={getAssignmentSummary}
            onManage={openUserManager}
          />
        ) : null}

        {activeTab === "training" ? (
          <TrainingOnlyView
            employees={activeTrackedEmployees}
            jobsites={workspace.jobsites}
            form={trackedEmployeeForm}
            setForm={setTrackedEmployeeForm}
            editing={editingTrackedEmployee}
            busyAction={busyAction}
            message={trackedRosterMessage}
            messageTone={trackedRosterMessageTone}
            rowErrors={trackedRosterRowErrors}
            onUpload={(file) => void handleTrackedRosterUpload(file)}
            onSave={() => void handleSaveTrackedEmployee()}
            onCancel={resetTrackedEmployeeEditor}
            onEdit={openTrackedEmployeeEditor}
            onAssign={openTrackedAssignmentManager}
            getAssignmentSummary={getTrackedAssignmentSummary}
          />
        ) : null}

        {activeTab === "audit" ? (
          <AuditView
            events={workspace.securityEvents}
            eventItems={securityEventItems}
            dataRequests={workspace.dataRequests}
            securityAuditView={securityAuditView}
            setSecurityAuditView={setSecurityAuditView}
            dataRequestType={dataRequestType}
            setDataRequestType={setDataRequestType}
            dataRequestScope={dataRequestScope}
            setDataRequestScope={setDataRequestScope}
            dataRequestTitle={dataRequestTitle}
            setDataRequestTitle={setDataRequestTitle}
            dataRequestDescription={dataRequestDescription}
            setDataRequestDescription={setDataRequestDescription}
            busyAction={busyAction}
            onCreateDataRequest={() => void handleCreateDataRequest()}
            onUpdateDataRequestStatus={(requestId, status) =>
              void handleUpdateDataRequestStatus(requestId, status)
            }
            onExport={handleExportAuditEvidence}
          />
        ) : null}
      </SectionCard>

      {editingUser ? (
        <AccessManagerModal
          user={editingUser}
          scopeCompanyName={workspace.scopeCompanyName}
          jobsites={workspace.jobsites}
          editRole={editRole}
          setEditRole={setEditRole}
          editStatus={editStatus}
          setEditStatus={setEditStatus}
          editAssignments={editAssignments}
          setEditAssignments={setEditAssignments}
          busyAction={busyAction}
          onClose={() => setEditingUser(null)}
          onSave={() => void handleSaveUser()}
          onRemove={() => void handleRemoveUser()}
        />
      ) : null}

      {assigningTrackedEmployee ? (
        <TrackedEmployeeAssignmentModal
          employee={assigningTrackedEmployee}
          scopeCompanyName={workspace.scopeCompanyName}
          jobsites={workspace.jobsites}
          editAssignments={trackedEditAssignments}
          setEditAssignments={setTrackedEditAssignments}
          busyAction={busyAction}
          onClose={() => setAssigningTrackedEmployee(null)}
          onSave={() => void handleSaveTrackedAssignments()}
        />
      ) : null}
    </div>
  );
}

function ActionQueueSection({
  actionItems,
  onHandle,
}: {
  actionItems: WorkforceActionItem[];
  onHandle: (item: WorkforceActionItem) => void;
}) {
  return (
    <div className={compactCardClassName}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--app-text-strong)]">Action Queue</p>
          <p className="mt-1 text-sm text-[var(--app-text)]">Prioritized workforce actions from all tabs.</p>
        </div>
        <StatusBadge label={String(actionItems.length)} tone={actionItems.length ? "warning" : "success"} />
      </div>
      <div className="mt-4 grid gap-2">
        {actionItems.slice(0, 8).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onHandle(item)}
            className="flex w-full flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-3 text-left transition hover:border-[var(--app-accent-border-24)] hover:bg-white sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--app-text-strong)]">{item.title}</span>
              <span className="mt-1 block text-sm text-[var(--app-text)]">{item.detail}</span>
            </span>
            <StatusBadge
              label={item.severity}
              tone={item.severity === "critical" ? "error" : item.severity === "warning" ? "warning" : "info"}
            />
          </button>
        ))}
        {!actionItems.length ? (
          <EmptyState
            title="No actions waiting"
            description="The command queue is clear across approvals, assignments, training, and audit review."
          />
        ) : null}
      </div>
    </div>
  );
}

function LeadershipSection({
  rows,
}: {
  rows: Array<{ user: CompanyUser; score: LeadershipSafetyScoreSummary }>;
}) {
  return (
    <div className={compactCardClassName}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--app-text-strong)]">Leadership Safety Commitment</p>
          <p className="mt-1 text-sm text-[var(--app-text)]">Lowest scores appear first for coaching focus.</p>
        </div>
        <StatusBadge label={`${rows.length} visible`} tone={rows.length ? "info" : "neutral"} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {rows.map(({ user, score }) => (
          <div key={user.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">{user.name}</p>
                <p className="mt-0.5 text-xs text-[var(--app-muted)]">{score.roleLabel || user.role}</p>
              </div>
              <StatusBadge label={`Grade ${score.grade}`} tone={score.score >= 80 ? "success" : score.score >= 65 ? "info" : "warning"} />
            </div>
            <p className="mt-3 text-3xl font-bold text-[var(--app-text-strong)]">{score.score}<span className="text-sm text-[var(--app-muted)]">/100</span></p>
            <p className="mt-2 text-sm leading-5 text-[var(--app-text)]">{score.coachingPrompt || "Review evidence for coaching focus."}</p>
          </div>
        ))}
        {!rows.length ? (
          <EmptyState
            title="No leadership scores yet"
            description="Scores appear after assigned leaders have enough jobsite, permit, JSA, corrective-action, or AI risk-action evidence."
            className="lg:col-span-3"
          />
        ) : null}
      </div>
    </div>
  );
}

function AccessQueueView({
  loading,
  pendingUsers,
  suspendedUsers,
  invites,
  busyAction,
  onApprove,
  onSuspend,
  onReactivate,
  onManage,
  onCopyInvite,
}: {
  loading: boolean;
  pendingUsers: CompanyUser[];
  suspendedUsers: CompanyUser[];
  invites: CompanyInvite[];
  busyAction: string | null;
  onApprove: (user: CompanyUser) => void;
  onSuspend: (user: CompanyUser) => void;
  onReactivate: (user: CompanyUser) => void;
  onManage: (user: CompanyUser) => void;
  onCopyInvite: (invite: CompanyInvite) => void;
}) {
  if (loading) return <InlineMessage>Loading access queue...</InlineMessage>;
  const isEmpty = pendingUsers.length === 0 && suspendedUsers.length === 0 && invites.length === 0;
  return (
    <div className="grid gap-4">
      {pendingUsers.map((user) => (
        <UserQueueRow
          key={`pending-${user.id}`}
          user={user}
          title="Awaiting approval"
          detail="This employee finished account setup and needs workspace approval."
          actions={
            <>
              <button type="button" onClick={() => onApprove(user)} disabled={busyAction?.startsWith(`status-${user.id}`)} className={appButtonPrimaryClassName}>
                <UserCheck aria-hidden className="h-4 w-4" />
                Approve
              </button>
              <button type="button" onClick={() => onManage(user)} className={appButtonSecondaryClassName}>
                Manage
              </button>
              <button type="button" onClick={() => onSuspend(user)} disabled={busyAction?.startsWith(`status-${user.id}`)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
                Suspend
              </button>
            </>
          }
        />
      ))}

      {invites.map((invite) => (
        <div key={`invite-${invite.id}`} className={compactCardClassName}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[var(--app-text-strong)]">{invite.email}</p>
                <StatusBadge label="Invite sent" tone="warning" />
                <RoleBadge role={invite.role} />
              </div>
              <p className="mt-1 text-sm text-[var(--app-text)]">Sent {formatRelative(invite.created_at)}. Waiting for account setup.</p>
            </div>
            <button type="button" onClick={() => onCopyInvite(invite)} className={appButtonSecondaryClassName}>
              <Clipboard aria-hidden className="h-4 w-4" />
              Copy Invite
            </button>
          </div>
        </div>
      ))}

      {suspendedUsers.map((user) => (
        <UserQueueRow
          key={`suspended-${user.id}`}
          user={user}
          title="Suspended access"
          detail="This employee is blocked from the workspace until reactivated or removed."
          actions={
            <>
              <button type="button" onClick={() => onReactivate(user)} disabled={busyAction?.startsWith(`status-${user.id}`)} className={appButtonPrimaryClassName}>
                Reactivate
              </button>
              <button type="button" onClick={() => onManage(user)} className={appButtonSecondaryClassName}>
                Manage
              </button>
            </>
          }
        />
      ))}

      {isEmpty ? (
        <EmptyState
          title="Access queue is clear"
          description="Pending approvals, invites, and suspended users will appear here when they need review."
        />
      ) : null}
    </div>
  );
}

function UserQueueRow({
  user,
  title,
  detail,
  actions,
}: {
  user: CompanyUser;
  title: string;
  detail: string;
  actions: React.ReactNode;
}) {
  return (
    <div className={compactCardClassName}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[var(--app-text-strong)]">{user.name}</p>
            <StatusBadge label={title} tone={user.status === "Suspended" ? "error" : "warning"} />
            <RoleBadge role={user.role} />
          </div>
          <p className="mt-1 text-sm text-[var(--app-text)]">{detail}</p>
          <p className="mt-1 truncate text-sm text-[var(--app-muted)]">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
      </div>
    </div>
  );
}

function AppUsersView({
  loading,
  users,
  searchTerm,
  onSearch,
  getAssignmentSummary,
  onManage,
}: {
  loading: boolean;
  users: CompanyUser[];
  searchTerm: string;
  onSearch: (value: string) => void;
  getAssignmentSummary: (user: CompanyUser) => { label: string; detail: string; tone: "success" | "warning" | "info" };
  onManage: (user: CompanyUser) => void;
}) {
  if (loading) return <InlineMessage>Loading app users...</InlineMessage>;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
        <Search aria-hidden className="h-4 w-4 text-[var(--app-muted)]" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search users by name, email, role, or status"
          className="min-h-9 flex-1 border-0 bg-transparent text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
        />
      </div>
      {users.map((user) => {
        const assignment = getAssignmentSummary(user);
        return (
          <div key={user.id} className={compactCardClassName}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--app-text-strong)]">{user.name}</p>
                  <RoleBadge role={user.role} />
                  <StatusBadge label={user.status} tone={statusTone(user.status)} />
                </div>
                <p className="mt-1 truncate text-sm text-[var(--app-muted)]">{user.email}</p>
                <p className="mt-1 text-xs text-[var(--app-muted)]">Last seen {formatRelative(user.last_sign_in_at)}</p>
              </div>
              <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={assignment.label} tone={assignment.tone} />
                </div>
                <p className="mt-1 text-sm text-[var(--app-text)]">{assignment.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" onClick={() => onManage(user)} className={appButtonPrimaryClassName}>
                  {roleNeedsAssignments(user.role) ? "Assign Jobsites" : "Manage Access"}
                </button>
                <Link href={getProfileHref(user.id)} className={appButtonSecondaryClassName}>
                  View Profile
                </Link>
              </div>
            </div>
          </div>
        );
      })}
      {!users.length ? (
        <EmptyState
          title="No app users found"
          description="Invite an employee, approve a pending joiner, or clear the current search."
        />
      ) : null}
    </div>
  );
}

function TrainingOnlyView({
  employees,
  jobsites,
  form,
  setForm,
  editing,
  busyAction,
  message,
  messageTone,
  rowErrors,
  onUpload,
  onSave,
  onCancel,
  onEdit,
  onAssign,
  getAssignmentSummary,
}: {
  employees: TrackedEmployee[];
  jobsites: Jobsite[];
  form: TrackedEmployeeForm;
  setForm: React.Dispatch<React.SetStateAction<TrackedEmployeeForm>>;
  editing: TrackedEmployee | null;
  busyAction: string | null;
  message: string;
  messageTone: "neutral" | "success" | "warning" | "error";
  rowErrors: ImportRowError[];
  onUpload: (file: File | null) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: (employee: TrackedEmployee) => void;
  onAssign: (employee: TrackedEmployee) => void;
  getAssignmentSummary: (employee: TrackedEmployee) => { label: string; detail: string; tone: "success" | "warning" | "info" };
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <div className={compactCardClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--app-text-strong)]">{editing ? "Edit Training-Only Person" : "Add Training-Only Person"}</p>
            <p className="mt-1 text-sm text-[var(--app-text)]">No app login access is created from this roster.</p>
          </div>
          <a href="/api/company/onboarding/import/template?type=employees" className={appButtonSecondaryClassName}>
            <FileDown aria-hidden className="h-4 w-4" />
            Template
          </a>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-5 text-center transition hover:border-[var(--app-accent-border-24)] hover:bg-white">
            <span className="text-sm font-semibold text-[var(--app-text-strong)]">
              {busyAction === "roster-upload" ? "Importing roster..." : "Upload roster CSV or XLSX"}
            </span>
            <span className="text-xs leading-5 text-[var(--app-muted)]">Valid rows appear immediately in Training Matrix tracking.</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={busyAction === "roster-upload"}
              className="sr-only"
              onChange={(event) => {
                onUpload(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>

          {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
          {rowErrors.length > 0 ? (
            <div className="rounded-lg border border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] p-3 text-sm text-[var(--app-text-strong)]">
              <p className="font-semibold">Rows to review</p>
              <ul className="mt-2 space-y-1">
                {rowErrors.slice(0, 6).map((error, index) => (
                  <li key={`${error.rowNumber}-${error.field ?? "row"}-${index}`}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} className={fieldClassName} placeholder="Full name" />
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={fieldClassName} placeholder="Email (optional)" />
            <input value={form.employee_id} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} className={fieldClassName} placeholder="Employee ID" />
            <select value={form.readiness_status} onChange={(event) => setForm((current) => ({ ...current, readiness_status: event.target.value }))} className={appNativeSelectClassName}>
              <option value="ready">Ready</option>
              <option value="travel_ready">Travel ready</option>
              <option value="limited">Limited</option>
              <option value="needs_training">Needs training</option>
              <option value="onboarding">Onboarding</option>
            </select>
            <input value={form.job_title} onChange={(event) => setForm((current) => ({ ...current, job_title: event.target.value }))} className={fieldClassName} placeholder="Job title" />
            <input value={form.trade_specialty} onChange={(event) => setForm((current) => ({ ...current, trade_specialty: event.target.value }))} className={fieldClassName} placeholder="Trade specialty" />
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={appNativeSelectClassName}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
            <input value={form.certifications} onChange={(event) => setForm((current) => ({ ...current, certifications: event.target.value }))} className={fieldClassName} placeholder="Certifications; separated by semicolons" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSave} disabled={busyAction === "tracked-save" || !form.full_name.trim()} className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none`}>
              {busyAction === "tracked-save" ? "Saving..." : editing ? "Save Person" : "Add To Training Matrix"}
            </button>
            {editing ? (
              <button type="button" onClick={onCancel} className={appButtonSecondaryClassName}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid content-start gap-3">
        {employees.map((employee) => {
          const assignment = getAssignmentSummary(employee);
          return (
          <div key={employee.id} className={compactCardClassName}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--app-text-strong)]">{employee.full_name}</p>
                  <StatusBadge label="No app login" tone="info" />
                  <StatusBadge label={readinessLabel(employee.readiness_status)} tone={employee.readiness_status === "needs_training" ? "warning" : "success"} />
                </div>
                <p className="mt-1 truncate text-sm text-[var(--app-muted)]">{employee.email || employee.external_employee_id || "No email on file"}</p>
                <p className="mt-1 text-sm text-[var(--app-text)]">{employee.job_title || "Role not set"} / {employee.trade_specialty || "Trade not set"}</p>
              </div>
              <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={assignment.label} tone={assignment.tone} />
                </div>
                <p className="mt-1 text-sm text-[var(--app-text)]">{assignment.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" onClick={() => onAssign(employee)} className={appButtonPrimaryClassName}>
                  <MapPin aria-hidden className="h-4 w-4" />
                  Assign Jobsites
                </button>
                <button type="button" onClick={() => onEdit(employee)} className={appButtonSecondaryClassName}>
                  Edit
                </button>
              </div>
            </div>
          </div>
          );
        })}
        {!employees.length ? (
          <EmptyState
            title="No training-only people yet"
            description={jobsites.length ? "Add non-login workers here when they need training compliance tracking without app access." : "Add jobsites first, then assign training-only people to active sites."}
          />
        ) : null}
      </div>
    </div>
  );
}

function AuditView({
  events,
  eventItems,
  dataRequests,
  securityAuditView,
  setSecurityAuditView,
  dataRequestType,
  setDataRequestType,
  dataRequestScope,
  setDataRequestScope,
  dataRequestTitle,
  setDataRequestTitle,
  dataRequestDescription,
  setDataRequestDescription,
  busyAction,
  onCreateDataRequest,
  onUpdateDataRequestStatus,
  onExport,
}: {
  events: CompanySecurityEvent[];
  eventItems: Parameters<typeof ActivityFeed>[0]["items"];
  dataRequests: CompanyDataRequest[];
  securityAuditView: SecurityAuditView;
  setSecurityAuditView: (view: SecurityAuditView) => void;
  dataRequestType: CompanyDataRequestType;
  setDataRequestType: (type: CompanyDataRequestType) => void;
  dataRequestScope: CompanyDataRequestScope;
  setDataRequestScope: (scope: CompanyDataRequestScope) => void;
  dataRequestTitle: string;
  setDataRequestTitle: (value: string) => void;
  dataRequestDescription: string;
  setDataRequestDescription: (value: string) => void;
  busyAction: string | null;
  onCreateDataRequest: () => void;
  onUpdateDataRequestStatus: (requestId: string, status: CompanyDataRequest["status"]) => void;
  onExport: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSecurityAuditView("events")} className={`${securityAuditView === "events" ? appButtonPrimaryClassName : appButtonSecondaryClassName}`}>
            Events
          </button>
          <button type="button" onClick={() => setSecurityAuditView("data_requests")} className={`${securityAuditView === "data_requests" ? appButtonPrimaryClassName : appButtonSecondaryClassName}`}>
            Data Requests
          </button>
        </div>
        <button type="button" onClick={onExport} className={appButtonSecondaryClassName}>
          <FileDown aria-hidden className="h-4 w-4" />
          Export Evidence
        </button>
      </div>

      {securityAuditView === "events" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
          <ActivityFeed
            title="Recent Security Events"
            description="Company-scoped access and evidence ledger."
            items={eventItems}
          />
          <div className={compactCardClassName}>
            <p className="text-base font-semibold text-[var(--app-text-strong)]">Audit Snapshot</p>
            <div className="mt-4 grid gap-3">
              <MetricLine label="Ledger events" value={events.length} />
              <MetricLine label="Data requests" value={dataRequests.length} />
              <MetricLine label="Open requests" value={dataRequests.filter((request) => request.status !== "completed").length} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
          <div className={compactCardClassName}>
            <p className="text-base font-semibold text-[var(--app-text-strong)]">New Data Request</p>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={dataRequestType} onChange={(event) => setDataRequestType(event.target.value as CompanyDataRequestType)} className={appNativeSelectClassName}>
                  <option value="export">Export</option>
                  <option value="deletion">Deletion</option>
                  <option value="correction">Correction</option>
                  <option value="privacy_review">Privacy Review</option>
                </select>
                <select value={dataRequestScope} onChange={(event) => setDataRequestScope(event.target.value as CompanyDataRequestScope)} className={appNativeSelectClassName}>
                  <option value="company">Company</option>
                  <option value="jobsite">Jobsite</option>
                  <option value="user">User</option>
                  <option value="document">Document</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input value={dataRequestTitle} onChange={(event) => setDataRequestTitle(event.target.value)} placeholder="Request title" className={fieldClassName} />
              <textarea value={dataRequestDescription} onChange={(event) => setDataRequestDescription(event.target.value)} placeholder="Scope, requester, reviewer notes, or completion evidence" rows={4} className={fieldClassName} />
              <button type="button" onClick={onCreateDataRequest} disabled={busyAction === "data-request-create" || !dataRequestTitle.trim()} className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none`}>
                {busyAction === "data-request-create" ? "Creating..." : "Create Request"}
              </button>
            </div>
          </div>
          <div className="grid content-start gap-3">
            {dataRequests.map((requestItem) => (
              <div key={requestItem.id} className={compactCardClassName}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--app-text-strong)]">{requestItem.title}</p>
                      <StatusBadge label={formatSecurityEventLabel(requestItem.status)} tone={dataRequestStatusTone(requestItem.status)} />
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">
                      {formatSecurityEventLabel(requestItem.request_type)} / {formatSecurityEventLabel(requestItem.request_scope)} / {formatRelative(requestItem.created_at)}
                    </p>
                    {requestItem.description ? <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{requestItem.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {requestItem.status === "submitted" ? (
                      <button type="button" onClick={() => onUpdateDataRequestStatus(requestItem.id, "reviewing")} className={appButtonSecondaryClassName}>
                        Review
                      </button>
                    ) : null}
                    {requestItem.status !== "completed" ? (
                      <button type="button" onClick={() => onUpdateDataRequestStatus(requestItem.id, "completed")} className={appButtonPrimaryClassName}>
                        Complete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!dataRequests.length ? (
              <EmptyState
                title="No data requests yet"
                description="Export, deletion, correction, and privacy review requests will appear here."
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
      <span className="text-sm text-[var(--app-text)]">{label}</span>
      <span className="font-semibold text-[var(--app-text-strong)]">{value}</span>
    </div>
  );
}

function TrackedEmployeeAssignmentModal({
  employee,
  scopeCompanyName,
  jobsites,
  editAssignments,
  setEditAssignments,
  busyAction,
  onClose,
  onSave,
}: {
  employee: TrackedEmployee;
  scopeCompanyName: string;
  jobsites: Jobsite[];
  editAssignments: string[];
  setEditAssignments: React.Dispatch<React.SetStateAction<string[]>>;
  busyAction: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const activeJobsites = jobsites.filter((jobsite) => jobsite.status !== "archived");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-[var(--app-border-strong)] bg-white p-5 shadow-[0_28px_70px_rgba(38,64,106,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">Assign Jobsites</p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--app-text-strong)]">{employee.full_name}</h3>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{employee.email || employee.external_employee_id || "Training-only person"}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--app-border)] text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)]" aria-label="Close jobsite assignment manager">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
            Company scope: <span className="font-semibold text-[var(--app-text-strong)]">{scopeCompanyName}</span>
          </div>
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Jobsite Assignments</p>
                <p className="mt-1 text-sm text-[var(--app-text)]">Training-only people can be assigned to multiple active jobsites without app access.</p>
              </div>
              <StatusBadge label={`${editAssignments.length} selected`} tone={editAssignments.length === 0 ? "warning" : "success"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditAssignments(activeJobsites.map((jobsite) => jobsite.id))} className={appButtonSecondaryClassName}>
                Select All
              </button>
              <button type="button" onClick={() => setEditAssignments([])} className={appButtonSecondaryClassName}>
                Clear
              </button>
            </div>
            <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
              {activeJobsites.map((jobsite) => {
                const checked = editAssignments.includes(jobsite.id);
                return (
                  <label key={jobsite.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm transition ${checked ? "border-[var(--app-accent-border-24)] bg-white" : "border-[var(--app-border)] bg-white/60 hover:bg-white"}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--app-text-strong)]">{jobsite.name}</span>
                      <span className="mt-1 block text-xs text-[var(--app-muted)]">{jobsite.status}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setEditAssignments((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, jobsite.id]))
                            : current.filter((value) => value !== jobsite.id)
                        );
                      }}
                    />
                  </label>
                );
              })}
              {!activeJobsites.length ? <p className="text-sm text-[var(--app-muted)]">No active jobsites available yet.</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={appButtonSecondaryClassName}>
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={busyAction === `tracked-assign-${employee.id}`} className={appButtonPrimaryClassName}>
            {busyAction === `tracked-assign-${employee.id}` ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessManagerModal({
  user,
  scopeCompanyName,
  jobsites,
  editRole,
  setEditRole,
  editStatus,
  setEditStatus,
  editAssignments,
  setEditAssignments,
  busyAction,
  onClose,
  onSave,
  onRemove,
}: {
  user: CompanyUser;
  scopeCompanyName: string;
  jobsites: Jobsite[];
  editRole: string;
  setEditRole: (role: string) => void;
  editStatus: string;
  setEditStatus: (status: string) => void;
  editAssignments: string[];
  setEditAssignments: React.Dispatch<React.SetStateAction<string[]>>;
  busyAction: string | null;
  onClose: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const fieldScoped = roleNeedsAssignments(editRole);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-[var(--app-border-strong)] bg-white p-5 shadow-[0_28px_70px_rgba(38,64,106,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--app-accent-primary)]">Manage Access</p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--app-text-strong)]">{user.name}</h3>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--app-border)] text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)]" aria-label="Close access manager">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid content-start gap-4">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
              Company scope: <span className="font-semibold text-[var(--app-text-strong)]">{scopeCompanyName}</span>
            </div>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Role</span>
              <select value={editRole} onChange={(event) => setEditRole(event.target.value)} className={appNativeSelectClassName}>
                {roleOptions.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Account status</span>
              <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)} className={appNativeSelectClassName}>
                <option>Pending</option>
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--app-text-strong)]">Jobsite Access</p>
                <p className="mt-1 text-sm text-[var(--app-text)]">Field-scoped users must have at least one active jobsite before approval.</p>
              </div>
              <StatusBadge label={fieldScoped ? `${editAssignments.length} selected` : "All jobsites"} tone={fieldScoped && editAssignments.length === 0 ? "warning" : "success"} />
            </div>

            {fieldScoped ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditAssignments(jobsites.map((jobsite) => jobsite.id))} className={appButtonSecondaryClassName}>
                    Select All
                  </button>
                  <button type="button" onClick={() => setEditAssignments([])} className={appButtonSecondaryClassName}>
                    Clear
                  </button>
                </div>
                <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1">
                  {jobsites.map((jobsite) => {
                    const checked = editAssignments.includes(jobsite.id);
                    return (
                      <label key={jobsite.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm transition ${checked ? "border-[var(--app-accent-border-24)] bg-white" : "border-[var(--app-border)] bg-white/60 hover:bg-white"}`}>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--app-text-strong)]">{jobsite.name}</span>
                          <span className="mt-1 block text-xs text-[var(--app-muted)]">{jobsite.status}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setEditAssignments((current) =>
                              event.target.checked
                                ? Array.from(new Set([...current, jobsite.id]))
                                : current.filter((value) => value !== jobsite.id)
                            );
                          }}
                        />
                      </label>
                    );
                  })}
                  {!jobsites.length ? <p className="text-sm text-[var(--app-muted)]">No jobsites available yet.</p> : null}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-[rgba(46,158,91,0.22)] bg-[var(--semantic-success-bg)] px-4 py-3 text-sm leading-6 text-[var(--app-text-strong)]">
                {editRole} is company-wide and will have access to every jobsite in {scopeCompanyName}.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link href={getProfileHref(user.id)} className={appButtonSecondaryClassName}>
            View Profile
          </Link>
          <button type="button" onClick={onRemove} disabled={busyAction === `remove-${user.id}`} className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
            {busyAction === `remove-${user.id}` ? "Removing..." : "Remove User"}
          </button>
          <button type="button" onClick={onSave} disabled={busyAction === `save-${user.id}`} className={appButtonPrimaryClassName}>
            {busyAction === `save-${user.id}` ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
