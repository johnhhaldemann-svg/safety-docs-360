import { DYNAMIC_INJURY_FORECAST } from "./constants";
import type { LayerOutput, WeatherEnvironmentInput } from "./types";

/**
 * Environmental multiplier from normalized 0–1 indices (not live METAR — use climate/season priors until sensors exist).
 */
export function computeWeatherMultiplier(input: WeatherEnvironmentInput): LayerOutput<{ indices: Record<string, number> }> {
  const cfg = DYNAMIC_INJURY_FORECAST.WEATHER;
  const bump =
    cfg.RAIN * clamp01(input.rainIndex) +
    cfg.WIND * clamp01(input.windIndex) +
    cfg.TEMP_STRESS * clamp01(Math.max(clamp01(input.heatStressIndex), clamp01(input.coldStressIndex))) +
    cfg.VIS * clamp01(input.lowVisibilityIndex) +
    cfg.SLIP * clamp01(input.slipSurfaceIndex) +
    cfg.SEASON * clamp01(input.seasonFactor);

  const value = Math.min(cfg.MAX_MULTIPLIER, 1 + bump);
  return {
    value,
    detail: `Weather/environment indices → multiplier ${value.toFixed(3)}.`,
    raw: {
      indices: {
        rain: input.rainIndex,
        wind: input.windIndex,
        heat: input.heatStressIndex,
        cold: input.coldStressIndex,
        vis: input.lowVisibilityIndex,
        slip: input.slipSurfaceIndex,
        season: input.seasonFactor,
      },
    },
  };
}

function clamp01(x: number): number {
  const n = typeof x === "number" && Number.isFinite(x) ? x : 0;
  return Math.min(1, Math.max(0, n));
}
