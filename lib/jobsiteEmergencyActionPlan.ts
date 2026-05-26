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
  secondary_assembly_area?: string | null;
  command_post_location?: string | null;
  evacuation_shelter_notes?: string | null;
  weather_shelter_location?: string | null;
  lightning_plan?: string | null;
  tornado_plan?: string | null;
  aed_location?: string | null;
  first_aid_location?: string | null;
  fire_extinguisher_locations?: string | null;
  spill_kit_locations?: string | null;
  rescue_equipment_locations?: string | null;
  nearest_medical_name?: string | null;
  nearest_medical_address?: string | null;
  nearest_medical_phone?: string | null;
  nearest_medical_route?: string | null;
  media_contact_name?: string | null;
  media_contact_phone?: string | null;
  media_statement_instructions?: string | null;
  regulatory_contact_name?: string | null;
  regulatory_contact_phone?: string | null;
  regulatory_reporting_instructions?: string | null;
  call_chain?: EmergencyPlanContact[] | null;
  utility_contacts?: EmergencyPlanContact[] | null;
  after_hours_contacts?: EmergencyPlanContact[] | null;
  backup_contacts?: EmergencyPlanBackupContact[] | null;
  incident_notification_timeline?: EmergencyPlanTimelineItem[] | null;
  post_incident_requirements?: string[] | null;
  notes?: string | null;
  revision_date?: string | null;
  last_reviewed_at?: string | null;
  last_reviewed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type JobsiteEmergencyActionPlanDefaults = Omit<
  JobsiteEmergencyActionPlanProfile,
  "id" | "jobsite_id" | "last_reviewed_at" | "last_reviewed_by" | "created_at" | "updated_at"
> & {
  id?: string | null;
  company_id?: string | null;
};

export type EmergencyPlanContact = {
  role?: string | null;
  name?: string | null;
  phone?: string | null;
  alternateName?: string | null;
  alternatePhone?: string | null;
  notes?: string | null;
};

export type EmergencyPlanBackupContact = EmergencyPlanContact & {
  primaryName?: string | null;
  primaryPhone?: string | null;
};

export type EmergencyPlanTimelineItem = {
  phase?: string | null;
  actions?: string[] | null;
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
  { key: "call_chain", label: "First call-chain supervisor/contact", severity: "critical" },
  { key: "command_post_location", label: "Site command post location", severity: "critical" },
  { key: "responder_access_instructions", label: "Responder gate or access instructions", severity: "critical" },
  { key: "responder_site_address", label: "Site address or responder directions", severity: "critical" },
  { key: "assembly_area", label: "Primary assembly or muster area", severity: "critical" },
  { key: "nearest_medical_name", label: "Nearest clinic or hospital name", severity: "critical" },
  { key: "nearest_medical_address", label: "Nearest clinic or hospital address", severity: "critical" },
  { key: "nearest_medical_phone", label: "Nearest clinic or hospital phone", severity: "critical" },
];

const EAP_REVIEW_FIELDS: EmergencyActionPlanMissingField[] = [
  { key: "secondary_assembly_area", label: "Secondary assembly or muster area", severity: "review" },
  { key: "evacuation_shelter_notes", label: "Evacuation notes", severity: "review" },
  { key: "weather_shelter_location", label: "Severe-weather shelter location", severity: "review" },
  { key: "lightning_plan", label: "Lightning plan", severity: "review" },
  { key: "tornado_plan", label: "Tornado plan", severity: "review" },
  { key: "aed_location", label: "AED location", severity: "review" },
  { key: "first_aid_location", label: "First aid location", severity: "review" },
  { key: "fire_extinguisher_locations", label: "Fire extinguisher locations", severity: "review" },
  { key: "spill_kit_locations", label: "Spill kit locations", severity: "review" },
  { key: "rescue_equipment_locations", label: "Rescue equipment locations", severity: "review" },
  { key: "nearest_medical_route", label: "Nearest medical route", severity: "review" },
  { key: "utility_contacts", label: "Utility shutoff contacts", severity: "review" },
  { key: "after_hours_contacts", label: "After-hours emergency contacts", severity: "review" },
  { key: "media_contact_name", label: "Media / public statement contact", severity: "review" },
  { key: "regulatory_contact_name", label: "Regulatory reporting contact", severity: "review" },
  { key: "backup_contacts", label: "Backup contacts", severity: "review" },
  { key: "post_incident_requirements", label: "Post-incident requirements", severity: "review" },
];

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.some((item) => hasValue(item));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasValue(item));
  }
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function hasCallableContact(value: unknown) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as EmergencyPlanContact;
    return hasValue(row.name) && hasValue(row.phone);
  });
}

