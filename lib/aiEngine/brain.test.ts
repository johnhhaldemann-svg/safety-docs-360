import { beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveAiEngineBrainContext } from "@/lib/aiEngine/brain";
import { retrieveTrustedKnowledgeGraphMemory } from "@/lib/aiKnowledgeMap/trustedMemory";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";
import type { TrustedKnowledgeGraphMemoryItem } from "@/lib/aiKnowledgeMap/types";

vi.mock("@/lib/serverLog", () => ({
  serverLog: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

vi.mock("@/lib/aiKnowledgeMap/trustedMemory", () => ({
  formatTrustedKnowledgeGraphExcerpts: vi.fn((items: Array<{ title: string; excerpt: string; companyId?: string | null }>) =>
    items.length
      ? [
          "--- Approved Knowledge Graph context (Human Review approved; supporting safety context only, not regulatory proof) ---",
          ...items.map((item, index) => `[G${index + 1}] ${item.companyId ? "company-specific approved memory" : "general approved fallback guidance"} ${item.title}\n${item.excerpt}`),
        ].join("\n\n")
      : null
  ),
  retrieveTrustedKnowledgeGraphMemory: vi.fn(),
}));

vi.mock("@/lib/companyMemory/repository", () => ({
  retrieveMemoryForQuery: vi.fn(),
}));

const graphNode: TrustedKnowledgeGraphMemoryItem = {
  id: "graph:node-1",
  nodeId: "node-1",
  companyId: "company-1",
  title: "Hot Work Fire Watch",
  excerpt: "Approved hot work fire watch memory.",
  sourceTable: "company_permits",
  sourceId: "permit-1",
  category: "permit",
  nodeType: "permit",
  riskLevel: "high",
  confidenceScore: 0.91,
  relationshipReasons: ["Hot work requires a fire watch control."],
  evidence: [],
};

const fallbackNode: TrustedKnowledgeGraphMemoryItem = {
  ...graphNode,
  id: "fallback:global-hot-work",
  nodeId: "global-hot-work",
  companyId: null,
  title: "General Hot Work Guidance",
  excerpt: "General approved fallback guidance for hot work.",
};

const legacyNode = {
  id: "legacy-1",
  company_id: "company-1",
  source: "document_upload",
  title: "Company Hot Work Procedure",
  body: "Legacy company procedure text.",
  metadata: {},
  created_by: null,
  created_at: "2026-05-31T00:00:00.000Z",
  updated_at: "2026-05-31T00:00:00.000Z",
} as const;

describe("retrieveAiEngineBrainContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses approved graph memory first without legacy fallback when company graph memory is sufficient", async () => {
    vi.mocked(retrieveTrustedKnowledgeGraphMemory).mockResolvedValue({
      items: [graphNode, { ...graphNode, id: "graph:node-2", nodeId: "node-2", title: "Extinguisher Control" }],
      method: "approved_graph_semantic",
      warnings: [],
    });

    const result = await retrieveAiEngineBrainContext({
      surface: "permit.copilot",
      adminClient: {} as never,
      userClient: {} as never,
      companyId: "company-1",
      query: "hot work",
      includeLegacyMemory: true,
      legacyWhenGraphItemCountBelow: 2,
    });

    expect(result.method).toBe("approved_graph_semantic");
    expect(result.graphMemoryCount).toBe(2);
    expect(result.legacyMemoryCount).toBe(0);
    expect(retrieveMemoryForQuery).not.toHaveBeenCalled();
    expect(result.formattedPromptBlock).toContain("Approved Knowledge Graph context");
  });

  it("labels fallback graph memory and adds legacy company support when company graph memory is thin", async () => {
    vi.mocked(retrieveTrustedKnowledgeGraphMemory).mockResolvedValue({
      items: [fallbackNode],
      method: "approved_graph_with_fallback",
      warnings: [],
    });
    vi.mocked(retrieveMemoryForQuery).mockResolvedValue({
      chunks: [legacyNode],
      method: "keyword",
    });

    const result = await retrieveAiEngineBrainContext({
      surface: "gus.verified_answer",
      adminClient: {} as never,
      userClient: {} as never,
      companyId: "company-1",
      query: "hot work fire watch",
      includeLegacyMemory: true,
    });

    expect(result.method).toBe("approved_graph_with_fallback_and_legacy");
    expect(result.fallbackMemoryCount).toBe(1);
    expect(result.legacyMemoryCount).toBe(1);
    expect(result.warnings.join(" ")).toContain("general approved fallback");
    expect(result.formattedPromptBlock).toContain("general approved fallback guidance");
    expect(result.formattedPromptBlock).toContain("Legacy company memory support");
  });

  it("never uses legacy memory unless explicitly allowed", async () => {
    vi.mocked(retrieveTrustedKnowledgeGraphMemory).mockResolvedValue({
      items: [],
      method: "none",
      warnings: [],
    });

    const result = await retrieveAiEngineBrainContext({
      surface: "smart_safety.review",
      adminClient: {} as never,
      userClient: {} as never,
      companyId: "company-1",
      query: "fall protection",
      includeLegacyMemory: false,
    });

    expect(result.method).toBe("none");
    expect(result.legacyMemoryCount).toBe(0);
    expect(retrieveMemoryForQuery).not.toHaveBeenCalled();
  });
});
