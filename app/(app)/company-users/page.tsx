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

type Jobsite = {
  id: string;
  name: string;
  status: string;
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

const roleOptions = [
  "Company Admin",
  "Operations Manager",
  "Safety Manager",
  "Project Manager",
  "Foreman",
  "Field User",
  "Read Only",
  "Company User",
];

function roleNeedsAssignments(role: string) {
  return (
    role === "Project Manager" ||
    role === "Foreman" ||
    role === "Field User" ||
    role === "Read Only" ||
    role === "Company User"
  );
}

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (status === "Suspended") return "error";
  return "neutral";
}

function roleClasses(role: string) {
  if (role === "Safety Manager") return "bg-emerald-100 text-emerald-700";
  if (role === "Project Manager") return "bg-indigo-100 text-indigo-700";
  if (role === "Foreman") return "bg-cyan-100 text-cyan-700";
  if (role === "Field User") return "bg-lime-100 text-lime-700";
  if (role === "Read Only") return "bg-slate-200 text-slate-300";
  if (role === "Company Admin") return "bg-violet-100 text-violet-700";
  if (role === "Operations Manager") return "bg-sky-100 text-sky-300";
  if (role === "Company User") return "bg-amber-100 text-amber-700";
  return "bg-slate-800/70 text-slate-300";
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
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string[]>>({});
  const [editAssignments, setEditAssignments] = useState<string[]>([]);

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

  const loadAssignmentData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/company/jobsite-assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            jobsites?: Jobsite[];
            assignments?: Array<{ user_id?: string; jobsite_id?: string }>;
          }
        | null;
      if (!response.ok) return;
      const nextMap: Record<string, string[]> = {};
      for (const row of data?.assignments ?? []) {
        const userId = row.user_id?.trim() ?? "";
        const jobsiteId = row.jobsite_id?.trim() ?? "";
        if (!userId || !jobsiteId) continue;
        nextMap[userId] = nextMap[userId] ? [...nextMap[userId], jobsiteId] : [jobsiteId];
      }
      setJobsites(data?.jobsites ?? []);
      setAssignmentMap(nextMap);
    } catch {
      // Keep existing company user flow even if assignment API is unavailable.
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
      void loadAssignmentData();
    });
  }, [loadAssignmentData, loadUsers]);

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
  const jobsiteNameById = useMemo(
    () =>
      jobsites.reduce<Record<string, string>>((acc, jobsite) => {
        acc[jobsite.id] = jobsite.name;
        return acc;
      }, {}),
    [jobsites]
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

  const launchChecklistItems = [
    {
      id: "invite-first-employee",
      title: "Invite the first employee",
      detail: "Send the first invite so the account approval flow has a real user to move through.",
      href: "/company-users",
      done: invites.length > 0,
    },
    {
      id: "approve-first-account",
      title: "Approve the first account",
      detail: "Confirm access, apply the correct role, and make the workspace active for the team.",
      href: "/company-users",
      done: pendingUsers.length === 0 && activeUsers.length > 0,
    },
    {
      id: "review-billing-credits",
      title: "Review billing and credits",
      detail: "Check the billing hub and marketplace credits before the first document is opened.",
      href: "/billing",
      done: true,
    },
    {
      id: "create-first-jobsite",
      title: "Create the first jobsite",
      detail: "Add the first active site so jobsite assignment and document routing have a home.",
      href: "/jobsites",
      done: jobsites.length > 0,
    },
  ] as const;

  const stagingSmokeTestItems = [
    {
      id: "smoke-signup",
      title: "Signup flow",
      detail: "Create a company request and confirm the approval handoff works cleanly.",
      href: "/company-signup",
    },
    {
      id: "smoke-onboarding",
      title: "Onboarding flow",
      detail: "Open company setup and confirm the workspace landing path reads clearly.",
      href: "/company-setup",
    },
    {
      id: "smoke-first-document",
      title: "First document flow",
      detail: "Submit a document and confirm it reaches the queue and the review path.",
      href: "/submit",
    },
    {
      id: "smoke-billing",
      title: "Billing flow",
      detail: "Open billing hub and purchases to verify credits, invoices, and top-ups load.",
      href: "/billing",
    },
  ] as const;

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
            : `${user.role} · ${scopeTeam}.`,
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

      if (roleNeedsAssignments(editRole)) {
        const assignmentResponse = await fetch("/api/company/jobsite-assignments", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: editingUser.id,
            jobsiteIds: editAssignments,
          }),
        });
        const assignmentData = (await assignmentResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!assignmentResponse.ok) {
          setMessageTone("error");
          setMessage(assignmentData?.error || "User updated, but jobsite assignment update failed.");
          setSaveLoading(false);
          return;
        }
      }

      setEditingUser(null);
      setMessageTone("success");
      setMessage("Company user updated.");
      await loadUsers({ preserveMessage: true });
      await loadAssignmentData();
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
        title="Workforce Operations"
        description={`Each person’s role (user type) determines what they can do in the app. Your company’s subscription sets which products and tiers the workspace uses overall. Jobsite titles on each person’s Construction profile are separate.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/training-matrix"
              className="rounded-xl border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-950/50"
            >
              Training matrix
            </Link>
            <Link
              href="/billing"
              className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/15"
            >
              Billing hub
            </Link>
            <Link
              href="/purchases"
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15"
            >
              Buy credits
            </Link>
            <button
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {inviteLoading ? "Sending Invite..." : "Invite Employee"}
            </button>
          </div>
        }
      />

      <SectionCard
        title="How company access works"
        description="Assign each person a role (user type). That role’s standard capabilities apply to them—there are no separate manual feature assignments per user."
      >
        <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-slate-400">
          <li>
            <span className="font-semibold text-slate-200">Role</span> (Company Admin, Field User, Read Only, etc.)
            defines in-app permissions for documents, safety modules, and billing visibility. Pick the role that matches
            how this person should work.
          </li>
          <li>
            <span className="font-semibold text-slate-200">Company subscription</span> (active license, CSEP vs full
            workspace) applies to the whole organization and sets which products are available.
          </li>
          <li>
            <span className="font-semibold text-slate-200">Company Admins</span> manage roles and membership here.
            Super admins do not need to hand-pick individual features per employee.
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        title="Launch checklist"
        description="Use this after approval so the first week stays on track."
        aside={
          <StatusBadge
            label={`${launchChecklistItems.filter((item) => item.done).length}/${launchChecklistItems.length} complete`}
            tone={launchChecklistItems.every((item) => item.done) ? "success" : "info"}
          />
        }
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {launchChecklistItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-sky-500/35 hover:bg-sky-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Company onboarding
                  </div>
                  <div className="mt-2 text-base font-bold text-slate-100">{item.title}</div>
                </div>
                <StatusBadge label={item.done ? "Done" : "Next"} tone={item.done ? "success" : "warning"} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.detail}</p>
              <div className="mt-4 text-sm font-semibold text-sky-300">
                {item.done ? "Review again" : "Open now"}
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Staging smoke test"
        description="Run these checks in staging before launch so signup, onboarding, and document flow are ready."
        aside={<StatusBadge label="Launch QA" tone="info" />}
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {stagingSmokeTestItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-sky-500/35 hover:bg-sky-950/30"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Smoke test
              </div>
              <div className="mt-2 text-base font-bold text-slate-100">{item.title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.detail}</p>
              <div className="mt-4 text-sm font-semibold text-sky-300">Open now</div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <section className="grid gap-5 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">
              {loading ? "-" : item.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Link href="/jobsites" className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm transition hover:border-sky-500/35">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Jobsites</div>
          <div className="mt-2 text-lg font-bold text-slate-100">Assignment Readiness</div>
          <div className="mt-2 text-sm text-slate-500">Coordinate workforce coverage and field ownership by active jobsite.</div>
        </Link>
        <Link href="/field-id-exchange" className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm transition hover:border-sky-500/35">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Corrective Actions</div>
          <div className="mt-2 text-lg font-bold text-slate-100">Ownership Queue</div>
          <div className="mt-2 text-sm text-slate-500">Track who is accountable for open and overdue corrective actions.</div>
        </Link>
        <Link href="/field-id-exchange" className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm transition hover:border-sky-500/35">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Safety Review</div>
          <div className="mt-2 text-lg font-bold text-slate-100">Submission Review Queue</div>
          <div className="mt-2 text-sm text-slate-500">Review pending individual safety submissions and keep actions moving.</div>
        </Link>
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
            body: "Review the pending employee here, approve them, and assign the correct role for their job.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-300">
                {item.step}
              </div>
              <div>
                <div className="text-base font-bold text-white">{item.title}</div>
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
            <div className="grid gap-2">
              <label htmlFor="invite-email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                placeholder="Employee email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="invite-role" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role (user type)
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className={appNativeSelectClassName}
              >
                {roleOptions.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
            Company workspace: <span className="font-semibold text-slate-100">{scopeCompanyName}</span>
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
        title="Invited employees"
        description="These employees have been invited but have not finished creating their account yet."
      >
        {loading ? (
          <InlineMessage>Loading invited employees...</InlineMessage>
        ) : invites.length === 0 ? (
          <EmptyState
            title="No invites are waiting"
            description="After you invite someone, they stay here until they use that email to create their company account."
          />
        ) : (
          <div className="grid gap-4">
            {invites.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{invite.email}</p>
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
        title="Awaiting approval"
        description="Employees who finished account setup stay here until you approve access to the company workspace."
      >
        {loading ? (
          <InlineMessage>Loading approval queue...</InlineMessage>
        ) : pendingUsers.length === 0 ? (
          <EmptyState
            title="No employees are waiting for approval"
            description="Employees move here after they create their account with the invited email."
          />
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map((user) => (
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
                      <span>Company: {scopeCompanyName}</span>
                      <span>Created {formatRelative(user.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={getProfileHref(user.id)}
                      className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={() => void handleQuickStatus(user, "Active")}
                      disabled={saveLoading}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setEditRole(user.role);
                        setEditAssignments(assignmentMap[user.id] ?? []);
                        setEditStatus("Pending");
                      }}
                      className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => void handleQuickStatus(user, "Suspended")}
                      disabled={saveLoading}
                      className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-950/40 disabled:opacity-60"
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
            className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
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
              <div key={user.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
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
                        setEditAssignments(assignmentMap[user.id] ?? []);
                      setEditStatus(
                        user.status === "Pending"
                          ? "Pending"
                          : user.status === "Suspended"
                            ? "Suspended"
                            : "Active"
                      );
                    }}
                    className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
                  >
                    Manage
                  </button>
                  <Link
                    href={getProfileHref(user.id)}
                    className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="4. Jobsite Assignments"
        description="At-a-glance view of which users are assigned to each active jobsite."
      >
        {loading ? (
          <InlineMessage>Loading assignment matrix...</InlineMessage>
        ) : filteredTeamMembers.length === 0 ? (
          <EmptyState
            title="No team members available"
            description="Invite and activate users to start assigning jobsites."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-950/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300">User</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300">Role</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300">Assigned Jobsites</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-300">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeamMembers.map((user) => {
                  const assignedIds = assignmentMap[user.id] ?? [];
                  const assignedNames = assignedIds
                    .map((id) => jobsiteNameById[id] ?? "Unknown jobsite")
                    .slice(0, 3);
                  const overflowCount = Math.max(0, assignedIds.length - assignedNames.length);
                  return (
                    <tr key={`assignment-${user.id}`} className="bg-slate-900/90">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-100">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleClasses(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge label={user.status} tone={statusTone(user.status)} />
                      </td>
                      <td className="px-3 py-3">
                        {roleNeedsAssignments(user.role) ? (
                          assignedIds.length > 0 ? (
                            <div className="text-xs text-slate-300">
                              {assignedNames.join(", ")}
                              {overflowCount > 0 ? ` +${overflowCount} more` : ""}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-700">No jobsites assigned</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-500">Company-wide (all jobsites)</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setEditRole(user.role);
                            setEditAssignments(assignmentMap[user.id] ?? []);
                            setEditStatus(
                              user.status === "Pending"
                                ? "Pending"
                                : user.status === "Suspended"
                                  ? "Suspended"
                                  : "Active"
                            );
                          }}
                          className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-950/50"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                <div key={user.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
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
                        setEditAssignments(assignmentMap[user.id] ?? []);
                        setEditStatus("Suspended");
                      }}
                      className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
                    >
                      Manage
                    </button>
                    <Link
                      href={getProfileHref(user.id)}
                      className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-900/90"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 [color-scheme:dark]">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl [color-scheme:dark]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
                  Manage Team Member
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-100">{editingUser.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
                Company scope: <span className="font-semibold text-slate-100">{scopeCompanyName}</span>
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-member-role" className="text-xs font-semibold text-slate-500">
                  Role (user type)
                </label>
                <select
                  id="edit-member-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className={`w-full ${appNativeSelectClassName} py-3`}
                >
                  {roleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-member-status" className="text-xs font-semibold text-slate-500">
                  Status
                </label>
                <select
                  id="edit-member-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className={`w-full ${appNativeSelectClassName} py-3`}
                >
                  <option>Pending</option>
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              </div>
              {roleNeedsAssignments(editRole) ? (
                <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-100">
                    Assigned Jobsites
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    For this role, limit which jobsites they see below. In-app features still follow the role type and
                    your company subscription.
                  </p>
                  <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto">
                    {jobsites.length < 1 ? (
                      <p className="text-xs text-slate-500">No jobsites available yet.</p>
                    ) : (
                      jobsites.map((jobsite) => {
                        const checked = editAssignments.includes(jobsite.id);
                        return (
                          <label
                            key={jobsite.id}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                setEditAssignments((current) =>
                                  event.target.checked
                                    ? [...current, jobsite.id]
                                    : current.filter((value) => value !== jobsite.id)
                                );
                              }}
                            />
                            <span>{jobsite.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Link
                href={getProfileHref(editingUser.id)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
              >
                Edit Profile
              </Link>
              <button
                onClick={() => void handleRemoveUser()}
                disabled={removeLoading}
                className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-950/40 disabled:opacity-60"
              >
                {removeLoading ? "Removing..." : "Remove User"}
              </button>
              <button
                onClick={() => void handleSaveUser()}
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
