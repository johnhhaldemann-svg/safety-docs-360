"use client";

import Image from "next/image";
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
import type { PermissionMap } from "@/lib/rbac";

type Answers = {
  company_name: string;
  project_name: string;
  project_number: string;
  project_address: string;
  owner_client: string;
  gc_cm: string;
  project_description: string;
  requires_osha10: boolean;
  requires_osha30_pm_super_within_5yrs: boolean;
  requires_osha30_supervisor_on_site: boolean;
  requires_drug_card_ccs: boolean;
  requires_codex_access: boolean;
  requires_training_matrix_monthly: boolean;
  requires_background_check: boolean;
  orientation_required: boolean;
  orientation_pass_score: "70" | "80" | "90";
  permits_selected: string[];
  lift_plans_required: boolean;
  critical_lift_review_required: boolean;
  scope_of_work_selected: string[];
};

const LS_KEY = "pshsep_universal_v1";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const steps = [
  { title: "Project Setup", detail: "Core project and client information." },
  { title: "Compliance Rules", detail: "Training and lift-planning requirements." },
  { title: "Site Access", detail: "Orientation and background-check controls." },
  { title: "Scope of Work", detail: "Select the work covered by this plan." },
  { title: "Permits", detail: "Choose permits that belong in the final plan." },
  { title: "Emergency Map", detail: "Store response locations and a map preview." },
  { title: "Submit", detail: "Review readiness and send to admin review." },
];

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

const initialAnswers: Answers = {
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
  lift_plans_required: true,
  critical_lift_review_required: true,
  scope_of_work_selected: [],
};

function toggleItem(values: string[], item: string) {
  return values.includes(item)
    ? values.filter((current) => current !== item)
    : [...values, item];
}

