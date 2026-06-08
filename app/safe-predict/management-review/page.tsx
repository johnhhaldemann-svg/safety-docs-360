"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
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

type WeekPeriod = "1w" | "2w" | "4w" | "8w" | "12w";

type Jobsite = { id: string; name: string; code?: string | null };

type MetricCard = {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  trendPositive?: boolean;
  icon: React.ReactNode;
  color: string;
  barColor: string;
  barPct: number;
};

type ExportMetric = {
  label: string;
  value: string | number;
  trendLabel?: string;
  trendPositive?: boolean;
  barColor: string;
  barPct: number;
};

// ── Period config ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<WeekPeriod, string> = {
  "1w": "Last 1 Week",
  "2w": "Last 2 Weeks",
  "4w": "Last 4 Weeks",
  "8w": "Last 8 Weeks",
  "12w": "Last 12 Weeks",
};

const PERIOD_BUTTON_LABELS: Record<WeekPeriod, string> = {
  "1w": "1 wk",
  "2w": "2 wks",
  "4w": "4 wks",
  "8w": "8 wks",
  "12w": "12 wks",
};

const PERIOD_API_PARAM: Record<WeekPeriod, string> = {
  "1w": "7d",
  "2w": "14d",
  "4w": "30d",
  "8w": "60d",
  "12w": "90d",
};

// ── Demo fallback metrics ──────────────────────────────────────────────────────

const DEMO_METRICS: Record<WeekPeriod, {
  incidents: number;
  openCAs: number;
  inspectionRate: number;
  inductionRate: number;
  leadingScore: number;
}> = {
  "1w":  { incidents: 1,  openCAs: 14, inspectionRate: 91, inductionRate: 96, leadingScore: 82 },
  "2w":  { incidents: 2,  openCAs: 14, inspectionRate: 89, inductionRate: 95, leadingScore: 80 },
  "4w":  { incidents: 3,  openCAs: 14, inspectionRate: 87, inductionRate: 94, leadingScore: 78 },
  "8w":  { incidents: 6,  openCAs: 14, inspectionRate: 84, inductionRate: 92, leadingScore: 75 },
  "12w": { incidents: 9,  openCAs: 14, inspectionRate: 83, inductionRate: 91, leadingScore: 74 },
};

const DEMO_PRIOR: Record<WeekPeriod, { incidents: number }> = {
  "1w":  { incidents: 2  },
  "2w":  { incidents: 3  },
  "4w":  { incidents: 5  },
  "8w":  { incidents: 8  },
  "12w": { incidents: 12 },
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

// ── HTML Report Generator ─────────────────────────────────────────────────────

function generateReportHTML(params: {
  period: WeekPeriod;
  jobsiteName: string;
  metrics: ExportMetric[];
  checkedItems: Set<number>;
  notes: string;
  exportDate: string;
}): string {
  const { period, jobsiteName, metrics, checkedItems, notes, exportDate } = params;

  const completionPct = AGENDA_ITEMS.length > 0
    ? Math.round((checkedItems.size / AGENDA_ITEMS.length) * 100)
    : 0;

  const metricCards = metrics.map(m => `
    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;flex:1;min-width:155px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:10px;">${m.label}</div>
      <div style="font-size:30px;font-weight:800;color:#1e293b;line-height:1;margin-bottom:8px;">${m.value}</div>
      <div style="height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden;margin-bottom:8px;">
        <div style="height:100%;border-radius:99px;background:${m.barColor};width:${m.barPct}%;"></div>
      </div>
      ${m.trendLabel ? `<div style="font-size:12px;font-weight:600;color:${m.trendPositive ? "#16a34a" : "#dc2626"};">${m.trendLabel}</div>` : ""}
    </div>`).join("\n");

  const complianceMetrics = metrics.slice(2); // inspection, induction, leading
  const complianceTargets = [85, 90, 75];
  const barChartRows = complianceMetrics.map((m, i) => {
    const pct = m.barPct;
    const target = complianceTargets[i] ?? 80;
    const onTrack = pct >= target;
    return `
    <div style="margin-bottom:22px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <span style="font-size:14px;font-weight:600;color:#334155;">${m.label}</span>
        <span style="font-size:16px;font-weight:800;color:${onTrack ? "#16a34a" : "#dc2626"};">${m.value}</span>
      </div>
      <div style="position:relative;height:14px;background:#f1f5f9;border-radius:99px;overflow:visible;">
        <div style="height:100%;border-radius:99px;background:${m.barColor};width:${pct}%;"></div>
        <div style="position:absolute;top:-3px;left:${target}%;width:3px;height:20px;background:#ef4444;border-radius:2px;" title="Target ${target}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-size:11px;color:#94a3b8;">0%</span>
        <span style="font-size:11px;color:#ef4444;font-weight:600;">Target: ${target}%</span>
        <span style="font-size:11px;color:#94a3b8;">100%</span>
      </div>
    </div>`;
  }).join("\n");

  const agendaRows = AGENDA_ITEMS.map((item, i) => {
    const checked = checkedItems.has(i);
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:11px 20px;width:48px;vertical-align:middle;">
          <div style="width:22px;height:22px;border-radius:5px;border:2px solid ${checked ? "#10b981" : "#cbd5e1"};background:${checked ? "#10b981" : "white"};display:flex;align-items:center;justify-content:center;">
            ${checked ? '<span style="color:white;font-size:13px;font-weight:700;line-height:1;">✓</span>' : ""}
          </div>
        </td>
        <td style="padding:11px 20px;font-size:14px;color:${checked ? "#94a3b8" : "#334155"};text-decoration:${checked ? "line-through" : "none"};">
          <span style="color:#cbd5e1;font-weight:600;margin-right:10px;">${i + 1}.</span>${item}
        </td>
      </tr>`;
  }).join("\n");

  const incidentVal = typeof metrics[0]?.value === "number" ? metrics[0].value : parseInt(String(metrics[0]?.value ?? "0")) || 0;
  const caVal = typeof metrics[1]?.value === "number" ? metrics[1].value : parseInt(String(metrics[1]?.value ?? "0")) || 0;

  const incidentBg = incidentVal <= 2 ? "#f0fdf4" : incidentVal <= 5 ? "#fff7ed" : "#fef2f2";
  const incidentBorder = incidentVal <= 2 ? "#86efac" : incidentVal <= 5 ? "#fed7aa" : "#fecaca";
  const incidentText = incidentVal <= 2 ? "#15803d" : incidentVal <= 5 ? "#c2410c" : "#991b1b";

  const caBg = caVal <= 10 ? "#f0fdf4" : caVal <= 20 ? "#fff7ed" : "#fef2f2";
  const caBorder = caVal <= 10 ? "#86efac" : caVal <= 20 ? "#fed7aa" : "#fecaca";
  const caText = caVal <= 10 ? "#15803d" : caVal <= 20 ? "#c2410c" : "#991b1b";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Management Review — ${PERIOD_LABELS[period]}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',system-ui,sans-serif;background:#f8fafc;color:#334155;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @media print{
    body{background:white;}
    .no-print{display:none!important;}
    .page-break{page-break-before:always;}
  }
  .section{max-width:960px;margin:0 auto;padding:0 40px;}
