import type { CSEPRiskItem } from "@/lib/csepTradeSelection";
import type {
  CSEPProgramCategory,
  CSEPProgramSection,
  CSEPProgramSelection,
  CSEPProgramSelectionInput,
  CSEPProgramSelectionSource,
  CSEPProgramSubtypeConfig,
  CSEPProgramSubtypeGroup,
  CSEPProgramSubtypeValue,
} from "@/types/csep-programs";

type ProgramDefinition = {
  category: CSEPProgramCategory;
  item: string;
  title: string;
  summary: string;
  oshaRefs: string[];
  applicableWhen: string[];
  responsibilities: string[];
  controls: string[];
  training: string[];
  subtypeGroup?: CSEPProgramSubtypeGroup;
  subtypeVariants?: Partial<
    Record<
      CSEPProgramSubtypeValue,
      Partial<
        Pick<
          ProgramDefinition,
          "title" | "summary" | "oshaRefs" | "applicableWhen" | "responsibilities" | "controls" | "training"
        >
      >
    >
  >;
};

type BuildSelectionsParams = {
  selectedHazards: string[];
  selectedPermits: string[];
  selectedPpe: string[];
  tradeItems?: CSEPRiskItem[];
  selectedTasks?: string[];
  subtypeSelections?: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
};

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

