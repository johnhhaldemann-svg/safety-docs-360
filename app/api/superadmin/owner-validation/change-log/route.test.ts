import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  mockedAuthorize,
  mockedCreateAdmin,
  mockedLoadChanges,
  mockedRecordChange,
} = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedLoadChanges: vi.fn(),
  mockedRecordChange: vi.fn(),
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

vi.mock("@/lib/superadmin/ownerChangeLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/superadmin/ownerChangeLog")>();
  return {
    ...actual,
    loadOwnerChangeLogEntries: mockedLoadChanges,
    recordOwnerChangeLogEntry: mockedRecordChange,
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

describe("/api/superadmin/owner-validation/change-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedLoadChanges.mockResolvedValue([
      {
        id: "change-1",
        module_name: "Owner Validation Console",
      },
    ]);
    mockedRecordChange.mockResolvedValue({
      id: "change-2",
      module_name: "Documents",
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/change-log"))
    );

    expect(response.status).toBe(403);
    expect(mockedLoadChanges).not.toHaveBeenCalled();
  });

  it("loads changes for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/superadmin/owner-validation/change-log"))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.changes[0].module_name).toBe("Owner Validation Console");
    expect(mockedLoadChanges).toHaveBeenCalledWith(expect.any(Object));
  });

  it("records changes for super admins", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));

    const response = requireRouteResponse(
      await POST(
        new Request("https://example.com/api/superadmin/owner-validation/change-log", {
          method: "POST",
          body: JSON.stringify({
            moduleName: "Documents",
            plainEnglishDescription: "Document export was updated.",
          }),
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.change.module_name).toBe("Documents");
    expect(mockedRecordChange).toHaveBeenCalledWith({
      client: expect.any(Object),
      createdBy: "user-1",
      input: expect.objectContaining({
        moduleName: "Documents",
        plainEnglishDescription: "Document export was updated.",
      }),
    });
  });
});
