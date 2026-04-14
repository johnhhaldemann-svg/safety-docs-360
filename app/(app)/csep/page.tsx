"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import { CompanyAiAssistPanel } from "@/components/company-ai/CompanyAiAssistPanel";
import { CompanyMemoryBankPanel } from "@/components/company-ai/CompanyMemoryBankPanel";
import { ChecklistCoveragePanel } from "@/components/compliance/ChecklistCoveragePanel";
import { GcRequiredProgramUpload } from "@/components/csep/GcRequiredProgramUpload";
import {
  buildCsepProgramSelections,
  getSubtypeConfig,
  listProgramTitles,
} from "@/lib/csepPrograms";
import { buildCsepTradeSelection, getCsepTradeOptions } from "@/lib/csepTradeSelection";
import type { ChecklistEvaluationResponse } from "@/lib/compliance/evaluation";
import type { PermissionMap } from "@/lib/rbac";
import { buildCsepGenerationContext } from "@/lib/safety-intelligence/documentIntake";
import type { CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue } from "@/types/csep-programs";

type CSEPForm = {
  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  gc_cm: string;

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

  required_ppe: string[];
  additional_permits: string[];
  selected_hazards: string[];
  program_subtype_selections: Partial<Record<CSEPProgramSubtypeGroup, CSEPProgramSubtypeValue>>;
  included_sections: string[];
};

const tradeOptions = getCsepTradeOptions();

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

const csepSectionOptions = [
  "Project Information",
  "Contractor Information",
  "Trade Summary",
  "Scope of Work",
  "Site Specific Notes",
  "Emergency Procedures",
  "Required PPE",
  "Additional Permits",
  "Common Overlapping Trades",
  "OSHA References",
  "Selected Hazards",
  "Activity / Hazard Matrix",
];

const initialForm: CSEPForm = {
  project_name: "",
  project_number: "",
  project_address: "",
  owner_client: "",
  gc_cm: "",

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

  required_ppe: [],
  additional_permits: [],
  selected_hazards: [],
  program_subtype_selections: {},
  included_sections: [...csepSectionOptions],
};


/*
  const kind = csepKindForTradeLabel(trade);
  return {
    trade,
    sectionTitle: `Site-Specific Safety Requirements – ${trade}`,
    summary: csepSummaryForKind(kind),
    oshaRefs: csepOshaRefsForKind(kind),
    defaultPPE: csepDefaultPpeForKind(kind),
    items: BASE_ITEMS,
  };
*/

function inputClassName() {
  return "w-full rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition hover:border-slate-500 focus:border-sky-500";
}

