"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LegalAcceptanceBlock } from "@/components/LegalAcceptanceBlock";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  WorkflowPath,
} from "@/components/WorkspacePrimitives";
import { GcRequiredProgramUpload } from "@/components/csep/GcRequiredProgramUpload";
import type { PermissionMap } from "@/lib/rbac";

type RiskLevel = "Low" | "Medium" | "High";

type CSEPRiskItem = {
  activity: string;
  hazard: string;
  risk: RiskLevel;
  controls: string[];
  permit: string;
};

type CSEPTradeLibraryItem = {
  trade: string;
  sectionTitle: string;
  summary: string;
  oshaRefs: string[];
  defaultPPE: string[];
  items: CSEPRiskItem[];
};

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
  scope_of_work: string;
  site_specific_notes: string;
  emergency_procedures: string;

  required_ppe: string[];
  additional_permits: string[];
  selected_hazards: string[];
  included_sections: string[];
};

const tradeOptions = [
  "Survey / Layout",
  "Demolition",
  "Earthwork",
  "Excavation / Utilities",
  "Concrete",
  "Roofing",
  "Electrical",
  "Mechanical / HVAC",
  "Plumbing",
  "Low Voltage",
  "Elevator",
  "Fire Protection",
  "Landscaping",
  "Asphalt / Paving",
  "Traffic Control",
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
  scope_of_work: "",
  site_specific_notes: "",
  emergency_procedures: "",

  required_ppe: [],
  additional_permits: [],
  selected_hazards: [],
  included_sections: [...csepSectionOptions],
};

const BASE_ITEMS: CSEPRiskItem[] = [
  {
    activity: "General work access",
    hazard: "Slips trips falls",
    risk: "High",
    controls: ["Housekeeping", "Maintain clear access", "Anti-slip footwear"],
    permit: "None",
  },
  {
    activity: "Material handling",
    hazard: "Struck by equipment",
    risk: "High",
    controls: ["Spotters", "Equipment alarms", "Exclusion zones"],
    permit: "Motion Permit",
  },
  {
    activity: "Elevated task work",
    hazard: "Falls from height",
    risk: "High",
    controls: ["Guardrails", "PFAS", "Pre-task planning"],
    permit: "Ladder Permit",
  },
  {
    activity: "Temporary power / tools",
    hazard: "Electrical shock",
    risk: "High",
    controls: ["LOTO", "GFCI protection", "Inspect cords and tools"],
    permit: "LOTO Permit",
  },
  {
    activity: "Spark-producing work",
    hazard: "Hot work / fire",
    risk: "Medium",
    controls: ["Fire watch", "Extinguishers", "Remove combustibles"],
    permit: "Hot Work Permit",
  },
  {
    activity: "Overhead work",
    hazard: "Falling objects",
    risk: "High",
    controls: ["Toe boards", "Barricades", "Overhead protection"],
    permit: "Gravity Permit",
  },
  {
    activity: "Lifting support",
    hazard: "Crane lift hazards",
    risk: "Medium",
    controls: ["Lift plans", "Signal persons", "Tag lines"],
    permit: "Motion Permit",
  },
  {
    activity: "Portable access",
    hazard: "Ladder misuse",
    risk: "Medium",
    controls: ["Ladder inspections", "Proper setup", "3 points of contact"],
    permit: "Ladder Permit",
  },
  {
    activity: "Entry support",
    hazard: "Confined spaces",
    risk: "Medium",
    controls: ["Air monitoring", "Entry review", "Rescue planning"],
    permit: "Confined Space Permit",
  },
  {
    activity: "Chemical use",
    hazard: "Chemical exposure",
    risk: "Medium",
    controls: ["PPE", "SDS review", "Proper storage"],
    permit: "Chemical Permit",
  },
];

