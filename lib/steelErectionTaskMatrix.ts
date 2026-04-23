/**
 * Task-specific hazard–control matrix content for steel erection plans.
 * Follow-on or minor tasks are not given the same package as crane picks, decking, or primary erection.
 */

import { normalizeTaskList } from "@/lib/csepFinalization";

export type SteelTaskMatrixContent = {
  hazards: string[];
  controls: string[];
  ppe: string[];
  permits: string[];
  competency: string[];
};

type SteelTaskMatch = {
  test: (t: string) => boolean;
  build: (ctx: { liftPlanLikely: boolean }) => SteelTaskMatrixContent;
};

function tokenize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const DEFAULT_STEEL: SteelTaskMatrixContent = {
  hazards: [
    "Struck-by or caught-between moving steel",
    "Fall exposure on incomplete structure",
    "Dropped object exposure below work",
  ],
  controls: [
    "Pre-task plan with sequence, access boundaries, and release criteria before loading below",
    "Control access; barricade drop and swing areas when those exposures exist",
    "Inspect connections and stability before release from hoisting or temporary support",
  ],
  ppe: ["Hard hat", "Safety glasses", "Gloves", "Steel-toe boots", "High-visibility apparel"],
  permits: ["Permits and authorizations as required by the site for the work actually being performed (not a default crane package)."],
  competency: [
    "Competent person for steel erection and the active task",
    "Qualified craft for the connection, hoisting, or access method in use",
  ],
};

