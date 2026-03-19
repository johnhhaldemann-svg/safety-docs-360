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

type MarketplaceDocument = {
  id: string;
  created_at: string;
  project_name: string | null;
  document_type: string | null;
  status?: string | null;
  marketplaceEnabled: boolean;
  creditCost: number;
  purchaseCount: number;
  creditsEarned: number;
};

function formatDocumentTitle(doc: MarketplaceDocument) {
  return doc.project_name ?? doc.document_type ?? "Untitled Document";
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

export default function AdminMarketplacePage() {
  const [documents, setDocuments] = useState<MarketplaceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [ledgerEnabled, setLedgerEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [savingId, setSavingId] = useState("");

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

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/marketplace", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            documents?: MarketplaceDocument[];
            ledgerEnabled?: boolean;
          }
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load marketplace documents.");
      }

      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
      setLedgerEnabled(Boolean(data?.ledgerEnabled));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load marketplace documents."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return documents.filter((doc) => {
      const title = formatDocumentTitle(doc).toLowerCase();
      const type = (doc.document_type ?? "").toLowerCase();
      const status = (doc.status ?? "").toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        title.includes(query) ||
        type.includes(query) ||
        status.includes(query);

      const matchesVisibility =
        visibilityFilter === "all"
          ? true
          : visibilityFilter === "listed"
            ? doc.marketplaceEnabled
            : !doc.marketplaceEnabled;

      return matchesSearch && matchesVisibility;
    });
  }, [documents, searchTerm, visibilityFilter]);

  const stats = useMemo(() => {
    const listed = documents.filter((doc) => doc.marketplaceEnabled);
    const hidden = documents.filter((doc) => !doc.marketplaceEnabled);
    const purchases = documents.reduce((sum, doc) => sum + doc.purchaseCount, 0);
    const creditsEarned = documents.reduce((sum, doc) => sum + doc.creditsEarned, 0);

    return {
      listed: listed.length,
      hidden: hidden.length,
      purchases,
      creditsEarned,
    };
  }, [documents]);

  const handleSave = useCallback(
    async (documentId: string, enabled: boolean, creditCost: number) => {
      setSavingId(documentId);
      setMessage("");

      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/admin/documents/${documentId}/marketplace`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            enabled,
            creditCost,
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;

        if (!res.ok) {
          throw new Error(data?.error || "Failed to save marketplace settings.");
        }

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  marketplaceEnabled: enabled,
                  creditCost,
                }
              : doc
          )
        );
        setMessage("Marketplace settings updated.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to save marketplace settings."
        );
      } finally {
        setSavingId("");
      }
    },
    [getAccessToken]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Marketplace Control"
        title="Admin Marketplace"
        description="Manage which approved completed documents are listed, how much they cost, and how often they are being unlocked."
        actions={
          <>
            <Link
              href="/admin/review-documents"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Open Review Queue
            </Link>
            <Link
              href="/library"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View User Library
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Listed Documents"
          value={String(stats.listed)}
          note="Visible in the credit marketplace"
        />
        <StatCard
          title="Hidden Documents"
          value={String(stats.hidden)}
          note="Approved but not currently for sale"
        />
        <StatCard
          title="Marketplace Purchases"
          value={String(stats.purchases)}
          note={ledgerEnabled ? "Tracked from the credit ledger" : "Ledger data not available yet"}
        />
        <StatCard
          title="Credits Earned"
          value={String(stats.creditsEarned)}
          note="Total credits collected from purchases"
        />
      </section>

      <SectionCard title="Marketplace Filters" description="Search and filter the list of completed documents.">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-[1.5fr_0.7fr]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Search Marketplace Documents
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search project name or type..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Visibility
              </label>
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                <option value="all">All Completed Docs</option>
                <option value="listed">Listed Only</option>
                <option value="hidden">Hidden Only</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setVisibilityFilter("all");
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>

        {message ? <div className="mt-4"><InlineMessage>{message}</InlineMessage></div> : null}
      </SectionCard>

      <SectionCard
        title="Marketplace Listings"
        description={`${filteredDocuments.length} completed document${filteredDocuments.length === 1 ? "" : "s"} in this view.`}
      >
        {loading ? (
          <InlineMessage>Loading marketplace documents...</InlineMessage>
        ) : filteredDocuments.length === 0 ? (
          <EmptyState
            title="No completed documents match the current filters"
            description="Try a broader search or switch between listed and hidden documents."
          />
        ) : (
          <div className="space-y-4">
            {filteredDocuments.map((doc) => (
              <MarketplaceCard
                key={`${doc.id}-${doc.marketplaceEnabled}-${doc.creditCost}`}
                document={doc}
                saving={savingId === doc.id}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function MarketplaceCard({
  document,
  saving,
  onSave,
}: {
  document: MarketplaceDocument;
  saving: boolean;
  onSave: (documentId: string, enabled: boolean, creditCost: number) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(document.marketplaceEnabled);
  const [creditCost, setCreditCost] = useState(String(document.creditCost));
  const documentMeta = [document.document_type ?? "Completed document", document.status]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {formatDocumentTitle(document)}
            </h3>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                document.marketplaceEnabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              {document.marketplaceEnabled ? "Listed" : "Hidden"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{documentMeta}</p>
          <p className="mt-1 text-xs text-slate-500">
            Approved {formatRelative(document.created_at)}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Price" value={`${document.creditCost} credits`} />
            <MiniStat label="Purchases" value={String(document.purchaseCount)} />
            <MiniStat label="Credits Earned" value={String(document.creditsEarned)} />
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:w-[320px]">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">Marketplace Listing</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5"
            />
          </label>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Credit Cost
            </label>
            <input
              type="number"
              min={1}
              value={creditCost}
              onChange={(event) => setCreditCost(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() =>
                void onSave(document.id, enabled, Math.max(1, Number(creditCost) || 1))
              }
              disabled={saving}
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold !text-sky-900 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <Link
              href={`/admin/review-documents/${document.id}`}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Open Review
            </Link>
          </div>
        </div>
      </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
