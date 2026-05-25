export type EmergencyActionPlanReadiness = "complete" | "needs_review" | "missing_critical_info";

export type EmergencyActionPlanMissingFieldSeverity = "critical" | "review";

export type EmergencyActionPlanMissingField = {
  key: string;
  label: string;
  severity: EmergencyActionPlanMissingFieldSeverity;
};

export type JobsiteEmergencyActionPlanProfile = {
  id?: string | null;
  company_id?: string | null;
  jobsite_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  responder_access_instructions?: string | null;
  responder_site_address?: string | null;
  assembly_area?: string | null;
  evacuation_shelter_notes?: string | null;
  aed_location?: string | null;
  first_aid_location?: string | null;
  nearest_medical_name?: string | null;
  nearest_medical_address?: string | null;
  nearest_medical_phone?: string | null;
  notes?: string | null;
  last_reviewed_at?: string | null;
  last_reviewed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EmergencyActionPlanReadinessInput = {
  profile?: JobsiteEmergencyActionPlanProfile | null;
  jobsiteStatus?: string | null;
  now?: Date;
  staleAfterDays?: number;
};

export type EmergencyActionPlanReadinessResult = {
  readiness: EmergencyActionPlanReadiness;
  missingFields: EmergencyActionPlanMissingField[];
  lastReviewedAt: string | null;
  lastReviewedBy: string | null;
  reviewStale: boolean;
  immediateReviewNeeded: boolean;
};

const EAP_CRITICAL_FIELDS: EmergencyActionPlanMissingField[] = [
  { key: "emergency_contact_name", label: "Emergency contact name", severity: "critical" },
  { key: "emergency_contact_phone", label: "Emergency contact phone", severity: "critical" },
  { key: "responder_access_instructions", label: "Responder gate or access instructions", severity: "critical" },
  { key: "responder_site_address", label: "Site address or responder directions", severity: "critical" },
  { key: "assembly_area", label: "Assembly or muster area", severity: "critical" },
  { key: "nearest_medical_name", label: "Nearest clinic or hospital name", severity: "critical" },
  { key: "nearest_medical_address", label: "Nearest clinic or hospital address", severity: "critical" },
  { key: "nearest_medical_phone", label: "Nearest clinic or hospital phone", severity: "critical" },
];

const EAP_REVIEW_FIELDS: EmergencyActionPlanMissingField[] = [
  { key: "evacuation_shelter_notes", label: "Evacuation or shelter notes", severity: "review" },
  { key: "aed_location", label: "AED location", severity: "review" },
  { key: "first_aid_location", label: "First aid location", severity: "review" },
];

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function isActiveJobsite(status?: string | null) {
  const normalized = String(status ?? "active").trim().toLowerCase();
  return !["completed", "archived"].includes(normalized);
}

function isReviewStale(lastReviewedAt: string | null, now: Date, staleAfterDays: number) {
  if (!lastReviewedAt) return true;
  const parsed = new Date(lastReviewedAt);
  if (Number.isNaN(parsed.getTime())) return true;
  const ageMs = now.getTime() - parsed.getTime();
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000;
}

export function evaluateEmergencyActionPlanReadiness(
  input: EmergencyActionPlanReadinessInput
): EmergencyActionPlanReadinessResult {
  const profile = input.profile ?? null;
  const now = input.now ?? new Date();
  const staleAfterDays = input.staleAfterDays ?? 90;
  const missingCritical = EAP_CRITICAL_FIELDS.filter((field) => !hasValue(profile?.[field.key as keyof JobsiteEmergencyActionPlanProfile]));
  const missingReview = EAP_REVIEW_FIELDS.filter((field) => !hasValue(profile?.[field.key as keyof JobsiteEmergencyActionPlanProfile]));
  const lastReviewedAt = typeof profile?.last_reviewed_at === "string" ? profile.last_reviewed_at : null;
  const lastReviewedBy = typeof profile?.last_reviewed_by === "string" ? profile.last_reviewed_by : null;
  const reviewStale = isReviewStale(lastReviewedAt, now, staleAfterDays);
  const active = isActiveJobsite(input.jobsiteStatus);
  const immediateReviewNeeded = active && missingCritical.length > 0;

  let readiness: EmergencyActionPlanReadiness = "complete";
  if (immediateReviewNeeded) {
    readiness = "missing_critical_info";
  } else if (missingCritical.length > 0 || missingReview.length > 0 || reviewStale) {
    readiness = "needs_review";
  }

  return {
    readiness,
    missingFields: [...missingCritical, ...missingReview],
    lastReviewedAt,
    lastReviewedBy,
    reviewStale,
    immediateReviewNeeded,
  };
}

export function emergencyActionPlanStatusLabel(readiness: EmergencyActionPlanReadiness) {
  if (readiness === "complete") return "Ready for field use";
  if (readiness === "missing_critical_info") return "Immediate review needed";
  return "Needs review";
}
