import type {
  AiReviewContext,
  ConflictMatrix,
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
  JsonObject,
  RiskBand,
  SafetyPlanGenerationContext,
} from "@/types/safety-intelligence";
import { buildCsepProgramSections } from "@/lib/csepPrograms";

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function bandFromScore(score: number): RiskBand {
  if (score >= 30) return "critical";
  if (score >= 20) return "high";
  if (score >= 10) return "moderate";
  return "low";
}

function sentenceList(values: string[], empty = "None identified.") {
  return values.length ? values.join(", ") : empty;
}

function paragraph(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

type DraftParams = {
  generationContext: SafetyPlanGenerationContext;
  reviewContext: AiReviewContext;
  conflictMatrix: ConflictMatrix;
  narrativeSections?: Record<string, string>;
  riskMemorySummary?: JsonObject | null;
};

export function buildFallbackNarratives(params: DraftParams) {
  const trades = dedupe(
    params.generationContext.operations.map(
      (operation) => operation.tradeLabel ?? operation.tradeCode ?? "Unspecified trade"
    )
  );
  const controls = dedupe(
    params.reviewContext.rulesEvaluations.flatMap((row) => row.requiredControls)
  );
  const conflictCount = params.conflictMatrix.items.length;
  const siteRestrictions = dedupe(
    params.reviewContext.rulesEvaluations.flatMap((row) => row.siteRestrictions)
  );

  return {
    tradeBreakdownSummary: `Active work covers ${trades.join(", ")} with controls aligned to the current scope, equipment, and site conditions.`,
    riskPrioritySummary: `The highest priorities are enforcing ${sentenceList(
      controls.slice(0, 5),
      "required controls"
    )} while managing ${conflictCount} simultaneous-operation conflict(s).`,
    requiredControlsSummary: `Required controls are driven by the rules engine before AI drafting and must be verified in the field before work starts.`,
    safetyNarrative: `This ${params.generationContext.documentProfile.documentType.toUpperCase()} is assembled from normalized project scope, deterministic rules, and conflict detection. Current planning emphasizes ${sentenceList(
      controls.slice(0, 4),
      "site controls"
    )}. ${
      conflictCount > 0
        ? `Simultaneous-operation risks require active coordination across crews.`
        : `No active simultaneous-operation conflicts were identified in the current planning set.`
    } ${
      siteRestrictions.length
        ? `Site restrictions in force include ${sentenceList(siteRestrictions)}.`
        : ""
    }`.trim(),
  };
}

export function buildGeneratedSafetyPlanDraft(params: DraftParams): GeneratedSafetyPlanDraft {
  const fallbackNarratives = buildFallbackNarratives(params);
  const narrativeSections = {
    ...fallbackNarratives,
    ...(params.narrativeSections ?? {}),
  };
  const projectName = params.generationContext.project.projectName || "Project";
  const operations = params.generationContext.operations.map((operation) => {
    const bucket = params.reviewContext.buckets.find(
      (row) => row.operationId === operation.operationId
    );
    const rules = params.reviewContext.rulesEvaluations.find(
      (row) =>
        row.operationId === operation.operationId ||
        row.bucketKey === bucket?.bucketKey
    );
    const conflicts = params.conflictMatrix.items.filter((item) =>
      item.operationIds.includes(operation.operationId)
    );

    return {
      operationId: operation.operationId,
      tradeCode: operation.tradeCode ?? null,
      tradeLabel: operation.tradeLabel ?? operation.tradeCode ?? null,
      subTradeCode: operation.subTradeCode ?? null,
      subTradeLabel: operation.subTradeLabel ?? operation.subTradeCode ?? null,
      taskTitle: operation.taskTitle,
      workAreaLabel: operation.workAreaLabel ?? null,
      locationGrid: operation.locationGrid ?? null,
      equipmentUsed: dedupe(bucket?.equipmentUsed ?? operation.equipmentUsed),
      workConditions: dedupe(bucket?.workConditions ?? operation.workConditions),
      hazardCategories: dedupe(rules?.hazardCategories ?? []),
      permitTriggers: dedupe((rules?.permitTriggers ?? []).filter((item) => item !== "none")),
      ppeRequirements: dedupe(rules?.ppeRequirements ?? []),
      requiredControls: dedupe(rules?.requiredControls ?? []),
      siteRestrictions: dedupe(rules?.siteRestrictions ?? []),
      prohibitedEquipment: dedupe(rules?.prohibitedEquipment ?? []),
      conflicts: dedupe(conflicts.map((item) => item.rationale)),
    };
  });

  const ruleSummary = {
    permitTriggers: dedupe(
      params.reviewContext.rulesEvaluations.flatMap((row) =>
        row.permitTriggers.filter((item) => item !== "none")
      )
    ),
    ppeRequirements: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.ppeRequirements)),
    requiredControls: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.requiredControls)),
    hazardCategories: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.hazardCategories)),
    siteRestrictions: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.siteRestrictions)),
    prohibitedEquipment: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.prohibitedEquipment)),
    trainingRequirements: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.trainingRequirements)),
    weatherRestrictions: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.weatherRestrictions)),
  };

  const highestSeverity = params.conflictMatrix.items.reduce<GeneratedSafetyPlanDraft["conflictSummary"]["highestSeverity"]>(
    (current, item) => {
      const ranking = ["none", "low", "medium", "high", "critical"];
      return ranking.indexOf(item.severity) > ranking.indexOf(current) ? item.severity : current;
    },
    "none"
  );

  const riskScore =
    params.reviewContext.rulesEvaluations.reduce((sum, row) => sum + row.score, 0) +
    params.conflictMatrix.score;
  const riskSummary = {
    score: riskScore,
    band: bandFromScore(riskScore),
    priorities: dedupe([
      ...params.conflictMatrix.items
        .filter((item) => item.severity === "critical" || item.severity === "high")
        .map((item) => item.rationale),
      ...ruleSummary.siteRestrictions,
      ...ruleSummary.prohibitedEquipment.map((item) => `${item.replace(/_/g, " ")} prohibited`),
    ]).slice(0, 8),
  };

  const sections: GeneratedSafetyPlanSection[] = [
    {
      key: "project_overview",
      title: "Project Overview",
      body: `Project ${projectName} covers ${sentenceList(params.generationContext.scope.trades, "defined trades")} at ${paragraph(
        params.generationContext.project.projectAddress,
        "the specified location"
      )}.`,
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Project Name", projectName],
          ["Project Number", params.generationContext.project.projectNumber ?? "N/A"],
          ["Location", params.generationContext.project.projectAddress ?? "N/A"],
          ["Owner / Client", params.generationContext.project.ownerClient ?? "N/A"],
          ["GC / CM", params.generationContext.project.gcCm ?? "N/A"],
          ["Contractor", params.generationContext.project.contractorCompany ?? "N/A"],
        ],
      },
    },
    {
      key: "trade_risk_breakdown",
      title: "Trade-Based Risk Breakdown",
      body: narrativeSections.tradeBreakdownSummary,
      table: {
        columns: ["Trade", "Tasks", "Hazards", "Permits"],
        rows: operations.map((operation) => [
          operation.tradeLabel ?? operation.tradeCode ?? "N/A",
          operation.taskTitle,
          sentenceList(operation.hazardCategories),
          sentenceList(operation.permitTriggers, "None"),
        ]),
      },
    },
    {
      key: "task_hazard_analysis",
      title: "Task-Level Hazard Analysis",
      table: {
        columns: ["Task", "Hazards", "Controls", "PPE"],
        rows: operations.map((operation) => [
          operation.taskTitle,
          sentenceList(operation.hazardCategories),
          sentenceList(operation.requiredControls),
          sentenceList(operation.ppeRequirements),
        ]),
      },
    },
    {
      key: "permit_matrix",
      title: "Permit Matrix",
      table: {
        columns: ["Task", "Permits", "Site Restrictions"],
        rows: operations.map((operation) => [
          operation.taskTitle,
          sentenceList(operation.permitTriggers, "None"),
          sentenceList(operation.siteRestrictions, "None"),
        ]),
      },
    },
    {
      key: "simultaneous_operations",
      title: "Simultaneous Operations & Trade Interaction Risks",
      body: params.conflictMatrix.items.length
        ? `The conflict engine identified ${params.conflictMatrix.items.length} trade-interaction risk(s) that must be coordinated before work starts.`
        : "No simultaneous-operation conflicts were identified in the current planning set.",
      table: {
        columns: ["Severity", "Type", "Scope", "Required Mitigations"],
        rows: params.conflictMatrix.items.length
          ? params.conflictMatrix.items.map((item) => [
              item.severity,
              item.type.replace(/_/g, " "),
              item.sourceScope.replace(/_/g, " "),
              sentenceList(item.requiredMitigations),
            ])
          : [["none", "none", "none", "No simultaneous-operation conflicts identified."]],
      },
    },
    {
      key: "equipment_conditions",
      title: "Equipment & Work Condition Risks",
      bullets: operations.flatMap((operation) => {
        const equipment = operation.equipmentUsed.length
          ? `Equipment: ${operation.equipmentUsed.join(", ")}.`
          : "Equipment: not specified.";
        const conditions = operation.workConditions.length
          ? `Conditions: ${operation.workConditions.join(", ")}.`
          : "Conditions: no additional work conditions listed.";
        return [`${operation.taskTitle}: ${equipment} ${conditions}`];
      }),
    },
    {
      key: "weather_integration",
      title: "Weather Risk Integration",
      body: params.generationContext.siteContext.weather?.summary
        ? params.generationContext.siteContext.weather.summary
        : paragraph(
            ruleSummary.weatherRestrictions.length
              ? `Weather-sensitive restrictions apply: ${ruleSummary.weatherRestrictions.join(", ")}.`
              : null,
            "No project-specific weather restriction has been recorded in the current planning set."
          ),
      bullets: ruleSummary.weatherRestrictions,
    },
    {
      key: "required_controls",
      title: "Required Controls & Mitigation Measures",
      body: narrativeSections.requiredControlsSummary,
      table: {
        columns: ["Control Type", "Requirements"],
        rows: [
          ["Required Controls", sentenceList(ruleSummary.requiredControls)],
          ["PPE", sentenceList(ruleSummary.ppeRequirements)],
          ["Training", sentenceList(ruleSummary.trainingRequirements)],
          ["Prohibited Equipment", sentenceList(ruleSummary.prohibitedEquipment, "None")],
        ],
      },
    },
    ...buildCsepProgramSections(params.generationContext.programSelections ?? []).map((section) => ({
      key: section.key,
      title: section.title,
      summary: section.summary,
      subsections: section.subsections,
    })),
    {
      key: "risk_priority_summary",
      title: "Risk Priority Summary",
      body: narrativeSections.riskPrioritySummary,
      bullets: riskSummary.priorities.length ? riskSummary.priorities : ["No elevated priorities were identified."],
    },
    {
      key: "safety_narrative",
      title: "Safety Narrative",
      body: narrativeSections.safetyNarrative,
    },
  ];

  return {
    documentType: params.generationContext.documentProfile.documentType,
    title:
      params.generationContext.documentProfile.title ??
      `${projectName} ${params.generationContext.documentProfile.documentType.toUpperCase()}`,
    projectOverview: {
      projectName,
      projectNumber: params.generationContext.project.projectNumber ?? null,
      projectAddress: params.generationContext.project.projectAddress ?? null,
      ownerClient: params.generationContext.project.ownerClient ?? null,
      gcCm: params.generationContext.project.gcCm ?? null,
      contractorCompany: params.generationContext.project.contractorCompany ?? null,
      schedule: params.generationContext.scope.schedule?.label ?? null,
      location: params.generationContext.siteContext.location ?? null,
    },
    operations,
    ruleSummary,
    conflictSummary: {
      total: params.conflictMatrix.items.length,
      intraDocument: params.conflictMatrix.intraDocumentConflictCount,
      external: params.conflictMatrix.externalConflictCount,
      highestSeverity,
      items: params.conflictMatrix.items,
    },
    riskSummary,
    narrativeSections,
    sectionMap: sections,
    provenance: {
      generator: "safety_plan_deterministic_assembler",
      documentType: params.generationContext.documentProfile.documentType,
      projectName,
      bucketCount: params.reviewContext.buckets.length,
      rulesCount: params.reviewContext.rulesEvaluations.length,
      conflictCount: params.conflictMatrix.items.length,
      riskMemorySummary: params.riskMemorySummary ?? null,
    },
  };
}
