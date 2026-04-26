"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardOverviewFiltersBar } from "@/components/dashboard/DashboardOverviewFiltersBar";
import { InlineMessage } from "@/components/WorkspacePrimitives";
import { fetchWithTimeoutSafe } from "@/lib/fetchWithTimeout";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { PermissionMap } from "@/lib/rbac";
import type { DashboardDataState } from "@/components/dashboard/types";
import type { DashboardOverview, EngineHealthItem, TrendPoint } from "@/src/lib/dashboard/types";
import { SectionCard } from "@/src/components/dashboard/SectionCard";
import { MetricCard } from "@/src/components/dashboard/MetricCard";
import { StatusBadge } from "@/src/components/dashboard/StatusBadge";
import { ObservationDualLineChart } from "@/src/components/dashboard/ObservationDualLineChart";
import { StatusBarChart } from "@/src/components/dashboard/StatusBarChart";
import { ContractorRiskTable } from "@/src/components/dashboard/ContractorRiskTable";
import { PermitComplianceTable } from "@/src/components/dashboard/PermitComplianceTable";
import { DocumentReadinessPanel } from "@/src/components/dashboard/DocumentReadinessPanel";
import { EngineHealthPanel } from "@/src/components/dashboard/EngineHealthPanel";
import { AiInsightsPanel } from "@/src/components/dashboard/AiInsightsPanel";
import Link from "next/link";

const supabase = getSupabaseBrowserClient();

function canLoadDashboardOverview(map: PermissionMap | null): boolean {
  if (!map) return true;
  return Boolean(
    map.can_view_dashboards ||
    map.can_view_all_company_data ||
    map.can_view_analytics ||
    map.can_manage_company_users
  );
}

function isSuperAdminLikeRole(role: string): boolean {
  return role === "super_admin" || role === "platform_admin";
}

function partitionEngineHealth(items: EngineHealthItem[]): { smart: EngineHealthItem[]; platform: EngineHealthItem[] } {
  const platform: EngineHealthItem[] = [];
  const smart: EngineHealthItem[] = [];
  for (const item of items) {
    const n = item.moduleName.toLowerCase();
    if (
      n.includes("supabase connection") ||
      n.includes("document storage bucket") ||
      n.includes("document export") ||
      n.includes("dashboard data service")
    ) {
      platform.push(item);
    } else {
      smart.push(item);
    }
  }
  return { smart, platform };
}

function incidentOutlook(incidentTrend: TrendPoint[]): "improving" | "worsening" | "stable" {
  const vals = incidentTrend.map((p) => (Number.isFinite(p.value) ? p.value : 0));
  if (vals.length < 2) return "stable";
  const mid = Math.floor(vals.length / 2);
  const a = vals.slice(0, mid).reduce((s, v) => s + v, 0) / Math.max(1, mid);
  const b = vals.slice(mid).reduce((s, v) => s + v, 0) / Math.max(1, vals.length - mid);
  if (b > a * 1.05) return "worsening";
  if (b < a * 0.95) return "improving";
  return "stable";
}

function outlookLabel(o: ReturnType<typeof incidentOutlook>): string {
  if (o === "improving") return "Improving";
  if (o === "worsening") return "Trending upward";
  return "Stable";
}

function outlookTone(o: ReturnType<typeof incidentOutlook>): "success" | "error" | "neutral" {
  if (o === "improving") return "success";
  if (o === "worsening") return "error";
  return "neutral";
}

