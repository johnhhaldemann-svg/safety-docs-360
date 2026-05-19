"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, Check, Clock, Download, FileText, Flame, MapPin, ShieldCheck, TrendingUp, UserRound, Users, X } from "lucide-react";
import {
  Card,
  ExportButton,
  NextStepRow,
  PageHeader,
  ReadinessDonut,
  SectionTitle,
  StatusIcon,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  jobsiteForId,
  permitTotals,
  safePredictDemoCompany,
  safePredictDemoEmployees,
  safePredictDemoJobsites,
  safePredictPermits,
  safePredictTradeReadiness,
  workforceTotals,
  type SafePredictDemoEmployee,
  type SafePredictDemoEmployeeStatus,
} from "@/lib/safePredictMockData";

const statusLabels: Record<SafePredictDemoEmployeeStatus, string> = {
  compliant: "Compliant",
  expiring: "Expiring Soon",
  overdue: "Overdue",
};

export default function SafePredictWorkforcePage() {
  const [statusFilter, setStatusFilter] = useState<"all" | SafePredictDemoEmployeeStatus>("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const workforce = workforceTotals(safePredictTradeReadiness);
  const permits = permitTotals(safePredictPermits);
  const visibleEmployees = useMemo(
    () =>
      safePredictDemoEmployees.filter(
        (employee) =>
          (statusFilter === "all" || employee.status === statusFilter) &&
          (siteFilter === "all" || employee.assignedSiteId === siteFilter)
    ),
    [siteFilter, statusFilter]
  );
  const selectedEmployee = selectedEmployeeId
    ? safePredictDemoEmployees.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null;

  useEffect(() => {
    if (!selectedEmployee) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedEmployeeId(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedEmployee]);

  function focusRoster() {
    document.getElementById("employee-roster")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function filterByStatus(status: "all" | SafePredictDemoEmployeeStatus) {
    setStatusFilter(status);
    focusRoster();
  }

  function filterBySite(siteId: string) {
    setSiteFilter(siteId);
    focusRoster();
  }

  function clearRosterFilters() {
    setStatusFilter("all");
    setSiteFilter("all");
  }

  function openEmployeeProfile(employeeId: string) {
    setSelectedEmployeeId(employeeId);
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Workforce Readiness & Prevention"
        subtitle="Ensure your people are ready, compliant, and protected."
        actions={
          <>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
              <CalendarDays className="h-4 w-4" />
              May 20 - May 26, 2024
            </button>
            <Link
              href="/safe-predict/team-access"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <Users className="h-4 w-4" />
              Manage Team Access
            </Link>
            <ExportButton
              fileName="safe-predict-workforce-readiness.json"
              label="Export workforce readiness report"
              payload={{ company: safePredictDemoCompany, workforce, permits, employees: safePredictDemoEmployees, jobsites: safePredictDemoJobsites, trades: safePredictTradeReadiness, permitRows: safePredictPermits }}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_20px_rgba(37,99,235,0.24)]"
            >
              <Download className="h-4 w-4" />
              Export Report
            </ExportButton>
          </>
        }
      />

      <div className="grid gap-4 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <Card className="p-5 text-center">
          <button type="button" onClick={() => filterByStatus("all")} className="block w-full rounded-lg text-center focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
            <SectionTitle title="Overall Readiness Score" hint={false} />
            <div className="mx-auto mt-4 grid h-28 w-28 place-items-center rounded-full bg-[conic-gradient(#16a34a_0_84%,#dcfce7_84%_100%)] p-2">
              <div className="grid h-full w-full place-items-center rounded-full bg-white">
                <span>
                  <span className="block text-4xl font-black text-slate-950">84</span>
                  <span className="text-xs font-bold text-slate-500">/100</span>
                </span>
              </div>
            </div>
            <p className="mt-3 text-lg font-black text-emerald-700">Good</p>
            <p className="mt-3 text-sm font-semibold text-slate-600">View all roster sources</p>
          </button>
        </Card>

        <Card className="grid gap-0 p-5 md:grid-cols-3">
          {[
            { title: "Compliant", value: `${workforce.compliantPercent}%`, detail: `${workforce.compliant} workers`, tone: "green", status: "compliant" },
            { title: "Expiring Soon", value: `${workforce.expiringSoonPercent}%`, detail: `${workforce.expiringSoon} workers`, tone: "amber", status: "expiring" },
            { title: "Overdue", value: `${workforce.overduePercent}%`, detail: `${workforce.overdue} workers`, tone: "red", status: "overdue" },
          ].map(({ title, value, detail, tone, status }) => (
            <button
              key={title}
              type="button"
              onClick={() => filterByStatus(status as SafePredictDemoEmployeeStatus)}
              className={cx(
                "border-b border-slate-200 p-4 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0",
                statusFilter === status ? "bg-blue-50/60" : undefined
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-full text-white", tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-red-500")}>
                  {tone === "green" ? <Check className="h-8 w-8" /> : tone === "amber" ? <Clock className="h-8 w-8" /> : <AlertCircle className="h-8 w-8" />}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-900">{title}</p>
                  <p className="mt-1 font-app-display text-4xl font-black text-slate-950">{value}</p>
                  <p className="mt-1 text-sm text-slate-600">{detail}</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-slate-100">
                <div className={cx("h-full rounded-full", tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500")} style={{ width: value }} />
              </div>
            </button>
          ))}
        </Card>

        <Card className="grid gap-0 p-5 md:grid-cols-2">
          <Link href="#permit-register" className="flex items-center gap-4 border-b border-slate-200 pb-5 transition hover:bg-slate-50 md:border-b-0 md:border-r md:pb-0 md:pr-5">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white">
              <FileText className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-black text-slate-900">Active Permits</p>
              <p className="mt-1 font-app-display text-4xl font-black text-slate-950">{permits.active}</p>
              <p className="mt-1 text-sm text-slate-600">Across 12 sites.</p>
            </div>
          </Link>
          <Link href="/safe-predict/predictive-risk#forecast-drivers" className="flex items-center gap-4 pt-5 transition hover:bg-slate-50 md:pl-5 md:pt-0">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-purple-600 text-white">
              <TrendingUp className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-black text-slate-900">High Risk Forecast</p>
              <p className="mt-1 font-app-display text-3xl font-black text-purple-700">Elevated</p>
              <p className="mt-2 text-sm font-black text-red-600">Up 12% vs last week</p>
            </div>
          </Link>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <Card id="employee-roster" className="scroll-mt-24 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionTitle
              title="Shell Employee Roster"
              action={
                statusFilter !== "all" || siteFilter !== "all" ? (
                  <button type="button" onClick={clearRosterFilters} className="text-sm font-black text-blue-600">
                    Clear roster filters
                  </button>
                ) : null
              }
            />
            <p className="mt-1 text-sm text-slate-600">{safePredictDemoCompany.name} demo people data for workforce, training, assignment, and risk conversations.</p>
            <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Showing {visibleEmployees.length} of {safePredictDemoEmployees.length} shell employees
              {statusFilter !== "all" ? ` - ${statusLabels[statusFilter]}` : ""}
              {siteFilter !== "all" ? ` - ${jobsiteForId(safePredictDemoJobsites, siteFilter)?.name ?? "Selected site"}` : ""}
            </p>
          </div>
          <div className="space-y-3 p-4 pt-1 md:hidden">
            {visibleEmployees.map((employee) => {
              const jobsite = jobsiteForId(safePredictDemoJobsites, employee.assignedSiteId);
              return (
                <MobileRecordCard
                  key={`${employee.id}-mobile`}
                  title={employee.name}
                  active={selectedEmployeeId === employee.id}
                  actionLabel={`Open ${employee.name} profile`}
                  onClick={() => openEmployeeProfile(employee.id)}
                  rows={[
                    ["Trade", employee.trade],
                    ["Role", employee.role],
                    ["Jobsite", jobsite?.name ?? "Unassigned"],
                    ["Readiness", `${employee.readinessScore}`],
                    ["Status", statusLabels[employee.status]],
                  ]}
                />
              );
            })}
            {visibleEmployees.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                No employees match those roster filters.
              </div>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Trade / Role</th>
                  <th className="px-5 py-3">Assigned Jobsite</th>
                  <th className="px-5 py-3 text-center">Readiness</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => {
                  const jobsite = jobsiteForId(safePredictDemoJobsites, employee.assignedSiteId);
                  return (
                    <tr
                      key={employee.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${employee.name} profile`}
                      onClick={() => openEmployeeProfile(employee.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEmployeeProfile(employee.id);
                        }
                      }}
                      className={cx(
                        "group cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/50 focus:bg-blue-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100",
                        selectedEmployeeId === employee.id ? "bg-blue-50" : undefined
                      )}
                    >
                      <td className="px-5 py-3">
                        <p className="inline-flex items-center gap-2 font-black text-slate-900">
                          {employee.name}
                          <ArrowRight className="h-3.5 w-3.5 text-blue-500 opacity-0 transition group-hover:opacity-100" />
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{employee.id} - {employee.shift} shift</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{employee.trade}</p>
                        <p className="mt-1 text-xs text-slate-500">{employee.role}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{jobsite?.name ?? "Unassigned"}</td>
                      <td className="px-5 py-3 text-center font-black text-slate-900">{employee.readinessScore}</td>
                      <td className="px-5 py-3">
                        <span className={cx("rounded-full px-3 py-1 text-xs font-black", employee.status === "overdue" ? "bg-red-50 text-red-600" : employee.status === "expiring" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                          {employee.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {visibleEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
                      No employees match those roster filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-5">
            <Link href="/safe-predict/team-access" className="inline-flex items-center gap-2 font-black text-blue-600">
              Add, remove, or archive team members <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Jobsite Assignment Snapshot" />
          <div className="mt-4 space-y-3">
            {safePredictDemoJobsites.map((jobsite) => (
              <button
                key={jobsite.id}
                type="button"
                onClick={() => filterBySite(jobsite.id)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
                  siteFilter === jobsite.id ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-slate-50"
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                  <MapPin className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-900">{jobsite.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{jobsite.workforceCount} workers - {jobsite.siteLead}</span>
                </span>
                <span className="text-sm font-black text-slate-900">{jobsite.riskScore}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card id="training-matrix" className="scroll-mt-24 overflow-hidden">
          <div className="p-5 pb-3"><SectionTitle title="Training & Compliance Matrix" /></div>
          <div className="space-y-3 p-4 pt-1 md:hidden">
            {safePredictTradeReadiness.map((row) => (
              <MobileRecordCard
                key={`${row.trade}-mobile`}
                title={row.trade}
                rows={[
                  ["Workers", `${row.workers}`],
                  ["Fall Protection", statusLabels[row.fallProtection]],
                  ["Confined Space", statusLabels[row.confinedSpace]],
                  ["LOTO", statusLabels[row.loto]],
                  ["HazCom", statusLabels[row.hazcom]],
                  ["First Aid", statusLabels[row.firstAid]],
                  ["Overall", row.overallStatus],
                ]}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
                  <th className="px-5 py-3">Team / Trade</th>
                  <th className="px-5 py-3 text-center">Workers</th>
                  <th className="px-5 py-3 text-center">Fall Protection</th>
                  <th className="px-5 py-3 text-center">Confined Space</th>
                  <th className="px-5 py-3 text-center">LOTO</th>
                  <th className="px-5 py-3 text-center">HazCom</th>
                  <th className="px-5 py-3 text-center">First Aid</th>
                  <th className="px-5 py-3 text-center">Overall Status</th>
                </tr>
              </thead>
              <tbody>
                {safePredictTradeReadiness.map((row) => (
                  <tr key={row.trade} className="border-b border-slate-100">
                    <td className="px-5 py-3 font-black text-slate-900"><Users className="mr-2 inline h-4 w-4 text-blue-600" />{row.trade}</td>
                    <td className="px-5 py-3 text-center font-semibold text-slate-700">{row.workers}</td>
                    <td className="px-5 py-3 text-center"><StatusIcon status={row.fallProtection} /></td>
                    <td className="px-5 py-3 text-center"><StatusIcon status={row.confinedSpace} /></td>
                    <td className="px-5 py-3 text-center"><StatusIcon status={row.loto} /></td>
                    <td className="px-5 py-3 text-center"><StatusIcon status={row.hazcom} /></td>
                    <td className="px-5 py-3 text-center"><StatusIcon status={row.firstAid} /></td>
                    <td className="px-5 py-3 text-center">
                      <span className={cx("rounded-full px-3 py-1 text-xs font-black", row.overallStatus === "Overdue" ? "bg-red-50 text-red-600" : row.overallStatus === "Expiring" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                        {row.overallStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <div className="flex flex-wrap gap-5 text-slate-600">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Compliant</span>
              <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /> Expiring (&lt;= 30 days)</span>
              <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500" /> Overdue (&gt; 30 days)</span>
            </div>
            <Link href="/safe-predict/training" className="inline-flex items-center gap-2 font-black text-blue-600">
              View full training report <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <Card id="permit-register" className="scroll-mt-24 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionTitle title="Required Permits" action={<Link href="/safe-predict/permits" className="inline-flex items-center gap-2 text-sm font-black text-blue-600">View all permits <ArrowRight className="h-4 w-4" /></Link>} />
          </div>
          <div className="space-y-3 p-4 pt-1 md:hidden">
            {safePredictPermits.map((permit) => (
              <MobileRecordCard
                key={`${permit.type}-mobile`}
                title={permit.type}
                rows={[
                  ["Active", `${permit.active}`],
                  ["Expiring Soon", `${permit.expiringSoon}`],
                  ["Expired", `${permit.expired}`],
                ]}
              />
            ))}
            <MobileRecordCard
              title="Total"
              rows={[
                ["Active", `${permits.active}`],
                ["Expiring Soon", `${permits.expiringSoon}`],
                ["Expired", `${permits.expired}`],
              ]}
            />
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-black text-slate-600">
                <th className="px-5 py-3">Permit Type</th>
                <th className="px-5 py-3 text-center">Active</th>
                <th className="px-5 py-3 text-center">Expiring Soon</th>
                <th className="px-5 py-3 text-center">Expired</th>
              </tr>
            </thead>
            <tbody>
              {safePredictPermits.map((permit) => (
                <tr key={permit.type} className="border-b border-slate-100">
                  <td className="px-5 py-3 font-black text-slate-900"><Flame className="mr-2 inline h-4 w-4 text-orange-500" />{permit.type}</td>
                  <td className="px-5 py-3 text-center font-black text-emerald-700">{permit.active}</td>
                  <td className="px-5 py-3 text-center font-black text-amber-600">{permit.expiringSoon}</td>
                  <td className="px-5 py-3 text-center font-black text-red-600">{permit.expired}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-black">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-center text-emerald-700">{permits.active}</td>
                <td className="px-5 py-3 text-center text-amber-600">{permits.expiringSoon}</td>
                <td className="px-5 py-3 text-center text-red-600">{permits.expired}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        <Card className="p-5">
          <SectionTitle title="Worker Readiness by Status" />
          <div className="mt-3 grid gap-4 md:grid-cols-[210px_1fr] xl:grid-cols-[210px_1fr] 2xl:grid-cols-[210px_1fr]">
            <div className="relative">
              <ReadinessDonut />
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <span>
                  <Users className="mx-auto h-7 w-7 text-slate-700" />
                  <span className="mt-1 block text-sm font-black text-slate-950">{workforce.workers}</span>
                  <span className="text-xs text-slate-500">Total Workers</span>
                </span>
              </div>
            </div>
            <div className="space-y-4 self-center text-sm">
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-600" />Compliant</span><strong>{workforce.compliant} (78%)</strong></p>
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" />Expiring Soon</span><strong>{workforce.expiringSoon} (15%)</strong></p>
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" />Overdue</span><strong>{workforce.overdue} (7%)</strong></p>
            </div>
          </div>
          <Link href="/safe-predict/team-access" className="mt-4 inline-flex items-center gap-2 font-black text-blue-600">Manage live roster <ArrowRight className="h-4 w-4" /></Link>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Prevention Insights" action={<span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">AI</span>} />
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Our AI model analyzes training, permit, and workforce data to predict risk and prevent incidents.
          </p>
          <div className="mt-4 rounded-lg bg-violet-50 p-4 text-sm font-black leading-6 text-violet-900">
            28 workers have overdue training and/or permit gaps across 3 high-risk activities.
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="font-black text-slate-900">Predicted Risk Impact</span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">High Up 22%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="font-black text-slate-900">Potential Incident Likelihood</span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">Elevated Up 18%</span>
            </div>
          </div>
          <Link href="/safe-predict/predictive-risk" className="mt-4 inline-flex items-center gap-2 font-black text-blue-600">
            View full predictive analysis <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Recommended Next Steps" />
          <div className="mt-4 space-y-2">
            <NextStepRow href="/safe-predict/training" title="Address 28 overdue training items" detail="Focus on LOTO and Fall Protection." tone="critical" icon={<AlertCircle className="h-5 w-5" />} />
            <NextStepRow href="/safe-predict/permit-center" title="Renew 11 expiring permits" detail="Confined Space and Hot Work expiring soon." tone="medium" icon={<Clock className="h-5 w-5" />} />
            <NextStepRow href="/safe-predict/training" title="Schedule refresher training" detail="First Aid and HazCom for 63 workers." tone="blue" icon={<Users className="h-5 w-5" />} />
            <NextStepRow href="/safe-predict/risk-mitigation" title="Reinforce pre-task planning" detail="Include permit and training verification." tone="low" icon={<ShieldCheck className="h-5 w-5" />} />
          </div>
          <Link href="/safe-predict/risk-mitigation" className="mt-4 inline-flex items-center gap-2 font-black text-blue-600">
            View all actions <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <EmployeeProfileDrawer employee={selectedEmployee} onClose={() => setSelectedEmployeeId(null)} />

      <p className="mt-5 text-center text-xs font-semibold text-slate-500">Data is refreshed every 15 minutes</p>
    </div>
  );
}

function EmployeeProfileDrawer({
  employee,
  onClose,
}: {
  employee: SafePredictDemoEmployee | null;
  onClose: () => void;
}) {
  if (!employee) return null;

  const jobsite = jobsiteForId(safePredictDemoJobsites, employee.assignedSiteId);
  const profileRows: Array<[string, string]> = [
    ["Employee ID", employee.id],
    ["Supervisor", employee.supervisor],
    ["Shift", `${employee.shift} shift`],
    ["Assigned jobsite", jobsite?.name ?? "Unassigned"],
    ["Project phase", jobsite?.phase ?? "No active assignment"],
    ["Last activity", employee.lastActivity],
  ];

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close employee profile" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/35" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-profile-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
      >
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-blue-600">Employee profile</p>
              <h2 id="employee-profile-title" className="mt-2 text-2xl font-black leading-tight text-slate-950">
                {employee.name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {employee.trade} - {employee.role}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close employee profile"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Readiness</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{employee.readinessScore}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Status</p>
              <span className={cx("mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black", employeeStatusClass(employee.status))}>
                {statusLabels[employee.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 p-5">
          <section>
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
              <UserRound className="h-4 w-4 text-blue-600" />
              Profile details
            </h3>
            <dl className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {profileRows.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
                  <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
                  <dd className="text-sm font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Credentials
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {employee.credentials.map((credential) => (
                <span key={credential} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  {credential}
                </span>
              ))}
            </div>
          </section>

          {jobsite ? (
            <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
                <MapPin className="h-4 w-4 text-blue-600" />
                Assignment
              </h3>
              <p className="mt-2 text-sm font-black text-slate-900">{jobsite.name}</p>
              <p className="mt-1 text-sm text-slate-600">{jobsite.address}, {jobsite.cityState}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Site risk</p>
                  <p className="font-black text-slate-900">{jobsite.riskScore}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Open actions</p>
                  <p className="font-black text-slate-900">{jobsite.openActions}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 p-5">
          <Link href="/safe-predict/training" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white">
            Training records <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/safe-predict/team-access" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700">
            Team access <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function employeeStatusClass(status: SafePredictDemoEmployeeStatus) {
  if (status === "overdue") return "bg-red-50 text-red-600";
  if (status === "expiring") return "bg-amber-50 text-amber-600";
  return "bg-emerald-50 text-emerald-600";
}

function MobileRecordCard({
  title,
  rows,
  actionLabel,
  active,
  onClick,
}: {
  title: string;
  rows: Array<[string, string]>;
  actionLabel?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        aria-label={actionLabel ?? title}
        onClick={onClick}
        className={cx(
          "block w-full rounded-lg border bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
          active ? "border-blue-300 bg-blue-50" : "border-slate-200"
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="text-base font-black leading-snug text-slate-950">{title}</span>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        </span>
        <span className="mt-3 grid gap-2 text-sm">
          {rows.map(([label, value]) => (
            <span key={`${title}-${label}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-500">{label}</span>
              <span className="text-right font-semibold text-slate-800">{value}</span>
            </span>
          ))}
        </span>
      </button>
    );
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-base font-black leading-snug text-slate-950">{title}</p>
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="flex justify-between gap-3 border-t border-slate-200 pt-2">
            <dt className="font-bold text-slate-500">{label}</dt>
            <dd className="text-right font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
