"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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

/** Risk index bands aligned with engine stress display (approximate). */
function strokeForRiskIndex(v: number): string {
  if (v >= 66) return "rgb(248 113 113)";
  if (v >= 46) return "rgb(251 146 60)";
  if (v >= 26) return "rgb(250 204 21)";
  return "rgb(52 211 153)";
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const chartUid = useId().replace(/:/g, "");
  const w = 760;
  const h = 268;
  const padL = 48;
  const padR = 20;
  const padT = 28;
  const padB = 44;

  const layout = useMemo(() => {
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    if (points.length === 0) {
      return {
        coords: [] as { x: number; y: number; month: string; value: number; highRisk?: boolean }[],
        yMin: 0,
        yMax: 100,
        yTicks: [0, 25, 50, 75, 100],
        chartW,
        chartH,
      };
    }
    const vals = points.map((p) => p.value);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const spread = rawMax - rawMin;
    const padY = Math.max(spread * 0.18, 6, rawMax * 0.06);
    let yMin = Math.max(0, Math.floor(rawMin - padY));
    let yMax = Math.ceil(rawMax + padY);
    if (yMax - yMin < 16) {
      const mid = (yMin + yMax) / 2;
      yMin = Math.max(0, Math.floor(mid - 8));
      yMax = Math.ceil(mid + 8);
    }
    const span = yMax - yMin || 1;
    const tickCount = 5;
    const step = span / (tickCount - 1);
    const yTicks: number[] = [];
    for (let i = 0; i < tickCount; i += 1) {
      yTicks.push(Math.round(yMin + step * i));
    }
    const coords = points.map((p, i) => {
      const x = padL + (i / Math.max(1, points.length - 1)) * chartW;
      const y = padT + chartH - ((p.value - yMin) / span) * chartH;
      return { x, y, month: p.month, value: p.value, highRisk: p.highRisk };
    });
    return { coords, yMin, yMax, yTicks, chartW, chartH };
  }, [points]);

  const { coords, yMin, yMax, yTicks, chartW, chartH } = layout;
  const span = yMax - yMin || 1;

  const areaPath =
    coords.length > 0
      ? `M ${coords[0].x},${padT + chartH} L ${coords.map((c) => `${c.x},${c.y}`).join(" L ")} L ${coords[coords.length - 1].x},${padT + chartH} Z`
      : "";

  const linePath = coords.length > 0 ? `M ${coords.map((c) => `${c.x},${c.y}`).join(" L ")}` : "";

  const onLeave = useCallback(() => setHover(null), []);

  if (points.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/40 text-sm text-slate-500">
        No trend points for this view.
      </div>
    );
  }

  const hi = hover != null ? coords[hover] : null;

  return (
    <div className="relative" onMouseLeave={onLeave}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[min(20rem,55vw)] w-full max-w-full"
        role="img"
        aria-label="Risk trend line chart: relative signal index over months"
      >
        <defs>
          <linearGradient id={`iwTrendArea-${chartUid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(248 113 113)" stopOpacity="0.35" />
            <stop offset="55%" stopColor="rgb(99 102 241)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(15 23 42)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`iwTrendLine-${chartUid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(52 211 153)" />
            <stop offset="35%" stopColor="rgb(250 204 21)" />
            <stop offset="70%" stopColor="rgb(251 146 60)" />
            <stop offset="100%" stopColor="rgb(248 113 113)" />
          </linearGradient>
          <filter id={`iwTrendGlow-${chartUid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <text x={padL} y={16} className="fill-slate-500" style={{ fontSize: "11px" }}>
          Relative index
        </text>

        {yTicks.map((tick, ti) => {
          const y = padT + chartH - ((tick - yMin) / span) * chartH;
          return (
            <g key={`y-${ti}-${tick}`}>
              <line
                x1={padL}
                y1={y}
                x2={padL + chartW}
                y2={y}
                stroke="rgb(51 65 85)"
                strokeOpacity={0.55}
                strokeWidth={1}
                strokeDasharray="4 6"
              />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-500" style={{ fontSize: "10px" }}>
                {tick}
              </text>
            </g>
          );
        })}

        <rect
          x={padL}
          y={padT}
          width={chartW}
          height={chartH}
          fill="transparent"
          className="pointer-events-none"
        />

        {areaPath ? <path d={areaPath} fill={`url(#iwTrendArea-${chartUid})`} /> : null}

        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={`url(#iwTrendLine-${chartUid})`}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#iwTrendGlow-${chartUid})`}
          />
        ) : null}

        {coords.map((c, i) => {
          const stroke = c.highRisk ? "rgb(239 68 68)" : strokeForRiskIndex(c.value);
          return (
            <g key={`${c.month}-${i}`}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hover === i ? 9 : 6}
                fill="rgb(15 23 42)"
                stroke={stroke}
                strokeWidth={hover === i ? 3 : 2}
                className="cursor-crosshair"
                onMouseEnter={() => setHover(i)}
              />
              <text
                x={c.x}
                y={h - 12}
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: "10px" }}
              >
                {c.month}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        className={`mt-2 rounded-lg border px-3 py-2 text-center text-xs transition-colors ${
          hi ? "border-sky-500/30 bg-slate-950/90 text-slate-200" : "border-transparent bg-transparent text-slate-600"
        }`}
      >
        {hi ? (
          <>
            <span className="font-semibold text-white">{hi.month}</span>
            {" · "}
            Index <span className="font-mono text-sky-300">{hi.value}</span>
            {hi.highRisk ? <span className="text-rose-300"> · Elevated band</span> : null}
          </>
        ) : (
          "Hover a point for month and index"
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400" />
          Trajectory (momentum-weighted)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 border-rose-400 bg-slate-900" />
          Elevated month flag
        </span>
      </div>
    </div>
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
  /** When primary fetch uses `refresh=1`, AI follow-up must too or cached AI can lag fresh data. */
  const refreshAiFollowUpRef = useRef(false);
  /** Drop stale background AI responses when the user changes filters again. */
  const dashboardFetchSeqRef = useRef(0);
  const [project, setProject] = useState("All Projects");
  const [data, setData] = useState<InjuryWeatherDashboardData | null>(null);
  const [error, setError] = useState("");
  const [aiInsights, setAiInsights] = useState<InjuryWeatherAiInsights | null>(null);
  const [aiAdvisorLoading, setAiAdvisorLoading] = useState(false);
  const [controlsOpen, setControlsOpen] = useState<TradeForecast | null>(null);
  const [numberBreakdownOpen, setNumberBreakdownOpen] = useState<TradeForecast | null>(null);
  const [fieldAttestation, setFieldAttestation] = useState(false);

  const [scopeCompanies, setScopeCompanies] = useState<{ id: string; name: string | null }[]>([]);
  const [scopeJobsites, setScopeJobsites] = useState<{ id: string; name: string | null }[]>([]);
  const [scopeCompanyId, setScopeCompanyId] = useState("");
  const [scopeJobsiteId, setScopeJobsiteId] = useState("");
  const [appliedScopeCompanyId, setAppliedScopeCompanyId] = useState("");
  const [appliedScopeJobsiteId, setAppliedScopeJobsiteId] = useState("");

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

        const buildQs = (includeAi: boolean, options?: { forceRefresh?: boolean }) => {
          const qs = new URLSearchParams();
          if (appliedMonth) qs.set("month", appliedMonth);
          if (appliedTrades.length > 0) qs.set("trades", appliedTrades.join(","));
          if (appliedWorkforceTotal.trim()) qs.set("workforceTotal", appliedWorkforceTotal.trim());
          if (appliedHoursWorked.trim()) qs.set("hoursWorked", appliedHoursWorked.trim());
          if (appliedWorkSevenDaysPerWeek) qs.set("workSevenDaysPerWeek", "1");
          if (appliedHoursPerDaySchedule.trim()) qs.set("hoursPerDay", appliedHoursPerDaySchedule.trim());
          if (appliedStateCode.trim()) qs.set("state", appliedStateCode.trim());
          if (appliedScopeCompanyId.trim()) qs.set("companyId", appliedScopeCompanyId.trim());
          if (appliedScopeCompanyId.trim() && appliedScopeJobsiteId.trim()) {
            qs.set("jobsiteId", appliedScopeJobsiteId.trim());
          }
          qs.set("includeAi", includeAi ? "true" : "false");
          if (options?.forceRefresh) {
            qs.set("refresh", "1");
          } else if (bypassCacheOnce.current) {
            qs.set("refresh", "1");
            bypassCacheOnce.current = false;
          }
          return qs;
        };

        // Primary fetch never waits on OpenAI — render numbers/charts first, then load AI in the background.
        refreshAiFollowUpRef.current = bypassCacheOnce.current;
        const res = await fetch(`/api/superadmin/injury-weather?${buildQs(false).toString()}`, {
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
          refreshAiFollowUpRef.current = false;
        } else {
          const typed = payload as InjuryWeatherDashboardData & { aiInsights?: InjuryWeatherAiInsights };
          setData(typed);
          setAiInsights(null);
          setAiAdvisorLoading(true);
          if (!month) {
            const months = typed.availableMonths;
            const latest = months.length > 0 ? months[months.length - 1] : typed.summary.month;
            setMonth(latest);
            setAppliedMonth(latest);
          } else if (!appliedMonth) setAppliedMonth(month);

          const qsAi = buildQs(true, { forceRefresh: refreshAiFollowUpRef.current });
          refreshAiFollowUpRef.current = false;
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
            } finally {
              if (fetchSeq === dashboardFetchSeqRef.current) setAiAdvisorLoading(false);
            }
          })();
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
    appliedScopeCompanyId,
    appliedScopeJobsiteId,
    month,
    reportRun,
    refreshTick,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const meRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        const meData = (await meRes.json().catch(() => null)) as { user?: { role?: string } } | null;
        if (!meRes.ok || String(meData?.user?.role ?? "").toLowerCase() !== "super_admin") return;
        const r = await fetch("/api/superadmin/injury-weather/scope", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = (await r.json().catch(() => null)) as { companies?: { id: string; name: string | null }[] } | null;
        if (r.ok && j?.companies) setScopeCompanies(j.companies);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (!scopeCompanyId.trim()) {
        setScopeJobsites([]);
        return;
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const r = await fetch(
          `/api/superadmin/injury-weather/scope?companyId=${encodeURIComponent(scopeCompanyId.trim())}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        const j = (await r.json().catch(() => null)) as { jobsites?: { id: string; name: string | null }[] } | null;
        if (r.ok && j?.jobsites) setScopeJobsites(j.jobsites);
        else setScopeJobsites([]);
      } catch {
        setScopeJobsites([]);
      }
    })();
  }, [scopeCompanyId]);

  const trades = useMemo(
    () => (data?.availableTrades?.length ? data.availableTrades : data?.tradeForecasts.map((t) => t.trade) ?? []),
    [data]
  );
  const toggleTrade = (tradeName: string) => {
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
  const allTradesSelected =
    trades.length > 0 && trades.every((t) => selectedTrades.includes(t));
  const selectAllTrades = () => {
    const next = [...trades];
    setSelectedTrades(next);
    setAppliedTrades(next);
    setLoading(true);
    setRefreshTick((n) => n + 1);
  };
  const clearTradeSelection = () => {
    setSelectedTrades([]);
    setAppliedTrades([]);
    setLoading(true);
    setRefreshTick((n) => n + 1);
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
    setAppliedScopeCompanyId(scopeCompanyId.trim());
    setAppliedScopeJobsiteId(scopeJobsiteId.trim());
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
      return [];
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
        companyId: appliedScopeCompanyId || null,
        jobsiteId: appliedScopeJobsiteId || null,
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
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
            Outputs below reflect your current scope—adjust filters at the bottom to regenerate.
          </p>
        </div>
        <div className="grid gap-2 border-b border-slate-600/40 bg-black/20 px-5 py-3 sm:grid-cols-2 lg:grid-cols-3">
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
      </section>

      {aiInsights || aiAdvisorLoading ? (
        <section className="rounded-2xl border border-sky-700/40 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-sky-200">AI Safety Advisor</h3>
            {aiInsights ? (
              <div className="text-right">
                <span className="rounded-full border border-sky-500/50 bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-200">
                  Data confidence {aiInsights.confidence}
                </span>
                <p className="mt-1 max-w-xs text-[11px] font-normal leading-snug text-slate-500">
                  {riskBandMeaningForDataConfidence(aiInsights.confidence)}
                </p>
              </div>
            ) : null}
          </div>
          {aiAdvisorLoading && !aiInsights ? (
            <p className="mt-3 text-sm text-slate-400">
              Generating insights… structured metrics and trade cards above are already loaded.
            </p>
          ) : null}
          {aiInsights ? (
            <>
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
            </>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-4">
        {displayTrades.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-600/70 bg-slate-900/80 p-6 text-center text-sm text-slate-400">
            {appliedTrades.length > 0
              ? `No forecast cards for the selected trade(s) (${appliedTrades.join(", ")})—there are no matching safety signals in the current window. Clear trade filters to see the top trades by signal volume, or generate data for those crafts.`
              : "No trade forecast cards for these filters. Choose another month, adjust trades, or click Generate Report to refresh."}
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
        <div className="rounded-2xl border border-slate-600/70 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-5 shadow-inner">
          <h3 className="text-lg font-bold text-white">Risk Trend Analysis</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Relative signal-strength index over recent months, extended with momentum (not a replay of raw history). Higher values
            reflect more weighted safety activity in-window—compare to your incident program separately.
          </p>
          <div className="mt-4">
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

      <section className="rounded-2xl border border-amber-900/45 bg-amber-950/15 p-5 text-sm text-amber-100/90">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">Model assumptions</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/85">{INJURY_WEATHER_ASSUMPTIONS}</p>
        <p className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">{provenanceLine}</p>
      </section>

      <section className="rounded-2xl border border-slate-600/80 bg-slate-950/80 p-6 shadow-xl">
        <div className="flex flex-col gap-2 border-b border-slate-700/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Forecast parameters</p>
            <h2 className="mt-1 text-xl font-bold text-white">Scope &amp; inputs</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Change filters below, then <span className="text-emerald-300/90">Generate Report</span> to refresh the outputs above.
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Applied:</span> {appliedMonth || "—"}
            {appliedStateCode ? (
              <>
                {" "}
                · {US_STATE_OPTIONS.find((s) => s.code === appliedStateCode)?.name ?? appliedStateCode}
              </>
            ) : (
              <> · National</>
            )}
            {" · "}
            Trades: {appliedTrades.length > 0 ? appliedTrades.join(", ") : "All"}
            {appliedScopeCompanyId ? (
              <>
                {" "}
                · Company{" "}
                <span className="font-mono text-slate-200">
                  {scopeCompanies.find((c) => c.id === appliedScopeCompanyId)?.name ?? appliedScopeCompanyId.slice(0, 8)}
                </span>
                {appliedScopeJobsiteId ? (
                  <>
                    {" "}
                    · Jobsite{" "}
                    <span className="font-mono text-slate-200">
                      {appliedScopeCompanyId === scopeCompanyId.trim()
                        ? scopeJobsites.find((j) => j.id === appliedScopeJobsiteId)?.name ??
                          `${appliedScopeJobsiteId.slice(0, 8)}…`
                        : `${appliedScopeJobsiteId.slice(0, 8)}…`}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <> · Signals: platform-wide</>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4 rounded-xl border border-violet-500/35 bg-violet-950/15 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/90">Data scope</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Limit SOR, corrective actions, and incidents to one company. With a jobsite selected, incidents and corrective
              actions match that jobsite; SOR rows stay company-wide. Forecasts use this operational data only—record injuries
              through your normal incident workflow. Click <span className="text-emerald-300">Generate Report</span> to apply.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                <span className="font-medium text-slate-400">Company</span>
                <select
                  value={scopeCompanyId}
                  onChange={(e) => {
                    setScopeCompanyId(e.target.value);
                    setScopeJobsiteId("");
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
                >
                  <option value="">All companies (platform)</option>
                  {scopeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                <span className="font-medium text-slate-400">Jobsite (optional)</span>
                <select
                  value={scopeJobsiteId}
                  onChange={(e) => setScopeJobsiteId(e.target.value)}
                  disabled={!scopeCompanyId.trim()}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 disabled:opacity-50"
                >
                  <option value="">All jobsites for company</option>
                  {scopeJobsites.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name || j.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
            >
              {!data.availableMonths.length ? <option value="">No month data</option> : null}
              {data.availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Location (weather)</span>
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              aria-label="State or region for weather exposure"
            >
              {US_STATE_OPTIONS.map((s) => (
                <option key={s.code || "national"} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Project label</span>
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              placeholder="All Projects"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Workforce (optional)</span>
            <input
              type="number"
              min={1}
              value={workforceTotal}
              onChange={(e) => setWorkforceTotal(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              placeholder="e.g. 100"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Hours worked (optional)</span>
            <input
              type="number"
              min={1}
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              placeholder="Overrides workforce for blend"
              title="When set, takes precedence over workforce for normalizing severity and concentration in the overall risk blend"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={workSevenDaysPerWeek}
              onChange={(e) => setWorkSevenDaysPerWeek(e.target.checked)}
              className="rounded border-slate-500"
            />
            <span>7-day work week (vs typical 5-day)</span>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
            <span className="font-medium text-slate-400">Hours per day (optional)</span>
            <input
              type="number"
              min={0.25}
              max={24}
              step={0.25}
              value={hoursPerDaySchedule}
              onChange={(e) => setHoursPerDaySchedule(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
              placeholder="Shift length"
              title="Typical shift length; combined with day count to compare weekly hours to a 40h reference week"
              aria-label="Hours per day for schedule exposure"
            />
          </label>
        </div>

        {(appliedWorkSevenDaysPerWeek || appliedHoursPerDaySchedule.trim()) && (
          <p className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
            Schedule (likelihood path): {appliedWorkSevenDaysPerWeek ? "7" : "5"} days/week ×{" "}
            {appliedHoursPerDaySchedule.trim() || "8"} h/day vs 40h reference — factor ×
            {data.summary.predictedRiskFactors.scheduleExposureFactor.toFixed(3)} on predicted risk.
          </p>
        )}

        <p className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Weather exposure</span>
          {": "}
          <span className="text-slate-200">{data.location.displayName}</span>
          {data.location.stateCode ? (
            <>
              {" "}
              · site ×{data.location.weatherRiskMultiplier.toFixed(2)}
              {data.location.tradeWeatherWeight != null ? <> · trade blend ×{data.location.tradeWeatherWeight.toFixed(2)}</> : null}
              {data.location.combinedWeatherFactor != null ? <> · combined ×{data.location.combinedWeatherFactor.toFixed(2)}</> : null}
              {" — "}
              {data.location.impactNote}
            </>
          ) : (
            <>
              {" "}
              {data.location.tradeWeatherWeight != null ? <>trade blend ×{data.location.tradeWeatherWeight.toFixed(2)} · </> : null}
              {data.location.combinedWeatherFactor != null ? <>combined ×{data.location.combinedWeatherFactor.toFixed(2)} · </> : null}
              {data.location.impactNote}
            </>
          )}
        </p>

        <div className="mt-8 border-t border-slate-700/80 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Trade &amp; craft filters</h3>
          <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-slate-500">
            Canonical crafts plus labels from your SOR, corrective actions, and incidents. Crafts with no rows yet show empty cards
            until data exists—not the same as NSC{" "}
            <span className="text-slate-400">Industry Profiles</span> (NAICS).
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {data.industryBenchmarkContext.benchmarkSummary}{" "}
            <a
              href={data.industryBenchmarkContext.injuryFactsIndustryProfilesUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline decoration-sky-500/50 hover:text-sky-300"
            >
              Industry Profiles
            </a>
            {" · "}
            <a
              href={data.industryBenchmarkContext.injuryFactsIncidentTrendsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline decoration-sky-500/50 hover:text-sky-300"
            >
              Rate trends
            </a>
          </p>
          {data.industryBenchmarkContext.dominantNaicsPrefix ? (
            <p className="mt-2 text-[11px] text-slate-400">
              NAICS mode (companies with <code className="rounded bg-slate-800 px-1 text-slate-200">industry_code</code>): prefix{" "}
              <span className="font-mono text-slate-200">{data.industryBenchmarkContext.dominantNaicsPrefix}</span>
              {data.industryBenchmarkContext.exampleIndustryCode ? (
                <>
                  {" "}
                  (<span className="font-mono text-slate-300">{data.industryBenchmarkContext.exampleIndustryCode}</span>)
                </>
              ) : null}
              {data.industryBenchmarkContext.recordableCasesPer200kHours != null ? (
                <>
                  {" "}
                  · ≈{data.industryBenchmarkContext.recordableCasesPer200kHours} recordables / 200k hrs (illustrative).
                </>
              ) : null}
            </p>
          ) : null}
          {data.industryBenchmarkContext.oshaNationalConstruction ? (
            <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/55 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                National construction — injury &amp; fatality context (U.S.)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {data.industryBenchmarkContext.oshaNationalConstruction.citation} Compare your signals to these published
                construction totals—not your company’s OSHA file.{" "}
                <a
                  href="https://www.bls.gov/iif/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 underline decoration-sky-500/50 hover:text-sky-300"
                >
                  BLS IIF
                </a>
                .
              </p>
              {(() => {
                const o = data.industryBenchmarkContext.oshaNationalConstruction;
                const n = o.nonfatalDaysAwayFromWork;
                const f = o.fatalitiesInConstruction;
                return (
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-400">
                    <li>
                      <span className="text-slate-300">Nonfatal DAFW</span> ({n.periodLabel}):{" "}
                      <span className="font-mono text-slate-200">{n.constructionCases.toLocaleString()}</span> cases in
                      construction vs{" "}
                      <span className="font-mono text-slate-200">{n.allPrivateIndustryCases.toLocaleString()}</span>{" "}
                      private industry (days away from work).
                      {n.medianDaysAwayConstruction != null ? (
                        <>
                          {" "}
                          Median days away (construction):{" "}
                          <span className="font-mono text-slate-200">{n.medianDaysAwayConstruction}</span>.
                        </>
                      ) : null}
                    </li>
                    <li>
                      <span className="text-slate-300">Fatal injuries (construction)</span>:{" "}
                      <span className="font-mono text-slate-200">{f.year2023.toLocaleString()}</span> in 2023 ·{" "}
                      <span className="font-mono text-slate-200">{f.year2024.toLocaleString()}</span> in 2024.
                    </li>
                    <li>
                      <span className="text-slate-300">Top DAFW mechanisms (construction, counts)</span>:{" "}
                      {o.nonfatalEventHighlights.map((h) => `${h.label}: ${h.constructionCases.toLocaleString()}`).join(" · ")}.
                    </li>
                    <li>
                      <span className="text-slate-300">Top fatal events (construction, 2023)</span>:{" "}
                      {o.fatalEventHighlights2023.map((h) => `${h.label}: ${h.count2023.toLocaleString()}`).join(" · ")}.
                    </li>
                  </ul>
                );
              })()}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {trades.map((t) => {
              const selected = selectedTrades.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTrade(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-sky-400/80 bg-sky-500/20 text-sky-100"
                      : "border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {selected ? "✓ " : ""}
                  {t}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col gap-4 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-xs text-slate-500">
                Selected: <span className="text-slate-300">{selectedTrades.length > 0 ? selectedTrades.join(", ") : "All trades"}</span>
              </p>
              {trades.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllTrades}
                    disabled={allTradesSelected}
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearTradeSelection}
                    disabled={selectedTrades.length === 0}
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={fieldAttestation}
                  onChange={(e) => setFieldAttestation(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Field review (export)
              </label>
              <button
                type="button"
                onClick={exportReportJson}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={onRefreshFromServer}
                className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={onGenerateReport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500"
              >
                Generate Report
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">About the leading-indicator model</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            <span className="font-medium text-slate-300">Leading-indicator model:</span> Present and future risk scores use historical
            SOR, corrective actions, and incidents when the target month has sparse data in the latest snapshot. The exposure index
            blends likelihood with workforce or trend volume; the % headline maps structural risk × trade/site climate. These are
            prioritization signals—not validated injury predictions until compared to your incident history. AI suggestions support
            training and controls; they do not change the core math instantly.
          </p>
        </div>
      </section>

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
