import type {
  RiskDriver,
  SafetyAiAssessment,
  SafetyAiScoreBreakdown,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";

function levelPhrase(level: SafetyRiskLevel) {
  if (level === "critical") return "critical potential risk";
  if (level === "high") return "high potential risk";
  if (level === "moderate") return "moderate potential risk";
  return "low potential risk";
}

export function buildSafetyExplanation(params: {
  score: number;
  level: SafetyRiskLevel;
  confidence: SafetyAiAssessment["confidence"];
  drivers: RiskDriver[];
  missingData: string[];
  breakdown: SafetyAiScoreBreakdown;
}) {
  const topDrivers = params.drivers.slice(0, 3).map((driver) => driver.label);
  const driverText =
    topDrivers.length > 0
      ? ` Main drivers: ${topDrivers.join(", ")}.`
      : " No major risk drivers were found in the available data.";
  const missingText =
    params.missingData.length > 0
      ? ` Missing or uncertain data includes ${params.missingData.join(", ")}.`
      : "";

  return (
    `Based on available data, this rules-based assessment flags ${levelPhrase(params.level)} with a score of ${params.score}/100 and ${params.confidence} confidence.` +
    driverText +
    ` The score uses weighted inputs: severity 40% (${params.breakdown.severity}/5), likelihood 25% (${params.breakdown.likelihood}/5), exposure 15% (${params.breakdown.exposureFrequency}/5), controls 10% (${params.breakdown.controlGap}/5), and data-confidence concern 10% (${params.breakdown.dataConfidenceConcern}/5).` +
    missingText +
    " This does not guarantee compliance and does not replace a competent person, safety manager, legal review, or professional judgment; review recommended when conditions are high-risk or uncertain."
  );
}
