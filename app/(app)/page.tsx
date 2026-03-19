"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

type CountCard = {
  title: string;
  value: string;
  note: string;
  trend: string;
  icon: "projects" | "review" | "approved" | "records";
};

type WorkspaceCard = {
  title: string;
  value: string;
  description: string;
  href: string;
};

type ActionCard = {
  title: string;
  description: string;
  href: string;
  button: string;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

function isSubmittedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "submitted";
}

function isApprovedDocument(document: DocumentRow) {
  return (
    document.status?.trim().toLowerCase() === "approved" ||
    Boolean(document.final_file_path)
  );
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Updated recently";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getDocumentLabel(document: DocumentRow) {
  return (
    document.document_title ??
    document.project_name ??
    document.file_name ??
    "Untitled document"
  );
}

function getStatusLabel(document: DocumentRow) {
  if (isApprovedDocument(document)) return "Approved";
  if (isSubmittedStatus(document.status)) return "In review";
  if (!document.status) return "Draft";

  const normalized = document.status.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeType(documentType?: string | null) {
  return (documentType ?? "").trim().toLowerCase();
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Dashboard load error:", error.message);
      } else {
        setDocuments((data ?? []) as DocumentRow[]);
      }

      setLoading(false);
    })();
  }, []);

  const activeDocuments = useMemo(
    () => documents.filter((document) => !isArchivedStatus(document.status)),
    [documents]
  );

  const uniqueProjects = useMemo(() => {
    return new Set(
      activeDocuments
        .map((document) => document.project_name?.trim())
        .filter((value): value is string => Boolean(value))
    ).size;
  }, [activeDocuments]);

  const pendingReviewCount = useMemo(
    () => activeDocuments.filter((document) => isSubmittedStatus(document.status)).length,
    [activeDocuments]
  );

  const approvedCount = useMemo(
    () => activeDocuments.filter((document) => isApprovedDocument(document)).length,
    [activeDocuments]
  );

  const templateCount = useMemo(
    () =>
      activeDocuments.filter((document) => normalizeType(document.document_type) === "template")
        .length,
    [activeDocuments]
  );

  const formCount = useMemo(
    () =>
      activeDocuments.filter((document) => normalizeType(document.document_type) === "form")
        .length,
    [activeDocuments]
  );

  const reportCount = useMemo(
    () =>
      activeDocuments.filter((document) => normalizeType(document.document_type) === "report")
        .length,
    [activeDocuments]
  );

  const peshepCount = useMemo(
    () =>
      activeDocuments.filter((document) =>
        /(peshep|pshsep)/i.test(document.document_type ?? "")
      ).length,
    [activeDocuments]
  );

  const csepCount = useMemo(
    () =>
      activeDocuments.filter((document) => /csep/i.test(document.document_type ?? "")).length,
    [activeDocuments]
  );

  const countCards: CountCard[] = [
    {
      title: "Active Projects",
      value: String(uniqueProjects),
      note: "Unique project names with active records",
      trend: pendingReviewCount > 0 ? `${pendingReviewCount} waiting review` : "No review backlog",
      icon: "projects",
    },
    {
      title: "Pending Review",
      value: String(pendingReviewCount),
      note: "Submitted records waiting for approval",
      trend: pendingReviewCount > 0 ? "Action needed" : "Queue is clear",
      icon: "review",
    },
    {
      title: "Approved Files",
      value: String(approvedCount),
      note: "Completed documents ready for library access",
      trend: approvedCount > 0 ? "Ready to open" : "No completed docs yet",
      icon: "approved",
    },
    {
      title: "Total Records",
      value: String(activeDocuments.length),
      note: "All active uploads, drafts, and completed files",
      trend: `${templateCount + formCount + reportCount} standard docs tracked`,
      icon: "records",
    },
  ];

  const workspaceCards: WorkspaceCard[] = [
    {
      title: "Ready Library Docs",
      value: String(approvedCount),
      description: "Approved and completed files available in the library.",
      href: "/library",
    },
    {
      title: "Submit Queue",
      value: String(pendingReviewCount),
      description: "Requests and documents currently moving through review.",
      href: "/submit",
    },
    {
      title: "PESHEP Files",
      value: String(peshepCount),
      description: "Project safety and health execution plans in the system.",
      href: "/peshep",
    },
    {
      title: "CSEP Files",
      value: String(csepCount),
      description: "Contractor site-specific safety plans tracked here.",
      href: "/csep",
    },
  ];

  const actionCards: ActionCard[] = [
    {
      title: "Start Submission",
      description: "Create a new request and send documents into the review workflow.",
      href: "/submit",
      button: "Open Submit",
    },
    {
      title: "Build PESHEP",
      description: "Launch the PESHEP builder for project safety planning.",
      href: "/peshep",
      button: "Build Plan",
    },
    {
      title: "Build CSEP",
      description: "Create contractor-specific safety documentation and controls.",
      href: "/csep",
      button: "Open CSEP",
    },
    {
      title: "Upload Files",
      description: "Add templates, forms, reports, and supporting documents.",
      href: "/upload",
      button: "Upload Now",
    },
  ];

  const recentActivity = useMemo(() => {
    const items = activeDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      status: getStatusLabel(document),
      time: formatRelative(document.created_at),
    }));

    if (items.length > 0) return items;

    return [
      { id: "empty-1", title: "No recent document activity yet", status: "Waiting", time: "Start by uploading or submitting a document" },
    ];
  }, [activeDocuments]);

  const reviewQueueItems = useMemo(() => {
    const queued = activeDocuments
      .filter((document) => isSubmittedStatus(document.status))
      .slice(0, 4)
      .map((document) => ({
        id: document.id,
        title: getDocumentLabel(document),
        detail: document.project_name || document.document_type || "Submitted document",
      }));

    if (queued.length > 0) return queued;

    return [
      { id: "queue-1", title: "Review queue is clear", detail: "New submissions will appear here for quick follow-up." },
    ];
  }, [activeDocuments]);

  const latestUpdates = useMemo(() => {
    const items = [
      {
        id: "update-library",
        title: approvedCount > 0 ? `${approvedCount} approved file${approvedCount === 1 ? "" : "s"} ready in library` : "No approved files in library yet",
        detail: "Library",
      },
      {
        id: "update-submit",
        title: pendingReviewCount > 0 ? `${pendingReviewCount} file${pendingReviewCount === 1 ? "" : "s"} currently waiting for review` : "Submission queue is currently clear",
        detail: "Review",
      },
      {
        id: "update-upload",
        title: `${templateCount} template${templateCount === 1 ? "" : "s"}, ${formCount} form${formCount === 1 ? "" : "s"}, ${reportCount} report${reportCount === 1 ? "" : "s"}`,
        detail: "Document mix",
      },
      {
        id: "update-projects",
        title: uniqueProjects > 0 ? `${uniqueProjects} active project${uniqueProjects === 1 ? "" : "s"} in the workspace` : "No active projects have been named yet",
        detail: "Projects",
      },
    ];

    return items;
  }, [approvedCount, pendingReviewCount, templateCount, formCount, reportCount, uniqueProjects]);

  const systemStatus = [
    {
      label: "Library Access",
      badge: approvedCount > 0 ? "Ready" : "Waiting",
    },
    {
      label: "Review Queue",
      badge: pendingReviewCount > 0 ? "Needs attention" : "Clear",
    },
    {
      label: "Upload Center",
      badge: activeDocuments.length > 0 ? "Active" : "Ready",
    },
    {
      label: "Search Index",
      badge: activeDocuments.length > 0 ? "Searchable" : "No records",
    },
  ];

  const workspaceTools = [
    {
      title: "Open Library",
      note: "Browse approved and active project files.",
      href: "/library",
    },
    {
      title: "Search Records",
      note: "Find files by title, type, or category.",
      href: "/search",
    },
    {
      title: "My Purchases",
      note: "Access unlocked completed documents.",
      href: "/purchases",
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:gap-5">
      <div className="space-y-4 xl:space-y-5">
        <section className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-6 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Construction Safety Hub
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Safety360Docs
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Manage submissions, approvals, uploads, and project safety documentation
                from one clean workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/submit"
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
              >
                New Submission
              </Link>
              <Link
                href="/upload"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Upload Documents
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {countCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-4xl font-black tracking-tight text-slate-950">
                    {loading ? "-" : card.value}
                  </div>
                  <DashboardIcon kind={card.icon} />
                </div>
                <p className="mt-4 text-sm text-slate-500">{card.note}</p>
                <div className="mt-3 text-sm font-semibold text-emerald-600">
                  {card.trend}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {workspaceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[11px] font-black text-sky-700">
                      D
                    </span>
                    <span className="text-lg font-bold text-slate-900">{card.title}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Open</span>
                </div>
                <div className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                  {loading ? "-" : card.value}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr] xl:gap-5">
          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {actionCards.map((action) => (
                <div
                  key={action.title}
                  className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[11px] font-black text-sky-700">
                      A
                    </span>
                    <span className="text-lg font-bold text-slate-900">{action.title}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{action.description}</p>
                  <Link
                    href={action.href}
                    className="mt-5 inline-flex rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(91,108,255,0.18)]"
                  >
                    {action.button}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Latest Updates
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Live signals based on your current workspace records.
            </p>

            <div className="mt-6 space-y-3">
              {latestUpdates.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">{item.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr] xl:gap-5">
          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Recent Activity
              </h2>
              <Link
                href="/library"
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-xs font-semibold text-white sm:text-sm"
              >
                Open Library
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentActivity.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {item.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{item.status}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Workspace Status
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Real-time view of the main tools in this portal.
              </p>

              <div className="mt-5 space-y-3">
                {systemStatus.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  >
                    <span className="text-sm font-medium text-slate-800">{item.label}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Workspace Tools
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Jump straight into the most-used parts of the app.
              </p>

              <div className="mt-5 space-y-3">
                {workspaceTools.map((tool) => (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-sky-200 hover:shadow-sm"
                  >
                    <div className="text-sm font-semibold text-slate-900">{tool.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{tool.note}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="order-first rounded-[1.8rem] border border-slate-800 bg-[linear-gradient(180deg,_#20365f_0%,_#203455_100%)] p-5 text-white shadow-[0_16px_35px_rgba(15,23,42,0.22)] xl:order-none">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-300">
          Site Safety Status
        </div>
        <div className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Today&apos;s Workspace</div>

        <div className="mt-3 text-sm leading-6 text-slate-300">
          Keep submissions moving, review new activity, and open the tools your team
          uses most.
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/peshep"
            className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-xs font-semibold text-white sm:text-sm"
          >
            Build PESHEP
          </Link>
          <Link
            href="/submit"
            className="rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-xs font-semibold text-slate-100 sm:text-sm"
          >
            Submit Request
          </Link>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-200">Current Activity</div>
            <Link href="/submit" className="text-xs font-medium text-slate-300">
              View Queue
            </Link>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
            <div className="text-sm font-semibold text-white">Items Waiting Review</div>
            <div className="mt-4 space-y-3">
              {reviewQueueItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-300">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DashboardIcon({ kind }: { kind: CountCard["icon"] }) {
  const common = "h-9 w-9";

  if (kind === "projects") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <path d="M4 18h16" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7 18v-6" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 18V8" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17 18v-3" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="7" cy="10" r="2" fill="#BFDBFE" />
        <circle cx="12" cy="6" r="2" fill="#93C5FD" />
        <circle cx="17" cy="13" r="2" fill="#DBEAFE" />
      </svg>
    );
  }

  if (kind === "review") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <rect x="6" y="4" width="12" height="16" rx="2" fill="#DBEAFE" />
        <path d="M9 9h6M9 13h4" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="16.5" cy="15.5" r="3.5" fill="#FDE68A" />
      </svg>
    );
  }

  if (kind === "approved") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <path d="M12 3 6 5.5v5.3c0 4.2 2.7 8 6 9.2 3.3-1.2 6-5 6-9.2V5.5L12 3Z" fill="#93C5FD" />
        <path d="m9.5 12 1.8 1.8L15 10.1" stroke="#1D4ED8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
      <rect x="5" y="4" width="14" height="16" rx="2" fill="#BFDBFE" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
