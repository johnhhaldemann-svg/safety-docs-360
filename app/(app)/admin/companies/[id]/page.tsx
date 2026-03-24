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

type CompanyDetail = {
  id: string;
  name: string;
  teamKey: string;
  industry: string;
  phone: string;
  website: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  primaryContactName: string;
  primaryContactEmail: string;
  status: string;
  createdAt?: string | null;
  archivedAt?: string | null;
  archivedByEmail?: string;
  restoredAt?: string | null;
  restoredByEmail?: string;
};

type CompanySummary = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  pendingInvites: number;
  completedDocuments: number;
  submittedDocuments: number;
};

type CompanyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
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

type CompanyDocument = {
  id: string;
  title: string;
  projectName: string;
  type: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  hasFinalFile: boolean;
  userId?: string | null;
};

type CompanyActivityItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: "info" | "warning" | "success" | "neutral";
};

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.max(1, Math.round(diffDays / 30));
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return "success";
  if (normalized === "archived" || normalized === "pending") return "warning";
  if (normalized === "suspended") return "error";
  return "neutral";
}

export default function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [companyId, setCompanyId] = useState("");
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [activity, setActivity] = useState<CompanyActivityItem[]>([]);
  const [warning, setWarning] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error" | "neutral">(
    "neutral"
  );
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    void params.then((resolved) => setCompanyId(resolved.id));
  }, [params]);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${companyId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            company?: CompanyDetail;
            summary?: CompanySummary;
            users?: CompanyUser[];
            invites?: CompanyInvite[];
            documents?: CompanyDocument[];
            activity?: CompanyActivityItem[];
            warning?: string | null;
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to load company workspace.");
        setCompany(null);
        setSummary(null);
        setUsers([]);
        setInvites([]);
        setDocuments([]);
        setActivity([]);
        setWarning("");
        setLoading(false);
        return;
      }

      setCompany(data?.company ?? null);
      setSummary(data?.summary ?? null);
      setUsers(data?.users ?? []);
      setInvites(data?.invites ?? []);
      setDocuments(data?.documents ?? []);
      setActivity(data?.activity ?? []);
      setWarning(data?.warning ?? "");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load company workspace.");
      setCompany(null);
      setSummary(null);
      setUsers([]);
      setInvites([]);
      setDocuments([]);
      setActivity([]);
      setWarning("");
    }

    setLoading(false);
  }, [companyId]);

  const handleCompanyAction = useCallback(
    async (action: "archive" | "restore") => {
      if (!company) return;

      setProcessingAction(true);
      setMessage("");

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.access_token) {
          setMessageTone("error");
          setMessage("You must be logged in as an internal admin.");
          setProcessingAction(false);
          return;
        }

        const res = await fetch("/api/admin/companies", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companyId: company.id,
            action,
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              message?: string;
            }
          | null;

        if (!res.ok) {
          setMessageTone("error");
          setMessage(data?.error || "Failed to update company workspace.");
          setProcessingAction(false);
          return;
        }

        setMessageTone("success");
        setMessage(
          data?.message ||
            (action === "archive"
              ? "Company archived successfully."
              : "Company restored successfully.")
        );
        await loadCompany();
      } catch (error) {
        setMessageTone("error");
        setMessage(
          error instanceof Error ? error.message : "Failed to update company workspace."
        );
      }

      setProcessingAction(false);
    },
    [company, loadCompany]
  );

  useEffect(() => {
    if (!companyId) return;
    queueMicrotask(() => {
      void loadCompany();
    });
  }, [companyId, loadCompany]);

  const statCards = useMemo(
    () =>
      summary
        ? [
            {
              title: "Users",
              value: String(summary.totalUsers),
              note: `${summary.activeUsers} active, ${summary.suspendedUsers} suspended`,
            },
            {
              title: "Invites",
              value: String(summary.pendingInvites),
              note: `${summary.pendingUsers} pending people`,
            },
            {
              title: "Completed Docs",
              value: String(summary.completedDocuments),
              note: `${summary.submittedDocuments} still in review`,
            },
          ]
        : [],
    [summary]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Oversight"
        title={company?.name || "Company Workspace"}
        description="Review one customer workspace end to end, including people, invites, documents, and status."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/companies"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Companies
            </Link>
            {company ? (
              <button
                type="button"
                onClick={() =>
                  void handleCompanyAction(
                    company.status.trim().toLowerCase() === "archived"
                      ? "restore"
                      : "archive"
                  )
                }
                disabled={processingAction}
                className={
                  company.status.trim().toLowerCase() === "archived"
                    ? "rounded-xl border border-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    : "rounded-xl border border-amber-300 px-5 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                }
              >
                {processingAction
                  ? company.status.trim().toLowerCase() === "archived"
                    ? "Restoring..."
                    : "Archiving..."
                  : company.status.trim().toLowerCase() === "archived"
                    ? "Restore Workspace"
                    : "Archive Workspace"}
              </button>
            ) : null}
          </div>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      {warning ? <InlineMessage tone="warning">{warning}</InlineMessage> : null}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Workspace Profile"
          description="Primary contact, company identity, and current workspace status."
        >
          {loading ? (
            <InlineMessage>Loading company profile...</InlineMessage>
          ) : !company ? (
            <EmptyState
              title="Company not found"
              description="This workspace may have been removed or you may not have access."
            />
          ) : (
            <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Workspace
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">{company.name}</div>
                <div className="mt-1">Key: {company.teamKey}</div>
                <div className="mt-3">
                  <StatusBadge label={company.status} tone={statusTone(company.status)} />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Primary Contact
                </div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {company.primaryContactName || "Not provided"}
                </div>
                <div className="mt-1">{company.primaryContactEmail || "Not provided"}</div>
                <div className="mt-1">{company.phone || "No phone on file"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Company Details
                </div>
                <div className="mt-2">Industry: {company.industry || "Not provided"}</div>
                <div className="mt-1">Website: {company.website || "Not provided"}</div>
                <div className="mt-1">Created {formatRelative(company.createdAt)}</div>
                {company.archivedAt ? (
                  <div className="mt-1">
                    Archived {formatRelative(company.archivedAt)}
                    {company.archivedByEmail ? ` by ${company.archivedByEmail}` : ""}
                  </div>
                ) : null}
                {company.restoredAt ? (
                  <div className="mt-1">
                    Restored {formatRelative(company.restoredAt)}
                    {company.restoredByEmail ? ` by ${company.restoredByEmail}` : ""}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Address
                </div>
                <div className="mt-2">
                  {[
                    company.addressLine1,
                    company.city,
                    company.stateRegion,
                    company.postalCode,
                    company.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not provided"}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <section className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
          {statCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
                {loading ? "-" : card.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{card.note}</p>
            </div>
          ))}
        </section>
      </section>

      <SectionCard
        title="Company Users"
        description="People attached to this company workspace right now."
      >
        {loading ? (
          <InlineMessage>Loading company users...</InlineMessage>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users in this workspace"
            description="Company admins and employees will appear here once they are linked to the workspace."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <div>User</div>
              <div>Role</div>
              <div>Status</div>
              <div>Last Seen</div>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr] gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600 first:border-t-0"
              >
                <div>
                  <div className="font-semibold text-slate-900">{user.name}</div>
                  <div className="mt-1 text-slate-500">{user.email || user.id}</div>
                </div>
                <div>{user.role}</div>
                <div>
                  <StatusBadge label={user.status} tone={statusTone(user.status)} />
                </div>
                <div>{formatRelative(user.last_sign_in_at ?? user.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <section className="grid gap-8 xl:grid-cols-2">
        <ActivityFeed
          title="Recent Company Activity"
          description="Latest workspace lifecycle events, invites, users, and document changes."
          items={
            loading
              ? [
                  {
                    id: "loading-activity",
                    title: "Loading company activity",
                    detail: "Recent workspace events will appear here in a moment.",
                    meta: "Working",
                    tone: "neutral",
                  },
                ]
              : activity.length > 0
                ? activity
                : [
                    {
                      id: "empty-activity",
                      title: "No recent activity yet",
                      detail: "Invites, user links, document updates, and lifecycle events will appear here.",
                      meta: "Waiting",
                      tone: "neutral",
                    },
                  ]
          }
        />

        <SectionCard
          title="Archive History"
          description="Audit trail for workspace lifecycle changes."
        >
          {loading ? (
            <InlineMessage>Loading archive history...</InlineMessage>
          ) : !company ? (
            <EmptyState
              title="No company history available"
              description="This company workspace could not be loaded."
            />
          ) : !company.archivedAt && !company.restoredAt ? (
            <EmptyState
              title="No archive events yet"
              description="Archive and restore actions will appear here once this workspace lifecycle changes."
            />
          ) : (
            <div className="space-y-3">
              {company.archivedAt ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="font-semibold text-slate-900">Workspace archived</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatRelative(company.archivedAt)}
                    {company.archivedByEmail ? ` by ${company.archivedByEmail}` : ""}
                  </div>
                </div>
              ) : null}
              {company.restoredAt ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="font-semibold text-slate-900">Workspace restored</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatRelative(company.restoredAt)}
                    {company.restoredByEmail ? ` by ${company.restoredByEmail}` : ""}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pending Invites"
          description="Invites still waiting to be claimed or accepted."
        >
          {loading ? (
            <InlineMessage>Loading invites...</InlineMessage>
          ) : invites.length === 0 ? (
            <EmptyState
              title="No pending invites"
              description="Outstanding company invites will appear here."
            />
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{invite.email}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {invite.role} invited {formatRelative(invite.created_at)}
                      </div>
                    </div>
                    <StatusBadge label={invite.status} tone={statusTone(invite.status)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Company Documents"
          description="Submitted and completed documents linked to this workspace."
        >
          {loading ? (
            <InlineMessage>Loading company documents...</InlineMessage>
          ) : documents.length === 0 ? (
            <EmptyState
              title="No company documents yet"
              description="Submitted and approved records will appear here once the company starts using the workspace."
            />
          ) : (
            <div className="space-y-3">
              {documents.slice(0, 12).map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{document.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {document.projectName || "No project"} · {document.type || "Document"} ·{" "}
                        {formatRelative(document.updatedAt ?? document.createdAt)}
                      </div>
                    </div>
                    <StatusBadge label={document.status} tone={statusTone(document.status)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
