import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
  cloneDocumentBuilderTextConfig,
} from "@/lib/documentBuilderText";

vi.mock("@/lib/documentBuilderTextSettings", () => ({
  getDocumentBuilderTextConfig: vi.fn(),
}));

import { generateCsepDocx } from "./route";
import { getDocumentBuilderTextConfig } from "@/lib/documentBuilderTextSettings";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

async function unzipDocx(body: Uint8Array | ArrayBuffer) {
  const zip = await JSZip.loadAsync(body);

  return {
    documentXml: await zip.file("word/document.xml")!.async("string"),
    stylesXml: await zip.file("word/styles.xml")!.async("string"),
    headerXml: zip.file("word/header1.xml")
      ? await zip.file("word/header1.xml")!.async("string")
      : "",
    footerXml: zip.file("word/footer1.xml")
      ? await zip.file("word/footer1.xml")!.async("string")
      : "",
  };
}

function createGeneratedDraft(): GeneratedSafetyPlanDraft {
  return {
    documentType: "csep",
    projectDeliveryType: "ground_up",
    title: "Kitchen Renovation CSEP",
    projectOverview: {
      projectName: "Kitchen Renovation",
      projectNumber: "KR-001",
      projectAddress: "100 Main St",
      ownerClient: "Owner Group",
      gcCm: "GC Partners",
      contractorCompany: "Kitchen Installers LLC",
      location: "Main Campus",
      schedule: "Q2 2026",
    },
    operations: [
      {
        operationId: "op-1",
        tradeLabel: "Millwork",
        subTradeLabel: "Commercial Kitchen Install",
        taskTitle: "Install kitchen hood supports",
        workAreaLabel: "North Wing",
        locationGrid: "A2",
        equipmentUsed: ["Lift"],
        workConditions: ["Interior"],
        hazardCategories: ["Falling objects"],
        permitTriggers: ["ladder permit"],
        ppeRequirements: ["Hard Hat", "Safety Glasses"],
        requiredControls: ["Barricade below work"],
        siteRestrictions: ["Keep access aisles clear."],
        prohibitedEquipment: [],
        conflicts: [],
      },
    ],
    ruleSummary: {
      permitTriggers: ["ladder permit"],
      ppeRequirements: ["Hard Hat", "Safety Glasses"],
      requiredControls: ["Barricade below work"],
      hazardCategories: ["Falling objects"],
      siteRestrictions: ["Keep access aisles clear."],
      prohibitedEquipment: [],
      trainingRequirements: ["Tool-specific instruction"],
      weatherRestrictions: [],
    },
    conflictSummary: {
      total: 0,
      intraDocument: 0,
      external: 0,
      highestSeverity: "none",
      items: [],
    },
    riskSummary: {
      score: 8,
      band: "low",
      priorities: ["Keep access aisles clear and maintain exclusion zones."],
    },
    trainingProgram: {
      rows: [],
      summaryTrainingTitles: [],
    },
    narrativeSections: {
      safetyNarrative: "Narrative body",
    },
    sectionMap: [
      {
        key: "purpose",
        title: "Purpose & How to Use This Blueprint",
        body: "Use this Blueprint during daily planning and permit coordination.",
      },
      {
        key: "project_information",
        title: "Project Information",
        table: {
          columns: ["Field", "Value"],
          rows: [["Project Name", "Kitchen Renovation"]],
        },
      },
      {
        key: "emergency_procedures",
        title: "Emergency Procedures",
        body: "Call site supervision and move to the designated muster point.",
      },
    ],
    provenance: {
      generator: "test",
    },
  };
}

