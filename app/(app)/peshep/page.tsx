"use client";

async function downloadDocx(form: unknown) {
  const res = await fetch("/api/pshsep/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });

if (!res.ok) {
  throw new Error("DOCX export failed");
}

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "PSHSEP.docx";
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}

import { useEffect, useMemo, useState } from "react";

type YesNo = boolean;

type Answers = {
  company_name: string;

  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  gc_cm: string;
  project_description: string;

  requires_osha10: YesNo;
  requires_osha30_pm_super_within_5yrs: YesNo;
  requires_osha30_supervisor_on_site: YesNo;
  requires_drug_card_ccs: YesNo;
  requires_codex_access: YesNo;
  requires_training_matrix_monthly: YesNo;

  requires_background_check: YesNo;
  orientation_required: YesNo;
  orientation_pass_score: "70" | "80" | "90";

  permits_selected: string[];

  lift_plans_required: YesNo;
  critical_lift_review_required: YesNo;

  scope_of_work_selected: string[];
};

const LS_KEY = "pshsep_universal_v1";

function yesNoToggle(value: boolean) {
  return value ? "Yes" : "No";
}

function yn(value: boolean) {
  return value ? "Yes" : "No";
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilePart(input: string) {
  return (input || "Document")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function permitYesNo(permits: string[], label: string) {
  return permits.includes(label) ? "Yes" : "No";
}

const TRADE_OPTIONS = [
  "Excavation / Trenching",
  "Concrete / Masonry",
  "Structural Steel",
  "Crane / Rigging",
  "Roofing",
  "Electrical",
  "Demolition",
  "Scaffolds",
  "MEWP / Aerial Lifts",
  "Forklifts / Material Handling",
  "Hot Work",
  "Confined Space",
  "LOTO / Hazardous Energy",
  "Silica-Producing Work",
  "Interior Buildout",
  "Site Logistics / Traffic Control",
];

/**
 * IMPORTANT:
 * Your export API & master.docx placeholders use names like:
 *  - project_location, project_owner, general_contractor, etc.
 * This maps your page Answers -> export payload expected by the API/template.
 */
function buildExportPayload(a: Answers) {
  const osha30 = a.requires_osha30_pm_super_within_5yrs || a.requires_osha30_supervisor_on_site;

  return {
    // Branding / cover
    company_name: a.company_name ?? "",
    document_title: "Project Specific Health & Safety Plan (PSHSEP)",

    // Project fields
    project_name: a.project_name ?? "",
    project_number: a.project_number ?? "",
    project_location: a.project_address ?? "",
    project_owner: a.owner_client ?? "",
    general_contractor: a.gc_cm ?? "",
    construction_manager: "",

    // Document control
    prepared_by: a.company_name ?? "SafetyDocs",
    prepared_date: todayISO(),
    revision_number: "01",

    // Overview (not in your UI yet; leaving blank is fine)
    project_description: a.project_description ?? "",
    construction_type: "",
    estimated_workforce: "",
    project_start_date: "",
    project_completion_date: "",

    // Org (not in your UI yet)
    safety_director: "",
    project_manager: "",
    site_superintendent: "",
    site_safety_manager: "",
    emergency_coordinator: "",

    preconstruction_meeting_date: "",
    risk_assessment_completed: "",

    // Training matrix (template expects strings)
    osha10_required: yn(a.requires_osha10),
    osha30_required: yn(osha30),
    fall_training: "Yes",
    lift_training: "Yes",
    confined_space_training: permitYesNo(a.permits_selected, "Confined Space"),

    // Emergency (not in your UI yet)
    emergency_phone: "",
    hospital_name: "",
    hospital_address: "",
    assembly_point: "",

    // Permit matrix
    permit_hot_work: permitYesNo(a.permits_selected, "Hot Work"),
    permit_excavation: permitYesNo(a.permits_selected, "Groundbreaking/Excavation"),
    permit_loto: permitYesNo(a.permits_selected, "LOTO / Electrical"),
    permit_confined_space: permitYesNo(a.permits_selected, "Confined Space"),

    // Optional table placeholders (we can upgrade later to real loops)
    contractor_table: "",

    // Conditional sections (we will generate real paragraphs later; blank is OK now)
    section_excavation: a.permits_selected.includes("Groundbreaking/Excavation")
      ? "Excavation work is anticipated. Excavations will be planned, protected, and inspected by a competent person in accordance with OSHA 29 CFR 1926 Subpart P. Protective systems (sloping, shoring, or shielding) will be used as required. Access/egress, spoil placement, utility identification, and atmospheric considerations will be controlled."
      : "",
    section_crane_operations: a.permits_selected.includes("Crane / Critical Lift")
      ? "Crane operations / critical lifts may occur. All lifts will follow an approved lift plan where required, include pre-lift meetings, qualified operators, inspected rigging, controlled swing radius, and established exclusion zones. Signal person/communications will be defined before lifting."
      : "",
    section_confined_space: a.permits_selected.includes("Confined Space")
      ? "Confined space entry may occur. Entries will follow a written permit process where required, including atmospheric testing, ventilation, attendant/entry supervisor roles, rescue planning, and continuous monitoring as applicable."
      : "",
    section_hot_work: a.permits_selected.includes("Hot Work")
      ? "Hot work may occur. Hot work will require authorization where applicable, fire watch, removal/protection of combustibles, appropriate extinguishers, and post-work monitoring. Welding/cutting/grinding will follow site-specific requirements and manufacturer instructions."
      : "",
    section_electrical: a.permits_selected.includes("LOTO / Electrical")
      ? "Electrical work may occur. De-energization and lockout/tagout will be used where feasible. Qualified persons will perform electrical tasks; boundaries, arc-flash considerations, and appropriate PPE will be enforced. Energized work requires specific approval where applicable."
      : "",
    section_work_at_heights: a.permits_selected.includes("Work at Height")
      ? "Work at heights may occur. Fall protection will be used in accordance with OSHA requirements, including guardrails, personal fall arrest systems, 100% tie-off where required, and rescue planning. Ladders and elevated platforms will be inspected and used per manufacturer/site rules."
      : "",

    // Appendices placeholders
    appendix_site_map: "",
    appendix_emergency_map: "",
    appendix_inspection_forms: "",
    appendix_training_records: "",
    appendix_permit_forms: "",
    appendix_equipment_logs: "",

    // Keep these so your template doesn't error if you later add them
    requires_background_check: yn(a.requires_background_check),
    orientation_required: yn(a.orientation_required),
    orientation_pass_score: a.orientation_pass_score,
    requires_drug_card_ccs: yn(a.requires_drug_card_ccs),
    requires_codex_access: yn(a.requires_codex_access),
    requires_training_matrix_monthly: yn(a.requires_training_matrix_monthly),
  };
}

export default function PESHEPUniversalPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [siteMap, setSiteMap] = useState<string | null>(null);
  const [aedLocation, setAedLocation] = useState("");
  const [firstAidLocation, setFirstAidLocation] = useState("");
  const [assemblyPoint, setAssemblyPoint] = useState("");
const [nearestHospital, setNearestHospital] = useState("");
const [emergencyContact, setEmergencyContact] = useState("");

  const [a, setA] = useState<Answers>({
    company_name: "SafetyDocs",
    project_name: "",
    project_number: "",
    project_address: "",
    owner_client: "",
    gc_cm: "",
    project_description: "",

    requires_osha10: true,
    requires_osha30_pm_super_within_5yrs: true,
    requires_osha30_supervisor_on_site: true,
    requires_drug_card_ccs: false,
    requires_codex_access: false,
    requires_training_matrix_monthly: true,

    requires_background_check: false,
    orientation_required: true,
    orientation_pass_score: "80",

    permits_selected: [],

    scope_of_work_selected: [],
    
    lift_plans_required: true,
    critical_lift_review_required: true,
  });

  // Load autosave
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setA(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // Autosave
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(a));
    } catch {
      // ignore
    }
  }, [a]);

