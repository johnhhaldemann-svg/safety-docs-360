/**
 * U.S. construction sector counts transcribed from BLS SOII / CFOI-style tables
 * (nonfatal cases with days away from work; fatal injuries by event).
 *
 * Source files (user-provided exports, 2025):
 * - `2023 Const.xlsx` — sheet "Construction, DAFW 2023+"
 * - `2023 fatal.xlsx` — sheet "Construction fatal 2023-"
 *
 * Re-verify against official BLS releases before citing in compliance contexts.
 * To refresh from new xlsx copies, run: `node scripts/extract-osha-construction-xlsx.mjs <const.xlsx> <fatal.xlsx>`
 */

export type OshaNationalConstructionHighlight = {
  label: string;
  constructionCases: number;
};

export type OshaNationalConstructionFatalHighlight = {
  label: string;
  count2023: number;
};

export type OshaNationalConstructionReference = {
  citation: string;
  nonfatalDaysAwayFromWork: {
    /** Column header from source table (BLS pooled / revision labeling). */
    periodLabel: string;
    allPrivateIndustryCases: number;
    constructionCases: number;
    medianDaysAwayConstruction: number | null;
  };
  fatalitiesInConstruction: {
    year2023: number;
    year2024: number;
  };
  nonfatalEventHighlights: OshaNationalConstructionHighlight[];
  fatalEventHighlights2023: OshaNationalConstructionFatalHighlight[];
};

export function getOshaNationalConstructionReference(): OshaNationalConstructionReference {
  return {
    citation:
      "Counts entered from BLS SOII/CFOI construction tables (private industry); confirm current figures at bls.gov/iif and Injury Facts.",
    nonfatalDaysAwayFromWork: {
      periodLabel: "2023–2024 (per source table labeling — days away from work, nonfatal)",
      allPrivateIndustryCases: 1_834_600,
      constructionCases: 142_560,
      medianDaysAwayConstruction: 11,
    },
    fatalitiesInConstruction: {
      year2023: 1_075,
      year2024: 1_034,
    },
    nonfatalEventHighlights: [
      { label: "Contact incidents (total)", constructionCases: 52_960 },
      { label: "Falls, slips, trips (total)", constructionCases: 45_220 },
      { label: "Fall to lower level", constructionCases: 20_930 },
      { label: "Slip, trip, or fall on same level", constructionCases: 16_540 },
      { label: "Transportation incidents", constructionCases: 7_600 },
    ],
    fatalEventHighlights2023: [
      { label: "Falls, slips, trips (total)", count2023: 421 },
      { label: "Fall to lower level (total)", count2023: 404 },
      { label: "Exposure to harmful substances or environments", count2023: 200 },
      { label: "Transportation incidents", count2023: 240 },
      { label: "Contact incidents (total)", count2023: 148 },
    ],
  };
}
