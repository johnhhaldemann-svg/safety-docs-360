"use client";

import {
  ClipboardCheck,
  CopyCheck,
  FileWarning,
  Hospital,
  MapPin,
  PhoneCall,
  Printer,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InlineMessage,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import {
  emergencyActionPlanStatusLabel,
  type EmergencyActionPlanReadiness,
  type JobsiteEmergencyActionPlanProfile,
} from "@/lib/jobsiteEmergencyActionPlan";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type MissingField = {
  key: string;
  label: string;
  severity: "critical" | "review";
};

type ContactRow = {
  role: string;
  name: string;
  phone: string;
  alternateName: string;
  alternatePhone: string;
  notes: string;
  primaryName?: string;
  primaryPhone?: string;
};

type TimelineRow = {
  phase: string;
  actions: string[];
};

type JobsiteSummary = {
  id?: string;
  name?: string | null;
  status?: string | null;
};

type EmergencyActionPlanResponse = {
  jobsite?: JobsiteSummary | null;
  profile?: JobsiteEmergencyActionPlanProfile | null;
  defaults?: JobsiteEmergencyActionPlanProfile | null;
  effectiveProfile?: JobsiteEmergencyActionPlanProfile | null;
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
  commandPostLocation: string;
  assemblyArea: string;
  secondaryAssemblyArea: string;
  evacuationShelterNotes: string;
  weatherShelterLocation: string;
  lightningPlan: string;
  tornadoPlan: string;
  aedLocation: string;
  firstAidLocation: string;
  fireExtinguisherLocations: string;
  spillKitLocations: string;
  rescueEquipmentLocations: string;
  nearestMedicalName: string;
  nearestMedicalAddress: string;
  nearestMedicalPhone: string;
  nearestMedicalRoute: string;
  mediaContactName: string;
  mediaContactPhone: string;
  mediaStatementInstructions: string;
  regulatoryContactName: string;
  regulatoryContactPhone: string;
  regulatoryReportingInstructions: string;
  callChain: ContactRow[];
  utilityContacts: ContactRow[];
  afterHoursContacts: ContactRow[];
  backupContacts: ContactRow[];
  incidentNotificationTimeline: TimelineRow[];
  postIncidentRequirements: string[];
  notes: string;
  revisionDate: string;
};

const POST_INCIDENT_DEFAULTS = [
  "Ensure safety / stop work",
  "Secure scene",
  "Provide first aid / medical care",
  "Preserve evidence",
  "Collect witness statements",
  "Take photos / documentation",
  "Incident investigation",
  "Obtain approval to restart work",
];

const TIMELINE_DEFAULTS: TimelineRow[] = [
  { phase: "Immediate", actions: ["911 if needed", "Superintendent", "Safety coordinator", "Owner / HSE advisor"] },
  { phase: "Within 1 hour", actions: ["Project manager", "Owner's project manager", "Corporate safety", "Risk management"] },
  { phase: "Before work resumes", actions: ["All impacted personnel", "Client / owner", "Regulatory if required", "Team huddle / restart briefing"] },
];

function blankContact(partial: Partial<ContactRow> = {}): ContactRow {
  return {
    role: "",
    name: "",
    phone: "",
    alternateName: "",
    alternatePhone: "",
    notes: "",
    ...partial,
  };
}

const EMPTY_FORM: FormState = {
  emergencyContactName: "",
  emergencyContactPhone: "",
  responderAccessInstructions: "",
  responderSiteAddress: "",
  commandPostLocation: "",
  assemblyArea: "",
  secondaryAssemblyArea: "",
  evacuationShelterNotes: "",
  weatherShelterLocation: "",
  lightningPlan: "",
  tornadoPlan: "",
  aedLocation: "",
  firstAidLocation: "",
  fireExtinguisherLocations: "",
  spillKitLocations: "",
  rescueEquipmentLocations: "",
  nearestMedicalName: "",
  nearestMedicalAddress: "",
  nearestMedicalPhone: "",
  nearestMedicalRoute: "",
  mediaContactName: "",
  mediaContactPhone: "",
  mediaStatementInstructions: "",
  regulatoryContactName: "",
  regulatoryContactPhone: "",
  regulatoryReportingInstructions: "",
  callChain: [blankContact({ role: "Site Superintendent" })],
  utilityContacts: [blankContact({ role: "Electric" }), blankContact({ role: "Gas" }), blankContact({ role: "Water" }), blankContact({ role: "Fire alarm / sprinkler" })],
  afterHoursContacts: [blankContact()],
  backupContacts: [blankContact({ role: "Superintendent" }), blankContact({ role: "Project Manager" }), blankContact({ role: "Safety Coordinator" })],
  incidentNotificationTimeline: TIMELINE_DEFAULTS,
  postIncidentRequirements: POST_INCIDENT_DEFAULTS,
  notes: "",
  revisionDate: new Date().toISOString().slice(0, 10),
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function contactRows(value: unknown, fallback: ContactRow[]) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return blankContact({
      role: text(row.role),
      name: text(row.name),
      phone: text(row.phone),
      alternateName: text(row.alternateName),
      alternatePhone: text(row.alternatePhone),
      primaryName: text(row.primaryName),
      primaryPhone: text(row.primaryPhone),
      notes: text(row.notes),
    });
  });
}

