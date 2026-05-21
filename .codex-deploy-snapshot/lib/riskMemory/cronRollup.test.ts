import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeSupabaseRecorded = {
  inserts: Record<string, unknown[]>;
  upserts: Record<string, unknown[]>;
};

function makeFakeAdminClient(opts?: {
  companies?: { id: string }[];
  existingTitlesByCompany?: Record<string, string[]>;
}) {
  const companies = opts?.companies ?? [{ id: "company-A" }, { id: "company-B" }];
  const existingTitles = opts?.existingTitlesByCompany ?? {};
  const recorded: FakeSupabaseRecorded = { inserts: {}, upserts: {} };

  function table(name: string) {
    let _company: string | null = null;
    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        if (name === "companies") {
          return Promise.resolve({ data: companies, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      eq(_col: string, value: string) {
        if (_col === "company_id") {
          _company = value;
        }
        return builder;
      },
      gte() {
        if (name === "company_risk_ai_recommendations") {
          const titles = (_company && existingTitles[_company]) || [];
          return Promise.resolve({
            data: titles.map((t) => ({ title: t })),
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: null, error: null });
      },
      upsert(row: unknown) {
        recorded.upserts[name] ??= [];
        recorded.upserts[name].push(row);
        return Promise.resolve({ data: null, error: null });
      },
      insert(rows: unknown) {
        recorded.inserts[name] ??= [];
        recorded.inserts[name].push(...(Array.isArray(rows) ? rows : [rows]));
        return Promise.resolve({ data: null, error: null });
      },
    };
    return builder;
  }

  return {
    client: { from: (name: string) => table(name) },
    recorded,
  };
}

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  buildRiskMemoryStructuredContext: vi.fn(),
  buildLlmRiskRecommendations: vi.fn(),
  companyHasCsepPlanName: vi.fn(),
  buildRuleBasedRiskRecommendations: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));
vi.mock("@/lib/riskMemory/structuredContext", () => ({
  buildRiskMemoryStructuredContext: mocks.buildRiskMemoryStructuredContext,
}));
vi.mock("@/lib/riskMemory/llmRecommendations", () => ({
  buildLlmRiskRecommendations: mocks.buildLlmRiskRecommendations,
}));
vi.mock("@/lib/csepApiGuard", () => ({
  companyHasCsepPlanName: mocks.companyHasCsepPlanName,
}));
vi.mock("@/lib/riskMemory/recommendations", () => ({
  buildRuleBasedRiskRecommendations: mocks.buildRuleBasedRiskRecommendations,
}));

beforeEach(() => {
  mocks.createSupabaseAdminClient.mockReset();
  mocks.buildRiskMemoryStructuredContext.mockReset();
  mocks.buildLlmRiskRecommendations.mockReset();
  mocks.companyHasCsepPlanName.mockReset();
  mocks.buildRuleBasedRiskRecommendations.mockReset();
  mocks.companyHasCsepPlanName.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const sampleCtx = {
  engine: "Safety360 Risk Memory Engine",
  windowDays: 90,
  facetCount: 12,
  aggregated: { score: 50, band: "moderate" },
  aggregatedWithBaseline: { score: 60, band: "high" },
} as never;

describe("runRiskMemoryCronJob — admin client missing", () => {
  it("fails fast when admin client cannot be created", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);
    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const r = await runRiskMemoryCronJob({});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/service role/i);
    expect(r.snapshotUpserts).toBe(0);
    expect(r.llmRecommendationsInserted).toBe(0);
    expect(r.llmEnabled).toBe(false);
  });
});

