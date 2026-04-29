"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
  normalizeDocumentStatus,
} from "@/lib/documentStatus";
import {
  demoCompanyInvites,
  demoCompanyJobsiteRows,
  demoCompanyProfile,
  demoCompanyUsers,
  demoDocuments,
  demoIncidentRows,
  demoPermitRows,
  demoWorkspaceSummary,
} from "@/lib/demoWorkspace";

const supabase = getSupabaseBrowserClient();

export type DocumentRow = {
  id: string;
  created_at: string;
  project_name: string | null;
  document_title?: string | null;
  document_type: string | null;
  category?: string | null;
  status: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
  file_name?: string | null;
};

export type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

export type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

export type CompanyProfile = {
  id: string;
  name: string | null;
  team_key: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string | null;
  pilot_trial_ends_at?: string | null;
  pilot_converted_at?: string | null;
};

export type CompanyJobsite = {
  id: string;
  name: string;
  location: string;
  lastActivity: string | null;
  totalDocuments: number;
  pendingDocuments: number;
  projectNumber: string;
  status: "Planned" | "Action needed" | "Active" | "Completed" | "Archived";
  rawStatus: "planned" | "active" | "completed" | "archived";
  projectManager?: string | null;
  safetyLead?: string | null;
  auditCustomerId?: string | null;
  customerCompanyName?: string | null;
  customerReportEmail?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source: "table" | "document_fallback";
};

export type LiveMatrixRow = {
  category: string;
  open: number;
  inProgress: number;
  closed: number;
  overdue: number;
};

export type ModuleSummaryItem = {
  key: "daps" | "permits" | "incidents" | "reports";
  label: string;
  total: number;
  open: number;
  inProgress: number;
  closed: number;
};

type CompanyJobsiteRow = {
  id: string;
  company_id: string;
  name: string;
  project_number: string | null;
  location: string | null;
  status: string | null;
  project_manager: string | null;
  safety_lead: string | null;
  audit_customer_id?: string | null;
  customer_company_name?: string | null;
  customer_report_email?: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at?: string | null;
};

function normalizeJobsiteStatus(status?: string | null): CompanyJobsite["rawStatus"] {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "planned") return "planned";
  if (normalized === "completed") return "completed";
  if (normalized === "archived") return "archived";
  return "active";
}

