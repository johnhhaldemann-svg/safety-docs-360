export type HighRiskPermitCode =
  | "HWP-001"
  | "CSE-002"
  | "EXC-003"
  | "GDU-004"
  | "WAH-005"
  | "GRV-006"
  | "LFT-007"
  | "ELE-008"
  | "LOTO-009"
  | "MEWP-010"
  | "SIL-011"
  | "CHEM-012"
  | "TMP-013"
  | "DEM-014";

export type HighRiskPermitDefinition = {
  code: HighRiskPermitCode;
  name: string;
  tradeTriggers: string[];
  trigger: string;
  requiredReviewer: string;
  stopWorkRule: string;
  referenceBasis: string;
  checklistItems: string[];
  aliases: string[];
  patterns: RegExp[];
};

export type HighRiskPermitMatch = {
  definition: HighRiskPermitDefinition;
  evidence: string[];
};

export type HighRiskPermitMatchResult = {
  matches: HighRiskPermitMatch[];
  unmappedTriggers: string[];
  source: "explicit" | "inferred" | "none";
};

function words(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function key(value: unknown) {
  return words(value).replace(/\s+/g, "_");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export const HIGH_RISK_PERMIT_BOOKLET_VERSION = "2026-05-27";

export const HIGH_RISK_PERMIT_DEFINITIONS: readonly HighRiskPermitDefinition[] = [
  {
    code: "HWP-001",
    name: "Hot Work Permit Checklist",
    tradeTriggers: ["Welding", "Steel/Ironwork", "Mechanical", "Roofing", "Demolition", "Maintenance"],
    trigger: "Welding, cutting, brazing, torch work, grinding, open flame, or other spark/heat-producing work outside a designated hot work area.",
    requiredReviewer: "Hot work approver or safety/site supervisor; fire watch assigned before activation.",
    stopWorkRule: "Stop if fire watch leaves, combustibles are introduced, smoke/fire/smoldering is observed, ventilation fails, or scope/location changes.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart J; 1926.352 fire prevention.",
    checklistItems: [
      "Combustibles removed, shielded, or protected; wall/floor openings sealed.",
      "Fire extinguisher or hose available, accessible, and inspected.",
      "Fire watch assigned, briefed, and duration confirmed.",
      "Area above, below, and behind work inspected for hidden combustibles.",
      "Gas cylinders, fuel sources, and hoses secured and protected from damage.",
      "Ventilation/smoke control verified for fumes, coatings, and occupied areas.",
      "Adjacent trades/occupants notified; barricades or hot work screens posted.",
      "Final fire watch and closeout inspection completed before permit closure.",
    ],
    aliases: ["hot work", "hot_work", "hot_work_permit", "welding", "cutting", "torch work"],
    patterns: [/\bhot\s*work\b|\bweld(?:ing)?\b|\btorch\b|\bgrind(?:ing)?\b|\bbraz(?:e|ing)\b|\bopen\s*flame\b|\bspark(?:s|ing)?\b/i],
  },
  {
    code: "CSE-002",
    name: "Confined Space Entry Permit Checklist",
    tradeTriggers: ["Mechanical", "Plumbing", "Civil", "Utility", "Maintenance", "Fire Protection"],
    trigger: "Entry into a permit-required confined space or any space with potential atmospheric, engulfment, configuration, mechanical, electrical, or chemical hazards.",
    requiredReviewer: "Entry supervisor with attendant, authorized entrants, and rescue method verified before entry.",
    stopWorkRule: "Stop if air readings exceed limits, attendant leaves, ventilation fails, rescue readiness changes, or a new hazard is introduced.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart AA; 1926.1204-1926.1206.",
    checklistItems: [
      "Space classified and permit-required hazards identified.",
      "Authorized entrants, attendant, and entry supervisor named on permit.",
      "Initial atmospheric test completed and acceptable before entry.",
      "Continuous or periodic atmospheric monitoring method established.",
      "Isolation, LOTO, blanking, purging, and/or ventilation completed as needed.",
      "Rescue method, retrieval equipment, and communication verified.",
      "Entry log/sign-in and entrant tracking active for the duration of work.",
      "All entrants exited; entry canceled and space secured at closeout.",
    ],
    aliases: ["confined space", "confined_space", "confined_space_permit", "permit required confined space"],
    patterns: [/\bconfined\s*space\b|\bpermit[-\s]*required\s*space\b|\bmanhole\b|\bvault\b|\btank\b|\bvessel\b|\bpit\b|\bcrawl\s*space\b/i],
  },
  {
    code: "EXC-003",
    name: "Excavation / Trenching Permit Checklist",
    tradeTriggers: ["Civil", "Excavation", "Utility", "Sitework", "Plumbing", "Concrete"],
    trigger: "Any trench, excavation, soil removal, or ground opening with cave-in, utility, access/egress, water, traffic, fall, or atmosphere exposure.",
    requiredReviewer: "Excavation competent person must inspect before entry, after weather events, and after hazard-changing conditions.",
    stopWorkRule: "Stop if soil/water conditions change, protective system shifts, utilities are exposed/damaged, access is blocked, or edge loads become unsafe.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart P; 1926.651 and 1926.652.",
    checklistItems: [
      "Underground utilities located/marked; potholing completed where required.",
      "Competent person inspected soil, water, adjacent structures, and edge loads.",
      "Protective system installed or exemption verified by competent person.",
      "Safe access/egress installed for trench depth and travel requirements.",
      "Spoils, equipment, and materials set back; edge protection/barricades installed.",
      "Traffic, water, and atmospheric hazards evaluated and controlled.",
      "Daily/weather/change inspection logged before employee entry.",
      "Excavation covered, barricaded, backfilled, or otherwise made safe at closeout.",
    ],
    aliases: ["excavation", "excavation_permit", "trenching", "trench"],
    patterns: [/\bexcavat(?:e|ion|ing)?\b|\btrench(?:ing)?\b|\bsoil\s*removal\b|\bground\s*opening\b|\bshoring\b|\bsloping\b/i],
  },
  {
    code: "GDU-004",
    name: "Ground Disturbance / Utility Locate Permit Checklist",
    tradeTriggers: ["Civil", "Concrete", "Electrical", "Plumbing", "Low Voltage", "Fire Protection"],
    trigger: "Digging, drilling, saw cutting, core drilling, stake driving, trenching, or penetration that may contact underground or embedded utilities.",
    requiredReviewer: "Competent person or permit approver verifies utility locate, scan results, tolerance zone, and digging method.",
    stopWorkRule: "Stop if utility markings are unclear, unknown material is encountered, depth/path changes, or an unmarked utility is exposed.",
    referenceBasis: "OSHA 29 CFR 1926.416 for exposed or concealed electric circuits; 1926 Subpart P when excavation applies.",
    checklistItems: [
      "Drawings, utility locates, permits, and owner/GC restrictions reviewed.",
      "Work zone matched to mark-out; tolerance zone communicated to crew.",
      "Non-destructive verification method used for unknown or high-risk utilities.",
      "Saw cut, core drill, or excavation depth limits set before work starts.",
      "Energized, pressurized, or hazardous lines isolated or protected where possible.",
      "Spotter assigned for excavation equipment or blind-area work.",
      "Penetration path scanned/verified using GPR, as-builts, or approved method.",
      "Exposed utilities documented and as-built/closeout notes captured.",
    ],
    aliases: ["ground disturbance", "utility locate", "utility_locate", "ground_disturbance", "gdu"],
    patterns: [/\butility\s*locate\b|\bpothol(?:e|ing)\b|\bground\s*disturbance\b|\bcore\s*drill(?:ing)?\b|\bstake\s*driv(?:e|ing)\b|\bpenetration\b|\bembedded\s*utilit/i],
  },
  {
    code: "WAH-005",
    name: "Work at Height Permit Checklist",
    tradeTriggers: ["Roofing", "Steel/Ironwork", "Concrete", "MEP", "Scaffold", "General Trades"],
    trigger: "Elevated work, leading edge work, roof work, scaffold/MEWP work, floor openings, ladders, or unprotected edge exposure.",
    requiredReviewer: "Competent person or fall protection reviewer verifies method, anchorage, access, and rescue plan.",
    stopWorkRule: "Stop if anchor/guardrail condition changes, weather exceeds threshold, rescue plan is not available, or edge/opening controls are removed.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart M; 1926.501 and 1926.502.",
    checklistItems: [
      "Work-at-height trigger confirmed and fall protection method selected.",
      "Anchorages, guardrails, lifelines, or warning lines inspected and acceptable.",
      "Harness, lanyard, SRL, connectors, and compatibility inspected.",
      "Floor openings, skylights, edges, and covers controlled and labeled.",
      "Ladder, scaffold, stair tower, or MEWP access inspected before use.",
      "Falling-object controls and exclusion zone established below work area.",
      "Rescue/retrieval plan reviewed and rescue equipment available.",
      "Weather, lighting, and walking/working surface conditions acceptable.",
    ],
    aliases: ["work at height", "work_at_height", "work_at_heights", "elevated_work_notice", "fall protection"],
    patterns: [/\bwork\s*at\s*height\b|\bleading\s*edge\b|\broof(?:ing)?\b|\bfloor\s*opening\b|\bskylight\b|\bunprotected\s*edge\b|\bfall\s*protection\b|\bscaffold\b|\bladder\b/i],
  },
  {
    code: "GRV-006",
    name: "Gravity / Overhead Work Permit Checklist",
    tradeTriggers: ["Steel/Ironwork", "Roofing", "Concrete", "MEP", "Demolition", "General Trades"],
    trigger: "Work above people, equipment, public ways, or active work areas where tools, material, debris, or suspended items could fall.",
    requiredReviewer: "Foreman or competent person verifies exclusion zones, dropped-object controls, and work sequencing.",
    stopWorkRule: "Stop if exclusion zone is breached, stacked work starts below, high winds occur, or material/tool control is lost.",
    referenceBasis: "Hierarchy of controls for dropped objects, overhead work, and struck-by prevention.",
    checklistItems: [
      "Overhead work zone and exclusion area established and posted.",
      "Tools, materials, fasteners, and small parts tethered or secured.",
      "Barricades, signs, spotters, or access control protect people below.",
      "Work sequencing prevents conflicting stacked work underneath.",
      "Toe boards, debris netting, catch platforms, or canopies installed where needed.",
      "Communication method set between overhead and ground crews.",
      "Wind/weather evaluated for loose material and elevated handling.",
      "Final sweep completed for dropped-object hazards before reopening area.",
    ],
    aliases: ["gravity", "overhead work", "dropped objects", "line of fire", "overhead"],
    patterns: [/\boverhead\s*work\b|\bwork\s*above\b|\bdropped?\s*object\b|\bfalling\s*object\b|\bstacked\s*work\b|\bsuspended\s*item\b|\bpeople\s*below\b/i],
  },
  {
    code: "LFT-007",
    name: "Critical Lift / Rigging Permit Checklist",
    tradeTriggers: ["Crane", "Rigging", "Steel/Ironwork", "Concrete", "Mechanical", "Demolition"],
    trigger: "Crane, hoist, rigging, multiple-crane lift, personnel hoisting, lift near power lines, high-value load, blind pick, or site-defined critical lift.",
    requiredReviewer: "Qualified rigger/signal person and lift director or competent/qualified person as required by lift conditions.",
    stopWorkRule: "Stop if load weight/radius changes, wind exceeds limit, communication fails, rigging is damaged, or people enter the suspended-load zone.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart CC crane and derrick requirements where applicable.",
    checklistItems: [
      "Lift plan reviewed for load weight, radius, path, and landing zone.",
      "Crane, hoist, or lifting equipment inspection current and documented.",
      "Qualified rigger and signal person assigned and briefed.",
      "Rigging gear inspected, tagged/rated, and matched to configuration.",
      "Ground bearing, mats, outriggers, and setup conditions verified.",
      "Swing radius, travel path, and power line exposures controlled.",
      "Critical, multiple-crane, personnel-hoist, or blind-pick requirements reviewed.",
      "Post-lift rigging/equipment condition checked and permit closed.",
    ],
    aliases: ["critical lift", "lift plan", "lift_plan", "rigging", "crane"],
    patterns: [/\bcritical\s*lift\b|\blift\s*plan\b|\bcrane\b|\brigging\b|\bhoist(?:ing)?\b|\bblind\s*pick\b|\bsuspended\s*load\b|\bmultiple[-\s]*crane\b|\bpersonnel\s*hoist/i],
  },
  {
    code: "ELE-008",
    name: "Electrical Work / Energized Work Permit Checklist",
    tradeTriggers: ["Electrical", "Low Voltage", "Controls", "Mechanical", "Maintenance"],
    trigger: "Work on or near exposed live parts, temporary power, panel work, testing/troubleshooting, energized justification, or electrical hazard exposure.",
    requiredReviewer: "Qualified electrical person and site/safety approver for energized work or boundary controls.",
    stopWorkRule: "Stop if electrical scope changes, covers/guards are removed without controls, PPE is missing, instrument check fails, or unauthorized workers enter boundary.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart K and NFPA 70E where adopted by employer/site policy.",
    checklistItems: [
      "Electrical scope classified as de-energized, testing, or energized work.",
      "Shock/arc flash boundaries identified, posted, and barricaded.",
      "Qualified person assigned; energized work justification/approval obtained if needed.",
      "Voltage verification and test-instrument check completed before contact.",
      "PPE, insulated tools, and protective equipment selected and inspected.",
      "Exposed energized parts guarded, covered, or otherwise controlled.",
      "Temporary power, GFCI, cords, panels, and covers inspected.",
      "Equipment restored to safe condition; covers installed before closeout.",
    ],
    aliases: ["electrical", "energized electrical", "energized_electrical", "energized_electrical_permit", "electrical work"],
    patterns: [/\benergized\b|\blive\s*part\b|\bpanel\s*work\b|\belectrical\s*(?:work|hazard|testing|exposure)?\b|\barc\s*flash\b|\btemporary\s*power\b|\bswitchgear\b/i],
  },
  {
    code: "LOTO-009",
    name: "LOTO / Stored Energy Permit Checklist",
    tradeTriggers: ["Mechanical", "Electrical", "Plumbing", "Process Piping", "Maintenance", "Demolition"],
    trigger: "Servicing, maintenance, line break, troubleshooting, tie-in, equipment repair, demolition, or task with hazardous energy exposure.",
    requiredReviewer: "Authorized employee/qualified person verifies isolation, stored energy control, and zero-energy verification.",
    stopWorkRule: "Stop if an energy source is missed, stored energy reaccumulates, group LOTO accountability fails, or work scope changes.",
    referenceBasis: "OSHA 29 CFR 1910.147 control of hazardous energy; 1926 electrical lockout/tagging where applicable.",
    checklistItems: [
      "All energy sources identified: electrical, mechanical, hydraulic, pneumatic, chemical, thermal, gravity, or stored pressure.",
      "Shutdown and isolation points verified against equipment and task scope.",
      "Locks/tags applied by authorized employees using required procedure.",
      "Stored/residual energy released, blocked, bled, restrained, or dissipated.",
      "Zero-energy verification or try-start/test completed and documented.",
      "Affected workers notified before work starts and before restart.",
      "Group LOTO or shift-transfer controls completed where applicable.",
      "Locks/tags removed only after area is clear and restart is authorized.",
    ],
    aliases: ["loto", "lockout", "tagout", "lockout tagout", "stored energy", "lockout_tagout"],
    patterns: [/\bLOTO\b|\blockout\b|\btagout\b|\bstored\s*energy\b|\bzero[-\s]*energy\b|\bhazardous\s*energy\b|\btie[-\s]*in\b|\bservic(?:e|ing)\b/i],
  },
  {
    code: "MEWP-010",
    name: "MEWP / AWP Permit Checklist",
    tradeTriggers: ["Electrical", "Low Voltage", "MEP", "Glazing", "Painting", "General Trades"],
    trigger: "Use of mobile elevating work platform, aerial work platform, boom lift, scissor lift, or similar elevated mobile work equipment.",
    requiredReviewer: "Authorized operator and supervisor/competent person verify equipment inspection, ground conditions, and overhead hazards.",
    stopWorkRule: "Stop if ground conditions change, wind exceeds equipment/site limits, alarms occur, power line clearance is compromised, or operator loses authorization.",
    referenceBasis: "OSHA 29 CFR 1926.453 for aerial lifts; Subpart L scaffold provisions where applicable.",
    checklistItems: [
      "Operator trained/authorized for the specific equipment type.",
      "Pre-use equipment inspection completed and documented.",
      "Ground, slope, pothole, slab, and outrigger conditions acceptable.",
      "Overhead obstructions and power line exposures identified and controlled.",
      "Fall protection/tie-off requirements reviewed for equipment type.",
      "Barricades, cones, or spotter established for traffic/pedestrian exposure.",
      "Platform load limits for people, tools, and materials verified.",
      "Unit parked, lowered/stowed, and secured at closeout.",
    ],
    aliases: ["mewp", "awp", "aerial lift", "scissor lift", "boom lift", "mobile elevating work platform"],
    patterns: [/\bMEWP\b|\bAWP\b|\baerial\s*lift\b|\bscissor\s*lift\b|\bboom\s*lift\b|\bmobile\s*elevating\s*work\s*platform\b/i],
  },
  {
    code: "SIL-011",
    name: "Silica / Dust-Producing Work Permit Checklist",
    tradeTriggers: ["Concrete", "Masonry", "Demolition", "Tile", "Civil", "Drywall"],
    trigger: "Saw cutting, grinding, drilling, chipping, jackhammering, demo, sweeping, or other work that can generate respirable crystalline silica or harmful dust.",
    requiredReviewer: "Competent person or safety/site supervisor verifies control method, restricted area, PPE, and cleanup controls.",
    stopWorkRule: "Stop if water/dust collection fails, visible dust escapes controlled area, respiratory protection is missing, or task duration/control method changes.",
    referenceBasis: "OSHA 29 CFR 1926.1153 respirable crystalline silica.",
    checklistItems: [
      "Silica/dust-generating task identified and matched to approved control method.",
      "Wet method, dust collector, shroud, or local exhaust installed and functional.",
      "Respiratory protection required/issued/fit-check completed where needed.",
      "Restricted area, barricade, or signage established around dust zone.",
      "HEPA cleanup available; dry sweeping/compressed air prohibited unless controlled.",
      "Worker training, SDS, and task instructions reviewed before work.",
      "Exposure duration, location, weather, and ventilation considered.",
      "Dust controls verified and area cleaned before closeout.",
    ],
    aliases: ["silica", "dust", "dust-producing work", "silica permit"],
    patterns: [/\bsilica\b|\bdust[-\s]*producing\b|\bjackhammer(?:ing)?\b|\bchipping\b|\bsaw\s*cut(?:ting)?\b|\bdry\s*sweep(?:ing)?\b|\brespirable\s*crystalline\b/i],
  },
  {
    code: "CHEM-012",
    name: "Chemical Use / Line Break Permit Checklist",
    tradeTriggers: ["Mechanical", "Plumbing", "Fire Protection", "Painting/Coatings", "Process Piping", "Maintenance"],
    trigger: "Chemical use, hazardous coating/solvent work, line break, drain/flush, pressurized system opening, or work involving hazardous contents.",
    requiredReviewer: "Competent/qualified person verifies SDS, isolation, PPE, containment, and emergency controls.",
    stopWorkRule: "Stop if leak/spill occurs, unknown contents are discovered, pressure remains, ventilation fails, or emergency equipment is unavailable.",
    referenceBasis: "OSHA 29 CFR 1910.1200 hazard communication; LOTO/energy control requirements as applicable.",
    checklistItems: [
      "Chemical, line contents, pressure, and temperature hazards identified; SDS reviewed.",
      "Isolation, depressurization, drain, flush, purge, or blanking completed.",
      "LOTO, blind, blank, or tag controls installed where required.",
      "Spill containment, secondary containment, and absorbents staged.",
      "PPE selected for chemical, pressure, splash, and temperature hazards.",
      "Ventilation, gas testing, and ignition controls in place if applicable.",
      "Eyewash/shower, first aid, and emergency notification method verified.",
      "Line/area returned to safe condition; leaks/spills addressed before closeout.",
    ],
    aliases: ["chemical", "chemical use", "line break", "line_break", "solvent", "hazardous contents"],
    patterns: [/\bchemical\b|\bsolvent\b|\bcoating\b|\bline\s*break\b|\bdrain\s*\/?\s*flush\b|\bpressurized\s*system\b|\bhazardous\s*contents\b|\bSDS\b/i],
  },
  {
    code: "TMP-013",
    name: "Temperature / Weather Permit Checklist",
    tradeTriggers: ["All Trades", "Roofing", "Crane/Rigging", "Concrete", "Exterior Work"],
    trigger: "Heat, cold, lightning, high wind, heavy rain, poor visibility, severe weather watch/warning, or site-defined weather threshold.",
    requiredReviewer: "Supervisor or site safety approver verifies weather threshold, controls, and communication plan.",
    stopWorkRule: "Stop if lightning/wind/temperature/visibility exceeds site threshold, communication fails, or workers show heat/cold stress symptoms.",
    referenceBasis: "Project weather/heat/cold stress plan; OSHA heat/cold stress guidance where adopted by site policy.",
    checklistItems: [
      "Weather or temperature trigger confirmed and site threshold identified.",
      "Monitoring method set: weather app, meter, radio, WBGT, or site alert.",
      "Crew briefing completed on symptoms, breaks, and stop-work signals.",
      "Hydration, warm-up/cool-down, shade, shelter, or wind protection in place.",
      "Lighting, visibility, and walking/working surface conditions evaluated.",
      "Materials and equipment secured for wind, storm, or temperature exposure.",
      "Emergency response and communication method verified.",
      "Permit paused or closed if conditions exceed threshold.",
    ],
    aliases: ["weather", "temperature", "heat", "cold", "weather permit", "temperature permit"],
    patterns: [/\bheat\b|\bcold\b|\blightning\b|\bhigh\s*wind\b|\bheavy\s*rain\b|\bpoor\s*visibility\b|\bsevere\s*weather\b|\bWBGT\b|\bweather\s*threshold\b/i],
  },
  {
    code: "DEM-014",
    name: "Demolition / Penetration Permit Checklist",
    tradeTriggers: ["Demolition", "Concrete", "Electrical", "Mechanical", "Carpentry", "Core Drilling"],
    trigger: "Demolition, wall/floor/roof penetration, structural removal, slab cutting, core drilling, or invasive work that may affect utilities or structure.",
    requiredReviewer: "Competent person or qualified reviewer verifies survey, utility isolation, structural impact, and exclusion zones.",
    stopWorkRule: "Stop if unknown utilities/materials are found, structural condition changes, dust/debris escapes controls, or exclusion zone is breached.",
    referenceBasis: "OSHA 29 CFR 1926 Subpart T; 1926.850 preparatory operations.",
    checklistItems: [
      "Demolition/penetration scope and structural impact reviewed before start.",
      "Utility isolation, locate, scan, or verification completed before cutting/removal.",
      "Engineering survey, shoring, bracing, or fall protection verified where needed.",
      "Dust, silica, noise, and hazardous material controls in place.",
      "Exclusion zone, barricades, signs, and access control established.",
      "Debris, chute, waste handling, and material removal route planned.",
      "Competent person inspection completed before start and after changes.",
      "Area made safe; debris removed and openings/penetrations protected at closeout.",
    ],
    aliases: ["demolition", "demolition_release", "penetration", "structural removal", "slab cutting"],
    patterns: [/\bdemolition\b|\bdemo\b|\bwall\s*penetration\b|\bfloor\s*penetration\b|\broof\s*penetration\b|\bstructural\s*removal\b|\bslab\s*cut(?:ting)?\b|\binvasive\s*work\b/i],
  },
];

const DEFINITIONS_BY_CODE = new Map(HIGH_RISK_PERMIT_DEFINITIONS.map((definition) => [definition.code, definition]));
const ALIASES = new Map<string, HighRiskPermitCode>();

for (const definition of HIGH_RISK_PERMIT_DEFINITIONS) {
  for (const alias of [definition.code, definition.name, ...definition.aliases]) {
    ALIASES.set(key(alias), definition.code);
  }
}

export function getHighRiskPermitDefinition(code: HighRiskPermitCode) {
  return DEFINITIONS_BY_CODE.get(code) ?? null;
}

export function resolveHighRiskPermitCode(value: unknown): HighRiskPermitCode | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (DEFINITIONS_BY_CODE.has(raw as HighRiskPermitCode)) return raw as HighRiskPermitCode;
  const normalized = key(value);
  return ALIASES.get(normalized) ?? ALIASES.get(normalized.replace(/_(permit|checklist)$/i, "")) ?? null;
}

export function resolveHighRiskPermitDefinition(value: unknown) {
  const code = resolveHighRiskPermitCode(value);
  return code ? getHighRiskPermitDefinition(code) : null;
}

export function buildPermitBookletMetadata(definition: HighRiskPermitDefinition) {
  return {
    bookletVersion: HIGH_RISK_PERMIT_BOOKLET_VERSION,
    permitCode: definition.code,
    permitName: definition.name,
    trigger: definition.trigger,
    requiredReviewer: definition.requiredReviewer,
    stopWorkRule: definition.stopWorkRule,
    referenceBasis: definition.referenceBasis,
    checklistItemCount: definition.checklistItems.length,
  };
}

export function matchHighRiskPermits(input: {
  explicitTriggers?: unknown;
  title?: string | null;
  trade?: string | null;
  taskType?: string | null;
  workArea?: string | null;
  notes?: string | null;
  hazardCategories?: unknown;
  requiredControls?: unknown;
}): HighRiskPermitMatchResult {
  const rawExplicit = Array.isArray(input.explicitTriggers)
    ? input.explicitTriggers
    : String(input.explicitTriggers ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const explicit = rawExplicit.map((item) => String(item ?? "").trim()).filter(Boolean);

  if (explicit.length > 0) {
    const matchedCodes: HighRiskPermitCode[] = [];
    const unmappedTriggers: string[] = [];
    for (const trigger of explicit) {
      const code = resolveHighRiskPermitCode(trigger);
      if (code) {
        matchedCodes.push(code);
      } else {
        unmappedTriggers.push(trigger);
      }
    }
    return {
      matches: unique(matchedCodes).map((code) => ({
        definition: getHighRiskPermitDefinition(code)!,
        evidence: explicit.filter((trigger) => resolveHighRiskPermitCode(trigger) === code),
      })),
      unmappedTriggers,
      source: matchedCodes.length > 0 ? "explicit" : "none",
    };
  }

  const text = [
    input.title,
    input.trade,
    input.taskType,
    input.workArea,
    input.notes,
    ...(Array.isArray(input.hazardCategories) ? input.hazardCategories : []),
    ...(Array.isArray(input.requiredControls) ? input.requiredControls : []),
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");

  if (!text.trim()) return { matches: [], unmappedTriggers: [], source: "none" };

  const matches = HIGH_RISK_PERMIT_DEFINITIONS.flatMap((definition) => {
    const evidence = definition.patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
    return evidence.length > 0 ? [{ definition, evidence }] : [];
  });

  return {
    matches,
    unmappedTriggers: [],
    source: matches.length > 0 ? "inferred" : "none",
  };
}

export function highRiskPermitCodesForPrediction(input: Omit<Parameters<typeof matchHighRiskPermits>[0], "explicitTriggers">) {
  return matchHighRiskPermits(input).matches.map((match) => match.definition.code);
}
