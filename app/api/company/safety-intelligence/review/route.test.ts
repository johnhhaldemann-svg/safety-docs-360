import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeSafetyIntelligenceRequest: vi.fn(),
  buildSafetyReviewPayload: vi.fn(),
}));

vi.mock("@/lib/safety-intelligence/http", () => ({
  authorizeSafetyIntelligenceRequest: mocks.authorizeSafetyIntelligenceRequest,
}));

vi.mock("@/lib/safety-intelligence/review", () => ({
  buildSafetyReviewPayload: mocks.buildSafetyReviewPayload,
}));

import { GET } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

function buildPayload(scope: "company" | "jobsite") {
  return {
    scope,
    jobsiteId: scope === "jobsite" ? "jobsite-1" : null,
    rowCount: 2,
    summary: {
      totalGaps: 3,
      permitGaps: 1,
      trainingGaps: 1,
      ppeGaps: 1,
    },
    rows: [],
    warning: null,
  };
}

describe("safety intelligence review route", () => {
  it("returns an empty payload when no company scope is linked", async () => {
    mocks.authorizeSafetyIntelligenceRequest.mockResolvedValue({
      supabase: {},
      companyScope: { companyId: null },
    });

    const response = (await GET(new Request("https://example.com/api/company/safety-intelligence/review")))!;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rowCount).toBe(0);
    expect(body.scope).toBe("company");
  });

  it("returns company-wide review payloads", async () => {
    mocks.authorizeSafetyIntelligenceRequest.mockResolvedValue({
      supabase: { tag: "supabase" },
      companyScope: { companyId: "company-1" },
    });
    mocks.buildSafetyReviewPayload.mockResolvedValue(buildPayload("company"));

    const response = (await GET(new Request("https://example.com/api/company/safety-intelligence/review")))!;

    expect(response.status).toBe(200);
    expect(mocks.buildSafetyReviewPayload).toHaveBeenCalledWith({
      supabase: { tag: "supabase" },
      companyId: "company-1",
      jobsiteId: null,
    });
  });

  it("returns jobsite-filtered review payloads", async () => {
    mocks.authorizeSafetyIntelligenceRequest.mockResolvedValue({
      supabase: { tag: "supabase" },
      companyScope: { companyId: "company-1" },
    });
    mocks.buildSafetyReviewPayload.mockResolvedValue(buildPayload("jobsite"));

    const response = (await GET(
      new Request("https://example.com/api/company/safety-intelligence/review?jobsiteId=jobsite-1")
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.buildSafetyReviewPayload).toHaveBeenCalledWith({
      supabase: { tag: "supabase" },
      companyId: "company-1",
      jobsiteId: "jobsite-1",
    });
  });

  it("propagates authorization failures", async () => {
    const denied = new Response("forbidden", { status: 403 });
    mocks.authorizeSafetyIntelligenceRequest.mockResolvedValue({ error: denied });

    const response = (await GET(new Request("https://example.com/api/company/safety-intelligence/review")))!;
    expect(response.status).toBe(403);
  });
});
