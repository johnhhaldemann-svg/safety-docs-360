type OshaTradeHistory = {
  trade: string;
  yearlyInjuryRatePer100Workers: Record<string, number>;
  recurringHazards: string[];
};

const OSHA_TRADE_HISTORY: OshaTradeHistory[] = [
  {
    trade: "Roofing",
    yearlyInjuryRatePer100Workers: { "2020": 3.8, "2021": 3.6, "2022": 3.7, "2023": 3.5, "2024": 3.4 },
    recurringHazards: ["Fall Protection", "Ladder Safety", "PPE Compliance"],
  },
  {
    trade: "Electrical",
    yearlyInjuryRatePer100Workers: { "2020": 3.2, "2021": 3.1, "2022": 3.0, "2023": 2.9, "2024": 2.9 },
    recurringHazards: ["Lockout/Tagout (LOTO)", "Temporary Power", "Arc Flash"],
  },
  {
    trade: "Concrete",
    yearlyInjuryRatePer100Workers: { "2020": 3.4, "2021": 3.3, "2022": 3.2, "2023": 3.1, "2024": 3.1 },
    recurringHazards: ["Struck-By Hazards", "Formwork Safety", "Material Handling"],
  },
  {
    trade: "Steel Work",
    yearlyInjuryRatePer100Workers: { "2020": 3.6, "2021": 3.5, "2022": 3.4, "2023": 3.3, "2024": 3.2 },
    recurringHazards: ["Rigging Safety", "Welding Safety", "Fall Exposure"],
  },
  {
    trade: "General Contractor",
    yearlyInjuryRatePer100Workers: { "2020": 3.3, "2021": 3.2, "2022": 3.1, "2023": 3.0, "2024": 3.0 },
    recurringHazards: ["Housekeeping", "Caught-in/Between", "Coordination Failures"],
  },
];

function normalizeTradeName(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("roof")) return "Roofing";
  if (v.includes("elect")) return "Electrical";
  if (v.includes("concrete")) return "Concrete";
  if (v.includes("steel") || v.includes("rig")) return "Steel Work";
  return "General Contractor";
}

export function buildOshaCrossReference(trades: string[]) {
  const unique = [...new Set(trades.map(normalizeTradeName))];
  const matched = unique
    .map((name) => OSHA_TRADE_HISTORY.find((row) => row.trade === name))
    .filter(Boolean) as OshaTradeHistory[];
  const years = ["2020", "2021", "2022", "2023", "2024"];
  const yearlyAverageRate = Object.fromEntries(
    years.map((year) => [
      year,
      Number(
        (
          matched.reduce((sum, row) => sum + (row.yearlyInjuryRatePer100Workers[year] ?? 0), 0) /
          Math.max(1, matched.length)
        ).toFixed(2)
      ),
    ])
  );
  return {
    source: "OSHA prior-year construction injury history baseline (2020-2024)",
    matchedTrades: matched,
    blendedInjuryRatePer100Workers: yearlyAverageRate,
  };
}
