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
import type { PermissionMap } from "@/lib/rbac";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DocumentRow = {
  id: string;
  created_at: string;
  archived_at?: string | null;
  archived_by_email?: string | null;
  restored_at?: string | null;
  restored_by_email?: string | null;
  project_name: string | null;
  document_type: string | null;
  status: string | null;
  final_file_path?: string | null;
};

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  status: string;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

function isArchivedStatus(status?: string | null) {
  return status?.trim().toLowerCase() === "archived";
}

function formatRelative(timestamp?: string | null) {
  if (!timestamp) return "Updated recently";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getDocumentTitle(doc: DocumentRow) {
  return doc.project_name ?? doc.document_type ?? "Untitled Document";
}

export default function AdminPage() {
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState("");

  const loadUsers = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      setUserError("Admin session not available for user approvals.");
      return;
    }

    const res = await fetch("/api/admin/users", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = (await res.json().catch(() => null)) as
      | { error?: string; users?: AdminUserRow[] }
      | null;

    if (!res.ok) {
      setUserError(data?.error || "Failed to load user approvals.");
      setUsers([]);
      return;
    }

    setUserError("");
    setUsers(data?.users ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;

      if (accessToken) {
        const meResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const meData = (await meResponse.json().catch(() => null)) as
          | { user?: { permissionMap?: PermissionMap } }
          | null;

        if (meResponse.ok) {
          setPermissionMap(meData?.user?.permissionMap ?? null);
        }
      }

      const { data, error } = await supabase
        .from("documents")
        .select(
          "id,created_at,archived_at,archived_by_email,restored_at,restored_by_email,project_name,document_type,status,final_file_path"
        )
        .order("created_at", { ascending: false })
        .range(0, 199);

      if (error) {
        console.error("Admin dashboard load error:", error.message);
      } else {
        setDocuments(data ?? []);
      }

      await loadUsers();
      setLoading(false);
    })();
  }, [loadUsers]);

  const activeDocuments = useMemo(
    () => documents.filter((doc) => !isArchivedStatus(doc.status)),
    [documents]
  );

  const pendingReview = useMemo(
    () =>
      activeDocuments.filter(
        (doc) => doc.status?.trim().toLowerCase() === "submitted"
      ),
    [activeDocuments]
  );

  const approvedDocuments = useMemo(
    () =>
      activeDocuments.filter(
        (doc) =>
          doc.status?.trim().toLowerCase() === "approved" ||
          Boolean(doc.final_file_path)
      ),
    [activeDocuments]
  );

  const archivedDocuments = useMemo(
    () => documents.filter((doc) => isArchivedStatus(doc.status)),
    [documents]
  );

  const pendingUsers = useMemo(
    () =>
      users
        .filter((user) => user.status === "Pending")
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        ),
    [users]
  );

  const activeTodayUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!user.last_sign_in_at) return false;
        const lastSeen = new Date(user.last_sign_in_at);
        const today = new Date();
        return (
          lastSeen.getFullYear() === today.getFullYear() &&
          lastSeen.getMonth() === today.getMonth() &&
          lastSeen.getDate() === today.getDate()
        );
      }),
    [users]
  );

  const stats = useMemo(
    () => [
      {
        title: "Documents Waiting Review",
        value: String(pendingReview.length),
        note: pendingReview.length ? "Items need admin action" : "Review queue is clear",
      },
      {
        title: "Approved Files",
        value: String(approvedDocuments.length),
        note: "Final documents available to users",
      },
      {
        title: "Pending User Approval",
        value: String(pendingUsers.length),
        note: pendingUsers.length ? "Accounts need approval" : "No waiting users",
      },
      {
        title: "Archive Count",
        value: String(archivedDocuments.length),
        note: archivedDocuments.length ? "Records moved out of workflow" : "Archive is clear",
      },
    ],
    [approvedDocuments.length, archivedDocuments.length, pendingReview.length, pendingUsers.length]
  );

  const documentQueue = useMemo(
    () =>
      pendingReview.slice(0, 5).map((doc) => ({
        id: doc.id,
        title: getDocumentTitle(doc),
        detail: doc.document_type ?? "Document review",
        meta: "Needs review",
        tone: "warning" as const,
      })),
    [pendingReview]
  );

  const userQueue = useMemo(
    () =>
      pendingUsers.slice(0, 5).map((user) => ({
        id: user.id,
        title: user.name,
        detail: `${user.role} in ${user.team}`,
        meta: formatRelative(user.created_at),
        tone: "warning" as const,
      })),
    [pendingUsers]
  );

  const recentAccess = useMemo(
    () =>
      users
        .map((user) => ({
          id: user.id,
          sortAt: new Date(user.last_sign_in_at ?? user.created_at ?? 0).getTime(),
          title: user.last_sign_in_at
            ? `${user.name} signed in`
            : `${user.name} created an account`,
          detail: user.last_sign_in_at
            ? `${user.role} access in ${user.team}.`
            : user.status === "Pending"
              ? "Waiting for admin approval before workspace access opens."
              : `${user.role} account added to ${user.team}.`,
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

  const recentAdminActivity = useMemo(
    () =>
      documents
        .flatMap((doc) => {
          const title = getDocumentTitle(doc);
          const items: Array<{
            id: string;
            title: string;
            detail: string;
            meta: string;
            tone: "info" | "warning" | "success";
            sortAt: number;
          }> = [
            {
              id: `${doc.id}-created`,
              title: `${title} updated`,
              detail: "Workflow activity recorded from the active document pipeline.",
              meta: formatRelative(doc.created_at),
              tone: "info" as const,
              sortAt: new Date(doc.created_at).getTime(),
            },
          ];

          if (doc.archived_at) {
            items.push({
              id: `${doc.id}-archived`,
              title: `${title} archived`,
              detail: `Archived by ${doc.archived_by_email ?? "an admin"}.`,
              meta: formatRelative(doc.archived_at),
              tone: "warning" as const,
              sortAt: new Date(doc.archived_at).getTime(),
            });
          }

          if (doc.restored_at) {
            items.push({
              id: `${doc.id}-restored`,
              title: `${title} restored`,
              detail: `Restored by ${doc.restored_by_email ?? "an admin"}.`,
              meta: formatRelative(doc.restored_at),
              tone: "success" as const,
              sortAt: new Date(doc.restored_at).getTime(),
            });
          }

          return items;
        })
        .sort((a, b) => b.sortAt - a.sortAt)
        .slice(0, 6)
        .map(({ id, title, detail, meta, tone }) => ({
          id,
          title,
          detail,
          meta,
          tone,
        })),
    [documents]
  );

  const recentlyArchived = useMemo(
    () =>
      archivedDocuments
        .filter((doc) => Boolean(doc.archived_at))
        .sort(
          (a, b) =>
            new Date(b.archived_at ?? b.created_at).getTime() -
            new Date(a.archived_at ?? a.created_at).getTime()
        )
        .slice(0, 3),
    [archivedDocuments]
  );
  const canAssignRoles = Boolean(permissionMap?.can_assign_roles);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Administration"
        title="Admin Dashboard"
        description="Review submitted drafts, approve final documents, monitor user access, and keep the workspace operating smoothly from one admin-focused hub."
        actions={
          <>
            <Link
              href="/admin/review-documents"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Open Review Queue
            </Link>
            {canAssignRoles ? (
              <Link
                href="/admin/users"
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Manage Users
              </Link>
            ) : null}
            <Link
              href="/admin/companies"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Companies
            </Link>
          </>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-6 xl:grid-cols-2">
        <ActivityFeed
          title="Document Queue"
          description="Documents currently waiting for admin action."
          items={
            documentQueue.length > 0
              ? documentQueue
              : [
                  {
                    id: "empty-doc-queue",
                    title: "No documents are waiting for review",
                    detail: "Submitted files will appear here as soon as they need approval.",
                    meta: "Clear",
                    tone: "success",
                  },
                ]
          }
        />

        {canAssignRoles ? (
          <ActivityFeed
            title="User Approval Queue"
            description="Accounts that cannot access the workspace until an admin activates them."
            items={
              userQueue.length > 0
                ? userQueue
                : [
                    {
                      id: "empty-user-queue",
                      title: "No users are waiting for approval",
                      detail: "New signups and invited users will appear here until approved.",
                      meta: "Clear",
                      tone: "success",
                    },
                  ]
            }
          />
        ) : (
          <SectionCard
            title="User Approval Queue"
            description="Role assignment and account approval are limited to higher-permission admin roles."
          >
            <InlineMessage tone="warning">
              Your current admin role can review documents, but it cannot approve user access or assign roles.
            </InlineMessage>
          </SectionCard>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ActivityFeed
          title="Recent Access Activity"
          description="Latest sign-ins and newly created accounts."
          items={
            recentAccess.length > 0
              ? recentAccess
              : [
                  {
                    id: "no-access",
                    title: "No access activity yet",
                    detail: "User sign-ins and new account creation will appear here.",
                    meta: "Waiting",
                    tone: "neutral",
                  },
                ]
          }
        />

        <ActivityFeed
          title="Recent Admin Activity"
          description="Latest workflow changes across review, archive, and restoration."
          items={
            recentAdminActivity.length > 0
              ? recentAdminActivity
              : [
                  {
                    id: "no-admin-activity",
                    title: "No admin activity yet",
                    detail: "Review, archive, and final-file events will appear here.",
                    meta: "Waiting",
                    tone: "neutral",
                  },
                ]
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Admin Focus"
          description="The biggest operational items to watch first."
        >
          {canAssignRoles && userError ? <InlineMessage tone="warning">{userError}</InlineMessage> : null}
          <div className="space-y-3">
            {canAssignRoles ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">Pending user approvals</span>
                  <StatusBadge
                    label={pendingUsers.length ? `${pendingUsers.length} waiting` : "Clear"}
                    tone={pendingUsers.length ? "warning" : "success"}
                  />
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">Documents waiting review</span>
                <StatusBadge
                  label={pendingReview.length ? `${pendingReview.length} queued` : "Clear"}
                  tone={pendingReview.length ? "warning" : "success"}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">Users active today</span>
                <StatusBadge
                  label={`${activeTodayUsers.length} active`}
                  tone={activeTodayUsers.length ? "info" : "neutral"}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Archive Snapshot"
          description="Most recent documents moved out of the active workflow."
          aside={
            <Link
              href="/admin/archive"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open Archive
            </Link>
          }
        >
          {recentlyArchived.length === 0 ? (
            <EmptyState
              title="No archive activity yet"
              description="Archived documents will appear here after records are moved out of the active workflow."
            />
          ) : (
            <div className="space-y-3">
              {recentlyArchived.map((doc) => (
                <div key={doc.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{getDocumentTitle(doc)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Archived {formatRelative(doc.archived_at ?? doc.created_at)} by{" "}
                    {doc.archived_by_email ?? "Unknown admin"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
