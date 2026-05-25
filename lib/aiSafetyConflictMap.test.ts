import { describe, expect, it } from "vitest";
import { buildAiSafetyConflictMap } from "@/lib/aiSafetyConflictMap";
import { buildPredictiveSafetyEngineBriefing } from "@/lib/predictiveSafetyEngine";

const NOW = new Date("2026-05-22T12:00:00.000Z");

function briefing(overrides: Partial<Parameters<typeof buildPredictiveSafetyEngineBriefing>[0]> = {}) {
  return buildPredictiveSafetyEngineBriefing({
    days: 7,
    now: NOW,
    jobsites: [{ id: "j1", name: "North Tower", location: "Austin", status: "active" }],
    correctiveActions: [],
    incidents: [],
    permits: [],
    jsaActivities: [],
    scheduleItems: [],
    observations: [],
    trainingGaps: [],
    weatherAlerts: [],
    memoryItems: [],
    ...overrides,
  });
}

describe("buildAiSafetyConflictMap", () => {
  it("detects hot work near combustible material staging", () => {
    const dailyBriefing = briefing({
      scheduleItems: [
        {
          id: "hot-work",
          jobsite_id: "j1",
          title: "Hot work grinding west stair",
          work_start_date: "2026-05-22",
          work_area: "Level 2",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "flammable",
          jobsite_id: "j1",
          title: "Paint and solvent storage setup",
          work_start_date: "2026-05-22",
          work_area: "Level 2",
          risk_level: "moderate",
          is_high_risk: true,
        },
      ],
    });

    const map = buildAiSafetyConflictMap({ dailyBriefing, now: NOW });

    expect(map.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "adjacent_work_conflict",
          title: "Hot work overlaps combustible or flammable exposure",
          humanApprovalRequired: true,
        }),
      ]),
    );
  });

  it("flags elevated work over active equipment or access routes", () => {
    const dailyBriefing = briefing({
      scheduleItems: [
        {
          id: "roof",
          jobsite_id: "j1",
          title: "Roof leading edge layout",
          work_start_date: "2026-05-22",
          work_area: "North elevation",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "access",
          jobsite_id: "j1",
          title: "Active access route below roof work",
          work_start_date: "2026-05-22",
          work_area: "North elevation",
          risk_level: "moderate",
          is_high_risk: true,
        },
      ],
    });

    const map = buildAiSafetyConflictMap({ dailyBriefing, now: NOW });

    expect(map.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Elevated work overlaps active access below",
          requiredVerification: expect.stringContaining("dropped-object controls"),
        }),
      ]),
    );
  });

  it("ties weather alerts to excavation and electrical work with missing threshold notes", () => {
    const weatherAlerts = [
      {
        id: "weather-1",
        jobsite_id: "j1",
        event_name: "Heavy Rain Warning",
        headline: "Heavy rain and lightning expected",
        severity: "severe",
      },
    ];
    const dailyBriefing = briefing({
      scheduleItems: [
        {
          id: "trench",
          jobsite_id: "j1",
          title: "Trench excavation near temporary power",
          work_start_date: "2026-05-22",
          work_area: "South yard",
          risk_level: "critical",
          is_high_risk: true,
        },
      ],
      weatherAlerts,
    });

    const map = buildAiSafetyConflictMap({ dailyBriefing, weatherAlerts, now: NOW });

    expect(map.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "weather_task_conflict",
          riskLevel: "critical",
          recommendedAction: expect.stringContaining("weather alert"),
        }),
      ]),
    );
  });

  it("uses repeated incidents, observations, and corrective actions as conflict evidence", () => {
    const dailyBriefing = briefing({
      scheduleItems: [
        {
          id: "lift",
          jobsite_id: "j1",
          title: "Aerial lift work near loading dock",
          work_start_date: "2026-05-22",
          trade: "Electrical",
          risk_level: "high",
          is_high_risk: true,
        },
      ],
    });

    const map = buildAiSafetyConflictMap({
      dailyBriefing,
      incidents: [{ id: "i1", title: "Aerial lift near miss", category: "lift", severity: "high", jobsite_id: "j1" }],
      observations: [
        { id: "o1", description: "Aerial lift spotter missing", category: "lift", severity: "high", jobsite_id: "j1" },
      ],
      correctiveActions: [{ id: "c1", title: "Aerial lift barricade missing", category: "lift", priority: "high", jobsite_id: "j1" }],
      now: NOW,
    });

    expect(map.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "repeated_pattern_conflict",
          title: expect.stringContaining("Repeated hazard history"),
          confidence: "high",
        }),
      ]),
    );
  });

  it("keeps sparse area and crew data visible as lower-confidence missing information", () => {
    const dailyBriefing = briefing({
      scheduleItems: [
        {
          id: "equipment",
          jobsite_id: "j1",
          title: "Forklift equipment movement",
          work_start_date: "2026-05-22",
          risk_level: "high",
          is_high_risk: true,
        },
        {
          id: "pedestrian",
          jobsite_id: "j1",
          title: "Pedestrian access route setup",
          work_start_date: "2026-05-22",
          risk_level: "moderate",
          is_high_risk: true,
        },
      ],
    });

    const map = buildAiSafetyConflictMap({ dailyBriefing, now: NOW });
    const conflict = map.findings.find((item) => item.title === "Equipment movement overlaps pedestrian or shared-access work");

    expect(conflict).toEqual(
      expect.objectContaining({
        confidence: "low",
        missingInformation: expect.arrayContaining(["exact work area overlap"]),
      }),
    );
  });
});
