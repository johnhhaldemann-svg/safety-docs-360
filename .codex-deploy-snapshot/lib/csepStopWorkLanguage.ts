/**
 * Shared CSEP language: universal stop-work and controlled restart verification.
 * Import from assemble, programs, builder text, and related generators.
 */

/** All workers may stop unsafe work; restart is verified by designated field roles. */
export const CSEP_STOP_WORK_UNIVERSAL_AUTHORITY =
  "Every worker has stop-work authority: anyone who observes unsafe conditions, missing controls, or a conflict with the approved plan shall stop work and notify supervision.";

export const CSEP_RESTART_AFTER_VERIFICATION =
  "Work may restart only after the competent person or assigned supervisor verifies the exposure has been corrected, required controls are in place, and the crew has been re-briefed.";
