"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StartChecklist,
  StatusBadge,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import {
  CSEP_BUILDER_BLOCK_LABELS,
  CSEP_BUILDER_BLOCK_OPTIONS,
  CSEP_FORMAT_SECTION_OPTIONS,
  buildLegacyIncludedSectionLabelsFromFormatSections,
  buildCsepBuilderAiPrompt,
  hasBlockingCsepCoverageAudit,
  getCsepBuilderAiSectionConfig,
  resolveIncludedSectionLabelsForAiSection,
  parseCsepAiTextResponse,
  parseCsepWeatherSectionAiResponse,
  type CsepBuilderAiSectionId,
} from "@/lib/csepBuilder";
import {
  buildCsepProgramSelections,
  getSubtypeConfig,
  listProgramTitles,
} from "@/lib/csepPrograms";
import {
  deriveEligibleCsepPricedItems,
  formatCsepPrice,
  resolveSelectedCsepPricedItems,
} from "@/lib/csepEnrichmentPricing";
import { buildCsepTradeSelection, getCsepTradeOptions } from "@/lib/csepTradeSelection";
import { getJurisdictionStateOptions, resolveBuilderJurisdiction } from "@/lib/jurisdictionStandards/catalog";
import {
  CSEP_REGULATORY_REFERENCE_INDEX,
  mapOshaRefStringsToSortedRCodes,
} from "@/lib/csepRegulatoryReferenceIndex";
import type { PermissionMap } from "@/lib/rbac";
import {
  CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL,
  CONTRACTOR_SAFETY_BLUEPRINT_TITLE,
} from "@/lib/safetyBlueprintLabels";
import { OWNER_MESSAGE_PRESETS, getOwnerMessagePreset } from "@/lib/ownerMessagePresets";
import type { ChecklistEvaluationResponse } from "@/lib/compliance/evaluation";
import {
  useCompanyWorkspaceData,
  type CompanyJobsite,
} from "@/components/company-workspace/useCompanyWorkspaceData";
import type { CsepFormatSectionKey, CsepWeatherSectionInput } from "@/types/csep-builder";
import type { CSEPPricedItemCatalogEntry } from "@/types/csep-priced-items";
import type { CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue } from "@/types/csep-programs";
import type { GeneratedSafetyPlanDraft } from "@/types/safety-intelligence";

type CSEPForm = {
  jobsite_id: string;
  project_name: string;
  project_number: string;
  project_address: string;
  governing_state: string;
  project_delivery_type: string;
  owner_client: string;
  owner_message_text: string;
  /** One string per GC / CM / program partner or interface role. */
  gc_cm: string[];
  contractor_company: string;
  contractor_contact: string;
  contractor_phone: string;
  contractor_email: string;
  trade: string;
  subTrade: string;
  tasks: string[];
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;
  weather_requirements: CsepWeatherSectionInput;
  required_ppe: string[];
  additional_permits: string[];
  priced_attachment_keys: string[];
  selected_hazards: string[];
  program_subtype_selections: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
  selected_format_sections: CsepFormatSectionKey[];
  included_sections: string[];
  document_number: string;
  document_revision: string;
  issue_date: string;
  prepared_by: string;
  reviewed_by: string;
  approved_by: string;
  roles_and_responsibilities_text: string;
  security_and_access_text: string;
  health_and_wellness_text: string;
  incident_reporting_and_investigation_text: string;
  training_and_instruction_text: string;
  drug_and_alcohol_testing_text: string;
  enforcement_and_corrective_action_text: string;
  recordkeeping_text: string;
  continuous_improvement_text: string;
};

type MultiSelectField =
  | "required_ppe"
  | "additional_permits"
  | "priced_attachment_keys"
  | "selected_hazards"
  | "tasks";

type OptionGridItem = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
};

type CsepPreviewState = {
  generatedDocumentId: string;
  builderInputHash: string;
  draft: GeneratedSafetyPlanDraft;
  payloadSignature: string;
};

type BuilderAiMessageTone = "success" | "warning" | "error";

type BuilderAiSectionState = {
  loading: boolean;
  message: string;
  tone: BuilderAiMessageTone;
};

const supabase = getSupabaseBrowserClient();

const tradeOptions = getCsepTradeOptions();
const jurisdictionStateOptions = getJurisdictionStateOptions();
const projectDeliveryOptions = [
  { value: "ground_up", label: "Ground-Up New Build" },
  { value: "renovation", label: "Building Refurbishment / Renovation" },
];
const ppeOptions = [
  "Hard Hat",
  "Safety Glasses",
  "High Visibility Vest",
  "Gloves",
  "Steel Toe Boots",
  "Hearing Protection",
  "Face Shield",
  "Respiratory Protection",
  "Fall Protection Harness",
];
const permitOptions = [
  "Hot Work Permit",
  "Confined Space Permit",
  "LOTO Permit",
  "Ladder Permit",
  "AWP/MEWP Permit",
  "Ground Disturbance Permit",
  "Trench Inspection Permit",
  "Chemical Permit",
  "Motion Permit",
  "Temperature Permit",
  "Gravity Permit",
];
const legacyCsepSectionLabels = CSEP_BUILDER_BLOCK_OPTIONS.map((option) => option.label);
const csepFormatSectionOptionItems: OptionGridItem[] = CSEP_FORMAT_SECTION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.description,
}));
const workflowDefinition = [
  {
    title: "Trade selection",
    detail: "Choose the live trade path this CSEP will follow.",
  },
  {
    title: "Sub-trade",
    detail: "Lock the builder to the active sub-trade before tasks are picked.",
  },
  {
    title: "Select sections",
    detail: "Choose which 19-section CSEP package sections belong in the final format.",
  },
  {
    title: "Selectable tasks",
    detail: "Pick the exact work tasks that drive hazards and controls.",
  },
  {
    title: "Intelligence enrichment",
    detail: "Review hazards, PPE, permits, pricing, OSHA references, and program outputs tied to the selected tasks.",
  },
  {
    title: "Task-driven sections",
    detail: "Complete project details and the task-driven sections that unlock after tasks are selected.",
  },
  {
    title: "Draft review",
    detail: "Generate the live draft, review the selected sections, and approve the current version.",
  },
  {
    title: "Submit document",
    detail: "Accept the terms and submit the approved CSEP into review.",
  },
];

const TASK_DRIVEN_SECTION_LABELS = new Set([
  "Scope Summary",
  "Scope of Work",
  "Project-Specific Safety Notes",
  "Site Specific Notes",
  "Emergency Procedures",
  "Weather Requirements and Severe Weather Response",
  "Roles and Responsibilities",
  "Security and Access",
  "Health and Wellness",
  "Incident Reporting and Investigation",
  "Training and Instruction",
  CSEP_BUILDER_BLOCK_LABELS.drug_and_alcohol_testing,
  "Drug and Alcohol Testing",
  "Enforcement and Corrective Action",
  "Recordkeeping",
  "Continuous Improvement",
]);

function formIncludesDrugAlcoholSection(includedSections: readonly string[]) {
  return (
    includedSections.includes(CSEP_BUILDER_BLOCK_LABELS.drug_and_alcohol_testing) ||
    includedSections.includes("Drug and Alcohol Testing")
  );
}

const ENRICHMENT_DRIVEN_SECTION_LABELS = new Set([
  "Required PPE",
  "Additional Permits",
  "Common Overlapping Trades",
  "OSHA References",
  "Selected Hazards",
  "Activity / Hazard Matrix",
]);

const initialForm: CSEPForm = {
  jobsite_id: "",
  project_name: "",
  project_number: "",
  project_address: "",
  governing_state: "",
  project_delivery_type: "",
  owner_client: "",
  owner_message_text: "",
  gc_cm: [""],
  contractor_company: "",
  contractor_contact: "",
  contractor_phone: "",
  contractor_email: "",
  trade: "",
  subTrade: "",
  tasks: [],
  scope_of_work: "",
  site_specific_notes: "",
  emergency_procedures: "",
  weather_requirements: {},
  required_ppe: [],
  additional_permits: [],
  priced_attachment_keys: [],
  selected_hazards: [],
  program_subtype_selections: {},
  selected_format_sections: CSEP_FORMAT_SECTION_OPTIONS.map((option) => option.value),
  included_sections: [...legacyCsepSectionLabels],
  document_number: "",
  document_revision: "1.0",
  issue_date: "",
  prepared_by: "",
  reviewed_by: "",
  approved_by: "",
  roles_and_responsibilities_text: "",
  security_and_access_text: "",
  health_and_wellness_text: "",
  incident_reporting_and_investigation_text: "",
  training_and_instruction_text: "",
  drug_and_alcohol_testing_text: "",
  enforcement_and_corrective_action_text: "",
  recordkeeping_text: "",
  continuous_improvement_text: "",
};

const OFFLINE_DEMO_EMAIL = "demo.20260425@safety360docs.local";
const OFFLINE_DEMO_CSEP_PREFILL: Partial<CSEPForm> = {
  jobsite_id: "demo-jobsite-1",
  project_name: "North Tower",
  project_number: "SR-1042",
  project_address: "4100 Industrial Way, Austin, TX 78701",
  governing_state: "TX",
  project_delivery_type: "ground_up",
  owner_client: "Summit Ridge Constructors",
  owner_message_text:
    "Demo-only project data. All names, contacts, operations, and controls are fictional for visual walkthrough.",
  gc_cm: ["Summit Ridge Constructors"],
  contractor_company: "Summit Ridge Field Services",
  contractor_contact: "Jordan Lee",
  contractor_phone: "555-0140",
  contractor_email: "demo@safety360docs.com",
  trade: "Structural Steel and Erection",
  subTrade: "Steel Erection and Decking",
  tasks: ["Hoisting and Rigging", "Steel Erection", "Welding and Cutting", "Work at Heights"],
  scope_of_work:
    "Install structural steel and decking, execute hot-work welding, and coordinate crane picks in an active multi-trade zone.",
  site_specific_notes:
    "Demo site rules: maintain exclusion zones under suspended loads, enforce controlled access near leading edges, and require pre-task lift briefings.",
  emergency_procedures:
    "Stop work, notify supervision via radio channel 1, call 911 for life-threatening events, and report all incidents in SafetyDocs360 before shift closeout.",
  required_ppe: ["Hard Hat", "Safety Glasses", "High Visibility Vest", "Gloves", "Steel Toe Boots", "Fall Protection Harness"],
  additional_permits: ["Hot Work Permit", "AWP/MEWP Permit", "LOTO Permit"],
  selected_hazards: ["Falls", "Struck-by", "Caught-in/between", "Electrical"],
  document_number: "CSEP-DEMO-20260425",
  document_revision: "1.0",
  prepared_by: "Jordan Lee",
  reviewed_by: "Maria Chen",
  approved_by: "Avery Patel",
  roles_and_responsibilities_text:
    "Foremen verify controls before each task; all crew members retain stop-work authority; competent persons release work restart after corrective actions.",
  security_and_access_text:
    "Controlled access zones established for hoisting and leading-edge work. Only authorized crew may enter active steel erection areas.",
  health_and_wellness_text:
    "Hydration breaks every two hours in hot conditions, fatigue checks before night work, and respiratory protection readiness for welding fume exposure.",
  incident_reporting_and_investigation_text:
    "Near misses and incidents are logged in-platform immediately. Supervisor-led investigation begins same shift with corrective action ownership assigned.",
  training_and_instruction_text:
    "Daily toolbox briefings cover crane picks, fall controls, hot-work fire watch, and emergency escalation paths.",
  drug_and_alcohol_testing_text:
    "Reasonable-cause and post-incident testing applies per site policy and applicable labor agreements.",
  enforcement_and_corrective_action_text:
    "Unsafe acts trigger immediate stop-work and documented corrective actions. Repeat violations escalate to removal from task assignment.",
  recordkeeping_text:
    "Permits, inspections, orientation records, and corrective actions are retained in SafetyDocs360 for audit and handoff.",
  continuous_improvement_text:
    "Weekly leadership review analyzes recurring hazards and updates task controls for the next work cycle.",
};

const csepDerivedRequestPayloadKeys = [
  "tradeItems",
  "derivedHazards",
  "derivedPermits",
  "overlapPermitHints",
  "priced_attachments",
  "common_overlapping_trades",
  "programSelections",
  "tradeSummary",
  "oshaRefs",
] as const;

function buildCompactCsepRequestFormData(
  formData: Record<string, unknown>,
  options: { includeLogo?: boolean } = {}
) {
  const compact = { ...formData };

  csepDerivedRequestPayloadKeys.forEach((key) => {
    delete compact[key];
  });

  if (!options.includeLogo) {
    delete compact.company_logo_data_url;
    delete compact.company_logo_file_name;
  }

  return compact;
}

