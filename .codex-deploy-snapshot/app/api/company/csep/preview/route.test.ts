import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authorizeRequest,
  getCompanyScope,
  buildRiskMemoryStructuredContext,
  ensureSafetyPlanGenerationContext,
  runSafetyPlanDocumentPipeline,
  renderGeneratedCsepDocx,
  serverLog,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  buildRiskMemoryStructuredContext: vi.fn(),
  ensureSafetyPlanGenerationContext: vi.fn(),
  runSafetyPlanDocumentPipeline: vi.fn(),
  renderGeneratedCsepDocx: vi.fn(),
  serverLog: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest }));
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
vi.mock("@/lib/csepDocxRenderer", () => ({
  renderGeneratedCsepDocx,
}));
vi.mock("@/lib/serverLog", () => ({ serverLog }));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("company csep preview route", () => {
  it("builds and returns a persisted preview draft", async () => {
    authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      team: null,
    });
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    buildRiskMemoryStructuredContext.mockResolvedValue(null);
    ensureSafetyPlanGenerationContext.mockReturnValue({
      siteContext: { jobsiteId: null },
      documentProfile: {
        documentType: "csep",
        projectDeliveryType: "ground_up",
        source: "builder_submit",
      },
      builderInstructions: {
        builderInputHash: "hash-1",
      },
    });
    runSafetyPlanDocumentPipeline.mockResolvedValue({
      generatedDocumentId: "generated-1",
      draft: {
        sectionMap: [{ key: "scope_of_work", title: "Scope of Work" }],
      },
      document: {
        htmlPreview: "<section><h2>1. Scope of Work</h2></section>",
      },
    });
    renderGeneratedCsepDocx.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      filename: "NorthCampus_CSEP.docx",
    });

    const response = await POST(
      new Request("https://example.com/api/company/csep/preview", {
        method: "POST",
        body: JSON.stringify({
          project_name: "North Campus",
          form_data: {
            project_name: "North Campus",
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
      generated_document_id: "generated-1",
      builder_input_hash: "hash-1",
      html_preview: "<section><h2>1. Scope of Work</h2></section>",
    });
    expect(runSafetyPlanDocumentPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        sourceDocumentId: null,
      })
    );
    expect(
      runSafetyPlanDocumentPipeline.mock.calls[0]?.[0]?.generationContext?.documentProfile?.source
    ).toBe("csep_preview");
    expect(renderGeneratedCsepDocx).toHaveBeenCalled();
  });

  it("returns a conflict when the generated CSEP cannot pass final export validation", async () => {
    authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      team: null,
    });
    getCompanyScope.mockResolvedValue({ companyId: "company-1" });
    buildRiskMemoryStructuredContext.mockResolvedValue(null);
    ensureSafetyPlanGenerationContext.mockReturnValue({
      siteContext: { jobsiteId: null },
      documentProfile: {
        documentType: "csep",
        projectDeliveryType: "ground_up",
        source: "builder_submit",
      },
      builderInstructions: {
        builderInputHash: "hash-1",
      },
    });
    runSafetyPlanDocumentPipeline.mockResolvedValue({
      generatedDocumentId: "generated-1",
      draft: {
        sectionMap: [{ key: "scope_of_work", title: "Scope of Work" }],
      },
      document: {
        htmlPreview: "<section><h2>1. Scope of Work</h2></section>",
      },
    });
    renderGeneratedCsepDocx.mockRejectedValue(
      new Error(
        "CSEP export validation failed: unresolved placeholder content remains in final export."
      )
    );

    const response = await POST(
      new Request("https://example.com/api/company/csep/preview", {
        method: "POST",
        body: JSON.stringify({
          project_name: "North Campus",
          form_data: {
            project_name: "North Campus",
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
  });
});
