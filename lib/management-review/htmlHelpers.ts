// ── Shared font string ────────────────────────────────────────────────────────

export const FONT = `font-family:'Inter',system-ui,-apple-system,sans-serif;`;

// ── SVG helpers ───────────────────────────────────────────────────────────────

export function heatMapSVG(): string {
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

export function hBarSVG(
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

export function donutSVG(pct: number, color: string, label: string, sub: string, w = 130): string {
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

export function slideHeader(title: string, sub: string): string {
  return `<div style="background:#0f172a;padding:20px 48px 16px;flex-shrink:0;">
    <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-.02em;${FONT}">${title}</div>
    <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;font-weight:500;${FONT}">${sub}</div>
  </div>`;
}

export function slideFooter(n: number): string {
  return `<div style="position:absolute;bottom:0;left:0;right:0;background:#f8fafc;border-top:1px solid #e2e8f0;padding:7px 48px;display:flex;justify-content:space-between;">
    <span style="font-size:10px;color:#94a3b8;font-weight:500;${FONT}">SafePredict  ·  Safety &amp; Compliance Review  ·  H1 2026  ·  CONFIDENTIAL</span>
    <span style="font-size:10px;color:#94a3b8;font-weight:500;${FONT}">${n} / 16</span>
  </div>`;
}

export function ragBadge(s: "green"|"amber"|"red"): string {
  const map = { green:["#f0fdf4","#16a34a","ON TRACK"], amber:["#fffbeb","#d97706","MONITOR"], red:["#fef2f2","#dc2626","ATTENTION"] };
  const [bg,col,lbl] = map[s];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${bg};color:${col};font-size:10px;font-weight:700;letter-spacing:.07em;${FONT}">${lbl}</span>`;
}

export function tagChip(tag: string, ai: boolean): string {
  const isAI = ai && tag === "AI-flagged";
  const isSIF = tag.includes("SIF");
  const isLT = tag === "Lost-time";
  const isRec = tag === "Recordable";
  const bg = isAI ? "#ede9fe" : isSIF ? "#fef2f2" : isLT ? "#fff7ed" : isRec ? "#eff6ff" : "#f1f5f9";
  const col = isAI ? "#7c3aed" : isSIF ? "#dc2626" : isLT ? "#c2410c" : isRec ? "#1d4ed8" : "#475569";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${bg};color:${col};font-size:10px;font-weight:700;margin-right:4px;${FONT}">${tag}</span>`;
}
