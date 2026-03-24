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
import { getDocumentStatusLabel } from "@/lib/documentStatus";

export default function JobsitesPage() {
  const {
    loading,
    companyName,
    jobsites,
    documents,
    companyUsers,
    activeUsers,
    pendingDocuments,
    companyInvites,
    activeJobsitesCount,
    documentsSubmittedThisWeek,
    companyLocation,
    referenceTime,
  } = useCompanyWorkspaceData();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJobsiteName, setSelectedJobsiteName] = useState<string>("all");

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredJobsites = useMemo(() => {
    return jobsites.filter((jobsite) => {
      const matchesStatus =
        statusFilter === "all" ||
        jobsite.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [jobsite.name, jobsite.location, jobsite.projectNumber].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );

      return matchesStatus && matchesSearch;
    });
  }, [jobsites, normalizedSearch, statusFilter]);

  const selectedJobsite =
    (selectedJobsiteName !== "all"
      ? filteredJobsites.find((jobsite) => jobsite.name === selectedJobsiteName)
      : null) ??
    filteredJobsites[0] ??
    null;

  const selectedJobsiteDocuments = useMemo(() => {
    if (!selectedJobsite) return [];
    return documents.filter(
      (document) =>
        (document.project_name?.trim() || "General Workspace") === selectedJobsite.name
    );
  }, [documents, selectedJobsite]);

  const selectedJobsiteActivity = useMemo(() => {
    if (!selectedJobsite) {
      return [
        {
          id: "no-jobsite",
          title: "No jobsite selected yet",
          detail: "Pick a jobsite card to see the recent project activity feed.",
          meta: "Waiting",
          tone: "neutral" as const,
        },
      ];
    }

    const documentItems = selectedJobsiteDocuments.slice(0, 5).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      detail:
        `${document.document_type || "Document"} · ${getDocumentStatusLabel(
          document.status,
          Boolean(document.final_file_path)
        )}`,
      meta: formatRelative(document.created_at, referenceTime),
      tone: "info" as const,
    }));

    return documentItems.length > 0
      ? documentItems
      : [
          {
            id: "no-activity",
            title: "No recent site activity yet",
            detail: "Documents and field updates for this jobsite will appear here.",
            meta: "Waiting",
            tone: "neutral" as const,
          },
        ];
  }, [referenceTime, selectedJobsite, selectedJobsiteDocuments]);

  const actionNeededCount = jobsites.filter((jobsite) => jobsite.status === "Action needed").length;
  const completedCount = jobsites.filter((jobsite) => jobsite.status === "Completed").length;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Jobsites"
        description={`Track active projects for ${companyName}, keep document activity organized by site, and monitor what needs action first.`}
        actions={
          <>
            <Link
              href="/submit"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Add Jobsite Record
            </Link>
            <Link
              href="/upload"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Upload Site File
            </Link>
          </>
        }
      />

      <InlineMessage tone="warning">
        Dedicated jobsite tables and worker assignments are the next data layer. For now, jobsites
        are grouped from live company document activity so your team can start operating in one
        company board immediately.
      </InlineMessage>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Active Jobsites",
            value: String(activeJobsitesCount),
            note: "Sites with recent activity inside the last 21 days",
          },
          {
            title: "Action Needed",
            value: String(actionNeededCount),
            note: "Jobsites that still have pending documents",
          },
          {
            title: "Completed Jobsites",
            value: String(completedCount),
            note: "Project groups with no current pending queue",
          },
          {
            title: "Submitted This Week",
            value: String(documentsSubmittedThisWeek.length),
            note: "New site records added across the company this week",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              {card.title}
            </div>
            <div className="mt-3 text-4xl font-black tracking-tight text-slate-950">
              {loading ? "-" : card.value}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{card.note}</div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Jobsite Directory"
        description="Filter the live project groups already flowing through the company workspace."
        aside={
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="action needed">Action needed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        }
      >
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search jobsites, project numbers, or locations..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
          />
        </div>

        {filteredJobsites.length === 0 ? (
          <EmptyState
            title="No jobsites match this view"
            description="Adjust the current search or add a new site record through the document flow."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredJobsites.map((jobsite) => {
              const isSelected = selectedJobsite?.name === jobsite.name;
              return (
                <button
                  key={jobsite.name}
                  type="button"
                  onClick={() => setSelectedJobsiteName(jobsite.name)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    isSelected
                      ? "border-sky-300 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-sky-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-slate-950">{jobsite.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{jobsite.location}</div>
                    </div>
                    <StatusBadge
                      label={jobsite.status}
                      tone={
                        jobsite.status === "Action needed"
                          ? "warning"
                          : jobsite.status === "Active"
                            ? "success"
                            : "neutral"
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Project number
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.projectNumber}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Pending docs
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.pendingDocuments}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Total records
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {jobsite.totalDocuments}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Last activity
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {formatRelative(jobsite.lastActivity, referenceTime)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title={selectedJobsite ? `${selectedJobsite.name} Overview` : "Jobsite Overview"}
          description={
            selectedJobsite
              ? "Current site metrics based on the project activity already moving through the company board."
              : "Choose a jobsite from the directory to review current site metrics."
          }
        >
          {!selectedJobsite ? (
            <EmptyState
              title="No jobsite selected"
              description="Pick a jobsite above to open its overview, document queue, and site activity."
            />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Workers assigned",
                    value: String(companyUsers.length),
                    note: "Current company workforce pool until site assignments are added",
                  },
                  {
                    label: "Active workers",
                    value: String(activeUsers.length),
                    note: "Employees with live workspace access",
                  },
                  {
                    label: "Open safety issues",
                    value: "0",
                    note: "Field iD issue tracking comes next",
                  },
                  {
                    label: "Pending documents",
                    value: String(selectedJobsite.pendingDocuments),
                    note: "Site records still waiting on review",
                  },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {card.label}
                    </div>
                    <div className="mt-3 text-3xl font-black text-slate-950">{card.value}</div>
                    <div className="mt-2 text-sm text-slate-500">{card.note}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Jobsite header
                    </div>
                    <div className="mt-2 text-lg font-bold text-slate-950">{selectedJobsite.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{companyLocation}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={selectedJobsite.status} tone={selectedJobsite.status === "Action needed" ? "warning" : selectedJobsite.status === "Active" ? "success" : "neutral"} />
                    <StatusBadge label={selectedJobsite.projectNumber} tone="info" />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">Documents</div>
                    <div className="mt-2 text-sm text-slate-500">
                      {selectedJobsiteDocuments.length} site-specific record
                      {selectedJobsiteDocuments.length === 1 ? "" : "s"} currently tracked.
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">Activity</div>
                    <div className="mt-2 text-sm text-slate-500">
                      Last updated {formatRelative(selectedJobsite.lastActivity, referenceTime)}.
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1.8fr)_0.9fr_0.95fr_0.9fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <div>Document</div>
                  <div>Type</div>
                  <div>Status</div>
                  <div>Submitted</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {selectedJobsiteDocuments.slice(0, 8).map((document) => (
                    <div
                      key={document.id}
                      className="grid grid-cols-[minmax(0,1.8fr)_0.9fr_0.95fr_0.9fr] gap-3 px-4 py-4 text-sm text-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {getDocumentLabel(document)}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {document.file_name || "Jobsite workspace record"}
                        </div>
                      </div>
                      <div>{document.document_type || "Document"}</div>
                      <div>
                        <StatusBadge
                          label={getDocumentStatusLabel(
                            document.status,
                            Boolean(document.final_file_path)
                          )}
                          tone="info"
                        />
                      </div>
                      <div className="text-slate-500">
                        {formatRelative(document.created_at, referenceTime)}
                      </div>
                    </div>
                  ))}
                  {selectedJobsiteDocuments.length === 0 ? (
                    <div className="px-4 py-8">
                      <EmptyState
                        title="No site records yet"
                        description="Submit or upload a document with this project name to start the jobsite trail."
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <ActivityFeed
          title="Site Activity"
          description="Recent document activity tied to the selected jobsite."
          items={selectedJobsiteActivity}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard
          title="Jobsite Operations"
        description="The next pieces that round this into a full site operations board."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Users by jobsite",
                note: "Assign employees to specific jobsites and track who is active on each project.",
              },
              {
                title: "Issue tracking by site",
                note: "Tie hazards, corrective actions, and photos directly to each active project.",
              },
              {
                title: "Site reports",
                note: "Generate project-specific document, training, and compliance summaries.",
              },
              {
                title: "Activity log",
                note: "Track site-level submissions, approvals, uploads, and follow-up history.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{item.note}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Company Signals"
          description="Helpful context for jobsites until dedicated site-user tables are added."
        >
          <div className="grid gap-3">
            {[
              {
                label: "Company workforce pool",
                value: `${companyUsers.length} total user${companyUsers.length === 1 ? "" : "s"}`,
              },
              {
                label: "Pending document queue",
                value: `${pendingDocuments.length} document${pendingDocuments.length === 1 ? "" : "s"} waiting`,
              },
              {
                label: "Open invites",
                value: `${companyInvites.length} invite${companyInvites.length === 1 ? "" : "s"} not accepted`,
              },
              {
                label: "Company location",
                value: companyLocation,
              },
            ].map((signal) => (
              <div key={signal.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {signal.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{signal.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
