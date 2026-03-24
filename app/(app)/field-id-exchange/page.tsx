"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import {
  formatRelative,
  getDocumentLabel,
  useCompanyWorkspaceData,
} from "@/components/company-workspace/useCompanyWorkspaceData";

type ExchangeItem = {
  id: string;
  title: string;
  category: string;
  severity: "High" | "Medium" | "Low";
  status: "Open" | "Waiting" | "Invited";
  jobsite: string;
  owner: string;
  detail: string;
  meta: string;
  href: string;
};

function getSeverityTone(severity: ExchangeItem["severity"]) {
  if (severity === "High") return "error" as const;
  if (severity === "Medium") return "warning" as const;
  return "info" as const;
}

function getStatusTone(status: ExchangeItem["status"]) {
  if (status === "Open") return "warning" as const;
  if (status === "Waiting") return "neutral" as const;
  return "info" as const;
}

export default function FieldIdExchangePage() {
  const {
    companyName,
    companyLocation,
    pendingDocuments,
    pendingUsers,
    companyInvites,
    jobsites,
    referenceTime,
  } = useCompanyWorkspaceData();

  const [jobsiteFilter, setJobsiteFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const exchangeItems = useMemo<ExchangeItem[]>(() => {
    const documentSignals = pendingDocuments.map((document) => {
      const ageMs = referenceTime - new Date(document.created_at).getTime();
      const severity: ExchangeItem["severity"] =
        ageMs > 1000 * 60 * 60 * 24 * 5
          ? "High"
          : ageMs > 1000 * 60 * 60 * 24 * 2
            ? "Medium"
            : "Low";

      return {
        id: `document-${document.id}`,
        title: getDocumentLabel(document),
        category: "Corrective Action",
        severity,
        status: "Open" as const,
        jobsite: document.project_name?.trim() || "General Workspace",
        owner: "Document workflow",
        detail: `${document.document_type || "Document"} still needs follow-up from the company board.`,
        meta: `Submitted ${formatRelative(document.created_at, referenceTime)}`,
        href: "/library",
      };
    });

    const approvalSignals = pendingUsers.map((user) => ({
      id: `approval-${user.id}`,
      title: `${user.name} is waiting for approval`,
      category: "Access Review",
      severity: "Medium" as const,
      status: "Waiting" as const,
      jobsite: companyName,
      owner: user.email,
      detail: "Employee account setup is complete and needs company approval.",
      meta: `Created ${formatRelative(user.created_at, referenceTime)}`,
      href: "/company-users",
    }));

    const inviteSignals = companyInvites.map((invite) => ({
      id: `invite-${invite.id}`,
      title: `${invite.email} has not joined yet`,
      category: "Crew Onboarding",
      severity: "Low" as const,
      status: "Invited" as const,
      jobsite: companyName,
      owner: invite.email,
      detail: "Invite is out, but account setup has not started yet.",
      meta: `Invited ${formatRelative(invite.created_at, referenceTime)}`,
      href: "/company-users",
    }));

    return [...documentSignals, ...approvalSignals, ...inviteSignals];
  }, [companyInvites, companyName, pendingDocuments, pendingUsers, referenceTime]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return exchangeItems.filter((item) => {
      const matchesJobsite = jobsiteFilter === "all" || item.jobsite === jobsiteFilter;
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [item.title, item.detail, item.owner, item.jobsite, item.category]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesJobsite && matchesCategory && matchesStatus && matchesSearch;
    });
  }, [categoryFilter, exchangeItems, jobsiteFilter, normalizedSearch, statusFilter]);

  const categoryCounts = useMemo(() => {
    const labels = [
      "Hazard",
      "Near Miss",
      "Incident",
      "Good Catch",
      "PPE Violation",
      "Housekeeping",
      "Equipment Issue",
      "Fall Hazard",
      "Electrical Hazard",
      "Excavation / Trench Concern",
      "Fire / Hot Work Concern",
      "Corrective Action",
      "Access Review",
      "Crew Onboarding",
    ];

    return labels.map((label) => ({
      label,
      count: filteredItems.filter((item) => item.category === label).length,
    }));
  }, [filteredItems]);

  const highSeverityCount = filteredItems.filter((item) => item.severity === "High").length;
  const openCount = filteredItems.filter((item) => item.status === "Open").length;
  const waitingCount = filteredItems.filter((item) => item.status === "Waiting").length;
  const coveredJobsites = new Set(
    filteredItems.map((item) => item.jobsite).filter(Boolean)
  ).size;

  const activityItems = filteredItems.map((item) => ({
    id: item.id,
    title: item.title,
    detail: `${item.category} - ${item.detail}`,
    meta: item.meta,
    tone:
      item.severity === "High"
        ? ("error" as const)
        : item.severity === "Medium"
          ? ("warning" as const)
          : ("info" as const),
  }));

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Field iD Exchange"
        description={`Track company field signals for ${companyName}: hazards, corrective follow-up, pending approvals, and site-level issues that need action.`}
        actions={
          <>
            <Link
              href="/submit"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Report Safety Issue
            </Link>
            <Link
              href="/upload"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Upload Field Photo
            </Link>
          </>
        }
      />

      <InlineMessage tone="warning">
        Dedicated hazard, near miss, and corrective action tables are the next build layer.
        For now, Field iD Exchange is already live as one operating board for document follow-up,
        employee approvals, and company onboarding signals.
      </InlineMessage>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Open Items",
            value: String(openCount),
            note: "Signals that still need active follow-up",
          },
          {
            title: "Waiting Review",
            value: String(waitingCount),
            note: "Employees or workflows waiting for company action",
          },
          {
            title: "High Severity",
            value: String(highSeverityCount),
            note: "Items that have aged into priority follow-up",
          },
          {
            title: "Jobsites Covered",
            value: String(coveredJobsites || jobsites.length),
            note: companyLocation,
          },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              {card.title}
            </div>
            <div className="mt-3 text-4xl font-black tracking-tight text-slate-950">
              {card.value}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{card.note}</div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Field Filters"
        description="Narrow the live board by jobsite, category, status, or keyword."
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, owner, or issue..."
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
          <select
            value={jobsiteFilter}
            onChange={(event) => setJobsiteFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="all">All jobsites</option>
            {[companyName, ...jobsites.map((jobsite) => jobsite.name)]
              .filter((value, index, array) => array.indexOf(value) === index)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="all">All categories</option>
            {categoryCounts.map((category) => (
              <option key={category.label} value={category.label}>
                {category.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="all">All statuses</option>
            <option value="Open">Open</option>
            <option value="Waiting">Waiting</option>
            <option value="Invited">Invited</option>
          </select>
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Live Exchange Feed"
          description="Everything the company admin needs to route, assign, or close next."
        >
          {filteredItems.length === 0 ? (
            <EmptyState
              title="No field items match this view"
              description="Adjust the current filters or start the next field record from the company board."
            />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <StatusBadge label={item.category} tone="info" />
                        <StatusBadge label={item.severity} tone={getSeverityTone(item.severity)} />
                        <StatusBadge label={item.status} tone={getStatusTone(item.status)} />
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {item.jobsite} - {item.owner}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">{item.meta}</div>
                      <Link
                        href={item.href}
                        className="mt-3 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Issue Categories"
            description="Use the same category language across jobsites so the board stays easy to read."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {categoryCounts.map((category) => (
                <div key={category.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{category.label}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {category.count} active signal{category.count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <ActivityFeed
            title="Recent Exchange Activity"
            description="The latest field-side movement across the company board."
            items={
              activityItems.length > 0
                ? activityItems
                : [
                    {
                      id: "no-exchange-activity",
                      title: "No field activity yet",
                      detail: "Field signals will show up here as the company board starts moving.",
                      meta: "Waiting",
                      tone: "neutral" as const,
                    },
                  ]
            }
          />
        </div>
      </section>
    </div>
  );
}
