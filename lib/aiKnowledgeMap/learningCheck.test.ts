import { describe, expect, it } from "vitest";
import {
  documentSafetySortScore,
  getCentralHour,
  runAiKnowledgeLearningCheck,
  isAllowedApprovedSourceRow,
  shouldRunLearningCheck,
} from "@/lib/aiKnowledgeMap/learningCheck";

describe("AI knowledge learning check guardrails", () => {
  it("runs only during the 6 AM and 6 PM Central cron windows unless forced", () => {
    const sixAmCentral = new Date("2026-05-29T11:00:00.000Z");
    const sixPmCentral = new Date("2026-05-29T23:00:00.000Z");
    const noonCentral = new Date("2026-05-29T17:00:00.000Z");

    expect(getCentralHour(sixAmCentral)).toBe(6);
    expect(shouldRunLearningCheck(sixAmCentral)).toBe(true);
    expect(shouldRunLearningCheck(sixPmCentral)).toBe(true);
    expect(shouldRunLearningCheck(noonCentral)).toBe(false);
    expect(shouldRunLearningCheck(noonCentral, true)).toBe(true);
  });

  it("prioritizes approved/final, risk-heavy, missing-memory documents", () => {
    const approvedHotWork = documentSafetySortScore({
      status: "approved",
      document_title: "Hot Work Procedure",
      notes: "Critical fire hazard controls, extinguisher, burn PPE, fire watch, stop work.",
      final_file_path: "company/hot-work.pdf",
      updated_at: "2026-05-28T00:00:00.000Z",
    }, true);
    const draftGeneral = documentSafetySortScore({
      status: "draft",
      document_title: "General Memo",
      notes: "Office note.",
      updated_at: "2026-05-28T00:00:00.000Z",
    }, true);

    expect(approvedHotWork).toBeGreaterThan(draftGeneral);
  });

  it("allows only active non-blocked HTTPS allowlist sources that match their domain", () => {
    expect(isAllowedApprovedSourceRow({
      source_url: "https://www.osha.gov/laws-regs",
      domain: "osha.gov",
      is_active: true,
      trust_level: "high",
    })).toBe(true);

    expect(isAllowedApprovedSourceRow({
      source_url: "http://www.osha.gov/laws-regs",
      domain: "osha.gov",
      is_active: true,
      trust_level: "high",
    })).toBe(false);

    expect(isAllowedApprovedSourceRow({
      source_url: "https://example.com/safety",
      domain: "osha.gov",
      is_active: true,
      trust_level: "high",
    })).toBe(false);

    expect(isAllowedApprovedSourceRow({
      source_url: "https://www.osha.gov/laws-regs",
      domain: "osha.gov",
      is_active: true,
      trust_level: "blocked",
    })).toBe(false);

    expect(isAllowedApprovedSourceRow({
      source_url: "https://127.0.0.1/admin",
      domain: "127.0.0.1",
      is_active: true,
      trust_level: "high",
    })).toBe(false);

    expect(isAllowedApprovedSourceRow({
      source_url: "https://169.254.169.254/latest/meta-data",
      domain: "169.254.169.254",
      is_active: true,
      trust_level: "high",
    })).toBe(false);
  });

  it("creates learning batches without writing trusted graph rows when no candidates are available", async () => {
    const writes: Array<{ table: string; value: unknown }> = [];
    const db = {
      from(table: string) {
        return {
          select() {
            const chain = {
              order: () => chain,
              limit: () => chain,
              eq: () => chain,
              gte: () => chain,
              neq: () => chain,
              or: () => chain,
              in: () => chain,
              maybeSingle: () => Promise.resolve({ data: { id: "company-1", status: "active", is_active: true }, error: null }),
              then(resolve: (value: unknown) => void) {
                resolve({ data: [], error: null, count: 0 });
              },
            };
            return chain;
          },
          insert(value: unknown) {
            writes.push({ table, value });
            const chain = {
              select: () => chain,
              single: () => Promise.resolve({ data: { id: "batch-1" }, error: null }),
              then(resolve: (value: unknown) => void) {
                resolve({ data: [{ id: "inserted" }], error: null });
              },
            };
            return chain;
          },
          update(value: unknown) {
            writes.push({ table, value });
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      },
    };

    const result = await runAiKnowledgeLearningCheck(db as never, {
      trigger: "manual",
      force: true,
      companyId: "company-1",
      maxDocuments: 1,
      maxInternetSources: 1,
    });

    expect(result.candidatesCreated).toBe(0);
    expect(writes.some((write) => write.table === "ai_knowledge_nodes" || write.table === "ai_knowledge_edges" || write.table === "ai_vector_memory")).toBe(false);
    expect(writes.some((write) => write.table === "ai_knowledge_ingest_batches")).toBe(true);
  });
});
