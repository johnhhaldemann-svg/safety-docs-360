import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  getUserAgreementRecord,
  getAgreementConfig,
  getDefaultAgreementConfig,
  getCompanyScope,
  buildRiskMemoryStructuredContext,
  ensureSafetyPlanGenerationContext,
  runSafetyPlanDocumentPipeline,
  renderSafetyPlanDocx,
  generateCsepDocx,
  generatePshsepDocx,
  serverLog,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getUserAgreementRecord: vi.fn(),
  getAgreementConfig: vi.fn(),
  getDefaultAgreementConfig: vi.fn(),
  getCompanyScope: vi.fn(),
  buildRiskMemoryStructuredContext: vi.fn(),
  ensureSafetyPlanGenerationContext: vi.fn(),
  runSafetyPlanDocumentPipeline: vi.fn(),
  renderSafetyPlanDocx: vi.fn(),
  generateCsepDocx: vi.fn(),
  generatePshsepDocx: vi.fn(),
  serverLog: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
vi.mock("@/lib/legal", () => ({
  getUserAgreementRecord,
  getDefaultAgreementConfig,
}));
vi.mock("@/lib/legalSettings", () => ({ getAgreementConfig }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/riskMemory/structuredContext", () => ({
  buildRiskMemoryStructuredContext,
}));
vi.mock("@/lib/safety-intelligence/documentIntake", () => ({
  ensureSafetyPlanGenerationContext,
}));
vi.mock("@/lib/safety-intelligence/documents/pipeline", () => ({
  runSafetyPlanDocumentPipeline,
}));
vi.mock("@/lib/safety-intelligence/documents/render", () => ({
  renderSafetyPlanDocx,
}));
vi.mock("@/app/api/csep/export/route", () => ({
  generateCsepDocx,
}));
vi.mock("@/app/api/pshsep/export/route", () => ({
  generatePshsepDocx,
}));
vi.mock("@/lib/serverLog", () => ({ serverLog }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("documents submit route", () => {
  it("submits the legacy review record and runs the safety-plan pipeline", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "doc-1" },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const from = vi.fn((table: string) => {
      if (table === "documents") {
        return {
          insert,
          update,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ upload });
    const supabase = {
      from,
      storage: {
        from: storageFrom,
      },
    };

    authorizeRequest.mockResolvedValue({
      supabase,
      user: { id: "user-1", user_metadata: {} },
      team: null,
    });
    getUserAgreementRecord.mockResolvedValue({
      data: {
        accepted_terms: true,
        terms_version: "v1",
      },
    });
    getAgreementConfig.mockResolvedValue({ version: "v1" });
    getDefaultAgreementConfig.mockReturnValue({ version: "v1" });
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    buildRiskMemoryStructuredContext.mockResolvedValue(null);
    ensureSafetyPlanGenerationContext.mockReturnValue({
      documentProfile: { documentType: "csep" },
      siteContext: { jobsiteId: null },
    });
    runSafetyPlanDocumentPipeline.mockResolvedValue({
      generatedDocumentId: "generated-1",
      bucketRunId: "run-1",
      draft: { title: "Draft" },
    });
    renderSafetyPlanDocx.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      filename: "NorthCampus_CSEP_Draft.docx",
    });

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: "North Campus",
          form_data: {
            generationContext: {
              project: { projectName: "North Campus" },
            },
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      document_id: "doc-1",
      generated_document_id: "generated-1",
      bucket_run_id: "run-1",
    });
    expect(body.draft_file_path).toContain("drafts/user-1/");
    expect(ensureSafetyPlanGenerationContext).toHaveBeenCalled();
    expect(runSafetyPlanDocumentPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        sourceDocumentId: "doc-1",
      })
    );
    expect(renderSafetyPlanDocx).toHaveBeenCalled();
    expect(upload).toHaveBeenCalled();
  });

  it("falls back to the legacy CSEP renderer when safety-intelligence tables are missing", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "doc-legacy" },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteTable = vi.fn().mockReturnValue({ eq: deleteEq });
    const from = vi.fn((table: string) => {
      if (table === "documents") {
        return {
          insert,
          update,
          delete: deleteTable,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ upload });
    const supabase = {
      from,
      storage: {
        from: storageFrom,
      },
    };

    authorizeRequest.mockResolvedValue({
      supabase,
      user: { id: "user-1", user_metadata: {} },
      team: null,
    });
    getUserAgreementRecord.mockResolvedValue({
      data: {
        accepted_terms: true,
        terms_version: "v1",
      },
    });
    getAgreementConfig.mockResolvedValue({ version: "v1" });
    getDefaultAgreementConfig.mockReturnValue({ version: "v1" });
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    buildRiskMemoryStructuredContext.mockResolvedValue(null);
    ensureSafetyPlanGenerationContext.mockReturnValue({
      documentProfile: { documentType: "csep" },
      siteContext: { jobsiteId: null },
    });
    runSafetyPlanDocumentPipeline.mockRejectedValue(
      new Error('relation "company_bucket_runs" does not exist')
    );
    generateCsepDocx.mockResolvedValue(
      new Response(new Uint8Array([9, 8, 7]), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="Legacy_CSEP.docx"',
        },
      })
    );

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: "Legacy Campus",
          form_data: {
            trade: "Excavation",
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      document_id: "doc-legacy",
      generated_document_id: null,
      bucket_run_id: null,
    });
    expect(generateCsepDocx).toHaveBeenCalled();
    expect(renderSafetyPlanDocx).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalled();
    expect(serverLog).toHaveBeenCalledWith(
      "warn",
      "document_submit_pipeline_schema_fallback",
      expect.objectContaining({
        companyId: "company-1",
        documentType: "CSEP",
      })
    );
  });

  it("falls back to the legacy renderer when pipeline persistence is blocked by RLS", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "doc-rls" },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteTable = vi.fn().mockReturnValue({ eq: deleteEq });
    const from = vi.fn((table: string) => {
      if (table === "documents") {
        return {
          insert,
          update,
          delete: deleteTable,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ upload });
    const supabase = {
      from,
      storage: {
        from: storageFrom,
      },
    };

    authorizeRequest.mockResolvedValue({
      supabase,
      user: { id: "user-1", user_metadata: {} },
      team: null,
    });
    getUserAgreementRecord.mockResolvedValue({
      data: {
        accepted_terms: true,
        terms_version: "v1",
      },
    });
    getAgreementConfig.mockResolvedValue({ version: "v1" });
    getDefaultAgreementConfig.mockReturnValue({ version: "v1" });
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    buildRiskMemoryStructuredContext.mockResolvedValue(null);
    ensureSafetyPlanGenerationContext.mockReturnValue({
      documentProfile: { documentType: "csep" },
      siteContext: { jobsiteId: null },
    });
    runSafetyPlanDocumentPipeline.mockRejectedValue(
      new Error(
        'new row violates row-level security policy for table "company_generated_documents"'
      )
    );
    generateCsepDocx.mockResolvedValue(
      new Response(new Uint8Array([7, 7, 7]), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="Legacy_CSEP.docx"',
        },
      })
    );

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: "RLS Campus",
          form_data: {
            trade: "Excavation",
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      document_id: "doc-rls",
      generated_document_id: null,
      bucket_run_id: null,
    });
    expect(generateCsepDocx).toHaveBeenCalled();
    expect(upload).toHaveBeenCalled();
    expect(serverLog).toHaveBeenCalledWith(
      "warn",
      "document_submit_pipeline_schema_fallback",
      expect.objectContaining({
        companyId: "company-1",
        documentType: "CSEP",
        message: expect.stringContaining("row-level security"),
      })
    );
  });
});
