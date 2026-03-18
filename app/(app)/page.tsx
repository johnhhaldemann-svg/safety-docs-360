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
  document_type: string | null;
  status: string | null;
  draft_file_path?: string | null;
  final_file_path?: string | null;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

const quickActions = [
  {
    title: "Build PESHEP",
    description: "Start a new project safety and health execution plan.",
    href: "/peshep",
    button: "Open Builder",
  },
  {
    title: "Search Documents",
    description: "Find project files, forms, and saved safety records.",
    href: "/search",
    button: "Search Now",
  },
  {
    title: "Upload Files",
    description: "Add reports, forms, plans, and supporting documents.",
    href: "/upload",
    button: "Upload Files",
  },
  {
    title: "Open Library",
    description: "Browse templates, standards, and approved project content.",
    href: "/library",
    button: "View Library",
  },
  {
    title: "My Purchases",
    description: "Open completed documents you already own or unlocked with credits.",
    href: "/purchases",
    button: "Open Purchases",
  },
];

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
        setDocuments(data ?? []);
      }

      setLoading(false);
    })();
  }, []);

  const activeDocuments = useMemo(() => {
    return documents.filter((doc) => !isArchivedStatus(doc.status));
  }, [documents]);

  const stats = useMemo(() => {
    const approved = activeDocuments.filter(
      (doc) =>
        doc.status?.trim().toLowerCase() === "approved" ||
        Boolean(doc.final_file_path)
    );
    const pendingReview = activeDocuments.filter(
      (doc) => doc.status?.trim().toLowerCase() === "submitted"
    );
    const drafts = activeDocuments.filter((doc) => Boolean(doc.draft_file_path));
    const uniqueProjects = new Set(
      activeDocuments.map((doc) => doc.project_name).filter(Boolean)
    );

    return [
      {
        title: "Active Projects",
        value: String(uniqueProjects.size),
        note: `${drafts.length} draft${drafts.length === 1 ? "" : "s"} created`,
      },
      {
        title: "Pending Review",
        value: String(pendingReview.length),
        note: pendingReview.length
          ? "Awaiting admin approval"
          : "No documents waiting",
      },
      {
        title: "Approved Files",
        value: String(approved.length),
        note: approved.length
          ? "Final documents available"
          : "Nothing approved yet",
      },
      {
        title: "Library Docs",
        value: String(activeDocuments.length),
        note: `${activeDocuments.filter((doc) => doc.document_type === "PSHSEP").length} PSHSEP records`,
      },
    ];
  }, [activeDocuments]);

  const recentActivity = useMemo(() => {
    return activeDocuments.slice(0, 5).map((doc) => {
      const title =
        doc.project_name ?? doc.document_type ?? "Untitled Document";
      const status = doc.status?.trim().toLowerCase() ?? "saved";

      let action = "updated";
      if (status === "approved") action = "approved";
      else if (status === "submitted") action = "submitted for review";
      else if (doc.draft_file_path) action = "draft generated";

      return {
        id: doc.id,
        label: `${title} ${action}`,
        time: formatRelative(doc.created_at),
      };
    });
  }, [activeDocuments]);

  const priorities = useMemo(() => {
    const pendingReview = activeDocuments.filter(
      (doc) => doc.status?.trim().toLowerCase() === "submitted"
    ).length;
    const approved = activeDocuments.filter(
      (doc) =>
        doc.status?.trim().toLowerCase() === "approved" ||
        Boolean(doc.final_file_path)
    ).length;
    const draftsMissingFinal = activeDocuments.filter(
      (doc) => Boolean(doc.draft_file_path) && !doc.final_file_path
    ).length;

    return [
      pendingReview
        ? `${pendingReview} document${pendingReview === 1 ? "" : "s"} currently in review`
        : "No documents are currently waiting in review",
      draftsMissingFinal
        ? `${draftsMissingFinal} draft${draftsMissingFinal === 1 ? "" : "s"} still need final approval`
        : "All active drafts have been reviewed",
      approved
        ? `${approved} approved document${approved === 1 ? "" : "s"} ready in the library`
        : "No approved documents available yet",
      "Verify the latest PSHSEP submissions and final uploads",
    ];
  }, [activeDocuments]);

  const systemStatus = useMemo(() => {
    const pendingReview = activeDocuments.some(
      (doc) => doc.status?.trim().toLowerCase() === "submitted"
    );
    const approved = activeDocuments.some(
      (doc) =>
        doc.status?.trim().toLowerCase() === "approved" ||
        Boolean(doc.final_file_path)
    );

    return [
      { label: "Dashboard", tone: "green", text: "Online" },
      {
        label: "Library",
        tone: approved ? "green" : "amber",
        text: approved ? "Approved Files Ready" : "Waiting on Approvals",
      },
      {
        label: "Review Queue",
        tone: pendingReview ? "amber" : "green",
        text: pendingReview ? "In Progress" : "Clear",
      },
      { label: "Search", tone: "green", text: "Active" },
    ];
  }, [activeDocuments]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Project Workspace
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Track submissions, approvals, and approved deliverables from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/peshep"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Build PESHEP
            </Link>
            <Link
              href="/submit"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Submit Request
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {loading ? "-" : item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Open the most-used tools in your workspace.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => (
              <div
                key={action.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {action.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {action.description}
                </p>
                <Link
                  href={action.href}
                  className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {action.button}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Priority Items</h2>
          <p className="mt-1 text-sm text-slate-500">
            Focus items for today&apos;s workflow.
          </p>

          <div className="mt-6 space-y-4">
            {priorities.map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                  {index + 1}
                </div>
                <p className="pt-1 text-sm font-medium text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest activity across your document portal.
          </p>

          <div className="mt-6 space-y-4">
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No document activity yet.
              </div>
            ) : (
              recentActivity.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">System Status</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current status of the workspace tools.
          </p>

          <div className="mt-6 space-y-4">
            {systemStatus.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4"
              >
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    item.tone === "green"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700",
                  ].join(" ")}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
