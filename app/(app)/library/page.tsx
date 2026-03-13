import Link from "next/link";

const libraryStats = [
  {
    title: "Total Documents",
    value: "146",
    note: "12 added this month",
  },
  {
    title: "Templates",
    value: "38",
    note: "Core reusable files",
  },
  {
    title: "Project Records",
    value: "82",
    note: "Saved by active jobs",
  },
  {
    title: "Standards",
    value: "26",
    note: "Reference material",
  },
];

const categories = [
  {
    title: "PESHEP Templates",
    count: "14 Files",
    description: "Project safety and health execution plan templates and examples.",
  },
  {
    title: "Forms & Checklists",
    count: "29 Files",
    description: "Inspection forms, field checklists, and daily safety tools.",
  },
  {
    title: "Reports",
    count: "18 Files",
    description: "Incident reports, weekly summaries, and safety reporting documents.",
  },
  {
    title: "Reference Standards",
    count: "26 Files",
    description: "Policies, standards, guidance docs, and admin references.",
  },
];

const recentDocs = [
  {
    name: "Lilly North Expansion PESHEP Template",
    type: "Template",
    updated: "Updated 2 days ago",
    status: "Current",
  },
  {
    name: "Excavation Daily Inspection Form",
    type: "Form",
    updated: "Updated yesterday",
    status: "Current",
  },
  {
    name: "Weekly Safety Report - Area B",
    type: "Report",
    updated: "Updated today",
    status: "Review",
  },
  {
    name: "Administrative Approval Matrix",
    type: "Reference",
    updated: "Updated 5 days ago",
    status: "Current",
  },
  {
    name: "Confined Space Entry Checklist",
    type: "Checklist",
    updated: "Updated 3 days ago",
    status: "Archived",
  },
];

const pinnedDocs = [
  "Master PESHEP Template",
  "Daily Inspection Form Pack",
  "Weekly Report Starter",
  "Project Startup Checklist",
];

function statusClasses(status: string) {
  if (status === "Review") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Archived") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

export default function LibraryPage() {
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
              Browse templates, forms, reports, and reference documents from one
              organized workspace.
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
              Search Library
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {libraryStats.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Categories</h2>
          <p className="mt-1 text-sm text-slate-500">
            Main groups of content available in the library.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {categories.map((category) => (
              <div
                key={category.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">
                    {category.title}
                  </h3>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {category.count}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {category.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Pinned Documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Frequently used items for quick access.
          </p>

          <div className="mt-6 space-y-4">
            {pinnedDocs.map((doc, index) => (
              <div
                key={doc}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sm font-bold text-sky-700">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{doc}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Quick access item
                  </p>
                </div>
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Recent Documents
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Most recently updated documents in the library.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Search documents..."
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <select className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-500">
                <option>All Types</option>
                <option>Template</option>
                <option>Form</option>
                <option>Report</option>
                <option>Reference</option>
                <option>Checklist</option>
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Document
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Updated
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
                {recentDocs.map((doc) => (
                  <tr key={doc.name}>
                    <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {doc.name}
                      </p>
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {doc.type}
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      {doc.updated}
                    </td>

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                          doc.status
                        )}`}
                      >
                        {doc.status}
                      </span>
                    </td>

                    <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-4 py-4 text-right">
                      <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white">
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Library Actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quick links for document management.
          </p>

          <div className="mt-6 space-y-3">
            <Link
              href="/upload"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Upload a new file</span>
              <span>→</span>
            </Link>

            <Link
              href="/search"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Search document records</span>
              <span>→</span>
            </Link>

            <Link
              href="/admin"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Open admin controls</span>
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
      </section>
    </div>
  );
}