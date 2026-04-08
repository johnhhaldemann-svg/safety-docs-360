import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { downloadDocumentsBucketObject } from "./supabaseStorageServer";

afterEach(() => {
  vi.clearAllMocks();
});

describe("downloadDocumentsBucketObject", () => {
  it("returns a 503 when the storage client throws", async () => {
    const download = vi.fn().mockRejectedValue(new Error("storage offline"));
    const from = vi.fn().mockReturnValue({ download });
    mocks.createSupabaseAdminClient.mockReturnValue({
      storage: { from },
    });

    const result = await downloadDocumentsBucketObject("documents/preview/file.pdf");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected a download failure.");
    }

    expect(result.status).toBe(503);
    expect(result.error).toContain("storage offline");
    expect(from).toHaveBeenCalledWith("documents");
    expect(download).toHaveBeenCalledTimes(1);
  });
});
