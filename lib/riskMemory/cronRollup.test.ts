import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => null,
}));

describe("runRiskMemoryCronJob", () => {
  it("fails fast when admin client cannot be created", async () => {
    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const r = await runRiskMemoryCronJob({});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/service role/i);
    expect(r.snapshotUpserts).toBe(0);
  });
});
