"use client";

import { RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import { emergencyActionPlanStatusLabel, type EmergencyActionPlanReadiness } from "@/lib/jobsiteEmergencyActionPlan";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type MissingField = {
  key: string;
  label: string;
  severity: "critical" | "review";
};

type EmergencyActionPlanProfile = {
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  responder_access_instructions?: string | null;
  responder_site_address?: string | null;
  assembly_area?: string | null;
  evacuation_shelter_notes?: string | null;
  aed_location?: string | null;
  first_aid_location?: string | null;
  nearest_medical_name?: string | null;
  nearest_medical_address?: string | null;
  nearest_medical_phone?: string | null;
  notes?: string | null;
};

type EmergencyActionPlanResponse = {
  profile?: EmergencyActionPlanProfile | null;
  readiness?: EmergencyActionPlanReadiness;
  missingFields?: MissingField[];
  lastReviewedAt?: string | null;
  lastReviewedBy?: string | null;
  reviewStale?: boolean;
  immediateReviewNeeded?: boolean;
  error?: string;
  message?: string;
};

type FormState = {
  emergencyContactName: string;
  emergencyContactPhone: string;
  responderAccessInstructions: string;
  responderSiteAddress: string;
  assemblyArea: string;
  evacuationShelterNotes: string;
  aedLocation: string;
  firstAidLocation: string;
  nearestMedicalName: string;
  nearestMedicalAddress: string;
  nearestMedicalPhone: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  emergencyContactName: "",
  emergencyContactPhone: "",
  responderAccessInstructions: "",
  responderSiteAddress: "",
  assemblyArea: "",
  evacuationShelterNotes: "",
  aedLocation: "",
  firstAidLocation: "",
  nearestMedicalName: "",
  nearestMedicalAddress: "",
  nearestMedicalPhone: "",
  notes: "",
};

function formFromProfile(profile?: EmergencyActionPlanProfile | null): FormState {
  return {
    emergencyContactName: profile?.emergency_contact_name ?? "",
    emergencyContactPhone: profile?.emergency_contact_phone ?? "",
    responderAccessInstructions: profile?.responder_access_instructions ?? "",
    responderSiteAddress: profile?.responder_site_address ?? "",
    assemblyArea: profile?.assembly_area ?? "",
    evacuationShelterNotes: profile?.evacuation_shelter_notes ?? "",
    aedLocation: profile?.aed_location ?? "",
    firstAidLocation: profile?.first_aid_location ?? "",
    nearestMedicalName: profile?.nearest_medical_name ?? "",
    nearestMedicalAddress: profile?.nearest_medical_address ?? "",
    nearestMedicalPhone: profile?.nearest_medical_phone ?? "",
    notes: profile?.notes ?? "",
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Not reviewed";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not reviewed";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function readinessTone(readiness?: EmergencyActionPlanReadiness): "success" | "warning" | "error" {
  if (readiness === "complete") return "success";
  if (readiness === "missing_critical_info") return "error";
  return "warning";
}

function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function JobsiteEmergencyActionPlanClient({ jobsiteId }: { jobsiteId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [payload, setPayload] = useState<EmergencyActionPlanResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`/api/company/jobsites/${encodeURIComponent(jobsiteId)}/emergency-action-plan`, {
      headers: getAuthHeaders(session?.access_token),
    });
    const data = (await response.json().catch(() => null)) as EmergencyActionPlanResponse | null;
    if (!response.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Failed to load the Emergency Action Plan.");
      setPayload(null);
    } else {
      setPayload(data ?? {});
      setForm(formFromProfile(data?.profile));
    }
    setLoading(false);
  }, [jobsiteId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const criticalMissing = useMemo(
    () => (payload?.missingFields ?? []).filter((field) => field.severity === "critical"),
    [payload?.missingFields]
  );
  const reviewMissing = useMemo(
    () => (payload?.missingFields ?? []).filter((field) => field.severity !== "critical"),
    [payload?.missingFields]
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function savePlan(reviewed = false) {
    setSaving(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`/api/company/jobsites/${encodeURIComponent(jobsiteId)}/emergency-action-plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(session?.access_token),
      },
      body: JSON.stringify({ ...form, reviewed }),
    });
    const data = (await response.json().catch(() => null)) as EmergencyActionPlanResponse | null;
    if (!response.ok) {
      setMessageTone("error");
      setMessage(data?.error || "Failed to save the Emergency Action Plan.");
      setSaving(false);
      return;
    }
    setPayload(data ?? {});
    setForm(formFromProfile(data?.profile));
    setMessageTone(data?.readiness === "complete" ? "success" : "warning");
    setMessage(data?.message || "Emergency Action Plan saved.");
    setSaving(false);
  }

  const inputClassName =
    "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20";
  const labelClassName = "text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500";

  return (
    <SectionCard
      title="Emergency Action Plan"
      description="Field-ready emergency contacts, access directions, medical resources, and muster information for this jobsite."
      actions={
        <button type="button" onClick={() => void loadPlan()} className={appButtonSecondaryClassName}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      }
    >
      {loading ? <InlineMessage>Loading Emergency Action Plan...</InlineMessage> : null}
      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      {!loading ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-700/80 bg-slate-950/50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Readiness</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-100">
                  {emergencyActionPlanStatusLabel(payload?.readiness ?? "needs_review")}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  This card is an operational quick reference for the site team. It does not guarantee compliance; missing items should be reviewed before work proceeds.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={emergencyActionPlanStatusLabel(payload?.readiness ?? "needs_review")}
                  tone={readinessTone(payload?.readiness)}
                />
                {payload?.reviewStale ? <StatusBadge label="Review stale" tone="warning" /> : null}
                {payload?.immediateReviewNeeded ? <StatusBadge label="Immediate review needed" tone="error" /> : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SummaryTile label="Critical gaps" value={criticalMissing.length} />
              <SummaryTile label="Review items" value={reviewMissing.length + (payload?.reviewStale ? 1 : 0)} />
              <SummaryTile label="Last reviewed" value={formatDate(payload?.lastReviewedAt)} />
            </div>
            {(payload?.missingFields?.length ?? 0) > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-950/20 p-4">
                <div className="text-sm font-bold text-amber-100">Missing information</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {payload?.missingFields?.map((field) => (
                    <StatusBadge
                      key={field.key}
                      label={field.label}
                      tone={field.severity === "critical" ? "error" : "warning"}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className={labelClassName}>
                Emergency Contact Name
                <input value={form.emergencyContactName} onChange={(event) => updateForm("emergencyContactName", event.target.value)} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Emergency Contact Phone
                <input value={form.emergencyContactPhone} onChange={(event) => updateForm("emergencyContactPhone", event.target.value)} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                AED Location
                <input value={form.aedLocation} onChange={(event) => updateForm("aedLocation", event.target.value)} className={inputClassName} />
              </label>
              <label className={`${labelClassName} md:col-span-2`}>
                Responder Gate / Access Instructions
                <textarea value={form.responderAccessInstructions} onChange={(event) => updateForm("responderAccessInstructions", event.target.value)} rows={3} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Site Address / Responder Directions
                <textarea value={form.responderSiteAddress} onChange={(event) => updateForm("responderSiteAddress", event.target.value)} rows={3} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Assembly / Muster Area
                <textarea value={form.assemblyArea} onChange={(event) => updateForm("assemblyArea", event.target.value)} rows={3} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Evacuation / Shelter Notes
                <textarea value={form.evacuationShelterNotes} onChange={(event) => updateForm("evacuationShelterNotes", event.target.value)} rows={3} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                First Aid Location
                <textarea value={form.firstAidLocation} onChange={(event) => updateForm("firstAidLocation", event.target.value)} rows={3} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Nearest Clinic / Hospital Name
                <input value={form.nearestMedicalName} onChange={(event) => updateForm("nearestMedicalName", event.target.value)} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Nearest Clinic / Hospital Phone
                <input value={form.nearestMedicalPhone} onChange={(event) => updateForm("nearestMedicalPhone", event.target.value)} className={inputClassName} />
              </label>
              <label className={`${labelClassName} md:col-span-2`}>
                Nearest Clinic / Hospital Address
                <textarea value={form.nearestMedicalAddress} onChange={(event) => updateForm("nearestMedicalAddress", event.target.value)} rows={3} className={inputClassName} />
              </label>
              <label className={`${labelClassName} md:col-span-2 xl:col-span-3`}>
                Notes
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} className={inputClassName} />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => void savePlan(false)} disabled={saving} className={appButtonSecondaryClassName}>
                <Save className="h-4 w-4" aria-hidden />
                {saving ? "Saving" : "Save"}
              </button>
              <button type="button" onClick={() => void savePlan(true)} disabled={saving} className={appButtonPrimaryClassName}>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {saving ? "Saving" : "Save and Mark Reviewed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm font-black text-slate-100">{value}</div>
    </div>
  );
}
