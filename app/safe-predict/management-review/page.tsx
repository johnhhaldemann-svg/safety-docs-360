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
  incidents: number; openCAs: number; inspectionRate: number; inductionRate: number; leadingScore: number;
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

// ── SVG helpers ───────────────────────────────────────────────────────────────

function donutSVG(pct: number, color: string, w = 140): string {
  const r = 48;
  const c = 2 * Math.PI * r;
  const dash = ((pct / 100) * c).toFixed(1);
  return `<svg width="${w}" height="${w}" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="11"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="11"
      stroke-dasharray="${dash} ${c.toFixed(1)}" stroke-linecap="round"
      transform="rotate(-90 60 60)"/>
    <text x="60" y="56" text-anchor="middle" font-size="20" font-weight="800"
      fill="#1e293b" font-family="Inter,system-ui,sans-serif">${pct}%</text>
    <text x="60" y="74" text-anchor="middle" font-size="10" fill="#64748b"
      font-family="Inter,system-ui,sans-serif">/ 100</text>
  </svg>`;
}

function scoreSVG(score: number, color: string, w = 160): string {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = ((score / 100) * c).toFixed(1);
  return `<svg width="${w}" height="${w}" viewBox="0 0 130 130">
    <circle cx="65" cy="65" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="13"/>
    <circle cx="65" cy="65" r="${r}" fill="none" stroke="${color}" stroke-width="13"
      stroke-dasharray="${dash} ${c.toFixed(1)}" stroke-linecap="round"
      transform="rotate(-90 65 65)"/>
    <text x="65" y="60" text-anchor="middle" font-size="26" font-weight="900"
      fill="#1e293b" font-family="Inter,system-ui,sans-serif">${score}</text>
    <text x="65" y="77" text-anchor="middle" font-size="11" fill="#64748b"
      font-family="Inter,system-ui,sans-serif">out of 100</text>
  </svg>`;
}

