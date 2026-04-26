import {
  formatApplicableReferenceBullets,
  formatApplicableReferencesInline,
} from "@/lib/csepRegulatoryReferenceIndex";
import { CSEP_RESTART_AFTER_VERIFICATION, CSEP_STOP_WORK_UNIVERSAL_AUTHORITY } from "@/lib/csepStopWorkLanguage";
import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import type {
  CSEPProgramCategory,
  CSEPProgramConfig,
  CSEPProgramDefinition,
  CSEPProgramDefinitionContent,
  CSEPProgramSection,
  CSEPProgramSelection,
  CSEPProgramSelectionInput,
  CSEPProgramSelectionSource,
  CSEPProgramSubtypeConfig,
  CSEPProgramSubtypeGroup,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";

type ProgramDefinition = CSEPProgramDefinition;

type BuildSelectionsParams = {
  selectedHazards: string[];
  selectedPermits: string[];
  selectedPpe: string[];
  tradeItems?: CSEPRiskItem[];
  selectedTasks?: string[];
  subtypeSelections?: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
};

/** Used for both the hazard program and the Ladder Permit program so the export shows one set of controls, not two divergent template blocks. */
const LADDER_USE_PROGRAM_SUMMARY =
  "Portable-ladder and step-ladder work under 29 CFR 1926 Subpart X: pick the right ladder class and length for the job, pre-use inspection, correct setup, and height/reach limits. Use a scaffold, lift, or stair when subpart- or site-rules cannot be met. Site ladder permits, if required, are part of the same control set, not a second program block.";

const LADDER_USE_CONTROLS = [
  "Use the correct type for the work (e.g., extension for height, step ladder only where its design and rating allow) and a duty rating that matches the load, including materials and tool belts, per the manufacturer and Subpart X.",
  "When electrical exposure is possible, use ladders with non-conductive side rails or other project-approved non-conductive access per site and utility rules for the work area.",
  "Follow project limits on use height, horizontal reach, and duration: portable ladders are for access and short work; do not overreach, stand on the top cap or a rung not designed for foot placement, or use a portable ladder as a work platform for sustained or heavy work—shift to a scaffold, stair tower, or lift as approved.",
  "Pre-use and periodical inspection: check rails, feet, locks, spreaders, rungs, ropes, and labels; remove damaged, bent, or unlabeled equipment from service and tag/segment it so it is not re-used until repaired or scrapped.",
  "Setup: place on a stable, level base; set pitch per Subpart X (e.g., proper horizontal offset for extension ladders) and base securement; extend extension ladders at least 3 feet above a landing (unless an equivalent grab/transition is provided per plan) and tie, block, or hold to prevent movement.",
  "Use: maintain three points of contact; keep one person on a single ladder unless the equipment is designed for more; do not use side load or the ladder in a way the manufacturer or site plan forbids. Obey site prohibitions (e.g., specific ladder types or areas).",
] as const;

const LADDER_USE_RESPONSIBILITIES = [
  "Supervision confirms the ladder is authorized for the task and area, the correct type and length are selected, and a ladder permit or pre-use check is on file if the site or GC requires it. Workers and foremen remove bad ladders from service on first find.",
] as const;

const LADDER_USE_TRAINING = [
  "Workers are briefed on pre-use inspection, setup, tie-off or holding, and when to stop and use alternate access. Where a union, collective bargaining, or project-specific ladder rule applies, follow that rule first when it is stricter than this summary.",
] as const;

const LADDER_USE_APPLICABLE_WHEN = [
  "Portable or job-made ladders (where allowed) are used for access, short work, or a task the site or GC has approved for ladder work.",
] as const;

const CONFINED_SPACE_SUBTYPE_CONFIG: CSEPProgramSubtypeConfig = {
  group: "confined_space_classification",
  label: "Confined space classification",
  prompt: "Choose whether the confined-space scope is permit-required or non-permit.",
  options: [
    {
      value: "permit_required",
      label: "Permit-required confined space",
      description: "Use when entry requires a permit, attendant, atmospheric review, and rescue planning.",
    },
    {
      value: "non_permit",
      label: "Non-permit confined space",
      description: "Use when the space meets confined-space criteria but does not require a permit entry process.",
    },
  ],
};

const SUBTYPE_CONFIGS: Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeConfig> = {
  confined_space_classification: CONFINED_SPACE_SUBTYPE_CONFIG,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dedupe(values: readonly string[]) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

function formatProgramParagraph(values: readonly string[], fallback?: string) {
  const items = dedupe(values);
  if (items.length > 0) {
    return items
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))
      .join(" ");
  }

  const text = fallback?.trim() || "";
  if (!text) return undefined;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

const PROGRAM_PARAGRAPH_SUBSECTION_TITLES = new Set([
  "When It Applies",
  "Responsibilities and Training",
  "Minimum Required Controls",
  "Related Tasks",
]);

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = dedupe(
    value.filter((item): item is string => typeof item === "string")
  );

  return normalized.length ? normalized : [...fallback];
}

function cloneDefinitionContent(
  definition: CSEPProgramDefinitionContent
): CSEPProgramDefinitionContent {
  return {
    title: definition.title,
    summary: definition.summary,
    oshaRefs: [...definition.oshaRefs],
    applicableWhen: [...definition.applicableWhen],
    responsibilities: [...definition.responsibilities],
    preTaskProcedures: [...definition.preTaskProcedures],
    workProcedures: [...definition.workProcedures],
    stopWorkProcedures: [...definition.stopWorkProcedures],
    closeoutProcedures: [...definition.closeoutProcedures],
    controls: [...definition.controls],
    training: [...definition.training],
  };
}

function cloneProgramDefinition(definition: CSEPProgramDefinition): CSEPProgramDefinition {
  return {
    category: definition.category,
    item: definition.item,
    ...cloneDefinitionContent(definition),
    ...(definition.subtypeGroup ? { subtypeGroup: definition.subtypeGroup } : {}),
    ...(definition.subtypeVariants
      ? {
          subtypeVariants: Object.fromEntries(
            Object.entries(definition.subtypeVariants).map(([key, value]) => [
              key,
              value ? cloneDefinitionContent({ ...cloneDefinitionContent(definition), ...value }) : value,
            ])
          ) as CSEPProgramDefinition["subtypeVariants"],
        }
      : {}),
    ...(definition.compactLayout ? { compactLayout: true } : {}),
  };
}

function normalizeSubtypeVariants(
  input: unknown,
  fallback: CSEPProgramDefinition["subtypeVariants"]
) {
  if (!fallback) {
    return undefined;
  }

  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const variants = Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => {
      if (!value) {
        return [key, value];
      }

      const override =
        raw[key] && typeof raw[key] === "object" ? (raw[key] as Record<string, unknown>) : {};

      return [
        key,
        {
          title: normalizeText(override.title, value.title ?? ""),
          summary: normalizeText(override.summary, value.summary ?? ""),
          oshaRefs: normalizeTextList(override.oshaRefs, value.oshaRefs ?? []),
          applicableWhen: normalizeTextList(override.applicableWhen, value.applicableWhen ?? []),
          responsibilities: normalizeTextList(
            override.responsibilities,
            value.responsibilities ?? []
          ),
          preTaskProcedures: normalizeTextList(
            override.preTaskProcedures,
            value.preTaskProcedures ?? []
          ),
          workProcedures: normalizeTextList(override.workProcedures, value.workProcedures ?? []),
          stopWorkProcedures: normalizeTextList(
            override.stopWorkProcedures,
            value.stopWorkProcedures ?? []
          ),
          closeoutProcedures: normalizeTextList(
            override.closeoutProcedures,
            value.closeoutProcedures ?? []
          ),
          controls: normalizeTextList(override.controls, value.controls ?? []),
          training: normalizeTextList(override.training, value.training ?? []),
        },
      ];
    })
  ) as CSEPProgramDefinition["subtypeVariants"];

  return variants;
}

type ProgramProcedureFields = Pick<
  CSEPProgramDefinitionContent,
  "preTaskProcedures" | "workProcedures" | "stopWorkProcedures" | "closeoutProcedures"
>;

function createProcedureFields(
  overrides?: Partial<ProgramProcedureFields>
): ProgramProcedureFields {
  return {
    preTaskProcedures: normalizeTextList(overrides?.preTaskProcedures, []),
    workProcedures: normalizeTextList(overrides?.workProcedures, []),
    stopWorkProcedures: normalizeTextList(overrides?.stopWorkProcedures, []),
    closeoutProcedures: normalizeTextList(overrides?.closeoutProcedures, []),
  };
}

function applyProcedureFields<T extends object>(
  definition: T,
  overrides?: Partial<ProgramProcedureFields>
) {
  return {
    ...definition,
    ...createProcedureFields(overrides),
  };
}

