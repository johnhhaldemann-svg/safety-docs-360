/**
 * Final CSEP export quality gate: logs issues to the console and throws before
 * DOCX bytes are produced so poor-quality plans are not silently shipped.
 */

import { CSEP_APPENDIX_REGULATORY_REFERENCES_KEY } from "@/lib/csepRegulatoryReferenceIndex";
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
  | { kind: "attachments_divider"; ordinal: number }
  | { kind: "appendices_divider"; ordinal: number }
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
  const documentControlSection = model.appendixSections.find(
    (section) => section.key === "document_control_and_revision_history"
  );
  const attachmentSections = model.appendixSections.filter(
    (section) => section.key !== "document_control_and_revision_history"
  );
  if (documentControlSection) {
    entries.push({ kind: "body_section", ordinal: ordinal++, section: documentControlSection });
  }
  if (attachmentSections.length) {
    entries.push({ kind: "attachments_divider", ordinal: ordinal++ });
    entries.push({ kind: "appendices_divider", ordinal: ordinal++ });
  }
  attachmentSections.forEach((section) => {
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
    case "attachments_divider":
      return `${entry.ordinal}. Attachments`;
    case "appendices_divider":
      return `${entry.ordinal}. Appendices`;
    case "disclaimer":
      return `${entry.ordinal}. Disclaimer`;
  }
}

const LOG_PREFIX = "[CSEP export quality]";

/** Maximum total subsection rows in main body (Section 1–12 narrative); deep outlines hurt usability. */
export const CSEP_EXPORT_MAX_MAIN_BODY_SUBSECTIONS = 120;

const REQUIRED_FRONT_MATTER_KEYS: readonly string[] = [
  "message_from_owner",
  "sign_off_page",
  "table_of_contents",
  "purpose",
  "scope",
  "top_10_risks",
  "trade_interaction_info",
  "roles_and_responsibilities",
  "disciplinary_program",
  "union",
  "security_at_site",
  "hazcom",
  "iipp_emergency_response",
  "work_attire_requirements",
  "hazards_and_controls",
];

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
  const inMain = model.sections.some((s) => s.key === key);
  if (inFront || inMain) {
    issues.push(
      "Document Control / revision history must appear only in end matter (appendix), not in front matter or main numbered sections."
    );
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
  const appendix = model.appendixSections.find((s) => s.key === CSEP_APPENDIX_REGULATORY_REFERENCES_KEY);
  if (!appendix) return [];
  const issues: string[] = [];
  for (const sub of appendix.subsections) {
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
  add("document_control_placement", checkDocumentControlPlacement(model));
  add("front_matter_required", checkRequiredFrontMatter(model));
  add("ppe_duplicates", checkPpeDuplicates(model));
  add("internal_generator_language", checkInternalGeneratorLanguage(model));
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
