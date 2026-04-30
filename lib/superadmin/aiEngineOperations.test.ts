import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAiEngineRecommendationCandidates,
  getAiEngineMetrics,
  sanitizeAiFeedbackSignalMetadata,
} from "@/lib/superadmin/aiEngineOperations";

class Query {
  constructor(private rows: unknown[]) {}
  select() {
    return this;
  }
  insert() {
    return this;
  }
  upsert() {
    return this;
  }
  single() {
    return Promise.resolve({ data: null, error: null, count: 0 });
  }
  eq() {
    return this;
  }
  gte() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  ilike() {
    return this;
  }
  then<TResult1 = { data: unknown[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const value = { data: this.rows, error: null, count: this.rows.length };
    return Promise.resolve(onfulfilled ? onfulfilled(value) : (value as TResult1));
  }
}

describe("AI Engine Operations", () => {
  it("aggregates sanitized call log metrics by surface, provider, and model", async () => {
    const client = {
      from: () =>
        new Query([
          {
            id: 1,
            created_at: new Date().toISOString(),
            surface: "safety-intelligence.intake",
            model: "gpt-test",
            provider: "openai",
            latency_ms: 100,
            status: "ok",
            fallback_used: false,
            total_tokens: 40,
          },
          {
            id: 2,
            created_at: new Date().toISOString(),
            surface: "safety-intelligence.intake",
            model: "gpt-test",
            provider: "openai",
            latency_ms: 300,
            status: "fallback",
            fallback_used: true,
            fallback_reason: "no_api_key",
            total_tokens: 0,
          },
        ]),
    };

    const metrics = await getAiEngineMetrics(client, { surface: "safety-intelligence" });

    expect(metrics.summary.totalCalls).toBe(2);
    expect(metrics.summary.fallbackCalls).toBe(1);
    expect(metrics.summary.averageLatencyMs).toBe(200);
    expect(metrics.bySurface[0]).toMatchObject({
      key: "safety-intelligence.intake",
      calls: 2,
      fallbacks: 1,
      tokens: 40,
    });
    expect(metrics.byProvider[0]?.key).toBe("openai");
    expect(metrics.byModel[0]?.key).toBe("gpt-test");
  });

  it("keeps AI telemetry and feedback tables unavailable to anon and authenticated roles", () => {
    const root = join(import.meta.dirname, "..", "..");
    const callLogMigration = readFileSync(
      join(root, "supabase", "migrations", "20260425130000_ai_call_log.sql"),
      "utf8"
    );
    const feedbackMigration = readFileSync(
      join(root, "supabase", "migrations", "20260430123000_ai_output_feedback.sql"),
      "utf8"
    );
    const recommendationMigration = readFileSync(
      join(root, "supabase", "migrations", "20260430160000_ai_engine_recommendation_snapshots.sql"),
      "utf8"
    );
    const feedbackMetadataMigration = readFileSync(
      join(root, "supabase", "migrations", "20260430170000_ai_feedback_signal_metadata.sql"),
      "utf8"
    );

    for (const sql of [callLogMigration, feedbackMigration, recommendationMigration]) {
      expect(sql).toContain("revoke all");
      expect(sql).toContain("from authenticated");
      expect(sql).toContain("from anon");
      expect(sql).toContain("using (false)");
    }
    expect(feedbackMetadataMigration).toContain("signal_metadata jsonb");
  });

  it("sanitizes learning-loop metadata without retaining raw text fields", () => {
    expect(
      sanitizeAiFeedbackSignalMetadata({
        editDistanceRatio: 1.8,
        regeneratedCount: 3.4,
        usedInField: true,
        workflowStep: "permit_copilot_suggestion",
        documentType: "hot_work",
        reasonCode: "missing_controls",
        fallbackUsed: false,
        prompt: "drop",
        generatedText: "drop",
        rawOutput: "drop",
      })
    ).toEqual({
      editDistanceRatio: 1,
      regeneratedCount: 3,
      usedInField: true,
      workflowStep: "permit_copilot_suggestion",
      documentType: "hot_work",
      reasonCode: "missing_controls",
      fallbackUsed: false,
    });
  });

  it("recommends action for fallback spikes, provider failures, and slow latency", () => {
    const recommendations = buildAiEngineRecommendationCandidates({
      surface: "safety-intelligence",
      metrics: {
        unavailable: false,
        unavailableReason: null,
        summary: {
          totalCalls: 20,
          fallbackCalls: 8,
          fallbackRate: 0.4,
          failedCalls: 3,
          failureRate: 0.15,
          totalTokens: 120000,
          averageLatencyMs: 9000,
        },
        bySurface: [{ key: "safety-intelligence.intake", calls: 20, fallbacks: 8, failures: 3, tokens: 120000 }],
        byModel: [{ key: "gpt-test", calls: 20, fallbacks: 8, failures: 3, tokens: 120000 }],
        byProvider: [{ key: "openai", calls: 20, fallbacks: 8, failures: 3, tokens: 120000 }],
      } as never,
      calls: {
        unavailable: false,
        reason: null,
        count: 2,
        rows: [
          { provider: "openai", model: "gpt-test", status: "http_error" },
          { provider: null, model: null, status: "fallback" },
        ],
      } as never,
      feedback: { unavailable: false, reason: null, count: 0, rows: [] } as never,
      evals: {
        totalFixtures: 0,
        surfaces: [{ surface: "safety-intelligence", fixtures: 0, status: "missing" }],
      } as never,
    });

    expect(recommendations.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Fallback rate is critically high",
        "AI provider failures are above release threshold",
        "Average AI latency is slow",
        "Some AI calls are missing model or provider metadata",
        "Active AI surface is missing eval coverage",
        "Token usage is high",
      ])
    );
  });

