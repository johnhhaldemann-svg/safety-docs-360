import type { CanonicalInjuryCategory, InjuryTypeScore, WeatherEnvironmentInput } from "./types";

const LABELS: Record<CanonicalInjuryCategory, string> = {
  slip_trip_fall: "Slip / trip / fall",
  struck_by: "Struck-by",
  caught_between: "Caught-in / between",
  overexertion: "Overexertion / ergonomic",
  electrical: "Electrical",
  rigging_material_handling: "Rigging / material handling",
  heat_illness: "Heat illness",
  hand_injury: "Hand / pinch",
  laceration: "Cut / laceration",
  vehicle_equipment: "Vehicle / equipment",
};

type ScoreCtx = {
  textBlob: string;
  weather: WeatherEnvironmentInput;
  heatOutdoorExposure: number;
};

const RULES: { cat: CanonicalInjuryCategory; re: RegExp; w: number }[] = [
  { cat: "slip_trip_fall", re: /slip|trip|fall|walkway|housekeeping|cord|egress|ice|wet/i, w: 1 },
  { cat: "struck_by", re: /struck|swing|load|personnel|backing|vehicle|forklift/i, w: 1 },
  { cat: "caught_between", re: /pinch|caught|between|nip|shear/i, w: 1 },
  { cat: "electrical", re: /electric|arc|shock|loto|energ/i, w: 1.1 },
  { cat: "rigging_material_handling", re: /rig|crane|hoist|lift|suspended|staging|material/i, w: 1 },
  { cat: "heat_illness", re: /heat|hydration|sun|outdoor/i, w: 0.8 },
  { cat: "hand_injury", re: /hand|glove|pinch/i, w: 0.9 },
  { cat: "laceration", re: /cut|sharp|lacerat/i, w: 0.9 },
  { cat: "vehicle_equipment", re: /vehicle|equipment|mobile|forklift|haul/i, w: 1 },
  { cat: "overexertion", re: /lift|ergo|twist|manual\s*hand/i, w: 0.85 },
];

/**
 * Injury-type scores: keyword lift from observation text plus weather sensitivities (falls ↔ slip/rain, rigging ↔ wind).
 */
export function scoreLikelyInjuryTypes(ctx: ScoreCtx): InjuryTypeScore[] {
  const hay = ctx.textBlob.toLowerCase();
  const scores = new Map<CanonicalInjuryCategory, number>();

  for (const r of RULES) {
    if (r.re.test(hay)) {
      scores.set(r.cat, (scores.get(r.cat) ?? 0) + r.w);
    }
  }

  scores.set("slip_trip_fall", (scores.get("slip_trip_fall") ?? 0) + ctx.weather.slipSurfaceIndex * 1.2 + ctx.weather.rainIndex * 0.9);
  scores.set(
    "rigging_material_handling",
    (scores.get("rigging_material_handling") ?? 0) + ctx.weather.windIndex * 1.1
  );
  scores.set(
    "heat_illness",
    (scores.get("heat_illness") ?? 0) + ctx.weather.heatStressIndex * 1.25 + ctx.heatOutdoorExposure * 0.5
  );

  const out: InjuryTypeScore[] = [];
  for (const cat of Object.keys(LABELS) as CanonicalInjuryCategory[]) {
    const s = scores.get(cat) ?? 0;
    if (s <= 0) continue;
    const confidence = Math.min(100, 40 + s * 15);
    out.push({
      category: cat,
      displayLabel: LABELS[cat],
      score: s,
      confidence,
      explanation: explainFor(cat),
    });
  }

  out.sort((a, b) => b.score - a.score);
  const top = out.slice(0, 3);
  if (top.length > 0) return top;
  return [
    {
      category: "slip_trip_fall",
      displayLabel: LABELS.slip_trip_fall,
      score: 0.35,
      confidence: 28,
      explanation: "Default prior when no hazard keywords matched — refine with richer observation text.",
    },
    {
      category: "struck_by",
      displayLabel: LABELS.struck_by,
      score: 0.3,
      confidence: 26,
      explanation: "Construction default exposure prior (struck-by) until signals differentiate.",
    },
    {
      category: "rigging_material_handling",
      displayLabel: LABELS.rigging_material_handling,
      score: 0.28,
      confidence: 24,
      explanation: "Handling / lifting prior — will move with rigging or material keywords + wind context.",
    },
  ];
}

function explainFor(cat: CanonicalInjuryCategory): string {
  if (cat === "slip_trip_fall") return "Elevated by housekeeping / access cues and surface + rain exposure in the environment layer.";
  if (cat === "rigging_material_handling") return "Elevated by rigging / lifting keywords and wind exposure.";
  if (cat === "heat_illness") return "Elevated by heat indices and outdoor exposure assumptions.";
  if (cat === "electrical") return "Elevated by electrical / LOTO-related observation text.";
  return "Elevated by matching hazard keywords in recent safety signals.";
}
