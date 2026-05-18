import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, getCompanyScope, assertCompanyJobsiteAllowed, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  assertCompanyJobsiteAllowed: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyCapacity", () => ({ assertCompanyJobsiteAllowed }));

import { POST } from "./route";
import { PATCH } from "./[jobsiteId]/route";

function queryBuilder(result: { data?: unknown; error?: { code?: string | null; message?: string | null } | null; count?: number | null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    ilike: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.ilike.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
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
    team: null,
    user: { id: "user-1" },
    supabase: { from },
  });
  return from;
}

describe("/api/company/jobsites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    assertCompanyJobsiteAllowed.mockResolvedValue({ ok: true });
  });

  it("POST requires a jobsite number", async () => {
    authWithBuilders([]);

    const response = await POST(
      new Request("https://example.com/api/company/jobsites", {
        method: "POST",
        body: JSON.stringify({ name: "North Tower", projectNumber: "P-100" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Jobsite number is required." });
  });

  it("POST rejects duplicate jobsite numbers", async () => {
    authWithBuilders([
      queryBuilder({ count: 0, error: null }),
      queryBuilder({ count: 1, error: null }),
    ]);

    const response = await POST(
      new Request("https://example.com/api/company/jobsites", {
        method: "POST",
        body: JSON.stringify({ name: "North Tower", jobsiteNumber: "SITE-0001", projectNumber: "P-100" }),
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "A jobsite with this jobsite number already exists for your company.",
    });
  });

  it("POST stores distinct jobsite and project numbers", async () => {
    const insert = queryBuilder({
      data: { id: "jobsite-1", name: "North Tower", jobsite_number: "SITE-0001", project_number: "P-100" },
      error: null,
    });
    authWithBuilders([
      queryBuilder({ count: 0, error: null }),
      queryBuilder({ count: 0, error: null }),
      insert,
    ]);

    const response = await POST(
      new Request("https://example.com/api/company/jobsites", {
        method: "POST",
        body: JSON.stringify({ name: "North Tower", jobsiteNumber: "SITE-0001", projectNumber: "P-100" }),
      })
    );

    expect(response.status).toBe(200);
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        jobsite_number: "SITE-0001",
        project_number: "P-100",
      })
    );
  });

  it("PATCH rejects an empty jobsite number when supplied", async () => {
    authWithBuilders([
      queryBuilder({ data: { id: "jobsite-1", company_id: "company-1" }, error: null }),
    ]);

    const response = await PATCH(
      new Request("https://example.com/api/company/jobsites/jobsite-1", {
        method: "PATCH",
        body: JSON.stringify({ jobsiteNumber: " " }),
      }),
      { params: Promise.resolve({ jobsiteId: "jobsite-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Jobsite number cannot be empty." });
  });
});
