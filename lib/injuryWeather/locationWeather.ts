/** US states + DC for Injury Weather location; drives climate/seasonal exposure modifier (not live API). */

import type { InjuryWeatherLocation } from "@/lib/injuryWeather/types";

export const US_STATE_OPTIONS: { code: string; name: string }[] = [
  { code: "", name: "National / not specified" },
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

/** Multiplier applied to injury-risk % (construction outdoor exposure: heat, cold, storms, wind). */
const STATE_WEATHER_MULTIPLIER: Record<string, { factor: number; note: string }> = {
  // Gulf / hurricane & high humidity
  FL: { factor: 1.07, note: "Coastal storms and high heat/humidity increase heat stress and wind exposure." },
  LA: { factor: 1.08, note: "Hurricane season and heavy rain elevate slips, temporary power, and evacuation coordination risk." },
  MS: { factor: 1.05, note: "High humidity and severe weather windows increase outdoor strain." },
  AL: { factor: 1.05, note: "Severe storms and humidity affect roofing and outdoor trades." },
  TX: { factor: 1.06, note: "Heat extremes and storm risk increase heat illness and wind/hail exposure." },
  // Tornado / severe convection
  OK: { factor: 1.07, note: "Severe storms and tornado risk raise rapid-weather planning needs." },
  KS: { factor: 1.06, note: "High wind and storm frequency affect cranes, lifts, and roofing." },
  NE: { factor: 1.05, note: "Severe weather and temperature swings increase planning variance." },
  IA: { factor: 1.04, note: "Storm and flood risk in season affects outdoor work." },
  MO: { factor: 1.04, note: "Severe weather and ice/snow seasons both matter for trade scheduling." },
  // Cold / ice / snow
  AK: { factor: 1.06, note: "Extreme cold and limited daylight increase cold stress and traction hazards." },
  ND: { factor: 1.05, note: "Long cold season increases ice, slips, and equipment cold-start issues." },
  MN: { factor: 1.05, note: "Ice/snow and cold stress elevate slips and cold-weather PPE needs." },
  WI: { factor: 1.05, note: "Winter conditions increase slips, falls, and equipment handling risk." },
  ME: { factor: 1.04, note: "Ice and coastal storms increase outdoor exposure risk." },
  // Desert heat
  AZ: { factor: 1.08, note: "Extreme heat elevates heat illness risk for outdoor crews; schedule and hydration critical." },
  NV: { factor: 1.06, note: "High heat and dry conditions increase heat stress and dust exposure." },
  NM: { factor: 1.05, note: "Heat and altitude variability affect outdoor work pacing." },
  // Pacific NW rain / slip
  WA: { factor: 1.04, note: "Wet conditions increase slip/trip risk and temporary power cord hazards." },
  OR: { factor: 1.04, note: "Rain and mud affect footing, roofing, and equipment access." },
  // Mountain / wildfire smoke (simplified)
  CO: { factor: 1.03, note: "Altitude, rapid weather changes, and seasonal smoke can affect exertion and visibility." },
  MT: { factor: 1.03, note: "Cold snaps and wind affect outdoor exposure." },
  WY: { factor: 1.03, note: "Wind and cold increase rigging and fall protection sensitivity." },
  // Coastal / hurricane Mid-Atlantic
  NC: { factor: 1.05, note: "Hurricane season and humidity affect coastal and roofing work." },
  SC: { factor: 1.05, note: "Heat and storm season elevate outdoor trade risk." },
  GA: { factor: 1.04, note: "Heat and thunderstorm frequency affect outdoor scheduling." },
  // CA: heat + seismic awareness (light touch on injury model)
  CA: { factor: 1.05, note: "Heat waves and dry conditions increase heat stress; wildfire smoke can reduce air quality on site." },
  // HI: tropical
  HI: { factor: 1.05, note: "Tropical storms and humidity affect outdoor work and footing." },
};

/**
 * Outdoor / weather exposure sensitivity by trade (multiplier).
 * Example: roofing 1.25, steel 1.15, concrete 1.05, electrical (interior-biased) 0.95.
 */
export function getTradeWeatherWeight(trade: string): number {
  const k = trade.trim().toLowerCase();
  if (k.includes("roof")) return 1.25;
  if (k.includes("steel") || k.includes("rigging") || k.includes("ironworker")) return 1.15;
  if (k.includes("concrete") || k.includes("formwork") || k.includes("rebar") || k.includes("masonry")) return 1.05;
  if (k.includes("elect") || k.includes("wire") || k.includes("loto")) return 0.95;
  if (k.includes("earth") || k.includes("excavat") || k.includes("roadwork") || k.includes("landscap")) return 1.12;
  if (k.includes("scaffold") || k.includes("demolition") || k.includes("glaz")) return 1.18;
  if (k.includes("plumb") || k.includes("hvac") || k.includes("drywall") || k.includes("paint") || k.includes("carpet"))
    return 0.92;
  if (k.includes("carpent") && !k.includes("concrete")) return 1.02;
  return 1;
}

/** Signal-count–weighted average trade weather weight across all trades in the mix. */
export function effectiveTradeWeatherWeightFromByTrade(byTrade: Map<string, Map<string, number>>): number {
  let sum = 0;
  let total = 0;
  for (const [trade, cats] of byTrade.entries()) {
    const rowCount = [...cats.values()].reduce((a, b) => a + b, 0);
    sum += rowCount * getTradeWeatherWeight(trade);
    total += rowCount;
  }
  return total > 0 ? sum / total : 1;
}

export function mergeLocationWithTradeWeather(
  base: InjuryWeatherLocation,
  tradeWeatherWeight: number
): InjuryWeatherLocation {
  return {
    ...base,
    tradeWeatherWeight,
    combinedWeatherFactor: tradeWeatherWeight * base.weatherRiskMultiplier,
  };
}

export function getLocationWeatherContext(stateCode: string | undefined | null): InjuryWeatherLocation {
  const code = (stateCode ?? "").trim().toUpperCase();
  if (!code) {
    return {
      stateCode: null,
      displayName: "National",
      weatherRiskMultiplier: 1,
      impactNote: "No state selected; forecast uses organizational trend only for weather exposure.",
    };
  }
  const row = US_STATE_OPTIONS.find((s) => s.code === code);
  const displayName = row?.name ?? code;
  const w = STATE_WEATHER_MULTIPLIER[code];
  if (!w) {
    return {
      stateCode: code,
      displayName,
      weatherRiskMultiplier: 1,
      impactNote: "Regional climate baseline; adjust controls for local seasonal forecasts.",
    };
  }
  return {
    stateCode: code,
    displayName,
    weatherRiskMultiplier: w.factor,
    impactNote: w.note,
  };
}
