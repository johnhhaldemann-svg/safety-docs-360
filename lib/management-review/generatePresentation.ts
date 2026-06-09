import {
  AGENDA_ITEMS, H1, H2_PREV, PREV_ACTIONS, SITES, OBJECTIVES, LEGAL, LEADING,
} from "./data";
import { FONT, heatMapSVG, hBarSVG, slideHeader, slideFooter, ragBadge, tagChip } from "./htmlHelpers";

// ══════════════════════════════════════════════════════════════════════════════
//  PRESENTATION GENERATOR  (HTML / print-to-PDF)
// ══════════════════════════════════════════════════════════════════════════════

export function generatePresentation(exportDate: string, checkedItems: Set<number>, notes: string, autoPrint = false): string {
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

  // ── SLIDE 7 — SITE-LEVEL BREAKDOWN ────────────────────────────────────────────
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

  // ── SLIDE 9 — INCIDENT REVIEW ──────────────────────────────────────────────
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
