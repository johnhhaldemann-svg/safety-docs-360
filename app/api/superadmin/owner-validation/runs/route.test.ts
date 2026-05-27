import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedEnsureDefaults,
  mockedRecordRun,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedEnsureDefaults: vi.fn(),
  mockedRecordRun: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mockedAuthorize,
  normalizeAppRole: (role: string) => role,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mockedCreateAdmin,
}));

vi.mock("@/lib/superadmin/ownerValidation", () => ({
  ensureDefaultOwnerValidationModules: mockedEnsureDefaults,
  loadOwnerValidationOverview: vi.fn(),
  recordOwnerValidationRun: mockedRecordRun,
  validateOwnerValidationRunInput: (value: unknown) => value,
}));

import { GET, POST } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

function createRunsClient() {
  const limit = vi.fn().mockResolvedValue({ data: [{ id: "run-1" }], error: null });
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));

  return { client: { from }, from, select, order, limit };
}

describe("/api/superadmin/owner-validation/runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnsureDefaults.mockResolvedValue(undefined);
    mockedRecordRun.mockResolvedValue({
      run: { id: "run-1" },
      checks: [],
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/superadmin/owner-validation/runs", {
          method: "POST",
          body: JSON.stringify({}),
        })
      )
    );

    expect(response.status).toBe(403);
    expect(mockedRecordRun).not.toHaveBeenCalled();
  });

  it("lists recent owner validation runs for super admins", async () => {
    const { client } = createRunsClient();
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));
    mockedCreateAdmin.mockReturnValue(client);

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/runs"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.runs).toEqual([{ id: "run-1" }]);
  });

  it("records validation runs for super admins", async () => {
    const client = { from: vi.fn() };
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));
    mockedCreateAdmin.mockReturnValue(client);

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/superadmin/owner-validation/runs", {
          method: "POST",
          body: JSON.stringify({
            overallStatus: "green",
            checks: [],
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.run.id).toBe("run-1");
    expect(mockedEnsureDefaults).toHaveBeenCalledWith(client);
    expect(mockedRecordRun).toHaveBeenCalledWith({
      client,
      startedBy: "user-1",
      input: { overallStatus: "green", checks: [] },
    });
  });
});
