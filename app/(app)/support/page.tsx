"use client";

import {
  AlertCircle,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import {
  PLATFORM_HELP_TICKET_CATEGORY_LABELS,
  PLATFORM_HELP_TICKET_PRIORITY_LABELS,
  PLATFORM_HELP_TICKET_STATUS_LABELS,
} from "@/lib/platformHelpTickets";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import {
  PLATFORM_HELP_TICKET_CATEGORIES,
  PLATFORM_HELP_TICKET_PRIORITIES,
  type PlatformHelpTicket,
  type PlatformHelpTicketCategory,
  type PlatformHelpTicketPriority,
} from "@/types/platform-support";

const inputClassName =
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function SupportPage() {
  const [category, setCategory] =
    useState<PlatformHelpTicketCategory>("bug");
  const [priority, setPriority] =
    useState<PlatformHelpTicketPriority>("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [tickets, setTickets] = useState<PlatformHelpTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "warning" | "neutral";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setTickets([]);
        return;
      }
      const response = await fetch("/api/platform/help-tickets?limit=12", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | { tickets?: PlatformHelpTicket[]; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load your help tickets.");
      }
      setTickets(data?.tickets ?? []);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load your help tickets.",
      });
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const openTicketCount = useMemo(
    () => tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
    [tickets]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("You must be signed in to submit a help ticket.");

      const response = await fetch("/api/platform/help-tickets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          priority,
          title,
          description,
          pageUrl,
          browserUserAgent:
            typeof window !== "undefined" ? window.navigator.userAgent : "",
          metadata: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ticket?: PlatformHelpTicket; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || "Help ticket could not be submitted.");
      }

      setTitle("");
      setDescription("");
      setPriority("normal");
      setMessage({
        tone: "success",
        text: "Help ticket submitted. A superadmin can now review it in the platform queue.",
      });
      await loadTickets();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Help ticket could not be submitted.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Platform Support"
        title="Help & Support"
        description="Submit platform issues, access problems, bugs, or workflow blockers directly to the superadmin queue."
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white/86 px-4 py-2 text-sm font-semibold text-[var(--app-text-strong)] shadow-sm">
            <LifeBuoy className="h-4 w-4 text-[var(--app-accent-primary)]" aria-hidden />
            {openTicketCount} open ticket{openTicketCount === 1 ? "" : "s"}
          </div>
        }
      />

      {message ? (
        <InlineMessage tone={message.tone}>{message.text}</InlineMessage>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <SectionCard
          eyebrow="New Ticket"
          title="Tell Us What Is Broken"
          description="Use this for platform issues only. Safety incidents, hazards, and urgent jobsite risks should stay in the safety workflows built for escalation."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Category
                </span>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as PlatformHelpTicketCategory)
                  }
                  className={appNativeSelectClassName}
                >
                  {PLATFORM_HELP_TICKET_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {PLATFORM_HELP_TICKET_CATEGORY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Priority
                </span>
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as PlatformHelpTicketPriority)
                  }
                  className={appNativeSelectClassName}
                >
                  {PLATFORM_HELP_TICKET_PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {PLATFORM_HELP_TICKET_PRIORITY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClassName}
                maxLength={160}
                placeholder="Example: Cannot open uploaded CSEP preview"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${inputClassName} min-h-40 resize-y leading-6`}
                maxLength={4000}
                placeholder="What happened, what you expected, and any steps that reproduce the issue."
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                Page URL
              </span>
              <input
                value={pageUrl}
                onChange={(event) => setPageUrl(event.target.value)}
                className={inputClassName}
                maxLength={2048}
                placeholder="The page where the issue happened"
              />
            </label>

            <div className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3 text-sm text-[var(--app-text)] sm:flex-row sm:items-start">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--semantic-warning)]" aria-hidden />
              <p className="leading-6">
                Critical platform tickets should describe a platform outage, data access issue,
                or blocked safety workflow. Immediate jobsite danger should be escalated through
                your safety chain of command.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`${appButtonPrimaryClassName} w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="My Tickets"
          title="Recent Support Requests"
          description="Superadmin responses and status changes stay attached to the ticket record."
        >
          {loadingTickets ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-[var(--semantic-success)]" aria-hidden />
              <p className="mt-2 text-sm font-bold text-[var(--app-text-strong)]">
                No support tickets yet
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                Submitted platform issues will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[0_8px_18px_rgba(76,108,161,0.04)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 text-sm font-bold text-[var(--app-text-strong)]">
                      {ticket.title}
                    </h3>
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
                    <span className="rounded-full bg-[var(--app-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)]">
                      {PLATFORM_HELP_TICKET_CATEGORY_LABELS[ticket.category]}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--app-text)]">
                    {ticket.description}
                  </p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Submitted {formatDate(ticket.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

