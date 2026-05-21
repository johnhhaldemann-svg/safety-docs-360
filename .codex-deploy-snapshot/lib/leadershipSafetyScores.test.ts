import { describe, expect, it } from "vitest";
import {
  buildLeadershipSafetyScore,
  canViewLeadershipSafetyScore,
  type LeadershipScoreAssignment,
} from "@/lib/leadershipSafetyScores";

const now = "2026-05-08T12:00:00.000Z";
const windowStart = "2026-04-08T00:00:00.000Z";
const windowEnd = "2026-05-08T23:59:59.999Z";
const assignments: LeadershipScoreAssignment[] = [
  { user_id: "pm-1", jobsite_id: "job-1" },
  { user_id: "fs-1", jobsite_id: "job-1" },
  { user_id: "foreman-1", jobsite_id: "job-1" },
  { user_id: "foreman-2", jobsite_id: "job-2" },
];

function scoreFor(rows: Parameters<typeof buildLeadershipSafetyScore>[0]["rows"]) {
  return buildLeadershipSafetyScore({
    companyId: "company-1",
    leader: { userId: "fs-1", role: "field_supervisor", name: "Field Lead" },
    assignments,
    allJobsiteIds: ["job-1", "job-2"],
    rows,
    windowStart,
    windowEnd,
    now,
  });
}

describe("leadership safety commitment scoring", () => {
  it("attributes injury events on assigned jobs and gives some credit for prompt closure", () => {
    const openInjury = scoreFor({
      incidents: [
        {
          id: "incident-open",
          jobsite_id: "job-1",
          title: "Fall protection incident",
          category: "incident",
          injury_type: "sprain",
          severity: "high",
          recordable: true,
          sif_flag: true,
          status: "open",
        },
      ],
    });
    const closedInjury = scoreFor({
      incidents: [
        {
          id: "incident-closed",
          jobsite_id: "job-1",
          title: "Fall protection incident",
          category: "incident",
          injury_type: "sprain",
          severity: "high",
          recordable: true,
          sif_flag: true,
          status: "closed",
        },
      ],
    });

    expect(openInjury.score).toBeLessThan(82);
    expect(closedInjury.score).toBeGreaterThan(openInjury.score);
    expect(openInjury.negativeSignals[0]?.label).toBe("Assigned job injury exposure");
    expect(openInjury.evidenceRefs.some((ref) => ref.sourceModule === "incidents")).toBe(true);
  });

  it("penalizes overdue permits, stale JSAs, and weak task controls", () => {
    const result = scoreFor({
      permits: [
        {
          id: "permit-1",
          jobsite_id: "job-1",
          title: "Hot work permit",
          status: "open",
          due_at: "2026-05-07T12:00:00.000Z",
          owner_user_id: "",
        },
      ],
      jsas: [
        {
          id: "jsa-1",
          jobsite_id: "job-1",
          title: "Elevated work",
          status: "draft",
          created_at: "2026-05-01T12:00:00.000Z",
          description: "Work high",
        },
      ],
      jsaActivities: [
        {
          id: "activity-1",
          jobsite_id: "job-1",
          task_name: "Use lift",
          mitigation: "Be careful",
          permit_required: true,
          permit_type: "",
        },
      ],
    });

    expect(result.score).toBeLessThan(70);
    expect(result.negativeSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining([
        "Permit follow-through gaps",
        "JSA quality or closure gaps",
        "Task control gaps",
      ])
    );
  });

  it("rewards corrective action follow-through and AI risk recommendations while flagging dismissed high-confidence AI", () => {
    const result = scoreFor({
      correctiveActions: [
        {
          id: "action-1",
          jobsite_id: "job-1",
          title: "Harness audit",
          status: "verified_closed",
          closed_at: "2026-05-07T12:00:00.000Z",
        },
      ],
      recommendations: [
        {
          id: "recommendation-1",
          jobsite_id: "job-1",
          recommended_action: "Review fall protection training records",
          confidence: 0.91,
          dismissed: false,
        },
        {
          id: "recommendation-2",
          jobsite_id: "job-1",
          recommended_action: "Audit harness inspections",
          confidence: 0.88,
          dismissed: true,
        },
      ],
    });

    expect(result.positiveSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining([
        "Corrective action follow-through",
        "AI risk recommendations available",
      ])
    );
    expect(result.negativeSignals.map((signal) => signal.label)).toContain(
      "High-confidence AI recommendations dismissed"
    );
  });

  it("enforces role and assignment visibility for higher leaders", () => {
    expect(
      canViewLeadershipSafetyScore({
        viewerRole: "company_admin",
        viewerUserId: "admin-1",
        targetUserId: "foreman-1",
        targetRole: "foreman",
      })
    ).toBe(true);
    expect(
      canViewLeadershipSafetyScore({
        viewerRole: "safety_manager",
        viewerUserId: "safety-1",
        targetUserId: "foreman-2",
        targetRole: "foreman",
      })
    ).toBe(true);
    expect(
      canViewLeadershipSafetyScore({
        viewerRole: "project_manager",
        viewerUserId: "pm-1",
        targetUserId: "foreman-1",
        targetRole: "foreman",
        viewerJobsiteIds: ["job-1"],
        targetJobsiteIds: ["job-1"],
      })
    ).toBe(true);
    expect(
      canViewLeadershipSafetyScore({
        viewerRole: "project_manager",
        viewerUserId: "pm-1",
        targetUserId: "foreman-2",
        targetRole: "foreman",
        viewerJobsiteIds: ["job-1"],
        targetJobsiteIds: ["job-2"],
      })
    ).toBe(false);
    expect(
      canViewLeadershipSafetyScore({
        viewerRole: "field_supervisor",
        viewerUserId: "fs-1",
        targetUserId: "pm-1",
        targetRole: "project_manager",
        viewerJobsiteIds: ["job-1"],
        targetJobsiteIds: ["job-1"],
      })
    ).toBe(false);
  });
});
