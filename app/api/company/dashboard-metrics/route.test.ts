import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/companyScope", () => ({
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/csepApiGuard", () => ({
  companyHasCsepPlanName: vi.fn(),
  csepWorkspaceForbiddenResponse: vi.fn(() =>
    NextResponse.json({ error: "csep" }, { status: 403 })
  ),
}));

vi.mock("@/lib/jobsiteAccess", () => ({
  getJobsiteAccessScope: vi.fn(),
}));

import { GET } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { companyHasCsepPlanName, csepWorkspaceForbiddenResponse } from "@/lib/csepApiGuard";
import { getJobsiteAccessScope } from "@/lib/jobsiteAccess";

describe("/api/company/dashboard-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns demo metrics for sales_demo", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "sales_demo",
      team: "Demo",
      user: { id: "demo-user-1" },
      supabase: {},
    } as never);

    const res = await GET(new Request("http://localhost/api/company/dashboard-metrics?days=14"));
    if (!res) throw new Error("missing response");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.windowDays).toBe(14);
    expect(body.metrics.sorReportsCount).toBeGreaterThan(0);
    expect(body.definitions).toBeTruthy();
  });

  it("returns 403 for CSEP-only workspace", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: { from: vi.fn() },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "c1" } as never);
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(true);
    vi.mocked(csepWorkspaceForbiddenResponse).mockReturnValue(
      NextResponse.json({ error: "csep blocked" }, { status: 403 })
    );

    const res = await GET(new Request("http://localhost/api/company/dashboard-metrics"));
    if (!res) throw new Error("missing response");
    expect(res.status).toBe(403);
    expect(companyHasCsepPlanName).toHaveBeenCalled();
  });

  it("sets jobsiteScoped when field_supervisor has assignment scope", async () => {
    const ok = { count: 0, error: null };

    function chainWithIn() {
      const b = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        gte: vi.fn(),
      };
      b.select.mockReturnValue(b);
      b.eq.mockReturnValue(b);
      b.in.mockReturnValue(b);
      b.gte.mockResolvedValue(ok);
      return b;
    }

    const sorB = { select: vi.fn(), eq: vi.fn(), gte: vi.fn() };
    sorB.select.mockReturnValue(sorB);
    sorB.eq.mockReturnValue(sorB);
    sorB.gte.mockResolvedValue(ok);

    const contractorsB = { select: vi.fn(), eq: vi.fn() };
    contractorsB.select.mockReturnValue(contractorsB);
    contractorsB.eq.mockReturnValue(contractorsB);
    Object.assign(contractorsB, {
      then(onFulfilled: (value: unknown) => unknown) {
        return Promise.resolve(ok).then(onFulfilled);
      },
    });

    const trainingB = { select: vi.fn(), eq: vi.fn() };
    trainingB.select.mockReturnValue(trainingB);
    trainingB.eq.mockReturnValue(trainingB);
    Object.assign(trainingB, {
      then(onFulfilled: (value: unknown) => unknown) {
        return Promise.resolve(ok).then(onFulfilled);
      },
    });

    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "company_sor_records") return sorB;
      if (table === "company_contractors") return contractorsB;
      if (table === "company_training_requirements") return trainingB;
      return chainWithIn();
    });

    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "field_supervisor",
      team: "Field",
      user: { id: "u-fs" },
      supabase: { from },
    } as never);
    vi.mocked(getCompanyScope).mockResolvedValue({ companyId: "co1" } as never);
    vi.mocked(companyHasCsepPlanName).mockResolvedValue(false);
    vi.mocked(getJobsiteAccessScope).mockResolvedValue({
      restricted: true,
      jobsiteIds: ["j1", "j2"],
    });

    const res = await GET(new Request("http://localhost/api/company/dashboard-metrics?days=30"));
    if (!res) throw new Error("missing response");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.jobsiteScoped).toBe(true);

    const scopedBuilder = from.mock.results.find((r) => r.value?.in)?.value as { in: ReturnType<typeof vi.fn> };
    expect(scopedBuilder?.in).toBeDefined();
    expect(scopedBuilder.in).toHaveBeenCalledWith("jobsite_id", ["j1", "j2"]);
  });
});
