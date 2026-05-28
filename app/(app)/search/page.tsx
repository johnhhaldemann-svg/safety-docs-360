"use client";
import { deferEffect } from "@/lib/deferredEffect";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type {
  WorkspaceSearchFacets,
  WorkspaceSearchResult,
  WorkspaceSearchResultType,
} from "@/types/product-depth";

const supabase = getSupabaseBrowserClient();

const TYPE_LABELS: Record<WorkspaceSearchResultType, string> = {
  document: "Documents",
  marketplace_template: "Marketplace",
  generated_document: "Generated Docs",
  jobsite: "Jobsites",
  field_issue: "Field Issues",
  corrective_action: "Corrective Actions",
  incident: "Incidents",
  permit: "Permits",
  jsa: "JSAs",
  training: "Training",
  contractor: "Contractors",
  company_memory: "Company Memory",
  risk_recommendation: "Risk Recommendations",
};

function typeTone(type: WorkspaceSearchResultType) {
  if (type === "field_issue" || type === "corrective_action" || type === "incident" || type === "risk_recommendation") {
    return "bg-amber-500/15 text-amber-100";
  }
  if (type === "permit" || type === "jsa" || type === "training") {
    return "bg-emerald-500/15 text-emerald-100";
  }
  if (type === "marketplace_template" || type === "document" || type === "generated_document") {
    return "bg-sky-500/15 text-sky-100";
  }
  return "bg-slate-700 text-slate-200";
}

function formatUpdated(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function emptyFacets(query: string): WorkspaceSearchFacets {
  return {
    typeCounts: {} as WorkspaceSearchFacets["typeCounts"],
    jobsiteCounts: {},
    total: 0,
    query,
  };
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState("all");
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [facets, setFacets] = useState<WorkspaceSearchFacets>(() => emptyFacets(initialQuery));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadResults = useCallback(async (nextQuery: string, nextType: string) => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("You must be signed in to search the workspace.");
        setResults([]);
        setFacets(emptyFacets(nextQuery));
        return;
      }

      const params = new URLSearchParams();
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (nextType !== "all") params.set("types", nextType);
      params.set("limit", "75");

      const response = await fetch(`/api/company/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            results?: WorkspaceSearchResult[];
            facets?: WorkspaceSearchFacets;
            warnings?: string[];
            warning?: string;
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Workspace search failed.");
      }

      setResults(data?.results ?? []);
      setFacets(data?.facets ?? emptyFacets(nextQuery));
      setWarnings([...(data?.warnings ?? []), ...(data?.warning ? [data.warning] : [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace search failed.");
      setResults([]);
      setFacets(emptyFacets(nextQuery));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => {
    setQuery(initialQuery);
    setSubmittedQuery(initialQuery);
  }), [initialQuery]);

  useEffect(() => deferEffect(() => {
    void loadResults(submittedQuery, typeFilter);
  }), [loadResults, submittedQuery, typeFilter]);

  const typeOptions = useMemo(() => {
    const present = Object.keys(facets.typeCounts) as WorkspaceSearchResultType[];
    const source = present.length > 0 ? present : (Object.keys(TYPE_LABELS) as WorkspaceSearchResultType[]);
    return source.map((type) => ({
      type,
      label: TYPE_LABELS[type],
      count: facets.typeCounts[type] ?? 0,
    }));
  }, [facets.typeCounts]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Global Workspace Search
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100">
              Search everything you can access
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Search documents, jobsites, field issues, corrective actions, incidents, permits, JSAs, training,
              contractors, generated docs, marketplace purchases, company memory, and risk recommendations.
            </p>
          </div>
          <Link
            href="/command-center"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/50"
          >
            Open Command Center
          </Link>
        </div>
      </section>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {warnings.length > 0 && !error ? (
        <InlineMessage tone="warning">
          Some sources could not be searched: {warnings.slice(0, 3).join("; ")}
        </InlineMessage>
      ) : null}

      <section className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm">
        <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/40 px-3">
            <Search aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Search workspace</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search records, projects, permits, training, memory..."
              className="w-full border-0 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500"
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
            Sources
          </span>
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
              typeFilter === "all"
                ? "border-sky-400 bg-sky-500/20 text-sky-100"
                : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800"
            }`}
          >
            All {facets.total}
          </button>
          {typeOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => setTypeFilter(option.type)}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
                typeFilter === option.type
                  ? "border-sky-400 bg-sky-500/20 text-sky-100"
                  : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {option.label} {option.count}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Results</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? "Searching..." : `${results.length} matching item${results.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg border border-slate-700 bg-slate-800/50" />
            ))
          ) : results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-300">No matching workspace records</p>
              <p className="mt-2 text-sm text-slate-500">Try a broader phrase or switch back to all sources.</p>
            </div>
          ) : (
            results.map((result) => (
              <Link
                key={`${result.sourceTable}-${result.id}`}
                href={result.href}
                className="rounded-lg border border-slate-700 bg-slate-950/25 p-4 transition hover:border-sky-500/60 hover:bg-slate-950/45"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${typeTone(result.type)}`}>
                        {TYPE_LABELS[result.type]}
                      </span>
                      {result.status ? (
                        <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                          {result.status}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 truncate text-base font-bold text-slate-100">{result.title}</h3>
                    {result.subtitle ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{result.subtitle}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {result.jobsiteName ? <span>{result.jobsiteName}</span> : null}
                      <span>Updated {formatUpdated(result.updatedAt)}</span>
                      {result.matchedFields.length > 0 ? (
                        <span>Matched {result.matchedFields.slice(0, 3).join(", ")}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-sky-300">Open</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