  it("recommends feedback review when edited rejected regenerated outcomes are high", () => {
    const recommendations = buildAiEngineRecommendationCandidates({
      surface: "permit-copilot",
      metrics: {
        unavailable: false,
        unavailableReason: null,
        summary: {
          totalCalls: 5,
          fallbackCalls: 0,
          fallbackRate: 0,
          failedCalls: 0,
          failureRate: 0,
          totalTokens: 1000,
          averageLatencyMs: 1000,
        },
        bySurface: [{ key: "permit-copilot", calls: 5, fallbacks: 0, failures: 0, tokens: 1000 }],
        byModel: [],
        byProvider: [],
      } as never,
      calls: { unavailable: false, reason: null, count: 0, rows: [] } as never,
      feedback: {
        unavailable: false,
        reason: null,
        count: 4,
        rows: [
          { outcome: "edited" },
          { outcome: "rejected" },
          { outcome: "accepted" },
          { outcome: "regenerated" },
        ],
      } as never,
      evals: {
        totalFixtures: 1,
        surfaces: [{ surface: "permit-copilot", fixtures: 1, status: "covered" }],
      } as never,
    });

    expect(recommendations.map((item) => item.title)).toContain(
      "User feedback shows elevated revision pressure"
    );
  });

  it("returns healthy empty recommendations when signals are below thresholds", () => {
    const recommendations = buildAiEngineRecommendationCandidates({
      surface: "company-memory",
      metrics: {
        unavailable: false,
        unavailableReason: null,
        summary: {
          totalCalls: 6,
          fallbackCalls: 0,
          fallbackRate: 0,
          failedCalls: 0,
          failureRate: 0,
          totalTokens: 2000,
          averageLatencyMs: 700,
        },
        bySurface: [{ key: "company-memory.assist", calls: 6, fallbacks: 0, failures: 0, tokens: 2000 }],
        byModel: [{ key: "gpt-test", calls: 6, fallbacks: 0, failures: 0, tokens: 2000 }],
        byProvider: [{ key: "openai", calls: 6, fallbacks: 0, failures: 0, tokens: 2000 }],
      } as never,
      calls: {
        unavailable: false,
        reason: null,
        count: 1,
        rows: [{ provider: "openai", model: "gpt-test", status: "ok" }],
      } as never,
      feedback: { unavailable: false, reason: null, count: 0, rows: [] } as never,
      evals: {
        totalFixtures: 1,
        surfaces: [{ surface: "company-memory", fixtures: 1, status: "covered" }],
      } as never,
    });

    expect(recommendations).toEqual([]);
  });
});
