"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import {
  getDocumentStatusLabel,
  isApprovedDocumentStatus,
  isSubmittedDocumentStatus,
  normalizeDocumentStatus,
} from "@/lib/documentStatus";

type DocumentRow = {
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

type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

type CompanyProfile = {
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

function isOnline(lastSignInAt?: string | null) {
  if (!lastSignInAt) return false;
  return Date.now() - new Date(lastSignInAt).getTime() <= 1000 * 60 * 20;
}

function getDocumentLabel(document: DocumentRow) {
  return (
    document.document_title ??
    document.project_name ??
    document.file_name ??
    "Untitled document"
  );
}

function isApprovedDocument(document: DocumentRow) {
  return isApprovedDocumentStatus(document.status, Boolean(document.final_file_path));
}

function getStatusTone(label: string): "neutral" | "success" | "warning" | "info" {
  if (label === "Active" || label === "Online" || label === "Ready") return "success";
  if (label === "Pending" || label === "Suspended" || label === "Action needed") {
    return "warning";
  }
  return "info";
}

export function CompanyAdminDashboard({
  loading,
  documents,
  companyUsers,
  companyInvites,
  companyProfile,
  creditBalance,
}: {
  loading: boolean;
  documents: DocumentRow[];
  companyUsers: CompanyUser[];
  companyInvites: CompanyInvite[];
  companyProfile: CompanyProfile | null;
  creditBalance: number | null;
}) {
  const [selectedJobsite, setSelectedJobsite] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [referenceTime] = useState(() => Date.now());

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

  const pendingUsers = companyUsers.filter((user) => user.status === "Pending");
  const activeUsers = companyUsers.filter((user) => user.status === "Active");
  const suspendedUsers = companyUsers.filter((user) => user.status === "Suspended");
  const onlineUsers = activeUsers.filter((user) => isOnline(user.last_sign_in_at));
  const pendingDocuments = documents.filter((document) =>
    isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
  );
  const draftDocuments = documents.filter(
    (document) =>
      normalizeDocumentStatus(document.status, Boolean(document.final_file_path)) === "draft"
  );
  const approvedDocuments = documents.filter((document) => isApprovedDocument(document));
  const attentionDocuments = documents.filter((document) => {
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
  });
  const documentsSubmittedThisWeek = documents.filter(
    (document) =>
      referenceTime - new Date(document.created_at).getTime() <= 1000 * 60 * 60 * 24 * 7
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
      const existing = grouped.get(name) ?? {
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

      grouped.set(name, existing);
    }

    return Array.from(grouped.values())
      .map((jobsite, index) => ({
        ...jobsite,
        projectNumber: `SITE-${String(index + 1).padStart(2, "0")}`,
        status:
          jobsite.pendingDocuments > 0
            ? "Action needed"
            : jobsite.lastActivity &&
                referenceTime - new Date(jobsite.lastActivity).getTime() <=
                  1000 * 60 * 60 * 24 * 21
              ? "Active"
              : "Completed",
      }))
      .sort((a, b) => {
        const left = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const right = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return right - left;
      });
  }, [companyLocation, documents, referenceTime]);

  const jobsiteOptions = ["all", ...jobsites.map((jobsite) => jobsite.name)];
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDocuments = documents.filter((document) => {
    const matchesJobsite =
      selectedJobsite === "all" ||
      (document.project_name?.trim() || "General Workspace") === selectedJobsite;
    const matchesSearch =
      !normalizedSearch ||
      [
        document.project_name,
        document.document_title,
        document.document_type,
        document.file_name,
        document.category,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));

    return matchesJobsite && matchesSearch;
  });

  const filteredJobsites = jobsites.filter((jobsite) => {
    const matchesJobsite = selectedJobsite === "all" || jobsite.name === selectedJobsite;
    const matchesSearch =
      !normalizedSearch ||
      [jobsite.name, jobsite.location, jobsite.projectNumber].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    return matchesJobsite && matchesSearch;
  });

  const filteredUsers = companyUsers.filter((user) => {
    const matchesSearch =
      !normalizedSearch ||
      [user.name, user.email, user.role].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    return matchesSearch;
  });

  const overdueActionsCount =
    pendingUsers.length +
    pendingDocuments.filter(
      (document) =>
        referenceTime - new Date(document.created_at).getTime() > 1000 * 60 * 60 * 24 * 3
    ).length;
  const notificationCount =
    pendingUsers.length + pendingDocuments.length + companyInvites.length;
  const activeJobsitesCount = jobsites.filter((jobsite) => jobsite.status === "Active").length;

  const kpiCards = [
    {
      title: "Total Users",
      value: String(companyUsers.length),
      note: "Employees assigned to this company workspace",
      href: "/company-users",
      tone: "info" as const,
    },
    {
      title: "Users Online Now",
      value: String(onlineUsers.length),
      note: "People active in the last 20 minutes",
      href: "/company-users",
      tone: onlineUsers.length > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      title: "Current Active Jobsites",
      value: String(activeJobsitesCount),
      note: "Grouped from live project and document activity",
      href: "/jobsites",
      tone: activeJobsitesCount > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      title: "Pending Documents",
      value: String(pendingDocuments.length),
      note: "Files waiting on internal review or next action",
      href: "/library",
      tone: pendingDocuments.length > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "Open Safety Issues",
      value: "0",
      note: "Field iD Exchange goes live as your team starts reporting",
      href: "/field-id-exchange",
      tone: "neutral" as const,
    },
    {
      title: "Overdue Actions",
      value: String(overdueActionsCount),
      note: "Pending approvals and older review items",
      href: "/reports",
      tone: overdueActionsCount > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "Documents Submitted This Week",
      value: String(documentsSubmittedThisWeek.length),
      note: "New records added to the company workspace in the last 7 days",
      href: "/reports",
      tone: documentsSubmittedThisWeek.length > 0 ? ("info" as const) : ("neutral" as const),
    },
    {
      title: "Closed Issues This Month",
      value: "0",
      note: "Corrective action tracking is ready for rollout",
      href: "/field-id-exchange",
      tone: "neutral" as const,
    },
  ];

  const documentSnapshotCards = [
    {
      title: "Pending Review",
      value: String(pendingDocuments.length),
      note: "Company documents waiting for next action",
      tone: pendingDocuments.length > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      title: "Draft Documents",
      value: String(draftDocuments.length),
      note: "Unsubmitted records still being prepared",
      tone: draftDocuments.length > 0 ? ("info" as const) : ("neutral" as const),
    },
    {
      title: "Approved Documents",
      value: String(approvedDocuments.length),
      note: "Completed files ready to open or distribute",
      tone: approvedDocuments.length > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      title: "Needs Revision",
      value: String(attentionDocuments.length),
      note: "Records that still need correction or follow-up",
      tone: attentionDocuments.length > 0 ? ("warning" as const) : ("neutral" as const),
    },
  ];

  const userSnapshotCards = [
    {
      title: "Pending Invites",
      value: String(companyInvites.length),
      note: "Invites waiting for employees to set up their accounts",
    },
    {
      title: "Awaiting Approval",
      value: String(pendingUsers.length),
      note: "Employees who created accounts and need approval",
    },
    {
      title: "Inactive / Suspended",
      value: String(suspendedUsers.length),
      note: "Accounts currently blocked from the workspace",
    },
    {
      title: "Expiring Certifications",
      value: "0",
      note: "Certification expiration tracking is ready for rollout",
    },
  ];

  const recentActivityItems = [
    ...filteredDocuments.slice(0, 4).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      detail:
        `${document.project_name || "General Workspace"} - ${getDocumentStatusLabel(document.status, Boolean(document.final_file_path))}`,
      meta: formatRelative(document.created_at),
      tone: isApprovedDocument(document)
        ? ("success" as const)
        : isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
          ? ("warning" as const)
          : ("info" as const),
    })),
    ...pendingUsers.slice(0, 2).map((user) => ({
      id: `user-${user.id}`,
      title: `${user.name} is waiting for approval`,
      detail: "Approve or suspend access from Team Access.",
      meta: formatRelative(user.created_at),
      tone: "warning" as const,
    })),
  ].slice(0, 6);

  const correctiveActions = [
    ...(pendingUsers.length > 0
      ? [
          {
            id: "approvals",
            title: `${pendingUsers.length} employee approval${pendingUsers.length === 1 ? "" : "s"} need review`,
            detail: "Open Users to approve or suspend new account setups.",
            meta: "Today",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(pendingDocuments.length > 0
      ? [
          {
            id: "documents",
            title: `${pendingDocuments.length} document${pendingDocuments.length === 1 ? "" : "s"} still pending review`,
            detail: "Use Documents to follow up on the company document pipeline.",
            meta: "Action needed",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(companyInvites.length > 0
      ? [
          {
            id: "invites",
            title: `${companyInvites.length} invite${companyInvites.length === 1 ? "" : "s"} still waiting`,
            detail: "Remind invited employees to finish account setup.",
            meta: "Waiting",
            tone: "info" as const,
          },
        ]
      : []),
  ];

  const reportWidgets = [
    {
      title: "Document Status Breakdown",
      note: `${approvedDocuments.length} approved, ${pendingDocuments.length} pending, ${draftDocuments.length} draft, ${attentionDocuments.length} needing follow-up.`,
    },
    {
      title: "Online Team Snapshot",
      note: `${onlineUsers.length} online now, ${pendingUsers.length} awaiting approval, ${suspendedUsers.length} inactive.`,
    },
    {
      title: "Certification Tracking",
      note: "Employee certification reviews and expiration alerts are ready for rollout next.",
    },
    {
      title: "Jobsite Reporting",
      note: `${activeJobsitesCount} active jobsite${activeJobsitesCount === 1 ? "" : "s"} currently moving work through the company board.`,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-[1.9rem] border border-[#dbe9ff] bg-white p-6 shadow-[0_16px_36px_rgba(148,163,184,0.12)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-[linear-gradient(135deg,_#dbeafe_0%,_#bfdbfe_100%)] text-xl font-black text-sky-700">
                {companyInitials || "CO"}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                  Company Workspace
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {companyName}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Run company operations from one place: jobsites, documents, team access, field reporting, and overdue actions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={companyProfile?.status?.trim() || "Active"} tone="success" />
                  <StatusBadge label={companyLocation} tone="info" />
                  <StatusBadge
                    label={creditBalance === null ? "Credits pending" : `${creditBalance} credits`}
                    tone={creditBalance && creditBalance > 0 ? "success" : "neutral"}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Notifications
                </div>
                <div className="mt-2 text-xl font-black text-slate-950">{notificationCount}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Pending approvals, invites, and review items
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Company Admin
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  Manage workspace operations
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Invite users, manage jobsites, and keep safety records moving
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_170px_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search jobsites, documents, or employees..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400"
            />
            <select
              value={selectedJobsite}
              onChange={(event) => setSelectedJobsite(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
            >
              {jobsiteOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All jobsites" : option}
                </option>
              ))}
            </select>
            <Link
              href="/company-users"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              {pendingUsers.length} pending approvals
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#4f7cff_0%,_#5b6cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,124,255,0.24)]">
                Add New
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-10 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                {[
                  { href: "/jobsites", label: "Add Jobsite", note: "Set up the next active project." },
                  { href: "/company-users", label: "Add User", note: "Invite and approve employees." },
                  { href: "/submit", label: "Submit New Document", note: "Start a document workflow." },
                  { href: "/field-id-exchange", label: "Report Safety Issue", note: "Track site concerns and actions." },
                  { href: "/upload", label: "Upload File", note: "Add field files or supporting records." },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block rounded-xl px-3 py-3 transition hover:bg-slate-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              {card.title}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-4xl font-black tracking-tight text-slate-950">
                {loading ? "-" : card.value}
              </div>
              <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{card.note}</p>
          </Link>
        ))}
      </section>

      <section id="jobsites" className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Jobsites Overview"
          description="Jobsite rows are grouped from the company documents you already have in the system, so you can organize the workspace before dedicated site assignment tables are added."
          aside={
            <div className="flex flex-wrap gap-2">
              <a
                href="/jobsites"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Add Jobsite
              </a>
              <a
                href="/jobsites"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Archive Jobsite
              </a>
            </div>
          }
        >
          {filteredJobsites.length === 0 ? (
            <EmptyState
              title="No jobsites are active yet"
              description="As project names are used in submitted documents, your company dashboard will group them here as jobsites."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredJobsites.map((jobsite) => (
                <div key={jobsite.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-slate-950">{jobsite.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{jobsite.location}</div>
                    </div>
                    <StatusBadge
                      label={jobsite.status}
                      tone={
                        jobsite.status === "Action needed"
                          ? "warning"
                          : jobsite.status === "Active"
                            ? "success"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Project number
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.projectNumber}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Team users
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {companyUsers.length} workspace users
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Pending docs
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.pendingDocuments}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Last activity
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {formatRelative(jobsite.lastActivity)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>{jobsite.totalDocuments} tracked document{jobsite.totalDocuments === 1 ? "" : "s"}</span>
                    <Link href="/jobsites" className="font-semibold text-sky-700">
                      View Site
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pending Documents"
          description="The document queue that needs the company’s attention today."
        >
          {pendingDocuments.length === 0 ? (
            <EmptyState
              title="No documents are waiting right now"
              description="Submitted company documents will appear here as soon as they need review or follow-up."
            />
          ) : (
            <div className="space-y-3">
              {pendingDocuments.slice(0, 5).map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {getDocumentLabel(document)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {(document.project_name?.trim() || "General Workspace")} · {document.document_type || "Document"}
                      </div>
                    </div>
                    <StatusBadge label={getDocumentStatusLabel(document.status, Boolean(document.final_file_path))} tone="warning" />
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Submitted {formatRelative(document.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>

      <section id="documents" className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Document Control"
          description="Track the full company document pipeline from draft through approval."
          aside={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/submit"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Submit New Document
              </Link>
              <Link
                href="/upload"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Upload Existing Document
              </Link>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {documentSnapshotCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-3xl font-black text-slate-950">{card.value}</div>
                  <StatusBadge label={card.title.split(" ")[0]} tone={card.tone} />
                </div>
                <div className="mt-3 text-sm text-slate-500">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1.7fr)_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <div>Document</div>
              <div>Type</div>
              <div>Jobsite</div>
              <div>Status</div>
              <div>Submitted</div>
              <div>Action</div>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {filteredDocuments.slice(0, 8).map((document) => (
                <div
                  key={document.id}
                  className="grid grid-cols-[minmax(0,1.7fr)_0.9fr_1fr_0.9fr_0.9fr_1fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{getDocumentLabel(document)}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {document.file_name || "Company workspace record"}
                    </div>
                  </div>
                  <div>{document.document_type || "Document"}</div>
                  <div>{document.project_name || "General Workspace"}</div>
                  <div>
                    <StatusBadge
                      label={getDocumentStatusLabel(document.status, Boolean(document.final_file_path))}
                      tone={
                        isApprovedDocument(document)
                          ? "success"
                          : isSubmittedDocumentStatus(document.status, Boolean(document.final_file_path))
                            ? "warning"
                            : "info"
                      }
                    />
                  </div>
                  <div className="text-slate-500">{formatRelative(document.created_at)}</div>
                  <div>
                    <Link href="/library" className="font-semibold text-sky-700">
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 ? (
                <div className="px-4 py-8">
                  <EmptyState
                    title="No documents match this view"
                    description="Change the search or jobsite filter, or add a new document to start the company record pipeline."
                  />
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Users"
          description="The company access snapshot: who is online, waiting, invited, or inactive."
          aside={
            <Link
              href="/company-users"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Manage Users
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {userSnapshotCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 text-3xl font-black text-slate-950">{card.value}</div>
                <div className="mt-2 text-sm text-slate-500">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {filteredUsers.slice(0, 6).map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge label={user.role} tone="info" />
                      <StatusBadge
                        label={isOnline(user.last_sign_in_at) ? "Online" : user.status}
                        tone={isOnline(user.last_sign_in_at) ? "success" : getStatusTone(user.status)}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Last active {formatRelative(user.last_sign_in_at || user.created_at)}</div>
                    <div className="mt-1">Certifications managed in profile</div>
                    <Link
                      href="/company-users"
                      className="mt-2 inline-flex font-semibold text-sky-700"
                    >
                      Open user access
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 ? (
              <EmptyState
                title="No company users match this view"
                description="Invite your first employee or adjust the current dashboard search."
              />
            ) : null}
          </div>
        </SectionCard>
      </section>

      <section id="field-id-exchange" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Field iD Exchange"
          description="A live field board for hazards, near misses, stop-work events, positive observations, and corrective actions tied to each jobsite."
          aside={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/field-id-exchange"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Report Safety Issue
              </Link>
              <Link
                href="/upload"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Upload Field Photo
              </Link>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              "Hazard",
              "Near Miss",
              "Incident",
              "Good Catch",
              "PPE Violation",
              "Equipment Issue",
            ].map((category) => (
              <div key={category} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{category}</div>
                <div className="mt-1 text-xs text-slate-500">0 open reports</div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <EmptyState
              title="No field issues are live yet"
              description="This board becomes the company’s live issue exchange as supervisors begin reporting hazards, near misses, and corrective actions."
            />
          </div>
        </SectionCard>

        <div id="action-board" className="space-y-6">
          <ActivityFeed
            title="Recent Activity"
            description="The latest document, invite, and access activity across the company workspace."
            items={
              recentActivityItems.length > 0
                ? recentActivityItems
                : [
                    {
                      id: "empty-company-activity",
                      title: "No workspace activity yet",
                      detail: "New documents, invites, and access changes will show up here.",
                      meta: "Waiting",
                      tone: "neutral" as const,
                    },
                  ]
            }
          />

          <SectionCard
            title="Corrective Actions & Overdue Items"
            description="Today’s items that still need follow-up from the company side."
          >
            {correctiveActions.length === 0 ? (
              <EmptyState
                title="No overdue actions right now"
                description="Pending approvals, document review items, and waiting invites will appear here when the company workspace needs action."
              />
            ) : (
              <div className="space-y-3">
                {correctiveActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
                      </div>
                      <StatusBadge label={item.meta} tone={item.tone} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Workspace Signals"
            description="A quick pulse on what the company admin cares about most."
          >
            <div className="grid gap-3">
              {[
                {
                  label: "Company users online",
                  value: `${onlineUsers.length} online now`,
                },
                {
                  label: "Pending employee approvals",
                  value: `${pendingUsers.length} waiting`,
                },
                {
                  label: "Invites not accepted yet",
                  value: `${companyInvites.length} pending`,
                },
                {
                  label: "Company profile status",
                  value: companyProfile?.status?.trim() || "Active",
                },
              ].map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {signal.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{signal.value}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>

      <section id="reports" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Reports & Trends"
          description="High-level reporting blocks that help the company admin answer what needs action today."
          aside={
            <Link
              href="/reports"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Open Reports
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {reportWidgets.map((widget) => (
              <div
                key={widget.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="text-sm font-semibold text-slate-900">{widget.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{widget.note}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Alerts & Notifications"
          description="Everything the company admin should keep an eye on in the current workspace."
        >
          <div className="space-y-3">
            {[
              {
                label: "Pending employee approvals",
                value: `${pendingUsers.length} waiting`,
              },
              {
                label: "Pending document reviews",
                value: `${pendingDocuments.length} in queue`,
              },
              {
                label: "Invites not accepted",
                value: `${companyInvites.length} outstanding`,
              },
              {
                label: "Overdue action items",
                value: `${overdueActionsCount} flagged`,
              },
            ].map((alert) => (
              <div
                key={alert.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {alert.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{alert.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
