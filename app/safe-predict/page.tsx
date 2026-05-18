"use client";

import Link from "next/link";
import { AlertTriangle, Building2, CalendarDays, ClipboardCheck, GraduationCap, MapPin, ShieldAlert, ShieldCheck, TrendingUp, Users } from "lucide-react";
import {
  Card,
  ExportButton,
  ForecastTrendChart,
  MetricCard,
  MiniSparkline,
  PageHeader,
  RiskBadge,
  RiskHeatMap,
  SectionTitle,
  SelectShell,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  safePredictMitigations,
} from "@/lib/safePredictMockData";
import { SafePredictLaunchReadiness } from "@/components/safe-predict/SafePredictLaunchReadiness";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import { riskForecastForSite, summarizeSafePredictDataset } from "@/lib/safePredictData";

function SourceStatCard({
  title,
  value,
  detail,
  href,
  accentClassName = "text-slate-950",
}: {
  title: string;
  value: string | number;
  detail: string;
  href: string;
  accentClassName?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      aria-label={`${title}: view source records`}
    >
      <p className="text-xs font-black text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className={cx("mt-1 text-xs font-semibold", accentClassName)}>{detail}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-blue-600">
        View source
      </p>
    </Link>
  );
}

export default function SafePredictDashboardPage() {
  const { dataset, selectedJobsiteId, setSelectedJobsiteId } = useSafePredictData();
  const totals = summarizeSafePredictDataset(dataset);
  const selectedSiteId = selectedJobsiteId === "all" ? dataset.jobsites[0]?.id ?? "riverside" : selectedJobsiteId;
  const forecast = riskForecastForSite(dataset, selectedSiteId);
  const completedInspections = dataset.inspections.filter((inspection) => inspection.status === "Completed").length;
  const complianceRate = totals.workforce.compliantPercent;

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Dashboard"
        subtitle="Executive Overview"
        actions={
          <>
            <SelectShell
              value={selectedJobsiteId}
              onChange={setSelectedJobsiteId}
              options={[
                { label: "All Sites", value: "all" },
                ...dataset.jobsites.map((site) => ({ label: site.name, value: site.id })),
              ]}
            />
            <ExportButton
              fileName="safe-predict-dashboard.json"
              label="Export dashboard snapshot"
              payload={{ company: dataset.company, jobsites: dataset.jobsites, employees: dataset.employees, alerts: dataset.alerts, mitigations: safePredictMitigations, actions: dataset.actions, permits: dataset.permits }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"
            >
              <CalendarDays className="h-4 w-4" />
              May 11 - May 17, 2025
            </ExportButton>
          </>
        }
      />

      <div className="mb-5">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Welcome back, John.</h2>
        <p className="mt-1 text-slate-600">Here&apos;s what&apos;s happening across your projects today.</p>
      </div>

      <Card className="mb-5 p-5">
        <div className="grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Company Account</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{dataset.company.name}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {dataset.company.industry} tenant based in {dataset.company.headquarters}. Safety lead: {dataset.company.safetyLead}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{dataset.mode === "live" ? "Live data" : "Workspace data"}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{totals.jobsites} active jobsites</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{totals.employees} workers</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <SourceStatCard
              title="Workforce"
              value={totals.employees}
              detail={`${totals.overdueEmployees} overdue`}
              href="/safe-predict/workforce#employee-roster"
              accentClassName="text-red-600"
            />
            <SourceStatCard
              title="Open Actions"
              value={totals.openActions}
              detail="Across all jobsites"
              href="#jobsite-source-cards"
              accentClassName="text-slate-600"
            />
            <SourceStatCard
              title="Avg. Site Risk"
              value={totals.riskScore}
              detail={dataset.mode === "live" ? "Live score" : "Elevated"}
              href="#jobsite-source-cards"
              accentClassName="text-orange-600"
            />
          </div>
        </div>
      </Card>

      <SafePredictLaunchReadiness />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard
          title="Overall Site Risk Score"
          value={totals.riskScore}
          suffix="/100"
          detail="High Risk"
          trend="Up 8 pts vs. last 7 days"
          tone="red"
          icon={<ShieldAlert className="h-7 w-7" />}
          sparkline={<MiniSparkline data={[42, 47, 58, 44, 46, 56, 54]} />}
          href="/safe-predict/risk-mitigation#prioritized-risk-queue"
          sourceLabel="Open risk queue"
        />
        <MetricCard
          title="Predicted Incident Risk"
          value="24%"
          detail="High"
          trend="Up 6% vs. last 30 days"
          tone="orange"
          icon={<TrendingUp className="h-7 w-7" />}
          sparkline={<MiniSparkline data={[20, 22, 31, 28, 35, 38, 47]} color="#f97316" />}
          href="/safe-predict/predictive-risk#forecast-drivers"
          sourceLabel="Open forecast"
        />
        <MetricCard
          title="Open Corrective Actions"
          value={totals.openActions}
          detail="High Priority"
          trend="Up 5 vs. last 7 days"
          tone="red"
          icon={<ClipboardCheck className="h-7 w-7" />}
          href="/safe-predict/risk-mitigation#corrective-action-tracker"
          sourceLabel="Open action tracker"
        />
        <MetricCard
          title="Completed Inspections"
          value={completedInspections}
          detail="This Week"
          trend="Up 18 vs. last 7 days"
          tone="green"
          icon={<ShieldCheck className="h-7 w-7" />}
          href="/safe-predict/inspections"
          sourceLabel="Open inspection rows"
        />
        <MetricCard
          title="Training Compliance Rate"
          value={`${complianceRate}%`}
          detail="Compliant"
          trend="Up 4% vs. last 7 days"
          tone="green"
          icon={<GraduationCap className="h-7 w-7" />}
          href="/safe-predict/workforce#training-matrix"
          sourceLabel="Open training matrix"
        />
      </div>

      <div id="jobsite-source-cards" className="mt-5 grid scroll-mt-24 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {dataset.jobsites.map((jobsite) => (
          <Link key={jobsite.id} href={`/safe-predict/jobsites/${encodeURIComponent(jobsite.id)}`} className="group rounded-lg border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <MapPin className="h-5 w-5" />
              </span>
              <RiskBadge level={jobsite.riskLevel} />
            </div>
            <p className="mt-3 text-sm font-black text-slate-950">{jobsite.name}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{jobsite.code}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-md bg-slate-50 p-2 font-semibold text-slate-600"><Users className="mr-1 inline h-3.5 w-3.5" />{jobsite.workforceCount}</span>
              <span className="rounded-md bg-slate-50 p-2 font-semibold text-slate-600">{jobsite.openActions} actions</span>
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-blue-600">
              Open command center
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.25fr_1fr]">
        <Card className="p-5">
          <SectionTitle
            title="Predictive Risk Trend"
            action={
              <div className="hidden rounded-lg border border-slate-200 bg-white p-1 sm:flex">
                {["30 Days", "60 Days", "90 Days"].map((label, index) => (
                  <button
                    key={label}
                    className={cx(
                      "rounded-md px-3 py-1.5 text-xs font-bold",
                      index === 0 ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="mt-4 inline-flex rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
            AI models indicate risk levels will remain elevated over the next 30 days.
          </div>
          <ForecastTrendChart data={forecast} />
          <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-red-500" /> Historical Risk</span>
            <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-orange-500" /> Predicted Risk</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-200" /> High Risk</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-200" /> Medium Risk</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-200" /> Low Risk</span>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Risk Heat Map by Trade / Area"
            action={<Link href="/safe-predict/risk-mitigation" className="text-sm font-bold text-blue-600">View Full Map</Link>}
          />
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_168px]">
            <RiskHeatMap />
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">Risk Level</p>
              <div className="mt-4 space-y-4 text-sm font-semibold text-slate-600">
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> High (70-100)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500" /> Medium (40-69)</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Low (0-39)</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="p-5 pb-2">
            <SectionTitle title="Top Recommended Mitigations" />
          </div>
          <div className="space-y-3 p-4 pt-2 md:hidden">
            {safePredictMitigations.map((item) => (
              <article key={`${item.id}-mobile`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-black leading-snug text-slate-950">{item.recommendation}</p>
                  <RiskBadge level={item.priority} />
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{item.detail}</p>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-500">Drivers</dt>
                    <dd className="text-right font-semibold text-slate-800">{item.drivers.join(", ")}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-500">Impact</dt>
                    <dd className="font-semibold text-slate-800">{item.impact}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-500">Timeline</dt>
                    <dd className="font-semibold text-slate-800">{item.timeline}</dd>
                  </div>
                </dl>
                <Link href={`/safe-predict/risk-mitigation#${item.id}`} className="mt-4 inline-flex w-full justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50">
                  View Details
                </Link>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs font-bold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Recommendation</th>
                  <th className="px-5 py-3">Risk Drivers</th>
                  <th className="px-5 py-3">Impact</th>
                  <th className="px-5 py-3">Timeline</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {safePredictMitigations.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4"><RiskBadge level={item.priority} /></td>
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-900">{item.recommendation}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.drivers.join(", ")}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <span className="h-3 w-3 rounded-sm bg-red-500" />
                        <span className="h-3 w-3 rounded-sm bg-red-500" />
                        <span className="h-3 w-3 rounded-sm bg-red-500" />
                        {item.impact}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.timeline}</td>
                    <td className="px-5 py-4">
                      <Link href={`/safe-predict/risk-mitigation#${item.id}`} className="inline-flex rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-5">
            <Link href="/safe-predict/risk-mitigation" className="font-bold text-blue-600">View All Recommendations</Link>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Recent Alerts" action={<Link href="/safe-predict/risk-mitigation" className="text-sm font-bold text-blue-600">View All Alerts</Link>} />
          <div className="mt-5 divide-y divide-slate-100">
            {dataset.alerts.slice(0, 3).map((alert) => (
              <Link key={alert.id} href={`/safe-predict/risk-mitigation#${alert.id}`} className="flex items-start gap-4 py-4 first:pt-0 hover:bg-slate-50">
                <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", alert.riskLevel === "critical" || alert.riskLevel === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
                </div>
                <span className="text-sm text-slate-500">{alert.timeAgo}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
