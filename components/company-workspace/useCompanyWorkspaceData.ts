"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
  normalizeDocumentStatus,
} from "@/lib/documentStatus";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source: "table" | "document_fallback";
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

export function useCompanyWorkspaceData() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [companyInvites, setCompanyInvites] = useState<CompanyInvite[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [jobsiteRows, setJobsiteRows] = useState<CompanyJobsiteRow[]>([]);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [referenceTime] = useState(() => Date.now());

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

      const [
        meResponse,
        documentsResponse,
        creditsResponse,
        companyUsersResponse,
        jobsitesResponse,
      ] =
        await Promise.all([
          fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch("/api/workspace/documents", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch("/api/library/credits", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch("/api/company/users", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch("/api/company/jobsites", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        ]);

      const meData = (await meResponse.json().catch(() => null)) as
        | { user?: { companyProfile?: CompanyProfile | null } }
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

      setCompanyProfile(meResponse.ok ? meData?.user?.companyProfile ?? null : null);
      setDocuments(documentsResponse.ok ? documentsData?.documents ?? [] : []);
      setCreditBalance(
        creditsResponse.ok ? Number(creditsData?.creditBalance ?? 0) : null
      );
      setCompanyUsers(companyUsersResponse.ok ? companyUsersData?.users ?? [] : []);
      setCompanyInvites(companyUsersResponse.ok ? companyUsersData?.invites ?? [] : []);
      setJobsiteRows(jobsitesResponse.ok ? jobsitesData?.jobsites ?? [] : []);
    } catch (error) {
      console.error("Failed to load company workspace data:", error);
      setDocuments([]);
      setCompanyUsers([]);
      setCompanyInvites([]);
      setCompanyProfile(null);
      setJobsiteRows([]);
      setCreditBalance(null);
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
    reload: loadWorkspace,
  };
}
