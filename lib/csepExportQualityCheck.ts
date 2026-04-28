/**
 * Final CSEP export quality gate: logs issues to the console and throws before
 * DOCX bytes are produced so poor-quality plans are not silently shipped.
 */

import { CSEP_APPENDIX_REGULATORY_REFERENCES_KEY } from "@/lib/csepRegulatoryReferenceIndex";
import { CANONICAL_CSEP_SECTION_ORDER } from "@/lib/csep/csep-section-order";
import type {
  CsepRenderModel,
  CsepTemplateSection,
  CsepTemplateSubsection,
} from "@/lib/csepDocxRenderer";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

/** Mirror of `lib/csepDocxRenderer` outline plan (kept local to avoid a circular import). */
type CsepOutlinePlanEntry =
  | { kind: "title_page"; ordinal: number }
  | { kind: "body_section"; ordinal: number; section: CsepTemplateSection }
  | { kind: "disclaimer"; ordinal: number };

function baseTitleForOutlineHeading(section: CsepTemplateSection) {
  return section.title.trim().replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
}

function displayOutlineSectionHeading(ordinal: number, section: CsepTemplateSection) {
  const base = baseTitleForOutlineHeading(section);
  return `${ordinal}. ${base}`.trim();
}

function buildCsepOutlinePlan(model: CsepRenderModel): CsepOutlinePlanEntry[] {
  let ordinal = 1;
  const entries: CsepOutlinePlanEntry[] = [];
  entries.push({ kind: "title_page", ordinal: ordinal++ });
  model.frontMatterSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.sections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  model.appendixSections.forEach((section) => {
    entries.push({ kind: "body_section", ordinal: ordinal++, section });
  });
  entries.push({ kind: "disclaimer", ordinal: ordinal++ });
  return entries;
}

function formatOutlineTocLine(entry: CsepOutlinePlanEntry): string {
  switch (entry.kind) {
    case "title_page":
      return `${entry.ordinal}. Title Page`;
    case "body_section":
      return displayOutlineSectionHeading(entry.ordinal, entry.section);
    case "disclaimer":
      return `${entry.ordinal}. Disclaimer`;
  }
}

const LOG_PREFIX = "[CSEP export quality]";

/** Maximum total subsection rows in main body; structured program modules expand the outline by design. */
export const CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS = 360;

const REQUIRED_FRONT_MATTER_KEYS: readonly string[] = CANONICAL_CSEP_SECTION_ORDER
  .filter((section) => section.kind === "front_matter")
  .map((section) => section.key);

const TASK_MODULE_SECTION_KEY_PATTERN = /task_modules_reference|steel_task_modules_reference/i;

const INTERNAL_GENERATOR_PATTERNS: readonly RegExp[] = [
  /\bmoduleKey\b/i,
  /\bGeneratedSafetyPlan\b/i,
  /\bSafetyReferenceModule\b/i,
  /\bplainText\b/i,
  /\bsectionHeadings\b/i,
  /\btriggerManifest\b/i,
  /\bApplicability\s*\/\s*trigger logic\b/i,
  /\bIncluded for this scope\b/i,
  /\bprimary exposure profile\b/i,
  /\bmain exposure profile\b/i,
  /\btask scope\s*&\s*work conditions\b/i,
];

const STEEL_SCOPE_TRADE_PATTERN =
  /\b(steel|structural\s+steel|ironwork|metal\s+deck|decking|steel\s+erection)\b/i;

