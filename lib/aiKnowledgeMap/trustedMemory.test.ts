import { describe, expect, it, vi } from "vitest";
import { retrieveTrustedKnowledgeGraphMemory } from "@/lib/aiKnowledgeMap/trustedMemory";

vi.mock("@/lib/ai/embeddings", () => ({
  requestAiEmbedding: vi.fn(async () => ({
    embedding: Array.from({ length: 1536 }, () => 0.1),
    model: "text-embedding-3-small",
    provider: "openai",
    promptHash: "hash",
  })),
}));

function queryResult(table: string, rowsByTable: Record<string, Array<Record<string, unknown>>>) {
  const filters: Array<{ column: string; value: unknown; kind: "eq" | "in" }> = [];
  let maxRows = 1000;
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value, kind: "eq" });
      return builder;
    },
    in: (column: string, value: unknown[]) => {
      filters.push({ column, value, kind: "in" });
      return builder;
    },
    limit: (value: number) => {
      maxRows = value;
      return builder;
    },
    then: (resolve: (value: unknown) => void) => {
      const data = (rowsByTable[table] ?? [])
        .filter((row) =>
          filters.every((filter) => {
            if (filter.kind === "eq") return row[filter.column] === filter.value;
            return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
          }),
        )
        .slice(0, maxRows);
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return builder;
}

function fakeClient(rowsByTable: Record<string, Array<Record<string, unknown>>>) {
  return {
    from: (table: string) => queryResult(table, rowsByTable),
  };
}

function fakeSemanticClient(rowsByTable: Record<string, Array<Record<string, unknown>>>, rpcRows: Array<Record<string, unknown>>) {
  return {
    from: (table: string) => queryResult(table, rowsByTable),
    rpc: vi.fn(async () => ({ data: rpcRows, error: null })),
  };
}

describe("retrieveTrustedKnowledgeGraphMemory", () => {
  it("uses approved semantic vector matches before keyword fallback", async () => {
    const semanticNode = {
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "22222222-2222-4222-8222-222222222222",
      title: "Semantic hot work control",
      description: "Semantic match for fire watch controls.",
      semantic_summary: "Approved vector memory for hot work fire watch.",
      source_table: "company_controls",
      source_id: "control-1",
      category: "control",
      node_type: "control",
      risk_level: "high",
      confidence_score: 0.91,
      validation_status: "approved",
      similarity: 0.88,
    };
    const client = fakeSemanticClient({
      ai_knowledge_edges: [
        {
          source_node_id: semanticNode.id,
          company_id: semanticNode.company_id,
          reason: "Approved semantic relationship to hot work fire watch.",
          validation_status: "approved",
          source_evidence: [],
        },
      ],
      approved_knowledge: [],
      documents: [],
    }, [semanticNode]);

    const result = await retrieveTrustedKnowledgeGraphMemory(client as never, {
      companyId: String(semanticNode.company_id),
      query: "hot work fire watch",
      topK: 1,
    });

    expect(result.method).toBe("approved_graph_semantic");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.nodeId).toBe(semanticNode.id);
    expect(result.items[0]?.similarity).toBe(0.88);
    expect(result.items[0]?.relationshipReasons).toContain("Approved semantic relationship to hot work fire watch.");
  });

  it("returns only approved nodes that also have indexed or fallback vector memory", async () => {
    const result = await retrieveTrustedKnowledgeGraphMemory(fakeClient({
      ai_knowledge_nodes: [
        {
          id: "node-approved",
          company_id: "company-1",
          title: "Hot Work Permit",
          description: "Hot work connects fire watch and extinguisher controls.",
          semantic_summary: "Reviewed hot work permit memory.",
          source_table: "company_permits",
          source_id: "permit-1",
          category: "Permits",
          node_type: "permit",
          risk_level: "high",
          confidence_score: 0.88,
          validation_status: "approved",
        },
        {
          id: "node-pending",
          company_id: "company-1",
          title: "Pending Training Gap",
          description: "This should never influence AI answers yet.",
          source_table: "company_training_requirements",
          source_id: "training-1",
          category: "Training",
          node_type: "training",
          risk_level: "moderate",
          validation_status: "pending_review",
        },
      ],
      ai_knowledge_edges: [
        {
          source_node_id: "node-approved",
          company_id: "company-1",
          reason: "Super Admin approved link to fire watch control.",
          validation_status: "approved",
          source_evidence: [],
        },
      ],
      ai_vector_memory: [
        { node_id: "node-approved", company_id: "company-1", status: "fallback" },
      ],
    }) as never, {
      companyId: "company-1",
      query: "hot work fire watch",
      topK: 5,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.nodeId).toBe("node-approved");
    expect(result.items[0]?.relationshipReasons).toContain("Super Admin approved link to fire watch control.");
  });
});
