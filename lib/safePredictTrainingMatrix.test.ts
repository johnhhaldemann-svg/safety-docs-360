import { describe, expect, it } from "vitest";
import {
  buildSafePredictTrainingPeopleRoster,
  buildSafePredictTrainingTradeGroups,
  summarizeSafePredictTrainingRoster,
} from "@/lib/safePredictTrainingMatrix";
import type { SafePredictTrainingMatrix } from "@/lib/safePredictData";

const matrix: SafePredictTrainingMatrix = {
  requirements: [
    {
      id: "fall",
      title: "Fall Protection",
      applyTrades: ["Drywall and Interiors"],
      applyPositions: ["Foreman", "Journeyman"],
    },
    {
      id: "loto",
      title: "LOTO Authorized Worker",
      applyTrades: ["Electrical"],
      applyPositions: ["Foreman"],
    },
  ],
  rows: [
    {
      userId: "drywall-1",
      name: "Avery Drywall",
      email: "avery@example.test",
      role: "field_user",
      profileFields: { tradeSpecialty: "Drywall and Interiors", jobTitle: "Foreman" },
      cells: { fall: "gap", loto: "na" },
      cellDetails: { fall: { state: "gap", gapKeywords: ["Fall Protection"] }, loto: { state: "na" } },
    },
    {
      userId: "drywall-2",
      name: "Blake Board",
      email: "blake@example.test",
      role: "field_user",
      profileFields: { tradeSpecialty: "Drywall and Interiors", jobTitle: "Journeyman" },
      cells: { fall: "match", loto: "na" },
      cellDetails: {
        fall: {
          state: "match",
          matchedLabel: "Fall Protection",
          expiryStatus: "soon",
          expiresOn: "2026-06-01",
        },
        loto: { state: "na" },
      },
    },
    {
      userId: "electrical-1",
      name: "Casey Current",
      email: "casey@example.test",
      role: "field_supervisor",
      profileFields: { tradeSpecialty: "Electrical", jobTitle: "Foreman" },
      cells: { fall: "na", loto: "match" },
      cellDetails: {
        fall: { state: "na" },
        loto: {
          state: "match",
          matchedLabel: "LOTO Authorized Worker",
          expiryStatus: "ok",
        },
      },
    },
    {
      userId: "office-1",
      trackedEmployeeId: "tracked-office-1",
      personType: "tracked_employee",
      name: "Devon Desk",
      email: "",
      role: "visitor",
      profileFields: { tradeSpecialty: "Office Support", jobTitle: "Visitor" },
      cells: { fall: "na", loto: "na" },
      cellDetails: { fall: { state: "na" }, loto: { state: "na" } },
    },
  ],
};

describe("buildSafePredictTrainingTradeGroups", () => {
  it("builds dynamic requirement groups by trade", () => {
    const groups = buildSafePredictTrainingTradeGroups(matrix);

    expect(groups.map((group) => group.trade)).toEqual(["Drywall and Interiors", "Electrical"]);
    expect(groups[0]).toMatchObject({
      workers: 2,
      overdueCount: 1,
      expiringCount: 1,
      compliantCount: 0,
      overallStatus: "Overdue",
    });
    expect(groups[0]?.requirements.map((requirement) => requirement.title)).toEqual(["Fall Protection"]);
  });

  it("excludes not-applicable cells from requirement counts", () => {
    const groups = buildSafePredictTrainingTradeGroups(matrix);
    const drywall = groups.find((group) => group.trade === "Drywall and Interiors");
    const electrical = groups.find((group) => group.trade === "Electrical");

    expect(drywall?.requirements).toHaveLength(1);
    expect(drywall?.requirements[0]).toMatchObject({ workers: 2, overdueCount: 1, expiringCount: 1 });
    expect(electrical?.requirements).toHaveLength(1);
    expect(electrical?.requirements[0]).toMatchObject({ workers: 1, compliantCount: 1 });
  });

  it("lists who needs, has, or is expiring for each requirement", () => {
    const [drywall] = buildSafePredictTrainingTradeGroups(matrix);
    const fallProtection = drywall?.requirements[0];

    expect(fallProtection?.overdueWorkers.map((worker) => worker.name)).toEqual(["Avery Drywall"]);
    expect(fallProtection?.expiringWorkers.map((worker) => worker.name)).toEqual(["Blake Board"]);
    expect(fallProtection?.expiringWorkers[0]?.detail).toContain("2026-06-01");
  });
});

describe("buildSafePredictTrainingPeopleRoster", () => {
  it("includes licensed users and tracked workers even when no requirements apply", () => {
    const people = buildSafePredictTrainingPeopleRoster(matrix);
    const totals = summarizeSafePredictTrainingRoster(people);

    expect(people.map((person) => person.name)).toEqual([
      "Avery Drywall",
      "Blake Board",
      "Casey Current",
      "Devon Desk",
    ]);
    expect(totals).toEqual({
      people: 4,
      licensedUsers: 3,
      trackedWorkers: 1,
      peopleWithGaps: 1,
      peopleExpiring: 1,
    });
    expect(people.find((person) => person.name === "Devon Desk")).toMatchObject({
      email: "No email",
      portalLabel: "Tracked worker / no portal access",
      statusLabel: "Not applicable",
    });
  });
});
