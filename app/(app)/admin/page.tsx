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
  archived_at?: string | null;
  archived_by_email?: string | null;
  restored_at?: string | null;
  restored_by_email?: string | null;
  project_name: string | null;
  document_type: string | null;
  status: string | null;
  review_notes?: string | null;
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

function toneClasses(tone: "green" | "amber" | "red" | "blue") {
  if (tone === "green") return "bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  if (tone === "red") return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-700";
}

function getDocumentTitle(doc: DocumentRow) {
  return doc.project_name ?? doc.document_type ?? "Untitled Document";
}

export default function AdminPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Admin dashboard load error:", error.message);
      } else {
        setDocuments(data ?? []);
      }

      setLoading(false);
    })();
  }, []);

  const activeDocuments = useMemo(() => {
    return documents.filter((doc) => !isArchivedStatus(doc.status));
  }, [documents]);

  const pendingReview = useMemo(() => {
    return activeDocuments.filter(
      (doc) => doc.status?.trim().toLowerCase() === "submitted"
    );
  }, [activeDocuments]);

  const approvedDocuments = useMemo(() => {
    return activeDocuments.filter(
      (doc) =>
        doc.status?.trim().toLowerCase() === "approved" ||
        Boolean(doc.final_file_path)
    );
  }, [activeDocuments]);

  const pshsepDocs = useMemo(() => {
    return activeDocuments.filter((doc) => doc.document_type === "PSHSEP");
  }, [activeDocuments]);

  const archivedDocuments = useMemo(() => {
    return documents.filter((doc) => isArchivedStatus(doc.status));
  }, [documents]);

  const adminStats = useMemo(() => {
    return [
      {
        title: "Pending Approvals",
        value: String(pendingReview.length),
        note: pendingReview.length
          ? "Items waiting in review queue"
          : "Queue is clear",
      },
      {
        title: "Approved Documents",
        value: String(approvedDocuments.length),
        note: "Final files delivered to library",
      },
      {
        title: "PSHSEP Records",
        value: String(pshsepDocs.length),
        note: "Tracked across draft and final stages",
      },
      {
        title: "Archived Documents",
        value: String(archivedDocuments.length),
        note: archivedDocuments.length
          ? "Records hidden from the active workflow"
          : "No archived records",
      },
      {
        title: "Active Documents",
        value: String(activeDocuments.length),
        note: "All managed document rows",
      },
    ];
  }, [
    activeDocuments.length,
    approvedDocuments.length,
    archivedDocuments.length,
    pendingReview.length,
    pshsepDocs.length,
  ]);

  const reviewQueue = useMemo(() => {
    return pendingReview.slice(0, 6).map((doc) => ({
      id: doc.id,
      name: doc.project_name ?? doc.document_type ?? "Untitled Document",
      type: doc.document_type ?? "-",
      status: "Needs Review",
    }));
  }, [pendingReview]);

  const recentActivity = useMemo(() => {
    const events = documents.flatMap((doc) => {
      const title = getDocumentTitle(doc);
      const status = doc.status?.trim().toLowerCase() ?? "saved";
      const items: Array<{ id: string; text: string; time: string; sortAt: number }> = [];

      if (doc.archived_at) {
        items.push({
          id: `${doc.id}-archived`,
          text: `${title} archived by ${doc.archived_by_email ?? "an admin"}`,
          time: formatRelative(doc.archived_at),
          sortAt: new Date(doc.archived_at).getTime(),
        });
      }

      if (doc.restored_at) {
        items.push({
          id: `${doc.id}-restored`,
          text: `${title} restored by ${doc.restored_by_email ?? "an admin"}`,
          time: formatRelative(doc.restored_at),
          sortAt: new Date(doc.restored_at).getTime(),
        });
      }

      let action = "updated";
      if (status === "approved") action = "approved";
      else if (status === "submitted") action = "submitted";
      else if (doc.final_file_path) action = "final uploaded";

      items.push({
        id: `${doc.id}-base`,
        text: `${title} ${action}`,
        time: formatRelative(doc.created_at),
        sortAt: new Date(doc.created_at).getTime(),
      });

      return items;
    });

    return events
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 6)
      .map(({ id, text, time }) => ({
        id,
        text,
        time,
      }));
  }, [documents]);

  const recentlyArchived = useMemo(() => {
    return archivedDocuments
      .filter((doc) => Boolean(doc.archived_at))
      .sort(
        (a, b) =>
          new Date(b.archived_at ?? b.created_at).getTime() -
          new Date(a.archived_at ?? a.created_at).getTime()
      )
      .slice(0, 3);
  }, [archivedDocuments]);

  const systemControls = [
    { href: "/admin/review-documents", label: "Open review queue" },
    { href: "/admin/archive", label: "Restore or delete archived records" },
    { href: "/admin/marketplace", label: "Manage marketplace listings" },
    { href: "/admin/agreements", label: "Inspect agreement acceptance records" },
    { href: "/admin/transactions", label: "Inspect credit transactions" },
    { href: "/admin/users", label: "Manage users" },
    { href: "/admin/settings", label: "Edit admin settings" },
    { href: "/library", label: "Inspect approved library documents" },
  ];

  const systemStatus = [
    {
      label: "Review Queue",
      tone: pendingReview.length ? "amber" : "green",
      text: pendingReview.length ? "Attention Needed" : "Clear",
    },
    {
      label: "Document Library",
      tone: approvedDocuments.length ? "green" : "amber",
      text: approvedDocuments.length ? "Approved Files Live" : "Waiting on Finals",
    },
    {
      label: "PSHSEP Workflow",
      tone: pshsepDocs.length ? "blue" : "amber",
      text: pshsepDocs.length ? "Tracking Activity" : "No Active Records",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Administration
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Admin Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Review submitted drafts, approve final documents, and monitor the workspace from one admin-focused hub.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/review-documents"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Open Review Queue
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Admin Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {adminStats.map((item) => (
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
          <h2 className="text-xl font-bold text-slate-900">Admin Tools</h2>
          <p className="mt-1 text-sm text-slate-500">
            Jump straight into the controls admins actually use.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <AdminToolCard
              title="Review Queue"
              description="Approve submitted PSHSEP drafts and upload final files."
              href="/admin/review-documents"
              button="Review Documents"
            />
            <AdminToolCard
              title="User Management"
              description="Manage access, roles, and visibility across the workspace."
              href="/admin/users"
              button="Manage Users"
            />
            <AdminToolCard
              title="Archive Manager"
              description="Review archived records, restore them, or permanently delete old files."
              href="/admin/archive"
              button="Open Archive"
            />
            <AdminToolCard
              title="Marketplace"
              description="Set listing visibility, credit pricing, and see purchase activity."
              href="/admin/marketplace"
              button="Manage Marketplace"
            />
            <AdminToolCard
              title="Agreement Audit"
              description="Review who accepted the platform agreement, when they accepted it, and which version is on file."
              href="/admin/agreements"
              button="Open Agreements"
            />
            <AdminToolCard
              title="Transaction Audit"
              description="Inspect user-by-user credit grants and completed document purchases."
              href="/admin/transactions"
              button="Open Audit"
            />
            <AdminToolCard
              title="Admin Settings"
              description="Configure workflow behavior and platform defaults."
              href="/admin/settings"
              button="Open Settings"
            />
            <AdminToolCard
              title="Approved Library"
              description="Check what users can see after approval."
              href="/library"
              button="Open Library"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Approval Queue</h2>
          <p className="mt-1 text-sm text-slate-500">
            Documents currently waiting for admin action.
          </p>

          <div className="mt-6 space-y-4">
            {reviewQueue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No pending approvals right now.
              </div>
            ) : (
              reviewQueue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.type}</p>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${toneClasses(
                        "amber"
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent Admin Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest workflow changes across review and approval.
          </p>

          <div className="mt-6 space-y-4">
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No admin activity yet.
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
                    <p className="text-sm font-medium text-slate-800">{item.text}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Archived Recently</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The latest documents moved out of the active workflow.
                </p>
              </div>
              <Link
                href="/admin/archive"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Open Archive
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {recentlyArchived.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No archive activity yet.
                </div>
              ) : (
                recentlyArchived.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-slate-200 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {getDocumentTitle(doc)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Archived {formatRelative(doc.archived_at ?? doc.created_at)} by{" "}
                      {doc.archived_by_email ?? "Unknown admin"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">System Controls</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quick access to high-level admin actions.
            </p>

            <div className="mt-6 space-y-3">
              {systemControls.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span>{item.label}</span>
                  <span>&rarr;</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">System Status</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quick view of workspace services.
            </p>

            <div className="mt-6 space-y-4">
              {systemStatus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses(
                      item.tone
                    )}`}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminToolCard({
  title,
  description,
  href,
  button,
}: {
  title: string;
  description: string;
  href: string;
  button: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold !text-sky-900 transition hover:border-sky-300 hover:bg-sky-100"
      >
        {button}
      </Link>
    </div>
  );
}
