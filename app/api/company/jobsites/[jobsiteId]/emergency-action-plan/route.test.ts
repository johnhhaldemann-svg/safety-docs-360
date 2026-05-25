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
      last_reviewed_at: new Date().toISOString(),
      last_reviewed_by: "user-1",
    };
    const saveBuilder = queryBuilder({ data: savedProfile, error: null });
    authWithBuilders([jobsiteBuilder(), saveBuilder]);

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
