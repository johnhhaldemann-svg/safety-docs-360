"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AgreementAuditRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  acceptedTerms: boolean;
  acceptedAt: string | null;
  ipAddress: string | null;
  termsVersion: string | null;
  isCurrentVersion: boolean;
  createdAt: string | null;
};

type AgreementAuditResponse = {
  termsVersion: string;
  summary: {
    totalUsers: number;
    acceptedCount: number;
    pendingCount: number;
    currentVersionCount: number;
    outdatedCount: number;
  };
  agreements: AgreementAuditRow[];
};

function escapeCsv(value: string | number | boolean | null | undefined) {
  const normalized = String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Not accepted yet";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function AdminAgreementsPage() {
  const [audit, setAudit] = useState<AgreementAuditResponse>({
    termsVersion: "v1.0",
    summary: {
      totalUsers: 0,
      acceptedCount: 0,
      pendingCount: 0,
      currentVersionCount: 0,
      outdatedCount: 0,
    },
    agreements: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as an admin.");
    }

    return session.access_token;
  }, []);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/legal/agreements", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | (Partial<AgreementAuditResponse> & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load agreement audit.");
      }

      setAudit({
        termsVersion: String(data?.termsVersion ?? "v1.0"),
        summary: {
          totalUsers: Number(data?.summary?.totalUsers ?? 0),
          acceptedCount: Number(data?.summary?.acceptedCount ?? 0),
          pendingCount: Number(data?.summary?.pendingCount ?? 0),
          currentVersionCount: Number(data?.summary?.currentVersionCount ?? 0),
          outdatedCount: Number(data?.summary?.outdatedCount ?? 0),
        },
        agreements: Array.isArray(data?.agreements) ? data.agreements : [],
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load agreement audit."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const roleOptions = useMemo(() => {
    return Array.from(new Set(audit.agreements.map((row) => row.role))).sort();
  }, [audit.agreements]);

  const filteredAgreements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return audit.agreements.filter((row) => {
      const matchesSearch =
        query.length === 0 ||
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query) ||
        row.team.toLowerCase().includes(query) ||
        (row.ipAddress ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "accepted"
            ? row.acceptedTerms
            : statusFilter === "current"
              ? row.acceptedTerms && row.isCurrentVersion
              : statusFilter === "outdated"
                ? row.acceptedTerms && !row.isCurrentVersion
          : !row.acceptedTerms;

      const matchesRole = roleFilter === "all" ? true : row.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [audit.agreements, roleFilter, searchTerm, statusFilter]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      "user_id",
      "name",
      "email",
      "role",
      "team",
      "accepted_terms",
      "accepted_at",
      "ip_address",
      "terms_version",
      "created_at",
    ];

    const rows = filteredAgreements.map((row) =>
      [
        row.id,
        row.name,
        row.email,
        row.role,
        row.team,
        row.acceptedTerms,
        row.acceptedAt ?? "",
        row.ipAddress ?? "",
        row.termsVersion ?? "",
        row.createdAt ?? "",
      ]
        .map((value) => escapeCsv(value))
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agreement-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [filteredAgreements]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Legal Audit"
        title="Agreement Acceptance"
        description="Review who accepted the platform agreement, when they accepted it, and which version is on record."
        actions={
          <>
            <Link
              href="/admin/users"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Users
            </Link>
            <Link
              href="/admin/transactions"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Open Transactions
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={String(audit.summary.totalUsers)}
          note="Users included in this audit"
        />
        <StatCard
          title="Accepted"
          value={String(audit.summary.acceptedCount)}
          note="Users with any recorded acceptance"
        />
        <StatCard
          title="Current Version"
          value={String(audit.summary.currentVersionCount)}
          note={`Accepted on ${audit.termsVersion}`}
        />
        <StatCard
          title="Outdated"
          value={String(audit.summary.outdatedCount)}
          note="Users who must re-accept the latest version"
        />
        <StatCard
          title="Pending"
          value={String(audit.summary.pendingCount)}
          note="Users missing agreement acceptance"
        />
      </section>

      <SectionCard title="Audit Filters" description="Filter the agreement audit by acceptance status or role.">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Search Audit
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search user, email, team, IP..."
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Acceptance Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="all">All Statuses</option>
                <option value="accepted">Accepted</option>
                <option value="current">Current Version</option>
                <option value="outdated">Outdated Version</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                User Role
              </label>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="all">All Roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setRoleFilter("all");
              }}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredAgreements.length === 0}
              className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export CSV
            </button>
          </div>
        </div>

        {message ? <div className="mt-4"><InlineMessage>{message}</InlineMessage></div> : null}
      </SectionCard>

      <SectionCard
        title="Acceptance Records"
        description={`${filteredAgreements.length} user${filteredAgreements.length === 1 ? "" : "s"} match the current filters.`}
        aside={
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-300">
            Current version: {audit.termsVersion}
          </div>
        }
      >
        {loading ? (
          <InlineMessage>Loading agreement audit...</InlineMessage>
        ) : filteredAgreements.length === 0 ? (
          <EmptyState
            title="No agreement records match the current filters"
            description="Try clearing filters or broadening the search terms."
          />
        ) : (
          <div className="space-y-4">
            {filteredAgreements.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-700/80 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {row.name}
                      </h3>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          row.acceptedTerms
                            ? row.isCurrentVersion
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                            : "bg-slate-200 text-slate-300",
                        ].join(" ")}
                      >
                        {row.acceptedTerms
                          ? row.isCurrentVersion
                            ? "Current"
                            : "Outdated"
                          : "Pending"}
                      </span>
                      <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
                        {row.role}
                      </span>
                    </div>

                    <p className="mt-2 break-all text-sm text-slate-400">{row.email}</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MiniInfo label="Team" value={row.team} subvalue="Role context" />
                      <MiniInfo
                        label="Accepted At"
                        value={row.acceptedAt ? new Date(row.acceptedAt).toLocaleString() : "Not accepted"}
                        subvalue={formatRelative(row.acceptedAt)}
                      />
                      <MiniInfo
                        label="Terms Version"
                        value={row.termsVersion ?? "Not recorded"}
                        subvalue={
                          row.acceptedTerms
                            ? row.isCurrentVersion
                              ? "Current agreement on file"
                              : "Older version on file"
                            : "Awaiting acceptance"
                        }
                      />
                      <MiniInfo
                        label="IP Address"
                        value={row.ipAddress ?? "Not recorded"}
                        subvalue={row.createdAt ? `User created ${new Date(row.createdAt).toLocaleDateString()}` : "No creation timestamp"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function MiniInfo({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 break-all text-xs text-slate-500">{subvalue}</p>
    </div>
  );
}
