"use client";

import { ClipboardCheck, FileText, LayoutDashboard, ListChecks, RefreshCw, Send, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  itemKey,
  parseAuditFlowTemplateSchema,
  type AuditFlowSubmissionAnswers,
  type AuditFlowTemplateSchema,
} from "@/lib/auditflow/schema";

const supabase = getSupabaseBrowserClient();

type TemplateRow = {
  id: string;
  title: string;
  description?: string | null;
  active: boolean;
  current_version_id?: string | null;
  versions?: Array<{ id: string; version: number; schema: AuditFlowTemplateSchema }>;
};

type AssignmentRow = {
  id: string;
  template_id: string;
  template_version_id: string;
  jobsite_id?: string | null;
  assigned_user_id?: string | null;
  scheduled_date?: string | null;
  due_at?: string | null;
  status: string;
  manager_notes?: string | null;
  updated_at?: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  submitted_by?: string | null;
  status: string;
  score_summary?: {
    compliancePercent?: number | null;
    pass?: number;
    fail?: number;
    na?: number;
    totalItems?: number;
  };
  review_notes?: string | null;
  submitted_at?: string | null;
};

type CompanyUser = { id: string; name: string; email: string; role: string; status: string };
type Jobsite = { id: string; name: string; status?: string | null };

const starterSchema = JSON.stringify(
  {
    sections: [
      {
        id: "general",
        title: "General Conditions",
        items: [
          {
            id: "ppe",
            label: "Required PPE is in use",
            weight: 1,
            requirePhotoUrl: false,
            requireCommentOnFail: true,
          },
          {
            id: "housekeeping",
            label: "Work area housekeeping is acceptable",
            weight: 1,
            requirePhotoUrl: true,
            requireCommentOnFail: true,
          },
        ],
      },
    ],
  },
  null,
  2
);

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "templates", label: "Templates", icon: ListChecks },
  { id: "assignments", label: "Assignments", icon: UserPlus },
  { id: "work", label: "My Work", icon: ClipboardCheck },
  { id: "review", label: "Review", icon: Send },
  { id: "reports", label: "Reports", icon: FileText },
] as const;

function getStatusTone(status: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "approved") return "success";
  if (status === "returned" || status === "overdue") return "warning";
  if (status === "cancelled") return "error";
  if (status === "submitted" || status === "in_progress") return "info";
  return "neutral";
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function templateTitle(templates: TemplateRow[], templateId: string) {
  return templates.find((template) => template.id === templateId)?.title ?? "AuditFlow template";
}

function userLabel(users: CompanyUser[], userId?: string | null) {
  const user = users.find((row) => row.id === userId);
  return user ? `${user.name || user.email}` : "Unassigned";
}

function jobsiteLabel(jobsites: Jobsite[], jobsiteId?: string | null) {
  return jobsites.find((row) => row.id === jobsiteId)?.name ?? "No jobsite";
}

