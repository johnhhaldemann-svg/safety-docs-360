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
  resetDemoCompany: vi.fn(),
}));

import { POST } from "./route";
import { resetDemoCompany } from "@/lib/demoCompanySeed";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

function expectResponse(res: Response | undefined) {
  if (!res) throw new Error("missing response");
  return res;
}

describe("/api/demo/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "no" }, { status: 401 }),
    } as never);

    const res = expectResponse(await POST(new Request("http://localhost/api/demo/reset", { method: "POST" })));
    expect(res.status).toBe(401);
  });

  it("resets the actor demo company", async () => {
    const admin = { from: vi.fn() };
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      user: { id: "user-1", email: "user@example.com" },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    vi.mocked(resetDemoCompany).mockResolvedValue({
      companyId: "demo-company",
      restoredCompanyId: "prod-company",
      deletedDemoCompany: true,
    });

    const res = expectResponse(await POST(new Request("http://localhost/api/demo/reset", { method: "POST" })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.restoredCompanyId).toBe("prod-company");
    expect(resetDemoCompany).toHaveBeenCalledWith({ supabase: admin, actorUserId: "user-1" });
  });
});