const TRADE_SUMMARIES: Record<string, string> = {
  "Survey / Layout":
    "Survey and layout activities expose workers to changing site conditions, uneven terrain, nearby equipment movement, overhead hazards, and utility-related hazards.",
  Demolition:
    "Demolition activities expose workers to unstable materials, debris handling, heavy equipment interaction, electrical energy, dust generation, and falling object hazards.",
  Earthwork:
    "Earthwork operations involve active equipment movement, unstable terrain, grading, compaction, hauling, and changing site conditions.",
  "Excavation / Utilities":
    "Excavation and utility work exposes workers to trench hazards, underground utility strikes, equipment interaction, and changing soil conditions.",
  Concrete:
    "Concrete work involves formwork, placement, finishing, equipment interaction, wet surfaces, manual handling, and elevated work exposures.",
  Roofing:
    "Roofing operations involve leading-edge work, falls from height, material handling, weather exposure, hot work, and falling object hazards.",
  Electrical:
    "Electrical work exposes workers to energized systems, temporary power, overhead work, tool use, access equipment, and coordination with other active trades.",
  "Mechanical / HVAC":
    "Mechanical and HVAC work involves material handling, duct and equipment installation, energized systems, elevated work, and active construction coordination.",
  Plumbing:
    "Plumbing work involves piping installation, overhead work, equipment interaction, energized systems, confined areas, and hot work exposure.",
  "Low Voltage":
    "Low voltage work includes data and security system installation, access equipment use, energized tie-ins, and overhead work in active spaces.",
  Elevator:
    "Elevator work involves shaft access, heavy material movement, energized systems, overhead installation, and falling object hazards.",
  "Fire Protection":
    "Fire protection work includes sprinkler and standpipe installation, system tie-ins, testing, elevated work, and coordination with other systems.",
  Landscaping:
    "Landscaping work includes grading, irrigation, planting, hardscape work, equipment use, and frequent exposure to changing weather and site traffic.",
  "Asphalt / Paving":
    "Asphalt and paving work involves heavy equipment, haul routes, compaction, hot materials, live traffic interface, and manual handling exposure.",
  "Traffic Control":
    "Traffic control work involves active vehicle exposure, barricade installation, lane closures, signage work, and struck-by risk around public and site traffic.",
};

