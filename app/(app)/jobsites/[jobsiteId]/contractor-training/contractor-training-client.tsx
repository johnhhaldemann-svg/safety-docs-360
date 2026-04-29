"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Mail, MessageSquareText, Plus, Save, X } from "lucide-react";
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
  delivery?: { sentChannels?: string[]; warnings?: string[] };
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

function MultiPickField({
  label,
  placeholder,
  options,
  selected,
  onChange,
  selectAllLabel,
  allSelectedLabel,
  emptyLabel,
}: {
  label: string;
  placeholder: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  selectAllLabel: string;
  allSelectedLabel: string;
  emptyLabel: string;
}) {
  const availableOptions = options.filter((option) => !selected.includes(option));
  const allSelected =
    options.length > 0 &&
    selected.length === options.length &&
    options.every((option) => selected.includes(option));

  return (
    <div className="text-sm font-medium text-[var(--app-text-strong)]">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => onChange([...options])}
          disabled={allSelected}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--app-accent-primary)] transition hover:bg-[var(--app-accent-primary-soft)] disabled:cursor-not-allowed disabled:text-[var(--app-text-muted)] disabled:hover:bg-transparent"
        >
          {allSelected ? allSelectedLabel : selectAllLabel}
        </button>
      </div>
      <select
        key={`${label}-${selected.join("|")}`}
        defaultValue=""
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          onChange([...selected, value]);
        }}
        className={`mt-1 w-full ${appNativeSelectClassName}`}
      >
        <option value="">{placeholder}</option>
        {availableOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {selected.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Selected ${label.toLowerCase()}`}>
          {selected.map((item) => (
            <li
              key={item}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--app-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--app-text-strong)]"
            >
              <span className="truncate">{item}</span>
              <button
                type="button"
                className="shrink-0 rounded px-0.5 text-[var(--app-text)] hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-strong)]"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(selected.filter((option) => option !== item))}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-normal text-[var(--app-text)]">{emptyLabel}</p>
      )}
    </div>
  );
}

export function ContractorTrainingClient({ jobsiteId }: { jobsiteId: string }) {
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementTrades, setRequirementTrades] = useState<string[]>([]);
  const [requirementPositions, setRequirementPositions] = useState<string[]>([]);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
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
    const data = (await res.json().catch(() => null)) as Payload & { warning?: string | null; intakeUrl?: string; sent?: boolean };
    if (!res.ok) throw new Error(data?.error || "Action failed.");
    setPayload((current) => ({ ...current, ...data }));
    setTone(data.warning ? "warning" : "success");
    const sentChannels = data.delivery?.sentChannels ?? [];
    const deliveryNote = sentChannels.length ? ` Sent by ${sentChannels.join(" and ")}.` : "";
    setMessage(data.warning || (data.intakeUrl ? `${success}${deliveryNote} ${data.intakeUrl}` : `${success}${deliveryNote}`));
  }

  async function addRequirement() {
    try {
      await postAction(
        {
          action: "addRequirement",
          title: requirementTitle,
          applyTrades: requirementTrades,
          applyPositions: requirementPositions,
          sortOrder: requirements.length + 1,
        },
        "Requirement added."
      );
      setRequirementTitle("");
      setRequirementTrades([]);
      setRequirementPositions([]);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to add requirement.");
    }
  }

  async function sendPhoneInvite() {
    try {
      await postAction(
        {
          action: "inviteByPhone",
          phone: invitePhone,
          email: inviteEmail,
        },
        "Invite sent."
      );
      setInvitePhone("");
      setInviteEmail("");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to send contractor invite.");
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
        description="Send secure phone invites, then let contractor employees fill out their own jobsite training intake without using the company employee training matrix."
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
                <MultiPickField
                  label="Trades"
                  placeholder="Add a trade"
                  options={CONSTRUCTION_TRADES}
                  selected={requirementTrades}
                  onChange={setRequirementTrades}
                  selectAllLabel="Select all trades"
                  allSelectedLabel="All trades selected"
                  emptyLabel="No trades selected yet."
                />
                <MultiPickField
                  label="Positions"
                  placeholder="Add a position"
                  options={CONSTRUCTION_POSITIONS}
                  selected={requirementPositions}
                  onChange={setRequirementPositions}
                  selectAllLabel="Select all positions"
                  allSelectedLabel="All positions selected"
                  emptyLabel="No positions selected yet."
                />
              </div>
              <button
                type="button"
                onClick={() => void addRequirement()}
                disabled={!requirementTitle || requirementTrades.length === 0 || requirementPositions.length === 0}
                className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Send Contractor Invite" description="Send a secure intake link by text, email, or both. The contractor employee fills out their own profile, company, trade, position, and training.">
            <div className="grid gap-3">
              <input
                value={invitePhone}
                onChange={(event) => setInvitePhone(event.target.value)}
                placeholder="Phone number for text invite"
                inputMode="tel"
                className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm"
              />
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Email address for email invite"
                inputMode="email"
                type="email"
                className="rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void sendPhoneInvite()}
                disabled={!invitePhone.trim() && !inviteEmail.trim()}
                className={`${appButtonPrimaryClassName} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {inviteEmail.trim() && !invitePhone.trim() ? (
                  <Mail className="h-4 w-4" aria-hidden />
                ) : (
                  <MessageSquareText className="h-4 w-4" aria-hidden />
                )}
                Send Invite
              </button>
            </div>
          </SectionCard>
        </div>
      ) : null}

      <SectionCard title="Jobsite Matrix" description="Active contractor employees and this jobsite's custom training requirements.">
        {loading ? (
          <InlineMessage>Loading contractor training...</InlineMessage>
        ) : activeAssignments.length === 0 ? (
          <EmptyState title="No contractor employees" description="Send a phone invite to start the matrix. The contractor employee fills out their own profile and training." />
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
                          <MessageSquareText className="h-4 w-4" aria-hidden />
                          Resend Invite
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
