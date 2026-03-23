"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
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
};

type AdminUserCapabilities = {
  canPermanentlyDeleteUsers: boolean;
  canRunAdminAuthActions: boolean;
};

const roleOptions = [
  "All Roles",
  "Super Admin",
  "Admin",
  "Operations Manager",
  "Editor",
  "Viewer",
];

const internalRoles = new Set([
  "Super Admin",
  "Admin",
  "Operations Manager",
  "Editor",
  "Viewer",
]);

function statusClasses(status: string) {
  if (status === "Active") return "bg-emerald-100 text-emerald-700";
  if (status === "Pending") return "bg-amber-100 text-amber-700";
  if (status === "Suspended") return "bg-red-100 text-red-700";
  return "bg-slate-200 text-slate-700";
}

function roleClasses(role: string) {
  if (role === "Super Admin") return "bg-red-100 text-red-700";
  if (role === "Admin") return "bg-sky-100 text-sky-700";
  if (role === "Operations Manager") return "bg-violet-100 text-violet-700";
  if (role === "Company Admin") return "bg-indigo-100 text-indigo-700";
  if (role === "Company User") return "bg-amber-100 text-amber-700";
  if (role === "Editor") return "bg-amber-100 text-amber-700";
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
  const [capabilities, setCapabilities] = useState<AdminUserCapabilities>({
    canPermanentlyDeleteUsers: false,
    canRunAdminAuthActions: false,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");
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
  const [removeLoading, setRemoveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalMessageTone, setModalMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");

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

  const loadUsers = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setLoading(true);
    if (!options?.preserveMessage) {
      setMessage("");
      setMessageTone("neutral");
    }
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            users?: AdminUser[];
            capabilities?: Partial<AdminUserCapabilities>;
          }
        | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to load users.");
        setUsers([]);
        setCapabilities({
          canPermanentlyDeleteUsers: false,
          canRunAdminAuthActions: false,
        });
        setLoading(false);
        return;
      }
      setUsers(data?.users ?? []);
      setCapabilities({
        canPermanentlyDeleteUsers: Boolean(data?.capabilities?.canPermanentlyDeleteUsers),
        canRunAdminAuthActions: Boolean(data?.capabilities?.canRunAdminAuthActions),
      });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load users.");
      setUsers([]);
      setCapabilities({
        canPermanentlyDeleteUsers: false,
        canRunAdminAuthActions: false,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const internalUsers = users.filter((user) => internalRoles.has(user.role));
    const query = searchTerm.trim().toLowerCase();
    return internalUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.team.toLowerCase().includes(query);
      const matchesRole = roleFilter === "All Roles" ? true : user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchTerm, users]);

  const pendingApprovals = useMemo(
    () =>
      users
        .filter((user) => internalRoles.has(user.role))
        .filter((user) => user.status === "Pending")
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        ),
    [users]
  );

  const userStats = useMemo(() => {
    const activeToday = users.filter((user) => {
      if (!internalRoles.has(user.role)) return false;
      if (!user.last_sign_in_at) return false;
      const lastSeen = new Date(user.last_sign_in_at);
      const today = new Date();
      return (
        lastSeen.getFullYear() === today.getFullYear() &&
        lastSeen.getMonth() === today.getMonth() &&
        lastSeen.getDate() === today.getDate()
      );
    }).length;
    return [
      {
        title: "Platform Users",
        value: String(users.filter((user) => internalRoles.has(user.role)).length),
        note: "Internal employees managing the platform",
      },
      { title: "Active Today", value: String(activeToday), note: "Signed in during the last day" },
      {
        title: "Pending Approval",
        value: String(pendingApprovals.length),
        note: "Accounts waiting on admin approval",
      },
      {
        title: "Suspended",
        value: String(
          users.filter((user) => internalRoles.has(user.role) && user.status === "Suspended")
            .length
        ),
        note: "Internal accounts blocked from the app",
      },
    ];
  }, [pendingApprovals.length, users]);

  const accessActivity = useMemo(
    () =>
      users
        .filter((user) => internalRoles.has(user.role))
        .map((user) => ({
          id: user.id,
          sortAt: new Date(user.last_sign_in_at ?? user.created_at ?? 0).getTime(),
          title: user.last_sign_in_at
            ? `${user.name} signed in`
            : user.status === "Pending"
              ? `${user.name} is waiting for approval`
              : `${user.name} joined the workspace`,
          detail: user.last_sign_in_at
            ? `${user.role} access in ${user.team}.`
            : user.status === "Pending"
              ? "Admin approval is still required before workspace access opens."
              : `${user.role} account created in ${user.team}.`,
          meta: formatRelative(user.last_sign_in_at ?? user.created_at),
          tone: user.status === "Pending" ? ("warning" as const) : ("info" as const),
        }))
        .sort((a, b) => b.sortAt - a.sortAt)
        .slice(0, 6)
        .map(({ id, title, detail, meta, tone }) => ({
          id,
          title,
          detail,
          meta,
          tone,
        })),
    [users]
  );

  async function handleInviteUser() {
    setInviteLoading(true);
    setMessage("");
    setMessageTone("neutral");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, team: inviteTeam }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to invite user.");
        setInviteLoading(false);
        return;
      }
      setInviteEmail("");
      setInviteRole("Viewer");
      setInviteTeam("General");
      setMessageTone("success");
      setMessage("Internal employee invite sent successfully.");
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to invite user.");
    }
    setInviteLoading(false);
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    setSaveLoading(true);
    setMessage("");
    setMessageTone("neutral");
    setModalMessage("");
    setModalMessageTone("neutral");
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
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update user.");
        setModalMessageTone("error");
        setModalMessage(data?.error || "Failed to update user.");
        setSaveLoading(false);
        return;
      }
      setMessageTone("success");
      setMessage("User settings updated.");
      setModalMessageTone("success");
      setModalMessage("User settings updated.");
      await loadUsers({ preserveMessage: true });
      setEditingUser(null);
    } catch (error) {
      setMessageTone("error");
      const nextMessage =
        error instanceof Error ? error.message : "Failed to update user.";
      setMessage(nextMessage);
      setModalMessageTone("error");
      setModalMessage(nextMessage);
    }
    setSaveLoading(false);
  }

  async function handleUserAction(
    action: "resend_invite" | "password_reset" | "force_sign_out"
  ) {
    if (!editingUser) return;
    setActionLoading(action);
    setMessage("");
    setMessageTone("neutral");
    setModalMessage("");
    setModalMessageTone("neutral");
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
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to run the requested action.");
        setModalMessageTone("error");
        setModalMessage(data?.error || "Failed to run the requested action.");
        setActionLoading("");
        return;
      }
      const successMessage =
        action === "resend_invite"
          ? "Invite email sent again."
          : action === "password_reset"
            ? "Password reset email sent."
            : "Force sign-out sent.";
      setMessageTone("success");
      setMessage(successMessage);
      setModalMessageTone("success");
      setModalMessage(successMessage);
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      const nextMessage =
        error instanceof Error ? error.message : "Failed to run the requested action.";
      setMessage(nextMessage);
      setModalMessageTone("error");
      setModalMessage(nextMessage);
    }
    setActionLoading("");
  }

  async function handleDeactivateUser() {
    if (!editingUser) return;

    const confirmed = window.confirm(
      `Deactivate ${editingUser.name}? They will lose workspace access until you reactivate them.`
    );

    if (!confirmed) return;

    setRemoveLoading(true);
    setMessage("");
    setMessageTone("neutral");
    setModalMessage("");
    setModalMessageTone("neutral");

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: editingUser.role,
          team: editingUser.team,
          accountStatus: "Suspended",
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!res.ok) {
        const nextMessage = data?.error || "Failed to deactivate user.";
        setMessageTone("error");
        setMessage(nextMessage);
        setModalMessageTone("error");
        setModalMessage(nextMessage);
        setRemoveLoading(false);
        return;
      }

      const successMessage =
        data?.message || "User deactivated successfully.";
      setMessageTone("success");
      setMessage(successMessage);
      setModalMessageTone("success");
      setModalMessage(successMessage);
      await loadUsers({ preserveMessage: true });
      setEditingUser(null);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to deactivate user.";
      setMessageTone("error");
      setMessage(nextMessage);
      setModalMessageTone("error");
      setModalMessage(nextMessage);
    }

    setRemoveLoading(false);
  }

  async function handleDeleteUser() {
    if (!editingUser) return;

    const confirmed = window.confirm(
      `Permanently delete ${editingUser.name}? This will remove their account completely and cannot be undone.`
    );

    if (!confirmed) return;

    setRemoveLoading(true);
    setMessage("");
    setMessageTone("neutral");
    setModalMessage("");
    setModalMessageTone("neutral");

    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!res.ok) {
        const nextMessage = data?.error || "Failed to delete user.";
        setMessageTone("error");
        setMessage(nextMessage);
        setModalMessageTone("error");
        setModalMessage(nextMessage);
        setRemoveLoading(false);
        return;
      }

      const successMessage = data?.message || "User deleted permanently.";
      setMessageTone("success");
      setMessage(successMessage);
      setModalMessageTone("success");
      setModalMessage(successMessage);
      await loadUsers({ preserveMessage: true });
      setEditingUser(null);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to delete user.";
      setMessageTone("error");
      setMessage(nextMessage);
      setModalMessageTone("error");
      setModalMessage(nextMessage);
    }

    setRemoveLoading(false);
  }

  async function handleQuickStatus(user: AdminUser, nextStatus: "Active" | "Suspended") {
    setActionLoading(`${user.id}:${nextStatus}`);
    setMessage("");
    setMessageTone("neutral");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: user.role,
          team: user.team,
          accountStatus: nextStatus,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update account status.");
        setActionLoading("");
        return;
      }
      setMessageTone(nextStatus === "Active" ? "success" : "warning");
      setMessage(
        nextStatus === "Active"
          ? `${user.name} has been approved and can now access the workspace.`
          : `${user.name} has been suspended from the workspace.`
      );
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update account status.");
    }
    setActionLoading("");
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Administration"
        title="Platform Staff"
        description="Manage only your internal Safety360Docs employees here. Company workspaces and company employees are handled separately."
        actions={
          <>
            <Link
              href="/admin/companies"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage Companies
            </Link>
            <button
              onClick={handleInviteUser}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {inviteLoading ? "Inviting..." : "Invite Platform Staff"}
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
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {loading ? "-" : item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <SectionCard
        title="Who Belongs Here"
        description="Use this page only for your own internal team."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Platform Staff</p>
            <p className="mt-2 text-sm text-slate-600">
              Super Admin, Admin, Operations Manager, Editor, and Viewer accounts for your
              internal employees are managed here.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Companies</p>
            <p className="mt-2 text-sm text-slate-600">
              New customer company workspaces are reviewed and approved from the company oversight
              screen.
            </p>
            <Link
              href="/admin/companies"
              className="mt-3 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-600"
            >
              Open Company Oversight
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Company Employees</p>
            <p className="mt-2 text-sm text-slate-600">
              Company admins invite, approve, and manage their own employees from inside their
              company workspace.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Invite Staff or Search"
        description="Invite internal employees or filter the current platform staff list."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="email"
            placeholder="Invite staff by email..."
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          <input
            type="text"
            placeholder="Internal team"
            value={inviteTeam}
            onChange={(e) => setInviteTeam(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          <input
            type="text"
            placeholder="Search platform staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-500"
          >
            {roleOptions.filter((role) => role !== "All Roles").map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
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
          {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Staff Approval Queue"
          description="Internal employee accounts waiting for an admin decision before they can open the platform."
        >
          {loading ? (
            <InlineMessage>Loading approval queue...</InlineMessage>
          ) : pendingApprovals.length === 0 ? (
            <EmptyState
              title="No staff accounts are waiting for approval"
              description="New internal employee accounts will appear here until an admin activates them."
            />
          ) : (
            <div className="space-y-4">
              {pendingApprovals.slice(0, 6).map((user) => (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                        <StatusBadge label={user.status} tone="warning" />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Role: {user.role}</span>
                        <span>Team: {user.team}</span>
                        <span>Created {formatRelative(user.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void handleQuickStatus(user, "Active")}
                        disabled={actionLoading === `${user.id}:Active`}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {actionLoading === `${user.id}:Active` ? "Approving..." : "Approve"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditRole(user.role);
                          setEditTeam(user.team);
                          setEditStatus("Pending");
                          setModalMessage("");
                          setModalMessageTone("neutral");
                        }}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                      >
                        Review Details
                      </button>
                      <button
                        onClick={() => void handleQuickStatus(user, "Suspended")}
                        disabled={actionLoading === `${user.id}:Suspended`}
                        className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {actionLoading === `${user.id}:Suspended` ? "Blocking..." : "Suspend"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <ActivityFeed
          title="Recent Access Activity"
          description="Latest sign-ins, new account creation, and accounts that still need review."
          items={
            accessActivity.length > 0
              ? accessActivity
              : [
                  {
                    id: "no-activity",
                    title: "No access activity yet",
                    detail: "Sign-ins and new account creation will appear here.",
                    meta: "Waiting",
                    tone: "neutral",
                  },
                ]
          }
        />
      </section>

      <SectionCard
        title="Platform Users"
        description="Review internal employees, platform roles, and platform access."
      >
        {loading ? (
          <InlineMessage>Loading platform staff...</InlineMessage>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No platform staff match the current filters"
            description="Try a different search term or clear the role filter."
          />
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleClasses(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                          user.status
                        )}`}
                      >
                        {user.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Team: {user.team}</span>
                      <span>Last seen {formatRelative(user.last_sign_in_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setEditRole(user.role);
                      setEditTeam(user.team);
                      setEditStatus(
                        user.status === "Pending"
                          ? "Pending"
                          : user.status === "Suspended"
                            ? "Suspended"
                            : "Active"
                      );
                      setModalMessage("");
                      setModalMessageTone("neutral");
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                  Manage User
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{editingUser.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{editingUser.email}</p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setModalMessage("");
                  setModalMessageTone("neutral");
                }}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              >
                {roleOptions.filter((role) => role !== "All Roles").map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
              <input
                type="text"
                value={editTeam}
                onChange={(e) => setEditTeam(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              />
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              >
                <option>Pending</option>
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </div>

            {modalMessage ? (
              <div className="mt-4">
                <InlineMessage tone={modalMessageTone}>{modalMessage}</InlineMessage>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => void handleDeactivateUser()}
                disabled={removeLoading}
                className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {removeLoading ? "Deactivating..." : "Deactivate User"}
              </button>
              {capabilities.canPermanentlyDeleteUsers ? (
                <button
                  onClick={() => void handleDeleteUser()}
                  disabled={removeLoading}
                  className="rounded-xl border border-red-500 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                >
                  {removeLoading ? "Deleting..." : "Delete User"}
                </button>
              ) : null}
              {editingUser.status === "Pending" && capabilities.canRunAdminAuthActions ? (
                <button
                  onClick={() => void handleUserAction("resend_invite")}
                  disabled={actionLoading === "resend_invite"}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {actionLoading === "resend_invite" ? "Sending..." : "Resend Invite"}
                </button>
              ) : null}
              {editingUser.status !== "Pending" && capabilities.canRunAdminAuthActions ? (
                <button
                  onClick={() => void handleUserAction("password_reset")}
                  disabled={actionLoading === "password_reset"}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {actionLoading === "password_reset" ? "Sending..." : "Send Password Reset"}
                </button>
              ) : null}
              {editingUser.status !== "Pending" &&
              editingUser.status !== "Suspended" &&
              capabilities.canRunAdminAuthActions ? (
                <button
                  onClick={() => void handleUserAction("force_sign_out")}
                  disabled={actionLoading === "force_sign_out"}
                  className="rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                >
                  {actionLoading === "force_sign_out" ? "Forcing..." : "Force Sign Out"}
                </button>
              ) : null}
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
