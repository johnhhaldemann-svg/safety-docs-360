import {
  cleanFinalText,
  controlledTbd,
  normalizePermitList,
  normalizePpeList,
  normalizeTaskList,
} from "@/lib/csepFinalization";
import {
  effectiveLiftPlanLikelyForTask,
  filterTasksForSteelHazardMatrix,
  getSteelErectionTaskMatrixContent,
} from "@/lib/steelErectionTaskMatrix";
import { CSEP_STOP_WORK_UNIVERSAL_AUTHORITY } from "@/lib/csepStopWorkLanguage";
import type {
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
  SafetyPlanGenerationContext,
  SteelErectionPlan,
} from "@/types/safety-intelligence";

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildDefaultSteelPpeList(ppe: string[]) {
  const merged = normalizePpeList([
    "Hard hat",
    "Safety glasses or approved eye protection",
    "Gloves",
    "High-visibility vest",
    "Steel-toe boots or approved protective footwear",
    "Hearing protection",
    ...ppe,
  ]);
  if (
    !merged.some((item) =>
      /fall\s*protection|harness|lanyard|arrest|tie[-\s]?off/i.test(item)
    )
  ) {
    merged.push(
      "Fall protection (harness, lanyard, and anchorage) when the task or exposure requires it"
    );
  }
  return merged;
}

function hasSteelKeyword(values: Array<string | null | undefined>) {
  const haystack = values.map((value) => normalizeToken(value)).join(" | ");
  return /(steel|structural steel|ironwork|metal deck|decking|connector|rigging)/.test(haystack);
}

function listFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function recordFromUnknown(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildContact(
  name: string | null | undefined,
  role: string,
  phone?: string | null | undefined
) {
  const cleanedName = cleanFinalText(name);
  if (!cleanedName) return null;
  const cleanedPhone = cleanFinalText(phone);
  return {
    name: cleanedName,
    role,
    ...(cleanedPhone ? { phone: cleanedPhone } : {}),
  };
}

function boolFromUnknown(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function hasSteelErectionScope(
  generationContext: SafetyPlanGenerationContext,
  operations: GeneratedSafetyPlanDraft["operations"]
) {
  return (
    hasSteelKeyword([
      ...generationContext.scope.trades,
      ...generationContext.scope.subTrades,
      ...generationContext.scope.tasks,
      ...operations.map((operation) => operation.tradeLabel ?? operation.tradeCode ?? null),
      ...operations.map((operation) => operation.subTradeLabel ?? operation.subTradeCode ?? null),
      ...operations.map((operation) => operation.taskTitle),
    ])
  );
}

/** Intro body for CSEP "Common Overlapping Trades" when structural steel / steel erection is in scope. */
export const STEEL_OVERLAP_TRADES_CSEP_INTRO =
  "Coordinate overlapping work areas, workfront access, permit ownership, protection below, and stop-work handoffs before affected crews begin work. " +
  "The trades and interfaces below may interfere with structural steel erection, decking, hoisting, bolting, welding, and protection below if work is not sequenced and communicated properly. (Site access, badging, and traffic routing are in Security at Site.)";

/**
 * Default trade-interface subsections for steel erection (coordination with adjacent trades in shared areas).
 */
export function buildSteelCommonOverlappingTradesSubsections(): NonNullable<
  GeneratedSafetyPlanSection["subsections"]
> {
  return [
    {
      title: "Concrete / Foundations",
      body: "Concrete and foundation work may interfere with steel erection through anchor rod access, footing locations, slab-placement timing, curing restrictions, crane setup limits, and access around base plates or column lines. Coordination is required so column erection, anchor rod verification, and release of steel do not conflict with concrete placement, finishing, or restricted-access areas.",
      bullets: [],
    },
    {
      title: "Survey / Layout",
      body: "Survey and layout personnel may need access to column lines, embeds, control points, and deck areas during active erection. Coordination is required so layout work is not performed inside lift zones, suspended-load paths, or incomplete steel areas without access control and communication with supervision.",
      bullets: [],
    },
    {
      title: "Crane / Hoisting Operations",
      body: "Crane and hoisting operations may interfere with all adjacent trades through swing radius, load path, pick zones, landing areas, and restricted access below overhead work. Coordination is required so other crews do not enter lift zones, travel beneath loads, or occupy the landing area while steel is being hoisted, landed, connected, or released.",
      bullets: [],
    },
    {
      title: "Electrical / Temporary Power",
      body: "Electrical work may interfere through temporary power runs, energized equipment, lighting installation, conduit routing, and access around active steel or decking areas. Coordination is required so temporary cords, panels, and energized systems do not create trip hazards, contact hazards, or access conflicts with hoisting, welding, or elevated work.",
      bullets: [],
    },
    {
      title: "HVAC / Mechanical",
      body: "HVAC or mechanical work may interfere through shared lift access, overhead installation, material staging, duct or equipment placement, and congestion near support steel or decking. Coordination is required when mechanical crews work below active steel erection, inside access-controlled zones, or near incomplete steel, overhead picks, or hot work areas.",
      bullets: [],
    },
    {
      title: "Plumbing / Process Piping",
      body: "Plumbing or piping work may interfere through pipe staging, rack supports, below-deck work, embeds, penetrations, and access under active erection areas. Coordination is required so piping crews are protected from overhead work, drop zones, and incomplete deck or steel conditions before access is released.",
      bullets: [],
    },
    {
      title: "Fire Protection",
      body: "Fire protection work may interfere with steel erection through overhead piping installation, lift access, shared work platforms, and access below active steel or decking operations. Coordination is required when fire protection crews work below erection activities or in areas affected by hot work, overhead protection, barricades, or restricted access.",
      bullets: [],
    },
    {
      title: "Roofing / Waterproofing",
      body: "Roofing and waterproofing work may interfere with decking completion, leading-edge protection, material staging, weather-sensitive sequencing, and roof-level access restrictions. Coordination is required so roof crews do not enter incomplete deck areas, controlled decking zones, or fall-protection boundaries before release.",
      bullets: [],
    },
    {
      title: "Glazing / Curtainwall / Exterior Envelope",
      body: "Glazing or exterior-envelope work may interfere through shared perimeter access, swing-stage or lift locations, material staging, and work near exposed edges or temporary perimeter protection. Coordination is required so façade crews are not exposed to falling objects, incomplete perimeter protection, or overhead steel/detailing work.",
      bullets: [],
    },
    {
      title: "Equipment Installation / Millwright / Conveyor",
      body: "Equipment installation may interfere through heavy picks, access to set locations, floor loading concerns, shared rigging space, and conflicts with incomplete structural support or decking. Coordination is required so equipment crews do not work in areas where steel stability, release, or hoisting paths are still active.",
      bullets: [],
    },
    {
      title: "General Conditions / Site Management",
      body: "General conditions activities may interfere through fencing, temporary facilities, site logistics, housekeeping, dumpsters, pedestrian routing, sanitation access, and temporary barricades. Coordination is required so site-management activities do not block crane routes, laydown areas, unloading zones, or protected access paths needed for steel operations.",
      bullets: [],
    },
    {
      title: "Painting / Coatings / Fireproofing",
      body: "Painting, coatings, or fireproofing may interfere by creating flammable atmospheres, overspray, cure-time restrictions, visibility issues, and access limitations around steel or deck areas. Coordination is required before welding, cutting, or other hot work begins near coating operations or where members must remain accessible for bolting, detailing, or inspection.",
      bullets: [],
    },
    {
      title: "Site Utilities / Earthwork / Excavation",
      body: "Site utilities, excavation, or earthwork may interfere through underground conditions, haul routes, unstable ground, crane setup limitations, trenching, and access near staging or laydown zones. Coordination is required so crane bearing surfaces, delivery routes, and material-storage areas remain stable and protected from excavation-related changes.",
      bullets: [],
    },
    {
      title: "Scaffold / Access Equipment / AWP-MEWP Operations",
      body: "Scaffold, ladder, or AWP/MEWP activity may interfere through shared access routes, congestion, swing clearance, overlapping elevated work, and competing use of protected work zones. Coordination is required so access equipment is not positioned in crane swing radius, suspended-load paths, or drop zones and does not block emergency or material access.",
      bullets: [],
    },
    {
      title: "Inspection / Testing / QA-QC",
      body: "Inspection and QA/QC personnel may require access to connections, welds, bolts, decking, and release points during active work phases. Coordination is required so inspections do not occur inside uncontrolled lift zones, exposed leading-edge areas, or incomplete steel without proper access control and communication with supervision.",
      bullets: [],
    },
    {
      title: "Overlap Response Requirement",
      body: "When overlapping work creates conflicting access, overhead exposure, permit overlap, incompatible sequencing, or unsafe shared-area conditions, affected crews shall stop, coordinate with supervision, and re-establish the work sequence and protection measures before proceeding.",
      bullets: [],
    },
  ];
}

/**
 * Drops short overlapping-trade labels that duplicate the steel interface
 * subsections (e.g. "Fire Protection", "HVAC / Mechanical") and other boilerplate
 * list lines so §5.4 stays intro + narrative subsections without a redundant
 * numbered trade list. Project-specific bullets (e.g. façade coordination) are kept.
 */
export function filterSteelCommonOverlappingBullets(bullets: readonly string[]): string[] {
  const steelSubs = buildSteelCommonOverlappingTradesSubsections();
  const subsectionNorms = steelSubs.map((sub) => normalizeToken(sub.title));

  const redundantStandaloneNorms = new Set([
    "welding hot work",
    "welding",
    "hot work",
  ]);

  const kept: string[] = [];
  const seenNorm = new Set<string>();

  for (const raw of bullets) {
    const bullet = typeof raw === "string" ? raw.trim() : "";
    if (!bullet) continue;
    const n = normalizeToken(bullet);
    if (!n || seenNorm.has(n)) continue;

    if (redundantStandaloneNorms.has(n)) continue;

    const coveredBySteelSubsection = subsectionNorms.some((titleNorm) => {
      if (!titleNorm) return false;
      if (n === titleNorm) return true;
      if (titleNorm.startsWith(`${n} `)) return true;
      if (n.startsWith(`${titleNorm} `)) return true;
      return false;
    });
    if (coveredBySteelSubsection) continue;

    seenNorm.add(n);
    kept.push(bullet);
  }

  return kept;
}

/** True when a trade-package row is steel / structural / decking / rigging–related for permit roll-up. */
export function isSteelErectionPackage(pkg: {
  tradeLabel: string;
  subTradeLabel: string | null;
  taskTitles: string[];
}): boolean {
  return hasSteelKeyword([pkg.tradeLabel, pkg.subTradeLabel, ...pkg.taskTitles]);
}

function buildSteelErectionFallRescueSubsections(
  fr: NonNullable<SteelErectionPlan["fallRescue"]>
): NonNullable<GeneratedSafetyPlanSection["subsections"]> {
  const notify =
    fr.notifyRoles?.length && fr.notifyRoles.length > 0
      ? fr.notifyRoles.join(", ")
      : "superintendent, foreman, competent person, and site safety leadership";

  const call911 =
    fr.emergencyCallText?.trim() ||
    "Call 911 immediately. Identify the project as an active steel erection site, give the project address, access gate, level, and rescue or victim location, and describe a fall, suspension, or serious injury at height.";

  const immediateBody = [
    "This subsection applies to emergency response after a fall at height, a fall arrest (including worker suspension), or a serious injury during steel erection or decking. The immediate priority is 911, scene control, and proper notification—not improvised rescue by untrained workers.",
    "Take these steps in order:",
    `1) ${CSEP_STOP_WORK_UNIVERSAL_AUTHORITY} Stop work in the affected area and secure the scene: control who enters, prevent additional fall or struck-by exposure, and stop overhead picks, swing, or other activity that could worsen the situation until the scene is under control.`,
    `2) ${call911}`,
    `3) After 911, notify or radio site leadership without delay: ${notify}. Do not wait to finish paperwork before making these notifications.`,
    "4) On-site extrication, lowering, or winch rescue may begin only for personnel who are trained, equipped, and authorized under this plan. If the event exceeds on-site capability, keep the area secure and hand off technical rescue to arriving fire/EMS.",
    fr.siteAccessInstructions?.trim()
      ? `Fire and EMS access: ${fr.siteAccessInstructions.trim()}`
      : null,
  ]
    .filter((p): p is string => Boolean(p?.trim()))
    .join("\n\n");

  const immediateBullets = normalizeTaskList([
    fr.targetRescueTime,
    fr.dailyReviewRequired
      ? "At the start of each shift, review who leads rescue communication, where equipment is staged, and how responders reach the level or area."
      : null,
  ]);

  const methodBullets = normalizeTaskList([
    fr.primaryRescueMethod
      ? `Primary rescue method: ${fr.primaryRescueMethod}`
      : null,
    fr.secondaryRescueMethod
      ? `Backup or alternate: ${fr.secondaryRescueMethod}`
      : null,
    "Assisted rescue or pick-off from the work level or an adjacent protected level, when the plan and training support it.",
    "Ladder-assisted access from a protected level, only when the method is pre-approved, competent-person directed, and does not create new fall exposure.",
    "Fire department or outside technical rescue and EMS when the situation exceeds on-site means or requires rope rescue, litter operations, or advanced medical support.",
  ]);

  const equipmentBullets = normalizeTaskList([
    ...(fr.rescueEquipment ?? []),
    fr.ladderStaged
      ? "Rescue or extension ladder staged and ready to deploy from a protected position, per the site plan."
      : null,
    fr.suspensionTraumaRelief
      ? "Suspension-trauma relief (trauma straps or equivalent) and monitoring for effects after any fall arrest in harness."
      : null,
    "Radios or equivalent communication for the rescue team and the crane/spotter, if any.",
  ]);

  const ppeBullets = normalizePpeList(fr.rescuePpe ?? []);

  return [
    {
      title: "5.1 Emergency Notifications and Immediate Response",
      body: immediateBody,
      bullets: immediateBullets.length > 0 ? immediateBullets : [],
    },
    {
      title: "5.2 Rescue Methods",
      body: "Use only methods the crew is trained and authorized to perform. Match the method to the victim’s location, anchor and rigging options, and conditions.",
      bullets: methodBullets,
    },
    {
      title: "5.3 Rescue Equipment",
      body: "Keep the following available, inspected, and serviceable for fall-related rescue. Remove damaged or expired equipment from service.",
      bullets: equipmentBullets,
    },
    {
      title: "5.4 Required Personal Protective Equipment",
      body: "Authorized rescuers use the following, plus any task-specific fall protection system required to perform the authorized rescue (for example, an approved rescuer line or attachment).",
      bullets: ppeBullets,
    },
  ];
}

export function buildSteelErectionPlan(params: {
  generationContext: SafetyPlanGenerationContext;
  operations: GeneratedSafetyPlanDraft["operations"];
  ruleSummary: GeneratedSafetyPlanDraft["ruleSummary"];
}): SteelErectionPlan | null {
  if (!hasSteelErectionScope(params.generationContext, params.operations)) {
    return null;
  }

  const legacy = recordFromUnknown(params.generationContext.legacyFormSnapshot) ?? {};
  const metadata = recordFromUnknown(params.generationContext.siteContext.metadata) ?? {};
  const steel = recordFromUnknown(metadata.steelErectionPlan) ?? recordFromUnknown(legacy.steel_erection_plan) ?? {};

  const onSiteTeam = [
    buildContact(params.generationContext.project.contractorContact, "Superintendent", params.generationContext.project.contractorPhone),
    buildContact(cleanFinalText(String(legacy.foreman_name ?? "")), "Foreman", cleanFinalText(String(legacy.foreman_phone ?? ""))),
    buildContact(cleanFinalText(String(legacy.competent_person_name ?? "")), "Competent Person", cleanFinalText(String(legacy.competent_person_phone ?? ""))),
  ].filter((item): item is NonNullable<SteelErectionPlan["onSiteTeam"]>[number] => Boolean(item));

  const offSiteTeam = [
    buildContact(cleanFinalText(String(legacy.safety_director_name ?? "")), "Safety Director", cleanFinalText(String(legacy.safety_director_phone ?? ""))),
    buildContact(cleanFinalText(String(legacy.project_manager_name ?? "")), "Project Manager", cleanFinalText(String(legacy.project_manager_phone ?? ""))),
  ].filter((item): item is NonNullable<SteelErectionPlan["offSiteTeam"]>[number] => Boolean(item));

  const tasks = normalizeTaskList([
    ...params.generationContext.scope.tasks,
    ...params.operations.map((operation) => operation.taskTitle),
  ]);
  const embedsScopeFlag =
    boolFromUnknown(steel.embeds_in_active_field_scope) ?? boolFromUnknown(steel.embedsInActiveFieldScope);
  const { includedTasks: matrixTasks, scopeNotes: hazardMatrixScopeNotes } = filterTasksForSteelHazardMatrix({
    allTasks: tasks,
    operations: params.operations,
    scopeTaskTitles: params.generationContext.scope.tasks,
    embedsInActiveFieldScope: embedsScopeFlag,
  });
  const ppe = normalizePpeList([
    ...params.ruleSummary.ppeRequirements,
    ...params.operations.flatMap((operation) => operation.ppeRequirements),
  ]);
  const permits = normalizePermitList([
    ...params.ruleSummary.permitTriggers,
    ...params.operations.flatMap((operation) => operation.permitTriggers),
  ]);

  const triggersLiftControls = permits.some((item) =>
    /^(lift plan|pick plan|crane permit)$/i.test(item)
  );

  const plan: SteelErectionPlan = {
    onSiteTeam: onSiteTeam.length ? onSiteTeam : undefined,
    offSiteTeam: offSiteTeam.length ? offSiteTeam : undefined,
    fallProtection: {
      tieOffPolicy:
        cleanFinalText(String(steel.tieOffPolicy ?? "")) ??
        "Maintain 100% tie-off whenever employees are exposed to unprotected edges, connectors, decking access areas, or other steel-erection fall hazards.",
      leadingEdgeRule:
        cleanFinalText(String(steel.leadingEdgeRule ?? "")) ??
        "Leading-edge work must stay under a reviewed fall-protection plan with designated anchorage, access sequencing, and controlled access boundaries.",
      srlType:
        cleanFinalText(String(steel.srlType ?? "")) ??
        "Use steel-erection-rated self-retracting lifelines compatible with the anchorage and connector work configuration.",
      hllRequired: boolFromUnknown(steel.hllRequired) ?? true,
      hllNotes:
        cleanFinalText(String(steel.hllNotes ?? "")) ??
        "Horizontal lifelines are required where fixed anchorage points are not continuously available for the planned sequence.",
      cdzUsed: boolFromUnknown(steel.cdzUsed) ?? tasks.some((task) => /deck/i.test(task)),
      perimeterCable: boolFromUnknown(steel.perimeterCable) ?? true,
      perimeterCableHeights: {
        topRail: cleanFinalText(String(recordFromUnknown(steel.perimeterCableHeights)?.topRail ?? "")) ?? "42 inches nominal",
        midRail: cleanFinalText(String(recordFromUnknown(steel.perimeterCableHeights)?.midRail ?? "")) ?? "Mid-rail installed between deck and top cable",
      },
      flaggingInterval: cleanFinalText(String(steel.flaggingInterval ?? "")) ?? "Mark perimeter cable and temporary edge lines at regular visible intervals.",
      deckingRules: listFromUnknown(steel.deckingRules).length
        ? normalizeTaskList(listFromUnknown(steel.deckingRules))
        : [
            "Do not release decking bundles until supporting steel is stabilized and the landing area is controlled.",
            "Maintain controlled decking access limits, connector communication, and sequential fastening as decking advances.",
          ],
      detailingRules: listFromUnknown(steel.detailingRules).length
        ? normalizeTaskList(listFromUnknown(steel.detailingRules))
        : [
            "Detailing changes that affect member stability, connection sequence, or access must be reviewed before field execution.",
          ],
    },
    fallRescue: {
      emergencyCallText:
        cleanFinalText(String(steel.emergencyCallText ?? "")) ??
        "Call 911, identify the project as an active steel-erection site, give the project address, access gate, level, and rescue location.",
      siteAccessInstructions:
        cleanFinalText(String(steel.siteAccessInstructions ?? "")) ??
        `Emergency access route: ${cleanFinalText(params.generationContext.project.projectAddress) ?? "Coordinate responders through the designated project gate and active work area"}.`,
      notifyRoles: ["Superintendent", "Foreman", "Competent Person", "Safety Director"],
      primaryRescueMethod:
        cleanFinalText(String(steel.primaryRescueMethod ?? "")) ??
        "Use the pre-staged assisted rescue system or controlled ladder access from the nearest protected level.",
      secondaryRescueMethod:
        cleanFinalText(String(steel.secondaryRescueMethod ?? "")) ??
        "Coordinate fire department support while maintaining site rescue equipment and trauma-relief support.",
      rescueEquipment: listFromUnknown(steel.rescueEquipment).length
        ? normalizeTaskList(listFromUnknown(steel.rescueEquipment))
        : ["Rescue kit", "Extension ladder", "Trauma-relief straps", "Radio communication"],
      rescuePpe: listFromUnknown(steel.rescuePpe).length
        ? normalizePpeList(listFromUnknown(steel.rescuePpe))
        : [
            "Hard hat",
            "High-visibility vest",
            "Gloves suitable for rescue handling",
            "Eye protection",
            "Work boots",
            "Fall protection for rescuers only when trained, authorized, and tied to the approved rescue plan",
          ],
      ladderStaged: boolFromUnknown(steel.ladderStaged) ?? true,
      targetRescueTime: cleanFinalText(String(steel.targetRescueTime ?? "")) ?? "Prompt rescue without delay after a fall arrest event.",
      suspensionTraumaRelief: boolFromUnknown(steel.suspensionTraumaRelief) ?? true,
      dailyReviewRequired: boolFromUnknown(steel.dailyReviewRequired) ?? true,
    },
    openingsAndPerimeters: {
      coverRequiredAtOrAbove:
        cleanFinalText(String(steel.coverRequiredAtOrAbove ?? "")) ??
        "Protect floor openings and penetrations as soon as the opening is created or exposed during decking operations.",
      coverMarking:
        cleanFinalText(String(steel.coverMarking ?? "")) ?? "Mark covers to show the hazard and that the cover must remain in place.",
      coverLoadRequirement:
        cleanFinalText(String(steel.coverLoadRequirement ?? "")) ??
        "Hole covers must support intended loads and incidental construction traffic.",
      coverSecurement:
        cleanFinalText(String(steel.coverSecurement ?? "")) ??
        "Secure covers against displacement before releasing the area for work or access.",
      perimeterProtection:
        cleanFinalText(String(steel.perimeterProtection ?? "")) ??
        "Install temporary guardrails or perimeter cable where the sequence creates exposed deck edges or access routes.",
    },
    hazardMatrix: matrixTasks.length
      ? matrixTasks.map((task) => {
          const spec = getSteelErectionTaskMatrixContent(task, {
            liftPlanLikely: effectiveLiftPlanLikelyForTask(task, triggersLiftControls),
          });
          return {
            activity: task,
            hazards: spec.hazards,
            controls: spec.controls,
            ppe: spec.ppe,
            permits: spec.permits,
            competency: spec.competency,
          };
        })
      : undefined,
    hazardMatrixScopeNotes: hazardMatrixScopeNotes.length ? hazardMatrixScopeNotes : undefined,
    trainingAndCompetency: {
      orientationRequired: true,
      orientationSchedule:
        cleanFinalText(String(steel.orientationSchedule ?? "")) ??
        "Complete project orientation before mobilization and review steel-specific controls at the start of each shift.",
      requiredTraining: normalizeTaskList([
        ...listFromUnknown(steel.requiredTraining),
        "Orientation",
        "OSHA 10/30 as role appropriate",
        "Subpart R steel erection requirements",
        ...(triggersLiftControls ? ["Qualified rigger / signal person"] : []),
        ...(tasks.some((task) => /lift|boom|aerial/i.test(task)) ? ["Aerial lift training"] : []),
        ...(tasks.some((task) => /weld/i.test(task)) ? ["Welding qualifications"] : []),
      ]),
      retrainingRules: listFromUnknown(steel.retrainingRules).length
        ? normalizeTaskList(listFromUnknown(steel.retrainingRules))
        : [
            "Retrain when tasks change, rescue methods change, or field observations show controls are not understood.",
          ],
      attachmentRefs: normalizeTaskList([
        ...listFromUnknown(steel.attachmentRefs),
        "Training records",
        ...(tasks.some((task) => /weld/i.test(task)) ? ["Welder certifications"] : []),
      ]),
      competentPersons: onSiteTeam
        .filter((item) => /competent|superintendent|foreman/i.test(item.role))
        .map((item) => ({
          name: item.name,
          title: item.role,
          ...(item.phone ? { phone: item.phone } : {}),
          quals: ["Steel erection oversight"],
        })),
    },
    fallingObjectControl: {
      barricadeType:
        cleanFinalText(String(steel.barricadeType ?? "")) ??
        "Use hard barricades and clearly marked drop zones below active steel placement, connecting, welding, or decking work.",
      signageSpacing:
        cleanFinalText(String(steel.signageSpacing ?? "")) ??
        "Post visible warning signage at access points and along barricaded approach routes.",
      accessRestriction:
        cleanFinalText(String(steel.accessRestriction ?? "")) ??
        "Restrict access below overhead work to assigned personnel supporting the active operation.",
    },
    workAttireAndTesting: {
      attireRules: [
        "Wear shirts with sleeves. Tank tops, sleeveless shirts, and similar upper-body apparel are not acceptable in the work area unless the project issues a site-specific, task-limited exception.",
        "Wear durable work pants suitable for construction activity; shorts are not used unless a written site rule explicitly allows them for defined conditions.",
        "Do not wear loose, torn, or unsafe clothing that can catch on steel, tools, rigging, or equipment; clothing and accessories must not create caught-in, snag, or entanglement hazards.",
      ],
      ppeList: buildDefaultSteelPpeList(ppe),
      drugTestingRules: normalizeTaskList([
        ...listFromUnknown(steel.drugTestingRules),
        "Comply with project drug and alcohol testing rules before mobilization and after any incident or client-directed screening trigger.",
      ]),
    },
    erectionExecution: {
      siteAccessPlan:
        cleanFinalText(String(steel.siteAccessPlan ?? "")) ??
        "Maintain controlled site access, spotter-supported truck routing, and protected pedestrian paths during steel deliveries and crane activity.",
      laydownPlan:
        cleanFinalText(String(steel.laydownPlan ?? "")) ??
        "Stage steel, decking, and connection material in designated laydown areas that support the erection sequence and crane reach plan.",
      erectionSequence:
        cleanFinalText(String(steel.erectionSequence ?? "")) ??
        "Follow the reviewed erection sequence so members are set, connected, stabilized, and released in the planned order.",
      cranePlan: Array.isArray(steel.cranePlan) && steel.cranePlan.length
        ? steel.cranePlan
            .map((item) => recordFromUnknown(item))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((item) => ({
              area: cleanFinalText(String(item.area ?? "")) ?? undefined,
              crane: cleanFinalText(String(item.crane ?? "")) ?? undefined,
              boom: cleanFinalText(String(item.boom ?? "")) ?? undefined,
              radius: cleanFinalText(String(item.radius ?? "")) ?? undefined,
              heaviestPick: cleanFinalText(String(item.heaviestPick ?? "")) ?? undefined,
            }))
        : [
            {
              area: cleanFinalText(params.generationContext.scope.location) ?? "Primary steel work area",
              crane: "Project crane per approved lift plan",
              radius: "Per lift plan",
              heaviestPick: "Confirm before issue",
            },
          ],
      hoistingInspectionRule:
        cleanFinalText(String(steel.hoistingInspectionRule ?? "")) ??
        "Inspect rigging, hooks, slings, and hoisting accessories before use and remove damaged gear from service.",
      undergroundUtilityReview:
        cleanFinalText(String(steel.undergroundUtilityReview ?? "")) ??
        "Review crane setup, outrigger loads, and delivery routes for underground utilities or slab load restrictions before mobilization.",
      overheadLiftPlanning: listFromUnknown(steel.overheadLiftPlanning).length
        ? normalizeTaskList(listFromUnknown(steel.overheadLiftPlanning))
        : [
            "Review pick path, blind areas, swing radius, and exclusion zones before each lift.",
            "Coordinate radio or hand-signal communication between the operator, rigger, and signal person.",
          ],
      alignmentAndStability: listFromUnknown(steel.alignmentAndStability).length
        ? normalizeTaskList(listFromUnknown(steel.alignmentAndStability))
        : [
            "Verify temporary stability before releasing members from the crane.",
            "Do not remove support until the connection and stability criteria are met.",
          ],
      columnBeamReleaseCriteria: listFromUnknown(steel.columnBeamReleaseCriteria).length
        ? normalizeTaskList(listFromUnknown(steel.columnBeamReleaseCriteria))
        : [
            "Do not release columns or beams until required bolts, connection checks, and temporary stability measures are in place.",
          ],
      fastenerRequirements: listFromUnknown(steel.fastenerRequirements).length
        ? normalizeTaskList(listFromUnknown(steel.fastenerRequirements))
        : [
            "Install and verify required bolts, deck attachments, and connection hardware in accordance with the reviewed sequence and inspection plan.",
          ],
      falseworkRequired:
        cleanFinalText(String(steel.falseworkRequired ?? "")) ??
        "Provide jacking, shoring, or falsework whenever the engineered sequence requires temporary support.",
      inspectionTestingPlan: normalizeTaskList([
        ...listFromUnknown(steel.inspectionTestingPlan),
        "Connection inspection and release checks",
        ...(tasks.some((task) => /weld/i.test(task)) ? ["Weld inspection and weld procedure verification"] : []),
      ]),
      attachmentRefs: normalizeTaskList([
        ...listFromUnknown(steel.attachmentRefs),
        "Site logistics map",
        "Crane charts",
        "Steel sequence plan",
        "Inspection plan",
      ]),
    },
  };

  return plan;
}

function hasRows(rows: Array<Array<string | undefined>>) {
  return rows.some((row) => row.some((cell) => Boolean(cell?.trim())));
}

export function buildSteelErectionOverlaySections(plan: SteelErectionPlan): GeneratedSafetyPlanSection[] {
  const sections: GeneratedSafetyPlanSection[] = [];

  const rosterRows = [
    ...(plan.onSiteTeam ?? []).map((item) => [item.name, item.role, item.phone ?? controlledTbd()]),
    ...(plan.offSiteTeam ?? []).map((item) => [item.name, item.role, item.phone ?? controlledTbd()]),
  ];
  if (rosterRows.length) {
    sections.push({
      key: "roles_and_responsibilities",
      title: "Project Team Roster",
      body: "Confirm on-site and off-site contacts before steel erection, decking, lifting, welding, or rescue operations begin.",
      table: {
        columns: ["Name", "Role", "Phone"],
        rows: rosterRows,
      },
    });
  }

  if (plan.fallProtection) {
    sections.push({
      key: "steel_fall_protection",
      title: "Steel Erection Fall Protection Controls",
      body: plan.fallProtection.tieOffPolicy,
      subsections: [
        {
          title: "Leading Edge and Access Rules",
          body: plan.fallProtection.leadingEdgeRule,
          bullets: normalizeTaskList([
            plan.fallProtection.srlType ? `SRL type/class: ${plan.fallProtection.srlType}` : null,
            plan.fallProtection.hllRequired ? `HLL rules: ${plan.fallProtection.hllNotes ?? controlledTbd()}` : null,
            plan.fallProtection.cdzUsed ? "Controlled decking zone use is allowed only under the reviewed decking sequence and access controls." : null,
            plan.fallProtection.perimeterCable ? `Perimeter cable/guardrail: top rail ${plan.fallProtection.perimeterCableHeights?.topRail ?? controlledTbd()}, mid rail ${plan.fallProtection.perimeterCableHeights?.midRail ?? controlledTbd()}.` : null,
            plan.fallProtection.flaggingInterval,
          ]),
        },
        {
          title: "Decking and Detailing Controls",
          bullets: normalizeTaskList([
            ...(plan.fallProtection.deckingRules ?? []),
            ...(plan.fallProtection.detailingRules ?? []),
          ]),
        },
      ],
    });
  }

  if (plan.fallRescue) {
    sections.push({
      key: "emergency_procedures",
      title: "Steel Erection Fall Rescue",
      body: "This plan covers fall-at-height and fall-arrest emergency response (including post-arrest rescue) and serious injury on steel erection and decking. Call 911, secure the scene, and notify site leadership in the order in subsection 5.1. Trained, authorized rescuers use subsections 5.2 through 5.4 for methods, equipment, and PPE; untrained workers do not perform improvised technical rescue.",
      subsections: buildSteelErectionFallRescueSubsections(plan.fallRescue),
    });
  }

  if (plan.openingsAndPerimeters) {
    sections.push({
      key: "steel_openings_and_perimeters",
      title: "Openings and Perimeter Protection",
      table: {
        columns: ["Control", "Requirement"],
        rows: [
          ["Hole-cover trigger", plan.openingsAndPerimeters.coverRequiredAtOrAbove ?? controlledTbd()],
          ["Cover marking", plan.openingsAndPerimeters.coverMarking ?? controlledTbd()],
          ["Cover securement", plan.openingsAndPerimeters.coverSecurement ?? controlledTbd()],
          ["Cover load rating", plan.openingsAndPerimeters.coverLoadRequirement ?? controlledTbd()],
          ["Temporary guardrail / perimeter cable", plan.openingsAndPerimeters.perimeterProtection ?? controlledTbd()],
        ],
      },
    });
  }

  if (plan.hazardMatrix?.length || plan.hazardMatrixScopeNotes?.length) {
    const appendixRef =
      "See Appendix E – Task-Hazard-Control Matrix for the task-specific hazard, control, PPE, permit, and competency breakdown.";
    const noteBlock = plan.hazardMatrixScopeNotes?.length
      ? `${appendixRef}\n\n${plan.hazardMatrixScopeNotes.join("\n\n")}`
      : appendixRef;
    sections.push({
      key: "steel_hazard_control_matrix",
      title: "Steel Erection Hazard-Control Matrix",
      body: noteBlock,
    });
  }

  if (plan.trainingAndCompetency) {
    const competentRows = (plan.trainingAndCompetency.competentPersons ?? []).map((item) => [
      item.name,
      item.title,
      item.phone ?? controlledTbd(),
      (item.quals ?? []).join(", ") || controlledTbd(),
    ]);

    sections.push({
      key: "steel_training_and_competency",
      title: "Training and Competency",
      body: plan.trainingAndCompetency.orientationSchedule,
      subsections: [
        {
          title: "Required Training and Certifications",
          bullets: normalizeTaskList([
            ...(plan.trainingAndCompetency.requiredTraining ?? []),
            ...(plan.trainingAndCompetency.retrainingRules ?? []),
          ]),
        },
        {
          title: "Training Records and Attachments",
          bullets: normalizeTaskList(plan.trainingAndCompetency.attachmentRefs ?? []),
        },
      ],
      table:
        competentRows.length
          ? {
              columns: ["Competent Person", "Title", "Phone", "Qualifications"],
              rows: competentRows,
            }
          : null,
    });
  }

  if (plan.fallingObjectControl) {
    sections.push({
      key: "steel_drop_zone_control",
      title: "Falling-Object and Drop-Zone Controls",
      bullets: normalizeTaskList([
        plan.fallingObjectControl.barricadeType,
        plan.fallingObjectControl.signageSpacing,
        plan.fallingObjectControl.accessRestriction,
      ]),
    });
  }

  if (plan.workAttireAndTesting) {
    sections.push({
      key: "drug_and_alcohol_testing",
      title: "Site Administration and Support Controls",
      subsections: [
        {
          title: "6.1 Work Attire Requirements",
          bullets: normalizeTaskList(plan.workAttireAndTesting.attireRules ?? []),
        },
        {
          title: "6.2 Personal Protective Equipment (PPE)",
          body:
            "The following is the reference list for the steel program. The contractor enforces the list; task- or site-specific PPE (e.g., hot work, rescue, or electrical) is added by JHA, lift plan, permit, or client rules.",
          bullets: normalizeTaskList(plan.workAttireAndTesting.ppeList ?? []),
        },
        {
          title: "6.3 Project Drug and Alcohol Testing Rules",
          bullets: normalizeTaskList(plan.workAttireAndTesting.drugTestingRules ?? []),
        },
      ],
    });
  }

  if (plan.erectionExecution) {
    const craneRows = (plan.erectionExecution.cranePlan ?? []).map((item) => [
      item.area ?? controlledTbd(),
      item.crane ?? controlledTbd(),
      item.boom ?? controlledTbd(),
      item.radius ?? controlledTbd(),
      item.heaviestPick ?? controlledTbd(),
    ]);

    sections.push({
      key: "steel_erection_execution",
      title: "Steel Erection Execution",
      body: plan.erectionExecution.erectionSequence,
      subsections: [
        {
          title: "Site Access, Laydown, and Traffic Control",
          bullets: normalizeTaskList([
            plan.erectionExecution.siteAccessPlan,
            plan.erectionExecution.laydownPlan,
            plan.erectionExecution.undergroundUtilityReview,
          ]),
        },
        {
          title: "Hoisting, Stability, and Connection Release",
          bullets: normalizeTaskList([
            plan.erectionExecution.hoistingInspectionRule,
            ...(plan.erectionExecution.overheadLiftPlanning ?? []),
            ...(plan.erectionExecution.alignmentAndStability ?? []),
            ...(plan.erectionExecution.columnBeamReleaseCriteria ?? []),
            ...(plan.erectionExecution.fastenerRequirements ?? []),
            plan.erectionExecution.falseworkRequired,
          ]),
        },
        {
          title: "Inspection and Supporting Attachments",
          bullets: normalizeTaskList([
            ...(plan.erectionExecution.inspectionTestingPlan ?? []),
            ...(plan.erectionExecution.attachmentRefs ?? []),
          ]),
        },
      ],
      table:
        craneRows.length && hasRows(craneRows)
          ? {
              columns: ["Area", "Crane", "Boom", "Radius", "Heaviest Pick"],
              rows: craneRows,
            }
          : null,
    });
  }

  return sections;
}
