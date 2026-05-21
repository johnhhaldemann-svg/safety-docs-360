import {
  dataSourceSequenceForSettings,
  normalizePredictabilitySettings,
  sourceMetadataForPrediction,
  type PredictabilityBenchmarkSource,
  type PredictabilityPredictionSource,
  type PredictabilitySettings,
  type PredictabilitySourceMetadata,
} from "@/lib/predictability/settings";

export type PredictabilityDataThresholds = {
  minCompanyRecordsForPrediction: number;
  minCompanyObservationDays: number;
  minPlatformAggregateRecords: number;
  minPlatformAggregateCompanies: number;
  minPlatformObservationDays: number;
};

export const DEFAULT_PREDICTABILITY_THRESHOLDS: PredictabilityDataThresholds = {
  minCompanyRecordsForPrediction: 30,
  minCompanyObservationDays: 30,
  minPlatformAggregateRecords: 500,
  minPlatformAggregateCompanies: 5,
  minPlatformObservationDays: 90,
};

export type PredictabilityMaturity = {
  recordCount: number;
  observationDays: number;
};

export type PlatformAggregateMaturity = PredictabilityMaturity & {
  companyCount: number;
};

export type PredictabilityDataSource =
  | {
      source: "company";
      fallbackUsed: false;
      reason: null;
      confidenceLevel: "high";
      dataScope: "company_specific";
      metadata: PredictabilitySourceMetadata;
    }
  | {
      source: "platform_aggregate";
      fallbackUsed: boolean;
      reason: string;
      confidenceLevel: "medium";
      dataScope: "anonymized_platform_aggregate";
      metadata: PredictabilitySourceMetadata;
    }
  | {
      source: "osha";
      fallbackUsed: boolean;
      reason: string;
      confidenceLevel: "low";
      dataScope: "public_osha_baseline";
      metadata: PredictabilitySourceMetadata;
    }
  | {
      source: "insufficient_data";
      fallbackUsed: false;
      reason: string;
      confidenceLevel: "low";
      dataScope: "none";
      metadata: PredictabilitySourceMetadata;
    };

export type PredictabilityDataSourceProviders = {
  getCompanyMaturity: (companyId: string) => Promise<PredictabilityMaturity>;
  getPlatformAggregateMaturity: () => Promise<PlatformAggregateMaturity>;
};

function withThresholds(overrides?: Partial<PredictabilityDataThresholds>): PredictabilityDataThresholds {
  return { ...DEFAULT_PREDICTABILITY_THRESHOLDS, ...overrides };
}

export function companyHasEnoughPredictabilityData(
  maturity: PredictabilityMaturity,
  thresholdsInput?: Partial<PredictabilityDataThresholds>
): boolean {
  const thresholds = withThresholds(thresholdsInput);
  return (
    maturity.recordCount >= thresholds.minCompanyRecordsForPrediction &&
    maturity.observationDays >= thresholds.minCompanyObservationDays
  );
}

export function platformAggregateIsMature(
  maturity: PlatformAggregateMaturity,
  thresholdsInput?: Partial<PredictabilityDataThresholds>
): boolean {
  const thresholds = withThresholds(thresholdsInput);
  return (
    maturity.recordCount >= thresholds.minPlatformAggregateRecords &&
    maturity.companyCount >= thresholds.minPlatformAggregateCompanies &&
    maturity.observationDays >= thresholds.minPlatformObservationDays
  );
}

function sourceReason(
  source: PredictabilityPredictionSource,
  seenInsufficient: PredictabilityBenchmarkSource[]
): string {
  if (source === "platform_aggregate") {
    return "Company does not have enough data yet";
  }
  if (source === "osha") {
    return seenInsufficient.includes("platform_aggregate")
      ? "Company and platform aggregate data are not sufficient yet"
      : "Company does not have enough data yet";
  }
  return "Prediction data source is not sufficient for the selected company settings.";
}

function insufficientReason(
  sequence: PredictabilityBenchmarkSource[],
  seenInsufficient: PredictabilityBenchmarkSource[]
): string {
  if (sequence.length === 0) {
    return "No Predictability Engine data sources are enabled for this company.";
  }
  if (sequence.length === 1 && sequence[0] === "company") {
    return "Company data only is enabled, but this company does not have enough data yet.";
  }
  if (seenInsufficient.includes("platform_aggregate")) {
    return "Company and platform aggregate data are not sufficient, and OSHA fallback is disabled.";
  }
  return "Enabled Predictability Engine data sources do not have enough data yet.";
}

function resolved<T extends PredictabilityDataSource>(
  source: T["source"],
  fallbackUsed: boolean,
  reason: string | null
): T {
  const metadata = sourceMetadataForPrediction(source, { fallbackUsed, fallbackReason: reason });
  return {
    source,
    fallbackUsed,
    reason,
    confidenceLevel: metadata.confidenceLevel,
    dataScope: metadata.dataScope,
    metadata,
  } as T;
}

export async function resolvePredictabilityDataSource(
  companyId: string,
  settingsInput: Partial<PredictabilitySettings> | PredictabilitySettings | null | undefined,
  providers: PredictabilityDataSourceProviders,
  thresholdsInput?: Partial<PredictabilityDataThresholds>
): Promise<PredictabilityDataSource> {
  const settings = normalizePredictabilitySettings(settingsInput);
  const sequence = dataSourceSequenceForSettings(settings);
  const thresholds = withThresholds(thresholdsInput);
  const seenInsufficient: PredictabilityBenchmarkSource[] = [];

  let companyMaturity: PredictabilityMaturity | null = null;
  let platformMaturity: PlatformAggregateMaturity | null = null;

  for (const source of sequence) {
    if (source === "company") {
      companyMaturity = companyMaturity ?? (await providers.getCompanyMaturity(companyId));
      if (companyHasEnoughPredictabilityData(companyMaturity, thresholds)) {
        return resolved<PredictabilityDataSource & { source: "company" }>("company", false, null);
      }
      seenInsufficient.push("company");
      continue;
    }

    if (source === "platform_aggregate") {
      platformMaturity = platformMaturity ?? (await providers.getPlatformAggregateMaturity());
      if (platformAggregateIsMature(platformMaturity, thresholds)) {
        const fallbackUsed = seenInsufficient.length > 0;
        return resolved<PredictabilityDataSource & { source: "platform_aggregate" }>(
          "platform_aggregate",
          fallbackUsed,
          fallbackUsed ? sourceReason("platform_aggregate", seenInsufficient) : null
        );
      }
      seenInsufficient.push("platform_aggregate");
      continue;
    }

    const fallbackUsed = seenInsufficient.length > 0;
    return resolved<PredictabilityDataSource & { source: "osha" }>(
      "osha",
      fallbackUsed,
      fallbackUsed ? sourceReason("osha", seenInsufficient) : null
    );
  }

  return resolved<PredictabilityDataSource & { source: "insufficient_data" }>(
    "insufficient_data",
    false,
    insufficientReason(sequence, seenInsufficient)
  );
}
