import { JOBSITE_AUDIT_TRADE_SLUGS } from "@/lib/sharedTradeTaxonomy";

export const AUDIT_SYSTEM_BLUEPRINT = {
  audit_system: {
    audit_header: {
      project_name: "string",
      project_number: "string",
      project_location: "string",
      gc_cm: "string",
      contractor_name: "string",
      auditor_name: "string",
      audit_date: "date",
      audit_time: "time",
      weather_conditions: "string",
      inspection_type: [
        "full_audit",
        "spot_audit",
        "follow_up_audit",
        "pre_task_audit",
        "incident_follow_up",
        "closeout_verification",
      ],
      trade_scope_being_audited: [...JOBSITE_AUDIT_TRADE_SLUGS],
    },
    universal_audit_sections: [
      "housekeeping",
      "access_egress",
      "ppe",
      "material_storage",
      "lighting",
      "signage",
      "fire_prevention",
      "first_aid_emergency",
      "public_protection",
      "general_site_control",
    ],
    trade_profiles: {
      roofing: {
        checklist_items: [
          "fall_protection",
          "leading_edge_control",
          "hole_opening_protection",
          "ladder_roof_access",
          "material_staging_on_roof",
          "hot_work_if_applicable",
          "crane_material_lifting",
          "weather_exposure",
        ],
        common_hazards: [
          "falls_from_height",
          "falling_objects",
          "heat_stress",
          "slip_hazards",
        ],
        required_permits: [
          "hot_work_if_applicable",
          "crane_lift_plan_if_applicable",
          "work_at_height_if_applicable",
        ],
      },
      electrical: {
        checklist_items: [
          "temporary_power",
          "panel_access",
          "extension_cord_management",
          "gfci_protection",
          "exposed_wiring",
          "loto",
          "energized_work_controls",
        ],
        common_hazards: [
          "shock",
          "arc_flash",
          "trip_hazards_from_cords",
          "blocked_panels",
        ],
        required_permits: [
          "loto_if_applicable",
          "energized_work_if_applicable",
        ],
      },
    },
    observation_entry: {
      observation_type: ["positive", "negative"],
      category: "string",
      subcategory: "string",
      description: "string",
      severity: ["low", "medium", "high", "imminent_danger"],
      photo_upload: "file",
      immediate_action_taken: "boolean",
      responsible_party: "string",
      corrective_action_required: "string",
      due_date: "date",
      status: ["open", "corrected_on_site", "pending_follow_up"],
    },
    auto_report_logic: {
      selected_trade_drives: [
        "checklist_items",
        "hazard_prompts",
        "permit_prompts",
        "summary_language",
        "scoring_weight",
      ],
      universal_items_always_included: true,
      final_report_sections: [
        "work_activities_observed",
        "safety_oversight_activities_performed",
        "positive_observations",
        "areas_of_concern_negative_observations",
        "corrective_actions",
        "conclusion",
      ],
    },
  },
} as const;

export const AUDIT_SYSTEM_BLUEPRINT_TEXT = JSON.stringify(
  AUDIT_SYSTEM_BLUEPRINT,
  null,
  2
);
