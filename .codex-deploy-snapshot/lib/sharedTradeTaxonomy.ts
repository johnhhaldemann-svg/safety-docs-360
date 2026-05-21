/**
 * Shared construction-work taxonomy used across profile, jobsite audits,
 * Risk Memory, and CSEP matrix generation.
 */

export type FieldAuditScopeKey =
  | "general_contractor"
  | "excavation_earthwork"
  | "demolition"
  | "framing"
  | "steel_erection"
  | "concrete"
  | "masonry"
  | "roofing"
  | "waterproofing"
  | "insulation"
  | "drywall"
  | "painting"
  | "flooring"
  | "ceiling_acoustical"
  | "glazing"
  | "electrical"
  | "plumbing"
  | "hvac"
  | "fire_protection"
  | "scaffold_access"
  | "equipment_crane_operations"
  | "utilities_underground"
  | "landscaping_site_work"
  | "carpentry"
  | "millwright_mechanical"
  | "other";

export type CsepKind =
  | "site_earth"
  | "structural_steel_wood"
  | "structural_concrete_masonry"
  | "exterior_envelope"
  | "mep"
  | "interior_finishes"
  | "specialty_misc"
  | "heavy_civil"
  | "gc_cm"
  | "other_common";

export type CommonTaskBucketCode =
  | "planning_admin"
  | "access"
  | "installation"
  | "modification"
  | "testing"
  | "closeout";

export type SharedTaskDefinition = {
  code: string;
  label: string;
  selectable: boolean;
  bucket: CommonTaskBucketCode;
};

export type SharedSubTradeDefinition = {
  code: string;
  label: string;
  description: string;
  tasks: SharedTaskDefinition[];
  selectableTasks: SharedTaskDefinition[];
  referenceTasks: SharedTaskDefinition[];
};

export type SharedTradeDefinition = {
  code: string;
  slug: string;
  label: string;
  fieldScope: FieldAuditScopeKey;
  csepKind: CsepKind;
  legacyLabels: string[];
  aliases: string[];
  subTrades: SharedSubTradeDefinition[];
};

type RawSubTradeSeed = {
  label: string;
  tasks: string[];
};

type RawTradeSeed = {
  label: string;
  fieldScope: FieldAuditScopeKey;
  csepKind: CsepKind;
  legacyLabels?: string[];
  aliases?: string[];
  subTrades: RawSubTradeSeed[];
};

const MAX_SELECTABLE_TASKS_PER_SUB_TRADE = 12;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function inferTaskBucket(label: string): CommonTaskBucketCode {
  const value = label.toLowerCase();
  if (
    value.includes("plan") ||
    value.includes("review") ||
    value.includes("meeting") ||
    value.includes("walkdown") ||
    value.includes("inspection") ||
    value.includes("permit") ||
    value.includes("assessment")
  ) {
    return "planning_admin";
  }
  if (
    value.includes("scaffold") ||
    value.includes("ladder") ||
    value.includes("lift access") ||
    value.includes("roof access") ||
    value.includes("stair tower") ||
    value.includes("entry")
  ) {
    return "access";
  }
  if (
    value.includes("test") ||
    value.includes("startup") ||
    value.includes("commission") ||
    value.includes("calibration") ||
    value.includes("loop check") ||
    value.includes("megger")
  ) {
    return "testing";
  }
  if (
    value.includes("punch") ||
    value.includes("turnover") ||
    value.includes("cleanup") ||
    value.includes("clean") ||
    value.includes("labeling") ||
    value.includes("demob") ||
    value.includes("training")
  ) {
    return "closeout";
  }
  if (
    value.includes("cut") ||
    value.includes("drill") ||
    value.includes("core") ||
    value.includes("grind") ||
    value.includes("weld") ||
    value.includes("demo") ||
    value.includes("repair") ||
    value.includes("retrofit") ||
    value.includes("tie-in")
  ) {
    return "modification";
  }
  return "installation";
}

function buildTaskDefinitions(labels: readonly string[]): SharedTaskDefinition[] {
  const tasks: SharedTaskDefinition[] = [];
  const usedCodes = new Set<string>();
  const unique = uniqueStrings(labels);
  unique.forEach((label, index) => {
    let code = slugify(label);
    if (!code) code = `task_${index + 1}`;
    if (usedCodes.has(code)) {
      let dup = 2;
      while (usedCodes.has(`${code}_${dup}`)) dup += 1;
      code = `${code}_${dup}`;
    }
    usedCodes.add(code);
    tasks.push({
      code,
      label,
      selectable: index < MAX_SELECTABLE_TASKS_PER_SUB_TRADE,
      bucket: inferTaskBucket(label),
    });
  });
  return tasks;
}

