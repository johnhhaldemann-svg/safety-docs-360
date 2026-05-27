import { BODY_PART_LABELS } from "@/lib/incidents/bodyPart";
import { EXPOSURE_EVENT_TYPE_LABELS } from "@/lib/incidents/exposureEventType";
import { INCIDENT_SOURCE_LABELS } from "@/lib/incidents/incidentSource";
import { INJURY_TYPE_LABELS } from "@/lib/incidents/injuryType";
import type { SafePredictRiskLevel } from "@/lib/safePredictMockData";
import type { OshaLogCaseRow, OshaLogParsedCase, OshaLogSummary, OshaRepeatInjuryDriver } from "@/lib/oshaLogs/types";

type SummarizableCase = OshaLogParsedCase | OshaLogCaseRow;

function field(
  row: SummarizableCase,
  camel: keyof OshaLogParsedCase,
  snake: keyof OshaLogCaseRow
) {
  const record = row as Record<string, OshaLogParsedCase[keyof OshaLogParsedCase] | OshaLogCaseRow[keyof OshaLogCaseRow] | undefined>;
  return record[String(camel)] ?? record[String(snake)];
}

function riskLevelForScore(score: number): SafePredictRiskLevel {
  if (score >= 78) return "critical";
  if (score >= 52) return "high";
  if (score >= 26) return "medium";
  return "low";
}

export function oshaRepeatRiskScore(input: {
  count: number;
  severeCount: number;
  daysAwayTotal: number;
  daysRestrictedTotal: number;
}) {
  return Math.min(
    100,
    Math.round(
      input.count * 14 +
        input.severeCount * 16 +
        Math.min(18, input.daysAwayTotal * 0.8) +
        Math.min(10, input.daysRestrictedTotal * 0.35)
    )
  );
}

export function summarizeOshaLogCases(cases: SummarizableCase[], options?: { imports?: number }): OshaLogSummary {
  const groups = new Map<string, SummarizableCase[]>();
  for (const row of cases) {
    const key = String(field(row, "repeatPatternKey", "repeat_pattern_key") ?? "").trim();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const topDrivers: OshaRepeatInjuryDriver[] = [];
  for (const [key, rows] of groups.entries()) {
    const first = rows[0];
    if (!first) continue;
    const bodyPart = String(field(first, "bodyPart", "body_part") ?? "other") as OshaRepeatInjuryDriver["bodyPart"];
    const injuryType = String(field(first, "injuryType", "injury_type") ?? "other") as OshaRepeatInjuryDriver["injuryType"];
    const exposureEventType = String(field(first, "exposureEventType", "exposure_event_type") ?? "other") as OshaRepeatInjuryDriver["exposureEventType"];
    const injurySource = String(field(first, "injurySource", "injury_source") ?? "other") as OshaRepeatInjuryDriver["injurySource"];
    const daysAwayTotal = rows.reduce((sum, row) => sum + Number(field(row, "daysAwayFromWork", "days_away_from_work") ?? 0), 0);
    const daysRestrictedTotal = rows.reduce((sum, row) => sum + Number(field(row, "daysRestricted", "days_restricted") ?? 0), 0);
    const severeCount = rows.filter((row) => {
      const severity = String(field(row, "severity", "severity") ?? "");
      return severity === "critical" || severity === "high" || field(row, "fatality", "fatality") === true;
    }).length;
    const recordableCount = rows.filter((row) => field(row, "recordable", "recordable") === true).length;
    const dates = rows
      .map((row) => String(field(row, "occurredOn", "occurred_on") ?? ""))
      .filter(Boolean)
      .sort();
    const score = oshaRepeatRiskScore({
      count: rows.length,
      severeCount,
      daysAwayTotal,
      daysRestrictedTotal,
    });
    const bodyLabel = BODY_PART_LABELS[bodyPart] ?? "Other";
    const injuryLabel = INJURY_TYPE_LABELS[injuryType] ?? "Other";
    const exposureLabel = EXPOSURE_EVENT_TYPE_LABELS[exposureEventType] ?? "Other";
    const sourceLabel = INCIDENT_SOURCE_LABELS[injurySource] ?? "Other";
    const riskLevel = riskLevelForScore(score);
    topDrivers.push({
      key,
      label: `${bodyLabel} ${injuryLabel}`.trim(),
      detail: `${rows.length} OSHA-log case${rows.length === 1 ? "" : "s"} share ${exposureLabel.toLowerCase()} / ${sourceLabel.toLowerCase()} patterns.`,
      nextAction:
        riskLevel === "critical"
          ? "Immediate review is recommended. Verify controls and consider whether affected work should pause until repeat-injury controls are confirmed."
          : riskLevel === "high"
            ? "Review this pattern today, verify controls with supervisors, and assign prevention actions before similar work continues."
            : "Review the pattern during planning and confirm the related controls are current.",
      riskLevel,
      score,
      count: rows.length,
      recordableCount,
      severeCount,
      daysAwayTotal,
      daysRestrictedTotal,
      bodyPart,
      injuryType,
      exposureEventType,
      injurySource,
      latestOccurredOn: dates[dates.length - 1] ?? null,
    });
  }

  topDrivers.sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label));

  const missingData: string[] = [];
  if (cases.length === 0) {
    missingData.push("No parsed OSHA log cases are available.");
  }
  if (cases.some((row) => !field(row, "occurredOn", "occurred_on"))) {
    missingData.push("Some imported cases are missing injury dates.");
  }
  if (cases.some((row) => field(row, "parserConfidence", "parser_confidence") === "low")) {
    missingData.push("Some imported cases were parsed with low confidence and need review.");
  }

  return {
    imports: options?.imports ?? 0,
    cases: cases.length,
    recordableCases: cases.filter((row) => field(row, "recordable", "recordable") === true).length,
    topDrivers: topDrivers.slice(0, 12),
    missingData,
  };
}
