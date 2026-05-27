"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Check, Clock, Copy, Database, Gauge, ShieldCheck, Ticket, UserCheck } from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  MetricTile,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { buildSuperadminHealthCodexPrompt } from "@/lib/superadmin/health/codexPrompt";
import type { SuperadminHealthScore } from "@/lib/superadmin/health/types";

const supabase = getSupabaseBrowserClient();

type HealthPayload = {
  score: SuperadminHealthScore | null;
  events: Array<Record<string, unknown>>;
  changes: Array<Record<string, unknown>>;
  owners: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(raw));
  } catch {
    return raw;
  }
}

function scoreTone(score: number | null | undefined): "success" | "warning" | "error" | "neutral" {
  if (score == null) return "neutral";
  if (score >= 85) return "success";
  if (score >= 70) return "warning";
  return "error";
}

function severityTone(value: unknown): "success" | "warning" | "error" | "neutral" {
  const severity = text(value).toLowerCase();
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "low") return "success";
  return "neutral";
}

function buildQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }
  return params.toString();
}

function CompactRow({
  title,
  detail,
  badge,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  badge: string;
  tone?: "success" | "warning" | "error" | "neutral" | "info";
}) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-white/86 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{detail}</p>
        </div>
        <StatusBadge label={badge} tone={tone} />
      </div>
    </div>
  );
}