export default function AuditFlowPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("dashboard");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [templateTitleInput, setTemplateTitleInput] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSchemaText, setTemplateSchemaText] = useState(starterSchema);
  const [assignmentTemplateId, setAssignmentTemplateId] = useState("");
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignmentJobsiteId, setAssignmentJobsiteId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<AuditFlowTemplateSchema | null>(null);
  const [answers, setAnswers] = useState<AuditFlowSubmissionAnswers>({});
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAssigneeId, setReviewAssigneeId] = useState("");
  const [referenceTime, setReferenceTime] = useState(() => Date.now());

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("You must be logged in.");
    return session.access_token;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [templatesRes, assignmentsRes, usersRes, jobsitesRes] = await Promise.all([
        fetch("/api/company/auditflow/templates", { headers }),
        fetch("/api/company/auditflow/assignments", { headers }),
        fetch("/api/company/users", { headers }),
        fetch("/api/company/jobsites", { headers }),
      ]);
      const templatesData = await templatesRes.json().catch(() => null);
      const assignmentsData = await assignmentsRes.json().catch(() => null);
      const usersData = await usersRes.json().catch(() => null);
      const jobsitesData = await jobsitesRes.json().catch(() => null);
      if (!templatesRes.ok) throw new Error(templatesData?.error || "Could not load templates.");
      if (!assignmentsRes.ok) throw new Error(assignmentsData?.error || "Could not load assignments.");
      setTemplates(templatesData?.templates ?? []);
      setCanManage(Boolean(templatesData?.canManage || assignmentsData?.canManage));
      setAssignments(assignmentsData?.assignments ?? []);
      setSubmissions(assignmentsData?.submissions ?? []);
      setUsers(usersRes.ok ? usersData?.users ?? [] : []);
      setJobsites(jobsitesRes.ok ? jobsitesData?.jobsites ?? [] : []);
      setReferenceTime(Date.now());
      if (!assignmentTemplateId && templatesData?.templates?.[0]?.id) {
        setAssignmentTemplateId(templatesData.templates[0].id);
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "AuditFlow data failed to load.");
    } finally {
      setLoading(false);
    }
  }, [assignmentTemplateId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const submissionByAssignmentId = useMemo(() => {
    const map = new Map<string, SubmissionRow>();
    for (const submission of submissions) {
      if (!map.has(submission.assignment_id)) map.set(submission.assignment_id, submission);
    }
    return map;
  }, [submissions]);

  const stats = useMemo(() => {
    const active = assignments.filter((row) => row.status === "assigned" || row.status === "in_progress").length;
    const submitted = assignments.filter((row) => row.status === "submitted").length;
    const approved = assignments.filter((row) => row.status === "approved").length;
    const returned = assignments.filter((row) => row.status === "returned").length;
    const overdue = assignments.filter((row) => row.due_at && new Date(row.due_at).getTime() < referenceTime && !["approved", "cancelled"].includes(row.status)).length;
    const scored = submissions
      .map((row) => row.score_summary?.compliancePercent)
      .filter((value): value is number => typeof value === "number");
    const average = scored.length ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null;
    return { active, submitted, approved, returned, overdue, average };
  }, [assignments, referenceTime, submissions]);

  async function createTemplate() {
    setSaving(true);
    setMessage("");
    try {
      const schema = JSON.parse(templateSchemaText);
      const parsed = parseAuditFlowTemplateSchema(schema);
      if (parsed.sections.length < 1) throw new Error("Template needs at least one section with items.");
      const token = await getToken();
      const res = await fetch("/api/company/auditflow/templates", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: templateTitleInput, description: templateDescription, schema: parsed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Template save failed.");
      setMessageTone("success");
      setMessage("AuditFlow template saved.");
      setTemplateTitleInput("");
      setTemplateDescription("");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Template save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function createAssignment() {
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch("/api/company/auditflow/assignments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: assignmentTemplateId,
          assignedUserId: assignmentUserId || null,
          jobsiteId: assignmentJobsiteId || null,
          scheduledDate,
          dueAt: dueAt || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Assignment save failed.");
      setMessageTone("success");
      setMessage("AuditFlow assignment created.");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Assignment save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function openAssignment(assignmentId: string) {
    setSelectedAssignmentId(assignmentId);
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/company/auditflow/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Assignment failed to open.");
      setSelectedSchema(parseAuditFlowTemplateSchema(data?.templateVersion?.schema));
      setAnswers({});
      setSubmissionNotes("");
      setSignatureText("");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Assignment failed to open.");
    }
  }

  async function submitAssignment() {
    if (!selectedAssignmentId) return;
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/company/auditflow/assignments/${selectedAssignmentId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers, notes: submissionNotes, signatureText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.errors?.join(" ") || data?.error || "Submission failed.");
      setMessageTone((data?.correctiveActionErrors?.length ?? 0) > 0 ? "warning" : "success");
      setMessage(`Audit submitted with ${data?.correctiveActionsCreated ?? 0} linked corrective actions.`);
      setSelectedAssignmentId("");
      setSelectedSchema(null);
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewSubmission(submissionId: string, decision: "approved" | "returned") {
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/company/auditflow/submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNotes, actionAssigneeId: reviewAssigneeId || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Review failed.");
      setMessageTone("success");
      setMessage(data?.message || "Review saved.");
      setReviewNotes("");
      await loadData();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setSaving(false);
    }
  }

  function setAnswer(key: string, patch: Partial<AuditFlowSubmissionAnswers[string]>) {
    setAnswers((current) => ({
      ...current,
      [key]: {
        value: current[key]?.value ?? "pass",
        comment: current[key]?.comment ?? "",
        photoUrl: current[key]?.photoUrl ?? "",
        ...patch,
      },
    }));
  }

  const assignmentCards = assignments.map((assignment) => {
    const submission = submissionByAssignmentId.get(assignment.id);
    return (
      <div key={assignment.id} className="rounded-xl border border-[var(--app-border)] bg-white p-4 shadow-[var(--app-shadow-soft)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">
              {templateTitle(templates, assignment.template_id)}
            </p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              {jobsiteLabel(jobsites, assignment.jobsite_id)} | {userLabel(users, assignment.assigned_user_id)} | Due {formatDate(assignment.due_at)}
            </p>
          </div>
          <StatusBadge label={assignment.status.replaceAll("_", " ")} tone={getStatusTone(assignment.status)} />
        </div>
        {submission?.score_summary ? (
          <p className="mt-3 text-sm text-[var(--app-text)]">
            Score {submission.score_summary.compliancePercent ?? "--"}% | {submission.score_summary.fail ?? 0} findings
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void openAssignment(assignment.id)} className={appButtonSecondaryClassName}>
            Open
          </button>
          {submission ? (
            <a
              href={`/api/company/auditflow/submissions/${submission.id}/report`}
              target="_blank"
              rel="noreferrer"
              className={appButtonSecondaryClassName}
            >
              Report
            </a>
          ) : null}
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Audits"
        title="AuditFlow"
        description="Checklist templates, employee assignments, manager review, printable reports, and linked corrective actions."
        actions={
          <button type="button" onClick={() => void loadData()} className={appButtonSecondaryClassName} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--app-border)] bg-white p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--app-accent-primary)] text-white"
                  : "text-[var(--app-text)] hover:bg-[var(--app-accent-primary-soft)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "dashboard" ? (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Assigned", stats.active],
            ["Overdue", stats.overdue],
            ["Submitted", stats.submitted],
            ["Approved", stats.approved],
            ["Returned", stats.returned],
            ["Avg. Score", stats.average == null ? "--" : `${stats.average}%`],
          ].map(([label, value]) => (
            <SectionCard key={label} title={String(label)} contentClassName="mt-2">
              <p className="text-3xl font-bold text-[var(--app-text-strong)]">{value}</p>
            </SectionCard>
          ))}
        </div>
      ) : null}

      {activeTab === "templates" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard title="Templates">
            {templates.length < 1 ? (
              <EmptyState title="No templates" description="Create the first AuditFlow checklist template." />
            ) : (
              <div className="grid gap-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--app-text-strong)]">{template.title}</p>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">
                          v{template.versions?.[0]?.version ?? 1} | {template.versions?.[0]?.schema?.sections?.length ?? 0} sections
                        </p>
                      </div>
                      <StatusBadge label={template.active ? "Active" : "Inactive"} tone={template.active ? "success" : "neutral"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {canManage ? (
            <SectionCard title="Create Template">
              <input
                value={templateTitleInput}
                onChange={(event) => setTemplateTitleInput(event.target.value)}
                placeholder="Template title"
                className="w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm"
              />
              <input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="Description"
                className="w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm"
              />
              <textarea
                value={templateSchemaText}
                onChange={(event) => setTemplateSchemaText(event.target.value)}
                rows={18}
                className="w-full rounded-xl border border-[var(--app-border)] px-3 py-2 font-mono text-xs"
              />
              <button type="button" onClick={() => void createTemplate()} className={appButtonPrimaryClassName} disabled={saving}>
                Save Template
              </button>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {activeTab === "assignments" ? (
        <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          {canManage ? (
            <SectionCard title="Create Assignment">
              <select value={assignmentTemplateId} onChange={(event) => setAssignmentTemplateId(event.target.value)} className={appNativeSelectClassName}>
                <option value="">Select template</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
              </select>
              <select value={assignmentUserId} onChange={(event) => setAssignmentUserId(event.target.value)} className={appNativeSelectClassName}>
                <option value="">Unassigned</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
              </select>
              <select value={assignmentJobsiteId} onChange={(event) => setAssignmentJobsiteId(event.target.value)} className={appNativeSelectClassName}>
                <option value="">No jobsite</option>
                {jobsites.map((jobsite) => <option key={jobsite.id} value={jobsite.id}>{jobsite.name}</option>)}
              </select>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm" />
              <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm" />
              <button type="button" onClick={() => void createAssignment()} className={appButtonPrimaryClassName} disabled={saving || !assignmentTemplateId}>
                Create Assignment
              </button>
            </SectionCard>
          ) : null}
          <SectionCard title="All Assignments">
            <div className="grid gap-3">{assignmentCards.length ? assignmentCards : <InlineMessage>No assignments yet.</InlineMessage>}</div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "work" ? (
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <SectionCard title="Work Queue">
            <div className="grid gap-3">{assignmentCards.length ? assignmentCards : <InlineMessage>No AuditFlow assignments.</InlineMessage>}</div>
          </SectionCard>
          <SectionCard title="Complete Audit">
            {!selectedSchema ? (
              <InlineMessage>Select an assignment to open its checklist.</InlineMessage>
            ) : (
              <div className="space-y-5">
                {selectedSchema.sections.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <h3 className="font-semibold text-[var(--app-text-strong)]">{section.title}</h3>
                    {section.items.map((item) => {
                      const key = itemKey(section.id, item.id);
                      const answer = answers[key];
                      return (
                        <div key={key} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                          <p className="font-medium text-[var(--app-text-strong)]">{item.label}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(["pass", "fail", "na"] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setAnswer(key, { value })}
                                className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase ${
                                  answer?.value === value ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary)] text-white" : "border-[var(--app-border)]"
                                }`}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={answer?.comment ?? ""}
                            onChange={(event) => setAnswer(key, { comment: event.target.value })}
                            placeholder="Comment"
                            className="mt-3 w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm"
                          />
                          <input
                            value={answer?.photoUrl ?? ""}
                            onChange={(event) => setAnswer(key, { photoUrl: event.target.value })}
                            placeholder="Photo URL"
                            className="mt-3 w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
                <textarea value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} placeholder="Final notes" className="w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm" />
                <input value={signatureText} onChange={(event) => setSignatureText(event.target.value)} placeholder="Signature name" className="w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm" />
                <button type="button" onClick={() => void submitAssignment()} className={appButtonPrimaryClassName} disabled={saving}>
                  Submit For Review
                </button>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "review" ? (
        <SectionCard title="Review Queue">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Review notes" className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm" />
            <select value={reviewAssigneeId} onChange={(event) => setReviewAssigneeId(event.target.value)} className={appNativeSelectClassName}>
              <option value="">Keep corrective action assignee</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
            </select>
          </div>
          <div className="grid gap-3">
            {submissions.filter((submission) => submission.status === "submitted").length < 1 ? <InlineMessage>No submissions waiting for review.</InlineMessage> : null}
            {submissions.filter((submission) => submission.status === "submitted").map((submission) => {
              const assignment = assignments.find((row) => row.id === submission.assignment_id);
              return (
                <div key={submission.id} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-[var(--app-text-strong)]">{assignment ? templateTitle(templates, assignment.template_id) : "AuditFlow submission"}</p>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">Score {submission.score_summary?.compliancePercent ?? "--"}% | {submission.score_summary?.fail ?? 0} findings</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void reviewSubmission(submission.id, "approved")} className={appButtonPrimaryClassName} disabled={saving}>Approve</button>
                      <button type="button" onClick={() => void reviewSubmission(submission.id, "returned")} className={appButtonSecondaryClassName} disabled={saving}>Return</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "reports" ? (
        <SectionCard title="Reports">
          <div className="grid gap-3">
            {submissions.length < 1 ? <InlineMessage>No AuditFlow reports yet.</InlineMessage> : null}
            {submissions.map((submission) => {
              const assignment = assignments.find((row) => row.id === submission.assignment_id);
              return (
                <div key={submission.id} className="rounded-xl border border-[var(--app-border)] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[var(--app-text-strong)]">{assignment ? templateTitle(templates, assignment.template_id) : "AuditFlow report"}</p>
                      <p className="mt-1 text-sm text-[var(--app-muted)]">Submitted {formatDate(submission.submitted_at)} | Score {submission.score_summary?.compliancePercent ?? "--"}%</p>
                    </div>
                    <a href={`/api/company/auditflow/submissions/${submission.id}/report`} target="_blank" rel="noreferrer" className={appButtonSecondaryClassName}>
                      Open Report
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
