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

const actionCards = [
  {
    title: "Safety Actions",
    description: "Verify adherence to OSHA standards.",
    href: "/library",
    button: "Inspect Now",
  },
  {
    title: "Generate Reports",
    description: "Generate PDF and daily safety document sets.",
    href: "/submit",
    button: "Generate PDF",
  },
  {
    title: "Risk Assessment",
    description: "Assess job hazards.",
    href: "/search",
    button: "Assess Now",
  },
  {
    title: "Alert Crew",
    description: "Send safety alerts to workers.",
    href: "/submit",
    button: "Alert Now",
  },
];

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

  const approvedCount = useMemo(
    () =>
      activeDocuments.filter(
        (doc) =>
          doc.status?.trim().toLowerCase() === "approved" ||
          Boolean(doc.final_file_path)
      ).length,
    [activeDocuments]
  );

  const pendingReviewCount = useMemo(
    () =>
      activeDocuments.filter((doc) => doc.status?.trim().toLowerCase() === "submitted")
        .length,
    [activeDocuments]
  );

  const activeSites = useMemo(() => {
    return new Set(activeDocuments.map((doc) => doc.project_name).filter(Boolean)).size;
  }, [activeDocuments]);

  const heroStats = [
    { title: "Active Sites", value: String(activeSites), share: "26%", change: "+15%", icon: "helmet" },
    { title: "Pending Inspections", value: String(pendingReviewCount), share: "30%", change: "+0%", icon: "clip" },
    { title: "Approved Safety Docs", value: String(approvedCount), share: "33%", change: "+6%", icon: "shield" },
    { title: "Compliance Checklist", value: String(activeDocuments.length), share: "23%", change: "+12%", icon: "sheet" },
  ];

  const documentBlocks = [
    { title: "Approved Safety Docs", value: String(approvedCount) },
    { title: "OSHA Compliance", value: String(Math.max(1, approvedCount)) },
    { title: "Incident Reports", value: String(Math.max(1, activeDocuments.length + 2)) },
    { title: "Training Records", value: String(Math.max(1, activeDocuments.length + 2)) },
  ];

  const recentActivity = useMemo(() => {
    const items = activeDocuments.slice(0, 5).map((doc) => {
      const title = doc.project_name ?? doc.document_type ?? "Untitled Document";
      const status = doc.status?.trim().toLowerCase() ?? "saved";

      let action = "updated";
      if (status === "approved") action = "approved";
      else if (status === "submitted") action = "created";
      else if (doc.draft_file_path) action = "drafted";

      return {
        id: doc.id,
        label: `${title} ${action}`,
        time: formatRelative(doc.created_at),
      };
    });

    if (items.length > 0) return items;

    return [
      { id: "fallback-1", label: "Incident Report Drafted", time: "2 hours ago" },
      { id: "fallback-2", label: "Safety Plan Approved", time: "1 day ago" },
    ];
  }, [activeDocuments]);

  const latestUpdates = [
    "Review Fall Protection Plan",
    "Update Confined Space Permit",
    "Archive the new compliance checklist",
    "Approve Heat Visibility",
    "Archive completed projects from last quarter",
  ];

  const upcomingInspections = [
    "Q1 Safety Audit - 2 days left",
    "Q2 Safety Audit - 2 days left",
    "Fire Exting Renewal - 5 days left",
  ];

  const systemStatus = [
    { label: "Compliance Module", badge: "OSHA Module" },
    { label: "Analytics Engine", badge: "Alerts Tracker" },
  ];

  const officers = [
    { name: "Jane Smith", note: "Field Safety Officer - 15 updates" },
    { name: "Mike Johnson", note: "Shift Lead - 12 uploads" },
    { name: "Sarah Lee", note: "Lead QC - 6 approvals" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <div className="space-y-5">
        <section className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-6 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Construction Safety Hub
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
                Safety360Docs
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Safety administration, active sites, and approved documents all in one place.
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
            {heroStats.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {item.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-4xl font-black tracking-tight text-slate-950">
                    {loading ? "-" : item.value}
                  </div>
                  <StatIcon kind={item.icon} />
                </div>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{item.share}</span>
                  <span className="font-semibold text-emerald-600">{item.change}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {documentBlocks.map((card) => (
              <div
                key={card.title}
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
              {actionCards.map((action) => (
                <div
                  key={action.title}
                  className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[11px] font-black text-sky-700">
                        A
                      </span>
                      <span className="text-lg font-bold text-slate-900">{action.title}</span>
                    </div>
                    <Link href={action.href} className="text-sm font-medium text-slate-500">
                      View All
                    </Link>
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
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Latest Updates
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Fresh notes for busy teams onsite.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {latestUpdates.map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 truncate text-sm font-medium text-slate-800">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Recent Activity
              </h2>
              <Link
                href="/submit"
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Send Now
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {recentActivity.map((item, index) => (
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
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-[#d9e8ff] bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                System Status
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Real-time overall control system.
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
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Top Safety Officers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Most active contributors by role.
              </p>
              <div className="mt-5 space-y-3">
                {officers.map((person, index) => (
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
                        <div className="mt-1 text-xs text-slate-400">{person.note}</div>
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
          Site Safety Status
        </div>
        <div className="mt-3 text-3xl font-black tracking-tight">Today&apos;s Site Status</div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/peshep"
            className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Build Inspection
          </Link>
          <Link
            href="/submit"
            className="rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100"
          >
            Report Incident
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
            <div className="text-sm font-semibold text-white">Upcoming Inspections</div>
            <div className="mt-4 space-y-3">
              {upcomingInspections.map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-xs font-black text-sky-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0 truncate text-sm font-medium text-white">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatIcon({ kind }: { kind: string }) {
  const common = "h-9 w-9";

  if (kind === "helmet") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <path d="M5 13a7 7 0 1 1 14 0v1H5v-1Z" fill="#FCD34D" />
        <path d="M3 14h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2Z" fill="#F59E0B" />
      </svg>
    );
  }

  if (kind === "clip") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <rect x="6" y="4" width="12" height="16" rx="2" fill="#DBEAFE" />
        <rect x="9" y="2" width="6" height="4" rx="1" fill="#93C5FD" />
        <path d="M9 10h6M9 14h6" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "shield") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
        <path d="M12 3 6 5.5v5.3c0 4.2 2.7 8 6 9.2 3.3-1.2 6-5 6-9.2V5.5L12 3Z" fill="#93C5FD" />
        <path d="M12 7v8" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none">
      <rect x="6" y="4" width="12" height="16" rx="2" fill="#BFDBFE" />
      <path d="M9 9h6M9 13h6M9 17h4" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
