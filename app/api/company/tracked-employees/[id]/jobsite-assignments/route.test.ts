import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  canMutateCompanyTrainingRequirements,
  createSupabaseAdminClient,
  getCompanyScope,
  isCompanyRole,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  canMutateCompanyTrainingRequirements: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getCompanyScope: vi.fn(),
  isCompanyRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isCompanyRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyTrainingAccess", () => ({ canMutateCompanyTrainingRequirements }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));

import { PUT } from "./route";

function queryBuilder(result: { data?: unknown; error?: { message?: string | null } | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

function authWithBuilders(builders: ReturnType<typeof queryBuilder>[]) {
  const from = vi.fn(() => {
    const next = builders.shift();
    if (!next) throw new Error("Unexpected Supabase call");
    return next;
  });
  authorizeRequest.mockResolvedValue({
    role: "company_admin",
    team: "Builder Co",
    user: { id: "admin-1" },
    permissionMap: { can_access_training: true },
    supabase: { from },
  });
  createSupabaseAdminClient.mockReturnValue(null);
  return from;
}

function request(body: unknown) {
  return new Request("https://example.com/api/company/tracked-employees/employee-1/jobsite-assignments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/company/tracked-employees/[id]/jobsite-assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMutateCompanyTrainingRequirements.mockReturnValue(true);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    isCompanyRole.mockReturnValue(true);
  });

  it("rejects viewers who cannot mutate tracked employees", async () => {
    canMutateCompanyTrainingRequirements.mockReturnValue(false);
    authWithBuilders([]);

    const response = requireRouteResponse(
      await PUT(request({ jobsiteIds: ["site-1"] }), { params: Promise.resolve({ id: "employee-1" }) })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Only company admins, managers, and safety managers can assign tracked employees to jobsites.",
    });
  });

  it("rejects archived tracked employees", async () => {
    authWithBuilders([
      queryBuilder({ data: { id: "employee-1", status: "archived" }, error: null }),
    ]);

    const response = requireRouteResponse(
      await PUT(request({ jobsiteIds: ["site-1"] }), { params: Promise.resolve({ id: "employee-1" }) })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Archived tracked employees cannot be assigned to jobsites.",
    });
  });

  it("rejects tracked employees outside the company scope", async () => {
    authWithBuilders([
      queryBuilder({ data: null, error: null }),
    ]);

    const response = requireRouteResponse(
      await PUT(request({ jobsiteIds: ["site-1"] }), { params: Promise.resolve({ id: "employee-1" }) })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Tracked employee not found.",
    });
  });

  it("rejects invalid or foreign jobsites", async () => {
    authWithBuilders([
      queryBuilder({ data: { id: "employee-1", status: "active" }, error: null }),
      queryBuilder({ data: [{ id: "site-1" }], error: null }),
    ]);

    const response = requireRouteResponse(
      await PUT(request({ jobsiteIds: ["site-1", "foreign-site"] }), { params: Promise.resolve({ id: "employee-1" }) })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "One or more jobsites are invalid for this company scope.",
    });
  });

  it("archives removed assignments and inserts selected missing jobsites", async () => {
    const archive = queryBuilder({ data: null, error: null });
    const insert = queryBuilder({ data: null, error: null });
    authWithBuilders([
      queryBuilder({ data: { id: "employee-1", status: "active" }, error: null }),
      queryBuilder({ data: [{ id: "site-1" }, { id: "site-2" }], error: null }),
      queryBuilder({
        data: [
          { id: "assignment-old", jobsite_id: "old-site" },
          { id: "assignment-kept", jobsite_id: "site-1" },
        ],
        error: null,
      }),
      archive,
      insert,
    ]);

    const response = requireRouteResponse(
      await PUT(request({ jobsiteIds: ["site-1", "site-2"] }), { params: Promise.resolve({ id: "employee-1" }) })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      employeeId: "employee-1",
      assignedJobsiteCount: 2,
    });
    expect(archive.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "archived",
      archived_by: "admin-1",
      updated_by: "admin-1",
    }));
    expect(archive.in).toHaveBeenCalledWith("id", ["assignment-old"]);
    expect(insert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        company_id: "company-1",
        employee_id: "employee-1",
        jobsite_id: "site-2",
        status: "active",
      }),
    ]);
  });
});
