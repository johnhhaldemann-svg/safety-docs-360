import { describe, expect, it, vi } from "vitest";
import {
  buildProductionIntegrationAudit,
  detectDuplicateCronPaths,
  maskSensitiveValue,
  summarizeIntegrationChecks,
  worstIntegrationStatus,
} from "@/lib/superadmin/integrationAudit";

function createAdmin(overrides: Record<string, { count?: number; error?: string | null }> = {}) {
  const from = vi.fn((table: string) => ({
    select: vi.fn(async () => ({
      count: overrides[table]?.count ?? 1,
      error: overrides[table]?.error ? { message: overrides[table]?.error } : null,
    })),
  }));

  return {
    from,
    storage: {
      listBuckets: vi.fn(async () => ({ data: [{ name: "documents" }], error: null })),
    },
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
      },
    },
  } as never;
}

describe("integration audit utilities", () => {
  it("aggregates statuses by severity", () => {
    expect(worstIntegrationStatus(["healthy", "unknown", "warning"])).toBe("warning");
    expect(worstIntegrationStatus(["healthy", "critical", "warning"])).toBe("critical");
    expect(worstIntegrationStatus([])).toBe("unknown");
  });

  it("summarizes check counts", () => {
    expect(
      summarizeIntegrationChecks([
        { status: "healthy" },
        { status: "warning" },
        { status: "warning" },
        { status: "critical" },
        { status: "unknown" },
      ])
    ).toEqual({ totalChecks: 5, healthy: 1, warning: 2, critical: 1, unknown: 1 });
  });

  it("masks secrets and database URLs", () => {
    expect(maskSensitiveValue("postgresql://postgres.ref:secret@db.example.com:5432/postgres")).toBe(
      "postgresql://postgres...:***@db.example.com:5432/postgres"
    );
    expect(maskSensitiveValue("sk-test-abcdefghijklmnop")).toBe("sk-t...mnop");
  });

  it("detects duplicate Vercel cron paths", () => {
    expect(
      detectDuplicateCronPaths([
        { path: "/api/cron/a", schedule: "0 1 * * *" },
        { path: "/api/cron/a", schedule: "0 2 * * *" },
        { path: "/api/cron/b", schedule: "0 3 * * *" },
      ])
    ).toEqual([{ path: "/api/cron/a", schedules: ["0 1 * * *", "0 2 * * *"] }]);
  });
});

describe("buildProductionIntegrationAudit", () => {
  it("builds a production map without exposing secrets", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mdqkfbnwxrasdmbsjcqv.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
    process.env.OPENAI_API_KEY = "openai-secret";

    const audit = await buildProductionIntegrationAudit({
      admin: createAdmin(),
      rootDir: process.cwd(),
      now: new Date("2026-05-26T20:00:00.000Z"),
      remoteMigrationVersions: ["20260526173110"],
      liveVercelAccessError: "403 Forbidden",
      knownAdvisorFindings: { notes: ["security advisor warning"] },
    });

    expect(audit.sourceOfTruth).toBe("production");
    expect(audit.project.supabaseRef).toBe("mdqkfbnwxrasdmbsjcqv");
    expect(audit.project.latestRemoteMigration).toBe("20260526173110");
    expect(audit.checks.some((check) => check.id === "vercel-live-access" && check.status === "warning")).toBe(true);
    expect(JSON.stringify(audit)).not.toContain("service-secret");
    expect(JSON.stringify(audit)).not.toContain("openai-secret");
  });

  it("marks missing workflow tables as critical", async () => {
    const audit = await buildProductionIntegrationAudit({
      admin: createAdmin({ company_jobsites: { error: "relation does not exist" } }),
      rootDir: process.cwd(),
      now: new Date("2026-05-26T20:00:00.000Z"),
      remoteMigrationVersions: ["20260526173110"],
    });

    const fieldWorkflow = audit.checks.find((check) => check.id === "workflow-field-operations");
    expect(fieldWorkflow?.status).toBe("critical");
    expect(fieldWorkflow?.recommendedAction).toContain("Apply missing migrations");
  });
});
