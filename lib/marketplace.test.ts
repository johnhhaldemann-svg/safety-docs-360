import { describe, expect, it } from "vitest";
import {
  getSubmitterPreviewStatus,
  isBuyerMarketplacePreviewBlocked,
} from "./marketplace";

describe("getSubmitterPreviewStatus", () => {
  it("returns undefined when absent or invalid", () => {
    expect(getSubmitterPreviewStatus(null)).toBeUndefined();
    expect(getSubmitterPreviewStatus(undefined)).toBeUndefined();
    expect(getSubmitterPreviewStatus("{}")).toBeUndefined();
    expect(
      getSubmitterPreviewStatus(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "maybe" } })
      )
    ).toBeUndefined();
  });

  it("reads nested marketplace status", () => {
    expect(
      getSubmitterPreviewStatus(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "pending" } })
      )
    ).toBe("pending");
    expect(
      getSubmitterPreviewStatus(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "approved" } })
      )
    ).toBe("approved");
    expect(
      getSubmitterPreviewStatus(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "rejected" } })
      )
    ).toBe("rejected");
  });
});

describe("isBuyerMarketplacePreviewBlocked", () => {
  it("is false for legacy rows without status", () => {
    expect(isBuyerMarketplacePreviewBlocked(null)).toBe(false);
    expect(isBuyerMarketplacePreviewBlocked("{}")).toBe(false);
    expect(
      isBuyerMarketplacePreviewBlocked(
        JSON.stringify({ marketplace: { enabled: true, previewFilePath: "x" } })
      )
    ).toBe(false);
  });

  it("blocks pending and rejected", () => {
    expect(
      isBuyerMarketplacePreviewBlocked(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "pending" } })
      )
    ).toBe(true);
    expect(
      isBuyerMarketplacePreviewBlocked(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "rejected" } })
      )
    ).toBe(true);
  });

  it("does not block approved", () => {
    expect(
      isBuyerMarketplacePreviewBlocked(
        JSON.stringify({ marketplace: { submitterPreviewStatus: "approved" } })
      )
    ).toBe(false);
  });
});
