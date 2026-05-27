import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedUpdateResult,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedUpdateResult: vi.fn(),
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
    updateOwnerGusValidationResult: mockedUpdateResult,
  };
});

import { PATCH } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/gus-validation/results/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedUpdateResult.mockResolvedValue({
      id: "result-1",
      validation_status: "flagged",
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/owner-validation/gus-validation/results/result-1", {
          method: "PATCH",
          body: JSON.stringify({ status: "flagged" }),
        }),
        { params: Promise.resolve({ id: "result-1" }) }
      )
    );

    expect(response.status).toBe(403);
    expect(mockedUpdateResult).not.toHaveBeenCalled();
  });

  it("updates result status for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/owner-validation/gus-validation/results/result-1", {
          method: "PATCH",
          body: JSON.stringify({ status: "flagged", notes: "Unsupported claim" }),
        }),
        { params: Promise.resolve({ id: "result-1" }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.validation_status).toBe("flagged");
    expect(mockedUpdateResult).toHaveBeenCalledWith({
      client: expect.any(Object),
      resultId: "result-1",
      actorUserId: "user-1",
      status: "flagged",
      notes: "Unsupported claim",
    });
  });
});