export function formatRelative(timestamp?: string | null, referenceTime = Date.now()) {
  if (!timestamp) return "Recently";

  const diffMs = referenceTime - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function isOnline(lastSignInAt?: string | null, referenceTime = Date.now()) {
  if (!lastSignInAt) return false;
  return referenceTime - new Date(lastSignInAt).getTime() <= 1000 * 60 * 20;
}

export function getDocumentLabel(document: DocumentRow) {
  return (
    document.document_title ??
    document.project_name ??
    document.file_name ??
    "Untitled document"
  );
}

export function isApprovedDocument(document: DocumentRow) {
  return isApprovedDocumentStatus(document.status, Boolean(document.final_file_path));
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useCompanyWorkspaceData() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [companyInvites, setCompanyInvites] = useState<CompanyInvite[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [jobsiteRows, setJobsiteRows] = useState<CompanyJobsiteRow[]>([]);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [referenceTime] = useState(() => Date.now());
  const [correctiveActions, setCorrectiveActions] = useState<
    Array<{ category?: string | null; status?: string | null; due_at?: string | null }>
  >([]);
  const [daps, setDaps] = useState<Array<{ status?: string | null }>>([]);
  const [permits, setPermits] = useState<Array<{ status?: string | null }>>([]);
  const [incidents, setIncidents] = useState<Array<{ status?: string | null }>>([]);
  const [reports, setReports] = useState<Array<{ status?: string | null }>>([]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setDocuments([]);
        setCompanyUsers([]);
        setCompanyInvites([]);
        setCompanyProfile(null);
        setCreditBalance(null);
        setLoading(false);
        return;
      }

      const authHeaders = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [
        meResponse,
        documentsResponse,
        creditsResponse,
        companyUsersResponse,
        jobsitesResponse,
      ] = await Promise.all([
        fetchWithTimeout("/api/auth/me", { headers: authHeaders }, 15000),
        fetchWithTimeout("/api/workspace/documents", { headers: authHeaders }, 15000),
        fetchWithTimeout("/api/library/credits", { headers: authHeaders }, 15000),
        fetchWithTimeout("/api/company/users", { headers: authHeaders }, 15000),
        fetchWithTimeout("/api/company/jobsites", { headers: authHeaders }, 15000),
      ]);

      const meData = (await meResponse.json().catch(() => null)) as
        | { user?: { role?: string | null; companyProfile?: CompanyProfile | null } }
        | null;
      const documentsData = (await documentsResponse.json().catch(() => null)) as
        | { documents?: DocumentRow[] }
        | null;
      const creditsData = (await creditsResponse.json().catch(() => null)) as
        | { creditBalance?: number }
        | null;
      const companyUsersData = (await companyUsersResponse.json().catch(() => null)) as
        | { users?: CompanyUser[]; invites?: CompanyInvite[] }
        | null;
      const jobsitesData = (await jobsitesResponse.json().catch(() => null)) as
        | { jobsites?: CompanyJobsiteRow[] }
        | null;
      if (meResponse.ok && meData?.user?.role === "sales_demo") {
        setCompanyProfile(demoCompanyProfile);
        setDocuments(demoDocuments);
        setCreditBalance(25);
        setCompanyUsers(demoCompanyUsers);
        setCompanyInvites(demoCompanyInvites);
        setJobsiteRows(demoCompanyJobsiteRows);
        setCorrectiveActions(demoWorkspaceSummary.observations);
        setDaps(demoWorkspaceSummary.daps);
        setPermits(demoPermitRows);
        setIncidents(demoIncidentRows);
        setReports(demoWorkspaceSummary.reports);
        setLoading(false);
        return;
      }
      setCompanyProfile(meResponse.ok ? meData?.user?.companyProfile ?? null : null);
      setDocuments(documentsResponse.ok ? documentsData?.documents ?? [] : []);
      setCreditBalance(
        creditsResponse.ok ? Number(creditsData?.creditBalance ?? 0) : null
      );
      setCompanyUsers(companyUsersResponse.ok ? companyUsersData?.users ?? [] : []);
      setCompanyInvites(companyUsersResponse.ok ? companyUsersData?.invites ?? [] : []);
      setJobsiteRows(jobsitesResponse.ok ? jobsitesData?.jobsites ?? [] : []);
      setLoading(false);

      // Load heavier operational modules after core workspace data is visible.
      void (async () => {
        const [
          correctiveActionsResponse,
          jsasResponse,
          permitsResponse,
          incidentsResponse,
          reportsResponse,
        ] = await Promise.all([
          fetchWithTimeout("/api/company/observations", { headers: authHeaders }, 15000),
          fetchWithTimeout("/api/company/jsas", { headers: authHeaders }, 15000),
          fetchWithTimeout("/api/company/permits", { headers: authHeaders }, 15000),
          fetchWithTimeout("/api/company/incidents", { headers: authHeaders }, 15000),
          fetchWithTimeout("/api/company/reports", { headers: authHeaders }, 15000),
        ]);

        const correctiveActionsData = (await correctiveActionsResponse.json().catch(() => null)) as
          | {
              actions?: Array<{ category?: string | null; status?: string | null; due_at?: string | null }>;
              observations?: Array<{ category?: string | null; status?: string | null; due_at?: string | null }>;
              jsas?: Array<{ status?: string | null }>;
              permits?: Array<{ status?: string | null }>;
              incidents?: Array<{ status?: string | null }>;
              reports?: Array<{ status?: string | null }>;
            }
          | null;
        const jsasData = (await jsasResponse.json().catch(() => null)) as
          | { jsas?: Array<{ status?: string | null }> }
          | null;
        const permitsData = (await permitsResponse.json().catch(() => null)) as
          | { permits?: Array<{ status?: string | null }> }
          | null;
        const incidentsData = (await incidentsResponse.json().catch(() => null)) as
          | { incidents?: Array<{ status?: string | null }> }
          | null;
        const reportsData = (await reportsResponse.json().catch(() => null)) as
          | { reports?: Array<{ status?: string | null }> }
          | null;

        setCorrectiveActions(
          correctiveActionsResponse.ok
            ? correctiveActionsData?.observations ?? correctiveActionsData?.actions ?? []
            : []
        );
        setDaps(jsasResponse.ok ? jsasData?.jsas ?? [] : []);
        setPermits(permitsResponse.ok ? permitsData?.permits ?? [] : []);
        setIncidents(incidentsResponse.ok ? incidentsData?.incidents ?? [] : []);
        setReports(reportsResponse.ok ? reportsData?.reports ?? [] : []);
      })().catch((error) => {
        console.error("Failed to load operational workspace modules:", error);
        setCorrectiveActions([]);
        setDaps([]);
        setPermits([]);
        setIncidents([]);
        setReports([]);
      });
      return;
    } catch (error) {
      console.error("Failed to load company workspace data:", error);
      setDocuments([]);
      setCompanyUsers([]);
      setCompanyInvites([]);
      setCompanyProfile(null);
      setJobsiteRows([]);
      setCreditBalance(null);
      setCorrectiveActions([]);
      setDaps([]);
      setPermits([]);
      setIncidents([]);
      setReports([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadWorkspace]);

  const companyName = companyProfile?.name?.trim() || "Company Workspace";
  const companyLocation =
    [companyProfile?.city?.trim(), companyProfile?.state_region?.trim()]
      .filter(Boolean)
      .join(", ") || "Location not set";

  const companyInitials = companyName
    .split(/\s+/)
    .map((part) => part.trim()[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pendingUsers = useMemo(
    () => companyUsers.filter((user) => user.status === "Pending"),
    [companyUsers]
  );
  const activeUsers = useMemo(
    () => companyUsers.filter((user) => user.status === "Active"),
    [companyUsers]
  );
  const suspendedUsers = useMemo(
    () => companyUsers.filter((user) => user.status === "Suspended"),
    [companyUsers]
  );
  const onlineUsers = useMemo(
    () => activeUsers.filter((user) => isOnline(user.last_sign_in_at, referenceTime)),
    [activeUsers, referenceTime]
  );

  const pendingDocuments = useMemo(
    () =>
      documents.filter((document) =>
        isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
      ),
    [documents]
  );
  const draftDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          normalizeDocumentStatus(document.status, Boolean(document.final_file_path)) ===
          "draft"
      ),
    [documents]
  );
  const approvedDocuments = useMemo(
    () => documents.filter((document) => isApprovedDocument(document)),
    [documents]
  );
  const attentionDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const normalized = normalizeDocumentStatus(
          document.status,
          Boolean(document.final_file_path)
        );
        return (
          normalized !== "approved" &&
          normalized !== "submitted" &&
          normalized !== "draft" &&
          normalized !== "archived"
        );
      }),
    [documents]
  );
  const documentsSubmittedThisWeek = useMemo(
    () =>
      documents.filter(
        (document) =>
          referenceTime - new Date(document.created_at).getTime() <=
          1000 * 60 * 60 * 24 * 7
      ),
    [documents, referenceTime]
  );

  const jobsites = useMemo(() => {
    const grouped = new Map<
      string,
      {
        name: string;
        location: string;
        lastActivity: string | null;
        totalDocuments: number;
        pendingDocuments: number;
      }
    >();

    for (const document of documents) {
      const name = document.project_name?.trim() || "General Workspace";
      const key = name.toLowerCase();
      const existing = grouped.get(key) ?? {
        name,
        location: companyLocation,
        lastActivity: null,
        totalDocuments: 0,
        pendingDocuments: 0,
      };

      existing.totalDocuments += 1;
      if (
        isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
      ) {
        existing.pendingDocuments += 1;
      }
      if (
        !existing.lastActivity ||
        new Date(document.created_at).getTime() > new Date(existing.lastActivity).getTime()
      ) {
        existing.lastActivity = document.created_at;
      }

      grouped.set(key, existing);
    }

    const fallbackJobsites = Array.from(grouped.values()).map((jobsite) => ({
      id: `fallback-${jobsite.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "general"}`,
      name: jobsite.name,
      location: jobsite.location,
      lastActivity: jobsite.lastActivity,
      totalDocuments: jobsite.totalDocuments,
      pendingDocuments: jobsite.pendingDocuments,
      projectNumber: "",
      status:
        jobsite.pendingDocuments > 0
          ? ("Action needed" as const)
          : jobsite.lastActivity &&
              referenceTime - new Date(jobsite.lastActivity).getTime() <=
                1000 * 60 * 60 * 24 * 21
            ? ("Active" as const)
            : ("Completed" as const),
      rawStatus:
        jobsite.pendingDocuments > 0
          ? ("active" as const)
          : jobsite.lastActivity &&
              referenceTime - new Date(jobsite.lastActivity).getTime() <=
                1000 * 60 * 60 * 24 * 21
            ? ("active" as const)
            : ("completed" as const),
      source: "document_fallback" as const,
      projectManager: null,
      safetyLead: null,
      auditCustomerId: null,
      customerCompanyName: null,
      customerReportEmail: null,
      startDate: null,
      endDate: null,
      notes: null,
      createdAt: null,
      updatedAt: null,
    }));

    const merged = new Map<string, CompanyJobsite>();

    for (const row of jobsiteRows) {
      const key = row.name.trim().toLowerCase();
      const groupedJobsite = grouped.get(
        (row.name.trim() || "General Workspace").toLowerCase()
      );
      const rawStatus = normalizeJobsiteStatus(row.status);
      const displayStatus =
        rawStatus === "archived"
          ? ("Archived" as const)
          : rawStatus === "completed"
            ? ("Completed" as const)
            : groupedJobsite?.pendingDocuments
              ? ("Action needed" as const)
              : rawStatus === "planned"
                ? ("Planned" as const)
                : ("Active" as const);

      merged.set(key, {
        id: row.id,
        name: row.name,
        location: row.location?.trim() || groupedJobsite?.location || companyLocation,
        lastActivity: groupedJobsite?.lastActivity ?? row.updated_at ?? row.created_at ?? null,
        totalDocuments: groupedJobsite?.totalDocuments ?? 0,
        pendingDocuments: groupedJobsite?.pendingDocuments ?? 0,
        projectNumber: row.project_number?.trim() || "",
        status: displayStatus,
        rawStatus,
        projectManager: row.project_manager,
        safetyLead: row.safety_lead,
        auditCustomerId: row.audit_customer_id ?? null,
        customerCompanyName: row.customer_company_name ?? null,
        customerReportEmail: row.customer_report_email ?? null,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        source: "table",
      });
    }

    for (const fallbackJobsite of fallbackJobsites) {
      const key = fallbackJobsite.name.trim().toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, fallbackJobsite);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        const left = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const right = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return right - left;
      })
      .map((jobsite, index) => ({
        ...jobsite,
        projectNumber:
          jobsite.projectNumber || `SITE-${String(index + 1).padStart(2, "0")}`,
      }));
  }, [companyLocation, documents, jobsiteRows, referenceTime]);

  const activeJobsitesCount = useMemo(
    () =>
      jobsites.filter((jobsite) =>
        ["Active", "Action needed", "Planned"].includes(jobsite.status)
      ).length,
    [jobsites]
  );
  const overdueActionsCount = useMemo(
    () =>
      pendingUsers.length +
      pendingDocuments.filter(
        (document) =>
          referenceTime - new Date(document.created_at).getTime() >
          1000 * 60 * 60 * 24 * 3
      ).length,
    [pendingDocuments, pendingUsers.length, referenceTime]
  );
  const notificationCount = useMemo(
    () => pendingUsers.length + pendingDocuments.length + companyInvites.length,
    [companyInvites.length, pendingDocuments.length, pendingUsers.length]
  );

  const liveMatrixSummary = useMemo<LiveMatrixRow[]>(() => {
    const rows = new Map<string, LiveMatrixRow>();
    for (const action of correctiveActions) {
      const category = (action.category ?? "corrective_action").trim().toLowerCase();
      const status = (action.status ?? "open").trim().toLowerCase();
      const row = rows.get(category) ?? { category, open: 0, inProgress: 0, closed: 0, overdue: 0 };
      if (status === "closed") row.closed += 1;
      else if (status === "in_progress") row.inProgress += 1;
      else row.open += 1;
      if (status !== "closed" && action.due_at) {
        const due = new Date(action.due_at).getTime();
        if (!Number.isNaN(due) && due < referenceTime) {
          row.overdue += 1;
        }
      }
      rows.set(category, row);
    }
    return Array.from(rows.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [correctiveActions, referenceTime]);

  const moduleSummaries = useMemo<ModuleSummaryItem[]>(() => {
    const summarize = (
      key: ModuleSummaryItem["key"],
      label: string,
      items: Array<{ status?: string | null }>
    ): ModuleSummaryItem => {
      const statusCounts = { open: 0, inProgress: 0, closed: 0 };
      for (const item of items) {
        const status = (item.status ?? "").trim().toLowerCase();
        if (status === "closed" || status === "archived" || status === "published" || status === "expired") statusCounts.closed += 1;
        else if (status === "in_progress" || status === "active") statusCounts.inProgress += 1;
        else statusCounts.open += 1;
      }
      return {
        key,
        label,
        total: items.length,
        open: statusCounts.open,
        inProgress: statusCounts.inProgress,
        closed: statusCounts.closed,
      };
    };
    return [
      summarize("daps", "JSAs", daps),
      summarize("permits", "Permits", permits),
      summarize("incidents", "Incidents", incidents),
      summarize("reports", "Reports", reports),
    ];
  }, [daps, incidents, permits, reports]);

  return {
    loading,
    referenceTime,
    documents,
    companyUsers,
    companyInvites,
    companyProfile,
    creditBalance,
    companyName,
    companyLocation,
    companyInitials,
    pendingUsers,
    activeUsers,
    suspendedUsers,
    onlineUsers,
    pendingDocuments,
    draftDocuments,
    approvedDocuments,
    attentionDocuments,
    documentsSubmittedThisWeek,
    jobsites,
    activeJobsitesCount,
    overdueActionsCount,
    notificationCount,
    liveMatrixSummary,
    moduleSummaries,
    reload: loadWorkspace,
  };
}