function incidentBarSVG(
  data: { label: string; value: number; isCurrent: boolean }[]
): string {
  const maxV = Math.max(...data.map(d => d.value), 1);
  const W = 320; const H = 160; const pad = 30; const barW = 38; const gap = 18;
  const bars = data.map((d, i) => {
    const bh = Math.max(4, ((d.value / maxV) * (H - pad - 20)));
    const x = 20 + i * (barW + gap);
    const y = H - pad - bh;
    const fill = d.isCurrent ? "#0ea5e9" : "#cbd5e1";
    const textFill = d.isCurrent ? "#0ea5e9" : "#94a3b8";
    const fw = d.isCurrent ? "700" : "400";
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="5" fill="${fill}"/>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="12"
        font-weight="${fw}" fill="${textFill}" font-family="Inter,sans-serif">${d.value}</text>
      <text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" font-size="10"
        fill="#94a3b8" font-family="Inter,sans-serif">${d.label}</text>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <line x1="10" y1="${H - pad}" x2="${W - 10}" y2="${H - pad}" stroke="#e2e8f0" stroke-width="1"/>
    ${bars}
  </svg>`;
}

function rag(val: number, greenThresh: number, amberThresh: number, higherIsBetter: boolean): "green" | "amber" | "red" {
  if (higherIsBetter) {
    if (val >= greenThresh) return "green";
    if (val >= amberThresh) return "amber";
    return "red";
  } else {
    if (val <= greenThresh) return "green";
    if (val <= amberThresh) return "amber";
    return "red";
  }
}

function ragBadge(status: "green" | "amber" | "red"): string {
  const map = { green: ["#f0fdf4", "#16a34a", "ON TRACK"], amber: ["#fffbeb", "#d97706", "MONITOR"], red: ["#fef2f2", "#dc2626", "ATTENTION"] };
  const [bg, col, label] = map[status];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${bg};color:${col};font-size:10px;font-weight:700;letter-spacing:.06em;">${label}</span>`;
}

function ragDot(status: "green" | "amber" | "red"): string {
  const col = { green: "#10b981", amber: "#f59e0b", red: "#ef4444" }[status];
  return `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${col};flex-shrink:0;"></span>`;
}

// ── Presentation Generator ─────────────────────────────────────────────────────

function generatePresentation(params: {
  period: WeekPeriod;
  jobsiteName: string;
  checkedItems: Set<number>;
  notes: string;
  exportDate: string;
  resolvedIncidents: number;
  resolvedOpenCAs: number;
  priorIncidents: number;
  inspectionRate: number;
  inductionRate: number;
  leadingScore: number;
}): string {
  const {
    period, jobsiteName, checkedItems, notes, exportDate,
    resolvedIncidents, resolvedOpenCAs, priorIncidents,
    inspectionRate, inductionRate, leadingScore,
  } = params;

  // ── Derived values ────────────────────────────────────────────────────────
  const incidentChange = resolvedIncidents - priorIncidents;
  const incidentTrendUp = incidentChange < 0;

  // Overall safety score (weighted average)
  const incScore   = Math.max(0, Math.min(100, Math.round(100 - resolvedIncidents * 8)));
  const caScore    = Math.max(0, Math.min(100, Math.round(100 - resolvedOpenCAs * 4)));
  const overallScore = Math.round((inspectionRate + inductionRate + leadingScore + incScore + caScore) / 5);
  const overallRag = rag(overallScore, 80, 65, true);
  const overallColor = overallRag === "green" ? "#10b981" : overallRag === "amber" ? "#f59e0b" : "#ef4444";

  // Per-metric RAG
  const incRag  = rag(resolvedIncidents, 2, 5, false);
  const caRag   = rag(resolvedOpenCAs, 10, 20, false);
  const inspecRag = rag(inspectionRate, 90, 85, true);
  const indRag  = rag(inductionRate, 95, 90, true);
  const leadRag = rag(leadingScore, 80, 65, true);

  // Incident trend chart data
  const allPeriods: Array<{ label: string; value: number; isCurrent: boolean }> = [
    { label: "1wk",  value: DEMO_METRICS["1w"].incidents,  isCurrent: period === "1w"  },
    { label: "2wks", value: DEMO_METRICS["2w"].incidents,  isCurrent: period === "2w"  },
    { label: "4wks", value: DEMO_METRICS["4w"].incidents,  isCurrent: period === "4w"  },
    { label: "8wks", value: DEMO_METRICS["8w"].incidents,  isCurrent: period === "8w"  },
    { label: "12wks",value: DEMO_METRICS["12w"].incidents, isCurrent: period === "12w" },
  ];

  // Agenda checklist split into 2 columns
  const col1 = AGENDA_ITEMS.slice(0, 5);
  const col2 = AGENDA_ITEMS.slice(5);
  const agendaCompletePct = AGENDA_ITEMS.length > 0
    ? Math.round((checkedItems.size / AGENDA_ITEMS.length) * 100) : 0;

  // ── Shared styles ─────────────────────────────────────────────────────────
  const FONT = `font-family:'Inter',system-ui,-apple-system,sans-serif;`;
  const slideStyle = `width:1200px;height:675px;overflow:hidden;position:relative;display:flex;flex-direction:column;${FONT}`;

  const headerBar = (title: string, sub: string) =>
    `<div style="background:#0f172a;padding:22px 48px 18px;flex-shrink:0;">
      <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-.02em;">${title}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px;font-weight:500;">${sub}</div>
    </div>`;

  const slideFooter = (num: number) =>
    `<div style="position:absolute;bottom:0;left:0;right:0;background:#f8fafc;border-top:1px solid #e2e8f0;padding:8px 48px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:#94a3b8;font-weight:500;">SafePredict · Management Review · ${exportDate}</span>
      <span style="font-size:11px;color:#94a3b8;font-weight:500;">${num} / 9</span>
    </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — COVER
  // ══════════════════════════════════════════════════════════════════════════
  const slide1 = `
  <div style="${slideStyle};background:linear-gradient(135deg,#0f172a 0%,#0c4a6e 50%,#0ea5e9 100%);">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 80px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:48px;">
        <div style="width:38px;height:38px;background:rgba(255,255,255,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:18px;font-weight:900;${FONT}">S</span>
        </div>
        <span style="color:rgba(255,255,255,.6);font-size:13px;font-weight:600;letter-spacing:.1em;${FONT}">SAFEPREDICT · SAFETY DOCS 360</span>
      </div>
      <div style="color:rgba(255,255,255,.35);font-size:13px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px;${FONT}">ISO 45001 · SAFETY MANAGEMENT SYSTEM</div>
      <h1 style="font-size:72px;font-weight:900;color:white;line-height:1;margin:0 0 16px;letter-spacing:-.03em;${FONT}">Management<br/>Review Report</h1>
      <p style="font-size:18px;color:rgba(255,255,255,.6);margin:0 0 56px;font-weight:400;${FONT}">Periodic executive safety performance review &amp; decision meeting</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${[
          ["REVIEW PERIOD", PERIOD_LABELS[period]],
          ["JOBSITE", jobsiteName],
          ["DATE", exportDate],
          ["AGENDA ITEMS", `${AGENDA_ITEMS.length} items`],
        ].map(([label, val]) => `
          <div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:12px 20px;backdrop-filter:blur(4px);">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:4px;${FONT}">${label}</div>
            <div style="font-size:16px;color:white;font-weight:700;${FONT}">${val}</div>
          </div>`).join("")}
      </div>
    </div>
    <div style="padding:20px 80px;border-top:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:rgba(255,255,255,.35);font-weight:500;${FONT}">CONFIDENTIAL · FOR INTERNAL USE ONLY</span>
      <span style="font-size:11px;color:rgba(255,255,255,.35);font-weight:500;${FONT}">1 / 9</span>
    </div>
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — EXECUTIVE SCORECARD
  // ══════════════════════════════════════════════════════════════════════════
  const kpiRows = [
    { label: "Total Incidents",         val: resolvedIncidents,      unit: "",      rag: incRag,   target: "Target ≤ 2",   change: `${Math.abs(incidentChange)} vs prior` },
    { label: "Open Corrective Actions", val: resolvedOpenCAs,         unit: "",      rag: caRag,   target: "Target ≤ 10",  change: "Currently open" },
    { label: "Inspection Compliance",   val: `${inspectionRate}%`,   unit: "",      rag: inspecRag, target: "Target ≥ 85%", change: inspectionRate >= 85 ? "Above target" : "Below target" },
    { label: "Induction Completion",    val: `${inductionRate}%`,    unit: "",      rag: indRag,  target: "Target ≥ 90%", change: inductionRate >= 90 ? "Above target" : "Below target" },
    { label: "Leading Indicator Score", val: `${leadingScore}/100`,  unit: "",      rag: leadRag, target: "Target ≥ 75",  change: leadingScore >= 75 ? "On track" : "Below target" },
  ];

  const slide2 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("Executive Safety Scorecard", `${PERIOD_LABELS[period]} · ${jobsiteName} · ${exportDate}`)}
    <div style="flex:1;display:flex;gap:0;overflow:hidden;">
      <!-- Overall score -->
      <div style="width:280px;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;flex-shrink:0;padding:20px;">
        ${scoreSVG(overallScore, overallColor, 170)}
        <div style="text-align:center;">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;${FONT}">Overall Safety Score</div>
          ${ragBadge(overallRag)}
        </div>
        <div style="margin-top:8px;padding:10px 16px;background:rgba(255,255,255,.06);border-radius:8px;text-align:center;width:100%;box-sizing:border-box;">
          <div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;${FONT}">Weighted across all KPIs</div>
        </div>
      </div>
      <!-- KPI rows -->
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:16px 40px;gap:8px;">
        <div style="display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr;gap:8px;padding:8px 12px;background:#f8fafc;border-radius:8px;margin-bottom:4px;">
          ${["METRIC","ACTUAL","STATUS","TARGET"].map(h =>
            `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;${FONT}">${h}</div>`
          ).join("")}
        </div>
        ${kpiRows.map(r => `
          <div style="display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr;gap:8px;padding:10px 12px;border-radius:8px;border:1px solid #f1f5f9;align-items:center;background:white;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${ragDot(r.rag as "green"|"amber"|"red")}
              <div>
                <div style="font-size:13px;font-weight:600;color:#1e293b;${FONT}">${r.label}</div>
                <div style="font-size:10px;color:#94a3b8;${FONT}">${r.change}</div>
              </div>
            </div>
            <div style="font-size:22px;font-weight:800;color:#1e293b;${FONT}">${r.val}${r.unit}</div>
            <div>${ragBadge(r.rag as "green"|"amber"|"red")}</div>
            <div style="font-size:11px;color:#64748b;font-weight:500;${FONT}">${r.target}</div>
          </div>`).join("")}
      </div>
    </div>
    ${slideFooter(2)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — INCIDENT PERFORMANCE
  // ══════════════════════════════════════════════════════════════════════════
  const slide3 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("Incident Performance Analysis", `${PERIOD_LABELS[period]} · ${jobsiteName}`)}
    <div style="flex:1;display:flex;gap:0;overflow:hidden;">
      <!-- Big number -->
      <div style="width:260px;background:${resolvedIncidents <= 2 ? "#f0fdf4" : resolvedIncidents <= 5 ? "#fffbeb" : "#fef2f2"};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;flex-shrink:0;border-right:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${resolvedIncidents <= 2 ? "#15803d" : resolvedIncidents <= 5 ? "#b45309" : "#991b1b"};${FONT}">TOTAL INCIDENTS</div>
        <div style="font-size:96px;font-weight:900;line-height:1;color:${resolvedIncidents <= 2 ? "#166534" : resolvedIncidents <= 5 ? "#92400e" : "#7f1d1d"};${FONT}">${resolvedIncidents}</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${incidentTrendUp ? "#16a34a" : "#dc2626"};${FONT}">
          ${incidentTrendUp ? "▼" : "▲"} ${Math.abs(incidentChange)} vs prior period
        </div>
        <div style="margin-top:4px;${ragBadge(incRag)};font-size:12px;"></div>
        <div style="margin-top:12px;padding:10px 16px;background:rgba(0,0,0,.04);border-radius:8px;width:100%;box-sizing:border-box;text-align:center;">
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;${FONT}">Prior Period</div>
          <div style="font-size:24px;font-weight:700;color:#475569;${FONT}">${priorIncidents}</div>
        </div>
      </div>
      <!-- Bar chart -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 30px;">
        <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:16px;align-self:flex-start;${FONT}">Incident Trend by Review Period</div>
        ${incidentBarSVG(allPeriods)}
        <div style="font-size:11px;color:#94a3b8;margin-top:8px;${FONT}">Highlighted bar = current selection · Target: ≤ 2 per period</div>
      </div>
      <!-- Analysis bullets -->
      <div style="width:280px;background:#f8fafc;padding:24px;display:flex;flex-direction:column;gap:12px;border-left:1px solid #e2e8f0;flex-shrink:0;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Key Findings</div>
        ${[
          { icon: "📊", text: `${resolvedIncidents} incident${resolvedIncidents !== 1 ? "s" : ""} recorded in ${PERIOD_LABELS[period].toLowerCase()}` },
          { icon: incidentTrendUp ? "✅" : "⚠️", text: `${incidentTrendUp ? "Improved" : "Increased"} by ${Math.abs(incidentChange)} vs prior period` },
          { icon: resolvedIncidents <= 2 ? "🟢" : "🔴", text: `${resolvedIncidents <= 2 ? "Within" : "Exceeds"} target of ≤ 2 incidents` },
          { icon: "📋", text: `${resolvedOpenCAs} corrective actions remain open` },
          { icon: "🎯", text: `Leading score ${leadingScore}/100 — ${leadingScore >= 75 ? "proactive measures effective" : "review leading indicators"}` },
        ].map(b => `
          <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:white;border-radius:8px;border:1px solid #e2e8f0;">
            <span style="font-size:16px;flex-shrink:0;">${b.icon}</span>
            <span style="font-size:12px;color:#334155;line-height:1.4;${FONT}">${b.text}</span>
          </div>`).join("")}
      </div>
    </div>
    ${slideFooter(3)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — CORRECTIVE ACTIONS
  // ══════════════════════════════════════════════════════════════════════════
  const caTarget = 10;
  const caPct = Math.min(100, Math.round((resolvedOpenCAs / 20) * 100));
  const caTargetPct = Math.round((caTarget / 20) * 100);

  const slide4 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("Corrective Action Management", `${PERIOD_LABELS[period]} · ${jobsiteName}`)}
    <div style="flex:1;display:flex;overflow:hidden;">
      <!-- Left: big number + bar -->
      <div style="width:380px;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:16px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.5);${FONT}">OPEN CORRECTIVE ACTIONS</div>
        <div style="font-size:100px;font-weight:900;line-height:1;color:${resolvedOpenCAs <= 10 ? "#34d399" : resolvedOpenCAs <= 20 ? "#fbbf24" : "#f87171"};${FONT}">${resolvedOpenCAs}</div>
        ${ragBadge(caRag as "green"|"amber"|"red")}
        <div style="width:100%;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;color:rgba(255,255,255,.5);${FONT}">0</span>
            <span style="font-size:11px;color:#fbbf24;${FONT}">Target: ${caTarget}</span>
            <span style="font-size:11px;color:rgba(255,255,255,.5);${FONT}">20+</span>
          </div>
          <div style="height:10px;background:rgba(255,255,255,.1);border-radius:99px;overflow:visible;position:relative;">
            <div style="height:100%;width:${caPct}%;background:${resolvedOpenCAs <= 10 ? "#34d399" : resolvedOpenCAs <= 20 ? "#fbbf24" : "#f87171"};border-radius:99px;"></div>
            <div style="position:absolute;top:-4px;left:${caTargetPct}%;width:3px;height:18px;background:white;border-radius:2px;"></div>
          </div>
          <div style="margin-top:10px;text-align:center;font-size:12px;color:rgba(255,255,255,.5);${FONT}">
            ${resolvedOpenCAs <= caTarget ? `${caTarget - resolvedOpenCAs} below target ✓` : `${resolvedOpenCAs - caTarget} above target — action required`}
          </div>
        </div>
      </div>
      <!-- Right: detail -->
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:32px 48px;gap:20px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Discussion Points</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${[
            { label: "Open CAs", val: resolvedOpenCAs, sub: "Total open", col: resolvedOpenCAs <= 10 ? "#10b981" : "#f59e0b" },
            { label: "CA Target", val: caTarget, sub: "Max threshold", col: "#0ea5e9" },
            { label: "Variance", val: `${resolvedOpenCAs > caTarget ? "+" : ""}${resolvedOpenCAs - caTarget}`, sub: "vs target", col: resolvedOpenCAs <= caTarget ? "#10b981" : "#ef4444" },
            { label: "Inspection Rate", val: `${inspectionRate}%`, sub: "Driving CA source", col: inspectionRate >= 85 ? "#10b981" : "#f59e0b" },
          ].map(c => `
            <div style="padding:16px 20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:700;margin-bottom:6px;${FONT}">${c.label}</div>
              <div style="font-size:32px;font-weight:800;color:${c.col};line-height:1;${FONT}">${c.val}</div>
              <div style="font-size:11px;color:#64748b;margin-top:4px;${FONT}">${c.sub}</div>
            </div>`).join("")}
        </div>
        <div style="padding:16px 20px;background:#fef9c3;border:1px solid #fde047;border-radius:10px;">
          <div style="font-size:12px;font-weight:700;color:#854d0e;margin-bottom:4px;${FONT}">⚡ Action Required</div>
          <div style="font-size:12px;color:#713f12;${FONT}">
            ${resolvedOpenCAs > caTarget
              ? `${resolvedOpenCAs - caTarget} corrective actions exceed the target threshold of ${caTarget}. Review overdue items, assign accountability and set closure dates at this meeting.`
              : `Corrective actions are within target. Continue monitoring close-out rates and ensure no items become overdue.`}
          </div>
        </div>
      </div>
    </div>
    ${slideFooter(4)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — COMPLIANCE PERFORMANCE
  // ══════════════════════════════════════════════════════════════════════════
  const slide5 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("Compliance Performance", `${PERIOD_LABELS[period]} · ${jobsiteName}`)}
    <div style="flex:1;display:flex;overflow:hidden;">
      <!-- Inspection -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;border-right:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;${FONT}">Inspection Compliance</div>
        ${donutSVG(inspectionRate, inspecRag === "green" ? "#3b82f6" : inspecRag === "amber" ? "#f59e0b" : "#ef4444", 180)}
        ${ragBadge(inspecRag as "green"|"amber"|"red")}
        <div style="text-align:center;padding:0 16px;">
          <div style="font-size:13px;font-weight:600;color:#334155;${FONT}">
            ${inspectionRate >= 85 ? "✅ Above 85% target" : "⚠️ Below 85% target — review schedule"}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;${FONT}">Target threshold: 85% minimum</div>
        </div>
        <!-- target line visual -->
        <div style="width:80%;background:#f1f5f9;border-radius:99px;height:8px;position:relative;overflow:visible;">
          <div style="height:100%;width:${inspectionRate}%;background:${inspecRag === "green" ? "#3b82f6" : inspecRag === "amber" ? "#f59e0b" : "#ef4444"};border-radius:99px;"></div>
          <div style="position:absolute;top:-3px;left:85%;width:2px;height:14px;background:#ef4444;border-radius:1px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:80%;font-size:10px;color:#94a3b8;${FONT}">
          <span>0%</span><span style="color:#ef4444;">Target 85%</span><span>100%</span>
        </div>
      </div>
      <!-- Induction -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;border-right:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;${FONT}">Induction Completion</div>
        ${donutSVG(inductionRate, indRag === "green" ? "#8b5cf6" : indRag === "amber" ? "#f59e0b" : "#ef4444", 180)}
        ${ragBadge(indRag as "green"|"amber"|"red")}
        <div style="text-align:center;padding:0 16px;">
          <div style="font-size:13px;font-weight:600;color:#334155;${FONT}">
            ${inductionRate >= 90 ? "✅ Above 90% target" : "⚠️ Below 90% target — review gaps"}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;${FONT}">Target threshold: 90% minimum</div>
        </div>
        <div style="width:80%;background:#f1f5f9;border-radius:99px;height:8px;position:relative;overflow:visible;">
          <div style="height:100%;width:${inductionRate}%;background:${indRag === "green" ? "#8b5cf6" : indRag === "amber" ? "#f59e0b" : "#ef4444"};border-radius:99px;"></div>
          <div style="position:absolute;top:-3px;left:90%;width:2px;height:14px;background:#ef4444;border-radius:1px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:80%;font-size:10px;color:#94a3b8;${FONT}">
          <span>0%</span><span style="color:#ef4444;">Target 90%</span><span>100%</span>
        </div>
      </div>
      <!-- Leading -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;${FONT}">Leading Indicator Score</div>
        ${donutSVG(leadingScore, leadRag === "green" ? "#10b981" : leadRag === "amber" ? "#f59e0b" : "#ef4444", 180)}
        ${ragBadge(leadRag as "green"|"amber"|"red")}
        <div style="text-align:center;padding:0 16px;">
          <div style="font-size:13px;font-weight:600;color:#334155;${FONT}">
            ${leadingScore >= 75 ? "✅ Above 75 target" : "⚠️ Below 75 target — improve proactive measures"}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;${FONT}">Target threshold: 75 / 100</div>
        </div>
        <div style="width:80%;background:#f1f5f9;border-radius:99px;height:8px;position:relative;overflow:visible;">
          <div style="height:100%;width:${leadingScore}%;background:${leadRag === "green" ? "#10b981" : leadRag === "amber" ? "#f59e0b" : "#ef4444"};border-radius:99px;"></div>
          <div style="position:absolute;top:-3px;left:75%;width:2px;height:14px;background:#ef4444;border-radius:1px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:80%;font-size:10px;color:#94a3b8;${FONT}">
          <span>0</span><span style="color:#ef4444;">Target 75</span><span>100</span>
        </div>
      </div>
    </div>
    ${slideFooter(5)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — PERFORMANCE SUMMARY TABLE
  // ══════════════════════════════════════════════════════════════════════════
  const tableRows = [
    { metric: "Total Incidents",         target: "≤ 2",    actual: String(resolvedIncidents),        trend: incidentTrendUp ? "▼ Improving" : "▲ Worsening", status: incRag },
    { metric: "Open Corrective Actions", target: "≤ 10",   actual: String(resolvedOpenCAs),           trend: resolvedOpenCAs <= 10 ? "✓ Within target" : "⚠ Exceeds target", status: caRag },
    { metric: "Inspection Compliance",   target: "≥ 85%",  actual: `${inspectionRate}%`,             trend: inspectionRate >= 85 ? "▲ On target" : "▼ Below target", status: inspecRag },
    { metric: "Induction Completion",    target: "≥ 90%",  actual: `${inductionRate}%`,              trend: inductionRate >= 90 ? "▲ On target" : "▼ Below target", status: indRag },
    { metric: "Leading Indicator Score", target: "≥ 75",   actual: `${leadingScore}/100`,            trend: leadingScore >= 75 ? "▲ On track" : "▼ Needs attention", status: leadRag },
    { metric: "Overall Safety Score",    target: "≥ 80",   actual: `${overallScore}/100`,            trend: overallScore >= 80 ? "✓ Performing" : "⚠ Review required", status: overallRag },
  ];

  const ragColour = (r: string) => r === "green" ? "#10b981" : r === "amber" ? "#f59e0b" : "#ef4444";
  const ragBg     = (r: string) => r === "green" ? "#f0fdf4" : r === "amber" ? "#fffbeb" : "#fef2f2";

  const slide6 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("Safety Performance Summary — All KPIs", `${PERIOD_LABELS[period]} · ${jobsiteName}`)}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:24px 48px 48px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;${FONT}">
        <thead>
          <tr style="background:#0f172a;">
            ${["METRIC","TARGET","ACTUAL","TREND","STATUS"].map(h =>
              `<th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:.1em;text-transform:uppercase;">${h}</th>`
            ).join("")}
          </tr>
        </thead>
        <tbody>
          ${tableRows.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? "white" : "#f8fafc"};border-bottom:1px solid #f1f5f9;">
            <td style="padding:14px 16px;font-weight:600;color:#1e293b;">${r.metric}</td>
            <td style="padding:14px 16px;color:#64748b;font-weight:500;">${r.target}</td>
            <td style="padding:14px 16px;font-size:18px;font-weight:800;color:${ragColour(r.status)};">${r.actual}</td>
            <td style="padding:14px 16px;color:#334155;font-weight:500;">${r.trend}</td>
            <td style="padding:14px 16px;">
              <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${ragBg(r.status)};color:${ragColour(r.status)};font-size:10px;font-weight:700;letter-spacing:.06em;">
                ${r.status === "green" ? "ON TRACK" : r.status === "amber" ? "MONITOR" : "ATTENTION"}
              </span>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div style="display:flex;gap:16px;margin-top:20px;font-size:11px;color:#64748b;${FONT}">
        <span>🟢 ON TRACK = meeting or exceeding target</span>
        <span>🟡 MONITOR = approaching threshold</span>
        <span>🔴 ATTENTION = below minimum threshold</span>
      </div>
    </div>
    ${slideFooter(6)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — ISO 45001 AGENDA
  // ══════════════════════════════════════════════════════════════════════════
  const renderItem = (item: string, idx: number) => {
    const done = checkedItems.has(idx);
    return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-radius:8px;background:${done ? "#f0fdf4" : "white"};border:1px solid ${done ? "#86efac" : "#e2e8f0"};">
      <div style="width:22px;height:22px;border-radius:5px;background:${done ? "#10b981" : "white"};border:2px solid ${done ? "#10b981" : "#cbd5e1"};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
        ${done ? '<span style="color:white;font-size:13px;font-weight:700;line-height:1;">✓</span>' : ""}
      </div>
      <span style="font-size:12px;font-weight:${done ? "500" : "600"};color:${done ? "#64748b" : "#1e293b"};text-decoration:${done ? "line-through" : "none"};line-height:1.4;${FONT}">
        <span style="color:#cbd5e1;font-weight:500;margin-right:6px;">${idx + 1}.</span>${item}
      </span>
    </div>`;
  };

  const slide7 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("ISO 45001 Review Agenda", `${checkedItems.size} of ${AGENDA_ITEMS.length} items completed · ${PERIOD_LABELS[period]}`)}
    <div style="flex:1;display:flex;overflow:hidden;">
      <div style="flex:1;padding:20px 32px;display:flex;flex-direction:column;gap:7px;overflow:hidden;">${col1.map((item, i) => renderItem(item, i)).join("")}</div>
      <div style="width:1px;background:#e2e8f0;flex-shrink:0;"></div>
      <div style="flex:1;padding:20px 32px;display:flex;flex-direction:column;gap:7px;overflow:hidden;">${col2.map((item, i) => renderItem(item, i + 5)).join("")}</div>
    </div>
    <div style="padding:10px 48px 42px;display:flex;align-items:center;gap:16px;">
      <div style="flex:1;height:8px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${agendaCompletePct}%;background:#10b981;border-radius:99px;"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${agendaCompletePct === 100 ? "#16a34a" : "#64748b"};flex-shrink:0;${FONT}">${agendaCompletePct}% complete</span>
    </div>
    ${slideFooter(7)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — MEETING NOTES & ACTION ITEMS
  // ══════════════════════════════════════════════════════════════════════════
  const slide8 = `
  <div style="${slideStyle}background:white;">
    ${headerBar("Meeting Notes &amp; Action Items", `${exportDate} · ${jobsiteName}`)}
    <div style="flex:1;display:flex;gap:0;overflow:hidden;">
      <!-- Notes -->
      <div style="flex:1;padding:24px 32px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;${FONT}">Meeting Minutes</div>
        <div style="flex:1;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:16px;font-size:12px;color:${notes.trim() ? "#334155" : "#94a3b8"};line-height:1.75;white-space:pre-wrap;overflow:auto;${FONT}">
          ${notes.trim() || "No meeting minutes recorded.\n\nUse the Management Review page to enter notes before exporting."}
        </div>
      </div>
      <!-- Action items table -->
      <div style="width:460px;padding:24px 28px;display:flex;flex-direction:column;gap:12px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;${FONT}">Action Items from This Review</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;${FONT}">
          <thead>
            <tr style="background:#f1f5f9;">
              ${["#","ACTION ITEM","OWNER","DUE","PRI"].map(h =>
                `<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;border-bottom:2px solid #e2e8f0;">${h}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            ${[1,2,3,4,5,6].map(n => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 10px;color:#94a3b8;font-weight:600;">${n}</td>
              <td style="padding:9px 10px;color:#cbd5e1;font-style:italic;">Record action here</td>
              <td style="padding:9px 10px;color:#cbd5e1;">—</td>
              <td style="padding:9px 10px;color:#cbd5e1;">—</td>
              <td style="padding:9px 10px;"><span style="padding:2px 8px;border-radius:12px;background:#f1f5f9;color:#94a3b8;font-size:10px;font-weight:700;">—</span></td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div style="padding:10px 14px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
          <div style="font-size:11px;color:#1d4ed8;font-weight:600;margin-bottom:3px;${FONT}">📌 Priority Codes</div>
          <div style="font-size:10px;color:#3b82f6;${FONT}">H = High (within 1 week) &nbsp;·&nbsp; M = Medium (within 1 month) &nbsp;·&nbsp; L = Low (next review)</div>
        </div>
      </div>
    </div>
    ${slideFooter(8)}
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — NEXT STEPS & CLOSE
  // ══════════════════════════════════════════════════════════════════════════
  const recommendations = [
    { icon: "📉", title: "Incident Reduction", desc: resolvedIncidents <= 2 ? "Maintain current controls — incidents within target." : `Investigate root causes of ${resolvedIncidents} incidents. Review hazard controls and near-miss reporting.` },
    { icon: "📋", title: "Corrective Actions", desc: resolvedOpenCAs > 10 ? `Prioritise closure of ${resolvedOpenCAs - 10} overdue CAs. Assign owners and set firm due dates this meeting.` : "CAs within target. Continue monitoring close-out rates weekly." },
    { icon: "🔍", title: "Inspection Programme", desc: inspectionRate < 85 ? `Inspection rate ${inspectionRate}% is below 85% target. Review scheduling and assign accountability.` : `Inspection rate ${inspectionRate}% above target. Sustain frequency and quality of site inspections.` },
    { icon: "🎓", title: "Induction & Training", desc: inductionRate < 90 ? `Induction completion ${inductionRate}% is below 90% target. Identify workers needing induction and schedule immediately.` : `Induction compliance ${inductionRate}% is strong. Maintain onboarding process.` },
  ];

  const slide9 = `
  <div style="${slideStyle}background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0c4a6e 100%);">
    ${`<div style="background:rgba(14,165,233,.15);border-bottom:1px solid rgba(14,165,233,.2);padding:22px 48px 18px;flex-shrink:0;">
      <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-.02em;${FONT}">Recommendations &amp; Next Steps</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px;font-weight:500;${FONT}">${PERIOD_LABELS[period]} review · ${exportDate}</div>
    </div>`}
    <div style="flex:1;display:flex;gap:0;overflow:hidden;">
      <!-- Recommendations -->
      <div style="flex:1;padding:24px 32px;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:start;overflow:hidden;">
        ${recommendations.map(r => `
        <div style="padding:16px 18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;">
          <div style="font-size:20px;margin-bottom:8px;">${r.icon}</div>
          <div style="font-size:13px;font-weight:700;color:white;margin-bottom:6px;${FONT}">${r.title}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.6);line-height:1.5;${FONT}">${r.desc}</div>
        </div>`).join("")}
      </div>
      <!-- Right panel -->
      <div style="width:320px;flex-shrink:0;padding:24px;display:flex;flex-direction:column;gap:14px;border-left:1px solid rgba(255,255,255,.1);">
        <div style="padding:20px;background:rgba(255,255,255,.06);border-radius:10px;border:1px solid rgba(255,255,255,.1);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);font-weight:700;margin-bottom:10px;${FONT}">This Review Summary</div>
          ${[
            ["Period", PERIOD_LABELS[period]],
            ["Jobsite", jobsiteName],
            ["Incidents", `${resolvedIncidents} (${incidentTrendUp ? "↓ improving" : "↑ worsening"})`],
            ["Open CAs", `${resolvedOpenCAs} (target ≤ 10)`],
            ["Overall Score", `${overallScore}/100`],
            ["Agenda", `${checkedItems.size}/${AGENDA_ITEMS.length} items`],
          ].map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);">
              <span style="font-size:11px;color:rgba(255,255,255,.5);${FONT}">${k}</span>
              <span style="font-size:11px;font-weight:700;color:white;${FONT}">${v}</span>
            </div>`).join("")}
        </div>
        <div style="padding:16px 18px;background:rgba(14,165,233,.15);border-radius:10px;border:1px solid rgba(14,165,233,.3);">
          <div style="font-size:11px;font-weight:700;color:#7dd3fc;margin-bottom:4px;${FONT}">📅 Next Review</div>
          <div style="font-size:12px;color:rgba(255,255,255,.6);${FONT}">Schedule next management review as per ISO 45001 frequency requirements. Update records in SafePredict.</div>
        </div>
      </div>
    </div>
    <div style="padding:14px 48px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:rgba(255,255,255,.3);${FONT}">Generated by SafePredict · Safety Docs 360 · ${exportDate} · Confidential</span>
      <span style="font-size:11px;color:rgba(255,255,255,.3);${FONT}">9 / 9</span>
    </div>
  </div>`;

  // ══════════════════════════════════════════════════════════════════════════
  // ASSEMBLE FULL HTML
  // ══════════════════════════════════════════════════════════════════════════
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Management Review — ${PERIOD_LABELS[period]} — ${jobsiteName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:#1e293b;font-family:'Inter',system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{padding:32px;display:flex;flex-direction:column;align-items:center;gap:32px;}
  .slide{width:1200px;border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,.5);overflow:hidden;}
  @media print{
    html,body{background:white;padding:0;gap:0;}
    @page{size:landscape;margin:0;}
    .slide{width:100%;height:100vh;border-radius:0;box-shadow:none;page-break-after:always;}
  }
</style>
</head>
<body>
  <div class="slide">${slide1}</div>
  <div class="slide">${slide2}</div>
  <div class="slide">${slide3}</div>
  <div class="slide">${slide4}</div>
  <div class="slide">${slide5}</div>
  <div class="slide">${slide6}</div>
  <div class="slide">${slide7}</div>
  <div class="slide">${slide8}</div>
  <div class="slide">${slide9}</div>
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

  useEffect(() => {
    async function loadJobsites() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/company/jobsites", { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { jobsites?: Jobsite[] } | Jobsite[] | null;
        if (Array.isArray(data)) setJobsites(data);
        else if (data && typeof data === "object" && "jobsites" in data && Array.isArray(data.jobsites))
          setJobsites(data.jobsites);
      } catch { /* silent */ }
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
        const d = (await incRes.json()) as { incidents?: unknown[] } | unknown[] | null;
        if (Array.isArray(d)) setIncidents(d.length);
        else if (d && typeof d === "object" && "incidents" in d && Array.isArray((d as { incidents: unknown[] }).incidents))
          setIncidents((d as { incidents: unknown[] }).incidents.length);
        else setIncidents(DEMO_METRICS[activePeriod].incidents);
      } else setIncidents(DEMO_METRICS[activePeriod].incidents);

      const caRes = await fetch(`/api/company/corrective-actions?status=open${jobsiteParam}`, { headers });
      if (caRes.ok) {
        const d = (await caRes.json()) as { corrective_actions?: unknown[] } | unknown[] | null;
        if (Array.isArray(d)) setOpenCAs(d.length);
        else if (d && typeof d === "object" && "corrective_actions" in d && Array.isArray((d as { corrective_actions: unknown[] }).corrective_actions))
          setOpenCAs((d as { corrective_actions: unknown[] }).corrective_actions.length);
        else setOpenCAs(DEMO_METRICS[activePeriod].openCAs);
      } else setOpenCAs(DEMO_METRICS[activePeriod].openCAs);
    } catch {
      setIncidents(DEMO_METRICS[activePeriod].incidents);
      setOpenCAs(DEMO_METRICS[activePeriod].openCAs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchMetrics(period, selectedJobsite); }, [period, selectedJobsite, fetchMetrics]);

  const demo  = DEMO_METRICS[period];
  const prior = DEMO_PRIOR[period];
  const resolvedIncidents = incidents ?? demo.incidents;
  const resolvedOpenCAs   = openCAs   ?? demo.openCAs;
  const incidentTrend: "up" | "down" = resolvedIncidents < prior.incidents ? "down" : "up";

  const metrics: MetricCard[] = [
    { label: "Total Incidents",         value: loading ? "—" : resolvedIncidents, trend: loading ? "neutral" : incidentTrend,
      trendLabel: loading ? undefined : `${Math.abs(resolvedIncidents - prior.incidents)} vs prior period`,
      trendPositive: incidentTrend === "down", icon: <BarChart3 className="w-5 h-5" />, color: "text-red-600",
      barColor: incidentTrend === "down" ? "#10b981" : "#ef4444", barPct: Math.min(100, Math.round((resolvedIncidents / 10) * 100)) },
    { label: "Open Corrective Actions", value: loading ? "—" : resolvedOpenCAs,
      trend: resolvedOpenCAs <= 10 ? "down" : resolvedOpenCAs >= 20 ? "up" : "neutral",
      trendLabel: resolvedOpenCAs <= 10 ? "Within target" : resolvedOpenCAs >= 20 ? "Above target" : "Near target",
      trendPositive: resolvedOpenCAs <= 10, icon: <FileText className="w-5 h-5" />, color: "text-amber-600",
      barColor: resolvedOpenCAs <= 10 ? "#10b981" : "#f59e0b", barPct: Math.min(100, Math.round((resolvedOpenCAs / 20) * 100)) },
    { label: "Inspection Compliance",   value: loading ? "—" : `${demo.inspectionRate}%`, trend: demo.inspectionRate >= 85 ? "up" : "down",
      trendLabel: demo.inspectionRate >= 85 ? "Above 85% target" : "Below 85% target", trendPositive: demo.inspectionRate >= 85,
      icon: <CheckSquare className="w-5 h-5" />, color: "text-blue-600", barColor: demo.inspectionRate >= 85 ? "#3b82f6" : "#ef4444", barPct: demo.inspectionRate },
    { label: "Induction Completion",    value: loading ? "—" : `${demo.inductionRate}%`, trend: demo.inductionRate >= 90 ? "up" : "down",
      trendLabel: demo.inductionRate >= 90 ? "Above 90% target" : "Below 90% target", trendPositive: demo.inductionRate >= 90,
      icon: <Users className="w-5 h-5" />, color: "text-violet-600", barColor: demo.inductionRate >= 90 ? "#8b5cf6" : "#ef4444", barPct: demo.inductionRate },
    { label: "Leading Indicator Score", value: loading ? "—" : `${demo.leadingScore}/100`, trend: demo.leadingScore >= 75 ? "up" : "down",
      trendLabel: demo.leadingScore >= 75 ? "On track" : "Needs attention", trendPositive: demo.leadingScore >= 75,
      icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-600", barColor: demo.leadingScore >= 75 ? "#10b981" : "#ef4444", barPct: demo.leadingScore },
  ];

  function toggleAgendaItem(index: number) {
    setCheckedItems(prev => { const n = new Set(prev); n.has(index) ? n.delete(index) : n.add(index); return n; });
  }

  function handleExport() {
    const exportDate = new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" });
    const jobsiteName = selectedJobsite === "all" ? "All Jobsites" : (jobsites.find(j => j.id === selectedJobsite)?.name ?? "Unknown Jobsite");
    const html = generatePresentation({
      period, jobsiteName, checkedItems, notes, exportDate,
      resolvedIncidents, resolvedOpenCAs, priorIncidents: prior.incidents,
      inspectionRate: demo.inspectionRate, inductionRate: demo.inductionRate, leadingScore: demo.leadingScore,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `management-review-deck-${period}-${new Date().toISOString().split("T")[0] ?? "export"}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  const jobsiteLabel = selectedJobsite === "all" ? "All Jobsites" : (jobsites.find(j => j.id === selectedJobsite)?.name ?? "");

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Management Review"
        subtitle="Periodic executive review of safety performance, objectives, and continuous improvement outcomes."
      />

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {(["1w", "2w", "4w", "8w", "12w"] as WeekPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cx("px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all",
                period === p ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {PERIOD_BUTTON_LABELS[p]}
            </button>
          ))}
        </div>
        {jobsites.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select value={selectedJobsite} onChange={e => setSelectedJobsite(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer">
              <option value="all">All Jobsites</option>
              {jobsites.map(j => <option key={j.id} value={j.id}>{j.name}{j.code ? ` (${j.code})` : ""}</option>)}
            </select>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 -mt-4">
        Showing <strong className="text-slate-600">{PERIOD_LABELS[period]}</strong>
        {selectedJobsite !== "all" && <> · <strong className="text-slate-600">{jobsiteLabel}</strong></>}
      </p>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Key Performance Summary"
          hint={`Safety metrics · ${PERIOD_LABELS[period].toLowerCase()}${selectedJobsite !== "all" ? ` · ${jobsiteLabel}` : ""}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
          {metrics.map(m => (
            <Card key={m.label} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={cx("p-2 rounded-lg bg-slate-50", m.color)}>{m.icon}</span>
                {m.trend && m.trend !== "neutral" && (
                  <span className={cx("flex items-center gap-1 text-xs font-medium", m.trendPositive ? "text-emerald-600" : "text-red-600")}>
                    {m.trend === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  </span>
                )}
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{m.value}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">{m.label}</div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.barPct}%`, background: m.barColor }} />
              </div>
              {m.trendLabel && (
                <div className={cx("text-xs px-2 py-0.5 rounded-full w-fit font-medium",
                  m.trendPositive ? "bg-emerald-50 text-emerald-700" : m.trend === "neutral" ? "bg-slate-50 text-slate-600" : "bg-red-50 text-red-700")}>
                  {m.trendLabel}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ── Agenda ─────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Review Agenda" hint="Standard ISO 45001 agenda — check off each item as it is discussed." />
        <Card className="mt-4 divide-y divide-slate-100">
          {AGENDA_ITEMS.map((item, i) => {
            const checked = checkedItems.has(i);
            return (
              <button key={i} onClick={() => toggleAgendaItem(i)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group">
                {checked ? <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" /> : <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400 shrink-0" />}
                <span className={cx("text-sm", checked ? "line-through text-slate-400" : "text-slate-700")}>
                  <span className="font-medium text-slate-400 mr-2">{i + 1}.</span>{item}
                </span>
              </button>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-slate-400">{checkedItems.size} of {AGENDA_ITEMS.length} agenda items completed</p>
      </section>

      {/* ── Minutes ────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Minutes &amp; Review Outcomes" hint="Record key decisions, action items, and outcomes from this management review." />
        <Card className="mt-4 p-5">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Enter meeting minutes, decisions, assigned actions, and next review date…"
            className="w-full min-h-[180px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition" />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-400">{notes.length > 0 ? `${notes.length} characters` : "No notes recorded yet"}</span>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" /> Presentation downloaded
                </span>
              )}
              <button onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors shadow-sm">
                <Save className="w-4 h-4" /> Export Presentation
              </button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
