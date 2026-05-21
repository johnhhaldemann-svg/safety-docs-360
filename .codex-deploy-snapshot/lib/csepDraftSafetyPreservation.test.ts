import { describe, expect, it } from "vitest";
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import {
  findMissingPreservedCsepContentInAnyHaystack,
  flattenCsepSectionMapText,
  flattenGeneratedDraftForPreservationSearch,
} from "@/lib/csepDraftSafetyPreservation";
import { buildGeneratedSafetyPlanDraft } from "@/lib/safety-intelligence/documents/assemble";
import type { CsepFormatSectionKey } from "@/types/csep-builder";

const PRESERVATION_FORMAT_KEYS = [
  "hazard_communication_program",
  "roles_and_responsibilities",
  "security_and_access_control",
  "contractor_iipp",
  "weather_requirements_and_severe_weather_response",
  "contractor_monitoring_audits_and_reporting",
  "contractor_safety_meetings_and_engagement",
  "sub_tier_contractor_management",
  "project_close_out",
  "checklists_and_inspections",
] as const satisfies readonly CsepFormatSectionKey[];

describe("CSEP draft safety preservation", () => {
  it("retains required HazCom, steel access, rescue, permit, drug/alcohol, and driver concepts in generated + structured drafts", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Preservation Tower",
          projectAddress: "1 Test Way",
          contractorCompany: "Steel Sub LLC",
          contractorContact: "Alex Lead",
        },
        scope: {
          trades: ["Steel Erection"],
          subTrades: ["Decking"],
          tasks: ["Deck placement"],
          equipment: ["Crane"],
          location: "Level 4",
        },
        operations: [
          {
            operationId: "op-pres-1",
            tradeCode: "steel",
            tradeLabel: "Steel Erection",
            subTradeCode: "decking",
            subTradeLabel: "Decking",
            taskCode: "deck_placement",
            taskTitle: "Deck placement",
            description: "Place and secure metal deck.",
            equipmentUsed: ["Crane"],
            workConditions: ["Exterior"],
            hazardHints: ["fall"],
            requiredControlHints: ["controlled_decking_zone"],
            permitHints: ["lift_plan"],
            ppeHints: ["Hard Hat", "Harness"],
            workAreaLabel: "Level 4",
            locationGrid: "B4",
            locationLabel: "Level 4",
            weatherConditionCode: "wind",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            crewSize: 6,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Level 4",
          workConditions: ["Exterior"],
          siteRestrictions: ["Maintain decking exclusion zone."],
          simultaneousOperations: ["Electrical rough-in below"],
          weather: {
            conditionCode: "wind",
            summary: "High winds require lift review and exposed-work controls.",
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: [
            "roles_and_responsibilities",
            "security_and_access",
            "health_and_wellness",
            "incident_reporting_and_investigation",
            "training_and_instruction",
            "recordkeeping",
            "continuous_improvement",
            "weather_requirements_and_severe_weather_response",
            "common_overlapping_trades",
          ],
          selectedFormatSectionKeys: [...PRESERVATION_FORMAT_KEYS],
          blockInputs: {
            roles_and_responsibilities:
              "The superintendent assigns daily work ownership and verifies competent-person coverage before exposed work starts.",
            security_and_access:
              "Workers must use designated gates and maintain controlled access around hoisting and decking zones.",
            health_and_wellness:
              "Provide hydration, rest breaks, and prompt reporting of fatigue or heat stress concerns.",
            incident_reporting_and_investigation:
              "Notify supervision immediately, preserve the scene, and track corrective actions to closure.",
            training_and_instruction:
              "Review deck-placement sequencing, crane communication, and edge-control requirements before shift start.",
            recordkeeping:
              "Maintain daily pre-task plans, inspection logs, permit copies, and corrective-action status logs on site.",
            continuous_improvement:
              "Capture lessons learned during weekly coordination meetings and close out action items before turnover.",
            weather_requirements_and_severe_weather_response: [
              "Monitoring source: National Weather Service",
              "Communication method: Superintendent text alert",
              "High-wind control: Suspend exposed picks when conditions exceed the lift-plan threshold.",
              "Environmental control: Protect drains and staging areas from debris before storms.",
            ],
            common_overlapping_trades: ["Electrical rough-in below", "Facade access coordination"],
          },
          builderInputHash: "hash-preservation-draft",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: "WI",
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        documentType: "csep",
        buckets: [],
        rulesEvaluations: [
          {
            bucketKey: "bucket-pres-1",
            operationId: "op-pres-1",
            findings: [],
            permitTriggers: ["lift_plan"],
            hazardFamilies: ["fall"],
            hazardCategories: ["Fall exposure"],
            ppeRequirements: ["Hard Hat", "Harness"],
            equipmentChecks: [],
            weatherRestrictions: ["high_wind_pause"],
            requiredControls: ["Controlled decking zone"],
            siteRestrictions: ["Maintain decking exclusion zone."],
            prohibitedEquipment: [],
            trainingRequirements: ["Qualified connector"],
            score: 12,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [
          {
            code: "overlap_pres",
            type: "hazard_propagation",
            severity: "high",
            sourceScope: "intra_document",
            rationale: "Electrical work below the decking area requires exclusion-zone coordination.",
            operationIds: ["op-pres-1", "op-pres-2"],
            relatedBucketKeys: ["bucket-pres-1"],
            requiredMitigations: ["drop_zone_control"],
            permitDependencies: ["lift_plan"],
            resequencingSuggestion: "Isolate elevated work windows.",
          },
        ],
        score: 5,
        band: "moderate",
        intraDocumentConflictCount: 1,
        externalConflictCount: 0,
      },
      narrativeSections: {},
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: ["Qualified connector", "Signal person"],
      },
      riskMemorySummary: null,
    });

    const generatedHaystack = flattenGeneratedDraftForPreservationSearch(draft);
    const structured = buildStructuredCsepDraft(draft, {
      selectedFormatSectionKeys: [...PRESERVATION_FORMAT_KEYS],
      finalIssueMode: false,
    });
    const structuredHaystack = flattenCsepSectionMapText(structured.sectionMap);
    const missingAcrossDrafts = findMissingPreservedCsepContentInAnyHaystack([
      generatedHaystack,
      structuredHaystack,
    ]);
    expect(
      missingAcrossDrafts,
      `Missing preserved concepts across generated + structured text: ${missingAcrossDrafts.join(", ")}`
    ).toEqual([]);

    const docControl = structured.sectionMap.find((s) => s.key === "document_control_and_revision_history");
    expect(docControl?.title).toMatch(/Document Control.*Revision History/i);
    expect(docControl?.table?.rows?.length).toBeGreaterThan(0);
  });
});
