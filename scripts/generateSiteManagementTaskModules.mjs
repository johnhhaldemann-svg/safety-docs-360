import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

const SOURCE_DIR =
  "C:/Users/johnh/OneDrive/Desktop/360/Task Elements/General Conditions.Site Management";
const OUTPUT_FILE =
  "C:/Users/johnh/OneDrive/Desktop/safety_docs_360/lib/siteManagementTaskModules.generated.ts";

const TRADE = "General Conditions / Site Management";

const MODULES = [
  {
    filename: "Access Control.docx",
    moduleKey: "access_control",
    title: "Access Control",
    subTrade: "Site supervision",
    taskNames: ["Access control", "Site setup"],
  },
  {
    filename: "Barricades.docx",
    moduleKey: "barricades",
    title: "Barricades",
    subTrade: "Site supervision",
    taskNames: ["Barricades", "Site setup"],
  },
  {
    filename: "closeout_support.docx",
    moduleKey: "closeout_support",
    title: "Closeout Support",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Closeout support", "Site setup"],
  },
  {
    filename: "Deliveries.docx",
    moduleKey: "deliveries",
    title: "Deliveries",
    subTrade: "Site supervision",
    taskNames: ["Deliveries", "Site setup"],
  },
  {
    filename: "Fencing.docx",
    moduleKey: "fencing",
    title: "Fencing",
    subTrade: "Site supervision",
    taskNames: ["Fencing", "Site setup"],
  },
  {
    filename: "Hazard Assessment.docx",
    moduleKey: "hazard_assessment",
    title: "Hazard Assessment",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Hazard assessment", "Site setup"],
  },
  {
    filename: "Housekeeping.docx",
    moduleKey: "housekeeping",
    title: "Housekeeping",
    subTrade: "Site supervision",
    taskNames: ["Housekeeping", "Site setup"],
  },
  {
    filename: "laborer_coordination.docx",
    moduleKey: "laborer_coordination",
    title: "Laborer Coordination",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Laborer coordination", "Site setup"],
  },
  {
    filename: "Layout Coordination.docx",
    moduleKey: "layout_coordination",
    title: "Layout Coordination",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Layout coordination", "Site setup"],
  },
  {
    filename: "Material Management.docx",
    moduleKey: "material_management",
    title: "Material Management",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Material management", "Site setup"],
  },
  {
    filename: "Permit Review.docx",
    moduleKey: "permit_review",
    title: "Permit Review",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Permit review", "Site setup"],
  },
  {
    filename: "Pre-Task Plan.docx",
    moduleKey: "pre_task_plan",
    title: "Pre-Task Plan",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Pre-task plan", "Site setup"],
  },
  {
    filename: "quality_walkdowns.docx",
    moduleKey: "quality_walkdowns",
    title: "Quality Walkdowns",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Quality walkdowns", "Site setup"],
  },
  {
    filename: "Signage.docx",
    moduleKey: "signage",
    title: "Signage",
    subTrade: "Site supervision",
    taskNames: ["Signage", "Site setup"],
  },
  {
    filename: "Site Setup.docx",
    moduleKey: "site_setup",
    title: "Site Setup",
    subTrade: "Site supervision",
    taskNames: ["Site setup"],
  },
  {
    filename: "site_logistics_planning.docx",
    moduleKey: "site_logistics_planning",
    title: "Site Logistics Planning",
    subTrade: "Safety / quality / logistics",
    taskNames: ["Site logistics planning", "Site setup"],
  },
  {
    filename: "Staging.docx",
    moduleKey: "staging",
    title: "Staging",
    subTrade: "Site supervision",
    taskNames: ["Staging", "Site setup"],
  },
  {
    filename: "Traffic Control.docx",
    moduleKey: "traffic_control",
    title: "Traffic Control",
    subTrade: "Site supervision",
    taskNames: ["Traffic control", "Site setup"],
  },
  {
    filename: "Waste Handling.docx",
    moduleKey: "waste_handling",
    title: "Waste Handling",
    subTrade: "Site supervision",
    taskNames: ["Waste handling", "Site setup"],
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

async function buildRecord(config) {
  const sourcePath = path.join(SOURCE_DIR, config.filename);
  const result = await mammoth.extractRawText({ path: sourcePath });
  const plainText = normalizeText(result.value);

  return {
    moduleKey: config.moduleKey,
    title: config.title,
    trade: TRADE,
    subTrade: config.subTrade,
    taskNames: config.taskNames,
    plainText,
    sectionHeadings: extractSectionHeadings(plainText),
    summary: summarize(plainText, config.title),
    sourceFilename: config.filename,
  };
}

async function main() {
  const records = [];

  for (const config of MODULES) {
    records.push(await buildRecord(config));
  }

  const source = `/* eslint-disable max-len */
// Auto-generated by scripts/generateSiteManagementTaskModules.mjs

export type GeneratedSiteManagementTaskModule = {
  moduleKey: string;
  title: string;
  trade: string;
  subTrade: string;
  taskNames: string[];
  plainText: string;
  sectionHeadings: string[];
  summary: string;
  sourceFilename: string;
};

export const SITE_MANAGEMENT_TASK_MODULES: GeneratedSiteManagementTaskModule[] = ${JSON.stringify(
    records,
    null,
    2
  )} as const;
`;

  await fs.writeFile(OUTPUT_FILE, source, "utf8");
  console.log(`Generated ${records.length} task modules into ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

