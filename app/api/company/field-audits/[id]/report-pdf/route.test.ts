import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  getCompanyScope,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  isAdminRole,
  generateFieldAuditReportPdf,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  isAdminRole: vi.fn(),
  generateFieldAuditReportPdf: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest, isAdminRole };
});
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/fieldAudits/reportPdf", () => ({ generateFieldAuditReportPdf }));

import { GET } from "./route";

function builder(result: unknown) {
  const api = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
  };
  api.select.mockReturnValue(api);
  api.eq.mockReturnValue(api);
  api.order.mockResolvedValue(result);
  api.maybeSingle.mockResolvedValue(result);
  return api;
}

function makeSupabase(auditOverrides: Record<string, unknown> = {}) {
  const audit = builder({
    data: {
      id: "audit-1",
      company_id: "company-1",
      jobsite_id: "jobsite-1",
      audit_customer_id: "customer-1",
      audit_customer_location_id: null,
      audit_date: "2026-05-01",
      auditors: "Sam",
      selected_trade: "general_contractor",
      status: "submitted",
      score_summary: {},
      payload: {},
      ai_review_summary: null,
      submitted_by: "submitter-1",
      ...auditOverrides,
    },
    error: null,
  });
  const jobsite = builder({ data: { id: "jobsite-1", name: "North Tower", audit_customer_id: "customer-1" }, error: null });
  const customer = builder({ data: { id: "customer-1", name: "Acme", report_email: "safety@acme.test" }, error: null });
  const observations = builder({ data: [], error: null });
  const from = vi.fn((table: string) => {
    if (table === "company_jobsite_audits") return audit;
    if (table === "company_jobsites") return jobsite;
    if (table === "company_audit_customers") return customer;
    if (table === "company_jobsite_audit_observations") return observations;
    return builder({ data: null, error: null });
  });
  return { from };
}

describe("/api/company/field-audits/[id]/report-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminRole.mockReturnValue(false);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    generateFieldAuditReportPdf.mockResolvedValue({
      bytes: new Uint8Array(Buffer.from("%PDF mock")),
      filename: "field-audit.pdf",
    });
  });

  it("blocks final downloads until company review approval", async () => {
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "submitter-1", email: "field@example.com" },
      supabase: makeSupabase({ status: "pending_review" }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/field-audits/audit-1/report-pdf"), {
        params: Promise.resolve({ id: "audit-1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(generateFieldAuditReportPdf).not.toHaveBeenCalled();
  });

  it("allows reviewer previews while an audit is pending review", async () => {
    authorizeRequest.mockResolvedValue({
      role: "safety_manager",
      user: { id: "reviewer-1", email: "reviewer@example.com" },
      supabase: makeSupabase({ status: "pending_review" }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/field-audits/audit-1/report-pdf?preview=1"), {
        params: Promise.resolve({ id: "audit-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(generateFieldAuditReportPdf).toHaveBeenCalledWith(expect.objectContaining({ reportStatus: "preview" }));
  });
});
