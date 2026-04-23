import type {
  DocumentBuilderId,
  DocumentBuilderSectionReference,
  DocumentBuilderSectionTemplate,
  DocumentBuilderTextConfig,
} from "@/types/document-builder-text";

function section(
  key: string,
  label: string,
  title: string,
  options?: Partial<
    Pick<DocumentBuilderSectionTemplate, "paragraphs" | "bullets" | "children" | "references">
  >
): DocumentBuilderSectionTemplate {
  return {
    key,
    label,
    title,
    paragraphs: [...(options?.paragraphs ?? [])],
    bullets: [...(options?.bullets ?? [])],
    children: (options?.children ?? []).map(cloneSectionTemplate),
    references: (options?.references ?? []).map((reference) => ({ ...reference })),
  };
}

function cloneSectionReferences(
  value: DocumentBuilderSectionReference[] | undefined
): DocumentBuilderSectionReference[] {
  return (value ?? []).map((reference) => ({ ...reference }));
}

export function cloneSectionTemplate(
  value: DocumentBuilderSectionTemplate
): DocumentBuilderSectionTemplate {
  return {
    key: value.key,
    label: value.label,
    title: value.title,
    paragraphs: [...value.paragraphs],
    bullets: [...value.bullets],
    children: value.children.map(cloneSectionTemplate),
    references: cloneSectionReferences(value.references),
  };
}

export function cloneDocumentBuilderTextConfig(
  value: DocumentBuilderTextConfig
): DocumentBuilderTextConfig {
  return {
    builders: {
      csep: {
        sections: value.builders.csep.sections.map(cloneSectionTemplate),
      },
      site_builder: {
        sections: value.builders.site_builder.sections.map(cloneSectionTemplate),
      },
    },
  };
}

