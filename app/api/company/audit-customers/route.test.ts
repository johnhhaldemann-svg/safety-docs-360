import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeRequest, getCompanyScope, isAdminRole } = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));

import { GET, POST } from "./route";

function queryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

describe("/api/company/audit-customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: null,
      user: { id: "user-1" },
      supabase: { from: vi.fn(() => queryBuilder({ data: [], error: null })) },
    });
  });

  it("GET returns active audit customers for the company", async () => {
    const builder = queryBuilder({
      data: [{ id: "cust-1", name: "Acme", report_email: "audit@acme.test" }],
      error: null,
    });
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      team: null,
      user: { id: "user-1" },
      supabase: { from: vi.fn(() => builder) },
    });

    const response = await GET(new Request("https://example.com/api/company/audit-customers"));
    if (!response) throw new Error("missing response");
    expect(response.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(builder.neq).toHaveBeenCalledWith("status", "archived");
    await expect(response.json()).resolves.toMatchObject({
      customers: [{ id: "cust-1", name: "Acme" }],
    });
  });

  it("POST rejects invalid report emails", async () => {
    const response = await POST(
      new Request("https://example.com/api/company/audit-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme", reportEmail: "not-an-email" }),
      })
    );
    if (!response) throw new Error("missing response");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Enter a valid customer audit email.",
    });
  });

  it("POST creates a company-scoped audit customer", async () => {
    const builder = queryBuilder({
      data: { id: "cust-1", name: "Acme", report_email: "audit@acme.test" },
      error: null,
    });
    const from = vi.fn(() => builder);
    authorizeRequest.mockResolvedValue({
      role: "safety_manager",
      team: null,
      user: { id: "user-1" },
      supabase: { from },
    });

    const response = await POST(
      new Request("https://example.com/api/company/audit-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme", reportEmail: "AUDIT@ACME.TEST" }),
      })
    );
    if (!response) throw new Error("missing response");

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("company_audit_customers");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        name: "Acme",
        report_email: "audit@acme.test",
        created_by: "user-1",
      })
    );
  });
});
