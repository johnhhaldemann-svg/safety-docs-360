import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedLoadOverview,
  mockedRunValidation,
  mockedSaveTestCase,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedLoadOverview: vi.fn(),
  mockedRunValidation: vi.fn(),
  mockedSaveTestCase: vi.fn(),
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

vi.mock("@/lib/superadmin/ownerGusValidation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/superadmin/ownerGusValidation")>();
  return {
    ...actual,
    loadOwnerGusValidationOverview: mockedLoadOverview,
    runOwnerGusValidation: mockedRunValidation,
    saveOwnerGusValidationTestCase: mockedSaveTestCase,
  };
});

import { GET, POST } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/gus-validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedLoadOverview.mockResolvedValue({
      testCases: [{ id: "case-1", title: "Hot work", scenario: "Hot work", expected_focus: [] }],
      recentResults: [],
      sourceRules: [],
    });
    mockedRunValidation.mockResolvedValue({
      result: { id: "result-1", scenario: "Hot work", gus_response: "Needs review." },
    });
    mockedSaveTestCase.mockResolvedValue({
      id: "case-2",
      title: "Custom",
      scenario: "Custom scenario",
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/gus-validation"))
    );

    expect(response.status).toBe(403);
    expect(mockedLoadOverview).not.toHaveBeenCalled();
  });

  it("loads Gus validation overview for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/gus-validation"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.testCases[0].title).toBe("Hot work");
  });

  it("runs a Gus validation scenario for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/superadmin/owner-validation/gus-validation", {
          method: "POST",
          body: JSON.stringify({ scenario: "Crew is doing hot work.", testCaseId: "case-1" }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.result.id).toBe("result-1");
    expect(mockedRunValidation).toHaveBeenCalledWith({
      client: expect.any(Object),
      actorUserId: "user-1",
      scenario: "Crew is doing hot work.",
      testCaseId: "case-1",
    });
  });

  it("saves custom Gus validation scenarios", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/superadmin/owner-validation/gus-validation", {
          method: "POST",
          body: JSON.stringify({
            action: "save_test_case",
            title: "Custom",
            scenario: "Custom scenario",
            expectedFocus: ["draft only"],
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.testCase.title).toBe("Custom");
    expect(mockedSaveTestCase).toHaveBeenCalledWith({
      client: expect.any(Object),
      actorUserId: "user-1",
      title: "Custom",
      scenario: "Custom scenario",
      expectedFocus: ["draft only"],
    });
  });
});