export function DashboardOverviewShell({ workspace }: { workspace: DashboardDataState }) {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = useMemo(() => canLoadDashboardOverview(workspace.permissionMap), [workspace.permissionMap]);

  const load = useCallback(async () => {
    if (!allowed) return;
    if (workspace.loading || !workspace.companyWorkspaceLoaded) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setOverview(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = searchParams.toString();
    const overviewUrl = `/api/dashboard/overview${qs ? `?${qs}` : ""}`;
    const res = await fetchWithTimeoutSafe(
      overviewUrl,
      { headers: { Authorization: `Bearer ${token}` } },
      20000,
      "Prevention overview"
    );
    if (res.status === 403) {
      let msg = "This overview is not available for your workspace or role.";
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j?.error === "string" && j.error.trim()) msg = j.error.trim();
      } catch {
        /* ignore */
      }
      setError(msg);
      setOverview(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Prevention overview could not be loaded right now.");
      setOverview(null);
      setLoading(false);
      return;
    }
    try {
      const body = (await res.json()) as DashboardOverview;
      setOverview(body);
    } catch {
      setError("Overview response was not valid JSON.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, searchParams, workspace.companyWorkspaceLoaded, workspace.loading]);

  useEffect(() => {
    // Data fetch after workspace gate; `load` updates overview state when the response returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async overview hydration
    void load();
  }, [load]);

  if (!allowed) {
    return null;
  }

  const filters = <DashboardOverviewFiltersBar workspace={workspace} />;

  if (workspace.loading) {
    return (
      <div className="space-y-6">
        {filters}
        <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          Preparing prevention overview…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {filters}
        <InlineMessage tone="warning">{error}</InlineMessage>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        {filters}
        <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          Loading prevention overview…
        </div>
      </div>
    );
  }

  if (!overview) {
    return <div className="space-y-6">{filters}</div>;
  }

  const outlook = incidentOutlook(overview.incidentTrend);
  const topEmerging = overview.topRisks.slice(0, 5);

  const correctiveSegments = [
    { key: "open", label: "Open", value: overview.correctiveActionStatus.open, tone: "yellow" as const },
    { key: "overdue", label: "Overdue", value: overview.correctiveActionStatus.overdue, tone: "red" as const },
    { key: "closed", label: "Closed", value: overview.correctiveActionStatus.closed, tone: "green" as const },
  ];

  const missingPermitsTotal = overview.permitCompliance.reduce((s, p) => s + p.missing, 0);
  const overdueRows = overview.overdueCorrectiveSamples ?? [];
  const obsCategories = overview.observationCategoryTop ?? [];
  const cred = overview.credentialGaps ?? { expiredCredentials: 0, expiringSoonCredentials: 0 };

  const disconnectedSources = overview.engineHealth.filter(
    (e) => e.status !== "green" && /not connected|missing|could not/i.test(e.message)
  );

  const doc = overview.documentReadiness;
  const pipelineTotal = doc.draft + doc.submitted + doc.underReview + doc.approved + doc.rejected;
  const weakDocs =
    pipelineTotal > 0 && doc.draft + doc.underReview > doc.approved * 0.5
      ? "Draft and in-review documents outweigh approved output—a potential control gap in review throughput. Recommended action: clear approvals before work continues that depends on verified documents."
      : null;

  const { smart: smartEngine, platform: platformEngine } = partitionEngineHealth(overview.engineHealth);
  const smartEngineDisplay =
    smartEngine.length > 0
      ? smartEngine
      : overview.engineHealth.filter(
          (i) =>
            !/supabase connection|document storage bucket|document export|dashboard data service/i.test(
              i.moduleName.toLowerCase()
            )
        );
  const smartEngineFinal = smartEngineDisplay.length > 0 ? smartEngineDisplay : overview.engineHealth;

  return (
    <div className="space-y-8">
      {filters}
      <div className="rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(234,241,255,0.88)_100%)] px-4 py-4 text-sm text-[var(--app-text)] shadow-[var(--app-shadow-soft)] sm:px-6">
        <p className="font-semibold text-[var(--app-text-strong)]">Prevention overview</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">
          These tiles highlight where risk may be building and what requires field verification—not only what was reported.
          Data is loaded from{" "}
          <code className="rounded bg-[var(--app-panel)] px-1 py-0.5 text-[11px]">/api/dashboard/overview</code> for your
          company. Empty sections usually mean a source is not connected yet; the role-based dashboard below is unchanged.
        </p>
      </div>

      <SectionCard
        eyebrow="Prevention snapshot"
        title="1. Current Safety Health"
        tone="elevated"
        description="Headline indicators for the selected window. Use them to decide where pre-task review may be needed before high-risk work proceeds."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard
            label="Safety health score"
            value={overview.summary.safetyHealthScore}
            hint="0–100 composite prevention posture"
          />
          <MetricCard
            label="Open high-risk items"
            value={overview.summary.openHighRiskItems}
            hint="High-risk work exposure—requires field verification"
          />
          <MetricCard
            label="Overdue corrective actions"
            value={overview.summary.overdueCorrectiveActions}
            hint="Missing control follow-through past due date"
          />
          <MetricCard label="Permit compliance rate" value={`${Math.round(overview.summary.permitComplianceRate)}%`} />
          <MetricCard label="Training readiness rate" value={`${Math.round(overview.summary.trainingReadinessRate)}%`} />
          <MetricCard label="Document readiness rate" value={`${Math.round(overview.summary.documentReadinessRate)}%`} />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Forward view"
        title="2. Smart Safety Forecast"
        tone="elevated"
        description="Incident and near-miss buckets compared across the period. Trending upward suggests risk building—use it to target verification, not as a prediction of a specific event."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Incident signal</span>
          <StatusBadge label={outlookLabel(outlook)} tone={outlookTone(outlook)} />
        </div>
        {outlook === "worsening" ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--app-text)]">
            Recent buckets show higher counts than earlier in the window. Recommended action: confirm staffing, scope changes,
            and energy isolation / fall protection where work is active. Pre-task review needed on the highest-hazard tasks.
          </p>
        ) : outlook === "improving" ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--app-text)]">
            Counts are easing compared with earlier in the window. Sustain the controls and supervision behaviors that
            likely contributed—document them for other sites.
          </p>
        ) : (
          <p className="mt-3 text-sm text-[var(--app-muted)]">
            Incident signal is stable in this window. Keep routine verification so a quiet chart does not mask a repeat issue
            on the ground.
          </p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Early signal"
        title="3. Emerging Risk Areas"
        tone="panel"
        description="Ranked themes and field observation mix. A rising negative pattern or concentrated category can signal a repeat issue or potential control gap before harm occurs."
      >
        <div>
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Top emerging themes</h3>
          {topEmerging.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              No ranked themes in this window yet—widen the range or confirm observations are being logged.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topEmerging.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] bg-white/90 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--app-text-strong)]">
                    {i + 1}. {r.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-app-display font-bold text-[var(--app-text-strong)]">{r.count}</span>
                    <StatusBadge
                      label={r.severity}
                      trafficLight={r.severity === "low" ? "green" : r.severity === "medium" ? "yellow" : "red"}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-6">
          <ObservationDualLineChart
            points={overview.observationTrend}
            title="Observation mix by period"
            description="Compare positive versus other observation volume. Divergence can indicate a missing control or weak verification—escalate when negative volume climbs."
          />
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Repeat observation categories</h3>
          {obsCategories.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--app-muted)]">No category rollups yet for this window.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {obsCategories.slice(0, 8).map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-white/88 px-3 py-2 text-sm">
                  <span className="truncate font-medium text-[var(--app-text-strong)]">{c.name}</span>
                  <span className="font-app-display font-bold text-[var(--app-text-strong)]">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Closure discipline"
        title="4. Corrective Action Control Center"
        tone="attention"
        description="Open, overdue, and closed posture plus follow-up list. Overdue items represent unresolved exposure—assign owners and dates before work continues in affected areas."
      >
        <StatusBarChart
          segments={correctiveSegments}
          title="Corrective status mix"
          description="Open and overdue items are prevention debt until verified in the field and closed in the system."
          showCompositionStrip
        />
        <div className="mt-4">
          <MetricCard
            label="Average days to close"
            value={overview.correctiveActionStatus.averageDaysToClose ?? "—"}
            hint={overview.correctiveActionStatus.averageDaysToClose == null ? "Need closed rows with dates." : undefined}
          />
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Overdue items (requires field verification)</h3>
          {overdueRows.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--app-muted)]">No overdue open correctives in this window.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--app-border-subtle)] overflow-hidden rounded-xl border border-[var(--app-border)] bg-white/92 text-sm">
              {overdueRows.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--app-text-strong)]">{(row.category ?? "Uncategorized").replace(/_/g, " ")}</p>
                    <p className="text-xs text-[var(--app-muted)]">
                      {row.observation_type ? `${row.observation_type} · ` : null}
                      Due {row.due_at ? new Date(row.due_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Link href="/field-id-exchange" className="shrink-0 text-xs font-semibold text-[var(--app-accent-primary)]">
                    View correctives
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Permits and daily plans"
        title="5. JSA / Permit Compliance"
        tone="panel"
        description="Type-level permit posture and JSA completion. Missing permits for hot work, cranes, excavation, confined space, or energized work are a missing control until documented."
      >
        <p className="text-sm text-[var(--app-text)]">
          <span className="font-semibold text-[var(--app-text-strong)]">Missing required permits (bucketed): </span>
          {missingPermitsTotal}
        </p>
        <div className="mt-4">
          <PermitComplianceTable permits={overview.permitCompliance} jsaCompletionRate={overview.summary.jsaCompletionRate} />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Partners on site"
        title="6. Contractor Risk Scorecards"
        tone="elevated"
        description="Ranking from compliance documents and evaluations. Use scorecards to decide where contractor coordination or pre-task review is needed before shared high-risk work."
      >
        <ContractorRiskTable contractors={overview.contractorRiskScores} />
      </SectionCard>

      <SectionCard
        eyebrow="Credentials and roles"
        title="7. Workforce Readiness"
        tone="panel"
        description="Training coverage and credential timing. Expired or missing credentials should be resolved before task assignment on regulated or high-energy work."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Overall training readiness" value={`${Math.round(overview.summary.trainingReadinessRate)}%`} />
          <MetricCard label="Expired credentials (docs)" value={cred.expiredCredentials} hint="Contractor documents past expiry" />
          <MetricCard label="Expiring soon (30d)" value={cred.expiringSoonCredentials} />
        </div>
        <p className="mt-4 text-sm text-[var(--app-muted)]">
          Role-based training gaps are not shown in this overview yet—use the training matrix when HR connects assignments so
          missing control signals include role coverage.
        </p>
      </SectionCard>

      <SectionCard
        eyebrow="Evidence trail"
        title="8. Document Readiness"
        tone="elevated"
        description="Lifecycle counts for documents in scope. Gaps here can block verification of programs and contractor packages before work continues."
      >
        <DocumentReadinessPanel readiness={overview.documentReadiness} />
      </SectionCard>

      <SectionCard
        eyebrow="Narrative review"
        title="9. Safety Intelligence Review"
        tone="panel"
        description="Rules-based takeaways from the same metrics—recommended actions you can assign without automated decision-making. Integration gaps below explain blind spots."
      >
        <AiInsightsPanel
          insights={overview.aiInsights}
          title="Findings"
          description="Each item states what changed, why it matters, who is affected, what to do next, and how the trend compares in this window."
        />
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-bold text-[var(--app-text-strong)]">Data sources needing attention</h3>
          {disconnectedSources.length === 0 ? (
            <p className="text-sm text-[var(--app-muted)]">No disconnected modules flagged, or all sources responded.</p>
          ) : (
            <ul className="list-inside list-disc text-sm text-[var(--app-text)]">
              {disconnectedSources.map((e) => (
                <li key={e.moduleName}>{e.moduleName}</li>
              ))}
            </ul>
          )}
          {weakDocs ? <InlineMessage tone="warning">{weakDocs}</InlineMessage> : null}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Signal pipeline"
        title="10. Smart Safety Engine Health"
        tone="elevated"
        description="Status of the data paths that feed this overview. Yellow or red rows mean prevention signals may be incomplete until the underlying source is restored."
      >
        <EngineHealthPanel items={smartEngineFinal} />
      </SectionCard>

      {isSuperAdminLikeRole(workspace.userRole) ? (
        <SectionCard
          eyebrow="Platform"
          title="11. Superadmin System Health"
          tone="attention"
          description="Read-only infrastructure checks (session, storage, routes). Use them to restore trustworthy prevention data—not as a substitute for field verification."
        >
          {platformEngine.length > 0 ? (
            <EngineHealthPanel
              title="Infrastructure and routes"
              description="Checks most relevant to keeping overview and export paths reliable."
              items={platformEngine}
            />
          ) : (
            <p className="text-sm text-[var(--app-muted)]">
              No dedicated infrastructure rows were split out for this response—review section 10 for the full engine list.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <InlineMessage tone="neutral">
              Failed uploads and failed document builds are not included in this feed yet—monitor via logs or your observability stack.
            </InlineMessage>
            <Link
              href="/superadmin/system-health"
              className="shrink-0 text-sm font-semibold text-[var(--app-accent-primary)] hover:text-[var(--app-link-hover)]"
            >
              Open full Superadmin System Health →
            </Link>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          eyebrow="Platform"
          title="11. Superadmin System Health"
          tone="panel"
          description="Restricted to Super Admin. Operational prevention tiles above still reflect your workspace permissions."
        >
          <p className="text-sm text-[var(--app-muted)]">
            Super Admins use the Superadmin System Health page for the full probe list. Your overview above remains scoped to
            your role and permissions.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
