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
  user_id: string | null;
  project_name: string | null;
  document_title: string;
  document_type: string | null;
  category: string | null;
  notes: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_by: string | null;
};

export default function LibraryPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [typeFilter, setTypeFilter] = useState("All Types");

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading documents: ${error.message}`);
      setLoading(false);
      return;
    }

    setDocuments(data ?? []);
    setLoading(false);
  }

  async function handleOpenFile(path: string) {
    setMessage("");

    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60);

    if (error) {
      setMessage(`Open file failed: ${error.message}`);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(documents.map((doc) => doc.category).filter(Boolean))
    ) as string[];

    return ["All Categories", ...values.sort()];
  }, [documents]);

  const types = useMemo(() => {
    const values = Array.from(
      new Set(documents.map((doc) => doc.document_type).filter(Boolean))
    ) as string[];

    return ["All Types", ...values.sort()];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.document_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.project_name ?? "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (doc.file_name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.category ?? "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "All Categories"
          ? true
          : doc.category === categoryFilter;

      const matchesType =
        typeFilter === "All Types" ? true : doc.document_type === typeFilter;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [documents, searchTerm, categoryFilter, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: documents.length,
      templates: documents.filter((d) => d.document_type === "Template").length,
      forms: documents.filter((d) => d.document_type === "Form").length,
      reports: documents.filter((d) => d.document_type === "Report").length,
    };
  }, [documents]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Document Center
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Library
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Browse and open all uploaded documents from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Upload Document
            </Link>
            <Link
              href="/search"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Search Records
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={String(stats.total)}
          note="All uploaded records"
        />
        <StatCard
          title="Templates"
          value={String(stats.templates)}
          note="Template documents"
        />
        <StatCard
          title="Forms"
          value={String(stats.forms)}
          note="Form documents"
        />
        <StatCard
          title="Reports"
          value={String(stats.reports)}
          note="Report documents"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Search Library
              </label>
              <input
                type="text"
                placeholder="Search title, project, file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Document Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                {types.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setSearchTerm("");
              setCategoryFilter("All Categories");
              setTypeFilter("All Types");
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredDocuments.length} document
              {filteredDocuments.length === 1 ? "" : "s"} found
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading library...</p>
        ) : filteredDocuments.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No documents found
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Try adjusting your filters or upload a new file.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Title
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Project
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Category
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    File
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Open
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {doc.document_title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Uploaded by {doc.uploaded_by ?? "Unknown"}
                        </p>
                      </div>
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {doc.project_name || "General"}
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {doc.document_type || "-"}
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {doc.category || "-"}
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      {doc.file_name}
                    </td>

                    <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-4 py-4 text-right">
                      <button
                        onClick={() => handleOpenFile(doc.file_path)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}