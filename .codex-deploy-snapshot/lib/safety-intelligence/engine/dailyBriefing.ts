import { mergeRiskOutputWithRiskMemory } from "@/lib/safety-intelligence/ai/riskGrounding";
import type { AiReviewContext, DailyRiskBriefing, DailyRiskBriefingLine } from "@/types/safety-intelligence";

function linesFromPrevention(context: AiReviewContext): DailyRiskBriefingLine[] {
  const p = context.preventionLogic;
  if (!p) return [];
  const out: DailyRiskBriefingLine[] = [];
  for (const text of p.missingControls.slice(0, 4)) {
    out.push({ label: "Control", detail: text, severity: "watch" });
  }
  for (const text of p.permitRecommendations.slice(0, 3)) {
    out.push({ label: "Permit", detail: text, severity: "elevated" });
  }
  for (const text of p.repeatRiskPatterns.slice(0, 4)) {
    out.push({ label: "Pattern", detail: text, severity: "watch" });
  }
  return out;
}

function linesFromRiskMemory(context: AiReviewContext): DailyRiskBriefingLine[] {
  const rm = context.riskMemorySummary;
  if (!rm || typeof rm !== "object") return [];
  const out: DailyRiskBriefingLine[] = [];
  const band =
    rm.aggregatedWithBaseline && typeof rm.aggregatedWithBaseline === "object"
      ? (rm.aggregatedWithBaseline as { band?: string }).band
      : (rm.aggregated as { band?: string } | undefined)?.band;
  if (band) {
    out.push({
      label: "Rollup band",
      detail: `Risk Memory window rollup is ${String(band)}.`,
      severity: band === "critical" || band === "high" ? "elevated" : "info",
    });
  }
  return out;
}

/**
 * Deterministic daily-style briefing from Smart Safety context (no extra LLM call).
 */
export function buildDailyRiskBriefing(context: AiReviewContext): DailyRiskBriefing {
  const now = new Date().toISOString();
  const tasks = context.buckets.map((b) => b.taskTitle).filter(Boolean);
  const headline =
    tasks.length > 0
      ? `Field briefing for: ${tasks.slice(0, 3).join("; ")}${tasks.length > 3 ? "..." : ""}`
      : "Field safety briefing";

  const lines: DailyRiskBriefingLine[] = [
    ...linesFromRiskMemory(context),
    ...linesFromPrevention(context),
  ];

  const stubRisk = mergeRiskOutputWithRiskMemory(
    {
      summary: "",
      exposures: [],
      missingControls: [],
      trendPatterns: [],
      riskScores: [],
      forecastConflicts: [],
      correctiveActions: [],
    },
    context.riskMemorySummary ?? null
  );

  return {
    generatedAt: now,
    companyId: context.companyId,
    jobsiteId: context.jobsiteId ?? null,
    headline,
    lines,
    preventionScore: stubRisk.preventionScore ?? null,
  };
}
