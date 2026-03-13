import Link from "next/link";

const adminStats = [
  {
    title: "Total Users",
    value: "24",
    note: "4 added this month",
  },
  {
    title: "Active Projects",
    value: "12",
    note: "2 awaiting setup",
  },
  {
    title: "Pending Approvals",
    value: "9",
    note: "3 urgent",
  },
  {
    title: "Stored Templates",
    value: "146",
    note: "8 recently updated",
  },
];

const adminSections = [
  {
    title: "User Management",
    description: "Manage user access, roles, permissions, and account status.",
    href: "/admin/users",
    button: "Manage Users",
  },
  {
    title: "Project Controls",
    description: "Set up projects, assign teams, and track workspace ownership.",
    href: "/admin/projects",
    button: "Open Projects",
  },
  {
    title: "Template Control",
    description: "Review, update, and organize templates across the platform.",
    href: "/library",
    button: "View Templates",
  },
  {
    title: "System Settings",
    description: "Control portal defaults, workflow rules, and admin options.",
    href: "/admin/settings",
    button: "Open Settings",
  },
];

const approvals = [
  {
    name: "Lilly North Expansion PESHEP",
    type: "Plan Approval",
    status: "Needs Review",
  },
  {
    name: "Excavation Checklist Template",
    type: "Template Update",
    status: "Pending",
  },
  {
    name: "User Access Request - Field Supervisor",
    type: "Permission Request",
    status: "Urgent",
  },
  {
    name: "Weekly Audit Report Export Rule",
    type: "Workflow Change",
    status: "Pending",
  },
];

const activity = [
  "New admin user added to project workspace",
  "Template revision saved to library",
  "Project permissions updated for upload team",
  "Search index refreshed for active records",
  "Report approval workflow edited",
];

function statusClasses(status: string) {
  if (status === "Urgent") {
    return "bg-red-100 text-red-700";
  }

  if (status === "Needs Review") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-sky-100 text-sky-700";
}

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Administration
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Admin Panel
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Manage users, permissions, templates, project controls, and
              workspace settings from one centralized admin area.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/users"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Manage Users
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Admin Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {adminStats.map((item) => (
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
          <h2 className="text-xl font-bold text-slate-900">Admin Tools</h2>
          <p className="mt-1 text-sm text-slate-500">
            Access the core controls for platform administration.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {adminSections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>
                <Link
                  href={section.href}
                  className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {section.button}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Approval Queue</h2>
          <p className="mt-1 text-sm text-slate-500">
            Items currently waiting for review or action.
          </p>

          <div className="mt-6 space-y-4">
            {approvals.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.type}</p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent Admin Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest changes made across the platform.
          </p>

          <div className="mt-6 space-y-4">
            {activity.map((item, index) => (
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
          <h2 className="text-xl font-bold text-slate-900">System Controls</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quick access to high-level admin actions.
          </p>

          <div className="mt-6 space-y-3">
            <Link
              href="/upload"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Review uploaded files</span>
              <span>→</span>
            </Link>

            <Link
              href="/search"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Search all records</span>
              <span>→</span>
            </Link>

            <Link
              href="/library"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Open template library</span>
              <span>→</span>
            </Link>

            <Link
              href="/admin/settings"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>Edit admin settings</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}