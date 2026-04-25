import { describe, expect, it, vi } from "vitest";
import {
  loadCompanyRiskScoreTrend,
  summarizeTrendDelta,
  upsertCompanyRiskScoreFromContext,
  type CompanyRiskScorePoint,
} from "@/lib/riskMemory/scoresRepo";

const sampleCtx = {
  engine: "Safety360 Risk Memory Engine" as const,
  windowDays: 90,
  facetCount: 12,
  topScopes: [
    { code: "roofing", count: 4 },
    { code: "excavation_trenching", count: 3 },
  ],
  topHazards: [
    { code: "fall_to_lower_level", count: 5 },
    { code: "struck_by", count: 2 },
  ],
  topLocationGrids: [],
  topLocationAreas: [],
  openCorrectiveFacetHints: { openStyleStatuses: 6 },
  aggregated: { score: 8.4, band: "moderate" as const, sampleSize: 12, baselineContribution: 2 },
  baselineHints: [{ scope_code: "roofing", hazard_code: "fall_to_lower_level", signals: {} }],
  aggregatedWithBaseline: { score: 10.5, band: "high" as const },
  derivedRollupConfidence: 0.62,
};

function makeUpsertSpy() {
  const upsertCalls: Array<{ row: unknown; opts: unknown }> = [];
  const admin = {
    from(_table: string) {
      return {
        upsert(row: unknown, opts: unknown) {
          upsertCalls.push({ row, opts });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  } as unknown as Parameters<typeof upsertCompanyRiskScoreFromContext>[0]["admin"];
  return { admin, upsertCalls };
}

describe("upsertCompanyRiskScoreFromContext", () => {
  it("writes a company-scope row with score, band, components, and trend hints", async () => {
    const { admin, upsertCalls } = makeUpsertSpy();
    const res = await upsertCompanyRiskScoreFromContext({
      admin,
      companyId: "company-1",
      ctx: sampleCtx,
      scoreDate: "2026-04-25",
    });

    expect(res.ok).toBe(true);
    expect(upsertCalls).toHaveLength(1);
    const row = upsertCalls[0].row as Record<string, unknown>;
    expect(row.company_id).toBe("company-1");
    expect(row.score_scope).toBe("company");
    expect(row.score_date).toBe("2026-04-25");
    expect(row.score).toBe(10.5);
    expect(row.band).toBe("high");
    expect(row.score_window_days).toBe(90);
    expect(row.jobsite_id).toBeNull();
    expect(row.bucket_run_id).toBeNull();
    expect(row.bucket_item_id).toBeNull();

    const components = row.components as Record<string, unknown>;
    expect(components.facetCount).toBe(12);
    expect(components.baselineMatchCount).toBe(1);
    expect(components.derivedRollupConfidence).toBe(0.62);
    expect(components.topScopeCodes).toEqual(["roofing", "excavation_trenching"]);
    expect(components.topHazardCodes).toEqual(["fall_to_lower_level", "struck_by"]);

    const trend = row.trend_hints as Record<string, unknown>;
    expect(trend.score).toBe(10.5);
    expect(trend.band).toBe("high");
    expect(trend.sampleSize).toBe(12);

    const opts = upsertCalls[0].opts as Record<string, unknown>;
    expect(opts.onConflict).toBe("company_id,score_date");
  });

  it("returns ok=false when the upsert errors", async () => {
    const admin = {
      from() {
        return {
          upsert: () => Promise.resolve({ data: null, error: { message: "boom" } }),
        };
      },
    } as unknown as Parameters<typeof upsertCompanyRiskScoreFromContext>[0]["admin"];

    const res = await upsertCompanyRiskScoreFromContext({
      admin,
      companyId: "company-1",
      ctx: sampleCtx,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("boom");
  });
});

describe("loadCompanyRiskScoreTrend", () => {
  function makeReader(data: unknown, error: unknown = null) {
    return {
      from() {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          is: vi.fn(() => builder),
          gte: vi.fn(() => builder),
          order: vi.fn(() => Promise.resolve({ data, error })),
        };
        return builder;
      },
    } as unknown as Parameters<typeof loadCompanyRiskScoreTrend>[0]["supabase"];
  }

  it("maps rows into chronological trend points", async () => {
    const supabase = makeReader([
      { score_date: "2026-04-23", score: "5.0", band: "moderate", score_window_days: 90, components: {}, trend_hints: {} },
      { score_date: "2026-04-24", score: 6.5, band: "moderate", score_window_days: 90, components: {}, trend_hints: {} },
      { score_date: "2026-04-25", score: 10.5, band: "high", score_window_days: 90, components: {}, trend_hints: {} },
    ]);

    const points = await loadCompanyRiskScoreTrend({ supabase, companyId: "company-1", days: 30 });
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ scoreDate: "2026-04-23", score: 5, band: "moderate" });
    expect(points[2]).toMatchObject({ scoreDate: "2026-04-25", score: 10.5, band: "high" });
  });

  it("returns [] when the table is missing", async () => {
    const supabase = makeReader(null, { message: "relation \"public.company_risk_scores\" does not exist" });
    const points = await loadCompanyRiskScoreTrend({ supabase, companyId: "company-1", days: 30 });
    expect(points).toEqual([]);
  });
});

describe("summarizeTrendDelta", () => {
  const point = (date: string, score: number, band: CompanyRiskScorePoint["band"] = "moderate"): CompanyRiskScorePoint => ({
    scoreDate: date,
    score,
    band,
    windowDays: 90,
    components: {},
    trendHints: {},
  });

  it("returns nulls for empty arrays", () => {
    expect(summarizeTrendDelta([])).toEqual({
      latest: null,
      earliest: null,
      deltaScore: null,
      direction: null,
    });
  });

  it("returns null delta for a single point", () => {
    const r = summarizeTrendDelta([point("2026-04-25", 5)]);
    expect(r.deltaScore).toBeNull();
    expect(r.direction).toBeNull();
    expect(r.latest?.score).toBe(5);
  });

  it("computes positive delta as 'up'", () => {
    const r = summarizeTrendDelta([point("2026-04-23", 5), point("2026-04-25", 8)]);
    expect(r.deltaScore).toBe(3);
    expect(r.direction).toBe("up");
  });

  it("computes negative delta as 'down'", () => {
    const r = summarizeTrendDelta([point("2026-04-23", 8), point("2026-04-25", 5)]);
    expect(r.deltaScore).toBe(-3);
    expect(r.direction).toBe("down");
  });

  it("treats sub-0.05 changes as 'flat'", () => {
    const r = summarizeTrendDelta([point("2026-04-23", 5), point("2026-04-25", 5.02)]);
    expect(r.direction).toBe("flat");
  });
});
