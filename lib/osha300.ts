/**
 * OSHA 300 Log utilities
 *
 * Maps `company_incidents` data to OSHA 300 columns and provides AI auto-fill
 * for incidents that are missing recordable classification.
 *
 * OSHA 300 columns:
 *   A  Case number
 *   B  Employee name
 *   C  Job title
 *   D  Date of injury/onset
 *   E  Where the event occurred
 *   F  Describe the injury/illness, parts of body affected, and object/substance involved
 *   G  Death (fatality)
 *   H  Days away from work (lost_time)
 *   I  Job transfer or restriction
 *   J  Other recordable cases
 *   K  Days away from work (count)
 *   L  Days job transfer or restriction (count)
 *   M1 Injury
 *   M2 Skin disorder
 *   M3 Respiratory condition
 *   M4 Poisoning
 *   M5 Hearing loss
 *   M6 All other illnesses
 */

import { requestAiResponsesText } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type Osha300IllnessType =
  | "injury"
  | "skin_disorder"
  | "respiratory"
  | "poisoning"
  | "hearing_loss"
  | "other_illness";

export type Osha300Classification = "death" | "days_away" | "restricted" | "other_recordable" | "not_recordable";

export type Osha300Entry = {
  /** source incident id */
  incidentId: string;
  /** Column A */
  caseNumber: string;
  /** Column B */
  employeeName: string | null;
  /** Column C */
  jobTitle: string | null;
  /** Column D */
  dateOfInjury: string | null;
  /** Column E */
  whereOccurred: string | null;
  /** Column F — AI-drafted or manual */
  descriptionOfInjury: string | null;
  /** Column G */
  death: boolean;
  /** Column H */
  daysAway: boolean;
  /** Column I */
  restricted: boolean;
  /** Column J */
  otherRecordable: boolean;
  /** Column K */
  daysAwayCount: number;
  /** Column L */
  daysRestrictedCount: number;
  /** Column M — illness type */
  illnessType: Osha300IllnessType;
  /** Whether the entry is OSHA-recordable at all */
  recordable: boolean;
  /** Raw severity for display */
  severity: string;
  /** Category from the incident */
  category: string | null;
};

