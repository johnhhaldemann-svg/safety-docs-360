import { describe, expect, it } from "vitest";
import {
  getSubmitterPreviewStatus,
  isBuyerMarketplacePreviewBlocked,
  isValidMarketplacePreviewPath,
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

describe("isValidMarketplacePreviewPath", () => {
  const id = "a36ee44a-2f23-4fe5-bbdb-0c24c601cb15";

  it("accepts bucket-relative keys under marketplace-preview/{id}/", () => {
    expect(
      isValidMarketplacePreviewPath(
        id,
        `marketplace-preview/${id}/2026-01-01_preview.pdf`
      )
    ).toBe(true);
  });

  it("accepts full Supabase public object URLs", () => {
    expect(
      isValidMarketplacePreviewPath(
        id,
        `https://xyz.supabase.co/storage/v1/object/public/documents/marketplace-preview/${id}/2026-01-01_preview.pdf`
      )
    ).toBe(true);
  });

  it("accepts UUID case mismatch between route id and path", () => {
    const upper = id.toUpperCase();
    expect(
      isValidMarketplacePreviewPath(
        upper,
        `marketplace-preview/${id}/x.pdf`
      )
    ).toBe(true);
  });

  it("rejects other document prefixes", () => {
    expect(
      isValidMarketplacePreviewPath(id, "marketplace-preview/other-id/x.pdf")
    ).toBe(false);
  });
});