describe("legacy CSEP DOCX export", () => {
  beforeEach(() => {
    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG as never
    );
  });

  it("applies the cleaner CSEP document style to legacy exports", async () => {
    const response = await generateCsepDocx({
      project_name: "Kitchen Renovation",
      project_number: "KR-001",
      project_address: "100 Main St",
      owner_client: "Owner Group",
      gc_cm: "GC Partners",
      contractor_company: "Kitchen Installers LLC",
      contractor_contact: "Jordan Smith",
      contractor_phone: "555-111-2222",
      contractor_email: "jordan@example.com",
      trade: "Millwork",
      subTrade: "Commercial Kitchen Install",
      tasks: ["Install kitchen hood supports", "Startup and testing"],
      scope_of_work: "Install kitchen equipment and coordinate startup work.",
      site_specific_notes: "Coordinate with adjacent trades and keep access aisles clear.",
      emergency_procedures: "Call site supervision and move to the designated muster point.",
      required_ppe: ["Hard Hat", "Safety Glasses"],
      additional_permits: ["Hot Work Permit"],
      selected_hazards: ["Hot work / fire"],
      tradeSummary: "Kitchen install scope includes overhead work, tie-ins, and startup.",
      oshaRefs: ["OSHA 1926 Subpart J - Fire Protection and Prevention"],
      tradeItems: [
        {
          activity: "Install kitchen hood supports",
          hazard: "Falling objects",
          risk: "High",
          controls: ["Barricade below work", "Use tool lanyards"],
          permit: "Ladder Permit",
        },
      ],
      derivedHazards: ["Falling objects"],
      derivedPermits: ["Ladder Permit"],
      overlapPermitHints: ["Hot Work Permit"],
      common_overlapping_trades: ["Electrical"],
      includedContent: {
        project_information: true,
        contractor_information: true,
        trade_summary: true,
        scope_of_work: true,
        site_specific_notes: true,
        emergency_procedures: true,
        required_ppe: true,
        additional_permits: true,
        common_overlapping_trades: true,
        osha_references: true,
        selected_hazards: true,
        activity_hazard_matrix: true,
      },
    });

    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml, stylesXml, headerXml, footerXml } = await unzipDocx(body);

    expect(documentXml).toContain("CONTRACTOR SAFETY &amp; ENVIRONMENTAL PLAN (CSEP)");
    expect(documentXml).toContain("Title Page");
    expect(documentXml).toContain("Document title");
    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("1. Title Page");
    expect(documentXml).toContain("Kitchen Renovation");
    expect(documentXml).toContain("Millwork");
    expect(documentXml).toContain("Trade:");
    expect(documentXml).toContain("2. Message from Owner");
    expect(documentXml).toContain("6. Scope");
    expect(documentXml).toMatch(/\d+\.\s*Hazards and Controls/);
    expect(documentXml).toContain('w:pgMar w:top="1440" w:right="1440" w:bottom="1080" w:left="1440"');
    expect(documentXml).not.toContain("<w:tbl>");
    expect(documentXml).toContain("Project name");
    expect(documentXml).toContain("Contractor");
    expect(documentXml).toContain("Hard Hat");
    expect(documentXml).toContain("Install kitchen hood supports");
    expect(documentXml).toContain("Appendix E. Task-Hazard-Control Matrix");
    expect(documentXml).toMatch(/\d+\.\s*Disclaimer/);

    expect(stylesXml).toContain('w:styleId="CsepSectionHeading"');
    expect(stylesXml).toContain('w:styleId="CsepBody"');
    expect(stylesXml).toContain("Calibri");
    expect(stylesXml).toContain("365F91");
    expect(stylesXml).toContain("4F81BD");
    expect(headerXml).toBe("");
    expect(footerXml).toContain("Safety360Docs");
    expect(footerXml).toContain("Kitchen Installers LLC");
    expect(footerXml).toContain("PAGE");
  });

  it("uses configured builder text overrides for static CSEP sections", async () => {
    const config = cloneDocumentBuilderTextConfig(DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG);
    const scopeSection = config.builders.csep.sections.find((section) => section.key === "scope_of_work");
    const trainingSection = config.builders.csep.sections.find(
      (section) => section.key === "training_requirements"
    );

    if (!scopeSection || !trainingSection) {
      throw new Error("Expected scope_of_work and training_requirements sections in the CSEP builder config.");
    }

    scopeSection.title = "Custom Scope Section";
    scopeSection.paragraphs = ["Custom scope fallback from super admin."];
    trainingSection.bullets = ["Custom training requirement from super admin."];
    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(config as never);

    const response = await generateCsepDocx({
      project_name: "Kitchen Renovation",
      project_number: "KR-001",
      project_address: "100 Main St",
      owner_client: "Owner Group",
      gc_cm: "GC Partners",
      contractor_company: "Kitchen Installers LLC",
      contractor_contact: "Jordan Smith",
      contractor_phone: "555-111-2222",
      contractor_email: "jordan@example.com",
      trade: "Millwork",
      subTrade: "Commercial Kitchen Install",
      tasks: [],
      scope_of_work: "",
      site_specific_notes: "Coordinate with adjacent trades.",
      emergency_procedures: "Call site supervision.",
      required_ppe: ["Hard Hat"],
      additional_permits: [],
      selected_hazards: [],
      tradeItems: [],
      includedContent: {
        project_information: true,
        contractor_information: true,
        trade_summary: false,
        scope_of_work: true,
        site_specific_notes: true,
        emergency_procedures: true,
        required_ppe: false,
        additional_permits: false,
        common_overlapping_trades: false,
        osha_references: false,
        selected_hazards: false,
        activity_hazard_matrix: false,
      },
    });

    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml } = await unzipDocx(body);

    expect(documentXml).toContain("Custom Scope Section");
    expect(documentXml).toContain("Custom scope fallback from super admin.");
    expect(documentXml).toContain("Custom training requirement from super admin.");
    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("14. IIPP / Emergency Response");
  });

  it("renders weather content in shared baseline, project overlay, then contractor order", async () => {
    const response = await generateCsepDocx({
      project_name: "Weather Tower",
      project_number: "WT-100",
      project_address: "100 Main St",
      owner_client: "Owner Group",
      gc_cm: "GC Partners",
      contractor_company: "Wind Safe LLC",
      contractor_contact: "Jordan Smith",
      contractor_phone: "555-111-2222",
      contractor_email: "jordan@example.com",
      trade: "Roofing",
      subTrade: "Membrane",
      tasks: ["Material staging"],
      scope_of_work: "Install roofing membrane and flashings.",
      site_specific_notes: "Coordinate with crane picks.",
      emergency_procedures: "Follow site alarms and muster procedures.",
      weather_requirements: {
        monitoringSources: ["NOAA", "NWS"],
        communicationMethods: ["Radio", "Site PA"],
        highWindThresholdText: "Suspend roofing and sheeting work at 20-25 mph sustained winds.",
        lightningRadiusMiles: 20,
        lightningAllClearMinutes: 30,
        heatTriggerText: "Apply heat controls above 80F or heat index above 85F.",
        coldTriggerText: "Escalate cold controls at 32F and below.",
        projectOverrideNotes: ["Use the north shelter trailer during tornado warnings"],
        dailyReviewNotes: "Foreman reviews changing conditions during the morning huddle.",
        contractorResponsibilityNotes: ["Secure loose membrane rolls before storm cells arrive"],
      },
      required_ppe: ["Hard Hat"],
      additional_permits: [],
      selected_hazards: ["Falls from height"],
      tradeItems: [],
      includedContent: {
        project_information: true,
        contractor_information: true,
        trade_summary: false,
        scope_of_work: false,
        site_specific_notes: false,
        emergency_procedures: false,
        weather_requirements_and_severe_weather_response: true,
        required_ppe: false,
        additional_permits: false,
        common_overlapping_trades: false,
        osha_references: false,
        selected_hazards: false,
        activity_hazard_matrix: false,
        roles_and_responsibilities: false,
        security_and_access: false,
        health_and_wellness: false,
        incident_reporting_and_investigation: false,
        training_and_instruction: false,
        drug_and_alcohol_testing: false,
        enforcement_and_corrective_action: false,
        recordkeeping: false,
        continuous_improvement: false,
      },
    });

    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml } = await unzipDocx(body);

    const sharedIndex = documentXml.indexOf("Project leadership will monitor weather conditions");
    const projectOverlayIndex = documentXml.indexOf("Monitoring sources: NOAA, NWS.");
    const contractorIndex = documentXml.indexOf(
      "Contractors shall monitor weather and field conditions daily, adjust work plans for heat, cold, wind, and lightning"
    );
    const contractorNoteIndex = documentXml.indexOf(
      "Foreman reviews changing conditions during the morning huddle."
    );

    expect(sharedIndex).toBeGreaterThan(-1);
    expect(projectOverlayIndex).toBeGreaterThan(sharedIndex);
    expect(contractorIndex).toBeGreaterThan(projectOverlayIndex);
    expect(contractorNoteIndex).toBeGreaterThan(contractorIndex);
  });

  it("falls back to fixed template sections when optional legacy data is missing", async () => {
    const response = await generateCsepDocx({
      project_name: "Empty Optional Sections",
      project_number: "EO-001",
      project_address: "100 Main St",
      owner_client: "Owner Group",
      gc_cm: "GC Partners",
      contractor_company: "Legacy Contracting",
      contractor_contact: "Jordan Smith",
      contractor_phone: "555-111-2222",
      contractor_email: "jordan@example.com",
      trade: "Millwork",
      subTrade: "Finish Carpentry",
      tasks: ["Install casework"],
      scope_of_work: "Install finish carpentry items.",
      site_specific_notes: "Coordinate with adjacent trades.",
      emergency_procedures: "Call site supervision.",
      required_ppe: [],
      additional_permits: [],
      selected_hazards: [],
      common_overlapping_trades: [],
      oshaRefs: [],
      tradeItems: [],
      includedContent: {
        project_information: true,
        contractor_information: true,
        trade_summary: true,
        scope_of_work: true,
        site_specific_notes: true,
        emergency_procedures: true,
        required_ppe: true,
        additional_permits: true,
        common_overlapping_trades: true,
        osha_references: true,
        selected_hazards: true,
        activity_hazard_matrix: true,
      },
    });

    expect(response.status).toBe(200);
    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml } = await unzipDocx(body);

    expect(documentXml).toContain("12. Security at Site");
    expect(documentXml).toMatch(/\d+\.\s*Hazards and Controls/);
    expect(documentXml).toContain("Contractors shall control worker access");
  });

  it("keeps legacy payloads working when new overlay fields are omitted", async () => {
    const response = await generateCsepDocx({
      project_name: "Legacy Build",
      project_number: "LG-001",
      project_address: "100 Main St",
      owner_client: "Owner Group",
      gc_cm: "GC Partners",
      contractor_company: "Legacy Contracting",
      contractor_contact: "Jordan Smith",
      contractor_phone: "555-111-2222",
      contractor_email: "jordan@example.com",
      trade: "Millwork",
      subTrade: "Finish Carpentry",
      tasks: ["Install casework"],
      scope_of_work: "Install finish carpentry items.",
      site_specific_notes: "Coordinate with adjacent trades.",
      emergency_procedures: "Call site supervision.",
      required_ppe: ["Hard Hat"],
      additional_permits: [],
      selected_hazards: [],
      tradeItems: [],
    });

    expect(response.status).toBe(200);
    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml } = await unzipDocx(body);

    expect(documentXml).toContain("Legacy Build");
    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("14. IIPP / Emergency Response");
  });

  it("renders generated draft exports through the shared CSEP renderer", async () => {
    const response = await generateCsepDocx({
      draft: createGeneratedDraft(),
    });

    expect(response.status).toBe(200);
    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml, headerXml, footerXml } = await unzipDocx(body);

    expect(documentXml).toContain("Table of Contents");
    expect(documentXml).toContain("1. Title Page");
    expect(documentXml).toContain("2. Message from Owner");
    expect(documentXml).toContain("6. Scope");
    expect(documentXml).toContain("13. HazCom");
    expect(documentXml).toContain("14. IIPP / Emergency Response");
    expect(documentXml).toMatch(/\d+\.\s*Hazards and Controls/);
    expect(documentXml).toContain("Appendix A. Forms and Permit Library");
    expect(documentXml).not.toContain("Blueprint");
    expect(documentXml).toMatch(/\d+\.\s*Disclaimer/);
    expect(headerXml).toBe("");
    expect(footerXml).toContain("PAGE");
  });
});

