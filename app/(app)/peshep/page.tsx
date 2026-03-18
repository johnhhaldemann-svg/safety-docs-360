"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PESHEPUniversalPage() {

  const [step, setStep] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [siteMap, setSiteMap] = useState<string>("");
  const [aedLocation, setAedLocation] = useState("");
  const [firstAidLocation, setFirstAidLocation] = useState("");
  const [assemblyPoint, setAssemblyPoint] = useState("");
  const [nearestHospital, setNearestHospital] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [userId, setUserId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

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
      }
    } catch (error) {
      console.error("Unexpected auth error:", error);
    } finally {
      setAuthLoading(false);
    }
  }

  loadUser();
}, []);

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
    { title: "Export & Submit" },
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

async function handleSubmitForReview() {
  try {
    if (authLoading) {
      alert("Still loading your account. Please wait one second and try again.");
      return;
    }

    if (!userId) {
      alert("No logged-in user found. Please log in again.");
      return;
    }

    setSubmitLoading(true);

    const res = await fetch("/api/documents/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        document_type: "PSHSEP",
        project_name: a.project_name,
        form_data: a,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to submit document.");
      return;
    }

    alert("PSHSEP submitted successfully.");
  } catch (error) {
    console.error("Submit error:", error);
    alert("Something went wrong.");
  } finally {
    setSubmitLoading(false);
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
      <div className="text-xl font-black tracking-tight">
        PESHEP - Universal Builder
      </div>
      <div className="mt-1 text-sm font-semibold text-black/60">
        Answer Yes/No and dropdowns. Submit for review.
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
        label="Muster Point"
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
        onChange={handleSiteMapUpload}
        className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm"
      />
    </div>

    {siteMap && (
      <div className="space-y-2">
        <div className="text-sm font-bold">Map Preview</div>
        <Image
          src={siteMap}
          alt="Emergency map preview"
          width={1200}
          height={900}
          unoptimized
          className="max-h-96 w-auto rounded-2xl border border-black/15"
        />
      </div>
    )}
  </div>
)}

{step === 6 && (
  <div className="space-y-5">
    <div className="text-sm font-black">Submit for Review</div>

    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-sm font-extrabold">Ready to submit</div>
      <div className="mt-1 text-sm font-semibold text-black/60">
        Submit your PESHEP to the admin review queue. The final document will only be available after admin review is complete.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
<button
  type="button"
  onClick={handleSubmitForReview}
  disabled={submitLoading}
  className="inline-flex h-10 items-center justify-center rounded-xl border border-green-700 bg-green-600 px-4 text-sm font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
>
  {submitLoading ? "Submitting..." : "Submit for Review"}
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

