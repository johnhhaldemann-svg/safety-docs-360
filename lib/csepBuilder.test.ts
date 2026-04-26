import { describe, expect, it } from "vitest";
import {
  buildCsepCoverageAudit,
  buildCsepBuilderAiPrompt,
  buildLegacyIncludedSectionLabelsFromFormatSections,
  buildStructuredCsepDraft,
  hasBlockingCsepCoverageAudit,
  getCsepBuilderAiSectionConfig,
  normalizeSelectedCsepBlockKeys,
  parseCsepAiTextResponse,
  parseCsepWeatherSectionAiResponse,
  parseCsepStormSectionAiResponse,
  resolveSelectedCsepFormatSectionKeys,
} from "@/lib/csepBuilder";

describe("csepBuilder", () => {
  it("normalizes legacy labels and new block keys together", () => {
    expect(
      normalizeSelectedCsepBlockKeys({
        includedSections: [
          "Project Information",
          "weather_requirements_and_severe_weather_response",
          "Training and Instruction",
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        "project_information",
        "weather_requirements_and_severe_weather_response",
        "training_and_instruction",
      ])
    );
  });

  it("recognizes expanded includedContent booleans", () => {
    expect(
      normalizeSelectedCsepBlockKeys({
        includedContent: {
          security_and_access: true,
          recordkeeping: true,
          continuous_improvement: true,
        },
      })
    ).toEqual([
      "security_and_access",
      "recordkeeping",
      "continuous_improvement",
    ]);
  });

  it("maps section ai config to the correct form field", () => {
    expect(getCsepBuilderAiSectionConfig("recordkeeping_text")).toMatchObject({
      kind: "text",
      fieldKey: "recordkeeping_text",
      includedSectionLabel: "Recordkeeping",
      title: "Recordkeeping",
    });
  });

  it("builds a task-first text prompt that refines existing content", () => {
    const prompt = buildCsepBuilderAiPrompt({
      sectionId: "scope_of_work",
      currentValue: "Existing scope note about deck placement and material staging.",
      context: {
        project_name: "Riverfront Tower",
        governing_state: "Wisconsin",
        contractor_company: "ABC Steel",
        trade: "General Conditions / Site Management",
        subTrade: "Site supervision",
        tasks: ["Deck placement", "Material staging"],
        selected_hazards: ["Fall exposure", "Struck-by"],
        required_ppe: ["Hard Hat", "Safety Glasses"],
        selected_permits: ["Hot Work Permit"],
      },
    });

    expect(prompt).toContain("Selected tasks are the primary drafting anchor.");
    expect(prompt).toContain("Selected tasks: Deck placement, Material staging.");
    expect(prompt).toContain("Refine or expand this current Scope Summary draft");
    expect(prompt).toContain("Existing scope note about deck placement and material staging.");
  });

  it("parses fenced plain-text section responses", () => {
    expect(
      parseCsepAiTextResponse(
        "```text\nScope Summary:\nPerform deck placement, coordinate material staging, and maintain controlled access to the active work face.\n```",
        "Scope Summary"
      )
    ).toBe(
      "Perform deck placement, coordinate material staging, and maintain controlled access to the active work face."
    );
  });

  it("normalizes markdown-heavy AI section text into plain field text", () => {
    expect(
      parseCsepAiTextResponse(
        [
          "**Enforcement and Corrective Action**",
          "Unsafe conditions will be addressed through a systematic approach. **Correction Procedures:** - Workers must report unsafe conditions immediately. - Supervisors must correct hazards before restart.",
        ].join("\n"),
        "Enforcement and Corrective Action"
      )
    ).toBe(
      [
        "Unsafe conditions will be addressed through a systematic approach.",
        "",
        "Correction Procedures:",
        "- Workers must report unsafe conditions immediately.",
        "- Supervisors must correct hazards before restart.",
      ].join("\n")
    );
  });

  it("keeps preceding scope context when parsing a Project-Specific Safety Notes AI response", () => {
    expect(
      parseCsepAiTextResponse(
        [
          "Scope Summary",
          "The contractor will perform steel erection and decking activities in Area B.",
          "",
          "Project-Specific Safety Notes",
          "Coordinate access with the GC before opening the work face. Maintain barricades at active hoisting and landing zones, and verify adjacent crews are clear before work begins.",
        ].join("\n"),
        "Project-Specific Safety Notes"
      )
    ).toBe(
      [
        "Scope Summary",
        "The contractor will perform steel erection and decking activities in Area B.",
        "",
        "Project-Specific Safety Notes",
        "Coordinate access with the GC before opening the work face. Maintain barricades at active hoisting and landing zones, and verify adjacent crews are clear before work begins.",
      ].join("\n")
    );
  });

  it("maps selected format sections back to legacy builder blocks", () => {
    expect(
      buildLegacyIncludedSectionLabelsFromFormatSections([
        "project_scope_and_trade_specific_activities",
        "permits_and_forms",
      ])
    ).toEqual(
      expect.arrayContaining([
        "Project Information",
        "Trade Summary",
        "Scope Summary",
        "Project-Specific Safety Notes",
        "Common Overlapping Trades",
        "Additional Permits",
      ])
    );
  });

  it("resolves format sections from legacy included content", () => {
    expect(
      resolveSelectedCsepFormatSectionKeys({
        includedContent: {
          security_and_access: true,
          osha_references: true,
        },
      })
    ).toEqual(
      expect.arrayContaining(["security_and_access_control", "regulatory_framework"])
    );
  });

  it("parses storm section JSON wrapped in assistant prose", () => {
    expect(
      parseCsepStormSectionAiResponse(`
Here is the storm section draft you requested:

{
  "tornadoStormShelterNotes": "Stop work and move crews to the designated interior shelter when severe weather alerts are issued for the project area.",
  "tornadoStormControls": [
    "Stop exposed exterior work when severe weather warnings are issued.",
    "Secure loose materials, tools, and suspended loads before crews shelter.",
    "Confirm crew headcount at the designated shelter area.",
    "Resume work only after the competent person confirms site conditions are stable."
  ]
}
      `)
    ).toEqual({
      tornadoStormShelterNotes:
        "Stop work and move crews to the designated interior shelter when severe weather alerts are issued for the project area.",
      tornadoStormControls: [
        "Stop exposed exterior work when severe weather warnings are issued.",
        "Secure loose materials, tools, and suspended loads before crews shelter.",
        "Confirm crew headcount at the designated shelter area.",
        "Resume work only after the competent person confirms site conditions are stable.",
      ],
    });
  });

  it("parses labeled storm section prose when JSON is missing", () => {
    expect(
      parseCsepStormSectionAiResponse(`
Storm / tornado shelter: Move crews to the identified hardened interior shelter and keep access routes clear before weather impacts the site.
Storm controls:
- Stop crane picks and elevated work when warnings are issued.
- Secure sheet goods, tarps, and loose materials.
- Notify all foremen over the site communication channel.
- Restart work only after the competent person inspects the area.
      `)
    ).toEqual({
      tornadoStormShelterNotes:
        "Move crews to the identified hardened interior shelter and keep access routes clear before weather impacts the site.",
      tornadoStormControls: [
        "Stop crane picks and elevated work when warnings are issued.",
        "Secure sheet goods, tarps, and loose materials.",
        "Notify all foremen over the site communication channel.",
        "Restart work only after the competent person inspects the area.",
      ],
    });
  });

  it("parses the full weather section JSON wrapped in assistant prose", () => {
    expect(
      parseCsepWeatherSectionAiResponse(`
Use this draft weather overlay:

{
  "monitoringSources": ["NOAA weather radio", "Site supervisor app alerts"],
  "communicationMethods": ["Foreman text thread", "Air horn and verbal callout"],
  "highWindThresholdText": "Stop crane picks and unsecured sheet handling when sustained winds reach 25 mph or gusts exceed 35 mph.",
  "lightningShelterNotes": "Crews move to enclosed vehicles or the designated hardened shelter when lightning enters the project stop radius.",
  "lightningRadiusMiles": 20,
  "lightningAllClearMinutes": 30,
  "heatTriggerText": "Increase heat protections when the heat index reaches 90 F.",
  "coldTriggerText": "Escalate cold-weather protections when the wind chill reaches 20 F or lower.",
  "tornadoStormShelterNotes": "Stop exterior work and move crews to the interior shelter area when severe weather warnings are issued.",
  "unionAccountabilityNotes": "Foremen account for all assigned crew members before and after each weather stoppage.",
  "dailyReviewNotes": "Review the forecast, active advisories, and work-area exposure at the start of each shift and after lunch.",
  "projectOverrideNotes": ["Use the parking garage level 1 core as the primary shelter location."],
  "highWindControls": ["Lower or secure loose materials before winds build.", "Suspend aerial work when wind limits are reached."],
  "heatControls": ["Provide shaded recovery areas.", "Increase water and rest breaks during peak heat."],
  "coldControls": ["Rotate exposed crews through warm-up breaks.", "Verify gloves and outerwear stay dry."],
  "tornadoStormControls": ["Stop exposed work immediately.", "Secure the area before sheltering when time allows."],
  "environmentalControls": ["Protect nearby drains from debris during storms."],
  "contractorResponsibilityNotes": ["The contractor superintendent confirms weather controls are in place before restart."]
}
      `)
    ).toEqual({
      monitoringSources: ["NOAA weather radio", "Site supervisor app alerts"],
      communicationMethods: ["Foreman text thread", "Air horn and verbal callout"],
      highWindThresholdText:
        "Stop crane picks and unsecured sheet handling when sustained winds reach 25 mph or gusts exceed 35 mph.",
      lightningShelterNotes:
        "Crews move to enclosed vehicles or the designated hardened shelter when lightning enters the project stop radius.",
      lightningRadiusMiles: 20,
      lightningAllClearMinutes: 30,
      heatTriggerText: "Increase heat protections when the heat index reaches 90 F.",
      coldTriggerText: "Escalate cold-weather protections when the wind chill reaches 20 F or lower.",
      tornadoStormShelterNotes:
        "Stop exterior work and move crews to the interior shelter area when severe weather warnings are issued.",
      unionAccountabilityNotes:
        "Foremen account for all assigned crew members before and after each weather stoppage.",
      dailyReviewNotes:
        "Review the forecast, active advisories, and work-area exposure at the start of each shift and after lunch.",
      projectOverrideNotes: ["Use the parking garage level 1 core as the primary shelter location."],
      highWindControls: [
        "Lower or secure loose materials before winds build.",
        "Suspend aerial work when wind limits are reached.",
      ],
      heatControls: ["Provide shaded recovery areas.", "Increase water and rest breaks during peak heat."],
      coldControls: ["Rotate exposed crews through warm-up breaks.", "Verify gloves and outerwear stay dry."],
      tornadoStormControls: [
        "Stop exposed work immediately.",
        "Secure the area before sheltering when time allows.",
      ],
      environmentalControls: ["Protect nearby drains from debris during storms."],
      contractorResponsibilityNotes: [
        "The contractor superintendent confirms weather controls are in place before restart.",
      ],
    });
  });

  it("builds a coverage audit and structured section map for the 19-section package", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Riverfront Tower CSEP",
      documentControl: null,
      projectOverview: {
        projectName: "Riverfront Tower",
        projectNumber: "RT-100",
        projectAddress: "100 River Rd",
        ownerClient: "Owner Group",
        gcCm: "GC Partners",
        contractorCompany: "ABC Steel",
      },
      operations: [
        {
          operationId: "op-1",
          tradeLabel: "Steel Erection",
          subTradeLabel: "Decking",
          taskTitle: "Deck placement",
          equipmentUsed: ["Crane"],
          workConditions: ["Exterior"],
          hazardCategories: ["Fall exposure"],
          permitTriggers: ["Lift plan"],
          ppeRequirements: ["Hard Hat"],
          requiredControls: ["Controlled decking zone"],
          siteRestrictions: [],
          prohibitedEquipment: [],
          conflicts: [],
        },
      ],
      ruleSummary: {
        permitTriggers: ["Lift plan"],
        ppeRequirements: ["Hard Hat"],
        requiredControls: ["Controlled decking zone"],
        hazardCategories: ["Fall exposure"],
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
      riskSummary: {
        score: 12,
        band: "moderate",
        priorities: ["Review lift path and maintain edge protection."],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      aiAssemblyDecisions: {
        frontMatterGuidance: "Use this plan as the field-ready execution guide for the selected scope.",
        coverageGuidance: "Keep gap callouts visible until the superintendent confirms the missing content is resolved.",
        sectionDecisions: {
          project_scope_and_trade_specific_activities:
            "AI final decision: emphasize steel decking sequence, crane interface zones, and project-supported fall controls.",
        },
      },
      sectionMap: [
        {
          key: "project_information",
          title: "Project Information",
          body: "Project narrative.",
        },
        {
          key: "selected_hazards",
          title: "Selected Hazard Summary",
          bullets: ["Fall exposure"],
        },
      ],
      coverageAudit: null,
      builderSnapshot: {
        selected_format_sections: [
          "project_scope_and_trade_specific_activities",
          "emergency_preparedness_and_response",
        ],
        governing_state: "Wisconsin",
      },
      provenance: {
        governingState: "Wisconsin",
      },
    });

    expect(structured.sectionMap[0]?.key).toBe("table_of_contents");
    expect(
      structured.sectionMap.find(
        (section) => section.key === "plan_use_guidance"
      )?.body
    ).toContain("field-ready execution guide");
    expect(
      structured.sectionMap.find(
        (section) => section.key === "project_scope_and_trade_specific_activities"
      )?.body
    ).toContain("AI final decision");
    expect(
      structured.sectionMap.find((section) => section.key === "emergency_preparedness_and_response")
        ?.subsections?.map((subsection) => subsection.title)
    ).toEqual(
      expect.arrayContaining([
        "Incident Overview",
        "First Aid",
        "Near Miss",
        "Recordable",
        "Serious / Major",
        "Life-Saving Rules",
      ])
    );
    expect(structured.sectionMap.some((section) => section.title === "20.0 Appendices and Support Library")).toBe(
      true
    );
    expect(structured.coverageAudit?.findings.length).toBeGreaterThan(0);
  });

  it("turns raw Section 2 scope items into brief subsection summaries", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Steel Scope CSEP",
      documentControl: null,
      projectOverview: {
        projectName: "Riverfront Tower",
        contractorCompany: "ABC Steel",
      },
      operations: [
        {
          operationId: "steel-op-1",
          taskTitle: "Unload steel",
          tradeLabel: "Structural Steel / Metals",
          subTradeLabel: "Steel erection / decking",
          equipmentUsed: [],
          workConditions: [],
          hazardCategories: [],
          permitTriggers: [],
          ppeRequirements: [],
          requiredControls: [],
          siteRestrictions: [],
          prohibitedEquipment: [],
          conflicts: [],
        },
      ],
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
      riskSummary: {
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      aiAssemblyDecisions: null,
      sectionMap: [
        {
          key: "scope_of_work",
          title: "Scope Summary",
          body: "Unload steel",
          bullets: ["Unload steel", "Sort members"],
        },
      ],
      coverageAudit: null,
      builderSnapshot: {
        selected_format_sections: ["project_scope_and_trade_specific_activities"],
      },
      provenance: {},
    });

    const scopeSection = structured.sectionMap.find(
      (section) => section.key === "project_scope_and_trade_specific_activities"
    );

    expect(scopeSection?.body).toBeUndefined();
    expect(scopeSection?.bullets).toBeUndefined();
    expect(scopeSection?.subsections).toEqual([
      {
        title: "Unload steel",
        body: "Receive, inspect, and safely offload delivered steel members and materials.",
        bullets: [],
      },
      {
        title: "Sort members",
        body: "Organize steel by type, mark, sequence, and installation priority.",
        bullets: [],
      },
    ]);
  });

  it("turns Section 2 project field rows into brief summaries", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Steel Scope CSEP",
      documentControl: null,
      projectOverview: {
        projectName: "Riverfront Tower",
        contractorCompany: "ABC Steel",
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
      riskSummary: {
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      aiAssemblyDecisions: null,
      sectionMap: [
        {
          key: "project_information",
          title: "Project Information",
          table: {
            columns: ["Field", "Value"],
            rows: [
              ["Project Name", "TBD by contractor before issue"],
              ["Governing State", "WI"],
            ],
          },
        },
      ],
      coverageAudit: null,
      builderSnapshot: {
        selected_format_sections: ["project_scope_and_trade_specific_activities"],
      },
      provenance: {},
    });

    const scopeSection = structured.sectionMap.find(
      (section) => section.key === "project_scope_and_trade_specific_activities"
    );

    expect(scopeSection?.table).toBeNull();
    expect(scopeSection?.subsections ?? []).toEqual([]);
    expect(scopeSection?.body).toMatch(/project summary|trade|scope|phase/i);
  });

  it("groups PPE programs into per-program subsections instead of flattening each metadata row", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Riverfront Tower CSEP",
      documentControl: null,
      projectOverview: {
        projectName: "Riverfront Tower",
        contractorCompany: "ABC Steel",
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
      riskSummary: {
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      aiAssemblyDecisions: null,
      sectionMap: [
        {
          key: "program_ppe__hard_hat__base",
          title: "Head Protection Program",
          summary:
            "This program establishes minimum requirements for head protection in areas with overhead work, falling-object exposure, or impact hazards.",
          subsections: [
            {
              title: "When It Applies",
              body: "Selected work or site rules require head protection.",
              bullets: [],
            },
            {
              title: "Applicable References",
              body: "OSHA 1926 Subpart E - PPE.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body: "Wear head protection that is in serviceable condition and appropriate for the hazard.",
              bullets: [],
            },
          ],
        },
        {
          key: "program_ppe__safety_glasses__base",
          title: "Eye Protection Program",
          summary:
            "This program establishes minimum requirements for eye protection during work with flying particles, dust, splash, or impact exposure.",
          subsections: [
            {
              title: "When It Applies",
              body: "Selected work exposes crews to dust, debris, impact, splash, or other eye hazards.",
              bullets: [],
            },
            {
              title: "Applicable References",
              body: "OSHA 1926 Subpart E - PPE.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body:
                "Wear approved eye protection whenever eye hazards are present. Keep lenses clean and replace damaged eye protection immediately.",
              bullets: [],
            },
          ],
        },
      ],
      coverageAudit: null,
      builderSnapshot: {
        selected_format_sections: ["personal_protective_equipment"],
      },
      provenance: {},
    });

    const ppeSection = structured.sectionMap.find(
      (section) => section.key === "personal_protective_equipment"
    );

    expect(ppeSection?.body).toContain("Quick-reference PPE expectations");
    expect(ppeSection?.subsections?.map((subsection) => subsection.title)).toEqual([
      "Head Protection Program",
      "Eye Protection Program",
    ]);
    expect(ppeSection?.subsections?.[0]?.bullets).toEqual([
      "When It Applies: Selected work or site rules require head protection.",
      "Applicable References: OSHA 1926 Subpart E - PPE.",
      "Minimum Required Controls: Wear head protection that is in serviceable condition and appropriate for the hazard.",
    ]);
    expect(ppeSection?.subsections?.[1]?.bullets).toEqual([
      "When It Applies: Selected work exposes crews to dust, debris, impact, splash, or other eye hazards.",
      "Applicable References: OSHA 1926 Subpart E - PPE.",
      "Minimum Required Controls: Wear approved eye protection whenever eye hazards are present. Keep lenses clean and replace damaged eye protection immediately.",
    ]);
  });

  it("groups non-PPE catalog programs into per-program subsections instead of flattening repeated blocks", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Riverfront Tower CSEP",
      documentControl: null,
      projectOverview: {
        projectName: "Riverfront Tower",
        contractorCompany: "ABC Steel",
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
      riskSummary: {
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      aiAssemblyDecisions: null,
      sectionMap: [
        {
          key: "program_permit__hot_work_permit__base",
          title: "Hot Work Permit Program",
          summary:
            "This program defines the permit controls, authorization steps, and field verifications required before hot work begins.",
          subsections: [
            {
              title: "Applicable References",
              body: "R1 OSHA 1926 Subpart J - Fire Protection and Prevention.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body: "Review ignition controls, fire watch needs, extinguisher placement, and permit approval before work starts.",
              bullets: [],
            },
          ],
        },
        {
          key: "program_hazard__electrical_shock__base",
          title: "Electrical Safety Program",
          summary:
            "This program defines controls required to prevent shock, arc, burn, and energized-equipment exposure during selected construction activities.",
          subsections: [
            {
              title: "Applicable References",
              body: "R1 OSHA 1926 Subpart K - Electrical.",
              bullets: [],
            },
            {
              title: "Minimum Required Controls",
              body: "Verify de-energization, maintain boundaries, and protect workers from exposed parts and temporary power hazards.",
              bullets: [],
            },
          ],
        },
      ],
      coverageAudit: null,
      builderSnapshot: {
        selected_format_sections: [
          "permits_and_forms",
          "hse_elements_and_site_specific_hazard_analysis",
        ],
      },
      provenance: {},
    });

    const permitSection = structured.sectionMap.find((section) => section.key === "permits_and_forms");
    const hseSection = structured.sectionMap.find(
      (section) => section.key === "hse_elements_and_site_specific_hazard_analysis"
    );

    expect(permitSection?.subsections).toEqual([
      {
        title: "Hot Work Permit Program",
        body:
          "This program defines the permit controls, authorization steps, and field verifications required before hot work begins.",
        bullets: [
          "Applicable References: R1 OSHA 1926 Subpart J - Fire Protection and Prevention.",
          "Minimum Required Controls: Review ignition controls, fire watch needs, extinguisher placement, and permit approval before work starts.",
        ],
      },
    ]);
    expect(hseSection?.subsections).toEqual([
      {
        title: "Electrical Safety Program",
        body:
          "This program defines controls required to prevent shock, arc, burn, and energized-equipment exposure during selected construction activities.",
        bullets: [
          "Applicable References: R1 OSHA 1926 Subpart K - Electrical.",
          "Minimum Required Controls: Verify de-energization, maintain boundaries, and protect workers from exposed parts and temporary power hazards.",
        ],
      },
    ]);
  });

  it("flags missing permit and hazard-library sections in the coverage audit", () => {
    const audit = buildCsepCoverageAudit({
      selectedFormatSectionKeys: ["project_scope_and_trade_specific_activities"],
      selectedHazards: ["Fall exposure"],
      selectedPermits: ["Lift plan"],
      requiredPpe: ["Hard Hat"],
      tasks: ["Deck placement"],
      governingState: "Wisconsin",
    });

    expect(audit.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "permits_library_required", severity: "required" }),
        expect.objectContaining({ key: "hazard_library_missing", severity: "required" }),
      ])
    );
  });

  it("treats unresolved required coverage findings as blocking", () => {
    expect(
      hasBlockingCsepCoverageAudit({
        findings: [
          {
            key: "permits_library_required",
            severity: "required",
            title: "Permit library coverage missing",
            detail: "Selected permits should be surfaced in Section 15 and cross-referenced into Appendix A.",
            sectionKey: "permits_and_forms",
          },
        ],
        unresolvedRequiredCount: 1,
        unresolvedWarningCount: 0,
      })
    ).toBe(true);
    expect(
      hasBlockingCsepCoverageAudit({
        findings: [
          {
            key: "checklist_reference_gap",
            severity: "info",
            title: "Checklist appendix can strengthen program enforcement",
            detail: "Triggered programs were found.",
            sectionKey: "checklists_and_inspections",
          },
        ],
        unresolvedRequiredCount: 0,
        unresolvedWarningCount: 0,
      })
    ).toBe(false);
  });

  it("reapplies AI assembly decisions when a draft is already structured", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Structured Riverfront Tower CSEP",
      documentControl: null,
      aiAssemblyDecisions: {
        frontMatterGuidance: "AI says the front matter should orient field crews before the numbered package starts.",
        coverageGuidance: "AI says keep required gaps visible until the missing controls are resolved.",
        sectionDecisions: {
          company_overview_and_safety_philosophy:
            "AI says this section should lead with contractor safety leadership and stop-work expectations.",
        },
      },
      projectOverview: {
        projectName: "Riverfront Tower",
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
      riskSummary: {
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      coverageAudit: {
        findings: [],
        unresolvedRequiredCount: 0,
        unresolvedWarningCount: 0,
      },
      sectionMap: [
        {
          key: "plan_use_guidance",
          kind: "front_matter",
          order: 3,
          title: "How to Use This Plan",
          layoutKey: "plan_use_guidance",
          body: "Old front matter copy.",
        },
        {
          key: "company_overview_and_safety_philosophy",
          kind: "main",
          order: 10,
          title: "1.0 Company Overview and Safety Philosophy",
          numberLabel: "1.0",
          layoutKey: "company_overview_and_safety_philosophy",
          body: "Existing section body.",
          subsections: [
            {
              title: "Required Coverage Callout",
              body: "Old coverage callout.",
              bullets: ["Keep rescue planning visible."],
            },
          ],
        },
        {
          key: "appendix_a_forms_and_permit_library",
          kind: "appendix",
          order: 40,
          title: "Appendix A. Forms and Permit Library",
          numberLabel: "Appendix A",
          layoutKey: "appendix_library",
          body: "Appendix body.",
        },
      ],
      builderSnapshot: {},
      provenance: {},
    });

    expect(
      structured.sectionMap.find((section) => section.key === "plan_use_guidance")?.body
    ).toContain("orient field crews");
    expect(
      structured.sectionMap.find(
        (section) => section.key === "company_overview_and_safety_philosophy"
      )?.body
    ).toContain("contractor safety leadership");
    expect(
      structured.sectionMap
        .find((section) => section.key === "company_overview_and_safety_philosophy")
        ?.subsections?.find((subsection) => subsection.title === "Required Coverage Callout")?.body
    ).toContain("keep required gaps visible");
  });

  it("strips builder-only guidance and omits incomplete emergency sections in final issue mode", () => {
    const structured = buildStructuredCsepDraft(
      {
        documentType: "csep",
        projectDeliveryType: "ground_up",
        title: "Final Riverfront Tower CSEP",
        documentControl: {
          projectSite: "[Platform Fill Field]",
          primeContractor: "ABC Steel",
          preparedBy: "SafetyDocs360 AI Draft Builder",
          approvedBy: "Pending approval",
        },
        aiAssemblyDecisions: {
          frontMatterGuidance:
            "Use the front matter to orient field teams quickly, keep placeholders explicit, and keep gap callouts visible.",
          coverageGuidance: "Keep this section concise, customer-facing, and ready for builder edits.",
          sectionDecisions: {
            emergency_preparedness_and_response:
              "Keep this section concise, customer-facing, and ready for builder edits.",
          },
        },
        projectOverview: {
          projectName: "Riverfront Tower",
          contractorCompany: "ABC Steel",
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
        riskSummary: {
          score: 0,
          band: "low",
          priorities: [],
        },
        trainingProgram: {
          rows: [],
          summaryTrainingTitles: [],
        },
        narrativeSections: {},
        sectionMap: [
          {
            key: "document_control",
            kind: "front_matter",
            order: 0,
            title: "0.0 Document Control",
            layoutKey: "document_control",
            table: {
              columns: ["Field", "Value"],
              rows: [["Prepared By", "SafetyDocs360 AI Draft Builder"]],
            },
          },
          {
            key: "emergency_preparedness_and_response",
            kind: "main",
            order: 15,
            title: "6.0 Emergency Preparedness and Response",
            numberLabel: "6.0",
            layoutKey: "emergency_preparedness_and_response",
            body: "Keep this section concise, customer-facing, and ready for builder edits.",
          },
          {
            key: "appendix_a_forms_and_permit_library",
            kind: "appendix",
            order: 40,
            title: "Appendix A. Forms and Permit Library",
            numberLabel: "Appendix A",
            layoutKey: "appendix_library",
            body: "Permit forms.",
          },
        ],
        coverageAudit: {
          findings: [],
          unresolvedRequiredCount: 0,
          unresolvedWarningCount: 0,
        },
        builderSnapshot: {},
        provenance: {},
      },
      { finalIssueMode: true }
    );

    expect(
      structured.sectionMap.some(
        (section) => section.key === "emergency_preparedness_and_response"
      )
    ).toBe(false);
    expect(JSON.stringify(structured.sectionMap)).not.toContain("SafetyDocs360 AI Draft Builder");
    expect(JSON.stringify(structured.sectionMap)).not.toContain("Platform Fill Field");
    expect(JSON.stringify(structured.sectionMap)).not.toContain("Pending approval");
    expect(JSON.stringify(structured.sectionMap)).not.toContain("Keep this section concise");
  });

  it("renders incident overview as numbered subsections with example and notification paragraphs", () => {
    const structured = buildStructuredCsepDraft({
      documentType: "csep",
      projectDeliveryType: "ground_up",
      title: "Riverfront Tower CSEP",
      documentControl: null,
      aiAssemblyDecisions: null,
      projectOverview: {
        projectName: "Riverfront Tower",
        contractorCompany: "ABC Steel",
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
      riskSummary: {
        score: 0,
        band: "low",
        priorities: [],
      },
      trainingProgram: {
        rows: [],
        summaryTrainingTitles: [],
      },
      narrativeSections: {},
      coverageAudit: {
        findings: [],
        unresolvedRequiredCount: 0,
        unresolvedWarningCount: 0,
      },
      sectionMap: [
        {
          key: "emergency_preparedness_and_response",
          kind: "main",
          order: 15,
          title: "6.0 Emergency Preparedness and Response",
          numberLabel: "6.0",
          layoutKey: "emergency_preparedness_and_response",
          body: "Emergency content is complete and ready for issue.",
          subsections: [
            {
              title: "Emergency Contacts",
              body: "Call 911 first, then notify project supervision.",
              bullets: [],
            },
          ],
        },
      ],
      builderSnapshot: {},
      provenance: {},
    });

    const emergencySection = structured.sectionMap.find(
      (section) => section.key === "emergency_preparedness_and_response"
    );
    const incidentSubsections =
      emergencySection?.subsections?.filter((subsection) =>
        ["First Aid", "Near Miss", "Recordable", "Serious / Major"].includes(subsection.title)
      ) ?? [];

    expect(incidentSubsections).toHaveLength(4);
    expect(incidentSubsections.map((subsection) => subsection.title)).toEqual([
      "First Aid",
      "Near Miss",
      "Recordable",
      "Serious / Major",
    ]);
    expect(incidentSubsections.map((subsection) => subsection.body)).toEqual([
      [
        "Example: Minor first-aid-only case with no property damage or release.",
        "Required Actions / Notifications: Notify the foreman or supervision, document the event, and confirm any immediate corrective actions.",
      ].join("\n\n"),
      [
        "Example: No injury, no release, and no loss event.",
        "Required Actions / Notifications: Report to supervision and capture corrective actions before restart.",
      ].join("\n\n"),
      [
        "Example: OSHA recordable injury, illness, or exposure.",
        "Required Actions / Notifications: Notify supervision, safety, and required project contacts immediately.",
      ].join("\n\n"),
      [
        "Example: Hospitalization, major property loss, permit breach, or severe environmental event.",
        "Required Actions / Notifications: Activate the escalation chain, preserve the scene, and begin a formal investigation.",
      ].join("\n\n"),
    ]);
    expect(incidentSubsections.every((subsection) => (subsection.bullets ?? []).length === 0)).toBe(true);
    expect(
      emergencySection?.subsections?.find((subsection) => subsection.title === "Life-Saving Rules")
        ?.bullets
    ).toEqual([
      "Work Stoppage: Stop work when fall protection, access, or rescue conditions are not in place.",
      "Permit and Authorization Control: Do not bypass permit, energy-isolation, or authorization requirements.",
      "Line-of-Fire and Struck-By Prevention: Stay clear of line-of-fire, suspended-load, and struck-by exposure zones.",
      "Emergency Response and Evacuation: Use emergency response, shelter, and evacuation procedures immediately when triggers are met.",
    ]);
    expect(JSON.stringify(emergencySection)).not.toContain("Trigger / Example");
    expect(JSON.stringify(emergencySection)).toContain("Required Actions / Notifications");
  });
});
