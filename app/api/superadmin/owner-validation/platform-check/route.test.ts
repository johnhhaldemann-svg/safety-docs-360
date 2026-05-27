import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { mockedAuthorize, mockedCreateAdmin, mockedRunPlatformCheck } = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedRunPlatformCheck: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mockedAuthorize,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mockedCreateAdmin,
}));

vi.mock("@/lib/superadmin/ownerValidationPlatformCheck", () => ({
  runOwnerPlatformCheck: mockedRunPlatformCheck,
}));

import { POST } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/platform-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedRunPlatformCheck.mockResolvedValue({
      overallStatus: "yellow",
      overallScore: 72,
      summary: "Platform check completed with owner-review warnings.",
      passedCount: 10,
      warningCount: 3,
      failedCount: 0,
      checks: [],
      run: { run: { id: "run-1" }, checks: [] },
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/owner-validation/platform-check", { method: "POST" }))
    );

    expect(response.status).toBe(403);
    expect(mockedRunPlatformCheck).not.toHaveBeenCalled();
  });

  it("runs the safe platform check for super admins", async () => {
    const client = { from: vi.fn() };
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));
    mockedCreateAdmin.mockReturnValue(client);

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/owner-validation/platform-check", { method: "POST" }))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.summary).toContain("Platform check completed");
    expect(mockedRunPlatformCheck).toHaveBeenCalledWith({
      client,
      startedBy: "user-1",
    });
  });
});
