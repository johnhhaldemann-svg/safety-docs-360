import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { renderGeneratedCsepDocx } from "../lib/csepDocxRenderer";
import type { GeneratedSafetyPlanDraft } from "../types/safety-intelligence";

function draft(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "Germanton CSEP",
    documentControl: {
      revision: "1.0",
      issueDate: "April 30, 2026",
      preparedBy: "JMMC",
    },
    projectOverview: {
      projectName: "Germanton",
      projectAddress: "4497 gold medal pt.",
      ownerClient: "JMM Health",
      gcCm: "JMMC",
      contractorCompany: "JMMC",
      location: "4497 gold medal pt.",
    },
    operations: [
      {
        operationId: "op-unload",
        tradeLabel: "Structural Steel / Metals",
        subTradeLabel: "Steel erection / decking",
        taskTitle: "Unload steel",
        workAreaLabel: "Steel laydown",
        locationGrid: null,
        equipmentUsed: ["Crane", "Forklift"],
        workConditions: ["Exterior"],
        hazardCategories: ["Struck-by", "Line of fire", "Crane and lift", "Overhead work"],
        permitTriggers: ["Lift plan / pick plan"],
        ppeRequirements: ["Hard hat", "Safety glasses", "High-visibility garment", "Gloves", "Safety-toe boots"],
        requiredControls: ["Controlled laydown route", "Equipment exclusion zone", "Stable dunnage", "Tag lines"],
        siteRestrictions: ["Keep truck routes open for emergency and delivery access."],
        prohibitedEquipment: [],
        conflicts: ["Coordinate deliveries, laydown, and crane swing with adjacent work."],
      },
      {
        operationId: "op-deck",
        tradeLabel: "Structural Steel / Metals",
        subTradeLabel: "Steel erection / decking",
        taskTitle: "Decking install",
        workAreaLabel: "Elevated deck",
        locationGrid: null,
        equipmentUsed: ["Crane", "MEWP", "Welding leads"],
        workConditions: ["Exterior", "Elevated work"],
        hazardCategories: ["Fall exposure", "Dropped objects", "Hot work", "Weather"],
        permitTriggers: ["Hot work permit", "Fall protection / rescue plan"],
        ppeRequirements: ["Fall protection harness", "Welding hood", "Face shield"],
        requiredControls: ["Controlled decking zone", "PFAS", "Drop zone control", "Fire watch", "Wind and lightning review"],
        siteRestrictions: ["Maintain CDZ boundaries and controlled access below."],
        prohibitedEquipment: [],
        conflicts: ["Coordinate deck bundle landings and controlled access with other trades."],
      },
    ],
    ruleSummary: {
      permitTriggers: ["Lift plan / pick plan", "Hot work permit", "Fall protection / rescue plan"],
      ppeRequirements: ["Hard hat", "Safety glasses", "High-visibility garment", "Gloves", "Safety-toe boots", "Fall protection harness"],
      requiredControls: ["Controlled decking zone", "Tag lines", "Fire watch", "Drop zone control"],
      hazardCategories: ["Fall exposure", "Struck-by", "Line of fire", "Hot work", "Crane and lift", "Overhead work"],
      siteRestrictions: ["Maintain controlled access below steel erection and decking work."],
      prohibitedEquipment: [],
      trainingRequirements: ["Qualified rigger", "Signal person", "Hot work training", "Fall protection"],
      weatherRestrictions: ["Stop crane and elevated work when wind or lightning creates unsafe conditions."],
    },
    conflictSummary: {
      total: 1,
      intraDocument: 1,
      external: 0,
      highestSeverity: "medium",
      items: [
        {
          code: "steel-access",
          type: "trade_vs_trade",
          severity: "medium",
          sourceScope: "intra_document",
          rationale: "Steel deliveries, crane swing, and controlled decking zones can conflict with pedestrian and trade access.",
          operationIds: ["op-unload", "op-deck"],
          relatedBucketKeys: ["steel", "site-access"],
          requiredMitigations: ["Sequence deliveries before active picks.", "Maintain exclusion zones below elevated work."],
          permitDependencies: ["Lift plan / pick plan"],
          resequencingSuggestion: "Use staggered access windows around picks and bundle landings.",
        },
      ],
    },
    riskSummary: {
      score: 18,
      band: "high",
      priorities: ["Maintain controlled access below decking.", "Review lift path, weather, and laydown controls before each pick."],
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {
      safetyNarrative: "Structural steel and decking work requires coordinated access, lift planning, fall protection, hot work control, and emergency readiness.",
    },
    sectionMap: [
      {
        key: "purpose",
        title: "Purpose",
        body: "This plan defines how project work will be executed safely on the site.",
      },
      {
        key: "security_and_access",
        title: "Security and Access",
        body: "Project-specific information to be completed.",
      },
      {
        key: "emergency_response_and_rescue",
        title: "Emergency Response and Rescue",
        body: "Project-specific information to be completed.",
      },
    ],
    provenance: {
      generator: "codex-review",
      governingState: "WI",
      jurisdictionLabel: "Wisconsin / Federal OSHA baseline",
      jurisdictionPlanType: "federal",
    },
  };
}

describe("generate fixed CSEP review artifact", () => {
  it("writes a fixed DOCX", async () => {
    const rendered = await renderGeneratedCsepDocx(draft());
    writeFileSync(".codex-docx-review/fixed-csep.docx", rendered.body);
  });
});
