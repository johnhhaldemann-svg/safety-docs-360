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
  if (normalized === "pending") return "warning";
  if (normalized === "suspended") return "error";
  return "neutral";
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [signupRequests, setSignupRequests] = useState<CompanySignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.access_token) {
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
        setMessage(data?.error || "Failed to load companies.");
        setCompanies([]);
        setSignupRequests([]);
        setLoading(false);
        return;
      }

      setCompanies(data?.companies ?? []);
      setSignupRequests(data?.signupRequests ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load companies.");
      setCompanies([]);
      setSignupRequests([]);
    }

    setLoading(false);
  }, []);

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
        company.teamKey.toLowerCase().includes(query)
      );
    });
  }, [companies, searchTerm]);

  const stats = useMemo(
    () => [
      {
        title: "Companies",
        value: String(companies.length),
        note: "Tracked company workspaces",
      },
      {
        title: "Company Users",
        value: String(companies.reduce((sum, company) => sum + company.totalUsers, 0)),
        note: "All users assigned under companies",
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
        title: "Pending Signups",
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
        title="Companies"
        description="Track each company workspace, monitor how many users sit under it, and keep an eye on invites and completed document delivery."
        actions={
          <Link
            href="/admin/users"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Users
          </Link>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
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

      <SectionCard
        title="Pending Company Signups"
        description="Company registrations captured before the workspace is activated by your internal team."
      >
        {loading ? (
          <InlineMessage>Loading company signup requests...</InlineMessage>
        ) : signupRequests.length === 0 ? (
          <EmptyState
            title="No pending company signups"
            description="New company registration requests will appear here if they are captured before full workspace activation."
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
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Review this signup and activate the company workspace from your internal admin process.
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Company Directory"
        description="Every company workspace and the users, invites, and approved documents linked to it."
      >
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
        </div>

        {message ? (
          <div className="mb-4">
            <InlineMessage tone="error">{message}</InlineMessage>
          </div>
        ) : null}

        {loading ? (
          <InlineMessage>Loading companies...</InlineMessage>
        ) : filteredCompanies.length === 0 ? (
          <EmptyState
            title="No companies found"
            description="Company workspaces will appear here after a company account signs up or a team is linked to a company."
          />
        ) : (
          <div className="grid gap-4">
            {filteredCompanies.map((company) => (
              <div key={company.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
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
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                      <span>
                        Contact: {company.primaryContactName || "Not provided"}
                      </span>
                      <span>
                        Email: {company.primaryContactEmail || "Not provided"}
                      </span>
                      <span>Phone: {company.phone || "Not provided"}</span>
                      <span>
                        Website: {company.website || "Not provided"}
                      </span>
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

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
