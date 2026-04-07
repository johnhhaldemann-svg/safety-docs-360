"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityFeed,
  appNativeSelectClassName,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import { PermissionOverridesEditor } from "@/components/PermissionOverridesEditor";
import {
  normalizePermissionOverrides,
  type PermissionOverrides,
} from "@/lib/permissionOverrides";

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
  companyId?: string | null;
  companyName?: string;
  status: string;
  permissionOverrides?: PermissionOverrides;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
  status: string;
};

type AdminUserCapabilities = {
  canPermanentlyDeleteUsers: boolean;
  canRunAdminAuthActions: boolean;
  canViewAllUsers: boolean;
};

const roleOptions = [
  "All Roles",
  "Super Admin",
  "Admin",
  "Company Admin",
  "Operations Manager",
  "Company User",
  "Editor",
  "Viewer",
];

const inviteRoleOptions = ["Super Admin", "Admin", "Editor", "Viewer"];

const internalRoles = new Set([
  "Super Admin",
  "Admin",
  "Editor",
  "Viewer",
]);

const companyAssignableRoles = new Set([
  "Company Admin",
  "Operations Manager",
  "Company User",
  "Safety Manager",
  "Project Manager",
  "Foreman",
  "Field User",
  "Read Only",
]);

function statusClasses(status: string) {
  if (status === "Active") return "bg-emerald-100 text-emerald-700";
  if (status === "Pending") return "bg-amber-100 text-amber-700";
  if (status === "Suspended") return "bg-red-100 text-red-200";
  return "bg-slate-200 text-slate-300";
}

