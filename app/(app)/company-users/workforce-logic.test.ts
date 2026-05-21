import { describe, expect, it } from "vitest";
import {
  buildWorkforceCommandCenter,
  roleNeedsAssignments,
  trackedEmployeeNeedsJobsiteAssignment,
  trackedEmployeeNeedsTraining,
} from "./workforce-logic";

const baseLoadState = { loading: false, criticalErrors: [], warnings: [] };

describe("workforce command center logic", () => {
  it("marks a quiet workspace healthy", () => {
    const result = buildWorkforceCommandCenter({
      users: [
        {
          id: "admin-1",
          name: "Avery Admin",
          email: "avery@example.com",
          role: "Company Admin",
          status: "Active",
        },
      ],
      invites: [],
      trackedEmployees: [],
      assignmentMap: {},
      activeJobsiteCount: 2,
      dataRequestReviewCount: 0,
      loadState: baseLoadState,
      nowMs: Date.UTC(2026, 4, 18),
    });

    expect(result.readiness).toBe("healthy");
    expect(result.actionItems).toHaveLength(0);
  });

  it("builds action items for approvals, assignment gaps, stale invites, and training gaps", () => {
    const result = buildWorkforceCommandCenter({
      users: [
        {
          id: "pending-1",
          name: "Pending Pat",
          email: "pat@example.com",
          role: "Field User",
          status: "Pending",
        },
        {
          id: "field-1",
          name: "Field Finn",
          email: "finn@example.com",
          role: "Field User",
          status: "Active",
        },
      ],
      invites: [
        {
          id: "invite-1",
          email: "invitee@example.com",
          role: "Company User",
          status: "Pending",
          created_at: "2026-05-01T00:00:00.000Z",
        },
      ],
      trackedEmployees: [
        {
          id: "tracked-1",
          full_name: "Trainee Tess",
          email: "tess@example.com",
          readiness_status: "needs_training",
          status: "active",
          jobsiteAssignments: [{ jobsite_id: "site-1", status: "active" }],
        },
      ],
      assignmentMap: {},
      activeJobsiteCount: 1,
      dataRequestReviewCount: 1,
      loadState: baseLoadState,
      nowMs: Date.UTC(2026, 4, 18),
    });

    expect(result.readiness).toBe("needs_attention");
    expect(result.pendingUsers).toHaveLength(1);
    expect(result.assignmentGaps).toHaveLength(1);
    expect(result.staleInvites).toHaveLength(1);
    expect(result.trainingGaps).toHaveLength(1);
    expect(result.actionItems.map((item) => item.kind)).toEqual([
      "approve",
      "assign_jobsites",
      "copy_invite",
      "resolve_training",
      "review_audit",
    ]);
  });

  it("tracks no-portal worker jobsite assignment gaps separately with friendly labels", () => {
    const result = buildWorkforceCommandCenter({
      users: [],
      invites: [],
      trackedEmployees: [
        {
          id: "tracked-1",
          full_name: "Unassigned Uma",
          email: "uma@example.com",
          readiness_status: "ready",
          status: "active",
          jobsiteAssignments: [],
        },
        {
          id: "tracked-2",
          full_name: "Assigned Ari",
          email: "ari@example.com",
          readiness_status: "ready",
          status: "active",
          jobsiteAssignments: [{ jobsite_id: "site-1", status: "active" }],
        },
      ],
      assignmentMap: {},
      activeJobsiteCount: 1,
      dataRequestReviewCount: 0,
      loadState: baseLoadState,
    });

    expect(result.assignmentGaps).toHaveLength(0);
    expect(result.trackedAssignmentGaps).toHaveLength(1);
    expect(result.actionItems.map((item) => item.kind)).toEqual(["assign_tracked_jobsites"]);
    expect(result.actionItems[0]?.detail).toContain("Tracked worker");
    expect(result.actionItems[0]?.detail).not.toContain("Training-only");
  });

  it("marks critical load failures as blocked", () => {
    const result = buildWorkforceCommandCenter({
      users: [],
      invites: [],
      trackedEmployees: [],
      assignmentMap: {},
      activeJobsiteCount: 0,
      dataRequestReviewCount: 0,
      loadState: {
        loading: false,
        criticalErrors: ["Company workspace is required."],
        warnings: [],
      },
    });

    expect(result.readiness).toBe("blocked");
    expect(result.readinessDetail).toContain("Company workspace");
  });

  it("normalizes field scoped roles and training readiness", () => {
    expect(roleNeedsAssignments("Field User")).toBe(true);
    expect(roleNeedsAssignments("company_admin")).toBe(false);
    expect(trackedEmployeeNeedsTraining({ id: "1", full_name: "Worker", readiness_status: "limited" })).toBe(true);
    expect(trackedEmployeeNeedsTraining({ id: "2", full_name: "Worker", readiness_status: "ready" })).toBe(false);
    expect(trackedEmployeeNeedsJobsiteAssignment({ id: "3", full_name: "Worker", status: "active" })).toBe(true);
    expect(
      trackedEmployeeNeedsJobsiteAssignment({
        id: "4",
        full_name: "Worker",
        status: "active",
        jobsiteAssignments: [{ jobsite_id: "site-1", status: "active" }],
      })
    ).toBe(false);
  });
});
