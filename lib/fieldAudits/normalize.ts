import {
  deriveExcelSectionLabel,
  getEnvironmentalSections,
  getHealthSafetySections,
  orderedRowEntries,
  type AuditExcelRow,
} from "@/lib/jobsiteAudits/auditRows";
import { getFieldAuditSectionsForTrade } from "@/lib/jobsiteAudits/fieldAuditTradeScope";
import { fieldItemKey } from "@/lib/jobsiteAudits/oshaFieldAuditTemplate";
import {
  CONSTRUCTION_TRADE_LABEL_BY_SLUG,
  resolveSharedTradeCode,
} from "@/lib/sharedTradeTaxonomy";
import { normalizePrimaryHazardCode } from "@/lib/riskMemory/taxonomy";

export type FieldAuditRowStatus = "pass" | "fail" | "na";
export type FieldAuditStatusMap = Record<string, FieldAuditRowStatus | "">;
export type FieldAuditNotesMap = Record<string, string>;
export type FieldAuditPhotoCounts = Record<string, number>;
export type FieldAuditTemplateSource = "field" | "hs" | "env" | "mixed" | "built_in";
export type FieldAuditSeverity = "low" | "medium" | "high" | "critical";

export type NormalizedFieldAuditObservation = {
  sourceKey: string;
  templateSource: "field" | "hs" | "env";
  tradeCode: string | null;
  subTradeCode: string | null;
  taskCode: string | null;
  categoryCode: string | null;
  categoryLabel: string | null;
  itemLabel: string;
  status: FieldAuditRowStatus;
  severity: FieldAuditSeverity;
  notes: string | null;
  photoCount: number;
  evidenceMetadata: Record<string, unknown>;
  riskMemory: Record<string, unknown>;
};

export type FieldAuditScoreSummary = {
  total: number;
  pass: number;
  fail: number;
  na: number;
  scored: number;
  compliancePercent: number | null;
  failedCritical: number;
  photoCount: number;
};

export type NormalizedFieldAuditPayload = {
  observations: NormalizedFieldAuditObservation[];
  scoreSummary: FieldAuditScoreSummary;
};

function cleanString(input: unknown) {
  const value = String(input ?? "").trim();
  return value || null;
}

function cleanStatus(input: unknown): FieldAuditRowStatus | null {
  return input === "pass" || input === "fail" || input === "na" ? input : null;
}