const HAZARD_PROCEDURE_CONTENT: Record<string, ProgramProcedureFields> = {
  "Falls from height": createProcedureFields({
    // Fall program text is assembled in buildFallProtectionGoverningProgramSection; keep these
    // empty so catalog merges do not duplicate inspection / planning language in exports.
    preTaskProcedures: [],
    workProcedures: [],
    stopWorkProcedures: [],
    closeoutProcedures: [],
  }),
  "Electrical shock": createProcedureFields({
    preTaskProcedures: [
      "Identify all electrical sources, boundaries, temporary-power needs, and qualified-person responsibilities before work begins.",
      "Confirm lockout/tagout scope, test-instrument availability, cord routing, and GFCI protection before energization or troubleshooting starts.",
      "Inspect cords, tools, panels, covers, and work conditions for damage, moisture, and unauthorized modifications.",
    ],
    workProcedures: [
      "Keep electrical work limited to qualified personnel when tie-ins, troubleshooting, testing, or energized exposure is involved.",
      "Maintain dry, protected work conditions and keep cords, panels, and temporary power clear of damage, pinch points, and traffic exposure.",
      "Verify systems are in the expected condition before each phase of testing, startup, or re-energization.",
    ],
    stopWorkProcedures: [
      "Stop work if unexpected voltage, backfeed, damaged equipment, missing covers, or wet conditions create uncontrolled exposure.",
      "Stop work when lockout/tagout status is uncertain or when the required qualified worker or test equipment is not available.",
      "Do not continue until the system state is verified and electrical protection measures are restored.",
    ],
    closeoutProcedures: [
      "Return equipment to a guarded condition, remove temporary wiring or damaged components from service, and restore panel access.",
      "Coordinate controlled re-energization, communication to affected parties, and confirmation that tools and personnel are clear.",
      "Document electrical issues, damaged equipment, or abnormal conditions for follow-up before the area is turned over.",
    ],
  }),
  "Hot work / fire": createProcedureFields({
    // Governing text is in buildHotWorkGoverningProgramSection; keep arrays empty
    // so catalog merges do not duplicate hot-work content in exports.
    preTaskProcedures: [],
    workProcedures: [],
    stopWorkProcedures: [],
    closeoutProcedures: [],
  }),
  "Struck by equipment": createProcedureFields({
    preTaskProcedures: [
      "Review equipment routes, backing paths, delivery timing, spotter assignments, and exclusion-zone limits before movement starts.",
      "Confirm workers in the area understand travel paths, staging limits, and where pedestrian access is prohibited during equipment activity.",
      "Inspect the route for blind spots, soft ground, overhead obstructions, and conflicting trades before authorizing movement.",
    ],
    workProcedures: [
      "Use the planned route, maintain visual or radio communication with spotters, and keep unauthorized workers out of the controlled area.",
      "Position workers clear of swing radiuses, backing zones, and line-of-fire exposure while equipment is operating or repositioning.",
      "Pause movement when congestion, deliveries, or simultaneous work reduces visibility or route control.",
    ],
    stopWorkProcedures: [
      "Stop equipment movement immediately if spotter communication is lost, pedestrians enter the route, or visibility is no longer adequate.",
      "Stop work when route conditions change, surfaces become unstable, or adjacent activity creates uncontrolled struck-by exposure.",
      "Resume only after route control, communication, and personnel positioning are re-established.",
    ],
    closeoutProcedures: [
      "Park or stage equipment in the approved location and remove temporary traffic restrictions only after the movement hazard is gone.",
      "Restore pedestrian access routes and clear staging areas of materials that could create new struck-by exposure.",
      "Report near misses, blind-spot issues, or route conflicts so the next shift can adjust the traffic plan.",
    ],
  }),
  "Ladder misuse": createProcedureFields({
    preTaskProcedures: [
      "Select ladder type (e.g., extension, single, step), duty class, and length so the work stays within the manufacturer rating and 1926.1053 limits for the set-up; verify site electrical-minimums for non-conductive rails if exposure exists.",
      "Pre-use: inspect stiles, feet, rungs, locks, spreader bars, and labels; reject missing or out-of-service equipment before it is carried to the work area.",
      "Set up on firm, level footing; verify pitch and base/ top securement, landing extension (e.g., 3 feet past the top support where required), and control for doors, traffic, and overhead power lines or equipment.",
    ],
    workProcedures: [
      "Climb and work with the body between the rails, three points of contact, and no overreach; do not straddle, side-load, or use the top step/cap in violation of the manufacturer or site rule.",
      "If the work changes (longer reach, longer duration, heavier tool load, or both hands for material), move to a scaffold, lift, or stair that supports the new condition.",
      "One worker on the portable ladder except where the design allows two, per manufacturer. Keep non-essential people clear of the bight and the drop zone for tools.",
    ],
    stopWorkProcedures: [
      "Stop if the ladder shifts, slips, fails inspection mid-shift, is struck, or is no longer supported as first placed; stop in wind, weather, or traffic that the plan does not allow.",
      "Do not resume until the same ladder is re-set or a compliant alternate is in use and a competent person re-briefs the crew as needed.",
    ],
    closeoutProcedures: [
      "At task end, remove the ladder from travel paths, store or flag it so it is not used damaged, and clear debris, cords, and material from the access area.",
      "Log or close any ladder permit or site sign-off the shift required, and hand off to the next shift if the work continues.",
    ],
  }),
  "Confined spaces": createProcedureFields({
    preTaskProcedures: [
      "Identify the space, classify the entry, isolate hazards, and confirm entrant, attendant, and supervisor roles before entry begins.",
      "Review atmospheric testing, ventilation, communication, retrieval, and rescue expectations before authorizing access.",
      "Barricade the opening and control unauthorized entry while entry preparations are underway.",
    ],
    workProcedures: [
      "Maintain communication among entrants, attendants, and supervision for the full duration of the entry.",
      "Continue monitoring and reevaluate conditions whenever work scope, ventilation, tooling, or atmospheric conditions change.",
      "Keep the entry point controlled so only authorized personnel and equipment enter the space.",
    ],
    stopWorkProcedures: [
      "Stop entry immediately if atmospheric readings change, communication fails, rescue readiness is compromised, or unauthorized entry occurs.",
      "Stop work when isolation status changes or when the space can no longer be maintained in the reviewed condition.",
      "Remove entrants and re-evaluate the entry before work resumes.",
    ],
    closeoutProcedures: [
      "Account for all entrants, remove tools and materials, and secure the opening when the entry is complete.",
      "Close the permit or classification record and document any condition changes that occurred during the entry.",
      "Restore the area only after barricades, covers, and access controls are returned to a safe condition.",
    ],
  }),
  "Chemical exposure": createProcedureFields({
    preTaskProcedures: [
      "Review the SDS, product label, required PPE, ventilation needs, and spill-response expectations before chemical use begins.",
      "Verify containers are labeled, incompatible products are segregated, and the work area has the required wash, ventilation, or containment support.",
      "Stage spill kits, absorbents, and disposal containers before opening or mixing chemical products.",
    ],
    workProcedures: [
      "Use chemicals only as reviewed for the task and keep containers closed, labeled, and under control when not actively dispensing.",
      "Maintain ventilation, PPE, and housekeeping controls during mixing, application, transfer, and cleanup.",
      "Keep ignition sources, unauthorized workers, and incompatible materials away from the active chemical-use area.",
    ],
    stopWorkProcedures: [
      "Stop work if labels are missing, SDS information is unavailable, required PPE or ventilation is not in place, or incompatible materials are introduced.",
      "Stop work immediately for spills, uncontrolled release, symptoms of exposure, or any condition that exceeds the reviewed use plan.",
      "Do not resume until the exposure is contained, evaluated, and brought back under control.",
    ],
    closeoutProcedures: [
      "Seal and store remaining product correctly, and remove waste, rags, and contaminated materials using the approved disposal method.",
      "Clean tools, decontaminate the work area as required, and restock spill-response materials used during the task.",
      "Report spills, exposure symptoms, or product issues for follow-up before the area is released.",
    ],
  }),
  "Silica / dust exposure": createProcedureFields({
    preTaskProcedures: [
      "Review the dust-generating task, control method, respiratory requirements, and restricted-area needs before work starts.",
      "Inspect wet-cutting systems, vacuums, shrouds, hoses, filters, and power tools to confirm the selected control method will function as planned.",
      "Set access controls and position workers to reduce downstream dust exposure to adjacent crews.",
    ],
    workProcedures: [
      "Run wet methods, local exhaust, or vacuum systems continuously while the dust-generating task is active.",
      "Use the tool configuration and work method reviewed for the task, and avoid dry sweeping or uncontrolled compressed-air cleanup.",
      "Monitor visible dust migration and adjust access, positioning, or pace of work when airborne exposure increases.",
    ],
    stopWorkProcedures: [
      "Stop work if wet methods, vacuum systems, shrouds, or respiratory controls are missing, clogged, or no longer effective.",
      "Stop work when visible dust is no longer contained or when adjacent crews are exposed without control.",
      "Resume only after the dust-control setup is restored and the work area is re-evaluated.",
    ],
    closeoutProcedures: [
      "Clean the area using HEPA vacuuming, wet cleanup, or another approved low-dust method.",
      "Dispose of collected dust and debris in a controlled manner and service filters, hoses, or collection units as needed.",
      "Remove access restrictions only after airborne dust has settled or been controlled.",
    ],
  }),
  "Pressure / line break": createProcedureFields({
    preTaskProcedures: [
      "Identify system boundaries, energy sources, isolation points, drains, vents, and release paths before line-break or pressure work starts.",
      "Confirm lockout/tagout, zero-pressure verification, test medium, communication roles, and exclusion boundaries before opening or pressurizing the system.",
      "Inspect hoses, gauges, fittings, blinds, and test equipment for condition and compatibility with the planned pressure scope.",
    ],
    workProcedures: [
      "Open, loosen, vent, and pressurize systems in a controlled sequence while keeping personnel clear of potential release paths.",
      "Maintain communication with all affected workers before each pressure change, valve movement, test hold, or release step.",
      "Keep barriers, exclusion zones, and monitoring in place during testing, flushing, startup, or controlled release work.",
    ],
    stopWorkProcedures: [
      "Stop work immediately for unexpected pressure behavior, leaks, movement, noise, component distortion, or loss of boundary control.",
      "Stop work when gauges, restraints, isolation status, or communication can no longer be trusted.",
      "Do not continue until the system is returned to a verified safe condition and the release/test plan is rechecked.",
    ],
    closeoutProcedures: [
      "Depressurize or return the system to the approved operating condition before removing test equipment or temporary boundaries.",
      "Reinstall guards, caps, and permanent components, and verify drains and vents are left in the intended condition.",
      "Document abnormal pressure behavior, leaks, or equipment defects before turnover.",
    ],
  }),
  "Falling objects": createProcedureFields({
    preTaskProcedures: [
      "Review overhead work locations, drop-zone boundaries, protected access routes, and material-handling plans before the task starts.",
      "Verify tool tethering, toe boards, netting, canopies, barricades, or other overhead protection required for the work area.",
      "Clear or reroute workers below the active overhead area before materials or tools are moved into position.",
    ],
    workProcedures: [
      "Keep tools, materials, and debris secured while work is performed at elevation or above occupied areas.",
      "Maintain barricades and communicate with affected crews whenever work shifts to a new overhead exposure point.",
      "Control staging at edges and elevated platforms so loose material cannot roll, slide, or be kicked into lower levels.",
    ],
    stopWorkProcedures: [
      "Stop work if workers enter the drop zone without protection, material security is lost, or wind/conditions create uncontrolled displacement.",
      "Stop work when overhead protection or barricades are moved, removed, or no longer adequate for the active exposure.",
      "Do not resume until the drop zone and object-control measures are restored.",
    ],
    closeoutProcedures: [
      "Remove loose tools, scrap, and unsecured materials from elevated surfaces before the area is left unattended.",
      "Inspect the lower-level area for dropped debris and reopen access only after overhead exposure is eliminated.",
      "Store tethering and overhead-protection equipment so it remains ready for the next use.",
    ],
  }),
  "Crane lift hazards": createProcedureFields({
    preTaskProcedures: [
      "Review the lift scope, load path, ground conditions, rigging method, communication plan, and required lift documentation before the pick begins.",
      "Verify crane setup, outrigger support, swing radius, power-line clearance, and exclusion zones before the load is connected.",
      "Inspect rigging, hooks, tag lines, and connection points, and confirm only authorized personnel are assigned to signaling and rigging duties.",
    ],
    workProcedures: [
      "Conduct the lift using the planned signals or radio communication, and maintain clear separation from suspended loads and load paths.",
      "Control the load with the approved rigging and tag-line methods, and pause if balance, clearance, or weather conditions change.",
      "Keep the crane area, swing radius, and landing zone controlled until the load is set and stable.",
    ],
    stopWorkProcedures: [
      "Stop the lift immediately if communication is lost, the load shifts unexpectedly, wind or ground conditions deteriorate, or unauthorized personnel enter the controlled area.",
      "Stop work when rigging defects, clearance conflicts, or crane setup concerns are identified after the lift has started.",
      "Resume only after the lift plan and field conditions are revalidated.",
    ],
    closeoutProcedures: [
      "Land and secure the load, then remove rigging only after the load is stable and clear of pinch or shift hazards.",
      "Stow rigging gear, restore the swing radius, and inspect equipment that showed wear or abnormal loading during the pick.",
      "Capture lift issues, near misses, or changes needed for the next pick before releasing the area.",
    ],
  }),
  "Excavation collapse": createProcedureFields({
    preTaskProcedures: [
      "Confirm locate status, excavation limits, soil conditions, protective-system selection, and competent-person coverage before digging starts.",
      "Inspect trench boxes, shoring, sloping, access points, spoil-pile locations, and adjacent loads before workers enter the excavation.",
      "Review groundwater, weather, traffic, and utility conditions that could change the stability of the excavation during the shift.",
    ],
    workProcedures: [
      "Keep spoil piles, equipment, and surcharge loads back from the edge while maintaining the protective system and access/egress in place.",
      "Have the competent person reinspect as depth, soil, water, vibration, or adjacent activity changes during the day.",
      "Control entry so workers do not enter unprotected areas or move below suspended loads and unsupported faces.",
    ],
    stopWorkProcedures: [
      "Stop work immediately for cave-in indicators, sloughing, water accumulation, protective-system movement, unmarked utilities, or changing soil conditions.",
      "Stop entry when inspections are overdue or when access, egress, or atmospheric conditions are no longer acceptable.",
      "Do not resume until the competent person re-evaluates the excavation and required protections are restored.",
    ],
    closeoutProcedures: [
      "Secure, plate, backfill, or barricade the excavation before leaving the area unattended.",
      "Remove temporary access only after workers are out and the excavation is left in a controlled condition.",
      "Document inspection findings, utility conflicts, or ground-condition changes for the next shift.",
    ],
  }),
  "Slips trips falls": createProcedureFields({
    preTaskProcedures: [
      "Inspect walkways, stairs, access points, and work surfaces at the start of the shift for clutter, damage, lighting issues, and weather-related exposure.",
      "Plan material staging, hose and cord routing, waste collection, and cleanup responsibility before work begins.",
      "Review any areas likely to become wet, muddy, icy, or congested during the task and assign controls in advance.",
    ],
    workProcedures: [
      "Keep access routes open, clean as work progresses, and control cords, hoses, tools, and materials so they do not create new trip hazards.",
      "Address wet or uneven walking surfaces as they develop by cleaning, treating, barricading, or rerouting workers.",
      "Maintain lighting and visibility so workers can recognize changing surface conditions while moving through the area.",
    ],
    stopWorkProcedures: [
      "Stop work or reroute access when surfaces become too slick, obstructed, dark, or uneven to travel safely.",
      "Stop work when housekeeping controls break down and the area can no longer support safe movement or emergency egress.",
      "Resume only after the access route is restored or an alternate safe path is established.",
    ],
    closeoutProcedures: [
      "Remove scrap, packaging, cords, hoses, and stored materials from access routes at the end of the task.",
      "Leave stairs, ladders, and walkways in a clean, lit, and usable condition for the next crew.",
      "Document recurring housekeeping problem areas so site controls can be adjusted.",
    ],
  }),
};

