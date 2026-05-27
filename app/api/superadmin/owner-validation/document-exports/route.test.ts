import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const { mockedAuthorize, mockedCreateAdmin, mockedRunDocumentExportValidation } = vi.hoisted(() => ({
  mockedAuthorize: vi.fn(),
  mockedCreateAdmin: vi.fn(),
  mockedRunDocumentExportValidation: vi.fn(),
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

vi.mock("@/lib/superadmin/ownerDocumentExportValidation", () => ({
  runOwnerDocumentExportValidation: mockedRunDocumentExportValidation,
}));

import { POST } from "./route";

function authForRole(role: string) {
  return {
    role,
    supabase: { from: vi.fn() },
    user: { id: "user-1" },
  } as never;
}

describe("/api/superadmin/owner-validation/document-exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdmin.mockReturnValue({ from: vi.fn() });
    mockedRunDocumentExportValidation.mockResolvedValue({
      overallStatus: "green",
      overallScore: 100,
      summary: "Document export validation generated sandbox Word and PDF files.",
      passedCount: 5,
      warningCount: 0,
      failedCount: 0,
      checks: [],
      run: { run: { id: "run-1" }, checks: [] },
    });
  });

  it("rejects non-superadmin users", async () => {
    mockedAuthorize.mockResolvedValue(authForRole("admin"));

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/owner-validation/document-exports", { method: "POST" }))
    );

    expect(response.status).toBe(403);
    expect(mockedRunDocumentExportValidation).not.toHaveBeenCalled();
  });

  it("runs document export validation for super admins", async () => {
    const client = { from: vi.fn() };
    mockedAuthorize.mockResolvedValue(authForRole("super_admin"));
    mockedCreateAdmin.mockReturnValue(client);

    const response = requireRouteResponse(
      await POST(new Request("https://example.com/api/superadmin/owner-validation/document-exports", { method: "POST" }))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.summary).toContain("Document export validation");
    expect(mockedRunDocumentExportValidation).toHaveBeenCalledWith({
      client,
      startedBy: "user-1",
    });
  });
});