const MATCHES: SteelTaskMatch[] = [
  {
    test: (t) =>
      (t.includes("touch") && t.includes("paint")) ||
      (t.includes("touchup") && t.includes("paint")) ||
      (t.includes("touch up") && t.includes("paint")) ||
      (t.includes("field") && t.includes("paint") && !t.includes("weld")) ||
      (t.includes("touch") && t.includes("coating")),
    // Touch-up is chemical / ignition / ventilation work — not a crane-pick or primary erection row.
    build: () => ({
      hazards: [
        "Coating, solvent, and vapor exposure (skin, respiratory, eye)",
        "Flammability and ignition from vapors, overspray, or drying; incompatible ignition sources",
        "Inadequate ventilation in enclosed or wind-shadow areas",
        "Overspray and drift onto adjacent workers, steel, or equipment",
        "Surface-prep noise, dust, or abrasion; conflict with nearby hot work or grinding",
        "Falls or awkward access if touch-up is from ladder, lift, or leading edge (task-dependent)",
      ],
      controls: [
        "SDS/label: choose respiratory and skin controls to match product and exposure; maintain ventilation or exhaust",
        "Control ignition sources; coordinate a hot-work buffer if grinding or other ignition work is in the same zone",
        "Shield or sequence overspray; barricade or exclude adjacent personnel when needed",
        "Surface prep: dust/ventilation for abrasive work; do not conflate with structural crane operations",
        "If access is from an aerial lift or ladder, use the project lift/ladder program for that access — not a steel pick plan by default",
      ],
      ppe: [
        "Chemical-appropriate gloves, eye/face, and (per assessment) task-specific respirator with correct cartridges",
        "Skin/coverall protection as SDS requires; hard hat, safety footwear, and fall protection if exposed to an edge",
      ],
      permits: [
        "Hot work permit when grinding or other ignition work is in the paint zone; otherwise project coating permit or GC rules as required",
        "Not a stand-in for crane, pick, or critical-lift authorizations unless painting is only done from a live pick (unusual; verify in the JHA)",
      ],
      competency: [
        "Crew training on product, spray equipment, and ventilation; spotter/communication in congested or overhead-adjacent areas",
        "Competent person for product-specific exposure assessment when solvents or isocyanates are involved",
      ],
    }),
  },
  {
    test: (t) => t.includes("embed") || t.includes("embodied"),
    build: () => ({
      hazards: [
        "Layout and placement accuracy vs drawings (grid, elevation, and steel–concrete interface)",
        "Edge and opening exposure when setting, adjusting, or verifying embeds at deck or perimeter",
        "Hand and pinch / crush with plates, hardware, and reinforcing or form interfaces",
        "Misplaced tools or material at height or over openings",
        "Coordination with concrete place and cure, form removal, and follow-on trades in the same bay",
      ],
      controls: [
        "Verify detail before placement; re-measure after adjacent trades or pour where tolerances are tight",
        "Protect edges and openings; do not straddle or lean past protected lines to reach an embed",
        "Housekeeping and two-hand or mechanical carry for small heavy embeds; no improvised reaches",
        "Interface meeting or RFIs for conflicts between embed trade, rebar, and concrete sequence",
        "Add hoisting, tag lines, or drop zones only when the IWP for that task includes a pick — not by default for every embed",
      ],
      ppe: [
        "Hard hat, safety glasses, gloves; fall protection when exposed to an unprotected edge or opening per site rules",
        "Hearing or dust controls if abrading, burning, or drilling at embeds",
      ],
      permits: [
        "Project permits (e.g. work-at-height, hot work) only when those triggers are actually in use for the embed task that day",
      ],
      competency: [
        "Competent person for layout and sign-off on critical locations; trade-qualified installer for the embed system",
        "Qualified rigger / signal / lift planning only if hoisting is part of the same approved step",
      ],
    }),
  },
  {
    test: (t) => t.includes("sort") && (t.includes("member") || t.includes("steel") || t.includes("material")),
    build: (_ctx) => ({
      hazards: [
        "Pinch points and sharp edges on stacked or banded material",
        "Unstable bundles, dunnage failure, and shifting stacks",
        "Tagging/identification errors leading to mispick or out-of-sequence set",
        "Ergonomic strain and manual handling; material rolling into travel paths or laydown access",
      ],
      controls: [
        "Chock and dunnage for stable stacks; band removal only in controlled order",
        "Use mechanical aids, team lifts, and push-pull limits for heavy sorts",
        "Mark picks/call-outs clearly; re-stack to keep access aisles clear of travel",
        "Keep sorted piles back from mobile equipment routes and drop zones",
      ],
      ppe: ["Cut-resistant gloves", "Hard hat", "Safety glasses", "Steel-toe", "High-visibility"],
      permits: ["None unless laydown in traffic path requires traffic control or spotter program"],
      competency: [
        "Spotter/yard lead for sort sequence; competent person for laydown organization",
        "Team lift / manual handling training as site requires",
      ],
    }),
  },
  {
    test: (t) =>
      t.includes("unload") ||
      (t.includes("receiv") && t.includes("deliver")) ||
      (t.includes("truck") && (t.includes("load") || t.includes("unstrap"))) ||
      (t.includes("laydown") && t.includes("receiv")),
    build: (_ctx) => ({
      hazards: [
        "Truck interface, load securement, and unstrapping in active yard traffic",
        "Laydown surface stability, soft/uneven ground, and cribbing failure",
        "Forklift or crane unloading, shifting steel in the pile, and uncontrolled roll",
        "Driver/spotter control; pedestrian and equipment co-mingling in exclusion",
      ],
      controls: [
        "Designate laydown; verify ground, cribbing, and pile height limits",
        "Use spotters; back-in rules; no pedestrians in swing or fork path during unstrap",
        "Coordinate unstrapping and first pick with rigger; control load with tag lines",
        "Barricade exclusion during truck offload; drivers remain in-cab where site rule applies",
      ],
      ppe: ["High-visibility", "Hard hat", "Steel-toe", "Gloves; eye protection during band removal"],
      permits: [
        "Receiving / delivery gate control as site program requires",
        "Crane or forklift work authorization in laydown or congested path",
      ],
      competency: [
        "Receiving lead; spotter; qualified rigger for first picks from the truck or pile",
        "Equipment operators licensed or qualified for mobile crane/fork and load rating",
      ],
    }),
  },
  {
    test: (t) =>
      t.includes("deck") && (t.includes("install") || t.includes("placement") || t.includes("lay")) ||
      t.includes("decking") ||
      t.includes("metal deck") ||
      t.includes("deck panel"),
    build: (_ctx) => ({
      hazards: [
        "Controlled decking zone (CDZ) and leading-edge exposure",
        "Openings, penetrations, and incomplete deck with fall-through risk",
        "Bundle landing, shifting bundles, and deck bundle stability",
        "Dropped objects and materials to levels below; restricted access under deck work",
      ],
      controls: [
        "Maintain CDZ/leading-edge program; sequential fastening and access limits",
        "Cover or barricade openings; control bundle landings to planned zones",
        "Tool tethering, toe boards, and debris controls at deck edge",
        "Restrict access below; coordinate crane/decking sequence and communication",
      ],
      ppe: [
        "100% fall protection for leading-edge/connector per plan (PFAS, positioning)",
        "Hard hat, safety glasses, gloves, high-visibility apparel, and appropriate footwear",
      ],
      permits: ["Decking/connector fall-protection plan approval; crane or hoist permits if active below"],
      competency: [
        "Trained steel connector / deck erectors per Subpart R requirements",
        "Signal person and crane crew coordination when picking bundles to deck",
      ],
    }),
  },
  {
    test: (t) =>
      (t.includes("weld") || t.includes("torch") || t.includes("braz")) && !t.includes("paint"),
    build: (_ctx) => ({
      hazards: [
        "Hot work ignition of combustible materials, coatings, and debris",
        "Arc flash, sparks, and slag; adjacent worker and below-deck exposure",
        "Fume, metal particulate, and (where applicable) lead or coated-base-metal exposure",
        "Post-activity re-ignition or smoldering after torch stops",
      ],
      controls: [
        "Hot work permit with 35-ft (or project) clearance rule and fire watch as required",
        "Remove, shield, or wet combustibles; cover openings that pass sparks",
        "Ventilation, local exhaust, or respiratory controls per exposure assessment",
        "Lead/cadmium or coated-metal programs when cutting or welding on shop primers (competent evaluation)",
      ],
      ppe: [
        "Welding hood / face shield, fire-resistant leathers, and task-appropriate respirator",
        "Hearing, eye, hand, and fall protection for position at height",
      ],
      permits: ["Hot work permit", "Atmospheric or confined monitoring if fume/space issues arise"],
      competency: [
        "Qualified welder to applicable code/WPS; fire watch training when required",
        "Competent person for lead or coated metal exposure per assessment",
      ],
    }),
  },
  {
    test: (t) => t.includes("bolt") && !t.includes("anchor"),
    build: (_ctx) => ({
      hazards: [
        "Pinch and crush at connections during fit-up and snug-tight or tensioning",
        "Incomplete connections, skipped bolts, or back-out before stability is verified",
        "Fall exposure while leaning or reaching to connections",
        "Hand-tool torque, reaction forces, and dropped wrenches or sockets",
      ],
      controls: [
        "Verify member stability; complete minimum connection before load release or loading below",
        "Torque/turn-of-nut to spec; no drift pins left as substitutes beyond approved sequence",
        "Body positioning: avoid line of fire; use tethered small tools aloft",
        "Sequential bolt-up: finish primary connections before full release from crane, per plan",
      ],
      ppe: [
        "Gloves, eye protection, hard hat, and 100% fall protection when at edge or on steel",
        "Hearing protection if impact or tensioning tools are loud or sustained",
      ],
      permits: ["None unless hot work, aerial platform, or site-specific work-at-height program applies"],
      competency: [
        "Competent person to verify connection sequence and final tension criteria",
        "Trained craft for torque procedures and power-tool use at height",
      ],
    }),
  },
  {
    test: (t) =>
      (t.includes("beam") && (t.includes("set") || t.includes("plac") || t.includes("instal") || t.includes("erect"))) ||
      (t.includes("girder") && t.includes("set")),
    build: (ctx) => ({
      hazards: [
        "Suspended load, connection line-up, and drift-pin pinching",
        "Member stability, temporary bracing, and incomplete connection state",
        "Workers under the beam or load path during placement",
        "Sequence errors before final bolt release or secondary connection",
      ],
      controls: [
        "Exclusion and landing zone; no one under the load during movement or set",
        "Controlled alignment and drift; maintain tag lines; verify connection type before release from crane",
        "Temporary bracing, guy lines, or shoring as engineered for partial stability",
        "Communication between crane, hook, and connection crew",
      ],
      ppe: [
        "100% fall protection for connectors; hard hat, gloves, high-visibility apparel",
        "Additional eye protection for drift or grinding at connections",
      ],
      permits: ctx.liftPlanLikely
        ? ["Crane / lift plan or pick plan", "Critical lift authorization when thresholds apply"]
        : ["Hoisting permit or lift plan as site program requires"],
      competency: [
        "Qualified rigger; signal person; crane operator for pick",
        "Trained connection crew and competent person for sequence and bracing per engineer direction",
      ],
    }),
  },
  {
    test: (t) =>
      (t.includes("column") && (t.includes("erect") || t.includes("set") || t.includes("plac") || t.includes("instal"))) ||
      (/\bcolumn\b/.test(t) && (t.includes("steel") || t.includes("erection") || t.includes("vertical"))),
    build: (ctx) => ({
      hazards: [
        "Anchor bolt, template, and base-plate fit-up; plumbing and plumb bracing",
        "Temporary guying or bracing and release from crane with incomplete stability",
        "Fall exposure at top of column; below-column access during plumb/anchor work",
        "Grout, shim, and anchor torque sequence errors",
      ],
      controls: [
        "Verify anchor layout and torque; shim and grout to detail before full loading",
        "Plumb, guy, and brace to engineer detail before releasing hook",
        "Restrict access in fall zone; barricade column base and swing area",
        "Documented release from temporary support only when bracing/connections are complete",
      ],
      ppe: [
        "100% fall protection for topside connector work; hard hat, gloves, safety glasses, high-visibility",
      ],
      permits: ctx.liftPlanLikely
        ? ["Lift plan and crane work package as pick weight or radius require"]
        : ["Hoist/crane permit or planning step per site"],
      competency: [
        "Competent person for anchor, template, and guying; qualified rigging; signal person",
        "Trained column crew and crane coordination per Subpart R",
      ],
    }),
  },
  {
    test: (t) =>
      t.includes("crane") ||
      t.includes(" pick") ||
      t.includes("pick ") ||
      (t.includes("hoist") && t.includes("steel")) ||
      (t.includes("aerial") && t.includes("crane")) ||
      (t.includes("swing") && t.includes("load")),
    build: (ctx) => ({
      hazards: [
        "Pick plan, lift plan, and crane configuration vs load, radius, and ground conditions",
        "Critical lift zone, exclusion zone, and workers in swing or under load",
        "Load path, tag lines, and wind or weather that exceed crane/table limits",
        "Landing zone control and communication to prevent premature release or shock load",
      ],
      controls: [
        "Approved lift or pick plan; pre-lift review with rigger, operator, and signal person",
        "Establish and enforce exclusion/controlled access zones; no one under the load",
        "Verify ground, mats, and swing; stop for wind, lightning, or visibility limits per plan",
        "Landing zone: spotters, barricades, and positive communication before unhooking",
      ],
      ppe: [
        "Hard hat, high-visibility apparel, safety glasses, hearing protection in crane swing",
        "Fall protection for crew aloft; no loose gear on hook path",
      ],
      permits: ctx.liftPlanLikely
        ? ["Crane / lift plan", "Pick permit or critical lift", "Governing hoisting or crane work authorization"]
        : ["Motion / crane work authorization; lift plan if weight or site rules trigger"],
      competency: [
        "Certified/licensed operator; qualified rigger; qualified signal person (voice/hand)",
        "Lift director or competent person for critical picks when program requires",
      ],
    }),
  },
  {
    test: (t) => t.includes("rigg") || t.includes("choker") || t.includes("sling") || t.includes("shackle") || t.includes("spreader"),
    build: (ctx) => ({
      hazards: [
        "Damaged, mis-rated, or wrong-configuration rigging; worn hardware",
        "Incorrect hitch, angle, D/d ratio, or shackle orientation",
        "Unknown or shifting center of gravity; unverified load weight and rigging plan",
        "Pre-lift: snagging, uncontrolled load movement before the crane takes tension",
      ],
      controls: [
        "Inspect and remove damaged rigging; match capacity tags and WLL to the lift plan",
        "Verify load weight, pick points, and hitch type; protect edges on slings and hardware",
        "Qualified rigger to attach, verify pin/shackle seating, and control load before hoisting",
        "Replace or repair any questionable component; do not over-leverage capacity at hitch angles",
      ],
      ppe: ["Cut-resistant gloves, hard hat, safety glasses, high-visibility; steel-toe"],
      permits: ctx.liftPlanLikely
        ? ["Rigging plan or lift plan approval", "Crane or hoist work authorization"]
        : ["Rigging approval step per site"],
      competency: [
        "Qualified rigger; qualified person for fall protection and rigging review",
        "Signal person and operator coordination before lift begins",
      ],
    }),
  },
];

