/**
 * Default narrative for Site Specific Notes when the builder has no user-entered
 * free text. Not used in Scope summary, trade interaction, or security.
 */

export const STEEL_DECKING_SITE_NOTES_FALLBACK = [
  "This project involves structural steel erection and decking activities at an active construction site, including unloading steel deliveries, sorting members within designated laydown areas, rigging for hoisting operations, and performing crane picks to elevated work locations. Erection activities include column setting, beam placement, bolting, welding, and decking installation at multiple elevations.",
  "Work will be performed in coordination with adjacent trades operating in the same work zones, including mechanical, electrical, and fire protection contractors, requiring controlled access, communication, and sequencing. Steel deliveries and staging will be managed within designated laydown areas, with controlled truck routing and unloading procedures to minimize congestion and interaction with pedestrian traffic.",
  "The project includes work at elevation, leading-edge decking operations, and suspended-load activities, requiring strict adherence to fall protection, controlled access zones (CAZ), and no-work-under-load policies. Environmental conditions, including wind, weather exposure, and site-specific restrictions, may impact crane operations, steel stability, and decking activities.",
  "Final scope activities include embedding, punch list corrections, and touch-up painting, performed during later phases of the project in coordination with finishing trades and reduced access conditions.",
].join("\n\n");

/**
 * For non-structural-steel CSEP scope: field-usable default without restating a task list.
 */
export const NON_STEEL_SITE_NOTES_FALLBACK = [
  "This project involves the selected construction trade and subcontract work at an active job site, including material delivery and staging, work-area access, and coordination with other operating trades. Equipment movement, public interface, and site logistics follow the project plan, owner/GC requirements, and site orientation.",
  "Confirm laydown, haul routes, gate rules, and occupied-area or after-hours limitations with the owner/GC before work; update this section in the final issue when site rules change. Work may be affected by weather, ground conditions, and multi-trade scheduling—re-brief crews when those factors shift.",
  "Add project-specific details here when known (e.g. congested pick zones, crane mat limits, wind or hold points, and restricted release areas). Do not duplicate the Scope of Work task list; task-level controls are in Hazards and Controls.",
].join("\n\n");

export function getSiteSpecificNotesNarrativeBody(input: {
  userText: string | null | undefined;
  steelErectionInScope: boolean;
}): string {
  const t = (input.userText ?? "").trim();
  if (t) {
    return t;
  }
  return input.steelErectionInScope ? STEEL_DECKING_SITE_NOTES_FALLBACK : NON_STEEL_SITE_NOTES_FALLBACK;
}
