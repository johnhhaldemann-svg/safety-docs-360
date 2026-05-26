import { describe, expect, it } from "vitest";
import { sourceMatchesUrl } from "@/lib/gusLearning/sourceValidation";
import type { ApprovedSourceRow } from "@/lib/gusLearning/types";

function source(overrides: Partial<ApprovedSourceRow> = {}): ApprovedSourceRow {
  return {
    id: "source-1",
    company_id: "company-1",
    source_name: "OSHA",
    source_url: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926",
    domain: "osha.gov",
    source_type: "OSHA",
    jurisdiction: "Federal",
    trust_level: "high",
    is_active: true,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Gus approved source validation", () => {
  it("allows URLs inside an active approved source scope", () => {
    const result = sourceMatchesUrl(source(), "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.652");
    expect(result.ok).toBe(true);
  });

  it("blocks unapproved domains and blocked sources", () => {
    expect(sourceMatchesUrl(source(), "https://example.com/laws-regs/regulations/standardnumber/1926").ok).toBe(false);
    expect(sourceMatchesUrl(source({ trust_level: "blocked" }), "https://www.osha.gov/laws-regs/regulations/standardnumber/1926").ok).toBe(false);
  });

  it("does not allow URLs outside the approved path scope", () => {
    const result = sourceMatchesUrl(source(), "https://www.osha.gov/news/newsreleases");
    expect(result.ok).toBe(false);
  });
});
