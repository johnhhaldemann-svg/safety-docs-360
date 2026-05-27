import { describe, expect, it } from "vitest";
import { computeSuperadminHealthScoreFromRows } from "@/lib/superadmin/health/score";

describe("computeSuperadminHealthScoreFromRows", () => {
  it("calculates only from active categories and explains pending modules", () => {
    const score = computeSuperadminHealthScoreFromRows({
      events: [],
      changes: [],
      owners: [
        {
          id: "owner-1",
          validation_status: "verified",
          authority_level: "standard",
        },
      ],
      tickets: [],
    });

    expect(score.overallScore).toBe(100);
    expect(score.categories.ownerValidation).toMatchObject({
      score: 100,
      status: "active",
      weight: 10,
    });
    expect(score.categories.helpTickets).toMatchObject({
      score: 100,
      status: "active",
      weight: 10,
    });
    expect(score.categories.aiEngine.status).toBe("pending");
    expect(score.categories.predictionValue.status).toBe("pending");
    expect(score.categories.systemHealth.status).toBe("insufficient_data");
  });

  it("penalizes critical open tickets and unresolved critical events", () => {
    const score = computeSuperadminHealthScoreFromRows({
      events: [
        {
          id: "event-1",
          module: "system_health",
          action: "probe_failed",
          severity: "critical",
          event_status: "pending_review",
        },
      ],
      changes: [],
      owners: [
        {
          id: "owner-1",
          validation_status: "pending_verification",
        },
      ],
      tickets: [
        {
          id: "ticket-1",
          status: "open",
          severity: "critical",
          title: "Critical ticket",
        },
      ],
    });

    expect(score.categories.systemHealth.score).toBe(60);
    expect(score.categories.ownerValidation.score).toBe(90);
    expect(score.categories.helpTickets.score).toBe(65);
    expect(score.criticalAlerts).toHaveLength(2);
    expect(score.overallScore).toBeLessThan(100);
  });
});
