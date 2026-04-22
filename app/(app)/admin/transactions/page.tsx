"use client";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

const supabase = getSupabaseBrowserClient();

type AuditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  document_id?: string | null;
  description?: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  user_role: string;
  user_team: string;
  document_title: string;
  document_type?: string | null;
};

type AuditResponse = {
  ledgerEnabled: boolean;
  summary: {
    totalTransactions: number;
    totalCreditsGranted: number;
    totalCreditsSpent: number;
    totalPurchases: number;
  };
  transactions: AuditTransaction[];
};

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

function transactionTone(amount: number) {
  return amount >= 0 ? "app-badge-success" : "app-badge-warning";
}

function transactionLabel(type: string) {
  const normalized = type.trim().toLowerCase();

  if (normalized === "grant") return "Grant";
  if (normalized === "purchase") return "Purchase";
  return normalized.replace(/_/g, " ");
}

function escapeCsv(value: string | number | null | undefined) {
  const normalized = String(value ?? "");
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function AdminTransactionsPage() {
  const [audit, setAudit] = useState<AuditResponse>({
    ledgerEnabled: false,
    summary: {
      totalTransactions: 0,
      totalCreditsGranted: 0,
      totalCreditsSpent: 0,
      totalPurchases: 0,
    },
    transactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
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
      const res = await fetch("/api/admin/credits/audit", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | (Partial<AuditResponse> & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load transaction audit.");
      }

      setAudit({
        ledgerEnabled: Boolean(data?.ledgerEnabled),
        summary: {
          totalTransactions: Number(data?.summary?.totalTransactions ?? 0),
          totalCreditsGranted: Number(data?.summary?.totalCreditsGranted ?? 0),
          totalCreditsSpent: Number(data?.summary?.totalCreditsSpent ?? 0),
          totalPurchases: Number(data?.summary?.totalPurchases ?? 0),
        },
        transactions: Array.isArray(data?.transactions) ? data.transactions : [],
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load transaction audit."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const filteredTransactions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return audit.transactions.filter((tx) => {
      const matchesSearch =
        query.length === 0 ||
        tx.user_name.toLowerCase().includes(query) ||
        tx.user_email.toLowerCase().includes(query) ||
        tx.document_title.toLowerCase().includes(query) ||
        (tx.description ?? "").toLowerCase().includes(query);

      const matchesType =
        typeFilter === "all" ? true : tx.transaction_type === typeFilter;
      const matchesRole = roleFilter === "all" ? true : tx.user_role === roleFilter;

      return matchesSearch && matchesType && matchesRole;
    });
  }, [audit.transactions, roleFilter, searchTerm, typeFilter]);

  const transactionTypes = useMemo(() => {
    return Array.from(new Set(audit.transactions.map((tx) => tx.transaction_type))).sort();
  }, [audit.transactions]);

  const roleOptions = useMemo(() => {
    return Array.from(new Set(audit.transactions.map((tx) => tx.user_role))).sort();
  }, [audit.transactions]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      "transaction_id",
      "created_at",
      "transaction_type",
      "amount",
      "user_name",
      "user_email",
      "user_role",
      "user_team",
      "document_title",
      "document_type",
      "document_id",
      "description",
    ];

    const rows = filteredTransactions.map((tx) =>
      [
        tx.id,
        tx.created_at,
        tx.transaction_type,
        tx.amount,
        tx.user_name,
        tx.user_email,
        tx.user_role,
        tx.user_team,
        tx.document_title,
        tx.document_type ?? "",
        tx.document_id ?? "",
        tx.description ?? "",
      ]
        .map((value) => escapeCsv(value))
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `credit-transaction-audit-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [filteredTransactions]);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Credit Audit"
        title="Transaction Audit"
        description="Inspect marketplace purchases, credit grants, and user-by-user ledger activity from one admin view."
        actions={
          <>
            <Link
              href="/admin/marketplace"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Marketplace
            </Link>
            <Link
              href="/admin/users"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Open Users
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Transactions"
          value={String(audit.summary.totalTransactions)}
          note="Recent ledger rows in this view"
        />
        <StatCard
          title="Credits Granted"
          value={String(audit.summary.totalCreditsGranted)}
          note="Credits added to user accounts"
        />
        <StatCard
          title="Credits Spent"
          value={String(audit.summary.totalCreditsSpent)}
          note="Credits consumed by purchases"
        />
        <StatCard
          title="Purchases"
          value={String(audit.summary.totalPurchases)}
          note={audit.ledgerEnabled ? "Ledger-backed purchases" : "Ledger not active yet"}
        />
      </section>

      <SectionCard title="Audit Filters" description="Filter transactions by type, role, or search term.">
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
                placeholder="Search user, email, document..."
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Transaction Type
              </label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="all">All Types</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {transactionLabel(type)}
                  </option>
                ))}
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

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setTypeFilter("all");
              setRoleFilter("all");
            }}
            className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
          >
            Clear Filters
          </button>
        </div>

        {message ? <div className="mt-4"><InlineMessage>{message}</InlineMessage></div> : null}
      </SectionCard>

      <SectionCard
        title="Ledger Activity"
        description={`${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? "" : "s"} match the current filters.`}
        aside={
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export CSV
          </button>
        }
      >
        {loading ? (
          <InlineMessage>Loading transaction audit...</InlineMessage>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="No credit transactions match the current filters"
            description="Try clearing filters or searching a different user or document."
          />
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-slate-700/80 p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {tx.document_title}
                      </h3>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          transactionTone(tx.amount),
                        ].join(" ")}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} credits
                      </span>
                      <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
                        {transactionLabel(tx.transaction_type)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      {tx.description || "Ledger transaction"}
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MiniInfo
                        label="User"
                        value={tx.user_name}
                        subvalue={tx.user_email}
                      />
                      <MiniInfo
                        label="Role"
                        value={tx.user_role}
                        subvalue={tx.user_team}
                      />
                      <MiniInfo
                        label="Document Type"
                        value={tx.document_type || "Completed document"}
                        subvalue={tx.document_id || "No document link"}
                      />
                      <MiniInfo
                        label="When"
                        value={new Date(tx.created_at).toLocaleString()}
                        subvalue={formatRelative(tx.created_at)}
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
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 break-all text-xs text-slate-500">{subvalue}</p>
    </div>
  );
}
