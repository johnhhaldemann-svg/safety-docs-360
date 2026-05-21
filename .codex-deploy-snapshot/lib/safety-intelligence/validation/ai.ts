import type { AiReviewContext } from "@/types/safety-intelligence";
import { isRecord } from "@/lib/safety-intelligence/validation/common";

export function assertAiReviewContextReady(context: AiReviewContext) {
  if (!context.buckets.length) {
    throw new Error("AI review requires at least one bucketed work item.");
  }
  if (!context.rulesEvaluations.length) {
    throw new Error("AI review requires rules-engine output.");
  }
  if (!context.conflictEvaluations.length) {
    throw new Error("AI review requires conflict-engine output.");
  }
}

export function parseAiReviewBody(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("AI review payload must be an object.");
  }
  return value;
}

