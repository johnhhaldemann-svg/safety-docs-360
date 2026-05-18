export const PREDICTABILITY_DATA_MODES = [
  "company_only",
  "company_then_platform",
  "company_then_osha",
  "company_then_platform_then_osha",
  "platform_aggregate_only",
  "osha_only",
] as const;

export type PredictabilityDataMode = (typeof PREDICTABILITY_DATA_MODES)[number];

export const PREDICTABILITY_BENCHMARK_SOURCES = ["company", "platform_aggregate", "osha"] as const;

export type PredictabilityBenchmarkSource = (typeof PREDICTABILITY_BENCHMARK_SOURCES)[number];
export type PredictabilityPredictionSource = PredictabilityBenchmarkSource | "insufficient_data";

export type PredictabilityConfidenceLevel = "high" | "medium" | "low";

export type PredictabilityDataScope =
  | "company_specific"
  | "anonymized_platform_aggregate"
  | "public_osha_baseline"
  | "none";

export type PredictabilitySettings = {
  predictabilityDataMode: PredictabilityDataMode;
  allowCompanyData: boolean;
  allowPlatformAggregateFallback: boolean;
  allowOshaFallback: boolean;
  visibleBenchmarkSources: PredictabilityBenchmarkSource[];
};

export type PredictabilitySourceMetadata = {
  source: PredictabilityPredictionSource;
  predictionSource: PredictabilityPredictionSource;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  confidenceLevel: PredictabilityConfidenceLevel;
  dataScope: PredictabilityDataScope;
};

export const DEFAULT_PREDICTABILITY_SETTINGS: PredictabilitySettings = {
  predictabilityDataMode: "company_then_platform_then_osha",
  allowCompanyData: true,
  allowPlatformAggregateFallback: true,
  allowOshaFallback: true,
  visibleBenchmarkSources: ["company", "platform_aggregate", "osha"],
};

export const PREDICTABILITY_MODE_LABELS: Record<PredictabilityDataMode, string> = {
  company_only: "Company data only",
  company_then_platform: "Company + platform benchmark",
  company_then_osha: "Company + OSHA",
  company_then_platform_then_osha: "Company + platform + OSHA",
  platform_aggregate_only: "Platform benchmark only",
  osha_only: "OSHA only",
};

export const PREDICTABILITY_MODE_DESCRIPTIONS: Record<PredictabilityDataMode, string> = {
  company_only: "Only use this company's own data.",
  company_then_platform:
    "Use company data first, then anonymized platform-wide aggregate data if company data is insufficient.",
  company_then_osha: "Use company data first, then OSHA public baseline data if company data is insufficient.",
  company_then_platform_then_osha:
    "Use company data first, then platform aggregate data, then OSHA baseline if needed.",
  platform_aggregate_only: "Use anonymized platform benchmark data only.",
  osha_only: "Use OSHA baseline data only.",
};

const SOURCE_TO_SCOPE: Record<PredictabilityPredictionSource, PredictabilityDataScope> = {
  company: "company_specific",
  platform_aggregate: "anonymized_platform_aggregate",
  osha: "public_osha_baseline",
  insufficient_data: "none",
};

const SOURCE_TO_CONFIDENCE: Record<PredictabilityPredictionSource, PredictabilityConfidenceLevel> = {
  company: "high",
  platform_aggregate: "medium",
  osha: "low",
  insufficient_data: "low",
};

export function isPredictabilityDataMode(value: unknown): value is PredictabilityDataMode {
  return typeof value === "string" && PREDICTABILITY_DATA_MODES.includes(value as PredictabilityDataMode);
}

export function isPredictabilityBenchmarkSource(value: unknown): value is PredictabilityBenchmarkSource {
  return (
    typeof value === "string" &&
    PREDICTABILITY_BENCHMARK_SOURCES.includes(value as PredictabilityBenchmarkSource)
  );
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function uniqueVisibleSources(value: unknown, fallback: PredictabilityBenchmarkSource[]): PredictabilityBenchmarkSource[] {
  if (!Array.isArray(value)) return [...fallback];
  const out: PredictabilityBenchmarkSource[] = [];
  for (const raw of value) {
    if (!isPredictabilityBenchmarkSource(raw) || out.includes(raw)) continue;
    out.push(raw);
  }
  return out.length > 0 ? out : [...fallback];
}

export function normalizePredictabilitySettings(value: unknown): PredictabilitySettings {
  const input = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const mode = isPredictabilityDataMode(input.predictabilityDataMode)
    ? input.predictabilityDataMode
    : DEFAULT_PREDICTABILITY_SETTINGS.predictabilityDataMode;

  return {
    predictabilityDataMode: mode,
    allowCompanyData: booleanOrDefault(input.allowCompanyData, DEFAULT_PREDICTABILITY_SETTINGS.allowCompanyData),
    allowPlatformAggregateFallback: booleanOrDefault(
      input.allowPlatformAggregateFallback,
      DEFAULT_PREDICTABILITY_SETTINGS.allowPlatformAggregateFallback
    ),
    allowOshaFallback: booleanOrDefault(input.allowOshaFallback, DEFAULT_PREDICTABILITY_SETTINGS.allowOshaFallback),
    visibleBenchmarkSources: uniqueVisibleSources(
      input.visibleBenchmarkSources,
      DEFAULT_PREDICTABILITY_SETTINGS.visibleBenchmarkSources
    ),
  };
}

export function sourceMetadataForPrediction(
  source: PredictabilityPredictionSource,
  options?: { fallbackUsed?: boolean; fallbackReason?: string | null }
): PredictabilitySourceMetadata {
  return {
    source,
    predictionSource: source,
    fallbackUsed: Boolean(options?.fallbackUsed),
    fallbackReason: options?.fallbackReason ?? null,
    confidenceLevel: SOURCE_TO_CONFIDENCE[source],
    dataScope: SOURCE_TO_SCOPE[source],
  };
}

export function dataSourceSequenceForSettings(settingsInput?: unknown): PredictabilityBenchmarkSource[] {
  const settings = normalizePredictabilitySettings(settingsInput);
  const base: PredictabilityBenchmarkSource[] =
    settings.predictabilityDataMode === "company_only"
      ? ["company"]
      : settings.predictabilityDataMode === "company_then_platform"
        ? ["company", "platform_aggregate"]
        : settings.predictabilityDataMode === "company_then_osha"
          ? ["company", "osha"]
          : settings.predictabilityDataMode === "platform_aggregate_only"
            ? ["platform_aggregate", ...(settings.allowOshaFallback ? (["osha"] as const) : [])]
            : settings.predictabilityDataMode === "osha_only"
              ? ["osha"]
              : ["company", "platform_aggregate", "osha"];

  return base.filter((source) => {
    if (source === "company") return settings.allowCompanyData;
    if (source === "platform_aggregate") return settings.allowPlatformAggregateFallback;
    return settings.allowOshaFallback;
  });
}
