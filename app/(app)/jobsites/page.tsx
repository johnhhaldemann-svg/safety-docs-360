"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityFeed,
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import {
  formatRelative,
  getDocumentLabel,
  useCompanyWorkspaceData,
  type CompanyJobsite,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import { getDocumentStatusLabel } from "@/lib/documentStatus";

const supabase = getSupabaseBrowserClient();

type MessageTone = "neutral" | "success" | "warning" | "error";
type PanelMode = "detail" | "form";

type ComposerState = {
  name: string;
  jobsiteNumber: string;
  projectNumber: string;
  location: string;
  status: "planned" | "active" | "completed" | "archived";
  projectManager: string;
  safetyLead: string;
  zipCode: string;
  auditCustomerId: string;
  customerCompanyName: string;
  customerReportEmail: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const EMPTY_COMPOSER: ComposerState = {
  name: "",
  jobsiteNumber: "",
  projectNumber: "",
  location: "",
  status: "planned",
  projectManager: "",
  safetyLead: "",
  zipCode: "",
  auditCustomerId: "",
  customerCompanyName: "",
  customerReportEmail: "",
  startDate: "",
  endDate: "",
  notes: "",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
    jobsiteNumber: jobsite.jobsiteNumber || "",
    projectNumber: jobsite.projectNumber || "",
    location: jobsite.location || "",
    status: jobsite.rawStatus,
    projectManager: jobsite.projectManager || "",
    safetyLead: jobsite.safetyLead || "",
    zipCode: jobsite.zipCode || "",
    auditCustomerId: jobsite.auditCustomerId || "",
    customerCompanyName: jobsite.customerCompanyName || "",
    customerReportEmail: jobsite.customerReportEmail || "",
    startDate: jobsite.startDate || "",
    endDate: jobsite.endDate || "",
    notes: jobsite.notes || "",
  };
}

type AuditCustomer = {
  id: string;
  name: string;
  report_email?: string | null;
  status?: string | null;
};

type EmployeeOption = {
  id: string;
  name: string;
  role: string;
};

function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
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
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [updatingJobsiteId, setUpdatingJobsiteId] = useState<string | null>(null);
  const [auditCustomers, setAuditCustomers] = useState<AuditCustomer[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>("detail");

  const loadAuditCustomers = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    const response = await fetchWithTimeout("/api/company/audit-customers", {
      headers: getAuthHeaders(accessToken),
    });
    const payload = (await response.json().catch(() => null)) as
      | { customers?: AuditCustomer[]; error?: string }
      | null;
    if (response.ok) setAuditCustomers(payload?.customers ?? []);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAuditCustomers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadAuditCustomers]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const selectedAuditCustomer = auditCustomers.find((customer) => customer.id === composer.auditCustomerId);

  const filteredJobsites = useMemo(() => {
    return jobsites.filter((jobsite) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "document_only" && jobsite.source === "document_fallback") ||
        jobsite.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [
          jobsite.name,
          jobsite.location,
          jobsite.jobsiteNumber,
          jobsite.projectNumber,
          jobsite.projectManager || "",
          jobsite.safetyLead || "",
          auditCustomers.find((customer) => customer.id === jobsite.auditCustomerId)?.name || "",
          jobsite.customerCompanyName || "",
          jobsite.customerReportEmail || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [auditCustomers, jobsites, normalizedSearch, statusFilter]);

  const selectedJobsite = useMemo(() => {
    if (selectedJobsiteId !== "all") {
      return jobsites.find((jobsite) => jobsite.id === selectedJobsiteId) ?? null;
    }
    return (
      filteredJobsites.find((jobsite) => jobsite.status === "Action needed") ??
      filteredJobsites.find((jobsite) => jobsite.status === "Active") ??
      filteredJobsites.find((jobsite) => jobsite.status === "Planned") ??
      filteredJobsites[0] ??
      jobsites.find((jobsite) => jobsite.status === "Action needed") ??
      jobsites.find((jobsite) => jobsite.status === "Active") ??
      jobsites.find((jobsite) => jobsite.status === "Planned") ??
      jobsites[0] ??
      null
    );
  }, [filteredJobsites, jobsites, selectedJobsiteId]);

  const selectedJobsiteVisibleInFilters = Boolean(
    selectedJobsite && filteredJobsites.some((jobsite) => jobsite.id === selectedJobsite.id)
  );
  const selectedLinkedCustomer = selectedJobsite?.auditCustomerId
    ? auditCustomers.find((customer) => customer.id === selectedJobsite.auditCustomerId)
    : null;
  const selectedCustomerName = selectedLinkedCustomer?.name || selectedJobsite?.customerCompanyName || "Not set";
  const selectedCustomerEmail = selectedLinkedCustomer?.report_email || selectedJobsite?.customerReportEmail || "Not set";

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
          detail: "Pick a site to open its live document and activity feed.",
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
            detail: "Site submissions, uploads, and approvals will appear here as work starts moving.",
            meta: "Waiting",
            tone: "neutral" as const,
          },
        ];
  }, [referenceTime, selectedJobsite, selectedJobsiteDocuments]);

  const plannedCount = jobsites.filter((jobsite) => jobsite.status === "Planned").length;
  const actionNeededCount = jobsites.filter(
    (jobsite) => jobsite.status === "Action needed"
  ).length;
  const documentOnlyCount = jobsites.filter((jobsite) => jobsite.source === "document_fallback").length;
  const linkedJobsiteCountByCustomer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const jobsite of jobsites) {
      if (!jobsite.auditCustomerId) continue;
      counts.set(jobsite.auditCustomerId, (counts.get(jobsite.auditCustomerId) ?? 0) + 1);
    }
    return counts;
  }, [jobsites]);
  const unlinkedJobsitesCount = jobsites.filter((jobsite) => !jobsite.auditCustomerId).length;
  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    const options = activeUsers
      .map((user) => {
        const name = user.name.trim() || user.email.trim();
        if (!name) return null;
        return { id: user.id || user.email || name, name, role: user.role };
      })
      .filter((option): option is EmployeeOption => Boolean(option));

    return Array.from(new Map(options.map((option) => [option.name.toLowerCase(), option])).values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeUsers]);
  const currentProjectManagerMissing =
    composer.projectManager && !employeeOptions.some((employee) => employee.name === composer.projectManager);
  const currentSafetyLeadMissing =
    composer.safetyLead && !employeeOptions.some((employee) => employee.name === composer.safetyLead);

  function updateComposer<K extends keyof ComposerState>(key: K, value: ComposerState[K]) {
    setComposer((current) => ({ ...current, [key]: value }));
  }

  function resetComposer(jobsite?: CompanyJobsite | null) {
    setComposer(jobsite ? createComposerFromJobsite(jobsite) : EMPTY_COMPOSER);
  }

  function openNewJobsiteForm() {
    setSelectedJobsiteId("all");
    resetComposer();
    setMessage(null);
    setPanelMode("form");
  }

  function openSelectedJobsiteForm(jobsite: CompanyJobsite) {
    setSelectedJobsiteId(jobsite.id);
    resetComposer(jobsite);
    setMessage(
      jobsite.source === "document_fallback"
        ? "This document-only site is loaded into the form. Save it to create a managed jobsite."
        : "Selected jobsite loaded into the form."
    );
    setMessageTone(jobsite.source === "document_fallback" ? "warning" : "neutral");
    setPanelMode("form");
  }

  function openJobsiteDetail(jobsite: CompanyJobsite) {
    setSelectedJobsiteId(jobsite.id);
    setMessage(null);
    setPanelMode("detail");
  }

  function focusCustomerFields() {
    window.setTimeout(() => {
      document.getElementById("jobsite-customer-company")?.focus();
    }, 0);
  }

  function startAuditCustomerEntry() {
    setSelectedJobsiteId("all");
    setComposer({
      ...EMPTY_COMPOSER,
      customerCompanyName: "",
      customerReportEmail: "",
    });
    setMessage(null);
    setPanelMode("form");
    focusCustomerFields();
  }

  function loadAuditCustomerIntoComposer(customer: AuditCustomer) {
    setSelectedJobsiteId("all");
    setComposer((current) => ({
      ...current,
      auditCustomerId: customer.id,
      customerCompanyName: customer.name,
      customerReportEmail: customer.report_email ?? "",
    }));
    setMessage(`Loaded ${customer.name} into the jobsite form.`);
    setMessageTone("neutral");
    setPanelMode("form");
    focusCustomerFields();
  }

  async function handleCreateOrConvertJobsite() {
    if (!composer.name.trim()) {
      setMessage("Jobsite name is required.");
      setMessageTone("error");
      return;
    }
    if (!composer.jobsiteNumber.trim()) {
      setMessage("Jobsite number is required.");
      setMessageTone("error");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const updatingManagedJobsite = selectedJobsite?.source === "table" && selectedJobsiteId !== "all";
      const response = await fetchWithTimeout(updatingManagedJobsite ? `/api/company/jobsites/${selectedJobsite.id}` : "/api/company/jobsites", {
        method: updatingManagedJobsite ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(accessToken),
        },
        body: JSON.stringify({
          name: composer.name,
          jobsiteNumber: composer.jobsiteNumber,
          projectNumber: composer.projectNumber,
          location: composer.location,
          status: composer.status,
          projectManager: composer.projectManager,
          safetyLead: composer.safetyLead,
          zipCode: composer.zipCode,
          auditCustomerId: composer.auditCustomerId || null,
          customerCompanyName: composer.customerCompanyName,
          customerReportEmail: composer.customerReportEmail,
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
      const nextSelectedId = payload?.jobsite?.id ?? selectedJobsiteId;
      resetComposer();
      await reload();
      setSelectedJobsiteId(nextSelectedId);
      setPanelMode("detail");
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

  async function handleSaveAuditCustomer() {
    if (!composer.customerCompanyName.trim()) {
      setMessage("Customer company name is required.");
      setMessageTone("error");
      return;
    }

    setSavingCustomer(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetchWithTimeout("/api/company/audit-customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(accessToken),
        },
        body: JSON.stringify({
          name: composer.customerCompanyName,
          reportEmail: composer.customerReportEmail,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; customer?: AuditCustomer }
        | null;

      if (!response.ok) {
        setMessage(payload?.error || "Failed to save the audit customer.");
        setMessageTone("error");
        return;
      }

      const savedCustomer = payload?.customer;
      if (savedCustomer) {
        setAuditCustomers((current) => [
          ...current.filter((customer) => customer.id !== savedCustomer.id),
          savedCustomer,
        ].sort((a, b) => a.name.localeCompare(b.name)));
        updateComposer("auditCustomerId", savedCustomer.id);
      }
      setMessage(payload?.message || "Audit customer saved.");
      setMessageTone("success");
    } catch (error) {
      console.error("Failed to save audit customer:", error);
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Customer save timed out. Please try again."
          : "The audit customer could not be saved right now."
      );
      setMessageTone("error");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleJobsiteStatusChange(
    jobsite: CompanyJobsite,
    nextStatus: ComposerState["status"]
  ) {
    if (jobsite.source !== "table") {
      setMessage(
        "Convert this document-only site into a managed jobsite first, then you can control its status here."
      );
      setMessageTone("warning");
      return;
    }

    setUpdatingJobsiteId(jobsite.id);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetchWithTimeout(`/api/company/jobsites/${jobsite.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(accessToken),
        },
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
    <div className="space-y-6">
      <PageHero
        eyebrow="Company Board"
        title="Jobsites"
        description={`Find, open, and manage live jobsites for ${companyName}. Daily work starts with the directory; setup tools stay close by when you need them.`}
        actions={
          <>
            <button type="button" onClick={() => void reload()} className={appButtonSecondaryClassName}>
              {loading ? "Refreshing..." : "Refresh Jobsites"}
            </button>
            <button type="button" onClick={openNewJobsiteForm} className={appButtonPrimaryClassName}>
              Add Jobsite
            </button>
            <Link href="/company-onboarding" className={appButtonQuietClassName}>
              Import Jobsites
            </Link>
            <Link href="/submit" className={appButtonQuietClassName}>
              Submit Document
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Jobsite summary filters">
        {[
          { title: "Active", value: String(activeJobsitesCount), filter: "active", note: "Open field work" },
          { title: "Planned", value: String(plannedCount), filter: "planned", note: "Staged before work" },
          { title: "Action Needed", value: String(actionNeededCount), filter: "action needed", note: "Needs follow-up" },
          { title: "Document-only", value: String(documentOnlyCount), filter: "document_only", note: "Ready to convert" },
          { title: "Pending Docs", value: String(pendingDocuments.length), filter: "all", note: "Awaiting review" },
        ].map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => setStatusFilter(card.filter)}
            className={cx(
              "rounded-xl border bg-white p-4 text-left shadow-[0_10px_24px_rgba(44,58,86,0.055)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-24)]",
              statusFilter === card.filter ? "border-[var(--app-accent-primary)] ring-2 ring-[var(--app-accent-surface-18)]" : "border-[var(--app-border)]"
            )}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--app-muted)]">{card.title}</span>
            <span className="mt-2 block font-app-display text-3xl font-black text-[var(--app-text-strong)]">{loading ? "-" : card.value}</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">{card.note}</span>
          </button>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
        <SectionCard
          title="Jobsite Directory"
          description="Search the company workspace, pick a site, then work from the command panel."
          aside={<StatusBadge label={`${filteredJobsites.length} visible`} tone={filteredJobsites.length > 0 ? "info" : "neutral"} />}
          contentClassName="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_180px] xl:grid-cols-1 2xl:grid-cols-[1fr_180px]">
            <input
              type="search"
              aria-label="Search jobsites, project numbers, customers, or site leads"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search site, customer, lead..."
              className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="action needed">Action needed</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
              <option value="document_only">Document-only</option>
            </select>
          </div>

          {selectedJobsiteId !== "all" && selectedJobsite && !selectedJobsiteVisibleInFilters ? (
            <InlineMessage tone="warning">
              {selectedJobsite.name} is selected but hidden by the current filters.
            </InlineMessage>
          ) : null}

          {filteredJobsites.length === 0 ? (
            <EmptyState
              title={jobsites.length === 0 ? "No jobsites yet" : "No jobsites match this view"}
              description={
                jobsites.length === 0
                  ? "Add the first managed jobsite or submit a document with a project name to start the directory."
                  : "Clear the search or change the status filter to bring sites back into view."
              }
              primaryAction={jobsites.length === 0 ? { label: "Add Jobsite", onClick: openNewJobsiteForm } : undefined}
            />
          ) : (
            <div className="max-h-[74rem] space-y-3 overflow-y-auto pr-1">
              {filteredJobsites.map((jobsite) => {
                const selected = selectedJobsite?.id === jobsite.id && panelMode === "detail";
                const linkedCustomer = auditCustomers.find((customer) => customer.id === jobsite.auditCustomerId);
                const customerName = linkedCustomer?.name || jobsite.customerCompanyName || "No report customer";
                return (
                  <article
                    key={jobsite.id}
                    className={cx(
                      "rounded-xl border p-4 transition",
                      selected ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)]" : "border-[var(--app-border)] bg-white hover:border-[var(--app-accent-border-24)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openJobsiteDetail(jobsite)}
                        className="min-w-0 text-left"
                      >
                        <span className="block truncate text-base font-black text-[var(--app-text-strong)]">{jobsite.name}</span>
                        <span className="mt-1 block truncate text-xs text-[var(--app-muted)]">
                          {jobsite.location || companyLocation}
                        </span>
                      </button>
                      <StatusBadge label={jobsite.status} tone={getJobsiteTone(jobsite.status)} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--app-text)]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">Report customer: {customerName}</span>
                        <span className="font-semibold">{jobsite.pendingDocuments} pending</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[var(--app-muted)]">
                        <span>{jobsite.source === "table" ? "Managed site" : "Document-only site"}</span>
                        <span>{formatRelative(jobsite.lastActivity, referenceTime)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => openJobsiteDetail(jobsite)} className="flex-1 rounded-lg bg-[var(--app-accent-primary)] px-3 py-2 text-xs font-bold text-white">
                        View Site
                      </button>
                      <button type="button" onClick={() => openSelectedJobsiteForm(jobsite)} className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--app-text-strong)]">
                        {jobsite.source === "document_fallback" ? "Convert" : "Edit"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={panelMode === "form" ? "Jobsite Setup" : selectedJobsite ? `${selectedJobsite.name} Command Panel` : "Jobsite Command Panel"}
          description={
            panelMode === "form"
              ? "Add a managed site, edit site metadata, or convert a document-only site."
              : selectedJobsite
                ? "Review site status, documents, activity, and the next operational actions."
                : "Select a site or add a new jobsite to begin."
          }
          actions={
            panelMode === "form" ? (
              <button type="button" onClick={() => setPanelMode("detail")} className={appButtonQuietClassName}>
                Back to Site
              </button>
            ) : selectedJobsite ? (
              <button type="button" onClick={() => openSelectedJobsiteForm(selectedJobsite)} className={appButtonSecondaryClassName}>
                {selectedJobsite.source === "document_fallback" ? "Convert Site" : "Edit Site"}
              </button>
            ) : (
              <button type="button" onClick={openNewJobsiteForm} className={appButtonPrimaryClassName}>
                Add Jobsite
              </button>
            )
          }
        >
          {panelMode === "form" ? (
            <div className="space-y-5">
              {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["jobsite-name", "Jobsite Name", composer.name, "North Tower Expansion", "name"],
                  ["jobsite-number", "Jobsite Number", composer.jobsiteNumber, "SITE-0001", "jobsiteNumber"],
                  ["jobsite-project-number", "Project Number", composer.projectNumber, "PRJ-2026-014", "projectNumber"],
                  ["jobsite-location", "Location", composer.location, companyLocation, "location"],
                  ["jobsite-zip", "Jobsite ZIP", composer.zipCode, "10001", "zipCode"],
                ].map(([id, label, value, placeholder, key]) => (
                  <label key={id} htmlFor={id} className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    {label}
                    <input
                      id={id}
                      type="text"
                      value={value}
                      onChange={(event) => updateComposer(key as keyof ComposerState, event.target.value)}
                      placeholder={placeholder}
                      className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                    />
                  </label>
                ))}
                <label htmlFor="jobsite-project-manager" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Project Manager
                  <select
                    id="jobsite-project-manager"
                    value={composer.projectManager}
                    onChange={(event) => updateComposer("projectManager", event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-semibold normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                  >
                    <option value="">{employeeOptions.length ? "Select employee" : "No employees available"}</option>
                    {currentProjectManagerMissing ? <option value={composer.projectManager}>{composer.projectManager}</option> : null}
                    {employeeOptions.map((employee) => (
                      <option key={`project-manager-${employee.id}`} value={employee.name}>
                        {[employee.name, employee.role].filter(Boolean).join(" - ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="jobsite-safety-lead" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Safety Lead
                  <select
                    id="jobsite-safety-lead"
                    value={composer.safetyLead}
                    onChange={(event) => updateComposer("safetyLead", event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-semibold normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                  >
                    <option value="">{employeeOptions.length ? "Select employee" : "No employees available"}</option>
                    {currentSafetyLeadMissing ? <option value={composer.safetyLead}>{composer.safetyLead}</option> : null}
                    {employeeOptions.map((employee) => (
                      <option key={`safety-lead-${employee.id}`} value={employee.name}>
                        {[employee.name, employee.role].filter(Boolean).join(" - ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="jobsite-status" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Status
                  <select
                    id="jobsite-status"
                    value={composer.status}
                    onChange={(event) => updateComposer("status", event.target.value as ComposerState["status"])}
                    className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-semibold normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label htmlFor="jobsite-audit-customer" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Report Customer
                  <select
                    id="jobsite-audit-customer"
                    value={composer.auditCustomerId}
                    onChange={(event) => {
                      const customerId = event.target.value;
                      const customer = auditCustomers.find((item) => item.id === customerId);
                      setComposer((current) => ({
                        ...current,
                        auditCustomerId: customerId,
                        customerCompanyName: customer?.name ?? current.customerCompanyName,
                        customerReportEmail: customer?.report_email ?? current.customerReportEmail,
                      }));
                    }}
                    className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-semibold normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                  >
                    <option value="">No saved customer</option>
                    {auditCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </label>
                <label htmlFor="jobsite-customer-company" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Customer For Audit Reports
                  <input
                    id="jobsite-customer-company"
                    type="text"
                    value={composer.customerCompanyName}
                    onChange={(event) => updateComposer("customerCompanyName", event.target.value)}
                    placeholder="Customer or GC being audited"
                    className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                  />
                </label>
                <div>
                  <label htmlFor="jobsite-customer-report-email" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Report Email
                    <input
                      id="jobsite-customer-report-email"
                      type="email"
                      value={composer.customerReportEmail}
                      onChange={(event) => updateComposer("customerReportEmail", event.target.value)}
                      placeholder="customer@example.com"
                      className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSaveAuditCustomer()}
                    disabled={savingCustomer || !composer.customerCompanyName.trim()}
                    className="mt-2 rounded-lg border border-[rgba(46,158,91,0.28)] bg-[var(--semantic-success-bg)] px-3 py-2 text-xs font-bold text-[var(--semantic-success)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCustomer ? "Saving customer..." : selectedAuditCustomer ? "Save as New Customer" : "Save Customer"}
                  </button>
                </div>
                <label htmlFor="jobsite-start-date" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Start Date
                  <input id="jobsite-start-date" type="date" value={composer.startDate} onChange={(event) => updateComposer("startDate", event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]" />
                </label>
                <label htmlFor="jobsite-end-date" className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  End Date
                  <input id="jobsite-end-date" type="date" value={composer.endDate} onChange={(event) => updateComposer("endDate", event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]" />
                </label>
                <label className="md:col-span-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Site Notes
                  <textarea
                    value={composer.notes}
                    onChange={(event) => updateComposer("notes", event.target.value)}
                    rows={4}
                    placeholder="Site-specific access notes, startup requirements, or special concerns."
                    className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm leading-6 font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleCreateOrConvertJobsite()} disabled={saving} className={cx(appButtonPrimaryClassName, saving && "cursor-not-allowed opacity-60")}>
                  {saving ? "Saving..." : "Save Jobsite"}
                </button>
                {selectedJobsite ? (
                  <button type="button" onClick={() => openSelectedJobsiteForm(selectedJobsite)} className={appButtonSecondaryClassName}>
                    Reload Selected Site
                  </button>
                ) : null}
                <button type="button" onClick={() => { resetComposer(); setMessage(null); }} className={appButtonQuietClassName}>
                  Clear Form
                </button>
              </div>
            </div>
          ) : !selectedJobsite ? (
            <EmptyState
              title="Select a site or add a new jobsite"
              description="The command panel will show site details, documents, activity, and actions once a jobsite is selected."
              primaryAction={{ label: "Add Jobsite", onClick: openNewJobsiteForm }}
            />
          ) : (
            <div className="space-y-5">
              {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
              {selectedJobsite.source === "document_fallback" ? (
                <InlineMessage tone="warning">
                  This is a document-only site. Convert it to a managed site to unlock status control and richer site metadata.
                </InlineMessage>
              ) : null}
              <div className="rounded-xl border border-[var(--app-border)] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black tracking-tight text-[var(--app-text-strong)]">{selectedJobsite.name}</h2>
                      <StatusBadge label={selectedJobsite.status} tone={getJobsiteTone(selectedJobsite.status)} />
                      <StatusBadge label={`Jobsite ${selectedJobsite.jobsiteNumber}`} tone="success" />
                      <StatusBadge label={selectedJobsite.projectNumber} tone="info" />
                    </div>
                    <p className="mt-2 text-sm text-[var(--app-muted)]">{selectedJobsite.location || companyLocation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedJobsite.source === "table" ? (
                      <>
                        <Link href={`/jobsites/${encodeURIComponent(selectedJobsite.id)}/overview`} className={appButtonPrimaryClassName}>Open Jobsite</Link>
                        <Link href={`/jobsites/${encodeURIComponent(selectedJobsite.id)}/contractor-training`} className={appButtonQuietClassName}>Contractor Training</Link>
                      </>
                    ) : (
                      <button type="button" onClick={() => openSelectedJobsiteForm(selectedJobsite)} className={appButtonPrimaryClassName}>Convert Site</button>
                    )}
                    <Link href="/submit" className={appButtonSecondaryClassName}>Submit Document</Link>
                    <Link href="/upload" className={appButtonQuietClassName}>Upload File</Link>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Report Customer", selectedCustomerName],
                    ["Report Email", selectedCustomerEmail],
                    ["Jobsite Number", selectedJobsite.jobsiteNumber || "Not assigned"],
                    ["Project Number", selectedJobsite.projectNumber || "Not assigned"],
                    ["Project Manager", selectedJobsite.projectManager || "Not assigned"],
                    ["Safety Lead", selectedJobsite.safetyLead || "Not assigned"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">Site Notes</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">
                    {selectedJobsite.notes || "No site notes yet. Edit the jobsite to capture startup conditions, risk notes, and coordination details."}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Company Users", String(companyUsers.length), "Available for site coordination"],
                  ["Users Online", String(activeUsers.length), "Active in the last 20 minutes"],
                  ["Pending Site Docs", String(selectedJobsite.pendingDocuments), "Waiting on next action"],
                  ["Open Invites", String(companyInvites.length), "Waiting for account setup"],
                ].map(([title, value, note]) => (
                  <div key={title} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">{title}</p>
                    <p className="mt-2 font-app-display text-2xl font-black text-[var(--app-text-strong)]">{loading ? "-" : value}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">{note}</p>
                  </div>
                ))}
              </div>

              {selectedJobsite.source === "table" ? (
                <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--app-border)] bg-white p-3">
                  <button type="button" onClick={() => void handleJobsiteStatusChange(selectedJobsite, "active")} disabled={updatingJobsiteId === selectedJobsite.id} className={appButtonSecondaryClassName}>Mark Active</button>
                  <button type="button" onClick={() => void handleJobsiteStatusChange(selectedJobsite, "completed")} disabled={updatingJobsiteId === selectedJobsite.id} className={appButtonSecondaryClassName}>Complete Site</button>
                  <button type="button" onClick={() => void handleJobsiteStatusChange(selectedJobsite, selectedJobsite.rawStatus === "archived" ? "active" : "archived")} disabled={updatingJobsiteId === selectedJobsite.id} className={appButtonQuietClassName}>
                    {selectedJobsite.rawStatus === "archived" ? "Reactivate" : "Archive"}
                  </button>
                </div>
              ) : null}

              <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
                <div className="rounded-xl border border-[var(--app-border)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[var(--app-text-strong)]">Site Documents</h3>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">Live documents connected to this jobsite.</p>
                    </div>
                    <StatusBadge label={`${selectedJobsiteDocuments.length} file${selectedJobsiteDocuments.length === 1 ? "" : "s"}`} tone={selectedJobsiteDocuments.length > 0 ? "info" : "neutral"} />
                  </div>
                  {selectedJobsiteDocuments.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState title="No site documents yet" description="Submit or upload the first document for this jobsite to start the live record." actionHref="/submit" actionLabel="Submit Document" />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {selectedJobsiteDocuments.map((document) => (
                        <div key={document.id} className="flex flex-col gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--app-text-strong)]">{getDocumentLabel(document)}</p>
                            <p className="mt-1 truncate text-xs text-[var(--app-muted)]">{document.document_type || "Document"} - {formatRelative(document.created_at, referenceTime)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge label={getDocumentStatusLabel(document.status, Boolean(document.final_file_path))} tone={selectedJobsite.pendingDocuments > 0 ? "warning" : "success"} />
                            <Link href="/library" className="text-sm font-bold text-[var(--app-accent-primary)] hover:underline">Open</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-5">
                  <ActivityFeed title="Site Activity" description="Recent document movement and site-level work." items={selectedJobsiteActivity} />
                  <SectionCard title="Operations Readiness" description="Quick links for this jobsite." contentClassName="space-y-2">
                    {[
                      ["Users by Jobsite", `${companyUsers.length} company users available for deployment and coordination.`, "/company-users", "Open Users"],
                      ["Field iD Exchange", "Track hazards, near misses, good catches, and live field observations.", "/field-id-exchange", "Open Exchange"],
                      ["Site Reporting", "Review document status, submissions, and company-side reporting.", "/reports", "Open Reports"],
                      ["Action Items", `${pendingDocuments.length} pending document items and ${companyInvites.length} open invites need attention.`, "/dashboard", "Back to Board"],
                    ].map(([title, detail, href, label]) => (
                      <Link key={title} href={href} className="block rounded-lg border border-[var(--app-border)] bg-white px-3 py-3 transition hover:bg-[var(--app-panel-soft)]">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[var(--app-text-strong)]">{title}</span>
                          <span className="text-xs font-bold text-[var(--app-accent-primary)]">{label}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">{detail}</span>
                      </Link>
                    ))}
                  </SectionCard>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </section>

      <details className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-[0_10px_24px_rgba(44,58,86,0.055)]">
        <summary className="cursor-pointer text-base font-bold text-[var(--app-text-strong)]">
          Advanced Setup: Report Customer Directory
        </summary>
        <div id="audit-customers" className="mt-5 space-y-5 scroll-mt-28">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-3xl text-sm leading-6 text-[var(--app-muted)]">
              Save customer companies and report emails for approved field audit delivery. Jobsites can use these saved customers instead of one-off report fields.
            </p>
            <button type="button" onClick={startAuditCustomerEntry} className={appButtonPrimaryClassName}>
              Add Report Customer
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Report Customers", String(auditCustomers.length), "Saved report recipients"],
              ["Linked Jobsites", String(jobsites.length - unlinkedJobsitesCount), "Using saved customers"],
              ["Document-only Sites", String(documentOnlyCount), "Still based on document activity"],
            ].map(([title, value, note]) => (
              <div key={title} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--app-muted)]">{title}</p>
                <p className="mt-2 font-app-display text-2xl font-black text-[var(--app-text-strong)]">{loading ? "-" : value}</p>
                <p className="mt-1 text-xs text-[var(--app-muted)]">{note}</p>
              </div>
            ))}
          </div>
          {auditCustomers.length === 0 ? (
            <EmptyState title="No report customers saved yet" description="Create the first customer company and report email from this directory." primaryAction={{ label: "Add Report Customer", onClick: startAuditCustomerEntry }} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {auditCustomers.map((customer) => {
                const linkedCount = linkedJobsiteCountByCustomer.get(customer.id) ?? 0;
                return (
                  <div key={customer.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-bold text-[var(--app-text-strong)]">{customer.name}</h3>
                          <StatusBadge label={`${linkedCount} site${linkedCount === 1 ? "" : "s"}`} tone={linkedCount > 0 ? "success" : "neutral"} />
                        </div>
                        <p className="mt-1 break-all text-sm font-semibold text-[var(--app-accent-primary)]">{customer.report_email || "No report email saved"}</p>
                      </div>
                      <button type="button" onClick={() => loadAuditCustomerIntoComposer(customer)} className={appButtonSecondaryClassName}>
                        Use Customer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {unlinkedJobsitesCount > 0 ? (
            <InlineMessage tone="warning">
              {unlinkedJobsitesCount} jobsite{unlinkedJobsitesCount === 1 ? "" : "s"} still use one-off customer company and email fields.
            </InlineMessage>
          ) : null}
        </div>
      </details>
    </div>
  );
}
