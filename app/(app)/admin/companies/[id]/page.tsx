"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { PermissionOverridesEditor } from "@/components/PermissionOverridesEditor";
import {
  normalizePermissionOverrides,
  type PermissionOverrides,
} from "@/lib/permissionOverrides";

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
  permissionOverrides?: PermissionOverrides;
  hasAccessOverrides?: boolean;
  hasPricingOverrides?: boolean;
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

type CompanySubscriptionSummary = {
  status: string;
  planName: string;
  creditBalance: number | null;
  maxUserSeats: number | null;
  subscriptionPriceCents: number | null;
  seatPriceCents: number | null;
  seatsUsed: number;
  membershipSeats: number;
  pendingInviteCount: number;
};

function formatCents(cents: number | null) {
  if (cents == null) {
    return "Default";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

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
  if (normalized === "active" || normalized === "approved") return "success";
  if (normalized === "archived" || normalized === "pending") return "warning";
  if (normalized === "suspended") return "error";
  return "neutral";
}

export default function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [activity, setActivity] = useState<CompanyActivityItem[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error" | "neutral">(
    "neutral"
  );
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);
  const [canPermanentlyDeleteCompanies, setCanPermanentlyDeleteCompanies] = useState(false);
  const [canManageCompanySubscription, setCanManageCompanySubscription] = useState(false);
  const [canOverrideCompanyPricing, setCanOverrideCompanyPricing] = useState(false);
  const [canManageCompanyPermissions, setCanManageCompanyPermissions] = useState(false);
  const [subscription, setSubscription] = useState<CompanySubscriptionSummary | null>(null);
  const [subStatusDraft, setSubStatusDraft] = useState("inactive");
  const [subPlanDraft, setSubPlanDraft] = useState("Pro");
  const [subMaxSeatsDraft, setSubMaxSeatsDraft] = useState("");
  const [subSubscriptionPriceDraft, setSubSubscriptionPriceDraft] = useState("");
  const [subSeatPriceDraft, setSubSeatPriceDraft] = useState("");
  const [companyPermissionDraft, setCompanyPermissionDraft] = useState<PermissionOverrides>({
    allow: [],
    deny: [],
  });
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingCompanyPermissions, setSavingCompanyPermissions] = useState(false);
  const [creatingBillingDraft, setCreatingBillingDraft] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingCompany, setDeletingCompany] = useState(false);

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
            capabilities?: {
              canPermanentlyDeleteCompanies?: boolean;
              canManageCompanySubscription?: boolean;
              canOverrideCompanyPricing?: boolean;
              canManageCompanyPermissions?: boolean;
            };
            subscription?: CompanySubscriptionSummary;
            company?: CompanyDetail;
            summary?: CompanySummary;
            users?: CompanyUser[];
            invites?: CompanyInvite[];
            documents?: CompanyDocument[];
            activity?: CompanyActivityItem[];
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
        setCanPermanentlyDeleteCompanies(false);
        setCanManageCompanySubscription(false);
        setCanOverrideCompanyPricing(false);
        setCanManageCompanyPermissions(false);
        setSubscription(null);
        setCompanyPermissionDraft({ allow: [], deny: [] });
        setLoading(false);
        return;
      }

      setCanPermanentlyDeleteCompanies(
        Boolean(data?.capabilities?.canPermanentlyDeleteCompanies)
      );
      setCanManageCompanySubscription(
        Boolean(data?.capabilities?.canManageCompanySubscription)
      );
      setCanOverrideCompanyPricing(Boolean(data?.capabilities?.canOverrideCompanyPricing));
      setCanManageCompanyPermissions(
        Boolean(data?.capabilities?.canManageCompanyPermissions)
      );
      const sub = data?.subscription;
      if (sub) {
        setSubscription(sub);
        setSubStatusDraft(sub.status);
        setSubPlanDraft(sub.planName);
        setSubMaxSeatsDraft(sub.maxUserSeats != null ? String(sub.maxUserSeats) : "");
        setSubSubscriptionPriceDraft(
          sub.subscriptionPriceCents != null ? String(sub.subscriptionPriceCents) : ""
        );
        setSubSeatPriceDraft(sub.seatPriceCents != null ? String(sub.seatPriceCents) : "");
      } else {
        setSubscription(null);
      }
      setCompany(data?.company ?? null);
      setCompanyPermissionDraft(
        normalizePermissionOverrides(data?.company?.permissionOverrides ?? null)
      );
      setSummary(data?.summary ?? null);
      setUsers(data?.users ?? []);
      setInvites(data?.invites ?? []);
      setDocuments(data?.documents ?? []);
      setActivity(data?.activity ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load company workspace.");
      setCompany(null);
      setSummary(null);
      setUsers([]);
      setInvites([]);
      setDocuments([]);
      setActivity([]);
      setCanOverrideCompanyPricing(false);
      setCanManageCompanyPermissions(false);
      setCompanyPermissionDraft({ allow: [], deny: [] });
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

  const handleSaveSubscription = useCallback(async () => {
    if (!companyId) return;

    setSavingSubscription(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setSavingSubscription(false);
        return;
      }

      const maxParsed = subMaxSeatsDraft.trim();
      const maxUserSeats =
        maxParsed === "" ? null : parseInt(maxParsed, 10);
      if (
        maxUserSeats !== null &&
        (!Number.isFinite(maxUserSeats) || maxUserSeats < 1)
      ) {
        setMessageTone("error");
        setMessage("Max users must be blank (unlimited) or a whole number ≥ 1.");
        setSavingSubscription(false);
        return;
      }

      const subscriptionPriceParsed = subSubscriptionPriceDraft.trim();
      const subscriptionPriceCents =
        subscriptionPriceParsed === "" ? null : parseInt(subscriptionPriceParsed, 10);
      const seatPriceParsed = subSeatPriceDraft.trim();
      const seatPriceCents = seatPriceParsed === "" ? null : parseInt(seatPriceParsed, 10);
      if (
        [subscriptionPriceCents, seatPriceCents].some(
          (value) => value !== null && (!Number.isFinite(value) || value < 0)
        )
      ) {
        setMessageTone("error");
        setMessage("Pricing overrides must be blank or a whole number of cents ≥ 0.");
        setSavingSubscription(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscriptionStatus: subStatusDraft,
          planName: subPlanDraft.trim() || "Pro",
          maxUserSeats,
          ...(canOverrideCompanyPricing
            ? {
                subscriptionPriceCents,
                seatPriceCents,
              }
            : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to save subscription settings.");
        setSavingSubscription(false);
        return;
      }

      setMessageTone("success");
      setMessage("Subscription settings saved.");
      await loadCompany();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to save subscription settings.");
    }

    setSavingSubscription(false);
  }, [
    companyId,
    canOverrideCompanyPricing,
    loadCompany,
    subMaxSeatsDraft,
    subPlanDraft,
    subSeatPriceDraft,
    subSubscriptionPriceDraft,
    subStatusDraft,
  ]);

  const handleSaveCompanyPermissions = useCallback(async () => {
    if (!companyId) return;

    setSavingCompanyPermissions(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setSavingCompanyPermissions(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          permissionOverrides: companyPermissionDraft,
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to save company access rules.");
        setSavingCompanyPermissions(false);
        return;
      }

      setMessageTone("success");
      setMessage("Company access rules saved.");
      await loadCompany();
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to save company access rules.");
    }

    setSavingCompanyPermissions(false);
  }, [companyId, companyPermissionDraft, loadCompany]);

  const handleCreateBillingDraft = useCallback(async () => {
    if (!companyId) return;

    setCreatingBillingDraft(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setCreatingBillingDraft(false);
        return;
      }

      const res = await fetch("/api/billing/company-invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_id: companyId,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            invoice?: { id?: string };
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to create billing draft.");
        setCreatingBillingDraft(false);
        return;
      }

      setMessageTone("success");
      setMessage("Billing draft created.");

      if (data?.invoice?.id) {
        router.push(`/billing/invoices/${data.invoice.id}`);
      }
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to create billing draft.");
    }

    setCreatingBillingDraft(false);
  }, [companyId, router]);

  const handlePermanentDelete = useCallback(async () => {
    if (!company) return;

    setDeletingCompany(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setDeletingCompany(false);
        return;
      }

      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirmName: deleteConfirmName.trim() }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to delete company workspace.");
        setDeletingCompany(false);
        return;
      }

      setMessageTone("success");
      setMessage(data?.message || "Company removed.");
      setDeleteConfirmOpen(false);
      setDeleteConfirmName("");
      router.push("/admin/companies");
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Failed to delete company workspace.");
    }

    setDeletingCompany(false);
  }, [company, deleteConfirmName, router]);

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

  const canGenerateBillingDraft =
    Boolean(subscription) &&
    (subscription?.subscriptionPriceCents != null || subscription?.seatPriceCents != null);

  const pricingSummary = useMemo(() => {
    if (!subscription) {
      return null;
    }

    return {
      status: subscription.status,
      planName: subscription.planName,
      subscriptionPrice: formatCents(subscription.subscriptionPriceCents),
      seatPrice: formatCents(subscription.seatPriceCents),
      maxUsers: subscription.maxUserSeats != null ? String(subscription.maxUserSeats) : "Unlimited",
      creditBalance: subscription.creditBalance ?? null,
    };
  }, [subscription]);

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
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
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
                    ? "rounded-xl border border-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-60"
                    : "rounded-xl border border-amber-300 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/40 disabled:cursor-not-allowed disabled:opacity-60"
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
            {company && canPermanentlyDeleteCompanies ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(true);
                  setDeleteConfirmName("");
                }}
                disabled={processingAction || deletingCompany}
                className="rounded-xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete from database
              </button>
            ) : null}
          </div>
        }
      />

      {deleteConfirmOpen && company ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-company-title"
          >
            <h2
              id="delete-company-title"
              className="text-lg font-bold text-slate-100"
            >
              Permanently delete this workspace?
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              This removes the company row and related workspace data (memberships, invites, jobsites,
              safety data, documents, and billing rows). Former members are reset to Viewer in{" "}
              <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">user_roles</code> when their
              profile was tied to this company. This cannot be undone.
            </p>
            <p className="mt-3 text-sm font-medium text-slate-200">
              Type the workspace name to confirm:{" "}
              <span className="font-bold text-slate-100">{company.name}</span>
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-100 outline-none ring-slate-400 focus:ring-2"
              placeholder="Workspace name"
              autoComplete="off"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmName("");
                }}
                disabled={deletingCompany}
                className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePermanentDelete()}
                disabled={
                  deletingCompany ||
                  deleteConfirmName.trim() !== company.name.trim()
                }
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingCompany ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pricingSummary ? (
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Subscription
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">{pricingSummary.status}</div>
            <div className="mt-1 text-sm text-slate-500">{pricingSummary.planName}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pricing
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">
              Subscription {pricingSummary.subscriptionPrice}
            </div>
            <div className="mt-1 text-sm text-slate-500">Seat license {pricingSummary.seatPrice}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              License cap
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">{pricingSummary.maxUsers}</div>
            <div className="mt-1 text-sm text-slate-500">Licensed users allowed in the workspace</div>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Credits
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">
              {pricingSummary.creditBalance ?? "—"}
            </div>
            <div className="mt-1 text-sm text-slate-500">Marketplace credit balance tied to billing</div>
          </div>
        </section>
      ) : null}

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

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
            <div className="grid gap-4 text-sm text-slate-400 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Workspace
                </div>
                <div className="mt-2 text-lg font-bold text-slate-100">{company.name}</div>
                <div className="mt-1">Key: {company.teamKey}</div>
                <div className="mt-3">
                  <StatusBadge label={company.status} tone={statusTone(company.status)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {company.hasAccessOverrides ? (
                    <StatusBadge label="Access overrides active" tone="info" />
                  ) : null}
                  {company.hasPricingOverrides ? (
                    <StatusBadge label="Pricing overrides active" tone="warning" />
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Primary Contact
                </div>
                <div className="mt-2 text-base font-semibold text-slate-100">
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
            <div key={card.title} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-slate-100">
                {loading ? "-" : card.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{card.note}</p>
            </div>
          ))}
        </section>
      </section>

      <SectionCard
        title="Subscription, licenses & pricing"
        description="Activate billing access for this workspace, cap how many licensed users it can hold, and let Super Admins override pricing when needed."
      >
        {loading ? (
          <InlineMessage>Loading subscription…</InlineMessage>
        ) : !subscription ? (
          <EmptyState
            title="Subscription not loaded"
            description="Try refreshing the page. If this persists, check the company_subscriptions row in the database."
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Seat usage
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-100">
                  {subscription.seatsUsed}
                  {subscription.maxUserSeats != null
                    ? ` / ${subscription.maxUserSeats}`
                    : " / ∞"}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {subscription.membershipSeats} licensed members (active or pending approval) +{" "}
                  {subscription.pendingInviteCount} pending invite
                  {subscription.pendingInviteCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Document credits (company)
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-100">
                  {subscription.creditBalance != null ? subscription.creditBalance : "—"}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Balance stored on the company subscription row.
                </p>
              </div>
            </div>

            {canManageCompanySubscription ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Subscription status</span>
                  <select
                    value={subStatusDraft}
                    onChange={(e) => setSubStatusDraft(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Plan name</span>
                  <input
                    type="text"
                    value={subPlanDraft}
                    onChange={(e) => setSubPlanDraft(e.target.value)}
                    placeholder="Pro, CSEP, …"
                    className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-300">Max licensed users (optional)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={subMaxSeatsDraft}
                    onChange={(e) => setSubMaxSeatsDraft(e.target.value)}
                    placeholder="Blank = unlimited"
                    className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </label>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
                Current status:{" "}
                <span className="font-semibold text-slate-100">{subscription.status}</span>
                {" · "}
                Plan:{" "}
                <span className="font-semibold text-slate-100">{subscription.planName}</span>
                {subscription.maxUserSeats != null ? (
                  <>
                    {" "}
                    · Max licensed users:{" "}
                    <span className="font-semibold text-slate-100">
                      {subscription.maxUserSeats}
                    </span>
                  </>
                ) : null}
                . Only Super Admin, Platform Admin, or App Admin can change these settings.
              </div>
            )}

            {canOverrideCompanyPricing ? (
              <div className="rounded-2xl border border-violet-400/30 bg-violet-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Superadmin pricing override</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Leave a field blank to use the default plan price.
                    </p>
                  </div>
                  <StatusBadge label="Super Admin only" tone="info" />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-300">Subscription price (cents)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={subSubscriptionPriceDraft}
                      onChange={(e) => setSubSubscriptionPriceDraft(e.target.value)}
                      placeholder="Default pricing"
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Default: {formatCents(subscription.subscriptionPriceCents)}
                    </p>
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-300">Seat license price (cents)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={subSeatPriceDraft}
                      onChange={(e) => setSubSeatPriceDraft(e.target.value)}
                      placeholder="Default pricing"
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Default: {formatCents(subscription.seatPriceCents)}
                    </p>
                  </label>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
                Pricing: subscription {formatCents(subscription.subscriptionPriceCents)} · seat license{" "}
                {formatCents(subscription.seatPriceCents)}.
                <span className="mt-1 block text-slate-500">
                  Pricing overrides are controlled by Super Admins.
                </span>
              </div>
            )}

            {canManageCompanySubscription ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSaveSubscription()}
                  disabled={savingSubscription}
                  className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSubscription ? "Saving…" : "Save subscription, licenses & pricing"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateBillingDraft()}
                  disabled={creatingBillingDraft || loading || !canGenerateBillingDraft}
                  className="rounded-xl border border-violet-400/60 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingBillingDraft ? "Creating..." : "Create billing draft"}
                </button>
              </div>
            ) : null}
            {canManageCompanySubscription && !canGenerateBillingDraft ? (
              <p className="text-sm text-slate-500">
                Add a subscription or seat price override first to generate an automatic billing
                draft.
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Company Access Rules"
        description="Set company-wide function defaults for this workspace. User-level overrides still live in the user admin page."
      >
        {loading ? (
          <InlineMessage>Loading company access rules...</InlineMessage>
        ) : !company ? (
          <EmptyState
            title="Company access rules unavailable"
            description="This workspace could not be loaded."
          />
        ) : canManageCompanyPermissions ? (
          <div className="space-y-5">
            <PermissionOverridesEditor
              title="Company function defaults"
              description="These defaults apply to users in this workspace unless a user-level override takes precedence."
              value={companyPermissionDraft}
              onChange={setCompanyPermissionDraft}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveCompanyPermissions()}
                disabled={savingCompanyPermissions}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCompanyPermissions ? "Saving..." : "Save company access rules"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
            Company access rules are controlled by Super Admins.
          </div>
        )}
      </SectionCard>

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
          <div className="overflow-hidden rounded-2xl border border-slate-700/80">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr] gap-3 border-b border-slate-700/80 bg-slate-950/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <div>User</div>
              <div>Role</div>
              <div>Status</div>
              <div>Last Seen</div>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr] gap-3 border-t border-slate-700/60 px-5 py-4 text-sm text-slate-400 first:border-t-0"
              >
                <div>
                  <div className="font-semibold text-slate-100">{user.name}</div>
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
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                  <div className="font-semibold text-slate-100">Workspace archived</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatRelative(company.archivedAt)}
                    {company.archivedByEmail ? ` by ${company.archivedByEmail}` : ""}
                  </div>
                </div>
              ) : null}
              {company.restoredAt ? (
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4">
                  <div className="font-semibold text-slate-100">Workspace restored</div>
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
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{invite.email}</div>
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
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{document.title}</div>
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
