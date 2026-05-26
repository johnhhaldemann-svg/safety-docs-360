import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import {
  evaluateEmergencyActionPlanReadiness,
  mergeEmergencyActionPlanDefaults,
  type JobsiteEmergencyActionPlanDefaults,
  type JobsiteEmergencyActionPlanProfile,
} from "@/lib/jobsiteEmergencyActionPlan";
import { authorizeRequest, isAdminRole, normalizeAppRole } from "@/lib/rbac";

export const runtime = "nodejs";

type Params = { jobsiteId: string };

type EmergencyActionPlanPayload = {
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  responderAccessInstructions?: string | null;
  responderSiteAddress?: string | null;
  assemblyArea?: string | null;
  secondaryAssemblyArea?: string | null;
  commandPostLocation?: string | null;
  evacuationShelterNotes?: string | null;
  weatherShelterLocation?: string | null;
  lightningPlan?: string | null;
  tornadoPlan?: string | null;
  aedLocation?: string | null;
  firstAidLocation?: string | null;
  fireExtinguisherLocations?: string | null;
  spillKitLocations?: string | null;
  rescueEquipmentLocations?: string | null;
  nearestMedicalName?: string | null;
  nearestMedicalAddress?: string | null;
  nearestMedicalPhone?: string | null;
  nearestMedicalRoute?: string | null;
  mediaContactName?: string | null;
  mediaContactPhone?: string | null;
  mediaStatementInstructions?: string | null;
  regulatoryContactName?: string | null;
  regulatoryContactPhone?: string | null;
  regulatoryReportingInstructions?: string | null;
  callChain?: unknown;
  utilityContacts?: unknown;
  afterHoursContacts?: unknown;
  backupContacts?: unknown;
  incidentNotificationTimeline?: unknown;
  postIncidentRequirements?: unknown;
  notes?: string | null;
  revisionDate?: string | null;
  reviewed?: boolean;
};

const PROFILE_SELECT = [
  "id",
  "company_id",
  "jobsite_id",
  "emergency_contact_name",
  "emergency_contact_phone",
  "responder_access_instructions",
  "responder_site_address",
  "assembly_area",
  "secondary_assembly_area",
  "command_post_location",
  "evacuation_shelter_notes",
  "weather_shelter_location",
  "lightning_plan",
  "tornado_plan",
  "aed_location",
  "first_aid_location",
  "fire_extinguisher_locations",
  "spill_kit_locations",
  "rescue_equipment_locations",
  "nearest_medical_name",
  "nearest_medical_address",
  "nearest_medical_phone",
  "nearest_medical_route",
  "media_contact_name",
  "media_contact_phone",
  "media_statement_instructions",
  "regulatory_contact_name",
  "regulatory_contact_phone",
  "regulatory_reporting_instructions",
  "call_chain",
  "utility_contacts",
  "after_hours_contacts",
  "backup_contacts",
  "incident_notification_timeline",
  "post_incident_requirements",
  "notes",
  "revision_date",
  "last_reviewed_at",
  "last_reviewed_by",
  "created_at",
  "updated_at",
].join(", ");

const DEFAULTS_SELECT = [
  "id",
  "company_id",
  "emergency_contact_name",
  "emergency_contact_phone",
  "responder_access_instructions",
  "responder_site_address",
  "assembly_area",
  "secondary_assembly_area",
  "command_post_location",
  "evacuation_shelter_notes",
  "weather_shelter_location",
  "lightning_plan",
  "tornado_plan",
  "aed_location",
  "first_aid_location",
  "fire_extinguisher_locations",
  "spill_kit_locations",
  "rescue_equipment_locations",
  "nearest_medical_name",
  "nearest_medical_address",
  "nearest_medical_phone",
  "nearest_medical_route",
  "media_contact_name",
  "media_contact_phone",
  "media_statement_instructions",
  "regulatory_contact_name",
  "regulatory_contact_phone",
  "regulatory_reporting_instructions",
  "call_chain",
  "utility_contacts",
  "after_hours_contacts",
  "backup_contacts",
  "incident_notification_timeline",
  "post_incident_requirements",
  "notes",
  "revision_date",
].join(", ");

function canWriteEmergencyActionPlan(role?: string | null) {
  const normalized = normalizeAppRole(role);
  return (
    isAdminRole(normalized) ||
    normalized === "company_admin" ||
    normalized === "manager" ||
    normalized === "safety_manager"
  );
}