const TRADE_OSHA_REFS: Record<string, string[]> = {
  "Survey / Layout": [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  Demolition: [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  Earthwork: [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart P – Excavations",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  "Excavation / Utilities": [
    "OSHA 1926 Subpart P – Excavations",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart E – PPE",
  ],
  Concrete: [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart M – Fall Protection",
    "OSHA 1926 Subpart L – Scaffolding",
  ],
  Roofing: [
    "OSHA 1926 Subpart M – Fall Protection",
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart L – Scaffolding",
  ],
  Electrical: [
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  "Mechanical / HVAC": [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  Plumbing: [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  "Low Voltage": [
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  Elevator: [
    "OSHA 1926 Subpart M – Fall Protection",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart E – PPE",
  ],
  "Fire Protection": [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  Landscaping: [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart K – Electrical",
    "OSHA 1926 Subpart M – Fall Protection",
  ],
  "Asphalt / Paving": [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart M – Fall Protection",
    "OSHA 1926 Subpart K – Electrical",
  ],
  "Traffic Control": [
    "OSHA 1926 Subpart E – PPE",
    "OSHA 1926 Subpart M – Fall Protection",
    "OSHA 1926 Subpart K – Electrical",
  ],
};

const TRADE_PPE: Record<string, string[]> = {
  "Survey / Layout": [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
  ],
  Demolition: [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
    "Hearing Protection",
    "Respiratory Protection",
  ],
  Earthwork: [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
  ],
  "Excavation / Utilities": [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
  ],
  Concrete: [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
    "Face Shield",
  ],
  Roofing: [
    "Hard Hat",
    "Safety Glasses",
    "Gloves",
    "Steel Toe Boots",
    "Fall Protection Harness",
  ],
  Electrical: [
    "Hard Hat",
    "Safety Glasses",
    "Gloves",
    "Steel Toe Boots",
    "Face Shield",
  ],
  "Mechanical / HVAC": [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
    "Hearing Protection",
  ],
  Plumbing: ["Hard Hat", "Safety Glasses", "Gloves", "Steel Toe Boots"],
  "Low Voltage": ["Hard Hat", "Safety Glasses", "Gloves", "Steel Toe Boots"],
  Elevator: [
    "Hard Hat",
    "Safety Glasses",
    "Gloves",
    "Steel Toe Boots",
    "Fall Protection Harness",
  ],
  "Fire Protection": ["Hard Hat", "Safety Glasses", "Gloves", "Steel Toe Boots"],
  Landscaping: [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
  ],
  "Asphalt / Paving": [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
  ],
  "Traffic Control": [
    "Hard Hat",
    "Safety Glasses",
    "High Visibility Vest",
    "Gloves",
    "Steel Toe Boots",
  ],
};

function buildTradeLibraryItem(trade: string): CSEPTradeLibraryItem {
  return {
    trade,
    sectionTitle: `Site-Specific Safety Requirements – ${trade}`,
    summary:
      TRADE_SUMMARIES[trade] ??
      "Trade-specific work exposes workers to changing site conditions, equipment interaction, access challenges, and task-specific hazards that must be managed through planning and controls.",
    oshaRefs: TRADE_OSHA_REFS[trade] ?? ["OSHA 1926 Subpart E – PPE"],
    defaultPPE: TRADE_PPE[trade] ?? [
      "Hard Hat",
      "Safety Glasses",
      "Gloves",
      "Steel Toe Boots",
    ],
    items: BASE_ITEMS,
  };
}

function inputClassName() {
  return "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500";
}

function textareaClassName() {
  return "min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500";
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
    return buildTradeLibraryItem(form.trade);
  }, [form.trade]);

  const derivedPermits = useMemo(() => {
    if (!selectedTrade) return [];
    return Array.from(
      new Set(
        selectedTrade.items
          .map((item) => item.permit)
          .filter((permit) => permit && permit !== "None")
      )
    );
  }, [selectedTrade]);

  const derivedHazards = useMemo(() => {
    if (!selectedTrade) return [];
    return Array.from(new Set(selectedTrade.items.map((item) => item.hazard)));
  }, [selectedTrade]);

  function updateField<K extends keyof CSEPForm>(field: K, value: CSEPForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleArrayValue(
    field:
      | "required_ppe"
      | "additional_permits"
      | "selected_hazards"
      | "included_sections",
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

      setSubmitLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const selectedTradeItems =
        selectedTrade?.items.filter((item) =>
          form.selected_hazards.includes(item.hazard)
        ) ?? [];

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
            ...form,
            tradeSummary: selectedTrade?.summary ?? "",
            oshaRefs: selectedTrade?.oshaRefs ?? [],
            tradeItems: selectedTradeItems,
            derivedHazards,
            derivedPermits,
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
              osha_references: form.included_sections.includes("OSHA References"),
              selected_hazards:
                form.included_sections.includes("Selected Hazards"),
              activity_hazard_matrix:
                form.included_sections.includes("Activity / Hazard Matrix"),
            },
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

  const autoPrograms = [
    form.selected_hazards.includes("Falls from height")
      ? "Fall Protection Program"
      : null,
    form.selected_hazards.includes("Electrical shock")
      ? "Electrical Safety Program"
      : null,
    form.selected_hazards.includes("Hot work / fire")
      ? "Hot Work Program"
      : null,
    form.selected_hazards.includes("Struck by equipment")
      ? "Struck-By / Equipment Safety"
      : null,
    form.selected_hazards.includes("Ladder misuse")
      ? "Ladder Safety Program"
      : null,
    form.selected_hazards.includes("Confined spaces")
      ? "Confined Space Program"
      : null,
    form.selected_hazards.includes("Chemical exposure")
      ? "Hazard Communication Program"
      : null,
    form.selected_hazards.includes("Falling objects")
      ? "Falling Object Safety Program"
      : null,
    form.selected_hazards.includes("Crane lift hazards")
      ? "Crane / Rigging Safety Program"
      : null,
    form.selected_hazards.includes("Slips trips falls")
      ? "Housekeeping / STF Program"
      : null,
  ].filter(Boolean) as string[];

  const workflowSteps = [
    {
      label: "Project Info",
      detail: "Define the job, owner, and contractor context.",
      complete: Boolean(form.project_name && form.contractor_company),
    },
    {
      label: "Trade Setup",
      detail: "Load trade defaults and site-specific content.",
      complete: Boolean(form.trade && form.scope_of_work),
    },
    {
      label: "Hazards & Controls",
      detail: "Choose hazards, PPE, and permit coverage.",
      complete: form.selected_hazards.length > 0,
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
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
          <GcRequiredProgramUpload permissionMap={permissionMap} authLoading={authLoading} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {!authLoading && !canUseBuilder ? (
              <InlineMessage tone="warning">
                Your current role can review CSEP workflow information, but it cannot create or edit CSEP drafts.
              </InlineMessage>
            ) : null}
            {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
            <fieldset disabled={authLoading || !canUseBuilder} className="space-y-6 disabled:opacity-60">
            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
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

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
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

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Trade Selection
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Selecting a trade loads that trade’s default hazards,
                    activities, controls, and permit triggers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={applyTradeDefaults}
                  disabled={!selectedTrade}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    selected_hazards: [],
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

              {selectedTrade && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Auto-loaded Trade Summary
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    {selectedTrade.summary}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                CSEP Sections to Include
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {csepSectionOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
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

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
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

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Required PPE
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ppeOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
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

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Additional Permits
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {permitOptions.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
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

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Hazards to Include in the CSEP
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                {derivedHazards.length ? (
                  derivedHazards.map((hazard) => (
                    <label
                      key={hazard}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
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
                  <p className="text-sm text-slate-500">
                    Select a trade to load hazards.
                  </p>
                )}
              </div>
            </section>

            <div className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Submit for Review
              </h2>
              <p className="mt-2 text-sm text-slate-600">
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
                disabled={submitLoading || !agreedToSubmissionTerms || authLoading || !canSubmitDocuments}
                className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                {submitLoading ? "Submitting..." : "Submit for Review"}
              </button>

              <button
                type="button"
                onClick={() => setForm(initialForm)}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                <SnapshotRow label="Project" value={form.project_name || "Not set yet"} />
                <SnapshotRow label="Trade" value={form.trade || "No trade selected"} />
                <SnapshotRow
                  label="Hazards"
                  value={
                    form.selected_hazards.length
                      ? `${form.selected_hazards.length} selected`
                      : "None selected"
                  }
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
                    form.additional_permits.length
                      ? `${form.additional_permits.length} selected`
                      : "None selected"
                  }
                />
              </div>
            </SectionCard>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Included CSEP Sections
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {form.included_sections.length ? (
                  form.included_sections.map((section) => (
                    <span
                      key={section}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {section}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No sections selected.</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                OSHA References
              </h2>
              <div className="mt-4 space-y-2">
                {selectedTrade ? (
                  selectedTrade.oshaRefs.map((ref) => (
                    <div
                      key={ref}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                    >
                      {ref}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load OSHA references.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Selected Hazards for CSEP
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {form.selected_hazards.length ? (
                  form.selected_hazards.map((hazard) => (
                    <span
                      key={hazard}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {hazard}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No hazards selected for the generated CSEP.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Auto-Generated Safety Programs
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {autoPrograms.length ? (
                  autoPrograms.map((program) => (
                    <span
                      key={program}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {program}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select hazards to auto-generate program sections in the CSEP.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Auto-Detected Permits
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {derivedPermits.length ? (
                  derivedPermits.map((permit) => (
                    <span
                      key={permit}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {permit}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load permits.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Selected Activity / Hazard Matrix
              </h2>
              <div className="mt-4 space-y-3">
                {selectedTrade ? (
                  selectedTrade.items
                    .filter((item) => form.selected_hazards.includes(item.hazard))
                    .map((item, index) => (
                      <div
                        key={`${item.activity}-${item.hazard}-${index}`}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {item.activity}
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          <span className="font-semibold">Hazard:</span>{" "}
                          {item.hazard}
                        </div>
                        <div className="text-sm text-slate-700">
                          <span className="font-semibold">Risk:</span> {item.risk}
                        </div>
                        <div className="text-sm text-slate-700">
                          <span className="font-semibold">Controls:</span>{" "}
                          {item.controls.join(", ")}
                        </div>
                        <div className="text-sm text-slate-700">
                          <span className="font-semibold">Permit:</span>{" "}
                          {item.permit}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a trade to load the activity / hazard matrix.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>

        <div className="sticky bottom-4 z-10 mt-6">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_18px_36px_rgba(148,163,184,0.18)] backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Submission Handoff
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Review the snapshot on the right, then send the CSEP into admin review.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={form.trade ? "Trade ready" : "Trade needed"}
                  tone={form.trade ? "success" : "warning"}
                />
                <StatusBadge
                  label={
                    form.selected_hazards.length ? "Hazards selected" : "Hazards needed"
                  }
                  tone={form.selected_hazards.length ? "success" : "warning"}
                />
                <button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={submitLoading || !agreedToSubmissionTerms || authLoading || !canSubmitDocuments}
                  className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)] disabled:opacity-50"
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

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