export const DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG: DocumentBuilderTextConfig = {
  builders: {
    csep: {
      sections: [
        section("scope_of_work", "Scope of Work", "Scope of Work", {
          paragraphs: [
            "The contractor shall perform work in accordance with the approved project scope, applicable plans, and all site-specific requirements.",
          ],
        }),
        section("site_specific_notes", "Site Specific Notes", "Site Specific Notes", {
          paragraphs: [
            "Site-specific constraints, active construction conditions, adjacent operations, and coordination requirements shall be reviewed daily before work begins.",
          ],
        }),
        section("emergency_procedures", "Emergency Procedures", "Emergency Procedures", {
          paragraphs: [
            "In the event of an emergency, workers shall stop work, notify supervision immediately, follow site alarm and evacuation procedures, and report to the designated assembly area.",
          ],
        }),
        section("hazard_communication", "Hazard Communication (HazCom)", "Hazard Communication (HazCom)", {
          paragraphs: [
            "SDS for all hazardous chemicals brought onto the site shall be maintained on site, readily accessible to workers, and provided to CM / HSE for verification upon request. Containers and secondary containers shall be labeled in accordance with site requirements and applicable HazCom / GHS rules.",
            "Chemical hazards shall be communicated to workers before use. Contractor-introduced materials and damaged-container reporting follow the project HazCom program.",
          ],
        }),
        section(
          "weather_requirements_and_severe_weather_response",
          "Emergency, Weather, Fire Prevention & Housekeeping",
          "Emergency, Weather, Fire Prevention & Housekeeping",
          {
            references: [{ builderId: "site_builder", key: "severe_weather" }],
            paragraphs: [
              "Contractors shall monitor weather and field conditions daily, adjust work plans for heat, cold, wind, and lightning, maintain fire prevention and housekeeping, and coordinate restrictions with the CM/GC before affected work begins.",
            ],
            bullets: [
              "Review weather conditions during the morning huddle and update the JHA/PTP for ice, wind, lightning, heat, cold, or storm exposure.",
              "Secure materials, tools, scaffolds, and elevated work areas before forecasted wind or storm events.",
              "Provide trade-specific controls such as dust suppression, tarping, thawing, or weather-related access changes when conditions require them.",
              "Foremen and union stewards shall help communicate shelter locations, evacuation actions, and worker accountability expectations during severe weather events.",
            ],
          }
        ),
        section("required_ppe", "Required PPE", "Required Personal Protective Equipment", {
          paragraphs: ["No additional PPE selections were entered."],
        }),
        section("permit_requirements", "Permit Requirements", "Permit Requirements", {
          paragraphs: ["No permit triggers were selected or derived."],
        }),
        section(
          "common_overlapping_trades",
          "Overlapping Trades",
          "Common Overlapping Trades in Same Areas",
          {
            paragraphs: [
              "No overlapping-trade indicators were inferred for the current scope selection.",
            ],
          }
        ),
        section(
          "applicable_osha_references",
          "OSHA References",
          "Applicable OSHA References",
          {
            paragraphs: [
              "Applicable OSHA references shall be identified based on the selected trade, tools, equipment, and site conditions.",
            ],
          }
        ),
        section("trade_summary", "Trade Summary", "Trade Summary", {
          paragraphs: [
            "This contractor's work includes trade-specific exposures that require planning, supervision, appropriate PPE, safe access, and hazard controls throughout execution of the work.",
          ],
        }),
        section("selected_hazard_summary", "Selected Hazard Summary", "Selected Hazard Summary", {
          paragraphs: [
            "Key hazards will be determined from the selected trade, work methods, adjacent operations, and changing field conditions.",
          ],
        }),
        section(
          "roles_and_responsibilities",
          "Roles and Responsibilities",
          "Roles and Responsibilities",
          {
            children: [
              section(
                "contractor_superintendent",
                "Contractor Superintendent",
                "Contractor Superintendent",
                {
                  paragraphs: [
                    "Direct field operations, coordinate work sequencing, enforce the site-specific safety plan, and correct unsafe conditions immediately.",
                  ],
                }
              ),
              section("foreman_lead", "Foreman / Lead", "Foreman / Lead", {
                paragraphs: [
                  "Review daily activities with the crew, verify controls are in place, confirm required permits are obtained, and stop work when hazards change.",
                ],
              }),
              section("workers", "Workers", "Workers", {
                paragraphs: [
                  "Follow this CSEP, wear required PPE, attend safety briefings, report hazards immediately, and refuse unsafe work.",
                ],
              }),
              section(
                "safety_representative",
                "Safety Representative",
                "Safety Representative",
                {
                  paragraphs: [
                    "Support inspections, hazard assessments, coaching, corrective actions, and verification of permit and training compliance.",
                  ],
                }
              ),
            ],
          }
        ),
        section("training_requirements", "Training Requirements", "Training Requirements", {
          bullets: [
            "All workers shall receive site orientation before starting work.",
            "Daily pre-task planning shall be completed before beginning work activities.",
            "Tool-specific and task-specific training shall be completed before use of equipment or specialty tools.",
            "Workers shall be trained on emergency procedures, evacuation routes, and incident reporting expectations.",
          ],
        }),
        section(
          "security_and_access",
          "Security and Access",
          "Security and Access",
          {
            paragraphs: [
              "Contractors shall control worker access, protect tools and equipment, and comply with site security requirements, badging expectations, and restricted-area rules communicated by project leadership.",
            ],
            bullets: [
              "Ensure workers carry required identification and follow sign-in / sign-out procedures.",
              "Limit work crews and sub-tier contractors to authorized work zones and access paths.",
              "Secure gang boxes, fuel, specialty tools, and high-value materials when not in use.",
              "Report theft, vandalism, suspicious activity, or access-control issues to the CM/GC immediately.",
            ],
          }
        ),
        section(
          "health_and_wellness",
          "Health and Wellness",
          "Health and Wellness",
          {
            paragraphs: [
              "The contractor shall support workforce health and wellness through heat and cold stress planning, fatigue awareness, ergonomics, first-aid readiness, and access to project medical-response expectations.",
            ],
            bullets: [
              "Plan hydration, warm-up, cooldown, and rest-break expectations for the active shift conditions.",
              "Monitor workers for fatigue, heat illness, cold stress, ergonomic strain, and other condition changes that affect safe work.",
              "Communicate available first-aid, clinic, emergency, and worker-assistance pathways before work begins.",
            ],
          }
        ),
        section(
          "incident_reporting_and_investigation",
          "Incident Reporting and Investigation",
          "Incident Reporting and Investigation",
          {
            paragraphs: [
              "All incidents, injuries, near misses, and unsafe conditions shall be reported immediately, documented promptly, and investigated to corrective-action closure in coordination with project requirements.",
            ],
            bullets: [
              "Notify supervision and the CM/GC immediately after an incident or near miss.",
              "Preserve the scene when safe to do so until direction is provided for investigation.",
              "Document root causes, corrective actions, and return-to-work coordination requirements.",
            ],
          }
        ),
        section(
          "training_and_instruction",
          "Training and Instruction",
          "Training and Instruction",
          {
            references: [{ builderId: "csep", key: "training_requirements" }],
            paragraphs: [
              "Required training, instruction, and certifications shall be verified before workers perform trade-specific work, use specialty equipment, or enter regulated work areas. Equipment operators (crane, MEWP, telehandler, PIV / forklift as applicable), qualified riggers, qualified signal persons, and welders or hot-work-qualified personnel must match the active scope and equipment in use.",
            ],
            bullets: [
              "Provide site orientation, toolbox talks, and task-specific instruction in a language and vocabulary workers understand.",
              "Before mobilization, verify site-required credentials: crane and MEWP operators, telehandler and other PIV operators, fork-truck operators when used, qualified riggers and signal persons for hoisting, and welding / hot-work qualifications when cutting or heating is in scope; add competent-person, environmental, and other certifications the work demands.",
            ],
          }
        ),
        section(
          "drug_and_alcohol_testing",
          "Drug, Alcohol, and Fit-for-Duty Controls",
          "Drug, Alcohol, and Fit-for-Duty Controls",
          {
            paragraphs: [
              "Before first site access or the start of work, workers complete required site orientation and acknowledge applicable employer, owner, and GC/CM fit-for-duty and substance-use policy requirements, including any program acknowledgments and testing triggers that apply on day one.",
              "Drug and alcohol compliance shall be maintained in accordance with applicable union requirements, reciprocal testing and referral obligations, and project or site rules, together with employer policy and law.",
              "Alcohol, illegal drugs, and unauthorized controlled substances may not be stored or kept in personal vehicles while those vehicles are parked on the construction site or on client property.",
            ],
            bullets: [
              "Workers report suspected alcohol- or drug-related impairment. Supervision removes affected workers from exposed work, at-height tasks, and equipment operation until the situation is handled under project and employer procedures.",
              "Post-incident, reasonable-suspicion, return-to-work, and other program testing triggers are followed. Work does not continue when impairment or noncompliance creates an unacceptable risk until required steps are met.",
              "Restart of work stopped for suspected impairment, or of covered tasks after a related program action, follows site and employer rules, including documented supervisor (or other designated) approval when required.",
            ],
          }
        ),
        section(
          "enforcement_and_corrective_action",
          "Enforcement and Corrective Action",
          "Enforcement and Corrective Action",
          {
            paragraphs: [
              "This content addresses correction, escalation, documentation, field verification, and approved restart after CSEP or site-rule violations. Substance, testing, and fit-for-duty program requirements are in Drug, Alcohol, and Fit-for-Duty Controls.",
            ],
            bullets: [
              "Correct the deficiency or stop the work: give clear, task-specific direction on what must change before crews or equipment re-engage.",
              "Escalate by risk: foreman to superintendent to company safety; involve owner/GC and union leadership when program rules, labor agreements, or contract terms require it.",
              "Document findings, actions, responsible parties, follow-up dates, and any disciplinary, progressive, or site-removal steps. Verify fixes in the field before closing the loop.",
            ],
          }
        ),
        section(
          "recordkeeping",
          "Recordkeeping",
          "Recordkeeping and Documentation",
          {
            paragraphs: [
              "The contractor shall maintain records needed to demonstrate training, inspections, hazard reviews, incidents, permits, and other required compliance activities for the active scope of work.",
              "Training records, certifications, and qualification documents shall be maintained current and made available to CM / HSE, site supervision, and owner representatives for verification upon request and before personnel perform work requiring that qualification. Records shall include, as applicable: training and orientations; trade and equipment certifications; operator qualifications; welder and hot-work qualifications; qualified rigger and signal person credentials; and OSHA or other site-required cards or credentials for personnel on the work.",
              "All required permits shall be obtained before the task begins, fully completed, kept active for the duration of the work as required, and maintained on site for review by supervision, CM / HSE, or other authorized representatives.",
            ],
            bullets: [
              "Retain training and qualification evidence in the form the project requires so CM / HSE, site supervision, or owner representatives can verify before or during access when the site requires it, and before work authorization for covered tasks.",
              "Keep JHA/PTP logs, inspection records, current permit files, and incident documentation on site and available for the same review paths when audits, inspections, or work releases apply.",
              "Retain OSHA logs, union certifications, and other supporting records when applicable to the project or trade scope.",
            ],
          }
        ),
        section(
          "continuous_improvement",
          "Continuous Improvement",
          "Program Evaluations and Continuous Improvement",
          {
            paragraphs: [
              "The contractor shall review field feedback, audits, incidents, and changing work conditions to improve this CSEP and the controls used to execute the work safely.",
            ],
            bullets: [
              "Review lessons learned from incidents, near misses, inspections, and audits with supervision and crews.",
              "Update pre-task planning, training focus areas, and work methods when recurring gaps or new risks are identified.",
            ],
          }
        ),
        section(
          "general_safety_expectations",
          "General Safety Expectations",
          "General Safety Expectations",
          {
            bullets: [
              "Housekeeping shall be maintained in all work areas, access routes, and staging areas.",
              "All tools and equipment shall be inspected before use and removed from service when damaged.",
              "Workers shall maintain situational awareness for adjacent crews, moving equipment, suspended loads, and changing site conditions.",
              "Barricades, signage, and exclusion zones shall be maintained whenever work creates exposure to others.",
              "Work shall stop when hazards are uncontrolled, conditions change, or permit requirements are not met.",
            ],
          }
        ),
        section(
          "activity_hazard_analysis_matrix",
          "Activity Hazard Analysis Matrix",
          "Activity Hazard Analysis Matrix",
          {
            paragraphs: [
              "See Appendix E – Task-Hazard-Control Matrix for the task-specific hazard, control, PPE, permit, and competency breakdown. The full matrix is not repeated in the body.",
              "If no matrix appears in the appendix, add a trade, sub-trade, tasks, and hazards on the CSEP page so the plan can generate it.",
            ],
          }
        ),
        section(
          "stop_work_change_management",
          "Stop Work and Change Management",
          "Stop Work and Change Management",
          {
            bullets: [
              "Any worker has the authority and obligation to stop work when an unsafe condition exists.",
              "Work shall be reevaluated when scope changes, crews change, weather changes, or new equipment is introduced.",
              "Changed conditions shall be reviewed with supervision and the crew before work resumes.",
              "New hazards shall be documented and controlled before proceeding.",
            ],
          }
        ),
        section("acknowledgment", "Acknowledgment", "Acknowledgment", {
          paragraphs: [
            "The contractor acknowledges responsibility for complying with this CSEP, applicable site rules, required permits, and all regulatory requirements associated with the work.",
            "Contractor Representative: ________________________________",
            "Signature: ______________________________________________",
            "Date: ___________________________________________________",
          ],
        }),
      ],
    },
    site_builder: {
      sections: [
        section("cover_document_purpose", "Cover Document Purpose", "Document Purpose", {
          paragraphs: [
            "This Project / Site Specific Health, Safety & Environment Plan establishes the minimum requirements, responsibilities, procedures, and controls for construction activities performed on this project. All contractors, subcontractors, suppliers, and authorized visitors are expected to comply with this document and all applicable project safety requirements.",
          ],
        }),
        section(
          "administrative_summary_intro",
          "Administrative Summary Intro",
          "Administrative Summary",
          {
            paragraphs: [
              "This Project / Site Specific Health, Safety & Environment Plan establishes the minimum safety expectations, responsibilities, procedures, and controls for all personnel and contractors performing work on this project. Where project requirements are more stringent than regulatory minimums, the more protective requirement shall apply.",
            ],
          }
        ),
        section("starter_admin_sections", "Starter Admin Sections", "Starter Admin Sections", {
          children: [
            section("disciplinary_policy", "A1 Disciplinary Policy", "A1. Disciplinary Policy", {
              paragraphs: [
                "Each employer must enforce progressive discipline for repeated or serious safety violations, including stop-work and removal where warranted.",
              ],
            }),
            section("owner_letter", "A2 Letter from Owner", "A2. Letter from Owner", {
              paragraphs: [
                "Owner leadership affirms support for this PSHSEP and expects all onsite employers to follow project safety requirements.",
              ],
            }),
            section(
              "incident_reporting_process",
              "A3 Incident Reporting Process",
              "A3. Incident Reporting Process",
              {
                paragraphs: [
                  "All incidents, near misses, and unsafe conditions shall be reported immediately, documented, and tracked through corrective action closure.",
                ],
              }
            ),
            section(
              "special_conditions_permit",
              "A4 Special Conditions Permit",
              "A4. Special Conditions Permit (Variations)",
              {
                paragraphs: [
                  "Any variation from this PSHSEP requires written authorization, temporary controls, and closeout verification.",
                ],
              }
            ),
            section("assumed_trades_index", "A5 Assumed Trades Index", "A5. Assumed Trades Index", {
              paragraphs: ["No assumed trades were listed in this PSHSEP draft."],
            }),
          ],
        }),
        section(
          "osha_reference_summary",
          "OSHA Reference Summary",
          "Appendix OSHA. OSHA Reference Summary",
          {
            paragraphs: [
              "This appendix consolidates OSHA references applicable to selected scope and permit conditions.",
            ],
          }
        ),
        section(
          "emergency_action_medical_response_evacuation",
          "Program 7 Emergency Action",
          "Emergency Action, Medical Response & Evacuation",
          {
            children: [
              section("purpose", "Purpose", "Purpose", {
                paragraphs: [
                  "This section establishes emergency response expectations for medical events, fire, severe weather, utility emergencies, chemical releases, and evacuation scenarios.",
                ],
              }),
              section("emergency_communication", "Emergency Communication", "Emergency Communication", {
                paragraphs: [
                  "Emergency contact numbers, reporting methods, alarm expectations, and designated response procedures must be communicated to all personnel.",
                ],
              }),
              section("medical_response", "Medical Response", "Medical Response", {
                paragraphs: [
                  "In the event of an injury or medical emergency, personnel shall immediately notify supervision and initiate the project emergency response process.",
                ],
                bullets: [
                  "Contact emergency services when needed",
                  "Provide site-specific directions to responders",
                  "Use trained first aid / CPR personnel when available",
                  "Document and report the event promptly",
                ],
              }),
              section("emergency_medical_resources", "Emergency Medical Resources", "Emergency Medical Resources", {
                paragraphs: ["AED Location: Not Specified", "First Aid Station Location: Not Specified"],
              }),
              section("evacuation", "Evacuation", "Evacuation", {
                paragraphs: [
                  "Workers must know evacuation routes, assembly points, and accountability procedures for their work area.",
                ],
                bullets: [
                  "Follow alarms and supervisor direction",
                  "Do not re-enter until authorized",
                  "Account for personnel at designated assembly areas",
                ],
              }),
              section(
                "fire_utility_chemical_emergencies",
                "Fire Utility Chemical Emergencies",
                "Fire / Utility / Chemical Emergencies",
                {
                  paragraphs: [
                    "Work must stop immediately in the event of fire, gas release, utility damage, electrical emergency, or uncontrolled chemical spill unless trained emergency response actions are specifically authorized.",
                  ],
                }
              ),
              section("severe_weather", "Severe Weather", "Severe Weather", {
                paragraphs: [
                  "Project leadership will monitor weather conditions and may suspend work for lightning, high winds, tornado warnings, extreme temperatures, or other hazardous conditions.",
                  "Weather conditions shall be reviewed during daily huddles, and changing conditions shall be communicated through the approved site notification methods.",
                ],
                bullets: [
                  "Lightning watch / stop-work radius: 20 miles (site default for this program). Lightning all-clear: 30 minutes from the last strike within the trigger radius, unless the site SOP, owner, or local authority requires a different interval.",
                  "Suspend crane, lift, scaffold, and elevated work when wind, storms, or visibility conditions exceed manufacturer limits, site thresholds, or safe operating conditions.",
                  "Tornado or severe convective warning: supervision or GC/CM issues immediate shelter or evacuation; leave lifts, open steel, roofs, open deck, and cranes; use designated in-building or posted shelters, not unapproved vehicles, unless the site plan explicitly provides for them; take headcount at the shelter; restart only after site leadership releases work.",
                  "Earthquake or strong seismic shaking in seismically required projects: stop work, move clear of suspended loads and overhead steel, do not run under active steel or crane paths, evacuate or shelter per the site plan, and re-inspect structure, rigging, and access before restart.",
                  "Inspect stormwater, erosion-control, waste, staging, and temporary structures before and after significant weather events.",
                ],
              }),
            ],
          }
        ),
        section(
          "personal_protective_equipment",
          "Program 8 PPE",
          "Personal Protective Equipment (PPE)"
        ),
        section(
          "housekeeping_access_material_storage",
          "Program 9 Housekeeping",
          "Housekeeping, Access & Material Storage"
        ),
        section(
          "fall_protection",
          "Program 10 Fall Protection",
          "Fall Protection",
          {
            children: [
              section("purpose", "Purpose", "Purpose", {
                paragraphs: [
                  "This section establishes requirements for identifying and controlling fall hazards associated with construction activities on the project.",
                  "The objective of this program is to eliminate or minimize fall exposures through engineering controls, safe work practices, and personal protective equipment.",
                ],
              }),
              section("scope", "Scope", "Scope", {
                paragraphs: [
                  "This program applies to all personnel working at heights or exposed to fall hazards on the project.",
                  "Fall protection requirements apply whenever workers are exposed to a fall hazard of six feet or greater unless site-specific rules require additional protection.",
                ],
              }),
              section("responsibilities", "Responsibilities", "Responsibilities", {
                paragraphs: [
                  "Project management is responsible for ensuring fall hazards are identified and controlled prior to beginning work.",
                  "Supervisors must ensure workers understand and comply with fall protection requirements.",
                  "Employees must inspect fall protection equipment before each use.",
                ],
              }),
              section("hazard_identification", "Hazard Identification", "Hazard Identification", {
                paragraphs: [
                  "Common fall hazards include leading edges, roof work, scaffolds, ladders, floor openings, and elevated platforms.",
                ],
                bullets: [
                  "Unprotected edges",
                  "Floor openings",
                  "Roof work",
                  "Scaffolding",
                  "Aerial lift operations",
                ],
              }),
              section("control_measures", "Control Measures", "Control Measures", {
                paragraphs: ["Engineering controls will be implemented whenever feasible."],
                bullets: [
                  "Guardrail systems",
                  "Personal fall arrest systems",
                  "Safety nets",
                  "Controlled access zones",
                ],
              }),
              section("inspection_requirements", "Inspection Requirements", "Inspection Requirements", {
                paragraphs: ["All fall protection equipment must be inspected before each use."],
                bullets: [
                  "Harness inspected daily",
                  "Lanyards inspected prior to use",
                  "Anchorage verified prior to tie-off",
                ],
              }),
              section("rescue_planning", "Rescue Planning", "Rescue Planning", {
                paragraphs: [
                  "A rescue plan must be developed before workers use fall arrest systems.",
                ],
              }),
            ],
          }
        ),
      ],
    },
  },
};