const CONFINED_SPACE_SUBTYPE_PROCEDURE_CONTENT: Partial<
  Record<CSEPProgramSubtypeValue, ProgramProcedureFields>
> = {
  permit_required: createProcedureFields({
    preTaskProcedures: [
      "Complete the permit-required entry review, verify hazard isolation, and confirm attendant, entrant, and supervisor roles before entry begins.",
      "Validate atmospheric monitoring, retrieval setup, rescue readiness, and permit authorization before the opening is released for entry.",
      "Brief the crew on permit limits, communication signals, evacuation triggers, and entry duration controls.",
    ],
    workProcedures: [
      "Maintain the attendant outside the space for the entire entry and keep the permit, monitoring records, and communication method active.",
      "Continue atmospheric monitoring and reassess whenever work changes the atmosphere, configuration, or rescue complexity of the space.",
      "Control the opening and limit entry to authorized personnel and approved equipment only.",
    ],
    stopWorkProcedures: [
      "Stop entry immediately if permit conditions change, alarms activate, communication is lost, rescue readiness changes, or the attendant is unavailable.",
      "Remove entrants whenever monitoring, isolation, ventilation, or permit controls can no longer be maintained as written.",
      "Do not re-enter until the permit is updated and the entry supervisor reauthorizes the work.",
    ],
    closeoutProcedures: [
      "Cancel the permit after all entrants are accounted for and the work, monitoring, and rescue equipment are removed from service.",
      "Document any permit deviations, alarms, or condition changes that occurred during the entry.",
      "Secure the opening and return the space to a controlled condition before leaving the area.",
    ],
  }),
  non_permit: createProcedureFields({
    preTaskProcedures: [
      "Document the non-permit classification and verify the space remains free of atmospheric, engulfment, and configuration hazards before entry.",
      "Review access, communication, and reevaluation expectations with the crew before anyone enters the space.",
      "Establish controlled access and confirm the work to be performed will not introduce permit-required hazards.",
    ],
    workProcedures: [
      "Keep the space under observation and reevaluate conditions whenever tools, materials, or adjacent operations could change the hazard profile.",
      "Maintain orderly access and communication so entrants can exit immediately if conditions change.",
      "Limit the work to the reviewed non-permit scope and pause before introducing any new energy, chemicals, or heat source.",
    ],
    stopWorkProcedures: [
      "Stop work immediately if atmospheric concerns, engulfment potential, hazardous energy, or other permit-required conditions develop.",
      "Stop entry when the classification can no longer be supported or when changing work scope introduces new hazards.",
      "Reclassify the entry and upgrade controls before work continues.",
    ],
    closeoutProcedures: [
      "Document the completed non-permit entry review and note any conditions that nearly triggered reclassification.",
      "Remove temporary access controls and secure the space once tools and workers are clear.",
      "Report changing conditions so future entries start with the updated hazard picture.",
    ],
  }),
};

