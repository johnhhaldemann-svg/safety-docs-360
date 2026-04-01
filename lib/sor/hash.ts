import { createHash } from "node:crypto";

export type SorHashInput = {
  date: string;
  project: string;
  location: string;
  trade: string;
  category: string;
  subcategory?: string | null;
  description: string;
  severity: string;
  created_by: string | null;
  created_at: string;
  previous_hash?: string | null;
  version_number: number;
};

export function canonicalizeSorHashInput(input: SorHashInput): string {
  return JSON.stringify({
    date: input.date,
    project: input.project,
    location: input.location,
    trade: input.trade,
    category: input.category,
    subcategory: input.subcategory ?? null,
    description: input.description,
    severity: input.severity,
    created_by: input.created_by ?? null,
    created_at: input.created_at,
    previous_hash: input.previous_hash ?? null,
    version_number: input.version_number,
  });
}

export function computeSorHash(input: SorHashInput): string {
  return createHash("sha256").update(canonicalizeSorHashInput(input)).digest("hex");
}