export default function PESHEPUniversalPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [siteMap, setSiteMap] = useState("");
  const [aedLocation, setAedLocation] = useState("");
  const [firstAidLocation, setFirstAidLocation] = useState("");
  const [assemblyPoint, setAssemblyPoint] = useState("");
  const [nearestHospital, setNearestHospital] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [agreedToSubmissionTerms, setAgreedToSubmissionTerms] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [permissionMap, setPermissionMap] = useState<PermissionMap | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");

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
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setAnswers(JSON.parse(raw));
    } catch {
      // Ignore saved-state errors.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(answers));
    } catch {
      // Ignore saved-state errors.
    }
  }, [answers]);

  const readyCount = useMemo(() => {
    const checks = [
      answers.project_name,
      answers.project_number,
      answers.project_address,
      answers.owner_client,
      answers.gc_cm,
      answers.scope_of_work_selected.length > 0 ? "yes" : "",
      answers.permits_selected.length > 0 ? "yes" : "",
      aedLocation,
      assemblyPoint,
    ];
    return checks.filter(Boolean).length;
  }, [answers, aedLocation, assemblyPoint]);

  const readinessItems = [
    { label: "Project details entered", done: Boolean(answers.project_name && answers.project_number) },
    { label: "Scope selected", done: answers.scope_of_work_selected.length > 0 },
    { label: "Permits reviewed", done: answers.permits_selected.length > 0 },
    { label: "Emergency info entered", done: Boolean(aedLocation && assemblyPoint) },
    { label: "Submission agreement accepted", done: agreedToSubmissionTerms },
  ];
  const canUseBuilder = Boolean(
    permissionMap?.can_create_documents && permissionMap?.can_edit_documents
  );
  const canSubmitDocuments = Boolean(permissionMap?.can_submit_documents);

  function resetDraft() {
    localStorage.removeItem(LS_KEY);
    setAnswers(initialAnswers);
    setSiteMap("");
    setAedLocation("");
    setFirstAidLocation("");
    setAssemblyPoint("");
    setNearestHospital("");
    setEmergencyContact("");
    setAgreedToSubmissionTerms(false);
    setMessage("");
    setStep(0);
  }

  function updateField<K extends keyof Answers>(field: K, value: Answers[K]) {
    setAnswers((current) => ({ ...current, [field]: value }));
  }

  function handleSiteMapUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setSiteMap(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmitForReview() {
    try {
      setMessage("");
      if (!permissionMap?.can_submit_documents) {
        setMessageTone("warning");
        setMessage("Your current role cannot submit PESHEP records into review.");
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

      setSubmitLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please log in again.");

      const res = await fetch("/api/documents/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_type: "PSHSEP",
          project_name: answers.project_name,
          form_data: {
            ...answers,
            emergency_map: {
              aed_location: aedLocation,
              first_aid_location: firstAidLocation,
              assembly_point: assemblyPoint,
              nearest_hospital: nearestHospital,
              emergency_contact: emergencyContact,
              site_map: siteMap,
            },
          },
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Failed to submit document.");

      setMessageTone("success");
      setMessage("PESHEP submitted successfully and moved into the admin review queue.");
      setStep(6);
    } catch (error) {
      console.error("Submit error:", error);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Builder Workspace"
        title="PESHEP Builder"
        description="Create a project safety and health execution plan with a cleaner step flow, better mobile controls, and a clearer review handoff."
        actions={
          <>
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset Draft
            </button>
            <button
              type="button"
              onClick={() => setStep(6)}
              className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
            >
              Jump to Submit
            </button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_340px]">
        <div className="space-y-5">
          <SectionCard
            title={`Step ${step + 1}: ${steps[step].title}`}
            description={steps[step].detail}
            aside={<StatusBadge label={`${readyCount}/9 ready`} tone={readyCount >= 7 ? "success" : "info"} />}
          >
            {!authLoading && !canUseBuilder ? (
              <div className="mb-4">
                <InlineMessage tone="warning">
                  Your current role can view builder progress, but it cannot create or edit PESHEP drafts.
                </InlineMessage>
              </div>
            ) : null}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`min-w-[156px] rounded-2xl border px-4 py-3 text-left transition ${
                    index === step
                      ? "border-sky-200 bg-sky-50 text-slate-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em]">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{item.title}</div>
                </button>
              ))}
            </div>

            {message ? (
              <div className="mt-4">
                <InlineMessage tone={messageTone}>{message}</InlineMessage>
              </div>
            ) : null}

            <fieldset
              disabled={authLoading || !canUseBuilder}
              className="mt-6 space-y-5 disabled:opacity-60"
            >
              {step === 0 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Company Name (branding)" value={answers.company_name} onChange={(value) => updateField("company_name", value)} />
                    <Field label="Project Name" value={answers.project_name} onChange={(value) => updateField("project_name", value)} />
                    <Field label="Project Number" value={answers.project_number} onChange={(value) => updateField("project_number", value)} />
                    <Field label="Project Address" value={answers.project_address} onChange={(value) => updateField("project_address", value)} />
                    <Field label="Owner / Client" value={answers.owner_client} onChange={(value) => updateField("owner_client", value)} />
                    <Field label="GC / CM" value={answers.gc_cm} onChange={(value) => updateField("gc_cm", value)} />
                  </div>
                  <TextArea label="Project Description" value={answers.project_description} onChange={(value) => updateField("project_description", value)} />
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Toggle label="OSHA 10 required for all workers" value={answers.requires_osha10} onChange={(value) => updateField("requires_osha10", value)} />
                  <Toggle label="OSHA 30 required for PM/Superintendent within last 5 years" value={answers.requires_osha30_pm_super_within_5yrs} onChange={(value) => updateField("requires_osha30_pm_super_within_5yrs", value)} />
                  <Toggle label="Each contractor must have an OSHA 30 supervisor on-site" value={answers.requires_osha30_supervisor_on_site} onChange={(value) => updateField("requires_osha30_supervisor_on_site", value)} />
                  <Toggle label="Drug card / CCS compliance required" value={answers.requires_drug_card_ccs} onChange={(value) => updateField("requires_drug_card_ccs", value)} />
                  <Toggle label="CODEX approval required for site access" value={answers.requires_codex_access} onChange={(value) => updateField("requires_codex_access", value)} />
                  <Toggle label="Training matrix required and updated monthly" value={answers.requires_training_matrix_monthly} onChange={(value) => updateField("requires_training_matrix_monthly", value)} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Toggle label="Lift plans required for crane operations" value={answers.lift_plans_required} onChange={(value) => updateField("lift_plans_required", value)} />
                    <Toggle label="Critical lifts reviewed by GC safety" value={answers.critical_lift_review_required} onChange={(value) => updateField("critical_lift_review_required", value)} />
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
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
                </>
              ) : null}

              {step === 3 ? (
                <SelectionGrid
                  values={answers.scope_of_work_selected}
                  options={scopeOptions}
                  onToggle={(item) =>
                    updateField("scope_of_work_selected", toggleItem(answers.scope_of_work_selected, item))
                  }
                />
              ) : null}

              {step === 4 ? (
                <SelectionGrid
                  values={answers.permits_selected}
                  options={permitOptions}
                  onToggle={(item) =>
                    updateField("permits_selected", toggleItem(answers.permits_selected, item))
                  }
                />
              ) : null}

              {step === 5 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="AED Location" value={aedLocation} onChange={setAedLocation} />
                    <Field label="First Aid Kit Location" value={firstAidLocation} onChange={setFirstAidLocation} />
                    <Field label="Muster Point" value={assemblyPoint} onChange={setAssemblyPoint} />
                    <Field label="Nearest Hospital" value={nearestHospital} onChange={setNearestHospital} />
                    <Field label="Emergency Contact Number" value={emergencyContact} onChange={setEmergencyContact} />
                  </div>
                  <label className="block">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Emergency Map Upload</div>
                    <input type="file" accept="image/*,.pdf" onChange={handleSiteMapUpload} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
                  </label>
                  {siteMap ? (
                    <Image
                      src={siteMap}
                      alt="Emergency map preview"
                      width={1200}
                      height={900}
                      unoptimized
                      className="max-h-96 w-auto rounded-2xl border border-slate-300"
                    />
                  ) : null}
                </>
              ) : null}

              {step === 6 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-base font-semibold text-slate-900">Ready to submit</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Submit this PESHEP to the admin review queue. The final document becomes available after admin review is complete.
                  </p>
                  <div className="mt-4">
                    <LegalAcceptanceBlock checked={agreedToSubmissionTerms} onChange={setAgreedToSubmissionTerms} />
                  </div>
                </div>
              ) : null}
            </fieldset>
          </SectionCard>

          <div className="sticky bottom-4 z-10">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_18px_36px_rgba(148,163,184,0.18)] backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{steps[step].title}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {step === 6 ? "Final review and submission controls." : "Continue to the next builder section when you are ready."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                    disabled={step === 0}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Back
                  </button>
                  {step < 6 ? (
                    <button
                      type="button"
                      onClick={() => setStep((current) => Math.min(6, current + 1))}
                      disabled={authLoading || !canUseBuilder}
                      className="rounded-xl bg-[linear-gradient(135deg,_#5b6cff_0%,_#4f7cff_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,108,255,0.22)]"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitForReview}
                      disabled={submitLoading || !agreedToSubmissionTerms || authLoading || !canSubmitDocuments}
                      className="rounded-xl bg-[linear-gradient(135deg,_#0ea5e9_0%,_#2563eb_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] disabled:opacity-50"
                    >
                      {submitLoading ? "Submitting..." : "Submit for Review"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <WorkflowPath
            title="Builder Progress"
            description="Move from project setup to review with a clear handoff path."
            steps={steps.map((item, index) => ({
              label: item.title,
              detail: item.detail,
              active: index === step,
              complete: index < step,
            }))}
          />

          <SectionCard title="Plan Snapshot" description="Quick visibility into the current draft.">
            <div className="grid gap-3">
              <SummaryRow label="Project" value={answers.project_name || "Not set yet"} />
              <SummaryRow label="Work Activities" value={answers.scope_of_work_selected.length ? `${answers.scope_of_work_selected.length} selected` : "None selected"} />
              <SummaryRow label="Permits" value={answers.permits_selected.length ? `${answers.permits_selected.length} selected` : "None selected"} />
              <SummaryRow label="Orientation" value={answers.orientation_required ? `${answers.orientation_pass_score}% pass score` : "Not required"} />
              <SummaryRow label="Emergency Map" value={siteMap ? "Uploaded" : "Not uploaded"} />
            </div>
          </SectionCard>

          <SectionCard title="Readiness Checklist" description="These items make the admin handoff much smoother.">
            <div className="space-y-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <StatusBadge label={item.done ? "Ready" : "Pending"} tone={item.done ? "success" : "warning"} />
                  <div className="text-sm text-slate-700">{item.label}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-500" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-500" />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <button type="button" onClick={() => onChange(!value)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:min-w-[96px] ${value ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
        {value ? "Yes" : "No"}
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
      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-500">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectionGrid({
  values,
  options,
  onToggle,
}: {
  values: string[];
  options: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const checked = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${checked ? "border-sky-200 bg-sky-50 text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            <div className="text-sm font-semibold">{option}</div>
            <StatusBadge label={checked ? "Selected" : "Add"} tone={checked ? "success" : "neutral"} />
          </button>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
