import type {
  AiReviewContext,
  CsepAiAssemblyDecisions,
  ConflictMatrix,
  GeneratedSafetyPlanDraft,
  GeneratedSafetyPlanSection,
  JsonObject,
  RiskBand,
  SafetyPlanGenerationContext,
  SafetyPlanTrainingProgram,
} from "@/types/safety-intelligence";
import {
  CSEP_BUILDER_BLOCK_TITLES,
  getCsepFormatDefinition,
  normalizeSelectedCsepBlockKeys,
} from "@/lib/csepBuilder";
import { buildCsepProgramSections } from "@/lib/csepPrograms";
import { getHazardModules } from "@/lib/hazardModules";
import {
  applyJurisdictionStandardsToCsep,
  applyJurisdictionStandardsToPeshep,
} from "@/lib/jurisdictionStandards/apply";
import { buildRiskItem } from "@/lib/csepTradeSelection";
import { getSiteManagementTaskModules } from "@/lib/siteManagementTaskModules";
import { SITE_SAFETY_BLUEPRINT_TITLE } from "@/lib/safetyBlueprintLabels";
import {
  cleanFinalText,
  normalizeHazardList,
  normalizePermitList,
  normalizePpeList,
  normalizeTaskList,
  splitScopeTasksAndInterfaces,
} from "@/lib/csepFinalization";
import {
  buildSteelCommonOverlappingTradesSubsections,
  buildSteelErectionOverlaySections,
  buildSteelErectionPlan,
  hasSteelErectionScope,
  isSteelErectionPackage,
  STEEL_OVERLAP_TRADES_CSEP_INTRO,
} from "@/lib/steelErectionPlan";
import { getSteelErectionHazardModules } from "@/lib/steelErectionHazardModules";
import { getSteelErectionProgramModules } from "@/lib/steelErectionProgramModules";
import { getSteelErectionTaskModules } from "@/lib/steelErectionTaskModules";
import {
  getTradeConflictProfile,
  projectDeliveryTypeLabel,
} from "@/lib/tradeConflictCatalog";
import type {
  CsepBuilderBlockKey,
  CsepBuilderInstructions,
  CsepFormatSectionKey,
} from "@/types/csep-builder";
import type { CSEPProgramDefinition } from "@/types/csep-programs";
import type { JurisdictionStandardsConfig } from "@/types/jurisdiction-standards";

function dedupe(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const cleaned = cleanFinalText(value);
    if (!cleaned) continue;
    const token = cleaned.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(cleaned);
  }

  return out;
}

const DEFAULT_CSEP_WORK_ATTIRE_BULLETS = [
  "Wear shirts with sleeves; do not work in tank tops, sleeveless shirts, or other apparel that does not protect the upper body in a construction environment.",
  "Wear durable work pants; shorts and non-work footwear are not acceptable unless the project owner or site rules explicitly authorize them for defined conditions.",
  "Work clothing must be suitable for construction activity and may not be loose, torn, or unsafe in ways that add caught-in, snag, trip, or entanglement risk.",
];

/** Normalized PPE list with a final task-dependent fall-protection line when not already present. */
function buildCsepPpeBulletList(
  ppeInput: string[],
  rulePpe: string[]
): string[] {
  const base = dedupe(
    normalizePpeList(ppeInput.length > 0 ? ppeInput : rulePpe)
  );
  if (base.length === 0) {
    return [];
  }
  const withFall = [...base];
  const hasFall = withFall.some((item) =>
    /fall\s*protection|harness|lanyard|arrest|tie[-\s]?off/i.test(item)
  );
  if (!hasFall) {
    withFall.push(
      "Fall protection (e.g., harness, lanyard, anchorage) when the task, exposure, or site rules require it"
    );
  }
  return withFall;
}

