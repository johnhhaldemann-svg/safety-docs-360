"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
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

type CompanySummary = {
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
  totalUsers: number;
  companyAdmins: number;
  activeUsers: number;
  pendingUsers: number;
  pendingInvites: number;
  completedDocuments: number;
  submittedDocuments: number;
};

type CompanySignupRequest = {
  id: string;
  company_name: string;
  industry: string;
  primary_contact_name: string;
  primary_contact_email: string;
  phone: string;
  status: string;
  created_at?: string | null;
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
  if (normalized === "archived") return "warning";
  if (normalized === "pending") return "warning";
  if (normalized === "suspended") return "error";
  return "neutral";
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [signupRequests, setSignupRequests] = useState<CompanySignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error" | "neutral">(
    "neutral"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState("");
  const [processingCompanyId, setProcessingCompanyId] = useState("");

  const loadCompanies = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
        setMessageTone("error");
        setMessage("You must be logged in as an internal admin.");
        setCompanies([]);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/companies", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            companies?: CompanySummary[];
            signupRequests?: CompanySignupRequest[];
          }
        | null;

      if (!res.ok) {
        setMessageTone("error");
        setMessage(data?.error || "Failed to load companies.");
        setCompanies([]);
        setSignupRequests([]);
        setLoading(false);
        return;
      }

      setCompanies(data?.companies ?? []);
      setSignupRequests(data?.signupRequests ?? []);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load companies.");
      setCompanies([]);
      setSignupRequests([]);
    }

    setLoading(false);
  }, []);

  const handleSignupRequestAction = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setProcessingRequestId(requestId);
      setMessage("");

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.access_token) {
          setMessageTone("error");
          setMessage("You must be logged in as an internal admin.");
          setProcessingRequestId("");
          return;
        }

        const res = await fetch("/api/admin/companies", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ requestId, action }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              message?: string;
              warning?: string | null;
            }
          | null;

        if (!res.ok) {
          setMessageTone("error");
          setMessage(data?.error || "Failed to update the company signup request.");
          setProcessingRequestId("");
          return;
        }

        setMessageTone(data?.warning ? "warning" : "success");
        setMessage(data?.warning || data?.message || "Company signup request updated.");
        await loadCompanies();
      } catch (error) {
        setMessageTone("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to update the company signup request."
        );
      }

      setProcessingRequestId("");
    },
    [loadCompanies]
  );

  const handleCompanyAction = useCallback(
    async (companyId: string, action: "archive" | "restore") => {
      setProcessingCompanyId(companyId);
      setMessage("");

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.access_token) {
          setMessageTone("error");
          setMessage("You must be logged in as an internal admin.");
          setProcessingCompanyId("");
          return;
        }

        const res = await fetch("/api/admin/companies", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ companyId, action }),
        });

        const data = (await res.json().catch(() => null)) as
          | {
              error?: string;
              message?: string;
            }
          | null;

        if (!res.ok) {
          setMessageTone("error");
          setMessage(data?.error || "Failed to update the company workspace.");
          setProcessingCompanyId("");
          return;
        }

        setMessageTone("success");
        setMessage(
          data?.message ||
            (action === "archive"
              ? "Company archived successfully."
              : "Company restored successfully.")
        );
        await loadCompanies();
      } catch (error) {
        setMessageTone("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to update the company workspace."
        );
      }

      setProcessingCompanyId("");
    },
    [loadCompanies]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadCompanies();
    });
  }, [loadCompanies]);

  const filteredCompanies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return companies.filter((company) => {
      if (!query) return true;
      return (
        company.name.toLowerCase().includes(query) ||
        company.teamKey.toLowerCase().includes(query) ||
        company.primaryContactEmail.toLowerCase().includes(query)
      );
    });
  }, [companies, searchTerm]);

  const activeCompanies = useMemo(
    () =>
      filteredCompanies.filter((company) => company.status.trim().toLowerCase() !== "archived"),
    [filteredCompanies]
  );

  const archivedCompanies = useMemo(
    () =>
      filteredCompanies.filter((company) => company.status.trim().toLowerCase() === "archived"),
    [filteredCompanies]
  );

  const stats = useMemo(
    () => [
      {
        title: "Active Workspaces",
        value: String(
          companies.filter((company) => company.status.trim().toLowerCase() !== "archived").length
        ),
        note: "Customer workspaces already live",
      },
      {
        title: "Archived Workspaces",
        value: String(
          companies.filter((company) => company.status.trim().toLowerCase() === "archived").length
        ),
        note: "Inactive companies preserved for history",
      },
      {
        title: "Company Seats",
        value: String(companies.reduce((sum, company) => sum + company.totalUsers, 0)),
        note: "All people assigned under company workspaces",
      },
      {
        title: "Pending Invites",
        value: String(companies.reduce((sum, company) => sum + company.pendingInvites, 0)),
        note: "Invites waiting to be claimed",
      },
      {
        title: "Completed Docs",
        value: String(companies.reduce((sum, company) => sum + company.completedDocuments, 0)),
        note: "Approved company deliverables",
      },
      {
        title: "Workspace Requests",
        value: String(signupRequests.length),
        note: "Company workspaces waiting for internal activation",
      },
    ],
    [companies, signupRequests]
  );

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Oversight"
        title="Company Workspaces"
        description="Approve new workspace requests and monitor live customer companies from one place."
        actions={
          <Link
            href="/admin/users"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Platform Staff
          </Link>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
            title: "Customer requests workspace",
            body: "A customer starts the company onboarding flow and submits the company profile for review.",
          },
          {
            step: "02",
            title: "Internal admin approves",
            body: "Your team approves the request here and activates the customer company workspace.",
          },
          {
            step: "03",
            title: "Company owner signs in",
            body: "After approval, the same owner email is attached to the company workspace and the owner signs back in to continue.",
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

      <SectionCard
        title="1. Workspace Requests"
        description="Review new company requests, activate the workspace, and hand off the first account setup to the company owner."
      >
        {message ? (
          <div className="mb-4">
            <InlineMessage tone={messageTone}>{message}</InlineMessage>
          </div>
        ) : null}
        {loading ? (
          <InlineMessage>Loading company signup requests...</InlineMessage>
        ) : signupRequests.length === 0 ? (
          <EmptyState
            title="No workspace requests are waiting"
            description="New company requests will appear here when a customer starts the company onboarding process."
          />
        ) : (
          <div className="grid gap-4">
            {signupRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">{request.company_name}</h3>
                      <StatusBadge label={request.status} tone={statusTone(request.status)} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                      {request.industry ? <span>Industry: {request.industry}</span> : null}
                      <span>Requested {formatRelative(request.created_at)}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                      <span>Primary contact: {request.primary_contact_name || "Not provided"}</span>
                      <span>Email: {request.primary_contact_email || "Not provided"}</span>
                      <span>Phone: {request.phone || "Not provided"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 lg:min-w-[360px]">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Approve this request to activate the workspace. After approval, the owner signs in again with the same email and the company workspace opens on that account.
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleSignupRequestAction(request.id, "approve")}
                        disabled={processingRequestId === request.id}
                        className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingRequestId === request.id ? "Approving..." : "Approve Workspace"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSignupRequestAction(request.id, "reject")}
                        disabled={processingRequestId === request.id}
                        className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingRequestId === request.id ? "Working..." : "Reject"}
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="2. Active Company Workspaces"
        description="Approved customer workspaces and the users, invites, and documents linked to each one."
      >
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search company workspaces..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
        </div>

        {message && messageTone === "error" ? (
          <div className="mb-4">
            <InlineMessage tone="error">{message}</InlineMessage>
          </div>
        ) : null}

        {loading ? (
          <InlineMessage>Loading companies...</InlineMessage>
        ) : filteredCompanies.length === 0 ? (
          <EmptyState
            title="No company workspaces found"
            description="Approved company workspaces will appear here after your internal team activates them."
          />
        ) : (
          <div className="space-y-8">
            {[
              {
                key: "active",
                title: "Active Workspaces",
                description: "Live customer companies that can still sign in and operate.",
                companies: activeCompanies,
              },
              {
                key: "archived",
                title: "Archived Workspaces",
                description:
                  "Inactive companies preserved for history. Restore them to reactivate access.",
                companies: archivedCompanies,
              },
            ].map((section) => (
              <div key={section.key} className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{section.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                </div>
                {section.companies.length === 0 ? (
                  <EmptyState
                    title={`No ${section.key} company workspaces`}
                    description={
                      section.key === "active"
                        ? "Approved company workspaces will appear here after activation."
                        : "Archived company workspaces will appear here after you archive inactive customers."
                    }
                  />
                ) : (
                  <div className="grid gap-4">
                    {section.companies.map((company) => (
                      <div
                        key={company.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-lg font-bold text-slate-900">{company.name}</h3>
                              <StatusBadge label={company.status} tone={statusTone(company.status)} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                              <span>Workspace key: {company.teamKey}</span>
                              {company.industry ? <span>Industry: {company.industry}</span> : null}
                              <span>Created {formatRelative(company.createdAt)}</span>
                              {company.status.trim().toLowerCase() === "archived" && company.archivedAt ? (
                                <span>
                                  Archived {formatRelative(company.archivedAt)}
                                  {company.archivedByEmail ? ` by ${company.archivedByEmail}` : ""}
                                </span>
                              ) : null}
                              {company.status.trim().toLowerCase() === "active" && company.restoredAt ? (
                                <span>
                                  Restored {formatRelative(company.restoredAt)}
                                  {company.restoredByEmail ? ` by ${company.restoredByEmail}` : ""}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                              <span>
                                Contact: {company.primaryContactName || "Not provided"}
                              </span>
                              <span>
                                Email: {company.primaryContactEmail || "Not provided"}
                              </span>
                              <span>Phone: {company.phone || "Not provided"}</span>
                              <span>Website: {company.website || "Not provided"}</span>
                              <span className="sm:col-span-2">
                                Address:{" "}
                                {[
                                  company.addressLine1,
                                  company.city,
                                  company.stateRegion,
                                  company.postalCode,
                                  company.country,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Not provided"}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 xl:min-w-[420px]">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  Users
                                </div>
                                <div className="mt-2 text-2xl font-bold text-slate-900">
                                  {company.totalUsers}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {company.companyAdmins} admin, {company.activeUsers} active
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  Invites
                                </div>
                                <div className="mt-2 text-2xl font-bold text-slate-900">
                                  {company.pendingInvites}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {company.pendingUsers} pending approvals
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  Documents
                                </div>
                                <div className="mt-2 text-2xl font-bold text-slate-900">
                                  {company.completedDocuments}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {company.submittedDocuments} submitted
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-3">
                              <Link
                                href={`/admin/companies/${company.id}`}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                View Company
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCompanyAction(
                                    company.id,
                                    section.key === "active" ? "archive" : "restore"
                                  )
                                }
                                disabled={processingCompanyId === company.id}
                                className={
                                  section.key === "active"
                                    ? "rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    : "rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                }
                              >
                                {processingCompanyId === company.id
                                  ? section.key === "active"
                                    ? "Archiving..."
                                    : "Restoring..."
                                  : section.key === "active"
                                    ? "Archive Workspace"
                                    : "Restore Workspace"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
