import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertCompanyMemoryItem, updateCompanyMemoryItem } from "@/lib/companyMemory/repository";

const createEmbeddingMock = vi.hoisted(() => vi.fn());
const serverLogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/companyMemory/embed", () => ({
  createEmbedding: createEmbeddingMock,
}));

vi.mock("@/lib/serverLog", () => ({
  serverLog: serverLogMock,
}));

function createSupabaseMock() {
  const inserted = {
    id: "memory-1",
    company_id: "company-1",
    title: "Initial title",
    body: "Initial body",
  };

  return {
    from: vi.fn((table: string) => {
      if (table !== "company_memory_items") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: inserted.id }, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: inserted, error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      };
    }),
  };
}

describe("company memory repository", () => {
  beforeEach(() => {
    createEmbeddingMock.mockReset();
    serverLogMock.mockReset();
  });

  it("keeps the inserted memory item even if embedding generation fails", async () => {
    createEmbeddingMock.mockRejectedValueOnce(new Error("embedding offline"));

    const supabase = createSupabaseMock();
    const result = await insertCompanyMemoryItem(supabase as never, {
      companyId: "company-1",
      source: "manual",
      title: "Lockout procedure",
      body: "Always verify isolation.",
      userId: "user-1",
    });

    expect(result).toEqual({ id: "memory-1" });
    expect(serverLogMock).toHaveBeenCalledWith(
      "warn",
      "company_memory_embedding_failed",
      expect.objectContaining({
        companyId: "company-1",
        itemId: "memory-1",
        operation: "insert",
      })
    );
  });

  it("keeps the updated memory item even if re-embedding fails", async () => {
    createEmbeddingMock.mockRejectedValueOnce(new Error("embedding offline"));

    const supabase = createSupabaseMock();
    const result = await updateCompanyMemoryItem(supabase as never, {
      companyId: "company-1",
      id: "memory-1",
      body: "Updated guidance",
    });

    expect(result).toEqual({});
    expect(serverLogMock).toHaveBeenCalledWith(
      "warn",
      "company_memory_embedding_failed",
      expect.objectContaining({
        companyId: "company-1",
        itemId: "memory-1",
        operation: "update",
      })
    );
  });
});