const BASE_PROGRAM_DEFINITIONS: Array<Omit<CSEPProgramDefinition, keyof ProgramProcedureFields>> = [
  {
    category: "hazard",
    item: "Falls from height",
    title: "Fall Protection Program",
    summary:
      "Governing fall protection for this CSEP. Hazards and Controls may add task detail; this program states equipment, tie-off, inspection, and stop-work requirements.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Fall to a lower level: edges, openings, leading deck, or incomplete floor.",
      "Steel, decking, or connector work where the plan or rules require a fall system or collective protection.",
      "Aerial lift, ladder, or scaffold work where the equipment or site rules require personal fall protection.",
    ],
    responsibilities: [],
    controls: [],
    training: [],
  },
  {
    category: "hazard",
    item: "Electrical shock",
    title: "Electrical Safety Program",
    summary: "This program defines controls required to prevent shock, arc, burn, and energized-equipment exposure during selected construction activities.",
    oshaRefs: ["OSHA 1926 Subpart K - Electrical"],
    applicableWhen: [
      "Selected work includes temporary power, terminations, testing, energization, or other electrical exposure.",
    ],
    responsibilities: [
      "Only qualified personnel shall perform tie-ins, troubleshooting, or energized-system work.",
      "Supervision shall verify hazardous energy isolation and equipment condition before work begins.",
    ],
    controls: [
      "Use GFCI protection where required.",
      "Remove damaged cords, tools, and electrical equipment from service.",
      "Follow LOTO procedures before servicing equipment with hazardous energy.",
      "Protect extension cords from damage, water, pinch points, and vehicle traffic.",
    ],
    training: [
      "Workers shall be trained on electrical hazard recognition, temporary power expectations, and LOTO requirements.",
    ],
  },
  {
    category: "hazard",
    item: "Hot work / fire",
    title: "Hot Work Program",
    summary:
      "Governing hot work and fire prevention for this CSEP. The project hot work permit and supporting forms own authorization; this program states the risk, field controls, verification, and closeout. Use Security at Site and IIPP / Emergency Response for access and response detail.",
    oshaRefs: ["OSHA 1926 Subpart J - Fire Protection and Prevention"],
    applicableWhen: [],
    responsibilities: [],
    controls: [],
    training: [],
  },
  {
    category: "hazard",
    item: "Struck by equipment",
    title: "Struck-By and Equipment Safety Program",
    summary: "This program establishes controls for worker exposure around moving equipment, haul routes, backing hazards, and blind spots.",
    oshaRefs: ["OSHA 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations"],
    applicableWhen: [
      "Selected tasks involve equipment movement, deliveries, haul routes, material staging, or work around mobile equipment.",
    ],
    responsibilities: [
      "Supervision shall define equipment routes, exclusion zones, and spotter expectations before the shift starts.",
      "Workers shall stay clear of moving equipment unless directly involved in the operation.",
    ],
    controls: [
      "Use spotters where visibility is restricted or site rules require them.",
      "Maintain equipment routes, swing radiuses, and exclusion zones.",
      "Wear high-visibility garments where equipment traffic is present.",
      "Do not position personnel between fixed objects and moving equipment.",
    ],
    training: [
      "Workers shall be trained on blind-spot awareness, site traffic rules, and spotter communication.",
    ],
  },
  {
    category: "hazard",
    item: "Ladder misuse",
    title: "Ladder Use Controls",
    summary: LADDER_USE_PROGRAM_SUMMARY,
    oshaRefs: ["OSHA 1926 Subpart X - Stairways and Ladders"],
    applicableWhen: [...LADDER_USE_APPLICABLE_WHEN],
    responsibilities: [...LADDER_USE_RESPONSIBILITIES],
    controls: [...LADDER_USE_CONTROLS],
    training: [...LADDER_USE_TRAINING],
    compactLayout: true,
  },
  {
    category: "hazard",
    item: "Confined spaces",
    title: "Confined Space Entry Program",
    summary: "This program establishes controls for limited-entry spaces requiring atmospheric review, role assignment, and entry coordination.",
    oshaRefs: ["OSHA 1926 Subpart AA - Confined Spaces in Construction"],
    applicableWhen: [
      "Selected work includes entry into spaces with limited access or egress.",
      "The selected task list includes vaults, manholes, tanks, or similar enclosed spaces.",
    ],
    responsibilities: [
      "Supervision shall classify the entry, verify acceptable entry conditions, and brief entrants and attendants before work starts.",
      "Workers shall not enter until monitoring, communication, and rescue expectations are confirmed.",
    ],
    controls: [
      "Identify the confined space before work begins.",
      "Perform atmospheric testing as required.",
      "Establish communication and rescue procedures before entry.",
      "Prevent unauthorized entry and reevaluate conditions when the work or atmosphere changes.",
    ],
    training: [
      "Entrants, attendants, and entry supervisors shall be trained on their role-specific responsibilities.",
    ],
    subtypeGroup: "confined_space_classification",
    subtypeVariants: {
      permit_required: {
        title: "Permit-Required Confined Space Entry Program",
        summary: "This program applies when confined-space entry requires a permit process, designated entry roles, atmospheric review, and rescue readiness.",
        applicableWhen: [
          "The selected confined-space work meets permit-required entry criteria.",
          "Entry hazards require documented authorization, attendant coverage, and rescue planning.",
        ],
        controls: [
          "Complete the permit-required confined-space authorization before entry.",
          "Verify continuous or interval atmospheric monitoring as required by the entry conditions.",
          "Maintain an attendant outside the entry space for the full duration of the entry.",
          "Confirm rescue equipment, emergency contacts, and retrieval expectations before entry.",
        ],
      },
      non_permit: {
        title: "Non-Permit Confined Space Entry Program",
        summary: "This program applies when confined-space entry is allowed under non-permit conditions but still requires identification, review, and controlled entry practices.",
        applicableWhen: [
          "The selected confined-space work is classified as non-permit entry.",
          "The space must still be identified, reviewed, and protected against changing conditions.",
        ],
        controls: [
          "Document the non-permit classification before entry begins.",
          "Verify the space remains free of permit-required hazards during the work.",
          "Maintain controlled access, communication, and reevaluation if conditions change.",
          "Stop work and reclassify the entry if hazards escalate or atmospheric concerns develop.",
        ],
      },
    },
  },
  {
    category: "hazard",
    item: "Chemical exposure",
    title: "Hazard Communication and Chemical Safety Program",
    summary: "This program establishes minimum requirements for chemical review, SDS access, labeling, handling, storage, and worker protection.",
    oshaRefs: ["OSHA 1926.59 - Hazard Communication"],
    applicableWhen: [
      "Selected work involves coatings, solvents, sealants, adhesives, or other hazardous chemicals.",
    ],
    responsibilities: [
      "Supervision shall verify SDS access, labeling, and storage controls before chemical use begins.",
      "Workers shall review chemical hazards before use and report spills or uncontrolled exposure immediately.",
    ],
    controls: [
      "Maintain Safety Data Sheets for products used on site.",
      "Label containers properly and segregate incompatible materials.",
      "Use required PPE and ventilation or containment controls.",
      "Maintain spill-response materials when required by the chemical scope.",
    ],
    training: [
      "Workers shall be trained on SDS review, labeling, PPE, and spill-response expectations.",
    ],
  },
  {
    category: "hazard",
    item: "Silica / dust exposure",
    title: "Silica and Dust Exposure Control Program",
    summary: "This program establishes controls for tasks that generate respirable dust, silica-containing debris, or airborne particulates during cutting, grinding, chipping, or surface preparation.",
    oshaRefs: ["OSHA 1926.1153 - Respirable Crystalline Silica", "OSHA 1926 Subpart D - Occupational Health and Environmental Controls"],
    applicableWhen: [
      "Selected work includes grinding, chipping, saw cutting, mortar work, grout handling, or abrasive surface preparation.",
      "Task execution creates visible dust, fine airborne particulate, or potential silica exposure.",
    ],
    responsibilities: [
      "Supervision shall verify dust-control methods, tool configuration, and respiratory requirements before dusty work begins.",
      "Workers shall stop dust-generating work when controls are missing, inoperable, or no longer effective.",
    ],
    controls: [
      "Use engineering controls such as wet methods or vacuum-equipped tools when dust is generated.",
      "Maintain housekeeping methods that avoid uncontrolled airborne dust.",
      "Use required respiratory and eye/face protection based on task exposure.",
      "Control adjacent access when dust migration creates exposure to other crews.",
    ],
    training: [
      "Workers shall be trained on silica and dust hazard recognition, control setup, and respiratory protection expectations.",
    ],
  },
  {
    category: "hazard",
    item: "Pressure / line break",
    title: "Pressure System and Line-Break Safety Program",
    summary: "This program establishes controls for pressurized systems, hydro/pressure testing, flushing, tie-ins, startup, and any task where stored pressure may be released.",
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions", "OSHA 1926 Subpart K - Electrical"],
    applicableWhen: [
      "Selected work includes pressure testing, flushing, startup, tie-ins, valve work, or line-break activities.",
      "The scope includes energized or pressurized systems that can release stored energy.",
    ],
    responsibilities: [
      "Supervision shall verify isolation points, release boundaries, and communication plans before pressurized work starts.",
      "Workers shall not perform line-break or pressure activities until isolation and release controls are confirmed.",
    ],
    controls: [
      "Verify isolation and lockout/tagout where required before opening or servicing systems.",
      "Use controlled release methods and keep personnel clear of potential release paths.",
      "Establish communication and exclusion boundaries during testing, flushing, and startup.",
      `${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} Stop work and reassess when pressure behavior, equipment condition, or scope changes unexpectedly. ${CSEP_RESTART_AFTER_VERIFICATION}`,
    ],
    training: [
      "Workers shall be trained on pressure hazards, controlled release methods, and line-break stop-work triggers.",
    ],
  },
  {
    category: "hazard",
    item: "Falling objects",
    title: "Falling Object and Overhead Work Safety Program",
    summary: "This program establishes controls to protect workers from falling tools, materials, debris, and overhead work activities, including controlled access where the work creates a fixed boundary (CAZ) below steel or similar scope.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work creates overhead exposure to crews below.",
    ],
    responsibilities: [
      "Supervision shall maintain drop-zone and controlled-access (CAZ) limits and protect adjacent workers before overhead work starts.",
      "Workers shall not enter suspended-load or overhead work zones unless authorized and protected.",
    ],
    controls: [
      "Use toe boards, debris nets, tool lanyards, or overhead protection where needed.",
      "Where a controlled access zone (CAZ) applies, establish and mark it with barricades, signage, or lines together with the drop or exclusion area; do not treat a drop zone as the only control when the work requires a CAZ for steel erection, decking, or access below.",
      "Barricade and maintain exclusion zones below overhead work; stop work if unauthorized workers enter a posted CAZ or uncontrolled line-of-fire path.",
      "Secure materials against displacement at edges and elevated work surfaces.",
      "Review dropped-object and CAZ / communication expectations during pre-task planning.",
    ],
    training: [
      `Workers shall be trained on overhead hazard recognition, CAZ and exclusion-zone rules, authorized entry, ${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} ${CSEP_RESTART_AFTER_VERIFICATION}`,
    ],
  },
  {
    category: "hazard",
    item: "Crane lift hazards",
    title: "Crane, Rigging, and Lift Safety Program",
    summary: "This program defines controls for crane activity, rigging, lifting operations, material picks, and suspended-load exposure.",
    oshaRefs: ["OSHA 1926 Subpart CC - Cranes and Derricks in Construction"],
    applicableWhen: [
      "Selected work includes crane activity, rigging, telehandler picks, or suspended-load exposure.",
    ],
    responsibilities: [
      "Supervision shall verify lift planning, crane setup, ground conditions, and communication methods before lifting begins.",
      "Only trained and authorized personnel shall rig loads or direct crane activity.",
    ],
    controls: [
      "Use lift plans when required by site rules or lift complexity.",
      "Inspect rigging before use.",
      "Keep workers clear of suspended loads and load paths.",
      "Use tag lines and exclusion zones where appropriate.",
    ],
    training: [
      "Workers shall be trained on rigging inspection, signaling, and suspended-load exclusion.",
    ],
  },
  {
    category: "hazard",
    item: "Excavation collapse",
    title: "Excavation and Trenching Safety Program",
    summary: "This program provides minimum controls for trenching, excavation support activities, underground utility work, and changing soil conditions.",
    oshaRefs: ["OSHA 1926 Subpart P - Excavations"],
    applicableWhen: [
      "Selected work includes excavation, trenching, shoring, utility installation, or other below-grade scope.",
    ],
    responsibilities: [
      "A competent person shall inspect excavations and protective systems as required.",
      "Supervision shall coordinate utility locate, access/egress, and spoil-pile control before work begins.",
    ],
    controls: [
      "Use protective systems where required by depth, soil, and field conditions.",
      "Keep spoil piles and materials back from the excavation edge.",
      "Maintain safe access and egress.",
      "Address utilities, water accumulation, surcharge loading, and changing ground conditions before work continues.",
    ],
    training: [
      "Workers shall be trained on trench hazards, protective systems, and competent-person requirements.",
    ],
  },
  {
    category: "hazard",
    item: "Slips trips falls",
    title: "Housekeeping and Slip, Trip, Fall Prevention Program",
    summary: "This program establishes housekeeping expectations to reduce same-level fall hazards, blocked access, and material clutter.",
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
    applicableWhen: [
      "Selected work or site conditions create walk-surface, housekeeping, or access-route exposure.",
    ],
    responsibilities: [
      "Supervision shall set housekeeping expectations and verify access routes remain clear during the shift.",
      "Workers shall report and correct slip, trip, and housekeeping hazards immediately.",
    ],
    controls: [
      "Keep walkways, access points, and work areas clear.",
      "Manage cords, hoses, and materials to prevent trip hazards.",
      "Address wet, muddy, icy, or uneven surfaces promptly.",
      "Maintain adequate lighting for safe travel and work.",
    ],
    training: [
      "Workers shall be trained on housekeeping expectations and same-level fall prevention.",
    ],
  },
  {
    category: "permit",
    item: "Ground Disturbance Permit",
    title: "Ground Disturbance Permit Program",
    summary: "This program establishes authorization and control requirements before earth disturbance, below-grade work, or utility-adjacent excavation begins.",
    oshaRefs: ["OSHA 1926 Subpart P - Excavations"],
    applicableWhen: [
      "Selected work disturbs soil, trench lines, excavation boundaries, or utility-adjacent ground conditions.",
      "Earth-disturbance activities require documented authorization before work begins.",
    ],
    responsibilities: [
      "Supervision shall confirm utility locate status, disturbance limits, and approved controls before authorizing work.",
    ],
    controls: [
      "Obtain ground-disturbance authorization before excavation, trenching, or utility-adjacent digging starts.",
      "Verify utility locate, clearance, and tolerance-zone requirements before disturbance.",
      "Stop work when unknown utilities, unstable conditions, or permit scope changes are encountered.",
    ],
    training: [
      "Workers shall be trained on ground-disturbance authorization, locate verification, and stop-work expectations.",
    ],
  },
  {
    category: "permit",
    item: "Hot Work Permit",
    title: "Hot Work Permit Program",
    summary: "This program defines the permit controls, authorization steps, and field verifications required before hot work begins.",
    oshaRefs: ["OSHA 1926 Subpart J - Fire Protection and Prevention"],
    applicableWhen: [
      "Selected work requires a hot-work permit because sparks, flame, or ignition sources are present.",
    ],
    responsibilities: [
      "Supervision shall verify the permit is complete, posted, and coordinated with fire-watch expectations.",
    ],
    controls: [
      "Obtain the hot-work permit before starting work.",
      "Verify combustibles control, extinguisher access, and fire-watch readiness.",
      "Stop work when permit conditions change or expire.",
    ],
    training: [
      "Workers shall be trained on hot-work permit expectations and fire-watch duties.",
    ],
  },
  {
    category: "permit",
    item: "Crane Permit",
    title: "Crane Permit Program",
    summary: "This program establishes the site-issued authorization required before a crane is set up, repositioned, or operated on the project.",
    oshaRefs: ["OSHA 1926 Subpart CC - Cranes and Derricks in Construction"],
    applicableWhen: [
      "Selected work uses a mobile, tower, or assist crane and the project or owner requires a site crane permit before setup or operation.",
    ],
    responsibilities: [
      "Supervision shall obtain the crane permit, confirm operator qualification, and coordinate setup location, swing radius, and surrounding work before operations begin.",
    ],
    controls: [
      "Secure the crane permit before the crane is positioned, rigged, or used for any pick.",
      "Confirm ground conditions, outrigger pads, swing radius, overhead clearances, and exclusion zones against the permit.",
      "Stop operations and re-permit when the crane is relocated, reconfigured, or conditions change beyond the permit terms.",
    ],
    training: [
      "Operators, riggers, and signal persons shall be trained on crane-permit expectations and site-specific setup rules.",
    ],
  },
  {
    category: "permit",
    item: "Pick Plan",
    title: "Pick Plan Program",
    summary: "This program establishes the written pick-plan controls for individual lifts, including rigging, load path, communications, and hold points.",
    oshaRefs: ["OSHA 1926 Subpart CC - Cranes and Derricks in Construction"],
    applicableWhen: [
      "Selected work includes lifts that require a written pick plan under the crane permit, critical-lift rules, or site terminology.",
    ],
    responsibilities: [
      "Supervision shall verify the pick plan is prepared, reviewed, and signed before the lift, and confirm the qualified rigger, signal person, and operator are assigned.",
    ],
    controls: [
      "Complete the pick plan before the lift and keep it at the crane and on the work deck.",
      "Control the load path and landing area so no employee works, stands, or travels beneath a suspended load.",
      "Pause and re-review the pick plan when load weight, radius, rigging, wind, or surrounding work changes.",
    ],
    training: [
      "Riggers, signal persons, and the lift crew shall be trained on pick-plan content and communication expectations.",
    ],
  },
  {
    category: "permit",
    item: "Elevated Work Notice",
    title: "Elevated Work Notice Program",
    summary: "This program establishes the notice and authorization expectations for work performed at height where the site requires a heads-up to affected trades and supervision.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work is performed at height and site rules require an elevated-work notice or equivalent heads-up to the controlling contractor.",
    ],
    responsibilities: [
      "Supervision shall issue the elevated-work notice, coordinate affected trades, and verify barricades, drop-zone controls, and fall protection before crews go up.",
    ],
    controls: [
      "Submit the elevated-work notice before elevated work begins and keep it current as the work face moves.",
      "Maintain drop-zone barricades, overhead protection, and access controls below the work.",
      "Stop elevated work when the notice lapses, the drop zone is compromised, or fall protection cannot be maintained.",
    ],
    training: [
      "Workers shall be trained on elevated-work notice expectations, fall protection, and drop-zone coordination.",
    ],
  },
  {
    category: "permit",
    item: "Confined Space Permit",
    title: "Confined Space Permit Program",
    summary: "This program defines the permit documentation, role assignments, atmospheric review, and rescue readiness required for confined-space entry.",
    oshaRefs: ["OSHA 1926 Subpart AA - Confined Spaces in Construction"],
    applicableWhen: [
      "Selected work requires a confined-space entry permit.",
    ],
    responsibilities: [
      "Supervision shall verify the permit, entry conditions, monitoring, and rescue readiness before authorizing entry.",
    ],
    controls: [
      "Complete the confined-space permit before entry begins.",
      "Document entrant, attendant, and supervisor assignments.",
      "Verify monitoring, communication, and rescue requirements before entry.",
    ],
    training: [
      "Entrants, attendants, and supervisors shall be trained on permit-entry duties.",
    ],
    subtypeGroup: "confined_space_classification",
    subtypeVariants: {
      permit_required: {
        title: "Permit-Required Confined Space Permit Program",
        summary: "This program applies when a permit-required confined-space entry permit is needed for the selected work.",
      },
      non_permit: {
        title: "Non-Permit Confined Space Entry Review Program",
        summary: "This program applies when the selected confined-space work is reviewed as non-permit entry but still requires documented classification and field controls.",
        applicableWhen: [
          "Selected confined-space work is classified as non-permit entry.",
        ],
        controls: [
          "Document the non-permit classification before entry begins.",
          "Verify conditions remain consistent with the non-permit classification.",
          "Escalate to permit-required entry if hazards change or increase.",
        ],
      },
    },
  },
  {
    category: "permit",
    item: "LOTO Permit",
    title: "Lockout / Tagout Program",
    summary: "This program establishes the isolation, verification, and coordination steps required before servicing or working around hazardous energy sources.",
    oshaRefs: ["OSHA 1926 Subpart K - Electrical"],
    applicableWhen: [
      "Selected work requires energy isolation before servicing, testing, or tie-in activities.",
    ],
    responsibilities: [
      "Supervision shall confirm isolation points, affected parties, and verification steps before work begins.",
    ],
    controls: [
      "Identify all hazardous energy sources before work starts.",
      "Apply lockout/tagout devices and verify zero-energy state before servicing.",
      "Control restart and re-energization through documented release steps.",
    ],
    training: [
      "Workers shall be trained on hazardous-energy recognition and lockout/tagout verification.",
    ],
  },
  {
    category: "permit",
    item: "Ladder Permit",
    title: "Ladder Use Controls",
    summary: LADDER_USE_PROGRAM_SUMMARY,
    oshaRefs: ["OSHA 1926 Subpart X - Stairways and Ladders"],
    applicableWhen: [
      "The project requires a signed ladder permit, GC tag, or pre-use authorization in addition to field rules for a given area or work package.",
    ],
    responsibilities: [...LADDER_USE_RESPONSIBILITIES],
    controls: [...LADDER_USE_CONTROLS],
    training: [...LADDER_USE_TRAINING],
    compactLayout: true,
  },
  {
    category: "permit",
    item: "AWP/MEWP Permit",
    title: "Aerial Work Platform / MEWP Program",
    summary: "This program establishes authorization, inspection, and operating controls for MEWPs and other aerial work platforms.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work uses an aerial work platform or MEWP for access or task execution.",
    ],
    responsibilities: [
      "Supervision shall verify operator authorization, equipment inspection, and travel path review before use.",
    ],
    controls: [
      "Inspect the lift before use.",
      "Use approved fall protection when required by the equipment or site rules.",
      "Control travel paths, overhead clearance, and exclusion zones while operating the lift.",
    ],
    training: [
      "Operators shall be trained and authorized for the specific lift type in use.",
    ],
  },
  {
    category: "permit",
    item: "Trench Inspection Permit",
    title: "Trench Inspection and Entry Program",
    summary: "This program establishes the inspection, authorization, and reinspection controls required before crews enter trench or excavation work areas.",
    oshaRefs: ["OSHA 1926 Subpart P - Excavations"],
    applicableWhen: [
      "Selected work requires trench or excavation inspection documentation before entry.",
    ],
    responsibilities: [
      "The competent person shall document inspections. Any worker shall stop work when conditions change; the competent person or assigned supervisor verifies and releases the work for restart per site rules.",
    ],
    controls: [
      "Inspect the excavation before each shift and after conditions change.",
      "Verify protective systems, access/egress, and spoil-pile controls before entry.",
      "Do not allow entry when inspections are incomplete or conditions are unsafe.",
    ],
    training: [
      "Workers shall be trained on excavation-entry limits and competent-person expectations.",
    ],
  },
  {
    category: "permit",
    item: "Chemical Permit",
    title: "Chemical Use Authorization Program",
    summary: "This program establishes authorization, review, and field controls when selected work uses chemicals requiring site approval.",
    oshaRefs: ["OSHA 1926.59 - Hazard Communication"],
    applicableWhen: [
      "Selected work includes chemical products that require project review or approval before use.",
    ],
    responsibilities: [
      "Supervision shall confirm SDS review, storage planning, and approval requirements before products are brought on site.",
    ],
    controls: [
      "Review the product SDS and labeling before use.",
      "Confirm required PPE, ventilation, and spill-response materials are in place.",
      "Do not use unapproved chemical products on site.",
    ],
    training: [
      "Workers shall be trained on approved chemical-use procedures and emergency response expectations.",
    ],
  },
  {
    category: "permit",
    item: "Motion Permit",
    title: "Equipment Motion and Traffic Control Program",
    summary: "This program establishes movement authorization and traffic-control expectations for cranes, equipment, forklifts, and delivery routes.",
    oshaRefs: ["OSHA 1926 Subpart O - Motor Vehicles, Mechanized Equipment, and Marine Operations"],
    applicableWhen: [
      "Selected work requires controlled equipment movement, traffic routing, or material-transport authorization.",
    ],
    responsibilities: [
      "Supervision shall coordinate haul routes, spotters, and exclusion zones before movement begins.",
    ],
    controls: [
      "Review travel paths, blind spots, and exclusion zones before equipment moves.",
      "Use spotters or traffic control where required.",
      "Pause movement when routes are blocked or personnel enter the controlled area.",
    ],
    training: [
      "Workers shall be trained on traffic-control expectations and spotter communication.",
    ],
  },
  {
    category: "permit",
    item: "Temperature Permit",
    title: "Temperature Exposure Program",
    summary: "This program establishes planning and field controls for selected work performed under heat, cold, or temperature-sensitive permit conditions.",
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
    applicableWhen: [
      "Selected work is controlled by temperature-related site restrictions or permit requirements.",
    ],
    responsibilities: [
      "Supervision shall adjust work practices when temperature conditions increase worker exposure.",
    ],
    controls: [
      "Review temperature restrictions before work starts.",
      "Plan hydration, warm-up, cooldown, and rest-break expectations for the shift.",
      "Stop work when conditions exceed the approved permit or site limits.",
    ],
    training: [
      "Workers shall be trained on recognizing heat- and cold-stress exposure signs.",
    ],
  },
  {
    category: "permit",
    item: "Gravity Permit",
    title: "Overhead and Gravity Hazard Program",
    summary: "This program establishes controls for gravity-driven exposure such as dropped materials, edge exposure, and protected access below work areas, including CAZ (controlled access zone) use where the site or scope requires a clear boundary, not just a generic drop zone.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work creates overhead or gravity-driven exposure to people below or adjacent to the work area.",
    ],
    responsibilities: [
      `Supervision shall define drop zones, barricades, CAZ or exclusion limits, and protected access before overhead work begins. ${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} ${CSEP_RESTART_AFTER_VERIFICATION}`,
    ],
    controls: [
      "Maintain barricades, overhead protection, and signed exclusion limits; where a CAZ is required, align it with the same communication used for the drop or fall path so unauthorized ironworkers, laborers, and other trades stay out.",
      "Post and enforce the CAZ with barricades, warning line, or signage; coordinate re-briefs when overhead work, picks, or swing activity change.",
      "Secure tools, materials, and debris from displacement.",
      "Coordinate adjacent access so workers do not pass below uncontrolled overhead work or an inactive CAZ line.",
    ],
    training: [
      "Workers shall be trained on drop zone and CAZ discipline, and on overhead hazard and boundary communication.",
    ],
  },
  {
    category: "ppe",
    item: "Hard Hat",
    title: "Head Protection Program",
    summary: "This program establishes minimum requirements for head protection in areas with overhead work, falling-object exposure, or impact hazards.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: ["Selected work or site rules require head protection."],
    responsibilities: [
      "Supervision shall verify approved head protection is worn in designated work areas.",
    ],
    controls: [
      "Wear head protection that is in serviceable condition and appropriate for the hazard.",
      "Remove damaged or modified hard hats from service.",
      "Keep head protection on whenever overhead or impact exposure exists.",
    ],
    training: [
      "Workers shall be trained on inspection, fit, and use limits for head protection.",
    ],
  },
  {
    category: "ppe",
    item: "Safety Glasses",
    title: "Eye Protection Program",
    summary: "This program establishes minimum requirements for eye protection during work with flying particles, dust, splash, or impact exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work exposes crews to dust, debris, impact, splash, or other eye hazards.",
    ],
    responsibilities: [
      "Supervision shall verify eye protection is appropriate for the task and condition of the work area.",
    ],
    controls: [
      "Wear approved eye protection whenever eye hazards are present.",
      "Keep lenses clean and replace damaged eye protection immediately.",
      "Upgrade to face-shield or specialty protection when the task creates additional exposure.",
    ],
    training: [
      "Workers shall be trained on eye-hazard recognition and PPE selection for the task.",
    ],
  },
  {
    category: "ppe",
    item: "High Visibility Vest",
    title: "High-Visibility Apparel Program",
    summary: "This program establishes minimum requirements for high-visibility garments in areas with equipment traffic, deliveries, or vehicle exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work occurs around moving equipment, haul routes, or active traffic interfaces.",
    ],
    responsibilities: [
      "Supervision shall verify high-visibility apparel is worn in traffic-exposed work areas.",
    ],
    controls: [
      "Wear high-visibility garments that remain visible, clean, and in good condition.",
      "Replace garments that no longer provide effective visibility.",
      "Do not enter active traffic or equipment zones without the required visibility controls.",
    ],
    training: [
      "Workers shall be trained on site traffic-control expectations and high-visibility requirements.",
    ],
  },
  {
    category: "ppe",
    item: "Gloves",
    title: "Hand Protection Program",
    summary: "This program establishes minimum requirements for hand protection during material handling, tool use, and contact with sharp, rough, or hazardous surfaces.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work creates cut, abrasion, pinch-point, chemical, or handling exposure to the hands.",
    ],
    responsibilities: [
      "Supervision shall verify glove selection is appropriate for the hazard and task.",
    ],
    controls: [
      "Use glove types appropriate to the work being performed.",
      "Replace gloves that are damaged, saturated, or no longer protective.",
      "Do not rely on gloves where entanglement or rotating-equipment exposure makes them unsafe.",
    ],
    training: [
      "Workers shall be trained on glove selection and limitations for the selected task.",
    ],
  },
  {
    category: "ppe",
    item: "Steel Toe Boots",
    title: "Foot Protection Program",
    summary: "This program establishes minimum requirements for foot protection where impact, puncture, or material-handling exposure exists.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work includes material handling, equipment movement, uneven terrain, or puncture exposure.",
    ],
    responsibilities: [
      "Supervision shall verify workers wear approved protective footwear in designated work areas.",
    ],
    controls: [
      "Wear protective footwear appropriate for the work conditions.",
      "Keep soles, uppers, and toe protection in serviceable condition.",
      "Use slip-resistant or specialty footwear when site conditions require it.",
    ],
    training: [
      "Workers shall be trained on footwear expectations and condition checks.",
    ],
  },
  {
    category: "ppe",
    item: "Hearing Protection",
    title: "Hearing Conservation Program",
    summary: "This program establishes minimum requirements for hearing protection where selected work creates elevated noise exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work includes equipment, cutting, grinding, demolition, or other high-noise activity.",
    ],
    responsibilities: [
      "Supervision shall verify hearing protection is available and worn where noise exposure requires it.",
    ],
    controls: [
      "Wear hearing protection in designated high-noise areas.",
      "Inspect and replace disposable or damaged hearing protection as needed.",
      "Use task planning and equipment controls to reduce exposure duration where possible.",
    ],
    training: [
      "Workers shall be trained on noise exposure signs and proper hearing protection use.",
    ],
  },
  {
    category: "ppe",
    item: "Face Shield",
    title: "Face Protection Program",
    summary: "This program establishes minimum requirements for face protection when selected work creates splash, spark, arc, or flying-particle exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work creates additional face exposure beyond standard eye protection.",
    ],
    responsibilities: [
      "Supervision shall verify face protection is used with the correct supporting PPE for the task.",
    ],
    controls: [
      "Use face shields together with required eye protection when the task creates face exposure.",
      "Inspect shields before use and replace damaged equipment.",
      "Select face protection appropriate to the heat, chemical, or impact hazard.",
    ],
    training: [
      "Workers shall be trained on the tasks that require face protection and its limitations.",
    ],
  },
  {
    category: "ppe",
    item: "Respiratory Protection",
    title: "Respiratory Protection Program",
    summary: "This program establishes minimum requirements for respiratory protection when selected work creates dust, fume, vapor, or airborne contaminant exposure.",
    oshaRefs: ["OSHA 1926 Subpart E - PPE"],
    applicableWhen: [
      "Selected work includes airborne contaminant exposure requiring respiratory protection.",
    ],
    responsibilities: [
      "Supervision shall verify respiratory protection requirements, fit expectations, and cartridge or filter selection before work begins.",
    ],
    controls: [
      "Use the respirator type specified for the selected exposure.",
      "Inspect respirators before use and replace damaged equipment, cartridges, or filters as required.",
      "Do not perform respiratory-protected work when fit, seal, or equipment condition is not acceptable.",
    ],
    training: [
      "Workers shall be trained on respirator selection, inspection, fit, and task-specific limitations.",
    ],
  },
  {
    category: "ppe",
    item: "Fall Protection Harness",
    title: "Personal Fall Arrest Equipment Program",
    summary: "This program establishes minimum requirements for harnesses, lanyards, SRLs, anchors, and personal fall arrest equipment.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: ["Selected work requires personal fall arrest equipment."],
    responsibilities: [
      "Supervision shall verify compatible anchor points and arrest equipment are identified before elevated work begins.",
    ],
    controls: [
      "Inspect harnesses, lanyards, SRLs, and connectors before each use.",
      "Use only approved anchorages and compatible components.",
      "Remove damaged or deployed arrest equipment from service immediately.",
    ],
    training: [
      "Workers shall be trained on inspection, fitting, anchorage selection, and equipment limits.",
    ],
  },
];

