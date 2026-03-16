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

export default function UploadPage() {
  const [projectName, setProjectName] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("Template");
  const [category, setCategory] = useState("PESHEP");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoadingDocs(true);
    setMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading documents: ${error.message}`);
      setLoadingDocs(false);
      return;
    }

    setDocuments(data ?? []);
    setLoadingDocs(false);
  }

  async function handleUpload() {
    setMessage("");

    if (!selectedFile) {
      setMessage("Please choose a file first.");
      return;
    }

    if (!documentTitle.trim()) {
      setMessage("Please enter a document title.");
      return;
    }

    setUploading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setMessage(`User error: ${userError.message}`);
      setUploading(false);
      return;
    }

    if (!user) {
      setMessage("You must be logged in to upload files.");
      setUploading(false);
      return;
    }

    const safeFileName = `${Date.now()}-${selectedFile.name}`;
    const folderName = projectName.trim() ? projectName.trim() : "general";
    const filePath = `${folderName}/${safeFileName}`;

    const { data: uploadData, error: storageError } = await supabase.storage
      .from("documents")
      .upload(filePath, selectedFile, { upsert: false });

    if (storageError) {
      setMessage(`Storage upload failed: ${storageError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      user_id: user.id,
      project_name: projectName || null,
      document_title: documentTitle,
      document_type: documentType,
      category,
      notes: notes || null,
      file_name: selectedFile.name,
      file_path: uploadData?.path ?? filePath,
      file_size: selectedFile.size,
      uploaded_by: user.email ?? null,
    });

    if (insertError) {
      setMessage(`Database save failed: ${insertError.message}`);
      setUploading(false);
      return;
    }

    setProjectName("");
    setDocumentTitle("");
    setDocumentType("Template");
    setCategory("PESHEP");
    setNotes("");
    setSelectedFile(null);
    setMessage("File uploaded successfully.");
    setUploading(false);

    await loadDocuments();
  }

async function handleOpenFile(path?: string | null) {
  if (!path) {
    setMessage("Open file failed: missing file path.");
    return;
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60);

  if (error) {
    setMessage(`Open file failed: ${error.message}`);
    return;
  }

  if (!data?.signedUrl) {
    setMessage("Open file failed: no signed URL returned.");
    return;
  }

  window.open(data.signedUrl, "_blank");
}

  const uploadCounts = useMemo(() => {
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
              Document Intake
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Upload Center
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Upload files into Supabase Storage and save document records.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/library"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Open Library
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
          title="Total Files"
          value={String(uploadCounts.total)}
          note="Saved in database"
        />
        <StatCard
          title="Templates"
          value={String(uploadCounts.templates)}
          note="Template records"
        />
        <StatCard
          title="Forms"
          value={String(uploadCounts.forms)}
          note="Form records"
        />
        <StatCard
          title="Reports"
          value={String(uploadCounts.reports)}
          note="Report records"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">New Upload</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a real file and save its details.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Document Title
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter document title"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Document Type
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                <option>Template</option>
                <option>Form</option>
                <option>Report</option>
                <option>Checklist</option>
                <option>Reference</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              >
                <option>PESHEP</option>
                <option>Inspections</option>
                <option>Reports</option>
                <option>Permits</option>
                <option>Admin</option>
                <option>Reference</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Select File
              </label>
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-slate-600">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Start Upload"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">What to test</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>1. Choose a file.</p>
            <p>2. Enter a document title.</p>
            <p>3. Click Start Upload.</p>
            <p>4. Confirm it appears in the table below.</p>
            <p>5. Click Open and verify it opens in a new tab.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Uploaded Documents</h2>

        {loadingDocs ? (
          <p className="mt-4 text-sm text-slate-500">Loading documents...</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Title
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
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900">
                      {doc.document_title}
                    </td>
                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {doc.document_type}
                    </td>
                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {doc.category}
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