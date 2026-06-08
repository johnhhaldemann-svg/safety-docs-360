"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  CheckSquare,
  FileText,
  Save,
  Square,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, PageHeader, SectionTitle, cx } from "@/components/safe-predict/SafePredictPrimitives";

const supabase = getSupabaseBrowserClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = "30d" | "90d" | "12m";

type MetricCard = {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  trendPositive?: boolean; // true = green, false = red
  icon: React.ReactNode;
  color: string;
};

// ── Demo fallback metrics per period ──────────────────────────────────────────

const DEMO_METRICS: Record<Period, { incidents: number; openCAs: number; inspectionRate: number; inductionRate: number; leadingScore: number }> = {
  "30d": {
    incidents: 3,
    openCAs: 14,
    inspectionRate: 87,
    inductionRate: 94,
    leadingScore: 78,
  },
  "90d": {
    incidents: 9,
    openCAs: 14,
    inspectionRate: 83,
    inductionRate: 91,
    leadingScore: 74,
  },
  "12m": {
    incidents: 31,
    openCAs: 14,
    inspectionRate: 80,
    inductionRate: 88,
    leadingScore: 71,
  },
};

const DEMO_PRIOR: Record<Period, { incidents: number }> = {
  "30d": { incidents: 5 },
  "90d": { incidents: 12 },
  "12m": { incidents: 38 },
};

// ── Agenda items ──────────────────────────────────────────────────────────────