export const DEFAULT_PROGRAM_DEFINITIONS: CSEPProgramDefinition[] = BASE_PROGRAM_DEFINITIONS.map(
  (definition) =>
    applyProcedureFields(definition, definition.category === "hazard"
      ? HAZARD_PROCEDURE_CONTENT[definition.item]
      : undefined
    )
).map((definition) => ({
  ...definition,
  subtypeVariants: definition.subtypeVariants
    ? Object.fromEntries(
        Object.entries(definition.subtypeVariants).map(([key, value]) => [
          key,
          value
            ? applyProcedureFields(
                value,
                definition.category === "hazard" && definition.item === "Confined spaces"
                  ? CONFINED_SPACE_SUBTYPE_PROCEDURE_CONTENT[key as CSEPProgramSubtypeValue]
                  : undefined
              )
            : value,
        ])
      ) as CSEPProgramDefinition["subtypeVariants"]
    : undefined,
}));

const PROGRAM_DEFINITIONS = DEFAULT_PROGRAM_DEFINITIONS;

export function getProgramDefinitionKey(input: Pick<CSEPProgramDefinition, "category" | "item">) {
  return `${input.category}::${input.item}`;
}

export function getDefaultProgramDefinitions() {
  return PROGRAM_DEFINITIONS.map(cloneProgramDefinition);
}

