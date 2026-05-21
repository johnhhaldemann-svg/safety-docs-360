import { describe, expect, it } from "vitest";
import { evaluateInductionAccess } from "./evaluateAccess";

describe("evaluateInductionAccess", () => {
  const programs = [
    { id: "p1", name: "Site Safety", audience: "worker", active: true },
  ];

  it("eligible when no active requirements apply", () => {
    const r = evaluateInductionAccess({
      jobsiteId: "j1",
      subjectUserId: "u1",
      visitorDisplayName: null,
      programs,
      requirements: [],
      completions: [],
      asOfDate: "2026-01-15",
    });
    expect(r.status).toBe("eligible");
    expect(r.missingProgramIds).toEqual([]);
  });

  it("blocked when requirement exists but no completion", () => {
    const r = evaluateInductionAccess({
      jobsiteId: "j1",
      subjectUserId: "u1",
      visitorDisplayName: null,
      programs,
      requirements: [
        {
          id: "r1",
          program_id: "p1",
          jobsite_id: null,
          active: true,
          effective_from: "2026-01-01",
          effective_to: null,
        },
      ],
      completions: [],
      asOfDate: "2026-01-15",
    });
    expect(r.status).toBe("blocked");
    expect(r.missingProgramIds).toEqual(["p1"]);
  });

  it("eligible with valid completion", () => {
    const r = evaluateInductionAccess({
      jobsiteId: "j1",
      subjectUserId: "u1",
      visitorDisplayName: null,
      programs,
      requirements: [
        {
          id: "r1",
          program_id: "p1",
          jobsite_id: "j1",
          active: true,
          effective_from: "2026-01-01",
          effective_to: null,
        },
      ],
      completions: [
        {
          program_id: "p1",
          jobsite_id: null,
          user_id: "u1",
          visitor_display_name: null,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          completed_at: new Date().toISOString(),
        },
      ],
      asOfDate: "2026-01-15",
    });
    expect(r.status).toBe("eligible");
  });

  it("blocked when completion is expired", () => {
    const r = evaluateInductionAccess({
      jobsiteId: "j1",
      subjectUserId: "u1",
      visitorDisplayName: null,
      programs,
      requirements: [
        {
          id: "r1",
          program_id: "p1",
          jobsite_id: "j1",
          active: true,
          effective_from: "2026-01-01",
          effective_to: null,
        },
      ],
      completions: [
        {
          program_id: "p1",
          jobsite_id: "j1",
          user_id: "u1",
          visitor_display_name: null,
          expires_at: "2020-01-01T00:00:00.000Z",
          completed_at: "2020-01-01T00:00:00.000Z",
        },
      ],
      asOfDate: "2026-01-15",
    });
    expect(r.status).toBe("blocked");
    expect(r.reasons[0]).toContain("expired");
  });

  it("ignores requirements outside effective date window", () => {
    const r = evaluateInductionAccess({
      jobsiteId: "j1",
      subjectUserId: "u1",
      visitorDisplayName: null,
      programs,
      requirements: [
        {
          id: "r1",
          program_id: "p1",
          jobsite_id: null,
          active: true,
          effective_from: "2026-02-01",
          effective_to: null,
        },
      ],
      completions: [],
      asOfDate: "2026-01-15",
    });
    expect(r.status).toBe("eligible");
    expect(r.missingProgramIds).toEqual([]);
  });

  it("evaluates visitor completions case-insensitively", () => {
    const r = evaluateInductionAccess({
      jobsiteId: "j1",
      subjectUserId: null,
      visitorDisplayName: "alex visitor",
      programs,
      requirements: [
        {
          id: "r1",
          program_id: "p1",
          jobsite_id: "j1",
          active: true,
          effective_from: "2026-01-01",
          effective_to: null,
        },
      ],
      completions: [
        {
          program_id: "p1",
          jobsite_id: "j1",
          user_id: null,
          visitor_display_name: "Alex Visitor",
          expires_at: null,
          completed_at: "2026-01-14T00:00:00.000Z",
        },
      ],
      asOfDate: "2026-01-15",
    });
    expect(r.status).toBe("eligible");
  });
});
