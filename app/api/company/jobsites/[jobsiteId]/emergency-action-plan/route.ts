import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import {
  evaluateEmergencyActionPlanReadiness,
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
  evacuationShelterNotes?: string | null;
  aedLocation?: string | null;
  firstAidLocation?: string | null;
  nearestMedicalName?: string | null;
  nearestMedicalAddress?: string | null;
  nearestMedicalPhone?: string | null;
  notes?: string | null;
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
  "evacuation_shelter_notes",
  "aed_location",
  "first_aid_location",
  "nearest_medical_name",
  "nearest_medical_address",
  "nearest_medical_phone",
  "notes",
  "last_reviewed_at",
  "last_reviewed_by",
  "created_at",
  "updated_at",
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

function isMissingEmergencyProfileTable(message?: string | null) {
  return (message ?? "").toLowerCase().includes("company_jobsite_emergency_profiles");
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
  jobsiteStatus?: string | null;
}) {
  const readiness = evaluateEmergencyActionPlanReadiness({
    profile: params.profile,
    jobsiteStatus: params.jobsiteStatus,
  });
  return {
    profile: params.profile,
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

  if (profileResult.error) {
    if (isMissingEmergencyProfileTable(profileResult.error.message)) {
      return NextResponse.json(
        { error: "Emergency Action Plan table is not available yet. Run the latest Supabase migration." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: profileResult.error.message || "Failed to load the Emergency Action Plan." },
      { status: 500 }
    );
  }

  return NextResponse.json(responsePayload({
    profile: (profileResult.data as JobsiteEmergencyActionPlanProfile | null) ?? null,
    jobsiteStatus: scoped.jobsite.status,
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
    evacuation_shelter_notes: cleanText(body?.evacuationShelterNotes),
    aed_location: cleanText(body?.aedLocation),
    first_aid_location: cleanText(body?.firstAidLocation),
    nearest_medical_name: cleanText(body?.nearestMedicalName, 200),
    nearest_medical_address: cleanText(body?.nearestMedicalAddress),
    nearest_medical_phone: cleanText(body?.nearestMedicalPhone, 40),
    notes: cleanText(body?.notes),
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

  return NextResponse.json({
    success: true,
    ...responsePayload({
      profile: upsertResult.data as JobsiteEmergencyActionPlanProfile,
      jobsiteStatus: scoped.jobsite.status,
    }),
    message: body?.reviewed ? "Emergency Action Plan saved and reviewed." : "Emergency Action Plan saved.",
  });
}