/** IIPP: always show a PPE block; fall back to a site minimum if the builder has no PPE selected. */
function buildCsepIippPpeBullets(
  ppeInput: string[],
  rulePpe: string[]
): string[] {
  const fromProject = buildCsepPpeBulletList(ppeInput, rulePpe);
  if (fromProject.length > 0) {
    return fromProject;
  }
  return buildCsepPpeBulletList(
    [
      "Hard hat",
      "Safety glasses or approved eye protection",
      "Gloves",
      "High-visibility vest",
      "Protective footwear",
      "Hearing protection",
    ],
    []
  );
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

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function appendInlineOsha(body: string | null | undefined, refs: string[]) {
  if (!refs.length) return body ?? null;
  const suffix = `Applicable OSHA references: ${refs.join(", ")}.`;
  return body?.trim() ? `${body.trim()} ${suffix}` : suffix;
}

type GeneratedSafetyPlanSubsection = NonNullable<GeneratedSafetyPlanSection["subsections"]>[number];
type DraftOperation = GeneratedSafetyPlanDraft["operations"][number];
type GroupedTradePackage = {
  key: string;
  tradeLabel: string;
  subTradeLabel: string | null;
  label: string;
  taskTitles: string[];
  hazardCategories: string[];
  permitTriggers: string[];
  requiredControls: string[];
  ppeRequirements: string[];
  siteRestrictions: string[];
  locationLabels: string[];
  equipmentUsed: string[];
  workConditions: string[];
  conflicts: string[];
};

const INLINE_OSHA_SUFFIX_PATTERN = /\s*Applicable OSHA references:\s*.+\.\s*$/i;
const CSEP_SOFT_PAGE_BUDGET_UNITS = 42_000;
const CSEP_COMPACTABLE_KEYS = new Set([
  "trade_summary",
  "scope_of_work",
  "site_specific_notes",
  "emergency_procedures",
  "required_ppe",
  "selected_hazards",
  "risk_priority_summary",
  "safety_narrative",
]);
const CSEP_REFERENCE_PACK_KEYS = new Set([
  "task_modules_reference",
  "hazard_modules_reference",
  "steel_task_modules_reference",
  "steel_hazard_modules_reference",
  "steel_program_modules_reference",
]);

const CSEP_REFERENCE_PACK_BODY_COMPACT = 400;

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tradePackageLabelForOperation(operation: DraftOperation) {
  const tradeLabel = operation.tradeLabel ?? operation.tradeCode ?? "Unassigned Trade";
  const subTradeLabel = operation.subTradeLabel ?? operation.subTradeCode ?? null;

  return {
    tradeLabel,
    subTradeLabel,
    label: subTradeLabel ? `${tradeLabel} / ${subTradeLabel}` : tradeLabel,
  };
}

function locationLabelForOperation(operation: DraftOperation) {
  const parts = [
    operation.workAreaLabel?.trim(),
    operation.locationGrid?.trim() ? `Grid ${operation.locationGrid.trim()}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(" | ") : null;
}

function groupOperationsByTradePackage(operations: DraftOperation[]) {
  const grouped: GroupedTradePackage[] = [];
  const indexByKey = new Map<string, number>();

  for (const operation of operations) {
    const packageLabel = tradePackageLabelForOperation(operation);
    const key = [normalizeToken(packageLabel.tradeLabel), normalizeToken(packageLabel.subTradeLabel)]
      .filter(Boolean)
      .join("__");
    const existingIndex = indexByKey.get(key);
    const locationLabel = locationLabelForOperation(operation);

    if (existingIndex === undefined) {
      indexByKey.set(key, grouped.length);
      grouped.push({
        key,
        tradeLabel: packageLabel.tradeLabel,
        subTradeLabel: packageLabel.subTradeLabel,
        label: packageLabel.label,
        taskTitles: dedupe([operation.taskTitle]),
        hazardCategories: dedupe(operation.hazardCategories),
        permitTriggers: dedupe(operation.permitTriggers),
        requiredControls: dedupe(operation.requiredControls),
        ppeRequirements: dedupe(operation.ppeRequirements),
        siteRestrictions: dedupe(operation.siteRestrictions),
        locationLabels: dedupe(locationLabel ? [locationLabel] : []),
        equipmentUsed: dedupe(operation.equipmentUsed),
        workConditions: dedupe(operation.workConditions),
        conflicts: dedupe(operation.conflicts),
      });
      continue;
    }

    const current = grouped[existingIndex];
    grouped[existingIndex] = {
      ...current,
      taskTitles: dedupe([...current.taskTitles, operation.taskTitle]),
      hazardCategories: dedupe([...current.hazardCategories, ...operation.hazardCategories]),
      permitTriggers: dedupe([...current.permitTriggers, ...operation.permitTriggers]),
      requiredControls: dedupe([...current.requiredControls, ...operation.requiredControls]),
      ppeRequirements: dedupe([...current.ppeRequirements, ...operation.ppeRequirements]),
      siteRestrictions: dedupe([...current.siteRestrictions, ...operation.siteRestrictions]),
      locationLabels: dedupe([
        ...current.locationLabels,
        ...(locationLabel ? [locationLabel] : []),
      ]),
      equipmentUsed: dedupe([...current.equipmentUsed, ...operation.equipmentUsed]),
      workConditions: dedupe([...current.workConditions, ...operation.workConditions]),
      conflicts: dedupe([...current.conflicts, ...operation.conflicts]),
    };
  }

  return grouped;
}

function augmentCsepActivityMatrixByTaskName(
  taskTitle: string,
  risk: { hazard: string; controls: string[]; permit: string },
  base: { hazards: string[]; controls: string[] }
) {
  const t = normalizeToken(taskTitle);
  const extraH: string[] = [];
  const extraC: string[] = [];
  if (t.includes("cable") && t.includes("pull")) {
    extraH.push("Cable tension, jam, and path-of-travel coordination during the pull");
    extraC.push("Verify pull path; keep communication with the pull operator; stop on bind, overload, or loss of control");
  }
  if (t.includes("isolation") && (t.includes("walk") || t.includes("verify") || t.includes("lock"))) {
    extraH.push("Unverified energy state and unexpected re-energization at the isolation boundary");
    extraC.push("LOTO / isolation list; test-before-touch; control boundaries and signage to the de-energized zone");
  }
  if (t.includes("cleanup") || (t.includes("housekeep") && t.includes("laydown"))) {
    extraH.push("Struck-by mobile equipment, slips, trips, and manual handling in active yard traffic");
    extraC.push("Segregate people from equipment paths; use spotters when equipment moves; maintain clear egress");
  }
  return {
    hazards: dedupe([...base.hazards, ...extraH]),
    controls: dedupe([...base.controls, ...extraC]),
  };
}

function competencyListForCsepActivityMatrix(
  taskTitle: string,
  risk: { hazard: string },
  trainingRequirements: string[]
) {
  const t = normalizeToken(taskTitle);
  const parts: string[] = [];
  if (t.includes("crane") || t.includes("rigg") || t.includes("pick") || t.includes("hoist") || t.includes("signal")) {
    parts.push("Qualified rigger; qualified signal person when hoisting or critical picks apply");
  }
  if (t.includes("weld") || t.includes("torch") || risk.hazard === "Hot work / fire") {
    parts.push("Fire watch; qualified welder to applicable WPS / procedure when required");
  }
  if (t.includes("electr") || t.includes("arc") || risk.hazard === "Electrical shock") {
    parts.push("Qualified electrical worker; LOTO-authorized where isolation applies");
  }
  if (t.includes("cleanup") || t.includes("housekeep")) {
    parts.push("Supervision brief on active equipment, laydown rules, and spotter use");
  }
  if (parts.length === 0) {
    parts.push("Competent person oversight for the listed task and active scope");
  }
  for (const tr of trainingRequirements.slice(0, 2)) {
    if (tr && !parts.some((p) => p.toLowerCase().includes(tr.toLowerCase().slice(0, 20)))) {
      parts.push(`Training: ${tr}`);
    }
  }
  return dedupe(parts);
}

function buildCsepActivityHazardMatrixTable(params: {
  operations: DraftOperation[];
  groupedTradePackages: GroupedTradePackage[];
  ruleSummary: GeneratedSafetyPlanDraft["ruleSummary"];
  scope: SafetyPlanGenerationContext["scope"];
  siteLocation: string | null | undefined;
  activeScopeTasks: string[];
}): { columns: string[]; rows: string[][] } {
  const trainingPool = params.ruleSummary.trainingRequirements;
  const columns = [
    "Trade / Subtrade",
    "Areas",
    "Tasks",
    "Hazards",
    "Controls",
    "PPE",
    "Permits",
    "Competency",
  ] as const;

  const rowFromParts = (parts: {
    label: string;
    area: string;
    task: string;
    hazards: string[];
    controls: string[];
    ppe: string[];
    permits: string[];
    competency: string[];
  }): string[] => [
    parts.label,
    parts.area,
    parts.task,
    sentenceList(parts.hazards, "N/A"),
    sentenceList(parts.controls, "N/A"),
    sentenceList(parts.ppe, "N/A"),
    sentenceList(parts.permits, "None"),
    sentenceList(parts.competency, "Not specified"),
  ];

  if (params.operations.length) {
    return {
      columns: [...columns],
      rows: params.operations.map((op) => {
        const label = tradePackageLabelForOperation(op).label;
        const area = locationLabelForOperation(op) ?? "N/A";
        const task = op.taskTitle;
        const risk = buildRiskItem(
          op.tradeLabel?.trim() || "Unassigned Trade",
          op.subTradeLabel?.trim() || "General",
          task
        );
        let hazards = normalizeHazardList(op.hazardCategories);
        let controls = [...op.requiredControls];
        if (!hazards.length) {
          hazards = [risk.hazard];
        }
        if (!controls.length) {
          controls = [...risk.controls];
        }
        const aug = augmentCsepActivityMatrixByTaskName(task, risk, { hazards, controls });
        const ppeList = normalizePpeList(op.ppeRequirements);
        const ppeOut = ppeList.length ? ppeList : ["PPE per JHA and site program for the listed task"];
        let permits = normalizePermitList(op.permitTriggers);
        if (!permits.length) {
          permits = risk.permit !== "None" ? [risk.permit] : ["None identified"];
        }
        const competency = competencyListForCsepActivityMatrix(task, risk, trainingPool);
        return rowFromParts({
          label,
          area,
          task,
          hazards: aug.hazards,
          controls: aug.controls,
          ppe: ppeOut,
          permits,
          competency,
        });
      }),
    };
  }

  if (params.groupedTradePackages.length) {
    return {
      columns: [...columns],
      rows: params.groupedTradePackages.flatMap((pkg) =>
        pkg.taskTitles.map((taskTitle) => {
          const risk = buildRiskItem(
            pkg.tradeLabel,
            pkg.subTradeLabel?.trim() ? pkg.subTradeLabel : "General",
            taskTitle
          );
          let hazards = normalizeHazardList(pkg.hazardCategories);
          let controls = [...pkg.requiredControls];
          if (!hazards.length) {
            hazards = [risk.hazard];
          }
          if (!controls.length) {
            controls = [...risk.controls];
          }
          const aug = augmentCsepActivityMatrixByTaskName(taskTitle, risk, { hazards, controls });
          const ppeList = normalizePpeList(pkg.ppeRequirements);
          const ppeOut = ppeList.length ? ppeList : ["PPE per JHA and site program for the listed task"];
          let permits = normalizePermitList(pkg.permitTriggers);
          if (!permits.length) {
            permits = risk.permit !== "None" ? [risk.permit] : ["None identified"];
          }
          const competency = competencyListForCsepActivityMatrix(taskTitle, risk, trainingPool);
          return rowFromParts({
            label: pkg.label,
            area: sentenceList(pkg.locationLabels, "N/A"),
            task: taskTitle,
            hazards: aug.hazards,
            controls: aug.controls,
            ppe: ppeOut,
            permits,
            competency,
          });
        })
      ),
    };
  }

  return {
    columns: [...columns],
    rows: [
      [
        sentenceList(params.scope.trades, "N/A"),
        sentenceList([params.scope.location ?? params.siteLocation ?? "N/A"], "N/A"),
        sentenceList(params.activeScopeTasks, "N/A"),
        sentenceList(normalizeHazardList(params.ruleSummary.hazardCategories)),
        sentenceList(params.ruleSummary.requiredControls),
        sentenceList(normalizePpeList(params.ruleSummary.ppeRequirements)),
        sentenceList(normalizePermitList(params.ruleSummary.permitTriggers), "None"),
        sentenceList(
          trainingPool.length
            ? trainingPool
            : ["Competent person oversight for the active scope; task-specific JHA before work"],
          "Not specified"
        ),
      ],
    ],
  };
}

/** Cross-reference when the full matrix lives in Appendix E only. */
export const APPENDIX_E_TASK_HAZARD_CONTROL_MATRIX_REF =
  "See Appendix E – Task-Hazard-Control Matrix for the task-specific hazard, control, PPE, permit, and competency breakdown.";

function buildActivityHazardMatrixSectionForDraft(params: {
  operations: DraftOperation[];
  groupedTradePackages: GroupedTradePackage[];
  ruleSummary: GeneratedSafetyPlanDraft["ruleSummary"];
  scope: SafetyPlanGenerationContext["scope"];
  siteLocation: string | null | undefined;
  activeScopeTasks: string[];
}): GeneratedSafetyPlanSection {
  return {
    key: "activity_hazard_matrix",
    title: CSEP_BUILDER_BLOCK_TITLES.activity_hazard_matrix,
    table: buildCsepActivityHazardMatrixTable(params),
  };
}

function buildGroupedHazardSubsections(packages: GroupedTradePackage[]) {
  return packages.map<GeneratedSafetyPlanSubsection>((pkg) => ({
    title: pkg.label,
    body: pkg.locationLabels.length
      ? `Primary work areas: ${sentenceList(pkg.locationLabels, "N/A")}.`
      : null,
    bullets: pkg.hazardCategories.length
      ? pkg.hazardCategories
      : ["No specific hazards identified for this trade package."],
  }));
}

function uniqueTextParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const part of parts) {
    const text = stripInlineOshaSuffix(part);
    if (!text) continue;
    const token = normalizeToken(text);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    next.push(text);
  }

  return next;
}

function combineUniqueText(...parts: Array<string | null | undefined>) {
  const next = uniqueTextParts(parts);
  return next.length ? next.join(" ") : null;
}

function stripInlineOshaSuffix(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const stripped = value.replace(INLINE_OSHA_SUFFIX_PATTERN, "").replace(/\s+/g, " ").trim();
  return stripped || null;
}

function extractInlineOshaSuffix(value: string | null | undefined) {
  if (!value?.trim()) return null;

  const match = value.match(/^(.*?)(?:\s*Applicable OSHA references:\s*(.+?)\.\s*)$/i);
  if (!match) return null;

  return {
    body: match[1]?.replace(/\s+/g, " ").trim() || null,
    referencesText: match[2]?.trim() || "",
  };
}

function formatReferenceTokenList(tokens: string[]) {
  if (!tokens.length) return null;
  return `(${tokens.join(", ")})`;
}

function applyInlineReferenceTokens(
  value: string | null | undefined,
  orderedReferences: string[],
  referenceTokenMap: Map<string, string>
) {
  if (!value?.trim()) return value;

  const extracted = extractInlineOshaSuffix(value);
  if (!extracted) return value.replace(/\s+/g, " ").trim();

  const matchedTokens = orderedReferences
    .filter((reference) => extracted.referencesText.includes(reference))
    .map((reference) => referenceTokenMap.get(reference))
    .filter((token): token is string => Boolean(token));

  const tokenText = formatReferenceTokenList(matchedTokens);
  if (!tokenText) return extracted.body;
  if (!extracted.body) return tokenText;

  return `${extracted.body} ${tokenText}`;
}

function applyOshaReferenceTokensToSections(
  sections: GeneratedSafetyPlanSection[],
  oshaReferences: string[]
) {
  if (!oshaReferences.length) return sections;

  const orderedReferences = dedupe(oshaReferences.map((reference) => reference.trim()).filter(Boolean));
  const referenceTokenMap = new Map(
    orderedReferences.map((reference, index) => [reference, `R${index + 1}`])
  );

  return sections.map((section) => {
    const isReferenceSection =
      section.key === "references" ||
      section.key === "osha_references" ||
      section.key === "osha_reference_appendix";

    return {
      ...section,
      summary: applyInlineReferenceTokens(section.summary, orderedReferences, referenceTokenMap),
      body: applyInlineReferenceTokens(section.body, orderedReferences, referenceTokenMap),
      bullets: isReferenceSection
        ? orderedReferences.map((reference) => `${referenceTokenMap.get(reference)} ${reference}`)
        : section.bullets?.map((bullet) =>
            applyInlineReferenceTokens(bullet, orderedReferences, referenceTokenMap) ?? bullet
          ),
      subsections: section.subsections?.map((subsection) => ({
        ...subsection,
        body: applyInlineReferenceTokens(subsection.body, orderedReferences, referenceTokenMap),
        bullets:
          isReferenceSection && subsection.title.toLowerCase().includes("reference")
            ? orderedReferences.map((reference) => `${referenceTokenMap.get(reference)} ${reference}`)
            : subsection.bullets.map(
                (bullet) =>
                  applyInlineReferenceTokens(bullet, orderedReferences, referenceTokenMap) ?? bullet
              ),
      })),
      table: section.table
        ? {
            ...section.table,
            columns: section.table.columns.map(
              (column) =>
                applyInlineReferenceTokens(column, orderedReferences, referenceTokenMap) ?? column
            ),
            rows: section.table.rows.map((row) =>
              row.map(
                (cell) =>
                  applyInlineReferenceTokens(cell, orderedReferences, referenceTokenMap) ?? cell
              )
            ),
          }
        : section.table,
    };
  });
}

function compactText(value: string | null | undefined, maxLength = 220) {
  const stripped = stripInlineOshaSuffix(value);
  if (!stripped) return null;

  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const uniqueSentences = uniqueTextParts(sentences);
  const nextParts: string[] = [];

  for (const sentence of uniqueSentences) {
    const candidate = [...nextParts, sentence].join(" ");
    if (candidate.length > maxLength && nextParts.length > 0) break;
    nextParts.push(sentence);
    if (candidate.length >= maxLength) break;
  }

  const compacted = nextParts.join(" ").trim();
  if (compacted) return compacted;
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function tableNarrativeSnippets(table: GeneratedSafetyPlanSection["table"]) {
  if (!table) return [];

  return table.rows.flatMap((row) => {
    const values = row
      .map((cell) => stripInlineOshaSuffix(cell))
      .filter((cell): cell is string => Boolean(cell));
    if (!values.length) return [];

    if (table.columns.length === 2) {
      return [combineUniqueText(values[0], values[1])];
    }

    return [
      combineUniqueText(values[0], values.slice(1).join(" ")),
      ...values.slice(1),
    ];
  }).filter((value): value is string => Boolean(value));
}

function sectionStructuredNarrativeSnippets(section: GeneratedSafetyPlanSection) {
  return uniqueTextParts([
    ...(section.bullets ?? []),
    ...(section.subsections ?? []).flatMap((subsection) => [
      subsection.title,
      subsection.body,
      ...subsection.bullets,
    ]),
    ...tableNarrativeSnippets(section.table),
  ]);
}

function isNarrativeRedundant(
  value: string | null | undefined,
  details: string[]
) {
  const normalizedValue = normalizeToken(value);
  if (!normalizedValue) return false;

  return details.some((detail) => {
    const normalizedDetail = normalizeToken(detail);
    if (!normalizedDetail) return false;

    return (
      normalizedDetail === normalizedValue ||
      normalizedDetail.includes(normalizedValue) ||
      (normalizedValue.length > 48 && normalizedValue.includes(normalizedDetail))
    );
  });
}

function mergeBullets(
  left: string[] | undefined,
  right: string[] | undefined
) {
  const bullets = dedupe([...(left ?? []), ...(right ?? [])].map((item) => item.trim()).filter(Boolean));
  return bullets.length ? bullets : undefined;
}

function mergeSubsections(
  left: GeneratedSafetyPlanSubsection[] | undefined,
  right: GeneratedSafetyPlanSubsection[] | undefined
) {
  const merged: GeneratedSafetyPlanSubsection[] = [];
  const indexByTitle = new Map<string, number>();

  for (const subsection of [...(left ?? []), ...(right ?? [])]) {
    const normalizedTitle = normalizeToken(subsection.title);
    const existingIndex = indexByTitle.get(normalizedTitle);
    const nextSubsection: GeneratedSafetyPlanSubsection = {
      title: subsection.title,
      body: stripInlineOshaSuffix(subsection.body),
      bullets: dedupe(subsection.bullets.map((item) => item.trim()).filter(Boolean)),
    };

    if (existingIndex === undefined) {
      indexByTitle.set(normalizedTitle, merged.length);
      merged.push(nextSubsection);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      title: existing.title,
      body: combineUniqueText(existing.body, nextSubsection.body),
      bullets: dedupe([...(existing.bullets ?? []), ...(nextSubsection.bullets ?? [])]),
    };
  }

  return merged.length ? merged : undefined;
}

function tableWeight(table: GeneratedSafetyPlanSection["table"]) {
  if (!table) return 0;
  const columnWeight = table.columns.join(" ").length;
  const rowWeight = table.rows.reduce(
    (sum, row) => sum + row.join(" ").length + row.length * 16,
    0
  );
  return columnWeight + rowWeight;
}

function sectionWeight(section: GeneratedSafetyPlanSection) {
  return [
    section.title.length,
    section.summary?.length ?? 0,
    section.body?.length ?? 0,
    (section.bullets ?? []).join(" ").length,
    (section.subsections ?? []).reduce(
      (sum, subsection) =>
        sum +
        subsection.title.length +
        (subsection.body?.length ?? 0) +
        subsection.bullets.join(" ").length,
      0
    ),
    tableWeight(section.table),
  ].reduce((sum, value) => sum + value, 0);
}

function mergeTables(
  left: GeneratedSafetyPlanSection["table"],
  right: GeneratedSafetyPlanSection["table"]
) {
  if (!left) return right ?? null;
  if (!right) return left;
  return tableWeight(right) > tableWeight(left) ? right : left;
}

function mergeSections(
  left: GeneratedSafetyPlanSection,
  right: GeneratedSafetyPlanSection
): GeneratedSafetyPlanSection {
  const preferred =
    sectionWeight(right) > sectionWeight(left) ? right : left;
  const secondary = preferred === left ? right : left;

  return {
    ...preferred,
    summary: combineUniqueText(preferred.summary, secondary.summary),
    body: combineUniqueText(preferred.body, secondary.body),
    bullets: mergeBullets(preferred.bullets, secondary.bullets),
    subsections: mergeSubsections(preferred.subsections, secondary.subsections),
    table: mergeTables(preferred.table, secondary.table),
  };
}

function normalizeSectionContent(section: GeneratedSafetyPlanSection): GeneratedSafetyPlanSection {
  const summary = stripInlineOshaSuffix(section.summary);
  const body = stripInlineOshaSuffix(section.body);
  const bullets = mergeBullets(section.bullets, undefined);
  const subsections = mergeSubsections(section.subsections, undefined);

  return {
    ...section,
    summary:
      summary && normalizeToken(summary) !== normalizeToken(body ?? "")
        ? summary
        : undefined,
    body,
    bullets,
    subsections,
  };
}

function dedupeSectionsByKeyAndTitle(sections: GeneratedSafetyPlanSection[]) {
  const merged: GeneratedSafetyPlanSection[] = [];
  const indexByKey = new Map<string, number>();
  const indexByTitle = new Map<string, number>();

  for (const section of sections.map(normalizeSectionContent)) {
    const keyToken = normalizeToken(section.key);
    const titleToken = normalizeToken(section.title);
    const existingIndex = indexByKey.get(keyToken) ?? indexByTitle.get(titleToken);

    if (existingIndex === undefined) {
      indexByKey.set(keyToken, merged.length);
      indexByTitle.set(titleToken, merged.length);
      merged.push(section);
      continue;
    }

    merged[existingIndex] = mergeSections(merged[existingIndex], section);
  }

  return merged;
}

function mergeCsepFallProtectionSections(sections: GeneratedSafetyPlanSection[]) {
  const primaryIndex = sections.findIndex(
    (section) => normalizeToken(section.title) === normalizeToken("Fall Protection Program")
  );
  const secondaryIndex = sections.findIndex(
    (section) =>
      normalizeToken(section.title) ===
      normalizeToken("Personal Fall Arrest Equipment Program")
  );

  if (primaryIndex === -1 || secondaryIndex === -1) {
    return sections;
  }

  const next = [...sections];
  next[primaryIndex] = {
    ...mergeSections(next[primaryIndex], next[secondaryIndex]),
    title: next[primaryIndex].title,
    key: next[primaryIndex].key,
  };
  next.splice(secondaryIndex, 1);
  return next;
}

function suppressRedundantCsepNarrative(section: GeneratedSafetyPlanSection) {
  const hasStructuredDetail = Boolean(
    section.table || section.bullets?.length || section.subsections?.length
  );
  if (!hasStructuredDetail) return section;

  const structuredSnippets = sectionStructuredNarrativeSnippets(section);
  const nextSummary = isNarrativeRedundant(section.summary, structuredSnippets)
    ? undefined
    : section.summary;
  const nextBody =
    section.key === "additional_permits" ||
    section.key === "contractor_iipp" ||
    section.key === "common_overlapping_trades"
      ? section.body
      : isNarrativeRedundant(section.body, structuredSnippets)
        ? undefined
        : section.body;

  if (CSEP_REFERENCE_PACK_KEYS.has(section.key)) {
    return {
      ...section,
      summary: nextSummary,
      body: compactText(nextBody, CSEP_REFERENCE_PACK_BODY_COMPACT),
      bullets: undefined,
    };
  }

  if (section.key === "required_ppe" || section.key === "selected_hazards") {
    return {
      ...section,
      summary: undefined,
      body: undefined,
    };
  }

  if (section.key === "trade_summary") {
    return {
      ...section,
      summary: undefined,
      body: compactText(nextBody, 180),
    };
  }

  return {
    ...section,
    summary: nextSummary,
    body: nextBody,
  };
}

function estimateCsepDraftUnits(sections: GeneratedSafetyPlanSection[]) {
  return sections.reduce((sum, section) => sum + sectionWeight(section), 0);
}

function compactCsepSections(sections: GeneratedSafetyPlanSection[]) {
  let next = sections.map(suppressRedundantCsepNarrative);

  if (estimateCsepDraftUnits(next) <= CSEP_SOFT_PAGE_BUDGET_UNITS) {
    return next;
  }

  next = next.map((section) => {
    if (!CSEP_COMPACTABLE_KEYS.has(section.key)) return section;
    const hasStructuredDetail = Boolean(
      section.table || section.bullets?.length || section.subsections?.length
    );

    return {
      ...section,
      summary: undefined,
      body: compactText(section.body, hasStructuredDetail ? 160 : 220),
    };
  });

  if (estimateCsepDraftUnits(next) <= CSEP_SOFT_PAGE_BUDGET_UNITS) {
    return next;
  }

  next = next.map((section) =>
    CSEP_REFERENCE_PACK_KEYS.has(section.key)
      ? {
          ...section,
          body: compactText(section.body, CSEP_REFERENCE_PACK_BODY_COMPACT),
          bullets: undefined,
        }
      : section
  );

  if (estimateCsepDraftUnits(next) <= CSEP_SOFT_PAGE_BUDGET_UNITS) {
    return next;
  }

  return next.map((section) => {
    if (!CSEP_COMPACTABLE_KEYS.has(section.key)) return section;
    const hasStructuredDetail = Boolean(
      section.table || section.bullets?.length || section.subsections?.length
    );

    return hasStructuredDetail
      ? {
          ...section,
          summary: undefined,
          body: undefined,
        }
      : {
          ...section,
          summary: undefined,
          body: compactText(section.body, 140),
        };
  });
}

function normalizeCsepSections(sections: GeneratedSafetyPlanSection[]) {
  const mergedSections = mergeCsepFallProtectionSections(
    dedupeSectionsByKeyAndTitle(sections)
  );
  return compactCsepSections(mergedSections);
}

function buildDefinitionsSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[],
  operations: GeneratedSafetyPlanDraft["operations"]
): GeneratedSafetyPlanSection {
  if (generationContext.documentProfile.documentType === "pshsep") {
    const structured = getPshsepStructuredInputs(generationContext);
    return {
      key: "definitions",
      title: "Definitions",
      body: appendInlineOsha(
        structured.definitionsText ??
          "Define critical project terms early in the plan, including competent person, ancillary contractor, IDLH conditions, high-risk work, and owner-specific severe-event terminology before field execution begins.",
        inlineOshaRefs
      ),
    };
  }

  const baseDefinitions = [
    "Competent Person: An individual capable of identifying existing and predictable hazards in the surroundings or working conditions and authorized to take prompt corrective measures.",
    "Qualified Person: An individual who, by recognized training, certification, or experience, has successfully demonstrated the ability to resolve problems related to the assigned work.",
    "Controlling Contractor: The employer that has overall responsibility for construction of the project, typically the GC or CM overseeing trade coordination and access control.",
    "Permit-Required Work: Work that cannot start without a documented permit, verification, or owner / site authorization (hot work, confined space, excavation, elevated work, etc.).",
    "Simultaneous Operations: Two or more trades, crews, or activities working in overlapping areas or time windows that can affect one another\u2019s risk profile.",
    "Stop-Work Authority: The responsibility and authority of any worker or supervisor to pause work when conditions become unsafe or controls are not in place.",
    "Exclusion Zone: A defined area around a hazard (suspended load, hot work, drop zone, swing radius, etc.) where entry is restricted to authorized personnel only.",
    "Laydown Area: A controlled area designated for material delivery, staging, and inspection, separated from active work fronts and pedestrian routes.",
  ];

  const steelDefinitions = [
    "Qualified Rigger: A rigger who meets the qualified-person criteria and is specifically competent to select, inspect, and use rigging for the lift being performed.",
    "Signal Person: A qualified individual who directs crane and hoist movements using standard hand or radio signals and is in clear communication with the operator.",
    "Leading Edge: The unprotected edge of a floor, roof, deck, or formwork surface that changes location as additional sections, panels, or plates are added.",
    "Controlled Access Zone (CAZ): A clearly defined and restricted work area where access is limited to authorized personnel engaged in specific operations such as leading-edge work, decking, connecting, or other controlled steel-erection activities. The CAZ boundary shall be established, marked, and maintained to prevent entry by employees not involved in the operation.",
    "Connector: An employee who, working aloft, connects structural members and components as they are placed, bolted, or welded in position.",
    "Suspended Load: Any load lifted by a crane, hoist, rigging, or derrick that is not landed and secured; personnel must remain clear of the load path and drop zone.",
    "Critical Lift: A lift that exceeds normal rigging complexity, load rating, or risk thresholds (tandem picks, blind picks, over 75 percent of chart, picks over occupied areas) and requires a written plan.",
  ];

  const definitions = hasSteelErectionScope(generationContext, operations)
    ? [...baseDefinitions, ...steelDefinitions]
    : baseDefinitions;

  return {
    key: "definitions",
    title: "Definitions",
    body:
      "These definitions establish the field language used throughout this CSEP for the active scope. Only terms relevant to the selected trade and tasks are included.",
    bullets: definitions,
  };
}

function buildReferencesSection(oshaReferences: string[]): GeneratedSafetyPlanSection {
  return {
    key: "references",
    title: "References",
    bullets: oshaReferences.length
      ? oshaReferences.map((reference, index) => `R${index + 1} ${reference}`)
      : ["No OSHA references were identified from the current plan inputs."],
  };
}

function getCsepBuilderInstructions(generationContext: SafetyPlanGenerationContext) {
  return generationContext.builderInstructions ?? null;
}

type TaskModuleContextRow = {
  title: string;
  moduleKey: string;
  subTrade: string;
  taskNames: string[];
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
};

type HazardModuleContextRow = {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  matchedReasons: string[];
};

type SteelTaskModuleContextRow = {
  title: string;
  moduleKey: string;
  trade: string | null;
  subTrade: string | null;
  taskNames: string[];
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
};

type SteelHazardModuleContextRow = {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  matchedReasons: string[];
};

type SteelProgramModuleContextRow = {
  title: string;
  moduleKey: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
  matchedReasons: string[];
};

type ParsedReferencePackDoc = {
  introLines: string[];
  sections: Array<{
    heading: string;
    text: string;
  }>;
};

function buildModuleLookup<T extends { moduleKey: string }>(items: T[]) {
  return new Map(items.map((item) => [item.moduleKey, item]));
}

function mergeReferencePackContext<T extends {
  moduleKey: string;
  title: string;
  summary: string;
  sectionHeadings: string[];
  plainText: string;
  sourceFilename: string;
}>(
  item: T,
  fullModule: Partial<T> | undefined
) {
  return {
    ...item,
    title: textOrNull(fullModule?.title) ?? item.title,
    summary: textOrNull(fullModule?.summary) ?? item.summary,
    sectionHeadings: stringList(fullModule?.sectionHeadings ?? item.sectionHeadings),
    plainText: textOrNull(fullModule?.plainText) ?? item.plainText,
    sourceFilename: textOrNull(fullModule?.sourceFilename) ?? item.sourceFilename,
  };
}

function parseReferencePackPlainText(plainText: string): ParsedReferencePackDoc {
  const lines = plainText
    .split("\n")
    .map((line) => cleanFinalText(line))
    .filter((line): line is string => Boolean(line));
  const sections: ParsedReferencePackDoc["sections"] = [];
  const introLines: string[] = [];
  let currentSection: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (/^reference language/i.test(line) || /^applicable osha references/i.test(line)) {
      break;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (currentSection?.lines.length) {
        sections.push({
          heading: currentSection.heading,
          text: currentSection.lines.join(" "),
        });
      }

      currentSection = {
        heading: line.replace(/^\d+\.\s+/, "").trim(),
        lines: [],
      };
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(normalizeReferencePackSectionLine(line));
      continue;
    }

    introLines.push(line);
  }

  if (currentSection?.lines.length) {
    sections.push({
      heading: currentSection.heading,
      text: currentSection.lines.join(" "),
    });
  }

  return {
    introLines,
    sections,
  };
}

function stripReferencePackNumberPrefix(value: string) {
  return value.replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
}

function normalizeReferencePackSectionLine(line: string) {
  if (!/^\d+\.\d+\.?\s+/i.test(line)) {
    return line;
  }

  const withoutNumber = stripReferencePackNumberPrefix(line);
  if (!withoutNumber) {
    return line;
  }

  const matched = withoutNumber.match(/^(.+?)(?:\s{2,}|:\s+)(.+)$/);
  if (!matched) {
    return withoutNumber;
  }

  const [, , rawBody] = matched;
  return cleanFinalText(rawBody) ?? rawBody.trim();
}

function numberedReferencePackLines(
  sectionHeadings: string[] | undefined,
  plainText: string
) {
  const normalizedSectionHeadings = sectionHeadings ?? [];
  const candidateLines = normalizedSectionHeadings.length
    ? normalizedSectionHeadings
    : plainText
        .split("\n")
        .map((line) => cleanFinalText(line))
        .filter((line): line is string => Boolean(line));

  return dedupe(
    candidateLines.filter((line) => /^\d+\.\d+\.?\s+/i.test(line))
  );
}

function selectReferencePackChildItems(
  sectionHeadings: string[] | undefined,
  plainText: string,
  matchers: RegExp[]
) {
  return numberedReferencePackLines(sectionHeadings, plainText).filter((line) =>
    matchers.some((matcher) => matcher.test(stripReferencePackNumberPrefix(line)))
  );
}

function parseReferencePackChildItem(line: string) {
  const withoutNumber = stripReferencePackNumberPrefix(line);
  const matched = withoutNumber.match(/^(.+?)(?:\s{2,}|:\s+)(.+)$/);
  if (!matched) {
    return {
      title: withoutNumber.trim(),
      body: "",
    };
  }

  return {
    title: cleanFinalText(matched[1]) ?? "",
    body: cleanFinalText(matched[2]) ?? "",
  };
}

function cleanupReferencePackChildItems(
  summary: string,
  items: string[],
  suppressedTitleMatchers: RegExp[] = []
) {
  const normalizedSummary = normalizeToken(summary);
  const seenTitles = new Set<string>();
  const seenBodies = new Set<string>();

  return items.filter((item) => {
    const parsed = parseReferencePackChildItem(item);
    const normalizedTitle = normalizeToken(parsed.title);
    const normalizedBody = normalizeToken(parsed.body);

    if (!normalizedBody) {
      return false;
    }

    if (
      suppressedTitleMatchers.some((matcher) => matcher.test(parsed.title)) ||
      /^(purpose|main hazards?|pre construction planning|pre task review|core controls|related permit triggers|primary affected parties|recordkeeping|training|continuous improvement)$/i.test(
        parsed.title
      )
    ) {
      return false;
    }

    if (normalizedTitle && seenTitles.has(normalizedTitle)) {
      return false;
    }

    if (normalizedBody && seenBodies.has(normalizedBody)) {
      return false;
    }

    if (
      (/purpose|main hazards?/i.test(parsed.title) && normalizedBody.includes(normalizedSummary)) ||
      normalizedBody === normalizedTitle
    ) {
      return false;
    }

    if (normalizedTitle) seenTitles.add(normalizedTitle);
    if (normalizedBody) seenBodies.add(normalizedBody);
    return true;
  });
}

function directiveSnippet(value: string | null | undefined, maxLength = 220) {
  const compacted = compactText(value, maxLength);
  if (!compacted) return null;

  return compacted
    .replace(/\bshould\b/gi, "must")
    .replace(/\bmay require\b/gi, "can require")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryWithoutTrailingPeriod(value: string) {
  return value.replace(/[.:\s]+$/g, "").trim();
}

function buildModuleBody(summary: string, parsed: ParsedReferencePackDoc) {
  const overview = directiveSnippet(
    combineUniqueText(summary, parsed.introLines.slice(2).join(" ")),
    320
  ) ?? summary;

  return overview.trim();
}

function buildTradeScopeSummary(
  groupedTradePackages: GroupedTradePackage[],
  activeScopeTasks: string[],
  ruleSummary: GeneratedSafetyPlanDraft["ruleSummary"]
) {
  const packageLabels = dedupe(groupedTradePackages.map((pkg) => pkg.label));
  const taskTitles = dedupe([
    ...groupedTradePackages.flatMap((pkg) => pkg.taskTitles),
    ...activeScopeTasks,
  ]);
  const hazardCategories = dedupe([
    ...groupedTradePackages.flatMap((pkg) => pkg.hazardCategories),
    ...normalizeHazardList(ruleSummary.hazardCategories),
  ]);
  const permitTriggers = dedupe([
    ...groupedTradePackages.flatMap((pkg) => pkg.permitTriggers),
    ...normalizePermitList(ruleSummary.permitTriggers),
  ]);
  const locationLabels = dedupe(groupedTradePackages.flatMap((pkg) => pkg.locationLabels));

  return combineParagraphs(
    [
      taskTitles.length
        ? `Current contractor scope includes ${sentenceList(taskTitles, "the selected work scope")} for ${sentenceList(packageLabels, "the assigned trade package")}.`
        : packageLabels.length
          ? `Current contractor scope is being performed by ${sentenceList(packageLabels, "the assigned trade package")}.`
          : null,
      locationLabels.length
        ? `Primary work areas for this phase include ${sentenceList(locationLabels)}.`
        : null,
      hazardCategories.length
        ? `Primary hazards for the active phase include ${sentenceList(hazardCategories)}.`
        : null,
      permitTriggers.length
        ? `Anticipated permit triggers include ${sentenceList(permitTriggers)}.`
        : "No special permit triggers were identified beyond standard project controls.",
    ],
    "Current contractor scope summary was not fully provided in the builder payload."
  );
}

function buildControlModuleSubsection(item: TaskModuleContextRow): GeneratedSafetyPlanSubsection {
  const parsed = parseReferencePackPlainText(item.plainText);
  const planningItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /planning/i,
      /startup/i,
      /pre-task/i,
      /daily review/i,
    ])
  );
  const controlsItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /equipment/i,
      /access/i,
      /hazards?/i,
      /controls?/i,
      /stability/i,
      /load and access limits/i,
    ])
  );
  const permitsItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /permit/i,
      /approval/i,
      /deviation/i,
    ])
  );
  const relatedItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /affected/i,
      /practical use/i,
      /recordkeeping/i,
      /communication/i,
    ])
  );

  return {
    title: item.title,
    body: buildModuleBody(item.summary, parsed),
    bullets: [
      `Scope and use: ${summaryWithoutTrailingPeriod(item.summary)}. Review this section before affected crews, delivery teams, or visitors enter the controlled area.`,
      "Pre-start verification: Verify the work area, access and egress route, restricted boundaries, equipment, signage or barricades, and adjacent-trade interfaces before the shift starts.",
      ...planningItems,
      "Required controls: Establish the boundary, maintain clear routes, keep the control in place as the work front changes, and stop crews from bypassing the control.",
      ...controlsItems,
      "Permits and PPE: Confirm whether this control affects traffic, public access, right-of-way, utility, lift, or owner-security permits before work starts. Inspect required PPE before use and do not proceed if project-required PPE is missing or damaged.",
      ...permitsItems,
      "Stop-work triggers: Stop work if the route, barrier, fencing, gate, signage, lighting, or support condition no longer matches the plan, if unauthorized personnel enter the controlled area, or if surrounding work changes the exposure. Restart only after the foreman or competent person re-inspects the area and re-establishes the control.",
      "Verification and handoff: Document the pre-task brief, inspections, route or boundary changes, permits, and corrective actions for this section. The superintendent, foreman, or competent person verifies the condition at start-up, after any change, and before the area is released.",
      `Related interfaces: Coordinate with ${sentenceList(item.taskNames, "site setup")}. Also coordinate deliveries, pedestrian traffic, equipment movement, emergency access, and follow-on crews affected by this control.`,
      ...relatedItems,
    ],
  };
}

const SUSPENDED_LOAD_MODULE_KEYS = new Set([
  // Hazard module
  "steel_hoisting_and_rigging",
  // Task modules
  "steel_hoisting_and_rigging_multiple_lift",
  "steel_setting_columns_and_base_lines",
  "steel_receiving_unloading_inspecting_and_staging",
  "steel_erecting_beams_and_girders_initial_connections",
  // Program modules
  "steel_hoisting_and_rigging_program",
  "steel_multiple_lift_rigging_program",
  "steel_falling_objects_and_drop_zone_control_program",
  "steel_column_anchorage_and_initial_connection_program",
]);

const SUSPENDED_LOAD_KEYWORD_PATTERN =
  /(suspended load|hoisting|crane pick|crane lift|multiple lift|rigging|landing zone|landing area|drop zone|lift zone|swing radius|load path|setting column)/i;

function requiresSuspendedLoadControls(item: {
  moduleKey?: string;
  title?: string;
  plainText?: string;
}): boolean {
  if (item.moduleKey && SUSPENDED_LOAD_MODULE_KEYS.has(item.moduleKey)) {
    return true;
  }
  const haystack = `${item.title ?? ""} ${item.plainText ?? ""}`;
  return SUSPENDED_LOAD_KEYWORD_PATTERN.test(haystack);
}

const SUSPENDED_LOAD_CONTROL_BULLETS: readonly string[] = [
  "Suspended-load exclusion: No employee shall work, stand, or travel beneath a suspended load. The hoisting path and landing area shall be controlled to prevent unauthorized entry before and during the lift.",
  "Lift-zone access limit: Only personnel directly involved in the lift are permitted inside the controlled lifting zone. Barricades, spotters, signage, and exclusion-zone controls shall be used as needed to keep workers out of the fall zone and load path.",
];

// Replaces wording that reads like personal fall restraint with precise
// structural-stability language for steel-erection modules. The steel
// hazard/task/program modules use "temporary restraint" to describe keeping a
// partially erected frame stable — that is bracing, not worker restraint.
// Personal fall-protection wording ("personal fall arrest or restraint",
// "fall restraint equipment") is preserved because it uses the "fall" qualifier.
function applySteelErectionTextFixes(value: string): string {
  if (!value) return value;
  return (
    value
      .replace(/\btemporary restraint\b/gi, "temporary bracing")
      .replace(/\bearly frame restraint\b/gi, "early frame bracing")
      .replace(/\bframe restraint\b/gi, "frame bracing")
      .replace(/([.!?])(\s+)([A-Z])/g, "$1$2$3")
      .replace(/\s{3,}/g, "  ")
  );
}

function fixSteelReferenceList(values: string[]): string[] {
  return values.map((entry) => applySteelErectionTextFixes(entry));
}

function sanitizeSteelModuleRow<
  T extends {
    title: string;
    summary: string;
    plainText: string;
    sectionHeadings: string[];
  },
>(row: T): T {
  return {
    ...row,
    title: applySteelErectionTextFixes(row.title),
    summary: applySteelErectionTextFixes(row.summary),
    plainText: applySteelErectionTextFixes(row.plainText),
    sectionHeadings: fixSteelReferenceList(row.sectionHeadings),
  };
}

function extractReferencePackParagraphs(
  item: { sectionHeadings?: string[]; plainText: string },
  matchers: RegExp[]
): string[] {
  return numberedReferencePackLines(item.sectionHeadings ?? [], item.plainText)
    .filter((line) => matchers.some((m) => m.test(stripReferencePackNumberPrefix(line))))
    .map((line) => parseReferencePackChildItem(line))
    .filter((parsed) => parsed.body)
    .map((parsed) =>
      parsed.title
        ? `${parsed.title}: ${parsed.body}`
        : parsed.body
    );
}

function buildHazardModuleSubsection(
  item: HazardModuleContextRow | SteelHazardModuleContextRow
): GeneratedSafetyPlanSubsection {
  const parsed = parseReferencePackPlainText(item.plainText);
  const planningItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /planning/i,
      /startup/i,
      /pre-task/i,
      /daily review/i,
    ])
  );
  const controlsItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /equipment/i,
      /access/i,
      /hazards?/i,
      /controls?/i,
      /stability/i,
      /load and access limits/i,
      /connecting/i,
      /decking/i,
    ])
  );
  const permitsItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /permit/i,
      /approval/i,
      /deviation/i,
    ])
  );
  const relatedItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /affected/i,
      /practical use/i,
      /recordkeeping/i,
      /communication/i,
    ])
  );

  const suspendedLoadBullets = requiresSuspendedLoadControls(item)
    ? SUSPENDED_LOAD_CONTROL_BULLETS
    : [];

  return {
    title: item.title,
    body: buildModuleBody(item.summary, parsed),
    bullets: [
      `Hazard overview: ${summaryWithoutTrailingPeriod(item.summary)}. Review the exposure, control method, and affected interface before the crew enters the area.`,
      "Pre-start verification: Inspect the hazard area, confirm the exposure is correctly identified, verify the control method, and confirm who has authority to release the work for start once permits, PPE, access, rescue provisions, and hazard controls are verified.",
      ...planningItems,
      "Required controls: Establish the hazard boundary, maintain the selected controls, keep non-essential personnel out of the exposure zone, and correct drift immediately when field conditions change.",
      ...suspendedLoadBullets,
      ...controlsItems,
      "Permits and PPE: Confirm whether this exposure triggers a permit, engineered approval, rescue plan, or owner authorization before work starts. Inspect required PPE before use and do not proceed if the permit or PPE is missing, incompatible, or damaged.",
      ...permitsItems,
      "Stop-work triggers: Stop work if the exposure expands, if the control method fails, if the supporting structure or access route changes, if unauthorized personnel enter the zone, or if weather, visibility, or sequencing conditions no longer match the plan. Restart only after the competent person re-verifies the area and releases the work.",
      "Verification and handoff: Document the hazard assessment, inspections, permits, corrective actions, and release status for this section. The foreman or competent person verifies the condition at start-up, after any change, and before follow-on work enters the area.",
      "Related interfaces: Coordinate this section with the active work face, access routes, hoisting paths, affected trades, and any follow-on crew that could inherit the exposure.",
      ...relatedItems,
    ],
  };
}

function buildSteelTaskModuleSubsection(item: SteelTaskModuleContextRow): GeneratedSafetyPlanSubsection {
  const parsed = parseReferencePackPlainText(item.plainText);
  const planningItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /planning/i,
      /startup/i,
      /pre-task/i,
      /daily review/i,
    ])
  );
  const controlsItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /primary controls/i,
      /core controls/i,
      /required controls/i,
      /equipment/i,
      /hazards? & controls?/i,
      /stability/i,
    ])
  );
  const accessItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /access and support/i,
      /load and access limits/i,
    ])
  );
  const permitsItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /typical approvals/i,
      /permit/i,
      /approval/i,
      /deviation/i,
    ])
  );
  const closeoutItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /completion standard/i,
      /handoff/i,
      /inspection/i,
      /acceptance/i,
      /closeout/i,
      /recordkeeping/i,
      /communication/i,
      /practical use/i,
    ])
  );

  const exposureParagraphs = extractReferencePackParagraphs(item, [
    /main exposure profile/i,
    /main hazards?/i,
    /primary exposure/i,
  ]);
  const exposureBullets = exposureParagraphs.length
    ? exposureParagraphs.map((text) => `Safety exposure — ${text}`)
    : [
        "Safety exposure: This task exposes workers to active steel-erection hazards including suspended loads, pinch points at landing and connection, fall from height at leading edges and openings, struck-by from moving steel or tools, and loss of structural stability before bracing and bolting are complete.",
      ];

  const suspendedLoadBullets = requiresSuspendedLoadControls(item)
    ? SUSPENDED_LOAD_CONTROL_BULLETS
    : [];

  const accessBullets = accessItems.length
    ? accessItems
    : [
        "Access restrictions: Entry into the active work zone is limited to trained crew assigned to the task. Non-essential personnel stay outside the barricaded area, the crane swing radius, the lift and drop zones, and any leading-edge or controlled decking boundary until the area is released by the competent person.",
      ];

  return {
    title: item.title,
    body: buildModuleBody(item.summary, parsed),
    bullets: [
      `Task description: ${summaryWithoutTrailingPeriod(item.summary)}. Review the sequence, access point, and handoff condition before the first crew member starts the task.`,
      ...exposureBullets,
      "Pre-start verification: Verify the sequence, support steel, access point, material staging, equipment, communications, fall protection, and rescue path before work starts. The foreman or competent person confirms the crew briefing, PPE inspection, and who has work-start or release authority to authorize proceeding once permits, PPE, access, rescue provisions, and required hazard controls are verified.",
      ...planningItems,
      "Required controls (before and during work): Establish the controlled work zone, maintain the approved sequence, keep the frame stable at every stage, protect workers below, and correct drift immediately when field conditions change. Controls remain in place until the task is complete and formally released.",
      ...suspendedLoadBullets,
      ...controlsItems,
      ...accessBullets,
      "PPE expectations: Hard hat, safety glasses, high-visibility outerwear, cut-resistant gloves sized for the task, and ANSI-rated safety-toe boots are required. Personal fall-arrest or fall-restraint equipment is required whenever the employee is exposed to a fall hazard that cannot be eliminated; arrest or restraint equipment shall be inspected before each use, anchored to a compliant anchorage, and removed from service if damaged.",
      "Permits and hold points: Confirm site terminology for this pick (lift plan, pick plan, crane permit, and critical-lift plan as required), plus hot-work, leading-edge / controlled-decking release, anchor-rod change notices, and GC/CM authorization. Do not start until the active permit package, hold points, and rescue capability are in hand.",
      ...permitsItems,
      "Stop-work and reassessment triggers: Stop work and reassess if the sequence changes without review, if support steel or access is not ready, if communications or signals are lost, if the crew cannot maintain the planned stable condition, if weather or wind exceeds the plan, if unauthorized personnel enter the controlled zone, or if required controls, PPE, or permits are missing. Restart only after the foreman or competent person re-verifies the work face and releases the next step.",
      "Handoff and closeout: Document the pre-task brief, inspections, permits, deviations, corrective actions, and the field condition at handoff. The next crew shall not assume a safe starting condition unless the release is signed off in the daily pre-task record.",
      ...closeoutItems,
      `Related interfaces: Coordinate with ${sentenceList(item.taskNames, "the steel-erection sequence")}, the crane crew, riggers, connectors, deck crews, and any follow-on trade affected by the handoff condition created by this task.`,
    ],
  };
}

function buildSteelProgramModuleSubsection(item: SteelProgramModuleContextRow): GeneratedSafetyPlanSubsection {
  const parsed = parseReferencePackPlainText(item.plainText);
  const planningItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /roles?/i,
      /responsibilities/i,
      /planning/i,
      /pre-task/i,
      /field procedure/i,
      /purpose/i,
      /applicability/i,
    ])
  );
  const documentationItems = cleanupReferencePackChildItems(
    item.summary,
    selectReferencePackChildItems(item.sectionHeadings, item.plainText, [
      /documentation/i,
      /records?/i,
      /review/i,
      /retraining/i,
      /updates?/i,
      /permit/i,
      /approval/i,
    ])
  );

  const suspendedLoadBullets = requiresSuspendedLoadControls(item)
    ? SUSPENDED_LOAD_CONTROL_BULLETS
    : [];

  return {
    title: item.title,
    body: buildModuleBody(item.summary, parsed),
    bullets: [
      `Program scope: ${summaryWithoutTrailingPeriod(item.summary)}. The superintendent, foreman, and competent person assign ownership before the exposed work starts and keep the program active until the work face is formally released.`,
      "Pre-start verification: Verify responsible roles, communications, rescue or response path, equipment staging, permits, and the exact work face covered by the program before the shift starts.",
      ...planningItems,
      "Required controls: Establish the program boundary, maintain the assigned sequence, keep unauthorized personnel out of the area, and enforce the daily field procedure exactly as briefed.",
      ...suspendedLoadBullets,
      "Permits and PPE: Confirm rescue plan, site crane and pick authorizations (lift plan / pick plan / crane permit as the site names them), hot-work, engineered approvals, owner authorization, and specialty PPE before work starts. Inspect PPE before use; do not proceed if permits, rescue, or PPE are missing or damaged.",
      "Stop-work triggers: Stop work if the responsible roles are not staffed, if rescue or communication capability is unavailable, if access control fails, if the exposed condition changes without review, or if the program approvals are not active. Restart only after project leadership re-verifies the program and reauthorizes the work.",
      "Verification and handoff: Document the daily brief, inspections, permit package, drill or rescue readiness, deviations, corrective actions, and release status for this program.",
      ...documentationItems,
      "Related interfaces: Coordinate this program with the steel-erection sequence, controlling contractor, crane and access crews, adjacent trades, and emergency responders supporting the exposed condition.",
    ],
  };
}

function getTaskModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): TaskModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.taskModules)) return [];
  const fullModules = buildModuleLookup(getSiteManagementTaskModules());

  return metadata.taskModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) =>
      mergeReferencePackContext(
        {
          title: textOrNull(item.title) ?? "Task module",
          moduleKey:
            textOrNull(item.moduleKey) ??
            "task_module",
          subTrade: textOrNull(item.subTrade) ?? "Unspecified",
          taskNames: stringList(item.taskNames),
          summary: textOrNull(item.summary) ?? "No summary provided.",
          sectionHeadings: stringList(item.sectionHeadings),
          plainText: textOrNull(item.plainText) ?? "",
          sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
        },
        fullModules.get(textOrNull(item.moduleKey) ?? "")
      )
    )
    .filter((item) => item.title && item.summary);
}

function buildTaskModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const taskModules = getTaskModulesFromGenerationContext(generationContext);
  if (!taskModules.length) return null;

  return {
    key: "task_modules_reference",
    title: "Task Modules Reference Pack",
    body: appendInlineOsha(
      "The subsections in this pack are the full task module entries selected for the scope. See Section 11 Hazards and Controls; Section 3 Scope (or trade-specific scope) where the CSEP states how tasks map to the contract; and Appendix E. Task-Hazard-Control Matrix for the task, hazard, and control lines tied to the active work.",
      inlineOshaRefs
    ),
    subsections: taskModules.map((item) => buildControlModuleSubsection(item)),
  };
}

function getHazardModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): HazardModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.hazardModules)) return [];
  const fullModules = buildModuleLookup(getHazardModules());

  return metadata.hazardModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) =>
      mergeReferencePackContext(
        {
          title: textOrNull(item.title) ?? "Hazard module",
          moduleKey:
            textOrNull(item.moduleKey) ??
            "hazard_module",
          summary: textOrNull(item.summary) ?? "No summary provided.",
          sectionHeadings: stringList(item.sectionHeadings),
          plainText: textOrNull(item.plainText) ?? "",
          sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
          matchedReasons: stringList(item.matchedReasons),
        },
        fullModules.get(textOrNull(item.moduleKey) ?? "")
      )
    )
    .filter((item) => item.title && item.summary);
}

function buildHazardModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const hazardModules = getHazardModulesFromGenerationContext(generationContext);
  if (!hazardModules.length) return null;

  return {
    key: "hazard_modules_reference",
    title: "Hazard Modules Reference Pack",
    body: appendInlineOsha(
      "The subsections in this pack expand the same hazard content summarized under Section 11 Hazards and Controls. See also Section 4 Top 10 Risks; Section 5 Trade Interaction Info; Section 8 Security at Site (where access and site traffic connect); Section 9 HazCom (chemical/SDS context); Section 10 IIPP / Emergency Response; and Appendix E. Task-Hazard-Control Matrix. Each parent hazard block in Section 11 remains the project binding structure; this pack provides the full write-up for the modules selected in metadata.",
      inlineOshaRefs
    ),
    subsections: hazardModules.map((item) =>
      buildHazardModuleSubsection(item)
    ),
  };
}

function getSteelTaskModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): SteelTaskModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.steelTaskModules)) return [];
  const fullModules = buildModuleLookup(getSteelErectionTaskModules());

  return metadata.steelTaskModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) =>
      mergeReferencePackContext(
        {
          title: textOrNull(item.title) ?? "Steel task module",
          moduleKey: textOrNull(item.moduleKey) ?? "steel_task_module",
          trade: textOrNull(item.trade),
          subTrade: textOrNull(item.subTrade),
          taskNames: stringList(item.taskNames),
          summary: textOrNull(item.summary) ?? "No summary provided.",
          sectionHeadings: stringList(item.sectionHeadings),
          plainText: textOrNull(item.plainText) ?? "",
          sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
        },
        fullModules.get(textOrNull(item.moduleKey) ?? "")
      )
    )
    .filter((item) => item.title && item.summary)
    .map((item) => sanitizeSteelModuleRow(item));
}

function buildSteelTaskModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const taskModules = getSteelTaskModulesFromGenerationContext(generationContext);
  if (!taskModules.length) return null;

  return {
    key: "steel_task_modules_reference",
    title: "Steel Erection Task Modules Reference Pack",
    body: appendInlineOsha(
      "The subsections in this pack are the steel erection task modules for the current scope. Use them with Section 11 Hazards and Controls; the Project Description / scope sections that name steel work; Section 10 IIPP / Emergency Response (fall rescue and medical escalation where applicable); Section 3 Scope or the steel sub-scope narrative where this CSEP records sequence and interfaces; and Appendix E. Task-Hazard-Control Matrix for steel task, hazard, and control lines. Cited 29 CFR 1926 Subpart R provisions in the plan or matrix apply to the work described in these modules.",
      inlineOshaRefs
    ),
    subsections: taskModules.map((item) => buildSteelTaskModuleSubsection(item)),
  };
}

function getSteelHazardModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): SteelHazardModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.steelHazardModules)) return [];
  const fullModules = buildModuleLookup(getSteelErectionHazardModules());

  return metadata.steelHazardModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) =>
      mergeReferencePackContext(
        {
          title: textOrNull(item.title) ?? "Steel hazard module",
          moduleKey: textOrNull(item.moduleKey) ?? "steel_hazard_module",
          summary: textOrNull(item.summary) ?? "No summary provided.",
          sectionHeadings: stringList(item.sectionHeadings),
          plainText: textOrNull(item.plainText) ?? "",
          sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
          matchedReasons: stringList(item.matchedReasons),
        },
        fullModules.get(textOrNull(item.moduleKey) ?? "")
      )
    )
    .filter((item) => item.title && item.summary)
    .map((item) => sanitizeSteelModuleRow(item));
}

function buildSteelErectionHazardModuleSubsection(
  item: SteelHazardModuleContextRow
): GeneratedSafetyPlanSubsection {
  const asTask: SteelTaskModuleContextRow = {
    title: item.title,
    moduleKey: item.moduleKey,
    trade: null,
    subTrade: null,
    taskNames:
      item.matchedReasons.length > 0
        ? item.matchedReasons
        : ["Steel erection / structural steel / decking exposure for the active scope"],
    summary: item.summary,
    sectionHeadings: item.sectionHeadings,
    plainText: item.plainText,
    sourceFilename: item.sourceFilename,
  };
  const base = buildSteelTaskModuleSubsection(asTask);
  return {
    title: item.title,
    body: base.body,
    bullets: base.bullets.map((line) => line.replace(/^Task description:/, "Hazard focus:")),
  };
}

function buildSteelHazardModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const hazardModules = getSteelHazardModulesFromGenerationContext(generationContext);
  if (!hazardModules.length) return null;

  return {
    key: "steel_hazard_modules_reference",
    title: "Steel Erection Hazard Modules Reference Pack",
    body: appendInlineOsha(
      "The subsections in this pack are the steel erection hazard modules selected for this CSEP. Cross-read Section 10 IIPP / Emergency Response; Section 11 Hazards and Controls (match each subsection below to its same-titled or companion block in the main hazards section; include Steel Erection Hazard-Control Matrix when that matrix appears in the steel portion of the generated plan); and Appendix E. Task-Hazard-Control Matrix. Regulatory anchors are 29 CFR 1926 Subpart R and any Subpart CC hoisting content referenced in the modules or the site lift plan, as applicable.",
      inlineOshaRefs
    ),
    subsections: hazardModules.map((item) => buildSteelErectionHazardModuleSubsection(item)),
  };
}

function getSteelProgramModulesFromGenerationContext(
  generationContext: SafetyPlanGenerationContext
): SteelProgramModuleContextRow[] {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.steelProgramModules)) return [];
  const fullModules = buildModuleLookup(getSteelErectionProgramModules());

  return metadata.steelProgramModules
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) =>
      mergeReferencePackContext(
        {
          title: textOrNull(item.title) ?? "Steel program module",
          moduleKey: textOrNull(item.moduleKey) ?? "steel_program_module",
          summary: textOrNull(item.summary) ?? "No summary provided.",
          sectionHeadings: stringList(item.sectionHeadings),
          plainText: textOrNull(item.plainText) ?? "",
          sourceFilename: textOrNull(item.sourceFilename) ?? "Unknown source",
          matchedReasons: stringList(item.matchedReasons),
        },
        fullModules.get(textOrNull(item.moduleKey) ?? "")
      )
    )
    .filter((item) => item.title && item.summary)
    .map((item) => sanitizeSteelModuleRow(item));
}

function buildSteelProgramModulesReferenceSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection | null {
  const programModules = getSteelProgramModulesFromGenerationContext(generationContext);
  if (!programModules.length) return null;

  return {
    key: "steel_program_modules_reference",
    title: "Steel Erection High-Risk Programs Reference Pack",
    body: appendInlineOsha(
      "The subsections in this pack are the high-risk program modules (leading edge, CDZ, multi-lift, etc.) selected for steel erection. See Section 10 IIPP / Emergency Response; Section 11 Hazards and Controls for the program blocks and steel subsections; and Appendix E. Task-Hazard-Control Matrix when program controls are line-listed there. See 29 CFR 1926 Subpart R, including 29 CFR 1926.760 (fall protection during steel erection), as cited in the program text and this CSEP's steel plan.",
      inlineOshaRefs
    ),
    subsections: programModules.map((item) => buildSteelProgramModuleSubsection(item)),
  };
}

function hasSelectedCsepBlock(
  instructions: CsepBuilderInstructions | null,
  key: CsepBuilderBlockKey
) {
  if (!instructions) return true;
  return instructions.selectedBlockKeys.includes(key);
}

function getCsepBlockInput(
  instructions: CsepBuilderInstructions | null,
  key: CsepBuilderBlockKey
) {
  if (!instructions) return null;
  return instructions.blockInputs[key] ?? null;
}

function asTextList(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function asTextValue(value: string | string[] | null | undefined) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function combineParagraphs(parts: Array<string | null | undefined>, fallback?: string) {
  const value = parts.map((part) => part?.trim()).filter(Boolean).join(" ");
  return value || fallback || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripStandaloneHeadingPrefix(value: string, title: string) {
  const cleanTitle = cleanFinalText(title);
  if (!cleanTitle) return value.trim();

  return value
    .replace(
      new RegExp(`^(?:\\d+(?:\\.\\d+)*[.)]?\\s*)?${escapeRegExp(cleanTitle)}\\s*:?\\s*`, "i"),
      ""
    )
    .trim();
}

/**
 * IIPP health block: scannable 5.6.x controls (not one dense paragraph).
 * Optional `healthInput` is appended to 5.6 as project/site notes from the builder.
 */
function buildHealthAndWellnessExpectationsSubsections(
  healthInput: string | null | undefined
): GeneratedSafetyPlanSubsection[] {
  const notes = healthInput?.replace(/\r\n?/g, "\n").trim();
  const intro = [
    "Field controls for fit-for-duty, heat and fatigue, hygiene, and exposure reporting. The subsections below are the minimum expectations for daily execution.",
    notes ? `Project- or site-specific notes: ${notes}` : null,
  ]
    .filter((p): p is string => Boolean(p?.trim()))
    .join("\n\n");

  return [
    {
      title: "5.6 Health and Wellness Expectations",
      body: intro,
      bullets: [],
    },
    {
      title: "5.6.1 Fit for duty",
      body: "Minimum Requirement: Workers must be fit for assigned tasks. Do not work when illness, injury, or fatigue would make the job unsafe. Supervision shall reassign or stand down workers who are not fit for exposed, safety-sensitive, or at-height work.",
      bullets: [],
    },
    {
      title: "5.6.2 Hydration",
      body: "Minimum Requirement: Provide access to clean drinking water at all times. Increase water availability and break frequency during hot weather, high-exertion work, or extended steel erection or outdoor activity.",
      bullets: [],
    },
    {
      title: "5.6.3 Fatigue management",
      body: "Minimum Requirement: Schedule breaks that match the work and weather. Watch for heat stress, exhaustion, or loss of focus. Stop or re-plan work when fatigue would reduce safe performance.",
      bullets: [],
    },
    {
      title: "5.6.4 Sanitation and hygiene",
      body: "Minimum Requirement: Maintain clean restroom and handwashing access for all workers. Service facilities on a regular schedule and keep them reachable throughout the shift.",
      bullets: [],
    },
    {
      title: "5.6.5 Exposure management",
      body: "Minimum Requirement: When chemical, noise, dust, or similar site exposures apply, use the project controls in place (PPE, engineering, work rotation, decontamination). Report symptoms, suspected overexposures, or control failures to supervision or the site safety lead.",
      bullets: [],
    },
    {
      title: "5.6.6 Worker wellness / reporting concerns",
      body: "Minimum Requirement: Report injuries, near misses, and unsafe conditions promptly. Workers may raise health and safety concerns to supervision or site safety. Support first-aid access and follow-up with medical or occupational guidance when required, without fear of reprisal for good-faith reporting.",
      bullets: [],
    },
  ];
}

/**
 * IIPP incident block: 5.7.x controls (scannable, not one narrative blob).
 * `incidentInput` is appended to 5.7 as builder/project notes. Steel/ironworker fall emphasis when scope applies.
 */
function buildIncidentReportingInvestigationSubsections(
  incidentInput: string | null | undefined,
  steelErectionInScope: boolean
): GeneratedSafetyPlanSubsection[] {
  const notes = incidentInput?.replace(/\r\n?/g, "\n").trim();
  const opening =
    "Incident reporting and investigation are required to ensure injuries, near misses, property damage, fall exposures, and other safety events are reported promptly, investigated thoroughly, and corrected to prevent recurrence.";

  const steelFallNote = steelErectionInScope
    ? "For this trade, fall from height is one of the most significant exposures and shall be treated as a primary reporting and investigation trigger whenever a fall, fall arrest, leading-edge event, decking exposure, or dropped-object incident occurs."
    : "Fall from height, struck-by, and other high-energy exposures in the active scope are treated as high-priority report and review triggers when they occur.";

  const section57Body = [
    opening,
    steelFallNote,
    notes ? `Builder or project-specific requirements: ${notes}` : null,
  ]
    .filter((p): p is string => Boolean(p?.trim()))
    .join("\n\n");

  return [
    {
      title: "5.7 Incident Reporting and Investigation",
      body: section57Body,
      bullets: [],
    },
    {
      title: "5.7.1 Immediate reporting",
      body: "Minimum Requirement: Report work-related injuries, serious illnesses, and dangerous occurrences to supervision and the employer as soon as the scene is safe, and within any site or contract time limit. Escalate to site safety and the owner or GC/CM when program rules, law, or contract require. Treat hospitalization, emergency medical response, or potential recordable and fatality events with same-shift notification. Do not wait for a full write-up before starting the report chain.",
      bullets: [],
    },
    {
      title: "5.7.2 Scene protection and access control",
      body: "Minimum Requirement: Stabilize the situation, stop additional exposure, and protect the scene. Mark or barricade the area, control access, and keep lines of fire clear for EMS. Do not move equipment or materials or alter the scene for convenience until the competent investigation lead releases the scene, except to prevent further injury, unstable loads, or life safety risk.",
      bullets: [],
    },
    {
      title: "5.7.3 Supervisor responsibilities",
      body: "Minimum Requirement: Supervision shall confirm that reporting is in progress, that affected workers get medical or first aid as needed, and that witnesses and involved crew are identified. Supervision shall assign an investigator, preserve evidence, and keep restart or demobilization under their approval until the initial facts are recorded.",
      bullets: [],
    },
    {
      title: "5.7.4 Investigation and documentation",
      body: "Minimum Requirement: Perform a fact-based review: who, what, when, where, training and permits, equipment, and environmental factors. Use interviews, photos or sketches, and JHA, permit, and equipment records as needed. File the investigation record per employer and site rules, including regulatory and owner notifications when required. Focus on system causes, not blame alone.",
      bullets: [],
    },
    {
      title: "5.7.5 Corrective actions and follow-up",
      body: "Minimum Requirement: Document corrective and preventive actions with owners and dates. Close items only after the fix is in place and verified. Re-brief the crew and update the JHA, tools, or training if the event shows a weak control. Track repeat events for trend review.",
      bullets: [],
    },
    {
      title: "5.7.6 Near-miss reporting",
      body: "Minimum Requirement: Report near misses that could have caused serious injury, especially unplanned release of energy, line-of-fire events, and fall or dropped-load scenarios. Use the same reporting path as for injuries when the site requires; record near misses for lessons learned and trend review whether or not someone was hurt.",
      bullets: [],
    },
  ];
}

function buildStandaloneSubsectionContent(params: {
  title: string;
  value: string | null | undefined;
  fallbackBody: string;
  fallbackBullets?: string[];
}) {
  const normalized = params.value?.replace(/\r\n?/g, "\n").trim() ?? "";

  if (!normalized) {
    return {
      body: params.fallbackBody,
      bullets: params.fallbackBullets ?? [],
    };
  }

  const bulletItems = dedupe(
    normalized
      .split("\n")
      .map((line) => stripStandaloneHeadingPrefix(line.trim(), params.title))
      .filter(Boolean)
      .filter((line) => /^([-*\u2022]|\d+(?:\.\d+)*[.)])\s+/.test(line))
      .map((line) => line.replace(/^([-*\u2022]|\d+(?:\.\d+)*[.)])\s+/, "").trim())
      .filter(Boolean)
  );

  const paragraphBlocks = normalized
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => stripStandaloneHeadingPrefix(line.trim(), params.title))
        .filter(Boolean)
    )
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.filter((line) => !/^([-*\u2022]|\d+(?:\.\d+)*[.)])\s+/.test(line)).join(" ").trim())
    .map((block) => block.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  return {
    body: paragraphBlocks.join("\n\n") || params.fallbackBody,
    bullets: bulletItems.length ? bulletItems : params.fallbackBullets ?? [],
  };
}

function buildStructuredRowSubsections(
  columns: string[],
  rows: string[][]
): GeneratedSafetyPlanSubsection[] {
  const detailColumns = columns.slice(1);

  return rows
    .map((row, index) => {
      const title = cleanFinalText(row[0]) || `${cleanFinalText(columns[0]) || "Item"} ${index + 1}`;
      const paragraphs = detailColumns
        .map((column, columnIndex) => {
          const value = cleanFinalText(row[columnIndex + 1]) || "N/A";
          return `${column}: ${value}`;
        })
        .filter(Boolean);

      return {
        title,
        body: paragraphs.join("\n\n") || null,
        bullets: [],
      };
    })
    .filter((subsection) => Boolean(subsection.title));
}

function prefixedInstructionBullets(values: string[], prefix: string) {
  const normalizedPrefix = prefix.toLowerCase();
  return dedupe(
    values
      .filter((item) => item.toLowerCase().startsWith(normalizedPrefix))
      .map((item) => item.slice(prefix.length).trim())
      .filter(Boolean)
  );
}

/** Split builder weather lines; "Environmental control:" lines belong in Environmental Controls (Section 11.0), not here. */
function partitionCsepWeatherInput(values: string[]) {
  const monitoring: string[] = [];
  const communication: string[] = [];
  const other: string[] = [];
  let skippedEnvironmental = false;
  for (const raw of values) {
    const line = cleanFinalText(String(raw)) ?? "";
    if (!line) continue;
    const lo = line.toLowerCase();
    if (lo.startsWith("monitoring source:")) {
      monitoring.push(line.replace(/^monitoring source:\s*/i, "").trim());
    } else if (lo.startsWith("communication method:")) {
      communication.push(line.replace(/^communication method:\s*/i, "").trim());
    } else if (lo.startsWith("environmental control:")) {
      skippedEnvironmental = true;
    } else {
      other.push(line);
    }
  }
  return { monitoring, communication, other, skippedEnvironmental };
}

function humanizeCode(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function orderGeneratedSections(
  sections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const isPshsep = sections.some((section) =>
    [
      "project_oversight_roles",
      "contractor_coordination",
      "incident_injury_response",
      "inspections_recurring_events",
    ].includes(section.key)
  );
  const definitionsSection = sections.find((section) => section.key === "definitions");
  const referencesSection = sections.find(
    (section) =>
      section.key === "references" ||
      section.key === "osha_references" ||
      section.key === "osha_reference_appendix"
  );
  const jurisdictionProfileSection = sections.find(
    (section) => section.key === "jurisdiction_profile"
  );
  const remainingSections = sections.filter(
    (section) =>
      section.key !== definitionsSection?.key &&
      section.key !== referencesSection?.key &&
      section.key !== jurisdictionProfileSection?.key
  );

  const pshsepOrderedRemainder = (() => {
    if (!isPshsep) return null;
    const narrativeSections = remainingSections.filter(
      (section) => !section.table && !section.key.startsWith("program_permit__")
    );
    const tableSections = remainingSections.filter((section) => Boolean(section.table));
    const permitProgramSections = remainingSections.filter((section) =>
      section.key.startsWith("program_permit__")
    );
    return [...narrativeSections, ...tableSections, ...permitProgramSections];
  })();

  return [
    ...(definitionsSection ? [definitionsSection] : []),
    ...(isPshsep
      ? [...(referencesSection ? [referencesSection] : []), ...(jurisdictionProfileSection ? [jurisdictionProfileSection] : [])]
      : [...(jurisdictionProfileSection ? [jurisdictionProfileSection] : []), ...(referencesSection ? [referencesSection] : [])]),
    ...(pshsepOrderedRemainder ?? remainingSections),
  ];
}

function orderCsepReferencePacksBeforePrograms(
  sections: GeneratedSafetyPlanSection[]
): GeneratedSafetyPlanSection[] {
  const referencePackKeys = new Set([
    "task_modules_reference",
    "hazard_modules_reference",
    "steel_task_modules_reference",
    "steel_hazard_modules_reference",
    "steel_program_modules_reference",
  ]);
  const referencePacks = sections.filter((section) => referencePackKeys.has(section.key));

  if (!referencePacks.length) return sections;

  const withoutReferencePacks = sections.filter((section) => !referencePackKeys.has(section.key));
  const firstProgramIndex = withoutReferencePacks.findIndex((section) =>
    section.key.startsWith("program_")
  );

  if (firstProgramIndex === -1) {
    return [...withoutReferencePacks, ...referencePacks];
  }

  return [
    ...withoutReferencePacks.slice(0, firstProgramIndex),
    ...referencePacks,
    ...withoutReferencePacks.slice(firstProgramIndex),
  ];
}

function buildPshsepAdminSections(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection[] {
  const structured = getPshsepStructuredInputs(generationContext);
  const disciplinaryPolicy =
    structured.disciplinaryPolicyText ??
    "Each employer must enforce progressive discipline for noncompliance with plan requirements, including stop-work and removal where needed.";
  const ownerLetter =
    structured.ownerLetterText ??
    `Owner leadership affirms that all contractors must plan work safely, comply with this ${SITE_SAFETY_BLUEPRINT_TITLE}, and immediately report hazards and incidents.`;
  const specialConditionsPermit =
    structured.specialConditionsPermitText ??
    `Any variation from this ${SITE_SAFETY_BLUEPRINT_TITLE} requires documented review, approval authority, temporary controls, and expiration criteria.`;

  return [
    {
      key: "admin_disciplinary_policy",
      title: "Disciplinary Policy",
      body: appendInlineOsha(disciplinaryPolicy, inlineOshaRefs),
    },
    {
      key: "admin_owner_letter",
      title: "Letter from Owner",
      body: appendInlineOsha(ownerLetter, inlineOshaRefs),
    },
    {
      key: "admin_special_conditions_permit",
      title: "Special Conditions Permit (Variations)",
      body: appendInlineOsha(specialConditionsPermit, inlineOshaRefs),
    },
    {
      key: "admin_assumed_trades_index",
      title: "Assumed Trades Index",
      body: appendInlineOsha(
        structured.assumedTrades.length
          ? "The following trades are assumed to participate and must coordinate pre-task planning."
          : "No assumed trades were provided in the current draft.",
        inlineOshaRefs
      ),
      bullets: structured.assumedTrades.length
        ? structured.assumedTrades
        : ["No assumed trades were listed."],
    },
  ];
}

function hasAnyToken(values: string[], tokens: string[]) {
  const haystack = values.join(" | ").toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function appendSentence(base: string | null | undefined, addition: string | null | undefined) {
  const parts = [base?.trim(), addition?.trim()].filter(Boolean);
  return parts.join(" ");
}

function buildTextFromParts(parts: Array<string | null | undefined>, fallback: string) {
  const text = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return text || fallback;
}

function getPshsepStructuredInputs(generationContext: SafetyPlanGenerationContext) {
  const metadata = (generationContext.siteContext.metadata ?? {}) as Record<string, unknown>;
  const starterSections = (metadata.starterSections ?? {}) as Record<string, unknown>;
  const legacy = generationContext.legacyFormSnapshot as Record<string, unknown>;
  const emergencyMap = (metadata.emergencyMap ?? {}) as Record<string, unknown>;

  return {
    ownerSpecificRequirementsText: textOrNull(
      starterSections.ownerSpecificRequirementsText ?? legacy.owner_specific_requirements_text
    ),
    definitionsText: textOrNull(starterSections.definitionsText ?? legacy.definitions_text),
    oversightRolesText: textOrNull(starterSections.oversightRolesText ?? legacy.oversight_roles_text),
    competentPersonRequirementsText: textOrNull(
      starterSections.competentPersonRequirementsText ??
        legacy.competent_person_requirements_text
    ),
    staffingRequirementsText: textOrNull(
      starterSections.staffingRequirementsText ?? legacy.staffing_requirements_text
    ),
    tradeTrainingRequirementsText: textOrNull(
      starterSections.tradeTrainingRequirementsText ??
        legacy.trade_training_requirements_text
    ),
    certificationRequirementsText: textOrNull(
      starterSections.certificationRequirementsText ??
        legacy.certification_requirements_text
    ),
    contractorCoordinationText: textOrNull(
      starterSections.contractorCoordinationText ?? legacy.contractor_coordination_text
    ),
    ancillaryContractors: stringList(
      starterSections.ancillaryContractors ?? legacy.ancillary_contractors
    ),
    ancillaryContractorsNotes: textOrNull(
      starterSections.ancillaryContractorsNotes ?? legacy.ancillary_contractors_notes
    ),
    disciplinaryPolicyText: textOrNull(
      starterSections.disciplinaryPolicyText ?? legacy.disciplinary_policy_text
    ),
    ownerLetterText: textOrNull(starterSections.ownerLetterText ?? legacy.owner_letter_text),
    incidentReportingProcessText: textOrNull(
      starterSections.incidentReportingProcessText ??
        legacy.incident_reporting_process_text
    ),
    incidentInvestigationText: textOrNull(
      starterSections.incidentInvestigationText ?? legacy.incident_investigation_text
    ),
    specialConditionsPermitText: textOrNull(
      starterSections.specialConditionsPermitText ??
        legacy.special_conditions_permit_text
    ),
    assumedTrades: stringList(starterSections.assumedTradesIndex ?? legacy.assumed_trades_index),
    highRiskFocusAreas: stringList(
      starterSections.highRiskFocusAreas ?? legacy.high_risk_focus_areas
    ),
    clinicName: textOrNull(starterSections.clinicName ?? legacy.clinic_name),
    clinicAddress: textOrNull(starterSections.clinicAddress ?? legacy.clinic_address),
    clinicHours: textOrNull(starterSections.clinicHours ?? legacy.clinic_hours),
    postedEmergencyContactsText: textOrNull(
      starterSections.postedEmergencyContactsText ??
        legacy.posted_emergency_contacts_text
    ),
    emergencyPostingLocation: textOrNull(
      starterSections.emergencyPostingLocation ?? legacy.emergency_posting_location
    ),
    inspectionProcessText: textOrNull(
      starterSections.inspectionProcessText ?? legacy.inspection_process_text
    ),
    eventCalendarItems: stringList(
      starterSections.eventCalendarItems ?? legacy.event_calendar_items
    ),
    eventCalendarNotesText: textOrNull(
      starterSections.eventCalendarNotesText ?? legacy.event_calendar_notes_text
    ),
    weatherSopText: textOrNull(starterSections.weatherSopText ?? legacy.weather_sop_text),
    environmentalControlsText: textOrNull(
      starterSections.environmentalControlsText ?? legacy.environmental_controls_text
    ),
    ppeSpecificsText: textOrNull(starterSections.ppeSpecificsText ?? legacy.ppe_specifics_text),
    equipmentControlsText: textOrNull(
      starterSections.equipmentControlsText ?? legacy.equipment_controls_text
    ),
    chemicalStorageText: textOrNull(
      starterSections.chemicalStorageText ?? legacy.chemical_storage_text
    ),
    aedLocation: textOrNull(emergencyMap.aed_location),
    firstAidLocation: textOrNull(emergencyMap.first_aid_location),
    assemblyPoint: textOrNull(emergencyMap.assembly_point),
    nearestHospital: textOrNull(emergencyMap.nearest_hospital),
    emergencyContact: textOrNull(emergencyMap.emergency_contact),
    emergencyMapAttached: Boolean(textOrNull(emergencyMap.site_map)),
  };
}

function buildPshsepCoreSections(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[],
  ruleSummary: {
    permitTriggers: string[];
    ppeRequirements: string[];
    requiredControls: string[];
    hazardCategories: string[];
    siteRestrictions: string[];
    prohibitedEquipment: string[];
    trainingRequirements: string[];
    weatherRestrictions: string[];
  }
): GeneratedSafetyPlanSection[] {
  const structured = getPshsepStructuredInputs(generationContext);
  const trainingRows = [
    [
      "OSHA 10",
      generationContext.legacyFormSnapshot.requires_osha10 ? "Required" : "Not specified",
    ],
    [
      "OSHA 30 (PM / Superintendent)",
      generationContext.legacyFormSnapshot.requires_osha30_pm_super_within_5yrs
        ? "Required within the stated refresh window"
        : "Not specified",
    ],
    [
      "On-site OSHA 30 supervision",
      generationContext.legacyFormSnapshot.requires_osha30_supervisor_on_site
        ? "Required"
        : "Not specified",
    ],
    [
      "Orientation / access",
      generationContext.legacyFormSnapshot.orientation_required
        ? "Orientation required before work starts"
        : "Orientation requirement not specified",
    ],
    [
      "Trade / certification notes",
      sentenceList(
        [
          structured.tradeTrainingRequirementsText ?? "",
          structured.certificationRequirementsText ?? "",
        ].filter(Boolean),
        "No project-specific trade or certification notes were provided."
      ),
    ],
  ];

  return [
    {
      key: "project_oversight_roles",
      title: "Project Oversight, Roles & Staffing",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.oversightRolesText,
            structured.competentPersonRequirementsText,
            structured.staffingRequirementsText,
          ],
          "Describe how owner, GC / CM, contractor supervision, and designated competent persons oversee the work and adjust staffing as the project scales."
        ),
        inlineOshaRefs
      ),
      bullets: dedupe(
        [
          generationContext.project.ownerClient
            ? `Owner / client: ${generationContext.project.ownerClient}`
            : "",
          generationContext.project.gcCm ? `GC / CM: ${generationContext.project.gcCm}` : "",
          generationContext.project.contractorCompany
            ? `Contractor: ${generationContext.project.contractorCompany}`
            : "",
          structured.ownerSpecificRequirementsText
            ? `Owner-specific requirements captured for this project.`
            : "",
        ].filter(Boolean)
      ),
    },
    {
      key: "contractor_coordination",
      title: "Contractor Coordination & Ancillary Contractors",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.contractorCoordinationText, structured.ancillaryContractorsNotes],
          "Coordinate primary trades and ancillary service providers before startup so access, housekeeping, waste removal, and shared-area controls are defined in advance."
        ),
        inlineOshaRefs
      ),
      bullets: dedupe([
        ...(structured.assumedTrades.length
          ? structured.assumedTrades.map((trade) => `Assumed trade: ${trade}`)
          : ["Assumed trade list not yet provided."]),
        ...(structured.ancillaryContractors.length
          ? structured.ancillaryContractors.map(
              (contractor) => `Ancillary contractor: ${contractor}`
            )
          : ["No ancillary contractor list provided."]),
      ]),
    },
    {
      key: "training_certifications",
      title: "Training & Certification Requirements",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.tradeTrainingRequirementsText,
            structured.certificationRequirementsText,
          ],
          "Document trade-specific training, equipment qualifications, and certification expectations before mobilization rather than waiting for the safety team to request missing records."
        ),
        inlineOshaRefs
      ),
      table: {
        columns: ["Requirement", "Expectation"],
        rows: trainingRows,
      },
    },
    {
      key: "incident_injury_response",
      title: "Incident, Injury & Investigation Response",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.incidentReportingProcessText,
            structured.incidentInvestigationText,
          ],
          `This section applies to every ${SITE_SAFETY_BLUEPRINT_TITLE} and must explain who reports injuries, when escalation occurs, where treatment is obtained, and how investigations and corrective actions are documented.`
        ),
        inlineOshaRefs
      ),
      bullets: dedupe([
        structured.emergencyContact
          ? `Emergency contact number: ${structured.emergencyContact}`
          : "",
        structured.nearestHospital
          ? `Nearest hospital: ${structured.nearestHospital}`
          : "",
      ]),
    },
    {
      key: "emergency_facilities_contacts",
      title: "Emergency Facilities, Posting & Site Contacts",
      body: appendInlineOsha(
        buildTextFromParts(
          [
            structured.postedEmergencyContactsText,
            structured.emergencyPostingLocation,
          ],
          "Identify treatment resources, emergency equipment, posted contacts, and the addendum or posting locations crews will use in the field."
        ),
        inlineOshaRefs
      ),
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Clinic / occupational health provider", structured.clinicName ?? "N/A"],
          ["Clinic address", structured.clinicAddress ?? "N/A"],
          ["Clinic hours", structured.clinicHours ?? "N/A"],
          ["AED location", structured.aedLocation ?? "N/A"],
          ["First aid location", structured.firstAidLocation ?? "N/A"],
          ["Assembly point", structured.assemblyPoint ?? "N/A"],
          ["Nearest hospital", structured.nearestHospital ?? "N/A"],
          ["Emergency contact", structured.emergencyContact ?? "N/A"],
          ["Emergency map attached", structured.emergencyMapAttached ? "Yes" : "No"],
        ],
      },
    },
    {
      key: "inspections_recurring_events",
      title: "Inspections & Recurring Event Calendar",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.inspectionProcessText, structured.eventCalendarNotesText],
          `Define routine inspections, trigger-based inspections, agency walk-throughs, and recurring event cadence so the ${SITE_SAFETY_BLUEPRINT_TITLE} becomes an operating calendar instead of a static narrative.`
        ),
        inlineOshaRefs
      ),
      bullets: structured.eventCalendarItems.length
        ? structured.eventCalendarItems
        : ["No recurring event calendar items were listed."],
    },
    {
      key: "weather_environmental_controls",
      title: "Weather & Environmental Controls",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.weatherSopText, structured.environmentalControlsText],
          "Address weather-triggered stop-work or review conditions, stormwater controls, waste-stream handling, and environmental walk expectations in terms crews can apply in the field."
        ),
        inlineOshaRefs
      ),
      bullets: dedupe([
        ...ruleSummary.weatherRestrictions,
        structured.chemicalStorageText
          ? "Chemical and gas storage expectations are defined for compatibility, labeling, and separation."
          : "",
      ]),
    },
    {
      key: "ppe_work_access_controls",
      title: "PPE, Access & Work Access Controls",
      body: appendInlineOsha(
        buildTextFromParts(
          [structured.ppeSpecificsText, structured.equipmentControlsText],
          "Clarify PPE expectations, access equipment rules, tag systems, and charging / staging controls so the document addresses common field execution gaps directly."
        ),
        inlineOshaRefs
      ),
      table: {
        columns: ["Category", "Expectation"],
        rows: [
          ["PPE", sentenceList(ruleSummary.ppeRequirements, "See project-specific PPE text.")],
          ["Required controls", sentenceList(ruleSummary.requiredControls)],
          ["Site restrictions", sentenceList(ruleSummary.siteRestrictions, "None listed.")],
          [
            "Prohibited equipment",
            sentenceList(ruleSummary.prohibitedEquipment, "None listed."),
          ],
        ],
      },
    },
  ];
}

function buildPshsepHighRiskSections(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection[] {
  const structured = getPshsepStructuredInputs(generationContext);
  const tokenSource = [
    ...generationContext.scope.trades,
    ...generationContext.scope.tasks,
    ...structured.highRiskFocusAreas,
    ...(generationContext.operations.flatMap((operation) =>
      stringList((operation.metadata as Record<string, unknown> | undefined)?.permitLabels)
    ) ?? []),
  ];

  const sectionConfigs = [
    {
      key: "high_risk_excavation",
      title: "Excavation & Ground Disturbance",
      tokens: ["excavat", "trench", "groundbreaking"],
      body:
        "Address competent-person oversight, utility verification, ingress / egress, spoil management, adjacent loads, water intrusion, and atmospheric evaluation where trench conditions warrant it.",
      bullets: [
        "Define when excavation permits or notifications are required before breaking ground.",
        "Describe trench access, inspections, and escalation for changing soil or water conditions.",
      ],
    },
    {
      key: "high_risk_confined_space",
      title: "Confined Space Entry",
      tokens: ["confined", "tank entry", "entry"],
      body:
        "Separate permit-required and non-permit evaluations, define entrant / attendant / supervisor responsibilities, and explain monitoring, rescue planning, and retrieval equipment expectations.",
      bullets: [
        "Clarify how trench, vault, or tank entries are evaluated before work begins.",
        "Document attendant, rescue, first-aid, and atmospheric monitoring expectations.",
      ],
    },
    {
      key: "high_risk_loto",
      title: "LOTO & Stored Energy Isolation",
      tokens: ["loto", "electrical", "stored energy", "isolation"],
      body:
        "Cover all energy sources, zero-energy verification, group lockout, shift change continuity, and any owner or project-specific energized-work escalation process.",
      bullets: [
        "Do not limit this section to electrical isolation when hydraulic, pneumatic, thermal, or other stored energy exists.",
        "Explain how verification is documented before crews begin work.",
      ],
    },
    {
      key: "high_risk_hot_work",
      title: "Hot Work & Fire Watch",
      tokens: ["hot work", "fire watch", "welding"],
      body:
        "Define how hot work permits are issued, what changes require revalidation, where fire watches are stationed, and how long monitoring continues based on project and governing requirements.",
      bullets: [
        "State who may issue permits and how shift, floor, wall, or barrier changes are handled.",
        "Require extinguishing equipment and dedicated fire-watch coverage without assigning unrelated duties.",
      ],
    },
    {
      key: "high_risk_access",
      title: "Ladders, Scaffolds & Work Access",
      tokens: ["ladder", "scaffold", "access", "mewp", "roof"],
      body:
        "Address approved ladder types, scaffold tag conditions, fall-protection triggers for access changes, and restrictions on unsuitable or improvised access equipment.",
      bullets: [
        "Explain tag colors or site status indicators where those are used on the project.",
        "Clarify access expectations for elevated scaffold ladders, MEWPs, and temporary access points.",
      ],
    },
    {
      key: "high_risk_equipment",
      title: "Heavy Equipment, Travel Paths & Spotters",
      tokens: ["equipment", "forklift", "crane", "spotter", "material handling"],
      body:
        "Define travel paths, exclusion zones, backing / blind-spot support, charging or fueling housekeeping, and when spotters are required or may only be downgraded by project-specific decision.",
      bullets: [
        "Prevent cords, hoses, or fuel lines from blocking egress and walking surfaces.",
        "Describe communication expectations between operators and spotters during movement and setup.",
      ],
    },
    {
      key: "high_risk_hand_power_tools",
      title: "Hand & Power Tools",
      tokens: ["hand", "power tool", "tool"],
      body:
        "Expand beyond generic tool language by addressing hand placement, line-of-fire exposure, guards and grips, hose / air connection integrity, and maintenance expectations.",
      bullets: [
        "Use task examples where needed so tool requirements are not confused with equipment sections.",
        "Address compressed air use, fittings, and reduction requirements based on tool design and manufacturer instructions.",
      ],
    },
    {
      key: "high_risk_steel_erection",
      title: "Steel Erection, Rigging & Related Hot Work",
      tokens: ["steel", "rigging", "ironworker", "crane"],
      body:
        "Describe sequencing, fall protection, rigging review, crane coordination, connector and ironworker qualifications, and related welding or panel work that occurs during steel operations.",
      bullets: [
        "Order the section to match how steel work occurs on site rather than leaving it as a late generic add-on.",
        "Cross-reference common issues such as crane, hot work, and line-of-fire controls where applicable.",
      ],
    },
    {
      key: "high_risk_concrete_masonry",
      title: "Concrete, Masonry & Washout Controls",
      tokens: ["concrete", "masonry", "cmu"],
      body:
        "Address boom or placement equipment, washout locations, ground protection, material storage, slurry handling, and labeling or environmental controls tied to concrete and masonry work.",
      bullets: [
        "Include storage and stacking expectations where material stability matters.",
        "Define washout and slurry containment before work starts.",
      ],
    },
    {
      key: "high_risk_hazardous_waste",
      title: "Hazardous Waste & Environmental Release Prevention",
      tokens: ["hazardous waste", "environmental", "stormwater", "waste"],
      body:
        "Define waste-stream labeling, spill prevention, release response, stormwater checks, and environmental event walk expectations so field teams understand the site-specific environmental program.",
      bullets: [
        "Identify how liquid and solid waste streams are labeled and separated.",
        "Add routine environmental walks or stormwater checks to the event calendar where required.",
      ],
    },
    {
      key: "high_risk_chemical_storage",
      title: "Gases, Chemicals & Storage Compatibility",
      tokens: ["gas", "chemical", "storage", "oxygen", "cylinder"],
      body: appendSentence(
        "Document compatibility / incompatibility, storage locations, labeling, separation expectations, and handling requirements for gases and chemicals used or stored on site.",
        structured.chemicalStorageText
      ),
      bullets: [
        "Do not leave this section at 'where applicable'; explain how location, distance, or barrier decisions are made on the project.",
        "Address container labeling and storage segregation for chemicals, oxidizers, and compressed gases.",
      ],
    },
  ];

  return sectionConfigs
    .filter((config) => hasAnyToken(tokenSource, config.tokens))
    .map((config) => ({
      key: config.key,
      title: config.title,
      body: appendInlineOsha(config.body, inlineOshaRefs),
      bullets: config.bullets,
    }));
}

function collectOshaReferences(
  generationContext: SafetyPlanGenerationContext,
  programSections: GeneratedSafetyPlanSection[],
  narrativeSections?: Record<string, string>
) {
  const refs = new Set<string>();
  for (const operation of generationContext.operations) {
    const operationRefs = stringList((operation.metadata as Record<string, unknown> | undefined)?.oshaRefs);
    operationRefs.forEach((ref) => refs.add(ref));
  }
  for (const section of programSections) {
    const refsSection = section.subsections?.find((subsection) => subsection.title === "Applicable References");
    refsSection?.bullets?.forEach((ref) => refs.add(ref));
    for (const subsection of section.subsections ?? []) {
      subsection.bullets?.forEach((b) => {
        if (/\bOSHA\b|29\s*CFR|\b1926\b/i.test(b)) refs.add(b.trim());
      });
      const body = subsection.body;
      if (!body) continue;
      for (const match of body.matchAll(/\bR\d+\s+([^R]+?)(?=\s+R\d+|$)/g)) {
        const chunk = match[1]?.replace(/\s+/g, " ").trim();
        if (chunk && /\bOSHA\b|29\s*CFR|\b1926\b/i.test(chunk)) {
          refs.add(chunk.replace(/[.;]+$/, ""));
        }
      }
    }
  }
  Object.values(narrativeSections ?? {}).forEach((value) => {
    const extracted = extractInlineOshaSuffix(value);
    if (!extracted?.referencesText) return;

    extracted.referencesText
      .split(/\s*,\s*/)
      .map((reference) => reference.trim())
      .filter(Boolean)
      .forEach((reference) => refs.add(reference));
  });
  return [...refs];
}

type DraftParams = {
  generationContext: SafetyPlanGenerationContext;
  reviewContext: AiReviewContext;
  conflictMatrix: ConflictMatrix;
  programDefinitions?: CSEPProgramDefinition[];
  jurisdictionStandardsConfig?: JurisdictionStandardsConfig;
  trainingProgram?: SafetyPlanTrainingProgram;
  narrativeSections?: Record<string, string>;
  aiAssemblyDecisions?: CsepAiAssemblyDecisions | null;
  riskMemorySummary?: JsonObject | null;
};

function buildTrainingProgramSection(
  trainingProgram: SafetyPlanTrainingProgram
): GeneratedSafetyPlanSection {
  const recordsNote =
    " Training records, certifications, and qualification documents shall be maintained current and made available to CM / HSE, site supervision, and owner representatives for verification upon request and before personnel perform work requiring that qualification.";
  return {
    key: "training_program",
    title: "Training Program",
    body: trainingProgram.rows.length
      ? `Training requirements were derived from the selected trade scope, task templates, and rule evaluation outputs for the current contractor plan.${recordsNote}`
      : `No task-based training requirements were derived from the current contractor plan inputs.${recordsNote}`,
    table: {
      columns: ["Trade", "Subtrade", "Task", "Required Training", "Why / Source"],
      rows: trainingProgram.rows.length
        ? trainingProgram.rows.map((row) => [
            row.tradeLabel ?? row.tradeCode ?? "N/A",
            row.subTradeLabel ?? row.subTradeCode ?? "N/A",
            row.taskTitle,
            row.trainingTitle,
            row.whySource,
          ])
        : [["N/A", "N/A", "N/A", "No task-based training derived", "N/A"]],
    },
  };
}

function buildTradeConflictCoordinationSection(
  generationContext: SafetyPlanGenerationContext,
  inlineOshaRefs: string[]
): GeneratedSafetyPlanSection {
  const profile = getTradeConflictProfile(
    generationContext.documentProfile.projectDeliveryType
  );

  return {
    key: "trade_conflict_coordination_framework",
    title: "Trade Conflict Coordination Framework",
    body: appendInlineOsha(
      `This baseline trade coordination map reflects the ${projectDeliveryTypeLabel(
        generationContext.documentProfile.projectDeliveryType
      )} delivery profile. Use it alongside the current simultaneous-operations findings: the baseline framework highlights typical phase-to-trade interfaces, while the conflict engine identifies project-specific overlaps that are active in the current plan.`,
      inlineOshaRefs
    ),
    table: {
      columns: ["Phase", "Trade / Function", "Typical Conflicts", "Mitigation Focus"],
      rows: profile.rows.map((row) => [
        row.phaseTitle,
        row.tradeFunctionLabel,
        row.conflictSummary,
        row.mitigationFocus,
      ]),
    },
  };
}

function overlapCoordinationNarrative(
  conflictCount: number,
  interfaceTrades: string[]
) {
  if (conflictCount > 0 || interfaceTrades.length > 0) {
    return "Coordinate overlapping work areas, access routes, permit ownership, protection below, and stop-work handoffs before affected crews begin work.";
  }

  return "Review overlapping work areas, access routes, permit ownership, and stop-work handoffs before affected crews begin work.";
}

type TradeAccessProfile = {
  label: string;
  intro: string;
  rows: string[][];
};

function tradeAccessHaystack(
  generationContext: SafetyPlanGenerationContext,
  operations: GeneratedSafetyPlanDraft["operations"]
) {
  return [
    ...generationContext.scope.trades,
    ...generationContext.scope.subTrades,
    ...generationContext.scope.tasks,
    ...operations.map((operation) => operation.tradeLabel ?? operation.tradeCode ?? null),
    ...operations.map((operation) => operation.subTradeLabel ?? operation.subTradeCode ?? null),
    ...operations.map((operation) => operation.taskTitle),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase())
    .join(" | ");
}

function buildTradeAccessProfiles(
  generationContext: SafetyPlanGenerationContext,
  operations: GeneratedSafetyPlanDraft["operations"]
): TradeAccessProfile[] {
  const haystack = tradeAccessHaystack(generationContext, operations);
  const profiles: TradeAccessProfile[] = [];

  if (/\b(steel|structural steel|ironwork|ironworker|metal deck|decking|connector|rigging|erection)\b/.test(haystack)) {
    profiles.push({
      label: "Steel Erection Access Control",
      intro:
        "For steel erection and decking, use a Controlled Access Zone (CAZ) when the work needs a clear boundary for leading-edge, decking, connecting, or overhead activity, or to control who is below exposed work. Only authorized ironworkers and direct support enter; supervision or the competent person establishes, marks, and maintains the CAZ (barricades, lines, signage) and re-briefs the crew when picks, swing, or the boundary change. No employee shall work, stand, or travel under a suspended load. Keep lift path, drop zone, and CAZ lines coordinated; release criteria for new steel, decks, and laydowns are in the subsections below.",
      rows: [
        [
          "Controlled Access Zone (CAZ)",
          "Use a CAZ for steel erection and decking when the work requires a defined boundary for leading-edge, decking, connecting, or overhead steel activity, or to restrict access under exposed work. Only workers involved in the operation may enter. Supervision or the competent person identifies and maintains the CAZ before and during the shift, aligned with site barricades, warning line, or signage, and with stop-work if unauthorized workers breach the line or the control boundary is not intact.",
          "Competent Person / Foreman",
        ],
        ["Controlled access below erection", "No unauthorized access below active steel erection, bolting, welding, or decking work. Barricade or hard-line the area below and post warning signage before work begins.", "Superintendent / Competent Person"],
        [
          "Suspended load, CAZ, and drop zone",
          "Do not rely on drop zone wording alone: where the work creates a controlled access boundary, the CAZ is established, communicated, and kept clear of unauthorized personnel, together with barricades, signage, and exclusion limits. No employee shall work, stand, or travel beneath a suspended load. Remain clear of the load path, swing radius, and fall or drop area for every pick; do not enter until the load is landed, unrigged, and released by the signal person. Use spotters and stop-work as needed if anyone enters the CAZ, swing path, or uncontrolled area below active steel.",
          "Signal Person / Crane Lead",
        ],
        ["Connector and decking access limit", "Only authorized connectors and decking crew enter leading-edge or newly placed decking until fall protection is complete and the controlled decking zone is released.", "Foreman / Competent Person"],
        ["Leading-edge boundary", "Leading-edge work zones are marked with warning line, control line, or physical barrier; only crew directly performing leading-edge work may cross the boundary.", "Competent Person"],
        ["Controlled decking zone (where used)", "Controlled decking zones (CDZs) are clearly marked, limited to trained deckers, and do not exceed allowable dimensions; general access is prohibited until the CDZ is released.", "Competent Person / Foreman"],
        ["Hoisting path and crane landing zone", "The hoisting path and landing area shall be kept clear before and during every lift. Hoist paths, landing zones, and pick-pad areas are barricaded for the duration of the pick, and only the signal person, riggers, and the receiving crew directly involved in the lift may enter.", "Signal Person / Crane Lead"],
        ["Crane swing radius", "The crane swing radius and counterweight path are barricaded; no worker enters the swing zone while the machine is energized.", "Crane Lead / Foreman"],
        ["Laydown, shakeout, and unloading", "Access to laydown, shakeout, and unloading zones is restricted to riggers, receiving crew, and the spotter; stored steel and decking bundles are staged so they cannot shift into work or travel paths.", "Receiving Lead / Foreman"],
        ["Newly erected / partial steel release", "Do not enter newly erected or partially completed steel until bolting, welding, bracing, and fall protection have been verified and the area is released by supervision.", "Superintendent / Competent Person"],
        ["Temporary perimeter and opening protection", "Perimeter cables, stair rails, floor-opening covers, and leading-edge protection are installed and inspected before general access is allowed onto newly placed deck or floor.", "Competent Person"],
        ["Controlling-contractor coordination", "Coordinate with the controlling contractor and affected trades before any shared-area access is released; document the release, time, and conditions in the daily sign-in / JHA.", "Superintendent"],
      ],
    });
  }

  if (/\b(concrete|rebar|reinforcing|formwork|shoring|pour|placement|slab|column pour|foundation|caisson|post.tension)\b/.test(haystack)) {
    profiles.push({
      label: "Concrete Placement Access Control",
      intro:
        "Access to active concrete placement, formwork, rebar, and post-tensioning areas shall be limited to authorized crew directly involved in the pour, form setting, rebar placement, finishing, or inspection. All other personnel stay clear of forms, pump lines, embed zones, and tensioning end-zones until the area is released.",
      rows: [
        ["Active pour zone exclusion", "Only the placement crew, pump operator, finishers, and inspectors access the active pour area during the pour; all non-essential personnel stay back of the placement line.", "Superintendent / Foreman"],
        ["Pump line and boom pressure zone", "Pump lines, boom swing path, and end-hose whip zone are barricaded or flagged; workers never straddle or stand in line with a pressurized hose.", "Pump Operator / Foreman"],
        ["Formwork and shoring access", "Access onto formwork decks, shoring towers, and re-shore levels is limited to the form crew and inspectors until tie-off, guardrail, and load verification are complete.", "Competent Person"],
        ["Embed, dowel, and rebar cap zones", "Rebar caps, dowels, and embed plates are installed and maintained; impalement and trip-hazard zones are restricted until controls are verified.", "Foreman"],
        ["Post-tensioning end-zone exclusion", "Stressing ends, strand tails, and jack paths are barricaded during tensioning and de-tensioning; only the qualified PT crew may enter until the strand is trimmed and grouted.", "PT Foreman / Competent Person"],
        ["Vertical placement drop zone", "During column or wall pours, the drop zone below the placement and any suspended-bucket path is restricted to authorized crew with overhead protection.", "Superintendent / Foreman"],
        ["Release before re-entry", "Do not enter the placement area for follow-on trades until finishing, curing protection, and embed verification are complete and the area is released by supervision.", "Superintendent"],
      ],
    });
  }

  if (/\b(masonry|mason|cmu|brick|block|mortar|grout pour|scaffold masonry)\b/.test(haystack)) {
    profiles.push({
      label: "Masonry Access Control",
      intro:
        "Access to active masonry walls, scaffold platforms, mortar delivery zones, and saw-cut areas shall be limited to the masonry crew, tenders, and inspectors. All other personnel stay outside the wall-height fall zone and below-scaffold exclusion area until the wall is braced and released.",
      rows: [
        ["Wall-height fall zone (limited access)", "Establish a limited-access zone equal to the wall height plus four feet on the unscaffolded side of any masonry wall being constructed; only the masonry crew enters.", "Competent Person"],
        ["Below-scaffold exclusion", "Barricade the area directly below masonry scaffold loading and hoisting paths; general trades stay clear during material hoisting, stocking, and cleanup.", "Foreman"],
        ["Mortar, grout, and silo zone", "Mortar mixing stations, grout pumps, and silo discharge areas are restricted to the tender crew; pedestrians use posted alternate routes.", "Foreman / Tender Lead"],
        ["Wet-saw and cutting exclusion", "Masonry saw and chop-station cutting zones are flagged for dust, noise, and silica exposure; only authorized operators and helpers enter the active cutting radius.", "Competent Person"],
        ["Unbraced wall exclusion", "Newly constructed walls that are not yet braced remain barricaded with posted height, wind limit, and release criteria; general access is prohibited until bracing is verified.", "Superintendent / Competent Person"],
        ["Hoist and forklift path", "Masonry hoist, fork, and pallet staging paths are controlled; pedestrians and other trades stay clear during material movement and stocking.", "Foreman"],
      ],
    });
  }

  if (/\b(mechanical|hvac|ductwork|duct|piping|pipefitting|pipe fitter|plumbing|process pipe|refrigerant|boiler|steam|pressurized)\b/.test(haystack)) {
    profiles.push({
      label: "Mechanical Installation Access Control",
      intro:
        "Access to active mechanical installation zones \u2014 overhead piping, ductwork, equipment setting, and pressurized-system work \u2014 shall be limited to the mechanical crew, riggers, and inspectors. All other personnel stay out of lift zones, overhead work exclusion areas, and energized / pressurized system boundaries until the area is released.",
      rows: [
        ["Overhead work exclusion", "When ductwork, piping, or equipment is being installed overhead, the floor area directly below is barricaded; general trades stay out until the installation is secured and released.", "Competent Person / Foreman"],
        ["Equipment setting / rigging zone", "Rooftop and mechanical-room equipment setting operations have a defined rigging and landing zone; only riggers, signal persons, and the receiving crew enter during the lift.", "Rigger / Signal Person"],
        ["Pressure-test exclusion", "Pressure-test areas (hydrostatic or pneumatic) are barricaded with posted test pressure and restricted to the test crew until the test is complete and the system is bled down.", "Foreman / Qualified Person"],
        ["Energized-system LOTO zone", "Any work on energized mechanical, steam, refrigerant, or hydraulic systems follows LOTO; the isolated equipment zone is restricted to authorized LOTO employees.", "Qualified Person / Foreman"],
        ["Hot-work and cutting exclusion", "Hot-work areas for welding, brazing, and cutting are flagged with fire watch, spark-containment, and pedestrian exclusion boundaries.", "Fire Watch / Foreman"],
        ["Pipe stand and trapeze staging", "Pipe stands, trapeze assemblies, and staged spools are stored so they cannot shift into travel paths; access is limited to the install crew.", "Foreman"],
        ["Release before adjacent trades", "Do not release overhead mechanical areas to ceiling, drywall, or finish trades until supports, seismic restraints, and leak / pressure verification are complete.", "Superintendent"],
      ],
    });
  }

  return profiles;
}

/**
 * When structural steel / steel erection is in scope, require site-typical crane and lift
 * documentation by name: **Crane Permit**, **Pick Plan**, and **Lift Plan** (or the owner/GC’s
 * equivalent titles—see the steel note on the Additional Permits block). Do not rely on a
 * generic “lift plan” line item alone when picks and crane authorization are tracked separately.
 */
export function augmentPermitsForSteelErection(
  permits: string[],
  generationContext: SafetyPlanGenerationContext,
  operations: GeneratedSafetyPlanDraft["operations"]
) {
  const base = normalizePermitList(permits);
  if (!hasSteelErectionScope(generationContext, operations)) {
    return base;
  }
  return normalizePermitList([...base, "Crane Permit", "Pick Plan", "Lift Plan"]);
}

function permitsForTradePackageRow(
  pkg: GroupedTradePackage,
  generationContext: SafetyPlanGenerationContext,
  operations: GeneratedSafetyPlanDraft["operations"]
) {
  const base = normalizePermitList(pkg.permitTriggers);
  if (!isSteelErectionPackage(pkg)) {
    return base;
  }
  return augmentPermitsForSteelErection(base, generationContext, operations);
}

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
  const steelErectionForNarrative = hasSteelErectionScope(
    params.generationContext,
    params.generationContext.operations as unknown as GeneratedSafetyPlanDraft["operations"]
  );
  const tradeSummarySteelNote = steelErectionForNarrative
    ? " Fall from height is a primary, ongoing risk for ironworkers and steel erection; the plan’s fall protection, access controls, and incident reporting and investigation sections address this as a major active hazard for the current scope."
    : "";

  return {
    tradeBreakdownSummary: `Active work covers ${trades.join(", ")} with controls aligned to the current scope, equipment, and site conditions.${tradeSummarySteelNote}`,
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

function buildCsepSelectedSections(params: {
  generationContext: SafetyPlanGenerationContext;
  operations: GeneratedSafetyPlanDraft["operations"];
  ruleSummary: GeneratedSafetyPlanDraft["ruleSummary"];
  conflictMatrix: ConflictMatrix;
  trainingProgram: SafetyPlanTrainingProgram;
  narrativeSections: Record<string, string>;
  oshaReferences: string[];
  inlineOshaRefs: string[];
}) {
  const instructions = getCsepBuilderInstructions(params.generationContext);
  const selectedSectionOrder = instructions
    ? normalizeSelectedCsepBlockKeys({
        includedSections: instructions.selectedBlockKeys,
        includedContent: instructions.blockInputs,
      })
    : [];
  const groupedTradePackages = groupOperationsByTradePackage(params.operations);
  const permitListFromRules = normalizePermitList([
    ...params.ruleSummary.permitTriggers,
    ...groupedTradePackages.flatMap((pkg) => pkg.permitTriggers),
  ]);
  const permitInput = normalizePermitList(
    asTextList(getCsepBlockInput(instructions, "additional_permits"))
  );
  const resolvedPermitBullets = augmentPermitsForSteelErection(
    permitInput.length > 0 ? permitInput : permitListFromRules,
    params.generationContext,
    params.operations
  );
  const steelPermitScopeNote = hasSteelErectionScope(
    params.generationContext,
    params.operations
  )
    ? "Steel erection / structural steel is in the current scope. Match submittals and field paperwork to the owner or GC permit register. This plan lists Crane Permit, Pick Plan (per planned pick), and Lift Plan or site-equivalent critical-lift documentation; substitute the project’s exact titles where they differ, and confirm requirements before crane mobilization."
    : null;
  const project = params.generationContext.project;
  const scope = params.generationContext.scope;
  const splitScope = splitScopeTasksAndInterfaces([
    ...scope.tasks,
    ...params.generationContext.siteContext.simultaneousOperations,
  ]);
  const activeScopeTasks = normalizeTaskList(
    splitScope.activeTasks.length ? splitScope.activeTasks : scope.tasks
  );
  const interfaceTrades = normalizeTaskList([
    ...splitScope.interfaceTrades,
    ...params.generationContext.siteContext.simultaneousOperations,
  ]);
  const tradeSummaryInput = asTextValue(getCsepBlockInput(instructions, "trade_summary"));
  const scopeOfWorkInput = asTextValue(getCsepBlockInput(instructions, "scope_of_work"));
  const siteNotesInput = asTextValue(getCsepBlockInput(instructions, "site_specific_notes"));
  const emergencyInput = asTextValue(getCsepBlockInput(instructions, "emergency_procedures"));
  const weatherInput = asTextList(
    getCsepBlockInput(instructions, "weather_requirements_and_severe_weather_response")
  );
  const ppeInput = normalizePpeList(asTextList(getCsepBlockInput(instructions, "required_ppe")));
  const hazcomInput = asTextValue(getCsepBlockInput(instructions, "hazard_communication"));
  const overlapInput = normalizeTaskList(
    asTextList(getCsepBlockInput(instructions, "common_overlapping_trades"))
  );
  const oshaInput = asTextList(getCsepBlockInput(instructions, "osha_references"));
  const hazardInput = normalizeHazardList(
    asTextList(getCsepBlockInput(instructions, "selected_hazards"))
  );
  const rolesInput = asTextValue(getCsepBlockInput(instructions, "roles_and_responsibilities"));
  const securityInput = asTextValue(getCsepBlockInput(instructions, "security_and_access"));
  const healthInput = asTextValue(getCsepBlockInput(instructions, "health_and_wellness"));
  const incidentInput = asTextValue(
    getCsepBlockInput(instructions, "incident_reporting_and_investigation")
  );
  const trainingInput = asTextValue(getCsepBlockInput(instructions, "training_and_instruction"));
  const drugAlcoholInput = asTextValue(
    getCsepBlockInput(instructions, "drug_and_alcohol_testing")
  );
  const enforcementInput = asTextValue(
    getCsepBlockInput(instructions, "enforcement_and_corrective_action")
  );
  const recordkeepingInput = asTextValue(getCsepBlockInput(instructions, "recordkeeping"));
  const continuousImprovementInput = asTextValue(
    getCsepBlockInput(instructions, "continuous_improvement")
  );
  const selectedFormatSections = new Set<CsepFormatSectionKey>(
    instructions?.selectedFormatSectionKeys ?? []
  );
  const taskModulesSection = buildTaskModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const hazardModulesSection = buildHazardModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const steelTaskModulesSection = buildSteelTaskModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const steelHazardModulesSection = buildSteelHazardModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const steelProgramModulesSection = buildSteelProgramModulesReferenceSection(
    params.generationContext,
    params.inlineOshaRefs
  );
  const hasRequiredPpeSectionContent =
    ppeInput.length > 0 || params.ruleSummary.ppeRequirements.length > 0;
  const hasPermitSectionContent =
    permitInput.length > 0 ||
    params.ruleSummary.permitTriggers.length > 0 ||
    groupedTradePackages.some((pkg) => pkg.permitTriggers.length > 0) ||
    hasSteelErectionScope(params.generationContext, params.operations);
  const steelErectionInScopeForOverlap = hasSteelErectionScope(
    params.generationContext,
    params.operations
  );
  const hasOverlapSectionContent =
    overlapInput.length > 0 ||
    interfaceTrades.length > 0 ||
    params.conflictMatrix.items.length > 0 ||
    steelErectionInScopeForOverlap;
  const hasOshaSectionContent =
    oshaInput.length > 0 || params.oshaReferences.length > 0;
  const hasSelectedHazardsSectionContent =
    hazardInput.length > 0 ||
    params.ruleSummary.hazardCategories.length > 0 ||
    groupedTradePackages.some((pkg) => pkg.hazardCategories.length > 0) ||
    params.operations.some((operation) => operation.hazardCategories.length > 0);

  const sectionsByKey: Partial<Record<CsepBuilderBlockKey, GeneratedSafetyPlanSection>> = {
    project_information: {
      key: "project_information",
      title: CSEP_BUILDER_BLOCK_TITLES.project_information,
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Project Name", project.projectName || "N/A"],
          ["Project Number", project.projectNumber ?? "N/A"],
          ["Project Address", project.projectAddress ?? "N/A"],
          ["Owner / Client", project.ownerClient ?? "N/A"],
          ["GC / CM", project.gcCm ?? "N/A"],
          ["Governing State", params.generationContext.documentProfile.governingState ?? "N/A"],
        ],
      },
    },
    contractor_information: {
      key: "contractor_information",
      title: CSEP_BUILDER_BLOCK_TITLES.contractor_information,
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Contractor Company", project.contractorCompany ?? "N/A"],
          ["Contractor Contact", project.contractorContact ?? "N/A"],
          ["Contractor Phone", project.contractorPhone ?? "N/A"],
          ["Contractor Email", project.contractorEmail ?? "N/A"],
        ],
      },
    },
    trade_summary: {
      key: "trade_summary",
      title: CSEP_BUILDER_BLOCK_TITLES.trade_summary,
      body: appendInlineOsha(
        combineParagraphs(
          [
            buildTradeScopeSummary(groupedTradePackages, activeScopeTasks, params.ruleSummary),
            tradeSummaryInput,
            params.narrativeSections.tradeBreakdownSummary,
          ],
          "Trade summary details were not entered for this contractor scope."
        ),
        params.inlineOshaRefs
      ),
      table: null,
    },
    scope_of_work: (() => {
      // Keep the displayed task list consistent with the trade-summary sentence
      // (which combines grouped trade-package task titles with activeScopeTasks),
      // so items like "Touch-up painting" that come from the trade package
      // appear in both the summary sentence and the numbered list below.
      const displayTaskList = dedupe([
        ...groupedTradePackages.flatMap((pkg) => pkg.taskTitles),
        ...activeScopeTasks,
      ]);
      return {
        key: "scope_of_work",
        title: CSEP_BUILDER_BLOCK_TITLES.scope_of_work,
        body: appendInlineOsha(
          combineParagraphs(
            [
              scopeOfWorkInput,
              !scopeOfWorkInput && displayTaskList.length
                ? `Planned work includes ${displayTaskList.join(", ")}.`
                : null,
            ],
            "Scope of work details were not entered in the current builder payload."
          ),
          params.inlineOshaRefs
        ),
        bullets: displayTaskList.length ? displayTaskList : undefined,
      };
    })(),
    site_specific_notes: {
      key: "site_specific_notes",
      title: CSEP_BUILDER_BLOCK_TITLES.site_specific_notes,
      body: appendInlineOsha(
        combineParagraphs(
          [siteNotesInput],
          "Use this section only for site-specific conditions, not the task list in Scope of Work. Typical entries: access or gate rules, parking and haul routes, laydown and storage limits, occupied-building interfaces, after-hours or weekend work rules, special weather or wind limits, emergency ingress/egress, and owner or GC special controls. If none apply, omit this block in the final issued CSEP."
        ),
        params.inlineOshaRefs
      ),
      bullets: params.ruleSummary.siteRestrictions.length
        ? params.ruleSummary.siteRestrictions
        : undefined,
    },
    emergency_procedures: {
      key: "emergency_procedures",
      title: CSEP_BUILDER_BLOCK_TITLES.emergency_procedures,
      body: appendInlineOsha(
        combineParagraphs(
          [
            emergencyInput,
            project.projectAddress ? `Emergency response location: ${project.projectAddress}.` : null,
          ],
          "Emergency procedures were not entered in the current builder payload."
        ),
        params.inlineOshaRefs
      ),
    },
    required_ppe: hasRequiredPpeSectionContent
      ? {
          key: "required_ppe",
          title: CSEP_BUILDER_BLOCK_TITLES.required_ppe,
          body: appendInlineOsha(
            params.narrativeSections.requiredControlsSummary,
            params.inlineOshaRefs
          ),
          bullets: buildCsepPpeBulletList(ppeInput, params.ruleSummary.ppeRequirements),
        }
      : undefined,
    additional_permits: hasPermitSectionContent
      ? {
          key: "additional_permits",
          title: CSEP_BUILDER_BLOCK_TITLES.additional_permits,
          body: steelPermitScopeNote
            ? appendInlineOsha(steelPermitScopeNote, params.inlineOshaRefs)
            : undefined,
          bullets: resolvedPermitBullets.length ? resolvedPermitBullets : undefined,
          table: {
            columns: ["Trade / Subtrade", "Areas", "Tasks", "Permits", "Site Restrictions"],
            rows: groupedTradePackages.length
              ? groupedTradePackages.map((pkg) => [
                  pkg.label,
                  sentenceList(pkg.locationLabels, "N/A"),
                  sentenceList(pkg.taskTitles, "N/A"),
                  sentenceList(
                    permitsForTradePackageRow(
                      pkg,
                      params.generationContext,
                      params.operations
                    ),
                    "None"
                  ),
                  sentenceList(pkg.siteRestrictions, "None"),
                ])
              : [[
                  sentenceList(scope.trades, "N/A"),
                  sentenceList(
                    [scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                    "N/A"
                  ),
                  sentenceList(activeScopeTasks, "N/A"),
                  sentenceList(resolvedPermitBullets, "None"),
                  sentenceList(params.ruleSummary.siteRestrictions, "None"),
                ]],
          },
        }
      : undefined,
    common_overlapping_trades: hasOverlapSectionContent
      ? {
          key: "common_overlapping_trades",
          title: CSEP_BUILDER_BLOCK_TITLES.common_overlapping_trades,
          body: appendInlineOsha(
            steelErectionInScopeForOverlap
              ? STEEL_OVERLAP_TRADES_CSEP_INTRO
              : overlapCoordinationNarrative(
                  params.conflictMatrix.items.length,
                  interfaceTrades
                ),
            params.inlineOshaRefs
          ),
          subsections: steelErectionInScopeForOverlap
            ? buildSteelCommonOverlappingTradesSubsections()
            : undefined,
          bullets: (() => {
            const merged = dedupe([...interfaceTrades, ...overlapInput]);
            return merged.length ? merged : undefined;
          })(),
          table: null,
        }
      : undefined,
    osha_references: hasOshaSectionContent
      ? {
          key: "osha_references",
          title: CSEP_BUILDER_BLOCK_TITLES.osha_references,
          bullets: oshaInput.length ? oshaInput : params.oshaReferences,
        }
      : undefined,
    selected_hazards: hasSelectedHazardsSectionContent
      ? {
          key: "selected_hazards",
          title: CSEP_BUILDER_BLOCK_TITLES.selected_hazards,
          body: appendInlineOsha(
            params.narrativeSections.riskPrioritySummary,
            params.inlineOshaRefs
          ),
          subsections: groupedTradePackages.length
            ? buildGroupedHazardSubsections(groupedTradePackages)
            : undefined,
          bullets: groupedTradePackages.length
            ? undefined
            : hazardInput.length
              ? hazardInput
              : params.ruleSummary.hazardCategories.length
                ? normalizeHazardList(params.ruleSummary.hazardCategories)
                : normalizeHazardList(params.operations.flatMap((operation) => operation.hazardCategories)),
        }
      : undefined,
    activity_hazard_matrix: buildActivityHazardMatrixSectionForDraft({
      operations: params.operations,
      groupedTradePackages,
      ruleSummary: params.ruleSummary,
      scope: params.generationContext.scope,
      siteLocation: params.generationContext.siteContext.location,
      activeScopeTasks,
    }),
  };

  const derivedFormatSections: GeneratedSafetyPlanSection[] = [];

  if (selectedFormatSections.has("roles_and_responsibilities")) {
    const superintendentContact = cleanFinalText(project.contractorContact);
    const superintendentRole = superintendentContact
      ? `${superintendentContact} / Superintendent`
      : "Superintendent";
    const rolesRows = [
      [
        superintendentRole,
        "Own implementation of this CSEP, staffing, sequencing, permit readiness, and coordination with the GC/CM and affected trades.",
        "Authorize work start, stop work when controls fail, and approve restart after corrective action.",
      ],
      [
        "Competent Person",
        "Inspect the work area, verify required controls, monitor changing conditions, and correct hazards before and during work.",
        "Hold work when access, protection, rescue, or permit conditions are incomplete.",
      ],
      [
        "Foreman / Crew Lead",
        "Run pre-task planning, verify crew understanding, maintain housekeeping, and confirm inspections and permits are in place.",
        "Do not release the crew to start until controls, PPE, and authorizations are verified.",
      ],
      [
        "Workers",
        "Follow the CSEP, participate in pre-task planning, inspect assigned tools/PPE, and report hazards, incidents, and changing conditions immediately.",
        "Exercise stop-work authority when conditions are unsafe or instructions conflict with field conditions.",
      ],
    ] satisfies string[][];

    derivedFormatSections.push({
      key: "roles_and_responsibilities",
      title: "Roles and Responsibilities",
      body: combineParagraphs(
        [
          "The responsibilities below establish the minimum expectations for each role. Additional duties may apply based on scope, permits, and site conditions.",
          rolesInput,
          project.contractorCompany
            ? `${project.contractorCompany} must assign accountable supervision and a competent person for the selected work scope before work starts.`
            : null,
        ],
        "Accountable supervision, competent-person oversight, and worker stop-work authority apply to the active contractor scope."
      ),
      subsections: buildStructuredRowSubsections(
        ["Role", "Core Responsibilities", "Authority / Hold Point"],
        rolesRows
      ),
    });
  }

  if (selectedFormatSections.has("security_and_access_control")) {
    const tradeAccessProfiles = buildTradeAccessProfiles(
      params.generationContext,
      params.operations
    );

    const generalRestrictedAreaDescription = tradeAccessProfiles.length
      ? "Restricted areas: See the trade-specific access-control subsections below for the restricted-area definitions that apply to the active scope. General site restricted areas (permits, energized equipment, fall-risk edges) remain controlled by barricades, signage, and permit ownership."
      : "Restricted areas: Permit-required and high-hazard areas are barricaded, signed, and released only after controls are verified by the competent person responsible for that area.";

    const securityRows = [
      ["Worker access", "Verify orientation, badging, and daily work assignment before entry.", "Superintendent / Foreman"],
      ["Visitor escort", "Escort non-crew personnel and confirm site-specific orientation before entry into active work areas.", "Foreman / Receiving Lead"],
      ["Restricted areas", generalRestrictedAreaDescription, "Competent Person"],
      ["End-of-shift security", "Secure tools, materials, permits, and access points before turnover.", "Crew Lead"],
    ] satisfies string[][];

    const deliveryRows = [
      ["Check-in and staging", "All delivery vehicles check in at the designated gate or staging area before entering the site and wait for dispatch to the assigned unloading zone.", "Receiving Lead / Foreman"],
      ["Approved truck route", "Drivers follow the project-approved truck route only \u2014 no shortcuts through active work fronts, pedestrian paths, or unapproved surfaces.", "Superintendent / Foreman"],
      ["Protected unloading area", "Unloading occurs in a designated, barricaded area clear of overhead work, suspended loads, and adjacent crews.", "Competent Person / Receiving Lead"],
      ["Spotter use", "A dedicated spotter directs backing, positioning, and unloading whenever vision is restricted, pedestrians are nearby, or the driver cannot see the full path of travel.", "Foreman / Spotter"],
      ["Pedestrian exclusion", "Pedestrian access through the unloading area is restricted while the truck is maneuvering, being loaded, or being unloaded; rigging-path and swing-zone boundaries are marked.", "Foreman / Competent Person"],
      ["Driver remain-in-vehicle rule", "Drivers stay in the cab during unloading unless directed otherwise by the Receiving Lead or Foreman; cab windows remain closed where debris, dust, or overhead work is present.", "Receiving Lead / Foreman"],
      ["Driver PPE if exiting vehicle", "If the driver must exit the cab, they wear hard hat, safety glasses, high-visibility vest, and task-appropriate footwear, and they stay within the designated walk path.", "Receiving Lead / Foreman"],
      ["Laydown and crane coordination", "Unloading is sequenced with the laydown plan and any active crane, hoist, or rigging operations; loads are not released until the landing area is controlled and signal communication is confirmed.", "Superintendent / Crane Lead"],
    ] satisfies string[][];

    const tradeAccessSubsections: GeneratedSafetyPlanSubsection[] = tradeAccessProfiles.flatMap(
      (profile) => [
        {
          title: profile.label,
          body: profile.intro,
          bullets: [],
        },
        ...buildStructuredRowSubsections(
          ["Restricted Zone", "Minimum Requirement", "Responsible Party"],
          profile.rows
        ),
      ]
    );

    const generalBody = tradeAccessProfiles.length
      ? "Access to active work areas is restricted to authorized personnel who have completed required orientation, badging, and task-specific review. The general controls below apply to all trades. Trade-specific restricted-area controls for the active scope follow."
      : "Access to active work areas is restricted to authorized personnel who have completed required orientation, badging, and task-specific review. The controls below apply to both site access and delivery vehicle and driver management.";

    derivedFormatSections.push({
      key: "security_and_access_control",
      title: "Security and Access Control",
      body: combineParagraphs([securityInput], generalBody),
      subsections: [
        ...buildStructuredRowSubsections(
          ["Access Topic", "Minimum Requirement", "Responsible Party"],
          securityRows
        ),
        ...buildStructuredRowSubsections(
          ["Delivery Vehicle and Driver Control", "Minimum Requirement", "Responsible Party"],
          deliveryRows
        ),
        ...tradeAccessSubsections,
      ],
    });
  }

  if (selectedFormatSections.has("contractor_iipp")) {
    const steelErectionInScope = hasSteelErectionScope(
      params.generationContext,
      params.operations
    );
    const iippBodyLead =
      "The contractor shall maintain an active injury and illness prevention workflow covering incident response, corrective action, and worker accountability. Fit-for-duty, substance, and site-access expectations are in the subsections below so they are not repeated between 6.3 Drug, Alcohol, and Fit-for-Duty Controls and 6.4 Enforcement and Corrective Action.";
    const iippSteelRisk = steelErectionInScope
      ? " For the active structural steel or steel erection trade scope, fall from height is a major ongoing project risk. Incident and investigation requirements in subsections 5.7.1 through 5.7.6 apply in full, with fall-related and fall-arrest events treated as primary report and review triggers when they occur on site."
      : "";
    const drugAlcohol = buildStandaloneSubsectionContent({
      title: "Drug, Alcohol, and Fit-for-Duty Controls",
      value: drugAlcoholInput,
      fallbackBody: [
        "Before first site access or the start of work, workers complete required site orientation and acknowledge applicable employer, owner, and GC/CM fit-for-duty and substance-use policy requirements, including any program enrollment, acknowledgments, and testing triggers that apply on day one.",
        "Drug and alcohol compliance shall be maintained in accordance with applicable union agreements, reciprocal testing and referral obligations, and project or site rules, together with employer policy and law.",
        "Alcohol, illegal drugs, and unauthorized controlled substances may not be stored or kept in personal vehicles while those vehicles are parked on the construction site or on client property.",
      ].join("\n\n"),
      fallbackBullets: [
        "Workers shall report suspected alcohol- or drug-related impairment; supervision shall remove affected workers from exposed work, at-height tasks, and equipment operation until the situation is handled under project and employer procedures.",
        "Post-incident, reasonable-suspicion, return-to-work, and other program testing triggers shall be followed. When impairment or noncompliance creates an unacceptable risk, that work does not continue until the risk is abated and required steps are met.",
        "Restart of work stopped for suspected impairment, or for covered tasks after a related program action, shall follow site and employer rules, including documented supervisor (or other designated) approval when the program or owner/GC direction requires it.",
      ],
    });
    const enforcement = buildStandaloneSubsectionContent({
      title: "Enforcement and Corrective Action",
      value: enforcementInput,
      fallbackBody:
        "This subsection governs correction, escalation, documentation, field verification, and approved restart after CSEP or site-rule violations. It does not restate the substance, testing, and fit-for-duty program (see 6.3 Drug, Alcohol, and Fit-for-Duty Controls).",
      fallbackBullets: [
        "Correct the deficiency at once or stop the work: issue clear, task-specific direction on what must change before the crew or equipment re-engages.",
        "Escalate in proportion to risk: foreman to superintendent to company safety; involve owner/GC and union stewards when program rules, labor agreements, or contract terms require it.",
        "Document findings, immediate actions, responsible parties, follow-up due dates, and any disciplinary, progressive, or site-removal steps taken. Track repeat issues for trend review.",
        "Verify corrective measures in the field (including permits, re-briefs, and equipment or access fixes) before closing an item. Restart after stop-work requires documented release when the site or program requires it.",
        "Disciplinary and contract consequences, including removal from site, follow employer policy, labor obligations, and owner/GC direction; communicate outcomes as those rules require.",
      ],
    });
    const iippPpeBullets = buildCsepIippPpeBullets(
      ppeInput,
      params.ruleSummary.ppeRequirements
    );

    derivedFormatSections.push({
      key: "contractor_iipp",
      title: "Contractor Injury & Illness Prevention Program",
      body: `${iippBodyLead.trim()}${iippSteelRisk}`,
      subsections: [
        {
          title: "6.1 Work Attire Requirements",
          bullets: [...DEFAULT_CSEP_WORK_ATTIRE_BULLETS],
        },
        {
          title: "6.2 Personal Protective Equipment (PPE)",
          body: "The following is the reference list for minimum project PPE. Supervision uses it for enforcement, substitutions, and documented deviations. Task- or site-specific PPE (e.g., hot work, electrical, or rescue) is added by JHA, permit, and client or GC direction.",
          bullets: iippPpeBullets,
        },
        ...buildHealthAndWellnessExpectationsSubsections(healthInput),
        ...buildIncidentReportingInvestigationSubsections(incidentInput, steelErectionInScope),
        {
          title: "6.3 Drug, Alcohol, and Fit-for-Duty Controls",
          body: drugAlcohol.body,
          bullets: drugAlcohol.bullets,
        },
        {
          title: "6.4 Enforcement and Corrective Action",
          body: enforcement.body,
          bullets: enforcement.bullets,
        },
      ],
    });
  }

  if (selectedFormatSections.has("hazard_communication_program")) {
    const hazFormat = getCsepFormatDefinition("hazard_communication_program");
    derivedFormatSections.push({
      key: "hazard_communication_program",
      title: hazFormat.title,
      body: combineParagraphs(
        [hazcomInput],
        "This section is the project Hazard Communication (HazCom) program for chemicals and hazardous materials. Life-safety emergency response, evacuation, and posted emergency numbers are in Section 6.0. Environmental compliance for stormwater, site waste, and agency-reportable releases is in Section 11.0. Do not duplicate those programs here."
      ),
      subsections: [
        {
          title: "8.1 Labeling, GHS elements, and site marking",
          body: "Primary containers keep manufacturer or supplier labels. Secondary and portable containers (spray bottles, transfer cans, day tanks) are labeled with product identity and GHS-style hazard information (pictograms, signal word, hazard and precautionary statements) or a site-approved equivalent. Workers shall not work from unmarked or unknown chemical containers.",
          bullets: [
            "Match labels to the product in the container; relabel or remove from service if the label is missing, defaced, or no longer correct.",
            "Post or maintain NFPA 704, HMCIS, or other owner-required hazard markings at fixed chemical storage, fuel points, and temporary storage yards when the site plan requires it.",
            "Bar-code or QR site systems are acceptable only if every affected worker can still access the identity and hazard class before use.",
          ],
        },
        {
          title: "8.2 SDS availability, chemical inventory, and training",
          body: "SDS for all hazardous chemicals brought onto the site shall be maintained on site, readily accessible to workers, and provided to CM / HSE for verification upon request. Containers and secondary containers shall be labeled in accordance with site requirements and applicable HazCom / GHS rules. SDSs are available to workers at all times through the project SDS system (e.g., trailer binder, project portal, or GC-provided app). A chemical inventory or other documented communication process ties introduced products to SDSs before first use. Training covers how to read labels and SDS, physical and health hazards, and where to get help.",
          bullets: [
            "Before first use of a new chemical on the job, confirm an SDS is on file, on site, accessible, and understood by the crew that will use it.",
            "Update the inventory and SDS library when new products, concentrations, or suppliers change field hazards.",
            "Subcontractors shall present SDS and usage information to the host employer / GC / CM for products they introduce so multi-employer coordination stays current.",
          ],
        },
        {
          title: "8.3 Contractor notification and damaged or leaking containers",
          body: "Each employer or trade bringing chemicals to the site coordinates with the GC/CM or designated competent person for compatible storage, quantity limits, and special posting. Damaged, bulging, or leaking containers are reported at once, isolated, and managed under SDS, owner, and regulatory expectations.",
          bullets: [
            "Notify the site when bringing regulated quantities, cylinder gases, or unusual materials so permits, hot-work separation, and fire protections stay valid.",
            "For leaks: protect personnel, control ignition sources, use compatible absorbent or containment from the spill cart, and escalate per Section 6.0 and Section 11.0 if the release leaves the immediate work area, enters soil or water, or exceeds workers’ training.",
          ],
        },
      ],
    });
  }

  if (selectedFormatSections.has("weather_requirements_and_severe_weather_response")) {
    const wxFormat = getCsepFormatDefinition("weather_requirements_and_severe_weather_response");
    const wxPart = partitionCsepWeatherInput(weatherInput);
    const sectionLead = combineParagraphs(
      [
        params.generationContext.siteContext.weather?.summary ?? null,
        params.ruleSummary.weatherRestrictions.length
          ? `Weather-sensitive restrictions in force: ${params.ruleSummary.weatherRestrictions
              .map(humanizeCode)
              .join(", ")}.`
          : null,
        wxPart.skippedEnvironmental
          ? "Builder lines beginning with 'Environmental control:' are handled in Section 11.0 (Environmental Controls), not restated in this section."
          : null,
      ],
      "This section governs how crews coordinate in the field for weather, heat, cold, fire prevention, and housekeeping. It supplements—but does not replace—Section 6.0 (emergency and evacuation programs) and Section 8.0 (HazCom and SDS for chemicals)."
    );
    const monCommBody = [
      wxPart.monitoring.length
        ? `Use these monitoring sources: ${wxPart.monitoring.join("; ")}.`
        : "Use the project’s designated forecast sources, on-site anemometer or site-specific wind/heat/cold tools, and the project weather SOP to decide when to adjust or stop work.",
      wxPart.communication.length
        ? `Use these communication paths for weather triggers: ${wxPart.communication.join("; ")}.`
        : "Communicate trigger changes, shelter locations, and restart conditions through the superintendent, competent person, and foreman before work resumes in affected areas.",
    ]
      .filter(Boolean)
      .join(" ");

    const defaultStopWorkBullets = [
      "Suspend exposed work, hoisting, and elevated work when wind, lightning, or storm conditions exceed the plan, manufacturer limits, or site rules; secure loads and access routes as needed.",
      "Enforce the site lightning or high-wind all-clear and restart sequence before crews leave shelter or re-establish work at height.",
      "Reassess slings, sheeting, barriers, and temporary power after severe wind or water intrusion before the next shift.",
    ];
    const stopWorkBullets =
      wxPart.other.length > 0 ? [...defaultStopWorkBullets, ...wxPart.other] : defaultStopWorkBullets;

    derivedFormatSections.push({
      key: "weather_requirements_and_severe_weather_response",
      title: wxFormat.title,
      body: sectionLead,
      subsections: [
        {
          title: "9.1 Emergency coordination and response (field tie-in)",
          body: "In an alarm, fire, major medical event, or utility emergency, follow Section 6.0, posted site maps, and the owner/GC plan. This subsection covers how weather-related and stop-work events tie back to that program—not full emergency content.",
          bullets: [
            "Keep assembly area routes clear during weather stand-downs; do not block fire lanes or site gates used by responders.",
            "Account for workers after sheltering, evacuation, or stop-work: use the project roll-call or GC method.",
            "Report injuries, near misses, and significant near-miss weather events to supervision per the IIPP, even if no one was hurt.",
          ],
        },
        {
          title: "9.2 Weather events, heat exposure, and cold exposure",
          body: "Match work plans to forecast and on-site readings. Wind, precipitation, and reduced visibility can affect cranes, sheeting, roofing, and temporary lighting. Plan heat and cold controls before the shift; adjust for new workers, returning crews, and changing forecasts. Lightning, tornado, and (where applicable) earthquake controls are in 9.3 through 9.5.",
          bullets: [
            "General wind and storm exposure: follow project trigger tables; re-brief the crew when the forecast or radar changes; secure loose materials, formwork, and temporary enclosures.",
            "Heat—hydration: provide accessible cool drinking water; encourage frequent drinking; add stations when work is far from a fixed source.",
            "Heat—rest and environment: add shade, cooling, or A/C recovery when heat index, workload, and clothing combine to raise heat-stress risk; increase break frequency and length during heat advisories and peak sun.",
            "Heat—acclimatization: plan lighter workloads the first week for new hires or after absences; pair new workers with experienced partners for buddy checks.",
            "Heat—symptoms and monitoring: watch for cramps, heavy sweating with weakness, hot dry skin, confusion, nausea, and dizziness; use supervisor rounds during peak heat; stop work and cool workers when heat illness is suspected.",
            "Heat—work-rest and stop-work: apply site work/rest charts when required; reassign heavy exertion; stop or postpone work when controls cannot keep heat stress in an acceptable range.",
            "Cold—clothing: layer clothing; use weather-appropriate PPE and dry, insulated hand protection suitable for the task; change out of wet clothing during the shift.",
            "Cold—rest and comfort: add warm-up breaks and heated or wind-protected recovery when wind chill, wet conditions, and duration combine to lower dexterity or comfort.",
            "Cold—health monitoring: watch for shivering, loss of fine motor control, numbness, stiff joints, and frostnip; rotate tasks when work keeps hands in cold or wet contact.",
            "Cold—wind and precipitation: re-plan exposed work, ladder use, and roof access for ice, gusts, and reduced footing.",
            "Cold—task rotation and stop-work: rotate workers through shorter cycles in the cold; stop work when cold stress would prevent safe use of tools, PPE, or fall protection.",
          ],
        },
        {
          title: "9.3 Lightning and electrical-storm response",
          body: "This project’s site requirement uses a 20-mile monitoring and stop-work radius for electrical storms unless the site owner, GC, or local emergency authority specifies a stricter standard; align the field plan with the posted site weather SOP. Keep all-clear timing consistent with the same site rules and this subsection.",
          bullets: [
            "Lightning watch / stop-work radius: 20 miles for this plan. When lightning risk is within that radius, stop exposed outdoor work, hoisting, and elevated work per the site SOP. A different radius applies only if the owner or GC documents it in the site weather SOP.",
            "Lightning all-clear: 30 minutes from the last detected strike or flash within the trigger radius, unless site rules, owner standards, or an approved weather service prescribes a longer or shorter interval; document the source used for restart.",
            "Suspend crane operations, high work on steel or deck, MEWP/steel access baskets, and metal-roof or topping-out activity when the lightning plan triggers; do not use shelters that leave workers exposed to step potential or ungrounded mobile equipment as the sole protection.",
            "Re-start exposed work only after the all-clear clock has completed and a competent person has re-authorized the task list for that weather window.",
          ],
        },
        {
          title: "9.4 Tornado and severe convective-storm response",
          body: "A tornado or severe convective warning requires immediate, coordinated action. Supervision, the GC/CM, or the site’s designated weather authority (per the project emergency and severe-weather addendum) issues stop-work and shelter or evacuation orders. Do not improvise a single-sentence “go inside” without using posted shelter maps and headcount methods.",
          bullets: [
            "Order and communication: the superintendent, site safety lead, or GC/CM representative shall issue the shelter or evacuation order and confirm it is sent on the project’s communication path (radio, mass text, siren, or as posted).",
            "Move immediately to the designated in-building shelter, hardened interior rooms, or other owner-approved refuges identified on the site map. Do not remain on lifts, exposed structural steel, roofs, open deck, latticed cranes, or in open yards during a watch or warning unless an emergency release has been given by a responder.",
            "Vehicles: do not treat ordinary pickups or job trucks as safe shelters; only use a vehicle as shelter when the project policy or fire marshal explicitly approves a vehicle plan (e.g., low-lying, sealed cab with instructions)—otherwise proceed to a designated building shelter.",
            "Accountability: at the shelter, foremen and the GC/CM (or their designee) perform a field headcount or electronic roll against the muster list; report missing workers only through the site emergency process.",
            "Restart: return to the workface only after site leadership, emergency services, or the GC/CM has formally released the site for work. Re-brief the crew, re-walk the area for downed power, damaged weather enclosure, and unstable material before re-engaging.",
          ],
        },
        {
          title: "9.5 Earthquake and seismic event response (when applicable)",
          body: "Use this block when the project is in a seismic area or the owner, GC, or jurisdiction requires a documented earthquake response. It supplements Section 6.0; it is not a substitute for the project emergency or evacuation program.",
          bullets: [
            "On shaking or a seismic warning: stop work immediately; do not run through active steel, under suspended loads, scaffolds, or crane booms, or next to freestanding wall panels and glass that can shift or fall.",
            "Move to an open, clear area away from structures, fuel points, and overhead utilities when an outdoor “drop, cover, hold” location is the site plan; otherwise follow the posted indoor refuge or roof-access freeze plan.",
            "After the event, evacuate or shelter as directed; account for all personnel. Do not restart in affected bays until a competent person has inspected for fallen steel, damaged connections, dislodged rigging, cracked concrete, and damaged access ladders.",
            "Re-inspect crane bases, outrigger pads, tower ties, and laydown for movement before the next pick. Confirm temporary power, gas, and standpipes for damage before re-energizing.",
          ],
        },
        {
          title: "9.6 Fire prevention controls",
          body: "Control combustibles, ignition sources, and egress before work begins each day and after weather or trade changes. Coordinate with hot-work permits, temporary heat, and the owner’s fire-protection rules.",
          bullets: [
            "Keep combustible scrap, packaging, and wood forms away from hot work, temporary power, panel boards, and heaters; remove fuel sources from the line of fire and arc flash zones.",
            "Maintain clear access to extinguishers, standpipes, yard hydrants, and site alarm boxes; never block them with material or waste.",
            "Keep separation or fire-watch interfaces where the hot-work program or owner rules require a watch between ignition sources and combustible construction, debris, or weather plastic.",
            "Clear debris, banding, and obstructions that could carry fire or block egress and exit doors; keep means of egress open per site rules.",
            "Open flames, temporary heaters, and extension cords: follow the site hot-work, electrical, and fire-watch programs.",
          ],
        },
        {
          title: "9.7 Housekeeping controls",
          body: "Continuous housekeeping supports trip-and-fire prevention, weather drainage, and clean egress. Align with the site waste and environmental plan for containers and stockpiles.",
          bullets: [
            "Debris and scrap: remove on a defined cadence (end of task, end of day, and before hand-off to another trade where the site requires it).",
            "Walkways and work paths: keep them clear of hose, stock, and scrap; re-mark tripping and slip hazards when lighting or weather changes.",
            "Material stacking: stack to the project plan, band or tie loads, and keep stacks clear of drop zones, access routes, and weather-exposed limits.",
            "Openings, edges, and floor penetrations: keep cut-outs free of material buildup that could fall or create trip edges.",
            "Egress: keep exit routes, stairs, and doors unobstructed; remove scrap, banding, tools, and cord runs that would slow evacuation.",
            "Loose items: control banding, tie wire, and small scrap at foot level—especially after wind that spreads lightweight debris.",
          ],
        },
        {
          title: "9.8 Monitoring and communication",
          body: monCommBody,
          bullets: [
            "Consolidate monitoring and comm plans into pre-task and shift briefings; avoid fragmenting the same information across many one-line list entries in the field packet.",
            "Log significant trigger changes and restart approvals when the owner or program requires a written record.",
          ],
        },
        {
          title: "9.9 Stop-work triggers and protective actions",
          body: "Stop or modify work when on-site conditions no longer match the JHA, permit, or manufacturer limits. For chemical releases beyond a minor spill controlled at the work face, use Section 6.0, Section 8.0, and Section 11.0 as applicable.",
          bullets: stopWorkBullets,
        },
      ],
    });
  }

  if (selectedFormatSections.has("environmental_execution_requirements")) {
    const envFormat = getCsepFormatDefinition("environmental_execution_requirements");
    derivedFormatSections.push({
      key: "environmental_execution_requirements",
      title: envFormat.title,
      body: "This section addresses environmental field controls only—waste, drainage, releases, and nuisance management. It does not replace site orientation, trade permits, fall protection, rigging, PPE, or work procedures, which are covered elsewhere in this plan.",
      subsections: [
        {
          title: "11.1 Environmental concerns for the active scope",
          body: "Call out the environmental profile of the current scope: waste streams, sensitive areas, and how this work fits the site SWPPP and owner requirements.",
          bullets: [
            "Match debris and waste handling to the active tasks; avoid mixing incompatible wastes or using unapproved containers.",
            "Protect adjacent soil, water features, and occupied areas from migration of scrap, dust, and fluids from the work area.",
            "Communicate with GC or environmental oversight when the scope is near inlets, retention features, or property lines.",
          ],
        },
        {
          title: "11.2 Housekeeping and waste",
          body: "Keep work areas orderly; stage and remove waste before it blocks access, creates fire load, or overwhelms containments.",
          bullets: [
            "Use project-designated roll-offs, totes, or scrap areas; keep lids closed and labels accurate where the site requires it.",
            "Segregate materials as required (e.g., recyclable metals, general construction waste, and hazardous-compatible streams).",
          ],
        },
        {
          title: "11.3 Stormwater and drain protection",
          body: "Keep storm inlets, trench drains, and other conveyances free of construction debris, sediment, and process fluids.",
          bullets: [
            "Use inlet protection, cover, or diversion per the site SWPPP or direction from a competent person when work could discharge to the system.",
            "Prohibit uncontrolled equipment washout, concrete wash, or other discharge to drains or surface water unless an approved method is in use.",
          ],
        },
        {
          title: "11.4 Spill and chemical control",
          body: "Store, transfer, and use fuels, lubricants, and other job-site chemicals to prevent uncontrolled release.",
          bullets: [
            "Stage secondary containment and compatible spill response materials where bulk fluids and daily-use containers are kept.",
            "Report releases immediately; stop ignition sources and protect responders until the situation is fully assessed per site policy.",
          ],
        },
        {
          title: "11.5 Dust, noise, and nuisance control",
          body: "Limit dust, noise, vibration, and other nuisances to neighbors, occupied spaces, and adjacent work.",
          bullets: [
            "Use water, vacuum, or equipment selection to control dust in dry, windy, or interior-adjacent work.",
            "Adhere to owner or local restrictions on high-noise or high-dust work timing when they apply to this site.",
          ],
        },
        {
          title: "11.6 Weather, precipitation, and disturbed-area controls (when applicable)",
          body: "When ground disturbance, stockpiles, or exposed soil is in scope, manage erosion, tracking, and runoff per the site plan. For primarily interior, slab-on, or minimally disturbed scopes, 11.1 through 11.5 still apply; add 11.6 measures when the site SWPPP or conditions require them.",
          bullets: [
            "Stabilize or protect stockpiles, slopes, and exposed areas before significant precipitation when the site plan requires it.",
            "Control track-out and sediment at exits and along haul paths when site conditions or inspections trigger additional measures.",
          ],
        },
      ],
    });
  }

  if (selectedFormatSections.has("contractor_monitoring_audits_and_reporting")) {
    derivedFormatSections.push({
      key: "contractor_monitoring_audits_and_reporting",
      title: "Contractor Monitoring, Audits & Reporting",
      body: combineParagraphs(
        [recordkeepingInput],
        "The contractor shall monitor field execution, document inspections and corrective actions, and maintain reporting records that demonstrate ongoing compliance. All required permits shall be obtained before the task begins, fully completed, kept active for the duration of the work as required, and maintained on site for review by supervision, CM / HSE, or other authorized representatives."
      ),
      table: {
        columns: ["Monitoring Activity", "Minimum Frequency", "Responsible Party", "Required Record"],
        rows: [
          ["Pre-task plan / JHA review", "Each shift and when the task changes", "Foreman / Crew Lead", "Daily pre-task record"],
          ["Field safety inspection", "Daily or as triggered by conditions", "Competent Person / Superintendent", "Inspection log"],
          [
            "Permit status review",
            "Before start and when conditions change",
            "Superintendent / Permit Holder",
            "Each active permit obtained before the task, fully completed, and kept on site for supervision / CM / HSE review",
          ],
          ["Corrective action tracking", "Until closed", "Supervisor / Safety Lead", "Corrective action log"],
          ["Incident and trend reporting", "Immediately and during weekly review", "Superintendent / Safety Lead", "Incident report and follow-up notes"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("contractor_safety_meetings_and_engagement")) {
    const ruleDerivedTraining = params.trainingProgram.summaryTrainingTitles.map(
      (item: string) => `Active scope / rules evaluation: ${item}`
    );
    const equipmentAndRoleTraining = [
      "Crane operators: qualified and authorized for the class of crane and work method (e.g., lattice boom, truck crane, tower) in use, per site, owner, and Subpart CC requirements as applicable.",
      "MEWP / aerial lift operators: current familiarization and operation training for the make and model; site rules for travel path, fall protection, and load limits apply.",
      "Lull / telehandler operators: authorized and trained for the specific vehicle, attachments, and load types; respect pick charts and site traffic plans.",
      "PIV / powered industrial vehicle operators (where separate from telehandlers in site policy): site/traffic and industrial-truck training before operating in work areas, laydown, or around pedestrians.",
      "Forklifts: where forklifts or equivalent trucks are in scope, verify power-industrial-truck or owner-equivalent training and pre-use inspection before operation.",
      "Qualified riggers: assigned where load handling, steel erection, or critical hoisting require qualified rigger coverage under 29 CFR 1926 Subpart R, CC, or site program.",
      "Qualified signal persons: where hoisting, crane picks, or blind lifts require a qualified signal person, verify designation before picks proceed.",
      "Welders and hot work: WPS, procedure, and fire-watch / hot-work permit alignment for tasks that involve cutting, heating, or welding on site.",
    ];
    const trainingForScopeSubsection = {
      title: "Required training, qualifications, and equipment roles (active scope)",
      body: "Tie every listed requirement to the tasks, equipment, and permit triggers in this CSEP. Add owner-, GC-, or trade-specific program requirements when the site directs.",
      bullets: dedupe([...equipmentAndRoleTraining, ...ruleDerivedTraining]),
    };
    const trainingRecordsSubsection = {
      title: "Training records, certifications, and qualifications",
      body: "Training records, certifications, and qualification documents shall be maintained current and made available to CM / HSE, site supervision, and owner representatives for verification upon request and before personnel perform work requiring that qualification.",
      bullets: [
        "Maintain current records for the active scope, including training records; trade, task, and equipment certifications; operator qualifications; welder or procedure qualifications when welding or cutting applies; qualified rigger and qualified signal person credentials when hoisting applies; and OSHA training cards or other site-required credentials.",
        "Provide these records for verification before or during site access when the project requires it, and before work starts that depends on the qualification.",
        "Retain evidence in the format the site requires (paper, electronic, badge, or union roster). Withhold or rescind work authorization when required training or credentials are missing, expired, or cannot be produced on request.",
        "Field leads shall confirm current qualifications during pre-task review when the task, equipment, or permit changes mid-shift or between crews.",
      ],
    };
    derivedFormatSections.push({
      key: "contractor_safety_meetings_and_engagement",
      title: "Contractor Safety Meetings and Engagement",
      body: combineParagraphs(
        [trainingInput],
        "Daily field communication, toolbox meetings, coordination huddles, and worker engagement are required to keep the CSEP active and current."
      ),
      table: {
        columns: ["Meeting / Engagement Activity", "Minimum Cadence", "Led By", "Required Output"],
        rows: [
          ["Pre-task planning / JHA", "Each shift and before new work phases", "Foreman / Crew Lead", "Task plan, hazards, controls, permits, and PPE reviewed with the crew"],
          ["Toolbox / safety meeting", "Weekly or as required by site policy", "Superintendent / Safety Lead", "Attendance and topic record"],
          ["Coordination meeting", "Before overlapping or high-risk work", "Superintendent / GC/CM Interface", "Interface controls, sequencing, and hold points confirmed"],
          ["Stand-down / re-brief", "After incidents, near misses, or major plan changes", "Leadership / Supervision", "Restart conditions and revised controls documented"],
        ],
      },
      subsections: [trainingForScopeSubsection, trainingRecordsSubsection],
    });
  }

  if (selectedFormatSections.has("sub_tier_contractor_management")) {
    const overlapRows = dedupe([
      ...overlapInput,
      ...params.generationContext.siteContext.simultaneousOperations,
    ]);
    derivedFormatSections.push({
      key: "sub_tier_contractor_management",
      title: "Sub-Tier Contractor Management",
      body: null,
      table: {
        columns: ["Oversight Topic", "Minimum Requirement", "Responsible Party"],
        rows: overlapRows.length
          ? overlapRows.map((item) => [
              item,
              "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
              "Superintendent / Foreman",
            ])
          : [
              ["Onboarding", "Verify orientation, scope review, permits, training, and emergency expectations before work starts.", "Superintendent"],
              ["Interface control", "Coordinate shared areas, sequencing, and work-zone ownership with adjacent trades.", "Superintendent / Foreman"],
              ["Documentation turnover", "Maintain current permits, JHAs, inspections, and corrective actions for lower-tier crews.", "Foreman / Safety Lead"],
            ],
      },
    });
  }

  if (selectedFormatSections.has("project_close_out")) {
    const closeOutIntro =
      "Close-out actions shall be completed before final turnover of the work area, records, and remaining responsibilities.";
    const closeOutOpenInput = continuousImprovementInput?.trim() ?? null;
    const closeOutBody = closeOutOpenInput
      ? `${closeOutIntro} ${closeOutOpenInput}`
      : closeOutIntro;
    const closeOutAction = (minimum: string, party: string) => ({
      bullets: [
        `Minimum Requirement: ${minimum}`,
        `Responsible Party: ${party}`,
      ],
    });

    derivedFormatSections.push({
      key: "project_close_out",
      title: "Project Close-Out",
      body: closeOutBody,
      subsections: [
        {
          title: "15.1.1 Open corrective actions",
          body: null,
          ...closeOutAction(
            "Verify all required actions are closed or transferred with documented ownership.",
            "Superintendent / Safety Lead"
          ),
        },
        {
          title: "15.1.2 Permit and form closeout",
          body: null,
          ...closeOutAction(
            "Close permits, archive required forms, and remove expired postings.",
            "Permit Holder / Foreman"
          ),
        },
        {
          title: "15.1.3 Environmental and housekeeping turnover",
          body: null,
          ...closeOutAction(
            "Remove waste, temporary protections, and outstanding environmental controls as required.",
            "Foreman / Crew Lead"
          ),
        },
        {
          title: "15.1.4 Lessons learned",
          body: null,
          ...closeOutAction(
            "Capture scope-specific issues, improvements, and retraining opportunities before final turnover.",
            "Leadership / Supervision"
          ),
        },
        {
          title: "15.1.5 Final documentation review",
          body: null,
          ...closeOutAction(
            "Confirm required training, permits, inspections, incident records, and corrective-action records are complete and filed as required.",
            "Superintendent / Safety Lead"
          ),
        },
      ],
    });
  }

  if (selectedFormatSections.has("checklists_and_inspections")) {
    derivedFormatSections.push({
      key: "checklists_and_inspections",
      title: "Checklists and Inspections",
      body:
        "Inspection and checklist tools shall be used at the listed frequencies to confirm conditions stay aligned with this CSEP.",
      table: {
        columns: ["Checklist / Inspection", "Minimum Frequency", "Responsible Party", "Record / Trigger"],
        rows: [
          ["Pre-task plan / JHA", "Each shift and before task changes", "Foreman / Crew", "Required before starting new or changed work"],
          ["PPE and tool inspection", "Prior to use", "Each user / Operator", "Remove damaged gear or equipment from service"],
          ["Permit-required work verification", "Before start and when conditions change", "Permit Holder / Competent Person", "Confirm permit conditions remain valid"],
          ["Area housekeeping and barricade inspection", "Daily", "Foreman / Competent Person", "Correct before turnover or restart"],
          ["Program / high-risk work inspection", "Weekly or per program trigger", "Superintendent / Safety Lead", "Track findings to corrective action closure"],
        ],
      },
    });
  }

  if (selectedFormatSections.has("regulatory_framework") && !(oshaInput.length || params.oshaReferences.length)) {
    derivedFormatSections.push({
      key: "regulatory_framework",
      title: "Regulatory Framework",
      body:
        "This CSEP shall be executed in alignment with the governing OSHA jurisdiction, owner requirements, project rules, and any labor or local conditions applicable to the selected scope.",
      table: {
        columns: ["Requirement Source", "Application to This CSEP"],
        rows: [
          [
            params.generationContext.documentProfile.jurisdictionLabel ?? "Governing OSHA jurisdiction",
            "Use the governing jurisdiction as the baseline compliance framework for the active work scope.",
          ],
          ["Owner / client requirements", "Apply project-specific safety, security, permit, and reporting requirements in addition to OSHA minimums."],
          ["GC / CM coordination rules", "Follow project logistics, sequencing, access, and interface requirements that affect field execution."],
        ],
      },
    });
  }

  const selectedSections = selectedSectionOrder
    .filter((key) => hasSelectedCsepBlock(instructions, key))
    .map((key) => sectionsByKey[key])
    .filter((section): section is GeneratedSafetyPlanSection => Boolean(section))
    .filter((section) => {
      if (
        section.key === "roles_and_responsibilities" &&
        selectedFormatSections.has("roles_and_responsibilities")
      ) {
        return false;
      }

      return true;
    });

  if (selectedSections.length > 0) {
    return [
      ...selectedSections,
      ...derivedFormatSections,
      taskModulesSection,
      hazardModulesSection,
      steelTaskModulesSection,
      steelHazardModulesSection,
      steelProgramModulesSection,
    ].filter((section): section is GeneratedSafetyPlanSection => Boolean(section));
  }

  return [
    sectionsByKey.scope_of_work,
    sectionsByKey.selected_hazards,
    sectionsByKey.activity_hazard_matrix,
    ...derivedFormatSections,
    taskModulesSection,
    hazardModulesSection,
    steelTaskModulesSection,
    steelHazardModulesSection,
    steelProgramModulesSection,
  ].filter((section): section is GeneratedSafetyPlanSection => Boolean(section));
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
  const groupedTradePackages = groupOperationsByTradePackage(operations);
  const splitScope = splitScopeTasksAndInterfaces([
    ...params.generationContext.scope.tasks,
    ...params.generationContext.siteContext.simultaneousOperations,
  ]);
  const activeScopeTasks = normalizeTaskList(
    splitScope.activeTasks.length ? splitScope.activeTasks : params.generationContext.scope.tasks
  );
  const interfaceTrades = normalizeTaskList([
    ...splitScope.interfaceTrades,
    ...params.generationContext.siteContext.simultaneousOperations,
  ]);

  const ruleSummary = {
    permitTriggers: normalizePermitList(
      params.reviewContext.rulesEvaluations.flatMap((row) =>
        row.permitTriggers.filter((item) => item !== "none")
      )
    ),
    ppeRequirements: normalizePpeList(
      params.reviewContext.rulesEvaluations.flatMap((row) => row.ppeRequirements)
    ),
    requiredControls: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.requiredControls)),
    hazardCategories: normalizeHazardList(
      params.reviewContext.rulesEvaluations.flatMap((row) => row.hazardCategories)
    ),
    siteRestrictions: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.siteRestrictions)),
    prohibitedEquipment: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.prohibitedEquipment)),
    trainingRequirements: dedupe([
      ...params.reviewContext.rulesEvaluations.flatMap((row) => row.trainingRequirements),
      ...(params.trainingProgram?.summaryTrainingTitles ?? []),
    ]),
    weatherRestrictions: dedupe(params.reviewContext.rulesEvaluations.flatMap((row) => row.weatherRestrictions)),
  };
  const trainingProgram = params.trainingProgram ?? {
    rows: [],
    summaryTrainingTitles: ruleSummary.trainingRequirements,
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

  const isPshsep = params.generationContext.documentProfile.documentType === "pshsep";
  const programSections: GeneratedSafetyPlanSection[] = buildCsepProgramSections(
    params.generationContext.programSelections ?? [],
    {
      definitions: params.programDefinitions,
    }
  ).map((section) => ({
    key: section.key,
    title: section.title,
    summary: section.summary,
    subsections: section.subsections.map((subsection) => ({
      title: subsection.title,
      body: subsection.body,
      bullets: subsection.bullets,
    })),
  }));
  const oshaReferences = collectOshaReferences(
    params.generationContext,
    programSections,
    narrativeSections
  );
  const inlineOshaRefs = oshaReferences.slice(0, 4);
  const pshsepCoreSections = isPshsep
    ? buildPshsepCoreSections(params.generationContext, inlineOshaRefs, ruleSummary)
    : [];
  const pshsepHighRiskSections = isPshsep
    ? buildPshsepHighRiskSections(params.generationContext, inlineOshaRefs)
    : [];

  const definitionsSection = buildDefinitionsSection(
    params.generationContext,
    inlineOshaRefs,
    operations
  );
  const referencesSection = buildReferencesSection(oshaReferences);
  const tradeConflictCoordinationSection = buildTradeConflictCoordinationSection(
    params.generationContext,
    inlineOshaRefs
  );
  const sharedSections: GeneratedSafetyPlanSection[] = [
    {
      key: "project_overview",
      title: "Project Overview",
      body: appendInlineOsha(
        `Project ${projectName} covers ${sentenceList(params.generationContext.scope.trades, "defined trades")} at ${paragraph(
          params.generationContext.project.projectAddress,
          "the specified location"
        )}.`,
        inlineOshaRefs
      ),
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
      body: appendInlineOsha(narrativeSections.tradeBreakdownSummary, inlineOshaRefs),
      table: {
        columns: ["Trade / Subtrade", "Areas", "Tasks", "Hazards", "Permits"],
        rows: groupedTradePackages.length
          ? groupedTradePackages.map((pkg) => [
              pkg.label,
              sentenceList(pkg.locationLabels, "N/A"),
              sentenceList(pkg.taskTitles, "N/A"),
              sentenceList(normalizeHazardList(pkg.hazardCategories)),
              sentenceList(normalizePermitList(pkg.permitTriggers), "None"),
            ])
          : [[
              sentenceList(params.generationContext.scope.trades, "N/A"),
              sentenceList(
                [params.generationContext.scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                "N/A"
              ),
              sentenceList(activeScopeTasks, "N/A"),
              sentenceList(ruleSummary.hazardCategories),
              sentenceList(ruleSummary.permitTriggers, "None"),
            ]],
      },
    },
    {
      key: "task_hazard_analysis",
      title: "Task-Level Hazard Analysis",
      body: APPENDIX_E_TASK_HAZARD_CONTROL_MATRIX_REF,
    },
    {
      key: "permit_matrix",
      title: "Permit Matrix",
      table: {
        columns: ["Trade / Subtrade", "Areas", "Tasks", "Permits", "Site Restrictions"],
        rows: groupedTradePackages.length
          ? groupedTradePackages.map((pkg) => [
              pkg.label,
              sentenceList(pkg.locationLabels, "N/A"),
              sentenceList(pkg.taskTitles, "N/A"),
              sentenceList(normalizePermitList(pkg.permitTriggers), "None"),
              sentenceList(pkg.siteRestrictions, "None"),
            ])
          : [[
              sentenceList(params.generationContext.scope.trades, "N/A"),
              sentenceList(
                [params.generationContext.scope.location ?? params.generationContext.siteContext.location ?? "N/A"],
                "N/A"
              ),
              sentenceList(activeScopeTasks, "N/A"),
              sentenceList(ruleSummary.permitTriggers, "None"),
              sentenceList(ruleSummary.siteRestrictions, "None"),
            ]],
      },
    },
    buildTrainingProgramSection(trainingProgram),
    {
      key: "simultaneous_operations",
      title: "Simultaneous Operations & Trade Interaction Risks",
      body: appendInlineOsha(
        params.conflictMatrix.items.length
          ? `The conflict engine identified ${params.conflictMatrix.items.length} trade-interaction risk(s) that must be coordinated before work starts.`
          : interfaceTrades.length
            ? `Adjacent interface trades requiring coordination include ${interfaceTrades.join(", ")}.`
            : "No simultaneous-operation conflicts were identified in the current planning set.",
        inlineOshaRefs
      ),
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
    tradeConflictCoordinationSection,
    {
      key: "equipment_conditions",
      title: "Equipment & Work Condition Risks",
      subsections: groupedTradePackages.map((pkg) => {
        const equipment = pkg.equipmentUsed.length
          ? `Equipment: ${pkg.equipmentUsed.join(", ")}.`
          : "Equipment: not specified.";
        const conditions = pkg.workConditions.length
          ? `Conditions: ${pkg.workConditions.join(", ")}.`
          : "Conditions: no additional work conditions listed.";
        return {
          title: pkg.label,
          body: pkg.locationLabels.length
            ? `Primary work areas: ${sentenceList(pkg.locationLabels, "N/A")}.`
            : null,
          bullets: [
            `Tasks: ${sentenceList(pkg.taskTitles, "N/A")}.`,
            equipment,
            conditions,
          ],
        };
      }),
    },
    {
      key: "weather_integration",
      title: "Weather Risk Integration",
      body: appendInlineOsha(
        params.generationContext.siteContext.weather?.summary
          ? params.generationContext.siteContext.weather.summary
          : paragraph(
              ruleSummary.weatherRestrictions.length
                ? `Weather-sensitive restrictions apply: ${ruleSummary.weatherRestrictions.join(", ")}.`
                : null,
              "No project-specific weather restriction has been recorded in the current planning set."
            ),
        inlineOshaRefs
      ),
      bullets: ruleSummary.weatherRestrictions,
    },
    {
      key: "required_controls",
      title: "Required Controls & Mitigation Measures",
      body: appendInlineOsha(narrativeSections.requiredControlsSummary, inlineOshaRefs),
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
    {
      key: "risk_priority_summary",
      title: "Risk Priority Summary",
      body: appendInlineOsha(narrativeSections.riskPrioritySummary, inlineOshaRefs),
      bullets: riskSummary.priorities.length ? riskSummary.priorities : ["No elevated priorities were identified."],
    },
    {
      key: "safety_narrative",
      title: "Safety Narrative",
      body: appendInlineOsha(narrativeSections.safetyNarrative, inlineOshaRefs),
    },
  ];
  const activityHazardMatrixAppendixSection = buildActivityHazardMatrixSectionForDraft({
    operations,
    groupedTradePackages,
    ruleSummary,
    scope: params.generationContext.scope,
    siteLocation: params.generationContext.siteContext.location,
    activeScopeTasks,
  });
  const [
    projectOverviewSection,
    tradeRiskBreakdownSection,
    taskHazardAnalysisSection,
    permitMatrixSection,
    trainingProgramSection,
    simultaneousOperationsSection,
    tradeConflictFrameworkSection,
    equipmentConditionsSection,
    weatherIntegrationSection,
    requiredControlsSection,
    riskPrioritySummarySection,
    safetyNarrativeSection,
  ] = sharedSections;
  const csepSelectedSections = buildCsepSelectedSections({
    generationContext: params.generationContext,
    operations,
    ruleSummary,
    conflictMatrix: params.conflictMatrix,
    trainingProgram,
    narrativeSections,
    oshaReferences,
    inlineOshaRefs,
  });
  const steelErectionPlan = buildSteelErectionPlan({
    generationContext: params.generationContext,
    operations,
    ruleSummary,
  });
  const steelOverlaySections = steelErectionPlan
    ? buildSteelErectionOverlaySections(steelErectionPlan)
    : [];
  const steelTaskModulesSection = buildSteelTaskModulesReferenceSection(
    params.generationContext,
    inlineOshaRefs
  );
  const steelHazardModulesSection = buildSteelHazardModulesReferenceSection(
    params.generationContext,
    inlineOshaRefs
  );
  const steelProgramModulesSection = buildSteelProgramModulesReferenceSection(
    params.generationContext,
    inlineOshaRefs
  );
  const unorderedSections: GeneratedSafetyPlanSection[] = isPshsep
    ? [
        definitionsSection,
        referencesSection,
        projectOverviewSection,
        ...pshsepCoreSections,
        tradeRiskBreakdownSection,
        taskHazardAnalysisSection,
        activityHazardMatrixAppendixSection,
        permitMatrixSection,
        trainingProgramSection,
        simultaneousOperationsSection,
        tradeConflictFrameworkSection,
        equipmentConditionsSection,
        ...pshsepHighRiskSections,
        ...(steelTaskModulesSection ? [steelTaskModulesSection] : []),
        ...(steelHazardModulesSection ? [steelHazardModulesSection] : []),
        ...(steelProgramModulesSection ? [steelProgramModulesSection] : []),
        ...programSections,
        ...buildPshsepAdminSections(params.generationContext, inlineOshaRefs),
        weatherIntegrationSection,
        requiredControlsSection,
        riskPrioritySummarySection,
        safetyNarrativeSection,
      ]
    : [
        definitionsSection,
        ...(!csepSelectedSections.some(
          (section) =>
            section.key === "references" ||
            section.key === "osha_references" ||
            section.key === "osha_reference_appendix"
        )
          ? [referencesSection]
          : []),
        ...csepSelectedSections,
        ...steelOverlaySections,
        ...programSections,
      ];
  const jurisdictionProfile = {
    governingState: params.generationContext.documentProfile.governingState ?? null,
    jurisdictionCode: params.generationContext.documentProfile.jurisdictionCode ?? "federal",
    jurisdictionName:
      params.generationContext.documentProfile.jurisdictionCode === "federal"
        ? "Federal OSHA"
        : params.generationContext.documentProfile.jurisdictionCode?.toUpperCase() ??
          "Federal OSHA",
    jurisdictionLabel: params.generationContext.documentProfile.jurisdictionLabel ?? "Federal OSHA",
    jurisdictionPlanType:
      params.generationContext.documentProfile.jurisdictionPlanType ?? "federal_osha",
    coversPrivateSector: true,
    source: "document_override" as const,
  };
  const jurisdictionApplied = isPshsep
    ? applyJurisdictionStandardsToPeshep({
        sections: unorderedSections,
        profile: jurisdictionProfile,
        config: params.jurisdictionStandardsConfig,
      })
    : applyJurisdictionStandardsToCsep({
        sections: unorderedSections,
        selections: params.generationContext.programSelections ?? [],
        profile: jurisdictionProfile,
        config: params.jurisdictionStandardsConfig,
      });
  const referenceTaggedSections = applyOshaReferenceTokensToSections(
    jurisdictionApplied.sections,
    oshaReferences
  );
  const normalizedSections = isPshsep
    ? referenceTaggedSections
    : normalizeCsepSections(referenceTaggedSections);
  const orderedSections = orderGeneratedSections(normalizedSections);
  const sections = orderCsepReferencePacksBeforePrograms(orderedSections);

  return {
    documentType: params.generationContext.documentProfile.documentType,
    projectDeliveryType: params.generationContext.documentProfile.projectDeliveryType,
    title:
      params.generationContext.documentProfile.title ??
      `${projectName} ${params.generationContext.documentProfile.documentType.toUpperCase()}`,
    documentControl: {
      projectSite: params.generationContext.project.projectName ?? null,
      primeContractor: params.generationContext.project.contractorCompany ?? null,
      clientOwner: params.generationContext.project.ownerClient ?? null,
      documentNumber:
        typeof params.generationContext.legacyFormSnapshot.document_number === "string"
          ? params.generationContext.legacyFormSnapshot.document_number
          : null,
      revision:
        typeof params.generationContext.legacyFormSnapshot.document_revision === "string"
          ? params.generationContext.legacyFormSnapshot.document_revision
          : "1.0",
      issueDate: null,
      preparedBy:
        typeof params.generationContext.legacyFormSnapshot.prepared_by === "string"
          ? params.generationContext.legacyFormSnapshot.prepared_by
          : params.generationContext.project.contractorContact ?? null,
      reviewedBy:
        typeof params.generationContext.legacyFormSnapshot.reviewed_by === "string"
          ? params.generationContext.legacyFormSnapshot.reviewed_by
          : null,
      approvedBy:
        typeof params.generationContext.legacyFormSnapshot.approved_by === "string"
          ? params.generationContext.legacyFormSnapshot.approved_by
          : null,
    },
    aiAssemblyDecisions: params.aiAssemblyDecisions ?? null,
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
    trainingProgram,
    narrativeSections,
    steelErectionPlan,
    sectionMap: sections,
    coverageAudit: null,
    builderSnapshot: params.generationContext.legacyFormSnapshot,
    provenance: {
      generator: "safety_plan_deterministic_assembler",
      documentType: params.generationContext.documentProfile.documentType,
      projectDeliveryType: params.generationContext.documentProfile.projectDeliveryType,
      projectName,
      bucketCount: params.reviewContext.buckets.length,
      rulesCount: params.reviewContext.rulesEvaluations.length,
      conflictCount: params.conflictMatrix.items.length,
      governingState: params.generationContext.documentProfile.governingState ?? null,
      jurisdictionCode: params.generationContext.documentProfile.jurisdictionCode ?? "federal",
      jurisdictionLabel: params.generationContext.documentProfile.jurisdictionLabel ?? "Federal OSHA",
      jurisdictionPlanType:
        params.generationContext.documentProfile.jurisdictionPlanType ?? "federal_osha",
      jurisdictionStandardsApplied:
        params.generationContext.documentProfile.jurisdictionStandardsApplied?.length
          ? params.generationContext.documentProfile.jurisdictionStandardsApplied
          : jurisdictionApplied.appliedStandards.map((standard) => standard.id),
      source: params.generationContext.documentProfile.source,
      builderInputHash: params.generationContext.builderInstructions?.builderInputHash ?? null,
      selectedBlockKeys: params.generationContext.builderInstructions?.selectedBlockKeys ?? [],
      riskMemorySummary: params.riskMemorySummary ?? null,
    },
  };
}

