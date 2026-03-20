"use client";

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

export default function CompanyUsersPage() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setMessage("");

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
      setScopeTeam(data?.scopeTeam ?? "General");
      setScopeCompanyName(data?.scopeCompanyName ?? data?.scopeTeam ?? "General");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load company users.");
      setUsers([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (!query) return true;
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [searchTerm, users]);

  const stats = useMemo(
    () => [
      {
        title: "Company Users",
        value: String(users.length),
        note: "Users currently assigned to this company workspace",
      },
      {
        title: "Pending Approval",
        value: String(users.filter((user) => user.status === "Pending").length),
        note: "Accounts waiting to be activated",
      },
      {
        title: "Active Users",
        value: String(users.filter((user) => user.status === "Active").length),
        note: "People with current workspace access",
      },
    ],
    [users]
  );

  const activityItems = useMemo(() => {
    const items = users
      .map((user) => ({
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
      }))
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
  }, [scopeTeam, users]);

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
      await loadUsers();
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
      await loadUsers();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to update company user.");
    }

    setSaveLoading(false);
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Access"
        title="Company Users"
        description={`Invite and manage only the users assigned to ${scopeCompanyName}. Company access stays scoped to your own company.`}
        actions={
          <button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {inviteLoading ? "Inviting..." : "Invite Company User"}
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Invite Company User"
          description="New users added here are scoped to your company workspace."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="email"
              placeholder="Invite by email..."
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
            Company scope: <span className="font-semibold text-slate-900">{scopeCompanyName}</span>
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
        title="Company Directory"
        description="Everyone shown here belongs to your company scope only."
      >
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search company users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
        </div>

        {loading ? (
          <InlineMessage>Loading company directory...</InlineMessage>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No company users found"
            description="Invite your first company user or clear the current search."
          />
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
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
                  Manage Company User
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

            <div className="mt-6 flex justify-end">
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
