import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({
  getCompanyScope,
  normalizeWorkspaceUuid: (value: string) => String(value ?? "").trim().toLowerCase(),
}));

import { GET } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.limit.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

function fetchPayload(path: string) {
  if (path.includes("/api/company/permits")) {
    return {
      permits: [
        {
          id: "permit-1",
          jobsite_id: "jobsite-1",
          title: "Energized panel work",
          permit_type: "electrical",
          risk_level: "critical",
          stop_work_status: "stop_work",
          created_at: "2026-05-25T10:00:00.000Z",
        },
      ],
    };
  }
  if (path.includes("/api/company/incidents")) return { incidents: [] };
  if (path.includes("/api/company/corrective-actions")) return { actions: [] };
  if (path.includes("/api/company/jsa-activities")) return { activities: [] };
  if (path.includes("/api/company/jsas")) return { jsas: [] };
  if (path.includes("/api/company/reports")) return { reports: [] };
  if (path.includes("/api/company/users")) return { users: [] };
  if (path.includes("/api/workspace/documents")) return { documents: [] };
  if (path.includes("/api/company/analytics/summary")) return { summary: { jobsiteRiskScore: [] } };
  if (path.includes("/api/company/jobsite-assignments")) return { assignments: [] };
  return {};
}

describe("/api/jobsites/[jobsiteId]/[surface]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const path = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => fetchPayload(path),
      } as Response;
    });
  });

  it("includes Top 10 jobsite risks in the overview payload", async () => {
    authWithBuilders([
      queryBuilder({
        data: { id: "jobsite-1", company_id: "company-1", name: "Main site", status: "active" },
        error: null,
      }),
      queryBuilder({ data: null, error: null }),
      queryBuilder({
        data: [
          {
            id: "schedule-1",
            title: "Roof edge work",
            risk_level: "high",
            hazard_categories: ["fall_protection"],
            created_at: "2026-05-25T10:00:00.000Z",
          },
        ],
        error: null,
      }),
    ]);

    const response = requireRouteResponse(await GET(
      new Request("https://example.com/api/jobsites/jobsite-1/overview"),
      { params: Promise.resolve({ jobsiteId: "jobsite-1", surface: "overview" }) }
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.launchReadiness).toMatchObject({
      status: "hold",
    });
    expect(body.launchReadiness.stations.map((station: { label: string }) => station.label)).toContain("Emergency");
    expect(body.launchReadiness.stations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Risk", status: "hold" }),
      ])
    );
    expect(body.topJobsiteRisks).toHaveLength(10);
    expect(body.topJobsiteRisks[0]).toMatchObject({
      id: "electrical_exposure",
      riskLevel: "critical",
    });
    expect(body.topJobsiteRisks.map((risk: { id: string }) => risk.id)).toContain("falls_from_elevation");
  });

  it("does not expose a jobsite outside the current company scope", async () => {
    authWithBuilders([
      queryBuilder({
        data: { id: "jobsite-1", company_id: "other-company", name: "Other site", status: "active" },
        error: null,
      }),
    ]);

    const response = requireRouteResponse(await GET(
      new Request("https://example.com/api/jobsites/jobsite-1/overview"),
      { params: Promise.resolve({ jobsiteId: "jobsite-1", surface: "overview" }) }
    ));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Jobsite not found");
  });
});
