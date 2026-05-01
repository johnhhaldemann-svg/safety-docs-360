import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260501120000_prediction_validation_queue.sql"),
  "utf8"
);

describe("prediction validation migration", () => {
  it("backfills existing source rows as approved before defaulting new rows to pending", () => {
    expect(migration).toContain("update public.company_sor_records");
    expect(migration).toContain("update public.company_incidents");
    expect(migration).toContain("prediction_validation_status = 'approved'");
    expect(migration).toContain("alter column prediction_validation_status set default 'pending'");
  });

  it("requires valid ratings and a rating for approved rows", () => {
    expect(migration).toContain("prediction_review_rating between 1 and 5");
    expect(migration).toContain("prediction_validation_status <> 'approved' or prediction_review_rating is not null");
  });

  it("keeps locked SOR content immutable while allowing prediction-review metadata", () => {
    expect(migration).toContain("Submitted/locked/superseded SOR rows are immutable except prediction-review metadata.");
    expect(migration).toContain("new.hazard_category_code is not distinct from old.hazard_category_code");
  });
});
