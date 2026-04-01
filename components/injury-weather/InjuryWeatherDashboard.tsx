"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { LeadingIndicatorsPanel } from "@/components/injury-weather/LeadingIndicatorsPanel";
import { InjuryRiskTreePanel } from "@/components/injury-weather/InjuryRiskTreePanel";
import { US_STATE_OPTIONS } from "@/lib/injuryWeather/locationWeather";
import {
  forecastModeDisplayLabel,
  riskBandMeaningForDataConfidence,
} from "@/lib/injuryWeather/dataConfidence";
import { fallbackDashboardBlocksFromData } from "@/lib/injuryWeather/ai";
import { INJURY_WEATHER_ASSUMPTIONS } from "@/lib/injuryWeather/types";
import type {
  InjuryWeatherAiInsights,
  InjuryWeatherDashboardData,
  RiskLevel,
  TradeForecast,
  TrendPoint,
} from "@/lib/injuryWeather/types";

function controlsForCategory(trade: string, categoryName: string, risk: RiskLevel): string[] {
  const hay = `${trade} ${categoryName}`.toLowerCase();
  const bullets: string[] = [];
  if (/fall|ladder|harness|roof/i.test(hay)) {
    bullets.push("Verify 100% tie-off at leading edges and openings; guardrails or nets where required.");
    bullets.push("Inspect ladder setup, angle, and secure footing before each shift.");
  }
  if (/electrical|loto|power|arc|temporary/i.test(hay)) {
    bullets.push("Verify lockout/tagout before any energized work; test for absence of voltage.");
    bullets.push("GFCI protection and cord inspection for temporary power runs.");
  }
  if (/rigging|crane|lift|steel/i.test(hay)) {
    bullets.push("Qualified rigger sign-off on rigging plans and load charts.");
    bullets.push("Pre-lift meeting with spotter and exclusion zone enforcement.");
  }
  if (/weld|hot.?work/i.test(hay)) {
    bullets.push("Hot-work permit and fire watch for 30+ minutes after completion.");
  }
  if (/struck|formwork|concrete|rebar/i.test(hay)) {
    bullets.push("Struck-by barricades and spotter communication for heavy equipment.");
  }
  if (bullets.length === 0) {
    bullets.push("Daily supervisor walkthrough focused on this hazard category.");
    bullets.push("Document corrective actions in the safety system within 24–48 hours.");
  }
  if (risk === "HIGH" || risk === "CRITICAL") {
    bullets.push("Increase inspection frequency to at least daily until trend improves.");
  }
  return bullets.slice(0, 5);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function riskTone(level: RiskLevel) {
  if (level === "CRITICAL") return "bg-red-500/20 text-red-200 border-red-400/40";
  if (level === "HIGH") return "bg-orange-500/20 text-orange-200 border-orange-400/40";
  if (level === "MODERATE") return "bg-amber-500/20 text-amber-200 border-amber-400/40";
  return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
}

function categoryTone(level: RiskLevel) {
  if (level === "CRITICAL") return "border-red-500/70 bg-gradient-to-r from-red-700/80 to-red-500/50 text-white";
  if (level === "HIGH") return "border-orange-500/70 bg-gradient-to-r from-orange-700/80 to-orange-500/50 text-white";
  if (level === "MODERATE") return "border-amber-500/70 bg-gradient-to-r from-amber-700/80 to-amber-500/50 text-white";
  return "border-emerald-500/70 bg-gradient-to-r from-emerald-700/80 to-emerald-500/50 text-white";
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const w = 720;
  const h = 220;
  const pad = 26;
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = 0;
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return { x, y, ...p };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-64 w-full">
      <polyline
        fill="none"
        stroke="rgb(248 113 113)"
        strokeWidth="3"
        points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
      />
      {coords.map((c) => (
        <g key={c.month}>
          <circle cx={c.x} cy={c.y} r="4.5" fill={c.highRisk ? "rgb(239 68 68)" : "white"} stroke="rgb(248 113 113)" strokeWidth="2" />
          <text x={c.x} y={h - 4} textAnchor="middle" className="fill-slate-400" style={{ fontSize: "10px" }}>
            {c.month}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function InjuryWeatherDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [workforceTotal, setWorkforceTotal] = useState("");
  const [appliedMonth, setAppliedMonth] = useState("");
  const [appliedTrades, setAppliedTrades] = useState<string[]>([]);
  const [appliedWorkforceTotal, setAppliedWorkforceTotal] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [appliedHoursWorked, setAppliedHoursWorked] = useState("");
  const [workSevenDaysPerWeek, setWorkSevenDaysPerWeek] = useState(false);
  const [appliedWorkSevenDaysPerWeek, setAppliedWorkSevenDaysPerWeek] = useState(false);
  const [hoursPerDaySchedule, setHoursPerDaySchedule] = useState("");
  const [appliedHoursPerDaySchedule, setAppliedHoursPerDaySchedule] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [appliedStateCode, setAppliedStateCode] = useState("");
  const [reportRun, setReportRun] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const bypassCacheOnce = useRef(false);
  /** Trade-chip toggles set this so the first request skips OpenAI and the UI can render immediately. */
  const deferAiAfterTradeToggleRef = useRef(false);
  /** Drop stale background AI responses when the user changes filters again. */
  const dashboardFetchSeqRef = useRef(0);
  const [project, setProject] = useState("All Projects");
  const [data, setData] = useState<InjuryWeatherDashboardData | null>(null);
  const [error, setError] = useState("");
  const [aiInsights, setAiInsights] = useState<InjuryWeatherAiInsights | null>(null);
  const [controlsOpen, setControlsOpen] = useState<TradeForecast | null>(null);
  const [numberBreakdownOpen, setNumberBreakdownOpen] = useState<TradeForecast | null>(null);
  const [fieldAttestation, setFieldAttestation] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setControlsOpen(null);
        setNumberBreakdownOpen(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const fetchSeq = ++dashboardFetchSeqRef.current;
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          router.replace("/login");
          return;
        }
        const meRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        const meData = (await meRes.json().catch(() => null)) as { user?: { role?: string } } | null;
        if (!meRes.ok) {
          router.replace("/login");
          return;
        }
        if (String(meData?.user?.role ?? "").toLowerCase() !== "super_admin") {
          router.replace("/dashboard");
          return;
        }

        const buildQs = (includeAi: boolean) => {
          const qs = new URLSearchParams();
          if (appliedMonth) qs.set("month", appliedMonth);
          if (appliedTrades.length > 0) qs.set("trades", appliedTrades.join(","));
          if (appliedWorkforceTotal.trim()) qs.set("workforceTotal", appliedWorkforceTotal.trim());
          if (appliedHoursWorked.trim()) qs.set("hoursWorked", appliedHoursWorked.trim());
          if (appliedWorkSevenDaysPerWeek) qs.set("workSevenDaysPerWeek", "1");
          if (appliedHoursPerDaySchedule.trim()) qs.set("hoursPerDay", appliedHoursPerDaySchedule.trim());
          if (appliedStateCode.trim()) qs.set("state", appliedStateCode.trim());
          qs.set("includeAi", includeAi ? "true" : "false");
          if (bypassCacheOnce.current) {
            qs.set("refresh", "1");
            bypassCacheOnce.current = false;
          }
          return qs;
        };

        const deferAiForSpeed = deferAiAfterTradeToggleRef.current;
        deferAiAfterTradeToggleRef.current = false;

        const res = await fetch(`/api/superadmin/injury-weather?${buildQs(!deferAiForSpeed).toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as
          | (InjuryWeatherDashboardData & { aiInsights?: InjuryWeatherAiInsights })
          | { error?: string }
          | null;
        if (fetchSeq !== dashboardFetchSeqRef.current) return;

        if (!res.ok || !payload || "error" in payload) {
          setError((payload as { error?: string } | null)?.error || "Failed to load Injury Weather dashboard.");
        } else {
          const typed = payload as InjuryWeatherDashboardData & { aiInsights?: InjuryWeatherAiInsights };
          setData(typed);
          if (deferAiForSpeed) {
            setAiInsights(null);
          } else {
            setAiInsights(typed.aiInsights ?? null);
          }
          if (!month) {
            const months = typed.availableMonths;
            const latest = months.length > 0 ? months[months.length - 1] : typed.summary.month;
            setMonth(latest);
            setAppliedMonth(latest);
          } else if (!appliedMonth) setAppliedMonth(month);

          if (deferAiForSpeed) {
            const qsAi = buildQs(true);
            void (async () => {
              try {
                const r = await fetch(`/api/superadmin/injury-weather?${qsAi.toString()}`, {
                  headers: { Authorization: `Bearer ${token}` },
                  cache: "no-store",
                });
                const body = (await r.json().catch(() => null)) as
                  | (InjuryWeatherDashboardData & { aiInsights?: InjuryWeatherAiInsights })
                  | null;
                if (fetchSeq !== dashboardFetchSeqRef.current) return;
                if (r.ok && body && !("error" in body)) {
                  setAiInsights((body as { aiInsights?: InjuryWeatherAiInsights }).aiInsights ?? null);
                }
              } catch {
                if (fetchSeq === dashboardFetchSeqRef.current) setAiInsights(null);
              }
            })();
          }
        }
      } catch {
        setError("Failed to load Injury Weather dashboard.");
      } finally {
        if (fetchSeq === dashboardFetchSeqRef.current) {
          setLoading(false);
        }
      }
    })();
  }, [
    router,
    appliedMonth,
    appliedTrades,
    appliedWorkforceTotal,
    appliedHoursWorked,
    appliedWorkSevenDaysPerWeek,
    appliedHoursPerDaySchedule,
    appliedStateCode,
    month,
    reportRun,
    refreshTick,
  ]);

  const trades = useMemo(
    () => (data?.availableTrades?.length ? data.availableTrades : data?.tradeForecasts.map((t) => t.trade) ?? []),
    [data]
  );
  const toggleTrade = (tradeName: string) => {
    deferAiAfterTradeToggleRef.current = true;
    setSelectedTrades((prev) => {
      const next = prev.includes(tradeName) ? prev.filter((t) => t !== tradeName) : [...prev, tradeName];
      // Keep API in sync with chips. OpenAI is loaded in a second request so the page does not sit on
      // "Loading dashboard..." for a full model round-trip on every chip click.
      setAppliedTrades(next);
      setLoading(true);
      setRefreshTick((n) => n + 1);
      return next;
    });
  };
  const onGenerateReport = () => {
    bypassCacheOnce.current = true;
    setLoading(true);
    setAppliedMonth(month);
    setAppliedTrades(selectedTrades);
    setAppliedWorkforceTotal(workforceTotal);
    setAppliedHoursWorked(hoursWorked);
    setAppliedWorkSevenDaysPerWeek(workSevenDaysPerWeek);
    setAppliedHoursPerDaySchedule(hoursPerDaySchedule);
    setAppliedStateCode(stateCode);
    setReportRun((n) => n + 1);
  };

  const onRefreshFromServer = () => {
    bypassCacheOnce.current = true;
    setLoading(true);
    setRefreshTick((n) => n + 1);
  };
  const displayTrades = useMemo(() => {
    const source = data?.tradeForecasts ?? [];
    if (appliedTrades.length > 0) {
      const selected = appliedTrades
        .map((name) => source.find((t) => t.trade.toLowerCase().includes(name.toLowerCase())))
        .filter(Boolean) as InjuryWeatherDashboardData["tradeForecasts"];
      if (selected.length > 0) return selected.slice(0, 4);
      const matched = source.filter((t) =>
        appliedTrades.some((a) => t.trade.toLowerCase().includes(a.toLowerCase()))
      );
      if (matched.length > 0) return matched.slice(0, 4);
      return source.slice(0, 4);
    }
    const exact = ["Roofing", "Electrical", "Concrete", "Steel Work"];
    const picked = exact
      .map((name) => source.find((t) => t.trade.toLowerCase() === name.toLowerCase()))
      .filter(Boolean) as InjuryWeatherDashboardData["tradeForecasts"];
    if (picked.length === 4) return picked;
    const fallback = source.slice(0, 4);
    return fallback.length > 0 ? fallback : source;
  }, [data, appliedTrades]);

  const priorityThemesRows = useMemo(() => {
    if (!data) return [];
    if (aiInsights?.priorityThemes?.length === 3) return aiInsights.priorityThemes;
    return fallbackDashboardBlocksFromData(data).priorityThemes;
  }, [data, aiInsights]);

  const exportReportJson = () => {
    if (!data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      fieldReviewedAgainstReality: fieldAttestation,
      filters: {
        month: appliedMonth,
        trades: appliedTrades,
        state: appliedStateCode,
        workforceTotal: appliedWorkforceTotal,
        hoursWorked: appliedHoursWorked,
        workSevenDaysPerWeek: appliedWorkSevenDaysPerWeek,
        hoursPerDay: appliedHoursPerDaySchedule,
      },
      dashboard: data,
      aiInsights,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `injury-weather-report-${data.summary.month.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-200">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="rounded-3xl border border-red-700 bg-red-950/40 p-6 text-red-200">{error || "No data available."}</div>;
  }

  const provenanceLine = (() => {
    const p = data.signalProvenance;
    const blend = p.blendNormalization;
    const blendNote =
      blend?.kind === "hours" && blend.denominator != null
        ? ` Overall risk blend uses hours worked (${blend.denominator}) as exposure.`
        : blend?.kind === "workforce" && blend.denominator != null
          ? ` Overall risk blend uses workforce (${blend.denominator}) as exposure.`
          : " Overall risk blend uses raw row shares unless you set hours or workforce above.";
    if (p.mode === "live") {
      return `Model inputs for this view: ${p.sorRecords} SOR · ${p.correctiveActions} corrective actions · ${p.incidents} incidents · ${p.recordWindowLabel}.${blendNote}`;
    }
    return `Seed / offline mode: ${p.seedWorkbookRows ?? 0} workbook rows · ${p.recordWindowLabel}.${blendNote}`;
  })();

  return (
    <div className="space-y-5 text-slate-100">
      <section className="overflow-hidden rounded-3xl border border-slate-700/80 bg-[radial-gradient(circle_at_top,_#1f3b75_0%,_#0c1730_42%,_#090f1f_100%)] shadow-2xl">
        <div className="border-b border-slate-500/40 bg-slate-900/25 px-6 py-5 text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-200">Injury Weather System™</p>
          <h1 className="mt-1 text-5xl font-black tracking-tight text-white">Safety Forecast Dashboard</h1>
          <p className="mt-1 text-lg text-slate-300">Predictive Risk Analysis for Your Jobsite</p>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Plan the month ahead—prioritize training, engineering controls, and field focus from your safety signals to help prevent
            injuries and give admins a clear prep list before work ramps up. The forecast uses historical signals to estimate the
            selected period—including future months before they are observed.
          </p>
        </div>
        <div className="grid gap-2 border-b border-slate-600/40 bg-black/20 px-5 py-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-500/40 bg-slate-900/70 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Estimated injury exposure</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Projected case index · next ~30 days</p>
            <p className="mt-1 text-5xl font-black">{data.summary.predictedInjuriesNextMonth}</p>
          </div>
          <div className="rounded-xl border border-slate-500/40 bg-slate-900/70 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Next 30-day incident likelihood</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Index (not a calibrated probability)</p>
            <p className="mt-1 text-5xl font-black text-amber-300">{data.summary.increasedIncidentRiskPercent}%</p>
          </div>
          <div className="rounded-xl border border-slate-500/40 bg-slate-900/70 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Overall risk level</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              From structural score {(data.summary.structuralRiskScore ?? data.summary.overallRiskScore ?? 0).toFixed(1)} ·
              predicted risk {data.summary.predictedRisk.toFixed(2)} · v{data.summary.riskModelVersion ?? "—"} · refreshes daily,
              not real-time
            </p>
            <div className="mt-2">
              <span className={`inline-flex rounded-md border px-4 py-1.5 text-2xl font-black ${riskTone(data.summary.overallRiskLevel)}`}>
                {data.summary.overallRiskLevel}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-sky-100/90">
              <span className="font-semibold text-sky-200/95">Data confidence {data.summary.dataConfidence ?? "—"}</span>
              <span className="text-slate-400"> — </span>
              {riskBandMeaningForDataConfidence(data.summary.dataConfidence ?? "MEDIUM")}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Forecast confidence {(data.summary.forecastConfidenceScore ?? 0.8).toFixed(1)} ·{" "}
              {forecastModeDisplayLabel(data.summary.forecastMode)}
            </p>
          </div>
        </div>
        {(data.summary.forecastMode ?? "live_adjusted") === "baseline_only" ? (
          <div className="border-b border-amber-500/45 bg-amber-950/50 px-5 py-3 text-center text-sm font-medium leading-snug text-amber-100/95">
            No recent safety signals in window — forecast based on historical patterns and selected trades.
          </div>
        ) : null}
        <p className="border-b border-slate-600/40 bg-black/30 px-5 py-2 text-left text-xs leading-relaxed text-slate-400">
          <span className="font-semibold text-slate-300">Leading-indicator model:</span> Present and future risk scores are
          estimated from historical SOR, corrective actions, and incidents when the target month has no or limited signal data in
          the latest snapshot; the
          exposure number blends likelihood with workforce or trend volume; the % index maps structural risk × trade/site climate.
          These are prioritization signals, not validated injury predictions, until compared to your incident history over time. AI
          suggestions support training and controls—they do not change the math instantly.
        </p>
        <div className="grid gap-2 bg-black/25 px-5 py-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm">
            {!data.availableMonths.length ? <option value="">No month data</option> : null}
            {data.availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm"
            aria-label="State or region for weather exposure"
          >
            {US_STATE_OPTIONS.map((s) => (
              <option key={s.code || "national"} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <input value={project} onChange={(e) => setProject(e.target.value)} className="rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm" placeholder="All Projects" />
          <input
            type="number"
            min={1}
            value={workforceTotal}
            onChange={(e) => setWorkforceTotal(e.target.value)}
            className="rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm"
            placeholder="Workforce (optional)"
          />
          <input
            type="number"
            min={1}
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            className="rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm"
            placeholder="Hours worked (optional)"
            title="When set, takes precedence over workforce for normalizing severity and concentration in the overall risk blend"
          />
        </div>
        <div className="grid gap-2 bg-black/25 px-5 py-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={workSevenDaysPerWeek}
              onChange={(e) => setWorkSevenDaysPerWeek(e.target.checked)}
              className="rounded border-slate-500"
            />
            <span>7-day work week (vs typical 5-day)</span>
          </label>
          <input
            type="number"
            min={0.25}
            max={24}
            step={0.25}
            value={hoursPerDaySchedule}
            onChange={(e) => setHoursPerDaySchedule(e.target.value)}
            className="rounded-lg border border-slate-500/50 bg-slate-900/80 px-3 py-2 text-sm"
            placeholder="Hours per day (optional)"
            title="Typical shift length; combined with day count to compare weekly hours to a 40h reference week"
            aria-label="Hours per day for schedule exposure"
          />
        </div>
        {(appliedWorkSevenDaysPerWeek || appliedHoursPerDaySchedule.trim()) && (
          <p className="border-b border-slate-600/40 bg-black/15 px-5 py-2 text-xs text-slate-400">
            Schedule inputs (likelihood): {appliedWorkSevenDaysPerWeek ? "7" : "5"} days/week ×{" "}
            {appliedHoursPerDaySchedule.trim() || "8"} h/day vs a 40h reference week — factor ×
            {data.summary.predictedRiskFactors.scheduleExposureFactor.toFixed(3)} on predicted risk.
          </p>
        )}
        <p className="border-b border-slate-600/40 bg-black/20 px-5 py-2 text-xs text-slate-400">
          Location / weather exposure: <span className="font-semibold text-slate-200">{data.location.displayName}</span>
          {data.location.stateCode ? (
            <>
              {" "}
              · site ×{data.location.weatherRiskMultiplier.toFixed(2)}
              {data.location.tradeWeatherWeight != null ? (
                <> · trade blend ×{data.location.tradeWeatherWeight.toFixed(2)}</>
              ) : null}
              {data.location.combinedWeatherFactor != null ? (
                <> · combined ×{data.location.combinedWeatherFactor.toFixed(2)}</>
              ) : null}{" "}
              — {data.location.impactNote}
            </>
          ) : (
            <>
              {" "}
              {data.location.tradeWeatherWeight != null ? (
                <>trade blend ×{data.location.tradeWeatherWeight.toFixed(2)} · </>
              ) : null}
              {data.location.combinedWeatherFactor != null ? (
                <>combined ×{data.location.combinedWeatherFactor.toFixed(2)} · </>
              ) : null}
              {data.location.impactNote}
            </>
          )}
        </p>
        <div className="space-y-3 border-t border-slate-600/40 bg-black/20 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Trades in your safety data</p>
          <p className="text-[11px] text-slate-500">
            Chips list trade labels that appear in SOR, corrective actions, and incidents for this workspace (plus seed workbook
            trades if loaded). No static trade catalog.
          </p>
          <div className="flex flex-wrap gap-2">
            {trades.map((t) => {
              const selected = selectedTrades.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTrade(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selected
                      ? "border-sky-400/70 bg-sky-500/25 text-sky-100"
                      : "border-slate-500/50 bg-slate-900/70 text-slate-200"
                  }`}
                >
                  {selected ? "✓ " : ""}
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Selected trades: {selectedTrades.length > 0 ? selectedTrades.join(", ") : "All"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={fieldAttestation}
                  onChange={(e) => setFieldAttestation(e.target.checked)}
                  className="rounded border-slate-500"
                />
                Reviewed against field conditions (for export)
              </label>
              <button
                type="button"
                onClick={exportReportJson}
                className="rounded-lg border border-slate-500/60 bg-slate-800/80 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/80"
              >
                Export JSON snapshot
              </button>
              <button
                type="button"
                onClick={onRefreshFromServer}
                className="rounded-lg border border-sky-500/50 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/25"
              >
                Refresh data
              </button>
              <button
                type="button"
                onClick={onGenerateReport}
                className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/30"
              >
                Generate Report
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100/90">
        <p className="font-semibold text-amber-200">Assumptions</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{INJURY_WEATHER_ASSUMPTIONS}</p>
        <p className="mt-2 text-xs text-amber-200/80">{provenanceLine}</p>
      </section>

      {aiInsights ? (
        <section className="rounded-2xl border border-sky-700/40 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-sky-200">AI Safety Advisor</h3>
            <div className="text-right">
              <span className="rounded-full border border-sky-500/50 bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-200">
                Data confidence {aiInsights.confidence}
              </span>
              <p className="mt-1 max-w-xs text-[11px] font-normal leading-snug text-slate-500">
                {riskBandMeaningForDataConfidence(aiInsights.confidence)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-200">{aiInsights.headline}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Likely Injury Drivers</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                {aiInsights.likelyInjuryDrivers.map((d) => (
                  <li key={d} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Priority Actions</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                {aiInsights.priorityActions.map((a) => (
                  <li key={a} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-4">
        {displayTrades.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-600/70 bg-slate-900/80 p-6 text-center text-sm text-slate-400">
            No trade forecast cards for these filters. Choose another month, adjust trades, or click Generate Report to refresh.
          </div>
        ) : (
          displayTrades.map((tf) => (
          <article key={tf.trade} className="rounded-2xl border border-slate-600/70 bg-[linear-gradient(170deg,_#121e36_0%,_#0d1629_100%)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-3xl font-black text-white">{tf.trade}</h2>
            </div>
            <div className="space-y-2">
              {tf.categories.map((c) => (
                <div key={`${tf.trade}-${c.name}`} className={`rounded-xl border p-3 ${categoryTone(c.riskLevel)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">{c.name}</p>
                    <span className="rounded border border-white/30 bg-black/20 px-2 py-0.5 text-sm font-black">{c.predictedCount}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-black">{c.riskLevel}</span>
                    {c.note ? <span className="text-xs text-slate-400">{c.note}</span> : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNumberBreakdownOpen(tf)}
                className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/25"
              >
                Where do these numbers come from?
              </button>
              <button
                type="button"
                onClick={() => setControlsOpen(tf)}
                className="rounded-lg border border-sky-500/50 bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-500/30"
              >
                View Controls
              </button>
            </div>
            {tf.footerNote ? <p className="mt-2 text-xs text-slate-300">{tf.footerNote}</p> : null}
          </article>
        ))
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-600/70 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold">Priority themes</h3>
            <p className="mt-1 text-xs text-slate-500">
              {aiInsights?.priorityThemes?.length === 3
                ? "Defined by the AI Safety Advisor from structured signals—not verified open items or CAPA due dates. Confirm against your SOR, CAPA, and incident system."
                : "Built from your top trade/category signals (deterministic). Not verified open items or CAPA due dates—confirm in your safety system."}
            </p>
            <div className="mt-3 space-y-2">
              {priorityThemesRows.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${riskTone(item.severity)}`}>
                      {item.severity}
                    </span>
                  </div>
                  {item.dueLabel ? <p className="mt-1 text-xs text-slate-400">{item.dueLabel}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-600/70 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold">Training To Implement ({data.summary.month})</h3>
            <p className="mt-1 text-xs text-slate-500">
              {aiInsights ? "AI-generated from current trade and category emphasis." : "Deterministic suggestions from signal mix."}
            </p>
            <ul className="mt-3 space-y-2">
              {(aiInsights?.monthlyTrainingRecommendations?.length
                ? aiInsights.monthlyTrainingRecommendations
                : data.monthlyTrainingRecommendations
              ).map((t) => (
                <li key={t} className="rounded-xl border border-indigo-600/40 bg-indigo-950/25 px-3 py-2 text-sm text-indigo-100">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-600/70 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold">Recommended Controls / Actions</h3>
            <p className="mt-1 text-xs text-slate-500">
              {aiInsights
                ? "AI-authored playbook lines—tie to trades/categories above and your site program; not audit findings."
                : "Playbook-style suggestions from the engine; tie to trades above—not an audit finding list."}
            </p>
            <ul className="mt-3 space-y-2">
              {(aiInsights?.recommendedControls?.length ? aiInsights.recommendedControls : data.recommendedControls).map((c) => (
                <li key={c} className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-600/70 bg-slate-900/80 p-5">
          <h3 className="text-lg font-bold">Risk Trend Analysis</h3>
          <p className="text-xs text-slate-400">Projected next months based on trend momentum (not historical replay).</p>
          <div className="mt-3">
            <TrendChart points={data.trend} />
          </div>
        </div>
      </section>

      <div className="space-y-5 border-t border-slate-700/60 pt-6">
        <InjuryRiskTreePanel />
        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Monthly Forecast Update</p>
              <p className="mt-1 text-sm text-slate-300">
                Updated for {data.summary.month}. Estimated exposure (projected case index, next ~30 days):
              </p>
            </div>
            <p className="text-3xl font-black text-rose-300">{data.summary.predictedInjuriesNextMonth}</p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Last updated: {new Date(data.summary.lastUpdatedAt).toLocaleString()}
          </p>
        </section>
        <LeadingIndicatorsPanel data={data} />
      </div>

      {numberBreakdownOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="number-breakdown-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setNumberBreakdownOpen(null)}
            aria-label="Close number breakdown"
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-700/50 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">Number breakdown</p>
                <h2 id="number-breakdown-title" className="mt-1 text-2xl font-black text-white">
                  {numberBreakdownOpen.trade}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNumberBreakdownOpen(null)}
                className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            {numberBreakdownOpen.forecastProvenance === "demo" ? (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
                <p>
                  The category values you see here—for example <strong className="text-slate-100">58</strong>,{" "}
                  <strong className="text-slate-100">27</strong>, and <strong className="text-slate-100">12</strong> on the Roofing
                  illustration—are <strong className="text-amber-200/90">static demo numbers</strong> from the dashboard layout. They
                  appear when there are no matching safety signals for the current filters, or when the app is using offline/seed
                  data.
                </p>
                <p className="text-xs text-slate-500">
                  Generate a report with real month/trade filters (and database access) to replace these with counts derived from your SOR,
                  corrective actions, and incidents.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p className="leading-relaxed">
                  The <strong className="text-slate-100">large numbers on each card</strong> are an{" "}
                  <strong>allocated case-style index</strong>: the headline projected case estimate (
                  <strong className="text-slate-100">{data.summary.predictedInjuriesNextMonth}</strong>) is split across trades using your
                  signal mix and trade weather weights, then split across hazard categories by how many raw SOR/action/incident rows fell in each
                  category.
                </p>
                {numberBreakdownOpen.tradeCaseAllocation != null ? (
                  <p className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                    This trade’s share of that estimate before category split:{" "}
                    <strong className="text-slate-200">{numberBreakdownOpen.tradeCaseAllocation}</strong> (rounded).
                  </p>
                ) : null}
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full min-w-[320px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="px-2 py-2 font-semibold">Category</th>
                        <th className="px-2 py-2 font-semibold">Raw hits</th>
                        <th className="px-2 py-2 font-semibold">% of trade (top cats)</th>
                        <th className="px-2 py-2 font-semibold">Display #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {numberBreakdownOpen.categories.map((c) => (
                        <tr key={`bd-${c.name}`} className="border-b border-slate-800 text-slate-200">
                          <td className="px-2 py-2">{c.name}</td>
                          <td className="px-2 py-2 font-mono">{c.sourceObservationCount ?? "—"}</td>
                          <td className="px-2 py-2 font-mono">
                            {c.shareOfTradeTopCategoriesPct != null ? `${c.shareOfTradeTopCategoriesPct}%` : "—"}
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-amber-200/90">{c.predictedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  <strong>Raw hits</strong> = rows in your SOR, corrective actions, and incidents for this trade + category in the
                  record window shown in provenance. <strong>Display #</strong> = that allocation (not the same as raw hit count).
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {controlsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trade-controls-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setControlsOpen(null)}
            aria-label="Close controls panel"
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Trade controls</p>
                <h2 id="trade-controls-title" className="mt-1 text-2xl font-black text-white">
                  {controlsOpen.trade}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  For {data.summary.month}. Use these items on site and in your safety program.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setControlsOpen(null)}
                className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {controlsOpen.categories.map((c) => (
                <div key={`modal-${controlsOpen.trade}-${c.name}`} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-100">{c.name}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${riskTone(c.riskLevel)}`}>
                      {c.riskLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Forecast weight: {c.predictedCount} (relative to this trade)
                  </p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-200">
                    {controlsForCategory(controlsOpen.trade, c.name, c.riskLevel).map((line, idx) => (
                      <li key={`${c.name}-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {controlsOpen.footerNote ? (
              <p className="mt-4 border-t border-slate-700 pt-3 text-xs text-slate-400">{controlsOpen.footerNote}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
