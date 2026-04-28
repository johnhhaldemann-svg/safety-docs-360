"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Mail, Plus, QrCode, Save, X } from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
  appNativeSelectClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { PROFILE_CERTIFICATION_GROUPS } from "@/lib/constructionProfileCertifications";
import { CONSTRUCTION_POSITIONS, CONSTRUCTION_TRADES } from "@/lib/constructionProfileOptions";

const supabase = getSupabaseBrowserClient();

type Requirement = { id: string; title: string; sortOrder: number; applyTrades: string[]; applyPositions: string[] };
type Contractor = { id: string; name: string };
type TrainingRecord = {
  id: string;
  requirement_id: string | null;
  title: string;
  completed_on: string | null;
  expires_on: string | null;
  notes: string | null;
};
type Assignment = {
  id: string;
  contractorId: string | null;
  employeeId: string;
  status: string;
  archivedAt: string | null;
  employee: {
    fullName: string;
    email: string;
    phone: string;
    contractorCompanyName: string;
    tradeSpecialty: string;
    jobTitle: string;
    readinessStatus: string;
    yearsExperience: number | null;
    certifications: string[];
    certificationExpirations: Record<string, string>;
  };
  cells: Record<string, "missing" | "complete" | "expiring" | "expired" | "na">;
  records: TrainingRecord[];
};
type Payload = {
  jobsite?: { id: string; name: string; status: string };
  requirements?: Requirement[];
  contractors?: Contractor[];
  assignments?: Assignment[];
  capabilities?: { canManage?: boolean };
  error?: string;
};

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "complete") return "success";
  if (status === "expiring") return "warning";
  if (status === "expired") return "error";
  return "neutral";
}

function statusLabel(status: string) {
  if (status === "complete") return "Complete";
  if (status === "expiring") return "Expiring";
  if (status === "expired") return "Expired";
  if (status === "na") return "Out of scope";
  return "Missing";
}

function findRecord(assignment: Assignment, requirementId: string) {
  return assignment.records.find((record) => record.requirement_id === requirementId) ?? null;
}