const STEEL_KEYWORD_GROUPS: readonly { id: string; pattern: RegExp }[] = [
  {
    id: "CAZ / CDZ / controlled access or decking zone",
    pattern: /\b(caz|cdz|controlled\s+access\s+zone|controlled\s+decking\s+zone|decking\s+zone|ironworker\s+work\s+zones?)\b/i,
  },
  {
    id: "Suspended load / swing / load path",
    pattern: /\b(suspended\s+loads?|suspended\s+load|under\s+(a\s+)?suspended\s+load|swing\s+radius|load\s+path|crane\s+swing|hoisting)\b/i,
  },
  {
    id: "Fall protection / leading edge / tie-off",
    pattern: /\b(fall\s+protection|leading\s+edge|100%\s*tie|tie-?off|personal\s+fall)\b/i,
  },
  {
    id: "Rescue / fall arrest / emergency medical",
    pattern: /\b(rescue|fall\s+arrest|suspension\s+trauma|post-?arrest|911|emergency\s+response)\b/i,
  },
  { id: "HazCom / SDS", pattern: /\b(hazcom|hazard\s+communication|\bsds\b|safety\s+data\s+sheet)\b/i },
  {
    id: "Crane permit / lift plan / pick plan",
    pattern: /\b(crane\s+permit|lift\s+plan|pick\s+plan|critical\s+lift|site\s+lift\s+plan)\b/i,
  },
];
const COVER_REQUIRED_METADATA_LABELS = ["Project Name", "Project Address", "Contractor", "Date"] as const;
const HAZCOM_REFERENCE_ALLOWLIST = [
  "Follow the project Hazard Communication requirements defined in the HazCom section.",
  "Follow the project Hazard Communication requirements defined in the Hazard Communication and Environmental Protection section.",
  "Follow the project Hazard Communication requirements for sealants.",
];
const SECURITY_REFERENCE_ALLOWLIST = [
  "Follow the project Security at Site requirements defined in the Security at Site section.",
  "Follow the project-wide Site Access, Laydown, and Traffic Control requirements in the Security at Site section.",
  "Follow the project-wide Site Access, Laydown, and Traffic Control requirements in the Site Access, Security, Laydown, and Traffic Control section.",
  "Follow owner, GC/CM, and site-specific dress codes",
];
const IIPP_REFERENCE_ALLOWLIST = [
  "Follow the project IIPP / Emergency Response requirements defined in the IIPP / Emergency Response section.",
  "Follow the project IIPP, Incident Reporting, and Corrective Action requirements defined in the IIPP, Incident Reporting, and Corrective Action section.",
];
const OWNERSHIP_COMPANION_KEYS: Record<string, readonly string[]> = {
  iipp_incident_reporting_corrective_action: [
    "training_competency_and_certifications",
    "worker_conduct_fit_for_duty_disciplinary_program",
  ],
  site_access_security_laydown_traffic_control: [
    "trade_interaction_and_coordination",
    "high_risk_steel_erection_programs",
    "hazard_control_modules",
    "task_execution_modules",
  ],
};
const MAX_HAZARD_MODULE_COUNT = 100;

function templateSubsectionHasContent(subsection: CsepTemplateSubsection): boolean {
  return Boolean(
    subsection.paragraphs?.some((paragraph) => paragraph.trim()) ||
      subsection.items?.some((item) => item.trim()) ||
      subsection.table?.rows.some((row) => row.some((cell) => cell.trim()))
  );
}

function normalizeHeadingKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function flattenSectionTexts(sections: readonly CsepTemplateSection[]): string[] {
  const out: string[] = [];
  for (const section of sections) {
    out.push(section.title, section.descriptor ?? "");
    for (const sub of section.subsections) {
      out.push(sub.title, ...(sub.paragraphs ?? []), ...(sub.items ?? []));
      if (sub.table?.rows) {
        for (const row of sub.table.rows) {
          out.push(...row);
        }
      }
    }
  }
  return out;
}

function flattenModelText(model: CsepRenderModel): string {
  const chunks: string[] = [
    model.projectName,
    model.contractorName,
    model.tradeLabel ?? "",
    model.subTradeLabel ?? "",
    model.titlePageTaskSummary,
    ...model.coverSubtitleLines,
    ...model.approvalLines,
    ...model.disclaimerLines,
    ...flattenSectionTexts(model.frontMatterSections),
    ...flattenSectionTexts(model.sections),
    ...flattenSectionTexts(model.appendixSections),
  ];
  return chunks.join("\n");
}

function checkTocVsNumberLabels(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const plan = buildCsepOutlinePlan(model);
  for (const entry of plan) {
    if (entry.kind !== "body_section") continue;
    if (entry.section.key === "table_of_contents") continue;
    const nl = entry.section.numberLabel?.trim();
    if (!nl) continue;
    const m = nl.match(/^(\d+)/);
    if (!m) continue;
    const fromLabel = Number.parseInt(m[1]!, 10);
    if (fromLabel !== entry.ordinal) {
      issues.push(
        `TOC/body numbering drift: section key "${entry.section.title}" uses numberLabel prefix ${fromLabel} but outline ordinal is ${entry.ordinal} (TOC line: "${formatOutlineTocLine(entry)}").`
      );
    }
  }
  return issues;
}

