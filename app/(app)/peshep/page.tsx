"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { ChecklistCoveragePanel } from "@/components/compliance/ChecklistCoveragePanel";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  useCompanyWorkspaceData,
  type CompanyJobsite,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import {
  InlineMessage,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import type { PermissionMap } from "@/lib/rbac";
import {
  getPshsepCatalogOptions,
  normalizePshsepBuilderFormData,
} from "@/lib/pshsepCatalog";
import {
  getJurisdictionStateOptions,
  resolveBuilderJurisdiction,
} from "@/lib/jurisdictionStandards/catalog";
import {
  SITE_SAFETY_BLUEPRINT_BUILDER_LABEL,
  SITE_SAFETY_BLUEPRINT_TITLE,
} from "@/lib/safetyBlueprintLabels";
import { OWNER_MESSAGE_PRESETS, getOwnerMessagePreset } from "@/lib/ownerMessagePresets";
import type { ChecklistEvaluationResponse } from "@/lib/compliance/evaluation";
import { buildPshsepGenerationContext } from "@/lib/safety-intelligence/documentIntake";

type Answers = {
  jobsite_id: string;
  company_name: string;
  /** Contractor / company mailing or main office for this project (exports to cover) */
  company_address: string;
  project_name: string;
  project_number: string;
  project_address: string;
  /** e.g. Preconstruction, Construction, Commissioning (cover / admin summary) */
  project_phase: string;
  /** Physical owner address at the site (distinct from project / jobsite address) */
  owner_site_address: string;
  governing_state: string;
  project_delivery_type: string;
  owner_client: string;
  gc_cm: string;
  project_description: string;
  owner_specific_requirements_text: string;
  definitions_text: string;
  oversight_roles_text: string;
  competent_person_requirements_text: string;
  staffing_requirements_text: string;
  requires_osha10: boolean;
  requires_osha30_pm_super_within_5yrs: boolean;
  requires_osha30_supervisor_on_site: boolean;
  requires_drug_card_ccs: boolean;
  requires_codex_access: boolean;
  requires_training_matrix_monthly: boolean;
  requires_background_check: boolean;
  orientation_required: boolean;
  orientation_pass_score: "70" | "80" | "90";
  trade_training_requirements_text: string;
  certification_requirements_text: string;
  permits_selected: string[];
  lift_plans_required: boolean;
  critical_lift_review_required: boolean;
  scope_of_work_selected: string[];
  high_risk_focus_areas: string[];
  assumed_trades_index: string[];
  contractor_coordination_text: string;
  ancillary_contractors: string[];
  ancillary_contractors_notes: string;
  disciplinary_policy_text: string;
  owner_letter_text: string;
  incident_reporting_process_text: string;
  incident_investigation_text: string;
  special_conditions_permit_text: string;
  clinic_name: string;
  clinic_address: string;
  clinic_hours: string;
  posted_emergency_contacts_text: string;
  emergency_posting_location: string;
  inspection_process_text: string;
  event_calendar_items: string[];
  event_calendar_notes_text: string;
  weather_sop_text: string;
  environmental_controls_text: string;
  ppe_specifics_text: string;
  equipment_controls_text: string;
  chemical_storage_text: string;
};

type DraftableAnswerField =
  | "project_description"
  | "owner_specific_requirements_text"
  | "definitions_text"
  | "oversight_roles_text"
  | "competent_person_requirements_text"
  | "staffing_requirements_text"
  | "trade_training_requirements_text"
  | "certification_requirements_text"
  | "contractor_coordination_text"
  | "ancillary_contractors_notes"
  | "disciplinary_policy_text"
  | "owner_letter_text"
  | "incident_reporting_process_text"
  | "incident_investigation_text"
  | "special_conditions_permit_text"
  | "posted_emergency_contacts_text"
  | "emergency_posting_location"
  | "inspection_process_text"
  | "event_calendar_notes_text"
  | "weather_sop_text"
  | "environmental_controls_text"
  | "ppe_specifics_text"
  | "equipment_controls_text"
  | "chemical_storage_text";

const LS_KEY = "pshsep_universal_v3";
const supabase = getSupabaseBrowserClient();
const jurisdictionStateOptions = getJurisdictionStateOptions();

type BuilderStep = {
  title: string;
  detail: string;
  requiredInputs: string[];
  documentSections: string[];
  generatedOutputs: string[];
  referenceIds: string[];
};

const steps: BuilderStep[] = [
  {
    title: "Project Setup",
    detail: "Core project, owner, and job-specific context.",
    requiredInputs: [
      "Company / brand name",
      "Company address for the project (cover)",
      "Cover logo (optional PNG/JPG)",
      "Project name, number, and phase",
      "Project address and governing state",
      "Owner / client and owner site address",
      "Jurisdiction profile",
      "Project delivery type",
      "Owner / client information",
      "GC / CM information",
      "Project description and boundaries",
      "Owner / project-specific requirements",
      "Uploaded owner standards or safety manual files",
    ],
    documentSections: [
      "Title Page Data",
      "Project Description",
      "Governing Requirements",
      "Owner / Project-Specific Requirements",
      "Document Control Setup",
    ],
    generatedOutputs: [
      "Cover page",
      "Project description paragraph",
      "Governing requirements summary",
      "Owner-specific requirements section",
      "Document control / revision shell",
    ],
    referenceIds: ["R1", "R2", "R3", "R4", "R5", "R6"],
  },
  {
    title: "Roles & Definitions",
    detail: "Capture definitions, oversight, and competent-person expectations.",
    requiredInputs: [
      "Definitions text field",
      "Owner roles and responsibilities",
      "GC / CM roles and responsibilities",
      "Subcontractor responsibilities",
      "Competent person requirements",
      "Qualified person requirements",
      "Staffing / headcount expectations",
      "Safety coverage expectations",
    ],
    documentSections: [
      "Definitions",
      "Owner / Client Responsibilities",
      "GC / Construction Manager Responsibilities",
      "Safety Manager Responsibilities",
      "Superintendent / Foreman Responsibilities",
      "Subcontractor Responsibilities",
      "Worker Responsibilities",
      "Competent / Qualified Person Matrix",
    ],
    generatedOutputs: [
      "Definitions section",
      "Responsibility matrix",
      "Competent person requirement list",
      "Staffing / safety coverage requirements",
    ],
    referenceIds: ["R1", "R7", "R8", "R9", "R10", "R11"],
  },
  {
    title: "Training & Access",
    detail: "Set workforce qualifications and access requirements.",
    requiredInputs: [
      "OSHA 10 requirement",
      "OSHA 30 PM / superintendent requirement",
      "On-site OSHA 30 supervisor requirement",
      "Drug card / CCS compliance requirement",
      "Codex / owner approval for site access",
      "Background check requirement",
      "Orientation requirement and passing score",
      "Trade-specific training requirements",
      "Certification / qualification requirements",
    ],
    documentSections: [
      "Orientation Requirements",
      "Access Control Requirements",
      "Background Check / Screening",
      "Training Matrix Rules",
      "Certifications and Qualifications",
      "Project Training Requirements",
    ],
    generatedOutputs: [
      "Training and access section",
      "Orientation requirements",
      "Training matrix logic",
      "Credential tracking requirements",
      "Worker readiness status",
    ],
    referenceIds: ["R9", "R12", "R13", "R14", "R15", "R16", "R17"],
  },
  {
    title: "Scope & High-Risk Work",
    detail: `Choose the work and high-risk sections the ${SITE_SAFETY_BLUEPRINT_TITLE} must cover.`,
    requiredInputs: [
      "Scope of work selections",
      "High-risk focus area selections",
      "Task / trade activities",
      "Work area conditions",
      "Expected equipment use",
      "Known work restrictions",
      "Top 10 risk inputs",
    ],
    documentSections: [
      "Scope of Work Library",
      "High-Risk Focus Areas",
      "Top 10 Risk Generator",
      "Hazard Control Module Triggers",
      "Work Area Condition Logic",
    ],
    generatedOutputs: [
      "Scope of work section",
      "Top 10 project risks",
      "High-risk work summary",
      "Triggered hazard control modules",
      "Missing-control checklist",
    ],
    referenceIds: ["R1", "R13", "R14", "R15", "R18", "R19", "R20", "R21", "R22", "R23", "R24"],
  },
  {
    title: "Coordination & Permits",
    detail: "Coordinate assumed trades, ancillary contractors, and permit-driven controls.",
    requiredInputs: [
      "Required permit selections",
      "Assumed trade selections",
      "Ancillary contractor selections",
      "Contractor coordination expectations",
      "Ancillary contractor notes",
      "Trade overlap conditions",
      "Permit approval authority",
      "Permit posting / closeout requirements",
    ],
    documentSections: [
      "Required Permit Library",
      "Permit Trigger Logic",
      "Assumed Trades",
      "Ancillary Contractors",
      "Trade Interaction Controls",
    ],
    generatedOutputs: [
      "Permit matrix",
      "Trade interaction section",
      "Ancillary contractor controls",
      "Permit checklist",
      "Coordination expectations section",
    ],
    referenceIds: ["R13", "R14", "R15", "R18", "R22", "R23", "R25", "R26", "R27"],
  },
  {
    title: "Emergency Response",
    detail: "Document response, clinic, posting, and injury-management details.",
    requiredInputs: [
      "Clinic / occupational health provider",
      "Clinic hours and directions",
      "AED and first aid kit locations",
      "Muster point",
      "Nearest hospital",
      "Emergency contact numbers",
      "Posted emergency contacts",
      "Incident reporting and investigation expectations",
      "Emergency map upload",
    ],
    documentSections: [
      "Emergency Contact and Posting",
      "Incident Command",
      "Medical Response",
      "Fire / EMT Coordination",
      "Weather Emergency Response",
      "Rescue Plan Triggers",
      "Incident Reporting and Investigation",
    ],
    generatedOutputs: [
      "Emergency response section",
      "Medical response plan",
      "Incident reporting section",
      "Emergency map / posting checklist",
      "Rescue plan triggers",
    ],
    referenceIds: ["R13", "R15", "R25", "R28", "R29", "R30", "R31"],
  },
  {
    title: "Inspections & Environment",
    detail: "Capture recurring events, weather, PPE, and environmental controls.",
    requiredInputs: [
      "Recurring event calendar items",
      "Inspection process and criteria",
      "Weather SOP",
      "Environmental controls",
      "PPE specifics",
      "Equipment and spotter controls",
      "Hazardous materials / chemical storage controls",
      "Disciplinary policy",
      "Owner message template and letter",
      "Special conditions / variations",
    ],
    documentSections: [
      "Recurring Event Calendar",
      "Inspection Program",
      "Weather SOP",
      "Environmental Controls",
      "PPE Specifics",
      "Equipment and Spotter Controls",
      "Hazardous Materials / Chemical Storage",
      "Disciplinary Policy",
      "Owner Message and Leadership Commitment",
      "Special Conditions / Variations",
    ],
    generatedOutputs: [
      "Inspection calendar",
      "Inspection and audit criteria",
      "Weather SOP",
      "Environmental controls section",
      "PPE section",
      "Equipment / spotter controls",
      "Hazardous materials section",
      "Disciplinary policy",
      "Owner letter / message",
      "Special conditions / variations section",
    ],
    referenceIds: ["R12", "R16", "R24", "R32", "R33", "R34", "R35", "R36", "R37"],
  },
  {
    title: "Submit / Admin Review",
    detail: "Review readiness and send to admin review.",
    requiredInputs: [
      "Readiness checklist status",
      "Plan snapshot",
      "Generated PSHEP draft",
      "Missing inputs",
      "Manual review items",
      "Uploaded supporting documents",
      "Submission agreement",
      "Admin reviewer notes",
    ],
    documentSections: [
      "Readiness Checklist",
      "Plan Snapshot",
      "Checklist Coverage Advisor",
      "Admin Handoff Package",
      "Document Export Requirements",
    ],
    generatedOutputs: [
      "Submission package",
      "Admin readiness review",
      "Generated PSHEP draft",
      "Reviewer checklist",
      "Reference register",
      "Revision history",
    ],
    referenceIds: ["R1-R37", "R38", "R39", "R40", "R41"],
  },
];

const permitOptions = getPshsepCatalogOptions("permits_selected");
const scopeOptions = getPshsepCatalogOptions("scope_of_work_selected");
const highRiskFocusOptions = getPshsepCatalogOptions("high_risk_focus_areas");
const assumedTradeOptions = getPshsepCatalogOptions("assumed_trades_index");
const ancillaryContractorOptions = getPshsepCatalogOptions("ancillary_contractors");
const projectDeliveryOptions = [
  { value: "ground_up", label: "Ground-Up New Build" },
  { value: "renovation", label: "Building Refurbishment / Renovation" },
];

const eventCalendarOptions = [
  "Orientation completed before work starts",
  "Routine jobsite inspections",
  "Fire department / EMT walk-through",
  "Training matrix review",
  "Emergency drill",
  "Permit audit",
  "Weather review / alerts",
  "Environmental / stormwater site walk",
];

const textareaAiHints: Record<DraftableAnswerField, string> = {
  project_description:
    `Summarize the project scope, major phases, active trades, site conditions, and standout risks in plain ${SITE_SAFETY_BLUEPRINT_TITLE} language.`,
  owner_specific_requirements_text:
    "Describe owner, client, or project-specific expectations that go beyond the default company program.",
  definitions_text:
    "Define terms that the field team needs early, such as competent person, ancillary contractor, high-risk work, IDLH, and site-specific severe-event language.",
  oversight_roles_text:
    "Describe who owns safety oversight across the owner, GC / CM, contractor supervision, and field leadership.",
  competent_person_requirements_text:
    "Explain how competent persons are designated, what authority they carry, and which work scopes require them.",
  staffing_requirements_text:
    "Describe how staffing and supervision scale with manpower, simultaneous operations, and changing work fronts.",
  trade_training_requirements_text:
    "List trade-specific training expectations for the work selected on this project.",
  certification_requirements_text:
    "Capture project-relevant qualifications and certifications that need to be verified before work starts.",
  contractor_coordination_text:
    "Explain how trades, subcontractors, and site services coordinate startup packets, scheduling, access, and shared hazards.",
  ancillary_contractors_notes:
    "Describe how ancillary contractors such as housekeeping, restroom service, security, or testing agencies are controlled on site.",
  disciplinary_policy_text:
    `Draft a practical disciplinary policy for ${SITE_SAFETY_BLUEPRINT_TITLE} noncompliance, including stop-work and removal language when needed.`,
  owner_letter_text:
    "Write a concise owner or leadership commitment statement supporting safe execution and accountability.",
  incident_reporting_process_text:
    "Explain exactly how injuries, incidents, near misses, and unsafe conditions are reported and escalated.",
  incident_investigation_text:
    "Describe how incident investigations are initiated, documented, and closed out after an event.",
  special_conditions_permit_text:
    "Explain how temporary variances or special conditions are reviewed, approved, controlled, and expired.",
  posted_emergency_contacts_text:
    "Draft text for the posted site emergency contact information and who should be listed.",
  emergency_posting_location:
    "Explain where emergency postings, addenda, or response maps are posted and how crews are directed to them.",
  inspection_process_text:
    "Describe routine inspections, condition-change inspections, permit checks, and who performs them.",
  event_calendar_notes_text:
    "Describe how recurring safety events, drills, inspections, and agency walk-throughs are tracked on the project calendar.",
  weather_sop_text:
    "Draft a weather SOP covering monitoring, triggers, communication, and stop-work or reassessment actions.",
  environmental_controls_text:
    "Describe stormwater, waste, spill prevention, and environmental walk expectations for this project.",
  ppe_specifics_text:
    "Draft project-specific PPE requirements and when upgraded or task-specific PPE is required.",
  equipment_controls_text:
    "Explain equipment travel, spotter use, exclusion zones, charging and staging controls, and egress protection.",
  chemical_storage_text:
    "Describe gas and chemical storage, compatibility, labeling, segregation, and handling expectations for the site.",
};

const initialAnswers: Answers = {
  jobsite_id: "",
  company_name: "SafetyDocs",
  company_address: "",
  project_name: "",
  project_number: "",
  project_address: "",
  project_phase: "",
  owner_site_address: "",
  governing_state: "",
  project_delivery_type: "",
  owner_client: "",
  gc_cm: "",
  project_description: "",
  owner_specific_requirements_text: "",
  definitions_text: "",
  oversight_roles_text: "",
  competent_person_requirements_text: "",
  staffing_requirements_text: "",
  requires_osha10: true,
  requires_osha30_pm_super_within_5yrs: true,
  requires_osha30_supervisor_on_site: true,
  requires_drug_card_ccs: false,
  requires_codex_access: false,
  requires_training_matrix_monthly: true,
  requires_background_check: false,
  orientation_required: true,
  orientation_pass_score: "80",
  trade_training_requirements_text: "",
  certification_requirements_text: "",
  permits_selected: [],
  lift_plans_required: true,
  critical_lift_review_required: true,
  scope_of_work_selected: [],
  high_risk_focus_areas: [],
  assumed_trades_index: [],
  contractor_coordination_text: "",
  ancillary_contractors: [],
  ancillary_contractors_notes: "",
  disciplinary_policy_text: "",
  owner_letter_text: "",
  incident_reporting_process_text: "",
  incident_investigation_text: "",
  special_conditions_permit_text: "",
  clinic_name: "",
  clinic_address: "",
  clinic_hours: "",
  posted_emergency_contacts_text: "",
  emergency_posting_location: "",
  inspection_process_text: "",
  event_calendar_items: [],
  event_calendar_notes_text: "",
  weather_sop_text: "",
  environmental_controls_text: "",
  ppe_specifics_text: "",
  equipment_controls_text: "",
  chemical_storage_text: "",
};

function toggleItem(values: string[], item: string) {
  return values.includes(item)
    ? values.filter((current) => current !== item)
    : [...values, item];
}

function buildJobsiteSelectLabel(jobsite: CompanyJobsite) {
  return [jobsite.name, jobsite.projectNumber, jobsite.location].filter(Boolean).join(" | ");
}

function buildJobsiteOversightText(jobsite: CompanyJobsite) {
  return [
    jobsite.projectManager ? `Project Manager: ${jobsite.projectManager}` : "",
    jobsite.safetyLead ? `Safety Lead: ${jobsite.safetyLead}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function PESHEPUniversalPage() {
  const { jobsites, loading: jobsitesLoading } = useCompanyWorkspaceData();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [siteMap, setSiteMap] = useState("");
  const [aedLocation, setAedLocation] = useState("");
  const [firstAidLocation, setFirstAidLocation] = useState("");
  const [assemblyPoint, setAssemblyPoint] = useState("");
  const [nearestHospital, setNearestHospital] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [companyLogoPreviewUrl, setCompanyLogoPreviewUrl] = useState<string | null>(null);
  const [companyLogoFileName, setCompanyLogoFileName] = useState<string | null>(null);
  const [agreedToSubmissionTerms, setAgreedToSubmissionTerms] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [aiDraftField, setAiDraftField] = useState<DraftableAnswerField | null>(null);
  const [ownerLetterPresetId, setOwnerLetterPresetId] = useState("");
  const [checklistEvaluation, setChecklistEvaluation] = useState<ChecklistEvaluationResponse | null>(
    null
  );
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const checklistRequestRef = useRef(0);
  const checklistAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) {
          console.error("Error loading user:", error.message);
        } else if (user) {
          setUserId(user.id);
          const sessionResult = await supabase.auth.getSession();
          const accessToken = sessionResult.data.session?.access_token;

          if (accessToken) {
            const meResponse = await fetch("/api/auth/me", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            const meData = (await meResponse.json().catch(() => null)) as
              | {
                  user?: {
                    permissionMap?: PermissionMap;
                    companyProfile?: { state_region?: string | null } | null;
                  };
                }
              | null;

            if (meResponse.ok) {
              setPermissionMap(meData?.user?.permissionMap ?? null);
              const companyState = meData?.user?.companyProfile?.state_region?.trim() ?? "";
              if (companyState) {
                setAnswers((prev) =>
                  prev.governing_state ? prev : { ...prev, governing_state: companyState }
                );
              }
            }
          }
        }
      } catch (error) {
        console.error("Unexpected auth error:", error);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        setAnswers(
          normalizePshsepBuilderFormData({
            ...initialAnswers,
            ...JSON.parse(raw),
          }) as Answers
        );
      }
    } catch {
      // Ignore saved-state errors.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify(normalizePshsepBuilderFormData(answers))
      );
    } catch {
      // Ignore saved-state errors.
    }
  }, [answers]);

  const readyCount = useMemo(() => {
    const checks = [
      answers.project_name,
      answers.project_number,
      answers.project_address,
      answers.project_delivery_type,
      answers.owner_client,
      answers.gc_cm,
      answers.definitions_text,
      answers.oversight_roles_text,
      answers.staffing_requirements_text,
      answers.trade_training_requirements_text,
      answers.scope_of_work_selected.length > 0 ? "yes" : "",
      answers.high_risk_focus_areas.length > 0 ? "yes" : "",
      answers.permits_selected.length > 0 ? "yes" : "",
      answers.assumed_trades_index.length > 0 ? "yes" : "",
      answers.contractor_coordination_text,
      answers.disciplinary_policy_text,
      answers.owner_letter_text,
      answers.incident_reporting_process_text,
      answers.special_conditions_permit_text,
      answers.inspection_process_text,
      answers.event_calendar_items.length > 0 ? "yes" : "",
      answers.weather_sop_text,
      answers.environmental_controls_text,
      answers.clinic_name,
      aedLocation,
      assemblyPoint,
    ];
    return checks.filter(Boolean).length;
  }, [answers, aedLocation, assemblyPoint]);

  const readinessItems = [
    {
      label: "Project details entered",
      done: Boolean(
        answers.project_name &&
          answers.project_number &&
          answers.project_delivery_type
      ),
    },
    {
      label: "Definitions and oversight drafted",
      done: Boolean(
        answers.definitions_text &&
          answers.oversight_roles_text &&
          answers.staffing_requirements_text
      ),
    },
    {
      label: "Training and access requirements captured",
      done: Boolean(
        answers.trade_training_requirements_text &&
          answers.certification_requirements_text
      ),
    },
    {
      label: "Scope and high-risk work selected",
      done:
        answers.scope_of_work_selected.length > 0 &&
        answers.high_risk_focus_areas.length > 0,
    },
    {
      label: "Coordination and permits reviewed",
      done: Boolean(
        answers.permits_selected.length > 0 &&
          answers.assumed_trades_index.length > 0 &&
          answers.contractor_coordination_text
      ),
    },
    {
      label: "Emergency response details entered",
      done: Boolean(
          answers.incident_reporting_process_text &&
          answers.clinic_name &&
          aedLocation &&
          assemblyPoint
      ),
    },
    {
      label: "Inspection and environmental controls drafted",
      done: Boolean(
        answers.inspection_process_text &&
          answers.event_calendar_items.length > 0 &&
          answers.weather_sop_text &&
          answers.environmental_controls_text
      ),
    },
    {
      label: "Admin policy sections drafted",
      done: Boolean(
        answers.disciplinary_policy_text &&
          answers.owner_letter_text &&
          answers.special_conditions_permit_text
      ),
    },
    { label: "Submission agreement accepted", done: agreedToSubmissionTerms },
  ];
  const sectionProgress = [
    {
      complete: [
        answers.project_name,
        answers.project_number,
        answers.project_address,
        answers.project_delivery_type,
        answers.owner_client,
        answers.gc_cm,
        answers.project_description,
        answers.owner_specific_requirements_text,
      ].filter(Boolean).length,
      total: 8,
    },
    {
      complete: [
        answers.definitions_text,
        answers.oversight_roles_text,
        answers.competent_person_requirements_text,
        answers.staffing_requirements_text,
      ].filter(Boolean).length,
      total: 4,
    },
    {
      complete: [
        answers.requires_osha10,
        answers.requires_osha30_pm_super_within_5yrs,
        answers.requires_osha30_supervisor_on_site,
        answers.orientation_required,
        answers.trade_training_requirements_text,
        answers.certification_requirements_text,
      ].filter(Boolean).length,
      total: 6,
    },
    {
      complete:
        (answers.scope_of_work_selected.length > 0 ? 1 : 0) +
        (answers.high_risk_focus_areas.length > 0 ? 1 : 0),
      total: 2,
    },
    {
      complete: [
        answers.permits_selected.length > 0,
        answers.assumed_trades_index.length > 0,
        answers.ancillary_contractors.length > 0,
        answers.contractor_coordination_text,
        answers.ancillary_contractors_notes,
      ].filter(Boolean).length,
      total: 5,
    },
    {
      complete: [
        answers.clinic_name,
        answers.clinic_address,
        aedLocation,
        assemblyPoint,
        answers.posted_emergency_contacts_text,
        answers.incident_reporting_process_text,
        answers.incident_investigation_text,
      ].filter(Boolean).length,
      total: 7,
    },
    {
      complete: [
        answers.event_calendar_items.length > 0,
        answers.inspection_process_text,
        answers.weather_sop_text,
        answers.environmental_controls_text,
        answers.disciplinary_policy_text,
        answers.owner_letter_text,
        answers.special_conditions_permit_text,
      ].filter(Boolean).length,
      total: 7,
    },
    {
      complete: [agreedToSubmissionTerms].filter(Boolean).length,
      total: 1,
    },
  ];
  const canUseBuilder = Boolean(
    permissionMap?.can_create_documents && permissionMap?.can_edit_documents
  );
  const canSubmitDocuments = Boolean(permissionMap?.can_submit_documents);
  const normalizedAnswers = useMemo(
    () => normalizePshsepBuilderFormData(answers) as Answers,
    [answers]
  );
  const jurisdictionProfile = useMemo(
    () => resolveBuilderJurisdiction({ governingState: normalizedAnswers.governing_state }),
    [normalizedAnswers.governing_state]
  );
  const jobsiteOptions = useMemo(
    () =>
      jobsites
        .filter((jobsite) => jobsite.source === "table")
        .map((jobsite) => ({
          value: jobsite.id,
          label: buildJobsiteSelectLabel(jobsite),
        })),
    [jobsites]
  );

  const checklistFormData = useMemo(
    () => ({
      ...normalizedAnswers,
      jurisdiction_code: jurisdictionProfile.jurisdictionCode,
      emergency_map: {
        aed_location: aedLocation,
        first_aid_location: firstAidLocation,
        assembly_point: assemblyPoint,
        nearest_hospital: nearestHospital,
        emergency_contact: emergencyContact,
      },
    }),
    [
      aedLocation,
      assemblyPoint,
      emergencyContact,
      firstAidLocation,
      jurisdictionProfile.jurisdictionCode,
      nearestHospital,
      normalizedAnswers,
    ]
  );

  const aiStructuredContext = useMemo(
    () =>
      JSON.stringify({
        surface: "peshep_builder",
        currentStep: steps[step]?.title ?? null,
        project_name: normalizedAnswers.project_name,
        project_number: normalizedAnswers.project_number,
        project_address: normalizedAnswers.project_address,
        owner_client: normalizedAnswers.owner_client,
        gc_cm: normalizedAnswers.gc_cm,
        scope_of_work_selected: normalizedAnswers.scope_of_work_selected,
        high_risk_focus_areas: normalizedAnswers.high_risk_focus_areas,
        permits_selected: normalizedAnswers.permits_selected,
        assumed_trades_index: normalizedAnswers.assumed_trades_index,
        ancillary_contractors: normalizedAnswers.ancillary_contractors,
        emergency_map: checklistFormData.emergency_map,
        checklistEvaluationSummary: checklistEvaluation?.summary ?? null,
      }),
    [checklistEvaluation?.summary, checklistFormData.emergency_map, normalizedAnswers, step]
  );

  const refreshChecklistEvaluation = useCallback(async () => {
    if (authLoading || !canUseBuilder) return;
    const requestId = checklistRequestRef.current + 1;
    checklistRequestRef.current = requestId;
    checklistAbortControllerRef.current?.abort();
    const controller = new AbortController();
    checklistAbortControllerRef.current = controller;
    setChecklistLoading(true);
    setChecklistError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sign in to evaluate checklist coverage.");
      }
      const response = await fetch("/api/company/checklist/evaluate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface: "peshep",
          formData: checklistFormData,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | ChecklistEvaluationResponse
        | null;
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "Checklist evaluation failed.");
      }
      if (requestId !== checklistRequestRef.current) return;
      setChecklistEvaluation(payload as ChecklistEvaluationResponse);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      if (requestId !== checklistRequestRef.current) return;
      setChecklistError(error instanceof Error ? error.message : "Checklist evaluation failed.");
    } finally {
      if (requestId !== checklistRequestRef.current) return;
      setChecklistLoading(false);
    }
  }, [authLoading, canUseBuilder, checklistFormData]);

  useEffect(() => {
    if (authLoading || !canUseBuilder) return;
    const timeout = window.setTimeout(() => {
      void refreshChecklistEvaluation();
    }, 700);
    return () => {
      window.clearTimeout(timeout);
      checklistAbortControllerRef.current?.abort();
    };
  }, [authLoading, canUseBuilder, refreshChecklistEvaluation]);

  function resetDraft() {
    localStorage.removeItem(LS_KEY);
    setAnswers(initialAnswers);
    setSiteMap("");
    setAedLocation("");
    setFirstAidLocation("");
    setAssemblyPoint("");
    setNearestHospital("");
    setEmergencyContact("");
    setCompanyLogoPreviewUrl(null);
    setCompanyLogoFileName(null);
    setAgreedToSubmissionTerms(false);
    setOwnerLetterPresetId("");
    setMessage("");
    setStep(0);
  }

  function updateField<K extends keyof Answers>(field: K, value: Answers[K]) {
    setAnswers((current) => ({ ...current, [field]: value }));
  }

  function applyJobsiteToAnswers(jobsiteId: string) {
    const selectedJobsite = jobsites.find((jobsite) => jobsite.id === jobsiteId);

    setAnswers((current) => {
      if (!selectedJobsite) {
        return { ...current, jobsite_id: "" };
      }

      return {
        ...current,
        jobsite_id: selectedJobsite.id,
        project_name: selectedJobsite.name,
        project_number: selectedJobsite.projectNumber || current.project_number,
        project_address: selectedJobsite.location || current.project_address,
        project_description: selectedJobsite.notes || current.project_description,
        oversight_roles_text:
          buildJobsiteOversightText(selectedJobsite) || current.oversight_roles_text,
      };
    });
  }

  function handleOwnerLetterPresetChange(value: string) {
    setOwnerLetterPresetId(value);
    const preset = getOwnerMessagePreset(value);
    if (preset) {
      updateField("owner_letter_text", preset.message);
    }
  }

  async function handleAiDraft(field: DraftableAnswerField, label: string) {
    const hint = textareaAiHints[field];
    const currentValue = answers[field];

    try {
      setAiDraftField(field);
      setMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sign in to use smart drafting.");
      }

      const prompt = [
        `Draft content for the ${SITE_SAFETY_BLUEPRINT_TITLE} field "${label}".`,
        "Return only the text that should be inserted into the field. Do not include markdown fences, intro text, or labels.",
        hint,
        currentValue.trim()
          ? `Improve and expand this existing draft while preserving any useful project-specific details:\n${currentValue.trim()}`
          : "Generate a strong first draft tailored to the current project context.",
      ].join("\n\n");

      const response = await fetch("/api/company/ai/assist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface: "peshep",
          message: prompt,
          context: aiStructuredContext,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; text?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Smart drafting failed.");
      }

      const draft = data?.text?.trim();
      if (!draft) {
        throw new Error("The smart drafting tool did not return draft text for this field.");
      }

      updateField(field, draft as Answers[typeof field]);
      setMessageTone("success");
      setMessage(`Smart drafting updated ${label.toLowerCase()} in the form.`);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Smart drafting failed.");
    } finally {
      setAiDraftField(null);
    }
  }

  function handleSiteMapUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setSiteMap(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleCompanyLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCompanyLogoPreviewUrl(typeof reader.result === "string" ? reader.result : null);
      setCompanyLogoFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function clearCompanyLogo() {
    setCompanyLogoPreviewUrl(null);
    setCompanyLogoFileName(null);
  }

  async function handleSubmitForReview() {
    try {
      setMessage("");
      if (!permissionMap?.can_submit_documents) {
        setMessageTone("warning");
        setMessage(`Your current role cannot submit ${SITE_SAFETY_BLUEPRINT_TITLE} records into review.`);
        return;
      }
      if (authLoading) {
        setMessageTone("warning");
        setMessage("Your account is still loading. Try again in a moment.");
        return;
      }
      if (!userId) {
        setMessageTone("error");
        setMessage("No logged-in user was found. Please sign in again.");
        return;
      }
      if (!agreedToSubmissionTerms) {
        setMessageTone("warning");
        setMessage("You must accept the agreement before submitting.");
        return;
      }
      if (!normalizedAnswers.project_delivery_type) {
        setMessageTone("warning");
        setMessage("Select a project delivery type before submitting.");
        return;
      }

      setSubmitLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please log in again.");

      const submissionFormData = {
        ...normalizePshsepBuilderFormData(answers),
        governing_state: normalizedAnswers.governing_state,
        jurisdiction_code: jurisdictionProfile.jurisdictionCode,
        jurisdiction_plan_type: jurisdictionProfile.jurisdictionPlanType,
        company_logo_data_url: companyLogoPreviewUrl,
        company_logo_file_name: companyLogoFileName,
        emergency_map: {
          aed_location: aedLocation,
          first_aid_location: firstAidLocation,
          assembly_point: assemblyPoint,
          nearest_hospital: nearestHospital,
          emergency_contact: emergencyContact,
          site_map: siteMap,
        },
      };

      const res = await fetch("/api/documents/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_type: "PESHEP",
          project_name: answers.project_name,
          form_data: {
            ...submissionFormData,
            generationContext: buildPshsepGenerationContext(submissionFormData),
          },
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to submit document.");

      setMessageTone("success");
      setMessage(`${SITE_SAFETY_BLUEPRINT_TITLE} submitted successfully and moved into the admin review queue.`);
      setStep(7);
    } catch (error) {
      console.error("Submit error:", error);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-[13px] text-slate-300">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
              Builder Workspace
            </div>
            <h1 className="mt-1 text-xl font-black leading-tight text-slate-50 md:text-2xl">
              {SITE_SAFETY_BLUEPRINT_BUILDER_LABEL}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
              Compact workbench for the sitewide master plan. Build each section, check coverage, and submit for review without changing the export payload.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Reset Draft
            </button>
            <button
              type="button"
              onClick={() => setStep(7)}
              className="app-btn-gradient-primary px-3 py-2 text-xs"
            >
              Submit Section
            </button>
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          AI and knowledge helpers
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <CompanyAiAssistPanel
            surface="peshep"
            structuredContext={JSON.stringify({
              project_name: answers.project_name,
              company_name: answers.company_name,
              step: steps[step]?.title,
              checklistEvaluationSummary: checklistEvaluation?.summary ?? null,
              checklistNeedsUserInput:
                checklistEvaluation?.rows
                  .filter((row) => row.coverage === "needs_user_input")
                  .slice(0, 10)
                  .map((row) => ({
                    item: row.item,
                    missingFields: row.missingFields,
                  })) ?? [],
            })}
          />
          <CompanyMemoryBankPanel />
        </div>
      </details>

      <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_310px]">
        <BuilderSectionNav
          steps={steps}
          progress={sectionProgress}
          activeStep={step}
          onSelect={setStep}
        />

        <div className="min-w-0 space-y-4">
          <CompactPanel
            eyebrow={`Section ${step + 1} of ${steps.length}`}
            title={steps[step].title}
            description={steps[step].detail}
            aside={`${sectionProgress[step].complete}/${sectionProgress[step].total}`}
          >
            {!authLoading && !canUseBuilder ? (
              <div className="mb-3">
                <InlineMessage tone="warning">
                  Your current role can view builder progress, but it cannot create or edit {SITE_SAFETY_BLUEPRINT_TITLE} drafts.
                </InlineMessage>
              </div>
            ) : null}
            <div className="mb-3">
              <InlineMessage tone="success">
                This blueprint is the sitewide master plan that covers the full project.
              </InlineMessage>
            </div>
            <DocumentSectionPreview
              stepNumber={step + 1}
              step={steps[step]}
            />

            {message ? (
              <div className="mt-3">
                <InlineMessage tone={messageTone}>{message}</InlineMessage>
              </div>
            ) : null}

            <fieldset
              disabled={authLoading || !canUseBuilder}
              className="mt-4 space-y-4 disabled:opacity-60"
            >
              {step === 0 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Select
                        label="Fill from Jobsite"
                        value={answers.jobsite_id}
                        options={[
                          {
                            value: "",
                            label: jobsitesLoading ? "Loading jobsites" : "Choose a saved jobsite",
                          },
                          ...jobsiteOptions,
                        ]}
                        onChange={applyJobsiteToAnswers}
                      />
                    </div>
                    <Field label="Company Name (branding)" value={answers.company_name} onChange={(value) => updateField("company_name", value)} />
                    <Field label="Project Name" value={answers.project_name} onChange={(value) => updateField("project_name", value)} />
                    <div className="md:col-span-2">
                      <TextArea
                        label="Company Address (for this project / cover page)"
                        value={answers.company_address}
                        onChange={(value) => updateField("company_address", value)}
                      />
                    </div>
                    <Field label="Project Number" value={answers.project_number} onChange={(value) => updateField("project_number", value)} />
                    <Field label="Project Phase" value={answers.project_phase} onChange={(value) => updateField("project_phase", value)} />
                    <Field label="Project Address (site / jobsite)" value={answers.project_address} onChange={(value) => updateField("project_address", value)} />
                    <Select
                      label="Governing State"
                      value={answers.governing_state}
                      options={[
                        { value: "", label: "Select state" },
                        ...jurisdictionStateOptions.map((option) => ({
                          value: option.code,
                          label: option.name,
                        })),
                      ]}
                      onChange={(value) => updateField("governing_state", value)}
                    />
                    <Select
                      label="Project Delivery Type"
                      value={answers.project_delivery_type}
                      options={[
                        { value: "", label: "Select delivery type" },
                        ...projectDeliveryOptions,
                      ]}
                      onChange={(value) =>
                        updateField("project_delivery_type", value)
                      }
                    />
                    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Jurisdiction Profile
                      </div>
                      <div className="text-sm font-semibold text-slate-100">
                        {jurisdictionProfile.jurisdictionLabel}
                      </div>
                    </div>
                    <Field label="Owner / Client" value={answers.owner_client} onChange={(value) => updateField("owner_client", value)} />
                    <Field label="GC / CM" value={answers.gc_cm} onChange={(value) => updateField("gc_cm", value)} />
                    <div className="md:col-span-2">
                      <TextArea
                        label="Owner Site Address (owner address for the site — cover page)"
                        value={answers.owner_site_address}
                        onChange={(value) => updateField("owner_site_address", value)}
                      />
                    </div>
                    <div className="md:col-span-2 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Cover logo
                      </div>
                      <p className="mb-3 text-xs leading-5 text-slate-400">
                        Optional. Upload a PNG or JPG. It appears on the first page of the Word export above the project banner.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-950/50">
                          Upload logo
                          <input type="file" accept="image/*" className="hidden" onChange={handleCompanyLogoChange} />
                        </label>
                        {companyLogoPreviewUrl ? (
                          <button
                            type="button"
                            onClick={clearCompanyLogo}
                            className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-950/50"
                          >
                            Clear logo
                          </button>
                        ) : null}
                      </div>
                      {companyLogoPreviewUrl ? (
                        <div className="mt-3 flex items-start gap-3">
                          <div className="relative h-16 w-40 overflow-hidden rounded-lg border border-slate-600 bg-slate-900">
                            <Image
                              src={companyLogoPreviewUrl}
                              alt="Company logo preview"
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          </div>
                          <div className="text-xs text-slate-500">
                            {companyLogoFileName ?? "Uploaded logo"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <TextArea
                    label="Project Description"
                    value={answers.project_description}
                    onChange={(value) => updateField("project_description", value)}
                    onAiDraft={() => void handleAiDraft("project_description", "Project Description")}
                    aiLoading={aiDraftField === "project_description"}
                  />
                  <TextArea
                    label="Owner / Project Specific Requirements"
                    value={answers.owner_specific_requirements_text}
                    onChange={(value) => updateField("owner_specific_requirements_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "owner_specific_requirements_text",
                        "Owner / Project Specific Requirements"
                      )
                    }
                    aiLoading={aiDraftField === "owner_specific_requirements_text"}
                  />
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <TextArea
                    label="Definitions"
                    value={answers.definitions_text}
                    onChange={(value) => updateField("definitions_text", value)}
                    onAiDraft={() => void handleAiDraft("definitions_text", "Definitions")}
                    aiLoading={aiDraftField === "definitions_text"}
                  />
                  <TextArea
                    label="Oversight Roles and Responsibilities"
                    value={answers.oversight_roles_text}
                    onChange={(value) => updateField("oversight_roles_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "oversight_roles_text",
                        "Oversight Roles and Responsibilities"
                      )
                    }
                    aiLoading={aiDraftField === "oversight_roles_text"}
                  />
                  <TextArea
                    label="Competent Person Requirements"
                    value={answers.competent_person_requirements_text}
                    onChange={(value) =>
                      updateField("competent_person_requirements_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "competent_person_requirements_text",
                        "Competent Person Requirements"
                      )
                    }
                    aiLoading={aiDraftField === "competent_person_requirements_text"}
                  />
                  <TextArea
                    label="Staffing / Headcount Expectations"
                    value={answers.staffing_requirements_text}
                    onChange={(value) => updateField("staffing_requirements_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "staffing_requirements_text",
                        "Staffing / Headcount Expectations"
                      )
                    }
                    aiLoading={aiDraftField === "staffing_requirements_text"}
                  />
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Toggle label="OSHA 10 required for all workers" value={answers.requires_osha10} onChange={(value) => updateField("requires_osha10", value)} />
                  <Toggle label="OSHA 30 required for PM/Superintendent within last 5 years" value={answers.requires_osha30_pm_super_within_5yrs} onChange={(value) => updateField("requires_osha30_pm_super_within_5yrs", value)} />
                  <Toggle label="Each contractor must have an OSHA 30 supervisor on-site" value={answers.requires_osha30_supervisor_on_site} onChange={(value) => updateField("requires_osha30_supervisor_on_site", value)} />
                  <Toggle label="Drug card / CCS compliance required" value={answers.requires_drug_card_ccs} onChange={(value) => updateField("requires_drug_card_ccs", value)} />
                  <Toggle label="CODEX approval required for site access" value={answers.requires_codex_access} onChange={(value) => updateField("requires_codex_access", value)} />
                  <Toggle label="Training matrix required and updated monthly" value={answers.requires_training_matrix_monthly} onChange={(value) => updateField("requires_training_matrix_monthly", value)} />
                  <Toggle label="Background check required" value={answers.requires_background_check} onChange={(value) => updateField("requires_background_check", value)} />
                  <Toggle label="Orientation required" value={answers.orientation_required} onChange={(value) => updateField("orientation_required", value)} />
                  {answers.orientation_required ? (
                    <Select
                      label="Orientation quiz passing score"
                      value={answers.orientation_pass_score}
                      options={[
                        { value: "70", label: "70%" },
                        { value: "80", label: "80%" },
                        { value: "90", label: "90%" },
                      ]}
                      onChange={(value) => updateField("orientation_pass_score", value as Answers["orientation_pass_score"])}
                    />
                  ) : null}
                  <TextArea
                    label="Trade-Specific Training Requirements"
                    value={answers.trade_training_requirements_text}
                    onChange={(value) =>
                      updateField("trade_training_requirements_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "trade_training_requirements_text",
                        "Trade-Specific Training Requirements"
                      )
                    }
                    aiLoading={aiDraftField === "trade_training_requirements_text"}
                  />
                  <TextArea
                    label="Certification / Qualification Requirements"
                    value={answers.certification_requirements_text}
                    onChange={(value) =>
                      updateField("certification_requirements_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "certification_requirements_text",
                        "Certification / Qualification Requirements"
                      )
                    }
                    aiLoading={aiDraftField === "certification_requirements_text"}
                  />
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Scope of Work
                    </div>
                    <SelectionGrid
                      values={answers.scope_of_work_selected}
                      options={scopeOptions}
                      onToggle={(item) =>
                        updateField(
                          "scope_of_work_selected",
                          toggleItem(answers.scope_of_work_selected, item)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      High-Risk Focus Areas
                    </div>
                    <SelectionGrid
                      values={answers.high_risk_focus_areas}
                      options={highRiskFocusOptions}
                      onToggle={(item) =>
                        updateField(
                          "high_risk_focus_areas",
                          toggleItem(answers.high_risk_focus_areas, item)
                        )
                      }
                    />
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Required Permits
                    </div>
                    <SelectionGrid
                      values={answers.permits_selected}
                      options={permitOptions}
                      onToggle={(item) =>
                        updateField("permits_selected", toggleItem(answers.permits_selected, item))
                      }
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Toggle label="Lift plans required for crane operations" value={answers.lift_plans_required} onChange={(value) => updateField("lift_plans_required", value)} />
                    <Toggle label="Critical lifts reviewed by GC safety" value={answers.critical_lift_review_required} onChange={(value) => updateField("critical_lift_review_required", value)} />
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Assumed Trades
                    </div>
                    <SelectionGrid
                      values={answers.assumed_trades_index}
                      options={assumedTradeOptions}
                      onToggle={(item) =>
                        updateField(
                          "assumed_trades_index",
                          toggleItem(answers.assumed_trades_index, item)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Ancillary Contractors
                    </div>
                    <SelectionGrid
                      values={answers.ancillary_contractors}
                      options={ancillaryContractorOptions}
                      onToggle={(item) =>
                        updateField(
                          "ancillary_contractors",
                          toggleItem(answers.ancillary_contractors, item)
                        )
                      }
                    />
                  </div>
                  <TextArea
                    label="Contractor Coordination Expectations"
                    value={answers.contractor_coordination_text}
                    onChange={(value) =>
                      updateField("contractor_coordination_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "contractor_coordination_text",
                        "Contractor Coordination Expectations"
                      )
                    }
                    aiLoading={aiDraftField === "contractor_coordination_text"}
                  />
                  <TextArea
                    label="Ancillary Contractor Notes"
                    value={answers.ancillary_contractors_notes}
                    onChange={(value) =>
                      updateField("ancillary_contractors_notes", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "ancillary_contractors_notes",
                        "Ancillary Contractor Notes"
                      )
                    }
                    aiLoading={aiDraftField === "ancillary_contractors_notes"}
                  />
                </>
              ) : null}

              {step === 5 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Clinic / Occupational Health Provider"
                      value={answers.clinic_name}
                      onChange={(value) => updateField("clinic_name", value)}
                    />
                    <Field
                      label="Clinic Hours"
                      value={answers.clinic_hours}
                      onChange={(value) => updateField("clinic_hours", value)}
                    />
                  </div>
                  <Field
                    label="Clinic Address / Directions"
                    value={answers.clinic_address}
                    onChange={(value) => updateField("clinic_address", value)}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="AED Location" value={aedLocation} onChange={setAedLocation} />
                    <Field label="First Aid Kit Location" value={firstAidLocation} onChange={setFirstAidLocation} />
                    <Field label="Muster Point" value={assemblyPoint} onChange={setAssemblyPoint} />
                    <Field label="Nearest Hospital" value={nearestHospital} onChange={setNearestHospital} />
                    <Field label="Emergency Contact Number" value={emergencyContact} onChange={setEmergencyContact} />
                  </div>
                  <TextArea
                    label="Posted Emergency Contacts"
                    value={answers.posted_emergency_contacts_text}
                    onChange={(value) =>
                      updateField("posted_emergency_contacts_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "posted_emergency_contacts_text",
                        "Posted Emergency Contacts"
                      )
                    }
                    aiLoading={aiDraftField === "posted_emergency_contacts_text"}
                  />
                  <TextArea
                    label="Emergency Posting Location / Addendum Reference"
                    value={answers.emergency_posting_location}
                    onChange={(value) =>
                      updateField("emergency_posting_location", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "emergency_posting_location",
                        "Emergency Posting Location / Addendum Reference"
                      )
                    }
                    aiLoading={aiDraftField === "emergency_posting_location"}
                  />
                  <TextArea
                    label="Incident Reporting Process"
                    value={answers.incident_reporting_process_text}
                    onChange={(value) => updateField("incident_reporting_process_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "incident_reporting_process_text",
                        "Incident Reporting Process"
                      )
                    }
                    aiLoading={aiDraftField === "incident_reporting_process_text"}
                  />
                  <TextArea
                    label="Incident Investigation Expectations"
                    value={answers.incident_investigation_text}
                    onChange={(value) =>
                      updateField("incident_investigation_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "incident_investigation_text",
                        "Incident Investigation Expectations"
                      )
                    }
                    aiLoading={aiDraftField === "incident_investigation_text"}
                  />
                  <label className="block">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Emergency Map Upload</div>
                    <input type="file" accept="image/*,.pdf" onChange={handleSiteMapUpload} className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm" />
                  </label>
                  {siteMap ? (
                    <Image
                      src={siteMap}
                      alt="Emergency map preview"
                      width={1200}
                      height={900}
                      unoptimized
                      className="max-h-96 w-auto rounded-2xl border border-slate-600"
                    />
                  ) : null}
                </>
              ) : null}

              {step === 6 ? (
                <>
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Recurring Event Calendar
                    </div>
                    <SelectionGrid
                      values={answers.event_calendar_items}
                      options={eventCalendarOptions}
                      onToggle={(item) =>
                        updateField(
                          "event_calendar_items",
                          toggleItem(answers.event_calendar_items, item)
                        )
                      }
                    />
                  </div>
                  <TextArea
                    label="Inspection Process and Criteria"
                    value={answers.inspection_process_text}
                    onChange={(value) => updateField("inspection_process_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "inspection_process_text",
                        "Inspection Process and Criteria"
                      )
                    }
                    aiLoading={aiDraftField === "inspection_process_text"}
                  />
                  <TextArea
                    label="Event Calendar Notes"
                    value={answers.event_calendar_notes_text}
                    onChange={(value) => updateField("event_calendar_notes_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "event_calendar_notes_text",
                        "Event Calendar Notes"
                      )
                    }
                    aiLoading={aiDraftField === "event_calendar_notes_text"}
                  />
                  <TextArea
                    label="Weather SOP"
                    value={answers.weather_sop_text}
                    onChange={(value) => updateField("weather_sop_text", value)}
                    onAiDraft={() => void handleAiDraft("weather_sop_text", "Weather SOP")}
                    aiLoading={aiDraftField === "weather_sop_text"}
                  />
                  <TextArea
                    label="Environmental Controls"
                    value={answers.environmental_controls_text}
                    onChange={(value) => updateField("environmental_controls_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "environmental_controls_text",
                        "Environmental Controls"
                      )
                    }
                    aiLoading={aiDraftField === "environmental_controls_text"}
                  />
                  <TextArea
                    label="PPE Specifics"
                    value={answers.ppe_specifics_text}
                    onChange={(value) => updateField("ppe_specifics_text", value)}
                    onAiDraft={() => void handleAiDraft("ppe_specifics_text", "PPE Specifics")}
                    aiLoading={aiDraftField === "ppe_specifics_text"}
                  />
                  <TextArea
                    label="Equipment and Spotter Controls"
                    value={answers.equipment_controls_text}
                    onChange={(value) => updateField("equipment_controls_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "equipment_controls_text",
                        "Equipment and Spotter Controls"
                      )
                    }
                    aiLoading={aiDraftField === "equipment_controls_text"}
                  />
                  <TextArea
                    label="Hazardous Materials / Chemical Storage Controls"
                    value={answers.chemical_storage_text}
                    onChange={(value) => updateField("chemical_storage_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft(
                        "chemical_storage_text",
                        "Hazardous Materials / Chemical Storage Controls"
                      )
                    }
                    aiLoading={aiDraftField === "chemical_storage_text"}
                  />
                  <TextArea
                    label="Disciplinary Policy"
                    value={answers.disciplinary_policy_text}
                    onChange={(value) => updateField("disciplinary_policy_text", value)}
                    onAiDraft={() =>
                      void handleAiDraft("disciplinary_policy_text", "Disciplinary Policy")
                    }
                    aiLoading={aiDraftField === "disciplinary_policy_text"}
                  />
                  <Select
                    label="Owner Message Template"
                    value={ownerLetterPresetId}
                    options={[
                      { value: "", label: "Choose owner message" },
                      ...OWNER_MESSAGE_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: preset.title,
                      })),
                    ]}
                    onChange={handleOwnerLetterPresetChange}
                  />
                  <TextArea
                    label="Letter from Owner"
                    value={answers.owner_letter_text}
                    onChange={(value) => updateField("owner_letter_text", value)}
                    onAiDraft={() => void handleAiDraft("owner_letter_text", "Letter from Owner")}
                    aiLoading={aiDraftField === "owner_letter_text"}
                  />
                  <TextArea
                    label="Special Conditions Permit (Variations)"
                    value={answers.special_conditions_permit_text}
                    onChange={(value) =>
                      updateField("special_conditions_permit_text", value)
                    }
                    onAiDraft={() =>
                      void handleAiDraft(
                        "special_conditions_permit_text",
                        "Special Conditions Permit (Variations)"
                      )
                    }
                    aiLoading={aiDraftField === "special_conditions_permit_text"}
                  />
                </>
              ) : null}

              {step === 7 ? (
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-5">
                  <div className="text-base font-semibold text-slate-100">Ready to submit</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Submit this {SITE_SAFETY_BLUEPRINT_TITLE} to the admin review queue. The final document becomes available after admin review is complete.
                  </p>
                  <div className="mt-4">
                    <LegalAcceptanceBlock checked={agreedToSubmissionTerms} onChange={setAgreedToSubmissionTerms} />
                  </div>
                </div>
              ) : null}
            </fieldset>
          </CompactPanel>

          <div className="sticky bottom-4 z-10">
            <div className="app-sticky-dark-bar p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-100">{steps[step].title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {step === 7 ? "Final review and submission controls." : "Continue to the next builder section when you are ready."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                    disabled={step === 0}
                    className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-950/50 disabled:opacity-50"
                  >
                    Back
                  </button>
                  {step < 7 ? (
                    <button
                      type="button"
                      onClick={() => setStep((current) => Math.min(7, current + 1))}
                      disabled={authLoading || !canUseBuilder}
                      className="app-btn-gradient-primary px-3 py-2 text-xs disabled:opacity-50"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitForReview}
                      disabled={submitLoading || !agreedToSubmissionTerms || authLoading || !canSubmitDocuments}
                      className="app-btn-gradient-submit px-3 py-2 text-xs disabled:opacity-50"
                    >
                      {submitLoading ? "Submitting..." : "Submit for Review"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <BuilderSidePanel
          steps={steps}
          activeStep={step}
          onSelectStep={setStep}
          readyCount={readyCount}
          readinessItems={readinessItems}
          checklistLoading={checklistLoading}
          checklistError={checklistError}
          checklistEvaluation={checklistEvaluation}
          onRefreshChecklist={refreshChecklistEvaluation}
        >
          <div className="grid gap-2">
            <SummaryRow label="Project" value={answers.project_name || "Not set"} />
            <SummaryRow label="Jurisdiction" value={jurisdictionProfile.jurisdictionLabel} />
            <SummaryRow label="Definitions" value={answers.definitions_text ? "Drafted" : "Missing"} />
            <SummaryRow label="Work" value={answers.scope_of_work_selected.length ? `${answers.scope_of_work_selected.length} selected` : "None"} />
            <SummaryRow label="High Risk" value={answers.high_risk_focus_areas.length ? `${answers.high_risk_focus_areas.length} selected` : "None"} />
            <SummaryRow label="Permits" value={answers.permits_selected.length ? `${answers.permits_selected.length} selected` : "None"} />
            <SummaryRow label="Trades" value={answers.assumed_trades_index.length ? `${answers.assumed_trades_index.length} selected` : "None"} />
            <SummaryRow label="Events" value={answers.event_calendar_items.length ? `${answers.event_calendar_items.length} selected` : "None"} />
            <SummaryRow label="Orientation" value={answers.orientation_required ? `${answers.orientation_pass_score}%` : "No"} />
            <SummaryRow label="Clinic" value={answers.clinic_name || "Missing"} />
            <SummaryRow label="Map" value={siteMap ? "Uploaded" : "Missing"} />
          </div>
        </BuilderSidePanel>
      </div>
    </div>
  );
}

function CompactPanel({
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/65 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-0.5 text-base font-black leading-tight text-slate-50">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
          ) : null}
        </div>
        {aside ? (
          <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200">
            {aside}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function BuilderSectionNav({
  steps,
  progress,
  activeStep,
  onSelect,
}: {
  steps: BuilderStep[];
  progress: Array<{ complete: number; total: number }>;
  activeStep: number;
  onSelect: (step: number) => void;
}) {
  return (
    <nav className="sticky top-4 h-max rounded-2xl border border-slate-700/70 bg-slate-950/65 p-2 shadow-sm">
      <div className="px-2 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        PSHEP Map
      </div>
      <div className="space-y-1">
        {steps.map((item, index) => {
          const current = progress[index];
          const isComplete = current.complete >= current.total;
          const isActive = index === activeStep;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelect(index)}
              className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                isActive
                  ? "border-sky-500/40 bg-sky-950/35 text-white"
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    isComplete ? "bg-emerald-400" : isActive ? "bg-sky-300" : "bg-amber-300"
                  }`}
                />
              </div>
              <div className="mt-1 text-xs font-bold leading-4">{item.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {current.complete}/{current.total} complete · {item.documentSections.length} doc sections
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function DocumentSectionPreview({
  stepNumber,
  step,
}: {
  stepNumber: number;
  step: BuilderStep;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-950/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Platform map preview
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
          Section {stepNumber}
        </span>
      </div>
      <CompactMapGroup title="Required Inputs" items={step.requiredInputs} />
      <div>
        <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Document Subsections
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {step.documentSections.map((section, index) => (
            <div
              key={section}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5"
            >
              <span className="shrink-0 text-[10px] font-black text-sky-300">
                {stepNumber}.{index + 1}
              </span>
              <span className="text-xs font-semibold leading-4 text-slate-200">
                {section}
              </span>
            </div>
          ))}
        </div>
      </div>
      <CompactMapGroup title="Generated Outputs" items={step.generatedOutputs} />
      <div>
        <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Applicable References
        </div>
        <div className="flex flex-wrap gap-1">
          {step.referenceIds.map((referenceId) => (
            <span
              key={referenceId}
              className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-200"
            >
              {referenceId}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactMapGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold leading-4 text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BuilderSidePanel({
  steps,
  activeStep,
  onSelectStep,
  readyCount,
  readinessItems,
  checklistLoading,
  checklistError,
  checklistEvaluation,
  onRefreshChecklist,
  children,
}: {
  steps: BuilderStep[];
  activeStep: number;
  onSelectStep: (step: number) => void;
  readyCount: number;
  readinessItems: Array<{ label: string; done: boolean }>;
  checklistLoading: boolean;
  checklistError: string;
  checklistEvaluation: ChecklistEvaluationResponse | null;
  onRefreshChecklist: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <aside className="space-y-3 xl:sticky xl:top-4 xl:h-max">
      <CompactPanel title="Plan Snapshot" description={`${readyCount}/20 readiness points`}>
        {children}
      </CompactPanel>

      <CompactPanel title="Document TOC Preview" description="Sections that will appear in the plan">
        <div className="space-y-2">
          {steps.map((step, stepIndex) => (
            <button
              key={step.title}
              type="button"
              onClick={() => onSelectStep(stepIndex)}
              className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                activeStep === stepIndex
                  ? "border-sky-500/35 bg-sky-950/35"
                  : "border-slate-700/70 bg-slate-950/45 hover:bg-slate-900/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-100">
                  {stepIndex + 1}. {step.title}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {step.documentSections.length} sections
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {step.documentSections.slice(0, 3).map((section, index) => (
                  <span
                    key={section}
                    className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
                  >
                    {stepIndex + 1}.{index + 1} {section}
                  </span>
                ))}
                {step.documentSections.length > 3 ? (
                  <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    +{step.documentSections.length - 3}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-500">
                {step.requiredInputs.length} inputs / {step.generatedOutputs.length} outputs / {step.referenceIds.join(", ")}
              </div>
            </button>
          ))}
        </div>
      </CompactPanel>

      <CompactPanel title="Readiness" description="Admin handoff checks">
        <div className="space-y-1.5">
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/45 px-2.5 py-2"
            >
              <StatusBadge label={item.done ? "Ready" : "Open"} tone={item.done ? "success" : "warning"} />
              <div className="text-xs leading-4 text-slate-300">{item.label}</div>
            </div>
          ))}
        </div>
      </CompactPanel>

      <div className="[&_*]:text-sm [&_h2]:text-base">
        <ChecklistCoveragePanel
          title={`Checklist Coverage (${SITE_SAFETY_BLUEPRINT_TITLE})`}
          loading={checklistLoading}
          error={checklistError}
          data={checklistEvaluation}
          onRefresh={() => {
            void onRefreshChecklist();
          }}
        />
      </div>
    </aside>
  );
}

function CompactField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="app-dark-input h-10 text-sm font-medium" />
    </label>
  );
}

function CompactTextArea({
  label,
  value,
  onChange,
  onAiDraft,
  aiLoading = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onAiDraft?: () => void;
  aiLoading?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
        {onAiDraft ? (
          <button
            type="button"
            onClick={onAiDraft}
            disabled={aiLoading}
            className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200 transition hover:bg-sky-500/15 disabled:opacity-50"
          >
            {aiLoading ? "Drafting..." : "Smart Draft"}
          </button>
        ) : null}
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="app-dark-input text-sm font-medium leading-5" />
    </label>
  );
}

function CompactToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-2">
      <div className="text-xs font-semibold leading-4 text-slate-100">{label}</div>
      <button type="button" onClick={() => onChange(!value)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition sm:min-w-[64px] ${value ? "border-sky-600 bg-sky-600 text-white" : "border-slate-600 bg-slate-900/90 text-slate-300 hover:bg-slate-950/50"}`}>
        {value ? "Yes" : "No"}
      </button>
    </div>
  );
}

function CompactSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="app-dark-input h-10 text-sm font-medium">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompactSelectionList({
  values,
  options,
  onToggle,
}: {
  values: string[];
  options: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div className="grid gap-1.5 md:grid-cols-2">
      {options.map((option) => {
        const checked = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${checked ? "border-sky-500/35 bg-sky-950/35 text-white" : "border-slate-700/70 bg-slate-900/80 text-slate-300 hover:bg-slate-950/50"}`}
          >
            <div className="text-xs font-semibold leading-4">{option}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${checked ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-500"}`}>
              {checked ? "On" : "Add"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-slate-950/45 px-2.5 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="truncate text-right text-xs font-semibold text-slate-100">{value}</span>
    </div>
  );
}

const Field = CompactField;
const TextArea = CompactTextArea;
const Toggle = CompactToggle;
const Select = CompactSelect;
const SelectionGrid = CompactSelectionList;
