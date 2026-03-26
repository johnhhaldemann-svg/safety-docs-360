"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
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
  useCompanyWorkspaceData,
} from "@/components/company-workspace/useCompanyWorkspaceData";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CorrectiveActionRow = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "closed";
  assigned_user_id: string | null;
  due_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  manager_override_close: boolean;
  manager_override_reason: string | null;
  evidence_count?: number;
  latest_evidence_path?: string | null;
  created_at: string;
  updated_at: string;
};

type CreateActionState = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  jobsiteId: string;
  assignedUserId: string;
  dueAt: string;
};

type EvidenceComposerState = {
  file: File | null;
};

type EvidenceRow = {
  id: string;
  action_id: string;
  company_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
};

const EMPTY_CREATE_ACTION: CreateActionState = {
  title: "",
  description: "",
  severity: "medium",
  jobsiteId: "",
  assignedUserId: "",
  dueAt: "",
};

const EMPTY_EVIDENCE_COMPOSER: EvidenceComposerState = {
  file: null,
};

function getSeverityTone(severity: CorrectiveActionRow["severity"]) {
  if (severity === "critical" || severity === "high") return "error" as const;
  if (severity === "medium") return "warning" as const;
  return "info" as const;
}

function getStatusTone(status: CorrectiveActionRow["status"]) {
  if (status === "open") return "warning" as const;
  if (status === "in_progress") return "info" as const;
  return "success" as const;
}

function getStatusLabel(status: CorrectiveActionRow["status"]) {
  if (status === "in_progress") return "In Progress";
  if (status === "closed") return "Closed";
  return "Open";
}