function checkTocInternalConsistency(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const plan = buildCsepOutlinePlan(model);
  for (const entry of plan) {
    if (entry.kind !== "body_section" || entry.section.key === "table_of_contents") continue;
    const tocLine = formatOutlineTocLine(entry);
    const base = entry.section.title.trim().replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
    const expected = `${entry.ordinal}. ${base}`.trim();
    if (tocLine !== expected) {
      issues.push(`TOC line mismatch internal rule for "${entry.section.key}": got "${tocLine}", expected "${expected}".`);
    }
  }
  return issues;
}

function checkDocumentControlPlacement(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const key = "document_control_and_revision_history";
  const inFront = model.frontMatterSections.some((s) => s.key === key);
  const inAppendix = model.appendixSections.some((s) => s.key === key);
  if (inFront || inAppendix) {
    issues.push(
      "Document Control / revision history must appear only as Section 21, not in front matter or appendices."
    );
  }
  const mainIndex = model.sections.findIndex((s) => s.key === key);
  if (mainIndex !== model.sections.length - 1) {
    issues.push("Document Control and Revision History must be the final main body section.");
  }
  const earlyIndex = model.frontMatterSections.findIndex(
    (s) =>
      /\bdocument\s+control\b/i.test(s.title) ||
      normalizeHeadingKey(s.key).includes("document control") ||
      normalizeHeadingKey(s.key).includes("revision history")
  );
  if (earlyIndex >= 0 && earlyIndex < model.frontMatterSections.findIndex((s) => s.key === "table_of_contents")) {
    issues.push(
      "Document Control (or revision history) content appears before the Table of Contents in front matter — it belongs in appendix end matter after the main body."
    );
  }
  return issues;
}

function checkRequiredFrontMatter(model: CsepRenderModel): string[] {
  const keys = new Set(model.frontMatterSections.map((s) => s.key));
  return REQUIRED_FRONT_MATTER_KEYS.filter((k) => !keys.has(k)).map((k) => `Required front-matter section missing: "${k}".`);
}

function checkCoverPageBaseline(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  if ((model.projectName ?? "").trim().length === 0) {
    issues.push("Cover page baseline check failed: project name is empty.");
  }
  if ((model.statusLabel ?? "").trim().length === 0) {
    issues.push("Cover page baseline check failed: status label is empty.");
  }
  const labels = new Set(model.coverMetadataRows.map((row) => row.label.trim()));
  for (const label of COVER_REQUIRED_METADATA_LABELS) {
    if (!labels.has(label)) {
      issues.push(`Cover page baseline check failed: required metadata row "${label}" is missing.`);
    }
  }
  return issues;
}

function checkFrontMatterOrder(model: CsepRenderModel): string[] {
  const orderedKeys = model.frontMatterSections.map((section) => section.key);
  const checkpoints = ["message_from_owner", "sign_off_page", "table_of_contents"];
  const indexes = checkpoints.map((key) => orderedKeys.indexOf(key));
  if (indexes.some((index) => index < 0)) return [];
  if (!(indexes[0]! < indexes[1]! && indexes[1]! < indexes[2]!)) {
    return [
      "Front matter order invalid: Message from Owner, Sign-Off Page, and Table of Contents must appear in that sequence.",
    ];
  }
  return [];
}

function checkScopeSectionCleanliness(model: CsepRenderModel): string[] {
  const scope = model.sections.find((section) => section.key === "scope_of_work_section");
  if (!scope) return [];
  const badSub = scope.subsections.find((subsection) =>
    /\b(project information|contractor information)\b/i.test(subsection.title)
  );
  if (!badSub) return [];
  return [
    `Scope section includes disallowed administrative block "${badSub.title}". Scope should remain clean after section cleanup.`,
  ];
}

