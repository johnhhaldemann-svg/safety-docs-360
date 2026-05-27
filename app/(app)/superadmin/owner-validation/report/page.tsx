"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import type {
  OwnerCustomerReadyGate,
  OwnerValidationCheckResult,
  OwnerValidationModule,
  OwnerValidationRun,
  OwnerValidationStatus,
} from "@/lib/superadmin/ownerValidationTypes";
import type { OwnerChangeLogEntry } from "@/lib/superadmin/ownerChangeLog";

type OwnerProofReport = {
  summary: {
    overallStatus: OwnerValidationStatus;
    overallStatusLabel: string;
    overallScore: number;
    testedAt: string | null;
    testedBy: string | null;
    safeToDemo: "Yes" | "No" | "Needs Review";
    safeForCustomerUse: "Yes" | "No" | "Needs Review";
    plainEnglishSummary: string;
  };
  modulesPassed: OwnerValidationModule[];
  modulesNeedingReview: OwnerValidationModule[];
  modulesFailed: OwnerValidationModule[];
  modulesNotTested: OwnerValidationModule[];
  customerReadyModules: OwnerCustomerReadyGate[];
  blockedModules: OwnerCustomerReadyGate[];
  manualChecklist: {
    totalRequired: number;
    passedRequired: number;
    needsReview: number;
    failed: number;
    completionPercent: number;
  };
  recentChanges: OwnerChangeLogEntry[];
  latestRun: OwnerValidationRun | null;
  latestRunChecks: OwnerValidationCheckResult[];
  topRisks: string[];
  recommendedNextActions: string[];
};

const STATUS_LABELS: Record<OwnerValidationStatus, string> = {
  green: "Working",
  yellow: "Needs review",
  red: "Broken",
  gray: "Not tested",
};

function statusStyles(status: OwnerValidationStatus) {
  if (status === "green") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "yellow") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "red") return "border-red-200 bg-red-50 text-red-950";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function decisionStyles(value: "Yes" | "No" | "Needs Review") {
  if (value === "Yes") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (value === "No") return "border-red-200 bg-red-50 text-red-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function StatusIcon({ status }: { status: OwnerValidationStatus }) {
  if (status === "green") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (status === "yellow") return <AlertTriangle className="h-4 w-4" aria-hidden />;
  if (status === "red") return <XCircle className="h-4 w-4" aria-hidden />;
  return <ShieldAlert className="h-4 w-4" aria-hidden />;
}

function formatDate(value: string | null) {
  if (!value) return "No report run yet";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function ModuleList({ modules, emptyText }: { modules: OwnerValidationModule[]; emptyText: string }) {
  if (modules.length === 0) {
    return <p className="text-sm leading-6 text-[var(--app-muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {modules.map((module) => (
        <div key={module.module_key} className="rounded-lg border border-[var(--app-border)] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles(module.status)}`}>
              <StatusIcon status={module.status} />
              {STATUS_LABELS[module.status]}
            </span>
            <p className="text-sm font-bold text-[var(--app-text-strong)]">{module.display_name}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{module.summary || "No plain-English summary recorded."}</p>
        </div>
      ))}
    </div>
  );
}

