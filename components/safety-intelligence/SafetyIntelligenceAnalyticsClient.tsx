"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { InlineMessage, PageHero, ProvenanceBadge, SectionCard } from "@/components/WorkspacePrimitives";
import type { SafetyDashboardPayload } from "@/components/safety-intelligence/types";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

export function SafetyIntelligenceAnalyticsClient() {
  const [summary, setSummary] = useState<SafetyDashboardPayload["summary"] | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error("Sign in to load analytics.");
      }
      const response = await fetchWithTimeoutSafe(
        "/api/company/safety-intelligence/analytics/summary",
        { headers: { Authorization: `Bearer ${token}` } },
        15000,
        "Safety Intelligence analytics"
      );
      const json = (await response.json().catch(() => null)) as { summary?: SafetyDashboardPayload["summary"]; error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || "Failed to load analytics summary.");
      }
      setSummary(json?.summary ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load analytics.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Safety Intelligence"
        title="Workflow analytics companion"
        description="Use this page as the drill-down companion to Command Center and the Safety Intelligence workflow. It focuses on throughput, conflict load, and recurring hazard concentration."
        actions={
          <>
            <Link
              href="/command-center"
              className="rounded-xl border border-[var(--app-border-strong)] bg-white/85 px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] hover:bg-white"
            >
              Command Center
            </Link>
            <Link
              href="/safety-intelligence"
              className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--app-shadow-primary-button)]"
            >
              Open workflow
            </Link>
          </>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard
        title="Leading vs lagging indicators"
        description="Conflict activity and bucket volume operate as leading indicators; generated documents and intelligence review counts show adoption and review throughput."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Bucket runs</p>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.bucketRuns ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Intelligence reviews</p>
              <ProvenanceBadge kind="ai" />
            </div>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.aiReviews ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Open conflicts</p>
              <ProvenanceBadge kind="rules" />
            </div>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.openConflicts ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Generated docs</p>
              <ProvenanceBadge kind="hybrid" />
            </div>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.generatedDocuments ?? 0}</p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Trend dashboard" description="Most frequent task signals entering the pipeline right now.">
          <ul className="space-y-3">
            {(summary?.topTrades ?? []).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{row.code.replace(/_/g, " ")}</span>
                <strong className="text-[var(--app-accent-primary)]">{row.count}</strong>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Hazard concentration" description="Recurring hazard families can be used to drive templates, controls, and review priority.">
          <ul className="space-y-3">
            {(summary?.topHazards ?? []).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{row.code.replace(/_/g, " ")}</span>
                <strong className="text-[var(--semantic-warning)]">{row.count}</strong>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Conflict drill-down"
        description="Open conflict findings from the deterministic engine are the core early-warning signal for the platform."
        aside={<ProvenanceBadge kind="rules" />}
      >
        <div className="grid gap-3">
          {(summary?.openConflictItems ?? []).map((conflict) => (
            <div key={conflict.id} className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--app-text-strong)]">{conflict.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--app-text)]">{conflict.rationale}</p>
                </div>
                <span className="rounded-full bg-[rgba(217,83,79,0.12)] px-3 py-1 text-xs font-semibold uppercase text-[var(--semantic-danger)]">
                  {conflict.severity}
                </span>
              </div>
            </div>
          ))}
          {summary?.openConflictItems?.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-white/75 px-4 py-6 text-sm text-[var(--app-text)]">
              No open conflicts are currently queued.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
