/**
 * OSHA / insurance-style incidence rate per 200,000 exposure hours.
 * incidentRate = (incidents * 200_000) / hoursWorked
 */
export function incidentRatePer200kHours(
  incidentCount: number,
  hoursWorked: number | null | undefined
): number | null {
  if (hoursWorked == null || hoursWorked <= 0 || !Number.isFinite(hoursWorked)) return null;
  if (!Number.isFinite(incidentCount) || incidentCount < 0) return null;
  return (incidentCount * 200_000) / hoursWorked;
}