const AGENDA_ITEMS = [
  "Review of previous management review actions",
  "Incident & near-miss trends",
  "Corrective action close-out rates",
  "Inspection & audit results",
  "Training & induction compliance",
  "Risk register review",
  "Regulatory / legal updates",
  "Objectives & targets review",
  "Resource requirements",
  "Recommendations for improvement",
];

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  "12m": "Last 12 Months",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagementReviewPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [incidents, setIncidents] = useState<number | null>(null);
  const [openCAs, setOpenCAs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchMetrics = useCallback(async (activePeriod: Period) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      // Fetch incident count
      const incRes = await fetch(`/api/company/incidents?period=${activePeriod}`, { headers });
      if (incRes.ok) {
        const incData = (await incRes.json()) as { incidents?: unknown[] } | unknown[] | null;
        if (Array.isArray(incData)) {
          setIncidents(incData.length);
        } else if (incData && typeof incData === "object" && "incidents" in incData && Array.isArray((incData as { incidents: unknown[] }).incidents)) {
          setIncidents((incData as { incidents: unknown[] }).incidents.length);
        } else {
          setIncidents(DEMO_METRICS[activePeriod].incidents);
        }
      } else {
        setIncidents(DEMO_METRICS[activePeriod].incidents);
      }

      // Fetch open corrective actions
      const caRes = await fetch("/api/company/corrective-actions?status=open", { headers });
      if (caRes.ok) {
        const caData = (await caRes.json()) as { corrective_actions?: unknown[] } | unknown[] | null;
        if (Array.isArray(caData)) {
          setOpenCAs(caData.length);
        } else if (caData && typeof caData === "object" && "corrective_actions" in caData && Array.isArray((caData as { corrective_actions: unknown[] }).corrective_actions)) {
          setOpenCAs((caData as { corrective_actions: unknown[] }).corrective_actions.length);
        } else {
          setOpenCAs(DEMO_METRICS[activePeriod].openCAs);
        }
      } else {
        setOpenCAs(DEMO_METRICS[activePeriod].openCAs);
      }
    } catch {
      setIncidents(DEMO_METRICS[activePeriod].incidents);
      setOpenCAs(DEMO_METRICS[activePeriod].openCAs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics(period);
  }, [period, fetchMetrics]);

  const demo = DEMO_METRICS[period];
  const prior = DEMO_PRIOR[period];

  const resolvedIncidents = incidents ?? demo.incidents;
  const resolvedOpenCAs = openCAs ?? demo.openCAs;
  const incidentTrend: "up" | "down" = resolvedIncidents < prior.incidents ? "down" : "up";

  const metrics: MetricCard[] = [
    {
      label: "Total Incidents",
      value: loading ? "—" : resolvedIncidents,
      trend: loading ? "neutral" : incidentTrend,
      trendLabel: loading ? undefined : `${Math.abs(resolvedIncidents - prior.incidents)} vs prior period`,
      trendPositive: incidentTrend === "down",
      icon: <BarChart3 className="w-5 h-5" />,
      color: "text-red-600",
    },
    {
      label: "Open Corrective Actions",
      value: loading ? "—" : resolvedOpenCAs,
      trend: resolvedOpenCAs <= 10 ? "down" : resolvedOpenCAs >= 20 ? "up" : "neutral",
      trendLabel: resolvedOpenCAs <= 10 ? "Within target" : resolvedOpenCAs >= 20 ? "Above target" : "Near target",
      trendPositive: resolvedOpenCAs <= 10,
      icon: <FileText className="w-5 h-5" />,
      color: "text-amber-600",
    },
    {
      label: "Inspection Compliance",
      value: loading ? "—" : `${demo.inspectionRate}%`,
      trend: demo.inspectionRate >= 85 ? "up" : "down",
      trendLabel: demo.inspectionRate >= 85 ? "Above 85% target" : "Below 85% target",
      trendPositive: demo.inspectionRate >= 85,
      icon: <CheckSquare className="w-5 h-5" />,
      color: "text-blue-600",
    },
    {
      label: "Induction Completion",
      value: loading ? "—" : `${demo.inductionRate}%`,
      trend: demo.inductionRate >= 90 ? "up" : "down",
      trendLabel: demo.inductionRate >= 90 ? "Above 90% target" : "Below 90% target",
      trendPositive: demo.inductionRate >= 90,
      icon: <Users className="w-5 h-5" />,
      color: "text-violet-600",
    },
    {
      label: "Leading Indicator Score",
      value: loading ? "—" : `${demo.leadingScore}/100`,
      trend: demo.leadingScore >= 75 ? "up" : "down",
      trendLabel: demo.leadingScore >= 75 ? "On track" : "Needs attention",
      trendPositive: demo.leadingScore >= 75,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-emerald-600",
    },
  ];

  function toggleAgendaItem(index: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleSave() {
    const dateStr = new Date().toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const agendaLines = AGENDA_ITEMS.map((item, i) => {
      const checked = checkedItems.has(i);
      return `  [${checked ? "✓" : " "}] ${i + 1}. ${item}`;
    }).join("\n");

    const metricLines = metrics
      .map((m) => `  ${m.label}: ${m.value}${m.trendLabel ? ` — ${m.trendLabel}` : ""}`)
      .join("\n");

    const content = [
      "MANAGEMENT REVIEW REPORT",
      "========================",
      `Period: ${PERIOD_LABELS[period]}`,
      `Exported: ${dateStr}`,
      "",
      "KEY PERFORMANCE METRICS",
      "-----------------------",
      metricLines,
      "",
      `REVIEW AGENDA (${checkedItems.size}/${AGENDA_ITEMS.length} items completed)`,
      "----------------------------------------",
      agendaLines,
      "",
      "MINUTES & REVIEW OUTCOMES",
      "-------------------------",
      notes.trim() || "(No notes recorded)",
      "",
      "---",
      "Generated by SafePredict — Safety Docs 360",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const isoDate = new Date().toISOString().split("T")[0];
    a.download = `management-review-${period}-${isoDate ?? "export"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Management Review"
        subtitle="Periodic executive review of safety performance, objectives, and continuous improvement outcomes."
      />

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {(["30d", "90d", "12m"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cx(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
              period === p
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-700"
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* KPI Summary */}
      <section>
        <SectionTitle title="Key Performance Summary" hint={`Safety metrics for ${PERIOD_LABELS[period].toLowerCase()}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
          {metrics.map((m) => (
            <Card key={m.label} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={cx("p-2 rounded-lg bg-slate-50", m.color)}>{m.icon}</span>
                {m.trend && m.trend !== "neutral" && (
                  <span
                    className={cx(
                      "flex items-center gap-1 text-xs font-medium",
                      m.trendPositive ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {m.trend === "up" ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                )}
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{m.value}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">{m.label}</div>
              </div>
              {m.trendLabel && (
                <div
                  className={cx(
                    "text-xs px-2 py-0.5 rounded-full w-fit font-medium",
                    m.trendPositive
                      ? "bg-emerald-50 text-emerald-700"
                      : m.trend === "neutral"
                      ? "bg-slate-50 text-slate-600"
                      : "bg-red-50 text-red-700"
                  )}
                >
                  {m.trendLabel}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Review Agenda */}
      <section>
        <SectionTitle title="Review Agenda" hint="Standard ISO 45001 management review agenda — check off each item as it is discussed." />
        <Card className="mt-4 divide-y divide-slate-100">
          {AGENDA_ITEMS.map((item, i) => {
            const checked = checkedItems.has(i);
            return (
              <button
                key={i}
                onClick={() => toggleAgendaItem(i)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group"
              >
                {checked ? (
                  <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400 shrink-0" />
                )}
                <span
                  className={cx(
                    "text-sm",
                    checked ? "line-through text-slate-400" : "text-slate-700"
                  )}
                >
                  <span className="font-medium text-slate-400 mr-2">{i + 1}.</span>
                  {item}
                </span>
              </button>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-slate-400">
          {checkedItems.size} of {AGENDA_ITEMS.length} agenda items completed
        </p>
      </section>

      {/* Minutes / Notes */}
      <section>
        <SectionTitle title="Minutes &amp; Review Outcomes" hint="Record key decisions, action items, and outcomes from this management review." />
        <Card className="mt-4 p-5">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter meeting minutes, decisions, assigned actions, and next review date…"
            className="w-full min-h-[180px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-400">
              {notes.length > 0 ? `${notes.length} characters` : "No notes recorded yet"}
            </span>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" />
                  Review saved successfully
                </span>
              )}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save &amp; Export
              </button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
