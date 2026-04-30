import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAiEngineMetrics } from "@/lib/superadmin/aiEngineOperations";

class Query {
  constructor(private rows: unknown[]) {}
  select() {
    return this;
  }
  insert() {
    return this;
  }
  single() {
    return Promise.resolve({ data: null, error: null, count: 0 });
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

    for (const sql of [callLogMigration, feedbackMigration]) {
      expect(sql).toContain("revoke all");
      expect(sql).toContain("from authenticated");
      expect(sql).toContain("from anon");
      expect(sql).toContain("using (false)");
    }
  });
});
