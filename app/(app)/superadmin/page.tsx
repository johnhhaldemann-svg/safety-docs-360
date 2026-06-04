"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  History,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  PageHero,
  workspaceSectionEyebrowClassName,
} from "@/components/WorkspacePrimitives";
import {
  getAdvancedTools,
  getDailyTools,
  superadminToolGroups,
  type SuperadminNavItem,
} from "@/lib/superadminNavigation";
import { deferEffect } from "@/lib/deferredEffect";
import { getSupabaseAccessToken } from "@/lib/supabaseClientSession";
import type { PlatformHelpTicketSummary } from "@/types/platform-support";
import type { SuperadminHealthScore } from "@/lib/superadmin/health/types";

type StatusData = {
  healthScore: number | null;
  openTickets: number;
  unseenTickets: number;
  criticalAlerts: number;
  pendingOwners: number;
};

const dailyTools = getDailyTools();
const advancedTools = getAdvancedTools();

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function toolMatchesQuery(tool: SuperadminNavItem, query: string) {
  if (!query) return true;
  const haystack = [
    tool.label,
    tool.href,
    tool.short,
    tool.description,
    ...(tool.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function ToolIcon({ href }: { href: string }) {
  const className = "h-4 w-4";
  const strokeWidth = 2.25;

  if (href === "/superadmin") {
    return <Gauge className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("system-health") || href.includes("/health")) {
    return <Activity className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("owner-validation")) {
    return <ClipboardCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("what-changed")) {
    return <History className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("cyber-security")) {
    return <LockKeyhole className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("system-test")) {
    return <ClipboardCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (
    href.includes("ai-engine") ||
    href.includes("ai-knowledge") ||
    href.includes("ai-improvements")
  ) {
    return <BrainCircuit className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("prediction") || href.includes("injury-weather")) {
    return <BarChart3 className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("builder") || href.includes("csep-programs")) {
    return <FileText className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("jurisdiction") || href.includes("osha")) {
    return <ShieldCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  if (href.includes("csep")) {
    return <FileCheck2 className={className} strokeWidth={strokeWidth} aria-hidden />;
  }
  return <Settings2 className={className} strokeWidth={strokeWidth} aria-hidden />;
}

function ToolCard({
  tool,
  emphasized = false,
}: {
  tool: SuperadminNavItem;
  emphasized?: boolean;
}) {
  return (
    <Link
      href={tool.href}
      className={cx(
        "group flex h-full min-h-[142px] flex-col justify-between rounded-lg border bg-white p-4 shadow-[0_10px_22px_rgba(44,58,86,0.055)] transition hover:-translate-y-0.5 hover:border-[var(--app-accent-border-24)] hover:shadow-[0_16px_30px_rgba(44,58,86,0.09)]",
        emphasized
          ? "border-[var(--app-accent-border-24)]"
          : "border-[var(--app-border)]"
      )}
    >
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-accent-surface-18)] bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
          <ToolIcon href={tool.href} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--app-text-strong)]">
            {tool.label}
          </span>
          <span className="mt-1 block text-xs leading-5 text-[var(--app-muted)]">
            {tool.description}
          </span>
        </span>
      </span>
      <span className="mt-4 flex items-center justify-between gap-3">
        <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
          {tool.short}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--app-accent-primary)]">
          {tool.primaryActionLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
        </span>
      </span>
    </Link>
  );
}

function AdvancedToolRow({ tool }: { tool: SuperadminNavItem }) {
  return (
    <Link
      href={tool.href}
      className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 transition hover:border-[var(--app-accent-border-24)] hover:bg-[var(--app-accent-primary-soft)]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]">
          <ToolIcon href={tool.href} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--app-text-strong)]">
            {tool.label}
          </span>
          <span className="block truncate text-xs text-[var(--app-muted)]">
            {tool.description}
          </span>
        </span>
      </span>
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--app-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-accent-primary)]"
        strokeWidth={2.25}
        aria-hidden
      />
    </Link>
  );
}

function StatusTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "error" | "neutral";
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "error"
          ? "text-red-700"
          : "text-[var(--app-text-strong)]";

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(44,58,86,0.04)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