export function normalizeCsepProgramConfig(input: unknown): CSEPProgramConfig {
  const rawDefinitions = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { definitions?: unknown }).definitions)
      ? (input as { definitions: unknown[] }).definitions
      : [];

  const overridesByKey = new Map<string, unknown>();

  for (const item of rawDefinitions) {
    if (!item || typeof item !== "object") continue;
    const category = typeof (item as { category?: unknown }).category === "string"
      ? ((item as { category: string }).category as CSEPProgramCategory)
      : null;
    const programItem =
      typeof (item as { item?: unknown }).item === "string"
        ? (item as { item: string }).item.trim()
        : "";
    if (!category || !programItem) continue;
    overridesByKey.set(getProgramDefinitionKey({ category, item: programItem }), item);
  }

  return {
    definitions: PROGRAM_DEFINITIONS.map((fallback) => {
      const override =
        overridesByKey.get(getProgramDefinitionKey(fallback)) as
          | (Partial<CSEPProgramDefinition> & Record<string, unknown>)
          | undefined;

      return {
        category: fallback.category,
        item: fallback.item,
        title: normalizeText(override?.title, fallback.title),
        summary: normalizeText(override?.summary, fallback.summary),
        oshaRefs: normalizeTextList(override?.oshaRefs, fallback.oshaRefs),
        applicableWhen: normalizeTextList(override?.applicableWhen, fallback.applicableWhen),
        responsibilities: normalizeTextList(
          override?.responsibilities,
          fallback.responsibilities
        ),
        preTaskProcedures: normalizeTextList(
          override?.preTaskProcedures,
          fallback.preTaskProcedures
        ),
        workProcedures: normalizeTextList(override?.workProcedures, fallback.workProcedures),
        stopWorkProcedures: normalizeTextList(
          override?.stopWorkProcedures,
          fallback.stopWorkProcedures
        ),
        closeoutProcedures: normalizeTextList(
          override?.closeoutProcedures,
          fallback.closeoutProcedures
        ),
        controls: normalizeTextList(override?.controls, fallback.controls),
        training: normalizeTextList(override?.training, fallback.training),
        ...(fallback.subtypeGroup ? { subtypeGroup: fallback.subtypeGroup } : {}),
        ...(fallback.subtypeVariants
          ? {
              subtypeVariants: normalizeSubtypeVariants(
                override?.subtypeVariants,
                fallback.subtypeVariants
              ),
            }
          : {}),
        ...(typeof override?.compactLayout === "boolean"
          ? { compactLayout: override.compactLayout }
          : fallback.compactLayout
          ? { compactLayout: true }
          : {}),
      };
    }),
  };
}

function fallbackDefinition(category: CSEPProgramCategory, item: string): ProgramDefinition {
  if (category === "permit") {
    return {
      category,
      item,
      title: `${item} Program`,
      summary: `This program establishes the minimum authorization, review, and field controls required for ${item.toLowerCase()}.`,
      oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
      applicableWhen: [`Selected work requires ${item.toLowerCase()}.`],
      responsibilities: [
        "Supervision shall review the permit expectations and verify required approvals before work begins.",
      ],
      preTaskProcedures: [],
      workProcedures: [],
      stopWorkProcedures: [],
      closeoutProcedures: [],
      controls: [
        "Obtain the required permit or authorization before work starts.",
        "Verify field conditions remain consistent with the permit requirements.",
        "Stop work when permit conditions change or cannot be maintained.",
      ],
      training: [
        "Workers shall be trained on permit expectations and stop-work triggers tied to the selected scope.",
      ],
    };
  }

  if (category === "ppe") {
    return {
      category,
      item,
      title: `${item} Protection Program`,
      summary: `This program establishes minimum use, inspection, and maintenance requirements for ${item.toLowerCase()}.`,
      oshaRefs: ["OSHA 1926 Subpart E - PPE"],
      applicableWhen: [`Selected work requires ${item.toLowerCase()}.`],
      responsibilities: [
        "Supervision shall verify the selected PPE is available, appropriate, and worn as required.",
      ],
      preTaskProcedures: [],
      workProcedures: [],
      stopWorkProcedures: [],
      closeoutProcedures: [],
      controls: [
        "Inspect PPE before use and replace damaged equipment immediately.",
        "Use PPE appropriate for the selected task and exposure.",
        "Stop work when required PPE is missing or no longer effective.",
      ],
      training: [
        "Workers shall be trained on PPE selection, inspection, use, and limitations.",
      ],
    };
  }

  return {
    category,
    item,
    title: `${item} Safety Program`,
    summary: `This program establishes minimum controls for ${item.toLowerCase()} exposure during the selected work.`,
    oshaRefs: ["OSHA 1926 Subpart C - General Safety and Health Provisions"],
    applicableWhen: [`Selected work creates ${item.toLowerCase()} exposure.`],
    responsibilities: [
      "Supervision shall review the hazard exposure and verify controls before work begins.",
    ],
    preTaskProcedures: [
      "Review the task scope, work area, and required hazard controls before starting the exposure.",
    ],
    workProcedures: [
      "Carry out the work using the planned control measures and keep affected workers informed as conditions change.",
    ],
    stopWorkProcedures: [
      "Stop work when the exposure changes or the planned controls are not effective.",
    ],
    closeoutProcedures: [
      "Leave the work area in a stable condition and report unresolved exposure concerns before turnover.",
    ],
    controls: [
      "Review the exposure during pre-task planning.",
      "Maintain required controls throughout the task.",
      "Stop work when conditions change or controls are not effective.",
    ],
    training: [
      "Workers shall be trained on hazard recognition and response expectations for the selected exposure.",
    ],
  };
}