function textareaClassName() {
  return "min-h-[120px] w-full rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition hover:border-slate-500 focus:border-sky-500";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CSEPPage() {
  const [form, setForm] = useState<CSEPForm>(initialForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [agreedToSubmissionTerms, setAgreedToSubmissionTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [checklistEvaluation, setChecklistEvaluation] = useState<ChecklistEvaluationResponse | null>(
    null
  );
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
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

        if (user) {
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
              | { user?: { permissionMap?: PermissionMap } }
              | null;

            if (meResponse.ok) {
              setPermissionMap(meData?.user?.permissionMap ?? null);
            }
          }
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

  const derivedPermits = useMemo(() => {
    return selectedTrade?.derivedPermits ?? [];
  }, [selectedTrade]);

  const overlapPermitHints = useMemo(() => {
    return selectedTrade?.overlapPermitHints ?? [];
  }, [selectedTrade]);

  const commonOverlappingTrades = useMemo(() => {
    return selectedTrade?.commonOverlappingTrades ?? [];
  }, [selectedTrade]);

  const derivedHazards = useMemo(() => {
    return selectedTrade?.derivedHazards ?? [];
  }, [selectedTrade]);

  const displayedTradeItems = useMemo(() => {
    if (!selectedTrade) return [];
    if (form.selected_hazards.length === 0) return selectedTrade.items;
    return selectedTrade.items.filter((item) =>
      form.selected_hazards.includes(item.hazard)
    );
  }, [form.selected_hazards, selectedTrade]);

  const selectedPermitItems = useMemo(() => {
    return Array.from(new Set([...form.additional_permits, ...derivedPermits, ...overlapPermitHints]));
  }, [derivedPermits, form.additional_permits, overlapPermitHints]);

  const programSelectionState = useMemo(() => {
    return buildCsepProgramSelections({
      selectedHazards: form.selected_hazards,
      selectedPermits: selectedPermitItems,
      selectedPpe: form.required_ppe,
      tradeItems: displayedTradeItems,
      selectedTasks: form.tasks,
      subtypeSelections: form.program_subtype_selections,
    });
  }, [
    displayedTradeItems,
    form.program_subtype_selections,
    form.required_ppe,
    form.selected_hazards,
    form.tasks,
    selectedPermitItems,
  ]);

  const programSelections = useMemo(() => {
    return programSelectionState.selections;
  }, [programSelectionState.selections]);

  const missingProgramSubtypeGroups = useMemo(() => {
    return programSelectionState.missingSubtypeGroups;
  }, [programSelectionState.missingSubtypeGroups]);

  const autoPrograms = useMemo(() => {
    return listProgramTitles(programSelections);
  }, [programSelections]);

  const totalPermitCount = useMemo(() => {
    return new Set([...form.additional_permits, ...derivedPermits]).size;
  }, [derivedPermits, form.additional_permits]);

  function updateField<K extends keyof CSEPForm>(field: K, value: CSEPForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  function toggleArrayValue(
    field:
      | "required_ppe"
      | "additional_permits"
      | "selected_hazards"
      | "included_sections"
      | "tasks",
    value: string
  ) {
    setForm((prev) => {
      const current = prev[field];
      const exists = current.includes(value);

      return {
        ...prev,
        [field]: exists
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  }

  function applyTradeDefaults() {
    if (!selectedTrade) return;

    setForm((prev) => ({
      ...prev,
      required_ppe: Array.from(
        new Set([...prev.required_ppe, ...selectedTrade.defaultPPE])
      ),
      additional_permits: Array.from(
        new Set([...prev.additional_permits, ...derivedPermits])
      ),
      selected_hazards: Array.from(
        new Set([...prev.selected_hazards, ...derivedHazards])
      ),
    }));
  }

  async function handleSubmitForReview() {
    try {
      setMessage("");
      if (!permissionMap?.can_submit_documents) {
        setMessageTone("warning");
        setMessage("Your current role cannot submit CSEP records into review.");
        return;
      }
      if (authLoading) {
        setMessageTone("warning");
        setMessage("Your account is still loading. Please wait a moment and try again.");
        return;
      }

      if (!userId) {
        setMessageTone("error");
        setMessage("No logged-in user found. Please log in again.");
        return;
      }

      if (!agreedToSubmissionTerms) {
        setMessageTone("warning");
        setMessage(
          "You must agree to the Terms of Service, Liability Waiver, and Licensing Agreement before submitting your CSEP."
        );
        return;
      }

      if (!form.trade?.trim() || !form.subTrade?.trim() || form.tasks.length === 0 || form.selected_hazards.length === 0) {
        setMessageTone("warning");
        setMessage(
          "Select a trade, sub-trade, at least one task, and at least one hazard before submitting for review."
        );
        return;
      }

      if (missingProgramSubtypeGroups.length > 0) {
        setMessageTone("warning");
        setMessage(
          `Choose a value for ${missingProgramSubtypeGroups
            .map((group) => group.label.toLowerCase())
            .join(", ")} before submitting your CSEP.`
        );
        return;
      }

      setSubmitLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const selectedTradeItems = displayedTradeItems;

      const submissionFormData = {
        ...form,
        trade: selectedTrade?.tradeLabel ?? form.trade,
        subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
        tradeSummary: selectedTrade?.summary ?? "",
        oshaRefs: selectedTrade?.oshaRefs ?? [],
        tasks: [...form.tasks],
        tradeItems: selectedTradeItems,
        derivedHazards,
        derivedPermits,
        overlapPermitHints,
        common_overlapping_trades: commonOverlappingTrades,
        programSelections,
        program_subtype_selections: form.program_subtype_selections,
        includedContent: {
          project_information:
            form.included_sections.includes("Project Information"),
          contractor_information:
            form.included_sections.includes("Contractor Information"),
          trade_summary: form.included_sections.includes("Trade Summary"),
          scope_of_work: form.included_sections.includes("Scope of Work"),
          site_specific_notes:
            form.included_sections.includes("Site Specific Notes"),
          emergency_procedures:
            form.included_sections.includes("Emergency Procedures"),
          required_ppe: form.included_sections.includes("Required PPE"),
          additional_permits:
            form.included_sections.includes("Additional Permits"),
          common_overlapping_trades:
            form.included_sections.includes("Common Overlapping Trades"),
          osha_references: form.included_sections.includes("OSHA References"),
          selected_hazards:
            form.included_sections.includes("Selected Hazards"),
          activity_hazard_matrix:
            form.included_sections.includes("Activity / Hazard Matrix"),
        },
      };

      const res = await fetch("/api/documents/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_type: "CSEP",
          project_name: form.project_name,
          form_data: {
            ...submissionFormData,
            generationContext: buildCsepGenerationContext(submissionFormData),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit CSEP.");
      }

      setMessageTone("success");
      setMessage("CSEP submitted successfully for admin review.");
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setMessageTone("error");
        setMessage(error.message);
      } else {
        setMessageTone("error");
        setMessage("Failed to submit CSEP.");
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  const workflowSteps = [
    {
      label: "Project Info",
      detail: "Define the job, owner, and contractor context.",
      complete: Boolean(form.project_name && form.contractor_company),
    },
    {
      label: "Trade Setup",
      detail: "Load trade defaults and site-specific content.",
      complete: Boolean(form.trade && form.subTrade && form.tasks.length > 0 && form.scope_of_work),
    },
    {
      label: "Hazards & Controls",
      detail: "Choose hazards, PPE, and permit coverage.",
      complete: form.selected_hazards.length > 0 && missingProgramSubtypeGroups.length === 0,
    },
    {
      label: "Review & Submit",
      detail: "Send the CSEP into the admin review workflow.",
      complete: messageTone === "success" && message.length > 0,
    },
  ];
  const canUseBuilder = Boolean(
    permissionMap?.can_create_documents && permissionMap?.can_edit_documents
  );
  const canSubmitDocuments = Boolean(permissionMap?.can_submit_documents);
  const csepHandoffReady =
    Boolean(form.trade?.trim()) &&
    Boolean(form.subTrade?.trim()) &&
    form.tasks.length > 0 &&
    form.selected_hazards.length > 0 &&
    missingProgramSubtypeGroups.length === 0;

  const checklistFormData = useMemo(
    () => ({
      ...form,
      trade: selectedTrade?.tradeLabel ?? form.trade,
      subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
      tradeItems: displayedTradeItems,
      selected_hazards: form.selected_hazards,
      additional_permits: selectedPermitItems,
      required_ppe: form.required_ppe,
      overlapPermitHints,
      common_overlapping_trades: commonOverlappingTrades,
    }),
    [
      commonOverlappingTrades,
      displayedTradeItems,
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

  return (
    <div className="space-y-6 px-1 py-2 sm:px-2 sm:py-4">
      <div className="mx-auto max-w-7xl">
        <PageHero
          eyebrow="Builder Workspace"
          title="CSEP Builder"
          description="Build a contractor site-specific safety plan with clearer workflow guidance, stronger review readiness, and a more usable long-form workspace."
          actions={
            <>
              <button
                type="button"
                onClick={() => setForm(initialForm)}
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
              >
                Reset Form
              </button>
              <button
                type="button"
                onClick={applyTradeDefaults}
                disabled={!selectedTrade || authLoading || !canUseBuilder}
                className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)] disabled:opacity-50"
              >
                Apply Trade Defaults
              </button>
            </>
          }
        />

        <div className="mt-6">
          <GcRequiredProgramUpload
            permissionMap={permissionMap}
            authLoading={authLoading}
            projectName={form.project_name}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CompanyAiAssistPanel
            surface="csep"
            structuredContext={JSON.stringify({
              trade: selectedTrade?.tradeLabel ?? form.trade,
              subTrade: selectedTrade?.subTradeLabel ?? form.subTrade,
              tasks: form.tasks,
              project_name: form.project_name,
              selected_hazards: form.selected_hazards,
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

        <div className="mt-4">
          <ChecklistCoveragePanel
            title="Checklist Coverage (CSEP)"
            loading={checklistLoading}
            error={checklistError}
            data={checklistEvaluation}
            onRefresh={() => {
              void refreshChecklistEvaluation();
            }}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {!authLoading && !canUseBuilder ? (
              <InlineMessage tone="warning">
                Your current role can review CSEP workflow information, but it cannot create or edit CSEP drafts.
              </InlineMessage>
            ) : null}
            {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
            <fieldset disabled={authLoading || !canUseBuilder} className="space-y-8 disabled:opacity-60">
            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Project Information
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className={inputClassName()}
                  placeholder="Project Name"
                  value={form.project_name}
                  onChange={(e) => updateField("project_name", e.target.value)}
                />
                <input
                  className={inputClassName()}
                  placeholder="Project Number"
                  value={form.project_number}
                  onChange={(e) => updateField("project_number", e.target.value)}
                />
                <input
                  className={`${inputClassName()} md:col-span-2`}
                  placeholder="Project Address"
                  value={form.project_address}
                  onChange={(e) => updateField("project_address", e.target.value)}
                />
                <input
                  className={inputClassName()}
                  placeholder="Owner / Client"
                  value={form.owner_client}
                  onChange={(e) => updateField("owner_client", e.target.value)}
                />
                <input
                  className={inputClassName()}
                  placeholder="GC / CM"
                  value={form.gc_cm}
                  onChange={(e) => updateField("gc_cm", e.target.value)}
                />
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Contractor Information
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className={inputClassName()}
                  placeholder="Contractor Company"
                  value={form.contractor_company}
                  onChange={(e) =>
                    updateField("contractor_company", e.target.value)
                  }
                />
                <input
                  className={inputClassName()}
                  placeholder="Contractor Contact"
                  value={form.contractor_contact}
                  onChange={(e) =>
                    updateField("contractor_contact", e.target.value)
                  }
                />
                <input
                  className={inputClassName()}
                  placeholder="Contractor Phone"
                  value={form.contractor_phone}
                  onChange={(e) =>
                    updateField("contractor_phone", e.target.value)
                  }
                />
                <input
                  className={inputClassName()}
                  placeholder="Contractor Email"
                  value={form.contractor_email}
                  onChange={(e) =>
                    updateField("contractor_email", e.target.value)
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Trade Selection
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Selecting a trade, sub-trade, and task set loads taxonomy-driven hazards,
                    activities, controls, and permit triggers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={applyTradeDefaults}
                  disabled={!selectedTrade}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply Trade PPE / Permits / Hazards
                </button>
              </div>

              <select
                className={inputClassName()}
                value={form.trade}
                onChange={(e) => {
                  const newTrade = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    trade: newTrade,
                    subTrade: "",
                    tasks: [],
                    selected_hazards: [],
                    program_subtype_selections: {},
                  }));
                }}
              >
                <option value="">Select Trade</option>
                {tradeOptions.map((trade) => (
                  <option key={trade} value={trade}>
                    {trade}
                  </option>
                ))}
              </select>

              <select
                className={`${inputClassName()} mt-4`}
                value={form.subTrade}
                disabled={!form.trade}
                onChange={(e) => {
                  const newSubTrade = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    subTrade: newSubTrade,
                    tasks: [],
                    selected_hazards: [],
                    program_subtype_selections: {},
                  }));
                }}
              >
                <option value="">Select Sub-trade</option>
                {(selectedTrade?.availableSubTrades ?? []).map((subTrade) => (
                  <option key={subTrade} value={subTrade}>
                    {subTrade}
                  </option>
                ))}
              </select>

              <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Selectable Tasks
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(selectedTrade?.availableTasks ?? []).length > 0 ? (
                    selectedTrade!.availableTasks.map((task) => (
                      <label
                        key={task}
                        className="flex items-center gap-3 rounded-2xl border border-slate-700/80 px-4 py-3 text-sm text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={form.tasks.includes(task)}
                          onChange={() => toggleArrayValue("tasks", task)}
                        />
                        <span>{task}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-slate-300">
                      Select a sub-trade to load selectable tasks.
                    </p>
                  )}
                </div>
                {(selectedTrade?.referenceTasks?.length ?? 0) > 0 ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Reference-only tasks for this sub-trade: {selectedTrade!.referenceTasks.join(", ")}
                  </p>
                ) : null}
              </div>

              {selectedTrade && (
                <div className="mt-4 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Auto-loaded Trade Summary
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {selectedTrade.summary}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                CSEP Sections to Include
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {csepSectionOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-700/80 px-4 py-3 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={form.included_sections.includes(item)}
                      onChange={() =>
                        toggleArrayValue("included_sections", item)
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Scope and Site Content
              </h2>
              <div className="grid gap-4">
                <textarea
                  className={textareaClassName()}
                  placeholder="Scope of Work"
                  value={form.scope_of_work}
                  onChange={(e) => updateField("scope_of_work", e.target.value)}
                />
                <textarea
                  className={textareaClassName()}
                  placeholder="Site Specific Notes"
                  value={form.site_specific_notes}
                  onChange={(e) =>
                    updateField("site_specific_notes", e.target.value)
                  }
                />
                <textarea
                  className={textareaClassName()}
                  placeholder="Emergency Procedures"
                  value={form.emergency_procedures}
                  onChange={(e) =>
                    updateField("emergency_procedures", e.target.value)
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Required PPE
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ppeOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-700/80 px-4 py-3 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={form.required_ppe.includes(item)}
                      onChange={() => toggleArrayValue("required_ppe", item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Additional Permits
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {permitOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-700/80 px-4 py-3 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={form.additional_permits.includes(item)}
                      onChange={() =>
                        toggleArrayValue("additional_permits", item)
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Hazards to Include in the CSEP
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                {derivedHazards.length ? (
                  derivedHazards.map((hazard) => (
                    <label
                      key={hazard}
                      className="flex items-center gap-3 rounded-2xl border border-slate-700/80 px-4 py-3 text-sm text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={form.selected_hazards.includes(hazard)}
                        onChange={() =>
                          toggleArrayValue("selected_hazards", hazard)
                        }
                      />
                      <span>{hazard}</span>
                    </label>
                  ))
                  ) : (
                    <p className="text-sm text-slate-300">
                      Select a trade, sub-trade, and task to load hazards.
                    </p>
                  )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-100">
                Program Classifications
              </h2>
              <div className="space-y-4">
                {programSelectionState.selections.length ? (
                  missingProgramSubtypeGroups.length > 0 ? (
                    missingProgramSubtypeGroups.map((group) => {
                      const config = getSubtypeConfig(group.group);
                      return (
                        <div
                          key={group.group}
                          className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4"
                        >
                          <div className="text-sm font-semibold text-amber-100">
                            {config.label}
                          </div>
                          <p className="mt-1 text-sm text-amber-50/90">
                            {config.prompt}
                          </p>
                          <select
                            className={`${inputClassName()} mt-3`}
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
                          <div className="mt-3 space-y-2 text-xs text-amber-50/80">
                            {config.options.map((option) => (
                              <p key={option.value}>
                                <span className="font-semibold">{option.label}:</span>{" "}
                                {option.description}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-300">
                      No additional program classifications are required for the current selection set.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-slate-300">
                    Select hazards, permits, or PPE items to reveal any required program classifications.
                  </p>
                )}
              </div>
            </section>

            <div className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Submit for Review
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Submit this CSEP to the admin review queue. The completed document will only be available after admin review is finished.
              </p>

              <div className="mt-4">
                <LegalAcceptanceBlock
                  checked={agreedToSubmissionTerms}
                  onChange={setAgreedToSubmissionTerms}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={
                  submitLoading ||
                  !agreedToSubmissionTerms ||
                  authLoading ||
                  !canSubmitDocuments ||
                  !csepHandoffReady
                }
                className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitLoading ? "Submitting..." : "Submit for Review"}
              </button>

              <button
                type="button"
                onClick={() => setForm(initialForm)}
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-950/50"
              >
                Reset Form
              </button>
            </div>
            </div>
            </fieldset>
          </div>

          <aside className="space-y-6">
            <WorkflowPath
              title="Builder Workflow"
              description="Move from project setup into a clean admin review handoff."
              steps={workflowSteps}
            />

            <SectionCard
              title="Builder Snapshot"
              description="Quick visibility into what is ready inside this CSEP."
            >
              <div className="grid gap-3">
                <SnapshotRow
                  label="Project"
                  value={form.project_name.trim() ? form.project_name : "Not set yet"}
                  missing={!form.project_name.trim()}
                />
                <SnapshotRow
                  label="Trade"
                  value={(selectedTrade?.tradeLabel ?? form.trade) || "No trade selected"}
                  missing={!form.trade}
                />
                <SnapshotRow
                  label="Sub-trade"
                  value={(selectedTrade?.subTradeLabel ?? form.subTrade) || "No sub-trade selected"}
                  missing={!form.subTrade}
                />
                <SnapshotRow
                  label="Tasks"
                  value={form.tasks.length ? `${form.tasks.length} selected` : "None selected"}
                  missing={!form.tasks.length}
                />
                <SnapshotRow
                  label="Hazards"
                  value={
                    form.selected_hazards.length
                      ? `${form.selected_hazards.length} selected`
                      : "None selected"
                  }
                  missing={!form.selected_hazards.length}
                />
                <SnapshotRow
                  label="Programs"
                  value={
                    autoPrograms.length
                      ? `${autoPrograms.length} generated`
                      : "None generated"
                  }
                  missing={!autoPrograms.length}
                />
                <SnapshotRow
                  label="PPE"
                  value={
                    form.required_ppe.length
                      ? `${form.required_ppe.length} selected`
                      : "None selected"
                  }
                />
                <SnapshotRow
                  label="Permits"
                  value={
                    totalPermitCount ? `${totalPermitCount} selected or derived` : "None selected"
                  }
                />
              </div>
            </SectionCard>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Included CSEP Sections
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {form.included_sections.length ? (
                  form.included_sections.map((section) => (
                    <span
                      key={section}
                      className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-300"
                    >
                      {section}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">No sections selected.</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                OSHA References
              </h2>
              <div className="mt-4 space-y-2">
                {selectedTrade ? (
                  selectedTrade.oshaRefs.map((ref) => (
                    <div
                      key={ref}
                      className="rounded-2xl border border-slate-700/80 px-4 py-3 text-sm text-slate-300"
                    >
                      {ref}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">
                    Select a trade, sub-trade, and task to load OSHA references.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Selected Hazards for CSEP
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {form.selected_hazards.length ? (
                  form.selected_hazards.map((hazard) => (
                    <span
                      key={hazard}
                      className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-300"
                    >
                      {hazard}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">
                    No hazards selected for the generated CSEP.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Auto-Generated Safety Programs
              </h2>
              {missingProgramSubtypeGroups.length ? (
                <p className="mt-2 text-sm text-amber-200/90">
                  Classification details are still required before all program pages are finalized.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {autoPrograms.length ? (
                  autoPrograms.map((program) => (
                    <span
                      key={program}
                      className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-300"
                    >
                      {program}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">
                    Select hazards to auto-generate program sections in the CSEP.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Auto-Detected Permits
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {derivedPermits.length ? (
                  derivedPermits.map((permit) => (
                    <span
                      key={permit}
                      className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-300"
                    >
                      {permit}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">
                    Select a trade, sub-trade, and task to load permit triggers.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Common Overlapping Trades (Same Area)
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {commonOverlappingTrades.length ? (
                  commonOverlappingTrades.map((trade) => (
                    <span
                      key={trade}
                      className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-300"
                    >
                      {trade}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">
                    Select a trade scope to infer likely overlapping trades in shared work areas.
                  </p>
                )}
              </div>
              {overlapPermitHints.length ? (
                <p className="mt-3 text-xs text-slate-400">
                  High-risk overlap permit hints: {overlapPermitHints.join(", ")}
                </p>
              ) : null}
            </section>

            <section className="rounded-3xl bg-slate-900/90 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-100">
                Selected Activity / Hazard Matrix
              </h2>
              <div className="mt-4 space-y-3">
                {selectedTrade ? (
                  displayedTradeItems.length > 0 ? (
                    displayedTradeItems.map((item, index) => (
                      <div
                        key={`${item.activity}-${item.hazard}-${index}`}
                        className="rounded-2xl border border-slate-700/80 p-4"
                      >
                        <div className="text-sm font-semibold text-slate-100">
                          {item.activity}
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          <span className="font-semibold">Hazard:</span>{" "}
                          {item.hazard}
                        </div>
                        <div className="text-sm text-slate-300">
                          <span className="font-semibold">Risk:</span> {item.risk}
                        </div>
                        <div className="text-sm text-slate-300">
                          <span className="font-semibold">Controls:</span>{" "}
                          {item.controls.join(", ")}
                        </div>
                        <div className="text-sm text-slate-300">
                          <span className="font-semibold">Permit:</span>{" "}
                          {item.permit}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-300">
                      Select at least one generated hazard to preview the matrix rows that will be sent with this CSEP.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-slate-300">
                    Select a trade, sub-trade, and task to load the activity / hazard matrix.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>

        <div className="sticky bottom-4 z-10 mt-6">
          <div className="rounded-[1.5rem] border border-slate-700/80 bg-slate-900/92 p-5 shadow-[0_18px_36px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  Submission Handoff
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Review the snapshot on the right, then send the CSEP into admin review.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <StatusBadge
                  label={form.trade && form.subTrade ? "Trade scope ready" : "Trade scope needed"}
                  tone={form.trade && form.subTrade ? "success" : "warning"}
                />
                <StatusBadge
                  label={form.tasks.length ? "Tasks selected" : "Tasks needed"}
                  tone={form.tasks.length ? "success" : "warning"}
                />
                <StatusBadge
                  label={
                    form.selected_hazards.length ? "Hazards selected" : "Hazards needed"
                  }
                  tone={form.selected_hazards.length ? "success" : "warning"}
                />
                <StatusBadge
                  label={
                    missingProgramSubtypeGroups.length === 0
                      ? "Program details ready"
                      : "Program details needed"
                  }
                  tone={missingProgramSubtypeGroups.length === 0 ? "success" : "warning"}
                />
                <button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={
                    submitLoading ||
                    !agreedToSubmissionTerms ||
                    authLoading ||
                    !canSubmitDocuments ||
                    !csepHandoffReady
                  }
                  className="inline-flex min-h-[2.5rem] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
                >
                  {submitLoading ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span
        className={`text-right text-sm font-semibold ${
          missing ? "text-amber-200/90" : "text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
