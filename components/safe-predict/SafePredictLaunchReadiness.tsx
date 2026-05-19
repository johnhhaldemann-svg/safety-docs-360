"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  HardHat,
  ImageIcon,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  safePredictModuleHealth,
  safePredictModuleRoute,
  summarizeSafePredictLaunch,
  type SafePredictLaunchHealth,
  type SafePredictModuleSummary,
} from "@/lib/safePredictLaunchReadiness";
import { summarizeSafePredictDataset } from "@/lib/safePredictData";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useSafePredictData } from "@/components/safe-predict/SafePredictDataProvider";
import { Card, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const healthClasses: Record<SafePredictLaunchHealth, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  attention: "border-amber-200 bg-amber-50 text-amber-700",
  "needs-data": "border-slate-200 bg-slate-50 text-slate-600",
};

const companyLogoStoragePrefix = "safe-predict-company-logo-v1";
const maxLogoBytes = 1_500_000;

type CompanyLogoState = {
  dataUrl: string;
  fileName: string;
};

function companyLogoStorageKey(companyId: string) {
  return `${companyLogoStoragePrefix}:${companyId || "workspace"}`;
}

function loadStoredCompanyLogo(companyId: string): CompanyLogoState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(companyLogoStorageKey(companyId)) || "null") as Partial<CompanyLogoState> | null;
    if (typeof parsed?.dataUrl === "string" && parsed.dataUrl.startsWith("data:image/")) {
      return { dataUrl: parsed.dataUrl, fileName: typeof parsed.fileName === "string" ? parsed.fileName : "Company logo" };
    }
  } catch {
    return null;
  }
  return null;
}

