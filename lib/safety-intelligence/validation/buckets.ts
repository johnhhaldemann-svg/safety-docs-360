import type { BucketedWorkItem, RawTaskInput } from "@/types/safety-intelligence";

export function buildBucketKey(input: RawTaskInput) {
  return `${input.sourceModule}:${input.sourceId ?? input.taskCode ?? input.taskTitle.toLowerCase().replace(/\s+/g, "_")}`;
}

export function ensureBucketReady(bucket: BucketedWorkItem) {
  if (!bucket.taskTitle.trim()) {
    throw new Error("Bucketed work item is missing task title.");
  }
  if (!bucket.companyId.trim()) {
    throw new Error("Bucketed work item is missing company id.");
  }
}
