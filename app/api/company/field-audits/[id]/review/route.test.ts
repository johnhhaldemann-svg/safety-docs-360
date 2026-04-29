import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  createSupabaseAdminClient,
  getCompanyScope,
  getJobsiteAccessScope,
  isAdminRole,
  isJobsiteAllowed,
  sendCustomerAuditReportEmail,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isAdminRole: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  sendCustomerAuditReportEmail: vi.fn(),
}));

vi.mock("@/lib/auditReportEmail", () => ({ sendCustomerAuditReportEmail }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/rbac", () => ({ authorizeRequest, isAdminRole }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));

import { PATCH } from "./route";

function builder(result: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

describe("/api/company/field-audits/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    sendCustomerAuditReportEmail.mockResolvedValue({
      sent: true,
      status: "sent",
      providerMessageId: "email-1",
    });
  });

  it("emails the linked audit customer before falling back to the jobsite email", async () => {
    const auditLookup = builder({
      data: {
        id: "audit-1",
        jobsite_id: "jobsite-1",
        audit_date: "2026-04-29",
        auditors: "Sam",
        selected_trade: "general_contractor",
        score_summary: { total: 1, fail: 0, compliancePercent: 100 },
        payload: {},
      },
      error: null,
    });
    const jobsiteLookup = builder({
      data: {
        id: "jobsite-1",
        name: "Tower",
        audit_customer_id: "cust-1",
        customer_report_email: "fallback@example.com",
      },
      error: null,
    });
    const customerLookup = builder({
      data: { id: "cust-1", name: "Acme", report_email: "audit@acme.test" },
      error: null,
    });
    const observationsLookup = builder({ data: [], error: null });

    const authFrom = vi.fn((table: string) => {
      if (table === "company_jobsite_audits") return auditLookup;
      if (table === "company_jobsites") return jobsiteLookup;
      if (table === "company_audit_customers") return customerLookup;
      if (table === "company_jobsite_audit_observations") return observationsLookup;
      return builder({ data: null, error: null });
    });

    const updateBuilder = builder({ data: { id: "audit-1", status: "submitted" }, error: null });
    const deliveryBuilder = builder({ data: { id: "delivery-1" }, error: null });
    const writeFrom = vi.fn((table: string) => {
      if (table === "company_jobsite_audits") return updateBuilder;
      if (table === "company_jobsite_audit_report_deliveries") return deliveryBuilder;
      return builder({ data: null, error: null });
    });

    authorizeRequest.mockResolvedValue({
      role: "safety_manager",
      team: null,
      user: { id: "user-1" },
      supabase: { from: authFrom },
    });
    createSupabaseAdminClient.mockReturnValue({ from: writeFrom });

    const response = await PATCH(
      new Request("https://example.com/api/company/field-audits/audit-1/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved" }),
      }),
      { params: Promise.resolve({ id: "audit-1" }) }
    );
    if (!response) throw new Error("missing response");

    expect(response.status).toBe(200);
    expect(sendCustomerAuditReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: "audit@acme.test" })
    );
    expect(deliveryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_email: "audit@acme.test" })
    );
  });
});
