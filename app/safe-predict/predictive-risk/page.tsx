"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Download, HelpCircle, Lightbulb, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import {
  Card,
  ConfidenceGauge,
  DriverDots,
  ExportButton,
  ForecastTrendChart,
  PageHeader,
  SelectShell,
  SectionTitle,
  cx,
} from "@/components/safe-predict/SafePredictPrimitives";
import {
  safePredictMitigations,
} from "@/lib/safePredictMockData";
import { riskForecastForSite } from "@/lib/safePredictData";

export default function SafePredictPredictiveRiskPage() {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { dataset, selectedJobsiteId, setSelectedJobsiteId } = useSafePredictData();
  const activeSiteId = selectedJobsiteId === "all" ? dataset.jobsites[0]?.id ?? "riverside" : selectedJobsiteId;
  const activeForecast = riskForecastForSite(dataset, activeSiteId);
  const activeSite = dataset.jobsites.find((site) => site.id === activeSiteId) ?? dataset.jobsites[0];

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 pb-8 sm:px-7">
      <PageHeader
        title="Predictive AI Model"
        subtitle="AI-powered forecast of future safety risk so you can take action early."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowHowItWorks((current) => !current)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-transparent px-3 text-sm font-black text-slate-800"
            >
              <HelpCircle className="h-5 w-5" />
              How it works
            </button>
            <ExportButton
              fileName="safe-predict-risk-forecast.json"
              label="Export risk forecast"
              payload={{ company: dataset.company, activeSite, jobsites: dataset.jobsites, forecast: activeForecast, drivers: dataset.riskDrivers, mitigations: safePredictMitigations }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 shadow-sm"
            >
              <Download className="h-5 w-5" />
              Export
            </ExportButton>
          </>
        }
      />

      {showHowItWorks ? (
        <Card className="mb-5 border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-black text-blue-950">How SafetyDoc360 creates this guidance</p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-900">
            The MVP combines recent alerts, open corrective actions, inspection findings, training gaps, and permit exposure into a transparent risk forecast.
            It is guidance for safety managers, not a guarantee. Every high-risk signal is paired with a recommended action so the team can respond early.
          </p>
        </Card>
      ) : null}

      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[1fr_1fr_1fr_210px]">
          <SelectShell
            label="Project"
            value={activeSiteId}
            onChange={setSelectedJobsiteId}
            options={[
              ...dataset.jobsites.map((site) => ({ label: site.name, value: site.id })),
            ]}
          />
          <SelectShell
            label="Trade"
            value="all"
            options={[
              { label: "All Trades", value: "all" },
              { label: "Electrical", value: "electrical" },
              { label: "Steel Erection", value: "steel" },
            ]}
          />
          <SelectShell
            label="Time Period"
            value="30"
            options={[
              { label: "Next 30 Days", value: "30" },
              { label: "Next 60 Days", value: "60" },
            ]}
          />
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <RefreshCw className="h-6 w-6 text-slate-500" />
            <span>
              <span className="block text-sm font-black text-slate-800">Model updated</span>
              <span className="text-xs text-slate-500">Today, 7:30 AM</span>
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.75fr]">
        <Card id="forecast-drivers" className="scroll-mt-24 p-5">
          <SectionTitle title="Next 30 Days Risk Forecast" />
          <div className="relative mt-4">
            <div className="absolute left-[47%] top-4 z-10 hidden rounded-lg border border-red-400 bg-white text-center text-xs font-bold shadow-md md:block">
              <p className="rounded-t-md bg-red-500 px-4 py-1 text-white">HIGHEST RISK EXPECTED</p>
              <p className="px-4 py-2 text-slate-700">May 20 - May 23</p>
            </div>
            <div className="absolute left-0 top-7 z-10 hidden space-y-[31px] md:block">
              {["VERY HIGH", "HIGH", "MODERATE", "LOW"].map((label, index) => (
                <span
                  key={label}
                  className={cx(
                    "block rounded-full border px-3 py-1 text-[10px] font-black",
                    index === 0
                      ? "border-red-200 bg-red-50 text-red-600"
                      : index === 1
                        ? "border-orange-200 bg-orange-50 text-orange-600"
                        : index === 2
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-600"
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="md:pl-20">
              <ForecastTrendChart data={activeForecast} compact />
            </div>
          </div>
          <div className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_220px]">
            <div className="flex items-start gap-4">
              <CalendarDays className="mt-1 h-9 w-9 text-slate-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Forecast Summary</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Risk is expected to peak between May 20 - May 23 due to increased work at height activities and higher site activity.
                  Proactive actions now can help prevent incidents.
                </p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Model Confidence</p>
              <ConfidenceGauge value={87} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Top Drivers of Risk" />
          <div className="mt-4 divide-y divide-slate-100">
            {dataset.riskDrivers.map((driver, index) => (
              <div key={driver.id} className="grid grid-cols-[72px_1fr] gap-4 py-4 first:pt-0">
                <div
                  className={cx(
                    "grid h-16 w-16 place-items-center rounded-lg",
                    index === 0
                      ? "bg-red-50 text-red-500"
                      : index === 1
                        ? "bg-orange-50 text-orange-500"
                        : index === 2
                          ? "bg-amber-50 text-amber-500"
                          : "bg-blue-50 text-blue-500"
                  )}
                >
                  {index === 2 ? <Zap className="h-8 w-8" /> : index === 3 ? <ShieldCheck className="h-8 w-8" /> : <AlertIcon />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-black text-slate-900">{driver.name}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">{driver.detail}</p>
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className={cx("text-xs font-black uppercase", driver.impact === "High Impact" ? "text-red-500" : "text-amber-500")}>
                        {driver.impact}
                      </p>
                      <div className="mt-3"><DriverDots count={driver.score} level={driver.riskLevel} /></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link href="/safe-predict/risk-mitigation" className="mt-4 inline-flex items-center gap-2 font-black text-blue-600">
            View all risk drivers <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <SectionTitle title="Recommended Actions" />
        <p className="mt-1 text-sm text-slate-600">Actions you can take now to reduce risk and prevent incidents.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            ["Reinforce Fall Protection", "Conduct toolbox talks and verify fall protection usage this week.", "HIGH PRIORITY", "red"],
            ["Improve Housekeeping", "Assign daily housekeeping ownership and increase site walkthroughs.", "HIGH PRIORITY", "orange"],
            ["Control Electrical Exposure", "Review JSA's and ensure proper barricades and LOTO where needed.", "MEDIUM PRIORITY", "amber"],
            ["Close Training Gaps", "Schedule and complete overdue training for at-risk workers.", "MEDIUM PRIORITY", "amber"],
          ].map(([title, detail, priority, tone]) => (
            <Link key={title} href="/safe-predict/risk-mitigation" className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 hover:bg-white 2xl:border-r 2xl:border-slate-200 2xl:bg-white 2xl:pr-4 2xl:last:border-r-0">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-950">{title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p>
              </div>
              <span className={cx("rounded-lg border px-3 py-2 text-center text-xs font-black", tone === "red" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-200 bg-amber-50 text-amber-600")}>
                {priority}
              </span>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-blue-100 bg-blue-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-3 text-sm font-semibold text-blue-700">
          <Lightbulb className="h-5 w-5" />
          Taking action early is the best way to keep your team safe. Review recommendations and track progress.
        </p>
        <Link
          href="/safe-predict/risk-mitigation"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-5 py-2.5 text-sm font-black text-blue-700"
        >
          View Action Plan <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function AlertIcon() {
  return <AlertTriangle className="h-8 w-8" />;
}
