import { describe, expect, it } from "vitest";
import {
  isFailedSiteVisualJobStatus,
  isFinishedSiteVisualJobStatus,
  mergeSiteVisualZoneSavePayload,
  nextSelectedSiteVisualZoneId,
  siteVisualPollTimeoutMessage,
} from "@/lib/jobsiteSiteVisualClientState";

describe("jobsite site visual client state helpers", () => {
  it("keeps an existing selected zone when it is still present", () => {
    expect(
      nextSelectedSiteVisualZoneId("zone-2", [{ id: "zone-1" }, { id: "zone-2" }])
    ).toBe("zone-2");
  });

  it("selects the first zone when nothing valid is selected", () => {
    expect(nextSelectedSiteVisualZoneId(null, [{ id: "zone-1" }])).toBe("zone-1");
    expect(nextSelectedSiteVisualZoneId("missing", [{ id: "zone-1" }])).toBe("zone-1");
    expect(nextSelectedSiteVisualZoneId("missing", [])).toBeNull();
  });

  it("recognizes final and failed queued-job statuses", () => {
    expect(isFinishedSiteVisualJobStatus("ready")).toBe(true);
    expect(isFinishedSiteVisualJobStatus("fallback_ready")).toBe(true);
    expect(isFinishedSiteVisualJobStatus("running")).toBe(false);
    expect(isFailedSiteVisualJobStatus("failed")).toBe(true);
    expect(isFailedSiteVisualJobStatus("queued")).toBe(false);
  });

  it("surfaces a refreshable timeout message", () => {
    expect(siteVisualPollTimeoutMessage("detailed visual")).toContain("still processing");
    expect(siteVisualPollTimeoutMessage("detailed visual")).toContain("Refresh this page");
  });

  it("merges saved zones and clears stale detailed renders", () => {
    const current = {
      scene: {
        version: 1,
        zones: [{ id: "zone-1", label: "Old" }],
      },
      zones: [{ id: "zone-1", label: "Old" }],
      render: { id: "render-1" },
    };
    const next = mergeSiteVisualZoneSavePayload(current, {
      zones: [{ id: "zone-1", label: "Updated" }],
    });

    expect(next.scene?.zones).toEqual([{ id: "zone-1", label: "Updated" }]);
    expect(next.zones).toEqual([{ id: "zone-1", label: "Updated" }]);
    expect(next.render).toBeNull();
  });
});
