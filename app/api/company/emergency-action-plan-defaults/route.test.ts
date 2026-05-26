import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { authorizeRequest, getCompanyScope, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  isAdminRole,
  normalizeAppRole: vi.fn((role) => role),
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));

import { GET, PATCH } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.upsert.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[], role = "safety_manager") {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    role,
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

describe("/api/company/emergency-action-plan-defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
  });

  it("GET returns saved company EAP defaults", async () => {
    authWithBuilders([
      queryBuilder({
        data: {
          id: "defaults-1",
          company_id: "company-1",
          emergency_contact_name: "Safety Director",
          command_post_location: "Safety trailer",
        },
        error: null,
      }),
    ]);

    const response = requireRouteResponse(await GET(new Request("https://example.com/api/company/emergency-action-plan-defaults")));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.defaults).toMatchObject({
      emergency_contact_name: "Safety Director",
      command_post_location: "Safety trailer",
    });
  });

  it("PATCH saves structured defaults for later jobsite use", async () => {
    const saveBuilder = queryBuilder({
      data: {
        id: "defaults-1",
        company_id: "company-1",
        emergency_contact_name: "Safety Director",
        call_chain: [{ role: "Safety", name: "Safety Director", phone: "555-0100" }],
      },
      error: null,
    });
    authWithBuilders([saveBuilder]);

    const response = requireRouteResponse(await PATCH(new Request("https://example.com/api/company/emergency-action-plan-defaults", {
      method: "PATCH",
      body: JSON.stringify({
        emergencyContactName: "Safety Director",
        callChain: [{ role: "Safety", name: "Safety Director", phone: "555-0100" }],
      }),
    })));

    expect(response.status).toBe(200);
    expect(saveBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        emergency_contact_name: "Safety Director",
        call_chain: [{ role: "Safety", name: "Safety Director", phone: "555-0100", alternateName: null, alternatePhone: null, primaryName: null, primaryPhone: null, notes: null }],
      }),
      { onConflict: "company_id" }
    );
  });

  it("PATCH rejects field users", async () => {
    authWithBuilders([], "field_user");

    const response = requireRouteResponse(await PATCH(new Request("https://example.com/api/company/emergency-action-plan-defaults", {
      method: "PATCH",
      body: JSON.stringify({ emergencyContactName: "Safety Director" }),
    })));

    expect(response.status).toBe(403);
  });
});
