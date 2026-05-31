import { describe, expect, it } from "vitest";
import { assertActiveKnowledgeCompany } from "@/lib/aiKnowledgeMap/guardrails";

function companyClient(row: Record<string, unknown> | null, captured: string[]) {
  return {
    from(table: string) {
      expect(table).toBe("companies");
      const chain = {
        select(columns: string) {
          captured.push(columns);
          return chain;
        },
        eq: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      };
      return chain;
    },
  };
}

describe("AI Knowledge Map guardrails", () => {
  it("validates companies without requiring legacy is_active column", async () => {
    const captured: string[] = [];
    const companyId = await assertActiveKnowledgeCompany(companyClient({ id: "company-1", status: "active" }, captured) as never, "company-1");

    expect(companyId).toBe("company-1");
    expect(captured[0]).toBe("id,status");
  });

  it("blocks inactive company statuses", async () => {
    const captured: string[] = [];

    await expect(assertActiveKnowledgeCompany(companyClient({ id: "company-1", status: "archived" }, captured) as never, "company-1")).rejects.toThrow("inactive or archived");
  });
});