function buildSubTradeDescription(label: string, tasks: readonly SharedTaskDefinition[]): string {
  const taskPreview = tasks
    .slice(0, 4)
    .map((task) => task.label.toLowerCase())
    .join(", ");

  if (!taskPreview) {
    return `${label} work includes the primary installation, coordination, and closeout activities required for this scope.`;
  }

  const remainingCount = tasks.length - Math.min(tasks.length, 4);
  const suffix = remainingCount > 0 ? ", and related trade-specific activities" : "";
  return `${label} work typically includes ${taskPreview}${suffix}.`;
}

function buildSubTrade(seed: RawSubTradeSeed): SharedSubTradeDefinition {
  const tasks = buildTaskDefinitions(seed.tasks);
  return {
    code: slugify(seed.label),
    label: seed.label,
    description: buildSubTradeDescription(seed.label, tasks),
    tasks,
    selectableTasks: tasks.filter((task) => task.selectable),
    referenceTasks: tasks.filter((task) => !task.selectable),
  };
}

function buildTrade(seed: RawTradeSeed): SharedTradeDefinition {
  const code = slugify(seed.label);
  return {
    code,
    slug: code,
    label: seed.label,
    fieldScope: seed.fieldScope,
    csepKind: seed.csepKind,
    legacyLabels: uniqueStrings(seed.legacyLabels ?? []),
    aliases: uniqueStrings(seed.aliases ?? []),
    subTrades: seed.subTrades.map(buildSubTrade),
  };
}

export const COMMON_TASK_BUCKETS: Readonly<
  Record<CommonTaskBucketCode, { label: string; tasks: readonly string[] }>
> = {
  planning_admin: {
    label: "Planning / admin tasks",
    tasks: [
      "Pre-task plan",
      "JSA",
      "Permit review",
      "Lift plan",
      "Work package review",
      "Coordination meeting",
      "Hazard assessment",
    ],
  },
  access: {
    label: "Access tasks",
    tasks: [
      "Scaffold access",
      "Ladder access",
      "Lift access",
      "Stair tower use",
      "Roof access",
      "Confined space entry",
    ],
  },
  installation: {
    label: "Installation tasks",
    tasks: [
      "Layout",
      "Material handling",
      "Unloading",
      "Staging",
      "Fit-up",
      "Anchoring",
      "Hanging",
      "Fastening",
      "Assembly",
      "Alignment",
      "Bolting",
      "Grouting",
      "Sealing",
    ],
  },
  modification: {
    label: "Modification tasks",
    tasks: [
      "Cutting",
      "Drilling",
      "Coring",
      "Grinding",
      "Welding",
      "Demo",
      "Tie-in",
      "Repair",
      "Retrofit",
    ],
  },
  testing: {
    label: "Testing tasks",
    tasks: [
      "Pressure testing",
      "Leak testing",
      "Continuity testing",
      "Meggering",
      "Calibration",
      "Loop checks",
      "Startup",
      "Commissioning",
    ],
  },
  closeout: {
    label: "Closeout tasks",
    tasks: [
      "Punch list",
      "As-builts",
      "Labeling",
      "Cleanup",
      "Demob",
      "Turnover",
      "Training",
    ],
  },
};

