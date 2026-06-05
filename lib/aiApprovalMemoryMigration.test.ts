import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260605120000_ai_approval_memory.sql"),
  "utf8"
);

describe("ai approval memory migration", () => {
  it("creates the append-only memory bank table", () => {
    expect(migration).toContain("create table if not exists public.ai_approval_memory");
    expect(migration).toContain("decision text not null");
    expect(migration).toContain("surface text not null");
  });

  it("constrains the decision label and review surface", () => {
    expect(migration).toContain("decision in ('approved', 'rejected')");
    expect(migration).toContain("prediction_validation");
    expect(migration).toContain("knowledge_map_candidate");
    expect(migration).toContain("knowledge_map_relationship");
    expect(migration).toContain("rating is null or (rating between 1 and 5)");
  });

  it("is server-only: RLS enabled, access revoked from clients, granted to service_role", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.ai_approval_memory from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on public.ai_approval_memory to service_role");
  });
});

const surfacesMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260605130000_ai_approval_memory_surfaces.sql"),
  "utf8"
);

describe("ai approval memory surfaces (Tier 2 prep) migration", () => {
  it("widens the surface enum to the additional review surfaces", () => {
    expect(surfacesMigration).toContain("drop constraint if exists ai_approval_memory_surface_check");
    for (const surface of [
      "prediction_validation",
      "knowledge_map_candidate",
      "knowledge_map_relationship",
      "ai_improvement",
      "gus_learning_finding",
      "owner_validation",
      "document_review",
    ]) {
      expect(surfacesMigration).toContain(surface);
    }
  });
});