function findDefinition(
  category: CSEPProgramCategory,
  item: string,
  definitions: CSEPProgramDefinition[] = PROGRAM_DEFINITIONS
) {
  return definitions.find((definition) => definition.category === category && definition.item === item);
}

function resolveDefinition(
  selection: CSEPProgramSelection,
  definitions: CSEPProgramDefinition[] = PROGRAM_DEFINITIONS
): ProgramDefinition {
  const base =
    findDefinition(selection.category, selection.item, definitions) ??
    fallbackDefinition(selection.category, selection.item);
  const subtypeVariant =
    selection.subtype && base.subtypeVariants ? base.subtypeVariants[selection.subtype] : null;

  return {
    ...base,
    ...(subtypeVariant ?? {}),
    oshaRefs: dedupe(subtypeVariant?.oshaRefs ?? base.oshaRefs),
    applicableWhen: dedupe(subtypeVariant?.applicableWhen ?? base.applicableWhen),
    responsibilities: dedupe(subtypeVariant?.responsibilities ?? base.responsibilities),
    preTaskProcedures: dedupe(subtypeVariant?.preTaskProcedures ?? base.preTaskProcedures),
    workProcedures: dedupe(subtypeVariant?.workProcedures ?? base.workProcedures),
    stopWorkProcedures: dedupe(
      subtypeVariant?.stopWorkProcedures ?? base.stopWorkProcedures
    ),
    closeoutProcedures: dedupe(
      subtypeVariant?.closeoutProcedures ?? base.closeoutProcedures
    ),
    controls: dedupe(subtypeVariant?.controls ?? base.controls),
    training: dedupe(subtypeVariant?.training ?? base.training),
  };
}

export function getProgramSelectionKey(
  category: CSEPProgramCategory,
  item: string,
  subtype?: CSEPProgramSubtypeValue | null
) {
  return [category, item, subtype ?? "base"].map(slugify).join("__");
}

export function getSubtypeConfig(group: CSEPProgramSubtypeGroup) {
  return SUBTYPE_CONFIGS[group];
}

export function getProgramSubtypeGroup(
  category: CSEPProgramCategory,
  item: string
): CSEPProgramSubtypeGroup | null {
  return findDefinition(category, item)?.subtypeGroup ?? null;
}

export function getRequiredProgramSubtypeGroups(items: Array<Pick<CSEPProgramSelection, "category" | "item">>) {
  const groups = new Set<CSEPProgramSubtypeGroup>();
  for (const item of items) {
    const group = getProgramSubtypeGroup(item.category, item.item);
    if (group) groups.add(group);
  }
  return [...groups].map((group) => SUBTYPE_CONFIGS[group]);
}

function buildSelection(
  category: CSEPProgramCategory,
  item: string,
  relatedTasks: string[],
  source: CSEPProgramSelectionSource,
  subtypeSelections?: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>
): CSEPProgramSelection {
  const subtypeGroup = getProgramSubtypeGroup(category, item);
  return {
    category,
    item,
    subtype: subtypeGroup ? subtypeSelections?.[subtypeGroup] ?? null : null,
    relatedTasks: dedupe(relatedTasks),
    source,
  };
}

export function findMissingProgramSubtypeGroups(
  selections: Array<Pick<CSEPProgramSelection, "category" | "item" | "subtype">>
) {
  const missing = new Set<CSEPProgramSubtypeGroup>();

  for (const selection of selections) {
    const group = getProgramSubtypeGroup(selection.category, selection.item);
    if (group && !selection.subtype) {
      missing.add(group);
    }
  }

  return [...missing].map((group) => SUBTYPE_CONFIGS[group]);
}

export function normalizeProgramSelections(inputs: CSEPProgramSelectionInput[]) {
  const byKey = new Map<string, CSEPProgramSelection>();

  for (const input of inputs) {
    const selection: CSEPProgramSelection = {
      category: input.category,
      item: input.item,
      subtype: input.subtype ?? null,
      source: input.source ?? "selected",
      relatedTasks: dedupe(input.relatedTasks ?? []),
    };
    const key = getProgramSelectionKey(selection.category, selection.item, selection.subtype);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, selection);
      continue;
    }
    existing.relatedTasks = dedupe([...existing.relatedTasks, ...selection.relatedTasks]);
  }

  return [...byKey.values()];
}

export function buildCsepProgramSelections(params: BuildSelectionsParams) {
  const tradeItems = params.tradeItems ?? [];
  const selectedTasks = dedupe(params.selectedTasks ?? []);
  const rawSelections: CSEPProgramSelectionInput[] = [];

  for (const hazard of dedupe(params.selectedHazards)) {
    rawSelections.push({
      category: "hazard",
      item: hazard,
      relatedTasks: tradeItems.filter((row) => row.hazard === hazard).map((row) => row.activity),
      source: "selected",
    });
  }

  for (const permit of dedupe(params.selectedPermits)) {
    const relatedPermitTasks = tradeItems.filter((row) => row.permit === permit).map((row) => row.activity);
    rawSelections.push({
      category: "permit",
      item: permit,
      relatedTasks: relatedPermitTasks.length ? relatedPermitTasks : selectedTasks,
      source: relatedPermitTasks.length ? "derived" : "selected",
    });
  }

  for (const ppe of dedupe(params.selectedPpe)) {
    rawSelections.push({
      category: "ppe",
      item: ppe,
      relatedTasks: selectedTasks,
      source: "selected",
    });
  }

  const selections = normalizeProgramSelections(
    rawSelections.map((selection) =>
      buildSelection(
        selection.category,
        selection.item,
        selection.relatedTasks ?? [],
        selection.source ?? "selected",
        params.subtypeSelections
      )
    )
  );

  return {
    selections,
    missingSubtypeGroups: findMissingProgramSubtypeGroups(selections),
  };
}

const FALL_WHEN_NOT_REQUIRED_LEAD =
  "This program does not apply where employees are working from a fully protected walking/working surface and no fall exposure exists, including ground-level work, work behind compliant guardrails, or work areas where approved covers or barriers fully eliminate the fall hazard.";

const FALL_WHEN_NOT_REQUIRED_BULLETS = [
  "Ground-level work with no unprotected change in elevation.",
  "Compliant, continuous edge protection (or approved barrier) for the path of travel.",
  "Covered, secured, and marked openings where no lower-level fall exposure remains for the task.",
];

const FALL_CONTROL_LINES = {
  planning:
    "Verify the fall hazard, access method, anchorage plan, rescue path, and release authority before exposed work begins.",
  inspection:
    "Inspect harnesses, lanyards, SRLs, hooks, connectors, and anchors before each use. Remove damaged, defective, or deployed equipment from service immediately.",
  anchorage:
    "Use only approved anchorage points and compatible components rated for the intended application.",
  tieOff: "Maintain 100% tie-off where required by the activity, site rules, or fall exposure.",
  fallClearance:
    "Confirm adequate free-fall, swing, and lower-level clearance before work and whenever anchorage, position, or conditions change.",
  leadingEdge:
    "Use approved fall protection for leading-edge work, incomplete decking, connectors, and elevated access areas as defined in the pre-task plan.",
  damage: "Protect fall protection equipment from sharp edges, heat, welding exposure, chemicals, and physical damage.",
  training:
    "Workers shall be trained on inspection, fitting, anchorage selection, equipment limits, and rescue notification before use.",
  stopWork:
    "Stop work when anchor points, edge protection, access, rescue readiness, or equipment condition are not adequate for the task.",
} as const;