const RAW_SHARED_TRADES: RawTradeSeed[] = [
  {
    label: "General Conditions / Site Management",
    fieldScope: "general_contractor",
    csepKind: "gc_cm",
    legacyLabels: ["General / Multi-trade", "General Contractor / Construction Manager"],
    aliases: ["safety_staff", "supervisors_foremen", "subcontractor_management", "laborers"],
    subTrades: [
      {
        label: "Site supervision",
        tasks: [
          "Site setup",
          "Fencing",
          "Barricades",
          "Signage",
          "Access control",
          "Deliveries",
          "Housekeeping",
          "Waste handling",
          "Traffic control",
          "Staging",
          "Walkdowns",
          "Inspections",
          "DAP/JSA review",
          "Coordination meetings",
          "Punch list",
          "Turnover support",
        ],
      },
      {
        label: "Safety / quality / logistics",
        tasks: [
          "Pre-task plan",
          "Hazard assessment",
          "Permit review",
          "Material management",
          "Layout coordination",
          "Laborer coordination",
          "Site logistics planning",
          "Quality walkdowns",
          "Closeout support",
        ],
      },
    ],
  },
  {
    label: "Survey / Layout",
    fieldScope: "excavation_earthwork",
    csepKind: "site_earth",
    legacyLabels: ["Survey / Layout"],
    subTrades: [
      {
        label: "Land survey",
        tasks: [
          "Benchmarking",
          "Control points",
          "Elevation checks",
          "Grid layout",
          "Anchor bolt verification",
          "As-built shots",
          "Utility locating",
          "Slope verification",
        ],
      },
      {
        label: "Building layout / as-built survey",
        tasks: [
          "Building layout",
          "Control survey",
          "As-built survey",
          "Layout verification",
        ],
      },
    ],
  },
  {
    label: "Demolition / Abatement",
    fieldScope: "demolition",
    csepKind: "site_earth",
    legacyLabels: ["Demolition"],
    aliases: ["demo_crews"],
    subTrades: [
      {
        label: "Selective / structural demolition",
        tasks: [
          "Saw cutting",
          "Chipping",
          "Wall removal",
          "Ceiling demo",
          "Floor demo",
          "Pipe removal",
          "Duct removal",
          "Equipment removal",
          "Dust containment",
          "Negative air setup",
          "Waste packaging",
          "Hazardous material removal",
        ],
      },
      {
        label: "Abatement / remediation",
        tasks: [
          "Asbestos abatement",
          "Lead abatement",
          "Mold remediation",
          "Soft demo",
          "Containment setup",
          "Waste haul-off",
        ],
      },
    ],
  },
  {
    label: "Earthwork / Civil / Sitework",
    fieldScope: "excavation_earthwork",
    csepKind: "heavy_civil",
    legacyLabels: ["Earthwork", "Site Preparation / Clearing", "Excavation & Grading"],
    subTrades: [
      {
        label: "Excavation / grading / trenching",
        tasks: [
          "Excavate",
          "Trench",
          "Bench/shore",
          "Install pipe",
          "Bedding",
          "Compaction",
          "Backfill",
          "Rough grading",
          "Fine grading",
          "Stone placement",
          "Asphalt paving",
          "Concrete paving",
          "Storm structures",
          "Catch basins",
          "Manholes",
          "Site drainage",
          "Silt fence",
          "Inlet protection",
        ],
      },
      {
        label: "Paving / site finishes",
        tasks: [
          "Curbs",
          "Sidewalks",
          "Erosion control",
          "Site restoration",
        ],
      },
    ],
  },
  {
    label: "Underground Utilities",
    fieldScope: "utilities_underground",
    csepKind: "heavy_civil",
    legacyLabels: ["Excavation / Utilities", "Utility & Underground Work"],
    subTrades: [
      {
        label: "Storm / sanitary / water / fire main",
        tasks: [
          "Trenching",
          "Shoring",
          "Pipe laying",
          "Fusion",
          "Tapping",
          "Thrust blocks",
          "Pressure testing",
          "Mandrel testing",
          "Tie-ins",
          "Manhole install",
          "Vault install",
          "Locator wire",
        ],
      },
      {
        label: "Gas / electrical / telecom duct bank",
        tasks: [
          "Conduit bank install",
          "Pull boxes",
          "Duct bank trenching",
          "Utility crossing coordination",
        ],
      },
    ],
  },
  {
    label: "Foundations / Concrete",
    fieldScope: "concrete",
    csepKind: "structural_concrete_masonry",
    legacyLabels: ["Concrete", "Foundation Work", "Concrete Forming & Placement"],
    aliases: ["concrete_crews"],
    subTrades: [
      {
        label: "Footings / walls / slabs / decks",
        tasks: [
          "Layout",
          "Excavation prep",
          "Form setting",
          "Rebar install",
          "Embeds",
          "Anchor bolts",
          "Vapor barrier",
          "Pouring",
          "Vibrating",
          "Screeding",
          "Finishing",
          "Curing",
          "Saw cutting",
          "Stripping forms",
          "Patching",
          "Grouting",
          "Precast erection",
        ],
      },
      {
        label: "Tilt-up / precast / post-tension",
        tasks: [
          "Panel prep",
          "Precast erection",
          "Post-tension stressing",
          "Brace installation",
        ],
      },
    ],
  },
  {
    label: "Structural Steel / Metals",
    fieldScope: "steel_erection",
    csepKind: "structural_steel_wood",
    legacyLabels: ["Steel / Ironwork", "Steel Framing / Structural Steel", "Structural Steel and Erection"],
    aliases: ["ironworkers"],
    subTrades: [
      {
        label: "Steel erection / decking",
        tasks: [
          "Unload steel",
          "Sort members",
          "Rigging",
          "Crane picks",
          "Column erection",
          "Beam setting",
          "Connecting",
          "Bolting",
          "Welding",
          "Cutting",
          "Grinding",
          "Decking install",
          "Embeds",
          "Punch list",
          "Touch-up painting",
        ],
      },
      {
        label: "Miscellaneous / ornamental metals",
        tasks: [
          "Metal stairs",
          "Handrails",
          "Miscellaneous metals install",
          "Ornamental metals install",
        ],
      },
    ],
  },
  {
    label: "Carpentry / Framing",
    fieldScope: "carpentry",
    csepKind: "structural_steel_wood",
    legacyLabels: ["Wood Framing", "Carpentry (Finish)", "Interior Trim & Millwork", "Exterior Trim & Millwork"],
    aliases: ["carpenters"],
    subTrades: [
      {
        label: "Rough carpentry / framing",
        tasks: [
          "Wall framing",
          "Soffits",
          "Backing install",
          "Door blocking",
          "Equipment supports",
          "Temporary protection",
          "Framing openings",
          "Sheathing",
          "Stairs",
          "Millwork backing",
          "Finish trim",
        ],
      },
      {
        label: "Metal studs / finish carpentry",
        tasks: [
          "Blocking",
          "Backing",
          "Trim install",
          "Protection install",
        ],
      },
    ],
  },
  {
    label: "Masonry",
    fieldScope: "masonry",
    csepKind: "structural_concrete_masonry",
    legacyLabels: ["Masonry", "Masonry (Brick, Block, Stone)", "Plaster / Stucco"],
    aliases: ["masons"],
    subTrades: [
      {
        label: "CMU / brick / stone",
        tasks: [
          "Block laying",
          "Brick laying",
          "Reinforcing install",
          "Scaffold use",
          "Mixing mortar",
          "Grout pours",
          "Flashing",
          "Lintels",
          "Anchors",
          "Restoration",
          "Repointing",
        ],
      },
      {
        label: "Restoration / tuckpointing",
        tasks: [
          "Tuckpointing",
          "Facade repair",
          "Masonry cleaning",
        ],
      },
    ],
  },
  {
    label: "Roofing",
    fieldScope: "roofing",
    csepKind: "exterior_envelope",
    legacyLabels: ["Roofing"],
    aliases: ["roofers"],
    subTrades: [
      {
        label: "Low-slope / shingles / metal roofing",
        tasks: [
          "Tear-off",
          "Substrate prep",
          "Insulation install",
          "Membrane install",
          "Hot work",
          "Flashing",
          "Edge metal",
          "Curb flashing",
          "Rooftop equipment coordination",
          "Fall protection setup",
        ],
      },
      {
        label: "Roof insulation / sheet metal flashing",
        tasks: [
          "Roof insulation install",
          "Sheet metal flashing",
          "Sheet metal trim",
        ],
      },
    ],
  },
  {
    label: "Waterproofing / Sealants",
    fieldScope: "waterproofing",
    csepKind: "exterior_envelope",
    legacyLabels: ["Waterproofing & Sealants"],
    subTrades: [
      {
        label: "Below-grade waterproofing / air barrier",
        tasks: [
          "Surface prep",
          "Membrane install",
          "Primer application",
          "Caulking",
          "Sealant joints",
          "Flashing seals",
          "Coating application",
          "Leak testing",
        ],
      },
      {
        label: "Expansion joints / traffic coatings",
        tasks: [
          "Expansion joint install",
          "Traffic coating application",
          "Sealant replacement",
        ],
      },
    ],
  },
  {
    label: "Building Envelope / Exterior",
    fieldScope: "waterproofing",
    csepKind: "exterior_envelope",
    legacyLabels: ["Siding / Exterior Cladding", "Curtain Wall / Storefront"],
    subTrades: [
      {
        label: "Siding / EIFS / cladding / panels",
        tasks: [
          "Panel installation",
          "Glazing prep",
          "Curtain wall framing",
          "Window setting",
          "Sealants",
          "Flashing",
          "Weather barrier",
          "Punch sealing",
          "Aerial lift work",
        ],
      },
      {
        label: "Storefront / windows / louvers",
        tasks: [
          "Storefront framing",
          "Window install",
          "Louver install",
          "Envelope punch work",
        ],
      },
    ],
  },
  {
    label: "Glazing",
    fieldScope: "glazing",
    csepKind: "specialty_misc",
    legacyLabels: ["Glass & Glazing"],
    subTrades: [
      {
        label: "Storefront / curtain wall / interior glass",
        tasks: [
          "Frame install",
          "Glass setting",
          "Suction lift work",
          "Sealant work",
          "Alignment",
          "Caulking",
          "Protection",
          "Hardware install",
        ],
      },
      {
        label: "Specialty glazing",
        tasks: [
          "Specialty glazing install",
          "Glass replacement",
          "Glazing punch work",
        ],
      },
    ],
  },
  {
    label: "Drywall / Ceilings / Interior Systems",
    fieldScope: "drywall",
    csepKind: "interior_finishes",
    legacyLabels: ["Drywall", "Drywall / Metal Stud Framing", "Ceiling Systems"],
    subTrades: [
      {
        label: "Drywall / wall panels",
        tasks: [
          "Track install",
          "Board hanging",
          "Finishing",
          "Sanding",
          "FRP panels",
          "Access panel install",
        ],
      },
      {
        label: "Acoustical / specialty ceilings / access floors",
        tasks: [
          "Ceiling grid",
          "Tile install",
          "Cloud ceilings",
          "Access floor install",
        ],
      },
    ],
  },
  {
    label: "Flooring",
    fieldScope: "flooring",
    csepKind: "interior_finishes",
    legacyLabels: ["Flooring", "Flooring (Tile, Carpet, Hardwood, Concrete Polishing)", "Tile & Stone Setting"],
    subTrades: [
      {
        label: "Polished concrete / tile / carpet / resilient",
        tasks: [
          "Surface prep",
          "Grinding",
          "Moisture testing",
          "Layout",
          "Tile install",
          "Carpet tile",
          "Vinyl install",
          "Cove base",
          "Epoxy coat",
          "Cure protection",
        ],
      },
      {
        label: "Epoxy / resinous systems",
        tasks: [
          "Primer coat",
          "Resinous install",
          "Broadcast aggregate",
          "Final topcoat",
        ],
      },
    ],
  },
  {
    label: "Painting / Coatings",
    fieldScope: "painting",
    csepKind: "interior_finishes",
    legacyLabels: ["Painting", "Painting & Wall Covering"],
    aliases: ["painters_coatings"],
    subTrades: [
      {
        label: "Interior / exterior paint",
        tasks: [
          "Masking",
          "Prep",
          "Sanding",
          "Spraying",
          "Rolling",
          "Coating application",
          "Touch-up",
          "Striping",
          "Specialty coatings",
        ],
      },
      {
        label: "Industrial / fireproof coatings",
        tasks: [
          "Surface cleaning",
          "Abrasive prep",
          "Fireproof coating application",
        ],
      },
    ],
  },
  {
    label: "Millwork / Casework / Doors / Hardware",
    fieldScope: "carpentry",
    csepKind: "interior_finishes",
    subTrades: [
      {
        label: "Millwork / casework / cabinets",
        tasks: [
          "Cabinets",
          "Countertops",
          "Marker boards",
          "Shelving",
          "Wall protection",
        ],
      },
      {
        label: "Doors / frames / hardware / specialties",
        tasks: [
          "Door frame install",
          "Door hanging",
          "Hardware install",
          "Toilet accessories",
          "Specialties install",
        ],
      },
    ],
  },
  {
    label: "Specialties",
    fieldScope: "other",
    csepKind: "specialty_misc",
    legacyLabels: ["Other / Not listed"],
    aliases: ["other"],
    subTrades: [
      {
        label: "Partitions / lockers / signage / accessories",
        tasks: [
          "Partition install",
          "Accessory mounting",
          "Signage install",
          "Protection install",
          "Final adjustments",
        ],
      },
      {
        label: "Operable partitions / fire extinguishers / accessories",
        tasks: [
          "Operable partition install",
          "Fire extinguisher placement",
          "Accessory punch work",
        ],
      },
    ],
  },
  {
    label: "HVAC / Mechanical",
    fieldScope: "hvac",
    csepKind: "mep",
    legacyLabels: ["Mechanical / HVAC", "HVAC / Mechanical", "Sheet Metal"],
    aliases: ["hvac"],
    subTrades: [
      {
        label: "Sheet metal / airside systems",
        tasks: [
          "Duct install",
          "Hangers",
          "Equipment setting",
          "Curb install",
          "AHU install",
          "RTU install",
          "Insulation coordination",
          "Startup support",
          "Balancing",
          "Filter install",
        ],
      },
      {
        label: "Mechanical piping / boilers / chillers / controls support",
        tasks: [
          "Chilled water piping",
          "Hot water piping",
          "Boiler install",
          "Chiller install",
          "Startup",
        ],
      },
    ],
  },
  {
    label: "Plumbing",
    fieldScope: "plumbing",
    csepKind: "mep",
    legacyLabels: ["Plumbing"],
    aliases: ["plumbers"],
    subTrades: [
      {
        label: "Domestic water / sanitary / vent / storm",
        tasks: [
          "Pipe install",
          "Hangers",
          "Fixture rough-in",
          "Carrier install",
          "Equipment connections",
          "Testing",
          "Flushing",
          "Insulation coordination",
          "Fixture set",
          "Trim-out",
        ],
      },
      {
        label: "Medical gas / specialties / fixtures",
        tasks: [
          "Medical gas piping",
          "Specialty fixture install",
          "Final connections",
        ],
      },
    ],
  },
  {
    label: "Pipefitting / Process Piping",
    fieldScope: "millwright_mechanical",
    csepKind: "mep",
    legacyLabels: ["Pipefitting / Process Piping"],
    aliases: ["pipefitters"],
    subTrades: [
      {
        label: "Steam / condensate / chilled water / hot water",
        tasks: [
          "Fit-up",
          "Welding",
          "Grooved pipe",
          "Threaded pipe",
          "Supports",
          "Pressure testing",
          "Flushing",
          "Tie-ins",
          "Valve install",
          "Equipment connections",
        ],
      },
      {
        label: "Process / stainless / high-purity piping",
        tasks: [
          "Stainless piping",
          "High-purity piping",
          "Orbital welds",
          "Passivation",
          "Skids",
        ],
      },
    ],
  },
  {
    label: "Fire Protection",
    fieldScope: "fire_protection",
    csepKind: "mep",
    legacyLabels: ["Fire Protection", "Fire Protection / Sprinklers"],
    subTrades: [
      {
        label: "Sprinkler / standpipe / fire pump",
        tasks: [
          "Hanger install",
          "Main line install",
          "Branch line install",
          "Heads",
          "Drops",
          "Testing",
          "Flushing",
          "Hydro tests",
          "Fire pump connections",
        ],
      },
      {
        label: "Special suppression / fire alarm support",
        tasks: [
          "Clean agent systems",
          "Suppression tie-ins",
          "Alarm support coordination",
        ],
      },
    ],
  },
  {
    label: "Electrical",
    fieldScope: "electrical",
    csepKind: "mep",
    legacyLabels: ["Electrical"],
    aliases: ["electricians"],
    subTrades: [
      {
        label: "Power distribution / feeders / branch power",
        tasks: [
          "Conduit install",
          "Wire pulls",
          "Terminations",
          "Panel install",
          "Switchgear install",
          "Lighting rough-in",
          "Device trim",
          "Temp power setup",
          "Grounding",
          "Megger testing",
          "Energization",
        ],
      },
      {
        label: "Lighting / grounding / temporary power / substations",
        tasks: [
          "Lighting install",
          "Ground grid install",
          "Substation coordination",
        ],
      },
    ],
  },
  {
    label: "Low Voltage / Technology",
    fieldScope: "electrical",
    csepKind: "mep",
    legacyLabels: ["Low Voltage", "Low Voltage / Data / Communications"],
    subTrades: [
      {
        label: "Data / telecom / fiber",
        tasks: [
          "Cable tray",
          "Cable pulls",
          "Terminations",
          "Racks",
          "Testing",
          "Programming support",
        ],
      },
      {
        label: "Security / access control / CCTV / AV / nurse call / BAS network",
        tasks: [
          "Panel mounting",
          "Camera install",
          "Badge readers",
          "AV device install",
          "Network connections",
        ],
      },
    ],
  },
  {
    label: "Instrumentation / Controls / Automation",
    fieldScope: "electrical",
    csepKind: "mep",
    subTrades: [
      {
        label: "BAS controls / PLC / SCADA / instrumentation",
        tasks: [
          "Sensor install",
          "Control wiring",
          "Panel install",
          "Loop checks",
          "Calibration",
          "Startup",
          "Programming",
          "Commissioning support",
          "Network connections",
        ],
      },
      {
        label: "Process controls",
        tasks: [
          "Instrument mounting",
          "I/O checkout",
          "Functional verification",
        ],
      },
    ],
  },
  {
    label: "Insulation / Fireproofing",
    fieldScope: "insulation",
    csepKind: "exterior_envelope",
    legacyLabels: ["Insulation"],
    aliases: ["insulators"],
    subTrades: [
      {
        label: "Mechanical / pipe / duct insulation",
        tasks: [
          "Wrap pipe",
          "Install jackets",
          "Duct wrap",
          "Repair damaged insulation",
        ],
      },
      {
        label: "Spray fireproofing / firestop",
        tasks: [
          "Firestop penetrations",
          "Spray fireproofing",
          "Fireproofing patch work",
        ],
      },
    ],
  },
  {
    label: "Welding / Hot Work",
    fieldScope: "steel_erection",
    csepKind: "specialty_misc",
    legacyLabels: ["Welding"],
    aliases: ["welders"],
    subTrades: [
      {
        label: "Structural / pipe / stainless welding / brazing / cutting",
        tasks: [
          "Fit-up",
          "Tack welding",
          "Full welds",
          "Torch cutting",
          "Grinding",
          "Brazing",
          "Purge setup",
          "Spark containment",
          "Fire watch",
        ],
      },
    ],
  },
  {
    label: "Scaffolding / Access",
    fieldScope: "scaffold_access",
    csepKind: "specialty_misc",
    legacyLabels: ["Scaffolding", "Scaffolding & Hoisting"],
    aliases: ["scaffold_builders"],
    subTrades: [
      {
        label: "Frame / system / rolling scaffold / suspended access",
        tasks: [
          "Erection",
          "Modification",
          "Inspection",
          "Tagging",
          "Dismantling",
          "Decking",
          "Guardrails",
          "Toe boards",
          "Access stairs",
        ],
      },
      {
        label: "Stair towers",
        tasks: [
          "Tower erection",
          "Tower inspection",
          "Tower dismantling",
        ],
      },
    ],
  },
  {
    label: "Rigging / Crane / Hoisting",
    fieldScope: "equipment_crane_operations",
    csepKind: "specialty_misc",
    legacyLabels: ["Rigging"],
    aliases: ["riggers_signal_persons"],
    subTrades: [
      {
        label: "Crane operators / riggers / signal persons / hoisting crews",
        tasks: [
          "Lift planning",
          "Crane setup",
          "Outriggers",
          "Picks",
          "Rigging inspection",
          "Load path control",
          "Tag lines",
          "Critical lifts",
          "Hoist operation",
        ],
      },
    ],
  },
  {
    label: "Equipment / Heavy Civil Operations",
    fieldScope: "equipment_crane_operations",
    csepKind: "heavy_civil",
    legacyLabels: ["Road & Highway Construction", "Bridge Construction", "Asphalt Paving"],
    aliases: ["operators", "truck_drivers"],
    subTrades: [
      {
        label: "Excavator / dozer / loader / skid steer / roller",
        tasks: [
          "Excavating",
          "Grading",
          "Lifting",
          "Hauling",
          "Compaction",
          "Trench support placement",
          "Material movement",
        ],
      },
      {
        label: "Telehandler / MEWP / forklift",
        tasks: [
          "Aerial work",
          "Loading/unloading",
          "Material staging",
        ],
      },
    ],
  },
  {
    label: "Utilities Startup / Commissioning / TAB",
    fieldScope: "millwright_mechanical",
    csepKind: "mep",
    aliases: ["millwrights"],
    subTrades: [
      {
        label: "Commissioning agents / startup techs / TAB techs / vendor reps",
        tasks: [
          "Pre-functional checks",
          "Startup",
          "Rotation checks",
          "Balancing",
          "Calibration",
          "Testing",
          "Functional performance tests",
          "System verification",
          "Punch resolution",
        ],
      },
    ],
  },
  {
    label: "Cleanroom / Pharma / Specialty Process",
    fieldScope: "millwright_mechanical",
    csepKind: "specialty_misc",
    subTrades: [
      {
        label: "Clean utilities / lab gas / process equipment / cleanroom panels",
        tasks: [
          "High-purity piping",
          "Cleanroom assembly",
          "HEPA coordination",
          "Sanitized tie-ins",
          "Specialty equipment install",
          "Turnover packages",
          "Validation walkthroughs",
        ],
      },
    ],
  },
  {
    label: "Renewable / Energy Systems",
    fieldScope: "electrical",
    csepKind: "mep",
    subTrades: [
      {
        label: "Solar / battery storage / EV charging / backup power",
        tasks: [
          "Racking install",
          "Panel install",
          "Inverter install",
          "Conduit",
          "Trenching",
          "Terminations",
          "Testing",
          "Commissioning",
        ],
      },
    ],
  },
  {
    label: "Landscaping / Exterior Finishes",
    fieldScope: "landscaping_site_work",
    csepKind: "heavy_civil",
    legacyLabels: ["Landscaping", "Landscaping & Irrigation"],
    subTrades: [
      {
        label: "Seeding / sodding / planting / irrigation / site furnishings",
        tasks: [
          "Topsoil",
          "Grading",
          "Planting",
          "Irrigation install",
          "Mulch",
          "Site restoration",
          "Bollards",
          "Benches",
          "Fencing",
        ],
      },
    ],
  },
  {
    label: "Final Cleaning / Turnover",
    fieldScope: "other",
    csepKind: "other_common",
    subTrades: [
      {
        label: "Construction cleaning / specialty cleaning / owner turnover support",
        tasks: [
          "Rough clean",
          "Final clean",
          "Dust removal",
          "Sticker removal",
          "Polishing",
          "Waste haul-off",
          "Turnover packages",
          "Closeout documentation",
        ],
      },
    ],
  },
];

