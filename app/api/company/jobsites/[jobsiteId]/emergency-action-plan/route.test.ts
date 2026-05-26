import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, getJobsiteAccessScope, isJobsiteAllowed, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  isAdminRole,
  normalizeAppRole: vi.fn((role) => role),
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));

import { GET, PATCH } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.upsert.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[], role = "company_admin") {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    role,
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

const jobsiteBuilder = () =>
  queryBuilder({
    data: { id: "jobsite-1", company_id: "company-1", name: "Main site", status: "active" },
    error: null,
  });

describe("/api/company/jobsites/[jobsiteId]/emergency-action-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
  });

  it("GET returns missing critical info for an active jobsite without a profile", async () => {
    authWithBuilders([
      jobsiteBuilder(),
      queryBuilder({ data: null, error: null }),
      queryBuilder({ data: null, error: null }),
    ]);

    const response = requireRouteResponse(await GET(
      new Request("https://example.com/api/company/jobsites/jobsite-1/emergency-action-plan"),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      profile: null,
      readiness: "missing_critical_info",
      immediateReviewNeeded: true,
    });
    expect(body.missingFields.length).toBeGreaterThan(0);
  });

  it("GET merges company defaults without overwriting jobsite profile fields", async () => {
    authWithBuilders([
      jobsiteBuilder(),
      queryBuilder({
        data: {
          id: "profile-1",
          company_id: "company-1",
          jobsite_id: "jobsite-1",
          emergency_contact_name: "Jobsite Lead",
          emergency_contact_phone: "555-0100",
          responder_site_address: "100 Main St",
          responder_access_instructions: "Gate 2",
          assembly_area: "North lot",
          nearest_medical_name: "Clinic",
          nearest_medical_address: "10 Clinic Dr",
          nearest_medical_phone: "555-0111",
          call_chain: [{ role: "Superintendent", name: "Jobsite Lead", phone: "555-0100" }],
        },
        error: null,
      }),
      queryBuilder({
        data: {
          id: "defaults-1",
          company_id: "company-1",
          emergency_contact_name: "Default Lead",
          command_post_location: "Company default trailer",
          fire_extinguisher_locations: "All trailers",
          utility_contacts: [{ role: "Electric", name: "Utility", phone: "555-0130" }],
        },
        error: null,
      }),
    ]);

    const response = requireRouteResponse(await GET(
      new Request("https://example.com/api/company/jobsites/jobsite-1/emergency-action-plan"),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile.emergency_contact_name).toBe("Jobsite Lead");
    expect(body.defaults.command_post_location).toBe("Company default trailer");
    expect(body.effectiveProfile.emergency_contact_name).toBe("Jobsite Lead");
    expect(body.effectiveProfile.command_post_location).toBe("Company default trailer");
  });

  it("PATCH saves a reviewed profile and returns complete readiness", async () => {
    const savedProfile = {
      id: "profile-1",
      company_id: "company-1",
      jobsite_id: "jobsite-1",
      emergency_contact_name: "Site Lead",
      emergency_contact_phone: "555-0100",
      responder_access_instructions: "Gate 2",
      responder_site_address: "100 Main St",
      assembly_area: "North lot",
      evacuation_shelter_notes: "Shelter in the west stair.",
      aed_location: "Trailer",
      first_aid_location: "Trailer shelf",
      nearest_medical_name: "Clinic",
      nearest_medical_address: "10 Clinic Dr",
      nearest_medical_phone: "555-0111",
      nearest_medical_route: "Gate 2 to Main St",
      command_post_location: "Main trailer",
      secondary_assembly_area: "South lot",
      weather_shelter_location: "West stair",
      lightning_plan: "Shelter until 30 minutes after last strike.",
      tornado_plan: "Shelter in lowest interior area.",
      fire_extinguisher_locations: "Trailers",
      spill_kit_locations: "Safety trailer",
      rescue_equipment_locations: "Safety trailer",
      media_contact_name: "Spokesperson",
      regulatory_contact_name: "Safety coordinator",
      call_chain: [{ role: "Superintendent", name: "Site Lead", phone: "555-0100" }],
      utility_contacts: [{ role: "Electric", name: "Utility", phone: "555-0120" }],
      after_hours_contacts: [{ role: "Safety", name: "On call", phone: "555-0130" }],
      backup_contacts: [{ role: "Superintendent", name: "Site Lead", phone: "555-0100", alternateName: "Alt", alternatePhone: "555-0102" }],
      post_incident_requirements: ["Secure scene"],
      last_reviewed_at: new Date().toISOString(),
      last_reviewed_by: "user-1",
    };
    const saveBuilder = queryBuilder({ data: savedProfile, error: null });
    authWithBuilders([jobsiteBuilder(), saveBuilder, queryBuilder({ data: null, error: null })]);

    const response = requireRouteResponse(await PATCH(
      new Request("https://example.com/api/company/jobsites/jobsite-1/emergency-action-plan", {
        method: "PATCH",
        body: JSON.stringify({
          emergencyContactName: "Site Lead",
          emergencyContactPhone: "555-0100",
          responderAccessInstructions: "Gate 2",
          responderSiteAddress: "100 Main St",
          assemblyArea: "North lot",
          evacuationShelterNotes: "Shelter in the west stair.",
          aedLocation: "Trailer",
          firstAidLocation: "Trailer shelf",
          nearestMedicalName: "Clinic",
          nearestMedicalAddress: "10 Clinic Dr",
          nearestMedicalPhone: "555-0111",
          commandPostLocation: "Main trailer",
          callChain: [{ role: "Superintendent", name: "Site Lead", phone: "555-0100" }],
          utilityContacts: [{ role: "Electric", name: "Utility", phone: "555-0120" }],
          postIncidentRequirements: ["Secure scene"],
          reviewed: true,
        }),
      }),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(saveBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        jobsite_id: "jobsite-1",
        emergency_contact_name: "Site Lead",
        command_post_location: "Main trailer",
        call_chain: [{ role: "Superintendent", name: "Site Lead", phone: "555-0100", alternateName: null, alternatePhone: null, primaryName: null, primaryPhone: null, notes: null }],
        last_reviewed_by: "user-1",
      }),
      { onConflict: "company_id,jobsite_id" }
    );
    expect(body.readiness).toBe("complete");
  });

  it("PATCH rejects non-manager write access", async () => {
    authWithBuilders([jobsiteBuilder()], "field_user");

    const response = requireRouteResponse(await PATCH(
      new Request("https://example.com/api/company/jobsites/jobsite-1/emergency-action-plan", {
        method: "PATCH",
        body: JSON.stringify({ emergencyContactName: "Site Lead" }),
      }),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    ));

    expect(response.status).toBe(403);
  });
});