function roleClasses(role: string) {
  if (role === "Super Admin") return "bg-red-100 text-red-200";
  if (role === "Admin") return "bg-sky-100 text-sky-300";
  if (role === "Operations Manager") return "bg-violet-100 text-violet-700";
  if (role === "Company Admin") return "bg-indigo-100 text-indigo-700";
  if (role === "Company User") return "bg-amber-100 text-amber-700";
  if (role === "Editor") return "bg-amber-100 text-amber-700";
  return "bg-slate-800/70 text-slate-300";
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

function findCompanyIdForUser(user: AdminUser, companies: CompanyOption[]) {
  if (user.companyId) {
    return user.companyId;
  }

  const matchedByName = companies.find(
    (company) => company.name.trim().toLowerCase() === user.team.trim().toLowerCase()
  );

  return matchedByName?.id ?? "";
}

function hasPermissionOverrides(overrides?: PermissionOverrides | null) {
  const normalized = normalizePermissionOverrides(overrides ?? null);
  return normalized.allow.length > 0 || normalized.deny.length > 0;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [capabilities, setCapabilities] = useState<AdminUserCapabilities>({
    canPermanentlyDeleteUsers: false,
    canRunAdminAuthActions: false,
    canViewAllUsers: false,
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
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("Viewer");
  const [editTeam, setEditTeam] = useState("General");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [editPermissionOverrides, setEditPermissionOverrides] = useState<PermissionOverrides>({
    allow: [],
    deny: [],
  });
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

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            companies?: Array<{
              id?: string;
              name?: string;
              status?: string;
            }>;
          }
        | null;

      if (!res.ok) {
        setCompanies([]);
        setCompaniesLoading(false);
        return;
      }

      setCompanies(
        (data?.companies ?? [])
          .map((company) => ({
            id: company.id ?? "",
            name: company.name?.trim() || "Unnamed Company",
            status: company.status?.trim() || "active",
          }))
          .filter((company) => Boolean(company.id))
      );
    } catch {
      setCompanies([]);
    }
    setCompaniesLoading(false);
  }, []);

  /** Keep company dropdown state aligned with loaded companies (fixes save sending null while UI showed a workspace). */
  /* eslint-disable react-hooks/set-state-in-effect -- sync dropdown when companies load after modal opens */
  useEffect(() => {
    if (!editingUser || companiesLoading || companies.length === 0) return;
    setEditCompanyId((prev) => {
      if (prev.trim()) return prev;
      return (
        (editingUser.companyId && editingUser.companyId.trim()) ||
        findCompanyIdForUser(editingUser, companies) ||
        ""
      );
    });
  }, [editingUser, companies, companiesLoading]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          canViewAllUsers: false,
        });
        setLoading(false);
        return;
      }
      setUsers(data?.users ?? []);
      setCapabilities({
        canPermanentlyDeleteUsers: Boolean(data?.capabilities?.canPermanentlyDeleteUsers),
        canRunAdminAuthActions: Boolean(data?.capabilities?.canRunAdminAuthActions),
        canViewAllUsers: Boolean(data?.capabilities?.canViewAllUsers),
      });
      if (Boolean(data?.capabilities?.canViewAllUsers)) {
        await loadCompanies();
      } else {
        setCompanies([]);
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load users.");
      setUsers([]);
      setCapabilities({
        canPermanentlyDeleteUsers: false,
        canRunAdminAuthActions: false,
        canViewAllUsers: false,
      });
    }
    setLoading(false);
  }, [loadCompanies]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const visibleUsers = capabilities.canViewAllUsers
      ? users
      : users.filter((user) => internalRoles.has(user.role));
    const query = searchTerm.trim().toLowerCase();
    return visibleUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.team.toLowerCase().includes(query);
      const matchesRole = roleFilter === "All Roles" ? true : user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [capabilities.canViewAllUsers, roleFilter, searchTerm, users]);

  const pendingApprovals = useMemo(
    () =>
      (capabilities.canViewAllUsers
        ? users
        : users.filter((user) => internalRoles.has(user.role)))
        .filter((user) => user.status === "Pending")
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        ),
    [capabilities.canViewAllUsers, users]
  );

  const userStats = useMemo(() => {
    const activeToday = users.filter((user) => {
      if (!capabilities.canViewAllUsers && !internalRoles.has(user.role)) return false;
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
        title: capabilities.canViewAllUsers ? "All Users" : "Platform Users",
        value: String(
          capabilities.canViewAllUsers
            ? users.length
            : users.filter((user) => internalRoles.has(user.role)).length
        ),
        note: capabilities.canViewAllUsers
          ? "Internal staff and company-scoped accounts"
          : "Internal employees managing the platform",
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
          users.filter(
            (user) =>
              (capabilities.canViewAllUsers || internalRoles.has(user.role)) &&
              user.status === "Suspended"
          ).length
        ),
        note: capabilities.canViewAllUsers
          ? "Accounts blocked from platform or company workspaces"
          : "Internal accounts blocked from the app",
      },
    ];
  }, [capabilities.canViewAllUsers, pendingApprovals.length, users]);

  const accessActivity = useMemo(
    () =>
      users
        .filter((user) => capabilities.canViewAllUsers || internalRoles.has(user.role))
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
    [capabilities.canViewAllUsers, users]
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
      const needsCompanyWorkspace =
        capabilities.canViewAllUsers && companyAssignableRoles.has(editRole);
      const nextCompanyId = needsCompanyWorkspace ? editCompanyId.trim() : "";

      if (needsCompanyWorkspace && !nextCompanyId) {
        setMessageTone("error");
        setMessage("Please choose a company workspace for this company-scoped role.");
        setModalMessageTone("error");
        setModalMessage("Please choose a company workspace for this company-scoped role.");
        setSaveLoading(false);
        return;
      }

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
          ...(needsCompanyWorkspace ? { companyId: nextCompanyId } : {}),
          permissionOverrides: editPermissionOverrides,
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
        title={capabilities.canViewAllUsers ? "All Users" : "Platform Staff"}
        description={
          capabilities.canViewAllUsers
            ? "Super Admin directory across internal staff, company owners, and company employees."
            : "Manage only your internal Safety360Docs employees here. Company workspaces and company employees are handled separately."
        }
        actions={
          <>
            <Link
              href="/admin/companies"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Manage Companies
            </Link>
            <button
              onClick={handleInviteUser}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {inviteLoading ? "Inviting..." : "Invite Platform Staff"}
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Back to Admin
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {userStats.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">
              {loading ? "-" : item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <SectionCard
        title={capabilities.canViewAllUsers ? "Directory Scope" : "Who Belongs Here"}
        description={
          capabilities.canViewAllUsers
            ? "You are signed in as Super Admin, so this page shows all accounts across the platform."
            : "Use this page only for your own internal team."
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <p className="text-sm font-semibold text-slate-100">Platform Staff</p>
            <p className="mt-2 text-sm text-slate-400">
              Super Admin, Admin, Editor, and Viewer accounts for your internal employees
              are managed here.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <p className="text-sm font-semibold text-slate-100">Companies</p>
            <p className="mt-2 text-sm text-slate-400">
              New customer company workspaces are reviewed and approved from the company oversight
              screen.
            </p>
            <Link
              href="/admin/companies"
              className="mt-3 inline-flex text-sm font-semibold text-sky-300 transition hover:text-sky-600"
            >
              Open Company Oversight
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
            <p className="text-sm font-semibold text-slate-100">Company Employees</p>
            <p className="mt-2 text-sm text-slate-400">
              {capabilities.canViewAllUsers
                ? "Super Admin can see company-scoped accounts here too. Company admins still manage their own employees from inside the company workspace."
                : "Company admins invite, approve, and manage Company Admin, Operations Manager, and Company User roles from inside their own company workspace."}
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
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          <input
            type="text"
            placeholder="Internal team"
            value={inviteTeam}
            onChange={(e) => setInviteTeam(e.target.value)}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          <input
            type="text"
            placeholder="Search platform staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className={appNativeSelectClassName}
            >
            {inviteRoleOptions.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={appNativeSelectClassName}
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
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
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
                <div key={user.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100">{user.name}</p>
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
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionLoading === `${user.id}:Active` ? "Approving..." : "Approve"}
                      </button>
                      <button
                      onClick={() => {
                        setEditingUser(user);
                        setEditRole(user.role);
                        setEditTeam(user.team);
                        setEditCompanyId(findCompanyIdForUser(user, companies));
                        setEditStatus("Pending");
                        setEditPermissionOverrides(
                          normalizePermissionOverrides(user.permissionOverrides ?? null)
                        );
                        setModalMessage("");
                        setModalMessageTone("neutral");
                      }}
                        className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
                      >
                        Review Details
                      </button>
                      <button
                        onClick={() => void handleQuickStatus(user, "Suspended")}
                        disabled={actionLoading === `${user.id}:Suspended`}
                        className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-950/40 disabled:opacity-60"
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
        title={capabilities.canViewAllUsers ? "All Users" : "Platform Users"}
        description={
          capabilities.canViewAllUsers
            ? "Review every account across internal staff and company workspaces."
            : "Review internal employees, platform roles, and platform access."
        }
      >
        {loading ? (
          <InlineMessage>
            {capabilities.canViewAllUsers ? "Loading all users..." : "Loading platform staff..."}
          </InlineMessage>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title={
              capabilities.canViewAllUsers
                ? "No users match the current filters"
                : "No platform staff match the current filters"
            }
            description="Try a different search term or clear the role filter."
          />
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">{user.name}</p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleClasses(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                      {hasPermissionOverrides(user.permissionOverrides) ? (
                        <span className="inline-flex rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/25">
                          Function overrides
                        </span>
                      ) : null}
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
                      {capabilities.canViewAllUsers ? (
                        <span>
                          Company: {user.companyName?.trim() || user.team || "Not assigned"}
                        </span>
                      ) : null}
                      <span>Last seen {formatRelative(user.last_sign_in_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                        setEditingUser(user);
                        setEditRole(user.role);
                        setEditTeam(user.team);
                        setEditCompanyId(findCompanyIdForUser(user, companies));
                        setEditStatus(
                          user.status === "Pending"
                            ? "Pending"
                            : user.status === "Suspended"
                              ? "Suspended"
                              : "Active"
                        );
                        setEditPermissionOverrides(
                          normalizePermissionOverrides(user.permissionOverrides ?? null)
                        );
                        setModalMessage("");
                        setModalMessageTone("neutral");
                      }}
                    className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 [color-scheme:dark]">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl [color-scheme:dark]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
                    Manage User
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-100">{editingUser.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{editingUser.email}</p>
                  {hasPermissionOverrides(editingUser.permissionOverrides) ? (
                    <div className="mt-3">
                      <StatusBadge label="Function overrides active" tone="info" />
                    </div>
                  ) : null}
                </div>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setModalMessage("");
                  setModalMessageTone("neutral");
                }}
                className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
              >
                Close
              </button>
            </div>

              <div className="mt-6 grid gap-4">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className={`w-full ${appNativeSelectClassName} py-3`}
              >
                {(capabilities.canViewAllUsers ? roleOptions : inviteRoleOptions).filter(
                  (role) => role !== "All Roles"
                ).map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
              {capabilities.canViewAllUsers ? (
                <div className="grid gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Company workspace
                  </label>
                  <select
                    value={editCompanyId}
                    onChange={(e) => setEditCompanyId(e.target.value)}
                    className={`w-full ${appNativeSelectClassName} py-3`}
                  >
                    <option value="">
                      {companiesLoading
                        ? "Loading company workspaces..."
                        : "Select a company workspace"}
                    </option>
                    {companies
                      .filter((company) => company.status.toLowerCase() !== "archived")
                      .map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Super Admin / Platform Admin: required when the role is company-scoped (e.g. Company Admin,
                    Field User). Links the user in{" "}
                    <code className="rounded bg-slate-800/70 px-1">company_memberships</code> and profile metadata.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Team label
                </label>
                <input
                  type="text"
                  value={editTeam}
                  onChange={(e) => setEditTeam(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none focus:border-sky-500"
                  placeholder="Display label (synced with workspace name when company is set)"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Account status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className={`w-full ${appNativeSelectClassName} py-3`}
                >
                  <option>Pending</option>
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              </div>
            </div>

            {capabilities.canViewAllUsers ? (
              <PermissionOverridesEditor
                title="User function overrides"
                description="Super Admins can allow or block specific functions for this user on top of the role defaults."
                value={editPermissionOverrides}
                onChange={setEditPermissionOverrides}
              />
            ) : null}

            <p className="mt-2 text-xs text-slate-500">
              Role defaults set the baseline, and Super Admin overrides can fine-tune the exact
              functions this account can use.
            </p>

              {modalMessage ? (
                <div className="mt-4">
                  <InlineMessage tone={modalMessageTone}>{modalMessage}</InlineMessage>
                </div>
              ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => void handleDeactivateUser()}
                disabled={removeLoading}
                className="rounded-xl border border-red-400/90 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-950/55 disabled:opacity-60"
              >
                {removeLoading ? "Deactivating..." : "Deactivate User"}
              </button>
              {capabilities.canPermanentlyDeleteUsers ? (
                <button
                  onClick={() => void handleDeleteUser()}
                  disabled={removeLoading}
                  className="rounded-xl border border-red-400 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-950/55 disabled:opacity-60"
                >
                  {removeLoading ? "Deleting..." : "Delete User"}
                </button>
              ) : null}
              {editingUser.status === "Pending" && capabilities.canRunAdminAuthActions ? (
                <button
                  onClick={() => void handleUserAction("resend_invite")}
                  disabled={actionLoading === "resend_invite"}
                  className="rounded-xl border border-slate-400 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/80 disabled:opacity-60"
                >
                  {actionLoading === "resend_invite" ? "Sending..." : "Resend Invite"}
                </button>
              ) : null}
              {editingUser.status !== "Pending" && capabilities.canRunAdminAuthActions ? (
                <button
                  onClick={() => void handleUserAction("password_reset")}
                  disabled={actionLoading === "password_reset"}
                  className="rounded-xl border border-slate-400 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/80 disabled:opacity-60"
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
                  className="rounded-xl border border-amber-400/90 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/50 disabled:opacity-60"
                >
                  {actionLoading === "force_sign_out" ? "Forcing..." : "Force Sign Out"}
                </button>
              ) : null}
              <button
                onClick={handleSaveUser}
                disabled={saveLoading}
                className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
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
