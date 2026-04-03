"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { getDocumentStatusLabel } from "@/lib/documentStatus";
import type { PermissionMap } from "@/lib/rbac";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentRow = {
  id: string;
  created_at: string;
  document_title: string | null;
  project_name: string | null;
  file_name: string | null;
  document_type: string | null;
  category: string | null;
  status?: string | null;
  final_file_path?: string | null;
};

function getDocumentTitle(doc: DocumentRow) {
  return doc.document_title ?? doc.project_name ?? doc.file_name ?? "Untitled document";
}

function statusToneClasses(statusLabel: string) {
  const s = statusLabel.toLowerCase();
  if (s.includes("approved")) {
    return "bg-emerald-500/15 text-emerald-200";
  }
  if (s.includes("review") || s.includes("submitted")) {
    return "bg-amber-500/15 text-amber-200";
  }
  if (s.includes("archived")) {
    return "bg-slate-600/40 text-slate-400";
  }
  return "bg-sky-500/15 text-sky-200";
}

function formatUpdated(createdAt: string) {
  try {
    return new Date(createdAt).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [canUpload, setCanUpload] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("You must be signed in to search documents.");
        setDocuments([]);
        setLoading(false);
        return;
      }

      const [docRes, meRes] = await Promise.all([
        fetch("/api/workspace/documents", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const meJson = (await meRes.json().catch(() => null)) as
        | { user?: { permissionMap?: PermissionMap } }
        | null;
      if (meRes.ok) {
        const pm = meJson?.user?.permissionMap;
        setCanAccessAdmin(Boolean(pm?.can_access_internal_admin));
        setCanUpload(
          Boolean(pm?.can_create_documents && pm?.can_edit_documents)
        );
      }

      const data = (await docRes.json().catch(() => null)) as
        | { error?: string; documents?: DocumentRow[] }
        | null;

      if (!docRes.ok) {
        setError(data?.error || "Unable to load documents for search.");
        setDocuments([]);
        setLoading(false);
        return;
      }

      const rows = (data?.documents ?? []) as DocumentRow[];
      setDocuments(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed to load.");
      setDocuments([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const doc of documents) {
      const t = doc.document_type?.trim();
      if (t) {
        types.add(t);
      }
    }
    return ["All Types", ...Array.from(types).sort((a, b) => a.localeCompare(b))];
  }, [documents]);

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const title = getDocumentTitle(doc).toLowerCase();
      const category = (doc.category ?? "").toLowerCase();
      const dtype = (doc.document_type ?? "").toLowerCase();
      const project = (doc.project_name ?? "").toLowerCase();
      const fname = (doc.file_name ?? "").toLowerCase();

      const matchesQuery =
        !q ||
        title.includes(q) ||
        category.includes(q) ||
        dtype.includes(q) ||
        project.includes(q) ||
        fname.includes(q);

      const matchesType =
        typeFilter === "All Types" ? true : doc.document_type === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [documents, query, typeFilter]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Document Search
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-100">
              Search
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Search documents you can access in this workspace (same visibility as the
              library). Open a result to jump to it in the library.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/library"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Library
            </Link>
            {canUpload ? (
              <Link
                href="/upload"
                className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
              >
                Upload File
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <InlineMessage tone="error">{error}</InlineMessage>
      ) : null}

      <section className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="search-portal-query" className="mb-2 block text-sm font-semibold text-slate-300">
              Search
            </label>
            <input
              id="search-portal-query"
              type="search"
              placeholder="Title, project, category, file name, or type…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-sky-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="search-portal-type" className="mb-2 block text-sm font-semibold text-slate-300">
              Document type
            </label>
            <select
              id="search-portal-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500 disabled:opacity-60"
            >
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTypeFilter("All Types");
            }}
            disabled={loading}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear Filters
          </button>

          <span className="rounded-xl bg-slate-800/70 px-4 py-2 text-sm text-slate-400">
            {loading ? "Loading…" : `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Results</h2>
              <p className="mt-1 text-sm text-slate-500">
                Documents from your workspace library scope.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-2xl border border-slate-700/80 bg-slate-800/50"
                  />
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-600 p-8 text-center">
                <p className="text-sm font-semibold text-slate-300">
                  No matching documents
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Try different keywords or open the library to browse everything.
                </p>
              </div>
            ) : (
              filteredResults.map((doc) => {
                const statusLabel = getDocumentStatusLabel(
                  doc.status,
                  Boolean(doc.final_file_path)
                );
                const typeLabel = doc.document_type?.trim() || "Type not set";
                const categoryLabel = doc.category?.trim() || "Unassigned";

                return (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-slate-700/80 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-100">
                          {getDocumentTitle(doc)}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200">
                            {typeLabel}
                          </span>
                          <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
                            {categoryLabel}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusToneClasses(
                              statusLabel
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-500">
                          Updated {formatUpdated(doc.created_at)}
                        </p>
                      </div>

                      <Link
                        href={`/library?doc=${encodeURIComponent(doc.id)}`}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/50"
                      >
                        Open in library
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-100">Tips</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search runs on documents already visible to your role in the library.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-100">Quick links</h2>
            <p className="mt-1 text-sm text-slate-500">Jump to common destinations.</p>

            <div className="mt-6 space-y-3">
              <Link
                href="/library"
                className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
              >
                <span>Browse full library</span>
                <span aria-hidden="true">→</span>
              </Link>

              {canUpload ? (
                <Link
                  href="/upload"
                  className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
                >
                  <span>Upload a document</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}

              {canAccessAdmin ? (
                <Link
                  href="/admin"
                  className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
                >
                  <span>Admin panel</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}

              <Link
                href="/dashboard"
                className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
              >
                <span>Dashboard</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
