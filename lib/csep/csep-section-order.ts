export type CanonicalCsepSectionDefinition = {
  key: string;
  title: string;
  kind: "front_matter" | "main";
  descriptor: string;
};

export const CANONICAL_CSEP_SECTION_ORDER: CanonicalCsepSectionDefinition[] = [
  {
    key: "message_from_owner",
    kind: "front_matter",
    title: "Message from Owner",
    descriptor:
      "Executive leadership commitment and project-wide safety expectations for this CSEP issue.",
  },
  {
    key: "sign_off_page",
    kind: "front_matter",
    title: "Sign-Off Page",
    descriptor:
      "Pre-issue review and signature confirmations required before this CSEP is released for field use.",
  },
  {
    key: "table_of_contents",
    kind: "front_matter",
    title: "Table of Contents",
    descriptor: "Document navigation for the issued CSEP package.",
  },
  {
    key: "purpose",
    kind: "front_matter",
    title: "Purpose",
    descriptor:
      "High-level reason the CSEP exists and how it governs work on this project.",
  },
  {
    key: "scope",
    kind: "front_matter",
    title: "Scope",
    descriptor:
      "Project identity, covered trades, and field constraints only; other program requirements are in their dedicated sections.",
  },
  {
    key: "top_10_risks",
    kind: "front_matter",
    title: "Top 10 Risks",
    descriptor:
      "Project-level summary of the highest structural steel and decking exposures that require attention before and during execution.",
  },
  {
    key: "trade_interaction_info",
    kind: "front_matter",
    title: "Trade Interaction Info",
    descriptor:
      "Coordination expectations for overlapping work, shared areas, access, sequencing, and handoffs.",
  },
  {
    key: "disciplinary_program",
    kind: "front_matter",
    title: "Disciplinary Program",
    descriptor:
      "Unsafe-act response, correction, escalation, documentation, field verification, and restart or accountability (including site removal when required).",
  },
  {
    key: "union",
    kind: "front_matter",
    title: "Union",
    descriptor:
      "Project-specific craft, referral, or collective bargaining requirements when they apply; otherwise a clear not-applicable statement.",
  },
  {
    key: "security_at_site",
    kind: "front_matter",
    title: "Security at Site",
    descriptor:
      "Site entry, access, deliveries, laydown, traffic control, and restricted-area controls only.",
  },
  {
    key: "hazcom",
    kind: "front_matter",
    title: "HazCom",
    descriptor:
      "Project-wide Hazard Communication: SDS access, labeling, chemical inventory, secondary containers, and contractor / employee notification.",
  },
  {
    key: "iipp_emergency_response",
    kind: "front_matter",
    title: "IIPP / Emergency Response",
    descriptor:
      "Program-level reporting, emergency actions, medical response, investigation workflow, and corrective / restart expectations.",
  },
  {
    key: "hazards_and_controls",
    kind: "front_matter",
    title: "Hazards and Controls",
    descriptor:
      "Hazard-specific modules: exposures, required controls, access, protective equipment (PPE), permits, and trade execution (not IIPP, HazCom, work attire, or site-wide security policy).",
  },
  {
    key: "training_inspections_monitoring_recordkeeping",
    kind: "front_matter",
    title: "Training, Inspections, Monitoring & Recordkeeping",
    descriptor:
      "Training delivery, field inspections, verification monitoring, and recordkeeping controls required to keep this CSEP active and review-ready.",
  },
  {
    key: "close_out_lessons_learned",
    kind: "front_matter",
    title: "Close-Out / Lessons Learned",
    descriptor:
      "End-of-phase close-out checks, lessons learned capture, and carry-forward actions before final project turnover.",
  },
];