export default function SuperadminHubPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [scoreRes, ticketsRes, ownersRes] = await Promise.all([
        fetch("/api/superadmin/health/score", { headers }),
        fetch("/api/superadmin/help-tickets?limit=1", { headers }),
        fetch("/api/superadmin/health/owners?limit=50", { headers }),
      ]);
      const [scoreData, ticketsData, ownersData] = await Promise.all([
        scoreRes.ok
          ? (scoreRes.json() as Promise<SuperadminHealthScore>)
          : Promise.resolve(null),
        ticketsRes.ok
          ? (ticketsRes.json() as Promise<{ summary?: PlatformHelpTicketSummary }>)
          : Promise.resolve(null),
        ownersRes.ok
          ? (ownersRes.json() as Promise<{ owners?: Array<Record<string, unknown>> }>)
          : Promise.resolve(null),
      ]);
      const summary = ticketsData?.summary;
      const owners = ownersData?.owners ?? [];
      const pendingOwners = owners.filter(
        (o) => o.validation_status !== "verified"
      ).length;
      setStatus({
        healthScore: scoreData?.overallScore ?? null,
        openTickets:
          (summary?.open ?? 0) +
          (summary?.inProgress ?? 0) +
          (summary?.waitingOnUser ?? 0),
        unseenTickets: summary?.unseen ?? 0,
        criticalAlerts: scoreData?.criticalAlerts?.length ?? 0,
        pendingOwners,
      });
    } catch {
      // Status bar is non-critical — fail silently
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(
    () =>
      deferEffect(() => {
        void loadStatus();
      }),
    [loadStatus]
  );

  const allTools = useMemo(
    () =>
      superadminToolGroups
        .flatMap((g) => g.items)
        .filter((t) => t.href !== "/superadmin"),
    []
  );

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return allTools.filter((tool) => toolMatchesQuery(tool, normalizedQuery));
  }, [allTools, normalizedQuery]);

  const hasAttentionItem =
    status !== null &&
    (status.unseenTickets > 0 ||
      status.criticalAlerts > 0 ||
      status.pendingOwners > 0);

  const healthTone =
    status?.healthScore == null
      ? "neutral"
      : status.healthScore >= 85
        ? "success"
        : status.healthScore >= 70
          ? "warning"
          : "error";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin"
        title="Superadmin Hub"
        description="Platform operations, daily tools, diagnostics, and AI oversight."
        actions={
          <>
            <Link href="/superadmin/system-health" className={appButtonPrimaryClassName}>
              <Activity className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              System Health
            </Link>
            <Link href="/superadmin/ai-engine" className={appButtonSecondaryClassName}>
              <BrainCircuit className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              AI Engine
            </Link>
          </>
        }
      />

      {/* Live status bar */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusTile
          label="Health score"
          value={
            statusLoading
              ? "—"
              : status?.healthScore != null
                ? `${status.healthScore}/100`
                : "—"
          }
          tone={statusLoading ? "neutral" : healthTone}
        />
        <StatusTile
          label="Open tickets"
          value={statusLoading ? "—" : (status?.openTickets ?? 0)}
          tone={!statusLoading && (status?.openTickets ?? 0) > 0 ? "warning" : "neutral"}
        />
        <StatusTile
          label="Unseen tickets"
          value={statusLoading ? "—" : (status?.unseenTickets ?? 0)}
          tone={!statusLoading && (status?.unseenTickets ?? 0) > 0 ? "warning" : "neutral"}
        />
        <StatusTile
          label="Critical alerts"
          value={statusLoading ? "—" : (status?.criticalAlerts ?? 0)}
          tone={!statusLoading && (status?.criticalAlerts ?? 0) > 0 ? "error" : "neutral"}
        />
      </div>

      {/* Attention strip */}
      {hasAttentionItem ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            strokeWidth={2.25}
            aria-hidden
          />
          <div className="min-w-0 text-sm">
            <span className="font-bold text-amber-800">Needs attention: </span>
            <span className="text-amber-700">
              {[
                status.unseenTickets > 0 &&
                  `${status.unseenTickets} unseen ticket${status.unseenTickets > 1 ? "s" : ""}`,
                status.criticalAlerts > 0 &&
                  `${status.criticalAlerts} critical alert${status.criticalAlerts > 1 ? "s" : ""}`,
                status.pendingOwners > 0 &&
                  `${status.pendingOwners} pending owner validation${status.pendingOwners > 1 ? "s" : ""}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <section className="rounded-lg border border-[var(--app-border)] bg-white p-4 shadow-[0_10px_24px_rgba(44,58,86,0.055)]">
        <label htmlFor="superadmin-tool-search" className="sr-only">
          Search superadmin tools
        </label>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-3">
          <Search
            className="h-4 w-4 shrink-0 text-[var(--app-muted)]"
            strokeWidth={2.25}
            aria-hidden
          />
          <input
            id="superadmin-tool-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all superadmin tools..."
            className="w-full border-0 bg-transparent text-sm font-semibold text-[var(--app-text-strong)] outline-none placeholder:text-[var(--app-muted)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-xs font-semibold text-[var(--app-accent-primary)] hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </section>

      {/* Search results */}
      {normalizedQuery ? (
        <section className="space-y-4">
          <p className={workspaceSectionEyebrowClassName}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--app-border-strong)] bg-white p-8 text-center">
              <p className="text-sm font-bold text-[var(--app-text-strong)]">No tools found</p>
              <p className="mt-2 text-sm text-[var(--app-muted)]">
                Try searching for health, CSEP, OSHA, cyber, prediction, builder, or AI.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((tool) => (
                <ToolCard key={tool.href} tool={tool} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Daily tools */}
          <section className="space-y-4">
            <div>
              <p className={workspaceSectionEyebrowClassName}>Daily tools</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--app-text-strong)]">
                Your core workflow
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dailyTools.map((tool) => (
                <ToolCard key={tool.href} tool={tool} emphasized />
              ))}
            </div>
          </section>

          {/* Advanced tools — collapsible */}
          <section>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-[var(--app-border)] bg-white px-4 py-3 text-left shadow-[0_2px_8px_rgba(44,58,86,0.04)] transition hover:border-[var(--app-border-strong)]"
            >
              <div className="flex items-center gap-2">
                <Settings2
                  className="h-4 w-4 text-[var(--app-muted)]"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="text-sm font-bold text-[var(--app-text-strong)]">
                  Advanced tools
                </span>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--app-muted)]">
                  {advancedTools.length}
                </span>
              </div>
              {showAdvanced ? (
                <ChevronDown
                  className="h-4 w-4 text-[var(--app-muted)]"
                  strokeWidth={2.25}
                  aria-hidden
                />
              ) : (
                <ChevronRight
                  className="h-4 w-4 text-[var(--app-muted)]"
                  strokeWidth={2.25}
                  aria-hidden
                />
              )}
            </button>

            {showAdvanced ? (
              <div className="mt-3 space-y-2">
                {advancedTools.map((tool) => (
                  <AdvancedToolRow key={tool.href} tool={tool} />
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
