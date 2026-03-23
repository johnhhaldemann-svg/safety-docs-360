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

type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type CompanyInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
};

type EnvDetails = {
  url?: boolean;
  anonKey?: boolean;
  serviceRoleKey?: boolean;
  sources?: {
    url?: string | null;
    anonKey?: string | null;
    serviceRoleKey?: string | null;
  };
};

const roleOptions = ["Company Admin", "Company User"];

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (status === "Suspended") return "error";
  return "neutral";
}

function roleClasses(role: string) {
  if (role === "Company Admin") return "bg-violet-100 text-violet-700";
  if (role === "Company User") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatEnvDetails(details?: EnvDetails | null) {
  if (!details) return "";

  const urlText = details.url
    ? `URL from ${details.sources?.url ?? "unknown source"}`
    : "URL missing";
  const serviceRoleText = details.serviceRoleKey
    ? `service role from ${details.sources?.serviceRoleKey ?? "unknown source"}`
    : "service role missing";

  return ` Server check: ${urlText}; ${serviceRoleText}.`;
}

function getProfileHref(userId: string) {
  return `/profile?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent("/company-users")}`;
}

export default function CompanyUsersPage() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");
  const [scopeTeam, setScopeTeam] = useState("General");
  const [scopeCompanyName, setScopeCompanyName] = useState("General");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Company User");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [editRole, setEditRole] = useState("Company User");
  const [editStatus, setEditStatus] = useState("Active");
  const [saveLoading, setSaveLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error("You must be logged in.");
    }
    return session.access_token;
  }

  const loadUsers = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setLoading(true);
    if (!options?.preserveMessage) {
      setMessage("");
    }

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/company/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
          users?: CompanyUser[];
          invites?: CompanyInvite[];
          scopeTeam?: string;
          scopeCompanyName?: string;
          details?: EnvDetails;
          }
        | null;

      if (!response.ok) {
        setMessageTone("error");
        setMessage(
          `${data?.error || "Failed to load company users."}${formatEnvDetails(data?.details)}`
        );
        setUsers([]);
        setLoading(false);
        return;
      }

      setUsers(data?.users ?? []);
      setInvites(data?.invites ?? []);
      setScopeTeam(data?.scopeTeam ?? "General");
      setScopeCompanyName(data?.scopeCompanyName ?? data?.scopeTeam ?? "General");
    } catch (error) {
      setMessageTone("error");
        setMessage(error instanceof Error ? error.message : "Failed to load company users.");
        setUsers([]);
        setInvites([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const pendingUsers = useMemo(
    () => users.filter((user) => user.status === "Pending"),
    [users]
  );

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === "Active"),
    [users]
  );

  const filteredTeamMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const visibleUsers = users.filter(
      (user) => user.status === "Active" || user.status === "Suspended"
    );

    return visibleUsers.filter((user) => {
      if (!query) return true;
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [searchTerm, users]);

  const filteredActiveUsers = useMemo(
    () => filteredTeamMembers.filter((user) => user.status === "Active"),
    [filteredTeamMembers]
  );

  const filteredSuspendedUsers = useMemo(
    () => filteredTeamMembers.filter((user) => user.status === "Suspended"),
    [filteredTeamMembers]
  );

  const stats = useMemo(
    () => [
      {
        title: "Invited Employees",
        value: String(invites.length),
        note: "Invites waiting for employees to finish account setup",
      },
      {
        title: "Awaiting Approval",
        value: String(pendingUsers.length),
        note: "Employees who set up an account and need your approval",
      },
      {
        title: "Active Employees",
        value: String(activeUsers.length),
        note: "People with live access to this company workspace",
      },
    ],
    [activeUsers.length, invites.length, pendingUsers.length]
  );

  const activityItems = useMemo(() => {
    const userItems = users.map((user) => ({
        id: user.id,
        sortAt: new Date(user.last_sign_in_at ?? user.created_at ?? 0).getTime(),
        title:
          user.status === "Pending"
            ? `${user.name} is waiting for access`
            : `${user.name} belongs to ${scopeTeam}`,
        detail:
          user.status === "Pending"
            ? "This user still needs approval before they can enter the company workspace."
            : `${user.role} access for ${scopeTeam}.`,
        meta: formatRelative(user.last_sign_in_at ?? user.created_at),
        tone: user.status === "Pending" ? ("warning" as const) : ("info" as const),
      }));

    const inviteItems = invites.map((invite) => ({
      id: `invite-${invite.id}`,
      sortAt: new Date(invite.created_at ?? 0).getTime(),
      title: `${invite.email} has been invited`,
      detail: `Waiting for the employee to create their account for ${scopeCompanyName}.`,
      meta: formatRelative(invite.created_at),
      tone: "warning" as const,
    }));

    const items = [...userItems, ...inviteItems]
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 5);

    return items.length > 0
      ? items
      : [
          {
            id: "empty-company",
            title: "No company activity yet",
            detail: "Invites and access changes will show up here.",
            meta: "Waiting",
            tone: "neutral" as const,
          },
        ];
  }, [invites, scopeCompanyName, scopeTeam, users]);

  async function handleInvite() {
    setInviteLoading(true);
    setMessage("");
    setMessageTone("neutral");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/company/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; details?: EnvDetails; message?: string; warning?: string }
        | null;
      const details = data?.details;

      if (!response.ok) {
        setMessageTone("error");
        setMessage(
          `${data?.error || "Failed to invite company user."}${formatEnvDetails(details)}`
        );
        setInviteLoading(false);
        return;
      }

      setInviteEmail("");
      setInviteRole("Company User");
      setMessageTone(data?.warning ? "warning" : "success");
      setMessage(data?.warning || data?.message || "Company user invited successfully.");
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to invite company user.");
    }

    setInviteLoading(false);
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    setSaveLoading(true);
    setMessage("");
    setMessageTone("neutral");

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/company/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: editRole,
          accountStatus: editStatus,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update company user.");
        setSaveLoading(false);
        return;
      }

      setEditingUser(null);
      setMessageTone("success");
      setMessage("Company user updated.");
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update company user.");
    }

    setSaveLoading(false);
  }

  async function handleQuickStatus(user: CompanyUser, nextStatus: "Active" | "Suspended") {
    setSaveLoading(true);
    setMessage("");
    setMessageTone("neutral");

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/company/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: user.role,
          accountStatus: nextStatus,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to update company user.");
        setSaveLoading(false);
        return;
      }

      setMessageTone(nextStatus === "Active" ? "success" : "warning");
      setMessage(
        nextStatus === "Active"
          ? `${user.name} has been approved for the company workspace.`
          : `${user.name} has been suspended from the company workspace.`
      );
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update company user.");
    }

    setSaveLoading(false);
  }

  async function handleRemoveUser() {
    if (!editingUser) return;

    const confirmed = window.confirm(
      `Remove ${editingUser.name} from ${scopeCompanyName}? This will revoke company access and suspend the account until an internal admin reassigns it.`
    );

    if (!confirmed) return;

    setRemoveLoading(true);
    setMessage("");
    setMessageTone("neutral");

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/company/users/${editingUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to remove company user.");
        setRemoveLoading(false);
        return;
      }

      setEditingUser(null);
      setMessageTone("success");
      setMessage(
        data?.message || "User removed from the company workspace successfully."
      );
      await loadUsers({ preserveMessage: true });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to remove company user.");
    }

    setRemoveLoading(false);
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Workspace"
        title="Team Access"
        description={`Manage only the people assigned to ${scopeCompanyName}. Invite employees, approve new joiners, and manage active team access from one place.`}
        actions={
          <button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {inviteLoading ? "Sending Invite..." : "Invite Employee"}
          </button>
        }
      />

      <section className="grid gap-5 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {loading ? "-" : item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "01",
            title: "Invite employee",
            body: "Send access under your company workspace using the employee email they will use to sign in.",
          },
          {
            step: "02",
            title: "Employee creates account",
            body: "They use Create Account on the login page with the invited email to finish account setup.",
          },
          {
            step: "03",
            title: "Approve access",
            body: "Review the pending employee here, approve them, and assign the correct company role.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-700">
                {item.step}
              </div>
              <div>
                <div className="text-base font-bold text-slate-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Invite Employee"
          description="Start the process here. Employees use this invite to create their account before you approve access."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="email"
              placeholder="Employee email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
            >
              {roleOptions.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Company workspace: <span className="font-semibold text-slate-900">{scopeCompanyName}</span>
          </div>

          {message ? (
            <div className="mt-4">
              <InlineMessage tone={messageTone}>{message}</InlineMessage>
            </div>
          ) : null}
        </SectionCard>

        <ActivityFeed
          title="Company Access Activity"
          description="Recent membership and approval changes for your company."
          items={activityItems}
        />
      </section>

      <SectionCard
        title="1. Invited Employees"
        description="These employees have been invited but have not finished creating their account yet."
      >
        {loading ? (
          <InlineMessage>Loading pending invites...</InlineMessage>
        ) : invites.length === 0 ? (
          <EmptyState
            title="No invites are waiting"
            description="After you invite someone, they stay here until they use that email to create their company account."
          />
        ) : (
          <div className="grid gap-4">
            {invites.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{invite.email}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Role: {invite.role}</span>
                      <span>Status: {invite.status}</span>
                      <span>Sent {formatRelative(invite.created_at)}</span>
                    </div>
                  </div>
                  <StatusBadge label="Waiting for account setup" tone="warning" />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="2. Awaiting Approval"
        description="Employees who finished account setup stay here until you approve access to the company workspace."
      >
        {loading ? (
          <InlineMessage>Loading company approval queue...</InlineMessage>
        ) : pendingUsers.length === 0 ? (
          <EmptyState
            title="No employees are waiting for approval"
            description="Employees move here after they create their account with the invited email."
          />
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map((user) => (
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
                      <span>Company: {scopeCompanyName}</span>
                      <span>Created {formatRelative(user.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={getProfileHref(user.id)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={() => void handleQuickStatus(user, "Active")}
                      disabled={saveLoading}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setEditRole(user.role);
                        setEditStatus("Pending");
                      }}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => void handleQuickStatus(user, "Suspended")}
                      disabled={saveLoading}
                      className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      Suspend
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="3. Active Team Members"
        description="Approved employees with active access to your workspace appear here."
      >
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search active employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
        </div>

        {loading ? (
          <InlineMessage>Loading active team members...</InlineMessage>
        ) : filteredActiveUsers.length === 0 ? (
          <EmptyState
            title="No active employees found"
            description="Invite your first employee, approve a pending joiner, or clear the current search."
          />
        ) : (
          <div className="grid gap-4">
            {filteredActiveUsers.map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                      <StatusBadge label={user.status} tone={statusTone(user.status)} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Company: {user.team}</span>
                      <span>Last seen {formatRelative(user.last_sign_in_at)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setEditRole(user.role);
                      setEditStatus(
                        user.status === "Pending"
                          ? "Pending"
                          : user.status === "Suspended"
                            ? "Suspended"
                            : "Active"
                      );
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    Manage
                  </button>
                  <Link
                    href={getProfileHref(user.id)}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {loading || filteredSuspendedUsers.length > 0 ? (
        <SectionCard
          title="Suspended Access"
          description="Employees who are currently blocked from the workspace stay here until you reactivate or remove them."
        >
          {loading ? (
            <InlineMessage>Loading suspended employees...</InlineMessage>
          ) : (
            <div className="grid gap-4">
              {filteredSuspendedUsers.map((user) => (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                        <StatusBadge label={user.status} tone={statusTone(user.status)} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Company: {scopeCompanyName}</span>
                        <span>Last seen {formatRelative(user.last_sign_in_at)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setEditRole(user.role);
                        setEditStatus("Suspended");
                      }}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Manage
                    </button>
                    <Link
                      href={getProfileHref(user.id)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                  Manage Team Member
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{editingUser.name}</h3>
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Company scope: <span className="font-semibold text-slate-900">{scopeCompanyName}</span>
              </div>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              >
                {roleOptions.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
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

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Link
                href={getProfileHref(editingUser.id)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Edit Profile
              </Link>
              <button
                onClick={() => void handleRemoveUser()}
                disabled={removeLoading}
                className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {removeLoading ? "Removing..." : "Remove User"}
              </button>
              <button
                onClick={() => void handleSaveUser()}
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
