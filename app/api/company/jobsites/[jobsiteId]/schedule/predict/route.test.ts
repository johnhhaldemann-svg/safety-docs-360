import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, runStructuredAiJsonTask } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  runStructuredAiJsonTask: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/rateLimit", () => ({ checkFixedWindowRateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/ai/responses", () => ({ runStructuredAiJsonTask }));

import { POST } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.upsert.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    role: "company_admin",
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

function predictionRequest(body: Record<string, unknown>) {
  return new Request("https://example.com/api/company/jobsites/jobsite-1/schedule/predict", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const input = {
  trade: "Welding",
  taskType: "Hot work / welding / cutting",
  workArea: "Interior buildout",
};

describe("/api/company/jobsites/[jobsiteId]/schedule/predict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T15:00:00.000Z"));
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls AI on first daily request and stores the result", async () => {
    const cacheUpsert = queryBuilder({ data: null, error: null });
    authWithBuilders([
      queryBuilder({ data: { id: "jobsite-1", company_id: "company-1" }, error: null }),
      queryBuilder({ data: null, error: null }),
      cacheUpsert,
    ]);
    runStructuredAiJsonTask.mockResolvedValue({
      parsed: {
        riskLevel: "high",
        hazardCategories: ["fire_watch"],
        requiredControls: ["30 minute fire watch"],
        rationale: "AI enriched hot work controls.",
        confidence: 0.91,
      },
      meta: {
        model: "gpt-test",
        provider: "openai",
        promptHash: "hash-1",
        fallbackUsed: false,
        fallbackReason: null,
        attempts: 1,
        latencyMs: 10,
        usage: null,
        surface: "schedule.hazard-prediction",
      },
    });

    const response = requireRouteResponse(await POST(predictionRequest(input), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("ai_updated_today");
    expect(body.rationale).toBe("AI enriched hot work controls.");
    expect(runStructuredAiJsonTask).toHaveBeenCalledTimes(1);
    expect(cacheUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        jobsite_id: "jobsite-1",
        prediction_date: "2026-05-18",
        status: "ok",
      }),
      expect.objectContaining({ onConflict: "company_id,jobsite_id,input_fingerprint,prediction_date" })
    );
  });

  it("returns same-day cached AI without calling AI", async () => {
    authWithBuilders([
      queryBuilder({ data: { id: "jobsite-1", company_id: "company-1" }, error: null }),
      queryBuilder({
        data: {
          status: "ok",
          ai_payload: {
            riskLevel: "high",
            rationale: "Cached rationale.",
            hazardCategories: ["cached_hazard"],
            requiredControls: ["cached control"],
            confidence: 0.82,
          },
          ai_meta: { model: "cached-model" },
        },
        error: null,
      }),
    ]);

    const response = requireRouteResponse(await POST(predictionRequest(input), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("ai_cached");
    expect(body.rationale).toBe("Cached rationale.");
    expect(runStructuredAiJsonTask).not.toHaveBeenCalled();
  });

  it("refreshes on the next day because the cache date changes", async () => {
    const cacheUpsert = queryBuilder({ data: null, error: null });
    authWithBuilders([
      queryBuilder({ data: { id: "jobsite-1", company_id: "company-1" }, error: null }),
      queryBuilder({ data: null, error: null }),
      cacheUpsert,
    ]);
    vi.setSystemTime(new Date("2026-05-19T02:00:00.000Z"));
    runStructuredAiJsonTask.mockResolvedValue({
      parsed: { rationale: "Next day AI.", confidence: 0.8 },
      meta: {
        model: "gpt-test",
        provider: "openai",
        promptHash: "hash-2",
        fallbackUsed: false,
        fallbackReason: null,
        attempts: 1,
        latencyMs: 10,
        usage: null,
        surface: "schedule.hazard-prediction",
      },
    });

    const response = requireRouteResponse(await POST(predictionRequest(input), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));

    expect(response.status).toBe(200);
    expect(runStructuredAiJsonTask).toHaveBeenCalledTimes(1);
    expect(cacheUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ prediction_date: "2026-05-19" }),
      expect.any(Object)
    );
  });

  it("stores a daily fallback attempt when AI is unavailable", async () => {
    const cacheUpsert = queryBuilder({ data: null, error: null });
    authWithBuilders([
      queryBuilder({ data: { id: "jobsite-1", company_id: "company-1" }, error: null }),
      queryBuilder({ data: null, error: null }),
      cacheUpsert,
    ]);
    runStructuredAiJsonTask.mockResolvedValue({
      parsed: {},
      meta: {
        model: null,
        provider: null,
        promptHash: null,
        fallbackUsed: true,
        fallbackReason: "no_openai_api_key",
        attempts: 0,
        latencyMs: 0,
        usage: null,
        surface: "schedule.hazard-prediction",
      },
    });

    const response = requireRouteResponse(await POST(predictionRequest(input), {
      params: Promise.resolve({ jobsiteId: "jobsite-1" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("rules_fallback");
    expect(body.permitTriggers).toContain("hot_work_permit");
    expect(cacheUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fallback",
        ai_payload: null,
      }),
      expect.any(Object)
    );
  });
});
