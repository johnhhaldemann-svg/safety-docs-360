// ── Export slug — update each new review period ───────────────────────────────

export const REVIEW_SLUG = "h1-2026";

// ── Types ──────────────────────────────────────────────────────────────────────

export type WeekPeriod = "1w" | "2w" | "4w" | "8w" | "12w";
export type Jobsite = { id: string; name: string; code?: string | null };

// ── Period config ──────────────────────────────────────────────────────────────

export const PERIOD_LABELS: Record<WeekPeriod, string> = {
  "1w": "Last 1 Week", "2w": "Last 2 Weeks", "4w": "Last 4 Weeks",
  "8w": "Last 8 Weeks", "12w": "Last 12 Weeks",
};
export const PERIOD_BUTTON_LABELS: Record<WeekPeriod, string> = {
  "1w": "1 wk", "2w": "2 wks", "4w": "4 wks", "8w": "8 wks", "12w": "12 wks",
};
export const PERIOD_API_PARAM: Record<WeekPeriod, string> = {
  "1w": "7d", "2w": "14d", "4w": "30d", "8w": "60d", "12w": "90d",
};

// ── Agenda items ──────────────────────────────────────────────────────────────

export const AGENDA_ITEMS = [
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

export const DEMO_METRICS: Record<WeekPeriod, {
  incidents: number; openCAs: number; inspectionRate: number; inductionRate: number; leadingScore: number;
}> = {
  "1w":  { incidents: 1,  openCAs: 14, inspectionRate: 91, inductionRate: 96, leadingScore: 82 },
  "2w":  { incidents: 2,  openCAs: 14, inspectionRate: 89, inductionRate: 95, leadingScore: 80 },
  "4w":  { incidents: 3,  openCAs: 14, inspectionRate: 87, inductionRate: 94, leadingScore: 78 },
  "8w":  { incidents: 6,  openCAs: 14, inspectionRate: 84, inductionRate: 92, leadingScore: 75 },
  "12w": { incidents: 9,  openCAs: 14, inspectionRate: 83, inductionRate: 91, leadingScore: 74 },
};

// ── H1 2026 Portfolio data (demo dataset) ─────────────────────────────────────

export const H1 = {
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

export const H2_PREV = {
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

export const PREV_ACTIONS = [
  { ref:"A1", action:"Mandatory pre-task hazard assessments at all crane/lifting operations", owner:"Site Managers", due:"Feb 2026", status:"closed" as const },
  { ref:"A2", action:"Chemical handling refresher training — all process operators", owner:"Safety Team", due:"Jan 2026", status:"carried" as const },
  { ref:"A3", action:"Confined space procedure review and re-issue to all sites", owner:"HSE Manager", due:"Dec 2025", status:"closed" as const },
  { ref:"A4", action:"Establish monthly corrective action close-out review cadence", owner:"Operations Mgr", due:"Jan 2026", status:"partial" as const },
  { ref:"A5", action:"Load total hours-worked data into SafePredict for rate reporting", owner:"HR / Payroll", due:"Mar 2026", status:"carried" as const },
  { ref:"A6", action:"Deploy SafePredict platform to 2 additional portfolio companies", owner:"CEO / IT", due:"Mar 2026", status:"closed" as const },
];

// ── Site-level performance data ────────────────────────────────────────────────

export const SITES = [
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

export const OBJECTIVES = [
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

export const LEGAL = {
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

export const LEADING = {
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