function timelineRows(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return TIMELINE_DEFAULTS;
  return value.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      phase: text(row.phase),
      actions: Array.isArray(row.actions) ? row.actions.map((action) => text(action)).filter(Boolean) : [],
    };
  });
}

function stringRows(value: unknown, fallback: string[]) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((item) => text(item)).filter(Boolean);
}

function formFromProfile(profile?: JobsiteEmergencyActionPlanProfile | null): FormState {
  return {
    emergencyContactName: profile?.emergency_contact_name ?? "",
    emergencyContactPhone: profile?.emergency_contact_phone ?? "",
    responderAccessInstructions: profile?.responder_access_instructions ?? "",
    responderSiteAddress: profile?.responder_site_address ?? "",
    commandPostLocation: profile?.command_post_location ?? "",
    assemblyArea: profile?.assembly_area ?? "",
    secondaryAssemblyArea: profile?.secondary_assembly_area ?? "",
    evacuationShelterNotes: profile?.evacuation_shelter_notes ?? "",
    weatherShelterLocation: profile?.weather_shelter_location ?? "",
    lightningPlan: profile?.lightning_plan ?? "",
    tornadoPlan: profile?.tornado_plan ?? "",
    aedLocation: profile?.aed_location ?? "",
    firstAidLocation: profile?.first_aid_location ?? "",
    fireExtinguisherLocations: profile?.fire_extinguisher_locations ?? "",
    spillKitLocations: profile?.spill_kit_locations ?? "",
    rescueEquipmentLocations: profile?.rescue_equipment_locations ?? "",
    nearestMedicalName: profile?.nearest_medical_name ?? "",
    nearestMedicalAddress: profile?.nearest_medical_address ?? "",
    nearestMedicalPhone: profile?.nearest_medical_phone ?? "",
    nearestMedicalRoute: profile?.nearest_medical_route ?? "",
    mediaContactName: profile?.media_contact_name ?? "",
    mediaContactPhone: profile?.media_contact_phone ?? "",
    mediaStatementInstructions: profile?.media_statement_instructions ?? "",
    regulatoryContactName: profile?.regulatory_contact_name ?? "",
    regulatoryContactPhone: profile?.regulatory_contact_phone ?? "",
    regulatoryReportingInstructions: profile?.regulatory_reporting_instructions ?? "",
    callChain: contactRows(profile?.call_chain, EMPTY_FORM.callChain),
    utilityContacts: contactRows(profile?.utility_contacts, EMPTY_FORM.utilityContacts),
    afterHoursContacts: contactRows(profile?.after_hours_contacts, EMPTY_FORM.afterHoursContacts),
    backupContacts: contactRows(profile?.backup_contacts, EMPTY_FORM.backupContacts),
    incidentNotificationTimeline: timelineRows(profile?.incident_notification_timeline),
    postIncidentRequirements: stringRows(profile?.post_incident_requirements, POST_INCIDENT_DEFAULTS),
    notes: profile?.notes ?? "",
    revisionDate: typeof profile?.revision_date === "string" ? profile.revision_date.slice(0, 10) : EMPTY_FORM.revisionDate,
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

function hasContactValue(row: ContactRow) {
  return Boolean(row.role || row.name || row.phone || row.alternateName || row.alternatePhone || row.notes || row.primaryName || row.primaryPhone);
}

function payloadFromForm(form: FormState) {
  return {
    ...form,
    callChain: form.callChain.filter(hasContactValue),
    utilityContacts: form.utilityContacts.filter(hasContactValue),
    afterHoursContacts: form.afterHoursContacts.filter(hasContactValue),
    backupContacts: form.backupContacts.filter(hasContactValue),
    incidentNotificationTimeline: form.incidentNotificationTimeline
      .map((row) => ({ phase: row.phase, actions: row.actions.filter(Boolean) }))
      .filter((row) => row.phase || row.actions.length > 0),
    postIncidentRequirements: form.postIncidentRequirements.filter(Boolean),
  };
}

export function JobsiteEmergencyActionPlanClient({ jobsiteId }: { jobsiteId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [payload, setPayload] = useState<EmergencyActionPlanResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");
  const [view, setView] = useState<"planner" | "posted">("planner");

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
      setForm(formFromProfile(data?.profile ?? data?.effectiveProfile));
    }
    setLoading(false);
  }, [jobsiteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlan();
    }, 0);
    return () => window.clearTimeout(timer);
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

  function applyCompanyDefaults() {
    const effective = payload?.effectiveProfile ?? payload?.defaults ?? null;
    if (!effective) {
      setMessageTone("warning");
      setMessage("No company EAP defaults are saved yet.");
      return;
    }
    setForm(formFromProfile(effective));
    setMessageTone("success");
    setMessage("Company defaults applied. Review site-specific fields before saving.");
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
      body: JSON.stringify({ ...payloadFromForm(form), reviewed }),
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

  const jobsiteName = payload?.jobsite?.name || "Jobsite";

  return (
    <SectionCard
      title="Emergency Action Plan"
      description="Plan, review, and print the jobsite crisis-management sheet crews can post at field command locations."
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => void loadPlan()} className={appButtonSecondaryClassName}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {loading ? "Refreshing" : "Refresh"}
          </button>
          <button type="button" onClick={() => window.print()} className={appButtonSecondaryClassName}>
            <Printer className="h-4 w-4" aria-hidden />
            Print / Save PDF
          </button>
        </div>
      }
      className="eap-workspace"
    >
      <EapPrintStyles />
      {loading ? <InlineMessage>Loading Emergency Action Plan...</InlineMessage> : null}
      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}
      {!loading ? (
        <div className="space-y-5">
          <EapReadinessPanel
            readiness={payload?.readiness ?? "needs_review"}
            criticalMissing={criticalMissing}
            reviewMissing={reviewMissing}
            reviewStale={Boolean(payload?.reviewStale)}
            immediateReviewNeeded={Boolean(payload?.immediateReviewNeeded)}
            lastReviewedAt={payload?.lastReviewedAt}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="inline-flex rounded-xl border border-[var(--app-border)] bg-white p-1 shadow-[0_8px_18px_rgba(76,108,161,0.06)]">
              {(["planner", "posted"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    view === item ? "bg-[var(--app-accent-primary)] text-white" : "text-[var(--app-text)] hover:bg-[var(--app-accent-primary-soft)]"
                  }`}
                >
                  {item === "planner" ? "Planner" : "Posted Sheet"}
                </button>
              ))}
            </div>
            <PlannerActionBar
              saving={saving}
              onApplyDefaults={applyCompanyDefaults}
              onSave={() => void savePlan(false)}
              onSaveReviewed={() => void savePlan(true)}
              onPrint={() => window.print()}
            />
          </div>

          {view === "planner" ? (
            <EapPlanner form={form} updateForm={updateForm} setForm={setForm} />
          ) : (
            <PostedCrisisSheet form={form} jobsiteName={jobsiteName} />
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

export function PlannerActionBar({
  saving,
  onApplyDefaults,
  onSave,
  onSaveReviewed,
  onPrint,
}: {
  saving: boolean;
  onApplyDefaults: () => void;
  onSave: () => void;
  onSaveReviewed: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onApplyDefaults} className={appButtonSecondaryClassName}>
        <CopyCheck className="h-4 w-4" aria-hidden />
        Apply Company Defaults
      </button>
      <button type="button" onClick={onSave} disabled={saving} className={appButtonSecondaryClassName}>
        <Save className="h-4 w-4" aria-hidden />
        {saving ? "Saving" : "Save"}
      </button>
      <button type="button" onClick={onSaveReviewed} disabled={saving} className={appButtonPrimaryClassName}>
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {saving ? "Saving" : "Save and Mark Reviewed"}
      </button>
      <button type="button" onClick={onPrint} className={appButtonSecondaryClassName}>
        <Printer className="h-4 w-4" aria-hidden />
        Print / Save PDF
      </button>
    </div>
  );
}

function EapReadinessPanel({
  readiness,
  criticalMissing,
  reviewMissing,
  reviewStale,
  immediateReviewNeeded,
  lastReviewedAt,
}: {
  readiness: EmergencyActionPlanReadiness;
  criticalMissing: MissingField[];
  reviewMissing: MissingField[];
  reviewStale: boolean;
  immediateReviewNeeded: boolean;
  lastReviewedAt?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--app-border-strong)] bg-white p-5 shadow-[0_10px_24px_rgba(44,58,86,0.055)] print:hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">Readiness</div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--app-text-strong)]">
            {emergencyActionPlanStatusLabel(readiness)}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-text)]">
            Missing critical emergency information requires immediate review before this sheet is posted or used for active work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={emergencyActionPlanStatusLabel(readiness)} tone={readinessTone(readiness)} />
          {reviewStale ? <StatusBadge label="Review stale" tone="warning" /> : null}
          {immediateReviewNeeded ? <StatusBadge label="Immediate review needed" tone="error" /> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Critical gaps" value={criticalMissing.length} />
        <SummaryTile label="Review items" value={reviewMissing.length + (reviewStale ? 1 : 0)} />
        <SummaryTile label="Last reviewed" value={formatDate(lastReviewedAt)} />
      </div>
      {criticalMissing.length > 0 ? <MissingFieldCloud title="Critical missing information" fields={criticalMissing} tone="error" /> : null}
      {reviewMissing.length > 0 ? <MissingFieldCloud title="Review before posting" fields={reviewMissing} tone="warning" /> : null}
    </div>
  );
}

function MissingFieldCloud({ title, fields, tone }: { title: string; fields: MissingField[]; tone: "warning" | "error" }) {
  return (
    <div className={`mt-4 rounded-xl border p-4 ${tone === "error" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
      <div className={`text-sm font-bold ${tone === "error" ? "text-red-900" : "text-amber-900"}`}>{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {fields.map((field) => (
          <StatusBadge key={field.key} label={field.label} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function EapPlanner({
  form,
  updateForm,
  setForm,
}: {
  form: FormState;
  updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setForm: Dispatch<SetStateAction<FormState>>;
}) {
  return (
    <div className="space-y-5 print:hidden">
      <PlannerSection icon={PhoneCall} title="Immediate Response and Call Chain">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextInput label="Emergency Contact Name" value={form.emergencyContactName} onChange={(value) => updateForm("emergencyContactName", value)} />
          <TextInput label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={(value) => updateForm("emergencyContactPhone", value)} />
          <TextInput label="Revision Date" type="date" value={form.revisionDate} onChange={(value) => updateForm("revisionDate", value)} />
          <TextArea label="Site Address / Responder Directions" value={form.responderSiteAddress} onChange={(value) => updateForm("responderSiteAddress", value)} />
          <TextArea label="Responder Gate / Access Instructions" value={form.responderAccessInstructions} onChange={(value) => updateForm("responderAccessInstructions", value)} />
          <TextArea label="Site Command Post" value={form.commandPostLocation} onChange={(value) => updateForm("commandPostLocation", value)} />
        </div>
        <ContactEditor
          title="Jobsite Crisis Call Responsibility Structure"
          rows={form.callChain}
          onChange={(rows) => updateForm("callChain", rows)}
          addLabel="Add call-chain contact"
        />
      </PlannerSection>

      <PlannerSection icon={MapPin} title="Assembly, Weather, and Equipment">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextArea label="Primary Assembly / Muster Area" value={form.assemblyArea} onChange={(value) => updateForm("assemblyArea", value)} />
          <TextArea label="Secondary Assembly / Muster Area" value={form.secondaryAssemblyArea} onChange={(value) => updateForm("secondaryAssemblyArea", value)} />
          <TextArea label="Evacuation / Shelter Notes" value={form.evacuationShelterNotes} onChange={(value) => updateForm("evacuationShelterNotes", value)} />
          <TextArea label="Severe Weather Shelter" value={form.weatherShelterLocation} onChange={(value) => updateForm("weatherShelterLocation", value)} />
          <TextArea label="Lightning Plan" value={form.lightningPlan} onChange={(value) => updateForm("lightningPlan", value)} />
          <TextArea label="Tornado Plan" value={form.tornadoPlan} onChange={(value) => updateForm("tornadoPlan", value)} />
          <TextArea label="AED Location" value={form.aedLocation} onChange={(value) => updateForm("aedLocation", value)} />
          <TextArea label="First Aid Location" value={form.firstAidLocation} onChange={(value) => updateForm("firstAidLocation", value)} />
          <TextArea label="Fire Extinguisher Locations" value={form.fireExtinguisherLocations} onChange={(value) => updateForm("fireExtinguisherLocations", value)} />
          <TextArea label="Spill Kit Locations" value={form.spillKitLocations} onChange={(value) => updateForm("spillKitLocations", value)} />
          <TextArea label="Rescue Equipment Locations" value={form.rescueEquipmentLocations} onChange={(value) => updateForm("rescueEquipmentLocations", value)} />
        </div>
      </PlannerSection>

      <PlannerSection icon={Hospital} title="Medical, Utilities, and After-Hours Contacts">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextInput label="Nearest Hospital / Clinic Name" value={form.nearestMedicalName} onChange={(value) => updateForm("nearestMedicalName", value)} />
          <TextInput label="Nearest Hospital / Clinic Phone" value={form.nearestMedicalPhone} onChange={(value) => updateForm("nearestMedicalPhone", value)} />
          <TextArea label="Nearest Hospital / Clinic Address" value={form.nearestMedicalAddress} onChange={(value) => updateForm("nearestMedicalAddress", value)} />
          <TextArea label="Route Notes" value={form.nearestMedicalRoute} onChange={(value) => updateForm("nearestMedicalRoute", value)} />
        </div>
        <ContactEditor title="Utility Shutoff Contacts" rows={form.utilityContacts} onChange={(rows) => updateForm("utilityContacts", rows)} addLabel="Add utility contact" />
        <ContactEditor title="After-Hours Emergency Contacts" rows={form.afterHoursContacts} onChange={(rows) => updateForm("afterHoursContacts", rows)} addLabel="Add after-hours contact" />
      </PlannerSection>

      <PlannerSection icon={Radio} title="Media, Regulatory, Backup, and Closeout">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextInput label="Media / Public Statement Contact" value={form.mediaContactName} onChange={(value) => updateForm("mediaContactName", value)} />
          <TextInput label="Media Contact Phone" value={form.mediaContactPhone} onChange={(value) => updateForm("mediaContactPhone", value)} />
          <TextArea label="Media Statement Instructions" value={form.mediaStatementInstructions} onChange={(value) => updateForm("mediaStatementInstructions", value)} />
          <TextInput label="Regulatory Reporting Contact" value={form.regulatoryContactName} onChange={(value) => updateForm("regulatoryContactName", value)} />
          <TextInput label="Regulatory Contact Phone" value={form.regulatoryContactPhone} onChange={(value) => updateForm("regulatoryContactPhone", value)} />
          <TextArea label="Regulatory Reporting Instructions" value={form.regulatoryReportingInstructions} onChange={(value) => updateForm("regulatoryReportingInstructions", value)} />
          <TextArea label="Additional Notes" value={form.notes} onChange={(value) => updateForm("notes", value)} />
        </div>
        <TimelineEditor rows={form.incidentNotificationTimeline} onChange={(rows) => updateForm("incidentNotificationTimeline", rows)} />
        <ContactEditor title="Backup Contacts" rows={form.backupContacts} onChange={(rows) => updateForm("backupContacts", rows)} addLabel="Add backup contact" />
        <StringListEditor
          title="Post-Incident Requirements"
          rows={form.postIncidentRequirements}
          onChange={(rows) => setForm((current) => ({ ...current, postIncidentRequirements: rows }))}
        />
      </PlannerSection>
    </div>
  );
}

function PlannerSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-[0_10px_24px_rgba(44,58,86,0.055)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-accent-primary-soft)] text-[var(--app-accent-primary)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="text-base font-bold text-[var(--app-text-strong)]">{title}</h3>
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-[var(--app-border-strong)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-[var(--app-border-strong)] bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
      />
    </label>
  );
}

function ContactEditor({ title, rows, onChange, addLabel }: { title: string; rows: ContactRow[]; onChange: (rows: ContactRow[]) => void; addLabel: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
        <button type="button" onClick={() => onChange([...rows, blankContact()])} className="text-xs font-bold text-[var(--app-accent-primary)]">
          {addLabel}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-lg border border-[var(--app-border)] bg-white p-3 md:grid-cols-3">
            <TextInput label="Role" value={row.role} onChange={(value) => updateRow(rows, onChange, index, { role: value })} />
            <TextInput label="Name" value={row.name} onChange={(value) => updateRow(rows, onChange, index, { name: value })} />
            <TextInput label="Phone" value={row.phone} onChange={(value) => updateRow(rows, onChange, index, { phone: value })} />
            <TextInput label="Alternate Name" value={row.alternateName} onChange={(value) => updateRow(rows, onChange, index, { alternateName: value })} />
            <TextInput label="Alternate Phone" value={row.alternatePhone} onChange={(value) => updateRow(rows, onChange, index, { alternatePhone: value })} />
            <div className="flex items-end justify-end">
              <button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--semantic-danger)]">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function updateRow(rows: ContactRow[], onChange: (rows: ContactRow[]) => void, index: number, patch: Partial<ContactRow>) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
}

function TimelineEditor({ rows, onChange }: { rows: TimelineRow[]; onChange: (rows: TimelineRow[]) => void }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[var(--app-text-strong)]">Incident Notification Timeline</h4>
        <button type="button" onClick={() => onChange([...rows, { phase: "", actions: [""] }])} className="text-xs font-bold text-[var(--app-accent-primary)]">
          Add timeline phase
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-lg border border-[var(--app-border)] bg-white p-3 md:grid-cols-[220px_1fr_auto]">
            <TextInput label="Phase" value={row.phase} onChange={(value) => onChange(rows.map((item, rowIndex) => (rowIndex === index ? { ...item, phase: value } : item)))} />
            <TextArea label="Actions (one per line)" value={row.actions.join("\n")} onChange={(value) => onChange(rows.map((item, rowIndex) => (rowIndex === index ? { ...item, actions: value.split("\n") } : item)))} />
            <div className="flex items-end justify-end">
              <button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--semantic-danger)]">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StringListEditor({ title, rows, onChange }: { title: string; rows: string[]; onChange: (rows: string[]) => void }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4">
      <h4 className="text-sm font-bold text-[var(--app-text-strong)]">{title}</h4>
      <TextArea label="Requirements (one per line)" value={rows.join("\n")} onChange={(value) => onChange(value.split("\n"))} />
    </div>
  );
}

export function PostedCrisisSheet({ form, jobsiteName }: { form: FormState; jobsiteName: string }) {
  return (
    <section className="crisis-sheet mx-auto max-w-[1120px] rounded-xl border-4 border-slate-900 bg-white p-5 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.12)] print:shadow-none">
      <div className="border-b-4 border-slate-900 pb-2 text-center">
        <h2 className="text-4xl font-black uppercase tracking-wide">Crisis Management Plan</h2>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <PosterInfo icon={ClipboardCheck} label="Project Name" value={jobsiteName} />
        <PosterInfo icon={MapPin} label="Project Address" value={form.responderSiteAddress || "Not specified"} />
      </div>

      <div className="mt-4 text-center">
        <div className="text-3xl font-black uppercase tracking-wide text-red-800">In Case Of An Emergency</div>
        <div className="text-xl font-black uppercase tracking-wide">Jobsite Crisis Call Responsibility Structure</div>
        <p className="mt-1 text-xs font-semibold italic text-slate-600">
          If unable to reach one individual in the call responsibility structure, leave a message and call the next name.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[210px_1fr_240px]">
        <div className="space-y-3">
          <div className="rounded-lg border-2 border-red-700 p-4 text-center">
            <div className="text-lg font-black">1st Call:</div>
            <div className="text-6xl font-black text-red-800">911</div>
          </div>
          <PosterBlock title="Emergency Lead" tone="blue" icon={PhoneCall}>
            <PosterLine label={form.emergencyContactName || "Emergency contact"} value={form.emergencyContactPhone || "Not specified"} />
          </PosterBlock>
        </div>

        <div className="space-y-3">
          <div className="mx-auto w-56 rounded-lg border-2 border-red-700 p-3 text-center text-lg font-black uppercase text-red-800">
            Disturbance<br />or<br />Accident
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {form.callChain.filter(hasContactValue).map((contact, index) => (
              <PosterBlock key={`${contact.role}-${index}`} title={contact.role || `Call ${index + 1}`} tone="blue" icon={Users}>
                <PosterLine label={contact.name || "Name not specified"} value={contact.phone || "Phone not specified"} />
                {contact.alternateName || contact.alternatePhone ? <PosterLine label={`Alt: ${contact.alternateName || "Alternate"}`} value={contact.alternatePhone || "Phone not specified"} /> : null}
              </PosterBlock>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <PosterBlock title="Site Command Post" tone="dark" icon={Users}>
            <p className="text-sm font-bold">{form.commandPostLocation || "Not specified"}</p>
            <p className="mt-2 text-xs">Leadership meets here during an emergency. Communication center, plans, radios, and supplies should be located here.</p>
          </PosterBlock>
          <PosterBlock title="Emergency Equipment Locations" tone="green" icon={ShieldCheck}>
            <PosterLine label="AED" value={form.aedLocation || "Not specified"} />
            <PosterLine label="First Aid Kits" value={form.firstAidLocation || "Not specified"} />
            <PosterLine label="Fire Extinguishers" value={form.fireExtinguisherLocations || "Not specified"} />
            <PosterLine label="Spill Kits" value={form.spillKitLocations || "Not specified"} />
            <PosterLine label="Rescue Equipment" value={form.rescueEquipmentLocations || "Not specified"} />
          </PosterBlock>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <PosterBlock title="Emergency Assembly Area" tone="green" icon={Users}>
          <PosterLine label="Primary Muster Point" value={form.assemblyArea || "Not specified"} />
          <PosterLine label="Secondary Muster Point" value={form.secondaryAssemblyArea || "Not specified"} />
        </PosterBlock>
        <PosterBlock title="Nearest Hospital / Clinic" tone="red" icon={Hospital}>
          <PosterLine label={form.nearestMedicalName || "Facility"} value={form.nearestMedicalAddress || "Address not specified"} />
          <PosterLine label="Phone" value={form.nearestMedicalPhone || "Not specified"} />
          <PosterLine label="Route" value={form.nearestMedicalRoute || "Not specified"} />
        </PosterBlock>
        <PosterBlock title="Weather / Shelter Plan" tone="blue" icon={Zap}>
          <PosterLine label="Shelter" value={form.weatherShelterLocation || form.evacuationShelterNotes || "Not specified"} />
          <PosterLine label="Lightning" value={form.lightningPlan || "Monitor weather, stop work, secure site, move to shelter, stay 30 minutes after last strike."} />
          <PosterLine label="Tornado" value={form.tornadoPlan || "Follow site warning and shelter instructions."} />
        </PosterBlock>
        <PosterBlock title="Utility Shutoff Contacts" tone="orange" icon={Wrench}>
          {form.utilityContacts.filter(hasContactValue).map((contact, index) => (
            <PosterLine key={`${contact.role}-${index}`} label={contact.role || "Utility"} value={[contact.name, contact.phone].filter(Boolean).join(" / ") || "Not specified"} />
          ))}
        </PosterBlock>
        <PosterBlock title="After-Hours Emergency Contacts" tone="purple" icon={PhoneCall}>
          {form.afterHoursContacts.filter(hasContactValue).map((contact, index) => (
            <PosterLine key={`${contact.role}-${index}`} label={contact.role || contact.name || `Contact ${index + 1}`} value={contact.phone || contact.notes || "Not specified"} />
          ))}
        </PosterBlock>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <PosterBlock title="Incident Notification Timeline" tone="red" icon={FileWarning}>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {form.incidentNotificationTimeline.map((item) => (
              <div key={item.phase}>
                <div className="text-[11px] font-black uppercase text-red-800">{item.phase || "Phase"}</div>
                <ul className="mt-1 list-disc pl-4 text-[11px] leading-4">
                  {item.actions.filter(Boolean).map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </PosterBlock>
        <PosterBlock title="Media / Public Statement Contact" tone="dark" icon={Radio}>
          <PosterLine label={form.mediaContactName || "Only authorized spokesperson"} value={form.mediaContactPhone || "Not specified"} />
          <p className="mt-2 text-xs">{form.mediaStatementInstructions || "No one else is authorized to speak to the media or public."}</p>
        </PosterBlock>
        <PosterBlock title="Regulatory Reporting" tone="dark" icon={ClipboardCheck}>
          <PosterLine label={form.regulatoryContactName || "Responsible party"} value={form.regulatoryContactPhone || "Not specified"} />
          <p className="mt-2 text-xs">{form.regulatoryReportingInstructions || "Escalate regulatory reporting questions to the responsible safety contact."}</p>
        </PosterBlock>
        <PosterBlock title="Post-Incident Requirements" tone="dark" icon={ShieldCheck}>
          <ol className="list-decimal pl-4 text-[11px] leading-4">
            {form.postIncidentRequirements.filter(Boolean).map((item) => <li key={item}>{item}</li>)}
          </ol>
        </PosterBlock>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.7fr_0.8fr]">
        <PosterBlock title="Backup Contacts (At Least One Alternate For Every Key Person)" tone="dark" icon={Users}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                {["Role", "Primary", "Phone", "Alternate", "Phone"].map((header) => <th key={header} className="border border-slate-300 px-2 py-1 text-left">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {form.backupContacts.filter(hasContactValue).map((contact, index) => (
                <tr key={`${contact.role}-${index}`}>
                  <td className="border border-slate-300 px-2 py-1 font-bold">{contact.role || "Role"}</td>
                  <td className="border border-slate-300 px-2 py-1">{contact.primaryName || contact.name || "Not specified"}</td>
                  <td className="border border-slate-300 px-2 py-1">{contact.primaryPhone || contact.phone || "N/A"}</td>
                  <td className="border border-slate-300 px-2 py-1">{contact.alternateName || "N/A"}</td>
                  <td className="border border-slate-300 px-2 py-1">{contact.alternatePhone || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PosterBlock>
        <PosterBlock title="Additional Notes" tone="dark" icon={ClipboardCheck}>
          <ul className="list-disc pl-4 text-[11px] leading-4">
            {(form.notes ? form.notes.split("\n") : ["Keep radios charged", "Maintain clear site access for emergency vehicles", "Review this plan during safety meetings", "Report hazards immediately"]).filter(Boolean).map((note) => <li key={note}>{note}</li>)}
          </ul>
        </PosterBlock>
      </div>

      <div className="mt-4 flex justify-between border-t border-slate-900 pt-2 text-[10px] font-semibold text-slate-600">
        <span>Post at jobsite command locations and review during project emergency orientation.</span>
        <span>Emergency Call Responsibility Structure - Rev. {form.revisionDate || new Date().toISOString().slice(0, 10)}</span>
      </div>
    </section>
  );
}

function PosterInfo({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border-2 border-slate-400 px-4 py-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <div className="text-xs font-black uppercase text-slate-700">{label}:</div>
        <div className="text-base font-semibold">{value}</div>
      </div>
    </div>
  );
}

function PosterBlock({ title, tone, icon: Icon, children }: { title: string; tone: "blue" | "green" | "red" | "orange" | "purple" | "dark"; icon: LucideIcon; children: ReactNode }) {
  const toneClass: Record<typeof tone, string> = {
    blue: "border-blue-800",
    green: "border-emerald-800",
    red: "border-red-800",
    orange: "border-orange-700",
    purple: "border-violet-800",
    dark: "border-slate-900",
  };
  const headerClass: Record<typeof tone, string> = {
    blue: "bg-blue-900",
    green: "bg-emerald-900",
    red: "bg-red-800",
    orange: "bg-orange-700",
    purple: "bg-violet-900",
    dark: "bg-slate-950",
  };
  return (
    <div className={`overflow-hidden rounded-lg border-2 ${toneClass[tone]}`}>
      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-wide text-white ${headerClass[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden />
        {title}
      </div>
      <div className="space-y-2 p-3 text-xs leading-4">{children}</div>
    </div>
  );
}

function PosterLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 pb-1 last:border-b-0">
      <span className="font-black">{label}:</span> <span>{value}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">{label}</div>
      <div className="mt-2 break-words text-sm font-black text-[var(--app-text-strong)]">{value}</div>
    </div>
  );
}

function EapPrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: landscape; margin: 0.25in; }
        body { background: #fff !important; }
        body * { visibility: hidden; }
        .crisis-sheet, .crisis-sheet * { visibility: visible; }
        .crisis-sheet {
          position: absolute;
          inset: 0;
          width: 100%;
          max-width: none !important;
          border-radius: 0 !important;
          transform-origin: top left;
          box-shadow: none !important;
        }
        .print\\:hidden { display: none !important; }
      }
      @media screen and (max-width: 900px) {
        .crisis-sheet { overflow-x: auto; }
      }
    `}</style>
  );
}
