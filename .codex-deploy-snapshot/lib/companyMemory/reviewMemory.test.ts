import { afterEach, describe, expect, it, vi } from "vitest";

const retrieveMock = vi.fn();

vi.mock("@/lib/companyMemory/repository", () => ({
  retrieveMemoryForQuery: (...args: unknown[]) => retrieveMock(...args),
}));

import {
  gatherCompanyMemoryExcerptsForReview,
  isCompanyMemoryForReviewsEnabled,
} from "@/lib/companyMemory/reviewMemory";

const ORIGINAL_FLAG = process.env.COMPANY_AI_MEMORY_FOR_REVIEWS;

afterEach(() => {
  retrieveMock.mockReset();
  if (ORIGINAL_FLAG === undefined) {
    delete process.env.COMPANY_AI_MEMORY_FOR_REVIEWS;
  } else {
    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = ORIGINAL_FLAG;
  }
});

describe("isCompanyMemoryForReviewsEnabled", () => {
  it("is gated to the literal string '1'", () => {
    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = "1";
    expect(isCompanyMemoryForReviewsEnabled()).toBe(true);

    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = "true";
    expect(isCompanyMemoryForReviewsEnabled()).toBe(false);

    delete process.env.COMPANY_AI_MEMORY_FOR_REVIEWS;
    expect(isCompanyMemoryForReviewsEnabled()).toBe(false);
  });
});

describe("gatherCompanyMemoryExcerptsForReview", () => {
  const supabase = {} as never;

  it("skips work when the flag is off", async () => {
    delete process.env.COMPANY_AI_MEMORY_FOR_REVIEWS;
    const res = await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "c1",
      query: "fall protection",
    });
    expect(res).toEqual({ excerpts: null, method: "skipped", chunkCount: 0 });
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("skips work when companyId is missing even with flag on", async () => {
    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = "1";
    const res = await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "",
      query: "fall protection",
    });
    expect(res.method).toBe("skipped");
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("formats chunks in the same shape as the customer ai-assist route", async () => {
    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = "1";
    retrieveMock.mockResolvedValue({
      method: "semantic",
      chunks: [
        { source: "policy", title: "Fall Protection SOP", body: "Use 100% tie-off above 6 feet." },
        { source: "incident", title: "2024 Roof Slip", body: "Crew slipped on wet membrane." },
      ],
    });

    const res = await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "company-1",
      query: "fall protection roofing",
    });

    expect(res.method).toBe("semantic");
    expect(res.chunkCount).toBe(2);
    expect(res.excerpts).toContain("[1] (policy) Fall Protection SOP");
    expect(res.excerpts).toContain("[2] (incident) 2024 Roof Slip");
    expect(res.excerpts).toContain("Use 100% tie-off above 6 feet.");

    const callArgs = retrieveMock.mock.calls[0];
    expect(callArgs[1]).toBe("company-1");
    expect(callArgs[2]).toContain("fall protection roofing");
    expect(callArgs[2]).toContain("construction safety site program PPE");
    expect(callArgs[3]).toEqual({ topK: 8 });
  });

  it("respects forceEnabled even when the env flag is off", async () => {
    delete process.env.COMPANY_AI_MEMORY_FOR_REVIEWS;
    retrieveMock.mockResolvedValue({
      method: "keyword",
      chunks: [{ source: "policy", title: "x", body: "y" }],
    });

    const res = await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "c1",
      query: "anything",
      forceEnabled: true,
    });

    expect(res.method).toBe("keyword");
    expect(res.chunkCount).toBe(1);
    expect(retrieveMock).toHaveBeenCalledTimes(1);
  });

  it("returns excerpts=null when retrieval finds nothing", async () => {
    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = "1";
    retrieveMock.mockResolvedValue({ method: "none", chunks: [] });

    const res = await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "company-1",
      query: "fall protection",
    });

    expect(res).toEqual({ excerpts: null, method: "none", chunkCount: 0 });
  });

  it("clamps topK between 1 and 16", async () => {
    process.env.COMPANY_AI_MEMORY_FOR_REVIEWS = "1";
    retrieveMock.mockResolvedValue({ method: "none", chunks: [] });

    await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "c1",
      query: "x",
      topK: 100,
    });
    expect(retrieveMock.mock.calls[0][3]).toEqual({ topK: 16 });

    retrieveMock.mockClear();
    await gatherCompanyMemoryExcerptsForReview({
      supabase,
      companyId: "c1",
      query: "x",
      topK: 0,
    });
    expect(retrieveMock.mock.calls[0][3]).toEqual({ topK: 1 });
  });
});
