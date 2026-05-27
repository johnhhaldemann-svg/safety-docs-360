import { describe, expect, it } from "vitest";
import { buildSuperadminHealthCodexPrompt } from "@/lib/superadmin/health/codexPrompt";
import type { SuperadminHealthScore } from "@/lib/superadmin/health/types";

function score(overrides: Partial<SuperadminHealthScore> = {}): SuperadminHealthScore {
  return {
    overallScore: 76,
    categories: {
      systemHealth: {
        score: 82,
        status: "active",
        weight: 20,
        explanation: "System Health uses 3 events; 1 unresolved event affects the score.",
      },
      aiEngine: {
        score: null,
        status: "pending",
        weight: 15,
        explanation: "AI Engine scoring will activate when Phase 3 operation events feed the ledger.",
      },
      predictionValue: {
        score: null,
        status: "pending",
        weight: 15,
        explanation: "Prediction value scoring is reserved for Phase 4 prediction outcomes.",
      },
      dataQuality: {
        score: null,
        status: "insufficient_data",
        weight: 15,
        explanation: "Data Quality has no Phase 1 event data yet.",
      },
      cyberHealth: {
        score: null,
        status: "pending",
        weight: 15,
        explanation: "Cyber Health scoring will activate when Phase 5 cyber alerts feed the ledger.",
      },
      ownerValidation: {
        score: 90,
        status: "active",
        weight: 10,
        explanation: "2 verified owner records, 1 pending, 0 requiring action.",
      },
      helpTickets: {
        score: 70,
        status: "active",
        weight: 10,
        explanation: "2 open tickets affect the score.",
      },
    },
    criticalAlerts: [
      {
        id: "alert-1",
        title: "system_health: database latency",
        severity: "high",
        status: "pending_review",
      },
    ],
    whatChanged: [],
    recommendedActions: ["systemHealth: review unresolved high severity events."],
    ...overrides,
  };
}

describe("buildSuperadminHealthCodexPrompt", () => {
  it("includes current filters, score explanations, and safety instructions", () => {
    const prompt = buildSuperadminHealthCodexPrompt({
      generatedAt: "2026-05-27T18:00:00.000Z",
      filters: {
        tenantId: "tenant-1",
        companyId: "company-1",
        jobsiteId: "",
        severity: "high",
      },
      payload: {
        score: score(),
        events: [
          {
            id: "event-1",
            module: "system_health",
            action: "latency_detected",
            severity: "high",
            event_status: "pending_review",
            object_type: "probe",
            object_id: "db",
          },
        ],
        changes: [],
        owners: [],
        tickets: [
          {
            id: "ticket-1",
            title: "Review database latency",
            severity: "high",
            status: "open",
            source_type: "event_log",
            source_id: "event-1",
          },
        ],
      },
    });

    expect(prompt).toContain("- tenantId: tenant-1");
    expect(prompt).toContain("- companyId: company-1");
    expect(prompt).toContain("- severity: high");
    expect(prompt).toContain("systemHealth (20%): 82/100");
    expect(prompt).toContain("aiEngine (15%): pending");
    expect(prompt).toContain("dataQuality (15%): insufficient_data");
    expect(prompt).toContain("Review and fix only issues supported by this SuperAdmin Health report");
    expect(prompt).toContain("Preserve SuperAdmin RBAC, tenant isolation, and existing dashboard behavior");
    expect(prompt).toContain("Do not create fake production data");
    expect(prompt).toContain("OWNER PROOF REPORT");
    expect(prompt).toContain("Review database latency");
  });

  it("handles empty reports without inventing findings", () => {
    const prompt = buildSuperadminHealthCodexPrompt({
      generatedAt: "2026-05-27T18:00:00.000Z",
      filters: {},
      payload: {
        score: null,
        events: [],
        changes: [],
        owners: [],
        tickets: [],
      },
    });

    expect(prompt).toContain("- No dashboard filters were applied.");
    expect(prompt).toContain("- Overall score: not loaded");
    expect(prompt).toContain("do not infer missing results");
    expect(prompt).toContain("- No rows were loaded for the current filters.");
    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toContain("null");
  });

  it("limits long row lists so clipboard output stays usable", () => {
    const events = Array.from({ length: 12 }, (_, index) => ({
      id: `event-${index + 1}`,
      module: "system_health",
      action: `action-${index + 1}`,
      severity: "medium",
      event_status: "recorded",
      object_type: "probe",
      object_id: `probe-${index + 1}`,
    }));

    const prompt = buildSuperadminHealthCodexPrompt({
      generatedAt: "2026-05-27T18:00:00.000Z",
      filters: { tenantId: "tenant-1" },
      payload: {
        score: score({ criticalAlerts: [] }),
        events,
        changes: [],
        owners: [],
        tickets: [],
      },
    });

    expect(prompt).toContain("action-8");
    expect(prompt).not.toContain("action-9");
    expect(prompt).toContain("4 additional row(s) omitted from this prompt");
  });
});
