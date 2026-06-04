"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react";
import {
  PLATFORM_HELP_TICKET_CATEGORY_LABELS,
  PLATFORM_HELP_TICKET_PRIORITY_LABELS,
  PLATFORM_HELP_TICKET_STATUS_LABELS,
} from "@/lib/platformHelpTickets";
import { deferEffect } from "@/lib/deferredEffect";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import {
  PLATFORM_HELP_TICKET_CATEGORIES,
  PLATFORM_HELP_TICKET_PRIORITIES,
  type PlatformHelpTicket,
  type PlatformHelpTicketCategory,
  type PlatformHelpTicketPriority,
} from "@/types/platform-support";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const selectClassName =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function priorityClassName(priority: string) {
  if (priority === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-100 bg-blue-50 text-blue-700";
}

function statusClassName(status: string) {
  if (status === "resolved" || status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "waiting_on_user") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "in_progress") return "border-blue-100 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
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

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", className)}>
      {children}
    </span>
  );
}

export function SafePredictSupport() {
  const [category, setCategory] = useState<PlatformHelpTicketCategory>("bug");
  const [priority, setPriority] = useState<PlatformHelpTicketPriority>("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [tickets, setTickets] = useState<PlatformHelpTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => deferEffect(() => {
    setPageUrl(window.location.href);
  }), []);

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
      if (!response.ok) throw new Error(data?.error || "Could not load your help tickets.");
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

  useEffect(() => deferEffect(() => {
    void loadTickets();
  }), [loadTickets]);

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
          browserUserAgent: window.navigator.userAgent,
          metadata: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            surface: "safe-predict",
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ticket?: PlatformHelpTicket; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Help ticket could not be submitted.");

      setTitle("");
      setDescription("");
      setPriority("normal");
      setMessage({ tone: "success", text: "Help ticket submitted. A superadmin can now review it." });
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
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Help & Support"
        subtitle="Send platform issues, access problems, bugs, or workflow blockers to the SafePredict support queue."
        actions={
          <div className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-black text-blue-700">
            <LifeBuoy className="h-4 w-4" aria-hidden />
            {openTicketCount} open ticket{openTicketCount === 1 ? "" : "s"}
          </div>
        }
      />

      {message ? (
        <div
          className={cx(
            "mb-5 rounded-lg border px-4 py-3 text-sm font-bold",
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <Card className="p-5">
          <SectionTitle title="Tell Us What Is Broken" hint={false} />
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Use this for platform issues only. Safety incidents, hazards, and urgent jobsite risks should stay in the safety workflows built for escalation.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PlatformHelpTicketCategory)}
                  className={selectClassName}
                >
                  {PLATFORM_HELP_TICKET_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {PLATFORM_HELP_TICKET_CATEGORY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as PlatformHelpTicketPriority)}
                  className={selectClassName}
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
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Title</span>
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
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Description</span>
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
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Page URL</span>
              <input
                value={pageUrl}
                onChange={(event) => setPageUrl(event.target.value)}
                className={inputClassName}
                maxLength={2048}
                placeholder="The page where the issue happened"
              />
            </label>

            <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Immediate jobsite danger should be escalated through your safety chain of command, not through a platform ticket.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-[0_12px_22px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Recent Support Requests" hint={false} />
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Superadmin responses and status changes stay attached to the ticket record.
          </p>

          <div className="mt-5">
            {loadingTickets ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-700" aria-hidden />
                <p className="mt-2 text-sm font-black text-slate-950">No support tickets yet</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Submitted platform issues will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 text-sm font-black text-slate-950">{ticket.title}</h3>
                      <Pill className={priorityClassName(ticket.priority)}>
                        {PLATFORM_HELP_TICKET_PRIORITY_LABELS[ticket.priority]}
                      </Pill>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill className={statusClassName(ticket.status)}>
                        {PLATFORM_HELP_TICKET_STATUS_LABELS[ticket.status]}
                      </Pill>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-500">
                        {PLATFORM_HELP_TICKET_CATEGORY_LABELS[ticket.category]}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{ticket.description}</p>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-slate-400">
                      Submitted {formatDate(ticket.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
