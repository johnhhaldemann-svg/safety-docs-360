"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
};

const roleOptions = [
  "All Roles",
  "Super Admin",
  "Admin",
  "Manager",
  "Editor",
  "Viewer",
];

function statusClasses(status: string) {
  if (status === "Active") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Pending") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Suspended") {
    return "bg-red-100 text-red-700";
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

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "No recent sign-in";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteTeam, setInviteTeam] = useState("General");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("Viewer");
  const [editTeam, setEditTeam] = useState("General");
  const [editStatus, setEditStatus] = useState("Active");
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("You must be logged in as an admin.");
    }

    return session.access_token;
  }

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string; users?: AdminUser[] }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Failed to load users.");
        setUsers([]);
        setLoading(false);
        return;
      }

      setUsers(data?.users ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load users.");
      setUsers([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadUsers();
    })();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.team.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "All Roles" ? true : user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchTerm, users]);

  const userStats = useMemo(() => {
    const activeToday = users.filter((user) => {
      if (!user.last_sign_in_at) return false;
      const lastSeen = new Date(user.last_sign_in_at);
      const today = new Date();

      return (
        lastSeen.getFullYear() === today.getFullYear() &&
        lastSeen.getMonth() === today.getMonth() &&
        lastSeen.getDate() === today.getDate()
      );
    }).length;

    const admins = users.filter((user) =>
      ["Super Admin", "Admin"].includes(user.role)
    ).length;
    const pendingInvites = users.filter((user) => user.status === "Pending").length;
    const suspendedUsers = users.filter((user) => user.status === "Suspended").length;

    return [
      {
        title: "Total Users",
        value: String(users.length),
        note: "Across the current workspace",
      },
      {
        title: "Active Today",
        value: String(activeToday),
        note: "Signed in during the last day",
      },
      {
        title: "Admins",
        value: String(admins),
        note: "Admin and super admin accounts",
      },
      {
        title: "Pending Invites",
        value: String(pendingInvites),
        note: "Awaiting account acceptance",
      },
      {
        title: "Suspended",
        value: String(suspendedUsers),
        note: "Accounts blocked from the app",
      },
    ];
  }, [users]);

  const pendingTasks = useMemo(() => {
    const pendingInvites = users.filter((user) => user.status === "Pending").length;
    const inactiveUsers = users.filter((user) => user.status === "Inactive").length;
    const suspendedUsers = users.filter((user) => user.status === "Suspended").length;
    const editors = users.filter((user) => user.role === "Editor").length;

    return [
      {
        title: "Review pending user invitations",
        note: `${pendingInvites} invitation${pendingInvites === 1 ? "" : "s"} have not yet been accepted.`,
      },
      {
        title: "Verify editor access for library team",
        note: `${editors} editor account${editors === 1 ? "" : "s"} currently have content permissions.`,
      },
      {
        title: "Review suspended accounts",
        note: `${suspendedUsers} account${suspendedUsers === 1 ? "" : "s"} are currently blocked from the workspace.`,
      },
      {
        title: "Disable inactive accounts",
        note: `${inactiveUsers} user${inactiveUsers === 1 ? "" : "s"} are currently inactive.`,
      },
    ];
  }, [users]);

  async function handleInviteUser() {
    setInviteLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          team: inviteTeam,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Failed to invite user.");
        setInviteLoading(false);
        return;
      }

      setInviteEmail("");
      setInviteRole("Viewer");
      setInviteTeam("General");
      setMessage("Invitation sent successfully.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to invite user.");
    }

    setInviteLoading(false);
  }

  async function handleSaveUser() {
    if (!editingUser) return;

    setSaveLoading(true);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: editRole,
          team: editTeam,
          accountStatus: editStatus,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        setMessage(data?.error || "Failed to update user.");
        setSaveLoading(false);
        return;
      }

      setEditingUser(null);
      setMessage("User settings updated.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update user.");
    }

    setSaveLoading(false);
  }

  async function handleUserAction(
    action: "resend_invite" | "password_reset" | "force_sign_out"
  ) {
    if (!editingUser) return;

    setActionLoading(action);
    setMessage("");

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        setMessage(
          data?.error ||
            (action === "resend_invite"
              ? "Failed to resend invite."
              : action === "password_reset"
                ? "Failed to send password reset."
                : "Failed to force sign out.")
        );
        setActionLoading("");
        return;
      }

      setMessage(
        action === "resend_invite"
          ? "Invite email sent again."
          : action === "password_reset"
            ? "Password reset email sent."
            : "Force sign-out sent. The user may keep access briefly until the current access token expires."
      );
      await loadUsers();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : action === "resend_invite"
            ? "Failed to resend invite."
            : action === "password_reset"
              ? "Failed to send password reset."
              : "Failed to force sign out."
      );
    }

    setActionLoading("");
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Administration"
        title="User Management"
        description="Manage user access, roles, permissions, invitations, and workspace visibility from one central location."
        actions={
          <>
            <button
              onClick={handleInviteUser}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {inviteLoading ? "Inviting..." : "Invite User"}
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Admin
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {userStats.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {loading ? "-" : item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <SectionCard title="Invite or Search" description="Invite a new user or filter the current user list.">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="email"
              placeholder="Invite by email..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Team"
              value={inviteTeam}
              onChange={(e) => setInviteTeam(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-500"
            >
              {roleOptions
                .filter((role) => role !== "All Roles")
                .map((role) => (
                  <option key={role}>{role}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-500"
            >
              {roleOptions.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("All Roles");
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear Filters
            </button>
          </div>

          {message ? <InlineMessage>{message}</InlineMessage> : null}
        </div>
      </SectionCard>

      <SectionCard title="Users" description="Review users, roles, and current account status.">
        {loading ? (
          <InlineMessage>Loading users...</InlineMessage>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users match the current filters"
            description="Try a different search term or clear the role filter."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
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
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Last Seen
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="rounded-2xl">
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

                    <td className="border-y border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {formatRelative(user.last_sign_in_at)}
                    </td>

                    <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-4 py-4 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditRole(user.role);
                          setEditTeam(user.team);
                          setEditStatus(user.status === "Suspended" ? "Suspended" : "Active");
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="grid gap-4 md:hidden">
              {filteredUsers.map((user) => (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-base font-semibold text-slate-900">{user.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{user.email}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleClasses(user.role)}`}>
                      {user.role}
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(user.status)}`}>
                      {user.status}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">Team: {user.team}</div>
                  <div className="mt-1 text-xs text-slate-500">Last seen {formatRelative(user.last_sign_in_at)}</div>
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setEditRole(user.role);
                      setEditTeam(user.team);
                      setEditStatus(user.status === "Suspended" ? "Suspended" : "Active");
                    }}
                    className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Role Permissions"
          description="Quick view of access levels across the platform."
        >
          <div className="mt-6 space-y-4">
            <PermissionCard
              title="Super Admin"
              body="Full access to users, templates, admin settings, reports, and workspace controls."
            />
            <PermissionCard
              title="Admin"
              body="Manage projects, templates, users, and approvals with limited system-level controls."
            />
            <PermissionCard
              title="Manager"
              body="Oversee team workspaces, approve content, and track documents and reports."
            />
            <PermissionCard
              title="Editor / Viewer"
              body="Create or review documents based on assigned access permissions."
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Pending Tasks"
          description="User-related items that still need action."
        >
          <div className="mt-6 space-y-4">
            {pendingTasks.map((task, index) => (
              <div
                key={task.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{task.note}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                  Manage User
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {editingUser.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{editingUser.email}</p>
              </div>

              <button
                onClick={() => setEditingUser(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                >
                  {roleOptions
                    .filter((role) => role !== "All Roles")
                    .map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Team
                </label>
                <input
                  type="text"
                  value={editTeam}
                  onChange={(e) => setEditTeam(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Account Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                >
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {editingUser.status === "Pending" ? (
                <button
                  onClick={() => void handleUserAction("resend_invite")}
                  disabled={actionLoading === "resend_invite"}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {actionLoading === "resend_invite" ? "Sending..." : "Resend Invite"}
                </button>
              ) : null}
              {editingUser.status !== "Pending" ? (
                <button
                  onClick={() => void handleUserAction("password_reset")}
                  disabled={actionLoading === "password_reset"}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {actionLoading === "password_reset" ? "Sending..." : "Send Password Reset"}
                </button>
              ) : null}
              {editingUser.status !== "Pending" && editingUser.status !== "Suspended" ? (
                <button
                  onClick={() => void handleUserAction("force_sign_out")}
                  disabled={actionLoading === "force_sign_out"}
                  className="rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                >
                  {actionLoading === "force_sign_out" ? "Forcing..." : "Force Sign Out"}
                </button>
              ) : null}
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saveLoading}
                className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
              >
                {saveLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PermissionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
