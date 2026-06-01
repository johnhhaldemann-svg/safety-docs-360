import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  getCompanyScope,
  blockIfCsepOnlyCompany,
  getJobsiteAccessScope,
  isJobsiteAllowed,
  generateAuditFlowReportPdf,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  blockIfCsepOnlyCompany: vi.fn(),
  getJobsiteAccessScope: vi.fn(),
  isJobsiteAllowed: vi.fn(),
  generateAuditFlowReportPdf: vi.fn(),
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return { ...actual, authorizeRequest };
});
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/csepApiGuard", () => ({ blockIfCsepOnlyCompany }));
vi.mock("@/lib/jobsiteAccess", () => ({ getJobsiteAccessScope, isJobsiteAllowed }));
vi.mock("@/lib/auditflow/reportPdf", () => ({ generateAuditFlowReportPdf }));

import { GET } from "./route";

function builder(result: unknown) {
  const api = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  api.select.mockReturnValue(api);
  api.eq.mockReturnValue(api);
  api.maybeSingle.mockResolvedValue(result);
  return api;
}

function makeSupabase(submissionOverrides: Record<string, unknown> = {}) {
  const submission = builder({
    data: {
      id: "sub-1",
      company_id: "company-1",
      assignment_id: "assignment-1",
      template_id: "template-1",
      template_version_id: "version-1",
      jobsite_id: "jobsite-1",
      submitted_by: "submitter-1",
      status: "approved",
      answers: {},
      score_summary: {},
      signature_text: "Sam Submitter",
      ...submissionOverrides,
    },
    error: null,
  });
  const assignment = builder({ data: { id: "assignment-1" }, error: null });
  const version = builder({
    data: { id: "version-1", schema: { sections: [{ id: "s", title: "S", items: [{ id: "i", label: "I" }] }] } },
    error: null,
  });
  const template = builder({ data: { title: "Weekly Safety Audit" }, error: null });
  const jobsite = builder({ data: { name: "North Tower" }, error: null });
  const from = vi.fn((table: string) => {
    if (table === "company_auditflow_submissions") return submission;
    if (table === "company_auditflow_assignments") return assignment;
    if (table === "company_auditflow_template_versions") return version;
    if (table === "company_auditflow_templates") return template;
    if (table === "company_jobsites") return jobsite;
    return builder({ data: null, error: null });
  });
  return { from };
}

describe("/api/company/auditflow/submissions/[id]/report-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    blockIfCsepOnlyCompany.mockResolvedValue(null);
    getJobsiteAccessScope.mockResolvedValue({ restricted: false, jobsiteIds: [] });
    isJobsiteAllowed.mockReturnValue(true);
    generateAuditFlowReportPdf.mockResolvedValue({
      bytes: new Uint8Array(Buffer.from("%PDF mock")),
      filename: "weekly-audit.pdf",
    });
  });

  it("blocks unapproved downloads for the submitter", async () => {
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "submitter-1", email: "submitter@example.com" },
      supabase: makeSupabase({ status: "submitted" }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/auditflow/submissions/sub-1/report-pdf"), {
        params: Promise.resolve({ id: "sub-1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(generateAuditFlowReportPdf).not.toHaveBeenCalled();
  });

  it("allows reviewer preview before approval", async () => {
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      supabase: makeSupabase({ status: "submitted" }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/auditflow/submissions/sub-1/report-pdf?preview=1"), {
        params: Promise.resolve({ id: "sub-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(generateAuditFlowReportPdf).toHaveBeenCalledWith(expect.objectContaining({ reportStatus: "preview" }));
  });

  it("allows the submitter to download after approval", async () => {
    authorizeRequest.mockResolvedValue({
      role: "field_user",
      user: { id: "submitter-1", email: "submitter@example.com" },
      supabase: makeSupabase({ status: "approved" }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/auditflow/submissions/sub-1/report-pdf"), {
        params: Promise.resolve({ id: "sub-1" }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(generateAuditFlowReportPdf).toHaveBeenCalledWith(expect.objectContaining({ reportStatus: "approved" }));
  });

  it("blocks reports outside the user's jobsite scope", async () => {
    isJobsiteAllowed.mockReturnValue(false);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      supabase: makeSupabase({ status: "approved" }),
    });

    const response = requireRouteResponse(
      await GET(new Request("https://example.com/api/company/auditflow/submissions/sub-1/report-pdf"), {
        params: Promise.resolve({ id: "sub-1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(generateAuditFlowReportPdf).not.toHaveBeenCalled();
  });
});
