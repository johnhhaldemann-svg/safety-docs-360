"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ActivityFeed,
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

export default function ReportsPage() {
  const {
    companyName,
    companyLocation,
    documents,
    companyUsers,
    companyInvites,
    pendingUsers,
    activeUsers,
    onlineUsers,
    suspendedUsers,
    pendingDocuments,
    draftDocuments,
    approvedDocuments,
    attentionDocuments,
    documentsSubmittedThisWeek,
    jobsites,
    activeJobsitesCount,
    overdueActionsCount,
    notificationCount,
    referenceTime,
  } = useCompanyWorkspaceData();

  const recentActivity = useMemo(() => {
    const documentItems = documents.slice(0, 5).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      detail: `${document.project_name || "General Workspace"} - ${document.document_type || "Document"}`,
      meta: formatRelative(document.created_at, referenceTime),
      tone: approvedDocuments.some((approved) => approved.id === document.id)
        ? ("success" as const)
        : pendingDocuments.some((pending) => pending.id === document.id)
          ? ("warning" as const)
          : ("info" as const),
    }));

    const workforceItems = pendingUsers.slice(0, 2).map((user) => ({
      id: `pending-${user.id}`,
      title: `${user.name} is awaiting company approval`,
      detail: "Employee setup is complete but access has not been approved yet.",
      meta: formatRelative(user.created_at, referenceTime),
      tone: "warning" as const,
    }));

    return [...documentItems, ...workforceItems].slice(0, 6);
  }, [approvedDocuments, documents, pendingDocuments, pendingUsers, referenceTime]);

  const reportPacks = [
    {
      title: "Company Snapshot",
      note: `${companyUsers.length} users, ${activeJobsitesCount} active jobsites, and ${documents.length} tracked records in one summary.`,
    },
    {
      title: "Document Pipeline",
      note: `${pendingDocuments.length} pending, ${draftDocuments.length} draft, ${approvedDocuments.length} approved, and ${attentionDocuments.length} needing follow-up.`,
    },
    {
      title: "Workforce Readiness",
      note: `${onlineUsers.length} online now, ${pendingUsers.length} awaiting approval, and ${suspendedUsers.length} inactive or suspended.`,
    },
    {
      title: "Jobsites Rollup",
      note: `${jobsites.length} grouped jobsites built from the live company workspace, with ${companyLocation} as the current company location baseline.`,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Reports"
        description={`Open the operating view for ${companyName}: what is moving, what is blocked, and what needs action across jobsites, documents, and workforce access.`}
        actions={
          <>
            <Link
              href="/library"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Open Documents
            </Link>
            <Link
              href="/jobsites"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open Jobsites
            </Link>
          </>
        }
      />

      <InlineMessage tone="neutral">
        These report blocks are designed as live operating summaries first. Exportable PDF and
        scheduled report packs are the next layer once the company board workflow is fully in
        place.
      </InlineMessage>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Users",
            value: String(companyUsers.length),
            note: "Everyone inside this company workspace",
          },
          {
            title: "Users Online",
            value: String(onlineUsers.length),
            note: "Active in the last 20 minutes",
          },
          {
            title: "Active Jobsites",
            value: String(activeJobsitesCount),
            note: "Grouped from current project activity",
          },
          {
            title: "Pending Documents",
            value: String(pendingDocuments.length),
            note: "Files still moving through review",
          },
          {
            title: "Overdue Actions",
            value: String(overdueActionsCount),
            note: "Access reviews and aging review items",
          },
          {
            title: "Submitted This Week",
            value: String(documentsSubmittedThisWeek.length),
            note: "Fresh activity across the company board",
          },
          {
            title: "Pending Invites",
            value: String(companyInvites.length),
            note: "Employees who still need to set up accounts",
          },
          {
            title: "Notifications",
            value: String(notificationCount),
            note: "Current approvals, invites, and actions waiting",
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Document Status Breakdown"
          description="The company document pipeline from draft to approved."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Draft",
                value: String(draftDocuments.length),
                tone: "neutral" as const,
              },
              {
                label: "Pending Review",
                value: String(pendingDocuments.length),
                tone: "warning" as const,
              },
              {
                label: "Approved",
                value: String(approvedDocuments.length),
                tone: "success" as const,
              },
              {
                label: "Needs Attention",
                value: String(attentionDocuments.length),
                tone: "warning" as const,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-3xl font-black text-slate-950">{item.value}</div>
                  <StatusBadge label={item.label} tone={item.tone} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_0.9fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <div>Document</div>
              <div>Jobsite</div>
              <div>Type</div>
              <div>Submitted</div>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {documents.slice(0, 8).map((document) => (
                <div
                  key={document.id}
                  className="grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_0.9fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">
                      {getDocumentLabel(document)}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {document.file_name || "Company workspace record"}
                    </div>
                  </div>
                  <div>{document.project_name || "General Workspace"}</div>
                  <div>{document.document_type || "Document"}</div>
                  <div className="text-slate-500">
                    {formatRelative(document.created_at, referenceTime)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Workforce Readiness"
          description="A direct view of access, onboarding, and current workforce health."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Active Team Members",
                value: `${activeUsers.length} live`,
              },
              {
                label: "Awaiting Approval",
                value: `${pendingUsers.length} waiting`,
              },
              {
                label: "Pending Invites",
                value: `${companyInvites.length} outstanding`,
              },
              {
                label: "Suspended Access",
                value: `${suspendedUsers.length} inactive`,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {item.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3">
            {reportPacks.map((pack) => (
              <div key={pack.title} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{pack.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{pack.note}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <ActivityFeed
          title="Recent Activity"
          description="The most recent movement across documents and workforce access."
          items={
            recentActivity.length > 0
              ? recentActivity
              : [
                  {
                    id: "no-report-activity",
                    title: "No recent company activity yet",
                    detail: "Recent submissions, approvals, and onboarding events will show up here.",
                    meta: "Waiting",
                    tone: "neutral" as const,
                  },
                ]
          }
        />

        <SectionCard
          title="Action Summary"
          description="What the company admin should act on first."
        >
          <div className="space-y-3">
            {[
              {
                title: "Review pending documents",
                detail: `${pendingDocuments.length} document${pendingDocuments.length === 1 ? "" : "s"} still need follow-up in the company board.`,
                href: "/library",
              },
              {
                title: "Clear pending approvals",
                detail: `${pendingUsers.length} employee account${pendingUsers.length === 1 ? "" : "s"} need company approval.`,
                href: "/company-users",
              },
              {
                title: "Push jobsites forward",
                detail: `${jobsites.length} grouped jobsite${jobsites.length === 1 ? "" : "s"} are already available to organize by project.`,
                href: "/jobsites",
              },
              {
                title: "Track field signals",
                detail: `${notificationCount} live company signal${notificationCount === 1 ? "" : "s"} can be managed inside Field iD Exchange.`,
                href: "/field-id-exchange",
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-200 hover:bg-white"
              >
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