export function ContractorTrainingClient({ jobsiteId }: { jobsiteId: string }) {
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementTrade, setRequirementTrade] = useState("");
  const [requirementPosition, setRequirementPosition] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [contractorCompanyName, setContractorCompanyName] = useState("");
  const [tradeSpecialty, setTradeSpecialty] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [trainingDrafts, setTrainingDrafts] = useState<Record<string, { completedOn: string; expiresOn: string; notes: string }>>({});

  const canManage = Boolean(payload.capabilities?.canManage);
  const requirements = payload.requirements ?? [];
  const assignments = payload.assignments ?? [];
  const activeAssignments = assignments.filter((assignment) => assignment.status !== "archived");
  const archivedAssignments = assignments.filter((assignment) => assignment.status === "archived");

  const stats = useMemo(() => {
    let totalChecks = 0;
    let complete = 0;
    let attention = 0;
    for (const assignment of activeAssignments) {
      for (const requirement of requirements) {
        const status = assignment.cells[requirement.id] ?? "missing";
        if (status === "na") continue;
        totalChecks += 1;
        if (status === "complete") complete += 1;
        if (status === "missing" || status === "expired" || status === "expiring") attention += 1;
      }
    }
    return { totalChecks, complete, attention };
  }, [activeAssignments, requirements]);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("You must be logged in.");
    return session.access_token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/company/jobsites/${encodeURIComponent(jobsiteId)}/contractor-training`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as Payload | null;
      if (!res.ok) throw new Error(data?.error || "Failed to load contractor training.");
      setPayload(data ?? {});
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to load contractor training.");
    }
    setLoading(false);
  }, [getToken, jobsiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(body: Record<string, unknown>, success: string) {
    const token = await getToken();
    const res = await fetch(`/api/company/jobsites/${encodeURIComponent(jobsiteId)}/contractor-training`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as Payload & { warning?: string; intakeUrl?: string; sent?: boolean };
    if (!res.ok) throw new Error(data?.error || "Action failed.");
    setPayload((current) => ({ ...current, ...data }));
    setTone(data.warning ? "warning" : "success");
    setMessage(data.warning || (data.intakeUrl ? `${success} ${data.intakeUrl}` : success));
  }

  async function addRequirement() {
    try {
      await postAction(
        {
          action: "addRequirement",
          title: requirementTitle,
          applyTrades: [requirementTrade],
          applyPositions: [requirementPosition],
          sortOrder: requirements.length + 1,
        },
        "Requirement added."
      );
      setRequirementTitle("");
      setRequirementTrade("");
      setRequirementPosition("");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to add requirement.");
    }
  }

  async function addEmployee() {
    try {
      await postAction(
        {
          action: "addEmployee",
          fullName: employeeName,
          email: employeeEmail,
          phone: employeePhone,
          contractorId: contractorId || null,
          contractorCompanyName,
          tradeSpecialty,
          jobTitle,
          certifications: [],
          certificationExpirations: {},
        },
        "Contractor employee added."
      );
      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeePhone("");
      setContractorId("");
      setContractorCompanyName("");
      setTradeSpecialty("");
      setJobTitle("");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to add contractor employee.");
    }
  }

  async function saveTraining(assignment: Assignment, requirement: Requirement) {
    const key = `${assignment.id}:${requirement.id}`;
    const existing = findRecord(assignment, requirement.id);
    const draft = trainingDrafts[key] ?? {
      completedOn: existing?.completed_on ?? "",
      expiresOn: existing?.expires_on ?? "",
      notes: existing?.notes ?? "",
    };
    try {
      await postAction(
        {
          action: "updateTraining",
          employeeId: assignment.employeeId,
          requirementId: requirement.id,
          title: requirement.title,
          completedOn: draft.completedOn,
          expiresOn: draft.expiresOn,
          notes: draft.notes,
        },
        "Training saved."
      );
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to save training.");
    }
  }

  async function sendIntake(assignment: Assignment) {
    try {
      await postAction({ action: "sendIntake", assignmentId: assignment.id }, "Intake link created.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to send intake.");
    }
  }

  async function archiveAssignment(assignment: Assignment) {
    try {
      await postAction({ action: "archiveAssignment", assignmentId: assignment.id }, "Assignment archived.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to archive assignment.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Jobsite contractor training"
        title="Contractor Training Matrix"
        description="Track contractor employees, jobsite-specific training, expirations, and QR self-service intake without using the company employee training matrix."
      />

      {message ? <InlineMessage tone={tone}>{message}</InlineMessage> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Active Workers" contentClassName="mt-3">
          <p className="text-3xl font-bold text-[var(--app-text-strong)]">{activeAssignments.length}</p>
          <p className="text-sm text-[var(--app-text)]">Assigned to this jobsite</p>
        </SectionCard>
        <SectionCard title="Requirements" contentClassName="mt-3">
          <p className="text-3xl font-bold text-[var(--app-text-strong)]">{requirements.length}</p>
          <p className="text-sm text-[var(--app-text)]">Custom columns for this jobsite</p>
        </SectionCard>
        <SectionCard title="Checks" contentClassName="mt-3">
          <p className="text-3xl font-bold text-[var(--app-text-strong)]">{stats.complete}/{stats.totalChecks}</p>
          <p className="text-sm text-[var(--app-text)]">{stats.attention} need attention</p>
        </SectionCard>
      </div>

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Add Requirement" description="Create the training columns for this jobsite.">
            <div className="grid gap-3">
              <label className="text-sm font-medium text-[var(--app-text-strong)]">
                Training requirement
                <select
                value={requirementTitle}
                  onChange={(event) => setRequirementTitle(event.target.value)}
                  className={`mt-1 w-full ${appNativeSelectClassName}`}
                >
                  <option value="">Select from profile certifications...</option>
                  {PROFILE_CERTIFICATION_GROUPS.map((group) => (
                    <optgroup key={group.title} label={group.title}>
                      {group.items.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-[var(--app-text-strong)]">
                  Trade
                  <select
                    value={requirementTrade}
                    onChange={(event) => setRequirementTrade(event.target.value)}
                    className={`mt-1 w-full ${appNativeSelectClassName}`}
                  >
                    <option value="">Select trade</option>
                    {CONSTRUCTION_TRADES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-[var(--app-text-strong)]">
                  Position
                  <select
                    value={requirementPosition}
                    onChange={(event) => setRequirementPosition(event.target.value)}
                    className={`mt-1 w-full ${appNativeSelectClassName}`}
                  >
                    <option value="">Select position</option>
                    {CONSTRUCTION_POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => void addRequirement()}
                disabled={!requirementTitle || !requirementTrade || !requirementPosition}
                className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Add Contractor Employee" description="Email or phone lets the app reuse prior training history.">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Full name" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
              <input value={employeeEmail} onChange={(event) => setEmployeeEmail(event.target.value)} placeholder="Email" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
              <input value={employeePhone} onChange={(event) => setEmployeePhone(event.target.value)} placeholder="Phone" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
              <select value={contractorId} onChange={(event) => setContractorId(event.target.value)} className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm">
                <option value="">Select contractor</option>
                {(payload.contractors ?? []).map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
              <input value={contractorCompanyName} onChange={(event) => setContractorCompanyName(event.target.value)} placeholder="Contractor company" className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm" />
              <select value={tradeSpecialty} onChange={(event) => setTradeSpecialty(event.target.value)} className={appNativeSelectClassName}>
                <option value="">Select trade</option>
                {CONSTRUCTION_TRADES.map((trade) => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
              <select value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className={`${appNativeSelectClassName} sm:col-span-2`}>
                <option value="">Select position</option>
                {CONSTRUCTION_POSITIONS.map((position) => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
              <button type="button" onClick={() => void addEmployee()} className={`${appButtonPrimaryClassName} sm:col-span-2`}>
                <Plus className="h-4 w-4" aria-hidden />
                Add Employee
              </button>
            </div>
          </SectionCard>
        </div>
      ) : null}

      <SectionCard title="Jobsite Matrix" description="Active contractor employees and this jobsite's custom training requirements.">
        {loading ? (
          <InlineMessage>Loading contractor training...</InlineMessage>
        ) : activeAssignments.length === 0 ? (
          <EmptyState title="No contractor employees" description="Add a contractor employee or send an intake link to start the matrix." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--app-border-strong)] bg-white">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-72 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">Employee</th>
                  {requirements.map((requirement) => (
                    <th key={requirement.id} className="min-w-56 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">
                      {requirement.title}
                      <span className="mt-1 block text-[11px] font-medium text-slate-500">
                        {(requirement.applyPositions ?? []).join(", ") || "All positions"} / {(requirement.applyTrades ?? []).join(", ") || "All trades"}
                      </span>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeAssignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-950">{assignment.employee.fullName}</div>
                      <div className="mt-1 text-xs text-slate-500">{assignment.employee.email || assignment.employee.phone || "No contact on file"}</div>
                      <div className="mt-2 text-xs text-slate-600">
                        {assignment.employee.contractorCompanyName || "Contractor"} / {assignment.employee.jobTitle || "Position not set"} / {assignment.employee.tradeSpecialty || "Trade not set"}
                      </div>
                    </td>
                    {requirements.map((requirement) => {
                      const record = findRecord(assignment, requirement.id);
                      const status = assignment.cells[requirement.id] ?? "missing";
                      const key = `${assignment.id}:${requirement.id}`;
                      const draft = trainingDrafts[key] ?? {
                        completedOn: record?.completed_on ?? "",
                        expiresOn: record?.expires_on ?? "",
                        notes: record?.notes ?? "",
                      };
                      return (
                        <td key={requirement.id} className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {status === "complete" ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : status === "na" ? <X className="h-4 w-4 text-slate-400" aria-hidden /> : <X className="h-4 w-4 text-amber-600" aria-hidden />}
                            <StatusBadge label={statusLabel(status)} tone={statusTone(status)} />
                          </div>
                          {canManage && status !== "na" ? (
                            <div className="mt-3 grid gap-2">
                              <input
                                type="date"
                                value={draft.completedOn}
                                onChange={(event) => setTrainingDrafts((current) => ({ ...current, [key]: { ...draft, completedOn: event.target.value } }))}
                                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                aria-label={`${requirement.title} completed date`}
                              />
                              <input
                                type="date"
                                value={draft.expiresOn}
                                onChange={(event) => setTrainingDrafts((current) => ({ ...current, [key]: { ...draft, expiresOn: event.target.value } }))}
                                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                aria-label={`${requirement.title} expiration date`}
                              />
                              <button type="button" onClick={() => void saveTraining(assignment, requirement)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                <Save className="h-3.5 w-3.5" aria-hidden />
                                Save
                              </button>
                            </div>
                          ) : record ? (
                            <p className="mt-2 text-xs text-slate-500">
                              {record.completed_on ? `Completed ${record.completed_on}` : "No completed date"}
                              {record.expires_on ? ` / Expires ${record.expires_on}` : ""}
                            </p>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={() => void sendIntake(assignment)} disabled={!canManage} className={appButtonSecondaryClassName}>
                          <QrCode className="h-4 w-4" aria-hidden />
                          <Mail className="h-4 w-4" aria-hidden />
                          Send QR Intake
                        </button>
                        <button type="button" onClick={() => void archiveAssignment(assignment)} disabled={!canManage} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                          <Archive className="h-4 w-4" aria-hidden />
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {archivedAssignments.length > 0 ? (
        <SectionCard title="Archived Assignments" description="Archived jobsite assignments keep reusable training history intact.">
          <div className="grid gap-3">
            {archivedAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-[var(--app-border)] bg-white/80 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-900">{assignment.employee.fullName}</span>
                <span className="text-slate-500"> archived {assignment.archivedAt ? assignment.archivedAt.slice(0, 10) : "recently"}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
