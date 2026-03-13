import Link from "next/link";

const userStats = [
  {
    title: "Total Users",
    value: "24",
    note: "Across all project workspaces",
  },
  {
    title: "Active Today",
    value: "11",
    note: "Currently using the platform",
  },
  {
    title: "Admins",
    value: "4",
    note: "Full management access",
  },
  {
    title: "Pending Invites",
    value: "3",
    note: "Awaiting acceptance",
  },
];

const users = [
  {
    name: "John Haldemann",
    email: "john@example.com",
    role: "Super Admin",
    team: "Safety Management",
    status: "Active",
  },
  {
    name: "Sydney Carter",
    email: "sydney@example.com",
    role: "Admin",
    team: "Project Controls",
    status: "Active",
  },
  {
    name: "Tyler Mason",
    email: "tyler@example.com",
    role: "Manager",
    team: "Field Operations",
    status: "Active",
  },
  {
    name: "Steve Collins",
    email: "steve@example.com",
    role: "Editor",
    team: "Library",
    status: "Pending",
  },
  {
    name: "Nick Turner",
    email: "nick@example.com",
    role: "Viewer",
    team: "Reports",
    status: "Inactive",
  },
];

function statusClasses(status: string) {
  if (status === "Active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Pending") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-200 text-slate-700";
}

function roleClasses(role: string) {
  if (role === "Super Admin") {
    return "bg-red-100 text-red-700";
  }

  if (role === "Admin") {
    return "bg-sky-100 text-sky-700";
  }

  if (role === "Manager") {
    return "bg-violet-100 text-violet-700";
  }

  if (role === "Editor") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function AdminUsersPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Administration
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              User Management
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Manage user access, roles, permissions, invitations, and workspace
              visibility from one central location.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">
              Invite User
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {userStats.map((item) => (
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Users</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review users, roles, and current account status.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Search users..."
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500"
            />
            <select className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-500">
              <option>All Roles</option>
              <option>Super Admin</option>
              <option>Admin</option>
              <option>Manager</option>
              <option>Editor</option>
              <option>Viewer</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  User
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Team
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
              {users.map((user) => (
                <tr key={user.email} className="rounded-2xl">
                  <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {user.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    </div>
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleClasses(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {user.team}
                  </td>

                  <td className="border-y border-slate-200 bg-slate-50 px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                        user.status
                      )}`}
                    >
                      {user.status}
                    </span>
                  </td>

                  <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-4 py-4 text-right">
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Role Permissions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quick view of access levels across the platform.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Super Admin</p>
              <p className="mt-1 text-sm text-slate-600">
                Full access to users, templates, admin settings, reports, and
                workspace controls.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Admin</p>
              <p className="mt-1 text-sm text-slate-600">
                Manage projects, templates, users, and approvals with limited
                system-level controls.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Manager</p>
              <p className="mt-1 text-sm text-slate-600">
                Oversee team workspaces, approve content, and track documents and
                reports.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Editor / Viewer</p>
              <p className="mt-1 text-sm text-slate-600">
                Create or review documents based on assigned access permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Pending Tasks</h2>
          <p className="mt-1 text-sm text-slate-500">
            User-related items that still need action.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Review pending user invitations
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  3 invitations have not yet been accepted.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Verify editor access for library team
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Confirm permissions for newly assigned template editors.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                3
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Disable inactive accounts
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Review users inactive for more than 30 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}