export function isPunchListTaskTitle(taskTitle: string): boolean {
  const t = tokenize(taskTitle);
  return (t.includes("punch") && t.includes("list")) || t.includes("punchlist") || t.includes("punch list");
}

export function isTouchUpPaintingTaskTitle(taskTitle: string): boolean {
  const t = tokenize(taskTitle);
  return (
    (t.includes("touch") && t.includes("paint")) ||
    (t.includes("touchup") && t.includes("paint")) ||
    (t.includes("field") && t.includes("paint") && !t.includes("weld")) ||
    (t.includes("touch") && t.includes("coating"))
  );
}

export function isEmbedsTaskTitle(taskTitle: string): boolean {
  const t = tokenize(taskTitle);
  return t.includes("embed") || t.includes("embodied");
}

/**
 * Per-task lift / pick language only when it fits the work (not for touch-up, embeds, or follow-on by default).
 */
export function effectiveLiftPlanLikelyForTask(taskTitle: string, projectLiftPlanLikely: boolean): boolean {
  if (!projectLiftPlanLikely) return false;
  if (isPunchListTaskTitle(taskTitle)) return false;
  if (isTouchUpPaintingTaskTitle(taskTitle)) return false;
  if (isEmbedsTaskTitle(taskTitle)) return false;
  return true;
}