function cleanText(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanStringArray(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 500))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function cleanContactArray(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        role: cleanText(row.role, 120),
        name: cleanText(row.name, 160),
        phone: cleanText(row.phone, 40),
        alternateName: cleanText(row.alternateName, 160),
        alternatePhone: cleanText(row.alternatePhone, 40),
        primaryName: cleanText(row.primaryName, 160),
        primaryPhone: cleanText(row.primaryPhone, 40),
        notes: cleanText(row.notes, 500),
      };
    })
    .filter((item) => Boolean(item && Object.values(item).some(Boolean)))
    .slice(0, maxItems);
}

function cleanTimelineArray(value: unknown, maxItems = 10) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const phase = cleanText(row.phase, 120);
      const actions = cleanStringArray(row.actions, 8);
      if (!phase && actions.length === 0) return null;
      return { phase, actions };
    })
    .filter((item): item is { phase: string | null; actions: string[] } => Boolean(item))
    .slice(0, maxItems);
}

function isMissingEmergencyProfileTable(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("company_jobsite_emergency_profiles") ||
    normalized.includes("company_jobsite_emergency_defaults") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find")
  );
}

async function resolveScopedJobsite(request: Request, params: Promise<Params>) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_access_jobsites",
      "can_view_dashboards",
      "can_view_all_company_data",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return { authError: auth.error } as const;

  const { jobsiteId } = await params;
  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) {
    return { authError: NextResponse.json({ error: "No company scope found for user." }, { status: 400 }) } as const;
  }

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id, name, status")
    .eq("id", jobsiteId)
    .eq("company_id", scope.companyId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return {
      authError: NextResponse.json(
        { error: jobsiteResult.error.message || "Failed to load jobsite." },
        { status: 500 }
      ),
    } as const;
  }
  if (!jobsiteResult.data) {
    return { authError: NextResponse.json({ error: "Jobsite not found." }, { status: 404 }) } as const;
  }

  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: scope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return { authError: NextResponse.json({ error: "Jobsite not found." }, { status: 404 }) } as const;
  }

  return {
    auth,
    companyId: scope.companyId,
    jobsite: jobsiteResult.data as { id: string; name?: string | null; status?: string | null },
  } as const;
}