export default function OwnerProofReportPage() {
  const [report, setReport] = useState<OwnerProofReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const response = await fetch("/api/superadmin/owner-validation/report", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 403) {
        setForbidden(true);
        setReport(null);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Owner Proof Report failed (${response.status})`);
      }

      const body = (await response.json()) as { report: OwnerProofReport };
      setReport(body.report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner Proof Report could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReport]);

  const moduleCounts = useMemo(() => {
    if (!report) return null;
    return [
      ["Working", report.modulesPassed.length],
      ["Needs review", report.modulesNeedingReview.length],
      ["Broken", report.modulesFailed.length],
      ["Not tested", report.modulesNotTested.length],
    ];
  }, [report]);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <section className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-600" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-red-950">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-red-900">
            The Owner Proof Report is restricted to Super Admin users only.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHero
        eyebrow="Super Admin"
        title="Owner Proof Report"
        description="A printable plain-English report that answers what is working, what is broken, what changed, what needs review, and whether the platform is ready to demo or use with customers."
        actions={
          <>
            <Link href="/superadmin/owner-validation" className={appButtonSecondaryClassName}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Console
            </Link>
            <button type="button" className={appButtonSecondaryClassName} onClick={() => void loadReport()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Refresh
            </button>
            <button type="button" className={appButtonPrimaryClassName} onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden />
              Print Report
            </button>
          </>
        }
      />

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

      {loading && !report ? (
        <SectionCard title="Loading Report" description="The owner report is loading the latest validation runs, customer-ready gates, checklists, and change log.">
          <div className="flex items-center gap-3 text-sm text-[var(--app-text)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading owner proof data
          </div>
        </SectionCard>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <SectionCard title="Overall Platform Status" description={report.summary.plainEnglishSummary} tone="attention">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className={`rounded-xl border p-4 ${statusStyles(report.summary.overallStatus)}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">Status</p>
                  <p className="mt-2 text-2xl font-black">{report.summary.overallStatusLabel}</p>
                </div>
                <div className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Score</p>
                  <p className="mt-2 text-2xl font-black text-[var(--app-text-strong)]">{report.summary.overallScore}</p>
                </div>
                <div className={`rounded-xl border p-4 ${decisionStyles(report.summary.safeToDemo)}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">Safe to demo?</p>
                  <p className="mt-2 text-2xl font-black">{report.summary.safeToDemo}</p>
                </div>
                <div className={`rounded-xl border p-4 ${decisionStyles(report.summary.safeForCustomerUse)}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">Customer use?</p>
                  <p className="mt-2 text-2xl font-black">{report.summary.safeForCustomerUse}</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-[var(--app-text)]">
                Tested at: <strong>{formatDate(report.summary.testedAt)}</strong>. Tested by:{" "}
                <strong>{report.summary.testedBy ?? "No admin recorded"}</strong>.
              </p>
            </SectionCard>

            <SectionCard title="Manual Review Completion" description="Required owner checklist progress across the validation console.">
              <div className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                <p className="text-4xl font-black text-[var(--app-text-strong)]">{report.manualChecklist.completionPercent}%</p>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  {report.manualChecklist.passedRequired} of {report.manualChecklist.totalRequired} required items passed
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-950">
                  Needs review: {report.manualChecklist.needsReview}
                </p>
                <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-950">
                  Failed: {report.manualChecklist.failed}
                </p>
              </div>
            </SectionCard>
          </section>

          <SectionCard title="Module Results" description="Which modules are passing, need review, failed, or have not been tested.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {moduleCounts?.map(([label, count]) => (
                <div key={label} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">{label}</p>
                  <p className="mt-2 text-3xl font-black text-[var(--app-text-strong)]">{count}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Working" description="Modules currently marked green." className="shadow-none">
                <ModuleList modules={report.modulesPassed} emptyText="No modules are marked working yet." />
              </SectionCard>
              <SectionCard title="Needs Attention" description="Modules marked yellow, red, or not tested." className="shadow-none">
                <div className="space-y-4">
                  <ModuleList modules={report.modulesFailed} emptyText="No modules are marked broken." />
                  <ModuleList modules={report.modulesNeedingReview} emptyText="No modules are marked needs review." />
                  <ModuleList modules={report.modulesNotTested} emptyText="No modules are untested." />
                </div>
              </SectionCard>
            </div>
          </SectionCard>

          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top Risks" description="The most important owner-visible blockers and review items.">
              {report.topRisks.length > 0 ? (
                <ul className="space-y-2">
                  {report.topRisks.map((risk) => (
                    <li key={risk} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-950">
                      {risk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-[var(--app-muted)]">No top risk is recorded in the current report.</p>
              )}
            </SectionCard>

            <SectionCard title="Recommended Next Actions" description="What should happen before demo or customer use.">
              <ul className="space-y-2">
                {report.recommendedNextActions.map((action) => (
                  <li key={action} className="rounded-lg border border-[var(--app-border)] bg-white p-3 text-sm leading-6 text-[var(--app-text)]">
                    {action}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Customer-Ready Modules" description="Modules approved for demo or customer use.">
              {report.customerReadyModules.length > 0 ? (
                <div className="space-y-2">
                  {report.customerReadyModules.map((gate) => (
                    <div key={gate.module_key} className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <p className="font-bold">{gate.module_key}</p>
                      <p>{gate.customer_ready_status}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-[var(--app-muted)]">No module is approved for customer use yet.</p>
              )}
            </SectionCard>

            <SectionCard title="Blocked Modules" description="Modules blocked from customer-ready use.">
              {report.blockedModules.length > 0 ? (
                <div className="space-y-2">
                  {report.blockedModules.map((gate) => (
                    <div key={gate.module_key} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-950">
                      <p className="font-bold">{gate.module_key}</p>
                      <p>{gate.blocking_reason || "No blocking reason recorded."}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-[var(--app-muted)]">No module is blocked in the current report.</p>
              )}
            </SectionCard>
          </section>

          <SectionCard title="Latest Automated Checks" description="Plain-English results from the latest saved Owner Proof Report run.">
            {report.latestRunChecks.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {report.latestRunChecks.map((check) => (
                  <div key={check.id} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles(check.status)}`}>
                      <StatusIcon status={check.status} />
                      {STATUS_LABELS[check.status]}
                    </span>
                    <p className="mt-3 text-sm font-bold text-[var(--app-text-strong)]">{check.check_name}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{check.result}</p>
                    {check.recommended_owner_action ? (
                      <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">{check.recommended_owner_action}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-[var(--app-muted)]">No latest automated check results are available yet.</p>
            )}
          </SectionCard>

          <SectionCard title="What Changed Recently" description="Recent platform changes that may affect owner review or customer readiness.">
            <div className="space-y-3">
              {report.recentChanges.map((change) => (
                <div key={change.id} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--app-text-strong)]">{change.module_name}</p>
                    <span className="rounded-full bg-[var(--app-panel-soft)] px-2.5 py-1 text-xs font-bold text-[var(--app-muted)]">
                      {change.risk_level} risk
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text)]">{change.plain_english_description}</p>
                  <p className="mt-2 text-xs font-semibold text-[var(--app-muted)]">{formatDate(change.changed_at)}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Printable Export" description="Use the browser print dialog to save this report as a PDF when a formal owner review copy is needed.">
            <button type="button" className={appButtonPrimaryClassName} onClick={() => window.print()}>
              <FileText className="h-4 w-4" aria-hidden />
              Print or Save as PDF
            </button>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