function positiveInteger(input: unknown) {
  const value = Number(input ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function categoryCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || null;
}

function severityFor(params: {
  status: FieldAuditRowStatus;
  critical?: boolean;
  categoryLabel?: string | null;
  itemLabel: string;
}): FieldAuditSeverity {
  if (params.status === "pass" || params.status === "na") return "low";
  if (params.critical) return "critical";
  const haystack = `${params.categoryLabel ?? ""} ${params.itemLabel}`.toLowerCase();
  if (
    haystack.includes("fall protection") ||
    haystack.includes("excavation") ||
    haystack.includes("confined") ||
    haystack.includes("electrical") ||
    haystack.includes("crane") ||
    haystack.includes("rigging") ||
    haystack.includes("hot work")
  ) {
    return "high";
  }
  return "medium";
}

function primaryHazardFor(categoryLabel: string | null, itemLabel: string) {
  const haystack = `${categoryLabel ?? ""} ${itemLabel}`.toLowerCase();
  if (haystack.includes("fall") || haystack.includes("ladder") || haystack.includes("scaffold")) {
    return normalizePrimaryHazardCode("fall_to_lower_level");
  }
  if (haystack.includes("electrical") || haystack.includes("power") || haystack.includes("energized")) {
    return normalizePrimaryHazardCode("electrical_exposure");
  }
  if (haystack.includes("excavat") || haystack.includes("trench")) {
    return normalizePrimaryHazardCode("excavation_collapse");
  }
  if (haystack.includes("crane") || haystack.includes("rigging") || haystack.includes("struck")) {
    return normalizePrimaryHazardCode("struck_by_object");
  }
  if (haystack.includes("confined")) {
    return normalizePrimaryHazardCode("confined_space_exposure");
  }
  if (haystack.includes("hot work") || haystack.includes("weld") || haystack.includes("fire")) {
    return normalizePrimaryHazardCode("fire_explosion");
  }
  return null;
}

function excelItemLabel(row: AuditExcelRow) {
  const entries = orderedRowEntries(row);
  const preferred =
    row["Category/Requirement"] ||
    row["Category/Requirement_1"] ||
    row["Permit Type/Condition"] ||
    row["Permit Type/Condition_1"] ||
    entries[0]?.[1];
  const detail = entries
    .slice(0, 4)
    .map(([, value]) => value)
    .filter(Boolean)
    .join(" | ");
  return cleanString(detail || preferred) ?? "Audit checklist line";
}

function buildRiskMemory(params: {
  tradeCode: string | null;
  categoryLabel: string | null;
  itemLabel: string;
  status: FieldAuditRowStatus;
  severity: FieldAuditSeverity;
  notes: string | null;
}) {
  return {
    trade: params.tradeCode,
    primaryHazard: primaryHazardFor(params.categoryLabel, params.itemLabel),
    potentialSeverity:
      params.severity === "critical"
        ? "critical_potential"
        : params.severity === "high"
          ? "high_potential"
          : params.severity === "medium"
            ? "moderate_potential"
            : "low_potential",
    failedControl: params.status === "fail" ? "inspection_not_completed" : null,
    ppeStatus: params.status === "fail" && (params.categoryLabel ?? "").toLowerCase().includes("ppe")
      ? "deficient"
      : "unknown",
    correctiveActionStatus: params.status === "fail" ? "open" : null,
    details: {
      auditStatus: params.status,
      auditCategory: params.categoryLabel,
      auditItem: params.itemLabel,
      auditNotes: params.notes,
    },
  };
}

export function normalizeFieldAuditPayload(params: {
  selectedTrade: string;
  statusMap: FieldAuditStatusMap;
  notesMap?: FieldAuditNotesMap;
  photoCounts?: FieldAuditPhotoCounts;
}): NormalizedFieldAuditPayload {
  const selectedTrade = cleanString(params.selectedTrade) ?? "general_contractor";
  const tradeCode = resolveSharedTradeCode(selectedTrade) ?? selectedTrade;
  const observations: NormalizedFieldAuditObservation[] = [];
  const notesMap = params.notesMap ?? {};
  const photoCounts = params.photoCounts ?? {};

  for (const section of getFieldAuditSectionsForTrade(selectedTrade)) {
    for (const item of section.items) {
      const key = fieldItemKey(section.id, item.id);
      const status = cleanStatus(params.statusMap[key]);
      if (!status) continue;
      const notes = cleanString(notesMap[key]);
      const severity = severityFor({
        status,
        critical: item.critical,
        categoryLabel: section.title,
        itemLabel: item.label,
      });
      observations.push({
        sourceKey: key,
        templateSource: "field",
        tradeCode,
        subTradeCode: null,
        taskCode: null,
        categoryCode: categoryCode(section.id),
        categoryLabel: section.title,
        itemLabel: item.label,
        status,
        severity,
        notes,
        photoCount: positiveInteger(photoCounts[key]),
        evidenceMetadata: {
          oshaRef: item.oshaRef ?? null,
          critical: Boolean(item.critical),
        },
        riskMemory: buildRiskMemory({
          tradeCode,
          categoryLabel: section.title,
          itemLabel: item.label,
          status,
          severity,
          notes,
        }),
      });
    }
  }

  ([
    ["hs", getHealthSafetySections()] as const,
    ["env", getEnvironmentalSections()] as const,
  ]).forEach(([templateSource, sections]) => {
    sections.forEach((rows, sectionIndex) => {
      const label = deriveExcelSectionLabel(rows, sectionIndex, templateSource);
      rows.forEach((row, rowIndex) => {
        const key = `${templateSource}-${sectionIndex}-${rowIndex}`;
        const status = cleanStatus(params.statusMap[key]);
        if (!status) return;
        const itemLabel = excelItemLabel(row);
        const notes = cleanString(notesMap[key]);
        const severity = severityFor({ status, categoryLabel: label, itemLabel });
        observations.push({
          sourceKey: key,
          templateSource,
          tradeCode,
          subTradeCode: null,
          taskCode: null,
          categoryCode: categoryCode(label),
          categoryLabel: label,
          itemLabel,
          status,
          severity,
          notes,
          photoCount: positiveInteger(photoCounts[key]),
          evidenceMetadata: { row },
          riskMemory: buildRiskMemory({
            tradeCode,
            categoryLabel: label,
            itemLabel,
            status,
            severity,
            notes,
          }),
        });
      });
    });
  });

  return {
    observations,
    scoreSummary: summarizeFieldAuditObservations(observations),
  };
}

export function summarizeFieldAuditObservations(
  observations: readonly NormalizedFieldAuditObservation[]
): FieldAuditScoreSummary {
  let pass = 0;
  let fail = 0;
  let na = 0;
  let failedCritical = 0;
  let photoCount = 0;
  for (const observation of observations) {
    if (observation.status === "pass") pass += 1;
    if (observation.status === "fail") fail += 1;
    if (observation.status === "na") na += 1;
    if (observation.status === "fail" && observation.severity === "critical") failedCritical += 1;
    photoCount += observation.photoCount;
  }
  return {
    total: observations.length,
    pass,
    fail,
    na,
    scored: pass + fail,
    compliancePercent: pass + fail > 0 ? Math.round((pass / (pass + fail)) * 100) : null,
    failedCritical,
    photoCount,
  };
}

export function tradeLabel(trade: string) {
  return CONSTRUCTION_TRADE_LABEL_BY_SLUG[trade] ?? trade.replaceAll("_", " ");
}