function buildOfflineDemoJobsiteScenario(jobsite: CompanyJobsite | undefined): Partial<CSEPForm> {
  const name = (jobsite?.name ?? "").toLowerCase();

  if (name.includes("warehouse")) {
    return {
      project_name: jobsite?.name || "Warehouse Retrofit",
      project_number: jobsite?.projectNumber || "SR-2210",
      project_address: jobsite?.location || "Round Rock, TX",
      trade: "Electrical and Instrumentation",
      subTrade: "Panel and distribution systems",
      tasks: ["Electrical Work", "Energized Work Boundaries", "LOTO Activities", "Work at Heights"],
      selected_hazards: ["Electrical", "Arc flash", "Falls", "Struck-by"],
      additional_permits: ["LOTO Permit", "AWP/MEWP Permit", "Hot Work Permit"],
      scope_of_work:
        "Retrofit and replace electrical distribution panels with lockout verification and phased energization controls.",
      site_specific_notes:
        "Night shift work windows with controlled access around energized rooms and dedicated boundary spotters.",
      emergency_procedures:
        "Immediate de-energization where possible, isolate exposure area, call emergency services, and escalate through site incident chain.",
      document_number: "CSEP-DEMO-WH-20260425",
    };
  }

  if (name.includes("clinic")) {
    return {
      project_name: jobsite?.name || "South Clinic Buildout",
      project_number: jobsite?.projectNumber || "SR-3097",
      project_address: jobsite?.location || "San Marcos, TX",
      trade: "General Construction",
      subTrade: "Interior buildout and fit-off",
      tasks: ["Material Handling", "Ladder Work", "Housekeeping", "Site Access Control"],
      selected_hazards: ["Slips, trips, and falls", "Struck-by", "Ergonomic strain"],
      additional_permits: ["Ladder Permit", "Motion Permit"],
      required_ppe: ["Hard Hat", "Safety Glasses", "High Visibility Vest", "Gloves", "Steel Toe Boots"],
      scope_of_work:
        "Interior fit-out, material movement, and phased coordination with adjacent active healthcare areas.",
      site_specific_notes:
        "Maintain sterile boundary protections, preserve clear egress lanes, and coordinate deliveries with owner schedule windows.",
      emergency_procedures:
        "Stop work on any patient-area impact, notify supervisor and facility contact, then follow emergency escalation matrix.",
      document_number: "CSEP-DEMO-CL-20260425",
    };
  }

  return {
    project_name: jobsite?.name || OFFLINE_DEMO_CSEP_PREFILL.project_name || "North Tower",
    project_number: jobsite?.projectNumber || OFFLINE_DEMO_CSEP_PREFILL.project_number || "SR-1042",
    project_address: jobsite?.location || OFFLINE_DEMO_CSEP_PREFILL.project_address || "Austin, TX",
    trade: "Structural Steel and Erection",
    subTrade: "Steel Erection and Decking",
    tasks: ["Hoisting and Rigging", "Steel Erection", "Welding and Cutting", "Work at Heights"],
    selected_hazards: ["Falls", "Struck-by", "Caught-in/between", "Electrical"],
    additional_permits: ["Hot Work Permit", "AWP/MEWP Permit", "LOTO Permit"],
    scope_of_work:
      "Install structural steel and decking, execute hot-work welding, and coordinate crane picks in an active multi-trade zone.",
    site_specific_notes:
      "Demo site rules: maintain exclusion zones under suspended loads, enforce controlled access near leading edges, and require pre-task lift briefings.",
    emergency_procedures:
      "Stop work, notify supervision via radio channel 1, call 911 for life-threatening events, and report all incidents in SafetyDocs360 before shift closeout.",
    document_number: "CSEP-DEMO-20260425",
  };
}

