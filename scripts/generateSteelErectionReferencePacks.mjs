import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE_ROOT = "C:/Users/johnh/OneDrive/Desktop/Steel Erection";

const OUTPUT_FILES = {
  hazards: path.join(REPO_ROOT, "lib", "steelErectionHazardModules.generated.ts"),
  tasks: path.join(REPO_ROOT, "lib", "steelErectionTaskModules.generated.ts"),
  programs: path.join(REPO_ROOT, "lib", "steelErectionProgramModules.generated.ts"),
};

const HAZARD_SOURCE_DIR = "02_Hazard_Modules";
const TASK_SOURCE_DIR = "03_Task_Modules";
const PROGRAM_SOURCE_DIR = path.join("04_High_Risk_Programs", "Programs");

const HAZARD_CONFIGS = [
  {
    filename: "Hazard_01_Fall_Exposure.docx",
    moduleKey: "steel_fall_exposure",
    title: "Fall Exposure",
    triggerManifest: {
      hazardLabels: ["Falls from height", "Fall exposure"],
      permitLabels: ["Work at Height", "Fall Protection Rescue Plan"],
      taskKeywords: ["leading edge", "connector", "decking", "opening", "column", "beam"],
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel", "ironwork"],
      highRiskKeywords: ["steel erection / rigging", "ladders / scaffolds / access"],
      assumedTradeKeywords: ["steel erection", "structural steel", "ironwork"],
      exportProgramIds: ["steel_erection", "fall_protection"],
    },
  },
  {
    filename: "Hazard_02_Hoisting_and_Rigging.docx",
    moduleKey: "steel_hoisting_and_rigging",
    title: "Hoisting and Rigging",
    triggerManifest: {
      hazardLabels: ["Crane lift hazards", "Rigging and lifting hazards", "Struck by equipment"],
      permitLabels: ["Motion Permit", "Lift Plan", "Critical Lift Plan"],
      taskKeywords: ["rigging", "hoist", "crane pick", "unload steel", "multiple lift"],
      tradeKeywords: ["steel", "rigging", "ironwork"],
      subTradeKeywords: ["steel erection", "rigging", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "crane / rigging", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "ironwork", "rigging"],
      exportProgramIds: ["steel_erection", "crane_rigging"],
    },
  },
  {
    filename: "Hazard_03_Structural_Instability_and_Collapse.docx",
    moduleKey: "steel_structural_instability_and_collapse",
    title: "Structural Instability and Collapse",
    triggerManifest: {
      hazardLabels: ["Structural instability and collapse", "Falling objects"],
      permitLabels: [],
      taskKeywords: ["temporary bracing", "stability", "plumbing", "beam setting", "column erection"],
      tradeKeywords: ["steel", "structural steel", "ironwork"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "temporary structures", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "structural steel"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Hazard_04_Column_Anchorage.docx",
    moduleKey: "steel_column_anchorage",
    title: "Column Anchorage",
    triggerManifest: {
      hazardLabels: ["Column anchorage", "Structural instability and collapse"],
      permitLabels: [],
      taskKeywords: ["column", "base line", "anchor rod", "anchor bolt", "initial connection"],
      tradeKeywords: ["steel", "structural steel", "ironwork"],
      subTradeKeywords: ["steel erection", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "structural steel"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Hazard_05_Falling_Objects_and_Dropped_Materials.docx",
    moduleKey: "steel_falling_objects_and_dropped_materials",
    title: "Falling Objects and Dropped Materials",
    triggerManifest: {
      hazardLabels: ["Falling objects", "Falling object hazards"],
      permitLabels: ["Gravity Permit"],
      taskKeywords: ["drop zone", "dropped material", "overhead", "decking", "rigging"],
      tradeKeywords: ["steel", "ironwork", "rigging"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "crane / rigging", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "crane_rigging", "fall_protection"],
    },
  },
  {
    filename: "Hazard_06_Pinch_Caught_Between_and_Struck_By.docx",
    moduleKey: "steel_pinch_caught_between_and_struck_by",
    title: "Pinch Caught Between and Struck By",
    triggerManifest: {
      hazardLabels: ["Pinch / caught between and struck by", "Struck by equipment"],
      permitLabels: [],
      taskKeywords: ["connection", "beam setting", "landing steel", "bolting", "pinch"],
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "heavy equipment / spotters"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "crane_rigging"],
    },
  },
  {
    filename: "Hazard_07_Open_Web_Steel_Joists_and_Bridging.docx",
    moduleKey: "steel_open_web_steel_joists_and_bridging",
    title: "Open Web Steel Joists and Bridging",
    triggerManifest: {
      hazardLabels: ["Open web steel joists and bridging", "Falls from height"],
      permitLabels: [],
      taskKeywords: ["joist", "bridging", "open web steel joist"],
      tradeKeywords: ["steel", "joist", "ironwork"],
      subTradeKeywords: ["steel erection", "joist", "decking"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Hazard_08_Environmental_and_Site_Condition.docx",
    moduleKey: "steel_environmental_and_site_condition",
    title: "Environmental and Site Condition",
    triggerManifest: {
      hazardLabels: ["Environmental and site condition", "Falls from height"],
      permitLabels: [],
      taskKeywords: ["weather", "wind", "lightning", "site condition", "visibility"],
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "hazardous waste / environmental release"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
];

const TASK_CONFIGS = [
  {
    filename: "Task_01_Pre_Erection_Planning_and_Site_Readiness.docx",
    moduleKey: "steel_pre_erection_planning_and_site_readiness",
    title: "Pre-Erection Planning and Site Readiness",
    subTrade: "Steel erection / decking",
    taskNames: ["Pre-erection planning", "Site readiness"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      taskNames: ["pre-erection planning", "site readiness"],
      taskKeywords: ["pre erection", "site readiness", "laydown", "crane support", "sequence review"],
      taskAliases: ["site prep for steel", "steel planning", "erection planning"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Task_02_Receiving_Unloading_Inspecting_and_Staging_Steel.docx",
    moduleKey: "steel_receiving_unloading_inspecting_and_staging",
    title: "Receiving, Unloading, Inspecting and Staging Steel",
    subTrade: "Steel erection / decking",
    taskNames: ["Unload steel", "Sort members"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      taskNames: ["unload steel", "sort members"],
      taskKeywords: ["receiving steel", "unloading steel", "laydown", "staging steel"],
      taskAliases: ["receive steel", "stage steel", "inspect steel delivery"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "crane_rigging"],
    },
  },
  {
    filename: "Task_03_Setting_Columns_and_Base_Lines.docx",
    moduleKey: "steel_setting_columns_and_base_lines",
    title: "Setting Columns and Base Lines",
    subTrade: "Steel erection / decking",
    taskNames: ["Column erection"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "ironworker"],
      taskNames: ["column erection"],
      taskKeywords: ["setting columns", "base lines", "anchor rods", "column base"],
      taskAliases: ["set columns", "column setting", "base line layout"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Task_04_Erecting_Beams_and_Girders_Initial_Connections.docx",
    moduleKey: "steel_erecting_beams_and_girders_initial_connections",
    title: "Erecting Beams and Girders, Initial Connections",
    subTrade: "Steel erection / decking",
    taskNames: ["Beam setting", "Bolting"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "ironworker"],
      taskNames: ["beam setting", "bolting"],
      taskKeywords: ["beam", "girder", "initial connection", "first bolt", "setting steel"],
      taskAliases: ["set beams", "initial steel connections"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Task_05_Hoisting_and_Rigging_Multiple_Lift.docx",
    moduleKey: "steel_hoisting_and_rigging_multiple_lift",
    title: "Hoisting and Rigging, Multiple Lift",
    subTrade: "Steel erection / decking",
    taskNames: ["Rigging", "Crane picks"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "rigging"],
      subTradeKeywords: ["steel erection", "ironworker", "rigging"],
      taskNames: ["rigging", "crane picks"],
      taskKeywords: ["multiple lift", "multiple-lift", "hoisting", "rigging", "crane pick"],
      taskAliases: ["multiple lift rigging", "steel picks", "fly steel"],
      pshsepScopeKeywords: ["steel erection", "crane / rigging", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "ironwork", "rigging"],
      exportProgramIds: ["steel_erection", "crane_rigging"],
    },
  },
  {
    filename: "Task_06_Installing_Open_Web_Steel_Joists_and_Bridging.docx",
    moduleKey: "steel_installing_open_web_steel_joists_and_bridging",
    title: "Installing Open Web Steel Joists and Bridging",
    subTrade: "Steel erection / decking",
    taskNames: ["Joist installation"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "joist", "decking"],
      taskNames: ["joist installation"],
      taskKeywords: ["open web steel joist", "joist", "bridging"],
      taskAliases: ["install joists", "joist bridging"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Task_07_Installing_Metal_Decking_and_Controlling_Openings.docx",
    moduleKey: "steel_installing_metal_decking_and_controlling_openings",
    title: "Installing Metal Decking and Controlling Openings",
    subTrade: "Steel erection / decking",
    taskNames: ["Decking install"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      taskNames: ["decking install"],
      taskKeywords: ["metal decking", "decking", "opening control", "controlled decking zone"],
      taskAliases: ["install deck", "deck install", "metal deck"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "ladders / scaffolds / access"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "fall_protection"],
    },
  },
  {
    filename: "Task_08_Plumbing_Temporary_Bracing_and_Final_Bolting.docx",
    moduleKey: "steel_plumbing_temporary_bracing_and_final_bolting",
    title: "Plumbing, Temporary Bracing and Final Bolting",
    subTrade: "Steel erection / decking",
    taskNames: ["Bolting"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "structural steel"],
      subTradeKeywords: ["steel erection", "ironworker"],
      taskNames: ["bolting"],
      taskKeywords: ["temporary bracing", "plumbing", "final bolting", "stability"],
      taskAliases: ["final bolt-up", "steel bracing", "plumb steel"],
      pshsepScopeKeywords: ["steel erection", "temporary structures", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "Task_09_Field_Welding_Cutting_and_Shear_Connectors.docx",
    moduleKey: "steel_field_welding_cutting_and_shear_connectors",
    title: "Field Welding, Cutting and Shear Connectors",
    subTrade: "Steel erection / decking",
    taskNames: ["Welding"],
    triggerManifest: {
      tradeKeywords: ["steel", "ironwork", "welding"],
      subTradeKeywords: ["steel erection", "ironworker", "welding"],
      taskNames: ["welding"],
      taskKeywords: ["field welding", "cutting", "shear connectors", "hot work"],
      taskAliases: ["weld steel", "steel cutting", "stud welding"],
      pshsepScopeKeywords: ["steel erection", "hot work", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "hot work / fire watch"],
      assumedTradeKeywords: ["steel erection", "welding"],
      exportProgramIds: ["steel_erection", "hot_work"],
    },
  },
];

const PROGRAM_CONFIGS = [
  {
    filename: "01_Leading_Edge_and_Connector_Work_Program.docx",
    moduleKey: "steel_leading_edge_and_connector_work_program",
    title: "Leading Edge and Connector Work Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falls from height" }],
      hazardLabels: ["Falls from height"],
      permitLabels: [],
      taskKeywords: ["leading edge", "connector", "decking", "beam", "column"],
      tradeKeywords: ["steel", "ironwork"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "ladders / scaffolds / access"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "fall_protection"],
    },
  },
  {
    filename: "02_Fall_Rescue_and_Suspension_Trauma_Program.docx",
    moduleKey: "steel_fall_rescue_and_suspension_trauma_program",
    title: "Fall Rescue and Suspension Trauma Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falls from height" }],
      hazardLabels: ["Falls from height"],
      permitLabels: ["Fall Protection Rescue Plan"],
      taskKeywords: ["fall rescue", "suspension trauma", "leading edge", "connector"],
      tradeKeywords: ["steel", "ironwork"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "ladders / scaffolds / access"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "fall_protection"],
    },
  },
  {
    filename: "03_Controlled_Decking_Zone_and_Decking_Access_Program.docx",
    moduleKey: "steel_controlled_decking_zone_and_decking_access_program",
    title: "Controlled Decking Zone and Decking Access Program",
    triggerManifest: {
      csepSelections: [
        { category: "hazard", item: "Falls from height" },
        { category: "hazard", item: "Falling objects" },
      ],
      hazardLabels: ["Falls from height", "Falling objects"],
      permitLabels: [],
      taskKeywords: ["controlled decking zone", "decking", "opening control", "deck edge"],
      tradeKeywords: ["steel", "ironwork"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "ladders / scaffolds / access"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "fall_protection"],
    },
  },
  {
    filename: "04_Hoisting_and_Rigging_Program.docx",
    moduleKey: "steel_hoisting_and_rigging_program",
    title: "Hoisting and Rigging Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Crane lift hazards" }],
      hazardLabels: ["Crane lift hazards", "Rigging and lifting hazards"],
      permitLabels: ["Lift Plan", "Critical Lift Plan"],
      taskKeywords: ["hoisting", "rigging", "crane pick", "steel delivery"],
      tradeKeywords: ["steel", "rigging", "ironwork"],
      subTradeKeywords: ["steel erection", "rigging", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "crane / rigging", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "rigging", "ironwork"],
      exportProgramIds: ["steel_erection", "crane_rigging"],
    },
  },
  {
    filename: "05_Multiple_Lift_Rigging_Program.docx",
    moduleKey: "steel_multiple_lift_rigging_program",
    title: "Multiple Lift Rigging Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Crane lift hazards" }],
      hazardLabels: ["Crane lift hazards", "Rigging and lifting hazards"],
      permitLabels: ["Lift Plan", "Critical Lift Plan"],
      taskKeywords: ["multiple lift", "multiple-lift", "rigging", "crane pick"],
      tradeKeywords: ["steel", "rigging", "ironwork"],
      subTradeKeywords: ["steel erection", "rigging", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "crane / rigging", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "rigging", "ironwork"],
      exportProgramIds: ["steel_erection", "crane_rigging"],
    },
  },
  {
    filename: "06_Structural_Stability_and_Temporary_Bracing_Program.docx",
    moduleKey: "steel_structural_stability_and_temporary_bracing_program",
    title: "Structural Stability and Temporary Bracing Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falling objects" }],
      hazardLabels: ["Structural instability and collapse", "Falling objects"],
      permitLabels: [],
      taskKeywords: ["temporary bracing", "stability", "plumbing", "final bolting"],
      tradeKeywords: ["steel", "structural steel", "ironwork"],
      subTradeKeywords: ["steel erection", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "temporary structures", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "structural steel"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "07_Column_Anchorage_and_Initial_Connection_Program.docx",
    moduleKey: "steel_column_anchorage_and_initial_connection_program",
    title: "Column Anchorage and Initial Connection Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falls from height" }],
      hazardLabels: ["Column anchorage", "Falls from height"],
      permitLabels: [],
      taskKeywords: ["column", "anchor rod", "anchor bolt", "initial connection"],
      tradeKeywords: ["steel", "structural steel", "ironwork"],
      subTradeKeywords: ["steel erection", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "08_Open_Web_Joist_and_Bridging_Program.docx",
    moduleKey: "steel_open_web_joist_and_bridging_program",
    title: "Open Web Joist and Bridging Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falls from height" }],
      hazardLabels: ["Open web steel joists and bridging", "Falls from height"],
      permitLabels: [],
      taskKeywords: ["joist", "bridging", "open web steel joist"],
      tradeKeywords: ["steel", "ironwork", "joist"],
      subTradeKeywords: ["steel erection", "joist", "decking"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
    },
  },
  {
    filename: "09_Falling_Objects_and_Drop_Zone_Control_Program.docx",
    moduleKey: "steel_falling_objects_and_drop_zone_control_program",
    title: "Falling Objects and Drop Zone Control Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falling objects" }],
      hazardLabels: ["Falling objects", "Falling object hazards"],
      permitLabels: ["Gravity Permit"],
      taskKeywords: ["drop zone", "dropped material", "overhead", "rigging"],
      tradeKeywords: ["steel", "rigging", "ironwork"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "crane / rigging", "structural steel"],
      highRiskKeywords: ["steel erection / rigging", "crane / hoisting / suspended loads"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection", "crane_rigging", "fall_protection"],
    },
  },
  {
    filename: "10_Weather_Wind_Lightning_and_Site_Condition_Program.docx",
    moduleKey: "steel_weather_wind_lightning_and_site_condition_program",
    title: "Weather, Wind, Lightning and Site Condition Program",
    triggerManifest: {
      csepSelections: [{ category: "hazard", item: "Falls from height" }],
      hazardLabels: ["Environmental and site condition", "Falls from height"],
      permitLabels: [],
      taskKeywords: ["weather", "wind", "lightning", "site condition", "visibility"],
      tradeKeywords: ["steel", "structural steel", "ironwork"],
      subTradeKeywords: ["steel erection", "decking", "ironworker"],
      pshsepScopeKeywords: ["steel erection", "structural steel"],
      highRiskKeywords: ["steel erection / rigging"],
      assumedTradeKeywords: ["steel erection", "ironwork"],
      exportProgramIds: ["steel_erection"],
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
    if (/^\d+(?:\.\d+)*(?:\.)?\s+/.test(trimmed)) {
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

async function readRecord(sourceRoot, relativeDir, config) {
  const sourcePath = path.join(sourceRoot, relativeDir, config.filename);
  const result = await mammoth.extractRawText({ path: sourcePath });
  const plainText = normalizeText(result.value);

  return {
    moduleKey: config.moduleKey,
    title: config.title,
    ...(config.subTrade ? { trade: "Steel Erection", subTrade: config.subTrade } : {}),
    ...(config.taskNames ? { taskNames: config.taskNames } : {}),
    plainText,
    sectionHeadings: extractSectionHeadings(plainText),
    summary: summarize(plainText, config.title),
    sourceFilename: config.filename,
    triggerManifest: config.triggerManifest,
  };
}

function renderSource(typeName, constName, records) {
  return `/* eslint-disable max-len */
// Auto-generated by scripts/generateSteelErectionReferencePacks.mjs

export type ${typeName} = ${JSON.stringify(records, null, 2)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/"/g, "\"")
    .replace(/\n/g, "\n")};

export const ${constName}: ${typeName}[] = ${JSON.stringify(records, null, 2)} as const;
`;
}

function renderHazardSource(records) {
  return `/* eslint-disable max-len */
// Auto-generated by scripts/generateSteelErectionReferencePacks.mjs

export type GeneratedSteelErectionHazardModule = {
  moduleKey: string;
  title: string;
  plainText: string;
  sectionHeadings: string[];
  summary: string;
  sourceFilename: string;
  triggerManifest: {
    hazardLabels: string[];
    permitLabels: string[];
    taskKeywords: string[];
    tradeKeywords: string[];
    subTradeKeywords: string[];
    pshsepScopeKeywords: string[];
    highRiskKeywords: string[];
    assumedTradeKeywords: string[];
    exportProgramIds: string[];
  };
};

export const STEEL_ERECTION_HAZARD_MODULES: GeneratedSteelErectionHazardModule[] = ${JSON.stringify(
    records,
    null,
    2
  )} as const;
`;
}

function renderTaskSource(records) {
  return `/* eslint-disable max-len */
// Auto-generated by scripts/generateSteelErectionReferencePacks.mjs

export type GeneratedSteelErectionTaskModule = {
  moduleKey: string;
  title: string;
  trade: string;
  subTrade: string;
  taskNames: string[];
  plainText: string;
  sectionHeadings: string[];
  summary: string;
  sourceFilename: string;
  triggerManifest: {
    tradeKeywords: string[];
    subTradeKeywords: string[];
    taskNames: string[];
    taskKeywords: string[];
    taskAliases: string[];
    pshsepScopeKeywords: string[];
    highRiskKeywords: string[];
    assumedTradeKeywords: string[];
    exportProgramIds: string[];
  };
};

export const STEEL_ERECTION_TASK_MODULES: GeneratedSteelErectionTaskModule[] = ${JSON.stringify(
    records,
    null,
    2
  )} as const;
`;
}

function renderProgramSource(records) {
  return `/* eslint-disable max-len */
// Auto-generated by scripts/generateSteelErectionReferencePacks.mjs

export type GeneratedSteelErectionProgramModule = {
  moduleKey: string;
  title: string;
  plainText: string;
  sectionHeadings: string[];
  summary: string;
  sourceFilename: string;
  triggerManifest: {
    csepSelections: Array<{ category: "hazard" | "permit" | "ppe"; item: string }>;
    hazardLabels: string[];
    permitLabels: string[];
    taskKeywords: string[];
    tradeKeywords: string[];
    subTradeKeywords: string[];
    pshsepScopeKeywords: string[];
    highRiskKeywords: string[];
    assumedTradeKeywords: string[];
    exportProgramIds: string[];
  };
};

export const STEEL_ERECTION_PROGRAM_MODULES: GeneratedSteelErectionProgramModule[] = ${JSON.stringify(
    records,
    null,
    2
  )} as const;
`;
}

async function main() {
  const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE_ROOT;

  const [hazards, tasks, programs] = await Promise.all([
    Promise.all(HAZARD_CONFIGS.map((config) => readRecord(sourceRoot, HAZARD_SOURCE_DIR, config))),
    Promise.all(TASK_CONFIGS.map((config) => readRecord(sourceRoot, TASK_SOURCE_DIR, config))),
    Promise.all(PROGRAM_CONFIGS.map((config) => readRecord(sourceRoot, PROGRAM_SOURCE_DIR, config))),
  ]);

  await Promise.all([
    fs.writeFile(OUTPUT_FILES.hazards, renderHazardSource(hazards), "utf8"),
    fs.writeFile(OUTPUT_FILES.tasks, renderTaskSource(tasks), "utf8"),
    fs.writeFile(OUTPUT_FILES.programs, renderProgramSource(programs), "utf8"),
  ]);

  console.log(
    `Generated ${hazards.length} steel hazard modules, ${tasks.length} steel task modules, and ${programs.length} steel program modules.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

