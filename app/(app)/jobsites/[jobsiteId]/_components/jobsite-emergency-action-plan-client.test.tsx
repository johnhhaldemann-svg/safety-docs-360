import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlannerActionBar, PostedCrisisSheet } from "./jobsite-emergency-action-plan-client";

vi.mock("@/lib/supabaseBrowser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));

const form: Parameters<typeof PostedCrisisSheet>[0]["form"] = {
  emergencyContactName: "Site Lead",
  emergencyContactPhone: "555-0100",
  responderAccessInstructions: "Responders enter through Gate 2.",
  responderSiteAddress: "100 Main St, Milwaukee, WI",
  commandPostLocation: "Main jobsite trailer",
  assemblyArea: "North parking lot",
  secondaryAssemblyArea: "South laydown yard",
  evacuationShelterNotes: "Use west stair core.",
  weatherShelterLocation: "West stair core",
  lightningPlan: "Stop work and shelter until 30 minutes after last strike.",
  tornadoPlan: "Shelter in lowest interior area.",
  aedLocation: "Main trailer entry",
  firstAidLocation: "Safety trailer shelf",
  fireExtinguisherLocations: "All trailers and hot-work carts",
  spillKitLocations: "Safety trailer",
  rescueEquipmentLocations: "Safety trailer",
  nearestMedicalName: "River Clinic",
  nearestMedicalAddress: "10 Clinic Dr",
  nearestMedicalPhone: "555-0111",
  nearestMedicalRoute: "Gate 2 to Main St",
  mediaContactName: "Company Spokesperson",
  mediaContactPhone: "555-0120",
  mediaStatementInstructions: "Only authorized spokesperson may speak publicly.",
  regulatoryContactName: "Safety Coordinator",
  regulatoryContactPhone: "555-0130",
  regulatoryReportingInstructions: "Escalate to safety coordinator.",
  callChain: [{ role: "Superintendent", name: "Site Lead", phone: "555-0100", alternateName: "Assistant Lead", alternatePhone: "555-0102", notes: "" }],
  utilityContacts: [{ role: "Electric", name: "Utility Desk", phone: "555-0140", alternateName: "", alternatePhone: "", notes: "" }],
  afterHoursContacts: [{ role: "Safety", name: "On Call Safety", phone: "555-0150", alternateName: "", alternatePhone: "", notes: "" }],
  backupContacts: [{ role: "Superintendent", name: "Site Lead", phone: "555-0100", alternateName: "Assistant Lead", alternatePhone: "555-0102", notes: "" }],
  incidentNotificationTimeline: [{ phase: "Immediate", actions: ["911 if needed", "Superintendent", "Safety coordinator"] }],
  postIncidentRequirements: ["Ensure safety / stop work", "Secure scene"],
  notes: "Keep radios charged",
  revisionDate: "2026-05-26",
};

describe("jobsite emergency action plan client pieces", () => {
  it("renders a posted crisis sheet with command post, call chain, and medical route", () => {
    const html = renderToStaticMarkup(<PostedCrisisSheet form={form} jobsiteName="Hillcrest Office Fit-Out" />);

    expect(html).toContain("Crisis Management Plan");
    expect(html).toContain("Jobsite Crisis Call Responsibility Structure");
    expect(html).toContain("Main jobsite trailer");
    expect(html).toContain("Site Lead");
    expect(html).toContain("River Clinic");
    expect(html).toContain("Utility Shutoff Contacts");
    expect(html).toContain("Post-Incident Requirements");
  });

  it("renders print, defaults, save, and reviewed actions", () => {
    const html = renderToStaticMarkup(
      <PlannerActionBar
        saving={false}
        onApplyDefaults={() => undefined}
        onSave={() => undefined}
        onSaveReviewed={() => undefined}
        onPrint={() => undefined}
      />
    );

    expect(html).toContain("Apply Company Defaults");
    expect(html).toContain("Save");
    expect(html).toContain("Save and Mark Reviewed");
    expect(html).toContain("Print / Save PDF");
  });
});
