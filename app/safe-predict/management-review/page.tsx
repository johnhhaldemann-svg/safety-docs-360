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

// ── Export slug — update each new review period ───────────────────────────────

const REVIEW_SLUG = "h1-2026";

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

// ── H2 2025 comparison dataset (prior period) ─────────────────────────────────

const H2_PREV = {
  period: "H2 2025  ·  Jun 2025 – Nov 2025",
  incidents: {
    total: 38, incidents: 24, nearMisses: 14,
    recordable: 22, lostTime: 8, fatalities: 0, sifPotential: 6,
    closed: 33, closePct: 87,
    bySeverity: { critical: 3, high: 18, medium: 13, low: 4 },
  },
  cas: { total: 46, overdue: 9, actionedPct: 68 },
};

// ── Previous review actions (H2 2025 review) ──────────────────────────────────

const PREV_ACTIONS = [
  { ref:"A1", action:"Mandatory pre-task hazard assessments at all crane/lifting operations", owner:"Site Managers", due:"Feb 2026", status:"closed" as const },
  { ref:"A2", action:"Chemical handling refresher training — all process operators", owner:"Safety Team", due:"Jan 2026", status:"carried" as const },
  { ref:"A3", action:"Confined space procedure review and re-issue to all sites", owner:"HSE Manager", due:"Dec 2025", status:"closed" as const },
  { ref:"A4", action:"Establish monthly corrective action close-out review cadence", owner:"Operations Mgr", due:"Jan 2026", status:"partial" as const },
  { ref:"A5", action:"Load total hours-worked data into SafePredict for rate reporting", owner:"HR / Payroll", due:"Mar 2026", status:"carried" as const },
  { ref:"A6", action:"Deploy SafePredict platform to 2 additional portfolio companies", owner:"CEO / IT", due:"Mar 2026", status:"closed" as const },
];

// ── Site-level performance data ────────────────────────────────────────────────

const SITES = [
  { name:"Riverside Bridge Project",    company:"Bridgeworks Co.",    events:7, incidents:5, nearMisses:2, sif:2, overdueCAs:2, risk:"critical" as const },
  { name:"Southgate Industrial",        company:"Southgate Ind.",     events:5, incidents:3, nearMisses:2, sif:1, overdueCAs:2, risk:"high" as const },
  { name:"Metro Rail — Package C",      company:"Metro Civil Grp.",   events:4, incidents:3, nearMisses:1, sif:1, overdueCAs:1, risk:"high" as const },
  { name:"Harbour Precinct Dev.",       company:"Harbour Build.",     events:4, incidents:2, nearMisses:2, sif:0, overdueCAs:1, risk:"high" as const },
  { name:"Western Terminal",            company:"Western Logistics",  events:3, incidents:2, nearMisses:1, sif:0, overdueCAs:0, risk:"medium" as const },
  { name:"Greenfield Chemical Plant",   company:"Southgate Ind.",     events:3, incidents:2, nearMisses:1, sif:0, overdueCAs:0, risk:"medium" as const },
  { name:"North Park Utilities",        company:"Bridgeworks Co.",    events:2, incidents:1, nearMisses:1, sif:0, overdueCAs:0, risk:"medium" as const },
  { name:"CBD Tower A",                 company:"Metro Civil Grp.",   events:1, incidents:1, nearMisses:0, sif:0, overdueCAs:0, risk:"low" as const },
  { name:"Eastern Logistics Hub",       company:"Western Logistics",  events:1, incidents:0, nearMisses:1, sif:0, overdueCAs:0, risk:"low" as const },
  { name:"Coastal Treatment Works",     company:"Harbour Build.",     events:1, incidents:1, nearMisses:0, sif:0, overdueCAs:0, risk:"low" as const },
  { name:"Airport Ground Services",     company:"Western Logistics",  events:0, incidents:0, nearMisses:0, sif:0, overdueCAs:0, risk:"clear" as const },
];

// ── Objectives & targets data ─────────────────────────────────────────────────

const OBJECTIVES = [
  { obj:"Zero fatalities",                       target:"0",      actual:"0",    status:"met"    as const, note:"No fatal events recorded — target held" },
  { obj:"Recordable injuries ↓15% vs H2 2025",  target:"≤19",    actual:"18",   status:"met"    as const, note:"Was 22 in H2 2025 — target achieved" },
  { obj:"Lost-time cases ↓ vs H2 2025",         target:"≤6",     actual:"5",    status:"met"    as const, note:"Was 8 in H2 2025 — target achieved" },
  { obj:"Incident close rate",                   target:"≥90%",   actual:"94%",  status:"met"    as const, note:"Strong performance — above target" },
  { obj:"SIF-potential events",                  target:"≤2",     actual:"4",    status:"missed" as const, note:"Remains priority area — targeted controls required H2" },
  { obj:"Overdue corrective actions",            target:"≤5",     actual:"6",    status:"watch"  as const, note:"Improved (9→6) but target of ≤5 not hit" },
  { obj:"Near-miss reporting ratio",             target:"≥1.0",   actual:"0.63", status:"watch"  as const, note:"Trending right, below ≥1:1 industry target" },
  { obj:"Site inspection completion",            target:"≥90%",   actual:"85%",  status:"watch"  as const, note:"5 sites below target — improve monitoring cadence" },
  { obj:"Training completion",                   target:"≥95%",   actual:"N/A",  status:"gap"    as const, note:"Data not yet loaded into platform" },
  { obj:"Site audit completion",                 target:"4/site", actual:"N/A",  status:"gap"    as const, note:"Audit records not yet populated" },
];

// ── Legal & regulatory data ────────────────────────────────────────────────────

const LEGAL = {
  jurisdiction: "Australia — Work Health & Safety Act 2011 (model law)",
  noEnforcementNotices: true,
  certifications: [
    { name:"ISO 45001:2018", status:"In maintenance", expiry:"Nov 2026", ok:true  },
    { name:"ISO 9001:2015",  status:"In maintenance", expiry:"Mar 2027", ok:true  },
    { name:"WHS Licence",    status:"Current",        expiry:"Jan 2027", ok:true  },
  ],
  updates: [
    { date:"Jan 2026", item:"Safe Work Australia published updated guidance on plant & equipment inspection frequencies.", action:"Review and update internal procedures", due:"Q3 2026", status:"in-progress" as const },
    { date:"Feb 2026", item:"State regulator revised confined space code of practice — updated atmospheric monitoring requirements.", action:"Update site procedures and retrain affected personnel", due:"Q2 2026", status:"overdue" as const },
    { date:"Apr 2026", item:"WHS Regulations amendment — fall-protection requirements for work at heights below 2m clarified.", action:"Verify all edge-protection risk assessments reference updated standard", due:"Q3 2026", status:"pending" as const },
  ],
  upcoming: [
    "Q3 2026 — New confined space regulations take effect (refer Feb 2026 update above)",
    "Q4 2026 — Mandatory psychosocial hazard risk assessment requirements effective",
  ],
};

// ── Leading indicators data ────────────────────────────────────────────────────