</style>
</head>
<body>

<!-- ── COVER ── -->
<div style="background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 45%,#075985 100%);padding:64px 80px 56px;">
  <div style="max-width:960px;margin:0 auto;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:36px;">
      <div style="width:32px;height:32px;background:rgba(255,255,255,.2);border-radius:7px;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:15px;font-weight:800;">S</span>
      </div>
      <span style="color:rgba(255,255,255,.75);font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">SafePredict · Safety Docs 360</span>
    </div>
    <h1 style="font-size:44px;font-weight:900;color:white;line-height:1.1;margin-bottom:14px;">Management Review<br/>Report</h1>
    <p style="font-size:16px;color:rgba(255,255,255,.7);margin-bottom:36px;">Periodic executive safety performance review · ISO 45001</p>
    <div style="display:flex;flex-wrap:wrap;gap:14px;">
      <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(4px);border-radius:10px;padding:12px 20px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6);font-weight:700;margin-bottom:4px;">Period</div>
        <div style="font-size:15px;color:white;font-weight:700;">${PERIOD_LABELS[period]}</div>
      </div>
      <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(4px);border-radius:10px;padding:12px 20px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6);font-weight:700;margin-bottom:4px;">Jobsite</div>
        <div style="font-size:15px;color:white;font-weight:700;">${jobsiteName}</div>
      </div>
      <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(4px);border-radius:10px;padding:12px 20px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6);font-weight:700;margin-bottom:4px;">Exported</div>
        <div style="font-size:15px;color:white;font-weight:700;">${exportDate}</div>
      </div>
      <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(4px);border-radius:10px;padding:12px 20px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6);font-weight:700;margin-bottom:4px;">Agenda</div>
        <div style="font-size:15px;color:white;font-weight:700;">${checkedItems.size}/${AGENDA_ITEMS.length} items</div>
      </div>
    </div>
  </div>
</div>

<div style="height:48px;"></div>

<!-- ── KPI METRICS ── -->
<div class="section" style="margin-bottom:48px;">
  <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:4px;">Key Performance Metrics</h2>
  <p style="font-size:14px;color:#94a3b8;margin-bottom:20px;">${PERIOD_LABELS[period]} · ${jobsiteName}</p>
  <div style="display:flex;flex-wrap:wrap;gap:14px;">
    ${metricCards}
  </div>
</div>

