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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_45%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Project Workspace
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
              Dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              Track submissions, approvals, and approved deliverables from one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/peshep"
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold !text-white shadow-sm transition hover:bg-sky-500"
              >
                Build PESHEP
              </Link>
              <Link
                href="/submit"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold !text-slate-700 transition hover:bg-slate-50"
              >
                Submit Request
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/80 bg-white/84 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {item.title}
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                    {loading ? "-" : item.value}
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-8 text-white lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
              Workspace status
            </p>
            <h2 className="mt-3 text-2xl font-black">Today&apos;s overview</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              See what needs attention, what&apos;s already approved, and where the
              latest activity is happening.
            </p>

            <div className="mt-8 space-y-3">
              {systemStatus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      Tool health
                    </div>
                  </div>
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

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Latest updates
              </div>
              <div className="mt-4 space-y-3">
                {recentActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-300">
                    No document activity yet.
                  </div>
                ) : (
                  recentActivity.slice(0, 3).map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/20 text-xs font-black text-sky-200">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{item.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Quick Actions
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Open the most-used tools in your workspace.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => (
              <div
                key={action.title}
                className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-sm"
              >
                <h3 className="text-xl font-bold tracking-tight text-slate-950">
                  {action.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {action.description}
                </p>
                <Link
                  href={action.href}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold !text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-100"
                >
                  {action.button}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Priority Items
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Focus items for today&apos;s workflow.
          </p>

          <div className="mt-6 space-y-4">
            {priorities.map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfdff_100%)] p-4"
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
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Recent Activity
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
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
                  className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfdff_100%)] px-4 py-4"
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

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            System Status
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Current status of the workspace tools.
          </p>

          <div className="mt-6 space-y-4">
            {systemStatus.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfdff_100%)] px-4 py-4"
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
