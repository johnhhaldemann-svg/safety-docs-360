import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  assertCompanyInviteAllowed,
  authorizeRequest,
  buildCompanyInviteSignupUrl,
  createSupabaseAdminClient,
  getCompanyScope,
  getSupabaseServerEnvStatus,
  sendCompanyInviteEmail,
} = vi.hoisted(() => ({
  assertCompanyInviteAllowed: vi.fn(),
  authorizeRequest: vi.fn(),
  buildCompanyInviteSignupUrl: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getCompanyScope: vi.fn(),
  getSupabaseServerEnvStatus: vi.fn(),
  sendCompanyInviteEmail: vi.fn(),
}));

vi.mock("@/lib/companySeats", () => ({ assertCompanyInviteAllowed }));
vi.mock("@/lib/companyScope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/companyScope")>("@/lib/companyScope");
  return { ...actual, getCompanyScope };
});
vi.mock("@/lib/inviteEmail", () => ({ buildCompanyInviteSignupUrl, sendCompanyInviteEmail }));
vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient,
  getSupabaseServerEnvStatus,
}));
vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest };
});

import { POST } from "./route";

describe("/api/company/users invite links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseAdminClient.mockReturnValue(null);
    getSupabaseServerEnvStatus.mockReturnValue({});
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    assertCompanyInviteAllowed.mockResolvedValue({ ok: true });
    buildCompanyInviteSignupUrl.mockReturnValue("https://app.test/login?mode=signup&invite=company&email=worker%40example.com");
    sendCompanyInviteEmail.mockResolvedValue({ sent: true });
  });

  it("returns a copyable inviteUrl while preserving email invite behavior", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: "invite-1",
        email: "worker@example.com",
        role: "field_user",
        team: "Builder Co",
        company_id: "company-1",
        account_status: "pending",
      }],
      error: null,
    });
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: "Builder Co",
      user: { id: "user-1", email: "admin@example.com" },
      supabase: { rpc },
    });

    const response = requireRouteResponse(await POST(new Request("https://example.com/api/company/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "worker@example.com", role: "Field User" }),
    })));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.inviteUrl).toContain("mode=signup");
    expect(sendCompanyInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ toEmail: "worker@example.com" }));
  });
});
