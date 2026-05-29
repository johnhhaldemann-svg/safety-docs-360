import { describe, expect, it } from "vitest";
import { getKnowledgeGraphPayload } from "@/lib/aiKnowledgeMap/repository";
import { retrieveTrustedKnowledgeGraphMemory } from "@/lib/aiKnowledgeMap/trustedMemory";

type Filter = { column: string; value: unknown; kind: "eq" | "neq" | "in" | "is" };

function queryResult(table: string, rowsByTable: Record<string, Array<Record<string, unknown>>>) {
  const filters: Filter[] = [];
  let maxRows = 1000;
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value, kind: "eq" });
      return builder;
    },
    neq: (column: string, value: unknown) => {
      filters.push({ column, value, kind: "neq" });
      return builder;
    },
    in: (column: string, value: unknown[]) => {
      filters.push({ column, value, kind: "in" });
      return builder;
    },
    is: (column: string, value: unknown) => {
      filters.push({ column, value, kind: "is" });
      return builder;
    },
    order: () => builder,
    limit: (value: number) => {
      maxRows = value;
      return builder;
    },
    then: (resolve: (value: unknown) => void) => {
      const data = (rowsByTable[table] ?? [])
        .filter((row) =>
          filters.every((filter) => {
            if (filter.kind === "eq") return row[filter.column] === filter.value;
            if (filter.kind === "neq") return row[filter.column] !== filter.value;
            if (filter.kind === "is") return row[filter.column] === filter.value;
            return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
          }),
        )
        .slice(0, maxRows);
      return Promise.resolve({ data, error: null, count: data.length }).then(resolve);
    },
  };
  return builder;
}

function fakeClient(rowsByTable: Record<string, Array<Record<string, unknown>>>) {
  return {
    from: (table: string) => queryResult(table, rowsByTable),
  };
}

function approvedNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    company_id: "company-1",
    source_table: "company_hazards",
    source_id: id,
    source_record_id: id,
    title: `Approved hazard ${id}`,
    node_type: "hazard",
    type: "hazard",
    category: "hazard",
    description: "Company-specific approved hazard memory.",
    semantic_summary: "Company-specific approved hazard memory.",
    risk_level: "moderate",
    validation_status: "approved",
    confidence_score: 0.82,
    vector_status: "indexed",
    vector_coordinates: { x: 0, y: 0, z: 1, cluster: "hazard" },
    ...overrides,
  };
}

function approvedEdge(id: string, sourceNodeId: string, targetNodeId: string) {
  return {
    id,
    company_id: "company-1",
    source_node_id: sourceNodeId,
    target_node_id: targetNodeId,
    from_node_id: sourceNodeId,
    to_node_id: targetNodeId,
    relationship_type: "similar_record_by_vector_match",
    relationship_strength: 0.72,
    strength_score: 0.72,
    reason: "Approved company-specific relationship.",
    source_evidence: [],
    validation_status: "approved",
    confidence_score: 0.74,
    created_by_type: "system",
  };
}

const globalKnowledge = {
  id: "global-knowledge-1",
  company_id: null,
  topic: "Hot work",
  knowledge_title: "Hot work fire watch guidance",
  approved_summary: "Hot work should be reviewed for fire watch, extinguisher, combustibles, burn exposure, and PPE.",
  required_control_type: "best_practice",
  source_type: "company policy",
  quality_score: 88,
  is_active: true,
  review_status: "current",
};

describe("real-data fallback knowledge graph", () => {
  it("returns approved fallback data for a new company without company-specific graph memory", async () => {
    const payload = await getKnowledgeGraphPayload(fakeClient({
      companies: [{ id: "new-company", name: "New Company" }],
      ai_knowledge_nodes: [],
      ai_knowledge_edges: [],
      ai_vector_memory: [],
      approved_knowledge: [globalKnowledge],
      documents: [],
    }) as never, { companyId: "new-company" });

    expect(payload.fallback).toBe(true);
    expect(payload.nodes.length).toBeGreaterThan(0);
    expect(payload.nodes.every((node) => node.metadata.fallback === true)).toBe(true);
    expect(payload.nodes.every((node) => node.sourceId.startsWith("fallback-"))).toBe(true);
    expect(payload.nodes.every((node) => node.sourceUrl === null)).toBe(true);
    expect(payload.fallbackReason).toContain("approved fallback safety intelligence");
  });

  it("does not add fallback when approved company-specific graph data is above threshold", async () => {
    const nodes = Array.from({ length: 8 }, (_, index) => approvedNode(`node-${index + 1}`));
    const edges = Array.from({ length: 10 }, (_, index) => approvedEdge(`edge-${index + 1}`, nodes[index % nodes.length].id, nodes[(index + 1) % nodes.length].id));
    const payload = await getKnowledgeGraphPayload(fakeClient({
      companies: [{ id: "company-1", name: "Company One" }],
      ai_knowledge_nodes: nodes,
      ai_knowledge_edges: edges,
      ai_vector_memory: nodes.map((node) => ({ node_id: node.id, company_id: "company-1", status: "indexed" })),
      approved_knowledge: [globalKnowledge],
      documents: [],
    }) as never, { companyId: "company-1" });

    expect(payload.fallback).toBe(false);
    expect(payload.companySpecificNodeCount).toBe(8);
    expect(payload.companySpecificEdgeCount).toBe(10);
    expect(payload.nodes.some((node) => node.metadata.fallback === true)).toBe(false);
  });

  it("filters fallback nodes by source type and anonymizes cross-company patterns", async () => {
    const payload = await getKnowledgeGraphPayload(fakeClient({
      companies: [{ id: "new-company", name: "New Company" }],
      ai_knowledge_nodes: [
        approvedNode("other-incident", {
          company_id: "other-company",
          node_type: "incident",
          type: "incident",
          category: "incident",
          title: "Other customer raw incident title",
          description: "Other customer raw incident details",
        }),
      ],
      ai_knowledge_edges: [],
      ai_vector_memory: [],
      approved_knowledge: [],
      documents: [],
    }) as never, { companyId: "new-company", sourceType: "incident" });

    expect(payload.fallback).toBe(true);
    expect(payload.nodes).toHaveLength(1);
    expect(payload.nodes[0]?.nodeType).toBe("incident");
    expect(payload.nodes[0]?.title).not.toContain("Other customer");
    expect(payload.nodes[0]?.description).not.toContain("raw incident details");
  });

  it("ranks company-specific trusted memory above general fallback guidance", async () => {
    const result = await retrieveTrustedKnowledgeGraphMemory(fakeClient({
      ai_knowledge_nodes: [
        approvedNode("company-hot-work", {
          title: "Company hot work permit",
          description: "Company-specific hot work permit connects fire watch and extinguisher controls.",
          semantic_summary: "Company-specific reviewed hot work permit memory.",
        }),
      ],
      ai_knowledge_edges: [],
      ai_vector_memory: [{ node_id: "company-hot-work", company_id: "company-1", status: "indexed" }],
      approved_knowledge: [globalKnowledge],
      documents: [],
    }) as never, {
      companyId: "company-1",
      query: "hot work fire watch",
      topK: 3,
    });

    expect(result.items[0]?.nodeId).toBe("company-hot-work");
    expect(result.items.some((item) => item.id.startsWith("fallback:"))).toBe(true);
    expect(result.items.find((item) => item.id.startsWith("fallback:"))?.excerpt).toContain("not company-specific evidence");
    expect(result.method).toBe("approved_graph_with_fallback");
  });
});