function responsePayload(params: {
  profile: JobsiteEmergencyActionPlanProfile | null;
  defaults?: JobsiteEmergencyActionPlanDefaults | null;
  jobsiteStatus?: string | null;
  jobsite?: { id: string; name?: string | null; status?: string | null } | null;
}) {
  const effectiveProfile = mergeEmergencyActionPlanDefaults(params.profile, params.defaults ?? null);
  const readiness = evaluateEmergencyActionPlanReadiness({
    profile: effectiveProfile,
    jobsiteStatus: params.jobsiteStatus,
  });
  return {
    profile: params.profile,
    defaults: params.defaults ?? null,
    effectiveProfile,
    jobsite: params.jobsite ?? null,
    readiness: readiness.readiness,
    missingFields: readiness.missingFields,
    lastReviewedAt: readiness.lastReviewedAt,
    lastReviewedBy: readiness.lastReviewedBy,
    reviewStale: readiness.reviewStale,
    immediateReviewNeeded: readiness.immediateReviewNeeded,
  };
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const scoped = await resolveScopedJobsite(request, params);
  if ("authError" in scoped) return scoped.authError;

  const profileResult = await scoped.auth.supabase
    .from("company_jobsite_emergency_profiles")
    .select(PROFILE_SELECT)
    .eq("company_id", scoped.companyId)
    .eq("jobsite_id", scoped.jobsite.id)
    .is("archived_at", null)
    .maybeSingle();

  const defaultsResult = await scoped.auth.supabase
    .from("company_jobsite_emergency_defaults")
    .select(DEFAULTS_SELECT)
    .eq("company_id", scoped.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (profileResult.error || defaultsResult.error) {
    const message = profileResult.error?.message || defaultsResult.error?.message;
    if (isMissingEmergencyProfileTable(message)) {
      return NextResponse.json(
        { error: "Emergency Action Plan tables are not available yet. Run the latest Supabase migration." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: message || "Failed to load the Emergency Action Plan." },
      { status: 500 }
    );
  }

  return NextResponse.json(responsePayload({
    profile: (profileResult.data as JobsiteEmergencyActionPlanProfile | null) ?? null,
    defaults: (defaultsResult.data as JobsiteEmergencyActionPlanDefaults | null) ?? null,
    jobsiteStatus: scoped.jobsite.status,
    jobsite: scoped.jobsite,
  }));
}

export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const scoped = await resolveScopedJobsite(request, params);
  if ("authError" in scoped) return scoped.authError;
  if (!canWriteEmergencyActionPlan(scoped.auth.role)) {
    return NextResponse.json(
      { error: "Only company admins, safety managers, and operations managers can manage Emergency Action Plans." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as EmergencyActionPlanPayload | null;
  const now = new Date().toISOString();
  const row = {
    company_id: scoped.companyId,
    jobsite_id: scoped.jobsite.id,
    emergency_contact_name: cleanText(body?.emergencyContactName, 200),
    emergency_contact_phone: cleanText(body?.emergencyContactPhone, 40),
    responder_access_instructions: cleanText(body?.responderAccessInstructions),
    responder_site_address: cleanText(body?.responderSiteAddress),
    assembly_area: cleanText(body?.assemblyArea),
    secondary_assembly_area: cleanText(body?.secondaryAssemblyArea),
    command_post_location: cleanText(body?.commandPostLocation),
    evacuation_shelter_notes: cleanText(body?.evacuationShelterNotes),
    weather_shelter_location: cleanText(body?.weatherShelterLocation),
    lightning_plan: cleanText(body?.lightningPlan),
    tornado_plan: cleanText(body?.tornadoPlan),
    aed_location: cleanText(body?.aedLocation),
    first_aid_location: cleanText(body?.firstAidLocation),
    fire_extinguisher_locations: cleanText(body?.fireExtinguisherLocations),
    spill_kit_locations: cleanText(body?.spillKitLocations),
    rescue_equipment_locations: cleanText(body?.rescueEquipmentLocations),
    nearest_medical_name: cleanText(body?.nearestMedicalName, 200),
    nearest_medical_address: cleanText(body?.nearestMedicalAddress),
    nearest_medical_phone: cleanText(body?.nearestMedicalPhone, 40),
    nearest_medical_route: cleanText(body?.nearestMedicalRoute),
    media_contact_name: cleanText(body?.mediaContactName, 200),
    media_contact_phone: cleanText(body?.mediaContactPhone, 40),
    media_statement_instructions: cleanText(body?.mediaStatementInstructions),
    regulatory_contact_name: cleanText(body?.regulatoryContactName, 200),
    regulatory_contact_phone: cleanText(body?.regulatoryContactPhone, 40),
    regulatory_reporting_instructions: cleanText(body?.regulatoryReportingInstructions),
    call_chain: cleanContactArray(body?.callChain),
    utility_contacts: cleanContactArray(body?.utilityContacts),
    after_hours_contacts: cleanContactArray(body?.afterHoursContacts),
    backup_contacts: cleanContactArray(body?.backupContacts),
    incident_notification_timeline: cleanTimelineArray(body?.incidentNotificationTimeline),
    post_incident_requirements: cleanStringArray(body?.postIncidentRequirements, 20),
    notes: cleanText(body?.notes),
    revision_date: cleanDate(body?.revisionDate),
    ...(body?.reviewed ? { last_reviewed_at: now, last_reviewed_by: scoped.auth.user.id } : {}),
    updated_by: scoped.auth.user.id,
    created_by: scoped.auth.user.id,
  };

  const upsertResult = await scoped.auth.supabase
    .from("company_jobsite_emergency_profiles")
    .upsert(row, { onConflict: "company_id,jobsite_id" })
    .select(PROFILE_SELECT)
    .single();

  if (upsertResult.error) {
    if (isMissingEmergencyProfileTable(upsertResult.error.message)) {
      return NextResponse.json(
        { error: "Emergency Action Plan table is not available yet. Run the latest Supabase migration." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: upsertResult.error.message || "Failed to save the Emergency Action Plan." },
      { status: 500 }
    );
  }

  const defaultsResult = await scoped.auth.supabase
    .from("company_jobsite_emergency_defaults")
    .select(DEFAULTS_SELECT)
    .eq("company_id", scoped.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (defaultsResult.error && !isMissingEmergencyProfileTable(defaultsResult.error.message)) {
    return NextResponse.json(
      { error: defaultsResult.error.message || "Failed to load Emergency Action Plan defaults." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    ...responsePayload({
      profile: upsertResult.data as JobsiteEmergencyActionPlanProfile,
      defaults: (defaultsResult.data as JobsiteEmergencyActionPlanDefaults | null) ?? null,
      jobsiteStatus: scoped.jobsite.status,
      jobsite: scoped.jobsite,
    }),
    message: body?.reviewed ? "Emergency Action Plan saved and reviewed." : "Emergency Action Plan saved.",
  });
}