export default function SuperadminHealthPage() {
  const [payload, setPayload] = useState<HealthPayload>({
    score: null,
    events: [],
    changes: [],
    owners: [],
    tickets: [],
  });
  const [filters, setFilters] = useState({
    tenantId: "",
    companyId: "",
    jobsiteId: "",
    dateFrom: "",
    dateTo: "",
    severity: "",
    ownerId: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promptError, setPromptError] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const query = useMemo(() => buildQuery(filters), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setPromptError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sign in as a Super Admin to view Health Intelligence.");
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const suffix = query ? `?${query}` : "";
      const [scoreRes, eventsRes, changesRes, ownersRes, ticketsRes] = await Promise.all([
        fetch(`/api/superadmin/health/score${suffix}`, { headers }),
        fetch(`/api/superadmin/health/events${suffix}`, { headers }),
        fetch(`/api/superadmin/health/changes${suffix}`, { headers }),
        fetch(`/api/superadmin/health/owners${suffix}`, { headers }),
        fetch(`/api/superadmin/health/tickets${suffix}`, { headers }),
      ]);

      const [score, events, changes, owners, tickets] = await Promise.all([
        scoreRes.json(),
        eventsRes.json(),
        changesRes.json(),
        ownersRes.json(),
        ticketsRes.json(),
      ]);

      const failed = [
        [scoreRes, score],
        [eventsRes, events],
        [changesRes, changes],
        [ownersRes, owners],
        [ticketsRes, tickets],
      ].find(([response]) => !(response as Response).ok);

      if (failed) {
        const body = failed[1] as { error?: string };
        throw new Error(body.error ?? "Unable to load SuperAdmin Health data.");
      }

      setPayload({
        score: score as SuperadminHealthScore,
        events: Array.isArray(events.events) ? events.events : [],
        changes: Array.isArray(changes.changes) ? changes.changes : [],
        owners: Array.isArray(owners.owners) ? owners.owners : [],
        tickets: Array.isArray(tickets.tickets) ? tickets.tickets : [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load SuperAdmin Health data.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyCodexPrompt = useCallback(async () => {
    setPromptError("");
    setPromptCopied(false);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard copy is not available in this browser.");
      }

      const prompt = buildSuperadminHealthCodexPrompt({
        payload,
        filters,
        generatedAt: new Date().toISOString(),
      });
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2200);
    } catch (copyError) {
      setPromptError(copyError instanceof Error ? copyError.message : "Could not copy the Codex review prompt.");
    }
  }, [filters, payload]);

  const score = payload.score;
  const categoryRows = score ? Object.entries(score.categories) : [];

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="SuperAdmin Health"
        title="Health Intelligence Command Center"
        description="One operating layer for health score, events, owner traceability, changes, and source-linked tickets. Phase 1 shows the foundation and marks future modules as pending until their source data is connected."
        actions={
          <>
            <button type="button" onClick={() => void load()} className={appButtonSecondaryClassName}>
              <Clock className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void copyCodexPrompt()}
              disabled={loading}
              className={`${appButtonSecondaryClassName} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {promptCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {promptCopied ? "Copied" : "Copy Codex Prompt"}
            </button>
            <Link href="/superadmin/system-health" className={appButtonSecondaryClassName}>
              System Health
            </Link>
          </>
        }
      />

      <SectionCard
        title="Filters"
        description="Filter all Health foundation feeds by platform tenant, company, jobsite, date, severity, owner, or status."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["tenantId", "Tenant ID"],
            ["companyId", "Company ID"],
            ["jobsiteId", "Jobsite ID"],
            ["ownerId", "Owner ID"],
            ["dateFrom", "Date from"],
            ["dateTo", "Date to"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">{label}</span>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
                value={filters[key as keyof typeof filters]}
                onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
                placeholder={key.includes("date") ? "2026-05-27" : "Optional"}
              />
            </label>
          ))}
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">Severity</span>
            <select
              className={`${appNativeSelectClassName} mt-2 w-full`}
              value={filters.severity}
              onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">Status</span>
            <input
              className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              placeholder="open, verified, recorded"
            />
          </label>
        </div>
      </SectionCard>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {promptError ? <InlineMessage tone="error">{promptError}</InlineMessage> : null}
      {loading ? <InlineMessage>Refreshing Health Intelligence data...</InlineMessage> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Overall SuperAdmin Health Score"
          description="Weighted score calculated only from available Phase 1 categories. Missing modules stay visible as pending or insufficient data."
          aside={<StatusBadge label={score ? `${score.overallScore}/100` : "Not loaded"} tone={scoreTone(score?.overallScore)} />}
          tone="attention"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile eyebrow="Score" title="Overall" value={score ? `${score.overallScore}` : "-"} detail="Calculated from active categories only." />
            <MetricTile eyebrow="Alerts" title="Critical alerts" value={String(score?.criticalAlerts.length ?? 0)} detail="High and critical unresolved signals." />
            <MetricTile eyebrow="Actions" title="Recommended" value={String(score?.recommendedActions.length ?? 0)} detail="Next review items from scoring." />
          </div>
        </SectionCard>

        <SectionCard title="Critical Alerts" description="Urgent Health events and tickets are not buried.">
          {score?.criticalAlerts.length ? (
            <div className="space-y-3">
              {score.criticalAlerts.slice(0, 4).map((alert, index) => (
                <CompactRow
                  key={`${text(alert.id, String(index))}-${index}`}
                  title={text(alert.title, "Health alert")}
                  detail={formatDate(alert.createdAt)}
                  badge={text(alert.severity, "review")}
                  tone={severityTone(alert.severity)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No critical alerts" description="No high or critical Phase 1 health alerts match the current filters." icon={ShieldCheck} />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Health Score Breakdown" description="Each category explains whether it is active, pending setup, or missing data.">
        <div className="grid gap-3 xl:grid-cols-2">
          {categoryRows.map(([key, category]) => (
            <CompactRow
              key={key}
              title={`${key} (${category.weight}%)`}
              detail={category.explanation}
              badge={category.score == null ? category.status.replace("_", " ") : `${category.score}/100`}
              tone={category.status === "active" ? scoreTone(category.score) : "neutral"}
            />
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Recent Events" description="Unified event ledger entries for the selected scope." aside={<StatusBadge label={String(payload.events.length)} />}>
          {payload.events.length ? (
            <div className="space-y-3">
              {payload.events.slice(0, 6).map((event, index) => (
                <CompactRow
                  key={`${text(event.id, String(index))}-${index}`}
                  title={`${text(event.module, "platform")} / ${text(event.action, "recorded")}`}
                  detail={`${text(event.object_type, "object")} ${text(event.object_id)} - ${formatDate(event.created_at)}`}
                  badge={text(event.severity, "low")}
                  tone={severityTone(event.severity)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No events yet" description="Phase 1 event ledger is ready. Critical future actions will write here." icon={Activity} />
          )}
        </SectionCard>

        <SectionCard title="What Changed" description="Machine-readable change records with before/after traceability." aside={<StatusBadge label={String(payload.changes.length)} />}>
          {payload.changes.length ? (
            <div className="space-y-3">
              {payload.changes.slice(0, 6).map((change, index) => (
                <CompactRow
                  key={`${text(change.id, String(index))}-${index}`}
                  title={`${text(change.object_type, "object")} / ${text(change.change_type, "changed")}`}
                  detail={`${text(change.reason, "No reason recorded")} - ${formatDate(change.created_at)}`}
                  badge={text(change.risk_level, "medium")}
                  tone={severityTone(change.risk_level)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No changes recorded" description="Owner-facing What Changed stays intact; this foundation is ready for machine-readable records." icon={Database} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Owner Validation" description="Traceable ownership records for critical objects and actions." aside={<StatusBadge label={String(payload.owners.length)} />}>
          {payload.owners.length ? (
            <div className="space-y-3">
              {payload.owners.slice(0, 6).map((owner, index) => (
                <CompactRow
                  key={`${text(owner.id, String(index))}-${index}`}
                  title={`${text(owner.owner_type, "Owner")} / ${text(owner.object_type, "scope")}`}
                  detail={`${text(owner.authority_level, "standard")} authority - ${formatDate(owner.updated_at ?? owner.created_at)}`}
                  badge={text(owner.validation_status, "pending")}
                  tone={text(owner.validation_status) === "verified" ? "success" : "warning"}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No owner records" description="Owner registry exists. Add sandbox or real owner records through the Phase 1 API when ready." icon={UserCheck} />
          )}
        </SectionCard>

        <SectionCard title="Open Help Tickets" description="Source-linked Health tickets use the existing platform ticket queue." aside={<StatusBadge label={String(payload.tickets.length)} />}>
          {payload.tickets.length ? (
            <div className="space-y-3">
              {payload.tickets.slice(0, 6).map((ticket, index) => (
                <CompactRow
                  key={`${text(ticket.id, String(index))}-${index}`}
                  title={text(ticket.title, "Help ticket")}
                  detail={`${text(ticket.description).slice(0, 140)} - ${formatDate(ticket.createdAt ?? ticket.created_at)}`}
                  badge={text(ticket.status, "open")}
                  tone={text(ticket.priority) === "critical" ? "error" : text(ticket.priority) === "high" ? "warning" : "neutral"}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No health tickets" description="No source-linked Phase 1 tickets match this scope." icon={Ticket} actionHref="/superadmin/help-tickets" actionLabel="Open ticket queue" />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Future Modules" description="Phase 2 through Phase 6 are visible here as pending setup, not pretend-complete dashboards.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["System Health Placeholder", "System health events and snapshots will feed this panel from the existing System Health page.", "/superadmin/system-health"],
            ["AI Engine Placeholder", "AI operation scoring will connect after Phase 3 event and review feeds are wired.", "/superadmin/ai-engine"],
            ["Cyber Health Placeholder", "Cyber alert scoring will connect after Phase 5 cyber alert records are added.", "/superadmin/cyber-security"],
            ["Prediction Valuation Placeholder", "Prediction value scoring will connect after Phase 4 valuation outcomes exist.", "/superadmin/prediction-validation"],
            ["Improvement Backlog Placeholder", "AI improvement backlog summaries will connect after Phase 3 review signals are linked.", "/superadmin/ai-improvements"],
          ].map(([title, description, href]) => (
            <Link key={title} href={href} className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white/72 p-4 transition hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{description}</p>
                </div>
                <StatusBadge label="pending setup" />
              </div>
            </Link>
          ))}
          <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-white/72 p-4">
            <Gauge className="h-5 w-5 text-[var(--app-accent-primary)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--app-text-strong)]">Audit Engine Placeholder</p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">Phase 2 will add audit controls, audit runs, and auto-ticket creation.</p>
            <div className="mt-3">
              <StatusBadge label="phase 2" tone="info" />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
