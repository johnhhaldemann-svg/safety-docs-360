import { describe, expect, it } from "vitest";
import {
  applyJurisdictionStandardsToCsep,
  buildJurisdictionProfileSection,
} from "@/lib/jurisdictionStandards/apply";

describe("jurisdiction profile section", () => {
  it("does not merge builderGuidance or federal baseline marketing copy into §5.2 after standards apply", () => {
    const { sections } = applyJurisdictionStandardsToCsep({
      sections: [],
      selections: [],
      profile: {
        governingState: "WI",
        jurisdictionCode: "federal",
        jurisdictionName: "Federal OSHA",
        jurisdictionLabel: "Wisconsin (Federal OSHA)",
        jurisdictionPlanType: "federal_osha",
        coversPrivateSector: true,
        source: "document_override",
      },
      config: undefined,
    });

    const profile = sections.find((s) => s.key === "jurisdiction_profile");
    const body = (profile?.body ?? "").toLowerCase();
    expect(body).toContain("governs this project");
    expect(body).not.toContain("seeded");
    expect(body).not.toContain("draft and review workflow");
    expect(body).not.toContain("peshep");
    expect(body).not.toContain("layered into");
    expect((profile?.bullets ?? []).join(" ").toLowerCase()).not.toContain("seeded");
    expect((profile?.bullets ?? []).join(" ").toLowerCase()).not.toContain("flag the draft");
  });

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
