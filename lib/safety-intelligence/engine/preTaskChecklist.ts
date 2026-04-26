import type { AiReviewContext, PreTaskChecklistItem } from "@/types/safety-intelligence";

function nextId(prefix: string, index: number) {
  return `${prefix}_${index}`;
}

/**
 * Deterministic pre-task checklist from rules, permits, weather, conflicts, and prevention logic.
 */
export function buildPreTaskChecklist(context: AiReviewContext): PreTaskChecklistItem[] {
  const items: PreTaskChecklistItem[] = [];
  let n = 0;

  for (const bucket of context.buckets) {
    if (bucket.weatherConditionCode) {
      n += 1;
      items.push({
        id: nextId("wx", n),
        text: `Confirm weather plan for condition: ${bucket.weatherConditionCode.replace(/_/g, " ")}`,
        source: "weather",
        required: true,
      });
    }
    for (const p of bucket.permitTriggers) {
      if (p === "none") continue;
      n += 1;
      items.push({
        id: nextId("perm", n),
        text: `Permit / authorization verified: ${p.replace(/_/g, " ")}`,
        source: "permit",
        required: true,
      });
    }
    for (const c of bucket.requiredControls) {
      n += 1;
      items.push({
        id: nextId("ctrl", n),
        text: `Control in place: ${c.replace(/_/g, " ")}`,
        source: "rule",
        required: true,
      });
    }
  }

  for (const ev of context.conflictEvaluations) {
    for (const c of ev.conflicts) {
      if (c.severity === "high" || c.severity === "critical") {
        n += 1;
        items.push({
          id: nextId("conf", n),
          text: `Coordination / SIMOPs: ${c.rationale}`,
          source: "conflict",
          required: true,
        });
      }
    }
  }

  const prevention = context.preventionLogic;
  if (prevention) {
    for (const t of prevention.trainingGaps.slice(0, 6)) {
      n += 1;
      items.push({
        id: nextId("tr", n),
        text: t,
        source: "rule",
        required: false,
      });
    }
    for (const h of prevention.documentQualityHints.slice(0, 3)) {
      n += 1;
      items.push({
        id: nextId("dq", n),
        text: h,
        source: "memory",
        required: false,
      });
    }
  }

  const rm = context.riskMemorySummary;
  if (rm && typeof rm === "object" && Array.isArray(rm.topHazards)) {
    for (const row of (rm.topHazards as { code?: string | null; count?: number }[]).slice(0, 3)) {
      if (row?.code) {
        n += 1;
        items.push({
          id: nextId("rm", n),
          text: `Stress-test plan against recurring hazard theme: ${String(row.code)} (${row.count ?? 0} signals)`,
          source: "memory",
          required: false,
        });
      }
    }
  }

  const seen = new Set<string>();
  const deduped: PreTaskChecklistItem[] = [];
  for (const it of items) {
    const key = `${it.source}:${it.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  return deduped;
}
