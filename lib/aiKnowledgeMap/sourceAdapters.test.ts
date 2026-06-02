import { describe, expect, it } from "vitest";
import { AI_KNOWLEDGE_SOURCE_ADAPTERS, AI_KNOWLEDGE_SOURCE_TABLES, adapterForSourceTable, domainCoverageForNodes } from "@/lib/aiKnowledgeMap/sourceAdapters";
import { normalizeSourceRowToKnowledgeNode } from "@/lib/aiKnowledgeMap/normalize";

describe("AI Knowledge Map source adapter registry", () => {
  it("keeps every registered source normalizable", () => {
    expect(AI_KNOWLEDGE_SOURCE_TABLES.length).toBeGreaterThan(20);
    for (const adapter of AI_KNOWLEDGE_SOURCE_ADAPTERS) {
      const node = normalizeSourceRowToKnowledgeNode(adapter.table, {
        id: `${adapter.table}-1`,
        company_id: "company-1",
        title: adapter.table,
        description: `Fixture row for ${adapter.table}`,
      });

      expect(node?.sourceTable).toBe(adapter.table);
      expect(node?.nodeType).toBe(adapter.nodeType);
      expect(adapterForSourceTable(adapter.table)).toBe(adapter);
      expect(adapter.requiredFields).toEqual(expect.arrayContaining(["id", "company_id"]));
      expect(adapter.evidenceFields.length).toBeGreaterThan(0);
    }
  });

  it("reports indexed, approved, stale, and low-confidence coverage by domain source", () => {
    const coverage = domainCoverageForNodes([
      {
        sourceTable: "company_permits",
        validationStatus: "approved",
        confidenceScore: 0.91,
        metadata: { reviewDueAt: "2025-01-01T00:00:00.000Z" },
      },
      {
        sourceTable: "company_jobsite_chemicals",
        validationStatus: "unreviewed",
        confidenceScore: 0.44,
        metadata: {},
      },
    ]);

    expect(coverage.find((entry) => entry.table === "company_permits")).toMatchObject({
      domain: "permits",
      indexedNodeCount: 1,
      approvedNodeCount: 1,
      staleNodeCount: 1,
    });
    expect(coverage.find((entry) => entry.table === "company_jobsite_chemicals")).toMatchObject({
      domain: "chemicals_sds",
      indexedNodeCount: 1,
      lowConfidenceNodeCount: 1,
    });
  });
});
