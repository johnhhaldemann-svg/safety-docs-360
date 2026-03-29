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
  type CompanyJobsite,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import { getDocumentStatusLabel } from "@/lib/documentStatus";

type MessageTone = "neutral" | "success" | "warning" | "error";

type ComposerState = {
  name: string;
  projectNumber: string;
  location: string;
  status: "planned" | "active" | "completed" | "archived";
  projectManager: string;
  safetyLead: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const EMPTY_COMPOSER: ComposerState = {
  name: "",
  projectNumber: "",
  location: "",
  status: "planned",
  projectManager: "",
  safetyLead: "",
  startDate: "",
  endDate: "",
  notes: "",
};

function getJobsiteTone(
  status: CompanyJobsite["status"]
): "neutral" | "success" | "warning" | "info" {
  if (status === "Action needed") return "warning";
  if (status === "Active") return "success";
  if (status === "Planned") return "info";
  return "neutral";
}

function createComposerFromJobsite(jobsite: CompanyJobsite): ComposerState {
  return {
    name: jobsite.name,
    projectNumber: jobsite.projectNumber || "",
    location: jobsite.location || "",
    status: jobsite.rawStatus,
    projectManager: jobsite.projectManager || "",
    safetyLead: jobsite.safetyLead || "",
    startDate: jobsite.startDate || "",
    endDate: jobsite.endDate || "",
    notes: jobsite.notes || "",
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function JobsitesPage() {
  const {
    loading,
    companyName,
    companyLocation,
    jobsites,
    documents,
    pendingDocuments,
    companyInvites,
    companyUsers,
    activeUsers,
    activeJobsitesCount,
    reload,
    referenceTime,
  } = useCompanyWorkspaceData();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJobsiteId, setSelectedJobsiteId] = useState<string>("all");
  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("neutral");
  const [saving, setSaving] = useState(false);
  const [updatingJobsiteId, setUpdatingJobsiteId] = useState<string | null>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredJobsites = useMemo(() => {
    return jobsites.filter((jobsite) => {
      const matchesStatus =
        statusFilter === "all" ||
        jobsite.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [
          jobsite.name,
          jobsite.location,
          jobsite.projectNumber,
          jobsite.projectManager || "",
          jobsite.safetyLead || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [jobsites, normalizedSearch, statusFilter]);

  const selectedJobsite = useMemo(() => {
    if (selectedJobsiteId !== "all") {
      return jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? null;
    }
    return filteredJobsites[0] ?? jobsites[0] ?? null;
  }, [filteredJobsites, jobsites, selectedJobsiteId]);

  const selectedJobsiteVisibleInFilters = Boolean(
    selectedJobsite && filteredJobsites.some((jobsite) => jobsite.id === selectedJobsite.id)
  );

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
          id: "no-jobsite-selected",
          title: "No jobsite selected yet",
          detail:
            "Pick a site from the directory to open its live document and activity feed.",
          meta: "Waiting",
          tone: "neutral" as const,
        },
      ];
    }

    const activityRows = selectedJobsiteDocuments.slice(0, 6).map((document) => ({
      id: document.id,
      title: getDocumentLabel(document),
      detail: `${document.document_type || "Document"} | ${getDocumentStatusLabel(
        document.status,
        Boolean(document.final_file_path)
      )}`,
      meta: formatRelative(document.created_at, referenceTime),
      tone: "info" as const,
    }));

    return activityRows.length > 0
      ? activityRows
      : [
          {
            id: "no-jobsite-activity",
            title: "No recent site activity yet",
            detail:
              "Site submissions, uploads, and approvals will appear here as work starts moving.",
            meta: "Waiting",
            tone: "neutral" as const,
          },
        ];
  }, [referenceTime, selectedJobsite, selectedJobsiteDocuments]);

  const plannedCount = jobsites.filter((jobsite) => jobsite.status === "Planned").length;
  const actionNeededCount = jobsites.filter(
    (jobsite) => jobsite.status === "Action needed"
  ).length;
  const archivedCount = jobsites.filter((jobsite) => jobsite.status === "Archived").length;

  function updateComposer<K extends keyof ComposerState>(key: K, value: ComposerState[K]) {
    setComposer((current) => ({ ...current, [key]: value }));
  }

  function resetComposer(jobsite?: CompanyJobsite | null) {
    setComposer(jobsite ? createComposerFromJobsite(jobsite) : EMPTY_COMPOSER);
  }

  async function handleCreateOrConvertJobsite() {
    if (!composer.name.trim()) {
      setMessage("Jobsite name is required.");
      setMessageTone("error");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetchWithTimeout("/api/company/jobsites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: composer.name,
          projectNumber: composer.projectNumber,
          location: composer.location,
          status: composer.status,
          projectManager: composer.projectManager,
          safetyLead: composer.safetyLead,
          startDate: composer.startDate,
          endDate: composer.endDate,
          notes: composer.notes,
        }),
      }, 15000);

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; jobsite?: { id?: string } }
        | null;

      if (!response.ok) {
        setMessage(payload?.error || "Failed to save the jobsite.");
        setMessageTone("error");
        return;
      }

      setMessage(payload?.message || "Jobsite saved.");
      setMessageTone("success");
      const nextSelectedId = payload?.jobsite?.id ?? "all";
      resetComposer();
      await reload();
      setSelectedJobsiteId(nextSelectedId);
    } catch (error) {
      console.error("Failed to save jobsite:", error);
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Save timed out. Please try again."
          : "The jobsite could not be saved right now."
      );
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleJobsiteStatusChange(
    jobsite: CompanyJobsite,
    nextStatus: ComposerState["status"]
  ) {
    if (jobsite.source !== "table") {
      setMessage(
        "Convert this document-based jobsite into a managed jobsite first, then you can control its status here."
      );
      setMessageTone("warning");
      return;
    }

    setUpdatingJobsiteId(jobsite.id);
    setMessage(null);

    try {
      const response = await fetchWithTimeout(`/api/company/jobsites/${jobsite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          archived: nextStatus === "archived",
        }),
      }, 15000);

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        setMessage(payload?.error || "Failed to update the jobsite.");
        setMessageTone("error");
        return;
      }

      setMessage(payload?.message || "Jobsite updated.");
      setMessageTone("success");
      await reload();
    } catch (error) {
      console.error("Failed to update jobsite:", error);
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Update timed out. Please try again."
          : "The jobsite could not be updated right now."
      );
      setMessageTone("error");
    } finally {
      setUpdatingJobsiteId(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Jobsites"
        description={`Create and manage live jobsites for ${companyName}, organize documents by site, and keep project operations visible in one place.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              {loading ? "Refreshing..." : "Refresh Jobsites"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedJobsiteId("all");
                resetComposer();
                setMessage(null);
              }}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Add Jobsite
            </button>
            <Link
              href="/submit"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Submit Document
            </Link>
          </>
        }
      />

      <InlineMessage tone="neutral">
        Company admins can create managed jobsites here, while older document-only project names can
        be converted into real jobsites as your workspace matures. Use Refresh Jobsites whenever
        you want the latest company data.
      </InlineMessage>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            title: "Active Jobsites",
            value: String(activeJobsitesCount),
            note: "Sites currently active or needing action",
          },
          {
            title: "Planned",
            value: String(plannedCount),
            note: "Jobsites staged before field work begins",
          },
          {
            title: "Action Needed",
            value: String(actionNeededCount),
            note: "Sites with pending documents or follow-up",
          },
          {
            title: "Archived",
            value: String(archivedCount),
            note: "Completed or parked sites kept for history",
          },
          {
            title: "Pending Documents",
            value: String(pendingDocuments.length),
            note: "Live company documents waiting on next action",
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

      <section className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
        <SectionCard
          title="Add or Convert a Jobsite"
          description="Create a managed jobsite, or promote a document-only project name into a real site record."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Jobsite Name
              </label>
              <input
                type="text"
                value={composer.name}
                onChange={(event) => updateComposer("name", event.target.value)}
                placeholder="North Tower Expansion"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Project Number
              </label>
              <input
                type="text"
                value={composer.projectNumber}
                onChange={(event) => updateComposer("projectNumber", event.target.value)}
                placeholder="PRJ-2026-014"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Location
              </label>
              <input
                type="text"
                value={composer.location}
                onChange={(event) => updateComposer("location", event.target.value)}
                placeholder={companyLocation}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Status
              </label>
              <select
                value={composer.status}
                onChange={(event) =>
                  updateComposer("status", event.target.value as ComposerState["status"])
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Project Manager
              </label>
              <input
                type="text"
                value={composer.projectManager}
                onChange={(event) => updateComposer("projectManager", event.target.value)}
                placeholder="Project lead"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Safety Lead
              </label>
              <input
                type="text"
                value={composer.safetyLead}
                onChange={(event) => updateComposer("safetyLead", event.target.value)}
                placeholder="Safety lead"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Start Date
              </label>
              <input
                type="date"
                value={composer.startDate}
                onChange={(event) => updateComposer("startDate", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                End Date
              </label>
              <input
                type="date"
                value={composer.endDate}
                onChange={(event) => updateComposer("endDate", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Site Notes
              </label>
              <textarea
                value={composer.notes}
                onChange={(event) => updateComposer("notes", event.target.value)}
                rows={4}
                placeholder="Site-specific access notes, startup requirements, or special concerns."
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
          </div>

          {message ? (
            <div className="mt-5">
              <InlineMessage tone={messageTone}>{message}</InlineMessage>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCreateOrConvertJobsite()}
              disabled={saving}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Save Jobsite"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedJobsite) {
                  resetComposer(selectedJobsite);
                  setMessage(
                    selectedJobsite.source === "document_fallback"
                      ? "This document-based site is loaded into the form. Save it to create a managed jobsite."
                      : "Selected jobsite loaded into the form."
                  );
                  setMessageTone(
                    selectedJobsite.source === "document_fallback" ? "warning" : "neutral"
                  );
                }
              }}
              disabled={!selectedJobsite}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Load Selected Site
            </button>
            <button
              type="button"
              onClick={() => {
                resetComposer();
                setMessage(null);
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear Form
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Jobsite Directory"
          description="Track every active, planned, and archived site in your company workspace."
          aside={
            <StatusBadge
              label={`${filteredJobsites.length} visible`}
              tone={filteredJobsites.length > 0 ? "info" : "neutral"}
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr]">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search jobsites, project numbers, or site leads..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="action needed">Action Needed</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="mt-5 space-y-4">
            {selectedJobsiteId !== "all" && selectedJobsite && !selectedJobsiteVisibleInFilters ? (
              <InlineMessage tone="warning">
                You still have {selectedJobsite.name} selected, but it is hidden by the current
                filters.
              </InlineMessage>
            ) : null}

            {filteredJobsites.length === 0 ? (
              <EmptyState
                title="No jobsites match this view"
                description="Create your first managed jobsite or clear the current search and status filters."
                actionHref="/submit"
                actionLabel="Submit Document"
              />
            ) : (
              filteredJobsites.map((jobsite) => {
                const selected = selectedJobsite?.id === jobsite.id;
                const siteInviteCount = companyInvites.length;

                return (
                  <div
                    key={jobsite.id}
                    className={`rounded-2xl border p-5 transition ${
                      selected
                        ? "border-sky-300 bg-sky-50/60"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedJobsiteId(jobsite.id)}
                            className="text-left text-lg font-bold text-slate-950 transition hover:text-sky-700"
                          >
                            {jobsite.name}
                          </button>
                          <StatusBadge label={jobsite.status} tone={getJobsiteTone(jobsite.status)} />
                          <StatusBadge
                            label={
                              jobsite.source === "table" ? "Managed Site" : "Document-Based"
                            }
                            tone={jobsite.source === "table" ? "success" : "info"}
                          />
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <div>Location: {jobsite.location || companyLocation}</div>
                          <div>Project #: {jobsite.projectNumber || "Not assigned"}</div>
                          <div>Project Manager: {jobsite.projectManager || "Not set"}</div>
                          <div>Safety Lead: {jobsite.safetyLead || "Not set"}</div>
                          <div>Pending Docs: {jobsite.pendingDocuments}</div>
                          <div>Total Docs: {jobsite.totalDocuments}</div>
                        </div>

                        <div className="text-sm text-slate-500">
                          Last activity: {formatRelative(jobsite.lastActivity, referenceTime)}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[230px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJobsiteId(jobsite.id);
                            resetComposer(jobsite);
                            setMessage(null);
                          }}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View Site
                        </button>

                        {jobsite.source === "document_fallback" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJobsiteId(jobsite.id);
                              resetComposer(jobsite);
                              setMessage(
                                "This site is currently coming from document activity only. Save it in the form to convert it into a managed jobsite."
                              );
                              setMessageTone("warning");
                            }}
                            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
                          >
                            Convert to Managed Site
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleJobsiteStatusChange(jobsite, "active")}
                              disabled={updatingJobsiteId === jobsite.id}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              Mark Active
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleJobsiteStatusChange(jobsite, "completed")}
                              disabled={updatingJobsiteId === jobsite.id}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              Complete Site
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleJobsiteStatusChange(
                                  jobsite,
                                  jobsite.rawStatus === "archived" ? "active" : "archived"
                                )
                              }
                              disabled={updatingJobsiteId === jobsite.id}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              {jobsite.rawStatus === "archived" ? "Reactivate" : "Archive"}
                            </button>
                          </>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          {siteInviteCount} open invite{siteInviteCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <SectionCard
          title={selectedJobsite ? `${selectedJobsite.name} Site Board` : "Site Board"}
          description={
            selectedJobsite
              ? "Open site details, live document flow, and readiness data for the selected jobsite."
              : "Pick a jobsite from the directory to open its board."
          }
        >
          {!selectedJobsite ? (
            <EmptyState
              title="Choose a jobsite to open its board"
              description="Once a site is selected, you will see site details, documents, and recent activity in one place."
            />
          ) : (
            <div className="space-y-6">
              {selectedJobsite.source === "document_fallback" ? (
                <InlineMessage tone="warning">
                  This site is still document-based. Save it in the form above to unlock managed
                  site controls and richer site metadata.
                </InlineMessage>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Company Users",
                    value: String(companyUsers.length),
                    note: "People assigned to this company workspace",
                  },
                  {
                    title: "Users Online",
                    value: String(activeUsers.length),
                    note: "Field and office users active in the last 20 minutes",
                  },
                  {
                    title: "Pending Site Docs",
                    value: String(selectedJobsite.pendingDocuments),
                    note: "Live documents waiting on next action",
                  },
                  {
                    title: "Open Invites",
                    value: String(companyInvites.length),
                    note: "Invites still waiting for account setup",
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      {card.title}
                    </div>
                    <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                      {loading ? "-" : card.value}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{card.note}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black tracking-tight text-slate-950">
                        {selectedJobsite.name}
                      </h2>
                      <StatusBadge
                        label={selectedJobsite.status}
                        tone={getJobsiteTone(selectedJobsite.status)}
                      />
                      <StatusBadge label={selectedJobsite.projectNumber} tone="info" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedJobsite.location || companyLocation}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/submit"
                      className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
                    >
                      Submit Site Document
                    </Link>
                    <Link
                      href="/upload"
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Upload Existing File
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Project Manager
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedJobsite.projectManager || "Not assigned yet"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Safety Lead
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedJobsite.safetyLead || "Not assigned yet"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Start Date
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedJobsite.startDate || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      End Date
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedJobsite.endDate || "Not set"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Site Notes
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedJobsite.notes ||
                      "No site notes yet. Use the jobsite form to capture startup conditions, risk notes, and coordination details."}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Site Documents</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Live documents connected to this jobsite.
                    </p>
                  </div>
                  <StatusBadge
                    label={`${selectedJobsiteDocuments.length} file${
                      selectedJobsiteDocuments.length === 1 ? "" : "s"
                    }`}
                    tone={selectedJobsiteDocuments.length > 0 ? "info" : "neutral"}
                  />
                </div>

                {selectedJobsiteDocuments.length === 0 ? (
                  <div className="mt-5">
                    <EmptyState
                      title="No site documents yet"
                      description="Submit or upload the first document for this jobsite to start the live record."
                      actionHref="/submit"
                      actionLabel="Submit Document"
                    />
                  </div>
                ) : (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <div>Document</div>
                      <div>Type</div>
                      <div>Status</div>
                      <div>Submitted</div>
                      <div>Action</div>
                    </div>
                    {selectedJobsiteDocuments.map((document) => (
                      <div
                        key={document.id}
                        className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-4 border-b border-slate-200 px-4 py-4 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">
                            {getDocumentLabel(document)}
                          </div>
                          <div className="mt-1 truncate text-slate-500">
                            {document.file_name || selectedJobsite.name}
                          </div>
                        </div>
                        <div className="text-slate-600">
                          {document.document_type || "Document"}
                        </div>
                        <div>
                          <StatusBadge
                            label={getDocumentStatusLabel(
                              document.status,
                              Boolean(document.final_file_path)
                            )}
                            tone={
                              selectedJobsite.pendingDocuments > 0 ? "warning" : "success"
                            }
                          />
                        </div>
                        <div className="text-slate-600">
                          {formatRelative(document.created_at, referenceTime)}
                        </div>
                        <div>
                          <Link
                            href="/library"
                            className="text-sm font-semibold text-sky-700 transition hover:text-sky-600"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <ActivityFeed
            title="Site Activity"
            description="Recent document movement and site-level work happening around this jobsite."
            items={selectedJobsiteActivity}
          />

          <SectionCard
            title="Operations Readiness"
            description="Quick links to the company modules tied to the selected jobsite."
          >
            <div className="grid gap-4">
              {[
                {
                  title: "Users by Jobsite",
                  detail: `${companyUsers.length} company users available for deployment and coordination.`,
                  href: "/company-users",
                  label: "Open Users",
                },
                {
                  title: "Field iD Exchange",
                  detail:
                    "Track hazards, near misses, good catches, and live field observations for this site.",
                  href: "/field-id-exchange",
                  label: "Open Exchange",
                },
                {
                  title: "Site Reporting",
                  detail:
                    "Review document status, submissions, and company-side reporting tied to active work.",
                  href: "/reports",
                  label: "Open Reports",
                },
                {
                  title: "Corrective Actions",
                  detail: `${pendingDocuments.length} pending document actions and ${companyInvites.length} open invites currently need follow-up.`,
                  href: "/dashboard",
                  label: "Back to Board",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                    >
                      {item.label}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>

      <ActivityFeed
        title={selectedJobsite ? `${selectedJobsite.name} Activity` : "Jobsite Activity"}
        description="Recent site-level document submissions, updates, and approvals."
        items={selectedJobsiteActivity}
      />
    </div>
  );
}
