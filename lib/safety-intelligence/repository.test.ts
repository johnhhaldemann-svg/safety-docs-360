import { describe, expect, it, vi } from "vitest";
import { loadGeneratedDocumentDraft } from "./repository";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

/**
 * These tests focus on the tenant-scoping behavior of
 * `loadGeneratedDocumentDraft`. The function is usually called with a
 * service-role Supabase client, so the `.eq("company_id", ...)` filter is the
 * only thing preventing a cross-tenant draft leak. We verify:
 *
 *  1. Both `id` and `company_id` filters are applied on the query builder.
 *  2. Rows matching the caller's company are returned.
 *  3. Rows belonging to a different tenant surface a generic
 *     "Generated document not found." error instead of the raw draft (no row
 *     existence leak).
 *  4. An empty `companyId` argument is rejected without ever hitting the DB.
 */

type EqCall = { column: string; value: string };

function createFakeSupabase(row: Record<string, unknown> | null) {
  const eqCalls: EqCall[] = [];
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });

  const builder = {
    eq(column: string, value: string) {
      eqCalls.push({ column, value });
      return builder;
    },
    select() {
      return builder;
    },
    maybeSingle,
  };

  const from = vi.fn(() => builder);

  return {
    supabase: { from } as unknown as Parameters<typeof loadGeneratedDocumentDraft>[0],
    from,
    eqCalls,
    maybeSingle,
  };
}

const SAMPLE_DRAFT: GeneratedSafetyPlanDraft = {
  documentType: "csep",
  title: "Tenant A CSEP",
} as unknown as GeneratedSafetyPlanDraft;

describe("loadGeneratedDocumentDraft tenant scoping", () => {
  it("filters by both document id and company id", async () => {
    const fake = createFakeSupabase({
      id: "doc-1",
      company_id: "tenant-a",
      draft_json: SAMPLE_DRAFT,
    });

    await loadGeneratedDocumentDraft(fake.supabase, "doc-1", "tenant-a");

    expect(fake.from).toHaveBeenCalledWith("company_generated_documents");
    expect(fake.eqCalls).toEqual([
      { column: "id", value: "doc-1" },
      { column: "company_id", value: "tenant-a" },
    ]);
  });

  it("returns the draft_json payload when the row belongs to the caller's company", async () => {
    const fake = createFakeSupabase({
      id: "doc-1",
      company_id: "tenant-a",
      draft_json: SAMPLE_DRAFT,
    });

    const draft = await loadGeneratedDocumentDraft(
      fake.supabase,
      "doc-1",
      "tenant-a"
    );

    expect(draft).toBe(SAMPLE_DRAFT);
  });

  it("throws a generic not-found error when no row matches the tenant filter", async () => {
    // Simulates Supabase behavior when a row with id=doc-1 exists but belongs
    // to a different tenant: the .eq("company_id", "tenant-a") filter drops it
    // and .maybeSingle() returns { data: null }.
    const fake = createFakeSupabase(null);

    await expect(
      loadGeneratedDocumentDraft(fake.supabase, "doc-1", "tenant-a")
    ).rejects.toThrow("Generated document not found.");
  });

  it("rejects an empty companyId without issuing a query", async () => {
    const fake = createFakeSupabase({
      id: "doc-1",
      company_id: "tenant-a",
      draft_json: SAMPLE_DRAFT,
    });

    await expect(
      loadGeneratedDocumentDraft(fake.supabase, "doc-1", "")
    ).rejects.toThrow("Generated document not found.");

    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.maybeSingle).not.toHaveBeenCalled();
  });
});