function normalizeTextArray(input: unknown, fallback: string[]) {
  if (!Array.isArray(input)) {
    return [...fallback];
  }

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeReferences(
  input: unknown,
  fallback: DocumentBuilderSectionReference[] | undefined
) {
  if (!Array.isArray(input)) {
    return cloneSectionReferences(fallback);
  }

  return input
    .filter((value): value is DocumentBuilderSectionReference & Record<string, unknown> => {
      return Boolean(value) && typeof value === "object";
    })
    .map((value) => {
      const builderId =
        value.builderId === "csep" || value.builderId === "site_builder"
          ? value.builderId
          : null;
      const key = typeof value.key === "string" ? value.key.trim() : "";

      if (!builderId || !key) {
        return null;
      }

      return {
        builderId,
        key,
      } satisfies DocumentBuilderSectionReference;
    })
    .filter((value): value is DocumentBuilderSectionReference => Boolean(value));
}

function normalizeSection(
  input: unknown,
  fallback: DocumentBuilderSectionTemplate
): DocumentBuilderSectionTemplate {
  if (!input || typeof input !== "object") {
    return cloneSectionTemplate(fallback);
  }

  const raw = input as Partial<DocumentBuilderSectionTemplate>;

  return {
    key: fallback.key,
    label: fallback.label,
    title:
      typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallback.title,
    paragraphs: normalizeTextArray(raw.paragraphs, fallback.paragraphs),
    bullets: normalizeTextArray(raw.bullets, fallback.bullets),
    children: normalizeSections(raw.children, fallback.children),
    references: normalizeReferences(raw.references, fallback.references),
  };
}

function normalizeSections(
  input: unknown,
  fallback: DocumentBuilderSectionTemplate[]
): DocumentBuilderSectionTemplate[] {
  if (!Array.isArray(input)) {
    return fallback.map(cloneSectionTemplate);
  }

  const rawByKey = new Map<string, unknown>();

  input.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const key =
      typeof (item as { key?: unknown }).key === "string"
        ? (item as { key: string }).key.trim()
        : "";

    if (!key) {
      return;
    }

    rawByKey.set(key, item);
  });

  return fallback.map((template) => normalizeSection(rawByKey.get(template.key), template));
}