function checkHazardModuleReasonableCount(model: CsepRenderModel): string[] {
  const hazards = model.sections.find((section) => section.key === "hazard_control_modules");
  if (!hazards) return [];
  const moduleCount = hazards.subsections.filter((subsection) => /:\s*Risk$/i.test(subsection.title)).length;
  if (moduleCount <= MAX_HAZARD_MODULE_COUNT) return [];
  return [
    `Hazards and Controls contains ${moduleCount} hazard modules, exceeding reasonable limit ${MAX_HAZARD_MODULE_COUNT}.`,
  ];
}

function checkDuplicateLadderAuthorizationBlocks(model: CsepRenderModel): string[] {
  const hazards = model.sections.find((section) => section.key === "hazard_control_modules");
  if (!hazards) return [];
  const ladderBlocks = hazards.subsections
    .map((subsection) => normalizeHeadingKey(subsection.title))
    .filter((title) => title.includes("ladder authorization program"));
  if (ladderBlocks.length <= 1) return [];
  return ["Duplicate Ladder Authorization Program hazard blocks detected."];
}

function checkDuplicatePpeAcrossHazards(model: CsepRenderModel): string[] {
  const hazards = model.sections.find((section) => section.key === "hazard_control_modules");
  if (!hazards) return [];
  const ppeLines = hazards.subsections
    .flatMap((subsection) => [...(subsection.paragraphs ?? []), ...(subsection.items ?? [])])
    .map((line) => line.trim())
    .filter((line) => /\b(ppe|personal protective equipment|hard hat|safety glasses|hi[-\s]?vis|harness)\b/i.test(line))
    .map((line) => normalizeHeadingKey(line))
    .filter((line) => line.length >= 10);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  ppeLines.forEach((line) => {
    if (seen.has(line)) dupes.add(line);
    seen.add(line);
  });
  if (dupes.size <= 1) return [];
  return [
    `Duplicate PPE narrative detected across hazard modules (${dupes.size} duplicate line(s)); keep PPE references concise and non-repetitive.`,
  ];
}

function sectionText(section: CsepTemplateSection): string[] {
  return section.subsections.flatMap((subsection) => [
    subsection.title,
    ...(subsection.paragraphs ?? []),
    ...(subsection.items ?? []),
  ]);
}

function checkOwnedTopicIsolation(
  model: CsepRenderModel,
  ownerKey: string,
  topicPattern: RegExp,
  allowlist: string[]
): string[] {
  const allSections = [...model.frontMatterSections, ...model.sections];
  const leaks: string[] = [];
  const companionKeys = new Set(OWNERSHIP_COMPANION_KEYS[ownerKey] ?? []);
  for (const section of allSections) {
    if (section.key === ownerKey || companionKeys.has(section.key)) continue;
    for (const line of sectionText(section)) {
      if (!topicPattern.test(line)) continue;
      if (allowlist.some((entry) => line.includes(entry))) continue;
      leaks.push(`${section.title}: ${line.slice(0, 120)}`);
      if (leaks.length >= 5) break;
    }
    if (leaks.length >= 5) break;
  }
  if (!leaks.length) return [];
  return [`Topic ownership leak for "${ownerKey}" detected outside owner section: ${leaks.join(" | ")}`];
}

