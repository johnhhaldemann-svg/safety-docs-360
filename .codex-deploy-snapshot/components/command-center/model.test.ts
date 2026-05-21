import { describe, expect, it, vi } from "vitest";
import {
  buildSafetyManagerWorkflowRails,
  buildCommandCenterNotices,
  getRecommendationsEmptyMessage,
  getRiskMemoryEmptyMessage,
  summarizeOpenWork,
} from "@/components/command-center/model";

describe("summarizeOpenWork", () => {
  it("counts open and overdue items across workspace lists", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));

    const summary = summarizeOpenWork({
      observations: [
        { status: "open", due_at: "2026-04-10T00:00:00.000Z" },
        { status: "verified_closed", due_at: "2026-04-10T00:00:00.000Z" },
      ],
      incidents: [{ status: "open" }, { status: "closed" }],
      permits: [{ status: "active", stop_work_status: "stop_work_active" }],
      daps: [{ status: "draft" }, { status: "completed" }],
      reports: [{ status: "draft" }, { status: "published" }],
    });

    expect(summary).toEqual({
      openObservations: 1,
      overdueObservations: 1,
      openIncidents: 1,
      activePermits: 1,
      stopWorkPermits: 1,
      openJsas: 1,
      openReports: 1,
    });

    vi.useRealTimers();
  });
});

describe("command center state helpers", () => {
  it("builds notices in UI order", () => {
    expect(
      buildCommandCenterNotices({
        warning: "rollup delayed",
        analyticsError: "analytics failed",
        workspaceError: "workspace failed",
      })
    ).toEqual([
      { tone: "neutral", message: "rollup delayed" },
      { tone: "error", message: "analytics failed" },
      { tone: "warning", message: "workspace failed" },
    ]);
  });

  it("returns loading and empty copy for Risk Memory and recommendations", () => {
    expect(getRiskMemoryEmptyMessage(true)).toContain("Loading Risk Memory");
    expect(getRiskMemoryEmptyMessage(false)).toContain("not available");
    expect(getRecommendationsEmptyMessage(0)).toContain("No active recommendations yet");
    expect(getRecommendationsEmptyMessage(2)).toBeNull();
  });

  it("builds workflow rails around core safety-manager jobs", () => {
    const rails = buildSafetyManagerWorkflowRails({
      openObservations: 3,
      overdueObservations: 1,
      openIncidents: 2,
      activePermits: 4,
      stopWorkPermits: 1,
      openJsas: 2,
      openReports: 1,
    });

    expect(rails.map((rail) => rail.title)).toEqual([
      "Start a jobsite",
      "Prepare a submission",
      "Verify worker readiness",
      "Resolve a compliance gap",
    ]);
    expect(rails[1]?.href).toBe("/submit");
    expect(rails[2]?.href).toBe("/training-matrix");
    expect(rails[3]).toMatchObject({
      href: "/permits",
      actionLabel: "Review permits",
      tone: "warning",
    });
  });
});