export function normalizeDocumentBuilderTextConfig(
  input: unknown
): DocumentBuilderTextConfig {
  const fallback = DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG;

  if (!input || typeof input !== "object") {
    return cloneDocumentBuilderTextConfig(fallback);
  }

  const raw = input as {
    builders?: Partial<Record<DocumentBuilderId, { sections?: unknown }>>;
  };

  return {
    builders: {
      csep: {
        sections: normalizeSections(
          raw.builders?.csep?.sections,
          fallback.builders.csep.sections
        ),
      },
      site_builder: {
        sections: normalizeSections(
          raw.builders?.site_builder?.sections,
          fallback.builders.site_builder.sections
        ),
      },
    },
  };
}

export function findDocumentBuilderSection(
  sections: DocumentBuilderSectionTemplate[],
  key: string
): DocumentBuilderSectionTemplate | null {
  for (const current of sections) {
    if (current.key === key) {
      return current;
    }

    const nested = findDocumentBuilderSection(current.children, key);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function getDocumentBuilderSection(
  config: DocumentBuilderTextConfig | null | undefined,
  builderId: DocumentBuilderId,
  key: string
): DocumentBuilderSectionTemplate | null {
  const source = config ?? DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG;
  return findDocumentBuilderSection(source.builders[builderId].sections, key);
}

function mergeResolvedChildren(
  left: DocumentBuilderSectionTemplate[],
  right: DocumentBuilderSectionTemplate[]
) {
  const merged: DocumentBuilderSectionTemplate[] = [];
  const indexByKey = new Map<string, number>();

  [...left, ...right].forEach((child) => {
    const clone = cloneSectionTemplate(child);
    const existingIndex = indexByKey.get(clone.key);

    if (existingIndex === undefined) {
      indexByKey.set(clone.key, merged.length);
      merged.push(clone);
      return;
    }

    merged[existingIndex] = clone;
  });

  return merged;
}

export function resolveDocumentBuilderSection(
  config: DocumentBuilderTextConfig | null | undefined,
  builderId: DocumentBuilderId,
  key: string,
  visited = new Set<string>()
): DocumentBuilderSectionTemplate | null {
  const section = getDocumentBuilderSection(config, builderId, key);

  if (!section) {
    return null;
  }

  const token = `${builderId}:${key}`;
  if (visited.has(token)) {
    return cloneSectionTemplate(section);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(token);

  const referencedSections = (section.references ?? [])
    .map((reference) =>
      resolveDocumentBuilderSection(config, reference.builderId, reference.key, nextVisited)
    )
    .filter((value): value is DocumentBuilderSectionTemplate => Boolean(value));

  return {
    ...cloneSectionTemplate(section),
    paragraphs: [
      ...referencedSections.flatMap((reference) => reference.paragraphs),
      ...section.paragraphs,
    ],
    bullets: [
      ...referencedSections.flatMap((reference) => reference.bullets),
      ...section.bullets,
    ],
    children: mergeResolvedChildren(
      referencedSections.flatMap((reference) => reference.children),
      section.children
    ),
  };
}

export function flattenDocumentBuilderSections(
  sections: DocumentBuilderSectionTemplate[]
): DocumentBuilderSectionTemplate[] {
  return sections.flatMap((current) => [current, ...flattenDocumentBuilderSections(current.children)]);
}