function getSeverityLabel(severity: CorrectiveActionRow["severity"]) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export default function FieldIdExchangePage() {
  const {
    companyName,
    companyLocation,
    pendingDocuments,
    pendingUsers,
    companyInvites,
    jobsites,
    companyUsers,
    referenceTime,
  } = useCompanyWorkspaceData();

  const [actions, setActions] = useState<CorrectiveActionRow[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [jobsiteFilter, setJobsiteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [composer, setComposer] = useState<CreateActionState>(EMPTY_CREATE_ACTION);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">(
    "neutral"
  );
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);
  const [openEvidenceComposerId, setOpenEvidenceComposerId] = useState<string | null>(null);
  const [evidenceComposer, setEvidenceComposer] =
    useState<EvidenceComposerState>(EMPTY_EVIDENCE_COMPOSER);
  const [openingProofActionId, setOpeningProofActionId] = useState<string | null>(null);
  const [openProofHistoryActionId, setOpenProofHistoryActionId] = useState<string | null>(null);
  const [proofHistoryByActionId, setProofHistoryByActionId] = useState<
    Record<string, EvidenceRow[]>
  >({});
  const [loadingProofHistoryActionId, setLoadingProofHistoryActionId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadActions() {
      setLoadingActions(true);
      try {
        const response = await fetch("/api/company/corrective-actions");
        const payload = (await response.json().catch(() => null)) as
          | { actions?: CorrectiveActionRow[]; error?: string }
          | null;
        if (!ignore) {
          if (!response.ok) {
            setActions([]);
            setMessage(payload?.error || "Unable to load corrective actions.");
            setMessageTone("error");
          } else {
            setActions(payload?.actions ?? []);
          }
        }
      } catch (error) {
        if (!ignore) {
          console.error("Failed to load corrective actions:", error);
          setActions([]);
          setMessage("Unable to load corrective actions right now.");
          setMessageTone("error");
        }
      } finally {
        if (!ignore) {
          setLoadingActions(false);
        }
      }
    }

    void loadActions();
    return () => {
      ignore = true;
    };
  }, []);

  const assigneeLabelById = useMemo(() => {
    const next = new Map<string, string>();
    for (const user of companyUsers) {
      next.set(user.id, user.name || user.email);
    }
    return next;
  }, [companyUsers]);

  const jobsiteNameById = useMemo(() => {
    const next = new Map<string, string>();
    for (const jobsite of jobsites) {
      next.set(jobsite.id, jobsite.name);
    }
    return next;
  }, [jobsites]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return actions.filter((item) => {
      const actionJobsite = item.jobsite_id ? (jobsiteNameById.get(item.jobsite_id) ?? "") : "";
      const matchesJobsite = jobsiteFilter === "all" || actionJobsite === jobsiteFilter;
      const statusLabel = getStatusLabel(item.status);
      const matchesStatus = statusFilter === "all" || statusLabel === statusFilter;
      const ownerLabel = item.assigned_user_id
        ? (assigneeLabelById.get(item.assigned_user_id) ?? "Assigned User")
        : "Unassigned";
      const matchesSearch =
        !normalizedSearch ||
        [
          item.title,
          item.description || "",
          ownerLabel,
          actionJobsite || "General Workspace",
          getSeverityLabel(item.severity),
          statusLabel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesJobsite && matchesStatus && matchesSearch;
    });
  }, [actions, assigneeLabelById, jobsiteFilter, jobsiteNameById, normalizedSearch, statusFilter]);

  const openCount = filteredItems.filter((item) => item.status === "open").length;
  const inProgressCount = filteredItems.filter((item) => item.status === "in_progress").length;
  const closedCount = filteredItems.filter((item) => item.status === "closed").length;
  const overdueCount = filteredItems.filter(
    (item) => item.status !== "closed" && item.due_at && new Date(item.due_at).getTime() < referenceTime
  ).length;
  const coveredJobsites = new Set(
    filteredItems
      .map((item) => (item.jobsite_id ? jobsiteNameById.get(item.jobsite_id) ?? "" : "General Workspace"))
      .filter(Boolean)
  ).size;

  const activityItems = filteredItems.map((item) => ({
    id: item.id,
    title: item.title,
    detail: `${getSeverityLabel(item.severity)} severity · ${getStatusLabel(item.status)}`,
    meta: `Updated ${formatRelative(item.updated_at, referenceTime)}`,
    tone: getSeverityTone(item.severity),
  }));

  async function reloadActions() {
    setLoadingActions(true);
    try {
      const response = await fetch("/api/company/corrective-actions");
      const payload = (await response.json().catch(() => null)) as
        | { actions?: CorrectiveActionRow[]; error?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Unable to load corrective actions.");
        setMessageTone("error");
        return;
      }
      setActions(payload?.actions ?? []);
    } catch (error) {
      console.error("Failed to reload corrective actions:", error);
      setMessage("Unable to refresh corrective actions right now.");
      setMessageTone("error");
    } finally {
      setLoadingActions(false);
    }
  }

  async function createAction() {
    if (!composer.title.trim()) {
      setMessage("Issue title is required.");
      setMessageTone("error");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/company/corrective-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: composer.title,
          description: composer.description,
          severity: composer.severity,
          jobsiteId: composer.jobsiteId,
          assignedUserId: composer.assignedUserId,
          dueAt: composer.dueAt,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to create corrective action.");
        setMessageTone("error");
        return;
      }
      setComposer(EMPTY_CREATE_ACTION);
      setMessage(payload?.message || "Corrective action created.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to create corrective action:", error);
      setMessage("Failed to create corrective action right now.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(action: CorrectiveActionRow, nextStatus: "open" | "in_progress") {
    setUpdatingActionId(action.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/corrective-actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to update action status.");
        setMessageTone("error");
        return;
      }
      setMessage(payload?.message || "Action status updated.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to update action:", error);
      setMessage("Failed to update action right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function closeAction(actionId: string) {
    const managerOverride = window.confirm(
      "Close with manager override if no photo proof is available?\nSelect Cancel to require photo proof."
    );
    const managerOverrideReason = managerOverride
      ? window.prompt("Enter manager override reason:")?.trim() ?? ""
      : "";

    if (managerOverride && !managerOverrideReason) {
      setMessage("Manager override reason is required.");
      setMessageTone("error");
      return;
    }

    setUpdatingActionId(actionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/corrective-actions/${actionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerOverride,
          managerOverrideReason: managerOverride ? managerOverrideReason : undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to close corrective action.");
        setMessageTone("error");
        return;
      }
      setMessage(payload?.message || "Corrective action closed.");
      setMessageTone("success");
      await reloadActions();
    } catch (error) {
      console.error("Failed to close corrective action:", error);
      setMessage("Failed to close corrective action right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function attachProof(actionId: string) {
    if (!evidenceComposer.file) {
      setMessage("Select a proof photo before saving.");
      setMessageTone("error");
      return;
    }

    setUpdatingActionId(actionId);
    setMessage(null);
    try {
      const safeFileName = `${Date.now()}-${evidenceComposer.file.name.replace(/\s+/g, "-")}`;
      const filePath = `corrective-actions/${actionId}/${safeFileName}`;
      const uploadResult = await supabase.storage
        .from("documents")
        .upload(filePath, evidenceComposer.file, { upsert: false });

      if (uploadResult.error) {
        setMessage(`Proof upload failed: ${uploadResult.error.message}`);
        setMessageTone("error");
        return;
      }

      const response = await fetch(`/api/company/corrective-actions/${actionId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: uploadResult.data?.path ?? filePath,
          fileName: evidenceComposer.file.name,
          mimeType: evidenceComposer.file.type || "image/jpeg",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to attach completion proof.");
        setMessageTone("error");
        return;
      }

      setMessage(payload?.message || "Completion proof attached.");
      setMessageTone("success");
      setOpenEvidenceComposerId(null);
      setEvidenceComposer(EMPTY_EVIDENCE_COMPOSER);
      await reloadActions();
    } catch (error) {
      console.error("Failed to attach completion proof:", error);
      setMessage("Failed to attach completion proof right now.");
      setMessageTone("error");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function openLatestProof(action: CorrectiveActionRow) {
    if (!action.latest_evidence_path) {
      setMessage("No proof file is available to open yet.");
      setMessageTone("warning");
      return;
    }

    setOpeningProofActionId(action.id);
    setMessage(null);
    try {
      const signed = await supabase.storage
        .from("documents")
        .createSignedUrl(action.latest_evidence_path, 60);
      if (signed.error || !signed.data?.signedUrl) {
        setMessage(signed.error?.message || "Failed to open proof file.");
        setMessageTone("error");
        return;
      }

      window.open(signed.data.signedUrl, "_blank");
    } catch (error) {
      console.error("Failed to open proof file:", error);
      setMessage("Failed to open proof file right now.");
      setMessageTone("error");
    } finally {
      setOpeningProofActionId(null);
    }
  }

  async function openProofFile(actionId: string, filePath: string) {
    setOpeningProofActionId(actionId);
    setMessage(null);
    try {
      const signed = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
      if (signed.error || !signed.data?.signedUrl) {
        setMessage(signed.error?.message || "Failed to open proof file.");
        setMessageTone("error");
        return;
      }
      window.open(signed.data.signedUrl, "_blank");
    } catch (error) {
      console.error("Failed to open proof file:", error);
      setMessage("Failed to open proof file right now.");
      setMessageTone("error");
    } finally {
      setOpeningProofActionId(null);
    }
  }

  async function toggleProofHistory(actionId: string) {
    if (openProofHistoryActionId === actionId) {
      setOpenProofHistoryActionId(null);
      return;
    }

    setOpenProofHistoryActionId(actionId);
    if (proofHistoryByActionId[actionId]) {
      return;
    }

    setLoadingProofHistoryActionId(actionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/company/corrective-actions/${actionId}/evidence/list`);
      const payload = (await response.json().catch(() => null)) as
        | { evidence?: EvidenceRow[]; error?: string }
        | null;
      if (!response.ok) {
        setMessage(payload?.error || "Failed to load proof history.");
        setMessageTone("error");
        return;
      }

      setProofHistoryByActionId((current) => ({
        ...current,
        [actionId]: payload?.evidence ?? [],
      }));
    } catch (error) {
      console.error("Failed to load proof history:", error);
      setMessage("Failed to load proof history right now.");
      setMessageTone("error");
    } finally {
      setLoadingProofHistoryActionId(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Company Board"
        title="Field iD Exchange"
        description={`Track hazards and corrective actions for ${companyName} with assignees, due dates, reminders, and closure controls.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setComposer(EMPTY_CREATE_ACTION);
                setMessage(null);
              }}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              New Corrective Action
            </button>
            <Link
              href="/upload"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Upload Field Photo
            </Link>
          </>
        }
      />

      <InlineMessage tone="neutral">
        Safety issue tracking is now backed by dedicated corrective-action data. Closing an issue
        requires photo proof unless a manager override is recorded.
      </InlineMessage>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Open Items",
            value: String(openCount),
            note: "Issues that need assignment or immediate action",
          },
          {
            title: "In Progress",
            value: String(inProgressCount),
            note: "Issues actively being worked in the field",
          },
          {
            title: "Overdue",
            value: String(overdueCount),
            note: "Open or active issues past their due date",
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Create Corrective Action"
          description="Create issue, assign owner, set due date, and track closure proof."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Issue title
              </label>
              <input
                type="text"
                value={composer.title}
                onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
                placeholder="Unsecured ladder access on west elevation"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Description
              </label>
              <textarea
                value={composer.description}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Severity
              </label>
              <select
                value={composer.severity}
                onChange={(event) =>
                  setComposer((current) => ({
                    ...current,
                    severity: event.target.value as CreateActionState["severity"],
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Jobsite
              </label>
              <select
                value={composer.jobsiteId}
                onChange={(event) => setComposer((current) => ({ ...current, jobsiteId: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
              >
                <option value="">General Workspace</option>
                {jobsites.map((jobsite) => (
                  <option key={jobsite.id} value={jobsite.id}>
                    {jobsite.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Assign to
              </label>
              <select
                value={composer.assignedUserId}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, assignedUserId: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
              >
                <option value="">Unassigned</option>
                {companyUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Due date
              </label>
              <input
                type="date"
                value={composer.dueAt}
                onChange={(event) => setComposer((current) => ({ ...current, dueAt: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
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
              onClick={() => void createAction()}
              disabled={saving}
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Create Issue"}
            </button>
            <button
              type="button"
              onClick={() => setComposer(EMPTY_CREATE_ACTION)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Live Exchange Feed"
          description="Assign, move to in progress, upload proof, then close with accountability."
        >
          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search issue, assignee, or severity..."
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
            <select
              value={jobsiteFilter}
              onChange={(event) => setJobsiteFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500"
            >
              <option value="all">All jobsites</option>
              {[...jobsites.map((jobsite) => jobsite.name)].map((name) => (
                <option key={name} value={name}>
                  {name}
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
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {loadingActions ? (
            <EmptyState title="Loading corrective actions" description="Please wait..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No field items match this view"
              description="Create an issue or adjust the filters to see corrective action workflow items."
            />
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <StatusBadge label="Corrective Action" tone="info" />
                        <StatusBadge label={getSeverityLabel(item.severity)} tone={getSeverityTone(item.severity)} />
                        <StatusBadge label={getStatusLabel(item.status)} tone={getStatusTone(item.status)} />
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {item.jobsite_id
                          ? (jobsiteNameById.get(item.jobsite_id) ?? "Jobsite")
                          : "General Workspace"}{" "}
                        -{" "}
                        {item.assigned_user_id
                          ? (assigneeLabelById.get(item.assigned_user_id) ?? "Assigned user")
                          : "Unassigned"}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {item.description || "No description provided."}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {item.due_at
                          ? `Due ${formatRelative(item.due_at, referenceTime)}`
                          : "No due date"}
                        {item.status !== "closed" &&
                        item.due_at &&
                        new Date(item.due_at).getTime() < referenceTime
                          ? " · Overdue"
                          : ""}
                        {` · Proof photos: ${item.evidence_count ?? 0}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">
                        Updated {formatRelative(item.updated_at, referenceTime)}
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {item.status === "open" ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "in_progress")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Start Work
                          </button>
                        ) : null}
                        {item.status === "in_progress" ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(item, "open")}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Reopen
                          </button>
                        ) : null}
                        {item.status !== "closed" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenEvidenceComposerId(
                                openEvidenceComposerId === item.id ? null : item.id
                              );
                              setEvidenceComposer(EMPTY_EVIDENCE_COMPOSER);
                            }}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            Add Proof
                          </button>
                        ) : null}
                        {(item.evidence_count ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => void openLatestProof(item)}
                            disabled={openingProofActionId === item.id}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {openingProofActionId === item.id ? "Opening..." : "View Latest Proof"}
                          </button>
                        ) : null}
                        {(item.evidence_count ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => void toggleProofHistory(item.id)}
                            disabled={loadingProofHistoryActionId === item.id}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {openProofHistoryActionId === item.id
                              ? "Hide Proof History"
                              : loadingProofHistoryActionId === item.id
                                ? "Loading..."
                                : "Proof History"}
                          </button>
                        ) : null}
                        {item.status !== "closed" ? (
                          <button
                            type="button"
                            onClick={() => void closeAction(item.id)}
                            disabled={updatingActionId === item.id}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            Close Issue
                          </button>
                        ) : (
                          <StatusBadge label="Closed" tone="success" />
                        )}
                      </div>
                      {openEvidenceComposerId === item.id ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setEvidenceComposer((current) => ({
                                ...current,
                                file: event.target.files?.[0] ?? null,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-500"
                          />
                          {evidenceComposer.file ? (
                            <div className="text-xs text-slate-500">
                              Selected: {evidenceComposer.file.name}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void attachProof(item.id)}
                            disabled={updatingActionId === item.id}
                            className="w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Save Proof
                          </button>
                        </div>
                      ) : null}
                      {openProofHistoryActionId === item.id ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-left">
                          {loadingProofHistoryActionId === item.id ? (
                            <div className="text-xs text-slate-500">Loading proof history...</div>
                          ) : (proofHistoryByActionId[item.id] ?? []).length === 0 ? (
                            <div className="text-xs text-slate-500">
                              No proof files found for this issue yet.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(proofHistoryByActionId[item.id] ?? []).map((proof) => (
                                <div
                                  key={proof.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                >
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      {proof.file_name}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {formatRelative(proof.created_at, referenceTime)}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void openProofFile(item.id, proof.file_path)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                  >
                                    Open
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Reminder Signals"
            description="In-app reminders highlight overdue actions and unresolved safety accountability."
          >
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">Overdue corrective actions</div>
                <div className="mt-1 text-xs text-slate-500">
                  {overdueCount} overdue, {closedCount} closed.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">Pending user approvals</div>
                <div className="mt-1 text-xs text-slate-500">
                  {pendingUsers.length} account(s) still waiting for company approval.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">Unaccepted invites</div>
                <div className="mt-1 text-xs text-slate-500">
                  {companyInvites.length} invite(s) have not joined yet.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">Pending documents</div>
                <div className="mt-1 text-xs text-slate-500">
                  {pendingDocuments.length} document(s) still need review.
                </div>
              </div>
            </div>
          </SectionCard>

          <ActivityFeed
            title="Recent Exchange Activity"
            description="The latest field-side movement across your company workspace."
            items={
              activityItems.length > 0
                ? activityItems
                : [
                    {
                      id: "no-exchange-activity",
                      title: "No field activity yet",
                      detail: "Field signals will show up here as work starts moving through the workspace.",
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