function sentenceize(value: string) {
  const t = value.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function buildFallProtectionGoverningProgramSection(
  selection: CSEPProgramSelection,
  definition: CSEPProgramDefinition,
  relatedTasks: string[]
): CSEPProgramSection {
  const whenRequired = dedupe(
    definition.applicableWhen.length
      ? definition.applicableWhen
      : [
          "Fall to a lower level: edges, openings, leading deck, or incomplete floor.",
          "Steel, decking, or connector work where the plan or rules require a fall system or collective protection.",
        ]
  );

  let planningBody: string = FALL_CONTROL_LINES.planning;
  if (definition.preTaskProcedures.length) {
    planningBody = `${planningBody} ${definition.preTaskProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let trainingBody: string = FALL_CONTROL_LINES.training;
  if (definition.training.length) {
    trainingBody = `${trainingBody} ${definition.training.map(sentenceize).join(" ")}`.trim();
  }
  if (definition.responsibilities.length) {
    trainingBody = `${trainingBody} ${definition.responsibilities.map(sentenceize).join(" ")}`.trim();
  }

  let stopBody: string = FALL_CONTROL_LINES.stopWork;
  const addedStop = dedupe([...definition.stopWorkProcedures, ...definition.closeoutProcedures]);
  if (addedStop.length) {
    stopBody = `${stopBody} ${addedStop.map(sentenceize).join(" ")}`.trim();
  }

  const subsections: CSEPProgramSection["subsections"] = [
    {
      title: "Applicable References",
      body: undefined,
      bullets: formatApplicableReferenceBullets(definition.oshaRefs),
    },
    { title: "When Required", body: undefined, bullets: whenRequired },
    { title: "When Not Required", body: FALL_WHEN_NOT_REQUIRED_LEAD, bullets: FALL_WHEN_NOT_REQUIRED_BULLETS },
    { title: "Planning / Release for Work", body: planningBody, bullets: [] },
    { title: "Inspection", body: FALL_CONTROL_LINES.inspection, bullets: [] },
    { title: "Anchorage and Compatibility", body: FALL_CONTROL_LINES.anchorage, bullets: [] },
    { title: "Tie-Off", body: FALL_CONTROL_LINES.tieOff, bullets: [] },
    { title: "Fall Clearance", body: FALL_CONTROL_LINES.fallClearance, bullets: [] },
    { title: "Leading Edge / Access Conditions", body: FALL_CONTROL_LINES.leadingEdge, bullets: [] },
    { title: "Protection from Damage", body: FALL_CONTROL_LINES.damage, bullets: [] },
    { title: "Training", body: trainingBody, bullets: [] },
    { title: "Stop-Work", body: stopBody, bullets: [] },
  ];

  if (definition.controls.length) {
    subsections.push({ title: "Site-Specific", body: undefined, bullets: definition.controls });
  }
  if (definition.workProcedures.length) {
    subsections.push({
      title: "Work Execution (additions)",
      body: undefined,
      bullets: definition.workProcedures,
    });
  }
  if (relatedTasks.length) {
    subsections.push({
      title: "Related Tasks",
      body: `Related tasks: ${relatedTasks.join(", ")}.`,
      bullets: [],
    });
  }

  return {
    key: `program_${getProgramSelectionKey(selection.category, selection.item, selection.subtype)}`,
    category: selection.category,
    item: selection.item,
    subtype: selection.subtype ?? null,
    title: definition.title,
    summary: definition.summary?.trim() ?? undefined,
    relatedTasks,
    subsections,
  };
}

const HOT_WORK_PURPOSE_WHEN = `Use this program whenever welding, cutting, grinding, brazing, soldering, or other spark- or flame-producing work is performed. The core risk is fire from open flame, sparks, or hot metal igniting combustibles, coatings, or concealed materials—and fire spread to nearby work areas, floors, or occupancies.`;

const HOT_WORK_PRE_TASK = `Confirm the hot work permit is active, combustibles are removed or protected, fire extinguishers are staged, ventilation is adequate, and the work area above, below, and on the opposite side is checked before starting.`;

const HOT_WORK_ACTIVE = `Maintain spark containment, fire-watch coverage, controlled access, orderly hose and lead routing, and protection of adjacent workers and materials while hot work is in progress.`;

const HOT_WORK_CLOSEOUT = `Complete the required fire-watch period, inspect the area for smoldering material, shut down equipment safely, and close out the permit before normal access is restored.`;

const HOT_WORK_STOP = `Stop work when fire-watch coverage, extinguishers, ventilation, permit conditions, spark containment, or area control are not adequate for the active task.`;

const HOT_WORK_CORE_BULLETS: string[] = [
  "Permit: Use an active, task- and location-appropriate hot work permit before ignition; follow the project permit process for authorization and posting (do not restate full permit language from the permit section here).",
  "Combustibles: Remove or protect combustibles in the heat and spark path; re-check when the work front moves, openings are created, or new materials enter.",
  "Extinguishers: Stage the required class and number of fire extinguishers in the immediate area; verify operability and access before starting.",
  "Fire watch: Assign fire watch when the permit, policy, or conditions require it; maintain continuous, trained coverage with relief as required.",
  "Overhead / below / opposite: Check exposure above, below, and on the opposite side of the work before start and when conditions change.",
  "Spark containment: Control sparks, slag, and spatter with shields, blankets, baffles, or screens as required.",
  "Cylinders, hoses, leads: Keep torch equipment, hoses, and leads in good condition, clear of hot metal and trip paths, per manufacturer and site rules.",
  "Ventilation: Provide ventilation suitable for the process and space (including fume control where required).",
  "Adjacent trades / occupancies: Coordinate to protect adjacent workers, materials, and occupancies; control access in the spark and heat path.",
  "Training: Train workers assigned to hot work or fire watch on permit rules, equipment checks, watch duties, and stop-work triggers before assignment.",
  "Cross-references: For permit templates, use the project hot work / permit section; for access and barricades, Security at Site; for alarms and emergency response, IIPP / Emergency Response—cite those sections instead of copying them here.",
];

function buildHotWorkGoverningProgramSection(
  selection: CSEPProgramSelection,
  definition: CSEPProgramDefinition,
  relatedTasks: string[]
): CSEPProgramSection {
  let purposeBody = HOT_WORK_PURPOSE_WHEN;
  if (definition.applicableWhen.length) {
    purposeBody = `${purposeBody} ${definition.applicableWhen.map(sentenceize).join(" ")}`.trim();
  }

  const coreBullets = dedupe([
    ...HOT_WORK_CORE_BULLETS,
    ...definition.training.map((line) => `Supplemental training: ${sentenceize(line)}`),
    ...definition.responsibilities.map((line) => `Supplemental roles: ${sentenceize(line)}`),
    ...definition.controls.map(sentenceize),
  ]);

  let preTaskBody = HOT_WORK_PRE_TASK;
  if (definition.preTaskProcedures.length) {
    preTaskBody = `${preTaskBody} ${definition.preTaskProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let workBody = HOT_WORK_ACTIVE;
  if (definition.workProcedures.length) {
    workBody = `${workBody} ${definition.workProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let closeoutBody = HOT_WORK_CLOSEOUT;
  if (definition.closeoutProcedures.length) {
    closeoutBody = `${closeoutBody} ${definition.closeoutProcedures.map(sentenceize).join(" ")}`.trim();
  }

  let stopBody = HOT_WORK_STOP;
  if (definition.stopWorkProcedures.length) {
    stopBody = `${stopBody} ${definition.stopWorkProcedures.map(sentenceize).join(" ")}`.trim();
  }

  const subsections: CSEPProgramSection["subsections"] = [
    {
      title: "Applicable References",
      body: undefined,
      bullets: formatApplicableReferenceBullets(definition.oshaRefs),
    },
    { title: "Purpose / When Required", body: purposeBody, bullets: [] },
    { title: "Core Requirements", body: undefined, bullets: coreBullets },
    { title: "Pre-Task Verification", body: preTaskBody, bullets: [] },
    { title: "Work Controls", body: workBody, bullets: [] },
    { title: "Fire Watch / Closeout", body: closeoutBody, bullets: [] },
    { title: "Stop-Work / Reassessment", body: stopBody, bullets: [] },
  ];

  if (relatedTasks.length) {
    subsections.push({
      title: "Related Tasks",
      body: `Related tasks: ${relatedTasks.join(", ")}.`,
      bullets: [],
    });
  }

  return {
    key: `program_${getProgramSelectionKey(selection.category, selection.item, selection.subtype)}`,
    category: selection.category,
    item: selection.item,
    subtype: selection.subtype ?? null,
    title: definition.title,
    summary: definition.summary?.trim() ?? undefined,
    relatedTasks,
    subsections,
  };
}

function buildCompactProgramSection(
  selection: CSEPProgramSelection,
  definition: CSEPProgramDefinition,
  relatedTasks: string[]
): CSEPProgramSection {
  const controlsParagraph = formatProgramParagraph(definition.controls);
  const applicabilityParagraph = formatProgramParagraph(definition.applicableWhen);
  const trainingParagraph = formatProgramParagraph(
    dedupe([...definition.responsibilities, ...definition.training])
  );
  const referenceParagraph = formatApplicableReferencesInline(definition.oshaRefs);
  const relatedNote = relatedTasks.length
    ? `Related tasks: ${relatedTasks.join(", ")}.`
    : null;

  const bodyParts = [
    applicabilityParagraph,
    controlsParagraph,
    trainingParagraph,
    referenceParagraph,
    relatedNote,
  ].filter((part): part is string => Boolean(part && part.trim()));

  const body = bodyParts.join(" ");

  return {
    key: `program_${getProgramSelectionKey(selection.category, selection.item, selection.subtype)}`,
    category: selection.category,
    item: selection.item,
    subtype: selection.subtype ?? null,
    title: definition.title,
    summary: definition.summary,
    relatedTasks,
    subsections: body
      ? [
          {
            // Include program title so merged sections (e.g. "14. Hazards and Controls") never repeat the same heading.
            title: `Program controls — ${definition.title}`,
            body,
            bullets: [],
          },
        ]
      : [],
  };
}

export function buildCsepProgramSection(
  selection: CSEPProgramSelection,
  options?: {
    definitions?: CSEPProgramDefinition[];
  }
): CSEPProgramSection {
  const definition = resolveDefinition(selection, options?.definitions);
  const relatedTasks = dedupe(selection.relatedTasks);
  const relatedTasksBody = relatedTasks.length
    ? `These related tasks apply to this program scope: ${relatedTasks.join(", ")}.`
    : "This program was included from the current CSEP selection set.";

  if (definition.category === "hazard" && definition.item === "Falls from height") {
    return buildFallProtectionGoverningProgramSection(selection, definition, relatedTasks);
  }

  if (definition.category === "hazard" && definition.item === "Hot work / fire") {
    return buildHotWorkGoverningProgramSection(selection, definition, relatedTasks);
  }

  if (definition.compactLayout) {
    return buildCompactProgramSection(selection, definition, relatedTasks);
  }

  const subsectionDefinitions = [
    {
      title: "When It Applies",
      bullets: definition.applicableWhen,
    },
    {
      title: "Applicable References",
      bullets: formatApplicableReferenceBullets(definition.oshaRefs),
    },
    {
      title: "Responsibilities and Training",
      bullets: dedupe([...definition.responsibilities, ...definition.training]),
    },
    {
      title: "Pre-Task Setup",
      bullets: definition.preTaskProcedures,
    },
    {
      title: "Work Execution",
      bullets: definition.workProcedures,
    },
    {
      title: "Stop-Work / Escalation",
      bullets: definition.stopWorkProcedures,
    },
    {
      title: "Post-Task / Closeout",
      bullets: definition.closeoutProcedures,
    },
    {
      title: "Minimum Required Controls",
      bullets: definition.controls,
    },
    {
      title: "Related Tasks",
      body: relatedTasksBody,
      bullets: [],
    },
  ];

  return {
    key: `program_${getProgramSelectionKey(selection.category, selection.item, selection.subtype)}`,
    category: selection.category,
    item: selection.item,
    subtype: selection.subtype ?? null,
    title: definition.title,
    summary: definition.summary,
    relatedTasks,
    subsections: subsectionDefinitions
      .map((section) =>
        PROGRAM_PARAGRAPH_SUBSECTION_TITLES.has(section.title)
          ? {
              title: section.title,
              body: section.body ?? formatProgramParagraph(section.bullets),
              bullets: [] as string[],
            }
          : section
      )
      .filter((section) => Boolean(section.body?.trim()) || section.bullets.length > 0),
  };
}

export function buildCsepProgramSections(
  selections: CSEPProgramSelection[],
  options?: {
    definitions?: CSEPProgramDefinition[];
  }
) {
  const hasLadderPermit = selections.some(
    (s) => s.category === "permit" && s.item === "Ladder Permit"
  );
  const effectiveSelections = hasLadderPermit
    ? selections.filter((s) => !(s.category === "hazard" && s.item === "Ladder misuse"))
    : selections;

  const hasFallsFromHeight = effectiveSelections.some(
    (s) => s.category === "hazard" && s.item === "Falls from height"
  );
  const withoutHarnessDuplicate = hasFallsFromHeight
    ? effectiveSelections.filter(
        (s) => !(s.category === "ppe" && s.item === "Fall Protection Harness")
      )
    : effectiveSelections;

  return withoutHarnessDuplicate.map((selection) => buildCsepProgramSection(selection, options));
}

export function listProgramTitles(
  selections: CSEPProgramSelection[],
  options?: {
    definitions?: CSEPProgramDefinition[];
  }
) {
  return buildCsepProgramSections(selections, options).map((section) => section.title);
}
