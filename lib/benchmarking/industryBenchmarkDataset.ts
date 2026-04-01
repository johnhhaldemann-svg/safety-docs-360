import type { InjuryWeatherIndustryBenchmarkContext } from "@/lib/injuryWeather/types";

/**
 * Industry reference rates for exposure normalization and AI/analytics context.
 *
 * **Authoritative trends & NAICS detail:** National Safety Council *Injury Facts* Industry Profiles
 * (BLS SOII / CFOI–based). Use this URL when tooling or users need historical series and
 * industry-specific incidence—not the static numbers below alone.
 *
 * @see https://injuryfacts.nsc.org/work/industry-incidence-rates/industry-profiles/
 * @see https://injuryfacts.nsc.org/work/industry-incidence-rates/work-related-incident-rate-trends/
 */

/** NSC pages + narrative aligned with public BLS summaries (e.g. national TRI ~2.3/100 FTE in 2024). */
export const INJURY_FACTS_REFERENCE = {
  injuryFactsIndustryProfilesUrl:
    "https://injuryfacts.nsc.org/work/industry-incidence-rates/industry-profiles/",
  injuryFactsIncidentTrendsUrl:
    "https://injuryfacts.nsc.org/work/industry-incidence-rates/work-related-incident-rate-trends/",
  historicalTrendSummary:
    "NSC Injury Facts summarizes BLS SOII: private industry total recordable case rates have trended near 2.3–2.4 cases per 100 full-time equivalent workers (e.g. ~2.3 in 2024 vs ~2.4 in 2023). Nonfatal illness counts dropped sharply in 2024 (much of it respiratory). BLS detailed SOII is on a biennial publication schedule, and the 2023 OIICS revision is a break—compare multi-year trends cautiously. Use Industry Profiles for NAICS-specific rates and charts.",
  referenceDataNote:
    "In-app sector values are starting points for demos and models. For AI-assisted benchmarking and historical trends, prefer the Industry Profiles and Incident Rate Trends pages above (NSC, sourced from BLS).",
  unitEquivalenceNote:
    "NSC/BLS often report cases per 100 full-time workers; with the usual 2,000 hours/FTE-year convention, that corresponds to the same incidence figure as cases per 200,000 hours worked (OSHA-style). Confirm definitions on Injury Facts for the year you cite.",
} as const;

export type IndustryBenchmarkSectorSlice = {
  naicsPrefix: string;
  /** Total recordable–style cases per 200k hours (aligns with common BLS “per 100 FTE” scale when FTE = 2k hrs/yr). */
  recordableCasesPer200kHours: number | null;
  /** DART-style cases per 200k hours (illustrative; verify in Industry Profiles for your NAICS). */
  dartCasesPer200kHours: number | null;
  /** Fatalities per 200k hours (CFOI-based national stories via NSC; sector values illustrative). */
  fatalityPer200kHours: number | null;
  sourceNote: string;
};

export type IndustryBenchmarkRates = IndustryBenchmarkSectorSlice & typeof INJURY_FACTS_REFERENCE;

const DATASET: Record<string, IndustryBenchmarkSectorSlice> = {
  "23": {
    naicsPrefix: "23",
    recordableCasesPer200kHours: 2.6,
    dartCasesPer200kHours: 1.2,
    fatalityPer200kHours: 0.00014,
    sourceNote:
      "Construction (NAICS 23) — demo default; preventable fatalities often lead sector stories on NSC. Verify current SOII/DART on Injury Facts Industry Profiles.",
  },
  "31": {
    naicsPrefix: "31",
    recordableCasesPer200kHours: 3.1,
    dartCasesPer200kHours: 1.5,
    fatalityPer200kHours: 0.00009,
    sourceNote: "Manufacturing — demo default; cross-check NAICS 31–33 on Industry Profiles.",
  },
  "32": {
    naicsPrefix: "32",
    recordableCasesPer200kHours: 3.1,
    dartCasesPer200kHours: 1.5,
    fatalityPer200kHours: 0.00009,
    sourceNote: "Manufacturing — demo default; cross-check Industry Profiles.",
  },
  "33": {
    naicsPrefix: "33",
    recordableCasesPer200kHours: 3.1,
    dartCasesPer200kHours: 1.5,
    fatalityPer200kHours: 0.00009,
    sourceNote: "Manufacturing — demo default; cross-check Industry Profiles.",
  },
  "48": {
    naicsPrefix: "48",
    recordableCasesPer200kHours: 2.3,
    dartCasesPer200kHours: 1.05,
    fatalityPer200kHours: 0.0001,
    sourceNote:
      "Transportation / warehousing — demo default; high injury counts often highlighted nationally—confirm rates on Industry Profiles.",
  },
  "49": {
    naicsPrefix: "49",
    recordableCasesPer200kHours: 2.3,
    dartCasesPer200kHours: 1.05,
    fatalityPer200kHours: 0.0001,
    sourceNote: "Transportation / postal — demo default; verify on Industry Profiles.",
  },
  "56": {
    naicsPrefix: "56",
    recordableCasesPer200kHours: 1.9,
    dartCasesPer200kHours: 0.75,
    fatalityPer200kHours: 0.00006,
    sourceNote: "Administrative / support / waste — demo default; verify on Industry Profiles.",
  },
};

const DEFAULT_SECTOR: IndustryBenchmarkSectorSlice = {
  naicsPrefix: "00",
  /** ~2.3/100 FTE private industry TRI, 2024 (NSC Injury Facts / BLS summary). */
  recordableCasesPer200kHours: 2.3,
  dartCasesPer200kHours: 1.05,
  fatalityPer200kHours: 0.00009,
  sourceNote:
    "All-industry-style default (~2024 national private TRI per NSC). Set `companies.industry_code` and replace with NAICS-specific values from Industry Profiles when precision matters.",
};

export function naicsPrefixFromCode(code: string | null | undefined): string | null {
  const digits = String(code ?? "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  return digits.slice(0, 2);
}

export function getIndustryBenchmarkRates(industryCode: string | null | undefined): IndustryBenchmarkRates {
  const prefix = naicsPrefixFromCode(industryCode);
  const sector = prefix && DATASET[prefix] ? DATASET[prefix] : DEFAULT_SECTOR;
  return { ...INJURY_FACTS_REFERENCE, ...sector };
}

/** When Supabase admin is unavailable or before company query — still includes Injury Facts URLs. */
export function offlineInjuryWeatherBenchmarkContext(): InjuryWeatherIndustryBenchmarkContext {
  return {
    injuryFactsIndustryProfilesUrl: INJURY_FACTS_REFERENCE.injuryFactsIndustryProfilesUrl,
    injuryFactsIncidentTrendsUrl: INJURY_FACTS_REFERENCE.injuryFactsIncidentTrendsUrl,
    dominantNaicsPrefix: null,
    exampleIndustryCode: null,
    recordableCasesPer200kHours: null,
    benchmarkSummary:
      "Craft/trade chips are not the same as NSC Industry Profiles (NAICS industries). Set company industry codes for in-app benchmark alignment; confirm rates on Injury Facts.",
  };
}
