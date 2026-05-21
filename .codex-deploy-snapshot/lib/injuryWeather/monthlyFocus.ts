import { buildLeadingIndicatorTargets } from "@/lib/injuryWeather/leadingIndicatorTargets";
import { buildOshaCrossReference } from "@/lib/injuryWeather/oshaHistory";
import type {
  InjuryWeatherDashboardData,
  InjuryWeatherMonthlyFocusItem,
  InjuryWeatherMonthlyFocusSource,
  RiskLevel,
  TradeForecast,
} from "@/lib/injuryWeather/types";

const RISK_WEIGHT: Record<RiskLevel, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MODERATE: 3,
  LOW: 2,
};

type Candidate = {
  title: string;
  rationale: string;
  sources: InjuryWeatherMonthlyFocusSource[];
  weight: number;
};

function sortCategoriesForFocus(tf: TradeForecast) {
  return [...tf.categories].sort((a, b) => {
    const rw = (RISK_WEIGHT[b.riskLevel] ?? 0) - (RISK_WEIGHT[a.riskLevel] ?? 0);
    if (rw !== 0) return rw;
    return (b.predictedCount ?? 0) - (a.predictedCount ?? 0);
  });
}

function dedupeAndRank(candidates: Candidate[], maxItems: number): InjuryWeatherMonthlyFocusItem[] {
  const byKey = new Map<
    string,
    { title: string; rationale: string; sources: Set<InjuryWeatherMonthlyFocusSource>; weight: number }
  >();
  for (const c of candidates) {
    const key = c.title.trim().toLowerCase().slice(0, 160);
    const prev = byKey.get(key);
    if (!prev || c.weight > prev.weight) {
      byKey.set(key, {
        title: c.title.trim(),
        rationale: c.rationale.trim(),
        sources: new Set(c.sources),
        weight: c.weight,
      });
    } else {
      for (const s of c.sources) prev.sources.add(s);
    }
  }
  const merged = [...byKey.values()].sort((a, b) => b.weight - a.weight);
  return merged.slice(0, maxItems).map((row, i) => ({
    rank: i + 1,
    title: row.title,
    rationale: row.rationale,
    sources: [...row.sources],
  }));
}

/**
 * Deterministic monthly priorities for superadmin Safety Forecast — no LLM.
 * Merges workspace trade/category signals, leading-indicator narrative, NAICS/NSC benchmark context,
 * and static sector hazard themes (not employer OSHA records).
 */
export function buildMonthlyFocusItems(data: InjuryWeatherDashboardData): InjuryWeatherMonthlyFocusItem[] {
  const candidates: Candidate[] = [];
  const month = data.summary.month;

  for (const tf of data.tradeForecasts) {
    const sorted = sortCategoriesForFocus(tf);
    for (const cat of sorted.slice(0, 2)) {
      if (!cat?.name || cat.name === "No observations in selected window") continue;
      const obs = cat.sourceObservationCount ?? 0;
      const provenance = tf.forecastProvenance === "live";
      const weight =
        (RISK_WEIGHT[cat.riskLevel] ?? 1) * 12 +
        Math.min(8, obs) +
        Math.min(6, Math.round(cat.predictedCount ?? 0));
      const rationaleParts = [
        `${cat.riskLevel} risk for ${month}.`,
        obs > 0 ? `${obs} logged observation(s) in the current record window.` : null,
        provenance ? null : "Card may use model blend when live observations are sparse.",
        cat.note ? String(cat.note) : null,
      ].filter(Boolean);
      candidates.push({
        title: `${tf.trade}: ${cat.name}`,
        rationale: rationaleParts.join(" "),
        sources: ["workspace"],
        weight,
      });
    }
  }

  const li = data.summary.likelyInjuryInsight;
  if (li?.hasData) {
    candidates.push({
      title: `Blended injury pattern: ${li.headline}`,
      rationale: li.detailNote,
      sources: ["workspace"],
      weight: 14,
    });
  }

  const leading = buildLeadingIndicatorTargets(data);
  for (const item of leading.items.slice(0, 4)) {
    candidates.push({
      title: item.label,
      rationale: item.action,
      sources: ["workspace"],
      weight: item.label.includes("severity") ? 9 : 6,
    });
  }

  const ctx = data.industryBenchmarkContext;
  if (ctx.recordableCasesPer200kHours != null) {
    const prefix = ctx.dominantNaicsPrefix ? `NAICS prefix ${ctx.dominantNaicsPrefix}` : "sector profile";
    candidates.push({
      title: "Industry reference rate (NSC / NAICS profile)",
      rationale: `Illustrative ~${ctx.recordableCasesPer200kHours} recordable cases per 200k hours (${prefix}). ${ctx.benchmarkSummary}`.slice(
        0,
        480
      ),
      sources: ["benchmark"],
      weight: 5,
    });
  } else if (ctx.benchmarkSummary?.trim()) {
    candidates.push({
      title: "Industry benchmark context",
      rationale: ctx.benchmarkSummary.slice(0, 400),
      sources: ["benchmark"],
      weight: 4,
    });
  }

  const tradeNames = data.tradeForecasts.map((t) => t.trade);
  const osha = buildOshaCrossReference(tradeNames);
  for (const m of osha.matchedTrades.slice(0, 4)) {
    candidates.push({
      title: `${m.trade}: sector recurring hazard themes`,
      rationale: `${osha.source}. Not your company’s record — baseline themes: ${m.recurringHazards.join(", ")}.`,
      sources: ["sector_reference"],
      weight: 3,
    });
  }

  if (candidates.length === 0) {
    return [
      {
        rank: 1,
        title: "Add safety signals for a tailored monthly focus",
        rationale:
          "Log SOR observations, corrective actions, and structured incidents for the selected company/jobsite and month. Until then, review sector reference panels and forecast parameters.",
        sources: ["workspace"],
      },
    ];
  }

  return dedupeAndRank(candidates, 8);
}