export type Osha300AutofillSuggestion = {
  recordable: boolean;
  classification: Osha300Classification;
  illnessType: Osha300IllnessType;
  descriptionOfInjury: string;
  bodyPart: string | null;
  injuryType: string | null;
  daysAwayEstimate: number;
  daysRestrictedEstimate: number;
  reasoning: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Field mapping helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Maps injury_type to OSHA Column M illness category */
export function illnessTypeFromInjuryType(injuryType: string | null): Osha300IllnessType {
  if (!injuryType) return "injury";
  switch (injuryType) {
    case "chemical_burn":
      return "skin_disorder";
    case "respiratory":
      return "respiratory";
    case "poisoning":
      return "poisoning";
    case "hearing_loss":
      return "hearing_loss";
    case "heat_illness":
    case "cold_injury":
      return "other_illness";
    default:
      return "injury";
  }
}

export const ILLNESS_TYPE_LABELS: Record<Osha300IllnessType, string> = {
  injury: "Injury (M1)",
  skin_disorder: "Skin disorder (M2)",
  respiratory: "Respiratory condition (M3)",
  poisoning: "Poisoning (M4)",
  hearing_loss: "Hearing loss (M5)",
  other_illness: "All other illnesses (M6)",
};

/** Derives OSHA 300 classification from incident flags */
export function classificationFromIncident(incident: {
  fatality: boolean;
  lost_time: boolean;
  days_away_from_work: number;
  job_transfer: boolean;
  days_restricted: number;
  recordable: boolean;
}): Osha300Classification {
  if (!incident.recordable) return "not_recordable";
  if (incident.fatality) return "death";
  if (incident.lost_time || incident.days_away_from_work > 0) return "days_away";
  if (incident.job_transfer || incident.days_restricted > 0) return "restricted";
  return "other_recordable";
}

/** Builds a full OSHA 300 log entry from a raw incident row */
export function buildOsha300Entry(incident: {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  occurred_at: string | null;
  recordable: boolean;
  lost_time: boolean;
  fatality: boolean;
  days_away_from_work: number;
  days_restricted: number;
  job_transfer: boolean;
  body_part: string | null;
  injury_type: string | null;
  osha_description: string | null;
  employee_name: string | null;
  job_title: string | null;
  jobsite_name: string | null;
  case_number?: string | null;
}): Osha300Entry {
  const cls = classificationFromIncident(incident);
  return {
    incidentId: incident.id,
    caseNumber: incident.case_number ?? incident.id.slice(0, 8).toUpperCase(),
    employeeName: incident.employee_name,
    jobTitle: incident.job_title,
    dateOfInjury: incident.occurred_at,
    whereOccurred: incident.jobsite_name ?? null,
    descriptionOfInjury:
      incident.osha_description ||
      [
        incident.injury_type ? incident.injury_type.replace(/_/g, " ") : null,
        incident.body_part ? `to ${incident.body_part.replace(/_/g, " ")}` : null,
        incident.description ? `— ${incident.description.slice(0, 120)}` : null,
      ]
        .filter(Boolean)
        .join(" ") ||
      incident.title.slice(0, 200) ||
      null,
    death: cls === "death",
    daysAway: cls === "days_away",
    restricted: cls === "restricted",
    otherRecordable: cls === "other_recordable",
    daysAwayCount: incident.days_away_from_work,
    daysRestrictedCount: incident.days_restricted,
    illnessType: illnessTypeFromInjuryType(incident.injury_type),
    recordable: incident.recordable,
    severity: incident.severity,
    category: incident.category,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// AI auto-fill
// ──────────────────────────────────────────────────────────────────────────────

const AUTOFILL_SYSTEM = `You are an OSHA recordkeeping expert. Your job is to classify workplace incidents for the OSHA 300 Log.

OSHA recordability rules (simplified):
- Recordable if: work-related, new case, and requires medical treatment beyond first aid, OR involves days away, restricted duty, job transfer, loss of consciousness, diagnosis of significant injury/illness.
- First aid only (bandage, OTC pain reliever, non-prescription medication at nonprescription strength) → NOT recordable.
- Near misses with no injury → NOT recordable.

Respond ONLY with valid JSON matching this exact schema — no prose, no markdown:
{
  "recordable": boolean,
  "classification": "death" | "days_away" | "restricted" | "other_recordable" | "not_recordable",
  "illnessType": "injury" | "skin_disorder" | "respiratory" | "poisoning" | "hearing_loss" | "other_illness",
  "descriptionOfInjury": "string — OSHA Column F: concise description of injury/illness, body part, and object/substance involved (max 200 chars)",
  "bodyPart": "back" | "hand" | "fingers" | "knee" | "shoulder" | "eye" | "foot" | "other" | null,
  "injuryType": "abrasion" | "amputation" | "burn" | "chemical_burn" | "cold_injury" | "concussion" | "contusion" | "crush_injury" | "dislocation" | "fracture" | "heat_illness" | "hearing_loss" | "internal_injury" | "laceration" | "poisoning" | "puncture" | "respiratory" | "sprain" | "strain" | "vision_loss" | "other" | null,
  "daysAwayEstimate": number,
  "daysRestrictedEstimate": number,
  "reasoning": "string — one sentence explaining your recordability determination"
}`;

export async function aiAutofillOsha300(incident: {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  injury_type: string | null;
  body_part: string | null;
  exposure_event_type: string | null;
  days_away_from_work: number;
  days_restricted: number;
  fatality: boolean;
  recordable: boolean;
}): Promise<Osha300AutofillSuggestion | null> {
  const userPrompt = [
    `Title: ${incident.title}`,
    incident.description ? `Description: ${incident.description}` : null,
    `Category: ${(incident.category ?? "incident").replace(/_/g, " ")}`,
    `Severity: ${incident.severity}`,
    incident.injury_type ? `Injury type already recorded: ${incident.injury_type.replace(/_/g, " ")}` : null,
    incident.body_part ? `Body part already recorded: ${incident.body_part.replace(/_/g, " ")}` : null,
    incident.exposure_event_type ? `Exposure event: ${incident.exposure_event_type.replace(/_/g, " ")}` : null,
    incident.fatality ? "FATALITY: yes" : null,
    incident.days_away_from_work > 0 ? `Days away already recorded: ${incident.days_away_from_work}` : null,
    incident.days_restricted > 0 ? `Days restricted already recorded: ${incident.days_restricted}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const model =
    process.env.RCA_AI_MODEL?.trim() ||
    process.env.COMPANY_AI_MODEL?.trim() ||
    resolveCompanyAiDefaultModel("gpt-4o-mini");

  try {
    const res = await requestAiResponsesText({
      model,
      input: [
        { role: "system", content: AUTOFILL_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      surface: "osha-300.autofill",
      maxAttempts: 2,
    });

    const raw = (res.text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(raw) as Osha300AutofillSuggestion;

    // Validate required fields
    if (typeof parsed.recordable !== "boolean") return null;
    return {
      recordable: parsed.recordable,
      classification: parsed.classification ?? "not_recordable",
      illnessType: parsed.illnessType ?? "injury",
      descriptionOfInjury: String(parsed.descriptionOfInjury ?? "").slice(0, 200),
      bodyPart: parsed.bodyPart ?? null,
      injuryType: parsed.injuryType ?? null,
      daysAwayEstimate: Number(parsed.daysAwayEstimate) || 0,
      daysRestrictedEstimate: Number(parsed.daysRestrictedEstimate) || 0,
      reasoning: String(parsed.reasoning ?? "").slice(0, 300),
    };
  } catch {
    return null;
  }
}
