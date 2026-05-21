import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: vi.fn((role: string) => role === "admin" || role === "super_admin" || role === "platform_admin"),
  isCompanyRole: vi.fn((role: string) => role === "company_admin" || role === "manager" || role === "safety_manager"),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/demoCompanySeed", () => ({
  seedDemoCompany: vi.fn(),
}));

import { POST } from "./route";
import { seedDemoCompany } from "@/lib/demoCompanySeed";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function expectResponse(res: Response | undefined) {
  if (!res) throw new Error("missing response");
  return res;
}

describe("/api/demo/load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "no" }, { status: 401 }),
    } as never);

    const res = expectResponse(await POST(new Request("http://localhost/api/demo/load", { method: "POST" })));
    expect(res.status).toBe(401);
  });

  it("loads demo data through the server admin client", async () => {
    const admin = { from: vi.fn() };
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      user: { id: "user-1", email: "user@example.com" },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    vi.mocked(seedDemoCompany).mockResolvedValue({
      companyId: "demo-company",
      companyName: "Demo Construction",
      previousCompanyId: "prod-company",
      counts: {
        jobsites: 3,
        scheduleActivities: 6,
        permits: 4,
        jsas: 3,
        jsaActivities: 4,
        observations: 3,
        incidents: 3,
        correctiveActions: 3,
        trainingRequirements: 4,
        microsoftProjects: 3,
        microsoftTasks: 6,
      },
    });

    const res = expectResponse(await POST(new Request("http://localhost/api/demo/load", { method: "POST" })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.counts.jobsites).toBe(3);
    expect(seedDemoCompany).toHaveBeenCalledWith({
      supabase: admin,
      actorUserId: "user-1",
      actorEmail: "user@example.com",
    });
  });

  it("fails clearly when the service role key is missing", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      user: { id: "user-1", email: "user@example.com" },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null);

    const res = expectResponse(await POST(new Request("http://localhost/api/demo/load", { method: "POST" })));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
