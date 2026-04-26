import { describe, expect, it } from "vitest";
import { buildGeneratedSafetyPlanDraft } from "@/lib/safety-intelligence/documents/assemble";
import { buildStructuredCsepDraft } from "@/lib/csepBuilder";
import {
  buildHazardModuleAiContext,
  getHazardModulesForCsepSelection,
} from "@/lib/hazardModules";
import {
  buildTaskModuleAiContext,
  getTaskModulesForTask,
} from "@/lib/siteManagementTaskModules";
import {
  buildSteelErectionHazardModuleAiContext,
  getSteelErectionHazardModulesForCsepSelection,
} from "@/lib/steelErectionHazardModules";
import {
  buildSteelErectionProgramModuleAiContext,
  getSteelErectionProgramModulesForCsepSelection,
} from "@/lib/steelErectionProgramModules";
import {
  buildSteelErectionTaskModuleAiContext,
  getSteelErectionTaskModulesForCsepSelection,
} from "@/lib/steelErectionTaskModules";

describe("buildGeneratedSafetyPlanDraft", () => {
  it("assembles the required dynamic safety-plan sections", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Tower A",
          projectAddress: "100 Center St",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "Contractor",
        },
        scope: {
          trades: ["Mechanical"],
          subTrades: ["HVAC"],
          tasks: ["Install rooftop unit"],
          equipment: ["MEWP"],
          location: "Roof",
        },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "mechanical",
            tradeLabel: "Mechanical",
            subTradeCode: "hvac",
            subTradeLabel: "HVAC",
            taskCode: "install_rooftop_unit",
            taskTitle: "Install rooftop unit",
            description: "Set rooftop unit on curb",
            equipmentUsed: ["MEWP"],
            workConditions: ["Roof access"],
            hazardHints: ["fall"],
            requiredControlHints: ["fall_protection"],
            permitHints: ["elevated_work_notice"],
            ppeHints: ["Hard Hat"],
            workAreaLabel: "Roof",
            locationGrid: "R1",
            locationLabel: "Roof",
            weatherConditionCode: "wind",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            crewSize: 4,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Roof",
          workConditions: ["Roof access"],
          siteRestrictions: ["No A-frame ladders."],
          simultaneousOperations: ["Electrical rough-in below"],
          weather: {
            conditionCode: "wind",
            summary: "High winds require elevated-work review.",
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Falls from height",
            relatedTasks: ["Install rooftop unit"],
            source: "selected",
          },
          {
            category: "ppe",
            item: "Safety Glasses",
            relatedTasks: ["Install rooftop unit"],
            source: "selected",
          },
        ],
        builderInstructions: {
          selectedBlockKeys: [
            "project_information",
            "trade_summary",
            "scope_of_work",
            "site_specific_notes",
            "required_ppe",
            "additional_permits",
            "selected_hazards",
            "activity_hazard_matrix",
          ],
          blockInputs: {
            project_information: ["Project Name: Tower A"],
            trade_summary: "Mechanical rooftop replacement scope.",
            scope_of_work: "Set rooftop unit on curb.",
            site_specific_notes: "No A-frame ladders.",
            required_ppe: ["Hard Hat"],
            additional_permits: ["Elevated Work Notice"],
            selected_hazards: ["Falls from height"],
            activity_hazard_matrix: ["Install rooftop unit | Falls from height"],
          },
          builderInputHash: "hash-1",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: "CA",
          jurisdictionCode: "ca",
          jurisdictionLabel: "California State Plan",
          jurisdictionPlanType: "state_plan",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-1",
            bucketType: "task_execution",
            companyId: "company-1",
            jobsiteId: "jobsite-1",
            operationId: "op-1",
            taskTitle: "Install rooftop unit",
            tradeCode: "mechanical",
            subTradeCode: "hvac",
            taskCode: "install_rooftop_unit",
            workAreaLabel: "Roof",
            locationGrid: "R1",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            weatherConditionCode: "wind",
            equipmentUsed: ["MEWP"],
            workConditions: ["Roof access"],
            siteRestrictions: ["No A-frame ladders."],
            prohibitedEquipment: ["a_frame_ladder"],
            hazardFamilies: ["fall"],
            permitTriggers: ["elevated_work_notice"],
            requiredControls: ["fall_protection"],
            ppeRequirements: ["Hard Hat"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            findings: [],
            permitTriggers: ["elevated_work_notice"],
            hazardFamilies: ["fall"],
            hazardCategories: ["Fall"],
            ppeRequirements: ["Hard Hat"],
            equipmentChecks: [],
            weatherRestrictions: ["high_wind_pause"],
            requiredControls: ["fall_protection"],
            siteRestrictions: ["No A-frame ladders."],
            prohibitedEquipment: ["a_frame_ladder"],
            trainingRequirements: [],
            score: 12,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            conflicts: [],
            score: 5,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [
          {
            code: "overhead_hazard_propagation",
            type: "hazard_propagation",
            severity: "high",
            sourceScope: "intra_document",
            rationale: "Overhead work in the same area creates a downstream exposure for adjacent crews.",
            operationIds: ["op-1", "op-2"],
            relatedBucketKeys: ["bucket-1", "bucket-2"],
            requiredMitigations: ["drop_zone_control"],
            permitDependencies: ["elevated_work_notice"],
            resequencingSuggestion: "Run overhead work in an isolated window.",
          },
        ],
        score: 5,
        band: "moderate",
        intraDocumentConflictCount: 1,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Structured narrative.",
      },
      trainingProgram: {
        rows: [
          {
            operationId: "op-1",
            tradeCode: "mechanical",
            tradeLabel: "Mechanical",
            subTradeCode: "hvac",
            subTradeLabel: "HVAC",
            taskCode: "install_rooftop_unit",
            taskTitle: "Install rooftop unit",
            trainingCode: "osha_10",
            trainingTitle: "OSHA 10",
            matchKeywords: ["OSHA 10"],
            sourceLabels: ["Task template"],
            whySource: "Task template",
          },
        ],
        summaryTrainingTitles: ["OSHA 10"],
      },
      riskMemorySummary: null,
    });

    const keys = draft.sectionMap.map((section) => section.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "definitions",
        "jurisdiction_profile",
        "trade_summary",
        "scope_of_work",
        "site_specific_notes",
        "required_ppe",
        "additional_permits",
        "selected_hazards",
        "activity_hazard_matrix",
        "program_hazard__falls_from_height__base",
        "program_ppe__safety_glasses__base",
      ])
    );
    expect(keys).not.toContain("project_information");
    expect(keys.slice(0, 2)).toEqual(["definitions", "jurisdiction_profile"]);
    expect(keys.indexOf("jurisdiction_profile")).toBeLessThan(keys.indexOf("scope_of_work"));
    expect(keys.indexOf("scope_of_work")).toBeLessThan(keys.indexOf("trade_summary"));
    expect(draft.ruleSummary.siteRestrictions).toContain("No A-frame ladders.");
    expect(draft.ruleSummary.trainingRequirements).toContain("OSHA 10");
    expect(draft.conflictSummary.total).toBe(1);
    expect(draft.projectDeliveryType).toBe("ground_up");
    expect(draft.narrativeSections.safetyNarrative).toBe("Structured narrative.");
    expect(draft.trainingProgram.rows).toHaveLength(1);
    const matrixRow =
      draft.sectionMap.find((section) => section.key === "activity_hazard_matrix")?.table?.rows[0] ?? [];
    expect(matrixRow).toHaveLength(8);
    expect(matrixRow).toEqual(
      expect.arrayContaining([
        "Mechanical / HVAC",
        "Roof | Grid R1",
        "Install rooftop unit",
        "Fall Exposure",
        "fall_protection",
        "Hard Hat",
      ])
    );
    expect(String(matrixRow[6] ?? "")).toMatch(/elevated|work|notice|none|identified/i);
    expect(String(matrixRow[7] ?? "")).toMatch(/competent|training|osha|person/i);
    const fallSubs =
      draft.sectionMap.find((section) => section.key === "program_hazard__falls_from_height__base")
        ?.subsections ?? [];
    expect(fallSubs.some((s) => s.title === "Applicable References" && s.bullets?.includes("R2"))).toBe(
      true
    );
    expect(fallSubs.find((s) => s.title === "When Not Required")?.body).toMatch(
      /fully protected|ground-level|guardrail|fall exposure/i
    );
    expect(fallSubs.find((s) => s.title === "Tie-Off")?.body).toMatch(/100%/i);
    expect(
      draft.sectionMap.find((section) => section.key === "program_ppe__safety_glasses__base")
        ?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Applicable References",
          bullets: ["R10"],
        }),
        expect.objectContaining({
          title: "Related Tasks",
          body: "These related tasks apply to this program scope: Install rooftop unit.",
          bullets: [],
        }),
      ])
    );
    expect(draft.provenance.jurisdictionCode).toBe("ca");
    expect(draft.provenance.jurisdictionStandardsApplied).toContain("std_ca_iipp_review");
    expect(draft.provenance.builderInputHash).toBe("hash-1");
    expect(draft.provenance.selectedBlockKeys).toEqual(
      expect.arrayContaining(["scope_of_work", "activity_hazard_matrix"])
    );
    expect(
      draft.sectionMap.find((section) => section.key === "additional_permits")?.table?.rows[0]
    ).toEqual(
      expect.arrayContaining([
        "Mechanical / HVAC",
        "Roof | Grid R1",
        "Install rooftop unit",
        "Elevated Work Notice",
      ])
    );
  });

  it("adds a steel erection note and crane / pick / lift roll-up for additional permits when steel is in scope", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Test Steel",
          projectAddress: "1 Main St",
          contractorCompany: "Sub",
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
            operationId: "op-steel-permits-1",
            tradeCode: "steel",
            tradeLabel: "Steel Erection",
            subTradeCode: "decking",
            subTradeLabel: "Decking",
            taskTitle: "Deck placement",
            equipmentUsed: ["Crane"],
            workConditions: ["Exterior"],
            workAreaLabel: "Level 4",
            locationLabel: "Level 4",
            hazardHints: ["fall"],
            requiredControlHints: ["controlled_decking_zone"],
            permitHints: ["lift_plan"],
            ppeHints: ["Hard Hat"],
            metadata: {},
          },
        ],
        siteContext: {
          location: "Level 4",
          workConditions: ["Exterior"],
          siteRestrictions: [],
          simultaneousOperations: [],
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["additional_permits"],
          blockInputs: {},
          builderInputHash: "hash-steel-additional-permits",
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
            bucketKey: "bucket-s",
            operationId: "op-steel-permits-1",
            findings: [],
            permitTriggers: ["lift_plan"],
            hazardFamilies: ["fall"],
            hazardCategories: ["Fall"],
            ppeRequirements: ["Hard Hat"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["Controlled decking zone"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: ["Qualified Rigger / Signal person"],
            score: 10,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low" as const,
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
    });
    const permSection = draft.sectionMap.find((s) => s.key === "additional_permits");
    expect(permSection?.body).toMatch(/Steel erection|structural steel/i);
    expect(permSection?.body).toMatch(/Crane Permit|Pick Plan/i);
    expect(permSection?.bullets).toEqual(
      expect.arrayContaining(["Crane Permit", "Pick Plan", "Lift Plan"])
    );
    const permitCell = permSection?.table?.rows?.[0]?.[3] ?? "";
    expect(permitCell).toMatch(/Crane Permit/);
    expect(permitCell).toMatch(/Pick Plan/);
  });

  it("renders builder-driven responsibility, procedure, and oversight sections into the CSEP draft", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Riverfront Tower",
          projectAddress: "100 River Rd",
          ownerClient: "Owner Group",
          gcCm: "GC Partners",
          contractorCompany: "ABC Steel",
          contractorContact: "Jane Smith",
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
            operationId: "op-1",
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
          selectedFormatSectionKeys: [
            "roles_and_responsibilities",
            "security_and_access_control",
            "contractor_iipp",
            "weather_requirements_and_severe_weather_response",
            "contractor_monitoring_audits_and_reporting",
            "contractor_safety_meetings_and_engagement",
            "sub_tier_contractor_management",
            "project_close_out",
            "checklists_and_inspections",
          ],
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
          builderInputHash: "hash-professional-sections",
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
            bucketKey: "bucket-1",
            operationId: "op-1",
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
            code: "overlap_1",
            type: "hazard_propagation",
            severity: "high",
            sourceScope: "intra_document",
            rationale: "Electrical work below the decking area requires exclusion-zone coordination.",
            operationIds: ["op-1", "op-2"],
            relatedBucketKeys: ["bucket-1"],
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

    const selectedFormatSectionKeys = [
      "roles_and_responsibilities",
      "security_and_access_control",
      "contractor_iipp",
      "weather_requirements_and_severe_weather_response",
      "contractor_monitoring_audits_and_reporting",
      "contractor_safety_meetings_and_engagement",
      "sub_tier_contractor_management",
      "project_close_out",
      "checklists_and_inspections",
    ] as const;
    const structuredDraft = buildStructuredCsepDraft(draft, { selectedFormatSectionKeys });

    expect(structuredDraft.sectionMap.map((section) => section.key)).toEqual(
      expect.arrayContaining([
        "roles_and_responsibilities",
        "security_and_access_control",
        "contractor_iipp",
        "weather_requirements_and_severe_weather_response",
        "contractor_monitoring_audits_and_reporting",
        "contractor_safety_meetings_and_engagement",
        "sub_tier_contractor_management",
        "project_close_out",
        "checklists_and_inspections",
      ])
    );
    const rolesSection = structuredDraft.sectionMap.find(
      (section) => section.key === "roles_and_responsibilities"
    );
    const securitySection = structuredDraft.sectionMap.find(
      (section) => section.key === "security_and_access_control" && section.subsections?.length
    );

    expect(rolesSection?.title).toBe("3.0 Roles and Responsibilities");
    expect(securitySection).toMatchObject({
      subsections: expect.arrayContaining([
        expect.objectContaining({
          title: "Worker access",
          body: expect.stringContaining("Responsible Party: Superintendent / Foreman"),
        }),
        expect.objectContaining({
          title: "Restricted areas",
          body: expect.stringContaining(
            "trade-specific access-control subsections below"
          ),
        }),
        expect.objectContaining({
          title: "Steel Erection Access Control (Subpart R / ironworker zones)",
          body: expect.stringMatching(/suspended load/i),
        }),
        expect.objectContaining({
          title: "Controlled access below erection",
          body: expect.stringContaining(
            "No unauthorized access below active steel erection"
          ),
        }),
        expect.objectContaining({
          title: "Designated laydown only",
          body: expect.stringMatching(/logistics|crane plan/i),
        }),
      ]),
      table: null,
    });
    expect(
      structuredDraft.sectionMap.find((section) => section.key === "contractor_iipp")
    ).toMatchObject({
      body: expect.stringMatching(
        /Active IIPP: reporting, training records, monitoring, incident response, and corrective follow-up\.[\s\S]*structural steel in scope/i
      ),
      subsections: expect.arrayContaining([
        expect.objectContaining({
          title: "Work Attire Requirements",
          body: expect.stringMatching(/listed only in Required PPE/i),
          bullets: expect.arrayContaining([expect.stringMatching(/sleeves/i)]),
        }),
        expect.objectContaining({
          title: "Required PPE",
          body: expect.stringMatching(/Work Attire Requirements/i),
          bullets: expect.arrayContaining([expect.stringMatching(/Project baseline PPE/i)]),
        }),
        expect.objectContaining({
          title: "5.6 Health and Wellness Expectations",
          body: expect.stringContaining("Project-specific health notes:"),
        }),
        expect.objectContaining({
          title: "5.6.1 Fit for duty",
          body: expect.stringMatching(/Workers must be fit for assigned tasks/i),
        }),
        expect.objectContaining({
          title: "5.6.2 Hydration",
          body: expect.stringMatching(/clean drinking water/i),
        }),
        expect.objectContaining({
          title: "5.6.3 Fatigue management",
          body: expect.stringMatching(/Schedule breaks that match the work and weather/i),
        }),
        expect.objectContaining({
          title: "5.6.4 Sanitation and hygiene",
          body: expect.stringMatching(/restroom and handwashing access/i),
        }),
        expect.objectContaining({
          title: "5.6.5 Exposure management",
          body: expect.stringMatching(/chemical, noise, dust/i),
        }),
        expect.objectContaining({
          title: "5.6.6 Worker wellness / reporting concerns",
          body: expect.stringMatching(/Report injuries, near misses/i),
        }),
        expect.objectContaining({
          title: "5.7 Incident Reporting and Investigation",
          body: expect.stringMatching(/numbered field sequence|Life safety/i),
          bullets: expect.arrayContaining([
            expect.stringMatching(/^1\.\s*Stop work/i),
            expect.stringMatching(/^2\.\s*Call 911/i),
            expect.stringMatching(/^10\.\s*Track follow-up/i),
          ]),
        }),
        expect.objectContaining({
          title: "5.7.1 Project-specific incident reporting notes",
          body: expect.stringMatching(/Notify supervision immediately/i),
        }),
      ]),
    });
    expect(
      structuredDraft.sectionMap.find((section) => section.key === "contractor_safety_meetings_and_engagement")
        ?.subsections?.[0]?.bullets
    ).toEqual(
      expect.arrayContaining([
        "Active scope / rules evaluation: Qualified connector",
        "Active scope / rules evaluation: Signal person",
      ])
    );
    const weatherSection = structuredDraft.sectionMap.find(
      (section) => section.key === "weather_requirements_and_severe_weather_response"
    );
    const weatherMonitoring = weatherSection?.subsections?.find((subsection) =>
      subsection.title?.includes("9.8 Monitoring and communication")
    );
    expect(weatherMonitoring?.body).toEqual(
      expect.stringMatching(/National Weather Service[\s\S]*Superintendent text alert/)
    );
    expect(
      structuredDraft.sectionMap.find((section) => section.key === "sub_tier_contractor_management")
    ).toMatchObject({
      body: "Prequalification, onboarding, documentation turnover, and field oversight expectations.",
      table: {
        rows: expect.arrayContaining([
          expect.arrayContaining([
            "Electrical rough-in below",
            "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
            "Superintendent / Foreman",
          ]),
          expect.arrayContaining([
            "Facade access coordination",
            "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
            "Superintendent / Foreman",
          ]),
        ]),
      },
    });
  });

  it("keeps overlapping-trades output concise and strips conflict-engine dumps", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Riverfront Tower",
          projectAddress: "100 Main St",
          contractorCompany: "ABC Steel",
        },
        scope: {
          trades: ["Steel Erection"],
          subTrades: ["Decking"],
          tasks: ["Install decking"],
          equipment: ["Crane"],
          location: "Level 4",
        },
        operations: [
          {
            operationId: "op-overlap-1",
            tradeCode: "steel",
            tradeLabel: "Steel Erection",
            subTradeCode: "decking",
            subTradeLabel: "Decking",
            taskTitle: "Install decking",
            locationLabel: "Level 4",
            equipmentUsed: ["Crane"],
            workConditions: ["Exterior"],
            hazardHints: ["fall"],
            requiredControlHints: ["controlled_decking_zone"],
            permitHints: ["lift_plan"],
            ppeHints: ["Hard Hat", "Harness"],
          },
        ],
        siteContext: {
          location: "Level 4",
          workConditions: ["Exterior"],
          siteRestrictions: ["Maintain decking exclusion zone."],
          simultaneousOperations: ["Electrical rough-in below"],
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["site_specific_notes", "common_overlapping_trades"],
          selectedFormatSectionKeys: [],
          blockInputs: {
            site_specific_notes: "Coordinate the unloading path with the active facade staging area.",
            common_overlapping_trades: ["Facade access coordination"],
          },
          builderInputHash: "hash-overlap-cleanup",
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
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [
          {
            code: "overlap_1",
            type: "hazard_propagation",
            severity: "high",
            sourceScope: "intra_document",
            rationale: "Facade access overlaps the active decking drop zone.",
            operationIds: ["op-overlap-1"],
            relatedBucketKeys: [],
            requiredMitigations: ["drop_zone_control"],
            permitDependencies: ["lift_plan"],
            resequencingSuggestion: "Separate facade access from lifting windows.",
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
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    expect(draft.sectionMap.find((section) => section.key === "site_specific_notes")?.body).toContain(
      "Coordinate the unloading path with the active facade staging area."
    );
    expect(
      draft.sectionMap.find((section) => section.key === "site_specific_notes")?.body
    ).not.toContain("identified conflict point");

    const overlapSection = draft.sectionMap.find((section) => section.key === "common_overlapping_trades");
    expect(overlapSection).toMatchObject({
      bullets: expect.arrayContaining(["Facade access coordination"]),
      table: null,
    });
    expect(overlapSection?.body).toContain(
      "Coordinate overlapping work areas, workfront access, permit ownership, protection below, and stop-work handoffs before affected crews begin work."
    );
    expect(overlapSection?.body).toContain("structural steel erection");
    expect(overlapSection?.subsections?.length).toBe(16);
    expect(overlapSection?.body).not.toContain("The conflict engine identified");
  });

  it("renders sub-tier contractor management as structured oversight rows without a duplicate intro paragraph", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Tower A",
          projectAddress: "100 Center St",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "Contractor",
        },
        scope: {
          trades: ["Steel Erection"],
          subTrades: ["Structural Steel"],
          tasks: ["Set columns"],
          equipment: ["Crane"],
          location: "Level 4",
        },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "steel_erection",
            tradeLabel: "Steel Erection",
            subTradeCode: "structural_steel",
            subTradeLabel: "Structural Steel",
            taskCode: "set_columns",
            taskTitle: "Set columns",
            description: "Erect structural steel columns",
            equipmentUsed: ["Crane"],
            workConditions: ["Exterior"],
            hazardHints: ["fall"],
            requiredControlHints: ["fall_protection"],
            permitHints: ["lift_plan"],
            ppeHints: ["Hard Hat"],
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
          selectedBlockKeys: ["roles_and_responsibilities", "common_overlapping_trades"],
          selectedFormatSectionKeys: ["sub_tier_contractor_management"],
          blockInputs: {
            roles_and_responsibilities:
              "The superintendent assigns daily work ownership and verifies competent-person coverage before exposed work starts.",
            common_overlapping_trades: ["Fire Protection", "HVAC / Mechanical"],
          },
          builderInputHash: "hash-subtier-only",
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
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {},
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    expect(draft.sectionMap.find((section) => section.key === "sub_tier_contractor_management")).toMatchObject({
      body: null,
      table: {
        columns: ["Oversight Topic", "Requirement", "Responsible Party"],
        rows: expect.arrayContaining([
          expect.arrayContaining([
            "Fire Protection",
            "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
            "Superintendent / Foreman",
          ]),
          expect.arrayContaining([
            "HVAC / Mechanical",
            "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
            "Superintendent / Foreman",
          ]),
          expect.arrayContaining([
            "Electrical rough-in below",
            "Review interfaces, sequencing, shared permits, barricades, and stop-work triggers before work starts.",
            "Superintendent / Foreman",
          ]),
        ]),
      },
    });
  });

  it("reduces repeated reference-pack narrative when structured module rows are present", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Tower A",
          projectAddress: "100 Center St",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "Contractor",
        },
        scope: {
          trades: ["General Conditions / Site Management"],
          subTrades: ["Site supervision"],
          tasks: ["Site setup"],
          equipment: [],
          location: "Site",
        },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "general_conditions",
            tradeLabel: "General Conditions / Site Management",
            subTradeCode: "site_supervision",
            subTradeLabel: "Site supervision",
            taskCode: "site_setup",
            taskTitle: "Site setup",
            description: "Establish barriers and access control.",
            equipmentUsed: [],
            workConditions: [],
            hazardHints: ["struck_by"],
            requiredControlHints: ["barricades"],
            permitHints: [],
            ppeHints: ["Hard Hat"],
            workAreaLabel: "Gate",
            locationGrid: "A1",
            locationLabel: "Gate",
            weatherConditionCode: "clear",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            crewSize: 2,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Site",
          workConditions: [],
          siteRestrictions: [],
          simultaneousOperations: [],
          metadata: {
            taskModules: [
              {
                title: "Access Control",
                moduleKey: "access_control",
                subTrade: "Site supervision",
                taskNames: ["Site setup"],
                summary: "Control entry and movement for workers, visitors, and deliveries.",
                sectionHeadings: ["Unauthorized entry", "Route control"],
                plainText: "Access control details.",
                sourceFilename: "access-control.md",
              },
            ],
          },
          weather: {
            conditionCode: "clear",
            summary: "No weather restrictions were identified.",
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["scope_of_work"],
          blockInputs: {
            scope_of_work: "Establish fencing, signage, and controlled access.",
          },
          builderInputHash: "hash-2",
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
        buckets: [
          {
            bucketKey: "bucket-1",
            bucketType: "task_execution",
            companyId: "company-1",
            jobsiteId: "jobsite-1",
            operationId: "op-1",
            taskTitle: "Site setup",
            tradeCode: "general_conditions",
            subTradeCode: "site_supervision",
            taskCode: "site_setup",
            workAreaLabel: "Gate",
            locationGrid: "A1",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            weatherConditionCode: "clear",
            equipmentUsed: [],
            workConditions: [],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["struck_by"],
            permitTriggers: [],
            requiredControls: ["barricades"],
            ppeRequirements: ["Hard Hat"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            findings: [],
            permitTriggers: [],
            hazardFamilies: ["struck_by"],
            hazardCategories: ["Struck by equipment"],
            ppeRequirements: ["Hard Hat"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["barricades"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 4,
            band: "low",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Structured narrative.",
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const taskModulesSection = draft.sectionMap.find(
      (section) => section.key === "task_modules_reference"
    );
    const jurisdictionProfile = draft.sectionMap.find(
      (section) => section.key === "jurisdiction_profile"
    );

    expect(taskModulesSection).toBeDefined();
    expect(taskModulesSection?.body).toBe(
      "The subsections in this pack are the full task module entries selected for the scope. See Section 11 Hazards and Controls; Section 3 Scope (or trade-specific scope) where the CSEP states how tasks map to the contract; and Appendix E. Task-Hazard-Control Matrix for the task, hazard, and control lines tied to the active work."
    );
    expect(taskModulesSection?.table).toBeUndefined();
    expect(taskModulesSection?.bullets).toBeUndefined();
    expect(taskModulesSection?.subsections?.length).toBeGreaterThan(0);
    expect(jurisdictionProfile?.body).toContain(
      "Wisconsin state-specific building, environmental, and permit requirements may apply"
    );
    expect(jurisdictionProfile?.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Wisconsin Department of Safety and Professional Services"),
        expect.stringContaining("WPDES General Permit WI-S067831-6"),
        expect.stringContaining("wetlands or navigable waters"),
        expect.stringContaining("Asbestos notification for demolition/renovation"),
      ])
    );
  });

  it("omits optional CSEP builder sections when their selected block has no backing data", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Site Setup",
          projectAddress: "1 Main St",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "Contractor",
        },
        scope: {
          trades: ["General Conditions / Site Management"],
          subTrades: ["Site supervision"],
          tasks: ["Site setup"],
          equipment: [],
          location: "Gate",
        },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "general_conditions",
            tradeLabel: "General Conditions / Site Management",
            subTradeCode: "site_supervision",
            subTradeLabel: "Site supervision",
            taskCode: "site_setup",
            taskTitle: "Site setup",
            description: "Establish barriers and access control.",
            equipmentUsed: [],
            workConditions: [],
            hazardHints: [],
            requiredControlHints: ["barricades"],
            permitHints: [],
            ppeHints: [],
            workAreaLabel: "Gate",
            locationGrid: "A1",
            locationLabel: "Gate",
            weatherConditionCode: "clear",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            crewSize: 2,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Gate",
          workConditions: [],
          siteRestrictions: [],
          simultaneousOperations: [],
          metadata: {},
          weather: {
            conditionCode: "clear",
            summary: null,
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: [
            "scope_of_work",
            "required_ppe",
            "additional_permits",
            "common_overlapping_trades",
            "osha_references",
            "selected_hazards",
          ],
          blockInputs: {
            scope_of_work: "Establish fencing, signage, and controlled access.",
            required_ppe: [],
            additional_permits: [],
            common_overlapping_trades: [],
            osha_references: [],
            selected_hazards: [],
          },
          builderInputHash: "hash-empty-optional-sections",
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
        buckets: [
          {
            bucketKey: "bucket-1",
            bucketType: "task_execution",
            companyId: "company-1",
            jobsiteId: "jobsite-1",
            operationId: "op-1",
            taskTitle: "Site setup",
            tradeCode: "general_conditions",
            subTradeCode: "site_supervision",
            taskCode: "site_setup",
            workAreaLabel: "Gate",
            locationGrid: "A1",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            weatherConditionCode: "clear",
            equipmentUsed: [],
            workConditions: [],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: [],
            permitTriggers: [],
            requiredControls: ["barricades"],
            ppeRequirements: [],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            findings: [],
            permitTriggers: [],
            hazardFamilies: [],
            hazardCategories: [],
            ppeRequirements: [],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["barricades"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 4,
            band: "low",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Structured narrative.",
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const keys = draft.sectionMap.map((section) => section.key);

    expect(keys).toContain("scope_of_work");
    expect(keys).not.toContain("required_ppe");
    expect(keys).not.toContain("additional_permits");
    expect(keys).not.toContain("common_overlapping_trades");
    expect(keys).not.toContain("osha_references");
    expect(keys).not.toContain("selected_hazards");
  });

  it("orders PSHSEP with PESHEP core sections ahead of admin appendices", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Refinery Turnaround",
          projectAddress: "500 Plant Rd",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "Contractor",
        },
        scope: {
          trades: ["Electrical"],
          subTrades: [],
          tasks: ["Cable pull"],
          equipment: [],
          location: "Unit 4",
        },
        operations: [
          {
            operationId: "pshsep-op-1",
            taskTitle: "Cable pull",
            equipmentUsed: [],
            workConditions: ["Indoor"],
            hazardHints: ["electrical"],
            requiredControlHints: [],
            permitHints: ["energized_electrical_permit"],
            ppeHints: [],
            metadata: { oshaRefs: ["29 CFR 1926 Subpart K"] },
          },
        ],
        siteContext: {
          location: "Unit 4",
          workConditions: [],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            emergencyMap: {
              aed_location: "South gate trailer",
              assembly_point: "South gravel lot",
              nearest_hospital: "Regional Medical Center",
              emergency_contact: "555-0100",
            },
            starterSections: {
              definitionsText: "Define competent person, ancillary contractor, and IDLH terms.",
              oversightRolesText: "GC safety manager oversees weekly execution reviews.",
              competentPersonRequirementsText:
                "Competent persons are assigned by training and experience.",
              staffingRequirementsText:
                "Add supervision as manpower or simultaneous operations increase.",
              contractorCoordinationText:
                "Coordinate electrical work with adjacent crews and ancillary services.",
              tradeTrainingRequirementsText:
                "Electrical qualifications are required before startup.",
              certificationRequirementsText:
                "Qualified person credentials are maintained in the project file.",
              clinicName: "Plant Clinic",
              clinicAddress: "100 Health Way",
              clinicHours: "24/7",
              inspectionProcessText:
                "Routine and condition-change inspections are tracked on the event calendar.",
              eventCalendarItems: [
                "Routine jobsite inspections",
                "Fire department / EMT walk-through",
              ],
              weatherSopText: "Pause outdoor work when storms or wind exceed project triggers.",
              environmentalControlsText:
                "Protect drains and contain waste during project execution.",
              ppeSpecificsText:
                "Arc-rated PPE and task-specific gloves are identified before work begins.",
              equipmentControlsText:
                "Equipment travel paths and spotter expectations are documented.",
              highRiskFocusAreas: ["LOTO / stored energy isolation"],
              disciplinaryPolicyText: "Discipline content",
              ownerLetterText: "Owner letter content",
              incidentReportingProcessText: "Incident reporting content",
              specialConditionsPermitText: "Special conditions content",
              assumedTradesIndex: ["Electrical", "Mechanical"],
            },
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Crane lift hazards",
            relatedTasks: ["Cable pull"],
            source: "derived",
          },
          {
            category: "ppe",
            item: "Respiratory Protection",
            relatedTasks: ["Cable pull"],
            source: "derived",
          },
        ],
        documentProfile: {
          documentType: "pshsep",
          projectDeliveryType: "renovation",
          source: "builder_submit",
          governingState: "NC",
          jurisdictionCode: "nc",
          jurisdictionLabel: "North Carolina State Plan",
          jurisdictionPlanType: "state_plan",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        documentType: "pshsep",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Narrative content",
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const keys = draft.sectionMap.map((section) => section.key);
    expect(keys.slice(0, 10)).toEqual([
      "definitions",
      "references",
      "jurisdiction_profile",
      "project_oversight_roles",
      "contractor_coordination",
      "incident_injury_response",
      "inspections_recurring_events",
      "weather_environmental_controls",
      "task_hazard_analysis",
      "equipment_conditions",
    ]);
    expect(keys).toEqual(
      expect.arrayContaining([
        "project_overview",
        "training_certifications",
        "emergency_facilities_contacts",
        "ppe_work_access_controls",
        "trade_risk_breakdown",
        "trade_conflict_coordination_framework",
        "program_hazard__crane_lift_hazards__base",
        "program_ppe__respiratory_protection__base",
        "admin_disciplinary_policy",
        "admin_owner_letter",
        "admin_special_conditions_permit",
        "admin_assumed_trades_index",
        "references",
        "jurisdiction_profile",
      ])
    );
    expect(keys.indexOf("references")).toBeLessThan(keys.indexOf("project_overview"));
    expect(keys.indexOf("jurisdiction_profile")).toBeLessThan(keys.indexOf("project_overview"));
    expect(keys.indexOf("admin_assumed_trades_index")).toBeLessThan(
      keys.indexOf("training_certifications")
    );
    expect(
      draft.sectionMap.find((section) => section.key === "emergency_facilities_contacts")?.table
        ?.rows
    ).toEqual(
      expect.arrayContaining([["AED location", "South gate trailer"]])
    );
    expect(
      draft.sectionMap.find((section) => section.key === "trade_conflict_coordination_framework")
        ?.table?.rows[0]
    ).toEqual(
      expect.arrayContaining([
        "1. Existing Conditions / Controls",
        "Project Management / Superintendent",
      ])
    );
    expect(draft.projectDeliveryType).toBe("renovation");
    expect(draft.provenance.jurisdictionCode).toBe("nc");
    expect(draft.provenance.jurisdictionStandardsApplied).toContain("std_nc_state_plan");
  });

  it("surfaces attached Site setup task modules in the generated CSEP draft", () => {
    const taskModules = buildTaskModuleAiContext(getTaskModulesForTask("Site setup"), {
      plainTextMaxLength: 400,
    });

    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Mobilization Yard",
          projectAddress: "45 Project Way",
          contractorCompany: "Site Controls Partner",
        },
        scope: {
          trades: ["General Conditions / Site Management"],
          subTrades: ["Site supervision"],
          tasks: ["Site setup"],
          equipment: [],
          location: "Main gate",
        },
        operations: [
          {
            operationId: "site-op-1",
            tradeCode: "general_conditions_site_management",
            tradeLabel: "General Conditions / Site Management",
            subTradeCode: "site_supervision",
            subTradeLabel: "Site supervision",
            taskCode: "site_setup",
            taskTitle: "Site setup",
            description: "Establish access, barricades, fencing, and startup logistics.",
            equipmentUsed: [],
            workConditions: ["Active deliveries", "Shared haul route"],
            hazardHints: ["struck_by"],
            requiredControlHints: ["traffic_control"],
            permitHints: [],
            ppeHints: ["High Visibility Vest"],
            workAreaLabel: "Main gate",
            locationGrid: "A1",
            locationLabel: "Main gate",
            weatherConditionCode: null,
            startsAt: null,
            endsAt: null,
            crewSize: 3,
            metadata: {
              taskModuleKeys: taskModules.map((item) => item.moduleKey),
            },
          },
        ],
        siteContext: {
          location: "Main gate",
          workConditions: ["Active deliveries", "Shared haul route"],
          siteRestrictions: [],
          simultaneousOperations: ["Earthwork"],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            taskModulePackKey: "general_conditions_site_management_site_setup_modules",
            taskModuleTitles: taskModules.map((item) => item.title),
            taskModules,
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["scope_of_work", "selected_hazards"],
          blockInputs: {
            scope_of_work: "Establish access, barricades, fencing, and startup logistics.",
            selected_hazards: ["Struck by equipment"],
          },
          builderInputHash: "hash-site-setup",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-site-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "site-op-1",
            taskTitle: "Site setup",
            tradeCode: "general_conditions_site_management",
            subTradeCode: "site_supervision",
            taskCode: "site_setup",
            workAreaLabel: "Main gate",
            locationGrid: "A1",
            equipmentUsed: [],
            workConditions: ["Active deliveries", "Shared haul route"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["struck_by"],
            permitTriggers: [],
            requiredControls: ["traffic_control"],
            ppeRequirements: ["High Visibility Vest"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-site-1",
            operationId: "site-op-1",
            findings: [],
            permitTriggers: [],
            hazardFamilies: ["struck_by"],
            hazardCategories: ["Struck by equipment"],
            ppeRequirements: ["High Visibility Vest"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["traffic_control"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 8,
            band: "low",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-site-1",
            operationId: "site-op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const taskModulesSection = draft.sectionMap.find(
      (section) => section.key === "task_modules_reference"
    );

    expect(taskModulesSection).toEqual(
      expect.objectContaining({
        title: "Task Modules Reference Pack",
      })
    );
    expect(taskModulesSection?.table).toBeUndefined();
    expect(taskModulesSection?.bullets).toBeUndefined();
    const labels = [
      "Safety Exposure",
      "Required Safety Controls",
      "Access Restrictions",
      "Required PPE",
      "Required Permits / Hold Points",
      "Stop-Work Triggers",
      "Verification and Handoff / Release",
    ] as const;
    const barricadeSubs =
      taskModulesSection?.subsections?.filter((s) => s.title.startsWith("Barricades — ")) ?? [];
    const accessSubs =
      taskModulesSection?.subsections?.filter((s) => s.title.startsWith("Access Control — ")) ??
      [];
    expect(barricadeSubs).toHaveLength(labels.length);
    expect(accessSubs).toHaveLength(labels.length);
    expect(barricadeSubs.map((s) => s.title)).toEqual(
      labels.map((label) => `Barricades — ${label}`)
    );
    expect(accessSubs.map((s) => s.title)).toEqual(
      labels.map((label) => `Access Control — ${label}`)
    );
    expect(
      barricadeSubs.find((s) => s.title.endsWith("Verification and Handoff / Release"))?.bullets
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Barricades"),
        expect.stringContaining("Barricades, Site setup"),
      ])
    );
    expect(
      accessSubs.find((s) => s.title.endsWith("Verification and Handoff / Release"))?.bullets
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Access Control"),
        expect.stringContaining("Access control, Site setup"),
      ])
    );
  });

  it("surfaces matched hazard modules in the generated CSEP draft before program sections", () => {
    const hazardModules = buildHazardModuleAiContext(
      getHazardModulesForCsepSelection({
        selectedHazards: ["Electrical shock"],
        selectedPermits: ["LOTO Permit"],
        taskNames: ["Temporary power panel setup"],
        tradeLabel: "Electrical",
        subTradeLabel: "Power distribution / feeders / branch power",
      }),
      {
        plainTextMaxLength: 400,
      }
    );

    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Switchgear Upgrade",
          projectAddress: "88 Utility Way",
          contractorCompany: "Voltage Group",
        },
        scope: {
          trades: ["Electrical"],
          subTrades: ["Power distribution / feeders / branch power"],
          tasks: ["Temporary power panel setup"],
          equipment: [],
          location: "Electrical room",
        },
        operations: [
          {
            operationId: "haz-op-1",
            tradeCode: "electrical",
            tradeLabel: "Electrical",
            subTradeCode: "power_distribution",
            subTradeLabel: "Power distribution / feeders / branch power",
            taskCode: "temporary_power_panel_setup",
            taskTitle: "Temporary power panel setup",
            description: "Install and protect temporary power panel setup.",
            equipmentUsed: [],
            workConditions: ["Temporary power"],
            hazardHints: ["electrical"],
            requiredControlHints: ["loto"],
            permitHints: ["energized_electrical_permit"],
            ppeHints: ["Safety Glasses"],
            metadata: {
              hazardModuleKeys: hazardModules.map((item) => item.moduleKey),
            },
          },
        ],
        siteContext: {
          location: "Electrical room",
          workConditions: ["Temporary power"],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            hazardModulePackKey: "csep_hazard_modules_matched_subset",
            hazardModuleTitles: hazardModules.map((item) => item.title),
            hazardModules,
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Electrical shock",
            relatedTasks: ["Temporary power panel setup"],
            source: "selected",
          },
        ],
        builderInstructions: {
          selectedBlockKeys: ["scope_of_work", "selected_hazards"],
          blockInputs: {
            scope_of_work: "Install and protect temporary power panel setup.",
            selected_hazards: ["Electrical shock"],
          },
          builderInputHash: "hash-hazard-elements",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-hazard-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "haz-op-1",
            taskTitle: "Temporary power panel setup",
            tradeCode: "electrical",
            subTradeCode: "power_distribution",
            taskCode: "temporary_power_panel_setup",
            workAreaLabel: "Electrical room",
            locationGrid: "E1",
            equipmentUsed: [],
            workConditions: ["Temporary power"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["electrical"],
            permitTriggers: ["energized_electrical_permit"],
            requiredControls: ["loto"],
            ppeRequirements: ["Safety Glasses"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-hazard-1",
            operationId: "haz-op-1",
            findings: [],
            permitTriggers: ["energized_electrical_permit"],
            hazardFamilies: ["electrical"],
            hazardCategories: ["Electrical shock"],
            ppeRequirements: ["Safety Glasses"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["loto"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 10,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-hazard-1",
            operationId: "haz-op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const hazardModulesSection = draft.sectionMap.find(
      (section) => section.key === "hazard_modules_reference"
    );

    expect(hazardModulesSection).toEqual(
      expect.objectContaining({
        title: "Hazard Modules Reference Pack",
      })
    );
    expect(hazardModulesSection?.table).toBeUndefined();
    expect(hazardModulesSection?.bullets).toBeUndefined();
    expect(hazardModulesSection?.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Electrical Safety and Temporary Power",
          bullets: expect.arrayContaining([
            expect.stringContaining("Hazard overview:"),
            expect.stringContaining("Pre-start verification:"),
            expect.stringContaining("Required controls:"),
            expect.stringContaining("Permits and PPE:"),
            expect.stringContaining("Stop-work triggers:"),
            expect.stringContaining("Verification and handoff:"),
            expect.stringContaining("Related interfaces:"),
          ]),
        }),
        expect.objectContaining({
          title: "Lockout Tagout and Hazardous Energy Control",
          bullets: expect.arrayContaining([
            expect.stringContaining("Hazard overview:"),
            expect.stringContaining("Pre-start verification:"),
            expect.stringContaining("Required controls:"),
            expect.stringContaining("Permits and PPE:"),
            expect.stringContaining("Stop-work triggers:"),
            expect.stringContaining("Verification and handoff:"),
            expect.stringContaining("Related interfaces:"),
          ]),
        }),
      ])
    );
    expect(draft.sectionMap.map((section) => section.key).indexOf("hazard_modules_reference")).toBeGreaterThan(
      draft.sectionMap.map((section) => section.key).indexOf("selected_hazards")
    );
    expect(draft.sectionMap.map((section) => section.key).indexOf("hazard_modules_reference")).toBeLessThan(
      draft.sectionMap
        .map((section) => section.key)
        .indexOf("program_hazard__electrical_shock__base")
    );
  });

  it("surfaces steel reference packs in the generated CSEP draft before program sections", () => {
    const steelTaskModules = buildSteelErectionTaskModuleAiContext(
      getSteelErectionTaskModulesForCsepSelection({
        tradeLabel: "Structural Steel / Metals",
        subTradeLabel: "Steel erection / decking",
        taskNames: ["Column erection", "Decking install", "Welding"],
      }),
      {
        plainTextMaxLength: 400,
      }
    );
    const steelHazardModules = buildSteelErectionHazardModuleAiContext(
      getSteelErectionHazardModulesForCsepSelection({
        selectedHazards: [
          "Falls from height",
          "Falling object hazards",
          "Rigging and lifting hazards",
        ],
        selectedPermits: ["Lift Plan"],
        taskNames: ["Column erection", "Decking install", "Welding"],
        tradeLabel: "Structural Steel / Metals",
        subTradeLabel: "Steel erection / decking",
      }),
      {
        plainTextMaxLength: 400,
      }
    );
    const steelProgramModules = buildSteelErectionProgramModuleAiContext(
      getSteelErectionProgramModulesForCsepSelection({
        programSelections: [
          {
            category: "hazard",
            item: "Falls from height",
            relatedTasks: ["Decking install"],
            source: "selected",
          },
          {
            category: "hazard",
            item: "Crane lift hazards",
            relatedTasks: ["Column erection"],
            source: "derived",
          },
        ],
        selectedHazards: [
          "Falls from height",
          "Falling objects",
          "Crane lift hazards",
        ],
        selectedPermits: ["Lift Plan"],
        taskNames: ["Column erection", "Decking install", "Welding"],
        tradeLabel: "Structural Steel / Metals",
        subTradeLabel: "Steel erection / decking",
      }),
      {
        plainTextMaxLength: 400,
      }
    );

    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Steel Frame Package",
          projectAddress: "1200 Erector Rd",
          contractorCompany: "Steel Frame Partner",
        },
        scope: {
          trades: ["Structural Steel / Metals"],
          subTrades: ["Steel erection / decking"],
          tasks: ["Column erection", "Decking install", "Welding"],
          equipment: ["Crawler crane"],
          location: "Grid A",
        },
        operations: [
          {
            operationId: "steel-op-1",
            tradeCode: "structural_steel",
            tradeLabel: "Structural Steel / Metals",
            subTradeCode: "steel_erection",
            subTradeLabel: "Steel erection / decking",
            taskCode: "column_erection",
            taskTitle: "Column erection",
            description: "Set columns and start decking and connection work.",
            equipmentUsed: ["Crawler crane"],
            workConditions: ["Leading edge", "Active lift path"],
            hazardHints: ["fall", "overhead_work"],
            requiredControlHints: ["fall_protection", "drop_zone_control"],
            permitHints: ["lift_plan"],
            ppeHints: ["Hard Hat", "Fall Protection Harness"],
            metadata: {
              steelTaskModuleKeys: steelTaskModules.map((item) => item.moduleKey),
              steelHazardModuleKeys: steelHazardModules.map((item) => item.moduleKey),
              steelProgramModuleKeys: steelProgramModules.map((item) => item.moduleKey),
            },
          },
        ],
        siteContext: {
          location: "Grid A",
          workConditions: ["Leading edge", "Active lift path"],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            steelTaskModulePackKey: "steel_erection_task_modules_matched_subset",
            steelTaskModuleTitles: steelTaskModules.map((item) => item.title),
            steelTaskModules,
            steelHazardModulePackKey: "steel_erection_hazard_modules_matched_subset",
            steelHazardModuleTitles: steelHazardModules.map((item) => item.title),
            steelHazardModules,
            steelProgramModulePackKey: "steel_erection_program_modules_matched_subset",
            steelProgramModuleTitles: steelProgramModules.map((item) => item.title),
            steelProgramModules,
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Falls from height",
            relatedTasks: ["Decking install"],
            source: "selected",
          },
          {
            category: "hazard",
            item: "Crane lift hazards",
            relatedTasks: ["Column erection"],
            source: "derived",
          },
        ],
        builderInstructions: {
          selectedBlockKeys: ["scope_of_work", "selected_hazards"],
          blockInputs: {
            scope_of_work: "Set columns, spread decking, and complete steel connections.",
            selected_hazards: ["Falls from height", "Crane lift hazards"],
          },
          builderInputHash: "hash-steel-csep",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const keys = draft.sectionMap.map((section) => section.key);
    const firstProgramIndex = keys.findIndex((key) => key.startsWith("program_"));
    const steelTaskSection = draft.sectionMap.find(
      (section) => section.key === "steel_task_modules_reference"
    );
    const steelHazardSection = draft.sectionMap.find(
      (section) => section.key === "steel_hazard_modules_reference"
    );
    const steelProgramSection = draft.sectionMap.find(
      (section) => section.key === "steel_program_modules_reference"
    );

    expect(steelTaskSection).toEqual(
      expect.objectContaining({
        title: "Steel Erection Task Modules Reference Pack",
      })
    );
    expect(steelHazardSection).toEqual(
      expect.objectContaining({
        title: "Steel Erection Hazard Modules Reference Pack",
      })
    );
    expect(steelProgramSection).toEqual(
      expect.objectContaining({
        title: "Steel Erection High-Risk Programs Reference Pack",
      })
    );
    expect(steelTaskSection?.table).toBeUndefined();
    expect(steelHazardSection?.table).toBeUndefined();
    expect(steelProgramSection?.table).toBeUndefined();
    expect(steelTaskSection?.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("Setting Columns and Base Lines"),
        }),
        expect.objectContaining({
          title: expect.stringContaining("Installing Metal Decking and Controlling Openings"),
        }),
      ])
    );
    expect(steelHazardSection?.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fall Exposure" }),
        expect.objectContaining({ title: "Hoisting and Rigging" }),
      ])
    );
    expect(steelProgramSection?.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Leading Edge and Connector Work Program" }),
        expect.objectContaining({
          title: "Controlled Decking Zone and Decking Access Program",
        }),
      ])
    );
    expect(keys.indexOf("steel_task_modules_reference")).toBeGreaterThan(
      keys.indexOf("selected_hazards")
    );
    expect(keys.indexOf("steel_program_modules_reference")).toBeLessThan(firstProgramIndex);
  });

  it("surfaces steel reference packs once in the generated PSHSEP draft", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Steel Expansion",
          projectAddress: "900 Fabrication Way",
          contractorCompany: "Steel Systems Group",
        },
        scope: {
          trades: ["Steel Erection"],
          subTrades: [],
          tasks: ["Steel Erection"],
          equipment: [],
          location: "North bay",
        },
        operations: [
          {
            operationId: "pshsep-steel-op-1",
            tradeCode: "steel_erection",
            tradeLabel: "Steel Erection",
            subTradeCode: null,
            subTradeLabel: null,
            taskCode: "steel_erection",
            taskTitle: "Steel Erection",
            description: "Coordinate steel erection, decking, and rigging phases.",
            equipmentUsed: [],
            workConditions: ["Open structure"],
            hazardHints: [],
            requiredControlHints: [],
            permitHints: [],
            ppeHints: [],
            metadata: {
              exportProgramIds: ["steel_erection", "crane_rigging", "fall_protection"],
              steelTaskModuleKeys: [
                "steel_pre_erection_planning_and_site_readiness",
              ],
              steelHazardModuleKeys: [
                "steel_fall_exposure",
                "steel_hoisting_and_rigging",
              ],
              steelProgramModuleKeys: [
                "steel_leading_edge_and_connector_work_program",
                "steel_hoisting_and_rigging_program",
              ],
            },
          },
        ],
        siteContext: {
          location: "North bay",
          workConditions: ["Open structure"],
          siteRestrictions: [],
          simultaneousOperations: ["Steel Erection"],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            starterSections: {
              highRiskFocusAreas: ["Steel erection / rigging", "Ladders / scaffolds / access"],
              assumedTradesIndex: ["Steel Erection"],
            },
            exportProgramIds: ["steel_erection", "crane_rigging", "fall_protection"],
            steelTaskModulePackKey: "steel_erection_task_modules_matched_subset",
            steelTaskModuleTitles: ["Pre-Erection Planning and Site Readiness"],
            steelTaskModules: [
              {
                title: "Pre-Erection Planning and Site Readiness",
                moduleKey: "steel_pre_erection_planning_and_site_readiness",
                trade: "Steel Erection",
                subTrade: "Steel erection / decking",
                taskNames: ["Pre-erection planning", "Site readiness"],
                summary:
                  "Verifying site conditions, support readiness, notifications, access, and sequence before steel erection starts",
                sectionHeadings: ["1. Task Scope & Work Conditions"],
                plainText: "Short steel task reference context.",
                sourceFilename: "Task_01_Pre_Erection_Planning_and_Site_Readiness.docx",
              },
            ],
            steelHazardModulePackKey: "steel_erection_hazard_modules_matched_subset",
            steelHazardModuleTitles: ["Fall Exposure", "Hoisting and Rigging"],
            steelHazardModules: [
              {
                title: "Fall Exposure",
                moduleKey: "steel_fall_exposure",
                summary:
                  "Unprotected edges, incomplete floors, connector work, deck edges, and openings during steel erection",
                sectionHeadings: ["1. Risks & Hazards"],
                plainText: "Short steel hazard reference context.",
                sourceFilename: "Hazard_01_Fall_Exposure.docx",
                matchedReasons: ["PSHSEP scope matched steel work."],
              },
              {
                title: "Hoisting and Rigging",
                moduleKey: "steel_hoisting_and_rigging",
                summary:
                  "Suspended loads, crane interaction, rigging failure, and multiple-lift exposure during steel erection",
                sectionHeadings: ["1. Risks & Hazards"],
                plainText: "Short steel hazard reference context.",
                sourceFilename: "Hazard_02_Hoisting_and_Rigging.docx",
                matchedReasons: ["PSHSEP export program matched steel work."],
              },
            ],
            steelProgramModulePackKey: "steel_erection_program_modules_matched_subset",
            steelProgramModuleTitles: [
              "Leading Edge and Connector Work Program",
              "Hoisting and Rigging Program",
            ],
            steelProgramModules: [
              {
                title: "Leading Edge and Connector Work Program",
                moduleKey: "steel_leading_edge_and_connector_work_program",
                summary:
                  "Step-by-step field program for leading edge work, connector exposure, tie-off decisions, and access control during steel erection",
                sectionHeadings: ["1. Program Purpose and Applicability"],
                plainText: "Short steel program reference context.",
                sourceFilename: "01_Leading_Edge_and_Connector_Work_Program.docx",
                matchedReasons: ["PSHSEP scope matched steel work."],
              },
              {
                title: "Hoisting and Rigging Program",
                moduleKey: "steel_hoisting_and_rigging_program",
                summary:
                  "Step-by-step field program for crane picks, rigging inspection, load path control, and suspended-load exposure reduction",
                sectionHeadings: ["1. Program Purpose and Applicability"],
                plainText: "Short steel program reference context.",
                sourceFilename: "04_Hoisting_and_Rigging_Program.docx",
                matchedReasons: ["PSHSEP export program matched steel work."],
              },
            ],
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Crane lift hazards",
            relatedTasks: ["Steel Erection"],
            source: "derived",
          },
          {
            category: "hazard",
            item: "Falls from height",
            relatedTasks: ["Steel Erection"],
            source: "derived",
          },
        ],
        documentProfile: {
          documentType: "pshsep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "pshsep",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const keys = draft.sectionMap.map((section) => section.key);
    const firstProgramIndex = keys.findIndex((key) => key.startsWith("program_"));

    expect(keys.filter((key) => key === "steel_task_modules_reference")).toHaveLength(1);
    expect(keys.filter((key) => key === "steel_hazard_modules_reference")).toHaveLength(1);
    expect(keys.filter((key) => key === "steel_program_modules_reference")).toHaveLength(1);
    expect(
      draft.sectionMap.find((section) => section.key === "steel_task_modules_reference")?.table
    ).toBeUndefined();
    expect(
      draft.sectionMap.find((section) => section.key === "steel_hazard_modules_reference")?.table
    ).toBeUndefined();
    expect(
      draft.sectionMap.find((section) => section.key === "steel_program_modules_reference")?.table
    ).toBeUndefined();
    expect(
      draft.sectionMap.find((section) => section.key === "steel_task_modules_reference")
        ?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("Pre-Erection Planning and Site Readiness"),
        }),
      ])
    );
    expect(
      draft.sectionMap.find((section) => section.key === "steel_hazard_modules_reference")
        ?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fall Exposure" }),
        expect.objectContaining({ title: "Hoisting and Rigging" }),
      ])
    );
    expect(
      draft.sectionMap.find((section) => section.key === "steel_program_modules_reference")
        ?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Leading Edge and Connector Work Program" }),
        expect.objectContaining({ title: "Hoisting and Rigging Program" }),
      ])
    );
    expect(keys.indexOf("steel_program_modules_reference")).toBeLessThan(firstProgramIndex);
  });

  it("uses operational fallback text when reference-pack metadata is sparse", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Fallback Pack Check",
          projectAddress: "1 Default Ln",
          contractorCompany: "Fallback Builder",
        },
        scope: {
          trades: ["General Conditions / Site Management"],
          subTrades: ["Site supervision"],
          tasks: ["Site setup"],
          equipment: [],
          location: "North gate",
        },
        operations: [
          {
            operationId: "fallback-op-1",
            tradeCode: "general_conditions_site_management",
            tradeLabel: "General Conditions / Site Management",
            subTradeCode: "site_supervision",
            subTradeLabel: "Site supervision",
            taskCode: "site_setup",
            taskTitle: "Site setup",
            description: "Minimal setup activity.",
            equipmentUsed: [],
            workConditions: [],
            hazardHints: [],
            requiredControlHints: [],
            permitHints: [],
            ppeHints: [],
            metadata: {},
          },
        ],
        siteContext: {
          location: "North gate",
          workConditions: [],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            taskModules: [
              {
                title: "Fallback Task Module",
                moduleKey: "fallback_task_module",
                summary: "Task fallback summary.",
                sectionHeadings: [],
                plainText: "Task fallback plain text.",
                sourceFilename: "fallback-task-module.md",
              },
            ],
            hazardModules: [
              {
                title: "Fallback Hazard Module",
                moduleKey: "fallback_hazard_module",
                summary: "Hazard fallback summary.",
                sectionHeadings: [],
                plainText: "Hazard fallback plain text.",
                sourceFilename: "fallback-hazard-module.md",
                matchedReasons: [],
              },
            ],
            steelTaskModules: [
              {
                title: "Fallback Steel Task Module",
                moduleKey: "fallback_steel_task_module",
                summary: "Steel task fallback summary.",
                sectionHeadings: [],
                plainText: "Steel task fallback plain text.",
                sourceFilename: "fallback-steel-task-module.md",
                taskNames: [],
              },
            ],
            steelHazardModules: [
              {
                title: "Fallback Steel Hazard Module",
                moduleKey: "fallback_steel_hazard_module",
                summary: "Steel hazard fallback summary.",
                sectionHeadings: [],
                plainText: "Steel hazard fallback plain text.",
                sourceFilename: "fallback-steel-hazard-module.md",
                matchedReasons: [],
              },
            ],
            steelProgramModules: [
              {
                title: "Fallback Steel Program Module",
                moduleKey: "fallback_steel_program_module",
                summary: "Steel program fallback summary.",
                sectionHeadings: [],
                plainText: "Steel program fallback plain text.",
                sourceFilename: "fallback-steel-program-module.md",
                matchedReasons: [],
              },
            ],
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["scope_of_work", "selected_hazards"],
          blockInputs: {
            scope_of_work: "Minimal setup activity.",
            selected_hazards: [],
          },
          builderInputHash: "fallback-pack-hash",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    expect(
      draft.sectionMap.find((section) => section.key === "task_modules_reference")?.subsections
    ).toEqual([
      expect.objectContaining({
        title: "Fallback Task Module — Safety Exposure",
        body: "Task fallback summary.",
        bullets: expect.arrayContaining([
          expect.stringContaining("Primary safety exposures for this plan fragment align with: Task fallback summary."),
        ]),
      }),
      expect.objectContaining({
        title: "Fallback Task Module — Required Safety Controls",
        body: null,
        bullets: expect.arrayContaining([
          expect.stringContaining(
            "Establish and maintain engineered or administrative controls"
          ),
        ]),
      }),
      expect.objectContaining({
        title: "Fallback Task Module — Access Restrictions",
        body: null,
        bullets: expect.arrayContaining([
          expect.stringContaining("Restrict entry to trained, authorized personnel"),
        ]),
      }),
      expect.objectContaining({
        title: "Fallback Task Module — Required PPE",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("project baseline PPE")]),
      }),
      expect.objectContaining({
        title: "Fallback Task Module — Required Permits / Hold Points",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Confirm whether this activity interfaces")]),
      }),
      expect.objectContaining({
        title: "Fallback Task Module — Stop-Work Triggers",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Stop work if a route")]),
      }),
      expect.objectContaining({
        title: "Fallback Task Module — Verification and Handoff / Release",
        body: null,
        bullets: expect.arrayContaining([
          expect.stringContaining("Fallback Task Module"),
          expect.stringContaining("follow-on tasks"),
        ]),
      }),
    ]);
    expect(
      draft.sectionMap.find((section) => section.key === "hazard_modules_reference")?.subsections
    ).toEqual([
      expect.objectContaining({
        body: "Hazard fallback summary.",
        title: "Fallback Hazard Module",
        bullets: expect.arrayContaining([
          expect.stringContaining("Hazard overview: Hazard fallback summary."),
          expect.stringContaining("Pre-start verification:"),
          expect.stringContaining("Required controls:"),
          expect.stringContaining("Permits and PPE:"),
          expect.stringContaining("Stop-work triggers:"),
          expect.stringContaining("Verification and handoff:"),
          expect.stringContaining("Related interfaces:"),
        ]),
      }),
    ]);
    expect(
      draft.sectionMap.find((section) => section.key === "steel_task_modules_reference")
        ?.subsections
    ).toEqual([
      expect.objectContaining({
        title: "Fallback Steel Task Module — Safety Exposure",
        body: "Steel task fallback summary.",
        bullets: expect.arrayContaining([
          expect.stringContaining("Workers may be exposed to suspended loads"),
        ]),
      }),
      expect.objectContaining({
        title: "Fallback Steel Task Module — Required Safety Controls",
        body: null,
        bullets: expect.arrayContaining([
          expect.stringContaining("Establish the controlled steel-erection zone"),
        ]),
      }),
      expect.objectContaining({
        title: "Fallback Steel Task Module — Access Restrictions",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Limit entry to trained crew")]),
      }),
      expect.objectContaining({
        title: "Fallback Steel Task Module — Required PPE",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Hard hat, safety glasses")]),
      }),
      expect.objectContaining({
        title: "Fallback Steel Task Module — Required Permits / Hold Points",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Confirm the active permit")]),
      }),
      expect.objectContaining({
        title: "Fallback Steel Task Module — Stop-Work Triggers",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Stop work and reassess")]),
      }),
      expect.objectContaining({
        title: "Fallback Steel Task Module — Verification and Handoff / Release",
        body: null,
        bullets: expect.arrayContaining([expect.stringContaining("Document the pre-task brief")]),
      }),
    ]);
    expect(
      draft.sectionMap.find((section) => section.key === "steel_hazard_modules_reference")
        ?.subsections
    ).toEqual([
      expect.objectContaining({
        body: "Steel hazard fallback summary.",
        title: "Fallback Steel Hazard Module",
        bullets: expect.arrayContaining([
          expect.stringContaining("Hazard focus: Steel hazard fallback summary."),
          expect.stringContaining("Safety Exposure:"),
          expect.stringContaining("Required Safety Controls:"),
          expect.stringContaining("Access Restrictions:"),
          expect.stringContaining("Required PPE:"),
          expect.stringContaining("Required Permits / Hold Points:"),
          expect.stringContaining("Stop-Work Triggers:"),
          expect.stringContaining("Verification and Handoff / Release:"),
        ]),
      }),
    ]);
    expect(
      draft.sectionMap.find((section) => section.key === "steel_program_modules_reference")
        ?.subsections
    ).toEqual([
      expect.objectContaining({
        body: "Steel program fallback summary.",
        title: "Fallback Steel Program Module",
        bullets: expect.arrayContaining([
          expect.stringContaining("Program scope: Steel program fallback summary."),
          expect.stringContaining("Pre-start verification:"),
          expect.stringContaining("Required controls:"),
          expect.stringContaining("Permits and PPE:"),
          expect.stringContaining("Stop-work triggers:"),
          expect.stringContaining("Verification and handoff:"),
          expect.stringContaining("Related interfaces:"),
        ]),
      }),
    ]);
  });

  it("strips source child numbering labels from steel task module snippets", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Steel Delivery",
          projectAddress: "10 Yard Rd",
          contractorCompany: "ABC Steel",
        },
        scope: {
          trades: ["Steel Erection"],
          subTrades: ["Steel erection / decking"],
          tasks: ["Unload steel"],
          equipment: ["Crane"],
          location: "Laydown yard",
        },
        operations: [
          {
            operationId: "steel-unload-1",
            tradeCode: "steel_erection",
            tradeLabel: "Steel Erection",
            subTradeCode: "steel_erection_decking",
            subTradeLabel: "Steel erection / decking",
            taskCode: "unload_steel",
            taskTitle: "Unload steel",
            description: "Unload and stage delivered steel.",
            equipmentUsed: ["Crane"],
            workConditions: ["Laydown yard"],
            hazardHints: [],
            requiredControlHints: [],
            permitHints: [],
            ppeHints: [],
            metadata: {},
          },
        ],
        siteContext: {
          location: "Laydown yard",
          workConditions: ["Laydown yard"],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {
            steelTaskModules: [
              {
                title: "Receiving, Unloading, Inspecting and Staging Steel",
                moduleKey: "steel_receiving_unloading_inspecting_and_staging",
                summary:
                  "Material delivery, shakeout, laydown order, site inspection, and preparation of steel for safe erection.",
                taskNames: ["Unload steel", "Sort members"],
                sourceFilename: "Task_02_Receiving_Unloading.docx",
                sectionHeadings: [
                  "3. Required Equipment and Access",
                  "4. Hazards & Controls",
                ],
                plainText: [
                  "RECEIVING, UNLOADING, INSPECTING, AND STAGING STEEL MODULE",
                  "",
                  "3. Required Equipment and Access",
                  "",
                  "3.1 Core equipment  Typical equipment includes lifting equipment, approved rigging, tag lines, dunnage, radios, inspection paperwork, and access-control devices for the unloading zone.",
                  "",
                  "4. Hazards & Controls",
                  "",
                  "4.2 Primary controls  Primary controls for the task include pre-positioned blocking, controlled hook-up, exclusion zones, clear communication, immediate damage reporting, and staging by erection sequence rather than convenience.",
                ].join("\n"),
              },
            ],
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["scope_of_work"],
          blockInputs: {
            scope_of_work: "Unload and stage delivered steel.",
          },
          builderInputHash: "steel-unload-hash",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const steelControlsSubsection = draft.sectionMap
      .find((section) => section.key === "steel_task_modules_reference")
      ?.subsections?.find(
        (subsection) =>
          subsection.title.startsWith("Receiving, Unloading") &&
          subsection.title.includes("Required Safety Controls")
      );

    const controlsText = steelControlsSubsection?.bullets.join("\n") ?? "";
    const leadControlsBullet = steelControlsSubsection?.bullets.find((bullet) =>
      bullet.startsWith("Establish the controlled steel-erection zone")
    );

    expect(leadControlsBullet).toBe(
      "Establish the controlled steel-erection zone, maintain the approved sequence, keep the frame stable at every stage, protect workers below from falling objects and line-of-fire exposures, and correct drift immediately when field conditions change. Controls stay in effect until the task is complete and formally released."
    );
    expect(steelControlsSubsection?.bullets).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Trigger / reference:")])
    );
    expect(controlsText).not.toContain("3.1 Core equipment");
    expect(controlsText).not.toContain("4.2 Primary controls");
    expect(controlsText.toLowerCase()).toContain("exclusion");
  });

  it("extractInlineOshaSuffix matches legacy narrative tails (regression)", () => {
    const value =
      "Steel erection at elevation requires coordinated access and tie-off. Applicable OSHA references: OSHA 1926 Subpart M - Fall Protection.";
    const match = value.match(
      /^(.*?)(?:\s*Applicable OSHA references(?:\s*\([^)]*\))?:\s*(.+?)\.\s*)$/i
    );
    expect(match?.[2]).toBe("OSHA 1926 Subpart M - Fall Protection");
  });

  it("dedupes overlapping fall-protection sections and strips repeated inline OSHA tails", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "North Tower",
          projectAddress: "200 Center St",
          contractorCompany: "Access Partner",
        },
        scope: {
          trades: ["Steel"],
          subTrades: ["Ironworker"],
          tasks: ["Install edge steel"],
          equipment: ["MEWP"],
          location: "Level 5",
        },
        operations: [
          {
            operationId: "fall-op-1",
            tradeCode: "steel",
            tradeLabel: "Steel",
            subTradeCode: "ironworker",
            subTradeLabel: "Ironworker",
            taskCode: "install_edge_steel",
            taskTitle: "Install edge steel",
            description: "Set edge steel and connect members at elevation.",
            equipmentUsed: ["MEWP"],
            workConditions: ["Elevated edge"],
            hazardHints: ["fall"],
            requiredControlHints: ["fall_protection"],
            permitHints: ["elevated_work_notice"],
            ppeHints: ["Fall Protection Harness"],
            metadata: {},
          },
        ],
        siteContext: {
          location: "Level 5",
          workConditions: ["Elevated edge"],
          siteRestrictions: ["Tie-off required at the deck edge."],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Falls from height",
            relatedTasks: ["Install edge steel"],
            source: "selected",
          },
          {
            category: "ppe",
            item: "Fall Protection Harness",
            relatedTasks: ["Install edge steel"],
            source: "selected",
          },
        ],
        builderInstructions: {
          selectedBlockKeys: ["trade_summary", "required_ppe", "selected_hazards"],
          blockInputs: {
            trade_summary: "Elevated structural steel connection work.",
            required_ppe: ["Fall Protection Harness"],
            selected_hazards: ["Falls from height"],
          },
          builderInputHash: "hash-fall-dedupe",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-fall-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "fall-op-1",
            taskTitle: "Install edge steel",
            tradeCode: "steel",
            subTradeCode: "ironworker",
            taskCode: "install_edge_steel",
            workAreaLabel: "Level 5",
            locationGrid: "L5",
            equipmentUsed: ["MEWP"],
            workConditions: ["Elevated edge"],
            siteRestrictions: ["Tie-off required at the deck edge."],
            prohibitedEquipment: [],
            hazardFamilies: ["fall"],
            permitTriggers: ["elevated_work_notice"],
            requiredControls: ["fall_protection"],
            ppeRequirements: ["Fall Protection Harness"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-fall-1",
            operationId: "fall-op-1",
            findings: [],
            permitTriggers: ["elevated_work_notice"],
            hazardFamilies: ["fall"],
            hazardCategories: ["Falls from height"],
            ppeRequirements: ["Fall Protection Harness"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["fall_protection"],
            siteRestrictions: ["Tie-off required at the deck edge."],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 14,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-fall-1",
            operationId: "fall-op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        tradeBreakdownSummary:
          "Steel erection at elevation requires coordinated access and tie-off. Applicable OSHA references: OSHA 1926 Subpart M - Fall Protection.",
        riskPrioritySummary:
          "Maintain continuous tie-off and protect exposed edges. Applicable OSHA references: OSHA 1926 Subpart M - Fall Protection.",
        requiredControlsSummary:
          "Fall arrest systems and compatible anchors are required. Applicable OSHA references: OSHA 1926 Subpart M - Fall Protection.",
        safetyNarrative:
          "This draft addresses elevated steel work and fall exposure. Applicable OSHA references: OSHA 1926 Subpart M - Fall Protection.",
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const titles = draft.sectionMap.map((section) => section.title);

    expect(new Set(draft.sectionMap.map((section) => section.key)).size).toBe(draft.sectionMap.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toContain("Fall Protection Program");
    expect(titles).not.toContain("Personal Fall Arrest Equipment Program");
    expect(
      draft.sectionMap.some((section) => {
        const texts = [
          section.summary,
          section.body,
          ...(section.bullets ?? []),
          ...(section.subsections ?? []).flatMap((subsection) => [
            subsection.body ?? "",
            ...(subsection.bullets ?? []),
          ]),
        ].filter(Boolean);
        return texts.some((text) => {
          if (typeof text !== "string" || !text.trim()) return false;
          const t = text.trim();
          return (
            text.includes("(R2)") ||
            text.includes("Applicable OSHA references (Appendix G):") ||
            /^R2$/i.test(t) ||
            /^R2\s+OSHA/i.test(t)
          );
        });
      })
    ).toBe(true);

    expect(
      draft.sectionMap.some((section) => {
        const allBullets = [
          ...(section.bullets ?? []),
          ...(section.subsections ?? []).flatMap((subsection) => subsection.bullets ?? []),
        ];
        return allBullets.some((b) => /^R2\s+OSHA 29 CFR 1926 Subpart M/i.test(b));
      })
    ).toBe(true);
  });

  it("compacts narrative-heavy CSEP drafts while keeping required sections intact", () => {
    const longNarrative =
      "Coordinate access, housekeeping, permitting, supervision, and startup sequencing before work begins. ".repeat(
        500
      );

    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Mega Campus",
          projectAddress: "1 Long Form Way",
          contractorCompany: "General Trades Partner",
        },
        scope: {
          trades: ["General Conditions / Site Management"],
          subTrades: ["Site supervision"],
          tasks: ["Site setup", "Traffic control", "Housekeeping"],
          equipment: ["Pickup"],
          location: "Main logistics yard",
        },
        operations: [
          {
            operationId: "budget-op-1",
            tradeCode: "general_conditions_site_management",
            tradeLabel: "General Conditions / Site Management",
            subTradeCode: "site_supervision",
            subTradeLabel: "Site supervision",
            taskCode: "site_setup",
            taskTitle: "Site setup",
            description: longNarrative,
            equipmentUsed: ["Pickup"],
            workConditions: ["Shared access roads"],
            hazardHints: ["struck_by"],
            requiredControlHints: ["traffic_control"],
            permitHints: [],
            ppeHints: ["High Visibility Vest"],
            metadata: {},
          },
        ],
        siteContext: {
          location: "Main logistics yard",
          workConditions: ["Shared access roads"],
          siteRestrictions: ["Maintain clear emergency access."],
          simultaneousOperations: ["Earthwork", "Concrete"],
          weather: {
            conditionCode: null,
            summary: null,
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Struck by equipment",
            relatedTasks: ["Site setup"],
            source: "selected",
          },
        ],
        builderInstructions: {
          selectedBlockKeys: [
            "trade_summary",
            "scope_of_work",
            "site_specific_notes",
            "emergency_procedures",
            "required_ppe",
            "selected_hazards",
            "activity_hazard_matrix",
          ],
          blockInputs: {
            trade_summary: longNarrative,
            scope_of_work: longNarrative,
            site_specific_notes: longNarrative,
            emergency_procedures: longNarrative,
            required_ppe: ["High Visibility Vest"],
            selected_hazards: ["Struck by equipment"],
          },
          builderInputHash: "hash-soft-budget",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-budget-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "budget-op-1",
            taskTitle: "Site setup",
            tradeCode: "general_conditions_site_management",
            subTradeCode: "site_supervision",
            taskCode: "site_setup",
            workAreaLabel: "Main logistics yard",
            locationGrid: "A1",
            equipmentUsed: ["Pickup"],
            workConditions: ["Shared access roads"],
            siteRestrictions: ["Maintain clear emergency access."],
            prohibitedEquipment: [],
            hazardFamilies: ["struck_by"],
            permitTriggers: [],
            requiredControls: ["traffic_control"],
            ppeRequirements: ["High Visibility Vest"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-budget-1",
            operationId: "budget-op-1",
            findings: [],
            permitTriggers: [],
            hazardFamilies: ["struck_by"],
            hazardCategories: ["Struck by equipment"],
            ppeRequirements: ["High Visibility Vest"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["traffic_control"],
            siteRestrictions: ["Maintain clear emergency access."],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 9,
            band: "low",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-budget-1",
            operationId: "budget-op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        tradeBreakdownSummary: longNarrative,
        riskPrioritySummary: longNarrative,
        requiredControlsSummary: longNarrative,
        safetyNarrative: longNarrative,
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const keys = draft.sectionMap.map((section) => section.key);
    const tradeSummary = draft.sectionMap.find((section) => section.key === "trade_summary");
    const riskPrioritySummary = draft.sectionMap.find(
      (section) => section.key === "risk_priority_summary"
    );
    const safetyNarrative = draft.sectionMap.find((section) => section.key === "safety_narrative");

    expect(keys).toEqual(
      expect.arrayContaining([
        "definitions",
        "jurisdiction_profile",
        "scope_of_work",
        "activity_hazard_matrix",
        "program_hazard__struck_by_equipment__base",
      ])
    );
    expect(tradeSummary?.body?.length ?? 0).toBeLessThan(longNarrative.length / 20);
    expect(riskPrioritySummary?.body?.length ?? 0).toBeLessThan(longNarrative.length / 20);
    expect(safetyNarrative?.body?.length ?? 0).toBeLessThan(longNarrative.length / 20);
  });

  it("groups trade packages and preserves a readable fallback label when trade data is missing", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Grouped Tower",
          projectAddress: "200 Main St",
          contractorCompany: "Grouped Contractor",
        },
        scope: {
          trades: ["Electrical"],
          subTrades: ["Shutdown"],
          tasks: ["Cable pull", "Isolation walkdown", "Cleanup"],
          equipment: ["Meter"],
          location: "Level 2",
        },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "electrical",
            tradeLabel: "Electrical",
            subTradeCode: "shutdown",
            subTradeLabel: "Shutdown",
            taskCode: "cable_pull",
            taskTitle: "Cable pull",
            description: null,
            equipmentUsed: ["Cable tugger"],
            workConditions: ["Indoor"],
            hazardHints: ["electrical"],
            requiredControlHints: ["verified_isolation"],
            permitHints: ["energized_electrical_permit"],
            ppeHints: ["Arc-rated PPE"],
            workAreaLabel: "Level 2",
            locationGrid: "B2",
            locationLabel: "Level 2",
            weatherConditionCode: null,
            startsAt: null,
            endsAt: null,
            crewSize: 2,
            metadata: {},
          },
          {
            operationId: "op-2",
            tradeCode: "electrical",
            tradeLabel: "Electrical",
            subTradeCode: "shutdown",
            subTradeLabel: "Shutdown",
            taskCode: "isolation_walkdown",
            taskTitle: "Isolation walkdown",
            description: null,
            equipmentUsed: ["Meter"],
            workConditions: ["Indoor"],
            hazardHints: ["electrical"],
            requiredControlHints: ["verified_isolation"],
            permitHints: ["energized_electrical_permit"],
            ppeHints: ["Arc-rated PPE"],
            workAreaLabel: "Level 2",
            locationGrid: "B2",
            locationLabel: "Level 2",
            weatherConditionCode: null,
            startsAt: null,
            endsAt: null,
            crewSize: 2,
            metadata: {},
          },
          {
            operationId: "op-3",
            taskTitle: "Cleanup",
            description: null,
            equipmentUsed: [],
            workConditions: ["Indoor"],
            hazardHints: ["struck_by"],
            requiredControlHints: ["housekeeping"],
            permitHints: [],
            ppeHints: ["Gloves"],
            workAreaLabel: "Laydown Yard",
            locationGrid: "C1",
            locationLabel: "Laydown Yard",
            weatherConditionCode: null,
            startsAt: null,
            endsAt: null,
            crewSize: 1,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Level 2",
          workConditions: ["Indoor"],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
        },
        programSelections: [],
        builderInstructions: null,
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: null,
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "op-1",
            taskTitle: "Cable pull",
            tradeCode: "electrical",
            subTradeCode: "shutdown",
            taskCode: "cable_pull",
            workAreaLabel: "Level 2",
            locationGrid: "B2",
            startsAt: null,
            endsAt: null,
            weatherConditionCode: null,
            equipmentUsed: ["Cable tugger"],
            workConditions: ["Indoor"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["electrical"],
            permitTriggers: ["energized_electrical_permit"],
            requiredControls: ["verified_isolation"],
            ppeRequirements: ["Arc-rated PPE"],
            trainingRequirementCodes: [],
            payload: {},
            source: { module: "manual", id: null },
          },
          {
            bucketKey: "bucket-2",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "op-2",
            taskTitle: "Isolation walkdown",
            tradeCode: "electrical",
            subTradeCode: "shutdown",
            taskCode: "isolation_walkdown",
            workAreaLabel: "Level 2",
            locationGrid: "B2",
            startsAt: null,
            endsAt: null,
            weatherConditionCode: null,
            equipmentUsed: ["Meter"],
            workConditions: ["Indoor"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["electrical"],
            permitTriggers: ["energized_electrical_permit"],
            requiredControls: ["verified_isolation"],
            ppeRequirements: ["Arc-rated PPE"],
            trainingRequirementCodes: [],
            payload: {},
            source: { module: "manual", id: null },
          },
          {
            bucketKey: "bucket-3",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "op-3",
            taskTitle: "Cleanup",
            workAreaLabel: "Laydown Yard",
            locationGrid: "C1",
            startsAt: null,
            endsAt: null,
            weatherConditionCode: null,
            equipmentUsed: [],
            workConditions: ["Indoor"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["struck_by"],
            permitTriggers: [],
            requiredControls: ["housekeeping"],
            ppeRequirements: ["Gloves"],
            trainingRequirementCodes: [],
            payload: {},
            source: { module: "manual", id: null },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            findings: [],
            permitTriggers: ["energized_electrical_permit"],
            hazardFamilies: ["electrical"],
            hazardCategories: ["Electrical"],
            ppeRequirements: ["Arc-rated PPE"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["verified_isolation"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 8,
            band: "low",
            evaluationVersion: "v1",
          },
          {
            bucketKey: "bucket-2",
            operationId: "op-2",
            findings: [],
            permitTriggers: ["energized_electrical_permit"],
            hazardFamilies: ["electrical"],
            hazardCategories: ["Arc flash"],
            ppeRequirements: ["Arc-rated PPE"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["verified_isolation"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 8,
            band: "low",
            evaluationVersion: "v1",
          },
          {
            bucketKey: "bucket-3",
            operationId: "op-3",
            findings: [],
            permitTriggers: [],
            hazardFamilies: ["struck_by"],
            hazardCategories: ["Struck-by"],
            ppeRequirements: ["Gloves"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["housekeeping"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 3,
            band: "low",
            evaluationVersion: "v1",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
          {
            bucketKey: "bucket-2",
            operationId: "op-2",
            conflicts: [],
            score: 0,
            band: "low",
          },
          {
            bucketKey: "bucket-3",
            operationId: "op-3",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Narrative",
      },
      trainingProgram: undefined,
      riskMemorySummary: null,
    });

    const groupedMatrixRows =
      draft.sectionMap.find((section) => section.key === "activity_hazard_matrix")?.table?.rows ?? [];

    expect(groupedMatrixRows).toHaveLength(3);
    expect(groupedMatrixRows[0]?.[2]).toBe("Cable pull");
    expect(groupedMatrixRows[1]?.[2]).toBe("Isolation walkdown");
    expect(groupedMatrixRows[2]?.[2]).toBe("Cleanup");
    expect(groupedMatrixRows[0]![3]).not.toBe(groupedMatrixRows[1]![3]);
    expect(String(groupedMatrixRows[0]![3] ?? "")).toMatch(/cable|tension|pull/i);
    expect(String(groupedMatrixRows[0]![3] ?? "")).toContain("Electrical");
    expect(String(groupedMatrixRows[0]![4] ?? "")).toContain("verified_isolation");
    expect(String(groupedMatrixRows[1]![3] ?? "")).toMatch(/isolation|energ|boundary|electrical|arc/i);
    expect(String(groupedMatrixRows[1]![4] ?? "")).toContain("verified_isolation");
    expect(groupedMatrixRows[2]![0]).toBe("Unassigned Trade");
    expect(String(groupedMatrixRows[2]![3] ?? "")).toMatch(/struck|slip|equipment|yard/i);
    expect(String(groupedMatrixRows[2]![4] ?? "")).toContain("housekeeping");
    expect(String(groupedMatrixRows[2]![5] ?? "")).toContain("Gloves");
    expect(
      draft.sectionMap.find((section) => section.key === "selected_hazards")?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Electrical / Shutdown",
          bullets: expect.arrayContaining(["Electrical", "Arc flash"]),
        }),
        expect.objectContaining({
          title: "Unassigned Trade",
          bullets: ["Struck-by"],
        }),
      ])
    );
  });

  it("keeps mixed AI narrative blocks as one subsection instead of duplicating them as bullets", () => {
    const enforcementText = [
      "Unsafe conditions identified during steel-erection work will be addressed through a systematic approach.",
      "",
      "Correction Procedures:",
      "- Workers must immediately report unsafe conditions to supervision.",
      "- Supervisors must correct hazards before work restarts.",
    ].join("\n");

    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Steel Deck Expansion",
          contractorCompany: "ABC Steel",
        },
        scope: {
          trades: ["Steel Erection"],
          subTrades: ["Structural steel"],
          tasks: ["Decking installation"],
          equipment: [],
          location: "Level 5",
        },
        operations: [
          {
            operationId: "steel-op-1",
            tradeCode: "steel_erection",
            tradeLabel: "Steel Erection",
            subTradeCode: "structural_steel",
            subTradeLabel: "Structural steel",
            taskCode: "decking_installation",
            taskTitle: "Decking installation",
            description: "Install metal deck on the active steel frame.",
            equipmentUsed: [],
            workConditions: ["Elevated work"],
            hazardHints: ["fall"],
            requiredControlHints: ["fall_protection"],
            permitHints: [],
            ppeHints: ["Hard Hat"],
            workAreaLabel: "Level 5",
            locationGrid: "E5",
            locationLabel: "Level 5",
            weatherConditionCode: null,
            startsAt: null,
            endsAt: null,
            crewSize: 4,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Level 5",
          workConditions: ["Elevated work"],
          siteRestrictions: [],
          simultaneousOperations: [],
          weather: {
            conditionCode: null,
            summary: null,
          },
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: ["enforcement_and_corrective_action"],
          selectedFormatSectionKeys: ["contractor_iipp"],
          blockInputs: {
            enforcement_and_corrective_action: enforcementText,
          },
          builderInputHash: "hash-enforcement-ai",
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: "IL",
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-enforcement-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "steel-op-1",
            taskTitle: "Decking installation",
            tradeCode: "steel_erection",
            subTradeCode: "structural_steel",
            taskCode: "decking_installation",
            workAreaLabel: "Level 5",
            locationGrid: "E5",
            startsAt: null,
            endsAt: null,
            weatherConditionCode: null,
            equipmentUsed: [],
            workConditions: ["Elevated work"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["fall"],
            permitTriggers: [],
            requiredControls: ["fall_protection"],
            ppeRequirements: ["Hard Hat"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-enforcement-1",
            operationId: "steel-op-1",
            findings: [],
            permitTriggers: [],
            hazardFamilies: ["fall"],
            hazardCategories: ["Falls from height"],
            ppeRequirements: ["Hard Hat"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["fall_protection"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 8,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-enforcement-1",
            operationId: "steel-op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Steel-erection narrative.",
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    const enforcementSubsection = draft.sectionMap
      .flatMap((section) => section.subsections ?? [])
      .find((subsection) => subsection.title === "6.4 Enforcement and Corrective Action");

    expect(enforcementSubsection?.body).toBe(
      "Unsafe conditions identified during steel-erection work will be addressed through a systematic approach. Correction Procedures:"
    );
    expect(enforcementSubsection?.bullets).toEqual(
      expect.arrayContaining([
        "Workers must immediately report unsafe conditions to supervision.",
        "Supervisors must correct hazards before work restarts.",
      ])
    );
  });

  it("keeps interface trades out of primary scope, normalizes permits and hazards, and adds steel overlay sections", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Riverfront Tower",
          projectAddress: "100 River Rd",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "ABC Steel",
          contractorContact: "Sam Foreman",
          contractorPhone: "555-111-2222",
        },
        scope: {
          trades: ["Structural Steel / Metals"],
          subTrades: ["Steel erection / decking"],
          tasks: ["Set columns", "Install decking", "HVAC / Mechanical rough-in"],
          equipment: ["Crane"],
          location: "Level 5",
        },
        operations: [
          {
            operationId: "steel-op-1",
            tradeCode: "steel",
            tradeLabel: "Structural Steel / Metals",
            subTradeCode: "steel_decking",
            subTradeLabel: "Steel erection / decking",
            taskCode: "install_decking",
            taskTitle: "Install decking",
            description: "Install metal deck",
            equipmentUsed: ["Crane"],
            workConditions: ["Elevated work"],
            hazardHints: ["fall", "fire"],
            requiredControlHints: ["fall_protection"],
            permitHints: ["lift_plan", "elevated_work_notice"],
            ppeHints: ["Hard Hat", "Harness"],
            workAreaLabel: "Level 5",
            locationGrid: "E5",
            locationLabel: "Level 5",
            weatherConditionCode: null,
            startsAt: null,
            endsAt: null,
            crewSize: 5,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Level 5",
          workConditions: ["Elevated work"],
          siteRestrictions: [],
          simultaneousOperations: ["HVAC / Mechanical trim-out", "Painting / Coatings touch-up"],
          weather: {
            conditionCode: null,
            summary: null,
          },
          metadata: {},
        },
        programSelections: [],
        builderInstructions: {
          selectedBlockKeys: [
            "scope_of_work",
            "common_overlapping_trades",
            "additional_permits",
            "selected_hazards",
          ],
          blockInputs: {
            additional_permits: ["Ladder Permit", "hot work permit"],
            selected_hazards: ["Hot work", "fire", "Fire"],
          },
          builderInputHash: "hash-steel-normalization",
          selectedFormatSectionKeys: [
            "project_scope_and_trade_specific_activities",
            "permits_and_forms",
            "hse_elements_and_site_specific_hazard_analysis",
          ],
        },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
          governingState: "IL",
          jurisdictionCode: "federal",
          jurisdictionLabel: "Federal OSHA",
          jurisdictionPlanType: "federal_osha",
          jurisdictionStandardsApplied: [],
        },
        legacyFormSnapshot: {
          foreman_name: "Sam Foreman",
          foreman_phone: "555-111-2222",
        },
      },
      reviewContext: {
        companyId: "company-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-steel-1",
            bucketType: "task_execution",
            companyId: "company-1",
            operationId: "steel-op-1",
            taskTitle: "Install decking",
            tradeCode: "steel",
            subTradeCode: "steel_decking",
            taskCode: "install_decking",
            workAreaLabel: "Level 5",
            locationGrid: "E5",
            startsAt: null,
            endsAt: null,
            weatherConditionCode: null,
            equipmentUsed: ["Crane"],
            workConditions: ["Elevated work"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            hazardFamilies: ["fall", "fire"],
            permitTriggers: ["lift_plan", "elevated_work_notice", "hot_work_permit"],
            requiredControls: ["fall_protection"],
            ppeRequirements: ["Hard Hat", "Harness", "Fall Protection Harness"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-steel-1",
            operationId: "steel-op-1",
            findings: [],
            permitTriggers: ["lift_plan", "elevated_work_notice", "hot_work_permit"],
            hazardFamilies: ["fall", "fire"],
            hazardCategories: ["Fire", "fire", "Hot work"],
            ppeRequirements: ["Hard Hat", "Harness", "Fall Protection Harness"],
            equipmentChecks: [],
            weatherRestrictions: [],
            requiredControls: ["fall_protection"],
            siteRestrictions: [],
            prohibitedEquipment: [],
            trainingRequirements: [],
            score: 10,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-steel-1",
            operationId: "steel-op-1",
            conflicts: [],
            score: 0,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [],
        score: 0,
        band: "low",
        intraDocumentConflictCount: 0,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Steel narrative.",
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      riskMemorySummary: null,
    });

    expect(draft.ruleSummary.hazardCategories).toEqual(["Fire", "Hot Work"]);
    expect(draft.ruleSummary.permitTriggers).toEqual([
      "Lift Plan",
      "Elevated Work Notice",
      "Hot Work Permit",
    ]);
    expect(
      draft.sectionMap.find((section) => section.key === "scope_of_work")?.bullets
    ).toEqual(expect.arrayContaining(["Set columns", "Install decking"]));
    expect(
      draft.sectionMap.find((section) => section.key === "scope_of_work")?.bullets
    ).not.toEqual(expect.arrayContaining(["HVAC / Mechanical rough-in"]));
    const overlap = draft.sectionMap.find((section) => section.key === "common_overlapping_trades");
    // Steel erection path: trade lists are explained in steel interface subsections; do not duplicate as raw bullets.
    expect(overlap?.bullets).toBeUndefined();
    expect(overlap?.body).toContain("structural steel erection");
    expect(overlap?.subsections?.length).toBe(16);
    expect(overlap?.subsections?.[0]?.title).toBe("Concrete / Foundations");
    expect(overlap?.subsections?.[15]?.title).toBe("Overlap Response Requirement");
    expect(draft.sectionMap.map((section) => section.key)).toEqual(
      expect.arrayContaining([
        "steel_fall_protection",
        "steel_hazard_control_matrix",
        "steel_erection_execution",
      ])
    );
  });
});
