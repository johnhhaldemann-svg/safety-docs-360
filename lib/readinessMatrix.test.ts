import { describe, expect, it } from "vitest";
import {
  applyAiReviewToReadinessRows,
  applyOperationalSignalsToReadinessRows,
  buildContractorReadinessRow,
  buildEmployeeReadinessRow,
  buildReadinessChart,
  summarizeReadinessRows,
  type ReadinessRequirement,
} from "./readinessMatrix";

const requirements: ReadinessRequirement[] = [
  { id: "r1", title: "Fall Protection", matchKeywords: ["Fall Protection"] },
  { id: "r2", title: "JSA", matchKeywords: ["JSA"] },
];

function employeeRow(overrides: Partial<Parameters<typeof buildEmployeeReadinessRow>[0]["row"]> = {}) {
  return buildEmployeeReadinessRow({
    requirements,
    row: {
      userId: "u1",
      name: "Maria Lee",
      email: "maria@example.com",
      role: "field_supervisor",
      cells: { r1: "match", r2: "match" },
      cellDetails: {
        r1: {
          state: "match",
          matchSource: "certifications",
          matchedLabel: "Fall Protection",
          expiryStatus: "ok",
        },
        r2: {
          state: "match",
          matchSource: "certifications",
          matchedLabel: "JSA",
          expiryStatus: "ok",
        },
      },
      certificationInventory: [],
      profileFields: {
        tradeSpecialty: "Steel",
        jobTitle: "Foreman",
      },
      ...overrides,
    },
  });
}

describe("readiness matrix", () => {
  it("marks an employee ready when all in-scope requirements are met", () => {
    const row = employeeRow();
    expect(row.status).toBe("ready");
    expect(row.readinessScore).toBe(100);
  });

  it("marks employee gaps for missing in-scope requirements", () => {
    const row = employeeRow({
      cells: { r1: "gap", r2: "match" },
      cellDetails: { r1: { state: "gap", gapKeywords: ["Fall Protection"] } },
    });
    expect(row.status).toBe("gap");
    expect(row.gaps[0]?.label).toBe("Fall Protection");
  });

  it("marks employee expiring soon when a matched credential is near expiry", () => {
    const row = employeeRow({
      cellDetails: {
        r1: {
          state: "match",
          matchSource: "certifications",
          matchedLabel: "Fall Protection",
          expiresOn: "2026-05-20",
          daysUntilExpiry: 15,
          expiryStatus: "soon",
        },
      },
    });
    expect(row.status).toBe("expiring_soon");
    expect(row.expiring[0]?.label).toBe("Fall Protection");
  });

  it("marks expired credentials as blockers", () => {
    const row = employeeRow({
      certificationInventory: [
        {
          name: "Fall Protection",
          expiresOn: "2025-01-01",
          daysUntilExpiry: -490,
          expiryStatus: "expired",
        },
      ],
    });
    expect(row.status).toBe("blocked");
    expect(row.blockers[0]?.label).toBe("Fall Protection");
  });

  it("marks incomplete profiles as needing review", () => {
    const row = employeeRow({
      profileFields: {
        tradeSpecialty: "",
        jobTitle: "",
      },
    });
    expect(row.status).toBe("needs_review");
  });

  it("builds contractor readiness from jobsite training records", () => {
    const row = buildContractorReadinessRow({
      assignmentId: "a1",
      employeeId: "ce1",
      name: "Derrick P.",
      email: "derrick@example.com",
      contractorId: "c1",
      contractorName: "Roof Co",
      jobsiteId: "j1",
      jobsiteName: "North Site",
      trade: "Roofing",
      position: "Foreman",
      requirements: [{ id: "cr1", title: "Fall Protection" }],
      records: [{ requirementId: "cr1", title: "Fall Protection", status: "complete" }],
    });
    expect(row.status).toBe("ready");
    expect(row.personType).toBe("contractor");
  });

  it("blocks contractor readiness when induction is missing", () => {
    const row = buildContractorReadinessRow({
      assignmentId: "a1",
      employeeId: "ce1",
      name: "Derrick P.",
      email: "derrick@example.com",
      contractorId: "c1",
      contractorName: "Roof Co",
      jobsiteId: "j1",
      jobsiteName: "North Site",
      trade: "Roofing",
      position: "Foreman",
      requirements: [],
      records: [],
      induction: {
        status: "blocked",
        reasons: ["Induction not completed or expired: Site Orientation"],
        missingProgramIds: ["p1"],
      },
    });
    expect(row.status).toBe("blocked");
    expect(row.blockers[0]?.detail).toContain("Site Orientation");
  });

  it("does not let AI clear deterministic blockers or gaps", () => {
    const blocked = employeeRow({
      certificationInventory: [
        {
          name: "Fall Protection",
          expiresOn: "2025-01-01",
          daysUntilExpiry: -490,
          expiryStatus: "expired",
        },
      ],
    });
    const reviewed = applyAiReviewToReadinessRows([blocked], {
      overallScore: 100,
      summary: "Looks good",
      prioritizedActions: [],
      rowFindings: [{ rowId: blocked.id, status: "ready", score: 100, explanation: "clear" }],
    });
    expect(reviewed[0].status).toBe("blocked");
    expect(reviewed[0].readinessScore).toBeLessThan(100);
  });

  it("summarizes readiness rows", () => {
    const ready = employeeRow();
    const needsReview = employeeRow({
      userId: "u2",
      profileFields: { tradeSpecialty: "", jobTitle: "" },
    });
    expect(summarizeReadinessRows([ready, needsReview])).toMatchObject({
      total: 2,
      ready: 1,
      needsReview: 1,
      employees: 2,
    });
  });

  it("builds a readiness chart from active row issues", () => {
    const gap = employeeRow({
      cells: { r1: "gap", r2: "match" },
      cellDetails: { r1: { state: "gap", gapKeywords: ["Fall Protection"] } },
    });
    const ready = employeeRow({ userId: "u2", name: "Sam R." });

    const chart = buildReadinessChart([gap, ready]);

    expect(chart.columns[0]).toMatchObject({ label: "Fall Protection" });
    expect(chart.rows[0].cells[0]).toMatchObject({ status: "gap", label: "Gap" });
    expect(chart.rows[1].cells[0]).toMatchObject({ status: "met", label: "Met" });
  });

  it("escalates ready jobsite rows when operational signals are present", () => {
    const ready = employeeRow();
    const reviewed = applyOperationalSignalsToReadinessRows(
      [{ ...ready, jobsiteId: "j1", jobsiteName: "Tower" }],
      [
        {
          jobsiteId: "j1",
          signals: [
            {
              type: "incident",
              label: "Recent Serious Incidents",
              detail: "1 recent serious incident signal on this jobsite.",
              jobsiteId: "j1",
              severity: "high",
              count: 1,
            },
          ],
        },
      ]
    );

    expect(reviewed[0].status).toBe("needs_review");
    expect(reviewed[0].reviewItems[0]?.label).toBe("Recent Serious Incidents");
    expect(reviewed[0].source.operationalSignals).toBe(1);
    expect(reviewed[0].readinessScore).toBeLessThan(ready.readinessScore);
  });
});
