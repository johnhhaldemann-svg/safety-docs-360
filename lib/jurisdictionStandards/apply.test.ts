import { describe, expect, it } from "vitest";
import { buildJurisdictionProfileSection } from "@/lib/jurisdictionStandards/apply";

describe("jurisdiction profile section", () => {
  it("keeps admin-review wording out of the exported jurisdiction summary", () => {
    const section = buildJurisdictionProfileSection({
      profile: {
        governingState: "WI",
        jurisdictionCode: "federal",
        jurisdictionName: "Federal OSHA",
        jurisdictionLabel: "Wisconsin (Federal OSHA)",
        jurisdictionPlanType: "federal_osha",
        coversPrivateSector: true,
        source: "document_override",
      },
      appliedStandards: [
        {
          id: "federal-baseline",
          title: "Federal OSHA Construction Baseline",
          summary: "Federal OSHA baseline requirements apply.",
          mappings: [],
          content: {
            adminReviewNote:
              "Apply the federal OSHA construction baseline unless the governing state resolves to a seeded state-plan jurisdiction.",
          },
        },
      ] as any,
    });

    expect(section.body).toContain("governs this project");
    expect(section.body).not.toContain("is active for this draft");
    expect(section.body).not.toContain("workspace dataset");
    expect(section.bullets ?? []).toEqual(
      expect.arrayContaining(["Applicable standard: Federal OSHA Construction Baseline."])
    );
    expect((section.bullets ?? []).join(" ")).not.toContain(
      "Apply the federal OSHA construction baseline unless"
    );
  });
});