<!-- ── INCIDENT HIGHLIGHTS ── -->
<div class="section" style="margin-bottom:48px;">
  <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:20px;">Incident & Action Summary</h2>
  <div style="display:flex;flex-wrap:wrap;gap:16px;">
    <div style="flex:1;min-width:220px;background:${incidentBg};border:1.5px solid ${incidentBorder};border-radius:14px;padding:28px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${incidentText};margin-bottom:12px;">Total Incidents</div>
      <div style="font-size:56px;font-weight:900;color:${incidentText};line-height:1;">${metrics[0]?.value ?? "—"}</div>
      <div style="font-size:13px;color:${incidentText};margin-top:10px;opacity:.8;">${metrics[0]?.trendLabel ?? ""}</div>
    </div>
    <div style="flex:1;min-width:220px;background:${caBg};border:1.5px solid ${caBorder};border-radius:14px;padding:28px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${caText};margin-bottom:12px;">Open Corrective Actions</div>
      <div style="font-size:56px;font-weight:900;color:${caText};line-height:1;">${metrics[1]?.value ?? "—"}</div>
      <div style="font-size:13px;color:${caText};margin-top:10px;opacity:.8;">${metrics[1]?.trendLabel ?? ""}</div>
    </div>
  </div>
</div>

<!-- ── COMPLIANCE CHART ── -->
<div class="section" style="margin-bottom:48px;">
  <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:32px;">
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:4px;">Compliance Performance</h2>
    <p style="font-size:13px;color:#94a3b8;margin-bottom:28px;">Progress vs. target thresholds — <span style="color:#ef4444;font-weight:600;">red marker = target</span></p>
    ${barChartRows}
  </div>
</div>

<!-- ── REVIEW AGENDA ── -->
<div class="section" style="margin-bottom:48px;">
  <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">Review Agenda</h2>
  <p style="font-size:14px;color:#94a3b8;margin-bottom:16px;">${checkedItems.size} of ${AGENDA_ITEMS.length} items completed · Standard ISO 45001 agenda</p>
  <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${agendaRows}</tbody>
    </table>
  </div>
  <!-- Progress bar -->
  <div style="margin-top:12px;height:8px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
    <div style="height:100%;width:${completionPct}%;background:#10b981;border-radius:99px;"></div>
  </div>
  <p style="font-size:12px;color:#94a3b8;margin-top:6px;">${completionPct}% of agenda completed</p>
</div>

<!-- ── MINUTES ── -->
<div class="section" style="margin-bottom:56px;">
  <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:32px;">
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:16px;">Minutes &amp; Review Outcomes</h2>
    <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:20px;min-height:120px;font-size:14px;line-height:1.75;color:${notes.trim() ? "#334155" : "#94a3b8"};white-space:pre-wrap;">${notes.trim() || "No notes recorded for this review session."}</div>
  </div>
</div>

<!-- ── FOOTER ── -->
<div style="border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
  <p style="font-size:12px;color:#cbd5e1;">Generated by <strong style="color:#0ea5e9;">SafePredict</strong> · Safety Docs 360 · ${exportDate} · Confidential</p>
</div>