export const SHARED_TRADE_DEFINITIONS: readonly SharedTradeDefinition[] = RAW_SHARED_TRADES.map(buildTrade);

export const CONSTRUCTION_TRADE_DEFINITIONS = SHARED_TRADE_DEFINITIONS;
export type ConstructionTradeDefinition = SharedTradeDefinition;

export const CONSTRUCTION_TRADE_LABELS: readonly string[] = SHARED_TRADE_DEFINITIONS.map((trade) => trade.label);
export const JOBSITE_AUDIT_TRADE_SLUGS: readonly string[] = SHARED_TRADE_DEFINITIONS.map((trade) => trade.slug);

export const CONSTRUCTION_TRADE_SLUG_BY_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  SHARED_TRADE_DEFINITIONS.map((trade) => [trade.label, trade.slug])
);

export const CONSTRUCTION_TRADE_LABEL_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  SHARED_TRADE_DEFINITIONS.map((trade) => [trade.slug, trade.label])
);

export const LEGACY_CONSTRUCTION_TRADE_LABELS: readonly string[] = uniqueStrings(
  SHARED_TRADE_DEFINITIONS.flatMap((trade) => trade.legacyLabels)
);

const TRADE_IDENTIFIER_TO_CODE = new Map<string, string>();
const SUB_TRADE_IDENTIFIER_TO_CODE = new Map<string, Map<string, string>>();
const TASK_IDENTIFIER_TO_CODE = new Map<string, Map<string, Map<string, string>>>();