export type FilterSteelMatrixTasksInput = {
  allTasks: string[];
  operations: Array<{ taskTitle: string }>;
  /** Scope / builder task list (e.g. selected tasks) */
  scopeTaskTitles: string[];
  /**
   * When `false`, embeds are excluded from the matrix.
   * When `true`, embeds are included if present in the task list.
   * When `undefined`, embeds are included only if an operation or scope task plausibly supports field embed work.
   */
  embedsInActiveFieldScope?: boolean | null;
};

function scopeOrOpSupportsEmbeds(operations: Array<{ taskTitle: string }>, scopeTaskTitles: string[]): boolean {
  const re = /embed|sleeve|cast.?in|insert plate|concrete interface/i;
  return (
    operations.some((o) => re.test(o.taskTitle)) || scopeTaskTitles.some((s) => re.test(s))
  );
}

/**
 * Excludes follow-on or low-value lines; collects notes for the issued document.
 */
export function filterTasksForSteelHazardMatrix(input: FilterSteelMatrixTasksInput): {
  includedTasks: string[];
  scopeNotes: string[];
} {
  const tasks = normalizeTaskList([...input.allTasks]);
  const seen = new Set<string>();
  const includedTasks: string[] = [];
  const scopeNotes: string[] = [];
  const embedSetting = input.embedsInActiveFieldScope;

  for (const task of tasks) {
    const key = tokenize(task);
    if (seen.has(key)) continue;
    seen.add(key);

    if (isPunchListTaskTitle(task)) {
      scopeNotes.push(
        "Punch-list and similar follow-on work is not given a separate matrix row. It follows the hazard and control package for the specific correction, joint, or item being fixed (including the relevant steel, welding, or fall-protection requirements for that item)."
      );
      continue;
    }

    if (isEmbedsTaskTitle(task)) {
      if (embedSetting === false) {
        scopeNotes.push(
          "Embeds are not in the active field scope for this issued CSEP; an embed line is not shown in the matrix. Add field operations or mark embeds in scope if embed placement is part of the issued work."
        );
        continue;
      }
      if (embedSetting !== true && !scopeOrOpSupportsEmbeds(input.operations, input.scopeTaskTitles)) {
        scopeNotes.push(
          "An embeds task was listed but no active operation in this plan plausibly supports field embed work; the embeds row is omitted until field scope is aligned."
        );
        continue;
      }
    }

    if (/^tbd$|^n\/?a$|^other$|^misc$|^various$/i.test(task.trim())) {
      scopeNotes.push(`Generic task name "${task}" was skipped as a matrix row.`);
      continue;
    }

    includedTasks.push(task);
  }

  if (!includedTasks.length) {
    scopeNotes.push(
      "No task-specific matrix rows remain after scope filtering. Use the JHA, pre-task plan, and Section 11 hazard modules for the work actually being performed."
    );
  }

  return {
    includedTasks: dedupeStable(includedTasks),
    scopeNotes: dedupeStable(scopeNotes),
  };
}

function dedupeStable(values: string[]) {
  const out: string[] = [];
  const s = new Set<string>();
  for (const v of values) {
    if (!v.trim() || s.has(v)) continue;
    s.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Resolves a steel task title to task-specific matrix fields.
 */
export function getSteelErectionTaskMatrixContent(
  taskTitle: string,
  options: { liftPlanLikely: boolean }
): SteelTaskMatrixContent {
  const t = tokenize(taskTitle);
  for (const entry of MATCHES) {
    if (entry.test(t)) {
      return entry.build({ liftPlanLikely: options.liftPlanLikely });
    }
  }
  return DEFAULT_STEEL;
}