/**
 * Fake Supabase client that returns a single stored draft row only when the
 * caller passes the matching company id. Simulates the RLS-equivalent tenant
 * filter enforced by `loadGeneratedDocumentDraft`.
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
              document_type: "csep",
              title: storedDraft.title ?? null,
              draft_json: storedDraft,
              company_id: storedCompanyId,
            }
          : null,
        error: null,
      };
    },
  };

  return {
    from: () => builder,
  } as unknown as Parameters<typeof generateCsepDocx>[1] extends undefined
    ? never
    : NonNullable<Parameters<typeof generateCsepDocx>[1]>["supabase"];
}

describe("CSEP export tenant scoping for stored drafts", () => {
  beforeEach(() => {
    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG as never
    );
  });

  it("loads a stored draft when the caller's companyId matches the row", async () => {
    const draft = createGeneratedDraft();
    const supabase = createTenantScopedSupabase(draft, "tenant-a", "doc-1");

    const response = await generateCsepDocx(
      { generatedDocumentId: "doc-1" },
      { supabase: supabase as never, companyId: "tenant-a" }
    );

    expect(response.status).toBe(200);
    const body = new Uint8Array(await response.arrayBuffer());
    const { documentXml } = await unzipDocx(body);
    expect(documentXml).toContain("Table of Contents");
  });

  it("throws a generic not-found error when the caller belongs to a different tenant", async () => {
    const draft = createGeneratedDraft();
    const supabase = createTenantScopedSupabase(draft, "tenant-a", "doc-1");

    await expect(
      generateCsepDocx(
        { generatedDocumentId: "doc-1" },
        { supabase: supabase as never, companyId: "tenant-b" }
      )
    ).rejects.toThrow("Generated document not found.");
  });

  it("refuses to load a stored draft when companyId is missing, even if supabase is provided", async () => {
    const draft = createGeneratedDraft();
    const supabase = createTenantScopedSupabase(draft, "tenant-a", "doc-1");

    await expect(
      generateCsepDocx(
        { generatedDocumentId: "doc-1" },
        { supabase: supabase as never, companyId: null }
      )
    ).rejects.toThrow("Generated document not found.");
  });
});