function registerIdentifier(map: Map<string, string>, identifier: string, code: string) {
  const normalized = slugify(identifier);
  if (!normalized || map.has(normalized)) return;
  map.set(normalized, code);
}

for (const trade of SHARED_TRADE_DEFINITIONS) {
  registerIdentifier(TRADE_IDENTIFIER_TO_CODE, trade.code, trade.code);
  registerIdentifier(TRADE_IDENTIFIER_TO_CODE, trade.label, trade.code);
  for (const legacy of trade.legacyLabels) registerIdentifier(TRADE_IDENTIFIER_TO_CODE, legacy, trade.code);
  for (const alias of trade.aliases) registerIdentifier(TRADE_IDENTIFIER_TO_CODE, alias, trade.code);

  const subMap = new Map<string, string>();
  const taskMapBySub = new Map<string, Map<string, string>>();
  for (const subTrade of trade.subTrades) {
    registerIdentifier(subMap, subTrade.code, subTrade.code);
    registerIdentifier(subMap, subTrade.label, subTrade.code);
    const taskMap = new Map<string, string>();
    for (const task of subTrade.tasks) {
      registerIdentifier(taskMap, task.code, task.code);
      registerIdentifier(taskMap, task.label, task.code);
    }
    taskMapBySub.set(subTrade.code, taskMap);
  }
  SUB_TRADE_IDENTIFIER_TO_CODE.set(trade.code, subMap);
  TASK_IDENTIFIER_TO_CODE.set(trade.code, taskMapBySub);
}

