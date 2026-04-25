import { describe, expect, it } from "vitest";
import { buildAdoptionChecklist } from "@/components/dashboard/onboardingChecklist";

describe("buildAdoptionChecklist", () => {
  it("marks a new workspace as incomplete and points to the company profile first", () => {
    const summary = buildAdoptionChecklist({
      companyProfile: {
        name: "Acme Safety",
        industry: null,
        phone: null,
        address_line_1: null,
        city: null,
        state_region: null,
        country: null,
      },
      companyUsers: [{ status: "Active" }],
      companyInvites: [],
      jobsites: [],
      documents: [],
      commandCenterViewed: false,
    });

    expect(summary.completedCount).toBe(0);
    expect(summary.totalCount).toBe(5);
    expect(summary.nextItem?.id).toBe("company_profile");
  });

  it("recognizes the first adoption milestones from existing workspace data", () => {
    const summary = buildAdoptionChecklist({
      companyProfile: {
        name: "Acme Safety",
        industry: "Construction",
        phone: "555-0100",
        address_line_1: "100 Main",
        city: "Austin",
        state_region: "TX",
        country: "USA",
      },
      companyUsers: [{ status: "Active" }, { status: "Active" }],
      companyInvites: [],
      jobsites: [{ status: "active" }],
      documents: [{ status: "approved", final_file_path: "final/acme.docx" }],
      commandCenterViewed: true,
    });

    expect(summary.completedCount).toBe(5);
    expect(summary.nextItem).toBeNull();
    expect(summary.items.every((item) => item.complete)).toBe(true);
  });

  it("treats pending invites as team onboarding progress", () => {
    const summary = buildAdoptionChecklist({
      companyInvites: [{ status: "pending" }],
      commandCenterViewed: false,
    });

    expect(summary.items.find((item) => item.id === "team_invites")?.complete).toBe(true);
  });
});
