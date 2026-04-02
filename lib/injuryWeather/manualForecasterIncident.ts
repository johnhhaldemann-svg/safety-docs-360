/** Stored at start of `company_incidents.description` for superadmin Injury Weather manual entries. */
export const MANUAL_FORECASTER_INCIDENT_DESCRIPTION_PREFIX = "[Injury forecaster — superadmin manual entry]";

export function isManualForecasterIncidentDescription(description: string | null | undefined): boolean {
  return (description ?? "").startsWith(MANUAL_FORECASTER_INCIDENT_DESCRIPTION_PREFIX);
}

/** Full description column value for insert (newline before user text when present). */
export function buildManualForecasterIncidentDescription(userDescription: string): string {
  const trimmed = userDescription.trim();
  if (!trimmed) return MANUAL_FORECASTER_INCIDENT_DESCRIPTION_PREFIX;
  return `${MANUAL_FORECASTER_INCIDENT_DESCRIPTION_PREFIX}\n${trimmed}`;
}
