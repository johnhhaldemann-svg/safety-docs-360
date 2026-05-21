/**
 * Human-readable suffix for record-window / provenance when company or jobsite scope applies.
 */
export function injuryWeatherScopeNote(companyId?: string | null, jobsiteId?: string | null): string {
  const c = companyId?.trim();
  const j = jobsiteId?.trim();
  if (!c) return "";
  if (j) {
    return " · Scoped: this company; incidents & corrective actions limited to the selected jobsite; SOR observations remain company-wide (no jobsite on SOR rows).";
  }
  return " · Scoped: this company’s SOR, corrective actions, and incidents only.";
}

/** Short banner for superadmin UI when a jobsite is selected (SOR scope differs from CAPA/incidents). */
export function injuryWeatherJobsiteSorScopeBanner(): string {
  return "Jobsite selected: corrective actions and incidents are limited to this jobsite. SOR (safety observation) rows are still company-wide because observations are not attributed to a jobsite in the database yet—interpret trade mix accordingly.";
}
