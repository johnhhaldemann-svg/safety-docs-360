import type { InjuryWeatherDashboardData } from "@/lib/injuryWeather/types";

export type LeadingIndicatorTargetItem = {
  /** Short label for the row */
  label: string;
  /** What to target and how it helps prevent injury */
  action: string;
};

export type LeadingIndicatorTargetsResult = {
  headline: string;
  subline: string;
  items: LeadingIndicatorTargetItem[];
};

/**
 * Derives actionable “what to target” bullets from the same data that feeds the risk model,
 * so admins can aim training, inspections, and controls at real leading indicators.
 */
export function buildLeadingIndicatorTargets(data: InjuryWeatherDashboardData): LeadingIndicatorTargetsResult {
  const s = data.summary;
  const p = data.signalProvenance;
  const total = Math.max(1, s.predictedObservations);
  const highPct = Math.min(100, Math.round((s.potentialInjuryEvents / total) * 100));

  const items: LeadingIndicatorTargetItem[] = [];

  const sor = p.sorRecords;
  const ca = p.correctiveActions;
  const inc = p.incidents;
  const maxSource = Math.max(sor, ca, inc);
  let mixHint =
    "Balance observation quality, timely corrective action, and incident learning so no single channel is blind.";
  if (maxSource === sor && sor > 0) {
    mixHint =
      "SOR volume leads the mix—target field hazard recognition, verification, and trending of repeat themes before they escalate.";
  } else if (maxSource === ca && ca > 0) {
    mixHint =
      "Corrective actions lead the mix—target closure discipline, verification, and handoff so fixes stick and do not recur.";
  } else if (maxSource === inc && inc > 0) {
    mixHint =
      "Incidents are prominent in the window—target precursor controls, near-miss reporting, and learning loops to prevent repeats.";
  }

  items.push({
    label: "Signal mix (leading inputs to the model)",
    action: `${p.recordWindowLabel}: ${sor} SOR · ${ca} corrective actions · ${inc} incidents. ${mixHint}`,
  });

  if (highPct >= 20) {
    items.push({
      label: "High / critical severity share",
      action: `About ${highPct}% of weighted signals are high or critical. Target: reduce that share with immediate field response, verification, and supervisor signoff where required.`,
    });
  } else if (total >= 5) {
    items.push({
      label: "High / critical severity share",
      action: `High/critical mix is ${highPct}%—keep driving it down with verification and repeat-hazard reviews.`,
    });
  }

  const focusPairs: string[] = [];
  for (const tf of data.tradeForecasts.slice(0, 4)) {
    const top = tf.categories[0];
    if (top) {
      const n = top.sourceObservationCount;
      const suffix = n != null && n > 0 ? ` (${n} obs. in window)` : "";
      focusPairs.push(`${tf.trade} → ${top.name}${suffix}`);
    }
  }
  if (focusPairs.length > 0) {
    items.push({
      label: "Trade & hazard categories to prioritize",
      action: `Target inspections, toolbox talks, and engineered controls on: ${focusPairs.join(" · ")}.`,
    });
  }

  const b = data.behaviorSignals;
  const behaviorAny =
    (b.fatigueIndicators ?? 0) > 0 ||
    (b.rushingIndicators ?? 0) > 0 ||
    (b.newWorkerRatio ?? 0) > 0 ||
    (b.overtimeHours ?? 0) > 0;
  if (behaviorAny) {
    const parts: string[] = [];
    if (b.fatigueIndicators > 0) parts.push(`fatigue indicators ${b.fatigueIndicators}`);
    if (b.rushingIndicators > 0) parts.push(`rushing indicators ${b.rushingIndicators}`);
    if (b.newWorkerRatio > 0) parts.push(`new/short-tenure workers ${b.newWorkerRatio}%`);
    if (b.overtimeHours > 0) parts.push(`overtime index ${b.overtimeHours}`);
    items.push({
      label: "Operational & crew load (your inputs)",
      action: `You indicated elevated ${parts.join("; ")}. Target: staffing, scheduling, orientation, and work pacing to match exposure before injuries occur.`,
    });
  }

  const ws = data.workSchedule;
  if (ws.workSevenDaysPerWeek || (ws.hoursPerDay != null && ws.hoursPerDay > 8)) {
    const days = ws.workSevenDaysPerWeek ? 7 : 5;
    const h = ws.hoursPerDay ?? 8;
    items.push({
      label: "Schedule / hours exposure",
      action: `Schedule modeled as ${days} days × ${h} h/day. Target: fatigue rules, rotation, and supervision density on long weeks or long shifts.`,
    });
  }

  if (s.predictedObservations < 3 && p.mode === "live") {
    items.push({
      label: "Data thickness",
      action:
        "Very few signals in this window—the model has little to work with. Target: increase observation cadence and timely logging so leading indicators can surface patterns.",
    });
  }

  return {
    headline: "Leading indicators to target",
    subline:
      "Aim training, engineering controls, and field verification at these levers—they feed the model before injuries show up in lagging metrics.",
    items,
  };
}
