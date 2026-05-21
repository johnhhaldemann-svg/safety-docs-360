const CSEP_HINT =
  "Injury prediction model is not available on CSEP-only workspaces. Upgrade or use a full workspace to enable this panel.";

/**
 * User-visible explanation when `/api/company/injury-analytics/model` is not OK.
 */
export function userVisibleInjuryModelMessage(status: number, body: { error?: string } | null): string {
  const apiError = typeof body?.error === "string" ? body.error.trim() : "";
  if (status === 403) {
    if (
      apiError.toLowerCase().includes("csep") ||
      apiError.toLowerCase().includes("workspace product") ||
      apiError.toLowerCase().includes("not available")
    ) {
      return apiError || CSEP_HINT;
    }
    return apiError || "You do not have access to the injury prediction model.";
  }
  if (status === 503) {
    return apiError || "Injury model request timed out or could not be reached. Try Refresh view.";
  }
  if (status >= 500) {
    return apiError || "Injury model failed to load. Try again later or contact support if it persists.";
  }
  return apiError || `Injury model could not be loaded (HTTP ${status}).`;
}
