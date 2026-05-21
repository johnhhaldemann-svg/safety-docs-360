import { describe, expect, it } from "vitest";
import { createDeterministicHash } from "@/lib/csepBuilder";
import {
  buildCsepGenerationContext,
  buildPshsepGenerationContext,
  buildRawTaskInputsFromGenerationContext,
} from "@/lib/safety-intelligence/documentIntake";

describe("document intake mappers", () => {
  it("normalizes CSEP and PSHSEP scope into comparable operation inputs", () => {
    const csep = buildCsepGenerationContext({
      project_name: "North Campus",
      project_address: "123 Main St",
      project_delivery_type: "renovation",
      trade: "Mechanical",
      subTrade: "HVAC",
      tasks: ["Install rooftop unit"],
      scope_of_work: "Install rooftop unit",
      site_specific_notes: "No A-frame ladders on this site",
      required_ppe: ["Hard Hat"],
      additional_permits: ["Work at Height"],
      selected_hazards: ["Falls from height"],
    });
    const pshsep = buildPshsepGenerationContext({
      project_name: "North Campus",
      project_address: "123 Main St",
      projectDeliveryType: "ground_up",
      scope_of_work_selected: ["Install rooftop unit"],
      project_description: "No A-frame ladders on this site",
      owner_specific_requirements_text: "Owner requires startup packet before work commences.",
      definitions_text: "Define competent person and ancillary contractors.",
      oversight_roles_text: "GC safety leads weekly coordination with contractor supervision.",
      staffing_requirements_text: "Increase supervision as manpower and simultaneous work fronts grow.",
      trade_training_requirements_text: "Operators and welders submit qualifications before mobilization.",
      certification_requirements_text: "Electrical and crane certifications are tracked in the site matrix.",
      permits_selected: ["Work at Height"],
      high_risk_focus_areas: ["Ladders / scaffolds / access", "Hot work / fire watch"],
      contractor_coordination_text: "Coordinate access, deliveries, and housekeeping across all contractors.",
      ancillary_contractors: ["Trash / housekeeping", "Bathroom maintenance"],
      clinic_name: "North Campus Clinic",
      inspection_process_text: "Competent person inspections occur before work and after changing conditions.",
      event_calendar_items: ["Routine jobsite inspections", "Weather review / alerts"],
      weather_sop_text: "Pause elevated work when weather conditions exceed project triggers.",
      environmental_controls_text: "Protect drains and manage waste streams during deliveries and cleanup.",
      disciplinary_policy_text: "Escalating discipline process.",
      owner_letter_text: "Owner supports the plan.",
      incident_reporting_process_text: "Report within 15 minutes.",
      special_conditions_permit_text: "Variances require owner approval.",
      assumed_trades_index: ["Mechanical", "Electrical"],
    });

    const csepInputs = buildRawTaskInputsFromGenerationContext(csep, "company-1");
    const pshsepInputs = buildRawTaskInputsFromGenerationContext(pshsep, "company-1");

    expect(csepInputs).toHaveLength(1);
    expect(pshsepInputs).toHaveLength(1);
    expect(csepInputs[0].taskTitle).toBe("Install rooftop unit");
    expect(pshsepInputs[0].taskTitle).toBe("Install rooftop unit");
    expect(csepInputs[0].siteRestrictions).toContain("No A-frame ladders.");
    expect(pshsepInputs[0].siteRestrictions).toContain("No A-frame ladders.");
    expect(csepInputs[0].companyId).toBe(pshsepInputs[0].companyId);
    expect(pshsep.programSelections?.length).toBeGreaterThan(0);
    expect(pshsep.siteContext.metadata).toEqual(
      expect.objectContaining({
        sectionOrdering: expect.objectContaining({
          adminFirst: false,
        }),
        starterSections: expect.objectContaining({
          definitionsText: "Define competent person and ancillary contractors.",
          contractorCoordinationText:
            "Coordinate access, deliveries, and housekeeping across all contractors.",
          highRiskFocusAreas: ["Ladders / scaffolds / access", "Hot work / fire watch"],
          disciplinaryPolicyText: "Escalating discipline process.",
        }),
        oshaReferenceStrategy: "inline_and_appendix",
      })
    );
    expect(pshsep.siteContext.simultaneousOperations).toEqual(
      expect.arrayContaining([
        "Mechanical",
        "Electrical",
        "Trash / housekeeping",
        "Bathroom maintenance",
      ])
    );
    expect(pshsep.siteContext.weather?.summary).toBe(
      "Pause elevated work when weather conditions exceed project triggers."
    );
    expect(csep.documentProfile.governingState).toBe(null);
    expect(csep.documentProfile.jurisdictionCode).toBe("federal");
    expect(pshsep.documentProfile.jurisdictionCode).toBe("federal");
    expect(csep.documentProfile.projectDeliveryType).toBe("renovation");
    expect(pshsep.documentProfile.projectDeliveryType).toBe("ground_up");
    expect(csep.programSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "hazard",
          item: "Falls from height",
        }),
        expect.objectContaining({
          category: "ppe",
          item: "Hard Hat",
        }),
      ])
    );
    expect(csep.builderInstructions).toEqual(
      expect.objectContaining({
        selectedBlockKeys: expect.arrayContaining([
          "project_information",
          "scope_of_work",
          "selected_hazards",
        ]),
        blockInputs: expect.objectContaining({
          scope_of_work: "Install rooftop unit",
          site_specific_notes: "No A-frame ladders on this site",
          selected_hazards: ["Falls from height"],
        }),
        builderInputHash: expect.any(String),
      })
    );
    expect(csep.pricedAttachments ?? []).toEqual([]);
  });

  it("preserves explicit program selections and subtype choices from the builder payload", () => {
    const context = buildCsepGenerationContext({
      project_name: "South Campus",
      projectDeliveryType: "renovation",
      trade: "Electrical",
      subTrade: "Power distribution / feeders / branch power",
      tasks: ["Conduit install"],
      governing_state: "WA",
      selected_hazards: ["Confined spaces"],
      additional_permits: ["Confined Space Permit"],
      required_ppe: ["Safety Glasses"],
      programSelections: [
        {
          category: "hazard",
          item: "Confined spaces",
          subtype: "permit_required",
          relatedTasks: ["Vault entry"],
          source: "selected",
        },
      ],
    });

    expect(context.programSelections).toEqual([
      expect.objectContaining({
        category: "hazard",
        item: "Confined spaces",
        subtype: "permit_required",
        relatedTasks: ["Vault entry"],
      }),
    ]);
    expect(context.documentProfile.governingState).toBe("WA");
    expect(context.documentProfile.jurisdictionCode).toBe("wa");
    expect(context.documentProfile.jurisdictionPlanType).toBe("state_plan");
    expect(context.documentProfile.projectDeliveryType).toBe("renovation");
  });

  it("preserves selected priced attachments through CSEP generation context normalization", () => {
    const context = buildCsepGenerationContext({
      project_name: "Pricing Campus",
      projectDeliveryType: "ground_up",
      trade: "Electrical",
      subTrade: "Power distribution / feeders / branch power",
      tasks: ["Conduit install", "Megger testing"],
      selected_hazards: ["Falls from height"],
      additional_permits: ["Ladder Permit"],
      priced_attachment_keys: ["loto_permit", "fall_protection_rescue_plan"],
    });

    expect(context.pricedAttachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "loto_permit",
          label: "LOTO Permit",
          category: "permit",
        }),
        expect.objectContaining({
          key: "fall_protection_rescue_plan",
          label: "Fall Protection Rescue Plan",
          category: "add_on",
          price: 450,
        }),
      ])
    );
    expect(context.operations[0]?.metadata).toEqual(
      expect.objectContaining({
        pricedAttachments: expect.arrayContaining([
          expect.objectContaining({ key: "loto_permit" }),
        ]),
      })
    );
    expect(context.legacyFormSnapshot.priced_attachment_keys).toEqual([
      "loto_permit",
      "fall_protection_rescue_plan",
    ]);
  });

  it("keeps steel task-derived hazards active when the builder has only two manual hazards", () => {
    const context = buildCsepGenerationContext({
      project_name: "Steel Campus",
      projectDeliveryType: "ground_up",
      trade: "Structural Steel and Erection",
      subTrade: "Steel Erection and Decking",
      tasks: ["Hoisting and Rigging", "Steel Erection", "Welding and Cutting", "Work at Heights"],
      selected_hazards: ["Falls from height", "Crane lift hazards"],
      additional_permits: ["Hot Work Permit"],
      required_ppe: ["Hard Hat", "Fall Protection Harness"],
    });

    const selectedHazards = context.builderInstructions?.blockInputs.selected_hazards;
    expect(selectedHazards).toEqual(
      expect.arrayContaining([
        "Falls from height",
        "Crane lift hazards",
        "Hot work / fire",
        "Falling objects",
        "Structural instability and collapse",
        "Pinch / caught between and struck by",
      ])
    );
    expect(Array.isArray(selectedHazards) ? selectedHazards.length : 0).toBeGreaterThan(2);
    expect(context.programSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "hazard", item: "Falls from height" }),
        expect.objectContaining({ category: "hazard", item: "Crane lift hazards" }),
        expect.objectContaining({ category: "hazard", item: "Hot work / fire" }),
        expect.objectContaining({ category: "hazard", item: "Falling objects" }),
      ])
    );

    const metadata = context.siteContext.metadata as Record<string, unknown>;
    expect(metadata.steelHazardModuleTitles).toEqual(
      expect.arrayContaining([
        "Fall Exposure",
        "Hoisting and Rigging",
        "Falling Objects and Dropped Materials",
      ])
    );
    expect(context.operations[0]?.metadata).toEqual(
      expect.objectContaining({
        selectedHazards: expect.arrayContaining(["Hot work / fire", "Falling objects"]),
      })
    );
  });

  it("normalizes PESHEP legacy labels and derives expanded program coverage", () => {
    const context = buildPshsepGenerationContext({
      project_name: "West Plant",
      project_address: "200 Industrial Way",
      scope_of_work_selected: [
        "Excavation",
        "Concrete",
        "Crane / Rigging",
        "Hazard Communication / Chemical Use",
      ],
      permits_selected: [
        "Groundbreaking/Excavation",
        "Temporary Power / Energization",
        "Scaffold Erection / Modification",
      ],
      high_risk_focus_areas: [
        "Respiratory / silica / dust exposure",
        "Pressure testing / line breaking",
      ],
      assumed_trades_index: ["Excavation", "Scaffolding"],
      ancillary_contractors: ["Traffic control", "Crane service / rigging support"],
      weather_sop_text: "Suspend work when wind or lightning thresholds are exceeded.",
    });

    expect(context.scope.trades).toEqual(
      expect.arrayContaining([
        "Excavation / Trenching",
        "Concrete / Masonry",
        "Crane / Rigging",
        "Hazard Communication / Chemical Use",
      ])
    );
    expect(context.siteContext.simultaneousOperations).toEqual(
      expect.arrayContaining([
        "Excavation / Civil",
        "Scaffolding",
        "Traffic control",
        "Crane service / rigging support",
      ])
    );
    expect(context.programSelections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "hazard", item: "Excavation collapse" }),
        expect.objectContaining({ category: "hazard", item: "Crane lift hazards" }),
        expect.objectContaining({ category: "hazard", item: "Chemical exposure" }),
        expect.objectContaining({ category: "hazard", item: "Silica / dust exposure" }),
        expect.objectContaining({ category: "permit", item: "Ground Disturbance Permit" }),
        expect.objectContaining({ category: "permit", item: "LOTO Permit" }),
        expect.objectContaining({ category: "ppe", item: "Respiratory Protection" }),
      ])
    );
    expect(context.legacyFormSnapshot.scope_of_work_selected).toEqual(
      expect.arrayContaining(["Excavation / Trenching", "Concrete / Masonry"])
    );
    expect(context.siteContext.metadata).toEqual(
      expect.objectContaining({
        oshaRefs: expect.arrayContaining([
          "29 CFR 1926 Subpart P",
          "29 CFR 1926.1153",
          "29 CFR 1926 Subpart CC",
        ]),
        starterSections: expect.objectContaining({
          normalizedCatalogSelections: expect.objectContaining({
            scopeOfWorkSelected: expect.arrayContaining([
              "Excavation / Trenching",
              "Concrete / Masonry",
            ]),
          }),
        }),
      })
    );
    expect(context.documentProfile.jurisdictionCode).toBe("federal");
    expect(context.documentProfile.projectDeliveryType).toBe("ground_up");
  });

  it("defaults project delivery type to ground_up when it is omitted", () => {
    const csep = buildCsepGenerationContext({
      project_name: "Default Project",
      trade: "Mechanical",
      subTrade: "HVAC",
      tasks: ["Install rooftop unit"],
    });
    const pshsep = buildPshsepGenerationContext({
      project_name: "Default Project",
      scope_of_work_selected: ["Roofing"],
    });

    expect(csep.documentProfile.projectDeliveryType).toBe("ground_up");
    expect(pshsep.documentProfile.projectDeliveryType).toBe("ground_up");
  });

  it("attaches site management task modules when Site setup is selected", () => {
    const context = buildCsepGenerationContext({
      project_name: "Site Logistics Package",
      trade: "General Conditions / Site Management",
      subTrade: "Site supervision",
      tasks: ["Site setup"],
      scope_of_work: "Establish startup logistics, access control, traffic control, and housekeeping rules.",
    });

    expect(context.siteContext.metadata).toEqual(
      expect.objectContaining({
        taskModulePackKey: "general_conditions_site_management_site_setup_modules",
        taskModuleTitles: expect.arrayContaining([
          "Site Setup",
          "Access Control",
          "Traffic Control",
        ]),
        taskModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Site Setup",
            moduleKey: "site_setup",
            sourceFilename: "Site Setup.docx",
          }),
        ]),
      })
    );
    expect(context.operations[0]?.metadata).toEqual(
      expect.objectContaining({
        taskModuleKeys: expect.arrayContaining(["site_setup", "traffic_control"]),
      })
    );
  });

  it("attaches matched hazard modules and operation keys for the current CSEP selection", () => {
    const context = buildCsepGenerationContext({
      project_name: "Electrical Scope Package",
      projectDeliveryType: "ground_up",
      trade: "Electrical",
      subTrade: "Power distribution / feeders / branch power",
      tasks: ["Conduit install"],
      scope_of_work: "Install conduit and temporary power protection.",
      selected_hazards: ["Electrical shock"],
      additional_permits: ["LOTO Permit"],
    });

    expect(context.siteContext.metadata).toEqual(
      expect.objectContaining({
        hazardModulePackKey: "csep_hazard_modules_matched_subset",
        hazardModuleTitles: expect.arrayContaining([
          "Electrical Safety and Temporary Power",
          "Lockout Tagout and Hazardous Energy Control",
          "Tools Equipment and Temporary Power",
        ]),
        hazardModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Electrical Safety and Temporary Power",
            moduleKey: "electrical_safety_and_temporary_power",
            matchedReasons: expect.arrayContaining([
              "Hazard: Electrical shock",
              "Permit: LOTO Permit",
            ]),
          }),
        ]),
      })
    );
    expect(context.operations[0]?.metadata).toEqual(
      expect.objectContaining({
        hazardModuleKeys: expect.arrayContaining([
          "electrical_safety_and_temporary_power",
          "lockout_tagout_and_hazardous_energy_control",
          "tools_equipment_and_temporary_power",
        ]),
      })
    );
  });

  it("attaches matched steel reference packs and operation keys for steel-erection CSEP selections", () => {
    const context = buildCsepGenerationContext({
      project_name: "Steel Frame Package",
      projectDeliveryType: "ground_up",
      trade: "Structural Steel / Metals",
      subTrade: "Steel erection / decking",
      tasks: ["Column erection", "Decking install", "Welding"],
      scope_of_work:
        "Set columns, install metal decking, and complete steel welding and final connections.",
      selected_hazards: [
        "Falls from height",
        "Falling object hazards",
        "Rigging and lifting hazards",
      ],
      additional_permits: ["Lift Plan"],
    });

    expect(context.siteContext.metadata).toEqual(
      expect.objectContaining({
        steelTaskModulePackKey: "steel_erection_task_modules_matched_subset",
        steelTaskModuleTitles: expect.arrayContaining([
          "Setting Columns and Base Lines",
          "Installing Metal Decking and Controlling Openings",
          "Field Welding, Cutting and Shear Connectors",
        ]),
        steelTaskModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Setting Columns and Base Lines",
            moduleKey: "steel_setting_columns_and_base_lines",
          }),
        ]),
        steelHazardModulePackKey: "steel_erection_hazard_modules_matched_subset",
        steelHazardModuleTitles: expect.arrayContaining([
          "Fall Exposure",
          "Hoisting and Rigging",
        ]),
        steelHazardModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Fall Exposure",
            moduleKey: "steel_fall_exposure",
          }),
        ]),
        steelProgramModulePackKey: "steel_erection_program_modules_matched_subset",
        steelProgramModuleTitles: expect.arrayContaining([
          "Leading Edge and Connector Work Program",
          "Hoisting and Rigging Program",
          "Controlled Decking Zone and Decking Access Program",
        ]),
        steelProgramModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Leading Edge and Connector Work Program",
            moduleKey: "steel_leading_edge_and_connector_work_program",
          }),
        ]),
      })
    );
    expect(context.operations[0]?.metadata).toEqual(
      expect.objectContaining({
        steelTaskModuleKeys: expect.arrayContaining([
          "steel_setting_columns_and_base_lines",
          "steel_installing_metal_decking_and_controlling_openings",
          "steel_field_welding_cutting_and_shear_connectors",
        ]),
        steelHazardModuleKeys: expect.arrayContaining([
          "steel_fall_exposure",
          "steel_hoisting_and_rigging",
        ]),
        steelProgramModuleKeys: expect.arrayContaining([
          "steel_leading_edge_and_connector_work_program",
          "steel_hoisting_and_rigging_program",
          "steel_controlled_decking_zone_and_decking_access_program",
        ]),
      })
    );

    const operationMetadata = context.operations[0]?.metadata as {
      steelTaskModuleKeys?: string[];
      steelHazardModuleKeys?: string[];
      steelProgramModuleKeys?: string[];
    };

    expect(new Set(operationMetadata.steelTaskModuleKeys ?? []).size).toBe(
      (operationMetadata.steelTaskModuleKeys ?? []).length
    );
    expect(new Set(operationMetadata.steelHazardModuleKeys ?? []).size).toBe(
      (operationMetadata.steelHazardModuleKeys ?? []).length
    );
    expect(new Set(operationMetadata.steelProgramModuleKeys ?? []).size).toBe(
      (operationMetadata.steelProgramModuleKeys ?? []).length
    );
  });

  it("attaches matched steel reference packs for PSHSEP steel scope selections", () => {
    const context = buildPshsepGenerationContext({
      project_name: "Steel Expansion",
      project_address: "900 Fabrication Way",
      projectDeliveryType: "ground_up",
      scope_of_work_selected: ["Steel Erection"],
      high_risk_focus_areas: ["Steel erection / rigging", "Ladders / scaffolds / access"],
      assumed_trades_index: ["Steel Erection"],
      permits_selected: ["Crane / Critical Lift"],
      project_description: "Coordinate steel erection, decking, and connector work.",
    });

    expect(context.siteContext.metadata).toEqual(
      expect.objectContaining({
        exportProgramIds: expect.arrayContaining([
          "steel_erection",
          "crane_rigging",
          "fall_protection",
        ]),
        steelTaskModulePackKey: "steel_erection_task_modules_matched_subset",
        steelTaskModuleTitles: expect.arrayContaining([
          "Pre-Erection Planning and Site Readiness",
        ]),
        steelTaskModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Pre-Erection Planning and Site Readiness",
            moduleKey: "steel_pre_erection_planning_and_site_readiness",
          }),
        ]),
        steelHazardModulePackKey: "steel_erection_hazard_modules_matched_subset",
        steelHazardModuleTitles: expect.arrayContaining([
          "Fall Exposure",
          "Hoisting and Rigging",
        ]),
        steelHazardModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Fall Exposure",
            moduleKey: "steel_fall_exposure",
          }),
        ]),
        steelProgramModulePackKey: "steel_erection_program_modules_matched_subset",
        steelProgramModuleTitles: expect.arrayContaining([
          "Leading Edge and Connector Work Program",
          "Hoisting and Rigging Program",
        ]),
        steelProgramModules: expect.arrayContaining([
          expect.objectContaining({
            title: "Leading Edge and Connector Work Program",
            moduleKey: "steel_leading_edge_and_connector_work_program",
          }),
        ]),
      })
    );
    expect(context.operations[0]?.metadata).toEqual(
      expect.objectContaining({
        exportProgramIds: expect.arrayContaining([
          "steel_erection",
          "crane_rigging",
          "fall_protection",
        ]),
        steelTaskModuleKeys: expect.arrayContaining([
          "steel_pre_erection_planning_and_site_readiness",
        ]),
        steelHazardModuleKeys: expect.arrayContaining([
          "steel_fall_exposure",
          "steel_hoisting_and_rigging",
        ]),
        steelProgramModuleKeys: expect.arrayContaining([
          "steel_leading_edge_and_connector_work_program",
          "steel_hoisting_and_rigging_program",
        ]),
      })
    );

    const operationMetadata = context.operations[0]?.metadata as {
      steelTaskModuleKeys?: string[];
      steelHazardModuleKeys?: string[];
      steelProgramModuleKeys?: string[];
    };

    expect(new Set(operationMetadata.steelTaskModuleKeys ?? []).size).toBe(
      (operationMetadata.steelTaskModuleKeys ?? []).length
    );
    expect(new Set(operationMetadata.steelHazardModuleKeys ?? []).size).toBe(
      (operationMetadata.steelHazardModuleKeys ?? []).length
    );
    expect(new Set(operationMetadata.steelProgramModuleKeys ?? []).size).toBe(
      (operationMetadata.steelProgramModuleKeys ?? []).length
    );
  });

  it("builds a stable CSEP builder hash from selected blocks and typed inputs", () => {
    const first = buildCsepGenerationContext({
      project_name: "Stable Project",
      trade: "Mechanical",
      subTrade: "HVAC",
      tasks: ["Install rooftop unit"],
      scope_of_work: "Install rooftop unit",
      site_specific_notes: "Maintain roof edge protection.",
      selected_hazards: ["Falls from height"],
      included_sections: ["Scope of Work", "Selected Hazards"],
    });
    const second = buildCsepGenerationContext({
      project_name: "Stable Project",
      trade: "Mechanical",
      subTrade: "HVAC",
      tasks: ["Install rooftop unit"],
      scope_of_work: "Install rooftop unit",
      site_specific_notes: "Maintain roof edge protection.",
      selected_hazards: ["Falls from height"],
      included_sections: ["Scope of Work", "Selected Hazards"],
    });
    const changed = buildCsepGenerationContext({
      project_name: "Stable Project",
      trade: "Mechanical",
      subTrade: "HVAC",
      tasks: ["Install rooftop unit"],
      scope_of_work: "Install rooftop unit with curb flashing",
      site_specific_notes: "Maintain roof edge protection.",
      selected_hazards: ["Falls from height"],
      included_sections: ["Scope of Work", "Selected Hazards"],
    });

    expect(first.builderInstructions?.selectedBlockKeys).toEqual([
      "scope_of_work",
      "selected_hazards",
    ]);
    expect(first.builderInstructions?.builderInputHash).toBe(
      second.builderInstructions?.builderInputHash
    );
    expect(first.builderInstructions?.builderInputHash).not.toBe(
      changed.builderInstructions?.builderInputHash
    );
  });

  it("includes matched hazard element keys in the CSEP builder hash payload", () => {
    const context = buildCsepGenerationContext({
      project_name: "Hash Project",
      projectDeliveryType: "ground_up",
      tasks: ["Temporary power panel setup"],
      selected_hazards: ["Electrical shock"],
      additional_permits: ["LOTO Permit"],
      included_sections: ["Selected Hazards"],
    });

    const metadata = context.siteContext.metadata as {
      hazardModules?: Array<{ moduleKey?: string }>;
      steelTaskModules?: Array<{ moduleKey?: string }>;
      steelHazardModules?: Array<{ moduleKey?: string }>;
      steelProgramModules?: Array<{ moduleKey?: string }>;
    };
    const hazardModuleKeys =
      metadata.hazardModules?.map((item) => item.moduleKey ?? "").filter(Boolean) ?? [];
    const steelTaskModuleKeys =
      metadata.steelTaskModules?.map((item) => item.moduleKey ?? "").filter(Boolean) ?? [];
    const steelHazardModuleKeys =
      metadata.steelHazardModules?.map((item) => item.moduleKey ?? "").filter(Boolean) ?? [];
    const steelProgramModuleKeys =
      metadata.steelProgramModules?.map((item) => item.moduleKey ?? "").filter(Boolean) ?? [];

    expect(context.builderInstructions?.builderInputHash).toBe(
      createDeterministicHash({
        selectedBlockKeys: context.builderInstructions?.selectedBlockKeys ?? [],
        selectedFormatSectionKeys: context.builderInstructions?.selectedFormatSectionKeys ?? [],
        blockInputs: context.builderInstructions?.blockInputs ?? {},
        documentControl: context.builderInstructions?.documentControl ?? {},
        projectDeliveryType: context.documentProfile.projectDeliveryType,
        jurisdictionCode: context.documentProfile.jurisdictionCode,
        tradeLabel: context.scope.trades[0] ?? "",
        subTradeLabel: context.scope.subTrades[0] ?? "",
        tasks: context.scope.tasks,
        selectedHazards: ["Electrical shock"],
        derivedHazards: [],
        requiredPpe: [],
        additionalPermits: ["LOTO Permit"],
        derivedPermits: [],
        overlapPermitHints: [],
        commonOverlappingTrades: [],
        taskModuleKeys: [],
        hazardModuleKeys,
        steelTaskModuleKeys,
        steelHazardModuleKeys,
        steelProgramModuleKeys,
        programSelections: context.programSelections ?? [],
        pricedAttachments: context.pricedAttachments ?? [],
        programSubtypeSelections: {},
      })
    );
    expect(context.builderInstructions?.builderInputHash).not.toBe(
      createDeterministicHash({
        selectedBlockKeys: context.builderInstructions?.selectedBlockKeys ?? [],
        selectedFormatSectionKeys: context.builderInstructions?.selectedFormatSectionKeys ?? [],
        blockInputs: context.builderInstructions?.blockInputs ?? {},
        documentControl: context.builderInstructions?.documentControl ?? {},
        projectDeliveryType: context.documentProfile.projectDeliveryType,
        jurisdictionCode: context.documentProfile.jurisdictionCode,
        tradeLabel: context.scope.trades[0] ?? "",
        subTradeLabel: context.scope.subTrades[0] ?? "",
        tasks: context.scope.tasks,
        selectedHazards: ["Electrical shock"],
        derivedHazards: [],
        requiredPpe: [],
        additionalPermits: ["LOTO Permit"],
        derivedPermits: [],
        overlapPermitHints: [],
        commonOverlappingTrades: [],
        taskModuleKeys: [],
        hazardModuleKeys,
        programSelections: context.programSelections ?? [],
        pricedAttachments: context.pricedAttachments ?? [],
        programSubtypeSelections: {},
      })
    );
  });
});
