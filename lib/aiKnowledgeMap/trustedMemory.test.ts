import { describe, expect, it } from "vitest";
import { retrieveTrustedKnowledgeGraphMemory } from "@/lib/aiKnowledgeMap/trustedMemory";

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

describe("retrieveTrustedKnowledgeGraphMemory", () => {
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
