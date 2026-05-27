import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedUpdateGate,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedUpdateGate: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mockedAuthorize,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mockedCreateAdmin,
}));

vi.mock("@/lib/superadmin/ownerValidation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/superadmin/ownerValidation")>();
  return {
    ...actual,
    loadOwnerValidationOverview: vi.fn(),
    updateOwnerCustomerReadyGate: mockedUpdateGate,
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

describe("/api/superadmin/owner-validation/customer-ready-gates/[moduleKey]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedUpdateGate.mockResolvedValue({
      gate: {
        module_key: "jsa_builder",
        customer_ready_status: "Approved for customer use",
      },
      approved: true,
      blockingReason: null,
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/owner-validation/customer-ready-gates/jsa_builder", {
          method: "PATCH",
          body: JSON.stringify({ customerReadyStatus: "Approved for customer use" }),
        }),
        { params: Promise.resolve({ moduleKey: "jsa_builder" }) }
      )
    );

    expect(response.status).toBe(403);
    expect(mockedUpdateGate).not.toHaveBeenCalled();
  });

  it("updates a customer-ready gate for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/owner-validation/customer-ready-gates/jsa_builder", {
          method: "PATCH",
          body: JSON.stringify({ customerReadyStatus: "Approved for customer use" }),
        }),
        { params: Promise.resolve({ moduleKey: "jsa_builder" }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.approved).toBe(true);
    expect(mockedUpdateGate).toHaveBeenCalledWith({
      client: expect.any(Object),
      moduleKey: "jsa_builder",
      actorUserId: "user-1",
      customerReadyStatus: "Approved for customer use",
    });
  });
});
