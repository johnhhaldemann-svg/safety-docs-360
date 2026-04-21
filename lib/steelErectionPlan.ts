import {
  cleanFinalText,
  controlledTbd,
  normalizeHazardList,
  normalizePermitList,
  normalizePpeList,
  normalizeTaskList,
} from "@/lib/csepFinalization";
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
  const hazards = normalizeHazardList([
    ...params.ruleSummary.hazardCategories,
    ...params.operations.flatMap((operation) => operation.hazardCategories),
  ]);
  const ppe = normalizePpeList([
    ...params.ruleSummary.ppeRequirements,
    ...params.operations.flatMap((operation) => operation.ppeRequirements),
  ]);
  const permits = normalizePermitList([
    ...params.ruleSummary.permitTriggers,
    ...params.operations.flatMap((operation) => operation.permitTriggers),
  ]);

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
        `Emergency access route: ${cleanFinalText(params.generationContext.project.projectAddress) ?? controlledTbd()}.`,
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
    hazardMatrix: tasks.map((task) => ({
      activity: task,
      hazards: hazards.length ? hazards : ["Steel-erection exposure"],
      controls: [
        "Pre-task plan reviewed with erection sequence and access route.",
        ...normalizeTaskList(params.ruleSummary.requiredControls),
      ],
      ppe,
      permits,
      competency: [
        "Competent person oversight",
        ...(permits.some((item) => item === "Lift Plan") ? ["Qualified rigger / signal person"] : []),
      ],
    })),
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
        ...(permits.some((item) => item === "Lift Plan") ? ["Qualified rigger / signal person"] : []),
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
        "Wear hard hat, safety glasses, gloves, steel-toe boots, and high-visibility apparel suitable for steel handling and erection access.",
        ...(ppe.includes("Fall Protection Harness")
          ? ["Inspect and wear the assigned fall-protection system whenever exposed to a fall hazard."] : []),
      ],
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
      body: plan.fallRescue.emergencyCallText,
      subsections: [
        {
          title: "Site Access and Notifications",
          body: plan.fallRescue.siteAccessInstructions,
          bullets: normalizeTaskList([
            ...(plan.fallRescue.notifyRoles ?? []).map((item) => `Notify ${item}.`),
            plan.fallRescue.targetRescueTime,
            plan.fallRescue.dailyReviewRequired ? "Review rescue responsibilities and access at the start of each shift." : null,
          ]),
        },
        {
          title: "Rescue Methods and Equipment",
          bullets: normalizeTaskList([
            plan.fallRescue.primaryRescueMethod ? `Primary rescue method: ${plan.fallRescue.primaryRescueMethod}` : null,
            plan.fallRescue.secondaryRescueMethod ? `Backup rescue method: ${plan.fallRescue.secondaryRescueMethod}` : null,
            ...(plan.fallRescue.rescueEquipment ?? []),
            plan.fallRescue.ladderStaged ? "Stage rescue ladder access where it can be deployed without delay." : null,
            plan.fallRescue.suspensionTraumaRelief ? "Provide suspension-trauma relief support after any fall arrest." : null,
          ]),
        },
      ],
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

  if (plan.hazardMatrix?.length) {
    sections.push({
      key: "steel_hazard_control_matrix",
      title: "Steel Erection Hazard-Control Matrix",
      table: {
        columns: ["Activity", "Hazards", "Controls", "PPE", "Permits", "Competency"],
        rows: plan.hazardMatrix.map((item) => [
          item.activity,
          item.hazards.join(", "),
          item.controls.join(", "),
          (item.ppe ?? []).join(", "),
          (item.permits ?? []).join(", "),
          (item.competency ?? []).join(", "),
        ]),
      },
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
      title: "Work Attire and Drug Testing",
      subsections: [
        {
          title: "Required Work Attire",
          bullets: normalizeTaskList(plan.workAttireAndTesting.attireRules ?? []),
        },
        {
          title: "Project Drug and Alcohol Testing Rules",
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
