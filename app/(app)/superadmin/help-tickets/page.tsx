"use client";

import {
  CheckCircle2,
  Eye,
  Inbox,
  Loader2,
  RefreshCcw,
  Save,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonQuietClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import {
  PLATFORM_HELP_TICKET_CATEGORY_LABELS,
  PLATFORM_HELP_TICKET_PRIORITY_LABELS,
  PLATFORM_HELP_TICKET_STATUS_LABELS,
} from "@/lib/platformHelpTickets";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import {
  PLATFORM_HELP_TICKET_PRIORITIES,
  PLATFORM_HELP_TICKET_STATUSES,
  type PlatformHelpTicket,
  type PlatformHelpTicketPriority,
  type PlatformHelpTicketStatus,
  type PlatformHelpTicketSummary,
} from "@/types/platform-support";

type FilterValue<T extends string> = T | "all";

const textareaClassName =
  "w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--app-text-strong)] shadow-[0_4px_10px_rgba(76,108,161,0.035)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]";

function priorityTone(priority: string) {
  if (priority === "critical") return "error" as const;
  if (priority === "high") return "warning" as const;
  return "info" as const;
}

function statusTone(status: string) {
  if (status === "resolved" || status === "closed") return "success" as const;
  if (status === "waiting_on_user") return "warning" as const;
  if (status === "in_progress") return "info" as const;
  return "neutral" as const;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function summaryFallback(): PlatformHelpTicketSummary {
  return {
    total: 0,
    open: 0,
    inProgress: 0,
    waitingOnUser: 0,
    resolved: 0,
    closed: 0,
    unseen: 0,
    critical: 0,
    high: 0,
  };
}

export default function SuperadminHelpTicketsPage() {
  const [tickets, setTickets] = useState<PlatformHelpTicket[]>([]);
  const [summary, setSummary] = useState<PlatformHelpTicketSummary>(summaryFallback);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<PlatformHelpTicketStatus>>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<FilterValue<PlatformHelpTicketPriority>>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "warning" | "neutral";
    text: string;
  } | null>(null);
  const [draft, setDraft] = useState<{
    status: PlatformHelpTicketStatus;
    priority: PlatformHelpTicketPriority;
    adminNotes: string;
    resolutionNote: string;
  } | null>(null);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null,
    [selectedId, tickets]
  );

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setSelectedId(selected.id);
    setDraft({
      status: selected.status,
      priority: selected.priority,
      adminNotes: selected.adminNotes ?? "",
      resolutionNote: selected.resolutionNote ?? "",
    });
  }, [selected]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Missing session token.");
      const params = new URLSearchParams({ limit: "150" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      const response = await fetch(`/api/superadmin/help-tickets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            tickets?: PlatformHelpTicket[];
            summary?: PlatformHelpTicketSummary;
            error?: string;
          }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load help tickets.");
      }
      const nextTickets = data?.tickets ?? [];
      setTickets(nextTickets);
      setSummary(data?.summary ?? summaryFallback());
      setSelectedId((current) =>
        current && nextTickets.some((ticket) => ticket.id === current)
          ? current
          : nextTickets[0]?.id ?? null
      );
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load help tickets.",
      });
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getSupabaseAccessToken();
      if (!token) return;
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | { user?: { id?: string } }
        | null;
      if (!cancelled) {
        setCurrentUserId(data?.user?.id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function patchTicket(
    ticket: PlatformHelpTicket,
    body: Record<string, unknown>,
    successText: string
  ) {
    setSaving(true);
    setMessage(null);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Missing session token.");
      const response = await fetch(
        `/api/superadmin/help-tickets/${encodeURIComponent(ticket.id)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      const data = (await response.json().catch(() => null)) as
        | { ticket?: PlatformHelpTicket; error?: string }
        | null;
      if (!response.ok || !data?.ticket) {
        throw new Error(data?.error || "Ticket update failed.");
      }
      setTickets((current) =>
        current.map((item) => (item.id === data.ticket?.id ? data.ticket : item))
      );
      setMessage({ tone: "success", text: successText });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Ticket update failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!selected || !draft) return;
    await patchTicket(
      selected,
      {
        status: draft.status,
        priority: draft.priority,
        adminNotes: draft.adminNotes,
        resolutionNote: draft.resolutionNote,
        markSeen: true,
      },
      "Help ticket updated."
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Superadmin"
        title="Help Tickets"
        description="Review platform issue tickets submitted by signed-in users, mark them seen, assign ownership, and track resolution."
        actions={
          <button
            type="button"
            onClick={() => void loadTickets()}
            className={appButtonSecondaryClassName}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      {message ? <InlineMessage tone={message.tone}>{message.text}</InlineMessage> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Unseen
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">
            {summary.unseen}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Open
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">
            {summary.open + summary.inProgress + summary.waitingOnUser}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Critical
          </p>
          <p className="mt-2 text-3xl font-bold text-red-700">{summary.critical}</p>
        </div>
        <div className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Total In View
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">
            {summary.total}
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(28rem,1fr)]">
        <SectionCard
          eyebrow="Queue"
          title="Submitted Tickets"
          description="Filter the queue by status and priority. Unseen open tickets stay highlighted."
          actions={
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as FilterValue<PlatformHelpTicketStatus>)
                }
                className={appNativeSelectClassName}
                aria-label="Filter tickets by status"
              >
                <option value="all">All statuses</option>
                {PLATFORM_HELP_TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PLATFORM_HELP_TICKET_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value as FilterValue<PlatformHelpTicketPriority>
                  )
                }
                className={appNativeSelectClassName}
                aria-label="Filter tickets by priority"
              >
                <option value="all">All priorities</option>
                {PLATFORM_HELP_TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PLATFORM_HELP_TICKET_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white px-4 py-10 text-center">
              <Inbox className="mx-auto h-5 w-5 text-[var(--app-muted)]" aria-hidden />
              <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
                No tickets match this view
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const active = selected?.id === ticket.id;
                const unseen = !ticket.superadminSeenAt && !["resolved", "closed"].includes(ticket.status);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={`block w-full rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-[var(--app-accent-border-24)] bg-[var(--app-accent-primary-soft)] shadow-sm"
                        : unseen
                          ? "border-amber-200 bg-amber-50/60 hover:bg-amber-50"
                          : "border-[var(--app-border)] bg-white hover:bg-[var(--app-panel-soft)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {unseen ? (
                            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                          ) : null}
                          <p className="truncate text-sm font-bold text-[var(--app-text-strong)]">
                            {ticket.title}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--app-muted)]">
                          {ticket.submitterEmail || "Unknown user"} · {ticket.companyName || "No company"}
                        </p>
                      </div>
                      <StatusBadge
                        label={PLATFORM_HELP_TICKET_PRIORITY_LABELS[ticket.priority]}
                        tone={priorityTone(ticket.priority)}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge
                        label={PLATFORM_HELP_TICKET_STATUS_LABELS[ticket.status]}
                        tone={statusTone(ticket.status)}
                      />
                      <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)] ring-1 ring-[var(--app-border)]">
                        {PLATFORM_HELP_TICKET_CATEGORY_LABELS[ticket.category]}
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      Submitted {formatDate(ticket.createdAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Detail"
          title={selected ? selected.title : "Select a Ticket"}
          description={
            selected
              ? "Review context, update status, and leave notes for superadmin follow-up."
              : "Choose a help ticket from the queue."
          }
        >
          {!selected || !draft ? (
            <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white px-4 py-10 text-center">
              <ShieldAlert className="mx-auto h-5 w-5 text-[var(--app-muted)]" aria-hidden />
              <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
                No ticket selected
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Submitter
                  </p>
                  <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
                    {selected.submitterName || selected.submitterEmail || "Unknown user"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">
                    {selected.submitterEmail || "No email"} · {selected.submitterRole || "No role"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Workspace
                  </p>
                  <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
                    {selected.companyName || "No company"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">
                    Seen {formatDate(selected.superadminSeenAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Description
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">
                  {selected.description}
                </p>
                {selected.pageUrl ? (
                  <a
                    href={selected.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block break-all text-xs font-semibold text-[var(--app-accent-primary)]"
                  >
                    {selected.pageUrl}
                  </a>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    Status
                  </span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              status: event.target.value as PlatformHelpTicketStatus,
                            }
                          : current
                      )
                    }
                    className={appNativeSelectClassName}
                  >
                    {PLATFORM_HELP_TICKET_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {PLATFORM_HELP_TICKET_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    Priority
                  </span>
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              priority: event.target.value as PlatformHelpTicketPriority,
                            }
                          : current
                      )
                    }
                    className={appNativeSelectClassName}
                  >
                    {PLATFORM_HELP_TICKET_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {PLATFORM_HELP_TICKET_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Admin Notes
                </span>
                <textarea
                  value={draft.adminNotes}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, adminNotes: event.target.value } : current
                    )
                  }
                  className={`${textareaClassName} min-h-28 resize-y leading-6`}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Resolution Note
                </span>
                <textarea
                  value={draft.resolutionNote}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, resolutionNote: event.target.value } : current
                    )
                  }
                  className={`${textareaClassName} min-h-24 resize-y leading-6`}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  Save Updates
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void patchTicket(selected, { markSeen: true }, "Ticket marked seen.")
                  }
                  disabled={saving}
                  className={appButtonSecondaryClassName}
                >
                  <Eye className="h-4 w-4" aria-hidden />
                  Mark Seen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    currentUserId
                      ? void patchTicket(
                          selected,
                          { assignedSuperadminUserId: currentUserId, markSeen: true },
                          "Ticket assigned to you."
                        )
                      : setMessage({
                          tone: "error",
                          text: "Could not load your superadmin user id.",
                        })
                  }
                  disabled={saving}
                  className={appButtonQuietClassName}
                >
                  <UserCheck className="h-4 w-4" aria-hidden />
                  Assign to Me
                </button>
                {selected.status !== "resolved" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void patchTicket(
                        selected,
                        { status: "resolved", markSeen: true },
                        "Ticket marked resolved."
                      )
                    }
                    disabled={saving}
                    className={appButtonQuietClassName}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Resolve
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
