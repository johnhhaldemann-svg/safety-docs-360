import {
  buildPermitBookletMetadata,
  resolveHighRiskPermitDefinition,
} from "@/lib/highRiskPermitBooklet";

export type SafePredictPermitChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type SafePredictPermitAcknowledgement = {
  acknowledged: boolean;
  name: string;
  acknowledgedAt: string | null;
  statement: string;
};

export type SafePredictPermitForm = {
  permitCode?: string;
  permitName?: string;
  triggerReason?: string;
  requiredReviewer?: string;
  stopWorkRule?: string;
  referenceBasis?: string;
  checklistItems: SafePredictPermitChecklistItem[];
  acknowledgement: SafePredictPermitAcknowledgement;
  notes?: string;
};

export const SAFE_PREDICT_PERMIT_FORM_METADATA_KEY = "permit_form_v1";

export const SAFE_PREDICT_PERMIT_ACK_STATEMENT =
  "I acknowledge the permit checklist has been reviewed and the required controls are in place before work begins.";

const PERMIT_CHECKLISTS: Record<string, string[]> = {
  hot_work: [
    "Combustibles removed or protected within the hot-work area.",
    "Fire watch assigned and extinguisher available.",
    "Spark containment, ventilation, and post-work watch requirements reviewed.",
  ],
  loto: [
    "Energy sources identified and isolation points verified.",
    "Locks, tags, and try-start verification completed.",
    "Affected workers briefed before work begins.",
  ],
  lift_plan: [
    "Lift plan, load weight, radius, and rigging configuration reviewed.",
    "Exclusion zone and spotter communication confirmed.",
    "Weather, ground conditions, and equipment inspection verified.",
  ],
  elevated_work: [
    "Fall protection, anchor points, and rescue plan verified.",
    "Openings, edges, and drop zones barricaded or controlled.",
    "Access equipment inspection completed before use.",
  ],
  scaffold: [
    "Scaffold inspection tag is current and visible.",
    "Access, guardrails, planking, and base conditions checked.",
    "Workers briefed on loading limits and prohibited modifications.",
  ],
  electrical: [
    "Electrical scope and energized-work boundary reviewed.",
    "Qualified worker, PPE, and shock/arc-flash controls verified.",
    "Panel, circuit, or equipment identification confirmed.",
  ],
  confined_space: [
    "Atmospheric testing and ventilation requirements verified.",
    "Attendant, entrant, rescue, and communication plan confirmed.",
    "Isolation, retrieval, and entry authorization reviewed.",
  ],
  excavation: [
    "Utility locate, soil conditions, and protective system reviewed.",
    "Access/egress, spoil placement, and barricades verified.",
    "Competent-person inspection completed before entry.",
  ],
  generic: [
    "Permit scope, location, and responsible owner reviewed.",
    "Required controls are in place before work begins.",
    "Crew acknowledgment and closeout expectations confirmed.",
    "Permit validity window and work area boundaries confirmed.",
    "Reviewer/approver identified before work starts.",
    "Evidence requirements reviewed and attached where applicable.",
    "Stop-work triggers reviewed with the crew.",
    "Closeout signer and final inspection expectation confirmed.",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function permitChecklistKey(permitType: string) {
  const definition = resolveHighRiskPermitDefinition(permitType);
  if (definition) return definition.code.toLowerCase();
  const normalized = permitType.toLowerCase();
  if (normalized.includes("hot") || normalized.includes("weld") || normalized.includes("burn")) return "hot_work";
  if (normalized.includes("loto") || normalized.includes("lockout") || normalized.includes("tagout")) return "loto";
  if (normalized.includes("lift") || normalized.includes("crane") || normalized.includes("hoist")) return "lift_plan";
  if (normalized.includes("elevated") || normalized.includes("height") || normalized.includes("ladder") || normalized.includes("awp") || normalized.includes("mewp")) return "elevated_work";
  if (normalized.includes("scaffold")) return "scaffold";
  if (normalized.includes("electric") || normalized.includes("energized")) return "electrical";
  if (normalized.includes("confined")) return "confined_space";
  if (normalized.includes("excavat") || normalized.includes("trench")) return "excavation";
  return "generic";
}

export function defaultPermitChecklistItems(permitType: string): SafePredictPermitChecklistItem[] {
  const definition = resolveHighRiskPermitDefinition(permitType);
  const key = permitChecklistKey(permitType);
  const labels = definition?.checklistItems ?? PERMIT_CHECKLISTS[key] ?? PERMIT_CHECKLISTS.generic;
  return labels.map((label, index) => ({
    id: definition ? `${definition.code.replace(/-/g, "")}-${String(index + 1).padStart(2, "0")}` : `${key}-${index + 1}`,
    label,
    checked: false,
  }));
}

function normalizeChecklistItems(value: unknown, permitType: string) {
  if (!Array.isArray(value)) return defaultPermitChecklistItems(permitType);
  const items = value
    .map((item, index): SafePredictPermitChecklistItem | null => {
      if (!isRecord(item)) return null;
      const label = typeof item.label === "string" ? item.label.trim() : "";
      if (!label) return null;
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${permitChecklistKey(permitType)}-${index + 1}`,
        label,
        checked: Boolean(item.checked),
      };
    })
    .filter((item): item is SafePredictPermitChecklistItem => Boolean(item));
  return items.length > 0 ? items : defaultPermitChecklistItems(permitType);
}

export function normalizePermitForm(value: unknown, permitType: string): SafePredictPermitForm {
  const form = isRecord(value) ? value : {};
  const acknowledgement = isRecord(form.acknowledgement) ? form.acknowledgement : {};
  const acknowledged = Boolean(acknowledgement.acknowledged);
  const definition = resolveHighRiskPermitDefinition(permitType);
  return {
    permitCode:
      typeof form.permitCode === "string" && form.permitCode.trim()
        ? form.permitCode.trim()
        : definition?.code,
    permitName:
      typeof form.permitName === "string" && form.permitName.trim()
        ? form.permitName.trim()
        : definition?.name,
    triggerReason:
      typeof form.triggerReason === "string" && form.triggerReason.trim()
        ? form.triggerReason.trim()
        : definition?.trigger,
    requiredReviewer:
      typeof form.requiredReviewer === "string" && form.requiredReviewer.trim()
        ? form.requiredReviewer.trim()
        : definition?.requiredReviewer,
    stopWorkRule:
      typeof form.stopWorkRule === "string" && form.stopWorkRule.trim()
        ? form.stopWorkRule.trim()
        : definition?.stopWorkRule,
    referenceBasis:
      typeof form.referenceBasis === "string" && form.referenceBasis.trim()
        ? form.referenceBasis.trim()
        : definition?.referenceBasis,
    checklistItems: normalizeChecklistItems(form.checklistItems, permitType),
    acknowledgement: {
      acknowledged,
      name: typeof acknowledgement.name === "string" ? acknowledgement.name : "",
      acknowledgedAt: typeof acknowledgement.acknowledgedAt === "string" && acknowledgement.acknowledgedAt ? acknowledgement.acknowledgedAt : null,
      statement:
        typeof acknowledgement.statement === "string" && acknowledgement.statement.trim()
          ? acknowledgement.statement.trim()
          : SAFE_PREDICT_PERMIT_ACK_STATEMENT,
    },
    notes: typeof form.notes === "string" ? form.notes : "",
  };
}

export function permitFormFromMetadata(sourceMetadata: unknown, permitType: string) {
  const metadata = isRecord(sourceMetadata) ? sourceMetadata : {};
  return normalizePermitForm(metadata[SAFE_PREDICT_PERMIT_FORM_METADATA_KEY], permitType);
}

export function isPermitFormComplete(form: SafePredictPermitForm) {
  return (
    form.checklistItems.length > 0 &&
    form.checklistItems.every((item) => item.checked) &&
    form.acknowledgement.acknowledged &&
    form.acknowledgement.name.trim().length > 0
  );
}

export function permitReadinessLabel(form: SafePredictPermitForm): "Ready" | "Needs acknowledgement" | "Checklist incomplete" {
  if (!form.checklistItems.every((item) => item.checked)) return "Checklist incomplete";
  if (!form.acknowledgement.acknowledged || !form.acknowledgement.name.trim()) return "Needs acknowledgement";
  return "Ready";
}

export function preparePermitFormForSave(form: SafePredictPermitForm, now = new Date()) {
  const acknowledged = form.acknowledgement.acknowledged && form.acknowledgement.name.trim().length > 0;
  const definition = resolveHighRiskPermitDefinition(form.permitCode ?? form.permitName ?? "");
  const bookletMetadata = definition ? buildPermitBookletMetadata(definition) : null;
  return {
    ...(form.permitCode || bookletMetadata ? { permitCode: form.permitCode ?? bookletMetadata?.permitCode } : {}),
    ...(form.permitName || bookletMetadata ? { permitName: form.permitName ?? bookletMetadata?.permitName } : {}),
    ...(form.triggerReason || bookletMetadata ? { triggerReason: form.triggerReason ?? bookletMetadata?.trigger } : {}),
    ...(form.requiredReviewer || bookletMetadata ? { requiredReviewer: form.requiredReviewer ?? bookletMetadata?.requiredReviewer } : {}),
    ...(form.stopWorkRule || bookletMetadata ? { stopWorkRule: form.stopWorkRule ?? bookletMetadata?.stopWorkRule } : {}),
    ...(form.referenceBasis || bookletMetadata ? { referenceBasis: form.referenceBasis ?? bookletMetadata?.referenceBasis } : {}),
    checklistItems: form.checklistItems.map((item) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
    })),
    acknowledgement: {
      acknowledged,
      name: form.acknowledgement.name.trim(),
      acknowledgedAt: acknowledged ? form.acknowledgement.acknowledgedAt ?? now.toISOString() : null,
      statement: form.acknowledgement.statement || SAFE_PREDICT_PERMIT_ACK_STATEMENT,
    },
    notes: form.notes?.trim() ?? "",
  } satisfies SafePredictPermitForm;
}
