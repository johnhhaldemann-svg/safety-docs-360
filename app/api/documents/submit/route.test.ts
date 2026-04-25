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
  syncGeneratedTrainingRequirements,
  generateCsepDocx,
  generatePshsepDocx,
  serverLog,
  renderGeneratedCsepDocx,
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
  syncGeneratedTrainingRequirements: vi.fn(),
  generateCsepDocx: vi.fn(),
  generatePshsepDocx: vi.fn(),
  serverLog: vi.fn(),
  renderGeneratedCsepDocx: vi.fn(),
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
vi.mock("@/lib/safety-intelligence/trainingProgram", () => ({
  syncGeneratedTrainingRequirements,
}));
vi.mock("@/app/api/csep/export/route", () => ({
  generateCsepDocx,
}));
vi.mock("@/app/api/pshsep/export/route", () => ({
  generatePshsepDocx,
}));
vi.mock("@/lib/serverLog", () => ({ serverLog }));
vi.mock("@/lib/csepDocxRenderer", () => ({ renderGeneratedCsepDocx }));

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
      documentProfile: { documentType: "csep", projectDeliveryType: "ground_up" },
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
    renderGeneratedCsepDocx.mockResolvedValue({
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
    expect(renderGeneratedCsepDocx).toHaveBeenCalled();
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
      documentProfile: { documentType: "csep", projectDeliveryType: "ground_up" },
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
      "document_submit_pipeline_legacy_fallback",
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
      documentProfile: { documentType: "csep", projectDeliveryType: "ground_up" },
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
      "document_submit_pipeline_legacy_fallback",
      expect.objectContaining({
        companyId: "company-1",
        documentType: "CSEP",
        message: expect.stringContaining("row-level security"),
      })
    );
  });

  it("falls back to legacy PSHSEP export when the safety pipeline fails for a non-recoverable reason", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "doc-pshsep-legacy" },
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
        return { insert, update, delete: deleteTable };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const storageFrom = vi.fn().mockReturnValue({ upload });
    const supabase = { from, storage: { from: storageFrom } };

    authorizeRequest.mockResolvedValue({
      supabase,
      user: { id: "user-1", user_metadata: {} },
      team: null,
    });
    getUserAgreementRecord.mockResolvedValue({
      data: { accepted_terms: true, terms_version: "v1" },
    });
    getAgreementConfig.mockResolvedValue({ version: "v1" });
    getDefaultAgreementConfig.mockReturnValue({ version: "v1" });
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    buildRiskMemoryStructuredContext.mockResolvedValue(null);
    ensureSafetyPlanGenerationContext.mockReturnValue({
      documentProfile: { documentType: "pshsep", projectDeliveryType: "ground_up" },
      siteContext: { jobsiteId: null },
    });
    runSafetyPlanDocumentPipeline.mockRejectedValue(
      new Error("upstream model timeout — not a schema/RLS recoverable class")
    );
    generatePshsepDocx.mockResolvedValue({
      body: new Uint8Array([9, 9, 9]),
      filename: "Site_Plan_Legacy.docx",
    });

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "PESHEP",
          project_name: "Tower A",
          form_data: { project_name: "Tower A" },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, document_id: "doc-pshsep-legacy" });
    expect(generatePshsepDocx).toHaveBeenCalled();
    expect(generateCsepDocx).not.toHaveBeenCalled();
    expect(serverLog).toHaveBeenCalledWith(
      "warn",
      "document_submit_pipeline_legacy_fallback",
      expect.objectContaining({
        companyId: "company-1",
        documentType: "PESHEP",
        reason: "site_plan_safety_pipeline_bypass",
      })
    );
  });

  it("reuses an approved preview draft when the builder hash matches", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "doc-preview-submit" },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const previewSingle = vi.fn().mockResolvedValue({
      data: {
        id: "generated-preview-1",
        company_id: "company-1",
        created_by: "user-1",
        document_type: "csep",
        bucket_run_id: "bucket-preview-1",
        provenance: {
          builderInputHash: "hash-1",
        },
        draft_json: {
          sectionMap: [],
          trainingProgram: {
            rows: [],
            summaryTrainingTitles: [],
          },
        },
      },
      error: null,
    });
    const previewEq = vi.fn().mockReturnValue({ single: previewSingle });
    const previewSelect = vi.fn().mockReturnValue({ eq: previewEq });
    const from = vi.fn((table: string) => {
      if (table === "documents") {
        return {
          insert,
          update,
        };
      }
      if (table === "company_generated_documents") {
        return {
          select: previewSelect,
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
      documentProfile: { documentType: "csep", projectDeliveryType: "ground_up" },
      siteContext: { jobsiteId: null },
      builderInstructions: { builderInputHash: "hash-1" },
    });
    renderGeneratedCsepDocx.mockResolvedValue({
      body: new Uint8Array([4, 5, 6]),
      filename: "Preview_CSEP_Draft.docx",
    });
    syncGeneratedTrainingRequirements.mockResolvedValue({ insertedCount: 0 });

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: "Preview Campus",
          generated_document_id: "generated-preview-1",
          builder_input_hash: "hash-1",
          form_data: {
            trade: "Mechanical",
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
      document_id: "doc-preview-submit",
      generated_document_id: "generated-preview-1",
      bucket_run_id: "bucket-preview-1",
    });
    expect(runSafetyPlanDocumentPipeline).not.toHaveBeenCalled();
    expect(renderGeneratedCsepDocx).toHaveBeenCalled();
    expect(syncGeneratedTrainingRequirements).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        sourceDocumentId: "doc-preview-submit",
      })
    );
    expect(upload).toHaveBeenCalled();
  });

  it("returns a conflict instead of a generic 500 when final CSEP export validation fails", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "doc-preview-submit" },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteTable = vi.fn().mockReturnValue({ eq: deleteEq });
    const previewSingle = vi.fn().mockResolvedValue({
      data: {
        id: "generated-preview-1",
        company_id: "company-1",
        created_by: "user-1",
        document_type: "csep",
        bucket_run_id: "bucket-preview-1",
        provenance: {
          builderInputHash: "hash-1",
        },
        draft_json: {
          sectionMap: [],
          trainingProgram: {
            rows: [],
            summaryTrainingTitles: [],
          },
        },
      },
      error: null,
    });
    const previewEq = vi.fn().mockReturnValue({ single: previewSingle });
    const previewSelect = vi.fn().mockReturnValue({ eq: previewEq });
    const from = vi.fn((table: string) => {
      if (table === "documents") {
        return {
          insert,
          update,
          delete: deleteTable,
        };
      }
      if (table === "company_generated_documents") {
        return {
          select: previewSelect,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = {
      from,
      storage: {
        from: vi.fn(),
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
      documentProfile: { documentType: "csep", projectDeliveryType: "ground_up" },
      siteContext: { jobsiteId: null },
      builderInstructions: { builderInputHash: "hash-1" },
    });
    renderGeneratedCsepDocx.mockRejectedValue(
      new Error(
        "CSEP export validation failed: unresolved placeholder content remains in final export."
      )
    );

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: "Preview Campus",
          generated_document_id: "generated-preview-1",
          builder_input_hash: "hash-1",
          form_data: {
            trade: "Mechanical",
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toContain("not ready for final issue");
    expect(body.error).toContain("unresolved placeholder content remains in final export");
    expect(deleteEq).toHaveBeenCalledWith("id", "doc-preview-submit");
    expect(serverLog).toHaveBeenCalledWith(
      "warn",
      "document_submit_public_error",
      expect.objectContaining({
        status: 409,
      })
    );
  });

  it("rejects a stale approved preview hash before creating a document row", async () => {
    const insert = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "documents") {
        return { insert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = {
      from,
      storage: {
        from: vi.fn(),
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
      documentProfile: { documentType: "csep", projectDeliveryType: "ground_up" },
      siteContext: { jobsiteId: null },
      builderInstructions: { builderInputHash: "current-hash" },
    });

    const response = await POST(
      new Request("https://example.com/api/documents/submit", {
        method: "POST",
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: "Stale Campus",
          generated_document_id: "generated-preview-1",
          builder_input_hash: "old-hash",
          form_data: {
            trade: "Mechanical",
          },
        }),
      })
    );

    if (!response) {
      throw new Error("Expected a response.");
    }

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toContain("Regenerate");
    expect(insert).not.toHaveBeenCalled();
  });
});
