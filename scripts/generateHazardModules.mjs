import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import JSZip from "jszip";

const OUTPUT_FILE = new URL("../lib/hazardModules.generated.ts", import.meta.url);

const HAZARD_MODULES = [
  {
    filename: "01_Fall_Protection.docx",
    moduleKey: "fall_protection",
    title: "Fall Protection",
    matchCriteria: {
      hazardLabels: ["Falls from height"],
      permitLabels: [],
      taskKeywords: ["roof", "edge", "opening", "elevated", "platform", "leading edge"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "02_Ladder_Safety.docx",
    moduleKey: "ladder_safety",
    title: "Ladder Safety",
    matchCriteria: {
      hazardLabels: ["Falls from height", "Ladder misuse"],
      permitLabels: ["Ladder Permit"],
      taskKeywords: ["ladder", "extension ladder", "step ladder", "access ladder"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "03_Scaffolding.docx",
    moduleKey: "scaffolding",
    title: "Scaffolding",
    matchCriteria: {
      hazardLabels: ["Falls from height"],
      permitLabels: [],
      taskKeywords: ["scaffold", "scaffolding"],
      tradeKeywords: ["scaffold", "scaffolding"],
      subTradeKeywords: ["scaffold", "scaffolding"],
    },
  },
  {
    filename: "04_Aerial_Lift_and_MEWP.docx",
    moduleKey: "aerial_lift_and_mewp",
    title: "Aerial Lift and MEWP",
    matchCriteria: {
      hazardLabels: ["Falls from height"],
      permitLabels: ["AWP/MEWP Permit"],
      taskKeywords: ["mewp", "aerial lift", "boom lift", "scissor lift"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "05_Excavation_and_Trenching.docx",
    moduleKey: "excavation_and_trenching",
    title: "Excavation and Trenching",
    matchCriteria: {
      hazardLabels: ["Excavation collapse"],
      permitLabels: ["Ground Disturbance Permit", "Trench Inspection Permit"],
      taskKeywords: ["excavat", "trench", "shoring", "bench", "backfill", "ground disturb"],
      tradeKeywords: ["excavation", "civil", "earthwork", "sitework"],
      subTradeKeywords: ["excavation", "trenching", "earthwork"],
    },
  },
  {
    filename: "06_Underground_Utility_Protection.docx",
    moduleKey: "underground_utility_protection",
    title: "Underground Utility Protection",
    matchCriteria: {
      hazardLabels: ["Excavation collapse", "Pressure / line break"],
      permitLabels: ["Ground Disturbance Permit", "Trench Inspection Permit"],
      taskKeywords: ["utility", "duct bank", "conduit bank", "manhole", "vault", "locator wire", "pipe"],
      tradeKeywords: ["utility", "underground"],
      subTradeKeywords: ["utility", "underground", "pipeline", "piping"],
    },
  },
  {
    filename: "07_Confined_Space.docx",
    moduleKey: "confined_space",
    title: "Confined Space",
    matchCriteria: {
      hazardLabels: ["Confined spaces"],
      permitLabels: ["Confined Space Permit"],
      taskKeywords: ["confined", "vault", "tank", "manhole", "pit", "entry"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "08_Electrical_Safety_and_Temporary_Power.docx",
    moduleKey: "electrical_safety_and_temporary_power",
    title: "Electrical Safety and Temporary Power",
    matchCriteria: {
      hazardLabels: ["Electrical shock"],
      permitLabels: ["LOTO Permit"],
      taskKeywords: ["electrical", "temporary power", "panel", "switchgear", "energ", "conduit", "wire"],
      tradeKeywords: ["electrical"],
      subTradeKeywords: ["electrical", "power", "controls"],
    },
  },
  {
    filename: "09_Lockout_Tagout_and_Hazardous_Energy_Control.docx",
    moduleKey: "lockout_tagout_and_hazardous_energy_control",
    title: "Lockout Tagout and Hazardous Energy Control",
    matchCriteria: {
      hazardLabels: ["Electrical shock", "Pressure / line break"],
      permitLabels: ["LOTO Permit"],
      taskKeywords: ["loto", "lockout", "tagout", "isolation", "energized", "line break", "pressure"],
      tradeKeywords: ["electrical", "mechanical"],
      subTradeKeywords: ["controls", "maintenance", "startup"],
    },
  },
  {
    filename: "10_Hot_Work_Welding_Cutting_Heating.docx",
    moduleKey: "hot_work_welding_cutting_heating",
    title: "Hot Work Welding Cutting Heating",
    matchCriteria: {
      hazardLabels: ["Hot work / fire"],
      permitLabels: ["Hot Work Permit"],
      taskKeywords: ["weld", "cut", "torch", "grind", "braze", "hot work"],
      tradeKeywords: ["welding"],
      subTradeKeywords: ["welding", "fabrication", "metal"],
    },
  },
  {
    filename: "11_Cranes_Rigging_and_Suspended_Loads.docx",
    moduleKey: "cranes_rigging_and_suspended_loads",
    title: "Cranes Rigging and Suspended Loads",
    matchCriteria: {
      hazardLabels: ["Struck by equipment", "Falling objects", "Crane lift hazards"],
      permitLabels: ["Motion Permit"],
      taskKeywords: ["crane", "rigging", "lift", "hoist", "pick", "suspended load", "tag line"],
      tradeKeywords: ["rigging", "crane", "steel"],
      subTradeKeywords: ["rigging", "hoisting", "steel"],
    },
  },
  {
    filename: "12_Material_Handling_Storage_and_Staging.docx",
    moduleKey: "material_handling_storage_and_staging",
    title: "Material Handling Storage and Staging",
    matchCriteria: {
      hazardLabels: ["Falling objects", "Slips trips falls"],
      permitLabels: [],
      taskKeywords: ["staging", "storage", "unloading", "material handling", "laydown", "stockpile"],
      tradeKeywords: ["material"],
      subTradeKeywords: ["staging", "logistics", "material"],
    },
  },
  {
    filename: "13_Forklifts_and_Powered_Industrial_Trucks.docx",
    moduleKey: "forklifts_and_powered_industrial_trucks",
    title: "Forklifts and Powered Industrial Trucks",
    matchCriteria: {
      hazardLabels: ["Struck by equipment"],
      permitLabels: ["Motion Permit"],
      taskKeywords: ["forklift", "pit", "powered industrial truck", "telehandler"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "14_Demolition.docx",
    moduleKey: "demolition",
    title: "Demolition",
    matchCriteria: {
      hazardLabels: ["Silica / dust exposure"],
      permitLabels: [],
      taskKeywords: ["demolition", "demo", "tear-out", "tear out", "removal"],
      tradeKeywords: ["demolition"],
      subTradeKeywords: ["demolition"],
    },
  },
  {
    filename: "15_Steel_Erection.docx",
    moduleKey: "steel_erection",
    title: "Steel Erection",
    matchCriteria: {
      hazardLabels: [],
      permitLabels: [],
      taskKeywords: ["steel", "beam", "column", "decking", "erection", "joist"],
      tradeKeywords: ["steel"],
      subTradeKeywords: ["steel", "erection", "structural"],
    },
  },
  {
    filename: "16_Concrete_and_Masonry_Construction.docx",
    moduleKey: "concrete_and_masonry_construction",
    title: "Concrete and Masonry Construction",
    matchCriteria: {
      hazardLabels: ["Silica / dust exposure"],
      permitLabels: [],
      taskKeywords: ["concrete", "masonry", "grout", "formwork", "rebar", "saw cut"],
      tradeKeywords: ["concrete", "masonry"],
      subTradeKeywords: ["concrete", "masonry", "rebar"],
    },
  },
  {
    filename: "17_Tools_Equipment_and_Temporary_Power.docx",
    moduleKey: "tools_equipment_and_temporary_power",
    title: "Tools Equipment and Temporary Power",
    matchCriteria: {
      hazardLabels: ["Electrical shock"],
      permitLabels: ["LOTO Permit"],
      taskKeywords: ["temporary power", "power tool", "cord", "generator", "tool"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "18_Traffic_Control_Mobile_Equipment_and_Pedestrian_Interface.docx",
    moduleKey: "traffic_control_mobile_equipment_and_pedestrian_interface",
    title: "Traffic Control Mobile Equipment and Pedestrian Interface",
    matchCriteria: {
      hazardLabels: ["Struck by equipment"],
      permitLabels: ["Motion Permit"],
      taskKeywords: ["traffic", "haul route", "pedestrian", "mobile equipment", "flagger", "delivery"],
      tradeKeywords: ["traffic"],
      subTradeKeywords: ["traffic", "site logistics"],
    },
  },
  {
    filename: "19_Hazard_Communication_Silica_Dust_and_Chemical_Exposure.docx",
    moduleKey: "hazard_communication_silica_dust_and_chemical_exposure",
    title: "Hazard Communication Silica Dust and Chemical Exposure",
    matchCriteria: {
      hazardLabels: ["Chemical exposure", "Silica / dust exposure"],
      permitLabels: ["Chemical Permit"],
      taskKeywords: ["silica", "dust", "chemical", "sds", "hazard communication", "solvent", "epoxy"],
      tradeKeywords: ["abatement", "painting"],
      subTradeKeywords: ["coatings", "finishes", "abatement"],
    },
  },
  {
    filename: "20_Fire_Prevention_Housekeeping_and_Emergency_Egress.docx",
    moduleKey: "fire_prevention_housekeeping_and_emergency_egress",
    title: "Fire Prevention Housekeeping and Emergency Egress",
    matchCriteria: {
      hazardLabels: ["Hot work / fire", "Slips trips falls"],
      permitLabels: ["Hot Work Permit"],
      taskKeywords: ["fire", "housekeeping", "egress", "cleanup", "waste", "exit"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "21_Struck_By_Line_of_Fire_and_Dropped_Object_Control.docx",
    moduleKey: "struck_by_line_of_fire_and_dropped_object_control",
    title: "Struck By Line of Fire and Dropped Object Control",
    matchCriteria: {
      hazardLabels: ["Falling objects"],
      permitLabels: ["Motion Permit"],
      taskKeywords: ["line of fire", "dropped object", "suspended load", "overhead"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "22_Caught_In_Between_Pinch_Point_and_Crush_Hazards.docx",
    moduleKey: "caught_in_between_pinch_point_and_crush_hazards",
    title: "Caught In Between Pinch Point and Crush Hazards",
    matchCriteria: {
      hazardLabels: [],
      permitLabels: [],
      taskKeywords: ["pinch", "crush", "caught in between", "caught-between", "squeeze"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
  {
    filename: "23_Personal_Protective_Equipment.docx",
    moduleKey: "personal_protective_equipment",
    title: "Personal Protective Equipment",
    matchCriteria: {
      hazardLabels: ["Chemical exposure"],
      permitLabels: ["Chemical Permit"],
      taskKeywords: ["ppe", "respirator", "hearing protection", "face shield", "gloves", "protective equipment"],
      tradeKeywords: ["ppe"],
      subTradeKeywords: ["ppe"],
    },
  },
  {
    filename: "24_Weather_and_Environmental_Exposure.docx",
    moduleKey: "weather_and_environmental_exposure",
    title: "Weather and Environmental Exposure",
    matchCriteria: {
      hazardLabels: ["Slips trips falls"],
      permitLabels: [],
      taskKeywords: ["weather", "wind", "rain", "heat", "cold", "environmental"],
      tradeKeywords: [],
      subTradeKeywords: [],
    },
  },
];

function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSectionHeadings(text) {
  const headings = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\d+(?:\.\d+)*\s+/.test(trimmed)) {
      headings.push(trimmed);
    }
  }

  return headings;
}

function summarize(text, fallbackTitle) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = lines[1] ?? lines[0] ?? fallbackTitle;

  return summary.length > 240 ? `${summary.slice(0, 237).trim()}...` : summary;
}

async function buildRecord(zip, config) {
  const file = zip.file(config.filename);
  if (!file) {
    throw new Error(`Missing DOCX entry in archive: ${config.filename}`);
  }

  const buffer = await file.async("nodebuffer");
  const result = await mammoth.extractRawText({ buffer });
  const plainText = normalizeText(result.value);

  return {
    moduleKey: config.moduleKey,
    title: config.title,
    plainText,
    sectionHeadings: extractSectionHeadings(plainText),
    summary: summarize(plainText, config.title),
    sourceFilename: config.filename,
    matchCriteria: config.matchCriteria,
  };
}

async function main() {
  const zipPath = process.argv[2];

  if (!zipPath) {
    throw new Error("Usage: node scripts/generateHazardModules.mjs <hazard-elements-zip>");
  }

  const zipBuffer = await fs.readFile(path.resolve(zipPath));
  const zip = await JSZip.loadAsync(zipBuffer);

  const records = [];
  for (const config of HAZARD_MODULES) {
    records.push(await buildRecord(zip, config));
  }

  const source = `/* eslint-disable max-len */
// Auto-generated by scripts/generateHazardModules.mjs

export type GeneratedHazardModule = {
  moduleKey: string;
  title: string;
  plainText: string;
  sectionHeadings: string[];
  summary: string;
  sourceFilename: string;
  matchCriteria: {
    hazardLabels: string[];
    permitLabels: string[];
    taskKeywords: string[];
    tradeKeywords: string[];
    subTradeKeywords: string[];
  };
};

export const HAZARD_MODULES: GeneratedHazardModule[] = ${JSON.stringify(
      records,
      null,
      2
    )} as const;
`;

  await fs.writeFile(OUTPUT_FILE, source, "utf8");
  console.log(`Generated ${records.length} hazard modules into ${OUTPUT_FILE.pathname}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});