const LEADING = {
  inspections:     { completed: 47, target: 55, pct: 85 },
  toolboxTalks:    { completed: 124, target: 140, pct: 89 },
  hazardReports:   { completed: 38, target: 50, pct: 76 },
  nearMissRate:    { value: 0.63, benchmark: 1.0 },
  safetyObs:       { completed: 203, target: 180, pct: 113 },
  preTaskRAs:      { completed: 312, target: 300, pct: 104 },
  stopWorkOrders:  { issued: 3 },
  prevPeriod: {
    inspections: 79, toolboxTalks: 89, hazardReports: 28, safetyObs: 156, preTaskRAs: 271,
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
    <span style="font-size:10px;color:#94a3b8;font-weight:500;${FONT}">${n} / 16</span>
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

function generatePresentation(exportDate: string, checkedItems: Set<number>, notes: string, autoPrint = false): string {
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
      <span style="font-size:10px;color:rgba(255,255,255,.3);font-weight:500;${FONT}">1 / 16</span>
    </div>
  </div>`;

  // ── SLIDE 2 — PREVIOUS REVIEW ACTION CLOSEOUT ────────────────────────────────
  const statusCfg = {
    closed:  { bg:"#f0fdf4", col:"#16a34a", bdr:"#86efac", label:"CLOSED" },
    partial: { bg:"#fffbeb", col:"#d97706", bdr:"#fde047", label:"PARTIAL" },
    carried: { bg:"#fef2f2", col:"#dc2626", bdr:"#fca5a5", label:"CARRIED FWD" },
  } as const;
  const closedCount  = PREV_ACTIONS.filter(a => a.status === "closed").length;
  const partialCount = PREV_ACTIONS.filter(a => a.status === "partial").length;
  const carriedCount = PREV_ACTIONS.filter(a => a.status === "carried").length;

  const sPrevReview = `<div style="${SS}background:white;">
    ${slideHeader("Previous Review — Action Closeout","H2 2025 management review  ·  Status at H1 2026 review date")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Action table -->
      <div style="flex:1;padding:16px 32px 46px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;${FONT}">
          <thead>
            <tr style="background:#0f172a;">
              ${["REF","ACTION","OWNER","DUE","STATUS"].map(h=>`<th style="padding:9px 12px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.1em;text-transform:uppercase;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${PREV_ACTIONS.map((a,i)=>{
              const cfg = statusCfg[a.status];
              return `<tr style="background:${i%2===0?"white":"#f8fafc"};border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 12px;font-size:11px;font-weight:800;color:#64748b;">${a.ref}</td>
                <td style="padding:10px 12px;font-weight:500;color:#1e293b;max-width:380px;">${a.action}</td>
                <td style="padding:10px 12px;color:#64748b;font-size:11px;white-space:nowrap;">${a.owner}</td>
                <td style="padding:10px 12px;color:#64748b;font-size:11px;white-space:nowrap;">${a.due}</td>
                <td style="padding:10px 12px;">
                  <span style="display:inline-block;padding:3px 9px;border-radius:20px;background:${cfg.bg};color:${cfg.col};border:1px solid ${cfg.bdr};font-size:9.5px;font-weight:800;letter-spacing:.06em;white-space:nowrap;${FONT}">${cfg.label}</span>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <!-- Summary panel -->
      <div style="width:260px;flex-shrink:0;padding:20px 20px 46px;background:#f8fafc;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Closeout Summary</div>
        ${[
          [closedCount,"Closed","Actions fully completed before this review","#10b981","#f0fdf4","#86efac"],
          [partialCount,"Partial","Started but not fully verified at review date","#d97706","#fffbeb","#fde047"],
          [carriedCount,"Carried Forward","Not actioned — re-listed as open issues","#dc2626","#fef2f2","#fca5a5"],
        ].map(([v,l,d,c,bg,bdr])=>`
        <div style="background:${bg};border:1px solid ${bdr};border-radius:10px;padding:12px 14px;">
          <div style="font-size:32px;font-weight:900;color:${c};line-height:1;${FONT}">${v}</div>
          <div style="font-size:12px;font-weight:700;color:#1e293b;margin:3px 0 2px;${FONT}">${l}</div>
          <div style="font-size:10px;color:#475569;line-height:1.45;${FONT}">${d}</div>
        </div>`).join("")}
        <div style="margin-top:4px;padding:10px 12px;background:#fef9c3;border-radius:8px;border:1px solid #fde047;">
          <div style="font-size:10px;color:#854d0e;font-weight:600;line-height:1.5;${FONT}">⚠️ A2 (training) and A5 (hours) carried forward — both remain data gaps this period. See slide 13.</div>
        </div>
      </div>
    </div>
    ${slideFooter(2)}
  </div>`;

  // ── SLIDE 4 — TREND COMPARISON (H2 2025 → H1 2026) ───────────────────────────
  const trendRow = (
    label: string,
    prev: number, curr: number,
    lowerIsBetter: boolean,
    fmt: (n: number) => string = (n) => String(n)
  ): string => {
    const improved = lowerIsBetter ? curr < prev : curr > prev;
    const same = curr === prev;
    const delta = curr - prev;
    const arrow = same ? "→" : improved ? "↓" : "↑";
    const arrowCol = same ? "#64748b" : improved ? "#16a34a" : "#dc2626";
    const rowBg = same ? "white" : improved ? "#f0fdf4" : "#fff5f5";
    const deltaStr = (delta > 0 ? "+" : "") + fmt(delta);
    return `<tr style="border-bottom:1px solid #f1f5f9;background:${rowBg};">
      <td style="padding:9px 14px;font-size:12px;font-weight:600;color:#1e293b;">${label}</td>
      <td style="padding:9px 14px;font-size:15px;font-weight:800;color:#64748b;text-align:center;">${fmt(prev)}</td>
      <td style="padding:9px 14px;font-size:15px;font-weight:800;color:#0f172a;text-align:center;">${fmt(curr)}</td>
      <td style="padding:9px 14px;text-align:center;">
        <span style="font-size:16px;font-weight:900;color:${arrowCol};">${arrow}</span>
      </td>
      <td style="padding:9px 14px;font-size:12px;font-weight:700;color:${arrowCol};text-align:right;">${same?"—":deltaStr}</td>
    </tr>`;
  };

  const sTrend = `<div style="${SS}background:white;">
    ${slideHeader("Period-over-Period Trend","H2 2025 vs H1 2026  ·  All companies  ·  All jobsites")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Trend table -->
      <div style="flex:1;padding:16px 28px 46px;">
        <table style="width:100%;border-collapse:collapse;${FONT}">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.1em;text-transform:uppercase;width:35%;">METRIC</th>
              <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.1em;text-transform:uppercase;">H2 2025</th>
              <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;color:white;letter-spacing:.1em;text-transform:uppercase;">H1 2026</th>
              <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.1em;text-transform:uppercase;width:40px;">DIR</th>
              <th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.1em;text-transform:uppercase;">CHANGE</th>
            </tr>
          </thead>
          <tbody>
            ${trendRow("Total Safety Events",    H2_PREV.incidents.total,       H1.incidents.total,       true)}
            ${trendRow("Incidents",              H2_PREV.incidents.incidents,   H1.incidents.incidents,   true)}
            ${trendRow("Near Misses",            H2_PREV.incidents.nearMisses,  H1.incidents.nearMisses,  false)}
            ${trendRow("Recordable Injuries",    H2_PREV.incidents.recordable,  H1.incidents.recordable,  true)}
            ${trendRow("Lost-Time Cases",        H2_PREV.incidents.lostTime,    H1.incidents.lostTime,    true)}
            ${trendRow("Fatalities",             H2_PREV.incidents.fatalities,  H1.incidents.fatalities,  true)}
            ${trendRow("SIF-Potential Events",   H2_PREV.incidents.sifPotential,H1.incidents.sifPotential,true)}
            ${trendRow("Incident Close Rate",    H2_PREV.incidents.closePct,    H1.incidents.closePct,    false, n=>`${n}%`)}
            ${trendRow("CAs Overdue",            H2_PREV.cas.overdue,           H1.cas.overdue,           true)}
            ${trendRow("CA Actioned %",          H2_PREV.cas.actionedPct,       H1.cas.actionedPct,       false, n=>`${n}%`)}
          </tbody>
        </table>
      </div>
      <!-- Verdict panel -->
      <div style="width:290px;flex-shrink:0;padding:20px 20px 46px;background:#f8fafc;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Trend Verdict</div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:6px;${FONT}">✅ Positive direction overall</div>
          <div style="font-size:11px;color:#166534;line-height:1.55;${FONT}">Total events ↓18% (38→31), recordable injuries ↓18% (22→18), lost-time cases ↓38% (8→5), and incident close rate ↑7 pts (87%→94%). The program is moving in the right direction.</div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde047;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px;${FONT}">⚠️ Still needs attention</div>
          <div style="font-size:11px;color:#92400e;line-height:1.55;${FONT}">Near-miss reporting dipped slightly (14→12) — the goal is to <em>increase</em> near-miss reports over time. SIF events reduced (6→4) but 4 is still high. Both warrant sustained focus.</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:6px;${FONT}">📈 CA performance improving</div>
          <div style="font-size:11px;color:#1e40af;line-height:1.55;${FONT}">CA actioned rate improved 10 pts (68%→78%) and overdue count fell (9→6). Still needs clearing — but the trend is right.</div>
        </div>
        <div style="padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="font-size:10px;color:#475569;${FONT}">↓ = improvement for incidents/risk · ↑ = improvement for close rates / near misses</div>
        </div>
      </div>
    </div>
    ${slideFooter(4)}
  </div>`;

  // ── SLIDE 6 — SITE-LEVEL BREAKDOWN ────────────────────────────────────────────
  const riskCfg = {
    critical: { bg:"#fef2f2", col:"#dc2626", bdr:"#fca5a5", dot:"#dc2626" },
    high:     { bg:"#fff7ed", col:"#c2410c", bdr:"#fed7aa", dot:"#f97316" },
    medium:   { bg:"#fffbeb", col:"#92400e", bdr:"#fde047", dot:"#f59e0b" },
    low:      { bg:"#f0fdf4", col:"#166534", bdr:"#86efac", dot:"#22c55e" },
    clear:    { bg:"#f0fdf4", col:"#166534", bdr:"#86efac", dot:"#10b981" },
  } as const;

  const sSites = `<div style="${SS}background:white;">
    ${slideHeader("Site-Level Performance Breakdown","H1 2026  ·  11 jobsites  ·  5 companies")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Site table -->
      <div style="flex:1;padding:14px 28px 46px;">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;${FONT}">
          <thead>
            <tr style="background:#0f172a;">
              ${["SITE","COMPANY","EVENTS","INC","NM","SIF","OVERDUE CAs","RISK"].map(h=>`<th style="padding:9px 12px;text-align:${h==="SITE"||h==="COMPANY"?"left":"center"};font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.09em;text-transform:uppercase;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${SITES.map((s,i)=>{
              const cfg = riskCfg[s.risk];
              return `<tr style="background:${i%2===0?"white":"#f8fafc"};border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${s.name}</td>
                <td style="padding:9px 12px;color:#64748b;font-size:11px;">${s.company}</td>
                <td style="padding:9px 12px;text-align:center;font-size:15px;font-weight:900;color:${s.events>4?"#dc2626":s.events>2?"#f97316":"#1e293b"};">${s.events}</td>
                <td style="padding:9px 12px;text-align:center;font-weight:700;color:#475569;">${s.incidents}</td>
                <td style="padding:9px 12px;text-align:center;font-weight:700;color:#8b5cf6;">${s.nearMisses}</td>
                <td style="padding:9px 12px;text-align:center;font-weight:800;color:${s.sif>0?"#dc2626":"#10b981"};">${s.sif>0?s.sif:"—"}</td>
                <td style="padding:9px 12px;text-align:center;font-weight:800;color:${s.overdueCAs>0?"#f97316":"#10b981"};">${s.overdueCAs>0?s.overdueCAs:"—"}</td>
                <td style="padding:9px 12px;text-align:center;">
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:${cfg.bg};color:${cfg.col};border:1px solid ${cfg.bdr};font-size:9px;font-weight:800;letter-spacing:.06em;${FONT}">
                    <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};flex-shrink:0;"></span>
                    ${s.risk.toUpperCase()}
                  </span>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <!-- Insight panel -->
      <div style="width:250px;flex-shrink:0;padding:18px 18px 46px;background:#f8fafc;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Site Insights</div>
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:5px;${FONT}">🔴 2 critical sites</div>
          <div style="font-size:10px;color:#991b1b;line-height:1.5;${FONT}">Riverside Bridge &amp; Southgate Industrial account for <strong>12 of 31 events (39%)</strong> and both SIF flags that had injuries. Prioritise management visits and targeted controls.</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;font-weight:700;color:#c2410c;margin-bottom:5px;${FONT}">🟠 3 high-risk sites</div>
          <div style="font-size:10px;color:#9a3412;line-height:1.5;${FONT}">Metro Rail C, Harbour Precinct, and Western Terminal each logged 3–4 events. No fatalities but trends need monitoring.</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:5px;${FONT}">✅ 1 site — zero events</div>
          <div style="font-size:10px;color:#166534;line-height:1.5;${FONT}">Airport Ground Services recorded zero safety events this period. Benchmark their practices across the portfolio.</div>
        </div>
        <div style="padding:9px 11px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
          <div style="font-size:10px;color:#1d4ed8;font-weight:600;line-height:1.5;${FONT}">📌 All 4 overdue CAs sit across the 2 critical sites only.</div>
        </div>
      </div>
    </div>
    ${slideFooter(7)}
  </div>`;

  // ── SLIDE 8 — LEADING INDICATORS DASHBOARD ────────────────────────────────────
  const liBar = (label: string, done: number, target: number, pct: number, prevDone: number, color: string): string => {
    const trend = done >= prevDone;
    const trendStr = done === prevDone ? "—" : (done > prevDone ? `▲${done-prevDone}` : `▼${prevDone-done}`);
    const trendCol = done === prevDone ? "#64748b" : trend ? "#16a34a" : "#dc2626";
    const capped = Math.min(pct, 100);
    return `<div style="display:flex;flex-direction:column;gap:4px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:12px;font-weight:600;color:#1e293b;${FONT}">${label}</span>
        <span style="font-size:11px;font-weight:800;color:${color};${FONT}">${done}<span style="font-size:10px;color:#94a3b8;font-weight:500;"> / ${target}</span></span>
      </div>
      <div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
        <div style="height:100%;width:${capped}%;background:${color};border-radius:5px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;${FONT}">${pct}% of target</span>
        <span style="font-size:10px;font-weight:700;color:${trendCol};${FONT}">vs H2 2025: ${trendStr}</span>
      </div>
    </div>`;
  };

  const sLeading = `<div style="${SS}background:white;">
    ${slideHeader("Leading Indicators Dashboard","H1 2026  ·  Proactive safety performance metrics")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Bars -->
      <div style="flex:1;padding:18px 32px 46px;display:flex;flex-direction:column;gap:18px;justify-content:center;">
        ${liBar("Site Inspections Completed",       LEADING.inspections.completed,  LEADING.inspections.target,  LEADING.inspections.pct,  LEADING.prevPeriod.inspections,  "#3b82f6")}
        ${liBar("Toolbox Talks Delivered",           LEADING.toolboxTalks.completed, LEADING.toolboxTalks.target, LEADING.toolboxTalks.pct, LEADING.prevPeriod.toolboxTalks, "#8b5cf6")}
        ${liBar("Hazard Reports Submitted",          LEADING.hazardReports.completed,LEADING.hazardReports.target,LEADING.hazardReports.pct,LEADING.prevPeriod.hazardReports,"#f97316")}
        ${liBar("Safety Observations Logged",        LEADING.safetyObs.completed,    LEADING.safetyObs.target,    LEADING.safetyObs.pct,    LEADING.prevPeriod.safetyObs,    "#10b981")}
        ${liBar("Pre-Task Risk Assessments Filed",   LEADING.preTaskRAs.completed,   LEADING.preTaskRAs.target,   LEADING.preTaskRAs.pct,   LEADING.prevPeriod.preTaskRAs,   "#0ea5e9")}
      </div>
      <!-- Right panel -->
      <div style="width:310px;flex-shrink:0;padding:18px 20px 46px;background:#f8fafc;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Standout Metrics</div>
        ${[
          {icon:"🛑",label:"Stop-Work Authorities",val:"3 issued",sub:"Workers exercising SWA rights — a positive safety culture signal.",col:"#dc2626",bg:"#fef2f2",bdr:"#fca5a5"},
          {icon:"📋",label:"Near-Miss Ratio",val:"0.63 : 1",sub:"12 near-misses to 19 incidents. Improving but below the ≥ 1:1 industry best-practice target.",col:"#f97316",bg:"#fff7ed",bdr:"#fed7aa"},
          {icon:"✅",label:"Pre-Task RAs",val:"104% of target",sub:"312 filed vs 300 planned — safety planning is ahead of target across the portfolio.",col:"#10b981",bg:"#f0fdf4",bdr:"#86efac"},
          {icon:"⚠️",label:"Hazard Reports",val:"76% of target",sub:"38 of 50 planned hazard reports filed. Gap likely tied to training data absence — improve visibility.",col:"#f59e0b",bg:"#fffbeb",bdr:"#fde047"},
        ].map(m=>`
        <div style="background:${m.bg};border:1px solid ${m.bdr};border-radius:9px;padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="font-size:13px;">${m.icon}</span>
            <span style="font-size:11px;font-weight:700;color:#1e293b;flex:1;${FONT}">${m.label}</span>
            <span style="font-size:12px;font-weight:900;color:${m.col};${FONT}">${m.val}</span>
          </div>
          <div style="font-size:10px;color:#475569;line-height:1.45;padding-left:19px;${FONT}">${m.sub}</div>
        </div>`).join("")}
        <div style="margin-top:auto;padding:9px 11px;background:#fef9c3;border-radius:8px;border:1px solid #fde047;">
          <div style="font-size:10px;color:#854d0e;font-weight:600;line-height:1.5;${FONT}">📌 Training completion is a leading indicator not yet loaded — once populated it will appear here automatically.</div>
        </div>
      </div>
    </div>
    ${slideFooter(8)}
  </div>`;

  // ── SLIDE 3 — EXECUTIVE SUMMARY ────────────────────────────────────────────
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
    ${slideFooter(3)}
  </div>`;

  // ── SLIDE 5 — SAFETY SCORECARD ─────────────────────────────────────────────
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

  // Split scorecard into left (rows 0-4) and right (rows 5-9) for two-column full-width layout
  const scLeft  = scorecardRows.slice(0, 5);
  const scRight = scorecardRows.slice(5);
  const scTH = `<tr style="background:#0f172a;">
    <th style="padding:9px 14px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,.65);letter-spacing:.1em;text-transform:uppercase;width:44%;">METRIC</th>
    <th style="padding:9px 14px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,.65);letter-spacing:.1em;text-transform:uppercase;width:14%;">VALUE</th>
    <th style="padding:9px 14px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,.65);letter-spacing:.1em;text-transform:uppercase;width:42%;">NOTES</th>
  </tr>`;
  const scRows = (rows: string[][], startEven: boolean) => rows.map((r, i) => `
    <tr style="background:${(i + (startEven ? 0 : 1)) % 2 === 0 ? "white" : "#f8fafc"};border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 14px;font-weight:600;color:#1e293b;font-size:12px;">${r[0]}</td>
      <td style="padding:8px 14px;font-size:19px;font-weight:900;color:${r[3]};">${r[1]}</td>
      <td style="padding:8px 14px;color:#64748b;font-size:11.5px;">${r[2]}</td>
    </tr>`).join("");

  const s3 = `<div style="${SS}background:white;">
    ${slideHeader("Safety Performance Scorecard","H1 2026  ·  All Companies  ·  All Jobsites")}
    <div style="flex:1;display:flex;flex-direction:column;padding:10px 32px 46px;gap:10px;">
      <div style="display:flex;gap:16px;flex:1;">
        <div style="flex:1;display:flex;flex-direction:column;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;${FONT}">
            <thead>${scTH}</thead>
            <tbody>${scRows(scLeft, true)}</tbody>
          </table>
        </div>
        <div style="width:1px;background:#e2e8f0;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;${FONT}">
            <thead>${scTH}</thead>
            <tbody>${scRows(scRight, false)}</tbody>
          </table>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;background:#fffbeb;border:1px solid #fde047;border-radius:8px;padding:9px 13px;display:flex;gap:7px;align-items:flex-start;">
          <span style="font-size:13px;">📊</span>
          <div><div style="font-size:10px;font-weight:700;color:#854d0e;${FONT}">TRIR &amp; DART — Data Gap</div><div style="font-size:10px;color:#92400e;margin-top:2px;${FONT}">Hours-worked data not yet loaded. Rates calculate automatically once added.</div></div>
        </div>
        <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 13px;display:flex;gap:7px;align-items:flex-start;">
          <span style="font-size:13px;">📈</span>
          <div><div style="font-size:10px;font-weight:700;color:#1d4ed8;${FONT}">Near-Miss Ratio: 0.63 : 1</div><div style="font-size:10px;color:#1e40af;margin-top:2px;${FONT}">Trending in the right direction — industry best practice target ≥ 1:1.</div></div>
        </div>
        <div style="flex:1;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:9px 13px;display:flex;gap:7px;align-items:flex-start;">
          <span style="font-size:13px;">⚡</span>
          <div><div style="font-size:10px;font-weight:700;color:#dc2626;${FONT}">SIF Watch — 4 Events</div><div style="font-size:10px;color:#991b1b;margin-top:2px;${FONT}">Targeted controls are the priority action from this review.</div></div>
        </div>
      </div>
    </div>
    ${slideFooter(5)}
  </div>`;

  // ── SLIDE 6 — OBJECTIVES & TARGETS ────────────────────────────────────────────
  const objStatusCfg = {
    met:    { bg:"#f0fdf4", col:"#16a34a", bdr:"#86efac", badge:"MET ✓"     },
    watch:  { bg:"#fffbeb", col:"#d97706", bdr:"#fde047", badge:"MONITOR ⚠️" },
    missed: { bg:"#fef2f2", col:"#dc2626", bdr:"#fca5a5", badge:"MISSED ✗"  },
    gap:    { bg:"#f8fafc", col:"#64748b", bdr:"#e2e8f0", badge:"DATA GAP"  },
  } as const;
  const metCount    = OBJECTIVES.filter(o => o.status === "met").length;
  const watchCount  = OBJECTIVES.filter(o => o.status === "watch").length;
  const missedCount = OBJECTIVES.filter(o => o.status === "missed").length;
  const gapCount    = OBJECTIVES.filter(o => o.status === "gap").length;

  const sObjectives = `<div style="${SS}background:white;">
    ${slideHeader("Objectives &amp; Targets — H1 2026 vs Plan","Annual safety objectives set at H2 2025 review  ·  RAG status at period end")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Objective table -->
      <div style="flex:1;padding:14px 28px 46px;">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;${FONT}">
          <thead>
            <tr style="background:#0f172a;">
              ${["OBJECTIVE","TARGET","ACTUAL","STATUS","NOTES"].map(h=>`<th style="padding:9px 12px;text-align:left;font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.09em;text-transform:uppercase;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${OBJECTIVES.map((o,i)=>{
              const cfg = objStatusCfg[o.status];
              return `<tr style="background:${i%2===0?"white":"#f8fafc"};border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${o.obj}</td>
                <td style="padding:9px 12px;font-weight:700;color:#475569;white-space:nowrap;">${o.target}</td>
                <td style="padding:9px 12px;font-size:14px;font-weight:900;color:${cfg.col};white-space:nowrap;">${o.actual}</td>
                <td style="padding:9px 12px;white-space:nowrap;">
                  <span style="display:inline-block;padding:3px 9px;border-radius:20px;background:${cfg.bg};color:${cfg.col};border:1px solid ${cfg.bdr};font-size:9px;font-weight:800;letter-spacing:.05em;${FONT}">${cfg.badge}</span>
                </td>
                <td style="padding:9px 12px;color:#64748b;font-size:11px;">${o.note}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <!-- Summary panel -->
      <div style="width:230px;flex-shrink:0;padding:18px 18px 46px;background:#f8fafc;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Target Summary</div>
        ${([
          [metCount,   "Targets Met",           "#f0fdf4","#16a34a","#86efac"],
          [watchCount, "Monitor / Partial",      "#fffbeb","#d97706","#fde047"],
          [missedCount,"Targets Missed",         "#fef2f2","#dc2626","#fca5a5"],
          [gapCount,   "Data Gap — not reported","#f8fafc","#64748b","#e2e8f0"],
        ] as [number,string,string,string,string][]).map(([v,l,bg,col,bdr])=>`
        <div style="background:${bg};border:1px solid ${bdr};border-radius:9px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <div style="font-size:30px;font-weight:900;color:${col};line-height:1;min-width:36px;${FONT}">${v}</div>
          <div style="font-size:11px;font-weight:600;color:#1e293b;${FONT}">${l}</div>
        </div>`).join("")}
        <div style="margin-top:4px;padding:10px 12px;background:#fef9c3;border-radius:8px;border:1px solid #fde047;">
          <div style="font-size:10px;color:#854d0e;font-weight:600;line-height:1.5;${FONT}">📌 Training and audit targets cannot be assessed until records are loaded into the platform.</div>
        </div>
      </div>
    </div>
    ${slideFooter(6)}
  </div>`;

  // ── SLIDE 8 — INCIDENT REVIEW ──────────────────────────────────────────────
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
    ${slideFooter(9)}
  </div>`;

  // ── SLIDE 10 — COMPLIANCE STATUS ────────────────────────────────────────────
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
      <div style="flex:1;padding:18px 22px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;background:#fafafa;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">🔍</span>
          <span style="font-size:13px;font-weight:700;color:#1e293b;${FONT}">Site Audits</span>
          <span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;${FONT}">DATA GAP</span>
        </div>
        <div style="flex:1;background:#fff7ed;border:2px dashed #f97316;border-radius:10px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;">
          <div style="font-size:36px;">📭</div>
          <div style="font-size:13px;font-weight:700;color:#c2410c;${FONT}">No audit records populated</div>
          <div style="font-size:11.5px;color:#9a3412;line-height:1.6;max-width:280px;${FONT}">Jobsite audit scores are not yet in the platform. ISO 45001 requires a minimum of 4 site audits per site per year — this cannot be verified until data is loaded.</div>
        </div>
        <div style="padding:10px 14px;background:#fff7ed;border-radius:7px;border:1px solid #fed7aa;">
          <div style="font-size:10.5px;color:#c2410c;font-weight:600;${FONT}">▶ Action: assign a data-entry owner and load audit records before the next management review.</div>
        </div>
      </div>
      <!-- Training gap -->
      <div style="flex:1;padding:18px 22px 46px;display:flex;flex-direction:column;gap:12px;background:#fafafa;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">🎓</span>
          <span style="font-size:13px;font-weight:700;color:#1e293b;${FONT}">Employee Training</span>
          <span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;${FONT}">DATA GAP</span>
        </div>
        <div style="flex:1;background:#fff7ed;border:2px dashed #f97316;border-radius:10px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;">
          <div style="font-size:36px;">📭</div>
          <div style="font-size:13px;font-weight:700;color:#c2410c;${FONT}">No training records populated</div>
          <div style="font-size:11.5px;color:#9a3412;line-height:1.6;max-width:280px;${FONT}">Training completion data is absent for all 5 portfolio companies. ISO 45001 §7.2 competency compliance cannot be demonstrated this period.</div>
        </div>
        <div style="padding:10px 14px;background:#fff7ed;border-radius:7px;border:1px solid #fed7aa;">
          <div style="font-size:10.5px;color:#c2410c;font-weight:600;${FONT}">▶ Action: load training records before H2 2026 review — this is a mandatory ISO 45001 metric.</div>
        </div>
      </div>
    </div>
    ${slideFooter(10)}
  </div>`;

  // ── SLIDE 11 — LEGAL & REGULATORY STATUS ──────────────────────────────────────
  const legalUpdateStatusCfg = {
    "in-progress": { bg:"#eff6ff", col:"#1d4ed8", bdr:"#bfdbfe", label:"IN PROGRESS" },
    "overdue":     { bg:"#fef2f2", col:"#dc2626", bdr:"#fca5a5", label:"OVERDUE"     },
    "pending":     { bg:"#f8fafc", col:"#64748b", bdr:"#e2e8f0", label:"PENDING"     },
  } as const;

  const sLegal = `<div style="${SS}background:white;">
    ${slideHeader("Legal &amp; Regulatory Status","H1 2026  ·  WHS Act 2011  ·  ISO 45001 obligations")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Left: standing + certifications -->
      <div style="width:290px;flex-shrink:0;padding:16px 20px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Compliance Standing</div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:4px;${FONT}">✅ No enforcement notices</div>
          <div style="font-size:10px;color:#166534;line-height:1.5;${FONT}">No improvement notices, prohibition notices, or penalty infringement notices received this period.</div>
        </div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Certifications &amp; Licences</div>
        ${LEGAL.certifications.map(c=>`
        <div style="background:${c.ok?"#f0fdf4":"#fef2f2"};border:1px solid ${c.ok?"#86efac":"#fca5a5"};border-radius:9px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:700;color:#1e293b;${FONT}">${c.name}</span>
            <span style="font-size:9px;font-weight:800;color:${c.ok?"#16a34a":"#dc2626"};${FONT}">${c.ok?"CURRENT":"EXPIRED"}</span>
          </div>
          <div style="font-size:10px;color:#64748b;${FONT}">${c.status}  ·  Expiry: ${c.expiry}</div>
        </div>`).join("")}
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:9px;padding:10px 12px;">
          <div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:3px;${FONT}">Jurisdiction</div>
          <div style="font-size:10px;color:#0c4a6e;line-height:1.45;${FONT}">${LEGAL.jurisdiction}</div>
        </div>
        <div style="margin-top:auto;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;font-weight:800;color:#dc2626;margin-bottom:5px;${FONT}">🚨 OVERDUE — Action Required</div>
          <div style="font-size:10px;color:#9a1515;line-height:1.5;${FONT}">Confined space code of practice update (Feb 2026) — site procedures and retraining are past due. Q3 2026 regulations take effect imminently. <strong>Escalate to HSE Manager immediately.</strong></div>
        </div>
      </div>
      <!-- Right: regulatory updates -->
      <div style="flex:1;padding:16px 24px 46px;display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;${FONT}">Regulatory Updates — H1 2026</div>
        ${LEGAL.updates.map(u=>{
          const cfg = legalUpdateStatusCfg[u.status];
          return `<div style="padding:11px 14px;background:${cfg.bg};border:1px solid ${cfg.bdr};border-radius:9px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:5px;">
              <div style="font-size:10px;font-weight:700;color:#475569;flex-shrink:0;${FONT}">${u.date}</div>
              <span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:12px;background:${cfg.bg};color:${cfg.col};border:1px solid ${cfg.bdr};flex-shrink:0;${FONT}">${cfg.label}</span>
            </div>
            <div style="font-size:11px;font-weight:600;color:#1e293b;margin-bottom:4px;line-height:1.4;${FONT}">${u.item}</div>
            <div style="font-size:10px;color:#64748b;line-height:1.4;${FONT}">▶ Required action: ${u.action}  ·  Due: ${u.due}</div>
          </div>`;
        }).join("")}
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7c3aed;margin-top:4px;${FONT}">⚡ Upcoming Obligations</div>
        ${LEGAL.upcoming.map(u=>`
        <div style="padding:8px 12px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;">
          <div style="font-size:11px;color:#4c1d95;line-height:1.4;${FONT}">• ${u}</div>
        </div>`).join("")}
      </div>
    </div>
    ${slideFooter(11)}
  </div>`;

  // ── SLIDE 12 — RISK HEAT MAP ────────────────────────────────────────────────
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
    ${slideFooter(12)}
  </div>`;

  // ── SLIDE 13 — CORRECTIVE ACTIONS ───────────────────────────────────────────
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
    ${slideFooter(13)}
  </div>`;

  // ── SLIDE 14 — ASKS / DECISIONS NEEDED ─────────────────────────────────────
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
    ${slideFooter(14)}
  </div>`;

  // ── SLIDE 15 — OPEN ISSUES & GAPS ──────────────────────────────────────────
  const sGaps = `<div style="${SS}background:white;">
    ${slideHeader("Open Issues &amp; Critical Gaps","H1 2026  ·  What needs immediate attention")}
    <div style="flex:1;display:flex;gap:0;">
      <!-- Left: Top 5 gaps -->
      <div style="flex:1;padding:16px 22px 46px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;">
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
      <div style="width:310px;flex-shrink:0;padding:16px 20px 46px;background:#f8fafc;display:flex;flex-direction:column;gap:9px;">
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
    ${slideFooter(15)}
  </div>`;

  // ── SLIDE 16 — NEXT STEPS & CLOSE ──────────────────────────────────────────
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
      <span style="font-size:10px;color:rgba(255,255,255,.25);${FONT}">16 / 16</span>
    </div>
  </div>`;

  // ── NOTES SLIDE (only appended if notes entered) ──────────────────────────
  const notesSlide = notes.trim() ? `
  <div style="${SS}background:white;">
    ${slideHeader("Meeting Notes &amp; Minutes", exportDate)}
    <div style="flex:1;padding:22px 48px 46px;display:flex;flex-direction:column;gap:12px;overflow:hidden;">
      <div style="flex:1;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:16px;font-size:12px;color:#334155;line-height:1.75;white-space:pre-wrap;overflow:auto;${FONT}">${notes.trim()}</div>
    </div>
    ${slideFooter(17)}
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
  <div class="slide">${sPrevReview}</div>
  <div class="slide">${s2}</div>
  <div class="slide">${sTrend}</div>
  <div class="slide">${s3}</div>
  <div class="slide">${sObjectives}</div>
  <div class="slide">${sSites}</div>
  <div class="slide">${sLeading}</div>
  <div class="slide">${s4}</div>
  <div class="slide">${s5}</div>
  <div class="slide">${sLegal}</div>
  <div class="slide">${s6}</div>
  <div class="slide">${s7}</div>
  <div class="slide">${s8}</div>
  <div class="slide">${sGaps}</div>
  <div class="slide">${s9}</div>
  ${notes.trim() ? `<div class="slide">${notesSlide}</div>` : ""}
${autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},700);});</script>` : ""}
</body>
</html>`;
}

// ── PPTX generator ────────────────────────────────────────────────────────────

async function generatePptx(exportDate: string, checkedItems: Set<number>) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 10" × 5.625"

  const C = {
    navy:"0f172a", navyMid:"1e3a5f", blue:"0ea5e9", green:"10b981", greenBg:"f0fdf4", greenBdr:"86efac",
    red:"dc2626", redBg:"fef2f2", redBdr:"fca5a5", orange:"f97316", orangeBg:"fff7ed", orangeBdr:"fed7aa",
    amber:"f59e0b", amberBg:"fffbeb", amberBdr:"fde047", purple:"7c3aed", purpleBg:"faf5ff",
    white:"FFFFFF", ltGray:"f8fafc", border:"e2e8f0", dark:"1e293b", mid:"334155", muted:"64748b", faint:"94a3b8",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hdr(slide: any, title: string, sub: string, n: number) {
    slide.addShape("rect", { x:0,y:0,w:10,h:0.65, fill:{color:C.navy} });
    slide.addText(title, { x:0.4,y:0.07,w:8.5,h:0.35, fontSize:14,bold:true,color:C.white,fontFace:"Calibri" });
    slide.addText(sub,   { x:0.4,y:0.42,w:8.5,h:0.2,  fontSize:8.5,color:"aaaaaa",fontFace:"Calibri" });
    slide.addShape("rect", { x:0,y:5.28,w:10,h:0.345, fill:{color:"f1f5f9"} });
    slide.addText("SafePredict  ·  H1 2026 Management Review  ·  CONFIDENTIAL", { x:0.3,y:5.3,w:8,h:0.2, fontSize:7.5,color:C.faint,fontFace:"Calibri" });
    slide.addText(`${n} / 16`, { x:9.3,y:5.3,w:0.5,h:0.2, fontSize:7.5,color:C.faint,fontFace:"Calibri",align:"right" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function statBox(slide: any, x:number,y:number,w:number,h:number, val:string,label:string,sub:string, valCol:string,bg:string) {
    slide.addShape("rect",{ x,y,w,h, fill:{color:bg},line:{color:C.border,width:1} });
    slide.addText(val,  { x:x+0.1,y:y+0.08, w:w-0.2,h:0.52, fontSize:28,bold:true,color:valCol,fontFace:"Calibri" });
    slide.addText(label,{ x:x+0.1,y:y+0.58, w:w-0.2,h:0.22, fontSize:10,bold:true,color:C.dark,fontFace:"Calibri" });
    slide.addText(sub,  { x:x+0.1,y:y+0.8,  w:w-0.2,h:0.2,  fontSize:8.5,color:C.muted,fontFace:"Calibri" });
  }

  // ── Slide 1 — TITLE ─────────────────────────────────────────────────────────
  const sl1 = pres.addSlide();
  sl1.addShape("rect",{x:0,y:0,w:10,h:5.625,fill:{color:C.navy}});
  sl1.addText("SafePredict  ·  Safety Docs 360",{x:0.6,y:0.45,w:9,h:0.25,fontSize:9,color:"888888",bold:true,fontFace:"Calibri"});
  sl1.addText("Safety & Compliance Review",{x:0.6,y:0.8,w:9,h:0.95,fontSize:36,bold:true,color:C.white,fontFace:"Calibri"});
  sl1.addText("H1 2026  ·  December 2025 – May 2026",{x:0.6,y:1.82,w:9,h:0.35,fontSize:14,color:"aaaaaa",fontFace:"Calibri"});
  ([["PORTFOLIO","5 Companies · 11 Jobsites"],["SAFETY EVENTS","31 logged"],["PERIOD","6 months"],["REPORT DATE",exportDate]] as [string,string][]).forEach(([l,v],i)=>{
    const x=0.5+i*2.35;
    sl1.addShape("rect",{x,y:2.45,w:2.2,h:0.75,fill:{color:C.navyMid},line:{color:"1e4a7f",width:1}});
    sl1.addText(l,{x,y:2.48,w:2.2,h:0.2,fontSize:7,color:"888888",bold:true,align:"center",fontFace:"Calibri"});
    sl1.addText(v,{x,y:2.68,w:2.2,h:0.3,fontSize:10,color:C.white,bold:true,align:"center",fontFace:"Calibri"});
  });
  sl1.addText("CONFIDENTIAL  ·  FOR EXECUTIVE REVIEW ONLY",{x:0.5,y:5.2,w:7,h:0.2,fontSize:8,color:"444444",fontFace:"Calibri"});
  sl1.addText("1 / 16",{x:9.3,y:5.2,w:0.5,h:0.2,fontSize:8,color:"444444",align:"right",fontFace:"Calibri"});

  // ── Slide 2 — PREVIOUS REVIEW ACTIONS ───────────────────────────────────────
  const sl2 = pres.addSlide();
  hdr(sl2,"Previous Review — Action Closeout","H2 2025 management review  ·  Status at H1 2026 review date",2);
  const statusCfgP = { closed:{col:"10b981",lbl:"CLOSED"}, partial:{col:"d97706",lbl:"PARTIAL"}, carried:{col:"dc2626",lbl:"CARRIED FWD"} };
  const prevTableRows = [
    [{text:"REF",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"ACTION",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"OWNER",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"DUE",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"STATUS",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...PREV_ACTIONS.map((a,i)=>{
      const cfg = statusCfgP[a.status]; const rf=i%2===0?"FFFFFF":"f8fafc";
      return [{text:a.ref,options:{bold:true,color:C.muted,fill:{color:rf}}},{text:a.action,options:{color:C.dark,fill:{color:rf}}},{text:a.owner,options:{color:C.muted,fill:{color:rf}}},{text:a.due,options:{color:C.muted,fill:{color:rf}}},{text:cfg.lbl,options:{bold:true,color:cfg.col,fill:{color:rf}}}];
    }),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl2.addTable(prevTableRows as any,{x:0.4,y:0.73,w:9.2,h:4.3,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[0.55,4.45,1.5,0.9,1.3],fontFace:"Calibri",fontSize:10,rowH:0.55});
  const [cCnt,pCnt,xCnt]=[PREV_ACTIONS.filter(a=>a.status==="closed").length,PREV_ACTIONS.filter(a=>a.status==="partial").length,PREV_ACTIONS.filter(a=>a.status==="carried").length];
  sl2.addShape("rect",{x:0.4,y:4.82,w:9.2,h:0.35,fill:{color:"fef9c3"},line:{color:"fde047",width:1}});
  sl2.addText(`✅ ${cCnt} closed  |  🟡 ${pCnt} partial  |  🔴 ${xCnt} carried forward — A2 (training) and A5 (hours) remain open data gaps this period`,{x:0.55,y:4.86,w:9.0,h:0.24,fontSize:9,color:"854d0e",fontFace:"Calibri"});

  // ── Slide 3 — EXECUTIVE SUMMARY ─────────────────────────────────────────────
  const sl3 = pres.addSlide();
  hdr(sl3,"Executive Summary","H1 2026  ·  5 Companies  ·  11 Jobsites",3);
  ([["31","Total Events","19 incidents + 12 near misses",C.blue,"f0f9ff"],["0","Fatalities","No fatal events this period",C.green,"f0fdf4"],["18","Recordable","OSHA recordable injuries",C.orange,"fff7ed"],["5","Lost-Time","29 days away · 39 restricted",C.red,"fef2f2"],["4","SIF-Potential","Serious injury or fatality risk",C.red,"fef2f2"]] as [string,string,string,string,string][]).forEach(([v,l,s,col,bg],i)=>{ statBox(sl3,0.35+i*1.87,0.73,1.77,1.1,v,l,s,col,bg); });
  ([["✅ 94% close rate","29 of 31 incidents closed — strong performance",C.green,"f0fdf4","86efac"],["⚠️ 6 CAs overdue","Past-due corrective actions need resourcing now",C.red,"fef2f2","fca5a5"],["🎯 4 SIF events","Targeted controls required — management priority",C.amber,"fffbeb","fde047"],["📌 Biggest ask","Load training & audit data. Clear overdue CAs. Document SIF controls.",C.muted,"f8fafc","e2e8f0"]] as [string,string,string,string,string][]).forEach(([t,b,col,bg,bdr],i)=>{
    const x=0.35+i*2.33;
    sl3.addShape("rect",{x,y:1.98,w:2.2,h:2.8,fill:{color:bg},line:{color:bdr,width:1}});
    sl3.addText(t,{x:x+0.1,y:2.05,w:2.0,h:0.3,fontSize:11,bold:true,color:col,fontFace:"Calibri"});
    sl3.addText(b,{x:x+0.1,y:2.4,w:2.0,h:2.2,fontSize:10,color:C.mid,fontFace:"Calibri",valign:"top"});
  });

  // ── Slide 4 — TREND COMPARISON ──────────────────────────────────────────────
  const sl4 = pres.addSlide();
  hdr(sl4,"Period-over-Period Trend","H2 2025 vs H1 2026  ·  All companies  ·  All jobsites",4);
  const tData:[string,string,string,string,string,boolean][]=[
    ["Total Safety Events","38","31","↓","−7",true],["Incidents","24","19","↓","−5",true],
    ["Near Misses","14","12","↓","−2",false],["Recordable Injuries","22","18","↓","−4",true],
    ["Lost-Time Cases","8","5","↓","−3",true],["Fatalities","0","0","→","—",true],
    ["SIF-Potential Events","6","4","↓","−2",true],["Incident Close Rate","87%","94%","↑","+7pts",true],
    ["CAs Overdue","9","6","↓","−3",true],["CA Actioned %","68%","78%","↑","+10pts",true],
  ];
  const tRows=[
    [{text:"METRIC",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"H2 2025",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}},{text:"H1 2026",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}},{text:"DIR",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}},{text:"CHANGE",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}}],
    ...tData.map(([m,p,c,d,ch,good])=>{
      const dc=d==="→"?C.muted:good?C.green:C.red; const rf=d==="→"?"FFFFFF":good?"f0fdf4":"fff5f5";
      return [{text:m,options:{color:C.dark,fill:{color:rf}}},{text:p,options:{bold:true,color:C.muted,align:"center",fill:{color:rf}}},{text:c,options:{bold:true,color:C.dark,align:"center",fill:{color:rf}}},{text:d,options:{bold:true,color:dc,fontSize:14,align:"center",fill:{color:rf}}},{text:ch,options:{bold:true,color:dc,align:"center",fill:{color:rf}}}];
    }),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl4.addTable(tRows as any,{x:0.4,y:0.73,w:6.8,h:4.6,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.8,1.1,1.1,0.7,1.1],fontFace:"Calibri",fontSize:11,rowH:0.42});
  ([["✅ Positive overall","Events ↓18%, recordables ↓18%, lost-time ↓38%, close rate +7pts.",C.green,"f0fdf4","86efac",0.73,1.5],["⚠️ Watch items","Near-miss dipped (14→12) — target is to increase. 4 SIF events still high.",C.amber,"fffbeb","fde047",2.35,1.3],["📈 CA improving","Actioned rate +10pts (68→78%). Overdue ↓(9→6). Trend right.",C.blue,"eff6ff","bfdbfe",3.77,1.35]] as [string,string,string,string,string,number,number][]).forEach(([t,b,c,bg,bdr,y,h])=>{
    sl4.addShape("rect",{x:7.4,y,w:2.3,h,fill:{color:bg},line:{color:bdr,width:1}});
    sl4.addText(t,{x:7.5,y:y+0.08,w:2.1,h:0.28,fontSize:10,bold:true,color:c,fontFace:"Calibri"});
    sl4.addText(b,{x:7.5,y:y+0.38,w:2.1,h:h-0.45,fontSize:9.5,color:c,fontFace:"Calibri"});
  });

  // ── Slide 5 — SAFETY SCORECARD ──────────────────────────────────────────────
  const sl5 = pres.addSlide();
  hdr(sl5,"Safety Performance Scorecard","H1 2026  ·  All Companies  ·  All Jobsites",5);
  const scData:[string,string,string,string][]=[
    ["Total Safety Events","31","19 incidents + 12 near misses",C.blue],["Total Incidents","19","Recordable + non-recordable","3b82f6"],
    ["Near-Miss Reports","12","0.63:1 near-miss ratio (healthy)","8b5cf6"],["Recordable Injuries","18","OSHA recordable",C.orange],
    ["Lost-Time Cases","5","Days away or restricted work",C.red],["Fatalities","0 ✓","No fatal events recorded",C.green],
    ["SIF-Potential Events","4","Serious injury or fatality potential",C.red],["Days Away From Work","29","Total across all lost-time cases",C.amber],
    ["Days Restricted/Transfer","39","Total restricted or transferred duties",C.amber],["Incident Close Rate","94%","29 of 31 incidents closed",C.green],
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl5.addTable([
    [{text:"METRIC",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"VALUE",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"NOTES",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...scData.map(([m,v,n,c],i)=>[{text:m,options:{color:C.dark,fill:{color:i%2===0?"FFFFFF":"f8fafc"}}},{text:v,options:{bold:true,fontSize:16,color:c,align:"center" as const,fill:{color:i%2===0?"FFFFFF":"f8fafc"}}},{text:n,options:{color:C.muted,fill:{color:i%2===0?"FFFFFF":"f8fafc"}}}]),
  ] as any,{x:0.4,y:0.73,w:9.2,h:4.6,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[3.2,1.1,4.9],fontFace:"Calibri",fontSize:11,rowH:0.42});

  // ── Slide 6 — OBJECTIVES & TARGETS ──────────────────────────────────────────
  const sl6obj = pres.addSlide();
  hdr(sl6obj,"Objectives & Targets — H1 2026 vs Plan","Annual safety objectives  ·  RAG status at period end",6);
  const objStatCfgP = { met:{col:C.green,lbl:"MET ✓"}, watch:{col:"d97706",lbl:"MONITOR ⚠️"}, missed:{col:C.red,lbl:"MISSED ✗"}, gap:{col:C.muted,lbl:"DATA GAP"} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl6obj.addTable([
    [{text:"OBJECTIVE",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"TARGET",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"ACTUAL",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"STATUS",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"NOTES",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...OBJECTIVES.map((o,i)=>{const cfg=objStatCfgP[o.status];const rf=i%2===0?"FFFFFF":"f8fafc";return[{text:o.obj,options:{color:C.dark,fill:{color:rf}}},{text:o.target,options:{bold:true,color:C.muted,align:"center" as const,fill:{color:rf}}},{text:o.actual,options:{bold:true,fontSize:14,color:cfg.col,align:"center" as const,fill:{color:rf}}},{text:cfg.lbl,options:{bold:true,color:cfg.col,align:"center" as const,fill:{color:rf}}},{text:o.note,options:{color:C.muted,fill:{color:rf}}}];}),
  ] as any,{x:0.4,y:0.73,w:9.2,h:4.55,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.8,1.0,1.0,1.2,3.2],fontFace:"Calibri",fontSize:10,rowH:0.42});
  const [mc,wc,xc,gc]=[OBJECTIVES.filter(o=>o.status==="met").length,OBJECTIVES.filter(o=>o.status==="watch").length,OBJECTIVES.filter(o=>o.status==="missed").length,OBJECTIVES.filter(o=>o.status==="gap").length];
  sl6obj.addShape("rect",{x:0.4,y:5.0,w:9.2,h:0.22,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl6obj.addText(`✅ ${mc} met  |  ⚠️ ${wc} monitor  |  ✗ ${xc} missed  |  📭 ${gc} data gaps (training + audit not yet loaded)`,{x:0.55,y:5.02,w:9.0,h:0.18,fontSize:9,color:C.dark,fontFace:"Calibri"});

  // ── Slide 7 — SITE BREAKDOWN ─────────────────────────────────────────────────
  const sl6 = pres.addSlide();
  hdr(sl6,"Site-Level Performance Breakdown","H1 2026  ·  11 jobsites  ·  5 companies",7);
  const rCol={critical:C.red,high:C.orange,medium:C.amber,low:C.green,clear:C.green};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl6.addTable([
    [{text:"SITE",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"COMPANY",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"EVENTS",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"INC",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"NM",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"SIF",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"OVERDUE",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"RISK",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}}],
    ...SITES.map((s,i)=>{const rf=i%2===0?"FFFFFF":"f8fafc";const rc=rCol[s.risk];return[{text:s.name,options:{color:C.dark,bold:true,fill:{color:rf}}},{text:s.company,options:{color:C.muted,fill:{color:rf}}},{text:String(s.events),options:{bold:true,fontSize:13,color:s.events>4?C.red:s.events>2?C.orange:C.dark,align:"center" as const,fill:{color:rf}}},{text:String(s.incidents),options:{bold:true,color:C.mid,align:"center" as const,fill:{color:rf}}},{text:String(s.nearMisses),options:{bold:true,color:"8b5cf6",align:"center" as const,fill:{color:rf}}},{text:s.sif>0?String(s.sif):"—",options:{bold:true,color:s.sif>0?C.red:C.green,align:"center" as const,fill:{color:rf}}},{text:s.overdueCAs>0?String(s.overdueCAs):"—",options:{bold:true,color:s.overdueCAs>0?C.orange:C.green,align:"center" as const,fill:{color:rf}}},{text:s.risk.toUpperCase(),options:{bold:true,color:rc,align:"center" as const,fill:{color:rf}}}];}),
  ] as any,{x:0.3,y:0.73,w:9.4,h:4.6,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.4,1.5,0.75,0.6,0.6,0.6,0.8,0.95],fontFace:"Calibri",fontSize:10,rowH:0.4});

  // ── Slide 7 — LEADING INDICATORS ─────────────────────────────────────────────
  const sl7 = pres.addSlide();
  hdr(sl7,"Leading Indicators Dashboard","H1 2026  ·  Proactive safety performance metrics",8);
  ([
    ["Site Inspections",       LEADING.inspections.completed,  LEADING.inspections.target,  LEADING.inspections.pct,  LEADING.prevPeriod.inspections,  C.blue],
    ["Toolbox Talks Delivered",LEADING.toolboxTalks.completed, LEADING.toolboxTalks.target, LEADING.toolboxTalks.pct, LEADING.prevPeriod.toolboxTalks, "8b5cf6"],
    ["Hazard Reports",         LEADING.hazardReports.completed,LEADING.hazardReports.target,LEADING.hazardReports.pct,LEADING.prevPeriod.hazardReports,C.orange],
    ["Safety Observations",    LEADING.safetyObs.completed,    LEADING.safetyObs.target,    LEADING.safetyObs.pct,    LEADING.prevPeriod.safetyObs,    C.green],
    ["Pre-Task Risk Assessments",LEADING.preTaskRAs.completed, LEADING.preTaskRAs.target,   LEADING.preTaskRAs.pct,   LEADING.prevPeriod.preTaskRAs,   "0ea5e9"],
  ] as [string,number,number,number,number,string][]).forEach(([lbl,done,tgt,pct,prev,col],idx)=>{
    const y=0.78+idx*0.84; const bw=Math.min(pct/100*5.8,5.8); const up=done>=prev;
    const trendStr=done===prev?"—":(up?`▲${done-prev}`:`▼${prev-done}`);
    sl7.addText(lbl,{x:0.4,y,w:3.0,h:0.3,fontSize:11,bold:true,color:C.dark,fontFace:"Calibri"});
    sl7.addText(`${done} / ${tgt}  (${pct}% of target)`,{x:6.7,y,w:3.0,h:0.3,fontSize:10,bold:true,color:col,fontFace:"Calibri"});
    sl7.addText(`vs H2 2025: ${trendStr}`,{x:6.7,y:y+0.32,w:3.0,h:0.22,fontSize:9,color:up?"16a34a":"dc2626",fontFace:"Calibri"});
    sl7.addShape("rect",{x:0.4,y:y+0.36,w:5.8,h:0.16,fill:{color:"e2e8f0"}});
    if(bw>0) sl7.addShape("rect",{x:0.4,y:y+0.36,w:bw,h:0.16,fill:{color:col}});
  });
  sl7.addShape("rect",{x:0.4,y:4.88,w:5.8,h:0.32,fill:{color:"fef9c3"},line:{color:"fde047",width:1}});
  sl7.addText("📌 Training completion is a key leading indicator not yet loaded — will appear here once data is populated.",{x:0.55,y:4.9,w:5.6,h:0.25,fontSize:9,color:"854d0e",fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:0.78,w:3.1,h:0.92,fill:{color:"fef2f2"},line:{color:"fca5a5",width:1}});
  sl7.addText("3 Stop-Work Authorities issued",{x:6.65,y:0.84,w:2.9,h:0.26,fontSize:10,bold:true,color:C.red,fontFace:"Calibri"});
  sl7.addText("Workers exercising SWA rights — positive safety culture signal.",{x:6.65,y:1.12,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:1.82,w:3.1,h:0.92,fill:{color:"fff7ed"},line:{color:"fed7aa",width:1}});
  sl7.addText("Near-miss ratio: 0.63 : 1",{x:6.65,y:1.88,w:2.9,h:0.26,fontSize:10,bold:true,color:C.orange,fontFace:"Calibri"});
  sl7.addText("12 near misses : 19 incidents. Below ≥1:1 industry target — improve reporting culture.",{x:6.65,y:2.16,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:2.86,w:3.1,h:0.92,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl7.addText("Pre-Task RAs: 104% ✓",{x:6.65,y:2.92,w:2.9,h:0.26,fontSize:10,bold:true,color:C.green,fontFace:"Calibri"});
  sl7.addText("312 filed vs 300 planned — safety planning is ahead of target across the portfolio.",{x:6.65,y:3.20,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:3.90,w:3.1,h:0.92,fill:{color:"fffbeb"},line:{color:"fde047",width:1}});
  sl7.addText("Hazard Reports: 76% ⚠️",{x:6.65,y:3.96,w:2.9,h:0.26,fontSize:10,bold:true,color:C.amber,fontFace:"Calibri"});
  sl7.addText("38 of 50 planned submitted. Improve visibility and reporting cadence at underperforming sites.",{x:6.65,y:4.24,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});

  // ── Slide 8 — INCIDENT REVIEW ────────────────────────────────────────────────
  const sl8 = pres.addSlide();
  hdr(sl8,"Incident Review","H1 2026  ·  31 events  ·  19 incidents  ·  12 near misses",9);
  sl8.addText("By Severity",{x:0.4,y:0.73,w:4.0,h:0.25,fontSize:9,bold:true,color:C.muted,fontFace:"Calibri"});
  ([{l:"Critical",v:1,c:C.red},{l:"High",v:14,c:C.orange},{l:"Medium",v:12,c:C.amber},{l:"Low",v:4,c:C.green}]).forEach((s,i)=>{
    const y=1.02+i*0.65; const bw=Math.max(0.1,(s.v/14)*3.0);
    sl8.addText(s.l,{x:0.4,y,w:1.0,h:0.28,fontSize:10,color:C.dark,fontFace:"Calibri"});
    sl8.addShape("rect",{x:1.5,y:y+0.04,w:3.0,h:0.2,fill:{color:"e2e8f0"}});
    sl8.addShape("rect",{x:1.5,y:y+0.04,w:bw, h:0.2,fill:{color:s.c}});
    sl8.addText(String(s.v),{x:4.6,y,w:0.4,h:0.28,fontSize:11,bold:true,color:s.c,fontFace:"Calibri"});
  });
  sl8.addShape("rect",{x:0.4,y:3.72,w:4.2,h:0.42,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl8.addText("✅  94% close rate  |  29 closed  |  2 in progress  |  19 incidents  |  12 near misses",{x:0.5,y:3.76,w:4.0,h:0.28,fontSize:9.5,bold:true,color:C.green,fontFace:"Calibri"});
  sl8.addText("Notable & SIF-Potential Events",{x:5.0,y:0.73,w:4.7,h:0.25,fontSize:9,bold:true,color:C.muted,fontFace:"Calibri"});
  H1.incidents.notable.forEach((ev,i)=>{
    const y=1.02+i*0.63; const bg=ev.ai?"fdf4ff":ev.tags.some(t=>t.includes("SIF"))?"fff7f7":"f8fafc";
    sl8.addShape("rect",{x:5.0,y,w:4.7,h:0.57,fill:{color:bg},line:{color:"e2e8f0",width:0.5}});
    const icon=ev.ai?"[AI]":ev.tags.some(t=>t.includes("SIF"))?"[SIF]":"";
    sl8.addText(`${icon} ${ev.title}`,{x:5.1,y:y+0.04,w:4.5,h:0.28,fontSize:9.5,bold:true,color:C.dark,fontFace:"Calibri"});
    sl8.addText(ev.tags.join("  ·  "),{x:5.1,y:y+0.34,w:4.5,h:0.18,fontSize:8,color:ev.ai?"7c3aed":C.muted,fontFace:"Calibri"});
  });
  sl8.addShape("rect",{x:5.0,y:4.82,w:4.7,h:0.35,fill:{color:"f0fdf4"},line:{color:"bbf7d0",width:1}});
  sl8.addText("Gus AI auto-flagged 2 of 6 notable events (energised panel + O₂ deficiency) before human report.",{x:5.1,y:4.86,w:4.5,h:0.24,fontSize:8.5,color:"166534",fontFace:"Calibri"});

  // ── Slide 9 — COMPLIANCE ─────────────────────────────────────────────────────
  const sl9 = pres.addSlide();
  hdr(sl9,"Compliance Status","Permits  ·  Audits  ·  Training  ·  H1 2026",10);
  sl9.addText("📋  Permits to Work",{x:0.4,y:0.75,w:4.0,h:0.3,fontSize:12,bold:true,color:C.dark,fontFace:"Calibri"});
  ([["38","Total",C.blue,"f0f9ff"],["7","Active","3b82f6","eff6ff"],["30","Closed",C.green,"f0fdf4"],["1","Draft",C.amber,"fffbeb"]] as [string,string,string,string][]).forEach(([v,l,c,bg],i)=>{
    const x=0.4+i*1.05;
    sl9.addShape("rect",{x,y:1.12,w:0.95,h:0.88,fill:{color:bg},line:{color:"e2e8f0",width:1}});
    sl9.addText(v,{x,y:1.15,w:0.95,h:0.44,fontSize:22,bold:true,color:c,align:"center",fontFace:"Calibri"});
    sl9.addText(l,{x,y:1.6,w:0.95,h:0.2,fontSize:9,color:C.muted,align:"center",fontFace:"Calibri"});
  });
  sl9.addShape("rect",{x:0.4,y:2.1,w:4.1,h:0.4,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl9.addText("✅  0 permits expiring in the next 30 days",{x:0.5,y:2.13,w:3.9,h:0.28,fontSize:10,bold:true,color:C.green,fontFace:"Calibri"});
  sl9.addShape("rect",{x:0.4,y:2.65,w:4.1,h:2.3,fill:{color:"fff7ed"},line:{color:"fed7aa",width:2}});
  sl9.addText("🔍  Site Audits — DATA GAP",{x:0.55,y:2.73,w:3.85,h:0.3,fontSize:11,bold:true,color:C.orange,fontFace:"Calibri"});
  sl9.addText("Jobsite audit records are not yet populated. Audit compliance scores cannot be reported this period.\n\nAction: populate audit data to unlock compliance scoring next period.",{x:0.55,y:3.1,w:3.85,h:1.7,fontSize:10,color:"9a3412",fontFace:"Calibri"});
  sl9.addShape("rect",{x:4.75,y:0.75,w:4.9,h:4.2,fill:{color:"fff7ed"},line:{color:"fed7aa",width:2}});
  sl9.addText("🎓  Employee Training — DATA GAP",{x:4.9,y:0.83,w:4.6,h:0.3,fontSize:11,bold:true,color:C.orange,fontFace:"Calibri"});
  sl9.addText("Training completion records are not yet populated.\n\nTraining completion % cannot be reported this period.\n\nThis is a mandatory ISO 45001 §7.2 metric.\n\nAction: assign data-entry ownership and set a deadline before the next management review.",{x:4.9,y:1.22,w:4.6,h:3.5,fontSize:11,color:"9a3412",fontFace:"Calibri"});

  // ── Slide 11 — LEGAL & REGULATORY STATUS ─────────────────────────────────────
  const sl11leg = pres.addSlide();
  hdr(sl11leg,"Legal & Regulatory Status","H1 2026  ·  WHS Act 2011  ·  ISO 45001 obligations",11);
  sl11leg.addShape("rect",{x:0.4,y:0.72,w:3.8,h:0.36,fill:{color:C.green},line:{color:C.green,width:0}});
  sl11leg.addText("✅  NO ENFORCEMENT NOTICES — PERIOD CLEAR",{x:0.5,y:0.75,w:3.6,h:0.28,fontSize:11,bold:true,color:C.white,fontFace:"Calibri"});
  sl11leg.addText("Jurisdiction",{x:0.4,y:1.16,w:1.6,h:0.22,fontSize:10,bold:true,color:C.muted,fontFace:"Calibri"});
  sl11leg.addText(LEGAL.jurisdiction,{x:0.4,y:1.38,w:3.8,h:0.3,fontSize:10,color:C.dark,fontFace:"Calibri"});
  sl11leg.addText("CERTIFICATIONS",{x:0.4,y:1.78,w:3.8,h:0.22,fontSize:10,bold:true,color:C.navy,fontFace:"Calibri"});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl11leg.addTable([
    [{text:"Certification",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Status",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Expiry",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...LEGAL.certifications.map((c,i)=>{const rf=i%2===0?"FFFFFF":"f8fafc";return[{text:c.name,options:{color:C.dark,fill:{color:rf}}},{text:c.status,options:{color:c.ok?C.green:C.red,fill:{color:rf}}},{text:c.expiry,options:{color:C.muted,fill:{color:rf}}}];}),
  ] as any,{x:0.4,y:2.04,w:3.8,h:1.0,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[1.9,1.1,0.8],fontFace:"Calibri",fontSize:10,rowH:0.25});
  sl11leg.addText("UPCOMING OBLIGATIONS",{x:0.4,y:3.14,w:3.8,h:0.22,fontSize:10,bold:true,color:C.navy,fontFace:"Calibri"});
  LEGAL.upcoming.forEach((u,i)=>{sl11leg.addText(`• ${u}`,{x:0.4,y:3.4+i*0.35,w:3.8,h:0.3,fontSize:10,color:"9a3412",fontFace:"Calibri"});});
  sl11leg.addText("REGULATORY UPDATES — H1 2026",{x:4.5,y:0.72,w:5.1,h:0.22,fontSize:10,bold:true,color:C.navy,fontFace:"Calibri"});
  const statusColor = (s:string) => s==="overdue"?C.red:s==="in-progress"?C.amber:"94a3b8";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl11leg.addTable([
    [{text:"Date",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Update / Obligation",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Action Required",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Due",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Status",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...LEGAL.updates.map((u,i)=>{const rf=i%2===0?"FFFFFF":"f8fafc";return[{text:u.date,options:{color:C.muted,fill:{color:rf}}},{text:u.item,options:{color:C.dark,fill:{color:rf}}},{text:u.action,options:{color:C.muted,fill:{color:rf}}},{text:u.due,options:{color:C.muted,fill:{color:rf}}},{text:u.status.toUpperCase(),options:{bold:true,color:statusColor(u.status),fill:{color:rf}}}];}),
  ] as any,{x:4.5,y:1.0,w:5.1,h:1.3,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[0.6,1.9,1.5,0.6,0.5],fontFace:"Calibri",fontSize:9,rowH:0.33});
  sl11leg.addText("KEY COMPLIANCE RISK — PRIORITY ACTION",{x:4.5,y:2.4,w:5.1,h:0.22,fontSize:10,bold:true,color:C.red,fontFace:"Calibri"});
  sl11leg.addShape("rect",{x:4.5,y:2.66,w:5.1,h:1.6,fill:{color:"fef2f2"},line:{color:"fca5a5",width:1}});
  sl11leg.addText("Confined Space Regulations (Feb 2026 update) — OVERDUE\n\nState regulator revised atmospheric monitoring requirements. Site procedures must be updated and all affected personnel retrained before new confined space regulations take effect in Q3 2026.\n\nResponsible: HSE Manager  |  Deadline: Q2 2026 (OVERDUE)  |  Escalate immediately.",{x:4.6,y:2.72,w:4.9,h:1.48,fontSize:10,color:"9a3412",fontFace:"Calibri"});

  // ── Slide 12 — RISK MATRIX ───────────────────────────────────────────────────
  const sl10 = pres.addSlide();
  hdr(sl10,"Risk Matrix — Portfolio Overview","30 scored risk items  ·  All jobsites  ·  H1 2026",12);
  ([["2","Critical / Extreme","Immediate controls required",C.red,"fef2f2","fca5a5"],["14","High","Targeted risk treatment needed",C.orange,"fff7ed","fed7aa"],["13","Moderate","Manage & monitor",C.amber,"fffbeb","fde047"],["1","Low","Accept with periodic review",C.green,"f0fdf4","86efac"]] as [string,string,string,string,string,string][]).forEach(([v,l,d,c,bg,bdr],i)=>{
    const y=0.78+i*1.05;
    sl10.addShape("rect",{x:0.4,y,w:4.5,h:0.97,fill:{color:bg},line:{color:bdr,width:1}});
    sl10.addText(v,{x:0.5,y:y+0.12,w:0.9,h:0.7,fontSize:36,bold:true,color:c,fontFace:"Calibri"});
    sl10.addText(l,{x:1.55,y:y+0.1,w:3.2,h:0.3,fontSize:12,bold:true,color:C.dark,fontFace:"Calibri"});
    sl10.addText(d,{x:1.55,y:y+0.46,w:3.2,h:0.35,fontSize:10,color:C.muted,fontFace:"Calibri"});
  });
  const lvlCol:Record<string,string>={E:C.red,H:C.orange,M:C.amber,L:C.green};
  const lvlGrid=[["H","H","E","E","E"],["M","H","H","E","E"],["L","M","H","H","E"],["L","L","M","H","H"],["L","L","L","M","H"]];
  const cntGrid=[[1,2,0,1,1],[3,1,2,0,0],[0,4,3,2,0],[0,0,3,2,1],[1,0,0,3,0]];
  const cs=0.68,gx=5.2,gy=0.78;
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    sl10.addShape("rect",{x:gx+c*cs,y:gy+r*cs,w:cs-0.04,h:cs-0.04,fill:{color:lvlCol[lvlGrid[r][c]]},line:{color:"FFFFFF",width:1}});
    if(cntGrid[r][c]>0) sl10.addText(String(cntGrid[r][c]),{x:gx+c*cs,y:gy+r*cs,w:cs-0.04,h:cs-0.04,fontSize:16,bold:true,color:"FFFFFF",align:"center",valign:"middle",fontFace:"Calibri"});
  }
  (["Fatal","Major","Moderate","Minor","Neglg."]).forEach((l,i)=>sl10.addText(l,{x:gx-1.05,y:gy+i*cs+0.22,w:1.0,h:0.28,fontSize:8.5,color:C.muted,align:"right",fontFace:"Calibri"}));
  (["Rare","Unlikely","Possible","Likely","A.Certain"]).forEach((l,i)=>sl10.addText(l,{x:gx+i*cs,y:gy+5*cs+0.05,w:cs,h:0.24,fontSize:8,color:C.muted,align:"center",fontFace:"Calibri"}));
  sl10.addShape("rect",{x:0.4,y:4.97,w:9.2,h:0.22,fill:{color:"fef2f2"},line:{color:"fca5a5",width:1}});
  sl10.addText("🔴  Key finding: 16 of 30 items (53%) in the high/critical band — this is the visual that drives the resourcing ask on slide 14.",{x:0.5,y:4.98,w:9.0,h:0.19,fontSize:9,bold:true,color:C.red,fontFace:"Calibri"});

  // ── Slide 11 — CORRECTIVE ACTIONS ───────────────────────────────────────────
  const sl11 = pres.addSlide();
  hdr(sl11,"Corrective Action Management","54 total  ·  H1 2026  ·  All jobsites",13);
  sl11.addShape("rect",{x:0.4,y:0.73,w:2.0,h:4.22,fill:{color:C.navy}});
  sl11.addText("TOTAL\nCORRECTIVE\nACTIONS",{x:0.4,y:0.9,w:2.0,h:0.65,fontSize:9,bold:true,color:"888888",align:"center",fontFace:"Calibri"});
  sl11.addText("54",{x:0.4,y:1.62,w:2.0,h:1.0,fontSize:58,bold:true,color:C.amber,align:"center",fontFace:"Calibri"});
  sl11.addText("78% actioned",{x:0.4,y:2.72,w:2.0,h:0.32,fontSize:11,bold:true,color:"fbbf24",align:"center",fontFace:"Calibri"});
  sl11.addText("42 of 54 actioned.\nVerification & overdue\nclosure is the bottleneck.",{x:0.4,y:3.1,w:2.0,h:0.7,fontSize:8.5,color:"888888",align:"center",fontFace:"Calibri"});
  ([{l:"Verified closed",v:25,c:C.green},{l:"Corrected",v:17,c:"3b82f6"},{l:"Open",v:12,c:C.amber},{l:"Overdue",v:6,c:C.red}]).forEach((s,i)=>{
    const y=0.82+i*0.6; const bw=(s.v/25)*2.8;
    sl11.addText(s.l,{x:2.6,y,w:1.5,h:0.28,fontSize:10,color:C.dark,fontFace:"Calibri"});
    sl11.addShape("rect",{x:4.2,y:y+0.04,w:2.8,h:0.2,fill:{color:"e2e8f0"}});
    sl11.addShape("rect",{x:4.2,y:y+0.04,w:bw, h:0.2,fill:{color:s.c}});
    sl11.addText(String(s.v),{x:7.08,y,w:0.4,h:0.28,fontSize:11,bold:true,color:s.c,fontFace:"Calibri"});
  });
  ([{l:"Critical",v:8,c:C.red},{l:"High",v:18,c:C.orange},{l:"Medium",v:10,c:C.amber},{l:"Low",v:18,c:C.green}]).forEach((s,i)=>{
    const y=3.38+i*0.33; const bw=(s.v/18)*2.8;
    sl11.addText(s.l,{x:2.6,y,w:1.1,h:0.26,fontSize:9,color:C.dark,fontFace:"Calibri"});
    sl11.addShape("rect",{x:3.8,y:y+0.04,w:2.8,h:0.16,fill:{color:"e2e8f0"}});
    sl11.addShape("rect",{x:3.8,y:y+0.04,w:bw, h:0.16,fill:{color:s.c}});
    sl11.addText(String(s.v),{x:6.68,y,w:0.35,h:0.26,fontSize:9,bold:true,color:s.c,fontFace:"Calibri"});
  });
  ([["✅ 25 verified closed","Fully closed & verified — 46% of total","f0fdf4",C.green],["🔵 17 corrected","Fix done, not yet independently verified","eff6ff","1d4ed8"],["🟡 12 still open","Active, in progress or not yet started","fffbeb","92400e"],["🔴 6 overdue","Past due date — management escalation required","fef2f2","991b1b"]] as [string,string,string,string][]).forEach(([t,d,bg,c],i)=>{
    const y=0.82+i*0.95;
    sl11.addShape("rect",{x:7.5,y,w:2.15,h:0.85,fill:{color:bg},line:{color:"e2e8f0",width:0.5}});
    sl11.addText(t,{x:7.62,y:y+0.08,w:1.9,h:0.28,fontSize:9.5,bold:true,color:C.dark,fontFace:"Calibri"});
    sl11.addText(d,{x:7.62,y:y+0.38,w:1.9,h:0.35,fontSize:8.5,color:c,fontFace:"Calibri"});
  });
  sl11.addShape("rect",{x:7.5,y:4.65,w:2.15,h:0.52,fill:{color:"fef9c3"},line:{color:"fde047",width:1}});
  sl11.addText("Critical CAs (8) include SIF-related incidents. Prioritise for closure.",{x:7.62,y:4.68,w:1.9,h:0.4,fontSize:8.5,color:"854d0e",fontFace:"Calibri"});

  // ── Slide 12 — ASKS & DECISIONS ──────────────────────────────────────────────
  const sl12 = pres.addSlide();
  hdr(sl12,"Asks & Decisions Required","Three specific actions needed from this review",14);
  ([
    ["a","Resource to clear overdue corrective actions","6 overdue CAs require owner assignment and expedited closure. 17 CAs marked 'corrected' need independent verification. Recommend a 2-week sprint.",C.red,"fef2f2","fca5a5"],
    ["b","Targeted controls for the high/critical risk band","2 critical and 14 high risk-band items (53% of all scored work) require active risk treatment. Assign controls for SIF hazard types: hand/crush, arc flash, chemical exposure, work-at-height.",C.orange,"fff7ed","fed7aa"],
    ["c","Turn on training & audit tracking","Training completion and audit scores not yet populated. ISO 45001 mandated. Assign data-entry ownership and set a deadline before the next review.",C.amber,"fffbeb","fde047"],
  ] as [string,string,string,string,string,string][]).forEach(([letter,title,body,c,bg,bdr],i)=>{
    const y=0.78+i*1.38;
    sl12.addShape("rect",{x:0.4,y,w:9.2,h:1.28,fill:{color:bg},line:{color:bdr,width:1}});
    sl12.addShape("rect",{x:0.52,y:y+0.24,w:0.5,h:0.5,fill:{color:c}});
    sl12.addText(letter,{x:0.52,y:y+0.24,w:0.5,h:0.5,fontSize:16,bold:true,color:"FFFFFF",align:"center",valign:"middle",fontFace:"Calibri"});
    sl12.addText(title,{x:1.2,y:y+0.1,w:8.2,h:0.34,fontSize:12,bold:true,color:C.dark,fontFace:"Calibri"});
    sl12.addText(body, {x:1.2,y:y+0.5,w:8.2,h:0.68,fontSize:10.5,color:C.mid,fontFace:"Calibri"});
  });
  sl12.addShape("rect",{x:0.4,y:4.95,w:9.2,h:0.22,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl12.addText("✅  Each ask is tied to specific numbers. Decisions and owners should be recorded in minutes before this meeting closes.",{x:0.55,y:4.97,w:9.0,h:0.18,fontSize:8.5,color:C.green,fontFace:"Calibri"});

  // ── Slide 13 — OPEN ISSUES & GAPS ───────────────────────────────────────────
  const sl13 = pres.addSlide();
  hdr(sl13,"Open Issues & Critical Gaps","H1 2026  ·  What needs immediate attention",15);
  sl13.addText("Top 5 Gaps",{x:0.4,y:0.73,w:3.4,h:0.25,fontSize:9,bold:true,color:C.red,fontFace:"Calibri"});
  ([["1","Training records not loaded","ISO 45001 §7.2 cannot be demonstrated.",C.red,"fef2f2","fca5a5"],["2","Site audit data missing","Data gap — not zero performance.",C.orange,"fff7ed","fed7aa"],["3","6 CAs overdue","Linked to SIF-potential events.",C.orange,"fff7ed","fed7aa"],["4","Hours worked not tracked","TRIR/DART rates cannot be calculated.",C.amber,"fffbeb","fde047"],["5","SIF controls unverified","4 events; controls not formally verified.","7c3aed","faf5ff","e9d5ff"]] as [string,string,string,string,string,string][]).forEach(([n,t,d,c,bg,bdr],i)=>{
    const y=1.02+i*0.78;
    sl13.addShape("rect",{x:0.4,y,w:3.5,h:0.72,fill:{color:bg},line:{color:bdr,width:1}});
    sl13.addShape("rect",{x:0.5,y:y+0.21,w:0.3,h:0.3,fill:{color:c}});
    sl13.addText(n,{x:0.5,y:y+0.21,w:0.3,h:0.3,fontSize:10,bold:true,color:"FFFFFF",align:"center",valign:"middle",fontFace:"Calibri"});
    sl13.addText(t,{x:0.95,y:y+0.07,w:2.85,h:0.27,fontSize:10,bold:true,color:C.dark,fontFace:"Calibri"});
    sl13.addText(d,{x:0.95,y:y+0.38,w:2.85,h:0.26,fontSize:9,color:C.muted,fontFace:"Calibri"});
  });
  sl13.addText("Key Incidents & Near-Misses",{x:4.15,y:0.73,w:3.5,h:0.25,fontSize:9,bold:true,color:C.muted,fontFace:"Calibri"});
  H1.incidents.notable.forEach((ev,i)=>{
    const y=1.02+i*0.63; const bg=ev.ai?"fdf4ff":ev.tags.some(t=>t.includes("SIF"))?"fff7f7":"f8fafc";
    sl13.addShape("rect",{x:4.15,y,w:3.5,h:0.57,fill:{color:bg},line:{color:"e2e8f0",width:0.5}});
    const icon=ev.ai?"[AI]":ev.tags.some(t=>t.includes("SIF"))?"[SIF]":"";
    sl13.addText(`${icon} ${ev.title}`,{x:4.25,y:y+0.05,w:3.3,h:0.27,fontSize:9.5,bold:true,color:C.dark,fontFace:"Calibri"});
    sl13.addText(ev.tags.join("  ·  "),{x:4.25,y:y+0.34,w:3.3,h:0.18,fontSize:8,color:ev.ai?"7c3aed":C.muted,fontFace:"Calibri"});
  });
  sl13.addText("High-Risk Activities",{x:7.9,y:0.73,w:1.8,h:0.25,fontSize:9,bold:true,color:"7c3aed",fontFace:"Calibri"});
  ([["Crane lifts","HIGH",C.red],["Elec. work","HIGH",C.orange],["Confined space","HIGH",C.orange],["Chemical handling","MED",C.amber],["Work at height","MED",C.amber]] as [string,string,string][]).forEach(([t,r,c],i)=>{
    const y=1.02+i*0.78;
    sl13.addShape("rect",{x:7.9,y,w:1.8,h:0.72,fill:{color:"f8fafc"},line:{color:"e2e8f0",width:1}});
    sl13.addText(t,{x:8.0,y:y+0.07,w:1.6,h:0.28,fontSize:10,bold:true,color:C.dark,fontFace:"Calibri"});
    sl13.addText(r,{x:8.0,y:y+0.4,w:1.6,h:0.22,fontSize:9,bold:true,color:c,fontFace:"Calibri"});
  });

  // ── Slide 14 — NEXT STEPS ────────────────────────────────────────────────────
  const sl14 = pres.addSlide();
  sl14.addShape("rect",{x:0,y:0,w:10,h:5.625,fill:{color:C.navy}});
  sl14.addShape("rect",{x:0,y:0,w:10,h:0.68,fill:{color:"0c2244"}});
  sl14.addText("Next Steps & Priorities",{x:0.5,y:0.1,w:9,h:0.34,fontSize:16,bold:true,color:C.white,fontFace:"Calibri"});
  sl14.addText("Actions to carry forward from this review",{x:0.5,y:0.44,w:9,h:0.22,fontSize:9,color:"888888",fontFace:"Calibri"});
  ([
    ["🔴","SIF prevention — immediate","Targeted reviews of the 4 SIF hazard types: crane picks, arc flash, chemical exposure, work-at-height. Implement or verify engineered controls before next period."],
    ["📋","Weekly overdue-CA review","Establish a weekly standing agenda item to review the 6 overdue + 17 pending-verification CAs. Assign a CA owner for each item today."],
    ["📊","Populate hours worked","Log total hours worked per period to unlock TRIR and DART rate calculations automatically. Without this, rate-based benchmarking cannot be reported."],
    ["🎓","Load training & audit records","Populate jobsite audit scores and employee training-completion records before the next management review. Mandatory ISO 45001 metrics currently showing as data gaps."],
  ] as [string,string,string][]).forEach(([ic,t,d],i)=>{
    const x=0.4+(i%2)*4.85; const y=0.83+Math.floor(i/2)*2.1;
    sl14.addShape("rect",{x,y,w:4.55,h:1.95,fill:{color:"162744"},line:{color:"1e3a5f",width:0.5}});
    sl14.addText(ic,{x:x+0.15,y:y+0.14,w:0.5,h:0.5,fontSize:18,fontFace:"Calibri"});
    sl14.addText(t, {x:x+0.15,y:y+0.67,w:4.22,h:0.3,fontSize:11,bold:true,color:C.white,fontFace:"Calibri"});
    sl14.addText(d, {x:x+0.15,y:y+1.03,w:4.22,h:0.78,fontSize:9.5,color:"aaaaaa",fontFace:"Calibri"});
  });
  sl14.addShape("rect",{x:0,y:5.28,w:10,h:0.345,fill:{color:"0c2244"}});
  sl14.addText(`Generated by SafePredict · Safety Docs 360 · ${exportDate} · Confidential  |  ${checkedItems.size}/${AGENDA_ITEMS.length} agenda items reviewed  |  16 / 16`,{x:0.4,y:5.3,w:9.4,h:0.2,fontSize:7.5,color:"444444",fontFace:"Calibri"});

  await pres.writeFile({ fileName: `safepredict-review-${REVIEW_SLUG}-${new Date().toISOString().split("T")[0] ?? "export"}.pptx` });
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
  const [pptxLoading, setPptxLoading] = useState(false);
  const [pptxError,   setPptxError]   = useState<string | null>(null);

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
      const [incRes, caRes] = await Promise.all([
        fetch(`/api/company/incidents?period=${param}${siteQ}`, { headers }),
        fetch(`/api/company/corrective-actions?status=open${siteQ}`, { headers }),
      ]);
      if (incRes.ok) {
        const d = (await incRes.json()) as { incidents?: unknown[] } | unknown[];
        setIncidents(Array.isArray(d) ? d.length : Array.isArray((d as { incidents?: unknown[] }).incidents) ? (d as { incidents: unknown[] }).incidents.length : DEMO_METRICS[p].incidents);
      } else setIncidents(DEMO_METRICS[p].incidents);
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
    a.href = url; a.download = `safepredict-review-${REVIEW_SLUG}-${new Date().toISOString().split("T")[0] ?? "export"}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  function handlePdfExport() {
    const exportDate = new Date().toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" });
    const html = generatePresentation(exportDate, checkedItems, notes, true);
    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  async function handlePptxExport() {
    setPptxLoading(true); setPptxError(null);
    try {
      const exportDate = new Date().toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" });
      await generatePptx(exportDate, checkedItems);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setPptxError(e instanceof Error ? e.message : "PPTX generation failed");
    } finally { setPptxLoading(false); }
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
            <div className="flex items-center gap-3 flex-wrap">
              {saved && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" /> Downloaded
                </span>
              )}
              {pptxError && (
                <span className="text-xs text-red-600 font-medium">{pptxError}</span>
              )}
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-sm">
                <Save className="w-4 h-4" /> HTML
              </button>
              <button onClick={handlePdfExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors shadow-sm">
                <FileText className="w-4 h-4" /> Save as PDF
              </button>
              <button onClick={() => void handlePptxExport()} disabled={pptxLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-sm">
                {pptxLoading
                  ? <><TrendingUp className="w-4 h-4 animate-spin" /> Building PPTX…</>
                  : <><TrendingUp className="w-4 h-4" /> Export PPTX</>}
              </button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
