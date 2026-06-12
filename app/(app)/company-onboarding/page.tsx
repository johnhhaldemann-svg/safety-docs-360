"use client";
import { deferEffect } from "@/lib/deferredEffect";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  GraduationCap,
  MapPin,
  Plus,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react";
import {
  InlineMessage,
  MetricTile,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  type CompanyOnboardingImportType,
  type ImportRowError,
  normalizeRowsArray,
  validateEmployeeImportRows,
  validateJobsiteImportRows,
  validateTrainingRecordImportRows,
} from "@/lib/companyOnboardingImport";
import { readExcelObjects } from "@/lib/excelRows";

const supabase = getSupabaseBrowserClient();

type TabId = CompanyOnboardingImportType;

type TrackedEmployee = {
  id: string;
  full_name: string;
  email?: string | null;
  external_employee_id?: string | null;
  job_title?: string | null;
  trade_specialty?: string | null;
  status?: string | null;
  trainingRecords?: Array<{ id: string }>;
};

type JobsiteOption = { id: string; name: string; status?: string | null };
type RequirementOption = { id: string; title: string };

const TABS: Array<{ id: TabId; label: string; icon: typeof Users }> = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "jobsites", label: "Jobsites", icon: MapPin },
  { id: "training_records", label: "Training Records", icon: GraduationCap },
];

const EMPTY_EMPLOYEE = {
  employee_id: "",
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  trade_specialty: "",
  readiness_status: "ready",
  years_experience: "",
  status: "active",
  jobsite_names: "",
  certifications: "",
  certification_expirations: "",
};

const EMPTY_JOBSITE = {
  name: "",
  jobsite_number: "",
  project_number: "",
  location: "",
  status: "active",
  project_manager: "",
  safety_lead: "",
  start_date: "",
  end_date: "",
  notes: "",
};

