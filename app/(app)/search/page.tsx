"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const allResults = [
  {
    title: "Lilly North Expansion PESHEP Template",
    type: "Template",
    category: "PESHEP",
    updated: "2 days ago",
    status: "Current",
  },
  {
    title: "Excavation Daily Inspection Form",
    type: "Form",
    category: "Inspections",
    updated: "Yesterday",
    status: "Current",
  },
  {
    title: "Weekly Safety Report - Area B",
    type: "Report",
    category: "Reports",
    updated: "Today",
    status: "Review",
  },
  {
    title: "Confined Space Entry Checklist",
    type: "Checklist",
    category: "Field Safety",
    updated: "3 days ago",
    status: "Archived",
  },
  {
    title: "Administrative Approval Matrix",
    type: "Reference",
    category: "Admin",
    updated: "5 days ago",
    status: "Current",
  },
  {
    title: "Hot Work Permit Pack",
    type: "Form",
    category: "Permits",
    updated: "1 week ago",
    status: "Current",
  },
  {
    title: "Project Startup Checklist",
    type: "Checklist",
    category: "Startup",
    updated: "4 days ago",
    status: "Current",
  },
  {
    title: "Fall Protection Observation Report",
    type: "Report",
    category: "Reports",
    updated: "Today",
    status: "Review",
  },
];

function statusClasses(status: string) {
  if (status === "Review") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Archived") {
    return "bg-slate-200 text-slate-300";
  }

  return "bg-emerald-100 text-emerald-700";
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");

  const filteredResults = useMemo(() => {
    return allResults.filter((item) => {
      const matchesQuery =
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase());

      const matchesType =
        typeFilter === "All Types" ? true : item.type === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [query, typeFilter]);

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
              Search across templates, forms, reports, permits, and reference
              documents in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/library"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Open Library
            </Link>
            <Link
              href="/upload"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Upload File
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Search portal
            </label>
            <input
              type="text"
              placeholder="Search by document title, category, or type..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Filter by type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 outline-none focus:border-sky-500"
            >
              <option>All Types</option>
              <option>Template</option>
              <option>Form</option>
              <option>Report</option>
              <option>Checklist</option>
              <option>Reference</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setQuery("");
              setTypeFilter("All Types");
            }}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
          >
            Clear Filters
          </button>

          <span className="rounded-xl bg-slate-800/70 px-4 py-2 text-sm text-slate-400">
            {filteredResults.length} result
            {filteredResults.length === 1 ? "" : "s"} found
          </span>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Results</h2>
              <p className="mt-1 text-sm text-slate-500">
                Matching records across the portal.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-600 p-8 text-center">
                <p className="text-sm font-semibold text-slate-300">
                  No matching records found
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Try a different keyword or change the document type filter.
                </p>
              </div>
            ) : (
              filteredResults.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-700/80 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-300">
                          {item.type}
                        </span>
                        <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
                          {item.category}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        Last updated {item.updated}
                      </p>
                    </div>

                    <button className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50">
                      Open
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-100">Popular Searches</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quick terms commonly used in the portal.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {[
                "PESHEP",
                "Excavation",
                "Weekly Report",
                "Permit",
                "Checklist",
                "Admin",
              ].map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-100">Search Actions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quick navigation from search.
            </p>

            <div className="mt-6 space-y-3">
              <Link
                href="/library"
                className="flex items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-4 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
              >
                <span>Browse full library</span>
                <span>→</span>
              </Link>

              <Link
                href="/upload"
                className="flex items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-4 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
              >
                <span>Upload a document</span>
                <span>→</span>
              </Link>

              <Link
                href="/admin"
                className="flex items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-4 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
              >
                <span>Open admin panel</span>
                <span>→</span>
              </Link>

              <Link
                href="/dashboard"
                className="flex items-center justify-between rounded-2xl border border-slate-700/80 px-4 py-4 text-sm font-medium text-slate-300 transition hover:bg-slate-950/50"
              >
                <span>Return to dashboard</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