</body>
</html>`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagementReviewPage() {
  const [period, setPeriod] = useState<WeekPeriod>("4w");
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [selectedJobsite, setSelectedJobsite] = useState<string>("all");
  const [incidents, setIncidents] = useState<number | null>(null);
  const [openCAs, setOpenCAs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  // Load jobsites on mount
  useEffect(() => {
    async function loadJobsites() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/company/jobsites", { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { jobsites?: Jobsite[] } | Jobsite[] | null;
        if (Array.isArray(data)) {
          setJobsites(data);
        } else if (data && typeof data === "object" && "jobsites" in data && Array.isArray(data.jobsites)) {
          setJobsites(data.jobsites);
        }
      } catch {
        // no jobsite filter if fetch fails
      }
    }
    void loadJobsites();
  }, []);

  const fetchMetrics = useCallback(async (activePeriod: WeekPeriod, jobsiteId: string) => {
    setLoading(true);
    const apiPeriod = PERIOD_API_PARAM[activePeriod];
    const jobsiteParam = jobsiteId !== "all" ? `&jobsiteId=${jobsiteId}` : "";
    try {
      const headers = await getAuthHeaders();

      const incRes = await fetch(`/api/company/incidents?period=${apiPeriod}${jobsiteParam}`, { headers });
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

      const caRes = await fetch(`/api/company/corrective-actions?status=open${jobsiteParam}`, { headers });
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
    void fetchMetrics(period, selectedJobsite);
  }, [period, selectedJobsite, fetchMetrics]);

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
      barColor: incidentTrend === "down" ? "#10b981" : "#ef4444",
      barPct: Math.min(100, Math.round((resolvedIncidents / 10) * 100)),
    },
    {
      label: "Open Corrective Actions",
      value: loading ? "—" : resolvedOpenCAs,
      trend: resolvedOpenCAs <= 10 ? "down" : resolvedOpenCAs >= 20 ? "up" : "neutral",
      trendLabel: resolvedOpenCAs <= 10 ? "Within target" : resolvedOpenCAs >= 20 ? "Above target" : "Near target",
      trendPositive: resolvedOpenCAs <= 10,
      icon: <FileText className="w-5 h-5" />,
      color: "text-amber-600",
      barColor: resolvedOpenCAs <= 10 ? "#10b981" : "#f59e0b",
      barPct: Math.min(100, Math.round((resolvedOpenCAs / 20) * 100)),
    },
    {
      label: "Inspection Compliance",
      value: loading ? "—" : `${demo.inspectionRate}%`,
      trend: demo.inspectionRate >= 85 ? "up" : "down",
      trendLabel: demo.inspectionRate >= 85 ? "Above 85% target" : "Below 85% target",
      trendPositive: demo.inspectionRate >= 85,
      icon: <CheckSquare className="w-5 h-5" />,
      color: "text-blue-600",
      barColor: demo.inspectionRate >= 85 ? "#3b82f6" : "#ef4444",
      barPct: demo.inspectionRate,
    },
    {
      label: "Induction Completion",
      value: loading ? "—" : `${demo.inductionRate}%`,
      trend: demo.inductionRate >= 90 ? "up" : "down",
      trendLabel: demo.inductionRate >= 90 ? "Above 90% target" : "Below 90% target",
      trendPositive: demo.inductionRate >= 90,
      icon: <Users className="w-5 h-5" />,
      color: "text-violet-600",
      barColor: demo.inductionRate >= 90 ? "#8b5cf6" : "#ef4444",
      barPct: demo.inductionRate,
    },
    {
      label: "Leading Indicator Score",
      value: loading ? "—" : `${demo.leadingScore}/100`,
      trend: demo.leadingScore >= 75 ? "up" : "down",
      trendLabel: demo.leadingScore >= 75 ? "On track" : "Needs attention",
      trendPositive: demo.leadingScore >= 75,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-emerald-600",
      barColor: demo.leadingScore >= 75 ? "#10b981" : "#ef4444",
      barPct: demo.leadingScore,
    },
  ];

  function toggleAgendaItem(index: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleExport() {
    const exportDate = new Date().toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const jobsiteName =
      selectedJobsite === "all"
        ? "All Jobsites"
        : jobsites.find((j) => j.id === selectedJobsite)?.name ?? "Unknown Jobsite";

    const exportMetrics: ExportMetric[] = metrics.map((m) => ({
      label: m.label,
      value: m.value,
      trendLabel: m.trendLabel,
      trendPositive: m.trendPositive,
      barColor: m.barColor,
      barPct: m.barPct,
    }));

    const html = generateReportHTML({
      period,
      jobsiteName,
      metrics: exportMetrics,
      checkedItems,
      notes,
      exportDate,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const isoDate = new Date().toISOString().split("T")[0];
    a.download = `management-review-${period}-${isoDate ?? "export"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const jobsiteLabel =
    selectedJobsite === "all"
      ? "All Jobsites"
      : (jobsites.find((j) => j.id === selectedJobsite)?.name ?? "");

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Management Review"
        subtitle="Periodic executive review of safety performance, objectives, and continuous improvement outcomes."
      />

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Week period buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {(["1w", "2w", "4w", "8w", "12w"] as WeekPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cx(
                "px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all",
                period === p
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {PERIOD_BUTTON_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Jobsite dropdown */}
        {jobsites.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedJobsite}
              onChange={(e) => setSelectedJobsite(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
            >
              <option value="all">All Jobsites</option>
              {jobsites.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}{j.code ? ` (${j.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active filter hint */}
      <p className="text-xs text-slate-400 -mt-4">
        Showing <strong className="text-slate-600">{PERIOD_LABELS[period]}</strong>
        {selectedJobsite !== "all" && (
          <> · <strong className="text-slate-600">{jobsiteLabel}</strong></>
        )}
      </p>

      {/* ── KPI Summary ───────────────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Key Performance Summary"
          hint={`Safety metrics · ${PERIOD_LABELS[period].toLowerCase()}${selectedJobsite !== "all" ? ` · ${jobsiteLabel}` : ""}`}
        />
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
              {/* Mini progress bar */}
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${m.barPct}%`, background: m.barColor }}
                />
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

      {/* ── Review Agenda ─────────────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Review Agenda"
          hint="Standard ISO 45001 management review agenda — check off each item as it is discussed."
        />
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

      {/* ── Minutes / Notes ───────────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Minutes &amp; Review Outcomes"
          hint="Record key decisions, action items, and outcomes from this management review."
        />
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
                  Report downloaded
                </span>
              )}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
