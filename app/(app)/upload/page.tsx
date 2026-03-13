"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UploadItem = {
  id: number;
  name: string;
  type: string;
  size: string;
  status: "Ready" | "Uploading" | "Needs Review";
};

export default function UploadPage() {
  const [projectName, setProjectName] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("Template");
  const [category, setCategory] = useState("PESHEP");
  const [notes, setNotes] = useState("");

  const [uploads] = useState<UploadItem[]>([
    {
      id: 1,
      name: "Lilly_Area_B_PESHEP_Template.pdf",
      type: "Template",
      size: "2.4 MB",
      status: "Ready",
    },
    {
      id: 2,
      name: "Excavation_Inspection_Form.docx",
      type: "Form",
      size: "1.1 MB",
      status: "Needs Review",
    },
    {
      id: 3,
      name: "Weekly_Safety_Report_Area_C.pdf",
      type: "Report",
      size: "3.0 MB",
      status: "Uploading",
    },
  ]);

  const uploadCounts = useMemo(() => {
    return {
      total: uploads.length,
      ready: uploads.filter((item) => item.status === "Ready").length,
      review: uploads.filter((item) => item.status === "Needs Review").length,
      uploading: uploads.filter((item) => item.status === "Uploading").length,
    };
  }, [uploads]);

  function statusClasses(status: UploadItem["status"]) {
    if (status === "Ready") {
      return "bg-emerald-100 text-emerald-700";
    }

    if (status === "Uploading") {
      return "bg-sky-100 text-sky-700";
    }

    return "bg-amber-100 text-amber-700";
  }

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
              Add project documents, templates, forms, and reports into the
              portal and organize them before publishing.
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
        <StatCard title="Pending Files" value={String(uploadCounts.total)} note="Currently in upload queue" />
        <StatCard title="Ready Files" value={String(uploadCounts.ready)} note="Prepared for publish" />
        <StatCard title="Needs Review" value={String(uploadCounts.review)} note="Check metadata or format" />
        <StatCard title="Uploading" value={String(uploadCounts.uploading)} note="Still processing" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">New Upload</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add document details before sending files to the portal.
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
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
                placeholder="Add notes for the document record..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Select Files
              </label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Drag and drop files here
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  or click to browse from your computer
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Choose Files
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">
              Start Upload
            </button>
            <button className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Save Draft
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Upload Tips</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use consistent naming and categories for cleaner records.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Include project name and document type in the filename.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Upload final approved files separately from draft working files.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Add notes when a file needs admin review or revision.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Move between key portal areas.
            </p>

            <div className="mt-6 space-y-3">
              <Link
                href="/library"
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>Browse library</span>
                <span>→</span>
              </Link>

              <Link
                href="/search"
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>Search files</span>
                <span>→</span>
              </Link>

              <Link
                href="/admin"
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>Open admin panel</span>
                <span>→</span>
              </Link>

              <Link
                href="/"
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>Return to dashboard</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Upload Queue</h2>
            <p className="mt-1 text-sm text-slate-500">
              Files currently staged or recently added.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  File
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Size
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {uploads.map((item) => (
                <tr key={item.id}>
                  <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {item.type}
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    {item.size}
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-4 py-4 text-right">
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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