function fieldHasValue(profile: JobsiteEmergencyActionPlanProfile | null, key: string) {
  if (key === "call_chain") return hasCallableContact(profile?.call_chain);
  return hasValue(profile?.[key as keyof JobsiteEmergencyActionPlanProfile]);
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
  const missingCritical = EAP_CRITICAL_FIELDS.filter((field) => !fieldHasValue(profile, field.key));
  const missingReview = EAP_REVIEW_FIELDS.filter((field) => !fieldHasValue(profile, field.key));
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

function mergeScalar<T extends string | null | undefined>(profileValue: T, defaultValue: T): T {
  return hasValue(profileValue) ? profileValue : defaultValue;
}

function mergeArray<T>(profileValue: T[] | null | undefined, defaultValue: T[] | null | undefined): T[] | null | undefined {
  return hasValue(profileValue) ? profileValue : defaultValue;
}

export function mergeEmergencyActionPlanDefaults(
  profile?: JobsiteEmergencyActionPlanProfile | null,
  defaults?: JobsiteEmergencyActionPlanDefaults | null
): JobsiteEmergencyActionPlanProfile | null {
  if (!profile && !defaults) return profile ?? null;
  if (!profile) {
    return {
      ...defaults,
      id: null,
      company_id: defaults?.company_id ?? null,
      jobsite_id: null,
      last_reviewed_at: null,
      last_reviewed_by: null,
      created_at: null,
      updated_at: null,
    };
  }
  if (!defaults) return profile;

  return {
    ...profile,
    emergency_contact_name: mergeScalar(profile.emergency_contact_name, defaults.emergency_contact_name),
    emergency_contact_phone: mergeScalar(profile.emergency_contact_phone, defaults.emergency_contact_phone),
    responder_access_instructions: mergeScalar(profile.responder_access_instructions, defaults.responder_access_instructions),
    responder_site_address: mergeScalar(profile.responder_site_address, defaults.responder_site_address),
    assembly_area: mergeScalar(profile.assembly_area, defaults.assembly_area),
    secondary_assembly_area: mergeScalar(profile.secondary_assembly_area, defaults.secondary_assembly_area),
    command_post_location: mergeScalar(profile.command_post_location, defaults.command_post_location),
    evacuation_shelter_notes: mergeScalar(profile.evacuation_shelter_notes, defaults.evacuation_shelter_notes),
    weather_shelter_location: mergeScalar(profile.weather_shelter_location, defaults.weather_shelter_location),
    lightning_plan: mergeScalar(profile.lightning_plan, defaults.lightning_plan),
    tornado_plan: mergeScalar(profile.tornado_plan, defaults.tornado_plan),
    aed_location: mergeScalar(profile.aed_location, defaults.aed_location),
    first_aid_location: mergeScalar(profile.first_aid_location, defaults.first_aid_location),
    fire_extinguisher_locations: mergeScalar(profile.fire_extinguisher_locations, defaults.fire_extinguisher_locations),
    spill_kit_locations: mergeScalar(profile.spill_kit_locations, defaults.spill_kit_locations),
    rescue_equipment_locations: mergeScalar(profile.rescue_equipment_locations, defaults.rescue_equipment_locations),
    nearest_medical_name: mergeScalar(profile.nearest_medical_name, defaults.nearest_medical_name),
    nearest_medical_address: mergeScalar(profile.nearest_medical_address, defaults.nearest_medical_address),
    nearest_medical_phone: mergeScalar(profile.nearest_medical_phone, defaults.nearest_medical_phone),
    nearest_medical_route: mergeScalar(profile.nearest_medical_route, defaults.nearest_medical_route),
    media_contact_name: mergeScalar(profile.media_contact_name, defaults.media_contact_name),
    media_contact_phone: mergeScalar(profile.media_contact_phone, defaults.media_contact_phone),
    media_statement_instructions: mergeScalar(profile.media_statement_instructions, defaults.media_statement_instructions),
    regulatory_contact_name: mergeScalar(profile.regulatory_contact_name, defaults.regulatory_contact_name),
    regulatory_contact_phone: mergeScalar(profile.regulatory_contact_phone, defaults.regulatory_contact_phone),
    regulatory_reporting_instructions: mergeScalar(profile.regulatory_reporting_instructions, defaults.regulatory_reporting_instructions),
    call_chain: mergeArray(profile.call_chain, defaults.call_chain),
    utility_contacts: mergeArray(profile.utility_contacts, defaults.utility_contacts),
    after_hours_contacts: mergeArray(profile.after_hours_contacts, defaults.after_hours_contacts),
    backup_contacts: mergeArray(profile.backup_contacts, defaults.backup_contacts),
    incident_notification_timeline: mergeArray(profile.incident_notification_timeline, defaults.incident_notification_timeline),
    post_incident_requirements: mergeArray(profile.post_incident_requirements, defaults.post_incident_requirements),
    notes: mergeScalar(profile.notes, defaults.notes),
    revision_date: mergeScalar(profile.revision_date, defaults.revision_date),
  };
}
