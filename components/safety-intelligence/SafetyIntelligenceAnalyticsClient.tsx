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
        eyebrow="Company workspace"
        title="Safety Intelligence workload"
        description="Activity for your company only: how much Safety Intelligence work is running, what is being reviewed, and where tasks and hazard themes cluster. Pair this with Command Center when you want the live hub; use this view when you are tuning programs, templates, and who should act next."
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
              Run Safety Intelligence
            </Link>
          </>
        }
      />

      {message ? <InlineMessage tone="error">{message}</InlineMessage> : null}

      <SectionCard
        title="Activity at a glance"
        description="Counts below are scoped to your company. Pipeline batches and open rule conflicts are early signals; AI-assisted reviews and generated documents show review load and output volume."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Pipeline batches</p>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.bucketRuns ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">AI-assisted reviews</p>
              <ProvenanceBadge kind="ai" />
            </div>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.aiReviews ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Open rule conflicts</p>
              <ProvenanceBadge kind="rules" />
            </div>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.openConflicts ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white/85 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text)]">Documents generated</p>
              <ProvenanceBadge kind="hybrid" />
            </div>
            <p className="mt-2 text-3xl font-bold text-[var(--app-text-strong)]">{summary?.totals.generatedDocuments ?? 0}</p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Most common workflow steps"
          description="Task codes your teams are sending into Safety Intelligence most often—useful for prioritizing training, templates, and field coaching."
        >
          <ul className="space-y-3">
            {(summary?.topTrades ?? []).map((row) => (
              <li key={row.code} className="flex items-center justify-between rounded-xl bg-[var(--app-panel)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{row.code.replace(/_/g, " ")}</span>
                <strong className="text-[var(--app-accent-primary)]">{row.count}</strong>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard
          title="Recurring hazard themes"
          description="Hazard families showing up repeatedly for your company—strong candidates for pre-job briefings, inspections, and control updates."
        >
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
        title="Rule conflicts to review"
        description="Items the rules engine flagged for your company that still need a decision—clear these so crews are not blocked and so audit trails stay accurate."
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
              No rule conflicts are waiting—your Safety Intelligence queue is clear.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