describe("runRiskMemoryCronJob — recommendations dedupe and LLM path", () => {
  it("inserts rule-based recommendations only when llm flag is off", async () => {
    const fake = makeFakeAdminClient({ companies: [{ id: "company-A" }] });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.buildRiskMemoryStructuredContext.mockResolvedValue(sampleCtx);
    mocks.buildRuleBasedRiskRecommendations.mockReturnValue([
      { kind: "rules_a", title: "Rule A", body: "body", confidence: 0.7 },
    ]);

    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const result = await runRiskMemoryCronJob({ includeRecommendations: true });

    expect(result.ok).toBe(true);
    expect(result.recommendationsInserted).toBe(1);
    expect(result.llmRecommendationsInserted).toBe(0);
    expect(result.llmEnabled).toBe(false);
    expect(mocks.buildLlmRiskRecommendations).not.toHaveBeenCalled();
    const inserts = fake.recorded.inserts["company_risk_ai_recommendations"] ?? [];
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as { context_snapshot: { generator: string } }).context_snapshot.generator).toBe("rules");
  });

  it("includes LLM recommendations when includeLlmRecommendations is true and tags generator", async () => {
    const fake = makeFakeAdminClient({ companies: [{ id: "company-A" }] });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.buildRiskMemoryStructuredContext.mockResolvedValue(sampleCtx);
    mocks.buildRuleBasedRiskRecommendations.mockReturnValue([
      { kind: "rules_a", title: "Rule A", body: "body", confidence: 0.7 },
    ]);
    mocks.buildLlmRiskRecommendations.mockResolvedValue({
      drafts: [{ kind: "llm_a", title: "LLM A", body: "ai body", confidence: 0.6 }],
    });

    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const result = await runRiskMemoryCronJob({ includeLlmRecommendations: true });

    expect(result.ok).toBe(true);
    expect(result.llmEnabled).toBe(true);
    expect(result.llmCompaniesProcessed).toBe(1);
    expect(result.recommendationsInserted).toBe(2);
    expect(result.llmRecommendationsInserted).toBe(1);
    expect(mocks.buildLlmRiskRecommendations).toHaveBeenCalledTimes(1);

    const inserts = fake.recorded.inserts["company_risk_ai_recommendations"] ?? [];
    const generators = inserts.map((row) => (row as { context_snapshot: { generator: string } }).context_snapshot.generator);
    expect(generators).toEqual(expect.arrayContaining(["rules", "llm"]));
  });

  it("dedupes against existing 7-day titles and across rule/LLM batch", async () => {
    const fake = makeFakeAdminClient({
      companies: [{ id: "company-A" }],
      existingTitlesByCompany: { "company-A": ["Already Inserted"] },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.buildRiskMemoryStructuredContext.mockResolvedValue(sampleCtx);
    mocks.buildRuleBasedRiskRecommendations.mockReturnValue([
      { kind: "rules_a", title: "Already Inserted", body: "x", confidence: 0.7 },
      { kind: "rules_b", title: "Shared Title", body: "x", confidence: 0.7 },
    ]);
    mocks.buildLlmRiskRecommendations.mockResolvedValue({
      drafts: [
        { kind: "llm_a", title: "Shared Title", body: "ai", confidence: 0.6 },
        { kind: "llm_b", title: "New LLM Insight", body: "ai", confidence: 0.6 },
      ],
    });

    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const result = await runRiskMemoryCronJob({ includeLlmRecommendations: true });

    const inserts = fake.recorded.inserts["company_risk_ai_recommendations"] ?? [];
    const titles = inserts.map((row) => (row as { title: string }).title);
    /** Already-inserted title is dropped; shared title appears once (rules win); new LLM title kept. */
    expect(titles).toEqual(["Shared Title", "New LLM Insight"]);
    expect(result.recommendationsInserted).toBe(2);
    expect(result.llmRecommendationsInserted).toBe(1);
  });

  it("respects allowlist: only allowlisted companies hit the LLM", async () => {
    const fake = makeFakeAdminClient({
      companies: [{ id: "company-A" }, { id: "company-B" }],
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.buildRiskMemoryStructuredContext.mockResolvedValue(sampleCtx);
    mocks.buildRuleBasedRiskRecommendations.mockReturnValue([]);
    mocks.buildLlmRiskRecommendations.mockResolvedValue({
      drafts: [{ kind: "llm_a", title: "Allowed Insight", body: "ai", confidence: 0.6 }],
    });

    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const result = await runRiskMemoryCronJob({
      includeLlmRecommendations: true,
      llmAllowlist: new Set(["company-A"]),
    });

    expect(result.llmCompaniesProcessed).toBe(1);
    expect(mocks.buildLlmRiskRecommendations).toHaveBeenCalledTimes(1);
  });

  it("respects llmMaxCompanies cap across the loop", async () => {
    const fake = makeFakeAdminClient({
      companies: [{ id: "company-A" }, { id: "company-B" }, { id: "company-C" }],
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.buildRiskMemoryStructuredContext.mockResolvedValue(sampleCtx);
    mocks.buildRuleBasedRiskRecommendations.mockReturnValue([]);
    mocks.buildLlmRiskRecommendations.mockResolvedValue({
      drafts: [{ kind: "llm_a", title: "Capped Insight", body: "ai", confidence: 0.6 }],
    });

    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const result = await runRiskMemoryCronJob({
      includeLlmRecommendations: true,
      llmMaxCompanies: 2,
    });

    expect(result.llmCompaniesProcessed).toBe(2);
    expect(mocks.buildLlmRiskRecommendations).toHaveBeenCalledTimes(2);
  });

  it("counts LLM failures without aborting the cron", async () => {
    const fake = makeFakeAdminClient({ companies: [{ id: "company-A" }] });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.buildRiskMemoryStructuredContext.mockResolvedValue(sampleCtx);
    mocks.buildRuleBasedRiskRecommendations.mockReturnValue([]);
    mocks.buildLlmRiskRecommendations.mockResolvedValue({
      drafts: [],
      error: "openai_http",
      meta: { model: "gpt-4o-mini", promptHash: null, fallbackUsed: true, attempts: 3, latencyMs: 100, usage: null, surface: "risk-memory.llm-recommendations" },
    });

    const { runRiskMemoryCronJob } = await import("./cronRollup");
    const result = await runRiskMemoryCronJob({ includeLlmRecommendations: true });

    expect(result.ok).toBe(true);
    expect(result.llmCompaniesProcessed).toBe(1);
    expect(result.llmCompaniesFailed).toBe(1);
    expect(result.recommendationsInserted).toBe(0);
  });
});

describe("env helpers", () => {
  it("isRiskMemoryLlmCronEnabled honors RISK_MEMORY_LLM_CRON=1", async () => {
    const { isRiskMemoryLlmCronEnabled } = await import("./cronRollup");
    vi.stubEnv("RISK_MEMORY_LLM_CRON", "1");
    expect(isRiskMemoryLlmCronEnabled()).toBe(true);
    vi.stubEnv("RISK_MEMORY_LLM_CRON", "0");
    expect(isRiskMemoryLlmCronEnabled()).toBe(false);
  });

  it("readRiskMemoryLlmCompanyAllowlist parses CSV ids", async () => {
    const { readRiskMemoryLlmCompanyAllowlist } = await import("./cronRollup");
    vi.stubEnv("RISK_MEMORY_LLM_COMPANY_IDS", "id-a, id-b ,id-c");
    expect([...readRiskMemoryLlmCompanyAllowlist()]).toEqual(["id-a", "id-b", "id-c"]);
  });
});
