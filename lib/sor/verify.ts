import { computeSorHash } from "@/lib/sor/hash";
import type { SorRecordRow } from "@/lib/sor/types";

export type SorVerificationResult = "valid" | "invalid" | "broken_chain";

export function verifySorRecordHash(record: SorRecordRow): boolean {
  if (!record.record_hash) return false;
  const expected = computeSorHash({
    date: record.date,
    project: record.project,
    location: record.location,
    trade: record.trade,
    category: record.category,
    subcategory: record.subcategory,
    description: record.description,
    severity: record.severity,
    created_by: record.created_by,
    created_at: record.created_at,
    previous_hash: record.previous_hash,
    version_number: record.version_number,
  });
  return expected === record.record_hash;
}

export function verifySorChain(records: SorRecordRow[]): SorVerificationResult {
  if (records.length === 0) return "valid";
  const ordered = [...records].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (let i = 0; i < ordered.length; i += 1) {
    const rec = ordered[i];
    if (!verifySorRecordHash(rec)) return "invalid";
    if (i === 0) continue;
    const prev = ordered[i - 1];
    if (rec.previous_hash !== prev.record_hash) return "broken_chain";
  }
  return "valid";
}