const EMPTY_TRAINING = {
  employee_id: "",
  requirement_id: "",
  training_title: "",
  completed_on: "",
  expires_on: "",
  provider: "",
  notes: "",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function previewRows(rows: Array<Record<string, unknown>>) {
  return rows.slice(0, 8);
}

function validationForTab(tab: TabId, rows: Array<Record<string, unknown>>) {
  if (tab === "employees") return validateEmployeeImportRows(rows);
  if (tab === "jobsites") return validateJobsiteImportRows(rows);
  return validateTrainingRecordImportRows(rows);
}

export default function CompanyOnboardingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("employees");
  const [employees, setEmployees] = useState<TrackedEmployee[]>([]);
  const [jobsites, setJobsites] = useState<JobsiteOption[]>([]);
  const [requirements, setRequirements] = useState<RequirementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [guideOpen, setGuideOpen] = useState(true);
  const [preview, setPreview] = useState<Record<TabId, Array<Record<string, unknown>>>>({
    employees: [],
    jobsites: [],
    training_records: [],
  });

  // Deep-link support: /…/onboarding-import?tab=employees opens that import tab directly
  // (used by the guided setup wizard). Read once on mount; harmless if absent.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab !== "employees" && tab !== "jobsites" && tab !== "training_records") return;
    const timer = window.setTimeout(() => setActiveTab(tab), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE);
  const [jobsiteForm, setJobsiteForm] = useState(EMPTY_JOBSITE);
  const [trainingForm, setTrainingForm] = useState(EMPTY_TRAINING);

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers = getAuthHeaders(token);
      const [employeesResponse, matrixResponse] = await Promise.all([
        fetch("/api/company/tracked-employees", { headers }),
        fetch("/api/company/training-matrix", { headers }),
      ]);

      const employeesJson = await employeesResponse.json().catch(() => ({}));
      const matrixJson = await matrixResponse.json().catch(() => ({}));

      if (!employeesResponse.ok) {
        throw new Error(employeesJson.error || "Failed to load tracked employees.");
      }

      setEmployees((employeesJson.employees ?? []) as TrackedEmployee[]);
      setJobsites((employeesJson.jobsites ?? []) as JobsiteOption[]);
      setRequirements((matrixJson.requirements ?? []) as RequirementOption[]);
      setMessage(employeesJson.warning ?? null);
      setMessageTone(employeesJson.warning ? "warning" : "neutral");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load onboarding data.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => deferEffect(() => {
    void loadWorkspaceData();
  }), [loadWorkspaceData]);

  // Auto-collapse the guide once all three datasets have at least one record.
  useEffect(() => {
    const activeCount = employees.filter((e) => e.status !== "archived").length;
    const trainingCount = employees.reduce((n, e) => n + (e.trainingRecords?.length ?? 0), 0);
    if (!loading && activeCount > 0 && jobsites.length > 0 && trainingCount > 0) {
      setGuideOpen(false);
    }
  }, [loading, employees, jobsites.length]);

  const activeRows = preview[activeTab];
  const activeValidation = useMemo(
    () => validationForTab(activeTab, activeRows),
    [activeRows, activeTab]
  );

  const activeEmployees = employees.filter((employee) => employee.status !== "archived");
  const trainingRecordCount = employees.reduce(
    (count, employee) => count + (employee.trainingRecords?.length ?? 0),
    0
  );

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    setRowErrors([]);
    setMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const raw = await readExcelObjects(buffer);
      if (!raw.length) throw new Error("The uploaded file does not contain any rows.");
      const rows = normalizeRowsArray(raw);
      setPreview((current) => ({ ...current, [activeTab]: rows }));
      setMessage(`${rows.length} row${rows.length === 1 ? "" : "s"} ready for preview.`);
      setMessageTone(rows.length > 0 ? "success" : "warning");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to parse upload.");
      setMessageTone("error");
    }
  }

  async function postJson(url: string, body: unknown) {
    const token = await getAccessToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(token),
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Request failed.");
    return json;
  }

  async function submitPreviewImport() {
    const rows = preview[activeTab];
    if (rows.length === 0) {
      setMessage("Upload a file before importing rows.");
      setMessageTone("warning");
      return;
    }
    setSaving(true);
    setRowErrors([]);
    try {
      const payload =
        activeTab === "employees"
          ? { employees: rows, source: "manual_upload" }
          : activeTab === "jobsites"
            ? { jobsites: rows, source: "manual_upload" }
            : { trainingRecords: rows, source: "manual_upload" };
      const json = await postJson("/api/company/onboarding/import", payload);
      setRowErrors((json.rowErrors ?? []) as ImportRowError[]);
      setPreview((current) => ({ ...current, [activeTab]: [] }));
      setMessage(`Imported ${json.acceptedCount ?? 0} row${json.acceptedCount === 1 ? "" : "s"}.`);
      setMessageTone((json.rowErrors ?? []).length > 0 ? "warning" : "success");
      await loadWorkspaceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function submitEmployeeForm() {
    setSaving(true);
    setRowErrors([]);
    try {
      const json = await postJson("/api/company/tracked-employees", employeeForm);
      setRowErrors((json.rowErrors ?? []) as ImportRowError[]);
      setEmployeeForm(EMPTY_EMPLOYEE);
      setMessage("Tracked employee saved without creating a license.");
      setMessageTone("success");
      await loadWorkspaceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Employee save failed.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function submitJobsiteForm() {
    setSaving(true);
    setRowErrors([]);
    try {
      const json = await postJson("/api/company/onboarding/import", {
        jobsites: [jobsiteForm],
        source: "manual",
      });
      setRowErrors((json.rowErrors ?? []) as ImportRowError[]);
      setJobsiteForm(EMPTY_JOBSITE);
      setMessage("Jobsite saved.");
      setMessageTone("success");
      await loadWorkspaceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Jobsite save failed.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function submitTrainingForm() {
    if (!trainingForm.employee_id) {
      setMessage("Choose a tracked employee before adding training.");
      setMessageTone("warning");
      return;
    }
    setSaving(true);
    setRowErrors([]);
    try {
      await postJson(
        `/api/company/tracked-employees/${encodeURIComponent(trainingForm.employee_id)}/training-records`,
        {
          requirement_id: trainingForm.requirement_id || null,
          training_title: trainingForm.training_title,
          completed_on: trainingForm.completed_on,
          expires_on: trainingForm.expires_on,
          provider: trainingForm.provider,
          notes: trainingForm.notes,
        }
      );
      setTrainingForm(EMPTY_TRAINING);
      setMessage("Training record saved for the tracked employee.");
      setMessageTone("success");
      await loadWorkspaceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Training record save failed.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Data Import"
        title="Upload your employees, jobsites, and training records"
        description="Add your roster, project sites, and training history using manual entry or by uploading a CSV or Excel file. Tracked employees don't use paid seats — they're separate from workspace login users."
        actions={
          <>
            <Link href="/safe-predict/training-tracker" className={appButtonSecondaryClassName}>
              <GraduationCap className="h-4 w-4" aria-hidden />
              Training Matrix
            </Link>
            <button type="button" onClick={() => void loadWorkspaceData()} className={appButtonSecondaryClassName}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          title="Tracked employees"
          value={loading ? "..." : String(activeEmployees.length)}
          detail="Roster-only employees available for company training tracking."
        />
        <MetricTile
          title="Jobsites"
          value={loading ? "..." : String(jobsites.length)}
          detail="Imported or manually created job/project records."
        />
        <MetricTile
          title="Training records"
          value={loading ? "..." : String(trainingRecordCount)}
          detail="Training history tied to tracked employees, not licensed users."
        />
      </div>

      {/* Getting started guide — collapses once all three data types have records */}
      {(!loading || guideOpen) ? (
        <div className="rounded-2xl border border-[var(--app-accent-border-28)] bg-white shadow-[var(--app-shadow-soft)]">
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-primary)] text-xs font-black text-white">?</div>
              <div>
                <div className="text-sm font-bold text-[var(--app-text-strong)]">How to set up your data — do these 3 steps in order</div>
                <div className="text-xs text-[var(--app-muted)]">
                  {activeEmployees.length > 0 && jobsites.length > 0 && trainingRecordCount > 0
                    ? "All three datasets have records. You're ready."
                    : "Employees → Jobsites → Training Records. Training records require employees to exist first."}
                </div>
              </div>
            </div>
            {guideOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-[var(--app-muted)]" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--app-muted)]" aria-hidden />
            )}
          </button>

          {guideOpen ? (
            <div className="grid gap-px border-t border-[var(--app-border)] md:grid-cols-3">
              {[
                {
                  step: "1",
                  tab: "employees" as TabId,
                  icon: Users,
                  title: "Upload employees first",
                  body: "Add your full workforce roster — name, employee ID, job title, trade. Training records are linked to employees, so this must come first.",
                  tip: "Required: full_name or employee_id. Everything else is optional.",
                  done: activeEmployees.length > 0,
                },
                {
                  step: "2",
                  tab: "jobsites" as TabId,
                  icon: MapPin,
                  title: "Then add jobsites",
                  body: "Create your active project sites. Jobsites are used for JSAs, permits, incidents, and predictive risk scores across the platform.",
                  tip: "Required: name. Jobsite number and location are optional but recommended.",
                  done: jobsites.length > 0,
                },
                {
                  step: "3",
                  tab: "training_records" as TabId,
                  icon: GraduationCap,
                  title: "Finally, add training records",
                  body: "Upload who completed which training and when it expires. Each record links to an employee you already imported. Skip this if you have no history yet.",
                  tip: "Required: employee_id or employee name + training_title + completed_on.",
                  done: trainingRecordCount > 0,
                },
              ].map((guide) => {
                const Icon = guide.icon;
                return (
                  <div
                    key={guide.step}
                    className={`flex flex-col gap-3 p-5 ${guide.done ? "bg-[var(--semantic-success-bg)]" : "bg-white"} first:rounded-bl-2xl last:rounded-br-2xl md:first:rounded-bl-2xl md:last:rounded-br-2xl`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${guide.done ? "bg-[var(--semantic-success)] text-white" : "bg-[var(--app-accent-primary)] text-white"}`}
                      >
                        {guide.done ? "✓" : guide.step}
                      </div>
                      <Icon className="h-4 w-4 text-[var(--app-muted)]" aria-hidden />
                      <span className="text-sm font-bold text-[var(--app-text-strong)]">{guide.title}</span>
                    </div>
                    <p className="text-sm leading-6 text-[var(--app-text)]">{guide.body}</p>
                    <p className="rounded-lg bg-[var(--app-panel-soft)] px-3 py-2 text-xs text-[var(--app-muted)]">{guide.tip}</p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { setActiveTab(guide.tab); setGuideOpen(false); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        {guide.done ? "Review" : "Go to tab"} →
                      </button>
                      <a
                        href={`/api/company/onboarding/import/template?type=${guide.tab}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
                      >
                        <Download className="h-3 w-3" aria-hidden />
                        Template
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--app-border)] bg-white p-2 shadow-[var(--app-shadow-soft)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cx(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-[var(--app-accent-primary)] text-white"
                  : "text-[var(--app-text)] hover:bg-[var(--app-accent-primary-soft)]"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard
          title={activeTab === "employees" ? "Manual employee entry" : activeTab === "jobsites" ? "Manual jobsite entry" : "Manual training record"}
          description={
            activeTab === "employees"
              ? "Add roster-only employees for safety managers to track without issuing app access."
              : activeTab === "jobsites"
                ? "Create the project records employees can be assigned to during import."
                : "Add a training record to a tracked employee profile."
          }
        >
          {activeTab === "employees" ? (
            <div className="grid gap-3">
              <input className={inputClassName} placeholder="Employee ID" value={employeeForm.employee_id} onChange={(e) => setEmployeeForm({ ...employeeForm, employee_id: e.target.value })} />
              <input className={inputClassName} placeholder="Full name" value={employeeForm.full_name} onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClassName} placeholder="Email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
                <input className={inputClassName} placeholder="Phone" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClassName} placeholder="Job title" value={employeeForm.job_title} onChange={(e) => setEmployeeForm({ ...employeeForm, job_title: e.target.value })} />
                <input className={inputClassName} placeholder="Trade specialty" value={employeeForm.trade_specialty} onChange={(e) => setEmployeeForm({ ...employeeForm, trade_specialty: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select aria-label="Employee readiness status" className={appNativeSelectClassName} value={employeeForm.readiness_status} onChange={(e) => setEmployeeForm({ ...employeeForm, readiness_status: e.target.value })}>
                  <option value="ready">Ready</option>
                  <option value="travel_ready">Travel ready</option>
                  <option value="limited">Limited</option>
                  <option value="needs_training">Needs training</option>
                  <option value="onboarding">Onboarding</option>
                </select>
                <input className={inputClassName} placeholder="Years exp." value={employeeForm.years_experience} onChange={(e) => setEmployeeForm({ ...employeeForm, years_experience: e.target.value })} />
                <select aria-label="Employee roster status" className={appNativeSelectClassName} value={employeeForm.status} onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <input className={inputClassName} placeholder="Certifications, separated by semicolons" value={employeeForm.certifications} onChange={(e) => setEmployeeForm({ ...employeeForm, certifications: e.target.value })} />
              <input className={inputClassName} placeholder="Certification expirations, e.g. OSHA 10:2027-08-12" value={employeeForm.certification_expirations} onChange={(e) => setEmployeeForm({ ...employeeForm, certification_expirations: e.target.value })} />
              <button type="button" disabled={saving} onClick={() => void submitEmployeeForm()} className={appButtonPrimaryClassName}>
                <Plus className="h-4 w-4" aria-hidden />
                Save Tracked Employee
              </button>
            </div>
          ) : activeTab === "jobsites" ? (
            <div className="grid gap-3">
              <input className={inputClassName} placeholder="Jobsite name" value={jobsiteForm.name} onChange={(e) => setJobsiteForm({ ...jobsiteForm, name: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClassName} placeholder="Jobsite number" value={jobsiteForm.jobsite_number} onChange={(e) => setJobsiteForm({ ...jobsiteForm, jobsite_number: e.target.value })} />
                <input className={inputClassName} placeholder="Project number" value={jobsiteForm.project_number} onChange={(e) => setJobsiteForm({ ...jobsiteForm, project_number: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClassName} placeholder="Location" value={jobsiteForm.location} onChange={(e) => setJobsiteForm({ ...jobsiteForm, location: e.target.value })} />
                <input className={inputClassName} placeholder="Project manager" value={jobsiteForm.project_manager} onChange={(e) => setJobsiteForm({ ...jobsiteForm, project_manager: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClassName} placeholder="Safety lead" value={jobsiteForm.safety_lead} onChange={(e) => setJobsiteForm({ ...jobsiteForm, safety_lead: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select aria-label="Jobsite status" className={appNativeSelectClassName} value={jobsiteForm.status} onChange={(e) => setJobsiteForm({ ...jobsiteForm, status: e.target.value })}>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                <input className={inputClassName} type="date" value={jobsiteForm.start_date} onChange={(e) => setJobsiteForm({ ...jobsiteForm, start_date: e.target.value })} />
                <input className={inputClassName} type="date" value={jobsiteForm.end_date} onChange={(e) => setJobsiteForm({ ...jobsiteForm, end_date: e.target.value })} />
              </div>
              <textarea aria-label="Jobsite notes" className={inputClassName} placeholder="Notes" rows={3} value={jobsiteForm.notes} onChange={(e) => setJobsiteForm({ ...jobsiteForm, notes: e.target.value })} />
              <button type="button" disabled={saving} onClick={() => void submitJobsiteForm()} className={appButtonPrimaryClassName}>
                <Plus className="h-4 w-4" aria-hidden />
                Save Jobsite
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <select aria-label="Training record employee" className={appNativeSelectClassName} value={trainingForm.employee_id} onChange={(e) => setTrainingForm({ ...trainingForm, employee_id: e.target.value })}>
                <option value="">Choose tracked employee</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
              <select aria-label="Linked training requirement" className={appNativeSelectClassName} value={trainingForm.requirement_id} onChange={(e) => {
                const requirement = requirements.find((item) => item.id === e.target.value);
                setTrainingForm({ ...trainingForm, requirement_id: e.target.value, training_title: trainingForm.training_title || requirement?.title || "" });
              }}>
                <option value="">No linked requirement</option>
                {requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.title}
                  </option>
                ))}
              </select>
              <input className={inputClassName} placeholder="Training title" value={trainingForm.training_title} onChange={(e) => setTrainingForm({ ...trainingForm, training_title: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClassName} type="date" value={trainingForm.completed_on} onChange={(e) => setTrainingForm({ ...trainingForm, completed_on: e.target.value })} />
                <input className={inputClassName} type="date" value={trainingForm.expires_on} onChange={(e) => setTrainingForm({ ...trainingForm, expires_on: e.target.value })} />
              </div>
              <input className={inputClassName} placeholder="Provider" value={trainingForm.provider} onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })} />
              <textarea aria-label="Training record notes" className={inputClassName} placeholder="Notes" rows={3} value={trainingForm.notes} onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })} />
              <button type="button" disabled={saving} onClick={() => void submitTrainingForm()} className={appButtonPrimaryClassName}>
                <Plus className="h-4 w-4" aria-hidden />
                Save Training Record
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Template upload"
          description="Download the matching CSV template, fill it out, then upload CSV or XLSX for preview and row validation."
          actions={
            <a
              href={`/api/company/onboarding/import/template?type=${activeTab}`}
              className={appButtonSecondaryClassName}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download Template
            </a>
          }
        >
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] px-4 py-8 text-center transition hover:bg-[var(--app-accent-primary-soft)]">
            <Upload className="h-7 w-7 text-[var(--app-accent-primary)]" aria-hidden />
            <span className="text-sm font-semibold text-[var(--app-text-strong)]">
              Upload CSV or XLSX
            </span>
            <span className="text-xs text-[var(--app-muted)]">Valid rows can be imported while invalid rows are skipped.</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)}
            />
          </label>

          {activeRows.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={`${activeRows.length} parsed`} tone="info" />
                  <StatusBadge label={`${activeValidation.validRows.length} valid`} tone="success" />
                  {activeValidation.rowErrors.length > 0 ? (
                    <StatusBadge label={`${activeValidation.rowErrors.length} errors`} tone="warning" />
                  ) : null}
                </div>
                <button type="button" disabled={saving || activeValidation.validRows.length === 0} onClick={() => void submitPreviewImport()} className={appButtonPrimaryClassName}>
                  Import Valid Rows
                </button>
              </div>
              <PreviewTable rows={previewRows(activeRows)} />
              {activeValidation.rowErrors.length > 0 ? (
                <RowErrorList errors={activeValidation.rowErrors.slice(0, 8)} />
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--app-border)] bg-white p-4 text-sm text-[var(--app-muted)]">
              No upload preview yet.
            </div>
          )}

          {rowErrors.length > 0 ? <RowErrorList errors={rowErrors.slice(0, 12)} /> : null}
        </SectionCard>
      </div>

      {activeTab === "employees" || activeTab === "training_records" ? (
        <SectionCard
          title={activeTab === "training_records" ? `Tracked employees (${activeEmployees.length}) — training records` : `Tracked employees (${activeEmployees.length})`}
          description={
            activeTab === "training_records"
              ? "Training records are tied to tracked employees. Add employees first, then add their records above."
              : "These people are available in the Training Matrix as tracked employees with no license usage."
          }
        >
          {activeEmployees.length > 0 ? (
            <div className="overflow-x-auto" role="region" aria-label="Tracked roster table" tabIndex={0}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-muted)]">
                  <tr>
                    <th className="py-3 pr-4">Employee</th>
                    <th className="py-3 pr-4">Position</th>
                    <th className="py-3 pr-4">Trade</th>
                    <th className="py-3 pr-4">Training records</th>
                    {activeTab === "employees" ? <th className="py-3 pr-4">License</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {activeEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-[var(--app-text-strong)]">{employee.full_name}</div>
                        <div className="text-xs text-[var(--app-muted)]">{employee.email || employee.external_employee_id || employee.id}</div>
                      </td>
                      <td className="py-3 pr-4">{employee.job_title || "-"}</td>
                      <td className="py-3 pr-4">{employee.trade_specialty || "-"}</td>
                      <td className="py-3 pr-4">{employee.trainingRecords?.length ?? 0}</td>
                      {activeTab === "employees" ? (
                        <td className="py-3 pr-4">
                          <StatusBadge label="No license" tone="info" />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-6 text-sm text-[var(--app-muted)]">
              No tracked employees yet. Add one manually above or upload an employee file.
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title={`Jobsites (${jobsites.length})`}
          description="These project sites can be assigned to employees during import and are used across JSAs, permits, incidents, and risk scores."
        >
          {jobsites.length > 0 ? (
            <div className="overflow-x-auto" role="region" aria-label="Jobsites table" tabIndex={0}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-muted)]">
                  <tr>
                    <th className="py-3 pr-4">Jobsite name</th>
                    <th className="py-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {jobsites.map((jobsite) => (
                    <tr key={jobsite.id}>
                      <td className="py-3 pr-4 font-semibold text-[var(--app-text-strong)]">{jobsite.name}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge label={jobsite.status ?? "active"} tone={jobsite.status === "archived" ? "neutral" : "success"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] p-6 text-sm text-[var(--app-muted)]">
              No jobsites yet. Add one manually above or upload a jobsites file.
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

const inputClassName =
  "w-full rounded-lg border border-[var(--app-border)] bg-white px-3.5 py-2 text-sm text-[var(--app-text-strong)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]";

function PreviewTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 8);
  if (rows.length === 0 || columns.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--app-border)] bg-white" role="region" aria-label="Upload preview table" tabIndex={0}>
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">
                {column.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--app-border)]">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="max-w-[12rem] truncate px-3 py-2 text-[var(--app-text)]">
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowErrorList({ errors }: { errors: ImportRowError[] }) {
  return (
    <div className="rounded-xl border border-[rgba(217,164,65,0.28)] bg-[var(--semantic-warning-bg)] p-4 text-sm text-[var(--semantic-warning)]">
      <div className="font-semibold">Row validation</div>
      <ul className="mt-2 space-y-1">
        {errors.map((error, index) => (
          <li key={`${error.entity}-${error.rowNumber}-${index}`}>
            Row {error.rowNumber}: {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
