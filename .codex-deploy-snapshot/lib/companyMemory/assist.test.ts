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

import {
  buildSurfaceSystemPrompt,
  runCompanyAiAssist,
  wantsCsepBuilderWeatherJsonOutput,
} from "@/lib/companyMemory/assist";

describe("wantsCsepBuilderWeatherJsonOutput", () => {
  it("returns true when structured context marks weather AI section", () => {
    expect(
      wantsCsepBuilderWeatherJsonOutput(
        JSON.stringify({ ai_section: { kind: "weather", id: "weather" } })
      )
    ).toBe(true);
  });

  it("returns false for other sections or invalid JSON", () => {
    expect(wantsCsepBuilderWeatherJsonOutput(JSON.stringify({ ai_section: { kind: "text" } }))).toBe(
      false
    );
    expect(wantsCsepBuilderWeatherJsonOutput("{")).toBe(false);
    expect(wantsCsepBuilderWeatherJsonOutput(null)).toBe(false);
  });
});

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

  it("adds checklist guardrails for csep/peshep surfaces", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    retrieveMemoryForQuery.mockResolvedValue({ method: "semantic", chunks: [] });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "Checklist-aware response" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCompanyAiAssist({} as never, "company-1", {
      surface: "csep",
      userMessage: "What should I fix before submit?",
      structuredContext: JSON.stringify({
        checklistEvaluationSummary: { needsUserInput: 3 },
        checklistNeedsUserInput: [{ item: "Formal safety policy statement" }],
      }),
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as { input?: string };
    expect(body.input).toContain("Checklist evaluation signals are provided in structured context");
    expect(body.input).toContain("Coverage, Missing Inputs, Conditional Programs");
  });

  it("uses JSON-only system guidance for CSEP weather smart fill (no anti-JSON line)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    retrieveMemoryForQuery.mockResolvedValue({ method: "semantic", chunks: [] });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "{}" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await runCompanyAiAssist({} as never, "company-1", {
      surface: "csep",
      userMessage: "Return only valid JSON with this exact shape:",
      structuredContext: JSON.stringify({
        ai_section: { id: "weather", kind: "weather", title: "Weather" },
      }),
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as { input?: string };
    expect(body.input).toContain("one JSON object only");
    expect(body.input).not.toContain("Never output JSON unless the user explicitly asks for JSON.");
  });
});
