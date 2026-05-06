import { describe, expect, it } from "vitest";
import {
  buildTrainingMatrixActionQueue,
  filterTrainingMatrixActionQueue,
  trainingMatrixActionQueueToCsv,
  type TrainingMatrixQueueRow,
} from "./trainingMatrixActionQueue";

const requirements = [
  { id: "osha", title: "OSHA 10" },
  { id: "cpr", title: "First Aid / CPR" },
  { id: "loto", title: "LOTO Authorized Worker" },
];

function row(overrides: Partial<TrainingMatrixQueueRow>): TrainingMatrixQueueRow {
  return {
    userId: "u1",
    name: "Jordan Lee",
    email: "jordan@example.com",
    cells: {},
    cellDetails: {},
    certificationInventory: [],
    profileFields: {
      tradeSpecialty: "Structural Steel",
      jobTitle: "Foreman",
    },
    ...overrides,
  };
}

describe("buildTrainingMatrixActionQueue", () => {
  it("creates a gap action for a missing in-scope requirement", () => {
    const queue = buildTrainingMatrixActionQueue(
      [
        row({
          cells: { osha: "gap", cpr: "na", loto: "na" },
          cellDetails: {
            osha: { state: "gap", gapKeywords: ["OSHA 10 Construction"] },
            cpr: { state: "na" },
          },
        }),
      ],
      requirements
    );

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      actionType: "gap",
      requirementId: "osha",
      certification: "OSHA 10 Construction",
    });
    expect(queue.map((item) => item.requirementId)).not.toContain("cpr");
  });

  it("creates an expiring action for a matched credential expiring soon", () => {
    const queue = buildTrainingMatrixActionQueue(
      [
        row({
          cells: { cpr: "match" },
          cellDetails: {
            cpr: {
              state: "match",
              matchSource: "certifications",
              matchedLabel: "First Aid / CPR",
              expiresOn: "2026-05-20",
              daysUntilExpiry: 19,
              expiryStatus: "soon",
            },
          },
        }),
      ],
      [{ id: "cpr", title: "First Aid / CPR" }]
    );

    expect(queue).toEqual([
      expect.objectContaining({
        actionType: "expiring_soon",
        requirementId: "cpr",
        certification: "First Aid / CPR",
        daysUntilExpiry: 19,
      }),
    ]);
  });

  it("prioritizes expired credentials above expiring soon credentials", () => {
    const queue = buildTrainingMatrixActionQueue(
      [
        row({
          cells: { cpr: "match" },
          cellDetails: {
            cpr: {
              state: "match",
              matchSource: "certifications",
              matchedLabel: "First Aid / CPR",
              expiresOn: "2026-05-20",
              daysUntilExpiry: 19,
              expiryStatus: "soon",
            },
          },
          certificationInventory: [
            {
              name: "Fall Protection",
              expiresOn: "2025-01-01",
              daysUntilExpiry: -485,
              expiryStatus: "expired",
            },
          ],
        }),
      ],
      [{ id: "cpr", title: "First Aid / CPR" }]
    );

    expect(queue[0]).toMatchObject({
      actionType: "expired",
      certification: "Fall Protection",
    });
    expect(queue[1]).toMatchObject({ actionType: "expiring_soon" });
  });

  it("creates a missing expiry action for matched credentials without a date", () => {
    const queue = buildTrainingMatrixActionQueue(
      [
        row({
          cells: { osha: "match" },
          cellDetails: {
            osha: {
              state: "match",
              matchSource: "certifications",
              matchedLabel: "OSHA 10",
              expiryStatus: "none",
            },
          },
        }),
      ],
      [{ id: "osha", title: "OSHA 10" }]
    );

    expect(queue[0]).toMatchObject({
      actionType: "missing_expiry",
      certification: "OSHA 10",
    });
  });
});

describe("filterTrainingMatrixActionQueue", () => {
  it("filters by action type, trade, requirement, and person search", () => {
    const queue = buildTrainingMatrixActionQueue(
      [
        row({
          userId: "u1",
          name: "Jordan Lee",
          cells: { osha: "gap", cpr: "na", loto: "na" },
          profileFields: { tradeSpecialty: "Structural Steel", jobTitle: "Foreman" },
        }),
        row({
          userId: "u2",
          name: "Maria Chen",
          cells: { osha: "na", cpr: "match", loto: "na" },
          cellDetails: {
            cpr: {
              state: "match",
              matchSource: "certifications",
              matchedLabel: "First Aid / CPR",
              expiresOn: "2026-05-20",
              daysUntilExpiry: 19,
              expiryStatus: "soon",
            },
          },
          profileFields: { tradeSpecialty: "Electrical", jobTitle: "Safety Manager" },
        }),
      ],
      requirements
    );

    expect(filterTrainingMatrixActionQueue(queue, { actionType: "gap" })).toHaveLength(1);
    expect(filterTrainingMatrixActionQueue(queue, { trade: "Electrical" })).toHaveLength(1);
    expect(filterTrainingMatrixActionQueue(queue, { requirementId: "cpr" })).toHaveLength(1);
    expect(filterTrainingMatrixActionQueue(queue, { search: "maria" })).toHaveLength(1);
  });
});

describe("trainingMatrixActionQueueToCsv", () => {
  it("exports queue rows with the coordinator columns", () => {
    const csv = trainingMatrixActionQueueToCsv([
      {
        id: "1",
        userId: "u1",
        person: "Jordan Lee",
        email: "jordan@example.com",
        trade: "Structural Steel",
        position: "Foreman",
        actionType: "gap",
        requirementId: "osha",
        requirementTitle: "OSHA 10",
        certification: "OSHA 10 Construction",
        status: "Missing in-scope requirement",
        expiresOn: null,
        daysUntilExpiry: null,
        suggestedNextStep: "Add matching training, then update profile.",
        priority: 2,
      },
    ]);

    expect(csv.split("\r\n")[0]).toBe(
      "person,email,trade,position,action type,requirement/certification,status,expiration,days until expiry,suggested next step"
    );
    expect(csv).toContain("OSHA 10 / OSHA 10 Construction");
    expect(csv).toContain('"Add matching training, then update profile."');
  });
});
