import { getChecklistItemsForSurface } from "@/lib/compliance/checklistCatalog";
import type { ChecklistSurface, HseChecklistItem } from "@/lib/compliance/types";

export type ChecklistMappingEvidence = {
  item: HseChecklistItem;
  applies: boolean;
  triggerActive: boolean;
  evidencePresent: boolean;
  currentFields: string[];
  missingFields: string[];
  notes: string[];
};

function readPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function hasSignal(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return false;
}

function flattenTextValues(value: unknown, collector: string[]) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) collector.push(trimmed.toLowerCase());
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      flattenTextValues(entry, collector);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      flattenTextValues(entry, collector);
    }
  }
}

function keywordCorpus(surface: ChecklistSurface, formData: Record<string, unknown>): string {
  const textValues: string[] = [];
  const fields =
    surface === "csep"
      ? [
          "trade",
          "subTrade",
          "tasks",
          "scope_of_work",
          "site_specific_notes",
          "emergency_procedures",
          "selected_hazards",
          "additional_permits",
          "required_ppe",
          "tradeItems",
        ]
      : [
          "company_name",
          "project_name",
          "project_description",
          "scope_of_work_selected",
          "permits_selected",
          "emergency_map",
          "assumed_trades_index",
          "disciplinary_policy_text",
          "owner_letter_text",
          "incident_reporting_process_text",
          "special_conditions_permit_text",
        ];

  for (const field of fields) {
    flattenTextValues(readPath(formData, field), textValues);
  }

  return textValues.join(" ");
}

function resolveSurfaceFields(
  fields: { csep?: string[]; peshep?: string[] } | undefined,
  surface: ChecklistSurface
): string[] {
  if (!fields) return [];
  return fields[surface] ?? [];
}

function triggerMatches(item: HseChecklistItem, surface: ChecklistSurface, formData: Record<string, unknown>) {
  const mode = item.triggerMode ?? "always";
  if (mode === "always") return true;

  const triggerFieldPaths = resolveSurfaceFields(item.triggerFields, surface);
  if (mode === "field_truthy") {
    return triggerFieldPaths.some((path) => hasSignal(readPath(formData, path)));
  }
  if (mode === "field_list_nonempty") {
    return triggerFieldPaths.some((path) => {
      const value = readPath(formData, path);
      return Array.isArray(value) && value.length > 0;
    });
  }

  const haystack = keywordCorpus(surface, formData);
  if (mode === "keyword_any") {
    return (item.triggerKeywords ?? []).some((keyword) => haystack.includes(keyword.toLowerCase()));
  }

  return false;
}

function collectCurrentAndMissing(
  item: HseChecklistItem,
  surface: ChecklistSurface,
  formData: Record<string, unknown>
) {
  const required = resolveSurfaceFields(item.requiredFields, surface);
  const evidence = resolveSurfaceFields(item.evidenceFields, surface);
  const fieldsToCheck = Array.from(new Set([...required, ...evidence]));
  const currentFields: string[] = [];
  const missingFields: string[] = [];

  for (const field of fieldsToCheck) {
    const value = readPath(formData, field);
    if (hasSignal(value)) {
      currentFields.push(field);
      continue;
    }
    if (required.includes(field)) {
      missingFields.push(field);
    }
  }

  return { currentFields, missingFields };
}

export function mapChecklistEvidence(
  surface: ChecklistSurface,
  formData: Record<string, unknown>
): ChecklistMappingEvidence[] {
  const items = getChecklistItemsForSurface(surface);
  return items.map((item) => {
    const triggerActive = triggerMatches(item, surface, formData);
    const applies = item.requirementType === "always" ? true : triggerActive;
    const { currentFields, missingFields } = collectCurrentAndMissing(item, surface, formData);
    const evidencePresent = currentFields.length > 0;
    const notes: string[] = [];
    if (!applies) notes.push("not_triggered");
    if (missingFields.length > 0) notes.push("missing_required_fields");
    if (!evidencePresent && applies) notes.push("evidence_not_found");

    return {
      item,
      applies,
      triggerActive,
      evidencePresent,
      currentFields,
      missingFields,
      notes,
    };
  });
}