function healthLabel(health: SafePredictLaunchHealth) {
  if (health === "ready") return "Ready";
  if (health === "attention") return "Needs attention";
  return "Needs data";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function SafePredictLaunchReadiness() {
  const { dataset, loading, mode } = useSafePredictData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storedLogo, setStoredLogo] = useState<CompanyLogoState | null>(null);
  const [logoMessage, setLogoMessage] = useState("");
  const [logoSaving, setLogoSaving] = useState(false);
  const totals = summarizeSafePredictDataset(dataset);
  const modules: SafePredictModuleSummary[] = [
    {
      key: "jobsites",
      label: "Jobsites",
      total: dataset.jobsites.length,
      open: dataset.jobsites.filter((jobsite) => jobsite.riskLevel !== "low").length,
      inProgress: 0,
      closed: dataset.jobsites.filter((jobsite) => jobsite.riskLevel === "low").length,
    },
    {
      key: "users",
      label: "Workforce",
      total: dataset.employees.length,
      open: dataset.employees.filter((employee) => employee.status === "overdue").length,
      inProgress: dataset.employees.filter((employee) => employee.status === "expiring").length,
      closed: dataset.employees.filter((employee) => employee.status === "compliant").length,
    },
    {
      key: "actions",
      label: "Corrective Actions",
      total: dataset.actions.length,
      open: dataset.actions.filter((action) => action.status === "New").length,
      inProgress: dataset.actions.filter((action) => action.status === "In Progress" || action.status === "Awaiting Verification").length,
      closed: dataset.actions.filter((action) => action.status === "Closed").length,
    },
    {
      key: "permits",
      label: "Permits",
      total: dataset.permits.length,
      open: dataset.permits.filter((permit) => permit.status === "Expired").length,
      inProgress: dataset.permits.filter((permit) => permit.status === "Expiring Soon").length,
      closed: dataset.permits.filter((permit) => permit.status === "Active").length,
    },
    {
      key: "incidents",
      label: "Incidents",
      total: dataset.incidents.length,
      open: dataset.incidents.filter((incident) => incident.status !== "Closed").length,
      inProgress: 0,
      closed: dataset.incidents.filter((incident) => incident.status === "Closed").length,
    },
    {
      key: "observations",
      label: "Observations",
      total: dataset.observations.length,
      open: dataset.observations.filter((observation) => observation.status === "Open").length,
      inProgress: dataset.observations.filter((observation) => observation.status === "Converted").length,
      closed: dataset.observations.filter((observation) => observation.status === "Closed").length,
    },
    {
      key: "inspections",
      label: "Inspections",
      total: dataset.inspections.length,
      open: dataset.inspections.filter((inspection) => inspection.status === "Overdue" || inspection.status === "Failed Check").length,
      inProgress: dataset.inspections.filter((inspection) => inspection.status === "Scheduled" || inspection.status === "In Progress").length,
      closed: dataset.inspections.filter((inspection) => inspection.status === "Completed").length,
    },
    {
      key: "hazards",
      label: "Hazards",
      total: dataset.hazards.length,
      open: dataset.hazards.filter((hazard) => hazard.controlStatus === "Needs Control").length,
      inProgress: dataset.hazards.filter((hazard) => hazard.controlStatus === "Control Planned").length,
      closed: dataset.hazards.filter((hazard) => hazard.controlStatus === "Controlled").length,
    },
    {
      key: "reports",
      label: "Reports",
      total: dataset.reports.length,
      open: dataset.reports.filter((report) => report.status !== "Ready").length,
      inProgress: dataset.documents.filter((document) => document.status === "Draft").length,
      closed: dataset.reports.filter((report) => report.status === "Ready").length,
    },
  ];
  const summary = summarizeSafePredictLaunch({
    loading,
    companyName: dataset.company.name,
    hasLiveCompanyProfile: mode === "live",
    moduleSummaries: modules,
    activeJobsites: dataset.jobsites.length,
    activeUsers: dataset.employees.length,
    demoCompanyName: dataset.company.name,
  });
  const modeLabel = mode === "live" ? "Live data active" : "Workspace data active";
  const companyLogo = storedLogo ?? (dataset.company.logoDataUrl ? { dataUrl: dataset.company.logoDataUrl, fileName: dataset.company.logoFileName ?? "Company logo" } : null);
  const criticalGaps = [
    dataset.jobsites.length === 0 ? "Add at least one jobsite." : "",
    dataset.employees.length === 0 ? "Add workforce records." : "",
    dataset.actions.length === 0 ? "Create corrective action records." : "",
    dataset.permits.length === 0 ? "Add permit records." : "",
  ].filter(Boolean);

  useEffect(() => {
    const handle = window.setTimeout(() => setStoredLogo(loadStoredCompanyLogo(dataset.company.id)), 0);
    return () => window.clearTimeout(handle);
  }, [dataset.company.id]);

  async function saveCompanyLogo(logo: CompanyLogoState | null) {
    if (logo) {
      window.localStorage.setItem(companyLogoStorageKey(dataset.company.id), JSON.stringify(logo));
      setStoredLogo(logo);
    } else {
      window.localStorage.removeItem(companyLogoStorageKey(dataset.company.id));
      setStoredLogo(null);
    }

    setLogoMessage(logo ? "Logo added." : "Logo removed.");
    if (mode !== "live") return;

    setLogoSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLogoMessage("Logo is shown here, but you need to sign in again to save it to the company profile.");
        return;
      }
      const response = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          logoDataUrl: logo?.dataUrl ?? null,
          logoFileName: logo?.fileName ?? "",
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setLogoMessage(data?.error?.trim() || "Logo is shown here, but could not be saved to the company profile.");
        return;
      }
      setLogoMessage(logo ? "Logo saved to company profile." : "Logo removed from company profile.");
    } catch (err) {
      setLogoMessage(err instanceof Error ? err.message : "Logo is shown here, but could not be saved to the company profile.");
    } finally {
      setLogoSaving(false);
    }
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLogoMessage("Choose an image file for the company logo.");
      return;
    }

    if (file.size > maxLogoBytes) {
      setLogoMessage("Logo image must be under 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setLogoMessage("Could not read that logo file.");
        return;
      }
      void saveCompanyLogo({ dataUrl: reader.result, fileName: file.name });
    };
    reader.onerror = () => setLogoMessage("Could not read that logo file.");
    reader.readAsDataURL(file);
  }

  return (
    <Card className="mb-5 overflow-hidden border-blue-100">
      <div className="grid gap-0 2xl:grid-cols-[0.9fr_1.4fr]">
        <div className="border-b border-blue-100 bg-blue-50/55 p-5 2xl:border-b-0 2xl:border-r">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cx(
                  "group relative grid h-14 w-14 place-items-center overflow-hidden rounded-xl border bg-white text-blue-600 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  companyLogo ? "border-slate-200" : "border-blue-100"
                )}
                aria-label={companyLogo ? "Replace company logo" : "Add company logo"}
                title={companyLogo ? "Replace company logo" : "Add company logo"}
              >
                {companyLogo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- User-selected data URL logo preview. */}
                    <img src={companyLogo.dataUrl} alt={`${summary.companyName} logo`} className="h-full w-full object-contain p-1.5" />
                    <span className="absolute inset-0 grid place-items-center bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100">
                      <Upload className="h-5 w-5 text-white" aria-hidden />
                    </span>
                  </>
                ) : (
                  <ImageIcon className="h-6 w-6" aria-hidden />
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              {companyLogo ? (
                <button
                  type="button"
                  onClick={() => void saveCompanyLogo(null)}
                  className="mt-2 inline-flex h-7 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Remove company logo"
                  title="Remove company logo"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Launch readiness</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{summary.companyName}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {modeLabel}. SafetyDoc360 now owns the operating workflow while connected APIs and files feed the platform behind the scenes.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-xs font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  {companyLogo ? "Replace logo" : "Add logo"}
                </button>
                {logoMessage ? (
                  <span className="text-xs font-semibold text-slate-500" aria-live="polite">
                    {logoSaving ? "Saving logo..." : logoMessage}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <span className={cx("rounded-full border px-3 py-1", healthClasses[summary.health])}>
                  {healthLabel(summary.health)}
                </span>
                <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-blue-700">
                  {formatNumber(summary.connectedRecords)} connected records
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                  {criticalGaps.length === 0 ? "Launch checklist complete" : `${criticalGaps.length} gaps`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <SectionTitle title="Connected Operating System" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {modules.map((module) => {
              const health = safePredictModuleHealth(module);
              return (
                <Link
                  key={module.key}
                  href={safePredictModuleRoute(module.key)}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-white hover:shadow-[0_12px_22px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{module.label}</p>
                    <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-black", healthClasses[health])}>
                      {healthLabel(health)}
                    </span>
                  </div>
                  <p className="mt-2 font-app-display text-3xl font-black text-slate-950">{formatNumber(module.total)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {formatNumber(module.open + module.inProgress)} open or active
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 p-5 2xl:col-span-2">
          <SectionTitle title="Launch Checklist" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <Link href="/login" className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-white">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-950">Sign in / verify auth</span>
                <span className="block text-xs text-slate-500">Confirm launch account access.</span>
              </span>
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/safe-predict/jobsites" className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-white">
              <HardHat className="h-5 w-5 text-emerald-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-950">Verify jobsites</span>
                <span className="block text-xs text-slate-500">{formatNumber(summary.activeJobsites)} active in scope.</span>
              </span>
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/safe-predict/workforce" className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-white">
              <Users className="h-5 w-5 text-violet-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-950">Verify team roles</span>
                <span className="block text-xs text-slate-500">{formatNumber(summary.activeUsers)} people ready.</span>
              </span>
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/safe-predict/platform-actions" className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 hover:bg-white">
              <Database className="h-5 w-5 text-blue-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-950">Open all platform actions</span>
                <span className="block text-xs text-slate-500">Use every existing workflow.</span>
              </span>
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </Link>
          </div>

          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              {summary.health === "ready" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              )}
              <p className="text-xs font-semibold leading-5 text-amber-900">
                {criticalGaps.length === 0
                  ? `${formatNumber(totals.jobsites)} jobsites, ${formatNumber(totals.employees)} workers, and ${formatNumber(summary.openWorkItems)} open work items are launch-visible in SafetyDoc360.`
                  : criticalGaps.join(" ")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
