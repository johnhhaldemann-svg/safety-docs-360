import { describe, expect, it } from "vitest";
import { evaluateEmergencyActionPlanReadiness } from "./jobsiteEmergencyActionPlan";

const COMPLETE_PROFILE = {
  emergency_contact_name: "Site Superintendent",
  emergency_contact_phone: "555-0100",
  responder_access_instructions: "Use Gate 2 on River Road.",
  responder_site_address: "100 River Road, Milwaukee, WI",
  assembly_area: "North parking lot muster sign.",
  evacuation_shelter_notes: "Shelter in the west stair core during severe weather.",
  aed_location: "Main trailer entry.",
  first_aid_location: "Safety trailer shelf.",
  nearest_medical_name: "River Clinic",
  nearest_medical_address: "10 Clinic Drive",
  nearest_medical_phone: "555-0111",
  last_reviewed_at: "2026-05-20T12:00:00.000Z",
  last_reviewed_by: "user-1",
};

describe("evaluateEmergencyActionPlanReadiness", () => {
  it("marks complete profiles reviewed within the freshness window as complete", () => {
    expect(
      evaluateEmergencyActionPlanReadiness({
        profile: COMPLETE_PROFILE,
        jobsiteStatus: "active",
        now: new Date("2026-05-25T12:00:00.000Z"),
      })
    ).toMatchObject({
      readiness: "complete",
      missingFields: [],
      immediateReviewNeeded: false,
      reviewStale: false,
    });
  });

  it("requires immediate review when an active jobsite is missing critical emergency basics", () => {
    const result = evaluateEmergencyActionPlanReadiness({
      profile: { ...COMPLETE_PROFILE, assembly_area: "", nearest_medical_phone: null },
      jobsiteStatus: "active",
      now: new Date("2026-05-25T12:00:00.000Z"),
    });

    expect(result.readiness).toBe("missing_critical_info");
    expect(result.immediateReviewNeeded).toBe(true);
    expect(result.missingFields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["assembly_area", "nearest_medical_phone"])
    );
  });

  it("keeps completed jobsites out of immediate-review status while still showing gaps", () => {
    const result = evaluateEmergencyActionPlanReadiness({
      profile: { ...COMPLETE_PROFILE, responder_access_instructions: "" },
      jobsiteStatus: "completed",
      now: new Date("2026-05-25T12:00:00.000Z"),
    });

    expect(result.readiness).toBe("needs_review");
    expect(result.immediateReviewNeeded).toBe(false);
  });

  it("marks stale reviews as needing review", () => {
    const result = evaluateEmergencyActionPlanReadiness({
      profile: COMPLETE_PROFILE,
      jobsiteStatus: "active",
      now: new Date("2026-09-01T12:00:00.000Z"),
    });

    expect(result.readiness).toBe("needs_review");
    expect(result.reviewStale).toBe(true);
  });
});
