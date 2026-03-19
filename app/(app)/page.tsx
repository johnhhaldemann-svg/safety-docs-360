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
    title: "Quick Actions",
    description: "Open your most-used workflow tools.",
    href: "/submit",
    button: "View All",
  },
  {
    title: "Scan Documents",
    description: "Verify submissions for safety standards.",
    href: "/search",
    button: "Run Check",
  },
  {
    title: "Compliance Check",
    description: "Verify adherence to safety standards.",
    href: "/library",
    button: "Run Check",
  },
  {
    title: "Team Notifications",
    description: "Send alerts to your team members.",
    href: "/submit",
    button: "Send Now",
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

function changeForIndex(index: number) {
  const values = ["+15%", "+0%", "+8%", "+12%"];
  return values[index] ?? "+4%";
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

  const activeDocuments = useMemo(
    () => documents.filter((doc) => !isArchivedStatus(doc.status)),
    [documents]
  );

  const stats = useMemo(() => {
    const approved = activeDocuments.filter(
      (doc) =>
        doc.status?.trim().toLowerCase() === "approved" ||
        Boolean(doc.final_file_path)
    );
    const pendingReview = activeDocuments.filter(
      (doc) => doc.status?.trim().toLowerCase() === "submitted"
    );
    const uniqueProjects = new Set(
      activeDocuments.map((doc) => doc.project_name).filter(Boolean)
    );

    return [
      { title: "Active Projects", value: String(uniqueProjects.size), sublabel: "24%" },
      { title: "Pending Review", value: String(pendingReview.length), sublabel: "30%" },
      { title: "Approved Files", value: String(approved.length), sublabel: "33%" },
      { title: "Library Docs", value: String(activeDocuments.length), sublabel: "23%" },
    ];
  }, [activeDocuments]);

  const recentActivity = useMemo(() => {
    return activeDocuments.slice(0, 5).map((doc) => {
      const title = doc.project_name ?? doc.document_type ?? "Untitled Document";
      const status = doc.status?.trim().toLowerCase() ?? "saved";

      let action = "updated";
      if (status === "approved") action = "approved";
      else if (status === "submitted") action = "submitted for review";
      else if (doc.draft_file_path) action = "draft saved";

      return {
        id: doc.id,
        label: `${title} ${action}`,
        time: formatRelative(doc.created_at),
      };
    });
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
      {
        label: "Compliance Module",
        text: approved ? "Status: Online" : "Needs attention",
        tone: approved ? "green" : "amber",
      },
      {
        label: "Analytics Engine",
        text: pendingReview ? "In progress" : "Status: Online",
        tone: pendingReview ? "amber" : "green",
      },
    ];
  }, [activeDocuments]);

  const spotlightCards = useMemo(() => {
    return [
      {
        title: "Approved Files",
        value: String(
          activeDocuments.filter(
            (doc) =>
              doc.status?.trim().toLowerCase() === "approved" ||
              Boolean(doc.final_file_path)
          ).length
        ),
      },
      {
        title: "Library Docs",
        value: String(activeDocuments.length),
      },
      {
        title: "Library Docs",
        value: String(Math.max(0, activeDocuments.length + 2)),
      },
      {
        title: "Library Docs",
        value: String(Math.max(0, activeDocuments.length + 2)),
      },
    ];
  }, [activeDocuments]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <div className="space-y-5">
        <section className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-6 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Project Workspace
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
                Dashboard
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Track submissions, approvals, and approved deliverables from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/submit"
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
              >
                Generate Report
              </Link>
              <Link
                href="/peshep"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Schedule Review
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item, index) => (
              <div
                key={item.title}
                className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {item.title}
                </div>
                <div className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  {loading ? "-" : item.value}
                </div>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{item.sublabel}</span>
                  <span className="font-semibold text-emerald-600">{changeForIndex(index)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {spotlightCards.map((card, index) => (
              <div
                key={`${card.title}-${index}`}
                className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[11px] font-black text-sky-700">
                      D
                    </span>
                    <span className="text-lg font-bold text-slate-900">{card.title}</span>
                  </div>
                  <Link href="/library" className="text-sm font-medium text-slate-500">
                    View All
                  </Link>
                </div>
                <div className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <div className="grid gap-4 md:grid-cols-2">
              {quickActions.map((action, index) => (
                <div
                  key={action.title}
                  className={index === 0 ? "rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm md:col-span-1" : "rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[11px] font-black text-sky-700">
                        {index + 1}
                      </span>
                      <span className="text-lg font-bold text-slate-900">{action.title}</span>
                    </div>
                    <Link href={action.href} className="text-sm font-medium text-slate-500">
                      View All
                    </Link>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{action.description}</p>
                  <div className="mt-5 text-4xl font-black tracking-tight text-slate-950">
                    {index === 0 ? "6" : ""}
                  </div>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Latest Updates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  System news for busy operations teams.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {(recentActivity.length ? recentActivity : [
                { id: "fallback-1", label: "Review the new compliance checklist", time: "today" },
                { id: "fallback-2", label: "Review the new compliance checklist", time: "today" },
                { id: "fallback-3", label: "Archive completed projects from last quarter", time: "5 days ago" },
                { id: "fallback-4", label: "Archive completed projects from last quarter", time: "5 days ago" },
              ]).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Recent Activity
                </h2>
              </div>
              <Link href="/search" className="text-sm font-medium text-slate-500">
                Load More
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {(recentActivity.length ? recentActivity : [
                { id: "ra-1", label: "Draft Saved", time: "2 hours ago" },
                { id: "ra-2", label: "File Uploaded", time: "1 day ago" },
              ]).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
                    {index + 3}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Link
                href="/search"
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Load More
              </Link>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                System Status
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Real-time operational system health.
              </p>
              <div className="mt-5 space-y-3">
                {systemStatus.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  >
                    <span className="text-sm font-medium text-slate-800">{item.label}</span>
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        item.tone === "green"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      ].join(" ")}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Team Activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Snapshot of active contributors.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  { name: "Jane Smith", meta: "15 uploads" },
                  { name: "Mike Johnson", meta: "12 reviews" },
                  { name: "Sarah Lee", meta: "6 approvals" },
                ].map((person, index) => (
                  <div
                    key={person.name}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#dbeafe_0%,_#bfdbfe_100%)] text-sm font-black text-sky-700">
                        {person.name.split(" ").map((word) => word[0]).join("")}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{person.name}</div>
                        <div className="mt-1 text-xs text-slate-400">{person.meta}</div>
                      </div>
                    </div>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="rounded-[1.8rem] border border-slate-800 bg-[linear-gradient(180deg,_#20365f_0%,_#203455_100%)] p-5 text-white shadow-[0_16px_35px_rgba(15,23,42,0.22)]">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-300">
          Workspace Status
        </div>
        <div className="mt-3 text-3xl font-black tracking-tight">Today&apos;s overview</div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/peshep"
            className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Build PESHEP
          </Link>
          <Link
            href="/submit"
            className="rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100"
          >
            Schedule Review
          </Link>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-200">Current Activity</div>
            <Link href="/search" className="text-xs font-medium text-slate-300">
              View All
            </Link>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
            <div className="text-sm font-semibold text-white">Upcoming Deadlines</div>
            <div className="mt-4 space-y-3">
              {(recentActivity.length ? recentActivity.slice(0, 4) : [
                { id: "ud-1", label: "Safety Audit", time: "2 days left" },
                { id: "ud-2", label: "Safety Audit", time: "3 days left" },
                { id: "ud-3", label: "Document Approval", time: "5 days left" },
              ]).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-300">{item.time}</div>
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