function withOfflineDemoPrefill(form: CSEPForm): CSEPForm {
  return {
    ...form,
    ...OFFLINE_DEMO_CSEP_PREFILL,
    weather_requirements: {
      ...form.weather_requirements,
      monitoringSources: ["NOAA weather radar", "Site anemometer checks each shift"],
      dailyReviewNotes:
        "Pause crane picks for lightning alerts or sustained winds above manufacturer/site limits.",
      heatControls: [
        "Water, shade, and rest schedule with supervisor verification during elevated heat index windows.",
      ],
    },
    selected_format_sections:
      OFFLINE_DEMO_CSEP_PREFILL.selected_format_sections ?? form.selected_format_sections,
    included_sections: OFFLINE_DEMO_CSEP_PREFILL.included_sections ?? form.included_sections,
  };
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toOptionGridItems(items: string[]): OptionGridItem[] {
  return items.map((item) => ({
    value: item,
    label: item,
  }));
}

function parseCommaSeparatedList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildJobsiteSelectLabel(jobsite: CompanyJobsite) {
  return [jobsite.name, jobsite.projectNumber, jobsite.location].filter(Boolean).join(" | ");
}

export default function CSEPPage() {
  const { jobsites, loading: jobsitesLoading } = useCompanyWorkspaceData();
  const [form, setForm] = useState<CSEPForm>(initialForm);
  const [step, setStep] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [previewState, setPreviewState] = useState<CsepPreviewState | null>(null);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [companyLogoPreviewUrl, setCompanyLogoPreviewUrl] = useState<string | null>(null);
  const [companyLogoFileName, setCompanyLogoFileName] = useState<string | null>(null);
  const [ownerMessagePresetId, setOwnerMessagePresetId] = useState("");
  const [agreedToSubmissionTerms, setAgreedToSubmissionTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [sectionAiState, setSectionAiState] = useState<
    Partial<Record<CsepBuilderAiSectionId, BuilderAiSectionState>>
  >({});
  const [checklistEvaluation, setChecklistEvaluation] = useState<ChecklistEvaluationResponse | null>(
    null
  );
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const [isOfflineDemoPrefillEnabled, setIsOfflineDemoPrefillEnabled] = useState(false);
  const [csepHandoffComplete, setCsepHandoffComplete] = useState(false);
  const [csepHandoffAt, setCsepHandoffAt] = useState<string | null>(null);
  const checklistRequestRef = useRef(0);
  const checklistAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Error loading user:", error.message);
          return;
        }

        if (!user) return;

        setUserId(user.id);
        const userEmail = (user.email ?? "").trim().toLowerCase();
        const isOfflineDemoUser =
          userEmail === OFFLINE_DEMO_EMAIL ||
          process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";
        setIsOfflineDemoPrefillEnabled(isOfflineDemoUser);

        const sessionResult = await supabase.auth.getSession();
        const accessToken = sessionResult.data.session?.access_token;
        if (!accessToken) return;

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

        if (!meResponse.ok) return;

        setPermissionMap(meData?.user?.permissionMap ?? null);

        const companyState = meData?.user?.companyProfile?.state_region?.trim() ?? "";
        if (companyState) {
          setForm((prev) => (prev.governing_state ? prev : { ...prev, governing_state: companyState }));
        }
        if (isOfflineDemoUser) {
          setForm((prev) => withOfflineDemoPrefill(prev));
          setMessage("Offline demo mode: CSEP blocks prefilled with fictional visual data.");
          setMessageTone("success");
        }
      } catch (error) {
        console.error("Unexpected auth error:", error);
      } finally {
        setAuthLoading(false);
      }
    }

    void loadUser();
  }, []);

  const selectedTrade = useMemo(() => {
    if (!form.trade) return null;
    return buildCsepTradeSelection(form.trade, form.subTrade, form.tasks);
  }, [form.subTrade, form.tasks, form.trade]);

  const derivedHazards = useMemo(() => selectedTrade?.derivedHazards ?? [], [selectedTrade]);
  const effectiveSelectedHazards = useMemo(
    () => uniq([...derivedHazards, ...form.selected_hazards]),
    [derivedHazards, form.selected_hazards]
  );
  const derivedPermits = useMemo(() => selectedTrade?.derivedPermits ?? [], [selectedTrade]);
  const overlapPermitHints = useMemo(() => selectedTrade?.overlapPermitHints ?? [], [selectedTrade]);
  const commonOverlappingTrades = useMemo(
    () => selectedTrade?.commonOverlappingTrades ?? [],
    [selectedTrade]
  );
  const displayedTradeItems = useMemo(() => {
    if (!selectedTrade) return [];
    if (effectiveSelectedHazards.length === 0) return selectedTrade.items;
    return selectedTrade.items.filter((item) => effectiveSelectedHazards.includes(item.hazard));
  }, [effectiveSelectedHazards, selectedTrade]);
  const selectedPermitItems = useMemo(
    () => uniq([...form.additional_permits, ...derivedPermits, ...overlapPermitHints]),
    [derivedPermits, form.additional_permits, overlapPermitHints]
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
  const eligiblePricedAttachments = useMemo<CSEPPricedItemCatalogEntry[]>(
    () =>
      deriveEligibleCsepPricedItems({
        trade: selectedTrade?.tradeLabel ?? form.trade,
        subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
        tasks: form.tasks,
        selectedHazards: effectiveSelectedHazards,
        derivedHazards,
        selectedPermits: selectedPermitItems,
      }),
    [
      derivedHazards,
      effectiveSelectedHazards,
      form.subTrade,
      form.tasks,
      form.trade,
      selectedPermitItems,
      selectedTrade?.subTradeLabel,
      selectedTrade?.tradeLabel,
    ]
  );
  const selectedPricedAttachments = useMemo(
    () =>
      resolveSelectedCsepPricedItems({
        selectedKeys: form.priced_attachment_keys,
        eligibleItems: eligiblePricedAttachments,
      }),
    [eligiblePricedAttachments, form.priced_attachment_keys]
  );
  const pricedAttachmentOptions = useMemo<OptionGridItem[]>(
    () =>
      eligiblePricedAttachments.map((item) => ({
        value: item.key,
        label: item.label,
        description:
          item.category === "permit" ? "Permit pricing" : "Trade-linked add-on pricing",
        badge: formatCsepPrice(item.price),
      })),
    [eligiblePricedAttachments]
  );
  const selectedPricedAttachmentTotal = useMemo(
    () => selectedPricedAttachments.reduce((total, item) => total + item.price, 0),
    [selectedPricedAttachments]
  );
  const eligiblePricedAttachmentTotal = useMemo(
    () => eligiblePricedAttachments.reduce((total, item) => total + item.price, 0),
    [eligiblePricedAttachments]
  );
  const programSelectionState = useMemo(
    () =>
      buildCsepProgramSelections({
        selectedHazards: effectiveSelectedHazards,
        selectedPermits: selectedPermitItems,
        selectedPpe: form.required_ppe,
        tradeItems: displayedTradeItems,
        selectedTasks: form.tasks,
        subtypeSelections: form.program_subtype_selections,
      }),
    [
      displayedTradeItems,
      effectiveSelectedHazards,
      form.program_subtype_selections,
      form.required_ppe,
      form.tasks,
      selectedPermitItems,
    ]
  );
  const autoPrograms = useMemo(() => listProgramTitles(programSelectionState.selections), [programSelectionState.selections]);
  const missingProgramSubtypeGroups = useMemo(
    () => programSelectionState.missingSubtypeGroups,
    [programSelectionState.missingSubtypeGroups]
  );

  useEffect(() => {
    const eligibleKeys = new Set(eligiblePricedAttachments.map((item) => item.key));

    setForm((prev) => {
      const nextKeys = prev.priced_attachment_keys.filter((key) => eligibleKeys.has(key));
      return nextKeys.length === prev.priced_attachment_keys.length
        ? prev
        : { ...prev, priced_attachment_keys: nextKeys };
    });
  }, [eligiblePricedAttachments]);

  const jurisdictionProfile = useMemo(
    () => resolveBuilderJurisdiction({ governingState: form.governing_state }),
    [form.governing_state]
  );

  const canUseBuilder = Boolean(permissionMap?.can_create_documents && permissionMap?.can_edit_documents);
  const canSubmitDocuments = Boolean(permissionMap?.can_submit_documents);

  const checklistFormData = useMemo(
    () => ({
      ...form,
      governing_state: form.governing_state,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tradeItems: displayedTradeItems,
      selected_hazards: effectiveSelectedHazards,
      additional_permits: selectedPermitItems,
      required_ppe: form.required_ppe,
      overlapPermitHints,
      common_overlapping_trades: commonOverlappingTrades,
    }),
    [
      commonOverlappingTrades,
      displayedTradeItems,
      effectiveSelectedHazards,
      form,
      overlapPermitHints,
      selectedPermitItems,
      selectedTrade?.subTradeLabel,
      selectedTrade?.tradeLabel,
    ]
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
          surface: "csep",
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

  const csepReady =
    Boolean(form.trade.trim()) &&
    Boolean(form.project_delivery_type) &&
    Boolean(form.subTrade.trim()) &&
    form.tasks.length > 0 &&
    effectiveSelectedHazards.length > 0 &&
    missingProgramSubtypeGroups.length === 0;
  const taskDrivenStepNumber = workflowDefinition.findIndex((item) => item.title === "Task-driven sections") + 1;
  const reviewStepNumber = workflowDefinition.findIndex((item) => item.title === "Draft review") + 1;

  const selectedSectionStatuses = useMemo(
    () =>
      csepFormatSectionOptionItems.map((section) => {
        const included = form.selected_format_sections.includes(section.value as CsepFormatSectionKey);
        const label = section.label;
        const dependency = TASK_DRIVEN_SECTION_LABELS.has(label)
          ? "Requires tasks"
          : ENRICHMENT_DRIVEN_SECTION_LABELS.has(label)
            ? "Requires hazards/program setup"
            : "Ready now";

        return { ...section, included, dependency };
      }),
    [form.selected_format_sections]
  );

  const unlockedTaskDrivenSections = selectedSectionStatuses.filter(
    (section) => section.included && section.dependency !== "Requires hazards/program setup"
  );

  const submissionFormData = useMemo(
    () => ({
      ...form,
      selected_hazards: effectiveSelectedHazards,
      gc_cm: form.gc_cm.map((line) => line.trim()).filter(Boolean),
      company_logo_data_url: companyLogoPreviewUrl,
      company_logo_file_name: companyLogoFileName,
      governing_state: form.governing_state,
      jurisdiction_code: jurisdictionProfile.jurisdictionCode,
      jurisdiction_plan_type: jurisdictionProfile.jurisdictionPlanType,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tradeSummary: selectedTrade?.summary ?? "",
      oshaRefs: selectedTrade?.oshaRefs ?? [],
      tasks: [...form.tasks],
      tradeItems: displayedTradeItems,
      derivedHazards,
      derivedPermits,
      overlapPermitHints,
      priced_attachment_keys: [...form.priced_attachment_keys],
      priced_attachments: selectedPricedAttachments,
      common_overlapping_trades: commonOverlappingTrades,
      selected_format_sections: form.selected_format_sections,
      programSelections: programSelectionState.selections,
      program_subtype_selections: form.program_subtype_selections,
      weather_requirements: form.weather_requirements,
      document_number: form.document_number,
      document_revision: form.document_revision,
      issue_date: form.issue_date,
      prepared_by: form.prepared_by,
      reviewed_by: form.reviewed_by,
      approved_by: form.approved_by,
      owner_message_text: form.owner_message_text,
      roles_and_responsibilities_text: form.roles_and_responsibilities_text,
      security_and_access_text: form.security_and_access_text,
      health_and_wellness_text: form.health_and_wellness_text,
      incident_reporting_and_investigation_text: form.incident_reporting_and_investigation_text,
      training_and_instruction_text: form.training_and_instruction_text,
      drug_and_alcohol_testing_text: form.drug_and_alcohol_testing_text,
      enforcement_and_corrective_action_text: form.enforcement_and_corrective_action_text,
      recordkeeping_text: form.recordkeeping_text,
      continuous_improvement_text: form.continuous_improvement_text,
      includedContent: {
        project_information: form.included_sections.includes("Project Information"),
        contractor_information: form.included_sections.includes("Contractor Information"),
        trade_summary: form.included_sections.includes("Trade Summary"),
        scope_of_work:
          form.included_sections.includes("Scope Summary") ||
          form.included_sections.includes("Scope of Work"),
        site_specific_notes:
          form.included_sections.includes("Project-Specific Safety Notes") ||
          form.included_sections.includes("Site Specific Notes"),
        emergency_procedures: form.included_sections.includes("Emergency Procedures"),
        weather_requirements_and_severe_weather_response: form.included_sections.includes(
          "Weather Requirements and Severe Weather Response"
        ),
        required_ppe: form.included_sections.includes("Required PPE"),
        additional_permits: form.included_sections.includes("Additional Permits"),
        common_overlapping_trades: form.included_sections.includes("Common Overlapping Trades"),
        osha_references: form.included_sections.includes("OSHA References"),
        selected_hazards: form.included_sections.includes("Selected Hazards"),
        activity_hazard_matrix: form.included_sections.includes("Activity / Hazard Matrix"),
        roles_and_responsibilities: form.included_sections.includes("Roles and Responsibilities"),
        security_and_access: form.included_sections.includes("Security and Access"),
        health_and_wellness: form.included_sections.includes("Health and Wellness"),
        incident_reporting_and_investigation: form.included_sections.includes(
          "Incident Reporting and Investigation"
        ),
        training_and_instruction: form.included_sections.includes("Training and Instruction"),
        drug_and_alcohol_testing: formIncludesDrugAlcoholSection(form.included_sections),
        enforcement_and_corrective_action: form.included_sections.includes(
          "Enforcement and Corrective Action"
        ),
        recordkeeping: form.included_sections.includes("Recordkeeping"),
        continuous_improvement: form.included_sections.includes("Continuous Improvement"),
      },
    }),
    [
      commonOverlappingTrades,
      companyLogoFileName,
      companyLogoPreviewUrl,
      derivedHazards,
      derivedPermits,
      displayedTradeItems,
      effectiveSelectedHazards,
      form,
      jurisdictionProfile.jurisdictionCode,
      jurisdictionProfile.jurisdictionPlanType,
      overlapPermitHints,
      selectedPricedAttachments,
      programSelectionState.selections,
      selectedTrade?.oshaRefs,
      selectedTrade?.subTradeLabel,
      selectedTrade?.summary,
      selectedTrade?.tradeLabel,
    ]
  );

  const payloadSignature = useMemo(() => JSON.stringify(submissionFormData), [submissionFormData]);
  const previewIsCurrent = previewState?.payloadSignature === payloadSignature;
  const previewHasBlockingCoverageGaps = hasBlockingCsepCoverageAudit(
    previewState?.draft.coverageAudit
  );
  const previewReadyForSubmit = Boolean(
    previewState && previewIsCurrent && previewApproved && !previewHasBlockingCoverageGaps
  );
  const nextRequiredInput = !form.trade.trim()
    ? "Choose a trade to start the live CSEP path."
    : !form.project_delivery_type
      ? "Set the project delivery type to complete the trade setup step."
      : !form.subTrade.trim()
        ? "Choose the active sub-trade so the task list can load."
        : form.selected_format_sections.length === 0
          ? "Select at least one CSEP section for the final document layout."
          : form.tasks.length === 0
            ? `Pick at least one task to unlock task-driven sections in Step ${taskDrivenStepNumber}.`
            : effectiveSelectedHazards.length === 0
              ? "Review hazards in intelligence enrichment so the draft can include the right matrix and controls."
              : missingProgramSubtypeGroups.length > 0
                ? "Finish the required program classifications in intelligence enrichment."
                : !previewState
                  ? `Generate the draft in Step ${reviewStepNumber}.`
                  : !previewIsCurrent
                    ? `Inputs changed after the last draft. Regenerate and approve the current draft in Step ${reviewStepNumber}.`
                    : !previewApproved
                      ? `Approve the current draft in Step ${reviewStepNumber}.`
                      : !agreedToSubmissionTerms
                        ? "Accept the legal terms before submitting the document."
                        : "The builder is ready for submission.";
  const csepAiBaseContext = useMemo(
    () => ({
      surface: "csep_builder",
      currentStep: workflowDefinition[step]?.title ?? null,
      project_name: form.project_name,
      project_number: form.project_number,
      project_address: form.project_address,
      governing_state: form.governing_state,
      project_delivery_type: form.project_delivery_type,
      owner_client: form.owner_client,
      owner_message_text: form.owner_message_text,
      gc_cm: form.gc_cm,
      contractor_company: form.contractor_company,
      contractor_contact: form.contractor_contact,
      contractor_phone: form.contractor_phone,
      contractor_email: form.contractor_email,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tasks: form.tasks,
      selected_hazards: effectiveSelectedHazards,
      required_ppe: form.required_ppe,
      selected_permits: selectedPermitItems,
      weather_requirements: form.weather_requirements,
      checklistEvaluationSummary: checklistEvaluation?.summary ?? null,
      checklistNeedsUserInput:
        checklistEvaluation?.rows
          .filter((row) => row.coverage === "needs_user_input")
          .slice(0, 10)
          .map((row) => ({
            item: row.item,
            missingFields: row.missingFields,
          })) ?? [],
      ai_task_first_rule:
        "Selected tasks are the primary drafting anchor. Broader trade or project content should only be used when it directly supports those tasks.",
    }),
    [
      checklistEvaluation,
      effectiveSelectedHazards,
      form.contractor_company,
      form.contractor_contact,
      form.contractor_email,
      form.contractor_phone,
      form.gc_cm,
      form.governing_state,
      form.owner_client,
      form.owner_message_text,
      form.project_address,
      form.project_delivery_type,
      form.project_name,
      form.project_number,
      form.required_ppe,
      form.subTrade,
      form.tasks,
      form.trade,
      form.weather_requirements,
      selectedPermitItems,
      selectedTrade?.subTradeLabel,
      selectedTrade?.tradeLabel,
      step,
    ]
  );

  useEffect(() => {
    if (!previewState) return;
    if (previewState.payloadSignature === payloadSignature) return;
    setPreviewApproved(false);
  }, [payloadSignature, previewState]);

  useEffect(() => {
    if (step !== 3) return;
    if (form.tasks.length === 0) return;
    setMessageTone("success");
    setMessage(
      `Tasks selected. Finish intelligence enrichment next, then complete the task-driven sections in Step ${taskDrivenStepNumber}.`
    );
  }, [form.tasks.length, step, taskDrivenStepNumber]);

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

  function updateField<K extends keyof CSEPForm>(field: K, value: CSEPForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateGcCmPartnerLine(index: number, value: string) {
    setForm((prev) => {
      const next = [...prev.gc_cm];
      next[index] = value;
      return { ...prev, gc_cm: next };
    });
  }

  function addGcCmPartnerLine() {
    setForm((prev) => ({ ...prev, gc_cm: [...prev.gc_cm, ""] }));
  }

  function removeGcCmPartnerLine(index: number) {
    setForm((prev) => {
      if (prev.gc_cm.length <= 1) {
        return { ...prev, gc_cm: [""] };
      }
      return { ...prev, gc_cm: prev.gc_cm.filter((_, i) => i !== index) };
    });
  }

  function applyJobsiteToForm(jobsiteId: string) {
    const selectedJobsite = jobsites.find((jobsite) => jobsite.id === jobsiteId);

    setForm((prev) => {
      if (!selectedJobsite) {
        return { ...prev, jobsite_id: "" };
      }

      const scenario = isOfflineDemoPrefillEnabled
        ? buildOfflineDemoJobsiteScenario(selectedJobsite)
        : null;
      return {
        ...prev,
        ...(scenario ?? {}),
        jobsite_id: selectedJobsite.id,
        project_name: selectedJobsite.name,
        project_number: selectedJobsite.projectNumber || prev.project_number,
        project_address: selectedJobsite.location || prev.project_address,
        site_specific_notes: selectedJobsite.notes || prev.site_specific_notes,
        prepared_by: selectedJobsite.projectManager || prev.prepared_by,
        reviewed_by: selectedJobsite.safetyLead || prev.reviewed_by,
      };
    });
  }

  function handleOwnerMessagePresetChange(value: string) {
    setOwnerMessagePresetId(value);
    const preset = getOwnerMessagePreset(value);
    if (preset) {
      updateField("owner_message_text", preset.message);
    }
  }

  function updateWeatherField<K extends keyof CsepWeatherSectionInput>(
    field: K,
    value: CsepWeatherSectionInput[K]
  ) {
    setForm((prev) => ({
      ...prev,
      weather_requirements: {
        ...prev.weather_requirements,
        [field]: value,
      },
    }));
  }

  function setArrayValues(field: MultiSelectField, values: string[]) {
    setForm((prev) => ({ ...prev, [field]: uniq(values) }));
  }

  function toggleArrayValue(field: MultiSelectField, value: string) {
    setForm((prev) => {
      const current = prev[field];
      const exists = current.includes(value);

      return {
        ...prev,
        [field]: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  }

  function applyAllValues(field: MultiSelectField, values: string[]) {
    setArrayValues(field, values);
  }

  function clearAllValues(field: MultiSelectField) {
    setArrayValues(field, []);
  }

  function applySelectedFormatSections(values: CsepFormatSectionKey[]) {
    const nextLegacySections = buildLegacyIncludedSectionLabelsFromFormatSections(values);
    setForm((prev) => ({
      ...prev,
      selected_format_sections: values,
      included_sections: nextLegacySections,
    }));
  }

  function toggleSelectedFormatSection(value: string) {
    setForm((prev) => {
      const key = value as CsepFormatSectionKey;
      const exists = prev.selected_format_sections.includes(key);
      const nextFormatSections = exists
        ? prev.selected_format_sections.filter((item) => item !== key)
        : [...prev.selected_format_sections, key];

      return {
        ...prev,
        selected_format_sections: nextFormatSections,
        included_sections: buildLegacyIncludedSectionLabelsFromFormatSections(nextFormatSections),
      };
    });
  }

  function updateProgramSubtypeSelection(
    group: CSEPProgramSubtypeGroup,
    value: CSEPProgramSubtypeValue | ""
  ) {
    setForm((prev) => ({
      ...prev,
      program_subtype_selections: {
        ...prev.program_subtype_selections,
        [group]: value || undefined,
      },
    }));
  }

  function applyTradeDefaults() {
    if (!selectedTrade) return;

    setForm((prev) => ({
      ...prev,
      required_ppe: uniq([...prev.required_ppe, ...selectedTrade.defaultPPE]),
      additional_permits: uniq([...prev.additional_permits, ...derivedPermits]),
      selected_hazards: uniq([...prev.selected_hazards, ...derivedHazards]),
    }));
  }

  function resetBuilder() {
    setForm(initialForm);
    setStep(0);
    setPreviewState(null);
    setPreviewApproved(false);
    clearCompanyLogo();
    setOwnerMessagePresetId("");
    setAgreedToSubmissionTerms(false);
    setCsepHandoffComplete(false);
    setCsepHandoffAt(null);
    setMessage("");
    setSectionAiState({});
  }

  function setBuilderAiSectionState(
    sectionId: CsepBuilderAiSectionId,
    next: Partial<BuilderAiSectionState>
  ) {
    setSectionAiState((prev) => ({
      ...prev,
      [sectionId]: {
        loading: false,
        message: "",
        tone: "success",
        ...prev[sectionId],
        ...next,
      },
    }));
  }

  function getBuilderAiSectionState(sectionId: CsepBuilderAiSectionId): BuilderAiSectionState {
    return (
      sectionAiState[sectionId] ?? {
        loading: false,
        message: "",
        tone: "success",
      }
    );
  }

  function canUseBuilderAi(sectionId: CsepBuilderAiSectionId) {
    const labels = resolveIncludedSectionLabelsForAiSection(sectionId);
    return (
      canUseBuilder &&
      form.tasks.length > 0 &&
      labels.some((label) => form.included_sections.includes(label))
    );
  }

  function shouldShowBuilderAiAction(sectionId: CsepBuilderAiSectionId) {
    const labels = resolveIncludedSectionLabelsForAiSection(sectionId);
    return labels.some((label) => form.included_sections.includes(label));
  }

  function renderBuilderAiAction(sectionId: CsepBuilderAiSectionId, idleLabel?: string) {
    const config = getCsepBuilderAiSectionConfig(sectionId);
    const aiState = getBuilderAiSectionState(sectionId);
    const aiEnabled = canUseBuilderAi(sectionId);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleAiFillSection(sectionId)}
            disabled={aiState.loading || !aiEnabled}
            className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-50"
          >
            {aiState.loading
              ? `Drafting ${config.title.toLowerCase()}...`
              : idleLabel ?? `Smart draft ${config.title.toLowerCase()}`}
          </button>
          {!form.tasks.length ? (
            <span className="text-xs text-[var(--app-text)]">
              Select at least one task to unlock smart drafting for this section in Step {taskDrivenStepNumber}.
            </span>
          ) : null}
        </div>
        {aiState.message ? <InlineMessage tone={aiState.tone}>{aiState.message}</InlineMessage> : null}
      </div>
    );
  }

  async function handleAiFillSection(sectionId: CsepBuilderAiSectionId) {
    try {
      const config = getCsepBuilderAiSectionConfig(sectionId);
      setMessage("");
      setBuilderAiSectionState(sectionId, { loading: true, message: "", tone: "success" });

      if (!canUseBuilder) {
        const warningMessage = `Your current role cannot edit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} builder fields.`;
        setMessageTone("warning");
        setMessage(warningMessage);
        setBuilderAiSectionState(sectionId, {
          loading: false,
          message: warningMessage,
          tone: "warning",
        });
        return;
      }

      if (form.tasks.length === 0) {
        const warningMessage = `Select at least one task before using smart drafting in Step ${taskDrivenStepNumber}.`;
        setMessageTone("warning");
        setMessage(warningMessage);
        setBuilderAiSectionState(sectionId, {
          loading: false,
          message: warningMessage,
          tone: "warning",
        });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sign in to use smart drafting.");
      }

      const currentValue =
        config.kind === "weather" ? form.weather_requirements : form[config.fieldKey];
      const prompt = buildCsepBuilderAiPrompt({
        sectionId,
        currentValue,
        context: {
          project_name: form.project_name,
          project_number: form.project_number,
          project_address: form.project_address,
          governing_state: form.governing_state,
          project_delivery_type: form.project_delivery_type,
          owner_client: form.owner_client,
          gc_cm: form.gc_cm,
          contractor_company: form.contractor_company,
          contractor_contact: form.contractor_contact,
          contractor_phone: form.contractor_phone,
          contractor_email: form.contractor_email,
          trade: selectedTrade?.tradeLabel ?? form.trade,
          subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
          tasks: form.tasks,
          selected_hazards: effectiveSelectedHazards,
          required_ppe: form.required_ppe,
          selected_permits: selectedPermitItems,
        },
      });
      const structuredContext = JSON.stringify({
        ...csepAiBaseContext,
        ai_section: {
          id: config.id,
          title: config.title,
          kind: config.kind,
          included_section_label: config.includedSectionLabel,
          current_value: currentValue,
          selected_tasks_are_primary: true,
        },
      });

      const response = await fetch("/api/company/ai/assist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface: "csep",
          message: prompt,
          context: structuredContext,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; text?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Smart drafting failed.");
      }

      if (config.kind === "weather") {
        const parsed = parseCsepWeatherSectionAiResponse(payload?.text ?? "");

        if (!parsed) {
          throw new Error(
            "Smart fill could not read the AI reply as structured weather fields (for example, it may have returned plain paragraphs instead of the required JSON). Click Smart fill again, or type into the fields below."
          );
        }

        if (Object.keys(parsed).length === 0) {
          throw new Error(
            "The AI reply did not include any recognizable weather overlay values. Try Smart fill again or enter the fields manually."
          );
        }

        setForm((prev) => ({
          ...prev,
          weather_requirements: {
            ...prev.weather_requirements,
            ...parsed,
          },
        }));
      } else {
        const parsed = parseCsepAiTextResponse(payload?.text ?? "", config.title);
        if (!parsed) {
          throw new Error(`The smart drafting response did not include usable ${config.title.toLowerCase()} content.`);
        }

        setForm((prev) => ({
          ...prev,
          [config.fieldKey]: parsed,
        }));
      }

      setMessageTone("success");
      setMessage(`Smart drafting updated the ${config.title.toLowerCase()} section.`);
      setBuilderAiSectionState(sectionId, {
        loading: false,
        message: `${config.title} was updated.`,
        tone: "success",
      });
    } catch (error) {
      setMessageTone("error");
      const errorMessage = error instanceof Error ? error.message : "Smart drafting failed.";
      setMessage(errorMessage);
      setBuilderAiSectionState(sectionId, {
        loading: false,
        message: errorMessage,
        tone: "error",
      });
    } finally {
      setSectionAiState((prev) => ({
        ...prev,
        [sectionId]: {
          loading: false,
          message: prev[sectionId]?.message ?? "",
          tone: prev[sectionId]?.tone ?? "success",
        },
      }));
    }
  }

  async function handleGenerateDraft() {
    try {
      setMessage("");

      if (!canUseBuilder) {
        setMessageTone("warning");
        setMessage(`Your current role cannot generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} drafts.`);
        return;
      }

      if (!csepReady) {
        setMessageTone("warning");
        setMessage("Complete the trade, tasks, hazards, and program setup before generating the draft.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      setPreviewLoading(true);
      const previewFormData = buildCompactCsepRequestFormData(submissionFormData);

      const response = await fetch("/api/company/csep/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_name: form.project_name,
          form_data: previewFormData,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            generated_document_id?: string;
            builder_input_hash?: string;
            draft?: GeneratedSafetyPlanDraft;
          }
        | null;

      if (!response.ok) {
        const detail =
          payload?.error ||
          `Failed to generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} smart draft (${response.status}).`;
        if (response.status === 409) {
          console.warn(
            "[CSEP preview] Export validation failed — open the message below in the banner, fix the issue, then regenerate.",
            detail
          );
        } else {
          console.warn("[CSEP preview] Request failed", { status: response.status, detail });
        }
        throw new Error(detail);
      }

      if (!payload?.generated_document_id || !payload.builder_input_hash || !payload.draft) {
        throw new Error("Smart draft response was incomplete. Please try again.");
      }

      setPreviewState({
        generatedDocumentId: payload.generated_document_id,
        builderInputHash: payload.builder_input_hash,
        draft: payload.draft,
        payloadSignature,
      });
      setPreviewApproved(false);
      setMessageTone("success");
      setMessage("Smart draft generated. Review the selected sections, then approve the current version.");
    } catch (error) {
      setPreviewApproved(false);
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : `Failed to generate ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} smart draft.`
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmitForReview() {
    try {
      setMessage("");

      if (!permissionMap?.can_submit_documents) {
        setMessageTone("warning");
        setMessage(`Your current role cannot submit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} records into review.`);
        return;
      }

      if (!userId) {
        setMessageTone("error");
        setMessage("No logged-in user was found. Please log in again.");
        return;
      }

      if (!agreedToSubmissionTerms) {
        setMessageTone("warning");
        setMessage(
          `You must agree to the Terms of Service, Liability Waiver, and Licensing Agreement before submitting your ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}.`
        );
        return;
      }

      if (!previewState || !previewIsCurrent || !previewApproved) {
        setMessageTone("warning");
        setMessage("Generate, review, and approve a current smart draft before submitting this CSEP.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      setSubmitLoading(true);
      const submitFormData = buildCompactCsepRequestFormData(submissionFormData, {
        includeLogo: true,
      });

      const response = await fetch("/api/documents/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: form.project_name,
          generated_document_id: previewState.generatedDocumentId,
          builder_input_hash: previewState.builderInputHash,
          form_data: submitFormData,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Failed to submit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}.`);
      }

      setCsepHandoffComplete(true);
      setCsepHandoffAt(new Date().toISOString());
      setMessageTone("success");
      setMessage(`${CONTRACTOR_SAFETY_BLUEPRINT_TITLE} submitted successfully for admin review.`);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : `Failed to submit ${CONTRACTOR_SAFETY_BLUEPRINT_TITLE}.`);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleOpenDemoPackFolder() {
    try {
      const response = await fetch("/api/offline/demo-pack/open", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Could not open demo pack folder.");
      }
    } catch (error) {
      setMessageTone("warning");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not open demo pack folder."
      );
    }
  }

  const readinessChecklist = [
    { label: "Trade selected", done: Boolean(form.trade.trim()) },
    { label: "Sub-trade selected", done: Boolean(form.subTrade.trim()) },
    { label: "At least one section selected", done: form.selected_format_sections.length > 0 },
    { label: "At least one task selected", done: form.tasks.length > 0 },
    { label: "Hazards selected", done: effectiveSelectedHazards.length > 0 },
    { label: "Program classifications complete", done: missingProgramSubtypeGroups.length === 0 },
    { label: "Task-driven sections unlocked", done: form.tasks.length > 0 && unlockedTaskDrivenSections.length > 0 },
    { label: "Smart draft approved", done: previewReadyForSubmit },
  ];

  const workflowSteps = workflowDefinition.map((item, index) => ({
    label: item.title,
    detail: item.detail,
    active: step === index,
    complete:
      index === 0
        ? Boolean(form.trade.trim()) && Boolean(form.project_delivery_type)
        : index === 1
          ? Boolean(form.subTrade.trim())
          : index === 2
            ? form.selected_format_sections.length > 0
          : index === 3
              ? form.tasks.length > 0
              : index === 4
                ? csepReady
                : index === 5
                  ? Boolean(form.project_name.trim()) &&
                    Boolean(form.contractor_company.trim()) &&
                    unlockedTaskDrivenSections.length > 0
                  : index === 6
                    ? Boolean(previewState && previewIsCurrent && previewApproved)
                    : csepHandoffComplete,
  }));
  const selectedReferenceCodes = mapOshaRefStringsToSortedRCodes(selectedTrade?.oshaRefs ?? []);
  const selectedReferenceRows = (
    selectedReferenceCodes.length
      ? CSEP_REGULATORY_REFERENCE_INDEX.filter((entry) => selectedReferenceCodes.includes(entry.code))
      : CSEP_REGULATORY_REFERENCE_INDEX
  ).slice(0, selectedReferenceCodes.length ? undefined : 6);
  const completedStepCount = workflowSteps.filter((item) => item.complete).length;
  const progressPercent = Math.round((completedStepCount / workflowDefinition.length) * 100);

  function canProceed(currentStep: number) {
    if (currentStep === 0) return Boolean(form.trade.trim()) && Boolean(form.project_delivery_type);
    if (currentStep === 1) return Boolean(form.subTrade.trim());
    if (currentStep === 2) return form.selected_format_sections.length > 0;
    if (currentStep === 3) return form.tasks.length > 0;
    if (currentStep === 4) return csepReady;
    if (currentStep === 5) return Boolean(form.project_name.trim()) && Boolean(form.contractor_company.trim());
    if (currentStep === 6) return Boolean(previewState && previewIsCurrent && previewApproved);
    return true;
  }

  /** Highest step index reachable via sequential gates (same as repeated "Next step"). Used so category tabs cannot skip ahead of `canProceed`. */
  function maxReachableStepIndex(): number {
    let max = 0;
    for (let i = 0; i < workflowDefinition.length - 1; i++) {
      if (!canProceed(i)) break;
      max = i + 1;
    }
    return max;
  }

  function goToStep(nextIndex: number) {
    const max = maxReachableStepIndex();
    if (nextIndex > max) {
      setMessageTone("warning");
      setMessage(
        nextIndex >= 6
          ? `Draft review and submission stay locked until earlier steps are complete. ${nextRequiredInput}`
          : `That step is not unlocked yet. ${nextRequiredInput}`
      );
      setStep(max);
      return;
    }
    setStep(nextIndex);
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Builder Workspace"
        title={CONTRACTOR_SAFETY_BLUEPRINT_BUILDER_LABEL}
        description="Build the plan in one guided flow: choose the work, confirm the controls, fill the project details, then generate and submit the draft."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isOfflineDemoPrefillEnabled ? (
              <>
                <StatusBadge label={form.trade || "Trade not set"} tone={form.trade ? "info" : "warning"} />
                <StatusBadge
                  label={`${form.selected_format_sections.length} sections`}
                  tone={form.selected_format_sections.length ? "success" : "warning"}
                />
                <StatusBadge
                  label={`${form.tasks.length} tasks`}
                  tone={form.tasks.length ? "success" : "warning"}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={resetBuilder}
              className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
            >
              Reset builder
            </button>
          </div>
        }
      />

      {!authLoading && !canUseBuilder ? (
        <InlineMessage tone="warning">
          Your current role can review {CONTRACTOR_SAFETY_BLUEPRINT_TITLE} workflow information, but it cannot create or edit live drafts.
        </InlineMessage>
      ) : null}

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <div className="rounded-xl border border-[var(--app-border-strong)] bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="border-b border-[var(--app-border)] px-5 py-4 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-text)]">
              <span>Build status</span>
              <span className="text-[var(--app-text-strong)]">{progressPercent}%</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[var(--app-panel-muted)]">
              <div
                className="h-1.5 rounded-full bg-[var(--app-accent-primary)] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 text-xs leading-5 text-[var(--app-text)]">
              {completedStepCount} of {workflowDefinition.length} complete. Next:{" "}
              <span className="font-semibold text-[var(--app-text-strong)]">{nextRequiredInput}</span>
            </div>
          </div>

          <div className="flex min-w-0 gap-2 overflow-x-auto px-4 py-3">
            {workflowSteps.map((stepItem, stepIndex) => {
              const isActive = stepIndex === step;
              return (
                <button
                  key={`builder-step-${stepItem.label}`}
                  type="button"
                  onClick={() => goToStep(stepIndex)}
                  className={`flex min-w-[10.25rem] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    isActive
                      ? "border-[var(--app-accent-primary)] bg-white text-[var(--app-text-strong)] shadow-sm ring-1 ring-[var(--app-accent-primary)]"
                      : stepItem.complete
                        ? "border-emerald-200 bg-white text-[var(--app-text-strong)] hover:border-emerald-300"
                        : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                      isActive
                        ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary)] text-white"
                        : stepItem.complete
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-[var(--app-border)] bg-white text-[var(--app-text-strong)]"
                    }`}
                  >
                    {stepIndex + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-5">{stepItem.label}</span>
                    <span
                      className={`mt-0.5 block truncate text-[11px] font-medium ${
                        isActive
                          ? "text-[var(--app-accent-primary)]"
                          : stepItem.complete
                            ? "text-emerald-700"
                            : "text-[var(--app-text)]"
                      }`}
                    >
                      {stepItem.complete ? "Complete" : isActive ? "Current" : "Locked until ready"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <SectionCard
            title={`Step ${step + 1}: ${workflowDefinition[step].title}`}
            description={workflowDefinition[step].detail}
          >
            <fieldset disabled={authLoading || !canUseBuilder} className="space-y-6 disabled:opacity-60">
              {step === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Trade"
                    value={form.trade}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        trade: value,
                        subTrade: "",
                        tasks: [],
                        priced_attachment_keys: [],
                        selected_hazards: [],
                        program_subtype_selections: {},
                      }))
                    }
                    options={tradeOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="Choose trade"
                  />
                  <SelectField
                    label="Project delivery type"
                    value={form.project_delivery_type}
                    onChange={(value) => updateField("project_delivery_type", value)}
                    options={projectDeliveryOptions}
                    placeholder="Choose delivery type"
                  />
                  <SelectField
                    label="Governing state"
                    value={form.governing_state}
                    onChange={(value) => updateField("governing_state", value)}
                    options={jurisdictionStateOptions.map((option) => ({
                      value: option.code,
                      label: option.name,
                    }))}
                    placeholder="Choose state"
                  />
                  <InfoCard label="Jurisdiction profile" value={jurisdictionProfile.jurisdictionLabel} />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <SelectField
                    label="Sub-trade"
                    value={form.subTrade}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        subTrade: value,
                        tasks: [],
                        priced_attachment_keys: [],
                        selected_hazards: [],
                        program_subtype_selections: {},
                      }))
                    }
                    options={(selectedTrade?.availableSubTrades ?? []).map((option) => ({
                      value: option,
                      label: option,
                    }))}
                    placeholder="Choose sub-trade"
                    disabled={!form.trade}
                  />
                  {selectedTrade ? (
                    <InfoCard
                      label="Sub-trade summary"
                      value={
                        selectedTrade.subTradeDescription ??
                        "Choose a sub-trade to show the scope description for this selection."
                      }
                    />
                  ) : (
                    <InlineMessage tone="warning">
                      Choose a trade first so the live sub-trade list can be loaded.
                    </InlineMessage>
                  )}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <OptionGrid
                    items={csepFormatSectionOptionItems}
                    selectedItems={form.selected_format_sections}
                    onToggle={toggleSelectedFormatSection}
                    onApplyAll={() =>
                      applySelectedFormatSections(
                        CSEP_FORMAT_SECTION_OPTIONS.map((option) => option.value)
                      )
                    }
                    onClearAll={() => applySelectedFormatSections([])}
                  />
                  <SectionCard
                    title="Section dependency guide"
                    description="This step only controls which sections appear in the final draft. Task-driven sections open later after tasks are selected."
                  >
                    <div className="grid gap-2 md:grid-cols-2">
                      {selectedSectionStatuses.map((section) => (
                        <CompactStatusRow
                          key={`dependency-${section.value}`}
                          label={section.label}
                          value={section.included ? section.dependency : "Excluded"}
                          tone={section.included ? "info" : "neutral"}
                        />
                      ))}
                    </div>
                  </SectionCard>
                  {form.selected_format_sections.some((value) =>
                    TASK_DRIVEN_SECTION_LABELS.has(
                      csepFormatSectionOptionItems.find((section) => section.value === value)?.label ?? ""
                    )
                  ) ? (
                    <InlineMessage>
                      Task-driven sections stay locked until you choose the active task set, so you can move forward without bouncing back into this step.
                    </InlineMessage>
                  ) : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  {!form.subTrade ? (
                    <InlineMessage tone="warning">
                      Choose a sub-trade first so the task list can be loaded.
                    </InlineMessage>
                  ) : (
                    <>
                      <OptionGrid
                        items={toOptionGridItems(selectedTrade?.availableTasks ?? [])}
                        selectedItems={form.tasks}
                        onToggle={(value) => toggleArrayValue("tasks", value)}
                        onApplyAll={() => applyAllValues("tasks", selectedTrade?.availableTasks ?? [])}
                        onClearAll={() => clearAllValues("tasks")}
                      />
                      {(selectedTrade?.referenceTasks?.length ?? 0) > 0 ? (
                        <InfoCard
                          label="Reference tasks"
                          value={selectedTrade?.referenceTasks.join(", ") ?? ""}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={applyTradeDefaults}
                      disabled={!selectedTrade}
                      className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:opacity-50"
                    >
                      Apply trade defaults
                    </button>
                  </div>

                  <SectionBucket
                    title="Hazards to include"
                    items={toOptionGridItems(derivedHazards)}
                    selectedItems={effectiveSelectedHazards}
                    onToggle={(value) => toggleArrayValue("selected_hazards", value)}
                    onApplyAll={() => applyAllValues("selected_hazards", derivedHazards)}
                    onClearAll={() => clearAllValues("selected_hazards")}
                    emptyLabel="Select a trade, sub-trade, and task to derive hazards."
                  />
                  <SectionBucket
                    title="Required PPE"
                    items={toOptionGridItems(ppeOptions)}
                    selectedItems={form.required_ppe}
                    onToggle={(value) => toggleArrayValue("required_ppe", value)}
                    onApplyAll={() => applyAllValues("required_ppe", ppeOptions)}
                    onClearAll={() => clearAllValues("required_ppe")}
                  />
                  <SectionBucket
                    title="Additional permits"
                    items={toOptionGridItems(permitOptions)}
                    selectedItems={form.additional_permits}
                    onToggle={(value) => toggleArrayValue("additional_permits", value)}
                    onApplyAll={() => applyAllValues("additional_permits", permitOptions)}
                    onClearAll={() => clearAllValues("additional_permits")}
                  />
                  <SectionBucket
                    title="Priced attached requirements"
                    items={pricedAttachmentOptions}
                    selectedItems={form.priced_attachment_keys}
                    onToggle={(value) => toggleArrayValue("priced_attachment_keys", value)}
                    onApplyAll={() =>
                      applyAllValues(
                        "priced_attachment_keys",
                        eligiblePricedAttachments.map((item) => item.key)
                      )
                    }
                    onClearAll={() => clearAllValues("priced_attachment_keys")}
                    summaryValue={
                      selectedPricedAttachments.length
                        ? `${selectedPricedAttachments.length} selected | ${formatCsepPrice(selectedPricedAttachmentTotal)}`
                        : eligiblePricedAttachments.length
                          ? `${eligiblePricedAttachments.length} available | ${formatCsepPrice(eligiblePricedAttachmentTotal)}`
                          : "No trade-linked pricing items are available yet."
                    }
                    emptyLabel="Select a trade path and task set to reveal permit pricing and add-on pricing."
                  />
                  <ReferenceSummaryCard
                    title="Condensed OSHA / CFR references"
                    description={
                      selectedReferenceCodes.length
                        ? "Only the references matched to the selected trade path are shown here and carried compactly into the draft."
                        : "Choose a trade path to narrow the reference list. Showing the core register for now."
                    }
                    rows={selectedReferenceRows}
                    footer={
                      selectedReferenceCodes.length
                        ? `${selectedReferenceCodes.length} active reference${selectedReferenceCodes.length === 1 ? "" : "s"}`
                        : "Core register preview"
                    }
                  />
                  <InfoCard label="Auto-generated programs" value={autoPrograms.join(" | ") || "None triggered yet"} />
                  <InfoCard
                    label="Common overlapping trades"
                    value={commonOverlappingTrades.join(" | ") || "None inferred yet"}
                  />
                  {overlapPermitHints.length ? (
                    <InlineMessage>
                      High-risk overlap permit hints: {overlapPermitHints.join(", ")}.
                    </InlineMessage>
                  ) : null}

                  <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                    <div className="text-sm font-semibold text-[var(--app-text-strong)]">Program classifications</div>
                    <div className="mt-4 space-y-4">
                      {programSelectionState.selections.length === 0 ? (
                        <div className="text-sm text-[var(--app-text)]">
                          Select hazards, permits, or PPE items to reveal any required classifications.
                        </div>
                      ) : missingProgramSubtypeGroups.length === 0 ? (
                        <div className="text-sm text-[var(--app-text)]">
                          The active program set does not need any extra subtype classifications right now.
                        </div>
                      ) : (
                        missingProgramSubtypeGroups.map((group) => {
                          const config = getSubtypeConfig(group.group);

                          return (
                            <div key={group.group} className="rounded-2xl border border-[var(--app-border)] bg-white p-4">
                              <div className="text-sm font-semibold text-[var(--app-text-strong)]">{config.label}</div>
                              <p className="mt-1 text-sm text-[var(--app-text)]">{config.prompt}</p>
                              <select
                                className={`${appNativeSelectClassName} mt-3 w-full`}
                                value={form.program_subtype_selections[group.group] ?? ""}
                                onChange={(event) =>
                                  updateProgramSubtypeSelection(
                                    group.group,
                                    event.target.value as CSEPProgramSubtypeValue | ""
                                  )
                                }
                              >
                                <option value="">Select classification</option>
                                {config.options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                    <div className="text-sm font-semibold text-[var(--app-text-strong)]">Activity / hazard matrix</div>
                    <div className="mt-4 space-y-3">
                      {displayedTradeItems.length ? (
                        displayedTradeItems.map((item, index) => (
                          <div key={`${item.activity}-${item.hazard}-${index}`} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                            <div className="text-sm font-semibold text-[var(--app-text-strong)]">{item.activity}</div>
                            <div className="mt-2 text-sm text-[var(--app-text)]">Hazard: {item.hazard}</div>
                            <div className="text-sm text-[var(--app-text)]">Risk: {item.risk}</div>
                            <div className="text-sm text-[var(--app-text)]">Controls: {item.controls.join(", ")}</div>
                            <div className="text-sm text-[var(--app-text)]">Permit: {item.permit}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--app-text)]">
                          Select hazards to preview the task matrix rows that will feed the live draft.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-5">
                  <InlineMessage>
                    These fields unlock after task selection so smart drafting stays anchored to the actual work instead of forcing you back to earlier steps.
                  </InlineMessage>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <SelectField
                        label="Fill from jobsite"
                        value={form.jobsite_id}
                        onChange={applyJobsiteToForm}
                        options={jobsiteOptions}
                        placeholder={jobsitesLoading ? "Loading jobsites" : "Choose a saved jobsite"}
                        disabled={jobsitesLoading || jobsiteOptions.length === 0}
                      />
                    </div>
                    <InputField label="Project name" value={form.project_name} onChange={(value) => updateField("project_name", value)} />
                    <InputField label="Project number" value={form.project_number} onChange={(value) => updateField("project_number", value)} />
                    <InputField label="Project address" value={form.project_address} onChange={(value) => updateField("project_address", value)} />
                    <TextAreaField label="Owners / Clients" value={form.owner_client} onChange={(value) => updateField("owner_client", value)} />
                    <SelectField
                      label="Owner Message Template"
                      value={ownerMessagePresetId}
                      onChange={handleOwnerMessagePresetChange}
                      options={OWNER_MESSAGE_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: preset.title,
                      }))}
                      placeholder="Choose owner message"
                    />
                    <TextAreaField
                      label="Owner Message"
                      value={form.owner_message_text}
                      onChange={(value) => updateField("owner_message_text", value)}
                    />
                    <div className="md:col-span-2 space-y-2">
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">
                        GC / CM / program partners
                      </div>
                      <p className="text-xs text-[var(--app-text)]">
                        Add each organization or interface role separately (for example general contractor,
                        construction manager, owner representative, or program partner). The export lists each on
                        its own line; if you only enter one, the document shows a single value.
                      </p>
                      <div className="space-y-2">
                        {form.gc_cm.map((line, index) => (
                          <div key={`gc-cm-${index}`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="block min-w-0 flex-1">
                              <span className="sr-only">GC / CM / program partner {index + 1}</span>
                              <input
                                type="text"
                                value={line}
                                onChange={(event) => updateGcCmPartnerLine(index, event.target.value)}
                                placeholder="Organization or role"
                                className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
                              />
                            </label>
                            <button
                              type="button"
                              className="shrink-0 rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-muted)]"
                              onClick={() => removeGcCmPartnerLine(index)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="w-full rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel)] px-4 py-2.5 text-sm font-medium text-[var(--app-text-strong)] transition hover:border-[var(--app-accent-primary)]"
                          onClick={addGcCmPartnerLine}
                        >
                          Add organization or role
                        </button>
                      </div>
                    </div>
                    <InputField label="Contractor company" value={form.contractor_company} onChange={(value) => updateField("contractor_company", value)} />
                    <InputField label="Contractor contact" value={form.contractor_contact} onChange={(value) => updateField("contractor_contact", value)} />
                    <InputField label="Contractor phone" value={form.contractor_phone} onChange={(value) => updateField("contractor_phone", value)} />
                    <InputField label="Contractor email" value={form.contractor_email} onChange={(value) => updateField("contractor_email", value)} />
                  </div>
                  <SectionCard
                    title="Document control"
                    description="These fields populate the standalone Document Control and Revision History section at the end of the formatted CSEP package."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField label="Document number" value={form.document_number} onChange={(value) => updateField("document_number", value)} />
                      <InputField label="Revision" value={form.document_revision} onChange={(value) => updateField("document_revision", value)} />
                      <InputField label="Issue date" value={form.issue_date} onChange={(value) => updateField("issue_date", value)} />
                      <InputField label="Prepared by" value={form.prepared_by} onChange={(value) => updateField("prepared_by", value)} />
                      <InputField label="Reviewed by" value={form.reviewed_by} onChange={(value) => updateField("reviewed_by", value)} />
                      <InputField label="Approved by" value={form.approved_by} onChange={(value) => updateField("approved_by", value)} />
                    </div>
                  </SectionCard>
                  <SectionCard
                    title="Cover logo"
                    description="Upload the contractor or company logo you want shown on the cover and carried into the issued CSEP export."
                  >
                    <LogoInsertField
                      fileName={companyLogoFileName}
                      hasLogo={Boolean(companyLogoPreviewUrl)}
                      onChange={handleCompanyLogoChange}
                      onClear={clearCompanyLogo}
                    />
                  </SectionCard>
                  {form.selected_format_sections.includes(
                    "weather_requirements_and_severe_weather_response"
                  ) ? (
                    <SectionCard
                      title="Weather overlay"
                      description="These fields add project-specific thresholds and notes on top of the shared weather language in your CSEP. Smart fill uses your selected tasks and project context to suggest values for the fields below; you should still review and edit them before issuing."
                    >
                      <div className="mb-4">{renderBuilderAiAction("weather", "Smart fill weather section")}</div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InputField
                          label="Monitoring sources"
                          value={(form.weather_requirements.monitoringSources ?? []).join(", ")}
                          onChange={(value) =>
                            updateWeatherField("monitoringSources", parseCommaSeparatedList(value))
                          }
                        />
                        <InputField
                          label="Communication methods"
                          value={(form.weather_requirements.communicationMethods ?? []).join(", ")}
                          onChange={(value) =>
                            updateWeatherField(
                              "communicationMethods",
                              parseCommaSeparatedList(value)
                            )
                          }
                        />
                        <InputField
                          label="High-wind threshold / rule"
                          value={form.weather_requirements.highWindThresholdText ?? ""}
                          onChange={(value) => updateWeatherField("highWindThresholdText", value)}
                        />
                        <InputField
                          label="Lightning shelter note"
                          value={form.weather_requirements.lightningShelterNotes ?? ""}
                          onChange={(value) => updateWeatherField("lightningShelterNotes", value)}
                        />
                        <InputField
                          label="Lightning stop radius (miles)"
                          value={
                            form.weather_requirements.lightningRadiusMiles !== undefined &&
                            form.weather_requirements.lightningRadiusMiles !== null
                              ? String(form.weather_requirements.lightningRadiusMiles)
                              : ""
                          }
                          onChange={(value) =>
                            updateWeatherField(
                              "lightningRadiusMiles",
                              value.trim() ? Number(value) : null
                            )
                          }
                        />
                        <InputField
                          label="Lightning all-clear (minutes)"
                          value={
                            form.weather_requirements.lightningAllClearMinutes !== undefined &&
                            form.weather_requirements.lightningAllClearMinutes !== null
                              ? String(form.weather_requirements.lightningAllClearMinutes)
                              : ""
                          }
                          onChange={(value) =>
                            updateWeatherField(
                              "lightningAllClearMinutes",
                              value.trim() ? Number(value) : null
                            )
                          }
                        />
                        <InputField
                          label="Heat trigger"
                          value={form.weather_requirements.heatTriggerText ?? ""}
                          onChange={(value) => updateWeatherField("heatTriggerText", value)}
                        />
                        <InputField
                          label="Cold / wind-chill trigger"
                          value={form.weather_requirements.coldTriggerText ?? ""}
                          onChange={(value) => updateWeatherField("coldTriggerText", value)}
                        />
                        <InputField
                          label="Storm / tornado shelter"
                          value={form.weather_requirements.tornadoStormShelterNotes ?? ""}
                          onChange={(value) =>
                            updateWeatherField("tornadoStormShelterNotes", value)
                          }
                        />
                        <InputField
                          label="Union / accountability note"
                          value={form.weather_requirements.unionAccountabilityNotes ?? ""}
                          onChange={(value) =>
                            updateWeatherField("unionAccountabilityNotes", value)
                          }
                        />
                        <TextAreaField
                          label="Daily review note"
                          value={form.weather_requirements.dailyReviewNotes ?? ""}
                          onChange={(value) => updateWeatherField("dailyReviewNotes", value)}
                        />
                        <TextAreaField
                          label="Project override notes"
                          value={(form.weather_requirements.projectOverrideNotes ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "projectOverrideNotes",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="High-wind controls"
                          value={(form.weather_requirements.highWindControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "highWindControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Heat controls"
                          value={(form.weather_requirements.heatControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "heatControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Cold controls"
                          value={(form.weather_requirements.coldControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "coldControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Storm controls"
                          value={(form.weather_requirements.tornadoStormControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "tornadoStormControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Environmental controls"
                          value={(form.weather_requirements.environmentalControls ?? []).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "environmentalControls",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                        <TextAreaField
                          label="Contractor responsibility notes"
                          value={(
                            form.weather_requirements.contractorResponsibilityNotes ?? []
                          ).join("\n")}
                          onChange={(value) =>
                            updateWeatherField(
                              "contractorResponsibilityNotes",
                              value
                                .split("\n")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                      </div>
                    </SectionCard>
                  ) : null}
                  <div className="space-y-3">
                    {shouldShowBuilderAiAction("scope_of_work")
                      ? renderBuilderAiAction("scope_of_work")
                      : null}
                    <TextAreaField
                      label="Scope Summary (optional narrative)"
                      value={form.scope_of_work}
                      onChange={(value) => updateField("scope_of_work", value)}
                    />
                    <p className="text-xs text-[var(--app-text)]">
                      Trade, sub-trade, and selected tasks are generated automatically. Use this box only for
                      short contractor narrative that clarifies scope boundaries—do not repeat the task list here.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {shouldShowBuilderAiAction("site_specific_notes")
                      ? renderBuilderAiAction("site_specific_notes")
                      : null}
                    <TextAreaField
                      label="Project-Specific Safety Notes"
                      value={form.site_specific_notes}
                      onChange={(value) => updateField("site_specific_notes", value)}
                    />
                    <p className="text-xs text-[var(--app-text)]">
                      Site constraints, owner or GC rules, access limits, logistics, and weather concerns only—do not
                      repeat the Scope Summary task list.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {shouldShowBuilderAiAction("emergency_procedures")
                      ? renderBuilderAiAction("emergency_procedures")
                      : null}
                    <TextAreaField
                      label="Emergency procedures"
                      value={form.emergency_procedures}
                      onChange={(value) => updateField("emergency_procedures", value)}
                    />
                  </div>
                  {form.included_sections.includes("Roles and Responsibilities") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("roles_and_responsibilities_text")}
                      <TextAreaField
                        label="Roles and responsibilities notes"
                        value={form.roles_and_responsibilities_text}
                        onChange={(value) => updateField("roles_and_responsibilities_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Security and Access") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("security_and_access_text")}
                      <TextAreaField
                        label="Security and access notes"
                        value={form.security_and_access_text}
                        onChange={(value) => updateField("security_and_access_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Health and Wellness") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("health_and_wellness_text")}
                      <TextAreaField
                        label="Health and wellness notes"
                        value={form.health_and_wellness_text}
                        onChange={(value) => updateField("health_and_wellness_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Incident Reporting and Investigation") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("incident_reporting_and_investigation_text")}
                      <TextAreaField
                        label="Incident reporting and investigation notes"
                        value={form.incident_reporting_and_investigation_text}
                        onChange={(value) =>
                          updateField("incident_reporting_and_investigation_text", value)
                        }
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Training and Instruction") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("training_and_instruction_text")}
                      <TextAreaField
                        label="Training and instruction notes"
                        value={form.training_and_instruction_text}
                        onChange={(value) => updateField("training_and_instruction_text", value)}
                      />
                    </div>
                  ) : null}
                  {formIncludesDrugAlcoholSection(form.included_sections) ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("drug_and_alcohol_testing_text")}
                      <TextAreaField
                        label="Drug, alcohol, and fit-for-duty notes"
                        value={form.drug_and_alcohol_testing_text}
                        onChange={(value) => updateField("drug_and_alcohol_testing_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Enforcement and Corrective Action") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("enforcement_and_corrective_action_text")}
                      <TextAreaField
                        label="Enforcement and corrective action notes"
                        value={form.enforcement_and_corrective_action_text}
                        onChange={(value) =>
                          updateField("enforcement_and_corrective_action_text", value)
                        }
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Recordkeeping") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("recordkeeping_text")}
                      <TextAreaField
                        label="Recordkeeping notes"
                        value={form.recordkeeping_text}
                        onChange={(value) => updateField("recordkeeping_text", value)}
                      />
                    </div>
                  ) : null}
                  {form.included_sections.includes("Continuous Improvement") ? (
                    <div className="space-y-3">
                      {renderBuilderAiAction("continuous_improvement_text")}
                      <TextAreaField
                        label="Continuous improvement notes"
                        value={form.continuous_improvement_text}
                        onChange={(value) => updateField("continuous_improvement_text", value)}
                      />
                    </div>
                  ) : null}
                  <InlineMessage>
                    Task-driven content is ready. Continue to draft review when the project details and section notes look right.
                  </InlineMessage>
                </div>
              ) : null}

              {step === 6 ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text-strong)]">Draft approval</div>
                        <div className="mt-1 text-sm text-[var(--app-text)]">
                          Generate or refresh the draft here, review the selected sections, and approve the current version before moving to submission.
                        </div>
                      </div>
                      <StatusBadge
                        label={
                          previewState
                            ? previewIsCurrent
                              ? "Current draft"
                              : "Regenerate needed"
                            : "Draft needed"
                        }
                        tone={
                          previewState
                            ? previewIsCurrent
                              ? "success"
                              : "warning"
                            : "warning"
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleGenerateDraft}
                        disabled={!csepReady || previewLoading}
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-60"
                      >
                        {previewLoading
                          ? "Generating smart draft..."
                          : previewState
                            ? "Regenerate smart draft"
                            : "Generate smart draft"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewApproved(true)}
                        disabled={
                          !previewState ||
                          !previewIsCurrent ||
                          previewApproved ||
                          previewHasBlockingCoverageGaps
                        }
                        className="rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:opacity-60"
                      >
                        {previewApproved && previewIsCurrent ? "Draft approved" : "Approve current draft"}
                      </button>
                      {isOfflineDemoPrefillEnabled ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenDemoPackFolder();
                          }}
                          className="inline-flex rounded-xl border border-[var(--app-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                        >
                          Open demo documents folder
                        </button>
                      ) : null}
                    </div>
                    {!csepReady && !previewLoading ? (
                      <div className="mt-4">
                        <InlineMessage tone="warning">
                          Smart draft stays disabled until the live form matches the generator gate: trade, project delivery type,
                          sub-trade, at least one task, at least one hazard, and required program classifications.{" "}
                          <span className="font-medium">{nextRequiredInput}</span>
                        </InlineMessage>
                      </div>
                    ) : null}
                    {previewState && !previewIsCurrent ? (
                      <div className="mt-4">
                        <InlineMessage tone="warning">
                          Builder inputs changed after this draft was generated. Regenerate the draft, then approve the new version before submitting.
                        </InlineMessage>
                      </div>
                    ) : null}
                  </div>
                  {previewState ? (
                    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--app-text-strong)]">Smart draft preview</div>
                          <div className="mt-1 text-sm text-[var(--app-text)]">
                            Review the generated sections for the current live CSEP selection.
                          </div>
                        </div>
                        <StatusBadge label={previewIsCurrent ? "Current" : "Stale"} tone={previewIsCurrent ? "success" : "warning"} />
                      </div>
                      {previewState.draft.coverageAudit?.findings?.length ? (
                        <div className="mt-4">
                          <CsepCoverageAuditPanel audit={previewState.draft.coverageAudit} />
                        </div>
                      ) : null}
                      {previewHasBlockingCoverageGaps ? (
                        <div className="mt-4">
                          <InlineMessage tone="warning">
                            Resolve all required coverage findings before approving this draft.
                          </InlineMessage>
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-4">
                        {previewState.draft.sectionMap.map((section) => (
                          <CsepDraftSectionPreview key={section.key} section={section} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <InlineMessage>
                      Generate the draft here after completing enrichment and the task-driven sections so submission stays clean and simple.
                    </InlineMessage>
                  )}
                </div>
              ) : null}

              {step === 7 ? (
                <div className="space-y-5">
                  {csepHandoffComplete ? (
                    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-6 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                            Completed {CONTRACTOR_SAFETY_BLUEPRINT_TITLE}
                          </div>
                          <h3 className="mt-1 text-lg font-semibold text-[var(--app-text-strong)]">
                            Handoff display — use for screen share or walkthrough
                          </h3>
                          <p className="mt-2 text-sm text-[var(--app-text)]">
                            This CSEP is submitted. Below is a compact issued summary you can read aloud or show on the final slide.
                            {csepHandoffAt ? (
                              <span className="block pt-1 text-xs text-slate-600">
                                Recorded: {new Date(csepHandoffAt).toLocaleString()}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <StatusBadge label="Handoff ready" tone="success" />
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <InfoCard
                          label="Project"
                          value={form.project_name.trim() || "—"}
                        />
                        <InfoCard
                          label="Document / reference"
                          value={
                            [form.document_number?.trim() || "—", form.project_number?.trim() ? `Project # ${form.project_number}` : null]
                              .filter(Boolean)
                              .join(" · ") || "—"
                          }
                        />
                        <InfoCard
                          label="Revision & issue"
                          value={[form.document_revision?.trim() || "—", form.issue_date?.trim() || null]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                        <InfoCard
                          label="Trade & sub-trade"
                          value={
                            (selectedTrade?.tradeLabel ?? form.trade) && (selectedTrade?.subTradeLabel ?? form.subTrade)
                              ? `${selectedTrade?.tradeLabel ?? form.trade} — ${selectedTrade?.subTradeLabel ?? form.subTrade}`
                              : "—"
                          }
                        />
                        <InfoCard
                          label="Owner / client"
                          value={form.owner_client.trim() || "—"}
                        />
                        <InfoCard
                          label="Contractor"
                          value={form.contractor_company.trim() || "—"}
                        />
                      </div>
                      {isOfflineDemoPrefillEnabled ? (
                        <div className="mt-5 rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm text-[var(--app-text)]">
                          <span className="font-semibold text-[var(--app-text-strong)]">Offline demo pack:</span> a finished Word
                          example is generated next to the project folder, e.g.{" "}
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            …\safety360_offline_demo_pack\deliverables\North_Tower_Issued_CSEP_Summit_Ridge.docx
                          </code>{" "}
                          (use the same handoff you built with the desktop installer).
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void handleOpenDemoPackFolder();
                                }}
                                className="inline-flex rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                              >
                                Open demo documents folder
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={resetBuilder}
                          className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
                        >
                          Start a new {CONTRACTOR_SAFETY_BLUEPRINT_TITLE} build
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!csepHandoffComplete ? (
                    <LegalAcceptanceBlock checked={agreedToSubmissionTerms} onChange={setAgreedToSubmissionTerms} />
                  ) : (
                    <InlineMessage tone="success">Terms, privacy, and waiver were accepted for this submission.</InlineMessage>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={previewReadyForSubmit ? "Draft approved" : "Draft approval required"} tone={previewReadyForSubmit ? "success" : "warning"} />
                    <StatusBadge label={canSubmitDocuments ? "Submit access ready" : "Submit access missing"} tone={canSubmitDocuments ? "success" : "warning"} />
                    {csepHandoffComplete ? <StatusBadge label="Submitted" tone="success" /> : null}
                    {previewHasBlockingCoverageGaps ? (
                      <StatusBadge label="Required gaps must be resolved" tone="warning" />
                    ) : null}
                  </div>
                  {!previewReadyForSubmit && !csepHandoffComplete ? (
                    <InlineMessage tone="warning">
                      Return to Step {reviewStepNumber} to generate, refresh, or approve the draft before submitting.
                    </InlineMessage>
                  ) : null}
                  {previewState ? (
                    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
                      <div className="text-sm font-semibold text-[var(--app-text-strong)]">Current draft preview</div>
                      {previewState.draft.coverageAudit?.findings?.length ? (
                        <div className="mt-4">
                          <CsepCoverageAuditPanel audit={previewState.draft.coverageAudit} />
                        </div>
                      ) : null}
                      {previewHasBlockingCoverageGaps ? (
                        <div className="mt-4">
                          <InlineMessage tone="warning">
                            Submission is blocked until all required coverage findings are resolved in the draft.
                          </InlineMessage>
                        </div>
                      ) : null}
                      <div className="mt-4 rounded-xl border border-slate-300 bg-white px-6 py-6 shadow-sm">
                        <div className="border-b border-slate-200 pb-4 text-center">
                          <div className="csep-doc-heading text-base font-semibold">
                            Contractor Safety &amp; Environmental Plan
                          </div>
                          <div className="mt-1 text-sm italic text-slate-500">
                            Preview styled to match the clean steel-erection document format
                          </div>
                        </div>
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6">
                          {companyLogoPreviewUrl ? (
                            <div className="flex flex-col items-center gap-4 text-center">
                              <div className="csep-doc-heading text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Company Logo
                              </div>
                              {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL preview; Next Image cannot optimize it. */}
                              <img
                                src={companyLogoPreviewUrl}
                                alt="Company logo preview"
                                className="max-h-28 w-auto max-w-full object-contain"
                              />
                              <div className="text-xs text-slate-500">
                                {companyLogoFileName ?? "Uploaded company logo"}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="csep-doc-heading text-xs font-semibold uppercase tracking-[0.18em]">
                                Add Company Logo
                              </div>
                              <div className="mt-2 text-sm text-slate-500">
                                Upload a contractor or company logo in the Cover logo block so the cover preview shows a real branded insert.
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-6 space-y-6">
                          {previewState.draft.sectionMap.map((section) => (
                            <CsepDraftSectionPreview key={`finish-${section.key}`} section={section} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="sticky bottom-3 z-20 -mx-2 mt-2 rounded-2xl border border-[var(--app-border-strong)] bg-white/95 px-3 py-3 shadow-xl shadow-slate-950/10 backdrop-blur supports-[backdrop-filter]:bg-white/85">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-text)]">
                      Step {step + 1} of {workflowDefinition.length}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-[var(--app-text-strong)]">
                      {workflowDefinition[step].title}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setStep((current) => Math.max(0, current - 1))}
                      disabled={step === 0}
                      className="rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-muted)] disabled:opacity-50"
                    >
                      Back
                    </button>
                    {step < workflowDefinition.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setStep((current) => current + 1)}
                        disabled={!canProceed(step)}
                        className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:opacity-50"
                      >
                        Next step
                      </button>
                    ) : !csepHandoffComplete ? (
                      <button
                        type="button"
                        onClick={handleSubmitForReview}
                        disabled={submitLoading || !agreedToSubmissionTerms || !canSubmitDocuments || !previewReadyForSubmit}
                        className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)] disabled:opacity-50"
                      >
                        {submitLoading ? "Submitting..." : "Submit for review"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={resetBuilder}
                        className="rounded-xl bg-[var(--app-accent-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-primary-hover)]"
                      >
                        Start new build
                      </button>
                    )}
                  </div>
                </div>
                {step < workflowDefinition.length - 1 && !canProceed(step) ? (
                  <div className="mt-2 text-xs text-[var(--app-text)]">
                    Next step unlocks after: <span className="font-semibold text-[var(--app-text-strong)]">{nextRequiredInput}</span>
                  </div>
                ) : step === workflowDefinition.length - 1 && !csepHandoffComplete && !previewReadyForSubmit ? (
                  <div className="mt-2 text-xs text-[var(--app-text)]">
                    Submit unlocks after the draft is current, approved, and the required terms are accepted.
                  </div>
                ) : null}
              </div>
            </fieldset>
          </SectionCard>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <SectionCard title="Build Summary" description="Current inputs and gate status for this CSHEP package.">
            <div className="grid gap-2">
              <CompactStatusRow
                label="Current step"
                value={`${step + 1}. ${workflowDefinition[step].title}`}
                tone="info"
              />
              <CompactStatusRow
                label="Next gate"
                value={nextRequiredInput}
                tone={canProceed(step) ? "info" : "neutral"}
              />
              <CompactStatusRow
                label="Draft status"
                value={previewReadyForSubmit ? "Approved" : previewState ? "Review needed" : "Not generated"}
                tone={previewReadyForSubmit ? "info" : "neutral"}
              />
            </div>
          </SectionCard>
          <StartChecklist title="Readiness checklist" items={readinessChecklist} />
          <SectionCard title="Builder snapshot" description="Live view of what the generator has assembled so far.">
            <InfoCard label="Next required input" value={nextRequiredInput} />
            <InfoCard label="Jurisdiction" value={jurisdictionProfile.jurisdictionLabel} />
            <InfoCard label="Trade" value={(selectedTrade?.tradeLabel ?? form.trade) || "Not selected"} />
            <InfoCard label="Sub-trade" value={(selectedTrade?.subTradeLabel ?? form.subTrade) || "Not selected"} />
            <InfoCard label="Tasks" value={form.tasks.length ? `${form.tasks.length} selected` : "None selected"} />
            <InfoCard label="Hazards" value={effectiveSelectedHazards.length ? `${effectiveSelectedHazards.length} selected` : "None selected"} />
            <InfoCard label="Programs" value={autoPrograms.length ? `${autoPrograms.length} generated` : "None generated"} />
            <InfoCard
              label="Unlocked task-driven sections"
              value={
                unlockedTaskDrivenSections.length
                  ? unlockedTaskDrivenSections
                      .filter((section) => section.dependency === "Requires tasks")
                      .map((section) => section.label)
                      .join(" | ") || "None selected"
                  : "None selected"
              }
            />
          </SectionCard>
          <SectionCard
            title="Selected document layout"
            description="Each included section shows whether it is ready now, task-driven, or tied to hazards/program setup."
          >
            <div className="grid gap-2">
              {selectedSectionStatuses.map((section) => (
                <CompactStatusRow
                  key={section.value}
                  label={section.label}
                  value={section.included ? section.dependency : "Excluded"}
                  tone={section.included ? "info" : "neutral"}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <select
        className={`${appNativeSelectClassName} w-full`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2.5 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-[var(--app-accent-primary)]"
      />
    </label>
  );
}

function LogoInsertField({
  fileName,
  hasLogo,
  onChange,
  onClear,
}: {
  fileName: string | null;
  hasLogo: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-[var(--app-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]">
          Upload logo
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        </label>
        {hasLogo ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-white"
          >
            Clear logo
          </button>
        ) : null}
      </div>
      <div className="mt-3 text-sm text-[var(--app-text)]">
        {fileName
          ? `Current logo: ${fileName}`
          : "Use a PNG or JPG logo file to place a branded image on the CSEP cover and export."}
      </div>
    </div>
  );
}

function OptionGrid({
  items,
  selectedItems,
  onToggle,
  onApplyAll,
  onClearAll,
}: {
  items: OptionGridItem[];
  selectedItems: string[];
  onToggle: (value: string) => void;
  onApplyAll?: () => void;
  onClearAll?: () => void;
}) {
  return (
    <div className="space-y-3">
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {onApplyAll ? (
            <button
              type="button"
              onClick={onApplyAll}
              className="rounded-full border border-[var(--app-border-strong)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-strong)] transition hover:bg-[var(--app-accent-primary-soft)]"
            >
              Apply all
            </button>
          ) : null}
          {onClearAll ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text)] transition hover:bg-white"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <label
            key={item.value}
            className="flex items-start gap-3 rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-3"
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(item.value)}
              onChange={() => onToggle(item.value)}
              className="mt-1 h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--app-text-strong)]">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-[var(--app-panel-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-strong)]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <div className="mt-1 text-xs leading-5 text-[var(--app-text)]">{item.description}</div>
              ) : null}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--app-text)]">{value}</div>
    </div>
  );
}

function CompactStatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "info";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-white px-3 py-2">
      <div className="min-w-0 truncate text-sm font-medium text-[var(--app-text-strong)]">{label}</div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          tone === "info"
            ? "bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]"
            : "bg-[var(--app-panel-muted)] text-[var(--app-text)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ReferenceSummaryCard({
  title,
  description,
  rows,
  footer,
}: {
  title: string;
  description: string;
  rows: readonly { code: string; citation: string }[];
  footer: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
          <p className="mt-1 text-sm leading-6 text-[var(--app-text)]">{description}</p>
        </div>
        <StatusBadge label={footer} tone="info" />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {rows.map((entry) => (
          <div key={entry.code} className="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-accent-primary)]">
              {entry.code}
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--app-text)]">{entry.citation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionBucket({
  title,
  items,
  selectedItems,
  onToggle,
  onApplyAll,
  onClearAll,
  summaryValue,
  emptyLabel = "Nothing selected yet.",
}: {
  title: string;
  items: OptionGridItem[];
  selectedItems: string[];
  onToggle: (value: string) => void;
  onApplyAll?: () => void;
  onClearAll?: () => void;
  summaryValue?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-panel)] p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</div>
      {summaryValue ? (
        <div className="mt-1 text-sm text-[var(--app-text)]">{summaryValue}</div>
      ) : null}
      <div className="mt-4">
        {items.length ? (
          <OptionGrid
            items={items}
            selectedItems={selectedItems}
            onToggle={onToggle}
            onApplyAll={onApplyAll}
            onClearAll={onClearAll}
          />
        ) : (
          <div className="text-sm text-[var(--app-text)]">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function parseKeySectionBullet(bullet: string) {
  const match = bullet.match(/^(?:Key sections|Review these sections first):\s*(.+?)(?:\.)?$/i);
  if (!match) return null;

  const options = match[1]
    .split(/,\s+(?=\d+(?:\.\d+)*\s)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const numberMatch = item.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
      return {
        value: item,
        label: item,
        number: numberMatch?.[1] ?? null,
        title: numberMatch?.[2] ?? item,
      };
    });

  return options.length ? options : null;
}

function parseInterfacesWithBullet(bullet: string) {
  const match = bullet.match(/^(?:Interfaces With|Interfaces to coordinate):\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

function ReferencePackDetailBullet({
  bullet,
  numberedLabel,
}: {
  bullet: string;
  numberedLabel: string;
}) {
  const interfacesBody = parseInterfacesWithBullet(bullet);

  if (interfacesBody) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold leading-6 text-slate-700">
          {numberedLabel} Coordination Notes
        </div>
        <p className="text-sm leading-7 text-slate-700">{interfacesBody}</p>
      </div>
    );
  }

  const keySectionOptions = parseKeySectionBullet(bullet);
  if (keySectionOptions) {
    return <KeySectionsBullet bullet={bullet} />;
  }

  return <p className="text-sm leading-7 text-slate-700">{bullet}</p>;
}

function KeySectionsBullet({ bullet }: { bullet: string }) {
  const options = parseKeySectionBullet(bullet);

  if (!options) {
    return <p className="text-sm leading-7 text-slate-700">{bullet}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold leading-6 text-slate-700">
        17.1.1 Review Focus
      </div>
      <div className="space-y-1 pl-4">
        {options.map((option, index) => (
          <div key={option.value} className="text-sm leading-6 text-slate-700">
            <span className="csep-doc-number-text mr-2 font-semibold">
              {String.fromCharCode(97 + index)}.
            </span>
            {option.title}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGeneratedSectionTableRow(columns: string[], row: string[]) {
  return columns.map((column, columnIndex) => ({
    label: column.trim(),
    value: row[columnIndex]?.trim() || "N/A",
  }));
}

function splitReadableParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .flatMap((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) {
        return [];
      }

      const sentences = trimmedBlock
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

      if (sentences.length <= 2 && trimmedBlock.length <= 240) {
        return [trimmedBlock];
      }

      const paragraphs: string[] = [];
      let current = "";

      for (const sentence of sentences) {
        const candidate = current ? `${current} ${sentence}` : sentence;
        if (!current || (current.length < 240 && candidate.length <= 320)) {
          current = candidate;
          continue;
        }

        paragraphs.push(current);
        current = sentence;
      }

      if (current) {
        paragraphs.push(current);
      }

      return paragraphs;
    });
}

function GeneratedSectionCopy({ text }: { text: string }) {
  const paragraphs = splitReadableParagraphs(text);

  return (
    <div className="mt-3 max-w-[74ch] space-y-3">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p
          key={`${paragraph.slice(0, 24)}-${paragraphIndex}`}
          className="whitespace-pre-wrap text-sm leading-7 text-slate-700"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function GeneratedSectionTableRow({
  columns,
  row,
  rowLabel,
}: {
  columns: string[];
  row: string[];
  rowLabel: string;
}) {
  const cells = formatGeneratedSectionTableRow(columns, row);

  return (
    <div className="csep-soft-elevated rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="csep-doc-number-badge inline-flex w-fit min-w-[3.25rem] justify-center rounded-full px-2.5 py-1 text-xs font-bold tracking-[0.12em]">
          {rowLabel}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-3">
          {cells.map((cell) => (
            <div
              key={`${rowLabel}-${cell.label}`}
              className="rounded-xl bg-slate-50 px-3 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {cell.label}
              </div>
              <div className="mt-1 text-sm leading-6 text-slate-700">{cell.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CsepDraftSectionPreview({
  section,
}: {
  section: GeneratedSafetyPlanDraft["sectionMap"][number];
}) {
  function sanitizeNumberedTitle(title: string) {
    return title.replace(/^(Section\s+)?\d+(?:\.\d+)*\.?\s+/i, "").trim();
  }

  function getNumberDepth(value?: string | null) {
    if (!value) return 0;
    return value.replace(/\.$/, "").split(".").filter(Boolean).length;
  }

  function normalizeComparableText(value?: string | null) {
    return sanitizeNumberedTitle(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function shouldRenderSubsectionHeading(
    subsection: NonNullable<GeneratedSafetyPlanDraft["sectionMap"][number]["subsections"]>[number]
  ) {
    const title = sanitizeNumberedTitle(subsection.title).trim();
    if (!title) return false;
    if (normalizeComparableText(title) === normalizeComparableText(section.title)) return false;

    const comparableContent = Array.from(
      new Set(
        [subsection.body, ...subsection.bullets]
          .map((value) => normalizeComparableText(value))
          .filter(Boolean)
      )
    );

    return !(comparableContent.length === 1 && comparableContent[0] === normalizeComparableText(title));
  }

  const topLevelSubsectionBulletTotal =
    section.subsections?.reduce(
      (acc, subsection) => acc + (shouldRenderSubsectionHeading(subsection) ? 0 : subsection.bullets.length),
      0
    ) ?? 0;
  const numberedItemsBeforeTable = (section.bullets?.length ?? 0) + topLevelSubsectionBulletTotal;

  const sectionMetaLabel =
    section.kind === "front_matter"
      ? "Front matter"
      : section.kind === "appendix"
        ? "Appendix"
        : section.kind === "gap"
          ? "Coverage callout"
          : null;
  const cleanTitle = section.numberLabel && section.title.startsWith(section.numberLabel)
    ? section.title
    : section.numberLabel
      ? `${section.numberLabel} ${sanitizeNumberedTitle(section.title)}`
      : section.title;
  const sectionPrefix = section.numberLabel
    ? section.numberLabel.replace(/\.0$/, "")
    : null;
  const sectionDepth = getNumberDepth(sectionPrefix);
  const sectionIndentClass =
    sectionDepth >= 3 ? "pl-8" : sectionDepth === 2 ? "pl-5" : "pl-0";

  return (
    <section className={`border-b border-slate-200 pb-8 last:border-b-0 ${sectionIndentClass}`}>
      {sectionMetaLabel ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {sectionMetaLabel}
        </div>
      ) : null}
      <div className="mt-2 min-w-0">
        <div className="csep-doc-heading text-[15px] font-semibold">{cleanTitle}</div>
      </div>
      {section.summary ? <GeneratedSectionCopy text={section.summary} /> : null}
      {section.body ? <GeneratedSectionCopy text={section.body} /> : null}
      {section.bullets?.length ? (
        <div className="mt-3 space-y-2">
          {section.bullets.map((bullet, bulletIndex) => (
            <div
              key={`${section.key}-bullet-${bulletIndex}`}
              className="rounded-xl bg-slate-50/70 px-3 py-2"
            >
              <p className="max-w-[72ch] text-sm leading-7 text-slate-700">{bullet}</p>
            </div>
          ))}
        </div>
      ) : null}
      {section.subsections?.length ? (
        <div className="mt-5 space-y-5">
          {(() => {
            let runningTopLevelItemIndex = section.bullets?.length ?? 0;

            return section.subsections.map((subsection, subsectionIndex) => {
            const subsectionPrefix = sectionPrefix
              ? `${sectionPrefix}.${subsectionIndex + 1}`
              : `${subsectionIndex + 1}`;
            const subsectionDepth = getNumberDepth(subsectionPrefix);
            const showSubsectionHeading = shouldRenderSubsectionHeading(subsection);
            const subsectionHeading = showSubsectionHeading
              ? `${subsectionPrefix} ${sanitizeNumberedTitle(subsection.title)}`
              : null;

            return (
              <div
                key={`${section.key}-subsection-${subsectionIndex}`}
                className={
                  subsectionDepth >= 3
                    ? "border-l border-slate-200 pl-5"
                    : "border-l border-slate-200 pl-4"
                }
              >
                {subsectionHeading ? (
                  <div className="csep-doc-number-text text-sm font-semibold">{subsectionHeading}</div>
                ) : null}
                {subsection.body ? <GeneratedSectionCopy text={subsection.body} /> : null}
                {subsection.bullets.length ? (
                  <div className="mt-2 space-y-2">
                    {subsection.bullets.map((bullet, bulletIndex) => (
                      (() => {
                        const numberedLabel = subsectionHeading
                          ? `${subsectionPrefix}.${bulletIndex + 1}`
                          : (() => {
                              runningTopLevelItemIndex += 1;
                              return sectionPrefix
                                ? `${sectionPrefix}.${runningTopLevelItemIndex}`
                                : `${runningTopLevelItemIndex}`;
                            })();

                        return (
                          <div
                            key={`${section.key}-subsection-${subsectionIndex}-bullet-${bulletIndex}`}
                            className="rounded-xl bg-slate-50/70 px-3 py-2"
                          >
                            <ReferencePackDetailBullet bullet={bullet} numberedLabel={numberedLabel} />
                          </div>
                        );
                      })()
                    ))}
                  </div>
                ) : null}
              </div>
            );
            });
          })()}
        </div>
      ) : null}
      {section.table?.rows?.length ? (
        <div className="mt-5 space-y-3">
          {section.table.rows.map((row, rowIndex) => {
            const n = numberedItemsBeforeTable + rowIndex + 1;
            const rowLabel = sectionPrefix ? `${sectionPrefix}.${n}` : `${n}.`;
            return (
              <GeneratedSectionTableRow
                key={`${section.key}-table-row-${rowIndex}`}
                columns={section.table!.columns}
                row={row}
                rowLabel={rowLabel}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function CsepCoverageAuditPanel({
  audit,
}: {
  audit: NonNullable<GeneratedSafetyPlanDraft["coverageAudit"]>;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-white p-4">
      <div className="text-sm font-semibold text-[var(--app-text-strong)]">Coverage audit</div>
      <div className="mt-1 text-sm text-[var(--app-text)]">
        Required: {audit.unresolvedRequiredCount} | Warnings: {audit.unresolvedWarningCount}
      </div>
      <div className="mt-4 space-y-2">
        {audit.findings.map((finding) => (
          <div
            key={finding.key}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-strong)]">
              {finding.severity}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
              {finding.title}
            </div>
            <div className="mt-1 text-sm leading-6 text-[var(--app-text)]">{finding.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