export function getSharedTradeDefinitionByCode(code: string | null | undefined): SharedTradeDefinition | null {
  const normalized = slugify(String(code ?? ""));
  if (!normalized) return null;
  return SHARED_TRADE_DEFINITIONS.find((trade) => trade.code === normalized) ?? null;
}

export function getSharedTradeDefinitionByLabel(label: string | null | undefined): SharedTradeDefinition | null {
  const normalized = slugify(String(label ?? ""));
  if (!normalized) return null;
  const code = TRADE_IDENTIFIER_TO_CODE.get(normalized);
  return code ? getSharedTradeDefinitionByCode(code) : null;
}

export function resolveSharedTradeCode(input: string | null | undefined): string | null {
  const normalized = slugify(String(input ?? ""));
  if (!normalized) return null;
  return TRADE_IDENTIFIER_TO_CODE.get(normalized) ?? null;
}

export function getSharedSubTradesForTrade(tradeCode: string | null | undefined): SharedSubTradeDefinition[] {
  return getSharedTradeDefinitionByCode(tradeCode)?.subTrades ?? [];
}

export function resolveSharedSubTradeCode(
  tradeCode: string | null | undefined,
  input: string | null | undefined
): string | null {
  const trade = getSharedTradeDefinitionByCode(tradeCode);
  if (!trade) return null;
  const normalized = slugify(String(input ?? ""));
  if (!normalized) return null;
  return SUB_TRADE_IDENTIFIER_TO_CODE.get(trade.code)?.get(normalized) ?? null;
}

