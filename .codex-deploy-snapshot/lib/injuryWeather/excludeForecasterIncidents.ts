/**
 * Rows inserted by the superadmin “manual injury / forecaster” flow were tagged in title or description
 * so they could be excluded from real operational analytics and Injury Weather live signals.
 */
const FORECASTER_MARKERS = [
  "[injury-weather-forecaster]",
  "[injury_weather_forecaster]",
  "[iw-forecaster]",
  "injury weather forecaster",
] as const;

export function isForecasterSyntheticIncident(title?: string | null, description?: string | null): boolean {
  const blob = `${title ?? ""}\n${description ?? ""}`.toLowerCase();
  return FORECASTER_MARKERS.some((m) => blob.includes(m));
}