const PROGRAM_DEFINITIONS: ProgramDefinition[] = [
  {
    category: "hazard",
    item: "Falls from height",
    title: "Fall Protection Program",
    summary: "This program establishes the minimum controls required when selected work exposes crews to leading edges, floor openings, roof edges, ladders, scaffolds, or elevated platforms.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Work is performed at height where fall exposure exists.",
      "Ladders, scaffolds, aerial lifts, or elevated platforms are part of the selected scope.",
    ],
    responsibilities: [
      "Supervision shall verify fall protection systems are planned, inspected, and compatible with the work area.",
      "Workers shall stop work when anchor points, access, or edge protection are not adequate for the task.",
    ],
    controls: [
      "Use approved fall protection systems when site rules or OSHA criteria require them.",
      "Inspect harnesses, lanyards, SRLs, anchors, and connectors before each use.",
      "Maintain guardrails, covers, warning lines, and exclusion zones where applicable.",
      "Control dropped-object exposure below elevated work with barricades and housekeeping.",
    ],
    training: [
      "Workers shall be trained on fall protection selection, inspection, use, and rescue notification procedures.",
    ],
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
    summary: "This program establishes fire prevention and hot-work controls for welding, cutting, grinding, brazing, soldering, and spark-producing tasks.",
    oshaRefs: ["OSHA 1926 Subpart J - Fire Protection and Prevention"],
    applicableWhen: [
      "Selected work includes welding, torch work, grinding, cutting, or any spark-producing process.",
    ],
    responsibilities: [
      "Supervision shall verify hot-work authorization, combustibles control, and fire-watch coverage before work starts.",
      "Workers shall stop hot work immediately if unsafe conditions develop.",
    ],
    controls: [
      "Do not begin hot work until required permits are obtained.",
      "Remove or protect combustibles in the work area.",
      "Maintain fire extinguishers and spark containment in the immediate area.",
      "Follow post-work fire-watch duration and closeout expectations.",
    ],
    training: [
      "Workers shall be trained on hot-work permit requirements, fire watch duties, and equipment inspection.",
    ],
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
    title: "Ladder Safety Program",
    summary: "This program establishes controls for safe ladder selection, inspection, setup, and use.",
    oshaRefs: ["OSHA 1926 Subpart X - Stairways and Ladders"],
    applicableWhen: [
      "Selected work uses portable ladders for access or task execution.",
    ],
    responsibilities: [
      "Supervision shall verify the correct ladder type and location before work begins.",
      "Workers shall remove damaged ladders from service immediately.",
    ],
    controls: [
      "Inspect ladders before use.",
      "Set ladders on stable surfaces and use the proper climbing angle where applicable.",
      "Maintain three points of contact during climbing.",
      "Do not overreach or use the top step unless the ladder is designed for it.",
    ],
    training: [
      "Workers shall be trained on ladder inspection, setup, and safe climbing practices.",
    ],
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
      "Stop work and reassess when pressure behavior, equipment condition, or scope changes unexpectedly.",
    ],
    training: [
      "Workers shall be trained on pressure hazards, controlled release methods, and line-break stop-work triggers.",
    ],
  },
  {
    category: "hazard",
    item: "Falling objects",
    title: "Falling Object and Overhead Work Safety Program",
    summary: "This program establishes controls to protect workers from falling tools, materials, debris, and overhead work activities.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work creates overhead exposure to crews below.",
    ],
    responsibilities: [
      "Supervision shall maintain drop-zone controls and protect adjacent workers before overhead work starts.",
      "Workers shall not enter suspended-load or overhead work zones unless authorized and protected.",
    ],
    controls: [
      "Use toe boards, debris nets, tool lanyards, or overhead protection where needed.",
      "Barricade and maintain exclusion zones below overhead work.",
      "Secure materials against displacement at edges and elevated work surfaces.",
      "Review dropped-object exposure during pre-task planning.",
    ],
    training: [
      "Workers shall be trained on overhead hazard recognition and exclusion-zone expectations.",
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
    title: "Ladder Authorization Program",
    summary: "This program establishes the approval and field-use expectations when ladder work is restricted or controlled by site rules.",
    oshaRefs: ["OSHA 1926 Subpart X - Stairways and Ladders"],
    applicableWhen: [
      "Selected work requires ladder-use authorization under project rules.",
    ],
    responsibilities: [
      "Supervision shall confirm ladder use is allowed for the task and location before work begins.",
    ],
    controls: [
      "Verify the ladder type, condition, and setup are appropriate for the task.",
      "Respect project-specific ladder restrictions or prohibited ladder types.",
      "Use alternate access methods when ladder restrictions cannot be met safely.",
    ],
    training: [
      "Workers shall be trained on ladder approval expectations and safe-use requirements.",
    ],
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
      "The competent person shall document inspections and stop work when conditions change.",
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
    summary: "This program establishes controls for gravity-driven exposure such as dropped materials, edge exposure, and protected access below work areas.",
    oshaRefs: ["OSHA 1926 Subpart M - Fall Protection"],
    applicableWhen: [
      "Selected work creates overhead or gravity-driven exposure to people below or adjacent to the work area.",
    ],
    responsibilities: [
      "Supervision shall define drop zones, barricades, and protected access before overhead work begins.",
    ],
    controls: [
      "Maintain drop-zone barricades and overhead protection where needed.",
      "Secure tools, materials, and debris from displacement.",
      "Coordinate adjacent access so workers do not pass below uncontrolled overhead work.",
    ],
    training: [
      "Workers shall be trained on drop-zone discipline and overhead hazard communication.",
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

function findDefinition(category: CSEPProgramCategory, item: string) {
  return PROGRAM_DEFINITIONS.find((definition) => definition.category === category && definition.item === item);
}

function resolveDefinition(selection: CSEPProgramSelection): ProgramDefinition {
  const base = findDefinition(selection.category, selection.item) ?? fallbackDefinition(selection.category, selection.item);
  const subtypeVariant =
    selection.subtype && base.subtypeVariants ? base.subtypeVariants[selection.subtype] : null;

  return {
    ...base,
    ...(subtypeVariant ?? {}),
    oshaRefs: dedupe(subtypeVariant?.oshaRefs ?? base.oshaRefs),
    applicableWhen: dedupe(subtypeVariant?.applicableWhen ?? base.applicableWhen),
    responsibilities: dedupe(subtypeVariant?.responsibilities ?? base.responsibilities),
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

export function buildCsepProgramSection(selection: CSEPProgramSelection): CSEPProgramSection {
  const definition = resolveDefinition(selection);

  return {
    key: `program_${getProgramSelectionKey(selection.category, selection.item, selection.subtype)}`,
    category: selection.category,
    item: selection.item,
    subtype: selection.subtype ?? null,
    title: definition.title,
    summary: definition.summary,
    relatedTasks: dedupe(selection.relatedTasks),
    subsections: [
      {
        title: "When It Applies",
        bullets: definition.applicableWhen,
      },
      {
        title: "Applicable References",
        bullets: definition.oshaRefs,
      },
      {
        title: "Responsibilities and Training",
        bullets: dedupe([...definition.responsibilities, ...definition.training]),
      },
      {
        title: "Minimum Required Controls",
        bullets: definition.controls,
      },
      {
        title: "Related Task Triggers",
        bullets: selection.relatedTasks.length
          ? selection.relatedTasks.map((task) => `${task}`)
          : ["This program was included from the current CSEP selection set."],
      },
    ].filter((section) => section.bullets.length > 0),
  };
}

export function buildCsepProgramSections(selections: CSEPProgramSelection[]) {
  return selections.map(buildCsepProgramSection);
}

export function listProgramTitles(selections: CSEPProgramSelection[]) {
  return buildCsepProgramSections(selections).map((section) => section.title);
}
