import { describe, expect, it } from "vitest";
import { countBatchCandidatesForDisplay } from "@/components/ai-knowledge-map/CandidateReviewPanel";

describe("CandidateReviewPanel learning batch counts", () => {
  it("uses actual loaded candidates when stored batch counts are stale", () => {
    const counts = countBatchCandidatesForDisplay(
      { id: "batch-1", candidateCounts: { totalCandidates: 0, failedSourceCandidates: 0, skippedSources: 0 } },
      [
        { batchId: "batch-1", candidateType: "node" },
        { batchId: "batch-1", candidateType: "failed_source" },
        { batchId: "batch-2", candidateType: "node" },
      ],
    );

    expect(counts).toEqual({
      totalCandidates: 2,
      failedSourceCandidates: 1,
      skippedSources: 0,
    });
  });

  it("keeps stored skipped counts when there are no loaded skipped candidate rows", () => {
    const counts = countBatchCandidatesForDisplay(
      { id: "batch-1", candidateCounts: { totalCandidates: 1, failedSourceCandidates: 0, skippedSources: 3 } },
      [{ batchId: "batch-1", candidateType: "node" }],
    );

    expect(counts.skippedSources).toBe(3);
  });
});
