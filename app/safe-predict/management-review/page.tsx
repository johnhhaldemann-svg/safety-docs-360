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

// ── Period config ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<WeekPeriod, string> = {
  "1w": "Last 1 Week", "2w": "Last 2 Weeks", "4w": "Last 4 Weeks",
  "8w": "Last 8 Weeks", "12w": "Last 12 Weeks",
};
const PERIOD_BUTTON_LABELS: Record<WeekPeriod, string> = {
  "1w": "1 wk", "2w": "2 wks", "4w": "4 wks", "8w": "8 wks", "12w": "12 wks",
};
const PERIOD_API_PARAM: Record<WeekPeriod, string> = {
  "1w": "7d", "2w": "14d", "4w": "30d", "8w": "60d", "12w": "90d",
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

// ── Demo KPI fallbacks ─────────────────────────────────────────────────────────

const DEMO_METRICS: Record<WeekPeriod, {
  incidents: number; openCAs: number; inspectionRate: number; inductionRate: number; leadingScore: number;
}> = {
  "1w":  { incidents: 1,  openCAs: 14, inspectionRate: 91, inductionRate: 96, leadingScore: 82 },
  "2w":  { incidents: 2,  openCAs: 14, inspectionRate: 89, inductionRate: 95, leadingScore: 80 },
  "4w":  { incidents: 3,  openCAs: 14, inspectionRate: 87, inductionRate: 94, leadingScore: 78 },
  "8w":  { incidents: 6,  openCAs: 14, inspectionRate: 84, inductionRate: 92, leadingScore: 75 },
  "12w": { incidents: 9,  openCAs: 14, inspectionRate: 83, inductionRate: 91, leadingScore: 74 },
};

// ── H1 2026 Portfolio data (demo dataset) ─────────────────────────────────────

const H1 = {
  period:    "H1 2026  ·  Dec 2025 – May 2026",
  companies: 5,
  jobsites:  11,

  incidents: {
    total: 31, incidents: 19, nearMisses: 12,
    recordable: 18, lostTime: 5, fatalities: 0, sifPotential: 4,
    daysAway: 29, daysRestricted: 39,
    closed: 29, inProgress: 2, closePct: 94,
    bySeverity: { critical: 1, high: 14, medium: 12, low: 4 },
    notable: [
      { title: "Bridge rigger – hand crush from beam shift during pick", tags: ["Recordable","Lost-time","SIF-potential"], ai: false },
      { title: "Welder – arc-flash burn to eyes",                        tags: ["Recordable","SIF-potential"],           ai: false },
      { title: "Process operator – chemical splash",                     tags: ["Recordable","SIF-potential"],           ai: false },
      { title: "Level 9 near-fall, harness arrested",                    tags: ["Near-miss","SIF-potential"],            ai: false },
      { title: "Energized 277V panel found open & unguarded",            tags: ["Near-miss","AI-flagged"],               ai: true  },
      { title: "Confined-space O₂ deficiency reading",                   tags: ["Near-miss","AI-flagged"],               ai: true  },
    ],
  },

  compliance: {
    permits: { total: 38, active: 7, closed: 30, draft: 1, expiringNext30: 0 },
    auditsPopulated: false,
    trainingPopulated: false,
  },

  risks: { total: 30, critical: 2, high: 14, moderate: 13, low: 1 },

  cas: {
    total: 54, verifiedClosed: 25, corrected: 17, open: 12, overdue: 6,
    actionedPct: 78,
    bySeverity: { critical: 8, high: 18, medium: 10, low: 18 },
  },
};

// ── SVG helpers ───────────────────────────────────────────────────────────────

function heatMapSVG(): string {
  const CELL = 58;
  const LP = 88;    // left padding for consequence labels
  const BP = 52;    // bottom padding for likelihood labels
  const TP = 8;
  const RP = 8;
  const W = LP + 5 * CELL + RP;   // 390
  const H = TP + 5 * CELL + BP;   // 350

  // [row0=C5 highest] to [row4=C1 lowest], [col0=L1 rare] to [col4=L5 almost certain]
  const COUNTS = [
    [1, 2, 0, 1, 1],
    [3, 1, 2, 0, 0],
    [0, 4, 3, 2, 0],
    [0, 0, 3, 2, 1],
    [1, 0, 0, 3, 0],
  ];
  const LEVELS = [
    ["H","H","E","E","E"],
    ["M","H","H","E","E"],
    ["L","M","H","H","E"],
    ["L","L","M","H","H"],
    ["L","L","L","M","H"],
  ] as const;
  const COL: Record<string, string> = { E:"#dc2626", H:"#f97316", M:"#f59e0b", L:"#22c55e" };
  const C_LABELS = ["Fatal","Major","Moderate","Minor","Negligible"];
  const L_LABELS = ["Rare","Unlikely","Possible","Likely","A. Certain"];

  let cells = "";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = LP + c * CELL;
      const y = TP + r * CELL;
      const lv = LEVELS[r][c];
      const cnt = COUNTS[r][c];
      const dim = cnt === 0 ? 0.28 : 1;
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${COL[lv]}" opacity="${dim}" rx="2"/>`;
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="white" stroke-width="0.8" opacity="0.4" rx="2"/>`;
      if (cnt > 0) {
        cells += `<text x="${x+CELL/2}" y="${y+CELL/2}" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="800" fill="white" font-family="Inter,system-ui,sans-serif">${cnt}</text>`;
      }
    }
  }

  const cLabels = C_LABELS.map((l, i) =>
    `<text x="${LP-6}" y="${TP+i*CELL+CELL/2}" text-anchor="end" dominant-baseline="central" font-size="10.5" font-weight="600" fill="#374151" font-family="Inter,system-ui,sans-serif">${l}</text>`
  ).join("");

  const lLabels = L_LABELS.map((l, i) =>
    `<text x="${LP+i*CELL+CELL/2}" y="${TP+5*CELL+16}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#374151" font-family="Inter,system-ui,sans-serif">${l}</text>`
  ).join("");

  const cx2 = LP - 56;
  const cy2 = TP + (5*CELL)/2;
  const axisC = `<text x="${cx2}" y="${cy2}" text-anchor="middle" font-size="10" font-weight="700" fill="#6b7280" font-family="Inter,system-ui,sans-serif" transform="rotate(-90,${cx2},${cy2})">CONSEQUENCE</text>`;
  const axisL = `<text x="${LP+(5*CELL)/2}" y="${TP+5*CELL+42}" text-anchor="middle" font-size="10" font-weight="700" fill="#6b7280" font-family="Inter,system-ui,sans-serif">LIKELIHOOD</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${cells}${cLabels}${lLabels}${axisC}${axisL}</svg>`;
}

function hBarSVG(
  items: Array<{label: string; value: number; color: string}>,
  maxVal: number, totalW: number
): string {
  const BH = 30; const GAP = 10; const LW = 80; const VW = 30;
  const BAR = totalW - LW - VW - 8;
  const H = items.length * (BH + GAP) - GAP;
  const bars = items.map((it, i) => {
    const y = i * (BH + GAP);
    const bw = Math.max(4, (it.value / maxVal) * BAR);
    return `
      <text x="${LW-6}" y="${y+BH/2}" text-anchor="end" dominant-baseline="central" font-size="12" font-weight="600" fill="#334155" font-family="Inter,system-ui,sans-serif">${it.label}</text>
      <rect x="${LW}" y="${y}" width="${BAR}" height="${BH}" fill="#f1f5f9" rx="5"/>
      <rect x="${LW}" y="${y}" width="${bw}" height="${BH}" fill="${it.color}" rx="5"/>
      <text x="${LW+BAR+6}" y="${y+BH/2}" dominant-baseline="central" font-size="13" font-weight="800" fill="${it.color}" font-family="Inter,system-ui,sans-serif">${it.value}</text>`;
  }).join("");
  return `<svg width="${totalW}" height="${H}" viewBox="0 0 ${totalW} ${H}">${bars}</svg>`;
}

function donutSVG(pct: number, color: string, label: string, sub: string, w = 130): string {
  const r = 46; const c = 2 * Math.PI * r;
  const dash = ((pct / 100) * c).toFixed(1);
  return `<svg width="${w}" height="${w}" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10"
      stroke-dasharray="${dash} ${c.toFixed(1)}" stroke-linecap="round"
      transform="rotate(-90 60 60)"/>
    <text x="60" y="55" text-anchor="middle" font-size="22" font-weight="800"
      fill="#1e293b" font-family="Inter,system-ui,sans-serif">${label}</text>
    <text x="60" y="71" text-anchor="middle" font-size="10" fill="#64748b"
      font-family="Inter,system-ui,sans-serif">${sub}</text>
  </svg>`;
}

// ── Shared slide primitives ────────────────────────────────────────────────────

const FONT = `font-family:'Inter',system-ui,-apple-system,sans-serif;`;

function slideHeader(title: string, sub: string): string {
  return `<div style="background:#0f172a;padding:20px 48px 16px;flex-shrink:0;">
    <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-.02em;${FONT}">${title}</div>
    <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;font-weight:500;${FONT}">${sub}</div>
  </div>`;
}

function slideFooter(n: number): string {
  return `<div style="position:absolute;bottom:0;left:0;right:0;background:#f8fafc;border-top:1px solid #e2e8f0;padding:7px 48px;display:flex;justify-content:space-between;">
    <span style="font-size:10px;color:#94a3b8;font-weight:500;${FONT}">SafePredict  ·  Safety & Compliance Review  ·  H1 2026  ·  CONFIDENTIAL</span>
    <span style="font-size:10px;color:#94a3b8;font-weight:500;${FONT}">${n} / 10</span>
  </div>`;
}

function ragBadge(s: "green"|"amber"|"red"): string {
  const map = { green:["#f0fdf4","#16a34a","ON TRACK"], amber:["#fffbeb","#d97706","MONITOR"], red:["#fef2f2","#dc2626","ATTENTION"] };
  const [bg,col,lbl] = map[s];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${bg};color:${col};font-size:10px;font-weight:700;letter-spacing:.07em;${FONT}">${lbl}</span>`;
}

function tagChip(tag: string, ai: boolean): string {
  const isAI = ai && tag === "AI-flagged";
  const isSIF = tag.includes("SIF");
  const isLT = tag === "Lost-time";
  const isRec = tag === "Recordable";
  const bg = isAI ? "#ede9fe" : isSIF ? "#fef2f2" : isLT ? "#fff7ed" : isRec ? "#eff6ff" : "#f1f5f9";
  const col = isAI ? "#7c3aed" : isSIF ? "#dc2626" : isLT ? "#c2410c" : isRec ? "#1d4ed8" : "#475569";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${bg};color:${col};font-size:10px;font-weight:700;margin-right:4px;${FONT}">${tag}</span>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  PRESENTATION GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

function generatePresentation(exportDate: string, checkedItems: Set<number>, notes: string): string {
  const SS = `width:1200px;min-height:675px;position:relative;display:flex;flex-direction:column;${FONT}`;

  // ── SLIDE 1 — TITLE ────────────────────────────────────────────────────────
  const s1 = `<div style="${SS}background:linear-gradient(135deg,#0f172a 0%,#0c4a6e 55%,#0369a1 100%);">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 80px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:44px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,.12);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:17px;font-weight:900;${FONT}">S</span>
        </div>
        <span style="color:rgba(255,255,255,.5);font-size:12px;font-weight:700;letter-spacing:.12em;${FONT}">SAFEPREDICT  ·  SAFETY DOCS 360</span>
      </div>
      <div style="color:rgba(255,255,255,.35);font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;margin-bottom:14px;${FONT}">ISO 45001  ·  EXECUTIVE MANAGEMENT REVIEW</div>
      <h1 style="font-size:62px;font-weight:900;color:white;line-height:1.05;margin:0 0 14px;letter-spacing:-.03em;${FONT}">Safety &amp; Compliance<br/>Review</h1>
      <p style="font-size:22px;color:rgba(255,255,255,.7);margin:0 0 52px;font-weight:600;letter-spacing:-.01em;${FONT}">H1 2026  ·  December 2025 – May 2026</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${[
          ["PORTFOLIO","5 Companies · 11 Jobsites"],
          ["SAFETY EVENTS","31 logged"],
          ["PERIOD","6 months"],
          ["REPORT DATE", exportDate],
        ].map(([l,v]) => `<div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:11px 18px;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.45);font-weight:700;margin-bottom:3px;${FONT}">${l}</div>
          <div style="font-size:15px;color:white;font-weight:700;${FONT}">${v}</div>
        </div>`).join("")}
      </div>
    </div>
    <div style="padding:16px 80px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;">
      <span style="font-size:10px;color:rgba(255,255,255,.3);font-weight:500;${FONT}">CONFIDENTIAL  ·  FOR EXECUTIVE REVIEW ONLY</span>
      <span style="font-size:10px;color:rgba(255,255,255,.3);font-weight:500;${FONT}">1 / 10</span>
    </div>
  </div>`;

  // ── SLIDE 2 — EXECUTIVE SUMMARY ────────────────────────────────────────────
  const statBox = (val: string|number, label: string, sub: string, col: string, bg: string) =>
    `<div style="flex:1;background:${bg};border-radius:12px;padding:20px 18px;display:flex;flex-direction:column;gap:4px;border:1px solid ${col}22;">
      <div style="font-size:42px;font-weight:900;color:${col};line-height:1;${FONT}">${val}</div>
      <div style="font-size:12px;font-weight:700;color:#1e293b;${FONT}">${label}</div>
      <div style="font-size:10px;color:#64748b;${FONT}">${sub}</div>
    </div>`;

  const s2 = `<div style="${SS}background:white;">
    ${slideHeader("Executive Summary","H1 2026  ·  5 Companies  ·  11 Jobsites")}
    <div style="flex:1;display:flex;flex-direction:column;padding:18px 40px 46px;gap:16px;">
      <div style="display:flex;gap:14px;">
        ${statBox(31,"Total Safety Events","19 incidents + 12 near misses","#0ea5e9","#f0f9ff")}
        ${statBox(0,"Fatalities","No fatalities this period","#10b981","#f0fdf4")}
        ${statBox(18,"Recordable Injuries","OSHA-recordable events","#f97316","#fff7ed")}
        ${statBox(5,"Lost-Time Cases","29 days away · 39 restricted","#ef4444","#fef2f2")}
        ${statBox(4,"SIF-Potential Events","Serious injury or fatality risk","#dc2626","#fef2f2")}
      </div>
      <div style="display:flex;gap:14px;flex:1;">
        <div style="flex:1.4;background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#16a34a;margin-bottom:6px;${FONT}">✅ Strong close rate</div>
          <div style="font-size:28px;font-weight:900;color:#15803d;margin-bottom:4px;${FONT}">94% closed</div>
          <div style="font-size:13px;color:#166534;font-weight:500;${FONT}">29 of 31 incidents closed. 2 remain in progress.</div>
        </div>
        <div style="flex:1.4;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#dc2626;margin-bottom:6px;${FONT}">⚠️ Action required</div>
          <div style="font-size:28px;font-weight:900;color:#991b1b;margin-bottom:4px;${FONT}">6 CAs overdue</div>
          <div style="font-size:13px;color:#7f1d1d;font-weight:500;${FONT}">6 of 54 corrective actions are overdue and need resourcing to close.</div>
        </div>
        <div style="flex:1.4;background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#ca8a04;margin-bottom:6px;${FONT}">🎯 Headline risk</div>
          <div style="font-size:28px;font-weight:900;color:#854d0e;margin-bottom:4px;${FONT}">4 SIF events</div>
          <div style="font-size:13px;color:#713f12;font-weight:500;${FONT}">4 serious-injury/fatality-potential events flagged this period. Targeted controls required.</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px;${FONT}">Biggest ask</div>
          <div style="font-size:12px;color:#334155;line-height:1.6;${FONT}">Resource to clear <strong>6 overdue CAs</strong>, verify 17 pending, and address the <strong>2 critical / 14 high risk-band items</strong>. Also: turn on training &amp; audit tracking.</div>
        </div>
      </div>
    </div>
    ${slideFooter(2)}
  </div>`;

  // ── SLIDE 3 — SAFETY SCORECARD ─────────────────────────────────────────────
  const scorecardRows = [
    ["Total Safety Events",    "31",    "19 incidents + 12 near misses",                "#0ea5e9"],
    ["Total Incidents",        "19",    "Recordable + non-recordable",                   "#3b82f6"],
    ["Near-Miss Reports",      "12",    "Near-miss : incident ratio = 0.63 : 1 (healthy)","#8b5cf6"],
    ["Recordable Injuries",    "18",    "OSHA recordable",                               "#f97316"],
    ["Lost-Time Cases",        "5",     "Cases involving days away or restricted work",  "#ef4444"],
    ["Fatalities",             "0 ✓",   "No fatal events recorded",                     "#10b981"],
    ["SIF-Potential Events",   "4",     "Serious injury or fatality potential",          "#dc2626"],
    ["Days Away From Work",    "29",    "Total across all lost-time cases",             "#f59e0b"],
    ["Days Restricted / Transfer","39", "Total restricted or transferred duties",       "#f59e0b"],
    ["Incident Close Rate",    "94%",   "29 of 31 incidents closed",                    "#10b981"],
  ];

  const s3 = `<div style="${SS}background:white;">
    ${slideHeader("Safety Performance Scorecard","H1 2026  ·  All Companies  ·  All Jobsites")}
    <div style="flex:1;display:flex;gap:0;">
      <div style="flex:1;padding:16px 32px 46px;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;${FONT}">
          <thead>
            <tr style="background:#0f172a;">
              ${["METRIC","VALUE","NOTES"].map(h => `<th style="padding:10px 14px;text-align:left;font-size:9.5px;font-weight:700;color:rgba(255,255,255,.65);letter-spacing:.1em;text-transform:uppercase;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${scorecardRows.map((r, i) => `
            <tr style="background:${i%2===0?"white":"#f8fafc"};border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 14px;font-weight:600;color:#1e293b;">${r[0]}</td>
              <td style="padding:10px 14px;font-size:18px;font-weight:900;color:${r[3]};">${r[1]}</td>
              <td style="padding:10px 14px;color:#64748b;font-size:11.5px;">${r[2]}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div style="width:280px;flex-shrink:0;background:#f8fafc;border-left:1px solid #e2e8f0;padding:20px 20px 46px;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Rate Metrics</div>
        <div style="background:#fffbeb;border:1px solid #fde047;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#854d0e;margin-bottom:6px;${FONT}">📊 TRIR &amp; DART</div>
          <div style="font-size:11px;color:#92400e;line-height:1.55;${FONT}">TRIR and DART rates require total hours worked, which is not yet in the platform. Add hours data and these calculate automatically next period.</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:6px;${FONT}">📈 Near-Miss Ratio</div>
          <div style="font-size:11px;color:#1e40af;line-height:1.55;${FONT}">12 near misses to 19 incidents = <strong>0.63 near-miss reporting ratio</strong>. A healthy leading-indicator signal. Industry best practice is ≥ 1:1.</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:6px;${FONT}">⚡ SIF Watch</div>
          <div style="font-size:11px;color:#991b1b;line-height:1.55;${FONT}">4 SIF-potential events in 6 months. Management attention and targeted controls are the priority action from this review.</div>
        </div>
      </div>
    </div>
    ${slideFooter(3)}
  </div>`;

  // ── SLIDE 4 — INCIDENT REVIEW ──────────────────────────────────────────────
  const sevBars = hBarSVG([
    { label:"Critical", value:1,  color:"#dc2626" },
    { label:"High",     value:14, color:"#f97316" },
    { label:"Medium",   value:12, color:"#f59e0b" },
    { label:"Low",      value:4,  color:"#22c55e" },
  ], 14, 280);

  const s4 = `<div style="${SS}background:white;">
    ${slideHeader("Incident Review","H1 2026  ·  31 events  ·  19 incidents  ·  12 near misses")}
    <div style="flex:1;display:flex;">
      <!-- Left: charts -->
      <div style="width:360px;flex-shrink:0;padding:18px 24px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:18px;">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:12px;${FONT}">By Severity</div>
          ${sevBars}
        </div>
        <div style="border-top:1px solid #f1f5f9;padding-top:14px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:12px;${FONT}">By Status</div>
          <div style="display:flex;gap:10px;">
            ${[
              ["29","Closed","#10b981","#f0fdf4"],
              ["2","In Progress","#3b82f6","#eff6ff"],
            ].map(([v,l,col,bg]) => `
              <div style="flex:1;background:${bg};border-radius:10px;padding:12px 14px;text-align:center;border:1px solid ${col}33;">
                <div style="font-size:32px;font-weight:900;color:${col};line-height:1;${FONT}">${v}</div>
                <div style="font-size:11px;font-weight:600;color:#334155;margin-top:4px;${FONT}">${l}</div>
              </div>`).join("")}
          </div>
          <div style="margin-top:12px;font-size:13px;font-weight:700;color:#16a34a;text-align:center;${FONT}">94% close rate</div>
        </div>
        <div style="border-top:1px solid #f1f5f9;padding-top:14px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px;${FONT}">Type Split</div>
          <div style="display:flex;gap:8px;">
            ${[["19","Incidents","#ef4444","#fef2f2"],["12","Near Misses","#8b5cf6","#f5f3ff"]].map(([v,l,c,bg]) =>
              `<div style="flex:1;background:${bg};border-radius:8px;padding:10px 12px;text-align:center;">
                <div style="font-size:26px;font-weight:900;color:${c};${FONT}">${v}</div>
                <div style="font-size:10px;font-weight:600;color:#475569;${FONT}">${l}</div>
              </div>`).join("")}
          </div>
        </div>
      </div>
      <!-- Right: notable events -->
      <div style="flex:1;padding:18px 28px 46px;display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Notable &amp; SIF-Potential Events</div>
        ${H1.incidents.notable.map((ev) => `
        <div style="padding:11px 14px;background:${ev.ai ? "#fdf4ff" : ev.tags.some(t=>t.includes("SIF")) ? "#fff7f7" : "#f8fafc"};border-radius:9px;border:1px solid ${ev.ai ? "#e9d5ff" : ev.tags.some(t=>t.includes("SIF")) ? "#fecaca" : "#e2e8f0"};">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;">
            <span style="font-size:14px;flex-shrink:0;">${ev.ai ? "🤖" : ev.tags.some(t=>t.includes("SIF")) ? "🔴" : "📋"}</span>
            <span style="font-size:12px;font-weight:600;color:#1e293b;line-height:1.4;${FONT}">${ev.title}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:2px;padding-left:22px;">${ev.tags.map(t => tagChip(t, ev.ai)).join("")}</div>
        </div>`).join("")}
        <div style="margin-top:4px;padding:10px 14px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
          <div style="font-size:11px;color:#166534;font-weight:600;${FONT}">🤖 Gus AI auto-flagged 2 of the 6 notable events above (energized panel + confined-space O₂ deficiency) before any human reported them.</div>
        </div>
      </div>
    </div>
    ${slideFooter(4)}
  </div>`;

  // ── SLIDE 5 — COMPLIANCE STATUS ────────────────────────────────────────────
  const s5 = `<div style="${SS}background:white;">
    ${slideHeader("Compliance Status","Permits  ·  Audits  ·  Training  ·  H1 2026")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Permits -->
      <div style="flex:1;padding:18px 28px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          <span style="font-size:18px;">📋</span>
          <span style="font-size:13px;font-weight:700;color:#1e293b;${FONT}">Permits to Work</span>
          ${ragBadge("green")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${[
            ["38","Total Permits","#0ea5e9","#f0f9ff"],
            ["7","Active","#3b82f6","#eff6ff"],
            ["30","Closed","#10b981","#f0fdf4"],
            ["1","Draft","#f59e0b","#fffbeb"],
          ].map(([v,l,c,bg]) => `<div style="background:${bg};border-radius:9px;padding:12px 14px;border:1px solid ${c}22;">
            <div style="font-size:28px;font-weight:900;color:${c};line-height:1;${FONT}">${v}</div>
            <div style="font-size:11px;font-weight:600;color:#475569;margin-top:3px;${FONT}">${l}</div>
          </div>`).join("")}
        </div>
        <div style="padding:10px 14px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;">
          <div style="font-size:12px;font-weight:700;color:#16a34a;${FONT}">✅ 0 permits expiring in the next 30 days</div>
        </div>
      </div>
      <!-- Audits gap -->
      <div style="width:240px;flex-shrink:0;padding:18px 22px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;background:#fafafa;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">🔍</span>
          <span style="font-size:13px;font-weight:700;color:#1e293b;${FONT}">Site Audits</span>
        </div>
        <div style="flex:1;background:#fff7ed;border:2px dashed #f97316;border-radius:10px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;">
          <div style="font-size:28px;">📭</div>
          <div style="font-size:12px;font-weight:700;color:#c2410c;${FONT}">Data Gap</div>
          <div style="font-size:11px;color:#9a3412;line-height:1.5;${FONT}">Jobsite audit records are not yet populated for this portfolio. Audit scores cannot be reported this period.</div>
        </div>
        <div style="padding:8px 12px;background:#fff7ed;border-radius:7px;border:1px solid #fed7aa;">
          <div style="font-size:10px;color:#c2410c;font-weight:600;${FONT}">▶ Recommended action: populate audit data to unlock compliance scoring next period.</div>
        </div>
      </div>
      <!-- Training gap -->
      <div style="width:240px;flex-shrink:0;padding:18px 22px 46px;display:flex;flex-direction:column;gap:12px;background:#fafafa;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">🎓</span>
          <span style="font-size:13px;font-weight:700;color:#1e293b;${FONT}">Employee Training</span>
        </div>
        <div style="flex:1;background:#fff7ed;border:2px dashed #f97316;border-radius:10px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;">
          <div style="font-size:28px;">📭</div>
          <div style="font-size:12px;font-weight:700;color:#c2410c;${FONT}">Data Gap</div>
          <div style="font-size:11px;color:#9a3412;line-height:1.5;${FONT}">Training completion records are not yet populated. Training-completion % cannot be reported this period.</div>
        </div>
        <div style="padding:8px 12px;background:#fff7ed;border-radius:7px;border:1px solid #fed7aa;">
          <div style="font-size:10px;color:#c2410c;font-weight:600;${FONT}">▶ Recommended action: populate training records to unlock compliance scoring next period.</div>
        </div>
      </div>
    </div>
    ${slideFooter(5)}
  </div>`;

  // ── SLIDE 6 — RISK HEAT MAP ────────────────────────────────────────────────
  const hm = heatMapSVG();
  const s6 = `<div style="${SS}background:white;">
    ${slideHeader("Risk Matrix — Portfolio Overview","30 scored risk items  ·  All jobsites  ·  H1 2026")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Heat map -->
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px 16px 46px;">
        ${hm}
      </div>
      <!-- Right panel -->
      <div style="width:330px;flex-shrink:0;padding:18px 24px 46px;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Risk Band Summary</div>
        ${[
          ["2","Critical / Extreme","Top-right cells — immediate controls required","#dc2626","#fef2f2"],
          ["14","High","Orange band — targeted risk treatment needed","#f97316","#fff7ed"],
          ["13","Moderate","Amber band — manage &amp; monitor","#f59e0b","#fffbeb"],
          ["1","Low","Green band — accept with periodic review","#22c55e","#f0fdf4"],
        ].map(([v,l,d,c,bg]) => `
        <div style="background:${bg};border-radius:10px;padding:12px 14px;border:1px solid ${c}33;display:flex;align-items:center;gap:12px;">
          <div style="font-size:32px;font-weight:900;color:${c};line-height:1;min-width:44px;${FONT}">${v}</div>
          <div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;${FONT}">${l}</div>
            <div style="font-size:10px;color:#64748b;line-height:1.4;${FONT}">${d}</div>
          </div>
        </div>`).join("")}
        <div style="margin-top:4px;padding:11px 14px;background:#fef2f2;border-radius:9px;border:1px solid #fca5a5;">
          <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:4px;${FONT}">🔴 Key finding</div>
          <div style="font-size:11px;color:#991b1b;line-height:1.5;${FONT}">16 of 30 items (53%) sit in the high/critical band. This is the visual that drives the resourcing ask in Slide 8.</div>
        </div>
        <div style="padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="font-size:10px;color:#475569;${FONT}">Matrix: AS/NZS 4801 · ISO 45001 standard. Bubble numbers = count of risk items per cell.</div>
        </div>
      </div>
    </div>
    ${slideFooter(6)}
  </div>`;

  // ── SLIDE 7 — CORRECTIVE ACTIONS ───────────────────────────────────────────
  const caStatusBars = hBarSVG([
    { label:"Verified closed", value:25, color:"#10b981" },
    { label:"Corrected",       value:17, color:"#3b82f6" },
    { label:"Open",            value:12, color:"#f59e0b" },
    { label:"Overdue",         value:6,  color:"#dc2626" },
  ], 25, 300);

  const caSevBars = hBarSVG([
    { label:"Critical", value:8,  color:"#dc2626" },
    { label:"High",     value:18, color:"#f97316" },
    { label:"Medium",   value:10, color:"#f59e0b" },
    { label:"Low",      value:18, color:"#22c55e" },
  ], 18, 300);

  const s7 = `<div style="${SS}background:white;">
    ${slideHeader("Corrective Action Management","54 total  ·  H1 2026  ·  All jobsites")}
    <div style="flex:1;display:flex;">
      <!-- Big number -->
      <div style="width:220px;flex-shrink:0;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:12px;border-right:1px solid rgba(255,255,255,.08);">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.45);text-align:center;${FONT}">TOTAL<br/>CORRECTIVE ACTIONS</div>
        <div style="font-size:86px;font-weight:900;line-height:1;color:#f59e0b;${FONT}">54</div>
        <div style="padding:6px 14px;background:rgba(245,158,11,.15);border-radius:20px;border:1px solid rgba(245,158,11,.3);">
          <span style="font-size:12px;font-weight:700;color:#fbbf24;${FONT}">78% actioned</span>
        </div>
        <div style="margin-top:4px;text-align:center;font-size:11px;color:rgba(255,255,255,.4);line-height:1.5;${FONT}">42 of 54 actioned.<br/>Verification &amp; overdue<br/>closure is the bottleneck.</div>
      </div>
      <!-- Status breakdown -->
      <div style="flex:1;padding:18px 24px 46px;display:flex;flex-direction:column;gap:18px;">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:12px;${FONT}">By Status</div>
          ${caStatusBars}
        </div>
        <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:12px;${FONT}">By Severity</div>
          ${caSevBars}
        </div>
      </div>
      <!-- Story panel -->
      <div style="width:280px;flex-shrink:0;padding:18px 20px 46px;background:#f8fafc;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">The Story</div>
        ${[
          ["✅","25 verified closed","Fully closed and verified — 46% of total","#f0fdf4","#16a34a"],
          ["🔵","17 corrected","Fix done but not yet independently verified — bottleneck","#eff6ff","#1d4ed8"],
          ["🟡","12 still open","Active, in progress or not yet started","#fffbeb","#92400e"],
          ["🔴","6 overdue","Past due date — management escalation required","#fef2f2","#991b1b"],
        ].map(([ic,t,d,bg,c]) => `
        <div style="background:${bg};border-radius:9px;padding:10px 12px;">
          <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:3px;${FONT}">${ic} ${t}</div>
          <div style="font-size:10px;color:${c};line-height:1.45;${FONT}">${d}</div>
        </div>`).join("")}
        <div style="margin-top:4px;padding:10px 12px;background:#fef9c3;border-radius:8px;border:1px solid #fde047;">
          <div style="font-size:10px;color:#854d0e;font-weight:600;line-height:1.5;${FONT}">Critical CAs (8) include the SIF-related bridge-rigger, arc-flash and chemical-splash incidents. Prioritise these for closure.</div>
        </div>
      </div>
    </div>
    ${slideFooter(7)}
  </div>`;

  // ── SLIDE 8 — ASKS / DECISIONS NEEDED ─────────────────────────────────────
  const asks = [
    {
      letter:"a",
      title:"Resource to clear overdue corrective actions",
      body:`<strong>6 overdue CAs</strong> require owner assignment and expedited closure. Additionally, <strong>17 CAs marked 'corrected'</strong> need independent verification before they can be closed. Recommend assigning a dedicated resource or setting a 2-week sprint to work through the backlog.`,
      color:"#dc2626", bg:"#fef2f2", border:"#fca5a5",
    },
    {
      letter:"b",
      title:"Targeted controls for the high/critical risk band",
      body:`<strong>2 critical and 14 high risk-band items</strong> (53% of all scored work) require active risk treatment — not just monitoring. Management should approve specific control measures for the SIF-potential hazard types: hand/crush during lifts, arc flash, chemical exposure, and working at height. Assign accountability and due dates today.`,
      color:"#f97316", bg:"#fff7ed", border:"#fed7aa",
    },
    {
      letter:"c",
      title:"Turn on training &amp; audit tracking",
      body:`Training completion records and jobsite audit scores are <strong>not yet populated</strong> in the platform. These are standard ISO 45001 compliance metrics. Until they are loaded, this review cannot report on two key performance indicators. Assign data-entry ownership and set a deadline before the next review.`,
      color:"#f59e0b", bg:"#fffbeb", border:"#fde047",
    },
  ];

  const s8 = `<div style="${SS}background:white;">
    ${slideHeader("Asks &amp; Decisions Required","Three specific actions needed from this review")}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:20px 48px 46px;gap:18px;">
      ${asks.map(a => `
      <div style="background:${a.bg};border:1px solid ${a.border};border-radius:12px;padding:18px 22px;display:flex;gap:18px;align-items:flex-start;">
        <div style="width:42px;height:42px;background:${a.color};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:20px;font-weight:900;color:white;${FONT}">${a.letter}</span>
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:#1e293b;margin-bottom:6px;${FONT}">${a.title}</div>
          <div style="font-size:12px;color:#334155;line-height:1.65;${FONT}">${a.body}</div>
        </div>
      </div>`).join("")}
      <div style="padding:12px 18px;background:#f0fdf4;border-radius:10px;border:1px solid #86efac;display:flex;align-items:center;gap:10px;">
        <span style="font-size:16px;">✅</span>
        <span style="font-size:12px;color:#166534;font-weight:600;${FONT}">Each ask is tied to specific numbers. Decisions and owners should be recorded in the minutes (Slide 9) before this meeting closes.</span>
      </div>
    </div>
    ${slideFooter(8)}
  </div>`;

  // ── SLIDE 9 — OPEN ISSUES & GAPS ──────────────────────────────────────────
  const sGaps = `<div style="${SS}background:white;">
    ${slideHeader("Open Issues &amp; Critical Gaps","H1 2026  ·  What needs immediate attention")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Left: Top 5 gaps -->
      <div style="flex:1.1;padding:16px 22px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#dc2626;margin-bottom:2px;${FONT}">🚩 Top 5 Gaps — What We Are Lacking</div>
        ${[
          {n:"1",title:"Training records not loaded",body:"Employee training completion is entirely absent. ISO 45001 §7.2 compliance cannot be demonstrated until data is populated.",col:"#dc2626",bg:"#fef2f2",bdr:"#fca5a5"},
          {n:"2",title:"Site audit data missing",body:"No jobsite audit scores recorded this period. Compliance rate reports as zero — this is a data gap, not zero performance.",col:"#f97316",bg:"#fff7ed",bdr:"#fed7aa"},
          {n:"3",title:"6 corrective actions overdue",body:"Past-due CAs linked to recordable and SIF-potential events. Each day unresolved increases re-injury risk at affected sites.",col:"#f97316",bg:"#fff7ed",bdr:"#fed7aa"},
          {n:"4",title:"Hours worked not tracked",body:"TRIR and DART rates cannot be calculated. Without total hours, industry benchmarking is impossible.",col:"#f59e0b",bg:"#fffbeb",bdr:"#fde047"},
          {n:"5",title:"SIF controls unverified",body:"4 SIF-potential events logged; engineered control implementation has not been formally verified or documented in the system.",col:"#7c3aed",bg:"#faf5ff",bdr:"#e9d5ff"},
        ].map(g => `
        <div style="background:${g.bg};border:1px solid ${g.bdr};border-radius:9px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start;">
          <div style="width:24px;height:24px;background:${g.col};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:11px;font-weight:900;color:white;${FONT}">${g.n}</span>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:2px;${FONT}">${g.title}</div>
            <div style="font-size:10px;color:#475569;line-height:1.45;${FONT}">${g.body}</div>
          </div>
        </div>`).join("")}
      </div>
      <!-- Center: Incident & near-miss summaries -->
      <div style="flex:1;padding:16px 20px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:2px;${FONT}">📋 Key Injuries &amp; Near-Miss Summaries</div>
        ${H1.incidents.notable.map((ev) => `
        <div style="padding:8px 10px;background:${ev.ai?"#fdf4ff":ev.tags.some(t=>t.includes("SIF"))?"#fff7f7":"#f8fafc"};border-radius:8px;border:1px solid ${ev.ai?"#e9d5ff":ev.tags.some(t=>t.includes("SIF"))?"#fecaca":"#e2e8f0"};display:flex;gap:7px;align-items:flex-start;">
          <span style="font-size:12px;flex-shrink:0;margin-top:1px;">${ev.ai?"🤖":ev.tags.some(t=>t.includes("SIF"))?"🔴":"📋"}</span>
          <div>
            <div style="font-size:11px;font-weight:600;color:#1e293b;line-height:1.35;margin-bottom:3px;${FONT}">${ev.title}</div>
            <div style="display:flex;flex-wrap:wrap;gap:2px;">${ev.tags.map(t=>tagChip(t,ev.ai)).join("")}</div>
          </div>
        </div>`).join("")}
        <div style="margin-top:2px;padding:8px 10px;background:#f0fdf4;border-radius:7px;border:1px solid #bbf7d0;">
          <div style="font-size:10px;color:#166534;font-weight:600;${FONT}">🤖 2 events AI-detected before human report — Gus auto-flagged the open panel &amp; O₂ deficiency.</div>
        </div>
      </div>
      <!-- Right: Upcoming high-risk activities -->
      <div style="width:290px;flex-shrink:0;padding:16px 20px 46px;background:#f8fafc;display:flex;flex-direction:column;gap:9px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7c3aed;margin-bottom:2px;${FONT}">⚡ Upcoming High-Risk Activities</div>
        ${[
          {icon:"🏗️",title:"Crane lifts &amp; rigging",risk:"HIGH",body:"H1 hand-crush SIF event. Verify lift plans, exclusion zones, and rigger competencies before every pick.",col:"#dc2626",bg:"#fef2f2",bdr:"#fca5a5"},
          {icon:"⚡",title:"Energised electrical work",risk:"HIGH",body:"Open 277V panel + arc-flash burn recorded H1. LOTO mandatory; PPE sign-offs required before all energised work.",col:"#f97316",bg:"#fff7ed",bdr:"#fed7aa"},
          {icon:"🌬️",title:"Confined space entries",risk:"HIGH",body:"O₂ deficiency reading recorded H1. Atmospheric testing and trained standby rescuer mandatory for every entry.",col:"#f97316",bg:"#fff7ed",bdr:"#fed7aa"},
          {icon:"🧪",title:"Chemical handling",risk:"MEDIUM",body:"Process operator splash recorded H1. Review SDS access, PPE adequacy, and emergency eyewash station locations.",col:"#f59e0b",bg:"#fffbeb",bdr:"#fde047"},
          {icon:"🪜",title:"Working at height",risk:"MEDIUM",body:"Level 9 near-fall harness-arrested H1. Edge-protection and pre-use harness inspection required before each task.",col:"#f59e0b",bg:"#fffbeb",bdr:"#fde047"},
        ].map(a=>`
        <div style="background:${a.bg};border:1px solid ${a.bdr};border-radius:9px;padding:9px 11px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="font-size:13px;">${a.icon}</span>
            <span style="font-size:11px;font-weight:700;color:#1e293b;flex:1;${FONT}">${a.title}</span>
            <span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:10px;background:${a.col}22;color:${a.col};${FONT}">${a.risk}</span>
          </div>
          <div style="font-size:10px;color:#475569;line-height:1.45;padding-left:19px;${FONT}">${a.body}</div>
        </div>`).join("")}
      </div>
    </div>
    ${slideFooter(9)}
  </div>`;

  // ── SLIDE 10 — NEXT STEPS & CLOSE ──────────────────────────────────────────
  const priorities = [
    { icon:"🔴", title:"SIF prevention — immediate",
      body:"Conduct targeted reviews of the four SIF hazard types flagged this period: hand/crush during crane picks, arc flash, chemical exposure, and work-at-height. Implement or verify engineered controls before next period." },
    { icon:"📋", title:"Weekly overdue-CA review",
      body:"Establish a weekly standing agenda item to review the 6 overdue (and 17 pending-verification) corrective actions until the backlog is cleared. Assign a CA owner for each item today." },
    { icon:"📊", title:"Populate hours worked",
      body:"Log total hours worked per period in SafePredict to unlock TRIR and DART rate calculations automatically. Without this data, rate-based benchmarking cannot be reported." },
    { icon:"🎓", title:"Load training &amp; audit records",
      body:"Populate jobsite audit scores and employee training-completion records before the next management review. These are mandatory ISO 45001 metrics currently showing as data gaps." },
  ];

  const s9 = `<div style="${SS}background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0c4a6e 100%);">
    <div style="background:rgba(14,165,233,.12);border-bottom:1px solid rgba(14,165,233,.2);padding:20px 48px 16px;flex-shrink:0;">
      <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-.02em;${FONT}">Next Steps &amp; Priorities</div>
      <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;font-weight:500;${FONT}">Actions to carry forward from this review</div>
    </div>
    <div style="flex:1;display:flex;gap:0;">
      <div style="flex:1;padding:18px 28px;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:start;">
        ${priorities.map(p => `
        <div style="padding:15px 17px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;">
          <div style="font-size:18px;margin-bottom:7px;">${p.icon}</div>
          <div style="font-size:12px;font-weight:700;color:white;margin-bottom:5px;${FONT}">${p.title}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.6);line-height:1.55;${FONT}">${p.body}</div>
        </div>`).join("")}
      </div>
      <div style="width:300px;flex-shrink:0;padding:18px 22px;display:flex;flex-direction:column;gap:12px;border-left:1px solid rgba(255,255,255,.1);">
        <div style="padding:16px;background:rgba(255,255,255,.06);border-radius:10px;border:1px solid rgba(255,255,255,.1);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.35);font-weight:700;margin-bottom:10px;${FONT}">This Review — At a Glance</div>
          ${[
            ["Period","H1 2026 (Dec–May)"],
            ["Events",`${H1.incidents.total} (${H1.incidents.incidents} inc + ${H1.incidents.nearMisses} nm)`],
            ["Recordable",`${H1.incidents.recordable} · LT: ${H1.incidents.lostTime} · Fatal: ${H1.incidents.fatalities}`],
            ["SIF-Potential",`${H1.incidents.sifPotential} events flagged`],
            ["CAs",`${H1.cas.total} total · ${H1.cas.overdue} overdue`],
            ["Close Rate",`${H1.incidents.closePct}% (${H1.incidents.closed}/${H1.incidents.total})`],
            ["Risk Items",`${H1.risks.total} — ${H1.risks.critical}C / ${H1.risks.high}H / ${H1.risks.moderate}M`],
            ["Agenda",`${checkedItems.size}/${AGENDA_ITEMS.length} items reviewed`],
          ].map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="font-size:10px;color:rgba(255,255,255,.4);${FONT}">${k}</span>
            <span style="font-size:10px;font-weight:700;color:white;${FONT}">${v}</span>
          </div>`).join("")}
        </div>
        <div style="padding:12px 14px;background:rgba(245,158,11,.12);border-radius:9px;border:1px solid rgba(245,158,11,.3);">
          <div style="font-size:10px;font-weight:700;color:#fbbf24;margin-bottom:5px;${FONT}">⚠️ Dataset caveat</div>
          <div style="font-size:10px;color:rgba(255,255,255,.55);line-height:1.55;${FONT}">This report is built on the SafePredict demo dataset. Training and audit figures are blank because those tables are not yet populated — treat those sections as <em>data gap</em>, not <em>zero performance</em>.</div>
        </div>
      </div>
    </div>
    <div style="padding:10px 48px;border-top:1px solid rgba(255,255,255,.07);display:flex;justify-content:space-between;">
      <span style="font-size:10px;color:rgba(255,255,255,.25);${FONT}">Generated by SafePredict · Safety Docs 360 · ${exportDate} · Confidential</span>
      <span style="font-size:10px;color:rgba(255,255,255,.25);${FONT}">10 / 10</span>
    </div>
  </div>`;

  // ── NOTES SLIDE (only appended if notes entered) ──────────────────────────
  const notesSlide = notes.trim() ? `
  <div style="${SS}background:white;">
    ${slideHeader("Meeting Notes &amp; Minutes", exportDate)}
    <div style="flex:1;padding:22px 48px 46px;display:flex;flex-direction:column;gap:12px;overflow:hidden;">
      <div style="flex:1;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:16px;font-size:12px;color:#334155;line-height:1.75;white-space:pre-wrap;overflow:auto;${FONT}">${notes.trim()}</div>
    </div>
    ${slideFooter(11)}
  </div>` : "";

  // ── FULL HTML ──────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SafePredict — Management Review — H1 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#1e293b;font-family:'Inter',system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{padding:32px;display:flex;flex-direction:column;align-items:center;gap:32px;}
.slide{width:1200px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;}
@media print{
  html,body{background:white;padding:0;gap:0;}
  @page{size:landscape;margin:0;}
  .slide{width:100%;height:100vh;min-height:unset;overflow:hidden;border-radius:0;box-shadow:none;page-break-after:always;}
}
</style>
</head>
<body>
  <div class="slide">${s1}</div>
  <div class="slide">${s2}</div>
  <div class="slide">${s3}</div>
  <div class="slide">${s4}</div>
  <div class="slide">${s5}</div>
  <div class="slide">${s6}</div>
  <div class="slide">${s7}</div>
  <div class="slide">${s8}</div>
  <div class="slide">${sGaps}</div>
  <div class="slide">${s9}</div>
  ${notes.trim() ? `<div class="slide">${notesSlide}</div>` : ""}
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
        else if (data && typeof data === "object" && "jobsites" in data && Array.isArray((data as { jobsites: Jobsite[] }).jobsites))
          setJobsites((data as { jobsites: Jobsite[] }).jobsites);
      } catch { /* silent */ }
    }
    void loadJobsites();
  }, []);

  const fetchMetrics = useCallback(async (p: WeekPeriod, site: string) => {
    setLoading(true);
    const param = PERIOD_API_PARAM[p];
    const siteQ = site !== "all" ? `&jobsiteId=${site}` : "";
    try {
      const headers = await getAuthHeaders();
      const incRes = await fetch(`/api/company/incidents?period=${param}${siteQ}`, { headers });
      if (incRes.ok) {
        const d = (await incRes.json()) as { incidents?: unknown[] } | unknown[];
        setIncidents(Array.isArray(d) ? d.length : Array.isArray((d as { incidents?: unknown[] }).incidents) ? (d as { incidents: unknown[] }).incidents.length : DEMO_METRICS[p].incidents);
      } else setIncidents(DEMO_METRICS[p].incidents);
      const caRes = await fetch(`/api/company/corrective-actions?status=open${siteQ}`, { headers });
      if (caRes.ok) {
        const d = (await caRes.json()) as { corrective_actions?: unknown[] } | unknown[];
        setOpenCAs(Array.isArray(d) ? d.length : Array.isArray((d as { corrective_actions?: unknown[] }).corrective_actions) ? (d as { corrective_actions: unknown[] }).corrective_actions.length : DEMO_METRICS[p].openCAs);
      } else setOpenCAs(DEMO_METRICS[p].openCAs);
    } catch {
      setIncidents(DEMO_METRICS[p].incidents);
      setOpenCAs(DEMO_METRICS[p].openCAs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchMetrics(period, selectedJobsite); }, [period, selectedJobsite, fetchMetrics]);

  const demo = DEMO_METRICS[period];
  const resolvedIncidents = incidents ?? demo.incidents;
  const resolvedOpenCAs   = openCAs   ?? demo.openCAs;

  const KPI_CARDS = [
    { label:"Total Incidents",         value: loading ? "—" : resolvedIncidents,      icon:<BarChart3 className="w-5 h-5"/>,  color:"text-red-600",     bar:"#ef4444", pct: Math.min(100,resolvedIncidents*8) },
    { label:"Open Corrective Actions", value: loading ? "—" : resolvedOpenCAs,         icon:<FileText className="w-5 h-5"/>,   color:"text-amber-600",   bar:"#f59e0b", pct: Math.min(100,Math.round((resolvedOpenCAs/20)*100)) },
    { label:"Inspection Compliance",   value: loading ? "—" : `${demo.inspectionRate}%`, icon:<CheckSquare className="w-5 h-5"/>, color:"text-blue-600",  bar:"#3b82f6", pct: demo.inspectionRate },
    { label:"Induction Completion",    value: loading ? "—" : `${demo.inductionRate}%`,  icon:<Users className="w-5 h-5"/>,      color:"text-violet-600", bar:"#8b5cf6", pct: demo.inductionRate },
    { label:"Leading Indicator Score", value: loading ? "—" : `${demo.leadingScore}/100`, icon:<TrendingUp className="w-5 h-5"/>, color:"text-emerald-600", bar:"#10b981", pct: demo.leadingScore },
  ];

  function toggleItem(i: number) {
    setCheckedItems(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function handleExport() {
    const exportDate = new Date().toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" });
    const html = generatePresentation(exportDate, checkedItems, notes);
    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `safepredict-review-h1-2026-${new Date().toISOString().split("T")[0] ?? "export"}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  const jobsiteLabel = selectedJobsite === "all" ? "All Jobsites" : (jobsites.find(j => j.id === selectedJobsite)?.name ?? "");

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Management Review"
        subtitle="H1 2026 executive safety performance review — 5 companies · 11 jobsites · ISO 45001"
      />

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {(["1w","2w","4w","8w","12w"] as WeekPeriod[]).map(p => (
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
        Page KPIs showing <strong className="text-slate-600">{PERIOD_LABELS[period]}</strong>
        {selectedJobsite !== "all" && <> · <strong className="text-slate-600">{jobsiteLabel}</strong></>}
        {" · "}Export always produces the full H1 2026 portfolio review.
      </p>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Period KPI Summary"
          hint={`Live metrics · ${PERIOD_LABELS[period].toLowerCase()}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
          {KPI_CARDS.map(m => (
            <Card key={m.label} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={cx("p-2 rounded-lg bg-slate-50", m.color)}>{m.icon}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{m.value}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">{m.label}</div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width:`${m.pct}%`, background:m.bar }} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Agenda ─────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Review Agenda"
          hint="ISO 45001 agenda — check off items as discussed. Completion state exports into the deck." />
        <Card className="mt-4 divide-y divide-slate-100">
          {AGENDA_ITEMS.map((item, i) => {
            const checked = checkedItems.has(i);
            return (
              <button key={i} onClick={() => toggleItem(i)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group">
                {checked
                  ? <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                  : <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400 shrink-0" />}
                <span className={cx("text-sm", checked ? "line-through text-slate-400" : "text-slate-700")}>
                  <span className="font-medium text-slate-400 mr-2">{i + 1}.</span>{item}
                </span>
              </button>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-slate-400">{checkedItems.size} of {AGENDA_ITEMS.length} items completed</p>
      </section>

      {/* ── Minutes ────────────────────────────────────────────────────────── */}
      <section>
        <SectionTitle title="Minutes &amp; Outcomes"
          hint="Notes entered here appear on a bonus slide at the end of the exported presentation." />
        <Card className="mt-4 p-5">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Enter meeting minutes, decisions, assigned actions, and next review date…"
            className="w-full min-h-[160px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 transition" />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-400">{notes.length > 0 ? `${notes.length} characters · will appear as a bonus slide` : "No notes yet"}</span>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" /> Deck downloaded
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
