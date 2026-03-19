"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { DownloadConfirmModal } from "@/components/DownloadConfirmModal";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
} from "@/components/WorkspacePrimitives";

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
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [agreedToUploadTerms, setAgreedToUploadTerms] = useState(false);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  async function loadDocuments() {
    setLoadingDocs(true);
    setMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading documents: ${error.message}`);
      setMessageTone("error");
      setLoadingDocs(false);
      return;
    }

    setDocuments(data ?? []);
    setLoadingDocs(false);
  }

  useEffect(() => {
    async function loadInitialDocuments() {
      await loadDocuments();
    }

    void loadInitialDocuments();
  }, []);

  async function handleUpload() {
    setMessage("");
    setMessageTone("neutral");

    if (!selectedFile) {
      setMessage("Please choose a file first.");
      setMessageTone("warning");
      return;
    }

    if (!documentTitle.trim()) {
      setMessage("Please enter a document title.");
      setMessageTone("warning");
      return;
    }

    if (!agreedToUploadTerms) {
      setMessage(
        "You must agree to the Terms of Service, Liability Waiver, and Licensing Agreement before uploading a document."
      );
      setMessageTone("warning");
      return;
    }

    setUploading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setMessage(`User error: ${userError.message}`);
      setMessageTone("error");
      setUploading(false);
      return;
    }

    if (!user) {
      setMessage("You must be logged in to upload files.");
      setMessageTone("error");
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
      setMessageTone("error");
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
      setMessageTone("error");
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
    setMessageTone("success");
    setUploading(false);

    await loadDocuments();
  }

async function handleOpenFile(path?: string | null) {
  setDownloadPath(path ?? null);
}

async function confirmOpenFile() {
  if (!downloadPath) {
    setMessage("Open file failed: missing file path.");
    setMessageTone("error");
    return;
  }

  setDownloadLoading(true);

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(downloadPath, 60);

  if (error) {
    setMessage(`Open file failed: ${error.message}`);
    setMessageTone("error");
    setDownloadLoading(false);
    return;
  }

  if (!data?.signedUrl) {
    setMessage("Open file failed: no signed URL returned.");
    setMessageTone("error");
    setDownloadLoading(false);
    return;
  }

  window.open(data.signedUrl, "_blank");
  setDownloadPath(null);
  setDownloadLoading(false);
}

  const uploadCounts = useMemo(() => {
    return {
      total: documents.length,
      templates: documents.filter((d) => d.document_type === "Template").length,
      forms: documents.filter((d) => d.document_type === "Form").length,
      reports: documents.filter((d) => d.document_type === "Report").length,
    };
  }, [documents]);

  const checklistItems = [
    { label: "Add a project name or leave it general", done: projectName.trim().length > 0 || !selectedFile },
    { label: "Enter a document title", done: documentTitle.trim().length > 0 },
    { label: "Choose a file to upload", done: Boolean(selectedFile) },
    { label: "Accept terms and upload", done: agreedToUploadTerms },
  ];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Document Intake"
        title="Upload Center"
        description="Upload files into storage, capture the right metadata, and keep new records moving cleanly into the rest of the platform."
        actions={
          <>
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
          </>
        }
      />

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
        <SectionCard
          title="New Upload"
          description="Upload a real file, set its metadata, and save it into the workspace."
          className="h-full"
        >
          <div className="grid gap-5 md:grid-cols-2">
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

            <div className="md:col-span-2">
              <LegalAcceptanceBlock
                checked={agreedToUploadTerms}
                onChange={setAgreedToUploadTerms}
              />
            </div>
          </div>

          <div className="sticky bottom-3 mt-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <button
              onClick={handleUpload}
              disabled={uploading || !agreedToUploadTerms}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Start Upload"}
            </button>
          </div>

          {message ? <div className="mt-4"><InlineMessage tone={messageTone}>{message}</InlineMessage></div> : null}
        </SectionCard>

        <div className="space-y-6">
          <StartChecklist title="Upload Checklist" items={checklistItems} />

          <SectionCard
            title="What Happens Next"
            description="Standard flow after a document is uploaded."
          >
            <div className="space-y-3 text-sm text-slate-600">
              <p>1. Upload the source file and save its details.</p>
              <p>2. Confirm it appears in the recent records list below.</p>
              <p>3. Open it to verify the file loads correctly.</p>
              <p>4. Submit it for review when it needs admin action.</p>
              <p>5. Open the final version from the library after approval.</p>
            </div>
          </SectionCard>
        </div>
      </section>

      <SectionCard
        title="Uploaded Documents"
        description="Recent records saved into the workspace."
      >
        {loadingDocs ? (
          <InlineMessage>Loading documents...</InlineMessage>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No uploaded documents yet"
            description="Upload your first file to start building out the workspace record history."
          />
        ) : (
          <>
            <div className="hidden mt-6 overflow-x-auto md:block">
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

            <div className="mt-6 grid gap-4 md:hidden">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-base font-semibold text-slate-900">{doc.document_title}</div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <InfoBox label="Type" value={doc.document_type || "Not set"} />
                    <InfoBox label="Category" value={doc.category || "Not set"} />
                    <InfoBox label="File" value={doc.file_name} />
                    <InfoBox label="Uploader" value={doc.uploaded_by || "Unknown"} />
                  </div>
                  <button
                    onClick={() => handleOpenFile(doc.file_path)}
                    className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Open File
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <DownloadConfirmModal
        open={Boolean(downloadPath)}
        loading={downloadLoading}
        onCancel={() => {
          setDownloadPath(null);
          setDownloadLoading(false);
        }}
        onConfirm={() => {
          void confirmOpenFile();
        }}
      />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-700">{value}</div>
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
