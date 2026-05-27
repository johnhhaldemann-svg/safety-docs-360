import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedUpdateItem,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedUpdateItem: vi.fn(),
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
  updateOwnerManualReviewItem: mockedUpdateItem,
  validateOwnerManualReviewUpdateInput: (value: unknown) => value,
}));

import { PATCH } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/manual-review/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedUpdateItem.mockResolvedValue({
      item: { id: "item-1", status: "passed" },
      ownerVisualReviewStatus: "passed",
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/owner-validation/manual-review/item-1", {
          method: "PATCH",
          body: JSON.stringify({ status: "passed", notes: "Looks good." }),
        }),
        { params: Promise.resolve({ id: "item-1" }) }
      )
    );

    expect(response.status).toBe(403);
    expect(mockedUpdateItem).not.toHaveBeenCalled();
  });

  it("updates manual review items for super admins", async () => {
    const client = { from: vi.fn() };
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));
    mockedCreateAdmin.mockReturnValue(client);

    const response = requireRouteResponse(
      await PATCH(
        new Request("https://example.com/api/superadmin/owner-validation/manual-review/item-1", {
          method: "PATCH",
          body: JSON.stringify({ status: "passed", notes: "Looks good." }),
        }),
        { params: Promise.resolve({ id: "item-1" }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ownerVisualReviewStatus).toBe("passed");
    expect(mockedUpdateItem).toHaveBeenCalledWith({
      client,
      itemId: "item-1",
      actorUserId: "user-1",
      status: "passed",
      notes: "Looks good.",
    });
  });
});
