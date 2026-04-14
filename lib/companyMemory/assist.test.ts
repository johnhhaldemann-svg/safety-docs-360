import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const retrieveMemoryForQuery = vi.hoisted(() => vi.fn());
const searchCompanyMemoryKeyword = vi.hoisted(() => vi.fn());
const listCompanyMemoryItems = vi.hoisted(() => vi.fn());
const serverLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/companyMemory/repository", () => ({
  retrieveMemoryForQuery,
  searchCompanyMemoryKeyword,
  listCompanyMemoryItems,
}));

vi.mock("@/lib/serverLog", () => ({
  serverLog,
}));

vi.mock("@/lib/openaiClient", () => ({
  getOpenAiApiBaseUrl: () => "https://example.test/v1",
  resolveOpenAiCompatibleModelId: (model: string) => model,
}));

vi.mock("@/lib/companyMemory/openaiResponses", () => ({
  extractResponsesApiOutputText: (input: unknown) =>
    typeof input === "string" ? input : JSON.stringify(input),
}));

import { buildSurfaceSystemPrompt, runCompanyAiAssist } from "@/lib/companyMemory/assist";

describe("buildSurfaceSystemPrompt", () => {
  it("returns surface-specific guidance", () => {
    expect(buildSurfaceSystemPrompt("csep")).toContain("CSEP");
    expect(buildSurfaceSystemPrompt("library")).toContain("company documents");
    expect(buildSurfaceSystemPrompt("corrective_actions")).toContain("corrective");
    expect(buildSurfaceSystemPrompt("jsa")).toContain("job safety");
  });

  it("falls back to default for unknown surface", () => {
    expect(buildSurfaceSystemPrompt("unknown_surface_xyz")).toBe(
      buildSurfaceSystemPrompt("default")
    );
  });
});

describe("runCompanyAiAssist", () => {
  beforeEach(() => {
    retrieveMemoryForQuery.mockReset();
    searchCompanyMemoryKeyword.mockReset();
    listCompanyMemoryItems.mockReset();
    serverLog.mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a memory-based fallback when OPENAI_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    retrieveMemoryForQuery.mockResolvedValue({
      method: "keyword",
      chunks: [
        {
          id: "m1",
          company_id: "company-1",
          source: "manual",
          title: "Lighting expectations",
          body: "Provide temporary lighting in walking paths, access points, and stair towers before shift start.",
          metadata: {},
          created_by: null,
          created_at: "2026-04-14T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    const result = await runCompanyAiAssist({} as never, "company-1", {
      surface: "incidents",
      userMessage: "Had someone roll their ankle due to poor lighting",
      structuredContext: JSON.stringify({ total: 3, open: 2, sif: 1, stopWork: 0 }),
    });

    expect(result.retrieval).toBe("keyword");
    expect(result.text).toContain("AI drafting is not enabled on this server right now");
    expect(result.text).toContain("Current context: total: 3 | open: 2 | sif: 1 | stop Work: 0");
    expect(result.text).toContain("Lighting expectations");
    expect(result.text).toContain("poor lighting or visibility as a contributing condition");
    expect(result.text).toContain("rolled or twisted ankle");
  });
});
