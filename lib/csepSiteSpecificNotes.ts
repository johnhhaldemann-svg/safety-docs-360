/**
 * Narrative body for the CSEP "Project-Specific Safety Notes" block (builder key `site_specific_notes`).
 * Must not repeat the Scope Summary task list; use for site-only constraints and user-entered context.
 */

export const PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK =
  "No additional project-specific safety notes were provided. Field supervision shall confirm site conditions, owner requirements, and controlling-contractor rules before work begins.";

/**
 * Returns user-entered project-specific safety text, or the standard empty-state fallback.
 */
export function getProjectSpecificSafetyNotesNarrativeBody(input: {
  userText: string | null | undefined;
}): string {
  const t = (input.userText ?? "").trim();
  if (t) {
    return t;
  }
  return PROJECT_SPECIFIC_SAFETY_NOTES_EMPTY_FALLBACK;
}

/** @deprecated Prefer {@link getProjectSpecificSafetyNotesNarrativeBody}. `steelErectionInScope` is ignored. */
export function getSiteSpecificNotesNarrativeBody(input: {
  userText: string | null | undefined;
  steelErectionInScope?: boolean;
}): string {
  return getProjectSpecificSafetyNotesNarrativeBody({ userText: input.userText });
}