export function getSharedSubTradeDefinition(
  tradeCode: string | null | undefined,
  subTradeCode: string | null | undefined
): SharedSubTradeDefinition | null {
  const trade = getSharedTradeDefinitionByCode(tradeCode);
  if (!trade) return null;
  const normalized = slugify(String(subTradeCode ?? ""));
  if (!normalized) return null;
  return trade.subTrades.find((subTrade) => subTrade.code === normalized) ?? null;
}

export function getSelectableSharedTasks(
  tradeCode: string | null | undefined,
  subTradeCode: string | null | undefined
): SharedTaskDefinition[] {
  return getSharedSubTradeDefinition(tradeCode, subTradeCode)?.selectableTasks ?? [];
}

export function resolveSharedTaskCode(
  tradeCode: string | null | undefined,
  subTradeCode: string | null | undefined,
  input: string | null | undefined
): string | null {
  const trade = getSharedTradeDefinitionByCode(tradeCode);
  const subTrade = getSharedSubTradeDefinition(tradeCode, subTradeCode);
  if (!trade || !subTrade) return null;
  const normalized = slugify(String(input ?? ""));
  if (!normalized) return null;
  return TASK_IDENTIFIER_TO_CODE.get(trade.code)?.get(subTrade.code)?.get(normalized) ?? null;
}

export function getSharedTaskDefinition(
  tradeCode: string | null | undefined,
  subTradeCode: string | null | undefined,
  taskCode: string | null | undefined
): SharedTaskDefinition | null {
  const subTrade = getSharedSubTradeDefinition(tradeCode, subTradeCode);
  if (!subTrade) return null;
  const normalized = slugify(String(taskCode ?? ""));
  if (!normalized) return null;
  return subTrade.tasks.find((task) => task.code === normalized) ?? null;
}

export function csepKindForTradeLabel(label: string): CsepKind {
  return getSharedTradeDefinitionByLabel(label)?.csepKind ?? "other_common";
}
