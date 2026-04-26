import { describe, expect, it } from "vitest";
import {
  buildSteelErectionOverlaySections,
  buildSteelErectionPlan,
  filterSteelCommonOverlappingBullets,
} from "@/lib/steelErectionPlan";

describe("steelErectionPlan", () => {
  it("filterSteelCommonOverlappingBullets removes trade labels that duplicate steel interface subsections", () => {
    expect(
      filterSteelCommonOverlappingBullets([
        "Fire Protection",
        "General Conditions / Site Management",
        "HVAC / Mechanical",
        "Painting / Coatings",
        "Welding / Hot Work",
        "Facade access coordination",
      ])
    ).toEqual(["Facade access coordination"]);
  });

  it("uses a final-export-safe fallback for emergency access instructions when the project address is blank", () => {
    const plan = buildSteelErectionPlan({
      generationContext: {
        project: {
          projectAddress: "",
        },
        legacyFormData: {},
        siteContext: {
          metadata: {},
        },
        scope: {
          trades: ["Structural Steel"],
          subTrades: ["Metals"],
          tasks: ["Column erection"],
        },
      } as any,
      operations: [
        {
          tradeLabel: "Structural Steel",
          subTradeLabel: "Metals",
          taskTitle: "Column erection",
        },
      ] as any,
      ruleSummary: {
        selectedHazards: [],
        hazardCategories: [],
        permitTriggers: [],
        ppeRequirements: [],
        requiredControls: [],
      } as any,
    });

    expect(plan?.fallRescue?.siteAccessInstructions).toBe(
      "Emergency access route: Coordinate responders through the designated project gate and active work area."
    );
    expect(plan?.fallRescue?.siteAccessInstructions).not.toContain("TBD by contractor before issue");
  });

  it("emits fall rescue as 5.1–5.4 subsections with notifications, methods, equipment, and PPE separated", () => {
    const plan = buildSteelErectionPlan({
      generationContext: {
        project: { projectAddress: "100 Main" },
        legacyFormData: {},
        siteContext: { metadata: {} },
        scope: {
          trades: ["Structural Steel"],
          subTrades: ["Metals"],
          tasks: ["Column erection"],
        },
      } as any,
      operations: [
        {
          tradeLabel: "Structural Steel",
          subTradeLabel: "Metals",
          taskTitle: "Column erection",
        },
      ] as any,
      ruleSummary: {
        selectedHazards: [],
        hazardCategories: [],
        permitTriggers: [],
        ppeRequirements: [],
        requiredControls: [],
      } as any,
    });
    expect(plan?.fallRescue).toBeTruthy();
    const sections = buildSteelErectionOverlaySections(plan!);
    const rescue = sections.find((s) => s.key === "emergency_procedures");
    expect(rescue?.subsections?.map((sub) => sub.title)).toEqual([
      "5.1 Emergency Notifications and Immediate Response",
      "5.2 Rescue Methods",
      "5.3 Rescue Equipment",
      "5.4 Required Personal Protective Equipment",
    ]);
    expect(rescue?.body).toMatch(/fall.at.height|fall arrest|911|5\.1/i);
    expect(rescue?.subsections?.[0]?.body).toMatch(/Call 911|911/);
    expect(rescue?.subsections?.[0]?.body).toMatch(/Superintendent|notify/i);
    expect(rescue?.subsections?.[1]?.bullets?.length).toBeGreaterThan(0);
    expect(rescue?.subsections?.[2]?.bullets?.join(" ")).toMatch(/Rescue kit|ladder|radio/i);
    expect(rescue?.subsections?.[3]?.bullets?.length).toBeGreaterThan(0);
  });
});
