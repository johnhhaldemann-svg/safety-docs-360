import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
  cloneDocumentBuilderTextConfig,
} from "@/lib/documentBuilderText";

vi.mock("@/lib/documentBuilderTextSettings", () => ({
  getDocumentBuilderTextConfig: vi.fn(),
}));

import { generatePshsepDocx } from "./route";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

async function unzipDocx(body: Uint8Array | ArrayBuffer) {
  const zip = await JSZip.loadAsync(body);
  return {
    documentXml: await zip.file("word/document.xml")!.async("string"),
  };
}

describe("legacy PSHSEP DOCX export", () => {
  beforeEach(() => {
    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG as never
    );
  });

  it("normalizes builder aliases and includes catalog-driven specialist programs", async () => {
    const rendered = await generatePshsepDocx({
      company_name: "SafetyDocs360",
      project_name: "Turnaround Alpha",
      project_number: "TA-100",
      project_address: "500 Plant Rd",
      owner_client: "Owner",
      gc_cm: "GC",
      scope_of_work_selected: [
        "Excavation",
        "Concrete",
        "Crane / Rigging",
        "Hazard Communication / Chemical Use",
        "Silica / Dust Producing Work",
      ],
      permits_selected: ["Temporary Power / Energization", "Groundbreaking/Excavation"],
      high_risk_focus_areas: [
        "Respiratory / silica / dust exposure",
        "Occupied areas / public protection",
      ],
      assumed_trades_index: ["Excavation", "Scaffolding"],
    });

    const body = new Uint8Array(rendered.body);
    const { documentXml } = await unzipDocx(body);

    expect(documentXml).toContain("PSHSEP");
    expect(documentXml).toContain("Excavation &amp; Trenching");
    expect(documentXml).toContain("Cranes, Rigging &amp; Critical Lifts");
    expect(documentXml).toContain("Concrete &amp; Masonry");
    expect(documentXml).toContain("Hazard Communication");
    expect(documentXml).toContain("Silica Exposure Control");
    expect(documentXml).toContain("Respiratory Protection");
    expect(documentXml).toContain("Public Protection &amp; Occupied Area Controls");
    expect(documentXml).not.toContain("Confined Space Entry - Detailed Requirements");
  });

  it("uses configured builder text overrides for site builder content", async () => {
    const config = cloneDocumentBuilderTextConfig(DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG);
    config.builders.site_builder.sections[0].paragraphs = ["Custom cover purpose from super admin."];
    const fallProtection = config.builders.site_builder.sections.find(
      (section) => section.key === "fall_protection"
    );

    if (fallProtection) {
      fallProtection.title = "Working at Heights";
      const purpose = fallProtection.children.find((child) => child.key === "purpose");
      if (purpose) {
        purpose.paragraphs = ["Custom fall protection purpose."];
      }
    }

    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(config as never);

    const rendered = await generatePshsepDocx({
      company_name: "SafetyDocs360",
      project_name: "Turnaround Alpha",
      project_number: "TA-100",
      scope_of_work_selected: ["Excavation"],
    });

    const body = new Uint8Array(rendered.body);
    const { documentXml } = await unzipDocx(body);

    expect(documentXml).toContain("Custom cover purpose from super admin.");
    expect(documentXml).toContain("Working at Heights");
    expect(documentXml).toContain("Custom fall protection purpose.");
  });
});

/**
 * Fake Supabase client that returns a single stored draft row only when the
 * caller passes the matching company id. Simulates the tenant filter enforced
 * by `loadGeneratedDocumentDraft`.
 */
function createTenantScopedSupabase(
  storedDraft: GeneratedSafetyPlanDraft,
  storedCompanyId: string,
  storedDocumentId: string
) {
  const state = { idFilter: "", companyFilter: "" };

  const builder: {
    select: (columns: string) => typeof builder;
    eq: (column: string, value: string) => typeof builder;
    maybeSingle: () => Promise<{ data: unknown; error: null }>;
  } = {
    select: () => builder,
    eq: (column: string, value: string) => {
      if (column === "id") state.idFilter = value;
      if (column === "company_id") state.companyFilter = value;
      return builder;
    },
    maybeSingle: async () => {
      const matches =
        state.idFilter === storedDocumentId &&
        state.companyFilter === storedCompanyId;

      return {
        data: matches
          ? {
              id: storedDocumentId,
              document_type: "pshsep",
              title: storedDraft.title ?? null,
              draft_json: storedDraft,
              company_id: storedCompanyId,
            }
          : null,
        error: null,
      };
    },
  };

  return { from: () => builder };
}

// Minimal draft payload that is enough for renderSafetyPlanDocx not to crash;
// the tests only care about tenant scoping, not rendered content.
function createMinimalGeneratedDraft(): GeneratedSafetyPlanDraft {
  return {
    documentType: "pshsep",
    projectDeliveryType: "turnaround",
    title: "PSHSEP Tenant Test",
    projectOverview: {
      projectName: "Tenant Test",
      projectNumber: "TT-001",
      projectAddress: "1 Test Ln",
      ownerClient: "Owner",
      gcCm: "GC",
      contractorCompany: "Contractor",
      location: "Site",
      schedule: "Q2 2026",
    },
    operations: [],
    ruleSummary: {
      permitTriggers: [],
      ppeRequirements: [],
      requiredControls: [],
      hazardCategories: [],
      siteRestrictions: [],
      prohibitedEquipment: [],
      trainingRequirements: [],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "none",
      items: [],
    },
    riskSummary: { score: 0, band: "low", priorities: [] },
    trainingProgram: { rows: [], summaryTrainingTitles: [] },
    narrativeSections: { safetyNarrative: "" },
    sectionMap: [],
    provenance: { generator: "test" },
  } as unknown as GeneratedSafetyPlanDraft;
}

describe("PSHSEP export tenant scoping for stored drafts", () => {
  beforeEach(() => {
    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG as never
    );
  });

  it("loads a stored draft when the caller's companyId matches the row", async () => {
    const draft = createMinimalGeneratedDraft();
    const supabase = createTenantScopedSupabase(draft, "tenant-a", "doc-1");

    const rendered = await generatePshsepDocx(
      { generatedDocumentId: "doc-1" },
      { supabase: supabase as never, companyId: "tenant-a" }
    );

    expect(rendered.body).toBeInstanceOf(Uint8Array);
    expect(rendered.body.byteLength).toBeGreaterThan(0);
  });

  it("throws a generic not-found error when the caller belongs to a different tenant", async () => {
    const draft = createMinimalGeneratedDraft();
    const supabase = createTenantScopedSupabase(draft, "tenant-a", "doc-1");

    await expect(
      generatePshsepDocx(
        { generatedDocumentId: "doc-1" },
        { supabase: supabase as never, companyId: "tenant-b" }
      )
    ).rejects.toThrow("Generated document not found.");
  });

  it("refuses to load a stored draft when companyId is missing, even if supabase is provided", async () => {
    const draft = createMinimalGeneratedDraft();
    const supabase = createTenantScopedSupabase(draft, "tenant-a", "doc-1");

    await expect(
      generatePshsepDocx(
        { generatedDocumentId: "doc-1" },
        { supabase: supabase as never, companyId: null }
      )
    ).rejects.toThrow("Generated document not found.");
  });
});
