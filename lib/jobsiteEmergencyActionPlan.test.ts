import { describe, expect, it } from "vitest";
import { evaluateEmergencyActionPlanReadiness } from "./jobsiteEmergencyActionPlan";

const COMPLETE_PROFILE = {
  emergency_contact_name: "Site Superintendent",
  emergency_contact_phone: "555-0100",
  call_chain: [{ role: "Superintendent", name: "Site Superintendent", phone: "555-0100" }],
  command_post_location: "Main jobsite trailer",
  responder_access_instructions: "Use Gate 2 on River Road.",
  responder_site_address: "100 River Road, Milwaukee, WI",
  assembly_area: "North parking lot muster sign.",
  secondary_assembly_area: "South parking lot muster sign.",
  evacuation_shelter_notes: "Shelter in the west stair core during severe weather.",
  weather_shelter_location: "West stair core",
  lightning_plan: "Stop work and stay sheltered until 30 minutes after the last strike.",
  tornado_plan: "Shelter in the lowest interior area.",
  aed_location: "Main trailer entry.",
  first_aid_location: "Safety trailer shelf.",
  fire_extinguisher_locations: "Trailers, hot-work carts, and equipment.",
  spill_kit_locations: "Safety trailer and fuel area.",
  rescue_equipment_locations: "Safety trailer.",
  nearest_medical_name: "River Clinic",
  nearest_medical_address: "10 Clinic Drive",
  nearest_medical_phone: "555-0111",
  nearest_medical_route: "Exit Gate 2 and head east on River Road.",
  media_contact_name: "Company spokesperson",
  regulatory_contact_name: "Safety coordinator",
  utility_contacts: [{ role: "Electric", name: "Utility desk", phone: "555-0130" }],
  after_hours_contacts: [{ role: "After-hours safety", name: "Safety on call", phone: "555-0140" }],
  backup_contacts: [{ role: "Superintendent", name: "Site Superintendent", phone: "555-0100", alternateName: "Assistant Superintendent", alternatePhone: "555-0102" }],
  post_incident_requirements: ["Ensure safety / stop work", "Secure scene"],
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

  it("requires immediate review when the command post or first call-chain contact is missing", () => {
    const result = evaluateEmergencyActionPlanReadiness({
      profile: { ...COMPLETE_PROFILE, command_post_location: "", call_chain: [{ role: "Superintendent", name: "Site Lead", phone: "" }] },
      jobsiteStatus: "active",
      now: new Date("2026-05-25T12:00:00.000Z"),
    });

    expect(result.readiness).toBe("missing_critical_info");
    expect(result.missingFields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["command_post_location", "call_chain"])
    );
  });

  it("treats missing planning details as review items instead of immediate blockers", () => {
    const result = evaluateEmergencyActionPlanReadiness({
      profile: {
        ...COMPLETE_PROFILE,
        utility_contacts: [],
        backup_contacts: [],
        post_incident_requirements: [],
      },
      jobsiteStatus: "active",
      now: new Date("2026-05-25T12:00:00.000Z"),
    });

    expect(result.readiness).toBe("needs_review");
    expect(result.immediateReviewNeeded).toBe(false);
    expect(result.missingFields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["utility_contacts", "backup_contacts", "post_incident_requirements"])
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
