import { describe, expect, it } from "vitest";
import {
  buildSearchFacets,
  buildWorkspaceSearchResult,
  filterSearchResults,
  getMatchedFields,
  normalizeSearchQuery,
  resultMatchesQuery,
  type SearchResultInput,
} from "@/lib/companySearch";

const baseInput: SearchResultInput = {
  id: "result-1",
  type: "corrective_action",
  title: "Guardrail gap corrective action",
  subtitle: "North Tower | Fall protection",
  status: "open",
  updatedAt: "2026-05-20T12:00:00.000Z",
  href: "/field-id-exchange?action=result-1",
  jobsiteName: "North Tower",
  sourceTable: "company_corrective_actions",
  fields: [
    { label: "Title", value: "Guardrail gap corrective action" },
    { label: "Description", value: "Missing leading edge guardrail near deck opening" },
    { label: "Priority", value: "high" },
  ],
};

describe("company workspace search helpers", () => {
  it("normalizes user search text", () => {
    expect(normalizeSearchQuery("  Leading Edge  ")).toBe("leading edge");
    expect(normalizeSearchQuery(null)).toBe("");
  });

  it("reports matched fields using all query tokens", () => {
    expect(getMatchedFields(baseInput.fields, "leading guardrail")).toEqual(["Description"]);
    expect(getMatchedFields(baseInput.fields, "")).toEqual([]);
  });

  it("matches across core result text and searchable fields", () => {
    expect(resultMatchesQuery(baseInput, "north tower")).toBe(true);
    expect(resultMatchesQuery(baseInput, "deck opening")).toBe(true);
    expect(resultMatchesQuery(baseInput, "invoice")).toBe(false);
  });

  it("builds the unified result contract", () => {
    expect(buildWorkspaceSearchResult(baseInput, "guardrail")).toMatchObject({
      id: "result-1",
      type: "corrective_action",
      title: "Guardrail gap corrective action",
      subtitle: "North Tower | Fall protection",
      status: "open",
      href: "/field-id-exchange?action=result-1",
      jobsiteName: "North Tower",
      matchedFields: ["Title", "Description"],
      sourceTable: "company_corrective_actions",
    });
  });

  it("filters by type, sorts by recency, applies limit, and builds facets", () => {
    const inputs: SearchResultInput[] = [
      baseInput,
      {
        ...baseInput,
        id: "result-2",
        type: "permit",
        title: "Hot work permit",
        updatedAt: "2026-05-21T12:00:00.000Z",
        href: "/permits?id=result-2",
        sourceTable: "company_permits",
      },
      {
        ...baseInput,
        id: "result-3",
        type: "marketplace_template",
        title: "Purchased excavation template",
        updatedAt: "2026-05-19T12:00:00.000Z",
        href: "/library?doc=result-3",
        sourceTable: "documents",
      },
    ];

    const results = filterSearchResults({
      inputs,
      query: "permit",
      types: new Set(["permit", "marketplace_template"]),
      limit: 5,
    });

    expect(results.map((result) => result.id)).toEqual(["result-2"]);
    expect(buildSearchFacets(results, " permit ")).toEqual({
      typeCounts: { permit: 1 },
      jobsiteCounts: { "North Tower": 1 },
      total: 1,
      query: "permit",
    });
  });
});
