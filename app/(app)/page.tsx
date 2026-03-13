import Link from "next/link";

const stats = [
  {
    title: "Active Projects",
    value: "12",
    note: "3 updated today",
  },
  {
    title: "Open Reports",
    value: "28",
    note: "5 need review",
  },
  {
    title: "Pending Uploads",
    value: "7",
    note: "2 overdue",
  },
  {
    title: "Library Docs",
    value: "146",
    note: "12 added this month",
  },
];

const quickActions = [
  {
    title: "Build PESHEP",
    description: "Start a new project safety and health execution plan.",
    href: "/peshep",
    button: "Open Builder",
  },
  {
    title: "Search Documents",
    description: "Find project files, forms, and saved safety records.",
    href: "/search",
    button: "Search Now",
  },
  {
    title: "Upload Files",
    description: "Add reports, forms, plans, and supporting documents.",
    href: "/upload",
    button: "Upload Files",
  },
  {
    title: "Open Library",
    description: "Browse templates, standards, and saved project content.",
    href: "/library",
    button: "View Library",
  },
];

const recentActivity = [
  "PESHEP draft created for Lilly Expansion Area B",
  "Excavation inspection form uploaded",
  "Weekly safety report exported to PDF",
  "New document template added to library",
  "Admin settings updated for user permissions",
];

const priorities = [
  "Review open reports needing approval",
  "Finish outstanding project uploads",
  "Update active PESHEP packages",
  "Verify library templates are current",
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Project Workspace
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Manage projects, open safety tools, track documents, and keep your
              portal organized from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Upload Files
            </Link>
            <Link
              href="/search"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Search Portal
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Open the most-used tools in your workspace.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => (
              <div
                key={action.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {action.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {action.description}
                </p>
                <Link
                  href={action.href}
                  className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {action.button}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Priority Items</h2>
          <p className="mt-1 text-sm text-slate-500">
            Focus items for today’s workflow.
          </p>

          <div className="mt-6 space-y-4">
            {priorities.map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                  {index + 1}
                </div>
                <p className="pt-1 text-sm font-medium text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest activity across your document portal.
          </p>

          <div className="mt-6 space-y-4">
            {recentActivity.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item}</p>
                  <p className="mt-1 text-xs text-slate-500">Updated recently</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">System Status</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current status of the workspace tools.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Dashboard</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Online
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Library</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Ready
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Uploads</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Monitoring
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Search</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Active
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}