const steps = useMemo(
  () => [
    { title: "Project Setup" },
    { title: "Compliance Rules" },
    { title: "Site Access" },
    { title: "Scope of Work" },
    { title: "Permits" },
    { title: "Emergency Map & Response Locations" },
    { title: "Export" },
  ],
  []
);
function handleSiteMapUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    setSiteMap(reader.result as string);
  };
  reader.readAsDataURL(file);
}

async function exportDocx() {
  setLoading(true);

  try {
    const payload = {
      ...buildExportPayload(a),
      siteMap,
      aedLocation,
      firstAidLocation,
      assemblyPoint,
      nearestHospital,
      emergencyContact,
    };

    const res = await fetch("/api/pshsep/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const ct = res.headers.get("content-type") || "";
      let detail = "";

      if (ct.includes("application/json")) {
        const j = await res.json().catch(() => null);

        if (j?.details?.length) {
          const lines = j.details
            .map((d: any, i: number) => {
              const tag = d.tag ? `tag=${d.tag}` : "tag=?";
              const msg = d.message || "Template error";
              return `${i + 1}) ${tag} — ${msg}`;
            })
            .join("\n");

          detail = `\n\nDOCX TEMPLATE DETAILS:\n${lines}`;
        } else if (j?.error) {
          detail = `\n\n${j.error}`;
        } else if (j?.message) {
          detail = `\n\n${j.message}`;
        }
      } else {
        const t = await res.text().catch(() => "");
        detail = t ? `\n\n${t.slice(0, 600)}` : "";
      }

      throw new Error(`Export failed (${res.status})${detail}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "Project_Safety_Plan.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    alert(err?.message || "Export failed");
  } finally {
    setLoading(false);
  }
}

  const permitOptions = [
    "Hot Work",
    "Groundbreaking/Excavation",
    "Confined Space",
    "LOTO / Electrical",
    "Work at Height",
    "Crane / Critical Lift",
    "Line Breaking",
  ];

  const scopeOptions = [
  "Scaffolds",
  "MEWP / Aerial Lifts",
  "Forklifts / Material Handling",
  "Excavation",
  "Steel Erection",
  "Concrete",
  "Demolition",
  "Roofing",
  "Electrical",
  "Mechanical",
  "Hot Work",
  "Confined Space",
];

return (
  <div className="space-y-6">
    {/* Header */}
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-black tracking-tight">PESHEP – Universal Builder</div>
          <div className="mt-1 text-sm font-semibold text-black/60">
            Answer Yes/No and dropdowns. Export a finished DOCX.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(LS_KEY);
              location.reload();
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={exportDocx}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-black bg-black px-4 text-sm font-extrabold text-white hover:bg-black/90 disabled:opacity-50"
          >
            {loading ? "Generating DOCX..." : "Export DOCX"}
          </button>
        </div>
      </div>
    </div>

        {/* Crane & Rigging Program */}
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm space-y-4">
      <div className="text-lg font-black tracking-tight">
        Crane, Rigging & Lift Planning Requirements
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-black/70">
          Are lift plans required for crane operations on this project?
        </span>
        <select
          value={a.lift_plans_required ? "yes" : "no"}
          onChange={(e) =>
            setA((prev) => ({
              ...prev,
              lift_plans_required: e.target.value === "yes",
            }))
          }
          className="w-full rounded-xl border border-black/20 bg-white p-2 text-sm"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-black/70">
          Are critical lifts required to be reviewed by GC Safety?
        </span>
        <select
          value={a.critical_lift_review_required ? "yes" : "no"}
          onChange={(e) =>
            setA((prev) => ({
              ...prev,
              critical_lift_review_required: e.target.value === "yes",
            }))
          }
          className="w-full rounded-xl border border-black/20 bg-white p-2 text-sm"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
    </div>
      
      {/* Stepper */}
      <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {steps.map((s, idx) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStep(idx)}
              className={[
                "inline-flex h-9 items-center justify-center rounded-xl border px-4 text-sm font-extrabold whitespace-nowrap",
                idx === step
                  ? "border-black bg-black text-white"
                  : "border-black/15 bg-white text-black hover:bg-black/5",
              ].join(" ")}
            >
              {idx + 1}. {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-5">
            <div className="text-sm font-black">Project Setup</div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Company Name (branding)" value={a.company_name} onChange={(v) => setA({ ...a, company_name: v })} />
              <Field label="Project Name" value={a.project_name} onChange={(v) => setA({ ...a, project_name: v })} />
              <Field label="Project Number" value={a.project_number} onChange={(v) => setA({ ...a, project_number: v })} />
              <Field label="Project Address" value={a.project_address} onChange={(v) => setA({ ...a, project_address: v })} />
              <Field label="Owner / Client" value={a.owner_client} onChange={(v) => setA({ ...a, owner_client: v })} />
              <Field label="GC / CM" value={a.gc_cm} onChange={(v) => setA({ ...a, gc_cm: v })} />
            </div>

            <TextArea
              label="Project Description"
              value={a.project_description}
              onChange={(v) => setA({ ...a, project_description: v })}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="text-sm font-black">Compliance Rules</div>

            <Toggle
              label="OSHA 10 required for all workers"
              value={a.requires_osha10}
              onChange={(v) => setA({ ...a, requires_osha10: v })}
            />
            <Toggle
              label="OSHA 30 required for PM/Superintendent within last 5 years"
              value={a.requires_osha30_pm_super_within_5yrs}
              onChange={(v) => setA({ ...a, requires_osha30_pm_super_within_5yrs: v })}
            />
            <Toggle
              label="Each contractor must have an OSHA 30 supervisor on-site"
              value={a.requires_osha30_supervisor_on_site}
              onChange={(v) => setA({ ...a, requires_osha30_supervisor_on_site: v })}
            />
            <Toggle
              label="Drug card / CCS compliance required"
              value={a.requires_drug_card_ccs}
              onChange={(v) => setA({ ...a, requires_drug_card_ccs: v })}
            />
            <Toggle
              label="CODEX approval required for site access"
              value={a.requires_codex_access}
              onChange={(v) => setA({ ...a, requires_codex_access: v })}
            />
            <Toggle
              label="Training matrix required and updated monthly"
              value={a.requires_training_matrix_monthly}
              onChange={(v) => setA({ ...a, requires_training_matrix_monthly: v })}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="text-sm font-black">Site Access</div>

            <Toggle
              label="Background check required"
              value={a.requires_background_check}
              onChange={(v) => setA({ ...a, requires_background_check: v })}
            />
            <Toggle
              label="Orientation required"
              value={a.orientation_required}
              onChange={(v) => setA({ ...a, orientation_required: v })}
            />

            {a.orientation_required && (
              <Select
                label="Orientation quiz passing score"
                value={a.orientation_pass_score}
                options={[
                  { value: "70", label: "70%" },
                  { value: "80", label: "80%" },
                  { value: "90", label: "90%" },
                ]}
                onChange={(v) => setA({ ...a, orientation_pass_score: v as Answers["orientation_pass_score"] })}
              />
            )}
          </div>
        )}
{/* Scope of Work */}
{step === 3 && (
  <div className="space-y-5">
    <div className="text-sm font-black">Scope of Work</div>

    <div className="text-sm font-semibold text-black/60">
      Select work activities included in this project.
    </div>

    <div className="grid gap-2 md:grid-cols-2">
      {scopeOptions.map((opt) => {
        const checked = a.scope_of_work_selected.includes(opt);

        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = checked
                ? a.scope_of_work_selected.filter((x) => x !== opt)
                : [...a.scope_of_work_selected, opt];

              setA({ ...a, scope_of_work_selected: next });
            }}
            className={[
              "flex items-center justify-between rounded-2xl border px-4 py-3 text-left",
              checked
                ? "border-black bg-black text-white"
                : "border-black/15 bg-white hover:bg-black/5",
            ].join(" ")}
          >
            <div className="text-sm font-extrabold">{opt}</div>

            <div className="text-xs font-bold opacity-80">
              {checked ? "Selected" : "Select"}
            </div>
          </button>
        );
      })}
    </div>
  </div>
)}

{/* Permits */}
{step === 4 && (
  <div className="space-y-5">
    <div className="text-sm font-black">Permits</div>

    <div className="text-sm font-semibold text-black/60">
      Select applicable permit types. These will appear in the generated DOCX.
    </div>

    <div className="grid gap-2 md:grid-cols-2">
      {permitOptions.map((opt) => {
        const checked = a.permits_selected.includes(opt);

        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = checked
                ? a.permits_selected.filter((x) => x !== opt)
                : [...a.permits_selected, opt];

              setA({ ...a, permits_selected: next });
            }}
            className={[
              "flex items-center justify-between rounded-2xl border px-4 py-3 text-left",
              checked
                ? "border-black bg-black text-white"
                : "border-black/15 bg-white hover:bg-black/5",
            ].join(" ")}
          >
            <div className="text-sm font-extrabold">{opt}</div>

            <div className="text-xs font-bold opacity-80">
              {checked ? "Selected" : "Select"}
            </div>
          </button>
        );
      })}
    </div>
  </div>
)}

{/* Emergency Map & Response Locations */}
{step === 5 && (
  <div className="space-y-5">
    <div className="text-sm font-black">Emergency Map & Response Locations</div>

    <div className="text-sm font-semibold text-black/60">
      Add emergency response locations and upload the project emergency map.
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label="AED Location"
        value={aedLocation}
        onChange={(v) => setAedLocation(v)}
      />

      <Field
        label="First Aid Kit Location"
        value={firstAidLocation}
        onChange={(v) => setFirstAidLocation(v)}
      />

      <Field
        label="Assembly / Muster Point"
        value={assemblyPoint}
        onChange={(v) => setAssemblyPoint(v)}
      />

      <Field
        label="Nearest Hospital"
        value={nearestHospital}
        onChange={(v) => setNearestHospital(v)}
      />

      <Field
        label="Emergency Contact Number"
        value={emergencyContact}
        onChange={(v) => setEmergencyContact(v)}
      />
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-bold">Emergency Map Upload</label>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onloadend = () => setSiteMap(reader.result as string);
          reader.readAsDataURL(file);
        }}
        className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm"
      />
    </div>

    {siteMap && (
      <div className="space-y-2">
        <div className="text-sm font-bold">Map Preview</div>
        <img
          src={siteMap}
          alt="Emergency map preview"
          className="max-h-96 rounded-2xl border border-black/15"
        />
      </div>
    )}
  </div>
)}

        {step === 6 && (
          <div className="space-y-5">
            <div className="text-sm font-black">Export</div>
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="text-sm font-extrabold">Ready to generate</div>
              <div className="mt-1 text-sm font-semibold text-black/60">
                This exports a DOCX using your answers and conditional blocks. You can refine the wording blocks over time.
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportDocx}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-black bg-black px-4 text-sm font-extrabold text-white hover:bg-black/90 disabled:opacity-50"
                >
                  {loading ? "Generating DOCX..." : "Export DOCX"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5"
                >
                  Back to Project Setup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-black/15 bg-white px-4 text-sm font-extrabold hover:bg-black/5"
        >
          Back
        </button>

        <button
          type="button"
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-black bg-black px-4 text-sm font-extrabold text-white hover:bg-black/90"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-black text-black/60">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-2xl border border-black/15 bg-white px-4 text-sm font-bold text-black outline-none focus:border-black"
        placeholder=""
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-black text-black/60">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm font-bold text-black outline-none focus:border-black"
      />
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3">
      <div className="text-sm font-extrabold">{label}</div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={[
          "inline-flex h-9 items-center justify-center rounded-xl border px-4 text-sm font-extrabold whitespace-nowrap",
          value ? "border-black bg-black text-white" : "border-black/15 bg-white hover:bg-black/5",
        ].join(" ")}
      >
        {yesNoToggle(value)}
      </button>
    </div>
  );
}

function Select({
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
      <div className="mb-1 text-xs font-black text-black/60">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-2xl border border-black/15 bg-white px-4 text-sm font-extrabold outline-none focus:border-black"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}