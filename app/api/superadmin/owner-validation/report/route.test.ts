import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { mockedAuthorize, mockedCreateAdmin, mockedLoadReport } = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedLoadReport: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mockedAuthorize,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mockedCreateAdmin,
}));

vi.mock("@/lib/superadmin/ownerValidation", () => ({
  loadOwnerValidationOverview: vi.fn(),
}));

vi.mock("@/lib/superadmin/ownerProofReport", () => ({
  loadOwnerProofReport: mockedLoadReport,
}));

import { GET } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedLoadReport.mockResolvedValue({
      summary: {
        overallStatus: "yellow",
        overallStatusLabel: "Needs review",
        overallScore: 82,
        testedAt: "2026-05-27T10:00:00.000Z",
        testedBy: "user-1",
        safeToDemo: "Needs Review",
        safeForCustomerUse: "Needs Review",
        plainEnglishSummary: "Owner review is still required.",
      },
      modulesPassed: [],
      modulesNeedingReview: [],
      modulesFailed: [],
      modulesNotTested: [],
      customerReadyModules: [],
      blockedModules: [],
      manualChecklist: {
        totalRequired: 0,
        passedRequired: 0,
        needsReview: 0,
        failed: 0,
        completionPercent: 0,
      },
      recentChanges: [],
      latestRun: null,
      latestRunChecks: [],
      topRisks: [],
      recommendedNextActions: [],
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/report"))
    );

    expect(response.status).toBe(403);
    expect(mockedLoadReport).not.toHaveBeenCalled();
  });

  it("returns the owner proof report for super admins", async () => {
    const client = { from: vi.fn() };
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));
    mockedCreateAdmin.mockReturnValue(client);

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/report"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report.summary.overallStatusLabel).toBe("Needs review");
    expect(mockedLoadReport).toHaveBeenCalledWith(client);
  });
});