function checkPermitCoverageAndPlacement(model: CsepRenderModel, draft?: GeneratedSafetyPlanDraft): string[] {
  if (!draft) return [];
  const selectedPermits = Array.from(
    new Set(
      [
        ...(draft.ruleSummary?.permitTriggers ?? []),
        ...draft.operations.flatMap((op) => op.permitTriggers ?? []),
      ]
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (!selectedPermits.length) return [];

  const allSections = [...model.frontMatterSections, ...model.sections];
  const sectionPermitCounts = allSections.map((section) => ({
    key: section.key,
    count: sectionText(section).reduce((sum, line) => {
      const permitSignal = line.replace(/\bpermit\s+holder\b/gi, "");
      return sum + (/\bpermit|lift plan|pick plan|hot work\b/i.test(permitSignal) ? 1 : 0);
    }, 0),
  }));
  const sorted = [...sectionPermitCounts].sort((a, b) => b.count - a.count);
  const primary = sorted[0];
  if (!primary || primary.count === 0) {
    return ["Selected permit triggers are present in draft input but no permit content appears in the export body."];
  }
  const permittedReferenceSections = new Set([
    "regulatory_basis_and_references",
    "required_permits_and_hold_points",
    "high_risk_steel_erection_programs",
    "hazard_control_modules",
    "task_execution_modules",
  ]);
  const noisySections = sorted.filter(
    (entry) => entry.count > 0 && entry.key !== primary.key && !permittedReferenceSections.has(entry.key)
  );
  if (noisySections.length > 4) {
    return [
      `Permit content is scattered across too many sections (${1 + noisySections.length}); keep permits consolidated in one clean primary permit section and only brief relevant references elsewhere.`,
    ];
  }

  const modelText = flattenModelText(model).toLowerCase();
  const canonicalizePermit = (value: string) =>
    value
      .toLowerCase()
      .replace(/\bpermit\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const missing = selectedPermits.filter((permit) => {
    const full = permit.toLowerCase();
    const normalized = canonicalizePermit(permit);
    if (full && modelText.includes(full)) return false;
    if (normalized && modelText.includes(normalized)) return false;
    return true;
  });
  if (missing.length) {
    return [`Selected permit trigger(s) missing from export text: ${missing.join(", ")}.`];
  }
  return [];
}

function checkPpeDuplicates(model: CsepRenderModel): string[] {
  const ppeSection = model.frontMatterSections.find((s) => normalizeHeadingKey(s.key) === "required ppe");
  if (!ppeSection) return [];
  const lines: string[] = [];
  for (const sub of ppeSection.subsections) {
    lines.push(...(sub.items ?? []), ...(sub.paragraphs ?? []));
  }
  const normalized = lines.map((l) => normalizeHeadingKey(l)).filter(Boolean);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const line of normalized) {
    if (line.length < 4) continue;
    if (seen.has(line)) dupes.add(line);
    seen.add(line);
  }
  if (!dupes.size) return [];
  return [`Duplicate PPE lines detected in Required PPE section: ${[...dupes].slice(0, 8).join("; ")}${dupes.size > 8 ? " …" : ""}.`];
}

function checkInternalGeneratorLanguage(model: CsepRenderModel): string[] {
  const haystack = flattenModelText(model);
  const hits: string[] = [];
  for (const pattern of INTERNAL_GENERATOR_PATTERNS) {
    if (pattern.test(haystack)) {
      hits.push(pattern.source);
    }
  }
  if (!hits.length) return [];
  return [`Internal generator / scaffold wording detected (patterns: ${hits.slice(0, 6).join(", ")}).`];
}

function checkTaskModuleSafetyControls(model: CsepRenderModel): string[] {
  const issues: string[] = [];
  const allSections = [...model.frontMatterSections, ...model.sections, ...model.appendixSections];
  for (const section of allSections) {
    if (!TASK_MODULE_SECTION_KEY_PATTERN.test(section.key)) continue;
    section.subsections.forEach((sub, index) => {
      if (!templateSubsectionHasContent(sub)) {
        issues.push(
          `Task module section "${section.title}" (${section.key}) has empty subsection #${index + 1} titled "${sub.title || "(untitled)"}" — safety controls or narrative must be present.`
        );
      }
    });
  }
  return issues;
}

function checkRegulatoryAppendixRNumbers(model: CsepRenderModel): string[] {
  const section = model.sections.find((s) => s.key === CSEP_APPENDIX_REGULATORY_REFERENCES_KEY);
  if (!section) return ["Regulatory Basis and References section is missing."];
  const issues: string[] = [];
  for (const sub of section.subsections) {
    const rows = sub.table?.rows ?? [];
    for (const row of rows) {
      const left = (row[0] ?? "").trim();
      const right = (row[1] ?? "").trim();
      const combined = `${left} ${right}`.trim();
      if (!combined) continue;
      if (/^(library area|intended use)\b/i.test(left) || /^intended use\b/i.test(right)) continue;
      if (/stable r-number citations/i.test(combined)) continue;
      const citesOsha = /\bOSHA\b.*\b29\s+CFR\b/i.test(right) || /\bOSHA\b.*\b29\s+CFR\b/i.test(left);
      if (!citesOsha) continue;
      const hasRCode = /^R\d+$/i.test(left) || /^R\d+$/i.test(right) || /\bR\d+\b/.test(left);
      if (!hasRCode) {
        issues.push(
          `Regulatory appendix row pairs OSHA text without a leading R-code column: "${left.slice(0, 40)}" / "${right.slice(0, 100)}${right.length > 100 ? "…" : ""}"`
        );
      }
    }
  }
  return issues.slice(0, 25);
}

function matrixColumnIndex(columns: readonly string[], ...aliases: string[]): number {
  const normalized = columns.map((c) => normalizeHeadingKey(c));
  for (const alias of aliases) {
    const target = normalizeHeadingKey(alias);
    const idx = normalized.findIndex((c) => c === target || c.includes(target));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Appendix E flags identical long control prose across many task rows to catch
 * accidental copy-paste. Some controls are standard permit boilerplate and are
 * expected to repeat verbatim across unrelated tasks (e.g. hot work + fire watch
 * on welding, cutting, grinding, touch-up).
 */
function controlTextIsLegitimatelyReusableAcrossTasks(normalizedControl: string): boolean {
  if (normalizedControl.length < 24) return false;
  if (/\bhot\s+work\b/.test(normalizedControl) && /\bfire\s+watch\b/.test(normalizedControl)) return true;
  if (/\bhot\s+work\b/.test(normalizedControl) && /\b(permit|posted|authorization)\b/.test(normalizedControl))
    return true;
  if (
    /\b(welding|cutting|grinding|torch|brazing)\b/.test(normalizedControl) &&
    /\b(hot\s+work|fire\s+watch|combustible|spark|ignite)\b/.test(normalizedControl)
  ) {
    return true;
  }
  if (/\block\s*out\b/.test(normalizedControl) && /\btag\s*out\b/.test(normalizedControl)) return true;
  if (/\bloto\b/.test(normalizedControl) && /\b(energy|electrical|de\s*energ)\b/.test(normalizedControl)) return true;
  return false;
}

function checkAppendixEDuplicateControls(model: CsepRenderModel): string[] {
  const appendix = model.appendixSections.find(
    (s) =>
      /appendix[_\s]*e/i.test(s.key) ||
      /appendix\s+e/i.test(s.title) ||
      (/task/i.test(s.title) && /hazard/i.test(s.title) && /matrix/i.test(s.title))
  );
  if (!appendix?.subsections.length) return [];

  for (const sub of appendix.subsections) {
    const table = sub.table;
    if (!table?.rows.length || table.rows.length < 3) continue;

    const idx = matrixColumnIndex(table.columns, "Required Controls", "Controls", "Control", "Activity", "Task");
    const taskIdx = matrixColumnIndex(table.columns, "Activity", "Task", "Task title");
    if (idx < 0) continue;

    const byControl = new Map<string, Set<string>>();
    for (const row of table.rows) {
      const control = normalizeHeadingKey(row[idx] ?? "");
      if (control.length < 24) continue;
      const taskKey = taskIdx >= 0 ? normalizeHeadingKey(row[taskIdx] ?? "") : normalizeHeadingKey(row.join("|"));
      if (!byControl.has(control)) byControl.set(control, new Set());
      byControl.get(control)!.add(taskKey || "unknown-task");
    }

    const problems: string[] = [];
    for (const [control, tasks] of byControl) {
      if (controlTextIsLegitimatelyReusableAcrossTasks(control)) continue;
      if (tasks.size >= 3) {
        problems.push(`"${control.slice(0, 80)}…" reused across ${tasks.size} distinct task rows`);
      }
    }
    if (problems.length) {
      return [
        `Appendix E (task–hazard–control matrix): identical or near-identical long control text appears across multiple unrelated tasks — ${problems.slice(0, 5).join(" | ")}`,
      ];
    }
  }
  return [];
}

function checkMainBodySubsectionBudget(model: CsepRenderModel): string[] {
  const count = model.sections.reduce((sum, s) => sum + s.subsections.length, 0);
  if (count > CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS) {
    return [
      `Main body subsection count (${count}) exceeds the export limit (${CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS}); simplify program slices or hazard blocks before export.`,
    ];
  }
  return [];
}

function isSteelExportScope(model: CsepRenderModel, draft?: GeneratedSafetyPlanDraft): boolean {
  const bundle = `${model.tradeLabel ?? ""} ${model.subTradeLabel ?? ""} ${model.titlePageTaskSummary}`;
  if (STEEL_SCOPE_TRADE_PATTERN.test(bundle)) return true;
  if (!draft) return false;
  const extended = draft as GeneratedSafetyPlanDraft & {
    siteContext?: { metadata?: Record<string, unknown> };
  };
  const m = extended.siteContext?.metadata;
  if (m && typeof m === "object") {
    if (Array.isArray(m.steelTaskModules) && m.steelTaskModules.length) return true;
    if (Array.isArray(m.steelHazardModules) && m.steelHazardModules.length) return true;
  }
  return false;
}

function checkSteelRequiredTopics(model: CsepRenderModel, draft?: GeneratedSafetyPlanDraft): string[] {
  if (!isSteelExportScope(model, draft)) return [];
  const text = flattenModelText(model).toLowerCase();
  const missing = STEEL_KEYWORD_GROUPS.filter((g) => !g.pattern.test(text)).map((g) => g.id);
  if (!missing.length) return [];
  return [
    `Steel-related CSEP is missing expected safety topic coverage in export text: ${missing.join("; ")}.`,
  ];
}

export type CsepExportQualityIssue = {
  code: string;
  message: string;
};

/**
 * Runs export-time checks, logs every finding to stderr, and throws if any issue
 * is present so callers never return a DOCX buffer for a failed quality gate.
 */
export function assertCsepExportQuality(model: CsepRenderModel, options?: { draft?: GeneratedSafetyPlanDraft }): void {
  const issues: CsepExportQualityIssue[] = [];

  const add = (code: string, messages: string[]) => {
    for (const message of messages) {
      issues.push({ code, message });
    }
  };

  add("toc_number_label", checkTocVsNumberLabels(model));
  add("toc_consistency", checkTocInternalConsistency(model));
  add("cover_page_baseline", checkCoverPageBaseline(model));
  add("front_matter_order", checkFrontMatterOrder(model));
  add("document_control_placement", checkDocumentControlPlacement(model));
  add("front_matter_required", checkRequiredFrontMatter(model));
  add("scope_section_cleanliness", checkScopeSectionCleanliness(model));
  add("hazard_module_count", checkHazardModuleReasonableCount(model));
  add("ladder_authorization_duplicates", checkDuplicateLadderAuthorizationBlocks(model));
  add("hazard_ppe_duplicates", checkDuplicatePpeAcrossHazards(model));
  add("ppe_duplicates", checkPpeDuplicates(model));
  add("internal_generator_language", checkInternalGeneratorLanguage(model));
  add(
    "hazcom_isolation",
    checkOwnedTopicIsolation(
      model,
      "hazard_communication_and_environmental_protection",
      /\b(hazcom|hazard communication|sds|safety data sheet|chemical inventory|ghs|nfpa|secondary container)\b/i,
      HAZCOM_REFERENCE_ALLOWLIST
    )
  );
  add(
    "security_isolation",
    checkOwnedTopicIsolation(
      model,
      "site_access_security_laydown_traffic_control",
      /\b(worker access|visitor|badge|site entry|unauthorized access|uncontrolled access|site security)\b/i,
      SECURITY_REFERENCE_ALLOWLIST
    )
  );
  add(
    "iipp_isolation",
    checkOwnedTopicIsolation(
      model,
      "iipp_incident_reporting_corrective_action",
      /\b(incident reporting|fit[-\s]?for[-\s]?duty|drug|alcohol)\b/i,
      IIPP_REFERENCE_ALLOWLIST
    )
  );
  add("permit_coverage", checkPermitCoverageAndPlacement(model, options?.draft));
  add("task_module_empty", checkTaskModuleSafetyControls(model));
  add("regulatory_r_numbers", checkRegulatoryAppendixRNumbers(model));
  add("appendix_e_duplicate_controls", checkAppendixEDuplicateControls(model));
  add("main_body_subsection_budget", checkMainBodySubsectionBudget(model));
  add("steel_required_topics", checkSteelRequiredTopics(model, options?.draft));

  if (!issues.length) return;

  for (const issue of issues) {
    console.error(`${LOG_PREFIX} [${issue.code}] ${issue.message}`);
  }

  const summary = issues.map((i) => `[${i.code}] ${i.message}`).join("\n");
  throw new Error(`${LOG_PREFIX} Export blocked: ${issues.length} quality issue(s).\n${summary}`);
}
